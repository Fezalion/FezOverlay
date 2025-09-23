import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { useTwitchClient } from "../hooks/useTwitchClient";
import { useEmoteLoader } from "../hooks/useEmoteLoader";

const MOVE_AMOUNT = 1;
const MOVEMENT_DEBOUNCE_MS = 1000;

export default function ChatOverlay() {
  const { settings, refreshSettings, setLocalSetting, updateSettings } =
    useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);

  // Refresh logic
  useEffect(() => {
    refreshSettings();
  }, [refreshToken, refreshSettings]);

  // Single WS setup
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:48000");

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === "refresh" &&
          (data.target === "all" || data.target === "chat")
        ) {
          setRefreshToken((c) => c + 1);
        }
      } catch (err) {
        console.error("Invalid WS message:", err);
      }
    };

    ws.addEventListener("message", handleMessage);
    ws.addEventListener("error", (err) =>
      console.error("WebSocket error:", err)
    );
    ws.addEventListener("close", () => console.log("WebSocket closed"));

    return () => {
      ws.removeEventListener("message", handleMessage);
      ws.close();
    };
  }, []);

  const stableKey = useMemo(
    () => `chat-${settings.twitchName}-${settings.emoteSetId}`,
    [settings.twitchName, settings.emoteSetId]
  );

  return (
    <ChatOverlayCore
      key={stableKey}
      settings={settings}
      isRefresh={refreshToken > 0}
      setLocalSetting={setLocalSetting}
      updateSettings={updateSettings}
    />
  );
}

const useKeyboardMovement = (
  chatLocationCoords,
  setLocalSetting,
  updateSettings
) => {
  const movementTimeoutRef = useRef(null);
  const currentPositionRef = useRef({ x: 0, y: 0 });

  // Sync ref with props
  useEffect(() => {
    currentPositionRef.current = {
      x: chatLocationCoords.x,
      y: chatLocationCoords.y,
    };
  }, [chatLocationCoords]);

  const handleMovement = useCallback(
    (newPosition) => {
      currentPositionRef.current = newPosition;

      if (setLocalSetting) {
        setLocalSetting("chatLocationCoords", newPosition);
      }

      // Debounce server updates
      if (movementTimeoutRef.current) {
        clearTimeout(movementTimeoutRef.current);
      }

      movementTimeoutRef.current = setTimeout(() => {
        updateSettings({
          chatLocationX: newPosition.x,
          chatLocationY: newPosition.y,
        });
      }, MOVEMENT_DEBOUNCE_MS);
    },
    [setLocalSetting, updateSettings]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      const moveBy = e.shiftKey ? MOVE_AMOUNT * 5 : MOVE_AMOUNT;
      let newPosition = { ...currentPositionRef.current };
      let moved = false;

      switch (e.key) {
        case "ArrowUp":
          newPosition.y -= moveBy;
          moved = true;
          break;
        case "ArrowDown":
          newPosition.y += moveBy;
          moved = true;
          break;
        case "ArrowLeft":
          newPosition.x -= moveBy;
          moved = true;
          break;
        case "ArrowRight":
          newPosition.x += moveBy;
          moved = true;
          break;
        case " ":
          newPosition = { x: 0, y: 0 };
          moved = true;
          break;
        default:
          return;
      }

      if (moved) {
        e.preventDefault();
        handleMovement(newPosition);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (movementTimeoutRef.current) {
        clearTimeout(movementTimeoutRef.current);
      }
    };
  }, [handleMovement]);
};

const getPositionStyles = (coords, alignment) => {
  const baseStyles = {
    bottom: coords.y * -1,
  };

  switch (alignment) {
    case "left":
      return { ...baseStyles, left: coords.x };
    case "right":
      return { ...baseStyles, right: coords.x * -1 };
    default:
      return baseStyles;
  }
};

