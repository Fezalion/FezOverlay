import { useEffect } from 'react';

export function useMessageHandler(
  client, 
  emoteMap, 
  spawnEmote, 
  globalEffects,
  settings
) {
  const {
    emoteDelay,
    subEffectTypes,
    subEffectBlackHoleChance,
    subEffectBlackHoleDuration,
    subEffectBlackHoleStrength,
    subEffectReverseGravityChance,
    subEffectReverseGravityDuration,
    subEffectReverseGravityStrength
  } = settings;

  useEffect(() => {
    if (!client || !spawnEmote) return;

    function onMessage(channel, userstate, message) {
      console.log(message);
      const words = message.split(/\s+/);
      const emotes = words.filter((w) => emoteMap.has(w));
      const isSub =
        userstate.subscriber ||
        userstate.mod ||
        userstate.badges?.vip ||
        userstate.badges?.broadcaster;

      emotes.forEach((emoteName, i) => {
        setTimeout(() => {          
          const userColor = userstate.color || "orange";
          spawnEmote(emoteName, isSub, userColor);
        }, i * emoteDelay);
      });

      // Handle global effects
      const effectsMap = {
        magneticAttraction: {
          fn: globalEffects.startMagneticEvent,
          duration: subEffectBlackHoleDuration,
          str: subEffectBlackHoleStrength,
          chance: subEffectBlackHoleChance
        },
        reverseGravity: {
          fn: globalEffects.startReverseGravityEvent,
          duration: subEffectReverseGravityDuration,
          str: subEffectReverseGravityStrength,
          chance: subEffectReverseGravityChance
        }
      };

      const shuffledEffects = Object.entries(effectsMap)
        .sort(() => Math.random() - 0.5);
        
      for (const [effectName, { fn: effectFn, duration, str, chance }] of shuffledEffects) {
        if (Math.random() * 100 > chance) continue;
        if (
          isSub &&
          emotes.length > 0 &&
          subEffectTypes.includes(effectName) &&
          !globalEffects.magneticEventActive &&
          !globalEffects.reverseGravityEventActive
        ) {
          console.log(`event proc ${effectName} for ${duration}s`);
          effectFn(duration ?? 2, str);
          break;
        }
      }
    }
    
    client.on("message", onMessage);
    return () => {
      client.off("message", onMessage);
    };
  }, [
    client,
    emoteMap,
    spawnEmote,
    globalEffects,
    emoteDelay,
    subEffectTypes,
    subEffectBlackHoleChance,
    subEffectBlackHoleDuration,
    subEffectBlackHoleStrength,
    subEffectReverseGravityChance,
    subEffectReverseGravityDuration,
    subEffectReverseGravityStrength
  ]);
}