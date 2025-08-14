import { EffectCard } from './ui/EffectCard';
import InputField from "./ui/InputField";
import { useRef, useEffect } from 'react';

export default function EmoteOverlaySettings({ settings, updateSetting }) {
  const allEffectsEnabled = settings.subEffectTypes.length > 0;
  let allAvailableEffects = useRef([]);

  useEffect(() => {
    fetch("/api/subeffecttypes")
      .then((res) => res.json())
      .then((data) => {
        allAvailableEffects.current = data;
      });
  });

  const toggleAllEffects = () => {
    if (allEffectsEnabled) {
      updateSetting("subEffectTypes", []);
    } else {
      updateSetting("subEffectTypes", [...allAvailableEffects.current]);
    }
  };

  return (      
    <div className="space-y-6">
      {/* Account Settings */}
      <div className="bg-white/5 p-4 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold mb-4">Account</h3>

        <InputField
          label="Twitch Username"
          placeholder="Twitch Username"
          value={settings.twitchName}
          onChange={e => updateSetting("twitchName", e.target.value)}
        />

        <InputField
          placeholder="Emote set id"
          label="Emote set id"
          value={settings.emoteSetId}
          onChange={e => updateSetting("emoteSetId", e.target.value)}
        />        
      </div>
      {/* General Settings */}
      <div className="relative bg-white/5 p-4 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold mb-4">General</h3>
          <button
            onClick={() => {
              const defaultSubEffects = {
                emoteLifetime: 5000,
                emoteScale:1.0,
                emoteDelay: 150,                
              };
              Object.entries(defaultSubEffects).forEach(([key, val]) => updateSetting(key, val));
            }}
            className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>
        <InputField
          type="range"
          label="Emote Lifetime (ms)"
          min={500}
          max={20000}
          step={100}
          value={settings.emoteLifetime}
          onChange={e => updateSetting("emoteLifetime", parseFloat(e.target.value))}
        />

        <InputField
          type="range"
          label="Emote Scale"
          min={0.1}
          max={2.0}
          step={0.1}
          value={settings.emoteScale}
          onChange={e => updateSetting("emoteScale", parseFloat(e.target.value))}
        />

        <InputField
          type="range"
          label="Emote Delay (ms)"
          min={0}
          max={5000}
          step={10}
          value={settings.emoteDelay}
          onChange={e => updateSetting("emoteDelay", parseFloat(e.target.value))}
        />
      </div>

      {/* Global Controls */}
      <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex items-center space-x-3">
          <label className="font-semibold">Enable All Effects</label>
          <button
          onClick={toggleAllEffects}
          className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
            ${allEffectsEnabled ? "bg-rose-500" : "bg-gray-700"}`}
        >
          <span
            className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
              ${allEffectsEnabled ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
        </div>
        {/* Reset Button */}
          <button
            onClick={() => {
              const defaultSubEffects = {                
                subEffectHueShiftChance:5,
                subEffectBlackHoleChance: 5,
                subEffectBlackHoleDuration: 5,
                subEffectBlackHoleStrength: 2,
                subEffectReverseGravityChance: 5,
                subEffectReverseGravityDuration: 5,
                subEffectReverseGravityStrength: 2,
                subOnlyMode: false,
                subEffectTypes: [],
              };
              Object.entries(defaultSubEffects).forEach(([key, val]) => updateSetting(key, val));
            }}
            className="px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>
      </div>

      <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex items-center space-x-3">
          <label className="font-semibold">Sub only mode.</label>
          <button
          onClick={() => updateSetting("subOnlyMode", !settings.subOnlyMode)}
          className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
            ${settings.subOnlyMode ? "bg-rose-500" : "bg-gray-700"}`}
        >
          <span
            className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
              ${settings.subOnlyMode ? "translate-x-6" : "translate-x-1"}`}
          />
        </button> 
        </div>
      </div>

      {/* Effects */}
      <EffectCard
        effectKey="hueShift"
        label="Hue Shift"
        enabled={settings.subEffectTypes.includes("hueShift")}
        toggleEnabled={() => updateSetting("subEffectTypes",
          settings.subEffectTypes.includes("hueShift")
            ? settings.subEffectTypes.filter(t => t !== "hueShift")
            : [...settings.subEffectTypes, "hueShift"]
        )}
        settings={settings}
        onChange={updateSetting}
        fields={[
          { key: "subEffectHueShiftChance", label: "Chance (%)", min: 0, max: 100, step: 1, parser: parseInt }
        ]}
      />

      <EffectCard
        effectKey="magneticAttraction"
        label="Magnetic Attraction"
        enabled={settings.subEffectTypes.includes("magneticAttraction")}
        toggleEnabled={() => updateSetting("subEffectTypes",
          settings.subEffectTypes.includes("magneticAttraction")
            ? settings.subEffectTypes.filter(t => t !== "magneticAttraction")
            : [...settings.subEffectTypes, "magneticAttraction"]
        )}
        settings={settings}
        onChange={updateSetting}
        fields={[
          { key: "subEffectBlackHoleDuration", label: "Duration (s)", min: 1, max: 30, step: 1, parser: parseInt },
          { key: "subEffectBlackHoleStrength", label: "Strength", min: 1, max: 50, step: 1, parser: parseInt },
          { key: "subEffectBlackHoleChance", label: "Chance (%)", min: 1, max: 100, step: 1, parser: parseInt }
        ]}
      />

      <EffectCard
        effectKey="reverseGravity"
        label="Reverse Gravity"
        enabled={settings.subEffectTypes.includes("reverseGravity")}
        toggleEnabled={() => updateSetting("subEffectTypes",
          settings.subEffectTypes.includes("reverseGravity")
            ? settings.subEffectTypes.filter(t => t !== "reverseGravity")
            : [...settings.subEffectTypes, "reverseGravity"]
        )}
        settings={settings}
        onChange={updateSetting}
        fields={[
          { key: "subEffectReverseGravityDuration", label: "Duration (s)", min: 1, max: 30, step: 1, parser: parseInt },
          { key: "subEffectReverseGravityStrength", label: "Strength", min: 1, max: 10, step: 1, parser: parseInt },
          { key: "subEffectReverseGravityChance", label: "Chance (%)", min: 1, max: 100, step: 1, parser: parseInt }
        ]}        
      />

      <EffectCard
        effectKey="battleEvent"
        label="Battle Event"
        enabled={settings.subEffectTypes.includes("battleEvent")}
        toggleEnabled={() => updateSetting("subEffectTypes",
          settings.subEffectTypes.includes("battleEvent")
            ? settings.subEffectTypes.filter(t => t !== "battleEvent")
            : [...settings.subEffectTypes, "battleEvent"]
        )}
        settings={settings}
        onChange={updateSetting}
        fields={[
          { key: "battleEventDuration", label: "Maximum Duration (s)", min: 1, max: 60, step: 1, parser: parseInt },
          { key: "battleEventParticipants", label: "Participants", min: 2, max: 20, step: 1, parser: parseInt },
          { key: "battleEventChance", label: "Chance (%)", min: 1, max: 100, step: 1, parser: parseInt },
          { key: "battleEventHp", label: "Max HP", min: 1, max: 100, step: 1, parser: parseInt },
          { key: "battleEventDamage", label: "Damage per hit (+-20%)", min: 1, max: 100, step: 1, parser: parseInt }
        ]}        
      />
    </div>
  );
}
