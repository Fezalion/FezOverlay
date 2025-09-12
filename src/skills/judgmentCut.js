export const judgmentCut = ({
  engineRef,
  findFarthestEnemy,
  teleport,
  showText,
  bodiesWithTimers,
  battleSettings,
  dealDamage,
}) => ({
  name: "judgmentCut",
  disabled: false,
  effect: (participant) => {
    const engine = engineRef.current;
    engine.timing.timeScale = 0; // dramatic slow-mo

    const farEnemy = findFarthestEnemy(participant);
    let pointX = participant.body.position.x;
    let pointY = participant.body.position.y;
    const chargeDuration = 1800;
    teleport(participant, farEnemy.body.position.x, farEnemy.body.position.y);

    showText(participant, "I am the storm thats aproaching!", "#1d4cf7");

    // --- Step 1: Create Slashes ---
    const slashes = [];

    // Visual slashes around every enemy
    const enemies = bodiesWithTimers.current.filter(
      (p) => p.isAlive && p.id !== participant.id
    );
    const svg = document.getElementById("effects-layer");
    const slashCount = 48; // Number of slashes per enemy
    const slashRadius = 40; // Distance from enemy center
    const slashLength = 120;
    const slashColor = "#1d4cf7";
    const slashFade = 400; // ms

    enemies.forEach((enemy) => {
      const { x, y } = enemy.body.position;
      for (let i = 0; i < slashCount; i++) {
        const delay = Math.floor((i * chargeDuration) / slashCount);
        setTimeout(() => {
          // Random angle for each slash's position
          const angle = Math.random() * 2 * Math.PI;
          const sx = x + Math.cos(angle) * slashRadius;
          const sy = y + Math.sin(angle) * slashRadius;

          // Random rotation for the slash itself
          const slashRotation = Math.random() * 360;

          // We'll animate the length from 0 to slashLength, centered at (sx, sy)
          // The line will go from (sx - dx, sy - dy) to (sx + dx, sy + dy)
          const dx =
            (Math.cos((slashRotation * Math.PI) / 180) * slashLength) / 2;
          const dy =
            (Math.sin((slashRotation * Math.PI) / 180) * slashLength) / 2;

          // Create a group to apply rotation
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g.setAttribute("transform", `rotate(${slashRotation}, ${sx}, ${sy})`);

          // Create SVG polygon for tapered slash (diamond shape)
          const slash = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "polygon"
          );
          slash.setAttribute("fill", slashColor);
          slash.setAttribute("opacity", "1");
          slash.setAttribute("filter", "url(#glow)");
          g.appendChild(slash);
          svg.appendChild(g);
          slashes.push(g);

          // Animate the slash growing out from center
          const animDuration = 120; // ms
          const startTime = performance.now();
          function animateSlash(now) {
            const t = Math.min(1, (now - startTime) / animDuration);
            // Animate from center to full length
            const currDx = dx * t;
            const currDy = dy * t;
            // Tapered width: thickest at center, thinner at ends
            const maxWidth = t < 0.2 ? 14 : 8; // flash wider at start
            const minWidth = 1.5;
            // Perpendicular vector for width
            const perpX = -dy / slashLength;
            const perpY = dx / slashLength;
            // Four points: tip1, left, tip2, right
            const tip1x = sx - currDx;
            const tip1y = sy - currDy;
            const tip2x = sx + currDx;
            const tip2y = sy + currDy;
            // At center, width is maxWidth; at tips, minWidth
            const leftx = sx - (perpX * maxWidth) / 2;
            const lefty = sy - (perpY * maxWidth) / 2;
            const rightx = sx + (perpX * maxWidth) / 2;
            const righty = sy + (perpY * maxWidth) / 2;
            // Build diamond shape (tip1, left, tip2, right)
            const points = [
              // tip1 (thin)
              tip1x +
                (perpX * minWidth) / 2 +
                "," +
                (tip1y + (perpY * minWidth) / 2),
              tip1x -
                (perpX * minWidth) / 2 +
                "," +
                (tip1y - (perpY * minWidth) / 2),
              // left (thick)
              leftx + "," + lefty,
              // tip2 (thin)
              tip2x -
                (perpX * minWidth) / 2 +
                "," +
                (tip2y - (perpY * minWidth) / 2),
              tip2x +
                (perpX * minWidth) / 2 +
                "," +
                (tip2y + (perpY * minWidth) / 2),
              // right (thick)
              rightx + "," + righty,
            ].join(" ");
            slash.setAttribute("points", points);
            // Optional: flash effect
            if (t < 0.2) {
              slash.setAttribute("opacity", String(0.7 + 0.3 * t));
            } else {
              slash.setAttribute("opacity", "1");
            }
            if (t < 1) {
              requestAnimationFrame(animateSlash);
            }
          }
          requestAnimationFrame(animateSlash);

          // Add randomization to the damage per slash
          const baseDamage =
            (battleSettings.battleEventDamage * 10) / slashCount;
          const randomFactor = 0.7 + Math.random() * 0.7; // 0.9 to 1.1
          const damage = baseDamage * randomFactor;
          dealDamage(enemy, damage, participant, false);

          // Animate fade out
          setTimeout(() => {
            slash.setAttribute("opacity", "0");
          }, slashFade - 200);
          setTimeout(() => {
            if (g.parentNode) svg.removeChild(g);
          }, slashFade);
        }, delay);
      }
    });

    // --- Step 2: Deal damage ---
    setTimeout(() => {
      engine.timing.timeScale = 1;
    }, chargeDuration);
  },
});
