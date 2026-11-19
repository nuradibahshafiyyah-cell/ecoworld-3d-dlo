import * as THREE from 'three';
import { AvatarId } from '../types/game';
import { buildHumanEcoAgent, HumanAgentRig } from './humanAgents';
import { createContactShadowTexture } from './textures';

export interface AircraftHandle {
  group: THREE.Group;
  propeller: THREE.Group;
  leftFlap: THREE.Mesh;
  rightFlap: THREE.Mesh;
  companionRig: HumanAgentRig;
  setAgent: (avatarId: AvatarId) => void;
}

export interface CockpitRigHandle {
  group: THREE.Group;
  yoke: THREE.Group;
  throttle: THREE.Mesh;
  leftScreenMat: THREE.MeshBasicMaterial;
  centerScreenMat: THREE.MeshBasicMaterial;
  rightScreenMat: THREE.MeshBasicMaterial;
  hudGlassMat: THREE.MeshBasicMaterial;
  updateHudCanvas: (opts: {
    speed: number;
    altitude: number;
    headingDeg: number;
    distToTarget: number;
    stabilized: boolean;
    stageLabel: string;
    evidenceCount: number;
  }) => void;
}

export interface HangarSceneHandle {
  group: THREE.Group;
  aircraft: AircraftHandle;
  guideAgentRig: HumanAgentRig;
  setAgent: (avatarId: AvatarId) => void;
  animate: (elapsed: number, dt: number) => void;
  dispose: () => void;
}

export interface FlightEvidenceMarker {
  id: 'paip' | 'ikan' | 'bau';
  title: string;
  group: THREE.Group;
  beaconMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  hitProxy: THREE.Mesh;
  worldPos: THREE.Vector3;
}

export interface FlightCheckpointRing {
  id: string;
  position: THREE.Vector3;
  group: THREE.Group;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  beam: THREE.Mesh;
}

export interface FlightWorldHandle {
  group: THREE.Group;
  clouds: THREE.Group[];
  riverCleanTex: THREE.CanvasTexture;
  riverPollutedTex: THREE.CanvasTexture;
  smogPuffs: THREE.Mesh[];
  radarDish: THREE.Group;
  evidenceMarkers: FlightEvidenceMarker[];
  checkpoints: FlightCheckpointRing[];
  runwayBeaconGroup: THREE.Group;
  celebrationGroup: THREE.Group;
  celebrationParticles: { mesh: THREE.Mesh; vel: THREE.Vector3 }[];
  triggerCelebration: () => void;
  animate: (elapsed: number, dt: number, foundClues: string[], activeCheckpointId: string | null) => void;
  dispose: () => void;
}

function makeCanvasTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  maxAnisotropy = 4,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  return tex;
}

const AGENT_COLORS: Record<AvatarId, { main: number; accent: number; hex: string }> = {
  tirta: { main: 0x0ea5e9, accent: 0x38bdf8, hex: '#38bdf8' },
  rimba: { main: 0x10b981, accent: 0x4ade80, hex: '#4ade80' },
  bayu: { main: 0x14b8a6, accent: 0x2dd4bf, hex: '#2dd4bf' },
  suara: { main: 0x8b5cf6, accent: 0xc084fc, hex: '#c084fc' },
};

