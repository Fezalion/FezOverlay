export default {
  name: "leaderboard",
  description: "Show leaderboard on the emote overlay (top 5)",
  execute: async (client, channel) => {
    try {
      const limit = 5;
      const duration = 10000; // ms
      const res = await fetch(`/api/leaderboard/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, duration }),
      });

      if (res.status === 429) {
        // Cooldown in effect
        let retrySeconds = null;
        try {
          const json = await res.json();
          retrySeconds = json?.retryAfterSeconds ?? null;
        } catch {
          // ignore JSON parse error
        }
        if (!retrySeconds) {
          const h = res.headers.get("Retry-After");
          retrySeconds = h ? Number(h) : null;
        }
        if (retrySeconds) {
          client.say(
            channel,
            `Leaderboard is on cooldown. Try again in ${retrySeconds}s.`
          );
        } else {
          client.say(
            channel,
            `Leaderboard is on cooldown. Please try again later.`
          );
        }
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!body || !body.top || body.top.length === 0) {
        client.say(channel, "Leaderboard is empty.");
        return;
      }

      // Optionally notify chat that the overlay was triggered
      try {
        client.say(channel, `⚔️ Showing leaderboard — Top ${body.top.length}`);
      } catch {
        // ignore errors from chat notify
      }
    } catch (err) {
      console.error("Failed to announce leaderboard:", err);
      client.say(channel, "\u274c Could not fetch leaderboard.");
    }
  },
};
