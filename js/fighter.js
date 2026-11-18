'use strict';
/* ===== Pugile: stato fisico e animazione ===== */
let PUNCH_ID = 0;
const P_WIND = { jab: { lg: [0.14, -0.1] }, cross: { rg: [0.04, -0.12], lean: 0.02 }, hook: { lg: [0.02, -0.09], lean: -0.02 }, upper: { rg: [0.08, 0.1], by: 0.09, lean: 0.14 } };
const P_EXT = { jab: { lg: [0.56, -0.11], lean: 0.14 }, cross: { rg: [0.66, -0.1], lean: 0.3 }, hook: { lg: [0.4, -0.16], lean: 0.22 }, upper: { rg: [0.36, -0.3], lean: 0.04 } };
const P_BODY = { jab: { lg: [0.52, 0.17], by: 0.14, lean: 0.32 }, cross: { rg: [0.6, 0.19], by: 0.14, lean: 0.4 }, hook: { lg: [0.38, 0.2], by: 0.15, lean: 0.34 }, upper: { rg: [0.34, 0.0], by: 0.1, lean: 0.26 } };

class Fighter {
  constructor(def, side, opts = {}) {
    this.def = def;
    this.name = def.name; this.nick = def.nick || '';
    this.wc = WEIGHTS[def.wc || 'medi'];
    this.look = Object.assign({}, def.look);
    this.look.size = (def.look.size || 1) * this.wc.size;
    this.look.bulk = (def.look.bulk || 1) * this.wc.bulk;
    this.st = {};
    STAT_KEYS.forEach(k => this.st[k] = U.clamp((def.stats[k] || 50) + (opts.statBonus || 0), 5, 99));
    this.style = def.style || 'boxer';
    this.stance = def.stance || 'orto';
    this.side = side;
    this.x = side * 1.3; this.vx = 0;
    this.facing = -side;
    this.reach = this.wc.reach * (def.reach || 1);
    this.headMax = 100; this.head = 100;
    this.body = 100;
    const form = opts.form == null ? 1 : opts.form;
    this.stamMax = 78 + 22 * form; this.stam = this.stamMax;
    this.stun = 0; this.kd = 0; this.kdRound = 0;
    this.cut = 0; this.swell = 0;
    this.state = 'idle'; this.stateT = 0;
    this.punch = null; this.buffer = null; this.dodge = null;
    this.intent = { move: 0, down: false, guard: false };
    this.guarding = false; this.guardLow = false; this.breakT = 0;
    this.counterT = 0; this.combo = 0; this.comboT = 0;
    this.hitT = 0; this.hitKind = 'head'; this.hitPow = 0; this.flash = 0; this.blockT = 0;
    this.punish = 0; this.roundThrown = 0; this.clinchHold = 0;
    this.pose = Render.defaultPose();
    this.anim = Math.random() * 10; this.blinkT = 2 + Math.random() * 3;
    this.headgear = opts.headgear || null;
  }
  get stamR() { return this.stam / 100; }
  get wobbled() { return this.stun > 55; }
  get effSpd() { return this.st.spd * this.wc.spd; }
  get down() { return this.state === 'down' || this.state === 'rising' || this.state === 'standing' || this.state === 'ko'; }

  /* moltiplicatore dei tempi (>1 = più lento) */
  timeF() {
    let f = 1.3 - this.effSpd / 200;
    f *= 1 + (1 - this.stamR) * 0.42;
    if (this.wobbled) f *= 1.2;
    return f;
  }
  moveSpeed() {
    let v = 1.65 * (0.75 + this.effSpd / 200) * (0.62 + 0.38 * this.stamR);
    if (this.guarding) v *= 0.55;
    if (this.wobbled) v *= 0.6;
    return v;
  }

