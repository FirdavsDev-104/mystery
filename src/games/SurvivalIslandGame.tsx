import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture, createWoodTexture } from '../game-engine/proceduralTextures';
import { createRobotGroup, createTreeGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function SurvivalIslandGame({
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
  const [wood, setWood] = useState(0);
  const [stone, setStone] = useState(0);
  const [shelterBuilt, setShelterBuilt] = useState(false);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const woodRef = useRef(0);
  const stoneRef = useRef(0);
  const moveRef = useRef({ x: 0, z: 0 });
  const buildTriggerRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setWood(0);
    woodRef.current = 0;
    setStone(0);
    stoneRef.current = 0;
    setShelterBuilt(false);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x38bdf8,
      fogNear: 35,
      fogFar: 120,
      fov: 52,
    });

    addThreePointLights(scene, { isSoftwareGl, quality });

    const ocean = new THREE.Mesh(
      new THREE.CircleGeometry(90, 36),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.3 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.3;
    scene.add(ocean);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(18, 21, 1.2, 24),
      new THREE.MeshStandardMaterial({ map: createGrassTexture(7), roughness: 0.9 }),
    );
    island.position.y = -0.5;
    island.receiveShadow = true;
    scene.add(island);

    // Decorative trees
    [
      [-9, -8],
      [9, -9],
      [-10, 8],
      [10, 7],
    ].forEach(([tx, tz]) => {
      const t = createTreeGroup(1.2);
      t.position.set(tx, 0.1, tz);
      scene.add(t);
    });

    const survivor = createRobotGroup(0x10b981);
    survivor.scale.setScalar(0.78);
    survivor.position.set(0, 0.1, 4);
    scene.add(survivor);

    // Resource nodes
    interface ResNode {
      mesh: THREE.Mesh;
      kind: 'wood' | 'stone';
    }
    const nodes: ResNode[] = [];
    const woodGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.1, 10);
    const woodMat = new THREE.MeshStandardMaterial({ map: createWoodTexture('#854d0e'), roughness: 0.8 });
    const stoneGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 6 + (i % 2) * 4;
      const isWood = i % 2 === 0;
      const m = new THREE.Mesh(isWood ? woodGeo : stoneGeo, isWood ? woodMat : stoneMat);
      m.position.set(Math.cos(angle) * r, 0.6, Math.sin(angle) * r);
      m.castShadow = true;
      scene.add(m);
      nodes.push({ mesh: m, kind: isWood ? 'wood' : 'stone' });
    }

    // Shelter (hidden until crafted)
    const shelter = new THREE.Group();
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 3.5), woodMat);
    cabin.position.y = 1.1;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.95;
    shelter.add(cabin, roof);
    shelter.position.set(0, 0.1, -3);
    shelter.visible = false;
    scene.add(shelter);

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'KeyE') buildTriggerRef.current = true;
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
        camera.position.lerp(new THREE.Vector3(survivor.position.x, 8.5, survivor.position.z + 11.5), 1 - Math.exp(-6 * dt));
        camera.lookAt(survivor.position.x, 1, survivor.position.z);

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        let mx = moveRef.current.x;
        let mz = moveRef.current.z;
        if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) mz -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) mz += 1;

        const nextX = survivor.position.x + mx * 7.5 * dt;
        const nextZ = survivor.position.z + mz * 7.5 * dt;
        if (Math.hypot(nextX, nextZ) < 15.5) {
          survivor.position.x = nextX;
          survivor.position.z = nextZ;
        }
        if (mx !== 0 || mz !== 0) survivor.rotation.y = Math.atan2(-mx, -mz);

        nodes.forEach((n) => {
          if (n.mesh.visible && survivor.position.distanceTo(n.mesh.position) < 1.6) {
            n.mesh.visible = false;
            soundEngine.playCollect();
            if (n.kind === 'wood') {
              woodRef.current += 1;
              setWood(woodRef.current);
            } else {
              stoneRef.current += 1;
              setStone(stoneRef.current);
            }
            scoreRef.current += 25;
            setScore(scoreRef.current);
            onScoreUpdate(scoreRef.current);
          }
        });

        if (buildTriggerRef.current) {
          buildTriggerRef.current = false;
          if (!shelter.visible && woodRef.current >= 3 && stoneRef.current >= 3) {
            shelter.visible = true;
            setShelterBuilt(true);
            soundEngine.playSuccess();
            scoreRef.current += 100;
            setScore(scoreRef.current);
            onScoreUpdate(scoreRef.current);
            setPhase('ended');
            onGameComplete(scoreRef.current, true);
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

  const canBuild = wood >= 3 && stone >= 3 && !shelterBuilt;

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
      endMessage="Siz orolda resurslar yig'ib, xavfsiz boshpana qurdingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setWood(0);
        woodRef.current = 0;
        setStone(0);
        stoneRef.current = 0;
        setShelterBuilt(false);
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-3 border-l border-white/15 pl-4 text-xs font-semibold">
          <span className="text-amber-300 font-mono-num">Yog&apos;och: {wood}/3</span>
          <span className="text-slate-300 font-mono-num">Tosh: {stone}/3</span>
          {canBuild && (
            <button
              type="button"
              onClick={() => (buildTriggerRef.current = true)}
              className="pointer-events-auto px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-bold cursor-pointer"
            >
              Boshpana qurish (E)
            </button>
          )}
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
          {canBuild && (
            <button
              type="button"
              onClick={() => (buildTriggerRef.current = true)}
              className="px-4 h-12 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
            >
              Boshpana qurish
            </button>
          )}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
