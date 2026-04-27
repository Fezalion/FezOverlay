import InputField from "./InputField";

const accent = "#ff6b6b";

export function EffectCard({
  effectKey,
  label,
  enabled,
  toggleEnabled,
  settings,
  onChange,
  fields,
  children,
}) {
  const handleFieldChange = (key, parser) => (e) => {
    const value = parser ? parser(e.target.value) : e.target.value;
    onChange(key, value);
  };

  return (
    <div
      key={effectKey}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: enabled ? "16px" : 0,
        }}
      >
        <label
          style={{
            fontWeight: "500",
            color: "#fff",
            fontSize: "12px",
            letterSpacing: "0.5px",
          }}
        >
          {label}
        </label>
        {/* Toggle Switch */}
        <button
          onClick={toggleEnabled}
          style={{
            width: "48px",
            height: "24px",
            borderRadius: "12px",
            border: "none",
            background: enabled ? accent : "rgba(255,255,255,0.1)",
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
              left: enabled ? "26px" : "2px",
              transition: "left 0.15s",
            }}
          />
        </button>
      </div>

      {enabled && (
        <div style={{ marginTop: "16px" }}>
          {fields.map(({ key, label, min, max, step, parser }) => (
            <div key={key}>
              <InputField
                type="range"
                label={label}
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={handleFieldChange(key, parser)}
              />
            </div>
          ))}
          {children}
        </div>
      )}
    </div>
  );
}
