import { useRef, useEffect } from "react";

// Simple in-memory cache for emote sets
const emoteSetCache = new Map(); // key: setId, value: emote array
let globalEmoteCache = null;

export function useEmoteLoader(emoteSetId, refreshToken) {
  const emoteMapRef = useRef(new Map());

  useEffect(() => {
    if (!emoteSetId) return;

    async function fetchEmoteSet(set) {
      // Check cache first
      if (set === "global" && globalEmoteCache) {
        return globalEmoteCache;
      }
      if (emoteSetCache.has(set)) {
        return emoteSetCache.get(set);
      }
      const res = await fetch(`https://7tv.io/v3/emote-sets/${set}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      const emotes = data?.emotes || [];
      if (set === "global") {
        globalEmoteCache = emotes;
      } else {
        emoteSetCache.set(set, emotes);
      }
      return emotes;
    }

    async function loadEmotes() {
      try {
        const [setEmotes, globalEmotes] = await Promise.all([
          fetchEmoteSet(emoteSetId),
          fetchEmoteSet("global"),
        ]);
        const allEmotes = [...setEmotes, ...globalEmotes];
        const newMap = new Map();

        allEmotes.forEach((emote) => {
          if (!emote.name || !emote.id) return;
          const file = emote.data.host.files[1]; // 2x res
          const url = `https:${emote.data.host.url}/${file.name}`;
          newMap.set(emote.name, {
            url,
            width: file.width,
            height: file.height,
            animated: emote.data.animated || false,
          });
        });

        emoteMapRef.current = newMap;
        console.log(`Loaded ${newMap.size} emotes`);
      } catch (e) {
        console.error("Error loading emotes:", e);
      }
    }

    loadEmotes();

    return () => {
      emoteMapRef.current.clear();
    };
  }, [emoteSetId, refreshToken]);

  return emoteMapRef.current;
}
