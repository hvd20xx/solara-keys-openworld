// Main entry point and playable loop for Solara Keys: Heatline (Three.js 3D open-world crime game).

import { AudioEngine } from './audio.js';
import { FollowCamera } from './camera.js';
import { buildCity } from './city.js';
import { CombatSystem } from './combat.js';
import { WORLD, getDistrictAt } from './config.js';
import { HudController } from './hud.js';
import { MissionSystem } from './missions.js';
import { PedestrianManager, animateCharacter, buildCharacterRig } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { createDefaultCareer, loadFromSlot, saveToSlot } from './save.js';
import { applyShotStaging } from './shots.js';
import { createTexturePack } from './textures.js';
import { VehicleManager, resolveBuildingCollision } from './vehicles.js';

const THREE = window.THREE;

function createLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xffddb0, 0x2c3c5c, 0.88);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd296, 1.32);
  sun.position.set(160, 92, 65);
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x4fd8ff, 0.42);
  rim.position.set(-140, 64, -120);
  scene.add(rim);

  const fog = new THREE.FogExp2(0xdc9b84, 0.0024);
  scene.fog = fog;

  return {
    hemi,
    sun,
    rim,
    fog,
    setMood(mood) {
      if (mood === 'dusk') {
        hemi.color.setHex(0x8899dd);
        hemi.groundColor.setHex(0x182038);
        hemi.intensity = 0.78;
        sun.color.setHex(0xff8e63);
        sun.intensity = 1.05;
        sun.position.set(140, 48, 95);
        rim.color.setHex(0x38d9ff);
        rim.intensity = 0.62;
        fog.color.setHex(0x28274a);
        fog.density = 0.0026;
      } else if (mood === 'sunset') {
        hemi.color.setHex(0xffc39e);
        hemi.groundColor.setHex(0x293354);
        hemi.intensity = 0.86;
        sun.color.setHex(0xffa46b);
        sun.intensity = 1.24;
        sun.position.set(150, 62, 50);
        rim.color.setHex(0x62e5ff);
        rim.intensity = 0.48;
        fog.color.setHex(0x9a5d7c);
        fog.density = 0.0022;
      } else {
        hemi.color.setHex(0xffe1b8);
        hemi.groundColor.setHex(0x2c4260);
        hemi.intensity = 0.92;
        sun.color.setHex(0xffd496);
        sun.intensity = 1.34;
        sun.position.set(170, 88, 60);
        rim.color.setHex(0x4be0ff);
        rim.intensity = 0.45;
        fog.color.setHex(0xd49680);
        fog.density = 0.0021;
      }
    },
  };
}

function createInputState() {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, active: false };
  return {
    keys,
    mouse,
    up: false,
    down: false,
    left: false,
    right: false,
    drift: false,
    sprint: false,
    sync() {
      this.up = keys.has('KeyW') || keys.has('ArrowUp');
      this.down = keys.has('KeyS') || keys.has('ArrowDown');
      this.left = keys.has('KeyA') || keys.has('ArrowLeft');
      this.right = keys.has('KeyD') || keys.has('ArrowRight');
      this.drift = keys.has('Space');
      this.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
  };
}

