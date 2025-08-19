export const shield = ({ showText }) => ({
  name: "Shield",
  disabled: false,
  duration: 2000,
  effect: (p) => {
    showText(p, "🛡️ SHIELD", "#00aaff");
    p.el.classList.add("has-shield");
    p.hasShield = true;
    // Green glow effect on participant
    p.el.style.boxShadow = `0 0 30px #00aaff, 0 0 20px ${p.userColor}`;
    setTimeout(() => {
      if (p.el) p.el.style.boxShadow = `0 0 20px ${p.userColor}`;
    }, 2000);
  },
});
