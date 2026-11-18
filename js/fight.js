'use strict';
/* ===== Scena del combattimento ===== */
class FightScene {
  /* cfg: { a, b, aOpts, bOpts, rounds, roundTime, diff, venue, mode, title, tutorial, spar, street, coach, onEnd, cutBonus, rematch } */
  constructor(cfg) {
    this.cfg = cfg;
    const venue = cfg.venue || 'hall';
    this.venue = venue;
    this.ring = venue !== 'street';
    this.sim = new FightSim({
      a: cfg.a, b: cfg.b, aOpts: cfg.aOpts, bOpts: cfg.bOpts,
      rounds: cfg.rounds || 3, roundTime: cfg.roundTime || Save.settings.roundLen,
      kdRule: cfg.street ? 2 : 3, ring: this.ring, spar: !!cfg.spar, street: !!cfg.street,
      dmgScale: cfg.spar ? 0.5 : 1,
    });
    this.sim.a.ctrl = 'player'; this.sim.b.ctrl = 'ai';
    this.ai = new AI(this.sim.b, this.sim.a, cfg.b.style, cfg.diff == null ? Save.settings.difficulty : cfg.diff);
    this.t = 0; this.cam = { x: 0, zoom: 1, shake: 0, sx: 0, sy: 0 };
    this.parts = []; this.excite = 0.25; this.flashes = []; this.flashT = 0;
    this.slow = 0; this.slowScale = 1;
    this.stage = 'intro'; this.stageT = 0; this.paused = false;
    this.sim.phase = 'pre';
    this.ref = { x: 0, pose: Render.defaultPose(), anim: 0, vx: 0 };
    this.hpGhost = { a: 100, b: 100 };
    this.coachName = cfg.coach || 'Il tuo angolo';
    this.buildDom();
    this.showBig(cfg.title || (cfg.street ? 'RISSA IN STRADA' : `${this.sim.a.name.toUpperCase()} vs ${this.sim.b.name.toUpperCase()}`), 'intro', 2.2,
      cfg.street ? 'Nessuna regola. Solo pugni.' : (cfg.spar ? 'Sparring con caschetto' : `${this.sim.cfg.rounds} round • ${VENUES[venue] ? VENUES[venue].name : ''}`));
    Sound.stopMusic(); Sound.startCrowd(); Sound.setCrowd(this.ring ? 0.35 : 0.15);
    if (cfg.tutorial) this.tut = new Tutorial(this);
  }

  /* ===== DOM ===== */
  buildDom() {
    const ui = UI.clear();
    const A = this.sim.a, B = this.sim.b;
    const side = (f, cls) => U.el('div', { class: 'hud-f ' + cls },
      U.el('div', { class: 'hud-name' }, f.name.toUpperCase(), f.nick ? U.el('small', null, ' "' + f.nick + '"') : null),
      U.el('div', { class: 'bar hp' }, U.el('i', { class: 'ghost' }), U.el('i', { class: 'fill' })),
      U.el('div', { class: 'bar st' }, U.el('i', { class: 'fill' }), U.el('i', { class: 'cap' })),
      U.el('div', { class: 'kdots' }));
    this.hudA = side(A, 'hud-a'); this.hudB = side(B, 'hud-b');
    this.clockEl = U.el('div', { class: 'hud-clock' }, '3:00');
    this.rndEl = U.el('div', { class: 'hud-rnd' }, 'R1');
    const pauseBtn = U.el('button', { class: 'hud-pause', onclick: () => this.pause() }, '❚❚');
    this.hud = U.el('div', { class: 'hud' }, this.hudA, U.el('div', { class: 'hud-mid' }, this.rndEl, this.clockEl), this.hudB, pauseBtn);
    this.adv = U.el('div', { class: 'adv' + (Save.settings.advHud || this.cfg.spar ? ' show' : '') });
    this.big = U.el('div', { class: 'bigtext' });
    this.toastEl = U.el('div', { class: 'toasts' });
    this.tipEl = U.el('div', { class: 'tip' });
    this.overlay = U.el('div', { class: 'f-overlay' });
    this.getupEl = U.el('div', { class: 'getup' },
      U.el('div', { class: 'getup-t' }, 'TOCCA RIPETUTAMENTE PER RIALZARTI!'),
      U.el('div', { class: 'getup-bar' }, U.el('i')));
    this.getupEl.addEventListener('pointerdown', (e) => { e.preventDefault(); this.sim.tapGetUp(); U.vibrate(10); Sound.tick(); });
    this.wrap = U.el('div', { class: 'fight-ui' }, this.hud, this.adv, this.big, this.toastEl, this.tipEl, this.getupEl, this.overlay);
    ui.appendChild(this.wrap);
    Controls.mount(this.wrap, { stick: true, punches: true, guard: true, dodge: true }, {
      punch: (t) => this.onPunch(t),
      dodge: () => this.onDodge(),
      pause: () => this.pause(),
      action: (id) => { if (id === 'enter' && this.stage === 'kd') this.sim.tapGetUp(); },
    });
  }
  onPunch(t) {
    const s = this.sim;
    if (s.phase === 'kd' && s.kdInfo && s.kdInfo.who === s.a) { s.tapGetUp(); return; }
    if (this.paused || s.phase !== 'fight') return;
    s.a.intent.down = Controls.st.down;
    s.a.requestPunch(t, null, s);
    if (this.tut) this.tut.onInput('punch', t);
  }
  onDodge() {
    const s = this.sim;
    if (s.phase === 'kd' && s.kdInfo && s.kdInfo.who === s.a) { s.tapGetUp(); return; }
    if (this.paused || s.phase !== 'fight') return;
    s.a.intent.move = Controls.st.move; s.a.intent.down = Controls.st.down;
    s.a.requestDodge(s);
  }
  showBig(text, cls, dur, sub) {
    this.big.innerHTML = '';
    this.big.appendChild(U.el('div', { class: 'big-in ' + (cls || '') }, U.el('div', { class: 'big-main' }, text), sub ? U.el('div', { class: 'big-sub' }, sub) : null));
    this.bigT = dur || 1.2;
  }
  toast(text, cls) {
    const e = U.el('div', { class: 'toast ' + (cls || '') }, text);
    this.toastEl.appendChild(e);
    setTimeout(() => e.remove(), 1100);
    while (this.toastEl.children.length > 3) this.toastEl.firstChild.remove();
  }
  tip(who, text, dur = 4) {
    this.tipEl.innerHTML = '';
    if (!text) { this.tipEl.classList.remove('show'); return; }
    this.tipEl.appendChild(U.el('div', { class: 'tip-who' }, who));
    this.tipEl.appendChild(U.el('div', { class: 'tip-txt' }, text));
    this.tipEl.classList.add('show');
    this.tipT = dur;
  }

