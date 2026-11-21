import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createRobotGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function ParkourMasterGame({
  game,
  quality,
  isPaused,
  restartToken,
  onScoreUpdate,
  onGameComplete,
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<GamePhase>('start');
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState(1);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const moveRef = useRef({ x: 0, z: 0 });
  const jumpRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setStage(1);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x0f172a,
      fogNear: 25,
      fogFar: 110,
      fov: 56,
    });

    addThreePointLights(scene, { isSoftwareGl, quality });

    const platDefs = [
      { x: 0, y: 0, z: 0, w: 5, d: 5, color: 0x334155 },
      { x: 0, y: 1.0, z: -7, w: 4, d: 4, color: 0x0ea5e9 },
      { x: 3.5, y: 2.2, z: -13.5, w: 3.6, d: 3.6, color: 0x0ea5e9 },
      { x: -2.5, y: 3.4, z: -20, w: 3.6, d: 3.6, color: 0x06b6d4 },
      { x: 2, y: 4.5, z: -26.5, w: 3.6, d: 3.6, color: 0x10b981 },
      { x: 0, y: 5.5, z: -34, w: 6, d: 6, color: 0xf59e0b },
    ];

    platDefs.forEach((p, idx) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, 0.8, p.d),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.45, metalness: 0.2 }),
      );
      m.position.set(p.x, p.y - 0.4, p.z);
      m.receiveShadow = true;
      scene.add(m);
      if (idx === platDefs.length - 1) {
        const crown = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.8, 0),
          new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.9 }),
        );
        crown.position.set(p.x, p.y + 1.5, p.z);
        scene.add(crown);
      }
    });

    const runner = createRobotGroup(0xf43f5e);
    runner.scale.setScalar(0.75);
    runner.position.set(0, 0, 0);
    scene.add(runner);

    let velY = 0;
    let grounded = true;
    let highestIdx = 0;

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'Space') jumpRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt) => {
        camera.position.lerp(new THREE.Vector3(runner.position.x, runner.position.y + 5.5, runner.position.z + 9), 1 - Math.exp(-7 * dt));
        camera.lookAt(runner.position.x, runner.position.y + 1.2, runner.position.z - 4);

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        let mx = moveRef.current.x;
        let mz = moveRef.current.z;
        if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) mz -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) mz += 1;

        runner.position.x += mx * 7.5 * dt;
        runner.position.z += mz * 7.5 * dt;
        if (mx !== 0 || mz !== 0) runner.rotation.y = Math.atan2(-mx, -mz);

        if (jumpRef.current && grounded) {
          velY = 9.2;
          grounded = false;
          soundEngine.playJump();
        }
        jumpRef.current = false;

        velY -= 20 * dt;
        runner.position.y += velY * dt;

        grounded = false;
        platDefs.forEach((p, idx) => {
          if (
            Math.abs(runner.position.x - p.x) <= p.w / 2 + 0.3 &&
            Math.abs(runner.position.z - p.z) <= p.d / 2 + 0.3 &&
            runner.position.y <= p.y + 0.1 &&
            runner.position.y >= p.y - 1.0 &&
            velY <= 0
          ) {
            runner.position.y = p.y;
            velY = 0;
            grounded = true;
            if (idx > highestIdx) {
              highestIdx = idx;
              setStage(idx + 1);
              scoreRef.current += 30;
              setScore(scoreRef.current);
              onScoreUpdate(scoreRef.current);
              soundEngine.playCollect();
              if (idx === platDefs.length - 1) {
                soundEngine.playSuccess();
                setPhase('ended');
                onGameComplete(scoreRef.current + 50, true);
              }
            }
          }
        });

        if (runner.position.y < -8) {
          soundEngine.playError();
          runner.position.set(0, 0.5, 0);
          velY = 0;
        }
      },
      pausedRef,
    );

    return () => {
      stopLoop();
      cleanupResize();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      disposeThreeScene(scene, renderer, pmremTexture);
    };
  }, [quality, restartToken]);

  return (
    <GameShell
      title={game.title}
      objective={game.objectiveText}
      controls={game.controlsText}
      phase={phase}
      score={score}
      scoreLabel="Ball"
      accentColor={game.accentColor}
      won={true}
      endMessage="Tabriklaymiz! Siz barcha parkour platformalarini zabt etdingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setStage(1);
        setPhase('playing');
      }}
      extraHud={
        <div className="border-l border-white/15 pl-4">
          <div className="text-[11px] text-slate-400 leading-none mb-1">Platforma</div>
          <div className="font-mono-num text-sm font-bold text-amber-300 leading-none">{stage} / 6</div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto flex justify-between items-end w-full px-2">
          <div className="grid grid-cols-3 gap-1 w-36">
            <div />
            <button
              type="button"
              onPointerDown={() => (moveRef.current.z = -1)}
              onPointerUp={() => (moveRef.current.z = 0)}
              className="h-10 rounded-lg bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              ↑
            </button>
            <div />
            <button
              type="button"
              onPointerDown={() => (moveRef.current.x = -1)}
              onPointerUp={() => (moveRef.current.x = 0)}
              className="h-10 rounded-lg bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={() => (moveRef.current.z = 1)}
              onPointerUp={() => (moveRef.current.z = 0)}
              className="h-10 rounded-lg bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              ↓
            </button>
            <button
              type="button"
              onPointerDown={() => (moveRef.current.x = 1)}
              onPointerUp={() => (moveRef.current.x = 0)}
              className="h-10 rounded-lg bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              →
            </button>
          </div>
          <button
            type="button"
            onClick={() => (jumpRef.current = true)}
            className="px-5 h-12 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm"
          >
            Sakrash
          </button>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
