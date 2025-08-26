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
import { useCommandsSystem } from "../hooks/useCommandsSystem";

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
        if (data.type === "refresh") {
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
    />
  );
}

function EmoteOverlayCore({ settings, isRefresh, wsRef }) {
  const sceneRef = useRef(null);
  const bodiesWithTimers = useRef([]);

  const clientRef = useTwitchClient(settings.twitchName);
  const emoteMap = useEmoteLoader(settings.emoteSetId);
  const physics = usePhysicsEngine();
  const subscriberTracker = useSubscriberTracker(clientRef.current, false);
  const viewerTracker = useSubscriberTracker(clientRef.current, true);

  const battleSettings = {
    battleEventChance: settings.battleEventChance,
    battleEventParticipants: settings.battleEventParticipants,
    battleEventHp: settings.battleEventHp,
    battleEventDamage: settings.battleEventDamage,
    battleEventDuration: settings.battleEventDuration,
    battleEventDPSTracker: settings.battleEventDPSTracker,
    battleEventDPSTrackerFloatLeft: settings.battleEventDPSTrackerFloatLeft,
    battleEventDPSTrackerLive: settings.battleEventDPSTrackerLive,
    battleEventAcceptPlebs: settings.battleEventAcceptPlebs,
    twitchName: settings.twitchName,
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
      }
    };

    return () => {
      if (ws) ws.onCoreMessage = null;
    };
  }, [settings.emoteDelay, wsRef]);

  const { clearAllEmotes } = useEmoteLifecycle(
    physics.engineRef.current,
    bodiesWithTimers,
    settings.emoteLifetime
  );

  const { commands } = useCommandsSystem(clientRef.current);
  console.log(
    "Loaded commands:",
    commands.map((c) => c.name)
  );

  // Start DOM updates when physics engine is ready
  useEffect(() => {
    if (physics.engineRef.current) {
      physics.startDOMUpdates(bodiesWithTimers);
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
