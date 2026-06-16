import { useEffect, useRef } from "react";

export function useMessageHandler(
  client,
  emoteMap,
  spawnEmoteRef,
  globalEffects,
  settings,
) {
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const emoteMapRef = useRef(emoteMap);
  useEffect(() => {
    emoteMapRef.current = emoteMap;
  }, [emoteMap]);

  const globalEffectsRef = useRef(globalEffects);
  useEffect(() => {
    globalEffectsRef.current = globalEffects;
  }, [globalEffects]);

  useEffect(() => {
    if (!client) return;

    console.log("registering onMessage for client", client);

    function onMessage(channel, userstate, message) {
      console.log("onMessage fired", channel, message);

      const {
        emoteDelay,
        subEffectTypes,
        subEffectBlackHoleChance,
        subEffectBlackHoleDuration,
        subEffectBlackHoleStrength,
        subEffectGravityEventChance,
        subEffectGravityEventDuration,
        subEffectGravityEventStrength,
      } = settingsRef.current;
      const emoteMap = emoteMapRef.current;
      const globalEffects = globalEffectsRef.current;

      const words = message.split(/\s+/);
      const trimPunc = (s) => s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
      const emotes = [];

      for (let i = 0; i < words.length; i++) {
        const raw = words[i];
        const w = trimPunc(raw);
        if (!w || !emoteMap.has(w)) continue;
        const baseMeta = emoteMap.get(w);
        if (baseMeta && baseMeta.zeroWidth) {
          emotes.push(w);
          continue;
        }

        const modifiers = [];
        let j = i + 1;
        while (j < words.length) {
          const nextRaw = words[j];
          const nextToken = trimPunc(nextRaw);
          if (!nextToken || !emoteMap.has(nextToken)) break;
          const meta = emoteMap.get(nextToken);
          if (meta && meta.zeroWidth === true) {
            modifiers.push(nextToken);
            j++;
            continue;
          }
          break;
        }

        if (modifiers.length > 0) {
          emotes.push([w, ...modifiers].join("/"));
          i = j - 1;
        } else {
          emotes.push(w);
        }
      }

      const isSub =
        userstate.subscriber ||
        userstate.mod ||
        userstate.badges?.vip ||
        userstate.badges?.broadcaster;

      const effectsMap = {
        magneticAttraction: {
          fn: globalEffects.startMagneticEvent,
          duration: subEffectBlackHoleDuration,
          str: subEffectBlackHoleStrength,
          chance: subEffectBlackHoleChance,
        },
        gravityEvent: {
          fn: globalEffects.startGravityEvent,
          duration: subEffectGravityEventDuration,
          str: subEffectGravityEventStrength,
          chance: subEffectGravityEventChance,
        },
      };

      const shuffledEffects = Object.entries(effectsMap).sort(
        () => Math.random() - 0.5,
      );

      let effectFired = false;
      for (const [
        effectName,
        { fn: effectFn, duration, str, chance },
      ] of shuffledEffects) {
        if (Math.random() * 100 > chance) continue;

        if (
          isSub &&
          emotes.length > 0 &&
          subEffectTypes.includes(effectName) &&
          !globalEffects.magneticEventActive &&
          !globalEffects.gravityEventActive
        ) {
          console.log(`event proc ${effectName} for ${duration}s`);
          effectFn(duration ?? 2, str);
          effectFired = true;
          break;
        }
      }

      if (!effectFired) {
        emotes.forEach((emoteName, i) => {
          setTimeout(() => {
            const userColor = userstate.color || "orange";
            spawnEmoteRef.current?.(emoteName, isSub, userColor);
          }, i * emoteDelay);
        });
      }
    }

    client.on("message", onMessage);
    return () => {
      client.off("message", onMessage);
    };
  }, [client]);
}
