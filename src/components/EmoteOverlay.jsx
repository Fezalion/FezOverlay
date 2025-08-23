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

  useEffect(() => {
    refreshSettings();
  }, [refreshToken, refreshSettings]);

  useEffect(() => {
    const wsUrl = "ws://localhost:48000";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data === "refresh") {
        setRefreshToken((c) => c + 1);
        console.log("refreshing");
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  //stable key - let the battle system handle its own state preservation, that stupid mf
  const stableKey = useMemo(() => {
    return `overlay-${settings.twitchName}-${settings.emoteSetId}`;
  }, [settings.twitchName, settings.emoteSetId]);

  return (
    <EmoteOverlayCore
      key={stableKey}
      settings={settings}
      isRefresh={refreshToken > 0}
    />
  );
}

function EmoteOverlayCore({ settings, isRefresh }) {
  const sceneRef = useRef(null);
  const bodiesWithTimers = useRef([]);

  const clientRef = useTwitchClient(settings.twitchName);
  const emoteMap = useEmoteLoader(settings.emoteSetId);
  const physics = usePhysicsEngine();
  const subscriberTracker = useSubscriberTracker(clientRef.current, false);
  const viewerTracker = useSubscriberTracker(clientRef.current, true);

  // Extract battle settings
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

  // Set up message handling
  useMessageHandler(
    clientRef.current,
    emoteMap,
    spawnEmote,
    globalEffects,
    settings
  );

  // Set up raid handling
  useRaidHandler(
    clientRef.current,
    spawnEmote,
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
      ></svg>
    </>
  );
}
