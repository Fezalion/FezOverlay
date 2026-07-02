/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useCallback, useMemo } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { useTwitchClient } from "../hooks/useTwitchClient";
import { useEmoteLoader } from "../hooks/useEmoteLoader";
import { useSubscriberTracker } from "../hooks/useSubscriberTracker";
import { createEmoteElement } from "../utils/emoteEffects";

const SWEAR_WEIGHTS = {
  shit: 1,
  ass: 1,
  damn: 1,
  hell: 1,
  crap: 1,
  piss: 1,
  screwed: 1,
  bitch: 1.4,
  bastard: 1.3,
  dumbass: 1.4,
  fuck: 2,
  fucking: 2,
  motherfucker: 2.5,
  dickhead: 1.5,
  asshole: 1.5,
  pieceofshit: 2,
  garbage: 1.2,
  trash: 1.2,
};

const SWEAR_REGEX = new RegExp(
  `\\b(${Object.keys(SWEAR_WEIGHTS).join("|")})\\b`,
  "gi",
);

const TRASH_TALK_LINES = [
  "you fight like a bot with fucking packet loss",
  "my grandma has better reflexes than you",
  "is that your final form? what a joke, you look like a pieceofshit",
  "i've seen better combos from a fucking roomba",
  "you peaked during the tutorial, you absolute garbage bastard",
  "i could beat you with one hand, on mute and my eyes fucking closed",
  "your trash build is held together with pure hopium",
  "ggez was invented for a dickhead player exactly like you",
  "you already fucking lost, click leave game",
  "get your sorry ass out of my lobby right now",
  "shut your damn mouth and learn how to fight",
  "you're about to catch pure hell, you delusional bastard",
  "this is some real embarrassing shit right here",
  "what a crap, brainless excuse for a combo",
  "quit acting like such a whiny little bitch and fight",
  "you absolute bastard, take this right to your fucking face",
  "i'm about to piss all over your pathetic win streak",
  "you're completely screwed and your whole chat knows it",
  "dumbass move, that's gonna cost you the entire fucking match",
  "your ass is grass and i'm the damn lawnmower, dickhead",
  "shit talk won't save your sorry ass from this hit",
  "hell yeah, eat this you uninstalled bastard",
  "that's a whole lot of crap and zero fucking damage",
  "i don't even need to try against a literal garbage tier opponent",
  "un-fucking-install already, you're embarrassing yourself",
  "you call that an attack? adorable, you absolute asshole",
  "i've fought scarier loading screens, you complete dickhead",
  "you're a special kind of stupid if you thought that trash setup would work",
  "imagine being this fucking bad at the video game",
  "you're a motherfucker who doesn't even know how to bind keys",
  "sit the fuck down, you are absolute garbage",
  "i will personally escort your bitch ass back to the main menu",
  "your gameplay makes me want to vomit, you pieceofshit",
  "keep typing in chat while i rip your fucking health bar to shreds",
  "you're a walking, talking free win, you useless asshole",
];

const SMALL_CAPS = {
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
};

const toSmallCaps = (text) =>
  text
    .toLowerCase()
    .split("")
    .map((c) => SMALL_CAPS[c] || c)
    .join("");

let battle2StyleInjected = false;
function ensureBattle2Styles() {
  if (battle2StyleInjected || document.getElementById("battle2-style")) return;
  const style = document.createElement("style");
  style.id = "battle2-style";
  style.textContent = `
    @keyframes battle2Bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
    @keyframes battle2BubbleIn { 0% { opacity: 0; transform: scale(0.6) translateY(10px); } 60% { opacity: 1; transform: scale(1.05) translateY(-2px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes battle2Shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
  `;
  document.head.appendChild(style);
  battle2StyleInjected = true;
}

function getStageRect() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(vw, (vh * 16) / 9);
  const height = Math.min(vh, (vw * 9) / 16);
  return {
    width,
    height,
    left: (vw - width) / 2,
    top: (vh - height) / 2,
  };
}

