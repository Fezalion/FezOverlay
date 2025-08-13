import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NowPlaying } from './components/NowPlaying'
import Settings  from './components/Settings'
import { EmoteOverlay } from './components/EmoteOverlay'
import { EmoteOverlayBucket } from './components/EmoteOverlayBucket'
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
    document.documentElement.style.setProperty('--song-panel-bg', data.bgColor || '#800080');
    document.documentElement.style.setProperty('--song-panel-max-width', data.maxWidth || '700px');
    document.documentElement.style.setProperty('--song-panel-scale-size', data.scaleSize || 1.0);
    document.documentElement.style.setProperty('--song-panel-padding', data.padding || '10px');

    document.documentElement.style.setProperty('--song-panel-font-family', data.fontFamily || 'Arial, sans-serif');    
    document.documentElement.style.setProperty('--song-panel-text-color', hexToRgb(data.fontColor || '#ffffff'));

    document.documentElement.style.setProperty('--song-panel-gradient-direction', data.gradientDirection || 'to left');

    document.documentElement.style.setProperty('--song-panel-text-stroke-width', data.textStroke ? data.textStrokeSize : '0px');
    document.documentElement.style.setProperty('--song-panel-text-stroke-color', data.textStroke ? data.textStrokeColor : 'rgba(0, 0, 0, 0)');

  });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/playing" element={<NowPlaying />} />
        <Route path="/emotes" element={<EmoteOverlay />} />
        <Route path="/emoteBucket" element={<EmoteOverlayBucket />} />
        <Route path="/" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)