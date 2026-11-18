'use strict';
/* ===== Simulazione del match (logica pura, nessun rendering) ===== */
const JUDGES = [
  { name: 'G. Bianchi', w: { pow: 1.0, cnt: 1.1, agg: 0.12, def: 0.3 } },
  { name: 'R. Hoffman', w: { pow: 0.65, cnt: 2.0, agg: 0.35, def: 0.1 } },
  { name: 'L. Moreau', w: { pow: 0.85, cnt: 1.3, agg: 0.05, def: 0.6 } },
];

function newRoundStats() {
  return { thrown: 0, landed: 0, power: 0, head: 0, body: 0, blocked: 0, evaded: 0, aggr: 0, kd: 0, taken: 0,
    by: { jab: { t: 0, l: 0 }, cross: { t: 0, l: 0 }, hook: { t: 0, l: 0 }, upper: { t: 0, l: 0 } }, counters: 0 };
}

class FightSim {
  /* cfg: { a, b (def), rounds, roundTime, kdRule, ring, spar, street, attract, dmgScale, aOpts, bOpts } */
  constructor(cfg) {
    this.cfg = Object.assign({ rounds: 3, roundTime: 90, kdRule: 3, ring: true, dmgScale: 1 }, cfg);
    this.a = new Fighter(cfg.a, -1, cfg.aOpts || {});
    this.b = new Fighter(cfg.b, 1, cfg.bOpts || {});
    this.a.x = -1.25; this.b.x = 1.25;
    this.round = 1; this.clock = 0;
    this.phase = 'fight';
    this.events = [];
    this.rs = [{ a: newRoundStats(), b: newRoundStats() }];
    this.cards = JUDGES.map(j => ({ name: j.name, rounds: [] }));
    this.kdInfo = null; this.result = null;
    this.lim = this.cfg.ring ? 2.72 : 3.4;
    this.protectB = false; this.totalT = 0;
  }
  get cur() { return this.rs[this.round - 1]; }
  sideOf(f) { return f === this.a ? 'a' : 'b'; }
  other(f) { return f === this.a ? this.b : this.a; }
  emit(type, data) { this.events.push(Object.assign({ type }, data)); }
  onRopes(f) { return f.side < 0 ? f.x < -this.lim + 0.22 : f.x > this.lim - 0.22; }
  dist() { return this.b.x - this.a.x; }

  onThrow(f, type, target) {
    const r = this.cur[this.sideOf(f)];
    r.thrown++; r.by[type].t++;
    this.emit('throw', { f, type, target });
  }

  step(dt) {
    this.totalT += dt;
    const A = this.a, B = this.b;
    if (this.phase === 'fight') {
      A.update(dt, B, this); B.update(dt, A, this);
      this.clinchCheck(dt);
      this.integrate(dt);
      this.trackAggression(dt);
      if (this.protectB) { B.head = Math.max(B.head, 14); B.stun = Math.min(B.stun, 85); B.body = Math.max(B.body, 20); }
      this.clock += dt;
      if (this.clock >= this.cfg.roundTime && !this.cfg.attract) this.endRound();
    } else if (this.phase === 'kd') {
      this.updateKD(dt);
      A.update(dt, B, this); B.update(dt, A, this);
      this.integrate(dt);
    } else if (this.phase === 'clinch') {
      this.clinchT -= dt;
      A.update(dt, B, this); B.update(dt, A, this);
      if (this.clinchT <= 0) {
        A.state = 'idle'; B.state = 'idle';
        A.vx = -2.2; B.vx = 2.2;
        this.phase = 'fight';
        this.emit('break', {});
      }
      this.integrate(dt);
    } else {
      A.update(dt, B, this); B.update(dt, A, this);
      this.integrate(dt);
    }
    A.updatePose(dt); B.updatePose(dt);
  }

