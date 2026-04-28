// src/components/YouTubePlayer.jsx
import { useEffect, useRef } from "react";

let apiReady = false;
let apiLoading = false;
const readyCallbacks = [];

function loadYouTubeApi(cb) {
  if (apiReady) return cb();
  readyCallbacks.push(cb);
  if (apiLoading) return;

  apiLoading = true;
  window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    readyCallbacks.forEach((fn) => fn());
    readyCallbacks.length = 0;
  };

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
}

export default function YouTubePlayer({
  videoId,
  onReady,
  onEnd,
  onStateChange,
}) {
  const wrapperRef = useRef(null);
  const playerRef = useRef(null);
  // ✅ Always holds the latest onReady/onEnd without recreating the player
  const onReadyRef = useRef(onReady);
  const onEndRef = useRef(onEnd);
  const onStateChangedRef = useRef(onStateChange);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);
  useEffect(() => {
    onStateChangedRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    let destroyed = false;

    loadYouTubeApi(() => {
      if (destroyed || !wrapperRef.current) return;

      // Clean up previous player instance if it exists
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          /* ignore */
        }
        playerRef.current = null;
      }

      // 1. Create a fresh inner div for YouTube to replace
      const anchor = document.createElement("div");
      wrapperRef.current.innerHTML = ""; // Clear the wrapper
      wrapperRef.current.appendChild(anchor);

      // 2. Target the anchor, NOT the ref directly
      playerRef.current = new window.YT.Player(anchor, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          mute: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            e.target.setPlaybackQuality("medium");
            e.target.playVideo();
            onReadyRef.current?.(e.target);
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              e.target.setPlaybackQuality("medium");
            }
            onStateChangedRef.current?.(e);
            // Explicitly check for the ENDED state (0)
            if (e.data === 0 || e.data === window.YT.PlayerState.ENDED) {
              onEndRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          /* ignore */
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
      ref={wrapperRef}
    />
  );
}
