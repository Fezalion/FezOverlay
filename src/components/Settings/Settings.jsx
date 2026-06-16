import { useState, useEffect, useCallback } from "react";
import { useMetadata } from "../../hooks/useMetadata";
import SongOverlaySettings from "./SongOverlaySettings";
import EmoteOverlaySettings from "./EmoteOverlaySettings";
import YapMeterSettings from "./YapMeterSettings";
import CommandSettings from "./CommandSettings";
import ChatOverlaySettings from "./ChatOverlaySettings";
import LeaderboardSettings from "./LeaderboardSettings";
import BattleSettings from "./BattleSettings";
import { openUrl } from "../../utils";

const TWITCH_CLIENT_ID = "pro83yr2qxpqs1qwy85uqkp17w5wpl";
const TWITCH_REDIRECT_URI = "http://localhost:48000/auth/twitch/callback";
const params = new URLSearchParams({
  client_id: TWITCH_CLIENT_ID,
  redirect_uri: TWITCH_REDIRECT_URI,
  response_type: "token",
  scope: "chat:read chat:edit",
});
const TWITCH_AUTH_URL = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;

const MENU = [
  { key: "song", label: "Song Overlay", component: SongOverlaySettings },
  { key: "emote", label: "Emote Overlay", component: EmoteOverlaySettings },
  { key: "battle", label: "Battle Overlay", component: BattleSettings },
  { key: "yap", label: "Yap Meter", component: YapMeterSettings },
  { key: "commands", label: "Commands", component: CommandSettings },
  { key: "chat", label: "Chat Overlay", component: ChatOverlaySettings },
  { key: "leaderboard", label: "Leaderboard", component: LeaderboardSettings },
];

const accent = "#ff6b6b";

