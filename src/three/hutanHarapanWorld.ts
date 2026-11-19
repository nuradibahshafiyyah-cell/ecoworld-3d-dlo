import * as THREE from 'three';
import { AvatarId } from '../types/game';
import { animateHumanAgent, buildHumanEcoAgent, HumanAgentRig } from './humanAgents';
import {
  createContactShadowTexture,
  createWaterfallTexture,
  createWaterFlowTexture,
} from './textures';

export type ProposalKey = 'A' | 'B' | 'C';

export interface InteractiveSpot {
  id: string;
  kind: 'proposal' | 'nature';
  proposalId?: ProposalKey;
  title: string;
  subtitle: string;
  actionLabel: string;
  position: THREE.Vector3;
  triggerRadius: number;
}

export interface HutanHarapanState {
  locationName: string;
  nearbySpot: InteractiveSpot | null;
  isMoving: boolean;
  isRunning: boolean;
}

export interface HutanHarapanWorldHandle {
  group: THREE.Group;
  groundHeightAt: (x: number, z: number) => number;
  getInteractiveSpots: () => InteractiveSpot[];
  getRayTargets: () => THREE.Object3D[];
  setInputVector: (x: number, z: number, running: boolean) => void;
  setWalkTarget: (x: number, z: number) => void;
  walkToSpot: (spotId: string) => void;
  triggerInspectEffect: (spotId: string) => void;
  setExploredProposals: (ids: ProposalKey[]) => void;
  setVictoryState: (victory: boolean) => void;
  setCameraPreset: (preset: 'follow' | 'wide') => void;
  orbitCameraBy: (dYaw: number, dPitch: number) => void;
  zoomCameraBy: (delta: number) => void;
  update: (
    dt: number,
    elapsed: number,
    camera: THREE.PerspectiveCamera,
    stage: 'emergency_call' | 'explore' | 'decision' | 'victory'
  ) => HutanHarapanState;
  dispose: () => void;
}

// Pre-allocated math helpers (zero GC inside animation loop)
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _tmpColor = new THREE.Color();

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export function streamCenterX(z: number): number {
  return 2.0 + Math.sin((z + 18) * 0.13) * 3.8;
}

const BRIDGE_Z = -6.0;
const BRIDGE_X = streamCenterX(BRIDGE_Z);

export function isOnBridge(x: number, z: number): boolean {
  return Math.abs(z - BRIDGE_Z) <= 1.55 && Math.abs(x - BRIDGE_X) <= 3.1;
}

export function groundHeightAt(x: number, z: number): number {
  if (isOnBridge(x, z)) {
    const t = Math.max(0, Math.min(1, 1 - Math.abs(x - BRIDGE_X) / 3.1));
    return 0.14 + Math.sin(t * Math.PI * 0.5) * 0.24;
  }

  // Gentle meadow undulation across playable valley
  let h =
    Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.24 +
    Math.sin(x * 0.28 + z * 0.19) * 0.08;

  // Carve winding river channel smoothly
  const sx = streamCenterX(z);
  const distStream = Math.abs(x - sx);
  const streamWidth = z < -13 ? 3.2 : 2.15;
  if (distStream < streamWidth + 1.4) {
    const bankT = Math.max(0, Math.min(1, 1 - distStream / (streamWidth + 1.4)));
    h -= bankT * bankT * 0.92;
  }

  // Northern waterfall rocky terrace rises cleanly behind z = -18.5
  if (z < -18.0) {
    const rise = Math.min(1, (-18.0 - z) / 14.0);
    h += rise * rise * 11.5;
  }

  // Outer hillside rim creates a natural green valley perimeter
  const r = Math.hypot(x, z);
  if (r > 21.5) {
    const hill = Math.min(1, (r - 21.5) / 16.0);
    h += hill * hill * 5.8;
  }

  return h;
}

function createForestGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#3a9b43');
  grad.addColorStop(0.5, '#4db549');
  grad.addColorStop(1, '#31893d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Organic grass blades, moss patches & clover highlights
  for (let i = 0; i < 4200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 19341.123) % 1;
    const px = Math.abs(x) * 512;
    const py = Math.abs(y) * 512;
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(163, 230, 53, 0.24)'
        : i % 3 === 0
        ? 'rgba(21, 128, 61, 0.25)'
        : 'rgba(74, 222, 128, 0.18)';
    ctx.fillRect(px, py, 3, 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createForestPathTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#a47e54';
  ctx.fillRect(0, 0, 256, 128);

  for (let i = 0; i < 360; i++) {
    const px = Math.abs((Math.sin(i * 19.7) * 9431) % 1) * 256;
    const py = Math.abs((Math.cos(i * 31.3) * 7411) % 1) * 128;
    ctx.fillStyle = i % 3 === 0 ? '#c49f72' : i % 2 === 0 ? '#87633d' : '#b0916d';
    ctx.beginPath();
    ctx.arc(px, py, 2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSignboardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 494, 302);

  // Painted forest icon + Malaysian Bahasa Melayu banner
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.arc(256, 122, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(214, 140, 34, 0, Math.PI * 2);
  ctx.arc(298, 140, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(246, 146, 20, 48);

  ctx.fillStyle = '#14532d';
  ctx.font = '900 32px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JAGA HUTAN HARAPAN', 256, 240);

  ctx.fillStyle = '#0369a1';
  ctx.font = '700 22px "Chakra Petch", sans-serif';
  ctx.fillText('KEMPEN KESEDARAN ALAM SEKITAR', 256, 278);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// =========================================================================
// COMPOSITE 3–12 PART PROCEDURAL FOREST MODELS
// =========================================================================
function buildCompositeForestTree(
  scale: number,
  variant: 'ancient' | 'canopy' | 'palm',
  barkMat: THREE.Material,
  foliageMatA: THREE.Material,
  foliageMatB: THREE.Material
): { root: THREE.Group; canopyPivot: THREE.Group } {
  const root = new THREE.Group();
  const canopyPivot = new THREE.Group();

  // Flared root buttresses (3–4 roots grounded cleanly below y=0)
  const rootCount = variant === 'ancient' ? 4 : 3;
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * Math.PI * 2 + 0.3;
    const buttress = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.36 * scale, 1.35 * scale, 7),
      barkMat
    );
    buttress.position.set(
      Math.cos(angle) * 0.36 * scale,
      0.45 * scale,
      Math.sin(angle) * 0.36 * scale
    );
    buttress.rotation.z = -Math.cos(angle) * 0.42;
    buttress.rotation.x = Math.sin(angle) * 0.42;
    buttress.castShadow = true;
    root.add(buttress);
  }

  // Main trunk
  const trunkH = variant === 'ancient' ? 5.2 * scale : 3.9 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28 * scale, 0.54 * scale, trunkH, 9),
    barkMat
  );
  trunk.position.y = trunkH * 0.5 - 0.08;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  root.add(trunk);

  // Side branches
  const branchSpecs =
    variant === 'ancient'
      ? [
          [0.9, trunkH * 0.72, 0.2, 0.55, 0.4],
          [-0.85, trunkH * 0.78, -0.35, -0.58, -0.35],
          [0.15, trunkH * 0.84, 0.9, 0.15, -0.55],
        ]
      : [
          [0.62, trunkH * 0.76, 0.15, 0.48, 0.25],
          [-0.58, trunkH * 0.82, -0.2, -0.45, -0.28],
        ];
  branchSpecs.forEach(([bx, by, bz, rz, rx]) => {
    const br = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * scale, 0.2 * scale, 1.8 * scale, 7),
      barkMat
    );
    br.position.set(bx * scale, by, bz * scale);
    br.rotation.set(rx, 0, rz);
    br.castShadow = true;
    root.add(br);
  });

  // Multi-tiered lush foliage canopy (moves smoothly with wind)
  canopyPivot.position.set(0, trunkH - 0.3 * scale, 0);
  root.add(canopyPivot);

  if (variant === 'palm') {
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(0.55 * scale, 2.7 * scale, 6),
        i % 2 === 0 ? foliageMatA : foliageMatB
      );
      frond.position.set(Math.cos(ang) * 1.1 * scale, 0.25 * scale, Math.sin(ang) * 1.1 * scale);
      frond.rotation.z = -Math.cos(ang) * 1.15;
      frond.rotation.x = Math.sin(ang) * 1.15;
      frond.castShadow = true;
      canopyPivot.add(frond);
    }
  } else {
    const crownSpecs: [number, number, number, number, boolean][] =
      variant === 'ancient'
        ? [
            [0, 1.35, 0, 2.35, true],
            [-1.45, 0.65, 0.65, 1.65, false],
            [1.45, 0.75, -0.55, 1.68, false],
            [0.35, 0.95, 1.35, 1.5, true],
            [-0.45, 1.85, -0.75, 1.55, false],
          ]
        : [
            [0, 1.05, 0, 1.85, true],
            [-1.05, 0.45, 0.5, 1.32, false],
            [1.05, 0.5, -0.45, 1.36, false],
            [0, 1.75, 0.15, 1.25, true],
          ];
    crownSpecs.forEach(([cx, cy, cz, cr, useA]) => {
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(cr * scale, 1),
        useA ? foliageMatA : foliageMatB
      );
      puff.scale.set(1.12, 0.78, 1.12);
      puff.position.set(cx * scale, cy * scale, cz * scale);
      puff.castShadow = true;
      puff.receiveShadow = true;
      canopyPivot.add(puff);
    });
  }

  return { root, canopyPivot };
}

