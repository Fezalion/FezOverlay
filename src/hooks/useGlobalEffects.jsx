import { useRef, useCallback } from "react";
import Matter from "matter-js";
import { useBattleSystem } from "./useBattleSystem";

export function useGlobalEffects(
  engineRef,
  bodiesWithTimers,
  emoteMap,
  battleSettings,
  subscriberTracker,
  viewerTracker,
  sceneRef,
  client
) {
  const magneticEventRef = useRef(false);
  const reverseGravityEventRef = useRef(false);
  const dpsTrackerRef = useRef(null);

  const battleSystem = useBattleSystem(
    engineRef,
    emoteMap,
    bodiesWithTimers,
    battleSettings,
    subscriberTracker,
    viewerTracker,
    sceneRef,
    client
  );

  dpsTrackerRef.current = battleSystem.getDpsTracker();

  const startMagneticEvent = useCallback(
    (duration, str) => {
      const engine = engineRef.current;
      if (magneticEventRef.current || !engine) return;

      dpsTrackerRef.current?.recordSkillUse(
        "system",
        "Chat",
        "#fff",
        "Magnetic Event"
      );
      magneticEventRef.current = true;

      const forceMagnitude = str / 100000;

      const magneticUpdate = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        bodiesWithTimers.current.forEach(({ body }) => {
          if (!body.isSleeping) {
            const dx = centerX - body.position.x;
            const dy = centerY - body.position.y;
            Matter.Body.applyForce(body, body.position, {
              x: dx * forceMagnitude,
              y: dy * forceMagnitude,
            });
          }
        });
      };

      Matter.Events.on(engine, "beforeUpdate", magneticUpdate);

      setTimeout(() => {
        Matter.Events.off(engine, "beforeUpdate", magneticUpdate);
        magneticEventRef.current = false;
        console.log("magnetic event ended");
      }, duration * 1000);
    },
    [engineRef, bodiesWithTimers]
  );

  const startReverseGravityEvent = useCallback(
    (duration, str) => {
      const engine = engineRef.current;
      if (reverseGravityEventRef.current || !engine) return;

      dpsTrackerRef.current?.recordSkillUse(
        "system",
        "Chat",
        "#fff",
        "Reverse Gravity"
      );

      reverseGravityEventRef.current = true;

      const gravityUpdate = () => {
        bodiesWithTimers.current.forEach(({ body, isSub }) => {
          if (!body.isSleeping && isSub) {
            const upwardForce = (str / 1000) * -1 * body.mass;
            Matter.Body.applyForce(body, body.position, {
              x: 0,
              y: upwardForce,
            });
          }
        });
      };

      Matter.Events.on(engine, "beforeUpdate", gravityUpdate);

      setTimeout(() => {
        Matter.Events.off(engine, "beforeUpdate", gravityUpdate);
        reverseGravityEventRef.current = false;
        console.log("reverse gravity event ended");
      }, duration * 1000);
    },
    [engineRef, bodiesWithTimers]
  );

  return {
    startMagneticEvent,
    startReverseGravityEvent,
    magneticEventActive: magneticEventRef.current,
    reverseGravityEventActive: reverseGravityEventRef.current,
    battleSystem,
  };
}
