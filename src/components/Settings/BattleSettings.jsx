import { EffectCard } from "./ui/EffectCard";
import InputField from "./ui/InputField";
import { useRef, useEffect } from "react";

const accent = "#ff6b6b";

export default function EmoteOverlaySettings({ settings, updateSetting }) {
  let allAvailableEffects = useRef([]);

  useEffect(() => {
    fetch("/api/subeffecttypes")
      .then((res) => res.json())
      .then((data) => {
        allAvailableEffects.current = data;
      });
  }, []);

  const labelStyle = {
    fontSize: "11px",
    letterSpacing: "1px",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    marginBottom: "12px",
    display: "block",
    fontWeight: "500",
  };

  const toggleButtonStyle = (enabled) => ({
    width: "48px",
    height: "24px",
    borderRadius: "12px",
    border: "none",
    background: enabled ? accent : "rgba(255,255,255,0.1)",
    cursor: "pointer",
    position: "relative",
    transition: "all 0.15s",
  });

  const resetButtonStyle = {
    position: "absolute",
    top: "14px",
    right: "72px",
    padding: "6px 10px",
    fontSize: "10px",
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  };

  return (
    <div style={{ maxWidth: "600px", position: "relative" }}>
      <button
        onClick={() => {
          const defaultEffects = {
            battleEventDuration: 60,
            battleEventParticipants: 8,
            battleEventChance: 5,
            battleEventHp: 300,
            battleEventDamage: 50,
            battleEventAcceptPlebs: false,
            battleEventDPSTracker: false,
            battleEventDPSTrackerFloatLeft: false,
            battleEventDPSTrackerLive: true,
            battleEventDPSTrackerLiveFloatLeft: false,
            battleEventLeaderboardFloatLeft: false,
            battleEventShowSkillHistory: true,
          };
          Object.entries(defaultEffects).forEach(([key, val]) =>
            updateSetting(key, val),
          );
        }}
        style={resetButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        }}
      >
        Reset
      </button>
      <EffectCard
        effectKey="battleEvent"
        label="Battle Event"
        enabled={settings.subEffectTypes.includes("battleEvent")}
        toggleEnabled={() =>
          updateSetting(
            "subEffectTypes",
            settings.subEffectTypes.includes("battleEvent")
              ? settings.subEffectTypes.filter((t) => t !== "battleEvent")
              : [...settings.subEffectTypes, "battleEvent"],
          )
        }
        settings={settings}
        onChange={updateSetting}
        fields={[
          {
            key: "battleEventDuration",
            label: "Maximum Duration (s)",
            min: 30,
            max: 120,
            step: 1,
            parser: parseInt,
          },
          {
            key: "battleEventParticipants",
            label: "Max Participants",
            min: 3,
            max: 20,
            step: 1,
            parser: parseInt,
          },
          {
            key: "battleEventChance",
            label: "Chance (%)",
            min: 1,
            max: 100,
            step: 1,
            parser: parseInt,
          },
          {
            key: "battleEventHp",
            label: "Max HP",
            min: 1,
            max: 600,
            step: 1,
            parser: parseInt,
          },
          {
            key: "battleEventDamage",
            label: "Damage per hit (±20%)",
            min: 5,
            max: 100,
            step: 1,
            parser: parseInt,
          },
        ]}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            Include non-subs in battles
          </label>
          <button
            onClick={() =>
              updateSetting(
                "battleEventAcceptPlebs",
                !settings.battleEventAcceptPlebs,
              )
            }
            style={toggleButtonStyle(settings.battleEventAcceptPlebs)}
          >
            <div
              style={{
                position: "absolute",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#fff",
                top: "2px",
                left: settings.battleEventAcceptPlebs ? "26px" : "2px",
                transition: "left 0.15s",
              }}
            />
          </button>
        </div>

        <EffectCard
          effectKey="battleEventDPSTracker"
          label="DPS Tracker / Battle Results"
          enabled={settings.battleEventDPSTracker}
          toggleEnabled={() =>
            updateSetting(
              "battleEventDPSTracker",
              !settings.battleEventDPSTracker,
            )
          }
          settings={settings}
          onChange={updateSetting}
          fields={[]}
        >
          {[
            ["Display real-time dps", "battleEventDPSTrackerLive"],
            [
              "Display result screen at left side",
              "battleEventDPSTrackerFloatLeft",
            ],
            [
              "Display Live DPS Tracker at left side",
              "battleEventDPSTrackerLiveFloatLeft",
            ],
            [
              "Display Leaderboard at left side",
              "battleEventLeaderboardFloatLeft",
            ],
            ["Display skill history", "battleEventShowSkillHistory"],
          ].map(([label, key]) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
              <button
                onClick={() => updateSetting(key, !settings[key])}
                style={toggleButtonStyle(settings[key])}
              >
                <div
                  style={{
                    position: "absolute",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#fff",
                    top: "2px",
                    left: settings[key] ? "26px" : "2px",
                    transition: "left 0.15s",
                  }}
                />
              </button>
            </div>
          ))}
        </EffectCard>
      </EffectCard>
    </div>
  );
}
