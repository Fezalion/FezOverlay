import { useState, useMemo } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import { EffectCard } from "./ui/EffectCard";
import Modal from "./ui/Modal";
import { hexToRgb, getStrokeTextShadow } from "../../utils";

const accent = "#ff6b6b";

export default function ChatOverlaySettings({ settings, updateSetting }) {
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

  const buttonStyle = {
    background: `${accent}22`,
    border: `1px solid ${accent}55`,
    borderRadius: "8px",
    color: accent,
    fontSize: "11px",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.5px",
    padding: "8px 12px",
    transition: "all 0.15s",
    fontWeight: "500",
    width: "100%",
    marginBottom: "16px",
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

        {/* Background Settings */}
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
              const defaultSubEffects = {
                chatBackgroundColor: "rgba(0, 0, 0, 0)",
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
              value={settings.chatBackgroundColor}
              onChange={(color) => updateSetting("chatBackgroundColor", color)}
              disableDarkMode
            />
          </Modal>
        </div>

        {/* Font Settings */}
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
            Font
          </h3>
          <button
            onClick={() => {
              const defaultSubEffects = {
                chatFontColor: "#ffffff",
                chatFontSize: 32,
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
            value={settings.chatFontColor}
            onChange={(e) => updateSetting("chatFontColor", e.target.value)}
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

          <InputField
            label="Font Size"
            type="range"
            min={8}
            max={64}
            step={1}
            value={settings.chatFontSize}
            onChange={(e) =>
              updateSetting("chatFontSize", parseInt(e.target.value))
            }
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
              Enable Bold Text
            </label>
            <button
              onClick={() =>
                updateSetting("chatFontBold", !settings.chatFontBold)
              }
              style={{
                width: "48px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                background: settings.chatFontBold
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
                  left: settings.chatFontBold ? "26px" : "2px",
                  transition: "left 0.15s",
                }}
              />
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              Enable Text Outline (Disabled)
            </label>
            <button
              disabled
              style={{
                width: "48px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                background: "rgba(255,255,255,0.05)",
                cursor: "not-allowed",
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
                  left: "2px",
                  transition: "left 0.15s",
                }}
              />
            </button>
          </div>
        </div>

        {/* Layout Settings */}
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
            Layout
          </h3>
          <button
            onClick={() => {
              const defaultSubEffects = {
                maxChatMessages: 10,
                chatFadeDuration: 10000,
                chatFadeTransition: 2000,
                chatEditMode: false,
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
            <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>
              Edit Mode (puts an outline and background for you to see if you
              wanna move the overlay)
            </label>
            <button
              onClick={() =>
                updateSetting("chatEditMode", !settings.chatEditMode)
              }
              style={{
                width: "48px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                background: settings.chatEditMode
                  ? accent
                  : "rgba(255,255,255,0.1)",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s",
                flexShrink: 0,
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
                  left: settings.chatEditMode ? "26px" : "2px",
                  transition: "left 0.15s",
                }}
              />
            </button>
          </div>

          <InputField
            label="Maximum amount of chat messages"
            type="range"
            min={2}
            max={50}
            step={1}
            value={settings.maxChatMessages}
            onChange={(e) =>
              updateSetting("maxChatMessages", parseInt(e.target.value))
            }
          />
          <InputField
            label="Chat Fade Duration (ms)"
            type="range"
            min={100}
            max={50000}
            step={10}
            value={settings.chatFadeDuration}
            onChange={(e) =>
              updateSetting("chatFadeDuration", parseInt(e.target.value))
            }
          />
          <InputField
            label="Chat Fade Transition (ms)"
            type="range"
            min={100}
            max={10000}
            step={10}
            value={settings.chatFadeTransition}
            onChange={(e) =>
              updateSetting("chatFadeTransition", parseInt(e.target.value))
            }
          />
        </div>

        {/* Effects Control */}
        <div style={{ ...sectionStyle, display: "flex", gap: "10px" }}>
          <button
            onClick={() => {
              const defaultSubEffects = {
                chatEffectRainbowText: true,
                chatEffectJumpingText: true,
                chatEffectScatterText: true,
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
            Enable All Effects
          </button>

          <button
            onClick={() => {
              const defaultSubEffects = {
                chatEffectRainbowText: false,
                chatEffectRainbowTextChance: 10,
                chatEffectJumpingText: false,
                chatEffectJumpingTextChance: 10,
                chatEffectScatterText: false,
                chatEffectScatterTextChance: 10,
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

        <EffectCard
          effectKey="chatEffectRainbowText"
          label="Rainbow Text"
          enabled={settings.chatEffectRainbowText}
          toggleEnabled={() =>
            updateSetting(
              "chatEffectRainbowText",
              !settings.chatEffectRainbowText,
            )
          }
          settings={settings}
          onChange={updateSetting}
          fields={[
            {
              key: "chatEffectRainbowTextChance",
              label: "Chance (%)",
              min: 1,
              max: 100,
              step: 1,
              parser: parseInt,
            },
          ]}
        />

        <EffectCard
          effectKey="chatEffectJumpingText"
          label="Jumping Text"
          enabled={settings.chatEffectJumpingText}
          toggleEnabled={() =>
            updateSetting(
              "chatEffectJumpingText",
              !settings.chatEffectJumpingText,
            )
          }
          settings={settings}
          onChange={updateSetting}
          fields={[
            {
              key: "chatEffectJumpingTextChance",
              label: "Chance (%)",
              min: 1,
              max: 100,
              step: 1,
              parser: parseInt,
            },
          ]}
        />

        <EffectCard
          effectKey="chatEffectScatterText"
          label="Scatter Text"
          enabled={settings.chatEffectScatterText}
          toggleEnabled={() =>
            updateSetting(
              "chatEffectScatterText",
              !settings.chatEffectScatterText,
            )
          }
          settings={settings}
          onChange={updateSetting}
          fields={[
            {
              key: "chatEffectScatterTextChance",
              label: "Chance (%)",
              min: 1,
              max: 100,
              step: 1,
              parser: parseInt,
            },
          ]}
        />
      </div>
    </>
  );
}
