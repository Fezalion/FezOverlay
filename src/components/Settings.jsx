import { useState, useEffect } from 'react';

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

  // Fetch all settings from API on mount
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
        document.documentElement.style.setProperty('--song-panel-text-color', data.fontColor || '#ffffff');
      });
  }, []);

  // Helper to update settings on server and CSS variable
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
    document.documentElement.style.setProperty('--song-panel-text-color', e.target.value);
    updateSetting('fontColor', e.target.value);
  };

  return (
    <div>
      <h2>Settings</h2>
      <label>
        Song Panel Background:
        <input type="color" value={color} onChange={handleChange} />
      </label>
      <br />
      <label>
        Font Size:
        <input type="number" min="8" max="48" value={fontSize} onChange={handleFontSize} /> px
      </label>
      <br />
      <label>
        Padding:
        <input type="number" min="0" max="50" value={padding} onChange={handlePadding} /> px
      </label>
      <br />
      <label>
        Font Family:
        <select value={fontFamily} onChange={handleFontFamily}>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Verdana, Geneva, sans-serif">Verdana</option>
          <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
          <option value="Courier New, Courier, monospace">Courier New</option>
          <option value="Times New Roman, Times, serif">Times New Roman</option>
        </select>
      </label>
      <br />
      <label>
        Show Border Right:
        <input type="checkbox" checked={borderRight} onChange={handleBorderRight} />
      </label>
      <div>
        <label htmlFor="fontColor">Font Color: </label>
        <input
          id="fontColor"
          type="color"
          value={fontColor}
          onChange={handleFontColor}
        />
      </div>
    </div>
  );
}