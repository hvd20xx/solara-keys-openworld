// 6 story missions, glowing 3D waypoint pillars, Street Race activity, and Safehouse Garage upgrades.

import { GARAGE_UPGRADES, MISSIONS, STREET_RACE_GATES, WORLD } from './config.js';

const THREE = window.THREE;

export function createBeaconMesh(colorHex, radius = 3.2) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.55, radius, 28),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
  );
  ring.rotation.x = -Math.PI * 0.5;
  ring.position.y = 0.24;
  g.add(ring);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.42, radius * 0.58, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  pillar.position.y = 17.2;
  g.add(pillar);

  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.95, 0),
    new THREE.MeshBasicMaterial({ color: colorHex }),
  );
  diamond.position.y = 4.2;
  g.add(diamond);

  return { group: g, ring, pillar, diamond };
}

export class MissionSystem {
  constructor(scene, vehicles, peds, police, audio) {
    this.scene = scene;
    this.vehicles = vehicles;
    this.peds = peds;
    this.police = police;
    this.audio = audio;

    this.completedIds = new Set();
    this.activeMission = null;
    this.stage = 'idle'; // idle | pickup | deliver | checkpoints | combat
    this.objectiveText = 'Explore Solara Keys or head to the golden beacon to start Pier Drop';
    this.objectiveTitle = 'FREE ROAM';
    this.progressText = '';
    this.timer = 0;
    this.checkpointIndex = 0;
    this.killsCount = 0;
    this.killsTarget = 0;
    this.targetVehicle = null;
    this.bannerToast = null;

    // Side activity: Palm Strip Street Sprint
    this.raceActive = false;
    this.raceGateIndex = 0;
    this.raceTimer = 0;

    // 3D Beacons: primary objective (gold), garage (emerald), street race (cyan)
    this.objectiveBeacon = createBeaconMesh(0xffc145, 3.6);
    this.scene.add(this.objectiveBeacon.group);

    this.garageBeacon = createBeaconMesh(0x2ce5b5, 3.8);
    this.garageBeacon.group.position.set(WORLD.garagePos.x, 0, WORLD.garagePos.z);
    this.scene.add(this.garageBeacon.group);

    this.raceBeacon = createBeaconMesh(0x38e8ff, 3.4);
    this.raceBeacon.group.position.set(WORLD.raceStartPos.x, 0, WORLD.raceStartPos.z);
    this.scene.add(this.raceBeacon.group);

    this.waypointPos = { ...MISSIONS[0].startPos };
    this.syncNextAvailableBeacon();
  }

  getNextMission() {
    for (const m of MISSIONS) {
      if (!this.completedIds.has(m.id)) return m;
    }
    return MISSIONS[0];
  }

  syncNextAvailableBeacon() {
    if (this.activeMission || this.raceActive) return;
    const next = this.getNextMission();
    this.waypointPos = { ...next.startPos };
    this.objectiveTitle = `NEXT: ${next.title.toUpperCase()}`;
    this.objectiveText = `Head to ${next.district} marker or launch from Hub`;
    this.progressText = `${this.completedIds.size}/${MISSIONS.length} MISSIONS`;
    this.objectiveBeacon.group.visible = true;
    this.objectiveBeacon.group.position.set(next.startPos.x, 0, next.startPos.z);
  }

