export default {
  name: "command",
  description:
    "Add custom chat commands. Usage: !command add <name> <text> | !command remove <name> | !command list",
  execute: async (client, channel, userstate, args) => {
    if (args.length === 0) {
      try {
        const res = await fetch("/api/commands");
        const commands = await res.json();
        const commandNames = Array.isArray(commands)
          ? commands.map((cmd) =>
              typeof cmd === "string" ? cmd : cmd.name || JSON.stringify(cmd)
            )
          : [];
        client.say(channel, `${commandNames.join(", ")}`);
      } catch (err) {
        console.error("Failed to fetch commands:", err);
        client.say(channel, "❌ Could not fetch commands.");
      }
      return;
    }

    const action = args[0].toLowerCase();
    const name = args[1]?.toLowerCase();
    //text may contain spaces, so join all remaining args
    const text = args.slice(2).join(" ");

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
        const commandNames = Array.isArray(commands)
          ? commands.map((cmd) =>
              typeof cmd === "string" ? cmd : cmd.name || JSON.stringify(cmd)
            )
          : [];
        client.say(channel, `Commands: ${commandNames.join(", ")}`);
      } catch (err) {
        console.error("Failed to fetch commands:", err);
        client.say(channel, "❌ Could not fetch commands.");
      }
    }
  },
};
