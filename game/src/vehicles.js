// Multi-part 3D vehicles, responsive driving/drift physics, lane-following traffic, and damage/fire effects.

import { VEHICLE_SPECS, WORLD } from './config.js';
import { createRng, pick, randRange } from './random.js';

const THREE = window.THREE;

export function resolveBuildingCollision(x, z, radius, colliders) {
  let nx = x;
  let nz = z;
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    const cx = Math.max(b.minX, Math.min(nx, b.maxX));
    const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      hit = true;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      } else {
        const dl = Math.abs(nx - b.minX);
        const dr = Math.abs(b.maxX - nx);
        const dt = Math.abs(nz - b.minZ);
        const db = Math.abs(b.maxZ - nz);
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) nx = b.minX - radius;
        else if (m === dr) nx = b.maxX + radius;
        else if (m === dt) nz = b.minZ - radius;
        else nz = b.maxZ + radius;
      }
    }
  }
  nx = Math.max(WORLD.minX, Math.min(WORLD.oceanStartX - 2, nx));
  nz = Math.max(WORLD.minZ, Math.min(WORLD.southOceanZ + 30, nz));
  return { x: nx, z: nz, hit };
}

export function buildVehicleMesh(spec, colorHex, textures) {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: colorHex, specular: 0xddeeff, shininess: 92 });
  const trimMat = new THREE.MeshPhongMaterial({ color: 0x1a1f28, shininess: 40 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x101c2c, specular: 0xaad8ff, shininess: 140, transparent: true, opacity: 0.88 });
  const whiteMat = new THREE.MeshPhongMaterial({ color: 0xf4f7fc, specular: 0xffffff, shininess: 85 });

  const w = spec.width;
  const h = spec.height;
  const l = spec.length;

  // Grounded soft contact shadow under vehicle
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.48, l * 1.24),
    new THREE.MeshBasicMaterial({ map: textures.shadowDisc, transparent: true, opacity: 0.78, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI * 0.5;
  shadow.position.y = 0.045;
  root.add(shadow);

  // Lower sculpted chassis
  const chassisH = spec.van ? h * 0.65 : h * 0.48;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, chassisH, l), bodyMat);
  chassis.position.y = 0.36 + chassisH * 0.5;
  root.add(chassis);

  // Police white center doors & hood accent
  if (spec.police && !spec.van) {
    const doorBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, chassisH * 0.88, l * 0.44), whiteMat);
    doorBand.position.set(0, 0.36 + chassisH * 0.5, -0.05);
    root.add(doorBand);

    // Front tactical pushbar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 0.42, 0.24), trimMat);
    bar.position.set(0, 0.56, l * 0.5 + 0.12);
    root.add(bar);
  }

  // Cabin greenhouse
  if (!spec.convertible) {
    const cabW = w * 0.86;
    const cabH = spec.van ? h * 0.32 : h * 0.44;
    const cabL = spec.van ? l * 0.86 : spec.suv ? l * 0.62 : l * 0.48;
    const cabZ = spec.van ? -0.1 : -0.22;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabL), spec.police && !spec.van ? whiteMat : bodyMat);
    cab.position.set(0, 0.36 + chassisH + cabH * 0.48, cabZ);
    root.add(cab);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.05, cabH * 0.7, cabL * 0.88), glassMat);
    glass.position.set(0, 0.36 + chassisH + cabH * 0.5, cabZ + 0.04);
    root.add(glass);
  } else {
    // Open convertible interior + swept windshield
    const interior = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.8, 0.35, l * 0.42),
      new THREE.MeshLambertMaterial({ color: 0xb98558 }),
    );
    interior.position.set(0, 0.36 + chassisH + 0.08, -0.18);
    root.add(interior);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.42, 0.1), glassMat);
    shield.position.set(0, 0.36 + chassisH + 0.28, 0.55);
    shield.rotation.x = -0.45;
    root.add(shield);
  }

  // Twin racing stripes on Cobalt GT
  if (spec.stripe) {
    for (const sx of [-0.24, 0.24]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, l * 0.96), whiteMat);
      stripe.position.set(sx, 0.36 + chassisH + 0.02, 0);
      root.add(stripe);
    }
  }

  // Rear GT spoiler
  if (spec.spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.08, 0.36), trimMat);
    wing.position.set(0, 0.36 + chassisH + 0.32, -l * 0.44);
    root.add(wing);
    for (const sx of [-0.55, 0.55]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.16), trimMat);
      strut.position.set(sx, 0.36 + chassisH + 0.16, -l * 0.44);
      root.add(strut);
    }
  }

  // Neon underglow plane for hero sports car
  if (spec.underglow) {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.35, l * 1.15),
      new THREE.MeshBasicMaterial({
        color: spec.underglow,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI * 0.5;
    glow.position.y = 0.06;
    root.add(glow);
  }

  // Taxi roof sign
  if (spec.taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.24, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xfff08a }),
    );
    sign.position.set(0, 0.36 + h + 0.08, -0.15);
    root.add(sign);
  }

  // Headlights & Ruby Taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d4 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  for (const sx of [-w * 0.34, w * 0.34]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.08), headMat);
    hl.position.set(sx, 0.36 + chassisH * 0.56, l * 0.5 + 0.02);
    root.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    tl.position.set(sx, 0.36 + chassisH * 0.56, -l * 0.5 - 0.02);
    root.add(tl);
  }

  // Forward soft headlight ground beam
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.5, 8.5),
    new THREE.MeshBasicMaterial({
      color: 0xffe9b5,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beam.rotation.x = -Math.PI * 0.5;
  beam.position.set(0, 0.08, l * 0.5 + 4.3);
  root.add(beam);

  // Police flashing LED lightbar + additive strobe halos
  let sirenRed = null;
  let sirenBlue = null;
  if (spec.police) {
    const barY = 0.36 + (spec.van ? h * 0.98 : h * 0.93);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.16, 0.32), trimMat);
    housing.position.set(0, barY, -0.05);
    root.add(housing);

    const redMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.28, 0.18, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xff2442 }),
    );
    redMesh.position.set(-w * 0.16, barY + 0.02, -0.05);
    root.add(redMesh);

    const blueMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.28, 0.18, 0.34),
      new THREE.MeshBasicMaterial({ color: 0x2488ff }),
    );
    blueMesh.position.set(w * 0.16, barY + 0.02, -0.05);
    root.add(blueMesh);

    const redSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.glowRed,
        color: 0xff3b55,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    redSprite.position.set(-w * 0.28, barY + 0.35, -0.05);
    redSprite.scale.set(4.8, 4.8, 1);
    root.add(redSprite);

    const blueSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.glowBlue,
        color: 0x3b9eff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    blueSprite.position.set(w * 0.28, barY + 0.35, -0.05);
    blueSprite.scale.set(4.8, 4.8, 1);
    root.add(blueSprite);

    sirenRed = { mesh: redMesh, sprite: redSprite };
    sirenBlue = { mesh: blueMesh, sprite: blueSprite };
  }

  // 4 spinning wheel assemblies (rubber tire + alloy rim)
  const wheels = [];
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x16181e });
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xd0d8e6, shininess: 100 });
  const wheelR = spec.suv || spec.van ? 0.44 : 0.38;
  const wheelPositions = [
    [-w * 0.5, wheelR, l * 0.31],
    [w * 0.5, wheelR, l * 0.31],
    [-w * 0.5, wheelR, -l * 0.31],
    [w * 0.5, wheelR, -l * 0.31],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.28, 10), tireMat);
    tire.rotation.z = Math.PI * 0.5;
    wg.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.56, wheelR * 0.56, 0.3, 8), rimMat);
    rim.rotation.z = Math.PI * 0.5;
    wg.add(rim);
    wg.position.set(wx, wy, wz);
    root.add(wg);
    wheels.push(wg);
  }

  return { root, bodyMat, wheels, sirenRed, sirenBlue };
}

