import * as THREE from 'three';
import { AvatarId } from '../types/game';
import { animateHumanAgent, buildHumanEcoAgent, HumanAgentRig } from './humanAgents';
import { createContactShadowTexture, createWaterFlowTexture } from './textures';

export type RiverStageMode =
  | 'portal'
  | 'travel_intro'
  | 'audio_clues'
  | 'puzzle_lab'
  | 'voice_challenge'
  | 'victory';

export interface SungaiTercemarWorldHandle {
  group: THREE.Group;
  startTravelIntro: () => void;
  setCameraPreset: (preset: 'cinematic' | 'river_wide' | 'agent_close') => void;
  orbitCameraBy: (dYaw: number, dPitch: number) => void;
  zoomCameraBy: (delta: number) => void;
  update: (
    dt: number,
    elapsed: number,
    camera: THREE.PerspectiveCamera,
    stage: RiverStageMode,
    justTeleported: boolean
  ) => {
    introPhase: 'walking' | 'observing' | 'done';
    recoveryProgress: number;
  };
  dispose: () => void;
}

// Pre-allocated math helpers (zero per-frame GC allocations)
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _lookSmooth = new THREE.Vector3(0, 1.4, -2);
const _dummy = new THREE.Object3D();
const _tmpColor = new THREE.Color();
const _murkyWaterCol = new THREE.Color(0x556042);
const _cleanWaterCol = new THREE.Color(0x0ea5e9);
const _murkyEmissiveCol = new THREE.Color(0x1f2416);
const _cleanEmissiveCol = new THREE.Color(0x0284c7);
const _pollutedLeafA = new THREE.Color(0x657c3a);
const _cleanLeafA = new THREE.Color(0x22c55e);
const _pollutedLeafB = new THREE.Color(0x4b5e2e);
const _cleanLeafB = new THREE.Color(0x16a34a);
const _pollutedGrass = new THREE.Color(0x78713c);
const _cleanGrass = new THREE.Color(0x4ade80);
const _pollutedSky = new THREE.Color(0x72878d);
const _cleanSky = new THREE.Color(0x60a5fa);
const _pollutedCloud = new THREE.Color(0xcbd5e1);
const _cleanCloud = new THREE.Color(0xffffff);

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export function riverCenterX(z: number): number {
  return 2.4 + Math.sin(z * 0.11) * 4.2 + Math.cos(z * 0.05) * 1.6;
}

export function riverGroundHeightAt(x: number, z: number): number {
  let h =
    Math.sin(x * 0.12) * Math.cos(z * 0.1) * 0.25 +
    Math.sin(x * 0.25 + z * 0.18) * 0.08;

  // Gently sculpted river channel
  const rx = riverCenterX(z);
  const distRiver = Math.abs(x - rx);
  const halfW = 3.8 + Math.sin(z * 0.16) * 0.55;
  if (distRiver < halfW + 1.8) {
    const t = Math.max(0, Math.min(1, 1 - distRiver / (halfW + 1.8)));
    h -= t * t * 1.15;
  }

  // Distant scenic mountain ridge (matches Panel 4 visual style)
  if (z < -24.0) {
    const mz = (-24.0 - z) / 18.0;
    const peakShape = Math.max(0.25, Math.cos((x + 4) * 0.085) * 0.65 + 0.55);
    h += mz * mz * 14.5 * peakShape;
  }

  // Natural valley outer hills
  const rad = Math.hypot(x, z);
  if (rad > 25.0) {
    const hill = Math.min(1, (rad - 25.0) / 18.0);
    h += hill * hill * 4.8;
  }

  return h;
}

function createRiverGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#4f8f3c');
  grad.addColorStop(0.5, '#5da843');
  grad.addColorStop(1, '#3e7d34');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4000; i++) {
    const px = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * 512;
    const py = Math.abs((Math.sin(i * 78.233) * 19341.123) % 1) * 512;
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(190, 242, 100, 0.2)'
        : i % 3 === 0
        ? 'rgba(22, 101, 52, 0.25)'
        : 'rgba(113, 63, 18, 0.14)';
    ctx.fillRect(px, py, 3, 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 11);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTrailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9a7b56';
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 320; i++) {
    const px = Math.abs((Math.sin(i * 23.1) * 8123) % 1) * 256;
    const py = Math.abs((Math.cos(i * 17.7) * 5417) % 1) * 128;
    ctx.fillStyle = i % 2 === 0 ? '#7c5d3b' : '#b89872';
    ctx.beginPath();
    ctx.arc(px, py, 2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// =========================================================================
// COMPOSITE 3–12 PART PROCEDURAL RIVER MODELS
// =========================================================================
function buildRiverbankTree(
  scale: number,
  variant: 'canopy' | 'banana',
  barkMat: THREE.Material,
  foliageMatA: THREE.Material,
  foliageMatB: THREE.Material
): { root: THREE.Group; canopyPivot: THREE.Group } {
  const root = new THREE.Group();
  const canopyPivot = new THREE.Group();

  if (variant === 'banana') {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * scale, 0.24 * scale, 1.9 * scale, 8),
      foliageMatB
    );
    stem.position.y = 0.9 * scale;
    stem.castShadow = true;
    root.add(stem);

    canopyPivot.position.set(0, 1.75 * scale, 0);
    root.add(canopyPivot);
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2;
      const leafBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.55 * scale, 0.05 * scale, 2.2 * scale),
        i % 2 === 0 ? foliageMatA : foliageMatB
      );
      leafBlade.position.set(
        Math.sin(ang) * 0.95 * scale,
        0.35 * scale,
        Math.cos(ang) * 0.95 * scale
      );
      leafBlade.rotation.y = ang;
      leafBlade.rotation.x = -0.35 - (i % 2) * 0.14;
      leafBlade.castShadow = true;
      canopyPivot.add(leafBlade);
    }
    return { root, canopyPivot };
  }

  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + 0.4;
    const r = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * scale, 0.3 * scale, 1.1 * scale, 7),
      barkMat
    );
    r.position.set(Math.cos(ang) * 0.3 * scale, 0.4 * scale, Math.sin(ang) * 0.3 * scale);
    r.rotation.z = -Math.cos(ang) * 0.4;
    r.rotation.x = Math.sin(ang) * 0.4;
    root.add(r);
  }

  const trunkH = 3.8 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24 * scale, 0.44 * scale, trunkH, 9),
    barkMat
  );
  trunk.position.y = trunkH * 0.5 - 0.06;
  trunk.castShadow = true;
  root.add(trunk);

  const br1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.18 * scale, 1.5 * scale, 6), barkMat);
  br1.position.set(0.55 * scale, trunkH * 0.76, 0.1 * scale);
  br1.rotation.z = 0.52;
  const br2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.18 * scale, 1.4 * scale, 6), barkMat);
  br2.position.set(-0.52 * scale, trunkH * 0.8, -0.15 * scale);
  br2.rotation.z = -0.48;
  root.add(br1, br2);

  canopyPivot.position.set(0, trunkH - 0.25 * scale, 0);
  root.add(canopyPivot);

  [
    [0, 1.0, 0, 1.85, true],
    [-1.05, 0.45, 0.45, 1.3, false],
    [1.05, 0.5, -0.4, 1.35, false],
    [0, 1.65, 0.15, 1.2, true],
  ].forEach(([cx, cy, cz, cr, useA]) => {
    const puff = new THREE.Mesh(
      new THREE.DodecahedronGeometry((cr as number) * scale, 1),
      useA ? foliageMatA : foliageMatB
    );
    puff.scale.set(1.12, 0.8, 1.12);
    puff.position.set((cx as number) * scale, (cy as number) * scale, (cz as number) * scale);
    puff.castShadow = true;
    canopyPivot.add(puff);
  });

  return { root, canopyPivot };
}

