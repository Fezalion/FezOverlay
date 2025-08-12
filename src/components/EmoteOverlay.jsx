import {
  useState,
  useEffect,
  useRef
} from "react";
import Matter from "matter-js";
import tmi from "tmi.js";

export function EmoteOverlay() {
  const [settings, setSettings] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const wsRef = useRef(null);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      setSettings(json);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  useEffect(() => {
    const wsUrl = "ws://localhost:48000";

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

    fetchSettings();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [refreshToken]);

  if (!settings) return null;

  return <EmoteOverlayCore {
    ...settings
  }
  />;
}

function EmoteOverlayCore({
  twitchName,
  emoteSetId,
  emoteLifetime,
  emoteScale,
  emoteDelay,
  subEffects,
  subEffectTypes
}) {
  const sceneRef = useRef(null);
  const emoteMap = useRef(new Map());
  const bodiesWithTimers = useRef([]);
  const rafId = useRef(null);
  const clientRef = useRef(null);
  const spawnEmoteRef = useRef(null);

  const lifetime = typeof emoteLifetime === "number" && emoteLifetime > 0 ? emoteLifetime : 5000;

  // Twitch client connection
  useEffect(() => {
    if (!twitchName) return;

    const client = new tmi.Client({
      options: {
        debug: false
      },
      connection: {
        reconnect: true,
        secure: true
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

  // Load emotes and initialize physics engine
  useEffect(() => {
    if (!emoteSetId) return;

    let engine = Matter.Engine.create();
    let world = engine.world;
    engine.gravity.y = 1;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const wallThickness = 40;
    const walls = [
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true
      }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true
      }),
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, {
        isStatic: true
      }),
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, {
        isStatic: true
      }),
    ];
    Matter.World.add(world, walls);

    bodiesWithTimers.current.forEach(({ el, particles }) => {
      el.remove();
      particles?.forEach((p) => p.el.remove());
    });
    bodiesWithTimers.current = [];

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    const effectsRegistry = {
      default: (el, body, engine) => {
        
      }
    };

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
          newMap.set(emote.name, {
            url,
            width: file.width,
            height: file.height,
            animated: emote.data.animated || false,
          });
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
      img.style.opacity = "0";
      img.style.transition = "opacity 0.5s ease";
      document.body.appendChild(img);

      requestAnimationFrame(() => {
        img.style.opacity = "1";
      });

      return img;
    }

    spawnEmoteRef.current = (emoteName, isSub = false, userColor = "orange") => {
      const emote = emoteMap.current.get(emoteName);
      if (!emote) return;
      const sizeX = emote.width * emoteScale;
      const sizeY = emote.height * emoteScale;
      const x = 100 + Math.random() * (width - 200);

      const body = Matter.Bodies.rectangle(x, 5, sizeX, sizeY, {
        render: {
          visible: false,
          isStatic: false
        },
        restitution: 1,
        friction: 0.1,
        frictionAir: 0.007
      });
      
      Matter.World.add(world, body);
      Matter.Body.setVelocity(body, {
        x: (Math.random() * 30) - 15,
        y: -10
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);

      if(isSub && subEffects && subEffectTypes != []) {
        let effect = effectsRegistry[subEffectTypes[Math.floor(Math.random() * subEffectTypes.length)]];
        if (effect) effect(el, body); // Pass the created <img> element instead of emote data
      }

      const el = createEmoteElement(emote.url, sizeX, sizeY, emote.animated);

      bodiesWithTimers.current.push({
        body,
        born: Date.now(),
        el,
        sizeX,
        sizeY,
        animated: emote.animated,
        isSub,
        particleColor: userColor
      });
    };

    Matter.Events.on(engine, "beforeUpdate", () => {
      const now = Date.now();
      for (let i = bodiesWithTimers.current.length - 1; i >= 0; i--) {
        const {
          body,
          born,
          el
        } = bodiesWithTimers.current[i];
        const age = now - born;
        if (age >= lifetime) {
          Matter.World.remove(world, body);
          el.style.opacity = "0";
          setTimeout(() => el.remove(), 500);
          bodiesWithTimers.current.splice(i, 1);
        }
      }
    });

    function updateDOM() {
      bodiesWithTimers.current.forEach((obj) => {
        const {
          body,
          el,
          sizeX,
          sizeY,
        } = obj;
        const x = body.position.x - sizeX / 2;
        const y = body.position.y - sizeY / 2;
        el.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;       
      });
      rafId.current = requestAnimationFrame(updateDOM);
    }
    rafId.current = requestAnimationFrame(updateDOM);

    // Clear all emotes on reload/update
    bodiesWithTimers.current.forEach(({
      body,
      el
    }) => {
      Matter.World.remove(world, body);
      el.remove();      
    });
    bodiesWithTimers.current = [];

    return () => {
      cancelAnimationFrame(rafId.current);
      bodiesWithTimers.current.forEach(({
        el,
      }) => {
        el.remove();        
      });
      bodiesWithTimers.current.length = 0;
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      emoteMap.current.clear();
      spawnEmoteRef.current = null;
    };
  }, [emoteSetId, emoteScale, lifetime, subEffectTypes, subEffects]);
  

  // Twitch message handler
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !spawnEmoteRef.current) return;

    function onMessage(channel, userstate, message) {
      const words = message.split(/\s+/);
      const emotes = words.filter((w) => emoteMap.current.has(w));
      emotes.forEach((emoteName, i) => {
        setTimeout(() => {
          const isSub =
            userstate.subscriber ||
            userstate.mod ||
            userstate.badges?.vip ||
            userstate.badges?.broadcaster;
          const userColor = userstate.color || "orange"; // fallback color
          spawnEmoteRef.current?.(emoteName, isSub, userColor);
        }, i * emoteDelay);
      });
    }


    client.on("message", onMessage);
    return () => {
      client.off("message", onMessage);
    };
  }, [twitchName, emoteDelay, emoteSetId, emoteScale, emoteLifetime]);

  return <div ref = {
    sceneRef
  }
  style = {
    {
      position: "fixed",
      top: 0,
      left: 0,
      pointerEvents: "none",
      zIndex: 9999
    }
  }
  />;
}