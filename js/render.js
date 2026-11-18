'use strict';
/* ===== Rendering procedurale: pugili, persone, scenari ===== */
const Render = {
  /* IK a due ossa: restituisce gomito/ginocchio e punto finale */
  ik(sx, sy, tx, ty, l1, l2, bend) {
    let dx = tx - sx, dy = ty - sy;
    let d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.002;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    if (d < 0.06) d = 0.06;
    const a = Math.atan2(dy, dx);
    const cb = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const b = Math.acos(U.clamp(cb, -1, 1));
    const ang = a + b * bend;
    return { ex: sx + Math.cos(ang) * l1, ey: sy + Math.sin(ang) * l1, hx: sx + dx, hy: sy + dy };
  },
  seg(ctx, x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  },

  defaultPose() {
    return { bx: 0, by: 0, lean: 0.08, hx: 0, hy: 0, lg: [0.2, -0.13], rg: [0.13, -0.16], st: 0.27, flx: 0, fly: 0, frx: 0, fry: 0, rot: 0, lift: 0 };
  },
  lerpPose(cur, tgt, k) {
    for (const key in tgt) {
      const v = tgt[key];
      if (Array.isArray(v)) { cur[key][0] += (v[0] - cur[key][0]) * k; cur[key][1] += (v[1] - cur[key][1]) * k; }
      else cur[key] += (v - cur[key]) * k;
    }
  },
  copyPose(p) { return JSON.parse(JSON.stringify(p)); },

  /* Disegna una persona in coordinate locali (piedi all'origine, unità = metri, rivolta a destra) */
  person(ctx, L, P, D) {
    D = D || {};
    const bulk = L.bulk || 1;
    const skin = L.skin, skinD = U.shade(skin, -0.28), skinL = U.shade(skin, 0.12);
    const hip = { x: P.bx, y: -0.86 + P.by };
    const sl = Math.sin(P.lean), cl = Math.cos(P.lean);
    const at = (a, b) => ({ x: hip.x + sl * a + cl * b * bulk, y: hip.y - cl * a + sl * b * bulk });
    const neck = at(0.56, 0.02);
    const head = { x: neck.x + sl * 0.14 + P.hx, y: neck.y - cl * 0.14 + P.hy };
    const lsh = at(0.47, 0.05), rsh = at(0.47, -0.07);
    const fL = { x: P.st + P.flx, y: -P.fly }, fR = { x: -P.st + P.frx, y: -P.fry };
    const hL = at(0.02, 0.04), hR = at(0.02, -0.05);
    const kL = this.ik(hL.x, hL.y, fL.x, fL.y, 0.46, 0.45, -1);
    const kR = this.ik(hR.x, hR.y, fR.x, fR.y, 0.46, 0.45, -1);
    const aL = this.ik(lsh.x, lsh.y, lsh.x + P.lg[0], lsh.y + P.lg[1], 0.28, 0.28, 1);
    const aR = this.ik(rsh.x, rsh.y, rsh.x + P.rg[0], rsh.y + P.rg[1], 0.28, 0.28, 1);
    const pants = L.bottom !== 'shorts';
    const legCol = pants ? L.pantsColor : skin;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const drawLeg = (h, k, f, dark) => {
      const c = dark ? U.shade(legCol, -0.25) : legCol;
      this.seg(ctx, h.x, h.y, k.ex, k.ey, (pants ? 0.15 : 0.13) * bulk, c);
      this.seg(ctx, k.ex, k.ey, k.hx, k.hy, (pants ? 0.125 : 0.1) * bulk, c);
      if (!pants) {
        // calzettoni/stivaletti
        const bx = U.lerp(k.hx, k.ex, 0.32), by = U.lerp(k.hy, k.ey, 0.32);
        this.seg(ctx, bx, by, k.hx, k.hy, 0.11 * bulk, dark ? U.shade(L.shoes, -0.2) : L.shoes);
      }
      // scarpa
      ctx.fillStyle = dark ? U.shade(L.shoes, -0.25) : L.shoes;
      ctx.beginPath();
      ctx.moveTo(k.hx - 0.06, k.hy - 0.05);
      ctx.lineTo(k.hx + 0.13, k.hy - 0.035);
      ctx.quadraticCurveTo(k.hx + 0.18, k.hy, k.hx + 0.12, k.hy + 0.01);
      ctx.lineTo(k.hx - 0.07, k.hy + 0.01);
      ctx.closePath(); ctx.fill();
      if (L.bottom === 'jeans' || L.top === 'hoodie') {
        ctx.fillStyle = dark ? '#bbbbbb' : '#ffffff';
        ctx.fillRect(k.hx - 0.07, k.hy - 0.003, 0.19, 0.014);
      }
    };
    const drawArm = (sh, a, dark, lead) => {
      const armSkin = dark ? skinD : skin;
      const sleeveFull = L.top === 'hoodie' || L.top === 'track' || L.top === 'suit';
      const sleeveHalf = L.top === 'tee' || L.top === 'ref';
      const tc = dark ? U.shade(L.topColor, -0.25) : L.topColor;
      const shirtC = L.top === 'ref' ? (dark ? '#cfcfcf' : '#f4f4f4') : tc;
      this.seg(ctx, sh.x, sh.y, a.ex, a.ey, (sleeveFull ? 0.11 : 0.09) * bulk, sleeveFull ? shirtC : armSkin);
      this.seg(ctx, a.ex, a.ey, a.hx, a.hy, (sleeveFull ? 0.095 : 0.078) * bulk, sleeveFull ? shirtC : armSkin);
      if (sleeveHalf) {
        const mx = U.lerp(sh.x, a.ex, 0.6), my = U.lerp(sh.y, a.ey, 0.6);
        this.seg(ctx, sh.x, sh.y, mx, my, 0.115 * bulk, shirtC);
      }
      if (L.top === 'track') {
        ctx.globalAlpha = 0.8;
        this.seg(ctx, sh.x, sh.y - 0.02, a.ex, a.ey - 0.03, 0.02, '#ffffff');
        ctx.globalAlpha = 1;
      }
      const ang = Math.atan2(a.hy - a.ey, a.hx - a.ex);
      if (L.hands === 'gloves') {
        const gc = dark ? U.shade(L.gloves, -0.3) : L.gloves;
        ctx.save(); ctx.translate(a.hx, a.hy); ctx.rotate(ang);
        ctx.fillStyle = L.trim === L.gloves ? U.shade(L.gloves, 0.5) : (dark ? U.shade(L.trim, -0.3) : L.trim);
        ctx.fillRect(-0.1, -0.055, 0.06, 0.11);
        ctx.fillStyle = gc;
        ctx.beginPath(); ctx.ellipse(0.02, 0, 0.095, 0.083, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.ellipse(0.04, -0.035, 0.045, 0.022, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(a.hx, a.hy); ctx.rotate(ang);
        if (L.hands === 'wraps') { ctx.fillStyle = dark ? '#cfcfcf' : '#f2f2f2'; ctx.fillRect(-0.06, -0.04, 0.06, 0.08); }
        ctx.fillStyle = armSkin;
        ctx.beginPath(); ctx.ellipse(0.015, 0, 0.05, 0.045, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    };

    // ombra
    if (!D.noShadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(hip.x * 0.5, 0.01, 0.45 * bulk, 0.06, 0, 0, Math.PI * 2); ctx.fill();
    }
    drawLeg(hR, kR, fR, true);
    drawArm(rsh, aR, true, false);
    drawLeg(hL, kL, fL, false);

    // busto
    const pts = [at(0.02, -0.12), at(0.22, -0.135), at(0.42, -0.125), at(0.53, -0.08), at(0.55, 0.0), at(0.52, 0.08), at(0.42, 0.14), at(0.3, 0.13), at(0.14, 0.1), at(0.02, 0.1)];
    const torsoPath = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); };
    const g1 = at(0.3, -0.14), g2 = at(0.3, 0.14);
    let torsoCol = skin;
    if (L.top !== 'none') torsoCol = L.top === 'ref' ? '#f4f4f4' : L.topColor;
    const grad = ctx.createLinearGradient(g1.x, g1.y, g2.x, g2.y);
    grad.addColorStop(0, U.shade(torsoCol.startsWith('#') ? torsoCol : '#888888', -0.25));
    grad.addColorStop(0.65, torsoCol);
    grad.addColorStop(1, U.shade(torsoCol.startsWith('#') ? torsoCol : '#888888', 0.1));
    torsoPath(); ctx.fillStyle = grad; ctx.fill();
    if (L.top === 'tank') {
      // spalle scoperte
      ctx.fillStyle = skin;
      ctx.beginPath(); const s1 = at(0.4, -0.13), s2 = at(0.55, -0.04), s3 = at(0.55, 0.05), s4 = at(0.42, 0.13), s5 = at(0.47, 0.0);
      ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(s5.x, s5.y); ctx.lineTo(s3.x, s3.y); ctx.lineTo(s4.x, s4.y); ctx.quadraticCurveTo(s5.x, s5.y + 0.05, s1.x, s1.y); ctx.fill();
    }
    if (L.top === 'none') {
      // muscolatura accennata
      ctx.strokeStyle = U.alpha('#000000', 0.16); ctx.lineWidth = 0.012;
      const p1 = at(0.38, 0.13), p2 = at(0.33, 0.02), p3 = at(0.36, -0.06);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const q1 = at(0.12 + i * 0.07, 0.1), q2 = at(0.12 + i * 0.07, 0.03);
        ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
      }
      if (D.sweat > 0.2) { torsoPath(); ctx.fillStyle = `rgba(255,255,255,${D.sweat * 0.08})`; ctx.fill(); }
      if (D.bodyDmg > 0.25) {
        ctx.fillStyle = `rgba(150,20,30,${(D.bodyDmg - 0.25) * 0.5})`;
        const c = at(0.2, 0.06); ctx.beginPath(); ctx.ellipse(c.x, c.y, 0.07, 0.09, P.lean, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (L.top === 'hoodie') {
      ctx.fillStyle = U.shade(L.topColor, -0.2);
      const hb = at(0.56, -0.12); ctx.beginPath(); ctx.ellipse(hb.x, hb.y, 0.09, 0.06, P.lean, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = U.shade(L.topColor, -0.3); ctx.lineWidth = 0.012;
      const z1 = at(0.5, 0.11), z2 = at(0.05, 0.1); ctx.beginPath(); ctx.moveTo(z1.x, z1.y); ctx.lineTo(z2.x, z2.y); ctx.stroke();
    }
    if (L.top === 'suit') {
      ctx.fillStyle = '#f4f4f4'; const c1 = at(0.54, 0.06), c2 = at(0.36, 0.12), c3 = at(0.52, 0.1);
      ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.fill();
    }
    if (L.top === 'ref') {
      ctx.fillStyle = '#111111'; const bt = at(0.53, 0.09);
      ctx.beginPath(); ctx.moveTo(bt.x - 0.03, bt.y - 0.02); ctx.lineTo(bt.x + 0.03, bt.y + 0.02); ctx.lineTo(bt.x + 0.03, bt.y - 0.02); ctx.lineTo(bt.x - 0.03, bt.y + 0.02); ctx.fill();
    }

    // pantaloncini o cintura
    if (!pants) {
      const sc = L.shorts;
      for (const [h, k] of [[hR, kR], [hL, kL]]) {
        const mx = U.lerp(h.x, k.ex, 0.6), my = U.lerp(h.y, k.ey, 0.6);
        this.seg(ctx, h.x, h.y, mx, my, 0.2 * bulk, h === hR ? U.shade(sc, -0.2) : sc);
      }
      ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(P.lean * 0.6);
      ctx.fillStyle = sc; ctx.fillRect(-0.15 * bulk, -0.1, 0.29 * bulk, 0.17);
      ctx.fillStyle = L.trim; ctx.fillRect(-0.15 * bulk, -0.12, 0.29 * bulk, 0.05);
      ctx.fillStyle = U.alpha('#000000', 0.15); ctx.fillRect(-0.15 * bulk, -0.07, 0.29 * bulk, 0.01);
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(P.lean * 0.6);
      ctx.fillStyle = L.pantsColor; ctx.fillRect(-0.15 * bulk, -0.08, 0.28 * bulk, 0.15);
      if (L.bottom === 'jeans') { ctx.fillStyle = '#5a3b1c'; ctx.fillRect(-0.15 * bulk, -0.09, 0.28 * bulk, 0.03); }
      ctx.restore();
    }

    // collo e testa
    this.seg(ctx, neck.x - sl * 0.04, neck.y + cl * 0.04, head.x - 0.01, head.y + 0.05, 0.1 * bulk, skin);
    this.head(ctx, L, head.x, head.y, D);
    drawArm(lsh, aL, false, true);
    return { head, gL: { x: aL.hx, y: aL.hy }, gR: { x: aR.hx, y: aR.hy }, chest: at(0.3, 0.12) };
  },

  head(ctx, L, x, y, D) {
    const r = 0.112, skin = L.skin, skinD = U.shade(skin, -0.25);
    // capelli dietro (afro, codino)
    ctx.fillStyle = L.hairColor;
    if (L.hair === 6) { ctx.beginPath(); ctx.arc(x - 0.025, y - 0.035, r * 1.32, 0, Math.PI * 2); ctx.fill(); }
    if (L.hair === 4) { ctx.beginPath(); ctx.arc(x - 0.12, y - 0.06, 0.04, 0, Math.PI * 2); ctx.fill(); }
    // mascella
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(x + 0.03, y + 0.055, 0.078, 0.055, 0.15, 0, Math.PI * 2); ctx.fill();
    // cranio
    const g = ctx.createRadialGradient(x + 0.04, y - 0.04, 0.01, x, y, r * 1.1);
    g.addColorStop(0, U.shade(skin, 0.1)); g.addColorStop(1, U.shade(skin, -0.12));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // naso
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.moveTo(x + 0.095, y - 0.02); ctx.lineTo(x + 0.138, y + 0.035); ctx.lineTo(x + 0.1, y + 0.045); ctx.closePath(); ctx.fill();
    // orecchio
    ctx.fillStyle = skinD; ctx.beginPath(); ctx.ellipse(x - 0.015, y + 0.012, 0.022, 0.032, 0, 0, Math.PI * 2); ctx.fill();
    // capelli
    ctx.fillStyle = L.hairColor;
    switch (L.hair) {
      case 0: ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x, y, r * 1.01, Math.PI * 0.95, Math.PI * 2.08); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; break;
      case 1: ctx.beginPath(); ctx.arc(x, y - 0.005, r * 1.06, Math.PI * 0.88, Math.PI * 2.1); ctx.lineTo(x + 0.07, y - 0.055); ctx.lineTo(x - 0.05, y - 0.02); ctx.lineTo(x - 0.09, y + 0.04); ctx.closePath(); ctx.fill(); break;
      case 2: for (let i = 0; i < 9; i++) { const a = Math.PI * (0.9 + i * 0.14); ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95, 0.038, 0, Math.PI * 2); ctx.fill(); } break;
      case 3: ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(x, y, r * 1.01, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(x - 0.1, y - 0.04); ctx.quadraticCurveTo(x - 0.03, y - 0.2, x + 0.08, y - 0.11); ctx.lineTo(x + 0.06, y - 0.08); ctx.quadraticCurveTo(x - 0.02, y - 0.14, x - 0.08, y - 0.02); ctx.fill(); break;
      case 4: ctx.beginPath(); ctx.arc(x, y - 0.005, r * 1.04, Math.PI * 0.9, Math.PI * 2.05); ctx.lineTo(x + 0.06, y - 0.06); ctx.lineTo(x - 0.09, y + 0.02); ctx.closePath(); ctx.fill(); break;
      case 5: ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(x + 0.02, y - 0.07, 0.04, 0.018, -0.3, 0, Math.PI * 2); ctx.fill(); break;
      case 6: break;
    }
    if (L.age) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + 0.03, y - 0.04, 0.05, 0.006); }
    // occhio e sopracciglio
    const sw = D.swell || 0;
    ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(x + 0.068, y - 0.012, 0.016, 0.011 * (1 - sw * 0.7), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(x + 0.077, y - 0.012, 0.007 * (1 - sw * 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = L.hair === 5 || L.hair === 0 ? U.shade(L.hairColor, 0.1) : L.hairColor; ctx.lineWidth = 0.013;
    ctx.beginPath(); ctx.moveTo(x + 0.045, y - 0.038); ctx.lineTo(x + 0.093, y - 0.033); ctx.stroke();
    if (D.blink) { ctx.fillStyle = skin; ctx.fillRect(x + 0.05, y - 0.025, 0.04, 0.025); }
    // bocca / paradenti
    ctx.strokeStyle = L.bottom === 'shorts' && L.hands === 'gloves' ? (L.mouth || '#e8e8e8') : '#5a2a22';
    ctx.lineWidth = L.bottom === 'shorts' && L.hands === 'gloves' ? 0.016 : 0.009;
    ctx.beginPath(); ctx.moveTo(x + 0.07, y + 0.07); ctx.lineTo(x + 0.105, y + 0.068); ctx.stroke();
    // barba
    if (L.beard) {
      ctx.fillStyle = L.hairColor;
      if (L.beard === 1) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(x + 0.04, y + 0.07, 0.07, 0.04, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      if (L.beard === 2) { ctx.beginPath(); ctx.ellipse(x + 0.03, y + 0.075, 0.08, 0.045, 0.15, 0, Math.PI); ctx.fill(); ctx.fillRect(x - 0.03, y + 0.02, 0.02, 0.06); ctx.fillRect(x + 0.07, y + 0.05, 0.045, 0.012); }
      if (L.beard === 3) { ctx.fillRect(x + 0.065, y + 0.05, 0.05, 0.013); }
      if (L.beard === 4) { ctx.beginPath(); ctx.ellipse(x + 0.085, y + 0.095, 0.026, 0.022, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 0.07, y + 0.052, 0.04, 0.011); }
    }
    // danni
    if (sw > 0.05) {
      ctx.fillStyle = `rgba(120,40,70,${Math.min(0.75, sw * 0.9)})`;
      ctx.beginPath(); ctx.ellipse(x + 0.068, y - 0.005, 0.02 + sw * 0.022, 0.015 + sw * 0.02, 0, 0, Math.PI * 2); ctx.fill();
    }
    if ((D.cut || 0) > 10) {
      const c = Math.min(1, D.cut / 100);
      ctx.strokeStyle = '#b3001b'; ctx.lineWidth = 0.01;
      ctx.beginPath(); ctx.moveTo(x + 0.05, y - 0.05); ctx.lineTo(x + 0.09, y - 0.045); ctx.stroke();
      ctx.fillStyle = `rgba(179,0,27,${0.4 + c * 0.5})`;
      ctx.fillRect(x + 0.085, y - 0.045, 0.008, 0.03 + c * 0.05);
    }
    if (D.headgear) {
      ctx.strokeStyle = D.headgear; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.arc(x - 0.005, y - 0.005, r * 1.05, Math.PI * 0.75, Math.PI * 2.02); ctx.stroke();
      ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(x + 0.02, y + 0.09); ctx.lineTo(x - 0.03, y + 0.03); ctx.stroke();
    }
  },

  /* Disegna una persona sullo schermo */
  drawAt(ctx, look, pose, sx, sy, S, facing, D) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(S * facing * (look.size || 1), S * (look.size || 1));
    if (pose.rot) ctx.rotate(pose.rot);
    if (pose.lift) ctx.translate(0, -pose.lift);
    const out = this.person(ctx, look, pose, D);
    ctx.restore();
    return out;
  },

  /* ===== Scenari ===== */
  crowdCache: {},
  crowd(key, rows, perRow, seed) {
    if (this.crowdCache[key]) return this.crowdCache[key];
    const r = U.seeded(seed);
    const list = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < perRow; j++) {
        list.push({ row: i, x: (j + r() * 0.6) / perRow, h: 0.85 + r() * 0.3, ph: r() * 6.28, c: Math.floor(r() * 5), sk: Math.floor(r() * SKINS.length), arms: r() });
      }
    }
    this.crowdCache[key] = list;
    return list;
  },
  drawCrowd(ctx, list, w, top, bottom, rows, S, camX, t, excite, tint) {
    const cols = ['#2a2a35', '#3a2a2a', '#25303a', '#33302a', '#2c2c2c'];
    for (const p of list) {
      const rowT = p.row / Math.max(1, rows - 1);
      const y = U.lerp(bottom, top, rowT);
      const sc = S * (0.55 - rowT * 0.28);
      const span = w * 1.8;
      let x = ((p.x * span - camX * S * (0.35 - rowT * 0.15)) % span + span) % span - span * 0.2;
      const bob = Math.sin(t * (3 + excite * 5) + p.ph) * sc * 0.04 * (0.3 + excite);
      const by = y + bob;
      const dim = 0.35 + 0.4 * (1 - rowT);
      ctx.fillStyle = U.shade(cols[p.c], -0.1 + (tint || 0));
      ctx.globalAlpha = dim;
      ctx.fillRect(x - sc * 0.2, by - sc * 0.55 * p.h, sc * 0.4, sc * 0.6);
      ctx.beginPath(); ctx.arc(x, by - sc * 0.7 * p.h, sc * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = U.shade(SKINS[p.sk], -0.45); ctx.fill();
      if (excite > 0.55 && p.arms > 1.25 - excite) {
        ctx.strokeStyle = U.shade(SKINS[p.sk], -0.45); ctx.lineWidth = sc * 0.08;
        ctx.beginPath(); ctx.moveTo(x - sc * 0.15, by - sc * 0.5); ctx.lineTo(x - sc * 0.25, by - sc * (1.0 + Math.sin(t * 8 + p.ph) * 0.1));
        ctx.moveTo(x + sc * 0.15, by - sc * 0.5); ctx.lineTo(x + sc * 0.25, by - sc * (1.0 + Math.cos(t * 8 + p.ph) * 0.1)); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },

  ringGeom(w, gy, S, camX) {
    const sx = (wx) => w / 2 + (wx - camX) * S;
    const back = gy - S * 0.32, front = gy + S * 0.34;
    return { sx, back, front, bl: w / 2 + ((-3.05 - camX) * S) * 0.93, br: w / 2 + ((3.05 - camX) * S) * 0.93, fl: sx(-3.3), fr: sx(3.3) };
  },

  venueBack(ctx, venue, w, h, gy, S, camX, t, excite, flashes) {
    if (venue === 'street') return this.street(ctx, w, h, gy, S, camX, t, excite);
    if (venue === 'home') return this.home(ctx, w, h, gy, S, camX, t);
    if (venue === 'locker') return this.locker(ctx, w, h, gy, S, camX, t);
    const g = this.ringGeom(w, gy, S, camX);
    if (venue === 'gym' || venue === 'gymfloor') {
      const wg = ctx.createLinearGradient(0, 0, 0, g.back);
      wg.addColorStop(0, '#26262c'); wg.addColorStop(1, '#3d3a3a');
      ctx.fillStyle = wg; ctx.fillRect(0, 0, w, g.back + 2);
      const px = -camX * S * 0.4;
      // mattoni
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      const bh = S * 0.16;
      for (let y = g.back - bh, r = 0; y > -bh; y -= bh, r++) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        for (let x = ((px + (r % 2) * bh) % (bh * 2)) - bh * 2; x < w; x += bh * 2) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke(); }
      }
      // finestre alte
      for (let i = -3; i < 5; i++) {
        const x = w / 2 + px + i * S * 2.2;
        ctx.fillStyle = 'rgba(160,190,230,0.18)'; ctx.fillRect(x, g.back - S * 2.3, S * 1.0, S * 0.5);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(x, g.back - S * 2.3, S * 1.0, S * 0.5);
      }
      // striscione
      const bx = w / 2 + px - S * 1.6;
      ctx.fillStyle = '#7a0f14'; ctx.fillRect(bx, g.back - S * 1.75, S * 3.2, S * 0.38);
      ctx.fillStyle = '#f2b705'; ctx.font = `bold ${S * 0.26}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PALESTRA LEONE', bx + S * 1.6, g.back - S * 1.56);
      // sacchi appesi sullo sfondo
      for (const off of [-4.2, 4.4, 6.5]) {
        const x = w / 2 + px + off * S;
        ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, g.back - S * 1.5); ctx.stroke();
        ctx.fillStyle = '#4a1d1d'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - S * 0.16, g.back - S * 1.5, S * 0.32, S * 0.85, S * 0.08) : ctx.rect(x - S * 0.16, g.back - S * 1.5, S * 0.32, S * 0.85); ctx.fill();
      }
      // poster
      for (const off of [-2.6, 2.4]) {
        const x = w / 2 + px + off * S;
        ctx.fillStyle = '#d8cdb0'; ctx.fillRect(x, g.back - S * 1.2, S * 0.45, S * 0.62);
        ctx.fillStyle = '#7a0f14'; ctx.fillRect(x + S * 0.04, g.back - S * 1.15, S * 0.37, S * 0.12);
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + S * 0.22, g.back - S * 0.82, S * 0.1, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#2a2622'; ctx.fillRect(0, g.back - S * 0.05, w, S * 0.08);
      const cr = this.crowd('gym', 1, 9, 77);
      this.drawCrowd(ctx, cr, w, g.back - S * 0.05, g.back - S * 0.05, 1, S * 1.4, camX, t, excite * 0.6, 0.05);
      if (venue === 'gymfloor') {
        const fg = ctx.createLinearGradient(0, g.back, 0, h);
        fg.addColorStop(0, '#6b4a2c'); fg.addColorStop(1, '#3a2716');
        ctx.fillStyle = fg; ctx.fillRect(0, g.back, w, h - g.back);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) { const y = g.back + (h - g.back) * (i / 6) * (i / 6); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, g.back, w, S * 0.05);
      } else this.ring(ctx, g, w, h, S, '#bfc3c9', ['#c62828', '#f5f5f5', '#1d4ed8'], '#7a0f14', 'PALESTRA LEONE');
    } else {
      // palazzetto / arena
      const arena = venue === 'arena';
      const bg = ctx.createLinearGradient(0, 0, 0, g.back);
      bg.addColorStop(0, arena ? '#05060c' : '#0d0d12'); bg.addColorStop(1, arena ? '#151a2e' : '#1d1b22');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, g.back + 2);
      if (arena) {
        // maxischermo e travi luci
        const px = -camX * S * 0.15;
        ctx.fillStyle = '#0b0b12'; ctx.fillRect(w / 2 - S * 1.4 + px, S * 0.15, S * 2.8, S * 0.9);
        ctx.fillStyle = '#1c2a55'; ctx.fillRect(w / 2 - S * 1.33 + px, S * 0.2, S * 2.66, S * 0.8);
        ctx.fillStyle = '#f2b705'; ctx.font = `bold ${S * 0.3}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('BOXXE WORLD TITLE', w / 2 + px, S * 0.6);
        for (let i = 0; i < 7; i++) {
          const lx = w * (i + 0.5) / 7;
          const a = 0.06 + 0.04 * Math.sin(t * 0.7 + i);
          const gr = ctx.createLinearGradient(lx, 0, w / 2, g.back);
          gr.addColorStop(0, `rgba(200,220,255,${a * 2})`); gr.addColorStop(1, 'rgba(200,220,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(lx - 6, 0); ctx.lineTo(lx + 6, 0); ctx.lineTo(w / 2 + (i - 3) * S * 0.6 + S * 0.4, g.back); ctx.lineTo(w / 2 + (i - 3) * S * 0.6 - S * 0.4, g.back); ctx.fill();
        }
      }
      const rows = arena ? 9 : 6;
      const cr = this.crowd(venue, rows, arena ? 34 : 24, arena ? 991 : 515);
      this.drawCrowd(ctx, cr, w, arena ? S * 1.2 : S * 0.6, g.back - S * 0.05, rows, S * 1.3, camX, t, excite, arena ? 0.05 : 0);
      // flash fotografici
      if (flashes) for (const f of flashes) {
        const gr = ctx.createRadialGradient(f.x * w, f.y * g.back, 0, f.x * w, f.y * g.back, S * 0.25 * f.l);
        gr.addColorStop(0, `rgba(255,255,255,${f.l})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(f.x * w - S * 0.3, f.y * g.back - S * 0.3, S * 0.6, S * 0.6);
      }
      ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, g.back - S * 0.12, w, S * 0.14);
      this.ring(ctx, g, w, h, S, arena ? '#1d3a8a' : '#2b6cb0', arena ? ['#f2b705', '#f5f5f5', '#f2b705'] : ['#c62828', '#f5f5f5', '#c62828'], arena ? '#0b1a44' : '#14213d', arena ? 'BOXXE' : 'BOXXE • NOTTE DI PUGNI');
    }
  },
  ring(ctx, g, w, h, S, canvasCol, ropes, apronCol, text) {
    // pali posteriori e corde
    const postH = S * 1.32;
    ctx.fillStyle = '#d6d6d6';
    ctx.fillRect(g.bl - S * 0.05, g.back - postH, S * 0.1, postH); ctx.fillRect(g.br - S * 0.05, g.back - postH, S * 0.1, postH);
    ropes.forEach((c, i) => {
      const y = g.back - S * (0.42 + i * 0.4);
      ctx.strokeStyle = U.shade(c, -0.25); ctx.lineWidth = Math.max(2, S * 0.035);
      ctx.beginPath(); ctx.moveTo(g.bl, y); ctx.quadraticCurveTo((g.bl + g.br) / 2, y + S * 0.03, g.br, y); ctx.stroke();
    });
    // tappeto
    const fg = ctx.createRadialGradient(w / 2, g.back + (g.front - g.back) * 0.4, S * 0.3, w / 2, g.back, S * 4.5);
    fg.addColorStop(0, U.shade(canvasCol, 0.18)); fg.addColorStop(1, U.shade(canvasCol, -0.35));
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(g.bl, g.back); ctx.lineTo(g.br, g.back); ctx.lineTo(g.fr, g.front); ctx.lineTo(g.fl, g.front); ctx.closePath(); ctx.fill();
    // logo centrale
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${S * 0.42}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate((g.fl + g.fr) / 2, (g.back + g.front) / 2); ctx.scale(1, 0.45); ctx.fillText('BOXXE', 0, 0); ctx.restore();
    // grembiule
    ctx.fillStyle = apronCol; ctx.fillRect(0, g.front, w, h - g.front);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, g.front, w, S * 0.04);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `bold ${S * 0.2}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(text, (g.fl + g.fr) / 2, g.front + S * 0.2);
  },
  venueFront(ctx, venue, w, h, gy, S, camX) {
    if (venue === 'street' || venue === 'home' || venue === 'locker') return;
    const g = this.ringGeom(w, gy, S, camX);
    const postH = S * 1.45;
    for (const x of [g.fl, g.fr]) {
      ctx.fillStyle = '#e0e0e0'; ctx.fillRect(x - S * 0.06, g.front - postH, S * 0.12, postH);
      ctx.fillStyle = venue === 'arena' ? '#f2b705' : '#c62828'; ctx.fillRect(x - S * 0.09, g.front - postH, S * 0.18, S * 0.45);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.max(1.5, S * 0.025);
    for (let i = 0; i < 3; i++) {
      const y = g.front - S * (0.45 + i * 0.42);
      ctx.beginPath(); ctx.moveTo(g.fl, y); ctx.quadraticCurveTo((g.fl + g.fr) / 2, y + S * 0.04, g.fr, y); ctx.stroke();
    }
  },

  street(ctx, w, h, gy, S, camX, t, excite) {
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#070912'); sky.addColorStop(1, '#22172e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const wallTop = gy - S * 2.3, wallBot = gy - S * 0.45;
    // palazzi lontani
    const r = U.seeded(42);
    const px1 = -camX * S * 0.15;
    for (let i = -4; i < 14; i++) {
      const bw = S * (0.8 + r() * 0.8), bh = S * (1.5 + r() * 2.2);
      const x = i * S * 1.1 + px1;
      ctx.fillStyle = '#10121c'; ctx.fillRect(x, wallTop - bh + S * 0.6, bw, bh);
      for (let wy = 0; wy < 6; wy++) for (let wx = 0; wx < 3; wx++) {
        if (r() < 0.35) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,200,120,0.55)' : 'rgba(180,200,255,0.35)'; ctx.fillRect(x + S * 0.1 + wx * S * 0.25, wallTop - bh + S * 0.75 + wy * S * 0.32, S * 0.12, S * 0.16); }
      }
    }
    // muro di mattoni
    const px = -camX * S * 0.6;
    ctx.fillStyle = '#4a2b24'; ctx.fillRect(0, wallTop, w, wallBot - wallTop);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    const bh = S * 0.13;
    for (let y = wallTop, rr = 0; y < wallBot; y += bh, rr++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = ((px + (rr % 2) * bh) % (bh * 2)) - bh * 2; x < w; x += bh * 2) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke(); }
    }
    // graffiti
    ctx.save(); ctx.translate(w / 2 + px - S * 0.5, wallTop + S * 0.9); ctx.rotate(-0.06);
    ctx.font = `bold ${S * 0.55}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText('RIONE SOLE', 4, 4);
    ctx.fillStyle = 'rgba(242,183,5,0.7)'; ctx.fillText('RIONE SOLE', 0, 0);
    ctx.strokeStyle = 'rgba(214,40,40,0.7)'; ctx.lineWidth = 2; ctx.strokeText('RIONE SOLE', 0, 0);
    ctx.restore();
    ctx.save(); ctx.translate(w / 2 + px + S * 3.2, wallTop + S * 1.2); ctx.rotate(0.08);
    ctx.font = `bold ${S * 0.32}px "Bebas Neue", Impact, sans-serif`; ctx.fillStyle = 'rgba(80,180,255,0.5)'; ctx.fillText('NON MOLLARE', 0, 0); ctx.restore();
    // serranda
    const sxx = w / 2 + px - S * 3.6;
    ctx.fillStyle = '#3d4048'; ctx.fillRect(sxx, wallBot - S * 1.4, S * 1.6, S * 1.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let y = wallBot - S * 1.4; y < wallBot; y += S * 0.08) { ctx.beginPath(); ctx.moveTo(sxx, y); ctx.lineTo(sxx + S * 1.6, y); ctx.stroke(); }
    // marciapiede
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(0, wallBot, w, S * 0.16);
    ctx.fillStyle = '#55555d'; ctx.fillRect(0, wallBot + S * 0.14, w, S * 0.05);
    // asfalto
    const ag = ctx.createLinearGradient(0, wallBot, 0, h);
    ag.addColorStop(0, '#1d1d22'); ag.addColorStop(1, '#0e0e11');
    ctx.fillStyle = ag; ctx.fillRect(0, wallBot + S * 0.19, w, h);
    // pozzanghere
    ctx.fillStyle = 'rgba(120,140,200,0.12)';
    ctx.beginPath(); ctx.ellipse(w / 2 - camX * S + S * 1.6, gy + S * 0.25, S * 0.6, S * 0.07, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2 - camX * S - S * 2.3, gy + S * 0.4, S * 0.4, S * 0.05, 0, 0, 7); ctx.fill();
    // lampione
    const lx = w / 2 + (-1.2 - camX) * S * 0.8;
    ctx.fillStyle = '#222'; ctx.fillRect(lx - S * 0.04, wallTop - S * 0.4, S * 0.08, wallBot - wallTop + S * 0.5);
    ctx.fillRect(lx, wallTop - S * 0.4, S * 0.5, S * 0.05);
    const lg = ctx.createRadialGradient(lx + S * 0.5, wallTop - S * 0.3, 0, lx + S * 0.5, gy, S * 3);
    lg.addColorStop(0, 'rgba(255,200,120,0.35)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.arc(lx + S * 0.5, wallTop - S * 0.32, S * 0.06, 0, 7); ctx.fill();
    // curiosi
    const by = U.seeded(7);
    for (let i = 0; i < 9; i++) {
      const wx = -4.5 + i * 1.15 + by() * 0.4;
      if (Math.abs(wx) < 0.8) continue;
      const x = w / 2 + (wx - camX) * S * 0.75;
      const s = S * 0.62;
      const bob = Math.sin(t * (2 + excite * 6) + i) * s * 0.03 * (0.4 + excite);
      ctx.fillStyle = `rgba(10,10,15,0.9)`;
      ctx.fillRect(x - s * 0.17, wallBot - s * 1.25 + bob, s * 0.34, s * 0.8);
      ctx.fillRect(x - s * 0.12, wallBot - s * 0.5, s * 0.1, s * 0.5); ctx.fillRect(x + s * 0.02, wallBot - s * 0.5, s * 0.1, s * 0.5);
      ctx.beginPath(); ctx.arc(x, wallBot - s * 1.42 + bob, s * 0.15, 0, 7); ctx.fill();
      if (excite > 0.5 && i % 2) { ctx.strokeStyle = 'rgba(10,10,15,0.9)'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(x + s * 0.14, wallBot - s * 1.15 + bob); ctx.lineTo(x + s * 0.28, wallBot - s * 1.6 + bob); ctx.stroke(); }
    }
  },
  home(ctx, w, h, gy, S, camX) {
    ctx.fillStyle = '#2e2a33'; ctx.fillRect(0, 0, w, h);
    const px = -camX * S * 0.5;
    ctx.fillStyle = '#3a3440'; for (let x = (px % (S * 0.3)) - S * 0.3; x < w; x += S * 0.3) ctx.fillRect(x, 0, S * 0.12, gy - S * 0.3);
    // finestra
    const wx = w / 2 + px + S * 0.6;
    ctx.fillStyle = '#0c1024'; ctx.fillRect(wx, gy - S * 2.2, S * 1.3, S * 1.0);
    ctx.fillStyle = 'rgba(255,210,140,0.7)'; for (let i = 0; i < 9; i++) ctx.fillRect(wx + S * (0.1 + (i * 0.37) % 1.1), gy - S * (2.0 - (i % 3) * 0.25), S * 0.06, S * 0.08);
    ctx.strokeStyle = '#6b5a48'; ctx.lineWidth = S * 0.06; ctx.strokeRect(wx, gy - S * 2.2, S * 1.3, S * 1.0);
    ctx.beginPath(); ctx.moveTo(wx + S * 0.65, gy - S * 2.2); ctx.lineTo(wx + S * 0.65, gy - S * 1.2); ctx.stroke();
    // poster
    ctx.fillStyle = '#c9b68f'; ctx.fillRect(w / 2 + px - S * 1.6, gy - S * 2.1, S * 0.7, S * 0.95);
    ctx.fillStyle = '#7a0f14'; ctx.font = `bold ${S * 0.16}px "Bebas Neue", Impact`; ctx.textAlign = 'center'; ctx.fillText('IL LEONE', w / 2 + px - S * 1.25, gy - S * 1.95);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(w / 2 + px - S * 1.25, gy - S * 1.55, S * 0.16, 0, 7); ctx.fill();
    // pavimento e letto
    ctx.fillStyle = '#4a3a2c'; ctx.fillRect(0, gy - S * 0.3, w, h);
    ctx.fillStyle = '#5b2424'; ctx.fillRect(w / 2 + px - S * 3.4, gy - S * 0.75, S * 1.8, S * 0.45);
    ctx.fillStyle = '#ddd'; ctx.fillRect(w / 2 + px - S * 3.4, gy - S * 0.85, S * 0.5, S * 0.15);
    const lg = ctx.createRadialGradient(wx + S * 0.65, gy - S * 1.7, 0, wx + S * 0.65, gy - S, S * 3);
    lg.addColorStop(0, 'rgba(120,150,255,0.15)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
  },
  locker(ctx, w, h, gy, S, camX) {
    ctx.fillStyle = '#23282b'; ctx.fillRect(0, 0, w, h);
    const px = -camX * S * 0.5;
    for (let i = -8; i < 12; i++) {
      const x = w / 2 + px + i * S * 0.55;
      ctx.fillStyle = i % 2 ? '#34505a' : '#2f4952'; ctx.fillRect(x, gy - S * 2.4, S * 0.52, S * 2.1);
      ctx.fillStyle = '#1b2a30'; for (let k = 0; k < 4; k++) ctx.fillRect(x + S * 0.1, gy - S * (2.25 - k * 0.06), S * 0.3, S * 0.02);
      ctx.fillStyle = '#9aa'; ctx.fillRect(x + S * 0.42, gy - S * 1.4, S * 0.04, S * 0.15);
    }
    ctx.fillStyle = '#5a4632'; ctx.fillRect(0, gy - S * 0.55, w, S * 0.1);
    ctx.fillStyle = '#3c3c3c'; ctx.fillRect(0, gy - S * 0.3, w, h);
    const lg = ctx.createRadialGradient(w / 2, 0, 0, w / 2, gy, S * 4);
    lg.addColorStop(0, 'rgba(255,250,220,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
  },

  vignette(ctx, w, h, strength = 0.6) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  },
};
