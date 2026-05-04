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

const BASE_RADIUS = 10;
const SIZE_PER_EAT = 0.12;
const MAX_SIZE = 4;
const DECAY_START_MS = 15000;
const DECAY_RATE = 0.00003;

export default function FihOverlay() {
  const sceneRef = useRef(null);
  const fishCanvasRef = useRef(null);
  const fishRef = useRef(null);
  const subBodies = useRef(new Map());
  const facingRightRef = useRef(false);
  const gulpScaleRef = useRef(1);
  const isAlive = useRef(true);

  const fishSizeRef = useRef(1);
  const lastEatTimeRef = useRef(null);

  // Bubble tracking
  const bubblesRef = useRef([]);
  const bubbleSpawnTimerRef = useRef(0);

  const [isDebug, setIsDebug] = useState(false);
  const [activeSubs, setActiveSubs] = useState([]);

  const { settings } = useMetadata();
  const clientRef = useTwitchClient(settings.twitchName);
  const subscriberTracker = useSubscriberTracker(clientRef.current, false);

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

      // 1. Update Physical Size
      const targetRadius = BASE_RADIUS * newSize;
      collider.setRadius(targetRadius);

      // 2. Exponential Damping
      // Base is 0.03. At MAX_SIZE (2.2), this reaches ~2.5, making it feel very sluggish.
      const intensity = 15;
      const dynamicDamping = 0.03 + Math.pow(newSize - 1, 1.5) * intensity;
      body.setLinearDamping(dynamicDamping);

      // 3. Instant Momentum Adjustment
      // When the fish grows, we slightly reduce current velocity to simulate "mass gain"
      const currentVel = body.linvel();
      const massBrake = 0.85; // Reduce current speed by 15% immediately upon eating
      body.setLinvel(
        { x: currentVel.x * massBrake, y: currentVel.y * massBrake },
        true,
      );
    } catch (e) {
      console.warn("applyPhysicsSize error", e);
    }
  }, []);

  const handlePhysicsStep = useCallback(
    (world) => {
      const fish = fishRef.current;
      if (!isAlive.current || !world || !fish) return;

      try {
        const positions = Array.from(subBodies.current.values()).map((body) => {
          const pos = body.translation();
          return {
            id: body.handle,
            name: body.subscriberName,
            x: pos.x,
            y: pos.y,
            color: body.color,
          };
        });
        setActiveSubs(positions);

        const chasing = subBodies.current.size > 0;
        let target = idleTarget.current;
        if (chasing) {
          const firstSub = subBodies.current.values().next().value;
          if (firstSub) target = firstSub.translation();
        }

        const fishPos = fish.translation();
        const dx = target.x - fishPos.x;
        const dy = target.y - fishPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
          const baseSpeed = chasing ? 180 : 80;
          const speed = baseSpeed / (1 + (fishSizeRef.current - 1) * 1.5);
          fish.setLinvel(
            { x: (dx / dist) * speed, y: (dy / dist) * speed },
            true,
          );
        } else {
          fish.setLinvel({ x: 0, y: 0 }, true);
        }

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
    [applyPhysicsSize],
  );

  // Initialize Physics Engine with our manual step handler
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spawnSubBubble]);

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
          const name = selected[0].name || selected[0].displayName;
          spawnSubBubble(name, selected.color);
          nextSpawnTime.current =
            Date.now() + randomBetween(1000 * 10, 1000 * 120);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [spawnSubBubble]);

  useEffect(() => {
    if (!clientRef.current) return;
    let localref = clientRef.current;
    const handleMessage = (channel, userstate, message, self) => {
      if (self) return;
      if (userstate["custom-reward-id"] === settings.redeemFeed) {
        const tracker = subscriberTrackerRef.current;
        if (!tracker) return;
        const available = tracker.getSubscriberCount();
        const spawnCount = Math.min(available, 5);
        if (spawnCount > 0) {
          const selectedSubscribers = tracker.getRandomSubscribers(spawnCount);
          selectedSubscribers.forEach((sub, index) => {
            setTimeout(() => {
              const name = sub.name || sub.displayName;
              spawnSubBubble(name);
            }, index * 1000);
          });
          nextSpawnTime.current =
            Date.now() + randomBetween(1000 * 10, 1000 * 120);
        }
      }
    };
    localref.on("message", handleMessage);
    return () => localref.removeListener("message", handleMessage);
  }, [settings, clientRef]);

  useEffect(() => {
    const moveIdlePoint = () => {
      const padding = 0.2;
      const minDistance = 300;
      const fish = fishRef.current;
      let newX, newY, dist;
      let attempts = 0;
      do {
        newX =
          (Math.random() * (1 - padding * 2) + padding) * window.innerWidth;
        newY =
          (Math.random() * (1 - padding * 2) + padding) * window.innerHeight;
        if (fish) {
          const pos = fish.translation();
          const dx = newX - pos.x;
          const dy = newY - pos.y;
          dist = Math.sqrt(dx * dx + dy * dy);
        } else {
          dist = minDistance + 1;
        }
        attempts++;
      } while (dist < minDistance && attempts < 10);
      idleTarget.current = { x: newX, y: newY };
    };
    const interval = setInterval(moveIdlePoint, 15000);
    return () => clearInterval(interval);
  }, []);

  // --- 2. THE VISUAL RENDERING LOOP (rAF) ---
  // Only handles drawing, decay, and visuals
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

    const fishCanvas = fishCanvasRef.current;
    const fishCtx = fishCanvas.getContext("2d");
    const fishFrameSrcs = [fih_idle, fih_swim_0, fih_swim_1, fih_swim_2];
    const fishImages = fishFrameSrcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
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
        fishCtx.fillStyle = "red";
        fishCtx.font = `bold ${b.size}px monospace`;
        fishCtx.fillText(b.text, b.x, b.y);
        fishCtx.restore();
      });
      bubblesRef.current = bubblesRef.current.filter((b) => b.opacity > 0);

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
        const angle = currentFish.rotation();

        fishCtx.save();
        fishCtx.translate(fishPos.x, fishPos.y);
        fishCtx.rotate(angle);
        if (facingRightRef.current) fishCtx.scale(-1, 1);
        fishCtx.drawImage(img, -w / 2, -h / 2, w, h);
        fishCtx.restore();
      }

      subBodies.current.forEach((body) => {
        const pos = body.translation();
        const radius = 20; // Matches ColliderDesc.ball(20)

        fishCtx.save();
        // Centering the image on the physics body position[cite: 5]
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
          {sub.name}
        </div>
      ))}
    </div>
  );
}
