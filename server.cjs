const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const https = require("https");
const http = require("http");
const dotenv = require("dotenv");
const fs = require("fs");
const { WebSocketServer } = require("ws");
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
const COMMANDS_FILE = path.join(baseDir, "customcommands.json");
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

  // --- Global error logging ---
  const ERROR_LOG_FILE = path.join(
    baseDir,
    `error-log-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
  );
  const errorLog = [];
  function logErrorToFile(err, info) {
    const entry = `[${new Date().toISOString()}] ${
      err && err.stack ? err.stack : err
    }\n${info ? "Info: " + info + "\n" : ""}`;
    errorLog.push(entry);
    try {
      fs.appendFileSync(ERROR_LOG_FILE, entry + "\n\n");
    } catch (e) {
      console.error("Failed to write to error log:", e);
    }
  }

  process.on("uncaughtException", (err) => {
    logErrorToFile(err, "uncaughtException");
    console.error("Uncaught Exception:", err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logErrorToFile(reason, "unhandledRejection");
    console.error("Unhandled Rejection:", reason);
    process.exit(1);
  });
  process.on("exit", (code) => {
    if (errorLog.length > 0) {
      try {
        fs.appendFileSync(ERROR_LOG_FILE, `Process exited with code ${code}\n`);
      } catch (e) {}
    }
  });

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

function loadCustomCommands() {
  try {
    return JSON.parse(fs.readFileSync(COMMANDS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveCustomCommands(cmds) {
  fs.writeFileSync(COMMANDS_FILE, JSON.stringify(cmds, null, 2));
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

// Endpoint to receive client/browser error logs
app.post("/api/log-client-error", (req, res) => {
  const { error, info, userAgent } = req.body || {};
  const entry = `[${new Date().toISOString()}] CLIENT ERROR\nUser-Agent: ${
    userAgent || req.headers["user-agent"] || ""
  }\n${error}\n${info ? "Info: " + info + "\n" : ""}`;
  try {
    fs.appendFileSync(ERROR_LOG_FILE, entry + "\n\n");
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.toString() });
  }
});

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

// Simple emote proxy & cache to avoid client-side CORS issues when fetching blobs
const EMOTE_CACHE_DIR = path.join(baseDir, "emote_cache");
if (!fs.existsSync(EMOTE_CACHE_DIR))
  fs.mkdirSync(EMOTE_CACHE_DIR, { recursive: true });

// Leaderboard storage (simple JSON file)
const LEADERBOARD_FILE = path.join(baseDir, "leaderboard.json");
function loadLeaderboard() {
  try {
    return JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf8"));
  } catch {
    return {}; // username -> wins
  }
}

function saveLeaderboard(data) {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Failed to save leaderboard:", e);
    return false;
  }
}

app.get("/api/emote-proxy", (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send("Missing url");

  let url;
  try {
    url = new URL(raw);
  } catch {
    return res.status(400).send("Invalid url");
  }

  // Create a safe filename based on a hash
  const safeName = Buffer.from(url.href).toString("base64").replace(/=+$/, "");
  const ext = path.extname(url.pathname) || ".img";
  const cachePath = path.join(EMOTE_CACHE_DIR, safeName + ext);

  // If cached, serve directly
  if (fs.existsSync(cachePath)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const stream = fs.createReadStream(cachePath);
    return stream.pipe(res);
  }

  // Otherwise fetch and cache
  const client = url.protocol === "https:" ? https : http;
  const reqOptions = {
    headers: {
      "User-Agent": "node-emote-proxy",
      Accept: "*/*",
    },
  };
  client
    .get(url.href, reqOptions, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        return res.status(502).send("Failed to proxy image");
      }
      const tmpPath = cachePath + ".tmp";
      const writeStream = fs.createWriteStream(tmpPath);
      proxyRes.pipe(writeStream);
      writeStream.on("finish", () => {
        try {
          fs.renameSync(tmpPath, cachePath);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cache-Control", "public, max-age=86400");
          const stream = fs.createReadStream(cachePath);
          stream.pipe(res);
        } catch (e) {
          console.error("Failed to finalize emote cache:", e);
          res.status(500).send("Proxy error");
        }
      });
    })
    .on("error", (err) => {
      console.error("Emote proxy fetch error:", err.message);
      res.status(502).send("Proxy fetch failed");
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

app.post("/api/commands", (req, res) => {
  const current = loadCustomCommands();
  const { action, name, text } = req.body;

  if (!name || !action || (action === "add" && !text)) {
    return res
      .status(400)
      .json({ success: false, error: "Missing action or name or text" });
  }

  let updated = current;

  if (action === "add") {
    // Remove any existing command with the same name (case-insensitive)
    updated = current.filter(
      (cmd) => cmd.name.toLowerCase() !== name.toLowerCase()
    );
    // Add the new command
    updated.push({ name, text });
  } else if (action === "remove") {
    updated = current.filter(
      (cmd) => cmd.name.toLowerCase() !== name.toLowerCase()
    );
  } else {
    return res.status(400).json({ success: false, error: "Invalid action" });
  }

  saveCustomCommands(updated);
  res.json({ success: true, commands: updated });
});

app.get("/api/commands", (req, res) => {
  const cmds = loadCustomCommands();
  res.json(cmds);
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

// Leaderboard endpoints
// GET /api/leaderboard?limit=5 -> returns array [{ username, wins }]
app.get("/api/leaderboard", (req, res) => {
  try {
    const limit = Math.max(1, parseInt(req.query.limit || "5", 10));
    const data = loadLeaderboard();
    const entries = Object.entries(data).map(([username, wins]) => ({
      username,
      wins: Number(wins) || 0,
    }));
    entries.sort(
      (a, b) => b.wins - a.wins || a.username.localeCompare(b.username)
    );
    res.json(entries.slice(0, limit));
  } catch (e) {
    console.error("Failed to read leaderboard:", e);
    res.status(500).json({ error: "Failed to read leaderboard" });
  }
});

// POST /api/leaderboard/win { username }
app.post("/api/leaderboard/win", (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Missing or invalid username" });
    }
    const key = username.trim().toLowerCase();
    if (!key) return res.status(400).json({ error: "Invalid username" });

    const data = loadLeaderboard();
    data[key] = (Number(data[key]) || 0) + 1;
    if (!saveLeaderboard(data)) {
      return res.status(500).json({ error: "Failed to save leaderboard" });
    }

    // Return updated wins for the user plus top 5
    const wins = Number(data[key]) || 0;
    const entries = Object.entries(data).map(([username, wins]) => ({
      username,
      wins: Number(wins) || 0,
    }));
    entries.sort(
      (a, b) => b.wins - a.wins || a.username.localeCompare(b.username)
    );
    const top = entries.slice(0, 5);
    res.json({ success: true, username: username.trim(), wins, top });
  } catch (e) {
    console.error("Failed to update leaderboard:", e);
    res.status(500).json({ error: "Failed to update leaderboard" });
  }
});

// POST /api/leaderboard/announce -> broadcast a WS message to show the leaderboard in overlays
// Implements a simple global cooldown equal to the requested duration (or default 10000ms)
let lastLeaderboardAnnounce = 0; // timestamp in ms
app.post("/api/leaderboard/announce", (req, res) => {
  try {
    const limit = Math.max(
      1,
      parseInt(req.body?.limit || req.query?.limit || "5", 10)
    );
    const duration = Number(req.body?.duration || req.query?.duration || 10000);

    const now = Date.now();
    const cooldownMs = Math.max(1000, Math.floor(duration));
    if (now - lastLeaderboardAnnounce < cooldownMs) {
      const retryAfter = Math.ceil(
        (cooldownMs - (now - lastLeaderboardAnnounce)) / 1000
      );
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Leaderboard announce is on cooldown",
        retryAfterSeconds: retryAfter,
      });
    }

    const data = loadLeaderboard();
    const entries = Object.entries(data).map(([username, wins]) => ({
      username,
      wins: Number(wins) || 0,
    }));
    entries.sort(
      (a, b) => b.wins - a.wins || a.username.localeCompare(b.username)
    );
    const top = entries.slice(0, limit);

    // Broadcast to all connected WS clients to display the leaderboard
    broadcast(
      JSON.stringify({
        type: "showLeaderboard",
        top,
        duration,
      })
    );

    lastLeaderboardAnnounce = now;

    res.json({ success: true, top });
  } catch (e) {
    console.error("Failed to announce leaderboard:", e);
    res.status(500).json({ error: "Failed to announce leaderboard" });
  }
});

//POST refresh overlays from websocket
app.post("/api/refresh", (req, res) => {
  broadcast(
    JSON.stringify({
      type: "refresh",
      target: req.body?.target || "all",
    })
  );
  res.send("Refresh triggered");
});

// Available sub-effect types for the multi-select
const availableSubEffects = [
  "hueShift",
  "magneticAttraction",
  "reverseGravity",
  "gravityEvent",
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

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  // send refresh on new connection
  broadcast(
    JSON.stringify({
      type: "refresh",
      target: "all",
    })
  );
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "spawnEmote") {
        broadcast(
          JSON.stringify({
            type: "spawnEmote",
            emote: data.emote,
            count: data.count || 1,
          })
        );
      } else if (data.type === "chatMessage") {
        broadcast(
          JSON.stringify({
            type: "chatMessage",
            message: data.message,
          })
        );
      } else {
        console.log("Unknown message type:", data);
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

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
