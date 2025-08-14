import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useMetadata } from '../hooks/useMetadata';

// Constants
const POLL_RATE = 1000;
const MOVE_AMOUNT = 1;
const SPACE = '\u00A0\u00A0';
const NOTHING_PLAYING = 'Nothing is playing...';
const WS_URL = "ws://localhost:48000";
const MOVEMENT_DEBOUNCE_MS = 1000;
const OPACITY_TRANSITION_MS = 100;

// Custom hooks
const useWebSocket = (onRefresh) => {
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data === "refresh") {
        onRefresh();
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
      ws.current?.close();
    };
  }, [onRefresh]);

  return wsRef;
};

const useTrackPolling = (lastfmName) => {
  const [track, setTrack] = useState(null);

  useEffect(() => {
    if (!lastfmName) return;

    const fetchTrack = async () => {
      try {
        const response = await fetch(`/api/lastfm/latest/${lastfmName}`);
        const data = await response.json();
        
        if (!data || data.error) {
          setTrack(null);
          return;
        }

        setTrack({
          name: data.track.name,
          artist: data.track.artist
        });
      } catch (error) {
        console.error('Failed to fetch track:', error);
        setTrack(null);
      }
    };

    fetchTrack();
    const interval = setInterval(fetchTrack, POLL_RATE);
    
    return () => clearInterval(interval);
  }, [lastfmName]);

  return track;
};

const useScrollAnimation = (displayText, scrollSpeed, maxWidth, fontFamily, scaleSize, padding) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [scrollDuration, setScrollDuration] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  const wrapperRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    setIsVisible(false);
    setShouldAnimate(false);
    
    if (displayText === NOTHING_PLAYING) {
      setIsVisible(true);
      return;
    }

    const calculateAnimation = () => {
      const wrapper = wrapperRef.current;
      const track = trackRef.current;
      
      if (!wrapper || !track) {
        setIsVisible(true);
        return;
      }

      const wrapperWidth = wrapper.offsetWidth;
      const textWidth = track.scrollWidth;
      
      console.log('Calculating animation:', {
        text: displayText,
        wrapperWidth,
        textWidth,
        shouldAnimate: textWidth > wrapperWidth,
        scrollSpeed,
        maxWidth,
        fontFamily,
        scaleSize
      });
      
      if (textWidth > wrapperWidth && textWidth > 0) {
        const duration = textWidth / scrollSpeed;
        setScrollDuration(duration);
        setShouldAnimate(true);
      }
      
      setIsVisible(true);
    };

    // Use a small delay to ensure DOM has updated after settings change
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(calculateAnimation);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [displayText, scrollSpeed, maxWidth, fontFamily, scaleSize, padding]);

  return {
    shouldAnimate,
    scrollDuration,
    isVisible,
    wrapperRef,
    trackRef
  };
};

const useKeyboardMovement = (
  playerLocationCoords,
  setLocalSetting,
  updateSettings
) => {
  const movementTimeoutRef = useRef(null);
  const currentPositionRef = useRef({ x: 0, y: 0 });

  // Sync ref with props
  useEffect(() => {
    currentPositionRef.current = {
      x: playerLocationCoords.x,
      y: playerLocationCoords.y
    };
  }, [playerLocationCoords]);

  const handleMovement = useCallback((newPosition) => {
    currentPositionRef.current = newPosition;

    if (setLocalSetting) {
      setLocalSetting('playerLocationCoords', newPosition);
    }

    // Debounce server updates
    if (movementTimeoutRef.current) {
      clearTimeout(movementTimeoutRef.current);
    }

    movementTimeoutRef.current = setTimeout(() => {
      updateSettings({
        playerLocationX: newPosition.x,
        playerLocationY: newPosition.y
      });
    }, MOVEMENT_DEBOUNCE_MS);
  }, [setLocalSetting, updateSettings]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const moveBy = e.shiftKey ? MOVE_AMOUNT * 5 : MOVE_AMOUNT;
      let newPosition = { ...currentPositionRef.current };
      let moved = false;

      switch (e.key) {
        case 'ArrowUp':
          newPosition.y -= moveBy;
          moved = true;
          break;
        case 'ArrowDown':
          newPosition.y += moveBy;
          moved = true;
          break;
        case 'ArrowLeft':
          newPosition.x -= moveBy;
          moved = true;
          break;
        case 'ArrowRight':
          newPosition.x += moveBy;
          moved = true;
          break;
        case ' ':
          newPosition = { x: 0, y: 0 };
          moved = true;
          break;
        default:
          return;
      }

      if (moved) {
        e.preventDefault();
        handleMovement(newPosition);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (movementTimeoutRef.current) {
        clearTimeout(movementTimeoutRef.current);
      }
    };
  }, [handleMovement]);
};

