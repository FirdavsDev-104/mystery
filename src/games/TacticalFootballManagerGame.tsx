import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createPitchTexture } from '../game-engine/proceduralTextures';
import { createRobotGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

type TacticMode = 'attack' | 'balanced' | 'defense';

export default function TacticalFootballManagerGame({
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
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [minute, setMinute] = useState(0);
  const [tactic, setTactic] = useState<TacticMode>('balanced');

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const tacticRef = useRef<TacticMode>('balanced');
  const homeRef = useRef(0);
  const awayRef = useRef(0);
  const minuteRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    tacticRef.current = tactic;
  }, [tactic]);

  useEffect(() => {
    setScore(0);
    setHomeGoals(0);
    setAwayGoals(0);
    homeRef.current = 0;
    awayRef.current = 0;
    setMinute(0);
    minuteRef.current = 0;
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x090d16,
      fogNear: 40,
      fogFar: 135,
      fov: 50,
    });
    camera.position.set(0, 22, 24);
    camera.lookAt(0, 0, 0);

    addThreePointLights(scene, { isSoftwareGl, quality });

    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 48),
      new THREE.MeshStandardMaterial({ map: createPitchTexture(), roughness: 0.8 }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    const homePlayers: { group: THREE.Group; baseX: number; baseZ: number }[] = [];
    const awayPlayers: { group: THREE.Group; baseX: number; baseZ: number }[] = [];

    for (let i = 0; i < 6; i++) {
      const hp = createRobotGroup(0x2563eb);
      hp.scale.setScalar(0.65);
      const bx = ((i % 3) - 1) * 7;
      const bz = i < 3 ? 12 : 4;
      hp.position.set(bx, 0, bz);
      scene.add(hp);
      homePlayers.push({ group: hp, baseX: bx, baseZ: bz });

      const ap = createRobotGroup(0xef4444);
      ap.scale.setScalar(0.65);
      const abx = ((i % 3) - 1) * 7;
      const abz = i < 3 ? -12 : -4;
      ap.position.set(abx, 0, abz);
      scene.add(ap);
      awayPlayers.push({ group: ap, baseX: abx, baseZ: abz });
    }

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
    );
    ball.position.set(0, 0.45, 0);
    scene.add(ball);

    const ballVel = new THREE.Vector3(4, 0, -6);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    let minAcc = 0;

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt, elapsed) => {
        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        minAcc += dt;
        if (minAcc >= 0.45) {
          minAcc -= 0.45;
          minuteRef.current += 1;
          setMinute(minuteRef.current);
          if (minuteRef.current >= 90) {
            soundEngine.playSuccess();
            const finalScore = homeRef.current * 100 + Math.max(0, homeRef.current - awayRef.current) * 50 + 50;
            setScore(finalScore);
            onScoreUpdate(finalScore);
            setPhase('ended');
            onGameComplete(finalScore, homeRef.current >= awayRef.current);
            return;
          }
        }

        const shiftZ = tacticRef.current === 'attack' ? -5 : tacticRef.current === 'defense' ? 5 : 0;

        homePlayers.forEach((p, idx) => {
          const tx = p.baseX + Math.sin(elapsed * 1.4 + idx) * 2.5;
          const tz = p.baseZ + shiftZ + Math.cos(elapsed * 1.2 + idx) * 2.5;
          p.group.position.x = THREE.MathUtils.damp(p.group.position.x, tx, 4, dt);
          p.group.position.z = THREE.MathUtils.damp(p.group.position.z, tz, 4, dt);
        });

        awayPlayers.forEach((p, idx) => {
          const tx = p.baseX + Math.cos(elapsed * 1.3 + idx) * 2.5;
          const tz = p.baseZ + Math.sin(elapsed * 1.1 + idx) * 2.5;
          p.group.position.x = THREE.MathUtils.damp(p.group.position.x, tx, 4, dt);
          p.group.position.z = THREE.MathUtils.damp(p.group.position.z, tz, 4, dt);
        });

        ball.position.addScaledVector(ballVel, dt);
        if (Math.abs(ball.position.x) > 15) ballVel.x *= -1;
        if (ball.position.z < -22) {
          if (Math.abs(ball.position.x) < 5) {
            homeRef.current += 1;
            setHomeGoals(homeRef.current);
            soundEngine.playGoal();
            const sc = homeRef.current * 100;
            setScore(sc);
            onScoreUpdate(sc);
            ball.position.set(0, 0.45, 0);
            ballVel.set((Math.random() - 0.5) * 10, 0, tacticRef.current === 'attack' ? -11 : -7);
          } else {
            ballVel.z *= -1;
          }
        } else if (ball.position.z > 22) {
          if (Math.abs(ball.position.x) < 5) {
            awayRef.current += 1;
            setAwayGoals(awayRef.current);
            soundEngine.playError();
            ball.position.set(0, 0.45, 0);
            ballVel.set((Math.random() - 0.5) * 10, 0, 8);
          } else {
            ballVel.z *= -1;
          }
        }

        // Dynamic bias based on selected tactic
        const attackBias = tacticRef.current === 'attack' ? -5.5 : tacticRef.current === 'defense' ? 2.5 : -1.5;
        ballVel.z += attackBias * dt;
        ballVel.clampLength(6, 15);
      },
      pausedRef,
    );

    return () => {
      stopLoop();
      cleanupResize();
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
      scoreLabel="Reyting"
      accentColor={game.accentColor}
      won={homeGoals >= awayGoals}
      endMessage={`Uchrashuv yakunlandi! Hisob: ${homeGoals} : ${awayGoals}`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        setHomeGoals(0);
        setAwayGoals(0);
        homeRef.current = 0;
        awayRef.current = 0;
        setMinute(0);
        minuteRef.current = 0;
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div className="font-mono-num text-sm font-bold text-white">
            Ko&apos;klar {homeGoals} : {awayGoals} Qizillar
          </div>
          <div className="font-mono-num text-sm font-bold text-amber-300">{minute}&apos;</div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto flex gap-2 bg-[#0B0E14]/90 p-2 rounded-xl border border-white/15">
          {[
            { id: 'attack' as TacticMode, label: 'Hujumkor (4-3-3)' },
            { id: 'balanced' as TacticMode, label: 'Muvozanat (4-4-2)' },
            { id: 'defense' as TacticMode, label: 'Himoya (5-3-2)' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setTactic(t.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                tactic === t.id
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
