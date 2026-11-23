// Live Canvas2D Minimap Radar and glassmorphic HUD + Start/Save/Mission/Safehouse Hub controller.

import { GARAGE_UPGRADES, MISSIONS, WORLD } from './config.js';
import { listSaveSlots } from './save.js';

export class HudController {
  constructor(callbacks) {
    this.cb = callbacks;
    this.el = {
      hudRoot: document.getElementById('hud-root'),
      minimapCanvas: document.getElementById('minimap-canvas'),
      districtName: document.getElementById('district-name'),
      districtTagline: document.getElementById('district-tagline'),
      missionTitle: document.getElementById('mission-title'),
      missionDesc: document.getElementById('mission-desc'),
      missionProgress: document.getElementById('mission-progress'),
      missionDist: document.getElementById('mission-dist'),
      wantedStars: document.getElementById('wanted-stars'),
      cashValue: document.getElementById('cash-value'),
      repValue: document.getElementById('rep-value'),
      weaponWheel: document.getElementById('weapon-wheel'),
      healthFill: document.getElementById('health-fill'),
      armorFill: document.getElementById('armor-fill'),
      healthText: document.getElementById('health-text'),
      armorText: document.getElementById('armor-text'),
      speedPanel: document.getElementById('speed-panel'),
      speedValue: document.getElementById('speed-value'),
      gearValue: document.getElementById('gear-value'),
      vehicleName: document.getElementById('vehicle-name'),
      driftTag: document.getElementById('drift-tag'),
      radioName: document.getElementById('radio-name'),
      promptPill: document.getElementById('prompt-pill'),
      toastBanner: document.getElementById('toast-banner'),
      stateBanner: document.getElementById('state-banner'),
      hubOverlay: document.getElementById('hub-overlay'),
      hubSlots: document.getElementById('hub-slots'),
      hubMissions: document.getElementById('hub-missions'),
      hubUpgrades: document.getElementById('hub-upgrades'),
      hubCash: document.getElementById('hub-cash'),
      hubRep: document.getElementById('hub-rep'),
      hubPlayBtn: document.getElementById('hub-play-btn'),
      hubTitleSub: document.getElementById('hub-title-sub'),
    };
    this.mapCtx = this.el.minimapCanvas.getContext('2d');
    this.hubOpen = true;
    this.bindStaticButtons();
  }

