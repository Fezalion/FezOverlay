// Helper: returns true if an element is an emote image
function isEmoteImg(el) {
  return (
    el.tagName === "IMG" &&
    el.style.position === "fixed" &&
    el.style.zIndex === "9999"
  );
}

// Remove all emote image elements from DOM
export function removeAllEmoteElements() {
  document.querySelectorAll("img").forEach((img) => {
    if (isEmoteImg(img)) {
      img.remove();
    }
  });
}
export const createEffectsRegistry = (effectSettings) => ({
  hueShift: (el) => {
    if (Math.random() * 100 > effectSettings.subEffectHueShiftChance) return;

    let hue = 0;
    const intervalId = setInterval(() => {
      if (!document.body.contains(el)) {
        clearInterval(intervalId);
        return;
      }
      hue = (hue + 30) % 360;
      el.style.filter = `hue-rotate(${hue}deg)`;
    }, 100);

    return () => clearInterval(intervalId);
  },
});

// In-memory cache for emote image blobs
const emoteImageCache = new Map(); // url -> blobUrl

export function createEmoteElement(url, sizeX, sizeY) {
  const img = document.createElement("img");

  function normalizeUrl(u) {
    if (!u) return u;
    // If already absolute with http(s), keep it
    if (/^https?:\/\//i.test(u)) return u;
    // Work on a trimmed string
    let s = String(u).trim();
    // Remove any repeated leading 'http:' or 'https:' fragments (handles cases like 'https:https://...')
    while (/^https?:/i.test(s)) {
      s = s.replace(/^https?:/i, "");
    }
    // If it now starts with // -> make it https://
    if (s.startsWith("//")) return "https:" + s;
    // If it now starts with an absolute scheme (e.g. after trimming) return it
    if (/^https?:\/\//i.test(s)) return s;
    // Otherwise ensure it has https:// and remove any extra leading slashes
    s = s.replace(/^\/+/, "");
    return "https://" + s;
  }

  // Helper to set up the image element
  function setupImg(srcUrl) {
    img.src = srcUrl;
    img.style.width = sizeX + "px";
    img.style.height = sizeY + "px";
    img.style.position = "fixed";
    img.style.left = "0px";
    img.style.top = "0px";
    img.style.pointerEvents = "none";
    img.style.zIndex = "9999";
    img.style.opacity = "0";
    img.style.transition = "opacity 0.5s ease";
    requestAnimationFrame(() => {
      img.style.opacity = "1";
    });
  }

  // Normalize incoming URL to avoid malformed values
  const normalized = normalizeUrl(url);

  // If cached, use cached value (could be blob URL or direct URL)
  if (emoteImageCache.has(normalized)) {
    setupImg(emoteImageCache.get(normalized));
    console.log(`using cached emote image: ${normalized}`);
    return img;
  }

  // Determine if the image is cross-origin relative to our app origin
  let isCrossOrigin = true;
  try {
    const imgUrl = new URL(normalized, window.location.href);
    isCrossOrigin = imgUrl.origin !== window.location.origin;
  } catch {
    isCrossOrigin = true;
  }

  if (isCrossOrigin) {
    // Try to use the server-side proxy to get a same-origin cached copy on first load.
    const proxyUrl = `/api/emote-proxy?url=${encodeURIComponent(normalized)}`;
    // Set crossOrigin in case the server returns CORS-enabled images
    img.crossOrigin = "anonymous";

    // Attempt to fetch the proxied image (this will populate server cache on first request)
    fetch(proxyUrl)
      .then((r) => {
        if (!r.ok) throw new Error("proxy failed");
        // Use the proxy endpoint directly (same-origin) so browser can fetch it without CORS issues
        const proxied = proxyUrl;
        emoteImageCache.set(normalized, proxied);
        setupImg(proxied);
        console.log(`Using proxied emote image: ${proxied}`);
      })
      .catch(() => {
        // Fallback: use cross-origin direct URL
        emoteImageCache.set(normalized, normalized);
        setupImg(normalized);
        console.warn(
          `Proxy failed, using cross-origin direct URL: ${normalized}`
        );
      });
  } else {
    // Same-origin: fetch and convert to blob URL for caching
    fetch(normalized)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        emoteImageCache.set(normalized, blobUrl);
        setupImg(blobUrl);
        console.log(`Cached emote image: ${blobUrl}`);
      })
      .catch(() => {
        // fallback to direct URL if fetch fails
        emoteImageCache.set(normalized, normalized);
        setupImg(normalized);
        console.warn(
          `Failed to fetch emote as blob, using direct URL: ${normalized}`
        );
      });
  }

  return img;
}
