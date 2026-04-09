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

export default function FihOverlay() {
  const sceneRef = useRef(null);
  const fishCanvasRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create());
  const fishRef = useRef(null);
  const subBodies = useRef(new Map());
  const wallsRef = useRef([]);
  const facingRightRef = useRef(false);
  const gulpScaleRef = useRef(1); // for gulp effect on custom canvas
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
      // Ignore messages from the bot itself
      if (self) return;
      console.log("1a");
      // Check for the specific reward ID
      if (userstate["custom-reward-id"] === settings.redeemFeed) {
        // Use the ref to get the current tracker instance
        const tracker = subscriberTrackerRef.current;
        if (!tracker) return;

        // 1. Get up to 5 random subscribers
        const available = tracker.getSubscriberCount();
        const spawnCount = Math.min(available, 5);
        console.log(`spawncount ${spawnCount}`);

        if (spawnCount > 0) {
          const selectedSubscribers = tracker.getRandomSubscribers(spawnCount);

          // 2. Loop through and spawn with 100ms delay
          selectedSubscribers.forEach((sub, index) => {
            console.log(`spawning ${sub.name}`);
            setTimeout(() => {
              const name = sub.name || sub.displayName;
              spawnSubBubble(name);
            }, index * 1000); // 0ms, 100ms, 200ms, etc.
          });

          // Reset the auto-spawn timer so they don't overlap immediately
          nextSpawnTime.current =
            Date.now() + randomBetween(1000 * 10, 1000 * 120);
        }
      }
    };

    localref.on("message", handleMessage);

    // Cleanup: remove the listener when the component unmounts
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

    // Matter renderer (for subs only — fish is hidden here)
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

    // Fish body — rendered invisibly, physics only
    const fish = Bodies.circle(
      Math.random() * window.innerWidth,
      Math.random() * window.innerHeight,
      40,
      {
        label: "fish",
        frictionAir: 0.03,
        render: {
          opacity: 0, // hide from Matter renderer; we draw it on fishCanvas
        },
      },
    );
    fishRef.current = fish;
    Composite.add(engine.world, [fish]);

    // Walls
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

    // Custom fish canvas setup
    const fishCanvas = fishCanvasRef.current;
    const fishCtx = fishCanvas.getContext("2d");
    fishCanvas.width = window.innerWidth;
    fishCanvas.height = window.innerHeight;

    // Preload fish images
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

    // Custom fish draw loop
    let animFrame;
    const drawFish = () => {
      const fish = fishRef.current;
      fishCtx.clearRect(0, 0, fishCanvas.width, fishCanvas.height);

      if (fish) {
        const speed = Math.sqrt(fish.velocity.x ** 2 + fish.velocity.y ** 2);
        const isMoving = speed > 0.3;
        const time = performance.now();

        // Animation frame
        let frameIndex = 0;
        if (isMoving) frameIndex = 1 + (Math.floor(time / 150) % 3);
        const img = fishImages[frameIndex];

        // Use natural size or fallback
        const w = img.naturalWidth || 80;
        const h = img.naturalHeight || 80;

        const { x, y } = fish.position;
        const angle = fish.angle;
        const gulpScale = gulpScaleRef.current;

        fishCtx.save();
        fishCtx.translate(x, y);
        fishCtx.rotate(angle);

        // Flip horizontally if facing right
        if (facingRightRef.current) {
          fishCtx.scale(-1, gulpScale);
        } else {
          fishCtx.scale(1, gulpScale);
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
      }));
      setActiveSubs(positions);
    });

    Events.on(engine, "beforeUpdate", (event) => {
      const fish = fishRef.current;
      if (!fish) return;

      const chasing = subBodies.current.size > 0;
      const target = chasing
        ? subBodies.current.values().next().value.position
        : idleTarget.current;

      const dx = target.x - fish.position.x;
      const dy = target.y - fish.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 1. DIRECTION — update facingRight ref (used by custom canvas)
      if (fish.velocity.x > 0.1) {
        facingRightRef.current = true;
      } else if (fish.velocity.x < -0.1) {
        facingRightRef.current = false;
      }

      // 3. TILT LOGIC
      const speed = Math.sqrt(fish.velocity.x ** 2 + fish.velocity.y ** 2);
      const isMoving = speed > 0.3;

      if (dist > 30 && isMoving) {
        // How much vertical vs horizontal to target — gives a gentle pitch
        const tiltAngle = Math.atan2(dy, Math.abs(dx)) * 0.4; // 0.4 dampens it
        const clampedAngle = Math.max(Math.min(tiltAngle, 0.4), -0.4);

        Matter.Body.setAngle(
          fish,
          facingRightRef.current ? -clampedAngle : clampedAngle,
        );
      } else {
        Matter.Body.setAngle(fish, fish.angle * 0.9);
      }

      // 4. FORCES & SWAY
      Matter.Body.setAngularVelocity(fish, 0);

      const time = event.source.timing.timestamp;

      if (dist > 20) {
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

          // Gulp effect via ref (used in custom canvas draw)
          gulpScaleRef.current = 1.2;
          setTimeout(() => {
            gulpScaleRef.current = 1;
          }, 200);
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
