'use strict';
/* ===== Avvio e ciclo principale ===== */
const Game = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1, scene: null, last: 0,
  init() {
    Save.load();
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.scene && this.scene.pause) this.scene.pause(); if (Sound.ctx) Sound.ctx.suspend(); }
      else if (Sound.ctx) Sound.ctx.resume();
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    UI.start();
    requestAnimationFrame((t) => this.loop(t));
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    document.documentElement.classList.toggle('portrait', this.h > this.w * 1.05);
  },
  setScene(s) {
    // le scene con risorse (comandi, folla) si chiudono da sole prima del cambio
    this.scene = s;
  },
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
    this.last = t;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    try {
      if (this.scene) { this.scene.update(dt); this.scene.render(ctx, this.w, this.h); }
    } catch (e) { console.error(e); }
    requestAnimationFrame((tt) => this.loop(tt));
  },
  fullscreen(auto) {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement && el.requestFullscreen && (!auto || /Android/i.test(navigator.userAgent))) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => { });
    } catch (e) { /* */ }
  },
};
window.addEventListener('load', () => Game.init());
