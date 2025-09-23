import { useState } from "react";
import { useMetadata } from "../../hooks/useMetadata";
import SongOverlaySettings from "./SongOverlaySettings";
import EmoteOverlaySettings from "./EmoteOverlaySettings";
import YapMeterSettings from "./YapMeterSettings";
import CommandSettings from "./CommandSettings";
import ChatOverlaySettings from "./ChatOverlaySettings";

const MENU = [
  { key: "song", label: "Song Overlay", component: SongOverlaySettings },
  { key: "emote", label: "Emote Overlay", component: EmoteOverlaySettings },
  { key: "yap", label: "Yap Meter", component: YapMeterSettings },
  { key: "commands", label: "Commands", component: CommandSettings },
  { key: "chat", label: "Chat Overlay", component: ChatOverlaySettings },
];

function Settings() {
  const {
    settings,
    updateSetting,
    availableSubEffects,
    version,
    latestVersion,
  } = useMetadata();

  const [selected, setSelected] = useState(MENU[0].key);

  // Map key to component
  const renderComponent = (key) => {
    switch (key) {
      case "song":
        return (
          <SongOverlaySettings
            settings={settings}
            updateSetting={updateSetting}
          />
        );
      case "emote":
        return (
          <EmoteOverlaySettings
            settings={settings}
            updateSetting={updateSetting}
            availableSubEffects={availableSubEffects}
          />
        );
      case "yap":
        return (
          <YapMeterSettings settings={settings} updateSetting={updateSetting} />
        );
      case "commands":
        return <CommandSettings />;
      case "chat":
        return (
          <ChatOverlaySettings
            settings={settings}
            updateSetting={updateSetting}
          />
        );
      default:
        return null;
    }
  };

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

      <div className="flex gap-8">
        {/* Sidebar Menu */}
        <nav className="w-48 flex-shrink-0 sticky top-6 self-start">
          <ul className="flex flex-col gap-2">
            {MENU.map((item) => (
              <li key={item.key}>
                <button
                  className={`w-full text-left px-4 py-2 rounded transition-colors ${
                    selected === item.key
                      ? "bg-gray-700 font-bold"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSelected(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {/* Main Content */}
        <div className="flex-1 min-w-0">{renderComponent(selected)}</div>
      </div>
    </div>
  );
}

export default Settings;
