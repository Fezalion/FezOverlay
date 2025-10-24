export const omaewamou = ({
  engineRef,
  showText,
  findStrongestEnemy,
  dealDamage,
}) => ({
  name: "Omae wa mou shindeiru",
  disabled: false,
  effect: (participant) => {
    const engine = engineRef.current;
    engine.timing.timeScale = 0.1;

    showText(participant, "🫵 OMAE WA MOU SHINDEIRU");
    const randomEnemy = findStrongestEnemy(participant);

    if (randomEnemy && randomEnemy.body) {
      showText(randomEnemy, "NANI");
    } else {
      showText(participant, "NANI");
    }

    setTimeout(() => {
      engine.timing.timeScale = 1;
      if (!participant.isAlive) return; // Skip if dead
      dealDamage(randomEnemy, randomEnemy.maxHp, participant, false);
    }, 3000);
  },
});
