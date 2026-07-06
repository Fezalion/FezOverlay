// ─── constants ────────────────────────────────────────────────────────────────
const HEAL_FACTOR = 0.3; // fraction of battleEventHp restored
const MOTE_RATE = 55; // ms between rising motes
const EFFECT_DURATION = 950; // ms the aura stays visible

export const heal = ({ battleSettings, showText }) => ({
  name: "Heal",
  disabled: true,
  effect: (p) => {
    if (!p.isAlive || !p.body) return;

    const healAmount = battleSettings.battleEventHp * HEAL_FACTOR;
    p.hp = Math.min(p.maxHp, p.hp + healAmount);

    showText(p, "💚 HEAL", "#00ff00");
    showText(p, `+${Math.round(healAmount)}`, "#66ff99");

    // Functional glow kept intact for consistency with the rest of the roster
    if (p.el) {
      p.el.style.boxShadow = `0 0 30px #00ff00, 0 0 20px ${p.userColor}`;
      setTimeout(() => {
        if (p.el) p.el.style.boxShadow = `0 0 20px ${p.userColor}`;
      }, 1000);
    }

    const svg = document.getElementById("effects-layer");
    if (!svg) return;

    // ── shared glow filter, created once ──────────────────────────────────────
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.prepend(defs);
    }
    if (!defs.querySelector("#heal-glow")) {
      defs.insertAdjacentHTML(
        "beforeend",
        `<filter id="heal-glow" x="-80%" y="-80%" width="260%" height="260%">
           <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
           <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
         </filter>`,
      );
    }

    const R = (p.sizeX ?? 60) / 2 + 16;

    // ── plus-symbol flash at cast time ────────────────────────────────────────
    const startPos = p.body.translation();
    const plus = document.createElementNS("http://www.w3.org/2000/svg", "g");
    plus.setAttribute("filter", "url(#heal-glow)");
    ["h", "v"].forEach((axis) => {
      const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const w = axis === "h" ? 26 : 8;
      const h = axis === "h" ? 8 : 26;
      bar.setAttribute("x", -w / 2);
      bar.setAttribute("y", -h / 2);
      bar.setAttribute("width", w);
      bar.setAttribute("height", h);
      bar.setAttribute("rx", 2);
      bar.setAttribute("fill", "#7dffb0");
      plus.appendChild(bar);
    });
    plus.setAttribute("transform", `translate(${startPos.x},${startPos.y - R * 0.6}) scale(0.3)`);
    svg.appendChild(plus);
    plus.animate(
      [
        { transform: `translate(${startPos.x}px,${startPos.y - R * 0.6}px) scale(0.3)`, opacity: 1 },
        { transform: `translate(${startPos.x}px,${startPos.y - R * 1.1}px) scale(1.1)`, opacity: 0 },
      ],
      { duration: 650, easing: "ease-out" },
    ).onfinish = () => plus.remove();

    // ── expanding pulse ring beneath the participant ──────────────────────────
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("cx", startPos.x);
    ring.setAttribute("cy", startPos.y);
    ring.setAttribute("r", 6);
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#43ff8c");
    ring.setAttribute("stroke-width", "2");
    ring.setAttribute("filter", "url(#heal-glow)");
    svg.appendChild(ring);
    ring.animate(
      [
        { r: 6, opacity: 0.8 },
        { r: R * 1.6, opacity: 0 },
      ],
      { duration: 550, easing: "ease-out" },
    ).onfinish = () => ring.remove();

    // ── rising sparkle motes, spawned on an interval and tracking the target ──
    let elapsed = 0;
    const moteInterval = setInterval(() => {
      if (!p.body) return;
      elapsed += MOTE_RATE;
      if (elapsed > EFFECT_DURATION) {
        clearInterval(moteInterval);
        return;
      }

      const pos = p.body.translation();
      const spawnX = pos.x + (Math.random() - 0.5) * R * 1.6;
      const spawnY = pos.y + R * 0.6;

      const mote = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      mote.setAttribute("cx", spawnX);
      mote.setAttribute("cy", spawnY);
      mote.setAttribute("r", 1.5 + Math.random() * 2);
      mote.setAttribute("fill", Math.random() > 0.5 ? "#7dffb0" : "#eafff2");
      mote.setAttribute("filter", "url(#heal-glow)");
      svg.appendChild(mote);

      const drift = (Math.random() - 0.5) * 18;
      mote.animate(
        [
          { transform: "translate(0,0)", opacity: 1 },
          { transform: `translate(${drift}px, ${-R * 2.4}px)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 300, easing: "ease-out" },
      ).onfinish = () => mote.remove();
    }, MOTE_RATE);

    setTimeout(() => clearInterval(moteInterval), EFFECT_DURATION + 50);
  },
});
