import { useEffect } from 'react';

export function useRaidHandler(client, spawnEmote, raidEffect, emoteDelay) {
  useEffect(() => {
    if (!client || !raidEffect || !spawnEmote) return;

    function onRaid(channel, username, viewers) {
      for (let i = 0; i < viewers; i++) {
        setTimeout(() => { 
          spawnEmote("AYAYA", false, "red");
        }, i * emoteDelay);
      }
    }
    
    client.on("raided", onRaid);
    
    return () => {
      client.off("raided", onRaid);
    };
  }, [client, spawnEmote, raidEffect, emoteDelay]);
}