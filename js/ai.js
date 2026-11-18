'use strict';
/* ===== Intelligenza artificiale: usa gli stessi comandi del giocatore ===== */
const AI_DIFF = [
  { name: 'Facile', react: 0.3, skill: 0.45, aggr: 0.72, iq: 0.2 },
  { name: 'Normale', react: 0.21, skill: 0.7, aggr: 0.9, iq: 0.5 },
  { name: 'Difficile', react: 0.145, skill: 0.88, aggr: 1.0, iq: 0.8 },
  { name: 'Leggenda', react: 0.105, skill: 1.05, aggr: 1.08, iq: 1.0 },
];

class AI {
  constructor(me, opp, styleKey, diff) {
    this.me = me; this.op = opp;
    this.S = STYLES[styleKey] || STYLES.boxer;
    this.D = AI_DIFF[U.clamp(diff, 0, 3)];
    this.think = 0.4; this.plan = []; this.pend = null; this.pendAct = null; this.seen = -1; this.seenRec = -1;
    this.mem = { jab: 1, cross: 1, hook: 1, upper: 1, head: 2, body: 1 };
    this.oppGuardT = 0; this.totalT = 0;
    this.guardT = 0; this.moveDir = 0;
    this.passive = false;   // non attacca (tutorial)
    this.noDefense = false;
    this.aggrMul = 1;
  }
  update(dt, sim) {
    const me = this.me, op = this.op, I = me.intent;
    if (sim.phase !== 'fight' || me.down || me.state === 'neutral' || me.state === 'victory' || me.state === 'clinch') {
      I.move = 0; I.guard = false; I.down = false; this.plan = []; this.pend = null; this.pendAct = null; return;
    }
    this.totalT += dt;
    if (op.guarding) this.oppGuardT += dt;
    const dist = Math.abs(op.x - me.x), toward = Math.sign(op.x - me.x) || me.facing;

    // percezione del colpo in arrivo
    if (op.state === 'punch' && op.punch.phase === 'wind' && this.seen !== op.punch.id) {
      this.seen = op.punch.id;
      this.mem[op.punch.type] += 1; this.mem[op.punch.target] += 1;
      const delay = this.D.react * U.rand(0.75, 1.3) * (me.wobbled ? 1.4 : 1) * (1.12 - me.st.def / 400) * (1 + (1 - me.stamR) * 0.3);
      this.pend = { t: delay, id: op.punch.id };
    }
    if (this.pend) {
      this.pend.t -= dt;
      if (this.pend.t <= 0) {
        const id = this.pend.id; this.pend = null;
        if (op.state === 'punch' && op.punch.id === id && op.punch.phase === 'wind') this.reactTo(op.punch, dist, sim);
      }
    }
    if (this.pendAct) {
      this.pendAct.t -= dt;
      if (this.pendAct.t <= 0) { const a = this.pendAct; this.pendAct = null; this.doDodge(a.k, sim); }
    }
    // punire un colpo andato a vuoto
    if (op.state === 'punch' && op.punch.phase === 'rec' && this.seenRec !== op.punch.id) {
      this.seenRec = op.punch.id;
      if (!this.passive && me.state === 'idle' && dist < PUNCHES.cross.range * me.reach && Math.random() < this.S.counter * this.D.iq * 0.8) {
        this.plan = [{ type: dist < 0.9 ? U.pick(['hook', 'upper']) : 'cross', target: 'head' }];
        this.guardT = 0;
      }
    }

    if (this.guardT > 0) { this.guardT -= dt; I.guard = true; } else I.guard = false;

    this.think -= dt;
    if (this.think <= 0) {
      this.think = U.rand(0.1, 0.27) * (this.D.iq < 0.3 ? 1.4 : 1);
      this.decide(dist, toward, sim);
    }
    // esecuzione del piano
    I.move = this.moveDir;
    if (this.plan.length && !I.guard) {
      const ready = me.state === 'idle' || (me.state === 'punch' && me.punch.phase !== 'wind' && !me.buffer) || (me.state === 'dodge' && me.dodge.t > me.dodge.dur * 0.5 && !me.buffer);
      if (ready) {
        const n = this.plan[0];
        if (me.state === 'idle' && dist > PUNCHES[n.type].range * me.reach + 0.02 + (1 - this.D.iq) * 0.25) I.move = toward;
        else {
          this.plan.shift();
          if (me.state !== 'idle' && PUNCHES[n.type].range * me.reach < dist - 0.05 && Math.random() < this.D.iq) n.type = 'cross';
          I.down = n.target === 'body'; me.requestPunch(n.type, n.target, sim);
        }
      }
    }
  }
  reactTo(punch, dist, sim) {
    const me = this.me, op = this.op, P = PUNCHES[punch.type];
    if (this.noDefense) return;
    if (dist > P.range * op.reach + 0.12) return;
    const remaining = punch.wind - punch.t;
    const tot = this.mem.jab + this.mem.cross + this.mem.hook + this.mem.upper;
    let pDef = this.S.defense * this.D.skill * (0.55 + 0.45 * me.stamR) * (me.wobbled ? 0.6 : 1);
    pDef *= 0.82 + 0.75 * (this.mem[punch.type] / tot) * this.D.iq;
    if (this.passive) pDef *= 0.5;
    if (Math.random() > pDef) return;
    const body = punch.target === 'body';
    const opts = [{ k: 'block', w: this.S.guard * 1.2 + (me.stam > 15 ? 0.3 : 0) }];
    if (!body && (punch.type === 'jab' || punch.type === 'cross')) opts.push({ k: 'slip', w: 0.5 + this.S.defense * 0.6 });
    if (!body && punch.type === 'hook') opts.push({ k: 'duck', w: 0.6 + this.S.defense * 0.4 });
    if (!sim.onRopes(me)) opts.push({ k: 'back', w: 0.3 + (this.S.dist > 1.05 ? 0.4 : 0) });
    const jabWind = PUNCHES.jab.wind * me.timeF();
    if (!this.passive && me.state === 'idle' && jabWind < remaining * 0.9 && dist <= PUNCHES.jab.range * me.reach)
      opts.push({ k: 'counter', w: this.S.counter * 1.3 * this.D.iq });
    const c = U.weighted(opts, o => o.w);
    if (c.k === 'block') {
      this.guardT = 0.42 + Math.random() * 0.3;
      me.intent.guard = true; me.intent.down = body; this.plan = [];
    } else if (c.k === 'counter') {
      this.plan = [{ type: 'jab', target: 'head' }];
      if (Math.random() < 0.5) this.plan.push({ type: 'cross', target: 'head' });
    } else {
      // tempismo: la schivata migliore parte poco prima dell'impatto
      const lead = U.rand(0.06, 0.2) / Math.max(0.5, this.D.skill);
      this.pendAct = { k: c.k, t: Math.max(0, remaining - lead) };
    }
  }
  doDodge(k, sim) {
    const me = this.me, I = me.intent;
    const toward = Math.sign(this.op.x - me.x) || me.facing;
    I.down = k === 'duck';
    I.move = k === 'back' ? -toward : 0;
    if (me.requestDodge(sim)) {
      if (!this.passive && Math.random() < this.S.counter * (0.5 + this.D.iq * 0.6)) {
        this.plan = [{ type: k === 'duck' ? U.pick(['upper', 'hook']) : 'cross', target: 'head' }];
        if (Math.random() < 0.4) this.plan.push({ type: 'hook', target: 'head' });
      }
    }
    I.down = false;
  }
  decide(dist, toward, sim) {
    const me = this.me, op = this.op, S = this.S;
    const stamR = me.stamR;
    let desired = S.dist;
    let aggr = S.aggr * this.D.aggr * this.aggrMul;
    if (stamR < 0.3) { desired += 0.35; aggr *= 0.5; }
    if (op.wobbled) { desired = 0.85; aggr = Math.min(1.3, aggr + 0.6 * this.D.iq + 0.2); }
    if (op.stamR < 0.25) aggr += 0.15;
    if (me.wobbled) { desired = 1.7; aggr *= 0.3; }
    if (this.passive) aggr = 0;
    const err = dist - desired;
    let mv = 0;
    if (err > 0.12) mv = toward; else if (err < -0.15) mv = -toward;
    if (Math.random() < 0.22) mv = U.pick([toward, -toward, 0]) * 0.6;
    if (sim.onRopes(me) && mv === -toward) mv = Math.random() < 0.5 ? toward * 0.6 : 0;
    // clinch quando barcolla
    if (me.wobbled && dist < 1.0 && Math.random() < 0.55 * this.D.skill) { mv = toward; this.guardT = 0.6; }
    this.moveDir = mv;
    // guardia in attesa
    if (dist < 1.35 && !this.plan.length && this.guardT <= 0 && Math.random() < S.guard * 0.45 * this.D.skill) {
      this.guardT = U.rand(0.25, 0.7);
      me.intent.down = this.mem.body / (this.mem.body + this.mem.head) > 0.45 && Math.random() < this.D.iq * 0.7;
    }
    // attacco
    const inRange = dist <= PUNCHES.jab.range * me.reach + 0.15;
    if (!this.plan.length && me.state === 'idle' && inRange && this.guardT <= 0.1 && Math.random() < aggr * 0.55 * (0.4 + stamR)) {
      this.plan = this.makeCombo(dist);
    }
  }
  makeCombo(dist) {
    const me = this.me, op = this.op;
    const gr = this.oppGuardT / Math.max(1, this.totalT);
    const pick = U.weighted(this.S.combos, c => {
      const first = c[0].split('_')[0];
      let w = 1;
      if (PUNCHES[first].range * me.reach < dist - 0.05) w *= 0.25;
      if (gr > 0.3 && c.some(x => x.endsWith('_b'))) w *= 1 + this.D.iq * 2;
      if (op.wobbled && c.length >= 2) w *= 2;
      if (me.stamR < 0.25 && c.length > 2) w *= 0.3;
      return w;
    });
    const plan = pick.map(s => { const [t, b] = s.split('_'); return { type: t, target: b ? 'body' : 'head' }; });
    plan.forEach(p => { if (p.target === 'head' && Math.random() < this.S.body * 0.3 * (gr > 0.3 ? 1.8 : 1)) p.target = 'body'; });
    if (gr > 0.4 && Math.random() < this.D.iq * 0.4) plan.push({ type: 'upper', target: 'head' });
    return plan;
  }
}
