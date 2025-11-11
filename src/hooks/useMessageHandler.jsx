import { useEffect } from "react";

export function useMessageHandler(
  client,
  emoteMap,
  spawnEmoteRef,
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
    subEffectReverseGravityStrength,
    subEffectGravityEventChance,
    subEffectGravityEventDuration,
    subEffectGravityEventStrength,
    battleEventChance,
  } = settings;

  useEffect(() => {
    if (!client || !spawnEmoteRef) return;

    function onMessage(channel, userstate, message) {
      console.log(message);
      const words = message.split(/\s+/);
      // Build ordered emote list. If an emote is immediately followed by one or
      // more zero-width emotes, combine them into a single composite token so
      // they render together. Trim common punctuation when checking tokens.
      const trimPunc = (s) => s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
      const emotes = [];
      for (let i = 0; i < words.length; i++) {
        const raw = words[i];
        const w = trimPunc(raw);
        if (!w || !emoteMap.has(w)) continue;
        // don't treat a zero-width emote as a base for combination
        const baseMeta = emoteMap.get(w);
        if (baseMeta && baseMeta.zeroWidth) {
          emotes.push(w);
          continue;
        }

        // collect consecutive zero-width modifiers after base
        const modifiers = [];
        let j = i + 1;
        while (j < words.length) {
          const nextRaw = words[j];
          const nextToken = trimPunc(nextRaw);
          if (!nextToken || !emoteMap.has(nextToken)) break;
          const meta = emoteMap.get(nextToken);
          // require explicit true for zeroWidth (avoid truthy non-boolean values)
          if (meta && meta.zeroWidth === true) {
            modifiers.push(nextToken);
            j++;
            continue;
          }
          break;
        }

        if (modifiers.length > 0) {
          // join base + modifiers using '/' separator (supported by spawner)
          emotes.push([w, ...modifiers].join("/"));
          i = j - 1; // skip consumed modifier tokens
        } else {
          emotes.push(w);
        }
      }
      const isSub =
        userstate.subscriber ||
        userstate.mod ||
        userstate.badges?.vip ||
        userstate.badges?.broadcaster;

      const isMod = userstate.mod || userstate.badges?.broadcaster;

      // Handle global effects
      const effectsMap = {
        magneticAttraction: {
          fn: globalEffects.startMagneticEvent,
          duration: subEffectBlackHoleDuration,
          str: subEffectBlackHoleStrength,
          chance: subEffectBlackHoleChance,
        },
        reverseGravity: {
          fn: globalEffects.startReverseGravityEvent,
          duration: subEffectReverseGravityDuration,
          str: subEffectReverseGravityStrength,
          chance: subEffectReverseGravityChance,
        },
        gravityEvent: {
          fn: globalEffects.startGravityEvent,
          duration: subEffectGravityEventDuration,
          str: subEffectGravityEventStrength,
          chance: subEffectGravityEventChance,
        },
        battleEvent: {
          fn: globalEffects.battleSystem.startBattle,
          duration: null,
          str: null,
          chance: battleEventChance,
        },
      };
      let b = false;
      const shuffledEffects = Object.entries(effectsMap).sort(
        () => Math.random() - 0.5
      );
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
          !globalEffects.reverseGravityEventActive &&
          !globalEffects.battleSystem.isActive
        ) {
          console.log(`event proc ${effectName} for ${duration}s`);
          if (effectName === "battleEvent") {
            b = effectFn();
          } else {
            effectFn(duration ?? 2, str);
          }
          break;
        }
      }
      if (!b) {
        emotes.forEach((emoteName, i) => {
          console.log("the fuck");
          setTimeout(() => {
            const userColor = userstate.color || "orange";
            spawnEmoteRef.current?.(emoteName, isSub, userColor);
          }, i * emoteDelay);
        });
      }

      if (words[0] == "!force" && isMod) {
        const battleEvent = shuffledEffects.find(
          ([key]) => key === "battleEvent"
        );
        switch (words[1]) {
          case "battleEvent":
            if (battleEvent && subEffectTypes.includes("battleEvent")) {
              battleEvent[1].fn();
            }
            break;

          default:
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
    spawnEmoteRef,
    globalEffects,
    emoteDelay,
    subEffectTypes,
    subEffectBlackHoleChance,
    subEffectBlackHoleDuration,
    subEffectBlackHoleStrength,
    subEffectReverseGravityChance,
    subEffectReverseGravityDuration,
    subEffectReverseGravityStrength,
    subEffectGravityEventStrength,
    subEffectGravityEventChance,
    subEffectGravityEventDuration,
    battleEventChance,
  ]);
}
