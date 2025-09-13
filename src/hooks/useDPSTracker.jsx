import { useRef, useEffect } from "react";
// DPS Tracker class to integrate with your battle system
class BattleDPSTracker {
  constructor(settings) {
    this.battleStats = new Map(); // playerId -> stats
    this.battleStartTime = null;
    this.battleEndTime = null;
    this.battleActive = false;
    this.finalResults = null;
    this.battleSettings = settings;
    this.skillHistory = [];
  }

  // Record a skill use (global, color-coded)
  // Record a skill use (global, color-coded) - SAFER VERSION
  recordSkillUse(userId, userName, color, skillName) {
    try {
      // Validate inputs
      if (!userId || !userName || !skillName) {
        console.warn("recordSkillUse: Missing required parameters", {
          userId,
          userName,
          skillName,
        });
        return;
      }

      // Assign a unique id for each message
      const entryId = `skillmsg-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const entry = {
        userId: String(userId),
        userName: String(userName),
        color: String(color || "#fff"),
        skillName: String(skillName),
        timestamp: Date.now(),
        entryId,
      };

      // Initialize skillHistory if it doesn't exist
      if (!this.skillHistory) {
        this.skillHistory = [];
      }

      this.skillHistory.push(entry);

      // Keep only last 10 in memory
      if (this.skillHistory.length > 10) {
        this.skillHistory.shift();
      }

      console.log("Recording skill use:", entry); // Debug log

      // Only display the new message
      this._displaySingleMessage(entry);

      // Schedule removal of this specific message after 7 seconds
      setTimeout(() => {
        this._removeMessageFromDOM(entryId);
      }, 7000);
    } catch (error) {
      console.error("Error in recordSkillUse:", error);
      console.log("Parameters:", { userId, userName, color, skillName });
    }
  }

  // Remove specific message from DOM
  _removeMessageFromDOM(entryId) {
    const msg = document.getElementById(entryId);
    if (msg && msg.parentNode) {
      msg.style.animation =
        "skill-slide-out 0.35s cubic-bezier(.4,1.4,.6,1) forwards";

      const handleAnimationEnd = () => {
        msg.removeEventListener("animationend", handleAnimationEnd);
        if (msg.parentNode) {
          msg.parentNode.removeChild(msg); // Remove just the message, not the overlay

          // Clean up empty overlay
          const overlay = document.getElementById("skill-history-overlay");
          if (overlay && overlay.children.length === 0) {
            overlay.remove();
          }
        }
      };

      msg.addEventListener("animationend", handleAnimationEnd);

      // Fallback cleanup
      setTimeout(() => {
        if (msg && msg.parentNode) {
          msg.parentNode.removeChild(msg);
          const overlay = document.getElementById("skill-history-overlay");
          if (overlay && overlay.children.length === 0) {
            overlay.remove();
          }
        }
      }, 400);
    }
  }

  getSkillHistory() {
    return this.skillHistory.slice();
  }

  // Display a single new message
  _displaySingleMessage(entry) {
    // Inject animation styles once
    if (!document.getElementById("skill-history-animations")) {
      const style = document.createElement("style");
      style.id = "skill-history-animations";
      style.textContent = `
      @keyframes skill-slide-in {
        from { 
          opacity: 0; 
          transform: translateX(80px) scale(0.8); 
        }
        to { 
          opacity: 0.95; 
          transform: translateX(0) scale(1); 
        }
      }
      @keyframes skill-slide-out {
        from { 
          opacity: 0.95; 
          transform: translateX(0) scale(1); 
        }
        to { 
          opacity: 0; 
          transform: translateX(80px) scale(0.8); 
        }
      }
    `;
      document.head.appendChild(style);
    }

    // Create overlay if not present
    let overlay = document.getElementById("skill-history-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "skill-history-overlay";
      overlay.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 10003;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 8px;
      pointer-events: none;
      min-width: 250px;
      max-width: 600px;
      max-height: 400px;
    `;
      document.body.appendChild(overlay);
    }

    // Only add this message if it doesn't already exist
    if (!document.getElementById(entry.entryId)) {
      const msg = document.createElement("div");
      msg.id = entry.entryId;
      msg.style.cssText = `
      background: rgba(15, 23, 42, 0.8);
      border-right: 4px solid ${entry.color};
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 14px;
      border-radius: 0px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      margin: 0;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      animation: skill-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      backdrop-filter: blur(12px);      
      position: relative;
      overflow: hidden;
    `;

      msg.innerHTML = `      
      <span style="
        color: ${entry.color}; 
        font-weight: 700; 
        margin-right: 8px;
        text-shadow: 0 0 8px ${entry.color}33;
      ">${entry.userName}</span>
      <span style="
        opacity: 0.8; 
        margin-right: 8px;
        font-weight: 400;
      ">used</span>
      <span style="
        color: #ffd43b; 
        font-weight: 700;
        text-shadow: 0 0 8px #ffd43b33;
      ">${entry.skillName}</span>
    `;

      overlay.appendChild(msg);
    }
  }

