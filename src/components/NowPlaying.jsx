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

  const { settings, refreshSettings, updateSettings, setLocalSetting } = useMetadata();

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
  const movementTimeoutRef = useRef(null);
  const currentPositionRef = useRef({ x: 0, y: 0 });

  // Keep currentPositionRef in sync with actual coordinates
  useEffect(() => {
    currentPositionRef.current = {
      x: playerLocationCoords.x,
      y: playerLocationCoords.y
    };
  }, [playerLocationCoords]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const moveBy = e.shiftKey ? MOVE_AMOUNT * 5 : MOVE_AMOUNT;
      let moved = false;

      // Update current position ref based on key press
      switch (e.key) {
        case 'ArrowUp': 
          currentPositionRef.current.y -= moveBy;
          moved = true;
          break;
        case 'ArrowDown': 
          currentPositionRef.current.y += moveBy;
          moved = true;
          break;
        case 'ArrowLeft': 
          currentPositionRef.current.x -= moveBy;
          moved = true;
          break;
        case 'ArrowRight': 
          currentPositionRef.current.x += moveBy;
          moved = true;
          break;
        case ' ': 
          currentPositionRef.current = { x: 0, y: 0 };
          moved = true;
          break;
        default: return;
      }

      if (!moved) return;
      e.preventDefault();

      // Update local state immediately for visual feedback
      if (setLocalSetting) {
        setLocalSetting('playerLocationCoords', { 
          x: currentPositionRef.current.x, 
          y: currentPositionRef.current.y 
        });
      }

      // Clear existing timeout
      if (movementTimeoutRef.current) {
        clearTimeout(movementTimeoutRef.current);
      }

      // Set new timeout to apply the movement to API after a delay
      movementTimeoutRef.current = setTimeout(() => {
        updateSettings({
          playerLocationX: currentPositionRef.current.x,
          playerLocationY: currentPositionRef.current.y
        });
      }, 200); // Increased to 200ms to make it more obvious
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (movementTimeoutRef.current) {
        clearTimeout(movementTimeoutRef.current);
      }
    };
  }, [updateSettings, setLocalSetting]);

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