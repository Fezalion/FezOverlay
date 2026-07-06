// ─── constants ────────────────────────────────────────────────────────────────
const CHARGE_MS = 500; // matches the delay before radialKnockback fires
const CHARGE_RINGS = 4; // converging rings during the charge-up
const DEBRIS_COUNT = 18;
const CRACK_COUNT = 10;

export const shinraTensei = ({ showText, radialKnockback }) => ({
  name: "Shinra Tensei",
  disabled: true,
  effect: (participant) => {
    if (!participant.body) return;

    showText(participant, "🙏🏻 SHINRA TENSEI", "#ffee00ff");

    const svg = document.getElementById("effects-layer");
    if (!svg) return;

    // ── shared glow filter, created once ──────────────────────────────────────
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.prepend(defs);
    }
    if (!defs.querySelector("#shinra-glow")) {
      defs.insertAdjacentHTML(
        "beforeend",
        `<filter id="shinra-glow" x="-100%" y="-100%" width="300%" height="300%">
           <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
           <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
         </filter>`,
      );
    }

    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(root);

    // ── charge-up: rings collapse inward toward the caster ───────────────────
    for (let i = 0; i < CHARGE_RINGS; i++) {
      const delay = (i / CHARGE_RINGS) * CHARGE_MS * 0.7;
      setTimeout(() => {
        if (!participant.body) return;
        const pos = participant.body.translation();
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("cx", pos.x);
        ring.setAttribute("cy", pos.y);
        ring.setAttribute("r", 220);
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", "#ffee00");
        ring.setAttribute("stroke-width", "2");
        ring.setAttribute("filter", "url(#shinra-glow)");
        root.appendChild(ring);
        ring.animate(
          [
            { r: 220, opacity: 0 },
            { r: 40, opacity: 0.9 },
          ],
          { duration: CHARGE_MS - delay, easing: "ease-in" },
        ).onfinish = () => ring.remove();
      }, delay);
    }

    // Glowing core that swells as the charge builds
    const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    core.setAttribute("fill", "rgba(255,238,0,0.35)");
    core.setAttribute("stroke", "#fff6b0");
    core.setAttribute("stroke-width", "1.5");
    core.setAttribute("filter", "url(#shinra-glow)");
    root.appendChild(core);

    let raf;
    const trackCore = () => {
      if (!participant.body) return;
      const pos = participant.body.translation();
      core.setAttribute("cx", pos.x);
      core.setAttribute("cy", pos.y);
      raf = requestAnimationFrame(trackCore);
    };
    raf = requestAnimationFrame(trackCore);
    core.animate([{ r: 4 }, { r: 26 }], {
      duration: CHARGE_MS,
      fill: "forwards",
      easing: "ease-in",
    });

    // ── release ────────────────────────────────────────────────────────────────
    setTimeout(() => {
      cancelAnimationFrame(raf);
      core.remove();

      if (!participant.isAlive) {
        root.remove();
        return;
      }

      const pos = participant.body ? participant.body.translation() : { x: 0, y: 0 };

      // Blinding release flash
      const flash = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      flash.setAttribute("cx", pos.x);
      flash.setAttribute("cy", pos.y);
      flash.setAttribute("r", 10);
      flash.setAttribute("fill", "#fffde0");
      flash.setAttribute("filter", "url(#shinra-glow)");
      root.appendChild(flash);
      flash.animate(
        [
          { r: 10, opacity: 1 },
          { r: 90, opacity: 0 },
        ],
        { duration: 260, easing: "ease-out" },
      ).onfinish = () => flash.remove();

      // Expanding shockwave ring — the visual read of the actual knockback
      const shockwave = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      shockwave.setAttribute("cx", pos.x);
      shockwave.setAttribute("cy", pos.y);
      shockwave.setAttribute("r", 20);
      shockwave.setAttribute("fill", "none");
      shockwave.setAttribute("stroke", "#ffee00");
      shockwave.setAttribute("stroke-width", "4");
      shockwave.setAttribute("filter", "url(#shinra-glow)");
      root.appendChild(shockwave);
      shockwave.animate(
        [
          { r: 20, opacity: 0.9, strokeWidth: "6px" },
          { r: 520, opacity: 0, strokeWidth: "0.5px" },
        ],
        { duration: 650, easing: "ease-out" },
      ).onfinish = () => shockwave.remove();

      // Radial ground-crack lines
      for (let i = 0; i < CRACK_COUNT; i++) {
        const a = (i / CRACK_COUNT) * Math.PI * 2 + Math.random() * 0.2;
        const crack = document.createElementNS("http://www.w3.org/2000/svg", "line");
        crack.setAttribute("x1", pos.x);
        crack.setAttribute("y1", pos.y);
        crack.setAttribute("x2", pos.x);
        crack.setAttribute("y2", pos.y);
        crack.setAttribute("stroke", "#ffe873");
        crack.setAttribute("stroke-width", "1.5");
        root.appendChild(crack);

        const len = 100 + Math.random() * 140;
        crack.animate(
          [
            { x2: pos.x, y2: pos.y, opacity: 0.9 },
            { x2: pos.x + Math.cos(a) * len, y2: pos.y + Math.sin(a) * len, opacity: 0 },
          ],
          { duration: 500 + Math.random() * 200, easing: "ease-out" },
        ).onfinish = () => crack.remove();
      }

      // Debris flung outward with the knockback
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 220;
        const chip = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const s = 2 + Math.random() * 4;
        chip.setAttribute("x", pos.x);
        chip.setAttribute("y", pos.y);
        chip.setAttribute("width", s);
        chip.setAttribute("height", s);
        chip.setAttribute("fill", Math.random() > 0.5 ? "#c9a24a" : "#8a6d2f");
        root.appendChild(chip);

        chip.animate(
          [
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            {
              transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) rotate(${Math.random() * 360}deg)`,
              opacity: 0,
            },
          ],
          { duration: 500 + Math.random() * 350, easing: "ease-out" },
        ).onfinish = () => chip.remove();
      }

      radialKnockback(participant);

      setTimeout(() => root.remove(), 1000);
    }, CHARGE_MS);
  },
});
