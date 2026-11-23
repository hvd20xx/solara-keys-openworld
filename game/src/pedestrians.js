// Articulated 3D character rigs for Mateo Cruz, strolling pedestrians, and armed syndicate rivals.

import { WORLD } from './config.js';
import { createRng, pick, randRange } from './random.js';
import { resolveBuildingCollision } from './vehicles.js';

const THREE = window.THREE;

const PED_SHIRTS = [0xff6b8b, 0x3ec9b0, 0xffc857, 0x62a8ff, 0xf2f4f8, 0xb87cff, 0xff8c52];
const PED_PANTS = [0x242c3b, 0x38465a, 0xd8c3a5, 0x1c222d, 0x4b5563];
const SKIN_TONES = [0xe8b896, 0xd49a74, 0xf2c9ac, 0x9e6b4c, 0xc28966];

export function buildCharacterRig({ shirtColor, innerColor = 0xffffff, pantsColor, skinColor, isProtagonist = false, isEnemy = false }) {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });
  const hairMat = new THREE.MeshLambertMaterial({ color: isProtagonist ? 0x1b1716 : 0x2b211c });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x16181e });

  // Grounded contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 14),
    new THREE.MeshBasicMaterial({ color: 0x050810, transparent: true, opacity: 0.44, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI * 0.5;
  shadow.position.y = -0.14;
  root.add(shadow);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), shirtMat);
  torso.position.y = 1.18;
  root.add(torso);

  if (isProtagonist) {
    // Mateo's iconic open coastal overshirt over crisp white tee
    const tee = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.7, 0.34),
      new THREE.MeshLambertMaterial({ color: innerColor }),
    );
    tee.position.set(0, 1.18, 0.01);
    root.add(tee);
  }

  // Head + Hair + Shades
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skinMat);
  head.position.y = 1.76;
  root.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.39), hairMat);
  hair.position.set(0, 1.94, -0.01);
  root.add(hair);

  if (isProtagonist || isEnemy) {
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.09, 0.08),
      new THREE.MeshBasicMaterial({ color: isEnemy ? 0xff3b55 : 0x121824 }),
    );
    shades.position.set(0, 1.79, 0.17);
    root.add(shades);
  }

  // Articulated Arms (facing +Z: +X is left arm, -X is right arm)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(0.37, 1.46, 0);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), shirtMat);
  leftArm.position.y = -0.26;
  leftArmPivot.add(leftArm);
  root.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(-0.37, 1.46, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), shirtMat);
  rightArm.position.y = -0.26;
  rightArmPivot.add(rightArm);

  // Weapon model oriented along -Y so raising arm (-90 deg X) aims barrel straight forward along +Z
  const weaponMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.62, 0.14),
    new THREE.MeshPhongMaterial({ color: 0x1b212b, shininess: 95 }),
  );
  weaponMesh.position.set(0, -0.68, 0.08);
  weaponMesh.visible = isEnemy;
  rightArmPivot.add(weaponMesh);
  root.add(rightArmPivot);

  // Articulated Legs
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.15, 0.82, 0);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.74, 0.22), pantsMat);
  leftLeg.position.y = -0.37;
  leftLegPivot.add(leftLeg);
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.3), shoeMat);
  leftShoe.position.set(0, -0.76, 0.04);
  leftLegPivot.add(leftShoe);
  root.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.15, 0.82, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.74, 0.22), pantsMat);
  rightLeg.position.y = -0.37;
  rightLegPivot.add(rightLeg);
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.3), shoeMat);
  rightShoe.position.set(0, -0.76, 0.04);
  rightLegPivot.add(rightShoe);
  root.add(rightLegPivot);

  // Floating tactical diamond marker above hostile syndicate NPCs
  let marker = null;
  if (isEnemy) {
    marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: 0xff3b55 }),
    );
    marker.position.y = 2.55;
    root.add(marker);
  }

  return {
    root,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    weaponMesh,
    marker,
  };
}

export function animateCharacter(rig, speed, aimActive, time) {
  const stride = Math.min(1, speed / 7.5);
  const swing = Math.sin(time * (stride > 0.6 ? 13 : 8)) * 0.72 * stride;
  rig.leftLegPivot.rotation.x = swing;
  rig.rightLegPivot.rotation.x = -swing;
  rig.leftArmPivot.rotation.x = -swing * 0.7;

  if (aimActive) {
    rig.rightArmPivot.rotation.x = -Math.PI * 0.48;
  } else {
    rig.rightArmPivot.rotation.x = swing * 0.7;
  }
  if (rig.marker) {
    rig.marker.rotation.y = time * 3.5;
    rig.marker.position.y = 2.55 + Math.sin(time * 5) * 0.12;
  }
}

