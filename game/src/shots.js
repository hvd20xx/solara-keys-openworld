// Deterministic ?shot=1..4 live scene staging inside the real 3D engine for authentic browser captures.

import { MISSIONS } from './config.js';
import { animateCharacter } from './pedestrians.js';

const THREE = window.THREE;

export function applyShotStaging(shotId, engine) {
  const { city, vehicles, peds, police, combat, missions, cameraCtrl, hud, player, career, lighting } = engine;
  cameraCtrl.locked = true;
  player.inShotMode = true;

  if (shotId === '1') {
    // COVER SHOT: Dramatic Golden-Hour 4-Star Police Chase on Palm Strip Ocean Boulevard
    city.setMood('golden');
    lighting.setMood('golden');
    city.skyDome.rotation.y = 0.6;
    hud.setHubOpen(false);

    // Player driving Cobalt GT in high-speed power-drift down Palm Strip Oceanfront
    const heroCar = player.vehicle || vehicles.spawnVehicle('cobaltGT', 179.8, 7.5, Math.PI, { color: 0x0ea5ff, isPlayer: true });
    player.enterVehicle(heroCar);
    heroCar.x = 179.6;
    heroCar.z = 7.4;
    heroCar.heading = Math.PI + 0.44; // dramatic power-drift angle showing chassis, GT wing & underglow
    heroCar.speed = 38;
    heroCar.drifting = true;
    heroCar.hp = heroCar.maxHp;

    // Close pursuing SKPD Cruisers, Interceptor & Tactical Van with blazing lightbars
    police.clearRoadblocks();
    police.setWantedLevel(4);
    const c1 = police.spawnPoliceUnit('skpdCruiser', 176.0, -4.8, Math.PI - 0.16);
    const c2 = police.spawnPoliceUnit('skpdInterceptor', 183.6, -9.8, Math.PI + 0.12);
    const van = police.spawnPoliceUnit('skpdVan', 178.8, -22.5, Math.PI - 0.04);
    c1.speed = 35;
    c2.speed = 37;
    van.speed = 29;

    // Roadblock ahead on Palm Strip clearly visible down the avenue
    police.spawnRoadblock(180, -35, 'z');
    const rbCar = police.spawnPoliceUnit('skpdCruiser', 183.5, -33.5, Math.PI * 0.42);
    rbCar.speed = 0;

    // Overhead Air-One Helicopter framed cleanly in upper-center golden sky, spotlight locked on Cobalt GT
    police.airOneState.active = true;
    police.airOneState.x = 185.0;
    police.airOneState.y = 17.8;
    police.airOneState.z = -15.5;
    police.airOneState.heading = Math.atan2(heroCar.x - 185.0, heroCar.z - (-15.5));
    police.airOne.root.visible = true;
    police.airOne.groundSpot.visible = true;
    police.syncAirOneVisuals(1.2, 0.016, heroCar.x, heroCar.z);

    // Billowing drift tire smoke & golden-orange sparks streaming along the drift arc
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const sx = 178.6 - t * 3.8 + (i % 2) * 0.6;
      const sz = 9.2 + t * 2.8 - (i % 3) * 0.35;
      const isSpark = i % 3 === 0;
      vehicles.spawnSparkOrSmoke(sx, isSpark ? 0.35 + (i % 2) * 0.25 : 0.45 + t * 0.5, sz, isSpark ? 0xffbe33 : 0xdde5f0, isSpark ? 0.38 : 0.52, 1.1, 0.2);
    }

    // Active Mission: Causeway Heat
    missions.activeMission = MISSIONS[3];
    missions.stage = 'deliver';
    missions.objectiveTitle = 'CAUSEWAY HEAT';
    missions.objectiveText = 'Evade 4-Star SKPD & Air-One along Palm Strip';
    missions.progressText = '4-STAR PURSUIT';
    missions.waypointPos = { x: 180, z: -64 };
    missions.objectiveBeacon.group.position.set(180, 0, -64);

    career.cash = 18450;
    career.respect = 920;
    player.health = 92;
    player.armor = 78;
    combat.selectSlot(2);

    // Unobstructed heroic chase camera inside Ocean Blvd corridor: zero palm blocking lens, palms + turquoise bay frame right edge, Art-Deco hotels frame left!
    cameraCtrl.snapTo({ x: 184.4, y: 5.0, z: 18.8 }, { x: 179.4, y: 5.2, z: -16.0 }, 62);
    return;
  }

  if (shotId === '2') {
    // SHOT 2: On-Foot Exploration in Coral Downtown Sunset Boulevard
    city.setMood('sunset');
    lighting.setMood('sunset');
    city.skyDome.rotation.y = 1.2;
    hud.setHubOpen(false);
    police.clearPursuit();

    // Mateo Cruz standing on Coral Downtown boulevard beside a sleek Palma Coupe to steal
    player.exitVehicle();
    player.x = 5.4;
    player.z = 15.6;
    player.heading = -0.45;
    player.rig.root.position.set(player.x, 0.2, player.z);
    player.rig.root.rotation.y = player.heading;
    player.rig.weaponMesh.visible = true;
    animateCharacter(player.rig, 2.2, false, 1.4);

    // Stealable Coral-Pink Palma Coupe parked curbside + lively downtown traffic
    const coupe = vehicles.spawnVehicle('palmaCoupe', 2.2, 12.4, Math.PI, { color: 0xff4b8b });
    coupe.speed = 0;
    const cab = vehicles.spawnVehicle('keysCab', -3.2, 2.5, 0, { color: 0xf7c626 });
    cab.speed = 12;
    const suv = vehicles.spawnVehicle('tideRunner', 3.4, -12, Math.PI, { color: 0xf4f7fc });
    suv.speed = 14;
    const gt = vehicles.spawnVehicle('cobaltGT', -3.2, -24, 0, { color: 0x00d2ff });
    gt.speed = 15;

    // Strolling downtown pedestrians along both sidewalks
    peds.spawnPedestrian(8.6, 5.2, Math.PI);
    peds.spawnPedestrian(-8.4, 7.6, 0);
    peds.spawnPedestrian(8.8, -6.5, Math.PI);
    peds.spawnPedestrian(-8.9, -9.2, 0.15);

    // Glowing golden mission waypoint beacon down the skyscraper canyon
    missions.activeMission = MISSIONS[2];
    missions.stage = 'checkpoints';
    missions.objectiveTitle = 'BLACKOUT RUN';
    missions.objectiveText = 'Boost a ride & hit 4 Coral Downtown signal relays';
    missions.progressText = '0/4 RELAYS';
    missions.waypointPos = { x: 0, z: -26 };
    missions.objectiveBeacon.group.position.set(0, 0, -26);

    career.cash = 11200;
    career.respect = 540;
    player.health = 100;
    player.armor = 85;
    combat.selectSlot(1);
    player.forcedPrompt = '[F] STEAL PALMA COUPE';

    // Clean unobstructed canyon camera framing BOTH towering skyscraper rows, Mateo, Palma Coupe, traffic, palms & beacon
    cameraCtrl.snapTo({ x: 8.8, y: 3.9, z: 24.4 }, { x: -1.6, y: 8.6, z: -20.0 }, 64);
    return;
  }

  if (shotId === '3') {
    // SHOT 3: Dusk Combat & Heist Action at Marina Docks Waterfront
    city.setMood('dusk');
    lighting.setMood('dusk');
    city.skyDome.rotation.y = 2.4;
    hud.setHubOpen(false);
    police.clearRoadblocks();
    police.setWantedLevel(3);

    // Mateo Cruz in clear foreground firing Vector SMG across the open Marina Docks waterfront apron
    player.exitVehicle();
    player.x = 114.2;
    player.z = 180.4;
    player.heading = 1.32;
    player.rig.root.position.set(player.x, 0.2, player.z);
    player.rig.root.rotation.y = player.heading;
    player.rig.weaponMesh.visible = true;
    animateCharacter(player.rig, 1.4, true, 0.8);

    // Armed rival syndicate enforcers positioned by cargo containers & dock apron
    peds.clearEnemies();
    const e1 = peds.spawnSyndicateEnemy(127.5, 177.2, -1.7);
    const e2 = peds.spawnSyndicateEnemy(132.5, 185.6, -1.3);
    const e3 = peds.spawnSyndicateEnemy(124.8, 189.2, -0.9);
    animateCharacter(e1.rig, 1.2, true, 0.5);
    animateCharacter(e2.rig, 1.0, true, 1.1);
    animateCharacter(e3.rig, 1.0, true, 1.8);

    // Burning exploding syndicate SUV beside the shipping containers
    const targetVan = vehicles.spawnVehicle('tideRunner', 132.0, 180.5, 0.85, { color: 0x2d3a4b });
    vehicles.wreckVehicle(targetVan);
    combat.spawnExplosion(132.0, 1.4, 180.5, 10, {});
    combat.update(0.42, { vehicles, peds, police, colliders: city.colliders });

    // Bright Vector SMG muzzle flash at Mateo's right hand + crisscrossing golden & crimson bullet tracers
    combat.spawnMuzzleFlash(115.1, 1.54, 181.1, 0xffdd66, 3.0);
    combat.spawnTracer(new THREE.Vector3(115.1, 1.54, 181.1), new THREE.Vector3(127.2, 1.5, 177.4), 0xffd166, 0.5);
    combat.spawnTracer(new THREE.Vector3(115.1, 1.58, 181.0), new THREE.Vector3(132.0, 1.45, 185.2), 0xffa630, 0.5);
    combat.spawnTracer(new THREE.Vector3(131.8, 1.46, 185.4), new THREE.Vector3(116.5, 1.65, 181.2), 0xff4b5c, 0.5);

    // Arriving SKPD Cruiser sliding into the dock shootout with blazing strobes
    const cop = police.spawnPoliceUnit('skpdCruiser', 117.5, 191.5, 0.72);
    cop.speed = 18;

    // Air-One Helicopter hovering over Marina Bay gantry crane, searchlight locked on combat zone
    police.airOneState.active = true;
    police.airOneState.x = 142.0;
    police.airOneState.y = 19.5;
    police.airOneState.z = 193.5;
    police.airOneState.heading = Math.atan2(128.0 - 142.0, 182.0 - 193.5);
    police.airOne.root.visible = true;
    police.airOne.groundSpot.visible = true;
    police.syncAirOneVisuals(1.6, 0.016, 128.0, 182.0);

    missions.activeMission = MISSIONS[4];
    missions.stage = 'combat';
    missions.objectiveTitle = 'DOCKS AMBUSH';
    missions.objectiveText = 'Eliminate syndicate crew & survive SKPD response';
    missions.progressText = '3/5 CREW CLEARED';
    missions.waypointPos = { x: 132.5, z: 185.6 };
    missions.objectiveBeacon.group.position.set(132.5, 0, 185.6);

    career.cash = 24800;
    career.respect = 1480;
    player.health = 78;
    player.armor = 54;
    combat.selectSlot(2);

    // Unobstructed over-the-shoulder action camera on open dock asphalt — zero container blocking lens!
    cameraCtrl.snapTo({ x: 107.8, y: 3.9, z: 177.2 }, { x: 131.5, y: 4.5, z: 184.5 }, 62);
    return;
  }

  if (shotId === '4') {
    // SHOT 4: Sunlit Solara Keys 3D City Panorama with Start / Career / Save / Safehouse Hub Overlay
    city.setMood('golden');
    lighting.setMood('golden');
    city.skyDome.rotation.y = 0.8;
    police.clearPursuit();

    // Showcase Cobalt GT parked on Ocean Blvd overlooking skyline & bay
    const heroCar = player.vehicle || vehicles.spawnVehicle('cobaltGT', 176, 16, Math.PI * 0.85, { color: 0x00c8d7, isPlayer: true });
    heroCar.x = 176;
    heroCar.z = 16;
    heroCar.heading = Math.PI * 0.85;

    career.cash = 16400;
    career.respect = 890;
    career.upgrades = { armor: 2, turbo: 1 };
    missions.completedIds = new Set(['pier-drop', 'neon-repo', 'blackout-run']);
    missions.activeMission = MISSIONS[3];
    missions.objectiveTitle = 'CAUSEWAY HEAT';
    missions.objectiveText = 'Break 4-Star lockdown across Causeway Heights';
    missions.progressText = '3/6 MISSIONS';

    const mockSlots = [
      { cash: 16400, respect: 890, completedMissions: ['pier-drop', 'neon-repo', 'blackout-run'], district: 'PALM STRIP', updatedAt: '2026-11-23 21:05' },
      { cash: 41200, respect: 2370, completedMissions: ['pier-drop', 'neon-repo', 'blackout-run', 'causeway-heat', 'docks-ambush', 'golden-hour-heist'], district: 'MARINA DOCKS', updatedAt: '2026-11-23 20:18' },
      null,
    ];

    hud.setHubOpen(true, 'Career Saves · 6 Story Missions · Cruz Safehouse Garage', {
      career,
      completedIds: missions.completedIds,
      activeMissionId: MISSIONS[3].id,
      overrideSlots: mockSlots,
    });

    cameraCtrl.snapTo({ x: 226, y: 38, z: 92 }, { x: 56, y: 26, z: -18 }, 60);
  }
}
