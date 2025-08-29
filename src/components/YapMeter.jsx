// YapMeter.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMetadata } from "../hooks/useMetadata";
import OBSWebSocket, { EventSubscription } from "obs-websocket-js";
import { useTwitchClient } from "../hooks/useTwitchClient";

export default function YapMeter() {
  const { settings, refreshSettings } = useMetadata();
  const [refreshToken, setRefreshToken] = useState(0);
  const clientRef = useTwitchClient(settings.twitchName);
  const wsRef = useRef(null);

  useEffect(() => {
    refreshSettings();
  }, [refreshToken, refreshSettings]);

  useEffect(() => {
    const wsUrl = "ws://localhost:48000";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const eventData = JSON.parse(event.data);
      if (eventData.type === "refresh") {
        setRefreshToken((c) => c + 1);
        console.log("🔄 YapMeter refreshing");
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("WebSocket closed");

    return () => ws.close();
  }, []);

  const stableKey = useMemo(() => {
    return `yapmeter-${settings.twitchName}-${settings.maxYap}-${settings.threshold}`;
  }, [settings.twitchName, settings.maxYap, settings.threshold]);

  return (
    <YapMeterCore
      key={stableKey}
      settings={settings}
      isRefresh={refreshToken > 0}
      wsRef={wsRef}
      clientRef={clientRef}
    />
  );
}

function useYapEvents(percent, thresholds) {
  // Keep track of last active threshold
  const lastActiveRef = useRef(null);

  useEffect(() => {
    // sort lowest → highest
    const sorted = [...thresholds].sort((a, b) => a.threshold - b.threshold);

    // find highest threshold currently crossed
    const active =
      sorted.filter((t) => percent >= t.threshold).slice(-1)[0] || null;

    const lastActive = lastActiveRef.current;

    // Fire enter only if we moved to a new higher threshold
    if (active && (!lastActive || active.threshold !== lastActive.threshold)) {
      active.onEnter?.();
    }

    // Fire exit only if we dropped below the previous highest threshold
    if (lastActive && (!active || active.threshold < lastActive.threshold)) {
      lastActive.onExit?.();
    }

    // Only update the ref AFTER firing exit/enter
    lastActiveRef.current = active;
  }, [percent, thresholds]);
}

function YapTimer({ timer, visible }) {
  const labelRef = useRef(null);

  useEffect(() => {
    let animFrame;
    const animate = () => {
      if (labelRef.current) {
        // Intensity grows infinitely: +1 every 10s
        const intensity = Math.floor(timer / 10) + 1;

        // Base scale grows slightly with intensity
        const baseScale = 1 + 0.02 * intensity;

        // Wiggle + shake grows stronger with intensity
        const wiggleFactor = intensity * 0.2;
        const rotation = Math.sin(Date.now() / 100) * 4 * wiggleFactor;
        const wiggleScale = 1 + 0.1 * wiggleFactor * Math.sin(Date.now() / 150);
        let shakeX = Math.sin(Date.now() / 40) * 1.2 * wiggleFactor;
        let shakeY = -1 * Math.sin(Date.now() / 45) * 1.2 * wiggleFactor;
        shakeX = Math.max(Math.min(shakeX, 8), -8);
        shakeY = Math.max(Math.min(shakeY, 8), -8);

        // Final scale combines base and wiggle, clamped to avoid extreme sizes
        const finalScale = Math.min(Math.max(baseScale * wiggleScale, 1), 10);

        labelRef.current.style.transform = `translateX(${shakeX}px) translateY(${shakeY}px) scale(${finalScale}) rotate(${rotation}deg)`;
      }
      animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [timer]);

  return (
    <div
      ref={labelRef}
      style={{
        position: "absolute",
        bottom: "calc(100% - 15px)",
        left: "15%",
        transform: "translateX(-50%)",
        fontSize: "20px",
        fontWeight: "bold",
        color: "#f00",
        textShadow: "0 0 5px #000",
        opacity: visible ? 1 : 0,
        transition: "opacity 1s ease", // fade in/out
        pointerEvents: "none",
        textAlign: "center",
        transformOrigin: "center",
        overflow: "auto",
        whiteSpace: "nowrap",
        outline: "1px solid red",
      }}
    >
      {timer.toFixed(1)}s
    </div>
  );
}

function FloatingPercent({ percent, getColor, settings }) {
  const labelRef = useRef(null);
  useEffect(() => {
    let animFrame;
    const animate = () => {
      if (labelRef.current) {
        const baseScale = 0.8 + 0.7 * percent;
        let rotation = 0,
          wiggleScale = 1,
          shakeX = 0,
          shakeY = 0;
        if (percent > 0.25) {
          const wiggleFactor = (percent - 0.25) * 2;
          rotation = Math.sin(Date.now() / 80) * 5 * wiggleFactor;
          wiggleScale = 1 + 0.3 * wiggleFactor;
          shakeX = Math.sin(Date.now() / 30) * 3 * wiggleFactor;
          shakeY = -1 * Math.sin(Date.now() / 30) * 3 * wiggleFactor;
          shakeX = Math.max(Math.min(shakeX, 5), -5);
          shakeY = Math.max(Math.min(shakeY, 5), -5);
        }
        //clamp final scale to avoid extreme sizes
        const finalScale = Math.min(Math.max(baseScale * wiggleScale, 0.8), 10);
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
        bottom: `calc(${percent * 100}% - ${settings.yapMeterLength - 15}px)`,
        fontSize: "16px",
        fontWeight: "bold",
        color: getColor(percent),
        textShadow: `0 0 ${percent > 0.25 ? 4 : 0}px #fff, 
                     0 0 ${percent > 0.5 ? 6 : 0}px #fff, 
                     0 0 ${percent > 0.75 ? 8 : 0}px #fff`,
        transformOrigin: "center left",
      }}
    >
      {(percent * 100).toFixed(0)}%
    </div>
  );
}

function YapMeterCore({ settings, wsRef, clientRef, isRefresh }) {
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [trailScore, setTrailScore] = useState(0);

  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef(null);

  const obsRef = useRef(null);
  const speakingRef = useRef(false);
  const lastSpeakingTimeRef = useRef(Date.now());
  const continuousStartTimeRef = useRef(0);
  const micSourceNameRef = useRef(null);
  const barShakeRef = useRef(null);
  const labelRef = useRef(null);

  // connect to OBS
  useEffect(() => {
    const obs = new OBSWebSocket();
    obsRef.current = obs;
    async function connect() {
      try {
        await obs.connect("ws://127.0.0.1:4455", undefined, {
          eventSubscriptions:
            EventSubscription.All | EventSubscription.InputVolumeMeters,
          rpcVersion: 1,
        });
        console.log("✅ YapMeter connected to OBS");

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
        if (!micInput) return console.error("❌ No mic input found");
        micSourceNameRef.current = micInput.inputName;

        obs.on("InputVolumeMeters", (data) => {
          const mic = data.inputs.find(
            (i) => i.inputName === micSourceNameRef.current
          );
          if (!mic) return;
          const levels =
            mic.inputLevelsMul || mic.inputLevels || mic.levels || mic.meters;
          if (!levels?.length) return;
          const normalized = levels[0][0] * 100;
          const now = Date.now();
          let speaking = speakingRef.current;
          let lastSpeaking = lastSpeakingTimeRef.current;
          let continuousStart = continuousStartTimeRef.current;
          let yapScore = 0;

          if (normalized > settings.yapMeterThreshold) {
            if (!speaking) {
              speaking = true;
              continuousStart = now;
            }
            lastSpeaking = now;
            yapScore = (now - continuousStart) / 1000;
          } else {
            if (
              speaking &&
              now - lastSpeaking > settings.yapMeterSilenceThreshold * 1000
            ) {
              speaking = false;
              continuousStart = 0;
              yapScore = 0;
            } else if (speaking) {
              yapScore = (lastSpeaking - continuousStart) / 1000;
            }
          }
          speakingRef.current = speaking;
          lastSpeakingTimeRef.current = lastSpeaking;
          continuousStartTimeRef.current = continuousStart;
          setScore(yapScore);
        });
      } catch (err) {
        console.error("OBS connection failed:", err);
      }
    }
    connect();
    return () => obs.disconnect();
  }, [settings.yapMeterThreshold, settings.yapMeterSilenceThreshold]);

  // smoothing
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayScore((prev) => prev + (score - prev) * 0.1);
      setTrailScore((prev) => prev + (displayScore - prev) * 0.03);
    }, 50);
    return () => clearInterval(interval);
  }, [score, displayScore]);

  const percent = Math.min(displayScore / settings.yapMeterMaxYap, 1);
  const trailPercent = Math.min(trailScore / settings.yapMeterMaxYap, 1);

  // handle running state
  useEffect(() => {
    if (percent === 1 && !running) {
      setRunning(true);
      setTimer(0);
      setVisible(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    } else if (percent < 1 && running) {
      setRunning(false);
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 5000);
    }
  }, [percent, running]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setTimer((t) => t + 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, [running]);

  const thresholds = [0.25, 0.5, 0.75, 1.0].map((t) => {
    if (t === 1.0) {
      return {
        threshold: t,
        onEnter: () => console.log("🔥 100% reached!"),
        onExit: () => {
          console.log("⬇ Dropped below 100%, sending spawnEmote");

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const payloadEmote = {
              type: "spawnEmote",
              emote: "yapping",
              count: 2 + Math.max(0, timer || 0),
              triggeredAt: Date.now(),
            };
            wsRef.current.send(JSON.stringify(payloadEmote));
            clientRef.current?.say(
              settings.twitchName,
              ` OVERYAPPED for ${timer.toFixed(1)} seconds straight!`
            );
            console.log("🚀 Sent spawnEmote:", payloadEmote);
          }
        },
      };
    } else if (t === 0.5) {
      return {
        threshold: t,
        onEnter: () => console.log("⚠ 50% reached"),
        onExit: () => {
          console.log("⬇ Dropped below 50%, sending spawnEmote");

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const payload = {
              type: "spawnEmote",
              emote: "BLABBERING",
              count: 5,
              triggeredAt: Date.now(),
            };
            wsRef.current.send(JSON.stringify(payload));
            console.log("🚀 Sent spawnEmote:", payload);
          }
        },
      };
    }

    // for other thresholds, keep your default logging
    return {
      threshold: t,
      onEnter: () => console.log(`${(t * 100).toFixed(0)}% ↑`),
      onExit: () => console.log(`${(t * 100).toFixed(0)}% ↓`),
    };
  });

  useYapEvents(percent, thresholds);

  useEffect(() => {
    const el = barShakeRef.current; // ✅ capture once
    if (!el) return;
    let animFrame;

    const animate = () => {
      if (running && timer >= 20) {
        const intensity = (timer - 20) * 0.3; // grows stronger over time
        let shakeX = Math.sin(Date.now() / 40) * intensity;
        let shakeY = Math.cos(Date.now() / 50) * intensity;
        shakeX = Math.max(Math.min(shakeX, 5), -5);
        shakeY = Math.max(Math.min(shakeY, 5), -5);

        el.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
        animFrame = requestAnimationFrame(animate);
      } else {
        el.style.transform = "none"; // reset instantly
      }
    };

    animFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrame);
      el.style.transform = "none"; // ✅ clean up the same element
    };
  }, [running, timer]);

  const getColor = (p) => {
    if (p <= 0.25) {
      // 0–25% = solid green
      return "rgb(0, 255, 0)";
    }
    if (p >= 0.75) {
      // 75–100% = solid red
      return "rgb(255, 0, 0)";
    }

    // Normalize 25%–75% → 0–1
    const t = (p - 0.25) / 0.5;

    if (t <= 0.5) {
      // 25–50% → green → yellow
      const ratio = t / 0.5; // 0 → 1
      const r = Math.round(255 * ratio); // 0 → 255
      return `rgb(${r}, 255, 0)`; // (0,255,0) → (255,255,0)
    } else {
      // 50–75% → yellow → red
      const ratio = (t - 0.5) / 0.5; // 0 → 1
      const g = Math.round(255 * (1 - ratio)); // 255 → 0
      return `rgb(255, ${g}, 0)`; // (255,255,0) → (255,0,0)
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "transparent" }}
      key={isRefresh ? Date.now() : "static"}
    >
      <div
        style={{
          height: `${settings.yapMeterLength}px`,
          width: "50px",
          padding: "10px",
          position: "absolute",
          bottom: "50px",
          left: "50px",
        }}
      >
        {/* Label */}
        <div
          ref={labelRef}
          style={{
            position: "absolute",
            width: settings.yapMeterLength,
            height: "25px",
            bottom: "-10px", // center vertically relative to the bar
            left: "-10px", // adjust horizontal position
            fontSize: "24px",
            fontWeight: "bold",
            color: "#fff",
            transform: "rotate(-90deg)", // translate along rotated axis
            transformOrigin: "center left",
            whiteSpace: "nowrap", // prevent wrapping
            textAlign: "left",
          }}
        >
          Y A P M E T E R
        </div>

        {/* Floating percent */}
        <FloatingPercent
          percent={percent}
          getColor={getColor}
          settings={settings}
        />
        {/* Timer Component */}
        <YapTimer timer={timer} visible={visible} />

        {/* Bar */}
        <div
          ref={barShakeRef}
          style={{
            height: "100%",
            width: "100%",
            overflow: "hidden",
            position: "relative",
            border: "4px solid #fff0",
            outline: "0.5px solid rgba(255,255,255,0.8)",
            transition: "translate 0.1s ease-out",
          }}
        >
          {thresholds.map((t) => (
            <div
              key={t.threshold}
              style={{
                position: "absolute",
                bottom: `${t.threshold * 100}%`,
                width: "100%",
                height: "2px",
                background: percent >= t.threshold ? "#fff" : "#666",
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
    </div>
  );
}
