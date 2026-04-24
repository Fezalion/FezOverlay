// src/utils/youtube.js
const cache = new Map();
export const YOUTUBE_API_SETUP_URL =
  "https://console.cloud.google.com/apis/credentials";
export const hasYoutubeApiKey = false;

export async function fetchPlaylistData(playlistId) {
  try {
    const res = await fetch(
      `/api/youtube/playlist/${encodeURIComponent(playlistId)}`,
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Playlist fetch failed: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`fetchPlaylistData failed for ${playlistId}:`, err);
    throw err;
  }
}

export async function fetchVideoInfo(videoId) {
  if (cache.has(videoId)) return cache.get(videoId);

  try {
    const res = await fetch(
      `/api/youtube/video/${encodeURIComponent(videoId)}`,
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `YouTube API error: ${res.status}`);
    }

    const data = await res.json();
    const info = {
      videoId,
      title: data?.title || "Unknown title",
      channel: data?.channel || "Unknown channel",
      duration: data?.duration ?? 0,
    };

    cache.set(videoId, info);
    return info;
  } catch (err) {
    console.error(`fetchVideoInfo failed for ${videoId}:`, err);
    return {
      videoId,
      title: "Unknown title",
      channel: "Unknown channel",
      duration: 0,
    };
  }
}
