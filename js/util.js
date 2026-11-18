'use strict';
/* Utility condivise */
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  sign: (v) => (v < 0 ? -1 : v > 0 ? 1 : 0),
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeOut3: (t) => 1 - Math.pow(1 - t, 3),
  easeIn: (t) => t * t,
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  damp: (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt),

  seeded(seed) {
    let s = (seed >>> 0) || 123456789;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  },
  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  weighted(items, wfn) {
    let tot = 0;
    for (const it of items) tot += Math.max(0, wfn(it));
    let r = Math.random() * tot;
    for (const it of items) { r -= Math.max(0, wfn(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  },

  hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgb(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; },
  /* schiarisce (amt>0) o scurisce (amt<0) un colore esadecimale */
  shade(hex, amt) {
    const [r, g, b] = U.hexToRgb(hex);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return U.rgb(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
  },
  alpha(hex, a) { const [r, g, b] = U.hexToRgb(hex); return U.rgb(r, g, b, a); },

  fmtClock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  },
  fmtMoney(v) { return '€ ' + Math.round(v).toLocaleString('it-IT'); },

  /* creazione elementi DOM: el('div', {class:'x', onclick:fn}, 'testo', child) */
  el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k === 'html') e.innerHTML = v;
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    }
    return e;
  },
  vibrate(ms) {
    try { if (Save.settings.vibration && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignora */ }
  },
};
