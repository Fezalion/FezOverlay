# FezOverlay

A React-based overlay application for streaming with Last.fm integration and customizable settings.

## Features

- **Last.fm Integration**: Display currently playing tracks from Last.fm
- **Customizable UI**: Adjust background color, font size, padding, and more
- **Auto-Update System**: Automatically downloads and updates from the latest GitHub release
- **Standalone Executable**: Can be packaged as a standalone .exe file

## Update System

The application uses a separate updater tool for downloading and updating files:

### **updater.exe**
- **Standalone updater**: Runs independently from the main application
- **Downloads latest release**: Automatically fetches the latest version from GitHub
- **Updates executable**: Downloads and replaces fezoverlay.exe with the latest version
- **Extracts files**: Uses PowerShell to extract the zip file automatically
- **Version tracking**: Keeps track of the current version to avoid unnecessary downloads

### **How to Update**:
1. **Run updater.exe** in the same folder as fezoverlay.exe
2. **Wait for completion** - the updater will download and update both the executable and application files
3. **Run fezoverlay.exe** - the application will now use the updated files

### **Manual Update**:
If the updater doesn't work:
1. Download `dist.zip` from the latest GitHub release
2. Extract it to the same folder as fezoverlay.exe
3. Run fezoverlay.exe

**Note**: The main application (fezoverlay.exe) no longer handles updates internally. Use updater.exe for all update operations.

### Requirements for Auto-Download

- Internet connection to access GitHub releases
- The GitHub repository must have releases with a `dist.zip` asset
- The executable must have write permissions in its directory

### Error Handling

If the auto-download fails:
- The application will log detailed error messages
- The server will still start (if possible)
- API endpoints will return a 503 status with helpful error messages
- Users can manually download and extract the dist folder

### Usage

### Overlay Usage

1. **Open the Settings Page:**
   - Go to [http://localhost:48000/](http://localhost:48000/) in your browser.
   - Here you can customize the overlay's color, font, padding, and more (the UI is currently very barebones).

2. **Add the Overlays to OBS:**
   - In OBS, add a new **Browser Source**.
   - Set the URL to:
     
     `http://localhost:48000/playing`
   - Set your LastFM user name in the settings page mentioned above.

    `http://localhost:48000/emotes`
   - Set your twitch username and 7tv emoteset IDs in the settings page mentioned above.

3. **Position the Overlay:**
   - You should have both overlays be the same size of your Scene, you can move the NowPlaying widget by either pressing interact in obs then using (Shift +) Arrow Keys, or the same in your browser.

4. **Edit Overlay Appearance:**
   - To change the overlay's appearance, open [http://localhost:48000/](http://localhost:48000/) in your browser again.
   - Adjust the settings as desired.
   - After making changes, right-click the browser source in OBS and select **Refresh** to apply the new settings.

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see below)
4. Run development server: `npm run dev`

### Environment Variables

Create a `.env` file in the root directory:

```
LASTFM_API_KEY=your_lastfm_api_key_here
PORT=48000
```

### Building

- Development build: `npm run build`
- Package as executable: `npm run package` (requires pkg to be installed globally: `npm install -g pkg`)

## API Endpoints

- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update settings
- `GET /api/lastfm/latest/:username` - Get latest track for a Last.fm user

## License

[Add your license information here]