// Utility functions
const createTextShadow = (isEnabled, width, color) => {
  if (!isEnabled || width <= 0) return 'none';
  
  const shadows = [];
  for (let dx = -width; dx <= width; dx++) {
    for (let dy = -width; dy <= width; dy++) {
      if (dx === 0 && dy === 0) continue;
      shadows.push(`${dx}px ${dy}px 0 ${color}`);
    }
  }
  
  return shadows.join(', ');
};

const getPositionStyles = (coords, alignment) => {
  const baseStyles = {
    bottom: coords.y * -1,
  };

  switch (alignment) {
    case 'left':
      return { ...baseStyles, left: coords.x };
    case 'right':
      return { ...baseStyles, right: coords.x * -1 };
    default:
      return baseStyles;
  }
};

// Main component
export function NowPlaying() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { settings, refreshSettings, updateSettings, setLocalSetting } = useMetadata();

  const {
    bgColor,
    scrollSpeed,
    scaleSize,
    maxWidth,
    padding,
    fontFamily,
    fontColor,
    textStroke,
    textStrokeSize,
    textStrokeColor,
    lastfmName,
    playerLocationCoords,
    playerAlignment
  } = settings;

  // Custom hooks
  const handleRefresh = useCallback(() => {
    setRefreshToken(prev => prev + 1);
  }, []);

  useWebSocket(handleRefresh);
  
  useEffect(() => {
    refreshSettings();
  }, [refreshToken, refreshSettings]);

  const latestTrack = useTrackPolling(lastfmName);
  
  const displayText = latestTrack
    ? `${latestTrack.artist} - ${latestTrack.name}`
    : NOTHING_PLAYING;

  // Force re-render when settings change that affect layout
  const layoutKey = useMemo(() => 
    `${maxWidth}-${fontFamily}-${scaleSize}-${padding}-${scrollSpeed}-${displayText}`,
    [maxWidth, fontFamily, scaleSize, padding, scrollSpeed, displayText]
  );

  const {
    shouldAnimate,
    scrollDuration,
    isVisible,
    wrapperRef,
    trackRef
  } = useScrollAnimation(displayText, scrollSpeed, maxWidth, fontFamily, scaleSize, padding);

  useKeyboardMovement(playerLocationCoords, setLocalSetting, updateSettings);

  // Memoized styles
  const containerStyles = useMemo(() => ({
    ...getPositionStyles(playerLocationCoords, playerAlignment),
    background: bgColor,
    color: fontColor,
    padding,
    transform: `scale(${scaleSize})`,
    fontFamily,
    maxWidth,
    transformOrigin: `center ${playerAlignment}`,
    opacity: isVisible ? 1 : 0,
    transition: `opacity ${OPACITY_TRANSITION_MS / 1000}s ease`
  }), [
    playerLocationCoords,
    playerAlignment,
    bgColor,
    fontColor,
    padding,
    scaleSize,
    fontFamily,
    maxWidth,
    isVisible
  ]);

  const animationStyles = useMemo(() => ({
    animationDuration: `${scrollDuration}s`,
    animationPlayState: shouldAnimate ? 'running' : 'paused',
    animationName: shouldAnimate ? 'scrollRight' : 'none',
    animationDirection: playerAlignment === 'left' ? 'reverse' : 'normal',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    animationFillMode: 'none'
  }), [scrollDuration, shouldAnimate, playerAlignment]);

  const textShadow = useMemo(() => 
    createTextShadow(textStroke, textStrokeSize, textStrokeColor),
    [textStroke, textStrokeSize, textStrokeColor]
  );

  const renderText = (text, withShadow = true) => (
    <span style={withShadow ? { textShadow } : undefined}>
      {SPACE + text}
    </span>
  );

  return (
    <span className="songPanel" style={containerStyles}>
      <div className="marqueeWrapper" ref={wrapperRef} key={layoutKey}>
        <div
          className="marqueeTrack"
          ref={trackRef}
          style={animationStyles}
        >
          {shouldAnimate ? (
            <>
              {renderText(displayText)}
              {renderText(displayText)}
            </>
          ) : (
            renderText(displayText)
          )}
        </div>
      </div>
    </span>
  );
}