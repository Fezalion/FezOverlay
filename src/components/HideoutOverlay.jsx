import { useState, useEffect, useCallback } from "react";

export default function HideoutOverlay() {
  const [watcherActive, setWatcherActive] = useState(false);
  const [logPath, setLogPath] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // Fetch hideout watcher state
  const fetchWatcherState = useCallback(() => {
    fetch("/api/hideout-watcher")
      .then((r) => r.json())
      .then((data) => {
        setWatcherActive(data.active);
      })
      .catch(() => {
        console.error("Failed to fetch hideout watcher state");
      });
  }, []);

  // Fetch current log path
  const fetchLogPath = useCallback(() => {
    fetch("/api/hideout-log-path")
      .then((r) => r.json())
      .then((data) => {
        setLogPath(data.path || "");
      })
      .catch(() => {
        console.error("Failed to fetch log path");
      });
  }, []);

  // Set up WebSocket for real-time events
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:48000/ws");

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "logEvent" && data.event) {
          const logEvent = data.event;
          if (
            logEvent.event_type === "zone_enter" ||
            logEvent.event_type === "generating_level" ||
            logEvent.event_type === "hideout_found"
          ) {
            setEvents((prev) => [
              {
                type: logEvent.event_type,
                ...logEvent,
              },
              ...prev.slice(0, 49), // Keep last 50 events
            ]);
          }
        }
      } catch {
        console.error("Invalid WS message");
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => {
      ws.removeEventListener("message", handleMessage);
      ws.close();
    };
  }, []);

  useEffect(() => {
    fetchWatcherState();
    fetchLogPath();
  }, [fetchWatcherState, fetchLogPath]);

  const toggleWatcher = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/hideout-watcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !watcherActive }),
      });
      const data = await res.json();
      if (data.ok) {
        setWatcherActive(!watcherActive);
      } else {
        setError(data.error || "Failed to toggle watcher");
      }
    } catch {
      setError("Failed to connect to server");
    }
    setLoading(false);
  };

  const saveLogPath = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/hideout-log-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: logPath }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to save log path");
      }
    } catch {
      setError("Failed to connect to server");
    }
    setLoading(false);
  };

  const formatAreaName = (areaName) => {
    // Convert MapWorldsTerrace to "Terrace" for display
    if (areaName?.startsWith("MapWorlds")) {
      return areaName.replace("MapWorlds", "");
    }
    return areaName || "Unknown";
  };

  const getEventIcon = (type) => {
    switch (type) {
      case "hideout_found":
        return "🏠";
      case "zone_enter":
        return "🚪";
      case "generating_level":
        return "🗺️";
      default:
        return "📍";
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case "hideout_found":
        return "#55efc4";
      case "zone_enter":
        return "#4a9eff";
      case "generating_level":
        return "#feca57";
      default:
        return "#fff";
    }
  };

  const getEventLabel = (type) => {
    switch (type) {
      case "hideout_found":
        return "Hideout Found";
      case "zone_enter":
        return "Entered Zone";
      case "generating_level":
        return "Map Generated";
      default:
        return "Event";
    }
  };

  const getEventDetail = (event) => {
    if (event.type === "hideout_found") {
      return formatAreaName(event.area_name);
    }
    if (event.type === "zone_enter") {
      return event.zone_name;
    }
    if (event.type === "generating_level") {
      return `${formatAreaName(event.area_name)} (Level ${event.level})`;
    }
    return "";
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        background: "rgba(10, 10, 15, 0.92)",
        backdropFilter: "blur(10px)",
        color: "#fff",
        fontFamily: "'DM Mono', 'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        boxSizing: "border-box",
        transition: "all 0.3s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(85, 239, 196, 0.4); }
          50% { box-shadow: 0 0 20px 5px rgba(85, 239, 196, 0.8); }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: "600",
              color: "#fff",
            }}
          >
            🏠 Hideout Watcher
          </h2>
          <span
            style={{
              fontSize: "12px",
              color: watcherActive ? "#55efc4" : "rgba(255,255,255,0.5)",
            }}
          >
            {watcherActive ? "● Active" : "○ Inactive"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              fontSize: "18px",
              padding: "4px",
              borderRadius: "4px",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
            }
          >
            ⚙️
          </button>
        </div>
      </div>

      <button
        onClick={toggleWatcher}
        disabled={loading}
        style={{
          padding: "10px 20px",
          fontSize: "13px",
          fontWeight: "500",
          fontFamily: "inherit",
          color: watcherActive ? "#fff" : "#55efc4",
          background: watcherActive ? "#e74c3c" : "rgba(85,239,196,0.15)",
          border: watcherActive ? "none" : "1px solid rgba(85,239,196,0.4)",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "all 0.15s",
          width: "fit-content",
          marginBottom: "24px",
          opacity: 1,
        }}
      >
        {watcherActive ? "Stop Watcher" : "Start Watcher"}
      </button>

      {error && (
        <div
          style={{
            fontSize: "12px",
            color: "#e74c3c",
            background: "rgba(231,76,60,0.1)",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          {error}
        </div>
      )}

      {showSettings && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "8px",
            }}
          >
            Path to Client.txt
          </div>
          <input
            type="text"
            value={logPath}
            onChange={(e) => setLogPath(e.target.value)}
            placeholder="C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "12px",
              fontFamily: "inherit",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              color: "#fff",
              marginBottom: "12px",
            }}
          />
          <button
            onClick={saveLogPath}
            disabled={loading || !logPath}
            style={{
              padding: "6px 12px",
              fontSize: "11px",
              fontWeight: "500",
              fontFamily: "inherit",
              color: "#fff",
              background: "rgba(74,158,255,0.2)",
              border: "1px solid rgba(74,158,255,0.4)",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Save Path
          </button>
          <div
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.5)",
              marginTop: "8px",
            }}
          >
            Default paths are auto-detected. Only change this if your PoE
            installation is in a custom location.
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              padding: "20px",
            }}
          >
            No events yet. Start the watcher to see hideout and zone events.
          </div>
        ) : (
          events.map((event, index) => {
            const isHideout = event.type === "hideout_found";
            return (
              <div
                key={index}
                style={{
                  background: isHideout
                    ? "rgba(85, 239, 196, 0.15)"
                    : "rgba(255,255,255,0.03)",
                  border: isHideout
                    ? "1px solid rgba(85, 239, 196, 0.5)"
                    : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: isHideout ? "16px" : "10px",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  animation: isHideout ? "pulse-glow 2s infinite" : "none",
                }}
              >
                <span style={{ fontSize: isHideout ? "22px" : "16px" }}>
                  {getEventIcon(event.type)}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: isHideout ? "15px" : "11px",
                      fontWeight: isHideout ? "600" : "400",
                      color: getEventColor(event.type),
                    }}
                  >
                    {getEventLabel(event.type)}
                  </div>
                  <div
                    style={{
                      fontSize: isHideout ? "13px" : "10px",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {getEventDetail(event)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