  bindStaticButtons() {
    this.el.hubPlayBtn.addEventListener('click', () => {
      if (this.cb.onResume) this.cb.onResume();
    });
    const hubOpenBtn = document.getElementById('hud-hub-btn');
    if (hubOpenBtn) {
      hubOpenBtn.addEventListener('click', () => {
        if (this.cb.onOpenHub) this.cb.onOpenHub('Safehouse & Career Hub');
      });
    }
    const muteBtn = document.getElementById('hud-mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (this.cb.onToggleMute) {
          const muted = this.cb.onToggleMute();
          muteBtn.textContent = muted ? 'AUDIO: OFF' : 'AUDIO: ON';
        }
      });
    }
  }

  setHubOpen(open, subtitle = null, stateSnapshot = null) {
    this.hubOpen = open;
    this.el.hubOverlay.classList.toggle('hidden', !open);
    this.el.hudRoot.classList.toggle('hidden', open);
    if (subtitle) this.el.hubTitleSub.textContent = subtitle;
    if (open && stateSnapshot) {
      this.renderHubContent(stateSnapshot);
    }
  }

  renderHubContent({ career, completedIds, activeMissionId, overrideSlots = null }) {
    this.el.hubCash.textContent = `$${Math.floor(career.cash).toLocaleString()}`;
    this.el.hubRep.textContent = `${Math.floor(career.respect)} REP`;

    // 3 Save Slots
    const slots = overrideSlots || listSaveSlots();
    this.el.hubSlots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = slots[i];
      const card = document.createElement('div');
      card.className = 'hub-slot-card';
      if (s) {
        card.innerHTML = `
          <div class="slot-head"><strong>SLOT ${i + 1}</strong><span class="slot-tag">${s.district || 'PALM STRIP'}</span></div>
          <div class="slot-meta">$${Number(s.cash).toLocaleString()} · ${s.completedMissions?.length || 0}/6 Missions · ${s.updatedAt || 'Saved'}</div>
          <div class="slot-actions">
            <button data-load="${i}" class="btn-mini btn-cyan">Load</button>
            <button data-save="${i}" class="btn-mini btn-gold">Overwrite</button>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="slot-head"><strong>SLOT ${i + 1}</strong><span class="slot-empty">EMPTY</span></div>
          <div class="slot-meta">No career saved yet</div>
          <div class="slot-actions">
            <button data-save="${i}" class="btn-mini btn-gold">Save Here</button>
          </div>
        `;
      }
      this.el.hubSlots.appendChild(card);
    }
    this.el.hubSlots.querySelectorAll('[data-save]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onSaveSlot?.(Number(btn.dataset.save)));
    });
    this.el.hubSlots.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onLoadSlot?.(Number(btn.dataset.load)));
    });

    // 6 Story Missions tracker
    this.el.hubMissions.innerHTML = '';
    for (let i = 0; i < MISSIONS.length; i++) {
      const m = MISSIONS[i];
      const done = completedIds.has(m.id);
      const active = activeMissionId === m.id;
      const row = document.createElement('div');
      row.className = `hub-mission-row ${done ? 'done' : active ? 'active' : ''}`;
      row.innerHTML = `
        <div>
          <div class="m-name">${i + 1}. ${m.title} <span class="m-dist">${m.district}</span></div>
          <div class="m-reward">$${m.rewardCash.toLocaleString()} · +${m.rewardRep} REP</div>
        </div>
        <button data-mission="${m.id}" class="btn-mini ${active ? 'btn-pink' : done ? 'btn-dim' : 'btn-cyan'}">${active ? 'ACTIVE' : done ? 'REPLAY' : 'LAUNCH'}</button>
      `;
      this.el.hubMissions.appendChild(row);
    }
    this.el.hubMissions.querySelectorAll('[data-mission]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onLaunchMission?.(btn.dataset.mission));
    });

    // Safehouse Garage Upgrades
    this.el.hubUpgrades.innerHTML = '';
    for (const up of GARAGE_UPGRADES) {
      const lvl = career.upgrades[up.id] || 0;
      const maxed = !up.consumable && lvl >= up.maxLevel;
      const cost = up.consumable ? up.costs[0] : up.costs[Math.min(lvl, up.costs.length - 1)];
      const card = document.createElement('div');
      card.className = 'hub-upgrade-row';
      const tierLabel = up.consumable ? 'INSTANT' : `TIER ${lvl}/${up.maxLevel}`;
      card.innerHTML = `
        <div>
          <div class="m-name">${up.name} <span class="m-tier">${tierLabel}</span></div>
          <div class="m-sub">${up.desc}</div>
        </div>
        <button data-upgrade="${up.id}" class="btn-mini ${maxed ? 'btn-dim' : 'btn-gold'}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAXED' : `$${cost.toLocaleString()}`}</button>
      `;
      this.el.hubUpgrades.appendChild(card);
    }
    this.el.hubUpgrades.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onBuyUpgrade?.(btn.dataset.upgrade));
    });
  }

  update(state, time) {
    // District header
    this.el.districtName.textContent = state.district.name;
    this.el.districtName.style.color = state.district.accent;
    this.el.districtTagline.textContent = state.district.tagline;

    // Mission objective card
    this.el.missionTitle.textContent = state.missionTitle;
    this.el.missionDesc.textContent = state.missionDesc;
    this.el.missionProgress.textContent = state.missionProgress;
    this.el.missionDist.textContent = state.waypointDist != null ? `${Math.round(state.waypointDist)}m` : '';

    // 5-Star Heat Meter
    let starsHtml = '';
    const pulse = Math.sin(time * 10) > 0;
    for (let i = 1; i <= 5; i++) {
      const lit = i <= state.wantedLevel;
      const cls = lit ? (pulse ? 'star lit pulse' : 'star lit') : 'star';
      starsHtml += `<span class="${cls}">★</span>`;
    }
    this.el.wantedStars.innerHTML = starsHtml;

    // Cash & Respect
    this.el.cashValue.textContent = `$${Math.floor(state.cash).toLocaleString()}`;
    this.el.repValue.textContent = `REP ${Math.floor(state.respect)}`;

    // Weapon Wheel strip
    let wHtml = '';
    for (let i = 0; i < state.weapons.length; i++) {
      const w = state.weapons[i];
      const active = i === state.activeWeaponSlot;
      const ammoStr = Number.isFinite(w.ammo) ? `${w.ammo}` : '∞';
      wHtml += `<div class="w-chip ${active ? 'active' : ''}"><span class="w-key">${w.slot}</span><span class="w-label">${w.shortName}</span><span class="w-ammo">${ammoStr}</span></div>`;
    }
    this.el.weaponWheel.innerHTML = wHtml;

    // Health & Armor
    const hpPct = Math.max(0, Math.min(100, (state.health / state.maxHealth) * 100));
    const arPct = Math.max(0, Math.min(100, (state.armor / Math.max(1, state.maxArmor)) * 100));
    this.el.healthFill.style.width = `${hpPct}%`;
    this.el.armorFill.style.width = `${arPct}%`;
    this.el.healthText.textContent = `${Math.ceil(state.health)}`;
    this.el.armorText.textContent = `${Math.ceil(state.armor)}`;

    // Speedometer & Radio
    this.el.radioName.textContent = state.radio.name;
    this.el.radioName.style.color = state.radio.accent;
    if (state.inVehicle && state.vehicle) {
      this.el.speedPanel.classList.remove('onfoot');
      const kmh = Math.round(state.vehicle.speed * 4.2);
      const gear = kmh < 5 ? 'N' : `${Math.min(6, Math.max(1, Math.ceil(kmh / 32)))}`;
      this.el.speedValue.textContent = `${kmh}`;
      this.el.gearValue.textContent = `G${gear}`;
      this.el.vehicleName.textContent = state.vehicle.spec.name.toUpperCase();
      this.el.driftTag.classList.toggle('hidden', !state.vehicle.drifting);
    } else {
      this.el.speedPanel.classList.add('onfoot');
      this.el.speedValue.textContent = 'FOOT';
      this.el.gearValue.textContent = 'WALK';
      this.el.vehicleName.textContent = 'MATEO CRUZ';
      this.el.driftTag.classList.add('hidden', true);
    }

    // Contextual interaction prompt
    if (state.promptText) {
      this.el.promptPill.textContent = state.promptText;
      this.el.promptPill.classList.remove('hidden');
    } else {
      this.el.promptPill.classList.add('hidden');
    }

    // Mission toast banner
    if (state.toast) {
      this.el.toastBanner.textContent = state.toast.text;
      this.el.toastBanner.style.borderColor = state.toast.color;
      this.el.toastBanner.classList.remove('hidden');
    } else {
      this.el.toastBanner.classList.add('hidden');
    }

    // Wasted / Busted banner
    if (state.statusBanner) {
      this.el.stateBanner.textContent = state.statusBanner;
      this.el.stateBanner.classList.remove('hidden');
    } else {
      this.el.stateBanner.classList.add('hidden');
    }

    // Render live Canvas2D Minimap Radar
    this.renderMinimap(state, time);
  }

  renderMinimap(state, time) {
    const canvas = this.el.minimapCanvas;
    const ctx = this.mapCtx;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = 0.62; // world meters -> pixels

    const px = state.playerPos.x;
    const pz = state.playerPos.z;
    const toScreen = (wx, wz) => [cx + (wx - px) * scale, cy + (wz - pz) * scale];

    ctx.clearRect(0, 0, w, h);

    // Dark urban base
    ctx.fillStyle = '#141a26';
    ctx.fillRect(0, 0, w, h);

    // Turquoise Ocean (east + south)
    const [oceanX] = toScreen(WORLD.oceanStartX, 0);
    const [, southY] = toScreen(0, WORLD.southOceanZ);
    ctx.fillStyle = '#0d6f8a';
    ctx.fillRect(oceanX, 0, w - oceanX + 40, h);
    ctx.fillRect(0, southY, w, h - southY + 40);

    // Golden Beach Strip
    const [beachX] = toScreen(WORLD.beachStartX, 0);
    ctx.fillStyle = '#b99763';
    ctx.fillRect(beachX, 0, Math.max(0, oceanX - beachX), southY);

    // Causeway Canal
    const [canalX] = toScreen(-158, 0);
    const [, canalEndY] = toScreen(0, 120);
    ctx.fillStyle = '#0d6f8a';
    ctx.fillRect(canalX, 0, 16 * scale, Math.max(0, canalEndY));

    // Building blocks
    for (const b of state.minimapBuildings) {
      const [bx, bz] = toScreen(b.x - b.w * 0.5, b.z - b.d * 0.5);
      const bw = b.w * scale;
      const bh = b.d * scale;
      if (bx + bw < 0 || bx > w || bz + bh < 0 || bz > h) continue;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.52;
      ctx.fillRect(bx, bz, bw, bh);
    }
    ctx.globalAlpha = 1;

    // Road grid
    ctx.strokeStyle = '#384357';
    ctx.lineWidth = WORLD.roadWidth * scale;
    for (const rc of WORLD.roadCenters) {
      const [rx] = toScreen(rc, 0);
      const [, rz] = toScreen(0, rc);
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, southY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, rz);
      ctx.lineTo(beachX, rz);
      ctx.stroke();
    }

    // Safehouse Garage emerald marker
    const [gx, gy] = toScreen(WORLD.garagePos.x, WORLD.garagePos.z);
    if (gx > 6 && gx < w - 6 && gy > 6 && gy < h - 6) {
      ctx.fillStyle = '#2ce5b5';
      ctx.fillRect(gx - 5, gy - 5, 10, 10);
      ctx.strokeStyle = '#09241d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx - 5, gy - 5, 10, 10);
    }

    // Traffic blips (subtle light dots)
    ctx.fillStyle = 'rgba(215, 226, 244, 0.55)';
    for (const v of state.vehicles) {
      if (v.isPlayer || v.isPolice || v.wrecked) continue;
      const [vx, vy] = toScreen(v.x, v.z);
      if (vx < 4 || vx > w - 4 || vy < 4 || vy > h - 4) continue;
      ctx.fillRect(vx - 1.5, vy - 1.5, 3, 3);
    }

    // Hostile syndicate target blips
    ctx.fillStyle = '#ff4b5c';
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const [ex, ey] = toScreen(e.x, e.z);
      ctx.beginPath();
      ctx.arc(Math.max(8, Math.min(w - 8, ex)), Math.max(8, Math.min(h - 8, ey)), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flashing SKPD police car blips
    const flash = Math.sin(time * 14) > 0;
    for (const p of state.policeUnits) {
      if (p.wrecked) continue;
      const [ux, uy] = toScreen(p.x, p.z);
      const clX = Math.max(9, Math.min(w - 9, ux));
      const clY = Math.max(9, Math.min(h - 9, uy));
      ctx.fillStyle = flash ? '#ff2b4a' : '#2b95ff';
      ctx.beginPath();
      ctx.arc(clX, clY, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Air-One Helicopter blip with rotating cross
    if (state.airOne && state.airOne.active) {
      const [hx, hy] = toScreen(state.airOne.x, state.airOne.z);
      const clX = Math.max(12, Math.min(w - 12, hx));
      const clY = Math.max(12, Math.min(h - 12, hy));
      ctx.save();
      ctx.translate(clX, clY);
      ctx.rotate(time * 5);
      ctx.strokeStyle = flash ? '#38e8ff' : '#ff4b5c';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.restore();
    }

    // Golden Mission Waypoint blip (clamped to radar edge if far)
    if (state.waypointPos) {
      const [wx, wy] = toScreen(state.waypointPos.x, state.waypointPos.z);
      const clX = Math.max(10, Math.min(w - 10, wx));
      const clY = Math.max(10, Math.min(h - 10, wy));
      ctx.fillStyle = '#ffc145';
      ctx.beginPath();
      ctx.arc(clX, clY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1b1407';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Player Heading Chevron in center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-state.playerPos.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0d1522';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // North Compass badge
    ctx.fillStyle = 'rgba(10, 16, 28, 0.85)';
    ctx.fillRect(cx - 10, 4, 20, 14);
    ctx.fillStyle = '#38e8ff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 14);
  }
}
