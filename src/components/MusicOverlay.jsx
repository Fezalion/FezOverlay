import { useEffect, useState, useRef, useCallback } from "react";
import YouTubePlayer from "../components/YouTubePlayer";
import { fetchVideoInfo } from "../utils/youtube";

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
  const [playlist, setPlaylist] = useState([]);
  const [playlistInput, setPlaylistInput] = useState("");
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(25);
  const [activeTab, setActiveTab] = useState("queue"); // "queue" | "playlist"
  const [dragIndex, setDragIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragPlaylistIndex, setDragPlaylistIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);

  const playerRef = useRef(null);
  const queueRef = useRef(queue);
  const playlistRef = useRef(playlist);
  const timerRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const playlistIndexRef = useRef(0);

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
  }, [playlist]);

  useEffect(() => {
    playNext();
  }, []);

  useEffect(() => {
    return () => clearInterval(timerRef.current); // cleanup on unmount
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
        // handle messages
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

  const togglePlay = () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const skip = () => playNext();

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

  const addToPlaylist = async () => {
    const input = playlistInput.trim();
    if (!input) return;

    const match = input.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = match ? match[1] : input.length === 11 ? input : null;

    if (!videoId) return;

    // Prevent adding the same video ID twice
    if (playlist.some((item) => item.videoId === videoId)) {
      setPlaylistInput("");
      return;
    }

    setPlaylistLoading(true);
    try {
      const info = await fetchVideoInfo(videoId);
      setPlaylist((p) => [
        ...p,
        { videoId, title: info.title, channel: info.channel },
      ]);
      setPlaylistInput("");
    } catch {
      setPlaylist((p) => [
        ...p,
        { videoId, title: videoId, channel: "Unknown" },
      ]);
      setPlaylistInput("");
    }
    setPlaylistLoading(false);
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
    setPlaylist((p) => p.filter((_, i) => i !== index));
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
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "'DM Mono', 'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
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
        <WsStatus connected={wsConnected} />
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
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
                  // ... (rest of your onReady logic)
                }}
                onStateChange={(e) => {
                  if (e.data === 1) setIsPlaying(true);
                  if (e.data === 2 || e.data === 3) setIsPlaying(false);
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
                return (
                  <div
                    key={`${item.videoId}-${i}`}
                    className="row-hover"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 20px",
                      borderLeft: `2px solid ${c}44`,
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
                label: "Fallback Playlist",
                count: playlist.length,
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
                      return (
                        <tr
                          key={item.videoId}
                          className="row-hover"
                          draggable
                          onDoubleClick={() => playPlaylistItem(i)}
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
                <input
                  value={playlistInput}
                  onChange={(e) => setPlaylistInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addToPlaylist()}
                  placeholder="YouTube URL or video ID..."
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
                  disabled={playlistLoading}
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
                    opacity: playlistLoading ? 0.5 : 1,
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
                                setPlaylist((prev) => {
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
                            setPlaylist((prev) => {
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
        </div>
      </div>
    </div>
  );
}
