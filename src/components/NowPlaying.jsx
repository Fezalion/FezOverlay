import { useEffect, useState, useRef } from 'react';

const poll_rate = 1000;
let LASTFM_USERNAME = 'your_lastfm_username';
const MOVE_AMOUNT = 1;
const SCROLL_SPEED = 25; // pixels per second
const space = '\u00A0\u00A0';
const NOTHING = 'Nothing is playing...';

export function NowPlaying() {
  const [latestTrack, setLatestTrack] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [scrollDuration, setScrollDuration] = useState(0);

  const [textStrokeSize, setTextStrokeSize] = useState(0);
  const [textStrokeColor, setTextStrokeColor] = useState('#000000');

  const wrapperRef = useRef();       // .marqueeWrapper
  const trackRef = useRef();         // .marqueeTrack

  const displayText = latestTrack
    ? `${latestTrack.artist} - ${latestTrack.name}`
    : NOTHING;

  // 🧠 Fetch Last.fm username & user settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.lastfmName?.length > 0) LASTFM_USERNAME = data.lastfmName;
        if (data.playerLocationX !== undefined && data.playerLocationY !== undefined) {
          setPosition({ x: data.playerLocationX, y: data.playerLocationY });
          updateCSSVars(data.playerLocationX, data.playerLocationY);
        }

        if (data.textStrokeSize !== undefined) setTextStrokeSize(parseInt(data.textStrokeSize));
        if (data.textStrokeColor) setTextStrokeColor(data.textStrokeColor);
      })
      .catch(console.error);
  }, []);

  // 🧠 Poll current track
  useEffect(() => {
    const fetchLatestTrack = () => {
      fetch(`/api/lastfm/latest/${LASTFM_USERNAME}`)
        .then(res => res.json())
        .then(response => {
          if (!response || response.error) {
            setLatestTrack(null);
            return;
          }
          setLatestTrack({
            name: response.track.name,
            artist: response.track.artist
          });
        })
        .catch(() => setLatestTrack(null));
    };

    fetchLatestTrack();
    const interval = setInterval(fetchLatestTrack, poll_rate);
    return () => clearInterval(interval);
  }, []);

  // 🎞️ Calculate if animation needed + set speed
  useEffect(() => {    
    const wrapper = wrapperRef.current;
    const track = trackRef.current;

    if (displayText == NOTHING) {
      setShouldAnimate(false);
      return;
    }
    if (!wrapper || !track) return;

    // Wait a tick for render to settle
    const timeout = setTimeout(() => {
      const wrapperWidth = wrapper.offsetWidth;
      const textWidth = track.scrollWidth;
      console.log('Calculating animation for:', displayText, 'Wrapper:', wrapperWidth, 'Text:', textWidth, 'Should animate:', textWidth > wrapperWidth);
      if (textWidth > wrapperWidth) {
        const duration = textWidth / SCROLL_SPEED;
        setShouldAnimate(true);
        setScrollDuration(duration);
      } else {
        setShouldAnimate(false);
      }
    }, 50); // 50ms is usually enough, tweak if needed

    return () => clearTimeout(timeout);
  }, [displayText]);




  // 🎮 Move position with arrows / Shift modifier
  useEffect(() => {
    const handleKeyDown = (e) => {
      let { x, y } = position;
      const moveBy = e.shiftKey ? MOVE_AMOUNT * 5 : MOVE_AMOUNT;

      switch (e.key) {
        case 'ArrowUp': y -= moveBy; break;
        case 'ArrowDown': y += moveBy; break;
        case 'ArrowLeft': x -= moveBy; break;
        case 'ArrowRight': x += moveBy; break;
        case ' ': x = 0; y = 0; break;
        default: return;
      }

      e.preventDefault();
      setPosition({ x, y });
      updateCSSVars(x, y);
      updateSetting('playerLocationX', x);
      updateSetting('playerLocationY', y);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position]);

  const updateCSSVars = (x, y) => {
    document.documentElement.style.setProperty('--overlay-x', `${x}px`);
    document.documentElement.style.setProperty('--overlay-y', `${y}px`);
  };

  const updateSetting = (key, value) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
  };  

  function getStrokeTextShadow(width, color) {
    if (width <= 0) return 'none';
    const shadows = [];

    for (let dx = -width; dx <= width; dx++) {
      for (let dy = -width; dy <= width; dy++) {
        if (dx === 0 && dy === 0) continue;
        shadows.push(`${dx}px ${dy}px 0 ${color}`);
      }
    }

    return shadows.join(', ');
  }

  return (
      <span className="songPanel">
        <div className="marqueeWrapper" ref={wrapperRef} key={displayText}>
          <div
            className={`marqueeTrack ${shouldAnimate ? 'animate' : ''}`}
            ref={trackRef}
            style={{
              animationDuration: `${scrollDuration}s`,
              animationPlayState: shouldAnimate ? 'running' : 'paused',              
            }}
          >
            
            <span style={{ textShadow: getStrokeTextShadow(textStrokeSize, textStrokeColor) }}>{space + displayText}</span>
            {shouldAnimate && <span style={{ textShadow: getStrokeTextShadow(textStrokeSize, textStrokeColor) }}>{space + displayText}</span>}
          </div>
        </div>
      </span>
    );
}
