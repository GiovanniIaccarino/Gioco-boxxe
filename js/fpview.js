'use strict';
/* ===== Visuale in prima persona =====
   L'avversario è disegnato frontalmente in prospettiva; i guantoni del giocatore
   sono in primo piano. La simulazione sotto è la stessa della visuale laterale. */
const FP_EYE = 1.62;

class FPView {
  constructor(scene) {
    this.sc = scene; this.t = 0;
    this.shake = 0; this.hurt = 0; this.hitDir = 0; this.jerk = { x: 0, y: 0, r: 0 };
    this.view = { x: 0, y: 0, r: 0, z: 1 };
    this.fx = []; this.op = null; this.me = null; this.slipSide = 1;
  }
  get sim() { return this.sc.sim; }

  onEvent(e) {
    const s = this.sim;
    if (e.type === 'hit' || e.type === 'block') {
      const pw = U.clamp(e.dmg / 9, 0.15, 1.3);
      if (e.def === s.a) {
        if (e.type === 'hit') {
          this.hurt = Math.min(1, this.hurt + pw * 0.5);
          this.shake = Math.max(this.shake, pw * 22);
          const side = e.punch.type === 'hook' ? (PUNCHES[e.punch.type].hand === 'lead' ? -1 : 1) * this.leadSign(s.b) : 0;
          this.jerk.x += side * pw * 40; this.jerk.r += side * pw * 0.06;
          this.jerk.y += e.punch.type === 'upper' ? -pw * 30 : e.body ? pw * 25 : -pw * 8;
          if (e.punch.type !== 'hook' && !e.body) this.jerk.z = (this.jerk.z || 0) - pw * 0.06;
        } else { this.shake = Math.max(this.shake, 5); this.fx.push({ k: 'block', life: 0.2, side: Math.random() < 0.5 ? -1 : 1 }); }
      } else {
        this.fx.push({ k: e.type === 'hit' ? 'star' : 'spark', life: e.type === 'hit' ? 0.28 : 0.18, body: e.body, pw, ox: (Math.random() - 0.5) * 0.1 });
        if (e.type === 'hit') this.shake = Math.max(this.shake, pw * 6);
      }
    }
    if (e.type === 'evade' && e.def === s.b) this.slipSide = -this.slipSide;
  }
  leadSign(f) { return f.stance === 'mancino' ? -1 : 1; }

  update(dt) {
    this.t += dt;
    const s = this.sim, A = s.a;
    this.shake = U.damp(this.shake, 0, 9, dt);
    this.hurt = U.damp(this.hurt, 0, 1.2, dt);
    for (const k of ['x', 'y', 'r']) this.jerk[k] = U.damp(this.jerk[k], 0, 9, dt);
    this.jerk.z = U.damp(this.jerk.z || 0, 0, 8, dt);
    // movimento della testa del giocatore
    let vx = 0, vy = 0, vr = 0, vz = 1;
    const bob = Math.abs(A.vx) > 0.25 ? Math.sin(this.t * 12) : 0;
    vy += bob * 4;
    if (A.state === 'dodge') {
      const d = A.dodge, e = Math.sin(Math.PI * U.clamp(d.t / d.dur, 0, 1));
      if (d.type === 'slip') { vx = -this.slipSide * 70 * e; vr = this.slipSide * 0.1 * e; }
      else if (d.type === 'duck') { vy = -120 * e; }
      else vz = 1 - 0.12 * e;
    } else if (A.state !== 'dodge') this.slipSidePick = true;
    if (A.state === 'idle' && A.guarding && !A.guardLow) vy -= 10;
    if (A.wobbled && !A.down) { vx += Math.sin(this.t * 2.3) * 25; vr += Math.sin(this.t * 1.7) * 0.05; }
    if (A.state === 'punch' && A.punch.phase !== 'rec') { vz = 1.03; vr += (A.punch.type === 'hook' ? 0.04 : 0) * this.leadSign(A); }
    if (A.down) { const k = A.state === 'rising' ? 1 - U.clamp(A.stateT / 0.9, 0, 1) : U.clamp(A.stateT / 0.6, 0, 1); vr = 1.2 * k; vy = 260 * k; }
    this.view.x = U.damp(this.view.x, vx, 14, dt); this.view.y = U.damp(this.view.y, vy, 14, dt);
    this.view.r = U.damp(this.view.r, vr, 12, dt); this.view.z = U.damp(this.view.z, vz, 10, dt);
    if (A.state === 'dodge' && A.dodge.t < dt * 1.5 && A.dodge.type === 'slip') this.slipSide = Math.random() < 0.5 ? -1 : 1;
    // pose
    this.op = this.lerp3(this.op, this.oppPose(s.b, s), 1 - Math.exp(-(s.b.state === 'punch' ? 40 : 14) * dt));
    this.me = this.lerp3(this.me, this.myPose(A, s), 1 - Math.exp(-(A.state === 'punch' ? 45 : 16) * dt));
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter(f => f.life > 0);
  }
  lerp3(cur, tgt, k) {
    if (!cur) return JSON.parse(JSON.stringify(tgt));
    for (const key in tgt) {
      const v = tgt[key];
      if (Array.isArray(v)) for (let i = 0; i < v.length; i++) cur[key][i] += (v[i] - cur[key][i]) * k;
      else cur[key] += (v - cur[key]) * k;
    }
    return cur;
  }

