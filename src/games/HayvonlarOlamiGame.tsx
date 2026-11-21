import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture } from '../game-engine/proceduralTextures';
import { createAnimalGroup, createTreeGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

const ANIMALS: { id: 'sheep' | 'cow' | 'lion' | 'elephant' | 'rabbit'; label: string }[] = [
  { id: 'sheep', label: "Qo'y" },
  { id: 'cow', label: 'Sigir' },
  { id: 'lion', label: 'Sher' },
  { id: 'elephant', label: 'Fil' },
  { id: 'rabbit', label: 'Quyon' },
];

export default function HayvonlarOlamiGame({
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
  const [round, setRound] = useState(1);
  const [targetIdx, setTargetIdx] = useState(0);
  const [msg, setMsg] = useState('');

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const targetRef = useRef(0);
  const scoreRef = useRef(0);
  const roundRef = useRef(1);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  const pickAnimal = (prev?: number) => {
    let n = Math.floor(Math.random() * ANIMALS.length);
    if (n === prev) n = (n + 1) % ANIMALS.length;
    targetRef.current = n;
    setTargetIdx(n);
  };

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setRound(1);
    roundRef.current = 1;
    setMsg('');
    pickAnimal();
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0xa7f3d0,
      fogNear: 28,
      fogFar: 95,
      fov: 48,
    });
    camera.position.set(0, 7.5, 13.5);
    camera.lookAt(0, 1, 0);

    addThreePointLights(scene, { isSoftwareGl, quality });

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(36, 32),
      new THREE.MeshStandardMaterial({ map: createGrassTexture(9), roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    [-8, 0, 8].forEach((tx, idx) => {
      const tree = createTreeGroup(1.25);
      tree.position.set(tx, 0, -5 - (idx % 2) * 2);
      scene.add(tree);
    });

    const animalGroups: THREE.Group[] = [];
    ANIMALS.forEach((an, idx) => {
      const grp = createAnimalGroup(an.id);
      const x = (idx - 2) * 3.1;
      const z = idx % 2 === 0 ? 1.2 : -1.4;
      grp.position.set(x, 0, z);
      grp.userData.animalIdx = idx;
      grp.traverse((ch) => {
        ch.userData.animalIdx = idx;
      });
      scene.add(grp);
      animalGroups.push(grp);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handleSelect = (idx: number) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      soundEngine.playAnimalCall(ANIMALS[idx].id);
      if (idx === targetRef.current) {
        const next = scoreRef.current + 20;
        scoreRef.current = next;
        setScore(next);
        onScoreUpdate(next);
        setMsg(`To'g'ri! Bu ${ANIMALS[idx].label}!`);
        if (roundRef.current >= 8) {
          soundEngine.playSuccess();
          setPhase('ended');
          onGameComplete(next, true);
        } else {
          roundRef.current += 1;
          setRound(roundRef.current);
          pickAnimal(idx);
        }
      } else {
        setMsg(`Bu ${ANIMALS[idx].label}, bizga ${ANIMALS[targetRef.current].label} kerak!`);
      }
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(animalGroups, true);
      if (hits.length > 0) {
        const aIdx = hits[0].object.userData.animalIdx;
        if (typeof aIdx === 'number') handleSelect(aIdx);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt, elapsed) => {
        animalGroups.forEach((grp, idx) => {
          grp.rotation.y = Math.sin(elapsed * 0.9 + idx * 1.4) * 0.5;
          grp.position.y = Math.abs(Math.sin(elapsed * 2.5 + idx)) * 0.18;
        });
      },
      pausedRef,
    );

    return () => {
      stopLoop();
      cleanupResize();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
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
      endMessage="Siz barcha hayvonlarni topib ovozini eshitdingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setRound(1);
        roundRef.current = 1;
        setMsg('');
        pickAnimal();
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div className="font-mono-num text-sm font-bold text-white">{round} / 8</div>
          <div className="bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 rounded-lg text-sm font-bold text-emerald-200">
            Toping: {ANIMALS[targetIdx].label}
          </div>
          {msg && <span className="text-xs text-amber-300 font-medium">{msg}</span>}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
