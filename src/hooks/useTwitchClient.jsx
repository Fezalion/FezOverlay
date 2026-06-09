import { useEffect, useState } from "react";
import tmi from "tmi.js";

const logToServer = (event, detail = "") => {
  fetch("/api/twitch-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event, detail }),
  }).catch(() => {});
};

const log = (level, event, detail = "") => {
  const timestamp = new Date().toISOString();
  const msg = `[Twitch] [${timestamp}] [${event}]${detail ? ` — ${detail}` : ""}`;

  if (level === "error") {
    console.error(msg);
    logToServer(event, detail);
  } else if (level === "warn") {
    console.warn(msg);
  } else {
    console.log(msg);
  }
};

export function useTwitchClient(twitchName) {
  const [auth, setAuth] = useState(null);
  const [cid, setCid] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    log("info", "AUTH_FETCH", "Requesting credentials");

    fetch("/api/twitch")
      .then((r) => r.json())
      .then((data) => {
        log("info", "AUTH_OK", "Credentials received");
        setAuth(data.auth);
        setCid(data.client);
      })
      .catch((err) => {
        log("error", "AUTH_FAIL", err.message);
      });
  }, []);

  useEffect(() => {
    if (!twitchName || !auth || !cid) return;

    log("info", "CLIENT_INIT", `Channel: ${twitchName}`);

    const newClient = new tmi.Client({
      options: {
        debug: false,
        clientId: cid,
        skipUpdatingEmotesets: true,
      },
      identity: {
        username: twitchName,
        password: "oauth:" + auth,
      },
      connection: {
        reconnect: true,
      },
      channels: [twitchName],
    });

    newClient.on("connecting", (address, port) =>
      log("info", "CONNECTING", `${address}:${port}`),
    );

    newClient.on("connected", (address, port) =>
      log("info", "CONNECTED", `${address}:${port}`),
    );

    newClient.on("disconnected", (reason) =>
      log("warn", "DISCONNECTED", reason ?? "no reason given"),
    );

    newClient.on("reconnect", () =>
      log("warn", "RECONNECT", "Attempting reconnection"),
    );

    newClient.on("logon", () => log("info", "LOGON", "Authenticated"));

    newClient.on("join", (channel) => log("info", "JOIN", `Joined ${channel}`));

    newClient
      .connect()
      .then(() => {
        log("info", "CONNECT_RESOLVED");
        setClient(newClient);
      })
      .catch((err) => {
        log("error", "CONNECT_FAIL", err?.message ?? String(err));
      });

    return () => {
      log("info", "CLEANUP", `Disconnecting from ${twitchName}`);

      setClient(null);

      newClient.disconnect().catch(() => {});
    };
  }, [twitchName, auth, cid]);

  return client;
}
