import * as THREE from 'three';
import { AvatarId } from '../types/game';
import {
  createEarthTexture,
  createFloatingLabelSprite,
  createMetalHazardTexture,
  createPlazaTileTexture,
  createWaterFlowTexture,
} from './textures';

export interface AgentRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  jetCore: THREE.Mesh;
}

export function buildEcoAgentAvatar(
  avatarId: AvatarId,
  shadowTex: THREE.Texture
): AgentRig {
  const palette: Record<AvatarId, { suit: number; trim: number; visor: number }> = {
    rimba: { suit: 0x16a34a, trim: 0xf59e0b, visor: 0x38bdf8 },
    tirta: { suit: 0x0284c7, trim: 0x38bdf8, visor: 0xfde047 },
    bayu: { suit: 0x0d9488, trim: 0xfacc15, visor: 0x22d3ee },
    suara: { suit: 0xd97706, trim: 0xfde047, visor: 0x4ade80 },
  };
  const pal = palette[avatarId] || palette.rimba;

  const group = new THREE.Group();

  // Contact shadow disc grounded at y = 0.02
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const suitMat = new THREE.MeshStandardMaterial({
    color: pal.suit,
    roughness: 0.45,
    metalness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: pal.trim,
    roughness: 0.25,
    metalness: 0.65,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.2,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: pal.visor,
    roughness: 0.1,
    metalness: 0.1,
    emissive: pal.visor,
    emissiveIntensity: 0.35,
    clearcoat: 1.0,
  });

  // Boots + Legs (pivoted for walk cycle)
  const legGeo = new THREE.CapsuleGeometry(0.16, 0.42, 4, 10);
  const leftLeg = new THREE.Mesh(legGeo, darkMat);
  leftLeg.position.set(-0.22, 0.42, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, darkMat);
  rightLeg.position.set(0.22, 0.42, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Torso Jacket
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.33, 0.85, 14), suitMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);

  // Chest Eco-Emblem Badge
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), trimMat);
  emblem.position.set(0, 1.25, 0.36);
  group.add(emblem);

  // Eco-Jetpack on back
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.24), darkMat);
  pack.position.set(0, 1.2, -0.38);
  pack.castShadow = true;
  group.add(pack);

  const jetCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.22, 12),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
  );
  jetCore.position.set(0, 0.92, -0.38);
  group.add(jetCore);

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.44, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, suitMat);
  leftArm.position.set(-0.5, 1.15, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, suitMat);
  rightArm.position.set(0.5, 1.15, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Helmet / Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 18), trimMat);
  head.position.y = 1.9;
  head.castShadow = true;
  group.add(head);

  // Glowing Visor
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.2, 0.24),
    visorMat
  );
  visor.position.set(0, 1.92, 0.26);
  group.add(visor);

  // Species accent ears/crest based on avatarId
  if (avatarId === 'rimba' || avatarId === 'suara') {
    const earGeo = new THREE.ConeGeometry(0.12, 0.28, 6);
    const lEar = new THREE.Mesh(earGeo, suitMat);
    lEar.position.set(-0.22, 2.26, 0);
    lEar.rotation.z = 0.25;
    const rEar = new THREE.Mesh(earGeo, suitMat);
    rEar.position.set(0.22, 2.26, 0);
    rEar.rotation.z = -0.25;
    group.add(lEar, rEar);
  } else if (avatarId === 'tirta') {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 8), visorMat);
    fin.position.set(0, 2.28, -0.05);
    fin.rotation.x = -0.35;
    group.add(fin);
  } else if (avatarId === 'bayu') {
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.38), trimMat);
    crest.position.set(0, 2.26, -0.04);
    group.add(crest);
  }

  return { group, leftLeg, rightLeg, leftArm, rightArm, jetCore };
}

export interface ZoneBeaconHandle {
  group: THREE.Group;
  crystal: THREE.Mesh;
  starMesh: THREE.Mesh;
  ring: THREE.Mesh;
  outerRing: THREE.Mesh;
  portalArchGroup: THREE.Group;
  portalArchRing: THREE.Mesh;
  portalVortex: THREE.Mesh;
  lightBeam: THREE.Mesh;
  shockwaveRing: THREE.Mesh;
  sparkGroup: THREE.Group;
  label: THREE.Sprite;
  hitProxy: THREE.Mesh;
}

