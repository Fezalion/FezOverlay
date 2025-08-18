import { useRef, useEffect } from "react";
import tmi from "tmi.js";

export function useTwitchClient(twitchName) {
  const clientRef = useRef(null);

  useEffect(() => {
    if (!twitchName) return;

    const client = new tmi.Client({
      options: {
        debug: false,
      },
      connection: {
        reconnect: true,
        secure: true,
      },
      channels: [twitchName],
    });

    client.connect().catch(console.error);
    clientRef.current = client;

    return () => {
      client.disconnect().catch(() => {});
      clientRef.current = null;
    };
  }, [twitchName]);

  return clientRef.current;
}
