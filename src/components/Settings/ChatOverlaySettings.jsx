import { useState, useMemo } from "react";
import ColorPicker from "react-best-gradient-color-picker";
import InputField from "./ui/InputField";
import { EffectCard } from "./ui/EffectCard";
import Modal from "./ui/Modal";
import { hexToRgb, getStrokeTextShadow } from "../../utils";

export default function ChatOverlaySettings({ settings, updateSetting }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showOutlinePicker, setShowOutlinePicker] = useState(false);

  const textShadow = useMemo(
    () =>
      getStrokeTextShadow(settings.textStrokeSize, settings.textStrokeColor),
    [settings.textStrokeSize, settings.textStrokeColor]
  );

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-6">
          {/* Account Settings */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">Account</h3>

            <InputField
              label="Twitch Username"
              placeholder="Twitch Username"
              value={settings.twitchName}
              onChange={(e) => updateSetting("twitchName", e.target.value)}
            />

            <InputField
              placeholder="Emote set id"
              label="Emote set id"
              value={settings.emoteSetId}
              onChange={(e) => updateSetting("emoteSetId", e.target.value)}
            />
          </div>
          {/* General Settings */}
          <div className="relative bg-white/5 p-4 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">Layout</h3>
            <button
              onClick={() => {
                const defaultSubEffects = {
                  chatBackgroundColor: "rgba(0, 0, 0, 0)",
                  chatAlignment: "left",
                };
                Object.entries(defaultSubEffects).forEach(([key, val]) =>
                  updateSetting(key, val)
                );
              }}
              className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
            >
              Reset
            </button>

            <label className="block mb-2">Alignment</label>
            <select
              value={settings.chatAlignment}
              onChange={(e) => updateSetting("chatAlignment", e.target.value)}
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
                value={settings.chatBackgroundColor}
                onChange={(color) =>
                  updateSetting("chatBackgroundColor", color)
                }
                disableDarkMode
              />
              //TODO: MAKE PREVIEW
            </Modal>
          </div>
          <div className="relative bg-white/5 p-4 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">Font</h3>
            <button
              onClick={() => {
                const defaultSubEffects = {
                  chatFontColor: "#ffffff",
                  chatFontSize: 14,
                };
                Object.entries(defaultSubEffects).forEach(([key, val]) =>
                  updateSetting(key, val)
                );
              }}
              className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
            >
              Reset
            </button>
            <label className="font-semibold">Font Color</label>
            <input
              label="Font Color"
              type="color"
              value={settings.chatFontColor}
              onChange={(e) => updateSetting("chatFontColor", e.target.value)}
            />
            <br></br>

            <InputField
              label="Font Size"
              type="range"
              min={8}
              max={30}
              step={1}
              value={settings.chatFontSize}
              onChange={(e) =>
                updateSetting("chatFontSize", parseInt(e.target.value))
              }
            />
            {/* Outline */}
            <label className="flex items-center gap-2 mb-4 mt-4">
              <label className="font-semibold">Enable Text Outline</label>
              <button
                disabled
                onClick={() =>
                  updateSetting("textStroke", !settings.textStroke)
                }
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
              disabled
              onChange={(e) =>
                updateSetting("textStrokeSize", parseInt(e.target.value))
              }
            />

            <button
              disabled
              onClick={() => setShowOutlinePicker(true)}
              className="w-full bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg transition disabled:opacity-50"
            >
              Pick Outline Color
            </button>

            <Modal
              isOpen={showOutlinePicker}
              onClose={() => setShowOutlinePicker(false)}
            >
              <ColorPicker
                value={settings.textStrokeColor}
                onChange={(color) => updateSetting("textStrokeColor", color)}
                hideColorTypeBtns
                hideGradientTypeBtns
                hideControls
                disableDarkMode
              />
              //TODO: MAKE PREVIEW
            </Modal>
          </div>
          {/* Layout Settings */}
          <div className="relative bg-white/5 p-4 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">Layout</h3>
            <button
              onClick={() => {
                const defaultSubEffects = {
                  maxChatMessages: 10,
                  chatFadeDuration: 10000,
                  chatFadeTransition: 2000,
                  chatEditMode: false,
                  chatWidth: 800,
                  chatHeight: 300,
                };
                Object.entries(defaultSubEffects).forEach(([key, val]) =>
                  updateSetting(key, val)
                );
              }}
              className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
            >
              Reset
            </button>
            <label className="flex items-center gap-2 mb-4 mt-4">
              <label className="font-semibold">
                Edit Mode (puts an outline and background for you to see if you
                wanna move the overlay).
              </label>
              <button
                onClick={() =>
                  updateSetting("chatEditMode", !settings.chatEditMode)
                }
                className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
              ${settings.chatEditMode ? "bg-rose-500" : "bg-gray-700"}`}
              >
                <span
                  className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
                ${settings.chatEditMode ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </label>
            <InputField
              label="Width"
              type="range"
              min={10}
              max={1000}
              step={1}
              value={settings.chatWidth}
              onChange={(e) =>
                updateSetting("chatWidth", parseFloat(e.target.value))
              }
            />
            <InputField
              label="Height"
              type="range"
              min={10}
              max={1000}
              step={1}
              value={settings.chatHeight}
              onChange={(e) =>
                updateSetting("chatHeight", parseInt(e.target.value))
              }
            />
            <InputField
              label="Maximum amount of chat messages"
              type="range"
              min={2}
              max={50}
              step={1}
              value={settings.maxChatMessages}
              onChange={(e) =>
                updateSetting("maxChatMessages", parseInt(e.target.value))
              }
            />
            <InputField
              label="wip:chatFadeDuration, duration of messages staying on screen"
              type="range"
              min={100}
              max={50000}
              step={10}
              value={settings.chatFadeDuration}
              onChange={(e) =>
                updateSetting("chatFadeDuration", parseInt(e.target.value))
              }
            />
            <InputField
              label="wip:chatFadeTransition, duration of messages disappearingf animation"
              type="range"
              min={100}
              max={10000}
              step={10}
              value={settings.chatFadeTransition}
              onChange={(e) =>
                updateSetting("chatFadeTransition", parseInt(e.target.value))
              }
            />
          </div>

          <EffectCard
            effectKey="chatEffectRainbowText"
            label="Rainbow Text"
            enabled={settings.chatEffectRainbowText}
            toggleEnabled={() =>
              updateSetting(
                "chatEffectRainbowText",
                !settings.chatEffectRainbowText
              )
            }
            settings={settings}
            onChange={updateSetting}
            fields={[
              {
                key: "chatEffectRainbowTextChance",
                label: "Chance (s)",
                min: 1,
                max: 100,
                step: 1,
                parser: parseInt,
              },
            ]}
          ></EffectCard>

          <EffectCard
            effectKey="chatEffectJumpingText"
            label="Jumping Text"
            enabled={settings.chatEffectJumpingText}
            toggleEnabled={() =>
              updateSetting(
                "chatEffectJumpingText",
                !settings.chatEffectJumpingText
              )
            }
            settings={settings}
            onChange={updateSetting}
            fields={[
              {
                key: "chatEffectJumpingTextChance",
                label: "Chance (s)",
                min: 1,
                max: 100,
                step: 1,
                parser: parseInt,
              },
            ]}
          ></EffectCard>
        </div>
      </div>
    </>
  );
}
