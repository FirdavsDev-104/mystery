import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createVoxelFaceTexture } from '../game-engine/proceduralTextures';
import { soundEngine } from '../utils/sound';

const BLOCK_TYPES = [
  { id: 'grass', name: "O't bloki", top: '#22c55e', accent: '#16a34a' },
  { id: 'wood', name: "Yog'och", top: '#9a6234', accent: '#78350f' },
  { id: 'stone', name: 'Tosh', top: '#94a3b8', accent: '#64748b' },
  { id: 'gold', name: 'Oltin', top: '#facc15', accent: '#eab308' },
];

export default function MinecraftSarguzashtiGame({
  game,
  quality,
  isPaused,
  restartToken,
  onScoreUpdate,
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<GamePhase>('start');
  const [score, setScore] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [mode, setMode] = useState<'place' | 'break'>('place');
  const [blockCount, setBlockCount] = useState(0);

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const selectedBlockRef = useRef(0);
  const modeRef = useRef<'place' | 'break'>('place');
  const scoreRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setBlockCount(0);
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x7dd3fc,
      fogNear: 30,
      fogFar: 90,
      fov: 50,
    });
    camera.position.set(10, 9.5, 11.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 26;
    controls.target.set(0, 1, 0);

    addThreePointLights(scene, {
      skyColor: 0xe0f2fe,
      groundColor: 0x365314,
      isSoftwareGl,
      quality,
    });

    const blockMaterials = BLOCK_TYPES.map(
      (b) =>
        new THREE.MeshStandardMaterial({
          map: createVoxelFaceTexture(b.top, b.accent),
          roughness: 0.75,
        }),
    );

    const voxelGeo = new THREE.BoxGeometry(1, 1, 1);
    const blocks: THREE.Mesh[] = [];
    const groundBlocks: THREE.Mesh[] = [];

    const addVoxel = (x: number, y: number, z: number, matIdx: number, isBase = false) => {
      const m = new THREE.Mesh(voxelGeo, blockMaterials[matIdx]);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.isBase = isBase;
      scene.add(m);
      blocks.push(m);
      if (isBase) groundBlocks.push(m);
    };

    // Build starter 9x9 voxel island
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        addVoxel(x, -0.5, z, 0, true);
      }
    }
    // Starter voxel tree
    addVoxel(-2, 0.5, -2, 1);
    addVoxel(-2, 1.5, -2, 1);
    addVoxel(-2, 2.5, -2, 0);
    addVoxel(-1, 2.5, -2, 0);
    addVoxel(-3, 2.5, -2, 0);
    addVoxel(-2, 2.5, -1, 0);
    addVoxel(-2, 2.5, -3, 0);

    // Collectible crystals floating on island
    const crystals: THREE.Mesh[] = [];
    const crystalGeo = new THREE.OctahedronGeometry(0.45, 0);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.5,
      roughness: 0.1,
      metalness: 0.2,
    });
    [
      [3, 1.1, -3],
      [-3, 1.1, 3],
      [2, 1.1, 2],
    ].forEach(([cx, cy, cz]) => {
      const c = new THREE.Mesh(crystalGeo, crystalMat);
      c.position.set(cx, cy, cz);
      c.userData.isCrystal = true;
      scene.add(c);
      crystals.push(c);
    });

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

      const crystalHits = raycaster.intersectObjects(crystals, false);
      if (crystalHits.length > 0) {
        const hitC = crystalHits[0].object as THREE.Mesh;
        scene.remove(hitC);
        const idx = crystals.indexOf(hitC);
        if (idx >= 0) crystals.splice(idx, 1);
        soundEngine.playCollect();
        scoreRef.current += 50;
        setScore(scoreRef.current);
        onScoreUpdate(scoreRef.current);
        return;
      }

      const hits = raycaster.intersectObjects(blocks, false);
      if (hits.length > 0) {
        const hit = hits[0];
        if (modeRef.current === 'break') {
          if (!hit.object.userData.isBase) {
            scene.remove(hit.object);
            const idx = blocks.indexOf(hit.object as THREE.Mesh);
            if (idx >= 0) blocks.splice(idx, 1);
            soundEngine.playBuild();
          }
        } else if (hit.face) {
          const n = hit.face.normal;
          const pos = hit.object.position.clone().add(n);
          if (pos.y >= 0.4 && pos.y <= 8.5 && Math.abs(pos.x) <= 5 && Math.abs(pos.z) <= 5) {
            addVoxel(Math.round(pos.x), Math.round(pos.y * 2) / 2, Math.round(pos.z), selectedBlockRef.current);
            soundEngine.playBuild();
            scoreRef.current += 10;
            setScore(scoreRef.current);
            onScoreUpdate(scoreRef.current);
            setBlockCount((c) => c + 1);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    const cleanupResize = attachResizeObserver(container, camera, renderer);

    const stopLoop = startLoop(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      (dt, elapsed) => {
        controls.update();
        crystals.forEach((c, i) => {
          c.rotation.y += dt * 1.8;
          c.position.y = 1.1 + Math.sin(elapsed * 2.5 + i) * 0.2;
        });
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
      scoreLabel="Ball"
      accentColor={game.accentColor}
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setBlockCount(0);
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-3 border-l border-white/15 pl-3">
          <div className="font-mono-num text-xs text-emerald-300 font-semibold">Bloklar: {blockCount}</div>
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-1.5 bg-[#0B0E14]/90 p-2 rounded-xl border border-white/15">
          {BLOCK_TYPES.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setMode('place');
                setSelectedBlock(i);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                mode === 'place' && selectedBlock === i
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {b.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'place' ? 'break' : 'place'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
              mode === 'break'
                ? 'border-rose-400 bg-rose-500/25 text-rose-200'
                : 'border-white/10 bg-white/5 text-slate-300'
            }`}
          >
            {mode === 'break' ? "Qazish yoqilgan" : 'Qazish'}
          </button>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
