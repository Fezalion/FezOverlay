import { useState, useEffect } from 'react';
import { NowPlaying } from './NowPlaying'; // Adjust the import path as necessary

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

export function Settings() {
  const [color, setColor] = useState('#800080');
  const [fontSize, setFontSize] = useState(16);
  const [padding, setPadding] = useState(10);
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [borderRight, setBorderRight] = useState(true);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [gradientDirection, setGradientDirection] = useState('to left');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setColor(data.bgColor || '#800080');
        setFontSize(parseInt(data.fontSize) || 16);
        setPadding(parseInt(data.padding) || 10);
        setFontFamily(data.fontFamily || 'Arial, sans-serif');
        setBorderRight(data.borderRight !== undefined ? data.borderRight : true);
        setFontColor(data.fontColor || '#ffffff');
        setGradientDirection(data.gradientDirection || 'to left');

        document.documentElement.style.setProperty('--song-panel-bg', hexToRgb(data.bgColor || '#800080'));
        document.documentElement.style.setProperty('--song-panel-font-size', (parseInt(data.fontSize) || 16) + 'px');
        document.documentElement.style.setProperty('--song-panel-padding', (parseInt(data.padding) || 10) + 'px');
        document.documentElement.style.setProperty('--song-panel-font-family', data.fontFamily || 'Arial, sans-serif');
        document.documentElement.style.setProperty(
          '--song-panel-border-right',
          (data.borderRight !== undefined ? data.borderRight : true)
            ? '3px solid rgb(var(--song-panel-bg))'
            : 'none'
        );
        document.documentElement.style.setProperty('--song-panel-text-color', hexToRgb(data.fontColor || '#ffffff'));
        document.documentElement.style.setProperty('--song-panel-gradient-direction', data.gradientDirection || 'to left');
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

  const handleFontSize = (e) => {
    const val = parseInt(e.target.value) || 16;
    setFontSize(val);
    document.documentElement.style.setProperty('--song-panel-font-size', val + 'px');
    updateSetting('fontSize', val + 'px');
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

  const handleBorderRight = (e) => {
    setBorderRight(e.target.checked);
    document.documentElement.style.setProperty(
      '--song-panel-border-right',
      e.target.checked ? '3px solid rgb(var(--song-panel-bg))' : 'none'
    );
    updateSetting('borderRight', e.target.checked);
  };

  const handleFontColor = (e) => {
    setFontColor(e.target.value);
    document.documentElement.style.setProperty('--song-panel-text-color', hexToRgb(e.target.value));
    updateSetting('fontColor', e.target.value);
  };

  const handleGradientDirection = (e) => {
    setGradientDirection(e.target.value);
    document.documentElement.style.setProperty('--song-panel-gradient-direction', e.target.value);
    updateSetting('gradientDirection', e.target.value);
  };

  return (
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
      <h2 style={{marginBottom: 16, fontWeight: 700, fontSize: 28, letterSpacing: -1}}>Overlay Settings</h2>
      
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Background</span>
        <input type="color" value={color} onChange={handleChange} style={{width: 36, height: 36, border: 'none', background: 'none'}} />
      </label>
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Font Color</span>
        <input type="color" value={fontColor} onChange={handleFontColor} style={{width: 36, height: 36, border: 'none', background: 'none'}} />
      </label>
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Font Size</span>
        <input type="number" min="8" max="48" value={fontSize} onChange={handleFontSize} style={{width: 60}} /> px
      </label>
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Padding</span>
        <input type="number" min="0" max="50" value={padding} onChange={handlePadding} style={{width: 60}} /> px
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
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Gradient Direction</span>
        <select value={gradientDirection} onChange={handleGradientDirection} style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>
          <option value="to left">to Left</option>
          <option value="to right">to Right</option>
          <option value="to top">to Top</option>
          <option value="to bottom">to Bottom</option>
        </select>
      </label>
      <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{minWidth: 120}}>Show Border Right</span>
        <input type="checkbox" checked={borderRight} onChange={handleBorderRight} />
      </label>
      
      
      {/* NowPlaying Preview */}
      <h3 style={{margin: 0, marginBottom: 8}}>NowPlaying Preview</h3>
      <div style={{
        marginTop: 20,
        padding: 10,
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        color: fontColor,
        borderRight: borderRight ? '3px solid' : 'none',
        borderColor: color,
        background: `linear-gradient(${gradientDirection}, rgba(${bgColor}, 0.9), rgba(${bgColor}, 0))`
      }}>        
        {/* Simulate a track to display in the preview */}
        <span className={false ? 'animate' : ''}>
          Example Artist - Example Track
        </span>
      </div>
    </div>
  );
}
