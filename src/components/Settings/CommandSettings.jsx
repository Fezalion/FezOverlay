import InputField from "./ui/InputField";
import { useEffect, useState } from "react";

const accent = "#ff6b6b";

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
      fetch("/api/refresh", { method: "POST" }).catch(() => {});
      setCommands((prev) => prev.filter((cmd) => cmd.name !== name));
    });
  }

  function addCommand(name, text) {
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
        fetch("/api/refresh", { method: "POST" }).catch(() => {});
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

  const sectionStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: "12px",
    outline: "none",
    flex: 1,
    transition: "all 0.15s",
  };

  const buttonStyle = {
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: "500",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={sectionStyle}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Custom Commands
        </h3>

        {/* Add New Command */}
        <div style={{ marginBottom: "24px" }}>
          <h4
            style={{
              fontSize: "12px",
              fontWeight: "600",
              marginBottom: "12px",
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Add New Command
          </h4>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              id="new-command-name"
              placeholder="Command Name"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = `${accent}55`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            />
            <input
              id="new-command-text"
              placeholder="Command Text"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = `${accent}55`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            />
            <button
              onClick={() => {
                const nameInput = document.getElementById("new-command-name");
                const textInput = document.getElementById("new-command-text");
                if (
                  nameInput &&
                  textInput &&
                  nameInput.value &&
                  textInput.value
                ) {
                  if (
                    commands.some(
                      (cmd) =>
                        cmd.name.toLowerCase() ===
                        nameInput.value.toLowerCase(),
                    )
                  ) {
                    alert(
                      `A command named '${nameInput.value}' already exists.`,
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
              style={{
                ...buttonStyle,
                background: `${accent}22`,
                border: `1px solid ${accent}55`,
                color: accent,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${accent}44`;
                e.currentTarget.style.borderColor = `${accent}77`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${accent}22`;
                e.currentTarget.style.borderColor = `${accent}55`;
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Separator */}
        <div
          style={{
            height: "1px",
            background: "rgba(255,255,255,0.1)",
            marginBottom: "24px",
          }}
        />

        {/* Existing Commands */}
        <h4
          style={{
            fontSize: "12px",
            fontWeight: "600",
            marginBottom: "12px",
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Existing Commands
        </h4>

        {!commands || commands.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>
            No commands added.
          </p>
        ) : (
          commands.map((cmd, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "12px",
                padding: "12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span
                style={{
                  color: accent,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "11px",
                  fontWeight: "500",
                  padding: "8px 12px",
                  background: `${accent}11`,
                  borderRadius: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                !{cmd.name}
              </span>
              <input
                type="text"
                value={cmd.text}
                onChange={(e) => {
                  updateCommand(cmd.name, e.target.value);
                }}
                style={{
                  ...inputStyle,
                  flex: 1,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = `${accent}55`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              />
              <button
                onClick={() => removeCommand(cmd.name)}
                style={{
                  ...buttonStyle,
                  background: "rgba(255,107,107,0.22)",
                  border: "1px solid rgba(255,107,107,0.55)",
                  color: "rgba(255,107,107,0.8)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,107,107,0.44)";
                  e.currentTarget.style.borderColor = "rgba(255,107,107,0.77)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,107,107,0.22)";
                  e.currentTarget.style.borderColor = "rgba(255,107,107,0.55)";
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