export function bootGame() {
  const params = new URLSearchParams(window.location.search);
  const shotId = params.get('shot');
  const seed = Number(params.get('seed')) || 42;

  const container = document.getElementById('viewport');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 900);
  const cameraCtrl = new FollowCamera(camera);

  const textures = createTexturePack();
  const lighting = createLighting(scene);
  const city = buildCity(scene, textures, seed);
  const audio = new AudioEngine();
  const vehicles = new VehicleManager(scene, textures, city.colliders, seed + 10);
  const peds = new PedestrianManager(scene, city.colliders, seed + 20);
  const police = new PoliceSystem(scene, textures, vehicles, city.colliders);
  const combat = new CombatSystem(scene, textures, audio);
  const missions = new MissionSystem(scene, vehicles, peds, police, audio);

  vehicles.spawnInitialTraffic(22);
  peds.spawnSidewalkCrowd(34);

  // Career & Protagonist state (Mateo Cruz)
  const career = createDefaultCareer();
  const playerRig = buildCharacterRig({
    shirtColor: 0x16a8b8,
    innerColor: 0xf6f8fc,
    pantsColor: 0x1e2430,
    skinColor: 0xdca47c,
    isProtagonist: true,
  });
  scene.add(playerRig.root);

  const starterCar = vehicles.spawnVehicle('cobaltGT', 180, 18, Math.PI, {
    color: 0x1498ff,
    isPlayer: true,
  });

  const player = {
    rig: playerRig,
    x: starterCar.x,
    z: starterCar.z,
    heading: starterCar.heading,
    speed: 0,
    health: 100,
    maxHealth: 100,
    armor: 60,
    maxArmor: 100,
    vehicle: starterCar,
    inShotMode: false,
    forcedPrompt: null,
    respawnTimer: 0,
    statusBanner: null,
    enterVehicle(v) {
      if (this.vehicle) this.vehicle.isPlayer = false;
      this.vehicle = v;
      v.isPlayer = true;
      v.isTraffic = false;
      this.rig.root.visible = false;
      this.x = v.x;
      this.z = v.z;
      this.heading = v.heading;
    },
    exitVehicle() {
      if (!this.vehicle) return;
      const v = this.vehicle;
      v.isPlayer = false;
      const sideX = v.x + Math.cos(v.heading) * (v.spec.width * 0.9 + 0.9);
      const sideZ = v.z - Math.sin(v.heading) * (v.spec.width * 0.9 + 0.9);
      const safe = resolveBuildingCollision(sideX, sideZ, 0.7, city.colliders);
      this.x = safe.x;
      this.z = safe.z;
      this.heading = v.heading;
      this.vehicle = null;
      this.rig.root.visible = true;
      this.rig.root.position.set(this.x, 0.2, this.z);
      this.rig.root.rotation.y = this.heading;
    },
  };
  player.enterVehicle(starterCar);

  let started = false;
  let paused = true;

  const getHubSnapshot = () => ({
    career,
    completedIds: missions.completedIds,
    activeMissionId: missions.activeMission?.id || null,
  });

  const hud = new HudController({
    onResume() {
      audio.unlock();
      started = true;
      paused = false;
      hud.setHubOpen(false);
    },
    onOpenHub(subtitle) {
      paused = true;
      hud.setHubOpen(true, subtitle, getHubSnapshot());
    },
    onToggleMute() {
      audio.unlock();
      return audio.toggleMute();
    },
    onSaveSlot(slotIndex) {
      const dist = getDistrictAt(player.x, player.z).name;
      saveToSlot(slotIndex, career, missions.completedIds, player, dist);
      missions.toast(`SAVED TO SLOT ${slotIndex + 1}`, '#38e8ff');
      hud.renderHubContent(getHubSnapshot());
    },
    onLoadSlot(slotIndex) {
      const loaded = loadFromSlot(slotIndex);
      if (!loaded) return;
      career.cash = loaded.cash;
      career.respect = loaded.respect;
      career.upgrades = { ...loaded.upgrades };
      missions.completedIds = new Set(loaded.completedMissions);
      missions.activeMission = null;
      missions.stage = 'idle';
      missions.syncNextAvailableBeacon();
      police.clearPursuit();
      player.maxArmor = 100 + career.upgrades.armor * 35;
      player.armor = player.maxArmor;
      player.health = player.maxHealth;
      if (player.vehicle) {
        player.vehicle.x = loaded.playerPos.x;
        player.vehicle.z = loaded.playerPos.z;
        player.vehicle.heading = loaded.playerPos.heading || Math.PI;
        player.vehicle.vx = 0;
        player.vehicle.vz = 0;
      } else {
        player.x = loaded.playerPos.x;
        player.z = loaded.playerPos.z;
      }
      missions.toast(`LOADED SLOT ${slotIndex + 1} (${loaded.district})`, '#2ce5b5');
      audio.unlock();
      started = true;
      paused = false;
      hud.setHubOpen(false);
    },
    onLaunchMission(missionId) {
      audio.unlock();
      started = true;
      paused = false;
      hud.setHubOpen(false);
      missions.startMissionById(missionId);
    },
    onBuyUpgrade(upgradeId) {
      const res = missions.applyGarageUpgrade(upgradeId, career, player.vehicle || starterCar);
      if (res.ok && upgradeId === 'armor') {
        player.maxArmor = 100 + career.upgrades.armor * 35;
        player.armor = player.maxArmor;
      }
      hud.renderHubContent(getHubSnapshot());
    },
  });

  // Initial Hub / Start screen open over live rotating 3D city vista
  hud.setHubOpen(true, 'Open-World Coastal Crime · 5 Districts · 6 Missions · 5-Star SKPD', getHubSnapshot());

  // Keyboard & Mouse bindings
  const input = createInputState();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimWorldPoint = new THREE.Vector3();

  function damagePlayer(amount) {
    if (player.respawnTimer > 0 || player.inShotMode) return;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, amount);
      player.armor -= absorbed;
      amount -= absorbed;
    }
    player.health = Math.max(0, player.health - amount);
    if (player.health <= 0) {
      triggerRespawn('WASTED — HOSPITAL RECOVERY (-$250)');
    }
  }

  function triggerRespawn(message) {
    player.respawnTimer = 2.6;
    player.statusBanner = message;
    career.cash = Math.max(0, career.cash - 250);
    police.clearPursuit();
    if (audio) audio.playExplosion();
  }

  function finishRespawn() {
    player.respawnTimer = 0;
    player.statusBanner = null;
    player.health = player.maxHealth;
    player.armor = Math.min(player.maxArmor, 50);
    combat.refillAmmo();
    const freshCar = vehicles.spawnVehicle('cobaltGT', WORLD.garagePos.x + 8, WORLD.garagePos.z + 10, 0, { color: 0x1498ff });
    player.enterVehicle(freshCar);
  }

  window.addEventListener('keydown', (e) => {
    input.keys.add(e.code);
    if (e.code === 'Escape' || e.code === 'Tab') {
      e.preventDefault();
      if (paused && started) {
        paused = false;
        hud.setHubOpen(false);
      } else {
        paused = true;
        hud.setHubOpen(true, 'Paused · Save Career · Missions · Cruz Garage', getHubSnapshot());
      }
      return;
    }
    if (paused) return;
    audio.unlock();

    if (e.code === 'Digit1') combat.selectSlot(0);
    if (e.code === 'Digit2') combat.selectSlot(1);
    if (e.code === 'Digit3') combat.selectSlot(2);
    if (e.code === 'Digit4') combat.selectSlot(3);
    if (e.code === 'KeyQ') {
      const st = audio.cycleRadio();
      missions.toast(`RADIO: ${st.name} (${st.genre})`, st.accent, 2.5);
    }
    if (e.code === 'KeyM') audio.toggleMute();
    if (e.code === 'KeyG') {
      if (Math.hypot(player.x - WORLD.garagePos.x, player.z - WORLD.garagePos.z) < 26) {
        paused = true;
        hud.setHubOpen(true, 'CRUZ SAFEHOUSE GARAGE — UPGRADES & RESPRAY', getHubSnapshot());
      } else {
        missions.toast('DRIVE TO EMERALD GARAGE BEACON IN OCHRE YARD (OR PRESS ESC)', '#2ce5b5', 3);
      }
    }
    if (e.code === 'KeyR') {
      if (Math.hypot(player.x - WORLD.raceStartPos.x, player.z - WORLD.raceStartPos.z) < 24) {
        missions.startStreetRace();
      }
    }
    if (e.code === 'KeyF' || e.code === 'KeyE') {
      if (player.vehicle) {
        player.exitVehicle();
      } else {
        const near = vehicles.findNearestEnterable(player.x, player.z, 6.0);
        if (near) {
          const stolen = !near.isPlayer && near.isTraffic;
          player.enterVehicle(near);
          if (near.isPolice) police.addHeat(110);
          else if (stolen) police.addHeat(45);
          missions.toast(`ENTERED ${near.spec.name.toUpperCase()}`, '#38e8ff', 2.2);
        }
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });

  window.addEventListener('wheel', (e) => {
    if (paused) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    combat.selectSlot((combat.activeSlot + dir + combat.weapons.length) % combat.weapons.length);
  });

  renderer.domElement.addEventListener('mousemove', (e) => {
    input.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    input.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    input.mouse.active = true;
  });

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !paused) {
      audio.unlock();
      input.mouse.down = true;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function computePrompt() {
    if (player.forcedPrompt) return player.forcedPrompt;
    if (Math.hypot(player.x - WORLD.garagePos.x, player.z - WORLD.garagePos.z) < 16) {
      return '[G] ENTER CRUZ SAFEHOUSE GARAGE';
    }
    if (!missions.raceActive && !missions.activeMission && Math.hypot(player.x - WORLD.raceStartPos.x, player.z - WORLD.raceStartPos.z) < 16) {
      return '[R] START PALM STRIP STREET SPRINT';
    }
    if (!player.vehicle) {
      const near = vehicles.findNearestEnterable(player.x, player.z, 5.8);
      if (near) {
        return `[F] ${near.isTraffic || near.isPolice ? 'STEAL' : 'ENTER'} ${near.spec.name.toUpperCase()}`;
      }
    }
    return null;
  }

  function buildHudSnapshot() {
    const district = getDistrictAt(player.x, player.z);
    const wp = missions.waypointPos;
    const wpDist = wp ? Math.hypot(wp.x - player.x, wp.z - player.z) : null;
    return {
      district,
      missionTitle: missions.objectiveTitle,
      missionDesc: missions.objectiveText,
      missionProgress: missions.progressText,
      waypointDist: wpDist,
      waypointPos: wp,
      wantedLevel: police.wantedLevel,
      cash: career.cash,
      respect: career.respect,
      weapons: combat.weapons,
      activeWeaponSlot: combat.activeSlot,
      health: player.health,
      maxHealth: player.maxHealth,
      armor: player.armor,
      maxArmor: player.maxArmor,
      inVehicle: Boolean(player.vehicle),
      vehicle: player.vehicle,
      radio: audio.getStation(),
      promptText: computePrompt(),
      toast: missions.bannerToast,
      statusBanner: player.statusBanner,
      playerPos: { x: player.x, z: player.z, heading: player.heading },
      minimapBuildings: city.minimapBuildings,
      vehicles: vehicles.vehicles,
      enemies: peds.enemies,
      policeUnits: police.units,
      airOne: police.airOneState,
    };
  }

  // Deterministic screenshot staging mode (?shot=1..4) — render on rAF so WebGL swapchain presents cleanly
  if (shotId) {
    started = true;
    paused = false;
    applyShotStaging(shotId, { city, vehicles, peds, police, combat, missions, cameraCtrl, hud, player, career, lighting });
    vehicles.syncVisuals(1.2, 0.016);
    city.update(1.2, 0.016);
    hud.update(buildHudSnapshot(), 1.2);
    city.skyDome.position.copy(camera.position);
    renderer.render(scene, camera);
    window.__SOLARA_READY__ = true;
    const renderShotFrame = () => {
      city.skyDome.position.copy(camera.position);
      renderer.render(scene, camera);
      requestAnimationFrame(renderShotFrame);
    };
    requestAnimationFrame(renderShotFrame);
    return;
  }

  // Live 60 FPS gameplay loop
  let prev = performance.now();
  let elapsed = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    elapsed += dt;

    input.sync();
    city.update(elapsed, dt);

    if (paused) {
      if (!started) {
        cameraCtrl.updatePanorama(dt);
      }
      vehicles.syncVisuals(elapsed, dt);
      hud.update(buildHudSnapshot(), elapsed);
      renderer.render(scene, camera);
      return;
    }

    if (player.respawnTimer > 0) {
      player.respawnTimer -= dt;
      if (player.respawnTimer <= 0) finishRespawn();
    } else if (player.vehicle) {
      vehicles.updatePlayerVehicle(player.vehicle, input, dt, career.upgrades);
      player.x = player.vehicle.x;
      player.z = player.vehicle.z;
      player.heading = player.vehicle.heading;
      player.speed = player.vehicle.speed;

      // Drive-by shooting from vehicle with SMG / Sidearm
      if (input.mouse.down && combat.activeSlot > 0 && combat.activeSlot < 3) {
        combat.firePlayerWeapon(player, player.heading, {
          vehicles,
          peds,
          police,
          colliders: city.colliders,
          playerVehicle: player.vehicle,
          onEnemyKill: () => {
            career.cash += 150;
            career.respect += 25;
            missions.onEnemyKilled(career);
          },
        });
      }
    } else {
      // On-foot movement & mouse cursor aiming
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let mz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const camFwd = new THREE.Vector3();
      camera.getWorldDirection(camFwd);
      camFwd.y = 0;
      camFwd.normalize();
      const camRight = new THREE.Vector3(-camFwd.z, 0, camFwd.x);

      let moveX = camFwd.x * -mz + camRight.x * mx;
      let moveZ = camFwd.z * -mz + camRight.z * mx;
      const moveLen = Math.hypot(moveX, moveZ);
      const speed = input.sprint ? 10.5 : 6.4;

      if (moveLen > 0.01) {
        moveX = (moveX / moveLen) * speed;
        moveZ = (moveZ / moveLen) * speed;
        const res = resolveBuildingCollision(player.x + moveX * dt, player.z + moveZ * dt, 0.65, city.colliders);
        player.x = res.x;
        player.z = res.z;
        player.speed = speed;
        if (!input.mouse.down) {
          player.heading = Math.atan2(moveX, moveZ);
        }
      } else {
        player.speed = 0;
      }

      // Raycast cursor to ground plane for precise aiming
      if (input.mouse.active) {
        raycaster.setFromCamera(new THREE.Vector2(input.mouse.x, input.mouse.y), camera);
        if (raycaster.ray.intersectPlane(groundPlane, aimWorldPoint)) {
          const adx = aimWorldPoint.x - player.x;
          const adz = aimWorldPoint.z - player.z;
          if (Math.hypot(adx, adz) > 0.5 && (input.mouse.down || moveLen < 0.01)) {
            player.heading = Math.atan2(adx, adz);
          }
        }
      }

      player.rig.weaponMesh.visible = combat.activeSlot > 0;
      player.rig.root.position.set(player.x, 0.2, player.z);
      player.rig.root.rotation.y = player.heading;
      animateCharacter(player.rig, player.speed, input.mouse.down && combat.activeSlot > 0, elapsed);

      if (input.mouse.down) {
        combat.firePlayerWeapon(player, player.heading, {
          vehicles,
          peds,
          police,
          colliders: city.colliders,
          playerVehicle: null,
          onEnemyKill: () => {
            career.cash += 150;
            career.respect += 25;
            missions.onEnemyKilled(career);
          },
        });
      }
    }

    vehicles.updateTraffic(dt, player);
    vehicles.resolveVehicleCollisions((a, b, relSpeed) => {
      if ((a.isPlayer || b.isPlayer) && relSpeed > 15) {
        combat.shakeAmount = Math.max(combat.shakeAmount, 0.35);
        if (a.isPolice || b.isPolice) police.addHeat(55);
      }
    });

    peds.update(elapsed, dt, player, (enemy, target) => {
      combat.fireEnemyShot(enemy, target, damagePlayer);
    });

    police.update(elapsed, dt, player, () => {
      triggerRespawn('BUSTED BY SKPD — IMPOUND FEE (-$250)');
    });

    combat.update(dt, {
      vehicles,
      peds,
      police,
      colliders: city.colliders,
      playerVehicle: player.vehicle,
      onEnemyKill: () => {
        career.cash += 150;
        career.respect += 25;
        missions.onEnemyKilled(career);
      },
    });

    missions.update(elapsed, dt, player, career);
    vehicles.syncVisuals(elapsed, dt);

    audio.update(elapsed, dt, {
      inVehicle: Boolean(player.vehicle),
      speed: player.speed,
      drifting: Boolean(player.vehicle?.drifting),
      wantedLevel: police.wantedLevel,
    });

    cameraCtrl.updateFollow(
      dt,
      {
        x: player.x,
        z: player.z,
        heading: player.heading,
        speed: player.speed,
        inVehicle: Boolean(player.vehicle),
      },
      combat.shakeAmount,
    );

    hud.update(buildHudSnapshot(), elapsed);
    city.skyDome.position.copy(camera.position);
    renderer.render(scene, camera);
  }

  window.__SOLARA_READY__ = true;
  requestAnimationFrame(tick);
}

bootGame();
