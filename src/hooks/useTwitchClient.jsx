import { useRef, useEffect, useState } from "react";
import tmi from "tmi.js";

const logToServer = (event, detail = "") => {
  fetch("/api/twitch-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, detail }),
  }).catch(() => {}); // silent — don't let logging errors cause more errors
};

const log = (level, event, detail = "") => {
  const timestamp = new Date().toISOString();
  const msg = `[Twitch] [${timestamp}] [${event}]${detail ? ` — ${detail}` : ""}`;
  if (level === "error") {
    console.error(msg);
    logToServer(event, detail);
  } else if (level === "warn") console.warn(msg);
  else console.log(msg);
};

export function useTwitchClient(twitchName) {
  const clientRef = useRef(null);
  const [auth, setAuth] = useState(null);
  const [cid, setCid] = useState(null);

  useEffect(() => {
    log("info", "AUTH_FETCH", "Requesting credentials from /api/twitch");
    fetch("/api/twitch")
      .then((data) => data.json())
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

    const client = new tmi.Client({
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

    client.on("connecting", (address, port) =>
      log("info", "CONNECTING", `${address}:${port}`),
    );
    client.on("connected", (address, port) =>
      log("info", "CONNECTED", `${address}:${port}`),
    );
    client.on("disconnected", (reason) =>
      log("warn", "DISCONNECTED", reason ?? "no reason given"),
    );
    client.on("reconnect", () =>
      log("warn", "RECONNECT", "Attempting reconnection"),
    );
    client.on("logon", () =>
      log("info", "LOGON", "Authenticated with Twitch IRC"),
    );
    client.on("join", (channel) => log("info", "JOIN", `Joined ${channel}`));

    client
      .connect()
      .then(() => log("info", "CONNECT_RESOLVED"))
      .catch((err) => log("error", "CONNECT_FAIL", err?.message ?? err));

    clientRef.current = client;

    return () => {
      log("info", "CLEANUP", `Disconnecting from ${twitchName}`);
      client.disconnect().catch(() => {});
      clientRef.current = null;
    };
  }, [twitchName, auth, cid]);

  return clientRef;
}