  startMissionById(id) {
    const mission = MISSIONS.find((m) => m.id === id) || this.getNextMission();
    this.raceActive = false;
    this.peds.clearEnemies();
    this.activeMission = mission;
    this.timer = mission.timeLimit || 0;
    this.checkpointIndex = 0;
    this.killsCount = 0;
    this.killsTarget = 0;
    this.targetVehicle = null;
    this.objectiveTitle = mission.title.toUpperCase();

    if (mission.wantedOnStart) {
      this.police.setWantedLevel(mission.wantedOnStart);
    }

    if (mission.type === 'pickup-deliver') {
      this.stage = 'pickup';
      this.waypointPos = { ...mission.pickupPos };
      this.objectiveText = 'Retrieve the drop crate at Marina Pier';
      this.progressText = 'STAGE 1/2';
    } else if (mission.type === 'steal-deliver') {
      this.stage = 'pickup';
      this.targetVehicle = this.vehicles.spawnVehicle('palmaCoupe', mission.targetVehiclePos.x, mission.targetVehiclePos.z, 0, {
        color: 0xff4c8b,
        missionTag: mission.id,
      });
      this.waypointPos = { ...mission.targetVehiclePos };
      this.objectiveText = 'Steal the marked Palma Coupe on Palm Strip';
      this.progressText = 'BOOST TARGET';
    } else if (mission.type === 'checkpoints') {
      this.stage = 'checkpoints';
      this.waypointPos = { ...mission.checkpoints[0] };
      this.objectiveText = 'Hit all 4 downtown signal relays before sweep ends';
      this.progressText = `0/${mission.checkpoints.length} RELAYS`;
    } else if (mission.type === 'evade-deliver') {
      this.stage = 'deliver';
      this.waypointPos = { ...mission.deliverPos };
      this.objectiveText = 'Break 4-Star SKPD pursuit & cross Causeway Heights';
      this.progressText = '4-STAR HEAT';
    } else if (mission.type === 'combat') {
      this.stage = 'combat';
      this.killsTarget = mission.enemySpawns.length;
      for (const sp of mission.enemySpawns) {
        this.peds.spawnSyndicateEnemy(sp.x, sp.z, Math.PI);
      }
      this.waypointPos = { ...mission.enemySpawns[0] };
      this.objectiveText = 'Eliminate syndicate crew guarding Marina containers';
      this.progressText = `0/${this.killsTarget} CREW CLEARED`;
    } else if (mission.type === 'heist') {
      this.stage = 'pickup';
      this.killsTarget = mission.enemySpawns.length;
      for (const sp of mission.enemySpawns) {
        this.peds.spawnSyndicateEnemy(sp.x, sp.z, 0);
      }
      this.waypointPos = { ...mission.pickupPos };
      this.objectiveText = 'Seize the downtown bearer case from syndicate guards';
      this.progressText = 'HEIST ACTIVE';
    }

    this.objectiveBeacon.group.visible = true;
    this.objectiveBeacon.group.position.set(this.waypointPos.x, 0, this.waypointPos.z);
    this.toast(`MISSION STARTED: ${mission.title.toUpperCase()}`, '#ffc145');
    if (this.audio) this.audio.playChime(true);
  }

  startStreetRace() {
    if (this.activeMission) return;
    this.raceActive = true;
    this.raceGateIndex = 0;
    this.raceTimer = 0;
    this.waypointPos = { ...STREET_RACE_GATES[0] };
    this.objectiveTitle = 'PALM STRIP SPRINT';
    this.objectiveText = 'Blast through all 6 coastal race gates!';
    this.progressText = `GATE 1/${STREET_RACE_GATES.length}`;
    this.objectiveBeacon.group.visible = true;
    this.objectiveBeacon.group.position.set(this.waypointPos.x, 0, this.waypointPos.z);
    this.toast('STREET SPRINT LAUNCHED — HIT EVERY GATE!', '#38e8ff');
    if (this.audio) this.audio.playChime(true);
  }

  onEnemyKilled(career) {
    if (!this.activeMission) return;
    this.killsCount += 1;
    if (this.activeMission.type === 'combat') {
      this.progressText = `${this.killsCount}/${this.killsTarget} CREW CLEARED`;
      if (this.killsCount >= this.killsTarget) {
        this.completeMission(career);
      }
    }
  }

