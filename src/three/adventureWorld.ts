import * as THREE from 'three';
import { MissionDef } from '../types/game';
import {
  createStonePathTexture,
  createTerrainTexture,
  createWaterfallTexture,
} from './textures';

export interface AdventureWorldHandle {
  group: THREE.Group;
  islandGround: THREE.Mesh;
  animate: (elapsed: number, dt: number) => void;
}

function createSkyGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#0284c7'); // Crisp cobalt zenith
  grad.addColorStop(0.32, '#0ea5e9'); // Bright adventure blue
  grad.addColorStop(0.56, '#38bdf8'); // Cheerful sky blue
  grad.addColorStop(0.75, '#bae6fd'); // Luminous horizon mist
  grad.addColorStop(1.0, '#e0f2fe'); // Soft under-cloud glow
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSunGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 251, 214, 1)');
  grad.addColorStop(0.3, 'rgba(254, 240, 138, 0.75)');
  grad.addColorStop(0.65, 'rgba(250, 204, 21, 0.22)');
  grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFluffyCloudCluster(scale: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const puffs: [number, number, number, number][] = [
    [0, 0.25, 0, 1.35],
    [-1.15, 0.05, 0.15, 1.0],
    [1.18, 0.08, -0.1, 1.05],
    [-0.55, 0.48, -0.25, 0.92],
    [0.58, 0.52, 0.2, 0.96],
    [0, -0.12, 0.45, 0.88],
  ];
  const puffGeo = new THREE.SphereGeometry(1, 12, 10);
  puffs.forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(puffGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(r * 1.15, r * 0.82, r * 0.95);
    g.add(m);
  });
  g.scale.setScalar(scale);
  return g;
}

