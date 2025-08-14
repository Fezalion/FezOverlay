import { useEffect } from 'react';
import Matter from 'matter-js';

export function useEmoteLifecycle(engine, bodiesWithTimers, emoteLifetime = 5000) {
  useEffect(() => {
    if (!engine) return;

    const lifecycleUpdate = () => {
      const now = Date.now();
      for (let i = bodiesWithTimers.current.length - 1; i >= 0; i--) {
        const { body, born, el, cleanupEffects } = bodiesWithTimers.current[i];
        const age = now - born;
        
        if (age >= emoteLifetime) {
          Matter.World.remove(engine.world, body);
          el.style.opacity = "0";
          
          setTimeout(() => el.remove(), 500);
          
          if (cleanupEffects) {
            cleanupEffects.forEach(fn => {
              try { 
                fn(); 
              } catch (err) { 
                console.error(err); 
              }
            });
          }
          
          bodiesWithTimers.current.splice(i, 1);
        }
      }
    };

    Matter.Events.on(engine, "beforeUpdate", lifecycleUpdate);

    return () => {
      Matter.Events.off(engine, "beforeUpdate", lifecycleUpdate);
    };
  }, [engine, bodiesWithTimers, emoteLifetime]);

  // Cleanup function for clearing all emotes
  const clearAllEmotes = () => {
    bodiesWithTimers.current.forEach(({ body, el, cleanupEffects }) => {
      if (engine) {
        Matter.World.remove(engine.world, body);
      }
      el.remove();
      if (cleanupEffects) {
        cleanupEffects.forEach(fn => {
          try { fn(); } catch (err) { console.error(err); }
        });
      }
    });
    bodiesWithTimers.current.length = 0;
  };

  return { clearAllEmotes };
}