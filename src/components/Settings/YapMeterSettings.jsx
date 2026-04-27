import InputField from "./ui/InputField";

const accent = "#ff6b6b";

export default function YapMeterSettings({ settings, updateSetting }) {
  const sectionStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
    position: "relative",
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
    <div style={{ maxWidth: "600px" }}>
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
          YapMeter
        </h3>
        <button
          onClick={() => {
            const defaultYapMeter = {
              yapMeterThreshold: 1.0,
              yapMeterSilenceThreshold: 3,
              yapMeterMaxYap: 60,
              yapMeterLength: 300,
            };
            Object.entries(defaultYapMeter).forEach(([key, val]) =>
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
          type="range"
          label="Yap Threshold"
          min={0.1}
          max={5.0}
          step={0.1}
          value={settings.yapMeterThreshold}
          onChange={(e) =>
            updateSetting("yapMeterThreshold", parseFloat(e.target.value))
          }
        />

        <InputField
          type="range"
          label="Silence Threshold (s)"
          min={1}
          max={10}
          step={1}
          value={settings.yapMeterSilenceThreshold}
          onChange={(e) =>
            updateSetting("yapMeterSilenceThreshold", parseInt(e.target.value))
          }
        />

        <InputField
          type="range"
          label="Max Yap (s)"
          min={10}
          max={300}
          step={5}
          value={settings.yapMeterMaxYap}
          onChange={(e) =>
            updateSetting("yapMeterMaxYap", parseInt(e.target.value))
          }
        />

        <InputField
          type="range"
          label="Yap Meter Length (px)"
          min={250}
          max={1000}
          step={5}
          value={settings.yapMeterLength}
          onChange={(e) =>
            updateSetting("yapMeterLength", parseInt(e.target.value))
          }
        />

        <InputField
          type="text"
          label="Yap Meter Blabbering Emote (spawns at 50% yapping)"
          value={settings.yapMeterBlabberingEmote}
          onChange={(e) =>
            updateSetting("yapMeterBlabberingEmote", e.target.value)
          }
        />

        <InputField
          type="text"
          label="Yap Meter Yapping Emote (spawns at 100%+ yapping)"
          value={settings.yapMeterYappingEmote}
          onChange={(e) =>
            updateSetting("yapMeterYappingEmote", e.target.value)
          }
        />
      </div>
    </div>
  );
}
