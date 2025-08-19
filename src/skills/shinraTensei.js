export const shinraTensei = ({ engineRef, showText, radialKnockback }) => ({
  name: "Shinra Tensei",
  disabled: true,
  effect: (participant) => {
    const engine = engineRef.current;
    engine.timing.timeScale = 0;
    showText(participant, "🙏🏻 SHINRA TENSEI", "#ffee00ff");

    setTimeout(() => {
      radialKnockback(participant);
    }, 500);
  },
});
