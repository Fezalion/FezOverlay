const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const https = require("https");
const http = require("http");
const dotenv = require("dotenv");
const fs = require("fs");
const { WebSocketServer } = require("ws");
const OBSWebSocket = require("obs-websocket-js").default;
const { EventSubscription } = require("obs-websocket-js");
const repo = "Fezalion/FezOverlay";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

// Load env initially
function getEnvPath() {
  if (process.pkg) {
    // running as a pkg executable → look next to the .exe
    return path.join(process.cwd(), ".env");
  } else {
    // running in dev (node) → look next to server.cjs
    return path.join(__dirname, ".env");
  }
}

const envPath = getEnvPath();
dotenv.config({ path: envPath });

function reloadEnv() {
  dotenv.config({ path: envPath, override: true });
  console.log("[API] Reloaded environment variables.");
}

const obs = new OBSWebSocket();
const SPEAK_THRESHOLD = 0.01; // normalized 0..1
const SILENCE_RESET_MS = 5000;
let micSourceName = null;
let obsReady = false;
let connectedClients = new Set();

// Initialize OBS connection
(async () => {
  try {
    try {
      // Use the correct subscription syntax for obs-websocket-js
      await obs.connect("ws://localhost:4455", undefined, {
        eventSubscriptions:
          EventSubscription.All | EventSubscription.InputVolumeMeters,
        rpcVersion: 1,
      });
      console.log("✅ Connected to OBS WebSocket!");
      console.log("✅ Subscribed to all events including high-volume!");
    } catch (connectionError) {
      console.log(
        "❌ Connection or subscription failed:",
        connectionError.message
      );
    }

    // Auto-detect first available microphone input
    const sources = await obs.call("GetInputList");
    console.log(
      "📋 Available inputs:",
      sources.inputs.map((i) => `${i.inputName} (${i.inputKind})`)
    );

    const micInput = sources.inputs.find(
      (i) =>
        i.inputKind === "wasapi_input_capture" ||
        i.inputKind === "dshow_input" ||
        i.inputKind === "coreaudio_input_capture" || // macOS
        i.inputKind === "pulse_input_capture" || // Linux
        i.inputKind === "alsa_input_capture" // Linux
    );

    if (!micInput) {
      console.error("❌ No microphone input found in OBS!");
      console.error(
        "Available input kinds:",
        sources.inputs.map((i) => i.inputKind)
      );
      return;
    }

    micSourceName = micInput.inputName;
    obsReady = true;
    console.log(
      `🎤 Using mic source: "${micSourceName}" (${micInput.inputKind})`
    );
    console.log("🚀 YapMeter ready for WebSocket connections on port 8080");
  } catch (err) {
    console.error("❌ OBS connection or source detection failed:", err);
    process.exit(1);
  }
})();

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("🔗 YapMeter WebSocket client connected");

  // Check if OBS is ready
  if (!obsReady || !micSourceName) {
    ws.send(JSON.stringify({ error: "OBS not ready" }));
    ws.close(1013, "OBS not ready");
    return;
  }

  // Add client to active connections
  connectedClients.add(ws);

  // Initialize client state on the WebSocket object
  ws.yapScore = 0;
  ws.speaking = false;
  ws.lastSpeakingTime = Date.now();
  ws.continuousStartTime = 0;

  // Send initial state
  ws.send(JSON.stringify({ yapScore: "0.00", speaking: false }));

  // Handle client disconnect
  ws.on("close", () => {
    console.log("📴 YapMeter WebSocket client disconnected");
    connectedClients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    connectedClients.delete(ws);
  });
});

