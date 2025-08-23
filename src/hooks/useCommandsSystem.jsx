import { useEffect, useState, useMemo } from "react";

export function useCommandsSystem(client) {
  const [commands, setCommands] = useState([]);

  // Dynamically import all command files in /commands
  useEffect(() => {
    const modules = import.meta.glob("../commands/*.js", { eager: true });
    const loadedCommands = Object.values(modules)
      .map((m) => m.default)
      .filter((cmd) => cmd?.name && typeof cmd.execute === "function");

    setCommands(loadedCommands);
  }, []);

  // Build a map for quick lookup
  const commandMap = useMemo(() => {
    const map = new Map();
    for (const cmd of commands) {
      map.set(cmd.name.toLowerCase(), cmd);
    }
    return map;
  }, [commands]);

  // Listen to Twitch messages
  useEffect(() => {
    if (!client) return;

    function onMessage(channel, userstate, message) {
      if (
        !message.startsWith("!") &&
        (!userstate.mod || userstate.badges?.broadcaster)
      )
        return;

      const [cmdName, ...args] = message.slice(1).split(" ");
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
  }, [client, commandMap]);

  return {
    commands: Array.from(commandMap.values()), // list of loaded commands
  };
}
