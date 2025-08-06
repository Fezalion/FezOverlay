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
        wireframes: false,
        pixelRatio: window.devicePixelRatio || 1,
      }
    });

    // Add ground and walls (static)
    const ground = Matter.Bodies.rectangle(width / 2, height + 40, width, 40, { 
      isStatic: true,
      render: { fillStyle: "#000000" }
    });
    const walls = [
        Matter.Bodies.rectangle(-20, height / 2, 40, height, {
            isStatic: true,
            render: { fillStyle: "#000000" }
        }),
        Matter.Bodies.rectangle(width + 20, height / 2, 40, height, {
            isStatic: true,
            render: { fillStyle: "#000000" }
        })
    ]

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
                    emoteMap.set(emote.name,  `https:${emote.data.host.url}/2x.webp`); // Get the highest resolution URL
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
        const size = 50 + Math.random() * 30; // random size
        const emoteUrl = emoteMap.get(emoteName);
        console.log(`Spawning emote: ${emoteName} at ${x}, size: ${size} with URL: ${emoteUrl} `);
        const body = Matter.Bodies.rectangle(x, 5, size,size, {
            render: {
                sprite: {
                    texture: emoteUrl,
                    xScale: size / 70, // Adjust based on your emote size
                    yScale: size / 70
                },
                opacity: 1
            }
        });
        Matter.World.add(world, body);

        const xVel = (Math.random() * 20) - 10;
        Matter.Body.setVelocity(body, { x: xVel, y: -5 });

        bodiesWithTimers.push({ body, born: Date.now() });
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
        const { body, born } = bodiesWithTimers[i];
        const age = now - born;

        if (age >= LIFETIME) {
          // Remove completely when expired
          Matter.World.remove(world, body);
          bodiesWithTimers.splice(i, 1);
        } else if (age >= LIFETIME * 0.7) {
          // Start fading at 70% of lifetime
          const t = (LIFETIME - age) / (LIFETIME * 0.3); // goes 1 -> 0
          body.render.opacity = Math.max(t, 0);
        }
      }
    });

    // Clean up on unmount
    return () => {
      // Clear all pending timeouts
      pendingTimeouts.forEach(clearTimeout);

      // Remove event listener on Matter engine
      Matter.Events.off(engine, "beforeUpdate", beforeUpdateHandler);

      // Remove window resize listener
      window.removeEventListener("resize", handleResize);

      // Disconnect Twitch client
      client.disconnect();

      // Stop Matter.js runner and render
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);

      // Remove canvas
      if (render.canvas && render.canvas.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas);
      }
      render.textures = {};
    };
  }, []);

  return <div ref={sceneRef} style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999 }} />;
}