// ============================================================================
// 1. MULTI-PART 3D ECO AIRCRAFT (with seated 3D Human Agent Companion!)
// ============================================================================
export function buildEcoAircraft(
  initialAvatar: AvatarId,
  maxAnisotropy = 4
): AircraftHandle {
  const group = new THREE.Group();
  const shadowTex = createContactShadowTexture();

  const stripeTex = makeCanvasTex(
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(0, 96, 256, 36);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 132, 256, 24);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 156, 256, 12);
    },
    maxAnisotropy
  );

  const hullMat = new THREE.MeshStandardMaterial({
    map: stripeTex,
    roughness: 0.25,
    metalness: 0.28,
  });
  const initPalette = AGENT_COLORS[initialAvatar] || AGENT_COLORS.rimba;
  const wingMat = new THREE.MeshStandardMaterial({
    color: initPalette.main,
    roughness: 0.3,
    metalness: 0.22,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.2,
    roughness: 0.25,
    metalness: 0.4,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.78,
  });
  const glowCyanMat = new THREE.MeshStandardMaterial({
    color: initPalette.accent,
    emissive: initPalette.main,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0.1,
    depthWrite: false,
  });

  // Main Sculpted Fuselage (Lathe profile along Z)
  const hullPts = [
    new THREE.Vector2(0.01, -3.4),
    new THREE.Vector2(0.32, -3.1),
    new THREE.Vector2(0.74, -2.1),
    new THREE.Vector2(0.92, -0.7),
    new THREE.Vector2(0.88, 0.8),
    new THREE.Vector2(0.55, 2.5),
    new THREE.Vector2(0.24, 3.6),
    new THREE.Vector2(0.01, 3.85),
  ];
  const fuselageGeo = new THREE.LatheGeometry(hullPts, 20);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
  fuselage.scale.set(1.0, 0.92, 1.0);
  fuselage.castShadow = true;
  group.add(fuselage);

  // Nose Intake Ring
  const noseRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 12, 24), accentMat);
  noseRing.position.set(0, 0, -3.05);
  group.add(noseRing);

  // Swept Main Wings (Left & Right)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.9);
  wingShape.lineTo(4.4, -0.15);
  wingShape.lineTo(4.4, 0.75);
  wingShape.lineTo(0, 1.05);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(0.62, -0.05, -0.35);
  rightWing.castShadow = true;
  group.add(rightWing);

  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.scale.x = -1;
  leftWing.position.set(-0.62, -0.05, -0.35);
  leftWing.castShadow = true;
  group.add(leftWing);

  // Wingtip Vertical Winglets + Glowing Nav Beacons
  [-4.95, 4.95].forEach((wx, idx) => {
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.7), accentMat);
    winglet.position.set(wx, 0.25, 0.05);
    winglet.rotation.z = idx === 0 ? 0.28 : -0.28;
    group.add(winglet);

    const tipLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({
        color: idx === 0 ? 0xef4444 : 0x22c55e,
        emissive: idx === 0 ? 0xef4444 : 0x22c55e,
        emissiveIntensity: 1.4,
      })
    );
    tipLight.position.set(wx, 0.62, 0.05);
    group.add(tipLight);
  });

  // Animated Aileron Flaps
  const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.32), accentMat);
  leftFlap.position.set(-2.5, -0.08, 0.65);
  const rightFlap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.32), accentMat);
  rightFlap.position.set(2.5, -0.08, 0.65);
  group.add(leftFlap, rightFlap);

  // Twin Jet Pods under wings for futuristic eco-boost look
  [-1.85, 1.85].forEach((px) => {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.55, 14), darkMetalMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(px, -0.32, -0.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.045, 8, 18), glowCyanMat);
    ring.position.set(px, -0.32, 0.68);
    group.add(pod, ring);
  });

  // Tail Stabilizers (Horizontal + Vertical Eco-Fin)
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 0.72), wingMat);
  hTail.position.set(0, 0.25, 3.15);
  const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.35, 0.95), accentMat);
  vTail.position.set(0, 0.92, 3.1);
  vTail.rotation.x = -0.26;
  group.add(hTail, vTail);

  // Spinning Front Propeller Group
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -3.52);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.65, 16), accentMat);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.22;
  propeller.add(spinner);

  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.38, 0.05), darkMetalMat);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI * 2) / 3;
    blade.position.y = 0.7;
    blade.rotation.y = 0.25;
    blade.rotation.z = 0;
    holder.add(blade);
    propeller.add(holder);
  }
  group.add(propeller);

  // Landing Gear Struts + Wheels
  [
    [0, -0.82, -2.0],
    [-1.15, -0.82, 0.4],
    [1.15, -0.82, 0.4],
  ].forEach(([gx, gy, gz]) => {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 8), darkMetalMat);
    strut.position.set(gx, gy + 0.3, gz);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 14), darkMetalMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gx, gy, gz);
    group.add(strut, wheel);
  });

  // Cockpit Seat & Seated 3D Human Eco-Agent Companion
  const cockpitRecess = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 1.5), darkMetalMat);
  cockpitRecess.position.set(0, 0.48, -0.55);
  group.add(cockpitRecess);

  let currentAvatar = initialAvatar;
  let companionRig = buildHumanEcoAgent(initialAvatar, shadowTex, {
    maxAnisotropy,
    showPedestal: false,
  });
  companionRig.group.scale.setScalar(0.55);
  companionRig.group.position.set(0, 0.34, -0.52);
  companionRig.group.rotation.y = Math.PI; // facing forward (-Z)
  group.add(companionRig.group);

  // Glass Canopy Bubble over companion
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.76, 20, 16), canopyMat);
  canopy.scale.set(0.88, 0.78, 1.65);
  canopy.position.set(0, 0.85, -0.55);
  canopy.renderOrder = 4;
  group.add(canopy);

  const setAgent = (nextAvatar: AvatarId) => {
    const pal = AGENT_COLORS[nextAvatar] || AGENT_COLORS.rimba;
    wingMat.color.setHex(pal.main);
    glowCyanMat.color.setHex(pal.accent);
    glowCyanMat.emissive.setHex(pal.main);
    if (nextAvatar === currentAvatar) return;
    currentAvatar = nextAvatar;
    group.remove(companionRig.group);
    companionRig = buildHumanEcoAgent(nextAvatar, shadowTex, {
      maxAnisotropy,
      showPedestal: false,
    });
    companionRig.group.scale.setScalar(0.55);
    companionRig.group.position.set(0, 0.34, -0.52);
    companionRig.group.rotation.y = Math.PI;
    group.add(companionRig.group);
  };

  return { group, propeller, leftFlap, rightFlap, companionRig, setAgent };
}

