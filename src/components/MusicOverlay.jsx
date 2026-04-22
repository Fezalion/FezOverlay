import { useEffect, useState, useRef, useCallback } from "react";
import YouTubePlayer from "../components/YouTubePlayer";
import {
  fetchPlaylistData,
  fetchVideoInfo,
  hasYoutubeApiKey,
  YOUTUBE_API_SETUP_URL,
} from "../utils/youtube";

// ============================================================
const WS_URL = "ws://localhost:48000";
const ACCENT_COLORS = [
  "#ff6b6b",
  "#feca57",
  "#48dbfb",
  "#ff9ff3",
  "#a29bfe",
  "#55efc4",
];
const getColor = (i) => ACCENT_COLORS[i % ACCENT_COLORS.length];
// ============================================================

function formatTime(secs) {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function WaveformBars({ color, small, isPlaying }) {
  const size = small ? "2px" : "3px";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        height: small ? "14px" : "20px",
      }}
    >
      {[0.5, 0.9, 0.6, 1, 0.4].map((h, i) => (
        <div
          key={i}
          style={{
            width: size,
            borderRadius: "2px",
            background: color,
            height: isPlaying ? `${h * 100}%` : "20%",
            opacity: isPlaying ? 1 : 0.4,
            animation: isPlaying
              ? `bar-bounce 0.${5 + i}s ease-in-out infinite alternate`
              : `bar-bounce 1.2s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.09}s`,
            transition: "all 0.2s ease",
            transformOrigin: "bottom",
          }}
        />
      ))}
    </div>
  );
}

function WsStatus({ connected }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: connected ? "#55efc4" : "#ff6b6b",
          animation: connected ? "pulse 2s infinite" : "none",
        }}
      />
      <span
        style={{
          fontSize: "10px",
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "1px",
        }}
      >
        {connected ? "LIVE" : "DISCONNECTED"}
      </span>
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span
      style={{
        fontSize: "9px",
        padding: "2px 7px",
        borderRadius: "20px",
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        letterSpacing: "0.5px",
        fontWeight: "500",
      }}
    >
      {children}
    </span>
  );
}

function IconBtn({ onClick, title, children, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: danger ? "rgba(255,107,107,0.5)" : "rgba(255,255,255,0.25)",
        fontSize: "14px",
        padding: "4px 6px",
        borderRadius: "6px",
        transition: "all 0.15s",
        lineHeight: 1,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = danger
          ? "#ff6b6b"
          : "rgba(255,255,255,0.7)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.color = danger
          ? "rgba(255,107,107,0.5)"
          : "rgba(255,255,255,0.25)")
      }
    >
      {children}
    </button>
  );
}

