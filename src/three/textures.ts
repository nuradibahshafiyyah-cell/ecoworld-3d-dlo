import * as THREE from 'three';

export function createTerrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Vibrant emerald-to-lime adventure meadow gradient
  const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
  grad.addColorStop(0, '#65c449');
  grad.addColorStop(0.5, '#4fb343');
  grad.addColorStop(0.84, '#3d993b');
  grad.addColorStop(1, '#7c9a5e'); // rocky grassy cliff rim
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Sunny grass tufts, clover patches & wildflower speckles
  for (let i = 0; i < 4800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const dist = Math.hypot(x - 256, y - 256);
    if (dist > 228) {
      ctx.fillStyle =
        Math.random() > 0.5 ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.25)';
      ctx.fillRect(x, y, 4, 4);
    } else {
      ctx.fillStyle =
        Math.random() > 0.45 ? 'rgba(163, 230, 53, 0.22)' : 'rgba(22, 163, 74, 0.2)';
      ctx.fillRect(x, y, 3, 5);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWaterFlowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#06b6d4');
  grad.addColorStop(0.5, '#22d3ee');
  grad.addColorStop(1, '#0ea5e9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Flowing white/aqua current streaks
  for (let i = 0; i < 38; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 26 + Math.random() * 44;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,0.52)' : 'rgba(186,230,253,0.45)';
    ctx.lineWidth = 2 + (i % 3);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + 6, x + len, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWaterfallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#22d3ee');
  grad.addColorStop(0.65, '#38bdf8');
  grad.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  for (let i = 0; i < 34; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(186,230,253,0.48)';
    ctx.fillRect(x, y, 4 + (i % 4), 28 + (i % 30));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStonePathTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e7dcc8';
  ctx.fillRect(0, 0, 256, 128);

  const stoneColors = ['#f5efe2', '#dfd2ba', '#ede3d1', '#d6c6aa'];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const x = c * 42 + (r % 2) * 18 + 3;
      const y = r * 32 + 3;
      ctx.fillStyle = stoneColors[(r * 6 + c) % stoneColors.length];
      roundRect(ctx, x % 248, y, 34, 24, 6);
      ctx.fill();
      ctx.strokeStyle = '#bca98a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPlazaTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 100, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 128, 72, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createEarthTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Bright radiant turquoise-blue ocean
  const ocean = ctx.createLinearGradient(0, 0, 0, 256);
  ocean.addColorStop(0, '#0ea5e9');
  ocean.addColorStop(0.5, '#0284c7');
  ocean.addColorStop(1, '#06b6d4');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, 512, 256);

  // Vibrant emerald-lime continents
  ctx.fillStyle = '#4ade80';
  const blobs = [
    [95, 90, 48, 34],
    [130, 155, 28, 42],
    [255, 85, 58, 38],
    [275, 145, 36, 48],
    [380, 95, 62, 36],
    [415, 170, 32, 24],
  ];
  blobs.forEach(([cx, cy, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0.25, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft white clouds & polar ice caps
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  [
    [175, 65, 34, 10],
    [320, 120, 44, 11],
    [440, 75, 28, 9],
  ].forEach(([cx, cy, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0.1, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 240, 512, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMetalHazardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#0f172a';
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 144, 128);
    ctx.lineTo(i + 128, 128);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.45)');
  grad.addColorStop(0.6, 'rgba(2, 6, 23, 0.18)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFloatingLabelSprite(
  title: string,
  subtitle: string,
  accentHex: string
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 152;
  const ctx = canvas.getContext('2d')!;

  // Soft outer drop shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.48)';
  roundRect(ctx, 18, 22, 524, 118, 28);
  ctx.fill();

  // Game-style deep sapphire badge card
  const bg = ctx.createLinearGradient(0, 12, 0, 130);
  bg.addColorStop(0, '#0f294a');
  bg.addColorStop(1, '#08182e');
  ctx.fillStyle = bg;
  roundRect(ctx, 14, 14, 528, 118, 28);
  ctx.fill();

  // Glowing accent border
  ctx.lineWidth = 5;
  ctx.strokeStyle = accentHex;
  roundRect(ctx, 14, 14, 528, 118, 28);
  ctx.stroke();

  // Golden star icon medallion on left
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(64, 73, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', 64, 74);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Fredoka", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 108, 66, 416);

  ctx.fillStyle = accentHex;
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle, 108, 104);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(7.1, 1.92, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
