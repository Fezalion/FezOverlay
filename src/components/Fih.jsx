import React, { useEffect, useRef, useState, useCallback } from "react";
import { usePhysicsEngine } from "../hooks/usePhysicsEngine";

import { useTwitchClient } from "../hooks/useTwitchClient";
import { useSubscriberTracker } from "../hooks/useSubscriberTracker";
import { useMetadata } from "../hooks/useMetadata";

import fih_idle from "../utils/fih/fih_still_frame_01.png";
import fih_swim_0 from "../utils/fih/fih_still_frame_02.png";
import fih_swim_1 from "../utils/fih/fih_still_frame_03.png";
import fih_swim_2 from "../utils/fih/fih_still_frame_04.png";
import fih_feed from "../utils/fih/feed.png";
import fih_stare from "../utils/fih/fih_stare.png";

const BASE_RADIUS = 10;

// Movement tuning
const MOVEMENT = {
  acceleration: 520,
  maxIdleSpeed: 95,
  maxChaseSpeed: 210,
  arriveDistance: 70,
  boundaryPadding: 110,
  boundaryForce: 900,
  actionMinMs: 7 * 1000,
  actionMaxMs: 18 * 1000,
  spinMinMs: 0.9 * 1000,
  spinMaxMs: 6 * 1000,
  stareMinMs: 0.2 * 1000,
  stareMaxMs: 6 * 1000,
  stareScaleChance: 0.2,
  stareScaleMin: 1.5,
  stareScaleMax: 5,
  teleportMinMs: 2 * 60 * 1000,
  teleportMaxMs: 5 * 60 * 1000,
  teleportChargeMs: 380,
  teleportReappearMs: 420,
};

const CLONES = {
  eatsPerClone: 3,
  max: 10,
  scale: 0.35,
  taper: 0.03,
  minTaperScale: 0.6,
  spacing: 16,
  anchorGap: 1.3,
  followRate: 6,
  followFalloff: 0.35,
  minFollowRate: 2.5,
  popInMs: 300,
  deathStaggerMs: 70,
  deathMs: 380,
};

const SPEECH_LINES = [
  "Hey @{user}, are you paying attention?",
  "I'm watching you, @{user}...",
  "Did someone say fish food? What about you, @{user}?",
  "Why is everyone staring at me? Especially @{user}.",
  "Glub glub... @{user} is acting sus af.",
  "Hey @{user}, fuck you in particular.",
  "Don't mind me, just fucking floating here judging @{user}.",
  "Plot twist: @{user} is actually a furry.",
  "Initializing staring contest with @{user}...",
  "Can someone feed me already? @{user}, you look extra sus today.",
  "Thank you @{user} for feeding me and my kids. I will remember this.",
  "Finally, some good fucking food. Thanks @{user}.",
  "This day was beautiful until @{user} showed up.",
];

const TAU = Math.PI * 2;
const SPIN_EASE_PORTION = 0.4;
const SPIN_FULL_PORTION = 1 - SPIN_EASE_PORTION;

function beginSpin(state, now) {
  const duration =
    MOVEMENT.spinMinMs +
    Math.random() * (MOVEMENT.spinMaxMs - MOVEMENT.spinMinMs);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const wantedSpeed = 3.5 + Math.random() * 3.5; // rad/s
  const areaFactor = SPIN_FULL_PORTION + SPIN_EASE_PORTION / 3;
  const turns = Math.max(
    1,
    Math.round((wantedSpeed * (duration / 1000) * areaFactor) / TAU),
  );

  state.mode = "spin";
  state.actionStartedAt = now;
  state.actionUntil = now + duration;
  state.spinDuration = duration;
  state.spinTotalAngle = dir * turns * TAU;
}

function spinAt(state, now) {
  const D = state.spinDuration || 1;
  const elapsed = Math.max(0, Math.min(D, now - state.actionStartedAt));
  const total = state.spinTotalAngle || 0;
  const omega = total / (D * (SPIN_FULL_PORTION + SPIN_EASE_PORTION / 3)); // rad/ms
  const tFull = D * SPIN_FULL_PORTION;
  const E = D * SPIN_EASE_PORTION;

  if (elapsed <= tFull) return { angle: omega * elapsed, speed: omega * 1000 };

  const s = 1 - (elapsed - tFull) / E;
  return {
    angle: omega * tFull + omega * (E / 3) * (1 - s * s * s),
    speed: omega * s * s * 1000,
  };
}

