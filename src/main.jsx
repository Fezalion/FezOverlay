import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NowPlaying } from './components/NowPlaying'
import { Settings } from './components/Settings'
import './index.css'

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

// Fetch all settings and apply CSS variables
fetch('/api/settings')
  .then(res => res.json())
  .then(data => {
    document.documentElement.style.setProperty('--song-panel-bg', hexToRgb(data.bgColor || '#800080'));
    document.documentElement.style.setProperty('--song-panel-font-size', data.fontSize || '16px');
    document.documentElement.style.setProperty('--song-panel-padding', data.padding || '10px');
    document.documentElement.style.setProperty('--song-panel-font-family', data.fontFamily || 'Arial, sans-serif');
    document.documentElement.style.setProperty(
      '--song-panel-border-right',
      data.borderRight !== undefined && data.borderRight
        ? '3px solid rgb(var(--song-panel-bg))'
        : 'none'
    );
    document.documentElement.style.setProperty('--song-panel-text-color', hexToRgb(data.fontColor || '#ffffff'));
  });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/playing" element={<NowPlaying />} />
        <Route path="/" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)