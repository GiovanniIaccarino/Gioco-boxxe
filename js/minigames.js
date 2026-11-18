'use strict';
/* ===== Minigiochi di allenamento ===== */
const MINI_INFO = {
  bag: { title: 'SACCO PESANTE', instr: 'Ripeti le combinazioni che compaiono in alto. Le frecce ↓ indicano un colpo al corpo: tieni la levetta in basso. Velocità e precisione fanno punti.', dur: 30, target: 900 },
  rope: { title: 'SALTO DELLA CORDA', instr: 'Tocca SALTA quando la corda sta per passare sotto i piedi (zona verde). Il ritmo aumenta: non inciampare!', dur: 25, target: 34 },
  mitts: { title: 'COLPITORI', instr: 'Il maestro chiama il colpo: rispondi subito col pulsante giusto. Quando carica il braccio, premi SCHIVA prima che ti prenda!', dur: 30, target: 520 },
};

class MiniGame {
  /* opts: { kind, def, onEnd(score01, raw), title } */
  constructor(opts) {
    this.o = opts; this.kind = opts.kind; this.info = MINI_INFO[opts.kind];
    this.t = 0; this.stage = 'card'; this.time = this.info.dur; this.score = 0;
    this.stub = { phase: 'fight', onThrow: () => { }, resolve: (A) => this.onHit(A) };
    this.f = new Fighter(opts.def, -1, {});
    this.f.x = -0.55; this.f.facing = 1;
    this.dummyOpp = { x: 2 };
    this.parts = [];
    this.cam = { x: 0 };
    this.buildDom();
    this.init();
    Sound.startMusic('menu');
  }
  init() {
    if (this.kind === 'bag') { this.bag = { a: 0, w: 0 }; this.seq = []; this.si = 0; this.newCombo(); this.comboT = 0; }
    if (this.kind === 'rope') { this.ph = 0; this.speed = 0.9; this.air = 0; this.trip = 0; this.jumps = 0; this.streak = 0; this.best = 0; this.f.state = 'rope'; }
    if (this.kind === 'mitts') {
      this.coach = { look: Object.assign({}, CAST.sal.look, { hands: 'gloves', gloves: '#f2b705', trim: '#f2b705' }), pose: Render.defaultPose(), anim: 0 };
      this.call = null; this.gap = 1.0; this.hits = 0; this.fails = 0;
    }
  }
  layout(w, h) { return FightScene.prototype.layout.call(this, w, h); }
  buildDom() {
    const ui = UI.clear();
    this.wrap = U.el('div', { class: 'fight-ui mini' });
    this.hud = U.el('div', { class: 'mini-hud' },
      this.tEl = U.el('div', { class: 'mini-time' }, String(this.info.dur)),
      U.el('div', { class: 'mini-title' }, this.info.title),
      this.sEl = U.el('div', { class: 'mini-score' }, '0'));
    this.prompt = U.el('div', { class: 'mini-prompt' });
    this.big = U.el('div', { class: 'bigtext' });
    this.overlay = U.el('div', { class: 'f-overlay show' });
    this.wrap.append(this.hud, this.prompt, this.big, this.overlay);
    ui.appendChild(this.wrap);
    const card = U.el('div', { class: 'panel' },
      U.el('h2', null, this.info.title),
      U.el('p', { class: 'instr' }, this.info.instr),
      UI.btn('INIZIA', () => { this.overlay.classList.remove('show'); this.overlay.innerHTML = ''; this.stage = 'count'; this.t = 0; Sound.click(); }, 'primary'),
      this.o.onQuit ? UI.btn('Indietro', () => { this.destroy(); this.o.onQuit(); }) : null);
    this.overlay.appendChild(card);
    const opts = this.kind === 'rope' ? { stick: false, extra: [{ id: 'jump', label: 'SALTA', cls: 'p-jump' }] } :
      this.kind === 'bag' ? { stick: true, punches: true } : { stick: true, punches: true, dodge: true };
    Controls.mount(this.wrap, opts, {
      punch: (t) => this.onPunch(t), dodge: () => this.onDodge(),
      action: (id) => { if (id === 'jump' || id === 'space') this.onJump(); },
      pause: () => { },
    });
  }
  destroy() { Controls.unmount(); }
  bigText(t, cls, d = 0.8) { this.big.innerHTML = ''; this.big.appendChild(U.el('div', { class: 'big-in ' + (cls || '') }, U.el('div', { class: 'big-main' }, t))); this.bigT = d; }
  floatText(t, good) {
    const e = U.el('div', { class: 'toast ' + (good ? 'good' : 'bad') }, t);
    this.prompt.appendChild(e); setTimeout(() => e.remove(), 700);
  }

