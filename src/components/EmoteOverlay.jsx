import { useState, useEffect, useRef } from "react";
import { useMetadata } from '../hooks/useMetadata';
import { useTwitchClient } from '../hooks/useTwitchClient';
import { useEmoteLoader } from '../hooks/useEmoteLoader';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine';
import { useEmoteSpawner } from '../hooks/useEmoteSpawner';
import { useGlobalEffects } from '../hooks/useGlobalEffects';
import { useMessageHandler } from '../hooks/useMessageHandler';
import { useEmoteLifecycle } from '../hooks/useEmoteLifecycle';
import { useRaidHandler } from '../hooks/useRaidHandler';

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

  return <EmoteOverlayCore key={refreshToken} {...settings} />;
}

function EmoteOverlayCore(settings) {
  const sceneRef = useRef(null);
  const bodiesWithTimers = useRef([]);

  // Initialize all hooks
  const client = useTwitchClient(settings.twitchName);
  const emoteMap = useEmoteLoader(settings.emoteSetId);
  const physics = usePhysicsEngine();
  const globalEffects = useGlobalEffects(physics.engine, bodiesWithTimers);
  const { spawnEmote } = useEmoteSpawner(physics.engine, emoteMap, bodiesWithTimers, settings);
  const { clearAllEmotes } = useEmoteLifecycle(physics.engine, bodiesWithTimers, settings.emoteLifetime);

  // Start DOM updates when physics engine is ready
  useEffect(() => {
    if (physics.engine) {
      physics.startDOMUpdates(bodiesWithTimers);
      return () => {
        physics.stopDOMUpdates();
        clearAllEmotes();
      };
    }
  }, [physics.engine, physics.startDOMUpdates, physics.stopDOMUpdates, clearAllEmotes]);

  // Set up message handling
  useMessageHandler(client, emoteMap, spawnEmote, globalEffects, settings);
  
  // Set up raid handling
  useRaidHandler(client, spawnEmote, settings.raidEffect, settings.emoteDelay);

  return (
    <div 
      ref={sceneRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 9999
      }}
    />
  );
}