interface AnimatedDeer {
  group: THREE.Group;
  headPivot: THREE.Group;
  legs: THREE.Group[];
  homeX: number;
  homeZ: number;
  radius: number;
  speed: number;
  phase: number;
}

function buildDeer(hasAntlers: boolean): Omit<AnimatedDeer, 'homeX' | 'homeZ' | 'radius' | 'speed' | 'phase'> {
  const g = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 });
  const hoofMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
  const antlerMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.56, 6, 10), coatMat);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.74;
  body.castShadow = true;
  g.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), bellyMat);
  chest.position.set(0, 0.72, 0.25);
  g.add(chest);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), bellyMat);
  tail.position.set(0, 0.82, -0.44);
  tail.rotation.x = -0.6;
  g.add(tail);

  // Articulated neck + head pivot
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.88, 0.34);
  g.add(headPivot);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.42, 8), coatMat);
  neck.position.set(0, 0.18, 0.08);
  neck.rotation.x = 0.36;
  headPivot.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), coatMat);
  head.scale.set(0.9, 0.9, 1.3);
  head.position.set(0, 0.38, 0.22);
  headPivot.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), hoofMat);
  nose.position.set(0, 0.36, 0.41);
  headPivot.add(nose);

  [-0.1, 0.1].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 6), coatMat);
    ear.position.set(ex, 0.49, 0.15);
    ear.rotation.z = ex > 0 ? -0.45 : 0.45;
    headPivot.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), hoofMat);
    eye.position.set(ex * 0.95, 0.41, 0.29);
    headPivot.add(eye);

    if (hasAntlers) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 6), antlerMat);
      stem.position.set(ex * 0.7, 0.56, 0.16);
      stem.rotation.z = ex > 0 ? -0.35 : 0.35;
      stem.rotation.x = -0.2;
      headPivot.add(stem);

      const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.15, 6), antlerMat);
      tine.position.set(ex * 1.05, 0.62, 0.2);
      tine.rotation.z = ex > 0 ? -0.8 : 0.8;
      headPivot.add(tine);
    }
  });

  // 4 Articulated Legs
  const legs: THREE.Group[] = [];
  const legPositions: [number, number][] = [
    [-0.13, 0.26],
    [0.13, 0.26],
    [-0.13, -0.26],
    [0.13, -0.26],
  ];
  legPositions.forEach(([lx, lz]) => {
    const lp = new THREE.Group();
    lp.position.set(lx, 0.6, lz);
    const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.56, 7), coatMat);
    legMesh.position.y = -0.28;
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.06, 7), hoofMat);
    hoof.position.y = -0.56;
    lp.add(legMesh, hoof);
    g.add(lp);
    legs.push(lp);
  });

  return { group: g, headPivot, legs };
}

interface AnimatedRabbit {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  homeX: number;
  homeZ: number;
  radius: number;
  phase: number;
}

function buildRabbit(furColor: number): Omit<AnimatedRabbit, 'homeX' | 'homeZ' | 'radius' | 'phase'> {
  const g = new THREE.Group();
  const bodyPivot = new THREE.Group();
  g.add(bodyPivot);

  const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.8 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), furMat);
  body.scale.set(0.92, 0.9, 1.25);
  body.position.set(0, 0.18, 0);
  body.castShadow = true;
  bodyPivot.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), furMat);
  head.position.set(0, 0.3, 0.16);
  bodyPivot.add(head);

  [-0.055, 0.055].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.16, 4, 6), furMat);
    ear.position.set(ex, 0.47, 0.12);
    ear.rotation.x = -0.18;
    ear.rotation.z = ex > 0 ? -0.15 : 0.15;
    bodyPivot.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), darkMat);
    eye.position.set(ex * 1.4, 0.33, 0.25);
    bodyPivot.add(eye);
  });

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), pinkMat);
  nose.position.set(0, 0.29, 0.29);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  tail.position.set(0, 0.18, -0.22);
  bodyPivot.add(nose, tail);

  return { group: g, bodyPivot };
}

interface AnimatedSquirrel {
  group: THREE.Group;
  tailPivot: THREE.Group;
  homeX: number;
  homeZ: number;
  phase: number;
}

function buildSquirrel(): Omit<AnimatedSquirrel, 'homeX' | 'homeZ' | 'phase'> {
  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.72 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 5, 8), furMat);
  body.position.set(0, 0.19, 0);
  body.rotation.x = 0.45;
  g.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), bellyMat);
  belly.position.set(0, 0.18, 0.06);
  g.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), furMat);
  head.position.set(0, 0.31, 0.12);
  g.add(head);

  [-0.06, 0.06].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), darkMat);
    eye.position.set(ex, 0.33, 0.19);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 5), furMat);
    ear.position.set(ex * 0.85, 0.41, 0.1);
    g.add(eye, ear);
  });

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.14, -0.09);
  const tailLower = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 5, 8), furMat);
  tailLower.position.set(0, 0.14, -0.06);
  tailLower.rotation.x = -0.35;
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), bellyMat);
  tailTip.position.set(0, 0.28, -0.09);
  tailPivot.add(tailLower, tailTip);
  g.add(tailPivot);

  return { group: g, tailPivot };
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
}

function buildBird(bodyColor: number, wingColor: number): Omit<AnimatedFlier, 'centerX' | 'centerZ' | 'baseY' | 'rx' | 'rz' | 'speed' | 'phase'> {
  const g = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45 });
  const wMat = new THREE.MeshStandardMaterial({ color: wingColor, roughness: 0.5, side: THREE.DoubleSide });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.24, 5, 8), bMat);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), bMat);
  head.position.set(0, 0.05, 0.18);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 5), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.04, 0.27);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), wMat);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(1.4, 1, 0.3);
  tail.position.set(0, 0.02, -0.2);
  g.add(head, beak, tail);

  const wingGeo = new THREE.BoxGeometry(0.36, 0.02, 0.16);
  const leftWing = new THREE.Group();
  const lwMesh = new THREE.Mesh(wingGeo, wMat);
  lwMesh.position.x = -0.18;
  leftWing.add(lwMesh);

  const rightWing = new THREE.Group();
  const rwMesh = new THREE.Mesh(wingGeo, wMat);
  rwMesh.position.x = 0.18;
  rightWing.add(rwMesh);

  g.add(leftWing, rightWing);
  return { group: g, leftWing, rightWing };
}

