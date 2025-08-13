import { useEffect, useState, useRef } from 'react';
import { useMetadata } from '../hooks/useMetadata';

const poll_rate = 1000;
const MOVE_AMOUNT = 1;
const SCROLL_SPEED = 25; // pixels per second
const space = '\u00A0\u00A0';
const NOTHING = 'Nothing is playing...';

export function NowPlaying() {
  const [latestTrack, setLatestTrack] = useState(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [scrollDuration, setScrollDuration] = useState(0);

  const { settings, refreshSettings, updateSetting } = useMetadata();

  const { bgColor, scaleSize, maxWidth, padding, fontFamily, fontColor, textStroke, textStrokeSize, textStrokeColor, lastfmName, playerLocationCoords, playerAlignment } = settings;
    
  const [refreshToken, setRefreshToken] = useState(0);
  const wsRef = useRef(null); 

  useEffect(() => { refreshSettings(); }, [refreshToken, refreshSettings]);

  useEffect(() => {
    const wsUrl = "ws://localhost:48000";

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data === "refresh") {
        setRefreshToken((c) => c + 1);
        console.log("refreshing");
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); 

  const wrapperRef = useRef();       // .marqueeWrapper
  const trackRef = useRef();         // .marqueeTrack

  const displayText = latestTrack
    ? `${latestTrack.artist} - ${latestTrack.name}`
    : NOTHING;  

  // 🧠 Poll current track
  useEffect(() => {
    const fetchLatestTrack = () => {
      fetch(`/api/lastfm/latest/${lastfmName}`)
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
  }, [lastfmName, displayText]);

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
  }, [displayText, lastfmName]);




  // 🎮 Move position with arrows / Shift modifier
  useEffect(() => {
    const handleKeyDown = (e) => {
      let x = playerLocationCoords.x;
      let y = playerLocationCoords.y;
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
      updateSetting('playerLocationX', x);
      updateSetting('playerLocationY', y);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playerLocationCoords, updateSetting]);  

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
        bottom: playerLocationCoords.y * -1,
        ...(playerAlignment === "left"
          ? { left: playerLocationCoords.x }
          : playerAlignment === "right"
          ? { right: playerLocationCoords.x * -1 }
          : {}),
        background: `${bgColor}`,
        color: `${fontColor}`,
        padding: padding,
        transform: `scale(${scaleSize})`,
        fontFamily: `${fontFamily}`,
        maxWidth: maxWidth,
        transformOrigin: `center ${playerAlignment}`,
      }}>
        <div className="marqueeWrapper" ref={wrapperRef} key={displayText + refreshToken}>
          <div
          className="marqueeTrack"
          ref={trackRef}
          style={{
            animationDuration: `${scrollDuration}s`,
            animationPlayState: shouldAnimate ? 'running' : 'paused',
            animationName: playerAlignment === 'left' ? 'scrollLeft' : 'scrollRight',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
          }}
        >
          {Array(2).fill(null).map((_, i) => {
            // Base list of spans for one copy
            const spans = [
              shouldAnimate && (
                <span
                  key={`anim-${i}`}
                  style={{ textShadow: getStrokeTextShadow(textStrokeSize, textStrokeColor) }}
                >
                  {space + displayText}
                </span>
              ),
              <span
                key={`static-${i}`}
                style={{ textShadow: getStrokeTextShadow(textStrokeSize, textStrokeColor) }}
              >
                {space + displayText}
              </span>,
            ].filter(Boolean); // remove false if shouldAnimate is false

            // Flip order if alignment is "Right"
            return playerAlignment === 'right' ? spans.reverse() : spans;
          })}
        </div>
        </div>
      </span>
    );
}
