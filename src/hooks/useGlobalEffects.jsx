import { useRef, useCallback, useEffect } from "react";
import { useBattleSystem } from "./useBattleSystem";

export function useGlobalEffects(
  engineRef, // engineRef.current is the Rapier World
  bodiesWithTimers,
  emoteMap,
  battleSettings,
  subscriberTracker,
  viewerTracker,
  sceneRef,
  client,
) {
  const magneticEventRef = useRef(false);
  const reverseGravityEventRef = useRef(false);
  const gravityEventRef = useRef(false);
  const dpsTrackerRef = useRef(null);

  const magneticIntervalRef = useRef(null);

  const battleSystem = useBattleSystem(
    engineRef,
    emoteMap,
    bodiesWithTimers,
    battleSettings,
    subscriberTracker,
    viewerTracker,
    sceneRef,
    client,
  );

  dpsTrackerRef.current = battleSystem.getDpsTracker();

  // Cleanup on unmount to prevent memory leaks or orphaned intervals
  useEffect(() => {
    return () => {
      if (magneticIntervalRef.current)
        clearInterval(magneticIntervalRef.current);
    };
  }, []);

  const startMagneticEvent = useCallback(
    (duration, str) => {
      const world = engineRef.current;
      if (magneticEventRef.current || !world) return;

      // RESTORED: This handles the UI display for the event start
      dpsTrackerRef.current?.recordEventUse(
        "system",
        "Chat",
        "#fff",
        "Magnetic Event",
        duration,
      );

      magneticEventRef.current = true;
      const forceMultiplier = str * 40000;

      const targetRef = { handle: null };
      const originalDamping = new Map();

      const pickNewTarget = () => {
        const activeBodies = bodiesWithTimers.current.filter(
          (b) => b.body && !b.body.isSleeping(),
        );
        if (activeBodies.length > 0) {
          const choice =
            activeBodies[Math.floor(Math.random() * activeBodies.length)];
          targetRef.handle = choice.body.handle;
        } else {
          targetRef.handle = null;
        }
      };

      pickNewTarget();

      magneticIntervalRef.current = setInterval(() => {
        if (!magneticEventRef.current) return;

        // Safe lookup via Rapier handle
        const targetBody = world.getRigidBody(targetRef.handle);

        if (!targetBody) {
          pickNewTarget();
          return;
        }

        const targetPos = targetBody.translation();

        bodiesWithTimers.current.forEach(({ body }) => {
          if (body && body.handle !== targetRef.handle && !body.isSleeping()) {
            if (!originalDamping.has(body.handle)) {
              originalDamping.set(body.handle, body.linearDamping());
              body.setLinearDamping(8.0);
            }

            const pos = body.translation();
            const dx = targetPos.x - pos.x;
            const dy = targetPos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            body.addForce(
              {
                x: (dx / dist) * forceMultiplier,
                y: (dy / dist) * forceMultiplier,
              },
              true,
            );
          }
        });
      }, 16);

      setTimeout(() => {
        clearInterval(magneticIntervalRef.current);
        magneticEventRef.current = false;

        bodiesWithTimers.current.forEach(({ body }) => {
          if (body && originalDamping.has(body.handle)) {
            body.setLinearDamping(originalDamping.get(body.handle));
          }
        });
      }, duration * 1000);
    },
    [engineRef, bodiesWithTimers],
  );

  const startGravityEvent = useCallback(
    (duration, str) => {
      const world = engineRef.current;
      if (gravityEventRef.current || !world) return;

      // Log the event to your UI
      dpsTrackerRef.current?.recordEventUse(
        "system",
        "Chat",
        "#fff",
        "Gravity Event",
        duration,
      );

      gravityEventRef.current = true;

      // Rapier gravity is an object {x, y}. Store current state to restore later
      const originalGravity = { x: world.gravity.x, y: world.gravity.y };

      // Apply downward gravity.
      // str * 9.81 * 100 provides a noticeable "drop" in the Rapier scale
      world.gravity = { x: 0, y: str * 981 };

      // Wake up all bodies so they react to the new gravity immediately
      bodiesWithTimers.current.forEach(({ body }) => {
        if (body) body.wakeUp();
      });

      setTimeout(() => {
        // Restore original gravity (likely {x: 0, y: 0})
        world.gravity = originalGravity;
        gravityEventRef.current = false;
        console.log("gravity event ended");
      }, duration * 1000);
    },
    [engineRef, bodiesWithTimers],
  );

  return {
    startMagneticEvent,
    startGravityEvent,
    magneticEventActive: magneticEventRef.current,
    reverseGravityEventActive: reverseGravityEventRef.current,
    gravityEventActive: gravityEventRef.current,
    battleSystem,
  };
}