  pause() {
    if (this.paused || this.stage === 'over' || this.stage === 'results') return;
    this.paused = true;
    const close = () => { this.paused = false; this.overlay.innerHTML = ''; this.overlay.classList.remove('show'); };
    const box = U.el('div', { class: 'panel' },
      U.el('h2', null, 'PAUSA'),
      UI.btn('Riprendi', close, 'primary'),
      UI.btn('Comandi', () => { UI.controlsHelp(this.overlay, () => this.pauseReopen()); }),
      this.cfg.mode === 'story' && !this.cfg.allowQuit ? null : UI.btn(this.cfg.mode === 'career' ? 'Ritirati (sconfitta)' : 'Abbandona', () => {
        close();
        if (this.cfg.mode === 'career' || this.cfg.mode === 'story') this.sim.finish(this.sim.b, 'RTD', 'Ritiro all\'angolo');
        else this.exit();
      }, 'danger'));
    this.overlay.innerHTML = ''; this.overlay.appendChild(box); this.overlay.classList.add('show');
  }
  pauseReopen() { this.paused = false; this.pause(); }
  exit() {
    this.destroy();
    if (this.cfg.onExit) this.cfg.onExit(); else UI.mainMenu();
  }
  destroy() {
    Controls.unmount();
    Sound.stopCrowd();
  }

