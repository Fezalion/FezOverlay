export const shinraTensei = ({ showText, radialKnockback }) => ({
  name: "Shinra Tensei",
  disabled: false,
  effect: (participant) => {
    showText(participant, "🙏🏻 SHINRA TENSEI", "#ffee00ff");

    setTimeout(() => {
      if (!participant.isAlive) return; // Skip if dead
      radialKnockback(participant);
    }, 150);
  },
});