function buildButterfly(wingHex: number): Omit<AnimatedFlier, 'centerX' | 'centerZ' | 'baseY' | 'rx' | 'rz' | 'speed' | 'phase'> {
  const g = new THREE.Group();
  const thorax = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.018, 0.09, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  thorax.rotation.x = Math.PI / 2;
  g.add(thorax);

  const wingMat = new THREE.MeshStandardMaterial({
    color: wingHex,
    emissive: wingHex,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide,
    roughness: 0.4,
  });

  const leftWing = new THREE.Group();
  const lwTop = new THREE.Mesh(new THREE.CircleGeometry(0.095, 8), wingMat);
  lwTop.rotation.x = -Math.PI / 2;
  lwTop.position.set(-0.08, 0, 0.02);
  const lwBot = new THREE.Mesh(new THREE.CircleGeometry(0.065, 8), wingMat);
  lwBot.rotation.x = -Math.PI / 2;
  lwBot.position.set(-0.065, 0, -0.055);
  leftWing.add(lwTop, lwBot);

  const rightWing = new THREE.Group();
  const rwTop = new THREE.Mesh(new THREE.CircleGeometry(0.095, 8), wingMat);
  rwTop.rotation.x = -Math.PI / 2;
  rwTop.position.set(0.08, 0, 0.02);
  const rwBot = new THREE.Mesh(new THREE.CircleGeometry(0.065, 8), wingMat);
  rwBot.rotation.x = -Math.PI / 2;
  rwBot.position.set(0.065, 0, -0.055);
  rightWing.add(rwTop, rwBot);

  g.add(leftWing, rightWing);
  return { group: g, leftWing, rightWing };
}

