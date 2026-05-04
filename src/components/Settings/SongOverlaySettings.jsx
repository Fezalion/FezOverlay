import { useMemo, useEffect } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import { hexToRgb, getStrokeTextShadow } from "../../utils";

const accent = "#ff6b6b";

// Inject CSS once to restyle the picker's internals to match the dark UI
const PICKER_CSS = `
  /* Picker container */
  .rbgcp-wrapper {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    width: 100% !important;
  }

  /* Solid / Gradient toggle buttons */
  .rbgcp-control-btn-wrap {
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 8px !important;
    padding: 3px !important;
    margin-bottom: 10px !important;
  }
  .rbgcp-control-btn {
    border-radius: 6px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    letter-spacing: 0.5px !important;
    color: rgba(255,255,255,0.5) !important;
    transition: all 0.15s !important;
  }
  .rbgcp-control-btn-active {
    background: rgba(255,255,255,0.1) !important;
    color: #fff !important;
  }

  /* Hex input */
  .rbgcp-hex-input {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 7px !important;
    color: #fff !important;
    font-size: 12px !important;
    font-family: "JetBrains Mono", "Fira Code", monospace !important;
  }
  .rbgcp-hex-input:focus {
    border-color: ${accent}88 !important;
    outline: none !important;
  }

  /* RGBA channel inputs */
  .rbgcp-rgba-input {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 7px !important;
    color: #fff !important;
    font-size: 11px !important;
    font-family: "JetBrains Mono", "Fira Code", monospace !important;
  }
  .rbgcp-rgba-input:focus {
    border-color: ${accent}88 !important;
    outline: none !important;
  }
  .rbgcp-rgba-label {
    color: rgba(255,255,255,0.4) !important;
    font-size: 10px !important;
    letter-spacing: 0.5px !important;
  }

  /* Gradient degree input */
  .rbgcp-gradient-degrees-input {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 7px !important;
    color: #fff !important;
    font-size: 11px !important;
  }

  /* Preset swatches row */
  .rbgcp-preset-wrap {
    margin-top: 10px !important;
  }
  .rbgcp-swatch {
    border-radius: 5px !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    transition: transform 0.1s, box-shadow 0.1s !important;
  }
  .rbgcp-swatch:hover {
    transform: scale(1.15) !important;
    box-shadow: 0 0 0 2px ${accent}66 !important;
  }

  /* Gradient stop handles */
  .rbgcp-gradient-handle {
    border: 2px solid rgba(255,255,255,0.8) !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4) !important;
  }

  /* Eye-dropper & advanced icon buttons */
  .rbgcp-eyedropper-wrap,
  .rbgcp-advanced-btn {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 7px !important;
    color: rgba(255,255,255,0.6) !important;
    transition: all 0.15s !important;
  }
  .rbgcp-eyedropper-wrap:hover,
  .rbgcp-advanced-btn:hover {
    background: rgba(255,255,255,0.1) !important;
    color: #fff !important;
  }
`;

function usePickerStyles() {
  useEffect(() => {
    const id = "song-overlay-picker-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = PICKER_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

/** Wraps ColorPicker with a consistent dark-themed container */
function StyledPicker({ disabled, ...props }) {
  return (
    <div
      style={{
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transition: "opacity 0.15s",
      }}
    >
      <ColorPicker {...props} />
    </div>
  );
}

const sectionStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  padding: "16px",
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

const sectionHeadingStyle = {
  fontSize: "13px",
  fontWeight: "600",
  marginBottom: "16px",
  color: "#fff",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

function ResetButton({ onClick }) {
  return (
    <button
      onClick={onClick}
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
  );
}

function ToggleButton({ value, onChange }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: "48px",
        height: "24px",
        borderRadius: "12px",
        border: "none",
        background: value ? accent : "rgba(255,255,255,0.1)",
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
          left: value ? "26px" : "2px",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

export default function SongOverlaySettings({ settings, updateSetting }) {
  usePickerStyles();

  const textShadow = useMemo(
    () =>
      getStrokeTextShadow(settings.textStrokeSize, settings.textStrokeColor),
    [settings.textStrokeSize, settings.textStrokeColor],
  );

  const previewStyle = {
    marginTop: "12px",
    padding: `12px`,
    fontFamily: settings.fontFamily,
    color: `rgb(${hexToRgb(settings.fontColor)})`,
    background: settings.bgColor,
    textAlign: settings.playerAlignment,
    textShadow: settings.textStroke ? textShadow : "none",
    borderRadius: "6px",
    fontSize: "12px",
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
        alignItems: "start",
      }}
    >
      {/* General Settings */}
      <div style={sectionStyle}>
        <h3 style={sectionHeadingStyle}>General</h3>
        <ResetButton
          onClick={() => {
            [
              ["playerAlignment", "right"],
              ["bgColor", "#800080"],
            ].forEach(([k, v]) => updateSetting(k, v));
          }}
        />

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
        <StyledPicker
          value={settings.bgColor}
          onChange={(color) => updateSetting("bgColor", color)}
        />
        <div style={previewStyle}>Example Artist - Example Track</div>
      </div>

      {/* Font Settings */}
      <div style={sectionStyle}>
        <h3 style={sectionHeadingStyle}>Font</h3>
        <ResetButton
          onClick={() => {
            [
              ["fontColor", "#ffffff"],
              ["textStroke", false],
              ["textStrokeSize", 0],
              ["textStrokeColor", "#ffffff"],
            ].forEach(([k, v]) => updateSetting(k, v));
          }}
        />

        <label style={labelStyle}>Font Color</label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "8px 12px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: settings.fontColor,
              border: "1px solid rgba(255,255,255,0.15)",
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            <input
              type="color"
              value={settings.fontColor}
              onChange={(e) => updateSetting("fontColor", e.target.value)}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                width: "100%",
                height: "100%",
              }}
            />
          </div>
          <input
            type="text"
            value={settings.fontColor}
            onChange={(e) => updateSetting("fontColor", e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: "13px",
              letterSpacing: "1px",
            }}
          />
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
            Enable Text Outline
          </label>
          <ToggleButton
            value={settings.textStroke}
            onChange={() => updateSetting("textStroke", !settings.textStroke)}
          />
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

        <label
          style={{
            ...labelStyle,
            opacity: settings.textStroke ? 1 : 0.4,
            transition: "opacity 0.15s",
          }}
        >
          Outline Color
        </label>
        <StyledPicker
          disabled={!settings.textStroke}
          value={settings.textStrokeColor}
          onChange={(color) => updateSetting("textStrokeColor", color)}
          hideColorTypeBtns
          hideGradientTypeBtns
          hideControls
        />
      </div>

      {/* Layout Settings — spans both columns */}
      <div style={{ ...sectionStyle, gridColumn: "1 / -1" }}>
        <h3 style={sectionHeadingStyle}>Layout</h3>
        <ResetButton
          onClick={() => {
            [
              ["scaleSize", 2.0],
              ["padding", 10],
              ["scrollSpeed", 25],
              ["hideOnNothing", false],
            ].forEach(([k, v]) => updateSetting(k, v));
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
              gridColumn: "1 / -1",
            }}
          >
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              Hide when no song is playing
            </label>
            <ToggleButton
              value={settings.hideOnNothing}
              onChange={() =>
                updateSetting("hideOnNothing", !settings.hideOnNothing)
              }
            />
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
        </div>
      </div>
    </div>
  );
}