  /* ===== Ciclo ===== */
  layout(w, h) {
    const portrait = h > w * 1.05;
    if (portrait) {
      const ctrlH = U.clamp(h * 0.36, 210, 330) * Save.settings.ctrlSize;
      const area = h - ctrlH;
      return { portrait, ctrlH, gy: area * 0.8, S: Math.min(w / 3.9, area / 2.45) };
    }
    return { portrait, ctrlH: 0, gy: h * 0.8, S: Math.min(w / 6.2, h / 2.55) };
  }
  update(dt) {
    if (this.paused) return;
    this.t += dt;
    const rdt = dt;
    if (this.slow > 0) { this.slow -= dt; dt *= this.slowScale; }
    const s = this.sim, A = s.a;
    this.stageT += dt;
    // input giocatore
    if (s.phase === 'fight') {
      A.intent.move = Controls.st.move;
      A.intent.down = Controls.st.down;
      A.intent.guard = Controls.guard;
      if (this.tut) this.tut.filterInput();
    } else { A.intent.move = 0; A.intent.guard = false; }
    if (this.stage === 'intro' && this.stageT > 2.4) this.startRound();
    if (this.stage === 'roundIntro' && this.stageT > 1.3) { s.phase = 'fight'; this.stage = 'fight'; Sound.bell(1); this.showBig('BOX!', 'box', 0.8); if (this.tut) this.tut.start(); }
    if (s.phase === 'fight' || s.phase === 'kd' || s.phase === 'clinch') this.ai.update(dt, s);
    s.step(dt);
    this.handleEvents();
    if (this.tut) this.tut.update(dt);
    this.updateRef(dt);
    this.updateCam(dt);
    this.updateParts(dt);
    this.updateHud(dt);
    if (this.breakDelay != null) { this.breakDelay -= rdt; if (this.breakDelay <= 0) { this.breakDelay = null; this.showBreak(); } }
    if (this.endDelay != null) { this.endDelay -= rdt; if (this.endDelay <= 0) { this.endDelay = null; this.showResults(); } }
    if (this.bigT > 0) { this.bigT -= rdt; if (this.bigT <= 0) this.big.innerHTML = ''; }
    if (this.tipT > 0) { this.tipT -= rdt; if (this.tipT <= 0) this.tipEl.classList.remove('show'); }
    this.excite = U.damp(this.excite, 0.25 + (s.a.wobbled || s.b.wobbled ? 0.35 : 0), 0.8, dt);
    Sound.setCrowd((this.ring ? 0.3 : 0.12) + this.excite * 0.6);
    if (this.venue === 'arena' || this.venue === 'hall') {
      if (Math.random() < dt * (1 + this.excite * 10)) this.flashes.push({ x: Math.random(), y: 0.25 + Math.random() * 0.6, l: 1 });
      this.flashes.forEach(f => f.l -= dt * 6); this.flashes = this.flashes.filter(f => f.l > 0);
    }
    if (this.flashT > 0) this.flashT -= dt;
  }
  startRound() {
    this.stage = 'roundIntro'; this.stageT = 0;
    const s = this.sim;
    const label = this.cfg.street ? 'VIA!' : (s.round === s.cfg.rounds && s.cfg.rounds > 1 ? 'ULTIMO ROUND' : 'ROUND ' + s.round);
    this.showBig(label, 'round', 1.3);
    this.overlay.innerHTML = ''; this.overlay.classList.remove('show');
  }
  handleEvents() {
    const s = this.sim;
    for (const e of s.events) {
      const playerAtt = e.att === s.a, playerDef = e.def === s.a;
      switch (e.type) {
        case 'hit': {
          const pw = U.clamp(e.dmg / 9, 0.15, 1.2);
          Sound.punch(pw, e.body);
          this.spawnHit(e.def, e.body, pw, false);
          this.cam.shake = Math.max(this.cam.shake, pw * (e.counter ? 9 : 5));
          this.excite = Math.min(1, this.excite + pw * 0.15 + (e.counter ? 0.1 : 0));
          if (playerDef) U.vibrate(e.dmg > 6 ? 40 : 18); else if (playerAtt) U.vibrate(8);
          if (e.counter && e.dmg > 5) this.toast(playerAtt ? 'CONTROPIEDE!' : 'TI HA ANTICIPATO', playerAtt ? 'good' : 'bad');
          else if (e.crit) this.toast(playerAtt ? 'COLPO PULITO!' : 'COLPO DURO', playerAtt ? 'good' : 'bad');
          if (e.wobble && !this.wobbleToast) { this.wobbleToast = 2; this.toast(e.def === s.a ? 'SEI SCOSSO!' : 'BARCOLLA!', e.def === s.a ? 'bad' : 'good'); Sound.cheer(0.8); }
          if (e.dmg > 7 && pw > 0.9) { this.slow = 0.12; this.slowScale = 0.35; }
          break;
        }
        case 'block': Sound.block(); this.spawnHit(e.def, e.body, 0.2, true); break;
        case 'miss': Sound.whoosh(); break;
        case 'evade':
          Sound.whoosh();
          if (playerDef) { this.toast(e.perfect ? 'SCHIVATA PERFETTA!' : 'SCHIVATA', 'good'); if (e.perfect) { this.slow = 0.35; this.slowScale = 0.3; } }
          break;
        case 'guardbreak': this.toast(e.f === s.a ? 'GUARDIA SFONDATA!' : 'GUARDIA ROTTA!', e.f === s.a ? 'bad' : 'good'); Sound.punch(0.7); break;
        case 'clinch': this.toast('CLINCH'); break;
        case 'break': this.toast('BREAK!'); break;
        case 'sparstop': this.toast('STOP! RIFIATA', 'bad'); break;
        case 'kd':
          Sound.thud(); Sound.cheer(1.2); this.excite = 1; this.flashT = 0.25;
          this.slow = 0.9; this.slowScale = 0.25;
          this.showBig(e.f === s.a ? 'SEI AL TAPPETO!' : 'AL TAPPETO!', 'kd', 1.6);
          U.vibrate([60, 40, 120]);
          this.stage = 'kd';
          break;
        case 'count':
          if (e.n > 0) { this.showBig(String(e.n), 'count', 0.9); Sound.tone(e.n >= 8 ? 220 : 180, 0.12, 'square', 0.08); }
          break;
        case 'resume': this.showBig('BOX!', 'box', 0.8); this.stage = 'fight'; break;
        case 'bell':
          Sound.bell(this.sim.round >= this.sim.cfg.rounds ? 3 : 2);
          if (!this.cfg.street) this.showBig('FINE ROUND ' + e.round, 'round', 1.4);
          break;
        case 'break_start': this.breakDelay = 1.4; this.stage = 'break'; break;
        case 'end': {
          const r = e.result;
          this.stage = 'over';
          this.slow = 1.6; this.slowScale = 0.3;
          let label = r.method === 'KO' ? 'K.O.!' : r.method === 'TKO' ? 'K.O. TECNICO' : r.method === 'RTD' ? 'RITIRO' : (r.method === 'SPAR' ? 'FINE SPARRING' : 'VERDETTO');
          if (this.cfg.street && r.method === 'PTS') label = 'FINITA!';
          if (this.cfg.street && r.method === 'STOP') label = 'BASTA COSÌ!';
          this.showBig(label, r.method === 'KO' || r.method === 'TKO' ? 'kd' : 'round', 2.4);
          Sound.bell(4); Sound.cheer(1.4); this.excite = 1;
          this.endDelay = r.method === 'KO' || r.method === 'TKO' ? 3.2 : 2.2;
          break;
        }
      }
    }
    s.events.length = 0;
    if (this.wobbleToast > 0) { this.wobbleToast -= 1 / 60; }
    else if (!s.a.wobbled && !s.b.wobbled) this.wobbleToast = 0;
  }
  spawnHit(D, body, pw, blocked) {
    const L = this.L || this.layout(Game.w, Game.h);
    const S = L.S * this.cam.zoom;
    const x = this.sx(D.x + D.facing * 0.12), y = L.gy - S * D.look.size * (body ? 1.08 : 1.55);
    const n = Math.round(4 + pw * 10);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 220) * (0.5 + pw);
      this.parts.push({ x, y, vx: Math.cos(a) * v + D.facing * -80, vy: Math.sin(a) * v - 60, life: 0.35 + Math.random() * 0.3, max: 0.6, c: blocked ? '#ffffff' : (Math.random() < 0.6 ? '#bfe3ff' : '#ffffff'), r: 1.5 + Math.random() * 2.5 });
    }
    if (!blocked && D.cut > 30 && Math.random() < 0.6) for (let i = 0; i < 5; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 150, life: 0.6, max: 0.6, c: '#b3001b', r: 2 + Math.random() * 2, g: 1 });
    this.parts.push({ ring: true, x, y, life: 0.18, max: 0.18, r: S * (blocked ? 0.12 : 0.18 + pw * 0.15), c: blocked ? 'rgba(255,255,255,0.7)' : 'rgba(255,240,200,0.9)' });
  }
  updateParts(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ? 900 : 500) * dt; p.vx *= 0.96; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    // sudore quando stanchi
    for (const f of [this.sim.a, this.sim.b]) {
      if (f.stamR < 0.35 && Math.random() < dt * 4 && this.L) {
        const S = this.L.S * this.cam.zoom;
        this.parts.push({ x: this.sx(f.x), y: this.L.gy - S * 1.6, vx: (Math.random() - 0.5) * 60, vy: -40, life: 0.6, max: 0.6, c: '#cfe8ff', r: 1.5, g: 1 });
      }
    }
  }
  updateRef(dt) {
    if (!this.ring) return;
    const s = this.sim, R = this.ref;
    R.anim += dt;
    const mid = (s.a.x + s.b.x) / 2;
    // l'arbitro resta di lato, dalla parte con più spazio
    if (R.side == null || Math.abs(mid + R.side * 1.5) > s.lim - 0.2) R.side = mid > 0 ? -1 : 1;
    let tx = U.clamp(mid + R.side * 1.5, -s.lim + 0.2, s.lim - 0.2);
    if (s.phase === 'kd' && s.kdInfo) tx = s.kdInfo.who.x - s.kdInfo.who.side * 0.8;
    R.vx = U.damp(R.vx, U.clamp((tx - R.x) * 3, -1.5, 1.5), 6, dt);
    R.x += R.vx * dt;
    const P = Render.defaultPose();
    P.lg = [0.05, 0.3]; P.rg = [0.0, 0.3]; P.lean = 0.05; P.by = 0;
    if (Math.abs(R.vx) > 0.15) { const ph = R.anim * 9; P.flx = Math.sin(ph) * 0.08; P.frx = -Math.sin(ph) * 0.08; P.fly = Math.max(0, Math.sin(ph)) * 0.04; P.fry = Math.max(0, -Math.sin(ph)) * 0.04; }
    if (s.phase === 'kd' && s.kdInfo && s.kdInfo.count > 0) {
      const ph = ((s.kdInfo.t - 1.2) % 0.95) / 0.95;
      P.lg = [0.35, -0.2 + Math.sin(ph * Math.PI) * 0.35]; P.lean = 0.25; P.by = 0.08;
    }
    if (s.phase === 'clinch') { P.lg = [0.3, -0.05]; P.rg = [0.25, 0.0]; }
    if (s.phase === 'over' && s.result && s.result.winner) { P.lg = [0.0, -0.55]; }
    Render.lerpPose(R.pose, P, 1 - Math.exp(-10 * dt));
  }
  updateCam(dt) {
    const s = this.sim;
    let tx = (s.a.x + s.b.x) / 2, tz = U.clamp(1.22 - (s.dist() - 1) * 0.14, 0.92, 1.22);
    if (s.phase === 'kd' && s.kdInfo) { tx = U.lerp(tx, s.kdInfo.who.x, 0.4); tz = 1.18; }
    if (this.stage === 'over' && s.result && s.result.winner) { const W = s.result.winner === 'a' ? s.a : s.b; tx = W.x; tz = 1.3; }
    tx = U.clamp(tx, -2.0, 2.0);
    this.cam.x = U.damp(this.cam.x, tx, 4, dt);
    this.cam.zoom = U.damp(this.cam.zoom, tz, 2.5, dt);
    this.cam.shake = U.damp(this.cam.shake, 0, 10, dt);
    this.cam.sx = (Math.random() - 0.5) * this.cam.shake; this.cam.sy = (Math.random() - 0.5) * this.cam.shake;
  }
  sx(wx) { const L = this.L; return Game.w / 2 + (wx - this.cam.x) * L.S * this.cam.zoom; }
  updateHud(dt) {
    const s = this.sim;
    const set = (hud, f, key) => {
      const hp = U.clamp(f.head / 100, 0, 1);
      this.hpGhost[key] = U.damp(this.hpGhost[key], hp, 1.6, dt);
      if (this.hpGhost[key] < hp) this.hpGhost[key] = hp;
      const bars = hud.querySelectorAll('.bar i');
      bars[0].style.width = (this.hpGhost[key] * 100) + '%';
      bars[1].style.width = (hp * 100) + '%';
      bars[1].className = 'fill' + (f.wobbled ? ' wob' : '') + (hp < 0.3 ? ' low' : '');
      bars[2].style.width = U.clamp(f.stam, 0, 100) + '%';
      bars[3].style.width = (100 - f.stamMax) + '%';
      const kd = hud.querySelector('.kdots');
      if (kd.dataset.n !== String(f.kd)) { kd.dataset.n = f.kd; kd.innerHTML = '●'.repeat(f.kd); }
    };
    set(this.hudA, s.a, 'a'); set(this.hudB, s.b, 'b');
    const disp = s.cfg.roundTime > 0 ? 180 * (1 - s.clock / s.cfg.roundTime) : 0;
    this.clockEl.textContent = U.fmtClock(disp);
    this.clockEl.classList.toggle('hurry', disp <= 10 && s.phase === 'fight');
    this.rndEl.textContent = this.cfg.street ? 'STRADA' : ('R' + s.round + '/' + s.cfg.rounds);
    if (this.adv.classList.contains('show')) {
      const f = (F) => `Testa ${Math.round(F.head)}/${Math.round(F.headMax)} · Corpo ${Math.round(F.body)} · Fiato ${Math.round(F.stam)}/${Math.round(F.stamMax)} · Stordim. ${Math.round(F.stun)}${F.cut > 5 ? ' · Taglio ' + Math.round(F.cut) : ''}`;
      const ra = s.cur.a, rb = s.cur.b;
      this.adv.innerHTML = `<div>${f(s.a)}<br>Round: ${ra.landed}/${ra.thrown} a segno · contro ${ra.counters}</div><div>${f(s.b)}<br>Round: ${rb.landed}/${rb.thrown} a segno</div>`;
    }
    // rialzarsi
    const k = s.kdInfo;
    const show = s.phase === 'kd' && k && k.who === s.a && s.a.state === 'down' && !k.ko && !k.tko && k.t > 1.2;
    this.getupEl.classList.toggle('show', !!show);
    if (show) this.getupEl.querySelector('.getup-bar i').style.width = U.clamp(k.meter, 0, 100) + '%';
  }

  render(ctx, w, h) {
    const L = this.L = this.layout(w, h);
    const S = L.S * this.cam.zoom, gy = L.gy;
    const s = this.sim;
    ctx.save();
    ctx.translate(this.cam.sx, this.cam.sy);
    Render.venueBack(ctx, this.venue, w, h, gy, S, this.cam.x, this.t, this.excite, this.flashes);
    if (this.ring) {
      const rs = S * 0.8;
      const rface = s.phase === 'kd' && s.kdInfo ? s.kdInfo.who.side : (Math.sign(((s.a.x + s.b.x) / 2) - this.ref.x) || 1);
      Render.drawAt(ctx, CAST.ref.look, this.ref.pose, w / 2 + (this.ref.x - this.cam.x) * S * 0.92, gy - S * 0.24, rs, rface, {});
    }
    let order = [s.a, s.b];
    if (s.a.state === 'punch' && s.b.state !== 'punch') order = [s.b, s.a];
    if (s.a.down) order = [s.a, s.b]; else if (s.b.down) order = [s.b, s.a];
    for (const f of order) {
      if (f.flash > 0) { ctx.save(); f.draw(ctx, this.sx(f.x), gy, S); ctx.restore(); }
      else f.draw(ctx, this.sx(f.x), gy, S);
    }
    for (const p of this.parts) {
      const a = U.clamp(p.life / p.max, 0, 1);
      if (p.ring) {
        ctx.strokeStyle = p.c; ctx.globalAlpha = a; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.4 - a * 0.6), 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    Render.venueFront(ctx, this.venue, w, h, gy, S, this.cam.x);
    ctx.restore();
    // luce dall'alto
    if (this.ring) {
      const g = ctx.createRadialGradient(w / 2, gy - S * 1.2, S * 0.3, w / 2, gy - S, S * 4);
      g.addColorStop(0, 'rgba(255,250,230,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    Render.vignette(ctx, w, h, 0.55);
    if (this.slow > 0 && this.slowScale < 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; const bh = h * 0.05;
      ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh - L.ctrlH, w, bh);
    }
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flashT * 2})`; ctx.fillRect(0, 0, w, h); }
    if (s.a.wobbled && !s.a.down) {
      ctx.fillStyle = `rgba(120,0,0,${0.12 + Math.sin(this.t * 6) * 0.06})`; ctx.fillRect(0, 0, w, h);
    }
  }

  /* ===== Angolo tra i round ===== */
  analyze() {
    const s = this.sim, r = s.cur, A = s.a, B = s.b, me = r.a, op = r.b;
    const tips = [];
    const acc = me.thrown ? me.landed / me.thrown : 0;
    if (A.head < 45) tips.push([10, 'Sei scosso, ragazzo. Tieni la GUARDIA alta e, se ti chiude, fai clinch: guardia e levetta in avanti.']);
    if (A.stam < A.stamMax * 0.45) tips.push([9, 'Stai sprecando fiato. Ogni colpo a vuoto ti costa il doppio. Respira quando sei fuori distanza.']);
    if (A.cut > 30) tips.push([9, 'Hai un taglio brutto. Se peggiora il medico ferma tutto: fammi lavorare sul taglio.']);
    if (op.body >= 5) tips.push([7, 'Ti sta lavorando al corpo! Con la levetta in basso e GUARDIA copri il fegato.']);
    if (me.thrown > 8 && acc < 0.25) tips.push([7, 'Colpisci l\'aria. Gancio e montante sono colpi corti: tirali solo da vicino.']);
    if (me.blocked > 8 && me.thrown < op.thrown * 0.6) tips.push([6, 'Non si vincono i round chiusi a riccio. Para e rispondi subito!']);
    if (B.stam < B.stamMax * 0.5) tips.push([8, 'È cotto! Vai al corpo e mettigli pressione, non farlo respirare.']);
    if (op.blocked > 6 && me.body < 3) tips.push([6, 'Tiene la guardia alta: lavoralo al corpo o passa sotto col montante.']);
    if (B.swell > 0.4) tips.push([5, 'Il suo occhio si sta chiudendo: vede meno i tuoi colpi. Insisti!']);
    if (me.evaded > 4) tips.push([4, 'Bel lavoro di testa. Dopo una schivata hai un attimo per contrattaccare forte!']);
    if (op.counters > 2) tips.push([6, 'Ti sta aspettando per contrattaccare. Fintagli il jab e poi entra.']);
    if (me.counters > 2) tips.push([3, 'Così! Colpiscilo mentre carica, i contropiedi fanno male il doppio.']);
    tips.push([1, 'Jab, jab e diretto. Lavora dietro al jab e tieni il centro del ring.']);
    tips.sort((x, y) => y[0] - x[0]);
    const sa = me.power + me.landed * 1.2 + me.aggr * 0.15 - me.kd * 30, sb = op.power + op.landed * 1.2 + op.aggr * 0.15 - op.kd * 30;
    const verdict = me.landed + op.landed < 4 ? 'Round tattico: nessuno dei due ha rischiato davvero.' : sa > sb * 1.15 ? 'Secondo me questo round è nostro.' : sb > sa * 1.15 ? 'Questo round l\'abbiamo perso. Cambia qualcosa.' : 'Round tirato, potrebbe andare da tutte e due le parti.';
    let rec = 'fiato';
    if (A.cut > 35) rec = 'taglio'; else if (A.head < 55 || A.swell > 0.4) rec = 'ghiaccio';
    return { tips: tips.slice(0, 2).map(t => t[1]), verdict, rec };
  }
  showBreak() {
    const s = this.sim, an = this.analyze(), r = s.cur;
    const box = U.el('div', { class: 'panel corner' });
    box.appendChild(U.el('div', { class: 'corner-h' }, `FINE ROUND ${s.round}`));
    box.appendChild(U.el('div', { class: 'corner-coach' }, U.el('b', null, this.coachName + ': '), an.verdict));
    for (const t of an.tips) box.appendChild(U.el('div', { class: 'corner-tip' }, '“' + t + '”'));
    box.appendChild(U.el('div', { class: 'corner-stats' },
      U.el('div', null, U.el('span', null, 'Colpi a segno'), U.el('b', null, `${r.a.landed}/${r.a.thrown}`), U.el('b', { class: 'opp' }, `${r.b.landed}/${r.b.thrown}`)),
      U.el('div', null, U.el('span', null, 'Colpi potenti'), U.el('b', null, String(r.a.by.cross.l + r.a.by.hook.l + r.a.by.upper.l)), U.el('b', { class: 'opp' }, String(r.b.by.cross.l + r.b.by.hook.l + r.b.by.upper.l))),
      U.el('div', null, U.el('span', null, 'Al corpo'), U.el('b', null, String(r.a.body)), U.el('b', { class: 'opp' }, String(r.b.body)))));
    box.appendChild(U.el('div', { class: 'corner-q' }, 'Cosa facciamo in questo minuto?'));
    const choose = (c) => {
      Sound.click();
      const cb = (this.cfg.cutBonus || 0);
      s.nextRound(c, s.aiCorner(s.b), cb, 10);
      this.ai.plan = [];
      this.startRound();
    };
    const opts = U.el('div', { class: 'corner-opts' });
    [['fiato', 'Recupera il fiato', 'Più fiato per il prossimo round'], ['ghiaccio', 'Ghiaccio e acqua', 'Riduce gonfiore e danni alla testa'], ['taglio', 'Lavora sul taglio', 'Il cutman chiude le ferite']].forEach(([k, t, d]) => {
      opts.appendChild(U.el('button', { class: 'corner-btn' + (k === an.rec ? ' rec' : ''), onclick: () => choose(k) }, U.el('b', null, t), U.el('small', null, d)));
    });
    box.appendChild(opts);
    if (this.cfg.mode !== 'story') box.appendChild(UI.btn('Getta la spugna', () => { this.overlay.classList.remove('show'); s.finish(s.b, 'RTD', 'Il tuo angolo getta la spugna'); }, 'danger small'));
    this.overlay.innerHTML = ''; this.overlay.appendChild(box); this.overlay.classList.add('show');
  }

  /* ===== Risultati ===== */
  showResults() {
    const s = this.sim, r = s.result;
    this.stage = 'results';
    const win = r.winner === 'a', lose = r.winner === 'b';
    const title = this.cfg.spar ? 'SPARRING CONCLUSO' : win ? 'VITTORIA' : lose ? 'SCONFITTA' : 'PAREGGIO';
    let how = r.text;
    if (['UD', 'SD', 'MD', 'DRAW'].includes(r.method)) how = `${r.text} · ${r.cards.map(c => c.ta + '-' + c.tb).join(', ')}`;
    if (r.method === 'KO' || r.method === 'TKO' || r.method === 'RTD') how = `${r.method === 'RTD' ? 'Ritiro' : r.method} al ${r.round}° round (${U.fmtClock(180 * s.clock / s.cfg.roundTime)}) — ${r.text}`;
    const box = U.el('div', { class: 'panel results ' + (win ? 'win' : lose ? 'lose' : 'draw') });
    box.appendChild(U.el('div', { class: 'res-title' }, title));
    box.appendChild(U.el('div', { class: 'res-how' }, how));
    const T = r.totals;
    const tabs = U.el('div', { class: 'tabs' });
    const body = U.el('div', { class: 'tab-body' });
    const pct = (l, t) => t ? Math.round(l / t * 100) + '%' : '—';
    const stats = () => {
      const row = (lbl, a, b) => U.el('tr', null, U.el('td', null, String(a)), U.el('th', null, lbl), U.el('td', null, String(b)));
      const tb = U.el('table', { class: 'stats' },
        U.el('tr', { class: 'hd' }, U.el('td', null, s.a.name), U.el('th', null, ''), U.el('td', null, s.b.name)),
        row('Colpi portati', T.a.thrown, T.b.thrown),
        row('Colpi a segno', T.a.landed, T.b.landed),
        row('Precisione', pct(T.a.landed, T.a.thrown), pct(T.b.landed, T.b.thrown)),
        ...PUNCH_TYPES.map(p => row(PUNCHES[p].name, `${T.a.by[p].l}/${T.a.by[p].t}`, `${T.b.by[p].l}/${T.b.by[p].t}`)),
        row('Alla testa', T.a.head, T.b.head),
        row('Al corpo', T.a.body, T.b.body),
        row('Contropiedi', T.a.counters, T.b.counters),
        row('Colpi parati', T.a.blocked, T.b.blocked),
        row('Colpi evitati', Math.round(T.a.evaded), Math.round(T.b.evaded)),
        row('Atterramenti subiti', T.a.kd, T.b.kd));
      return tb;
    };
    const cards = () => {
      if (!r.cards[0].rounds.length) return U.el('p', { class: 'muted' }, 'Nessun cartellino: l\'incontro non è arrivato ai punti.');
      const wrap = U.el('div', { class: 'cards' });
      for (const c of r.cards) {
        const t = U.el('table', { class: 'card' });
        t.appendChild(U.el('tr', null, U.el('th', { colspan: c.rounds.length + 2 }, 'Giudice ' + c.name)));
        t.appendChild(U.el('tr', null, U.el('td', null, ''), ...c.rounds.map((x, i) => U.el('td', { class: 'rn' }, String(i + 1))), U.el('td', { class: 'tot' }, 'TOT')));
        t.appendChild(U.el('tr', null, U.el('td', { class: 'nm' }, s.a.name.split(' ').pop()), ...c.rounds.map(x => U.el('td', null, String(x[0]))), U.el('td', { class: 'tot' }, String(c.ta))));
        t.appendChild(U.el('tr', null, U.el('td', { class: 'nm' }, s.b.name.split(' ').pop()), ...c.rounds.map(x => U.el('td', null, String(x[1]))), U.el('td', { class: 'tot' }, String(c.tb))));
        wrap.appendChild(t);
      }
      return wrap;
    };
    const analysis = () => {
      const A = s.a;
      const grade = this.grade();
      return U.el('div', { class: 'analysis' },
        U.el('div', { class: 'grade g-' + grade }, grade),
        U.el('p', null, `Danni alla testa: ${Math.round(100 - Math.max(0, A.head))}% · al corpo: ${Math.round(100 - A.body)}%`),
        U.el('p', null, `Fiato massimo a fine match: ${Math.round(A.stamMax)}% (la fatica si accumula round dopo round)`),
        U.el('p', null, `Gonfiore: ${Math.round(A.swell * 100)}% · Taglio: ${Math.round(A.cut)}%`),
        U.el('p', null, `Colpi incassati: ${T.b.landed} · Potenza subita: ${Math.round(T.a.taken)}`),
        U.el('p', { class: 'muted' }, this.gradeText(grade)));
    };
    const tabsDef = [['Statistiche', stats], ['Cartellini', cards], ['Analisi', analysis]];
    tabsDef.forEach(([n, fn], i) => {
      const b = U.el('button', { class: 'tab' + (i === 0 ? ' on' : ''), onclick: () => { tabs.querySelectorAll('.tab').forEach(x => x.classList.remove('on')); b.classList.add('on'); body.innerHTML = ''; body.appendChild(fn()); } }, n);
      tabs.appendChild(b);
    });
    body.appendChild(stats());
    if (!this.cfg.spar) box.appendChild(tabs);
    box.appendChild(body);
    const btns = U.el('div', { class: 'row' });
    if (this.cfg.rematch) btns.appendChild(UI.btn('Rivincita', () => { this.destroy(); this.cfg.rematch(); }));
    btns.appendChild(UI.btn('Continua', () => { this.destroy(); if (this.cfg.onEnd) this.cfg.onEnd(r, this); else UI.mainMenu(); }, 'primary'));
    box.appendChild(btns);
    this.overlay.innerHTML = ''; this.overlay.appendChild(box); this.overlay.classList.add('show');
  }
  grade() {
    const T = this.sim.result.totals, A = this.sim.a;
    let sc = 0;
    sc += (T.a.landed / Math.max(1, T.a.thrown)) * 120;
    sc += U.clamp((T.a.power - T.b.power) / 8, -25, 30);
    sc += T.a.counters * 2 + T.a.evaded * 0.6;
    sc -= T.a.kd * 12;
    sc += T.b.kd * 10;
    sc += this.sim.result.winner === 'a' ? 15 : this.sim.result.winner === 'b' ? -10 : 0;
    sc += A.head / 10;
    return sc > 85 ? 'S' : sc > 65 ? 'A' : sc > 45 ? 'B' : sc > 28 ? 'C' : 'D';
  }
  gradeText(g) {
    return { S: 'Prestazione da campione. Anche i giudici si sono alzati in piedi.', A: 'Ottimo incontro: preciso, lucido, pericoloso.', B: 'Buona prova, ma c\'è margine: scegli meglio i colpi.', C: 'Hai sofferto. Lavora su difesa e gestione del fiato.', D: 'Serata da dimenticare. In palestra, domani, si ricomincia.' }[g];
  }
}

/* ===== Tutorial velato: Nino urla consigli dalla folla ===== */
class Tutorial {
  constructor(scene) {
    this.sc = scene; this.step = 0; this.t = 0; this.cnt = {}; this.done = false; this.hintCool = 0;
    this.ai = scene.ai; this.ai.passive = true; this.ai.noDefense = true;
    scene.sim.protectB = true;
    this.steps = [
      { msg: 'Usa la levetta a sinistra per muoverti. Avvicinati a quel bestione!', until: () => scene.sim.dist() < 1.25 },
      { msg: 'Ora tocca JAB! È rapido e non ti stanca.', until: () => this.c('jabL') >= 2 },
      { msg: 'Bravo! Adesso il DIRETTO: più lento, ma fa male davvero.', until: () => this.c('crossL') >= 1 },
      { msg: 'Attento, sta caricando! Tieni premuto GUARDIA!', setup: () => { this.ai.passive = false; this.ai.aggrMul = 0.6; }, until: () => this.c('blocked') >= 2, timeout: 12 },
      { msg: 'Tira la levetta in basso e colpisci: vai al corpo, gli togli il fiato!', setup: () => { this.ai.passive = true; }, until: () => this.c('bodyL') >= 2 },
      { msg: 'Quando parte per colpirti premi SCHIVA al momento giusto... e poi rispondi subito!', setup: () => { this.ai.passive = false; this.ai.aggrMul = 0.8; }, until: () => this.c('evade') >= 1, timeout: 14 },
      { msg: 'Da vicino usa GANCIO e MONTANTE. Sono colpi corti, ma pesanti!', setup: () => { this.ai.passive = true; }, until: () => this.c('powerL') >= 2 },
      { msg: 'Ora è tutto tuo. Fagliela pagare per tutti i ragazzini del campetto!', setup: () => { this.ai.passive = false; this.ai.noDefense = false; this.ai.aggrMul = 1; scene.sim.protectB = false; }, until: () => true },
    ];
  }
  c(k) { return this.cnt[k] || 0; }
  start() { this.began = true; this.enter(0); }
  enter(i) {
    this.step = i; this.t = 0;
    const st = this.steps[i];
    if (!st) { this.done = true; return; }
    if (st.setup) st.setup();
    this.sc.tip('NINO', st.msg, 99);
  }
  filterInput() { }
  onInput() { }
  update(dt) {
    if (!this.began) return;
    const sc = this.sc, s = sc.sim;
    // conta gli eventi utili (gli eventi sono già stati processati: li leggiamo tramite contatori del round)
    const r = s.cur.a;
    this.cnt.jabL = r.by.jab.l; this.cnt.crossL = r.by.cross.l; this.cnt.bodyL = r.body;
    this.cnt.powerL = r.by.hook.l + r.by.upper.l; this.cnt.blocked = r.blocked; this.cnt.evade = r.evaded >= 1 ? Math.floor(r.evaded) : 0;
    if (this.done) {
      this.hintCool -= dt;
      if (this.hintCool <= 0 && s.phase === 'fight') {
        let h = null;
        if (s.a.stamR < 0.25) h = 'Respira! Se tiri a vuoto ti svuoti. Allontanati un attimo.';
        else if (s.b.wobbled) h = 'Barcolla! ADESSO! Non dargli tregua!';
        else if (s.a.wobbled) h = 'Copriti! Tieni la GUARDIA finché non ti passa!';
        else if (s.b.guarding && Math.random() < 0.3) h = 'Si chiude! Colpiscilo al corpo o col MONTANTE!';
        if (h) { sc.tip('NINO', h, 3); this.hintCool = 7; }
      }
      return;
    }
    this.t += dt;
    const st = this.steps[this.step];
    // rallentatore sul primo attacco da parare
    if (this.step === 3 && s.b.state === 'punch' && s.b.punch.phase === 'wind' && !this.slowed) { this.slowed = true; sc.slow = 0.7; sc.slowScale = 0.25; }
    if (st.until() || (st.timeout && this.t > st.timeout)) {
      Sound.good();
      this.enter(this.step + 1);
      if (this.done) setTimeout(() => sc.tip(null), 3500);
    }
  }
}
