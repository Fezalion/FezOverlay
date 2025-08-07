import { useState, useEffect, useRef} from "react";
import Matter from "matter-js";
import tmi from "tmi.js";

export function EmoteOverlay() {
  const [channelName, setChannelName] = useState(null);
  const [emoteSetId, setEmoteSetId] = useState(""); // Default 7tv emote set ID
  const [loading, setLoading] = useState(true);
  
  // Fetch channel name once on mount
  useEffect(() => {
    let finish = 0;
    if (loading) {
        fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
            console.log("Fetched settings:", data);
            if (data.twitchName && data.twitchName.length > 0) {
                setChannelName(data.twitchName);
                finish++
            } else {
                setChannelName(null); // fallback
            }

            if (data.emoteSetId && data.emoteSetId.length > 0) {
                setEmoteSetId(data.emoteSetId);
                finish++;
            }
            else {
                setEmoteSetId(""); // Default 7tv emote set ID
            }

            if (finish === 2) {
                setLoading(false);
            }
            else {
                console.warn("Failed to fetch complete settings, channelName or emoteSetId is missing.");
            }
        })
        .catch(err => {
            console.error("Failed to fetch twitch settings:", err);
            setChannelName(null); // fallback
            setEmoteSetId(""); // Default 7tv emote set ID
        });
    }
  }, []);

  if (channelName == null) {
    // Render nothing or a loader until channelName is ready
    return <div>Loading Twitch channel...</div>;
  }

  // Once channelName is set, render the full emote overlay and start effects
  return <EmoteOverlayCore twitchname={channelName} emoteset={emoteSetId} />;
}

function EmoteOverlayCore(args) {
  const sceneRef = useRef(null);
  const { twitchname, emoteset } = args;
  console.log("EmoteOverlayCore initialized with twitchname:", twitchname, "and emoteset:", emoteset);

  useEffect(() => {
    // Create physics engine
    const engine = Matter.Engine.create();
    const world = engine.world;

    const width = window.innerWidth;
    const height = window.innerHeight;
    engine.gravity.y = 1;


    // Store bodies with metadata
    const bodiesWithTimers = [];
    const LIFETIME = 5000; // 5 seconds

    // Create renderer bound to our div
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height,
        background: "#ffffff00",        
        wireframes: true,
        pixelRatio: window.devicePixelRatio || 1,
      }
    });

    // Add ground and walls (static)
    const ground = Matter.Bodies.rectangle(width / 2, height + 40, width, 40, { 
      isStatic: true,
      render: { fillStyle: "#000000" }
    });
    const wallThickness = 40;

    const walls = [
      // Left wall
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
        render: { fillStyle: "#000000" },
      }),
      // Right wall
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
        render: { fillStyle: "#000000" },
      }),
      // Top wall
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, {
        isStatic: true,
        render: { fillStyle: "#000000" },
      }),
      // Bottom wall
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, {
        isStatic: true,
        render: { fillStyle: "#000000" },
      }),
    ];


    Matter.World.add(world, [ground, ...walls]);
    const runner = Matter.Runner.create();
    // Run engine and renderer
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    //  --- 7tv Emote Setup ---
    let emoteMap = new Map();

    async function load7tvEmotes() {
        try {
            const res = await fetch("https://7tv.io/v3/emote-sets/" + emoteset);
            if (!res.ok) {
                console.error("Failed to fetch 7tv emotes:", res.statusText);
                return;
            }
            const data = await res.json();

            if (!data || !data.emotes) {
                console.error("No emotes found in 7tv response");
                return;
            }

            data.emotes.forEach(emote => {
                if (emote.name && emote.id) {
                  
                  if(emote.data.animated === true) {
                    emoteMap.set(emote.name, `https:${emote.data.host.url}/2x.gif`); // Use animated URL if available
                    console.log(`Adding emote: ${emote.name} with ID: ${emote.id}, is animated: ${emote.data.animated}`);
                  } else {
                    emoteMap.set(emote.name,  `https:${emote.data.host.url}/2x.webp`); // Get the highest resolution URL
                  }                   
                }
            });
            console.log(`Loaded ${emoteMap.size} 7tv emotes`);
        }
        catch (error) {
            console.error("Error loading 7tv emotes:", error);
        }
    }

    load7tvEmotes();
    console.log("trying to connect to twitch using channel: ", twitchname);
    //  --- Twitch Chat Setup ---
    const client = new tmi.Client({
        channels: [twitchname],
        connection: {
            reconnect: true,
            secure: true
        }
    });

    client.connect().catch(error => {console.error("Error connecting to twitch: ", error)});
        
    function spawnEmote(emoteName) {
      const x = 100 + (Math.random() * (width - 200));
      const size = 50 + Math.random() * 30;
      const emoteUrl = emoteMap.get(emoteName);

      const body = Matter.Bodies.rectangle(x, 5, size, size, {
        render: {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
          lineWidth: 0,
        }
      });

      Matter.World.add(world, body);
      Matter.Body.setVelocity(body, { x: (Math.random() * 30) - 15, y: -10 }); // random horizontal velocity
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2); // adds spin

      const el = createEmoteElement(emoteUrl, size);

      // Position immediately so it doesn't appear at (0,0)
      el.style.left = `${x - size / 2}px`;
      el.style.top = `${5 - size / 2}px`;

      bodiesWithTimers.push({ body, born: Date.now(), el, size });
    }



    function createEmoteElement(url, size) {
      const img = document.createElement("img");
      img.src = url;
      img.style.width = size + "px";
      img.style.height = size + "px";
      img.style.position = "fixed";
      img.style.pointerEvents = "none";
      img.style.zIndex = "9999";
      document.body.appendChild(img);
      return img;
  }
    //spawn emotes on chat messages

    client.on("message", (channel, tags, message, self) => {
        console.log(`Received message: ${message} from ${tags.username}`);
        //if there are multiple emotes in the message, delay them

        const words = message.split(/\s+/);
        const emotes = words.filter(word => emoteMap.has(word));
        
        emotes.forEach((emote, i) => {
        setTimeout(() => {
            spawnEmote(emote);
        }, i * 300); // 300ms delay per emote
        });
      });
    
    // Fade out on each update
    Matter.Events.on(engine, "beforeUpdate", () => {
      const now = Date.now();
      for (let i = bodiesWithTimers.length - 1; i >= 0; i--) {
        const { body, born, el } = bodiesWithTimers[i];
        const age = now - born;

        if (age >= LIFETIME) {
          Matter.World.remove(world, body);
          el.remove();
          bodiesWithTimers.splice(i, 1);
        } else if (age >= LIFETIME * 0.7) {
          const t = (LIFETIME - age) / (LIFETIME * 0.3);
          el.style.opacity = Math.max(t, 0);
        }
      }
    });


    Matter.Events.on(engine, "afterUpdate", () => {
      bodiesWithTimers.forEach(({ body, el }) => {
        const { x, y } = body.position;
        const size = parseFloat(el.style.width); // we already set px width
        el.style.left = `${x - size / 2}px`;
        el.style.top = `${y - size / 2}px`;
        el.style.transform = `rotate(${body.angle}rad)`;
      });
    });


    // Clean up on unmount
    return () => {
      bodiesWithTimers.forEach(({ el }) => el.remove());
      client.disconnect();
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      if (render.canvas && render.canvas.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas);
      }
      render.textures = {};
    };

  }, []);

  return <div ref={sceneRef} style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999 }} />;
}
