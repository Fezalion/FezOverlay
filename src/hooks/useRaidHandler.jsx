import { useEffect } from "react";

export function useRaidHandler(client, spawnEmoteRef, raidEffect, emoteDelay) {
  useEffect(() => {
    if (!client || !raidEffect || !spawnEmoteRef) return;

    function onRaid(channel, username, viewers) {
      for (let i = 0; i < viewers; i++) {
        setTimeout(() => {
          spawnEmoteRef.current?.spawnEmote("AYAYA", false, "red");
        }, i * emoteDelay);
      }
    }

    client.on("raided", onRaid);

    return () => {
      client.off("raided", onRaid);
    };
  }, [client, spawnEmoteRef, raidEffect, emoteDelay]);
}