export function buildZoneBeacon(
  missionId: number,
  title: string,
  subtitle: string,
  colorHex: string,
  entranceFacingOffset?: [number, number]
): ZoneBeaconHandle {
  const group = new THREE.Group();
  const color = new THREE.Color(colorHex);

  // Inner Glowing Teleport Ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.35, 2.85, 36),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.85,
      side: THREE.DoubleSide,
      roughness: 0.25,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  // Outer Energy Halo Ring
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(3.05, 3.28, 36),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.07;
  group.add(outerRing);

  // Expanding Ground Energy Shockwave Ring (pulses outward during portal activation)
  const shockwaveRing = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.85, 40),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  shockwaveRing.rotation.x = -Math.PI / 2;
  shockwaveRing.position.y = 0.14;
  group.add(shockwaveRing);

  // Vertical Glowing Portal Gateway (oriented toward the agent's approach direction)
  const portalArchGroup = new THREE.Group();
  if (entranceFacingOffset) {
    const [dx, dz] = entranceFacingOffset;
    portalArchGroup.rotation.y = Math.atan2(dx, dz);
  }
  portalArchGroup.position.set(0, 1.75, 0);

  const portalArchRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, 0.11, 14, 44),
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.8,
      metalness: 0.65,
      roughness: 0.2,
    })
  );
  portalArchGroup.add(portalArchRing);

  const goldArchTrim = new THREE.Mesh(
    new THREE.TorusGeometry(1.82, 0.06, 10, 44),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.55,
      metalness: 0.85,
      roughness: 0.18,
    })
  );
  portalArchGroup.add(goldArchTrim);

  const portalVortex = new THREE.Mesh(
    new THREE.CircleGeometry(1.48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  portalArchGroup.add(portalVortex);
  group.add(portalArchGroup);

  // Upward Volumetric Portal Light Beam (ignites brightly on activation)
  const lightBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 2.05, 9.5, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  lightBeam.position.y = 4.75;
  group.add(lightBeam);

  // Swirling Orbiting Cyan & Gold Energy Sparks around Portal
  const sparkGroup = new THREE.Group();
  const sparkGeo = new THREE.OctahedronGeometry(0.14, 0);
  const cyanSparkMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  });
  const goldSparkMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Mesh(sparkGeo, i % 2 === 0 ? cyanSparkMat : goldSparkMat);
    const a = (i / 10) * Math.PI * 2;
    sp.position.set(Math.cos(a) * 2.1, 0.5 + (i % 5) * 0.7, Math.sin(a) * 2.1);
    sp.userData = { angle: a, baseY: sp.position.y, speed: 1.5 + (i % 3) * 0.45 };
    sparkGroup.add(sp);
  }
  group.add(sparkGroup);

  // Physical 3D Wooden & Gold Mission Signboard beside portal
  const signGroup = new THREE.Group();
  signGroup.position.set(2.9, 0, 1.8);
  signGroup.rotation.y = -0.35;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.0, 8), postMat);
  signPost.position.y = 1.0;
  signPost.castShadow = true;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.85, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 })
  );
  board.position.y = 1.78;
  board.castShadow = true;
  const boardFace = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.66, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0f294a, roughness: 0.35 })
  );
  boardFace.position.y = 1.78;
  const signGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2, 0),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 })
  );
  signGem.position.y = 2.42;
  signGroup.add(signPost, board, boardFace, signGem);
  group.add(signGroup);

  // Floating 3D Game Crystal
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.75, 0),
    new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.25,
      clearcoat: 1,
    })
  );
  crystal.position.y = 4.6;
  crystal.castShadow = true;
  group.add(crystal);

  // Golden Achievement Star Orbiting/Crowning the Crystal
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.38 : 0.17;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  starGeo.center();
  const starMesh = new THREE.Mesh(
    starGeo,
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.65,
      metalness: 0.75,
      roughness: 0.2,
    })
  );
  starMesh.position.y = 5.65;
  group.add(starMesh);

  const label = createFloatingLabelSprite(`MISI ${missionId}: ${title}`, subtitle, colorHex);
  label.position.set(0, 6.75, 0);
  group.add(label);

  // Invisible simplified raycast hit box on layer 1
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 7.8, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = 3.9;
  hitProxy.layers.set(1);
  hitProxy.userData = { type: 'zone', missionId };
  group.add(hitProxy);

  return {
    group,
    crystal,
    starMesh,
    ring,
    outerRing,
    portalArchGroup,
    portalArchRing,
    portalVortex,
    lightBeam,
    shockwaveRing,
    sparkGroup,
    label,
    hitProxy,
  };
}

