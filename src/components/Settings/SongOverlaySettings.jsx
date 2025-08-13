import { useState, useMemo } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import Modal from "./ui/Modal";
import { hexToRgb, getStrokeTextShadow } from "../../utils";

export default function SongOverlaySettings({ settings, updateSetting }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showOutlinePicker, setShowOutlinePicker] = useState(false);

  const handleChange = (key, parser = v => v) => e => updateSetting(key, parser(e.target.value));
  const handleCheckbox = key => e => updateSetting(key, e.target.checked);

  const textShadow = useMemo(
    () => getStrokeTextShadow(settings.textStrokeSize, settings.textStrokeColor),
    [settings.textStrokeSize, settings.textStrokeColor]
  );

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-lg transition-transform">
      <h2 className="text-xl font-semibold mb-4">Song Overlay Settings</h2>
      <p className="text-xs text-gray-400 mb-4">
        Adjust overlay position via OBS Browser Source → Interact.
        Use arrow keys (Shift = faster). Space resets to 0,0 (bottom-right corner).
      </p>

      <InputField
        label="Lastfm Username"
        value={settings.lastfmName}
        onChange={handleChange("lastfmName")}
        placeholder="Enter your Lastfm username"
      />

      <label className="flex flex-col gap-1 mb-4">
        <span>Alignment</span>
        <select
          value={settings.playerAlignment}
          onChange={handleChange("playerAlignment")}
          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white focus:ring-2 focus:ring-purple-400"
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

      <Modal isOpen={showPicker} onClose={() => setShowPicker(false)}>
        <ColorPicker
          value={settings.bgColor}
          onChange={color => updateSetting("bgColor", color)}
          disableDarkMode
        />
        <div
          className="mt-4 p-3 rounded-lg text-center font-medium"
          style={{
            padding: `${settings.padding}px`,
            fontFamily: settings.fontFamily,
            color: `rgb(${hexToRgb(settings.fontColor)})`,
            background: settings.bgColor,
            textShadow
          }}
        >
          Example Artist - Example Track
        </div>
      </Modal>

      {/* Font */}
      <h3 className="text-lg font-medium mt-6 mb-2">Font Settings</h3>
      <InputField
        label="Font Color"
        type="color"
        value={settings.fontColor}
        onChange={handleChange("fontColor")}
      />

      {/* Outline */}
      <h3 className="text-lg font-medium mt-6 mb-2">Text Outline</h3>
      <label className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={settings.textStroke}
          onChange={handleCheckbox("textStroke")}
          className="accent-purple-500"
        />
        <span>Enable Text Outline</span>
      </label>

      <InputField
        label="Text Stroke Size"
        type="number"
        min="0"
        max="50"
        value={settings.textStrokeSize}
        disabled={!settings.textStroke}
        onChange={handleChange("textStrokeSize", parseInt)}
      />

      <button
        disabled={!settings.textStroke}
        onClick={() => setShowOutlinePicker(true)}
        className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg transition disabled:opacity-50"
      >
        Pick Outline Color
      </button>

      <Modal isOpen={showOutlinePicker} onClose={() => setShowOutlinePicker(false)}>
        <ColorPicker
          value={settings.textStrokeColor}
          onChange={color => updateSetting("textStrokeColor", color)}
          hideColorTypeBtns
          hideGradientTypeBtns
          hideControls
          disableDarkMode
        />
        <div
          className="mt-4 p-3 rounded-lg text-center font-medium"
          style={{
            padding: `${settings.padding}px`,
            fontFamily: settings.fontFamily,
            color: `rgb(${hexToRgb(settings.fontColor)})`,
            background: settings.bgColor,
            textShadow
          }}
        >
          Example Artist - Example Track
        </div>
      </Modal>

      {/* Layout */}
      <h3 className="text-lg font-medium mt-6 mb-2">Layout Settings</h3>
      <InputField
        label="Scale Size"
        type="number"
        min="0.05"
        max="10.0"
        step="0.05"
        value={settings.scaleSize}
        onChange={handleChange("scaleSize", parseFloat)}
      />
      <InputField
        label="Padding"
        type="number"
        min="0"
        max="50"
        value={settings.padding}
        onChange={handleChange("padding", parseInt)}
      />
      <InputField
        label="Max Width"
        type="number"
        min="100"
        max="4000"
        value={settings.maxWidth}
        onChange={handleChange("maxWidth", parseInt)}
      />
    </div>
  );
}
