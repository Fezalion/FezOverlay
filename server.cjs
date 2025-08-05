const { execFileSync } = require('child_process');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const app = express();

const PORT = process.env.PORT || 48000;

// Fix for pkg: use process.execPath for base directory if packaged
let baseDir = __dirname;
if (process.pkg) {
  baseDir = path.dirname(process.execPath);
}

const distRoot = path.join(baseDir, 'dist');
const SETTINGS_FILE = path.join(baseDir, 'settings.json');

app.use(bodyParser.json());
app.use(express.static(distRoot));

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

// --- SETTINGS API ---
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    // Default settings
    return {
      bgColor: '#800080',
      fontSize: '16px',
      padding: '10px',
      fontFamily: 'Arial, sans-serif',
      borderRight: true
    };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET all settings
app.get('/api/settings', (req, res) => {
  res.json(loadSettings());
});

// POST update one or more settings (partial update)
app.post('/api/settings', (req, res) => {
  const current = loadSettings();
  const updated = { ...current, ...req.body };
  saveSettings(updated);
  res.json({ success: true, settings: updated });
});

// --- LASTFM API ---
function parseLatestTrack(data) {
  const tracks = data?.recenttracks?.track || [];
  // Find the currently playing track
  const nowPlayingTrack = tracks.find(
    t => t['@attr'] && t['@attr'].nowplaying === 'true'
  );
  if (!nowPlayingTrack || !nowPlayingTrack.name || !nowPlayingTrack.artist) {
    return null;
  }
  return {
    name: nowPlayingTrack.name,
    artist: nowPlayingTrack.artist['#text'] || nowPlayingTrack.artist.name || ''
  };
}

app.get('/api/lastfm/latest/:username', (req, res) => {
  const username = req.params?.username || '';
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  if (!LASTFM_API_KEY) {
    return res.status(500).json({ error: 'LASTFM_API_KEY is not set' });
  }
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;

  https.get(url, (response) => {
    let data = '';
    response.on('data', chunk => {
      data += chunk;
    });
    response.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        const track = parseLatestTrack(jsonData);
        if (!track) {
          return res.status(404).json({ error: 'No recent tracks found' });
        }
        res.json({ track });
      } catch (error) {
        console.error('Error parsing Last.fm response:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }).on('error', (err) => {
    console.error('Error fetching from Last.fm:', err);
    res.status(500).json({ error: 'Error fetching from Last.fm' });
  });
});

// --- STATIC & SPA ROUTING ---
app.get(/^\/(?!api).*/, (req, res) => {
  if (!fs.existsSync(distRoot)) {
    if (process.pkg) {
      return res.status(503).json({ 
        error: 'Application files not available in packaged version.',
        message: 'The application is trying to download the latest release. Please try again in a moment.'
      });
    } else {
      return res.status(503).json({ 
        error: 'Application files not available in development mode.',
        message: 'Please run: npm run build'
      });
    }
  }
  res.sendFile(path.join(distRoot, 'index.html'));
});

// Check if dist folder exists
if (!fs.existsSync(distRoot)) {
  if (process.pkg) {
    console.log('Dist folder not found in packaged application.');
    console.log('Please run updater.exe to download the latest files.');
    console.log('Or download the files manually from the GitHub release.');
  } else {
    console.log('Dist folder not found in development mode.');
    console.log('Please run: npm run build');
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});