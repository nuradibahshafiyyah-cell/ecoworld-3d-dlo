import * as THREE from 'three';
import { createEarthTexture, createMetalHazardTexture } from './textures';
import { buildPodcastStudioRoom, PodcastStudioRoomHandle } from './podcastStudioRoom';

export interface MissionRoomHandle {
  id: 1 | 2 | 3 | 4 | 5;
  group: THREE.Group;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  bgColor: number;
  fogColor: number;
  animate: (elapsed: number, dt: number, restored: boolean) => void;
  setAvatarId?: PodcastStudioRoomHandle['setAvatarId'];
  resetIntro?: PodcastStudioRoomHandle['resetIntro'];
  skipIntro?: PodcastStudioRoomHandle['skipIntro'];
  updateIntroCamera?: PodcastStudioRoomHandle['updateIntroCamera'];
  dispose: () => void;
}

function createHoloPanelTexture(
  header: string,
  lines: string[],
  accentHex: string,
  maxAnisotropy: number,
  drawBars = true
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  // Futuristic translucent-dark backing
  ctx.fillStyle = '#061322';
  ctx.fillRect(0, 0, 512, 320);

  // Subtle sci-fi grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
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

  // Outer glowing border
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 300);

  // Header strip
  ctx.fillStyle = accentHex;
  ctx.fillRect(10, 10, 492, 54);

  ctx.fillStyle = '#04121d';
  ctx.font = 'bold 26px "Orbitron", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(header, 26, 46);

  // Data lines
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 22px "Chakra Petch", sans-serif';
  lines.forEach((line, idx) => {
    ctx.fillText(line, 28, 104 + idx * 42);
  });

  // Telemetry bars
  if (drawBars) {
    const barCount = 10;
    for (let i = 0; i < barCount; i++) {
      const h = 24 + ((i * 37) % 68);
      ctx.fillStyle = i % 2 === 0 ? accentHex : '#38bdf8';
      ctx.fillRect(28 + i * 44, 290 - h, 28, h);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildHoloScreen(
  header: string,
  lines: string[],
  accentHex: string,
  width: number,
  height: number,
  maxAnisotropy: number
): THREE.Group {
  const g = new THREE.Group();
  const tex = createHoloPanelTexture(header, lines, accentHex, maxAnisotropy);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.75,
    roughness: 0.25,
  });
  const screenMat = new THREE.MeshBasicMaterial({
    map: tex,
  });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.12), frameMat);
  g.add(frame);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMat);
  screen.position.z = 0.07;
  g.add(screen);

  const backScreen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMat);
  backScreen.position.z = -0.07;
  backScreen.rotation.y = Math.PI;
  g.add(backScreen);

  return g;
}

function buildEntrancePortal(accentColor: number): { group: THREE.Group; ring: THREE.Mesh } {
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.35, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 })
  );
  plinth.position.y = 0.175;
  group.add(plinth);

  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.22, 14, 36, Math.PI),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    })
  );
  arch.position.y = 2.0;
  group.add(arch);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.09, 12, 42),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
  );
  ring.position.y = 2.25;
  group.add(ring);

  const core = new THREE.Mesh(
    new THREE.CircleGeometry(1.62, 32),
    new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    })
  );
  core.position.y = 2.25;
  group.add(core);

  return { group, ring };
}

function buildRoomShell(
  width: number,
  depth: number,
  floorColor: number,
  trimColor: number
): THREE.Group {
  const shell = new THREE.Group();

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.4, depth),
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.45, metalness: 0.35 })
  );
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  shell.add(floor);

  // Glowing perimeter trim strips
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    emissive: trimColor,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const stripFront = new THREE.Mesh(new THREE.BoxGeometry(width - 0.8, 0.08, 0.16), trimMat);
  stripFront.position.set(0, 0.04, depth / 2 - 0.5);
  const stripBack = stripFront.clone();
  stripBack.position.z = -depth / 2 + 0.5;
  const stripLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, depth - 0.8), trimMat);
  stripLeft.position.set(-width / 2 + 0.5, 0.04, 0);
  const stripRight = stripLeft.clone();
  stripRight.position.x = width / 2 - 0.5;
  shell.add(stripFront, stripBack, stripLeft, stripRight);

  // Side sci-fi structural pillars
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.35,
  });
  [-width / 2 + 0.6, width / 2 - 0.6].forEach((px) => {
    [-depth / 2 + 1.2, 0, depth / 2 - 1.2].forEach((pz) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 7.2, 0.7), pillarMat);
      p.position.set(px, 3.6, pz);
      shell.add(p);
    });
  });

  // Overhead futuristic ceiling ring beam
  const roofRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.8, 0.16, 12, 48),
    trimMat
  );
  roofRing.rotation.x = Math.PI / 2;
  roofRing.position.y = 7.4;
  shell.add(roofRing);

  return shell;
}

