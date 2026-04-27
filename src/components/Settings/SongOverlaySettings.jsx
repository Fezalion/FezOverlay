import { useState, useMemo } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import Modal from "./ui/Modal";
import { hexToRgb, getStrokeTextShadow } from "../../utils";

const accent = "#ff6b6b";

export default function SongOverlaySettings({ settings, updateSetting }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showOutlinePicker, setShowOutlinePicker] = useState(false);

  const textShadow = useMemo(
    () =>
      getStrokeTextShadow(settings.textStrokeSize, settings.textStrokeColor),
    [settings.textStrokeSize, settings.textStrokeColor],
  );

  const sectionStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
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

  return (
    <>
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
          <label style={labelStyle}>Lastfm Username</label>
          <input
            type="text"
            value={settings.lastfmName}
            onChange={(e) => updateSetting("lastfmName", e.target.value)}
            placeholder="Enter your Lastfm username"
            style={inputStyle}
          />
        </div>

        {/* General Settings */}
        <div style={{ ...sectionStyle, position: "relative" }}>
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
                playerAlignment: "right",
                bgColor: "#800080",
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

          <label style={labelStyle}>Alignment</label>
          <select
            value={settings.playerAlignment}
            onChange={(e) => updateSetting("playerAlignment", e.target.value)}
            style={inputStyle}
          >
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>

          <label style={labelStyle}>Background Color</label>
          <button
            onClick={() => setShowPicker(true)}
            style={{
              ...buttonStyle,
              width: "100%",
              marginBottom: "16px",
            }}
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
              value={settings.bgColor}
              onChange={(color) => updateSetting("bgColor", color)}
              disableDarkMode
            />
            <div
              style={{
                marginTop: "16px",
                padding: `${settings.padding}px`,
                fontFamily: settings.fontFamily,
                color: `rgb(${hexToRgb(settings.fontColor)})`,
                background: settings.bgColor,
                textAlign: settings.playerAlignment,
                textShadow: settings.textStroke ? textShadow : "none",
              }}
            >
              Example Artist - Example Track
            </div>
          </Modal>
        </div>

        {/* Font Settings */}
        <div style={{ ...sectionStyle, position: "relative" }}>
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
            Font
          </h3>
          <button
            onClick={() => {
              const defaultSubEffects = {
                fontColor: "#ffffff",
                textStroke: false,
                textStrokeSize: 0,
                textStrokeColor: "#ffffff",
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

          <label style={labelStyle}>Font Color</label>
          <input
            type="color"
            value={settings.fontColor}
            onChange={(e) => updateSetting("fontColor", e.target.value)}
            style={{
              ...inputStyle,
              height: "40px",
              cursor: "pointer",
              marginBottom: "16px",
            }}
          />

          {/* Outline Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              Enable Text Outline
            </label>
            <button
              onClick={() => updateSetting("textStroke", !settings.textStroke)}
              style={{
                width: "48px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                background: settings.textStroke
                  ? accent
                  : "rgba(255,255,255,0.1)",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  top: "2px",
                  left: settings.textStroke ? "26px" : "2px",
                  transition: "left 0.15s",
                }}
              />
            </button>
          </div>

          <InputField
            label="Text Stroke Size"
            type="range"
            min={0}
            max={20}
            step={1}
            value={settings.textStrokeSize}
            disabled={!settings.textStroke}
            onChange={(e) =>
              updateSetting("textStrokeSize", parseInt(e.target.value))
            }
          />

          <button
            disabled={!settings.textStroke}
            onClick={() => setShowOutlinePicker(true)}
            style={{
              ...buttonStyle,
              width: "100%",
              marginBottom: "16px",
              opacity: !settings.textStroke ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!settings.textStroke) return;
              e.currentTarget.style.background = `${accent}44`;
              e.currentTarget.style.borderColor = `${accent}77`;
            }}
            onMouseLeave={(e) => {
              if (!settings.textStroke) return;
              e.currentTarget.style.background = `${accent}22`;
              e.currentTarget.style.borderColor = `${accent}55`;
            }}
          >
            Pick Outline Color
          </button>

          <Modal
            isOpen={showOutlinePicker}
            onClose={() => setShowOutlinePicker(false)}
          >
            <ColorPicker
              value={settings.textStrokeColor}
              onChange={(color) => updateSetting("textStrokeColor", color)}
              hideColorTypeBtns
              hideGradientTypeBtns
              hideControls
              disableDarkMode
            />
            <div
              style={{
                marginTop: "16px",
                padding: `${settings.padding}px`,
                fontFamily: settings.fontFamily,
                color: `rgb(${hexToRgb(settings.fontColor)})`,
                background: settings.bgColor,
                textAlign: settings.playerAlignment,
                textShadow: settings.textStroke ? textShadow : "none",
              }}
            >
              Example Artist - Example Track
            </div>
          </Modal>
        </div>

        {/* Layout Settings */}
        <div style={{ ...sectionStyle, position: "relative" }}>
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
            Layout
          </h3>
          <button
            onClick={() => {
              const defaultSubEffects = {
                scaleSize: 1.0,
                padding: 10,
                maxWidth: 700,
                scrollSpeed: 25,
                hideOnNothing: false,
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              Hide when no song is playing
            </label>
            <button
              onClick={() =>
                updateSetting("hideOnNothing", !settings.hideOnNothing)
              }
              style={{
                width: "48px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                background: settings.hideOnNothing
                  ? accent
                  : "rgba(255,255,255,0.1)",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  top: "2px",
                  left: settings.hideOnNothing ? "26px" : "2px",
                  transition: "left 0.15s",
                }}
              />
            </button>
          </div>

          <InputField
            label="Scale Size"
            type="range"
            min={0.05}
            max={10.0}
            step={0.05}
            value={settings.scaleSize}
            onChange={(e) =>
              updateSetting("scaleSize", parseFloat(e.target.value))
            }
          />
          <InputField
            label="Padding"
            type="range"
            min={0}
            max={20}
            step={1}
            value={settings.padding}
            onChange={(e) => updateSetting("padding", parseInt(e.target.value))}
          />
          <InputField
            label="Scroll Speed"
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.scrollSpeed}
            onChange={(e) =>
              updateSetting("scrollSpeed", parseInt(e.target.value))
            }
          />
          <InputField
            label="Max Width"
            type="range"
            min={100}
            max={5000}
            step={10}
            value={settings.maxWidth}
            onChange={(e) =>
              updateSetting("maxWidth", parseInt(e.target.value))
            }
          />
        </div>
      </div>
    </>
  );
}
