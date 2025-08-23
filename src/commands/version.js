export default {
  name: "version",
  description: "Shows the current version installed.",
  execute: async (client, channel, userstate, args) => {
    try {
      const cur = await showOverlayVersion();
      const lat = await getLatestRelease();

      if (!cur) {
        client.say(channel, "Could not fetch current version.");
        return;
      }

      if (!lat) {
        client.say(
          channel,
          `Installed version ${cur}, failed to fetch latest.`
        );
        return;
      }

      if (cur !== lat) {
        client.say(channel, `Installed version ${cur}, latest ${lat}`);
      } else {
        client.say(channel, `Installed version ${cur}`);
      }
    } catch (err) {
      console.error("Error in version command:", err);
      client.say(channel, "An error occurred while checking versions.");
    }
  },
};

async function getLatestRelease() {
  try {
    const res = await fetch("/api/latestversion");
    const data = await res.json();
    return data.version;
  } catch (err) {
    console.error("Failed to fetch latest version:", err);
    return null;
  }
}

async function showOverlayVersion() {
  try {
    const res = await fetch("/api/currentversion");
    const data = await res.json();
    return data.version;
  } catch (err) {
    console.error("Failed to fetch current version:", err);
    return null;
  }
}
