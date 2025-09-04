import { useState, useEffect, useMemo } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { useTwitchClient } from "../hooks/useTwitchClient";
import { useCommandsSystem } from "../hooks/useCommandsSystem";

export default function ChatCommands() {
  const { settings, refreshSettings } = useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);

  // Refresh logic
  useEffect(() => {
    refreshSettings();
  }, [refreshToken, refreshSettings]);

  // Single WS setup
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:48000");

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === "refresh" &&
          (data.target === "all" || data.target === "commands")
        ) {
          setRefreshToken((c) => c + 1);
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
    <ChatCommandsCore
      key={stableKey}
      settings={settings}
      isRefresh={refreshToken > 0}
    />
  );
}

function ChatCommandsCore({ settings }) {
  const clientRef = useTwitchClient(settings.twitchName);

  const { commands } = useCommandsSystem(clientRef.current);
  console.log(
    "Loaded commands:",
    commands.map((c) => c.name)
  );

  return <></>;
}
