// src/utils/youtube.js
const cache = new Map();

export async function fetchVideoInfo(videoId) {
  if (cache.has(videoId)) return cache.get(videoId);

  const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

  if (!API_KEY) {
    console.error("Missing VITE_YOUTUBE_API_KEY in environment");
    return { videoId, title: "Unknown title", channel: "Unknown channel" };
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${API_KEY}`,
    );

    // ✅ Handle non-2xx responses explicitly
    if (!res.ok) {
      throw new Error(`YouTube API error: ${res.status}`);
    }

    const data = await res.json();
    const item = data.items?.[0];

    // ✅ Handle valid response but missing video (deleted, private, bad ID)
    if (!item) {
      console.warn(`No YouTube video found for ID: ${videoId}`);
      return { videoId, title: "Unknown title", channel: "Unknown channel" };
    }

    const info = {
      videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
    };

    cache.set(videoId, info);
    return info;
  } catch (err) {
    console.error(`fetchVideoInfo failed for ${videoId}:`, err);
    // ✅ Don't cache failures — allows retry on next call
    return { videoId, title: "Unknown title", channel: "Unknown channel" };
  }
}
