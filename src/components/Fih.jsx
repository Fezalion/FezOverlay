import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";

import { useTwitchClient } from "../hooks/useTwitchClient";
import { useSubscriberTracker } from "../hooks/useSubscriberTracker";
import { useMetadata } from "../hooks/useMetadata";

import fih_idle from "../utils/fih/fih_still_frame_01.png";
import fih_swim_0 from "../utils/fih/fih_still_frame_02.png";
import fih_swim_1 from "../utils/fih/fih_still_frame_03.png";
import fih_swim_2 from "../utils/fih/fih_still_frame_04.png";
import fih_feed from "../utils/fih/feed.png";

// ─── Size / Hunger constants ───────────────────────────────────────────────
const BASE_RADIUS = 40; // physics body radius at size 1
const SIZE_PER_EAT = 0.18; // how much fih grows each meal
const MAX_SIZE = 2.2; // cap on size multiplier
const DECAY_START_MS = 15000; // ms after last meal before shrinking begins
const DECAY_RATE = 0.00003; // shrink per ms while decaying (per-frame)
// ──────────────────────────────────────────────────────────────────────────

export default function FihOverlay() {
  const sceneRef = useRef(null);
  const fishCanvasRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create());
  const fishRef = useRef(null);
  const subBodies = useRef(new Map());
  const wallsRef = useRef([]);
  const facingRightRef = useRef(false);
  const gulpScaleRef = useRef(1); // for gulp effect on custom canvas

  // ── size state ────────────────────────────────────────────────────────────
  const fishSizeRef = useRef(1); // current visual + physics scale
  const lastEatTimeRef = useRef(null); // timestamp of last meal (null = never)
  // ─────────────────────────────────────────────────────────────────────────

  const [isDebug, setIsDebug] = useState(false);
  const [activeSubs, setActiveSubs] = useState([]);

  const { settings } = useMetadata();
  const clientRef = useTwitchClient(settings.twitchName);
  const subscriberTracker = useSubscriberTracker(clientRef.current, false);

  const idleTarget = useRef({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
  });

  //Feed redeem
  useEffect(() => {
    if (!clientRef.current) return;

    let localref = clientRef.current;
    const handleMessage = (channel, userstate, message, self) => {
      if (self) return;
      console.log("1a");
      if (userstate["custom-reward-id"] === settings.redeemFeed) {
        const tracker = subscriberTrackerRef.current;
        if (!tracker) return;

        const available = tracker.getSubscriberCount();
        const spawnCount = Math.min(available, 5);
        console.log(`spawncount ${spawnCount}`);

        if (spawnCount > 0) {
          const selectedSubscribers = tracker.getRandomSubscribers(spawnCount);

          selectedSubscribers.forEach((sub, index) => {
            console.log(`spawning ${sub.name}`);
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
    return () => {
      localref.removeListener("message", handleMessage);
    };
  }, [settings, clientRef]);

  // Debug toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " || e.code === "Space") {
        setIsDebug((prev) => !prev);
      }
      if (e.key === "a" || e.code === "a") {
        spawnSubBubble("fih");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keep subscriberTracker in a ref
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

  // Subscriber spawn interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now < nextSpawnTime.current) return;

      const available = subscriberTrackerRef.current.getSubscriberCount();
      if (available >= 1) {
        const selected = subscriberTrackerRef.current.getRandomSubscribers(1);
        if (selected?.length > 0) {
          const name = selected[0].name || selected[0].displayName;
          spawnSubBubble(name);
          nextSpawnTime.current =
            Date.now() + randomBetween(1000 * 10, 1000 * 120);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const spawnSubBubble = (name) => {
    const { Bodies, Composite } = Matter;
    const padding = 100;
    const minDistance = 400;
    const fish = fishRef.current;

    let x, y, dist;
    let attempts = 0;

    do {
      x = Math.random() * (window.innerWidth - padding * 2) + padding;
      y = Math.random() * (window.innerHeight - padding * 2) + padding;

      if (fish) {
        const dx = x - fish.position.x;
        const dy = y - fish.position.y;
        dist = Math.sqrt(dx * dx + dy * dy);
      } else {
        dist = minDistance + 1;
      }
      attempts++;
    } while (dist < minDistance && attempts < 15);

    const newSub = Bodies.circle(x, y, 20, {
      label: "sub",
      restitution: 0.8,
      render: {
        sprite: {
          texture: fih_feed,
          xScale: 1,
          yScale: 1,
        },
      },
    });

    newSub.subscriberName = name;
    subBodies.current.set(newSub.id, newSub);
    Composite.add(engineRef.current.world, newSub);
  };

  // Idle target movement
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
          const dx = newX - fish.position.x;
          const dy = newY - fish.position.y;
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

  // Matter.js Main Loop
  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Composite, Body, Events } = Matter;
    const engine = engineRef.current;
    engine.gravity.y = 0;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: "transparent",
      },
    });

    const fish = Bodies.circle(
      Math.random() * window.innerWidth,
      Math.random() * window.innerHeight,
      BASE_RADIUS,
      {
        label: "fish",
        frictionAir: 0.03,
        render: {
          opacity: 0,
        },
      },
    );
    fishRef.current = fish;
    Composite.add(engine.world, [fish]);

    const thickness = 60;
    const walls = [
      Bodies.rectangle(0, 0, 10, 10, {
        isStatic: true,
        render: { visible: false },
      }),
      Bodies.rectangle(0, 0, 10, 10, {
        isStatic: true,
        render: { visible: false },
      }),
      Bodies.rectangle(0, 0, 10, 10, {
        isStatic: true,
        render: { visible: false },
      }),
      Bodies.rectangle(0, 0, 10, 10, {
        isStatic: true,
        render: { visible: false },
      }),
    ];
    wallsRef.current = walls;

    const updateWalls = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      Body.setPosition(walls[0], { x: w / 2, y: -thickness / 2 });
      Body.setPosition(walls[1], { x: w / 2, y: h + thickness / 2 });
      Body.setPosition(walls[2], { x: -thickness / 2, y: h / 2 });
      Body.setPosition(walls[3], { x: w + thickness / 2, y: h / 2 });
    };
    updateWalls();
    Composite.add(engine.world, walls);

    const fishCanvas = fishCanvasRef.current;
    const fishCtx = fishCanvas.getContext("2d");
    fishCanvas.width = window.innerWidth;
    fishCanvas.height = window.innerHeight;

    const fishFrameSrcs = [fih_idle, fih_swim_0, fih_swim_1, fih_swim_2];
    const fishImages = fishFrameSrcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });

    const handleResize = () => {
      render.canvas.width = window.innerWidth;
      render.canvas.height = window.innerHeight;
      fishCanvas.width = window.innerWidth;
      fishCanvas.height = window.innerHeight;
      updateWalls();
    };
    window.addEventListener("resize", handleResize);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    // ── Helper: resize physics circle to match new size ──────────────────
    // Matter.js doesn't support resizing circles natively, so we scale the
    // vertices and update circleRadius ourselves.
    const applyPhysicsSize = (body, newSize) => {
      const targetRadius = BASE_RADIUS * newSize;
      const currentRadius = body.circleRadius || BASE_RADIUS;
      const scaleFactor = targetRadius / currentRadius;
      Body.scale(body, scaleFactor, scaleFactor);
      // Body.scale updates circleRadius automatically in recent Matter versions,
      // but set it explicitly just in case:
      body.circleRadius = targetRadius;
    };

    // Custom fish draw loop
    let animFrame;
    let lastFrameTime = performance.now();

    const drawFish = () => {
      const now = performance.now();
      const dtMs = now - lastFrameTime;
      lastFrameTime = now;

      const fish = fishRef.current;
      fishCtx.clearRect(0, 0, fishCanvas.width, fishCanvas.height);

      // ── Size decay logic (runs every frame) ────────────────────────────
      const lastEat = lastEatTimeRef.current;
      if (lastEat !== null) {
        const msSinceEat = Date.now() - lastEat;
        if (msSinceEat > DECAY_START_MS && fishSizeRef.current > 1) {
          const prevSize = fishSizeRef.current;
          fishSizeRef.current = Math.max(
            1,
            fishSizeRef.current - DECAY_RATE * dtMs,
          );

          // Keep physics body in sync with visual size
          if (fish && Math.abs(prevSize - fishSizeRef.current) > 0.001) {
            applyPhysicsSize(fish, fishSizeRef.current);
          }

          // When fully back to base size, wipe any sluggish leftover velocity
          // so the chase force can spin up cleanly from rest.
          if (fishSizeRef.current === 1 && fish) {
            Matter.Body.setVelocity(fish, { x: 0, y: 0 });
          }
        }
      }
      // ───────────────────────────────────────────────────────────────────

      if (fish) {
        const speed = Math.sqrt(fish.velocity.x ** 2 + fish.velocity.y ** 2);
        const isMoving = speed > 0.3;
        const time = performance.now();

        let frameIndex = 0;
        if (isMoving) frameIndex = 1 + (Math.floor(time / 150) % 3);
        const img = fishImages[frameIndex];

        const baseW = img.naturalWidth || 80;
        const baseH = img.naturalHeight || 80;

        // Apply both size scale and gulp scale to the visual
        const visualScale = fishSizeRef.current * gulpScaleRef.current;
        const w = baseW * visualScale;
        const h = baseH * visualScale;

        const { x, y } = fish.position;
        const angle = fish.angle;

        fishCtx.save();
        fishCtx.translate(x, y);
        fishCtx.rotate(angle);

        if (facingRightRef.current) {
          fishCtx.scale(-1, 1);
        }

        fishCtx.drawImage(img, -w / 2, -h / 2, w, h);
        fishCtx.restore();
      }

      animFrame = requestAnimationFrame(drawFish);
    };
    drawFish();

    // Sync React nameplates
    Events.on(engine, "afterUpdate", () => {
      const positions = Array.from(subBodies.current.values()).map((body) => ({
        id: body.id,
        name: body.subscriberName,
        x: body.position.x,
        y: body.position.y,
        color: body.color,
      }));
      setActiveSubs(positions);
    });

    Events.on(engine, "beforeUpdate", (event) => {
      const fish = fishRef.current;
      if (!fish) return;

      const size = fishSizeRef.current;

      const slugFactor = (size - 1) / (MAX_SIZE - 1); // 0 → 1
      fish.frictionAir = 0.03 + slugFactor * 0.09;

      const chasing = subBodies.current.size > 0;
      const target = chasing
        ? subBodies.current.values().next().value.position
        : idleTarget.current;

      const dx = target.x - fish.position.x;
      const dy = target.y - fish.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (fish.velocity.x > 0.1) {
        facingRightRef.current = true;
      } else if (fish.velocity.x < -0.1) {
        facingRightRef.current = false;
      }

      const speed = Math.sqrt(fish.velocity.x ** 2 + fish.velocity.y ** 2);
      const isMoving = speed > 0.3;

      if (dist > 30 && isMoving) {
        const tiltAngle = Math.atan2(dy, Math.abs(dx)) * 0.4;
        const clampedAngle = Math.max(Math.min(tiltAngle, 0.4), -0.4);
        Matter.Body.setAngle(
          fish,
          facingRightRef.current ? -clampedAngle : clampedAngle,
        );
      } else {
        Matter.Body.setAngle(fish, fish.angle * 0.9);
      }

      Matter.Body.setAngularVelocity(fish, 0);

      const time = event.source.timing.timestamp;

      if (dist > 20) {
        // frictionAir alone governs sluggishness — force stays constant so
        // fih accelerates normally again as soon as he shrinks back down.
        const force = chasing ? 0.006 : 0.0008;
        Matter.Body.applyForce(fish, fish.position, {
          x: (dx / dist) * force,
          y: (dy / dist) * force,
        });
      }

      if (!chasing) {
        const sway = Math.sin(time * 0.002) * 0.0004;
        Matter.Body.applyForce(fish, fish.position, { x: 0, y: sway });
        Matter.Body.setVelocity(fish, {
          x: fish.velocity.x * 0.98,
          y: fish.velocity.y * 0.98,
        });
      }
    });

    // Collision
    Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const sub =
          pair.bodyA.label === "sub"
            ? pair.bodyA
            : pair.bodyB.label === "sub"
              ? pair.bodyB
              : null;

        if (
          sub &&
          (pair.bodyA.label === "fish" || pair.bodyB.label === "fish")
        ) {
          Composite.remove(engine.world, sub);
          subBodies.current.delete(sub.id);

          // ── Grow fih ──────────────────────────────────────────────────
          const prevSize = fishSizeRef.current;
          fishSizeRef.current = Math.min(MAX_SIZE, prevSize + SIZE_PER_EAT);
          lastEatTimeRef.current = Date.now();

          // Resize the physics body to match new size
          const fish = fishRef.current;
          if (fish) applyPhysicsSize(fish, fishSizeRef.current);
          // ─────────────────────────────────────────────────────────────

          // Gulp effect (brief vertical squish-stretch)
          gulpScaleRef.current = 1.25;
          setTimeout(() => {
            gulpScaleRef.current = 1;
          }, 220);
        }
      });
    });

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", handleResize);
      Render.stop(render);
      Runner.stop(runner);
      Engine.clear(engine);
      render.canvas.remove();
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Matter.js canvas — renders sub bubbles only */}
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

      {/* Custom canvas — renders fish with proper flip */}
      <canvas
        ref={fishCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />

      {activeSubs.map((sub) => (
        <div
          key={sub.id}
          style={{
            position: "absolute",
            left: sub.x,
            top: sub.y - 40,
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
