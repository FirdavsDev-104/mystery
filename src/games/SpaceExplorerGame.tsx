import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createAirplaneGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function SpaceExplorerGame({
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
  const [cellsCollected, setCellsCollected] = useState(0);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const moveRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setCellsCollected(0);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x050814,
      fogNear: 50,
      fogFar: 180,
      fov: 60,
    });
    camera.position.set(0, 3.2, 8.5);
    camera.lookAt(0, 0, -10);

    addThreePointLights(scene, {
      skyColor: 0x60a5fa,
      groundColor: 0x1e1b4b,
      isSoftwareGl,
      quality,
    });

    // Instanced starfield
    const starGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const stars = new THREE.InstancedMesh(starGeo, starMat, 140);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 140; i++) {
      dummy.position.set((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 55, -Math.random() * 140);
      dummy.updateMatrix();
      stars.setMatrixAt(i, dummy.matrix);
    }
    stars.computeBoundingSphere();
    scene.add(stars);

    // Distant planet with ring
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.6 }),
    );
    planet.position.set(-24, 12, -85);
    const pRing = new THREE.Mesh(
      new THREE.TorusGeometry(13, 0.7, 8, 36),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 }),
    );
    pRing.rotation.x = Math.PI / 2.6;
    planet.add(pRing);
    scene.add(planet);

    const ship = createAirplaneGroup(0x22d3ee);
    ship.scale.setScalar(0.55);
    scene.add(ship);

    interface SpaceObj {
      mesh: THREE.Mesh;
      kind: 'cell' | 'asteroid';
    }
    const objects: SpaceObj[] = [];
    const cellGeo = new THREE.OctahedronGeometry(0.65, 0);
    const cellMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.9 });
    const astGeo = new THREE.DodecahedronGeometry(0.95, 0);
    const astMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });

    const spawnSpaceObj = (zPos: number) => {
      const isCell = Math.random() < 0.55;
      const m = new THREE.Mesh(isCell ? cellGeo : astGeo, isCell ? cellMat : astMat);
      m.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, zPos);
      scene.add(m);
      objects.push({ mesh: m, kind: isCell ? 'cell' : 'asteroid' });
    };

    for (let i = 1; i <= 14; i++) spawnSpaceObj(-i * 9 - 12);

    let cells = 0;
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
      (dt) => {
        planet.rotation.y += dt * 0.1;
        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        let mx = moveRef.current.x;
        let my = moveRef.current.y;
        if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) my += 1;
        if (keys['ArrowDown'] || keys['KeyS']) my -= 1;

        ship.position.x = THREE.MathUtils.clamp(ship.position.x + mx * 11 * dt, -7.5, 7.5);
        ship.position.y = THREE.MathUtils.clamp(ship.position.y + my * 8 * dt, -4, 4.5);
        ship.rotation.z = THREE.MathUtils.damp(ship.rotation.z, -mx * 0.5, 8, dt);
        ship.rotation.x = THREE.MathUtils.damp(ship.rotation.x, my * 0.35, 8, dt);

        const speed = 24;
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          obj.mesh.position.z += speed * dt;
          obj.mesh.rotation.y += dt * 1.5;

          if (obj.mesh.position.distanceTo(ship.position) < 1.55) {
            if (obj.kind === 'cell') {
              soundEngine.playCollect();
              cells += 1;
              setCellsCollected(cells);
              scoreRef.current += 30;
              setScore(scoreRef.current);
              onScoreUpdate(scoreRef.current);
              if (cells >= 10) {
                soundEngine.playSuccess();
                setPhase('ended');
                onGameComplete(scoreRef.current, true);
              }
            } else {
              soundEngine.playError();
              scoreRef.current = Math.max(0, scoreRef.current - 15);
              setScore(scoreRef.current);
              onScoreUpdate(scoreRef.current);
            }
            scene.remove(obj.mesh);
            objects.splice(i, 1);
            spawnSpaceObj(-120);
            continue;
          }

          if (obj.mesh.position.z > 10) {
            scene.remove(obj.mesh);
            objects.splice(i, 1);
            spawnSpaceObj(-120);
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
      endMessage="Siz kosmik sektorda 10 ta energiya kapsulasini muvaffaqiyatli yig'dingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setCellsCollected(0);
        setPhase('playing');
      }}
      extraHud={
        <div className="border-l border-white/15 pl-4">
          <div className="text-[11px] text-slate-400 leading-none mb-1">Kapsulalar</div>
          <div className="font-mono-num text-sm font-bold text-cyan-300 leading-none">{cellsCollected} / 10</div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto grid grid-cols-3 gap-1 w-40">
          <div />
          <button
            type="button"
            onPointerDown={() => (moveRef.current.y = 1)}
            onPointerUp={() => (moveRef.current.y = 0)}
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
            onPointerDown={() => (moveRef.current.y = -1)}
            onPointerUp={() => (moveRef.current.y = 0)}
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
