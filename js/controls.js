'use strict';
/* ===== Comandi touch (levetta + pulsanti) e tastiera ===== */
const Controls = {
  root: null, st: { move: 0, down: false, up: false, guard: false },
  handlers: {}, stickId: null, keys: {}, kbBound: false,

  /* opts: { stick, punches, guard, dodge, extra:[{id,label}] }, handlers: { punch(type), dodge(), action(id), pause() } */
  mount(parent, opts, handlers) {
    this.unmount();
    this.handlers = handlers || {};
    this.st = { move: 0, down: false, up: false, guard: false };
    const root = U.el('div', { class: 'ctrl', style: { '--cs': Save.settings.ctrlSize } });
    if (opts.stick) {
      const zone = U.el('div', { class: 'stick-zone' });
      const base = U.el('div', { class: 'stick-base' }, U.el('div', { class: 'stick-knob' }), U.el('span', { class: 'stick-hint' }, 'MUOVI'));
      zone.appendChild(base);
      root.appendChild(zone);
      this.bindStick(zone, base);
    } else root.appendChild(U.el('div', { class: 'stick-zone empty' }));
    const pad = U.el('div', { class: 'pad' });
    if (opts.punches) {
      const mk = (t, label, cls) => {
        const b = U.el('button', { class: 'pbtn ' + cls, 'data-k': t }, U.el('span', null, label));
        this.press(b, () => { if (this.handlers.punch) this.handlers.punch(t); });
        return b;
      };
      pad.appendChild(mk('hook', 'GANCIO', 'p-hook'));
      pad.appendChild(mk('upper', 'MONTANTE', 'p-upper'));
      pad.appendChild(mk('jab', 'JAB', 'p-jab'));
      pad.appendChild(mk('cross', 'DIRETTO', 'p-cross'));
    }
    if (opts.guard) {
      const g = U.el('button', { class: 'pbtn p-guard' }, U.el('span', null, 'GUARDIA'));
      this.hold(g, (on) => { this.st.guard = on; });
      pad.appendChild(g);
    }
    if (opts.dodge) {
      const d = U.el('button', { class: 'pbtn p-dodge' }, U.el('span', null, 'SCHIVA'));
      this.press(d, () => { if (this.handlers.dodge) this.handlers.dodge(); });
      pad.appendChild(d);
    }
    for (const x of (opts.extra || [])) {
      const b = U.el('button', { class: 'pbtn p-extra ' + (x.cls || '') }, U.el('span', null, x.label));
      this.press(b, () => { if (this.handlers.action) this.handlers.action(x.id); });
      pad.appendChild(b);
    }
    if (!opts.punches && !opts.guard) pad.classList.add('pad-simple');
    root.appendChild(pad);
    parent.appendChild(root);
    this.root = root;
    this.bindKeys();
    return root;
  },
  unmount() {
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null; this.handlers = {};
    this.st = { move: 0, down: false, up: false, guard: false };
    this.keys = {};
  },
  press(btn, fn) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); btn.classList.add('on'); fn(); U.vibrate(8);
      try { btn.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    });
    const off = () => btn.classList.remove('on');
    btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('lostpointercapture', off);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  },
  hold(btn, fn) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); btn.classList.add('on'); fn(true);
      try { btn.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    });
    const off = () => { btn.classList.remove('on'); fn(false); };
    btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('lostpointercapture', off);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  },
  bindStick(zone, base) {
    const knob = base.querySelector('.stick-knob');
    let cx = 0, cy = 0;
    const R = () => base.offsetWidth * 0.42;
    const upd = (x, y) => {
      let dx = x - cx, dy = y - cy;
      const r = R(), d = Math.hypot(dx, dy);
      if (d > r) { dx *= r / d; dy *= r / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const nx = dx / r, ny = dy / r;
      this.st.move = Math.abs(nx) < 0.22 ? 0 : U.clamp((nx - Math.sign(nx) * 0.22) / 0.78, -1, 1);
      this.st.down = ny > 0.45;
      this.st.up = ny < -0.55;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      const zr = zone.getBoundingClientRect();
      const bw = base.offsetWidth;
      const lx = U.clamp(e.clientX - zr.left, bw / 2, zr.width - bw / 2);
      const ly = U.clamp(e.clientY - zr.top, bw / 2, zr.height - bw / 2);
      base.style.left = lx + 'px'; base.style.top = ly + 'px'; base.classList.add('active');
      cx = zr.left + lx; cy = zr.top + ly;
      upd(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) upd(e.clientX, e.clientY); });
    const end = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      knob.style.transform = ''; base.classList.remove('active'); base.style.left = ''; base.style.top = '';
      this.st.move = 0; this.st.down = false; this.st.up = false;
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  },
  bindKeys() {
    if (this.kbBound) return;
    this.kbBound = true;
    const map = { j: 'jab', k: 'cross', u: 'hook', i: 'upper' };
    window.addEventListener('keydown', (e) => {
      if (!this.root) return;
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      this.keys[k] = true;
      if (map[k] && this.handlers.punch) this.handlers.punch(map[k]);
      if ((k === 'l' || k === 'shift') && this.handlers.dodge) this.handlers.dodge();
      if (k === ' ' && this.handlers.action) this.handlers.action('space');
      if ((k === 'escape' || k === 'p') && this.handlers.pause) this.handlers.pause();
      if (k === 'enter' && this.handlers.action) this.handlers.action('enter');
      this.kbUpdate();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; this.kbUpdate(); });
  },
  kbUpdate() {
    const K = this.keys;
    if (this.stickId !== null) return;
    const l = K.a || K.arrowleft, r = K.d || K.arrowright;
    this.st.move = (r ? 1 : 0) - (l ? 1 : 0);
    this.st.down = !!(K.s || K.arrowdown);
    this.st.up = !!(K.w || K.arrowup);
    this.st.kbGuard = !!K[' '];
  },
  get guard() { return this.st.guard || !!this.st.kbGuard; },
};