export class PedestrianManager {
  constructor(scene, colliders, seed = 202) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = createRng(seed);
    this.peds = [];
    this.enemies = [];
    this.panicCenter = null;
    this.panicTimer = 0;
  }

  spawnSidewalkCrowd(count = 34) {
    const roads = WORLD.roadCenters;
    for (let i = 0; i < count; i++) {
      const axis = i % 2 === 0 ? 'z' : 'x';
      const road = pick(this.rng, roads);
      const side = this.rng() > 0.5 ? 1 : -1;
      const offset = (WORLD.roadWidth * 0.5 + 2.0) * side;
      const x = axis === 'z' ? road + offset : randRange(this.rng, -170, 185);
      const z = axis === 'z' ? randRange(this.rng, -170, 175) : road + offset;
      this.spawnPedestrian(x, z, axis === 'z' ? (this.rng() > 0.5 ? 0 : Math.PI) : (this.rng() > 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5));
    }
  }

  spawnPedestrian(x, z, heading = 0) {
    const rig = buildCharacterRig({
      shirtColor: pick(this.rng, PED_SHIRTS),
      pantsColor: pick(this.rng, PED_PANTS),
      skinColor: pick(this.rng, SKIN_TONES),
    });
    rig.root.position.set(x, 0.2, z);
    rig.root.rotation.y = heading;
    this.scene.add(rig.root);

    const ped = {
      rig,
      x,
      z,
      heading,
      speed: randRange(this.rng, 1.9, 3.1),
      hp: 40,
      alive: true,
      fleeing: false,
      phase: this.rng() * 10,
      turnTimer: randRange(this.rng, 4, 12),
    };
    this.peds.push(ped);
    return ped;
  }

  spawnSyndicateEnemy(x, z, heading = 0) {
    const rig = buildCharacterRig({
      shirtColor: 0x8e1e32,
      pantsColor: 0x161922,
      skinColor: pick(this.rng, SKIN_TONES),
      isEnemy: true,
    });
    rig.root.position.set(x, 0.2, z);
    rig.root.rotation.y = heading;
    this.scene.add(rig.root);

    const enemy = {
      rig,
      x,
      z,
      heading,
      hp: 85,
      maxHp: 85,
      alive: true,
      fireCooldown: randRange(this.rng, 0.4, 1.1),
      strafeDir: this.rng() > 0.5 ? 1 : -1,
      phase: this.rng() * 10,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) {
      this.scene.remove(e.rig.root);
    }
    this.enemies = [];
  }

  triggerPanic(x, z, duration = 6.5) {
    this.panicCenter = { x, z };
    this.panicTimer = Math.max(this.panicTimer, duration);
  }

  hitPedestrian(ped, damage) {
    if (!ped.alive) return false;
    ped.hp -= damage;
    if (ped.hp <= 0) {
      ped.alive = false;
      ped.rig.root.rotation.x = Math.PI * 0.5;
      ped.rig.root.position.y = 0.35;
      return true;
    }
    return false;
  }

  hitEnemy(enemy, damage) {
    if (!enemy.alive) return false;
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.rig.root.rotation.x = Math.PI * 0.5;
      enemy.rig.root.position.y = 0.35;
      if (enemy.rig.marker) enemy.rig.marker.visible = false;
      return true;
    }
    return false;
  }

  update(time, dt, playerPos, onEnemyShoot) {
    if (this.panicTimer > 0) {
      this.panicTimer = Math.max(0, this.panicTimer - dt);
    }

    // Update ambient pedestrians
    for (const p of this.peds) {
      if (!p.alive) continue;
      let speed = p.speed;
      if (this.panicTimer > 0 && this.panicCenter) {
        const dx = p.x - this.panicCenter.x;
        const dz = p.z - this.panicCenter.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 48) {
          p.fleeing = true;
          p.heading = Math.atan2(dx, dz);
          speed = 6.8;
        } else {
          p.fleeing = false;
        }
      } else {
        p.fleeing = false;
        p.turnTimer -= dt;
        if (p.turnTimer <= 0) {
          p.turnTimer = randRange(this.rng, 5, 14);
          p.heading += pick(this.rng, [-Math.PI * 0.5, 0, Math.PI * 0.5]);
        }
      }

      const nx = p.x + Math.sin(p.heading) * speed * dt;
      const nz = p.z + Math.cos(p.heading) * speed * dt;
      const res = resolveBuildingCollision(nx, nz, 0.55, this.colliders);
      p.x = res.x;
      p.z = res.z;
      if (res.hit) p.heading += Math.PI * 0.5;

      p.rig.root.position.set(p.x, 0.2, p.z);
      p.rig.root.rotation.y = p.heading;
      animateCharacter(p.rig, speed, false, time + p.phase);
    }

    // Update hostile syndicate enforcers
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);

      let moveSpeed = 0;
      if (dist > 19 && dist < 75) {
        moveSpeed = 4.2;
        const nx = e.x + (dx / dist) * moveSpeed * dt;
        const nz = e.z + (dz / dist) * moveSpeed * dt;
        const res = resolveBuildingCollision(nx, nz, 0.6, this.colliders);
        e.x = res.x;
        e.z = res.z;
      } else if (dist <= 19) {
        // Tactical strafe
        moveSpeed = 2.4;
        const sx = (-dz / Math.max(1, dist)) * e.strafeDir;
        const sz = (dx / Math.max(1, dist)) * e.strafeDir;
        const res = resolveBuildingCollision(e.x + sx * moveSpeed * dt, e.z + sz * moveSpeed * dt, 0.6, this.colliders);
        e.x = res.x;
        e.z = res.z;
      }

      e.rig.root.position.set(e.x, 0.2, e.z);
      e.rig.root.rotation.y = e.heading;
      animateCharacter(e.rig, moveSpeed, dist < 48, time + e.phase);

      e.fireCooldown -= dt;
      if (dist < 44 && e.fireCooldown <= 0) {
        e.fireCooldown = randRange(this.rng, 0.75, 1.45);
        if (onEnemyShoot) onEnemyShoot(e, playerPos);
      }
    }
  }
}
