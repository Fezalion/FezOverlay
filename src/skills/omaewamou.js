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
    engine.timing.timeScale = 0.01;

    showText(participant, "🫵 OMAE WA MOU SHINDEIRU");
    const randomEnemy = findStrongestEnemy(participant);
    showText(randomEnemy, "NANI");

    setTimeout(() => {
      engine.timing.timeScale = 1;
      dealDamage(randomEnemy, 9999, participant, false);
    }, 3000);
  },
});