  startBattle() {
    this.battleStartTime = Date.now();
    this.battleEndTime = null;
    this.battleActive = true;
    this.battleStats.clear();
    this.finalResults = null;
  }

  endBattle() {
    if (!this.battleActive) return;

    this.battleEndTime = Date.now();
    this.battleActive = false;
    this.finalResults = this.calculateFinalStats();
    this.displayBattleResults();
  }

  // Register a participant in the DPS tracker
  registerParticipant(participant) {
    if (!this.battleStats.has(participant.id)) {
      this.battleStats.set(participant.id, {
        id: participant.id,
        name: participant.subscriberName,
        color: participant.userColor,
        isSub: participant.isSub,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        kills: 0,
        deaths: 0,
        damageEvents: [],
        killEvents: [],
        deathTime: null,
        survivalTime: 0,
      });
    }
  }

  // Record damage dealt
  recordDamageDealt(attackerId, targetId, damage) {
    if (!this.battleActive) return;

    const attackerStats = this.battleStats.get(attackerId);
    const targetStats = this.battleStats.get(targetId);

    if (attackerStats) {
      attackerStats.totalDamageDealt += damage;
      attackerStats.damageEvents.push({
        damage,
        target: targetId,
        timestamp: Date.now(),
      });
    }

    if (targetStats) {
      targetStats.totalDamageTaken += damage;
    }
  }

  // Record a kill
  recordKill(killerId, victimId) {
    if (!this.battleActive) return;

    const killerStats = this.battleStats.get(killerId);
    const victimStats = this.battleStats.get(victimId);

    if (killerStats) {
      killerStats.kills++;
      killerStats.killEvents.push({
        victim: victimId,
        timestamp: Date.now(),
      });
    }

    if (victimStats) {
      victimStats.deaths++;
      victimStats.deathTime = Date.now();
      victimStats.survivalTime = Date.now() - this.battleStartTime;
    }
  }

  // Calculate DPS for a player
  calculateDPS(playerId) {
    const stats = this.battleStats.get(playerId);
    if (!stats) return 0;

    const battleDuration = this.getBattleDurationSeconds();
    if (battleDuration <= 0) return 0;

    // If player died, use their survival time instead of total battle time
    const relevantDuration = stats.deathTime
      ? (stats.deathTime - this.battleStartTime) / 1000
      : battleDuration;

    return relevantDuration > 0 ? stats.totalDamageDealt / relevantDuration : 0;
  }

  getBattleDurationSeconds() {
    if (!this.battleStartTime) return 0;
    const endTime = this.battleEndTime || Date.now();
    return (endTime - this.battleStartTime) / 1000;
  }

  calculateFinalStats() {
    const results = [];
    const battleDuration = this.getBattleDurationSeconds();

    for (const [playerId, stats] of this.battleStats) {
      const dps = this.calculateDPS(playerId);
      const kda = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;

      results.push({
        ...stats,
        dps: Math.round(dps * 100) / 100,
        kda: Math.round(kda * 100) / 100,
        damagePerKill:
          stats.kills > 0
            ? Math.round(stats.totalDamageDealt / stats.kills)
            : 0,
        survivalTime: stats.deathTime
          ? stats.survivalTime / 1000
          : battleDuration,
        survivalPercent: stats.deathTime
          ? Math.round((stats.survivalTime / (battleDuration * 1000)) * 100)
          : 100,
      });
    }

    // Sort by survival (highest first)
    results.sort((a, b) => b.survivalTime - a.survivalTime);
    return results;
  }

