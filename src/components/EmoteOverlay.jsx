import { useState, useEffect, useRef } from "react";
import Matter from "matter-js";
import tmi from "tmi.js";

export function EmoteOverlay() {
  const [settings, setSettings] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    // You can replace this URL with a variable or setting as needed
    const wsUrl = "ws://localhost:48000";

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data === "refresh") {
        setRefreshToken((c) => c + 1);
        console.log("refreshing");
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        setSettings(json);
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }

    fetchSettings();
  }, [refreshToken]); // Re-fetch settings whenever refreshToken increments

  if (!settings) return null;

  return <EmoteOverlayCore {...settings} />;
}

function EmoteOverlayCore({ twitchName, emoteSetId, emoteLifetime, emoteScale, emoteDelay }) {
  const sceneRef = useRef(null);
  const emoteMap = useRef(new Map());
  const bodiesWithTimers = useRef([]);
  const rafId = useRef(null);
  const clientRef = useRef(null);
  const spawnEmoteRef = useRef(null);

  // Twitch client connect/disconnect on twitchName change ONLY
  useEffect(() => {
    if (!twitchName) return;

    const client = new tmi.Client({
      options: { debug: false },
      connection: { reconnect: true, secure: true },
      channels: [twitchName],
    });

    client.connect().catch(console.error);
    clientRef.current = client;

    return () => {
      client.disconnect().catch(() => {});
      clientRef.current = null;
    };
  }, [twitchName]);

  // Load emotes & recreate physics engine when any of these change:
  useEffect(() => {
    if (!emoteSetId) return;

    let engine = Matter.Engine.create();
    let world = engine.world;
    engine.gravity.y = 1;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const wallThickness = 40;
    const walls = [
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, { isStatic: true }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { isStatic: true }),
    ];
    Matter.World.add(world, walls);

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    // Load emotes into new map
    async function fetchEmoteSet(set) {
      const res = await fetch(`https://7tv.io/v3/emote-sets/${set}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      return data?.emotes || [];
    }

    async function loadEmotes() {
      try {
        const [setEmotes, globalEmotes] = await Promise.all([fetchEmoteSet(emoteSetId), fetchEmoteSet("global")]);
        const allEmotes = [...setEmotes, ...globalEmotes];
        const newMap = new Map();
        allEmotes.forEach((emote) => {
          if (!emote.name || !emote.id) return;
          const file = emote.data.host.files[1]; // 2x res
          const url = `https:${emote.data.host.url}/${file.name}`;
          newMap.set(emote.name, { url, width: file.width, height: file.height });
        });
        emoteMap.current = newMap;
        console.log(`Loaded ${newMap.size} emotes`);
      } catch (e) {
        console.error("Error loading emotes:", e);
      }
    }

    loadEmotes();

    function createEmoteElement(url, sizeX, sizeY) {
      const img = document.createElement("img");
      img.src = url;
      img.style.width = sizeX + "px";
      img.style.height = sizeY + "px";
      img.style.position = "fixed";
      img.style.pointerEvents = "none";
      img.style.zIndex = "9999";
      img.style.transition = "opacity 0.5s linear";
      document.body.appendChild(img);
      return img;
    }

    spawnEmoteRef.current = (emoteName) => {
      const emote = emoteMap.current.get(emoteName);
      if (!emote) return;

      const sizeX = emote.width * emoteScale;
      const sizeY = emote.height * emoteScale;
      const x = 100 + Math.random() * (width - 200);

      const body = Matter.Bodies.rectangle(x, 5, sizeX, sizeY, { render: { visible: false } });
      Matter.World.add(world, body);
      Matter.Body.setVelocity(body, { x: (Math.random() * 30) - 15, y: -10 });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);

      const el = createEmoteElement(emote.url, sizeX, sizeY);
      bodiesWithTimers.current.push({ body, born: Date.now(), el, sizeX, sizeY });
    };

    Matter.Events.on(engine, "beforeUpdate", () => {
      const now = Date.now();
      for (let i = bodiesWithTimers.current.length - 1; i >= 0; i--) {
        const { body, born, el } = bodiesWithTimers.current[i];
        const age = now - born;
        if (age >= emoteLifetime) {
          Matter.World.remove(world, body);
          el.style.opacity = "0";
          setTimeout(() => el.remove(), 500);
          bodiesWithTimers.current.splice(i, 1);
        }
      }
    });

    function updateDOM() {
      bodiesWithTimers.current.forEach(({ body, el, sizeX, sizeY }) => {
        el.style.transform = `translate(${body.position.x - sizeX / 2}px, ${body.position.y - sizeY / 2}px) rotate(${body.angle}rad)`;
      });
      rafId.current = requestAnimationFrame(updateDOM);
    }
    rafId.current = requestAnimationFrame(updateDOM);

    return () => {
      cancelAnimationFrame(rafId.current);
      bodiesWithTimers.current.forEach(({ el }) => el.remove());
      bodiesWithTimers.current.length = 0;
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      emoteMap.current.clear();
      spawnEmoteRef.current = null;
    };
  }, [emoteSetId, emoteLifetime, emoteScale]);

  // Twitch message handler updates on twitchName, emoteDelay, and spawnEmoteRef
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !spawnEmoteRef.current) return;

    function onMessage(_, __, message) {
      const words = message.split(/\s+/);
      const emotes = words.filter((w) => emoteMap.current.has(w));
      emotes.forEach((emote, i) => {
        setTimeout(() => {
          spawnEmoteRef.current?.(emote);
        }, i * emoteDelay);
      });
    }

    client.on("message", onMessage);
    return () => {
      client.off("message", onMessage);
    };
  }, [twitchName, emoteDelay, emoteSetId, emoteScale, emoteLifetime]);

  return <div ref={sceneRef} style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999 }} />;
}
