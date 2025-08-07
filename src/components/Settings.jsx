import { useState, useEffect, useRef } from 'react';
import { NowPlaying } from './NowPlaying'; // Adjust the import path as necessary
import ColorPicker, { useColorPicker } from 'react-best-gradient-color-picker'

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

export function Settings() {
  const pickerRef = useRef(null);


  const [color, setColor] = useState('linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)');
  const { setSolid, setGradient } = useColorPicker(color, setColor);
  const [showPicker, setShowPicker] = useState(false);


  const [scaleSize, setScaleSize] = useState(1.0);
  const [maxWidth, setMaxWidth] = useState(700);
  const [padding, setPadding] = useState(10);
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [fontColor, setFontColor] = useState('#ffffff');
  const [playerLocationCoords, setPlayerLocationCoords] = useState({ x: 0, y: 0 });


  const [twitchName, setTwitchName] = useState('');
  const [lastfmName, setLastfmName] = useState('');
  const [emoteSetId, setEmoteSetId] = useState('');
  const [emoteLifetime, setEmoteLifetime] = useState(5000);
  const [emoteScale, setEmoteScale] = useState(1.0);


  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);


  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setColor(data.bgColor || '#800080');
        setScaleSize(parseInt(data.scaleSize) || 1.0);
        setMaxWidth(parseInt(data.maxWidth) || 700);
        setPadding(parseInt(data.padding) || 10);
        setFontFamily(data.fontFamily || 'Arial, sans-serif');
        setFontColor(data.fontColor || '#ffffff');
        setTwitchName(data.twitchName || '');
        setLastfmName(data.lastfmName || '');
        setEmoteSetId(data.emoteSetId || '');
        setEmoteLifetime(data.emoteLifetime || 5000);
        setEmoteScale(data.emoteScale || 1.0);
        setPlayerLocationCoords({
          x: data.playerLocationX || 0,
          y: data.playerLocationY || 0
        });

        document.documentElement.style.setProperty('--song-panel-bg', data.bgColor || '#800080');
        document.documentElement.style.setProperty('--song-panel-max-width', (parseInt(data.maxWidth) || 700) + 'px');
        document.documentElement.style.setProperty('--song-panel-scale-size', (parseInt(data.scaleSize) || 1.0));
        document.documentElement.style.setProperty('--song-panel-padding', (parseInt(data.padding) || 10) + 'px');
        document.documentElement.style.setProperty('--song-panel-font-family', data.fontFamily || 'Arial, sans-serif');        
        document.documentElement.style.setProperty('--song-panel-text-color', hexToRgb(data.fontColor || '#ffffff'));
      });
  }, []);

  const updateSetting = (key, value) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
  };

  const handleChange = (e) => {
    setColor(e.target.value);
    const rgb = hexToRgb(e.target.value);
    document.documentElement.style.setProperty('--song-panel-bg', rgb);
    updateSetting('bgColor', e.target.value);
  };

  const handleScaleSize = (e) => {
    const val = parseFloat(e.target.value) || 1.0;
    setScaleSize(val);
    document.documentElement.style.setProperty('--song-panel-scale-size', val);
    updateSetting('scaleSize', val);
  };

  const handleMaxWidth = (e) => {
    const val = parseInt(e.target.value) || 700;
    setMaxWidth(val);
    document.documentElement.style.setProperty('--song-panel-max-width', val + 'px');
    updateSetting('maxWidth', val + 'px');
  };

  const handlePadding = (e) => {
    const val = parseInt(e.target.value) || 10;
    setPadding(val);
    document.documentElement.style.setProperty('--song-panel-padding', val + 'px');
    updateSetting('padding', val + 'px');
  };

  const handleFontFamily = (e) => {
    setFontFamily(e.target.value);
    document.documentElement.style.setProperty('--song-panel-font-family', e.target.value);
    updateSetting('fontFamily', e.target.value);
  };

  const handleFontColor = (e) => {
    setFontColor(e.target.value);
    document.documentElement.style.setProperty('--song-panel-text-color', hexToRgb(e.target.value));
    updateSetting('fontColor', e.target.value);
  };

  const handleTwitchNameChange = (e) => {
    setTwitchName(e.target.value);
    updateSetting('twitchName', e.target.value);
  };

  const handleLastfmNameChange = (e) => {
    setLastfmName(e.target.value);
    updateSetting('lastfmName', e.target.value);
  };

  const handleEmoteSetIdChange = (e) => {
    setEmoteSetId(e.target.value);
    updateSetting('emoteSetId', e.target.value);
  };

  const handleEmoteLifetimeChange = (e) => {
    const val = parseInt(e.target.value) || 5000;
    setEmoteLifetime(val);
    updateSetting('emoteLifetime', val);
  };

  const handleEmoteScaleChange = (e) => {
    const val = parseFloat(e.target.value) || 1.0;
    setEmoteScale(val);
    updateSetting('emoteScale', val);
  };


  return (
    <div
    style={{
      maxWidth: 1200,
      margin: '40px auto',
      padding: 24,
      background: 'rgba(255,255,255,0.95)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      fontFamily: 'Inter, Arial, sans-serif',
      color: '#222',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }}
    >
      
    <h1 style={{marginBottom: 16, fontWeight: 700, fontSize: 28, letterSpacing: -1, textAlign: 'center'}}>Overlay Settings</h1>
    
    <div style={{      
      display: 'flex',
      flexDirection: 'row'
    }}
    >
    <div className="settings-container" style={{
      maxWidth: 400,
      margin: '40px auto',
      padding: 24,
      background: 'rgba(255,255,255,0.95)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      fontFamily: 'Inter, Arial, sans-serif',
      color: '#222',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }}>
      <h2 style={{marginBottom: 16, fontWeight: 700, fontSize: 28, letterSpacing: -1}}>Song Overlay Settings</h2>

       <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Lastfm Username</span>
        <input
          type="text"
          value={lastfmName}
          onChange={handleLastfmNameChange}
          placeholder="Enter your Lastfm username"
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>            
          </input>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 500 }}>Background Gradient</span>
        
        <button
          type="button"
          onClick={() => setShowPicker(prev => !prev)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #ccc',
            background: '#f5f5f5',
            cursor: 'pointer'
          }}
        >
          {showPicker ? 'Close' : 'Pick Background '}
        </button>

        {showPicker && (
          <div
            ref={pickerRef}
            className="gradient-picker-popup"
            style={{
              position: 'absolute',
              zIndex: 999,
              marginTop: 8,
              background: '#fff',
              padding: 12,
              borderRadius: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            <ColorPicker
              value={color}
              onChange={(newColor) => {
                setColor(newColor);
                document.documentElement.style.setProperty('--song-panel-bg', newColor);
                updateSetting('bgColor', newColor);
              }}
            />
          </div>
        )}
      </label>

      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Font Color</span>
        <input type="color" value={fontColor} onChange={handleFontColor} style={{width: 36, height: 36, border: 'none', background: 'none'}} />
      </label>
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Scale Size</span>
        <input
          type="number"
          min="0.1"
          max="5.0"
          step="0.1"
          value={scaleSize}
          onChange={handleScaleSize}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter player size scale (default 1.0)"
          ></input>
      </label>
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Padding</span>
        <input type="number" min="0" max="50" value={padding} onChange={handlePadding} style={{width: 60}} /> px
      </label>

      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Max Width</span>
        <input
          type="number"
          min="300"
          max="2000"
          value={maxWidth}
          onChange={handleMaxWidth}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter max width in px (default 700)"
          ></input>
      </label>

      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Font Family</span>
        <select value={fontFamily} onChange={handleFontFamily} style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Verdana, Geneva, sans-serif">Verdana</option>
          <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
          <option value="Courier New, Courier, monospace">Courier New</option>
          <option value="Times New Roman, Times, serif">Times New Roman</option>
        </select>
      </label> 

      {/* NowPlaying Preview */}
      <h3 style={{margin: 0, marginBottom: 8}}>NowPlaying Preview</h3>
      <div style={{
        marginTop: 20,
        padding: `${padding}px`,        
        fontFamily: fontFamily,
        color: `rgb(${hexToRgb(fontColor)})`,
        background: color,
      }}>        
        {/* Simulate a track to display in the preview */}
        <span>
          Example Artist - Example Track - 
        </span>
      </div>
    </div>

    <div className="settings-container" style={{
      maxWidth: 400,
      margin: '40px auto',
      padding: 24,
      background: 'rgba(255,255,255,0.95)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      fontFamily: 'Inter, Arial, sans-serif',
      color: '#222',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }}>
      <h2 style={{marginBottom: 16, fontWeight: 700, fontSize: 28, letterSpacing: -1}}>Emote Overlay Settings</h2>
      <p style={{marginBottom: 16, fontSize: 16, lineHeight: 1.5}}>
        The emote overlay displays 7TV emotes in real-time as they are used in chat.
        You can customize the appearance of the emotes and their behavior.</p>
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Twitch Username</span>
        <input
          type="text"
          value={twitchName}
          onChange={handleTwitchNameChange}
          placeholder="Enter your Twitch username"
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>            
          </input>
      </label>

      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>7tv Emote set ID</span>
        <input
          type="text"
          value={emoteSetId}
          onChange={handleEmoteSetIdChange}
          placeholder="Enter 7vtv emote set ID"
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>            
          </input>
      </label>

      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Emote Lifetime</span>        
        <input
          type="number"
          min="500"
          max="20000"
          value={emoteLifetime}
          onChange={handleEmoteLifetimeChange}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter emote lifetime in ms (default 5000)"
          ></input>
      </label>
      <span style={{color: "grey"}}>Duration for which emotes are displayed (in ms)[Limited to 500-20000ms]</span>


      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Emote Scale</span>
        <input
          type="number"
          min="0.1"
          max="5.0"
          step="0.1"
          value={emoteScale}
          onChange={handleEmoteScaleChange}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter emote scale (default 1.0)"
          ></input>
      </label>
      <span style={{flex: 1, color: "grey"}}>Scale of emotes when displayed (default 1.0)</span>


    </div>
    </div>
    </div>
  );
}
