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

export function createEmoteElement(urlOrArray, sizeX, sizeY, animated = false) {
  // urlOrArray may be a single URL string or an array of URL strings (layers).
  if (Array.isArray(urlOrArray)) {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "0px";
    container.style.top = "0px";
    container.style.pointerEvents = "none";
    container.style.zIndex = "9999";
    container.style.width = sizeX + "px";
    container.style.height = sizeY + "px";
    container.style.opacity = "0";
    container.style.transition = "opacity 0.5s ease";
    requestAnimationFrame(() => {
      container.style.opacity = "1";
    });

    // Create an img for each layer and append
    for (const u of urlOrArray) {
      const img = document.createElement("img");
      img.style.width = sizeX + "px";
      img.style.height = sizeY + "px";
      img.style.position = "absolute";
      img.style.left = "0px";
      img.style.top = "0px";
      img.style.pointerEvents = "none";
      img.style.zIndex = "0";
      // layer may be a string URL or an object {url, zeroWidth, width, height, animated}
      const layerUrl = typeof u === "string" ? u : u?.url;
      const layerMeta = typeof u === "object" && u ? u : {};

      // If zeroWidth, we'll mark the element so it can be styled differently if needed
      if (layerMeta.zeroWidth) img.dataset.zeroWidth = "true";

      // Use existing logic to normalize and fetch each layer via proxy when needed
      (function setupLayer(srcUrl, el) {
        function normalizeUrl(u) {
          if (!u) return u;
          let s = String(u).trim();
          while (/^https?:/i.test(s)) {
            s = s.replace(/^https?:/i, "");
          }
          if (s.startsWith("//")) return "https:" + s;
          s = s.replace(/^\/+/, "");
          return "https://" + s;
        }

        const normalized = normalizeUrl(srcUrl);

        // If cached, use cached value
        if (emoteImageCache.has(normalized)) {
          el.src = emoteImageCache.get(normalized);
          return;
        }

        let isCrossOrigin = true;
        try {
          const imgUrl = new URL(normalized, window.location.href);
          isCrossOrigin = imgUrl.origin !== window.location.origin;
        } catch {
          isCrossOrigin = true;
        }

        if (isCrossOrigin) {
          const proxyUrl = `/api/emote-proxy?url=${encodeURIComponent(
            normalized
          )}`;
          el.crossOrigin = "anonymous";
          fetch(proxyUrl)
            .then((r) => {
              if (!r.ok) throw new Error("proxy failed");
              const proxied = proxyUrl;
              emoteImageCache.set(normalized, proxied);
              el.src = proxied;
            })
            .catch(() => {
              emoteImageCache.set(normalized, normalized);
              el.src = normalized;
            });
        } else {
          fetch(normalized)
            .then((res) => res.blob())
            .then((blob) => {
              const blobUrl = URL.createObjectURL(blob);
              emoteImageCache.set(normalized, blobUrl);
              el.src = blobUrl;
            })
            .catch(() => {
              emoteImageCache.set(normalized, normalized);
              el.src = normalized;
            });
        }
      })(layerUrl, img);

      container.appendChild(img);
    }

    return container;
  }

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
  const normalized = normalizeUrl(urlOrArray);

  // mark animated metadata on the element so CSS or effects can pick it up
  if (animated) img.dataset.animated = "true";

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
