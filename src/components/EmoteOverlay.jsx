import { useState, useEffect, useRef } from "react";
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
  const { settings, refreshSettings, version } = useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);
  const wsRef = useRef(null);
  const versionref = useRef(null);

  useEffect(() => {
    refreshSettings();
    versionref.current = version;
  }, [refreshToken, refreshSettings, version]);

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

  return <EmoteOverlayCore {...settings} version={versionref} />;
}

function EmoteOverlayCore({ version, ...settings }) {
  const sceneRef = useRef(null);
  const bodiesWithTimers = useRef([]);

  // Initialize all hooks
  const clientRef = useTwitchClient(settings.twitchName);
  const emoteMap = useEmoteLoader(settings.emoteSetId);
  const physics = usePhysicsEngine();
  const subscriberTracker = useSubscriberTracker(clientRef.current);

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
    twitchName: settings.twitchName,
  };

  const globalEffects = useGlobalEffects(
    physics.engineRef,
    bodiesWithTimers,
    emoteMap,
    battleSettings,
    subscriberTracker,
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

  if (globalEffects.battleSystem.isActive) {
    globalEffects.battleSystem.endBattle();
    console.log("end battle called");
  }

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
    settings,
    version.current
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
