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

  const [color, setColor] = useState('linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)');

  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [fontColor, setFontColor] = useState('#ffffff');

  const [textStroke, setTextStroke] = useState(false);
  const [scaleSize, setScaleSize] = useState(1.0);
  const [maxWidth, setMaxWidth] = useState(700);
  const [padding, setPadding] = useState(10);

  const wrapperRef = useRef();       // .marqueeWrapper
  const trackRef = useRef();         // .marqueeTrack

  const displayText = latestTrack
    ? `${latestTrack.artist} - ${latestTrack.name}`
    : NOTHING;

  const [refreshToken,setRefreshToken] = useState(0);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:48000') //TODO: CHANGE THIS TO VARIABLE LATER AND STORE THAT IN SETTINGS ALSO

    ws.onmessage = (event) => {
      if (event.data === 'refresh') {
        setRefreshToken(c => c + 1);
        console.log('refreshing');
      }
    }
  }, []);

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
        if (data.textStroke || !data.textStroke) {setTextStroke(data.textStroke);}
        if (data.bgColor) setColor(data.bgColor);
        if (data.fontColor) setFontColor(data.fontColor);
        if (data.fontFamily) setFontFamily(data.fontFamily);
        if (data.scaleSize) setScaleSize(data.scaleSize);
        if (data.maxWidth) setMaxWidth(data.maxWidth);
        if (data.padding) setPadding(data.padding);
      })
      .catch(console.error);
  }, [refreshToken]);

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
  }, [refreshToken]);

  // 🎞️ Calculate if animation needed + set speed
  useEffect(() => {    
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    setShouldAnimate(false); //Reset animate just in case

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
  }, [displayText, refreshToken]);




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
    if (!textStroke || width <= 0) {
      return 'none'
    };
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
      <span className="songPanel"
      style={{
        bottom: position.y * -1,
        right: position.y * -1,
        background: color,
        color: fontColor,
        padding: padding,
        transform: `scale(${scaleSize})`,
        fontFamily: fontFamily,
        maxWidth: maxWidth
      }}>
        <div className="marqueeWrapper" ref={wrapperRef} key={displayText + refreshToken}>
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