  integrate(dt) {
    const A = this.a, B = this.b, lim = this.lim;
    A.x += A.vx * dt; B.x += B.vx * dt;
    A.x = U.clamp(A.x, -lim, lim); B.x = U.clamp(B.x, -lim, lim);
    const minD = (this.phase === 'clinch') ? 0.45 : 0.56;
    if (B.x - A.x < minD) {
      const over = minD - (B.x - A.x);
      // chi spinge di più guadagna terreno
      const pa = Math.max(0, A.vx), pb = Math.max(0, -B.vx);
      const tot = pa + pb + 0.001;
      let sa = over * (0.5 + 0.5 * (pb - pa) / tot), sb = over - sa;
      A.x -= sa; B.x += sb;
      if (A.x < -lim) { B.x += -lim - A.x; A.x = -lim; }
      if (B.x > lim) { A.x -= B.x - lim; B.x = lim; }
    }
  }
  trackAggression(dt) {
    const d = this.dist();
    for (const f of [this.a, this.b]) {
      const r = this.cur[this.sideOf(f)];
      if ((f.vx * f.facing > 0.25 && d < 1.8) || (d < 1.0 && f.state === 'punch')) r.aggr += dt;
      if (Math.abs(f.x) < Math.abs(this.other(f).x) - 0.3) r.aggr += dt * 0.25; // controllo del centro
    }
  }
  clinchCheck(dt) {
    const d = this.dist();
    for (const f of [this.a, this.b]) {
      if (f.state === 'idle' && f.intent.guard && f.intent.move * f.facing > 0.5 && d < 0.7) {
        f.clinchHold += dt;
        if (f.clinchHold > 0.35) { this.startClinch(f); return; }
      } else f.clinchHold = 0;
    }
  }
  startClinch(f) {
    const o = this.other(f);
    if (o.down) return;
    this.phase = 'clinch'; this.clinchT = 1.3;
    f.state = 'clinch'; o.state = 'clinch'; f.punch = o.punch = null; f.buffer = o.buffer = null;
    f.clinchHold = 0;
    f.stun = Math.max(0, f.stun - 22);
    this.emit('clinch', { f });
  }

