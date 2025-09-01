import { useEffect, useState, useMemo, useRef } from "react";

export function useCommandsSystem(client) {
  const [commands, setCommands] = useState([]);
  const [customCommands, setCustomCommands] = useState([]);
  const wsRef = useRef(null);

  // Improved WebSocket setup with reconnect
  useEffect(() => {
    let ws;
    let reconnectTimeout;

    function connectWS() {
      ws = new WebSocket("ws://localhost:48000");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        const eventData = JSON.parse(event.data);
        if (eventData.type === "refresh") {
          console.log("🔄 Commands refreshing");
          fetch("/api/commands")
            .then((res) => res.json())
            .then((data) => {
              if (Array.isArray(data)) {
                setCustomCommands(data);
                console.log("[DEBUG] Reloaded custom commands:", data);
              }
            })
            .catch((err) => {
              console.error("Failed to reload custom commands:", err);
            });
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("WebSocket closed, reconnecting in 2s...");
        reconnectTimeout = setTimeout(connectWS, 2000);
      };
    }

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Dynamically import all command files in /commands
  useEffect(() => {
    const modules = import.meta.glob("../commands/*.js", { eager: true });
    const loadedCommands = Object.values(modules)
      .map((m) => m.default)
      .filter((cmd) => cmd?.name && typeof cmd.execute === "function");

    setCommands(loadedCommands);
  }, []);

  //load custom commands from server
  useEffect(() => {
    fetch("/api/commands")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomCommands(data);
          console.log("[DEBUG] Loaded custom commands:", data);
        }
      })
      .catch((err) => {
        console.error("Failed to load custom commands:", err);
      });
  }, []);

  // Build a map for quick lookup
  const commandMap = useMemo(() => {
    const map = new Map();
    for (const cmd of commands) {
      map.set(cmd.name.toLowerCase(), cmd);
    }
    return map;
  }, [commands]);

  //Build a map for custom commands
  const customCommandMap = useMemo(() => {
    const map = new Map();
    for (const cmd of customCommands) {
      map.set(cmd.name.toLowerCase(), cmd.text);
    }
    return map;
  }, [customCommands]);

  // Listen to Twitch messages
  useEffect(() => {
    if (!client) return;

    function onMessage(channel, userstate, message) {
      const [cmdName, ...args] = message.slice(1).split(" ");

      if (
        message.startsWith("!") &&
        customCommandMap.has(cmdName.toLowerCase())
      ) {
        // Respond with the custom command text
        // client.say(channel, );
        console.log(
          "Custom command triggered:",
          cmdName,
          customCommandMap.get(cmdName.toLowerCase())
        );
        client.say(channel, customCommandMap.get(cmdName.toLowerCase()));
      }

      if (
        !message.startsWith("!") &&
        (!userstate.mod || userstate.badges?.broadcaster)
      )
        return;

      const command = commandMap.get(cmdName.toLowerCase());
      if (command) {
        try {
          command.execute(client, channel, userstate, args);
        } catch (err) {
          console.error(`Error executing command "${cmdName}":`, err);
        }
      }
    }

    client.on("message", onMessage);
    return () => client.off("message", onMessage);
  }, [client, commandMap, customCommandMap]);

  return {
    commands: Array.from(commandMap.values()), // list of loaded commands
  };
}
