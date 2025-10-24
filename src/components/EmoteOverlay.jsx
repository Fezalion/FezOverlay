import { useState, useEffect, useRef, useMemo } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { useTwitchClient } from "../hooks/useTwitchClient";
import { useEmoteLoader } from "../hooks/useEmoteLoader";
import { usePhysicsEngine } from "../hooks/usePhysicsEngine";
import { useEmoteSpawner } from "../hooks/useEmoteSpawner";
import { useGlobalEffects } from "../hooks/useGlobalEffects";
import { useMessageHandler } from "../hooks/useMessageHandler";
import { useEmoteLifecycle } from "../hooks/useEmoteLifecycle";
import { useRaidHandler } from "../hooks/useRaidHandler";
import { useSubscriberTracker } from "../hooks/useSubscriberTracker";

export default function EmoteOverlay() {
  const { settings, refreshSettings } = useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);
  const wsRef = useRef(null);

  // Refresh logic
  useEffect(() => {
    refreshSettings();
  }, [refreshToken, refreshSettings]);

  // Single WS setup
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:48000");
    wsRef.current = ws;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === "refresh" &&
          (data.target === "all" || data.target === "emotes")
        ) {
          setRefreshToken((c) => c + 1);
        } else {
          wsRef.current?.onCoreMessage?.(data);
        }
      } catch (err) {
        console.error("Invalid WS message:", err);
      }
    };

    ws.addEventListener("message", handleMessage);
    ws.addEventListener("error", (err) =>
      console.error("WebSocket error:", err)
    );
    ws.addEventListener("close", () => console.log("WebSocket closed"));

    // capture the ws instance for cleanup
    const wsInstance = ws;
    return () => {
      wsInstance.removeEventListener("message", handleMessage);
      wsInstance.close();
    };
  }, []);

  const stableKey = useMemo(
    () => `overlay-${settings.twitchName}-${settings.emoteSetId}`,
    [settings.twitchName, settings.emoteSetId]
  );

  return (
    <EmoteOverlayCore
      key={stableKey}
      settings={settings}
      isRefresh={refreshToken > 0}
      wsRef={wsRef}
      refreshToken={refreshToken}
    />
  );
}

