// Procedural Canvas2D textures for roads, skyscrapers, art-deco hotels, ocean, beach, containers, and sky.

const THREE = window.THREE;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function createSkyTexture(mood = 'golden') {
  const c = makeCanvas(512, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  if (mood === 'dusk') {
    grad.addColorStop(0.0, '#0a1026');
    grad.addColorStop(0.24, '#1b2654');
    grad.addColorStop(0.42, '#5a3269');
    grad.addColorStop(0.51, '#c8506c');
    grad.addColorStop(0.58, '#f59852');
    grad.addColorStop(0.72, '#3b2444');
    grad.addColorStop(1.0, '#121526');
  } else if (mood === 'sunset') {
    grad.addColorStop(0.0, '#16255c');
    grad.addColorStop(0.24, '#3e3d85');
    grad.addColorStop(0.40, '#a44b7f');
    grad.addColorStop(0.49, '#f27262');
    grad.addColorStop(0.56, '#ffbd69');
    grad.addColorStop(0.70, '#f4996e');
    grad.addColorStop(1.0, '#3a2b4a');
  } else {
    // Rich golden-hour Miami/Keys sky (horizon is at y = 0.50 on SphereGeometry!)
    grad.addColorStop(0.0, '#183f7e');
    grad.addColorStop(0.20, '#2e65a3');
    grad.addColorStop(0.35, '#8678ad');
    grad.addColorStop(0.44, '#e87e78');
    grad.addColorStop(0.50, '#ffbe6b');
    grad.addColorStop(0.56, '#ffe5a3');
    grad.addColorStop(0.72, '#e3a67c');
    grad.addColorStop(1.0, '#5a4e68');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);

  // Wispy backlit golden-coral clouds positioned above the horizon (y = 74..122)
  for (let i = 0; i < 42; i++) {
    const cx = (i * 67 + 19) % 512;
    const cy = 72 + ((i * 23) % 52);
    const rx = 24 + (i % 5) * 14;
    const ry = 3.5 + (i % 3) * 2.5;
    const cg = g.createRadialGradient(cx, cy, 2, cx, cy, rx);
    if (mood === 'dusk') {
      cg.addColorStop(0, 'rgba(255, 148, 122, 0.36)');
      cg.addColorStop(1, 'rgba(255, 148, 122, 0)');
    } else {
      cg.addColorStop(0, 'rgba(255, 232, 186, 0.50)');
      cg.addColorStop(1, 'rgba(255, 165, 130, 0)');
    }
    g.fillStyle = cg;
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry / rx);
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Radiant setting sun right above the horizon over Solara Bay
  const sunX = 164;
  const sunY = mood === 'dusk' ? 128 : 114;
  const halo = g.createRadialGradient(sunX, sunY, 5, sunX, sunY, 74);
  halo.addColorStop(0, 'rgba(255, 252, 230, 0.98)');
  halo.addColorStop(0.18, 'rgba(255, 215, 135, 0.78)');
  halo.addColorStop(0.48, 'rgba(255, 126, 92, 0.32)');
  halo.addColorStop(1, 'rgba(255, 126, 92, 0)');
  g.fillStyle = halo;
  g.beginPath();
  g.arc(sunX, sunY, 74, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createRoadTexture() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#252932';
  g.fillRect(0, 0, 256, 256);

  // Subtle asphalt grain
  for (let i = 0; i < 1800; i++) {
    const x = (i * 97) % 256;
    const y = (i * 53) % 256;
    const v = 32 + (i % 18);
    g.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    g.fillRect(x, y, 2, 2);
  }

  // Crisp edge lines
  g.fillStyle = 'rgba(240, 245, 255, 0.72)';
  g.fillRect(10, 0, 5, 256);
  g.fillRect(241, 0, 5, 256);

  // Double amber center divider
  g.fillStyle = '#f5b83d';
  g.fillRect(122, 0, 4, 256);
  g.fillRect(130, 0, 4, 256);

  // Subtle tire wear tracks
  g.fillStyle = 'rgba(12, 14, 20, 0.28)';
  g.fillRect(48, 0, 28, 256);
  g.fillRect(180, 0, 28, 256);

  return toTexture(c, 1, 1);
}

export function createIntersectionTexture() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#262b35';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(244, 248, 255, 0.85)';
  // Crosswalks on all 4 edges
  for (let i = 0; i < 6; i++) {
    const offset = 28 + i * 36;
    g.fillRect(offset, 8, 20, 28);
    g.fillRect(offset, 220, 20, 28);
    g.fillRect(8, offset, 28, 20);
    g.fillRect(220, offset, 28, 20);
  }
  return toTexture(c, 1, 1);
}

export function createSkyscraperTexture(baseHex, litHex, accentHex, seed = 1) {
  const c = makeCanvas(256, 512);
  const g = c.getContext('2d');
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 256, 512);

  // Vertical glass mullions
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = 0; x < 256; x += 32) {
    g.fillRect(x, 0, 3, 512);
  }

  // Lit & reflective window grid
  let h = seed * 1337;
  const cols = 8;
  const rows = 20;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const roll = (h & 255) / 255;
      const wx = col * 32 + 5;
      const wy = r * 25 + 5;
      if (roll > 0.52) {
        g.fillStyle = roll > 0.84 ? accentHex : litHex;
        g.globalAlpha = 0.55 + (roll - 0.52) * 0.9;
      } else {
        g.fillStyle = '#182742';
        g.globalAlpha = 0.85;
      }
      g.fillRect(wx, wy, 22, 16);
      // Sunset sky reflection highlight along top of pane
      g.fillStyle = 'rgba(255, 198, 155, 0.22)';
      g.globalAlpha = 1;
      g.fillRect(wx, wy, 22, 4);
    }
  }
  g.globalAlpha = 1;

  // Floor slab bands
  g.fillStyle = 'rgba(10, 14, 24, 0.45)';
  for (let r = 0; r < rows; r++) {
    g.fillRect(0, r * 25, 256, 3);
  }

  return toTexture(c, 1, 1);
}