  update(dt) {
    this.t += dt;
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) this.big.innerHTML = ''; }
    if (this.stage === 'count') {
      const n = 3 - Math.floor(this.t);
      if (n !== this.lastN) { this.lastN = n; if (n > 0) { this.bigText(String(n), 'count'); Sound.tick(); } else { this.bigText('VIA!', 'box'); Sound.bell(1); this.stage = 'play'; this.t = 0; } }
    } else if (this.stage === 'play') {
      this.time -= dt;
      this.tEl.textContent = String(Math.max(0, Math.ceil(this.time)));
      if (this.time <= 0) this.finish();
    }
    const play = this.stage === 'play';
    this.f.intent.down = Controls.st.down;
    if (this.kind !== 'rope') this.f.update(dt, this.dummyOpp, this.stub);
    this.f.stam = Math.min(100, this.f.stam + 12 * dt);
    if (this.kind === 'bag') this.updBag(dt, play);
    if (this.kind === 'rope') this.updRope(dt, play);
    if (this.kind === 'mitts') this.updMitts(dt, play);
    if (this.kind !== 'rope') this.f.updatePose(dt);
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    this.sEl.textContent = this.kind === 'rope' ? `${this.jumps} salti` : String(Math.round(this.score));
  }
  finish() {
    this.stage = 'done';
    Sound.bell(2);
    const raw = this.kind === 'rope' ? this.jumps : this.score;
    const s01 = U.clamp(raw / this.info.target, 0, 1.4);
    const grade = s01 >= 1.15 ? 'S' : s01 >= 0.9 ? 'A' : s01 >= 0.65 ? 'B' : s01 >= 0.4 ? 'C' : 'D';
    const card = U.el('div', { class: 'panel' },
      U.el('h2', null, 'ALLENAMENTO FINITO'),
      U.el('div', { class: 'grade g-' + grade }, grade),
      U.el('p', null, this.kind === 'rope' ? `Salti: ${this.jumps} · Serie migliore: ${this.best}` : `Punteggio: ${Math.round(this.score)}`),
      this.o.extraResult ? this.o.extraResult(s01) : null,
      UI.btn('Continua', () => { this.destroy(); this.o.onEnd(s01, raw); }, 'primary'),
      this.o.onRetry ? UI.btn('Riprova', () => { this.destroy(); this.o.onRetry(); }) : null);
    this.overlay.innerHTML = ''; this.overlay.appendChild(card); this.overlay.classList.add('show');
  }

  /* ----- Sacco ----- */
  newCombo() {
    const len = U.randi(2, this.t > 10 || this.kind !== 'bag' ? 4 : 3);
    this.seq = [];
    for (let i = 0; i < len; i++) {
      const t = U.weighted(PUNCH_TYPES, p => p === 'jab' ? 1.5 : 1);
      const body = this.stage === 'play' && this.info && (this.info.dur - this.time) > 8 && Math.random() < 0.25;
      this.seq.push({ t, body });
    }
    this.si = 0; this.comboT = 0;
    this.renderSeq();
  }
  renderSeq() {
    this.prompt.querySelectorAll('.seq').forEach(e => e.remove());
    const row = U.el('div', { class: 'seq' });
    this.seq.forEach((p, i) => row.appendChild(U.el('span', { class: 'seq-i' + (i < this.si ? ' ok' : i === this.si ? ' cur' : '') }, PUNCHES[p.t].name.toUpperCase() + (p.body ? ' ↓' : ''))));
    this.prompt.prepend(row);
  }
  onPunch(t) {
    if (this.stage !== 'play') return;
    if (this.kind === 'bag') {
      const want = this.seq[this.si];
      const okBody = !!want.body === !!Controls.st.down;
      if (want.t === t && okBody) {
        this.f.intent.down = want.body;
        if (!this.f.requestPunch(t, want.body ? 'body' : 'head', this.stub)) return;
        this.si++;
        this.score += 10 + Math.max(0, 12 - this.comboT * 6);
        if (this.si >= this.seq.length) {
          this.score += 15 * this.seq.length; this.floatText('COMBO! +' + 15 * this.seq.length, true); Sound.good();
          setTimeout(() => { if (this.stage === 'play') this.newCombo(); }, 250);
        }
        this.renderSeq();
      } else {
        this.score = Math.max(0, this.score - 10); this.floatText(okBody ? 'SBAGLIATO' : (want.body ? 'AL CORPO! ↓' : 'ALLA TESTA!'), false); Sound.bad();
        this.si = 0; this.renderSeq();
      }
    } else if (this.kind === 'mitts') {
      if (!this.f.requestPunch(t, 'head', this.stub)) return;
      const c = this.call;
      if (c && c.kind === 'call' && !c.done) {
        if (c.t === t) {
          c.done = true; this.hits++;
          const pts = 15 + Math.max(0, (c.win - c.time)) * 30;
          this.score += pts; this.floatText('+' + Math.round(pts), true);
          this.pendingPop = true;
        } else { c.done = true; this.fails++; this.score = Math.max(0, this.score - 8); this.floatText('NO! ' + PUNCHES[c.t].name.toUpperCase(), false); Sound.bad(); }
      }
    }
  }
  onHit(A) {
    if (this.kind === 'bag') {
      const P = PUNCHES[A.punch.type];
      const pw = P.dmg / 9 * (0.6 + A.st.pow / 120);
      this.bag.w += pw * 2.2;
      Sound.punch(pw, A.punch.target === 'body');
      this.burst(0.25, A.punch.target === 'body' ? 1.05 : 1.45, pw);
      U.vibrate(10);
    } else if (this.kind === 'mitts') {
      Sound.punch(this.pendingPop ? 0.6 : 0.3);
      if (this.pendingPop) { this.burst(0.55, 1.45, 0.6); this.pendingPop = false; }
    }
  }
  burst(wx, h, pw) {
    const L = this.L; if (!L) return;
    const x = Game.w / 2 + (wx - this.cam.x) * L.S, y = L.gy - L.S * h;
    for (let i = 0; i < 6 + pw * 8; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 200; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 0.4, c: '#fff' }); }
  }
  updBag(dt, play) {
    const b = this.bag;
    b.w += (-b.a * 18 - b.w * 2.2) * dt; b.a += b.w * dt;
    if (play) this.comboT += dt;
  }

  /* ----- Corda ----- */
  onJump() {
    if (this.stage !== 'play' || this.kind !== 'rope') return;
    if (this.air <= 0 && this.trip <= 0) { this.air = 0.36; Sound.rope(); }
  }
  updRope(dt, play) {
    const prev = this.ph;
    if (this.trip > 0) { this.trip -= dt; }
    else if (play || this.stage === 'count') {
      this.speed = 0.85 + Math.min(0.8, (this.info.dur - this.time) * 0.028);
      if (play) this.ph += dt * this.speed * Math.PI * 2;
    }
    if (this.air > 0) this.air -= dt;
    // la corda passa sotto i piedi quando ph attraversa un multiplo dispari di PI
    const k0 = Math.floor((prev - Math.PI) / (2 * Math.PI)), k1 = Math.floor((this.ph - Math.PI) / (2 * Math.PI));
    if (play && k1 > k0) {
      if (this.air > 0) { this.jumps++; this.streak++; this.best = Math.max(this.best, this.streak); if (this.streak % 10 === 0) { this.floatText('SERIE x' + this.streak, true); Sound.good(); } }
      else { this.trip = 0.9; this.streak = 0; this.floatText('INCIAMPATO!', false); Sound.bad(); U.vibrate(40); }
    }
    // posa: salto
    const P = Render.defaultPose();
    const jumpH = this.air > 0 ? Math.sin(Math.PI * (1 - this.air / 0.36)) * 0.16 : 0;
    P.lift = jumpH; P.lg = [0.14, 0.4]; P.rg = [0.16, 0.38]; P.lean = 0.02; P.st = 0.12; P.by = this.air > 0 ? 0 : 0.04;
    if (this.trip > 0) { P.lean = 0.35; P.by = 0.12; P.lg = [0.3, 0.2]; }
    Render.lerpPose(this.f.pose, P, 1 - Math.exp(-20 * dt));
  }

  /* ----- Colpitori ----- */
  onDodge() {
    if (this.stage !== 'play' || this.kind !== 'mitts') return;
    this.f.intent.move = Controls.st.move; this.f.intent.down = Controls.st.down;
    this.f.requestDodge(this.stub);
    const c = this.call;
    if (c && c.kind === 'swing' && !c.done) {
      if (c.time < c.win) { c.done = true; this.hits++; const pts = 25; this.score += pts; this.floatText('SCHIVATA! +' + pts, true); Sound.whoosh(); }
    } else if (c && c.kind === 'call' && !c.done) { /* schivata inutile */ }
  }
  updMitts(dt, play) {
    const C = this.coach; C.anim += dt;
    const P = Render.defaultPose(); P.lg = [0.22, -0.14]; P.rg = [0.14, -0.16];
    if (play) {
      if (!this.call) {
        this.gap -= dt;
        if (this.gap <= 0) {
          const elapsed = this.info.dur - this.time;
          const win = U.clamp(1.15 - elapsed * 0.018, 0.55, 1.15);
          if (Math.random() < 0.28 && elapsed > 3) { this.call = { kind: 'swing', time: 0, win: 0.62 - Math.min(0.15, elapsed * 0.006), done: false }; this.bigText('ATTENTO!', 'kd', 0.5); }
          else { const t = U.pick(PUNCH_TYPES); this.call = { kind: 'call', t, time: 0, win, done: false }; this.bigText(PUNCHES[t].name.toUpperCase() + '!', 'round', win); Sound.tick(); }
        }
      } else {
        const c = this.call; c.time += dt;
        if (c.kind === 'call') {
          if (c.t === 'jab' || c.t === 'cross') P.lg = [0.28, -0.12];
          if (c.t === 'hook') P.lg = [0.12, -0.1];
          if (c.t === 'upper') P.lg = [0.28, 0.05];
          if (!c.done && c.time > c.win) { c.done = true; this.fails++; this.floatText('TROPPO LENTO', false); Sound.bad(); }
          if (c.done && c.time > Math.min(c.win, c.time) + 0.0) { this.call = null; this.gap = U.rand(0.25, 0.6); }
        } else {
          const k = U.clamp(c.time / c.win, 0, 1);
          P.rg = k < 1 ? [U.lerp(0.0, 0.1, k), -0.12] : [0.6, -0.12]; P.lean = k < 1 ? -0.05 : 0.3;
          if (c.time >= c.win && !c.done) {
            c.done = true; this.fails++;
            if (this.f.state === 'dodge') { this.hits++; this.fails--; this.score += 20; this.floatText('SCHIVATA! +20', true); }
            else { this.floatText('COLPITO!', false); Sound.punch(0.5); this.f.takeHit('head', 4); U.vibrate(40); this.score = Math.max(0, this.score - 10); }
          }
          if (c.time > c.win + 0.35) { this.call = null; this.gap = U.rand(0.3, 0.7); }
        }
      }
    }
    Render.lerpPose(C.pose, P, 1 - Math.exp(-18 * dt));
  }

  render(ctx, w, h) {
    const L = this.L = this.layout(w, h);
    const S = L.S, gy = L.gy;
    Render.venueBack(ctx, 'gymfloor', w, h, gy, S, this.cam.x, this.t, 0.2);
    const sx = (wx) => w / 2 + (wx - this.cam.x) * S;
    if (this.kind === 'bag') {
      const b = this.bag, px = sx(0.45), py = gy - S * 2.6;
      const len = S * 1.15;
      const bx = px + Math.sin(b.a) * len * 0.9, by = py + Math.cos(b.a) * len * 0.9;
      ctx.strokeStyle = '#777'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, py); ctx.lineTo(bx, by - S * 0.05); ctx.stroke();
      ctx.save(); ctx.translate(bx, by); ctx.rotate(-b.a);
      const g = ctx.createLinearGradient(-S * 0.22, 0, S * 0.22, 0);
      g.addColorStop(0, '#5a1414'); g.addColorStop(0.5, '#9b2222'); g.addColorStop(1, '#4a1010');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-S * 0.22, 0, S * 0.44, S * 1.15, S * 0.12) : ctx.rect(-S * 0.22, 0, S * 0.44, S * 1.15); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(-S * 0.22, S * 0.12, S * 0.44, S * 0.05); ctx.fillRect(-S * 0.22, S * 0.98, S * 0.44, S * 0.05);
      ctx.fillStyle = '#f2b705'; ctx.font = `bold ${S * 0.16}px "Bebas Neue", Impact`; ctx.textAlign = 'center'; ctx.save(); ctx.rotate(Math.PI / 2); ctx.fillText('BOXXE', S * 0.58, S * 0.05); ctx.restore();
      ctx.restore();
      this.f.draw(ctx, sx(this.f.x), gy, S);
    } else if (this.kind === 'rope') {
      const fx = sx(0), f = this.f, sz = f.look.size;
      const ph = this.ph;
      const front = Math.sin(ph) > 0;
      f.facing = 1;
      const hs = this.handsCache || { gL: { x: 0.15, y: -1.0 }, gR: { x: 0.1, y: -1.0 } };
      const toS = (pt) => ({ x: fx + pt.x * S * sz, y: gy + (pt.y - f.pose.lift) * S * sz });
      const hl = toS(hs.gL), hr = toS(hs.gR);
      const midY = (hl.y + hr.y) / 2;
      const ropeY = midY - S * sz * 0.05 - Math.cos(ph) * S * sz * 1.05 + S * sz * 0.1;
      const bulge = (front ? 1 : -1) * Math.abs(Math.sin(ph)) * S * 0.45;
      const drawRope = () => { ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(hl.x, hl.y); ctx.bezierCurveTo(hl.x + bulge, ropeY, hr.x + bulge, ropeY, hr.x, hr.y); ctx.stroke(); };
      if (!front) drawRope();
      const out = f.draw(ctx, fx, gy, S);
      if (out) this.handsCache = out;
      if (front) drawRope();
      // indicatore di ritmo
      const cx = w / 2, cy = L.portrait ? gy - S * 2.35 : gy - S * 2.2, r = S * 0.32;
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#22c55e'; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.5 - 0.95, Math.PI * 0.5 - 0.15); ctx.stroke();
      const a = ph - Math.PI / 2; // in basso quando la corda è sotto i piedi
      ctx.fillStyle = this.trip > 0 ? '#ef4444' : '#f2b705';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 9, 0, 7); ctx.fill();
    } else {
      const C = this.coach;
      Render.drawAt(ctx, C.look, C.pose, sx(0.45), gy, S, -1, {});
      this.f.draw(ctx, sx(this.f.x), gy, S);
    }
    for (const p of this.parts) { ctx.globalAlpha = U.clamp(p.life / 0.4, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    Render.vignette(ctx, w, h, 0.5);
  }
}