function EmoteOverlayCore({ settings, wsRef, refreshToken }) {
  const sceneRef = useRef(null);
  const bodiesWithTimers = useRef([]);

  const clientRef = useTwitchClient(settings.twitchName);
  const emoteMap = useEmoteLoader(settings.emoteSetId, refreshToken, {
    twitchName: settings.twitchName,
    enableBTTV: settings.enableBTTV,
    enableFFZ: settings.enableFFZ,
    includeTwitchChannelEmotes: settings.includeTwitchChannelEmotes,
  });
  const physics = usePhysicsEngine();
  const subscriberTracker = useSubscriberTracker(
    clientRef.current,
    false,
    true
  );
  const viewerTracker = useSubscriberTracker(clientRef.current, true);

  const battleSettings = {
    battleEventChance: settings.battleEventChance,
    battleEventParticipants: settings.battleEventParticipants,
    battleEventHp: settings.battleEventHp,
    battleEventDamage: settings.battleEventDamage,
    battleEventDuration: settings.battleEventDuration,
    battleEventDPSTracker: settings.battleEventDPSTracker,
    battleEventDPSTrackerFloatLeft: settings.battleEventDPSTrackerFloatLeft,
    battleEventDPSTrackerLiveFloatLeft:
      settings.battleEventDPSTrackerLiveFloatLeft,
    battleEventDPSTrackerLive: settings.battleEventDPSTrackerLive,
    battleEventAcceptPlebs: settings.battleEventAcceptPlebs,
    battleEventShowSkillHistory: settings.battleEventShowSkillHistory,
    twitchName: settings.twitchName,
    emoteScale: settings.emoteScale ?? 1,
    emoteBaseSize: settings.emoteBaseSize ?? 64,
  };

  const globalEffects = useGlobalEffects(
    physics.engineRef,
    bodiesWithTimers,
    emoteMap,
    battleSettings,
    subscriberTracker,
    viewerTracker,
    sceneRef,
    clientRef
  );

  const { spawnEmote } = useEmoteSpawner(
    physics.engineRef.current,
    emoteMap,
    bodiesWithTimers,
    settings
  );

  // spawnEmote ref for WS messages
  const spawnEmoteRef = useRef(spawnEmote);
  useEffect(() => {
    spawnEmoteRef.current = spawnEmote;
  }, [spawnEmote]);

  // Attach a message handler for WS
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    ws.onCoreMessage = (data) => {
      if (data.type === "spawnEmote" && data.emote) {
        const count = data.count || 1;
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            spawnEmoteRef.current?.(data.emote);
          }, i * settings.emoteDelay);
        }
      } else if (data.type === "showLeaderboard" && Array.isArray(data.top)) {
        // Render leaderboard panel inside sceneRef if available
        try {
          const parent = sceneRef.current || document.body;
          const overlay = document.createElement("div");
          overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10002;
      animation: fadeIn 0.5s ease-out;
    `;

          const panel = document.createElement("div");
          panel.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid #4a9eff;
      border-radius: 15px;
      padding: 10px;
      max-width: 400px;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideIn 0.5s ease-out;
      position:absolute;
      top:50%;
      ${settings.battleEventLeaderboardFloatLeft ? "left:20px;" : "right:20px;"}
      transform: translateY(-50%);
    `;
          const style = document.createElement("style");
          style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform:translateY(-50%) translateX(-50px); opacity: 0; }
        to { transform:translateY(-50%) translateX(0); opacity: 1; }
      }      
    `;
          document.head.appendChild(style);
          const title = document.createElement("div");
          title.textContent = `⚔️ Leaderboard ⚔️`;
          title.style.cssText = `font-weight:700; color:#ffd43b; font-size:16px; margin-bottom:8px; text-align:center;`;
          panel.appendChild(title);

          const list = document.createElement("div");
          list.style.cssText = `display:flex; flex-direction:column; gap:6px;`;

          data.top.forEach((entry, i) => {
            const row = document.createElement("div");
            row.style.cssText = `display:flex; justify-content:space-between; align-items:center; font-size:14px;`;

            const left = document.createElement("div");
            left.textContent = `${i + 1}. ${entry.username}`;
            left.style.cssText = `color: ${
              i === 0
                ? "#ffd43b"
                : i === 1
                ? "#c0c0c0"
                : i === 2
                ? "#cd7f32"
                : "#fff"
            }; font-weight:600;`;

            const right = document.createElement("div");
            right.textContent = `${entry.wins} wins`;
            right.style.cssText = `color:#4a9eff; font-weight:700;`;

            row.appendChild(left);
            row.appendChild(right);
            list.appendChild(row);
          });

          panel.appendChild(list);
          overlay.appendChild(panel);
          parent.appendChild(overlay);

          const duration = Number(data.duration) || 10000;
          setTimeout(() => {
            overlay.style.transition = "opacity 0.3s ease-out";
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 350);
          }, duration);
        } catch (err) {
          console.error("Failed to render leaderboard overlay:", err);
        }
      }
    };

    return () => {
      if (ws) ws.onCoreMessage = null;
    };
  }, [settings.emoteDelay, wsRef, settings.battleEventLeaderboardFloatLeft]);

  const { clearAllEmotes } = useEmoteLifecycle(
    physics.engineRef.current,
    bodiesWithTimers,
    settings.emoteLifetime
  );

  // Start DOM updates when physics engine is ready
  useEffect(() => {
    if (physics.engineRef.current) {
      physics.startDOMUpdates(bodiesWithTimers, {
        emoteStaticMode: !!settings.emoteStaticMode,
      });
      return () => {
        physics.stopDOMUpdates();
        clearAllEmotes();
      };
    }
  }, [
    physics,
    physics.engine,
    physics.startDOMUpdates,
    physics.stopDOMUpdates,
    clearAllEmotes,
    settings.emoteStaticMode,
  ]);

  useMessageHandler(
    clientRef.current,
    emoteMap,
    spawnEmoteRef,
    globalEffects,
    settings
  );

  useRaidHandler(
    clientRef.current,
    spawnEmoteRef,
    settings.raidEffect,
    settings.emoteDelay
  );

  return (
    <>
      <div
        ref={sceneRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
      <svg
        id="effects-layer"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </>
  );
}
