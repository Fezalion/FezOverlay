import { useState, useMemo } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import Modal from "./ui/Modal";
import { hexToRgb, getStrokeTextShadow } from "../../utils";

export default function SongOverlaySettings({ settings, updateSetting }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showOutlinePicker, setShowOutlinePicker] = useState(false);

  const textShadow = useMemo(
    () => getStrokeTextShadow(settings.textStrokeSize, settings.textStrokeColor),
    [settings.textStrokeSize, settings.textStrokeColor]
  );

  const resetDefaults = () => {
    const defaults = {
      lastfmName: "",
      playerAlignment: "right",
      bgColor: "rgba(128, 0, 128, 1)",
      fontColor: "#ffffff",
      textStroke: false,
      textStrokeSize: 0,
      textStrokeColor: "#000000",
      scaleSize: 1.0,
      padding: 10,
      maxWidth: 700
    };
    Object.entries(defaults).forEach(([k, v]) => updateSetting(k, v));
  };

  return (
    <div className="space-y-6">
      {/* Account Settings */}
      <div className="bg-white/5 p-4 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold mb-4">Account</h3>

        <InputField
          label="Lastfm Username"
          value={settings.lastfmName}
          onChange={e => updateSetting("lastfmName", e.target.value)}          
          placeholder="Enter your Lastfm username"
        />
      </div>

      {/* General Settings */}
      <div className="bg-white/5 p-4 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold mb-4">General</h3>

        <label className="block mb-2">Alignment</label>
        <select
          value={settings.playerAlignment}
          onChange={e => updateSetting("playerAlignment", e.target.value)}
          className="appearance-none rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-sm text-white focus:ring-2 focus:ring-rose-400 mb-4"
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>

        {/* Background Picker */}
        <label className="block mb-2">Background Color</label>
        <button
          onClick={() => setShowPicker(true)}
          className="w-full bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg transition"
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
            className="my-4"          
            style={{
              padding: `${settings.padding}px`,
              fontFamily: settings.fontFamily,
              color: `rgb(${hexToRgb(settings.fontColor)})`,
              background: settings.bgColor,
              textAlign: settings.playerAlignment,
              textShadow
            }}
          >
            Example Artist - Example Track
          </div>
        </Modal>
      </div>

      {/* Font Settings */}
      <div className="bg-white/5 p-4 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold mb-4">Font</h3>

        <label className="font-semibold">Font Color</label>
        <input
          label="Font Color"
          type="color"
          value={settings.fontColor}
          onChange={e => updateSetting("fontColor", e.target.value)}
        />

        {/* Outline */}
        <label className="flex items-center gap-2 mb-4 mt-4">
          <label className="font-semibold">Enable Text Outline</label>
          <button
          onClick={() => updateSetting("textStroke", !settings.textStroke)}
          className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
            ${settings.textStroke ? "bg-rose-500" : "bg-gray-700"}`}
        >
          <span
            className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
              ${settings.textStroke ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>          
        </label>

        <InputField
          label="Text Stroke Size"
          type="range"
          min={0}
          max={20}
          step={1}
          value={settings.textStrokeSize}
          disabled={!settings.textStroke}
          onChange={e => updateSetting("textStrokeSize", parseInt(e.target.value))}
        />

        <button
          disabled={!settings.textStroke}
          onClick={() => setShowOutlinePicker(true)}
          className="w-full bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg transition disabled:opacity-50"
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
            style={{
              padding: `${settings.padding}px`,
              fontFamily: settings.fontFamily,
              color: `rgb(${hexToRgb(settings.fontColor)})`,
              background: settings.bgColor,              
              textAlign: settings.playerAlignment,
              textShadow
            }}
          >
            Example Artist - Example Track
          </div>
        </Modal>
      </div>

      {/* Layout Settings */}
      <div className="bg-white/5 p-4 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold mb-4">Layout</h3>
        <InputField
          label="Scale Size"
          type="range"
          min={0.05}
          max={10.0}
          step={0.05}
          value={settings.scaleSize}
          onChange={e => updateSetting("scaleSize", parseFloat(e.target.value))}
        />
        <InputField
          label="Padding"
          type="range"
          min={0}
          max={20}
          step={1}
          value={settings.padding}
          onChange={e => updateSetting("padding", parseInt(e.target.value))}
        />
        <InputField
          label="Max Width"
          type="range"
          min={100}
          max={5000}
          step={10}
          value={settings.maxWidth}
          onChange={e => updateSetting("maxWidth", parseInt(e.target.value))}
        />
      </div>

      {/* Global Controls */}
      <div className="flex items-center justify-end bg-white/5 p-4 rounded-xl border border-white/10">
        <button
          onClick={resetDefaults}
          className="px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
