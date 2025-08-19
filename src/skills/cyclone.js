import sword from "../utils/sword.png";

export const cyclone = ({
  battleSettings,
  showText,
  dealDamage,
  bodiesWithTimers,
}) => ({
  name: "cyclone",
  disabled: false,
  effect: (participant) => {
    const radius = 120;
    const speed = 0.5;
    let angle = 0;
    let angle2 = Math.PI;

    const effectLayer = document.getElementById("effects-layer");

    // --- Circle aura ---
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("r", radius);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "cyan");
    circle.setAttribute("stroke-width", "1");
    circle.setAttribute("opacity", "0.7");
    effectLayer.appendChild(circle);

    // --- Ensure defs for glow ---
    let defs = effectLayer.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      effectLayer.appendChild(defs);

      const filter = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "filter"
      );
      filter.setAttribute("id", "sword-glow");
      filter.setAttribute("x", "-50%");
      filter.setAttribute("y", "-50%");
      filter.setAttribute("width", "200%");
      filter.setAttribute("height", "200%");

      const feGaussian = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "feGaussianBlur"
      );
      feGaussian.setAttribute("in", "SourceAlpha");
      feGaussian.setAttribute("stdDeviation", "4");
      feGaussian.setAttribute("result", "blur");

      const feColor = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "feFlood"
      );
      feColor.setAttribute("flood-color", "cyan");
      feColor.setAttribute("flood-opacity", "1");

      const feComp = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "feComposite"
      );
      feComp.setAttribute("in2", "blur");
      feComp.setAttribute("operator", "in");

      const feMerge = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "feMerge"
      );
      const feMergeNode1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "feMergeNode"
      );
      const feMergeNode2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "feMergeNode"
      );
      feMergeNode2.setAttribute("in", "SourceGraphic");

      feMerge.appendChild(feMergeNode1);
      feMerge.appendChild(feMergeNode2);

      filter.appendChild(feGaussian);
      filter.appendChild(feColor);
      filter.appendChild(feComp);
      filter.appendChild(feMerge);
      defs.appendChild(filter);
    }

    // --- Sword factory helper ---
    const createSwordGroup = () => {
      const swordOutline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image"
      );
      swordOutline.setAttribute("href", sword);
      swordOutline.setAttribute("width", radius * 1.05);
      swordOutline.setAttribute("height", "50");
      swordOutline.setAttribute("x", radius * -1.025);
      swordOutline.setAttribute("y", -25);
      swordOutline.setAttribute("preserveAspectRatio", "xMidYMid meet");
      swordOutline.setAttribute("opacity", "0.7");
      swordOutline.setAttribute(
        "style",
        "filter: hue-rotate(0deg) saturate(0%) brightness(0);"
      );

      const swordImg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image"
      );
      swordImg.setAttribute("href", sword);
      swordImg.setAttribute("width", radius);
      swordImg.setAttribute("height", "50");
      swordImg.setAttribute("x", radius * -1);
      swordImg.setAttribute("y", -25);
      swordImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      swordImg.setAttribute("filter", "url(#sword-glow)");

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.appendChild(swordOutline);
      group.appendChild(swordImg);
      effectLayer.appendChild(group);

      return group;
    };

    const group1 = createSwordGroup();
    const group2 = createSwordGroup();

    // --- Trail storage ---
    const maxTrail = 15;
    const trails = [];

    const addTrail = (x, y) => {
      const trail = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      trail.setAttribute("cx", x);
      trail.setAttribute("cy", y);
      trail.setAttribute("r", 6);
      trail.setAttribute("fill", "cyan");
      trail.setAttribute("opacity", "0.4");
      effectLayer.appendChild(trail);

      trails.push(trail);
      if (trails.length > maxTrail) {
        const old = trails.shift();
        old.remove();
      }

      // Fade out
      setTimeout(() => {
        trail.setAttribute("opacity", "0");
        setTimeout(() => trail.remove(), 500);
      }, 0);
    };

    // --- Update loop ---
    const update = () => {
      if (!participant.isAlive) {
        clearInterval(animationLoop);
        clearInterval(damageLoop);
        circle.remove();
        group1.remove();
        group2.remove();
        trails.forEach((t) => t.remove());
        return;
      }
      const { x, y } = participant.body.position;

      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);

      // Sword 1
      const swordX1 = x + Math.cos(angle) * radius;
      const swordY1 = y + Math.sin(angle) * radius;
      const rotation1 = (angle * 180) / Math.PI;
      group1.setAttribute(
        "transform",
        `translate(${swordX1},${swordY1}) rotate(${rotation1})`
      );
      addTrail(swordX1, swordY1);

      // Sword 2
      const swordX2 = x + Math.cos(angle2) * radius;
      const swordY2 = y + Math.sin(angle2) * radius;
      const rotation2 = (angle2 * 180) / Math.PI;
      group2.setAttribute(
        "transform",
        `translate(${swordX2},${swordY2}) rotate(${rotation2})`
      );
      addTrail(swordX2, swordY2);

      angle += speed;
      angle2 += speed;
    };

    const animationLoop = setInterval(update, 16);

    // --- Damage loop ---
    const damageLoop = setInterval(() => {
      if (!participant.isAlive) return;
      const enemies = bodiesWithTimers.current.filter(
        (p) => p.isAlive && p.id !== participant.id
      );

      enemies.forEach((enemy) => {
        const dx = enemy.body.position.x - participant.body.position.x;
        const dy = enemy.body.position.y - participant.body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius + 20) {
          dealDamage(
            enemy,
            battleSettings.battleEventDamage * 0.4,
            participant,
            false
          );
        }
      });
    }, 150);

    // --- Cleanup ---
    setTimeout(() => {
      clearInterval(animationLoop);
      clearInterval(damageLoop);
      circle.remove();
      group1.remove();
      group2.remove();
      trails.forEach((t) => t.remove());
    }, 3000);

    showText(participant, "⚔️ Cyclone activated!");
  },
});
