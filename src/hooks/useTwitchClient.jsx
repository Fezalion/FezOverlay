// useTwitchClient.jsx

import { useEffect, useState } from "react";
import tmi from "tmi.js";

let sharedClient = null;
let authPromise = null;
let initPromise = null;
const subscribers = new Set();

const fetchAuth = () => {
  if (authPromise) return authPromise;
  authPromise = fetch("/api/twitch")
    .then((r) => r.json())
    .catch((err) => {
      authPromise = null;
      throw err;
    });
  return authPromise;
};

const getOrCreateClient = (twitchName) => {
  if (initPromise) return initPromise;

  initPromise = fetchAuth()
    .then((data) => {
      if (sharedClient) return sharedClient;

      const identityName = (data.username || twitchName).toLowerCase();
      const client = new tmi.Client({
        options: {
          clientId: data.client,
          skipUpdatingEmotesets: true,
          selfJoin: true,
        },
        identity: { username: identityName, password: "oauth:" + data.auth },
        connection: { reconnect: true },
        channels: [twitchName.toLowerCase()],
      });

      client.on("connecting", (a, p) =>
        console.log(`[TMI] Connecting ${a}:${p}`),
      );
      client.on("connected", (a, p) =>
        console.log(`[TMI] Connected ${a}:${p}`),
      );
      client.on("disconnected", (r) =>
        console.warn(`[TMI] Disconnected: ${r}`),
      );
      client.on("join", (ch) => console.log(`[TMI] Joined ${ch}`));

      return client.connect().then(() => {
        sharedClient = client;
        subscribers.forEach((cb) => cb(client));
        return client;
      });
    })
    .catch((err) => {
      initPromise = null; // allow retry
      throw err;
    });

  return initPromise;
};

export function useTwitchClient(twitchName) {
  const [client, setClient] = useState(sharedClient); // sync if already ready

  useEffect(() => {
    if (!twitchName) return;

    if (sharedClient) {
      setClient(sharedClient);
      return;
    }

    const cb = (c) => setClient(c);
    subscribers.add(cb);
    getOrCreateClient(twitchName).catch(() => {});

    return () => {
      subscribers.delete(cb);
    };
  }, [twitchName]);

  return client;
}
