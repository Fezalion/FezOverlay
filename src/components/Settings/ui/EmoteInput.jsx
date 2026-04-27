import React, { useState } from "react";

const accent = "#ff6b6b";

export default function EmoteInput({ value = [], onChange }) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        const newEmotes = [...value, inputValue.trim()];
        onChange(newEmotes);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      const newEmotes = value.slice(0, -1);
      onChange(newEmotes);
    }
  };

  const removeEmote = (index) => {
    const newEmotes = value.filter((_, i) => i !== index);
    onChange(newEmotes);
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "42px",
        width: "100%",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "8px 12px",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
        cursor: "text",
        transition: "all 0.15s",
      }}
      onClick={() => document.getElementById("emote-input")?.focus()}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        e.currentTarget.style.borderColor = `${accent}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
      }}
    >
      {/* Emote tokens */}
      {value.map((emote, index) => (
        <span
          key={index}
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}44`,
            color: accent,
            padding: "4px 8px",
            borderRadius: "12px",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: "500",
          }}
        >
          {emote}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeEmote(index);
            }}
            style={{
              background: "none",
              border: "none",
              color: `${accent}77`,
              cursor: "pointer",
              fontSize: "16px",
              lineHeight: 1,
              padding: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = `${accent}77`;
            }}
          >
            ×
          </button>
        </span>
      ))}

      {/* Input field */}
      <input
        id="emote-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          background: "transparent",
          outline: "none",
          border: "none",
          flex: 1,
          minWidth: "60px",
          color: "#fff",
          fontFamily: "inherit",
          fontSize: "12px",
        }}
        placeholder={
          value.length === 0 ? "Type emote name and press space..." : ""
        }
      />
    </div>
  );
}
