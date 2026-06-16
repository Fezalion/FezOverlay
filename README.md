# FezOverlay

A React-based overlay application for streaming fun features.

## Features

- **Music Overlay**: Play your own youtube playlists and get song requests from your twitch chat.
- **Customizable UI**: Adjust background color, scale, padding, and more
- **Auto-Update System**: Automatically downloads and updates from the latest GitHub release
- **Emote Overlay**: Show the emotes sent in chat in a fun way in your stream
- **Battle Overlay**: A battle mini-game
- **Chat Overlay**: Show your twitch chat in your stream with customizable events
- **Yap Meter**: Show how much you yap and get punished for it

## Usage

### Overlay Usage

1. **Running:**
   - Run `fezoverlay` shortcut in your desktop.

2. **Twitch Auth:**
   - Click the button up top in the main page to auth.

3. **Open the Settings Page:**
   - You can open the settings window by right clicking the tray icon.
   - Here you can customize the overlay's color, font, padding, and more.

4. **Add the Overlays to OBS:**
   - In OBS, add a new **Browser Source**s for the widgets you want to use.
   - Set the URL for widgets and make the resolution same as your screen:  
     `http://localhost:48000/playing`
     `http://localhost:48000/emotes`
     `http://localhost:48000/battle`
     `http://localhost:48000/chat`
     `http://localhost:48000/commands`
     `http://localhost:48000/yapmeter`
     `http://localhost:48000/deaths`
     `http://localhost:48000/fih`
   - Set your twitch username and 7tv emoteset IDs in the settings page mentioned above.

5. **Position the Overlay:**
   - You should have the overlays be the same size of your Scene, you can move the NowPlaying/chat widgets by either pressing interact in obs then using (Shift +) Arrow Keys, or the same in your browser.

## FAQ

**I updated mid stream, do I need to do something?:**

- Yes, to have no issues, please refresh your obs browser sources.
