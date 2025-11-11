import { useRef, useEffect } from "react";

// Simple in-memory cache for emote sets
const emoteSetCache = new Map(); // key: setId, value: emote array
let globalEmoteCache = null;

// Helpers to fetch provider emotes and normalize shape: { name, url, width, height, animated }
function normalizeUrl(u) {
  if (!u) return u;
  let s = String(u).trim();
  // If already absolute, return as-is
  if (/^https?:\/\//i.test(s)) return s;
  // If protocol-relative, add https:
  if (s.startsWith("//")) return "https:" + s;
  // Strip leading colon(s) and slashes from things like 'https:/cdn...' or 'https:////...'
  s = s.replace(/^https?:/i, "");
  s = s.replace(/^\/+/, "");
  return "https://" + s;
}

async function fetch7TVSet(set) {
  if (set === "global" && globalEmoteCache) return globalEmoteCache;
  if (emoteSetCache.has(`7tv:${set}`)) return emoteSetCache.get(`7tv:${set}`);
  const res = await fetch(`https://7tv.io/v3/emote-sets/${set}`);
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();
  const emotes = data?.emotes || [];
  const normalized = emotes
    .filter((e) => e?.name && e?.id)
    .map((emote) => {
      const file =
        emote.data.host.files[1] || emote.data.host.files.slice(-1)[0];
      const hostUrl = emote.data.host.url || "";
      const raw = hostUrl.endsWith("/")
        ? hostUrl + file.name
        : hostUrl + "/" + file.name;
      const url = normalizeUrl(raw);
      const zeroWidth = emote.flags == 1;
      //console.log(zeroWidth ?? `${data.name}:${zeroWidth}`);

      return {
        name: emote.name,
        url,
        width: file.width || 64,
        height: file.height || 64,
        animated: emote.data.animated || false,
        zeroWidth,
      };
    });
  if (set === "global") globalEmoteCache = normalized;
  else emoteSetCache.set(`7tv:${set}`, normalized);
  return normalized;
}

async function fetchBTTVGlobal() {
  if (emoteSetCache.has("bttv:global")) return emoteSetCache.get("bttv:global");
  const res = await fetch("https://api.betterttv.net/3/cached/emotes/global");
  if (!res.ok) return [];
  const data = await res.json();
  const normalized = data.map((e) => ({
    name: e.code,
    url: normalizeUrl(`https://cdn.betterttv.net/emote/${e.id}/3x`),
    width: 112,
    height: 112,
    animated: false,
  }));
  emoteSetCache.set("bttv:global", normalized);
  return normalized;
}

async function fetchBTTVChannelByTwitchId(twitchId) {
  try {
    const res = await fetch(
      `https://api.betterttv.net/3/cached/users/twitch/${twitchId}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const emotes = [];
    (data.channelEmotes || []).forEach((e) =>
      emotes.push({
        name: e.code,
        url: normalizeUrl(`https://cdn.betterttv.net/emote/${e.id}/3x`),
        width: 112,
        height: 112,
        animated: e.animated,
      })
    );
    (data.sharedEmotes || []).forEach((e) =>
      emotes.push({
        name: e.code,
        url: normalizeUrl(`https://cdn.betterttv.net/emote/${e.id}/3x`),
        width: 112,
        height: 112,
        animated: e.animated,
      })
    );
    return emotes;
  } catch {
    return [];
  }
}

