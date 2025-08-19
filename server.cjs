const { execFileSync } = require("child_process");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const https = require("https");
const http = require("http");
const dotenv = require("dotenv");
const fs = require("fs");
const { WebSocketServer } = require("ws");
dotenv.config();

const repo = "Fezalion/FezOverlay";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("An Overlay is connected.");
});

function broadcast(msg) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

const PORT = process.env.PORT || 48000;

// Fix for pkg: use process.execPath for base directory if packaged
let baseDir = __dirname;
if (process.pkg) {
  baseDir = path.dirname(process.execPath);
}

const distRoot = path.join(baseDir, "dist");
const SETTINGS_FILE = path.join(baseDir, "settings.json");
const versionFile = path.join(baseDir, "version.txt");

app.use(bodyParser.json());
app.use(express.static(distRoot));

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
const TWITCH_CLIENT = process.env.CLIENT_ID;

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
const envPath = path.join(baseDir, ".env");
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
  if (!TWITCH_CLIENT || !TWITCH_ACCESS_TOKEN) {
    console.error(
      "[Twitch API] TWITCH_ACCESS_TOKEN and/or CLIENT_ID is not set"
    );
    return res
      .status(500)
      .json({ error: "TWITCH_ACCESS_TOKEN and/or CLIENT_ID is not set" });
  }
  res.json({ auth: TWITCH_ACCESS_TOKEN, client: TWITCH_CLIENT });
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

if (!TWITCH_CLIENT || !TWITCH_ACCESS_TOKEN) {
  console.error(
    "[Twitch API] TWITCH_ACCESS_TOKEN and/or CLIENT_ID in .env file is not set, please generate them using https://twitchtokengenerator.com (safe to ignore if not using twitch emote features)"
  );
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server + WS running on http://localhost:${PORT}`);
  broadcast("refresh");
});