function ChatOverlayCore({ settings, setLocalSetting, updateSettings }) {
  const clientRef = useTwitchClient(settings.twitchName);
  const [messages, setMessages] = useState([]);
  const emotes = useEmoteLoader(settings.emoteSetId);
  const maxMessages = settings.maxChatMessages || 50;
  const fadeDuration = settings.chatFadeDuration || 10000;
  const fadeTransitionTime = settings.chatFadeTransition || 2000;

  const { chatLocationCoords, chatAlignment } = settings;

  useKeyboardMovement(chatLocationCoords, setLocalSetting, updateSettings);

  const [badges, setBadges] = useState({});
  const [auth, setAuth] = useState(null);
  const [cid, setCid] = useState(null);

  // Fetch auth + client ID from backend
  useEffect(() => {
    fetch("/api/twitch")
      .then((data) => data.json())
      .then((data) => {
        setAuth(data.auth);
        setCid(data.client);
      });
  }, []);

  // Fetch + normalize Twitch badges
  useEffect(() => {
    const setup = async () => {
      if (!auth || !cid) return;

      try {
        // 1. Resolve channel ID
        const userRes = await fetch(
          `https://api.twitch.tv/helix/users?login=${settings.twitchName}`,
          {
            headers: {
              "Client-ID": cid,
              Authorization: `Bearer ${auth}`,
            },
          }
        );
        const userJson = await userRes.json();
        const channelInfo = userJson.data?.[0];
        if (!channelInfo) return;
        const CHANNEL_ID = channelInfo.id;

        // 2. Fetch global badges
        const globalBadgesRes = await fetch(
          `https://api.twitch.tv/helix/chat/badges/global`,
          {
            headers: {
              "Client-ID": cid,
              Authorization: `Bearer ${auth}`,
            },
          }
        );
        const globalBadgesJson = await globalBadgesRes.json();

        // 3. Fetch channel badges
        const channelBadgesRes = await fetch(
          `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${CHANNEL_ID}`,
          {
            headers: {
              "Client-ID": cid,
              Authorization: `Bearer ${auth}`,
            },
          }
        );
        const channelBadgesJson = await channelBadgesRes.json();

        // 4. Normalize into map: badges[set][version] = { images... }
        const allBadges = {};
        const addBadges = (badgeSets) => {
          badgeSets.forEach((set) => {
            const setId = set.set_id;
            allBadges[setId] = {};
            set.versions.forEach((v) => {
              allBadges[setId][v.id] = {
                "1x": v.image_url_1x,
                "2x": v.image_url_2x,
                "4x": v.image_url_4x,
                title: v.title,
                description: v.description,
              };
            });
          });
        };

        addBadges(globalBadgesJson.data || []);
        addBadges(channelBadgesJson.data || []);
        setBadges(allBadges);
      } catch (err) {
        console.error("Failed to fetch badges:", err);
      }
    };

    setup();
  }, [auth, cid, settings.twitchName]);

  // Handle incoming chat messages
  useEffect(() => {
    // Check if client exists before trying to use it
    if (!clientRef.current) {
      console.log("Client not ready yet");
      return;
    }
    const client = clientRef.current;

    const handleMessage = (channel, userstate, message) => {
      const chatMessage = {
        id: userstate.id || `${Date.now()}-${Math.random()}`,
        displayName:
          userstate["display-name"] || userstate.username || "Anonymous",
        message,
        color: userstate.color || getRandomColor(),
        badges: userstate.badges || {},
        emotes: userstate.emotes || {},
        opacity: 1,
      };

      setMessages((prev) => [...prev.slice(-maxMessages + 1), chatMessage]);

      if (fadeDuration > 0) {
        const fadeStartTime = Math.max(0, fadeDuration - fadeTransitionTime);

        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === chatMessage.id ? { ...msg, opacity: 0 } : msg
            )
          );
        }, fadeStartTime);

        setTimeout(() => {
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== chatMessage.id)
          );
        }, fadeDuration);
      }
    };

    client.on("message", handleMessage);
    return () => client.off("message", handleMessage);
  }, [
    clientRef.current,
    clientRef,
    maxMessages,
    fadeDuration,
    fadeTransitionTime,
  ]);

  // Random color fallback
  const getRandomColor = () => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FECA57",
      "#FF9FF3",
      "#54A0FF",
      "#5F27CD",
      "#00D2D3",
      "#FF9F43",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Render badges inline
  const renderBadges = (msg) => {
    if (!msg.badges) return null;

    return Object.entries(msg.badges).map(([set, version]) => {
      const url =
        badges?.[set]?.[version]?.["2x"] || badges?.[set]?.[version]?.["1x"];
      if (!url) return null;
      return (
        <img
          key={`${set}-${version}`}
          src={url}
          alt={set}
          title={badges?.[set]?.[version]?.title || set}
          style={{ height: 18, marginRight: 4, display: "inline-block" }}
        />
      );
    });
  };

  // Render emotes inline using your 7TV "emotes" Map
  const renderEmotes = (msg, emotes) => {
    if (!emotes || emotes.size === 0) return msg;

    const parts = msg.split(/\s+/);
    const result = [];

    parts.forEach((word, i) => {
      const emote = emotes.get(word);
      if (emote) {
        result.push(
          <img
            key={`${word}-${i}`}
            src={emote.url}
            alt={word}
            style={{
              height: "1.4em", // scales with font size
              display: "inline",
              verticalAlign: "middle",
              margin: "0 2px",
            }}
          />
        );
      } else {
        result.push(word);
      }
      if (i < parts.length - 1) {
        result.push(" "); // reinsert space between words
      }
    });

    return result;
  };

  const chatStyles = useMemo(
    () => ({
      container: {
        ...getPositionStyles(chatLocationCoords, chatAlignment),
        position: "fixed",
        maxWidth: settings.chatWidth || "800px",
        maxHeight: settings.chatHeight || "100px",
        height: "auto",
        width: settings.chatWidth || "800px",
        backgroundColor: settings.chatBackgroundColor || "rgba(0,0,0,0)",
        fontSize: settings.chatFontSize || "14px",
        fontFamily: settings.chatFont || "Inter, system-ui, sans-serif",
      },
    }),
    [
      chatAlignment,
      chatLocationCoords,
      settings.chatWidth,
      settings.chatBackgroundColor,
      settings.chatHeight,
      settings.chatFontSize,
      settings.chatFont,
    ]
  );

  if (!clientRef.current) {
    return (
      <div
        className="flex flex-col text-white overflow-hidden"
        style={chatStyles.container}
      >
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Connecting to chat...
        </div>
      </div>
    );
  }

  return (
    <div
      style={chatStyles.container}
      className={
        settings.chatEditMode
          ? "flex flex-col-reverse flex-1 overflow-hidden p-2 outline bg-black/35"
          : "flex flex-col-reverse flex-1 overflow-hidden p-2"
      }
    >
      {messages
        .slice()
        .reverse()
        .map((msg) => (
          <div
            key={msg.id}
            className="flex items-start rounded-lg transform transition-all duration-300 ease-in-out"
            style={{
              opacity: msg.opacity,
              transition: `opacity ${fadeTransitionTime}ms ease-out`,
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm break-words leading-relaxed">
                {renderBadges(msg)}
                <span className="font-semibold" style={{ color: msg.color }}>
                  {msg.displayName}:
                </span>
                <span
                  style={{
                    color: settings.chatFontColor,
                    fontSize: settings.chatFontSize,
                  }}
                  className="ml-1"
                >
                  {renderEmotes(msg.message, emotes)}
                </span>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
