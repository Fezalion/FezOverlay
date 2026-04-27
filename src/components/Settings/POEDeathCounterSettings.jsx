import { useState } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import EmoteInput from "./ui/EmoteInput";
import Modal from "./ui/Modal";
import { hexToRgb } from "../../utils";

const accent = "#ff6b6b";

export default function POEDeathCounterSettings({ settings, updateSetting }) {
  const [showPicker, setShowPicker] = useState(false);

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
    marginBottom: "8px",
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

  const buttonStyle = {
    background: `${accent}22`,
    border: `1px solid ${accent}55`,
    borderRadius: "8px",
    color: accent,
    fontSize: "11px",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.5px",
    opacity: 1,
    padding: "8px 12px",
    transition: "all 0.15s",
    fontWeight: "500",
    width: "100%",
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
      {/* Character Name */}
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
          Death Counter
        </h3>
        <button
          onClick={() => {
            const defaultSettings = {
              deathCounterCharName: "",
            };
            Object.entries(defaultSettings).forEach(([key, val]) =>
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

        <label style={labelStyle}>Character Name</label>
        <p
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "8px",
          }}
        >
          Case Sensitive
        </p>
        <InputField
          value={settings.deathCounterCharName}
          onChange={(e) =>
            updateSetting("deathCounterCharName", e.target.value)
          }
          placeholder="Current char name"
        />
      </div>

      {/* Background */}
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
          Background
        </h3>
        <button
          onClick={() => {
            const defaultSettings = {
              deathCounterBackground: "rgba(0,0,0,0)",
            };
            Object.entries(defaultSettings).forEach(([key, val]) =>
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

        <label style={labelStyle}>Background Color</label>
        <button
          onClick={() => setShowPicker(true)}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${accent}44`;
            e.currentTarget.style.borderColor = `${accent}77`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${accent}22`;
            e.currentTarget.style.borderColor = `${accent}55`;
          }}
        >
          Pick Background
        </button>

        <Modal isOpen={showPicker} onClose={() => setShowPicker(false)}>
          <ColorPicker
            value={settings.deathCounterBackground}
            onChange={(color) => updateSetting("deathCounterBackground", color)}
            disableDarkMode
          />
          <div
            style={{
              marginTop: "16px",
              padding: "16px",
              color: `rgb(${hexToRgb(settings.deathCounterColor)})`,
              background: settings.deathCounterBackground,
              borderRadius: "6px",
            }}
          >
            {settings.deathCounterPrefix} 69
          </div>
        </Modal>
      </div>

      {/* Font & Shadow */}
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
          Font & Shadow
        </h3>
        <button
          onClick={() => {
            const defaultSettings = {
              deathCounterColor: "#ffffff",
              deathCounterShadowColor: "#ff0000",
              deathCounterShadow: true,
            };
            Object.entries(defaultSettings).forEach(([key, val]) =>
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

        <label style={labelStyle}>Font Color</label>
        <input
          type="color"
          value={settings.deathCounterColor}
          onChange={(e) => updateSetting("deathCounterColor", e.target.value)}
          style={{
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
            height: "40px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            Enable shadow
          </label>
          <button
            onClick={() =>
              updateSetting("deathCounterShadow", !settings.deathCounterShadow)
            }
            style={toggleButtonStyle(settings.deathCounterShadow)}
          >
            <div
              style={{
                position: "absolute",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#fff",
                top: "2px",
                left: settings.deathCounterShadow ? "26px" : "2px",
                transition: "left 0.15s",
              }}
            />
          </button>
        </div>

        <label style={labelStyle}>Shadow Color</label>
        <input
          type="color"
          value={settings.deathCounterShadowColor}
          onChange={(e) =>
            updateSetting("deathCounterShadowColor", e.target.value)
          }
          style={{
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
            height: "40px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        />
      </div>

      {/* Prefix */}
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
          Prefix
        </h3>
        <button
          onClick={() => {
            const defaultSettings = {
              deathCounterPrefix: "Deaths:",
            };
            Object.entries(defaultSettings).forEach(([key, val]) =>
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

        <InputField
          value={settings.deathCounterPrefix}
          onChange={(e) => updateSetting("deathCounterPrefix", e.target.value)}
          placeholder="deathCounterPrefix"
        />
      </div>

      {/* Emotes */}
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
          Emotes
        </h3>
        <button
          onClick={() => {
            const defaultSettings = {
              deathCounterEmotes: ["KEKW"],
              deathCounterEmotesPerDeath: 10,
            };
            Object.entries(defaultSettings).forEach(([key, val]) =>
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

        <label style={labelStyle}>Emote Names</label>
        <p
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "12px",
            lineHeight: "1.4",
          }}
        >
          Type emote names and press space or enter to add them. You can
          optionally add an interval using the format{" "}
          <code
            style={{
              background: "rgba(255,255,255,0.1)",
              padding: "2px 4px",
              borderRadius: "2px",
            }}
          >
            EMOTE:interval
          </code>
        </p>
        <EmoteInput
          value={settings.deathCounterEmotes || []}
          onChange={(emotes) => updateSetting("deathCounterEmotes", emotes)}
        />

        <label style={labelStyle}>Deaths per event</label>
        <p
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "8px",
          }}
        >
          The default death count to spawn emotes (applies to emotes without
          custom intervals)
        </p>

        <InputField
          type="number"
          min={1}
          max={50}
          value={settings.deathCounterEmotesPerDeath}
          onChange={(e) => {
            const value = Math.min(
              50,
              Math.max(1, parseInt(e.target.value) || 1),
            );
            updateSetting("deathCounterEmotesPerDeath", value);
          }}
          placeholder="Number of deaths (1-50)"
        />
      </div>
    </div>
  );
}
