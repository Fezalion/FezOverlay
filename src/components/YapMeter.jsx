import { useEffect, useState, useRef } from "react";
import OBSWebSocket, { EventSubscription } from "obs-websocket-js";

// thresholds
const SPEAK_THRESHOLD = 0.2; // normalized 0..1
const SILENCE_RESET_MS = 3000;
const MAX_YAP = 40;

function useYapEvents(percent, events = []) {
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
}

function FloatingPercent({ percent, getColor }) {
  const labelRef = useRef(null);

  useEffect(() => {
    let animFrame;
    const animate = () => {
      if (labelRef.current) {
        const baseScale = 0.8 + 0.7 * percent;
        let rotation = 0;
        let wiggleScale = 1;
        let shakeX = 0;
        let shakeY = 0;

        if (percent > 0.25) {
          const wiggleFactor = (percent - 0.25) * 2;
          rotation = Math.sin(Date.now() / 80) * 10 * wiggleFactor;
          wiggleScale = 1 + 0.3 * wiggleFactor;
          shakeX = Math.sin(Date.now() / 30) * 4 * wiggleFactor;
          shakeY = -1 * Math.sin(Date.now() / 30) * 4 * wiggleFactor;
        }
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
        right: "-35px",
        bottom: `calc(${percent * 100}% - 285px)`,
        fontSize: "16px",
        fontWeight: "bold",
        whiteSpace: "nowrap",
        textAlign: "left",
        color: getColor(percent),
        textShadow: `0 0 ${percent > 0.25 ? 4 : 0}px #fff, 
                     0 0 ${percent > 0.5 ? 6 : 0}px #fff, 
                     0 0 ${percent > 0.75 ? 8 : 0}px #fff`,
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

  const obsRef = useRef(null);
  const speakingRef = useRef(false);
  const lastSpeakingTimeRef = useRef(Date.now());
  const continuousStartTimeRef = useRef(0);
  const micSourceNameRef = useRef(null);

  // Connect to OBS
  useEffect(() => {
    const obs = new OBSWebSocket();

    const debug = async (text) => {
      await obs.call("SetInputSettings", {
        inputName: "DebugText",
        inputSettings: { text: text },
      });
    };
    obsRef.current = obs;

    async function connect() {
      try {
        await obs.connect("ws://127.0.0.1:4455", undefined, {
          eventSubscriptions:
            EventSubscription.All | EventSubscription.InputVolumeMeters,
          rpcVersion: 1,
        });
        console.log("✅ Connected to OBS");
        debug("✅ Connected to OBS");
        // detect mic input
        const sources = await obs.call("GetInputList");
        const micInput = sources.inputs.find((i) =>
          [
            "wasapi_input_capture",
            "dshow_input",
            "coreaudio_input_capture",
            "pulse_input_capture",
            "alsa_input_capture",
          ].includes(i.inputKind)
        );
        if (!micInput) {
          console.error("❌ No mic input found!");
          debug("❌ No mic input found!");
          return;
        }
        micSourceNameRef.current = micInput.inputName;
        console.log("🎤 Using mic:", micSourceNameRef.current);
        debug("🎤 Using mic:" + micSourceNameRef.current);

        obs.on("InputVolumeMeters", (data) => {
          const mic = data.inputs.find(
            (i) => i.inputName === micSourceNameRef.current
          );
          if (!mic) return;

          const levels =
            mic.inputLevelsMul || mic.inputLevels || mic.levels || mic.meters;
          if (!levels?.length) return;

          const normalized = levels[0][0] * 1000; // 0..1
          const now = Date.now();

          let speaking = speakingRef.current;
          let lastSpeaking = lastSpeakingTimeRef.current;
          let continuousStart = continuousStartTimeRef.current;
          let yapScore = 0;
          if (normalized > SPEAK_THRESHOLD) {
            if (!speaking) {
              speaking = true;
              continuousStart = now;
            }
            lastSpeaking = now;
            yapScore = (now - continuousStart) / 1000;
          } else {
            if (speaking && now - lastSpeaking > SILENCE_RESET_MS) {
              speaking = false;
              continuousStart = 0;
              yapScore = 0;
            } else if (speaking) {
              yapScore = (lastSpeaking - continuousStart) / 1000;
            }
          }

          // update refs
          speakingRef.current = speaking;
          lastSpeakingTimeRef.current = lastSpeaking;
          continuousStartTimeRef.current = continuousStart;

          setScore(yapScore);
          debug("score" + yapScore);
        });
      } catch (err) {
        console.error("OBS connection failed:", err);
        debug("OBS connection failed:");
      }
    }

    connect();
    return () => {
      obs.disconnect();
    };
  }, []);

  // smoothing
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayScore((prev) => prev + (score - prev) * 0.1);
      setTrailScore((prev) => prev + (displayScore - prev) * 0.03);
    }, 50);
    return () => clearInterval(interval);
  }, [score, displayScore]);

  const percent = Math.min(displayScore / MAX_YAP, 1);
  const trailPercent = Math.min(trailScore / MAX_YAP, 1);

  const thresholds = [0.25, 0.5, 0.75, 1.0];
  useYapEvents(
    percent,
    thresholds.map((t) => ({
      threshold: t,
      onEnter: () => console.log(`${(t * 100).toFixed(0)}% ↑`),
      onExit: () => console.log(`${(t * 100).toFixed(0)}% ↓`),
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
      {/* Label */}
      <div
        style={{
          position: "absolute",
          bottom: "0",
          left: "12px",
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

      {/* floating percent */}
      <FloatingPercent percent={percent} getColor={getColor} />

      {/* bar */}
      <div
        style={{
          height: "100%",
          width: "100%",
          border: "2px solid #333",
          borderRadius: "10px",
          overflow: "hidden",
          position: "relative",
        }}
      >
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
          />
        ))}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            height: `${trailPercent * 100}%`,
            width: "100%",
            background: getColor(trailPercent),
            opacity: 0.4,
            filter: "blur(4px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            height: `${percent * 100}%`,
            width: "100%",
            background: getColor(percent),
          }}
        />
      </div>
    </div>
  );
}