async function fetchFFZForChannel(channel) {
  try {
    const res = await fetch(
      `https://api.frankerfacez.com/v1/room/${encodeURIComponent(channel)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const emotes = [];
    // FFZ returns sets keyed by id; each set has emoticons array
    const sets = data.sets || {};
    Object.values(sets).forEach((set) => {
      (set.emoticons || []).forEach((em) => {
        // pick largest url available
        const urls = em.urls || {};
        const sizeKeys = Object.keys(urls)
          .map((k) => parseInt(k, 10))
          .filter(Boolean)
          .sort((a, b) => a - b);
        const best = sizeKeys.length
          ? urls[String(sizeKeys[sizeKeys.length - 1])]
          : Object.values(urls)[0];
        const url = best ? normalizeUrl(best) : null;
        if (url)
          emotes.push({
            name: em.name,
            url,
            width: 112,
            height: 112,
            animated: false,
          });
      });
    });
    return emotes;
  } catch {
    return [];
  }
}

// Helper to call server /api/twitch to get client id & token, then resolve a twitch user id
async function fetchTwitchUserId(username) {
  if (!username) return null;
  try {
    const credsRes = await fetch(`/api/twitch`);
    if (!credsRes.ok) return null;
    const creds = await credsRes.json();
    const { client, auth } = creds || {};
    if (!client || !auth) return null;
    const helix = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
      {
        headers: {
          "Client-ID": client,
          Authorization: `Bearer ${auth}`,
        },
      }
    );
    if (!helix.ok) return null;
    const helixData = await helix.json();
    const user = helixData?.data?.[0];
    return user?.id || null;
  } catch {
    return null;
  }
}

async function fetchTwitchChannelEmotes(twitchId, creds) {
  try {
    // twitchId is broadcaster id
    const { client, auth } = creds || {};
    if (!client || !auth || !twitchId) return [];
    const res = await fetch(
      `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${twitchId}`,
      {
        headers: {
          "Client-ID": client,
          Authorization: `Bearer ${auth}`,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    console.log(data);
    const emotes = (data.data || [])
      .map((e) => {
        // pick the highest scale image available
        let url =
          e.images?.url_4x || e.images?.url_2x || e.images?.url_1x || null;
        url = normalizeUrl(url);
        return { name: e.name, url, width: 112, height: 112, animated: false };
      })
      .filter(Boolean);
    return emotes;
  } catch {
    return [];
  }
}

export function useEmoteLoader(emoteSetId, refreshToken, options = {}) {
  const emoteMapRef = useRef(new Map());
  const {
    twitchName = null,
    enableBTTV = true,
    enableFFZ = true,
    includeTwitchChannelEmotes = true,
  } = options;

  useEffect(() => {
    if (!emoteSetId && !twitchName) return;

    async function loadEmotes() {
      try {
        // 1) load 7TV set + global
        const [setEmotes, globalEmotes] = await Promise.all([
          emoteSetId ? fetch7TVSet(emoteSetId).catch(() => []) : [],
          fetch7TVSet("global").catch(() => []),
        ]);

        // 2) provider-specific
        const providerPromises = [];
        if (enableBTTV) providerPromises.push(fetchBTTVGlobal());
        if (enableFFZ && twitchName)
          providerPromises.push(fetchFFZForChannel(twitchName));

        // 3) twitch channel emotes via helix if requested
        let twitchChannelEmotes = [];
        let twitchCreds = null;
        if (includeTwitchChannelEmotes && twitchName) {
          // get credentials from server
          try {
            const credsRes = await fetch(`/api/twitch`);
            if (credsRes.ok) {
              twitchCreds = await credsRes.json();
            }
          } catch {
            twitchCreds = null;
          }
          const twitchId = await fetchTwitchUserId(twitchName);
          if (twitchId && twitchCreds) {
            twitchChannelEmotes = await fetchTwitchChannelEmotes(
              twitchId,
              twitchCreds
            );
          }
          // also attempt BTTV channel for this twitch id
          if (enableBTTV && twitchId) {
            providerPromises.push(fetchBTTVChannelByTwitchId(twitchId));
          }
        }

        const providerResults = await Promise.all(
          providerPromises.map((p) => p.catch?.(() => []) || p)
        );

        // flatten and merge by priority: twitchChannelEmotes > BTTV channel > FFZ channel > BTTV global > 7TV set > 7TV global
        const ordered = [
          ...twitchChannelEmotes,
          ...providerResults.flat(),
          ...setEmotes,
          ...globalEmotes,
        ];

        const newMap = new Map();
        ordered.forEach((em) => {
          if (!em || !em.name || !em.url) return;
          // prefer already-set (higher priority first), but ensure first occurrence wins
          if (!newMap.has(em.name)) {
            newMap.set(em.name, {
              url: em.url,
              width: em.width || 64,
              height: em.height || 64,
              animated: !!em.animated,
              zeroWidth: !!em.zeroWidth,
            });
          }
        });

        // Mutate existing Map instance so callers that captured the Map see updates
        const existing = emoteMapRef.current || new Map();
        existing.clear();
        for (const [k, v] of newMap.entries()) existing.set(k, v);
        emoteMapRef.current = existing;
        console.log(`Loaded ${existing.size} emotes (merged)`);
      } catch (e) {
        console.error("Error loading emotes:", e);
      }
    }

    loadEmotes();

    return () => {
      emoteMapRef.current.clear();
    };
  }, [
    emoteSetId,
    refreshToken,
    twitchName,
    enableBTTV,
    enableFFZ,
    includeTwitchChannelEmotes,
  ]);

  return emoteMapRef.current;
}
