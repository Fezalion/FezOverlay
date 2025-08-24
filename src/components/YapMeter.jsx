import { useEffect, useState, useCallback, useRef } from "react";
import { useMetadata } from "../hooks/useMetadata";

const WS_URL = "ws://localhost:48000";

const useWebSocket = (onRefresh) => {
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data === "refresh") onRefresh();
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("WebSocket closed");

    return () => ws.close();
  }, [onRefresh]);

  return wsRef;
};

// Hook for ascending/descending events
const useYapEvents = (percent, events = []) => {
  const triggeredRef = useRef({});
  useEffect(() => {
    events.forEach((event) => {
      const { threshold, onEnter, onExit } = event;
      const triggered = triggeredRef.current[threshold] || {
        up: false,
        down: false,
      };

      if (percent >= threshold && !triggered.up) {
        onEnter?.();
        triggered.up = true;
      }
      if (percent < threshold) triggered.up = false;

      if (percent <= threshold && !triggered.down) {
        onExit?.();
        triggered.down = true;
      }
      if (percent > threshold) triggered.down = false;

      triggeredRef.current[threshold] = triggered;
    });
  }, [percent, events]);
};

function FloatingPercent({ percent, getColor }) {
  const labelRef = useRef(null);

  useEffect(() => {
    let animFrame;

    const animate = () => {
      if (labelRef.current) {
        // Base scale grows with percent
        const baseScale = 0.8 + 0.7 * percent;

        let rotation = 0;
        let wiggleScale = 1;
        let shakeX = 0;
        let shakeY = 0;

        if (percent > 0.25) {
          // Continuous wiggle
          const wiggleFactor = (percent - 0.25) * 2; // 0 → 1
          rotation = Math.sin(Date.now() / 80) * 10 * wiggleFactor; // wiggle ±10°
          wiggleScale = 1 + 0.3 * wiggleFactor; // small extra scale
          shakeX = Math.sin(Date.now() / 30) * 4 * wiggleFactor; // rapid ±2px shake
          shakeY = -1 * Math.sin(Date.now() / 30) * 4 * wiggleFactor; // rapid ±2px shake
        }

        // Final scale = base scale * wiggle multiplier
        const finalScale = baseScale * wiggleScale;

        labelRef.current.style.transform = `translateX(${shakeX}px) translateY(${shakeY}px) scale(${finalScale}) rotate(${rotation}deg)`;
      }

      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [percent]);

  return (
    <div
      ref={labelRef}
      style={{
        position: "relative",
        right: "-35px", // outside the bar
        bottom: `calc(${percent * 100}% - 285px)`, // move with percent
        fontSize: "16px",
        fontWeight: "bold",
        whiteSpace: "nowrap",
        textAlign: "left",
        color: getColor(percent),
        textShadow: `0 0 ${percent > 0.25 ? 4 : 0}px #fff, 0 0 ${
          percent > 0.5 ? 6 : 0
        }px #fff, 0 0 ${percent > 0.75 ? 8 : 0}px #fff`,
        transition: "bottom 0.05s linear, color 0.1s, text-shadow 0.1s",
        transformOrigin: "center left",
        display: "inline-block",
      }}
    >
      {(percent * 100).toFixed(0)}%
    </div>
  );
}

export default function YapMeter() {
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [trailScore, setTrailScore] = useState(0);
  const { refreshSettings } = useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);
  const testMode = false;

  // Test mode increment
  useEffect(() => {
    if (!testMode) return;

    const interval = setInterval(() => {
      setScore((prev) => (prev <= 120 ? prev + 1 : 0));
    }, 500);

    return () => clearInterval(interval);
  }, [testMode]);

  const handleRefresh = useCallback(
    () => setRefreshToken((prev) => prev + 1),
    []
  );
  useWebSocket(handleRefresh);

  useEffect(() => refreshSettings(), [refreshToken, refreshSettings]);

  useEffect(() => {
    if (testMode) return;
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (msg) => setScore(parseFloat(JSON.parse(msg.data).yapScore));
    return () => ws.close();
  }, [testMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayScore((prev) => prev + (score - prev) * 0.1);
      setTrailScore((prev) => prev + (displayScore - prev) * 0.03);
    }, 50);
    return () => clearInterval(interval);
  }, [score, displayScore]);

  const MAX_YAP = 40;
  const percent = Math.min(displayScore / MAX_YAP, 1);
  const trailPercent = Math.min(trailScore / MAX_YAP, 1);

  const thresholds = [0.25, 0.5, 0.75, 1.0];

  useYapEvents(
    percent,
    thresholds.map((t) => ({
      threshold: t,
      onEnter: () => console.log(`${(t * 100).toFixed(0)}% reached ↑`),
      onExit: () => console.log(`${(t * 100).toFixed(0)}% dropped ↓`),
    }))
  );

  const getColor = (p) => (p < 0.5 ? "#0f0" : p < 0.8 ? "#ff0" : "#f00");

  return (
    <div
      style={{
        height: "300px",
        width: "50px",
        padding: "10px",
        position: "absolute",
        bottom: "50px",
        left: "50px",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: "0", // adjust vertical alignment
          left: "12px", // move left outside the bar
          fontSize: "24px",
          fontWeight: "bold",
          color: "#fff",
          transform: "rotate(-90deg) translateX(25%)",
          transformOrigin: "left bottom",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        Y A P M E T E R
      </div>
      <FloatingPercent
        percent={percent}
        thresholds={thresholds}
        getColor={getColor}
      />

      <div
        style={{
          height: "100%",
          width: "100%",
          border: "2px solid #333",
          borderRadius: "10px",
          overflow: "hidden",
          backgroundColor: "transparent",
          position: "relative",
        }}
      >
        {/* Threshold markers */}
        {thresholds.map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              bottom: `${t * 100}%`,
              width: "100%",
              height: "2px",
              background: percent >= t ? "#fff" : "#666",
              transition: "background 0.2s",
            }}
          ></div>
        ))}

        {/* Trail glow */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            height: `${trailPercent * 100}%`,
            width: "100%",
            background: getColor(trailPercent),
            opacity: 0.4,
            filter: "blur(4px)",
            transition: "height 0.05s linear, background 0.1s linear",
          }}
        ></div>

        {/* Main meter */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            height: `${percent * 100}%`,
            width: "100%",
            background: getColor(percent),
            transition: "height 0.05s linear, background 0.1s linear",
          }}
        ></div>
      </div>
    </div>
  );
}