export function buildAdventureWorld(
  missions: MissionDef[],
  maxAnisotropy: number
): AdventureWorldHandle {
  const group = new THREE.Group();

  // =======================================================
  // 1. BRIGHT BLUE SKY DOME, GOLDEN SUN & SOFT SUN RAYS
  // =======================================================
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(165, 28, 20),
    new THREE.MeshBasicMaterial({
      map: createSkyGradientTexture(),
      side: THREE.BackSide,
      fog: false,
    })
  );
  group.add(skyDome);

  const sunGroup = new THREE.Group();
  sunGroup.position.set(-44, 42, -46);
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef9c3, fog: false })
  );
  sunGroup.add(sunCore);

  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createSunGlowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  sunHalo.scale.set(28, 28, 1);
  sunGroup.add(sunHalo);

  // Subtle volumetric-looking sunlight shafts slanting onto the island
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.065,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  for (let i = 0; i < 3; i++) {
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(7 + i * 3, 55, 16, 1, true), rayMat);
    shaft.position.set(12 + i * 5, -18, 14 + i * 3);
    shaft.rotation.z = -0.58;
    shaft.rotation.x = 0.42;
    sunGroup.add(shaft);
  }
  group.add(sunGroup);

  // =======================================================
  // 2. FLUFFY 3D CLOUDS (SKY RING + BELOW FLOATING ISLAND)
  // =======================================================
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.22,
    roughness: 0.92,
    metalness: 0.0,
  });
  const clouds: { obj: THREE.Group; baseY: number; angle: number; radius: number; speed: number }[] = [];

  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.14;
    const isUnderCloud = i % 2 === 0;
    const radius = isUnderCloud ? 24 + (i % 4) * 7.5 : 54 + (i % 3) * 14;
    const baseY = isUnderCloud ? -6.5 - (i % 3) * 2.5 : 10 + (i % 4) * 4.5;
    const c = buildFluffyCloudCluster(isUnderCloud ? 2.6 + (i % 3) * 0.7 : 2.9 + (i % 3) * 0.9, cloudMat);
    c.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
    c.rotation.y = -angle;
    group.add(c);
    clouds.push({ obj: c, baseY, angle, radius, speed: (isUnderCloud ? 0.015 : 0.01) * (i % 2 === 0 ? 1 : -1) });
  }

  // =======================================================
  // 3. FLOATING ADVENTURE ISLAND TERRAIN & LAYERED CLIFFS
  // =======================================================
  const terrainTex = createTerrainTexture(maxAnisotropy);
  const islandGround = new THREE.Mesh(
    new THREE.CylinderGeometry(30.2, 29.4, 1.4, 48),
    new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: 0.85,
      metalness: 0.02,
    })
  );
  islandGround.position.y = -0.68;
  islandGround.receiveShadow = true;
  group.add(islandGround);

  // Sculpted Floating Rocky Cliff Underbelly (stepped stone strata cone)
  const cliffCollarGeo = new THREE.CylinderGeometry(29.3, 21.8, 4.6, 28, 1);
  const posAttr = cliffCollarGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const wave = Math.sin(vx * 0.38 + vz * 0.25) * 1.1 + Math.cos(vz * 0.42 - vx * 0.2) * 0.85;
    if (vy < 1.9) {
      const len = Math.hypot(vx, vz) || 1;
      posAttr.setX(i, vx + (vx / len) * wave);
      posAttr.setZ(i, vz + (vz / len) * wave);
    }
  }
  cliffCollarGeo.computeVertexNormals();

  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x8b7e74,
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });
  const cliffCollar = new THREE.Mesh(cliffCollarGeo, cliffMat);
  cliffCollar.position.y = -3.65;
  cliffCollar.castShadow = true;
  cliffCollar.receiveShadow = true;
  group.add(cliffCollar);

  const deepRockCone = new THREE.Mesh(
    new THREE.ConeGeometry(21.6, 12.2, 16),
    new THREE.MeshStandardMaterial({
      color: 0x6b6058,
      roughness: 0.95,
      metalness: 0.04,
      flatShading: true,
    })
  );
  deepRockCone.rotation.x = Math.PI;
  deepRockCone.position.y = -11.9;
  group.add(deepRockCone);

  // Rolling Emerald Hills along outer safe perimeter sectors
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    roughness: 0.86,
    metalness: 0.02,
  });
  const hillSpecs: [number, number, number, number, number][] = [
    [-22.5, 0.2, -2.5, 4.8, 2.2],
    [-2.0, 0.2, -23.5, 6.2, 2.8],
    [22.5, 0.2, -2.0, 5.2, 2.6],
    [21.5, 0.2, -19.5, 6.4, 3.6], // Highland cliff for northeast waterfall
    [-22.5, 0.2, -18.5, 5.4, 2.5],
  ];
  hillSpecs.forEach(([x, y, z, r, h]) => {
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hillMat
    );
    hill.scale.set(1.1, h / r, 0.95);
    hill.position.set(x, y - 0.15, z);
    hill.receiveShadow = true;
    hill.castShadow = true;
    group.add(hill);
  });

  // Floating Mini Satellite Islets surrounding the main island
  const miniIslets: [number, number, number, number][] = [
    [-35, -1.5, 4, 2.8],
    [35, -1.0, -5, 3.1],
    [26, -2.8, 25, 2.5],
    [-25, -2.2, -26, 2.6],
  ];
  const miniIsletMeshes: { mesh: THREE.Group; baseY: number; phase: number }[] = [];
  miniIslets.forEach(([x, y, z, r], idx) => {
    const mg = new THREE.Group();
    mg.position.set(x, y, z);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, 0.55, 14), hillMat);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(r * 0.88, r * 1.45, 10), cliffMat);
    bot.rotation.x = Math.PI;
    bot.position.y = -r * 0.72 - 0.25;
    const miniTreeTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    miniTreeTrunk.position.y = 0.8;
    const miniTreeCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 })
    );
    miniTreeCrown.position.y = 1.75;
    mg.add(top, bot, miniTreeTrunk, miniTreeCrown);
    group.add(mg);
    miniIsletMeshes.push({ mesh: mg, baseY: y, phase: idx * 1.4 });
  });

  // =======================================================
  // 4. ANIMATED CASCADING WATERFALLS (EDGE & HIGHLAND)
  // =======================================================
  const waterfallTex = createWaterfallTexture(maxAnisotropy);
  const waterfallMat = new THREE.MeshStandardMaterial({
    map: waterfallTex,
    color: 0x67e8f9,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.38,
    roughness: 0.15,
    transparent: true,
    opacity: 0.88,
  });

  // Front-left Cliff Waterfall (where the river spills off the island!)
  const edgeFall = new THREE.Mesh(new THREE.BoxGeometry(4.4, 11.5, 0.65), waterfallMat);
  edgeFall.position.set(-5.8, -5.6, 28.8);
  edgeFall.rotation.y = -0.22;
  group.add(edgeFall);

  // Northeast Highland Waterfall beside Hutan Harapan
  const highlandFall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.8, 0.6), waterfallMat);
  highlandFall.position.set(19.8, 2.3, -18.2);
  highlandFall.rotation.y = -Math.PI / 4;
  group.add(highlandFall);

  const highlandPool = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 24),
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.2,
    })
  );
  highlandPool.rotation.x = -Math.PI / 2;
  highlandPool.position.set(18.6, 0.08, -17.0);
  group.add(highlandPool);

  // Animated Foam Rings at waterfall bases
  const foamRings: THREE.Mesh[] = [];
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.72,
  });
  [
    [-5.8, -10.8, 29.0, 2.6],
    [18.6, 0.1, -17.0, 1.9],
  ].forEach(([fx, fy, fz, fr], idx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(fr, 0.24, 8, 24), foamMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(fx, fy, fz);
    ring.userData = { phase: idx * 1.2 };
    group.add(ring);
    foamRings.push(ring);
  });

  // =======================================================
  // 5. COBBLESTONE WALKWAYS, WOODEN BRIDGE & FRONT PORTAL GATE
  // =======================================================
  const stoneTex = createStonePathTexture(maxAnisotropy);
  const pathMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.82,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Connect Plaza (0,0,0) to outer 4 Mission Zones + Front Portal Gate (0,0,26)
  const routeTargets: [number, number][] = [
    ...missions.filter((m) => m.id !== 5).map((m): [number, number] => [m.position[0], m.position[2]]),
    [0, 26.5],
  ];
  routeTargets.forEach(([tx, tz]) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(tx * 0.5, 0.05, tz * 0.5 + (tz > 0 ? 1.2 : -0.6)),
      new THREE.Vector3(tx, 0.05, tz),
    ]);
    const pathGeo = new THREE.TubeGeometry(curve, 22, 0.92, 6, false);
    pathGeo.scale(1, 0.06, 1);
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    pathMesh.position.y = 0.04;
    pathMesh.receiveShadow = true;
    group.add(pathMesh);
  });

  // Wooden Bridge spanning the Turquoise River near Zone 1
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.82 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
  const bridge = new THREE.Group();
  bridge.position.set(-11.4, 0.22, 14.5);
  bridge.rotation.y = 0.72;
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.24, 2.2), woodMat);
  bridgeDeck.position.y = 0.24;
  bridgeDeck.castShadow = true;
  bridgeDeck.receiveShadow = true;
  bridge.add(bridgeDeck);
  [-1.02, 1.02].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.12, 0.12), darkWoodMat);
    rail.position.set(0, 0.92, rz);
    bridge.add(rail);
    [-2.5, 0, 2.5].forEach((rx) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), darkWoodMat);
      post.position.set(rx, 0.6, rz);
      bridge.add(post);
    });
  });
  group.add(bridge);

  // Grand Front Entrance Portal Gate & Pier ([0, 0, 27.8])
  const gateGroup = new THREE.Group();
  gateGroup.position.set(0, 0, 27.6);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.28, 4.2), woodMat);
  pier.position.set(0, 0.14, 1.2);
  pier.castShadow = true;
  gateGroup.add(pier);

  const stoneGateMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5, metalness: 0.15 });
  [-1.85, 1.85].forEach((gx) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 3.2, 10), stoneGateMat);
    pillar.position.set(gx, 1.6, 0);
    pillar.castShadow = true;
    gateGroup.add(pillar);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfacc15,
        emissiveIntensity: 0.95,
      })
    );
    lantern.position.set(gx, 3.35, 0);
    gateGroup.add(lantern);
  });

  const portalArch = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.24, 10, 24, Math.PI),
    stoneGateMat
  );
  portalArch.position.set(0, 2.35, 0);
  gateGroup.add(portalArch);

  const entranceVortex = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.12, 12, 32),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.0,
    })
  );
  entranceVortex.position.set(0, 1.85, 0);
  gateGroup.add(entranceVortex);

  const portalDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.18, 24),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
  );
  portalDisc.position.set(0, 1.85, 0);
  gateGroup.add(portalDisc);
  group.add(gateGroup);

  // =======================================================
  // 6. LUSH TREES (PINE + BROADLEAF), FLOWERS, ROCKS & CRYSTALS
  // =======================================================
  const treeCoords: { x: number; z: number; scale: number; isBroad: boolean }[] = [];
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    // Leave clean opening around front portal gate & southwest waterfall
    if (Math.abs(angle - Math.PI / 2) < 0.24 || Math.abs(angle - 1.78) < 0.18) continue;
    const radius = 23.2 + (i % 4) * 1.45;
    treeCoords.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      scale: 0.88 + (i % 5) * 0.11,
      isBroad: i % 2 === 0,
    });
  }
  // Extra lush grove in Zone 3 (Hutan Harapan)
  [
    [8.5, -15.5],
    [16.2, -16.2],
    [18.5, -9.2],
    [10.2, -7.8],
    [15.4, -14.8],
    [7.8, -11.4],
    [19.5, -13.2],
    [12.2, -18.2],
    [20.2, -6.5],
  ].forEach(([x, z], idx) => {
    treeCoords.push({ x, z, scale: 1.05 + (idx % 3) * 0.16, isBroad: idx % 2 === 1 });
  });

  const dummy = new THREE.Object3D();
  const tempColor = new THREE.Color();

  const pineList = treeCoords.filter((t) => !t.isBroad);
  const broadList = treeCoords.filter((t) => t.isBroad);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const leafInstMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });

  // Pine Trees (2-tier conical foliage)
  if (pineList.length > 0) {
    const pTrunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1.7, 8);
    pTrunkGeo.translate(0, 0.85, 0);
    const pCrown1Geo = new THREE.ConeGeometry(1.35, 2.4, 9);
    pCrown1Geo.translate(0, 2.35, 0);
    const pCrown2Geo = new THREE.ConeGeometry(1.0, 2.0, 9);
    pCrown2Geo.translate(0, 3.55, 0);

    const pTrunks = new THREE.InstancedMesh(pTrunkGeo, trunkMat, pineList.length);
    const pCrowns1 = new THREE.InstancedMesh(pCrown1Geo, leafInstMat, pineList.length);
    const pCrowns2 = new THREE.InstancedMesh(pCrown2Geo, leafInstMat, pineList.length);
    pTrunks.castShadow = true;
    pCrowns1.castShadow = true;
    pCrowns2.castShadow = true;

    pineList.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.y = i * 0.9;
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      pTrunks.setMatrixAt(i, dummy.matrix);
      pCrowns1.setMatrixAt(i, dummy.matrix);
      pCrowns2.setMatrixAt(i, dummy.matrix);
      tempColor.setHSL(0.35 + (i % 4) * 0.015, 0.72, 0.36 + (i % 3) * 0.04);
      pCrowns1.setColorAt(i, tempColor);
      pCrowns2.setColorAt(i, tempColor.clone().offsetHSL(0, 0, 0.05));
    });
    [pTrunks, pCrowns1, pCrowns2].forEach((inst) => {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    });
  }

  // Broadleaf Tropical Trees (rounded lush canopies)
  if (broadList.length > 0) {
    const bTrunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 1.9, 8);
    bTrunkGeo.translate(0, 0.95, 0);
    const bCrownGeo = new THREE.DodecahedronGeometry(1.42, 1);
    bCrownGeo.translate(0, 2.85, 0);

    const bTrunks = new THREE.InstancedMesh(bTrunkGeo, trunkMat, broadList.length);
    const bCrowns = new THREE.InstancedMesh(bCrownGeo, leafInstMat, broadList.length);
    bTrunks.castShadow = true;
    bCrowns.castShadow = true;

    broadList.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.y = i * 1.1;
      dummy.scale.set(b.scale * 1.05, b.scale, b.scale * 1.05);
      dummy.updateMatrix();
      bTrunks.setMatrixAt(i, dummy.matrix);
      bCrowns.setMatrixAt(i, dummy.matrix);
      tempColor.setHSL(0.28 + (i % 5) * 0.02, 0.74, 0.42 + (i % 3) * 0.04);
      bCrowns.setColorAt(i, tempColor);
    });
    [bTrunks, bCrowns].forEach((inst) => {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    });
  }

  // Colorful Flowerbeds & Bushes across Meadow & Paths (InstancedMesh)
  const flowerCount = 58;
  const bushGeo = new THREE.SphereGeometry(0.55, 8, 8);
  bushGeo.translate(0, 0.28, 0);
  const bushInst = new THREE.InstancedMesh(
    bushGeo,
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 }),
    flowerCount
  );
  const blossomGeo = new THREE.DodecahedronGeometry(0.24, 0);
  blossomGeo.translate(0, 0.58, 0);
  const blossomInst = new THREE.InstancedMesh(
    blossomGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }),
    flowerCount
  );
  const flowerPalette = [0xf472b6, 0xfacc15, 0xfb7185, 0x38bdf8, 0xc084fc];
  for (let i = 0; i < flowerCount; i++) {
    const a = (i / flowerCount) * Math.PI * 2 + 0.35;
    const r = 7.6 + ((i * 7) % 16);
    dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    dummy.rotation.y = i * 0.7;
    dummy.scale.setScalar(0.75 + (i % 3) * 0.22);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    blossomInst.setMatrixAt(i, dummy.matrix);
    tempColor.setHex(flowerPalette[i % flowerPalette.length]);
    blossomInst.setColorAt(i, tempColor);
  }
  [bushInst, blossomInst].forEach((inst) => {
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  });

  // Coastal Rocks & Magical Glowing Eco-Crystals
  const rockCount = 36;
  const rockInst = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1.1, 0),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, flatShading: true }),
    rockCount
  );
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  for (let i = 0; i < rockCount; i++) {
    const a = (i / rockCount) * Math.PI * 2 + 0.12;
    const r = 27.2 + (i % 3) * 0.85;
    dummy.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
    dummy.rotation.set(i * 0.4, i * 0.9, 0);
    dummy.scale.set(1.0 + (i % 3) * 0.3, 0.65 + (i % 2) * 0.35, 1.0 + (i % 4) * 0.2);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  // Cute Mushrooms near Hutan Harapan & Glowing Purple/Cyan Crystals
  const crystalMatPurple = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0xa855f7,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });
  [
    [18.5, 0, 14.5],
    [19.6, 0, 7.2],
    [-20.5, 0, 15.5],
    [10.8, 0, -18.5],
  ].forEach(([cx, cy, cz]) => {
    const cluster = new THREE.Group();
    cluster.position.set(cx, cy, cz);
    for (let j = 0; j < 3; j++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 - j * 0.08, 0), crystalMatPurple);
      shard.scale.set(0.7, 1.8, 0.7);
      shard.position.set((j - 1) * 0.45, 0.65 - j * 0.12, (j % 2) * 0.25);
      shard.rotation.z = (j - 1) * 0.28;
      cluster.add(shard);
    }
    group.add(cluster);
  });

  // =======================================================
  // 7. ANIMATED SKY BIRDS & COLORFUL BUTTERFLIES
  // =======================================================
  const birds: { grp: THREE.Group; lWing: THREE.Mesh; rWing: THREE.Mesh; radius: number; speed: number; baseY: number; phase: number }[] = [];
  const birdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const wingGeo = new THREE.BoxGeometry(0.65, 0.04, 0.24);
  for (let i = 0; i < 5; i++) {
    const bg = new THREE.Group();
    const lWing = new THREE.Mesh(wingGeo, birdMat);
    lWing.position.x = -0.32;
    const rWing = new THREE.Mesh(wingGeo, birdMat);
    rWing.position.x = 0.32;
    bg.add(lWing, rWing);
    group.add(bg);
    birds.push({
      grp: bg,
      lWing,
      rWing,
      radius: 16 + i * 3.8,
      speed: 0.32 + i * 0.05,
      baseY: 13.5 + (i % 3) * 2.4,
      phase: i * 1.3,
    });
  }

  const butterflies: { grp: THREE.Group; lWing: THREE.Mesh; rWing: THREE.Mesh; cx: number; cz: number; phase: number }[] = [];
  const bFlyColors = [0xfacc15, 0xf472b6, 0x38bdf8, 0xa855f7, 0xfb923c, 0x4ade80];
  const bWingGeo = new THREE.BoxGeometry(0.2, 0.02, 0.16);
  [
    [11, -10],
    [15, -14],
    [-8, 12],
    [5, 8],
    [-4, -6],
    [13, -7],
  ].forEach(([cx, cz], idx) => {
    const bf = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: bFlyColors[idx % bFlyColors.length] });
    const lWing = new THREE.Mesh(bWingGeo, mat);
    lWing.position.x = -0.1;
    const rWing = new THREE.Mesh(bWingGeo, mat);
    rWing.position.x = 0.1;
    bf.add(lWing, rWing);
    bf.position.set(cx, 1.3, cz);
    group.add(bf);
    butterflies.push({ grp: bf, lWing, rWing, cx, cz, phase: idx * 1.1 });
  });

  // =======================================================
  // 8. PER-FRAME ANIMATION LOOP (Zero allocations)
  // =======================================================
  const animate = (elapsed: number, dt: number) => {
    // Flowing waterfalls
    waterfallTex.offset.y -= dt * 1.35;

    // Portal vortex spin
    entranceVortex.rotation.z += dt * 1.4;

    // Fluffy clouds gentle orbit & bob
    clouds.forEach((c) => {
      const a = c.angle + elapsed * c.speed;
      c.obj.position.set(
        Math.cos(a) * c.radius,
        c.baseY + Math.sin(elapsed * 0.7 + c.angle) * 0.45,
        Math.sin(a) * c.radius
      );
    });

    // Mini floating rock islets bobbing
    miniIsletMeshes.forEach((m) => {
      m.mesh.position.y = m.baseY + Math.sin(elapsed * 1.1 + m.phase) * 0.32;
    });

    // Waterfall foam pulse
    foamRings.forEach((ring) => {
      const p = Math.sin(elapsed * 3.0 + ring.userData.phase);
      const sc = 1 + p * 0.08;
      ring.scale.set(sc, sc, 1);
    });

    // Birds circling & flapping wings
    birds.forEach((b) => {
      const a = elapsed * b.speed + b.phase;
      b.grp.position.set(
        Math.cos(a) * b.radius,
        b.baseY + Math.sin(elapsed * 1.4 + b.phase) * 0.65,
        Math.sin(a) * b.radius
      );
      b.grp.rotation.y = -a;
      const flap = Math.sin(elapsed * 9.5 + b.phase) * 0.48;
      b.lWing.rotation.z = flap;
      b.rWing.rotation.z = -flap;
    });

    // Butterflies fluttering over flowers & forest
    butterflies.forEach((bf) => {
      const t = elapsed * 1.8 + bf.phase;
      bf.grp.position.set(
        bf.cx + Math.sin(t) * 1.4,
        1.15 + Math.sin(t * 2.2) * 0.35,
        bf.cz + Math.cos(t * 0.85) * 1.4
      );
      bf.grp.rotation.y = t;
      const flap = Math.sin(elapsed * 18 + bf.phase) * 0.68;
      bf.lWing.rotation.z = flap;
      bf.rWing.rotation.z = -flap;
    });
  };

  return { group, islandGround, animate };
}