export default function Battle2Overlay() {
  const sceneRef = useRef(null);
  const { settings } = useMetadata();

  const client = useTwitchClient(settings.twitchName);
  const emoteMap = useEmoteLoader(settings.emoteSetId, 0, {
    twitchName: settings.twitchName,
    enableBTTV: settings.enableBTTV,
    enableFFZ: settings.enableFFZ,
    includeTwitchChannelEmotes: settings.includeTwitchChannelEmotes,
  });
  const subscriberTracker = useSubscriberTracker(client, false, true);
  const viewerTracker = useSubscriberTracker(client, true, true);

  const battle2Settings = useMemo(
    () => ({
      enabled: settings.battle2EventEnabled ?? true,
      chance: settings.battle2EventChance ?? 100,
      hp: settings.battle2EventHp ?? 100,
      damagePerSwear: settings.battle2EventDamagePerSwear ?? 50,
      maxDuration: settings.battle2EventDuration ?? 30,
      turnInterval: settings.battle2EventTurnInterval ?? 4000,
      acceptPlebs:
        settings.battle2EventAcceptPlebs ??
        settings.battleEventAcceptPlebs ??
        false,
      twitchName: settings.twitchName,
    }),
    [settings],
  );

  const activeRef = useRef(null);
  const takeTurnRef = useRef(null);

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
      console.warn("Battle2: error posting leaderboard win:", e);
      return null;
    }
  }, []);

  const postBattleState = useCallback((active) => {
    try {
      fetch("/api/battle/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      }).catch(() => {});
    } catch (e) {
      console.debug("Battle2: failed to POST battle state:", e?.message || e);
    }
  }, []);

  // ------------------------------------------------------------------
  // Position Handling
  // ------------------------------------------------------------------
  const placeParticipant = useCallback((p) => {
    if (!p.el) return;
    p.el.style.transform = `translate(${p.x - p.sizeX / 2}px, ${p.y - p.sizeY / 2}px)`;
  }, []);

  const updateHealthBarVisual = useCallback((p) => {
    if (!p.healthFill) return;
    const pct = Math.max(0, p.hp / p.maxHp);
    p.healthFill.style.width = `${pct * 100}%`;
    p.healthFill.style.backgroundColor =
      pct > 0.6 ? "#00ff00" : pct > 0.3 ? "#ffff00" : "#ff0000";
  }, []);

  const showDamageFlyup = useCallback((x, y, damage, color = "#ff3b3b") => {
    const dmgEl = document.createElement("div");
    dmgEl.textContent = Math.floor(damage);
    dmgEl.style.position = "fixed";
    dmgEl.style.left = `${x}px`;
    dmgEl.style.top = `${y}px`;
    dmgEl.style.color = color;
    dmgEl.style.fontWeight = "bold";
    dmgEl.style.fontSize = "54px"; // Even bigger flyups to match text scaling
    dmgEl.style.pointerEvents = "none";
    dmgEl.style.textShadow = "3px 3px 5px rgba(0,0,0,0.9)";
    dmgEl.style.zIndex = "10003";
    dmgEl.style.transition = "transform 1.1s ease-out, opacity 1.1s ease-out";
    document.body.appendChild(dmgEl);

    const horizontal = (Math.random() - 0.5) * 60;
    requestAnimationFrame(() => {
      dmgEl.style.transform = `translate(${horizontal}px, -110px)`;
      dmgEl.style.opacity = "0";
    });
    setTimeout(() => dmgEl.remove(), 1100);
  }, []);

  const flashHit = useCallback((p) => {
    if (!p.el) return;
    const avatarImg = p.el.querySelector(".avatar");
    if (avatarImg) avatarImg.style.filter = "brightness(2) hue-rotate(180deg)";
    if (p.bobEl) {
      p.bobEl.style.animation = `battle2Bob 2.4s ease-in-out ${p.bobDelay} infinite, battle2Shake 0.3s ease-in-out`;
    }
    setTimeout(() => {
      if (avatarImg) avatarImg.style.filter = "";
      if (p.bobEl) {
        p.bobEl.style.animation = `battle2Bob 2.4s ease-in-out ${p.bobDelay} infinite`;
      }
    }, 300);
  }, []);

  const computeDamage = useCallback(
    (line) => {
      const matches = line.match(SWEAR_REGEX);
      if (!matches) return 0;
      const weightSum = matches.reduce(
        (sum, w) => sum + (SWEAR_WEIGHTS[w.toLowerCase()] || 1),
        0,
      );
      const factor = 0.85 + Math.random() * 0.4;
      return Math.round(weightSum * battle2Settings.damagePerSwear * factor);
    },
    [battle2Settings],
  );

  const cleanupParticipant = useCallback((p) => {
    if (!p) return;
    p.el?.remove();
  }, []);

  const dealSwearDamage = useCallback(
    (target, amount) => {
      target.hp = Math.max(0, target.hp - amount);
      updateHealthBarVisual(target);
      showDamageFlyup(
        target.x + (Math.random() - 0.5) * 60,
        target.y - 40,
        amount,
      );
      flashHit(target);
    },
    [updateHealthBarVisual, showDamageFlyup, flashHit],
  );

  const showSpeechBubble = useCallback((p, text) => {
    const highlighted = text.replace(
      SWEAR_REGEX,
      (m) =>
        `<span style="color:#ff5050;text-shadow:0 0 12px #ff5050;">${m}</span>`,
    );

    const bubble = document.createElement("div");
    bubble.dataset.battle2Bubble = "true";
    bubble.innerHTML = highlighted;
    bubble.style.position = "fixed";
    bubble.style.maxWidth = "850px";
    bubble.style.padding = "26px 40px";
    bubble.style.background = "#fff";
    bubble.style.color = "#111";
    bubble.style.fontWeight = "900";
    bubble.style.fontSize = "72px";
    bubble.style.lineHeight = "1.15";
    bubble.style.borderRadius = "44px";
    bubble.style.boxShadow = "0 12px 36px rgba(0,0,0,0.5)";
    bubble.style.zIndex = "10002";
    bubble.style.pointerEvents = "none";
    bubble.style.textAlign = "center";
    bubble.style.animation = "battle2BubbleIn 0.25s ease-out";
    document.body.appendChild(bubble);

    const tail = document.createElement("div");
    tail.style.position = "absolute";
    tail.style.bottom = "-24px";
    tail.style.left = p.isLeft ? "50px" : "auto";
    tail.style.right = p.isLeft ? "auto" : "50px";
    tail.style.width = "0";
    tail.style.height = "0";
    tail.style.borderLeft = "20px solid transparent";
    tail.style.borderRight = "20px solid transparent";
    tail.style.borderTop = "24px solid #fff";
    bubble.appendChild(tail);

    const bw = bubble.offsetWidth;
    const left = p.x - bw / 2 + (p.isLeft ? 60 : -60);
    const top = p.y - p.sizeY / 2 - 190;
    bubble.style.left = `${Math.max(20, left)}px`;
    bubble.style.top = `${Math.max(20, top)}px`;

    const lifespan = Math.min(5200, 2200 + text.length * 45);
    setTimeout(() => {
      bubble.style.transition = "opacity 0.4s ease-out";
      bubble.style.opacity = "0";
      setTimeout(() => bubble.remove(), 400);
    }, lifespan);

    if (p.el) {
      const base = `translate(${p.x - p.sizeX / 2}px, ${p.y - p.sizeY / 2}px)`;
      p.el.style.transition = "transform 0.2s ease-out";
      p.el.style.transform = `${base} scale(1.08)`;
      setTimeout(() => {
        if (p.el) p.el.style.transform = base;
      }, 220);
    }
  }, []);

  // ------------------------------------------------------------------
  // Participant creation
  // ------------------------------------------------------------------
  const createParticipant = useCallback(
    (subscriber, x, y, emoteName, id, isLeft) => {
      const emote = emoteMap.get(emoteName);
      if (!emote) {
        console.warn(`Battle2: no emote found for ${subscriber.name}`);
        return null;
      }

      const nominalHeight = 384;
      const aspect = emote?.width / emote?.height || 1;
      const sizeY = nominalHeight;
      const sizeX = nominalHeight * aspect;

      const container = document.createElement("div");
      container.classList.add("battle2-participant");
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = `${sizeX}px`;
      container.style.height = `${sizeY}px`;
      container.style.zIndex = "9999";
      container.style.pointerEvents = "none";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";

      const nameLabel = document.createElement("div");
      nameLabel.textContent = subscriber.name;
      nameLabel.style.cssText = `position: absolute; bottom: -150px; font-size: 120px; font-weight: 900; color: ${subscriber.color}; text-shadow: 3px 3px 4px rgba(0,0,0,0.95); text-align: center; white-space: nowrap; width: 400px; max-width: 500px;`;
      container.appendChild(nameLabel);

      const elImg = createEmoteElement(emote?.url, sizeX, sizeY);
      elImg.style.width = "100%";
      elImg.style.height = "100%";
      elImg.style.borderRadius = "50%";
      elImg.classList.add("avatar");

      const bobDelay = isLeft ? "0s" : "1.2s";
      const bobEl = document.createElement("div");
      bobEl.style.position = "relative";
      bobEl.style.width = "100%";
      bobEl.style.height = "100%";
      bobEl.style.borderRadius = "50%";
      bobEl.style.border = `6px solid ${subscriber.color}`;
      bobEl.style.boxShadow = `0 0 32px ${subscriber.color}`;
      bobEl.style.animation = `battle2Bob 2.4s ease-in-out ${bobDelay} infinite`;

      bobEl.appendChild(elImg);
      container.appendChild(bobEl);

      // Massive Health Bar positioned explicitly at the absolute BOTTOM layout stack
      const healthBar = document.createElement("div");
      healthBar.style.position = "absolute";
      healthBar.style.bottom = "-55px"; // Position directly beneath the avatar ring
      healthBar.style.width = "420px"; // Ultra-wide boss health bar look
      healthBar.style.height = "34px"; // Massive chunk arcade thickness
      healthBar.style.backgroundColor = "rgba(255, 0, 0, 0.35)";
      healthBar.style.border = "4px solid #000";
      healthBar.style.borderRadius = "12px";
      healthBar.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)";

      const healthFill = document.createElement("div");
      healthFill.style.width = "100%";
      healthFill.style.height = "100%";
      healthFill.style.backgroundColor = "#00ff00";
      healthFill.style.borderRadius = "6px";
      healthFill.style.transition =
        "width 0.3s ease, background-color 0.3s ease";

      healthBar.appendChild(healthFill);
      container.appendChild(healthBar);

      document.body.appendChild(container);

      const participant = {
        id,
        el: container,
        bobEl,
        bobDelay,
        healthBar,
        healthFill,
        nameLabel,
        x,
        y,
        sizeX,
        sizeY,
        hp: battle2Settings.hp,
        maxHp: battle2Settings.hp,
        subscriberName: subscriber.name,
        userColor: subscriber.color,
        isAlive: true,
        isLeft,
      };

      placeParticipant(participant);
      return participant;
    },
    [emoteMap, battle2Settings, placeParticipant],
  );

  const spawnDuo = useCallback(() => {
    const pool = battle2Settings.acceptPlebs
      ? viewerTracker
      : subscriberTracker;
    if (!pool) return null;

    const selected = pool.getRandomSubscribers(2);
    if (!selected || selected.length < 2) {
      console.log(
        "Battle2: not enough people in chat to start a duel (need 2)",
      );
      return null;
    }

    const availableEmotes = Array.from(emoteMap.keys()).filter((key) => {
      const e = emoteMap.get(key);
      return e?.width === e?.height;
    });
    if (availableEmotes.length === 0) {
      console.warn("Battle2: no emotes loaded yet, skipping duel");
      return null;
    }

    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/gi, "");
    const shuffled = [...availableEmotes].sort(() => Math.random() - 0.5);
    const usedEmotes = new Set();

    const pickEmote = (subscriber) => {
      const norm = normalize(subscriber.name);
      let emoteName = availableEmotes.find(
        (e) =>
          norm.length >= 3 && normalize(e).includes(norm) && !usedEmotes.has(e),
      );
      if (!emoteName) emoteName = shuffled.find((e) => !usedEmotes.has(e));
      if (!emoteName) emoteName = shuffled[0];
      usedEmotes.add(emoteName);
      return emoteName;
    };

    const { left: offsetX, top: offsetY, width, height } = getStageRect();

    // Position adjusted upward (0.45) to ensure massive health bar layouts stay safely on screen
    const y = offsetY + height * 0.45;
    const leftX = offsetX + width * 0.26;
    const rightX = offsetX + width * 0.74;

    const p1 = createParticipant(
      selected[0],
      leftX,
      y,
      pickEmote(selected[0]),
      `battle2_${selected[0].username || selected[0].name}_0`,
      true,
    );
    const p2 = createParticipant(
      selected[1],
      rightX,
      y,
      pickEmote(selected[1]),
      `battle2_${selected[1].username || selected[1].name}_1`,
      false,
    );

    if (!p1 || !p2) {
      if (p1) cleanupParticipant(p1);
      if (p2) cleanupParticipant(p2);
      return null;
    }

    return { p1, p2 };
  }, [
    battle2Settings,
    subscriberTracker,
    viewerTracker,
    emoteMap,
    createParticipant,
    cleanupParticipant,
  ]);

  // ------------------------------------------------------------------
  // Battle lifecycle
  // ------------------------------------------------------------------
  const endBattle2 = useCallback(
    async (winner, loser, draw = false) => {
      const battle = activeRef.current;
      if (!battle || battle.ended) return;
      battle.ended = true;
      if (battle.turnTimeout) clearTimeout(battle.turnTimeout);

      postBattleState(false);

      if (winner) {
        try {
          const result = await incrementLeaderboardWin(winner.subscriberName);
          if (result && typeof result.wins === "number") {
            winner.totalWins = result.wins;
          }
        } catch (e) {
          console.warn(
            "Battle2: failed to increment leaderboard for winner:",
            e,
          );
        }
      }

      setTimeout(() => {
        if (!client) return;
        if (draw) {
          client
            .say(
              battle2Settings.twitchName,
              `🏆 DRAW! they both talked themselves into a tie 🏆`,
            )
            .catch(() => {});
        } else if (winner) {
          const winsText = winner.totalWins
            ? ` (Wins: ${winner.totalWins})`
            : "";
          client
            .say(
              battle2Settings.twitchName,
              `🏆 ${toSmallCaps(winner.subscriberName)} CLAPPED BACK FOR THE WIN! 🏆${winsText}`,
            )
            .catch(() => {});
        }
      }, 800);

      [battle.p1, battle.p2].forEach((p) => {
        if (p?.el) {
          p.el.style.transition = "opacity 1s ease-out, transform 1s ease-out";
          p.el.style.opacity = "0";
        }
        if (p?.bobEl) p.bobEl.style.animation = "none";
      });

      setTimeout(() => {
        cleanupParticipant(battle.p1);
        cleanupParticipant(battle.p2);
        if (activeRef.current === battle) activeRef.current = null;
      }, 1500);
    },
    [
      client,
      battle2Settings,
      incrementLeaderboardWin,
      postBattleState,
      cleanupParticipant,
    ],
  );

  const takeTurn = useCallback(() => {
    const battle = activeRef.current;
    if (!battle || battle.ended) return;

    const elapsed = Date.now() - battle.startTime;
    if (elapsed > battle2Settings.maxDuration * 1000) {
      if (battle.p1.hp === battle.p2.hp) {
        endBattle2(null, null, true);
      } else {
        const winner = battle.p1.hp > battle.p2.hp ? battle.p1 : battle.p2;
        const loser = winner === battle.p1 ? battle.p2 : battle.p1;
        endBattle2(winner, loser);
      }
      return;
    }

    const speaker = battle.turn % 2 === 0 ? battle.p1 : battle.p2;
    const target = speaker === battle.p1 ? battle.p2 : battle.p1;
    battle.turn += 1;

    const line =
      TRASH_TALK_LINES[Math.floor(Math.random() * TRASH_TALK_LINES.length)];
    showSpeechBubble(speaker, line);

    const dmg = computeDamage(line);

    if (dmg > 0) {
      battle.turnTimeout = setTimeout(() => {
        dealSwearDamage(target, dmg);
        if (target.hp <= 0) {
          endBattle2(speaker, target);
          return;
        }
        battle.turnTimeout = setTimeout(
          () => takeTurnRef.current?.(),
          battle2Settings.turnInterval,
        );
      }, 600);
    } else {
      battle.turnTimeout = setTimeout(
        () => takeTurnRef.current?.(),
        battle2Settings.turnInterval,
      );
    }
  }, [
    battle2Settings,
    showSpeechBubble,
    computeDamage,
    dealSwearDamage,
    endBattle2,
  ]);

  useEffect(() => {
    takeTurnRef.current = takeTurn;
  }, [takeTurn]);

  const startBattle2 = useCallback(() => {
    if (activeRef.current) return false;

    const duo = spawnDuo();
    if (!duo) return false;

    ensureBattle2Styles();
    postBattleState(true);

    activeRef.current = {
      p1: duo.p1,
      p2: duo.p2,
      startTime: Date.now(),
      turn: 0,
      turnTimeout: null,
      ended: false,
    };

    activeRef.current.turnTimeout = setTimeout(
      () => takeTurnRef.current?.(),
      900,
    );
    return true;
  }, [spawnDuo, postBattleState]);

  useEffect(() => {
    return () => {
      const battle = activeRef.current;
      if (battle) {
        if (battle.turnTimeout) clearTimeout(battle.turnTimeout);
        cleanupParticipant(battle.p1);
        cleanupParticipant(battle.p2);
        activeRef.current = null;
      }
      document
        .querySelectorAll('[data-battle2-bubble="true"]')
        .forEach((b) => b.remove());
    };
  }, [cleanupParticipant]);

  useEffect(() => {
    if (!client || !battle2Settings.enabled) return;

    function onMessage(channel, userstate, message) {
      const isMod = userstate.mod || userstate.badges?.broadcaster;
      const words = message.split(/\s+/);
      const trimPunc = (s) => s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
      const hasEmote = words.some((w) => emoteMap.has(trimPunc(w)));

      const isSub =
        userstate.subscriber ||
        userstate.mod ||
        userstate.badges?.vip ||
        userstate.badges?.broadcaster;

      if (Math.random() * 100 < battle2Settings.chance) {
        if ((battle2Settings.acceptPlebs || isSub) && hasEmote) {
          startBattle2();
        }
      }

      const cmd = words[0]?.toLowerCase();
      const arg = words[1]?.toLowerCase();
      if (cmd === "!force" && isMod && arg === "battle2event") {
        startBattle2();
      }
    }

    client.on("message", onMessage);
    return () => client.off("message", onMessage);
  }, [
    client,
    emoteMap,
    battle2Settings.enabled,
    battle2Settings.chance,
    battle2Settings.acceptPlebs,
    startBattle2,
  ]);

  return (
    <div
      ref={sceneRef}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(100vw, calc(100vh * 16 / 9))",
        height: "min(100vh, calc(100vw * 9 / 16))",
        aspectRatio: "16 / 9",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
