import { useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// usePhysicsEngine — Rapier replacement for the Matter.js engine hook
//
// Rapier must be available on window.RAPIER before this hook mounts.
// The recommended pattern is to import and init Rapier at the app entry point:
//
//   import RAPIER from "@dimforge/rapier2d";
//   await RAPIER.init();
//   window.RAPIER = RAPIER;
//
// engineRef.current is now a Rapier World instance.  All downstream hooks
// (useBattleSystem, useEmoteSpawner, etc.) read engineRef.current as the world.
//
// Key API differences vs Matter.js:
//   body.translation()          → { x, y }   (replaces body.position)
//   body.rotation()             → angle in radians (replaces body.angle)
//   world.step()                → advances the simulation one tick
//   world.createRigidBody(desc) → returns a RigidBody handle
//   world.createCollider(desc, body) → attaches a collider to a body
//   world.removeRigidBody(body) → removes body + its colliders
// ---------------------------------------------------------------------------

// How many milliseconds per physics step.
// Rapier's default timestep is 1/60 s ≈ 16.67 ms.
const STEP_MS = 1000 / 60;

export function usePhysicsEngine(onStep) {
  const engineRef = useRef(null); // Rapier World
  const intervalId = useRef(null); // setInterval handle for physics steps
  // rAF handle for DOM sync loop (separate from the step loop)
  const domRafId = useRef(null);

  useEffect(() => {
    const RAPIER = window.RAPIER;
    if (!RAPIER) {
      console.error(
        "usePhysicsEngine: window.RAPIER is not initialised. " +
          "Call `await RAPIER.init()` and assign `window.RAPIER = RAPIER` before mounting.",
      );
      return;
    }

    // ── Create world (zero gravity — matches Matter engine.gravity.y = 0) ──
    const world = new RAPIER.World({ x: 0, y: 0 });
    engineRef.current = world;

    // ── Boundary walls ─────────────────────────────────────────────────────
    const wallThickness = 200;

    // Returns four static cuboid colliders that enclose [0,width] × [0,height].
    // Rapier cuboid half-extents: (hw, hh).
    function createWalls(width, height) {
      const descs = [
        // Left wall
        {
          x: -wallThickness / 2,
          y: height / 2,
          hw: wallThickness / 2,
          hh: height / 2,
        },
        // Right wall
        {
          x: width + wallThickness / 2,
          y: height / 2,
          hw: wallThickness / 2,
          hh: height / 2,
        },
        // Top wall
        {
          x: width / 2,
          y: -wallThickness / 2,
          hw: width / 2,
          hh: wallThickness / 2,
        },
        // Bottom wall
        {
          x: width / 2,
          y: height + wallThickness / 2,
          hw: width / 2,
          hh: wallThickness / 2,
        },
      ];

      return descs.map(({ x, y, hw, hh }) => {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hw, hh);
        world.createCollider(colliderDesc, body);
        return body;
      });
    }

    let width = window.innerWidth;
    let height = window.innerHeight;
    let wallBodies = createWalls(width, height);

    // ── Resize handler ──────────────────────────────────────────────────────
    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      // Remove old walls
      wallBodies.forEach((b) => {
        try {
          world.removeRigidBody(b);
        } catch {
          /* already removed */
        }
      });
      // Add new walls
      wallBodies = createWalls(width, height);
    }
    window.addEventListener("resize", handleResize);

    // ── Fixed-timestep step loop via setInterval ───────────────────────────
    // One world.step() per interval tick — no rAF, no accumulator needed.
    intervalId.current = setInterval(() => {
      if (engineRef.current) {
        engineRef.current.step();
        if (onStep) onStep(engineRef.current);
      }
    }, STEP_MS);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("resize", handleResize);
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
      if (domRafId.current) {
        cancelAnimationFrame(domRafId.current);
        domRafId.current = null;
      }
      // Rapier worlds must be freed explicitly to avoid WASM memory leaks
      if (engineRef.current) {
        try {
          engineRef.current.free();
        } catch {
          /* ignore */
        }
        engineRef.current = null;
      }
    };
  }, [onStep]);

  // ── DOM sync loop ──────────────────────────────────────────────────────────
  // Reads Rapier body positions each rAF and writes them to DOM elements.
  // Replaces Matter's body.position with body.translation() and
  // body.angle with body.rotation().
  const startDOMUpdates = useCallback((bodiesWithTimers, options = {}) => {
    const { emoteStaticMode = false } = options;

    function updateDOM() {
      bodiesWithTimers.current.forEach((obj) => {
        const { body, el, sizeX, sizeY } = obj;
        if (!body || !el) return;

        try {
          const pos = body.translation(); // { x, y }  ← replaces body.position
          const angle = body.rotation(); // radians    ← replaces body.angle

          const x = pos.x - sizeX / 2;
          const y = pos.y - sizeY / 2;

          if (emoteStaticMode) {
            el.style.transform = `translate(${x}px, ${y}px)`;
          } else {
            el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
          }
        } catch {
          // Body may have been removed from the world mid-frame; skip it.
        }
      });

      domRafId.current = requestAnimationFrame(updateDOM);
    }

    domRafId.current = requestAnimationFrame(updateDOM);
  }, []);

  const stopDOMUpdates = useCallback(() => {
    if (domRafId.current) {
      cancelAnimationFrame(domRafId.current);
      domRafId.current = null;
    }
  }, []);

  return {
    engineRef, // Rapier World — same ref name so callers need no changes
    startDOMUpdates,
    stopDOMUpdates,
  };
}
