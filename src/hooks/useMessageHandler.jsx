import { useEffect } from "react";

export function useMessageHandler(
  client,
  emoteMap,
  spawnEmoteRef,
  globalEffects,
  settings,
) {
  const {
    emoteDelay,
    subEffectTypes,
    subEffectBlackHoleChance,
    subEffectBlackHoleDuration,
    subEffectBlackHoleStrength,
    subEffectGravityEventChance,
    subEffectGravityEventDuration,
    subEffectGravityEventStrength,
    battleEventChance,
  } = settings;

  useEffect(() => {
    if (!client || !spawnEmoteRef) return;

    function onMessage(channel, userstate, message) {
      const isMod = userstate.mod || userstate.badges?.broadcaster;
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
        battleEvent: {
          fn: globalEffects.battleSystem.startBattle,
          duration: null,
          str: null,
          chance: battleEventChance,
        },
      };

      let b = false;
      const shuffledEffects = Object.entries(effectsMap).sort(
        () => Math.random() - 0.5,
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
          !globalEffects.gravityEventActive &&
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
          setTimeout(() => {
            const userColor = userstate.color || "orange";
            spawnEmoteRef.current?.(emoteName, isSub, userColor);
          }, i * emoteDelay);
        });
      }

      const cmd = words[0].toLowerCase();
      const arg = words[1]?.toLowerCase();

      if (cmd === "!force" && isMod) {
        switch (arg) {
          case "battleevent":
            if (subEffectTypes.includes("battleEvent")) {
              globalEffects.battleSystem.startBattle();
            }
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
    subEffectGravityEventStrength,
    subEffectGravityEventChance,
    subEffectGravityEventDuration,
    battleEventChance,
  ]);
}