export class VehicleManager {
  constructor(scene, textures, colliders, seed = 101) {
    this.scene = scene;
    this.textures = textures;
    this.colliders = colliders;
    this.rng = createRng(seed);
    this.vehicles = [];
    this.particles = [];
    this.nextId = 1;
  }

  spawnVehicle(specId, x, z, heading = 0, opts = {}) {
    const spec = VEHICLE_SPECS[specId] || VEHICLE_SPECS.palmaCoupe;
    const color = opts.color ?? pick(this.rng, spec.colors);
    const parts = buildVehicleMesh(spec, color, this.textures);
    parts.root.position.set(x, 0, z);
    parts.root.rotation.y = heading;
    this.scene.add(parts.root);

    const v = {
      id: this.nextId++,
      specId: spec.id,
      spec,
      color,
      mesh: parts.root,
      bodyMat: parts.bodyMat,
      wheels: parts.wheels,
      sirenRed: parts.sirenRed,
      sirenBlue: parts.sirenBlue,
      x,
      z,
      heading,
      vx: 0,
      vz: 0,
      speed: 0,
      drifting: false,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      wrecked: false,
      isPlayer: Boolean(opts.isPlayer),
      isTraffic: Boolean(opts.isTraffic),
      isPolice: Boolean(opts.isPolice || spec.police),
      sirensOn: Boolean(opts.sirensOn || opts.isPolice),
      missionTag: opts.missionTag || null,
      laneAxis: opts.laneAxis || 'z',
      laneDir: opts.laneDir || 1,
      laneCoord: opts.laneCoord ?? x,
      cruiseSpeed: opts.cruiseSpeed ?? randRange(this.rng, 10, 16),
      sirenPhase: this.rng() * 6.28,
      smokeTimer: 0,
    };
    this.vehicles.push(v);
    return v;
  }