export function buildZone1RiverFactory(
  maxAnisotropy: number
): {
  group: THREE.Group;
  riverMesh: THREE.Mesh;
  riverMat: THREE.MeshStandardMaterial;
  riverTex: THREE.CanvasTexture;
  sludgeStream: THREE.Mesh;
  rescueBoat: THREE.Group;
  clueMeshes: Record<'paip' | 'ikan' | 'bau', THREE.Group>;
} {
  const group = new THREE.Group();
  const hazardTex = createMetalHazardTexture(maxAnisotropy);
  const riverTex = createWaterFlowTexture(maxAnisotropy);

  // Winding Bright Turquoise River extending from Zone 1 out to front-left waterfall edge
  const riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-23.5, 0.05, 3.2),
    new THREE.Vector3(-17.5, 0.05, 8.8),
    new THREE.Vector3(-12.0, 0.05, 14.5),
    new THREE.Vector3(-8.2, 0.05, 21.5),
    new THREE.Vector3(-5.8, 0.05, 28.4),
  ]);
  const riverGeo = new THREE.TubeGeometry(riverCurve, 36, 2.85, 8, false);
  riverGeo.scale(1, 0.08, 1);

  const riverMat = new THREE.MeshStandardMaterial({
    map: riverTex,
    color: 0x38bdf8,
    roughness: 0.14,
    metalness: 0.25,
    emissive: 0x0284c7,
    emissiveIntensity: 0.28,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.position.y = 0.09;
  riverMesh.receiveShadow = true;
  group.add(riverMesh);

  // Cozy Red-Roofed River Ranger Station / Boathouse (from reference visual)
  const boathouse = new THREE.Group();
  boathouse.position.set(-14.2, 0, 5.2);
  boathouse.rotation.y = 0.35;
  const bhWalls = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.1, 2.8),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.78 })
  );
  bhWalls.position.y = 1.05;
  bhWalls.castShadow = true;
  bhWalls.receiveShadow = true;
  const bhRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 1.5, 4),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55 })
  );
  bhRoof.position.y = 2.85;
  bhRoof.rotation.y = Math.PI / 4;
  bhRoof.castShadow = true;
  const bhDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.35, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 })
  );
  bhDoor.position.set(0, 0.68, 1.41);
  const bhWin = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.7,
    })
  );
  bhWin.position.set(1.05, 1.2, 1.41);
  boathouse.add(bhWalls, bhRoof, bhDoor, bhWin);
  group.add(boathouse);

  // Cute Anchored Wooden Rescue Boat bobbing on the turquoise river
  const rescueBoat = new THREE.Group();
  rescueBoat.position.set(-13.8, 0.28, 12.2);
  rescueBoat.rotation.y = -0.65;
  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.35, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
  );
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(0.65, 1, 0.85);
  const cabinB = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.45, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  cabinB.position.set(0.1, 0.32, 0);
  const buoy = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.055, 8, 14),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
  );
  buoy.position.set(-0.35, 0.25, 0.38);
  rescueBoat.add(hull, cabinB, buoy);
  group.add(rescueBoat);

  // Textile Factory Awareness Building (multi-part composite)
  const factory = new THREE.Group();
  factory.position.set(-20.8, 0, 7.6);

  const hall = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 3.2, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85, metalness: 0.05 })
  );
  hall.position.y = 1.6;
  hall.castShadow = true;
  hall.receiveShadow = true;
  factory.add(hall);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.8, 1.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 })
  );
  roof.position.y = 3.9;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  factory.add(roof);

  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.55, 5.4, 14),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.6 })
  );
  stack.position.set(-1.6, 2.7, -1.1);
  stack.castShadow = true;
  factory.add(stack);

  // Hazard band on chimney
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.47, 0.49, 0.7, 14),
    new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.4 })
  );
  band.position.set(-1.6, 4.4, -1.1);
  factory.add(band);

  // Chemical discharge pipe aiming at river
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 3.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.8 })
  );
  pipe.rotation.z = Math.PI / 2.2;
  pipe.position.set(2.8, 1.1, 0.6);
  factory.add(pipe);

  const sludgeStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.35, 1.2, 10),
    new THREE.MeshStandardMaterial({
      color: 0x4c1d95,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.55,
      roughness: 0.2,
    })
  );
  sludgeStream.position.set(4.1, 0.55, 0.6);
  factory.add(sludgeStream);

  group.add(factory);

  // Wooden Jetty + Pak Mail 3D NPC
  const jetty = new THREE.Group();
  jetty.position.set(-14.2, 0, 10.6);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.22, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 })
  );
  deck.position.y = 0.35;
  deck.castShadow = true;
  jetty.add(deck);
  [-1.0, 1.0].forEach((px) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.65, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    post.position.set(px, 0.25, 0.65);
    jetty.add(post);
  });

  // Pak Mail NPC figure
  const npcBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.85, 12),
    new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.7 })
  );
  npcBody.position.set(0, 0.88, 0);
  npcBody.castShadow = true;
  jetty.add(npcBody);
  const npcHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.6 })
  );
  npcHead.position.set(0, 1.5, 0);
  jetty.add(npcHead);
  const npcHat = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.24, 14),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
  );
  npcHat.position.set(0, 1.72, 0);
  jetty.add(npcHat);
  group.add(jetty);

  // 3 Interactive 3D Clue Hotspots in Zone 1
  const clueMeshes = {
    paip: createClue3DMarker('paip', [-16.6, 1.1, 8.6], 0xa855f7),
    ikan: createClue3DMarker('ikan', [-12.2, 0.55, 13.5], 0x38bdf8),
    bau: createClue3DMarker('bau', [-16.8, 1.1, 14.2], 0xfacc15),
  };
  Object.values(clueMeshes).forEach((m) => group.add(m));

  return { group, riverMesh, riverMat, riverTex, sludgeStream, rescueBoat, clueMeshes };
}

