// ─── constants ────────────────────────────────────────────────────────────────
const DELAY_MS = 3000; // time between the declaration and the finishing blow
const HIDDEN_STRIKES = 8; // silent slash marks accumulated on the target
const FINISH_SLASH_COUNT = 24; // burst of slashes on the killing blow
const SLASH_COLOR = "#ff2b2b";

export const omaewamou = ({ showText, findStrongestEnemy, dealDamage }) => ({
  name: "Omae wa mou shindeiru",
  disabled: false,
  effect: (participant) => {
    showText(participant, "🫵 OMAE WA MOU SHINDEIRU");
    const target = findStrongestEnemy(participant);

    if (!target || !target.body) {
      showText(participant, "NANI");
      return;
    }

    showText(target, "NANI");

    const svg = document.getElementById("effects-layer");

    // ── shared glow filter, created once ──────────────────────────────────────
    let defs = svg?.querySelector("defs");
    if (svg && !defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.prepend(defs);
    }
    if (svg && !defs.querySelector("#hokuto-glow")) {
      defs.insertAdjacentHTML(
        "beforeend",
        `<filter id="hokuto-glow" x="-80%" y="-80%" width="260%" height="260%">
           <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
           <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
         </filter>`,
      );
    }

    const drawSlash = (root, cx, cy, length, color, width, duration) => {
      const angle = Math.random() * Math.PI * 2;
      const halfDx = Math.cos(angle) * length * 0.5;
      const halfDy = Math.sin(angle) * length * 0.5;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", width);
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("filter", "url(#hokuto-glow)");
      line.setAttribute("x1", cx);
      line.setAttribute("y1", cy);
      line.setAttribute("x2", cx);
      line.setAttribute("y2", cy);
      root.appendChild(line);

      const startTime = performance.now();
      const grow = (now) => {
        const t = Math.min(1, (now - startTime) / 70);
        line.setAttribute("x1", cx - halfDx * t);
        line.setAttribute("y1", cy - halfDy * t);
        line.setAttribute("x2", cx + halfDx * t);
        line.setAttribute("y2", cy + halfDy * t);
        if (t < 1) requestAnimationFrame(grow);
      };
      requestAnimationFrame(grow);

      line.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration,
        delay: 80,
        easing: "ease-in",
        fill: "forwards",
      }).onfinish = () => line.remove();
    };

    let root = null;
    if (svg) {
      root = document.createElementNS("http://www.w3.org/2000/svg", "g");
      svg.appendChild(root);
    }

    // ── silent strikes: unseen hits landing during the countdown ──────────────
    // Visually this reads as pressure points being struck one by one, well
    // before the target even realizes they're already dead.
    for (let i = 0; i < HIDDEN_STRIKES; i++) {
      const delay = 250 + (i / HIDDEN_STRIKES) * (DELAY_MS - 500);
      setTimeout(() => {
        if (!root || !target.isAlive || !target.body) return;
        const { x, y } = target.body.translation();
        const ox = (Math.random() - 0.5) * (target.sizeX ?? 50) * 0.6;
        const oy = (Math.random() - 0.5) * (target.sizeY ?? 50) * 0.6;
        drawSlash(root, x + ox, y + oy, 22 + Math.random() * 14, "#ffffff", 1, 220);
      }, delay);
    }

    // ── finishing blow ─────────────────────────────────────────────────────────
    setTimeout(() => {
      if (!participant.isAlive) {
        root?.remove();
        return;
      }
      if (!target.isAlive || !target.body) {
        root?.remove();
        return;
      }

      const { x, y } = target.body.translation();

      showText(target, "北斗百裂拳!!", "#ff2b2b");

      if (root) {
        // Explosive burst of slashes converging on the target
        for (let i = 0; i < FINISH_SLASH_COUNT; i++) {
          const jitterDelay = Math.random() * 90;
          setTimeout(() => {
            if (!target.isAlive) return;
            const p = target.body ? target.body.translation() : { x, y };
            const ox = (Math.random() - 0.5) * (target.sizeX ?? 50) * 0.7;
            const oy = (Math.random() - 0.5) * (target.sizeY ?? 50) * 0.7;
            drawSlash(
              root,
              p.x + ox,
              p.y + oy,
              40 + Math.random() * 60,
              SLASH_COLOR,
              1.5 + Math.random() * 1.5,
              260,
            );
          }, jitterDelay);
        }

        // Red flash + shatter ring at the moment of the kill
        const flash = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        flash.setAttribute("cx", x);
        flash.setAttribute("cy", y);
        flash.setAttribute("r", 8);
        flash.setAttribute("fill", "rgba(255,40,40,0.6)");
        flash.setAttribute("filter", "url(#hokuto-glow)");
        root.appendChild(flash);
        flash.animate(
          [
            { r: 8, opacity: 1 },
            { r: 90, opacity: 0 },
          ],
          { duration: 380, easing: "ease-out" },
        ).onfinish = () => flash.remove();

        setTimeout(() => root.remove(), 700);
      }

      dealDamage(target, target.maxHp, participant, false);
    }, DELAY_MS);
  },
});
