import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture } from '../game-engine/proceduralTextures';
import { soundEngine } from '../utils/sound';

const COLORS = [
  { name: 'Qizil', hex: 0xef4444, css: '#EF4444' },
  { name: "Ko'k", hex: 0x3b82f6, css: '#3B82F6' },
  { name: 'Yashil', hex: 0x22c55e, css: '#22C55E' },
  { name: 'Sariq', hex: 0xeab308, css: '#EAB308' },
  { name: 'Binafsha', hex: 0xa855f7, css: '#A855F7' },
];

export default function RanglarOlamiGame({
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
  const [feedback, setFeedback] = useState<string>('');

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const targetRef = useRef(0);
  const scoreRef = useRef(0);
  const roundRef = useRef(1);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  const pickNextTarget = (currentIdx?: number) => {
    let next = Math.floor(Math.random() * COLORS.length);
    if (next === currentIdx) next = (next + 1) % COLORS.length;
    targetRef.current = next;
    setTargetIdx(next);
  };

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setRound(1);
    roundRef.current = 1;
    setFeedback('');
    pickNextTarget();
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0x87ceeb,
      fogNear: 25,
      fogFar: 90,
      fov: 48,
    });
    camera.position.set(0, 7.5, 13.5);
    camera.lookAt(0, 1.2, 0);

    addThreePointLights(scene, {
      skyColor: 0xdbeafe,
      groundColor: 0x4d7c0f,
      isSoftwareGl,
      quality,
    });

    const groundTex = createGrassTexture(8);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(35, 36),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 5 colorful 3D toy pedestals + multi-part crown/gem figures
    const targets: THREE.Group[] = [];
    const clickableMeshes: THREE.Object3D[] = [];
    const burstParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

    COLORS.forEach((col, i) => {
      const angle = (i - 2) * 0.42;
      const x = Math.sin(angle) * 6.8;
      const z = Math.cos(angle) * 2.2 - 1.5;

      const pedestalGroup = new THREE.Group();
      pedestalGroup.position.set(x, 0, z);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.25, 0.7, 20),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
      );
      base.position.y = 0.35;
      base.receiveShadow = true;
      base.castShadow = true;
      pedestalGroup.add(base);

      const toyGroup = new THREE.Group();
      toyGroup.position.y = 1.6;

      const toyMat = new THREE.MeshPhysicalMaterial({
        color: col.hex,
        roughness: 0.2,
        metalness: 0.15,
        clearcoat: 0.8,
      });
      const mainCube = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), toyMat);
      mainCube.castShadow = true;
      mainCube.userData.colorIndex = i;
      toyGroup.add(mainCube);

      const capCone = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.7, 16), toyMat);
      capCone.position.y = 0.95;
      capCone.userData.colorIndex = i;
      toyGroup.add(capCone);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.85, 0.1, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.6, roughness: 0.2 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.userData.colorIndex = i;
      toyGroup.add(ring);

      pedestalGroup.add(toyGroup);
      pedestalGroup.userData.toy = toyGroup;
      pedestalGroup.userData.baseScale = 1;
      scene.add(pedestalGroup);
      targets.push(pedestalGroup);
      clickableMeshes.push(mainCube, capCone, ring);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const spawnBurst = (pos: THREE.Vector3, colorHex: number) => {
      const geo = new THREE.SphereGeometry(0.14, 8, 8);
      const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.7 });
      for (let k = 0; k < 10; k++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0));
        scene.add(m);
        burstParticles.push({
          mesh: m,
          vel: new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6),
          life: 0.8,
        });
      }
    };

    const handleSelect = (idx: number) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      if (idx === targetRef.current) {
        soundEngine.playCollect();
        spawnBurst(targets[idx].position, COLORS[idx].hex);
        const nextScore = scoreRef.current + 20;
        scoreRef.current = nextScore;
        setScore(nextScore);
        onScoreUpdate(nextScore);
        setFeedback("Barakalla! To'g'ri rang!");

        if (roundRef.current >= 10) {
          soundEngine.playSuccess();
          setPhase('ended');
          onGameComplete(nextScore, true);
        } else {
          roundRef.current += 1;
          setRound(roundRef.current);
          pickNextTarget(idx);
        }
      } else {
        soundEngine.playError();
        setFeedback("Qaytadan urinib ko'ring!");
      }
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const cIdx = hits[0].object.userData.colorIndex;
        if (typeof cIdx === 'number') {
          handleSelect(cIdx);
        }
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
        targets.forEach((grp, idx) => {
          const toy = grp.userData.toy as THREE.Group;
          toy.rotation.y += dt * (idx === targetRef.current ? 1.4 : 0.7);
          toy.position.y = 1.65 + Math.sin(elapsed * 2.2 + idx) * 0.16;
        });

        for (let i = burstParticles.length - 1; i >= 0; i--) {
          const p = burstParticles[i];
          p.life -= dt;
          p.vel.y -= 9.8 * dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.scale.setScalar(Math.max(0.01, p.life));
          if (p.life <= 0) {
            scene.remove(p.mesh);
            burstParticles.splice(i, 1);
          }
        }
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

  const currentTarget = COLORS[targetIdx];

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
      endMessage="Siz barcha ranglarni a'lo darajada topdingiz!"
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
        setFeedback('');
        pickNextTarget();
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Bosqich</div>
            <div className="font-mono-num text-sm font-bold text-white leading-none">{round} / 10</div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
            <span className="w-4 h-4 rounded-full border border-white/40" style={{ backgroundColor: currentTarget.css }} />
            <span className="text-sm font-bold text-white">{currentTarget.name} rangni bosing!</span>
          </div>
          {feedback && <span className="text-xs font-semibold text-amber-300">{feedback}</span>}
        </div>
      }
      mobileControls={
        <div className="pointer-events-auto mx-auto flex flex-wrap justify-center gap-2 bg-[#0B0E14]/85 p-2 rounded-xl border border-white/15">
          {COLORS.map((c, idx) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                if (phase !== 'playing') return;
                if (idx === targetRef.current) {
                  soundEngine.playCollect();
                  const nextScore = scoreRef.current + 20;
                  scoreRef.current = nextScore;
                  setScore(nextScore);
                  onScoreUpdate(nextScore);
                  setFeedback("Barakalla!");
                  if (roundRef.current >= 10) {
                    soundEngine.playSuccess();
                    setPhase('ended');
                    onGameComplete(nextScore, true);
                  } else {
                    roundRef.current += 1;
                    setRound(roundRef.current);
                    pickNextTarget(idx);
                  }
                } else {
                  soundEngine.playError();
                  setFeedback("Boshqa rangni sinab ko'ring!");
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-bold text-white shadow cursor-pointer active:scale-95 transition-transform"
              style={{ backgroundColor: c.css }}
            >
              {c.name}
            </button>
          ))}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
