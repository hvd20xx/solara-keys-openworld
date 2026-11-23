// Procedural 3D open-world metropolis: 5 districts, road network, palms, beach, ocean, docks, and Safehouse Garage.

import { WORLD, getDistrictAt } from './config.js';
import { createRng, pick, randRange } from './random.js';
import { createNeonSignTexture } from './textures.js';

const THREE = window.THREE;

const HOTEL_NAMES = [
  'SOLARA PALMS',
  'CORAL CLUB',
  'KEY HAVEN',
  'TIDE LOUNGE',
  'AZURE ROYALE',
  'SUNSET TERRACE',
];

const TOWER_NAMES = [
  'MERIDIAN CORP',
  'SOLARA BANK',
  'VORTEX MEDIA',
  'KEYS TELECOM',
  'OCEANIC TOWER',
];

export function buildPalmTree(rng) {
  const group = new THREE.Group();
  const height = randRange(rng, 7.5, 11.2);
  const leanX = randRange(rng, -0.9, 0.9);
  const leanZ = randRange(rng, -0.9, 0.9);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7c5c43 });

  const segs = 5;
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const rBot = 0.34 - t0 * 0.14;
    const rTop = 0.34 - t1 * 0.14;
    const segH = height / segs;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH + 0.12, 6), trunkMat);
    const nx = leanX * t1 * t1;
    const nz = leanZ * t1 * t1;
    seg.position.set((px + nx) * 0.5, py + segH * 0.5, (pz + nz) * 0.5);
    seg.rotation.z = -(nx - px) * 0.45;
    seg.rotation.x = (nz - pz) * 0.45;
    group.add(seg);
    px = nx;
    py += segH;
    pz = nz;
  }

  // Lush palm fronds radiating from crown
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f8f46, side: THREE.DoubleSide });
  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const a = (i / frondCount) * Math.PI * 2 + rng() * 0.3;
    const frond = new THREE.Group();
    frond.position.set(px, py - 0.15, pz);
    frond.rotation.y = a;

    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 2.3), frondMat);
    blade1.position.set(0, 0.25, 1.1);
    blade1.rotation.x = -0.22;
    frond.add(blade1);

    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 1.9), frondMat);
    blade2.position.set(0, -0.15, 2.7);
    blade2.rotation.x = 0.38;
    frond.add(blade2);

    group.add(frond);
  }
  return group;
}

export function buildStreetLamp(textures) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3b4454 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 7.2, 6), poleMat);
  pole.position.y = 3.6;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.12), poleMat);
  arm.position.set(0.75, 7.1, 0);
  g.add(arm);

  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.14, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xffe4ad }),
  );
  bulb.position.set(1.45, 7.0, 0);
  g.add(bulb);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textures.glowWarm,
      color: 0xffd58c,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.set(1.45, 6.85, 0);
  halo.scale.set(4.5, 4.5, 1);
  g.add(halo);
  return g;
}

function buildYacht(rng) {
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshPhongMaterial({ color: 0xf6f8fc, shininess: 80 });
  const trimMat = new THREE.MeshPhongMaterial({ color: pick(rng, [0x1c7ed6, 0xff5a7a, 0x1aa89c]), shininess: 60 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x162436, shininess: 120 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 10.5), hullMat);
  hull.position.y = 0.5;
  boat.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.35, 3.6, 4), hullMat);
  bow.rotation.x = Math.PI * 0.5;
  bow.rotation.y = Math.PI * 0.25;
  bow.scale.set(1.0, 1.0, 0.55);
  bow.position.set(0, 0.52, 6.8);
  boat.add(bow);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.48, 0.26, 10.2), trimMat);
  stripe.position.y = 0.72;
  boat.add(stripe);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.35, 4.8), hullMat);
  cabin.position.set(0, 1.7, -0.6);
  boat.add(cabin);

  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.55, 3.8), glassMat);
  windowBand.position.set(0, 1.82, -0.1);
  boat.add(windowBand);

  return boat;
}