  completeMission(career) {
    const m = this.activeMission;
    if (!m) return;
    this.completedIds.add(m.id);
    career.cash += m.rewardCash;
    career.respect += m.rewardRep;
    this.activeMission = null;
    this.stage = 'idle';
    this.peds.clearEnemies();
    this.toast(`MISSION PASSED: ${m.title.toUpperCase()}  +$${m.rewardCash.toLocaleString()}  +${m.rewardRep} REP`, '#32e875');
    if (this.audio) this.audio.playChime(true);
    this.syncNextAvailableBeacon();
  }

  applyGarageUpgrade(upgradeId, career, playerVehicle) {
    const spec = GARAGE_UPGRADES.find((u) => u.id === upgradeId);
    if (!spec) return { ok: false, msg: 'Unknown upgrade' };

    if (spec.consumable) {
      const cost = spec.costs[0];
      if (career.cash < cost) return { ok: false, msg: `Need $${cost.toLocaleString()}` };
      career.cash -= cost;
      this.police.clearPursuit();
      if (playerVehicle) {
        this.vehicles.repairAndRespray(playerVehicle, null, (career.upgrades.armor || 0) * 45);
      }
      this.toast('HEAT RESPRAY COMPLETE — SKPD WANTED CLEARED', '#2ce5b5');
      if (this.audio) this.audio.playChime(true);
      return { ok: true, msg: 'Resprayed & Heat cleared!' };
    }

    const level = career.upgrades[upgradeId] || 0;
    if (level >= spec.maxLevel) return { ok: false, msg: 'Max tier installed' };
    const cost = spec.costs[level];
    if (career.cash < cost) return { ok: false, msg: `Need $${cost.toLocaleString()}` };

    career.cash -= cost;
    career.upgrades[upgradeId] = level + 1;
    if (playerVehicle && upgradeId === 'armor') {
      playerVehicle.maxHp = playerVehicle.spec.maxHp + career.upgrades.armor * 45;
      playerVehicle.hp = playerVehicle.maxHp;
    }
    this.toast(`${spec.name.toUpperCase()} TIER ${level + 1} INSTALLED`, '#38e8ff');
    if (this.audio) this.audio.playChime(true);
    return { ok: true, msg: `Upgraded to Tier ${level + 1}` };
  }

  toast(text, color = '#ffc145', duration = 4.2) {
    this.bannerToast = { text, color, timer: duration };
  }

  update(time, dt, playerState, career) {
    // Animate beacon diamonds & rings
    for (const b of [this.objectiveBeacon, this.garageBeacon, this.raceBeacon]) {
      b.diamond.rotation.y = time * 2.2;
      b.diamond.position.y = 4.2 + Math.sin(time * 3.4) * 0.55;
      const pulse = 1 + Math.sin(time * 4) * 0.08;
      b.ring.scale.set(pulse, pulse, 1);
    }

    if (this.bannerToast) {
      this.bannerToast.timer -= dt;
      if (this.bannerToast.timer <= 0) this.bannerToast = null;
    }

    const px = playerState.x;
    const pz = playerState.z;

    // Street race progression
    if (this.raceActive) {
      this.raceTimer += dt;
      const gate = STREET_RACE_GATES[this.raceGateIndex];
      if (Math.hypot(px - gate.x, pz - gate.z) < 7.5) {
        this.raceGateIndex += 1;
        if (this.audio) this.audio.playChime(false);
        if (this.raceGateIndex >= STREET_RACE_GATES.length) {
          this.raceActive = false;
          const bonus = Math.max(1200, Math.floor(4200 - this.raceTimer * 35));
          career.cash += bonus;
          career.respect += 180;
          this.toast(`STREET SPRINT FINISHED (${this.raceTimer.toFixed(1)}s)  +$${bonus.toLocaleString()}`, '#38e8ff');
          this.syncNextAvailableBeacon();
        } else {
          this.waypointPos = { ...STREET_RACE_GATES[this.raceGateIndex] };
          this.objectiveBeacon.group.position.set(this.waypointPos.x, 0, this.waypointPos.z);
          this.progressText = `GATE ${this.raceGateIndex + 1}/${STREET_RACE_GATES.length} · ${this.raceTimer.toFixed(1)}s`;
        }
      }
      return;
    }

    // Auto-start next story mission if player drives/walks onto its golden start beacon
    if (!this.activeMission) {
      const next = this.getNextMission();
      if (Math.hypot(px - next.startPos.x, pz - next.startPos.z) < 5.5) {
        this.startMissionById(next.id);
      }
      return;
    }

    const m = this.activeMission;
    if (m.timeLimit && this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.activeMission = null;
        this.stage = 'idle';
        this.toast('MISSION FAILED — SWEEP TIMER EXPIRED', '#ff4b5c');
        this.syncNextAvailableBeacon();
        return;
      }
    }

