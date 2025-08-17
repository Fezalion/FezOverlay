import { useRef, useCallback } from 'react';
import Matter from 'matter-js';
import { createEmoteElement } from '../utils/emoteEffects';

export function useBattleSystem(engineRef, emoteMap, bodiesWithTimers, battleSettings, subscriberTracker, sceneRef) {
  const activeBattleRef = useRef(null);
  const battleParticipants = useRef([]);
  const battleUpdateListener = useRef(null);

  const specialSkills = useCallback({
    heal: {
      name: 'Heal',
      disabled: false,
      effect: (p) => {
        const healAmount = battleSettings.battleEventHp * 0.3;
        p.hp = Math.min(p.maxHp, p.hp + healAmount);
        showText(p, "💚 HEAL", "#00ff00");
        // Green glow effect on participant
        p.el.style.boxShadow = `0 0 30px #00ff00, 0 0 20px ${p.userColor}`;
        setTimeout(() => {
          if (p.el) p.el.style.boxShadow = `0 0 20px ${p.userColor}`;
        }, 1000);
        
      }
    },
    shield: {
      name: 'Shield',
      disabled: false,
      duration: 2000,
      effect: (p) => {
        showText(p, "🛡️ SHIELD", "#00aaff");
        p.el.classList.add('has-shield');
        p.hasShield = true; 
        // Green glow effect on participant
        p.el.style.boxShadow = `0 0 30px #00aaff, 0 0 20px ${p.userColor}`;
        setTimeout(() => {
          if (p.el) p.el.style.boxShadow = `0 0 20px ${p.userColor}`;
        }, 2000);
      }
    },
    kamehameha: {
      name: 'kamehameha',
      disabled: false,
      effect: (participant) => {
        const engine = engineRef.current;
        engine.timing.timeScale = 0; // dramatic slow-mo

        const farEnemy = findFarthestEnemy(participant);
        const { x: pointX, y: pointY } = findPopulatedPoint(participant);
        teleport(participant, farEnemy.body.position.x, farEnemy.body.position.y);

        // --- Step 1: Charge phase ---
        showText(participant, "KAME...");
        const chargeDuration = 500;

        const glow = document.createElement("div");
        glow.style.position = "absolute";
        glow.style.width = "60px";
        glow.style.height = "60px";
        glow.style.borderRadius = "50%";
        glow.style.background = "radial-gradient(circle, #00f, transparent)";
        glow.style.pointerEvents = "none";
        glow.style.zIndex = 1000;
        sceneRef.current.appendChild(glow);

        const updateGlow = () => {
          const pos = participant.body.position;
          glow.style.left = `${pos.x - 30}px`;
          glow.style.top = `${pos.y - 30}px`;
        };
        const glowInterval = setInterval(updateGlow, 16);

        setTimeout(() => {
          showText(participant, "HAME HA!");
          clearInterval(glowInterval);
          sceneRef.current.removeChild(glow);

          // --- Step 2: Fire beam ---
          const svg = document.getElementById("effects-layer");
          const beamWidth = 80;
          const beamLength = 5000; // “infinite” length

          // Create beam
          const beam = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          beam.setAttribute("width", beamLength);
          beam.setAttribute("height", beamWidth);
          beam.setAttribute("rx", beamWidth / 2);
          beam.setAttribute("ry", beamWidth / 2);
          beam.setAttribute("fill", "url(#kameGradient)");
          beam.setAttribute("opacity", 1);
          svg.appendChild(beam);

          // Gradient setup
          if (!document.getElementById("kameGradient")) {
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
            grad.setAttribute("id", "kameGradient");
            grad.setAttribute("x1", "0");
            grad.setAttribute("y1", "0");
            grad.setAttribute("x2", "0");
            grad.setAttribute("y2", beamWidth);

            const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop1.setAttribute("offset", "0%");
            stop1.setAttribute("stop-color", "rgba(0, 0, 255, 0.8)");
            grad.appendChild(stop1);

            const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop2.setAttribute("offset", "50%");
            stop2.setAttribute("stop-color", "rgba(0, 0, 255, 1)");
            grad.appendChild(stop2);

            const stop3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop3.setAttribute("offset", "100%");
            stop3.setAttribute("stop-color", "rgba(0, 0, 255, 0.8)");
            grad.appendChild(stop3);

            defs.appendChild(grad);
            svg.appendChild(defs);
          }

          // --- Beam positioning ---
          const updateBeam = () => {
            const start = participant.body?.position;
            if (!start || isNaN(start.x) || isNaN(start.y)) return;

            const dx = pointX - start.x;
            const dy = pointY - start.y;
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = angleRad * (180 / Math.PI);

            beam.setAttribute("x", start.x);
            beam.setAttribute("y", start.y - beamWidth / 2);
            beam.setAttribute("transform", `rotate(${angleDeg}, ${start.x}, ${start.y})`);
          };
          updateBeam();
          const beamInterval = setInterval(updateBeam, 16);

          // --- Damage loop ---
          const enemies = bodiesWithTimers.current.filter(p => p.isAlive && p.id != participant.id);
          const damageLoop = setInterval(() => {
            const start = participant.body.position;
            const dx = pointX - start.x;
            const dy = pointY - start.y;
            const angleRad = Math.atan2(dy, dx);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            enemies.forEach(enemy => {
              const ex = enemy.body.position.x - start.x;
              const ey = enemy.body.position.y - start.y;

              const proj = ex * cos + ey * sin;      // distance along the beam
              const perp = -ex * sin + ey * cos;     // perpendicular distance to beam

              if (proj >= 0 && Math.abs(perp) < beamWidth / 2) {
                dealDamage(enemy, battleSettings.battleEventDamage * 0.2, participant, false);
              }
            });
          }, 100);          

          // --- Cleanup with fade & shrink ---
          setTimeout(() => {
            const startTime = Date.now();
            const fadeDuration = 500; // ms

            const fadeInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const t = Math.min(1, elapsed / fadeDuration);

                // Width shrinks from full → 0
                const currentWidth = beamWidth * (1 - t);

                const startPos = participant.body.position;

                const dx = pointX - startPos.x;
                const dy = pointY - startPos.y;
                const angleRad = Math.atan2(dy, dx);
                const angleDeg = angleRad * (180 / Math.PI);

                // Build polygon with shrinking width
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

                // Fade opacity too (optional)
                beam.setAttribute("opacity", 1 - t);

                if (t >= 1) {
                  clearInterval(fadeInterval);
                  clearInterval(beamInterval);
                  svg.removeChild(beam);
                  engine.timing.timeScale = 1;
                }
              }, 16);
          }, chargeDuration + 1000); // after charge + beam duration
        }, chargeDuration);
      }

    },
    shinraTensei: {
      name: 'Shinra Tensei',
      disabled: false,
      effect: (participant) => {
        const engine = engineRef.current;
        engine.timing.timeScale = 0;
        showText(participant, "🙏🏻 SHINRA TENSEI", "#ffee00ff");

        setTimeout(() => {
          radialKnockback(participant);
        }, 500);
      }
    },
    omaewamou: {
      name: 'Omae wa mou shindeiru',
      disabled: false,
      effect: (participant) => {
        const engine = engineRef.current;
        engine.timing.timeScale = 0.01;

        showText(participant, "🫵 OMAE WA MOU SHINDEIRU");
        const randomEnemy = findStrongestEnemy(participant);
        showText(randomEnemy, "NANI");
        setTimeout(()=> {
          engine.timing.timeScale = 1;
          dealDamage(randomEnemy, 9999, participant, false);
        }, 3000);
      }
    },
    lightning: {
      name: 'Lightning',
      disabled: false,
      effect: (participant) => {
        // Find nearest enemy and deal AOE damage
        const farEnemy = findNearestEnemy(participant);
        const chain = findNearestEnemy(farEnemy, participant);
        if (farEnemy) {
          const engine = engineRef.current;
          engine.timing.timeScale = 0;
          
          const lightningStrikes = 8; // number of farEnemy strikes
          const interval = 100;
          const offset = 50;
          let totalTimeTook = 0;          
          showText(participant, "⚡ LIGHTNING STRIKE!", "#0025cc");

          setTimeout(() => {
            for (let i = 0; i < lightningStrikes; i++) {
              const baseTime = i * interval;

              // main strike on farEnemy
              setTimeout(() => {
                drawJaggedLightning(participant, farEnemy);
                const damage = battleSettings.battleEventDamage * 0.25;
                dealDamage(farEnemy, damage, participant, false);
              }, baseTime + offset);
              // can chain to another
              if (chain) {
                setTimeout(() => {
                  drawJaggedLightning(farEnemy, chain);
                  const damage = battleSettings.battleEventDamage * 0.10;
                  dealDamage(chain, damage, participant, false);
                }, baseTime + 100 + offset);
              }
              totalTimeTook = baseTime + 100 + offset;
            }

            setTimeout(() => { engine.timing.timeScale = 1}, totalTimeTook + offset)
          }, 150);
        }
      }
    }
  }, []);

  const teleport = (caster, targetX, targetY) => {
    const offset = 100;
    Matter.Body.setPosition(caster.body, {
      x: targetX - offset,
      y: targetY
    });
  }

  const findPopulatedPoint = (participant) => {
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive && p.id !== participant.id);
    if (aliveParticipants.length === 0) {
      // fallback: just return participant’s current position
      return { x: participant.body.position.x, y: participant.body.position.y };
    }

    const middleX = aliveParticipants.reduce((sum, p) => sum + p.body.position.x, 0) / aliveParticipants.length;
    const middleY = aliveParticipants.reduce((sum, p) => sum + p.body.position.y, 0) / aliveParticipants.length;

    return { x: middleX, y: middleY };
  };


  const findNearestEnemy = (participant, ...exceptions) => {
    const exceptionIds = exceptions.map(e => e.id);
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive && p.id !== participant.id && !exceptionIds.includes(p.id));
    if (aliveParticipants.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    aliveParticipants.forEach(enemy => {
      const dx = enemy.body.position.x - participant.body.position.x;
      const dy = enemy.body.position.y - participant.body.position.y;
      const distance = Math.sqrt(dx*dx+dy*dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    });

    return nearest;
  }

  const findFarthestEnemy = (participant, ...exceptions) => {
    const exceptionIds = exceptions.map(e => e.id);
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive && p.id !== participant.id && !exceptionIds.includes(p.id));
    if (aliveParticipants.length === 0) return null;

    let farthest = null;
    let maxDistance = 0;

    aliveParticipants.forEach(enemy => {
      const dx = enemy.body.position.x - participant.body.position.x;
      const dy = enemy.body.position.y - participant.body.position.y;
      const distance = Math.sqrt(dx*dx+dy*dy);

      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = enemy;
      }
    });

    return farthest;
  }

  const findStrongestEnemy = (participant) => {
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive && p.id != participant.id); 
    let randomEnemy = null;
    console.log(`found ${aliveParticipants.length} people`);
    if (aliveParticipants.length > 0) {
      const maxHP = Math.max(...aliveParticipants.map(p => p.hp));
      const strongest = aliveParticipants.filter(p => p.hp === maxHP);
      randomEnemy = strongest[Math.floor(Math.random() * strongest.length)];
      console.log(`selected ${randomEnemy.subscriberName}`);
    }
    return randomEnemy;
  }

  const radialKnockback = (caster, radius = Infinity, forceMagnitude = 0.5) => {
    const casterPos = caster.body.position;
    const engine = engineRef.current;

    const allParticipants = battleParticipants.current.filter(p => p.isAlive && p.id != caster.id);

    engine.timing.timeScale = 1;
    allParticipants.forEach(target => {

      const targetPos = target.body.position;
      const dx = targetPos.x - casterPos.x;
      const dy = targetPos.y - casterPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius && dist > 0.01) {
        // normalize direction vector
        const nx = dx / dist;
        const ny = dy / dist;

        // apply force scaled by distance (closer → stronger)
        const strength = forceMagnitude * (1 - dist / radius);

        setTimeout(() => {
          dealDamage(target, battleSettings.battleEventDamage * 2.5, caster, false);
        }, 1000);

        Matter.Body.applyForce(target.body, target.body.position, {
          x: nx * strength,
          y: ny * strength,
        });
      }
    });
  }

  const drawJaggedLightning = (attacker, target) => {
    const svg = document.getElementById('effects-layer');

    // Get attacker & target centers
    const attackerRect = attacker.el.getBoundingClientRect();
    const targetRect = target.el.getBoundingClientRect();

    const x1 = attackerRect.left + attackerRect.width / 2;
    const y1 = attackerRect.top + attackerRect.height / 2;
    const x2 = targetRect.left + targetRect.width / 2;
    const y2 = targetRect.top + targetRect.height / 2;

    // Create jagged path
    const segments = 9; // more segments = more jagged
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20; // horizontal wiggle
      const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20; // vertical wiggle
      points.push(`${x},${y}`);
    }

    // Create polyline
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", points.join(" "));
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "blue");
    polyline.setAttribute("stroke-width", "2");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("filter", "url(#glow)");

    // Add glow filter if missing
    if (!document.getElementById("glow")) {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      defs.innerHTML = `
        <filter id="glow">
          <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="cyan"/>
        </filter>
      `;
      svg.appendChild(defs);
    }

    svg.appendChild(polyline);

    // Animate flicker + fade
    polyline.animate(
      [
        { opacity: 1, strokeWidth: 3 },
        { opacity: 0.6, strokeWidth: 5 },
        { opacity: 0 }
      ],
      { duration: 250, easing: "ease-out" }
    ).onfinish = () => polyline.remove();
  }


  const createHealthBar = useCallback((participant) => {
    const healthBar = document.createElement('div');
    healthBar.style.position = 'fixed';
    healthBar.style.width = '60px';
    healthBar.style.height = '8px';
    healthBar.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    healthBar.style.border = '1px solid #000';
    healthBar.style.borderTopLeftRadius = '4px';
    healthBar.style.borderTopRightRadius = '4px';
    healthBar.style.zIndex = '10000';
    healthBar.style.pointerEvents = 'none';
    
    const healthFill = document.createElement('div');
    healthFill.style.width = '100%';
    healthFill.style.height = '100%';
    healthFill.style.backgroundColor = '#00ff00';
    healthFill.style.borderRadius = '3px';
    healthFill.style.transition = 'width 0.3s ease, background-color 0.3s ease';
    
    healthBar.appendChild(healthFill);
    document.body.appendChild(healthBar);
    
    return { healthBar, healthFill };
  }, []);

  const createManaBar = useCallback((participant) => {
    const manaBar = document.createElement('div');
    manaBar.style.position = 'fixed';
    manaBar.style.width = '60px';
    manaBar.style.height = '6px';
    manaBar.style.backgroundColor = 'rgba(0, 0, 255, 0.8)';
    manaBar.style.border = '1px solid #000';
    manaBar.style.borderBottomLeftRadius = '4px';
    manaBar.style.borderBottomRightRadius = '4px';
    manaBar.style.zIndex = '10000';
    manaBar.style.pointerEvents = 'none';
    
    const manaFill = document.createElement('div');
    manaFill.style.width = '0%';
    manaFill.style.height = '100%';
    manaFill.style.backgroundColor = '#0099ff';
    manaFill.style.borderRadius = '2px';
    manaFill.style.transition = 'width 0.3s ease';
    
    manaBar.appendChild(manaFill);
    document.body.appendChild(manaBar);
    
    return { manaBar, manaFill };
  }, []);

  const updateHealthBar = useCallback((participant) => {
    const { body, healthBar, healthFill, manaBar, manaFill, nameLabel, hp, maxHp, mana, maxMana } = participant;
    
    if (!healthBar || !healthFill) return;
    
    const healthPercent = Math.max(0, hp / maxHp);
    const manaPercent = Math.max(0, mana / maxMana);
    const x = body.position.x - 30; // Center above emote
    const y = body.position.y - 60; // Above emote
    
    healthBar.style.transform = `translate(${x}px, ${y}px)`;
    healthFill.style.width = `${healthPercent * 100}%`;

    if (manaBar && manaFill) {
      manaBar.style.transform = `translate(${x}px, ${y + 6}px)`;
      manaFill.style.width = `${manaPercent * 100}%`;

      if (manaPercent >= 1) {
        manaBar.style.boxShadow = '0 0 10px #0099ff';
        manaFill.style.backgroundColor = '#0099ff';
      } else {
        manaBar.style.boxShadow = 'none';
        manaFill.style.backgroundColor = '#0099ff';
      }
    }
    
    // Update name label position
    if (nameLabel) {
      const nameX = body.position.x - 40; // Center name under emote
      const nameY = body.position.y - 50; // Below emote
      nameLabel.style.transform = `translate(${nameX}px, ${nameY}px)`;
    }
    
    // Color transitions: green -> yellow -> red
    if (healthPercent > 0.6) {
      healthFill.style.backgroundColor = '#00ff00';
    } else if (healthPercent > 0.3) {
      healthFill.style.backgroundColor = '#ffff00';
    } else {
      healthFill.style.backgroundColor = '#ff0000';
    }
  }, []);

  const createBattleParticipant = useCallback((subscriber, position, id, emoteName) => {
    const engine = engineRef.current;
    if (!engine) return null;

    const emote = emoteMap.get(emoteName);
    if (!emote) {
      console.warn(`No suitable emote found for ${subscriber.name}, skipping`);
      return null;
    }

    const sizeX = emote.width * 0.8;
    const sizeY = emote.height * 0.8;

    const body = Matter.Bodies.rectangle(position.x, position.y, sizeX, sizeY, {
      render: { visible: false, isStatic: false },
      restitution: 1,
      friction: 0.03,
      frictionAir: 0.01,
      isBattleParticipant: true,
      participantId: id
    });

    Matter.World.add(engine.world, body);

    const elImg = createEmoteElement(emote.url, sizeX, sizeY);
    elImg.style.width = '100%';
    elImg.style.height = '100%';
    elImg.style.borderRadius = '50%';
    elImg.classList.add('avatar');

    const wrapper = document.createElement('div');
    wrapper.classList.add('participant');
    wrapper.style.width = `${sizeX}px`;
    wrapper.style.height = `${sizeY}px`;
    wrapper.style.boxShadow = `0 0 20px ${subscriber.color}`;
    wrapper.style.border = `2px solid ${subscriber.color}`;
    wrapper.style.borderRadius = '50%';
    wrapper.appendChild(elImg);

    // IMPORTANT: use the wrapper as the moved element
    const el = wrapper;

    document.body.appendChild(el);
    const { healthBar, healthFill } = createHealthBar();
    const { manaBar, manaFill } = createManaBar();

    const nameLabel = document.createElement('div');
    nameLabel.textContent = subscriber.name;
    nameLabel.style.position = 'fixed';
    nameLabel.style.fontSize = '14px';
    nameLabel.style.fontWeight = 'bold';
    nameLabel.style.color = subscriber.color;
    nameLabel.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    nameLabel.style.textAlign = 'center';
    nameLabel.style.zIndex = '10000';
    nameLabel.style.pointerEvents = 'none';
    nameLabel.style.whiteSpace = 'nowrap';
    document.body.appendChild(nameLabel);

    return {
      id,
      body,
      el,
      parent,
      healthBar,
      healthFill,
      manaBar,
      manaFill,
      nameLabel,
      hp: battleSettings.battleEventHp,
      maxHp: battleSettings.battleEventHp,
      mana: 0,
      maxMana: 100,
      sizeX,
      sizeY,
      emoteName,
      subscriberName: subscriber.name,
      userColor: subscriber.color,
      subscriber,
      isAlive: true,
      lastDamageTime: 0,
      invulnerabilityDuration: 500,
      hasShield: false,
      born: Date.now(),
      animated: emote.animated || false,
      isSub: true,
      particleColor: subscriber.color,
      effects: [],
      cleanupEffects: [],
      isBattleParticipant: true
    };
  }, [engineRef, emoteMap, battleSettings.battleEventHp, createHealthBar, createManaBar]);

  const dealDamage = useCallback((target,damage,attacker, canGainMana = true) => {
    if (!target.isAlive) return;

    //shield check
    if(target.hasShield) {
      damage *= 0.5;
      showDamageFlyup(target.body.position.x, target.body.position.y - 40, damage, '#00aaff');
    } else {
      showDamageFlyup(target.body.position.x, target.body.position.y - 40, damage, target.userColor);
    }
    
    target.hp -= damage;
    target.lastDamageTime = Date.now();
    if (target.hp <= 0) {
      kill(target);
    }

    if (attacker && canGainMana) {
      const manaGain = 10 + (damage * 0.2);
      attacker.mana = Math.min(attacker.maxMana, attacker.mana + manaGain);
      showManaGain(attacker, manaGain);
    }

    target.el.querySelector('.avatar').style.filter = 'brightness(2) hue-rotate(180deg)';
    setTimeout(() => {
      if (target.el.querySelector('.avatar')) target.el.querySelector('.avatar').style.filter = '';
    }, 200);
  }, []);

  const showManaGain = (participant, manaGain) => {
    const manaEl = document.createElement('div');
    manaEl.textContent = `+${Math.floor(manaGain)} MP`;
    manaEl.style.position = 'fixed';
    manaEl.style.left = `${participant.body.position.x + 20}px`;
    manaEl.style.top = `${participant.body.position.y - 20}px`;
    manaEl.style.color = '#00aaff';
    manaEl.style.fontWeight = 'bold';
    manaEl.style.fontSize = '12px';
    manaEl.style.pointerEvents = 'none';
    manaEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
    manaEl.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease-out';
    document.body.appendChild(manaEl);

    requestAnimationFrame(() => {
      manaEl.style.transform = 'translateY(-25px)';
      manaEl.style.opacity = '0';
    });

    setTimeout(() => manaEl.remove(), 800);
  };
  
  const showText = (x, text, color = "#ff0000") => {

    if (!x?.body) {
        console.warn("Cannot show text, no body:", text, x);
        return;
    }   
    
    console.log(`showing ${text}`)
    const textEl = document.createElement('div');
    textEl.id = 'text-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    textEl.textContent = text;
    textEl.style.position = 'fixed';

    // Clamp to screen so it is always visible
    const left = Math.max(0, Math.min(window.innerWidth - 50, x.body.position.x - 20));
    const top = Math.max(0, Math.min(window.innerHeight - 30, x.body.position.y - 50));
    textEl.style.left = `${left}px`;
    textEl.style.top = `${top}px`;

 
    textEl.style.color = color;
    textEl.style.fontWeight = 'bold';
    textEl.style.fontSize = '16px';
    textEl.style.pointerEvents = 'none';
    textEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
    textEl.style.transition = 'transform 2s ease-out, opacity 2s ease-out';
    textEl.style.transitionDelay= '1s, 1s';
    textEl.style.zIndex = "9999999";
    document.body.appendChild(textEl);

    requestAnimationFrame(() => {
      textEl.style.transform = 'translateY(-40px) scale(1.5)';
      textEl.style.opacity = '0';
    });

    setTimeout(() => textEl.remove(), 3000);
  };

  const procSpecialSkill = useCallback((participant) => {
    // Trigger skill effect
    if (participant.mana < participant.maxMana) return;
     
    const skills = Object.keys(specialSkills).filter(
      key => !specialSkills[key].disabled
    );
    const randomSkill = skills[Math.floor(Math.random() * skills.length)];
    const skill = specialSkills[randomSkill];
    
    //apply the skill
    skill.effect(participant);
    participant.mana = 0;
    
    // Add skill effect to participant
    if(skill.duration) {
      participant.effects.push({
            name: skill.name,  
            duration: skill.duration || 0,
            startTime: Date.now()
          });
    }
     
  }, [specialSkills]);

  const updateSpecialEffects = (participant) => {
    // Check for active effects
    if (participant.effects && participant.effects.length > 0) {
      participant.effects = participant.effects.filter(effect => {
        const elapsed = Date.now() - effect.startTime;
        if (elapsed < effect.duration) {
          return true;
        }
        // Remove expired effect and reset shield state
        if (effect.name === 'Shield') {
          participant.hasShield = false;
          participant.el.classList.remove('has-shield');
          console.log(`Shield effect removed from ${participant.id}`);
        }
        return false;
      });
    }
  };

  const spawnBattleArena = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !subscriberTracker) return [];

    // Get all available subscribers
    const availableSubscribers = subscriberTracker.getSubscriberCount();

    if (availableSubscribers < 3) {
      console.log("Not enough subscribers to start a battle (minimum 3 required)");
      return [];
    }

    // Determine random number of participants: min 3, max battleEventParticipants or total subscribers
    const maxParticipants = Math.min(battleSettings.battleEventParticipants, availableSubscribers);

    // Randomly select subscribers for the battle
    const selectedSubscribers = subscriberTracker.getRandomSubscribers(maxParticipants);

    if (selectedSubscribers.length === 0) {
      console.log("No subscribers available for battle");
      return [];
    }    
    console.log(`Starting battle event with ${selectedSubscribers.length} subscribers!`);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Only square emotes
    const availableEmotes = Array.from(emoteMap.keys()).filter(key => {
      const emote = emoteMap.get(key);
      return emote?.width === emote?.height;
    });

    if (availableEmotes.length === 0) {
      console.warn("No emotes loaded yet, skipping battle");
      return [];
    }

    // Shuffle emotes
    const shuffledEmotes = availableEmotes.sort(() => Math.random() - 0.5);
    const usedEmotes = new Set();
    const participants = [];

    const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/gi, '');

    selectedSubscribers.forEach((subscriber, i) => {
      const angle = (i / selectedSubscribers.length) * Math.PI * 2;
      const spawnX = centerX + Math.cos(angle) * radius;
      const spawnY = centerY + Math.sin(angle) * radius;

      const subNameNorm = normalize(subscriber.name);

      let emoteName = availableEmotes.find(e => {
        const eNorm = normalize(e);
        return subNameNorm.length >= 3 && eNorm.includes(subNameNorm);
      });

      if (!emoteName || usedEmotes.has(emoteName)) {
        emoteName = shuffledEmotes.find(e => !usedEmotes.has(e));
      }

      if (!emoteName) {
        emoteName = shuffledEmotes[i % shuffledEmotes.length];
      }

      usedEmotes.add(emoteName);

      const participant = createBattleParticipant(
        subscriber,
        { x: spawnX, y: spawnY },
        `battle_${subscriber.username}_${i}`,
        emoteName
      );

      if (participant) {
        const velocityStrength = 2;
        const velX = (centerX - spawnX) * (velocityStrength / radius);
        const velY = (centerY - spawnY) * (velocityStrength / radius);
        Matter.Body.setVelocity(participant.body, { x: velX, y: velY });
        participants.push(participant);
      }
    });

    return participants;
  }, [engineRef, battleSettings.battleEventParticipants, createBattleParticipant, subscriberTracker, emoteMap]);


  function showDamageFlyup(x, y, damage, color = '#ff0000') {
    const dmgEl = document.createElement('div');
    dmgEl.textContent = Math.floor(damage); // show integer damage
    dmgEl.style.position = 'fixed';
    dmgEl.style.left = `${x}px`;
    dmgEl.style.top = `${y}px`;
    dmgEl.style.color = color;
    dmgEl.style.fontWeight = 'bold';
    dmgEl.style.fontSize = '24px';
    dmgEl.style.pointerEvents = 'none';
    dmgEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
    dmgEl.style.transition = 'transform 1.2s ease-out, opacity 1.2s ease-out';
    document.body.appendChild(dmgEl);

    // Trigger fly-up animation
    requestAnimationFrame(() => {
      dmgEl.style.transform = 'translateY(-30px)';
      dmgEl.style.opacity = '0';
    });

    // Remove from DOM after animation
    setTimeout(() => {
      dmgEl.remove();
    }, 1200);
  }


  const handleCollisions = useCallback(() => {
    const engine = engineRef.current;
    if (!activeBattleRef.current || battleParticipants.current.length === 0) return;

    const now = Date.now();
    const participants = battleParticipants.current.filter(p => p.isAlive);

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const p1 = participants[i];
        const p2 = participants[j];
        
        const dx = p1.body.position.x - p2.body.position.x;
        const dy = p1.body.position.y - p2.body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (p1.sizeX + p2.sizeX) / 2 + 10;

        // Collision detection
        if (distance < minDistance) {
          const canDamageP1 = now - p1.lastDamageTime > p1.invulnerabilityDuration;
          const canDamageP2 = now - p2.lastDamageTime > p2.invulnerabilityDuration;

          // Apply damage
          if (canDamageP1) {
            const damage = battleSettings.battleEventDamage * (0.8 + Math.random() * 0.4);
            dealDamage(p1, damage, p2);
          }

          if (canDamageP2) {
            const damage = battleSettings.battleEventDamage * (0.8 + Math.random() * 0.4);
            dealDamage(p2, damage, p1);
          }

          // Repulsion force
          const repulsionStrength = 0.08;
          const repulsionX = (dx / distance) * repulsionStrength;
          const repulsionY = (dy / distance) * repulsionStrength;

          Matter.Body.applyForce(p1.body, p1.body.position, { x: repulsionX, y: repulsionY });
          Matter.Body.applyForce(p2.body, p2.body.position, { x: -repulsionX, y: -repulsionY });

          // Check for deaths
          updateSpecialEffects(p1);
          updateSpecialEffects(p2);
        }
      }
    }
  }, [battleSettings.battleEventDamage, engineRef, dealDamage]);

  const applyAttraction = useCallback(() => {
    if (!activeBattleRef.current) return;

    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive);
    let attractionStrength = 0.0008;

    if (aliveParticipants.length == 2) {
      attractionStrength = 0.01;
    }

    for (let i = 0; i < aliveParticipants.length; i++) {
      for (let j = i + 1; j < aliveParticipants.length; j++) {
        const p1 = aliveParticipants[i];
        const p2 = aliveParticipants[j];
        
        const dx = p2.body.position.x - p1.body.position.x;
        const dy = p2.body.position.y - p1.body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const forceX = (dx / distance) * attractionStrength;
          const forceY = (dy / distance) * attractionStrength;
          
          Matter.Body.applyForce(p1.body, p1.body.position, { x: forceX, y: forceY });
          Matter.Body.applyForce(p2.body, p2.body.position, { x: -forceX, y: -forceY });
        }
      }
    }
  }, []);

  const displayWinner = useCallback((winner) => {
    if (!winner) return;

    const winnerDisplay = document.createElement('div');
    winnerDisplay.innerHTML = `🏆 ${winner.subscriberName} WINS! 🏆`;
    winnerDisplay.style.position = 'fixed';
    winnerDisplay.style.top = '50%';
    winnerDisplay.style.left = '50%';
    winnerDisplay.style.transform = 'translate(-50%, -50%)';
    winnerDisplay.style.fontSize = '48px';
    winnerDisplay.style.fontWeight = 'bold';
    winnerDisplay.style.color = winner.userColor;
    winnerDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    winnerDisplay.style.zIndex = '10001';
    winnerDisplay.style.pointerEvents = 'none';
    winnerDisplay.style.textAlign = 'center';
    winnerDisplay.style.animation = 'bounce 1s ease-in-out infinite';
    
    // Add bounce animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(winnerDisplay);

    setTimeout(() => {
      winnerDisplay.remove();
      style.remove();
    }, 5000);
  }, []);

  const displayDraw = useCallback((draw) => {
    if (!draw) return;

    const winnerDisplay = document.createElement('div');
    winnerDisplay.innerHTML = `🏆 DRAW 🏆`;
    winnerDisplay.style.position = 'fixed';
    winnerDisplay.style.top = '50%';
    winnerDisplay.style.left = '50%';
    winnerDisplay.style.transform = 'translate(-50%, -50%)';
    winnerDisplay.style.fontSize = '48px';
    winnerDisplay.style.fontWeight = 'bold';
    winnerDisplay.style.color = "#ff0000";
    winnerDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    winnerDisplay.style.zIndex = '10001';
    winnerDisplay.style.pointerEvents = 'none';
    winnerDisplay.style.textAlign = 'center';
    winnerDisplay.style.animation = 'bounce 1s ease-in-out infinite';
    
    // Add bounce animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(winnerDisplay);

    setTimeout(() => {
      winnerDisplay.remove();
      style.remove();
    }, 5000);
  }, []);

  const endBattle = useCallback(() => {
    const engine = engineRef.current;
    if (!activeBattleRef.current || !engine) return;

    // Find winner from remaining alive participants
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive);
    let winner;
    let draw = false;
    
    if (aliveParticipants.length === 1) {
      winner = aliveParticipants[0];
    } else if (aliveParticipants.length > 1) {
      // Find participant with highest HP
      winner = aliveParticipants.reduce((prev, current) => 
        current.hp > prev.hp ? current : prev
      );
    } else {
      draw = true;
    }    

    if (winner) {
      displayWinner(winner);
    } else if (draw) {
      displayDraw(draw);
    }

    // 🔹 Stop physics: remove update listener
    if (battleUpdateListener.current) {
      Matter.Events.off(engine, "beforeUpdate", battleUpdateListener.current);
      battleUpdateListener.current = null;
    }

    // 🔹 Freeze remaining participants
    aliveParticipants.forEach(p => {
      Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(p.body, 0);
      Matter.Body.setStatic(p.body, true); // optional: makes body completely immovable
    });

    // Clean up battle after a delay (DOM removal, etc.)
    setTimeout(() => {
      battleParticipants.current.forEach(participant => {
        const index = bodiesWithTimers.current.findIndex(body => body.id === participant.id);
        if (index !== -1) bodiesWithTimers.current.splice(index, 1);

        if (participant.body && engine) {
          try { kill(participant) } catch(e) {
            console.error('Error removing body from world:', e);
          }
        }
      });

      battleParticipants.current = [];
      activeBattleRef.current = null;
      console.log("Battle ended and all participants cleaned up");
    }, 3000);
  }, [engineRef, displayWinner, bodiesWithTimers, displayDraw]);


  const updateBattle = useCallback(() => {
    if (!activeBattleRef.current) return;

    const scene = sceneRef.current;

    // Update health bars for all participants (including dead ones that haven't been removed yet)
    battleParticipants.current.forEach(participant => {
      if (participant.isAlive) {
        updateHealthBar(participant);
      }

      if(participant.isAlive && participant.mana === participant.maxMana) {
        procSpecialSkill(participant);
      }
      const { width, height } = scene.getBoundingClientRect();
      if (
          participant.body.position.x < 0 ||
          participant.body.position.x > width ||
          participant.body.position.y < 0 ||
          participant.body.position.y > height
        ) {
         kill(participant);          
        }
    });
    
    // Apply attraction between alive participants only
    applyAttraction();
    
    // Handle collisions and damage
    handleCollisions();
    
    // Check win conditions - only count truly alive participants
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive);
    const battleDuration = Date.now() - activeBattleRef.current.startTime;
        
    if (aliveParticipants.length <= 1 || battleDuration >= battleSettings.battleEventDuration * 1000) {
      endBattle();
    }
  }, [updateHealthBar, applyAttraction, procSpecialSkill, handleCollisions, battleSettings.battleEventDuration, endBattle, engineRef, sceneRef, bodiesWithTimers]);

  const startBattle = useCallback(() => {
    const engine = engineRef.current;
    if (activeBattleRef.current || !engine) {
      console.log("Battle already active or no engine");
      return;
    }
    
    // Check if we have at least 3 subscribers
    if (!subscriberTracker || subscriberTracker.getSubscriberCount() < 3) {
      console.log("Not enough subscribers for battle (minimum 3 required)");
      return;
    }

    const participants = spawnBattleArena();
    if (participants.length === 0) return;
    
    // Add battle participants to the main bodiesWithTimers array so they get rendered
    participants.forEach(participant => {
      bodiesWithTimers.current.push(participant);
    });
    
    battleParticipants.current = participants;
    activeBattleRef.current = {
      startTime: Date.now(),
      participants
    };

    // Set up battle update loop
    battleUpdateListener.current = updateBattle;
    Matter.Events.on(engine, "beforeUpdate", battleUpdateListener.current);

    // Battle announcement with participant names
    const participantNames = participants.map(p => p.subscriberName).join(' vs ');
    const announcement = document.createElement('div');
    announcement.innerHTML = `⚔️ BATTLE ROYALE: ${participantNames}! ⚔️`;
    announcement.style.position = 'fixed';
    announcement.style.top = '20px';
    announcement.style.left = '50%';
    announcement.style.transform = 'translateX(-50%)';
    announcement.style.fontSize = '24px';
    announcement.style.fontWeight = 'bold';
    announcement.style.color = '#ff6600';
    announcement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    announcement.style.zIndex = '10001';
    announcement.style.pointerEvents = 'none';
    announcement.style.textAlign = 'center';
    announcement.style.maxWidth = '80%';
    document.body.appendChild(announcement);

    setTimeout(() => announcement.remove(), 4000);
  }, [engineRef, spawnBattleArena, updateBattle, bodiesWithTimers, subscriberTracker]);
  
  function kill(participant) {
    if (!participant.isAlive) return;

    const engine = engineRef.current;

    if (participant.body && engine) {
      Matter.World.remove(engine.world, participant.body);
    }

    if (participant.el) {
      participant.isAlive = false;
      // Death effect - fade out and remove
      participant.el.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
      participant.el.style.opacity = '0';
      participant.el.style.transform += ' scale(0.5)';
      participant.healthBar.style.opacity = '0';
      participant.manaBar.style.opacity = '0';
      if (participant.nameLabel) participant.nameLabel.style.opacity = '0';
      
      // Remove from physics world immediately
      Matter.World.remove(engine.world, participant.body);
      
      // Schedule removal from DOM and arrays
      setTimeout(() => {
        if (participant.el) participant.el.remove();
        if (participant.healthBar) participant.healthBar.remove();
        if (participant.manaBar) participant.manaBar.remove();
        if (participant.nameLabel) participant.nameLabel.remove();
        
        // Remove from battle participants
        const battleIndex = battleParticipants.current.findIndex(bp => bp.id === participant.id);
        if (battleIndex !== -1) {
          battleParticipants.current.splice(battleIndex, 1);
        }
        
        // Remove from main bodies array
        const mainIndex = bodiesWithTimers.current.findIndex(bt => bt.id === participant.id);
        if (mainIndex !== -1) {
          bodiesWithTimers.current.splice(mainIndex, 1);
        }
      }, 1500);
    }
  }
  

  return {
    startBattle,
    endBattle,
    isActive: !!activeBattleRef.current,
    participants: battleParticipants.current
  };
}