interface TrashProp {
  group: THREE.Group;
  sparkleRing: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  inWater: boolean;
  threshold: number;
  phase: number;
}

function buildCompositeTrash(
  kind: 'bottle' | 'can' | 'bag',
  colorHex: number
): Omit<TrashProp, 'baseX' | 'baseY' | 'baseZ' | 'inWater' | 'threshold' | 'phase'> {
  const g = new THREE.Group();

  if (kind === 'bottle') {
    const plasticMat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      roughness: 0.2,
      metalness: 0.05,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.88,
    });
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.46, 10), plasticMat);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.15, 10), plasticMat);
    neck.position.y = 0.3;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.07, 10), capMat);
    cap.position.y = 0.4;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.166, 0.166, 0.18, 10), labelMat);
    label.position.y = -0.02;
    g.add(body, neck, cap, label);
    g.rotation.z = Math.PI * 0.42;
  } else if (kind === 'can') {
    const canMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.72, roughness: 0.28 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 12), canMat);
    const topRim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.03, 12), rimMat);
    topRim.position.y = 0.175;
    const botRim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.03, 12), rimMat);
    botRim.position.y = -0.175;
    g.add(body, topRim, botRim);
    g.rotation.x = Math.PI * 0.38;
  } else {
    const bagMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65 });
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const sack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), bagMat);
    sack.scale.set(1.15, 0.85, 1.05);
    sack.position.y = 0.18;
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 7), bagMat);
    knot.position.y = 0.44;
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), tieMat);
    tie.rotation.x = Math.PI / 2;
    tie.position.y = 0.38;
    g.add(sack, knot, tie);
  }

  const sparkleRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.04, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0 })
  );
  sparkleRing.rotation.x = Math.PI / 2;
  sparkleRing.position.y = 0.2;
  g.add(sparkleRing);

  return { group: g, sparkleRing };
}

interface RiverFish {
  group: THREE.Group;
  tailPivot: THREE.Group;
  zOffset: number;
  xOffset: number;
  speed: number;
  phase: number;
}

function buildFish(colorHex: number): Omit<RiverFish, 'zOffset' | 'xOffset' | 'speed' | 'phase'> {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.32 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.45, side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), bodyMat);
  body.scale.set(0.7, 0.85, 1.85);
  g.add(body);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), finMat);
  dorsal.position.set(0, 0.14, -0.02);
  dorsal.rotation.x = -0.35;
  g.add(dorsal);

  [-0.08, 0.08].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), eyeMat);
    eye.position.set(ex, 0.04, 0.19);
    g.add(eye);
  });

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -0.25);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), finMat);
  tail.rotation.x = Math.PI / 2;
  tail.scale.set(0.35, 1, 1.2);
  tail.position.z = -0.09;
  tailPivot.add(tail);
  g.add(tailPivot);

  return { group: g, tailPivot };
}

interface RiverTurtle {
  group: THREE.Group;
  headPivot: THREE.Group;
  flippers: THREE.Mesh[];
  homeX: number;
  homeZ: number;
  inWater: boolean;
  phase: number;
}

function buildTurtle(): Omit<RiverTurtle, 'homeX' | 'homeZ' | 'inWater' | 'phase'> {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), shellMat);
  shell.scale.set(1.0, 0.56, 1.22);
  shell.position.y = 0.16;
  shell.castShadow = true;
  g.add(shell);

  const shellRim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 20), rimMat);
  shellRim.rotation.x = Math.PI / 2;
  shellRim.scale.set(1.0, 1.22, 1);
  shellRim.position.y = 0.11;
  g.add(shellRim);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.15, 0.34);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skinMat);
  head.position.set(0, 0.03, 0.08);
  headPivot.add(head);
  [-0.06, 0.06].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), darkMat);
    eye.position.set(ex, 0.06, 0.14);
    headPivot.add(eye);
  });
  g.add(headPivot);

  const flippers: THREE.Mesh[] = [];
  [
    [-0.26, 0.18, 0.45],
    [0.26, 0.18, -0.45],
    [-0.24, -0.18, -0.4],
    [0.24, -0.18, 0.4],
  ].forEach(([fx, fz, ry]) => {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.11), skinMat);
    fl.position.set(fx, 0.08, fz);
    fl.rotation.y = ry;
    g.add(fl);
    flippers.push(fl);
  });

  return { group: g, headPivot, flippers };
}

interface RiverDeer {
  group: THREE.Group;
  headPivot: THREE.Group;
  homeX: number;
  homeZ: number;
  phase: number;
}

