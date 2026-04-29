export default {
  name: "leaderboard",
  description: "Show leaderboard with an ASCII border and Small Caps",
  execute: async (client, channel) => {
    try {
      const res = await fetch(`/api/leaderboard?limit=5`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        client.say(channel, "ᴛʜᴇ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ ɪs ᴄᴜʀʀᴇɴᴛʟʏ ᴇᴍᴘᴛʏ.");
        return;
      }

      const toSmallCaps = (text) => {
        const caps = {
          a: "ᴀ",
          b: "ʙ",
          c: "ᴄ",
          d: "ᴅ",
          e: "ᴇ",
          f: "ꜰ",
          g: "ɢ",
          h: "ʜ",
          i: "ɪ",
          j: "ᴊ",
          k: "ᴋ",
          l: "ʟ",
          m: "ᴍ",
          n: "ɴ",
          o: "ᴏ",
          p: "ᴘ",
          q: "ǫ",
          r: "ʀ",
          s: "s",
          t: "ᴛ",
          u: "ᴜ",
          v: "ᴠ",
          w: "ᴡ",
          x: "x",
          y: "ʏ",
          z: "ᴢ",
          0: "𝟶",
          1: "𝟷",
          2: "𝟸",
          3: "𝟹",
          4: "𝟺",
          5: "𝟻",
          6: "𝟼",
          7: "𝟽",
          8: "𝟾",
          9: "𝟿",
        };
        return text
          .toLowerCase()
          .split("")
          .map((char) => caps[char] || char)
          .join("");
      };

      const entries = data.slice(0, 5).map((user, index) => {
        const rawName = user.username || "Anon";
        const wins = (user.wins || 0).toString();

        const namePart = toSmallCaps(rawName);
        const winPart = toSmallCaps(wins);
        const rank = toSmallCaps((index + 1).toString());

        return `${rank}. ${namePart} ${winPart}ᴡ`;
      });

      const message = entries.join(" | ");

      client.say(channel, message);
    } catch (err) {
      console.error("Leaderboard Error:", err);
      client.say(channel, "❌ ᴇʀʀᴏʀ ʟᴏᴀᴅɪɴɢ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ.");
    }
  },
};
