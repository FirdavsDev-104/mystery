import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture, createWoodTexture } from '../game-engine/proceduralTextures';
import { createTreeGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function MevalarSarguzashtiGame({
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
  const [timeLeft, setTimeLeft] = useState(45);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const moveDirRef = useRef(0);
  const scoreRef = useRef(0);
  const timeRef = useRef(45);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(45);
    timeRef.current = 45;
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0xfde68a,
      fogNear: 25,
      fogFar: 90,
      fov: 50,
    });
    camera.position.set(0, 6.2, 13.5);
    camera.lookAt(0, 3.2, 0);

    addThreePointLights(scene, {
      skyColor: 0xfef3c7,
      groundColor: 0x365314,
      isSoftwareGl,
      quality,
    });

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(35, 32),
      new THREE.MeshStandardMaterial({ map: createGrassTexture(8), roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    [-7.5, 7.5].forEach((tx) => {
      const t = createTreeGroup(1.6, 0x16a34a);
      t.position.set(tx, 0, -4);
      scene.add(t);
    });

    // 3D Wooden Basket (composite 4-part group)
    const basket = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: createWoodTexture('#b45309'), roughness: 0.75 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.85, 1.0, 16), woodMat);
    base.position.y = 0.5;
    base.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 10, 20), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.0;
    basket.add(base, rim);
    scene.add(basket);

    const fruitDefs = [
      { color: 0xef4444, pts: 10 }, // Olma
      { color: 0xfacc15, pts: 15 }, // Banan/Limon
      { color: 0xf97316, pts: 10 }, // Apelsin
      { color: 0xa855f7, pts: 20 }, // Olxo'ri
    ];

    interface FallingFruit {
      group: THREE.Group;
      speed: number;
      pts: number;
    }

    const fruits: FallingFruit[] = [];
    let spawnTimer = 0;

    const spawnFruit = () => {
      const def = fruitDefs[Math.floor(Math.random() * fruitDefs.length)];
      const grp = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 14, 14),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.35 }),
      );
      body.castShadow = true;
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.08, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x22c55e }),
      );
      leaf.position.set(0.1, 0.48, 0);
      grp.add(body, leaf);
      grp.position.set((Math.random() - 0.5) * 11, 9.5, 0);
      scene.add(grp);
      fruits.push({ group: grp, speed: 3.4 + Math.random() * 2.1, pts: def.pts });
    };

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    let secAcc = 0;

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt) => {
        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        secAcc += dt;
        if (secAcc >= 1) {
          secAcc -= 1;
          timeRef.current = Math.max(0, timeRef.current - 1);
          setTimeLeft(timeRef.current);
          if (timeRef.current === 0) {
            soundEngine.playSuccess();
            setPhase('ended');
            onGameComplete(scoreRef.current, true);
            return;
          }
        }

        let dir = moveDirRef.current;
        if (keys['ArrowLeft'] || keys['KeyA']) dir -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) dir += 1;
        basket.position.x = THREE.MathUtils.clamp(basket.position.x + dir * 10 * dt, -6.2, 6.2);

        spawnTimer += dt;
        if (spawnTimer >= 0.85) {
          spawnTimer = 0;
          spawnFruit();
        }

        for (let i = fruits.length - 1; i >= 0; i--) {
          const f = fruits[i];
          f.group.position.y -= f.speed * dt;
          f.group.rotation.y += dt * 2.2;

          if (
            f.group.position.y <= 1.3 &&
            f.group.position.y >= 0.4 &&
            Math.abs(f.group.position.x - basket.position.x) < 1.35
          ) {
            soundEngine.playCollect();
            scoreRef.current += f.pts;
            setScore(scoreRef.current);
            onScoreUpdate(scoreRef.current);
            scene.remove(f.group);
            fruits.splice(i, 1);
          } else if (f.group.position.y < -0.5) {
            scene.remove(f.group);
            fruits.splice(i, 1);
          }
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
      endMessage={`45 soniyada ${score} ballik meva yig'dingiz!`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setTimeLeft(45);
        timeRef.current = 45;
        setPhase('playing');
      }}
      extraHud={
        <div className="border-l border-white/15 pl-4">
          <div className="text-[11px] text-slate-400 leading-none mb-1">Vaqt</div>
          <div className="font-mono-num text-sm font-bold text-amber-300 leading-none">{timeLeft}s</div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto flex justify-between w-full px-2">
          <button
            type="button"
            onPointerDown={() => (moveDirRef.current = -1)}
            onPointerUp={() => (moveDirRef.current = 0)}
            onPointerLeave={() => (moveDirRef.current = 0)}
            className="w-20 h-14 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold text-lg active:bg-amber-500 active:text-slate-950"
          >
            ← Chap
          </button>
          <button
            type="button"
            onPointerDown={() => (moveDirRef.current = 1)}
            onPointerUp={() => (moveDirRef.current = 0)}
            onPointerLeave={() => (moveDirRef.current = 0)}
            className="w-20 h-14 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold text-lg active:bg-amber-500 active:text-slate-950"
          >
            O&apos;ng →
          </button>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
