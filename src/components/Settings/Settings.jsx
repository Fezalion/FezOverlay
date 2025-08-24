import { useMetadata } from "../../hooks/useMetadata";
import SongOverlaySettings from "./SongOverlaySettings";
import EmoteOverlaySettings from "./EmoteOverlaySettings";
import YapMeterSettings from "./YapMeterSettings";

function Settings() {
  const {
    settings,
    updateSetting,
    availableSubEffects,
    version,
    latestVersion,
  } = useMetadata();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6 text-white">
      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-6 flex flex-wrap items-center gap-2">
        Overlay Settings
        <span className="text-sm text-gray-400">installed {version}</span>
        {latestVersion !== version && (
          <span className="text-sm text-yellow-400">
            | update available:{" "}
            <span className="font-semibold">{latestVersion}</span>
          </span>
        )}
      </h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-8">
          <SongOverlaySettings
            settings={settings}
            updateSetting={updateSetting}
          />
          <YapMeterSettings
            settings={settings}
            updateSetting={updateSetting}
          ></YapMeterSettings>
        </div>
        <EmoteOverlaySettings
          settings={settings}
          updateSetting={updateSetting}
          availableSubEffects={availableSubEffects}
        />
      </div>
    </div>
  );
}

export default Settings;
