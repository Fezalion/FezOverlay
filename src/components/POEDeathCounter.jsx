// POEDeathCounter.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { useTwitchClient } from "../hooks/useTwitchClient";

export default function POEDeathCounter() {
  const { settings, refreshSettings } = useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);
  const clientRef = useTwitchClient(settings.twitchName);
  const wsRef = useRef(null);

  // refresh settings when needed
  useEffect(() => {
    refreshSettings();
  }, [refreshToken, refreshSettings]);

  useEffect(() => {
    const wsUrl = "ws://localhost:48000";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // external trigger from your overlay control server
        if (
          data.type === "refresh" &&
          (data.target === "all" || data.target === "deathcounter")
        ) {
          setRefreshToken((c) => c + 1);
          console.log("🔄 Death Counter refreshing");
        }

        // direct PoE death event
        if (data.type === "poeDeath") {
          window.dispatchEvent(new CustomEvent("poe-death", { detail: data }));
        }
      } catch (err) {
        console.error("Bad WS message:", err);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("WebSocket closed");

    return () => ws.close();
  }, []);

  const stableKey = useMemo(() => {
    return `deathcounter-${settings.twitchName}`;
  }, [settings.twitchName]);

  return (
    <POEDeathCounterCore
      key={stableKey}
      settings={settings}
      wsRef={wsRef}
      clientRef={clientRef}
    />
  );
}

function POEDeathCounterCore({ settings, wsRef }) {
  const [deathCount, setDeathCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("http://localhost:48000/api/deaths");
        const data = await res.json();
        setDeathCount(data.count || 0);
      } catch {
        console.warn("Could not fetch current death count");
      }
    }
    fetchCount();
  }, []);

  // listen for websocket “death” events broadcasted to window
  useEffect(() => {
    const handler = (e) => {
      const { count } = e.detail;
      setDeathCount(count);
      if (
        count % settings.deathCounterEmotesPerDeath == 0 &&
        settings.deathCounterEmotes?.length > 0
      ) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const spawnCount = 10;

          // Send multiple individual spawn messages
          for (let i = 0; i < spawnCount; i++) {
            // Get a random emote from the array
            const randomEmote =
              settings.deathCounterEmotes[
                Math.floor(Math.random() * settings.deathCounterEmotes.length)
              ];

            const payloadEmote = {
              type: "spawnEmote",
              emote: randomEmote,
              count: 1,
              triggeredAt: Date.now(),
            };
            wsRef.current.send(JSON.stringify(payloadEmote));
            console.log("🚀 Sent spawnEmote:", payloadEmote);
          }
        }
      }
    };
    window.addEventListener("poe-death", handler);
    return () => window.removeEventListener("poe-death", handler);
  }, [settings.deathCounterEmotes, wsRef, settings.deathCounterEmotesPerDeath]);

  return (
    <div
      id="poe-death-counter"
      style={{
        background: settings.deathCounterBackground,
        color: settings.deathCounterColor,
        fontSize: "128px",
        fontWeight: 700,
        textShadow: settings.deathCounterShadow
          ? `0 0 10px ${settings.deathCounterShadowColor}`
          : "none",
        transition: "transform 0.2s ease",
      }}
    >
      {settings.deathCounterPrefix} {deathCount}
    </div>
  );
}