function Settings() {
  const {
    settings,
    updateSetting,
    saveSettings,
    discardSettings,
    isSaving,
    hasUnsavedChanges,
    availableSubEffects,
    version,
    latestVersion,
  } = useMetadata();

  const [selected, setSelected] = useState(MENU[0].key);

  // Twitch auth state
  const [twitchConfigured, setTwitchConfigured] = useState(null); // null = loading
  const [twitchUsername, setTwitchUsername] = useState("");
  const [showTwitchModal, setShowTwitchModal] = useState(false);

  // Fetch Twitch auth status
  const fetchTwitchStatus = useCallback(() => {
    fetch("/api/twitch/status")
      .then((r) => r.json())
      .then((data) => {
        setTwitchConfigured(data.configured);
        setTwitchUsername(data.username || "");
      })
      .catch(() => {
        setTwitchConfigured(false);
      });
  }, []);

  // Fetch Twitch auth status on mount
  useEffect(() => {
    fetchTwitchStatus();
  }, [fetchTwitchStatus]);

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
      case "battle":
        return (
          <BattleSettings settings={settings} updateSetting={updateSetting} />
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

      {/* ── TWITCH AUTH MODAL ── */}
      {showTwitchModal && (
        <div
          onClick={() => setShowTwitchModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(480px, 92vw)",
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700 }}>
              Twitch Authentication
            </div>

            {twitchConfigured ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    background: "rgba(85,239,196,0.08)",
                    border: "1px solid rgba(85,239,196,0.3)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontSize: "12px",
                    color: "#55efc4",
                  }}
                >
                  ✓ Authenticated as <strong>{twitchUsername}</strong>
                </div>
                <div
                  style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}
                >
                  To re-authenticate with a different account, click below.
                </div>
                <button
                  onClick={() => {
                    openUrl(TWITCH_AUTH_URL);
                    setShowTwitchModal(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "10px 16px",
                    background: "#9147ff",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "600",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textDecoration: "none",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Re-authenticate with Twitch
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}
                >
                  Connect your Twitch account to enable chat integration, song
                  requests via channel points, and other Twitch features.
                </div>
                <button
                  onClick={() => {
                    openUrl(TWITCH_AUTH_URL);
                    setShowTwitchModal(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "10px 16px",
                    background: "#9147ff",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "600",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textDecoration: "none",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Authenticate with Twitch
                </button>
                <div
                  style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}
                >
                  After authorizing, you'll be redirected back and the page will
                  reload. You may need to restart the app for changes to take
                  effect.
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowTwitchModal(false)}
                style={{
                  padding: "8px 14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  color: "rgba(255,255,255,0.8)",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

        <button
          onClick={() => fetchTwitchStatus()}
          style={{
            padding: "6px 12px",
            fontSize: "11px",
            fontWeight: "500",
            fontFamily: "inherit",
            color: twitchConfigured ? "#55efc4" : "#feca57",
            background: twitchConfigured
              ? "rgba(85,239,196,0.08)"
              : twitchConfigured === false
                ? "rgba(254,202,87,0.08)"
                : "rgba(255,255,255,0.03)",
            border: twitchConfigured
              ? "1px solid rgba(85,239,196,0.3)"
              : twitchConfigured === false
                ? "1px solid rgba(254,202,87,0.3)"
                : "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.15s",
            opacity: twitchConfigured === null ? 0.5 : 1,
          }}
        >
          🗘
        </button>
        {/* Twitch auth button */}
        <button
          onClick={() => setShowTwitchModal(true)}
          style={{
            padding: "6px 12px",
            fontSize: "11px",
            fontWeight: "500",
            fontFamily: "inherit",
            color: twitchConfigured ? "#55efc4" : "#feca57",
            background: twitchConfigured
              ? "rgba(85,239,196,0.08)"
              : twitchConfigured === false
                ? "rgba(254,202,87,0.08)"
                : "rgba(255,255,255,0.03)",
            border: twitchConfigured
              ? "1px solid rgba(85,239,196,0.3)"
              : twitchConfigured === false
                ? "1px solid rgba(254,202,87,0.3)"
                : "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.15s",
            opacity: twitchConfigured === null ? 0.5 : 1,
          }}
        >
          {twitchConfigured === null
            ? "Twitch: ..."
            : twitchConfigured
              ? `Twitch: ${twitchUsername || "Connected"}`
              : "Twitch: Not Configured"}
        </button>

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          {/* Discard button */}
          {hasUnsavedChanges && (
            <button
              onClick={discardSettings}
              style={{
                padding: "6px 14px",
                fontSize: "11px",
                fontWeight: "500",
                fontFamily: "inherit",
                color: "rgba(255,255,255,0.6)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Discard
            </button>
          )}
          {/* Save button */}
          <button
            onClick={saveSettings}
            disabled={!hasUnsavedChanges || isSaving}
            style={{
              padding: "6px 14px",
              fontSize: "11px",
              fontWeight: "500",
              fontFamily: "inherit",
              color: hasUnsavedChanges ? "#fff" : "rgba(255,255,255,0.3)",
              background: hasUnsavedChanges ? accent : "rgba(255,255,255,0.05)",
              border: hasUnsavedChanges
                ? `1px solid ${accent}`
                : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              cursor: hasUnsavedChanges ? "pointer" : "default",
              transition: "all 0.15s",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <div
            style={{
              display: "flex",
              gap: "6px",
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
                    selected === item.key ? `${accent}15` : "transparent",
                  border: "none",
                  borderLeft:
                    selected === item.key
                      ? `2px solid ${accent}`
                      : "2px solid transparent",
                  color:
                    selected === item.key ? "#fff" : "rgba(255,255,255,0.6)",
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

          {/* Open Config Folder Button */}
          <button
            onClick={async () => {
              try {
                await fetch("/api/open-config-folder", { method: "POST" });
              } catch (err) {
                console.error("Failed to open config folder:", err);
              }
            }}
            style={{
              margin: "0 16px 8px",
              padding: "10px 16px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "rgba(255,255,255,0.6)",
              fontSize: "11px",
              fontFamily: "inherit",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s",
              fontWeight: "500",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            }}
          >
            Open Config Folder 📁
          </button>

          {/* Sponsor Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              openUrl("https://github.com/sponsors/Fezalion");
            }}
            style={{
              margin: "0 16px 16px",
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
          </button>
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
