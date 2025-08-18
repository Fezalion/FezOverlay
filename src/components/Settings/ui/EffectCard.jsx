import InputField from "./InputField";

export function EffectCard({
  effectKey,
  label,
  enabled,
  toggleEnabled,
  settings,
  onChange,
  fields,
}) {
  const handleFieldChange = (key, parser) => (e) => {
    const value = parser ? parser(e.target.value) : e.target.value;
    onChange(key, value);
  };

  return (
    <div
      key={effectKey}
      className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-md transition hover:shadow-lg"
    >
      <div className="flex justify-between items-center">
        <label className="font-medium text-white">{label}</label>
        {/* Toggle Switch */}
        <button
          onClick={toggleEnabled}
          className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-300
            ${enabled ? "bg-rose-500" : "bg-gray-700"}`}
        >
          <span
            className={`inline-block w-5 h-5 transform bg-white rounded-full shadow-md transition-transform duration-300
              ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 mt-4">
          {fields.map(({ key, label, min, max, step, parser }) => (
            <div key={key}>
              <InputField
                type="range"
                label={label}
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={handleFieldChange(key, parser)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
