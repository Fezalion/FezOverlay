# FezOverlay

A React-based overlay application for streaming with Last.fm integration and customizable settings.

## Features

- **Last.fm Integration**: Display currently playing tracks from Last.fm
- **Customizable UI**: Adjust background color, scale, padding, and more
- **Auto-Update System**: Automatically downloads and updates from the latest GitHub release
- **Emote Overlay**: Show the emotes sent in chat in a fun way in your stream

## Demo

https://www.youtube.com/watch?v=nzPYJCWTqC8

## Usage

### Overlay Usage

1. **Running:**

   - Run `updater.exe` to update and install the files, after update is done launch `fezoverlay.exe`

2. **Twitch Auth:**

   - Click the link in the terminal window to authenticate with Twitch API.

3. **Environment Variables:**

   - Create or open the `.env` file in the root directory and add:

     ```
     LASTFM_API_KEY=your_lastfm_api_key_here
     ```

4. **Open the Settings Page:**

   - Go to [http://localhost:48000/](http://localhost:48000/) in your browser.
   - Here you can customize the overlay's color, font, padding, and more.

5. **Add the Overlays to OBS:**

   - In OBS, add a new **Browser Source**s for the widgets you want to use.
   - Set the URL for widgets and make the resolution same as your screen:  
      `http://localhost:48000/playing`
     `http://localhost:48000/emotes`
     `http://localhost:48000/chat`
     `http://localhost:48000/commands`
     `http://localhost:48000/yapmeter`
     `http://localhost:48000/deaths`
   - Set your LastFM user name in the settings page mentioned above.
   - Set your twitch username and 7tv emoteset IDs in the settings page mentioned above.

6. **Position the Overlay:**

   - You should have the overlays be the same size of your Scene, you can move the NowPlaying/chat widgets by either pressing interact in obs then using (Shift +) Arrow Keys, or the same in your browser.

7. **Edit Overlay Appearance:**
   - To change the overlay's appearance, open [http://localhost:48000/](http://localhost:48000/) in your browser again.
   - Adjust the settings as desired.

## FAQ

**I updated mid stream, do I need to do something?:**

- Yes, to have no issues, please refresh your obs browser sources.

## Update System

The application uses a separate updater tool for downloading and updating files:

### **How to Update**:

1. **Run updater.exe** in the same folder as fezoverlay.exe
2. **Wait for completion** - the updater will download and update both the executable and application files
3. **Run fezoverlay.exe** - the application will now use the updated files

### **Manual Update**:

If the updater doesn't work:

1. Download `dist.zip` from the latest GitHub release
2. Extract it to the same folder as fezoverlay.exe
3. Run fezoverlay.exe

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
