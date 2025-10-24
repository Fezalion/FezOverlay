/* eslint-disable react-hooks/exhaustive-deps */
import { useRef, useCallback, useMemo, useEffect } from "react";
import Matter from "matter-js";
import { createEmoteElement } from "../utils/emoteEffects";
import { createSkills } from "../skills";
import { useBattleDPSTracker } from "./useDPSTracker";

export function useBattleSystem(
  engineRef,
  emoteMap,
  bodiesWithTimers,
  battleSettings,
  subscriberTracker,
  viewerTracker,
  sceneRef,
  client
) {
  const dpsTracker = useBattleDPSTracker(battleSettings);
  const activeBattleRef = useRef(null);
  const battleParticipants = useRef([]);
  const battleUpdateListener = useRef(null);
  const isInitialized = useRef(false);
  // Keep previous engine timescale so we can restore it if something mutates it
  const previousTimeScaleRef = useRef(null);
  // Watchdog interval id for detecting stuck/invalid timescale
  const timescaleWatchdogRef = useRef(null);

  // Increment leaderboard win for a username (fire-and-forget)
  const incrementLeaderboardWin = async (username) => {
    try {
      if (!username) return null;

      const resp = await fetch("/api/leaderboard/win", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      // Expect { success: true, username, wins, top }
      return json;
    } catch (e) {
      console.warn("Error posting leaderboard win:", e);
      return null;
    }
  };

  // Helper to set engine timescale and capture previous value if not already captured
  const setEngineTimeScale = (value) => {
    try {
      const engine = engineRef.current;
      if (engine && engine.timing) {
        // Capture previous timescale only if we haven't already
        if (
          previousTimeScaleRef.current === undefined ||
          previousTimeScaleRef.current === null
        ) {
          previousTimeScaleRef.current = engine.timing.timeScale ?? 1;
        }
        engine.timing.timeScale = value;
      }
    } catch (e) {
      console.warn("Unable to set engine timescale:", e);
    }
  };

  // Helper to restore the engine timescale (optionally provide a forced value)
  const restoreEngineTimeScale = (forcedValue) => {
    try {
      const engine = engineRef.current;
      if (engine && engine.timing) {
        const restoreTo =
          typeof forcedValue === "number"
            ? forcedValue
            : previousTimeScaleRef.current ?? 1;
        engine.timing.timeScale = restoreTo;
      }
    } catch (e) {
      console.warn("Unable to restore engine timescale:", e);
    }
  };

  // Comprehensive cleanup on unmount or critical changes
  useEffect(() => {
    return () => {
      const engine = engineRef.current;

      // Force end any active battle
      if (activeBattleRef.current) {
        console.log("Force ending battle due to cleanup");

        // Remove event listener
        if (battleUpdateListener.current && engine) {
          Matter.Events.off(
            engine,
            "beforeUpdate",
            battleUpdateListener.current
          );
        }

        // Clean up all participants immediately
        battleParticipants.current.forEach((participant) => {
          if (participant.el) participant.el.remove();
          if (participant.healthBar) participant.healthBar.remove();
          if (participant.manaBar) participant.manaBar.remove();
          if (participant.nameLabel) participant.nameLabel.remove();

          if (participant.body && engine) {
            try {
              Matter.World.remove(engine.world, participant.body);
            } catch (e) {
              console.error("Error removing body during cleanup:", e);
            }
          }

          // Remove from main bodies array
          const mainIndex = bodiesWithTimers.current.findIndex(
            (bt) => bt.id === participant.id
          );
          if (mainIndex !== -1) {
            bodiesWithTimers.current.splice(mainIndex, 1);
          }
        });

        // Clean up UI elements
        const liveDisplay = document.getElementById("live-dps-display");
        if (liveDisplay) liveDisplay.remove();

        // Reset refs
        activeBattleRef.current = null;
        battleParticipants.current = [];
        battleUpdateListener.current = null;
      }

      // Restore engine timescale if it was changed during battle
      try {
        if (engine && engine.timing) {
          engine.timing.timeScale = previousTimeScaleRef.current ?? 1;
        }
      } catch (e) {
        console.warn("Unable to restore engine timescale on cleanup:", e);
      }

      // Clear watchdog if running
      try {
        if (timescaleWatchdogRef.current) {
          clearInterval(timescaleWatchdogRef.current);
          timescaleWatchdogRef.current = null;
        }
      } catch (e) {
        console.warn("Unable to clear timescale watchdog:", e);
      }

      isInitialized.current = false;
    };
  }, []);

  // Increment leaderboard win for a username (fire-and-forget)

  // Initialize the system once
  useEffect(() => {
    if (engineRef.current && !isInitialized.current) {
      isInitialized.current = true;
      console.log("Battle system initialized");
    }
  }, [engineRef]);

  const teleport = (caster, targetX, targetY) => {
    const offset = 100;
    Matter.Body.setPosition(caster.body, {
      x: targetX - offset,
      y: targetY,
    });
  };

  const findPopulatedPoint = (participant) => {
    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive && p.id !== participant.id
    );
    if (aliveParticipants.length === 0) {
      // fallback: just return participant's current position
      return { x: participant.body.position.x, y: participant.body.position.y };
    }

    const middleX =
      aliveParticipants.reduce((sum, p) => sum + p.body.position.x, 0) /
      aliveParticipants.length;
    const middleY =
      aliveParticipants.reduce((sum, p) => sum + p.body.position.y, 0) /
      aliveParticipants.length;

    return { x: middleX, y: middleY };
  };

  const findNearestEnemy = (participant, ...exceptions) => {
    try {
      const exceptionIds = exceptions.map((e) => e.id);
      const aliveParticipants = battleParticipants.current.filter(
        (p) =>
          p.isAlive && p.id !== participant.id && !exceptionIds.includes(p.id)
      );
      if (aliveParticipants.length === 0) return null;

      let nearest = null;
      let minDistance = Infinity;

      aliveParticipants.forEach((enemy) => {
        const dx = enemy.body.position.x - participant.body.position.x;
        const dy = enemy.body.position.y - participant.body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          nearest = enemy;
        }
      });

      return nearest;
    } catch (e) {
      console.error("error at findNearestEnemy", e);
    }
  };

  const findFarthestEnemy = (participant, ...exceptions) => {
    const exceptionIds = exceptions.map((e) => e.id);
    const aliveParticipants = battleParticipants.current.filter(
      (p) =>
        p.isAlive && p.id !== participant.id && !exceptionIds.includes(p.id)
    );
    if (aliveParticipants.length === 0) return null;

    let farthest = null;
    let maxDistance = 0;

    aliveParticipants.forEach((enemy) => {
      const dx = enemy.body.position.x - participant.body.position.x;
      const dy = enemy.body.position.y - participant.body.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = enemy;
      }
    });

    return farthest;
  };

  const findStrongestEnemy = (participant) => {
    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive && p.id != participant.id
    );
    let randomEnemy = null;
    if (aliveParticipants.length > 0) {
      const maxHP = Math.max(...aliveParticipants.map((p) => p.hp));
      const strongest = aliveParticipants.filter((p) => p.hp === maxHP);
      randomEnemy = strongest[Math.floor(Math.random() * strongest.length)];
    }
    return randomEnemy;
  };

  const radialKnockback = (caster, radius = Infinity, forceMagnitude = 0.5) => {
    const casterPos = caster.body.position;

    const allParticipants = battleParticipants.current.filter(
      (p) => p.isAlive && p.id != caster.id
    );

    // Ensure normal timescale during this forced knockback
    setEngineTimeScale(1);
    allParticipants.forEach((target) => {
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
          dealDamage(
            target,
            battleSettings.battleEventDamage * 2.5,
            caster,
            false
          );
        }, 1000);

        Matter.Body.applyForce(target.body, target.body.position, {
          x: nx * strength,
          y: ny * strength,
        });
      }
    });
  };

  const drawJaggedLightning = (attacker, target) => {
    const svg = document.getElementById("effects-layer");

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
    const polyline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline"
    );
    polyline.setAttribute("points", points.join(" "));
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "blue");
    polyline.setAttribute("stroke-width", "2");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("filter", "url(#glow)");

    // Add glow filter if missing
    if (!document.getElementById("glow")) {
      const defs = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs"
      );
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
        { opacity: 0 },
      ],
      { duration: 250, easing: "ease-out" }
    ).onfinish = () => polyline.remove();
  };

  const dealDamage = useCallback(
    (target, damage, attacker, canGainMana = true) => {
      if (!target.isAlive) return;

      dpsTracker.current.registerParticipant(target);
      if (attacker) {
        dpsTracker.current.registerParticipant(attacker);
        dpsTracker.current.recordDamageDealt(
          attacker.id,
          target.id,
          target.hasShield ? damage * 0.5 : damage
        );
      }

      //shield check
      if (target.hasShield) {
        damage *= 0.5;
        showDamageFlyup(
          target.body.position.x,
          target.body.position.y - 40,
          damage,
          "#00aaff"
        );
      } else {
        showDamageFlyup(
          target.body.position.x,
          target.body.position.y - 40,
          damage,
          target.userColor
        );
      }

      target.hp -= damage;
      target.lastDamageTime = Date.now();
      if (target.hp <= 0) {
        if (attacker) {
          dpsTracker.current.recordKill(attacker.id, target.id);
        }
        kill(target);
      }

      if (attacker && canGainMana) {
        const manaGain = 15 + damage * 0.1;
        attacker.mana = Math.min(attacker.maxMana, attacker.mana + manaGain);
        showManaGain(attacker, manaGain);
      }

      const avatarImg = target.el.querySelector(".avatar");
      if (avatarImg) {
        avatarImg.style.filter = "brightness(2) hue-rotate(180deg)";
      }
      setTimeout(() => {
        const avatarImg2 = target.el.querySelector(".avatar");
        if (avatarImg2) avatarImg2.style.filter = "";
      }, 200);
    },
    []
  );

  const showText = (x, text, color = "#ff0000") => {
    if (!x?.body) {
      console.warn("Cannot show text, no body:", text, x);
      return;
    }

    const textEl = document.createElement("div");
    textEl.id = "text-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    textEl.textContent = text;
    textEl.style.position = "fixed";

    // Clamp to screen so it is always visible
    const left = Math.max(
      0,
      Math.min(window.innerWidth - 50, x.body.position.x - 20)
    );
    const top = Math.max(
      0,
      Math.min(window.innerHeight - 30, x.body.position.y - 50)
    );
    textEl.style.left = `${left}px`;
    textEl.style.top = `${top}px`;
    textEl.style.color = color;
    textEl.style.fontWeight = "bold";
    textEl.style.fontSize = "16px";
    textEl.style.pointerEvents = "none";
    textEl.style.textShadow = "1px 1px 2px rgba(0,0,0,0.7)";
    textEl.style.transition = "transform 2s ease-out, opacity 2s ease-out";
    textEl.style.transitionDelay = "1s, 1s";
    textEl.style.zIndex = "9999999";
    document.body.appendChild(textEl);

    requestAnimationFrame(() => {
      textEl.style.transform = "translateY(-40px) scale(1.5)";
      textEl.style.opacity = "0";
    });

    setTimeout(() => textEl.remove(), 3000);
  };

  const specialSkills = useMemo(() => {
    const helpers = {
      engineRef,
      sceneRef,
      showText,
      findStrongestEnemy,
      findFarthestEnemy,
      findNearestEnemy,
      findPopulatedPoint,
      teleport,
      dealDamage,
      radialKnockback,
      drawJaggedLightning,
      battleSettings,
      bodiesWithTimers,
    };

    return createSkills(helpers);
  }, [
    engineRef,
    sceneRef,
    showText,
    findStrongestEnemy,
    findFarthestEnemy,
    findNearestEnemy,
    findPopulatedPoint,
    teleport,
    dealDamage,
    radialKnockback,
    drawJaggedLightning,
    battleSettings,
    bodiesWithTimers,
  ]);

  const createHealthBar = useCallback(() => {
    const healthBar = document.createElement("div");
    healthBar.style.position = "fixed";
    healthBar.style.width = "60px";
    healthBar.style.height = "8px";
    healthBar.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
    healthBar.style.border = "1px solid #000";
    healthBar.style.borderTopLeftRadius = "4px";
    healthBar.style.borderTopRightRadius = "4px";
    healthBar.style.zIndex = "10000";
    healthBar.style.pointerEvents = "none";

    const healthFill = document.createElement("div");
    healthFill.style.width = "100%";
    healthFill.style.height = "100%";
    healthFill.style.backgroundColor = "#00ff00";
    healthFill.style.borderRadius = "3px";
    healthFill.style.transition = "width 0.3s ease, background-color 0.3s ease";

    healthBar.appendChild(healthFill);
    document.body.appendChild(healthBar);

    return { healthBar, healthFill };
  }, []);

  const createManaBar = useCallback(() => {
    const manaBar = document.createElement("div");
    manaBar.style.position = "fixed";
    manaBar.style.width = "60px";
    manaBar.style.height = "6px";
    manaBar.style.backgroundColor = "rgba(0, 0, 255, 0.3)";
    manaBar.style.border = "1px solid #000";
    manaBar.style.borderBottomLeftRadius = "4px";
    manaBar.style.borderBottomRightRadius = "4px";
    manaBar.style.zIndex = "10000";
    manaBar.style.pointerEvents = "none";

    const manaFill = document.createElement("div");
    manaFill.style.width = "0%";
    manaFill.style.height = "100%";
    manaFill.style.backgroundColor = "#0099ff";
    manaFill.style.borderRadius = "2px";
    manaFill.style.transition = "width 0.3s ease";

    manaBar.appendChild(manaFill);
    document.body.appendChild(manaBar);

    return { manaBar, manaFill };
  }, []);

  const updateHealthBar = useCallback((participant) => {
    const {
      body,
      healthBar,
      healthFill,
      manaBar,
      manaFill,
      nameLabel,
      hp,
      maxHp,
      mana,
      maxMana,
    } = participant;

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
        manaBar.style.boxShadow = "0 0 10px #0099ff";
        manaFill.style.backgroundColor = "#0099ff";
      } else {
        manaBar.style.boxShadow = "none";
        manaFill.style.backgroundColor = "#0099ff";
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
      healthFill.style.backgroundColor = "#00ff00";
    } else if (healthPercent > 0.3) {
      healthFill.style.backgroundColor = "#ffff00";
    } else {
      healthFill.style.backgroundColor = "#ff0000";
    }
  }, []);

  const createBattleParticipant = useCallback(
    (subscriber, position, id, emoteName) => {
      const engine = engineRef.current;
      if (!engine) return null;

      const emote = emoteMap.get(emoteName);
      if (!emote) {
        console.warn(
          `No suitable emote found for ${subscriber.name}, skipping`
        );
        return null;
      }

      // Normalize battle emote sizes to match overlay sizing. Use battleSettings.emoteBaseSize as nominal height
      // and multiply by battleSettings.emoteScale. Preserve aspect ratio of the emote.
      const emoteScale = battleSettings.emoteScale ?? 1;
      const emoteBaseSize = battleSettings.emoteBaseSize ?? 64;
      const intrinsicW = emote.width || emote.height || emoteBaseSize;
      const intrinsicH = emote.height || emote.width || emoteBaseSize;
      const aspect = intrinsicW / intrinsicH || 1;
      const nominalHeight = emoteBaseSize * emoteScale * 0.8; // keep previous 0.8 factor as visual preference
      const sizeY = nominalHeight;
      const sizeX = Math.round(nominalHeight * aspect);

      const body = Matter.Bodies.rectangle(
        position.x,
        position.y,
        sizeX,
        sizeY,
        {
          render: { visible: false, isStatic: false },
          restitution: 1,
          friction: 0.03,
          frictionAir: 0.01,
          isBattleParticipant: true,
          participantId: id,
        }
      );

      Matter.World.add(engine.world, body);

      const elImg = createEmoteElement(emote.url, sizeX, sizeY);
      elImg.style.width = "100%";
      elImg.style.height = "100%";
      elImg.style.borderRadius = "50%";
      elImg.classList.add("avatar");

      const wrapper = document.createElement("div");
      wrapper.classList.add("participant");
      wrapper.style.width = `${sizeX}px`;
      wrapper.style.height = `${sizeY}px`;
      wrapper.style.boxShadow = `0 0 20px ${subscriber.color}`;
      wrapper.style.border = `2px solid ${subscriber.color}`;
      wrapper.style.borderRadius = "50%";

      wrapper.appendChild(elImg);

      // IMPORTANT: use the wrapper as the moved element
      const el = wrapper;

      document.body.appendChild(el);
      const { healthBar, healthFill } = createHealthBar();
      const { manaBar, manaFill } = createManaBar();

      const nameLabel = document.createElement("div");
      nameLabel.textContent = subscriber.name;
      nameLabel.style.position = "fixed";
      nameLabel.style.fontSize = "14px";
      nameLabel.style.fontWeight = "bold";
      nameLabel.style.color = subscriber.color;
      nameLabel.style.textShadow = "1px 1px 2px rgba(0,0,0,0.8)";
      nameLabel.style.textAlign = "center";
      nameLabel.style.zIndex = "10000";
      nameLabel.style.pointerEvents = "none";
      nameLabel.style.whiteSpace = "nowrap";
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
        isSub: subscriber.isSub,
        particleColor: subscriber.color,
        effects: [],
        cleanupEffects: [],
        isBattleParticipant: true,
      };
    },
    [
      engineRef,
      emoteMap,
      battleSettings.battleEventHp,
      battleSettings.emoteScale,
      battleSettings.emoteBaseSize,
      createHealthBar,
      createManaBar,
    ]
  );

  const showManaGain = (participant, manaGain) => {
    const manaEl = document.createElement("div");
    manaEl.textContent = `+${Math.floor(manaGain)} MP`;
    manaEl.style.position = "fixed";
    manaEl.style.left = `${participant.body.position.x + 20}px`;
    manaEl.style.top = `${participant.body.position.y - 20}px`;
    manaEl.style.color = "#00aaff";
    manaEl.style.fontWeight = "bold";
    manaEl.style.fontSize = "12px";
    manaEl.style.pointerEvents = "none";
    manaEl.style.textShadow = "1px 1px 2px rgba(0,0,0,0.7)";
    manaEl.style.transition = "transform 0.8s ease-out, opacity 0.8s ease-out";
    document.body.appendChild(manaEl);

    requestAnimationFrame(() => {
      manaEl.style.transform = "translateY(-25px)";
      manaEl.style.opacity = "0";
    });

    setTimeout(() => manaEl.remove(), 800);
  };

  const procSpecialSkill = useCallback(
    (participant) => {
      try {
        // Trigger skill effect
        if (participant.mana < participant.maxMana) return;

        const skills = Object.keys(specialSkills).filter(
          (key) => !specialSkills[key].disabled
        );
        const randomSkill = skills[Math.floor(Math.random() * skills.length)];
        const skill = specialSkills[randomSkill];

        //apply the skill

        console.log("Participant:", participant);
        console.log("Skill:", skill);
        console.log("subscriberName:", participant.subscriberName);
        console.log("skill.name:", skill?.name);
        // Log skill use in global skill history overlay
        if (
          dpsTracker &&
          dpsTracker.current &&
          battleSettings.battleEventShowSkillHistory &&
          typeof dpsTracker.current.recordSkillUse === "function"
        ) {
          dpsTracker.current.recordSkillUse(
            participant.id,
            participant.subscriberName,
            participant.userColor || "#fff",
            skill.name
          );
        }

        skill.effect(participant);
        participant.mana = 0;

        // Add skill effect to participant
        if (skill.duration) {
          participant.effects.push({
            name: skill.name,
            duration: skill.duration || 0,
            startTime: Date.now(),
          });
        }
      } catch (e) {
        console.error("Error at procSpecialSkill", e);
      }
    },
    [specialSkills]
  );

  const updateSpecialEffects = (participant) => {
    // Check for active effects
    if (participant.effects && participant.effects.length > 0) {
      participant.effects = participant.effects.filter((effect) => {
        const elapsed = Date.now() - effect.startTime;
        if (elapsed < effect.duration) {
          return true;
        }
        // Remove expired effect and reset shield state
        if (effect.name === "Shield") {
          participant.hasShield = false;
          participant.el.classList.remove("has-shield");
        }
        return false;
      });
    }
  };

  const spawnBattleArena = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !subscriberTracker) return [];
    let availableSubscribers = null;

    // Get all available subscribers
    if (battleSettings.battleEventAcceptPlebs) {
      availableSubscribers = viewerTracker.getSubscriberCount();
      console.log("pleb time");
    } else {
      availableSubscribers = subscriberTracker.getSubscriberCount();
    }

    if (availableSubscribers < 3) {
      console.log("Not enough people to start a battle (minimum 3 required)");
      return [];
    }

    // Determine random number of participants: min 3, max battleEventParticipants or total subscribers
    const maxParticipants = Math.min(
      battleSettings.battleEventParticipants,
      availableSubscribers
    );
    let selectedSubscribers = null;
    if (battleSettings.battleEventAcceptPlebs) {
      selectedSubscribers = viewerTracker.getRandomSubscribers(maxParticipants);
    } else {
      selectedSubscribers =
        subscriberTracker.getRandomSubscribers(maxParticipants);
    }

    if (selectedSubscribers.length === 0) {
      console.log("No subscribers available for battle");
      return [];
    }
    console.log(
      `Starting battle event with ${selectedSubscribers.length} subscribers!`
    );

    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Only square emotes
    const availableEmotes = Array.from(emoteMap.keys()).filter((key) => {
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

    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/gi, "");

    selectedSubscribers.forEach((subscriber, i) => {
      const angle = (i / selectedSubscribers.length) * Math.PI * 2;
      const spawnX =
        centerX + Math.cos(angle) * radius + Math.random() * 100 - 50;
      const spawnY =
        centerY + Math.sin(angle) * radius + Math.random() * 100 - 50;

      const subNameNorm = normalize(subscriber.name);

      let emoteName = availableEmotes.find((e) => {
        const eNorm = normalize(e);
        return subNameNorm.length >= 3 && eNorm.includes(subNameNorm);
      });

      if (!emoteName || usedEmotes.has(emoteName)) {
        emoteName = shuffledEmotes.find((e) => !usedEmotes.has(e));
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
  }, [
    engineRef,
    battleSettings.battleEventParticipants,
    battleSettings.battleEventAcceptPlebs,
    createBattleParticipant,
    subscriberTracker,
    emoteMap,
  ]);

  function showDamageFlyup(x, y, damage, color = "#ff0000") {
    const dmgEl = document.createElement("div");
    dmgEl.textContent = Math.floor(damage); // show integer damage
    dmgEl.style.position = "fixed";
    dmgEl.style.left = `${x}px`;
    dmgEl.style.top = `${y}px`;
    dmgEl.style.color = color;
    dmgEl.style.fontWeight = "bold";
    dmgEl.style.fontSize = "24px";
    dmgEl.style.pointerEvents = "none";
    dmgEl.style.textShadow = "1px 1px 2px rgba(0,0,0,0.7)";
    dmgEl.style.transition = "transform 1.2s ease-out, opacity 1.2s ease-out";
    document.body.appendChild(dmgEl);

    // Add left-right variation
    const horizontal = (Math.random() - 0.5) * 40; // -20 to +20 px
    const vertical = -60;

    // Trigger fly-up animation with left-right offset
    requestAnimationFrame(() => {
      dmgEl.style.transform = `translate(${horizontal}px, ${vertical}px)`;
      dmgEl.style.opacity = "0";
    });

    // Remove from DOM after animation
    setTimeout(() => {
      dmgEl.remove();
    }, 1200);
  }

  const handleCollisions = useCallback(() => {
    if (!activeBattleRef.current || battleParticipants.current.length === 0)
      return;

    const now = Date.now();
    const participants = battleParticipants.current.filter((p) => p.isAlive);

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
          const canDamageP1 =
            now - p1.lastDamageTime > p1.invulnerabilityDuration;
          const canDamageP2 =
            now - p2.lastDamageTime > p2.invulnerabilityDuration;

          // Apply damage
          if (canDamageP1) {
            const damage =
              battleSettings.battleEventDamage * (0.5 + Math.random() * 0.3) -
              15;
            dealDamage(p1, damage, p2);
          }

          if (canDamageP2) {
            const damage =
              battleSettings.battleEventDamage * (0.5 + Math.random() * 0.3) -
              15;
            dealDamage(p2, damage, p1);
          }

          // Repulsion force
          const repulsionStrength = 0.08;
          const repulsionX = (dx / distance) * repulsionStrength;
          const repulsionY = (dy / distance) * repulsionStrength;

          Matter.Body.applyForce(p1.body, p1.body.position, {
            x: repulsionX,
            y: repulsionY,
          });
          Matter.Body.applyForce(p2.body, p2.body.position, {
            x: -repulsionX,
            y: -repulsionY,
          });

          // Check for deaths
          updateSpecialEffects(p1);
          updateSpecialEffects(p2);
        }
      }
    }
  }, [battleSettings.battleEventDamage, dealDamage]);

  const applyAttraction = useCallback(() => {
    if (!activeBattleRef.current) return;

    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive
    );
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

          Matter.Body.applyForce(p1.body, p1.body.position, {
            x: forceX,
            y: forceY,
          });
          Matter.Body.applyForce(p2.body, p2.body.position, {
            x: -forceX,
            y: -forceY,
          });
        }
      }
    }
  }, []);

  const displayWinner = useCallback(
    (winner) => {
      if (!winner) return;
      setTimeout(() => {
        // Build text including total wins if available
        const winsText = winner.totalWins ? ` (Wins: ${winner.totalWins})` : "";
        const messageText = `🏆 ${winner.subscriberName} WINS! 🏆${winsText}`;

        client.current.say(battleSettings.twitchName, messageText).catch(() => {
          const winnerDisplay = document.createElement("div");
          winnerDisplay.innerHTML = messageText;
          winnerDisplay.style.position = "fixed";
          winnerDisplay.style.top = "30px";
          winnerDisplay.style.left = "50%";
          winnerDisplay.style.transform = "translateX(-50%)";
          winnerDisplay.style.fontSize = "36px";
          winnerDisplay.style.fontWeight = "bold";
          winnerDisplay.style.color = winner.userColor;
          winnerDisplay.style.textShadow = "2px 2px 4px rgba(0,0,0,0.8)";
          winnerDisplay.style.zIndex = "10001";
          winnerDisplay.style.pointerEvents = "none";
          winnerDisplay.style.textAlign = "center";
          winnerDisplay.style.animation = "bounce 1s ease-in-out infinite";

          // Add bounce animation
          const style = document.createElement("style");
          style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.05); }
      }
    `;
          document.head.appendChild(style);
          document.body.appendChild(winnerDisplay);

          setTimeout(() => {
            winnerDisplay.remove();
            style.remove();
          }, 5000);
        });
      }, 5000);
    },
    [client, battleSettings]
  );

  const displayDraw = useCallback(
    (draw) => {
      if (!draw) return;
      setTimeout(() => {
        client.current
          .say(battleSettings.twitchName, `🏆 DRAW 🏆`)
          .catch(() => {
            const winnerDisplay = document.createElement("div");
            winnerDisplay.innerHTML = `🏆 DRAW 🏆`;
            winnerDisplay.style.position = "fixed";
            winnerDisplay.style.top = "30px";
            winnerDisplay.style.left = "50%";
            winnerDisplay.style.transform = "translateX(-50%)";
            winnerDisplay.style.fontSize = "36px";
            winnerDisplay.style.fontWeight = "bold";
            winnerDisplay.style.color = "#ff0000";
            winnerDisplay.style.textShadow = "2px 2px 4px rgba(0,0,0,0.8)";
            winnerDisplay.style.zIndex = "10001";
            winnerDisplay.style.pointerEvents = "none";
            winnerDisplay.style.textAlign = "center";
            winnerDisplay.style.animation = "bounce 1s ease-in-out infinite";

            // Add bounce animation
            const style = document.createElement("style");
            style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.05); }
      }
    `;
            document.head.appendChild(style);
            document.body.appendChild(winnerDisplay);

            setTimeout(() => {
              winnerDisplay.remove();
              style.remove();
            }, 5000);
          });
      }, 5000);
    },
    [client, battleSettings]
  );

  const endBattle = useCallback(async () => {
    const engine = engineRef.current;
    if (!activeBattleRef.current || !engine) return;

    activeBattleRef.current.isAlive = false;

    if (battleSettings.battleEventDPSTracker) dpsTracker.current.endBattle();

    if (battleSettings.battleEventDPSTrackerLive) {
      const existing = document.getElementById("live-dps-display");
      if (existing) existing.remove();
    }

    // Notify server that a battle has ended
    try {
      fetch("/api/battle/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }).catch(() => {});
    } catch (err) {
      console.debug(
        "Failed to POST battle state (start):",
        err?.message || err
      );
    }

    // Find winner from remaining alive participants
    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive
    );
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
      try {
        // Post win to leaderboard (use subscriberName if available) and await updated wins
        const result = await incrementLeaderboardWin(
          winner.subscriberName || winner.subscriber?.username || winner.id
        );
        // If server returned wins, attach it to the winner object for display
        if (result && typeof result.wins === "number") {
          winner.totalWins = result.wins;
        }
      } catch (e) {
        console.warn("Failed to increment leaderboard for winner:", e);
      }
      displayWinner(winner);
    } else if (draw) {
      displayDraw(draw);
    }

    // 🔹 Stop physics: remove update listener using the stored reference
    if (battleUpdateListener.current && engine) {
      Matter.Events.off(engine, "beforeUpdate", battleUpdateListener.current);
      battleUpdateListener.current = null;
    }

    // 🔹 Freeze remaining participants
    aliveParticipants.forEach((p) => {
      Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(p.body, 0);
      Matter.Body.setStatic(p.body, true); // optional: makes body completely immovable
    });

    // Clean up battle after a delay (DOM removal, etc.)
    setTimeout(() => {
      battleParticipants.current.forEach((participant) => {
        const index = bodiesWithTimers.current.findIndex(
          (body) => body.id === participant.id
        );
        if (index !== -1) bodiesWithTimers.current.splice(index, 1);

        if (participant.body && engine) {
          try {
            kill(participant);
          } catch (e) {
            console.error("Error removing body from world:", e);
          }
        }
      });

      battleParticipants.current = [];
      activeBattleRef.current = null;
      console.log("Battle ended and all participants cleaned up");

      // Restore the engine timescale to previous value
      try {
        if (engine && engine.timing) {
          engine.timing.timeScale = previousTimeScaleRef.current ?? 1;
        }
      } catch (e) {
        console.warn("Unable to restore engine timescale after battle:", e);
      }

      // Clear the timescale watchdog interval
      try {
        if (timescaleWatchdogRef.current) {
          clearInterval(timescaleWatchdogRef.current);
          timescaleWatchdogRef.current = null;
        }
      } catch (e) {
        console.warn("Unable to clear timescale watchdog after battle:", e);
      }

      // Ensure any non-battle emotes that might have been made static during
      // the fight are restored back to dynamic so they continue to move.
      try {
        bodiesWithTimers.current.forEach((obj) => {
          try {
            const { body, isBattleParticipant } = obj;
            if (!isBattleParticipant && body && body.isStatic) {
              Matter.Body.setStatic(body, false);
              // nudge them so they resume motion visually
              Matter.Body.setVelocity(body, {
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2,
              });
            }
          } catch {
            /* continue on per-body errors */
          }
        });
      } catch (e) {
        console.warn("Error while unfreezing non-battle emotes:", e);
      }
    }, 3000);
  }, [engineRef, client, battleSettings, battleParticipants]);

  // Create a stable updateBattle function that doesn't change on every render
  const updateBattle = useCallback(() => {
    if (!activeBattleRef.current) return;

    const scene = sceneRef.current;

    if (dpsTracker && battleSettings.battleEventDPSTrackerLive) {
      showLiveDPS();
    }

    // Update health bars for all participants (including dead ones that haven't been removed yet)
    battleParticipants.current.forEach((participant) => {
      if (participant.isAlive) {
        updateHealthBar(participant);
      }

      if (participant.isAlive && participant.mana === participant.maxMana) {
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
    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive
    );
    const battleDuration = Date.now() - activeBattleRef.current.startTime;

    if (
      activeBattleRef.current.isAlive &&
      (aliveParticipants.length <= 1 ||
        battleDuration >= battleSettings.battleEventDuration * 1000)
    ) {
      activeBattleRef.current.isAlive = false;
      setTimeout(() => {
        // fire-and-forget async endBattle
        endBattle();
      }, 500);
    }
  }, [
    updateHealthBar,
    applyAttraction,
    procSpecialSkill,
    handleCollisions,
    battleSettings.battleEventDuration,
    battleSettings.battleEventDPSTrackerLive,
    endBattle,
    sceneRef,
  ]);

  const startBattle = useCallback(() => {
    const engine = engineRef.current;

    // More thorough checks
    if (!engine || !isInitialized.current) {
      console.log("Engine not ready or system not initialized");
      return false;
    }

    if (activeBattleRef.current) {
      console.log("Battle already active");
      return false;
    }

    let availableSubscribers = null;

    // Get all available subscribers
    if (battleSettings.battleEventAcceptPlebs) {
      availableSubscribers = viewerTracker.getSubscriberCount();
      console.log("pleb time");
    } else {
      availableSubscribers = subscriberTracker.getSubscriberCount();
    }

    // Check if we have at least 3 subscribers
    if (!subscriberTracker || !viewerTracker || availableSubscribers < 3) {
      console.log("Not enough people for battle (minimum 3 required)");
      return false;
    }

    // Force clean up any stale state first
    if (battleUpdateListener.current) {
      console.log("Cleaning up stale battle listener");
      Matter.Events.off(engine, "beforeUpdate", battleUpdateListener.current);
      battleUpdateListener.current = null;
    }

    if (battleSettings.battleEventDPSTracker) dpsTracker.current.startBattle();

    // Save previous timescale and set desired active timescale
    try {
      if (engine && engine.timing) {
        // Use helper to set and capture previous timescale
        setEngineTimeScale(battleSettings.battleEventTimeScale ?? 1);

        // Start a watchdog to ensure timeScale doesn't get stuck at 0 or a weird value
        if (!timescaleWatchdogRef.current) {
          timescaleWatchdogRef.current = setInterval(() => {
            try {
              const ts = engine.timing && engine.timing.timeScale;
              // If timescale is not a finite positive number, restore to previous
              if (!Number.isFinite(ts) || ts <= 0) {
                restoreEngineTimeScale();
                console.warn(
                  "timescale watchdog restored engine.timing.timeScale to",
                  engine.timing.timeScale
                );
              }
            } catch (e) {
              console.warn("timescale watchdog error:", e);
            }
          }, 1000);
        }
      }
    } catch (e) {
      console.warn("Unable to set engine timescale on startBattle:", e);
    }

    const participants = spawnBattleArena();
    if (participants.length === 0) return false;

    // Add battle participants to the main bodiesWithTimers array so they get rendered
    participants.forEach((participant) => {
      bodiesWithTimers.current.push(participant);
      dpsTracker.current.registerParticipant(participant);
    });

    battleParticipants.current = participants;
    activeBattleRef.current = {
      startTime: Date.now(),
      participants,
      isAlive: true,
    };

    // Set up battle update loop with the stable function reference
    battleUpdateListener.current = updateBattle;
    Matter.Events.on(engine, "beforeUpdate", battleUpdateListener.current);

    console.log(`Battle started with ${participants.length} participants`);

    // Notify server that battle is ongoing
    try {
      fetch("/api/battle/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      }).catch(() => {});
    } catch (err) {
      console.debug("Failed to POST battle state (end):", err?.message || err);
    }

    // Battle announcement with participant names
    const participantNames = participants
      .map((p) => p.subscriberName)
      .join(" vs ");
    const announcement = document.createElement("div");
    announcement.innerHTML = `⚔️ BATTLE ROYALE: ${participantNames}! ⚔️`;
    announcement.style.position = "fixed";
    announcement.style.top = "20px";
    announcement.style.left = "50%";
    announcement.style.transform = "translateX(-50%)";
    announcement.style.fontSize = "24px";
    announcement.style.fontWeight = "bold";
    announcement.style.color = "#ff6600";
    announcement.style.textShadow = "2px 2px 4px rgba(0,0,0,0.8)";
    announcement.style.zIndex = "10001";
    announcement.style.pointerEvents = "none";
    announcement.style.textAlign = "center";
    announcement.style.maxWidth = "80%";
    document.body.appendChild(announcement);

    setTimeout(() => announcement.remove(), 4000);
    return true;
  }, [
    engineRef,
    isInitialized,
    spawnBattleArena,
    updateBattle,
    bodiesWithTimers,
    subscriberTracker,
    viewerTracker,
    battleSettings,
    dpsTracker,
  ]);

  function kill(participant) {
    if (!participant.isAlive) return;

    const engine = engineRef.current;

    if (participant.body && engine) {
      Matter.World.remove(engine.world, participant.body);
    }

    if (participant.el) {
      participant.isAlive = false;
      // Death effect - fade out and remove
      participant.el.style.transition =
        "opacity 1s ease-out, transform 1s ease-out";
      participant.el.style.opacity = "0";
      participant.el.style.transform += " scale(0.5)";
      participant.healthBar.style.opacity = "0";
      participant.manaBar.style.opacity = "0";
      if (participant.nameLabel) participant.nameLabel.style.opacity = "0";

      // Remove from physics world immediately
      Matter.World.remove(engine.world, participant.body);

      // Schedule removal from DOM and arrays
      setTimeout(() => {
        if (participant.el) participant.el.remove();
        if (participant.healthBar) participant.healthBar.remove();
        if (participant.manaBar) participant.manaBar.remove();
        if (participant.nameLabel) participant.nameLabel.remove();

        // Remove from battle participants
        const battleIndex = battleParticipants.current.findIndex(
          (bp) => bp.id === participant.id
        );
        if (battleIndex !== -1) {
          battleParticipants.current.splice(battleIndex, 1);
        }

        // Remove from main bodies array
        const mainIndex = bodiesWithTimers.current.findIndex(
          (bt) => bt.id === participant.id
        );
        if (mainIndex !== -1) {
          bodiesWithTimers.current.splice(mainIndex, 1);
        }
        // Ensure timescale is not stuck at 0 when participants die
        try {
          restoreEngineTimeScale();
          if (timescaleWatchdogRef.current) {
            clearInterval(timescaleWatchdogRef.current);
            timescaleWatchdogRef.current = null;
          }
        } catch (e) {
          console.warn("Error restoring timescale in kill:", e);
        }
      }, 1500);
    }
  }

  const showLiveDPS = useCallback(() => {
    if (!dpsTracker.current.battleActive) return;

    const liveStats = dpsTracker.current.getCurrentStats();

    // Remove existing live display
    const existing = document.getElementById("live-dps-display");
    if (existing) existing.remove();

    const displayFloat = battleSettings.battleEventDPSTrackerLiveFloatLeft
      ? "left"
      : "right";

    console.log(displayFloat);
    // Create live DPS display
    const liveDisplay = document.createElement("div");
    liveDisplay.id = "live-dps-display";
    liveDisplay.style.cssText = `
      position: fixed;
      top: 20px;
      ${displayFloat}: 20px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #4a9eff;
      border-radius: 8px;
      padding: 7px;
      color: white;
      font-size: 10px;
      z-index: 10001;
      max-width: 250px;
      width: 250px;
    `;

    let content =
      '<div style="color: #4a9eff; font-weight: bold; margin-bottom: 8px;">REAL-TIME DPS</div>';

    liveStats.slice(0, 5).forEach((player) => {
      // Limit name length and pad for alignment
      let displayName = player.name;
      const maxLen = 12;
      if (displayName.length > maxLen) {
        displayName = displayName.slice(0, maxLen - 1) + "…";
      }
      // Use monospace font for alignment and fixed width for name
      content += `
        <div style="margin-bottom: 4px; padding: 2px 0; display: flex; justify-content: space-between; align-items: center; font-family: monospace;">
          <span style="color: ${player.color}; min-width: 90px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${displayName}</span>
          <span style="color: #ff6b6b; font-weight: bold;">${player.dps} DPS</span>
        </div>
      `;
    });

    liveDisplay.innerHTML = content;
    document.body.appendChild(liveDisplay);
  }, []);

  return {
    startBattle,
    endBattle,
    getDpsTracker: () => dpsTracker.current,
    isActive: !!activeBattleRef.current,
    participants: battleParticipants.current,
  };
}
