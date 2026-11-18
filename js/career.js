'use strict';
/* ===== Modalità Carriera ===== */
const VENUE_BY_TIER = ['gym', 'hall', 'hall', 'arena'];

const Career = {
  get c() { return Save.data.career; },

  startFromStory() {
    const p = storyPlayer();
    const c = {
      player: JSON.parse(JSON.stringify(p)),
      xp: {}, week: 1, age: 20, money: 600, fame: 5,
      rec: { w: 0, l: 0, d: 0, ko: 0 }, tier: 0,
      boxers: {}, ladder: [[], [], [], []],
      fatigue: 10, injury: 0, staff: {}, belts: [], history: [], offers: [], fight: null,
      flags: {}, done: false,
    };
    STAT_KEYS.forEach(k => c.xp[k] = 0);
    c.player.look = Object.assign({}, p.look);
    const seed = U.hash(p.name + Date.now());
    const rnd = U.seeded(seed);
    for (let t = 0; t < 4; t++) {
      for (let r = 0; r < 10; r++) {
        const id = `b${t}_${r}`;
        c.boxers[id] = this.genBoxer(id, t, r, rnd, p.wc);
        c.ladder[t].push(id);
      }
    }
    // il rivale: campione italiano
    const dario = JSON.parse(JSON.stringify(ROSTER.find(r => r.id === 'squalo')));
    Object.assign(dario, { id: 'dario', wc: p.wc, rec: { w: 12, l: 0, d: 0, ko: 10 }, tier: 1 });
    dario.stats = { pow: 64, spd: 70, sta: 64, chn: 60, def: 62, tec: 66, hrt: 58 };
    c.boxers.dario = dario;
    c.ladder[1][0] = 'dario';
    // il campione del mondo
    const king = c.boxers[c.ladder[3][0]];
    Object.assign(king, { name: 'Andrés Castillo', nick: 'El Rey', country: 'MEX', style: 'counter' });
    king.stats = { pow: 90, spd: 88, sta: 90, chn: 88, def: 90, tec: 92, hrt: 90 };
    king.rec = { w: 38, l: 1, d: 0, ko: 29 };
    Save.data.career = c;
    Save.data.story.chapter = STORY.length;
    Save.write();
    this.genOffers();
    this.hub();
  },
  genBoxer(id, tier, rank, rnd, wc) {
    const T = TIERS[tier];
    const q = 1 - rank / 9;
    const base = U.lerp(T.statRange[0], T.statRange[1], q);
    const style = Object.keys(STYLES)[Math.floor(rnd() * 5)];
    const stats = {};
    STAT_KEYS.forEach(k => stats[k] = Math.round(U.clamp(base + (rnd() - 0.5) * 12, 20, 95)));
    const bias = { brawler: ['pow', 'chn'], boxer: ['tec', 'def'], counter: ['def', 'tec'], slugger: ['chn', 'pow'], speed: ['spd', 'sta'] }[style];
    bias.forEach(k => stats[k] = Math.min(97, stats[k] + 6));
    const name = FIRST_NAMES[Math.floor(rnd() * FIRST_NAMES.length)] + ' ' + LAST_NAMES[Math.floor(rnd() * LAST_NAMES.length)];
    const nick = rnd() < 0.7 ? NICKNAMES[Math.floor(rnd() * NICKNAMES.length)] : '';
    const col = GEAR_COLORS[Math.floor(rnd() * GEAR_COLORS.length)];
    const look = mkLook({
      skin: SKINS[Math.floor(rnd() * SKINS.length)], hair: Math.floor(rnd() * HAIR_STYLES.length), hairColor: HAIR_COLORS[Math.floor(rnd() * 5)],
      beard: Math.floor(rnd() * BEARDS.length), shorts: col, trim: GEAR_COLORS[Math.floor(rnd() * GEAR_COLORS.length)], gloves: rnd() < 0.5 ? col : GEAR_COLORS[Math.floor(rnd() * GEAR_COLORS.length)],
      bulk: 0.95 + rnd() * 0.15,
    });
    const w = Math.round(4 + tier * 7 + q * 8 + rnd() * 4), l = Math.round(rnd() * (3 + rank * 0.4)), ko = Math.round(w * (0.3 + stats.pow / 200));
    return { id, name, nick, wc, style, stance: rnd() < 0.2 ? 'mancino' : 'orto', country: COUNTRIES[Math.floor(rnd() * COUNTRIES.length)], stats, look, rec: { w, l, d: Math.round(rnd() * 2), ko }, tier };
  },
  rankOf(tier) {
    const c = this.c; const i = c.ladder[tier].indexOf('P');
    return i < 0 ? null : i + 1;
  },
  playerDef() {
    const c = this.c;
    return Object.assign({}, c.player, { look: Object.assign({}, c.player.look, OUTFITS.ring) });
  },
  rating(s) { return Math.round(STAT_KEYS.reduce((a, k) => a + s[k], 0) / STAT_KEYS.length); },

  /* ----- Offerte ----- */
  genOffers() {
    const c = this.c;
    c.offers = [];
    if (c.fight) return;
    const t = c.tier, lad = c.ladder[t], rank = this.rankOf(t);
    const purse = (k) => Math.round(U.lerp(TIERS[t].purse[0], TIERS[t].purse[1], k) * (1 + c.fame / 200) / 50) * 50;
    const mk = (id, kind, k, title) => {
      if (!id || c.offers.some(o => o.opp === id)) return;
      c.offers.push({ opp: id, kind, purse: purse(k), weeks: U.randi(3, 5), title: !!title });
    };
    if (rank === 2) mk(lad[0], 'Sfida per il titolo', 1, true);
    if (rank === null) {
      mk(lad[U.randi(7, 9)], 'Abbordabile', 0.1);
      mk(lad[U.randi(5, 7)], 'Scalata', 0.3);
      // collaudatore non in classifica
      const jid = 'j' + c.week;
      c.boxers[jid] = this.genBoxer(jid, t, 11, Math.random, c.player.wc);
      c.boxers[jid].journey = true;
      c.boxers[jid].stats = Object.fromEntries(STAT_KEYS.map(k => [k, Math.max(18, c.boxers[jid].stats[k] - 10)]));
      mk(jid, 'Collaudatore', 0.05);
    } else {
      const ri = rank - 1;
      mk(lad[Math.min(9, ri + U.randi(1, 3))], 'Abbordabile', 0.2);
      if (ri >= 2) mk(lad[Math.max(1, ri - U.randi(1, 2))], 'Scalata', 0.5);
      if (ri >= 4) mk(lad[Math.max(1, ri - U.randi(3, 4))], 'Rischio', 0.8);
      if (c.offers.length < 2 && ri > 0) mk(lad[ri - 1], 'Scalata', 0.6);
    }
  },

  /* ----- Settimana ----- */
  advanceWeek(log) {
    const c = this.c;
    c.week++;
    if (c.week % 52 === 0) { c.age++; this.ageEffects(log); }
    const salary = Object.keys(c.staff).reduce((s, k) => s + STAFF.find(x => x.id === k).cost * 0.02, 0);
    const exp = Math.round(60 + salary);
    c.money -= exp;
    log.push(`Spese settimanali (palestra e staff): -${U.fmtMoney(exp)}`);
    if (c.injury > 0) { c.injury--; if (c.injury === 0) log.push('Sei guarito dall\'infortunio.'); }
    if (c.fight) c.fight.weeks = Math.max(0, c.fight.weeks - 1);
    // gli altri pugili combattono
    for (let t = 0; t < 4; t++) {
      const L = c.ladder[t];
      for (let i = 0; i < L.length - 1; i++) {
        if (L[i] === 'P' || L[i + 1] === 'P') continue;
        if (c.fight && (L[i] === c.fight.opp || L[i + 1] === c.fight.opp)) continue;
        if (Math.random() < (i === 0 ? 0.03 : 0.07)) {
          const a = c.boxers[L[i]], b = c.boxers[L[i + 1]];
          const up = Math.random() < 0.5 + (this.rating(b.stats) - this.rating(a.stats)) / 40;
          if (up) { [L[i], L[i + 1]] = [L[i + 1], L[i]]; b.rec.w++; a.rec.l++; } else { a.rec.w++; b.rec.l++; }
        }
      }
    }
    if (!c.fight && (c.offers.length === 0 || c.week % 2 === 0)) this.genOffers();
    if (c.money < 0) log.push('⚠ Sei in rosso! Lavora o combatti per rimettere a posto i conti.');
    Save.write();
  },
  ageEffects(log) {
    const c = this.c, s = c.player.stats;
    if (c.age >= 32) {
      const n = c.age >= 35 ? 3 : 1;
      for (let i = 0; i < n; i++) { const k = U.pick(['spd', 'sta', 'chn']); s[k] = Math.max(20, s[k] - 1); }
      log.push(`Hai compiuto ${c.age} anni. Il fisico inizia a pagare il conto.`);
    } else log.push(`Buon compleanno! Hai ${c.age} anni.`);
    if (c.age >= 38) c.done = true;
  },
  ageMult() { const a = this.c.age; return a < 24 ? 1.2 : a <= 30 ? 1.0 : a <= 34 ? 0.7 : 0.4; },
  addXp(gains, log) {
    const c = this.c, s = c.player.stats;
    for (const k in gains) {
      c.xp[k] = (c.xp[k] || 0) + gains[k] * this.ageMult();
      let need = 20 + s[k] * 0.8;
      while (c.xp[k] >= need && s[k] < 99) {
        c.xp[k] -= need; s[k]++;
        if (log) log.push(`▲ ${STAT_NAMES[k]} sale a ${s[k]}`);
        need = 20 + s[k] * 0.8;
      }
    }
    if (Save.data.story && Save.data.story.player) Save.data.story.player.stats = Object.assign({}, s);
  },

  doTraining(tr, mult, log) {
    const c = this.c;
    const tired = c.fatigue > 65 ? 0.6 : c.fatigue > 45 ? 0.85 : 1;
    const g = {};
    for (const k in tr.stats) {
      let v = tr.stats[k] * 30 * mult * tired;
      if (c.staff.prep && (k === 'sta' || k === 'spd')) v *= 1.25;
      if (c.staff.sparring && tr.id === 'spar') v *= 1.3;
      g[k] = v;
    }
    log.push(`Allenamento: ${tr.name} (resa ${Math.round(mult * tired * 100)}%)`);
    if (tired < 1) log.push('Sei stanco: l\'allenamento rende meno. Riposa!');
    this.addXp(g, log);
    c.fatigue = Math.min(100, c.fatigue + tr.fatigue);
    const injRisk = (tr.id === 'spar' ? 0.06 : 0.015) + Math.max(0, c.fatigue - 60) / 300 - (c.staff.sparring && tr.id === 'spar' ? 0.03 : 0);
    if (Math.random() < injRisk) { c.injury = U.randi(1, 3); log.push(`✚ Ti sei infortunato in allenamento: fermo per ${c.injury} settimane.`); }
  },

  /* ----- Schermata principale ----- */
  hub(log) {
    const c = this.c;
    if (!c) return Story.enter();
    Game.setScene(new MenuBgScene('gym', 0.6));
    Sound.startMusic('menu');
    if (c.done) return this.retire();
    const ui = UI.clear();
    const p = c.player, rank = this.rankOf(c.tier);
    const scr = U.el('div', { class: 'screen career' });
    scr.appendChild(UI.topbar('CARRIERA', () => UI.mainMenu()));
    const head = U.el('div', { class: 'c-head' },
      U.el('div', { class: 'c-name' }, p.name, p.nick ? U.el('small', null, ` "${p.nick}"`) : null),
      U.el('div', { class: 'c-rec' }, `${c.rec.w}-${c.rec.l}-${c.rec.d}`, U.el('small', null, ` (${c.rec.ko} KO)`)),
      U.el('div', { class: 'c-meta' },
        U.el('span', null, `${WEIGHTS[p.wc].name}`), U.el('span', null, `${c.age} anni`), U.el('span', null, `Sett. ${c.week}`),
        U.el('span', { class: c.money < 0 ? 'neg' : '' }, U.fmtMoney(c.money)), U.el('span', null, '★ ' + Math.round(c.fame))),
      U.el('div', { class: 'c-tier', style: { borderColor: TIERS[c.tier].color } }, TIERS[c.tier].name + ' — ', rank ? (rank === 1 ? 'CAMPIONE' : `#${rank} in classifica`) : 'Non classificato'),
      c.belts.length ? U.el('div', { class: 'c-belts' }, ...c.belts.map(b => U.el('span', { class: 'belt', style: { background: TIERS[b].color } }, TIERS[b].belt))) : null,
      U.el('div', { class: 'c-form' }, U.el('span', null, 'Forma'), U.el('div', { class: 'bar st' }, U.el('i', { class: 'fill', style: { width: (100 - c.fatigue) + '%' } })), U.el('b', null, (100 - c.fatigue) + '%')),
      c.injury ? U.el('div', { class: 'warn' }, `✚ Infortunato: ancora ${c.injury} settimane (allenamento e match sconsigliati)`) : null);
    scr.appendChild(head);
    if (log && log.length) scr.appendChild(U.el('div', { class: 'c-log' }, ...log.map(l => U.el('div', null, l))));
    // prossimo match
    if (c.fight) {
      const o = c.boxers[c.fight.opp];
      const card = U.el('div', { class: 'c-fight' + (c.fight.title ? ' title' : '') },
        U.el('div', { class: 'cf-h' }, c.fight.title ? '★ MATCH PER IL TITOLO ★' : 'PROSSIMO INCONTRO'),
        U.el('div', { class: 'cf-o' }, o.name, o.nick ? U.el('small', null, ` "${o.nick}"`) : null),
        U.el('div', { class: 'cf-m' }, `${o.rec.w}-${o.rec.l}-${o.rec.d} · ${this.oppRankLabel(c.fight.opp)} · ${TIERS[c.tier].rounds + (c.fight.title ? 2 : 0) > 12 ? 12 : TIERS[c.tier].rounds + (c.fight.title ? 2 : 0)} round · Borsa ${U.fmtMoney(c.fight.purse)}`),
        this.scouting(o),
        c.fight.weeks > 0 ? U.el('div', { class: 'cf-w' }, `Tra ${c.fight.weeks} settiman${c.fight.weeks === 1 ? 'a' : 'e'}`) : UI.btn('SALI SUL RING', () => this.preFight(), 'primary big'));
      scr.appendChild(card);
    }
    // azioni
    const acts = U.el('div', { class: 'c-acts' });
    const fightNow = c.fight && c.fight.weeks === 0;
    const act = (label, sub, fn, dis) => acts.appendChild(U.el('button', { class: 'c-act', disabled: dis ? true : null, onclick: () => { Sound.click(); fn(); } }, U.el('b', null, label), U.el('small', null, sub)));
    act('Allenamento', 'Migliora le statistiche', () => this.trainMenu(), fightNow);
    act('Riposo', 'Recupera forma e infortuni', () => {
      const lg = [];
      const rec = c.staff.nutri ? 50 : 35;
      c.fatigue = Math.max(0, c.fatigue - rec); if (c.injury > 0) c.injury = Math.max(0, c.injury - 1);
      lg.push(`Settimana di riposo: forma +${rec}.`);
      this.advanceWeek(lg); this.events(lg);
    }, fightNow);
    act('Lavoro e sponsor', 'Guadagna soldi', () => {
      const lg = [];
      const g = Math.round(150 + c.fame * 12 + c.tier * 300);
      c.money += g; c.fatigue = Math.min(100, c.fatigue + 4); c.fame += 0.5;
      lg.push(`Serate, interviste e magazzino: +${U.fmtMoney(g)}`);
      this.advanceWeek(lg); this.events(lg);
    }, fightNow);
    if (!c.fight) act('Cerca incontro', `${c.offers.length} offerte`, () => this.offersScreen());
    acts.appendChild(U.el('div', { class: 'c-sep' }));
    act('Pugile', 'Statistiche e progressi', () => this.statsScreen());
    act('Classifica', TIERS[c.tier].name, () => this.ladderScreen(c.tier));
    act('Staff', `${Object.keys(c.staff).length}/${STAFF.length} assunti`, () => this.staffScreen());
    act('Storico', `${c.history.length} incontri`, () => this.historyScreen());
    scr.appendChild(acts);
    ui.appendChild(scr);
  },
  oppRankLabel(id) {
    const c = this.c; const o = c.boxers[id];
    if (o.journey) return 'non classificato';
    for (let t = 0; t < 4; t++) { const i = c.ladder[t].indexOf(id); if (i >= 0) return i === 0 ? `campione ${TIERS[t].name}` : `#${i + 1}`; }
    return 'non classificato';
  },
  scouting(o) {
    const c = this.c;
    if (!c.staff.analyst) return U.el('div', { class: 'cf-s muted' }, `Stile: ${STYLES[o.style].name} · Valutazione: ~${Math.round(this.rating(o.stats) / 5) * 5} (assumi un analista per i dettagli)`);
    const s = o.stats;
    const best = STAT_KEYS.slice().sort((a, b) => s[b] - s[a]);
    return U.el('div', { class: 'cf-s' }, `Stile: ${STYLES[o.style].name} · Guardia ${o.stance === 'mancino' ? 'mancina' : 'ortodossa'} · Punti forti: ${STAT_NAMES[best[0]]}, ${STAT_NAMES[best[1]]} · Punti deboli: ${STAT_NAMES[best[6]]}, ${STAT_NAMES[best[5]]}`);
  },

  trainMenu() {
    const c = this.c;
    const ui = UI.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(UI.topbar('ALLENAMENTO', () => this.hub()));
    scr.appendChild(U.el('p', { class: 'muted center' }, `Forma attuale: ${100 - c.fatigue}%. Un minigioco ben giocato rende fino al 140%, la simulazione l'85%.`));
    const list = U.el('div', { class: 'list' });
    for (const tr of TRAININGS) {
      const row = U.el('div', { class: 'tr-row' },
        U.el('div', null, U.el('b', null, tr.name), U.el('small', null, tr.desc), U.el('small', { class: 'muted' }, 'Allena: ' + Object.keys(tr.stats).map(k => STAT_NAMES[k]).join(', ') + ` · Fatica +${tr.fatigue}`)),
        U.el('div', { class: 'tr-btns' },
          tr.mini ? UI.btn('Gioca', () => this.playTraining(tr), 'primary small') : null,
          UI.btn('Simula', () => { const lg = []; this.doTraining(tr, 0.85, lg); this.advanceWeek(lg); this.events(lg); }, 'small')));
      list.appendChild(row);
    }
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  playTraining(tr) {
    const c = this.c;
    const done = (score) => { const lg = []; this.doTraining(tr, U.clamp(0.4 + score, 0.4, 1.4), lg); this.advanceWeek(lg); this.events(lg); };
    if (tr.mini === 'spar') {
      const t = c.tier;
      const partner = this.genBoxer('spar', t, 6, Math.random, c.player.wc);
      partner.name = 'Sparring partner'; partner.nick = '';
      Game.setScene(new FightScene({
        a: this.playerDef(), b: partner, rounds: 1, roundTime: Save.settings.roundLen, diff: 1, venue: 'gym', spar: true, mode: 'career',
        aOpts: { headgear: '#7a0f14', form: 1 - c.fatigue / 100 }, bOpts: { headgear: '#1d4ed8' }, coach: 'Maestro Sal', title: 'SPARRING',
        onEnd: (res, sc) => { const g = sc.grade(); done({ S: 1, A: 0.85, B: 0.65, C: 0.45, D: 0.25 }[g]); },
        onExit: () => this.hub(),
      }));
      return;
    }
    Game.setScene(new MiniGame({ kind: tr.mini, def: Object.assign({}, c.player, { look: Object.assign({}, c.player.look, OUTFITS.gym) }), onEnd: (s) => done(s), onQuit: () => this.trainMenu() }));
  },

  offersScreen() {
    const c = this.c;
    if (!c.offers.length) this.genOffers();
    const ui = UI.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(UI.topbar('OFFERTE', () => this.hub()));
    scr.appendChild(U.el('p', { class: 'muted center' }, 'Il tuo manager ha ricevuto queste proposte. Accettando, avrai alcune settimane di preparazione.'));
    const list = U.el('div', { class: 'list' });
    for (const o of c.offers) {
      const b = c.boxers[o.opp];
      list.appendChild(U.el('div', { class: 'offer' + (o.title ? ' title' : '') },
        U.el('div', { class: 'of-k' }, o.kind),
        U.el('div', { class: 'of-n' }, b.name, b.nick ? U.el('small', null, ` "${b.nick}"`) : null),
        U.el('div', { class: 'of-m' }, `${b.country} · ${b.rec.w}-${b.rec.l}-${b.rec.d} (${b.rec.ko} KO) · ${this.oppRankLabel(o.opp)}`),
        this.scouting(b),
        U.el('div', { class: 'of-m' }, `Borsa ${U.fmtMoney(o.purse)} · tra ${o.weeks} settimane`),
        UI.btn('Accetta', () => { c.fight = Object.assign({}, o); c.offers = []; Save.write(); Sound.stamp(); this.hub([`Contratto firmato contro ${b.name}!`]); }, 'primary small')));
    }
    scr.appendChild(list);
    ui.appendChild(scr);
  },

  preFight() {
    const c = this.c;
    const o = c.boxers[c.fight.opp];
    if (o.id === 'dario' && !c.flags.rivalIntro) {
      c.flags.rivalIntro = true; Save.write();
      return this.storyEvent('rivalPre', () => this.startFight());
    }
    if (c.tier === 3 && c.fight.title && !c.flags.worldIntro) {
      c.flags.worldIntro = true; Save.write();
      return this.storyEvent('worldPre', () => this.startFight());
    }
    this.startFight();
  },
  startFight() {
    const c = this.c, f = c.fight, o = c.boxers[f.opp];
    let rounds = Math.min(12, TIERS[c.tier].rounds + (f.title ? 2 : 0));
    const form = 1 - c.fatigue / 100 - (c.injury ? 0.25 : 0);
    Game.setScene(new FightScene({
      a: this.playerDef(), b: o, rounds, diff: Save.settings.difficulty, venue: f.title && c.tier >= 1 ? (c.tier >= 2 ? 'arena' : 'hall') : VENUE_BY_TIER[c.tier],
      mode: 'career', coach: 'Maestro Sal', cutBonus: c.staff.cutman ? 18 : 0,
      aOpts: { form: U.clamp(form, 0.3, 1) },
      title: f.title ? TIERS[c.tier].belt.toUpperCase() : null,
      onEnd: (res, sc) => this.afterFight(res, sc),
    }));
  },
  afterFight(res, sc) {
    const c = this.c, f = c.fight, oid = f.opp, o = c.boxers[oid];
    const log = [];
    const win = res.winner === 'a', lose = res.winner === 'b';
    const T = res.totals.a, TB = res.totals.b;
    const stoppage = res.method === 'KO' || res.method === 'TKO';
    if (win) { c.rec.w++; if (stoppage) c.rec.ko++; o.rec.l++; }
    else if (lose) { c.rec.l++; o.rec.w++; if (stoppage) o.rec.ko++; }
    else { c.rec.d++; o.rec.d++; }
    const purse = Math.round(f.purse * (lose ? 0.6 : 1) + (win && stoppage ? f.purse * 0.15 : 0));
    c.money += purse;
    log.push(`Borsa incassata: +${U.fmtMoney(purse)}${win && stoppage ? ' (bonus KO)' : ''}`);
    const fameG = win ? 3 + c.tier * 3 + (stoppage ? 2 : 0) + (f.title ? 8 : 0) : lose ? -1 : 1;
    c.fame = Math.max(0, c.fame + fameG);
    // esperienza dal match
    const acc = T.thrown ? T.landed / T.thrown : 0;
    this.addXp({
      pow: T.power / 12 + (stoppage && win ? 6 : 0), tec: acc * 30 + T.counters, def: T.evaded / 2 + T.blocked / 4,
      sta: res.round * 3, chn: TB.power / 30, hrt: res.round * 1.5 + T.kd * 6, spd: T.landed / 12,
    }, log);
    // classifica
    const lad = c.ladder[c.tier];
    const pi = lad.indexOf('P'), oi = lad.indexOf(oid);
    let titleWon = false;
    if (win) {
      if (oi >= 0 && (pi < 0 || oi < pi)) {
        if (pi >= 0) lad.splice(pi, 1);
        const ni = lad.indexOf(oid);
        lad.splice(ni, 0, 'P');
        if (lad.length > 10) lad.pop();
        log.push(ni === 0 ? '★ SEI IL NUOVO CAMPIONE!' : `Sali al #${ni + 1} della classifica.`);
        if (ni === 0) titleWon = true;
      } else if (pi < 0) {
        c.flags.jwins = (c.flags.jwins || 0) + 1;
        if (c.flags.jwins >= 2) { lad.splice(9, 1, 'P'); log.push('Entri in classifica al #10!'); }
        else log.push('Vittoria importante: ancora una e entri in classifica.');
      } else log.push('Vittoria utile, ma non cambia la tua posizione.');
    } else if (lose && pi >= 0) {
      const np = Math.min(lad.length - 1, pi + 2);
      lad.splice(pi, 1); lad.splice(np, 0, 'P');
      log.push(`Scendi al #${np + 1} della classifica.`);
      if (oi > pi) { const i2 = lad.indexOf(oid); if (i2 > 0) { lad.splice(i2, 1); lad.splice(Math.max(0, pi), 0, oid); } }
    }
    // fisico
    c.fatigue = Math.min(100, c.fatigue + 25 + res.round * 2);
    const dmg = TB.power;
    if ((lose && stoppage) || dmg > 220 || Math.random() < dmg / 900) { c.injury = U.randi(2, lose && stoppage ? 7 : 4); log.push(`✚ Esci dal match con un infortunio: ${c.injury} settimane di stop.`); }
    c.history.unshift({ week: c.week, opp: o.name, res: win ? 'V' : lose ? 'S' : 'P', method: res.method, round: res.round, tier: c.tier, title: f.title });
    c.fight = null;
    // eventi della storia
    const evs = [];
    if (win && !c.flags.firstWin) { c.flags.firstWin = true; evs.push('firstWin'); }
    if (lose && !c.flags.firstLoss) { c.flags.firstLoss = true; evs.push('firstLoss'); }
    if (oid === 'dario') evs.push(win ? 'rivalWin' : 'rivalLose');
    if (titleWon) {
      c.belts.push(c.tier);
      evs.push('title' + c.tier);
      if (c.tier < 3) {
        // promozione al livello superiore
        lad.splice(lad.indexOf('P'), 1);
        c.tier++;
        c.ladder[c.tier].splice(7, 0, 'P');
        if (c.ladder[c.tier].length > 10) c.ladder[c.tier].pop();
        log.push(`Promosso: ${TIERS[c.tier].name}, entri al #8.`);
      } else { Save.data.unlocks.champion = true; }
    }
    this.advanceWeek(log);
    this.genOffers();
    Save.write();
    const runEvents = () => {
      if (!evs.length) return this.hub(log);
      this.storyEvent(evs.shift(), runEvents);
    };
    runEvents();
  },
  events(log) { this.hub(log); },

  storyEvent(key, then) {
    const c = this.c;
    const pl = (o) => ({ id: 'player', x: -0.7, outfit: o || 'ring' });
    const sal = { id: 'sal', x: 0.8, face: -1 };
    const E = {
      firstWin: [{ t: 'bg', bg: 'locker' }, { t: 'cast', list: [pl(), sal] },
        S_('sal', 'La prima da professionista. Mettila in cornice... e poi dimenticala.'),
        S_('sal', 'Da qui in poi nessuno ti regala niente. Ogni gradino della classifica costa sangue.')],
      firstLoss: [{ t: 'bg', bg: 'locker' }, { t: 'cast', list: [pl(), sal] },
        S_('sal', 'Ascoltami bene. Le sconfitte sono lezioni che costano care. Non sprecare il prezzo del biglietto: impara.'),
        S_('player', 'Mi ha letto come un libro, Maestro.'),
        S_('sal', 'Allora domani scriviamo un libro nuovo. In palestra, alle sei.')],
      title0: [{ t: 'title', text: 'CAMPIONE REGIONALE', sub: TIERS[0].belt }, { t: 'bg', bg: 'street' }, { t: 'cast', list: [pl('casual'), { id: 'nino', x: 0.7, face: -1 }] },
        S_('nino', 'Il Rione è impazzito! Hanno appeso la tua foto al bar di Gennaro, accanto a quella di Maradona!'),
        { t: 'cast', list: [pl('casual'), sal] },
        S_('sal', 'Adesso si fa sul serio: il Campionato Italiano. E lì in cima c\'è lui. Dario.')],
      rivalPre: [{ t: 'bg', bg: 'hall' }, { t: 'cast', list: [pl('casual'), { id: 'dario', x: 0.7, face: -1 }, { id: 'promoter', x: 1.8, face: -1 }] },
        N_('Conferenza stampa. Flash, microfoni, e un tavolo che sembra troppo piccolo per due.'),
        S_('dario', 'Te l\'avevo detto che ci saremmo visti. Spero tu abbia salutato tua madre.'),
        S_('player', 'Parli tanto, Dario. Sul ring si sente solo il rumore dei pugni.'),
        S_('promoter', 'Che spettacolo! Signori, questo match farà il tutto esaurito!'),
        { t: 'cast', list: [pl('casual'), sal] },
        S_('sal', 'Dario è veloce e mancino. Ti girerà intorno e ti punirà ogni volta che sbagli. Pazienza. Al corpo, sempre al corpo.')],
      rivalWin: [{ t: 'bg', bg: 'locker' }, { t: 'cast', list: [pl(), { id: 'dario', x: 0.8, face: -1 }] },
        S_('dario', '...Non pensavo. Davvero. Non finisce qui.'),
        S_('player', 'Lo so. Ma stanotte è finita.'),
        { t: 'cast', list: [pl(), sal] },
        S_('sal', 'Ho aspettato otto anni per vedere qualcuno battere quel ragazzo. Sono orgoglioso di te.')],
      rivalLose: [{ t: 'bg', bg: 'locker' }, { t: 'cast', list: [pl(), { id: 'dario', x: 0.8, face: -1 }] },
        S_('dario', 'Torna al Rione, {first}. Lì sì che sei qualcuno.'),
        { t: 'cast', list: [pl(), sal] },
        S_('sal', 'Lo rivedremo. E la prossima volta sarai pronto. Te lo prometto.')],
      title1: [{ t: 'title', text: 'CAMPIONE D\'ITALIA', sub: TIERS[1].belt }, { t: 'bg', bg: 'street' }, { t: 'cast', list: [pl('casual'), { id: 'nino', x: 0.7, face: -1 }] },
        S_('nino', 'Campione d\'Italia! Dal campetto al tricolore! Mia nonna ha acceso un cero per te!'),
        { t: 'cast', list: [pl('casual'), sal] },
        S_('sal', 'L\'Europa è un altro mondo. Ragazzi cresciuti nelle migliori palestre del continente. Ma anche loro sanguinano.')],
      title2: [{ t: 'title', text: 'CAMPIONE D\'EUROPA', sub: TIERS[2].belt }, { t: 'bg', bg: 'gym' }, { t: 'cast', list: [pl('gym'), sal] },
        S_('sal', 'Campione d\'Europa. Come me, trent\'anni fa.'),
        S_('sal', 'Io al mondiale ci sono arrivato e l\'ho perso. Ai punti. Una decisione che mi brucia ancora.'),
        S_('player', 'Allora andiamo a prenderlo, Maestro. Per tutti e due.')],
      worldPre: [{ t: 'bg', bg: 'locker' }, { t: 'cast', list: [pl(), sal] },
        N_('Spogliatoio dell\'Arena. Fuori, ventimila persone. Dentro, solo il rumore del nastro sulle mani.'),
        S_('sal', 'Castillo non ha punti deboli. Ma tutti, quando si stancano, abbassano le mani. Anche i re.'),
        S_('sal', 'Ricordati da dove vieni. Rione Sole. Lì nessuno si arrende.')],
      title3: [{ t: 'title', text: 'CAMPIONE DEL MONDO', sub: TIERS[3].belt }, { t: 'bg', bg: 'street' },
        { t: 'cast', list: [{ id: 'nino', x: -1.9 }, pl('casual'), sal] },
        N_('Rione Sole. Le stesse strade, gli stessi palazzi grigi. Ma stanotte ci sono bandiere a ogni balcone.'),
        S_('nino', 'Lo sapevo. L\'ho sempre saputo! Dal primo pugno al Toro!'),
        S_('sal', 'Il figlio di nessuno, eh? Adesso sei il figlio di tutto il quartiere.'),
        N_('Sbloccato: Salvatore "Il Leone" Esposito nel Match Rapido.'),
        N_('La carriera continua: difendi la cintura quanto vuoi.')],
    };
    const steps = E[key];
    if (!steps) return then();
    Game.setScene(new StoryScene(steps, { onDone: then }));
  },

  /* ----- Schermate di consultazione ----- */
  statsScreen() {
    const c = this.c, p = c.player;
    const ui = UI.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(UI.topbar('IL TUO PUGILE', () => this.hub()));
    scr.appendChild(U.el('div', { class: 'c-head' }, U.el('div', { class: 'c-name' }, p.name), U.el('div', { class: 'muted' }, `${STYLES[p.style].name} · Guardia ${p.stance === 'mancino' ? 'mancina' : 'ortodossa'} · ${WEIGHTS[p.wc].name} · Valutazione ${this.rating(p.stats)}`)));
    const list = U.el('div', { class: 'stat-list' });
    for (const k of STAT_KEYS) {
      const need = 20 + p.stats[k] * 0.8;
      list.appendChild(U.el('div', { class: 'stat-row' },
        U.el('div', { class: 'sr-h' }, U.el('b', null, STAT_NAMES[k]), U.el('span', null, String(p.stats[k]))),
        U.el('div', { class: 'bar sb' }, U.el('i', { class: 'fill', style: { width: p.stats[k] + '%' } })),
        U.el('div', { class: 'bar xp' }, U.el('i', { class: 'fill', style: { width: U.clamp((c.xp[k] || 0) / need * 100, 0, 100) + '%' } })),
        U.el('small', { class: 'muted' }, STAT_DESC[k])));
    }
    scr.appendChild(list);
    scr.appendChild(U.el('p', { class: 'muted center' }, `Età: ${c.age} — crescita ${Math.round(this.ageMult() * 100)}%. Dopo i 30 anni si migliora più lentamente.`));
    ui.appendChild(scr);
  },
  ladderScreen(t) {
    const c = this.c;
    const ui = UI.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(UI.topbar('CLASSIFICA', () => this.hub()));
    const tabs = U.el('div', { class: 'tabs' });
    TIERS.forEach((T, i) => tabs.appendChild(U.el('button', { class: 'tab' + (i === t ? ' on' : ''), onclick: () => this.ladderScreen(i) }, T.name.split(' ').pop())));
    scr.appendChild(tabs);
    scr.appendChild(U.el('h3', { class: 'center', style: { color: TIERS[t].color } }, TIERS[t].name));
    const list = U.el('div', { class: 'ladder' });
    c.ladder[t].forEach((id, i) => {
      const me = id === 'P';
      const b = me ? { name: c.player.name, nick: c.player.nick, rec: c.rec, country: 'ITA', stats: c.player.stats } : c.boxers[id];
      list.appendChild(U.el('div', { class: 'lad-row' + (me ? ' me' : '') + (i === 0 ? ' champ' : '') },
        U.el('span', { class: 'lr-r' }, i === 0 ? '👑' : '#' + (i + 1)),
        U.el('span', { class: 'lr-n' }, b.name, b.nick ? U.el('small', null, ` "${b.nick}"`) : null),
        U.el('span', { class: 'lr-c' }, b.country),
        U.el('span', { class: 'lr-rec' }, `${b.rec.w}-${b.rec.l}-${b.rec.d}`)));
    });
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  staffScreen() {
    const c = this.c;
    const ui = UI.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(UI.topbar('STAFF', () => this.hub()));
    scr.appendChild(U.el('p', { class: 'muted center' }, `Disponibilità: ${U.fmtMoney(c.money)}. Ogni membro dello staff ha anche uno stipendio settimanale (2% del costo).`));
    const list = U.el('div', { class: 'list' });
    for (const s of STAFF) {
      const has = !!c.staff[s.id];
      list.appendChild(U.el('div', { class: 'tr-row' },
        U.el('div', null, U.el('b', null, s.name), U.el('small', null, s.desc), U.el('small', { class: 'muted' }, `Costo ${U.fmtMoney(s.cost)} · ${U.fmtMoney(s.cost * 0.02)}/sett.`)),
        has ? U.el('span', { class: 'tag' }, 'ASSUNTO') : UI.btn('Assumi', () => {
          if (c.money < s.cost) { UI.flash('Non hai abbastanza soldi.'); return; }
          c.money -= s.cost; c.staff[s.id] = true; Save.write(); Sound.good(); this.staffScreen();
        }, 'primary small')));
    }
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  historyScreen() {
    const c = this.c;
    const ui = UI.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(UI.topbar('STORICO', () => this.hub()));
    const list = U.el('div', { class: 'ladder' });
    if (!c.history.length) list.appendChild(U.el('p', { class: 'muted center' }, 'Nessun incontro da professionista.'));
    for (const h of c.history) list.appendChild(U.el('div', { class: 'lad-row' + (h.res === 'V' ? ' win' : h.res === 'S' ? ' lose' : '') },
      U.el('span', { class: 'lr-r' }, h.res), U.el('span', { class: 'lr-n' }, h.opp, h.title ? ' ★' : ''), U.el('span', { class: 'lr-c' }, `${h.method} R${h.round}`), U.el('span', { class: 'lr-rec' }, 'S' + h.week)));
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  retire() {
    const c = this.c;
    const ui = UI.clear();
    const scr = U.el('div', { class: 'screen center-col' },
      U.el('h1', { class: 'logo-sm' }, 'FINE CARRIERA'),
      U.el('p', null, `${c.player.name} appende i guantoni al chiodo a ${c.age} anni.`),
      U.el('p', null, `Record finale: ${c.rec.w}-${c.rec.l}-${c.rec.d} (${c.rec.ko} KO). Cinture: ${c.belts.map(b => TIERS[b].belt).join(', ') || 'nessuna'}.`),
      UI.btn('Nuova carriera', () => { Save.data.career = null; Save.data.story = null; Save.write(); Story.enter(); }, 'primary'),
      UI.btn('Menu principale', () => UI.mainMenu()));
    ui.appendChild(scr);
  },
};
