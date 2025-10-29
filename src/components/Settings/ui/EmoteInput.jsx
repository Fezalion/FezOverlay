import React, { useState } from "react";

export default function EmoteInput({ value = [], onChange }) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e) => {
    // Add new emote on space or enter
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        const newEmotes = [...value, inputValue.trim()];
        onChange(newEmotes);
        setInputValue("");
      }
    }
    // Remove last emote on backspace if input is empty
    else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      const newEmotes = value.slice(0, -1);
      onChange(newEmotes);
    }
  };

  const removeEmote = (index) => {
    const newEmotes = value.filter((_, i) => i !== index);
    onChange(newEmotes);
  };

  return (
    <div className="relative">
      <div
        className="min-h-[42px] w-full bg-gray-900 rounded-lg border border-white/10 px-3 py-2 flex flex-wrap gap-2 items-center cursor-text"
        onClick={() => document.getElementById("emote-input").focus()}
      >
        {/* Emote tokens */}
        {value.map((emote, index) => (
          <span
            key={index}
            className="bg-rose-500/20 border border-rose-500/30 text-rose-300 px-2 py-1 rounded-full text-sm flex items-center gap-2 group"
          >
            {emote}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeEmote(index);
              }}
              className="text-rose-300/50 hover:text-rose-300 transition"
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
          className="bg-transparent outline-none border-none flex-1 min-w-[60px] text-white"
          placeholder={
            value.length === 0 ? "Type emote name and press space..." : ""
          }
        />
      </div>
    </div>
  );
}
