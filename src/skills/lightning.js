export const lightning = ({
  findNearestEnemy,
  engineRef,
  showText,
  drawJaggedLightning,
  dealDamage,
  battleSettings,
}) => ({
  name: "Lightning",
  disabled: false,
  effect: (participant) => {
    // Find nearest enemy and deal AOE damage
    const farEnemy = findNearestEnemy(participant);
    const chain = findNearestEnemy(farEnemy, participant);
    const chain2 = findNearestEnemy(chain, participant, farEnemy);

    console.log(
      `from:${participant.subscriberName} to ${farEnemy.subscriberName} to ${chain.subscriberName} to ${chain2.subscriberName}`
    );
    if (farEnemy) {
      if (!participant.isAlive) return; // Skip if dead
      const engine = engineRef.current;
      engine.timing.timeScale = 0;

      const lightningStrikes = 8; // number of farEnemy strikes
      const interval = 100;
      const offset = 50;
      let totalTimeTook = 0;
      showText(participant, "⚡ LIGHTNING STRIKE!", "#0025cc");

      setTimeout(() => {
        for (let i = 0; i < lightningStrikes; i++) {
          const baseTime = i * interval;

          // main strike on farEnemy
          setTimeout(() => {
            if (!participant.isAlive) return; // Skip if dead
            drawJaggedLightning(participant, farEnemy);
            const damage = battleSettings.battleEventDamage * 0.3;
            dealDamage(farEnemy, damage, participant, false);
          }, baseTime + offset);
          // can chain to another
          if (chain) {
            setTimeout(() => {
              if (!participant.isAlive) return; // Skip if dead
              drawJaggedLightning(farEnemy, chain);
              const damage = battleSettings.battleEventDamage * 0.2;
              dealDamage(chain, damage, participant, false);
            }, baseTime + 100 + offset);
          }
          if (chain2) {
            if (!participant.isAlive) return; // Skip if dead
            setTimeout(() => {
              drawJaggedLightning(chain, chain2);
              const damage = battleSettings.battleEventDamage * 0.1;
              dealDamage(chain2, damage, participant, false);
            }, baseTime + 100 + offset);
          }
          totalTimeTook = baseTime + 100 + offset;
        }

        setTimeout(() => {
          engine.timing.timeScale = 1;
        }, totalTimeTook + offset);
      }, 150);
    }
  },
});
