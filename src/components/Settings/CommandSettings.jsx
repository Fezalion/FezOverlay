import InputField from "./ui/InputField";
import { useEffect, useState } from "react";

export default function CommandSettings() {
  const [commands, setCommands] = useState([]);

  function updateCommand(name, newText) {
    fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name, text: newText }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch((err) => {
        console.error("Failed to update command:", err);
      });
  }

  function removeCommand(name) {
    fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", name }),
    }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 🔄 Trigger overlay refresh silentl
      fetch("/api/refresh", { method: "POST" }).catch(() => {});
      // Update local state
      setCommands((prev) => prev.filter((cmd) => cmd.name !== name));
    });
  }

  function addCommand(name, text) {
    // Prevent duplicate command names (case-insensitive)
    if (commands.some((cmd) => cmd.name.toLowerCase() === name.toLowerCase())) {
      alert(`A command named '${name}' already exists.`);
      return;
    }
    fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name, text }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // 🔄 Trigger overlay refresh silentl
        fetch("/api/refresh", { method: "POST" }).catch(() => {});
        // Update local state
        setCommands((prev) => [...prev, { name, text }]);
        console.log("Added command:", name, text);
      })
      .catch((err) => {
        console.error("Failed to add command:", err);
      });
  }

  useEffect(() => {
    fetch("/api/commands")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCommands(data);
          console.log("[DEBUG] Loaded commands:", data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch commands:", err);
      });
  }, [setCommands]);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-6">
        {/* Command Settings */}
        <div className="relative bg-white/5 p-4 rounded-xl border border-white/10">
          <h3 className="text-lg font-semibold mb-4">Custom Commands</h3>
          <div className="space-y-4 pr-2">
            <div>
              <h4 className="text-md font-semibold mb-2">Add New Command</h4>
              <div className="flex items-center space-x-2 p-2">
                <input
                  id="new-command-name"
                  placeholder="Command Name"
                  className="flex-1 bg-gray-800 text-white px-2 py-1 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                ></input>
                <input
                  id="new-command-text"
                  placeholder="Command Text"
                  className="flex-1 bg-gray-800 text-white px-2 py-1 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                ></input>
                <button
                  onClick={() => {
                    const nameInput =
                      document.getElementById("new-command-name");
                    const textInput =
                      document.getElementById("new-command-text");
                    if (
                      nameInput &&
                      textInput &&
                      nameInput.value &&
                      textInput.value
                    ) {
                      // Prevent duplicate command names (case-insensitive)
                      if (
                        commands.some(
                          (cmd) =>
                            cmd.name.toLowerCase() ===
                            nameInput.value.toLowerCase()
                        )
                      ) {
                        alert(
                          `A command named '${nameInput.value}' already exists.`
                        );
                        return;
                      }
                      addCommand(nameInput.value, textInput.value);
                      nameInput.value = "";
                      textInput.value = "";
                    } else {
                      alert("Please provide both command name and text.");
                    }
                  }}
                  className="ml-auto px-2 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-500 transition"
                >
                  Add
                </button>
              </div>
            </div>

            <hr className="border-gray-700" />

            <h4 className="text-md font-semibold mb-2">Existing Commands</h4>

            {!commands && (
              <p className="text-center text-gray-400">No commands added.</p>
            )}
            {commands &&
              commands.map((cmd, index) => (
                <div key={index} className="flex items-center space-x-2 p-2">
                  <span className="text-white font-mono">!{cmd.name}</span>
                  <input
                    type="text"
                    value={cmd.text}
                    onChange={() => {
                      updateCommand(cmd.name, event.target.value);
                    }}
                    className="flex-1 bg-gray-800 text-white px-2 py-1 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  ></input>
                  <button
                    onClick={() => removeCommand(cmd.name)}
                    className="ml-auto px-2 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-500 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
