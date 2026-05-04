import sword from "../utils/sword.png";

// ─── constants ────────────────────────────────────────────────────────────────
const RADIUS = 130;
const DURATION = 4000; // ms total skill duration
const SPIN_UP = 600; // ms to reach full speed
const SPIN_DOWN = 700; // ms to decelerate at the end
const SPEED_MAX = 0.32; // rad/frame at full spin
const SWORD_COUNT = 3; // swords evenly spaced around the orbit
const DMG_INTERVAL = 110; // ms between damage ticks
const DMG_FACTOR = 0.4; // fraction of battleEventDamage per tick
const KNOCKBACK = 5.5; // impulse strength on hit
const WIND_PARTICLE_RATE = 40; // ms between wind-ring spawns

export const cyclone = ({
  battleSettings,
  showText,
  dealDamage,
  battleParticipants,
}) => ({
  name: "cyclone",
  disabled: false,
  effect: (participant) => {
    if (!participant.body) return;

    const svg = document.getElementById("effects-layer");
    if (!svg) return;

    // ── ensure the glow filter exists exactly once in the SVG defs ───────────
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.prepend(defs);
    }
    if (!defs.querySelector("#cyclone-glow")) {
      defs.insertAdjacentHTML(
        "beforeend",
        `<filter id="cyclone-glow" x="-60%" y="-60%" width="220%" height="220%">
           <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
           <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
         </filter>`,
      );
    }

    // ── root group — everything lives here so one remove() cleans up ─────────
    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(root);

    // ── subtle orbit ring ─────────────────────────────────────────────────────
    const ring = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    ring.setAttribute("r", RADIUS);
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "rgba(0,220,255,0.25)");
    ring.setAttribute("stroke-width", "1.5");
    ring.setAttribute("stroke-dasharray", "6 6");
    root.appendChild(ring);

    // ── swords ────────────────────────────────────────────────────────────────
    const sWords = Array.from({ length: SWORD_COUNT }, (_, i) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const img = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image",
      );
      const sW = RADIUS * 0.85;
      const sH = 38;
      img.setAttribute("href", sword);
      img.setAttribute("width", sW);
      img.setAttribute("height", sH);
      img.setAttribute("x", -sW); // pivot at right edge (tip toward center)
      img.setAttribute("y", -sH / 2);
      img.setAttribute("filter", "url(#cyclone-glow)");

      // glow trail line behind each sword
      const trail = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      trail.setAttribute("x1", 0);
      trail.setAttribute("y1", 0);
      trail.setAttribute("x2", -sW * 0.7);
      trail.setAttribute("y2", 0);
      trail.setAttribute("stroke", "rgba(0,200,255,0.45)");
      trail.setAttribute("stroke-width", "4");
      trail.setAttribute("stroke-linecap", "round");
      trail.setAttribute("filter", "url(#cyclone-glow)");

      g.appendChild(trail);
      g.appendChild(img);
      root.appendChild(g);
      return { g, baseAngle: (i / SWORD_COUNT) * Math.PI * 2 };
    });

    // ── wind particles (spawned on an interval, removed individually) ─────────
    const windInterval = setInterval(() => {
      if (!participant.body) return;
      const { x, y } = participant.body.translation();

      // spawn a ring arc that expands and fades
      const arc = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      const spawnR = RADIUS * (0.6 + Math.random() * 0.5);
      arc.setAttribute("cx", x);
      arc.setAttribute("cy", y);
      arc.setAttribute("r", spawnR);
      arc.setAttribute("fill", "none");
      arc.setAttribute(
        "stroke",
        `rgba(0,${(180 + Math.random() * 75) | 0},255,0.5)`,
      );
      arc.setAttribute("stroke-width", "1");
      svg.appendChild(arc);

      arc.animate(
        [
          { r: spawnR, opacity: 0.6, strokeWidth: "1.5px" },
          { r: spawnR + 40, opacity: 0, strokeWidth: "0.3px" },
        ],
        { duration: 420, easing: "ease-out" },
      ).onfinish = () => arc.remove();

      // also a small spark at a random orbit point
      const sparkAngle = Math.random() * Math.PI * 2;
      const spark = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      spark.setAttribute("cx", x + Math.cos(sparkAngle) * RADIUS);
      spark.setAttribute("cy", y + Math.sin(sparkAngle) * RADIUS);
      spark.setAttribute("r", 2 + Math.random() * 2);
      spark.setAttribute("fill", "cyan");
      svg.appendChild(spark);
      spark.animate(
        [
          { opacity: 1, r: "3" },
          { opacity: 0, r: "0" },
        ],
        { duration: 280 + Math.random() * 150, easing: "ease-out" },
      ).onfinish = () => spark.remove();
    }, WIND_PARTICLE_RATE);

    // ── animation loop ────────────────────────────────────────────────────────
    let raf;
    let angle = 0;
    const startTime = performance.now();
    const endTime = startTime + DURATION;

    const tick = (now) => {
      if (!participant.isAlive || !participant.body) {
        cleanup();
        return;
      }

      // speed ramp-up at start, ramp-down near end
      const elapsed = now - startTime;
      const remaining = endTime - now;
      const spinFrac = Math.min(
        elapsed < SPIN_UP ? elapsed / SPIN_UP : 1,
        remaining < SPIN_DOWN ? remaining / SPIN_DOWN : 1,
      );
      const speed = SPEED_MAX * spinFrac;

      // scale sword opacity and ring opacity with spin fraction
      root.setAttribute("opacity", 0.4 + spinFrac * 0.6);

      const { x, y } = participant.body.translation();
      ring.setAttribute("cx", x);
      ring.setAttribute("cy", y);

      sWords.forEach(({ g, baseAngle }) => {
        const a = angle + baseAngle;
        const sx = x + Math.cos(a) * RADIUS;
        const sy = y + Math.sin(a) * RADIUS;
        const deg = (a * 180) / Math.PI;
        g.setAttribute("transform", `translate(${sx},${sy}) rotate(${deg})`);
      });

      angle += speed;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    // ── damage + knockback ────────────────────────────────────────────────────
    const dmgInterval = setInterval(() => {
      if (!participant.isAlive || !participant.body) return;

      const pPos = participant.body.translation();
      const targets = battleParticipants?.current ?? [];

      targets.forEach((enemy) => {
        if (
          !enemy ||
          enemy.id === participant.id ||
          !enemy.isAlive ||
          !enemy.body
        )
          return;

        const ePos = enemy.body.translation();
        const dx = ePos.x - pPos.x;
        const dy = ePos.y - pPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < RADIUS + 35 && dist > 0.5) {
          dealDamage(
            enemy,
            (battleSettings?.battleEventDamage ?? 10) * DMG_FACTOR,
            participant,
            false,
          );

          // radial knockback — re-check body after dealDamage since it may
          // have just killed the enemy and nulled their body
          if (enemy.isAlive && enemy.body) {
            const nx = dx / dist;
            const ny = dy / dist;
            enemy.body.applyImpulse(
              { x: nx * KNOCKBACK, y: ny * KNOCKBACK },
              true,
            );
          }
        }
      });
    }, DMG_INTERVAL);

    // ── cleanup ───────────────────────────────────────────────────────────────
    const cleanup = () => {
      cancelAnimationFrame(raf);
      clearInterval(dmgInterval);
      clearInterval(windInterval);

      // fade root out then remove
      root.animate(
        [{ opacity: root.getAttribute("opacity") ?? 1 }, { opacity: 0 }],
        { duration: 350, easing: "ease-out", fill: "forwards" },
      ).onfinish = () => root.remove();
    };

    setTimeout(cleanup, DURATION);
    showText(participant, "🌀 CYCLONE!");
  },
});
