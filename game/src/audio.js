// Procedural Web Audio API sound effects (engine, drift, sirens, weapons, explosions) and 3 radio stations.

import { RADIO_STATIONS } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.stationIndex = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioStep = 0;
    this.radioTimer = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();

      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  getStation() {
    return RADIO_STATIONS[this.stationIndex];
  }

  cycleRadio() {
    this.stationIndex = (this.stationIndex + 1) % RADIO_STATIONS.length;
    this.playChime(false);
    return this.getStation();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.engineGain && this.sirenGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  update(time, dt, { inVehicle, speed, drifting, wantedLevel }) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Engine hum pitch scales with speed
    if (this.engineOsc && this.engineGain) {
      const targetVol = inVehicle ? 0.045 + Math.min(0.04, speed * 0.0012) : 0;
      const targetFreq = 48 + speed * 3.1 + (drifting ? 18 : 0);
      this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
    }

    // SKPD wailing siren at 1+ wanted stars
    if (this.sirenOsc && this.sirenGain) {
      const sirenVol = wantedLevel > 0 ? 0.025 + wantedLevel * 0.005 : 0;
      const wail = 660 + Math.sin(time * 5.2) * 230;
      this.sirenGain.gain.setTargetAtTime(sirenVol, now, 0.12);
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.05);
    }

    // Subtle procedural radio synth groove while driving
    if (inVehicle) {
      const st = this.getStation();
      const beatSec = 60 / st.bpm / 2;
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) {
        this.radioTimer = beatSec;
        this.playRadioPulse(st.id, this.radioStep++);
      }
    }
  }

  playRadioPulse(stationId, step) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (stationId === 'sunset') {
      const notes = [110, 110, 146.8, 130.8, 164.8, 146.8, 130.8, 98];
      osc.type = 'sawtooth';
      osc.frequency.value = notes[step % notes.length];
      gain.gain.setValueAtTime(0.024, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    } else if (stationId === 'coral') {
      const notes = [130.8, 196, 155.6, 196, 174.6, 155.6, 130.8, 116.5];
      osc.type = 'triangle';
      osc.frequency.value = notes[step % notes.length];
      gain.gain.setValueAtTime(0.032, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else {
      // SKPD dispatch scanner chirp every 8 beats
      if (step % 8 !== 0) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.setValueAtTime(860, now + 0.06);
      gain.gain.setValueAtTime(0.022, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    }
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playGunshot(rapid = false) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.09), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (rapid ? 420 : 680));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = rapid ? 1400 : 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
  }

  playPunch() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playRocket() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.34);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  playExplosion() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.55), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 3600);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
  }

  playChime(major = true) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = major ? [523.25, 659.25, 783.99] : [587.33, 880];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.08, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.26);
    });
  }
}