function createClue3DMarker(
  clueId: 'paip' | 'ikan' | 'bau',
  pos: [number, number, number],
  color: number
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...pos);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.52, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 })
  );
  base.position.y = 0.25;
  g.add(base);

  const orb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.48, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    })
  );
  orb.position.y = 1.05;
  orb.name = 'clueOrb';
  g.add(orb);

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 10, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.9;
  hit.layers.set(1);
  hit.userData = { type: 'clue', clueId };
  g.add(hit);

  return g;
}

export function buildZone2ToxicCity(maxAnisotropy: number): {
  group: THREE.Group;
  smogGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const hazardTex = createMetalHazardTexture(maxAnisotropy);

  const base = new THREE.Group();
  base.position.set(-14, 0, -12);

  // Industrial Plant
  const plant = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 3.6, 4.5),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.3 })
  );
  plant.position.set(-1.5, 1.8, -1.5);
  plant.castShadow = true;
  plant.receiveShadow = true;
  base.add(plant);

  // Twin Smokestacks
  [-2.6, -0.4].forEach((cx) => {
    const ch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.58, 6.2, 14),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.6 })
    );
    ch.position.set(cx, 3.1, -2.1);
    ch.castShadow = true;
    base.add(ch);

    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.48, 0.7, 14),
      new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.4 })
    );
    stripe.position.set(cx, 5.2, -2.1);
    base.add(stripe);
  });

  // Modern Eco-City Research Center & Green Conservatory Dome
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 4.8, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.25 })
  );
  tower.position.set(3.2, 2.4, 0.8);
  tower.castShadow = true;
  base.add(tower);

  const glassBand = new THREE.Mesh(
    new THREE.BoxGeometry(3.92, 0.85, 3.52),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.2,
      clearcoat: 1,
    })
  );
  glassBand.position.set(3.2, 3.2, 0.8);
  base.add(glassBand);

  // Rooftop Green Eco-Conservatory Dome + Solar Panel
  const ecoRoofDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.65,
      clearcoat: 1,
    })
  );
  ecoRoofDome.position.set(3.2, 4.8, 0.8);
  const innerGreenTree = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 })
  );
  innerGreenTree.position.set(3.2, 5.2, 0.8);
  const solarTilt = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 1.4),
    new THREE.MeshPhysicalMaterial({ color: 0x0369a1, metalness: 0.7, roughness: 0.15, clearcoat: 1 })
  );
  solarTilt.position.set(-1.5, 3.85, -1.5);
  solarTilt.rotation.x = 0.4;
  base.add(ecoRoofDome, innerGreenTree, solarTilt);

  // Composite Vehicle on road
  const car = new THREE.Group();
  car.position.set(1.2, 0, 3.4);
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.65, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, metalness: 0.5 })
  );
  chassis.position.y = 0.5;
  chassis.castShadow = true;
  car.add(chassis);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.5, 0.96),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.3 })
  );
  cabin.position.set(-0.1, 1.0, 0);
  car.add(cabin);
  [
    [-0.65, 0.25, 0.55],
    [0.65, 0.25, 0.55],
    [-0.65, 0.25, -0.55],
    [0.65, 0.25, -0.55],
  ].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    car.add(wheel);
  });
  base.add(car);

  // Animated smog puffs
  const smogGroup = new THREE.Group();
  const smogMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.95,
    transparent: true,
    opacity: 0.72,
  });
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 + (i % 3) * 0.25, 1), smogMat);
    puff.position.set(i % 2 === 0 ? -2.6 : -0.4, 6.4 + (i % 4) * 1.1, -2.1 + (i % 2) * 0.4);
    puff.userData.baseY = puff.position.y;
    puff.userData.phase = i * 0.85;
    smogGroup.add(puff);
  }
  base.add(smogGroup);

  group.add(base);
  return { group, smogGroup };
}

