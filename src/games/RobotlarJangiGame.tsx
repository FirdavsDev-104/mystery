import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGridFloorTexture } from '../game-engine/proceduralTextures';
import { createRobotGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function RobotlarJangiGame({
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
  const scoreRef = useRef(0);
  const timeRef = useRef(45);
  const moveInputRef = useRef({ x: 0, z: 0 });
  const fireTriggerRef = useRef(false);

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
      skyColor: 0x0f172a,
      fogNear: 25,
      fogFar: 95,
      fov: 52,
    });
    camera.position.set(0, 12, 16);
    camera.lookAt(0, 1, 0);

    addThreePointLights(scene, { isSoftwareGl, quality });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture('#0f172a', '#1e40af', 12), roughness: 0.65 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const playerBot = createRobotGroup(0x3b82f6);
    playerBot.position.set(0, 0, 6);
    scene.add(playerBot);

    // Friendly target drones
    interface TargetDrone {
      group: THREE.Group;
      velX: number;
      baseZ: number;
    }
    const drones: TargetDrone[] = [];

    const spawnDrone = () => {
      const grp = createRobotGroup(0xf59e0b);
      grp.scale.setScalar(0.85);
      const z = -9 + Math.random() * 6;
      grp.position.set((Math.random() - 0.5) * 14, 0.2, z);
      scene.add(grp);
      drones.push({ group: grp, velX: (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 2.5), baseZ: z });
    };

    for (let i = 0; i < 4; i++) spawnDrone();

    const orbs: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
    const orbGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.4 });

    const fireOrb = () => {
      const m = new THREE.Mesh(orbGeo, orbMat);
      m.position.copy(playerBot.position).add(new THREE.Vector3(0, 1.35, -0.8));
      scene.add(m);
      orbs.push({ mesh: m, vel: new THREE.Vector3(0, 0, -24) });
      soundEngine.playJump();
    };

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'Space' && phaseRef.current === 'playing' && !pausedRef.current) {
        e.preventDefault();
        fireOrb();
      }
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
      (dt, elapsed) => {
        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        if (fireTriggerRef.current) {
          fireTriggerRef.current = false;
          fireOrb();
        }

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

        let mx = moveInputRef.current.x;
        let mz = moveInputRef.current.z;
        if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) mz -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) mz += 1;

        playerBot.position.x = THREE.MathUtils.clamp(playerBot.position.x + mx * 9 * dt, -9, 9);
        playerBot.position.z = THREE.MathUtils.clamp(playerBot.position.z + mz * 9 * dt, 0, 10);

        drones.forEach((d, idx) => {
          d.group.position.x += d.velX * dt;
          if (Math.abs(d.group.position.x) > 8.5) d.velX *= -1;
          d.group.position.y = 0.25 + Math.sin(elapsed * 3 + idx) * 0.2;
        });

        for (let i = orbs.length - 1; i >= 0; i--) {
          const o = orbs[i];
          o.mesh.position.addScaledVector(o.vel, dt);

          let hit = false;
          for (let j = drones.length - 1; j >= 0; j--) {
            const d = drones[j];
            if (o.mesh.position.distanceTo(d.group.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < 1.35) {
              soundEngine.playCollect();
              scoreRef.current += 30;
              setScore(scoreRef.current);
              onScoreUpdate(scoreRef.current);
              d.group.position.set((Math.random() - 0.5) * 14, 0.2, -9 + Math.random() * 5);
              hit = true;
              break;
            }
          }

          if (hit || o.mesh.position.z < -20) {
            scene.remove(o.mesh);
            orbs.splice(i, 1);
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
      endMessage={`Robotlar arenasi yakunlandi! Yakuniy ball: ${score}`}
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
          <div className="font-mono-num text-sm font-bold text-cyan-300 leading-none">{timeLeft}s</div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto flex justify-between items-center w-full px-2">
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => (moveInputRef.current.x = -1)}
              onPointerUp={() => (moveInputRef.current.x = 0)}
              onPointerLeave={() => (moveInputRef.current.x = 0)}
              className="w-16 h-12 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={() => (moveInputRef.current.x = 1)}
              onPointerUp={() => (moveInputRef.current.x = 0)}
              onPointerLeave={() => (moveInputRef.current.x = 0)}
              className="w-16 h-12 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold"
            >
              →
            </button>
          </div>
          <button
            type="button"
            onClick={() => (fireTriggerRef.current = true)}
            className="px-5 h-12 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm"
          >
            Energiya shari
          </button>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
