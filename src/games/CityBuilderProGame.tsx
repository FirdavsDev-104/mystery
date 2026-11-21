import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGridFloorTexture } from '../game-engine/proceduralTextures';
import { soundEngine } from '../utils/sound';

const BUILDINGS = [
  { id: 'house', name: 'Turar-joy', cost: 100, pop: 40, income: 20, color: 0x38bdf8, height: 2.8 },
  { id: 'tower', name: 'Biznes markaz', cost: 220, pop: 90, income: 55, color: 0x6366f1, height: 5.2 },
  { id: 'park', name: "Yashil bog'", cost: 80, pop: 15, income: 10, color: 0x22c55e, height: 0.9 },
  { id: 'solar', name: 'Elektr stansiya', cost: 160, pop: 10, income: 45, color: 0xf59e0b, height: 1.8 },
];

export default function CityBuilderProGame({
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
  const [budget, setBudget] = useState(500);
  const [population, setPopulation] = useState(0);
  const [selectedTool, setSelectedTool] = useState(0);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const budgetRef = useRef(500);
  const popRef = useRef(0);
  const scoreRef = useRef(0);
  const toolRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    toolRef.current = selectedTool;
  }, [selectedTool]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setBudget(500);
    budgetRef.current = 500;
    setPopulation(0);
    popRef.current = 0;
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x1e293b,
      fogNear: 35,
      fogFar: 120,
      fov: 48,
    });
    camera.position.set(16, 15, 18);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 10;
    controls.maxDistance = 36;

    addThreePointLights(scene, { isSoftwareGl, quality });

    const basePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture('#1e293b', '#475569', 6), roughness: 0.85 }),
    );
    basePlane.rotation.x = -Math.PI / 2;
    basePlane.receiveShadow = true;
    scene.add(basePlane);

    const occupied = new Set<string>();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(basePlane, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        const gx = Math.floor(pt.x / 4) * 4 + 2;
        const gz = Math.floor(pt.z / 4) * 4 + 2;
        const key = `${gx},${gz}`;
        if (occupied.has(key)) return;

        const bDef = BUILDINGS[toolRef.current];
        if (budgetRef.current < bDef.cost) {
          soundEngine.playError();
          return;
        }

        occupied.add(key);
        budgetRef.current -= bDef.cost;
        popRef.current += bDef.pop;
        setBudget(budgetRef.current);
        setPopulation(popRef.current);

        const bGrp = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(3.1, bDef.height, 3.1),
          new THREE.MeshStandardMaterial({ color: bDef.color, roughness: 0.45, metalness: 0.25 }),
        );
        body.position.y = bDef.height / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        bGrp.add(body);

        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.35, 2.4),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
        );
        roof.position.y = bDef.height + 0.17;
        bGrp.add(roof);

        bGrp.position.set(gx, 0, gz);
        scene.add(bGrp);
        soundEngine.playBuild();

        scoreRef.current = popRef.current * 5 + occupied.size * 25;
        setScore(scoreRef.current);
        onScoreUpdate(scoreRef.current);

        if (popRef.current >= 500) {
          soundEngine.playSuccess();
          setPhase('ended');
          onGameComplete(scoreRef.current, true);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    let incomeAcc = 0;

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt) => {
        controls.update();
        if (phaseRef.current !== 'playing' || pausedRef.current) return;
        incomeAcc += dt;
        if (incomeAcc >= 2.5) {
          incomeAcc -= 2.5;
          if (occupied.size > 0) {
            budgetRef.current += occupied.size * 18;
            setBudget(budgetRef.current);
          }
        }
      },
      pausedRef,
    );

    return () => {
      stopLoop();
      cleanupResize();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
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
      won={true}
      endMessage={`Tabriklaymiz! Shahringiz aholisi ${population} nafarga yetdi!`}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setBudget(500);
        budgetRef.current = 500;
        setPopulation(0);
        popRef.current = 0;
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Byudjet</div>
            <div className="font-mono-num text-sm font-bold text-emerald-400 leading-none">${budget}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Aholi</div>
            <div className="font-mono-num text-sm font-bold text-cyan-300 leading-none">{population} / 500</div>
          </div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto flex flex-wrap justify-center gap-1.5 bg-[#0B0E14]/90 p-2 rounded-xl border border-white/15">
          {BUILDINGS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedTool(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                selectedTool === i
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {b.name} (${b.cost})
            </button>
          ))}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
