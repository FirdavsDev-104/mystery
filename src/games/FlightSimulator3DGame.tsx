import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture } from '../game-engine/proceduralTextures';
import { createAirplaneGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function FlightSimulator3DGame({
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
  const [ringsCleared, setRingsCleared] = useState(0);
  const [altitude, setAltitude] = useState(25);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const inputRef = useRef({ pitch: 0, roll: 0 });

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setRingsCleared(0);
    setAltitude(25);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x38bdf8,
      fogNear: 50,
      fogFar: 220,
      fov: 60,
    });

    addThreePointLights(scene, {
      skyColor: 0xe0f2fe,
      groundColor: 0x1e3a8a,
      isSoftwareGl,
      quality,
    });

    // Ground & ocean landscape
    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.MeshStandardMaterial({ map: createGrassTexture(28), roughness: 0.9 }),
    );
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -22;
    scene.add(terrain);

    // Mountain peaks
    const peakMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(12 + (i % 4) * 4, 24 + (i % 3) * 8, 6), peakMat);
      const a = (i / 16) * Math.PI * 2;
      const dist = 65 + (i % 3) * 20;
      m.position.set(Math.cos(a) * dist, -10, Math.sin(a) * dist);
      scene.add(m);
    }

    const plane = createAirplaneGroup(0xf59e0b);
    plane.position.set(0, 6, 0);
    scene.add(plane);

    // 8 Sky Checkpoints
    const ringGeo = new THREE.TorusGeometry(4.2, 0.32, 12, 30);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.7 });
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const r = new THREE.Mesh(ringGeo, ringMat);
      r.position.set(Math.sin(i * 0.9) * 28, 6 + Math.cos(i * 0.8) * 6, -30 - i * 32);
      scene.add(r);
      rings.push(r);
    }

    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    let cleared = 0;

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
        const prop = plane.getObjectByName('propeller');
        if (prop) prop.rotation.z += dt * 28;

        const camBack = new THREE.Vector3(0, 3.2, 10.5).applyEuler(plane.rotation);
        camera.position.lerp(plane.position.clone().add(camBack), 1 - Math.exp(-7 * dt));
        camera.lookAt(plane.position);

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        let pIn = inputRef.current.pitch;
        let rIn = inputRef.current.roll;
        if (keys['ArrowUp'] || keys['KeyW']) pIn -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) pIn += 1;
        if (keys['ArrowLeft'] || keys['KeyA']) rIn += 1;
        if (keys['ArrowRight'] || keys['KeyD']) rIn -= 1;

        pitch = THREE.MathUtils.clamp(pitch + pIn * 1.1 * dt, -0.55, 0.55);
        roll = THREE.MathUtils.damp(roll, rIn * 0.65, 5, dt);
        yaw += roll * 0.9 * dt;

        plane.rotation.set(pitch, yaw, roll, 'YXZ');

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(plane.rotation);
        plane.position.addScaledVector(forward, 22 * dt);
        plane.position.y = THREE.MathUtils.clamp(plane.position.y, -16, 40);
        setAltitude(Math.round((plane.position.y + 22) * 12));

        rings.forEach((ring) => {
          if (ring.visible && plane.position.distanceTo(ring.position) < 5.2) {
            ring.visible = false;
            cleared += 1;
            setRingsCleared(cleared);
            soundEngine.playCollect();
            scoreRef.current += 50;
            setScore(scoreRef.current);
            onScoreUpdate(scoreRef.current);
            if (cleared >= 8) {
              soundEngine.playSuccess();
              setPhase('ended');
              onGameComplete(scoreRef.current + 100, true);
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
      endMessage="Siz barcha 8 ta osmon halqasidan muvaffaqiyatli uchib o'tdingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setRingsCleared(0);
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Halqalar</div>
            <div className="font-mono-num text-sm font-bold text-amber-300 leading-none">{ringsCleared} / 8</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Balandlik</div>
            <div className="font-mono-num text-sm font-bold text-cyan-300 leading-none">{altitude} m</div>
          </div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto grid grid-cols-3 gap-1 w-40">
          <div />
          <button
            type="button"
            onPointerDown={() => (inputRef.current.pitch = -1)}
            onPointerUp={() => (inputRef.current.pitch = 0)}
            className="h-10 rounded-lg bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
          >
            ↑
          </button>
          <div />
          <button
            type="button"
            onPointerDown={() => (inputRef.current.roll = 1)}
            onPointerUp={() => (inputRef.current.roll = 0)}
            className="h-10 rounded-lg bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
          >
            ←
          </button>
          <button
            type="button"
            onPointerDown={() => (inputRef.current.pitch = 1)}
            onPointerUp={() => (inputRef.current.pitch = 0)}
            className="h-10 rounded-lg bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
          >
            ↓
          </button>
          <button
            type="button"
            onPointerDown={() => (inputRef.current.roll = -1)}
            onPointerUp={() => (inputRef.current.roll = 0)}
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
