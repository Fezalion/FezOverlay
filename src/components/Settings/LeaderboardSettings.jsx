import { useEffect, useState } from "react";

const accent = "#ff6b6b";

export default function LeaderboardSettings() {
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchTop = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard`);
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        const json = await res.json();
        if (mounted) setTop(json);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTop();
    return () => {
      mounted = false;
    };
  }, []);

  const sectionStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "16px",
  };

  const entryStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "6px",
    marginBottom: "8px",
    border: "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <h2
        style={{
          fontSize: "13px",
          fontWeight: "600",
          marginBottom: "16px",
          color: "#fff",
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        Leaderboard
      </h2>

      <div style={sectionStyle}>
        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>
            Loading...
          </div>
        ) : top.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>
            No entries yet
          </div>
        ) : (
          <div>
            {top.map((entry, i) => (
              <div key={entry.username} style={entryStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: accent,
                      width: "24px",
                    }}
                  >
                    {i + 1}.
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#fff",
                    }}
                  >
                    {entry.username}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#48dbfb",
                  }}
                >
                  {entry.wins} wins
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