export default function FihOverlay() {
  const sceneRef = useRef(null);
  const fishCanvasRef = useRef(null);
  const fishRef = useRef(null);
  const subBodies = useRef(new Map());
  const facingRightRef = useRef(false);
  const gulpScaleRef = useRef(1);
  const isAlive = useRef(true);
  const spinFxRef = useRef({
    active: false,
    settling: false,
    angle: 0,
    vel: 0,
    dir: 1,
    target: 0,
  });
  const tiltRef = useRef(0);

  const movementRef = useRef({
    mode: "dart",
    target: null,
    actionUntil: performance.now() + randomBetween(800, 1500),
    actionStartedAt: 0,
    nextActionAt: performance.now() + randomBetween(5000, 10000),
    spinSpeed: 0,
    stareBlend: 0,
    stareScale: 1,
    teleportTarget: null,
    teleportPhase: null,
    teleportPhaseAt: 0,
    teleportCooldownAt: performance.now() + randomBetween(18000, 32000),
  });

  const visualFxRef = useRef({
    teleportAlpha: 1,
    teleportScale: 1,
    teleportFlash: 0,
    afterImages: [],
  });

  const fishSizeRef = useRef(1);

  // Clone chain
  const clonesRef = useRef([]);
  const eatCountRef = useRef(0);

  // Bubble tracking
  const bubblesRef = useRef([]);

  // Speech bubble states & refs
  const [activeSpeech, setActiveSpeech] = useState(null);
  const [fishPos, setFishPos] = useState({ x: 0, y: 0 });
  const recentSpeechIndices = useRef([]);
  const recentChatUsers = useRef([]);

  const [isDebug, setIsDebug] = useState(false);
  const [activeSubs, setActiveSubs] = useState([]);

  const { settings } = useMetadata();
  const client = useTwitchClient(settings.twitchName);
  const subscriberTracker = useSubscriberTracker(client, true);

  const idleTarget = useRef({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const rollStareScale = () =>
    Math.random() < MOVEMENT.stareScaleChance
      ? MOVEMENT.stareScaleMin +
        Math.random() * (MOVEMENT.stareScaleMax - MOVEMENT.stareScaleMin)
      : 1;

  const randomPoint = useCallback(() => {
    const p = MOVEMENT.boundaryPadding;
    return {
      x: p + Math.random() * Math.max(1, window.innerWidth - p * 2),
      y: p + Math.random() * Math.max(1, window.innerHeight - p * 2),
    };
  }, []);

  const pickFarPoint = useCallback(
    (fish) => {
      const current = fish?.translation();
      let point = randomPoint();

      for (let i = 0; current && i < 20; i++) {
        const dx = point.x - current.x;
        const dy = point.y - current.y;
        if (dx * dx + dy * dy > 300 * 300) break;
        point = randomPoint();
      }

      return point;
    },
    [randomPoint],
  );

  const scheduleNextIdleAction = useCallback((now) => {
    movementRef.current.nextActionAt =
      now + randomBetween(MOVEMENT.actionMinMs, MOVEMENT.actionMaxMs);
  }, []);

  const spawnClone = useCallback(() => {
    const fish = fishRef.current;
    if (!fish) return;

    const chain = clonesRef.current;
    const living = chain.filter((c) => !c.dying);
    if (living.length >= CLONES.max) return;

    const tail = living.length ? living[living.length - 1] : fish.translation();
    const now = performance.now();

    chain.push({
      x: tail.x,
      y: tail.y,
      facingRight: facingRightRef.current,
      spawnedAt: now,
      wobble: Math.random() * Math.PI * 2,
      dying: false,
      dieAt: 0,
      dieStartedAt: null,
      deathP: 0,
      dead: false,
    });

    for (let i = 0; i < 3; i++) {
      bubblesRef.current.push({
        x: tail.x + (Math.random() - 0.5) * 16,
        y: tail.y + (Math.random() - 0.5) * 16,
        text: Math.random() > 0.5 ? "o" : "O",
        opacity: 1,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -Math.random() * 0.8 - 0.3,
        size: 8 + Math.random() * 6,
      });
    }
  }, []);

  const killClones = useCallback((now) => {
    let order = 0;
    clonesRef.current.forEach((c) => {
      if (c.dying) return;
      c.dying = true;
      c.dieAt = now + order * CLONES.deathStaggerMs;
      order++;
    });
    eatCountRef.current = 0;
  }, []);

  const startTeleport = useCallback(
    (fish, now) => {
      const state = movementRef.current;
      state.mode = "teleport";
      state.teleportPhase = "charge";
      state.teleportPhaseAt = now;
      state.teleportTarget = pickFarPoint(fish);

      fish.setLinvel({ x: 0, y: 0 }, true);
    },
    [pickFarPoint],
  );

  const updateMovement = useCallback(
    (fish, now, dt) => {
      if (!fish) return;

      const state = movementRef.current;
      const fx = visualFxRef.current;
      const chasing = subBodies.current.size > 0;
      const pos = fish.translation();

      if (!chasing && state.mode === "teleport") {
        if (state.teleportPhase === "charge") {
          fish.setLinvel({ x: 0, y: 0 }, true);

          const elapsed = now - state.teleportPhaseAt;
          const t = Math.min(1, elapsed / MOVEMENT.teleportChargeMs);
          fx.teleportAlpha = 1 - t;
          fx.teleportScale = 1 + t * 0.45;

          if (elapsed >= MOVEMENT.teleportChargeMs) {
            const from = fish.translation();
            const to = state.teleportTarget || pickFarPoint(fish);

            fx.afterImages.push({
              x: from.x,
              y: from.y,
              life: 1,
              scale: fishSizeRef.current,
            });

            killClones(now);

            fish.setTranslation(to, true);

            state.teleportPhase = "reappear";
            state.teleportPhaseAt = now;
            fx.teleportAlpha = 0;
            fx.teleportScale = 0.75;
            fx.afterImages.push({
              x: to.x,
              y: to.y,
              life: 1,
              scale: fishSizeRef.current,
              isArrivalRing: true,
            });
          }
          return;
        }

        if (state.teleportPhase === "reappear") {
          fish.setLinvel({ x: 0, y: 0 }, true);

          const elapsed = now - state.teleportPhaseAt;
          const t = Math.min(1, elapsed / MOVEMENT.teleportReappearMs);

          fx.teleportAlpha = t;
          fx.teleportScale = 0.75 + t * 0.25;

          if (elapsed >= MOVEMENT.teleportReappearMs) {
            state.mode = "wander";
            state.teleportPhase = null;
            state.target = pickFarPoint(fish);
            state.teleportCooldownAt =
              now +
              randomBetween(MOVEMENT.teleportMinMs, MOVEMENT.teleportMaxMs);

            fx.teleportAlpha = 1;
            fx.teleportScale = 1;
            scheduleNextIdleAction(now);
          }
          return;
        }
      }

      if (chasing) {
        state.mode = "chase";
        state.stareBlend = 0;
        const firstSub = subBodies.current.values().next().value;
        if (firstSub) state.target = firstSub.translation();
      } else {
        if (
          now >= state.nextActionAt &&
          state.mode !== "spin" &&
          state.mode !== "dart" &&
          state.mode !== "stare"
        ) {
          const canTeleport = now >= state.teleportCooldownAt;
          const roll = Math.random();

          if (canTeleport && roll < 0.18) {
            startTeleport(fish, now);
            return;
          }

          if (roll < 0.42) {
            beginSpin(state, now);
            state.target = pickFarPoint(fish);
            return;
          }

          if (roll < 0.62) {
            state.mode = "stare";
            state.actionStartedAt = now;
            const duration = randomBetween(
              MOVEMENT.stareMinMs,
              MOVEMENT.stareMaxMs,
            );
            state.actionUntil = now + duration;
            state.stareDuration = duration;
            state.stareScale = rollStareScale();
            return;
          }

          if (roll < 0.82) {
            state.mode = "dart";
            state.actionUntil = now + randomBetween(500, 1000);
            state.target = pickFarPoint(fish);
          } else {
            state.mode = "wander";
            state.target = pickFarPoint(fish);
            scheduleNextIdleAction(now);
          }
        }

        if (state.mode === "spin" && now >= state.actionUntil) {
          state.mode = "wander";
          state.target = pickFarPoint(fish);
          scheduleNextIdleAction(now);
        }

        if (state.mode === "stare") {
          const duration = state.stareDuration || 1000;
          const remaining = Math.max(0, state.actionUntil - now);

          const elapsed = now - state.actionStartedAt;
          const fade = Math.min(150, duration / 2);
          state.stareBlend = Math.min(1, elapsed / fade, remaining / fade);

          if (now >= state.actionUntil) {
            state.stareBlend = 0;
            state.mode = "wander";
            state.target = pickFarPoint(fish);
            scheduleNextIdleAction(now);
          }
        }

        if (state.mode === "dart" && now >= state.actionUntil) {
          state.mode = "wander";
          state.target = pickFarPoint(fish);
          scheduleNextIdleAction(now);
        }
      }

      const target = state.target || idleTarget.current;
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);

      const sizeSlowdown = 1 + Math.max(0, fishSizeRef.current - 1) * 0.55;

      let desiredSpeed =
        (chasing ? MOVEMENT.maxChaseSpeed : MOVEMENT.maxIdleSpeed) /
        sizeSlowdown;

      if (state.mode === "dart") desiredSpeed *= 2.2;

      if (state.mode === "stare") desiredSpeed = 0;

      let desiredX = 0;
      let desiredY = 0;

      if (chasing) {
        if (dist > 0) {
          desiredX = (dx / dist) * desiredSpeed;
          desiredY = (dy / dist) * desiredSpeed;
        }
      } else if (dist > MOVEMENT.arriveDistance) {
        const nx = dx / dist;
        const ny = dy / dist;
        const arrival = Math.min(1, (dist - MOVEMENT.arriveDistance) / 180);

        desiredX = nx * desiredSpeed * arrival;
        desiredY = ny * desiredSpeed * arrival;
      }

      const p = MOVEMENT.boundaryPadding;

      if (pos.x < p) desiredX += MOVEMENT.boundaryForce * (1 - pos.x / p);
      if (pos.x > window.innerWidth - p)
        desiredX -=
          MOVEMENT.boundaryForce * ((pos.x - (window.innerWidth - p)) / p);
      if (pos.y < p) desiredY += MOVEMENT.boundaryForce * (1 - pos.y / p);
      if (pos.y > window.innerHeight - p)
        desiredY -=
          MOVEMENT.boundaryForce * ((pos.y - (window.innerHeight - p)) / p);

      const velocity = fish.linvel();
      const blend = 1 - Math.exp(-MOVEMENT.acceleration * dt);

      fish.setLinvel(
        {
          x: velocity.x + (desiredX - velocity.x) * blend,
          y: velocity.y + (desiredY - velocity.y) * blend,
        },
        true,
      );

      // Hard safety clamp.
      const next = fish.translation();
      const x = clamp(next.x, 25, Math.max(25, window.innerWidth - 25));
      const y = clamp(next.y, 25, Math.max(25, window.innerHeight - 25));

      if (x !== next.x || y !== next.y) {
        fish.setTranslation({ x, y }, true);

        const v = fish.linvel();
        fish.setLinvel(
          {
            x: x !== next.x ? -v.x * 0.25 : v.x,
            y: y !== next.y ? -v.y * 0.25 : v.y,
          },
          true,
        );
      }
    },
    [pickFarPoint, scheduleNextIdleAction, startTeleport, killClones],
  );

  const handlePhysicsStep = useCallback(
    (world) => {
      const fish = fishRef.current;
      if (!isAlive.current || !world || !fish) return;

      try {
        const fishTranslation = fish.translation();
        setFishPos({ x: fishTranslation.x, y: fishTranslation.y });

        const positions = Array.from(subBodies.current.values()).map((body) => {
          const pos = body.translation();
          return {
            id: body.handle,
            username: body.subscriberName,
            x: pos.x,
            y: pos.y,
            color: body.color,
          };
        });
        setActiveSubs(positions);

        const now = performance.now();
        const last = handlePhysicsStep.lastTime || now;
        const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
        handlePhysicsStep.lastTime = now;

        updateMovement(fish, now, dt);

        const velocity = fish.linvel();

        if (velocity.x > 0.1) facingRightRef.current = true;
        else if (velocity.x < -0.1) facingRightRef.current = false;

        const fishPos2 = fish.translation();
        const eatRadius = (BASE_RADIUS + 30) * fishSizeRef.current;
        const toEat = [];
        subBodies.current.forEach((sub) => {
          const subPos = sub.translation();
          const dx2 = subPos.x - fishPos2.x;
          const dy2 = subPos.y - fishPos2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist2 < eatRadius) toEat.push(sub);
        });

        toEat.forEach((sub) => {
          try {
            subBodies.current.delete(sub.handle);
            world.removeRigidBody(sub);

            eatCountRef.current += 1;
            if (eatCountRef.current >= CLONES.eatsPerClone) {
              eatCountRef.current = 0;
              spawnClone();
            }
            gulpScaleRef.current = 1.25;
            setTimeout(() => {
              gulpScaleRef.current = 1;
            }, 220);
          } catch (e) {
            console.warn("Collision cleanup error", e);
          }
        });
      } catch (error) {
        console.error("Manual physics step error:", error);
      }
    },
    [updateMovement, spawnClone],
  );

  const { engineRef } = usePhysicsEngine(handlePhysicsStep);

  const spawnSubBubble = useCallback(
    (name, color) => {
      const RAPIER = window.RAPIER;
      if (!RAPIER || !engineRef.current) return;

      const world = engineRef.current;
      const padding = 100;
      const minDistance = 400;
      const fish = fishRef.current;
      let x, y, dist;
      let attempts = 0;
      do {
        x = Math.random() * (window.innerWidth - padding * 2) + padding;
        y = Math.random() * (window.innerHeight - padding * 2) + padding;
        if (fish) {
          const fishPos = fish.translation();
          const dx = x - fishPos.x;
          const dy = y - fishPos.y;
          dist = Math.sqrt(dx * dx + dy * dy);
        } else {
          dist = minDistance + 1;
        }
        attempts++;
      } while (dist < minDistance && attempts < 15);

      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y);
      const body = world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.ball(20).setRestitution(0.8);
      world.createCollider(colliderDesc, body);

      body.subscriberName = name;
      body.color = color;
      subBodies.current.set(body.handle, body);
    },
    [engineRef],
  );

  const subscriberTrackerRef = useRef(subscriberTracker);
  useEffect(() => {
    subscriberTrackerRef.current = subscriberTracker;
  }, [subscriberTracker]);

  const getRandomUserAndColor = () => {
    let targetUser = "Chat";
    let userColor = "#ffcc00";

    const tracker = subscriberTrackerRef.current;
    if (tracker && tracker.getSubscriberCount() > 0) {
      const selected = tracker.getRandomSubscribers(1);
      if (selected && selected.length > 0) {
        targetUser = selected[0].username || selected[0].displayName || "Chat";
        userColor = selected[0].color || userColor;
      }
    } else if (recentChatUsers.current.length > 0) {
      targetUser =
        recentChatUsers.current[
          Math.floor(Math.random() * recentChatUsers.current.length)
        ];
    }
    return { targetUser, userColor };
  };

  const triggerSpeechEvent = useCallback(async () => {
    const fish = fishRef.current;
    if (!fish || !isAlive.current) return;

    let parts = [];
    let targetUser = "";
    let userColor = "#ffcc00";
    let fullTextLength = 0;

    let isJoke = Math.random() < 0.5;

    if (isJoke) {
      try {
        const response = await fetch(
          "https://v2.jokeapi.dev/joke/Programming,Miscellaneous,Pun,Spooky,Christmas?blacklistFlags=racist&type=single"
        );
        const data = await response.json();
        const jokeText =
          data.joke || "Why did the fish cross the road? To get away from chat!";

        const { targetUser: u, userColor: c } = getRandomUserAndColor();
        targetUser = u;
        userColor = c;

        const formattedJoke = `${jokeText}`;
        fullTextLength = formattedJoke.length;
      } catch (err) {
        isJoke = false;
      }
    }

    if (!isJoke) {
      let availableIndices = [];
      for (let i = 0; i < SPEECH_LINES.length; i++) {
        if (!recentSpeechIndices.current.includes(i)) {
          availableIndices.push(i);
        }
      }
      if (availableIndices.length === 0) {
        recentSpeechIndices.current = [];
        availableIndices = SPEECH_LINES.map((_, i) => i);
      }
      const chosenIndex =
        availableIndices[Math.floor(Math.random() * availableIndices.length)];
      recentSpeechIndices.current.push(chosenIndex);
      if (recentSpeechIndices.current.length > 5) {
        recentSpeechIndices.current.shift();
      }

      const { targetUser: u, userColor: c } = getRandomUserAndColor();
      targetUser = u;
      userColor = c;

      const template = SPEECH_LINES[chosenIndex];
      parts = template.split("@{user}");
      fullTextLength = template.replace("{user}", targetUser).length;
    }

    const durationMs = clamp(fullTextLength * 150, 5000, 15000);

    const state = movementRef.current;
    const now = performance.now();
    state.mode = "stare";
    state.actionStartedAt = now;
    state.actionUntil = now + durationMs;
    state.stareDuration = durationMs;
    state.stareScale = rollStareScale();

    setActiveSpeech({
      parts,
      username: targetUser,
      userColor,
      textLength: fullTextLength,
    });

    setTimeout(() => {
      setActiveSpeech(null);
    }, durationMs);
  }, []);

  useEffect(() => {
    let speechTimer;

    const scheduleNext = () => {
      const intervalMs = randomBetween(30, 120) * 1000;
      speechTimer = setTimeout(() => {
        triggerSpeechEvent();
        scheduleNext();
      }, intervalMs);
    };

    scheduleNext();
    return () => clearTimeout(speechTimer);
  }, [triggerSpeechEvent]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " || e.code === "Space") setIsDebug((prev) => !prev);
      if (e.key === "a") spawnSubBubble("fih", "red");
      if (e.key === "c") spawnClone();

      if (e.key === "v" || e.key === "V") {
        triggerSpeechEvent();
      }

      const fish = fishRef.current;
      const state = movementRef.current;
      const now = performance.now();

      if (e.key === "s") {
        beginSpin(state, now);
      }

      if (e.key === "d" && fish) {
        state.mode = "dart";
        state.actionUntil = now + randomBetween(500, 1000);
        state.target = pickFarPoint(fish);
      }

      if (e.key === "g") {
        state.mode = "stare";
        state.actionStartedAt = now;
        const duration = randomBetween(
          MOVEMENT.stareMinMs,
          MOVEMENT.stareMaxMs,
        );
        state.actionUntil = now + duration;
        state.stareDuration = duration;
        state.stareScale = rollStareScale();
      }

      if (e.key === "t" && fish) {
        startTeleport(fish, now);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    spawnSubBubble,
    pickFarPoint,
    startTeleport,
    spawnClone,
    triggerSpeechEvent,
  ]);

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const nextSpawnTime = useRef(
    Date.now() + randomBetween(1000 * 10, 1000 * 120),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now < nextSpawnTime.current) return;
      const available = subscriberTrackerRef.current.getSubscriberCount();
      if (available >= 1) {
        const selected = subscriberTrackerRef.current.getRandomSubscribers(1);
        if (selected?.length > 0) {
          const name = selected[0].username || selected[0].displayName;
          spawnSubBubble(name, selected[0]?.color ?? "white");
          nextSpawnTime.current =
            Date.now() + randomBetween(1000 * 10, 1000 * 120);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [spawnSubBubble]);

  useEffect(() => {
    if (!client) return;

    const handleMessage = (channel, userstate, message, self) => {
      const username = userstate["display-name"] || userstate["username"];
      if (username && !recentChatUsers.current.includes(username)) {
        recentChatUsers.current.push(username);
        if (recentChatUsers.current.length > 20) recentChatUsers.current.shift();
      }

      if (userstate["custom-reward-id"] === settings.redeemFeed) {
        const tracker = subscriberTrackerRef.current;
        if (!tracker) return;
        const available = tracker.getSubscriberCount();
        const spawnCount = Math.min(available, 5);
        if (spawnCount > 0) {
          const selectedSubscribers = tracker.getRandomSubscribers(spawnCount);
          selectedSubscribers.forEach((sub, index) => {
            setTimeout(() => {
              const name = sub.username || sub.displayName;
              spawnSubBubble(name, sub?.color ?? "white");
            }, index * 1000);
          });
          nextSpawnTime.current =
            Date.now() + randomBetween(1000 * 10, 1000 * 120);
        }
      }
    };
    client.on("message", handleMessage);
    return () => client.removeListener("message", handleMessage);
  }, [client, spawnSubBubble, settings.redeemFeed]);

  useEffect(() => {
    const RAPIER = window.RAPIER;
    if (!RAPIER || !engineRef.current) return;

    const world = engineRef.current;
    const padding = 0.2;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        (Math.random() * (1 - padding * 2) + padding) * window.innerWidth,
        (Math.random() * (1 - padding * 2) + padding) * window.innerHeight,
      )
      .setLinearDamping(0.03);
    const fish = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball(BASE_RADIUS);
    world.createCollider(colliderDesc, fish);
    fishRef.current = fish;
    movementRef.current.target = pickFarPoint(fish);

    const fishCanvas = fishCanvasRef.current;
    const fishCtx = fishCanvas.getContext("2d");
    const fishFrameSrcs = [fih_idle, fih_swim_0, fih_swim_1, fih_swim_2];
    const fishImages = fishFrameSrcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    const stareImg = new Image();
    stareImg.src = fih_stare;
    const feedImg = new Image();
    feedImg.src = fih_feed;

    const handleResize = () => {
      fishCanvas.width = window.innerWidth;
      fishCanvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    let animFrame;
    let lastFrameTime = performance.now();

    const drawFish = () => {
      if (!isAlive.current) return;
      const now = performance.now();
      const dtMs = now - lastFrameTime;
      lastFrameTime = now;

      const currentFish = fishRef.current;
      fishCtx.clearRect(0, 0, fishCanvas.width, fishCanvas.height);

      // Render Bubbles
      bubblesRef.current.forEach((b) => {
        b.x += b.vx;
        b.y += b.vy;
        b.opacity -= 0.005;
        fishCtx.save();
        fishCtx.globalAlpha = Math.max(0, b.opacity);
        fishCtx.fillStyle = "white";
        fishCtx.font = `bold ${b.size}px monospace`;
        fishCtx.fillText(b.text, b.x, b.y);
        fishCtx.restore();
      });
      bubblesRef.current = bubblesRef.current.filter((b) => b.opacity > 0);

      const fx = visualFxRef.current;

      fx.afterImages.forEach((ghost) => {
        ghost.life -= dtMs / 280;

        fishCtx.save();
        fishCtx.translate(ghost.x, ghost.y);

        if (ghost.isArrivalRing) {
          const expandRadius =
            BASE_RADIUS * ghost.scale * (1 + (1 - ghost.life) * 3.5);
          fishCtx.globalAlpha = Math.max(0, ghost.life);
          fishCtx.beginPath();
          fishCtx.arc(0, 0, expandRadius, 0, Math.PI * 2);
          fishCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          fishCtx.lineWidth = 3 * ghost.life;
          fishCtx.stroke();
        } else {
          fishCtx.globalAlpha = Math.max(0, ghost.life) * 0.4;
          fishCtx.beginPath();
          fishCtx.arc(0, 0, BASE_RADIUS * ghost.scale * 1.2, 0, Math.PI * 2);
          fishCtx.strokeStyle = "white";
          fishCtx.lineWidth = 2;
          fishCtx.stroke();
        }

        fishCtx.restore();
      });

      fx.afterImages = fx.afterImages.filter((ghost) => ghost.life > 0);

      const dtSec = dtMs / 1000;
      const moveState = movementRef.current;
      const spinFx = spinFxRef.current;

      if (moveState.mode === "spin") {
        const { angle, speed } = spinAt(moveState, now);
        spinFx.active = true;
        spinFx.settling = false;
        spinFx.angle = angle;
        spinFx.vel = speed;
        spinFx.dir = Math.sign(moveState.spinTotalAngle) || 1;
      } else if (spinFx.active) {
        spinFx.active = false;
        const dir = spinFx.dir;
        let target =
          dir > 0
            ? Math.ceil(spinFx.angle / TAU - 1e-4) * TAU
            : Math.floor(spinFx.angle / TAU + 1e-4) * TAU;
        if ((target - spinFx.angle) * dir < Math.abs(spinFx.vel) * 0.35) {
          target += dir * TAU;
        }

        if (Math.abs(target - spinFx.angle) < 0.02) {
          spinFx.angle = 0;
          spinFx.vel = 0;
        } else {
          spinFx.target = target;
          spinFx.settling = true;
        }
      }

      if (spinFx.settling) {
        const k = 50;
        const c = 2 * Math.sqrt(k);
        const sdt = Math.min(dtSec, 0.033);
        spinFx.vel += (k * (spinFx.target - spinFx.angle) - c * spinFx.vel) * sdt;
        spinFx.angle += spinFx.vel * sdt;

        if (
          Math.abs(spinFx.target - spinFx.angle) < 0.01 &&
          Math.abs(spinFx.vel) < 0.1
        ) {
          spinFx.settling = false;
          spinFx.angle = 0;
          spinFx.vel = 0;
        }
      }

      const spinAngle = spinFx.active || spinFx.settling ? spinFx.angle : 0;

      if (currentFish) {        
        const v = currentFish.linvel();
        const sp = Math.hypot(v.x, v.y);
        let targetTilt = 0;
        if (moveState.mode === "chase" && sp > 8) {
          const dir = facingRightRef.current ? 1 : -1;
          targetTilt = Math.atan2(v.y * dir, Math.max(Math.abs(v.x), 1e-3));
        }
        tiltRef.current +=
          (targetTilt - tiltRef.current) * (1 - Math.exp(-10 * dtSec));
      }

      if (currentFish) {
        const fishPos0 = currentFish.translation();
        const chain = clonesRef.current;

        let leader = fishPos0;
        let leaderIsFish = true;
        let linkIndex = 0;

        chain.forEach((c) => {
          const prevX = c.x;
          const prevY = c.y;

          if (!c.dying) {            
            const gap = leaderIsFish
              ? BASE_RADIUS * fishSizeRef.current * CLONES.anchorGap +
                CLONES.spacing
              : CLONES.spacing;
            const dx = leader.x - c.x;
            const dy = leader.y - c.y;
            const dist = Math.hypot(dx, dy) || 0.001;

            let tx = c.x;
            let ty = c.y;
            if (dist > gap) {
              tx = leader.x - (dx / dist) * gap;
              ty = leader.y - (dy / dist) * gap;
            }

            const rate = Math.max(
              CLONES.minFollowRate,
              CLONES.followRate - linkIndex * CLONES.followFalloff,
            );
            const k = 1 - Math.exp(-rate * dtSec);
            c.x += (tx - c.x) * k;
            c.y += (ty - c.y) * k;

            c.linkIndex = linkIndex;
            leader = c;
            leaderIsFish = false;
            linkIndex++;
          }

          const vx = c.x - prevX;
          const vy = c.y - prevY;
          c.moving = Math.hypot(vx, vy) / Math.max(dtSec, 0.001) > 8;
          if (vx > 0.05) c.facingRight = true;
          else if (vx < -0.05) c.facingRight = false;

          let targetTilt = 0;
          if (!c.dying && c.moving) {
            const dir = c.facingRight ? 1 : -1;
            targetTilt = Math.atan2(vy * dir, Math.max(Math.abs(vx), 1e-3));
          }
          c.tilt = (c.tilt || 0) + (targetTilt - (c.tilt || 0)) * (1 - Math.exp(-10 * dtSec));

          if (c.dying && now >= c.dieAt) {
            if (c.dieStartedAt === null) {
              c.dieStartedAt = now;
              fx.afterImages.push({
                x: c.x,
                y: c.y,
                life: 1,
                scale: CLONES.scale * 2,
                isArrivalRing: true,
              });
              for (let i = 0; i < 3; i++) {
                bubblesRef.current.push({
                  x: c.x + (Math.random() - 0.5) * 12,
                  y: c.y + (Math.random() - 0.5) * 12,
                  text: Math.random() > 0.5 ? "o" : "O",
                  opacity: 1,
                  vx: (Math.random() - 0.5) * 0.8,
                  vy: -Math.random() * 0.9 - 0.3,
                  size: 8 + Math.random() * 6,
                });
              }
            }
            c.deathP = Math.min(1, (now - c.dieStartedAt) / CLONES.deathMs);
            if (c.deathP >= 1) c.dead = true;
          }
        });

        clonesRef.current = chain.filter((c) => !c.dead);

        for (let i = clonesRef.current.length - 1; i >= 0; i--) {
          const c = clonesRef.current[i];
          const frameIndex = c.moving
            ? 1 + (Math.floor(now / 150 + c.wobble * 2) % 3)
            : 0;
          const img = fishImages[frameIndex];
          const baseW = img.naturalWidth || 80;
          const baseH = img.naturalHeight || 80;

          const taper = Math.max(
            CLONES.minTaperScale,
            1 - (c.linkIndex || 0) * CLONES.taper,
          );
          const t = Math.min(1, (now - c.spawnedAt) / CLONES.popInMs);
          const back = 1.70158;
          const popScale =
            1 + (back + 1) * Math.pow(t - 1, 3) + back * Math.pow(t - 1, 2);
          const deathScale = 1 - c.deathP * c.deathP;

          const s = CLONES.scale * taper * popScale * deathScale;
          const w = baseW * s;
          const h = baseH * s;
          const bob = Math.sin(now / 300 + c.wobble) * 2;

          fishCtx.save();
          fishCtx.globalAlpha = 1 - c.deathP;
          fishCtx.translate(c.x, c.y + bob);
          fishCtx.rotate(c.deathP * 6 + spinAngle + (c.tilt || 0));
          if (c.facingRight) fishCtx.scale(-1, 1);
          fishCtx.drawImage(img, -w / 2, -h / 2, w, h);
          fishCtx.restore();
        }
      }

      // Draw the Fish
      if (currentFish) {
        const velocity = currentFish.linvel();
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        const isMoving = speed > 0.3;
        let frameIndex = 0;
        if (isMoving) frameIndex = 1 + (Math.floor(now / 150) % 3);
        const img = fishImages[frameIndex];
        const baseW = img.naturalWidth || 80;
        const baseH = img.naturalHeight || 80;
        const visualScale = fishSizeRef.current * gulpScaleRef.current;
        const w = baseW * visualScale;
        const h = baseH * visualScale;
        const fishPos = currentFish.translation();
        const movementState = movementRef.current;
        const visualFx = visualFxRef.current;

        const angle = currentFish.rotation() + tiltRef.current + spinAngle;

        fishCtx.save();
        fishCtx.globalAlpha = visualFx.teleportAlpha;
        fishCtx.translate(fishPos.x, fishPos.y);
        fishCtx.rotate(angle);
        fishCtx.scale(visualFx.teleportScale, visualFx.teleportScale);
        if (facingRightRef.current) fishCtx.scale(-1, 1);

        if (movementState.mode === "teleport") {
          fishCtx.shadowColor = "cyan";
          fishCtx.shadowBlur = 25 * visualFx.teleportScale;
        }

        const stareBlend =
          movementState.mode === "stare" ? movementState.stareBlend || 0 : 0;
        const baseAlpha = visualFx.teleportAlpha;

        fishCtx.globalAlpha = baseAlpha * (1 - stareBlend);
        fishCtx.drawImage(img, -w / 2, -h / 2, w, h);

        if (stareBlend > 0 && stareImg.complete) {
          const idleImg = fishImages[0];
          const refW = idleImg.naturalWidth || baseW;
          const refH = idleImg.naturalHeight || baseH;
          const stareW = stareImg.naturalWidth || refW;
          const stareH = stareImg.naturalHeight || refH;
          const fit = Math.min(refW / stareW, refH / stareH);
          const procScale =
            1 + ((movementState.stareScale || 1) - 1) * stareBlend;
          const sw = stareW * fit * visualScale * procScale;
          const sh = stareH * fit * visualScale * procScale;
          fishCtx.globalAlpha = baseAlpha * stareBlend;
          fishCtx.drawImage(stareImg, -sw / 2, -sh / 2, sw, sh);
        }
        fishCtx.restore();
      }

      subBodies.current.forEach((body) => {
        const pos = body.translation();
        const radius = 20;

        fishCtx.save();
        fishCtx.drawImage(
          feedImg,
          pos.x - radius,
          pos.y - radius,
          radius * 2,
          radius * 2,
        );
        fishCtx.restore();
      });

      animFrame = requestAnimationFrame(drawFish);
    };
    drawFish();

    return () => {
      isAlive.current = false;
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, [engineRef]);

  const maxBubbleWidth = 320;
  const safeX = clamp(
    fishPos.x,
    maxBubbleWidth / 2 + 10,
    window.innerWidth - maxBubbleWidth / 2 - 10,
  );
  const safeY = clamp(fishPos.y - 65, 80, window.innerHeight - 10);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div
        ref={sceneRef}
        style={{
          position: "absolute",
          inset: 0,
          outline: isDebug ? "10px solid red" : "none",
          outlineOffset: "-10px",
          backgroundColor: isDebug ? "rgba(0, 0, 0, 0.12)" : "transparent",
        }}
      />
      <canvas
        ref={fishCanvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Dynamic Following & Wrapped Speech Bubble Element */}
      {activeSpeech && (
        <div
          style={{
            position: "absolute",
            left: safeX,
            top: safeY,
            transform: "translate(-50%, -100%)",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            color: "#111",
            padding: "10px 14px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "bold",
            pointerEvents: "none",
            maxWidth: `${maxBubbleWidth}px`,
            width: "max-content",
            whiteSpace: "normal",
            wordBreak: "break-word",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            border: "2px solid #333",
            fontFamily: "monospace",
            zIndex: 100,
          }}
        >
          {activeSpeech.parts[0]}
          <span style={{ color: activeSpeech.userColor }}>
            @{activeSpeech.username}
          </span>
          {activeSpeech.parts[1]}

          {/* Speech bubble tail pointer pointing towards fish */}
          <div
            style={{
              content: '""',
              position: "absolute",
              bottom: "-7px",
              left: `${clamp(
                50 + ((fishPos.x - safeX) / maxBubbleWidth) * 100,
                15,
                85,
              )}%`,
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "7px solid #333",
            }}
          />
        </div>
      )}

      {activeSubs.map((sub) => (
        <div
          key={sub.id}
          style={{
            position: "absolute",
            left: sub.x,
            top: sub.y - 50,
            transform: "translateX(-50%)",
            color: sub.color ?? "#fff",
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "bold",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            border: `1px solid ${sub.color ?? "#fff"}`,
            fontFamily: "monospace",
          }}
        >
          {sub.username}
        </div>
      ))}
    </div>
  );
}