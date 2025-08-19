export const heal = ({ battleSettings, showText }) => ({
  name: "Heal",
  disabled: false,
  effect: (p) => {
    const healAmount = battleSettings.battleEventHp * 0.3;
    p.hp = Math.min(p.maxHp, p.hp + healAmount);
    showText(p, "💚 HEAL", "#00ff00");

    // Green glow effect
    p.el.style.boxShadow = `0 0 30px #00ff00, 0 0 20px ${p.userColor}`;
    setTimeout(() => {
      if (p.el) p.el.style.boxShadow = `0 0 20px ${p.userColor}`;
    }, 1000);
  },
});
