import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGridFloorTexture } from '../game-engine/proceduralTextures';
import { soundEngine } from '../utils/sound';

const SHAPES = [
  { id: 'kub', label: 'Kub', color: 0x38bdf8 },
  { id: 'shar', label: 'Shar', color: 0xf43f5e },
  { id: 'piramida', label: 'Piramida', color: 0xf59e0b },
  { id: 'silindr', label: 'Silindr', color: 0x10b981 },
];

export default function ShakllarniTopGame({
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
  const [statusMsg, setStatusMsg] = useState('');

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const targetRef = useRef(0);
  const scoreRef = useRef(0);
  const roundRef = useRef(1);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  const chooseNext = (prev?: number) => {
    let n = Math.floor(Math.random() * SHAPES.length);
    if (n === prev) n = (n + 1) % SHAPES.length;
    targetRef.current = n;
    setTargetIdx(n);
  };

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setRound(1);
    roundRef.current = 1;
    setStatusMsg('');
    chooseNext();
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x1e293b,
      fogNear: 25,
      fogFar: 90,
      fov: 48,
    });
    camera.position.set(0, 6.8, 12.5);
    camera.lookAt(0, 1.3, 0);

    addThreePointLights(scene, { isSoftwareGl, quality });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture('#1e293b', '#334155', 14), roughness: 0.75 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const shapeGroups: THREE.Group[] = [];
    const clickables: THREE.Object3D[] = [];

    SHAPES.forEach((sh, i) => {
      const grp = new THREE.Group();
      grp.position.set((i - 1.5) * 3.4, 0, 0);

      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.25, 0.5, 24),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3, roughness: 0.5 }),
      );
      stand.position.y = 0.25;
      stand.receiveShadow = true;
      grp.add(stand);

      const mat = new THREE.MeshPhysicalMaterial({
        color: sh.color,
        roughness: 0.2,
        metalness: 0.25,
        clearcoat: 0.7,
      });

      let geo: THREE.BufferGeometry;
      if (sh.id === 'kub') geo = new THREE.BoxGeometry(1.45, 1.45, 1.45);
      else if (sh.id === 'shar') geo = new THREE.SphereGeometry(0.88, 24, 24);
      else if (sh.id === 'piramida') geo = new THREE.ConeGeometry(0.98, 1.65, 4);
      else geo = new THREE.CylinderGeometry(0.75, 0.75, 1.55, 24);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1.8;
      mesh.castShadow = true;
      mesh.userData.shapeIndex = i;
      grp.add(mesh);

      scene.add(grp);
      shapeGroups.push(grp);
      clickables.push(mesh);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePick = (idx: number) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      if (idx === targetRef.current) {
        soundEngine.playCollect();
        const next = scoreRef.current + 25;
        scoreRef.current = next;
        setScore(next);
        onScoreUpdate(next);
        setStatusMsg("To'g'ri shakl!");
        if (roundRef.current >= 8) {
          soundEngine.playSuccess();
          setPhase('ended');
          onGameComplete(next, true);
        } else {
          roundRef.current += 1;
          setRound(roundRef.current);
          chooseNext(idx);
        }
      } else {
        soundEngine.playError();
        setStatusMsg("Yana bir urinib ko'ring!");
      }
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length > 0) {
        const sIdx = hits[0].object.userData.shapeIndex;
        if (typeof sIdx === 'number') handlePick(sIdx);
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
        shapeGroups.forEach((g, idx) => {
          const obj = g.children[1];
          obj.rotation.y += dt * 1.1;
          obj.rotation.x = Math.sin(elapsed * 1.5 + idx) * 0.15;
          obj.position.y = 1.85 + Math.sin(elapsed * 2.2 + idx) * 0.18;
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
      endMessage="Siz barcha 3D shakllarni bilib oldingiz!"
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
        setStatusMsg('');
        chooseNext();
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div className="font-mono-num text-sm font-bold text-slate-200">{round} / 8</div>
          <div className="bg-amber-500/20 border border-amber-400/40 px-3 py-1 rounded-lg text-sm font-bold text-amber-200">
            Toping: {SHAPES[targetIdx].label}
          </div>
          {statusMsg && <span className="text-xs text-emerald-300 font-semibold">{statusMsg}</span>}
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto flex gap-2 bg-[#0B0E14]/85 p-2 rounded-xl border border-white/15">
          {SHAPES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (phase !== 'playing') return;
                if (idx === targetRef.current) {
                  soundEngine.playCollect();
                  const next = scoreRef.current + 25;
                  scoreRef.current = next;
                  setScore(next);
                  onScoreUpdate(next);
                  setStatusMsg("To'g'ri!");
                  if (roundRef.current >= 8) {
                    soundEngine.playSuccess();
                    setPhase('ended');
                    onGameComplete(next, true);
                  } else {
                    roundRef.current += 1;
                    setRound(roundRef.current);
                    chooseNext(idx);
                  }
                } else {
                  soundEngine.playError();
                  setStatusMsg("Qaytadan urinib ko'ring!");
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
