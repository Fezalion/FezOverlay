export const kamehameha = ({
  engineRef,
  findFarthestEnemy,
  findPopulatedPoint,
  teleport,
  showText,
  sceneRef,
  bodiesWithTimers,
  battleSettings,
  dealDamage,
}) => ({
  name: "kamehameha",
  disabled: false,
  effect: (participant) => {
    const engine = engineRef.current;
    engine.timing.timeScale = 0.01; // dramatic slow-mo

    const farEnemy = findFarthestEnemy(participant);
    const { x: pointX, y: pointY } = findPopulatedPoint(participant);
    teleport(participant, farEnemy.body.position.x, farEnemy.body.position.y);

    // --- Step 1: Charge orb ---
    showText(participant, "KA... ME...");
    const chargeDuration = 1200;

    const orb = document.createElement("div");
    orb.style.position = "absolute";
    orb.style.width = "90px";
    orb.style.height = "90px";
    orb.style.borderRadius = "50%";
    orb.style.pointerEvents = "none";
    orb.style.zIndex = 2000;
    orb.style.background =
      "radial-gradient(circle, rgba(0,160,255,1) 0%, rgba(0,160,255,0.7) 40%, transparent 70%)";
    orb.style.boxShadow =
      "0 0 40px rgba(0,200,255,0.9), 0 0 80px rgba(0,200,255,0.7)";
    sceneRef.current.appendChild(orb);

    // Orb pulse animation
    const orbPulse = orb.animate(
      [
        { transform: "scale(0.8)", opacity: 0.8 },
        { transform: "scale(1.2)", opacity: 1 },
        { transform: "scale(0.8)", opacity: 0.8 },
      ],
      { duration: 800, iterations: Infinity }
    );

    const updateOrb = () => {
      const pos = participant.body.position;
      orb.style.left = `${pos.x - 45}px`;
      orb.style.top = `${pos.y - 45}px`;
    };
    const orbInterval = setInterval(updateOrb, 16);

    // --- Yellow → white → transparent particles ---
    const spawnParticle = () => {
      const pos = participant.body.position;
      const particle = document.createElement("div");
      const size = Math.random() * 6 + 4;
      particle.style.position = "absolute";
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.borderRadius = "50%";
      particle.style.background = "yellow";
      particle.style.boxShadow = "0 0 8px rgba(255,255,100,0.8)";
      particle.style.left = `${pos.x + (Math.random() * 60 - 30)}px`;
      particle.style.top = `${pos.y + (Math.random() * 60 - 30)}px`;
      particle.style.pointerEvents = "none";
      particle.style.zIndex = 1999;
      sceneRef.current.appendChild(particle);

      const rise = Math.random() * 40 + 40;
      const duration = Math.random() * 600 + 400;

      particle.animate(
        [
          {
            transform: "translateY(0px)",
            opacity: 1,
            background: "yellow",
            boxShadow: "0 0 8px rgba(255,255,100,0.8)",
          },
          {
            transform: `translateY(-${rise / 2}px)`,
            opacity: 0.8,
            background: "white",
            boxShadow: "0 0 12px rgba(255,255,255,1)",
          },
          {
            transform: `translateY(-${rise}px)`,
            opacity: 0,
            background: "rgba(255,255,255,0)",
            boxShadow: "0 0 4px rgba(255,255,255,0.2)",
          },
        ],
        { duration, easing: "ease-out" }
      ).onfinish = () => {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
      };
    };

    // --- Sync particle bursts with orb pulse ---
    orbPulse.onfinish = () => {
      orbPulse.play(); // restart pulse
      for (let i = 0; i < 6; i++) {
        setTimeout(spawnParticle, i * 60);
      }
    };

    // Stop particles + orb when beam fires
    setTimeout(() => {
      clearInterval(orbInterval);
      orbPulse.cancel();
      sceneRef.current.removeChild(orb);
    }, chargeDuration);

    setTimeout(() => {
      showText(participant, "HAAA!!!");
    }, chargeDuration);
    // --- Step 2: Fire beam ---
    setTimeout(() => {
      const svg = document.getElementById("effects-layer");
      const beamWidth = 180;
      const beamLength = 4000;

      // Ensure defs only once
      if (!document.getElementById("beamGlow")) {
        const defs = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "defs"
        );

        const grad = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "linearGradient"
        );
        grad.setAttribute("id", "kameGradient");
        grad.setAttribute("x1", "0%");
        grad.setAttribute("x2", "100%");
        grad.innerHTML = `
                  <stop offset="0%" stop-color="rgba(0,160,255,0.6)"/>
                  <stop offset="50%" stop-color="rgba(200,250,255,1)"/>
                  <stop offset="100%" stop-color="rgba(0,160,255,0.6)"/>
                `;
        defs.appendChild(grad);

        const filter = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "filter"
        );
        filter.setAttribute("id", "beamGlow");
        filter.innerHTML = `<feGaussianBlur stdDeviation="6" result="blur"/>`;
        defs.appendChild(filter);

        svg.appendChild(defs);
      }

      // Beam polygon
      const beam = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon"
      );
      beam.setAttribute("fill", "url(#kameGradient)");
      beam.setAttribute("filter", "url(#beamGlow)");
      svg.appendChild(beam);

      // Round start (circle overlay)
      const startCircle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      startCircle.setAttribute("r", beamWidth / 2);
      startCircle.setAttribute("fill", "url(#kameGradient)");
      startCircle.setAttribute("filter", "url(#beamGlow)");
      svg.appendChild(startCircle);

      // Update beam shape
      const updateBeam = () => {
        const start = participant.body.position;
        const dx = pointX - start.x;
        const dy = pointY - start.y;
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = angleRad * (180 / Math.PI);

        const p1x = start.x;
        const p1y = start.y - beamWidth / 2;
        const p2x = start.x;
        const p2y = start.y + beamWidth / 2;
        const p3x = start.x + beamLength;
        const p3y = start.y + beamWidth / 2;
        const p4x = start.x + beamLength;
        const p4y = start.y - beamWidth / 2;

        beam.setAttribute(
          "points",
          `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`
        );
        beam.setAttribute(
          "transform",
          `rotate(${angleDeg}, ${start.x}, ${start.y})`
        );

        startCircle.setAttribute("cx", start.x);
        startCircle.setAttribute("cy", start.y);
      };
      updateBeam();
      const beamInterval = setInterval(updateBeam, 16);

      // Damage loop
      const enemies = bodiesWithTimers.current.filter(
        (p) => p.isAlive && p.id != participant.id
      );
      const damageLoop = setInterval(() => {
        const start = participant.body.position;
        const dx = pointX - start.x;
        const dy = pointY - start.y;
        const angleRad = Math.atan2(dy, dx);
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        enemies.forEach((enemy) => {
          const ex = enemy.body.position.x - start.x;
          const ey = enemy.body.position.y - start.y;
          const proj = ex * cos + ey * sin;
          const perp = -ex * sin + ey * cos;

          if (proj >= 0 && Math.abs(perp) < beamWidth / 2) {
            dealDamage(
              enemy,
              battleSettings.battleEventDamage * 0.4,
              participant,
              false
            );
          }
        });
      }, 120);

      // Fade + shrink cleanup
      setTimeout(() => {
        const startTime = Date.now();
        const fadeDuration = 800;

        const fadeInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const t = Math.min(1, elapsed / fadeDuration);
          const currentWidth = beamWidth * (1 - t);

          const startPos = participant.body.position;
          const dx = pointX - startPos.x;
          const dy = pointY - startPos.y;
          const angleRad = Math.atan2(dy, dx);
          const angleDeg = angleRad * (180 / Math.PI);

          const p1x = startPos.x;
          const p1y = startPos.y - currentWidth / 2;
          const p2x = startPos.x;
          const p2y = startPos.y + currentWidth / 2;
          const p3x = startPos.x + beamLength;
          const p3y = startPos.y + currentWidth / 2;
          const p4x = startPos.x + beamLength;
          const p4y = startPos.y - currentWidth / 2;

          beam.setAttribute(
            "points",
            `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`
          );
          beam.setAttribute(
            "transform",
            `rotate(${angleDeg}, ${startPos.x}, ${startPos.y})`
          );
          beam.setAttribute("opacity", 1 - t);
          startCircle.setAttribute("r", currentWidth / 2);
          startCircle.setAttribute("opacity", 1 - t);

          if (t >= 1) {
            clearInterval(fadeInterval);
            clearInterval(beamInterval);
            clearInterval(damageLoop);
            svg.removeChild(beam);
            svg.removeChild(startCircle);
            engine.timing.timeScale = 1;
          }
        }, 16);
      }, 1200);
    }, chargeDuration);
  },
});
