import * as THREE from 'three';
import { AvatarId } from '../types/game';

export interface HumanAgentOptions {
  showPedestal?: boolean;
  maxAnisotropy?: number;
}

export interface HumanAgentRig {
  avatarId: AvatarId;
  group: THREE.Group;
  bodyRoot: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftEyelid: THREE.Mesh;
  rightEyelid: THREE.Mesh;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  chestEmblem: THREE.Mesh;
  fxGroup: THREE.Group;
  fxItems: THREE.Object3D[];
  pedestalRing: THREE.Mesh | null;
  pedestalGlowMat: THREE.MeshStandardMaterial | null;
  welcomeTimer: number;
  hoverAmount: number;
  selectedAmount: number;
  blinkClock: number;
}

export interface AgentAnimState {
  isMoving?: boolean;
  hovered?: boolean;
  selected?: boolean;
  triggerWelcome?: boolean;
  phaseOffset?: number;
  sitAmount?: number;
}

interface AgentStyleSpec {
  primarySuit: number;
  secondarySuit: number;
  pants: number;
  belt: number;
  accentGlow: number;
  skin: number;
  cheek: number;
  hair: number;
  iris: number;
  isFemale: boolean;
}

const AGENT_SPECS: Record<AvatarId, AgentStyleSpec> = {
  tirta: {
    primarySuit: 0xf8fafc, // Crisp white futuristic coat
    secondarySuit: 0x0284c7, // Ocean blue accents & hijab
    pants: 0x0f3b7a,
    belt: 0x0ea5e9,
    accentGlow: 0x38bdf8,
    skin: 0xfbd3b6,
    cheek: 0xfda4af,
    hair: 0x1d4ed8,
    iris: 0x1e3a5f,
    isFemale: true,
  },
  rimba: {
    primarySuit: 0x16a34a, // Lush forest green tunic
    secondarySuit: 0x854d0e, // Earthy brown straps & pouches
    pants: 0x1e293b,
    belt: 0x92400e,
    accentGlow: 0x4ade80,
    skin: 0xf6c9a4,
    cheek: 0xfb923c,
    hair: 0x5c3317,
    iris: 0x4a2c11,
    isFemale: false,
  },
  bayu: {
    primarySuit: 0xf8fafc, // Crisp white windbreaker
    secondarySuit: 0x0d9488, // Turquoise tech trim & hood
    pants: 0x1e293b,
    belt: 0x14b8a6,
    accentGlow: 0x22d3ee,
    skin: 0xfcd5b5,
    cheek: 0xfda4af,
    hair: 0x1f2937,
    iris: 0x3b2314,
    isFemale: false,
  },
  suara: {
    primarySuit: 0x7c3aed, // Vibrant purple tunic
    secondarySuit: 0xf8fafc, // Crisp white panels & boots trim
    pants: 0x312e81,
    belt: 0x5b21b6,
    accentGlow: 0xc084fc,
    skin: 0xfcd5b5,
    cheek: 0xf472b6,
    hair: 0x58311a,
    iris: 0x4c2810,
    isFemale: true,
  },
};

function createEmblemTexture(avatarId: AvatarId, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);
  const bgColors: Record<AvatarId, [string, string]> = {
    tirta: ['#0284c7', '#38bdf8'],
    rimba: ['#15803d', '#4ade80'],
    bayu: ['#0f766e', '#2dd4bf'],
    suara: ['#6d28d9', '#c084fc'],
  };
  const [c1, c2] = bgColors[avatarId];
  const grad = ctx.createRadialGradient(64, 52, 10, 64, 64, 60);
  grad.addColorStop(0, c2);
  grad.addColorStop(1, c1);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (avatarId === 'tirta') {
    // Water drop symbol
    ctx.beginPath();
    ctx.moveTo(64, 24);
    ctx.bezierCurveTo(94, 58, 96, 86, 64, 100);
    ctx.bezierCurveTo(32, 86, 34, 58, 64, 24);
    ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.ellipse(53, 72, 6, 12, -0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatarId === 'rimba') {
    // Leaf symbol
    ctx.beginPath();
    ctx.moveTo(34, 92);
    ctx.quadraticCurveTo(36, 34, 94, 30);
    ctx.quadraticCurveTo(92, 88, 34, 92);
    ctx.fill();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(32, 94);
    ctx.quadraticCurveTo(60, 66, 86, 40);
    ctx.stroke();
  } else if (avatarId === 'bayu') {
    // Wind swirl symbol
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(26, 52);
    ctx.lineTo(74, 52);
    ctx.arc(74, 40, 12, Math.PI / 2, -Math.PI, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(34, 70);
    ctx.lineTo(86, 70);
    ctx.arc(86, 81, 11, -Math.PI / 2, Math.PI * 0.8, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(28, 86);
    ctx.lineTo(62, 86);
    ctx.stroke();
  } else {
    // Sound-wave bars/arcs symbol
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(46, 64, 14, -0.75, 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(46, 64, 28, -0.82, 0.82);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(46, 64, 42, -0.88, 0.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(38, 64, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTeardropGeometry(): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = (t - 0.35) * 0.22;
    const r = Math.sin(t * Math.PI) * (1 - t * 0.55) * 0.085;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  return new THREE.LatheGeometry(pts, 16);
}

function createLeafGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.11);
  shape.bezierCurveTo(0.09, -0.05, 0.09, 0.06, 0, 0.13);
  shape.bezierCurveTo(-0.09, 0.06, -0.09, -0.05, 0, -0.11);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function createMusicalNoteGroup(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), mat);
  head.scale.set(1.25, 0.9, 0.75);
  head.rotation.z = 0.35;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), mat);
  stem.position.set(0.048, 0.1, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.036, 0.02), mat);
  flag.position.set(0.082, 0.185, 0);
  flag.rotation.z = -0.35;
  g.add(head, stem, flag);
  return g;
}

