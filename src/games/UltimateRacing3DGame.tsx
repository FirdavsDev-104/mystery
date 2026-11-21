import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture } from '../game-engine/proceduralTextures';
import { createSportsCarGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function UltimateRacing3DGame({
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
  const [lap, setLap] = useState(1);
  const [speedKmh, setSpeedKmh] = useState(0);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const inputRef = useRef({ throttle: 0, steer: 0 });

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setLap(1);
    setSpeedKmh(0);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x0b1120,
      fogNear: 45,
      fogFar: 180,
      fov: 60,
    });

    addThreePointLights(scene, {
      skyColor: 0xfdba74,
      groundColor: 0x1e293b,
      isSoftwareGl,
      quality,
      shadowRange: 60,
    });

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(140, 48),
      new THREE.MeshStandardMaterial({ map: createGrassTexture(22), roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Circuit track ring (elliptical)
    const R_X = 48;
    const R_Z = 30;
    const trackGeo = new THREE.RingGeometry(0.78, 1.0, 64);
    const trackMesh = new THREE.Mesh(
      trackGeo,
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, side: THREE.DoubleSide }),
    );
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.scale.set(R_X * 1.12, R_Z * 1.12, 1);
    trackMesh.position.y = 0.03;
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Start/Finish line
    const finishLine = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.06, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc }),
    );
    finishLine.position.set(R_X * 0.98, 0.05, 0);
    scene.add(finishLine);

    const playerCar = createSportsCarGroup(0xef4444);
    playerCar.position.set(R_X * 0.98, 0, 4);
    scene.add(playerCar);

    // 2 AI Rival cars
    const rivals = [
      { car: createSportsCarGroup(0x3b82f6), angle: 0.15, rScale: 0.94, speed: 0.42 },
      { car: createSportsCarGroup(0xf59e0b), angle: 0.35, rScale: 1.04, speed: 0.38 },
    ];
    rivals.forEach((r) => scene.add(r.car));

    let carAngle = 0;
    let radialOffset = 0;
    let forwardSpeed = 0;
    let lapsCompleted = 0;
    let lastQuarter = 0;

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
        const px = Math.cos(carAngle) * (R_X + radialOffset);
        const pz = -Math.sin(carAngle) * (R_Z + radialOffset);
        playerCar.position.set(px, 0, pz);

        const tangentX = -Math.sin(carAngle) * R_X;
        const tangentZ = -Math.cos(carAngle) * R_Z;
        const heading = Math.atan2(-tangentX, -tangentZ);
        playerCar.rotation.y = heading;

        const camDist = 9.5;
        const targetCam = new THREE.Vector3(
          px + Math.sin(heading) * camDist,
          4.2,
          pz + Math.cos(heading) * camDist,
        );
        camera.position.lerp(targetCam, 1 - Math.exp(-9 * dt));
        camera.lookAt(px, 1.1, pz);

        // Dynamic FOV on speed
        const desiredFov = 58 + Math.min(14, (forwardSpeed / 40) * 14);
        if (Math.abs(camera.fov - desiredFov) > 0.2) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFov, 0.1);
          camera.updateProjectionMatrix();
        }

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        // Rival cars
        rivals.forEach((r) => {
          r.angle += r.speed * dt;
          const rx = Math.cos(r.angle) * R_X * r.rScale;
          const rz = -Math.sin(r.angle) * R_Z * r.rScale;
          r.car.position.set(rx, 0, rz);
          r.car.rotation.y = Math.atan2(Math.sin(r.angle) * R_X, Math.cos(r.angle) * R_Z);
        });

        let throttle = inputRef.current.throttle;
        let steer = inputRef.current.steer;
        if (keys['ArrowUp'] || keys['KeyW']) throttle += 1;
        if (keys['ArrowDown'] || keys['KeyS']) throttle -= 1;
        if (keys['ArrowLeft'] || keys['KeyA']) steer -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) steer += 1;

        if (throttle > 0) forwardSpeed += 26 * dt;
        else if (throttle < 0) forwardSpeed -= 32 * dt;
        else forwardSpeed *= Math.exp(-1.5 * dt);

        forwardSpeed = THREE.MathUtils.clamp(forwardSpeed, 0, 42);
        const onGrass = Math.abs(radialOffset) > 5.5;
        if (onGrass) forwardSpeed = Math.min(forwardSpeed, 18);

        setSpeedKmh(Math.round(forwardSpeed * 6.5));

        radialOffset = THREE.MathUtils.clamp(radialOffset + steer * 9 * dt * (forwardSpeed > 2 ? 1 : 0.3), -8, 8);
        carAngle += (forwardSpeed / 36) * dt * 0.72;

        // Score & Lap tracking
        if (forwardSpeed > 4) {
          scoreRef.current += Math.round(forwardSpeed * dt * 1.2);
          setScore(scoreRef.current);
          onScoreUpdate(scoreRef.current);
        }

        const normAngle = ((carAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const quarter = Math.floor((normAngle / (Math.PI * 2)) * 4);
        if (lastQuarter === 3 && quarter === 0) {
          lapsCompleted += 1;
          soundEngine.playCollect();
          scoreRef.current += 150;
          setScore(scoreRef.current);
          onScoreUpdate(scoreRef.current);
          if (lapsCompleted >= 3) {
            soundEngine.playSuccess();
            setPhase('ended');
            onGameComplete(scoreRef.current, true);
          } else {
            setLap(lapsCompleted + 1);
          }
        }
        lastQuarter = quarter;
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
      endMessage={`3 ta aylana muvaffaqiyatli yakunlandi! Ball: ${score}`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setLap(1);
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Aylana</div>
            <div className="font-mono-num text-sm font-bold text-white leading-none">{lap} / 3</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Tezlik</div>
            <div className="font-mono-num text-sm font-bold text-amber-400 leading-none">{speedKmh} km/h</div>
          </div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto flex justify-between w-full px-2">
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => (inputRef.current.steer = -1)}
              onPointerUp={() => (inputRef.current.steer = 0)}
              className="w-16 h-12 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={() => (inputRef.current.steer = 1)}
              onPointerUp={() => (inputRef.current.steer = 0)}
              className="w-16 h-12 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              →
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => (inputRef.current.throttle = -1)}
              onPointerUp={() => (inputRef.current.throttle = 0)}
              className="px-4 h-12 rounded-xl bg-rose-500/80 text-white font-bold text-xs"
            >
              Tormoz
            </button>
            <button
              type="button"
              onPointerDown={() => (inputRef.current.throttle = 1)}
              onPointerUp={() => (inputRef.current.throttle = 0)}
              className="px-5 h-12 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              Gaz
            </button>
          </div>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
