export default {
  name: "command",
  description:
    "Add custom chat commands. Usage: !command add <name> <text> | !command remove <name> | !command list",
  execute: async (client, channel, userstate, args) => {
    if (args.length === 0) {
      // Show list
      try {
        const res = await fetch("/api/commands");
        const commands = await res.json();
        client.say(channel, `${commands.join(", ")}`);
      } catch (err) {
        console.error("Failed to fetch commands:", err);
        client.say(channel, "❌ Could not fetch commands.");
      }
      return;
    }

    const action = args[0].toLowerCase();
    const name = args[1]?.toLowerCase();
    const text = args[2]?.toLowerCase();

    if (!["add", "remove", "list"].includes(action)) {
      client.say(
        channel,
        "❌ Usage: !command add <name> <text> | !command remove <name> | !command list"
      );
      return;
    }

    if (action === "add" && (!text || !name)) {
      client.say(channel, "❌ Please provide text for the command.");
      return;
    }

    if (action === "add") {
      try {
        const res = await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, name: name, text: text }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // 🔄 Trigger overlay refresh silently
        fetch("/api/refresh", { method: "POST" }).catch(() => {});
        client.say(channel, `✅ Added ${name}.`);
      } catch (err) {
        console.error("Failed to update commands:", err);
        client.say(channel, `❌ Failed to ${action} ${name}.`);
      }
    } else if (action === "remove") {
      try {
        const res = await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, name }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // 🔄 Trigger overlay refresh silently
        fetch("/api/refresh", { method: "POST" }).catch(() => {});
        client.say(channel, `✅ Removed ${name}.`);
      } catch (err) {
        console.error("Failed to update commands:", err);
        client.say(channel, `❌ Failed to ${action} ${name}.`);
      }
    }

    if (action === "list") {
      try {
        const res = await fetch("/api/commands");
        const commands = await res.json();
        client.say(channel, `Commands: ${commands.join(", ")}`);
      } catch (err) {
        console.error("Failed to fetch commands:", err);
        client.say(channel, "❌ Could not fetch commands.");
      }
    }
  },
};