export function buildHumanEcoAgent(
  avatarId: AvatarId,
  shadowTex: THREE.Texture,
  options: HumanAgentOptions = {}
): HumanAgentRig {
  const spec = AGENT_SPECS[avatarId] || AGENT_SPECS.rimba;
  const showPedestal = options.showPedestal ?? false;
  const maxAniso = options.maxAnisotropy ?? 4;

  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  // Materials with clear PBR contrast (roughness & metalness separation >= 0.25)
  const skinMat = new THREE.MeshStandardMaterial({
    color: spec.skin,
    roughness: 0.62,
    metalness: 0.02,
  });
  const cheekMat = new THREE.MeshStandardMaterial({
    color: spec.cheek,
    roughness: 0.75,
    transparent: true,
    opacity: 0.45,
  });
  const suitMat = new THREE.MeshStandardMaterial({
    color: spec.primarySuit,
    roughness: 0.42,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.secondarySuit,
    roughness: 0.36,
    metalness: 0.14,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: spec.pants,
    roughness: 0.58,
    metalness: 0.06,
  });
  const beltMat = new THREE.MeshStandardMaterial({
    color: spec.belt,
    roughness: 0.32,
    metalness: 0.35,
  });
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.85,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: spec.accentGlow,
    emissive: spec.accentGlow,
    emissiveIntensity: 0.9,
    roughness: 0.18,
    metalness: 0.15,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: spec.hair,
    roughness: 0.48,
    metalness: 0.06,
  });

  // Ground Contact Shadow (always grounded at y = 0.02)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Optional Glowing Hero Pedestal (for character selection / 3D stage)
  let pedestalRing: THREE.Mesh | null = null;
  let pedestalGlowMat: THREE.MeshStandardMaterial | null = null;
  if (showPedestal) {
    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.9, 0.1, 32),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.65,
      })
    );
    baseDisc.position.y = 0.05;
    baseDisc.receiveShadow = true;
    group.add(baseDisc);

    pedestalGlowMat = new THREE.MeshStandardMaterial({
      color: spec.accentGlow,
      emissive: spec.accentGlow,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.25,
    });
    pedestalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.045, 12, 36),
      pedestalGlowMat
    );
    pedestalRing.rotation.x = Math.PI / 2;
    pedestalRing.position.y = 0.105;
    group.add(pedestalRing);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.53, 32),
      pedestalGlowMat
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.106;
    group.add(innerRing);
  }

  const baseLift = showPedestal ? 0.1 : 0;

  // ==========================
  // LEGS & BOOTS (Articulated)
  // ==========================
  function buildLeg(side: -1 | 1): { hipPivot: THREE.Group; kneePivot: THREE.Group } {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.17, 0.78 + baseLift, 0);

    // Thigh
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.26, 6, 12), pantsMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    hipPivot.add(thigh);

    // Knee Pivot + Lower Leg + Boot (y = -0.34 from hipPivot)
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.34, 0);
    hipPivot.add(kneePivot);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), trimMat);
    kneePad.position.set(0, 0, 0.05);
    kneePivot.add(kneePad);

    // Futuristic Two-Tone Boot
    const bootShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.135, 0.28, 14),
      avatarId === 'rimba' ? trimMat : spec.isFemale ? trimMat : suitMat
    );
    bootShaft.position.y = -0.18;
    bootShaft.castShadow = true;
    kneePivot.add(bootShaft);

    const bootCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.125, 0.025, 8, 18),
      avatarId === 'tirta' || avatarId === 'suara' ? suitMat : glowMat
    );
    bootCuff.rotation.x = Math.PI / 2;
    bootCuff.position.y = -0.05;
    kneePivot.add(bootCuff);

    const bootFoot = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.115, 0.16, 6, 12),
      avatarId === 'rimba' ? suitMat : trimMat
    );
    bootFoot.rotation.x = Math.PI / 2;
    bootFoot.position.set(0, -0.34, 0.06);
    bootFoot.castShadow = true;
    kneePivot.add(bootFoot);

    const bootSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.34),
      avatarId === 'rimba' ? beltMat : silverMat
    );
    bootSole.position.set(0, -0.41, 0.06);
    kneePivot.add(bootSole);

    return { hipPivot, kneePivot };
  }

  const leftLegRig = buildLeg(-1);
  const rightLegRig = buildLeg(1);
  const leftHip = leftLegRig.hipPivot;
  const rightHip = rightLegRig.hipPivot;
  const leftKnee = leftLegRig.kneePivot;
  const rightKnee = rightLegRig.kneePivot;
  bodyRoot.add(leftHip, rightHip);

  // ==========================
  // TORSO & HERO COAT
  // ==========================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.8 + baseLift, 0);
  bodyRoot.add(torsoGroup);

  // Main upper torso
  const chestTopR = spec.isFemale ? 0.29 : 0.32;
  const chestBotR = spec.isFemale ? 0.23 : 0.27;
  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(chestTopR, chestBotR, 0.58, 18),
    suitMat
  );
  chest.scale.set(1.06, 1, 0.78);
  chest.position.y = 0.3;
  chest.castShadow = true;
  torsoGroup.add(chest);

  // Shoulder stripe / chest collar V-accent
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.045, 10, 20),
    trimMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.56, 0);
  torsoGroup.add(collar);

  // Flared Coat Skirt / Tunic Tails (gives authentic anime/superhero silhouette!)
  const tunicSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(chestBotR + 0.02, 0.42, 0.36, 18, 1, true, 0.32, Math.PI * 1.8),
    avatarId === 'bayu' ? suitMat : trimMat
  );
  tunicSkirt.material.side = THREE.DoubleSide;
  tunicSkirt.scale.set(1.05, 1, 0.82);
  tunicSkirt.position.y = -0.1;
  tunicSkirt.rotation.y = Math.PI * 0.6;
  tunicSkirt.castShadow = true;
  torsoGroup.add(tunicSkirt);

  // Belt & Metallic Buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(chestBotR + 0.025, chestBotR + 0.025, 0.095, 18),
    beltMat
  );
  belt.scale.set(1.08, 1, 0.82);
  belt.position.y = 0.06;
  torsoGroup.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.06), silverMat);
  buckle.position.set(0, 0.06, 0.23);
  torsoGroup.add(buckle);

  const buckleGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), glowMat);
  buckleGem.position.set(0, 0.06, 0.265);
  torsoGroup.add(buckleGem);

  // Belt Pouches (especially iconic for Rimba & Bayu)
  const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.09), trimMat);
  pouchL.position.set(-0.27, 0.02, 0.06);
  const pouchR = pouchL.clone();
  pouchR.position.x = 0.27;
  torsoGroup.add(pouchL, pouchR);

  // Chest Elemental Emblem Plaque with Crisp CanvasTexture Symbol
  const emblemTex = createEmblemTexture(avatarId, maxAniso);
  const emblemBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20), glowMat);
  emblemBezel.rotation.x = Math.PI / 2;
  emblemBezel.position.set(0, 0.35, 0.235);
  torsoGroup.add(emblemBezel);

  const chestEmblem = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 20),
    new THREE.MeshBasicMaterial({ map: emblemTex })
  );
  chestEmblem.position.set(0, 0.35, 0.252);
  torsoGroup.add(chestEmblem);

  // Character-specific Torso Extras (Hoods, Straps, Backpack)
  if (avatarId === 'rimba' || avatarId === 'bayu') {
    // Cozy rolled ranger/tech hood behind shoulders
    const hoodBack = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.09, 10, 18, Math.PI * 1.25),
      trimMat
    );
    hoodBack.rotation.x = Math.PI / 2 + 0.35;
    hoodBack.rotation.z = -Math.PI * 0.12;
    hoodBack.position.set(0, 0.56, -0.14);
    torsoGroup.add(hoodBack);

    // Shoulder harness straps
    const strapGeo = new THREE.BoxGeometry(0.07, 0.52, 0.42);
    const strapL = new THREE.Mesh(strapGeo, beltMat);
    strapL.position.set(-0.15, 0.32, 0);
    const strapR = strapL.clone();
    strapR.position.x = 0.15;
    torsoGroup.add(strapL, strapR);
  } else if (avatarId === 'tirta') {
    // Flowing front blue coat lapels
    const lapelGeo = new THREE.BoxGeometry(0.1, 0.46, 0.05);
    const lapelL = new THREE.Mesh(lapelGeo, trimMat);
    lapelL.position.set(-0.14, 0.3, 0.21);
    lapelL.rotation.z = -0.16;
    const lapelR = lapelL.clone();
    lapelR.position.x = 0.14;
    lapelR.rotation.z = 0.16;
    torsoGroup.add(lapelL, lapelR);
  } else if (avatarId === 'suara') {
    // Sleek sound-tech backpack
    const soundPack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.14), pantsMat);
    soundPack.position.set(0, 0.32, -0.24);
    const packSpeaker = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), glowMat);
    packSpeaker.position.set(0, 0.32, -0.315);
    torsoGroup.add(soundPack, packSpeaker);
  }

  // ==========================
  // ARMS, GLOVES & HANDS
  // ==========================
  function buildArm(side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (chestTopR + 0.07), 0.53, 0);

    // Shoulder Pad / Sleeve Cap
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), trimMat);
    shoulder.add(pad);

    // Upper Arm
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.2, 6, 10), suitMat);
    upperArm.position.y = -0.15;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    // Elbow Pivot + Forearm + Glove + Hand
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.076, 0.18, 6, 10),
      avatarId === 'rimba' ? skinMat : trimMat
    );
    forearm.position.y = -0.12;
    forearm.castShadow = true;
    elbow.add(forearm);

    const wristBand = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.06, 12), glowMat);
    wristBand.position.y = -0.22;
    elbow.add(wristBand);

    // Stylized Hand (palm + thumb + fingers mitts so hands read clearly like 3D cartoons)
    const handMat = avatarId === 'bayu' ? pantsMat : skinMat;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), handMat);
    palm.scale.set(0.95, 1.1, 0.72);
    palm.position.y = -0.3;
    elbow.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.055, 4, 8), handMat);
    thumb.position.set(-side * 0.065, -0.285, 0.03);
    thumb.rotation.z = side * 0.55;
    elbow.add(thumb);

    return { shoulder, elbow };
  }

  const leftArmRig = buildArm(-1);
  const rightArmRig = buildArm(1);
  torsoGroup.add(leftArmRig.shoulder, rightArmRig.shoulder);

  // ==========================
  // HEAD, EXPRESSIVE FACE & HAIR / HIJAB
  // ==========================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.65, 0);
  torsoGroup.add(headGroup);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 14), skinMat);
  neck.position.y = 0.03;
  headGroup.add(neck);

  // Stylized Smooth Head Sphere (friendly movie proportions)
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 28, 24), skinMat);
  headMesh.scale.set(1.02, 1.03, 0.96);
  headMesh.position.y = 0.36;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Ears (hidden cleanly if wearing hijab)
  if (avatarId !== 'tirta') {
    const earGeo = new THREE.SphereGeometry(0.075, 12, 10);
    const lEar = new THREE.Mesh(earGeo, skinMat);
    lEar.scale.set(0.55, 1.05, 0.65);
    lEar.position.set(-0.34, 0.35, -0.02);
    const rEar = lEar.clone();
    rEar.position.x = 0.34;
    headGroup.add(lEar, rEar);
  }

  // Soft Rosy Cheeks
  const cheekGeo = new THREE.SphereGeometry(0.058, 12, 10);
  const lCheek = new THREE.Mesh(cheekGeo, cheekMat);
  lCheek.scale.set(1.2, 0.68, 0.3);
  lCheek.position.set(-0.18, 0.27, 0.29);
  const rCheek = lCheek.clone();
  rCheek.position.x = 0.18;
  headGroup.add(lCheek, rCheek);

  // Cute 3D Nose
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf4b692, roughness: 0.58 })
  );
  nose.scale.set(1.1, 0.85, 0.9);
  nose.position.set(0, 0.31, 0.345);
  headGroup.add(nose);

  // Warm Smiling Mouth (friendly curve + white smile accent)
  const smileCurve = new THREE.Mesh(
    new THREE.TorusGeometry(0.082, 0.015, 8, 18, Math.PI * 0.78),
    new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.45 })
  );
  smileCurve.rotation.z = Math.PI * 1.11;
  smileCurve.rotation.x = -0.18;
  smileCurve.position.set(0, 0.245, 0.318);
  headGroup.add(smileCurve);

  const smileTeeth = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 12, 8, 0, Math.PI, Math.PI * 0.45, Math.PI * 0.35),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
  );
  smileTeeth.position.set(0, 0.23, 0.295);
  smileTeeth.rotation.x = 0.2;
  headGroup.add(smileTeeth);

  // Expressive Eyes with Iris, Pupil, Specular Sparkle & Blinking Eyelids
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18 });
  const irisMat = new THREE.MeshStandardMaterial({ color: spec.iris, roughness: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.12 });
  const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lidMat = new THREE.MeshStandardMaterial({ color: spec.skin, roughness: 0.6 });

  function buildEye(side: -1 | 1): { eyelid: THREE.Mesh; brow: THREE.Mesh } {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.135, 0.385, 0.285);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.074, 16, 14), scleraMat);
    sclera.scale.set(0.95, 1.1, 0.65);
    eyeGroup.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), irisMat);
    iris.scale.set(0.95, 1.08, 0.5);
    iris.position.set(0, -0.004, 0.032);
    eyeGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), pupilMat);
    pupil.scale.set(1, 1.05, 0.45);
    pupil.position.set(0, -0.004, 0.048);
    eyeGroup.add(pupil);

    // Dual Pixar-style specular eye catchlights
    const catch1 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), sparkleMat);
    catch1.position.set(0.02, 0.024, 0.057);
    const catch2 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), sparkleMat);
    catch2.position.set(-0.016, -0.018, 0.056);
    eyeGroup.add(catch1, catch2);

    // Animated Upper Eyelid Dome (scales/rotates down on blink!)
    const eyelid = new THREE.Mesh(
      new THREE.SphereGeometry(0.078, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      lidMat
    );
    eyelid.scale.set(0.98, 1.12, 0.72);
    eyelid.rotation.x = -0.82; // Open by default, rotates forward to +0.25 when blinking
    eyeGroup.add(eyelid);

    headGroup.add(eyeGroup);

    // Eyebrow
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.095, 4, 8), hairMat);
    brow.rotation.z = Math.PI / 2 + side * -0.1;
    brow.position.set(side * 0.135, 0.495, 0.312);
    headGroup.add(brow);

    return { eyelid, brow };
  }

  const leftEyeRig = buildEye(-1);
  const rightEyeRig = buildEye(1);

  // Character-Specific Hair, Hijab & Hero Headgear
  if (avatarId === 'tirta') {
    // Blue Hijab Crown + Inner Cyan Rim + Shoulder Drape + Glowing Water-Drop Clip
    const hijabCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.382, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.72),
      trimMat
    );
    hijabCap.position.set(0, 0.37, -0.03);
    hijabCap.rotation.x = -0.35;
    hijabCap.castShadow = true;
    headGroup.add(hijabCap);

    const hijabWrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.072, 12, 26),
      new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.45 })
    );
    hijabWrap.position.set(0, 0.34, 0.04);
    hijabWrap.scale.set(1.02, 1.08, 1.0);
    headGroup.add(hijabWrap);

    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.285, 0.03, 10, 24),
      glowMat
    );
    innerRim.position.set(0, 0.34, 0.13);
    innerRim.scale.set(0.98, 1.06, 0.8);
    headGroup.add(innerRim);

    const hijabDrape = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 0.46, 18, 1, false),
      trimMat
    );
    hijabDrape.position.set(0, 0.05, -0.06);
    hijabDrape.scale.set(1.06, 1, 0.85);
    hijabDrape.castShadow = true;
    headGroup.add(hijabDrape);

    // Water-drop hair ornament on right temple
    const dropPin = new THREE.Mesh(createTeardropGeometry(), glowMat);
    dropPin.scale.setScalar(0.85);
    dropPin.position.set(-0.27, 0.56, 0.19);
    dropPin.rotation.z = 0.3;
    headGroup.add(dropPin);
  } else if (avatarId === 'rimba') {
    // Lush Spiky Layered Forest Ranger Brown Hair
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.37, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hairCrown.position.set(0, 0.38, -0.02);
    hairCrown.rotation.x = -0.25;
    hairCrown.castShadow = true;
    headGroup.add(hairCrown);

    const spikeOffsets: [number, number, number, number, number, number][] = [
      [0, 0.74, 0.05, 0.35, 0, 0.15],
      [-0.16, 0.71, 0.02, 0.25, 0.3, 0.35],
      [0.16, 0.71, 0.04, 0.25, -0.3, -0.35],
      [-0.25, 0.61, 0.15, 0.5, 0.4, 0.55],
      [0.25, 0.61, 0.15, 0.5, -0.4, -0.55],
      [-0.08, 0.63, 0.28, 0.85, 0.1, 0.2],
      [0.11, 0.62, 0.27, 0.85, -0.15, -0.25],
      [0, 0.56, -0.33, -0.65, 0, 0],
    ];
    spikeOffsets.forEach(([x, y, z, rx, ry, rz]) => {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 10), hairMat);
      tuft.position.set(x, y, z);
      tuft.rotation.set(rx, ry, rz);
      tuft.castShadow = true;
      headGroup.add(tuft);
    });
  } else if (avatarId === 'bayu') {
    // Energetic Spiky Dark Hair + Futuristic Wind Goggles on Forehead
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.368, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hairCrown.position.set(0, 0.38, -0.02);
    hairCrown.rotation.x = -0.28;
    hairCrown.castShadow = true;
    headGroup.add(hairCrown);

    const bayuSpikes: [number, number, number, number, number][] = [
      [-0.12, 0.61, 0.29, 0.9, 0.25],
      [0.1, 0.62, 0.29, 0.92, -0.2],
      [0, 0.72, 0.12, 0.3, 0],
      [-0.24, 0.62, 0.08, 0.2, 0.5],
      [0.24, 0.62, 0.08, 0.2, -0.5],
    ];
    bayuSpikes.forEach(([x, y, z, rx, rz]) => {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.21, 10), hairMat);
      tuft.position.set(x, y, z);
      tuft.rotation.set(rx, 0, rz);
      headGroup.add(tuft);
    });

    // Wind Goggle Strap + Dual Cyan Glass Lenses on Forehead
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.365, 0.032, 8, 24),
      trimMat
    );
    strap.rotation.x = Math.PI / 2 - 0.26;
    strap.position.set(0, 0.56, -0.01);
    headGroup.add(strap);

    const lensGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    [-0.125, 0.125].forEach((gx) => {
      const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18), suitMat);
      frame.rotation.x = Math.PI / 2 - 0.22;
      frame.position.set(gx, 0.61, 0.285);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.066, 16), lensGlassMat);
      lens.rotation.x = Math.PI / 2 - 0.22;
      lens.position.set(gx, 0.61, 0.288);
      headGroup.add(frame, lens);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.036, 0.045), silverMat);
    bridge.position.set(0, 0.61, 0.305);
    headGroup.add(bridge);
  } else {
    // Ejen Suara: Long Flowing Brown Hair + Futuristic Purple & White Headphones
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.372, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairMat
    );
    hairCrown.position.set(0, 0.38, -0.02);
    hairCrown.rotation.x = -0.32;
    hairCrown.castShadow = true;
    headGroup.add(hairCrown);

    // Side & Back Flowing Locks
    const backHair = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.56, 16), hairMat);
    backHair.position.set(0, 0.08, -0.14);
    backHair.scale.set(1.05, 1, 0.65);
    backHair.castShadow = true;
    headGroup.add(backHair);

    [-1, 1].forEach((side) => {
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.42, 6, 10), hairMat);
      lock.position.set(side * 0.31, 0.16, 0.08);
      lock.rotation.z = side * 0.14;
      lock.castShadow = true;
      headGroup.add(lock);
    });

    // Swept side bangs
    const bangL = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 10), hairMat);
    bangL.position.set(-0.18, 0.58, 0.27);
    bangL.rotation.set(0.65, 0, 0.55);
    const bangR = bangL.clone();
    bangR.position.x = 0.18;
    bangR.rotation.z = -0.55;
    headGroup.add(bangL, bangR);

    // Modern Over-Ear Purple & White Futuristic Headphones
    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.415, 0.042, 10, 24, Math.PI * 1.06),
      suitMat
    );
    headband.position.set(0, 0.38, -0.01);
    headband.rotation.z = -0.09;
    headGroup.add(headband);

    [-1, 1].forEach((side) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 18), trimMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * 0.41, 0.36, -0.01);
      const padGlow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 18), glowMat);
      padGlow.rotation.y = Math.PI / 2;
      padGlow.position.set(side * 0.455, 0.36, -0.01);
      headGroup.add(cup, padGlow);
    });

    // Sleek Mic Boom from right earcup toward cheek
    const micCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.42, 0.32, 0.04),
      new THREE.Vector3(-0.34, 0.24, 0.24),
      new THREE.Vector3(-0.15, 0.22, 0.33),
    ]);
    const micBoom = new THREE.Mesh(
      new THREE.TubeGeometry(micCurve, 10, 0.014, 6, false),
      silverMat
    );
    const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), glowMat);
    micTip.position.set(-0.15, 0.22, 0.33);
    headGroup.add(micBoom, micTip);
  }

  // ==========================
  // ELEMENTAL 3D SPECIAL EFFECTS (fxGroup)
  // ==========================
  const fxGroup = new THREE.Group();
  fxGroup.position.y = baseLift;
  bodyRoot.add(fxGroup);

  const fxItems: THREE.Object3D[] = [];

  if (avatarId === 'tirta') {
    const dropGeo = createTeardropGeometry();
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 5; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      drop.userData = {
        angle: (i / 5) * Math.PI * 2,
        radius: 0.68 + (i % 2) * 0.14,
        baseY: 0.85 + (i % 3) * 0.38,
        speed: 1.2 + (i % 2) * 0.35,
      };
      fxGroup.add(drop);
      fxItems.push(drop);
    }
  } else if (avatarId === 'rimba') {
    const leafGeo = createLeafGeometry();
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 0.4,
      roughness: 0.35,
    });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.userData = {
        angle: (i / 6) * Math.PI * 2,
        radius: 0.7 + (i % 2) * 0.16,
        baseY: 0.78 + (i % 3) * 0.42,
        speed: 1.05 + (i % 3) * 0.25,
      };
      fxGroup.add(leaf);
      fxItems.push(leaf);
    }
  } else if (avatarId === 'bayu') {
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      transparent: true,
      opacity: 0.78,
    });
    for (let i = 0; i < 3; i++) {
      const swirl = new THREE.Mesh(
        new THREE.TorusGeometry(0.68 + i * 0.11, 0.022, 8, 28, Math.PI * 1.15),
        ribbonMat
      );
      swirl.rotation.x = Math.PI / 2 + (i - 1) * 0.28;
      swirl.userData = {
        baseY: 0.8 + i * 0.45,
        speed: 2.6 + i * 0.55,
      };
      fxGroup.add(swirl);
      fxItems.push(swirl);
    }
    // Breeze orbs
    const orbGeo = new THREE.SphereGeometry(0.036, 8, 8);
    for (let i = 0; i < 4; i++) {
      const orb = new THREE.Mesh(orbGeo, ribbonMat);
      orb.userData = {
        isOrb: true,
        angle: (i / 4) * Math.PI * 2,
        radius: 0.78,
        baseY: 0.9 + (i % 2) * 0.55,
        speed: 2.8,
      };
      fxGroup.add(orb);
      fxItems.push(orb);
    }
  } else {
    // Suara: Expanding Sound Wave Rings + Floating 3D Musical Notes
    const waveMat = new THREE.MeshStandardMaterial({
      color: 0xe879f9,
      emissive: 0xa855f7,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 3; i++) {
      const wave = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.022, 8, 28), waveMat);
      wave.rotation.x = Math.PI / 2;
      wave.userData = { isWave: true, phase: i * 0.33, baseY: 0.55 + i * 0.45 };
      fxGroup.add(wave);
      fxItems.push(wave);
    }
    for (let i = 0; i < 3; i++) {
      const note = createMusicalNoteGroup(glowMat);
      note.userData = {
        isNote: true,
        angle: (i / 3) * Math.PI * 2,
        radius: 0.72,
        baseY: 1.25 + (i % 2) * 0.35,
        speed: 1.35,
      };
      fxGroup.add(note);
      fxItems.push(note);
    }
  }

  return {
    avatarId,
    group,
    bodyRoot,
    torsoGroup,
    headGroup,
    leftEyelid: leftEyeRig.eyelid,
    rightEyelid: rightEyeRig.eyelid,
    leftBrow: leftEyeRig.brow,
    rightBrow: rightEyeRig.brow,
    leftShoulder: leftArmRig.shoulder,
    rightShoulder: rightArmRig.shoulder,
    leftElbow: leftArmRig.elbow,
    rightElbow: rightArmRig.elbow,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    chestEmblem,
    fxGroup,
    fxItems,
    pedestalRing,
    pedestalGlowMat,
    welcomeTimer: 2.2, // Waves cheerfully when entering!
    hoverAmount: 0,
    selectedAmount: 0,
    blinkClock: Math.random() * 2.5,
  };
}

