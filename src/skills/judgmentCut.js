// ─── constants ────────────────────────────────────────────────────────────────
const CHARGE_DURATION = 1800; // ms of slow-mo accumulation
const SLASH_COUNT = 22; // slashes per enemy
const SLASH_RADIUS = 32; // scatter radius around each enemy
const SLASH_COLOR = "#3bc9e5";
const TOTAL_DAMAGE_MUL = 2.8; // multiplier on battleEventDamage spread across all slashes
const RELEASE_FLASH_MS = 180; // white-out duration on release
const HOLD_MS = 150; // how long slashes linger after release before vanishing

export const judgmentCut = ({
  findFarthestEnemy,
  teleport,
  showText,
  battleParticipants,
  battleSettings,
  dealDamage,
  setEngineTimeScale,
  restoreEngineTimeScale,
}) => ({
  name: "judgmentCut",
  disabled: false,
  effect: (participant) => {
    if (!participant.body) return;

    const farEnemy = findFarthestEnemy(participant);
    if (!farEnemy || !farEnemy.body) return;

    // ── teleport caster next to farthest enemy ────────────────────────────────
    const targetPos = farEnemy.body.translation();
    teleport(participant, targetPos.x, targetPos.y);

    setEngineTimeScale(0.05);
    showText(participant, "I am the storm that is approaching!", "#1d4cf7");

    const svg = document.getElementById("effects-layer");
    if (!svg) return;

    // ── ensure glow filter exists ─────────────────────────────────────────────
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.prepend(defs);
    }
    if (!defs.querySelector("#jc-glow")) {
      defs.insertAdjacentHTML(
        "beforeend",
        `<filter id="jc-glow" x="-80%" y="-80%" width="260%" height="260%">
           <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
           <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
         </filter>`,
      );
    }

    // ── snapshot alive enemies now; we'll re-check body each slash tick ───────
    const enemies = (battleParticipants.current ?? []).filter(
      (p) => p.isAlive && p.id !== participant.id,
    );
    if (enemies.length === 0) {
      restoreEngineTimeScale(1.0);
      return;
    }

    // ── root group — holds all slash geometry; one remove() cleans everything ─
    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(root);

    // ── accumulate slash elements during charge ───────────────────────────────
    // Each slash is created at its delay but stays visible (opacity=1) until
    // the release moment, when they all flash white then vanish together.
    const allSlashGroups = [];

    enemies.forEach((enemy) => {
      const baseDamage =
        (battleSettings.battleEventDamage * TOTAL_DAMAGE_MUL) / SLASH_COUNT;

      for (let i = 0; i < SLASH_COUNT; i++) {
        const delay = Math.floor((i / SLASH_COUNT) * CHARGE_DURATION * 0.92);

        setTimeout(() => {
          // Guard: enemy or caster may have died during the charge
          if (!enemy.isAlive || !enemy.body) return;
          if (!participant.isAlive) return;

          // Read position live so slashes follow a moving enemy
          const { x, y } = enemy.body.translation();

          const scatterAngle = Math.random() * Math.PI * 2;
          const scatterDist = Math.random() * SLASH_RADIUS;
          const cx = x + Math.cos(scatterAngle) * scatterDist;
          const cy = y + Math.sin(scatterAngle) * scatterDist;

          // vary slash length — short cuts mixed with long sweeping ones
          const slashLength = 60 + Math.random() * 110;
          const slashAngle = Math.random() * Math.PI * 2;
          const halfDx = Math.cos(slashAngle) * slashLength * 0.5;
          const halfDy = Math.sin(slashAngle) * slashLength * 0.5;

          // thin line slash — draws from center outward to both tips
          const outerG = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g",
          );
          const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
          );
          const strokeW = 1.2 + Math.random() * 1.2;
          line.setAttribute("stroke", SLASH_COLOR);
          line.setAttribute("stroke-width", strokeW);
          line.setAttribute("stroke-linecap", "round");
          line.setAttribute("filter", "url(#jc-glow)");
          line.setAttribute("opacity", "0.9");
          line.setAttribute("x1", cx);
          line.setAttribute("y1", cy);
          line.setAttribute("x2", cx);
          line.setAttribute("y2", cy);
          outerG.appendChild(line);
          root.appendChild(outerG);
          allSlashGroups.push(outerG);

          // animate tips extending outward from center
          const startTime = performance.now();
          const animDur = 80 + Math.random() * 40;
          const tip1x = cx - halfDx;
          const tip1y = cy - halfDy;
          const tip2x = cx + halfDx;
          const tip2y = cy + halfDy;

          const drawSlash = (now) => {
            const t = Math.min(1, (now - startTime) / animDur);
            line.setAttribute("x1", cx + (tip1x - cx) * t);
            line.setAttribute("y1", cy + (tip1y - cy) * t);
            line.setAttribute("x2", cx + (tip2x - cx) * t);
            line.setAttribute("y2", cy + (tip2y - cy) * t);
            if (t < 1) requestAnimationFrame(drawSlash);
          };
          requestAnimationFrame(drawSlash);

          // deal damage at slash creation time
          dealDamage(
            enemy,
            baseDamage * (0.6 + Math.random() * 0.8),
            participant,
            false,
          );
        }, delay);
      }
    });

    // ── release — happens at end of charge ────────────────────────────────────
    setTimeout(() => {
      restoreEngineTimeScale(1.0);

      // turn all slashes bright white, then fade and remove
      allSlashGroups.forEach((g) => {
        g.querySelectorAll("line").forEach((l) =>
          l.setAttribute("stroke", "#ffffff"),
        );
        setTimeout(() => {
          g.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: HOLD_MS,
            easing: "ease-in",
            fill: "forwards",
          }).onfinish = () => g.remove();
        }, 60);
      });

      // clean up root after everything is gone
      setTimeout(() => root.remove(), HOLD_MS + 200);
    }, CHARGE_DURATION);
  },
});