  displayBattleResults() {
    if (!this.finalResults) return;

    // Create results overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10002;
      animation: fadeIn 0.5s ease-out;
    `;

    const resultsPanel = document.createElement("div");
    resultsPanel.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid #4a9eff;
      border-radius: 15px;
      padding: 10px;
      max-width: 400px;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideIn 0.5s ease-out;
      position:absolute;
      top:50%;
      ${
        this.battleSettings.battleEventDPSTrackerFloatLeft
          ? "left:20px;"
          : "right:20px;"
      }
      transform: translateY(-50%);
    `;

    // Add animations
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform:translateY(-50%) translateX(-50px); opacity: 0; }
        to { transform:translateY(-50%) translateX(0); opacity: 1; }
      }      
    `;
    document.head.appendChild(style);

    // Title
    const title = document.createElement("h2");
    title.textContent = "⚔️ BATTLE RESULTS ⚔️";
    title.style.cssText = `
      text-align: center;
      color: #4a9eff;
      margin: 0 0 10px 0;
      font-size: 16px;
      text-shadow: 0 0 10px rgba(74, 158, 255, 0.5);
    `;

    // Battle info
    const battleInfo = document.createElement("div");
    battleInfo.style.cssText = `
      text-align: center;
      color: #ffffff;
      margin-bottom: 15px;
      font-size: 12px;
    `;
    battleInfo.innerHTML = `
      Duration: <span style="color: #4a9eff;">${this.getBattleDurationSeconds().toFixed(
        1
      )}s</span> | 
      Participants: <span style="color: #4a9eff;">${
        this.finalResults.length
      }</span>
    `;

    // Results table
    const table = document.createElement("div");
    table.style.cssText = `
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      display: grid;
      grid-template-columns: 40px 2fr 1fr 1fr 1fr 1fr;
      gap: 8px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.2);
      color: #ffffff;
      font-weight: bold;
      font-size: 10px;
    `;
    header.innerHTML = `
      <div style="text-align: center;">#</div>
      <div>Player</div>
      <div style="text-align: center;">DPS</div>
      <div style="text-align: center;">Damage</div>
      <div style="text-align: center;">Kills</div>
      <div style="text-align: center;">Survival</div>
    `;

    table.appendChild(header);

    // Results rows
    this.finalResults.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "battle-results-row";
      row.style.cssText = `
        display: grid;
        grid-template-columns: 40px 2fr 1fr 1fr 1fr 1fr;
        gap: 10px;
        padding: 6px 7px;
        background: ${
          index % 2 === 0
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(255, 255, 255, 0.02)"
        };
        color: #ffffff;
        border-left: 3px solid ${player.color};
        transition: all 0.2s ease;
      `;

      // Rank with medal for top 3
      const rankText =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : (index + 1).toString();

      row.innerHTML = `
        <div style="text-align: center; font-weight: bold;">${rankText}</div>
        <div style="color: ${player.color}; font-weight: bold;">${
        player.name
      }</div>
        <div style="text-align: center; color: #ff6b6b; font-weight: bold;">${player.dps.toFixed(
          1
        )}</div>
        <div style="text-align: center;">${player.totalDamageDealt.toFixed(
          1
        )}</div>
        <div style="text-align: center; color: #51cf66;">${player.kills}</div>
        <div style="text-align: center; color: #ffd43b;">${player.survivalTime.toFixed(
          1
        )}s</div>
      `;

      table.appendChild(row);
    });

    // Add fade out animation
    style.textContent += `
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;

    // Assemble the panel
    resultsPanel.appendChild(title);
    resultsPanel.appendChild(battleInfo);
    resultsPanel.appendChild(table);
    overlay.appendChild(resultsPanel);
    document.body.appendChild(overlay);

    // Auto-close after 30 seconds
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.style.animation = "fadeOut 0.3s ease-out forwards";
        setTimeout(() => {
          overlay.remove();
          style.remove();
        }, 300);
      }
    }, 10 * 1000);
  }

  // Get current stats during battle
  getCurrentStats() {
    const results = [];
    const currentTime = Date.now();
    const battleDuration = (currentTime - this.battleStartTime) / 1000;

    for (const [playerId, stats] of this.battleStats) {
      const dps =
        battleDuration > 0 ? stats.totalDamageDealt / battleDuration : 0;
      const kda = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;

      results.push({
        ...stats,
        dps: Math.round(dps * 100) / 100,
        kda: Math.round(kda * 100) / 100,
        currentSurvivalTime: battleDuration,
      });
    }

    results.sort((a, b) => b.survivalTime - a.survivalTime);
    return results;
  }
}

export function useBattleDPSTracker(battleSettings) {
  const trackerRef = useRef();

  useEffect(() => {
    trackerRef.current = new BattleDPSTracker(battleSettings);
  }, [battleSettings]); // recreate tracker if settings change

  return trackerRef;
}