export function buildCity(scene, textures, seed = 42) {
  const rng = createRng(seed);
  const colliders = [];
  const buildings = [];
  const minimapBuildings = [];
  const animatedProps = [];

  // Sky dome
  const skyMat = new THREE.MeshBasicMaterial({ map: textures.skyGolden, side: THREE.BackSide, depthWrite: false, fog: false });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 18), skyMat);
  scene.add(skyDome);

  // Main urban ground base
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 440),
    new THREE.MeshLambertMaterial({ color: 0x454952 }),
  );
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.set(-14, -0.08, -6);
  scene.add(ground);

  // Golden beach strip along Palm Strip east coast
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 430),
    new THREE.MeshLambertMaterial({ map: textures.sand }),
  );
  beach.rotation.x = -Math.PI * 0.5;
  beach.position.set(213, -0.04, -14);
  scene.add(beach);

  // Coastal timber boardwalk beside Ocean Blvd
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 0.22, 390),
    new THREE.MeshLambertMaterial({ color: 0x9b7252 }),
  );
  boardwalk.position.set(194, 0.08, -10);
  scene.add(boardwalk);

  // Animated turquoise Solara Bay ocean wrapping east & south coastlines
  const oceanMat = new THREE.MeshPhongMaterial({
    map: textures.ocean,
    color: 0x20b9c9,
    emissive: 0x0a384a,
    specular: 0xffd2a0,
    shininess: 95,
  });
  const oceanEast = new THREE.Mesh(new THREE.PlaneGeometry(420, 960), oceanMat);
  oceanEast.rotation.x = -Math.PI * 0.5;
  oceanEast.position.set(432, -0.32, 40);
  scene.add(oceanEast);

  const oceanSouth = new THREE.Mesh(new THREE.PlaneGeometry(920, 380), oceanMat);
  oceanSouth.rotation.x = -Math.PI * 0.5;
  oceanSouth.position.set(20, -0.32, 396);
  scene.add(oceanSouth);

  // Causeway Heights turquoise canal strip (west side)
  const canal = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 290),
    oceanMat,
  );
  canal.rotation.x = -Math.PI * 0.5;
  canal.position.set(-150, -0.22, -40);
  scene.add(canal);

  // Road grid (N-S & E-W boulevards + crosswalk intersections)
  const roadMatV = new THREE.MeshLambertMaterial({ map: textures.road });
  const roadMatH = new THREE.MeshLambertMaterial({ map: textures.road.clone() });
  roadMatH.map.needsUpdate = true;
  roadMatH.map.center.set(0.5, 0.5);
  roadMatH.map.rotation = Math.PI * 0.5;
  const interMat = new THREE.MeshLambertMaterial({ map: textures.intersection });

  const roadCenters = WORLD.roadCenters;
  const rw = WORLD.roadWidth;

  for (const cx of roadCenters) {
    for (let i = 0; i < roadCenters.length - 1; i++) {
      const z0 = roadCenters[i] + rw * 0.5;
      const z1 = roadCenters[i + 1] - rw * 0.5;
      const segLen = z1 - z0;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rw, segLen), roadMatV);
      mesh.rotation.x = -Math.PI * 0.5;
      mesh.position.set(cx, 0.02, (z0 + z1) * 0.5);
      scene.add(mesh);
    }
  }

  for (const cz of roadCenters) {
    for (let i = 0; i < roadCenters.length - 1; i++) {
      const x0 = roadCenters[i] + rw * 0.5;
      const x1 = roadCenters[i + 1] - rw * 0.5;
      const segLen = x1 - x0;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(segLen, rw), roadMatH);
      mesh.rotation.x = -Math.PI * 0.5;
      mesh.position.set((x0 + x1) * 0.5, 0.025, cz);
      scene.add(mesh);

      // Bridge railings where road spans Causeway canal at x = -150
      if (x0 < -150 && x1 > -150 && cz <= 120) {
        const railMat = new THREE.MeshLambertMaterial({ color: 0xe6e0d4 });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, rw + 2.4), railMat);
        deck.position.set(-150, -0.05, cz);
        scene.add(deck);
        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 0.45), railMat);
          rail.position.set(-150, 0.55, cz + side * (rw * 0.5 + 1.0));
          scene.add(rail);
        }
      }
    }
  }

  for (const cx of roadCenters) {
    for (const cz of roadCenters) {
      const inter = new THREE.Mesh(new THREE.PlaneGeometry(rw, rw), interMat);
      inter.rotation.x = -Math.PI * 0.5;
      inter.position.set(cx, 0.03, cz);
      scene.add(inter);
    }
  }

  // City blocks inside the road grid
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0aa });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x353c48 });

  let hotelIdx = 0;
  let towerIdx = 0;

  for (let bx = 0; bx < roadCenters.length - 1; bx++) {
    for (let bz = 0; bz < roadCenters.length - 1; bz++) {
      const cx = (roadCenters[bx] + roadCenters[bx + 1]) * 0.5;
      const cz = (roadCenters[bz] + roadCenters[bz + 1]) * 0.5;
      const blockSpan = WORLD.roadStep - rw; // 46 units

      // Skip canal column blocks at x = -150 (except south ochreyard)
      if (cx === -150 && cz < 120) {
        continue;
      }

      // Raised sidewalk pad
      const pad = new THREE.Mesh(new THREE.BoxGeometry(blockSpan, 0.24, blockSpan), sidewalkMat);
      pad.position.set(cx, 0.12, cz);
      scene.add(pad);

      // Special Safehouse Garage block at (-30, 150)
      if (cx === -30 && cz === 150) {
        buildSafehouseGarage(scene, cx, cz, textures, colliders, minimapBuildings);
        continue;
      }

      // Special Marina Docks Container Arena at (90..150, 150)
      if (cz === 150 && cx >= 90) {
        buildMarinaContainerBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings);
        continue;
      }

      const district = getDistrictAt(cx, cz);
      if (district.id === 'palm-strip') {
        buildArtDecoBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings, hotelIdx++);
      } else if (district.id === 'coral-downtown') {
        buildDowntownBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings, roofMat, towerIdx++);
      } else if (district.id === 'causeway-heights') {
        buildCausewayBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings);
      } else if (district.id === 'marina-docks') {
        buildMarinaContainerBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings);
      } else {
        buildOchreWarehouseBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings);
      }
    }
  }

  // Oceanfront Palm Trees, Beach Umbrellas, & Yachts along Palm Strip
  for (let z = -195; z <= 170; z += 19) {
    const palm = buildPalmTree(rng);
    palm.position.set(191, 0.15, z);
    scene.add(palm);

    if (z % 38 === 0) {
      const beachPalm = buildPalmTree(rng);
      beachPalm.position.set(206 + randRange(rng, -2, 3), 0, z + 6);
      scene.add(beachPalm);
    }

    // Colorful beach umbrellas on the golden sand
    if (Math.abs(z) < 165) {
      const umb = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5),
        new THREE.MeshLambertMaterial({ color: 0xeaeaea }),
      );
      pole.position.y = 1.3;
      umb.add(pole);
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(2.1, 0.7, 7),
        new THREE.MeshLambertMaterial({ color: pick(rng, [0xff5d8f, 0x2ec4b6, 0xffbe0b, 0x3a86ff]) }),
      );
      canopy.position.y = 2.6;
      umb.add(canopy);
      umb.position.set(214 + randRange(rng, -3, 3), 0, z);
      scene.add(umb);
    }
  }

  // Palm Boulevard medians & streetlamps on major avenues
  for (const rx of [-60, 0, 60, 120, 180]) {
    for (let z = -162; z <= 162; z += 30) {
      if (Math.abs(z % 60) < 12) continue;
      const lamp = buildStreetLamp(textures);
      lamp.position.set(rx - 8.4, 0.2, z);
      scene.add(lamp);
      if (rx === 180 || rx === 0) {
        const palm = buildPalmTree(rng);
        palm.position.set(rx + 8.9, 0.2, z + 6);
        scene.add(palm);
      }
    }
  }

  // Marina Wooden Piers jutting into turquoise southern bay + Gantry Crane
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x876348 });
  const pilingMat = new THREE.MeshLambertMaterial({ color: 0x4b382a });
  for (const px of [78, 132, 174]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(11, 0.55, 50), pierMat);
    pier.position.set(px, 0.45, 214);
    scene.add(pier);
    for (let pz = 194; pz <= 236; pz += 10) {
      for (const side of [-4.6, 4.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 2.2, 6), pilingMat);
        post.position.set(px + side, 0.2, pz);
        scene.add(post);
      }
    }
  }

  // Iconic Dockyard Gantry Crane at Marina Docks
  buildDockCrane(scene, 148, 188);

  // Floating luxury yachts on Solara Bay
  const yachtSpots = [
    { x: 248, z: -85, rot: 0.25 },
    { x: 266, z: 18, rot: -0.35 },
    { x: 252, z: 112, rot: 0.12 },
    { x: 105, z: 232, rot: 1.48 },
    { x: 155, z: 224, rot: 0.05 },
  ];
  for (const ys of yachtSpots) {
    const yacht = buildYacht(rng);
    yacht.position.set(ys.x, -0.2, ys.z);
    yacht.rotation.y = ys.rot;
    scene.add(yacht);
    animatedProps.push({ mesh: yacht, baseY: -0.2, phase: ys.x * 0.1 + ys.z * 0.05 });
  }

  return {
    colliders,
    buildings,
    minimapBuildings,
    skyDome,
    skyMat,
    oceanMat,
    update(time, dt) {
      textures.ocean.offset.x = (textures.ocean.offset.x + dt * 0.06) % 1;
      textures.ocean.offset.y = (textures.ocean.offset.y + dt * 0.035) % 1;
      for (const prop of animatedProps) {
        prop.mesh.position.y = prop.baseY + Math.sin(time * 1.6 + prop.phase) * 0.18;
        prop.mesh.rotation.z = Math.sin(time * 1.2 + prop.phase) * 0.03;
      }
    },
    setMood(mood) {
      skyMat.map = mood === 'dusk' ? textures.skyDusk : mood === 'sunset' ? textures.skySunset : textures.skyGolden;
      skyMat.needsUpdate = true;
    },
  };
}

