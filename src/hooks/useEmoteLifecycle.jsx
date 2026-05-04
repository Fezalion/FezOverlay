import { useEffect } from "react";

export function useEmoteLifecycle(
  world, // This is engineRef.current (the Rapier World)
  bodiesWithTimers,
  emoteLifetime = 5000,
) {
  useEffect(() => {
    if (!world) return;

    // Rapier requires manual lifecycle checks via interval or rAF
    const interval = setInterval(() => {
      const now = Date.now();

      for (let i = bodiesWithTimers.current.length - 1; i >= 0; i--) {
        const item = bodiesWithTimers.current[i];
        const { body, born, el, cleanupEffects, isBattleParticipant } = item;

        if (isBattleParticipant || (body && body.isBattleParticipant)) continue;

        // Rapier: use body.translation() instead of body.position
        const pos = body ? body.translation() : { x: 0, y: 0 };
        const age = now - born;

        // Removal conditions: Age or Out of Bounds[cite: 13]
        const isExpired = age >= emoteLifetime;
        const isOutOfBounds = pos.y > window.innerHeight + 300 || pos.y < -300;

        if (isExpired || isOutOfBounds) {
          if (body) {
            try {
              world.removeRigidBody(body);
            } catch (e) {
              console.error(e);
            }
          }
          if (el) {
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 500);
          }
          if (cleanupEffects) cleanupEffects.forEach((fn) => fn());
          bodiesWithTimers.current.splice(i, 1);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [world, bodiesWithTimers, emoteLifetime]);

  return {
    clearAllEmotes: () => {
      for (let i = bodiesWithTimers.current.length - 1; i >= 0; i--) {
        const { body, el, cleanupEffects } = bodiesWithTimers.current[i];
        if (body) {
          try {
            world.removeRigidBody(body);
          } catch {
            /* already removed */
          }
        }
        if (el) el.remove();
        if (cleanupEffects) cleanupEffects.forEach((fn) => fn());
      }
      bodiesWithTimers.current = [];
    },
  };
}