// Function to process audio level data
function processAudioLevel(normalized) {
  if (connectedClients.size === 0) return;

  const now = Date.now();

  // Broadcast to all connected clients
  connectedClients.forEach((ws) => {
    if (ws.readyState !== WebSocket.OPEN) {
      connectedClients.delete(ws);
      return;
    }

    let yapScore = 0;
    let speaking = false;
    let lastSpeakingTime = ws.lastSpeakingTime || now;
    let continuousStartTime = ws.continuousStartTime || 0;

    // Check if currently speaking
    if (normalized > SPEAK_THRESHOLD) {
      if (!ws.speaking) {
        speaking = true;
        continuousStartTime = now;
        console.log(`🗣️ Started speaking (level: ${normalized.toFixed(3)})`);
      } else {
        speaking = true;
        continuousStartTime = ws.continuousStartTime;
      }
      lastSpeakingTime = now;
      yapScore = (now - continuousStartTime) / 1000;
    } else {
      // Check if we should reset due to silence
      if (ws.speaking && now - lastSpeakingTime > SILENCE_RESET_MS) {
        speaking = false;
        yapScore = 0;
        continuousStartTime = 0;
        console.log(`🤐 Stopped speaking after ${SILENCE_RESET_MS}ms silence`);
      } else if (ws.speaking) {
        // Still in grace period
        speaking = true;
        continuousStartTime = ws.continuousStartTime;
        yapScore = (lastSpeakingTime - continuousStartTime) / 1000;
      }
    }

    // Store state on WebSocket object
    ws.speaking = speaking;
    ws.lastSpeakingTime = lastSpeakingTime;
    ws.continuousStartTime = continuousStartTime;

    // Send update to client
    try {
      ws.send(
        JSON.stringify({
          yapScore: yapScore.toFixed(2),
          speaking: speaking,
          audioLevel: normalized.toFixed(3),
          threshold: SPEAK_THRESHOLD,
        })
      );
    } catch (error) {
      console.error("Error sending to client:", error);
      connectedClients.delete(ws);
    }
  });
}

// Handle specific OBS events using the correct syntax
obs.on("InputVolumeMeters", (data) => {
  // Find the microphone input in the data
  const inputs = data.inputs || [];
  const mic = inputs.find((i) => i.inputName === micSourceName);

  if (!mic) {
    console.log(
      "❌ Mic not found in inputs. Available:",
      inputs.map((i) => i.inputName)
    );
    return;
  }

  // Check for different possible property names
  const levels =
    mic.inputLevelsMul || mic.inputLevels || mic.levels || mic.meters;
  if (!levels || levels.length === 0) {
    console.log("❌ No level data found. Mic object:", mic);
    return;
  }

  // Use the first channel's level (mono or left channel)
  const normalized = levels[0][0];
  processAudioLevel(normalized);
});

// Listen for connection events
obs.on("ConnectionOpened", () => {
  console.log("🔗 OBS WebSocket connection opened");
});

obs.on("ConnectionClosed", () => {
  console.log("❌ OBS WebSocket connection closed");
  obsReady = false;
});

obs.on("ConnectionError", (error) => {
  console.error("❌ OBS WebSocket connection error:", error);
});

// Handle OBS disconnection
obs.on("ConnectionClosed", () => {
  console.log("❌ OBS WebSocket connection closed");
  obsReady = false;

  // Notify all clients
  connectedClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ error: "OBS connection lost" }));
      ws.close(1011, "OBS connection lost");
    }
  });
  connectedClients.clear();
});

// Handle OBS connection errors
obs.on("ConnectionError", (error) => {
  console.error("❌ OBS WebSocket connection error:", error);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down YapMeter...");

  // Close all WebSocket connections
  connectedClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1001, "Server shutting down");
    }
  });

  // Close WebSocket server
  wss.close();

  // Disconnect from OBS
  try {
    await obs.disconnect();
    console.log("✅ Disconnected from OBS");
  } catch (error) {
    console.error("Error disconnecting from OBS:", error);
  }

  process.exit(0);
});

function broadcast(msg) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

const PORT = 48000;

