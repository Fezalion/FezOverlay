import { useCallback } from "react";
// Matter import removed, using Rapier logic
import {
  createEmoteElement,
  removeAllEmoteElements,
} from "../utils/emoteEffects";

export function useEmoteSpawner(
  engineRef, // Ref to Rapier World — read .current at call time
  emoteMap,
  bodiesWithTimers,
  { emoteScale, emoteBaseSize = 64, emoteStaticMode, subOnlyMode },
) {
  const spawnEmote = useCallback(
    (emoteName, isSub = false, userColor = "orange") => {
      if (subOnlyMode && isSub === false) return;
      const engine = engineRef.current; // read live value at spawn time
      if (!engine) return;

      let emote = emoteMap.get(emoteName);
      let compositeLayers = null;

      // Handle modifier syntax (base/mod, base+mod, base:mod)
      if (!emote) {
        const sepMatch = emoteName
          .split(/[/+:|]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (sepMatch.length > 1) {
          const layers = [];
          for (const part of sepMatch) {
            const e = emoteMap.get(part);
            if (e && e.url)
              layers.push({
                url: e.url,
                zeroWidth: !!e.zeroWidth,
                width: e.width,
                height: e.height,
                animated: !!e.animated,
              });
          }
          if (layers.length > 0) {
            compositeLayers = layers;
            emote = {
              url: layers[0].url || layers[0],
              width: layers[0].width || emoteMap.get(sepMatch[0])?.width || 64,
              height:
                layers[0].height || emoteMap.get(sepMatch[0])?.height || 64,
              animated: layers.some((l) => !!l.animated),
            };
          }
        }
      }

      if (!emote) {
        console.warn(`spawnEmote: emote not found in emoteMap: ${emoteName}`);
        return;
      }

      // Size Calculations
      const intrinsicW = emote.width || emote.height || emoteBaseSize;
      const intrinsicH = emote.height || emote.width || emoteBaseSize;
      const aspect = intrinsicW / intrinsicH || 1;
      const nominalHeight = emoteBaseSize * emoteScale;
      const sizeY = nominalHeight;
      const sizeX = Math.round(nominalHeight * aspect);

      // Spawn Logic (Grid Math)
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cellW = width / 3;
      const cellH = height / 3;

      const edgeCells = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (!(col === 1 && row === 1)) {
            edgeCells.push({ col, row });
          }
        }
      }

      const spawnCell = edgeCells[Math.floor(Math.random() * edgeCells.length)];
      const x = spawnCell.col * cellW + Math.random() * cellW;
      const y = spawnCell.row * cellH + Math.random() * cellH;

      const targetX = cellW + Math.random() * cellW;
      const targetY = cellH + Math.random() * cellH;

      let dx = targetX - x;
      let dy = targetY - y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len;
      dy /= len;

      const isCorner = spawnCell.col !== 1 && spawnCell.row !== 1;
      const maxAngleOffset = isCorner ? Math.PI / 3 : Math.PI / 6;

      const angleOffset = (Math.random() - 0.5) * (2 * maxAngleOffset);
      const cos = Math.cos(angleOffset);
      const sin = Math.sin(angleOffset);
      const rotatedDx = dx * cos - dy * sin;
      const rotatedDy = dx * sin + dy * cos;

      // Speed in Rapier scales slightly differently than Matter,
      // but we maintain the logic
      const baseSpeed = 400;
      const speedVariance = 50;
      const speed =
        baseSpeed + (Math.random() * speedVariance - speedVariance / 2);

      const velX = rotatedDx * speed;
      const velY = rotatedDy * speed;

      // --- RAPIER BODY CREATION ---
      const world = engine;

      // Use the static factory (not the constructor) so the body type is correct.
      // Set initial velocity on the descriptor so it is baked in at creation time.
      const rbDesc = window.RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y)
        .setLinvel(velX, velY)
        .setLinearDamping(0)
        .setAngularDamping(0)
        .setGravityScale(1)
        .setCcdEnabled(false)
        .setCanSleep(false);

      if (emoteStaticMode) rbDesc.lockRotations();
      const body = world.createRigidBody(rbDesc);

      // Create Collider (half-extents for cuboid)
      const clDesc = window.RAPIER.ColliderDesc.cuboid(sizeX / 2, sizeY / 2)
        .setRestitution(1.0)
        .setFriction(0.1);

      world.createCollider(clDesc, body);

      // Belt-and-suspenders: also set linvel on the live body and force wake
      body.setLinvel({ x: velX, y: velY }, true);
      if (!emoteStaticMode) body.setAngvel((Math.random() - 0.5) * 5, true);
      body.wakeUp();

      // --- DOM ELEMENT ---
      const el = createEmoteElement(
        compositeLayers || emote.url,
        sizeX,
        sizeY,
        emote.animated,
      );
      document.body.appendChild(el);

      let cleanupEffects = [];

      bodiesWithTimers.current.push({
        body, // Now a Rapier RigidBody[cite: 16]
        born: Date.now(),
        el,
        sizeX,
        sizeY,
        animated: emote.animated,
        isSub,
        particleColor: userColor,
        cleanupEffects,
      });
    },
    [
      engineRef,
      emoteMap,
      emoteScale,
      emoteBaseSize,
      emoteStaticMode,
      subOnlyMode,
      bodiesWithTimers,
    ],
  );

  return { spawnEmote, removeAllEmoteElements };
}
