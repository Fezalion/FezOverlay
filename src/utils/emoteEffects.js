export const createEffectsRegistry = (effectSettings) => ({
  colorFlash: (el) => {
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
  }
});

export function createEmoteElement(url, sizeX, sizeY) {
  const img = document.createElement("img");
  img.src = url;
  img.style.width = sizeX + "px";
  img.style.height = sizeY + "px";
  img.style.position = "fixed";
  img.style.pointerEvents = "none";
  img.style.zIndex = "9999";
  img.style.opacity = "0";
  img.style.transition = "opacity 0.5s ease";
  document.body.appendChild(img);

  requestAnimationFrame(() => {
    img.style.opacity = "1";
  });

  return img;
}