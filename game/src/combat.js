// Weapon switching, mouse aim & shooting, glowing tracers, muzzle flash, rockets, and explosive shockwaves.

import { WEAPONS } from './config.js';

const THREE = window.THREE;

export class CombatSystem {
  constructor(scene, textures, audio) {
    this.scene = scene;
    this.textures = textures;
    this.audio = audio;

    this.weapons = WEAPONS.map((w) => ({ ...w }));
    this.activeSlot = 2; // 0-indexed: 0=Fists, 1=9mm, 2=Vector SMG, 3=Blast Launcher
    this.cooldown = 0;

    this.tracers = [];
    this.rockets = [];
    this.explosions = [];
    this.muzzleFlashes = [];
    this.shakeAmount = 0;
  }

  getActiveWeapon() {
    return this.weapons[this.activeSlot] || this.weapons[0];
  }

  selectSlot(index) {
    if (index >= 0 && index < this.weapons.length) {
      this.activeSlot = index;
    }
  }

  refillAmmo() {
    for (const w of this.weapons) {
      w.ammo = w.maxAmmo;
    }
  }

  spawnMuzzleFlash(x, y, z, color = 0xffdd77, scale = 2.4) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.textures.glowWarm,
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale, 1);
    this.scene.add(sprite);
    this.muzzleFlashes.push({ sprite, life: 0.09, maxLife: 0.09 });
  }

  spawnTracer(start, end, color = 0xffd166, life = 0.14) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.2) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.11, len),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    mesh.position.copy(start).addScaledVector(dir, 0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life, maxLife: life });
  }

  spawnExplosion(x, y, z, radius = 12, context = {}) {
    if (this.audio) this.audio.playExplosion();
    this.shakeAmount = Math.max(this.shakeAmount, 1.35);

    const group = new THREE.Group();
    group.position.set(x, y, z);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.96 }),
    );
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 2.3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffaa33, side: THREE.DoubleSide, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.35;

    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.textures.glowWarm, color: 0xff9233, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flash.scale.set(16, 16, 1);

    group.add(core, outer, ring, flash);
    this.scene.add(group);
    this.explosions.push({ group, core, outer, ring, flash, life: 0.85, maxLife: 0.85, radius });

    // Area damage to vehicles, enemies, pedestrians
    if (context.vehicles) {
      for (const v of context.vehicles.vehicles) {
        const d = Math.hypot(v.x - x, v.z - z);
        if (d < radius) {
          context.vehicles.damageVehicle(v, (1 - d / radius) * 180);
        }
      }
    }
    if (context.peds) {
      context.peds.triggerPanic(x, z, 9);
      for (const e of context.peds.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d < radius && context.peds.hitEnemy(e, 140)) {
          if (context.onEnemyKill) context.onEnemyKill(e);
        }
      }
      for (const p of context.peds.peds) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - x, p.z - z) < radius * 0.75) {
          context.peds.hitPedestrian(p, 90);
        }
      }
    }
    if (context.police) context.police.addHeat(75);
  }

  firePlayerWeapon(origin, heading, context) {
    if (this.cooldown > 0) return false;
    const weapon = this.getActiveWeapon();
    if (weapon.ammo <= 0) return false;

    this.cooldown = weapon.fireRate;
    if (Number.isFinite(weapon.ammo)) weapon.ammo -= 1;

    const spreadAngle = (Math.random() - 0.5) * weapon.spread;
    const dirX = Math.sin(heading + spreadAngle);
    const dirZ = Math.cos(heading + spreadAngle);

    const muzzlePos = new THREE.Vector3(origin.x + dirX * 0.9, 1.48, origin.z + dirZ * 0.9);

    if (weapon.melee) {
      if (this.audio) this.audio.playPunch();
      for (const e of context.peds.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - origin.x, e.z - origin.z) < weapon.range) {
          if (context.peds.hitEnemy(e, weapon.damage) && context.onEnemyKill) context.onEnemyKill(e);
        }
      }
      return true;
    }

    if (weapon.explosive) {
      if (this.audio) this.audio.playRocket();
      this.spawnMuzzleFlash(muzzlePos.x, muzzlePos.y, muzzlePos.z, 0xff8833, 3.6);
      const rocketMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.9, 6),
        new THREE.MeshBasicMaterial({ color: 0xff5a2c }),
      );
      rocketMesh.rotation.x = Math.PI * 0.5;
      const g = new THREE.Group();
      g.add(rocketMesh);
      g.position.copy(muzzlePos);
      g.rotation.y = heading;
      this.scene.add(g);
      this.rockets.push({
        mesh: g,
        x: muzzlePos.x,
        y: muzzlePos.y,
        z: muzzlePos.z,
        vx: dirX * 52,
        vz: dirZ * 52,
        life: 1.8,
        radius: weapon.blastRadius || 12,
      });
      this.shakeAmount = Math.max(this.shakeAmount, 0.45);
      context.peds.triggerPanic(origin.x, origin.z, 7);
      return true;
    }

    // Hitscan ballistic weapon (9mm Sidearm / Vector SMG)
    if (this.audio) this.audio.playGunshot(weapon.id === 'smg');
    this.spawnMuzzleFlash(muzzlePos.x, muzzlePos.y, muzzlePos.z, weapon.tracerColor, weapon.id === 'smg' ? 2.6 : 2.1);
    this.shakeAmount = Math.max(this.shakeAmount, weapon.id === 'smg' ? 0.12 : 0.18);
    context.peds.triggerPanic(origin.x, origin.z, 6);

    let hitDist = weapon.range;
    let hitTarget = null;
    let hitKind = null;

    // Check enemies
    for (const e of context.peds.enemies) {
      if (!e.alive) continue;
      const t = rayCircleHit(origin.x, origin.z, dirX, dirZ, e.x, e.z, 1.05);
      if (t !== null && t < hitDist) {
        hitDist = t;
        hitTarget = e;
        hitKind = 'enemy';
      }
    }

    // Check vehicles
    for (const v of context.vehicles.vehicles) {
      if (v === context.playerVehicle) continue;
      const t = rayCircleHit(origin.x, origin.z, dirX, dirZ, v.x, v.z, v.spec.width * 0.72);
      if (t !== null && t < hitDist) {
        hitDist = t;
        hitTarget = v;
        hitKind = 'vehicle';
      }
    }

    // Check pedestrians
    for (const p of context.peds.peds) {
      if (!p.alive) continue;
      const t = rayCircleHit(origin.x, origin.z, dirX, dirZ, p.x, p.z, 0.85);
      if (t !== null && t < hitDist) {
        hitDist = t;
        hitTarget = p;
        hitKind = 'ped';
      }
    }

    const endPos = new THREE.Vector3(muzzlePos.x + dirX * hitDist, 1.38, muzzlePos.z + dirZ * hitDist);
    this.spawnTracer(muzzlePos, endPos, weapon.tracerColor, 0.13);

    if (hitKind === 'enemy' && hitTarget) {
      if (context.peds.hitEnemy(hitTarget, weapon.damage) && context.onEnemyKill) {
        context.onEnemyKill(hitTarget);
      }
      context.vehicles.spawnSparkOrSmoke(endPos.x, 1.2, endPos.z, 0xff4455, 0.22, 0.3, 2.0);
    } else if (hitKind === 'vehicle' && hitTarget) {
      context.vehicles.damageVehicle(hitTarget, weapon.damage * 0.9, (wreckedV) => {
        this.spawnExplosion(wreckedV.x, 1.1, wreckedV.z, 11, context);
      });
      context.vehicles.spawnSparkOrSmoke(endPos.x, 1.1, endPos.z, 0xffd166, 0.22, 0.3, 3.0);
      if (hitTarget.isPolice) context.police.addHeat(45);
      else context.police.addHeat(18);
    } else if (hitKind === 'ped' && hitTarget) {
      context.peds.hitPedestrian(hitTarget, weapon.damage);
      context.police.addHeat(38);
    }
    return true;
  }

  fireEnemyShot(enemy, playerPos, onPlayerDamage) {
    const dx = playerPos.x - enemy.x;
    const dz = playerPos.z - enemy.z;
    const dist = Math.max(0.1, Math.hypot(dx, dz));
    const spread = (Math.random() - 0.5) * 0.18;
    const angle = Math.atan2(dx, dz) + spread;
    const start = new THREE.Vector3(enemy.x + Math.sin(angle) * 0.8, 1.45, enemy.z + Math.cos(angle) * 0.8);
    const end = new THREE.Vector3(start.x + Math.sin(angle) * Math.min(dist + 2, 40), 1.35, start.z + Math.cos(angle) * Math.min(dist + 2, 40));
    this.spawnMuzzleFlash(start.x, start.y, start.z, 0xff5a45, 2.0);
    this.spawnTracer(start, end, 0xff5252, 0.14);
    if (this.audio) this.audio.playGunshot(true);

    if (Math.abs(spread) < 0.065 && dist < 42 && onPlayerDamage) {
      onPlayerDamage(7);
    }
  }

  update(dt, context) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.8);

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        this.tracers.splice(i, 1);
      } else {
        tr.mesh.material.opacity = tr.life / tr.maxLife;
      }
    }

    // Update muzzle flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      mf.life -= dt;
      if (mf.life <= 0) {
        this.scene.remove(mf.sprite);
        this.muzzleFlashes.splice(i, 1);
      } else {
        mf.sprite.material.opacity = mf.life / mf.maxLife;
      }
    }

    // Update rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.x += r.vx * dt;
      r.z += r.vz * dt;
      r.mesh.position.set(r.x, r.y, r.z);
      context.vehicles.spawnSparkOrSmoke(r.x, r.y, r.z, 0xffaa44, 0.32, 0.35, 0.8);

      let hit = r.life <= 0;
      for (const v of context.vehicles.vehicles) {
        if (v !== context.playerVehicle && Math.hypot(v.x - r.x, v.z - r.z) < 2.6) hit = true;
      }
      for (const e of context.peds.enemies) {
        if (e.alive && Math.hypot(e.x - r.x, e.z - r.z) < 1.8) hit = true;
      }
      for (const b of context.colliders) {
        if (r.x >= b.minX && r.x <= b.maxX && r.z >= b.minZ && r.z <= b.maxZ) hit = true;
      }
      if (hit) {
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
        this.spawnExplosion(r.x, 1.0, r.z, r.radius, context);
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      if (ex.life <= 0) {
        this.scene.remove(ex.group);
        this.explosions.splice(i, 1);
        continue;
      }
      const prog = 1 - ex.life / ex.maxLife;
      const sCore = 1 + prog * 2.8;
      const sOuter = 1 + prog * 4.4;
      const sRing = 1 + prog * 6.5;
      ex.core.scale.set(sCore, sCore, sCore);
      ex.outer.scale.set(sOuter, sOuter, sOuter);
      ex.ring.scale.set(sRing, sRing, 1);
      const fade = 1 - prog;
      ex.core.material.opacity = fade;
      ex.outer.material.opacity = fade * 0.78;
      ex.ring.material.opacity = fade * 0.85;
      ex.flash.material.opacity = fade * 0.9;
    }
  }
}

function rayCircleHit(ox, oz, dx, dz, cx, cz, r) {
  const fx = ox - cx;
  const fz = oz - cz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) * 0.5;
  return t >= 0 ? t : null;
}