function buildRiverDeer(): Omit<RiverDeer, 'homeX' | 'homeZ' | 'phase'> {
  const g = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.52, 6, 10), coatMat);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), creamMat);
  chest.position.set(0, 0.68, 0.22);
  g.add(chest);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.84, 0.32);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.4, 8), coatMat);
  neck.position.set(0, 0.16, 0.08);
  neck.rotation.x = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), coatMat);
  head.scale.set(0.9, 0.9, 1.3);
  head.position.set(0, 0.35, 0.22);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), darkMat);
  nose.position.set(0, 0.33, 0.39);
  headPivot.add(neck, head, nose);
  [-0.09, 0.09].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 5), coatMat);
    ear.position.set(ex, 0.46, 0.14);
    ear.rotation.z = ex > 0 ? -0.45 : 0.45;
    headPivot.add(ear);
  });
  g.add(headPivot);

  [
    [-0.12, 0.24],
    [0.12, 0.24],
    [-0.12, -0.24],
    [0.12, -0.24],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.56, 7), coatMat);
    leg.position.set(lx, 0.28, lz);
    g.add(leg);
  });

  return { group: g, headPivot };
}

interface AnimatedFlier {
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  centerX: number;
  centerZ: number;
  baseY: number;
  rx: number;
  rz: number;
  speed: number;
  phase: number;
  alwaysVisible?: boolean;
}

function buildRiverBird(
  bodyColor: number,
  wingColor: number
): Omit<AnimatedFlier, 'centerX' | 'centerZ' | 'baseY' | 'rx' | 'rz' | 'speed' | 'phase'> {
  const g = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45 });
  const wMat = new THREE.MeshStandardMaterial({ color: wingColor, roughness: 0.5, side: THREE.DoubleSide });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 5, 8), bMat);
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bMat);
  head.position.set(0, 0.05, 0.17);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.085, 5), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.04, 0.26);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), wMat);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(1.4, 1, 0.3);
  tail.position.set(0, 0.02, -0.19);
  g.add(body, head, beak, tail);

  const wingGeo = new THREE.BoxGeometry(0.35, 0.02, 0.15);
  const leftWing = new THREE.Group();
  const lw = new THREE.Mesh(wingGeo, wMat);
  lw.position.x = -0.175;
  leftWing.add(lw);
  const rightWing = new THREE.Group();
  const rw = new THREE.Mesh(wingGeo, wMat);
  rw.position.x = 0.175;
  rightWing.add(rw);
  g.add(leftWing, rightWing);

  return { group: g, leftWing, rightWing };
}

function buildRiverButterfly(
  wingHex: number
): Omit<AnimatedFlier, 'centerX' | 'centerZ' | 'baseY' | 'rx' | 'rz' | 'speed' | 'phase'> {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.018, 0.09, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const wMat = new THREE.MeshStandardMaterial({
    color: wingHex,
    emissive: wingHex,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide,
    roughness: 0.4,
  });
  const leftWing = new THREE.Group();
  const lw = new THREE.Mesh(new THREE.CircleGeometry(0.095, 8), wMat);
  lw.rotation.x = -Math.PI / 2;
  lw.position.set(-0.08, 0, 0.01);
  leftWing.add(lw);

  const rightWing = new THREE.Group();
  const rw = new THREE.Mesh(new THREE.CircleGeometry(0.095, 8), wMat);
  rw.rotation.x = -Math.PI / 2;
  rw.position.set(0.08, 0, 0.01);
  rightWing.add(rw);

  g.add(leftWing, rightWing);
  return { group: g, leftWing, rightWing };
}