// =========================================================================
// MAIN BUILDER: WORLD OF HUTAN HARAPAN (MISI 3)
// =========================================================================
export function buildHutanHarapanWorld(
  avatarId: AvatarId,
  maxAnisotropy: number
): HutanHarapanWorldHandle {
  const group = new THREE.Group();
  const texturesToDispose: THREE.Texture[] = [];
  const rayTargets: THREE.Object3D[] = [];

  // 1. NATURAL DAYLIGHT, WARM SUNBEAMS & SOFT HORIZON FOG
  const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x14532d, 1.15);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff4c2, 1.85);
  sunLight.position.set(22, 32, 16);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -28;
  sunLight.shadow.camera.right = 28;
  sunLight.shadow.camera.top = 28;
  sunLight.shadow.camera.bottom = -28;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 80;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  group.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.45);
  fillLight.position.set(-18, 12, -14);
  group.add(fillLight);

  // 2. SCULPTED TERRAIN VALLEY & FOREST TRAILS
  const groundTex = createForestGroundTexture(maxAnisotropy);
  texturesToDispose.push(groundTex);

  const terrainGeo = new THREE.PlaneGeometry(118, 118, 84, 84);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colArr = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = groundHeightAt(vx, vz);
    posAttr.setY(i, vy);

    // Subtle vertex color shading: sandy riverbed, mossy valley, stony cliff
    const distStream = Math.abs(vx - streamCenterX(vz));
    if (vz < -19.5) {
      _tmpColor.setHex(0x64748b);
    } else if (distStream < 2.6) {
      _tmpColor.setHex(0xc4a47c);
    } else if (vy > 1.4) {
      _tmpColor.setHex(0x2e7d32);
    } else {
      _tmpColor.setHex(0x8be26b);
    }
    colArr[i * 3] = _tmpColor.r;
    colArr[i * 3 + 1] = _tmpColor.g;
    colArr[i * 3 + 2] = _tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  terrainGeo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      map: groundTex,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02,
    })
  );
  terrainMesh.receiveShadow = true;
  terrainMesh.userData = { type: 'ground' };
  group.add(terrainMesh);
  rayTargets.push(terrainMesh);

  // Winding Earth & Stone Forest Trail Ribbons connecting Spawn -> Pos A -> Bridge -> Pos B & Pos C
  const pathTex = createForestPathTexture(maxAnisotropy);
  texturesToDispose.push(pathTex);
  const pathMat = new THREE.MeshStandardMaterial({
    map: pathTex,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const buildTrailRibbon = (pts: [number, number][], width: number) => {
    const curvePts = pts.map(([px, pz]) => new THREE.Vector3(px, groundHeightAt(px, pz) + 0.04, pz));
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const segs = 44;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const nx = -tan.z;
      const nz = tan.x;
      const len = Math.hypot(nx, nz) || 1;
      const ox = (nx / len) * (width * 0.5);
      const oz = (nz / len) * (width * 0.5);

      const ly = groundHeightAt(p.x - ox, p.z - oz) + 0.04;
      const ry = groundHeightAt(p.x + ox, p.z + oz) + 0.04;
      positions.push(p.x - ox, ly, p.z - oz, p.x + ox, ry, p.z + oz);
      uvs.push(t * 6, 0, t * 6, 1);
      if (i < segs) {
        const b = i * 2;
        indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, pathMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // West trail: Trailhead -> Kawasan Hutan Utama (Pos A) -> Bridge
  buildTrailRibbon(
    [
      [-1.0, 11.0],
      [-5.5, 7.5],
      [-10.5, 2.5],
      [-5.5, -2.5],
      [BRIDGE_X - 2.6, BRIDGE_Z],
    ],
    2.1
  );
  // East trail: Bridge -> Kawasan Air Terjun (Pos B) & Kawasan Haiwan (Pos C)
  buildTrailRibbon(
    [
      [BRIDGE_X + 2.6, BRIDGE_Z],
      [6.2, -9.8],
      [3.4, -13.4],
    ],
    1.95
  );
  buildTrailRibbon(
    [
      [BRIDGE_X + 2.6, BRIDGE_Z],
      [9.4, -1.5],
      [11.5, 4.5],
      [7.5, 9.8],
    ],
    1.95
  );

  // Wooden Arch Bridge spanning stream at BRIDGE_Z
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(BRIDGE_X, 0.08, BRIDGE_Z);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const railWoodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });

  for (let p = -10; p <= 10; p++) {
    const px = (p / 10) * 2.9;
    const archY = Math.cos((p / 10) * (Math.PI * 0.45)) * 0.24;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 2.8), woodMat);
    plank.position.set(px, 0.06 + archY, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }
  [-1.32, 1.32].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.1, 0.12), railWoodMat);
    rail.position.set(0, 0.88, rz);
    bridgeGroup.add(rail);
    [-2.5, 0, 2.5].forEach((px) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.92, 8), woodMat);
      post.position.set(px, 0.46, rz);
      bridgeGroup.add(post);
    });
  });
  group.add(bridgeGroup);

  // 3. FLOWING TURQUOISE STREAM + MULTI-STREAM WATERFALL + CLIFF ROCKS
  const waterTex = createWaterFlowTexture(maxAnisotropy);
  const waterfallTex = createWaterfallTexture(maxAnisotropy);
  texturesToDispose.push(waterTex, waterfallTex);

  const riverPositions: number[] = [];
  const riverUvs: number[] = [];
  const riverIndices: number[] = [];
  const riverSegs = 48;
  for (let i = 0; i <= riverSegs; i++) {
    const t = i / riverSegs;
    const z = -19.5 + t * 44.0;
    const cx = streamCenterX(z);
    const halfW = z < -13 ? 3.1 : 2.15;
    riverPositions.push(cx - halfW, -0.34, z, cx + halfW, -0.34, z);
    riverUvs.push(0, t * 6, 1, t * 6);
    if (i < riverSegs) {
      const b = i * 2;
      riverIndices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverPositions, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(riverUvs, 2));
  riverGeo.setIndex(riverIndices);
  riverGeo.computeVertexNormals();

  const riverMat = new THREE.MeshPhysicalMaterial({
    map: waterTex,
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.28,
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.9,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  group.add(riverMesh);

  // Waterfall Cliff Rocks + Cascading Dual Streams + Misty Plunge Pool
  const cliffRockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88, flatShading: true });
  const mossRockMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.85, flatShading: true });

  const cliffSpecs: [number, number, number, number, number, number][] = [
    [-2.4, 3.8, -22.5, 4.2, 8.5, 3.6],
    [6.4, 3.6, -22.2, 4.4, 8.2, 3.8],
    [2.0, 4.6, -23.4, 5.2, 10.2, 3.4],
    [-6.6, 2.4, -21.2, 3.8, 5.5, 3.5],
    [10.2, 2.5, -21.0, 4.0, 5.8, 3.5],
  ];
  cliffSpecs.forEach(([x, y, z, w, h, d], idx) => {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), idx % 2 === 0 ? cliffRockMat : mossRockMat);
    boulder.scale.set(w * 0.65, h * 0.62, d * 0.65);
    boulder.position.set(x, y, z);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    group.add(boulder);
  });

  const waterfallMat = new THREE.MeshBasicMaterial({
    map: waterfallTex,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const wfMain = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 9.2), waterfallMat);
  wfMain.position.set(2.0, 4.1, -20.2);
  wfMain.rotation.x = -0.18;

  const wfSide = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 7.6), waterfallMat);
  wfSide.position.set(4.1, 3.4, -19.9);
  wfSide.rotation.x = -0.22;
  group.add(wfMain, wfSide);

  // Waterfall foam splash rings
  const foamRingMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const foamRing1 = new THREE.Mesh(new THREE.RingGeometry(1.1, 2.2, 28), foamRingMat);
  foamRing1.rotation.x = -Math.PI / 2;
  foamRing1.position.set(2.0, -0.28, -18.8);
  const foamRing2 = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.8, 28), foamRingMat);
  foamRing2.rotation.x = -Math.PI / 2;
  foamRing2.position.set(2.2, -0.27, -18.6);
  group.add(foamRing1, foamRing2);

  // Natural scattered boulders along riverbanks & trails
  const riverRockGeo = new THREE.DodecahedronGeometry(0.55, 1);
  const riverRockCoords: [number, number, number][] = [
    [-0.5, -16.5, 1.3],
    [4.8, -15.8, 1.4],
    [0.2, -11.5, 0.9],
    [7.2, -8.8, 1.1],
    [1.8, 2.4, 0.85],
    [4.4, 6.2, 1.05],
    [-12.8, 5.2, 1.2],
    [14.2, -3.5, 1.3],
    [-7.5, -11.0, 1.15],
  ];
  riverRockCoords.forEach(([rx, rz, sc], idx) => {
    const rk = new THREE.Mesh(riverRockGeo, idx % 3 === 0 ? mossRockMat : cliffRockMat);
    rk.scale.set(sc * 1.2, sc * 0.72, sc);
    rk.position.set(rx, groundHeightAt(rx, rz) + 0.18, rz);
    rk.rotation.y = idx * 0.9;
    rk.castShadow = true;
    rk.receiveShadow = true;
    group.add(rk);
  });

  // 4. LUSH FOREST TREES (HERO WIND-SWAYING TREES + INSTANCED PERIMETER GROVES)
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.92 });
  const leafBrightMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.68 });
  const leafEmeraldMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 });
  const leafLimeMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.64 });

  const swayTrees: { pivot: THREE.Group; phase: number; amp: number }[] = [];
  const treeObstacles: { x: number; z: number; r: number }[] = [];

  const heroTreeSpecs: [number, number, number, 'ancient' | 'canopy' | 'palm'][] = [
    [-13.5, -4.5, 1.48, 'ancient'], // Pokok Agung Harapan!
    [-15.2, 4.8, 1.25, 'ancient'],
    [-8.2, 8.6, 1.05, 'canopy'],
    [-14.5, -12.5, 1.32, 'canopy'],
    [-5.8, -14.0, 1.12, 'palm'],
    [9.8, -14.2, 1.18, 'palm'],
    [15.6, -7.2, 1.35, 'ancient'],
    [16.2, 3.8, 1.22, 'canopy'],
    [13.8, 11.4, 1.14, 'canopy'],
    [-9.8, 14.8, 1.1, 'canopy'],
    [5.8, 14.6, 1.08, 'palm'],
  ];

  heroTreeSpecs.forEach(([tx, tz, sc, variant], idx) => {
    const ty = groundHeightAt(tx, tz);
    const { root, canopyPivot } = buildCompositeForestTree(
      sc,
      variant,
      barkMat,
      idx % 2 === 0 ? leafBrightMat : leafLimeMat,
      leafEmeraldMat
    );
    root.position.set(tx, ty, tz);
    root.rotation.y = idx * 1.15;
    group.add(root);
    swayTrees.push({ pivot: canopyPivot, phase: idx * 0.85, amp: 0.032 });
    treeObstacles.push({ x: tx, z: tz, r: 0.85 * sc });
  });

  // Outer dense natural perimeter forest (InstancedMesh for crisp 60fps!)
  const perimeterCount = 46;
  const perimTrunkGeo = new THREE.CylinderGeometry(0.28, 0.48, 4.4, 7);
  const perimCrownGeo = new THREE.DodecahedronGeometry(2.15, 1);
  const perimTrunks = new THREE.InstancedMesh(perimTrunkGeo, barkMat, perimeterCount);
  const perimCrowns = new THREE.InstancedMesh(perimCrownGeo, leafEmeraldMat, perimeterCount);
  perimTrunks.castShadow = true;
  perimCrowns.castShadow = true;

  for (let i = 0; i < perimeterCount; i++) {
    const ang = (i / perimeterCount) * Math.PI * 2;
    const rad = 22.5 + (i % 4) * 3.8;
    const px = Math.cos(ang) * rad;
    const pz = Math.sin(ang) * rad;
    const py = groundHeightAt(px, pz);
    const sc = 0.9 + (i % 5) * 0.16;

    _dummy.position.set(px, py + 2.1 * sc, pz);
    _dummy.rotation.set(0, ang, 0);
    _dummy.scale.set(sc, sc, sc);
    _dummy.updateMatrix();
    perimTrunks.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(px, py + 4.8 * sc, pz);
    _dummy.scale.set(sc * 1.15, sc * 0.95, sc * 1.15);
    _dummy.updateMatrix();
    perimCrowns.setMatrixAt(i, _dummy.matrix);

    _tmpColor.setHex(i % 3 === 0 ? 0x16a34a : i % 2 === 0 ? 0x22c55e : 0x15803d);
    perimCrowns.setColorAt(i, _tmpColor);
  }
  perimTrunks.computeBoundingSphere();
  perimCrowns.computeBoundingSphere();
  group.add(perimTrunks, perimCrowns);

  // 5. INSTANCED LUSH GRASS TUFTS, FERNS & WILDFLOWERS
  const grassCount = 240;
  const grassGeo = new THREE.ConeGeometry(0.11, 0.48, 4);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.78 });
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  let gPlaced = 0;
  for (let i = 0; i < 420 && gPlaced < grassCount; i++) {
    const gx = Math.sin(i * 7.13) * 19.5;
    const gz = Math.cos(i * 4.91) * 18.5;
    if (Math.abs(gx - streamCenterX(gz)) < 2.9) continue;
    const gy = groundHeightAt(gx, gz);
    const sc = 0.75 + (i % 4) * 0.22;
    _dummy.position.set(gx, gy + 0.18 * sc, gz);
    _dummy.rotation.set((i % 3) * 0.12 - 0.12, i * 1.1, 0);
    _dummy.scale.set(sc, sc, sc);
    _dummy.updateMatrix();
    grassInst.setMatrixAt(gPlaced, _dummy.matrix);
    _tmpColor.setHex(i % 3 === 0 ? 0x84cc16 : i % 2 === 0 ? 0x22c55e : 0x4ade80);
    grassInst.setColorAt(gPlaced, _tmpColor);
    gPlaced++;
  }
  grassInst.count = gPlaced;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  // Colorful Wildflower Clusters (especially around Taman Haiwan & Hutan Utama)
  const flowerCount = 80;
  const flowerGeo = new THREE.CylinderGeometry(0.15, 0.04, 0.14, 6);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  const flowerPalette = [0xfef08a, 0xfb7185, 0xc084fc, 0x38bdf8, 0xf97316, 0xffffff];
  for (let i = 0; i < flowerCount; i++) {
    const clusterEast = i < 50;
    const cx = clusterEast ? 9.5 + Math.sin(i * 3.1) * 5.2 : -9.0 + Math.cos(i * 2.7) * 5.2;
    const cz = clusterEast ? 4.5 + Math.cos(i * 4.3) * 5.5 : 3.5 + Math.sin(i * 3.9) * 5.0;
    const cy = groundHeightAt(cx, cz);
    _dummy.position.set(cx, cy + 0.24, cz);
    _dummy.rotation.set(0, i * 0.7, 0);
    _dummy.scale.setScalar(0.85 + (i % 3) * 0.2);
    _dummy.updateMatrix();
    flowerInst.setMatrixAt(i, _dummy.matrix);
    _tmpColor.setHex(flowerPalette[i % flowerPalette.length]);
    flowerInst.setColorAt(i, _tmpColor);
  }
  flowerInst.computeBoundingSphere();
  group.add(flowerInst);

  // 6. ANIMATED 3D WILDLIFE (DEER, RABBITS, SQUIRRELS, BIRDS, BUTTERFLIES)
  const deerList: AnimatedDeer[] = [];
  [
    { x: 9.2, z: 6.2, r: 2.3, spd: 0.34, antler: true, ph: 0 },
    { x: 11.4, z: 7.8, r: 1.8, spd: 0.28, antler: false, ph: 2.1 },
    { x: -7.5, z: -7.2, r: 1.9, spd: 0.31, antler: false, ph: 4.0 },
  ].forEach((spec) => {
    const d = buildDeer(spec.antler);
    d.group.position.set(spec.x, groundHeightAt(spec.x, spec.z), spec.z);
    group.add(d.group);
    deerList.push({
      ...d,
      homeX: spec.x,
      homeZ: spec.z,
      radius: spec.r,
      speed: spec.spd,
      phase: spec.ph,
    });
  });

  const rabbitList: AnimatedRabbit[] = [];
  [
    { x: 8.6, z: 2.4, r: 1.3, color: 0xf8fafc, ph: 0.2 },
    { x: 12.8, z: 5.8, r: 1.2, color: 0xd6b48a, ph: 1.7 },
    { x: -8.2, z: 4.8, r: 1.4, color: 0xf1f5f9, ph: 3.2 },
    { x: 6.8, z: 9.4, r: 1.2, color: 0xe7d3b5, ph: 4.6 },
  ].forEach((spec) => {
    const rb = buildRabbit(spec.color);
    rb.group.position.set(spec.x, groundHeightAt(spec.x, spec.z), spec.z);
    group.add(rb.group);
    rabbitList.push({
      ...rb,
      homeX: spec.x,
      homeZ: spec.z,
      radius: spec.r,
      phase: spec.ph,
    });
  });

  const squirrelList: AnimatedSquirrel[] = [];
  [
    { x: -12.2, z: -3.2, ph: 0 },
    { x: -13.8, z: 4.1, ph: 2.2 },
    { x: 14.5, z: 3.1, ph: 4.1 },
  ].forEach((spec) => {
    const sq = buildSquirrel();
    sq.group.position.set(spec.x, groundHeightAt(spec.x, spec.z), spec.z);
    group.add(sq.group);
    squirrelList.push({ ...sq, homeX: spec.x, homeZ: spec.z, phase: spec.ph });
  });

  const birds: AnimatedFlier[] = [];
  [
    { cx: -6, cz: -4, y: 7.4, rx: 8.5, rz: 6.5, spd: 0.42, c1: 0x0284c7, c2: 0x38bdf8, ph: 0 },
    { cx: 5, cz: -8, y: 8.2, rx: 7.5, rz: 7.0, spd: 0.48, c1: 0xf97316, c2: 0xfacc15, ph: 1.6 },
    { cx: 2, cz: 3, y: 6.8, rx: 10.5, rz: 7.5, spd: 0.36, c1: 0x16a34a, c2: 0x86efac, ph: 3.1 },
    { cx: -10, cz: 4, y: 7.9, rx: 5.5, rz: 6.0, spd: 0.52, c1: 0xec4899, c2: 0xf9a8d4, ph: 4.4 },
    { cx: 9, cz: 6, y: 7.2, rx: 6.2, rz: 5.0, spd: 0.45, c1: 0x3b82f6, c2: 0x93c5fd, ph: 5.5 },
  ].forEach((spec) => {
    const bd = buildBird(spec.c1, spec.c2);
    group.add(bd.group);
    birds.push({
      ...bd,
      centerX: spec.cx,
      centerZ: spec.cz,
      baseY: spec.y,
      rx: spec.rx,
      rz: spec.rz,
      speed: spec.spd,
      phase: spec.ph,
    });
  });

  const butterflies: AnimatedFlier[] = [];
  const bfColors = [0xf97316, 0x38bdf8, 0xfacc15, 0xf472b6, 0xa855f7, 0x34d399];
  for (let i = 0; i < 10; i++) {
    const east = i < 6;
    const bf = buildButterfly(bfColors[i % bfColors.length]);
    group.add(bf.group);
    butterflies.push({
      ...bf,
      centerX: (east ? 9.5 : -9.2) + Math.sin(i * 2.1) * 3.5,
      centerZ: (east ? 4.5 : 3.0) + Math.cos(i * 1.9) * 3.8,
      baseY: 1.15 + (i % 3) * 0.4,
      rx: 1.1 + (i % 3) * 0.45,
      rz: 1.0 + (i % 2) * 0.5,
      speed: 1.2 + (i % 4) * 0.25,
      phase: i * 0.95,
    });
  }

  // 7. SUNBEAM SHAFTS, THIN FOREST MIST & FALLING LEAVES
  const sunBeamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.09,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sunBeams: THREE.Mesh[] = [];
  [
    [-9.5, 6.2, 1.5, -0.32],
    [-2.5, 6.8, -5.5, -0.28],
    [7.5, 6.4, 3.8, -0.3],
    [1.8, 7.2, -13.5, -0.25],
  ].forEach(([bx, by, bz, rz]) => {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 14.5, 14, 1, true), sunBeamMat);
    beam.position.set(bx, by, bz);
    beam.rotation.z = rz;
    beam.rotation.x = 0.16;
    group.add(beam);
    sunBeams.push(beam);
  });

  // Thin Mist Planes around Waterfall & Deep Woods
  const mistMat = new THREE.MeshBasicMaterial({
    color: 0xd1fae5,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const mistPlanes: { mesh: THREE.Mesh; baseX: number; phase: number }[] = [];
  [
    [2.0, 0.85, -17.5, 7.5, 2.2],
    [-11.5, 1.1, -6.5, 8.2, 2.5],
    [11.0, 1.0, -9.5, 7.8, 2.4],
  ].forEach(([mx, my, mz, mw, mh], idx) => {
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), mistMat);
    mist.position.set(mx, my, mz);
    group.add(mist);
    mistPlanes.push({ mesh: mist, baseX: mx, phase: idx * 1.4 });
  });

  // Falling Fluttering Leaves
  const leafCount = 46;
  const leafGeo = new THREE.PlaneGeometry(0.18, 0.1);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    side: THREE.DoubleSide,
    roughness: 0.6,
  });
  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  const leafSeeds = Array.from({ length: leafCount }, (_, i) => ({
    x: Math.sin(i * 4.3) * 16.5,
    y: 1.5 + ((i * 0.73) % 8.5),
    z: Math.cos(i * 3.7) * 15.5,
    spd: 0.42 + (i % 5) * 0.12,
    sway: 0.8 + (i % 4) * 0.35,
  }));
  for (let i = 0; i < leafCount; i++) {
    _tmpColor.setHex(i % 4 === 0 ? 0xfacc15 : i % 2 === 0 ? 0x4ade80 : 0x22c55e);
    leafInst.setColorAt(i, _tmpColor);
  }
  leafInst.frustumCulled = false;
  group.add(leafInst);

  // 8. INTERACTIVE PROPOSAL STATIONS (A, B, C) & NATURE DISCOVERY SPOTS (NO EMOJIS!)
  const stationVisuals: Record<
    ProposalKey,
    { ringMat: THREE.MeshStandardMaterial; crystal: THREE.Mesh; crystalMat: THREE.MeshStandardMaterial }
  > = {} as never;

  const buildProposalStation = (
    propId: ProposalKey,
    x: number,
    z: number,
    accentHex: number
  ) => {
    const gy = groundHeightAt(x, z);
    const st = new THREE.Group();
    st.position.set(x, gy, z);
    group.add(st);

    // Stone & moss pedestal
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.32, 0.22, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
    );
    base.position.y = 0.11;
    base.receiveShadow = true;
    st.add(base);

    const ringMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.95,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.055, 10, 36), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.24;
    st.add(ring);

    // Distinct 3D composite centerpiece per Proposal (zero emojis)
    if (propId === 'A') {
      // Sapling & blue eco watering pod
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.32, 0.36, 12),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
      );
      pot.position.set(-0.22, 0.36, 0);
      const sapTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 0.95, 7),
        barkMat
      );
      sapTrunk.position.set(-0.22, 0.85, 0);
      const sapLeaf1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), leafBrightMat);
      sapLeaf1.position.set(-0.22, 1.38, 0);
      const canBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
      );
      canBody.position.set(0.38, 0.36, 0.22);
      st.add(pot, sapTrunk, sapLeaf1, canBody);
    } else if (propId === 'B') {
      // Recycling station & clean collection crate
      const bin = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.78, 0.48),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38 })
      );
      bin.position.set(-0.22, 0.6, 0);
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.1, 0.54),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 })
      );
      lid.position.set(-0.22, 1.03, 0);
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.38, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 })
      );
      crate.position.set(0.36, 0.4, 0.18);
      st.add(bin, lid, crate);
    } else {
      // Wooden awareness board with illustrated forest texture
      const signTex = createSignboardTexture(maxAnisotropy);
      texturesToDispose.push(signTex);
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.45, 8), woodMat);
      postL.position.set(-0.48, 0.85, 0);
      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.45, 8), woodMat);
      postR.position.set(0.48, 0.85, 0);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.78, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 })
      );
      board.position.set(0, 1.25, 0);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.06, 0.66),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      face.position.set(0, 1.25, 0.045);
      const faceBack = new THREE.Mesh(
        new THREE.PlaneGeometry(1.06, 0.66),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      faceBack.position.set(0, 1.25, -0.045);
      faceBack.rotation.y = Math.PI;
      st.add(postL, postR, board, face, faceBack);
    }

    // Floating holographic diamond crystal above station
    const crystalMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.35,
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), crystalMat);
    crystal.position.y = 2.45;
    st.add(crystal);

    // Invisible larger raycast hit proxy on layer 1 for effortless click inspection
    const hitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 3.2, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitProxy.position.y = 1.6;
    hitProxy.layers.set(1);
    hitProxy.userData = { type: 'spot', spotId: `prop_${propId}` };
    st.add(hitProxy);
    rayTargets.push(hitProxy);

    stationVisuals[propId] = { ringMat, crystal, crystalMat };
  };

  buildProposalStation('A', -10.5, 2.5, 0x34d399);
  buildProposalStation('B', 3.4, -13.4, 0x22d3ee);
  buildProposalStation('C', 11.5, 4.5, 0xc084fc);

  // Nature Inspection Spot beacons (subtle glowing ground rings & floating leaf/water/wildlife markers)
  const natureSpots: { spotId: string; x: number; z: number; hex: number }[] = [
    { spotId: 'nature_tree', x: -12.6, z: -3.8, hex: 0x84cc16 },
    { spotId: 'nature_waterfall', x: 1.5, z: -15.6, hex: 0x38bdf8 },
    { spotId: 'nature_wildlife', x: 9.2, z: 7.4, hex: 0xfacc15 },
  ];
  const natureMarkers: THREE.Mesh[] = [];
  natureSpots.forEach(({ spotId, x, z, hex }) => {
    const gy = groundHeightAt(x, z);
    const ng = new THREE.Group();
    ng.position.set(x, gy, z);
    const rMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.04, 8, 28),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.8 })
    );
    rMesh.rotation.x = Math.PI / 2;
    rMesh.position.y = 0.06;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.75 })
    );
    gem.position.y = 1.45;
    ng.add(rMesh, gem);
    natureMarkers.push(gem);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 2.4, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1.2;
    hit.layers.set(1);
    hit.userData = { type: 'spot', spotId };
    ng.add(hit);
    rayTargets.push(hit);
    group.add(ng);
  });

  const interactiveSpots: InteractiveSpot[] = [
    {
      id: 'prop_A',
      kind: 'proposal',
      proposalId: 'A',
      title: 'CADANGAN A: PROGRAM PENANAMAN POKOK',
      subtitle: 'Kawasan Hutan Utama',
      actionLabel: 'Periksa Cadangan A',
      position: new THREE.Vector3(-10.5, groundHeightAt(-10.5, 2.5), 2.5),
      triggerRadius: 2.9,
    },
    {
      id: 'prop_B',
      kind: 'proposal',
      proposalId: 'B',
      title: 'CADANGAN B: GOTONG-ROYONG MEMBERSIHKAN HUTAN',
      subtitle: 'Kawasan Sungai & Air Terjun',
      actionLabel: 'Periksa Cadangan B',
      position: new THREE.Vector3(3.4, groundHeightAt(3.4, -13.4), -13.4),
      triggerRadius: 2.9,
    },
    {
      id: 'prop_C',
      kind: 'proposal',
      proposalId: 'C',
      title: 'CADANGAN C: KEMPEN KESEDARAN MENJAGA HUTAN',
      subtitle: 'Taman Haiwan & Pondok Pendidikan',
      actionLabel: 'Periksa Cadangan C',
      position: new THREE.Vector3(11.5, groundHeightAt(11.5, 4.5), 4.5),
      triggerRadius: 2.9,
    },
    {
      id: 'nature_tree',
      kind: 'nature',
      title: 'Pokok Agung Hutan Harapan',
      subtitle: 'Dedaun subur bergoyang ditiup angin nyaman',
      actionLabel: 'Periksa Pokok Agung',
      position: new THREE.Vector3(-12.6, groundHeightAt(-12.6, -3.8), -3.8),
      triggerRadius: 2.8,
    },
    {
      id: 'nature_waterfall',
      kind: 'nature',
      title: 'Air Terjun Kristal Hutan Harapan',
      subtitle: 'Air sungai jernih mengalir dari tebing batu',
      actionLabel: 'Tinjau Air Terjun',
      position: new THREE.Vector3(1.5, groundHeightAt(1.5, -15.6), -15.6),
      triggerRadius: 3.1,
    },
    {
      id: 'nature_wildlife',
      kind: 'nature',
      title: 'Habitat Haiwan Hutan Harapan',
      subtitle: 'Rusa, arnab, tupai & rama-rama hidup harmoni',
      actionLabel: 'Perhati Haiwan',
      position: new THREE.Vector3(9.2, groundHeightAt(9.2, 7.4), 7.4),
      triggerRadius: 3.1,
    },
  ];

  // 9. PLAYABLE 3D AGENT CONTROLLER + THIRD-PERSON FOLLOW CAMERA
  const shadowTex = createContactShadowTexture();
  texturesToDispose.push(shadowTex);
  const agentRig: HumanAgentRig = buildHumanEcoAgent(avatarId, shadowTex, {
    maxAnisotropy,
    showPedestal: false,
  });
  agentRig.group.position.set(-1.0, groundHeightAt(-1.0, 11.0), 11.0);
  agentRig.group.rotation.y = Math.PI;
  group.add(agentRig.group);

  let inputX = 0;
  let inputZ = 0;
  let runningInput = false;
  let autoTarget: THREE.Vector3 | null = null;
  let strideClock = 0;
  let inspectBurstTimer = 0;

  let camYaw = 0.0;
  let camPitch = 0.38;
  let camDist = 8.8;
  let camPreset: 'follow' | 'wide' = 'follow';
  let victoryState = false;
  let exploredSet = new Set<ProposalKey>();

  const resolveForestCollisions = (nx: number, nz: number): [number, number] => {
    // Keep within natural green valley rim
    let rx = Math.max(-20.5, Math.min(20.5, nx));
    let rz = Math.max(-17.8, Math.min(18.5, nz));

    // Keep clear of deep stream channel unless crossing the wooden bridge!
    if (!isOnBridge(rx, rz)) {
      const sx = streamCenterX(rz);
      const bankLimit = rz < -13 ? 2.55 : 1.75;
      const dx = rx - sx;
      if (Math.abs(dx) < bankLimit) {
        rx = sx + (dx >= 0 ? bankLimit : -bankLimit);
      }
    }

    // Slide cleanly around giant hero tree trunks
    for (let i = 0; i < treeObstacles.length; i++) {
      const ob = treeObstacles[i];
      const dx = rx - ob.x;
      const dz = rz - ob.z;
      const d = Math.hypot(dx, dz);
      if (d < ob.r && d > 0.0001) {
        rx = ob.x + (dx / d) * ob.r;
        rz = ob.z + (dz / d) * ob.r;
      }
    }

    return [rx, rz];
  };

  const detectLocationName = (x: number, z: number): string => {
    if (z < -11.5 && x > -2.5 && x < 9.5) return 'Kawasan Air Terjun Kristal';
    if (isOnBridge(x, z) || Math.abs(x - streamCenterX(z)) < 4.5) return 'Laluan Sungai & Jambatan Kayu';
    if (x < -4.2) return 'Kawasan Hutan Utama';
    if (x > 6.0 && z > -4.0) return 'Taman Haiwan & Bunga Liar';
    return 'Dataran Hutan Harapan';
  };

  return {
    group,
    groundHeightAt,
    getInteractiveSpots: () => interactiveSpots,
    getRayTargets: () => rayTargets,
    setInputVector: (x, z, running) => {
      inputX = x;
      inputZ = z;
      runningInput = running;
      if (Math.abs(x) > 0.05 || Math.abs(z) > 0.05) {
        autoTarget = null;
      }
    },
    setWalkTarget: (x, z) => {
      const [rx, rz] = resolveForestCollisions(x, z);
      autoTarget = new THREE.Vector3(rx, groundHeightAt(rx, rz), rz);
    },
    walkToSpot: (spotId) => {
      const sp = interactiveSpots.find((s) => s.id === spotId);
      if (!sp) return;
      // Stop slightly in front of station center
      const dx = agentRig.group.position.x - sp.position.x;
      const dz = agentRig.group.position.z - sp.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const tx = sp.position.x + (dx / d) * 1.45;
      const tz = sp.position.z + (dz / d) * 1.45;
      const [rx, rz] = resolveForestCollisions(tx, tz);
      autoTarget = new THREE.Vector3(rx, groundHeightAt(rx, rz), rz);
    },
    triggerInspectEffect: () => {
      inspectBurstTimer = 1.6;
    },
    setExploredProposals: (ids) => {
      exploredSet = new Set(ids);
      (['A', 'B', 'C'] as ProposalKey[]).forEach((k) => {
        const vis = stationVisuals[k];
        if (!vis) return;
        const done = exploredSet.has(k);
        const col = done ? 0xfacc15 : k === 'A' ? 0x34d399 : k === 'B' ? 0x22d3ee : 0xc084fc;
        vis.ringMat.color.setHex(col);
        vis.ringMat.emissive.setHex(col);
        vis.crystalMat.color.setHex(col);
        vis.crystalMat.emissive.setHex(col);
      });
    },
    setVictoryState: (v) => {
      victoryState = v;
    },
    setCameraPreset: (preset) => {
      camPreset = preset;
      if (preset === 'follow') {
        camDist = 8.8;
        camPitch = 0.36;
      }
    },
    orbitCameraBy: (dYaw, dPitch) => {
      camYaw += dYaw;
      camPitch = Math.max(0.14, Math.min(1.05, camPitch + dPitch));
    },
    zoomCameraBy: (delta) => {
      camDist = Math.max(4.8, Math.min(16.0, camDist + delta));
    },
    update: (dt, elapsed, camera, stage) => {
      const isExplore = stage === 'explore';
      if (inspectBurstTimer > 0) inspectBurstTimer = Math.max(0, inspectBurstTimer - dt);

      // 1. Agent Locomotion (Camera-relative WASD/Arrows/D-Pad + Shift/Run + Click-to-Walk)
      let isMoving = false;
      let isRunningNow = false;

      if (isExplore && (Math.abs(inputX) > 0.05 || Math.abs(inputZ) > 0.05)) {
        camera.getWorldDirection(_camForward);
        _camForward.y = 0;
        if (_camForward.lengthSq() < 0.0001) _camForward.set(0, 0, -1);
        _camForward.normalize();
        _camRight.crossVectors(_camForward, THREE.Object3D.DEFAULT_UP).normalize();

        _moveVec
          .set(0, 0, 0)
          .addScaledVector(_camForward, -inputZ)
          .addScaledVector(_camRight, inputX);

        if (_moveVec.lengthSq() > 0.001) {
          _moveVec.normalize();
          isRunningNow = runningInput;
          const speed = runningInput ? 10.4 : 5.8;
          const nextX = agentRig.group.position.x + _moveVec.x * speed * dt;
          const nextZ = agentRig.group.position.z + _moveVec.z * speed * dt;
          const [rx, rz] = resolveForestCollisions(nextX, nextZ);
          agentRig.group.position.x = rx;
          agentRig.group.position.z = rz;
          const targetRot = Math.atan2(_moveVec.x, _moveVec.z);
          agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, targetRot, 11, dt);
          isMoving = true;
        }
      } else if (isExplore && autoTarget) {
        const dx = autoTarget.x - agentRig.group.position.x;
        const dz = autoTarget.z - agentRig.group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.35) {
          const dirX = dx / dist;
          const dirZ = dz / dist;
          isRunningNow = dist > 5.0 || runningInput;
          const speed = isRunningNow ? 10.0 : 6.2;
          const step = Math.min(dist, speed * dt);
          const [rx, rz] = resolveForestCollisions(
            agentRig.group.position.x + dirX * step,
            agentRig.group.position.z + dirZ * step
          );
          agentRig.group.position.x = rx;
          agentRig.group.position.z = rz;
          const targetRot = Math.atan2(dirX, dirZ);
          agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, targetRot, 11, dt);
          isMoving = true;
        } else {
          autoTarget = null;
        }
      }

      // Snap smoothly to ground/bridge height
      const targetGroundY = groundHeightAt(agentRig.group.position.x, agentRig.group.position.z);
      agentRig.group.position.y = THREE.MathUtils.damp(agentRig.group.position.y, targetGroundY, 14, dt);

      strideClock += dt * (isRunningNow ? 1.55 : 1.0);
      animateHumanAgent(agentRig, isMoving ? strideClock : elapsed, dt, {
        isMoving,
        hovered: victoryState || stage === 'emergency_call',
        selected: true,
      });

      // 2. Smooth Third-Person Camera Choreography
      if (stage === 'emergency_call') {
        const orbitAng = elapsed * 0.16;
        _desiredCamPos.set(Math.sin(orbitAng) * 14.5, 6.2, 11.5 + Math.cos(orbitAng) * 4.5);
        _desiredLookAt.set(0, 1.8, -2.5);
      } else if (stage === 'victory') {
        const orbitAng = elapsed * 0.24;
        _desiredCamPos.set(Math.sin(orbitAng) * 11.5, 5.2, 7.5 + Math.cos(orbitAng) * 3.5);
        _desiredLookAt.set(
          agentRig.group.position.x * 0.4,
          1.9,
          agentRig.group.position.z * 0.4 - 4.0
        );
      } else if (camPreset === 'wide') {
        _desiredCamPos.set(Math.sin(camYaw) * 19.5, 11.5, Math.cos(camYaw) * 19.5);
        _desiredLookAt.set(0, 1.4, -2.5);
      } else {
        const horiz = Math.cos(camPitch) * camDist;
        const vert = Math.sin(camPitch) * camDist + 1.4;
        _desiredCamPos.set(
          agentRig.group.position.x + Math.sin(camYaw) * horiz,
          agentRig.group.position.y + vert,
          agentRig.group.position.z + Math.cos(camYaw) * horiz
        );
        _desiredLookAt.set(
          agentRig.group.position.x,
          agentRig.group.position.y + 1.55,
          agentRig.group.position.z
        );
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 6.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 6.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 6.5, dt);
      _lookTarget.x = THREE.MathUtils.damp(_lookTarget.x, _desiredLookAt.x, 7.5, dt);
      _lookTarget.y = THREE.MathUtils.damp(_lookTarget.y, _desiredLookAt.y, 7.5, dt);
      _lookTarget.z = THREE.MathUtils.damp(_lookTarget.z, _desiredLookAt.z, 7.5, dt);
      camera.lookAt(_lookTarget);

      // 3. Living Forest Environment Animations (Water, Waterfall, Trees, Mist, Leaves)
      waterTex.offset.y -= dt * (victoryState ? 0.85 : 0.55);
      waterfallTex.offset.y += dt * 1.45;
      foamRing1.scale.setScalar(1 + Math.sin(elapsed * 4.2) * 0.12);
      foamRing2.scale.setScalar(1 + Math.cos(elapsed * 3.6) * 0.15);

      const windBoost = inspectBurstTimer > 0 ? 2.4 : 1.0;
      swayTrees.forEach((tr) => {
        tr.pivot.rotation.z = Math.sin(elapsed * 1.35 * windBoost + tr.phase) * tr.amp * windBoost;
        tr.pivot.rotation.x = Math.cos(elapsed * 1.1 * windBoost + tr.phase) * tr.amp * 0.7;
      });

      mistPlanes.forEach((mp) => {
        mp.mesh.position.x = mp.baseX + Math.sin(elapsed * 0.45 + mp.phase) * 0.9;
      });

      sunBeamMat.opacity = (victoryState ? 0.14 : 0.085) + Math.sin(elapsed * 1.1) * 0.02;

      for (let i = 0; i < leafCount; i++) {
        const ls = leafSeeds[i];
        ls.y -= dt * ls.spd * (inspectBurstTimer > 0 ? 1.8 : 1.0);
        if (ls.y < 0.15) ls.y = 9.5 + (i % 4);
        const lx = ls.x + Math.sin(elapsed * ls.sway + i) * 0.65;
        const lz = ls.z + Math.cos(elapsed * ls.sway * 0.8 + i) * 0.65;
        _dummy.position.set(lx, ls.y, lz);
        _dummy.rotation.set(elapsed * 1.6 + i, elapsed * 1.2 + i, Math.sin(elapsed + i) * 0.5);
        _dummy.scale.setScalar(1.0);
        _dummy.updateMatrix();
        leafInst.setMatrixAt(i, _dummy.matrix);
      }
      leafInst.instanceMatrix.needsUpdate = true;

      // 4. Wildlife Animations (Deer grazing/walking, Rabbits hopping, Squirrels, Birds, Butterflies)
      deerList.forEach((d) => {
        const a = elapsed * d.speed + d.phase;
        const nx = d.homeX + Math.cos(a) * d.radius;
        const nz = d.homeZ + Math.sin(a) * d.radius;
        const ny = groundHeightAt(nx, nz);
        d.group.position.set(nx, ny, nz);
        d.group.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));

        const graze = Math.sin(elapsed * 0.65 + d.phase) > 0.35;
        d.headPivot.rotation.x = THREE.MathUtils.damp(d.headPivot.rotation.x, graze ? 0.65 : 0.05, 5, dt);
        const legSwing = graze ? 0 : Math.sin(elapsed * 4.8 + d.phase) * 0.32;
        d.legs[0].rotation.x = legSwing;
        d.legs[1].rotation.x = -legSwing;
        d.legs[2].rotation.x = -legSwing;
        d.legs[3].rotation.x = legSwing;
      });

      rabbitList.forEach((rb) => {
        const a = elapsed * 0.85 + rb.phase;
        const hopCycle = Math.abs(Math.sin(elapsed * 4.5 + rb.phase));
        const rx = rb.homeX + Math.cos(a) * rb.radius;
        const rz = rb.homeZ + Math.sin(a) * rb.radius;
        rb.group.position.set(rx, groundHeightAt(rx, rz) + hopCycle * 0.24, rz);
        rb.group.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
        rb.bodyPivot.rotation.x = -hopCycle * 0.28;
      });

      squirrelList.forEach((sq) => {
        const dash = Math.sin(elapsed * 1.4 + sq.phase);
        const sx = sq.homeX + dash * 0.9;
        const sz = sq.homeZ + Math.cos(elapsed * 1.1 + sq.phase) * 0.6;
        sq.group.position.set(sx, groundHeightAt(sx, sz) + Math.abs(Math.sin(elapsed * 7 + sq.phase)) * 0.07, sz);
        sq.group.rotation.y = Math.atan2(Math.cos(elapsed * 1.4 + sq.phase), -Math.sin(elapsed * 1.1 + sq.phase));
        sq.tailPivot.rotation.x = Math.sin(elapsed * 6.5 + sq.phase) * 0.22;
      });

      birds.forEach((bd) => {
        const a = elapsed * bd.speed + bd.phase;
        const bx = bd.centerX + Math.cos(a) * bd.rx;
        const bz = bd.centerZ + Math.sin(a) * bd.rz;
        const by = bd.baseY + Math.sin(elapsed * 1.8 + bd.phase) * 0.7;
        bd.group.position.set(bx, by, bz);
        bd.group.rotation.y = Math.atan2(-Math.sin(a) * bd.rx, Math.cos(a) * bd.rz);
        const flap = Math.sin(elapsed * 11.5 + bd.phase) * 0.65;
        bd.leftWing.rotation.z = flap;
        bd.rightWing.rotation.z = -flap;
      });

      butterflies.forEach((bf) => {
        const a = elapsed * bf.speed + bf.phase;
        const bx = bf.centerX + Math.sin(a) * bf.rx;
        const bz = bf.centerZ + Math.sin(a * 2.0) * bf.rz * 0.6;
        const by = groundHeightAt(bx, bz) + bf.baseY + Math.sin(elapsed * 4.2 + bf.phase) * 0.25;
        bf.group.position.set(bx, by, bz);
        bf.group.rotation.y = a + Math.PI * 0.5;
        const flutter = Math.sin(elapsed * 18.0 + bf.phase) * 0.85;
        bf.leftWing.rotation.z = flutter;
        bf.rightWing.rotation.z = -flutter;
      });

      // 5. Station Crystals & Nature Gems Spin + Proximity Detection
      (['A', 'B', 'C'] as ProposalKey[]).forEach((k, idx) => {
        const vis = stationVisuals[k];
        if (!vis) return;
        vis.crystal.rotation.y = elapsed * 1.8 + idx;
        vis.crystal.position.y = 2.45 + Math.sin(elapsed * 2.6 + idx) * 0.16;
      });
      natureMarkers.forEach((gem, idx) => {
        gem.rotation.y = elapsed * 2.1 + idx;
        gem.position.y = 1.45 + Math.sin(elapsed * 2.8 + idx) * 0.14;
      });

      let nearbySpot: InteractiveSpot | null = null;
      let bestDist = Infinity;
      const ax = agentRig.group.position.x;
      const az = agentRig.group.position.z;
      for (let i = 0; i < interactiveSpots.length; i++) {
        const sp = interactiveSpots[i];
        const d = Math.hypot(ax - sp.position.x, az - sp.position.z);
        if (d <= sp.triggerRadius && d < bestDist) {
          bestDist = d;
          nearbySpot = sp;
        }
      }

      return {
        locationName: detectLocationName(ax, az),
        nearbySpot,
        isMoving,
        isRunning: isMoving && isRunningNow,
      };
    },
    dispose: () => {
      texturesToDispose.forEach((t) => t.dispose());
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.InstancedMesh) {
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
