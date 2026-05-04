export const omaewamou = ({
  showText,
  findStrongestEnemy,
  dealDamage,
  setEngineTimeScale,
  restoreEngineTimeScale,
}) => ({
  name: "Omae wa mou shindeiru",
  disabled: false,
  effect: (participant) => {
    setEngineTimeScale(0.1);

    showText(participant, "🫵 OMAE WA MOU SHINDEIRU");
    const randomEnemy = findStrongestEnemy(participant);

    if (randomEnemy && randomEnemy.body) {
      showText(randomEnemy, "NANI");
    } else {
      showText(participant, "NANI");
    }

    setTimeout(() => {
      restoreEngineTimeScale();
      if (!participant.isAlive) return; // Skip if dead
      dealDamage(randomEnemy, randomEnemy.maxHp, participant, false);
    }, 3000);
  },
});
