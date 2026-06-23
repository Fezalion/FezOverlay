export const omaewamou = ({ showText, findStrongestEnemy, dealDamage }) => ({
  name: "Omae wa mou shindeiru",
  disabled: false,
  effect: (participant) => {
    showText(participant, "🫵 OMAE WA MOU SHINDEIRU");
    const randomEnemy = findStrongestEnemy(participant);

    if (randomEnemy && randomEnemy.body) {
      showText(randomEnemy, "NANI");
    } else {
      showText(participant, "NANI");
    }

    setTimeout(() => {
      if (!participant.isAlive) return; // Skip if dead
      dealDamage(randomEnemy, randomEnemy.maxHp, participant, false);
    }, 3000);
  },
});