  /* ---- posa frontale dell'avversario (metri; z verso la telecamera) ---- */
  oppPose(f, s) {
    const ls = this.leadSign(f), a = f.anim, tired = 1 - f.stamR;
    const d = s.dist();
    const P = {
      lg: [0.13 * ls, 1.53 - tired * 0.15, 0.3], rg: [-0.1 * ls, 1.56 - tired * 0.12, 0.2],
      hx: 0, hy: 0, hz: 0, by: Math.sin(a * 7.5) * 0.015 - tired * 0.03, bx: Math.sin(a * 1.3) * 0.05, bz: 0.05, rot: 0, down: 0, twist: 0,
    };
    P.lg[0] += Math.sin(a * 3.1) * 0.015; P.lg[1] += Math.sin(a * 2.3) * 0.02;
    if (f.wobbled && !f.down) { P.bx += Math.sin(a * 4) * 0.12; P.rot = Math.sin(a * 3) * 0.12; P.lg[1] -= 0.12; P.rg[1] -= 0.12; }
    const maxZ = (range) => Math.min(range * f.reach * 0.95, d - 0.28);
    switch (f.state) {
      case 'idle':
        if (f.guarding && !f.guardLow) { P.lg = [0.065 * ls, 1.64, 0.3]; P.rg = [-0.065 * ls, 1.64, 0.3]; P.hy = -0.03; }
        else if (f.guarding) { P.lg = [0.1 * ls, 1.12, 0.3]; P.rg = [-0.1 * ls, 1.1, 0.3]; P.by -= 0.06; P.bz = 0.12; }
        if (f.intent.down && !f.guarding) { P.by -= 0.06; }
        break;
      case 'punch': {
        const p = f.punch, body = p.target === 'body', ty = body ? 1.15 : 1.58;
        const hand = PUNCHES[p.type].hand, hs = hand === 'lead' ? ls : -ls, key = hand === 'lead' ? 'lg' : 'rg';
        const base = P[key].slice();
        let wind = base.slice(), ext;
        const reach = maxZ(PUNCHES[p.type].range);
        if (p.type === 'jab' || p.type === 'cross') { wind = [base[0], base[1], base[2] - 0.08]; ext = [hs * 0.03, ty, reach]; }
        else if (p.type === 'hook') { wind = [hs * 0.48, base[1] - 0.02, 0.15]; ext = [-hs * 0.05, ty, reach]; }
        else { wind = [hs * 0.08, 1.05, 0.15]; ext = [hs * 0.02, body ? 1.2 : 1.62, reach]; }
        let from, to, k;
        if (p.phase === 'wind') { from = base; to = wind; k = U.easeIn(U.clamp(p.t / p.wind, 0, 1)); }
        else if (p.phase === 'act') { from = wind; to = ext; k = U.easeOut(U.clamp(p.t / p.act, 0, 1)); }
        else { from = ext; to = base; k = U.easeInOut(U.clamp(p.t / p.rec, 0, 1)); }
        P[key] = [U.lerp(from[0], to[0], k), U.lerp(from[1], to[1], k), U.lerp(from[2], to[2], k)];
        const ext01 = p.phase === 'act' ? k : p.phase === 'rec' ? 1 - k : 0;
        P.twist = (hand === 'rear' ? 1 : -0.5) * hs * 0.12 * ext01;
        P.bz += 0.1 * ext01; if (body) P.by -= 0.1 * ext01;
        if (p.type === 'upper' && p.phase === 'wind') P.by -= 0.08 * k;
        break;
      }
      case 'dodge': {
        const dd = f.dodge, e = Math.sin(Math.PI * U.clamp(dd.t / dd.dur, 0, 1));
        if (dd.type === 'slip') { P.hx = this.slipSide * 0.16 * e; P.bx += this.slipSide * 0.06 * e; P.rot = this.slipSide * 0.25 * e; }
        else if (dd.type === 'duck') { P.by -= 0.3 * e; P.bz += 0.1 * e; }
        else P.bz -= 0.15 * e;
        break;
      }
      case 'hit': {
        const k = Math.sin(Math.PI * U.clamp(f.stateT / f.hitT, 0, 1)), pw = U.clamp(f.hitPow / 8, 0.3, 1.3);
        if (f.hitKind === 'head') { P.hz = -0.1 * pw * k; P.hy = 0.03 * k; P.rot = (Math.random() < 0.5 ? 1 : -1) * 0.02 + 0.12 * pw * k * ls; P.lg[1] -= 0.08 * k; }
        else { P.by -= 0.12 * k; P.bz += 0.12 * k; P.lg = [0.12 * ls, 1.15, 0.25]; P.rg = [-0.1 * ls, 1.12, 0.25]; }
        break;
      }
      case 'clinch': P.lg = [0.2 * ls, 1.4, d - 0.2]; P.rg = [-0.2 * ls, 1.4, d - 0.2]; P.bz = 0.3; P.by -= 0.05; break;
      case 'down': case 'ko': P.down = U.easeOut(U.clamp(f.stateT / 0.6, 0, 1)); break;
      case 'rising': P.down = 1 - U.easeInOut(U.clamp(f.stateT / 0.9, 0, 1)); break;
      case 'standing': P.lg = [0.14 * ls, 1.4, 0.2]; P.rg = [-0.12 * ls, 1.4, 0.2]; break;
      case 'neutral': P.lg = [0.2 * ls, 1.0, 0.05]; P.rg = [-0.2 * ls, 1.0, 0.05]; break;
      case 'victory': { const b = Math.abs(Math.sin(a * 4)); P.lg = [0.3 * ls, 2.05 + b * 0.05, 0.05]; P.rg = [-0.3 * ls, 2.05 + b * 0.05, 0.05]; break; }
      case 'sad': P.lg = [0.18 * ls, 0.95, 0.1]; P.rg = [-0.18 * ls, 0.95, 0.1]; P.hy = -0.06; break;
    }
    return P;
  }

