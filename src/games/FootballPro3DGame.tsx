import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createPitchTexture } from '../game-engine/proceduralTextures';
import { createRobotGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function FootballPro3DGame({
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
  const [goals, setGoals] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const timeRef = useRef(60);
  const moveRef = useRef({ x: 0, z: 0 });
  const kickRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setGoals(0);
    setTimeLeft(60);
    timeRef.current = 60;
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x0f172a,
      fogNear: 40,
      fogFar: 130,
      fov: 52,
    });

    addThreePointLights(scene, { isSoftwareGl, quality });

    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 52),
      new THREE.MeshStandardMaterial({ map: createPitchTexture(), roughness: 0.8 }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Goalposts
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.3 });
    const makeGoal = (zPos: number) => {
      const g = new THREE.Group();
      g.position.set(0, 0, zPos);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 10), postMat);
      l.position.set(-4.5, 1.6, 0);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 10), postMat);
      r.position.set(4.5, 1.6, 0);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 9.2, 10), postMat);
      c.rotation.z = Math.PI / 2;
      c.position.set(0, 3.2, 0);
      g.add(l, r, c);
      scene.add(g);
    };
    makeGoal(-23);
    makeGoal(23);

    const striker = createRobotGroup(0x2563eb);
    striker.scale.setScalar(0.8);
    striker.position.set(0, 0, 8);
    scene.add(striker);

    const keeper = createRobotGroup(0xef4444);
    keeper.scale.setScalar(0.85);
    keeper.position.set(0, 0, -21.5);
    scene.add(keeper);

    const defender = createRobotGroup(0xef4444);
    defender.scale.setScalar(0.8);
    defender.position.set(3, 0, -6);
    scene.add(defender);

    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
    );
    ball.position.set(0, 0.42, 4);
    ball.castShadow = true;
    scene.add(ball);

    const ballVel = new THREE.Vector3();
    let goalCount = 0;

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'Space') kickRef.current = true;
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
        const camPos = new THREE.Vector3(striker.position.x * 0.5, 11, striker.position.z + 14);
        camera.position.lerp(camPos, 1 - Math.exp(-6 * dt));
        camera.lookAt(ball.position.x * 0.5, 1, ball.position.z - 6);

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        secAcc += dt;
        if (secAcc >= 1) {
          secAcc -= 1;
          timeRef.current = Math.max(0, timeRef.current - 1);
          setTimeLeft(timeRef.current);
          if (timeRef.current === 0) {
            soundEngine.playSuccess();
            setPhase('ended');
            onGameComplete(scoreRef.current, goalCount >= 1);
            return;
          }
        }

        let mx = moveRef.current.x;
        let mz = moveRef.current.z;
        if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) mz -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) mz += 1;

        striker.position.x = THREE.MathUtils.clamp(striker.position.x + mx * 10 * dt, -14, 14);
        striker.position.z = THREE.MathUtils.clamp(striker.position.z + mz * 10 * dt, -22, 22);
        if (mx !== 0 || mz !== 0) striker.rotation.y = Math.atan2(-mx, -mz);

        keeper.position.x = Math.sin(elapsed * 2.2) * 3.5;
        defender.position.x = Math.cos(elapsed * 1.4) * 6.5;

        // Dribble / push ball
        const distToBall = striker.position.distanceTo(new THREE.Vector3(ball.position.x, 0, ball.position.z));
        if (distToBall < 1.35) {
          const pushDir = new THREE.Vector3(
            ball.position.x - striker.position.x,
            0,
            ball.position.z - striker.position.z,
          ).normalize();
          if (kickRef.current) {
            soundEngine.playJump();
            ballVel.set(pushDir.x * 22, 3.2, -24);
            kickRef.current = false;
          } else {
            ballVel.x = pushDir.x * 8;
            ballVel.z = pushDir.z * 8;
          }
        } else {
          kickRef.current = false;
        }

        // Defender block
        if (defender.position.distanceTo(new THREE.Vector3(ball.position.x, 0, ball.position.z)) < 1.2) {
          ballVel.z = Math.abs(ballVel.z) + 5;
          soundEngine.playError();
        }
        // Keeper block
        if (keeper.position.distanceTo(new THREE.Vector3(ball.position.x, 0, ball.position.z)) < 1.25) {
          ballVel.z = 8;
          soundEngine.playError();
        }

        ballVel.y -= 12 * dt;
        ball.position.addScaledVector(ballVel, dt);
        ballVel.x *= Math.exp(-1.8 * dt);
        ballVel.z *= Math.exp(-1.5 * dt);
        if (ball.position.y < 0.42) {
          ball.position.y = 0.42;
          ballVel.y = 0;
        }

        // Keep ball in bounds or check goal
        if (ball.position.z < -23 && Math.abs(ball.position.x) < 4.3) {
          soundEngine.playGoal();
          goalCount += 1;
          setGoals(goalCount);
          scoreRef.current += 50;
          setScore(scoreRef.current);
          onScoreUpdate(scoreRef.current);
          ball.position.set(0, 0.42, 4);
          ballVel.set(0, 0, 0);
          striker.position.set(0, 0, 8);
        } else if (Math.abs(ball.position.x) > 15 || Math.abs(ball.position.z) > 25) {
          ball.position.x = THREE.MathUtils.clamp(ball.position.x, -14.5, 14.5);
          ball.position.z = THREE.MathUtils.clamp(ball.position.z, -22, 22);
          ballVel.multiplyScalar(-0.4);
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
      won={goals >= 1}
      endMessage={`O'yin yakunlandi! Urilgan gollar: ${goals}`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setGoals(0);
        setTimeLeft(60);
        timeRef.current = 60;
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Gollar</div>
            <div className="font-mono-num text-sm font-bold text-emerald-400 leading-none">{goals}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Vaqt</div>
            <div className="font-mono-num text-sm font-bold text-amber-300 leading-none">{timeLeft}s</div>
          </div>
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
            onClick={() => (kickRef.current = true)}
            className="px-5 h-12 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm"
          >
            Zarba!
          </button>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
