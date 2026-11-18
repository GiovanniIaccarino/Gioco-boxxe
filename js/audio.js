'use strict';
/* Audio interamente sintetizzato con WebAudio: nessun file esterno */
const Sound = {
  ctx: null, master: null, sfx: null, mus: null, noiseBuf: null,
  crowdGain: null, crowdLevel: 0, musicTimer: null, musicStep: 0, musicNext: 0, musicKind: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.connect(this.master);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  },
  applyVolumes() {
    if (!this.ctx) return;
    const s = Save.settings;
    this.sfx.gain.value = s.sfx;
    this.mus.gain.value = s.music * 0.55;
  },
  get t() { return this.ctx ? this.ctx.currentTime : 0; },

  env(g, when, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + a + dec);
  },
  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, freq, q = 1, vol = 0.3, type = 'lowpass', when = 0, sweepTo = null, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); this.env(g, t, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },

  punch(power = 0.5, body = false) {
    const p = U.clamp(power, 0, 1);
    this.tone(body ? 95 : 140, 0.12 + p * 0.1, 'sine', 0.5 + p * 0.4, 38);
    this.noise(0.06 + p * 0.06, body ? 700 : 1400, 0.7, 0.45 + p * 0.3, 'lowpass');
    if (p > 0.55) this.noise(0.05, 2600, 1.2, 0.25 * p, 'bandpass');
  },
  block() {
    this.noise(0.05, 900, 2, 0.32, 'bandpass');
    this.tone(260, 0.06, 'triangle', 0.15, 180);
  },
  whoosh() { this.noise(0.16, 400, 1.5, 0.14, 'bandpass', 0, 1800); },
  thud() {
    this.tone(70, 0.45, 'sine', 0.7, 30);
    this.noise(0.35, 300, 0.7, 0.5, 'lowpass');
  },
  bell(n = 1) {
    if (!this.ctx) return;
    for (let k = 0; k < n; k++) {
      const w = k * 0.38;
      [[620, 0.28], [1240, 0.12], [1710, 0.1], [2380, 0.05], [3120, 0.03]].forEach(([f, v]) =>
        this.tone(f, 1.4, 'sine', v, null, w));
    }
  },
  click() { this.tone(520, 0.05, 'triangle', 0.18, 760); },
  back() { this.tone(500, 0.06, 'triangle', 0.15, 300); },
  tick() { this.tone(1500 + Math.random() * 300, 0.012, 'square', 0.025); },
  good() { this.tone(660, 0.09, 'triangle', 0.2); this.tone(990, 0.14, 'triangle', 0.18, null, 0.07); },
  bad() { this.tone(220, 0.2, 'sawtooth', 0.1, 140); },
  rope() { this.noise(0.08, 2000, 1, 0.12, 'highpass'); },
  stamp() { this.tone(90, 0.3, 'sine', 0.6, 40); this.noise(0.2, 500, 0.6, 0.35); },
  cheer(v = 0.5) { this.noise(1.6, 1100, 0.5, 0.18 * v, 'bandpass', 0, 700); },

  /* Folla: rumore filtrato in loop con livello variabile */
  startCrowd() {
    if (!this.ctx || this.crowdGain) return;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.6;
    const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1800;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(f2); f2.connect(g); g.connect(this.sfx);
    s.start();
    this.crowdSrc = s; this.crowdGain = g;
  },
  setCrowd(level) {
    if (!this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(U.clamp(level, 0, 1) * 0.22, this.ctx.currentTime, 0.3);
  },
  stopCrowd() {
    if (!this.crowdGain) return;
    try { this.crowdSrc.stop(); } catch (e) { /* */ }
    this.crowdGain.disconnect(); this.crowdGain = null; this.crowdSrc = null;
  },

  /* Musica procedurale (boom-bap minore) */
  startMusic(kind = 'menu') {
    if (!this.ctx) return;
    if (this.musicKind === kind && this.musicTimer) return;
    this.stopMusic();
    this.musicKind = kind;
    this.musicStep = 0;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 40);
  },
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null; this.musicKind = null;
  },
  schedule() {
    const c = this.ctx; if (!c) return;
    const bpm = this.musicKind === 'story' ? 76 : 88;
    const st = 60 / bpm / 4;
    const roots = this.musicKind === 'story' ? [57, 53, 48, 55] : [45, 41, 48, 43];
    while (this.musicNext < c.currentTime + 0.2) {
      const i = this.musicStep % 16, bar = Math.floor(this.musicStep / 16) % 4;
      const when = this.musicNext - c.currentTime + (i % 2 ? st * 0.12 : 0);
      const root = roots[bar];
      const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
      if (this.musicKind !== 'story') {
        if (i === 0 || i === 7 || i === 10) this.tone(110, 0.22, 'sine', 0.55, 42, when, this.mus);
        if (i === 4 || i === 12) this.noise(0.14, 1800, 0.8, 0.28, 'bandpass', when, null, this.mus);
        if (i % 2 === 0) this.noise(0.03, 8000, 1, i % 4 === 2 ? 0.07 : 0.04, 'highpass', when, null, this.mus);
        if (i === 0 || i === 7 || i === 10 || i === 14) this.tone(hz(root - 12), st * 2.5, 'triangle', 0.22, null, when, this.mus);
      }
      if (i === 0) {
        [0, 3, 7].forEach(o => this.tone(hz(root + 12 + o), st * 15, 'sine', this.musicKind === 'story' ? 0.06 : 0.035, null, when, this.mus));
      }
      if (this.musicKind === 'story' && (i === 0 || i === 6 || i === 10)) {
        const notes = [0, 3, 7, 10, 12];
        this.tone(hz(root + 12 + notes[(this.musicStep * 7 + bar) % 5]), st * 3, 'triangle', 0.05, null, when, this.mus);
      }
      this.musicNext += st;
      this.musicStep++;
    }
  },
};
