import { useState, useEffect, useRef} from "react";
import Matter, { Body } from "matter-js";
import tmi from "tmi.js";

export function EmoteOverlayBucket() {
  // Fetch channel name once on mount
  const [channelName, setChannelName] = useState(null);
  const [emoteSetId, setEmoteSetId] = useState("");
  const [emoteLifetime, setEmoteLifetime] = useState(5000);
  const [emoteScale, setEmoteScale] = useState(1.0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) return;

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();

        console.log("Fetched settings:", data);

        const { twitchName, emoteSetId, emoteLifetime, emoteScale } = data;

        if (typeof twitchName === "string" && twitchName.length > 0) {
          setChannelName(twitchName);
        } else {
          console.warn("Missing or invalid twitchName");
        }

        if (typeof emoteSetId === "string" && emoteSetId.length > 0) {
          setEmoteSetId(emoteSetId);
        } else {
          console.warn("Missing or invalid emoteSetId");
        }

        if (typeof emoteLifetime === "number" && emoteLifetime > 0) {
          setEmoteLifetime(emoteLifetime);
        }

        if (typeof emoteScale === "number" && emoteScale > 0) {
          setEmoteScale(emoteScale);
        }

        // Set loading to false if required keys are valid
        if (twitchName && emoteSetId) {
          setLoading(false);
        } else {
          console.warn("Incomplete settings received.");
        }

      } catch (error) {
        console.error("Failed to fetch Twitch settings:", error);
      }
    };

    fetchSettings();
  }, [loading]);


  if (channelName == null) {
    // Render nothing or a loader until channelName is ready
    return <div>Loading Twitch channel...</div>;
  }

  // Once channelName is set, render the full emote overlay and start effects
  return <EmoteOverlayCore twitchname={channelName} emoteset={emoteSetId} emoteLifetime={emoteLifetime} emoteScale={emoteScale} />;
}

function EmoteOverlayCore(args) {
  const sceneRef = useRef(null);
  const { twitchname, emoteset, emoteLifetime, emoteScale } = args;

  useEffect(() => {
    // Create physics engine
    const engine = Matter.Engine.create();
    const world = engine.world;

    const width = window.innerWidth;
    const height = window.innerHeight;
    engine.gravity.y = 1;


    // Store bodies with metadata
    const bodiesWithTimers = [];
    const LIFETIME = emoteLifetime // 5 seconds

    // Create renderer bound to our div
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height,
        background: "#ffffff00",        
        wireframes: false,
        showAngleIndicator:true,
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

    const bucketWidth = 150;
    const bucketHeight = 170;
    const bwallThickness = 5;
    const bucketX = width / 2;    // center X position
    const bucketY = height / 1.5; // center Y position
    const wallAngleDeg = 10;

    const wallAngle = wallAngleDeg * (Math.PI / 180);

    // Calculate actual side wall length so it reaches top after tilting
    const sideWallLength = bucketHeight / Math.cos(wallAngle);

    // Half dimensions for easier math
    const halfW = bucketWidth / 2;
    const halfT = bwallThickness / 2;

    // Bottom wall
    const bottomWall = Matter.Bodies.rectangle(
      bucketX,
      bucketY,
      bucketWidth,
      bwallThickness,
      { isStatic: true, render: { fillStyle: "#ff0000" } }
    );

    // Left wall — bottom touching bottom wall's left end
    const leftWallX = bucketX - halfW + halfT * Math.cos(wallAngle);
    const leftWallY = bucketY - (sideWallLength / 2) * Math.cos(0); // vertical center

    const leftWall = Matter.Bodies.rectangle(
      leftWallX,
      leftWallY - (bucketHeight / 2) + (sideWallLength / 2), // center correction
      bwallThickness,
      sideWallLength,
      { isStatic: true, render: { fillStyle: "#ff0000" } }
    );
    Matter.Body.rotate(leftWall, -wallAngle);

    // Right wall — bottom touching bottom wall's right end
    const rightWallX = bucketX + halfW - halfT * Math.cos(wallAngle);
    const rightWallY = leftWallY;

    const rightWall = Matter.Bodies.rectangle(
      rightWallX,
      rightWallY - (bucketHeight / 2) + (sideWallLength / 2),
      bwallThickness,
      sideWallLength,
      { isStatic: true, render: { fillStyle: "#ff0000" } }
    );
    Matter.Body.rotate(rightWall, wallAngle);

    // Add to world
    const Bucket = [leftWall, rightWall, bottomWall];
    Matter.World.add(world, [ground, ...Bucket, ...walls]);

    // Run
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);


    //  --- 7tv Emote Setup ---
    let emoteMap = new Map();

    async function fetchEmoteSet(set) {
      const res = await fetch("https://7tv.io/v3/emote-sets/" + set);
            if (!res.ok) {
                console.error("Failed to fetch 7tv emotes:", res.statusText);
                return;
            }
            const data = await res.json();

            if (!data || !data.emotes) {
                console.error("No emotes found in 7tv response");
                return;
            }
            console.log(`Fetched ${data.emotes.length} emotes from 7tv set ${set}`);
            return data;
    }

    async function load7tvEmotes() {  
      const globalEmoteSetId = 'global'   
        try {
            const data = await fetchEmoteSet(emoteset);
            const globalData = await fetchEmoteSet(globalEmoteSetId);
            console.log("emote set has emotes: ", data.emotes.length, " global has: ", globalData?.emotes?.length ?? 0);
            data.emotes = data.emotes ?? [];
            if (globalData?.emotes) {
                data.emotes.push(...globalData.emotes);
            }

            console.log("Total emotes to load: ", data.emotes.length);

            console.log(globalData);




            data.emotes.forEach(emote => {
                if (emote.name && emote.id) {
                  
                  if(emote.data.animated === true) {
                    emoteMap.set(emote.name, `https:${emote.data.host.url}/2x.gif`); // Use animated URL if available
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
      const verticalOffset = 80;
      const horizontalOffset = 40;

      const x = bucketX + (Math.random() * (horizontalOffset * 2) - horizontalOffset);
      const y = bucketY - bucketHeight / 2 - verticalOffset
      const size = (25 + Math.random() * 30) * emoteScale; // Scale size based on emoteScale prop
      const emoteUrl = emoteMap.get(emoteName);

      const body = Matter.Bodies.rectangle(x, y, size, size, {
        render: {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
          lineWidth: 0,
        }
      });

      Matter.World.add(world, body);
      Matter.Body.setVelocity(body, { x: (Math.random() * 20) - 10, y: 2 }); // random horizontal velocity
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2); // adds spin

      const el = createEmoteElement(emoteUrl, size, x);

      // Position immediately so it doesn't appear at (0,0)
      el.style.left = `${x - size / 2}px`;
      el.style.top = `${5 - size / 2}px`;
      el.style.opacity = `1`;

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
      img.style.opacity = `0`;
      document.body.appendChild(img);
      return img;
    }
    //spawn emotes on chat messages

    client.on("message", (channel, tags, message, self) => {
        console.log(`Received message: ${message} from ${tags.username}`);
        //if there are multiple emotes in the message, delay them

        const words = message.split(/\s+/);
        const emotes = words.filter(word => emoteMap.has(word));
        console.log(`Found emotes: ${emotes.join(", ")}`);
        emotes.forEach((emote, i) => {
        setTimeout(() => {
            spawnEmote(emote);
        }, i * 100); // delay per emote
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
