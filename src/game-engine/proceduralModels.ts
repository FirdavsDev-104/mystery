import * as THREE from 'three';

export function createSportsCarGroup(color = 0xef4444): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.65,
    roughness: 0.25,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.4,
    roughness: 0.15,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.1,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.9,
  });

  // Lower chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.52, 4.1), bodyMat);
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // Hood slope
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.24, 1.3), bodyMat);
  hood.position.set(0, 0.78, -1.15);
  hood.rotation.x = 0.1;
  hood.castShadow = true;
  group.add(hood);

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.54, 1.9), cabinMat);
  cabin.position.set(0, 1.04, 0.18);
  cabin.castShadow = true;
  group.add(cabin);

  // Spoiler
  const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.36), bodyMat);
  spoilerWing.position.set(0, 1.05, 1.85);
  spoilerWing.castShadow = true;
  group.add(spoilerWing);

  // Headlights & Taillights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.2 });
  [-0.62, 0.62].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headMat);
    hl.position.set(x, 0.58, -2.06);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), tailMat);
    tl.position.set(x, 0.62, 2.06);
    group.add(tl);
  });

  // 4 Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const wheelCoords: [number, number, number][] = [
    [-0.95, 0.36, -1.25],
    [0.95, 0.36, -1.25],
    [-0.95, 0.36, 1.25],
    [0.95, 0.36, 1.25],
  ];
  wheelCoords.forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    const r = new THREE.Mesh(rimGeo, rimMat);
    w.add(r);
    group.add(w);
  });

  return group;
}

export function createAirplaneGroup(color = 0x38bdf8): THREE.Group {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.45, roughness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.1 });

  // Fuselage
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.36, 4.6, 16), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.1, 16), accentMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.85;
  group.add(nose);

  // Cockpit canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 1.1), glassMat);
  canopy.position.set(0, 0.42, -1.2);
  group.add(canopy);

  // Main wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.1, 1.15), accentMat);
  wing.position.set(0, 0.05, -0.2);
  wing.castShadow = true;
  group.add(wing);

  // Engines under wings
  [-1.6, 1.6].forEach((x) => {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.9, 12), hullMat);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, -0.18, -0.35);
    group.add(eng);
  });

  // Tail stabilizer & fin
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.65), accentMat);
  hTail.position.set(0, 0.15, 2.0);
  group.add(hTail);

  const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.85), accentMat);
  vFin.position.set(0, 0.65, 1.95);
  group.add(vFin);

  // Propeller
  const prop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.06), glassMat);
  prop.position.set(0, 0, -3.42);
  prop.name = 'propeller';
  group.add(prop);

  return group;
}

export function createRobotGroup(color = 0x3b82f6): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.28 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.5 });

  // Legs
  [-0.28, 0.28].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.34), darkMat);
    leg.position.set(x, 0.35, 0);
    leg.castShadow = true;
    group.add(leg);
  });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 0.65), bodyMat);
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);

  // Chest core
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16), glowMat);
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 1.25, 0.33);
  group.add(core);

  // Head + Visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), bodyMat);
  head.position.y = 2.02;
  head.castShadow = true;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.08), glowMat);
  visor.position.set(0, 2.04, 0.27);
  group.add(visor);

  // Arms
  [-0.65, 0.65].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), darkMat);
    arm.position.set(x, 1.18, 0);
    arm.castShadow = true;
    group.add(arm);
  });

  return group;
}

export function createTreeGroup(scale = 1, canopyColor = 0x2e8b57): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: canopyColor, roughness: 0.75 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.8, 8), trunkMat);
  trunk.position.y = 0.9;
  trunk.castShadow = true;
  group.add(trunk);

  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.8, 9), leafMat);
  c1.position.y = 2.3;
  c1.castShadow = true;
  group.add(c1);

  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.5, 9), leafMat);
  c2.position.y = 3.2;
  c2.castShadow = true;
  group.add(c2);

  group.scale.setScalar(scale);
  return group;
}

export function createAnimalGroup(type: 'sheep' | 'cow' | 'lion' | 'elephant' | 'rabbit'): THREE.Group {
  const group = new THREE.Group();

  const palette: Record<string, { body: number; head: number; accent: number }> = {
    sheep: { body: 0xf8fafc, head: 0x334155, accent: 0x1e293b },
    cow: { body: 0xf1f5f9, head: 0x334155, accent: 0xf9a8d4 },
    lion: { body: 0xf59e0b, head: 0xfbbf24, accent: 0x92400e },
    elephant: { body: 0x94a3b8, head: 0x64748b, accent: 0xe2e8f0 },
    rabbit: { body: 0xfef3c7, head: 0xfde68a, accent: 0xf472b6 },
  };
  const colors = palette[type];
  const bodyMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.75 });
  const headMat = new THREE.MeshStandardMaterial({ color: colors.head, roughness: 0.65 });
  const accentMat = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.6 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });

  // 4 legs
  [
    [-0.32, 0.35, -0.45],
    [0.32, 0.35, -0.45],
    [-0.32, 0.35, 0.45],
    [0.32, 0.35, 0.45],
  ].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.7, 10), accentMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 1.35), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.62, 0.66), headMat);
  head.position.set(0, 1.35, 0.85);
  head.castShadow = true;
  group.add(head);

  // Eyes
  [-0.16, 0.16].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    eye.position.set(ex, 1.44, 1.18);
    group.add(eye);
  });

  // Species signature features
  if (type === 'elephant') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.85, 10), headMat);
    trunk.position.set(0, 1.05, 1.25);
    trunk.rotation.x = 0.5;
    group.add(trunk);
    [-0.48, 0.48].forEach((earX) => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.1), bodyMat);
      ear.position.set(earX, 1.38, 0.75);
      group.add(ear);
    });
  } else if (type === 'lion') {
    const mane = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 12), accentMat);
    mane.rotation.x = Math.PI / 2;
    mane.position.set(0, 1.35, 0.68);
    group.add(mane);
  } else if (type === 'rabbit') {
    [-0.16, 0.16].forEach((earX) => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.12), bodyMat);
      ear.position.set(earX, 1.9, 0.8);
      group.add(ear);
    });
  } else if (type === 'cow') {
    const spot = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.42, 0.52), headMat);
    spot.position.set(0, 1.0, -0.15);
    group.add(spot);
  }

  return group;
}
