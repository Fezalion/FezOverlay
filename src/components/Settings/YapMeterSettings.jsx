import InputField from "./ui/InputField";

export default function YapMeterSettings({ settings, updateSetting }) {
  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-6">
        <h3 className="text-2xl font-semibold text-center">
          Yap Meter Settings
        </h3>

        {/* YapMeter Settings */}
        <div className="relative bg-white/5 p-4 rounded-xl border border-white/10">
          <h3 className="text-lg font-semibold mb-4">YapMeter</h3>
          <button
            onClick={() => {
              const defaultYapMeter = {
                yapMeterThreshold: 1.0,
                yapMeterSilenceThreshold: 3,
                yapMeterMaxYap: 60,
                yapMeterLength: 300,
              };
              Object.entries(defaultYapMeter).forEach(([key, val]) =>
                updateSetting(key, val)
              );
            }}
            className="absolute top-5 right-5 px-3 py-1 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition"
          >
            Reset
          </button>

          <InputField
            type="range"
            label="Yap Threshold"
            min={0.1}
            max={5.0}
            step={0.1}
            value={settings.yapMeterThreshold}
            onChange={(e) =>
              updateSetting("yapMeterThreshold", parseFloat(e.target.value))
            }
          />

          <InputField
            type="range"
            label="Silence Threshold (s)"
            min={1}
            max={10}
            step={1}
            value={settings.yapMeterSilenceThreshold}
            onChange={(e) =>
              updateSetting(
                "yapMeterSilenceThreshold",
                parseInt(e.target.value)
              )
            }
          />

          <InputField
            type="range"
            label="Max Yap (s)"
            min={10}
            max={300}
            step={5}
            value={settings.yapMeterMaxYap}
            onChange={(e) =>
              updateSetting("yapMeterMaxYap", parseInt(e.target.value))
            }
          />

          <InputField
            type="range"
            label="Yap Meter Length (px)"
            min={250}
            max={1000}
            step={5}
            value={settings.yapMeterLength}
            onChange={(e) =>
              updateSetting("yapMeterLength", parseInt(e.target.value))
            }
          />
        </div>
      </div>
    </div>
  );
}