// =========================================================================
// MAIN BUILDER: SUNGAI TERCEMAR -> SUNGAI DIPULIHKAN (MISI 2 3D WORLD)
// =========================================================================
export function buildSungaiTercemarWorld(
  avatarId: AvatarId,
  maxAnisotropy: number,
  justTeleportedInitially: boolean
): SungaiTercemarWorldHandle {
  const group = new THREE.Group();
  const texturesToDispose: THREE.Texture[] = [];

  // 1. NATURAL SKY LIGHTS & CLOUDS
  const hemiLight = new THREE.HemisphereLight(0x94a3b8, 0x365314, 1.05);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1c4, 1.35);
  sunLight.position.set(22, 30, 18);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -28;
  sunLight.shadow.camera.right = 28;
  sunLight.shadow.camera.top = 28;
  sunLight.shadow.camera.bottom = -28;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 85;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  group.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.4);
  fillLight.position.set(-16, 14, -12);
  group.add(fillLight);

  // Drifting 3D composite clouds across the river sky
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.92 });
  const clouds: { group: THREE.Group; speed: number; baseZ: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const cg = new THREE.Group();
    const puffs = [
      [0, 0, 0, 1.8],
      [-1.4, -0.2, 0.2, 1.35],
      [1.45, -0.15, -0.2, 1.4],
      [0.4, 0.55, 0.1, 1.2],
    ];
    puffs.forEach(([px, py, pz, pr]) => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(pr, 1), cloudMat);
      m.scale.set(1.3, 0.72, 1.0);
      m.position.set(px, py, pz);
      cg.add(m);
    });
    const cx = -28 + i * 9.5;
    const cz = -18 - (i % 3) * 7;
    cg.position.set(cx, 15.5 + (i % 2) * 2.2, cz);
    group.add(cg);
    clouds.push({ group: cg, speed: 0.45 + (i % 3) * 0.18, baseZ: cz });
  }

  // 2. SCULPTED VALLEY TERRAIN & TRAIL
  const groundTex = createRiverGroundTexture(maxAnisotropy);
  const trailTex = createTrailTexture(maxAnisotropy);
  texturesToDispose.push(groundTex, trailTex);

  const terrainGeo = new THREE.PlaneGeometry(120, 120, 84, 84);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colArr = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = riverGroundHeightAt(vx, vz);
    posAttr.setY(i, vy);

    const distR = Math.abs(vx - riverCenterX(vz));
    if (vz < -24.5) {
      _tmpColor.setHex(0x475569);
    } else if (distR < 4.5) {
      _tmpColor.setHex(0xb89b72);
    } else {
      _tmpColor.setHex(0x7ccf5f);
    }
    colArr[i * 3] = _tmpColor.r;
    colArr[i * 3 + 1] = _tmpColor.g;
    colArr[i * 3 + 2] = _tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Scenic trail along the west bank leading to the river overlook point
  const trailPts = [
    new THREE.Vector3(-9.2, 0, 12.0),
    new THREE.Vector3(-7.6, 0, 7.8),
    new THREE.Vector3(-5.8, 0, 4.2),
    new THREE.Vector3(-4.6, 0, 1.6),
  ].map((p) => {
    p.y = riverGroundHeightAt(p.x, p.z) + 0.04;
    return p;
  });
  const trailCurve = new THREE.CatmullRomCurve3(trailPts);
  const tSegs = 32;
  const tPos: number[] = [];
  const tUv: number[] = [];
  const tIdx: number[] = [];
  for (let i = 0; i <= tSegs; i++) {
    const t = i / tSegs;
    const p = trailCurve.getPointAt(t);
    const tan = trailCurve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    const len = Math.hypot(nx, nz) || 1;
    const ox = (nx / len) * 0.9;
    const oz = (nz / len) * 0.9;
    tPos.push(
      p.x - ox,
      riverGroundHeightAt(p.x - ox, p.z - oz) + 0.04,
      p.z - oz,
      p.x + ox,
      riverGroundHeightAt(p.x + ox, p.z + oz) + 0.04,
      p.z + oz
    );
    tUv.push(t * 5, 0, t * 5, 1);
    if (i < tSegs) {
      const b = i * 2;
      tIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
  trailGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
  trailGeo.setIndex(tIdx);
  trailGeo.computeVertexNormals();
  const trailMesh = new THREE.Mesh(
    trailGeo,
    new THREE.MeshStandardMaterial({
      map: trailTex,
      roughness: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  trailMesh.receiveShadow = true;
  group.add(trailMesh);

  // 3. FLOWING ANIMATED RIVER WATER (TRANSFORMS FROM MURKY TO CRYSTAL CLEAR)
  const waterTex = createWaterFlowTexture(maxAnisotropy);
  texturesToDispose.push(waterTex);

  const riverPos: number[] = [];
  const riverUvs: number[] = [];
  const riverIdx: number[] = [];
  const rSegs = 56;
  for (let i = 0; i <= rSegs; i++) {
    const t = i / rSegs;
    const z = -25.0 + t * 50.0;
    const cx = riverCenterX(z);
    const halfW = 3.95 + Math.sin(z * 0.16) * 0.55;
    riverPos.push(cx - halfW, -0.42, z, cx + halfW, -0.42, z);
    riverUvs.push(0, t * 7, 1, t * 7);
    if (i < rSegs) {
      const b = i * 2;
      riverIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverPos, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(riverUvs, 2));
  riverGeo.setIndex(riverIdx);
  riverGeo.computeVertexNormals();

  const riverMat = new THREE.MeshPhysicalMaterial({
    map: waterTex,
    color: _murkyWaterCol.clone(),
    emissive: _murkyEmissiveCol.clone(),
    emissiveIntensity: 0.18,
    roughness: 0.42,
    metalness: 0.08,
    clearcoat: 0.75,
    transparent: true,
    opacity: 0.92,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  group.add(riverMesh);

  // Natural riverbank boulders & fallen mossy log (matching Panel 3!)
  const rockGeo = new THREE.DodecahedronGeometry(0.6, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, flatShading: true });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.85, flatShading: true });
  [
    [-1.4, -4.5, 1.3],
    [6.8, -2.0, 1.4],
    [-1.8, 3.8, 1.1],
    [8.2, 6.2, 1.25],
    [5.4, -10.5, 1.5],
    [-3.2, -13.0, 1.35],
    [7.5, 12.0, 1.15],
  ].forEach(([rx, rz, sc], idx) => {
    const rk = new THREE.Mesh(rockGeo, idx % 2 === 0 ? rockMat : mossMat);
    rk.scale.set(sc * 1.25, sc * 0.72, sc);
    rk.position.set(rx, riverGroundHeightAt(rx, rz) + 0.2, rz);
    rk.rotation.y = idx * 0.85;
    rk.castShadow = true;
    rk.receiveShadow = true;
    group.add(rk);
  });

  // Fallen log on East bank (bird & turtle perch)
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 3.6, 9), barkMat);
  logMesh.rotation.z = Math.PI * 0.46;
  logMesh.rotation.y = 0.4;
  logMesh.position.set(7.4, riverGroundHeightAt(7.4, 2.2) + 0.22, 2.2);
  logMesh.castShadow = true;
  group.add(logMesh);

  // 4. TREES, BANANA SHRUBS, GRASS & BLOOMING WILDFLOWERS
  const leafMatA = new THREE.MeshStandardMaterial({ color: _pollutedLeafA.clone(), roughness: 0.75 });
  const leafMatB = new THREE.MeshStandardMaterial({ color: _pollutedLeafB.clone(), roughness: 0.78 });
  const swayTrees: { pivot: THREE.Group; phase: number }[] = [];

  [
    [-10.5, -5.5, 1.28, 'canopy'],
    [-12.2, 3.2, 1.18, 'canopy'],
    [-9.8, 10.5, 1.05, 'banana'],
    [11.4, -7.2, 1.32, 'canopy'],
    [12.2, 1.8, 1.12, 'banana'],
    [10.8, 9.6, 1.22, 'canopy'],
    [-7.5, -14.5, 1.3, 'canopy'],
    [10.2, -16.5, 1.28, 'canopy'],
    [-3.8, -1.8, 0.88, 'banana'],
    [9.4, -3.0, 0.95, 'banana'],
  ].forEach(([tx, tz, sc, variant], idx) => {
    const x = tx as number;
    const z = tz as number;
    const { root, canopyPivot } = buildRiverbankTree(
      sc as number,
      variant as 'canopy' | 'banana',
      barkMat,
      leafMatA,
      leafMatB
    );
    root.position.set(x, riverGroundHeightAt(x, z), z);
    root.rotation.y = idx * 1.1;
    group.add(root);
    swayTrees.push({ pivot: canopyPivot, phase: idx * 0.9 });
  });

  // Outer perimeter forest horizon ring
  const perimCount = 44;
  const perimTrunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.28, 0.45, 4.2, 7),
    barkMat,
    perimCount
  );
  const perimCrowns = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(2.1, 1),
    leafMatB,
    perimCount
  );
  for (let i = 0; i < perimCount; i++) {
    const ang = (i / perimCount) * Math.PI * 2;
    const rad = 26.0 + (i % 4) * 3.6;
    const px = Math.cos(ang) * rad;
    const pz = Math.sin(ang) * rad;
    const py = riverGroundHeightAt(px, pz);
    const sc = 0.9 + (i % 4) * 0.16;

    _dummy.position.set(px, py + 2.0 * sc, pz);
    _dummy.rotation.set(0, ang, 0);
    _dummy.scale.setScalar(sc);
    _dummy.updateMatrix();
    perimTrunks.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(px, py + 4.5 * sc, pz);
    _dummy.scale.set(sc * 1.15, sc * 0.95, sc * 1.15);
    _dummy.updateMatrix();
    perimCrowns.setMatrixAt(i, _dummy.matrix);
  }
  perimTrunks.computeBoundingSphere();
  perimCrowns.computeBoundingSphere();
  group.add(perimTrunks, perimCrowns);

  // Riverbank tall grass (InstancedMesh)
  const grassCount = 240;
  const grassMat = new THREE.MeshStandardMaterial({ color: _pollutedGrass.clone(), roughness: 0.8 });
  const grassInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.56, 4), grassMat, grassCount);
  let gPlaced = 0;
  for (let i = 0; i < 450 && gPlaced < grassCount; i++) {
    const gx = Math.sin(i * 6.73) * 18.5;
    const gz = Math.cos(i * 4.31) * 19.5;
    if (Math.abs(gx - riverCenterX(gz)) < 4.35) continue;
    const gy = riverGroundHeightAt(gx, gz);
    const sc = 0.8 + (i % 4) * 0.22;
    _dummy.position.set(gx, gy + 0.22 * sc, gz);
    _dummy.rotation.set((i % 3) * 0.12 - 0.12, i * 1.2, 0);
    _dummy.scale.setScalar(sc);
    _dummy.updateMatrix();
    grassInst.setMatrixAt(gPlaced, _dummy.matrix);
    gPlaced++;
  }
  grassInst.count = gPlaced;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  // Wildflowers (bloom dynamically from 0.02 to full vibrant size upon river restoration!)
  const flowerCount = 68;
  const flowerInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.04, 0.15, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }),
    flowerCount
  );
  const flowerSeeds: { x: number; y: number; z: number; sc: number }[] = [];
  const fPalette = [0xfef08a, 0xfb7185, 0xc084fc, 0x38bdf8, 0xf97316, 0xffffff];
  for (let i = 0; i < 160 && flowerSeeds.length < flowerCount; i++) {
    const fx = Math.cos(i * 5.4) * 14.5;
    const fz = Math.sin(i * 3.8) * 15.5;
    if (Math.abs(fx - riverCenterX(fz)) < 4.55) continue;
    flowerSeeds.push({
      x: fx,
      y: riverGroundHeightAt(fx, fz),
      z: fz,
      sc: 0.85 + (i % 3) * 0.22,
    });
    _tmpColor.setHex(fPalette[flowerSeeds.length % fPalette.length]);
    flowerInst.setColorAt(flowerSeeds.length - 1, _tmpColor);
  }
  flowerInst.count = flowerSeeds.length;
  flowerInst.frustumCulled = false;
  group.add(flowerInst);

  // 5. COMPOSITE 3D TRASH PROPS (FLOATING IN RIVER + ALONG RIVERBANKS)
  const trashList: TrashProp[] = [];
  const trashColors = [0x38bdf8, 0xfacc15, 0xf43f5e, 0xe2e8f0, 0x22c55e, 0x334155];
  const trashKinds: ('bottle' | 'can' | 'bag')[] = ['bottle', 'can', 'bag'];
  for (let i = 0; i < 28; i++) {
    const inWater = i < 16;
    const tz = -15.5 + (i % 14) * 2.25;
    const rx = riverCenterX(tz);
    const tx = inWater
      ? rx + Math.sin(i * 2.7) * 2.6
      : rx + (i % 2 === 0 ? -1 : 1) * (4.15 + (i % 3) * 0.65);
    const ty = inWater ? -0.34 : riverGroundHeightAt(tx, tz) + 0.08;
    const kind = trashKinds[i % trashKinds.length];
    const built = buildCompositeTrash(kind, trashColors[i % trashColors.length]);
    built.group.position.set(tx, ty, tz);
    built.group.rotation.y = i * 1.4;
    group.add(built.group);

    trashList.push({
      ...built,
      baseX: tx,
      baseY: ty,
      baseZ: tz,
      inWater,
      threshold: 0.08 + (i / 28) * 0.42, // Staggered cleanup disappearance!
      phase: i * 0.7,
    });
  }

  // 6. 3D WILDLIFE (FISH, TURTLES, DEER, BIRDS, BUTTERFLIES)
  const fishList: RiverFish[] = [];
  const fishColors = [0xf97316, 0x38bdf8, 0xfacc15, 0xf43f5e, 0x2dd4bf, 0xfb923c];
  for (let i = 0; i < 6; i++) {
    const f = buildFish(fishColors[i]);
    group.add(f.group);
    fishList.push({
      ...f,
      zOffset: -12.0 + i * 4.2,
      xOffset: (i % 2 === 0 ? -1 : 1) * (0.8 + (i % 3) * 0.55),
      speed: 1.5 + (i % 3) * 0.45,
      phase: i * 1.1,
    });
  }

  const turtleList: RiverTurtle[] = [];
  [
    { x: 5.8, z: 3.4, inWater: true, ph: 0 },
    { x: 6.4, z: 5.0, inWater: true, ph: 1.6 },
    { x: 7.4, z: -1.4, inWater: false, ph: 2.9 },
    { x: -1.1, z: -2.2, inWater: false, ph: 4.2 },
  ].forEach((spec) => {
    const tb = buildTurtle();
    tb.group.position.set(
      spec.x,
      spec.inWater ? -0.44 : riverGroundHeightAt(spec.x, spec.z),
      spec.z
    );
    group.add(tb.group);
    turtleList.push({
      ...tb,
      homeX: spec.x,
      homeZ: spec.z,
      inWater: spec.inWater,
      phase: spec.ph,
    });
  });

  const deerList: RiverDeer[] = [];
  [
    { x: 8.6, z: -5.5, ph: 0.4 },
    { x: 10.4, z: 4.5, ph: 2.5 },
  ].forEach((spec) => {
    const d = buildRiverDeer();
    d.group.position.set(spec.x, riverGroundHeightAt(spec.x, spec.z), spec.z);
    d.group.scale.setScalar(0.01);
    group.add(d.group);
    deerList.push({ ...d, homeX: spec.x, homeZ: spec.z, phase: spec.ph });
  });

  const birds: AnimatedFlier[] = [];
  [
    { cx: 1, cz: -4, y: 7.6, rx: 9.0, rz: 7.5, spd: 0.42, c1: 0x0284c7, c2: 0x38bdf8, ph: 0, always: true },
    { cx: -3, cz: -10, y: 8.4, rx: 8.0, rz: 6.5, spd: 0.36, c1: 0xf97316, c2: 0xfacc15, ph: 2.1, always: true },
    { cx: 4, cz: 2, y: 5.4, rx: 7.2, rz: 6.0, spd: 0.52, c1: 0xe11d48, c2: 0xfda4af, ph: 1.1, always: false },
    { cx: 6, cz: -6, y: 4.8, rx: 6.4, rz: 5.2, spd: 0.58, c1: 0x16a34a, c2: 0x86efac, ph: 3.4, always: false },
    { cx: -2, cz: 5, y: 5.9, rx: 8.4, rz: 6.2, spd: 0.46, c1: 0x7c3aed, c2: 0xc4b5fd, ph: 4.2, always: false },
    { cx: 8, cz: 5, y: 4.5, rx: 5.2, rz: 4.5, spd: 0.62, c1: 0x0ea5e9, c2: 0xe0f2fe, ph: 5.1, always: false },
    { cx: 0, cz: -12, y: 6.2, rx: 7.5, rz: 6.0, spd: 0.49, c1: 0xeab308, c2: 0xfef08a, ph: 2.8, always: false },
  ].forEach((s) => {
    const bd = buildRiverBird(s.c1, s.c2);
    group.add(bd.group);
    birds.push({
      ...bd,
      centerX: s.cx,
      centerZ: s.cz,
      baseY: s.y,
      rx: s.rx,
      rz: s.rz,
      speed: s.spd,
      phase: s.ph,
      alwaysVisible: s.always,
    });
  });

  const butterflies: AnimatedFlier[] = [];
  const bfCols = [0xf97316, 0x38bdf8, 0xfacc15, 0xf472b6, 0xa855f7];
  for (let i = 0; i < 10; i++) {
    const bf = buildRiverButterfly(bfCols[i % bfCols.length]);
    bf.group.scale.setScalar(0.01);
    group.add(bf.group);
    butterflies.push({
      ...bf,
      centerX: (i < 5 ? -6.5 : 8.5) + Math.sin(i * 1.9) * 3.0,
      centerZ: -2.0 + Math.cos(i * 2.4) * 6.5,
      baseY: 1.1 + (i % 3) * 0.4,
      rx: 1.2 + (i % 2) * 0.5,
      rz: 1.1 + (i % 3) * 0.4,
      speed: 1.35 + (i % 3) * 0.25,
      phase: i * 0.85,
    });
  }

  // 7. ECOWORLD AGENT + PORTAL ARRIVAL TELEPORT FX
  const shadowTex = createContactShadowTexture();
  texturesToDispose.push(shadowTex);
  const agentRig: HumanAgentRig = buildHumanEcoAgent(avatarId, shadowTex, {
    maxAnisotropy,
    showPedestal: false,
  });
  const startPos = trailCurve.getPointAt(0);
  agentRig.group.position.copy(startPos);
  agentRig.group.rotation.y = 0.65;
  agentRig.group.scale.setScalar(1.25);
  group.add(agentRig.group);

  const arrivalFxGroup = new THREE.Group();
  arrivalFxGroup.position.copy(startPos);
  arrivalFxGroup.visible = justTeleportedInitially;
  group.add(arrivalFxGroup);
  const arrBeamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const arrBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.45, 11, 24, 1, true),
    arrBeamMat
  );
  arrBeam.position.y = 5.5;
  arrivalFxGroup.add(arrBeam);

  // Simulation state
  let introClock = 0;
  let introPhase: 'walking' | 'observing' | 'done' = 'done';
  let recoveryProgress = 0; // 0 = Polluted river, 1 = Clean restored river!
  let camYaw = -0.35;
  let camPitch = 0.28;
  let camDist = 9.5;
  let camPreset: 'cinematic' | 'river_wide' | 'agent_close' = 'cinematic';

  return {
    group,
    startTravelIntro: () => {
      introClock = 0;
      introPhase = 'walking';
      agentRig.group.position.copy(trailCurve.getPointAt(0));
    },
    setCameraPreset: (preset) => {
      camPreset = preset;
      if (preset === 'river_wide') {
        camDist = 14.5;
        camPitch = 0.42;
      } else if (preset === 'agent_close') {
        camDist = 6.2;
        camPitch = 0.22;
      } else {
        camDist = 9.5;
        camPitch = 0.28;
      }
    },
    orbitCameraBy: (dYaw, dPitch) => {
      camYaw += dYaw;
      camPitch = Math.max(0.12, Math.min(0.95, camPitch + dPitch));
    },
    zoomCameraBy: (delta) => {
      camDist = Math.max(5.0, Math.min(20.0, camDist + delta));
    },
    update: (dt, elapsed, camera, stage, justTeleported) => {
      // A. Portal Teleportation arrival shimmer (if entering from Mission 1)
      if (justTeleported && elapsed < 2.2) {
        const p = elapsed / 2.2;
        arrivalFxGroup.visible = true;
        arrBeamMat.opacity = 0.55 * (1 - p);
        arrBeam.rotation.y += dt * 3.2;
      } else if (arrivalFxGroup.visible) {
        arrivalFxGroup.visible = false;
      }

      // B. Staged Recovery Progress (ONLY activates when stage === 'victory'!)
      const targetRecovery = stage === 'victory' ? 1.0 : 0.0;
      if (stage === 'victory') {
        recoveryProgress = Math.min(1, recoveryProgress + dt * 0.28);
      } else {
        recoveryProgress = THREE.MathUtils.damp(recoveryProgress, targetRecovery, 4.5, dt);
      }

      // C. Agent Movement & Travel Intro Choreography
      let isMoving = false;
      if (stage === 'travel_intro') {
        introClock += dt;
        const walkDuration = 2.6;
        if (introClock < walkDuration) {
          introPhase = 'walking';
          const t = Math.min(1, introClock / walkDuration);
          const pos = trailCurve.getPointAt(t);
          const tan = trailCurve.getTangentAt(t);
          agentRig.group.position.copy(pos);
          const faceYaw = Math.atan2(tan.x, tan.z);
          agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, faceYaw, 10, dt);
          isMoving = true;
        } else {
          introPhase = introClock < 6.4 ? 'observing' : 'done';
          const endPos = trailCurve.getPointAt(1);
          agentRig.group.position.copy(endPos);
          // Look straight across toward the polluted river center!
          const riverTargetYaw = Math.atan2(
            riverCenterX(endPos.z - 2.0) - endPos.x,
            -2.0
          );
          agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, riverTargetYaw, 6, dt);
        }
      } else if (stage === 'portal') {
        const p0 = trailCurve.getPointAt(0);
        agentRig.group.position.copy(p0);
        agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, 0.72, 6, dt);
      } else {
        const endPos = trailCurve.getPointAt(1);
        agentRig.group.position.copy(endPos);
        const riverLookYaw = Math.atan2(
          riverCenterX(endPos.z - 2.0) - endPos.x,
          -2.0
        );
        agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, riverLookYaw, 6, dt);
      }

      animateHumanAgent(agentRig, elapsed, dt, {
        isMoving,
        hovered: stage === 'victory',
        selected: true,
      });

      // D. Camera Choreography (Orbitable & Third-person River Overlook!)
      const ap = agentRig.group.position;
      if (stage === 'travel_intro') {
        if (introPhase === 'walking') {
          _camPos.set(ap.x - 3.8, ap.y + 3.0, ap.z + 5.2);
          _camLook.set(ap.x + 2.2, ap.y + 1.35, ap.z - 2.4);
        } else {
          // Slow sweeping observation pan across the polluted river from behind/side of the agent
          const pan = Math.sin((introClock - 2.6) * 0.55) * 0.45;
          _camPos.set(ap.x - 3.6 + pan * 2.4, ap.y + 3.2, ap.z + 4.4);
          _camLook.set(2.4 + pan * 2.0, 0.6, -3.5);
        }
      } else if (stage === 'victory') {
        const orbit = Math.sin(elapsed * 0.22) * 0.45 + camYaw * 0.4;
        _camPos.set(
          ap.x - 2.5 + Math.sin(orbit) * 6.5,
          ap.y + 3.6 + Math.cos(elapsed * 0.25) * 0.35,
          ap.z + 5.8 + Math.cos(orbit) * 3.5
        );
        _camLook.set(2.2, 0.85, -2.5);
      } else if (camPreset === 'river_wide') {
        _camPos.set(
          Math.sin(camYaw) * camDist,
          Math.sin(camPitch) * camDist + 1.8,
          Math.cos(camYaw) * camDist
        );
        _camLook.set(1.8, 0.7, -2.2);
      } else {
        const autoDrift = Math.sin(elapsed * 0.14) * 0.16;
        const yAngle = camYaw + autoDrift;
        const horiz = Math.cos(camPitch) * camDist;
        const vert = Math.sin(camPitch) * camDist + 1.4;
        _camPos.set(
          ap.x + Math.sin(yAngle) * horiz,
          ap.y + vert,
          ap.z + Math.cos(yAngle) * horiz
        );
        _camLook.set(ap.x * 0.4 + 1.8, ap.y + 1.2, ap.z * 0.35 - 2.2);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camPos.x, 4.8, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camPos.y, 4.8, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camPos.z, 4.8, dt);
      _lookSmooth.x = THREE.MathUtils.damp(_lookSmooth.x, _camLook.x, 5.5, dt);
      _lookSmooth.y = THREE.MathUtils.damp(_lookSmooth.y, _lookSmooth.y < -10 ? _camLook.y : _camLook.y, 5.5, dt);
      _lookSmooth.z = THREE.MathUtils.damp(_lookSmooth.z, _camLook.z, 5.5, dt);
      camera.lookAt(_lookSmooth);

      // E. River & Environment Transformation (Polluted -> Clean)
      waterTex.offset.y -= dt * (0.45 + recoveryProgress * 0.45);
      riverMat.color.copy(_murkyWaterCol).lerp(_cleanWaterCol, recoveryProgress);
      riverMat.emissive.copy(_murkyEmissiveCol).lerp(_cleanEmissiveCol, recoveryProgress);
      riverMat.emissiveIntensity = 0.16 + recoveryProgress * 0.34;
      riverMat.roughness = THREE.MathUtils.lerp(0.44, 0.08, recoveryProgress);

      leafMatA.color.copy(_pollutedLeafA).lerp(_cleanLeafA, recoveryProgress);
      leafMatB.color.copy(_pollutedLeafB).lerp(_cleanLeafB, recoveryProgress);
      grassMat.color.copy(_pollutedGrass).lerp(_cleanGrass, recoveryProgress);
      cloudMat.color.copy(_pollutedCloud).lerp(_cleanCloud, recoveryProgress);

      hemiLight.color.copy(_pollutedSky).lerp(_cleanSky, recoveryProgress);
      hemiLight.intensity = 1.05 + recoveryProgress * 0.35;
      sunLight.intensity = 1.25 + recoveryProgress * 0.75;

      // Drifting Clouds
      clouds.forEach((cl) => {
        cl.group.position.x += dt * cl.speed;
        if (cl.group.position.x > 34) cl.group.position.x = -34;
      });

      // Gentle Wind-Swaying Trees
      swayTrees.forEach((tr) => {
        tr.pivot.rotation.z = Math.sin(elapsed * 1.3 + tr.phase) * 0.032;
        tr.pivot.rotation.x = Math.cos(elapsed * 1.05 + tr.phase) * 0.022;
      });

      // Staged Trash Cleanup Animation!
      trashList.forEach((tr) => {
        if (recoveryProgress < tr.threshold) {
          tr.group.visible = true;
          tr.group.scale.setScalar(1.0);
          if (tr.inWater) {
            tr.group.position.y = tr.baseY + Math.sin(elapsed * 1.9 + tr.phase) * 0.045;
            tr.group.rotation.z = Math.sin(elapsed * 1.2 + tr.phase) * 0.18 + Math.PI * 0.38;
          } else {
            tr.group.position.y = tr.baseY;
          }
          (tr.sparkleRing.material as THREE.MeshBasicMaterial).opacity = 0;
        } else {
          const vanishT = Math.min(1, (recoveryProgress - tr.threshold) / 0.16);
          if (vanishT >= 1) {
            tr.group.visible = false;
          } else {
            tr.group.visible = true;
            const sc = Math.max(0.01, 1.0 - vanishT);
            tr.group.scale.setScalar(sc);
            tr.group.position.y = tr.baseY + vanishT * 1.1;
            tr.group.rotation.y += dt * 5.0;
            (tr.sparkleRing.material as THREE.MeshBasicMaterial).opacity =
              Math.sin(vanishT * Math.PI) * 0.9;
            tr.sparkleRing.scale.setScalar(1 + vanishT * 1.4);
          }
        }
      });

      // Blooming Wildflowers on Riverbank Restoration
      const flowerGrowth = Math.max(0.02, Math.min(1, (recoveryProgress - 0.32) / 0.55));
      for (let i = 0; i < flowerSeeds.length; i++) {
        const fs = flowerSeeds[i];
        _dummy.position.set(fs.x, fs.y + 0.16 * flowerGrowth, fs.z);
        _dummy.rotation.set(0, i * 0.8 + elapsed * 0.3 * flowerGrowth, 0);
        _dummy.scale.setScalar(fs.sc * flowerGrowth);
        _dummy.updateMatrix();
        flowerInst.setMatrixAt(i, _dummy.matrix);
      }
      flowerInst.instanceMatrix.needsUpdate = true;

      // Fish (sluggish & deep when polluted -> energetic colorful swim when restored!)
      fishList.forEach((f) => {
        const swimSpeed = f.speed * (0.18 + recoveryProgress * 1.15);
        const z = ((f.zOffset + elapsed * swimSpeed + 18) % 36) - 18;
        const x = riverCenterX(z) + f.xOffset + Math.sin(elapsed * 1.4 + f.phase) * 0.55;
        const y = -0.78 + recoveryProgress * 0.34 + Math.sin(elapsed * 2.5 + f.phase) * 0.04;
        f.group.position.set(x, y, z);
        f.group.scale.setScalar(0.55 + recoveryProgress * 0.55);
        f.group.rotation.y = Math.cos(elapsed * 1.4 + f.phase) * 0.25;
        f.tailPivot.rotation.y = Math.sin(elapsed * (3.5 + recoveryProgress * 8.5) + f.phase) * 0.45;
      });

      // Turtles (sluggish on bank -> happily paddling & bobbing when restored!)
      turtleList.forEach((tb) => {
        const act = 0.15 + recoveryProgress * 0.85;
        const a = elapsed * 0.55 * act + tb.phase;
        const tx = tb.homeX + Math.cos(a) * (tb.inWater ? 0.85 * act : 0.25 * act);
        const tz = tb.homeZ + Math.sin(a) * (tb.inWater ? 0.95 * act : 0.25 * act);
        const ty = tb.inWater
          ? -0.44 + Math.sin(elapsed * 2.4 + tb.phase) * 0.04 * act
          : riverGroundHeightAt(tx, tz);
        tb.group.position.set(tx, ty, tz);
        tb.group.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
        tb.headPivot.rotation.x = Math.sin(elapsed * 1.6 + tb.phase) * 0.12 * act;
        const fl = Math.sin(elapsed * 4.5 * act + tb.phase) * 0.25 * act;
        tb.flippers.forEach((flm, idx) => {
          flm.rotation.z = idx % 2 === 0 ? fl : -fl;
        });
      });

      // Riverbank Deer (emerge cleanly after restoration)
      const deerScale = Math.max(0.01, Math.min(1, (recoveryProgress - 0.42) / 0.5));
      deerList.forEach((d) => {
        const a = elapsed * 0.28 + d.phase;
        const dx = d.homeX + Math.cos(a) * 1.3;
        const dz = d.homeZ + Math.sin(a) * 1.3;
        d.group.position.set(dx, riverGroundHeightAt(dx, dz), dz);
        d.group.scale.setScalar(deerScale);
        d.group.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
        d.headPivot.rotation.x = Math.sin(elapsed * 0.9 + d.phase) > 0.2 ? 0.58 : 0.08;
      });

      // Birds (2 sluggish distant birds before -> 7 joyful soaring birds after!)
      birds.forEach((bd) => {
        const visScale = bd.alwaysVisible
          ? 0.95
          : Math.max(0.01, Math.min(1, (recoveryProgress - 0.3) / 0.5));
        bd.group.scale.setScalar(visScale);
        const spd = bd.speed * (bd.alwaysVisible ? 0.65 + recoveryProgress * 0.55 : 1.0);
        const a = elapsed * spd + bd.phase;
        const bx = bd.centerX + Math.cos(a) * bd.rx;
        const bz = bd.centerZ + Math.sin(a) * bd.rz;
        const by = bd.baseY + Math.sin(elapsed * 1.6 + bd.phase) * 0.65;
        bd.group.position.set(bx, by, bz);
        bd.group.rotation.y = Math.atan2(-Math.sin(a) * bd.rx, Math.cos(a) * bd.rz);
        const flap = Math.sin(elapsed * (9.5 + recoveryProgress * 3.5) + bd.phase) * 0.65;
        bd.leftWing.rotation.z = flap;
        bd.rightWing.rotation.z = -flap;
      });

      // Butterflies around blooming wildflowers
      const bfScale = Math.max(0.01, Math.min(1, (recoveryProgress - 0.48) / 0.45));
      butterflies.forEach((bf) => {
        const a = elapsed * bf.speed + bf.phase;
        const bx = bf.centerX + Math.sin(a) * bf.rx;
        const bz = bf.centerZ + Math.sin(a * 2.0) * bf.rz * 0.6;
        const by = riverGroundHeightAt(bx, bz) + bf.baseY + Math.sin(elapsed * 4.0 + bf.phase) * 0.25;
        bf.group.position.set(bx, by, bz);
        bf.group.scale.setScalar(bfScale);
        bf.group.rotation.y = a + Math.PI * 0.5;
        const fl = Math.sin(elapsed * 18.0 + bf.phase) * 0.85;
        bf.leftWing.rotation.z = fl;
        bf.rightWing.rotation.z = -fl;
      });

      return { introPhase, recoveryProgress };
    },
    dispose: () => {
      texturesToDispose.forEach((t) => t.dispose());
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    },
  };
}