// ============================================================================
// 2. FUTURISTIC 3D COCKPIT INTERIOR RIG (Attached to Camera in Cockpit Mode)
// ============================================================================
export function buildCockpitInterior(maxAnisotropy = 4): CockpitRigHandle {
  const group = new THREE.Group();

  const coamingMat = new THREE.MeshStandardMaterial({
    color: 0x0f3b68,
    roughness: 0.38,
    metalness: 0.35,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.28,
    metalness: 0.45,
  });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  // Lower curved dashboard coaming (stays cleanly in lower 28% of screen, center sky wide open!)
  const dashBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.48, 0.52), coamingMat);
  dashBase.position.set(0, -0.56, -1.18);
  dashBase.rotation.x = -0.22;
  group.add(dashBase);

  const dashTrim = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.05, 0.54), trimMat);
  dashTrim.position.set(0, -0.32, -1.16);
  dashTrim.rotation.x = -0.22;
  group.add(dashTrim);

  // Side cockpit struts (left & right frame edges)
  [-1.25, 1.25].forEach((sx, idx) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.65, 10), trimMat);
    pillar.position.set(sx, 0.12, -1.02);
    pillar.rotation.z = idx === 0 ? -0.24 : 0.24;
    pillar.rotation.x = 0.22;
    group.add(pillar);
  });

  // Dynamic Canvas Texture for Left, Center & Right Cockpit Screens
  const leftCanvas = document.createElement('canvas');
  leftCanvas.width = 256;
  leftCanvas.height = 160;
  const leftCtx = leftCanvas.getContext('2d')!;
  const leftTex = new THREE.CanvasTexture(leftCanvas);
  leftTex.colorSpace = THREE.SRGBColorSpace;
  leftTex.anisotropy = maxAnisotropy;

  const centerCanvas = document.createElement('canvas');
  centerCanvas.width = 256;
  centerCanvas.height = 160;
  const centerCtx = centerCanvas.getContext('2d')!;
  const centerTex = new THREE.CanvasTexture(centerCanvas);
  centerTex.colorSpace = THREE.SRGBColorSpace;
  centerTex.anisotropy = maxAnisotropy;

  const rightCanvas = document.createElement('canvas');
  rightCanvas.width = 256;
  rightCanvas.height = 160;
  const rightCtx = rightCanvas.getContext('2d')!;
  const rightTex = new THREE.CanvasTexture(rightCanvas);
  rightTex.colorSpace = THREE.SRGBColorSpace;
  rightTex.anisotropy = maxAnisotropy;

  const leftScreenMat = new THREE.MeshBasicMaterial({ map: leftTex });
  const centerScreenMat = new THREE.MeshBasicMaterial({ map: centerTex });
  const rightScreenMat = new THREE.MeshBasicMaterial({ map: rightTex });

  const leftScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), leftScreenMat);
  leftScreen.position.set(-0.68, -0.38, -0.92);
  leftScreen.rotation.y = 0.24;
  leftScreen.rotation.x = -0.2;

  const centerScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), centerScreenMat);
  centerScreen.position.set(0, -0.36, -0.96);
  centerScreen.rotation.x = -0.2;

  const rightScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), rightScreenMat);
  rightScreen.position.set(0.68, -0.38, -0.92);
  rightScreen.rotation.y = -0.24;
  rightScreen.rotation.x = -0.2;

  group.add(leftScreen, centerScreen, rightScreen);

  // Glowing Holographic Glass Visor Rim at top center of dashboard
  const hudGlassMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const hudGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.22), hudGlassMat);
  hudGlass.position.set(0, -0.1, -0.98);
  group.add(hudGlass);

  const hudFrame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.025, 0.03), cyanGlowMat);
  hudFrame.position.set(0, -0.21, -0.98);
  group.add(hudFrame);

  // Animated Pilot Steering Yoke
  const yoke = new THREE.Group();
  yoke.position.set(0, -0.58, -0.78);
  const yokeStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 10), trimMat);
  yokeStem.rotation.x = Math.PI / 3;
  yokeStem.position.z = -0.12;
  const yokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.065, 0.065), coamingMat);
  const leftGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), cyanGlowMat);
  leftGrip.position.set(-0.22, 0.06, 0);
  const rightGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), cyanGlowMat);
  rightGrip.position.set(0.22, 0.06, 0);
  yoke.add(yokeStem, yokeBar, leftGrip, rightGrip);
  group.add(yoke);

  // Throttle Lever
  const throttle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.5 })
  );
  throttle.position.set(-0.34, -0.46, -0.82);
  group.add(throttle);

  const updateHudCanvas = (opts: {
    speed: number;
    altitude: number;
    headingDeg: number;
    distToTarget: number;
    stabilized: boolean;
    stageLabel: string;
    evidenceCount: number;
  }) => {
    // Left screen: Speed & Altitude
    leftCtx.fillStyle = '#041f3a';
    leftCtx.fillRect(0, 0, 256, 160);
    leftCtx.strokeStyle = '#38bdf8';
    leftCtx.lineWidth = 6;
    leftCtx.strokeRect(4, 4, 248, 152);
    leftCtx.fillStyle = '#7dd3fc';
    leftCtx.font = 'bold 20px sans-serif';
    leftCtx.fillText('DATA PENERBANGAN', 18, 32);
    leftCtx.fillStyle = '#facc15';
    leftCtx.font = 'bold 30px monospace';
    leftCtx.fillText(`${Math.round(opts.speed)} km/j`, 18, 76);
    leftCtx.fillStyle = '#34d399';
    leftCtx.fillText(`ALT ${Math.round(opts.altitude)} m`, 18, 118);
    leftTex.needsUpdate = true;

    // Center screen: Target Distance & Stabilized Mode
    centerCtx.fillStyle = '#042b29';
    centerCtx.fillRect(0, 0, 256, 160);
    centerCtx.strokeStyle = opts.stabilized ? '#facc15' : '#2dd4bf';
    centerCtx.lineWidth = 6;
    centerCtx.strokeRect(4, 4, 248, 152);
    centerCtx.fillStyle = '#ffffff';
    centerCtx.textAlign = 'center';
    centerCtx.font = 'bold 18px sans-serif';
    centerCtx.fillText(opts.stabilized ? 'MOD STABIL: AKTIF' : 'HALA TUJU ZON', 128, 34);
    centerCtx.fillStyle = opts.stabilized ? '#facc15' : '#5eead4';
    centerCtx.font = 'bold 34px monospace';
    centerCtx.fillText(
      opts.stabilized ? 'APUNG' : `${Math.max(0, Math.round(opts.distToTarget))} m`,
      128,
      86
    );
    centerCtx.fillStyle = '#bae6fd';
    centerCtx.font = 'bold 15px sans-serif';
    centerCtx.fillText(opts.stageLabel.slice(0, 24), 128, 130);
    centerCtx.textAlign = 'left';
    centerTex.needsUpdate = true;

    // Right screen: Evidence Scanner
    rightCtx.fillStyle = '#07223d';
    rightCtx.fillRect(0, 0, 256, 160);
    rightCtx.strokeStyle = '#34d399';
    rightCtx.lineWidth = 6;
    rightCtx.strokeRect(4, 4, 248, 152);
    rightCtx.fillStyle = '#a7f3d0';
    rightCtx.font = 'bold 20px sans-serif';
    rightCtx.fillText('PENGIMBAS BUKTI', 18, 32);
    rightCtx.fillStyle = opts.evidenceCount >= 3 ? '#facc15' : '#38bdf8';
    rightCtx.font = 'bold 36px monospace';
    rightCtx.fillText(`${opts.evidenceCount} / 3`, 18, 86);
    rightCtx.fillStyle = '#e2e8f0';
    rightCtx.font = 'bold 16px sans-serif';
    rightCtx.fillText(`ARAH: ${Math.round(opts.headingDeg)}°`, 18, 130);
    rightTex.needsUpdate = true;
  };

  return {
    group,
    yoke,
    throttle,
    leftScreenMat,
    centerScreenMat,
    rightScreenMat,
    hudGlassMat,
    updateHudCanvas,
  };
}

