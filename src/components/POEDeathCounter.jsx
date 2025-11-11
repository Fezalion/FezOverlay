// POEDeathCounter.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { useTwitchClient } from "../hooks/useTwitchClient";

export default function POEDeathCounter() {
  const { settings, refreshSettings } = useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);
  const clientRef = useTwitchClient(settings.twitchName);
  const deathCounterShowDebug = false;
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

  // Pass wsRef and settings to the core component
  return (
    <POEDeathCounterCore
      key={stableKey}
      settings={settings}
      wsRef={wsRef}
      clientRef={clientRef}
      deathCounterShowDebug={deathCounterShowDebug}
    />
  );
}

function POEDeathCounterCore({ settings, wsRef, deathCounterShowDebug }) {
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

  // processDeathCount: central handler used by WS events and debug buttons
  const processDeathCount = useCallback(
    (count) => {
      // Ensure count is treated as a number. Some sources (WS or button handlers)
      // may pass strings which would cause concatenation (e.g. "137" + 1 => "1371").
      const n = Number(count) || 0;
      setDeathCount(n);

      if (
        !settings.deathCounterEmotes ||
        settings.deathCounterEmotes.length === 0
      )
        return;

      if (!(wsRef.current && wsRef.current.readyState === WebSocket.OPEN))
        return;

      const spawnCount = 10;

      const parseIntervals = (items) => {
        const out = [];
        const fallback =
          Number.isInteger(settings.deathCounterEmotesPerDeath) &&
          settings.deathCounterEmotesPerDeath > 0
            ? settings.deathCounterEmotesPerDeath
            : 10;
        for (const it of items) {
          if (!it) continue;
          const raw = String(it).trim();
          const parts = raw.split(":");
          const name = parts[0].trim();
          let interval = fallback;
          if (parts.length > 1) {
            const parsed = parseInt(parts[1].trim(), 10);
            if (!Number.isNaN(parsed) && parsed > 0) interval = parsed;
            else {
              console.warn(
                `Invalid interval for emote '${raw}', using fallback ${fallback}`
              );
            }
          }
          out.push({ name, interval });
        }
        return out;
      };

      const emotes = parseIntervals(settings.deathCounterEmotes || []);

      // Determine which emotes should trigger this death count
      const triggered = emotes.filter((e) => {
        if (!e.interval || e.interval <= 0) return false;
        return n % e.interval === 0;
      });

      if (triggered.length === 0) return;

      for (const em of triggered) {
        for (let i = 0; i < spawnCount; i++) {
          const payloadEmote = {
            type: "spawnEmote",
            emote: em.name,
            count: 1,
            triggeredAt: Date.now(),
          };
          wsRef.current.send(JSON.stringify(payloadEmote));
        }
        console.log(
          `🚀 Spawned ${spawnCount} x ${em.name} for death #${n} (interval ${em.interval})`
        );
      }
    },
    [settings, wsRef]
  );

  // listen for websocket “death” events broadcasted to window
  useEffect(() => {
    const handler = (e) => {
      const { count } = e.detail;
      processDeathCount(count);
    };
    window.addEventListener("poe-death", handler);
    return () => window.removeEventListener("poe-death", handler);
  }, [processDeathCount]);

  return (
    <div>
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

      {/* Debug UI: simulate 1 or 5 deaths (toggleable via settings) */}
      {deathCounterShowDebug && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            onClick={() => processDeathCount(deathCount + 1)}
            className="px-3 py-1 rounded bg-gray-700 text-white"
          >
            +1 death
          </button>
          <button
            onClick={() => processDeathCount(deathCount + 5)}
            className="px-3 py-1 rounded bg-gray-700 text-white"
          >
            +5 deaths
          </button>
        </div>
      )}
    </div>
  );
}
