// src/utils/youtube.js
const cache = new Map();
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
export const YOUTUBE_API_SETUP_URL =
  "https://console.cloud.google.com/apis/credentials";
export const hasYoutubeApiKey = Boolean(API_KEY);

export async function fetchPlaylistData(playlistId) {
  if (!API_KEY) {
    console.error("Missing VITE_YOUTUBE_API_KEY");
    return { title: "Error: No API Key", items: [] };
  }

  try {
    // 1. Get Playlist Metadata (Title/Owner)
    const metaRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?id=${playlistId}&part=snippet&key=${API_KEY}`,
    );
    if (!metaRes.ok) throw new Error(`Meta fetch failed: ${metaRes.status}`);
    const metaData = await metaRes.json();
    const playlistTitle =
      metaData.items?.[0]?.snippet.title || "Imported Playlist";

    // 2. Fetch all items (handling pagination)
    let allItems = [];
    let nextPageToken = "";

    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}&pageToken=${nextPageToken}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Items fetch failed: ${res.status}`);

      const data = await res.json();

      const pageItems = data.items.map((item) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        channel:
          item.snippet.videoOwnerChannelTitle ||
          item.snippet.channelTitle ||
          "Unknown",
      }));

      allItems = [...allItems, ...pageItems];
      nextPageToken = data.nextPageToken || "";
    } while (nextPageToken);

    return { title: playlistTitle, items: allItems };
  } catch (err) {
    console.error(`fetchPlaylistData failed for ${playlistId}:`, err);
    throw err;
  }
}

export async function fetchVideoInfo(videoId) {
  if (cache.has(videoId)) return cache.get(videoId);

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
