import { useRef, useEffect } from 'react';
import Matter from 'matter-js';

export function usePhysicsEngine() {
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  const rafId = useRef(null);

  useEffect(() => {
    const engine = Matter.Engine.create();
    engineRef.current = engine;
    let world = engine.world;
    engine.gravity.y = 1;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const wallThickness = 200;
    const walls = [
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true
      }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true
      }),
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, {
        isStatic: true
      }),
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, {
        isStatic: true
      }),
    ];
    Matter.World.add(world, walls);

    let runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    return () => {
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
    stopDOMUpdates
  };
}