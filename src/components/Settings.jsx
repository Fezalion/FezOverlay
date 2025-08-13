import { useState } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import { useMetadata } from "../hooks/useMetadata";

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

export function Settings() {
  const [showPicker, setShowPicker] = useState(false);
  const [showOutlinePicker, setShowOutlinePicker] = useState(false);

  const {
    settings: Settings,
    updateSetting,
    availableSubEffects,
    version,
    latestVersion
  } = useMetadata();

  const handleChange = (key, parser = val => val) => e =>
    updateSetting(key, parser(e.target.value));

  const handleCheckbox = key => e =>
    updateSetting(key, e.target.checked);

  const getStrokeTextShadow = (width, color) => {
    if (width <= 0) return "none";
    const shadows = [];
    for (let dx = -width; dx <= width; dx++) {
      for (let dy = -width; dy <= width; dy++) {
        if (dx === 0 && dy === 0) continue;
        shadows.push(`${dx}px ${dy}px 0 ${color}`);
      }
    }
    return shadows.join(", ");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6 text-white">
      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-6 flex flex-wrap items-center gap-2">
        Overlay Settings
        <span className="text-sm text-gray-400">installed {version}</span>
        {latestVersion !== version && (
          <span className="text-sm text-yellow-400">
            | update available: <span className="font-semibold">{latestVersion}</span>
          </span>
        )}
      </h1>

      <div className="grid gap-8 md:grid-cols-2">
        {/* ===== Song Overlay Settings ===== */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Song Overlay Settings</h2>
          <p className="text-xs text-gray-400 mb-4">
            Adjust overlay position via OBS Browser Source → Interact.
            Use arrow keys (Shift = faster). Space resets to 0,0 (bottom-right corner).
          </p>

          {/* Lastfm Username */}
          <label className="flex flex-col gap-1 mb-4">
            <span>Lastfm Username</span>
            <input
              type="text"
              value={Settings.lastfmName}
              onChange={handleChange("lastfmName")}
              placeholder="Enter your Lastfm username"
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </label>

          {/* Alignment */}
          <label className="flex flex-col gap-1 mb-4">
            <span>Alignment</span>
            <select
              value={Settings.playerAlignment}
              onChange={handleChange("playerAlignment")}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
            <span className="text-xs text-gray-400">
              Defines the overlay's growth direction from the anchor point.
            </span>
          </label>

          {/* Background Picker */}
          <h3 className="text-lg font-medium mt-6 mb-2">Background</h3>
          <button
            onClick={() => setShowPicker(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg transition"
          >
            Pick Background
          </button>

          {showPicker && (
            <div
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
              onClick={() => setShowPicker(false)}
            >
              <div
                className="bg-gray-900 p-6 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <ColorPicker
                  value={Settings.bgColor}
                  onChange={color => updateSetting("bgColor", color)}
                  disableDarkMode={true}
                />
                <div
                  className="mt-4 p-3 rounded-lg text-center font-medium"
                  style={{
                    padding: `${Settings.padding}px`,
                    fontFamily: Settings.fontFamily,
                    color: `rgb(${hexToRgb(Settings.fontColor)})`,
                    background: Settings.bgColor,
                    textShadow: getStrokeTextShadow(
                      Settings.textStrokeSize,
                      Settings.textStrokeColor
                    )
                  }}
                >
                  Example Artist - Example Track
                </div>
              </div>
            </div>
          )}

          {/* Font Settings */}
          <h3 className="text-lg font-medium mt-6 mb-2">Font Settings</h3>
          <label className="flex flex-col gap-1 mb-4">
            <span>Font Color</span>
            <input
              type="color"
              value={Settings.fontColor}
              onChange={handleChange("fontColor")}
              className="h-10 w-full rounded-lg cursor-pointer border-none"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Font Family</span>
            <select
              disabled
              value={Settings.fontFamily}
              onChange={handleChange("fontFamily")}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            >
              <option value="Arial, sans-serif">Arial</option>
              <option value="Verdana, Geneva, sans-serif">Verdana</option>
              <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
              <option value='"Courier New", Courier, monospace'>Courier New</option>
              <option value='"Times New Roman", Times, serif'>Times New Roman</option>
            </select>
            <span className="text-xs text-gray-400">Currently disabled (bugged).</span>
          </label>

          {/* Outline Settings */}
          <h3 className="text-lg font-medium mt-6 mb-2">Text Outline</h3>
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={Settings.textStroke}
              onChange={handleCheckbox("textStroke")}
              className="accent-purple-500"
            />
            <span>Enable Text Outline</span>
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Text Stroke Size</span>
            <input
              type="number"
              min="0"
              max="50"
              value={Settings.textStrokeSize}
              disabled={!Settings.textStroke}
              onChange={handleChange("textStrokeSize", parseInt)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Text Outline Color</span>
            <button
              disabled={!Settings.textStroke}
              onClick={() => setShowOutlinePicker(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg transition disabled:opacity-50"
            >
              Pick Outline Color
            </button>
          </label>

          {showOutlinePicker && (
            <div
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
              onClick={() => setShowOutlinePicker(false)}
            >
              <div
                className="bg-gray-900 p-6 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <ColorPicker
                  value={Settings.textStrokeColor}
                  onChange={color => updateSetting("textStrokeColor", color)}
                  hideColorTypeBtns
                  hideGradientTypeBtns
                  hideControls
                  disableDarkMode
                />
                <div
                  className="mt-4 p-3 rounded-lg text-center font-medium"
                  style={{
                    padding: `${Settings.padding}px`,
                    fontFamily: Settings.fontFamily,
                    color: `rgb(${hexToRgb(Settings.fontColor)})`,
                    background: Settings.bgColor,
                    textShadow: getStrokeTextShadow(
                      Settings.textStrokeSize,
                      Settings.textStrokeColor
                    )
                  }}
                >
                  Example Artist - Example Track
                </div>
              </div>
            </div>
          )}

          {/* Layout */}
          <h3 className="text-lg font-medium mt-6 mb-2">Layout Settings</h3>
          <label className="flex flex-col gap-1 mb-4">
            <span>Scale Size</span>
            <input
              type="number"
              min="0.05"
              max="10.0"
              step="0.05"
              value={Settings.scaleSize}
              onChange={handleChange("scaleSize", parseFloat)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Padding</span>
            <input
              type="number"
              min="0"
              max="50"
              value={Settings.padding}
              onChange={handleChange("padding", parseInt)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Max Width</span>
            <input
              type="number"
              min="100"
              max="4000"
              value={Settings.maxWidth}
              onChange={handleChange("maxWidth", parseInt)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
          </label>
        </div>

        {/* ===== Emote Overlay Settings ===== */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Emote Overlay Settings</h2>
          <p className="text-xs text-gray-400 mb-4">
            Displays 7TV emotes in real-time from chat. Customize appearance & behavior.
          </p>

          <label className="flex flex-col gap-1 mb-4">
            <span>Twitch Username</span>
            <input
              type="text"
              value={Settings.twitchName}
              onChange={handleChange("twitchName")}
              placeholder="Enter your Twitch username"
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>7TV Emote Set ID</span>
            <input
              type="text"
              value={Settings.emoteSetId}
              onChange={handleChange("emoteSetId")}
              placeholder="Enter 7TV emote set ID"
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm placeholder-gray-400 text-white"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Emote Lifetime (ms)</span>
            <input
              type="number"
              min="500"
              max="20000"
              value={Settings.emoteLifetime}
              onChange={handleChange("emoteLifetime", parseInt)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
            <span className="text-xs text-gray-400">
              Milliseconds emotes remain on screen.
            </span>
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Emote Scale</span>
            <input
              type="number"
              min="0.1"
              max="5.0"
              step="0.1"
              value={Settings.emoteScale}
              onChange={handleChange("emoteScale", parseFloat)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Emote Delay (ms)</span>
            <input
              type="number"
              min="0"
              max="5000"
              step="1"
              value={Settings.emoteDelay}
              onChange={handleChange("emoteDelay", parseInt)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
          </label>

          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={Settings.subEffects}
              onChange={handleCheckbox("subEffects")}
              className="accent-purple-500"
            />
            <span>Enable Sub Effects</span>
          </label>

          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={Settings.raidEffect}
              onChange={handleCheckbox("raidEffect")}
              className="accent-purple-500"
            />
            <span>Enable Raid Effect</span>
          </label>

          {/* Subscriber Effects List */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 ${
              Settings.subEffects ? "" : "opacity-50"
            }`}
          >
            {availableSubEffects.map(effect => {
              const checked = Settings.subEffectTypes.includes(effect);
              return (
                <label
                  key={effect}
                  className={`flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10 transition ${
                    checked ? "bg-purple-500/30 border-purple-400" : ""
                  }`}
                >
                  <span>{effect.charAt(0).toUpperCase() + effect.slice(1)}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!Settings.subEffects}
                    onChange={() => {
                      let newSelected = checked
                        ? Settings.subEffectTypes.filter(e => e !== effect)
                        : [...Settings.subEffectTypes, effect];
                      updateSetting("subEffectTypes", newSelected);
                    }}
                    className="accent-purple-500"
                  />
                </label>
              );
            })}
          </div>

          <label className="flex flex-col gap-1 mt-4 mb-4">
            <span>Sub Effect Proc Chance</span>
            <input
              type="number"
              min="0.0"
              max="1.0"
              step="0.05"
              value={Settings.subEffectChance}
              onChange={handleChange("subEffectChance", parseFloat)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span>Magnetic Effect Strength</span>
            <input
              type="number"
              min="0.00001"
              max="1.0"
              step="0.00001"
              value={Settings.subEffectBlackHoleStrength}
              onChange={handleChange("subEffectBlackHoleStrength", parseFloat)}
              className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
