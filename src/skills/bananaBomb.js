// ─── constants ────────────────────────────────────────────────────────────────
const BANANA_SPEED = 12; // px/frame for the primary banana
const TURN_RATE = 0.08; // 0-1, how aggressively it steers toward its lock
const CURVE_AMPLITUDE = 0.35; // rad, perpendicular wobble layered onto heading
const CURVE_FREQUENCY = 0.006; // wobble oscillation speed (per ms)
const SPIN_SPEED = 18; // deg/frame, constant regardless of travel direction
const HIT_RADIUS = 26; // distance that counts as a connect
const MAX_LIFETIME = 8000; // ms before an unlanded banana fizzles out
const FONT_SIZE_MAIN = 64;
const FONT_SIZE_SPLIT = 24;

const SPLIT_COUNT = 8; // bananas spawned on explosion
const SPLIT_DAMAGE_FACTOR = 0.35; // fraction of base damage per split hit
const SPLIT_SPEED = 8; // splits fly a little slower than the main banana
const SPLIT_HIT_RADIUS = 20;

export const bananaBomb = ({
  findNearestEnemy,
  showText,
  dealDamage,
  battleSettings,
  battleParticipants,
}) => ({
  name: "Banana Bomb",
  disabled: false,
  effect: (participant) => {
    if (!participant?.isAlive || !participant.body) return;

    const initialTarget = findNearestEnemy(participant);
    if (!initialTarget) return;

    const svg = document.getElementById("effects-layer");
    if (!svg) return;

    // ── shared glow filter, created once ──────────────────────────────────────
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.prepend(defs);
    }
    if (!defs.querySelector("#banana-glow")) {
      defs.insertAdjacentHTML(
        "beforeend",
        `<filter id="banana-glow" x="-80%" y="-80%" width="260%" height="260%">
           <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
           <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
         </filter>`,
      );
    }

    showText(participant, "🍌 BANANA BOMB!", "#ffd23f");

    throwBanana({
      svg,
      participant,
      startPos: participant.body.translation(),
      target: initialTarget,
      findNearestEnemy,
      dealDamage,
      battleSettings,
      battleParticipants,
      canExplode: true,
      speed: BANANA_SPEED,
      hitRadius: HIT_RADIUS,
      damageMul: 1,
      excluded: [],
      size: FONT_SIZE_MAIN,
    });
  },
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

// One thrown banana: homes onto `target`, re-acquiring a new nearest enemy
// every frame if its lock dies, curves via a constant perpendicular wobble,
// and spins forever. Used for both the original throw and every split that
// spawns out of its explosion (with canExplode set to false for those).
function throwBanana({
  svg,
  participant,
  startPos,
  target,
  findNearestEnemy,
  dealDamage,
  battleSettings,
  battleParticipants,
  canExplode,
  speed,
  hitRadius,
  damageMul,
  excluded,
  size,
  initialHeading,
}) {
  const pos = { x: startPos.x, y: startPos.y };
  let currentTarget = target;
  let heading =
    initialHeading ??
    Math.atan2(
      target.body.translation().y - pos.y,
      target.body.translation().x - pos.x,
    );
  let rotation = Math.random() * 360;
  const wobbleSeed = Math.random() * 1000;
  let elapsed = 0;
  let raf;

  // ── visual: outer group handles position, inner group handles spin ────────
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const trail = document.createElementNS("http://www.w3.org/2000/svg", "line");
  trail.setAttribute("stroke", "rgba(255,210,60,0.35)");
  trail.setAttribute("stroke-width", "3");
  trail.setAttribute("stroke-linecap", "round");
  group.appendChild(trail);

  const spinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.textContent = "🍌";
  text.setAttribute("font-size", size);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.setAttribute("filter", "url(#banana-glow)");
  spinGroup.appendChild(text);
  group.appendChild(spinGroup);

  svg.appendChild(group);

  const cleanup = () => {
    cancelAnimationFrame(raf);
    group.remove();
  };

  const onHit = () => {
    if (!currentTarget?.isAlive || !currentTarget?.body) {
      cleanup();
      return;
    }

    dealDamage(
      currentTarget,
      battleSettings.battleEventDamage * damageMul,
      participant,
      false,
    );
    impact(svg, pos.x, pos.y, canExplode);

    if (canExplode) {
      explode({
        svg,
        participant,
        pos: { ...pos },
        hitEnemy: currentTarget,
        findNearestEnemy,
        dealDamage,
        battleSettings,
        battleParticipants,
      });
    }

    cleanup();
  };

  const fizzle = () => {
    impact(svg, pos.x, pos.y, false, true);
    cleanup();
  };

  const tick = () => {
    if (!participant?.isAlive) {
      cleanup();
      return;
    }

    elapsed += 16;

    // re-acquire a target if the current lock died mid-flight
    if (!currentTarget || !currentTarget.isAlive || !currentTarget.body) {
      const seeker = { ...participant, body: { translation: () => pos } };
      currentTarget = findNearestEnemy(seeker, ...excluded);
      if (!currentTarget) {
        fizzle(); // nobody left alive to chase
        return;
      }
    }

    const tPos = currentTarget.body.translation();
    const dx = tPos.x - pos.x;
    const dy = tPos.y - pos.y;
    const dist = Math.hypot(dx, dy);

    if (dist < hitRadius) {
      onHit();
      return;
    }

    // steer toward the lock (homing)
    const desiredHeading = Math.atan2(dy, dx);
    let diff = desiredHeading - heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize to -pi..pi
    heading += diff * TURN_RATE;

    // constant perpendicular wobble — this is what gives it the curving,
    // banana-shaped flight path instead of a straight homing line
    const wobble =
      Math.sin(elapsed * CURVE_FREQUENCY + wobbleSeed) * CURVE_AMPLITUDE;
    const moveHeading = heading + wobble;

    const lastPos = { ...pos };
    pos.x += Math.cos(moveHeading) * speed;
    pos.y += Math.sin(moveHeading) * speed;

    rotation += SPIN_SPEED; // spins constantly, independent of travel direction

    group.setAttribute("transform", `translate(${pos.x},${pos.y})`);
    spinGroup.setAttribute("transform", `rotate(${rotation})`);
    trail.setAttribute("x1", lastPos.x - pos.x);
    trail.setAttribute("y1", lastPos.y - pos.y);
    trail.setAttribute("x2", 0);
    trail.setAttribute("y2", 0);

    if (elapsed > MAX_LIFETIME) {
      fizzle();
      return;
    }

    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
}

// Spawns the secondary bananas on explosion. Spreads them across distinct
// enemies where possible (falling back to repeats if there aren't enough
// targets to go around), and fans their initial heading outward like
// shrapnel before homing takes over.
function explode({
  svg,
  participant,
  pos,
  hitEnemy,
  findNearestEnemy,
  dealDamage,
  battleSettings,
  battleParticipants,
}) {
  const usedTargets = [hitEnemy];

  for (let i = 0; i < SPLIT_COUNT; i++) {
    const seeker = { ...participant, body: { translation: () => pos } };
    let splitTarget = findNearestEnemy(seeker, ...usedTargets);
    if (!splitTarget) splitTarget = findNearestEnemy(seeker); // allow repeats
    if (!splitTarget) break; // nothing left alive at all

    usedTargets.push(splitTarget);

    const scatterAngle = (i / SPLIT_COUNT) * Math.PI * 2 + Math.random() * 0.6;

    throwBanana({
      svg,
      participant,
      startPos: pos,
      target: splitTarget,
      findNearestEnemy,
      dealDamage,
      battleSettings,
      battleParticipants,
      canExplode: false,
      speed: SPLIT_SPEED,
      hitRadius: SPLIT_HIT_RADIUS,
      damageMul: SPLIT_DAMAGE_FACTOR,
      excluded: [],
      size: FONT_SIZE_SPLIT,
      initialHeading: scatterAngle,
    });
  }
}

// Burst of peel-colored particles at impact. `big` = the main explosion that
// spawns splits, otherwise a small splat for a single split-banana hit.
// `isFizzle` = a quiet puff when a banana never finds a target to connect with.
function impact(svg, x, y, big, isFizzle = false) {
  const count = isFizzle ? 4 : big ? 14 : 6;
  const colors = isFizzle ? ["#cfcfcf"] : ["#ffd23f", "#fff3b0", "#8a5a2b"];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = (big ? 40 : 20) * (0.5 + Math.random());
    const dot = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", big ? 3 + Math.random() * 3 : 2 + Math.random() * 2);
    dot.setAttribute("fill", colors[Math.floor(Math.random() * colors.length)]);
    svg.appendChild(dot);

    dot.animate(
      [
        { transform: "translate(0,0)", opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`,
          opacity: 0,
        },
      ],
      { duration: 280 + Math.random() * 220, easing: "ease-out" },
    ).onfinish = () => dot.remove();
  }

  if (big) {
    const flash = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    flash.setAttribute("cx", x);
    flash.setAttribute("cy", y);
    flash.setAttribute("r", 4);
    flash.setAttribute("fill", "rgba(255,210,60,0.55)");
    svg.appendChild(flash);
    flash.animate(
      [
        { r: 4, opacity: 0.8 },
        { r: 46, opacity: 0 },
      ],
      { duration: 320, easing: "ease-out" },
    ).onfinish = () => flash.remove();
  }
}