  /* ===== Risoluzione colpo ===== */
  resolve(A, D) {
    if (this.phase !== 'fight') return;
    const p = A.punch, P = PUNCHES[p.type];
    const rA = this.cur[this.sideOf(A)], rD = this.cur[this.sideOf(D)];
    const dist = Math.abs(A.x - D.x);
    const body = p.target === 'body';
    const range = P.range * A.reach - (body ? 0.04 : 0);
    if (dist > range || D.down) {
      A.stam = Math.max(0, A.stam - P.stam * 0.5);
      this.emit('miss', { att: A, def: D, punch: p, reason: 'range' });
      return;
    }
    let duckMult = 1;
    // schivata
    if (D.state === 'dodge') {
      const d = D.dodge;
      const ev = DODGE_TABLE[d.type][body ? 'body' : p.type];
      const perfect = d.t < 0.17;
      const chance = ev * (0.72 + D.st.def / 380 + (perfect ? 0.18 : 0));
      if (Math.random() < chance) {
        D.counterT = perfect ? 0.8 : 0.45;
        rD.evaded++;
        A.stam = Math.max(0, A.stam - P.stam * 0.55);
        this.emit('evade', { att: A, def: D, punch: p, perfect, kind: d.type });
        return;
      }
      if (d.type === 'duck' && p.type === 'upper') duckMult = 1.35;
    }
    // precisione
    let acc = P.acc + (A.st.tec - 50) / 250 + (A.effSpd - D.effSpd) / 420 - (D.st.def - 50) / 270;
    acc *= 0.7 + 0.3 * A.stamR;
    acc += -A.swell * 0.12 + D.swell * 0.08;
    const dPunching = D.state === 'punch' && D.punch.phase !== 'rec';
    const counter = dPunching || A.counterT > 0;
    if (counter) acc += 0.2;
    if (D.wobbled) acc += 0.18;
    if (D.state === 'hit') acc += 0.14;
    if (D.state === 'idle' && !D.guarding) acc -= (D.st.def / 100) * 0.1 * (0.5 + D.stamR * 0.5);
    if (Math.abs(D.x) > this.lim - 0.18) acc += 0.07; // alle corde
    if (A.stance !== D.stance) { if (p.type === 'cross') acc += 0.05; if (p.type === 'jab') acc -= 0.04; }
    if (A.combo >= 3) acc -= 0.04 * (A.combo - 2);
    acc = U.clamp(acc, 0.12, 0.97);
    if (Math.random() > acc) {
      A.stam = Math.max(0, A.stam - P.stam * 0.4);
      rD.evaded += 0.5;
      this.emit('miss', { att: A, def: D, punch: p, reason: 'evaded' });
      return;
    }
    // guardia
    let block = 0;
    if (D.guarding) {
      if (!D.guardLow && !body) block = BLOCK_HIGH[p.type];
      else if (D.guardLow && body) block = 0.86;
      else if (!D.guardLow && body) block = 0.12;
      if (block > 0.3) {
        D.stam = Math.max(0, D.stam - P.dmg * 0.5 * block * (1.3 - D.st.sta / 200));
        if (D.stam < 6) { block *= 0.35; D.guardBreak(); this.emit('guardbreak', { f: D }); }
      }
    }
    // danno
    let dmg = P.dmg * (0.55 + A.st.pow / 100 * 0.9) * A.wc.pow * (0.6 + 0.4 * A.stamR) * U.rand(0.86, 1.14);
    if (A.wobbled) dmg *= 0.8;
    let crit = false;
    if (block < 0.3 && Math.random() < 0.035 + A.st.tec / 1100 + (counter ? 0.1 : 0)) { crit = true; dmg *= 1.35; }
    if (counter) dmg *= 1.3;
    if (A.combo >= 3) dmg *= 0.92;
    dmg *= duckMult * this.cfg.dmgScale;
    const eff = dmg * (1 - block);
    const clean = block < 0.3;
    if (!body) {
      D.head -= eff * 0.72 * (1.15 - D.st.chn / 200);
      const stunAdd = P.stun * (0.6 + A.st.pow / 125) * A.wc.pow * (1.35 - D.st.chn / 100 * 0.75) * (counter ? 1.5 : 1) * (crit ? 1.3 : 1) * (1 - block) * (1 + D.kd * 0.15) * this.cfg.dmgScale;
      D.stun += stunAdd;
      if (clean && (p.type === 'hook' || p.type === 'cross') && Math.random() < 0.05 * eff / 6) D.cut += U.rand(15, 35) * (this.cfg.spar ? 0.2 : 1);
      D.swell = Math.min(1, D.swell + eff * 0.0045);
    } else {
      D.body -= eff * 1.1;
      D.stam = Math.max(0, D.stam - eff * 1.25);
      D.stamMax = Math.max(40, D.stamMax - eff * 0.28);
      D.stun += P.stun * 0.22 * (1 - block) * this.cfg.dmgScale;
    }
    if (clean) {
      rA.landed++; rA.by[p.type].l++; rA.power += eff; rA[body ? 'body' : 'head']++;
      if (counter) rA.counters++;
      rD.taken += eff;
      if (D.wobbled) D.punish += eff; else D.punish = 0;
      A.punish = 0;
      D.takeHit(body ? 'body' : 'head', eff);
    } else {
      rD.blocked++;
      rA.power += eff * 0.3;
      D.blockHit(dmg);
    }
    if (D.state === 'idle' && D.guarding && block > 0.3) D.blockT = 0.14;
    this.emit(clean ? 'hit' : 'block', { att: A, def: D, punch: p, dmg: eff, raw: dmg, counter, crit, body, wobble: D.wobbled });
    this.checkDown(D, A, eff, body);
  }