export function buildMissionRoom(
  roomId: 1 | 2 | 3 | 4 | 5,
  maxAnisotropy: number
): MissionRoomHandle {
  const group = new THREE.Group();
  const hazardTex = createMetalHazardTexture(maxAnisotropy);
  const earthTex = createEarthTexture(maxAnisotropy);

  let cameraPos: [number, number, number] = [0, 5.2, 11.5];
  let cameraTarget: [number, number, number] = [0, 2.2, -1.5];
  let bgColor = 0x041525;
  let fogColor = 0x041525;
  let animateFn: (elapsed: number, dt: number, restored: boolean) => void = () => {};

  if (roomId === 1) {
    // =========================================================================
    // MISSION ROOM 01: THE POLLUTED RIVER INVESTIGATION LAB
    // =========================================================================
    bgColor = 0x04192b;
    fogColor = 0x04192b;
    cameraPos = [0, 5.0, 11.6];
    cameraTarget = [0, 2.0, -1.5];

    group.add(buildRoomShell(19, 15, 0x0b1727, 0x10b981));

    const labLightA = new THREE.PointLight(0x10b981, 22, 24);
    labLightA.position.set(-4.5, 5.5, 2);
    const labLightB = new THREE.PointLight(0x38bdf8, 22, 24);
    labLightB.position.set(4.5, 5.5, 2);
    group.add(labLightA, labLightB);

    // Large Glass Window Wall overlooking Polluted River outside
    const windowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(15.5, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
    );
    windowFrame.position.set(0, 1.3, -6.9);
    group.add(windowFrame);

    const glassPane = new THREE.Mesh(
      new THREE.PlaneGeometry(15.2, 5.4),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.16,
        roughness: 0.08,
        metalness: 0.1,
        depthWrite: false,
      })
    );
    glassPane.position.set(0, 4.1, -6.9);
    group.add(glassPane);

    // Exterior Polluted River & Textile Pipe outside the window
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x3b0764,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.4,
    });
    const riverPlane = new THREE.Mesh(new THREE.PlaneGeometry(26, 8), riverMat);
    riverPlane.rotation.x = -Math.PI / 2;
    riverPlane.position.set(0, 0.1, -12.5);
    group.add(riverPlane);

    const extFactory = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 4.2, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 })
    );
    extFactory.position.set(-6.5, 2.1, -13.5);
    group.add(extFactory);

    const extPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 4.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.3 })
    );
    extPipe.rotation.z = Math.PI / 2.2;
    extPipe.position.set(-3.2, 1.4, -12.2);
    group.add(extPipe);

    // Central Digital Evidence Table
    const tableBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.0, 1.15, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.65, roughness: 0.3 })
    );
    tableBase.position.set(0, 0.58, -0.5);
    group.add(tableBase);

    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(2.85, 2.85, 0.14, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      })
    );
    tableTop.position.set(0, 1.2, -0.5);
    group.add(tableTop);

    // 3D Water Sample Bottles on the Evidence Table
    const sampleColors = [0x7e22ce, 0x065f46, 0x0284c7];
    const bottles: THREE.Group[] = [];
    sampleColors.forEach((col, i) => {
      const bottle = new THREE.Group();
      bottle.position.set(-1.3 + i * 1.3, 1.27, -0.5);

      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 1.05, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.42,
          roughness: 0.1,
          clearcoat: 1,
        })
      );
      glass.position.y = 0.54;
      bottle.add(glass);

      const liquid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.68, 14),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.75,
          roughness: 0.2,
        })
      );
      liquid.position.y = 0.36;
      bottle.add(liquid);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
      );
      cap.position.y = 1.12;
      bottle.add(cap);

      group.add(bottle);
      bottles.push(bottle);
    });

    // Floating Holographic Water Analysis Screens
    const holoLeft = buildHoloScreen(
      'ANALISIS AIR SUNGAI',
      ['pH: 4.1 (BERASID)', 'OKSIGEN: KRITIKAL', 'TOKSIN: KIMIA TEKSTIL'],
      '#10b981',
      3.8,
      2.3,
      maxAnisotropy
    );
    holoLeft.position.set(-4.6, 3.6, -2.5);
    holoLeft.rotation.y = 0.45;
    group.add(holoLeft);

    const holoRight = buildHoloScreen(
      'LOG AUDIO PENDUDUK',
      ['PUAN AMINAH · KG. JERNIH', 'MASA BUANG: >12 TENGAH MALAM', 'KESAN: IKAN MATI TERAPUNG'],
      '#38bdf8',
      3.8,
      2.3,
      maxAnisotropy
    );
    holoRight.position.set(4.6, 3.6, -2.5);
    holoRight.rotation.y = -0.45;
    group.add(holoRight);

    // Environmental Testing Console Rig on right
    const analyzer = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 })
    );
    analyzer.position.set(6.4, 1.1, 1.6);
    group.add(analyzer);

    // Entrance Portal on left-front
    const portal = buildEntrancePortal(0x10b981);
    portal.group.position.set(-6.6, 0, 3.4);
    portal.group.rotation.y = 0.75;
    group.add(portal.group);

    animateFn = (elapsed, dt, restored) => {
      holoLeft.position.y = 3.6 + Math.sin(elapsed * 2.0) * 0.16;
      holoRight.position.y = 3.6 + Math.sin(elapsed * 2.0 + 1.2) * 0.16;
      portal.ring.rotation.z += dt * 1.1;
      bottles.forEach((b, idx) => {
        b.rotation.y += dt * 0.8;
        b.position.y = 1.27 + Math.sin(elapsed * 2.5 + idx) * 0.04;
      });
      riverMat.color.lerp(new THREE.Color(restored ? 0x0ea5e9 : 0x1e293b), Math.min(1, dt * 2.5));
      riverMat.emissive.lerp(new THREE.Color(restored ? 0x0369a1 : 0x3b0764), Math.min(1, dt * 2.5));
    };
  } else if (roomId === 2) {
    // =========================================================================
    // MISSION ROOM 02: THE POLLUTED CITY CONTROL CENTER
    // =========================================================================
    bgColor = 0x071a20;
    fogColor = 0x071a20;
    cameraPos = [0, 5.1, 11.6];
    cameraTarget = [0, 2.2, -1.6];

    group.add(buildRoomShell(20, 15, 0x0f172a, 0x14b8a6));

    const cityLightA = new THREE.PointLight(0x14b8a6, 22, 24);
    cityLightA.position.set(-4.5, 5.5, 2);
    const cityLightB = new THREE.PointLight(0xf97316, 16, 22);
    cityLightB.position.set(4.5, 5.0, -3);
    group.add(cityLightA, cityLightB);

    // Panoramic Glass Window
    const glassPane = new THREE.Mesh(
      new THREE.PlaneGeometry(16.4, 5.6),
      new THREE.MeshPhysicalMaterial({
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.14,
        roughness: 0.08,
        depthWrite: false,
      })
    );
    glassPane.position.set(0, 4.1, -6.9);
    group.add(glassPane);

    // Distant Polluted Industrial City Skyline outside panoramic window
    const citySkyline = new THREE.Group();
    citySkyline.position.set(0, 0, -14.5);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.35 });
    [
      [-7.5, 4.6, 0, 2.4, 9.2, 2.4],
      [-3.5, 3.2, -1, 3.2, 6.4, 2.8],
      [1.8, 5.2, -0.5, 2.6, 10.4, 2.4],
      [6.4, 3.8, 0.5, 3.0, 7.6, 2.6],
    ].forEach(([x, y, z, w, h, d]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat);
      b.position.set(x, y, z);
      citySkyline.add(b);
    });

    // Twin Smokestacks outside
    [-4.2, -2.5].forEach((sx) => {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.58, 8.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })
      );
      stack.position.set(sx, 4.1, 1.5);
      citySkyline.add(stack);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.48, 0.8, 12),
        new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.4 })
      );
      band.position.set(sx, 7.1, 1.5);
      citySkyline.add(band);
    });

    const smogClouds: THREE.Mesh[] = [];
    const smogMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.72,
      roughness: 0.95,
    });
    for (let i = 0; i < 8; i++) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95 + (i % 3) * 0.25, 1), smogMat);
      puff.position.set(-4.3 + (i % 2) * 1.8, 8.4 + (i % 4) * 1.1, 1.5);
      puff.userData.baseY = puff.position.y;
      smogClouds.push(puff);
      citySkyline.add(puff);
    }
    group.add(citySkyline);

    // Floating Digital City Map on Central Tactical Holo-Table
    const mapPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.9, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 })
    );
    mapPedestal.position.set(0, 0.55, -0.4);
    group.add(mapPedestal);

    const holoCityGrid = new THREE.Group();
    holoCityGrid.position.set(0, 1.55, -0.4);
    const holoMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.75,
    });
    for (let i = 0; i < 6; i++) {
      const h = 0.45 + (i % 3) * 0.42;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), holoMat);
      bar.position.set(-1.1 + (i % 3) * 1.1, h / 2, i < 3 ? -0.5 : 0.5);
      holoCityGrid.add(bar);
    }
    group.add(holoCityGrid);

    // Holographic Air Quality Monitoring Screens
    const aqiScreen = buildHoloScreen(
      'PEMANTAU UDARA (IPU)',
      ['ZON INDUSTRI: 185 (TIDAK SIHAT)', 'GAS SO2: HUJAN ASID', 'JEREBU: KENDERAAN & KILANG'],
      '#2dd4bf',
      4.1,
      2.4,
      maxAnisotropy
    );
    aqiScreen.position.set(-4.8, 3.7, -2.2);
    aqiScreen.rotation.y = 0.45;
    group.add(aqiScreen);

    const analysisScreen = buildHoloScreen(
      'PANEL ANALISIS PUNCA-KESAN',
      ['1. ASAP KILANG -> SESAK NAFAS', '2. JEREBU -> ASMA MURID', '3. GAS BERACUN -> DAUN LAYU'],
      '#facc15',
      4.1,
      2.4,
      maxAnisotropy
    );
    analysisScreen.position.set(4.8, 3.7, -2.2);
    analysisScreen.rotation.y = -0.45;
    group.add(analysisScreen);

    const portal = buildEntrancePortal(0x2dd4bf);
    portal.group.position.set(-6.8, 0, 3.4);
    portal.group.rotation.y = 0.75;
    group.add(portal.group);

    animateFn = (elapsed, dt, restored) => {
      holoCityGrid.rotation.y += dt * 0.45;
      aqiScreen.position.y = 3.7 + Math.sin(elapsed * 1.8) * 0.15;
      analysisScreen.position.y = 3.7 + Math.sin(elapsed * 1.8 + 1.1) * 0.15;
      portal.ring.rotation.z += dt * 1.1;
      smogClouds.forEach((p, idx) => {
        p.position.y = (p.userData.baseY as number) + Math.sin(elapsed * 1.5 + idx) * 0.4;
        const targetScale = restored ? 0.05 : 1.0;
        p.scale.setScalar(THREE.MathUtils.damp(p.scale.x, targetScale, 3, dt));
        p.visible = !restored || p.scale.x > 0.08;
      });
    };
  } else if (roomId === 3) {
    // =========================================================================
    // MISSION ROOM 03: THE FOREST OF HOPE SANCTUARY
    // =========================================================================
    bgColor = 0x042318;
    fogColor = 0x042318;
    cameraPos = [0, 5.0, 11.4];
    cameraTarget = [0, 2.2, -1.6];

    group.add(buildRoomShell(20, 15, 0x062e1e, 0x22c55e));

    const forestLight = new THREE.PointLight(0x4ade80, 22, 24);
    forestLight.position.set(0, 5.8, 1);
    const goldLight = new THREE.PointLight(0xfacc15, 16, 20);
    goldLight.position.set(0, 3.2, -2);
    group.add(forestLight, goldLight);

    // Glass wall overlooking Tropical Waterfall
    const glassWall = new THREE.Mesh(
      new THREE.PlaneGeometry(16.0, 5.6),
      new THREE.MeshPhysicalMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.14,
        roughness: 0.08,
        depthWrite: false,
      })
    );
    glassWall.position.set(0, 4.1, -6.9);
    group.add(glassWall);

    // Cliff & Animated Waterfall outside glass wall
    const cliff = new THREE.Mesh(
      new THREE.BoxGeometry(10, 8.5, 3.5),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
    );
    cliff.position.set(0, 4.2, -13.5);
    group.add(cliff);

    const waterfallMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.85,
    });
    const waterfall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 8.4, 0.5), waterfallMat);
    waterfall.position.set(0, 4.2, -11.6);
    group.add(waterfall);

    const splashPool = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 5.5, 0.25, 24),
      waterfallMat
    );
    splashPool.position.set(0, 0.12, -10.8);
    group.add(splashPool);

    // Giant Tropical Trees surrounding the sanctuary
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });
    const glowPlantMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x22c55e,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });

    [
      [-7.2, -3.5],
      [7.2, -3.5],
      [-7.4, 2.2],
      [7.4, 2.2],
    ].forEach(([tx, tz]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 6.2, 10), trunkMat);
      trunk.position.set(tx, 3.1, tz);
      group.add(trunk);

      const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 1), leafMat);
      canopy.position.set(tx, 6.4, tz);
      group.add(canopy);

      const fern = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), glowPlantMat);
      fern.position.set(tx * 0.78, 0.65, tz);
      group.add(fern);
    });

    // Magical Golden Fireflies
    const fireflies: THREE.Mesh[] = [];
    const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let i = 0; i < 18; i++) {
      const ff = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), fireflyMat);
      ff.position.set(Math.sin(i * 1.7) * 6.2, 1.5 + (i % 5) * 0.75, Math.cos(i * 1.3) * 4.5);
      ff.userData = { baseX: ff.position.x, baseY: ff.position.y, baseZ: ff.position.z, phase: i };
      fireflies.push(ff);
      group.add(ff);
    }

    // Digital Decision Table & 3 Floating Holographic Solution Cards
    const decisionTable = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.2, 1.05, 24),
      new THREE.MeshStandardMaterial({ color: 0x064e3b, metalness: 0.55, roughness: 0.3 })
    );
    decisionTable.position.set(0, 0.52, -0.4);
    group.add(decisionTable);

    const cardA = buildHoloScreen(
      'PILIHAN A',
      ['TUTUP SEMUA KILANG', '+ UDARA PULIH PANTAS', '- EKONOMI TERJEJAS'],
      '#fb7185',
      2.9,
      1.9,
      maxAnisotropy
    );
    cardA.position.set(-4.1, 3.2, -1.6);
    cardA.rotation.y = 0.38;

    const cardB = buildHoloScreen(
      'PILIHAN B (SEIMBANG)',
      ['PENAPIS ASAP + HUTAN', '+ KELESTARIAN MAMPAN', '+ EKONOMI TERPELIHARA'],
      '#facc15',
      3.1,
      2.05,
      maxAnisotropy
    );
    cardB.position.set(0, 3.45, -2.0);

    const cardC = buildHoloScreen(
      'PILIHAN C',
      ['EDAR TOPENG SAHAJA', '+ KOS RENDAH', '- PUNCA MASIH KEKAL'],
      '#38bdf8',
      2.9,
      1.9,
      maxAnisotropy
    );
    cardC.position.set(4.1, 3.2, -1.6);
    cardC.rotation.y = -0.38;

    group.add(cardA, cardB, cardC);

    const portal = buildEntrancePortal(0xfacc15);
    portal.group.position.set(-6.6, 0, 3.6);
    portal.group.rotation.y = 0.75;
    group.add(portal.group);

    animateFn = (elapsed, dt, restored) => {
      cardA.position.y = 3.2 + Math.sin(elapsed * 2.0) * 0.14;
      cardB.position.y = 3.45 + Math.sin(elapsed * 2.2 + 0.8) * 0.16;
      cardC.position.y = 3.2 + Math.sin(elapsed * 2.0 + 1.6) * 0.14;
      portal.ring.rotation.z += dt * (restored ? 2.0 : 1.0);
      fireflies.forEach((ff) => {
        const { baseX, baseY, baseZ, phase } = ff.userData as {
          baseX: number;
          baseY: number;
          baseZ: number;
          phase: number;
        };
        ff.position.x = baseX + Math.sin(elapsed * 1.4 + phase) * 0.6;
        ff.position.y = baseY + Math.cos(elapsed * 1.9 + phase) * 0.45;
        ff.position.z = baseZ + Math.sin(elapsed * 1.1 + phase * 2) * 0.5;
      });
    };
  } else if (roomId === 4) {
    // =========================================================================
    // MISSION ROOM 04: THE VOICE COMMAND LAB
    // =========================================================================
    bgColor = 0x091128;
    fogColor = 0x091128;
    cameraPos = [0, 4.9, 11.4];
    cameraTarget = [0, 2.3, -1.2];

    group.add(buildRoomShell(19, 15, 0x0f172a, 0x38bdf8));

    const studioLightA = new THREE.PointLight(0x2dd4bf, 22, 24);
    studioLightA.position.set(0, 5.5, 0);
    const studioLightB = new THREE.PointLight(0xfacc15, 18, 22);
    studioLightB.position.set(0, 3.2, -2);
    group.add(studioLightA, studioLightB);

    // Central Acoustic Stage + Giant Glowing Golden Microphone
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 0.55, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.25 })
    );
    stage.position.set(0, 0.28, -0.6);
    group.add(stage);

    const micPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 2.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 })
    );
    micPole.position.set(0, 1.65, -0.6);
    group.add(micPole);

    const micHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.75,
        metalness: 0.85,
        roughness: 0.18,
      })
    );
    micHead.position.set(0, 3.05, -0.6);
    group.add(micHead);

    // Floating Concentric Sound Wave Holograms
    const waveRings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(1.5 + i * 0.72, 0.06, 10, 42),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0x2dd4bf : 0xfacc15,
          emissive: i % 2 === 0 ? 0x14b8a6 : 0xeab308,
          emissiveIntensity: 0.9,
          roughness: 0.2,
        })
      );
      r.rotation.x = Math.PI / 2;
      r.position.set(0, 1.8 + i * 0.85, -0.6);
      r.userData.baseY = r.position.y;
      waveRings.push(r);
      group.add(r);
    }

    // Glass Recording Booth on Left
    const boothGlass = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 3.6, 3.2),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        depthWrite: false,
      })
    );
    boothGlass.position.set(-5.8, 1.8, -2.4);
    group.add(boothGlass);

    // Digital Speech Analysis & Presentation Screens
    const speechScreen = buildHoloScreen(
      'ANALISIS SUARA & HUJAH',
      ['1. PENDIRIAN TEGAS', '2. BUKTI TERSURAT & TERSIRAT', '3. PENANDA WACANA BAKU'],
      '#2dd4bf',
      4.0,
      2.4,
      maxAnisotropy
    );
    speechScreen.position.set(-4.6, 4.1, -3.5);
    speechScreen.rotation.y = 0.4;

    const pitchScreen = buildHoloScreen(
      'PAPAN PEMBENTANGAN',
      ['SEBUTAN: JELAS & BAKU', 'INTONASI: BERSEMANGAT', 'RAKAMAN MIKROFON: SEDIA'],
      '#facc15',
      4.0,
      2.4,
      maxAnisotropy
    );
    pitchScreen.position.set(4.6, 4.1, -3.5);
    pitchScreen.rotation.y = -0.4;
    group.add(speechScreen, pitchScreen);

    const portal = buildEntrancePortal(0x38bdf8);
    portal.group.position.set(6.5, 0, 3.2);
    portal.group.rotation.y = -0.75;
    group.add(portal.group);

    animateFn = (elapsed, dt, restored) => {
      micHead.rotation.y += dt * 0.8;
      portal.ring.rotation.z += dt * 1.1;
      waveRings.forEach((ring, idx) => {
        ring.position.y = (ring.userData.baseY as number) + Math.sin(elapsed * 3.0 + idx) * 0.18;
        const pulse = 1 + Math.sin(elapsed * (restored ? 5.2 : 2.8) + idx * 0.7) * 0.11;
        ring.scale.set(pulse, pulse, 1);
      });
    };
  } else {
    // =========================================================================
    // MISSION ROOM 05: FUTURISTIC LIVE PODCAST & RADIO BROADCAST STUDIO
    // =========================================================================
    return buildPodcastStudioRoom(maxAnisotropy);
  }

  return {
    id: roomId,
    group,
    cameraPos,
    cameraTarget,
    bgColor,
    fogColor,
    animate: animateFn,
    dispose: () => {
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
    },
  };
}