    if (this.stage === 'pickup') {
      if (m.type === 'steal-deliver' && this.targetVehicle) {
        this.waypointPos = { x: this.targetVehicle.x, z: this.targetVehicle.z };
        this.objectiveBeacon.group.position.set(this.waypointPos.x, 0, this.waypointPos.z);
        if (playerState.vehicle === this.targetVehicle) {
          this.stage = 'deliver';
          this.waypointPos = { ...m.deliverPos };
          this.objectiveBeacon.group.position.set(this.waypointPos.x, 0, this.waypointPos.z);
          this.objectiveText = 'Deliver the Palma Coupe to Cruz Safehouse Garage';
          this.progressText = 'DELIVER VEHICLE';
          this.police.setWantedLevel(m.wantedOnPickup || 3);
          this.toast('SKPD ALERTED — HAUL IT TO CRUZ GARAGE!', '#ff6b9d');
        }
      } else if (Math.hypot(px - this.waypointPos.x, pz - this.waypointPos.z) < 6.0) {
        this.stage = 'deliver';
        this.waypointPos = { ...m.deliverPos };
        this.objectiveBeacon.group.position.set(this.waypointPos.x, 0, this.waypointPos.z);
        this.objectiveText = m.type === 'heist' ? 'Escape 5-Star lockdown to Marina Pier!' : 'Deliver payload to Cruz Safehouse Garage';
        this.progressText = 'STAGE 2/2';
        if (m.wantedOnPickup) this.police.setWantedLevel(m.wantedOnPickup);
        this.toast('CARGO SECURED — SKPD CLOSING IN!', '#ffc145');
        if (this.audio) this.audio.playChime(true);
      }
    } else if (this.stage === 'deliver') {
      if (Math.hypot(px - this.waypointPos.x, pz - this.waypointPos.z) < 7.5) {
        this.completeMission(career);
      }
    } else if (this.stage === 'checkpoints') {
      const cp = m.checkpoints[this.checkpointIndex];
      if (Math.hypot(px - cp.x, pz - cp.z) < 7.2) {
        this.checkpointIndex += 1;
        if (this.audio) this.audio.playChime(false);
        if (this.checkpointIndex >= m.checkpoints.length) {
          this.completeMission(career);
        } else {
          this.waypointPos = { ...m.checkpoints[this.checkpointIndex] };
          this.objectiveBeacon.group.position.set(this.waypointPos.x, 0, this.waypointPos.z);
          this.progressText = `${this.checkpointIndex}/${m.checkpoints.length} RELAYS · ${Math.ceil(this.timer)}s`;
        }
      } else {
        this.progressText = `${this.checkpointIndex}/${m.checkpoints.length} RELAYS · ${Math.ceil(this.timer)}s`;
      }
    } else if (this.stage === 'combat') {
      const alive = this.peds.enemies.find((e) => e.alive);
      if (alive) {
        this.waypointPos = { x: alive.x, z: alive.z };
        this.objectiveBeacon.group.position.set(alive.x, 0, alive.z);
      }
    }
  }
}
