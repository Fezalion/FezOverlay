import { useState } from "react";
import { useMetadata } from "../../hooks/useMetadata";
import SongOverlaySettings from "./SongOverlaySettings";
import EmoteOverlaySettings from "./EmoteOverlaySettings";
import YapMeterSettings from "./YapMeterSettings";
import CommandSettings from "./CommandSettings";
import ChatOverlaySettings from "./ChatOverlaySettings";
import LeaderboardSettings from "./LeaderboardSettings";
import POEDeathCounterSettings from "./POEDeathCounterSettings";

const MENU = [
  { key: "song", label: "Song Overlay", component: SongOverlaySettings },
  { key: "emote", label: "Emote Overlay", component: EmoteOverlaySettings },
  { key: "yap", label: "Yap Meter", component: YapMeterSettings },
  { key: "commands", label: "Commands", component: CommandSettings },
  { key: "chat", label: "Chat Overlay", component: ChatOverlaySettings },
  { key: "leaderboard", label: "Leaderboard", component: LeaderboardSettings },
  {
    key: "deathcounter",
    label: "PoE Death Counter",
    component: POEDeathCounterSettings,
  },
];

const accent = "#ff6b6b";

function Settings() {
  const {
    settings,
    updateSetting,
    availableSubEffects,
    version,
    latestVersion,
  } = useMetadata();

  const [selected, setSelected] = useState(MENU[0].key);

  // Map key to component
  const renderComponent = (key) => {
    switch (key) {
      case "song":
        return (
          <SongOverlaySettings
            settings={settings}
            updateSetting={updateSetting}
          />
        );
      case "emote":
        return (
          <EmoteOverlaySettings
            settings={settings}
            updateSetting={updateSetting}
            availableSubEffects={availableSubEffects}
          />
        );
      case "yap":
        return (
          <YapMeterSettings settings={settings} updateSetting={updateSetting} />
        );
      case "commands":
        return <CommandSettings />;
      case "chat":
        return (
          <ChatOverlaySettings
            settings={settings}
            updateSetting={updateSetting}
          />
        );
      case "leaderboard":
        return <LeaderboardSettings />;
      case "deathcounter":
        return (
          <POEDeathCounterSettings
            settings={settings}
            updateSetting={updateSetting}
          />
        );
      default:
        return null;
    }
  };

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
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .menu-item-hover:hover { background: rgba(255,255,255,0.08) !important; }
        input[type="color"] { cursor: pointer; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div
        style={{
          height: "56px",
          background: "#0a0a0f",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
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
          FezOverlay<span style={{ color: accent }}>Settings.</span>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            fontSize: "11px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <span>v{version}</span>
          {latestVersion !== version && (
            <span style={{ color: "#feca57" }}>update: {latestVersion}</span>
          )}
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div
        style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
      >
        {/* ── SIDEBAR ── */}
        <div
          style={{
            width: "240px",
            flexShrink: 0,
            background: "#0a0a0f",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "24px 0",
          }}
        >
          <nav style={{ flex: 1, overflowY: "auto", paddingRight: "6px" }}>
            {MENU.map((item) => (
              <button
                key={item.key}
                className="menu-item-hover"
                onClick={() => setSelected(item.key)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 20px",
                  background:
                    selected === item.key
                      ? `${accent}15`
                      : "transparent",
                  border: "none",
                  borderLeft:
                    selected === item.key
                      ? `2px solid ${accent}`
                      : "2px solid transparent",
                  color:
                    selected === item.key
                      ? "#fff"
                      : "rgba(255,255,255,0.6)",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                  fontWeight: selected === item.key ? "500" : "400",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Sponsor Button */}
          <a
            href="https://github.com/sponsors/Fezalion"
            target="_blank"
            rel="noreferrer"
            style={{
              margin: "16px",
              padding: "12px 16px",
              background: `${accent}22`,
              border: `1px solid ${accent}44`,
              borderRadius: "8px",
              color: accent,
              fontSize: "11px",
              fontFamily: "inherit",
              textAlign: "center",
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              fontWeight: "500",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${accent}44`;
              e.currentTarget.style.borderColor = `${accent}66`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${accent}22`;
              e.currentTarget.style.borderColor = `${accent}44`;
            }}
          >
            Sponsor me ❤️
          </a>
        </div>

        {/* ── CONTENT ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {renderComponent(selected)}
        </div>
      </div>
    </div>
  );
}

export default Settings;
