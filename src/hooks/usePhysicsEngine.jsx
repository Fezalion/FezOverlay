import { useRef, useEffect } from "react";
import Matter from "matter-js";

export function usePhysicsEngine() {
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  const rafId = useRef(null);

  useEffect(() => {
    const engine = Matter.Engine.create();
    engineRef.current = engine;
    let world = engine.world;
    // Default: no gravity
    engine.gravity.y = 0;

    const wallThickness = 200;
    function createWalls(width, height) {
      return [
        Matter.Bodies.rectangle(
          -wallThickness / 2,
          height / 2,
          wallThickness,
          height,
          { isStatic: true }
        ),
        Matter.Bodies.rectangle(
          width + wallThickness / 2,
          height / 2,
          wallThickness,
          height,
          { isStatic: true }
        ),
        Matter.Bodies.rectangle(
          width / 2,
          -wallThickness / 2,
          width,
          wallThickness,
          { isStatic: true }
        ),
        Matter.Bodies.rectangle(
          width / 2,
          height + wallThickness / 2,
          width,
          wallThickness,
          { isStatic: true }
        ),
      ];
    }

    let width = window.innerWidth;
    let height = window.innerHeight;
    let walls = createWalls(width, height);
    Matter.World.add(world, walls);

    // Handle window resize
    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      // Remove old walls
      Matter.World.remove(world, walls);
      // Add new walls
      walls = createWalls(width, height);
      Matter.World.add(world, walls);
    }
    window.addEventListener("resize", handleResize);

    let runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      if (runnerRef.current) {
        Matter.Runner.stop(runnerRef.current);
      }
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current);
      }
      engineRef.current = null;
      runnerRef.current = null;
    };
  }, []);

  const startDOMUpdates = (bodiesWithTimers) => {
    function updateDOM() {
      bodiesWithTimers.current.forEach((obj) => {
        const { body, el, sizeX, sizeY } = obj;
        const x = body.position.x - sizeX / 2;
        const y = body.position.y - sizeY / 2;
        el.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
      });
      rafId.current = requestAnimationFrame(updateDOM);
    }
    rafId.current = requestAnimationFrame(updateDOM);
  };

  const stopDOMUpdates = () => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  return {
    engineRef,
    runnerRef,
    startDOMUpdates,
    stopDOMUpdates,
  };
}
