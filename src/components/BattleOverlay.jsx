/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useCallback, useMemo } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { useTwitchClient } from "../hooks/useTwitchClient";
import { useEmoteLoader } from "../hooks/useEmoteLoader";
import { usePhysicsEngine } from "../hooks/usePhysicsEngine";
import { useSubscriberTracker } from "../hooks/useSubscriberTracker";
import { useBattleDPSTracker } from "../hooks/useDPSTracker";
import { createEmoteElement } from "../utils/emoteEffects";
import { createSkills } from "../skills";

export default function BattleOverlay() {
  const toSmallCaps = (text) => {
    const caps = {
      a: "ᴀ",
      b: "ʙ",
      c: "ᴄ",
      d: "ᴅ",
      e: "ᴇ",
      f: "ꜰ",
      g: "ɢ",
      h: "ʜ",
      i: "ɪ",
      j: "ᴊ",
      k: "ᴋ",
      l: "ʟ",
      m: "ᴍ",
      n: "ɴ",
      o: "ᴏ",
      p: "ᴘ",
      q: "ǫ",
      r: "ʀ",
      s: "s",
      t: "ᴛ",
      u: "ᴜ",
      v: "ᴠ",
      w: "ᴡ",
      x: "x",
      y: "ʏ",
      z: "ᴢ",
      0: "𝟶",
      1: "𝟷",
      2: "𝟸",
      3: "𝟹",
      4: "𝟺",
      5: "𝟻",
      6: "𝟼",
      7: "𝟽",
      8: "𝟾",
      9: "𝟿",
    };
    return text
      .toLowerCase()
      .split("")
      .map((char) => caps[char] || char)
      .join("");
  };

  // ------------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------------
  const { settings } = useMetadata();
  const sceneRef = useRef(null);
  const bodiesWithTimers = useRef([]);

  const client = useTwitchClient(settings.twitchName);
  const emoteMap = useEmoteLoader(settings.emoteSetId, 0, {
    twitchName: settings.twitchName,
    enableBTTV: settings.enableBTTV,
    enableFFZ: settings.enableFFZ,
    includeTwitchChannelEmotes: settings.includeTwitchChannelEmotes,
  });
  const physics = usePhysicsEngine();
  const subscriberTracker = useSubscriberTracker(client, false);
  const viewerTracker = useSubscriberTracker(client, true);

  const battleSettings = useMemo(
    () => ({
      battleEventChance: settings.battleEventChance,
      battleEventParticipants: settings.battleEventParticipants,
      battleEventHp: settings.battleEventHp,
      battleEventDamage: settings.battleEventDamage,
      battleEventDuration: settings.battleEventDuration,
      battleEventDPSTracker: settings.battleEventDPSTracker,
      battleEventDPSTrackerFloatLeft: settings.battleEventDPSTrackerFloatLeft,
      battleEventDPSTrackerLiveFloatLeft:
        settings.battleEventDPSTrackerLiveFloatLeft,
      battleEventDPSTrackerLive: settings.battleEventDPSTrackerLive,
      battleEventAcceptPlebs: settings.battleEventAcceptPlebs,
      battleEventShowSkillHistory: settings.battleEventShowSkillHistory,
      twitchName: settings.twitchName,
      emoteScale: settings.emoteScale ?? 1,
      emoteBaseSize: settings.emoteBaseSize ?? 64,
    }),
    [settings],
  );

  // ------------------------------------------------------------------
  // Inline Internal State Refs
  // ------------------------------------------------------------------
  const dpsTracker = useBattleDPSTracker(battleSettings);
  const activeBattleRef = useRef(null);
  const battleParticipants = useRef([]);
  const battleRafRef = useRef(null);
  const isInitialized = useRef(false);
  const activeCooldownsRef = useRef(new Map());

  // ------------------------------------------------------------------
  // Physics Helpers
  // ------------------------------------------------------------------
  const getWorld = useCallback(
    () => physics.engineRef.current,
    [physics.engineRef],
  );

  // ------------------------------------------------------------------
  // Leaderboard API
  // ------------------------------------------------------------------
  const incrementLeaderboardWin = useCallback(async (username) => {
    try {
      if (!username) return null;
      const resp = await fetch("/api/leaderboard/win", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.warn("Error posting leaderboard win:", e);
      return null;
    }
  }, []);

  // ------------------------------------------------------------------
  // Spatial Helpers
  // ------------------------------------------------------------------
  const getPos = useCallback((participant) => {
    if (!participant.body || !participant.isAlive) return { x: 0, y: 0 };
    try {
      return participant.body.translation();
    } catch (e) {
      console.warn(
        "Attempted to access destroyed Rapier body:",
        participant.id,
        e,
      );
      return { x: 0, y: 0 };
    }
  }, []);

  const findPopulatedPoint = useCallback(
    (participant) => {
      const aliveParticipants = battleParticipants.current.filter(
        (p) => p.isAlive && p.id !== participant.id,
      );
      if (aliveParticipants.length === 0) {
        const pos = getPos(participant);
        return { x: pos.x, y: pos.y };
      }
      const middleX =
        aliveParticipants.reduce((sum, p) => sum + getPos(p).x, 0) /
        aliveParticipants.length;
      const middleY =
        aliveParticipants.reduce((sum, p) => sum + getPos(p).y, 0) /
        aliveParticipants.length;
      return { x: middleX, y: middleY };
    },
    [getPos],
  );

  const findNearestEnemy = useCallback(
    (participant, ...exceptions) => {
      try {
        const exceptionIds = exceptions.map((e) => e.id);
        const aliveParticipants = battleParticipants.current.filter(
          (p) =>
            p.isAlive &&
            p.id !== participant.id &&
            !exceptionIds.includes(p.id),
        );
        if (aliveParticipants.length === 0) return null;

        const pPos = getPos(participant);
        let nearest = null;
        let minDistance = Infinity;

        aliveParticipants.forEach((enemy) => {
          const ePos = getPos(enemy);
          const dx = ePos.x - pPos.x;
          const dy = ePos.y - pPos.y;
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
    },
    [getPos],
  );

  const findFarthestEnemy = useCallback(
    (participant, ...exceptions) => {
      const exceptionIds = exceptions.map((e) => e.id);
      const aliveParticipants = battleParticipants.current.filter(
        (p) =>
          p.isAlive && p.id !== participant.id && !exceptionIds.includes(p.id),
      );
      if (aliveParticipants.length === 0) return null;

      const pPos = getPos(participant);
      let farthest = null;
      let maxDistance = 0;

      aliveParticipants.forEach((enemy) => {
        const ePos = getPos(enemy);
        const dx = ePos.x - pPos.x;
        const dy = ePos.y - pPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > maxDistance) {
          maxDistance = distance;
          farthest = enemy;
        }
      });

      return farthest;
    },
    [getPos],
  );

  const findStrongestEnemy = useCallback((participant) => {
    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive && p.id != participant.id,
    );
    if (aliveParticipants.length === 0) return null;
    const maxHP = Math.max(...aliveParticipants.map((p) => p.hp));
    const strongest = aliveParticipants.filter((p) => p.hp === maxHP);
    return strongest[Math.floor(Math.random() * strongest.length)];
  }, []);

  const teleport = useCallback((caster, targetX, targetY) => {
    const offset = 100;
    caster.body.setTranslation({ x: targetX - offset, y: targetY }, true);
  }, []);

  // ------------------------------------------------------------------
  // Floating Flyups & Visual FX
  // ------------------------------------------------------------------
  const showText = useCallback(
    (x, text, color = "#ff0000") => {
      if (!x?.body) {
        console.warn("Cannot show text, no body:", text, x);
        return;
      }

      const pos = getPos(x);
      const textEl = document.createElement("div");
      textEl.id = "text-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      textEl.textContent = text;
      textEl.style.position = "fixed";

      const left = Math.max(0, Math.min(window.innerWidth - 50, pos.x - 20));
      const top = Math.max(0, Math.min(window.innerHeight - 30, pos.y - 50));
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
    },
    [getPos],
  );

  const showDamageFlyup = useCallback((x, y, damage, color = "#ff0000") => {
    const dmgEl = document.createElement("div");
    dmgEl.textContent = Math.floor(damage);
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

    const horizontal = (Math.random() - 0.5) * 40;
    const vertical = -60;

    requestAnimationFrame(() => {
      dmgEl.style.transform = `translate(${horizontal}px, ${vertical}px)`;
      dmgEl.style.opacity = "0";
    });

    setTimeout(() => dmgEl.remove(), 1200);
  }, []);

  const showManaGain = useCallback(
    (participant, manaGain) => {
      const pos = getPos(participant);
      const manaEl = document.createElement("div");
      manaEl.textContent = `+${Math.floor(manaGain)} MP`;
      manaEl.style.position = "fixed";
      manaEl.style.left = `${pos.x + 20}px`;
      manaEl.style.top = `${pos.y - 20}px`;
      manaEl.style.color = "#00aaff";
      manaEl.style.fontWeight = "bold";
      manaEl.style.fontSize = "12px";
      manaEl.style.pointerEvents = "none";
      manaEl.style.textShadow = "1px 1px 2px rgba(0,0,0,0.7)";
      manaEl.style.transition =
        "transform 0.8s ease-out, opacity 0.8s ease-out";
      document.body.appendChild(manaEl);

      requestAnimationFrame(() => {
        manaEl.style.transform = "translateY(-25px)";
        manaEl.style.opacity = "0";
      });

      setTimeout(() => manaEl.remove(), 800);
    },
    [getPos],
  );

  const drawJaggedLightning = useCallback((attacker, target) => {
    const svg = document.getElementById("effects-layer");
    if (!svg || !attacker.el || !target.el) return;

    const attackerRect = attacker.el.getBoundingClientRect();
    const targetRect = target.el.getBoundingClientRect();

    const x1 = attackerRect.left + attackerRect.width / 2;
    const y1 = attackerRect.top + attackerRect.height / 2;
    const x2 = targetRect.left + targetRect.width / 2;
    const y2 = targetRect.top + targetRect.height / 2;

    const segments = 9;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20;
      const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20;
      points.push(`${x},${y}`);
    }

    const polyline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    polyline.setAttribute("points", points.join(" "));
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "blue");
    polyline.setAttribute("stroke-width", "2");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("filter", "url(#glow)");

    if (!document.getElementById("glow")) {
      const defs = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs",
      );
      defs.innerHTML = `
        <filter id="glow">
          <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="cyan"/>
        </filter>
      `;
      svg.appendChild(defs);
    }

    svg.appendChild(polyline);
    polyline.animate(
      [
        { opacity: 1, strokeWidth: 3 },
        { opacity: 0.6, strokeWidth: 5 },
        { opacity: 0 },
      ],
      { duration: 250, easing: "ease-out" },
    ).onfinish = () => polyline.remove();
  }, []);

  // ------------------------------------------------------------------
  // Dynamic Combat Combat Engine Loops
  // ------------------------------------------------------------------
  const kill = useCallback(
    (participant) => {
      if (!participant.isAlive) return;
      const world = getWorld();
      participant.isAlive = false;

      if (participant.el) {
        participant.el.style.transition =
          "opacity 1s ease-out, transform 1s ease-out";
        participant.el.style.opacity = "0";
        participant.el.style.transform += " scale(0.5)";
        if (participant.healthBar) participant.healthBar.style.opacity = "0";
        if (participant.manaBar) participant.manaBar.style.opacity = "0";
        if (participant.nameLabel) participant.nameLabel.style.opacity = "0";
      }

      if (participant.body && world) {
        try {
          world.removeRigidBody(participant.body);
          participant.body = null;
        } catch (e) {
          console.error("Error removing body in kill:", e);
        }
      }

      setTimeout(() => {
        if (participant.el) participant.el.remove();
        if (participant.healthBar) participant.healthBar.remove();
        if (participant.manaBar) participant.manaBar.remove();
        if (participant.nameLabel) participant.nameLabel.remove();

        const battleIndex = battleParticipants.current.findIndex(
          (bp) => bp.id === participant.id,
        );
        if (battleIndex !== -1)
          battleParticipants.current.splice(battleIndex, 1);

        const mainIndex = bodiesWithTimers.current.findIndex(
          (bt) => bt.id === participant.id,
        );
        if (mainIndex !== -1) bodiesWithTimers.current.splice(mainIndex, 1);
      }, 1500);
    },
    [getWorld],
  );

  const dealDamage = useCallback(
    (target, damage, attacker, canGainMana = true) => {
      if (!target.isAlive) return;

      dpsTracker.current.registerParticipant(target);
      if (attacker) {
        dpsTracker.current.registerParticipant(attacker);
        dpsTracker.current.recordDamageDealt(
          attacker.id,
          target.id,
          target.hasShield ? damage * 0.5 : damage,
        );
      }

      if (target.hasShield) {
        damage *= 0.5;
        const pos = getPos(target);
        showDamageFlyup(pos.x, pos.y - 40, damage, "#00aaff");
      } else {
        const pos = getPos(target);
        showDamageFlyup(pos.x, pos.y - 40, damage, target.userColor);
      }

      target.hp -= damage;
      target.lastDamageTime = Date.now();
      if (target.hp <= 0) {
        if (attacker) dpsTracker.current.recordKill(attacker.id, target.id);
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
    [getPos, showDamageFlyup, showManaGain, kill, dpsTracker],
  );

  const radialKnockback = useCallback(
    (caster, radius = 500, forceMagnitude = 15000000.0) => {
      const world = getWorld();
      if (!world) return;

      const casterPos = getPos(caster);

      const allParticipants = battleParticipants.current.filter(
        (p) => p.isAlive && p.id !== caster.id && p.body,
      );

      allParticipants.forEach((target) => {
        const targetPos = getPos(target);
        const dx = targetPos.x - casterPos.x;
        const dy = targetPos.y - casterPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius && dist > 0.01) {
          const nx = dx / dist;
          const ny = dy / dist;

          const falloff = 1 - dist / radius;
          const strength = forceMagnitude * falloff;

          target.body.setLinvel({ x: 0, y: 0 }, true);
          target.body.applyImpulse(
            { x: nx * strength, y: ny * strength },
            true,
          );

          setTimeout(() => {
            if (target.isAlive) {
              dealDamage(
                target,
                battleSettings.battleEventDamage * 1.8,
                caster,
                false,
              );
            }
          }, 100);
        }
      });
    },
    [getWorld, getPos, dealDamage, battleSettings],
  );

  // ------------------------------------------------------------------
  // Skill Initialization
  // ------------------------------------------------------------------
  const specialSkills = useMemo(() => {
    const helpers = {
      engineRef: physics.engineRef,
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
      battleParticipants,
    };
    return createSkills(helpers);
  }, [
    physics.engineRef,
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
  ]);

  const procSpecialSkill = useCallback(
    (participant) => {
      try {
        if (participant.mana < participant.maxMana) return;

        const now = Date.now();
        const skills = Object.keys(specialSkills).filter(
          (key) => !specialSkills[key].disabled,
        );
        if (skills.length === 0) return;

        const randomSkill = skills[Math.floor(Math.random() * skills.length)];
        const skill = specialSkills[randomSkill];
        const skillExpiry = activeCooldownsRef.current.get(skill.name);

        if (skillExpiry) {
          if (now < skillExpiry) return;
          activeCooldownsRef.current.delete(skill.name);
        }

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
            skill.name,
          );
        }

        skill.effect(participant);
        participant.mana = 0;
        activeCooldownsRef.current.set(skill.name, Date.now() + 1000);

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
    [specialSkills, dpsTracker, battleSettings],
  );

  const updateSpecialEffects = useCallback((participant) => {
    if (participant.effects && participant.effects.length > 0) {
      participant.effects = participant.effects.filter((effect) => {
        const elapsed = Date.now() - effect.startTime;
        if (elapsed < effect.duration) return true;
        if (effect.name === "Shield") {
          participant.hasShield = false;
          if (participant.el) participant.el.classList.remove("has-shield");
        }
        return false;
      });
    }
  }, []);

  // ------------------------------------------------------------------
  // UI Element Creation & Updates
  // ------------------------------------------------------------------
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
    if (!healthBar || !healthFill || !body) return;

    const pos = body.translation();
    const healthPercent = Math.max(0, hp / maxHp);
    const manaPercent = Math.max(0, mana / maxMana);
    const x = pos.x - 30;
    const y = pos.y - 60;

    healthBar.style.transform = `translate(${x}px, ${y}px)`;
    healthFill.style.width = `${healthPercent * 100}%`;

    if (manaBar && manaFill) {
      manaBar.style.transform = `translate(${x}px, ${y + 6}px)`;
      manaFill.style.width = `${manaPercent * 100}%`;

      if (manaPercent >= 1) {
        manaBar.style.boxShadow = "0 0 10px #0099ff";
      } else {
        manaBar.style.boxShadow = "none";
      }
    }

    if (nameLabel) {
      const nameX = pos.x - 40;
      const nameY = pos.y - 50;
      nameLabel.style.transform = `translate(${nameX}px, ${nameY}px)`;
    }

    if (healthPercent > 0.6) {
      healthFill.style.backgroundColor = "#00ff00";
    } else if (healthPercent > 0.3) {
      healthFill.style.backgroundColor = "#ffff00";
    } else {
      healthFill.style.backgroundColor = "#ff0000";
    }
  }, []);

  const showLiveDPS = useCallback(() => {
    if (!dpsTracker.current.battleActive) return;

    const liveStats = dpsTracker.current.getCurrentStats();
    const existing = document.getElementById("live-dps-display");
    if (existing) existing.remove();

    const displayFloat = battleSettings.battleEventDPSTrackerLiveFloatLeft
      ? "left"
      : "right";

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
      width: 200px;
    `;

    let content =
      '<div style="color: #4a9eff; font-weight: bold; margin-bottom: 8px;">REAL-TIME DPS</div>';

    liveStats.slice(0, 5).forEach((player) => {
      let displayName = player.name;
      const maxLen = 12;
      if (displayName.length > maxLen) {
        displayName = displayName.slice(0, maxLen - 1) + "…";
      }
      content += `
        <div style="margin-bottom: 4px; padding: 2px 0; display: flex; align-items: center; font-family: monospace;">
          <span style="color: ${player.color}; width: 110px; min-width: 110px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${displayName}</span>
          <span style="color: #ff6b6b; font-weight: bold;">${player.dps} DPS</span>
        </div>
      `;
    });

    liveDisplay.innerHTML = content;
    document.body.appendChild(liveDisplay);
  }, [battleSettings, dpsTracker]);

  // ------------------------------------------------------------------
  // Chat Messaging Outputs
  // ------------------------------------------------------------------
  const displayWinner = useCallback(
    (winner) => {
      if (!winner || !client) return;
      setTimeout(() => {
        const winsText = winner.totalWins ? ` (Wins: ${winner.totalWins})` : "";
        const messageText = `🏆 ${toSmallCaps(winner.subscriberName)} WINS! 🏆${winsText}`;
        client.say(battleSettings.twitchName, messageText);
      }, 5000);
    },
    [client, battleSettings.twitchName],
  );

  const displayDraw = useCallback(() => {
    setTimeout(() => {
      if (client) {
        client
          .say(battleSettings.twitchName, `🏆 DRAW 🏆`)
          .catch(() => drawDomFallback());
      } else {
        drawDomFallback();
      }
    }, 5000);

    function drawDomFallback() {
      const winnerDisplay = document.createElement("div");
      winnerDisplay.innerHTML = `🏆 DRAW 🏆`;
      winnerDisplay.style.cssText = `
        position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
        font-size: 36px; font-weight: bold; color: #ff0000;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8); z-index: 10001;
        pointer-events: none; text-align: center; animation: bounce 1s ease-in-out infinite;
      `;

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
    }
  }, [client, battleSettings.twitchName]);

  // ------------------------------------------------------------------
  // Participant Spawning Configuration
  // ------------------------------------------------------------------
  const createBattleParticipant = useCallback(
    (subscriber, position, id, emoteName) => {
      const world = getWorld();
      if (!world) return null;

      const emote = emoteMap.get(emoteName);
      if (!emote) {
        console.warn(
          `No suitable emote found for ${subscriber.name}, skipping`,
        );
        return null;
      }

      const nominalHeight =
        (battleSettings.emoteBaseSize ?? 64) *
        (battleSettings.emoteScale ?? 1) *
        0.8;
      const aspect = emote?.width / emote?.height || 1;
      const sizeY = nominalHeight;
      const sizeX = nominalHeight * aspect;

      const rigidBodyDesc = window.RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y)
        .setLinearDamping(0.8)
        .setAngularDamping(0)
        .setGravityScale(0)
        .lockRotations()
        .setCcdEnabled(false)
        .setCanSleep(false);

      const body = world.createRigidBody(rigidBodyDesc);

      const colliderDesc = window.RAPIER.ColliderDesc.cuboid(
        sizeX / 2,
        sizeY / 2,
      )
        .setRestitution(1.2)
        .setFriction(0)
        .setSensor(false)
        .setDensity(1.0);

      world.createCollider(colliderDesc, body);

      const elImg = createEmoteElement(emote?.url, sizeX, sizeY);
      elImg.style.width = "100%";
      elImg.style.height = "100%";
      elImg.style.borderRadius = "50%";
      elImg.classList.add("avatar");

      const wrapper = document.createElement("div");
      wrapper.classList.add("participant");
      wrapper.style.cssText = `position:fixed; width:${sizeX}px; height:${sizeY}px; border-radius:50%; border:2px solid ${subscriber.color}; box-shadow: 0 0 15px ${subscriber.color}; z-index:9999; pointer-events:none;`;
      wrapper.appendChild(elImg);
      document.body.appendChild(wrapper);

      const { healthBar, healthFill } = createHealthBar();
      const { manaBar, manaFill } = createManaBar();

      const nameLabel = document.createElement("div");
      nameLabel.textContent = subscriber.name;
      nameLabel.style.cssText = `position: fixed; font-size: 14px; font-weight: bold; color: ${subscriber.color}; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); text-align: center; z-index: 10000; pointer-events: none; white-space: nowrap;`;
      document.body.appendChild(nameLabel);

      return {
        id,
        body,
        el: wrapper,
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
    [getWorld, emoteMap, battleSettings, createHealthBar, createManaBar],
  );

  const spawnBattleArena = useCallback(() => {
    const world = getWorld();
    if (!world || !subscriberTracker) return [];

    let availableSubscribers = battleSettings.battleEventAcceptPlebs
      ? viewerTracker.getSubscriberCount()
      : subscriberTracker.getSubscriberCount();

    if (availableSubscribers < 3) {
      console.log("Not enough people to start a battle (minimum 3 required)");
      return [];
    }

    const maxParticipants = Math.min(
      battleSettings.battleEventParticipants,
      availableSubscribers,
    );
    let selectedSubscribers = battleSettings.battleEventAcceptPlebs
      ? viewerTracker.getRandomSubscribers(maxParticipants)
      : subscriberTracker.getRandomSubscribers(maxParticipants);

    if (selectedSubscribers.length === 0) {
      console.log("No subscribers available for battle");
      return [];
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    const availableEmotes = Array.from(emoteMap.keys()).filter((key) => {
      const emote = emoteMap.get(key);
      return emote?.width === emote?.height;
    });

    if (availableEmotes.length === 0) {
      console.warn("No emotes loaded yet, skipping battle");
      return [];
    }

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
      if (!emoteName) emoteName = shuffledEmotes[i % shuffledEmotes.length];
      usedEmotes.add(emoteName);

      const participant = createBattleParticipant(
        subscriber,
        { x: spawnX, y: spawnY },
        `battle_${subscriber.username}_${i}`,
        emoteName,
      );

      if (participant) {
        const velocityStrength = 200;
        const velX = (centerX - spawnX) * (velocityStrength / radius);
        const velY = (centerY - spawnY) * (velocityStrength / radius);
        participant.body.setLinvel({ x: velX, y: velY }, true);
        participants.push(participant);
        bodiesWithTimers.current.push(participant);
      }
    });

    return participants;
  }, [
    getWorld,
    battleSettings,
    createBattleParticipant,
    subscriberTracker,
    viewerTracker,
    emoteMap,
  ]);

  // ------------------------------------------------------------------
  // Collision & Core Game Logic Processing Loops
  // ------------------------------------------------------------------
  const handleCollisions = useCallback(() => {
    if (!activeBattleRef.current || battleParticipants.current.length === 0)
      return;

    const now = Date.now();
    const participants = battleParticipants.current.filter((p) => p.isAlive);

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const p1 = participants[i];
        const p2 = participants[j];

        const pos1 = getPos(p1);
        const pos2 = getPos(p2);
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (p1.sizeX + p2.sizeX) / 2 + 10;

        if (distance < minDistance && distance > 0) {
          const canDamageP1 =
            now - p1.lastDamageTime > p1.invulnerabilityDuration;
          const canDamageP2 =
            now - p2.lastDamageTime > p2.invulnerabilityDuration;

          if (canDamageP1) {
            const base = battleSettings.battleEventDamage;
            const factor = 1 + (Math.random() * 0.8 - 0.4);
            dealDamage(p1, Math.round(base * factor), p2);
          }

          if (canDamageP2) {
            const base = battleSettings.battleEventDamage;
            const factor = 1 + (Math.random() * 0.8 - 0.4);
            dealDamage(p2, Math.round(base * factor), p1);
          }

          const nx = dx / distance;
          const ny = dy / distance;
          const bounceImpulse = 400000.0;

          const scene = sceneRef.current;
          const sw = scene
            ? scene.getBoundingClientRect().width
            : window.innerWidth;
          const sh = scene
            ? scene.getBoundingClientRect().height
            : window.innerHeight;
          const cx = sw * 0.5;
          const cy = sh * 0.45;
          const centerNudge = 0.18;

          if (p1.body && p1.isAlive) {
            const vel1 = p1.body.linvel();
            const pos1b = p1.body.translation();
            const tcx1 = cx - pos1b.x;
            const tcy1 = cy - pos1b.y;
            const td1 = Math.sqrt(tcx1 * tcx1 + tcy1 * tcy1) || 1;
            p1.body.setLinvel({ x: vel1.x * 0.4, y: vel1.y * 0.4 }, true);
            p1.body.applyImpulse(
              {
                x:
                  nx * bounceImpulse +
                  (tcx1 / td1) * bounceImpulse * centerNudge,
                y:
                  ny * bounceImpulse +
                  (tcy1 / td1) * bounceImpulse * centerNudge,
              },
              true,
            );
          }

          if (p2.body && p2.isAlive) {
            const vel2 = p2.body.linvel();
            const pos2b = p2.body.translation();
            const tcx2 = cx - pos2b.x;
            const tcy2 = cy - pos2b.y;
            const td2 = Math.sqrt(tcx2 * tcx2 + tcy2 * tcy2) || 1;
            p2.body.setLinvel({ x: vel2.x * 0.4, y: vel2.y * 0.4 }, true);
            p2.body.applyImpulse(
              {
                x:
                  -nx * bounceImpulse +
                  (tcx2 / td2) * bounceImpulse * centerNudge,
                y:
                  -ny * bounceImpulse +
                  (tcy2 / td2) * bounceImpulse * centerNudge,
              },
              true,
            );
          }
          updateSpecialEffects(p1);
          updateSpecialEffects(p2);
        }
      }
    }
  }, [
    battleSettings.battleEventDamage,
    dealDamage,
    getPos,
    updateSpecialEffects,
  ]);

  const applyAttraction = useCallback(() => {
    if (!activeBattleRef.current) return;

    const scene = sceneRef.current;
    const { width, height } = scene
      ? scene.getBoundingClientRect()
      : { width: window.innerWidth, height: window.innerHeight };

    const arenaCenterX = width * 0.5;
    const arenaCenterY = height * 0.45;

    const now = Date.now();
    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive && p.body && now - (p.lastDamageTime || 0) > 150,
    );

    if (aliveParticipants.length < 2) return;

    const WALL_MARGIN = 100;
    const WALL_REPULSE = 6000.0;

    aliveParticipants.forEach((p1) => {
      const pos1 = p1.body.translation();
      let forceX = 0;
      let forceY = 0;

      let closestEnemy = null;
      let closestDist = Infinity;

      aliveParticipants.forEach((p2) => {
        if (p1.id === p2.id) return;
        const pos2 = p2.body.translation();
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = { dx, dy, dist };
        }
      });

      if (closestEnemy && closestEnemy.dist > 10) {
        const { dx, dy, dist } = closestEnemy;
        const nx = dx / dist;
        const ny = dy / dist;

        const attractionScale = Math.min(1, closestDist / 400);
        const baseStrength = aliveParticipants.length <= 2 ? 6000 : 4000;
        const strength = baseStrength * attractionScale;

        forceX += nx * strength;
        forceY += ny * strength;
      }

      if (aliveParticipants.length >= 4) {
        const toCenterX = arenaCenterX - pos1.x;
        const toCenterY = arenaCenterY - pos1.y;
        const distToCenter = Math.sqrt(
          toCenterX * toCenterX + toCenterY * toCenterY,
        );

        if (distToCenter > 200) {
          const centerStrength = 2000;
          forceX += (toCenterX / distToCenter) * centerStrength;
          forceY += (toCenterY / distToCenter) * centerStrength;
        }
      }

      if (pos1.x < WALL_MARGIN) {
        const t = 1 - pos1.x / WALL_MARGIN;
        forceX += WALL_REPULSE * t * t;
      } else if (pos1.x > width - WALL_MARGIN) {
        const t = 1 - (width - pos1.x) / WALL_MARGIN;
        forceX -= WALL_REPULSE * t * t;
      }

      if (pos1.y < WALL_MARGIN) {
        const t = 1 - pos1.y / WALL_MARGIN;
        forceY += WALL_REPULSE * t * t;
      } else if (pos1.y > height - WALL_MARGIN) {
        const t = 1 - (height - pos1.y) / WALL_MARGIN;
        forceY -= WALL_REPULSE * t * t;
      }

      p1.body.addForce({ x: forceX, y: forceY }, true);

      const vel = p1.body.linvel();
      const velMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (velMag > 200) {
        const scale = 200 / velMag;
        p1.body.setLinvel({ x: vel.x * scale, y: vel.y * scale }, true);
      }
    });
  }, []);

  const endBattle = useCallback(async () => {
    const world = getWorld();
    if (!activeBattleRef.current || !world) return;

    activeBattleRef.current.isAlive = false;

    if (battleSettings.battleEventDPSTracker) dpsTracker.current.endBattle();

    if (battleSettings.battleEventDPSTrackerLive) {
      const existing = document.getElementById("live-dps-display");
      if (existing) existing.remove();
    }

    try {
      fetch("/api/battle/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }).catch(() => {});
    } catch (err) {
      console.debug("Failed to POST battle state (end):", err?.message || err);
    }

    const aliveParticipants = battleParticipants.current.filter(
      (p) => p.isAlive,
    );
    let winner;
    let draw = false;

    if (aliveParticipants.length === 1) {
      winner = aliveParticipants[0];
    } else if (aliveParticipants.length > 1) {
      winner = aliveParticipants.reduce((prev, current) =>
        current.hp > prev.hp ? current : prev,
      );
    } else {
      draw = true;
    }

    if (winner) {
      try {
        const result = await incrementLeaderboardWin(
          winner.subscriberName || winner.subscriber?.username || winner.id,
        );
        if (result && typeof result.wins === "number") {
          winner.totalWins = result.wins;
        }
      } catch (e) {
        console.warn("Failed to increment leaderboard for winner:", e);
      }
      displayWinner(winner);
    } else if (draw) {
      displayDraw();
    }

    if (battleRafRef.current) {
      cancelAnimationFrame(battleRafRef.current);
      battleRafRef.current = null;
    }

    aliveParticipants.forEach((p) => {
      if (p.body) {
        try {
          p.body.setLinvel({ x: 0, y: 0 }, true);
          p.body.setAngvel(0, true);
          p.body.setBodyType(window.RAPIER.RigidBodyType.Fixed, true);
        } catch (e) {
          console.warn("Error freezing participant:", e);
        }
      }
    });

    setTimeout(() => {
      battleParticipants.current.forEach((participant) => {
        const index = bodiesWithTimers.current.findIndex(
          (body) => body.id === participant.id,
        );
        if (index !== -1) bodiesWithTimers.current.splice(index, 1);

        if (participant.body && world) {
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

      try {
        bodiesWithTimers.current.forEach((obj) => {
          try {
            const { body, isBattleParticipant } = obj;
            if (
              !isBattleParticipant &&
              body &&
              body.bodyType() === window.RAPIER.RigidBodyType.Fixed
            ) {
              body.setBodyType(window.RAPIER.RigidBodyType.Dynamic, true);
              body.setLinvel(
                { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
                true,
              );
            }
          } catch {
            /* continue on per-body errors */
          }
        });
      } catch (e) {
        console.warn("Error while unfreezing non-battle emotes:", e);
      }
    }, 3000);
  }, [
    getWorld,
    battleSettings,
    incrementLeaderboardWin,
    displayWinner,
    displayDraw,
    kill,
  ]);

  const updateBattleLogic = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { width, height } = scene.getBoundingClientRect();

    const aliveCount = battleParticipants.current.filter(
      (p) => p.isAlive,
    ).length;

    if (dpsTracker && battleSettings.battleEventDPSTrackerLive) showLiveDPS();

    battleParticipants.current
      .filter((p) => p.isAlive && p.body)
      .forEach((p) => {
        const pos = p.body.translation();
        p.el.style.transform = `translate(${pos.x - p.sizeX / 2}px, ${pos.y - p.sizeY / 2}px)`;
        updateHealthBar(p);

        if (p.mana < p.maxMana) {
          p.mana = Math.min(p.maxMana, p.mana + 0.05);
        }

        if (p.mana >= p.maxMana) {
          procSpecialSkill(p);
        }

        if (
          pos.x < -50 ||
          pos.x > width + 50 ||
          pos.y < -50 ||
          pos.y > height + 50
        ) {
          kill(p);
        }
      });

    const duration = Date.now() - activeBattleRef.current.startTime;

    if (
      activeBattleRef.current.isAlive &&
      (aliveCount <= 1 || duration > battleSettings.battleEventDuration * 1000)
    ) {
      activeBattleRef.current.isAlive = false;
      setTimeout(() => endBattle(), 1000);
    }
  }, [
    battleSettings,
    dpsTracker,
    showLiveDPS,
    updateHealthBar,
    procSpecialSkill,
    kill,
    endBattle,
  ]);

  const startBattleLoop = useCallback(() => {
    const world = getWorld();
    if (!world) return;

    const loop = () => {
      if (!activeBattleRef.current) {
        battleRafRef.current = null;
        return;
      }

      applyAttraction();
      handleCollisions();

      world.timestep = 1 / 60;
      world.step();

      updateBattleLogic();

      battleRafRef.current = requestAnimationFrame(loop);
    };
    battleRafRef.current = requestAnimationFrame(loop);
  }, [getWorld, applyAttraction, handleCollisions, updateBattleLogic]);

  const startBattle = useCallback(() => {
    const world = getWorld();
    if (!world || activeBattleRef.current) return false;

    const participants = spawnBattleArena();
    if (participants.length === 0) return false;

    dpsTracker.current.startBattle();

    battleParticipants.current = participants;
    activeBattleRef.current = { startTime: Date.now(), isAlive: true };

    startBattleLoop();
    return true;
  }, [getWorld, spawnBattleArena, startBattleLoop, dpsTracker]);

  // ------------------------------------------------------------------
  // Lifecycle Hook Cleanups & Handlers
  // ------------------------------------------------------------------
  useEffect(() => {
    if (physics.engineRef.current && !isInitialized.current) {
      isInitialized.current = true;
      console.log("Battle system initialized (Rapier)");
    }
  }, [physics.engineRef]);

  // Handle core physical engine lifecycle updates
  useEffect(() => {
    if (physics.engineRef.current) {
      physics.startDOMUpdates(bodiesWithTimers, { emoteStaticMode: false });
      return () => {
        physics.stopDOMUpdates();
      };
    }
  }, [physics]);

  // Unmount Force Cleanup
  useEffect(() => {
    return () => {
      const world = getWorld();

      if (activeBattleRef.current) {
        console.log("Force ending battle due to cleanup");

        if (battleRafRef.current) {
          cancelAnimationFrame(battleRafRef.current);
          battleRafRef.current = null;
        }

        battleParticipants.current.forEach((participant) => {
          if (participant.el) participant.el.remove();
          if (participant.healthBar) participant.healthBar.remove();
          if (participant.manaBar) participant.manaBar.remove();
          if (participant.nameLabel) participant.nameLabel.remove();

          if (participant.body && world) {
            try {
              world.removeRigidBody(participant.body);
            } catch (e) {
              console.error("Error removing body during cleanup:", e);
            }
          }

          const mainIndex = bodiesWithTimers.current.findIndex(
            (bt) => bt.id === participant.id,
          );
          if (mainIndex !== -1) bodiesWithTimers.current.splice(mainIndex, 1);
        });

        const liveDisplay = document.getElementById("live-dps-display");
        if (liveDisplay) liveDisplay.remove();

        activeBattleRef.current = null;
        battleParticipants.current = [];
        battleRafRef.current = null;
        activeCooldownsRef.current = null;
      }

      isInitialized.current = false;
    };
  }, [getWorld]);

  // Twitch Client Message Routing
  useEffect(() => {
    if (!client) return;

    function onMessage(channel, userstate, message) {
      const isMod = userstate.mod || userstate.badges?.broadcaster;
      const words = message.split(/\s+/);

      const trimPunc = (s) => s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
      const emotes = [];
      for (let i = 0; i < words.length; i++) {
        const raw = words[i];
        const w = trimPunc(raw);
        if (!w || !emoteMap.has(w)) continue;
        const baseMeta = emoteMap.get(w);
        if (baseMeta && baseMeta.zeroWidth) {
          emotes.push(w);
          continue;
        }

        const modifiers = [];
        let j = i + 1;
        while (j < words.length) {
          const nextRaw = words[j];
          const nextToken = trimPunc(nextRaw);
          if (!nextToken || !emoteMap.has(nextToken)) break;
          const meta = emoteMap.get(nextToken);
          if (meta && meta.zeroWidth === true) {
            modifiers.push(nextToken);
            j++;
            continue;
          }
          break;
        }

        if (modifiers.length > 0) {
          emotes.push([w, ...modifiers].join("/"));
          i = j - 1;
        } else {
          emotes.push(w);
        }
      }

      const isSub =
        userstate.subscriber ||
        userstate.mod ||
        userstate.badges?.vip ||
        userstate.badges?.broadcaster;

      if (Math.random() * 100 < settings.battleEventChance) {
        if (
          (settings.battleEventAcceptPlebs || isSub) &&
          emotes.length > 0 &&
          settings.subEffectTypes.includes("battleEvent")
        ) {
          startBattle();
        }
      }

      const cmd = words[0].toLowerCase();
      const arg = words[1]?.toLowerCase();

      if (
        cmd === "!force" &&
        isMod &&
        settings.subEffectTypes.includes("battleEvent")
      ) {
        switch (arg) {
          case "battleevent":
            startBattle();
            break;
        }
      }
    }

    client.on("message", onMessage);
    return () => {
      client.off("message", onMessage);
    };
  }, [
    client,
    startBattle,
    emoteMap,
    settings.battleEventAcceptPlebs,
    settings.battleEventChance,
  ]);

  return (
    <>
      <div
        ref={sceneRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
      <svg
        id="effects-layer"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </>
  );
}
