import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGridFloorTexture } from '../game-engine/proceduralTextures';
import { createSportsCarGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function CityDriver3DGame({
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
  const [speedKmh, setSpeedKmh] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const timeRef = useRef(60);
  const inputRef = useRef({ throttle: 0, steer: 0 });

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(60);
    timeRef.current = 60;
    setSpeedKmh(0);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x162032,
      fogNear: 40,
      fogFar: 160,
      fov: 58,
    });

    addThreePointLights(scene, {
      skyColor: 0x93c5fd,
      groundColor: 0x1e293b,
      isSoftwareGl,
      quality,
      shadowRange: 45,
    });

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture('#1e2430', '#334155', 28), roughness: 0.75 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // City blocks & buildings with colliders
    const buildings: { x: number; z: number; w: number; d: number }[] = [];
    const bColors = [0x334155, 0x1e293b, 0x475569, 0x0f172a];
    const winMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.35 });

    for (let gx = -3; gx <= 3; gx++) {
      for (let gz = -3; gz <= 3; gz++) {
        if (gx === 0 && gz === 0) continue;
        if (Math.abs(gx) % 2 === 1 && Math.abs(gz) % 2 === 1) {
          const w = 10;
          const d = 10;
          const h = 10 + ((Math.abs(gx * 7 + gz * 13)) % 18);
          const x = gx * 18;
          const z = gz * 18;
          const b = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: bColors[(Math.abs(gx + gz)) % bColors.length], roughness: 0.55 }),
          );
          b.position.set(x, h / 2, z);
          b.castShadow = true;
          b.receiveShadow = true;
          scene.add(b);

          const topBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.45, d + 0.1), winMat);
          topBand.position.set(x, h - 1.2, z);
          scene.add(topBand);

          buildings.push({ x, z, w, d });
        }
      }
    }

    const car = createSportsCarGroup(0x06b6d4);
    scene.add(car);

    // Checkpoint beacon
    const beaconGroup = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.22, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.1 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    beam.position.y = 7;
    beaconGroup.add(ring, beam);
    scene.add(beaconGroup);

    const placeBeacon = () => {
      const candidates = [
        [0, -36],
        [36, 0],
        [-36, 0],
        [0, 36],
        [36, -36],
        [-36, 36],
      ];
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      beaconGroup.position.set(pick[0], 0, pick[1]);
    };
    placeBeacon();

    let speed = 0;
    let heading = 0;
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => (keys[e.code] = true);
    const onKeyUp = (e: KeyboardEvent) => (keys[e.code] = false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    let secAcc = 0;

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt, elapsed) => {
        beaconGroup.rotation.y += dt * 1.5;
        ring.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08);

        const camOffset = new THREE.Vector3(Math.sin(heading) * 9.5, 4.4, Math.cos(heading) * 9.5);
        camera.position.lerp(car.position.clone().add(camOffset), 1 - Math.exp(-8 * dt));
        camera.lookAt(car.position.x, car.position.y + 1.3, car.position.z);

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

        let throttle = inputRef.current.throttle;
        let steer = inputRef.current.steer;
        if (keys['ArrowUp'] || keys['KeyW']) throttle += 1;
        if (keys['ArrowDown'] || keys['KeyS']) throttle -= 1;
        if (keys['ArrowLeft'] || keys['KeyA']) steer += 1;
        if (keys['ArrowRight'] || keys['KeyD']) steer -= 1;

        if (throttle !== 0) {
          speed += throttle * 22 * dt;
        } else {
          speed *= Math.exp(-2.2 * dt);
        }
        speed = THREE.MathUtils.clamp(speed, -14, 34);
        setSpeedKmh(Math.round(Math.abs(speed) * 3.8));

        if (Math.abs(speed) > 0.5) {
          heading += steer * 2.1 * dt * Math.sign(speed);
        }

        const nextX = THREE.MathUtils.clamp(car.position.x - Math.sin(heading) * speed * dt, -95, 95);
        const nextZ = THREE.MathUtils.clamp(car.position.z - Math.cos(heading) * speed * dt, -95, 95);

        let blocked = false;
        for (const b of buildings) {
          if (Math.abs(nextX - b.x) < b.w / 2 + 1.4 && Math.abs(nextZ - b.z) < b.d / 2 + 1.4) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          car.position.x = nextX;
          car.position.z = nextZ;
        } else {
          speed *= -0.35;
          soundEngine.playError();
        }
        car.rotation.y = heading;

        if (car.position.distanceTo(beaconGroup.position) < 3.6) {
          soundEngine.playCollect();
          scoreRef.current += 50;
          setScore(scoreRef.current);
          onScoreUpdate(scoreRef.current);
          timeRef.current = Math.min(75, timeRef.current + 6);
          setTimeLeft(timeRef.current);
          placeBeacon();
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
      endMessage={`Shahar bo'ylab sayohat yakunlandi! Jami ball: ${score}`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setTimeLeft(60);
        timeRef.current = 60;
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Tezlik</div>
            <div className="font-mono-num text-sm font-bold text-cyan-300 leading-none">{speedKmh} km/h</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Vaqt</div>
            <div className="font-mono-num text-sm font-bold text-amber-300 leading-none">{timeLeft}s</div>
          </div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto flex justify-between w-full px-2">
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => (inputRef.current.steer = 1)}
              onPointerUp={() => (inputRef.current.steer = 0)}
              className="w-16 h-12 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={() => (inputRef.current.steer = -1)}
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
              className="px-5 h-12 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
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