export function buildZone3HopeForest(): {
  group: THREE.Group;
  turbineBlades: THREE.Group;
} {
  const group = new THREE.Group();
  const base = new THREE.Group();
  base.position.set(13, 0, -12);

  // Elevated Wooden Forest Treehouse Sanctuary (inspired by upper-right lookout in reference!)
  const stiltMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  [
    [-3.5, -0.6],
    [-0.9, -0.6],
    [-3.5, 1.6],
    [-0.9, 1.6],
  ].forEach(([sx, sz]) => {
    const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 8), stiltMat);
    stilt.position.set(sx, 1.1, sz);
    stilt.castShadow = true;
    base.add(stilt);
  });

  const deckFloor = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.22, 3.2),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.82 })
  );
  deckFloor.position.set(-2.2, 2.05, 0.5);
  deckFloor.castShadow = true;
  base.add(deckFloor);

  const cabinBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.85, 2.3),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
  );
  cabinBody.position.set(-2.2, 3.05, 0.5);
  cabinBody.castShadow = true;
  cabinBody.receiveShadow = true;
  base.add(cabinBody);

  const cabinRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 1.45, 4),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.65 })
  );
  cabinRoof.position.set(-2.2, 4.65, 0.5);
  cabinRoof.rotation.y = Math.PI / 4;
  cabinRoof.castShadow = true;
  base.add(cabinRoof);

  // Wind Turbine Tower
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 6.8, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.4 })
  );
  mast.position.set(3.2, 3.4, -1.8);
  mast.castShadow = true;
  base.add(mast);

  const nacelle = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 1.3),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.5 })
  );
  nacelle.position.set(3.2, 6.8, -1.6);
  base.add(nacelle);

  const turbineBlades = new THREE.Group();
  turbineBlades.position.set(3.2, 6.8, -0.9);
  for (let i = 0; i < 3; i++) {
    const bladeHolder = new THREE.Group();
    bladeHolder.rotation.z = (i * Math.PI * 2) / 3;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 2.6, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.3 })
    );
    blade.position.y = 1.3;
    blade.castShadow = true;
    bladeHolder.add(blade);
    turbineBlades.add(bladeHolder);
  }
  base.add(turbineBlades);

  // Solar Panel Array
  for (let i = 0; i < 2; i++) {
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 })
    );
    stand.position.set(2.0 + i * 2.2, 0.55, 2.4);
    base.add(stand);

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.1, 1.2),
      new THREE.MeshPhysicalMaterial({
        color: 0x0c4a6e,
        roughness: 0.15,
        metalness: 0.6,
        clearcoat: 1,
      })
    );
    panel.position.set(2.0 + i * 2.2, 1.15, 2.4);
    panel.rotation.x = 0.45;
    base.add(panel);
  }

  group.add(base);
  return { group, turbineBlades };
}

