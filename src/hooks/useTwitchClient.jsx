import { useRef, useEffect, useState } from "react";

import tmi from "tmi.js";

export function useTwitchClient(twitchName) {
  const clientRef = useRef(null);
  const [auth, setAuth] = useState(null);
  const [cid, setCid] = useState(null);

  useEffect(() => {
    fetch("/api/twitch")
      .then((data) => data.json())
      .then((data) => {
        setAuth(data.auth);
        setCid(data.client);
      });
  }, []);

  useEffect(() => {
    if (!twitchName || !auth || !cid) return;

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

    client.connect().catch(console.error);
    clientRef.current = client;

    return () => {
      client.disconnect().catch(() => {});
      clientRef.current = null;
    };
  }, [twitchName, auth, cid]);

  return clientRef;
}
