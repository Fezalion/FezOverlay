export default {
  name: "leaderboard",
  description: "Show leaderboard text in chat (top 5)",
  execute: async (client, channel) => {
    try {
      // 1. Check if a battle is active (Optional: remove if text doesn't interfere)
      const stateRes = await fetch(`/api/battle/state`);
      if (stateRes.ok) {
        const st = await stateRes.json();
        if (st?.active) {
          client.say(channel, "⚔️ Battle in progress — leaderboard is hidden.");
          return;
        }
      }

      const res = await fetch(`/api/leaderboard?limit=5`);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();

      if (!body || !body.top || body.top.length === 0) {
        client.say(channel, "The leaderboard is currently empty.");
        return;
      }

      // 3. Format the text for Twitch chat
      const medals = ["🥇", "🥈", "🥉", "◽", "◽"];
      const leaderboardText = body.top
        .map((user, index) => {
          const name = user.username || user.name;
          const safeName = name[0] + "\u200c" + name.slice(1);
          return `${medals[index] || "◽"} ${index + 1}. ${safeName} (${user.score})`;
        })
        .join("  |  ");

      // 4. Print the final result
      client.say(channel, `🏆 TOP 5: ${leaderboardText}`);
    } catch (err) {
      console.error("Failed to fetch leaderboard text:", err);
      client.say(channel, "❌ Error retrieving leaderboard.");
    }
  },
};
