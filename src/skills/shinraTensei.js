export const shinraTensei = ({ engineRef, showText, radialKnockback }) => ({
  name: "Shinra Tensei",
  disabled: false,
  effect: (participant) => {
    const engine = engineRef.current;
    engine.timing.timeScale = 0;
    showText(participant, "🙏🏻 SHINRA TENSEI", "#ffee00ff");

    setTimeout(() => {
      engine.timing.timeScale = 1;
      if (!participant.isAlive) return; // Skip if dead
      radialKnockback(participant);
    }, 500);
  },
});
