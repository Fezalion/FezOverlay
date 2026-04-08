import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";

import { useTwitchClient } from "../hooks/useTwitchClient";
import { useSubscriberTracker } from "../hooks/useSubscriberTracker";
import { useMetadata } from "../hooks/useMetadata";

import fih_idle from "../utils/fih/fih_still_frame_01.png";
import fih_swim_0 from "../utils/fih/fih_still_frame_02.png";
import fih_swim_1 from "../utils/fih/fih_still_frame_03.png";
import fih_swim_2 from "../utils/fih/fih_still_frame_04.png";

export default function FihOverlay() {
  const sceneRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create());
  const fishRef = useRef(null);
  const subBodies = useRef(new Map());
  const wallsRef = useRef([]);
  const [isDebug, setIsDebug] = useState(false);

  const [activeSubs, setActiveSubs] = useState([]);

  const { settings } = useMetadata();
  const clientRef = useTwitchClient(settings.twitchName);
  const subscriberTracker = useSubscriberTracker(clientRef.current, false);

  const idleTarget = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  useEffect(() => {
    const handleKeyDown = (e) => {
      // OBS sometimes blocks the default 'Space' behavior (scrolling)
      // so we check for ' ' or 'Space'
      if (e.key === " " || e.code === "Space") {
        setIsDebug((prev) => !prev);
        console.log("Debug toggled:", !isDebug);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const subscriberTrackerRef = useRef(subscriberTracker);
  useEffect(() => {
    subscriberTrackerRef.current = subscriberTracker;
  }, [subscriberTracker]);

  const nextSpawnTime = useRef(
    Date.now() + randomBetween(1000 * 10, 1000 * 120),
  );

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
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
          // Schedule the next spawn after completing this one
          nextSpawnTime.current =
            Date.now() + randomBetween(1000 * 10, 1000 * 120);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const spawnSubBubble = (name) => {
    const { Bodies, Composite } = Matter;
    const x = Math.random() * (window.innerWidth - 100) + 50;
    const y = Math.random() * (window.innerHeight - 100) + 50;

    const newSub = Bodies.circle(x, y, 20, {
      label: "sub",
      restitution: 0.8,
      render: {
        sprite: {
          texture: "https://openclipart.org/image/400px/338744",
          xScale: 0.1,
          yScale: 0.1,
        },
      },
    });

    newSub.subscriberName = name;
    subBodies.current.set(newSub.id, newSub);
    Composite.add(engineRef.current.world, newSub);
  };

  // 2. Idle Target Logic
  useEffect(() => {
    const moveIdlePoint = () => {
      const padding = 0.2;
      idleTarget.current = {
        x: (Math.random() * (1 - padding * 2) + padding) * window.innerWidth,
        y: (Math.random() * (1 - padding * 2) + padding) * window.innerHeight,
      };
    };
    const interval = setInterval(moveIdlePoint, 15000);
    return () => clearInterval(interval);
  }, []);

  // 3. Matter.js Main Loop
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
      window.innerWidth / 2,
      window.innerHeight / 2,
      40,
      {
        label: "fish",
        frictionAir: 0.03,
        render: {
          sprite: {
            texture: fih_idle,
            xScale: 1,
            yScale: 1,
          },
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
      Body.setPosition(walls[0], { x: w / 2, y: -thickness / 2 }); // Top
      Body.setPosition(walls[1], { x: w / 2, y: h + thickness / 2 }); // Bottom
      Body.setPosition(walls[2], { x: -thickness / 2, y: h / 2 }); // Left
      Body.setPosition(walls[3], { x: w + thickness / 2, y: h / 2 }); // Right
    };
    updateWalls();
    Composite.add(engine.world, walls);

    const handleResize = () => {
      render.canvas.width = window.innerWidth;
      render.canvas.height = window.innerHeight;
      updateWalls();
    };
    window.addEventListener("resize", handleResize);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    // Sync React Nameplates
    Events.on(engine, "afterUpdate", () => {
      const positions = Array.from(subBodies.current.values()).map((body) => ({
        id: body.id,
        name: body.subscriberName,
        x: body.position.x,
        y: body.position.y,
      }));
      setActiveSubs(positions);
    });

    // Fish AI & Movement
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

      const baseScale = 1;
      const time = event.source.timing.timestamp;
      let currentFrame = 0;

      const speed = Math.sqrt(fish.velocity.x ** 2 + fish.velocity.y ** 2);
      const isMoving = speed > 0.3;
      // Determine if we should be "swimming" or "idle"
      if (isMoving) {
        // Cycle frames 1, 2, 3 every 150ms
        currentFrame = 1 + (Math.floor(time / 150) % 3);
      } else {
        currentFrame = 0; // fih_idle
      }

      const frames = [fih_idle, fih_swim_0, fih_swim_1, fih_swim_2];
      fish.render.sprite.texture = frames[currentFrame];

      // Maintain Scale & Flip logic
      if (Math.abs(fish.velocity.x) > 0.1) {
        // Flip the sprite based on direction
        fish.render.sprite.xScale =
          fish.velocity.x > 0 ? -baseScale : baseScale;
      }
      // Ensure yScale stays consistent (prevents it staying small after a "gulp")
      if (fish.render.sprite.yScale !== 1.1) {
        fish.render.sprite.yScale = baseScale;
      }

      Body.setAngle(fish, 0);
      Body.setAngularVelocity(fish, 0);

      if (dist > 20) {
        const force = chasing ? 0.006 : 0.0008;
        Body.applyForce(fish, fish.position, {
          x: (dx / dist) * force,
          y: (dy / dist) * force,
        });
      }

      if (!chasing) {
        const sway = Math.sin(time * 0.002) * 0.0004;
        Body.applyForce(fish, fish.position, { x: 0, y: sway });
        Body.setVelocity(fish, {
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
          // Gulp effect
          fishRef.current.render.sprite.yScale = 1.2;
          setTimeout(() => {
            if (fishRef.current) fishRef.current.render.sprite.yScale = 1;
          }, 200);
        }
      });
    });

    return () => {
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
      {activeSubs.map((sub) => (
        <div
          key={sub.id}
          style={{
            position: "absolute",
            left: sub.x,
            top: sub.y - 40,
            transform: "translateX(-50%)",
            color: "white",
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "bold",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            border: "1px solid #54a0ff",
            fontFamily: "monospace",
          }}
        >
          {sub.name}
        </div>
      ))}
    </div>
  );
}
