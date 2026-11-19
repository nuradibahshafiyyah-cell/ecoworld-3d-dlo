import * as THREE from 'three';
import { AvatarId } from '../types/game';
import { animateHumanAgent, buildHumanEcoAgent, HumanAgentRig } from './humanAgents';
import { createContactShadowTexture } from './textures';

export type M5IntroPhase = 1 | 2 | 3 | 4 | 5;

export interface PodcastIntroStatus {
  phase: M5IntroPhase;
  done: boolean;
}

export interface PodcastStudioRoomHandle {
  id: 5;
  group: THREE.Group;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  bgColor: number;
  fogColor: number;
  animate: (elapsed: number, dt: number, restored: boolean) => void;
  setAvatarId: (avatarId: AvatarId) => void;
  resetIntro: () => void;
  skipIntro: () => void;
  updateIntroCamera: (
    camera: THREE.PerspectiveCamera,
    target: THREE.Vector3,
    dt: number,
    userOrbiting: boolean
  ) => PodcastIntroStatus;
  dispose: () => void;
}

// Pre-allocated helpers to prevent GC inside animation loop
const _tmpCamPos = new THREE.Vector3();
const _tmpCamTgt = new THREE.Vector3();
const _tmpColor = new THREE.Color();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function createStudioFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#131d47');
  grad.addColorStop(0.5, '#192a61');
  grad.addColorStop(1, '#111c42');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tile bevels & glowing cyber grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
  ctx.lineWidth = 2;
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

  // Highlight purple/pink cross intersections
  for (let x = 0; x <= 512; x += 128) {
    for (let y = 0; y <= 512; y += 128) {
      ctx.fillStyle = (x + y) % 256 === 0 ? 'rgba(34, 211, 238, 0.45)' : 'rgba(236, 72, 153, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createNeonSignTexture(
  title: string,
  sub: string,
  activeBg: string,
  borderColor: string,
  glowColor: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 176;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = activeBg;
  ctx.fillRect(0, 0, 512, 176);

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 488, 152);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 74px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 78);

  ctx.shadowBlur = 8;
  ctx.fillStyle = borderColor;
  ctx.font = '700 24px "Chakra Petch", sans-serif';
  ctx.fillText(sub, 256, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function drawBackLedCanvas(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  live: boolean,
  restored: boolean
) {
  const w = 1024;
  const h = 440;

  // Vibrant gradient backdrop (never flat black)
  const bg = ctx.createLinearGradient(0, 0, w, h);
  if (live) {
    bg.addColorStop(0, '#2e1065');
    bg.addColorStop(0.5, '#0f295e');
    bg.addColorStop(1, '#4a044e');
  } else {
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(0.5, '#172554');
    bg.addColorStop(1, '#311042');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Perspective grid glow
  ctx.strokeStyle = live ? 'rgba(34, 211, 238, 0.22)' : 'rgba(168, 85, 247, 0.16)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 55) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Top Header Strip
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(24, 22, w - 48, 72);
  ctx.strokeStyle = live ? '#22d3ee' : '#a855f7';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 22, w - 48, 72);

  // Live indicator pill on screen
  ctx.fillStyle = live ? '#ec4899' : '#64748b';
  ctx.beginPath();
  ctx.roundRect(42, 37, 178, 42, 10);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(live ? '● LIVE' : 'STANDBY', 131, 59);

  ctx.fillStyle = live ? '#facc15' : '#cbd5e1';
  ctx.font = '900 30px "Orbitron", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    restored
      ? 'ECOWORLD LIVE • MISI BERJAYA!'
      : live
      ? 'LIVE PODCAST • SELAMATKAN ECOWORLD'
      : 'STUDIO PODCAST FUTURISTIK ECOWORLD',
    242,
    59
  );

  // Multi-color Audio Equalizer Bars across bottom half
  const barCount = 34;
  const barWidth = 20;
  const gap = 8;
  const startX = (w - barCount * (barWidth + gap)) / 2;
  const palette = ['#22d3ee', '#a855f7', '#ec4899', '#f97316', '#facc15', '#34d399', '#3b82f6'];

  for (let i = 0; i < barCount; i++) {
    const waveA = Math.sin(elapsed * (live ? 6.2 : 2.1) + i * 0.45);
    const waveB = Math.cos(elapsed * (live ? 4.4 : 1.5) - i * 0.3);
    const norm = 0.5 + 0.5 * ((waveA * 0.65 + waveB * 0.35));
    const barH = live ? 34 + norm * 168 : 18 + norm * 52;
    const x = startX + i * (barWidth + gap);
    const y = 374 - barH;
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(x, y, barWidth, barH);
  }

  // Dual glowing sine waves across middle
  const drawWave = (color: string, freq: number, amp: number, speed: number, yBase: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = live ? 6 : 3;
    ctx.beginPath();
    for (let x = 36; x <= w - 36; x += 14) {
      const y = yBase + Math.sin(x * freq + elapsed * speed) * amp * Math.sin((x / w) * Math.PI);
      if (x === 36) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawWave('#22d3ee', 0.02, live ? 44 : 16, live ? 6.5 : 2.2, 200);
  drawWave('#f472b6', 0.027, live ? 36 : 12, live ? -5.0 : -1.8, 212);

  // Ticker bar at very bottom
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(24, 384, w - 48, 36);
  ctx.fillStyle = '#67e8f9';
  ctx.font = '700 18px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    live
      ? 'SIARAN LANGSUNG RADIO & PODCAST  ★  SUARAKAN PERUBAHAN DEMI BUMI HIJAU  ★  ECOWORLD 3D'
      : 'SEDIA UNTUK SIARAN LANGSUNG  •  KEMPEN DIGITAL SELAMATKAN ECOWORLD',
    w / 2,
    403
  );
}

function drawMixerMonitorCanvas(ctx: CanvasRenderingContext2D, elapsed: number, live: boolean) {
  ctx.fillStyle = '#091532';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 244);

  ctx.fillStyle = '#facc15';
  ctx.font = '800 20px "Orbitron", sans-serif';
  ctx.fillText(live ? 'AUDIO MIX • LIVE TX' : 'AUDIO MIX • STANDBY', 22, 34);

  // VU meter channels
  const chPalette = ['#34d399', '#22d3ee', '#a855f7', '#ec4899', '#f97316', '#facc15'];
  for (let c = 0; c < 12; c++) {
    const level = live
      ? 0.35 + 0.62 * (0.5 + 0.5 * Math.sin(elapsed * 7.5 + c * 0.9))
      : 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 2.2 + c));
    const bars = Math.round(level * 10);
    for (let b = 0; b < bars; b++) {
      ctx.fillStyle = b > 7 ? '#ec4899' : b > 5 ? '#facc15' : chPalette[c % chPalette.length];
      ctx.fillRect(22 + c * 39, 218 - b * 16, 26, 11);
    }
  }
}

