// ─── constants ────────────────────────────────────────────────────────────────
const SHIELD_DURATION = 2000; // ms — must match the `duration` field below,
// since BattleOverlay expires `hasShield` centrally based on it
const HEX_SIDES = 6;
const RING_PULSE_RATE = 420; // ms between scan-ring pulses
const SHIMMER_RATE = 90; // ms between orbiting shimmer particles
const SHATTER_SHARDS = 10;

export const shield = ({ showText }) => ({
  name: "Shield",
  disabled: false,
  duration: SHIELD_DURATION,
  effect: (participant) => {
    if (!participant?.body) return;

    // Functional bits BattleOverlay relies on directly — kept intact so
    // dealDamage()'s 50% mitigation and the central expiry logic still work.
    participant.el?.classList.add("has-shield");
    participant.hasShield = true;
    if (participant.el) {
      participant.el.style.boxShadow = `0 0 30px #00aaff, 0 0 20px ${participant.userColor}`;
    }

    showText(participant, "🛡️ SHIELD", "#00aaff");

    const svg = document.getElementById("effects-layer");
    if (!svg) return;

    // ── shared glow filter, created once ──────────────────────────────────────
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.prepend(defs);
    }
    if (!defs.querySelector("#shield-glow")) {
      defs.insertAdjacentHTML(
        "beforeend",
        `<filter id="shield-glow" x="-80%" y="-80%" width="260%" height="260%">
           <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
           <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
         </filter>`,
      );
    }

    const R = (participant.sizeX ?? 60) / 2 + 22;

    // ── root group — everything lives here so one remove() cleans up ─────────
    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(root);

    const hexPoints = (radius, rotationDeg) =>
      Array.from({ length: HEX_SIDES }, (_, i) => {
        const a = (i / HEX_SIDES) * Math.PI * 2 + (rotationDeg * Math.PI) / 180;
        return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
      }).join(" ");

    // Static hex dome — rotates slowly for a "living barrier" feel
    const hex = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon",
    );
    hex.setAttribute("points", hexPoints(R, 0));
    hex.setAttribute("fill", "rgba(0,170,255,0.08)");
    hex.setAttribute("stroke", "#00d2ff");
    hex.setAttribute("stroke-width", "1.5");
    hex.setAttribute("filter", "url(#shield-glow)");
    root.appendChild(hex);

    // ── deploy flash — quick outward burst when the shield snaps into place ──
    const flash = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    flash.setAttribute("r", "6");
    flash.setAttribute("fill", "none");
    flash.setAttribute("stroke", "#bff2ff");
    flash.setAttribute("stroke-width", "2");
    flash.setAttribute("filter", "url(#shield-glow)");
    root.appendChild(flash);
    flash.animate(
      [
        { r: 6, opacity: 1 },
        { r: R * 1.3, opacity: 0 },
      ],
      { duration: 320, easing: "ease-out" },
    ).onfinish = () => flash.remove();

    // ── pulsing scan rings, spawned on an interval ────────────────────────────
    const ringInterval = setInterval(() => {
      if (!participant.body) return;
      const pos = participant.body.translation();
      const ring = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      ring.setAttribute("cx", pos.x);
      ring.setAttribute("cy", pos.y);
      ring.setAttribute("r", R * 0.6);
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", "rgba(0,210,255,0.5)");
      ring.setAttribute("stroke-width", "1");
      svg.appendChild(ring);
      ring.animate(
        [
          { r: R * 0.6, opacity: 0.6 },
          { r: R * 1.15, opacity: 0 },
        ],
        { duration: 500, easing: "ease-out" },
      ).onfinish = () => ring.remove();
    }, RING_PULSE_RATE);

    // ── orbiting shimmer motes across the dome surface ────────────────────────
    const shimmerInterval = setInterval(() => {
      const angle = Math.random() * Math.PI * 2;
      const spark = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      spark.setAttribute("cx", Math.cos(angle) * R);
      spark.setAttribute("cy", Math.sin(angle) * R);
      spark.setAttribute("r", 1.5 + Math.random() * 1.5);
      spark.setAttribute("fill", "#bff2ff");
      root.appendChild(spark);
      spark.animate(
        [
          { opacity: 0.9, r: 2 },
          { opacity: 0, r: 0.5 },
        ],
        { duration: 350, easing: "ease-out" },
      ).onfinish = () => spark.remove();
    }, SHIMMER_RATE);

    // ── follow the participant + slow rotation while the shield is up ────────
    let rotation = 0;
    let raf;
    const tick = () => {
      if (!participant.body || !participant.isAlive) {
        cleanup();
        return;
      }
      const pos = participant.body.translation();
      rotation += 0.4;
      root.setAttribute(
        "transform",
        `translate(${pos.x},${pos.y}) rotate(${rotation})`,
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // ── cleanup: shield shatters into fragments when it runs out ──────────────
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      cancelAnimationFrame(raf);
      clearInterval(ringInterval);
      clearInterval(shimmerInterval);

      const pos = participant.body
        ? participant.body.translation()
        : { x: 0, y: 0 };

      for (let i = 0; i < SHATTER_SHARDS; i++) {
        const a = (i / SHATTER_SHARDS) * Math.PI * 2 + Math.random() * 0.3;
        const shard = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        shard.setAttribute("x1", pos.x + Math.cos(a) * R);
        shard.setAttribute("y1", pos.y + Math.sin(a) * R);
        shard.setAttribute("x2", pos.x + Math.cos(a) * R);
        shard.setAttribute("y2", pos.y + Math.sin(a) * R);
        shard.setAttribute("stroke", "#bff2ff");
        shard.setAttribute("stroke-width", "1.5");
        shard.setAttribute("filter", "url(#shield-glow)");
        svg.appendChild(shard);

        const len = 14 + Math.random() * 20;
        shard.animate(
          [
            {
              x2: pos.x + Math.cos(a) * R,
              y2: pos.y + Math.sin(a) * R,
              opacity: 1,
            },
            {
              x2: pos.x + Math.cos(a) * (R + len),
              y2: pos.y + Math.sin(a) * (R + len),
              opacity: 0,
            },
          ],
          { duration: 380, easing: "ease-out" },
        ).onfinish = () => shard.remove();
      }

      root.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 300,
        easing: "ease-in",
        fill: "forwards",
      }).onfinish = () => root.remove();

      if (participant.el) {
        setTimeout(() => {
          if (participant.el) {
            participant.el.style.boxShadow = `0 0 20px ${participant.userColor}`;
          }
        }, 0);
      }
    };

    setTimeout(cleanup, SHIELD_DURATION);
  },
});
