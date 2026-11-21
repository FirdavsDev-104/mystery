import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createRobotGroup, createTreeGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

function groundHeightAt(x: number, z: number): number {
  return Math.sin(x * 0.08) * 1.4 + Math.cos(z * 0.08) * 1.4;
}

export default function OpenWorldExplorerGame({
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
  const [relics, setRelics] = useState(0);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const moveRef = useRef({ x: 0, z: 0 });

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setRelics(0);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x0f172a,
      fogNear: 35,
      fogFar: 135,
      fov: 55,
    });

    addThreePointLights(scene, {
      skyColor: 0x93c5fd,
      groundColor: 0x1e293b,
      isSoftwareGl,
      quality,
    });

    // Procedural displaced terrain mesh
    const terrainGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, groundHeightAt(vx, vz));
    }
    terrainGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.88 }),
    );
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Mountain lake
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(18, 32),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.12, metalness: 0.4 }),
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(16, -0.35, -14);
    scene.add(lake);

    // Trees across the valley
    for (let i = 0; i < 28; i++) {
      const tx = ((i * 37) % 100) - 50;
      const tz = ((i * 53) % 100) - 50;
      if (Math.hypot(tx - 16, tz + 14) < 19) continue;
      const t = createTreeGroup(1.0 + (i % 3) * 0.25, 0x1b4332);
      t.position.set(tx, groundHeightAt(tx, tz), tz);
      scene.add(t);
    }

    const explorer = createRobotGroup(0xf59e0b);
    explorer.scale.setScalar(0.8);
    explorer.position.set(0, groundHeightAt(0, 0), 0);
    scene.add(explorer);

    // 6 Ancient Artifacts
    const relicCoords: [number, number][] = [
      [18, 12],
      [-22, 16],
      [-28, -22],
      [28, -28],
      [0, -34],
      [-12, 32],
    ];
    const relicMeshes = relicCoords.map(([rx, rz]) => {
      const grp = new THREE.Group();
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.8, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 }),
      );
      pillar.position.y = 0.7;
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65, 0),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 }),
      );
      gem.position.y = 2.1;
      grp.add(pillar, gem);
      grp.position.set(rx, groundHeightAt(rx, rz), rz);
      grp.userData.collected = false;
      grp.userData.gem = gem;
      scene.add(grp);
      return grp;
    });

    let foundCount = 0;
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => (keys[e.code] = true);
    const onKeyUp = (e: KeyboardEvent) => (keys[e.code] = false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt, elapsed) => {
        relicMeshes.forEach((grp, idx) => {
          const gem = grp.userData.gem as THREE.Mesh;
          if (gem.visible) {
            gem.rotation.y += dt * 1.8;
            gem.position.y = 2.1 + Math.sin(elapsed * 2.5 + idx) * 0.2;
          }
        });

        const camTarget = new THREE.Vector3(explorer.position.x, explorer.position.y + 6.5, explorer.position.z + 10.5);
        camera.position.lerp(camTarget, 1 - Math.exp(-7 * dt));
        camera.lookAt(explorer.position.x, explorer.position.y + 1.2, explorer.position.z);

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        let mx = moveRef.current.x;
        let mz = moveRef.current.z;
        if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) mz -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) mz += 1;

        explorer.position.x = THREE.MathUtils.clamp(explorer.position.x + mx * 11 * dt, -55, 55);
        explorer.position.z = THREE.MathUtils.clamp(explorer.position.z + mz * 11 * dt, -55, 55);
        explorer.position.y = groundHeightAt(explorer.position.x, explorer.position.z);
        if (mx !== 0 || mz !== 0) explorer.rotation.y = Math.atan2(-mx, -mz);

        relicMeshes.forEach((grp) => {
          if (!grp.userData.collected && explorer.position.distanceTo(grp.position) < 2.4) {
            grp.userData.collected = true;
            (grp.userData.gem as THREE.Mesh).visible = false;
            foundCount += 1;
            setRelics(foundCount);
            soundEngine.playCollect();
            scoreRef.current += 50;
            setScore(scoreRef.current);
            onScoreUpdate(scoreRef.current);
            if (foundCount >= 6) {
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
      endMessage="Siz ochiq dunyo vodiysidagi barcha 6 ta artefaktni kashf etdingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setRelics(0);
        setPhase('playing');
      }}
      extraHud={
        <div className="border-l border-white/15 pl-4">
          <div className="text-[11px] text-slate-400 leading-none mb-1">Artefaktlar</div>
          <div className="font-mono-num text-sm font-bold text-cyan-300 leading-none">{relics} / 6</div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto grid grid-cols-3 gap-1 w-40">
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
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
