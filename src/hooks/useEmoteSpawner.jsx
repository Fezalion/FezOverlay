import { useCallback } from 'react';
import Matter from 'matter-js';
import { createEmoteElement, createEffectsRegistry } from '../utils/emoteEffects';

export function useEmoteSpawner(
  engine, 
  emoteMap, 
  bodiesWithTimers, 
  { emoteScale, subEffects, subEffectTypes, subOnlyMode, ...effectSettings }
) {
  const effectsRegistry = createEffectsRegistry(effectSettings);

  const spawnEmote = useCallback((emoteName, isSub = false, userColor = "orange") => {
    if (subOnlyMode && isSub === false) return;
    if (!engine) return;
    
    const emote = emoteMap.get(emoteName);
    if (!emote) return;

    const sizeX = emote.width * emoteScale;
    const sizeY = emote.height * emoteScale;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const cellW = width / 3;
    const cellH = height / 3;

    // All outer cells except center
    const edgeCells = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (!(col === 1 && row === 1)) {
          edgeCells.push({ col, row });
        }
      }
    }

    // Pick random spawn cell
    const spawnCell = edgeCells[Math.floor(Math.random() * edgeCells.length)];
    const x = spawnCell.col * cellW + Math.random() * cellW;
    const y = spawnCell.row * cellH + Math.random() * cellH;

    // Pick a random target point inside middle cell
    const targetX = cellW + Math.random() * cellW;
    const targetY = cellH + Math.random() * cellH;

    // Direction vector toward target
    let dx = targetX - x;
    let dy = targetY - y;
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;

    // Determine if this is a corner or edge
    const isCorner = (spawnCell.col !== 1 && spawnCell.row !== 1);
    const maxAngleOffset = isCorner ? Math.PI / 3 : Math.PI / 6;

    // Apply a random angle offset
    const angleOffset = (Math.random() - 0.5) * (2 * maxAngleOffset);
    const cos = Math.cos(angleOffset);
    const sin = Math.sin(angleOffset);
    const rotatedDx = dx * cos - dy * sin;
    const rotatedDy = dx * sin + dy * cos;

    // Speed with slight variation
    const baseSpeed = 15;
    const speedVariance = 5;
    const speed = baseSpeed + (Math.random() * speedVariance - speedVariance / 2);

    const velX = rotatedDx * speed;
    const velY = rotatedDy * speed;

    // Create Matter body
    const body = Matter.Bodies.rectangle(x, y, sizeX, sizeY, {
      render: { visible: false, isStatic: false },
      restitution: 1,
      friction: 0.1,
      frictionAir: 0.007
    });

    Matter.World.add(engine.world, body);
    Matter.Body.setVelocity(body, { x: velX, y: velY });
    Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);

    const el = createEmoteElement(emote.url, sizeX, sizeY, emote.animated);

    let cleanupEffects = [];
    if (isSub && subEffects && subEffectTypes.length > 0) {
      const filteredEffects = subEffectTypes.filter(effect => effectsRegistry[effect]);

      if (filteredEffects.length > 0) {
        filteredEffects.forEach(effectName => {
          const effect = effectsRegistry[effectName];
          if (effect) {
            const cleanup = effect(el, body, engine, userColor);
            if (cleanup) cleanupEffects.push(cleanup);
          }
        });          
      }
    }

    bodiesWithTimers.current.push({
      body,
      born: Date.now(),
      el,
      sizeX,
      sizeY,
      animated: emote.animated,
      isSub,
      particleColor: userColor,
      cleanupEffects
    });
  }, [engine, emoteMap, emoteScale, subEffects, subEffectTypes, subOnlyMode, effectsRegistry]);

  return { spawnEmote };
}