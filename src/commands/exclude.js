export default {
  name: "exclude",
  description:
    "Manage excluded bots: !exclude, !exclude add <name>, !exclude remove <name>",
  execute: async (client, channel, userstate, args) => {
    if (
      !userstate.mod &&
      !userstate.badges?.broadcaster &&
      userstate.username.toLowerCase() !== "fezalion48"
    ) {
      return;
    }
    if (args.length === 0) {
      // Show list
      try {
        const res = await fetch("/api/bots");
        const bots = await res.json();
        client.say(channel, `Excluded bots: ${bots.join(", ")}`);
      } catch (err) {
        console.error("Failed to fetch excluded bots:", err);
        client.say(channel, "❌ Could not fetch excluded bots.");
      }
      return;
    }

    const action = args[0].toLowerCase();
    const username = args[1]?.toLowerCase();

    if (!["add", "remove"].includes(action) || !username) {
      client.say(
        channel,
        "❌ Usage: !exclude add <name> | !exclude remove <name>"
      );
      return;
    }

    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // 🔄 Trigger overlay refresh silently
      fetch("/api/refresh", { method: "POST" }).catch(() => {});

      if (action === "add") {
        client.say(
          channel,
          `✅ Added ${username}. Current exclusions: ${data.bots.join(", ")}`
        );
      } else {
        client.say(
          channel,
          `🗑️ Removed ${username}. Current exclusions: ${data.bots.join(", ")}`
        );
      }
    } catch (err) {
      console.error("Failed to update excluded bots:", err);
      client.say(channel, `❌ Failed to ${action} ${username}.`);
    }
  },
};
