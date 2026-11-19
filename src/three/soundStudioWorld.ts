import * as THREE from 'three';

export type StudioCameraPreset = 'follow' | 'wide' | 'console';

export interface SoundStudioHandle {
  group: THREE.Group;
  leftDoor: THREE.Group;
  rightDoor: THREE.Group;
  clampPosition: (x: number, z: number) => { x: number; z: number };
  getFloorHeightAt: (x: number, z: number) => number;
  animate: (
    elapsed: number,
    dt: number,
    opts: {
      doorOpen: number;
      audioActive: boolean;
      transferMode: boolean;
    }
  ) => void;
  dispose: () => void;
}

function createStudioFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Sleek reflective indigo-slate metallic floor base (never pitch black)
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
  bgGrad.addColorStop(0, '#0f2042');
  bgGrad.addColorStop(0.5, '#132852');
  bgGrad.addColorStop(1, '#182452');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle metallic tile seams
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Glowing electric cyan & turquoise circuit traces on floor tiles
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.34)';
  ctx.lineWidth = 3;
  for (let i = 64; i < 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
  ctx.lineWidth = 2;
  for (let j = 64; j < 512; j += 128) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(512, j);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createAcousticWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#162347');
  grad.addColorStop(0.55, '#12294d');
  grad.addColorStop(1, '#1a1b4b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Ribbed acoustic studio foam slats
  for (let x = 8; x < 512; x += 24) {
    ctx.fillStyle = x % 48 === 8 ? 'rgba(30, 58, 138, 0.6)' : 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(x, 18, 14, 220);
  }

  // Horizontal neon LED trim lines
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(0, 12, 512, 4);
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(0, 240, 512, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHoloTelemetryTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  secondaryHex: string,
  variant: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(9, 21, 48, 0.92)';
  ctx.fillRect(0, 0, 512, 320);

  // Tech grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 320);
    ctx.stroke();
  }
  for (let y = 0; y <= 320; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Glowing frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 300);

  // Header bar
  const hGrad = ctx.createLinearGradient(10, 10, 502, 62);
  hGrad.addColorStop(0, accentHex);
  hGrad.addColorStop(1, secondaryHex);
  ctx.fillStyle = hGrad;
  ctx.fillRect(10, 10, 492, 52);

  ctx.fillStyle = '#04121d';
  ctx.font = 'bold 23px "Orbitron", sans-serif';
  ctx.fillText(title, 24, 44);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 18px "Chakra Petch", sans-serif';
  ctx.fillText(subtitle, 24, 94);

  if (variant % 2 === 0) {
    // Colorful frequency bars + waveform
    const palette = ['#22d3ee', '#2dd4bf', '#a855f7', '#ec4899', '#34d399', '#fde047'];
    for (let i = 0; i < 18; i++) {
      const barH = 35 + Math.abs(Math.sin(i * 0.75 + variant)) * 120;
      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(28 + i * 25, 285 - barH, 16, barH);
    }
  } else {
    // Concentric radar / voice pitch rings + sine wave
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    for (let r = 24; r <= 72; r += 24) {
      ctx.beginPath();
      ctx.arc(115, 200, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = secondaryHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 215; x <= 480; x += 6) {
      const y = 200 + Math.sin((x - 215) * 0.065 + variant) * 44 * Math.sin(((x - 215) / 265) * Math.PI);
      if (x === 215) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function drawMainWaveformScreen(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  audioActive: boolean,
  transferMode: boolean
): void {
  const w = 1024;
  const h = 440;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#091a3d');
  bg.addColorStop(0.5, '#1a1446');
  bg.addColorStop(1, '#082c46');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle scanlines/grid
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Top Header Strip
  const hdr = ctx.createLinearGradient(24, 18, w - 24, 72);
  hdr.addColorStop(0, transferMode ? '#34d399' : '#22d3ee');
  hdr.addColorStop(0.5, '#a855f7');
  hdr.addColorStop(1, '#ec4899');
  ctx.fillStyle = hdr;
  ctx.fillRect(24, 18, w - 48, 50);

  ctx.fillStyle = '#04101f';
  ctx.font = 'bold 26px "Orbitron", sans-serif';
  ctx.fillText('MAKMAL SUARA ECOWORLD · STUDIO PENYIARAN MASA HADAPAN', 42, 52);

  // Live animated multi-bar spectrum
  const boost = transferMode ? 1.45 : audioActive ? 1.25 : 0.85;
  const barColors = ['#22d3ee', '#2dd4bf', '#34d399', '#a855f7', '#ec4899', '#fde047'];
  const count = 36;
  for (let i = 0; i < count; i++) {
    const wave =
      Math.abs(Math.sin(elapsed * 4.2 + i * 0.42)) * 0.65 +
      Math.abs(Math.cos(elapsed * 2.5 - i * 0.28)) * 0.35;
    const bh = Math.min(185, (28 + wave * 135) * boost);
    ctx.fillStyle = barColors[i % barColors.length];
    ctx.fillRect(42 + i * 26.5, 396 - bh, 17, bh);
  }

  // Triple glowing sine soundwaves across middle
  const waves: { color: string; freq: number; amp: number; speed: number; phase: number }[] = [
    { color: '#22d3ee', freq: 0.022, amp: 46 * boost, speed: 5.2, phase: 0 },
    { color: '#ec4899', freq: 0.031, amp: 34 * boost, speed: -4.1, phase: 1.3 },
    { color: '#fde047', freq: 0.017, amp: 24 * boost, speed: 3.4, phase: 2.6 },
  ];
  waves.forEach((wv) => {
    ctx.strokeStyle = wv.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 36; x <= w - 36; x += 8) {
      const env = Math.sin(((x - 36) / (w - 72)) * Math.PI);
      const y = 185 + Math.sin(x * wv.freq + elapsed * wv.speed + wv.phase) * wv.amp * env;
      if (x === 36) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  // Outer Neon Border
  ctx.strokeStyle = transferMode ? '#34d399' : '#22d3ee';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, w - 24, h - 24);
}

export function buildSoundStudioWorld(
  maxAnisotropy: number,
  isSoftwareGl: boolean
): SoundStudioHandle {
  const group = new THREE.Group();

  // =========================================================================
  // 1. STUDIO FLOOR, NEON WALKWAY STRIPS & WALL ARCHITECTURE
  // =========================================================================
  const floorTex = createStudioFloorTexture(maxAnisotropy);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    metalness: 0.58,
    roughness: 0.24,
  });
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 26), floorMat);
  floorMesh.position.set(0, -0.2, 1.5);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Central illuminated studio circular platform
  const stageDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(6.6, 7.2, 0.14, 48),
    new THREE.MeshStandardMaterial({ color: '#132d56', metalness: 0.65, roughness: 0.2 })
  );
  stageDeck.position.set(0, 0.07, 0.5);
  stageDeck.receiveShadow = true;
  group.add(stageDeck);

  const stageRimMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
  const stageRim = new THREE.Mesh(new THREE.TorusGeometry(6.65, 0.08, 12, 64), stageRimMat);
  stageRim.rotation.x = Math.PI / 2;
  stageRim.position.set(0, 0.15, 0.5);
  group.add(stageRim);

  const innerPurpleRimMat = new THREE.MeshBasicMaterial({ color: '#a855f7' });
  const innerPurpleRim = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.055, 10, 56),
    innerPurpleRimMat
  );
  innerPurpleRim.rotation.x = Math.PI / 2;
  innerPurpleRim.position.set(0, 0.16, 0.5);
  group.add(innerPurpleRim);

  // Glowing Neon Runway Strips leading from Entrance Door (z = 10.5) into Studio Center
  const runwayStripMat = new THREE.MeshBasicMaterial({ color: '#2dd4bf' });
  [-1.35, 1.35].forEach((rx) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 9.6), runwayStripMat);
    strip.position.set(rx, 0.02, 7.6);
    group.add(strip);
  });

  // Acoustic Studio Walls (Back, Left, Right) for real room perspective depth
  const wallTex = createAcousticWallTexture(maxAnisotropy);
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.45,
    metalness: 0.35,
  });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(26, 9.5, 0.5), wallMat);
  backWall.position.set(0, 4.75, -10.8);
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.5, 25), wallMat);
  leftWall.position.set(-12.8, 4.75, 1.5);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.5, 25), wallMat);
  rightWall.position.set(12.8, 4.75, 1.5);
  group.add(rightWall);

  // Glowing vertical Neon Pilasters along left/right/back walls
  const pilasterColors = ['#22d3ee', '#a855f7', '#34d399', '#ec4899', '#fde047'];
  const neonStrips: THREE.MeshBasicMaterial[] = [];
  [-9.5, -3.5, 3.5, 9.5].forEach((px, idx) => {
    const stripMat = new THREE.MeshBasicMaterial({
      color: pilasterColors[idx % pilasterColors.length],
    });
    neonStrips.push(stripMat);

    // Back wall pilasters
    const pil = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 9.2, 0.65),
      new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7, roughness: 0.25 })
    );
    pil.position.set(px, 4.6, -10.3);
    group.add(pil);

    const glowBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 8.8, 0.12), stripMat);
    glowBar.position.set(px, 4.6, -9.93);
    group.add(glowBar);
  });

  [-6.5, 0.5, 7.5].forEach((pz, idx) => {
    const cHex = pilasterColors[(idx + 1) % pilasterColors.length];
    const sMat = new THREE.MeshBasicMaterial({ color: cHex });
    neonStrips.push(sMat);

    [-12.25, 12.25].forEach((wx) => {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 9.2, 0.55),
        new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7, roughness: 0.25 })
      );
      col.position.set(wx, 4.6, pz);
      group.add(col);

      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 8.8, 0.14), sMat);
      bar.position.set(wx > 0 ? wx - 0.36 : wx + 0.36, 4.6, pz);
      group.add(bar);
    });
  });

  // =========================================================================
  // 2. CEILING TRUSS, GLOWING MAGENTA/CYAN HALO DOME & MOVING LIGHT BEAMS
  // =========================================================================
  const ceilingRingGroup = new THREE.Group();
  ceilingRingGroup.position.set(0, 8.8, -1.0);
  group.add(ceilingRingGroup);

  const ceilingOuterMat = new THREE.MeshBasicMaterial({ color: '#ec4899' });
  const ceilingOuter = new THREE.Mesh(
    new THREE.TorusGeometry(6.8, 0.14, 14, 64),
    ceilingOuterMat
  );
  ceilingOuter.rotation.x = Math.PI / 2;
  ceilingRingGroup.add(ceilingOuter);

  const ceilingMidMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
  const ceilingMid = new THREE.Mesh(
    new THREE.TorusGeometry(4.8, 0.11, 14, 56),
    ceilingMidMat
  );
  ceilingMid.rotation.x = Math.PI / 2;
  ceilingMid.position.y = -0.35;
  ceilingRingGroup.add(ceilingMid);

  const ceilingCoreMat = new THREE.MeshStandardMaterial({
    color: '#a855f7',
    emissive: '#9333ea',
    emissiveIntensity: 0.9,
    metalness: 0.5,
    roughness: 0.2,
  });
  const ceilingHub = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.8, 0.45, 24),
    ceilingCoreMat
  );
  ceilingRingGroup.add(ceilingHub);

  // Overhead Volumetric-Style Moving Light Beams
  const beamConfigs = [
    { x: -6.5, z: -4.2, color: '#22d3ee', baseTiltX: 0.28, baseTiltZ: -0.25 },
    { x: 6.5, z: -4.2, color: '#ec4899', baseTiltX: 0.28, baseTiltZ: 0.25 },
    { x: -5.2, z: 3.5, color: '#34d399', baseTiltX: -0.22, baseTiltZ: -0.2 },
    { x: 5.2, z: 3.5, color: '#a855f7', baseTiltX: -0.22, baseTiltZ: 0.2 },
  ];
  const lightBeams: { mesh: THREE.Mesh; baseTiltX: number; baseTiltZ: number; phase: number }[] = [];
  beamConfigs.forEach((bc, idx) => {
    const beamMat = new THREE.MeshBasicMaterial({
      color: bc.color,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const beamGeo = new THREE.ConeGeometry(2.4, 10.5, 20, 1, true);
    beamGeo.translate(0, -5.25, 0);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bc.x, 8.9, bc.z);
    beam.rotation.set(bc.baseTiltX, 0, bc.baseTiltZ);
    group.add(beam);
    lightBeams.push({ mesh: beam, baseTiltX: bc.baseTiltX, baseTiltZ: bc.baseTiltZ, phase: idx * 1.4 });
  });

  // =========================================================================
  // 3. FUTURISTIC STUDIO ENTRANCE AIRLOCK DOORWAY (z = 11.4)
  // =========================================================================
  const doorFrameGroup = new THREE.Group();
  doorFrameGroup.position.set(0, 0, 11.4);
  group.add(doorFrameGroup);

  const frameMetalMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.82,
    roughness: 0.2,
  });
  const doorNeonCyan = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
  const doorNeonMagenta = new THREE.MeshBasicMaterial({ color: '#ec4899' });

  // Outer arch pillars + lintel
  [-2.6, 2.6].forEach((dx) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.2, 0.85), frameMetalMat);
    post.position.set(dx, 2.6, 0);
    doorFrameGroup.add(post);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.9, 0.92), doorNeonCyan);
    trim.position.set(dx > 0 ? dx - 0.3 : dx + 0.3, 2.6, 0);
    doorFrameGroup.add(trim);
  });

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.75, 0.95), frameMetalMat);
  lintel.position.set(0, 5.4, 0);
  doorFrameGroup.add(lintel);

  const lintelBeacon = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 1.02), doorNeonMagenta);
  lintelBeacon.position.set(0, 5.15, 0);
  doorFrameGroup.add(lintelBeacon);

  // Side walls framing the entrance portal
  [-7.6, 7.6].forEach((wx) => {
    const flankWall = new THREE.Mesh(new THREE.BoxGeometry(9.6, 9.2, 0.55), wallMat);
    flankWall.position.set(wx, 4.6, 0);
    doorFrameGroup.add(flankWall);
  });
  const upperHeaderWall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.6, 0.55), wallMat);
  upperHeaderWall.position.set(0, 7.4, 0);
  doorFrameGroup.add(upperHeaderWall);

  // Sliding Left & Right Futuristic Studio Doors
  const doorPanelMat = new THREE.MeshStandardMaterial({
    color: '#0f294a',
    metalness: 0.78,
    roughness: 0.18,
  });
  const doorGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#38bdf8',
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.42,
    clearcoat: 1.0,
  });

  const leftDoor = new THREE.Group();
  leftDoor.position.set(-1.12, 0, 0);
  const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(2.22, 4.95, 0.24), doorPanelMat);
  leftLeaf.position.y = 2.48;
  const leftWindow = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.9, 0.28), doorGlassMat);
  leftWindow.position.set(-0.15, 2.65, 0);
  const leftEdge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.9, 0.3), doorNeonCyan);
  leftEdge.position.set(1.06, 2.48, 0);
  leftDoor.add(leftLeaf, leftWindow, leftEdge);
  doorFrameGroup.add(leftDoor);

  const rightDoor = new THREE.Group();
  rightDoor.position.set(1.12, 0, 0);
  const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(2.22, 4.95, 0.24), doorPanelMat);
  rightLeaf.position.y = 2.48;
  const rightWindow = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.9, 0.28), doorGlassMat);
  rightWindow.position.set(0.15, 2.65, 0);
  const rightEdge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.9, 0.3), doorNeonCyan);
  rightEdge.position.set(-1.06, 2.48, 0);
  rightDoor.add(rightLeaf, rightWindow, rightEdge);
  doorFrameGroup.add(rightDoor);

  // =========================================================================
  // 4. GIANT SOUNDWAVE SCREEN & ANIMATED 3D EQUALIZER PILLARS (z = -9.6)
  // =========================================================================
  const mainScreenCanvas = document.createElement('canvas');
  mainScreenCanvas.width = 1024;
  mainScreenCanvas.height = 440;
  const mainScreenCtx = mainScreenCanvas.getContext('2d')!;
  drawMainWaveformScreen(mainScreenCtx, 0, false, false);
  const mainScreenTex = new THREE.CanvasTexture(mainScreenCanvas);
  mainScreenTex.colorSpace = THREE.SRGBColorSpace;
  mainScreenTex.anisotropy = maxAnisotropy;

  const mainScreenGroup = new THREE.Group();
  mainScreenGroup.position.set(0, 4.6, -9.65);
  group.add(mainScreenGroup);

  const screenChassis = new THREE.Mesh(
    new THREE.BoxGeometry(13.8, 6.0, 0.35),
    new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.82, roughness: 0.22 })
  );
  mainScreenGroup.add(screenChassis);

  const screenDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(13.2, 5.45),
    new THREE.MeshBasicMaterial({ map: mainScreenTex })
  );
  screenDisplay.position.z = 0.2;
  mainScreenGroup.add(screenDisplay);

  const screenNeonFrame = new THREE.Mesh(
    new THREE.BoxGeometry(14.0, 6.2, 0.15),
    new THREE.MeshBasicMaterial({ color: '#22d3ee', wireframe: true })
  );
  screenNeonFrame.position.z = 0.1;
  mainScreenGroup.add(screenNeonFrame);

  // 17 3D Multi-Color Equalizer Pillars arrayed in an arc behind stage
  const eqBars: { mesh: THREE.Mesh; baseH: number; phase: number }[] = [];
  const eqGeo = new THREE.BoxGeometry(0.46, 1, 0.46);
  const eqColors = ['#22d3ee', '#2dd4bf', '#34d399', '#a855f7', '#ec4899', '#fde047'];
  for (let i = -8; i <= 8; i++) {
    const colHex = eqColors[Math.abs(i) % eqColors.length];
    const barMat = new THREE.MeshStandardMaterial({
      color: colHex,
      emissive: colHex,
      emissiveIntensity: 0.65,
      metalness: 0.35,
      roughness: 0.25,
    });
    const bar = new THREE.Mesh(eqGeo, barMat);
    const angle = (i / 8) * 0.62;
    const bx = Math.sin(angle) * 8.4;
    const bz = -6.2 - Math.cos(angle) * 2.1;
    bar.position.set(bx, 0.9, bz);
    group.add(bar);
    eqBars.push({ mesh: bar, baseH: 1.0, phase: i * 0.52 });
  }

  // Central Floating Holographic Sound-Core & Orbiting Wave Rings
  const holoCoreGroup = new THREE.Group();
  holoCoreGroup.position.set(0, 3.55, -3.5);
  group.add(holoCoreGroup);

  const coreMat = new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    emissive: '#06b6d4',
    emissiveIntensity: 0.85,
    wireframe: true,
  });
  const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 2), coreMat);
  holoCoreGroup.add(coreMesh);

  const ringCyan = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.06, 12, 56),
    new THREE.MeshBasicMaterial({ color: '#2dd4bf' })
  );
  ringCyan.rotation.x = Math.PI / 2.6;
  holoCoreGroup.add(ringCyan);

  const ringMagenta = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.05, 10, 48),
    new THREE.MeshBasicMaterial({ color: '#ec4899' })
  );
  ringMagenta.rotation.y = Math.PI / 3;
  holoCoreGroup.add(ringMagenta);

  const ringYellow = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.04, 10, 56),
    new THREE.MeshBasicMaterial({ color: '#fde047' })
  );
  ringYellow.rotation.x = -Math.PI / 3.2;
  holoCoreGroup.add(ringYellow);

  // =========================================================================
  // 5. DIGITAL AUDIO CONTROL DESK & MIXING CONSOLE (Right Studio Bay: x=4.6, z=-1.8)
  // =========================================================================
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(4.8, 0.14, -1.8);
  consoleGroup.rotation.y = -0.48;
  group.add(consoleGroup);

  const deskBodyMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.78,
    roughness: 0.22,
  });
  const deskSurfaceMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.55,
    roughness: 0.3,
  });

  // Pedestal legs + curved console tabletop
  [-1.55, 1.55].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.12, 1.25), deskBodyMat);
    leg.position.set(lx, 0.56, 0);
    leg.castShadow = true;
    consoleGroup.add(leg);
  });

  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 1.65), deskSurfaceMat);
  deskTop.position.set(0, 1.15, 0);
  deskTop.castShadow = true;
  consoleGroup.add(deskTop);

  // Neon cyan front bevel strip on mixing desk
  const deskNeonTrim = new THREE.Mesh(
    new THREE.BoxGeometry(4.24, 0.07, 0.08),
    new THREE.MeshBasicMaterial({ color: '#22d3ee' })
  );
  deskNeonTrim.position.set(0, 1.15, 0.83);
  consoleGroup.add(deskNeonTrim);

  // Mixing board faders & glowing RGB pads
  const faderSliders: { mesh: THREE.Mesh; phase: number }[] = [];
  const faderTrackMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 });
  for (let i = 0; i < 8; i++) {
    const fx = -1.3 + i * 0.22;
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.55), faderTrackMat);
    track.position.set(fx, 1.24, 0.26);
    consoleGroup.add(track);

    const knobColor = i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#ec4899' : '#34d399';
    const knob = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.07, 0.09),
      new THREE.MeshBasicMaterial({ color: knobColor })
    );
    knob.position.set(fx, 1.27, 0.2);
    consoleGroup.add(knob);
    faderSliders.push({ mesh: knob, phase: i * 0.7 });
  }

  // Glowing Launchpad Matrix on right half of desk
  const padColors = ['#22d3ee', '#a855f7', '#34d399', '#fde047', '#ec4899'];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.04, 0.14),
        new THREE.MeshBasicMaterial({ color: padColors[(r * 4 + c) % padColors.length] })
      );
      pad.position.set(0.65 + c * 0.2, 1.24, 0.05 + r * 0.2);
      consoleGroup.add(pad);
    }
  }

  // Triple Holographic Studio Monitors mounted on Desk
  const monConfigs = [
    { x: -1.18, y: 1.92, z: -0.48, rotY: 0.26, title: 'SPEKTRUM SUARA', sub: 'Frekuensi: 440Hz · Stabil', c1: '#22d3ee', c2: '#a855f7', v: 0 },
    { x: 0, y: 1.98, z: -0.58, rotY: 0, title: 'RAKAMAN HOLOGRAM', sub: 'Saluran Utama: AKTIF', c1: '#ec4899', c2: '#22d3ee', v: 1 },
    { x: 1.18, y: 1.92, z: -0.48, rotY: -0.26, title: 'ANALISIS TAMAN HARMONI', sub: 'Kualiti Isyarat: 98%', c1: '#34d399', c2: '#fde047', v: 2 },
  ];
  monConfigs.forEach((mc) => {
    const mTex = createHoloTelemetryTexture(mc.title, mc.sub, mc.c1, mc.c2, mc.v, maxAnisotropy);
    const monGroup = new THREE.Group();
    monGroup.position.set(mc.x, mc.y, mc.z);
    monGroup.rotation.y = mc.rotY;

    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.74, 0.06), deskBodyMat);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.04, 0.66),
      new THREE.MeshBasicMaterial({ map: mTex })
    );
    face.position.z = 0.035;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), deskBodyMat);
    arm.position.set(0, -0.5, -0.04);
    monGroup.add(bezel, face, arm);
    consoleGroup.add(monGroup);
  });

  // Dual Studio Monitor Speakers flanking the Desk
  [-1.92, 1.92].forEach((sx) => {
    const spk = new THREE.Group();
    spk.position.set(sx, 1.56, -0.25);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.68, 0.44), deskBodyMat);
    const woofer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.04, 18),
      new THREE.MeshStandardMaterial({ color: '#1e1b4b', emissive: '#a855f7', emissiveIntensity: 0.45 })
    );
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(0, -0.08, 0.22);
    const tweeter = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.02, 8, 20),
      new THREE.MeshBasicMaterial({ color: '#22d3ee' })
    );
    tweeter.position.set(0, 0.18, 0.23);
    spk.add(box, woofer, tweeter);
    consoleGroup.add(spk);
  });

  // =========================================================================
  // 6. PROFESSIONAL BROADCAST MICROPHONE BOOTH (Left Studio Stage: x=-4.8, z=-2.8)
  // =========================================================================
  const boothCenter = new THREE.Vector3(-4.8, 0, -2.8);
  const boothGroup = new THREE.Group();
  boothGroup.position.copy(boothCenter);
  group.add(boothGroup);

  // Raised circular neon recording platform (walkable!)
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.45, 0.24, 36),
    new THREE.MeshStandardMaterial({ color: '#0f2d4e', metalness: 0.65, roughness: 0.22 })
  );
  dais.position.y = 0.12;
  dais.receiveShadow = true;
  boothGroup.add(dais);

  const daisRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.28, 0.06, 12, 48),
    new THREE.MeshBasicMaterial({ color: '#fde047' })
  );
  daisRing.rotation.x = Math.PI / 2;
  daisRing.position.y = 0.25;
  boothGroup.add(daisRing);

  // Curved Acoustic Glass Shield behind microphone
  const shieldMat = new THREE.MeshPhysicalMaterial({
    color: '#67e8f9',
    transparent: true,
    opacity: 0.24,
    roughness: 0.08,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const glassShield = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 2.2, 24, 1, true, Math.PI * 0.7, Math.PI * 0.75),
    shieldMat
  );
  glassShield.position.y = 1.35;
  boothGroup.add(glassShield);

  // Professional Condenser Microphone + Boom Arm Stand
  const micStandGroup = new THREE.Group();
  micStandGroup.position.set(0, 0.24, -0.75);
  boothGroup.add(micStandGroup);

  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.16 });
  const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.08, 20), deskBodyMat);
  micBase.position.y = 0.04;
  const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.75, 12), chromeMat);
  micPole.position.y = 0.9;
  const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.95, 10), chromeMat);
  boomArm.position.set(0, 1.88, 0.36);
  boomArm.rotation.x = Math.PI / 3;
  const micCapsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, 0.22, 8, 16),
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.2 })
  );
  micCapsule.position.set(0, 2.02, 0.76);
  const popFilter = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.02, 8, 24),
    new THREE.MeshBasicMaterial({ color: '#ec4899' })
  );
  popFilter.position.set(0, 2.02, 0.95);
  const micHaloRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.025, 8, 24),
    new THREE.MeshBasicMaterial({ color: '#34d399' })
  );
  micHaloRing.rotation.x = Math.PI / 2;
  micHaloRing.position.set(0, 1.82, 0.76);
  micStandGroup.add(micBase, micPole, boomArm, micCapsule, popFilter, micHaloRing);

  // =========================================================================
  // 7. FLOATING HOLOGRAPHIC SCREENS AROUND THE STUDIO
  // =========================================================================
  const floatingHolos: { mesh: THREE.Group; baseY: number; phase: number }[] = [];
  const holoDefs = [
    { x: -8.8, y: 3.6, z: 1.5, rotY: 1.1, title: 'GELOMBANG HOLOGRAM', sub: 'Modulasi Vokal Jelas', c1: '#2dd4bf', c2: '#3b82f6', v: 3 },
    { x: 8.8, y: 3.8, z: 2.2, rotY: -1.1, title: 'TELEMETRI STUDIO', sub: 'Studio Aktif · Neon Sync', c1: '#a855f7', c2: '#ec4899', v: 4 },
    { x: -7.8, y: 4.1, z: -6.2, rotY: 0.6, title: 'MODUL SEBUTAN BAKU', sub: 'Kejelasan & Intonasi', c1: '#fde047', c2: '#34d399', v: 5 },
    { x: 7.8, y: 4.1, z: -6.2, rotY: -0.6, title: 'SUARA GENERASI PRIHATIN', sub: 'Siap Untuk Misi 05', c1: '#22d3ee', c2: '#ec4899', v: 6 },
  ];
  holoDefs.forEach((hd, idx) => {
    const hg = new THREE.Group();
    hg.position.set(hd.x, hd.y, hd.z);
    hg.rotation.y = hd.rotY;

    const hTex = createHoloTelemetryTexture(hd.title, hd.sub, hd.c1, hd.c2, hd.v, maxAnisotropy);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.65),
      new THREE.MeshBasicMaterial({
        map: hTex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
    );
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 1.74, 0.04),
      new THREE.MeshBasicMaterial({ color: hd.c1, wireframe: true })
    );
    hg.add(panel, rim);
    group.add(hg);
    floatingHolos.push({ mesh: hg, baseY: hd.y, phase: idx * 1.6 });
  });

  // =========================================================================
  // 8. VIBRANT MULTI-COLOR DIGITAL PARTICLES
  // =========================================================================
  const partCount = isSoftwareGl ? 80 : 180;
  const partPos = new Float32Array(partCount * 3);
  const partColors = new Float32Array(partCount * 3);
  const pPalette = [
    new THREE.Color('#22d3ee'),
    new THREE.Color('#2dd4bf'),
    new THREE.Color('#a855f7'),
    new THREE.Color('#ec4899'),
    new THREE.Color('#34d399'),
    new THREE.Color('#fde047'),
  ];
  for (let i = 0; i < partCount; i++) {
    partPos[i * 3] = (Math.random() - 0.5) * 23;
    partPos[i * 3 + 1] = Math.random() * 8.2 + 0.4;
    partPos[i * 3 + 2] = (Math.random() - 0.5) * 21;
    const c = pPalette[i % pPalette.length];
    partColors[i * 3] = c.r;
    partColors[i * 3 + 1] = c.g;
    partColors[i * 3 + 2] = c.b;
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
  partGeo.setAttribute('color', new THREE.BufferAttribute(partColors, 3));
  const partMat = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(partGeo, partMat);
  group.add(particles);

  let lastScreenDraw = -1;

  // =========================================================================
  // COLLISION & FLOOR HEIGHT HELPERS FOR EXPLORABLE MOVEMENT
  // =========================================================================
  const clampPosition = (rawX: number, rawZ: number): { x: number; z: number } => {
    let x = THREE.MathUtils.clamp(rawX, -9.8, 9.8);
    let z = THREE.MathUtils.clamp(rawZ, -6.2, 9.6);

    // Avoid walking straight through the Digital Mixing Desk (centered at 4.8, -1.8)
    const dxDesk = x - 4.8;
    const dzDesk = z - -1.8;
    const deskDist = Math.hypot(dxDesk, dzDesk);
    if (deskDist < 2.35) {
      const push = 2.35 / Math.max(0.01, deskDist);
      x = 4.8 + dxDesk * push;
      z = -1.8 + dzDesk * push;
    }

    // Avoid walking into the Microphone stand base at (-4.8, -3.55)
    const dxMic = x - -4.8;
    const dzMic = z - -3.55;
    const micDist = Math.hypot(dxMic, dzMic);
    if (micDist < 0.95) {
      const push = 0.95 / Math.max(0.01, micDist);
      x = -4.8 + dxMic * push;
      z = -3.55 + dzMic * push;
    }

    // Keep outside back acoustic glass arc at (-4.8, -2.8)
    const dxBooth = x - -4.8;
    const dzBooth = z - -2.8;
    const boothDist = Math.hypot(dxBooth, dzBooth);
    if (boothDist > 1.75 && boothDist < 2.35 && dzBooth < -0.45) {
      x = -4.8 + (dxBooth / Math.max(0.01, boothDist)) * 1.75;
      z = -2.8 + (dzBooth / Math.max(0.01, boothDist)) * 1.75;
    }

    return {
      x: THREE.MathUtils.clamp(x, -9.8, 9.8),
      z: THREE.MathUtils.clamp(z, -6.2, 9.6),
    };
  };

  const getFloorHeightAt = (x: number, z: number): number => {
    const distBooth = Math.hypot(x - -4.8, z - -2.8);
    if (distBooth < 2.25) return 0.24;
    const distStage = Math.hypot(x, z - 0.5);
    if (distStage < 6.6) return 0.14;
    return 0;
  };

  const animate = (
    elapsed: number,
    dt: number,
    opts: { doorOpen: number; audioActive: boolean; transferMode: boolean }
  ) => {
    const open = THREE.MathUtils.clamp(opts.doorOpen, 0, 1);
    const doorSlide = open * 2.15;
    leftDoor.position.x = -1.12 - doorSlide;
    rightDoor.position.x = 1.12 + doorSlide;

    // Animated Soundwave Main Screen (~20fps canvas refresh for smooth performance)
    if (elapsed - lastScreenDraw > 0.05) {
      lastScreenDraw = elapsed;
      drawMainWaveformScreen(mainScreenCtx, elapsed, opts.audioActive, opts.transferMode);
      mainScreenTex.needsUpdate = true;
    }

    // Holographic core & rings
    const spinBoost = opts.transferMode ? 1.85 : opts.audioActive ? 1.35 : 1.0;
    coreMesh.rotation.y = elapsed * 0.55 * spinBoost;
    coreMesh.rotation.x = Math.sin(elapsed * 0.8) * 0.25;
    ringCyan.rotation.z = elapsed * 0.7 * spinBoost;
    ringMagenta.rotation.x = elapsed * 0.55 * spinBoost;
    ringYellow.rotation.y = -elapsed * 0.65 * spinBoost;
    holoCoreGroup.position.y = 3.55 + Math.sin(elapsed * 1.9) * 0.18;

    // 3D Equalizer Pillars
    const eqAmp = opts.transferMode ? 3.2 : opts.audioActive ? 2.5 : 1.55;
    eqBars.forEach((b) => {
      const targetH = 0.7 + Math.abs(Math.sin(elapsed * 3.4 + b.phase)) * eqAmp;
      b.mesh.scale.y += (targetH - b.mesh.scale.y) * Math.min(1, dt * 11);
      b.mesh.position.y = b.mesh.scale.y * 0.5;
    });

    // Fader sliders smoothly animating on Mixing Desk
    faderSliders.forEach((f) => {
      f.mesh.position.z = 0.26 + Math.sin(elapsed * 2.2 + f.phase) * 0.18;
    });

    // Floating holographic telemetry screens
    floatingHolos.forEach((fh) => {
      fh.mesh.position.y = fh.baseY + Math.sin(elapsed * 1.6 + fh.phase) * 0.2;
    });

    // Moving overhead studio light beams
    lightBeams.forEach((lb) => {
      lb.mesh.rotation.x = lb.baseTiltX + Math.sin(elapsed * 0.8 + lb.phase) * 0.11;
      lb.mesh.rotation.z = lb.baseTiltZ + Math.cos(elapsed * 0.7 + lb.phase) * 0.12;
    });

    // Ceiling halo spin
    ceilingRingGroup.rotation.y = elapsed * 0.15;

    // Neon rim accent shift during transferMode
    stageRimMat.color.set(opts.transferMode ? '#fde047' : '#22d3ee');
    innerPurpleRimMat.color.set(opts.transferMode ? '#34d399' : '#a855f7');

    // Particles gentle drift
    particles.rotation.y = elapsed * 0.045;
  };

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (!m) return;
          if ('map' in m && m.map instanceof THREE.Texture) {
            m.map.dispose();
          }
          m.dispose();
        });
      }
    });
    floorTex.dispose();
    wallTex.dispose();
    mainScreenTex.dispose();
  };

  return {
    group,
    leftDoor,
    rightDoor,
    clampPosition,
    getFloorHeightAt,
    animate,
    dispose,
  };
}
