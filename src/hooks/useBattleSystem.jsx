import { useRef, useCallback } from 'react';
import Matter from 'matter-js';
import { createEmoteElement } from '../utils/emoteEffects';

export function useBattleSystem(engine, emoteMap, bodiesWithTimers, battleSettings, subscriberTracker) {
  const activeBattleRef = useRef(null);
  const battleParticipants = useRef([]);
  const battleUpdateListener = useRef(null);

  const createHealthBar = useCallback((participant) => {
    const healthBar = document.createElement('div');
    healthBar.style.position = 'fixed';
    healthBar.style.width = '60px';
    healthBar.style.height = '8px';
    healthBar.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    healthBar.style.border = '1px solid #000';
    healthBar.style.borderRadius = '4px';
    healthBar.style.zIndex = '10000';
    healthBar.style.pointerEvents = 'none';
    
    const healthFill = document.createElement('div');
    healthFill.style.width = '100%';
    healthFill.style.height = '100%';
    healthFill.style.backgroundColor = '#00ff00';
    healthFill.style.borderRadius = '3px';
    healthFill.style.transition = 'width 0.3s ease, background-color 0.3s ease';
    
    healthBar.appendChild(healthFill);
    document.body.appendChild(healthBar);
    
    return { healthBar, healthFill };
  }, []);

  const updateHealthBar = useCallback((participant) => {
    const { body, healthBar, healthFill, nameLabel, hp, maxHp } = participant;
    
    if (!healthBar || !healthFill) return;
    
    const healthPercent = Math.max(0, hp / maxHp);
    const x = body.position.x - 30; // Center above emote
    const y = body.position.y - 60; // Above emote
    
    healthBar.style.transform = `translate(${x}px, ${y}px)`;
    healthFill.style.width = `${healthPercent * 100}%`;
    
    // Update name label position
    if (nameLabel) {
      const nameX = body.position.x - 40; // Center name under emote
      const nameY = body.position.y - 50; // Below emote
      nameLabel.style.transform = `translate(${nameX}px, ${nameY}px)`;
    }
    
    // Color transitions: green -> yellow -> red
    if (healthPercent > 0.6) {
      healthFill.style.backgroundColor = '#00ff00';
    } else if (healthPercent > 0.3) {
      healthFill.style.backgroundColor = '#ffff00';
    } else {
      healthFill.style.backgroundColor = '#ff0000';
    }
  }, []);

  const createBattleParticipant = useCallback((subscriber, position, id, emoteName) => {
    if (!engine) return null;

    const emote = emoteMap.get(emoteName);
    if (!emote) {
      console.warn(`No suitable emote found for ${subscriber.name}, skipping`);
      return null;
    }

    const sizeX = emote.width * 0.8;
    const sizeY = emote.height * 0.8;

    const body = Matter.Bodies.rectangle(position.x, position.y, sizeX, sizeY, {
      render: { visible: false, isStatic: false },
      restitution: 1,
      friction: 0.03,
      frictionAir: 0.01,
      isBattleParticipant: true,
      participantId: id
    });

    Matter.World.add(engine.world, body);

    const el = createEmoteElement(emote.url, sizeX, sizeY);
    el.style.boxShadow = `0 0 20px ${subscriber.color}`;
    el.style.border = `2px solid ${subscriber.color}`;
    el.style.borderRadius = '50%';

    const { healthBar, healthFill } = createHealthBar();

    const nameLabel = document.createElement('div');
    nameLabel.textContent = subscriber.name;
    nameLabel.style.position = 'fixed';
    nameLabel.style.fontSize = '14px';
    nameLabel.style.fontWeight = 'bold';
    nameLabel.style.color = subscriber.color;
    nameLabel.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    nameLabel.style.textAlign = 'center';
    nameLabel.style.zIndex = '10000';
    nameLabel.style.pointerEvents = 'none';
    nameLabel.style.whiteSpace = 'nowrap';
    document.body.appendChild(nameLabel);

    return {
      id,
      body,
      el,
      healthBar,
      healthFill,
      nameLabel,
      hp: battleSettings.battleEventHp,
      maxHp: battleSettings.battleEventHp,
      sizeX,
      sizeY,
      emoteName,
      subscriberName: subscriber.name,
      userColor: subscriber.color,
      subscriber,
      isAlive: true,
      lastDamageTime: 0,
      invulnerabilityDuration: 1000,
      born: Date.now(),
      animated: emote.animated || false,
      isSub: true,
      particleColor: subscriber.color,
      cleanupEffects: [],
      isBattleParticipant: true
    };
  }, [engine, emoteMap, battleSettings.battleEventHp, createHealthBar]);



  const spawnBattleArena = useCallback(() => {
    if (!engine || !subscriberTracker) return [];

    // Get all available subscribers
    const availableSubscribers = subscriberTracker.getSubscriberCount();

    if (availableSubscribers < 3) {
      console.log("Not enough subscribers to start a battle (minimum 3 required)");
      return [];
    }

    // Determine random number of participants: min 3, max battleEventParticipants or total subscribers
    const maxParticipants = Math.min(battleSettings.battleEventParticipants, availableSubscribers);

    // Randomly select subscribers for the battle
    const selectedSubscribers = subscriberTracker.getRandomSubscribers(maxParticipants);

    if (selectedSubscribers.length === 0) {
      console.log("No subscribers available for battle");
      return [];
    }    
    console.log(`Starting battle event with ${selectedSubscribers.length} subscribers!`);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Only square emotes
    const availableEmotes = Array.from(emoteMap.keys()).filter(key => {
      const emote = emoteMap.get(key);
      return emote?.width === emote?.height;
    });

    if (availableEmotes.length === 0) {
      console.warn("No emotes loaded yet, skipping battle");
      return [];
    }

    // Shuffle emotes
    const shuffledEmotes = availableEmotes.sort(() => Math.random() - 0.5);
    const usedEmotes = new Set();
    const participants = [];

    const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/gi, '');

    selectedSubscribers.forEach((subscriber, i) => {
      const angle = (i / selectedSubscribers.length) * Math.PI * 2;
      const spawnX = centerX + Math.cos(angle) * radius;
      const spawnY = centerY + Math.sin(angle) * radius;

      const subNameNorm = normalize(subscriber.name);

      let emoteName = availableEmotes.find(e => {
        const eNorm = normalize(e);
        return subNameNorm.length >= 3 && eNorm.includes(subNameNorm);
      });

      if (!emoteName || usedEmotes.has(emoteName)) {
        emoteName = shuffledEmotes.find(e => !usedEmotes.has(e));
      }

      if (!emoteName) {
        emoteName = shuffledEmotes[i % shuffledEmotes.length];
      }

      usedEmotes.add(emoteName);

      const participant = createBattleParticipant(
        subscriber,
        { x: spawnX, y: spawnY },
        `battle_${subscriber.username}_${i}`,
        emoteName
      );

      if (participant) {
        const velocityStrength = 2;
        const velX = (centerX - spawnX) * (velocityStrength / radius);
        const velY = (centerY - spawnY) * (velocityStrength / radius);
        Matter.Body.setVelocity(participant.body, { x: velX, y: velY });
        participants.push(participant);
      }
    });

    return participants;
  }, [engine, battleSettings.battleEventParticipants, createBattleParticipant, subscriberTracker, emoteMap]);


  function showDamageFlyup(x, y, damage, color = '#ff0000') {
    const dmgEl = document.createElement('div');
    dmgEl.textContent = Math.floor(damage); // show integer damage
    dmgEl.style.position = 'fixed';
    dmgEl.style.left = `${x}px`;
    dmgEl.style.top = `${y}px`;
    dmgEl.style.color = color;
    dmgEl.style.fontWeight = 'bold';
    dmgEl.style.fontSize = '16px';
    dmgEl.style.pointerEvents = 'none';
    dmgEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
    dmgEl.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease-out';
    document.body.appendChild(dmgEl);

    // Trigger fly-up animation
    requestAnimationFrame(() => {
      dmgEl.style.transform = 'translateY(-30px)';
      dmgEl.style.opacity = '0';
    });

    // Remove from DOM after animation
    setTimeout(() => {
      dmgEl.remove();
    }, 800);
  }


  const handleCollisions = useCallback(() => {
    if (!activeBattleRef.current || battleParticipants.current.length === 0) return;

    const now = Date.now();
    const participants = battleParticipants.current.filter(p => p.isAlive);

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const p1 = participants[i];
        const p2 = participants[j];
        
        const dx = p1.body.position.x - p2.body.position.x;
        const dy = p1.body.position.y - p2.body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (p1.sizeX + p2.sizeX) / 2 + 10;

        // Collision detection
        if (distance < minDistance) {
          const canDamageP1 = now - p1.lastDamageTime > p1.invulnerabilityDuration;
          const canDamageP2 = now - p2.lastDamageTime > p2.invulnerabilityDuration;

          // Apply damage
          if (canDamageP1) {
            const damage = battleSettings.battleEventDamage * (0.8 + Math.random() * 0.4);
            p1.hp -= damage;
            p1.lastDamageTime = now;
            showDamageFlyup(p1.body.position.x, p1.body.position.y - 40, damage, p1.userColor);
            // Flash effect
            p1.el.style.filter = 'brightness(2) hue-rotate(180deg)';
            setTimeout(() => {
              if (p1.el) p1.el.style.filter = '';
            }, 200);
          }

          if (canDamageP2) {
            const damage = battleSettings.battleEventDamage * (0.8 + Math.random() * 0.4);
            p2.hp -= damage;
            showDamageFlyup(p2.body.position.x, p2.body.position.y - 40, damage, p2.userColor);
            p2.lastDamageTime = now;
            // Flash effect
            p2.el.style.filter = 'brightness(2) hue-rotate(180deg)';
            setTimeout(() => {
              if (p2.el) p2.el.style.filter = '';
            }, 200);
          }

          // Repulsion force
          const repulsionStrength = 0.08;
          const repulsionX = (dx / distance) * repulsionStrength;
          const repulsionY = (dy / distance) * repulsionStrength;

          Matter.Body.applyForce(p1.body, p1.body.position, { x: repulsionX, y: repulsionY });
          Matter.Body.applyForce(p2.body, p2.body.position, { x: -repulsionX, y: -repulsionY });

          // Check for deaths
          if (p1.hp <= 0 && p1.isAlive) {
            p1.isAlive = false;
            // Death effect - fade out and remove
            p1.el.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
            p1.el.style.opacity = '0';
            p1.el.style.transform += ' scale(0.5)';
            p1.healthBar.style.opacity = '0';
            if (p1.nameLabel) p1.nameLabel.style.opacity = '0';
            
            // Remove from physics world immediately
            Matter.World.remove(engine.world, p1.body);
            
            // Schedule removal from DOM and arrays
            setTimeout(() => {
              if (p1.el) p1.el.remove();
              if (p1.healthBar) p1.healthBar.remove();
              if (p1.nameLabel) p1.nameLabel.remove();
              
              // Remove from battle participants
              const battleIndex = battleParticipants.current.findIndex(bp => bp.id === p1.id);
              if (battleIndex !== -1) {
                battleParticipants.current.splice(battleIndex, 1);
              }
              
              // Remove from main bodies array
              const mainIndex = bodiesWithTimers.current.findIndex(bt => bt.id === p1.id);
              if (mainIndex !== -1) {
                bodiesWithTimers.current.splice(mainIndex, 1);
              }
            }, 1000);
          }
          if (p2.hp <= 0 && p2.isAlive) {
            p2.isAlive = false;
            // Death effect - fade out and remove
            p2.el.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
            p2.el.style.opacity = '0';
            p2.el.style.transform += ' scale(0.5)';
            p2.healthBar.style.opacity = '0';
            if (p2.nameLabel) p2.nameLabel.style.opacity = '0';
            
            // Remove from physics world immediately
            Matter.World.remove(engine.world, p2.body);
            
            // Schedule removal from DOM and arrays
            setTimeout(() => {
              if (p2.el) p2.el.remove();
              if (p2.healthBar) p2.healthBar.remove();
              if (p2.nameLabel) p2.nameLabel.remove();
              
              // Remove from battle participants
              const battleIndex = battleParticipants.current.findIndex(bp => bp.id === p2.id);
              if (battleIndex !== -1) {
                battleParticipants.current.splice(battleIndex, 1);
              }
              
              // Remove from main bodies array
              const mainIndex = bodiesWithTimers.current.findIndex(bt => bt.id === p2.id);
              if (mainIndex !== -1) {
                bodiesWithTimers.current.splice(mainIndex, 1);
              }
            }, 1000);
          }
        }
      }
    }
  }, [battleSettings.battleEventDamage, engine, bodiesWithTimers]);

  const applyAttraction = useCallback(() => {
    if (!activeBattleRef.current) return;

    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive);
    let attractionStrength = 0.0008;

    if (aliveParticipants.length == 2) {
      attractionStrength = 0.01;
    }

    for (let i = 0; i < aliveParticipants.length; i++) {
      for (let j = i + 1; j < aliveParticipants.length; j++) {
        const p1 = aliveParticipants[i];
        const p2 = aliveParticipants[j];
        
        const dx = p2.body.position.x - p1.body.position.x;
        const dy = p2.body.position.y - p1.body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const forceX = (dx / distance) * attractionStrength;
          const forceY = (dy / distance) * attractionStrength;
          
          Matter.Body.applyForce(p1.body, p1.body.position, { x: forceX, y: forceY });
          Matter.Body.applyForce(p2.body, p2.body.position, { x: -forceX, y: -forceY });
        }
      }
    }
  }, []);

  const displayWinner = useCallback((winner) => {
    if (!winner) return;

    const winnerDisplay = document.createElement('div');
    winnerDisplay.innerHTML = `🏆 ${winner.subscriberName} WINS! 🏆`;
    winnerDisplay.style.position = 'fixed';
    winnerDisplay.style.top = '50%';
    winnerDisplay.style.left = '50%';
    winnerDisplay.style.transform = 'translate(-50%, -50%)';
    winnerDisplay.style.fontSize = '48px';
    winnerDisplay.style.fontWeight = 'bold';
    winnerDisplay.style.color = winner.userColor;
    winnerDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    winnerDisplay.style.zIndex = '10001';
    winnerDisplay.style.pointerEvents = 'none';
    winnerDisplay.style.textAlign = 'center';
    winnerDisplay.style.animation = 'bounce 1s ease-in-out infinite';
    
    // Add bounce animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(winnerDisplay);

    setTimeout(() => {
      winnerDisplay.remove();
      style.remove();
    }, 5000);
  }, []);

  const displayDraw = useCallback((draw) => {
    if (!draw) return;

    const winnerDisplay = document.createElement('div');
    winnerDisplay.innerHTML = `🏆 DRAW 🏆`;
    winnerDisplay.style.position = 'fixed';
    winnerDisplay.style.top = '50%';
    winnerDisplay.style.left = '50%';
    winnerDisplay.style.transform = 'translate(-50%, -50%)';
    winnerDisplay.style.fontSize = '48px';
    winnerDisplay.style.fontWeight = 'bold';
    winnerDisplay.style.color = "#ff0000";
    winnerDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    winnerDisplay.style.zIndex = '10001';
    winnerDisplay.style.pointerEvents = 'none';
    winnerDisplay.style.textAlign = 'center';
    winnerDisplay.style.animation = 'bounce 1s ease-in-out infinite';
    
    // Add bounce animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(winnerDisplay);

    setTimeout(() => {
      winnerDisplay.remove();
      style.remove();
    }, 5000);
  }, []);

  const endBattle = useCallback(() => {
    if (!activeBattleRef.current || !engine) return;

    // Find winner from remaining alive participants
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive);
    let winner;
    let draw = false;
    
    if (aliveParticipants.length === 1) {
      winner = aliveParticipants[0];
    } else if (aliveParticipants.length > 1) {
      // Find participant with highest HP
      winner = aliveParticipants.reduce((prev, current) => 
        current.hp > prev.hp ? current : prev
      );
    } else {
      draw = true;
    }    

    if (winner) {
      displayWinner(winner);
    } else if (draw) {
      displayDraw(draw);
    }

    // 🔹 Stop physics: remove update listener
    if (battleUpdateListener.current) {
      Matter.Events.off(engine, "beforeUpdate", battleUpdateListener.current);
      battleUpdateListener.current = null;
    }

    // 🔹 Freeze remaining participants
    aliveParticipants.forEach(p => {
      Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(p.body, 0);
      Matter.Body.setStatic(p.body, true); // optional: makes body completely immovable
    });

    // Clean up battle after a delay (DOM removal, etc.)
    setTimeout(() => {
      battleParticipants.current.forEach(participant => {
        const index = bodiesWithTimers.current.findIndex(body => body.id === participant.id);
        if (index !== -1) bodiesWithTimers.current.splice(index, 1);

        if (participant.body && engine) {
          try { Matter.World.remove(engine.world, participant.body); } catch(e) {}
        }
        if (participant.el && participant.el.parentNode) participant.el.remove();
        if (participant.healthBar && participant.healthBar.parentNode) participant.healthBar.remove();
        if (participant.nameLabel && participant.nameLabel.parentNode) participant.nameLabel.remove();
      });

      battleParticipants.current = [];
      activeBattleRef.current = null;
      console.log("Battle ended and all participants cleaned up");
    }, 3000);
  }, [engine, displayWinner, bodiesWithTimers, displayDraw]);


  const updateBattle = useCallback(() => {
    if (!activeBattleRef.current) return;

    // Update health bars for all participants (including dead ones that haven't been removed yet)
    battleParticipants.current.forEach(participant => {
      if (participant.isAlive) {
        updateHealthBar(participant);
      }
    });
    
    // Apply attraction between alive participants only
    applyAttraction();
    
    // Handle collisions and damage
    handleCollisions();
    
    // Check win conditions - only count truly alive participants
    const aliveParticipants = battleParticipants.current.filter(p => p.isAlive);
    const battleDuration = Date.now() - activeBattleRef.current.startTime;
        
    if (aliveParticipants.length <= 1 || battleDuration >= battleSettings.battleEventDuration * 1000) {
      endBattle();
    }
  }, [updateHealthBar, applyAttraction, handleCollisions, battleSettings.battleEventDuration, endBattle]);

  const startBattle = useCallback(() => {
    if (activeBattleRef.current || !engine) {
      console.log("Battle already active or no engine");
      return;
    }

    // Check if we have at least 3 subscribers
    if (!subscriberTracker || subscriberTracker.getSubscriberCount() < 3) {
      console.log("Not enough subscribers for battle (minimum 3 required)");
      return;
    }

    const participants = spawnBattleArena();
    if (participants.length === 0) return;
    
    // Add battle participants to the main bodiesWithTimers array so they get rendered
    participants.forEach(participant => {
      bodiesWithTimers.current.push(participant);
    });
    
    battleParticipants.current = participants;
    activeBattleRef.current = {
      startTime: Date.now(),
      participants
    };

    // Set up battle update loop
    battleUpdateListener.current = updateBattle;
    Matter.Events.on(engine, "beforeUpdate", battleUpdateListener.current);

    // Battle announcement with participant names
    const participantNames = participants.map(p => p.subscriberName).join(' vs ');
    const announcement = document.createElement('div');
    announcement.innerHTML = `⚔️ BATTLE ROYALE: ${participantNames}! ⚔️`;
    announcement.style.position = 'fixed';
    announcement.style.top = '20px';
    announcement.style.left = '50%';
    announcement.style.transform = 'translateX(-50%)';
    announcement.style.fontSize = '24px';
    announcement.style.fontWeight = 'bold';
    announcement.style.color = '#ff6600';
    announcement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    announcement.style.zIndex = '10001';
    announcement.style.pointerEvents = 'none';
    announcement.style.textAlign = 'center';
    announcement.style.maxWidth = '80%';
    document.body.appendChild(announcement);

    setTimeout(() => announcement.remove(), 4000);
  }, [engine, spawnBattleArena, updateBattle, bodiesWithTimers, subscriberTracker, battleSettings.battleEventParticipants]);
  
  return {
    startBattle,
    endBattle,
    isActive: !!activeBattleRef.current,
    participants: battleParticipants.current
  };
}