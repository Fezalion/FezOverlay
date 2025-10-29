import { useState } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import EmoteInput from "./ui/EmoteInput";
import Modal from "./ui/Modal";
import { hexToRgb } from "../../utils";

export default function POEDeathCounterSettings({ settings, updateSetting }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-6 relative">
        {/* Death Counter Settings */}
        <h3 className="text-lg font-semibold mb-4">Death Counter</h3>

        {/* Background Picker */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 relative">
          <button
            onClick={() => {
              const defaultSettings = {
                deathCounterBackground: "rgba(0,0,0,0)",
              };
              Object.entries(defaultSettings).forEach(([key, val]) =>
                updateSetting(key, val)
              );
            }}
            className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>
          <div className="space-y-4 mt-2">
            <label className="block font-semibold">Background </label>
            <button
              onClick={() => setShowPicker(true)}
              className="w-full bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg transition"
            >
              Pick Background
            </button>

            <Modal isOpen={showPicker} onClose={() => setShowPicker(false)}>
              <ColorPicker
                value={settings.deathCounterBackground}
                onChange={(color) =>
                  updateSetting("deathCounterBackground", color)
                }
                disableDarkMode
              />
              <div
                className="my-4"
                style={{
                  color: `rgb(${hexToRgb(settings.deathCounterColor)})`,
                  background: settings.deathCounterBackground,
                }}
              >
                {settings.deathCounterPrefix} 69
              </div>
            </Modal>
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4 relative">
          <button
            onClick={() => {
              const defaultSettings = {
                deathCounterColor: "#ffffff",
                deathCounterShadowColor: "#ff0000",
                deathCounterShadow: true,
              };
              Object.entries(defaultSettings).forEach(([key, val]) =>
                updateSetting(key, val)
              );
            }}
            className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>
          <div className="flex items-center space-x-3">
            <label className="font-semibold">Font Color</label>
            <input
              label="Font Color"
              type="color"
              value={settings.deathCounterColor}
              onChange={(e) =>
                updateSetting("deathCounterColor", e.target.value)
              }
            />
          </div>
          <div className="flex items-center space-x-3">
            <label className="font-semibold">Enable shadow</label>
            <button
              onClick={() =>
                updateSetting(
                  "deathCounterShadow",
                  !settings.deathCounterShadow
                )
              }
              className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
            ${settings.deathCounterShadow ? "bg-rose-500" : "bg-gray-700"}`}
            >
              <span
                className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
              ${
                settings.deathCounterShadow ? "translate-x-6" : "translate-x-1"
              }`}
              />
            </button>
            <label className="font-semibold">Shadow Color</label>
            <input
              label="Shadow Color"
              type="color"
              value={settings.deathCounterShadowColor}
              onChange={(e) =>
                updateSetting("deathCounterShadowColor", e.target.value)
              }
            />
          </div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 relative">
          <button
            onClick={() => {
              const defaultSettings = {
                deathCounterPrefix: "Deaths:",
              };
              Object.entries(defaultSettings).forEach(([key, val]) =>
                updateSetting(key, val)
              );
            }}
            className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>
          <div className="space-y-2">
            <label className="block font-semibold">Prefix</label>
            <InputField
              value={settings.deathCounterPrefix}
              onChange={(e) =>
                updateSetting("deathCounterPrefix", e.target.value)
              }
              placeholder="deathCounterPrefix"
            />
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl border border-white/10 relative">
          <button
            onClick={() => {
              const defaultSettings = {
                deathCounterEmotes: ["KEKW"],
                deathCounterEmotesPerDeath: 10,
              };
              Object.entries(defaultSettings).forEach(([key, val]) =>
                updateSetting(key, val)
              );
            }}
            className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>
          <div className="space-y-2">
            <label className="block font-semibold">Emotes</label>
            <p className="text-sm text-gray-400 mb-2">
              Type emote names and press space or enter to add them. Click × to
              remove. Leave empty to disable emote spawns.
            </p>
            <EmoteInput
              value={settings.deathCounterEmotes || []}
              onChange={(emotes) => updateSetting("deathCounterEmotes", emotes)}
            />

            <label className="block font-semibold">Deaths per event.</label>
            <p className="text-sm text-gray-400 mb-2">
              How many deaths should happen before emote event spawns.
            </p>

            <InputField
              type="number"
              min={1}
              max={50}
              value={settings.deathCounterEmotesPerDeath}
              onChange={(e) => {
                const value = Math.min(
                  50,
                  Math.max(1, parseInt(e.target.value) || 1)
                );
                updateSetting("deathCounterEmotesPerDeath", value);
              }}
              placeholder="Number of deaths (1-50)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