  requestPunch(type, target, sim) {
    if (!sim || sim.phase !== 'fight') return false;
    target = target || (this.intent.down ? 'body' : 'head');
    if (this.state === 'idle') { this.startPunch(type, target, false, sim); return true; }
    if (this.state === 'punch' && this.punch.phase !== 'wind' && !this.buffer) { this.buffer = { type, target }; return true; }
    if (this.state === 'dodge' && this.dodge.t > this.dodge.dur * 0.45 && !this.buffer) { this.buffer = { type, target }; return true; }
    return false;
  }
  startPunch(type, target, chained, sim) {
    const P = PUNCHES[type];
    const f = this.timeF() * (chained ? 0.86 : 1);
    this.punch = { type, target, phase: 'wind', t: 0, wind: P.wind * f, act: P.act * f, rec: P.rec * f, id: ++PUNCH_ID };
    this.state = 'punch'; this.stateT = 0; this.guarding = false;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 0.75;
    const cost = P.stam * (target === 'body' ? 1.1 : 1) * (1 + Math.max(0, this.combo - 2) * 0.12);
    this.stam = Math.max(0, this.stam - cost);
    this.roundThrown++;
    if (sim) sim.onThrow(this, type, target);
  }
  requestDodge(sim) {
    if (!sim || sim.phase !== 'fight') return false;
    if (!(this.state === 'idle' || (this.state === 'punch' && this.punch.phase === 'rec'))) return false;
    const away = this.intent.move * this.facing < -0.35;
    const type = this.intent.down ? 'duck' : away ? 'back' : 'slip';
    const f = this.timeF();
    this.dodge = { type, t: 0, dur: (type === 'back' ? 0.3 : 0.34) * f, rec: 0.16 * f };
    this.state = 'dodge'; this.stateT = 0; this.punch = null; this.buffer = null; this.guarding = false;
    this.stam = Math.max(0, this.stam - (type === 'back' ? 2.6 : 3.2));
    return true;
  }
  takeHit(kind, power) {
    this.hitKind = kind; this.hitPow = power; this.flash = 0.12;
    const s = this.state;
    const interrupt = s === 'idle' || s === 'dodge' || (s === 'punch' && this.punch.phase !== 'act');
    if (interrupt && power > 3.2) {
      this.state = 'hit'; this.stateT = 0;
      this.hitT = Math.min(0.42, 0.1 + power * 0.02);
      this.punch = null; this.buffer = null; this.dodge = null; this.guarding = false;
    }
    this.vx = -this.facing * (0.3 + power * 0.06);
  }
  blockHit(power) { this.vx = -this.facing * (0.25 + power * 0.05); this.blockT = 0.14; }
  guardBreak() {
    this.breakT = 0.8; this.guarding = false;
    this.state = 'hit'; this.stateT = 0; this.hitT = 0.38; this.hitKind = 'head'; this.hitPow = 3;
  }

