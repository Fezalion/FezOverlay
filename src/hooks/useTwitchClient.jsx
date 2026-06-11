import { useEffect, useRef, useState } from "react";
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

let sharedClient = null;
let clientRefCount = 0;
let authPromise = null;

const fetchAuth = () => {
  if (authPromise) return authPromise;

  authPromise = fetch("/api/twitch")
    .then((r) => r.json())
    .then((data) => {
      log("info", "AUTH_OK", "Credentials received");
      return data;
    })
    .catch((err) => {
      log("error", "AUTH_FAIL", err.message);
      authPromise = null;
      throw err;
    });

  return authPromise;
};

// Updated signature to accept the full data payload from /api/twitch
const initializeClient = async (twitchName, authData, cid) => {
  if (sharedClient) {
    log("info", "CLIENT_REUSE", `Reusing existing client for ${twitchName}`);
    clientRefCount++;
    return sharedClient;
  }

  log("info", "CLIENT_INIT", `Target Room Channel: ${twitchName}`);

  // Use the authorized bot/user account name returned from the backend.
  // Fall back to target channel if backend credentials don't provide a username.
  const identityName = (authData.username || twitchName).toLowerCase();

  const newClient = new tmi.Client({
    options: {
      debug: false,
      clientId: cid,
      skipUpdatingEmotesets: true,
    },
    identity: {
      username: identityName, // The specific account that OWNS the OAuth token
      password: "oauth:" + authData.auth,
    },
    connection: {
      reconnect: true,
    },
    channels: [twitchName.toLowerCase()], // The targeted streamer chat room to enter
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

  newClient.on("logon", () =>
    log("info", "LOGON", `Authenticated as ${identityName}`),
  );

  newClient.on("join", (channel) =>
    log("info", "JOIN", `Joined room: ${channel}`),
  );

  try {
    await newClient.connect();
    log("info", "CONNECT_RESOLVED");
    sharedClient = newClient;
    clientRefCount++;
    return newClient;
  } catch (err) {
    log("error", "CONNECT_FAIL", err?.message ?? String(err));
    throw err;
  }
};

export function useTwitchClient(twitchName) {
  const [client, setClient] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    log("info", "AUTH_FETCH", "Requesting credentials");
    let ignore = false;

    fetchAuth()
      .then((data) => {
        if (ignore) return;
        // Pass the entire data object instead of just data.auth
        return initializeClient(twitchName, data, data.client);
      })
      .then((connectedClient) => {
        if (ignore || !mounted.current) return;
        setClient(connectedClient);
      })
      .catch((err) => {
        if (!ignore)
          log("error", "CLIENT_SETUP_FAIL", err?.message ?? String(err));
      });

    return () => {
      ignore = true;
    };
  }, [twitchName]);

  useEffect(() => {
    return () => {
      mounted.current = false;
      clientRefCount--;

      if (clientRefCount <= 0) {
        log("info", "CLEANUP", `Disconnecting (ref count: ${clientRefCount})`);
        if (sharedClient) {
          sharedClient.disconnect().catch(() => {});
          sharedClient = null;
        }
        clientRefCount = 0;
      } else {
        log(
          "info",
          "CLEANUP",
          `Component unmounted (ref count: ${clientRefCount})`,
        );
      }
    };
  }, []);

  return client;
}
