import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameComponentProps } from '../data/types';
import { GameShell, type GamePhase } from '../game-engine/GameShell';
import { addThreePointLights, attachResizeObserver, createGameScene, disposeThreeScene, startLoop } from '../game-engine/threeSetup';
import { createGrassTexture, createWoodTexture } from '../game-engine/proceduralTextures';
import { createAnimalGroup, createTreeGroup } from '../game-engine/proceduralModels';
import { soundEngine } from '../utils/sound';

type PlotStage = 'empty' | 'planted' | 'ready';

export default function KichkinaFermerGame({
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
  const [harvested, setHarvested] = useState(0);
  const [hint, setHint] = useState("Bo'sh yerlarga bosing va ekin eking!");

  const phaseRef = useRef<GamePhase>('start');
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const harvestedRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = isPaused || phase !== 'playing';
  }, [phase, isPaused]);

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setHarvested(0);
    harvestedRef.current = 0;
    setHint("Bo'sh yerlarga bosing va ekin eking!");
  }, [restartToken]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { scene, camera, renderer, isSoftwareGl, pmremTexture } = createGameScene(container, quality, {
      skyColor: 0xbae6fd,
      fogNear: 30,
      fogFar: 95,
      fov: 48,
    });
    camera.position.set(0, 11, 14);
    camera.lookAt(0, 0.5, 0);

    addThreePointLights(scene, {
      skyColor: 0xe0f2fe,
      groundColor: 0x3f6212,
      isSoftwareGl,
      quality,
    });

    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(40, 32),
      new THREE.MeshStandardMaterial({ map: createGrassTexture(10), roughness: 0.9 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    // Barn (composite 5-part 3D model)
    const barn = new THREE.Group();
    barn.position.set(-6.5, 0, -4.5);
    const barnBody = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.8, 3.6),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 }),
    );
    barnBody.position.y = 1.4;
    barnBody.castShadow = true;
    barn.add(barnBody);
    const barnRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.3, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 }),
    );
    barnRoof.rotation.y = Math.PI / 4;
    barnRoof.position.y = 3.7;
    barnRoof.castShadow = true;
    barn.add(barnRoof);
    const barnDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.8, 0.15),
      new THREE.MeshStandardMaterial({ map: createWoodTexture('#f8fafc'), roughness: 0.7 }),
    );
    barnDoor.position.set(0, 0.9, 1.82);
    barn.add(barnDoor);
    scene.add(barn);

    // Decorative trees
    [
      [7, -6],
      [-9, 3],
      [8.5, 2],
    ].forEach(([tx, tz]) => {
      const tree = createTreeGroup(1.1);
      tree.position.set(tx, 0, tz);
      scene.add(tree);
    });

    // Friendly 3D farm animals
    const sheep = createAnimalGroup('sheep');
    sheep.position.set(5.5, 0, -2.5);
    sheep.userData.kind = 'sheep';
    scene.add(sheep);

    const cow = createAnimalGroup('cow');
    cow.position.set(-5.2, 0, 3.2);
    cow.userData.kind = 'cow';
    scene.add(cow);

    // 6 Interactive 3D farm plots
    interface FarmPlot {
      group: THREE.Group;
      stage: PlotStage;
      timer: number;
      sprout: THREE.Mesh;
      crop: THREE.Group;
      hitBox: THREE.Mesh;
    }

    const plots: FarmPlot[] = [];
    const clickables: THREE.Object3D[] = [sheep, cow];
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 });

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const px = (c - 1) * 3.1;
        const pz = (r - 0.5) * 3.2 + 0.5;
        const grp = new THREE.Group();
        grp.position.set(px, 0, pz);

        const soil = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.26, 2.3), soilMat);
        soil.position.y = 0.13;
        soil.receiveShadow = true;
        grp.add(soil);

        const sprout = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 0.7, 8),
          new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.6 }),
        );
        sprout.position.y = 0.55;
        sprout.visible = false;
        grp.add(sprout);

        const crop = new THREE.Group();
        const carrotBody = new THREE.Mesh(
          new THREE.ConeGeometry(0.42, 1.0, 10),
          new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 }),
        );
        carrotBody.position.y = 0.72;
        carrotBody.rotation.x = Math.PI;
        const leafTop = new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 }),
        );
        leafTop.position.y = 1.3;
        crop.add(carrotBody, leafTop);
        crop.visible = false;
        grp.add(crop);

        const hitBox = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.6, 2.4),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hitBox.position.y = 0.8;
        hitBox.userData.plotIndex = plots.length;
        grp.add(hitBox);

        scene.add(grp);
        clickables.push(hitBox);
        plots.push({
          group: grp,
          stage: 'empty',
          timer: 0,
          sprout,
          crop,
          hitBox,
        });
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const triggerPlot = (idx: number) => {
      const p = plots[idx];
      if (!p) return;
      if (p.stage === 'empty') {
        p.stage = 'planted';
        p.timer = 0;
        p.sprout.visible = true;
        p.crop.visible = false;
        soundEngine.playBuild();
        setHint("Ekin o'smoqda! Yana bir oz kuting...");
      } else if (p.stage === 'ready') {
        p.stage = 'empty';
        p.sprout.visible = false;
        p.crop.visible = false;
        soundEngine.playCollect();
        const nextScore = scoreRef.current + 25;
        scoreRef.current = nextScore;
        setScore(nextScore);
        onScoreUpdate(nextScore);
        harvestedRef.current += 1;
        setHarvested(harvestedRef.current);
        setHint("Hosil yig'ib olindi! Ajoyib!");
        if (harvestedRef.current >= 8) {
          soundEngine.playSuccess();
          setPhase('ended');
          onGameComplete(nextScore, true);
        }
      }
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj) {
          if (typeof obj.userData.plotIndex === 'number') {
            triggerPlot(obj.userData.plotIndex);
            return;
          }
          if (obj.userData.kind) {
            soundEngine.playAnimalCall(obj.userData.kind);
            const bonus = scoreRef.current + 5;
            scoreRef.current = bonus;
            setScore(bonus);
            onScoreUpdate(bonus);
            setHint(obj.userData.kind === 'sheep' ? "Qo'ycha xursand bo'ldi! (+5)" : "Sigirga yem berdingiz! (+5)");
            return;
          }
          obj = obj.parent;
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
        plots.forEach((p, idx) => {
          if (p.stage === 'planted') {
            p.timer += dt;
            p.sprout.scale.setScalar(0.7 + Math.min(1, p.timer / 2.2) * 0.6);
            if (p.timer >= 2.2) {
              p.stage = 'ready';
              p.sprout.visible = false;
              p.crop.visible = true;
            }
          } else if (p.stage === 'ready') {
            p.crop.rotation.y += dt * 1.4;
            p.crop.position.y = Math.sin(elapsed * 3 + idx) * 0.08;
          }
        });

        sheep.position.z = -2.5 + Math.sin(elapsed * 0.8) * 1.6;
        sheep.rotation.y = Math.cos(elapsed * 0.8) > 0 ? 0 : Math.PI;
        cow.rotation.y = Math.sin(elapsed * 0.5) * 0.4 + 0.6;
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
      endMessage="Siz barcha sabzavotlarni muvaffaqiyatli yig'ib oldingiz!"
      onStart={() => {
        soundEngine.playClick();
        setPhase('playing');
      }}
      onResume={() => setPhase('playing')}
      onRestart={() => {
        setScore(0);
        scoreRef.current = 0;
        setHarvested(0);
        harvestedRef.current = 0;
        setPhase('playing');
      }}
      extraHud={
        <div className="flex items-center gap-4 border-l border-white/15 pl-4">
          <div>
            <div className="text-[11px] text-slate-400 leading-none mb-1">Hosil</div>
            <div className="font-mono-num text-sm font-bold text-emerald-400 leading-none">{harvested} / 8</div>
          </div>
          <span className="text-xs font-medium text-amber-300">{hint}</span>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameShell>
  );
}