  checkDown(D, A, eff, body) {
    if (this.cfg.attract) { D.head = Math.max(D.head, 30); D.stun = Math.min(D.stun, 50); D.body = Math.max(D.body, 30); return; }
    const kd = D.head <= 0 || D.stun >= 100 || D.body <= 0 || (body && D.body < 22 && eff > 6 && Math.random() < 0.25);
    if (kd) {
      if (this.cfg.spar) {
        D.stun = 20; D.head = Math.max(D.head, 35); D.body = Math.max(D.body, 35);
        this.emit('sparstop', { f: D });
        return;
      }
      this.knockdown(D, A);
      return;
    }
    // stop arbitrale: colpi senza risposta mentre barcolla
    if (D.wobbled && D.punish > 30 && D.stun > 70 && !this.cfg.street) {
      this.finish(A, 'TKO', 'L\'arbitro ferma l\'incontro');
    }
  }

  knockdown(D, A) {
    D.kd++; D.kdRound++;
    this.cur[this.sideOf(D)].kd++;
    D.state = 'down'; D.stateT = 0; D.punch = null; D.buffer = null; D.dodge = null; D.guarding = false;
    A.punch = null; A.buffer = null; if (A.state === 'punch' || A.state === 'dodge') A.state = 'idle';
    const overkill = D.head < -12 && Math.random() < 0.55 - D.st.hrt / 220;
    const k = { who: D, by: A, t: 0, count: 0, meter: 0, ko: overkill, tko: false, riseAt: 99 };
    if (this.cfg.kdRule && D.kdRound >= this.cfg.kdRule) k.tko = true;
    const chance = U.clamp(0.35 + D.st.hrt / 150 + (Math.max(0, D.head) / D.headMax) * 0.2 - (D.kd - 1) * 0.17, 0.04, 0.96);
    if (!overkill && Math.random() < chance) k.riseAt = U.rand(3.5, 9.2);
    this.kdInfo = k;
    this.phase = 'kd';
    this.emit('kd', { f: D, by: A, overkill });
  }
  /* il giocatore preme per rialzarsi */
  tapGetUp() {
    const k = this.kdInfo;
    if (!k || k.who.state !== 'down' || k.ko || k.tko || k.t < 1.2) return;
    const D = k.who;
    k.meter += 6.2 * (0.6 + D.st.hrt / 120) / (1 + 0.32 * (D.kd - 1)) * (0.6 + 0.4 * U.clamp(D.head / 40 + 0.5, 0, 1.4));
  }
  updateKD(dt) {
    const k = this.kdInfo, D = k.who, O = k.by;
    k.t += dt;
    // l'altro va all'angolo neutro
    if (O.state !== 'neutral' && O.state !== 'victory') { O.state = 'neutral'; }
    const nx = O.side * (this.lim - 0.35);
    O.vx = Math.abs(nx - O.x) > 0.08 ? Math.sign(nx - O.x) * 1.4 : 0;
    O.facing = -O.side;
    if (k.tko) {
      if (k.t > 2.8) this.finish(O, 'TKO', `Regola dei ${this.cfg.kdRule} atterramenti`);
      return;
    }
    const nc = k.t < 1.2 ? 0 : Math.min(10, Math.floor((k.t - 1.2) / 0.95) + 1);
    if (nc !== k.count) { k.count = nc; this.emit('count', { n: nc, f: D }); }
    if (D.state === 'down') {
      if (D.ctrl === 'player') { k.meter = Math.max(0, k.meter - 9 * dt); if (k.meter >= 100) { D.state = 'rising'; D.stateT = 0; } }
      else if (k.count >= k.riseAt) { D.state = 'rising'; D.stateT = 0; }
      if (k.count >= 10 && D.state === 'down') {
        D.state = 'ko';
        this.finish(O, 'KO', 'Contato fino a dieci');
        return;
      }
    } else if (D.state === 'rising' && D.stateT > 0.9) { D.state = 'standing'; D.stateT = 0; }
    else if (D.state === 'standing' && k.count >= 8 && D.stateT > 0.6) {
      // ripresa
      D.head = Math.min(D.headMax, Math.max(D.head, D.headMax * 0.3 + D.st.hrt * 0.15));
      D.headMax = Math.max(40, D.headMax - 8);
      D.stun = 28; D.body = Math.max(D.body, 22); D.state = 'idle';
      O.state = 'idle';
      const cx = U.clamp(D.x, -this.lim + 0.8, this.lim - 0.8);
      D.x = cx; O.x = cx + (O.side > 0 ? 1.9 : -1.9);
      O.x = U.clamp(O.x, -this.lim, this.lim);
      this.phase = 'fight'; this.kdInfo = null;
      this.emit('resume', { f: D });
    }
  }