export function buildZone4VoiceLab(): {
  group: THREE.Group;
  waveRings: THREE.Mesh[];
  dish: THREE.Group;
} {
  const group = new THREE.Group();
  const base = new THREE.Group();
  base.position.set(15, 0, 10);

  // Stepped Futuristic Purple & Cyan Citadel Platform
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.9, 0.55, 28),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.55 })
  );
  stage.position.y = 0.28;
  stage.receiveShadow = true;
  base.add(stage);

  const stageStep2 = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.8, 0.4, 28),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.6 })
  );
  stageStep2.position.y = 0.72;
  base.add(stageStep2);

  const stageGlowRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.65, 0.08, 10, 36),
    new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 0.95,
    })
  );
  stageGlowRing.rotation.x = Math.PI / 2;
  stageGlowRing.position.y = 0.92;
  base.add(stageGlowRing);

  // Translucent Acoustic Dome Shell
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0xa855f7,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      clearcoat: 1,
    })
  );
  dome.position.y = 0.7;
  dome.renderOrder = 2;
  base.add(dome);

  // Golden Microphone Podium inside dome
  const micStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.2, 2.0, 12),
    new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.85, roughness: 0.2 })
  );
  micStand.position.y = 1.7;
  base.add(micStand);

  const micHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfacc15,
      emissiveIntensity: 0.4,
      metalness: 0.9,
      roughness: 0.2,
    })
  );
  micHead.position.y = 2.85;
  base.add(micHead);

  // Broadcast Satellite Dish
  const dish = new THREE.Group();
  dish.position.set(-3.2, 0, -2.5);
  const dishPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 2.8, 10),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 })
  );
  dishPole.position.y = 1.4;
  dish.add(dishPole);

  const dishBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 0.2, 0.65, 18),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.5, roughness: 0.25 })
  );
  dishBowl.position.set(0, 3.0, 0.2);
  dishBowl.rotation.x = Math.PI / 3;
  dish.add(dishBowl);
  base.add(dish);

  // Harmonic floating rings
  const waveRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(1.4 + i * 0.7, 0.07, 10, 36),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      })
    );
    r.rotation.x = Math.PI / 2;
    r.position.y = 3.6 + i * 0.65;
    r.userData.baseY = r.position.y;
    waveRings.push(r);
    base.add(r);
  }

  group.add(base);
  return { group, waveRings, dish };
}

