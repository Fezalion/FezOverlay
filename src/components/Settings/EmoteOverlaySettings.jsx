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

  const toggleAllEffects = () => {
    updateSetting("subEffectTypes", [...allAvailableEffects.current]);
  };

  const sectionStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
    position: "relative",
  };

  const labelStyle = {
    fontSize: "11px",
    letterSpacing: "1px",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    marginBottom: "12px",
    display: "block",
    fontWeight: "500",
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: "12px",
    outline: "none",
    width: "100%",
    marginBottom: "16px",
    transition: "all 0.15s",
  };

  const actionButtonStyle = {
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  };

  const resetButtonStyle = {
    position: "absolute",
    top: "12px",
    right: "12px",
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

  return (
    <div style={{ maxWidth: "600px" }}>
      {/* Account Settings */}
      <div style={sectionStyle}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Account
        </h3>

        <InputField
          label="Twitch Username"
          placeholder="Twitch Username"
          value={settings.twitchName}
          onChange={(e) => updateSetting("twitchName", e.target.value)}
        />

        <InputField
          placeholder="Emote set id"
          label="Emote set id"
          value={settings.emoteSetId}
          onChange={(e) => updateSetting("emoteSetId", e.target.value)}
        />
      </div>

      {/* General Settings */}
      <div style={sectionStyle}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          General
        </h3>
        <button
          onClick={() => {
            const defaultSubEffects = {
              emoteLifetime: 5000,
              emoteScale: 1.0,
              emoteDelay: 150,
              emoteStaticMode: false,
              enableBTTV: true,
              enableFFZ: true,
              includeTwitchChannelEmotes: true,
            };
            Object.entries(defaultSubEffects).forEach(([key, val]) =>
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

        {/* Toggles */}
        {[
          ["Make emotes static", "emoteStaticMode"],
          ["Enable BTTV channel emotes", "enableBTTV"],
          ["Enable FFZ channel emotes", "enableFFZ"],
          ["Enable twitch channel emotes", "includeTwitchChannelEmotes"],
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

        <InputField
          type="range"
          label="Emote Lifetime (ms)"
          min={500}
          max={20000}
          step={100}
          value={settings.emoteLifetime}
          onChange={(e) =>
            updateSetting("emoteLifetime", parseFloat(e.target.value))
          }
        />

        <InputField
          type="range"
          label="Emote Scale"
          min={0.1}
          max={2.0}
          step={0.1}
          value={settings.emoteScale}
          onChange={(e) =>
            updateSetting("emoteScale", parseFloat(e.target.value))
          }
        />

        <InputField
          type="range"
          label="Emote Delay (ms)"
          min={0}
          max={5000}
          step={10}
          value={settings.emoteDelay}
          onChange={(e) =>
            updateSetting("emoteDelay", parseFloat(e.target.value))
          }
        />
      </div>

      {/* Global Controls */}
      <div style={{ ...sectionStyle, display: "flex", gap: "10px" }}>
        <button
          onClick={toggleAllEffects}
          style={actionButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
        >
          Enable All Effects
        </button>

        <button
          onClick={() => {
            const defaultSubEffects = {
              subEffectHueShiftChance: 5,
              subEffectBlackHoleChance: 5,
              subEffectBlackHoleDuration: 15,
              subEffectBlackHoleStrength: 5,
              subEffectReverseGravityChance: 5,
              subEffectReverseGravityDuration: 15,
              subEffectReverseGravityStrength: 2,
              subEffectGravityEventStrength: 1,
              subEffectGravityEventChance: 5,
              subEffectGravityEventDuration: 15,
              battleEventChance: 5,
              battleEventParticipants: 8,
              battleEventHp: 300,
              battleEventDamage: 50,
              battleEventDuration: 60,
              battleEventDPSTracker: true,
              battleEventAcceptPlebs: false,
              battleEventDPSTrackerFloatLeft: false,
              battleEventDPSTrackerLiveFloatLeft: false,
              subOnlyMode: false,
              subEffectTypes: [],
            };
            Object.entries(defaultSubEffects).forEach(([key, val]) =>
              updateSetting(key, val),
            );
          }}
          style={actionButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
        >
          Reset Effects
        </button>
      </div>

      {/* Sub Only Mode */}
      <div style={sectionStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            Sub only mode
          </label>
          <button
            onClick={() => updateSetting("subOnlyMode", !settings.subOnlyMode)}
            style={toggleButtonStyle(settings.subOnlyMode)}
          >
            <div
              style={{
                position: "absolute",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#fff",
                top: "2px",
                left: settings.subOnlyMode ? "26px" : "2px",
                transition: "left 0.15s",
              }}
            />
          </button>
        </div>
      </div>

      {/* Effects */}
      <EffectCard
        effectKey="hueShift"
        label="Hue Shift"
        enabled={settings.subEffectTypes.includes("hueShift")}
        toggleEnabled={() =>
          updateSetting(
            "subEffectTypes",
            settings.subEffectTypes.includes("hueShift")
              ? settings.subEffectTypes.filter((t) => t !== "hueShift")
              : [...settings.subEffectTypes, "hueShift"],
          )
        }
        settings={settings}
        onChange={updateSetting}
        fields={[
          {
            key: "subEffectHueShiftChance",
            label: "Chance (%)",
            min: 0,
            max: 100,
            step: 1,
            parser: parseInt,
          },
        ]}
      />

      <EffectCard
        effectKey="magneticAttraction"
        label="Magnetic Attraction"
        enabled={settings.subEffectTypes.includes("magneticAttraction")}
        toggleEnabled={() =>
          updateSetting(
            "subEffectTypes",
            settings.subEffectTypes.includes("magneticAttraction")
              ? settings.subEffectTypes.filter(
                  (t) => t !== "magneticAttraction",
                )
              : [...settings.subEffectTypes, "magneticAttraction"],
          )
        }
        settings={settings}
        onChange={updateSetting}
        fields={[
          {
            key: "subEffectBlackHoleDuration",
            label: "Duration (s)",
            min: 1,
            max: 30,
            step: 1,
            parser: parseInt,
          },
          {
            key: "subEffectBlackHoleStrength",
            label: "Strength",
            min: 1,
            max: 50,
            step: 1,
            parser: parseInt,
          },
          {
            key: "subEffectBlackHoleChance",
            label: "Chance (%)",
            min: 1,
            max: 100,
            step: 1,
            parser: parseInt,
          },
        ]}
      />

      <EffectCard
        effectKey="reverseGravity"
        label="Reverse Gravity"
        enabled={settings.subEffectTypes.includes("reverseGravity")}
        toggleEnabled={() =>
          updateSetting(
            "subEffectTypes",
            settings.subEffectTypes.includes("reverseGravity")
              ? settings.subEffectTypes.filter((t) => t !== "reverseGravity")
              : [...settings.subEffectTypes, "reverseGravity"],
          )
        }
        settings={settings}
        onChange={updateSetting}
        fields={[
          {
            key: "subEffectReverseGravityDuration",
            label: "Duration (s)",
            min: 1,
            max: 30,
            step: 1,
            parser: parseInt,
          },
          {
            key: "subEffectReverseGravityStrength",
            label: "Strength",
            min: 1,
            max: 10,
            step: 1,
            parser: parseInt,
          },
          {
            key: "subEffectReverseGravityChance",
            label: "Chance (%)",
            min: 1,
            max: 100,
            step: 1,
            parser: parseInt,
          },
        ]}
      />

      <EffectCard
        effectKey="gravityEvent"
        label="Gravity Event"
        enabled={settings.subEffectTypes.includes("gravityEvent")}
        toggleEnabled={() =>
          updateSetting(
            "subEffectTypes",
            settings.subEffectTypes.includes("gravityEvent")
              ? settings.subEffectTypes.filter((t) => t !== "gravityEvent")
              : [...settings.subEffectTypes, "gravityEvent"],
          )
        }
        settings={settings}
        onChange={updateSetting}
        fields={[
          {
            key: "subEffectGravityEventDuration",
            label: "Duration (s)",
            min: 1,
            max: 30,
            step: 1,
            parser: parseInt,
          },
          {
            key: "subEffectGravityEventStrength",
            label: "Gravity Strength",
            min: 0.1,
            max: 5,
            step: 0.1,
            parser: parseFloat,
          },
          {
            key: "subEffectGravityEventChance",
            label: "Chance (%)",
            min: 1,
            max: 100,
            step: 1,
            parser: parseInt,
          },
        ]}
      />

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
