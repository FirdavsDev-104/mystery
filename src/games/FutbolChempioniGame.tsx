import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createPitchTexture } from '../game-engine/proceduralTextures';
import { createRobotGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function FutbolChempioniGame({
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
  const [shotsLeft, setShotsLeft] = useState(8);
  const [status, setStatus] = useState("Zarba yo'nalishini tanlab teping!");

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const shotsRef = useRef(8);
  const kickQueueRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setShotsLeft(8);
    shotsRef.current = 8;
    setStatus("Zarba yo'nalishini tanlab teping!");
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x1e3a8a,
      fogNear: 35,
      fogFar: 120,
      fov: 50,
    });
    camera.position.set(0, 5.2, 13.5);
    camera.lookAt(0, 1.8, -8);

    addThreePointLights(scene, { isSoftwareGl, quality });

    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 44),
      new THREE.MeshStandardMaterial({ map: createPitchTexture(), roughness: 0.85 }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // 3D Goalpost
    const goalGroup = new THREE.Group();
    goalGroup.position.set(0, 0, -10);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.3 });
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 12), postMat);
    leftPost.position.set(-4.5, 1.8, 0);
    const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 12), postMat);
    rightPost.position.set(4.5, 1.8, 0);
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 9.2, 12), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 3.6, 0);
    const net = new THREE.Mesh(
      new THREE.BoxGeometry(8.9, 3.5, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, wireframe: true, transparent: true, opacity: 0.55 }),
    );
    net.position.set(0, 1.75, -0.9);
    goalGroup.add(leftPost, rightPost, crossbar, net);
    scene.add(goalGroup);

    // Goalkeeper
    const keeper = createRobotGroup(0xf97316);
    keeper.position.set(0, 0, -9.2);
    scene.add(keeper);

    // Soccer Ball
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    );
    ball.position.set(0, 0.42, 4.5);
    ball.castShadow = true;
    scene.add(ball);

    let ballVel = new THREE.Vector3();
    let ballActive = false;

    const launchBall = (aimX: number) => {
      if (ballActive || phaseRef.current !== 'playing' || pausedRef.current) return;
      ballActive = true;
      soundEngine.playJump();
      ballVel.set(aimX * 6.2, 3.8, -22);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') launchBall(-0.62);
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') launchBall(0);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') launchBall(0.62);
    };
    window.addEventListener('keydown', onKeyDown);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt, elapsed) => {
        keeper.position.x = Math.sin(elapsed * 2.6) * 3.4;

        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        if (kickQueueRef.current !== null) {
          const aim = kickQueueRef.current;
          kickQueueRef.current = null;
          launchBall(aim);
        }

        if (ballActive) {
          ballVel.y -= 9.5 * dt;
          ball.position.addScaledVector(ballVel, dt);
          ball.rotation.x -= dt * 10;
          if (ball.position.y < 0.42) {
            ball.position.y = 0.42;
            ballVel.y *= -0.4;
          }

          // Check keeper save
          if (Math.abs(ball.position.z - keeper.position.z) < 0.9 && Math.abs(ball.position.x - keeper.position.x) < 1.1) {
            soundEngine.playError();
            setStatus('Darvozabon to‘pni qaytardi!');
            ballActive = false;
            ball.position.set(0, 0.42, 4.5);
            shotsRef.current -= 1;
            setShotsLeft(shotsRef.current);
          } else if (ball.position.z <= -10) {
            if (Math.abs(ball.position.x) < 4.2 && ball.position.y < 3.5) {
              soundEngine.playGoal();
              scoreRef.current += 25;
              setScore(scoreRef.current);
              onScoreUpdate(scoreRef.current);
              setStatus('GOOOOL! +25 ball!');
            } else {
              soundEngine.playError();
              setStatus('Darvozadan chetga ketdi!');
            }
            ballActive = false;
            ball.position.set(0, 0.42, 4.5);
            shotsRef.current -= 1;
            setShotsLeft(shotsRef.current);
          }

          if (!ballActive && shotsRef.current <= 0) {
            soundEngine.playSuccess();
            setPhase('ended');
            onGameComplete(scoreRef.current, scoreRef.current >= 75);
          }
        }
      },
      pausedRef,
    );

    return () => {
      stopLoop();
      cleanupResize();
      window.removeEventListener('keydown', onKeyDown);
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
      won={score >= 75}
      endMessage={`8 ta zarbadan ${score / 25} ta gol urdingiz!`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setShotsLeft(8);
        shotsRef.current = 8;
        setStatus("Zarba yo'nalishini tanlab teping!");
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Zarbalar</div>
            <div className="font-mono-num text-sm font-bold text-white leading-none">{shotsLeft}</div>
          </div>
          <span className="text-xs font-semibold text-amber-300">{status}</span>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto flex gap-2 bg-[#0B0E14]/85 p-2 rounded-xl border border-white/15">
          <button
            type="button"
            onClick={() => (kickQueueRef.current = -0.62)}
            className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            ↖ Chap burchak
          </button>
          <button
            type="button"
            onClick={() => (kickQueueRef.current = 0)}
            className="px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            ↑ Markaz
          </button>
          <button
            type="button"
            onClick={() => (kickQueueRef.current = 0.62)}
            className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            O&apos;ng burchak ↗
          </button>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
