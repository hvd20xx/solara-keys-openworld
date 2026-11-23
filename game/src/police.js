// 5-Star SKPD heat & dispatch system: cruisers, interceptors, SWAT vans, roadblocks, and Air-One helicopter.

import { WORLD } from './config.js';
import { resolveBuildingCollision } from './vehicles.js';

const THREE = window.THREE;

export function buildAirOneHelicopter(textures) {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x162238, specular: 0x99ccff, shininess: 90 });
  const stripeMat = new THREE.MeshPhongMaterial({ color: 0xf4f7fc, shininess: 80 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x224466, specular: 0xd0f0ff, shininess: 140, transparent: true, opacity: 0.85 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x11151d });

  // Fuselage + canopy
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 6.2), bodyMat);
  root.add(body);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.4, 5.8), stripeMat);
  stripe.position.y = -0.15;
  root.add(stripe);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 2.4), glassMat);
  canopy.position.set(0, 0.25, 2.5);
  root.add(canopy);

  // Tail boom & vertical fin
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.65, 6.4), bodyMat);
  boom.position.set(0, 0.25, -5.8);
  root.add(boom);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 1.3), stripeMat);
  fin.position.set(0, 0.85, -8.7);
  root.add(fin);

  // Landing skids
  for (const sx of [-1.25, 1.25]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.8), darkMat);
    skid.position.set(sx, -1.45, 0.4);
    root.add(skid);
    for (const sz of [-1.0, 1.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.12), darkMat);
      leg.position.set(sx, -1.12, sz);
      root.add(leg);
    }
  }

  // Spinning 4-blade main rotor
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.45, 0.2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 8), darkMat);
  mast.position.y = -0.25;
  mainRotor.add(mast);

  const bladeMat = new THREE.MeshBasicMaterial({ color: 0xdce6f5, transparent: true, opacity: 0.78 });
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.08, 0.36), bladeMat);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 11.5), bladeMat);
  mainRotor.add(bladeA, bladeB);

  const rotorDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5.6, 20),
    new THREE.MeshBasicMaterial({ color: 0xb8d4f4, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  rotorDisc.rotation.x = -Math.PI * 0.5;
  mainRotor.add(rotorDisc);
  root.add(mainRotor);

  // Spinning tail rotor
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.22), bladeMat);
  tailRotor.position.set(0.38, 0.9, -8.7);
  root.add(tailRotor);

  // Flashing red/blue belly strobes
  const strobeRed = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: textures.glowRed, color: 0xff3b5c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  strobeRed.position.set(-1.3, -0.8, 0.8);
  strobeRed.scale.set(4.5, 4.5, 1);
  root.add(strobeRed);

  const strobeBlue = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: textures.glowBlue, color: 0x3b9eff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  strobeBlue.position.set(1.3, -0.8, 0.8);
  strobeBlue.scale.set(4.5, 4.5, 1);
  root.add(strobeBlue);

  // Dramatic Volumetric Searchlight Cone (anchored from nose down toward ground target)
  const beamGeo = new THREE.ConeGeometry(6.8, 34, 24, 1, true);
  beamGeo.translate(0, -17, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xdaf7ff,
    transparent: true,
    opacity: 0.17,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const searchBeam = new THREE.Mesh(beamGeo, beamMat);
  searchBeam.position.set(0, -0.8, 2.2);
  root.add(searchBeam);

  // Illuminated spotlight pool on the asphalt
  const groundSpot = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 24),
    new THREE.MeshBasicMaterial({
      map: textures.glowCyan,
      color: 0xe6fbff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  groundSpot.rotation.x = -Math.PI * 0.5;
  groundSpot.position.y = 0.14;

  root.visible = false;
  groundSpot.visible = false;

  return { root, mainRotor, tailRotor, strobeRed, strobeBlue, searchBeam, groundSpot };
}

export class PoliceSystem {
  constructor(scene, textures, vehicleManager, colliders) {
    this.scene = scene;
    this.textures = textures;
    this.vehicles = vehicleManager;
    this.colliders = colliders;

    this.wantedLevel = 0; // 0 to 5
    this.heatPoints = 0;
    this.cooldownTimer = 0;
    this.dispatchTimer = 0;
    this.bustedProgress = 0;

    this.units = [];
    this.roadblocks = [];
    this.roadblockGroup = new THREE.Group();
    this.scene.add(this.roadblockGroup);

    this.airOne = buildAirOneHelicopter(textures);
    this.scene.add(this.airOne.root);
    this.scene.add(this.airOne.groundSpot);
    this.airOneState = { active: false, x: 180, y: 28, z: -40, heading: 0, angle: 0 };
  }

  addHeat(points) {
    this.heatPoints = Math.min(500, this.heatPoints + points);
    const nextStars = Math.min(5, Math.ceil(this.heatPoints / 80));
    if (nextStars > this.wantedLevel) {
      this.wantedLevel = nextStars;
    }
    this.cooldownTimer = 18;
  }

  setWantedLevel(stars) {
    const clamped = Math.max(0, Math.min(5, Math.floor(stars)));
    this.wantedLevel = clamped;
    this.heatPoints = clamped * 85;
    this.cooldownTimer = clamped > 0 ? 22 : 0;
    if (clamped === 0) {
      this.clearPursuit();
    }
  }

  clearPursuit() {
    this.wantedLevel = 0;
    this.heatPoints = 0;
    this.cooldownTimer = 0;
    this.bustedProgress = 0;
    this.airOneState.active = false;
    this.airOne.root.visible = false;
    this.airOne.groundSpot.visible = false;
    this.clearRoadblocks();
    for (const u of this.units) {
      u.sirensOn = false;
    }
  }

  clearRoadblocks() {
    while (this.roadblockGroup.children.length > 0) {
      this.roadblockGroup.remove(this.roadblockGroup.children[0]);
    }
    this.roadblocks = [];
  }

  spawnRoadblock(x, z, axis = 'z') {
    const barrierMat = new THREE.MeshLambertMaterial({ color: 0xff7722 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const offsets = [-4.2, 0, 4.2];
    for (const off of offsets) {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.05, 0.35), barrierMat);
      board.position.y = 0.65;
      g.add(board);
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.25, 0.38), stripeMat);
      band.position.y = 0.72;
      g.add(band);

      const beacon = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.textures.glowRed, color: 0xff453a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      beacon.position.y = 1.45;
      beacon.scale.set(2.4, 2.4, 1);
      g.add(beacon);

      if (axis === 'z') {
        g.position.set(x + off, 0, z);
      } else {
        g.position.set(x, 0, z + off);
        g.rotation.y = Math.PI * 0.5;
      }
      this.roadblockGroup.add(g);
      this.roadblocks.push({ x: g.position.x, z: g.position.z, mesh: g });
    }
  }

  spawnPoliceUnit(specId, x, z, heading) {
    const unit = this.vehicles.spawnVehicle(specId, x, z, heading, {
      isPolice: true,
      sirensOn: true,
    });
    this.units.push(unit);
    return unit;
  }

  desiredUnitCount() {
    if (this.wantedLevel === 0) return 0;
    return [0, 2, 3, 4, 5, 6][this.wantedLevel] || 2;
  }

  update(time, dt, playerState, onBusted) {
    const px = playerState.x;
    const pz = playerState.z;

    // Remove wrecked units from active pursuit roster
    this.units = this.units.filter((u) => !u.wrecked);

    if (this.wantedLevel <= 0) {
      this.bustedProgress = Math.max(0, this.bustedProgress - dt * 2);
      return;
    }

    // Dispatch additional cruisers / interceptors / SWAT vans up to target count
    this.dispatchTimer -= dt;
    if (this.dispatchTimer <= 0 && this.units.length < this.desiredUnitCount()) {
      this.dispatchTimer = 3.2;
      const angle = (this.units.length * 1.7 + time) % (Math.PI * 2);
      const dist = 62;
      const sx = Math.max(WORLD.minX + 12, Math.min(WORLD.beachStartX - 10, px + Math.cos(angle) * dist));
      const sz = Math.max(WORLD.minZ + 12, Math.min(WORLD.southOceanZ - 14, pz + Math.sin(angle) * dist));
      const specId =
        this.wantedLevel >= 4 && this.units.length % 3 === 2
          ? 'skpdVan'
          : this.wantedLevel >= 3 && this.units.length % 2 === 1
            ? 'skpdInterceptor'
            : 'skpdCruiser';
      this.spawnPoliceUnit(specId, sx, sz, Math.atan2(px - sx, pz - sz));
    }

    // Roadblock deployment at 3+ stars
    if (this.wantedLevel >= 3 && this.roadblocks.length === 0) {
      const nearestRoadX = WORLD.roadCenters.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a), 0);
      this.spawnRoadblock(nearestRoadX, pz + (pz > 0 ? -52 : 52), 'z');
    }

    // Police Pursuit Steering & Ramming AI
    let closestDist = 999;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      u.sirensOn = true;
      const offsetAngle = (i - (this.units.length - 1) * 0.5) * 0.42;
      const leadX = px + Math.sin(offsetAngle) * 5;
      const leadZ = pz + Math.cos(offsetAngle) * 5;
      const dx = leadX - u.x;
      const dz = leadZ - u.z;
      const dist = Math.hypot(dx, dz);
      closestDist = Math.min(closestDist, dist);

      const desiredHeading = Math.atan2(dx, dz);
      let diff = desiredHeading - u.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.heading += Math.max(-1, Math.min(1, diff * 2.5)) * u.spec.turnRate * dt;

      const targetSpeed = dist < 7 ? 6 : u.spec.topSpeed * (0.76 + this.wantedLevel * 0.04);
      u.speed += (targetSpeed - u.speed) * Math.min(1, dt * 3.4);
      u.vx = Math.sin(u.heading) * u.speed;
      u.vz = Math.cos(u.heading) * u.speed;

      const res = resolveBuildingCollision(u.x + u.vx * dt, u.z + u.vz * dt, u.spec.width * 0.65, this.colliders);
      u.x = res.x;
      u.z = res.z;
      if (res.hit) {
        u.heading += 0.9 * dt * 8;
        u.speed *= 0.4;
      }
    }

    // Air-One Police Helicopter at 3+ stars
    if (this.wantedLevel >= 3) {
      this.airOneState.active = true;
      this.airOne.root.visible = true;
      this.airOne.groundSpot.visible = true;
      this.airOneState.angle += dt * 0.52;
      const orbitR = 16;
      const tx = px + Math.cos(this.airOneState.angle) * orbitR;
      const tz = pz + Math.sin(this.airOneState.angle) * orbitR;
      this.airOneState.x += (tx - this.airOneState.x) * Math.min(1, dt * 1.8);
      this.airOneState.z += (tz - this.airOneState.z) * Math.min(1, dt * 1.8);
      this.airOneState.y = 26 + Math.sin(time * 1.8) * 1.2;
      this.airOneState.heading = Math.atan2(px - this.airOneState.x, pz - this.airOneState.z);

      this.syncAirOneVisuals(time, dt, px, pz);
    } else {
      this.airOneState.active = false;
      this.airOne.root.visible = false;
      this.airOne.groundSpot.visible = false;
    }

    // Wanted cooldown when player breaks line of sight & distance
    if (closestDist > 68 && !this.airOneState.active) {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        this.heatPoints = this.wantedLevel * 80;
        this.cooldownTimer = 14;
        if (this.wantedLevel === 0) this.clearPursuit();
      }
    } else {
      this.cooldownTimer = 18;
    }

    // Busted check if surrounded & stopped
    if (closestDist < 6.8 && playerState.speed < 2.2 && !playerState.inShotMode) {
      this.bustedProgress += dt * 0.34;
      if (this.bustedProgress >= 1) {
        this.bustedProgress = 0;
        if (onBusted) onBusted();
      }
    } else {
      this.bustedProgress = Math.max(0, this.bustedProgress - dt * 0.7);
    }
  }

  syncAirOneVisuals(time, dt, targetX, targetZ) {
    const a = this.airOneState;
    this.airOne.root.position.set(a.x, a.y, a.z);
    this.airOne.root.rotation.y = a.heading;
    this.airOne.root.rotation.x = 0.12;

    this.airOne.mainRotor.rotation.y += dt * 26;
    this.airOne.tailRotor.rotation.x += dt * 32;

    const flash = Math.sin(time * 14) > 0;
    this.airOne.strobeRed.material.opacity = flash ? 0.95 : 0.15;
    this.airOne.strobeBlue.material.opacity = flash ? 0.15 : 0.95;

    // Aim searchlight cone directly forward-down from Air-One nose onto ground target
    const dx = targetX - a.x;
    const dz = targetZ - a.z;
    const horizDist = Math.hypot(dx, dz);
    const pitch = Math.atan2(horizDist, Math.max(4, a.y));
    this.airOne.searchBeam.rotation.set(-pitch * 0.92, 0, 0);
    this.airOne.groundSpot.position.set(targetX, 0.14, targetZ);
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    this.airOne.groundSpot.scale.set(pulse, pulse, 1);
  }
}
