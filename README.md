# FezOverlay

A React-based overlay application for streaming with Last.fm integration and customizable settings.

## Features

- **Last.fm Integration**: Display currently playing tracks from Last.fm
- **Customizable UI**: Adjust background color, font size, padding, and more
- **Auto-Update System**: Automatically downloads and updates from the latest GitHub release
- **Standalone Executable**: Can be packaged as a standalone .exe file

## Auto-Download Functionality

When you run `FezOverlay.exe`, the application will:

1. **Check for dist folder**: If the `dist` folder doesn't exist, it will automatically download the latest release from GitHub
2. **Download zip file**: Downloads the `dist.zip` file from the latest release
3. **Manual extraction**: Copies the zip file to the dist folder for manual extraction
4. **Fallback handling**: If the download fails, the server will still start and provide helpful error messages
5. **Regular updates**: If the dist folder exists, it will check for updates and download if a newer version is available

**Note**: Auto-download functionality is only available when running the application in development mode (not packaged). Packaged executables include all necessary files and should be updated by downloading a new release from GitHub.

### Manual Extraction Required

After the zip file is downloaded, you'll need to extract it manually:
- **Windows**: Right-click the `dist.zip` file in the `dist` folder and select "Extract All"
- **Other systems**: Use any zip utility to extract the contents

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