export function buildZone5EcoMonument(maxAnisotropy: number): {
  group: THREE.Group;
  earthGlobe: THREE.Mesh;
  goldRing: THREE.Mesh;
} {
  const group = new THREE.Group();
  const plazaTex = createPlazaTileTexture(maxAnisotropy);
  const earthTex = createEarthTexture(maxAnisotropy);

  // Tiered Central Eco-Headquarters Plaza + Glowing Cyan Pillars & Banners
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(7.0, 7.5, 0.35, 36),
    new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.55, metalness: 0.12 })
  );
  plaza.position.y = 0.18;
  plaza.receiveShadow = true;
  group.add(plaza);

  const innerDais = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.8, 0.35, 32),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 })
  );
  innerDais.position.y = 0.52;
  innerDais.receiveShadow = true;
  group.add(innerDais);

  const glowingEnergyBase = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.12, 10, 36),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.95,
    })
  );
  glowingEnergyBase.rotation.x = Math.PI / 2;
  glowingEnergyBase.position.y = 0.72;
  group.add(glowingEnergyBase);

  // 4 Glowing Crystal Torch Pillars around Central Headquarters
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.2 });
  const torchMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.95,
  });
  [
    [-4.6, 4.6],
    [4.6, 4.6],
    [-4.6, -4.6],
    [4.6, -4.6],
  ].forEach(([px, pz]) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 1.9, 10), pillarMat);
    col.position.set(px, 1.1, pz);
    col.castShadow = true;
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), torchMat);
    flame.position.set(px, 2.35, pz);
    group.add(col, flame);
  });

  // Pedestal
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 2.2, 1.25, 16),
    new THREE.MeshStandardMaterial({ color: 0x0f294a, roughness: 0.3, metalness: 0.6 })
  );
  plinth.position.y = 1.15;
  plinth.castShadow = true;
  group.add(plinth);

  // Monumental Rotating Glowing 3D Earth Globe
  const earthGlobe = new THREE.Mesh(
    new THREE.SphereGeometry(1.95, 32, 32),
    new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.3,
      metalness: 0.12,
      emissive: 0x0284c7,
      emissiveIntensity: 0.16,
    })
  );
  earthGlobe.position.y = 3.95;
  earthGlobe.castShadow = true;
  group.add(earthGlobe);

  // Tilted Golden Orbital Ring
  const goldRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.68, 0.12, 14, 48),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.55,
      metalness: 0.88,
      roughness: 0.15,
    })
  );
  goldRing.position.y = 3.95;
  goldRing.rotation.x = Math.PI / 3;
  group.add(goldRing);

  return { group, earthGlobe, goldRing };
}

export function buildInstancedForestAndRocks(
  scene: THREE.Object3D,
  zoneCenters: [number, number, number][]
): void {
  // Instanced Pines around Island Perimeter & Zone 3 Hope Forest
  const treePositions: { x: number; z: number; scale: number }[] = [];

  for (let i = 0; i < 65; i++) {
    const angle = (i / 65) * Math.PI * 2;
    const radius = 23.5 + (i % 4) * 1.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    treePositions.push({ x, z, scale: 0.85 + (i % 5) * 0.1 });
  }
  // Extra lush trees in Zone 3 (Hutan Harapan at [13, 0, -12])
  const extraTrees = [
    [9, -15],
    [16, -16],
    [18, -9],
    [11, -8],
    [15, -14],
    [8, -11],
    [19, -13],
    [12, -17],
  ];
  extraTrees.forEach(([x, z], idx) => {
    // Keep away from exact center of Zone 3 cabin/turbine
    if (zoneCenters) {
      treePositions.push({ x, z, scale: 1.0 + (idx % 3) * 0.15 });
    }
  });

  const count = treePositions.length;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1.8, 8);
  trunkGeo.translate(0, 0.9, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  trunkInst.castShadow = true;

  const crownGeo = new THREE.ConeGeometry(1.3, 3.2, 8);
  crownGeo.translate(0, 3.0, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, count);
  crownInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  treePositions.forEach((p, idx) => {
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.y = idx * 0.7;
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    crownInst.setMatrixAt(idx, dummy.matrix);

    // Subtle green variation per tree
    color.setHSL(0.36 + (idx % 5) * 0.015, 0.65, 0.32 + (idx % 4) * 0.04);
    crownInst.setColorAt(idx, color);
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();

  scene.add(trunkInst, crownInst);

  // Natural Coastal Rocks around the Island Shoreline (InstancedMesh)
  const rockCount = 34;
  const rockGeo = new THREE.DodecahedronGeometry(1.1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.05 });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const a = (i / rockCount) * Math.PI * 2 + 0.15;
    const r = 27.5 + (i % 3) * 0.9;
    dummy.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
    dummy.rotation.set(i * 0.4, i * 0.9, 0);
    dummy.scale.set(1.1 + (i % 3) * 0.3, 0.65 + (i % 2) * 0.3, 1.0 + (i % 4) * 0.2);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);
}