function buildModernPodcastChair(accentHex: number, isHost: boolean): THREE.Group {
  const chair = new THREE.Group();

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    metalness: 0.85,
    roughness: 0.18,
  });
  const velvetMat = new THREE.MeshStandardMaterial({
    color: isHost ? 0x312e81 : 0x1e293b,
    roughness: 0.62,
    metalness: 0.12,
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: isHost ? 0x3b2c85 : 0x26324d,
    roughness: 0.58,
    metalness: 0.1,
  });
  const neonTrimMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });

  // 5-Star Swivel Pedestal Base (keeps clear at floor y=0)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.34, 14), chromeMat);
  stem.position.y = 0.19;
  chair.add(stem);

  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.36), chromeMat);
    const angle = (i / 5) * Math.PI * 2;
    leg.position.set(Math.sin(angle) * 0.18, 0.04, Math.cos(angle) * 0.18);
    leg.rotation.y = angle;
    chair.add(leg);
  }

  // Seat Cushion -> TOP IS EXACTLY AT local y = 0.45 for flush seated agent alignment!
  const seatPan = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.72), cushionMat);
  seatPan.position.set(0, 0.38, 0.03);
  seatPan.castShadow = true;
  seatPan.receiveShadow = true;
  chair.add(seatPan);

  // Under-seat glowing RGB neon collar
  const seatGlow = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.035, 0.75), neonTrimMat);
  seatGlow.position.set(0, 0.31, 0.03);
  chair.add(seatGlow);

  // Plush Backrest (positioned slightly back at z = -0.32 so seated torso sits naturally)
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.68, 0.15), velvetMat);
  backrest.position.set(0, 0.76, -0.30);
  backrest.rotation.x = -0.10;
  backrest.castShadow = true;
  chair.add(backrest);

  // Backrest glowing accent stripe
  const backStrip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.055, 0.04), neonTrimMat);
  backStrip.position.set(0, 0.94, -0.38);
  backStrip.rotation.x = -0.10;
  chair.add(backStrip);

  // Armrests (left & right)
  [-0.37, 0.37].forEach((ax) => {
    const armSupport = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.46), velvetMat);
    armSupport.position.set(ax, 0.52, -0.02);
    chair.add(armSupport);

    const armTop = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.52), cushionMat);
    armTop.position.set(ax, 0.64, -0.01);
    chair.add(armTop);
  });

  return chair;
}

function buildBoomMicrophone(accentHex: number): THREE.Group {
  const micGroup = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.28 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.95,
  });

  // Desk clamp base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.05, 12), metalMat);
  base.position.y = 0.025;
  micGroup.add(base);

  // Articulated lower arm
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 8), metalMat);
  arm1.position.set(0, 0.22, -0.04);
  arm1.rotation.x = -0.22;
  micGroup.add(arm1);

  // Upper boom arm angled forward toward speaker
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), metalMat);
  arm2.position.set(0, 0.44, 0.06);
  arm2.rotation.x = 0.85;
  micGroup.add(arm2);

  // Condenser mic capsule + LED ring
  const micBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.14, 14), metalMat);
  micBody.position.set(0, 0.50, 0.22);
  micBody.rotation.x = Math.PI / 2.6;
  micGroup.add(micBody);

  const micGlow = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.009, 8, 20), glowMat);
  micGlow.position.set(0, 0.52, 0.26);
  micGlow.rotation.x = Math.PI / 2.6;
  micGroup.add(micGlow);

  // Foam windscreen
  const wind = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 })
  );
  wind.position.set(0, 0.54, 0.29);
  micGroup.add(wind);

  return micGroup;
}

function buildStudioHeadphones(accentHex: number): THREE.Group {
  const hp = new THREE.Group();
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.55, roughness: 0.35 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.9,
  });

  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 8, 20, Math.PI), bandMat);
  headband.rotation.z = Math.PI / 2;
  headband.rotation.x = Math.PI / 2;
  headband.position.y = 0.04;
  hp.add(headband);

  [-0.11, 0.11].forEach((x) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 14), bandMat);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(x, 0.03, 0);
    hp.add(cup);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 18), glowMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x > 0 ? x + 0.022 : x - 0.022, 0.03, 0);
    hp.add(ring);
  });

  return hp;
}