// Fix for pkg: use process.execPath for base directory if packaged
let baseDir = __dirname;
if (process.pkg) {
  baseDir = path.dirname(process.execPath);
}

const distRoot = path.join(baseDir, "dist");
const SETTINGS_FILE = path.join(baseDir, "settings.json");
const BOTS_FILE = path.join(baseDir, "excludedBots.json");
const versionFile = path.join(baseDir, "version.txt");

app.use(bodyParser.json());
app.use(express.static(distRoot));

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;

function GenerateAccess() {
  const clientId = "pro83yr2qxpqs1qwy85uqkp17w5wpl";
  const redirectUri = "http://localhost:48000/auth/twitch/callback";
  const scopes = ["chat:read", "chat:edit"];

  if (!clientId) {
    console.error("[Twitch API] CLIENT_ID is missing in .env");
    return;
  }

  const authUrl =
    `https://id.twitch.tv/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` + // <-- token flow
    `&scope=${encodeURIComponent(scopes.join(" "))}`;

  console.log("\n[ Twitch OAuth Setup ]");
  console.log("👉 Open this URL in your browser to authorize Twitch:");
  console.log(authUrl);
  console.log(
    "\nAfter login, the token will be sent back and saved automatically.\n"
  );
}

function getLatestRelease(cb) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  console.log("Fetching latest release from:", url);

  https
    .get(
      url,
      {
        headers: { "User-Agent": "node" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            console.log("GitHub API response status:", res.statusCode);
            const release = JSON.parse(data);

            // Check for API errors
            if (release.message) {
              if (release.message.includes("Not Found")) {
                return cb(new Error("Repository or release not found"));
              }
              return cb(new Error(`GitHub API error: ${release.message}`));
            }

            // Check if we have a valid release
            if (!release.tag_name) {
              return cb(new Error("No tag_name found in release"));
            }

            console.log("Latest release found:", release.tag_name);
            cb(null, release);
          } catch (err) {
            console.error("Failed to parse response:", err.message);
            cb(new Error("Failed to parse GitHub API response"));
          }
        });
      }
    )
    .on("error", (err) => {
      console.error("Network error:", err.message);
      cb(new Error(`Failed to fetch latest release: ${err.message}`));
    });
}

//check if updater.exe.new was downloaded and perform self-update
const updaterNewPath = path.join(baseDir, "updater.exe.new");
// If updater.new.exe exists (downloaded), replace the old exe with the new one
if (fs.existsSync(updaterNewPath)) {
  console.log("Updater new exists on:", updaterNewPath);
  try {
    // Replace the old exe with the new one
    const oldExePath = path.join(baseDir, "updater.exe");
    const newExePath = path.join(baseDir, "updater.exe" + ".new");

    // If old exe exists, try to remove it first
    if (fs.existsSync(oldExePath)) {
      fs.unlinkSync(oldExePath);
    }

    fs.renameSync(newExePath, oldExePath);
    console.log("✓ updater.exe updated successfully!");
  } catch (renameErr) {
    console.error("✗ Failed to replace updater.exe:", renameErr.message);
  }
} else {
  console.log(
    "✗ new Updater does not exist on: (if there is no new updater, this is normal)",
    updaterNewPath
  );
}

// --- .env validation and cleaning ---
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, "utf8");
  let lines = envContent.split(/\r?\n/);
  let cleanedLines = [];
  let foundApiKey = false;
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue; // skip empty lines
    if (trimmed.startsWith("LASTFM_API_KEY=")) {
      let value = trimmed.split("=")[1] || "";
      value = value.trim();
      if (value) foundApiKey = true;
      cleanedLines.push("LASTFM_API_KEY=" + value);
    } else {
      cleanedLines.push(trimmed);
    }
  }
  fs.writeFileSync(envPath, cleanedLines.join("\n") + "\n", "utf8");
  if (!foundApiKey) {
    console.warn(
      "[.env] Warning: LASTFM_API_KEY is missing or empty after cleaning. The Last.fm API will not work."
    );
  }
}

