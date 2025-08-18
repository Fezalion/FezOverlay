import { useEffect } from "react";

export function useMessageHandler(
  client,
  emoteMap,
  spawnEmote,
  globalEffects,
  settings,
  version
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
    battleEventChance,
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
          setTimeout(() => {
            const userColor = userstate.color || "orange";
            spawnEmote(emoteName, isSub, userColor);
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
      } else if (words[0] == "!version" && isMod) {
        showOverlayVersion();
      }
    }

    function showOverlayVersion() {
      // Create version element
      const versionEl = document.createElement("div");
      versionEl.textContent = version;
      versionEl.style.position = "fixed";
      versionEl.style.top = "20px";
      versionEl.style.left = "20px";
      versionEl.style.padding = "8px 12px";
      versionEl.style.background = "rgba(0,0,0,0.6)";
      versionEl.style.color = "white";
      versionEl.style.fontSize = "16px";
      versionEl.style.fontFamily = "Arial, sans-serif";
      versionEl.style.borderRadius = "6px";
      versionEl.style.zIndex = 9999;
      versionEl.style.pointerEvents = "none";
      versionEl.style.opacity = "0";
      versionEl.style.transition = "opacity 0.3s ease";

      // Add to overlay
      document.body.appendChild(versionEl);

      // Fade in
      requestAnimationFrame(() => (versionEl.style.opacity = "1"));

      // Auto remove after 5 seconds
      setTimeout(() => {
        versionEl.style.opacity = "0";
        versionEl.addEventListener("transitionend", () => versionEl.remove(), {
          once: true,
        });
      }, 5000);
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
    subEffectReverseGravityStrength,
    battleEventChance,
    version,
  ]);
}
