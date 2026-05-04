export const lightning = ({
  findNearestEnemy,
  showText,
  dealDamage,
  battleSettings,
  setEngineTimeScale,
  restoreEngineTimeScale,
}) => ({
  name: "Lightning",
  disabled: false,
  effect: (participant) => {
    if (!participant?.isAlive) return;

    // Safe position getter — returns null if body/translation unavailable
    const getPos = (unit) => {
      try {
        return unit?.body?.translation?.() ?? null;
      } catch {
        return null;
      }
    };

    // Find nearest enemies — guard against null sources
    const farEnemy = participant ? findNearestEnemy(participant) : null;
    const chain = farEnemy ? findNearestEnemy(farEnemy, participant) : null;
    const chain2 = chain
      ? findNearestEnemy(chain, participant, farEnemy)
      : null;

    // Early exit if there's nobody to hit
    if (!farEnemy) return;

    // --- Pre-calculate chain damage (upfront, before animation loop) ---
    if (chain) {
      const p_far = getPos(farEnemy);
      const p_chain = getPos(chain);
      const p_chain2 = getPos(chain2);

      if (p_far && p_chain) {
        const chainDistance =
          Math.abs(p_chain.x - p_far.x) + Math.abs(p_chain.y - p_far.y);
        const chain2Distance = p_chain2
          ? Math.abs(p_chain2.x - p_chain.x) + Math.abs(p_chain2.y - p_chain.y)
          : 0;
        const totalDistance = chainDistance + chain2Distance;
        const chainStrength = Math.max(0, 1 - totalDistance / 500);

        dealDamage(
          chain,
          battleSettings.battleEventDamage * chainStrength,
          participant,
          false,
        );

        if (chain2 && p_chain2) {
          dealDamage(
            chain2,
            battleSettings.battleEventDamage * chainStrength * 0.5,
            participant,
            false,
          );
        }
      }
    }

    showText(participant, "⚡ LIGHTNING STRIKE!", "#4af");

    // Enable physics slowdown
    setEngineTimeScale(0.08);

    // --- SVG Layer Setup ---
    let svg = document.getElementById("lightning-svg-layer");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "lightning-svg-layer";
      svg.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 9999;
        overflow: visible;
      `;

      // Inject keyframe styles once
      if (!document.getElementById("lightning-styles")) {
        const style = document.createElement("style");
        style.id = "lightning-styles";
        style.textContent = `
          @keyframes bolt-flash {
            0%   { opacity: 1; }
            40%  { opacity: 0.9; }
            60%  { opacity: 0.2; }
            80%  { opacity: 0.8; }
            100% { opacity: 0; }
          }
          @keyframes zap-ring {
            0%   { r: 4; opacity: 1; }
            100% { r: 28; opacity: 0; }
          }
          @keyframes spark-fly {
            0%   { opacity: 1; }
            100% { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      // Shared defs: glow filter
      const defs = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs",
      );
      defs.innerHTML = `
        <filter id="lightning-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="lightning-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      `;
      svg.appendChild(defs);
      document.body.appendChild(svg);
    }

    // -------------------------------------------------------
    // Core helper: generate a jagged zigzag lightning path
    // Guards against zero-length bolts (start === end)
    // -------------------------------------------------------
    const generateBoltPath = (x1, y1, x2, y2, segments = 12, spread = 22) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);

      // Avoid division by zero if both points are identical
      if (len < 0.01) return `M${x1},${y1} L${x2},${y2}`;

      const nx = -dy / len;
      const ny = dx / len;

      let d = `M${x1},${y1}`;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const bx = x1 + dx * t;
        const by = y1 + dy * t;
        const jitter =
          (Math.random() - 0.5) * 2 * spread * (1 - Math.abs(t - 0.5) * 1.5);
        d += ` L${bx + nx * jitter},${by + ny * jitter}`;
      }
      d += ` L${x2},${y2}`;
      return d;
    };

    // -------------------------------------------------------
    // Draw one complete bolt (main + core + glow)
    // with optional branch
    // -------------------------------------------------------
    const drawBolt = (x1, y1, x2, y2, opts = {}) => {
      // Bail if any coordinate is invalid
      if ([x1, y1, x2, y2].some((v) => v == null || !isFinite(v))) return;

      const {
        color = "#66ddff",
        coreColor = "#ffffff",
        width = 3,
        duration = 0.45,
        segments = 14,
        spread = 20,
        withBranch = true,
      } = opts;

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.style.animation = `bolt-flash ${duration}s ease-out forwards`;

      const makePath = (d, stroke, sw, filter) => {
        const p = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        p.setAttribute("d", d);
        p.setAttribute("stroke", stroke);
        p.setAttribute("stroke-width", sw);
        p.setAttribute("fill", "none");
        p.setAttribute("stroke-linecap", "round");
        p.setAttribute("stroke-linejoin", "round");
        if (filter) p.setAttribute("filter", `url(#${filter})`);
        return p;
      };

      const boltD = generateBoltPath(x1, y1, x2, y2, segments, spread);

      // Outer glow
      group.appendChild(
        makePath(boltD, color, width + 6, "lightning-glow-strong"),
      );
      // Mid glow
      group.appendChild(makePath(boltD, color, width + 2, "lightning-glow"));
      // Main bolt
      group.appendChild(makePath(boltD, color, width));
      // White core
      group.appendChild(makePath(boltD, coreColor, Math.max(1, width - 1.5)));

      // Optional branch
      if (withBranch) {
        const branchT = 0.3 + Math.random() * 0.4;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const bx = x1 + dx * branchT;
        const by = y1 + dy * branchT;
        const angle = Math.atan2(dy, dx) + (Math.random() > 0.5 ? 0.6 : -0.6);
        const branchLen = 30 + Math.random() * 50;
        const ex = bx + Math.cos(angle) * branchLen;
        const ey = by + Math.sin(angle) * branchLen;
        const brD = generateBoltPath(bx, by, ex, ey, 6, 10);
        group.appendChild(makePath(brD, color, width * 0.5, "lightning-glow"));
        group.appendChild(makePath(brD, coreColor, Math.max(0.5, width * 0.3)));
      }

      svg.appendChild(group);

      setTimeout(() => group.remove(), duration * 1000 + 50);
      return group;
    };

    // -------------------------------------------------------
    // Impact ring + sparks at hit point
    // -------------------------------------------------------
    const drawImpact = (x, y, color = "#66ddff", size = 1) => {
      if (x == null || y == null || !isFinite(x) || !isFinite(y)) return;

      // Expanding ring
      const ring = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      ring.setAttribute("cx", x);
      ring.setAttribute("cy", y);
      ring.setAttribute("r", 4 * size);
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", color);
      ring.setAttribute("stroke-width", 2);
      ring.setAttribute("filter", "url(#lightning-glow)");
      ring.style.animation = "zap-ring 0.5s ease-out forwards";
      svg.appendChild(ring);
      setTimeout(() => ring.remove(), 550);

      // Inner flash
      const flash = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      flash.setAttribute("cx", x);
      flash.setAttribute("cy", y);
      flash.setAttribute("r", 6 * size);
      flash.setAttribute("fill", color);
      flash.setAttribute("fill-opacity", "0.4");
      flash.setAttribute("filter", "url(#lightning-glow-strong)");
      flash.style.animation = "bolt-flash 0.3s ease-out forwards";
      svg.appendChild(flash);
      setTimeout(() => flash.remove(), 350);

      // Sparks radiating out
      const sparkCount = 6 + Math.round(2 * size);
      for (let s = 0; s < sparkCount; s++) {
        const angle = (s / sparkCount) * Math.PI * 2 + Math.random() * 0.4;
        const len = (20 + Math.random() * 30) * size;
        const spark = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        spark.setAttribute("x1", x);
        spark.setAttribute("y1", y);
        spark.setAttribute("x2", x + Math.cos(angle) * len);
        spark.setAttribute("y2", y + Math.sin(angle) * len);
        spark.setAttribute("stroke", color);
        spark.setAttribute("stroke-width", 1.5);
        spark.setAttribute("stroke-linecap", "round");
        spark.setAttribute("filter", "url(#lightning-glow)");
        spark.style.animation = `spark-fly 0.4s ease-out forwards`;
        svg.appendChild(spark);
        setTimeout(() => spark.remove(), 450);
      }
    };

    // -------------------------------------------------------
    // Animation loop — 8 strikes, each re-drawing the bolt
    // -------------------------------------------------------
    const lightningStrikes = 8;
    const interval = 100;
    const offset = 50;
    let totalTimeTook = 0;

    for (let i = 0; i < lightningStrikes; i++) {
      const baseTime = i * interval;

      // Strike 1: participant → farEnemy
      setTimeout(() => {
        if (!participant?.isAlive) return;

        const p1 = getPos(participant);
        const p2 = getPos(farEnemy);
        if (!p1 || !p2) return;

        drawBolt(p1.x, p1.y, p2.x, p2.y, {
          color: "#44aaff",
          coreColor: "#ccf0ff",
          width: 2.0,
          duration: 0.45,
          segments: 14,
          spread: 22,
          withBranch: true,
        });
        drawImpact(p2.x, p2.y, "#44aaff", 1.2);

        dealDamage(
          farEnemy,
          battleSettings.battleEventDamage * 0.3,
          participant,
          false,
        );
      }, baseTime + offset);

      // Strike 2: farEnemy → chain
      if (chain) {
        setTimeout(
          () => {
            if (!participant?.isAlive) return;

            const p1 = getPos(farEnemy);
            const p2 = getPos(chain);
            if (!p1 || !p2) return;

            drawBolt(p1.x, p1.y, p2.x, p2.y, {
              color: "#66ccff",
              coreColor: "#ddf5ff",
              width: 1.3,
              duration: 0.38,
              segments: 11,
              spread: 16,
              withBranch: true,
            });
            drawImpact(p2.x, p2.y, "#66ccff", 0.9);

            const chainDistance = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
            const chainStrength = Math.max(0, 1 - chainDistance / 500);
            dealDamage(
              chain,
              battleSettings.battleEventDamage * chainStrength,
              participant,
              false,
            );
            dealDamage(
              chain,
              battleSettings.battleEventDamage * 0.2,
              participant,
              false,
            );
          },
          baseTime + 100 + offset,
        );
      }

      // Strike 3: chain → chain2
      if (chain && chain2) {
        setTimeout(
          () => {
            if (!participant?.isAlive) return;

            const p1 = getPos(chain);
            const p2 = getPos(chain2);
            if (!p1 || !p2) return;

            drawBolt(p1.x, p1.y, p2.x, p2.y, {
              color: "#88ddff",
              coreColor: "#eefbff",
              width: 1.0,
              duration: 0.3,
              segments: 9,
              spread: 12,
              withBranch: false,
            });
            drawImpact(p2.x, p2.y, "#88ddff", 0.7);

            const chain2Distance =
              Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
            const chain2Strength = Math.max(0, 1 - chain2Distance / 500);
            dealDamage(
              chain2,
              battleSettings.battleEventDamage * chain2Strength * 0.5,
              participant,
              false,
            );
            dealDamage(
              chain2,
              battleSettings.battleEventDamage * 0.1,
              participant,
              false,
            );
          },
          baseTime + 200 + offset,
        );
      }

      totalTimeTook = baseTime + 200 + offset;
    }

    // Resume physics + final cleanup
    setTimeout(() => {
      restoreEngineTimeScale();

      // Big final impact at farEnemy
      const fp = getPos(farEnemy);
      if (fp) drawImpact(fp.x, fp.y, "#ffffff", 2);

      setTimeout(() => {
        svg
          ?.querySelectorAll(
            "*:not(defs):not(filter):not(feGaussianBlur):not(feMerge):not(feMergeNode)",
          )
          .forEach((el) => el.remove());
      }, 2000);
    }, totalTimeTook + offset);
  },
});
