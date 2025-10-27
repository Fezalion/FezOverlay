export default {
  name: "refresh",
  description: "Refreshes the overlays.",
  execute: async (client, channel, userstate, args) => {
    if (
      !userstate.mod &&
      !userstate.badges?.broadcaster &&
      userstate.username.toLowerCase() !== "fezalion48"
    ) {
      return;
    }
    try {
      if (args.length === 0) {
        //refresh overlays
        const res = await fetch("/api/refresh", { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        client.say(channel, "✅ Overlays refreshed.");
        return;
      }
      const target = args[0].toLowerCase();
      if (
        !["emotes", "yapmeter", "song", "commands", "chat"].includes(target)
      ) {
        client.say(
          channel,
          "❌ Usage: !refresh [emotes|yapmeter|song|commands|chat]. To refresh all, use !refresh without args."
        );
        return;
      }
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "refresh", target: target ?? "all" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      client.say(channel, `✅ Refreshed ${target}.`);
    } catch (err) {
      console.error("Error in refresh command:", err);
      client.say(channel, "An error occurred while refreshing overlays.");
    }
  },
};
