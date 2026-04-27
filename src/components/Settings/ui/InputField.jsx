const accent = "#ff6b6b";

export default function InputField({
  label,
  type = "text",
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  disabled,
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label
        style={{
          fontSize: "11px",
          letterSpacing: "1px",
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
          marginBottom: "8px",
          display: "block",
          fontWeight: "500",
        }}
      >
        {label}
        {type === "range" && (
          <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "8px" }}>
            {value}
          </span>
        )}
      </label>
      {type === "range" ? (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{
            width: "100%",
            height: "4px",
            borderRadius: "2px",
            cursor: disabled ? "not-allowed" : "pointer",
            background: `linear-gradient(90deg, ${accent} 0%, ${accent} ${
              ((value - min) / (max - min)) * 100
            }%, rgba(255,255,255,0.1) ${
              ((value - min) / (max - min)) * 100
            }%, rgba(255,255,255,0.1) 100%)`,
            WebkitAppearance: "none",
            appearance: "none",
            outline: "none",
            opacity: disabled ? 0.5 : 1,
            transition: "all 0.15s",
          }}
        />
      ) : (
        <input
          type={type}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "12px",
            outline: "none",
            marginTop: "4px",
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "text",
            transition: "all 0.15s",
          }}
          onFocus={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.borderColor = `${accent}55`;
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
          }}
        />
      )}
    </div>
  );
}