export function createArtDecoTexture(wallHex, trimHex, seed = 1) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = wallHex;
  g.fillRect(0, 0, 256, 256);

  // Horizontal art-deco speedlines
  g.fillStyle = trimHex;
  g.fillRect(0, 12, 256, 8);
  g.fillRect(0, 28, 256, 4);
  g.fillRect(0, 210, 256, 10);

  // Arched/balcony hotel windows
  let h = seed * 7919;
  for (let r = 0; r < 4; r++) {
    for (let col = 0; col < 5; col++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const lit = ((h >>> 16) & 15) > 5;
      const wx = 14 + col * 48;
      const wy = 44 + r * 42;
      g.fillStyle = lit ? '#ffe6a8' : '#263b52';
      g.fillRect(wx, wy, 28, 24);
      // Balcony rail
      g.fillStyle = '#ffffff';
      g.fillRect(wx - 4, wy + 22, 36, 4);
    }
  }
  return toTexture(c, 1, 1);
}

export function createContainerTexture(colorHex) {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = colorHex;
  g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 12) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x, 0, 4, 128);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x + 4, 0, 3, 128);
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);
  return toTexture(c, 1, 1);
}

export function createOceanTexture() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#0d7c94';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 24) {
      const shift = (y % 16) * 0.7;
      g.fillStyle = y % 16 === 0 ? 'rgba(90, 232, 235, 0.28)' : 'rgba(255, 212, 155, 0.22)';
      g.fillRect((x + shift) % 256, y, 16, 3);
    }
  }
  return toTexture(c, 22, 22);
}

export function createSandTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#e8c48d';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 650; i++) {
    const x = (i * 47) % 128;
    const y = (i * 83) % 128;
    g.fillStyle = i % 2 === 0 ? 'rgba(255,244,214,0.35)' : 'rgba(180,136,84,0.25)';
    g.fillRect(x, y, 2, 2);
  }
  return toTexture(c, 10, 30);
}

export function createNeonSignTexture(text, fgColor, bgColor = '#120c1f') {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bgColor;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fgColor;
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 108);
  g.font = 'bold 54px "Trebuchet MS", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fgColor;
  g.shadowBlur = 18;
  g.fillStyle = fgColor;
  g.fillText(text, 256, 66);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.font = 'bold 52px "Trebuchet MS", "Arial Black", sans-serif';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createGlowSpriteTexture(innerRgba, outerRgba) {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, innerRgba);
  grad.addColorStop(0.45, outerRgba);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createTexturePack() {
  return {
    road: createRoadTexture(),
    intersection: createIntersectionTexture(),
    ocean: createOceanTexture(),
    sand: createSandTexture(),
    skyGolden: createSkyTexture('golden'),
    skySunset: createSkyTexture('sunset'),
    skyDusk: createSkyTexture('dusk'),
    skyscrapers: [
      createSkyscraperTexture('#1e314d', '#ffd796', '#4ef2ff', 11),
      createSkyscraperTexture('#253657', '#ffbe7b', '#ff6fa5', 23),
      createSkyscraperTexture('#19293f', '#ffe8a8', '#52f7c8', 37),
      createSkyscraperTexture('#2e334d', '#ffc985', '#ff9452', 51),
    ],
    artDeco: [
      createArtDecoTexture('#f5b7c8', '#38e8ff', 7),
      createArtDecoTexture('#a8e6cf', '#ff6b9d', 13),
      createArtDecoTexture('#fce2b6', '#ff7b54', 19),
      createArtDecoTexture('#b8d8f8', '#ff66aa', 29),
    ],
    containers: [
      createContainerTexture('#c73e3a'),
      createContainerTexture('#1e7a8c'),
      createContainerTexture('#d99326'),
      createContainerTexture('#2d476e'),
    ],
    glowWarm: createGlowSpriteTexture('rgba(255,230,170,0.95)', 'rgba(255,165,80,0.35)'),
    glowCyan: createGlowSpriteTexture('rgba(150,250,255,0.95)', 'rgba(30,210,255,0.32)'),
    glowRed: createGlowSpriteTexture('rgba(255,120,120,0.95)', 'rgba(255,35,55,0.38)'),
    glowBlue: createGlowSpriteTexture('rgba(120,190,255,0.95)', 'rgba(35,120,255,0.38)'),
    shadowDisc: createGlowSpriteTexture('rgba(5,8,16,0.72)', 'rgba(5,8,16,0.28)'),
  };
}