export function buildPodcastStudioRoom(
  maxAnisotropy: number,
  initialAvatarId: AvatarId = 'bayu'
): PodcastStudioRoomHandle {
  const group = new THREE.Group();
  const texturesToDispose: THREE.Texture[] = [];

  // =========================================================================
  // 1. VIBRANT RGB STUDIO LIGHTING (Purple, Cyan, Pink, Orange, Turquoise)
  // =========================================================================
  const studioAmb = new THREE.HemisphereLight(0xa5f3fc, 0x3b0764, 1.15);
  group.add(studioAmb);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(4, 9.5, 7);
  group.add(keyLight);

  const purpleLight = new THREE.PointLight(0xa855f7, 26, 26);
  purpleLight.position.set(-5.8, 5.2, -3.5);
  const cyanLight = new THREE.PointLight(0x22d3ee, 28, 26);
  cyanLight.position.set(5.6, 5.2, -2.5);
  const pinkLight = new THREE.PointLight(0xec4899, 22, 24);
  pinkLight.position.set(-4.2, 4.4, 3.8);
  const orangeLight = new THREE.PointLight(0xf97316, 20, 22);
  orangeLight.position.set(4.5, 4.2, 4.2);
  const stageTopLight = new THREE.PointLight(0xfacc15, 12, 16);
  stageTopLight.position.set(0, 5.6, -1.0);
  group.add(purpleLight, cyanLight, pinkLight, orangeLight, stageTopLight);

  // =========================================================================
  // 2. STUDIO ARCHITECTURE: REFLECTIVE FLOOR, ACOUSTIC WALLS, NEON CEILING
  // =========================================================================
  const floorTex = createStudioFloorTexture(maxAnisotropy);
  texturesToDispose.push(floorTex);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(23, 17),
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.16,
      metalness: 0.42,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Glowing perimeter & pathway floor neon trim strips
  const floorTrimSpecs: [number, number, number, number, number, number][] = [
    [0, 0.015, -7.45, 22.0, 0.11, 0x22d3ee],
    [0, 0.015, 7.6, 22.0, 0.11, 0xec4899],
    [-10.8, 0.015, 0, 0.11, 15.2, 0xa855f7],
    [10.8, 0.015, 0, 0.11, 15.2, 0xf97316],
  ];
  floorTrimSpecs.forEach(([x, y, z, w, d, hex]) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.025, d),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.0 })
    );
    strip.position.set(x, y, z);
    group.add(strip);
  });

  // Rich Deep Indigo Acoustic Studio Walls (Back + Left + Right)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x161f47,
    roughness: 0.55,
    metalness: 0.18,
  });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(22.4, 8.2, 0.35), wallMat);
  backWall.position.set(0, 4.1, -7.7);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.2, 16.2), wallMat);
  leftWall.position.set(-11.0, 4.1, 0.2);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.2, 16.2), wallMat);
  rightWall.position.set(11.0, 4.1, 0.2);
  group.add(backWall, leftWall, rightWall);

  // Futuristic Acoustic Slats along left & right walls
  const slatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.3 });
  for (let i = 0; i < 12; i++) {
    const zPos = -6.6 + i * 1.15;
    if (zPos < 2.2) {
      const sL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 6.2, 0.26), slatMat);
      sL.position.set(-10.75, 3.3, zPos);
      group.add(sL);
    }
    const sR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 6.2, 0.26), slatMat);
    sR.position.set(10.75, 3.3, zPos);
    group.add(sR);
  }

  // Vibrant RGB Light Tiles inspired by Reference Image Panel 4 (Purple, Orange, Gold, Cyan, Pink, Turquoise)
  const rgbTilePalette = [0xa855f7, 0xf97316, 0xfacc15, 0x22d3ee, 0x2dd4bf, 0xec4899, 0x3b82f6, 0x34d399];
  const rgbTiles: { mat: THREE.MeshStandardMaterial; phase: number; baseHueIdx: number }[] = [];
  const tileGeo = new THREE.BoxGeometry(0.78, 0.78, 0.08);

  // Left & Right Columns flanking giant LED screen on back wall
  const tileWallPositions: [number, number, number, number][] = [];
  [-8.8, -7.75, -6.7, -5.65, 5.65, 6.7, 7.75, 8.8].forEach((tx, colIdx) => {
    for (let row = 0; row < 4; row++) {
      tileWallPositions.push([tx, 1.45 + row * 1.05, -7.46, colIdx * 2 + row]);
    }
  });
  tileWallPositions.forEach(([tx, ty, tz, idx]) => {
    const colorHex = rgbTilePalette[idx % rgbTilePalette.length];
    const tMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.1,
    });
    const tile = new THREE.Mesh(tileGeo, tMat);
    tile.position.set(tx, ty, tz);
    group.add(tile);
    rgbTiles.push({ mat: tMat, phase: idx * 0.45, baseHueIdx: idx % rgbTilePalette.length });
  });

  // Neon Ceiling Beams & Overhead Truss
  const ceilingGroup = new THREE.Group();
  const beamStrips: [number, number, number, number, number, number][] = [
    [0, 6.95, -5.5, 20.5, 0.14, 0x22d3ee],
    [0, 6.95, -1.2, 20.5, 0.14, 0xec4899],
    [0, 6.95, 3.2, 20.5, 0.14, 0xa855f7],
  ];
  beamStrips.forEach(([x, y, z, w, d, hex]) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.1, d),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.1 })
    );
    strip.position.set(x, y, z);
    ceilingGroup.add(strip);
  });
  group.add(ceilingGroup);

  // =========================================================================
  // 3. FUTURISTIC STUDIO ENTRANCE DOOR (LEFT PORTAL WITH SLIDING DOORS)
  // =========================================================================
  const doorGroup = new THREE.Group();
  doorGroup.position.set(-8.6, 0, 4.4);
  doorGroup.rotation.y = 0.68;
  group.add(doorGroup);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.22 });
  const portalCyanMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.1,
  });

  // Left/Right pillars & top header arch
  [-1.15, 1.15].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.25, 0.36), frameMat);
    pillar.position.set(px, 1.625, 0);
    doorGroup.add(pillar);

    const pGlow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.0, 0.40), portalCyanMat);
    pGlow.position.set(px > 0 ? px - 0.13 : px + 0.13, 1.625, 0);
    doorGroup.add(pGlow);
  });

  const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.42, 0.42), frameMat);
  doorHeader.position.set(0, 3.38, 0);
  doorGroup.add(doorHeader);

  const headerSignTex = createNeonSignTexture(
    'STUDIO',
    'PINTU MASUK PENYIAR',
    '#0f172a',
    '#22d3ee',
    '#22d3ee',
    maxAnisotropy
  );
  texturesToDispose.push(headerSignTex);
  const doorHeaderSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.34),
    new THREE.MeshBasicMaterial({ map: headerSignTex })
  );
  doorHeaderSign.position.set(0, 3.38, 0.22);
  doorGroup.add(doorHeaderSign);

  // Sliding Glass/Metal Doors
  const doorLeafMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    metalness: 0.35,
    transparent: true,
    opacity: 0.78,
  });
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.05, 0.09), doorLeafMat);
  leftDoor.position.set(-0.5, 1.525, 0);
  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.05, 0.09), doorLeafMat);
  rightDoor.position.set(0.5, 1.525, 0);
  doorGroup.add(leftDoor, rightDoor);

  // Glowing threshold step
  const doorThreshold = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.04, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.75 })
  );
  doorThreshold.position.set(0, 0.02, 0.2);
  doorGroup.add(doorThreshold);

  // =========================================================================
  // 4. MINI PODCAST STAGE (SLIGHTLY RAISED, SPACIOUS WALKING PERIMETER)
  // =========================================================================
  const stageGroup = new THREE.Group();
  stageGroup.position.set(0, 0, -1.25);
  group.add(stageGroup);

  const stageDeckMat = new THREE.MeshStandardMaterial({
    color: 0x1e294f,
    metalness: 0.45,
    roughness: 0.24,
  });
  const stageDeck = new THREE.Mesh(new THREE.CylinderGeometry(3.85, 4.15, 0.28, 36), stageDeckMat);
  stageDeck.position.y = 0.14;
  stageDeck.receiveShadow = true;
  stageGroup.add(stageDeck);

  // Vibrant RGB Rim Rings around stage edge
  const stageRimTop = new THREE.Mesh(
    new THREE.TorusGeometry(3.88, 0.05, 12, 64),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.15 })
  );
  stageRimTop.rotation.x = Math.PI / 2;
  stageRimTop.position.y = 0.27;
  stageGroup.add(stageRimTop);

  const stageRimBase = new THREE.Mesh(
    new THREE.TorusGeometry(4.16, 0.045, 12, 64),
    new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 1.0 })
  );
  stageRimBase.rotation.x = Math.PI / 2;
  stageRimBase.position.y = 0.03;
  stageGroup.add(stageRimBase);

  // Acoustic circular stage rug
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(2.95, 2.95, 0.025, 36),
    new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.85 })
  );
  rug.position.y = 0.285;
  stageGroup.add(rug);

  // Low Step Riser on Front-Left Approach for Agent Entry
  const stageStep = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.14, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.3 })
  );
  stageStep.position.set(-2.3, 0.07, 3.45);
  stageStep.rotation.y = -0.52;
  stageGroup.add(stageStep);

  // =========================================================================
  // 5. FOUR MODERN ARMCHAIRS (1 HOST + 3 GUESTS), ROUND TABLE, MICS & HEADPHONES
  // =========================================================================
  // Seat cushion top sits at local y = 0.45 above stage deck (world y = 0.73)
  const hostChair = buildModernPodcastChair(0x22d3ee, true);
  hostChair.position.set(-1.55, 0.28, -1.25);
  hostChair.rotation.y = 0.42;

  const guestChair1 = buildModernPodcastChair(0xec4899, false);
  guestChair1.position.set(0.05, 0.28, -1.85);
  guestChair1.rotation.y = 0.0;

  const guestChair2 = buildModernPodcastChair(0xa855f7, false);
  guestChair2.position.set(1.55, 0.28, -1.25);
  guestChair2.rotation.y = -0.42;

  const guestChair3 = buildModernPodcastChair(0xf97316, false);
  guestChair3.position.set(2.35, 0.28, 0.15);
  guestChair3.rotation.y = -1.15;

  group.add(hostChair, guestChair1, guestChair2, guestChair3);

  // Small Round Podcast Table in center of stage seating
  const roundTable = new THREE.Group();
  roundTable.position.set(0.0, 0.28, -0.32);
  group.add(roundTable);

  const tableBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 })
  );
  tableBase.position.y = 0.025;
  const tablePedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.56, 16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.25 })
  );
  tablePedestal.position.y = 0.32;
  const tableTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.66, 0.06, 32),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.55 })
  );
  tableTop.position.y = 0.62;
  const tableNeonRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.018, 10, 36),
    new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 1.0 })
  );
  tableNeonRim.rotation.x = Math.PI / 2;
  tableNeonRim.position.y = 0.62;
  roundTable.add(tableBase, tablePedestal, tableTop, tableNeonRim);

  // Studio Headphones & Coffee Mugs / Script Pad on table
  const hostHeadphones = buildStudioHeadphones(0x22d3ee);
  hostHeadphones.position.set(-0.34, 0.66, -0.18);
  hostHeadphones.rotation.y = 0.5;
  const guestHeadphones = buildStudioHeadphones(0xec4899);
  guestHeadphones.position.set(0.32, 0.66, -0.18);
  guestHeadphones.rotation.y = -0.6;
  roundTable.add(hostHeadphones, guestHeadphones);

  const scriptPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.015, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
  );
  scriptPad.position.set(-0.22, 0.66, 0.18);
  scriptPad.rotation.y = 0.32;
  roundTable.add(scriptPad);

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.095, 14),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 })
  );
  mug.position.set(0.18, 0.70, 0.22);
  roundTable.add(mug);

  // 3 Boom-Arm Condenser Microphones aimed at Host & Guest Chairs
  const hostMic = buildBoomMicrophone(0x22d3ee);
  hostMic.position.set(-0.46, 0.65, -0.34);
  hostMic.rotation.y = -2.25;

  const guestMic1 = buildBoomMicrophone(0xfacc15);
  guestMic1.position.set(0.04, 0.65, -0.44);
  guestMic1.rotation.y = Math.PI;

  const guestMic2 = buildBoomMicrophone(0xec4899);
  guestMic2.position.set(0.45, 0.65, -0.26);
  guestMic2.rotation.y = 2.15;

  roundTable.add(hostMic, guestMic1, guestMic2);

  // Dedicated Host Floor-Stand Boom Mic positioned gracefully near Host Chair
  const hostStandMic = new THREE.Group();
  hostStandMic.position.set(-0.98, 0.28, -0.72);
  const hPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 0.92, 10),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 })
  );
  hPole.position.y = 0.46;
  const hBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.03, 18),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 })
  );
  hBase.position.y = 0.015;
  const hBoom = buildBoomMicrophone(0x34d399);
  hBoom.position.y = 0.72;
  hBoom.rotation.y = -2.65;
  hostStandMic.add(hPole, hBase, hBoom);
  group.add(hostStandMic);

  // =========================================================================
  // 6. AUDIO MIXING CONSOLE DESK & REFERENCE SPEAKERS (RIGHT FRONT ZONE)
  // =========================================================================
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(6.0, 0, 2.0);
  consoleGroup.rotation.y = -0.62;
  group.add(consoleGroup);

  const deskMat = new THREE.MeshStandardMaterial({ color: 0x172554, metalness: 0.6, roughness: 0.25 });
  const deskBody = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.92, 1.15), deskMat);
  deskBody.position.y = 0.46;
  consoleGroup.add(deskBody);

  const deskRim = new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 0.06, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.95 })
  );
  deskRim.position.y = 0.93;
  consoleGroup.add(deskRim);

  // Sloped Mixing Console Deck + Animated Fader Knobs
  const mixerDeck = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.08, 0.68),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.28 })
  );
  mixerDeck.position.set(-0.25, 1.0, 0.08);
  mixerDeck.rotation.x = 0.14;
  consoleGroup.add(mixerDeck);

  const faders: { mesh: THREE.Mesh; baseZ: number; phase: number }[] = [];
  const faderColors = [0x22d3ee, 0xec4899, 0xfacc15, 0x34d399, 0xa855f7, 0xf97316, 0x3b82f6, 0x2dd4bf];
  for (let i = 0; i < 8; i++) {
    const fMat = new THREE.MeshStandardMaterial({
      color: faderColors[i],
      emissive: faderColors[i],
      emissiveIntensity: 0.85,
    });
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.09), fMat);
    knob.position.set(-0.85 + i * 0.17, 1.06, 0.08);
    consoleGroup.add(knob);
    faders.push({ mesh: knob, baseZ: 0.08, phase: i * 0.75 });
  }

  // Animated Console Monitor Screen
  const mixerCanvas = document.createElement('canvas');
  mixerCanvas.width = 512;
  mixerCanvas.height = 256;
  const mixerCtx = mixerCanvas.getContext('2d')!;
  drawMixerMonitorCanvas(mixerCtx, 0, false);
  const mixerTex = new THREE.CanvasTexture(mixerCanvas);
  mixerTex.colorSpace = THREE.SRGBColorSpace;
  mixerTex.anisotropy = maxAnisotropy;
  texturesToDispose.push(mixerTex);

  const mixerScreenFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.76, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
  );
  mixerScreenFrame.position.set(0.65, 1.38, -0.25);
  mixerScreenFrame.rotation.y = -0.22;
  consoleGroup.add(mixerScreenFrame);

  const mixerScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.32, 0.66),
    new THREE.MeshBasicMaterial({ map: mixerTex })
  );
  mixerScreen.position.set(0, 0, 0.04);
  mixerScreenFrame.add(mixerScreen);

  // Dual Studio Monitor Speakers flanking desk & back stage
  const buildSpeaker = (x: number, y: number, z: number, rotY: number) => {
    const sp = new THREE.Group();
    sp.position.set(x, y, z);
    sp.rotation.y = rotY;
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.14, 1.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 })
    );
    stand.position.y = 0.525;
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.76, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 })
    );
    cab.position.y = 1.42;
    const woofer = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.9 })
    );
    woofer.position.set(0, 1.32, 0.23);
    const tweeter = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.015, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.9 })
    );
    tweeter.position.set(0, 1.62, 0.23);
    sp.add(stand, cab, woofer, tweeter);
    return { group: sp, woofer };
  };
  const speakerL = buildSpeaker(-5.1, 0, -4.8, 0.42);
  const speakerR = buildSpeaker(5.1, 0, -4.8, -0.42);
  const speakerDesk = buildSpeaker(7.9, 0, 0.8, -0.82);
  group.add(speakerL.group, speakerR.group, speakerDesk.group);

  // =========================================================================
  // 7. GIANT ANIMATED BACK LED SCREEN + "ON AIR" & "RADIO LIVE" NEON SIGNS
  // =========================================================================
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 1024;
  ledCanvas.height = 440;
  const ledCtx = ledCanvas.getContext('2d')!;
  drawBackLedCanvas(ledCtx, 0, false, false);
  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  ledTex.anisotropy = maxAnisotropy;
  texturesToDispose.push(ledTex);

  const ledBacking = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 3.6, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
  );
  ledBacking.position.set(0, 3.25, -7.25);
  group.add(ledBacking);

  const ledBorder = new THREE.Mesh(
    new THREE.BoxGeometry(8.36, 3.76, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.9 })
  );
  ledBorder.position.set(0, 3.25, -7.29);
  group.add(ledBorder);

  const ledPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(7.85, 3.32),
    new THREE.MeshBasicMaterial({ map: ledTex })
  );
  ledPlane.position.set(0, 3.25, -7.11);
  group.add(ledPlane);

  // "ON AIR" Neon Sign above Giant LED Screen (Dim standby -> Bright Hot Pink/Orange in Fasa 5)
  const onAirTex = createNeonSignTexture(
    'ON AIR',
    'LIVE BROADCAST • ECOWORLD',
    '#2a0924',
    '#ff4da6',
    '#ec4899',
    maxAnisotropy
  );
  texturesToDispose.push(onAirTex);

  const onAirMat = new THREE.MeshStandardMaterial({
    map: onAirTex,
    emissiveMap: onAirTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.18,
    roughness: 0.2,
  });
  const onAirFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.92, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 })
  );
  onAirFrame.position.set(0, 5.75, -7.12);
  const onAirFace = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 0.78), onAirMat);
  onAirFace.position.z = 0.09;
  onAirFrame.add(onAirFace);
  group.add(onAirFrame);

  // "RADIO LIVE" Neon Sign on Right Acoustic Wall
  const radioTex = createNeonSignTexture(
    'RADIO',
    'STUDIO PENYIARAN BELIA',
    '#141240',
    '#22d3ee',
    '#22d3ee',
    maxAnisotropy
  );
  texturesToDispose.push(radioTex);
  const radioMat = new THREE.MeshStandardMaterial({
    map: radioTex,
    emissiveMap: radioTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.35,
  });
  const radioFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.88, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
  );
  radioFrame.position.set(7.9, 4.65, -4.8);
  radioFrame.rotation.y = -0.68;
  const radioFace = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.74), radioMat);
  radioFace.position.z = 0.09;
  radioFrame.add(radioFace);
  group.add(radioFrame);

  // =========================================================================
  // 8. SWEEPING STAGE SPOTLIGHT CONES + AMBIENT FLOATING PARTICLES
  // =========================================================================
  const spotCones: { group: THREE.Group; mat: THREE.MeshBasicMaterial; baseRotZ: number; phase: number }[] = [];
  const spotConfigs: [number, number, number, number, number][] = [
    [-2.4, 6.75, -0.8, 0x22d3ee, -0.25],
    [0.0, 6.75, -1.6, 0xfacc15, 0.0],
    [2.4, 6.75, -0.8, 0xec4899, 0.25],
    [-4.2, 6.75, 1.4, 0xa855f7, -0.38],
  ];
  spotConfigs.forEach(([x, y, z, hex, rotZ], idx) => {
    const sg = new THREE.Group();
    sg.position.set(x, y, z);
    sg.rotation.z = rotZ;

    const fixture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 })
    );
    sg.add(fixture);

    const coneMat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.55, 6.2, 20, 1, true), coneMat);
    cone.position.y = -3.1;
    sg.add(cone);

    group.add(sg);
    spotCones.push({ group: sg, mat: coneMat, baseRotZ: rotZ, phase: idx * 1.1 });
  });

  // Subtle Floating Neon Light Motes
  const particleCount = 36;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.sin(i * 4.7) * 0.5) * 18;
    particlePositions[i * 3 + 1] = 0.8 + ((i * 0.43) % 5.2);
    particlePositions[i * 3 + 2] = (Math.cos(i * 3.1) * 0.5) * 12;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x67e8f9,
    size: 0.11,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  // =========================================================================
  // 9. AGENT RIG INSIDE THE PODCAST STUDIO (WALK -> STEP STAGE -> SIT ON HOST CHAIR)
  // =========================================================================
  const contactShadowTex = createContactShadowTexture();
  texturesToDispose.push(contactShadowTex);

  let currentAvatarId: AvatarId = initialAvatarId;
  let agentRig: HumanAgentRig = buildHumanEcoAgent(currentAvatarId, contactShadowTex, {
    maxAnisotropy,
    showPedestal: false,
  });
  group.add(agentRig.group);

  const DOOR_START = new THREE.Vector3(-9.5, 0, 5.05);
  const MID_STUDIO = new THREE.Vector3(-4.2, 0, 2.05);
  const STAGE_FRONT = new THREE.Vector3(-1.22, 0.28, -0.52);
  const HOST_SEAT = new THREE.Vector3(-1.52, 0.28, -1.18);
  const HOST_FACING_ROT = 0.42;

  let introElapsed = 0;
  let introDone = false;
  let currentPhase: M5IntroPhase = 1;
  let camSnappedToStart = false;
  let lastCanvasDrawTime = -1;

  // Initialize agent at entrance outside portal
  agentRig.group.position.copy(DOOR_START);
  agentRig.group.rotation.y = Math.atan2(MID_STUDIO.x - DOOR_START.x, MID_STUDIO.z - DOOR_START.z);

  const resetIntro = () => {
    introElapsed = 0;
    introDone = false;
    currentPhase = 1;
    camSnappedToStart = false;
    agentRig.group.position.copy(DOOR_START);
    agentRig.group.rotation.y = Math.atan2(MID_STUDIO.x - DOOR_START.x, MID_STUDIO.z - DOOR_START.z);
    leftDoor.position.x = -0.5;
    rightDoor.position.x = 0.5;
  };

  const skipIntro = () => {
    introElapsed = 10.2;
    introDone = true;
    currentPhase = 5;
    camSnappedToStart = true;
    agentRig.group.position.copy(HOST_SEAT);
    agentRig.group.rotation.y = HOST_FACING_ROT;
    leftDoor.position.x = -1.45;
    rightDoor.position.x = 1.45;
  };

  const setAvatarId = (nextId: AvatarId) => {
    if (nextId === currentAvatarId) return;
    currentAvatarId = nextId;
    const savedPos = agentRig.group.position.clone();
    const savedRot = agentRig.group.rotation.y;
    group.remove(agentRig.group);
    agentRig = buildHumanEcoAgent(nextId, contactShadowTex, {
      maxAnisotropy,
      showPedestal: false,
    });
    agentRig.group.position.copy(savedPos);
    agentRig.group.rotation.y = savedRot;
    group.add(agentRig.group);
  };

  // Choreography timeline (9.8s total across 5 crisp phases):
  // Phase 1 [0.0 -> 2.2s]: Studio Intro sweep
  // Phase 2 [2.2 -> 4.4s]: Portal opens & agent walks into studio
  // Phase 3 [4.4 -> 6.6s]: Agent steps onto mini stage & stops before host chair
  // Phase 4 [6.6 -> 8.1s]: Agent sits down smoothly onto host chair
  // Phase 5 [8.1 -> 9.8s]: LIVE BROADCAST -> ON AIR sign & LED screen ignite -> done!
  const updateChoreography = (elapsed: number, dt: number, restored: boolean) => {
    introElapsed += dt;
    const t = introElapsed;

    if (t < 2.2) currentPhase = 1;
    else if (t < 4.4) currentPhase = 2;
    else if (t < 6.6) currentPhase = 3;
    else if (t < 8.1) currentPhase = 4;
    else currentPhase = 5;

    if (t >= 9.8) {
      introDone = true;
    }

    // 1) Sliding entrance door animation (opens during Fasa 2, stays subtly open)
    const doorOpen = smoothstep(2.05, 2.95, t);
    leftDoor.position.x = -0.5 - doorOpen * 0.95;
    rightDoor.position.x = 0.5 + doorOpen * 0.95;

    // 2) Agent Position, Facing Rotation & Sit Pose
    let isMoving = false;
    let sitAmount = 0;

    if (t < 2.2) {
      agentRig.group.position.copy(DOOR_START);
      agentRig.group.rotation.y = Math.atan2(MID_STUDIO.x - DOOR_START.x, MID_STUDIO.z - DOOR_START.z);
    } else if (t < 4.4) {
      const p2 = smoothstep(2.2, 4.4, t);
      agentRig.group.position.lerpVectors(DOOR_START, MID_STUDIO, p2);
      const targetRot = Math.atan2(MID_STUDIO.x - DOOR_START.x, MID_STUDIO.z - DOOR_START.z);
      agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, targetRot, 9, dt);
      isMoving = p2 < 0.98;
    } else if (t < 6.6) {
      const p3 = smoothstep(4.4, 6.6, t);
      agentRig.group.position.x = THREE.MathUtils.lerp(MID_STUDIO.x, STAGE_FRONT.x, p3);
      agentRig.group.position.z = THREE.MathUtils.lerp(MID_STUDIO.z, STAGE_FRONT.z, p3);
      // Smooth step-up onto stage deck as agent crosses stage rim
      const stepFactor = smoothstep(0.42, 0.72, p3);
      agentRig.group.position.y = stepFactor * 0.28;
      const targetRot = Math.atan2(STAGE_FRONT.x - MID_STUDIO.x, STAGE_FRONT.z - MID_STUDIO.z);
      agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, targetRot, 9, dt);
      isMoving = p3 < 0.96;
    } else if (t < 8.1) {
      const p4 = smoothstep(6.6, 8.1, t);
      // Turn to face camera/mic first, step back onto cushion center, bend hips/knees
      agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, HOST_FACING_ROT, 7.5, dt);
      const seatMove = smoothstep(0.18, 0.85, p4);
      agentRig.group.position.lerpVectors(STAGE_FRONT, HOST_SEAT, seatMove);
      sitAmount = smoothstep(0.25, 0.96, p4);
      isMoving = false;
    } else {
      agentRig.group.position.copy(HOST_SEAT);
      agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, HOST_FACING_ROT, 8, dt);
      sitAmount = 1;
      isMoving = false;
    }

    animateHumanAgent(agentRig, elapsed, dt, {
      isMoving,
      selected: sitAmount > 0.5,
      sitAmount,
    });

    // 3) Live Broadcast Activation in Fasa 5
    const liveActive = t >= 8.1;
    const liveRamp = smoothstep(8.1, 9.1, t);

    // ON AIR & RADIO LIVE glow surge
    onAirMat.emissiveIntensity = liveActive ? 0.5 + liveRamp * 1.45 + Math.sin(elapsed * 5.0) * 0.2 : 0.16;
    radioMat.emissiveIntensity = liveActive ? 0.45 + liveRamp * 0.95 : 0.3;

    // Stage spotlights ramp up sequentially in Fasa 5 & sweep smoothly
    spotCones.forEach((sc, idx) => {
      const seqStart = 8.1 + idx * 0.22;
      const seqRamp = smoothstep(seqStart, seqStart + 0.55, t);
      sc.mat.opacity = 0.05 + seqRamp * 0.14 + Math.sin(elapsed * 2.2 + sc.phase) * 0.015;
      sc.group.rotation.z = sc.baseRotZ + Math.sin(elapsed * 0.85 + sc.phase) * 0.14;
      sc.group.rotation.x = Math.cos(elapsed * 0.7 + sc.phase) * 0.08;
    });

    stageTopLight.intensity = 10 + liveRamp * 20;

    // 4) Dynamic RGB ambient cycling across room
    const cycle = elapsed * 0.35;
    _tmpColor.setHSL((0.77 + Math.sin(cycle) * 0.08) % 1, 0.88, 0.58);
    purpleLight.color.copy(_tmpColor);
    _tmpColor.setHSL((0.52 + Math.cos(cycle * 0.8) * 0.07) % 1, 0.92, 0.56);
    cyanLight.color.copy(_tmpColor);
    pinkLight.intensity = 18 + Math.sin(elapsed * 2.1) * 4 + liveRamp * 8;
    orangeLight.intensity = 17 + Math.cos(elapsed * 1.9) * 4 + liveRamp * 6;

    // 5) Wall RGB tiles gentle ripple pulse
    rgbTiles.forEach((rt) => {
      rt.mat.emissiveIntensity = (liveActive ? 0.75 : 0.45) + Math.sin(elapsed * 2.8 + rt.phase) * 0.25;
    });

    // 6) Mixing console animated fader sliders & speaker woofer bounce
    faders.forEach((f) => {
      const amp = liveActive ? 0.15 : 0.04;
      f.mesh.position.z = f.baseZ + Math.sin(elapsed * (liveActive ? 4.2 : 1.4) + f.phase) * amp;
    });
    const pulseScale = 1 + (liveActive ? Math.abs(Math.sin(elapsed * 6.5)) * 0.07 : 0.015);
    speakerL.woofer.scale.setScalar(pulseScale);
    speakerR.woofer.scale.setScalar(pulseScale);
    speakerDesk.woofer.scale.setScalar(pulseScale);

    // 7) Subtle floating neon dust drift
    particles.rotation.y = elapsed * 0.04;

    // 8) Update Dynamic CanvasTextures (Giant LED Screen & Mixer Monitor) throttled cleanly (~20fps)
    if (elapsed - lastCanvasDrawTime >= 0.05) {
      lastCanvasDrawTime = elapsed;
      drawBackLedCanvas(ledCtx, elapsed, liveActive, restored);
      ledTex.needsUpdate = true;

      drawMixerMonitorCanvas(mixerCtx, elapsed, liveActive);
      mixerTex.needsUpdate = true;
    }
  };

  const updateIntroCamera = (
    camera: THREE.PerspectiveCamera,
    target: THREE.Vector3,
    dt: number,
    userOrbiting: boolean
  ): PodcastIntroStatus => {
    const t = introElapsed;

    if (!camSnappedToStart && !introDone) {
      camera.position.set(7.4, 4.5, 7.8);
      target.set(0, 1.8, -1.6);
      camSnappedToStart = true;
    }

    if (!userOrbiting && !introDone) {
      if (t < 2.2) {
        // Phase 1: Studio Intro Sweep (showcases stage, armchairs, mics, LED wall & portal)
        const p1 = smoothstep(0.0, 2.2, t);
        _tmpCamPos.set(
          THREE.MathUtils.lerp(7.4, -2.8, p1),
          THREE.MathUtils.lerp(4.5, 3.6, p1),
          THREE.MathUtils.lerp(7.8, 7.6, p1)
        );
        _tmpCamTgt.set(
          THREE.MathUtils.lerp(0.2, -3.5, p1),
          THREE.MathUtils.lerp(1.9, 1.8, p1),
          THREE.MathUtils.lerp(-1.6, 1.2, p1)
        );
      } else if (t < 4.4) {
        // Phase 2: Third-person follow as agent exits sliding door into studio
        const ax = agentRig.group.position.x;
        const az = agentRig.group.position.z;
        _tmpCamPos.set(ax - 2.6, 3.1, az + 4.3);
        _tmpCamTgt.set(ax + 1.0, 1.35, az - 1.0);
      } else if (t < 6.6) {
        // Phase 3: Smooth angle following agent onto the mini podcast stage
        const ax = agentRig.group.position.x;
        const az = agentRig.group.position.z;
        const p3 = smoothstep(4.4, 6.6, t);
        _tmpCamPos.set(
          THREE.MathUtils.lerp(ax - 2.2, -0.4, p3),
          THREE.MathUtils.lerp(2.9, 2.65, p3),
          THREE.MathUtils.lerp(az + 4.4, 4.8, p3)
        );
        _tmpCamTgt.set(
          THREE.MathUtils.lerp(ax, -0.6, p3),
          1.38,
          THREE.MathUtils.lerp(az, -0.9, p3)
        );
      } else if (t < 8.1) {
        // Phase 4: Smoothly move toward front of stage as agent sits in Host Chair
        const p4 = smoothstep(6.6, 8.1, t);
        _tmpCamPos.set(
          THREE.MathUtils.lerp(-0.4, 0.75, p4),
          THREE.MathUtils.lerp(2.65, 2.38, p4),
          THREE.MathUtils.lerp(4.8, 5.45, p4)
        );
        _tmpCamTgt.set(
          THREE.MathUtils.lerp(-0.6, -0.25, p4),
          THREE.MathUtils.lerp(1.38, 1.35, p4),
          THREE.MathUtils.lerp(-0.9, -1.15, p4)
        );
      } else {
        // Phase 5: Pull slightly back to showcase ON AIR sign, Giant LED screen & seated host
        const p5 = smoothstep(8.1, 9.8, t);
        _tmpCamPos.set(
          THREE.MathUtils.lerp(0.75, 0.55, p5),
          THREE.MathUtils.lerp(2.38, 2.85, p5),
          THREE.MathUtils.lerp(5.45, 7.2, p5)
        );
        _tmpCamTgt.set(
          THREE.MathUtils.lerp(-0.25, 0.1, p5),
          THREE.MathUtils.lerp(1.35, 1.85, p5),
          THREE.MathUtils.lerp(-1.15, -1.5, p5)
        );
      }

      const dampSpeed = 4.6;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _tmpCamPos.x, dampSpeed, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _tmpCamPos.y, dampSpeed, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _tmpCamPos.z, dampSpeed, dt);
      target.x = THREE.MathUtils.damp(target.x, _tmpCamTgt.x, 5.2, dt);
      target.y = THREE.MathUtils.damp(target.y, _tmpCamTgt.y, 5.2, dt);
      target.z = THREE.MathUtils.damp(target.z, _tmpCamTgt.z, 5.2, dt);
    } else if (!userOrbiting && introDone) {
      // Gentle studio settle shot behind glassmorphic HUD (yields immediately if user orbits!)
      _tmpCamPos.set(0.55, 2.85, 7.2);
      _tmpCamTgt.set(0.1, 1.85, -1.5);
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _tmpCamPos.x, 3.6, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _tmpCamPos.y, 3.6, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _tmpCamPos.z, 3.6, dt);
      target.x = THREE.MathUtils.damp(target.x, _tmpCamTgt.x, 4.0, dt);
      target.y = THREE.MathUtils.damp(target.y, _tmpCamTgt.y, 4.0, dt);
      target.z = THREE.MathUtils.damp(target.z, _tmpCamTgt.z, 4.0, dt);
    }

    return { phase: currentPhase, done: introDone };
  };

  return {
    id: 5,
    group,
    cameraPos: [0.55, 2.85, 7.2],
    cameraTarget: [0.1, 1.85, -1.5],
    bgColor: 0x131b46,
    fogColor: 0x1a1e4d,
    animate: updateChoreography,
    setAvatarId,
    resetIntro,
    skipIntro,
    updateIntroCamera,
    dispose: () => {
      texturesToDispose.forEach((tex) => tex.dispose());
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
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
    },
  };
}
