export const kamehameha = ({
  setEngineTimeScale,
  restoreEngineTimeScale,
  findNearestEnemy,
  findFarthestEnemy,
  findPopulatedPoint,
  teleport,
  showText,
  battleParticipants,
  battleSettings,
  dealDamage,
}) => ({
  name: "kamehameha",
  disabled: true,
  effect: (participant) => {
    if (!participant.body) return;

    // ─── 1. SETUP ────────────────────────────────────────────────────────────

    setEngineTimeScale(0.08); // deeper slow-mo for dramatic effect

    // Target nearest enemy for better gameplay feel
    const target =
      (typeof findNearestEnemy === "function"
        ? findNearestEnemy(participant)
        : null) || findFarthestEnemy(participant);

    const targetPoint = target
      ? target.body.translation()
      : findPopulatedPoint(participant);

    const { x: targetX, y: targetY } = targetPoint;

    // Teleport caster 220 units behind them relative to target
    const dx0 = targetX - participant.body.translation().x;
    const dy0 = targetY - participant.body.translation().y;
    const dist0 = Math.hypot(dx0, dy0) || 1;
    teleport(
      participant,
      targetX - (dx0 / dist0) * 220,
      targetY - (dy0 / dist0) * 4, // slight vertical offset for stance
    );

    // Lock caster in place during charge
    participant.body.setLinvel({ x: 0, y: 0 }, true);
    participant.body.setBodyType(window.RAPIER.RigidBodyType.Fixed, true);

    showText(participant, "KA... ME... HA... ME...", "#00fbff");

    const svg = document.getElementById("effects-layer");
    const CHARGE_DURATION = 2000;
    const BEAM_DURATION = 2400;
    const intervals = [];

    // ─── 2. CHARGE VISUALS ───────────────────────────────────────────────────

    // Pulsing energy rings at feet — 3 independent layers at different rates
    const ringConfigs = [
      { interval: 280, maxR: 110, color: "cyan", strokeW: 1.5, dur: 560 },
      { interval: 420, maxR: 160, color: "#00aaff", strokeW: 1, dur: 700 },
      { interval: 560, maxR: 220, color: "#0055ff", strokeW: 0.8, dur: 900 },
    ];

    ringConfigs.forEach(({ interval, maxR, color, strokeW, dur }) => {
      const id = setInterval(() => {
        if (!participant.body) return;
        const pos = participant.body.translation();
        const ring = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        ring.setAttribute("cx", pos.x);
        ring.setAttribute("cy", pos.y);
        ring.setAttribute("r", "8");
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", color);
        ring.setAttribute("stroke-width", strokeW);
        svg.appendChild(ring);

        ring.animate(
          [
            { r: "8", opacity: 0.9 },
            { r: `${maxR}`, opacity: 0 },
          ],
          { duration: dur, easing: "ease-out" },
        ).onfinish = () => ring.remove();
      }, interval);
      intervals.push(id);
    });

    // Gathering particle sparks that spiral inward
    const sparkId = setInterval(() => {
      if (!participant.body) return;
      const pos = participant.body.translation();
      const angle = Math.random() * Math.PI * 2;
      const spawnR = 60 + Math.random() * 80;
      const spark = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      spark.setAttribute("cx", pos.x + Math.cos(angle) * spawnR);
      spark.setAttribute("cy", pos.y + Math.sin(angle) * spawnR);
      spark.setAttribute("r", 2 + Math.random() * 2);
      spark.setAttribute("fill", Math.random() > 0.5 ? "#00fbff" : "#ffffff");
      svg.appendChild(spark);

      spark.animate(
        [
          {
            cx: pos.x + Math.cos(angle) * spawnR,
            cy: pos.y + Math.sin(angle) * spawnR,
            opacity: 1,
          },
          { cx: pos.x, cy: pos.y, opacity: 0 },
        ],
        { duration: 500 + Math.random() * 400, easing: "ease-in" },
      ).onfinish = () => spark.remove();
    }, 60);
    intervals.push(sparkId);

    // Charging orb that grows over the charge duration
    const orb = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    orb.setAttribute("fill", "rgba(0,200,255,0.25)");
    orb.setAttribute("stroke", "#00fbff");
    orb.setAttribute("stroke-width", "1.5");
    svg.appendChild(orb);

    const orbAnim = () => {
      if (!participant.body) {
        orb.remove();
        return;
      }
      const pos = participant.body.translation();
      orb.setAttribute("cx", pos.x);
      orb.setAttribute("cy", pos.y);
      orb.setAttribute("r", 6 + Math.random() * 3); // jitter for energy feel
    };
    const orbId = setInterval(orbAnim, 40);
    intervals.push(orbId);

    // Gradually grow the orb
    orb.animate([{ r: "8" }, { r: "28" }], {
      duration: CHARGE_DURATION,
      fill: "forwards",
      easing: "ease-in",
    });

    // ─── 3. FIRE ─────────────────────────────────────────────────────────────

    setTimeout(() => {
      intervals.forEach(clearInterval);
      orb.remove();

      restoreEngineTimeScale(1.0);
      showText(participant, "HA!!!", "#ffffff");

      // Three-layer beam: outer glow → mid energy → white core
      const outerGlow = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      const midBeam = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      const coreBeam = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );

      outerGlow.setAttribute("fill", "rgba(0,120,255,0.18)");
      outerGlow.setAttribute("filter", "blur(12px)");
      midBeam.setAttribute("fill", "rgba(0,210,255,0.55)");
      coreBeam.setAttribute("fill", "#ffffff");

      svg.appendChild(outerGlow);
      svg.appendChild(midBeam);
      svg.appendChild(coreBeam);

      // Muzzle flash — glowing sphere at emission point
      const muzzle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      muzzle.setAttribute("fill", "rgba(180,240,255,0.8)");
      svg.appendChild(muzzle);

      const BEAM_LENGTH = 4200;
      let beamAge = 0;

      const buildPolygon = (cx, cy, angle, halfW, length) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const perpX = -sin * halfW;
        const perpY = cos * halfW;
        const tipX = cx + cos * length;
        const tipY = cy + sin * length;
        return `${cx + perpX},${cy + perpY} ${cx - perpX},${cy - perpY} ${tipX - perpX * 0.1},${tipY - perpY * 0.1} ${tipX + perpX * 0.1},${tipY + perpY * 0.1}`;
      };

      const updateBeams = () => {
        if (!participant.isAlive || !participant.body) return;
        beamAge += 16;
        const fadeIn = Math.min(beamAge / 200, 1); // beam grows into existence

        const pos = participant.body.translation();

        // Always track where the target currently is (dynamic aim)
        const currentTargetX = target?.body
          ? target.body.translation().x
          : targetX;
        const currentTargetY = target?.body
          ? target.body.translation().y
          : targetY;

        const angle = Math.atan2(
          currentTargetY - pos.y,
          currentTargetX - pos.x,
        );

        const jitter = () => (Math.random() - 0.5) * 14;

        outerGlow.setAttribute(
          "points",
          buildPolygon(
            pos.x,
            pos.y,
            angle,
            (170 + jitter()) * fadeIn,
            BEAM_LENGTH,
          ),
        );
        midBeam.setAttribute(
          "points",
          buildPolygon(
            pos.x,
            pos.y,
            angle,
            (44 + jitter()) * fadeIn,
            BEAM_LENGTH,
          ),
        );
        coreBeam.setAttribute(
          "points",
          buildPolygon(
            pos.x,
            pos.y,
            angle,
            (10 + jitter()) * fadeIn,
            BEAM_LENGTH,
          ),
        );

        [outerGlow, midBeam, coreBeam].forEach((b) =>
          b.setAttribute("transform", `rotate(0, ${pos.x}, ${pos.y})`),
        );

        // Muzzle pulse
        muzzle.setAttribute("cx", pos.x + Math.cos(angle) * 12);
        muzzle.setAttribute("cy", pos.y + Math.sin(angle) * 12);
        muzzle.setAttribute("r", (18 + Math.random() * 8) * fadeIn);

        // Slight recoil — push caster backward
        if (participant.body && beamAge < 300) {
          const recoilForce = 0.6;
          participant.body.applyImpulse(
            {
              x: -Math.cos(angle) * recoilForce,
              y: -Math.sin(angle) * recoilForce,
            },
            true,
          );
        }
      };

      const beamInterval = setInterval(updateBeams, 16);

      // ─── 4. DAMAGE + KNOCKBACK ─────────────────────────────────────────────

      let damageRamp = 0; // damage scales up over beam duration

      const enemies = (battleParticipants.current || []).filter(
        (p) => p.isAlive && p.id !== participant.id,
      );

      const damageLoop = setInterval(() => {
        if (!participant.body) return;
        damageRamp = Math.min(damageRamp + 0.06, 2.0); // ramps from ×1 to ×2

        const pos = participant.body.translation();
        const currentTargetX = target?.body
          ? target.body.translation().x
          : targetX;
        const currentTargetY = target?.body
          ? target.body.translation().y
          : targetY;
        const angleRad = Math.atan2(
          currentTargetY - pos.y,
          currentTargetX - pos.x,
        );
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        enemies.forEach((enemy) => {
          if (!enemy.body || !enemy.isAlive) return;
          const ePos = enemy.body.translation();
          const ex = ePos.x - pos.x;
          const ey = ePos.y - pos.y;
          const proj = ex * cos + ey * sin;
          const perp = -ex * sin + ey * cos;

          if (proj >= 0 && Math.abs(perp) < 65) {
            // Scale damage: starts at 20% of base, ramps to 40%
            dealDamage(
              enemy,
              battleSettings.battleEventDamage * 0.2 * damageRamp,
              participant,
              false,
            );

            // Knockback — push enemy along beam direction
            if (enemy.body) {
              const knockStrength = 4.5 + damageRamp * 2;
              enemy.body.applyImpulse(
                { x: cos * knockStrength, y: sin * knockStrength },
                true,
              );
            }

            // Hit spark at enemy position
            spawnHitSparks(svg, ePos.x, ePos.y);
          }
        });
      }, 100);

      // ─── 5. CLEANUP WITH FADE ─────────────────────────────────────────────

      setTimeout(() => {
        clearInterval(beamInterval);
        clearInterval(damageLoop);

        // Fade out all beam layers
        const fadeTargets = [outerGlow, midBeam, coreBeam, muzzle];
        fadeTargets.forEach((el) => {
          el.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 350,
            easing: "ease-out",
            fill: "forwards",
          }).onfinish = () => el.remove();
        });

        if (participant.body) {
          participant.body.setBodyType(
            window.RAPIER.RigidBodyType.Dynamic,
            true,
          );
        }
      }, BEAM_DURATION);
    }, CHARGE_DURATION);
  },
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function spawnHitSparks(svg, x, y) {
  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 40;
    const spark = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    const len = 3 + Math.random() * 6;
    spark.setAttribute("x1", x);
    spark.setAttribute("y1", y);
    spark.setAttribute("x2", x + Math.cos(angle) * len);
    spark.setAttribute("y2", y + Math.sin(angle) * len);
    spark.setAttribute("stroke", Math.random() > 0.4 ? "#00fbff" : "#ffffff");
    spark.setAttribute("stroke-width", 1 + Math.random());
    svg.appendChild(spark);

    spark.animate(
      [
        {
          transform: "translate(0,0)",
          opacity: 1,
        },
        {
          transform: `translate(${Math.cos(angle) * speed}px, ${Math.sin(angle) * speed}px)`,
          opacity: 0,
        },
      ],
      { duration: 260 + Math.random() * 160, easing: "ease-out" },
    ).onfinish = () => spark.remove();
  }
}
