import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useMetadata } from "../hooks/useMetadata";

const SPACE = "\u00A0\u00A0";
const NOTHING_PLAYING = "Nothing is playing...";
const WS_URL = "ws://localhost:48000";
const OPACITY_TRANSITION_MS = 300;

const GLOBAL_STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 24px; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
  #root { width: 100%; height: 100%; display: flex; align-items: stretch; }
`;

function useGlobalStyle() {
  useEffect(() => {
    const tag = document.createElement("style");
    tag.dataset.nowplaying = "1";
    tag.textContent = GLOBAL_STYLE;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);
}

// useNowPlaying: listens for nowPlaying track updates AND settings refresh
// events over the same WS connection. onRefresh is called when the server
// broadcasts a refresh so the component re-reads its settings immediately.
const useNowPlaying = (onRefresh) => {
  const [track, setTrack] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const applyTrack = useCallback((data) => {
    if (data && data.title && data.title.trim()) {
      setTrack({
        name: data.title.trim(),
        artist: data.channel ? data.channel.trim() : "",
        requestedBy: data.requestedBy || null,
      });
    } else {
      setTrack(null);
    }
  }, []);

  const fetchCurrent = useCallback(async () => {
    try {
      const res = await fetch("/api/music/nowplaying");
      if (!res.ok) return;
      const data = await res.json();
      applyTrack(data);
    } catch {}
  }, [applyTrack]);

  useEffect(() => {
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => fetchCurrent();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "nowPlaying") {
            applyTrack(msg.track);
          } else if (
            msg.type === "refresh" &&
            (msg.target === "all" || msg.target === "song")
          ) {
            onRefreshRef.current?.();
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        if (destroyed) return;
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [applyTrack, fetchCurrent]);

  return track;
};

const useOpacityAnimation = (displayText, shouldHide) => {
  const [opacity, setOpacity] = useState(1);
  const [currentText, setCurrentText] = useState(displayText);
  const previousTextRef = useRef(displayText);
  const previousHideRef = useRef(shouldHide);

  useEffect(() => {
    const textChanged = displayText !== previousTextRef.current;
    const hideStateChanged = shouldHide !== previousHideRef.current;

    if (textChanged || hideStateChanged) {
      setOpacity(0);
      const timeout = setTimeout(() => {
        setCurrentText(displayText);
        previousTextRef.current = displayText;
        previousHideRef.current = shouldHide;
        if (!shouldHide) setOpacity(1);
      }, OPACITY_TRANSITION_MS);
      return () => clearTimeout(timeout);
    } else if (currentText !== displayText) {
      setCurrentText(displayText);
      previousTextRef.current = displayText;
      previousHideRef.current = shouldHide;
    }
  }, [displayText, currentText, shouldHide]);

  return { opacity, currentText };
};

const useScrollAnimation = (
  displayText,
  scrollSpeed,
  fontFamily,
  scaleSize,
) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [scrollDuration, setScrollDuration] = useState(0);
  const wrapperRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    setShouldAnimate(false);
    if (displayText === NOTHING_PLAYING) return;

    const calculateAnimation = () => {
      const wrapper = wrapperRef.current;
      const track = trackRef.current;
      if (!wrapper || !track) return;
      const wrapperWidth = wrapper.offsetWidth;
      const textWidth = track.scrollWidth;
      if (textWidth > wrapperWidth && textWidth > 0) {
        setScrollDuration(textWidth / scrollSpeed);
        setShouldAnimate(true);
      }
    };

    const timeoutId = setTimeout(
      () => requestAnimationFrame(calculateAnimation),
      50,
    );
    return () => clearTimeout(timeoutId);
  }, [displayText, scrollSpeed, fontFamily, scaleSize]);

  return { shouldAnimate, scrollDuration, wrapperRef, trackRef };
};

const createTextShadow = (isEnabled, width, color) => {
  if (!isEnabled || width <= 0) return "none";
  const shadows = [];
  for (let dx = -width; dx <= width; dx++) {
    for (let dy = -width; dy <= width; dy++) {
      if (dx === 0 && dy === 0) continue;
      shadows.push(`${dx}px ${dy}px 0 ${color}`);
    }
  }
  return shadows.join(", ");
};

export function NowPlaying() {
  useGlobalStyle();

  const { settings, refreshSettings } = useMetadata();

  const handleRefresh = useCallback(() => {
    refreshSettings();
  }, [refreshSettings]);

  const latestTrack = useNowPlaying(handleRefresh);

  const {
    bgColor,
    scrollSpeed,
    scaleSize,
    fontFamily,
    fontColor,
    textStroke,
    textStrokeSize,
    textStrokeColor,
    playerAlignment,
    hideOnNothing,
  } = settings;

  const displayText = latestTrack
    ? latestTrack.artist
      ? `${latestTrack.artist} - ${latestTrack.name}`
      : latestTrack.name
    : NOTHING_PLAYING;

  const shouldHide = hideOnNothing && !latestTrack;

  const { opacity, currentText } = useOpacityAnimation(displayText, shouldHide);

  const layoutKey = useMemo(
    () => `${fontFamily}-${scaleSize}-${scrollSpeed}-${currentText}`,
    [fontFamily, scaleSize, scrollSpeed, currentText],
  );

  const { shouldAnimate, scrollDuration, wrapperRef, trackRef } =
    useScrollAnimation(currentText, scrollSpeed, fontFamily, scaleSize);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const containerStyles = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      background: "transparent",
      overflow: "hidden",
    }),
    [],
  );

  const barStyles = useMemo(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      background: bgColor,
      color: fontColor,
      fontFamily,
      overflow: "hidden",
      transition: `opacity ${OPACITY_TRANSITION_MS / 1000}s ease`,
      opacity: shouldHide ? 0 : opacity,
    }),
    [bgColor, fontColor, fontFamily, opacity, shouldHide],
  );

  const animationStyles = useMemo(
    () => ({
      animationDuration: `${scrollDuration}s`,
      animationPlayState: shouldAnimate ? "running" : "paused",
      animationName: shouldAnimate ? "scrollRight" : "none",
      animationDirection: playerAlignment === "left" ? "reverse" : "normal",
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
      animationFillMode: "none",
      whiteSpace: "nowrap",
      display: "inline-block",
      fontSize: `${scaleSize}rem`,
    }),
    [scrollDuration, shouldAnimate, playerAlignment, scaleSize],
  );

  const textShadow = useMemo(
    () => createTextShadow(textStroke, textStrokeSize, textStrokeColor),
    [textStroke, textStrokeSize, textStrokeColor],
  );

  const renderText = (text, withShadow = true) => (
    <span style={withShadow ? { textShadow } : undefined}>{SPACE + text}</span>
  );

  return (
    <div className="songPanel" style={containerStyles}>
      <div style={barStyles}>
        <div
          className="marqueeWrapper"
          ref={wrapperRef}
          key={layoutKey}
          style={{
            overflow: "hidden",
            width: "100%",
            textAlign: shouldAnimate ? "initial" : playerAlignment,
          }}
        >
          <div
            className="marqueeTrack"
            ref={trackRef}
            style={{
              ...animationStyles,
              display: shouldAnimate ? "inline-block" : "block",
            }}
          >
            {shouldAnimate ? (
              <>
                {renderText(currentText)}
                {renderText(currentText)}
              </>
            ) : (
              renderText(currentText)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
