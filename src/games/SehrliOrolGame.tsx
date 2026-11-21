import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture, createWoodTexture } from '../game-engine/proceduralTextures';
import { createRobotGroup, createTreeGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function SehrliOrolGame({
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
  const [crystalsFound, setCrystalsFound] = useState(0);

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
    setCrystalsFound(0);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x38bdf8,
      fogNear: 35,
      fogFar: 120,
      fov: 54,
    });

    addThreePointLights(scene, {
      skyColor: 0xe0f2fe,
      groundColor: 0x065f46,
      isSoftwareGl,
      quality,
    });

    // Water plane
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(90, 36),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.35 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.6;
    scene.add(water);

    // Floating islands
    const platforms: { x: number; z: number; rx: number; rz: number; y: number }[] = [
      { x: 0, z: 0, rx: 6, rz: 6, y: 0 },
      { x: 0, z: -11, rx: 5, rz: 5, y: 0.5 },
      { x: 11, z: -11, rx: 4.5, rz: 4.5, y: 0.8 },
      { x: -11, z: -11, rx: 4.5, rz: 4.5, y: 0.8 },
      { x: 0, z: -22, rx: 5.5, rz: 5.5, y: 1.2 },
    ];

    const grassMat = new THREE.MeshStandardMaterial({ map: createGrassTexture(4), roughness: 0.85 });
    const bridgeMat = new THREE.MeshStandardMaterial({ map: createWoodTexture('#b45309'), roughness: 0.75 });

    platforms.forEach((p, idx) => {
      const island = new THREE.Mesh(new THREE.BoxGeometry(p.rx * 2, 1.4, p.rz * 2), grassMat);
      island.position.set(p.x, p.y - 0.7, p.z);
      island.receiveShadow = true;
      scene.add(island);
      if (idx > 0) {
        const tree = createTreeGroup(1.0);
        tree.position.set(p.x + 2.2, p.y, p.z - 2.2);
        scene.add(tree);
      }
    });

    // Bridges connecting islands
    const bridges = [
      { x: 0, z: -5.5, w: 2.6, l: 4.5, y: 0.25 },
      { x: 5.5, z: -11, w: 4.5, l: 2.6, y: 0.65 },
      { x: -5.5, z: -11, w: 4.5, l: 2.6, y: 0.65 },
      { x: 0, z: -16.5, w: 2.6, l: 4.5, y: 0.95 },
    ];
    bridges.forEach((b) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.35, b.l), bridgeMat);
      m.position.set(b.x, b.y - 0.17, b.z);
      m.receiveShadow = true;
      scene.add(m);
    });

    // Explorer character
    const hero = createRobotGroup(0x10b981);
    hero.scale.setScalar(0.75);
    hero.position.set(0, 0, 2);
    scene.add(hero);

    // 5 Magical Crystals
    const crystalGeo = new THREE.OctahedronGeometry(0.6, 0);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.7,
      roughness: 0.1,
      clearcoat: 1,
    });
    const crystalPositions: [number, number, number][] = [
      [0, 1.2, -3],
      [0, 1.7, -11],
      [11, 2.0, -11],
      [-11, 2.0, -11],
      [0, 2.4, -22],
    ];
    const crystals = crystalPositions.map(([x, y, z]) => {
      const m = new THREE.Mesh(crystalGeo, crystalMat);
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    });

    let velY = 0;
    let found = 0;
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

    const getFloorHeight = (x: number, z: number): number | null => {
      for (const p of platforms) {
        if (Math.abs(x - p.x) <= p.rx && Math.abs(z - p.z) <= p.rz) return p.y;
      }
      for (const b of bridges) {
        if (Math.abs(x - b.x) <= b.w / 2 + 0.3 && Math.abs(z - b.z) <= b.l / 2 + 0.3) return b.y;
      }
      return null;
    };

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt, elapsed) => {
        crystals.forEach((c, idx) => {
          if (c.visible) {
            c.rotation.y += dt * 2;
            c.position.y += Math.sin(elapsed * 3 + idx) * 0.004;
          }
        });

        const camTargetPos = new THREE.Vector3(hero.position.x, hero.position.y + 6.5, hero.position.z + 9.5);
        camera.position.lerp(camTargetPos, 1 - Math.exp(-6 * dt));
        camera.lookAt(hero.position.x, hero.position.y + 1.2, hero.position.z - 2);

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        let mx = moveRef.current.x;
        let mz = moveRef.current.z;
        if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) mz -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) mz += 1;

        const nextX = hero.position.x + mx * 7.5 * dt;
        const nextZ = hero.position.z + mz * 7.5 * dt;
        const floorH = getFloorHeight(nextX, nextZ);

        if (floorH !== null) {
          hero.position.x = nextX;
          hero.position.z = nextZ;
          if (jumpRef.current && Math.abs(hero.position.y - floorH) < 0.08) {
            velY = 6.5;
            soundEngine.playJump();
          }
          jumpRef.current = false;
          velY -= 16 * dt;
          hero.position.y += velY * dt;
          if (hero.position.y <= floorH) {
            hero.position.y = floorH;
            velY = 0;
          }
        } else {
          jumpRef.current = false;
        }

        if (mx !== 0 || mz !== 0) {
          hero.rotation.y = Math.atan2(-mx, -mz);
        }

        crystals.forEach((c) => {
          if (c.visible && hero.position.distanceTo(c.position) < 1.8) {
            c.visible = false;
            found += 1;
            setCrystalsFound(found);
            soundEngine.playCollect();
            scoreRef.current += 40;
            setScore(scoreRef.current);
            onScoreUpdate(scoreRef.current);
            if (found >= 5) {
              soundEngine.playSuccess();
              setPhase('ended');
              onGameComplete(scoreRef.current, true);
            }
          }
        });
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
      endMessage="Siz Sehrli Oroldagi barcha 5 ta kristallni topdingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setCrystalsFound(0);
        setPhase('playing');
      }}
      extraHud={
        <div className="border-l border-white/15 pl-4">
          <div className="text-[11px] text-slate-400 leading-none mb-1">Kristallar</div>
          <div className="font-mono-num text-sm font-bold text-purple-300 leading-none">{crystalsFound} / 5</div>
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
            className="px-5 h-12 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm"
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
