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
const SIZE_PER_EAT = 0.12;
const MAX_SIZE = 4;
const DECAY_START_MS = 15000;
const DECAY_RATE = 0.00003;

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

export default function FihOverlay() {
  const sceneRef = useRef(null);
  const fishCanvasRef = useRef(null);
  const fishRef = useRef(null);
  const subBodies = useRef(new Map());
  const facingRightRef = useRef(false);
  const gulpScaleRef = useRef(1);
  const isAlive = useRef(true);
  const spinAngleRef = useRef(0);

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
  const lastEatTimeRef = useRef(null);

  // Bubble tracking
  const bubblesRef = useRef([]);
  const bubbleSpawnTimerRef = useRef(0);

  const [isDebug, setIsDebug] = useState(false);
  const [activeSubs, setActiveSubs] = useState([]);

  const { settings } = useMetadata();
  const client = useTwitchClient(settings.twitchName);
  const subscriberTracker = useSubscriberTracker(client, true);

  const idleTarget = useRef({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
  });

  const applyPhysicsSize = useCallback((body, newSize) => {
    const world = engineRef.current;
    if (!world || !body) return;
    try {
      const colliderHandle = body.collider(0);
      if (colliderHandle === undefined || colliderHandle === null) return;
      const collider = world.getCollider(colliderHandle);
      if (!collider) return;

      const targetRadius = BASE_RADIUS * newSize;
      collider.setRadius(targetRadius);

      const intensity = 15;
      const dynamicDamping = 0.03 + Math.pow(newSize - 1, 1.5) * intensity;
      body.setLinearDamping(dynamicDamping);

      const currentVel = body.linvel();
      const massBrake = 0.85;
      body.setLinvel(
        { x: currentVel.x * massBrake, y: currentVel.y * massBrake },
        true,
      );
    } catch (e) {
      console.warn("applyPhysicsSize error", e);
    }
  }, []);

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
            state.mode = "spin";
            state.actionStartedAt = now;
            const duration = randomBetween(
              MOVEMENT.spinMinMs,
              MOVEMENT.spinMaxMs,
            );
            state.actionUntil = now + duration;
            state.spinDuration = duration;
            state.baseSpinSpeed =
              (3.5 + Math.random() * 3.5) * (Math.random() < 0.5 ? -1 : 1);
            state.spinSpeed = state.baseSpinSpeed;
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

        if (state.mode === "spin") {
          const duration = state.spinDuration || 1500;
          const remaining = Math.max(0, state.actionUntil - now);

          const spinFactor = Math.min(1, remaining / (duration * 0.4));
          state.spinSpeed =
            (state.baseSpinSpeed || 5) * Math.pow(spinFactor, 2);

          if (now >= state.actionUntil) {
            state.mode = "wander";
            state.target = pickFarPoint(fish);
            scheduleNextIdleAction(now);
          }
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
    [pickFarPoint, scheduleNextIdleAction, startTeleport],
  );

  const handlePhysicsStep = useCallback(
    (world) => {
      const fish = fishRef.current;
      if (!isAlive.current || !world || !fish) return;

      try {
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

        // Face the correct direction based on horizontal movement
        if (velocity.x > 0.1) facingRightRef.current = true;
        else if (velocity.x < -0.1) facingRightRef.current = false;

        // Distance-based collision detection

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

            fishSizeRef.current = Math.min(
              MAX_SIZE,
              fishSizeRef.current + SIZE_PER_EAT,
            );
            lastEatTimeRef.current = Date.now();
            applyPhysicsSize(fish, fishSizeRef.current);

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
    [applyPhysicsSize, updateMovement],
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

  // Debug toggle and spawn test
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " || e.code === "Space") setIsDebug((prev) => !prev);
      if (e.key === "a") spawnSubBubble("fih", "red");

      const fish = fishRef.current;
      const state = movementRef.current;
      const now = performance.now();

      // Trigger Spin Event
      if (e.key === "s") {
        state.mode = "spin";
        state.actionStartedAt = now;
        state.actionUntil =
          now + randomBetween(MOVEMENT.spinMinMs, MOVEMENT.spinMaxMs);
        state.spinSpeed =
          (3.5 + Math.random() * 3.5) * (Math.random() < 0.5 ? -1 : 1);
        if (fish) fish.setLinvel({ x: 0, y: 0 }, true);
      }

      // Trigger Dart Event
      if (e.key === "d" && fish) {
        state.mode = "dart";
        state.actionUntil = now + randomBetween(500, 1000);
        state.target = pickFarPoint(fish);
      }

      // Trigger Stare Event
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

      // Trigger Teleport Event
      if (e.key === "t" && fish) {
        startTeleport(fish, now);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spawnSubBubble, pickFarPoint, startTeleport]);

  const subscriberTrackerRef = useRef(subscriberTracker);
  useEffect(() => {
    subscriberTrackerRef.current = subscriberTracker;
  }, [subscriberTracker]);

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
      console.log(settings.redeemFeed);
      console.log(userstate);
      console.log(userstate["custom-reward-id"] === settings.redeemFeed);
      if (userstate["custom-reward-id"] === settings.redeemFeed) {
        const tracker = subscriberTrackerRef.current;
        if (!tracker) return;
        console.log("we passed tracker check");
        const available = tracker.getSubscriberCount();
        const spawnCount = Math.min(available, 5);
        console.log("spawncount:", spawnCount);
        if (spawnCount > 0) {
          const selectedSubscribers = tracker.getRandomSubscribers(spawnCount);
          console.log("selected subs:", selectedSubscribers);
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
    // Create the fish body
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

      // Size decay and bubble spawning
      const lastEat = lastEatTimeRef.current;
      if (lastEat !== null && currentFish) {
        const msSinceEat = Date.now() - lastEat;
        if (msSinceEat > DECAY_START_MS && fishSizeRef.current > 1) {
          const prevSize = fishSizeRef.current;
          fishSizeRef.current = Math.max(
            1,
            fishSizeRef.current - DECAY_RATE * dtMs,
          );

          if (Math.abs(prevSize - fishSizeRef.current) > 0.001) {
            applyPhysicsSize(currentFish, fishSizeRef.current);
          }

          bubbleSpawnTimerRef.current += dtMs;
          if (bubbleSpawnTimerRef.current > 200) {
            bubbleSpawnTimerRef.current = 0;
            const angle = currentFish.rotation();
            const fishPos = currentFish.translation();
            const spawnDist = BASE_RADIUS * fishSizeRef.current;
            const directionMod = facingRightRef.current ? -1 : 1;

            bubblesRef.current.push({
              x: fishPos.x + Math.cos(angle) * spawnDist * directionMod,
              y: fishPos.y + Math.sin(angle) * spawnDist,
              text: Math.random() > 0.5 ? "o" : "O",
              opacity: 1,
              vx: (Math.random() - 0.5) * 0.4,
              vy: -Math.random() * 0.8 - 0.3,
              size: 12 + Math.random() * 8,
            });
          }
        }
      }

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
        const progress = 1 - Math.max(0, ghost.life);

        fishCtx.save();
        fishCtx.translate(ghost.x, ghost.y);

        if (ghost.isArrivalRing) {
          // Local shockwave ring expanding outwards from the fish
          const expandRadius = BASE_RADIUS * ghost.scale * (1 + progress * 3.5);
          fishCtx.globalAlpha = Math.max(0, ghost.life);
          fishCtx.beginPath();
          fishCtx.arc(0, 0, expandRadius, 0, Math.PI * 2);
          fishCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          fishCtx.lineWidth = 3 * ghost.life;
          fishCtx.stroke();
        } else {
          // Departure ghost outline
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

        let angle = currentFish.rotation();
        if (movementState.mode === "spin") {
          spinAngleRef.current += (movementState.spinSpeed * dtMs) / 1000;
          angle += spinAngleRef.current;
        } else {
          spinAngleRef.current = 0;
        }

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

        // Swim/idle sprite fades out as the stare sprite fades in.
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
  }, [engineRef, applyPhysicsSize]);

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
