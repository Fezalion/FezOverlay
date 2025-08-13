import InputField from "./ui/InputField";

function EffectCard({ effectKey, label, enabled, toggleEnabled, settings, onChange, fields }) {
  const handleChange = (key, val) => onChange(key, val);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-md transition hover:shadow-lg">
      <div className="flex justify-between items-center">
        <span className="font-medium text-white">{label}</span>

        {/* Toggle Switch */}
        <button
          onClick={toggleEnabled}
          className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
            ${enabled ? "bg-purple-500" : "bg-gray-700"}`}
        >
          <span
            className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
              ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 mt-4">
          {fields.map(({ key, label, min, max, step }) => (
            <div key={key}>
              <InputField
                label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={e => handleChange(key, parseFloat(e.target.value))}
              />
              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



export default function EmoteOverlaySettings({ settings, updateSetting, availableSubEffects }) {
  const handleChange = (key, parser = v => v) => e => updateSetting(key, parser(e.target.value));

  const toggleEffect = effectKey => {
    const newSelected = settings.subEffectTypes.includes(effectKey)
      ? settings.subEffectTypes.filter(e => e !== effectKey)
      : [...settings.subEffectTypes, effectKey];
    updateSetting("subEffectTypes", newSelected);
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-lg space-y-4">
      <h2 className="text-xl font-semibold mb-2">Emote Overlay Settings</h2>

      {/* --- General Settings --- */}
      <InputField
        label="Twitch Username"
        value={settings.twitchName}
        onChange={handleChange("twitchName")}
        placeholder="Enter your Twitch username"
      />

      <InputField
        label="7TV Emote Set ID"
        value={settings.emoteSetId}
        onChange={handleChange("emoteSetId")}
        placeholder="Enter 7TV emote set ID"
      />

      <InputField
        label="Emote Lifetime (ms)"
        type="number"
        min={500}
        max={20000}
        value={settings.emoteLifetime}
        onChange={handleChange("emoteLifetime", parseInt)}
      />

      <InputField
        label="Emote Scale"
        type="number"
        min={0.1}
        max={5.0}
        step={0.1}
        value={settings.emoteScale}
        onChange={handleChange("emoteScale", parseFloat)}
      />

      <InputField
        label="Emote Delay (ms)"
        type="number"
        min={0}
        max={5000}
        step={1}
        value={settings.emoteDelay}
        onChange={handleChange("emoteDelay", parseInt)}
      />

      {/* --- Sub Effects Toggle + Reset Button --- */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-white font-medium">Enable Sub Effects</span>
        <div className="flex items-center gap-3">
          {/* Toggle Switch */}
          <button
            onClick={() => updateSetting("subEffects", !settings.subEffects)}
            className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
              ${settings.subEffects ? "bg-purple-500" : "bg-gray-700"}`}
          >
            <span
              className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
                ${settings.subEffects ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>

          {/* Reset Button */}
          <button
            onClick={() => {
              const defaultSubEffects = {
                emoteLifetime: 5000,
                emoteScale:1.0,
                emoteDelay: 150,
                subEffectHueShiftChance:5,
                subEffectBlackHoleChance: 5,
                subEffectBlackHoleDuration: 5,
                subEffectBlackHoleStrength: 0.0005,
                subEffectReverseGravityChance: 5,
                subEffectReverseGravityDuration: 5,
                subEffectReverseGravityStrength: 0.002,
                subEffectTypes: [],
              };
              Object.entries(defaultSubEffects).forEach(([key, val]) => updateSetting(key, val));
            }}
            className="px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>
        </div>
      </div>

      {/* --- Effects Cards --- */}
      <div className="space-y-4 mt-4">
        {availableSubEffects.map(effect => {
          let fields = [];
          switch (effect) {
            case "magneticAttraction":
              fields = [
                { key: "subEffectBlackHoleChance", label: "Chance", min: 0, max: 100, step: 1 },
                { key: "subEffectBlackHoleDuration", label: "Duration (s)", min: 1, max: 20, step: 1 },
                { key: "subEffectBlackHoleStrength", label: "Strength", min: 0.00001, max: 0.01, step: 0.00001 },
              ];
              break;
            case "reverseGravity":
              fields = [
                { key: "subEffectReverseGravityChance", label: "Chance", min: 0, max: 100, step: 1 },
                { key: "subEffectReverseGravityDuration", label: "Duration (s)", min: 1, max: 20, step: 1 },
                { key: "subEffectReverseGravityStrength", label: "Strength", min: 0.0001, max: 0.01, step: 0.0001 },
              ];
              break;
            default:
              fields = [];
          }

          return (
            <EffectCard
              key={effect}
              effectKey={effect}
              label={effect.charAt(0).toUpperCase() + effect.slice(1)}
              enabled={settings.subEffectTypes.includes(effect)}
              toggleEnabled={() => toggleEffect(effect)}
              settings={settings}
              onChange={updateSetting}
              fields={fields}
            />
          );
        })}
      </div>
    </div>
  );
}