export function animateHumanAgent(
  rig: HumanAgentRig,
  elapsed: number,
  dt: number,
  state: AgentAnimState = {}
) {
  const phase = state.phaseOffset ?? 0;
  const t = elapsed + phase;

  if (state.triggerWelcome) {
    rig.welcomeTimer = 2.4;
  }
  if (rig.welcomeTimer > 0) {
    rig.welcomeTimer = Math.max(0, rig.welcomeTimer - dt);
  }

  rig.hoverAmount = THREE.MathUtils.damp(
    rig.hoverAmount,
    state.hovered ? 1 : 0,
    8,
    dt
  );
  rig.selectedAmount = THREE.MathUtils.damp(
    rig.selectedAmount,
    state.selected ? 1 : 0,
    7,
    dt
  );

  // 1. Natural Eye Blinking (smooth blink every ~3.2s)
  rig.blinkClock += dt;
  const blinkCycle = rig.blinkClock % 3.4;
  let blinkClosed = 0;
  if (blinkCycle > 3.15) {
    const bPhase = (blinkCycle - 3.15) / 0.25;
    blinkClosed = Math.sin(bPhase * Math.PI);
  }
  const lidRot = THREE.MathUtils.lerp(-0.84, 0.26, blinkClosed);
  rig.leftEyelid.rotation.x = lidRot;
  rig.rightEyelid.rotation.x = lidRot;

  // 2. Natural Breathing & Subtle Idle Sway
  const breath = Math.sin(t * 2.3) * 0.022;
  rig.torsoGroup.scale.set(1 + breath * 0.45, 1 + breath * 0.6, 1 + breath * 0.55);

  const sit = THREE.MathUtils.clamp(state.sitAmount ?? 0, 0, 1);

  if (state.isMoving && sit < 0.15) {
    // Expressive Walk Cycle
    const swing = Math.sin(elapsed * 11.5) * 0.58;
    rig.leftHip.rotation.x = swing;
    rig.rightHip.rotation.x = -swing;
    rig.leftKnee.rotation.x = Math.max(0, -swing * 0.45);
    rig.rightKnee.rotation.x = Math.max(0, swing * 0.45);
    rig.leftShoulder.rotation.x = -swing * 0.72;
    rig.rightShoulder.rotation.x = swing * 0.72;
    rig.leftShoulder.rotation.z = -0.14;
    rig.rightShoulder.rotation.z = 0.14;
    rig.leftElbow.rotation.x = -0.3;
    rig.rightElbow.rotation.x = -0.3;
    rig.bodyRoot.position.y = Math.abs(Math.sin(elapsed * 11.5)) * 0.11;
    rig.torsoGroup.rotation.y = Math.sin(elapsed * 11.5) * 0.08;
    rig.headGroup.rotation.set(0, Math.sin(elapsed * 11.5) * -0.05, 0);
  } else {
    // Idle Pose + Seated Broadcast Pose + Welcoming Wave + Hover Flourish
    const isWelcoming = rig.welcomeTimer > 0 && sit < 0.25;
    const waveBlend = isWelcoming
      ? Math.min(1, rig.welcomeTimer * 2.2) * Math.min(1, (2.4 - rig.welcomeTimer) * 4 + 0.35)
      : 0;

    // Smooth vertical transition between standing idle and seated chair height
    const standingBounce =
      Math.sin(t * 2.3) * 0.016 + rig.hoverAmount * Math.abs(Math.sin(t * 5.2)) * 0.05;
    const seatedY = -0.24 + Math.sin(t * 2.1) * 0.006;
    const targetBodyY = THREE.MathUtils.lerp(standingBounce, seatedY, sit);
    rig.bodyRoot.position.y = THREE.MathUtils.damp(rig.bodyRoot.position.y, targetBodyY, 10, dt);

    // Legs bend cleanly at hip & knee when sitting
    const targetHipX = THREE.MathUtils.lerp(0, -1.42, sit);
    const targetKneeX = THREE.MathUtils.lerp(0, 1.38, sit);
    rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, targetHipX, 9, dt);
    rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, targetHipX, 9, dt);
    rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, targetKneeX, 9, dt);
    rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, targetKneeX, 9, dt);

    // Expressive head tilt & gentle broadcast nod
    const headTiltZ =
      (Math.sin(t * 1.4) * 0.05 + waveBlend * 0.12 + rig.hoverAmount * 0.06) * (1 - sit * 0.45);
    const headYaw = Math.sin(t * 0.9) * (sit > 0.5 ? 0.11 : 0.09);
    rig.headGroup.rotation.z = THREE.MathUtils.damp(rig.headGroup.rotation.z, headTiltZ, 7, dt);
    rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, headYaw, 7, dt);
    rig.headGroup.rotation.x = THREE.MathUtils.damp(
      rig.headGroup.rotation.x,
      Math.sin(t * 2.3) * 0.025 - rig.hoverAmount * 0.05 + sit * 0.04,
      7,
      dt
    );

    // Arm animations: conversational podcast host gesture when seated, or standing welcome wave
    const waveOsc = Math.sin(t * 8.5) * 0.38;
    let targetRShoulderZ = THREE.MathUtils.lerp(0.18 + Math.sin(t * 2.0) * 0.04, 0.22, sit);
    let targetRShoulderX = THREE.MathUtils.lerp(-0.08, -0.44 + Math.sin(t * 1.9) * 0.06, sit);
    let targetRElbowX = THREE.MathUtils.lerp(-0.25, -0.78 + Math.cos(t * 2.2) * 0.08, sit);
    let targetLShoulderZ = THREE.MathUtils.lerp(-0.18 - Math.sin(t * 2.0) * 0.04, -0.22, sit);
    let targetLShoulderX = THREE.MathUtils.lerp(-0.08, -0.42 - Math.sin(t * 1.7) * 0.05, sit);
    let targetLElbowX = THREE.MathUtils.lerp(-0.25, -0.75, sit);

    if (isWelcoming || (rig.hoverAmount > 0.2 && sit < 0.3)) {
      const act = Math.max(waveBlend, rig.hoverAmount * 0.85);
      if (rig.avatarId === 'tirta') {
        targetRShoulderZ = THREE.MathUtils.lerp(targetRShoulderZ, 2.35 + waveOsc, act);
        targetRShoulderX = THREE.MathUtils.lerp(targetRShoulderX, -0.35, act);
        targetRElbowX = THREE.MathUtils.lerp(targetRElbowX, -0.45, act);
        targetLShoulderZ = THREE.MathUtils.lerp(targetLShoulderZ, -0.65, act);
        targetLShoulderX = THREE.MathUtils.lerp(targetLShoulderX, -0.48, act);
        targetLElbowX = THREE.MathUtils.lerp(targetLElbowX, -0.55, act);
      } else if (rig.avatarId === 'rimba') {
        targetRShoulderZ = THREE.MathUtils.lerp(targetRShoulderZ, 2.55 + waveOsc * 0.9, act);
        targetRShoulderX = THREE.MathUtils.lerp(targetRShoulderX, -0.22, act);
        targetRElbowX = THREE.MathUtils.lerp(targetRElbowX, -0.3, act);
        targetLShoulderZ = THREE.MathUtils.lerp(targetLShoulderZ, -0.52, act);
        targetLElbowX = THREE.MathUtils.lerp(targetLElbowX, -0.78, act);
      } else if (rig.avatarId === 'bayu') {
        targetRShoulderZ = THREE.MathUtils.lerp(targetRShoulderZ, 2.4 + waveOsc * 1.15, act);
        targetRShoulderX = THREE.MathUtils.lerp(targetRShoulderX, -0.45, act);
        targetRElbowX = THREE.MathUtils.lerp(targetRElbowX, -0.55, act);
        targetLShoulderZ = THREE.MathUtils.lerp(targetLShoulderZ, -0.42, act);
        targetLElbowX = THREE.MathUtils.lerp(targetLElbowX, -0.65, act);
      } else {
        targetRShoulderZ = THREE.MathUtils.lerp(targetRShoulderZ, 1.55, act);
        targetRShoulderX = THREE.MathUtils.lerp(targetRShoulderX, -0.25, act);
        targetRElbowX = THREE.MathUtils.lerp(targetRElbowX, -1.85, act);
        targetLShoulderZ = THREE.MathUtils.lerp(targetLShoulderZ, -2.35 - waveOsc, act);
        targetLShoulderX = THREE.MathUtils.lerp(targetLShoulderX, -0.35, act);
        targetLElbowX = THREE.MathUtils.lerp(targetLElbowX, -0.4, act);
      }
    }

    rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, targetRShoulderZ, 9, dt);
    rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, targetRShoulderX, 9, dt);
    rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, targetRElbowX, 9, dt);

    rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, targetLShoulderZ, 9, dt);
    rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, targetLShoulderX, 9, dt);
    rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, targetLElbowX, 9, dt);

    rig.torsoGroup.rotation.y = THREE.MathUtils.damp(
      rig.torsoGroup.rotation.y,
      Math.sin(t * 1.1) * (sit > 0.5 ? 0.05 : 0.08) + rig.hoverAmount * 0.14 * (1 - sit),
      7,
      dt
    );
  }

  // 3. Elemental VFX Animations (Water drops, Leaves, Wind swirls, Sound waves)
  const fxBoost = 1 + rig.hoverAmount * 0.7 + rig.selectedAmount * 0.4;
  rig.fxItems.forEach((item, idx) => {
    const ud = item.userData;
    if (rig.avatarId === 'bayu' && !ud.isOrb) {
      item.rotation.z += dt * ud.speed * fxBoost;
      item.position.y = ud.baseY + Math.sin(t * 2.4 + idx) * 0.12;
    } else if (rig.avatarId === 'suara' && ud.isWave) {
      const cycle = (t * 0.65 * fxBoost + ud.phase) % 1;
      const sc = 0.72 + cycle * 0.68;
      item.scale.set(sc, sc, 1);
      item.position.y = ud.baseY + cycle * 0.25;
      const mat = (item as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - cycle) * 0.78;
    } else {
      const ang = ud.angle + t * ud.speed * fxBoost;
      const rad = ud.radius + rig.hoverAmount * 0.1;
      item.position.set(
        Math.cos(ang) * rad,
        ud.baseY + Math.sin(t * 2.6 + idx * 1.3) * 0.14,
        Math.sin(ang) * rad
      );
      if (rig.avatarId === 'rimba') {
        item.rotation.x = Math.sin(t * 2.2 + idx) * 0.5;
        item.rotation.y += dt * 1.8;
      } else if (rig.avatarId === 'suara') {
        item.rotation.y = -ang + Math.PI / 2;
      }
    }
  });

  // 4. Glowing Showcase Pedestal Pulse
  if (rig.pedestalGlowMat) {
    rig.pedestalGlowMat.emissiveIntensity =
      0.7 + rig.selectedAmount * 0.9 + rig.hoverAmount * 0.45 + Math.sin(t * 3) * 0.15;
  }
}