  spawnInitialTraffic(count = 20) {
    const pool = ['palmaCoupe', 'tideRunner', 'keysCab', 'palmaCoupe', 'cobaltGT', 'keysCab'];
    const roads = WORLD.roadCenters;
    for (let i = 0; i < count; i++) {
      const axis = i % 2 === 0 ? 'z' : 'x';
      const road = pick(this.rng, roads);
      const dir = this.rng() > 0.5 ? 1 : -1;
      const laneOffset = 3.2 * dir;
      let x;
      let z;
      let heading;
      if (axis === 'z') {
        x = road + laneOffset;
        z = randRange(this.rng, -170, 165);
        heading = dir > 0 ? 0 : Math.PI;
      } else {
        z = road - laneOffset;
        x = randRange(this.rng, -170, 175);
        heading = dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      }
      if (Math.hypot(x - 180, z - 0) < 20) continue;
      this.spawnVehicle(pick(this.rng, pool), x, z, heading, {
        isTraffic: true,
        laneAxis: axis,
        laneDir: dir,
        laneCoord: road,
      });
    }
  }

  spawnSparkOrSmoke(x, y, z, color, size, life, vy = 2.2) {
    const isBright = color === 0xffbe33 || color === 0xffd166 || color === 0xffb703 || color === 0xff5a1f || color === 0xff6b22 || color === 0xffdd55;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.textures.glowWarm,
        color,
        transparent: true,
        opacity: isBright ? 0.95 : 0.55,
        blending: isBright ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      }),
    );
    sprite.position.set(x, y, z);
    const sc = size * (isBright ? 2.1 : 3.2);
    sprite.scale.set(sc, sc, 1);
    this.scene.add(sprite);
    this.particles.push({
      mesh: sprite,
      baseScale: sc,
      vx: (this.rng() - 0.5) * 4.5,
      vy: vy + this.rng() * 2.5,
      vz: (this.rng() - 0.5) * 4.5,
      life,
      maxLife: life,
      scaleGrow: isBright ? 0.5 : 1.4,
    });
  }

  damageVehicle(v, amount, onExplode) {
    if (v.wrecked) return;
    v.hp = Math.max(0, v.hp - amount);
    if (v.hp <= 0) {
      this.wreckVehicle(v, onExplode);
    }
  }

  wreckVehicle(v, onExplode) {
    if (v.wrecked) return;
    v.wrecked = true;
    v.hp = 0;
    v.sirensOn = false;
    v.bodyMat.color.setHex(0x1f1c1c);
    v.bodyMat.shininess = 8;
    for (let i = 0; i < 18; i++) {
      const col = i % 3 === 0 ? 0xffdd55 : i % 2 === 0 ? 0xff5a1f : 0x2a2a2e;
      this.spawnSparkOrSmoke(v.x, 1.1, v.z, col, 0.5 + this.rng() * 0.8, 0.9 + this.rng() * 0.6, 5.5);
    }
    if (onExplode) onExplode(v);
  }

  repairAndRespray(v, newColor = null, armorBonus = 0) {
    v.wrecked = false;
    v.maxHp = v.spec.maxHp + armorBonus;
    v.hp = v.maxHp;
    const col = newColor ?? pick(this.rng, [0x00d2ff, 0xff4081, 0xffaa00, 0x32e875, 0x7b5cff]);
    v.color = col;
    v.bodyMat.color.setHex(col);
    v.bodyMat.shininess = 95;
  }

  findNearestEnterable(x, z, maxDist = 5.6) {
    let best = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      if (v.wrecked) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  updatePlayerVehicle(v, controls, dt, upgrades = { turbo: 0 }) {
    if (v.wrecked) {
      v.vx *= Math.max(0, 1 - dt * 5);
      v.vz *= Math.max(0, 1 - dt * 5);
      v.speed = Math.hypot(v.vx, v.vz);
      return;
    }

    const turboMult = 1 + (upgrades.turbo || 0) * 0.14;
    const topSpeed = v.spec.topSpeed * turboMult;
    const accel = v.spec.accel * turboMult;
    const fwdX = Math.sin(v.heading);
    const fwdZ = Math.cos(v.heading);
    const rightX = Math.cos(v.heading);
    const rightZ = -Math.sin(v.heading);

    let forwardVel = v.vx * fwdX + v.vz * fwdZ;
    let lateralVel = v.vx * rightX + v.vz * rightZ;

    if (controls.up) {
      forwardVel += accel * dt;
    } else if (controls.down) {
      if (forwardVel > 1.5) forwardVel -= v.spec.brake * dt;
      else forwardVel -= accel * 0.55 * dt;
    } else {
      forwardVel *= Math.max(0, 1 - dt * 1.45);
    }

    forwardVel = Math.max(-topSpeed * 0.35, Math.min(topSpeed, forwardVel));

    const handbrake = Boolean(controls.drift);
    v.drifting = handbrake && Math.abs(forwardVel) > 10;

    const steerInput = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);
    const speedFactor = Math.min(1, Math.abs(forwardVel) / 6.5);
    const dirSign = forwardVel >= -0.2 ? 1 : -1;
    const turnBoost = v.drifting ? 1.38 : 1.0;
    v.heading += steerInput * v.spec.turnRate * turnBoost * speedFactor * dirSign * dt;

    if (v.drifting) {
      forwardVel *= Math.max(0, 1 - dt * 0.85);
    }

    const grip = v.drifting ? v.spec.driftGrip : v.spec.grip;
    lateralVel *= Math.max(0, 1 - dt * grip);

    const nFwdX = Math.sin(v.heading);
    const nFwdZ = Math.cos(v.heading);
    const nRightX = Math.cos(v.heading);
    const nRightZ = -Math.sin(v.heading);

    v.vx = nFwdX * forwardVel + nRightX * lateralVel;
    v.vz = nFwdZ * forwardVel + nRightZ * lateralVel;
    v.speed = Math.hypot(v.vx, v.vz);

    const nextX = v.x + v.vx * dt;
    const nextZ = v.z + v.vz * dt;
    const res = resolveBuildingCollision(nextX, nextZ, v.spec.width * 0.65, this.colliders);
    v.x = res.x;
    v.z = res.z;
    if (res.hit) {
      if (v.speed > 16) {
        this.damageVehicle(v, (v.speed - 14) * 0.45);
        this.spawnSparkOrSmoke(v.x, 0.7, v.z, 0xffd166, 0.25, 0.35, 3.2);
      }
      v.vx *= -0.25;
      v.vz *= -0.25;
    }

    // Drift tire smoke & sparks
    if ((v.drifting || Math.abs(lateralVel) > 6.5) && this.rng() < 0.7) {
      const rx = v.x - nFwdX * (v.spec.length * 0.42);
      const rz = v.z - nFwdZ * (v.spec.length * 0.42);
      this.spawnSparkOrSmoke(rx + nRightX * 0.7, 0.25, rz + nRightZ * 0.7, 0xd4dbe6, 0.45, 0.5, 1.0);
      if (v.drifting && this.rng() < 0.4) {
        this.spawnSparkOrSmoke(rx - nRightX * 0.7, 0.22, rz - nRightZ * 0.7, 0xffb703, 0.18, 0.28, 2.2);
      }
    }
  }

  updateTraffic(dt, playerPos) {
    for (const v of this.vehicles) {
      if (v.isPlayer || v.isPolice || v.wrecked || !v.isTraffic) continue;

      // Simple obstacle check ahead so traffic slows down near other cars or player
      let blocked = false;
      const fwdX = Math.sin(v.heading);
      const fwdZ = Math.cos(v.heading);
      for (const other of this.vehicles) {
        if (other === v) continue;
        const dx = other.x - v.x;
        const dz = other.z - v.z;
        const ahead = dx * fwdX + dz * fwdZ;
        const side = Math.abs(dx * fwdZ - dz * fwdX);
        if (ahead > 0 && ahead < 10.5 && side < 2.6) {
          blocked = true;
          break;
        }
      }
      if (!blocked && playerPos) {
        const dx = playerPos.x - v.x;
        const dz = playerPos.z - v.z;
        const ahead = dx * fwdX + dz * fwdZ;
        const side = Math.abs(dx * fwdZ - dz * fwdX);
        if (ahead > 0 && ahead < 8.5 && side < 2.4) blocked = true;
      }

      const targetSpeed = blocked ? 0 : v.cruiseSpeed;
      v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 4);
      v.vx = fwdX * v.speed;
      v.vz = fwdZ * v.speed;
      v.x += v.vx * dt;
      v.z += v.vz * dt;

      // Wrap along city avenues smoothly
      if (v.x > 186) v.x = -182;
      if (v.x < -186) v.x = 182;
      if (v.z > 186) v.z = -182;
      if (v.z < -186) v.z = 182;
    }
  }

  resolveVehicleCollisions(onHit) {
    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const minDist = (a.spec.width + b.spec.width) * 0.62;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.001 && dSq < minDist * minDist) {
          const d = Math.sqrt(dSq);
          const nx = dx / d;
          const nz = dz / d;
          const overlap = (minDist - d) * 0.52;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;

          const relSpeed = Math.hypot(a.vx - b.vx, a.vz - b.vz);
          if (relSpeed > 10) {
            const impact = (relSpeed - 8) * 0.55;
            if (!a.wrecked) this.damageVehicle(a, impact * 0.6);
            if (!b.wrecked) this.damageVehicle(b, impact);
            this.spawnSparkOrSmoke((a.x + b.x) * 0.5, 0.8, (a.z + b.z) * 0.5, 0xffc857, 0.25, 0.35, 3.6);
            if (onHit) onHit(a, b, relSpeed);
          }

          a.vx -= nx * 2.4;
          a.vz -= nz * 2.4;
          b.vx += nx * 2.4;
          b.vz += nz * 2.4;
        }
      }
    }
  }

  syncVisuals(time, dt) {
    for (const v of this.vehicles) {
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading;

      // Spin wheels proportional to speed
      const spin = v.speed * dt * 2.4;
      for (const w of v.wheels) {
        w.rotation.x += spin;
      }

      // Flashing SKPD red/blue lightbars
      if (v.sirenRed && v.sirenBlue) {
        if (v.sirensOn && !v.wrecked) {
          const flash = Math.sin(time * 16 + v.sirenPhase) > 0;
          v.sirenRed.sprite.visible = true;
          v.sirenBlue.sprite.visible = true;
          v.sirenRed.sprite.material.opacity = flash ? 0.95 : 0.12;
          v.sirenBlue.sprite.material.opacity = flash ? 0.12 : 0.95;
          v.sirenRed.mesh.material.color.setHex(flash ? 0xff2b4a : 0x550c16);
          v.sirenBlue.mesh.material.color.setHex(flash ? 0x0c2455 : 0x2b95ff);
        } else {
          v.sirenRed.sprite.visible = false;
          v.sirenBlue.sprite.visible = false;
        }
      }

      // Smoke & fire on damaged or wrecked vehicles
      if (v.hp < v.maxHp * 0.45) {
        v.smokeTimer -= dt;
        if (v.smokeTimer <= 0) {
          v.smokeTimer = v.wrecked ? 0.08 : 0.14;
          const hoodX = v.x + Math.sin(v.heading) * 1.4;
          const hoodZ = v.z + Math.cos(v.heading) * 1.4;
          this.spawnSparkOrSmoke(hoodX, 1.15, hoodZ, v.wrecked ? 0x222226 : 0x555b66, 0.55, 0.85, 2.5);
          if (v.wrecked || v.hp < v.maxHp * 0.22) {
            this.spawnSparkOrSmoke(hoodX, 1.05, hoodZ, this.rng() > 0.4 ? 0xff6b22 : 0xffdd55, 0.42, 0.45, 3.6);
          }
        }
      }
    }

    // Update vehicle smoke/spark particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const ratio = p.life / p.maxLife;
      p.mesh.material.opacity = ratio * 0.82;
      const sc = (p.baseScale || 1) * (1 + (1 - ratio) * p.scaleGrow);
      p.mesh.scale.set(sc, sc, 1);
    }
  }
}