// ============================================================================
// 3. BRIGHT 3D AIRCRAFT HANGAR SCENE (Mission Briefing & Companion Select)
// ============================================================================
export function buildHangarScene(
  initialAvatar: AvatarId,
  maxAnisotropy = 4
): HangarSceneHandle {
  const group = new THREE.Group();
  const shadowTex = createContactShadowTexture();

  // Floor with sunlit cyan-white hangar deck & yellow guide lines
  const floorTex = makeCanvasTex(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      // Yellow aircraft bay guide lines
      ctx.fillStyle = '#facc15';
      ctx.fillRect(246, 0, 20, 512);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(10, 0, 14, 512);
      ctx.fillRect(488, 0, 14, 512);
    },
    maxAnisotropy,
    2,
    2
  );

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Open Futuristic Hangar Arch Rib Columns (Bright sky visible behind!)
  const archMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.3,
    metalness: 0.35,
  });
  const tealStripMat = new THREE.MeshStandardMaterial({
    color: 0x14b8a6,
    emissive: 0x0d9488,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });

  [-11, -3, 5].forEach((az) => {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(13.5, 0.45, 10, 32, Math.PI), archMat);
    arch.position.set(0, 0, az);
    const strip = new THREE.Mesh(new THREE.TorusGeometry(13.0, 0.14, 8, 32, Math.PI), tealStripMat);
    strip.position.set(0, 0, az);
    group.add(arch, strip);
  });

  // Distant sunny green hills visible outside hangar bay doors (-Z)
  const distantHills = new THREE.Mesh(
    new THREE.ConeGeometry(28, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85 })
  );
  distantHills.position.set(-18, 5, -45);
  const distantHills2 = new THREE.Mesh(
    new THREE.ConeGeometry(24, 14, 8),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.85 })
  );
  distantHills2.position.set(20, 6, -48);
  group.add(distantHills, distantHills2);

  // Parked Eco Aircraft right in the sunlit center bay
  const aircraft = buildEcoAircraft(initialAvatar, maxAnisotropy);
  aircraft.group.position.set(-1.2, 1.06, -1.5);
  aircraft.group.rotation.y = 0.48;
  group.add(aircraft.group);

  // Contact shadow under aircraft
  const planeShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 9),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.42 })
  );
  planeShadow.rotation.x = -Math.PI / 2;
  planeShadow.position.set(-1.2, 0.02, -1.5);
  group.add(planeShadow);

  // Full-size 3D Human Agent standing beside the aircraft waving hello!
  let currentId = initialAvatar;
  let guideAgentRig = buildHumanEcoAgent(initialAvatar, shadowTex, {
    maxAnisotropy,
    showPedestal: true,
  });
  guideAgentRig.group.position.set(3.2, 0, 2.2);
  guideAgentRig.group.rotation.y = -0.35;
  guideAgentRig.welcomeTimer = 1.6;
  group.add(guideAgentRig.group);

  // Glowing Holographic Briefing Podium beside the agent
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.85, 1.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.25 })
  );
  podium.position.set(4.9, 0.55, 2.4);
  group.add(podium);

  const holoTex = makeCanvasTex(
    256,
    192,
    (ctx) => {
      ctx.fillStyle = 'rgba(8, 47, 73, 0.85)';
      ctx.fillRect(0, 0, 256, 192);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 244, 180);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAKIMAT MISI 01', 128, 42);
      ctx.fillStyle = '#5eead4';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('OPERASI UDARA', 128, 76);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('SUNGAI TERCEMAR', 128, 108);
      ctx.fillStyle = '#4ade80';
      ctx.fillText('PESAWAT: SEDIA', 128, 148);
    },
    maxAnisotropy
  );
  const holoBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.3),
    new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, side: THREE.DoubleSide })
  );
  holoBoard.position.set(4.9, 1.95, 2.4);
  holoBoard.rotation.y = -0.45;
  group.add(holoBoard);

  const setAgent = (nextAvatar: AvatarId) => {
    aircraft.setAgent(nextAvatar);
    if (nextAvatar === currentId) return;
    currentId = nextAvatar;
    group.remove(guideAgentRig.group);
    guideAgentRig = buildHumanEcoAgent(nextAvatar, shadowTex, {
      maxAnisotropy,
      showPedestal: true,
    });
    guideAgentRig.group.position.set(3.2, 0, 2.2);
    guideAgentRig.group.rotation.y = -0.35;
    guideAgentRig.welcomeTimer = 1.6;
    group.add(guideAgentRig.group);
  };

  const animate = (elapsed: number, dt: number) => {
    aircraft.propeller.rotation.z += dt * 4.5;
    holoBoard.position.y = 1.95 + Math.sin(elapsed * 2.2) * 0.08;
  };

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if (mat && 'map' in mat && (mat as THREE.MeshBasicMaterial).map) {
            (mat as THREE.MeshBasicMaterial).map?.dispose();
          }
          mat?.dispose();
        });
      }
    });
  };

  return { group, aircraft, guideAgentRig, setAgent, animate, dispose };
}

