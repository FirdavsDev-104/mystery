import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createAsphaltTexture, createGrassTexture } from '../game-engine/proceduralTextures';
import { createSportsCarGroup, createTreeGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

export default function SuperPoygachiGame({
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
  const [lives, setLives] = useState(3);
  const [speedKmh, setSpeedKmh] = useState(80);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const targetLaneRef = useRef(0); // -1, 0, 1

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    livesRef.current = 3;
    targetLaneRef.current = 0;
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x38bdf8,
      fogNear: 30,
      fogFar: 110,
      fov: 58,
    });
    camera.position.set(0, 4.8, 8.2);
    camera.lookAt(0, 1.0, -8);

    addThreePointLights(scene, {
      skyColor: 0xe0f2fe,
      groundColor: 0x365314,
      isSoftwareGl,
      quality,
    });

    const roadTex = createAsphaltTexture(1, 14);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 160),
      new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.7 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -50;
    road.receiveShadow = true;
    scene.add(road);

    const grassTex = createGrassTexture(16);
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 180),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.05, -50);
    scene.add(grass);

    const trees: THREE.Group[] = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -8.5 : 8.5;
      const t = createTreeGroup(1.1);
      t.position.set(side + (Math.random() - 0.5) * 2, 0, -i * 10);
      scene.add(t);
      trees.push(t);
    }

    const kart = createSportsCarGroup(0xf59e0b);
    kart.scale.setScalar(0.82);
    scene.add(kart);

    interface TrackObj {
      mesh: THREE.Object3D;
      kind: 'coin' | 'cone';
      lane: number;
    }
    const items: TrackObj[] = [];
    const lanes = [-3.1, 0, 3.1];

    const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.16, 16);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2, emissive: 0x713f12, emissiveIntensity: 0.3 });

    const spawnItem = (zPos: number) => {
      const lane = Math.floor(Math.random() * 3) - 1;
      const isCoin = Math.random() < 0.62;
      if (isCoin) {
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.position.set(lanes[lane + 1], 0.85, zPos);
        scene.add(coin);
        items.push({ mesh: coin, kind: 'coin', lane });
      } else {
        const grp = new THREE.Group();
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.65, 1.35, 12),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 }),
        );
        cone.position.y = 0.68;
        const stripe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.48, 0.25, 12),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc }),
        );
        stripe.position.y = 0.65;
        grp.add(cone, stripe);
        grp.position.set(lanes[lane + 1], 0, zPos);
        scene.add(grp);
        items.push({ mesh: grp, kind: 'cone', lane });
      }
    };

    for (let i = 1; i <= 10; i++) {
      spawnItem(-i * 12 - 15);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        targetLaneRef.current = Math.max(-1, targetLaneRef.current - 1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        targetLaneRef.current = Math.min(1, targetLaneRef.current + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    let distScore = 0;

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt) => {
        if (phaseRef.current !== 'playing' || pausedRef.current) return;

        const speed = 22 + Math.min(18, scoreRef.current * 0.04);
        setSpeedKmh(Math.round(speed * 4.2));
        roadTex.offset.y -= dt * speed * 0.08;

        const targetX = lanes[targetLaneRef.current + 1];
        kart.position.x = THREE.MathUtils.damp(kart.position.x, targetX, 12, dt);
        kart.rotation.z = THREE.MathUtils.damp(kart.rotation.z, (kart.position.x - targetX) * 0.08, 10, dt);

        trees.forEach((t) => {
          t.position.z += speed * dt;
          if (t.position.z > 12) t.position.z -= 140;
        });

        distScore += dt * 4;
        if (distScore >= 1) {
          scoreRef.current += Math.floor(distScore);
          distScore -= Math.floor(distScore);
          setScore(scoreRef.current);
          onScoreUpdate(scoreRef.current);
        }

        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.mesh.position.z += speed * dt;
          if (it.kind === 'coin') it.mesh.rotation.y += dt * 3.5;

          const dz = Math.abs(it.mesh.position.z - kart.position.z);
          const dx = Math.abs(it.mesh.position.x - kart.position.x);
          if (dz < 1.6 && dx < 1.1) {
            if (it.kind === 'coin') {
              soundEngine.playCollect();
              scoreRef.current += 15;
              setScore(scoreRef.current);
              onScoreUpdate(scoreRef.current);
            } else {
              soundEngine.playError();
              livesRef.current -= 1;
              setLives(livesRef.current);
              if (livesRef.current <= 0) {
                setPhase('ended');
                onGameComplete(scoreRef.current, false);
              }
            }
            scene.remove(it.mesh);
            items.splice(i, 1);
            spawnItem(-115);
            continue;
          }

          if (it.mesh.position.z > 10) {
            scene.remove(it.mesh);
            items.splice(i, 1);
            spawnItem(-115);
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
      won={lives > 0}
      endMessage={`Poyga tugadi! To'plangan ball: ${score}`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setLives(3);
        livesRef.current = 3;
        targetLaneRef.current = 0;
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Tezlik</div>
            <div className="font-mono-num text-sm font-bold text-cyan-300 leading-none">{speedKmh} km/h</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Jon</div>
            <div className="font-mono-num text-sm font-bold text-rose-400 leading-none">{lives} / 3</div>
          </div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto flex justify-between w-full px-2">
          <button
            type="button"
            onClick={() => (targetLaneRef.current = Math.max(-1, targetLaneRef.current - 1))}
            className="w-24 h-14 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold active:bg-amber-500 active:text-slate-950"
          >
            ← Chap
          </button>
          <button
            type="button"
            onClick={() => (targetLaneRef.current = Math.min(1, targetLaneRef.current + 1))}
            className="w-24 h-14 rounded-xl bg-[#0B0E14]/85 border border-white/20 text-white font-bold active:bg-amber-500 active:text-slate-950"
          >
            O&apos;ng →
          </button>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