export default function Music() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlistInput, setPlaylistInput] = useState("");
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistImportInput, setPlaylistImportInput] = useState("");
  const [playlistImportLoading, setPlaylistImportLoading] = useState(false);
  const [youtubeApiKeyReady, setYoutubeApiKeyReady] = useState(hasYoutubeApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [youtubeApiKeyInput, setYoutubeApiKeyInput] = useState("");
  const [youtubeApiKeySaving, setYoutubeApiKeySaving] = useState(false);
  const [youtubeApiKeyError, setYoutubeApiKeyError] = useState("");
  const [youtubeApiKeySuccess, setYoutubeApiKeySuccess] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(25);
  const [activeTab, setActiveTab] = useState("queue"); // "queue" | "playlist" | "playlists"
  const [dragIndex, setDragIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragPlaylistIndex, setDragPlaylistIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);

  const playerRef = useRef(null);
  const queueRef = useRef(queue);
  const playlistRef = useRef([]);
  const timerRef = useRef(null);
  const savePlaylistsTimeoutRef = useRef(null);
  const hasLoadedPlaylistsRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const playlistIndexRef = useRef(0);

  const primaryPlaylist = playlists.find((entry) => entry.isPrimary) ?? null;
  const playlist = primaryPlaylist?.items ?? [];

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const playNext = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // 1. Clear the current song to force the Player to unmount
    setCurrent(null);

    // 2. Wait for the next tick so React finishes the unmount
    setTimeout(() => {
      const q = queueRef.current;
      if (q.length > 0) {
        const [next, ...rest] = q;
        setQueue(rest);
        setCurrent(next);
      } else if (playlistRef.current.length > 0) {
        const idx = playlistIndexRef.current % playlistRef.current.length;
        setCurrent({ ...playlistRef.current[idx], requestedBy: "AutoPlay" });
        playlistIndexRef.current =
          (playlistIndexRef.current + 1) % playlistRef.current.length;
      }

      setCurrentTime(0);
      setDuration(0);
      isTransitioningRef.current = false;
    }, 50); // 50ms is enough to let the DOM breathe
  }, []);

  useEffect(() => {
    playlistIndexRef.current = 0;
  }, [playlist, primaryPlaylist?.id]);

  useEffect(() => {
    return () => clearInterval(timerRef.current); // cleanup on unmount
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadSavedPlaylists = async () => {
      try {
        const res = await fetch("/api/music/playlists");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && Array.isArray(data)) {
          setPlaylists(data);
        }
      } catch (err) {
        console.error("[MusicOverlay] Failed to load playlists:", err);
      } finally {
        hasLoadedPlaylistsRef.current = true;
      }
    };
    loadSavedPlaylists();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchYoutubeApiStatus = async () => {
      try {
        const res = await fetch("/api/youtube/apikey/status");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.configured) setYoutubeApiKeyReady(true);
      } catch {
        // keep default state when endpoint is unavailable
      }
    };
    fetchYoutubeApiStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedPlaylistsRef.current) return;
    clearTimeout(savePlaylistsTimeoutRef.current);
    savePlaylistsTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/music/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlists }),
        });
      } catch (err) {
        console.error("[MusicOverlay] Failed to save playlists:", err);
      }
    }, 400);
  }, [playlists]);

  useEffect(() => {
    return () => clearTimeout(savePlaylistsTimeoutRef.current);
  }, []);

  useEffect(() => {
    let ws;
    let reconnectTimeout;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = async (event) => {
        try {
          const parsed =
            typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          await handleRedeemSongRequest(parsed);
        } catch {
          // Ignore non-JSON websocket payloads (e.g. legacy "refresh" string)
        }
      };
    };
    connect();
    return () => {
      ws?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [playNext]);

  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume]);

  const stopProgressTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startProgressTimer = useCallback(() => {
    stopProgressTimer();
    timerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const time = Number(player.getCurrentTime?.() ?? 0);
      const total = Number(player.getDuration?.() ?? 0);
      setCurrentTime(time);
      setDuration(total);
    }, 250);
  }, [stopProgressTimer]);

  useEffect(() => {
    if (!current?.videoId) {
      stopProgressTimer();
    }
  }, [current?.videoId, stopProgressTimer]);

  const togglePlay = () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const skip = () => playNext();

  const playQueueItem = (index) => {
    if (isTransitioningRef.current) return;
    const item = queue[index];
    if (!item) return;

    isTransitioningRef.current = true;
    setCurrent(null);

    setTimeout(() => {
      setQueue((q) => q.filter((_, i) => i !== index));
      setCurrent({ ...item, requestedBy: item.requestedBy ?? "Queue" });
      setCurrentTime(0);
      setDuration(0);
      isTransitioningRef.current = false;
    }, 10);
  };

  const removeFromQueue = (index) => {
    setQueue((q) => q.filter((_, i) => i !== index));
  };

  const moveQueueItem = (from, to) => {
    setQueue((q) => {
      const arr = [...q];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const updatePrimaryPlaylistItems = (updater) => {
    setPlaylists((prev) =>
      prev.map((entry) =>
        entry.isPrimary ? { ...entry, items: updater(entry.items ?? []) } : entry,
      ),
    );
  };

  const extractVideoId = useCallback((input) => {
    const source = String(input || "").trim();
    if (!source) return null;
    const match = source.match(
      /(?:v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    );
    return match ? match[1] : source.length === 11 ? source : null;
  }, []);

  const extractPlaylistId = (input) => {
    const playlistMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (playlistMatch?.[1]) return playlistMatch[1];
    return /^[a-zA-Z0-9_-]+$/.test(input) ? input : null;
  };

  async function handleRedeemSongRequest(payload) {
    if (!payload || typeof payload !== "object") return;
    const messageType = String(payload.type || "").toLowerCase();
    if (messageType !== "redeemsongrequest") return;

    const rawInput =
      payload.songUrl ||
      payload.url ||
      payload.videoUrl ||
      payload.videoId ||
      payload.song ||
      payload.message ||
      "";
    const videoId = extractVideoId(rawInput);
    if (!videoId) return;

    const requestedBy =
      payload.requestedBy ||
      payload.user ||
      payload.username ||
      payload.displayName ||
      "Viewer";

    const info = await fetchVideoInfo(videoId);
    setQueue((q) => [
      ...q,
      {
        videoId,
        title: info.title ?? videoId,
        channel: info.channel ?? "Unknown",
        requestedBy,
      },
    ]);
  }

  const triggerSongRequestDebug = async () => {
    await handleRedeemSongRequest({
      type: "redeemsongrequest",
      videoId: "dQw4w9WgXcQ",
      requestedBy: "DebugButton",
    });
  };

  const saveYoutubeApiKey = async () => {
    const apiKey = youtubeApiKeyInput.trim();
    if (!apiKey) {
      setYoutubeApiKeyError("Please paste an API key.");
      setYoutubeApiKeySuccess("");
      return;
    }

    setYoutubeApiKeySaving(true);
    setYoutubeApiKeyError("");
    setYoutubeApiKeySuccess("");
    try {
      const res = await fetch("/api/youtube/apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        setYoutubeApiKeyError(data?.error || "Failed to validate API key.");
        return;
      }

      setYoutubeApiKeyReady(true);
      setYoutubeApiKeyInput("");
      setYoutubeApiKeySuccess(
        "API key saved to .env. Restart the app/dev server to fully apply.",
      );
    } catch {
      setYoutubeApiKeyError("Network error while saving API key.");
    } finally {
      setYoutubeApiKeySaving(false);
    }
  };

  const addToPlaylist = async () => {
    if (!youtubeApiKeyReady) return;
    const input = playlistInput.trim();
    if (!input) return;

    const videoId = extractVideoId(input);

    if (!videoId) return;

    // Prevent adding the same video ID twice
    if (playlist.some((item) => item.videoId === videoId)) {
      setPlaylistInput("");
      return;
    }

    setPlaylistLoading(true);
    try {
      const info = await fetchVideoInfo(videoId);
      const newItem = { videoId, title: info.title, channel: info.channel };
      if (!primaryPlaylist) {
        setPlaylists([
          {
            id: crypto.randomUUID(),
            name: "Manual Playlist",
            sourceType: "manual",
            sourceId: null,
            isPrimary: true,
            items: [newItem],
          },
        ]);
      } else {
        updatePrimaryPlaylistItems((items) => [...items, newItem]);
      }
      setPlaylistInput("");
    } catch {
      const fallbackItem = { videoId, title: videoId, channel: "Unknown" };
      if (!primaryPlaylist) {
        setPlaylists([
          {
            id: crypto.randomUUID(),
            name: "Manual Playlist",
            sourceType: "manual",
            sourceId: null,
            isPrimary: true,
            items: [fallbackItem],
          },
        ]);
      } else {
        updatePrimaryPlaylistItems((items) => [...items, fallbackItem]);
      }
      setPlaylistInput("");
    }
    setPlaylistLoading(false);
  };

  const importYoutubePlaylist = async () => {
    if (!youtubeApiKeyReady) return;
    const input = playlistImportInput.trim();
    if (!input) return;
    const playlistId = extractPlaylistId(input);
    if (!playlistId) return;

    setPlaylistImportLoading(true);
    try {
      const data = await fetchPlaylistData(playlistId);
      const items = (data.items ?? []).filter((item) => item?.videoId);
      setPlaylists((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: data.title || "Imported Playlist",
          sourceType: "youtube",
          sourceId: playlistId,
          isPrimary: prev.length === 0,
          items,
        },
      ]);
      setPlaylistImportInput("");
    } finally {
      setPlaylistImportLoading(false);
    }
  };

  const playPlaylistItem = (index) => {
    const item = playlist[index];
    if (!item || isTransitioningRef.current) return; // Prevent double-triggers

    isTransitioningRef.current = true; // Lock the transition

    // Clear the current state first to force a clean unmount of the player
    setCurrent(null);

    setTimeout(() => {
      setCurrent({ ...item, requestedBy: "Playlist" });
      setCurrentTime(0);
      setDuration(0);
      playlistIndexRef.current = index + 1;
      isTransitioningRef.current = false;
    }, 10); // A tiny delay allows React to flush the unmount
  };

  const removeFromPlaylist = (index) => {
    updatePrimaryPlaylistItems((items) => items.filter((_, i) => i !== index));
  };

  const setPrimaryPlaylist = (playlistId) => {
    setPlaylists((prev) =>
      prev.map((entry) => ({ ...entry, isPrimary: entry.id === playlistId })),
    );
    playlistIndexRef.current = 0;
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists((prev) => {
      const remaining = prev.filter((entry) => entry.id !== playlistId);
      if (remaining.length > 0 && !remaining.some((entry) => entry.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  };

  const controlBtnStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    padding: "6px 10px",
    fontSize: "13px",
    transition: "all 0.15s",
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const accent = "#ff6b6b";

  return (
    <div
      style={{
        height: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "'DM Mono', 'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bar-bounce { from{transform:scaleY(0.3)} to{transform:scaleY(1)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .row-hover:hover { background: rgba(255,255,255,0.04) !important; }
        .tab-btn { transition: all 0.15s; }
        iframe {
          width: 100% !important;
          height: 100% !important;
          border: none;
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <div
        style={{
          height: "56px",
          background: "#111118",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: "16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "18px",
            fontWeight: "800",
            letterSpacing: "-0.5px",
          }}
        >
          FezOverlay<span style={{ color: accent }}>Music.</span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={triggerSongRequestDebug}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "8px",
            color: "rgba(255,255,255,0.75)",
            fontFamily: "inherit",
            fontSize: "10px",
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: "6px 10px",
          }}
          title="Simulate redeemsongrequest websocket payload"
        >
          Test WS
        </button>
        {!youtubeApiKeyReady && (
          <button
            onClick={() => setShowApiKeyModal(true)}
            style={{
              fontSize: "10px",
              color: "#feca57",
              border: "1px solid rgba(254,202,87,0.4)",
              borderRadius: "8px",
              padding: "6px 10px",
              background: "rgba(254,202,87,0.08)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Configure Google/YouTube API key"
          >
            Missing Google API Key
          </button>
        )}
        <WsStatus connected={wsConnected} />
      </div>

      {showApiKeyModal && (
        <div
          onClick={() => setShowApiKeyModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 92vw)",
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700 }}>
              Configure Google / YouTube API Key
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
              Create a key in{" "}
              <a
                href={YOUTUBE_API_SETUP_URL}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#feca57" }}
              >
                Google Cloud Console
              </a>{" "}
              and paste it below. The server validates it before writing to `.env`.
            </div>
            <input
              value={youtubeApiKeyInput}
              onChange={(e) => setYoutubeApiKeyInput(e.target.value)}
              placeholder="AIza..."
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: "8px",
                padding: "10px 12px",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "12px",
                outline: "none",
              }}
            />
            {youtubeApiKeyError && (
              <div style={{ fontSize: "11px", color: "#ff6b6b" }}>
                {youtubeApiKeyError}
              </div>
            )}
            {youtubeApiKeySuccess && (
              <div style={{ fontSize: "11px", color: "#55efc4" }}>
                {youtubeApiKeySuccess}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => setShowApiKeyModal(false)}
                style={{
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  color: "rgba(255,255,255,0.8)",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                onClick={saveYoutubeApiKey}
                disabled={youtubeApiKeySaving}
                style={{
                  padding: "8px 12px",
                  background: `${accent}22`,
                  border: `1px solid ${accent}66`,
                  borderRadius: "8px",
                  color: accent,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  opacity: youtubeApiKeySaving ? 0.5 : 1,
                }}
              >
                {youtubeApiKeySaving ? "Saving..." : "Validate & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* ── LEFT: NOW PLAYING ── */}
        <div
          style={{
            width: "clamp(320px, 30%, 420px)",
            flexShrink: 0,
            background: "#111118",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* player embed (hidden visually but functional) */}
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#000",
              position: "relative",
            }}
          >
            {/* The key={current.videoId} ensures React kills the old instance entirely */}
            {current?.videoId ? (
              <YouTubePlayer
                key={current.videoId}
                videoId={current.videoId}
                onReady={(player) => {
                  playerRef.current = player;
                  player.setVolume(volume);
                  setCurrentTime(0);
                  setDuration(Number(player.getDuration?.() ?? 0));
                  startProgressTimer();
                }}
                onStateChange={(e) => {
                  if (e.data === 1) {
                    setIsPlaying(true);
                    startProgressTimer();
                  }
                  if (e.data === 2 || e.data === 3) {
                    setIsPlaying(false);
                    stopProgressTimer();
                  }
                }}
                onEnd={playNext}
              />
            ) : (
              <div style={{ color: "#333", padding: "20px" }}>
                Loading Player...
              </div>
            )}
          </div>

          {/* now playing card */}
          <div
            style={{
              padding: "24px 20px 20px",
              background: `linear-gradient(160deg, ${accent}14 0%, transparent 55%)`,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: accent,
                  animation: "pulse 2s infinite",
                }}
              />
              <span
                style={{
                  fontSize: "9px",
                  letterSpacing: "3px",
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                }}
              >
                Now Playing
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: "14px",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "12px",
                  background: `${accent}22`,
                  border: `1px solid ${accent}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 4px 24px ${accent}22`,
                }}
              >
                <WaveformBars color={accent} isPlaying={isPlaying} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: "15px",
                    fontWeight: "800",
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {current?.title ?? "Nothing playing"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.8)",
                    marginTop: "3px",
                  }}
                >
                  {current?.channel ?? "—"}
                </div>
                {current?.requestedBy && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.6)",
                      marginTop: "3px",
                    }}
                  >
                    by{" "}
                    <span style={{ color: accent }}>{current.requestedBy}</span>
                  </div>
                )}
              </div>
            </div>

            {/* progress */}
            <div
              style={{
                height: "3px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: "2px",
                overflow: "hidden",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
                  transition: "width 0.5s linear",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "12px",
                marginTop: "14px",
              }}
            >
              {/* PLAY / PAUSE */}
              <button
                onClick={togglePlay}
                style={{
                  ...controlBtnStyle,
                  fontSize: "16px",
                  padding: "8px 12px",
                }}
                title="Play/Pause"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>

              {/* NEXT */}
              <button onClick={skip} style={controlBtnStyle} title="Next">
                ⏭
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* controls */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* volume */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.6)",
                  width: "26px",
                }}
              >
                VOL
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  playerRef.current?.setVolume(v);
                }}
                style={{
                  flex: 1,
                  appearance: "none",
                  WebkitAppearance: "none",
                  height: "3px",
                  borderRadius: "2px",
                  outline: "none",
                  cursor: "pointer",
                  background: `linear-gradient(90deg, ${accent} ${volume}%, rgba(255,255,255,0.1) ${volume}%)`,
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.6)",
                  width: "28px",
                  textAlign: "right",
                }}
              >
                {volume}%
              </span>
            </div>
          </div>

          {/* mini queue preview */}
          <div style={{ padding: "14px 20px 8px" }}>
            <span
              style={{
                fontSize: "9px",
                letterSpacing: "2px",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
              }}
            >
              Next up
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {queue.length === 0 ? (
              <div
                style={{
                  padding: "12px 20px",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                Queue empty — playlist will play
              </div>
            ) : (
              queue.slice(0, 4).map((item, i) => {
                const c = getColor(i);
                const isCurrentSong = current?.videoId === item.videoId;
                return (
                  <div
                    key={`${item.videoId}-${i}`}
                    className="row-hover"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 20px",
                      borderLeft: `2px solid ${isCurrentSong ? accent : c}66`,
                      background: isCurrentSong ? `${accent}1a` : "transparent",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: c, width: "16px" }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.65)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title ?? item.videoId}
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {item.requestedBy}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {queue.length > 4 && (
              <div
                style={{
                  padding: "8px 20px",
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                +{queue.length - 4} more in queue
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: QUEUE + PLAYLIST TABS ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* tabs */}
          <div
            style={{
              display: "flex",
              gap: "0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "0 24px",
            }}
          >
            {[
              { id: "queue", label: `Request Queue`, count: queue.length },
              {
                id: "playlist",
                label: "Primary Playlist",
                count: playlist.length,
              },
              {
                id: "playlists",
                label: "Playlists",
                count: playlists.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                className="tab-btn"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "14px 0",
                  marginRight: "24px",
                  fontFamily: "inherit",
                  fontSize: "11px",
                  letterSpacing: "1px",
                  color:
                    activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.6)",
                  borderBottom:
                    activeTab === tab.id
                      ? `2px solid ${accent}`
                      : "2px solid transparent",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  textTransform: "uppercase",
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background:
                        activeTab === tab.id
                          ? `${accent}33`
                          : "rgba(255,255,255,0.08)",
                      color:
                        activeTab === tab.id ? accent : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── QUEUE TAB ── */}
          {activeTab === "queue" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {queue.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "200px",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "28px", opacity: 0.2 }}>♪</div>
                  <div
                    style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}
                  >
                    No requests yet
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {["#", "Song", "Channel", "Requested by", ""].map(
                        (h, i) => (
                          <th
                            key={i}
                            style={{
                              padding: "10px 16px",
                              textAlign: "left",
                              fontSize: "9px",
                              color: "rgba(255,255,255,0.6)",
                              letterSpacing: "2px",
                              textTransform: "uppercase",
                              fontWeight: "400",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item, i) => {
                      const c = getColor(i);
                      const isCurrentSong = current?.videoId === item.videoId;
                      return (
                        <tr
                          key={item.videoId}
                          className="row-hover"
                          draggable
                          onDoubleClick={() => playQueueItem(i)}
                          onDragStart={() => setDragIndex(i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIndex !== null && dragIndex !== i)
                              moveQueueItem(dragIndex, i);
                            setDragIndex(null);
                          }}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            cursor: "grab",
                            background:
                              dragIndex === i
                                ? "rgba(255,255,255,0.08)"
                                : isCurrentSong
                                  ? `${accent}1f`
                                  : "transparent",
                          }}
                        >
                          <td style={{ padding: "12px 16px", width: "48px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                color: c,
                                fontWeight: "500",
                              }}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </td>
                          <td
                            style={{ padding: "12px 16px", maxWidth: "260px" }}
                          >
                            <div
                              style={{
                                fontSize: "13px",
                                color: "#fff",
                                fontWeight: "500",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.title ?? item.videoId}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                color: "rgba(255,255,255,0.6)",
                              }}
                            >
                              {item.channel ?? "—"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <Tag color={c}>{item.requestedBy ?? "anon"}</Tag>
                          </td>
                          <td
                            style={{ padding: "12px 16px", textAlign: "right" }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: "2px",
                                justifyContent: "flex-end",
                              }}
                            >
                              <IconBtn
                                onClick={() =>
                                  moveQueueItem(i, Math.max(0, i - 1))
                                }
                                title="Move up"
                                disabled={i === 0}
                              >
                                ↑
                              </IconBtn>
                              <IconBtn
                                onClick={() =>
                                  moveQueueItem(
                                    i,
                                    Math.min(queue.length - 1, i + 1),
                                  )
                                }
                                title="Move down"
                              >
                                ↓
                              </IconBtn>
                              <IconBtn
                                onClick={() => removeFromQueue(i)}
                                title="Remove"
                                danger
                              >
                                ✕
                              </IconBtn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── PLAYLIST TAB ── */}
          {activeTab === "playlist" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* add input */}
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  gap: "10px",
                }}
              >
                {!youtubeApiKeyReady && (
                  <div
                    style={{
                      width: "100%",
                      fontSize: "11px",
                      color: "#feca57",
                      background: "rgba(254,202,87,0.08)",
                      border: "1px solid rgba(254,202,87,0.35)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                    }}
                  >
                    Missing `VITE_YOUTUBE_API_KEY`. Add it to your `.env`, then
                    create one at{" "}
                    <a
                      href={YOUTUBE_API_SETUP_URL}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#feca57" }}
                    >
                      Google Cloud Console
                    </a>
                    .
                  </div>
                )}
                <input
                  value={playlistInput}
                  onChange={(e) => setPlaylistInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addToPlaylist()}
                  placeholder="YouTube URL or video ID..."
                  disabled={!youtubeApiKeyReady}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
                <button
                  onClick={addToPlaylist}
                  disabled={playlistLoading || !youtubeApiKeyReady}
                  style={{
                    padding: "8px 16px",
                    background: `${accent}22`,
                    border: `1px solid ${accent}55`,
                    borderRadius: "8px",
                    color: accent,
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "0.5px",
                    opacity: playlistLoading || !youtubeApiKeyReady ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {playlistLoading ? "..." : "+ Add"}
                </button>
              </div>

              {/* playlist list */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {playlist.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "200px",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "28px", opacity: 0.2 }}>♪</div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      No songs in playlist
                    </div>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {["#", "Title", "Channel", "Video ID", ""].map(
                          (h, i) => (
                            <th
                              key={i}
                              style={{
                                padding: "10px 16px",
                                textAlign: "left",
                                fontSize: "9px",
                                color: "rgba(255,255,255,0.6)",
                                letterSpacing: "2px",
                                textTransform: "uppercase",
                                fontWeight: "400",
                              }}
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {playlist.map((item, i) => {
                        const isDropTarget = dropTargetIndex === i;
                        const isBeingDragged = dragPlaylistIndex === i;
                        const c = getColor(i);
                        const isCurrentSong = current?.videoId === item.videoId;

                        return (
                          <tr
                            key={item.videoId}
                            className="row-hover"
                            draggable
                            onDoubleClick={() => playPlaylistItem(i)}
                            onDragStart={() => setDragPlaylistIndex(i)}
                            onDragOver={(e) => {
                              e.preventDefault(); // Required to allow drop
                              if (dropTargetIndex !== i) setDropTargetIndex(i);
                            }}
                            onDragLeave={() => setDropTargetIndex(null)}
                            onDrop={() => {
                              if (
                                dragPlaylistIndex !== null &&
                                dragPlaylistIndex !== i
                              ) {
                                updatePrimaryPlaylistItems((prev) => {
                                  const arr = [...prev];
                                  const [moved] = arr.splice(
                                    dragPlaylistIndex,
                                    1,
                                  );
                                  // If dragging down, the index shifts, so we adjust
                                  const targetIdx = i;
                                  arr.splice(targetIdx, 0, moved);
                                  return arr;
                                });
                              }
                              setDragPlaylistIndex(null);
                              setDropTargetIndex(null);
                            }}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              cursor: "grab",
                              background:
                                dragPlaylistIndex === i
                                  ? "rgba(255,255,255,0.08)"
                                  : isCurrentSong
                                    ? `${accent}1f`
                                    : "transparent",
                              // Visual indicator: Thick top border when hovering during a drag
                              borderTop: isDropTarget
                                ? `2px solid ${accent}`
                                : "2px solid transparent",
                              opacity: isBeingDragged ? 0.5 : 1,
                              transition: "all 0.1s ease",
                            }}
                          >
                            <td style={{ padding: "12px 16px", width: "48px" }}>
                              <span style={{ fontSize: "11px", color: c }}>
                                {String(i + 1).padStart(2, "0")}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                maxWidth: "260px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#fff",
                                  fontWeight: "500",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {item.title}
                              </div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "rgba(255,255,255,0.6)",
                                }}
                              >
                                {item.channel}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "rgba(255,255,255,0.6)",
                                  fontFamily: "monospace",
                                  background: "rgba(255,255,255,0.05)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                {item.videoId}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                textAlign: "right",
                              }}
                            >
                              <IconBtn
                                onClick={() => playPlaylistItem(i)}
                                title="Play"
                              >
                                ▶
                              </IconBtn>
                              <IconBtn
                                onClick={() => removeFromPlaylist(i)}
                                title="Remove"
                                danger
                              >
                                ✕
                              </IconBtn>
                            </td>
                          </tr>
                        );
                      })}
                      <tr
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropTargetIndex("bottom");
                        }}
                        onDrop={() => {
                          if (dragPlaylistIndex !== null) {
                            updatePrimaryPlaylistItems((prev) => {
                              const arr = [...prev];
                              const [moved] = arr.splice(dragPlaylistIndex, 1);
                              arr.push(moved); // Put at the absolute end
                              return arr;
                            });
                          }
                          setDragPlaylistIndex(null);
                          setDropTargetIndex(null);
                        }}
                        style={{
                          height: "40px",
                          borderTop:
                            dropTargetIndex === "bottom"
                              ? `2px solid ${accent}`
                              : "none",
                        }}
                      >
                        <td colSpan="5" />
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── PLAYLIST MANAGER TAB ── */}
          {activeTab === "playlists" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  gap: "10px",
                }}
              >
                {!youtubeApiKeyReady && (
                  <div
                    style={{
                      width: "100%",
                      fontSize: "11px",
                      color: "#feca57",
                      background: "rgba(254,202,87,0.08)",
                      border: "1px solid rgba(254,202,87,0.35)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                    }}
                  >
                    YouTube playlist import is disabled until a Google API key is
                    configured. Create one at{" "}
                    <a
                      href={YOUTUBE_API_SETUP_URL}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#feca57" }}
                    >
                      Google Cloud Console
                    </a>
                    .
                  </div>
                )}
                <input
                  value={playlistImportInput}
                  onChange={(e) => setPlaylistImportInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !playlistImportLoading && importYoutubePlaylist()
                  }
                  placeholder="YouTube playlist URL or playlist ID..."
                  disabled={!youtubeApiKeyReady}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
                <button
                  onClick={importYoutubePlaylist}
                  disabled={playlistImportLoading || !youtubeApiKeyReady}
                  style={{
                    padding: "8px 16px",
                    background: `${accent}22`,
                    border: `1px solid ${accent}55`,
                    borderRadius: "8px",
                    color: accent,
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "0.5px",
                    opacity: playlistImportLoading || !youtubeApiKeyReady ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {playlistImportLoading ? "..." : "Import"}
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>
                {playlists.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "200px",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "28px", opacity: 0.2 }}>♫</div>
                    <div
                      style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}
                    >
                      No playlists imported
                    </div>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {["Name", "Source", "Tracks", "Primary", ""].map((h, i) => (
                          <th
                            key={i}
                            style={{
                              padding: "10px 16px",
                              textAlign: "left",
                              fontSize: "9px",
                              color: "rgba(255,255,255,0.6)",
                              letterSpacing: "2px",
                              textTransform: "uppercase",
                              fontWeight: "400",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {playlists.map((entry) => (
                        <tr
                          key={entry.id}
                          className="row-hover"
                          onDoubleClick={() => setPrimaryPlaylist(entry.id)}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontSize: "13px", color: "#fff", fontWeight: 500 }}>
                              {entry.name}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                              {entry.sourceType === "youtube" ? "YouTube" : "Manual"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                              {entry.items?.length ?? 0}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {entry.isPrimary ? (
                              <Tag color={accent}>PRIMARY</Tag>
                            ) : (
                              <button
                                onClick={() => setPrimaryPlaylist(entry.id)}
                                style={{
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  borderRadius: "6px",
                                  color: "rgba(255,255,255,0.7)",
                                  fontSize: "10px",
                                  padding: "4px 8px",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Set Primary
                              </button>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <IconBtn onClick={() => deletePlaylist(entry.id)} title="Delete" danger>
                              ✕
                            </IconBtn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
