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

  // If cached, use blob URL
  if (emoteImageCache.has(url)) {
    setupImg(emoteImageCache.get(url));
    console.log(`using cached emote image: ${url}`);
  } else {
    // Fetch and cache as blob
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        emoteImageCache.set(url, blobUrl);
        setupImg(blobUrl);
        console.log(`Cached emote image: ${blobUrl}`);
      })
      .catch(() => {
        // fallback to direct URL if fetch fails
        setupImg(url);
        console.warn(`Failed to fetch emote as blob, using direct URL: ${url}`);
      });
  }

  return img;
}