function loadExcludedBots() {
  try {
    return JSON.parse(fs.readFileSync(BOTS_FILE, "utf8"));
  } catch {
    return [
      "streamelements",
      "nightbot",
      "moobot",
      "fossabot",
      "wizebot",
      "soundalerts",
      "stay_hydrated_bot",
    ];
  }
}

function saveExcludedBots(bots) {
  fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2));
}
// --- SETTINGS API ---
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    // Default settings
    return {
      bgColor: "#800080",
      fontSize: "16px",
      padding: "10px",
      fontFamily: "Arial, sans-serif",
      borderRight: true,
      fontColor: "#ffffff",
    };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function getCurrentVersion() {
  try {
    return fs.readFileSync(versionFile, "utf8").trim();
  } catch {
    return "";
  }
}

// GET all settings
app.get("/api/settings", (req, res) => {
  const settings = loadSettings();

  // Normalize subEffectTypes to an array
  if (!Array.isArray(settings.subEffectTypes)) {
    if (typeof settings.subEffectTypes === "string") {
      settings.subEffectTypes = [settings.subEffectTypes];
    } else {
      settings.subEffectTypes = [];
    }
  }

  res.json(settings);
});

app.get("/api/latestversion", (req, res) => {
  getLatestRelease((err, release) => {
    if (err) {
      console.error("Error fetching latest release:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ version: release.tag_name || release.name || "" });
  });
});

app.get("/api/currentversion", (req, res) => {
  var val = getCurrentVersion();
  res.json({ version: val });
});

app.get("/api/twitch", (req, res) => {
  if (!process.env.TWITCH_ACCESS_TOKEN) {
    console.error(
      "[Twitch API] TWITCH_ACCESS_TOKEN and/or CLIENT_ID is not set"
    );
    return res
      .status(500)
      .json({ error: "TWITCH_ACCESS_TOKEN and/or CLIENT_ID is not set" });
  }
  let val = process.env.TWITCH_ACCESS_TOKEN;
  res.json({
    auth: val,
    client: "pro83yr2qxpqs1qwy85uqkp17w5wpl",
  });
});

app.post("/api/bots", (req, res) => {
  const current = loadExcludedBots();
  const { action, username } = req.body;

  if (!username || !action) {
    return res
      .status(400)
      .json({ success: false, error: "Missing action or username" });
  }

  let updated = current;

  if (action === "add") {
    updated = Array.from(new Set([...current, username.toLowerCase()]));
  } else if (action === "remove") {
    updated = current.filter(
      (bot) => bot.toLowerCase() !== username.toLowerCase()
    );
  } else {
    return res.status(400).json({ success: false, error: "Invalid action" });
  }

  saveExcludedBots(updated);
  res.json({ success: true, bots: updated });
});

app.get("/api/bots", (req, res) => {
  const bots = loadExcludedBots();
  res.json(bots);
});

// POST update one or more settings (partial update)
app.post("/api/settings", (req, res) => {
  const current = loadSettings();
  const updated = { ...current, ...req.body };

  // Handle subEffectTypes explicitly
  if ("subEffectTypes" in req.body) {
    if (Array.isArray(req.body.subEffectTypes)) {
      updated.subEffectTypes = req.body.subEffectTypes.filter((type) =>
        availableSubEffects.includes(type)
      );
    } else if (typeof req.body.subEffectTypes === "string") {
      updated.subEffectTypes = availableSubEffects.includes(
        req.body.subEffectTypes
      )
        ? [req.body.subEffectTypes]
        : [];
    } else {
      updated.subEffectTypes = []; // If null/empty/missing, clear it
    }
  }

  saveSettings(updated);
  res.json({ success: true, settings: updated });
});

//POST refresh overlays from websocket
app.post("/api/refresh", (req, res) => {
  broadcast("refresh");
  res.send("Refresh triggered");
});

// Available sub-effect types for the multi-select
const availableSubEffects = [
  "hueShift",
  "magneticAttraction",
  "reverseGravity",
  "battleEvent",
];

app.get("/api/subeffecttypes", (req, res) => {
  res.json(availableSubEffects);
});

// --- LASTFM API ---
function parseLatestTrack(data) {
  const tracks = data?.recenttracks?.track || [];
  // Find the currently playing track
  const nowPlayingTrack = tracks.find(
    (t) => t["@attr"] && t["@attr"].nowplaying === "true"
  );
  if (!nowPlayingTrack || !nowPlayingTrack.name || !nowPlayingTrack.artist) {
    return null;
  }
  return {
    name: nowPlayingTrack.name,
    artist:
      nowPlayingTrack.artist["#text"] || nowPlayingTrack.artist.name || "",
  };
}

app.get("/api/lastfm/latest/:username", (req, res) => {
  const username = req.params?.username || "";
  if (!username) {
    console.error("[LastFM API] No username provided");
    return res.status(400).json({ error: "Username is required" });
  }
  if (!LASTFM_API_KEY) {
    console.error("[LastFM API] LASTFM_API_KEY is not set");
    return res.status(500).json({ error: "LASTFM_API_KEY is not set" });
  }
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;

  https
    .get(url, (response) => {
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          const track = parseLatestTrack(jsonData);
          if (!track) {
            console.warn(
              "[LastFM API] No recent tracks found for user:",
              username
            );
            return res.status(404).json({ error: "No recent tracks found" });
          }
          res.json({ track });
        } catch (error) {
          console.error("[LastFM API] Error parsing Last.fm response:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      });
    })
    .on("error", (err) => {
      console.error("[LastFM API] Error fetching from Last.fm:", err);
      res.status(500).json({ error: "Error fetching from Last.fm" });
    });
});

// Backend: receives token from frontend and saves it
app.post("/auth/twitch/callback", express.json(), (req, res) => {
  const { access_token } = req.body;

  if (!access_token) {
    return res
      .status(400)
      .json({ error: "Missing access_token in request body" });
  }

  // Save token into .env
  let envData = "";
  if (fs.existsSync(envPath)) {
    envData = fs.readFileSync(envPath, "utf8");
  }

  envData = envData.replace(/TWITCH_ACCESS_TOKEN=.*/g, "");
  envData += `\nTWITCH_ACCESS_TOKEN=${access_token}`;

  fs.writeFileSync(envPath, envData.trim() + "\n");

  reloadEnv();

  res.json({ success: true, message: "Token saved and loaded" });
});

// --- STATIC & SPA ROUTING ---
app.get(/^\/(?!api).*/, (req, res) => {
  if (!fs.existsSync(distRoot)) {
    if (process.pkg) {
      return res.status(503).json({
        error: "Application files not available in packaged version.",
        message:
          "The application is trying to download the latest release. Please try again in a moment.",
      });
    } else {
      return res.status(503).json({
        error: "Application files not available in development mode.",
        message: "Please run: npm run build",
      });
    }
  }
  res.sendFile(path.join(distRoot, "index.html"));
});

// Check if dist folder exists
if (!fs.existsSync(distRoot)) {
  if (process.pkg) {
    console.log("Dist folder not found in packaged application.");
    console.log("Please run updater.exe to download the latest files.");
    console.log("Or download the files manually from the GitHub release.");
  } else {
    console.log("Dist folder not found in development mode.");
    console.log("Please run: npm run build");
  }
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server + WS running on http://localhost:${PORT}`);
  broadcast("refresh");

  if (!process.env.TWITCH_ACCESS_TOKEN) {
    console.warn("[Twitch API] No TWITCH_ACCESS_TOKEN found in .env");
    GenerateAccess();
  } else {
    console.log("[Twitch API] Access token loaded.");
  }
});