  /* ---- i guantoni del giocatore (spazio telecamera: x destra, y giù, z profondità) ---- */
  myPose(f, s) {
    const ls = this.leadSign(f), tired = 1 - f.stamR, a = f.anim, d = s.dist();
    // il braccio avanti (jab) dell'ortodosso è il sinistro
    const P = { L: [-0.2, 0.22 + tired * 0.07, 0.48], R: [0.2, 0.2 + tired * 0.06, 0.46] };
    P.L[1] += Math.sin(a * 3) * 0.01; P.R[1] += Math.cos(a * 2.6) * 0.01;
    const lead = ls > 0 ? 'L' : 'R', rear = ls > 0 ? 'R' : 'L';
    if (f.state === 'idle' && f.guarding) {
      if (!f.guardLow) { P.L = [-0.085, 0.1, 0.34]; P.R = [0.085, 0.1, 0.34]; }
      else { P.L = [-0.12, 0.42, 0.33]; P.R = [0.12, 0.42, 0.33]; }
    }
    if (f.state === 'punch') {
      const p = f.punch, body = p.target === 'body';
      const hand = PUNCHES[p.type].hand === 'lead' ? lead : rear, hs = hand === 'L' ? -1 : 1;
      const base = P[hand].slice();
      const reach = Math.max(0.5, Math.min(PUNCHES[p.type].range * f.reach * 0.95, d - 0.12));
      const ty = body ? 0.55 : 0.04;
      let wind = [base[0], base[1] + 0.03, base[2] - 0.06], ext = [hs * 0.02, ty, reach];
      if (p.type === 'hook') { wind = [hs * 0.42, base[1], 0.32]; ext = [-hs * 0.04, ty, reach]; }
      if (p.type === 'upper') { wind = [hs * 0.1, 0.55, 0.34]; ext = [hs * 0.02, body ? 0.45 : 0.02, reach]; }
      let from, to, k;
      if (p.phase === 'wind') { from = base; to = wind; k = U.easeIn(U.clamp(p.t / p.wind, 0, 1)); }
      else if (p.phase === 'act') { from = wind; to = ext; k = U.easeOut(U.clamp(p.t / p.act, 0, 1)); }
      else { from = ext; to = base; k = U.easeInOut(U.clamp(p.t / p.rec, 0, 1)); }
      P[hand] = [U.lerp(from[0], to[0], k), U.lerp(from[1], to[1], k), U.lerp(from[2], to[2], k)];
    }
    if (f.state === 'hit') { P.L[1] += 0.12; P.R[1] += 0.12; }
    if (f.state === 'clinch') { P.L = [-0.25, 0.25, 0.45]; P.R = [0.25, 0.25, 0.45]; }
    if (f.down) { P.L = [-0.3, 0.8, 0.4]; P.R = [0.3, 0.8, 0.4]; }
    if (f.state === 'neutral') { P.L = [-0.32, 0.62, 0.5]; P.R = [0.32, 0.62, 0.5]; }
    if (f.state === 'victory') { P.L = [-0.3, -0.5, 0.4]; P.R = [0.3, -0.5, 0.4]; }
    return P;
  }