  /* ===== Round e punteggi ===== */
  endRound() {
    this.emit('bell', { round: this.round });
    this.scoreRound();
    // fatica accumulata
    for (const f of [this.a, this.b]) {
      f.stamMax = Math.max(45, f.stamMax - (1.5 + f.roundThrown * 0.035) * (1.35 - f.st.sta / 100));
      f.roundThrown = 0; f.kdRound = 0;
      f.punch = null; f.buffer = null; f.dodge = null; f.state = 'idle'; f.guarding = false;
    }
    if (this.cut(this.a) || this.cut(this.b)) return;
    if (this.round >= this.cfg.rounds) { this.decision(); return; }
    this.phase = 'break';
    this.emit('break_start', { round: this.round });
  }
  cut(f) {
    if (f.cut >= 100 && !this.cfg.spar && !this.cfg.street) {
      this.finish(this.other(f), 'TKO', 'Il medico ferma l\'incontro per un taglio');
      return true;
    }
    return false;
  }
  scoreRound() {
    if (this.cfg.street || this.cfg.spar) return;
    const ra = this.cur.a, rb = this.cur.b;
    JUDGES.forEach((j, i) => {
      const sc = (r) => r.power * j.w.pow + r.landed * j.w.cnt + r.aggr * j.w.agg + r.evaded * j.w.def * 0.6 + r.blocked * j.w.def * 0.3;
      let sa = sc(ra), sb = sc(rb);
      const noise = (sa + sb) * 0.09 + 1;
      sa += U.rand(-noise, noise); sb += U.rand(-noise, noise);
      let pa = 10, pb = 10;
      const kdd = rb.kd - ra.kd;
      if (kdd > 0) { pa = 10; pb = 9 - (kdd - 1) - 1 + (sb > sa * 1.4 ? 1 : 0); }
      else if (kdd < 0) { pb = 10; pa = 9 - (-kdd - 1) - 1 + (sa > sb * 1.4 ? 1 : 0); }
      else if (ra.kd > 0) { if (sa > sb) pb = 9; else pa = 9; }
      else {
        const diff = sa - sb, tot = sa + sb + 1;
        if (Math.abs(diff) / tot < 0.03 && Math.random() < 0.5) { /* 10-10 */ }
        else if (diff > 0) pb = 9; else pa = 9;
      }
      this.cards[i].rounds.push([Math.max(6, pa), Math.max(6, pb)]);
    });
  }
  decision() {
    if (this.cfg.spar) { this.finish(null, 'SPAR', 'Sparring concluso'); return; }
    if (this.cfg.street) {
      const pa = this.rs.reduce((s, r) => s + r.a.power + r.b.kd * 25, 0);
      const pb = this.rs.reduce((s, r) => s + r.b.power + r.a.kd * 25, 0);
      if (Math.abs(pa - pb) < (pa + pb) * 0.08) this.finish(null, 'STOP', 'La rissa viene interrotta');
      else this.finish(pa > pb ? this.a : this.b, 'PTS', 'Ha avuto la meglio');
      return;
    }
    let va = 0, vb = 0, dr = 0;
    for (const c of this.cards) {
      c.ta = c.rounds.reduce((s, r) => s + r[0], 0); c.tb = c.rounds.reduce((s, r) => s + r[1], 0);
      if (c.ta > c.tb) va++; else if (c.tb > c.ta) vb++; else dr++;
    }
    let winner = null, method = 'DRAW', text = 'Pareggio';
    if (va === 3 || vb === 3) { winner = va === 3 ? this.a : this.b; method = 'UD'; text = 'Decisione unanime'; }
    else if ((va === 2 && vb === 1) || (vb === 2 && va === 1)) { winner = va === 2 ? this.a : this.b; method = 'SD'; text = 'Decisione non unanime'; }
    else if ((va === 2 && dr === 1) || (vb === 2 && dr === 1)) { winner = va === 2 ? this.a : this.b; method = 'MD'; text = 'Decisione a maggioranza'; }
    else { text = dr === 3 ? 'Pareggio unanime' : 'Pareggio'; }
    this.finish(winner, method, text);
  }
  finish(winner, method, text) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const loser = winner ? this.other(winner) : null;
    if (winner) { winner.state = 'victory'; winner.stateT = 0; }
    if (loser && loser.state !== 'ko' && loser.state !== 'down') { loser.state = 'sad'; }
    for (const c of this.cards) { c.ta = c.rounds.reduce((s, r) => s + r[0], 0); c.tb = c.rounds.reduce((s, r) => s + r[1], 0); }
    this.result = {
      winner: winner ? this.sideOf(winner) : null, method, text,
      round: this.round, clock: this.clock, cards: this.cards, totals: this.totals(),
    };
    this.emit('end', { result: this.result });
  }
  nextRound(choiceA, choiceB, cutBonusA = 0, cutBonusB = 0) {
    this.recover(this.a, choiceA, cutBonusA);
    this.recover(this.b, choiceB, cutBonusB);
    this.round++; this.clock = 0;
    this.rs.push({ a: newRoundStats(), b: newRoundStats() });
    this.a.x = -1.3; this.b.x = 1.3; this.a.vx = this.b.vx = 0;
    this.a.state = this.b.state = 'idle';
    this.phase = 'fight';
  }
  recover(F, choice, cutBonus) {
    const k = { fiato: [1.3, 0.8, 0.7], ghiaccio: [0.85, 1.35, 0.8], taglio: [0.85, 0.85, 1.7] }[choice] || [1, 1, 1];
    F.stam = Math.min(F.stamMax, F.stam + (F.stamMax - F.stam) * U.clamp((0.5 + F.st.sta / 260) * k[0], 0, 1));
    F.head = Math.min(F.headMax, F.head + (F.headMax - F.head) * (0.28 + F.st.hrt / 420) * k[1]);
    F.swell = Math.max(0, F.swell - (0.12 + cutBonus * 0.004) * k[1]);
    F.body = Math.min(100, F.body + (100 - F.body) * 0.18);
    F.cut = Math.max(0, F.cut - (18 + cutBonus) * k[2]);
    F.stun = 0;
  }
  aiCorner(F) {
    if (F.cut > 35) return 'taglio';
    if (F.stam < F.stamMax * 0.55) return 'fiato';
    if (F.head < 60 || F.swell > 0.35) return 'ghiaccio';
    return 'fiato';
  }
  totals() {
    const t = { a: newRoundStats(), b: newRoundStats() };
    for (const r of this.rs) for (const s of ['a', 'b']) {
      const T = t[s], R = r[s];
      for (const k of ['thrown', 'landed', 'power', 'head', 'body', 'blocked', 'evaded', 'aggr', 'kd', 'taken', 'counters']) T[k] += R[k];
      for (const p of PUNCH_TYPES) { T.by[p].t += R.by[p].t; T.by[p].l += R.by[p].l; }
    }
    return t;
  }
}