  update(dt, opp, sim) {
    this.anim += dt; this.stateT += dt;
    if (this.counterT > 0) this.counterT -= dt;
    if (this.comboT > 0) this.comboT -= dt; else this.combo = 0;
    if (this.breakT > 0) this.breakT -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.blockT > 0) this.blockT -= dt;
    this.blinkT -= dt; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4;
    this.punish = Math.max(0, this.punish - 5 * dt);
    if (!this.down) {
      this.stun = Math.max(0, this.stun - (3.2 + this.st.chn / 22) * dt);
      this.head = Math.min(this.headMax, this.head + 0.16 * dt);
    }
    switch (this.state) {
      case 'idle': {
        this.guarding = this.intent.guard && this.breakT <= 0;
        this.guardLow = this.guarding && this.intent.down;
        const mv = U.clamp(this.intent.move, -1, 1);
        const back = mv * this.facing < 0 ? 0.82 : 1; // indietreggiare è più lento
        this.vx = U.damp(this.vx, mv * this.moveSpeed() * back, 14, dt);
        this.regen(dt);
        break;
      }
      case 'punch': {
        const p = this.punch;
        p.t += dt;
        let lunge = 0;
        if (p.phase === 'act' && (p.type === 'cross' || p.type === 'hook')) lunge = this.facing * 0.9;
        this.vx = U.damp(this.vx, lunge + U.clamp(this.intent.move, -1, 1) * (this.intent.move * this.facing > 0 ? 0.7 : 0.3), 12, dt);
        if (p.phase === 'wind' && p.t >= p.wind) { p.phase = 'act'; p.t = 0; sim.resolve(this, opp); }
        else if (p.phase === 'act' && p.t >= p.act) { p.phase = 'rec'; p.t = 0; }
        else if (p.phase === 'rec' && p.t >= p.rec) {
          if (this.buffer && sim.phase === 'fight') { const b = this.buffer; this.buffer = null; this.startPunch(b.type, b.target, true, sim); }
          else { this.state = 'idle'; this.punch = null; this.buffer = null; }
        }
        break;
      }
      case 'dodge': {
        const d = this.dodge; d.t += dt;
        if (d.type === 'back' && d.t < d.dur) this.vx = -this.facing * 2.7 * (0.75 + this.effSpd / 300);
        else this.vx = U.damp(this.vx, 0, 12, dt);
        if (d.t >= d.dur + d.rec) {
          this.dodge = null;
          if (this.buffer && sim.phase === 'fight') { const b = this.buffer; this.buffer = null; this.state = 'idle'; this.startPunch(b.type, b.target, true, sim); }
          else this.state = 'idle';
        }
        break;
      }
      case 'hit':
        this.vx = U.damp(this.vx, 0, 7, dt);
        if (this.stateT >= this.hitT) this.state = 'idle';
        break;
      case 'clinch':
        this.vx = 0;
        this.stam = Math.min(this.stamMax, this.stam + 6 * dt);
        break;
      default:
        this.vx = U.damp(this.vx, 0, 6, dt);
    }
  }
  regen(dt) {
    let r = 6.5 * (0.55 + this.st.sta / 110) * (0.4 + 0.6 * this.body / 100);
    if (this.guarding) r *= 0.62;
    if (Math.abs(this.vx) > 0.35) r *= 0.8;
    this.stam = Math.min(this.stamMax, this.stam + r * dt);
  }

  /* ===== Animazione ===== */
  targetPose() {
    const P = Render.defaultPose();
    const a = this.anim, tired = U.clamp(1 - this.stamR, 0, 1);
    const bounce = Math.sin(a * 7.5) * 0.018 * (1 - tired * 0.6);
    P.by = 0.05 + bounce + tired * 0.04;
    P.lean = 0.1 + tired * 0.1;
    P.lg = [0.2 + Math.sin(a * 3.1) * 0.02, -0.13 + Math.sin(a * 2.3) * 0.015 + tired * 0.12];
    P.rg = [0.13, -0.16 + Math.cos(a * 2.7) * 0.012 + tired * 0.1];
    if (Math.abs(this.vx) > 0.2 && (this.state === 'idle' || this.state === 'neutral')) {
      const ph = a * 12;
      P.flx = Math.sin(ph) * 0.06; P.fly = Math.max(0, Math.sin(ph)) * 0.05;
      P.frx = -Math.sin(ph) * 0.05; P.fry = Math.max(0, -Math.sin(ph)) * 0.05;
    }
    if (this.wobbled && !this.down) {
      P.hx += Math.sin(a * 5) * 0.035; P.lean += Math.sin(a * 3.3) * 0.1;
      P.lg[1] += 0.1; P.rg[1] += 0.08; P.st += 0.05;
    }
    switch (this.state) {
      case 'idle':
        if (this.guarding && !this.guardLow) { P.lg = [0.17, -0.23]; P.rg = [0.15, -0.25]; P.hy = 0.03; P.lean += 0.06; }
        else if (this.guarding) { P.lg = [0.21, 0.12]; P.rg = [0.16, 0.1]; P.by += 0.07; P.lean += 0.2; }
        else if (this.intent.down) { P.by += 0.08; P.lean += 0.12; }
        if (this.blockT > 0) { P.hx -= 0.03; P.lean -= 0.06; }
        break;
      case 'punch': {
        const p = this.punch, body = p.target === 'body';
        const base = Render.copyPose(P);
        const wind = Render.copyPose(Object.assign(Render.copyPose(P), P_WIND[p.type]));
        const ext = Render.copyPose(Object.assign(Render.copyPose(P), body ? P_BODY[p.type] : P_EXT[p.type]));
        if (body) Object.assign(wind, { by: (wind.by || P.by) + 0.06 });
        let from, to, k;
        if (p.phase === 'wind') { from = base; to = wind; k = U.easeIn(U.clamp(p.t / p.wind, 0, 1)); }
        else if (p.phase === 'act') { from = wind; to = ext; k = U.easeOut(U.clamp(p.t / p.act, 0, 1)); }
        else { from = ext; to = base; k = U.easeInOut(U.clamp(p.t / p.rec, 0, 1)); }
        Render.lerpPose(from, to, k);
        if (p.phase === 'act' && p.type !== 'jab') from.flx = 0.06;
        return from;
      }
      case 'dodge': {
        const d = this.dodge, e = Math.sin(Math.PI * U.clamp(d.t / d.dur, 0, 1));
        if (d.type === 'slip') { P.hx -= 0.07 * e; P.lean -= 0.22 * e; P.by += 0.06 * e; P.lg = [0.18, -0.18]; P.rg = [0.14, -0.2]; }
        else if (d.type === 'duck') { P.by += 0.32 * e; P.lean += 0.5 * e; P.lg = [0.2, -0.08]; P.rg = [0.14, -0.1]; }
        else { P.lean -= 0.18 * e; P.hx -= 0.04 * e; P.flx = -0.06 * e; }
        break;
      }
      case 'hit': {
        const k = Math.sin(Math.PI * U.clamp(this.stateT / this.hitT, 0, 1));
        const pw = U.clamp(this.hitPow / 8, 0.3, 1.3);
        if (this.hitKind === 'head') { P.hx -= 0.09 * pw * k; P.hy -= 0.02 * k; P.lean -= 0.22 * pw * k; P.lg[0] -= 0.06; P.rg[1] += 0.06 * k; }
        else { P.lean += 0.38 * pw * k; P.by += 0.1 * k; P.lg = [0.2, 0.12]; P.rg = [0.14, 0.14]; }
        break;
      }
      case 'clinch': P.lg = [0.36, -0.02]; P.rg = [0.32, 0.02]; P.lean = 0.36; P.by = 0.08; break;
      case 'down': case 'ko': {
        const k = U.easeOut(U.clamp(this.stateT / 0.55, 0, 1));
        P.rot = -1.42 * k; P.lg = [0.28, 0.12]; P.rg = [0.1, 0.24]; P.lean = 0.0; P.by = 0.0; P.st = 0.33; P.hy = 0.02;
        P.lift = -0.06 * k;
        if (this.state === 'down' && this.stateT > 1.5) { P.lg[1] += Math.sin(a * 3) * 0.04; }
        break;
      }
      case 'rising': {
        const k = U.easeInOut(U.clamp(this.stateT / 0.9, 0, 1));
        P.rot = -1.42 * (1 - k); P.by = 0.25 * Math.sin(Math.PI * k); P.lean = 0.4 * Math.sin(Math.PI * k);
        P.lg = [0.25, 0.1]; P.rg = [0.12, 0.15];
        break;
      }
      case 'standing': P.lg = [0.16, -0.05]; P.rg = [0.1, -0.06]; P.lean = 0.05; P.hx = Math.sin(a * 2) * 0.02; break;
      case 'neutral': P.lg = [0.12, 0.2]; P.rg = [0.04, 0.22]; P.lean = 0.0; break;
      case 'victory': { const b = Math.abs(Math.sin(a * 4)); P.lg = [0.05, -0.6 - b * 0.05]; P.rg = [-0.02, -0.62 - b * 0.05]; P.lean = -0.06; P.by = -b * 0.03; break; }
      case 'sad': P.lg = [0.1, 0.3]; P.rg = [0.04, 0.3]; P.lean = 0.25; P.hy = 0.03; break;
    }
    return P;
  }
  updatePose(dt) {
    const tgt = this.targetPose();
    const rate = (this.state === 'punch' || this.state === 'hit' || this.state === 'dodge') ? 34 : this.state === 'down' || this.state === 'ko' || this.state === 'rising' ? 60 : 13;
    Render.lerpPose(this.pose, tgt, 1 - Math.exp(-rate * dt));
  }
  renderData() {
    return {
      swell: this.swell, cut: this.cut, sweat: 1 - this.stamR, bodyDmg: 1 - this.body / 100,
      blink: this.blinkT < 0, headgear: this.headgear,
    };
  }
  draw(ctx, sx, gy, S) {
    return Render.drawAt(ctx, this.look, this.pose, sx, gy, S, this.facing, this.renderData());
  }
}