  /* ===== Disegno ===== */
  render(ctx, w, h) {
    const sc = this.sc, s = this.sim, L = sc.layout(w, h);
    const A = L.portrait ? h - L.ctrlH * 0.55 : h;
    const cx = w / 2, Hy = A * 0.4;
    const F = Math.min(A * 0.42, w * 0.62);
    const d = Math.max(0.5, s.dist());
    if (!this.op) this.update(0);
    ctx.save();
    // movimento della telecamera
    const sh = this.shake;
    ctx.translate(cx + this.view.x + this.jerk.x + (Math.random() - 0.5) * sh, Hy - this.view.y + this.jerk.y + (Math.random() - 0.5) * sh);
    ctx.rotate(this.view.r + this.jerk.r);
    const z = this.view.z * (1 + (this.jerk.z || 0));
    ctx.scale(z, z);
    ctx.translate(-cx, -Hy);
    const proj = (x, y, zz) => { const dep = Math.max(0.25, d - zz); const k = F / dep; return { x: cx + x * k, y: Hy + (FP_EYE - y) * k, k }; };
    this.drawBack(ctx, w, h, cx, Hy, F, d, s);
    this.drawOpponent(ctx, s.b, this.op, proj);
    for (const f of this.fx) {
      if (f.k !== 'star' && f.k !== 'spark') continue;
      const p = proj(f.ox, f.body ? 1.15 : 1.62, 0.15), a = f.life / 0.28;
      ctx.save(); ctx.globalAlpha = U.clamp(a * 1.5, 0, 1); ctx.translate(p.x, p.y);
      const r = p.k * (f.k === 'star' ? 0.12 + f.pw * 0.1 : 0.07) * (1.6 - a * 0.6);
      ctx.fillStyle = f.k === 'star' ? '#fff6d0' : '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    // primo piano: i tuoi guantoni (seguono solo in parte la testa)
    ctx.save();
    ctx.translate(this.view.x * 0.4 + this.jerk.x * 0.3, -this.view.y * 0.2);
    this.drawMyGloves(ctx, w, A, cx, Hy, F, s.a);
    ctx.restore();
    this.drawOverlays(ctx, w, h, A, s);
  }

  drawBack(ctx, w, h, cx, Hy, F, d, s) {
    const venue = this.sc.venue;
    const backD = d + Math.max(0.3, s.lim - s.b.x); // distanza delle corde alle spalle dell'avversario
    const k = F / backD;
    const floorY = Hy + FP_EYE * k;
    // cielo/soffitto e pubblico
    const top = ctx.createLinearGradient(0, -200, 0, floorY);
    if (venue === 'street') { top.addColorStop(0, '#070912'); top.addColorStop(1, '#22172e'); }
    else if (venue === 'gym') { top.addColorStop(0, '#1d1d22'); top.addColorStop(1, '#3a3636'); }
    else { top.addColorStop(0, '#04050a'); top.addColorStop(1, venue === 'arena' ? '#151a2e' : '#1d1b22'); }
    ctx.fillStyle = top; ctx.fillRect(-w, -h, w * 3, floorY + h);
    const par = -s.b.x * 30;
    if (venue === 'street') {
      const wallTop = Hy + (FP_EYE - 3.2) * k * 0.7;
      ctx.fillStyle = '#4a2b24'; ctx.fillRect(-w, wallTop, w * 3, floorY - wallTop);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
      const bh = Math.max(6, k * 0.12);
      for (let y = wallTop, r = 0; y < floorY; y += bh, r++) { ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w * 2, y); ctx.stroke(); for (let x = -w + (r % 2) * bh + par % (bh * 2); x < w * 2; x += bh * 2) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke(); } }
      ctx.save(); ctx.font = `bold ${k * 0.5}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(242,183,5,0.6)'; ctx.fillText('RIONE SOLE', cx + par + k * 0.8, wallTop + k * 0.9); ctx.restore();
      const lg = ctx.createRadialGradient(cx - k * 1.5, wallTop, 0, cx - k * 1.5, wallTop, k * 4);
      lg.addColorStop(0, 'rgba(255,200,120,0.3)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = lg; ctx.fillRect(-w, -h, w * 3, h * 3);
      for (let i = 0; i < 7; i++) {
        const x = cx + par + (i - 3) * k * 0.9 + (i % 2) * k * 0.2; if (Math.abs(x - cx) < k * 0.4) continue;
        const bob = Math.sin(this.t * 3 + i) * k * 0.02;
        ctx.fillStyle = 'rgba(10,10,15,0.9)'; ctx.fillRect(x - k * 0.18, floorY - k * 1.5 + bob, k * 0.36, k * 1.0);
        ctx.fillRect(x - k * 0.14, floorY - k * 0.55, k * 0.1, k * 0.55); ctx.fillRect(x + k * 0.04, floorY - k * 0.55, k * 0.1, k * 0.55);
        ctx.beginPath(); ctx.arc(x, floorY - k * 1.68 + bob, k * 0.15, 0, 7); ctx.fill();
      }
      const fl = ctx.createLinearGradient(0, floorY, 0, h);
      fl.addColorStop(0, '#1d1d22'); fl.addColorStop(1, '#0b0b0e'); ctx.fillStyle = fl; ctx.fillRect(-w, floorY, w * 3, h * 2);
      return;
    }
    // pubblico
    const list = Render.crowd('fp_' + venue, venue === 'arena' ? 8 : 5, 40, 404);
    Render.drawCrowd(ctx, list, w, Math.min(Hy - k * 2.5, Hy - 80), floorY - k * 0.6, venue === 'arena' ? 8 : 5, k * 1.1, s.b.x * 0.6, this.t, this.sc.excite, 0);
    if (venue === 'gym') {
      ctx.fillStyle = '#7a0f14'; ctx.fillRect(cx + par - k * 1.6, floorY - k * 2.4, k * 3.2, k * 0.36);
      ctx.fillStyle = '#f2b705'; ctx.font = `bold ${k * 0.26}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PALESTRA LEONE', cx + par, floorY - k * 2.22);
    }
    if (this.sc.flashes) for (const f of this.sc.flashes) {
      const g = ctx.createRadialGradient(f.x * w, f.y * floorY * 0.8, 0, f.x * w, f.y * floorY * 0.8, 30 * f.l);
      g.addColorStop(0, `rgba(255,255,255,${f.l})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(f.x * w - 30, f.y * floorY * 0.8 - 30, 60, 60);
    }
    // tappeto in prospettiva
    const canvasCol = venue === 'gym' ? '#bfc3c9' : venue === 'arena' ? '#1d3a8a' : '#2b6cb0';
    const fg = ctx.createLinearGradient(0, floorY, 0, h);
    fg.addColorStop(0, U.shade(canvasCol, -0.2)); fg.addColorStop(1, U.shade(canvasCol, 0.15));
    ctx.fillStyle = fg; ctx.fillRect(-w, floorY, w * 3, h * 2);
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff'; ctx.font = `bold ${F * 0.5}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center';
    const ly = Hy + FP_EYE * F / Math.max(0.6, d * 0.5);
    ctx.translate(cx, ly); ctx.scale(1, 0.3); ctx.fillText('BOXXE', 0, 0); ctx.restore();
    // corde e pali alle spalle dell'avversario
    const ropes = venue === 'arena' ? ['#f2b705', '#f5f5f5', '#f2b705'] : venue === 'gym' ? ['#c62828', '#f5f5f5', '#1d4ed8'] : ['#c62828', '#f5f5f5', '#c62828'];
    const postX = 3.05;
    for (const sx of [-1, 1]) {
      const px = cx + sx * postX * k;
      ctx.fillStyle = '#d6d6d6'; ctx.fillRect(px - k * 0.06, floorY - 1.35 * k, k * 0.12, 1.35 * k);
      ctx.fillStyle = ropes[0]; ctx.fillRect(px - k * 0.09, floorY - 1.35 * k, k * 0.18, k * 0.4);
    }
    ropes.forEach((c, i) => {
      const y = floorY - (0.45 + i * 0.4) * k;
      ctx.strokeStyle = U.shade(c, -0.2); ctx.lineWidth = Math.max(2, k * 0.035);
      ctx.beginPath(); ctx.moveTo(cx - postX * k - w, y + k * 0.5); ctx.lineTo(cx - postX * k, y); ctx.quadraticCurveTo(cx, y + k * 0.04, cx + postX * k, y); ctx.lineTo(cx + postX * k + w, y + k * 0.5); ctx.stroke();
    });
    if (venue !== 'gym') {
      const g = ctx.createRadialGradient(cx, Hy - F, F * 0.2, cx, Hy, F * 3);
      g.addColorStop(0, 'rgba(255,250,230,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(-w, -h, w * 3, h * 3);
    }
  }

  drawOpponent(ctx, f, P, proj) {
    const L = f.look, bulk = L.bulk || 1, size = L.size || 1;
    const skin = L.skin, skinD = U.shade(skin, -0.25);
    const dn = P.down;
    // caduta: il busto si piega all'indietro e scende
    const Y = (y) => (y * size) * (1 - dn * 0.12) + P.by * (1 - dn);
    const Z = (zz, y) => zz - dn * 0.25 * U.clamp(y / 1.6, 0, 1);
    const X = (x, y) => x * bulk + (P.bx + Math.sin(P.rot) * (y - 0.9)) * (1 - dn);
    const pt = (x, y, zz) => proj(X(x, y), Y(y), Z(zz + (y > 1.0 ? P.bz * (y - 0.9) / 0.8 : 0), y));
    const twist = P.twist;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // caduta: tutta la figura ruota sul pavimento
    const fp = proj(P.bx, 0, 0);
    ctx.save();
    if (dn > 0.01) {
      const side = this.leadSign(f) > 0 ? 1 : -1;
      ctx.translate(fp.x, fp.y); ctx.rotate(side * dn * 1.38); ctx.scale(1, 1 - dn * 0.25); ctx.translate(-fp.x, -fp.y);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(fp.x, fp.y, fp.k * 0.5 * bulk, fp.k * 0.08, 0, 0, 7); ctx.fill();
    const seg = (a, b, wd, col) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    const pants = L.bottom !== 'shorts';
    // gambe
    for (const sx of [-1, 1]) {
      const hip = pt(sx * 0.1, 0.9, 0), knee = pt(sx * 0.15, 0.47, 0.05), foot = pt(sx * 0.18, 0.02, 0);
      const c = pants ? L.pantsColor : skin;
      seg(hip, knee, hip.k * (pants ? 0.15 : 0.13) * bulk, sx < 0 ? U.shade(c, -0.12) : c);
      seg(knee, foot, knee.k * (pants ? 0.13 : 0.1) * bulk, sx < 0 ? U.shade(c, -0.12) : c);
      if (!pants) seg(pt(sx * 0.165, 0.2, 0.03), foot, foot.k * 0.11, L.shoes);
      ctx.fillStyle = L.shoes; ctx.beginPath(); ctx.ellipse(foot.x, foot.y, foot.k * 0.07, foot.k * 0.04, 0, 0, 7); ctx.fill();
    }
    // busto
    const sh = 0.21, wa = 0.15;
    const lsh = pt(sh + twist * 0.3, 1.42, twist * 0.5), rsh = pt(-sh + twist * 0.3, 1.42, -twist * 0.5);
    const lw = pt(wa, 0.95, 0), rw = pt(-wa, 0.95, 0);
    let tc = L.top === 'none' ? skin : L.top === 'ref' ? '#f4f4f4' : L.topColor;
    const tg = ctx.createLinearGradient(rsh.x, 0, lsh.x, 0);
    tg.addColorStop(0, U.shade(tc, -0.2)); tg.addColorStop(0.5, U.shade(tc, 0.08)); tg.addColorStop(1, U.shade(tc, -0.2));
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.moveTo(rsh.x, rsh.y); ctx.lineTo(lsh.x, lsh.y);
    ctx.quadraticCurveTo((lsh.x + lw.x) / 2 + lsh.k * 0.03, (lsh.y + lw.y) / 2, lw.x, lw.y); ctx.lineTo(rw.x, rw.y);
    ctx.quadraticCurveTo((rsh.x + rw.x) / 2 - rsh.k * 0.03, (rsh.y + rw.y) / 2, rsh.x, rsh.y); ctx.fill();
    if (L.top === 'tank') { ctx.fillStyle = skin; for (const p of [lsh, rsh]) { ctx.beginPath(); ctx.arc(p.x, p.y, p.k * 0.07, 0, 7); ctx.fill(); } }
    if (L.top === 'none') {
      const c = pt(0, 1.2, 0.02);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = Math.max(1, c.k * 0.01);
      ctx.beginPath(); ctx.moveTo(c.x, pt(0, 1.38, 0).y); ctx.lineTo(c.x, pt(0, 1.0, 0).y); ctx.stroke();
      for (const sx of [-1, 1]) { const a1 = pt(sx * 0.17, 1.27, 0), a2 = pt(sx * 0.02, 1.25, 0); ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.quadraticCurveTo((a1.x + a2.x) / 2, a1.y + c.k * 0.05, a2.x, a2.y); ctx.stroke(); }
      if (f.body < 70) { ctx.fillStyle = `rgba(150,20,30,${(1 - f.body / 100) * 0.45})`; const b = pt(0.08 * this.leadSign(f), 1.08, 0.03); ctx.beginPath(); ctx.ellipse(b.x, b.y, b.k * 0.07, b.k * 0.08, 0, 0, 7); ctx.fill(); }
    }
    // pantaloncini
    if (!pants) {
      const a = pt(-0.17, 1.0, 0), b = pt(0.17, 1.0, 0), c = pt(0.2, 0.62, 0.02), e = pt(-0.2, 0.62, 0.02), m = pt(0, 0.75, 0.02);
      ctx.fillStyle = L.shorts; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(m.x + m.k * 0.02, m.y); ctx.lineTo(m.x - m.k * 0.02, m.y); ctx.lineTo(e.x, e.y); ctx.fill();
      ctx.fillStyle = L.trim; ctx.fillRect(a.x, a.y - a.k * 0.05, b.x - a.x, a.k * 0.07);
    } else {
      const a = pt(-0.16, 1.0, 0), b = pt(0.16, 1.0, 0);
      ctx.fillStyle = L.pantsColor; ctx.fillRect(a.x, a.y - a.k * 0.03, b.x - a.x, a.k * 0.14);
    }
    // collo e testa
    const head = proj(X(P.hx, 1.64), Y(1.64 + P.hy), Z(P.hz + P.bz * 0.9, 1.64));
    const neck = pt(0, 1.47, 0);
    seg(neck, { x: head.x, y: head.y + head.k * 0.08 }, neck.k * 0.12 * bulk, skin);
    // braccia ordinate per profondità
    const ls = this.leadSign(f);
    const arms = [{ sh: ls > 0 ? lsh : rsh, g: P.lg, dark: false }, { sh: ls > 0 ? rsh : lsh, g: P.rg, dark: true }];
    arms.sort((a, b) => a.g[2] - b.g[2]);
    const drawHead = () => this.frontHead(ctx, L, head.x, head.y, head.k, f, P);
    let headDrawn = false;
    for (const arm of arms) {
      if (!headDrawn && arm.g[2] > 0.22) { drawHead(); headDrawn = true; }
      const g = proj(X(arm.g[0], arm.g[1]), Y(arm.g[1]), Z(arm.g[2], arm.g[1]));
      const el = { x: (arm.sh.x + g.x) / 2 + (arm.sh.x > head.x ? 1 : -1) * g.k * 0.08, y: Math.max(arm.sh.y, g.y) + (g.k + arm.sh.k) * 0.06 };
      const ac = arm.dark ? skinD : skin;
      const sleeve = L.top === 'hoodie' || L.top === 'track' || L.top === 'suit';
      seg(arm.sh, el, arm.sh.k * 0.1 * bulk, sleeve ? L.topColor : ac);
      seg(el, g, (arm.sh.k + g.k) / 2 * 0.085 * bulk, sleeve ? L.topColor : ac);
      if (L.hands === 'gloves') {
        const r = g.k * 0.095;
        const gg = ctx.createRadialGradient(g.x - r * 0.3, g.y - r * 0.35, r * 0.1, g.x, g.y, r * 1.1);
        gg.addColorStop(0, U.shade(L.gloves, 0.35)); gg.addColorStop(1, U.shade(L.gloves, arm.dark ? -0.45 : -0.3));
        ctx.fillStyle = L.trim === L.gloves ? '#eeeeee' : L.trim; ctx.beginPath(); ctx.ellipse(g.x, g.y + r * 0.75, r * 0.6, r * 0.35, 0, 0, 7); ctx.fill();
        ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(g.x, g.y, r, r * 1.05, 0, 0, 7); ctx.fill();
      } else { ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(g.x, g.y, g.k * 0.05, 0, 7); ctx.fill(); }
    }
    if (!headDrawn) drawHead();
    ctx.restore();
  }

  frontHead(ctx, L, x, y, k, f, P) {
    const r = 0.115 * k, skin = L.skin, skinD = U.shade(skin, -0.25);
    ctx.save(); ctx.translate(x, y); ctx.rotate(P.rot * 0.5);
    ctx.fillStyle = L.hairColor;
    if (L.hair === 6) { ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 1.35, 0, 7); ctx.fill(); }
    ctx.fillStyle = skinD; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.98, r * 0.05, r * 0.18, r * 0.28, 0, 0, 7); ctx.fill(); }
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r * 1.2);
    g.addColorStop(0, U.shade(skin, 0.12)); g.addColorStop(1, U.shade(skin, -0.15));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92, r * 1.08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = L.hairColor;
    switch (L.hair) {
      case 0: case 3: ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(0, -r * 0.45, r * 0.9, r * 0.6, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
        if (L.hair === 3) { ctx.fillRect(-r * 0.15, -r * 1.35, r * 0.3, r * 0.75); } break;
      case 1: case 4: ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 0.98, r * 0.65, 0, Math.PI, 0); ctx.lineTo(r * 0.6, -r * 0.45); ctx.lineTo(-r * 0.6, -r * 0.4); ctx.fill(); break;
      case 2: for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i * 0.1); ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.95 - r * 0.1, r * 0.3, 0, 7); ctx.fill(); } break;
      case 5: ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.7, r * 0.3, r * 0.12, -0.3, 0, 7); ctx.fill(); break;
      case 6: break;
    }
    const sw = f.swell, ls = this.leadSign(f);
    const blink = f.blinkT < 0 || f.down;
    for (const sx of [-1, 1]) {
      const ex = sx * r * 0.36, ey = -r * 0.05;
      const swollen = sx === -ls ? sw : sw * 0.4;
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.17, r * 0.1 * (blink ? 0.15 : 1 - swollen * 0.8), 0, 0, 7); ctx.fill();
      if (!blink) { ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.07 * (1 - swollen * 0.5), 0, 7); ctx.fill(); }
      ctx.strokeStyle = L.hair === 5 ? U.shade(L.hairColor, 0.2) : L.hairColor; ctx.lineWidth = r * 0.08;
      ctx.beginPath(); ctx.moveTo(ex - sx * r * 0.18, ey - r * 0.2); ctx.lineTo(ex + sx * r * 0.15, ey - r * (f.wobbled ? 0.15 : 0.24)); ctx.stroke();
      if (swollen > 0.05) { ctx.fillStyle = `rgba(120,40,70,${Math.min(0.7, swollen)})`; ctx.beginPath(); ctx.ellipse(ex, ey + r * 0.03, r * (0.18 + swollen * 0.12), r * (0.13 + swollen * 0.12), 0, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = skinD; ctx.beginPath(); ctx.moveTo(0, -r * 0.05); ctx.lineTo(r * 0.12, r * 0.3); ctx.lineTo(-r * 0.12, r * 0.3); ctx.fill();
    const gloves = L.hands === 'gloves';
    ctx.strokeStyle = gloves ? (L.mouth || '#e8e8e8') : '#5a2a22'; ctx.lineWidth = r * (gloves ? 0.14 : 0.06);
    ctx.beginPath(); ctx.moveTo(-r * 0.25, r * 0.55); ctx.quadraticCurveTo(0, r * (f.wobbled || f.stamR < 0.3 ? 0.68 : 0.58), r * 0.25, r * 0.55); ctx.stroke();
    if (L.beard) {
      ctx.fillStyle = L.hairColor;
      if (L.beard === 1) { ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.ellipse(0, r * 0.6, r * 0.75, r * 0.45, 0, 0, Math.PI); ctx.fill(); ctx.globalAlpha = 1; }
      if (L.beard === 2) { ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 0.82, r * 0.5, 0, 0, Math.PI); ctx.fill(); }
      if (L.beard === 3 || L.beard === 4 || L.beard === 2) { ctx.fillRect(-r * 0.3, r * 0.4, r * 0.6, r * 0.09); }
      if (L.beard === 4) { ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.18, r * 0.18, 0, 0, 7); ctx.fill(); }
    }
    if (f.cut > 10) {
      const c = Math.min(1, f.cut / 100), sx = -ls * r * 0.35;
      ctx.strokeStyle = '#b3001b'; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(sx - r * 0.15, -r * 0.35); ctx.lineTo(sx + r * 0.15, -r * 0.3); ctx.stroke();
      ctx.fillStyle = `rgba(179,0,27,${0.4 + c * 0.5})`; ctx.fillRect(sx, -r * 0.3, r * 0.06, r * (0.2 + c * 0.5));
    }
    if (f.headgear) { ctx.strokeStyle = f.headgear; ctx.lineWidth = r * 0.25; ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.98, r * 1.1, 0, Math.PI * 0.85, Math.PI * 2.15); ctx.stroke(); }
    ctx.restore();
  }

  drawMyGloves(ctx, w, A, cx, Hy, F, f) {
    const L = f.look, P = this.me;
    const pr = (v) => { const k = F / Math.max(0.2, v[2]); return { x: cx + v[0] * k, y: Hy + v[1] * k, k }; };
    const arms = [['L', P.L], ['R', P.R]].sort((a, b) => b[1][2] - a[1][2]);
    for (const [side, v] of arms) {
      const g = pr(v), sx = side === 'L' ? -1 : 1;
      const r = g.k * 0.1;
      // avambraccio dal bordo dello schermo
      const ex = cx + sx * Math.min(w * 0.42, A * 0.6), ey = A + 30;
      const ang = Math.atan2(g.y - ey, g.x - ex), nx = -Math.sin(ang), ny = Math.cos(ang);
      const w1 = Math.max(r * 0.55, 22), w2 = r * 0.55;
      const sleeve = L.top === 'hoodie' || L.top === 'track';
      const ac = sleeve ? L.topColor : L.skin;
      const grd = ctx.createLinearGradient(ex, ey, g.x, g.y);
      grd.addColorStop(0, U.shade(ac, -0.35)); grd.addColorStop(1, U.shade(ac, -0.05));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(ex + nx * w1, ey + ny * w1); ctx.lineTo(g.x + nx * w2, g.y + ny * w2); ctx.lineTo(g.x - nx * w2, g.y - ny * w2); ctx.lineTo(ex - nx * w1, ey - ny * w1); ctx.fill();
      if (L.hands === 'gloves') {
        ctx.fillStyle = L.trim === L.gloves ? '#eeeeee' : L.trim;
        ctx.save(); ctx.translate(g.x - Math.cos(ang) * r * 0.75, g.y - Math.sin(ang) * r * 0.75); ctx.rotate(ang + Math.PI / 2);
        ctx.fillRect(-r * 0.6, -r * 0.25, r * 1.2, r * 0.5); ctx.restore();
        const gg = ctx.createRadialGradient(g.x - r * 0.3, g.y - r * 0.4, r * 0.1, g.x, g.y, r * 1.15);
        gg.addColorStop(0, U.shade(L.gloves, 0.4)); gg.addColorStop(0.6, L.gloves); gg.addColorStop(1, U.shade(L.gloves, -0.45));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(g.x, g.y, r, r * 1.08, ang + Math.PI / 2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(g.x - sx * r * 0.25, g.y - r * 0.45, r * 0.35, r * 0.16, -0.4 * sx, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, r * 0.06);
        ctx.beginPath(); ctx.arc(g.x + sx * r * 0.35, g.y + r * 0.05, r * 0.45, -1.2, 1.2); ctx.stroke();
      } else {
        if (L.hands === 'wraps') { ctx.fillStyle = '#eeeeee'; ctx.beginPath(); ctx.arc(g.x, g.y + r * 0.3, r * 0.55, 0, 7); ctx.fill(); }
        const gg = ctx.createRadialGradient(g.x - r * 0.2, g.y - r * 0.3, r * 0.1, g.x, g.y, r * 0.8);
        gg.addColorStop(0, U.shade(L.skin, 0.15)); gg.addColorStop(1, U.shade(L.skin, -0.3));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(g.x, g.y, r * 0.62, r * 0.7, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = U.shade(L.skin, -0.4); ctx.lineWidth = Math.max(1, r * 0.05);
        for (let i = -1; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(g.x - r * 0.45, g.y + i * r * 0.18 - r * 0.1); ctx.lineTo(g.x + r * 0.4, g.y + i * r * 0.18 - r * 0.1); ctx.stroke(); }
      }
    }
    for (const fx of this.fx) if (fx.k === 'block') {
      const v = P[fx.side < 0 ? 'L' : 'R'], g = pr(v);
      ctx.strokeStyle = `rgba(255,255,255,${fx.life * 4})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.k * 0.16 * (1.5 - fx.life * 2), 0, 7); ctx.stroke();
    }
  }

  drawOverlays(ctx, w, h, A, s) {
    const me = s.a;
    const dmg = 1 - U.clamp(me.head / 100, 0, 1);
    const red = Math.max(this.hurt * 0.55, dmg * 0.35 + (me.wobbled ? 0.2 + Math.sin(this.t * 5) * 0.08 : 0));
    if (red > 0.02) {
      const g = ctx.createRadialGradient(w / 2, A * 0.45, Math.min(w, A) * 0.25, w / 2, A * 0.45, Math.max(w, A) * 0.75);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(140,0,0,${red})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // fiato corto: bordi che pulsano scuri
    const tired = 1 - me.stamR;
    if (tired > 0.55) {
      const p = (tired - 0.55) * 1.6 * (0.6 + 0.4 * Math.sin(this.t * (2 + tired * 3)));
      const g = ctx.createRadialGradient(w / 2, A * 0.45, Math.min(w, A) * 0.2, w / 2, A * 0.45, Math.max(w, A) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${U.clamp(p, 0, 0.7)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // occhio gonfio: visuale ridotta da un lato
    if (me.swell > 0.25) {
      const side = this.leadSign(me) > 0 ? w : 0;
      const g = ctx.createLinearGradient(side, 0, w / 2, 0);
      g.addColorStop(0, `rgba(40,0,10,${Math.min(0.8, (me.swell - 0.25) * 1.3)})`); g.addColorStop(0.6, 'rgba(40,0,10,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (me.down) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, w, h); }
    Render.vignette(ctx, w, h, 0.5);
  }
}