function addBuildingBox(scene, cx, cz, w, h, d, mat, colliders, minimapBuildings, colorHex = '#4b5568') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(cx, h * 0.5 + 0.2, cz);
  scene.add(mesh);
  colliders.push({
    minX: cx - w * 0.5,
    maxX: cx + w * 0.5,
    minZ: cz - d * 0.5,
    maxZ: cz + d * 0.5,
    height: h,
  });
  minimapBuildings.push({ x: cx, z: cz, w, d, color: colorHex });
  return mesh;
}

function buildArtDecoBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings, idx) {
  const tex = textures.artDeco[idx % textures.artDeco.length];
  const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 22 });
  const w = randRange(rng, 25, 33);
  const d = randRange(rng, 25, 33);
  const h = randRange(rng, 16, 28);
  addBuildingBox(scene, cx, cz, w, h, d, mat, colliders, minimapBuildings, '#d47c99');

  // Art-Deco stepped parapet crown + neon accent strip
  const accentColor = pick(rng, [0x38e8ff, 0xff5ca8, 0xffc145, 0x3ef2b0]);
  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.65, 3.2, d * 0.65),
    new THREE.MeshLambertMaterial({ color: 0xfef4ea }),
  );
  parapet.position.set(cx, h + 1.8, cz);
  scene.add(parapet);

  const neonBand = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, 0.55, d + 0.5),
    new THREE.MeshBasicMaterial({ color: accentColor }),
  );
  neonBand.position.set(cx, h + 0.1, cz);
  scene.add(neonBand);

  // Vertical glowing hotel sign facing Ocean Blvd (east)
  const label = HOTEL_NAMES[idx % HOTEL_NAMES.length];
  const signTex = createNeonSignTexture(label, `#${accentColor.toString(16).padStart(6, '0')}`);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 3.4, 13.5),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  sign.position.set(cx + w * 0.5 + 0.4, Math.min(h - 3, 12), cz);
  scene.add(sign);
}

function buildDowntownBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings, roofMat, idx) {
  const tex = textures.skyscrapers[idx % textures.skyscrapers.length];
  const mat = new THREE.MeshPhongMaterial({ map: tex, specular: 0x8cc9ff, shininess: 68 });

  // Twin-tower or dramatic setback skyscraper
  const isHero = (Math.abs(cx) <= 40 && Math.abs(cz) <= 40) || idx % 3 === 0;
  const w = isHero ? randRange(rng, 26, 33) : randRange(rng, 22, 30);
  const d = isHero ? randRange(rng, 26, 33) : randRange(rng, 22, 30);
  const h = isHero ? randRange(rng, 48, 86) : randRange(rng, 30, 56);

  addBuildingBox(scene, cx, cz, w, h, d, mat, colliders, minimapBuildings, '#4e79a7');

  // Architectural setback tier & spire
  const tierH = randRange(rng, 7, 16);
  const tier = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, tierH, d * 0.62), mat);
  tier.position.set(cx, h + tierH * 0.5, cz);
  scene.add(tier);

  const neonColor = pick(rng, [0x38e8ff, 0xff6b9d, 0xffc857, 0x45f5c6]);
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.65, 0.75, d * 0.65),
    new THREE.MeshBasicMaterial({ color: neonColor }),
  );
  crown.position.set(cx, h + tierH + 0.35, cz);
  scene.add(crown);

  if (isHero) {
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.55, 14, 6),
      roofMat,
    );
    spire.position.set(cx, h + tierH + 7, cz);
    scene.add(spire);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b5c }),
    );
    beacon.position.set(cx, h + tierH + 14.2, cz);
    scene.add(beacon);

    // Rooftop brand sign
    const signTex = createNeonSignTexture(
      TOWER_NAMES[idx % TOWER_NAMES.length],
      `#${neonColor.toString(16).padStart(6, '0')}`,
    );
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(15, 3.6, 0.5),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sign.position.set(cx, h - 4, cz + d * 0.5 + 0.4);
    scene.add(sign);
  }
}

function buildCausewayBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings) {
  const stucco = pick(rng, [0xeed6bc, 0xe5c39c, 0xd9b392, 0xf2dfc9]);
  const roof = pick(rng, [0xb85336, 0xa8482f, 0xc26342]);
  const w = randRange(rng, 24, 32);
  const d = randRange(rng, 24, 32);
  const h = randRange(rng, 14, 26);

  const mat = new THREE.MeshLambertMaterial({ color: stucco });
  addBuildingBox(scene, cx, cz, w, h, d, mat, colliders, minimapBuildings, '#c99c74');

  // Terracotta cornice roof
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 1.4, d + 1.4), new THREE.MeshLambertMaterial({ color: roof }));
  cap.position.set(cx, h + 0.8, cz);
  scene.add(cap);

  // Warm illuminated window strips
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe09c });
  for (let y = 4; y < h - 2; y += 5) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 1.4, d * 0.72), winMat);
    strip.position.set(cx, y, cz);
    scene.add(strip);
  }
}

function buildOchreWarehouseBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings) {
  const wallColor = pick(rng, [0x7a513e, 0x625a54, 0x875f44, 0x565c66]);
  const w = randRange(rng, 28, 36);
  const d = randRange(rng, 22, 32);
  const h = randRange(rng, 10, 16);
  const mat = new THREE.MeshLambertMaterial({ color: wallColor });
  addBuildingBox(scene, cx, cz, w, h, d, mat, colliders, minimapBuildings, '#8a6b52');

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.8, 1.2, d + 0.8),
    new THREE.MeshLambertMaterial({ color: 0x3b4048 }),
  );
  roof.position.set(cx, h + 0.7, cz);
  scene.add(roof);
}

function buildMarinaContainerBlock(scene, cx, cz, rng, textures, colliders, minimapBuildings) {
  // Stacked shipping containers leaving combat lanes between stacks
  const slots = [
    { ox: -11, oz: -11, rot: 0 },
    { ox: 11, oz: -10, rot: 0 },
    { ox: -10, oz: 11, rot: Math.PI * 0.5 },
    { ox: 12, oz: 10, rot: 0 },
  ];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const tex = textures.containers[(i + Math.abs(Math.floor(cx))) % textures.containers.length];
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const cw = s.rot === 0 ? 11 : 4.2;
    const cd = s.rot === 0 ? 4.2 : 11;
    addBuildingBox(scene, cx + s.ox, cz + s.oz, cw, 4.2, cd, mat, colliders, minimapBuildings, '#2d8c8f');

    if (rng() > 0.35) {
      const topTex = textures.containers[(i + 2) % textures.containers.length];
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(cw, 4.0, cd),
        new THREE.MeshLambertMaterial({ map: topTex }),
      );
      upper.position.set(cx + s.ox, 6.4, cz + s.oz);
      scene.add(upper);
    }
  }
}

function buildSafehouseGarage(scene, cx, cz, textures, colliders, minimapBuildings) {
  // Iconic Cruz Safehouse Garage with glowing open front bay
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x383f4d });
  addBuildingBox(scene, cx, cz - 8, 30, 11, 16, bodyMat, colliders, minimapBuildings, '#ffaa33');

  // Neon roof sign
  const signTex = createNeonSignTexture('CRUZ GARAGE', '#38e8ff', '#161b29');
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 4.2, 0.7),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  sign.position.set(cx, 13.4, cz + 0.2);
  scene.add(sign);

  // Glowing open bay door recess
  const bay = new THREE.Mesh(
    new THREE.BoxGeometry(11, 6.2, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  );
  bay.position.set(cx, 3.3, cz + 0.1);
  scene.add(bay);

  // Neon cyan & amber apron framing the drive-in zone
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(30.4, 0.6, 16.4),
    new THREE.MeshBasicMaterial({ color: 0xff9f38 }),
  );
  strip.position.set(cx, 11.1, cz - 8);
  scene.add(strip);
}

function buildDockCrane(scene, x, z) {
  const crane = new THREE.Group();
  const steelMat = new THREE.MeshLambertMaterial({ color: 0xd9483b });
  for (const sx of [-7, 7]) {
    for (const sz of [-5, 5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 26, 1.1), steelMat);
      leg.position.set(sx, 13, sz);
      crane.add(leg);
    }
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 12), steelMat);
  cross.position.set(0, 26, 0);
  crane.add(cross);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 38), steelMat);
  boom.position.set(0, 27.6, 8);
  crane.add(boom);
  crane.position.set(x, 0, z);
  scene.add(crane);
}