// ============================================================================
// 4. EXPANSIVE 3D FLIGHT ADVENTURE WORLD (Sky, Mountains, River, Village,
//    Industrial Factory, 3 Evidence Items, Checkpoints & Runway)
// ============================================================================
export function buildFlightWorld(maxAnisotropy = 4): FlightWorldHandle {
  const group = new THREE.Group();

  // 1. Vibrant Lush Emerald-Lime Terrain Floor
  const groundTex = makeCanvasTex(
    512,
    512,
    (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, '#4ade80');
      grad.addColorStop(0.5, '#22c55e');
      grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
      // Organic grassy patches
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(132, 204, 22, 0.28)' : 'rgba(5, 150, 105, 0.24)';
        ctx.beginPath();
        ctx.arc((i * 73) % 512, (i * 137) % 512, 24 + (i % 5) * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    maxAnisotropy,
    12,
    12
  );
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(580, 580),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.85, metalness: 0.04 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 2. Winding River (Clean turquoise upstream + Contaminated dark chemical river near factory)
  const riverCleanTex = makeCanvasTex(
    256,
    256,
    (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0, '#0ea5e9');
      grad.addColorStop(0.5, '#2dd4bf');
      grad.addColorStop(1, '#0284c7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let y = 16; y < 256; y += 36) {
        ctx.fillRect(24, y, 80, 5);
        ctx.fillRect(140, y + 14, 90, 4);
      }
    },
    maxAnisotropy,
    1,
    6
  );

  const riverPollutedTex = makeCanvasTex(
    256,
    256,
    (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.45, '#3b2f2f');
      grad.addColorStop(0.8, '#2e1065');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(163, 230, 53, 0.25)';
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.arc((i * 41) % 256, (i * 63) % 256, 10 + (i % 4) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    maxAnisotropy,
    1,
    5
  );

  // Clean turquoise river from South-West toward village
  const cleanRiver = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 175),
    new THREE.MeshStandardMaterial({
      map: riverCleanTex,
      emissive: 0x0369a1,
      emissiveIntensity: 0.22,
      roughness: 0.25,
    })
  );
  cleanRiver.rotation.x = -Math.PI / 2;
  cleanRiver.rotation.z = 0.16;
  cleanRiver.position.set(-14, 0.12, 48);
  group.add(cleanRiver);

  // Visibly polluted river section flowing past Factory & Kampung Sungai Jernih
  const pollutedRiver = new THREE.Mesh(
    new THREE.PlaneGeometry(21, 165),
    new THREE.MeshStandardMaterial({
      map: riverPollutedTex,
      emissive: 0x3b0764,
      emissiveIntensity: 0.32,
      roughness: 0.35,
    })
  );
  pollutedRiver.rotation.x = -Math.PI / 2;
  pollutedRiver.rotation.z = -0.14;
  pollutedRiver.position.set(-2, 0.15, -108);
  group.add(pollutedRiver);

  // Muddy riverbanks along polluted zone
  [-12, 9].forEach((bx) => {
    const bank = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.38, 162),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.92 })
    );
    bank.position.set(bx, 0.18, -108);
    bank.rotation.y = -0.14;
    group.add(bank);
  });

  // 3. Majestic Sunlit Mountains & Perimeter Peaks (zero indoor walls)
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.85,
    flatShading: true,
  });
  const rockPeakMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.88,
    flatShading: true,
  });
  const snowCapMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.55,
    flatShading: true,
  });

  const mountainSpecs: [number, number, number, number][] = [
    [-115, -170, 38, 44],
    [-45, -210, 44, 55],
    [48, -205, 40, 48],
    [125, -165, 36, 42],
    [-145, -45, 34, 36],
    [140, -35, 34, 38],
    [-130, 85, 32, 34],
    [130, 95, 32, 35],
    [-70, 195, 36, 40],
    [75, 195, 36, 42],
  ];
  mountainSpecs.forEach(([mx, mz, r, h], idx) => {
    const mtn = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 7),
      idx % 2 === 0 ? mountainMat : rockPeakMat
    );
    cone.position.y = h / 2;
    mtn.add(cone);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.34, h * 0.34, 7), snowCapMat);
    cap.position.y = h * 0.83;
    mtn.add(cap);
    mtn.position.set(mx, 0, mz);
    group.add(mtn);
  });

  // 4. Instanced Lush Forests (300 vibrant green & lime trees across terrain)
  const treeCount = 240;
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.72, 3.8, 7);
  const crownGeo = new THREE.ConeGeometry(2.6, 5.8, 7);
  const trunkInst = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }),
    treeCount
  );
  const crownInst = new THREE.InstancedMesh(
    crownGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 }),
    treeCount
  );
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const palette = [0x16a34a, 0x22c55e, 0x4ade80, 0x84cc16, 0x10b981];
  let tIdx = 0;
  for (let i = 0; i < 420 && tIdx < treeCount; i++) {
    const angle = i * 2.39996;
    const rad = 32 + ((i * 37) % 190);
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    // Keep flight corridor, runway, factory, and village clear
    if (Math.abs(tx) < 22 && tz > -160 && tz < 165) continue;
    if (tx > 14 && tx < 56 && tz > -128 && tz < -68) continue;
    if (tx < -14 && tx > -56 && tz > -30 && tz < 56) continue;

    const sc = 0.8 + (i % 5) * 0.16;
    dummy.position.set(tx, 1.9 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.y = (i * 0.7) % (Math.PI * 2);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(tIdx, dummy.matrix);

    dummy.position.set(tx, 5.2 * sc, tz);
    dummy.updateMatrix();
    crownInst.setMatrixAt(tIdx, dummy.matrix);
    col.setHex(palette[i % palette.length]);
    crownInst.setColorAt(tIdx, col);
    tIdx++;
  }
  trunkInst.count = tIdx;
  crownInst.count = tIdx;
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  group.add(trunkInst, crownInst);

  // 5. Fluffy 3D Clouds in Bright Blue Sky
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.25,
    roughness: 0.9,
  });
  for (let i = 0; i < 22; i++) {
    const cg = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(3.2 + (p % 2) * 1.4, 12, 10),
        cloudMat
      );
      puff.position.set((p - 1) * 3.4, (p % 2) * 1.1, (p % 3) * 0.9);
      puff.scale.set(1.25, 0.78, 1.0);
      cg.add(puff);
    }
    cg.position.set(
      ((i * 53) % 340) - 170,
      34 + (i % 5) * 6,
      ((i * 67) % 340) - 170
    );
    cg.userData.speed = 1.4 + (i % 4) * 0.4;
    clouds.push(cg);
    group.add(cg);
  }

  // 6. Kampung Sungai Jernih (Colorful Village Houses + Wooden Jetty near Z=15..-20)
  const houseColors = [0xf97316, 0x38bdf8, 0xfacc15, 0xec4899, 0x2dd4bf];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.72 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.86 });
  [
    [-26, 26],
    [-34, 12],
    [-25, -4],
    [-36, -18],
    [-27, -34],
  ].forEach(([hx, hz], idx) => {
    const house = new THREE.Group();
    const stilts = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.0, 4.4), woodMat);
    stilts.position.y = 0.5;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 3.0, 5.0),
      new THREE.MeshStandardMaterial({ color: houseColors[idx % houseColors.length], roughness: 0.65 })
    );
    body.position.y = 2.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.4, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5.1;
    house.add(stilts, body, roof);
    house.position.set(hx, 0, hz);
    house.rotation.y = 0.3;
    group.add(house);
  });

  // Wooden Village Jetty overlooking river
  const jetty = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 3.2), woodMat);
  jetty.position.set(-19, 0.55, 22);
  group.add(jetty);

  // 7. Industrial Textile Factory + Twin Smokestacks + Smog + Night-Ops Chemical Truck (Z = -96)
  const factoryGroup = new THREE.Group();
  factoryGroup.position.set(28, 0, -96);

  const fMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55, metalness: 0.38 });
  const fRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.45 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 });

  const hall = new THREE.Mesh(new THREE.BoxGeometry(18, 8.5, 14), fMat);
  hall.position.y = 4.25;
  const hallRoof = new THREE.Mesh(new THREE.BoxGeometry(18.6, 1.0, 14.6), fRoofMat);
  hallRoof.position.y = 8.9;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(18.3, 0.9, 14.3), hazardMat);
  stripe.position.y = 6.8;
  factoryGroup.add(hall, hallRoof, stripe);

  // Chemical storage silos
  [-6, -2].forEach((sx) => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 7.5, 16), fRoofMat);
    tank.position.set(sx, 3.75, 10);
    factoryGroup.add(tank);
  });

  // Twin tall smokestacks + animated smog puffs
  const smogPuffs: THREE.Mesh[] = [];
  const smogMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.72,
    roughness: 0.95,
  });
  [-4.5, 4.5].forEach((cx, sIdx) => {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 17, 14), fMat);
    stack.position.set(cx, 8.5, -3);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.22, 1.4, 14), hazardMat);
    band.position.set(cx, 15.2, -3);
    factoryGroup.add(stack, band);

    for (let k = 0; k < 5; k++) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + (k % 3) * 0.45, 1), smogMat);
      puff.position.set(cx, 18.2 + k * 2.5, -3);
      puff.userData.baseY = puff.position.y;
      puff.userData.phase = sIdx * 2 + k;
      smogPuffs.push(puff);
      factoryGroup.add(puff);
    }
  });

  // Chemical Truck parked near the river bank
  const truck = new THREE.Group();
  const truckBody = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 2.4, 2.5),
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 })
  );
  truckBody.position.y = 1.6;
  const truckCab = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 2.0, 2.4),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
  );
  truckCab.position.set(-3.4, 1.4, 0);
  truck.add(truckBody, truckCab);
  truck.position.set(-14, 0, 5);
  truck.rotation.y = 0.25;
  factoryGroup.add(truck);

  group.add(factoryGroup);

  // Pollution Warning Signboards along the river zone
  const signTex = makeCanvasTex(
    256,
    128,
    (ctx) => {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, 244, 116);
      ctx.fillStyle = '#7f1d1d';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ AWAS! ⚠', 128, 48);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('SUNGAI TERCEMAR', 128, 88);
    },
    maxAnisotropy
  );
  [
    [-14, -70],
    [13, -108],
  ].forEach(([sx, sz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 5.5, 8), woodMat);
    post.position.set(sx, 2.75, sz);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 2.8),
      new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    board.position.set(sx, 5.4, sz);
    group.add(post, board);
  });

  // 8. Three Interactive 3D Environmental Evidence Markers (Raycast Layer 1)
  const evidenceMarkers: FlightEvidenceMarker[] = [];

  const createMarkerBeacons = (
    id: 'paip' | 'ikan' | 'bau',
    title: string,
    pos: [number, number, number],
    accentColor: number,
    buildSubject: (parent: THREE.Group) => void
  ) => {
    const evGroup = new THREE.Group();
    evGroup.position.set(...pos);
    buildSubject(evGroup);

    // Tall vertical hologram beacon crystal visible from cockpit in flight!
    const beaconMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.1, 0),
      new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.95,
        roughness: 0.15,
        metalness: 0.3,
      })
    );
    beaconMesh.position.y = 7.2;
    evGroup.add(beaconMesh);

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.24, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.8,
      })
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 2.6;
    evGroup.add(ringMesh);

    const hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(5.6, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitProxy.position.y = 5.0;
    hitProxy.layers.set(1);
    hitProxy.userData = { type: 'flight_clue', clueId: id };
    evGroup.add(hitProxy);

    group.add(evGroup);
    evidenceMarkers.push({
      id,
      title,
      group: evGroup,
      beaconMesh,
      ringMesh,
      hitProxy,
      worldPos: new THREE.Vector3(...pos),
    });
  };

  // Evidence 1: Paip Sisa Kimia
  createMarkerBeacons('paip', 'Paip Sisa Kimia', [9, 0.5, -92], 0xf97316, (g) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 11, 14),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.78, roughness: 0.3 })
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(4.5, 1.5, 0);
    const sludge = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x3b0764,
        emissive: 0x581c87,
        emissiveIntensity: 0.7,
      })
    );
    sludge.scale.set(1.5, 0.35, 1.4);
    sludge.position.set(-1.5, 0.2, 0);
    g.add(pipe, sludge);
  });

  // Evidence 2: Ikan Mati Terapung
  createMarkerBeacons('ikan', 'Ikan Mati Terapung', [-4, 0.3, -104], 0x38bdf8, (g) => {
    const fishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
    [
      [-1.8, 0.35, -1.2],
      [0.8, 0.35, 0.6],
      [2.1, 0.35, -0.9],
      [-0.5, 0.35, 2.0],
    ].forEach(([fx, fy, fz], idx) => {
      const fish = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), fishMat);
      fish.scale.set(1.7, 0.5, 0.75);
      fish.position.set(fx, fy, fz);
      fish.rotation.y = idx * 0.9;
      g.add(fish);
    });
  });

  // Evidence 3: Tong Sisa Berbau Busuk
  createMarkerBeacons('bau', 'Tong Sisa Berbau Busuk', [-12, 0.4, -84], 0xa855f7, (g) => {
    const drumMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
      metalness: 0.35,
    });
    const spillMat = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      emissive: 0x65a30d,
      emissiveIntensity: 0.75,
    });
    [
      [-1.2, 1.3, 0],
      [1.2, 1.3, 0.9],
      [0, 1.3, -1.3],
    ].forEach(([dx, dy, dz]) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.5, 14), drumMat);
      drum.position.set(dx, dy, dz);
      g.add(drum);
    });
    const puddle = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.16, 16), spillMat);
    puddle.position.set(0, 0.12, 0);
    g.add(puddle);
  });

  // 9. Aerial Flight Checkpoint Gates (Glowing Sky Hoops)
  const checkpoints: FlightCheckpointRing[] = [];
  const cpSpecs: { id: string; pos: [number, number, number]; color: number }[] = [
    { id: 'audio', pos: [0, 14, 34], color: 0x38bdf8 },
    { id: 'q1', pos: [0, 14, -24], color: 0x10b981 },
    { id: 'q2', pos: [0, 15, -82], color: 0xfacc15 },
    { id: 'q3', pos: [0, 16, -138], color: 0xc084fc },
    { id: 'runway', pos: [0, 10, 62], color: 0x22c55e },
  ];

  cpSpecs.forEach((cp) => {
    const cpGroup = new THREE.Group();
    cpGroup.position.set(...cp.pos);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.55, 12, 36),
      new THREE.MeshStandardMaterial({
        color: cp.color,
        emissive: cp.color,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
    );
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(7.8, 0.25, 10, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: cp.color,
        emissiveIntensity: 0.65,
      })
    );
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 3.4, 32, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: cp.color,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = -4;
    cpGroup.add(outerRing, innerRing, beam);
    group.add(cpGroup);

    checkpoints.push({
      id: cp.id,
      position: new THREE.Vector3(...cp.pos),
      group: cpGroup,
      outerRing,
      innerRing,
      beam,
    });
  });

  // 10. Eco World Headquarters & Illuminated 3D Landing Runway (around Z = 115)
  const runwayTex = makeCanvasTex(
    256,
    512,
    (ctx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 256, 512);
      // Edge lines
      ctx.fillStyle = '#facc15';
      ctx.fillRect(10, 0, 8, 512);
      ctx.fillRect(238, 0, 8, 512);
      // White threshold bars
      ctx.fillStyle = '#ffffff';
      for (let x = 28; x <= 212; x += 26) {
        ctx.fillRect(x, 24, 14, 48);
        ctx.fillRect(x, 440, 14, 48);
      }
      // Center dashed line
      for (let y = 96; y < 420; y += 44) {
        ctx.fillRect(122, y, 12, 26);
      }
    },
    maxAnisotropy
  );
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 68),
    new THREE.MeshStandardMaterial({ map: runwayTex, roughness: 0.55 })
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.18, 120);
  runway.receiveShadow = true;
  group.add(runway);

  // Runway Illuminated Approach Beacons
  const runwayBeaconGroup = new THREE.Group();
  const beaconLightMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 1.4,
  });
  for (let i = 0; i < 6; i++) {
    const zPos = 86 + i * 13;
    [-10, 10].forEach((xPos) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), beaconLightMat);
      b.position.set(xPos, 0.8, zPos);
      runwayBeaconGroup.add(b);
    });
  }
  group.add(runwayBeaconGroup);

  // Eco World Control Tower beside Runway
  const towerGroup = new THREE.Group();
  towerGroup.position.set(17, 0, 118);
  const towerStem = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.4, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  towerStem.position.y = 6;
  const towerDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 2.5, 3.0, 16),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.35 })
  );
  towerDeck.position.y = 13.2;
  const radarDish = new THREE.Group();
  radarDish.position.set(0, 15.6, 0);
  const dishBar = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25 })
  );
  radarDish.add(dishBar);
  towerGroup.add(towerStem, towerDeck, radarDish);
  group.add(towerGroup);

  // 11. Celebration Stars, Light Pillar & Confetti Particle Group (triggered on safe landing)
  const celebrationGroup = new THREE.Group();
  celebrationGroup.position.set(0, 0.2, 120);
  celebrationGroup.visible = false;

  const celebrationBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 5.4, 28, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  celebrationBeam.position.y = 14;
  celebrationGroup.add(celebrationBeam);

  const celebrationRing = new THREE.Mesh(
    new THREE.RingGeometry(4.2, 5.4, 40),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  celebrationRing.rotation.x = -Math.PI / 2;
  celebrationRing.position.y = 0.15;
  celebrationGroup.add(celebrationRing);

  const celebrationParticles: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
  const celebColors = [0xfacc15, 0x34d399, 0x38bdf8, 0xf97316, 0xe879f9];
  for (let i = 0; i < 42; i++) {
    const pMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({
        color: celebColors[i % celebColors.length],
        emissive: celebColors[i % celebColors.length],
        emissiveIntensity: 0.9,
      })
    );
    const angle = (i / 42) * Math.PI * 2;
    const spd = 6 + (i % 5) * 2.2;
    celebrationParticles.push({
      mesh: pMesh,
      vel: new THREE.Vector3(Math.cos(angle) * spd, 8 + (i % 4) * 3, Math.sin(angle) * spd),
    });
    celebrationGroup.add(pMesh);
  }
  group.add(celebrationGroup);

  const triggerCelebration = () => {
    celebrationGroup.visible = true;
    celebrationParticles.forEach((p, idx) => {
      p.mesh.position.set(0, 3.8, 0);
      const angle = (idx / celebrationParticles.length) * Math.PI * 2;
      const spd = 6 + (idx % 5) * 2.4;
      p.vel.set(Math.cos(angle) * spd, 9 + (idx % 4) * 3.2, Math.sin(angle) * spd);
    });
  };

  const animate = (
    elapsed: number,
    dt: number,
    foundClues: string[],
    activeCheckpointId: string | null
  ) => {
    // Scroll flowing river textures
    riverCleanTex.offset.y -= dt * 0.45;
    riverPollutedTex.offset.y -= dt * 0.28;

    // Rotate control tower radar
    radarDish.rotation.y += dt * 1.8;

    // Drift clouds gently across blue sky
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.position.x += (c.userData.speed as number) * dt;
      if (c.position.x > 195) c.position.x = -195;
    }

    // Billowing factory smog
    for (let i = 0; i < smogPuffs.length; i++) {
      const puff = smogPuffs[i];
      const baseY = puff.userData.baseY as number;
      const phase = puff.userData.phase as number;
      puff.position.y = baseY + Math.sin(elapsed * 1.4 + phase) * 1.2;
      puff.rotation.y += dt * 0.4;
    }

    // Floating 3D Evidence Crystals
    for (let i = 0; i < evidenceMarkers.length; i++) {
      const ev = evidenceMarkers[i];
      const found = foundClues.includes(ev.id);
      ev.beaconMesh.rotation.y += dt * 2.2;
      ev.beaconMesh.position.y = 7.2 + Math.sin(elapsed * 2.8 + i) * 0.85;
      ev.ringMesh.rotation.z += dt * 1.4;
      const bMat = ev.beaconMesh.material as THREE.MeshStandardMaterial;
      if (found) {
        bMat.color.setHex(0x22c55e);
        bMat.emissive.setHex(0x16a34a);
      }
    }

    // Highlight active target checkpoint hoop
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const isTarget = cp.id === activeCheckpointId;
      cp.group.visible = isTarget;
      if (isTarget) {
        cp.outerRing.rotation.z += dt * 1.2;
        cp.innerRing.rotation.z -= dt * 1.6;
        const pulse = 1 + Math.sin(elapsed * 4.2) * 0.08;
        cp.outerRing.scale.setScalar(pulse);
      }
    }

    // Animate celebration particles, beam, and ground energy ring if visible
    if (celebrationGroup.visible) {
      celebrationBeam.rotation.y += dt * 1.4;
      (celebrationBeam.material as THREE.MeshBasicMaterial).opacity =
        0.22 + Math.sin(elapsed * 4.5) * 0.09;
      const ringPulse = 1 + Math.sin(elapsed * 4.2) * 0.16;
      celebrationRing.scale.setScalar(ringPulse);
      celebrationRing.rotation.z += dt * 1.8;

      for (let i = 0; i < celebrationParticles.length; i++) {
        const pt = celebrationParticles[i];
        pt.vel.y -= 9.5 * dt;
        pt.mesh.position.addScaledVector(pt.vel, dt);
        pt.mesh.rotation.x += dt * 4;
        pt.mesh.rotation.y += dt * 4;
        if (pt.mesh.position.y < 0.2) {
          pt.mesh.position.set(0, 3.8, 0);
          const angle = (i / celebrationParticles.length) * Math.PI * 2;
          const spd = 6 + (i % 5) * 2.4;
          pt.vel.set(Math.cos(angle) * spd, 9 + (i % 4) * 3.2, Math.sin(angle) * spd);
        }
      }
    }
  };

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if (mat && 'map' in mat && (mat as THREE.MeshBasicMaterial).map) {
            (mat as THREE.MeshBasicMaterial).map?.dispose();
          }
          mat?.dispose();
        });
      }
    });
  };

  return {
    group,
    clouds,
    riverCleanTex,
    riverPollutedTex,
    smogPuffs,
    radarDish,
    evidenceMarkers,
    checkpoints,
    runwayBeaconGroup,
    celebrationGroup,
    celebrationParticles,
    triggerCelebration,
    animate,
    dispose,
  };
}
