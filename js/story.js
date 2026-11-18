'use strict';
/* ===== Modalità Storia ===== */
const OUTFITS = {
  street: { top: 'tank', topColor: '#1f2937', bottom: 'jeans', pantsColor: '#2b3a55', hands: 'bare', shoes: '#e5e5e5' },
  gym: { top: 'tee', topColor: '#7a0f14', bottom: 'shorts', hands: 'wraps' },
  ring: { top: 'none', bottom: 'shorts', hands: 'gloves' },
  casual: { top: 'hoodie', topColor: '#334155', bottom: 'jeans', pantsColor: '#1e293b', hands: 'bare', shoes: '#e5e5e5' },
};

function storyPlayer() { return Save.data.story && Save.data.story.player; }
function playerLook(outfit) {
  const p = storyPlayer();
  const base = p ? p.look : mkLook({});
  const o = OUTFITS[outfit || 'ring'];
  const l = Object.assign({}, base, o);
  if (o.shoes === undefined) l.shoes = base.shoes;
  return l;
}
function fill(str) {
  const p = storyPlayer();
  return str.replace(/\{name\}/g, p ? p.name : 'Ragazzo').replace(/\{nick\}/g, p ? (p.nick || p.name) : 'Ragazzo').replace(/\{first\}/g, p ? p.name.split(' ')[0] : 'Ragazzo');
}

/* ---- Sceneggiatura ---- */
const S_ = (who, text, extra) => Object.assign({ t: 'say', who, text }, extra || {});
const N_ = (text) => ({ t: 'narr', text });

const STORY = [
  /* CAPITOLO 1 */
  [
    { t: 'music', kind: 'story' },
    { t: 'title', text: 'CAPITOLO 1', sub: 'Rione Sole' },
    { t: 'bg', bg: 'street' }, { t: 'cast', list: [] },
    N_('Rione Sole. Palazzi grigi, motorini senza targa e ragazzi senza futuro.'),
    N_('{name} è cresciuto qui. Il padre se n\'è andato quando aveva sei anni. La madre fa i doppi turni in ospedale.'),
    N_('A scuola lo chiamavano "problema". In strada, nessuno lo chiamava proprio.'),
    { t: 'cast', list: [{ id: 'player', x: -0.9, outfit: 'street' }, { id: 'nino', x: 0.6, face: -1 }] },
    S_('nino', '{nick}! Corri, il Toro sta di nuovo al campetto. Ha preso il pallone ai piccoli e minaccia Tommasino!'),
    S_('player', 'Di nuovo? Quello non si stanca mai.'),
    S_('nino', 'Lascia perdere, eh. Tre anni al minorile. Mena come un fabbro.'),
    { t: 'choice', options: [
      { text: 'Ci vado lo stesso.', stat: { hrt: 1 }, reply: ['nino', 'Lo sapevo... va bene, vengo con te.'] },
      { text: 'Qualcuno deve fermarlo.', stat: { pow: 1 }, reply: ['nino', 'Tu sei matto. Però hai ragione.'] },
    ] },
    { t: 'cast', list: [{ id: 'nino', x: -2.0 }, { id: 'player', x: -0.9, outfit: 'street' }, { id: 'toro', x: 0.9, face: -1 }] },
    S_('toro', 'Guarda chi si vede. Il figlio di nessuno.'),
    S_('player', 'Ridai il pallone ai ragazzini, Toro.'),
    S_('toro', 'Sennò? Mi fai la predica come tua madre con i malati?'),
    N_('Il sangue sale alla testa. Le mani si chiudono da sole.'),
    S_('toro', 'Vieni, eroe. Vediamo quanto duri.'),
    S_('nino', 'Ok, ok... se proprio dobbiamo: ascoltami! Ti dico io cosa fare, mio zio faceva il pugile!'),
    { t: 'fight', kind: 'street' },
    { t: 'save', chapter: 1 },
  ],
  /* CAPITOLO 2 */
  [
    { t: 'music', kind: 'story' },
    { t: 'bg', bg: 'street' },
    { t: 'cast', list: [{ id: 'player', x: -0.6, outfit: 'street' }, { id: 'nino', x: -1.8 }] },
    { t: 'if', cond: 'win', then: [
      N_('Il Toro resta seduto sull\'asfalto, col labbro spaccato. Per la prima volta, nel Rione cala il silenzio.'),
      S_('nino', 'Hai visto?! L\'hai steso! IL TORO! Domani lo sa tutto il quartiere!'),
    ], else: [
      N_('{name} finisce sull\'asfalto. Ma si rialza. Ancora. E ancora. Alla fine è il Toro ad andarsene, borbottando.'),
      S_('nino', 'Sei pazzo... ti ha massacrato. Ma non ti sei mai arreso.'),
    ] },
    N_('Dall\'ombra del lampione, un uomo anziano in tuta nera ha visto tutto. Si avvicina lentamente.'),
    { t: 'cast', list: [{ id: 'nino', x: -1.9 }, { id: 'player', x: -0.7, outfit: 'street' }, { id: 'sal', x: 0.9, face: -1 }] },
    S_('sal', 'Hai le mani veloci, ragazzo. E la testa vuota.'),
    S_('player', 'E lei chi sarebbe?'),
    S_('nino', '(sottovoce) È... è Salvatore Esposito. "Il Leone". Era campione d\'Europa!'),
    S_('sal', 'Ero. Adesso alleno quelli che hanno qualcosa da dimostrare. E tu ce l\'hai, si vede da come stringi i pugni.'),
    S_('sal', 'La strada ti darà due cose: una cella o una lapide. Io posso darti un ring.'),
    { t: 'choice', options: [
      { text: 'Perché proprio io?', stat: { hrt: 1 }, reply: ['sal', 'Perché ti ho visto. Chi colpisce è comune. Chi non si tira indietro, no.'] },
      { text: 'Non mi serve niente.', stat: { chn: 1 }, reply: ['sal', 'Certo. Allora domani non venire. Ma se vieni, porta fame.'] },
    ] },
    S_('sal', 'Palestra Leone, via dei Cantieri. Domani alle sei. Se non vieni, non ti cerco.'),
    { t: 'bg', bg: 'home' }, { t: 'cast', list: [{ id: 'player', x: 0, outfit: 'casual' }] },
    N_('Quella notte {first} non dorme.'),
    N_('Sua madre rientra alle due. Gli lascia un piatto di pasta e una carezza sulla testa, credendo che dorma.'),
    N_('Alle cinque e mezza, {first} è già in strada.'),
    { t: 'save', chapter: 2 },
  ],
  /* CAPITOLO 3 */
  [
    { t: 'music', kind: 'story' },
    { t: 'title', text: 'CAPITOLO 2', sub: 'Palestra Leone' },
    { t: 'bg', bg: 'gym' },
    { t: 'cast', list: [{ id: 'player', x: -0.8, outfit: 'gym' }, { id: 'sal', x: 0.8, face: -1 }] },
    S_('sal', 'Puntuale. Buon segno. Qui dentro valgono tre regole: si arriva in orario, si rispetta tutti, e non si mena fuori dal ring.'),
    S_('sal', 'Hai forza, ma la butti via. Partiamo dalle basi. Al sacco: voglio sentire le combinazioni, non i pugni a caso.'),
    { t: 'train', kind: 'bag' },
    S_('sal', 'Non male. Ma col fiato che hai non arrivi al secondo round. Corda!'),
    { t: 'train', kind: 'rope' },
    S_('sal', 'E adesso la cosa più importante: non farti colpire. Ai colpitori. Ti chiamo il colpo e tu rispondi. Se carico il braccio... schivi.'),
    { t: 'train', kind: 'mitts' },
    S_('sal', 'Ricordatelo: in strada vince chi colpisce più forte. Sul ring vince chi colpisce senza farsi colpire.'),
    S_('sal', 'E un\'altra cosa. Quello che vedi sul ring è solo la superficie. Il fiato, le gambe, la testa... sotto c\'è un mondo. Lo imparerai.'),
    N_('I giorni diventano settimane. Le settimane, mesi. Il sacco si consuma. Le mani si induriscono.'),
    { t: 'stat', add: { sta: 2, tec: 2, def: 2, spd: 1 } },
    { t: 'save', chapter: 3 },
  ],
  /* CAPITOLO 4 */
  [
    { t: 'music', kind: 'story' },
    { t: 'title', text: 'CAPITOLO 3', sub: 'Il primo ring' },
    { t: 'bg', bg: 'locker' },
    { t: 'cast', list: [{ id: 'player', x: -0.7, outfit: 'ring' }, { id: 'sal', x: 0.8, face: -1 }] },
    S_('sal', 'Tre mesi. Ed eccoci qua. Torneo dilettanti, tre round. Il tuo avversario è Marco Ventura.'),
    S_('sal', 'Un ragioniere del ring: jab, passo indietro, jab. Non corrergli dietro come un cane dietro a un motorino.'),
    S_('sal', 'Taglia il ring, chiudilo alle corde, lavora al corpo. Quando cala il fiato... entra.'),
    { t: 'choice', options: [
      { text: 'Sono pronto, Maestro.', stat: { pow: 1 }, reply: ['sal', 'Lo vedremo tra dieci minuti.'] },
      { text: 'Ho paura.', stat: { hrt: 1 }, reply: ['sal', 'Bene. Chi non ha paura è uno stupido. Usala: ti terrà sveglio.'] },
    ] },
    { t: 'cast', list: [{ id: 'player', x: -0.7, outfit: 'ring' }, { id: 'sal', x: 0.8, face: -1 }, { id: 'nino', x: 2.0, face: -1 }] },
    S_('nino', '{nick}! È venuto mezzo Rione a vederti! Pure la signora Carmela del terzo piano!'),
    { t: 'fight', kind: 'amateur' },
    { t: 'bg', bg: 'locker' },
    { t: 'cast', list: [{ id: 'player', x: -0.7, outfit: 'ring' }, { id: 'sal', x: 0.8, face: -1 }] },
    { t: 'if', cond: 'win', then: [
      S_('sal', 'Hai vinto. Ma ho contato almeno dieci errori. Domani ne parliamo uno per uno.'),
      S_('player', 'Maestro... grazie.'),
      S_('sal', 'Ringraziami quando avrai una cintura. Adesso vai a farti una doccia, puzzi di paura.'),
    ], else: [
      S_('sal', 'Hai perso. E allora? Io il mio primo incontro l\'ho perso ai punti, e sono diventato campione d\'Europa.'),
      S_('sal', 'Guarda i cartellini, guarda le statistiche. Lì dentro c\'è scritto cosa devi migliorare.'),
    ] },
    { t: 'save', chapter: 4 },
  ],
  /* CAPITOLO 5 */
  [
    { t: 'music', kind: 'story' },
    { t: 'title', text: 'CAPITOLO 4', sub: 'Lo Squalo' },
    { t: 'bg', bg: 'street' },
    N_('Qualche sera dopo, una berlina nera si ferma davanti alla palestra.'),
    { t: 'cast', list: [{ id: 'player', x: -1.0, outfit: 'casual' }, { id: 'dario', x: 0.7, face: -1 }, { id: 'promoter', x: 1.8, face: -1 }] },
    S_('dario', 'Ma guarda. {first} del Rione Sole che fa il pugile. Ho visto il tuo incontro. Carino.'),
    S_('player', 'Dario Ferri. Credevo fossi a Milano a fare il campioncino.'),
    S_('dario', 'Professionista, imbattuto. Dodici vittorie, dieci prima del limite. Il signor Rinaldi mi porta al titolo italiano.'),
    S_('promoter', 'Gaetano Rinaldi, piacere. Ragazzo, con me si guadagna. Con Esposito si suda e basta. Pensaci.'),
    { t: 'choice', options: [
      { text: 'Il mio allenatore è Sal.', stat: { hrt: 1 }, reply: ['promoter', 'Lealtà. Commovente. Non paga l\'affitto, però.'] },
      { text: 'Quanto paga?', stat: { pow: 1 }, reply: ['dario', 'Più di quanto meriti. Ma tanto non sei il tipo, si vede.'] },
    ] },
    S_('dario', 'Ci vediamo sul ring, prima o poi. E lì ti farò rimpiangere di non essere rimasto in strada.'),
    { t: 'cast', list: [{ id: 'player', x: -0.7, outfit: 'casual' }, { id: 'sal', x: 0.8, face: -1 }] },
    S_('sal', 'Rinaldi compra i pugili come fossero cavalli. E Dario... Dario era uno dei miei. Poi ha scelto i soldi.'),
    S_('sal', 'Basta dilettanti. Ti faccio la licenza da professionista. Si parte dal circuito regionale.'),
    S_('sal', 'Ogni settimana decidi tu: allenamento, riposo, incontri. Io ti consiglio, ma la carriera è tua. E il fisico pure: se lo spremi troppo, si rompe.'),
    { t: 'title', text: 'MODALITÀ CARRIERA', sub: 'Dal quartiere al titolo mondiale' },
    { t: 'career' },
  ],
];

/* ---- Scena dialoghi ---- */
class StoryScene {
  constructor(steps, opts = {}) {
    this.steps = steps.slice(); this.i = 0; this.opts = opts;
    this.bg = opts.bg || 'street'; this.cast = [];
    this.t = 0; this.camX = 0;
    this.busy = false;
    const ui = UI.clear();
    this.box = U.el('div', { class: 'story-ui' });
    this.box.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; this.tap(); });
    this.skipBtn = U.el('button', { class: 'story-skip', onclick: (e) => { e.stopPropagation(); this.skip(); } }, 'SALTA ▸▸');
    this.box.appendChild(this.skipBtn);
    this.dlg = U.el('div', { class: 'dlg' });
    this.box.appendChild(this.dlg);
    ui.appendChild(this.box);
    this.next();
  }
  flags() { return (Save.data.story && Save.data.story.flags) || {}; }
  next() {
    while (this.i < this.steps.length) {
      const s = this.steps[this.i++];
      switch (s.t) {
        case 'music': Sound.startMusic(s.kind); continue;
        case 'bg': this.bg = s.bg; continue;
        case 'cast': this.setCast(s.list); continue;
        case 'if': {
          const ok = s.cond === 'win' ? this.flags().last === 'win' : this.flags()[s.cond];
          this.steps.splice(this.i, 0, ...(ok ? s.then : (s.else || [])));
          continue;
        }
        case 'stat': applyStatGain(s.add); this.showLine('narr', 'Miglioramenti: ' + Object.entries(s.add).map(([k, v]) => `${STAT_NAMES[k]} +${v}`).join(', ')); return;
        case 'save': if (Save.data.story) { Save.data.story.chapter = s.chapter; Save.write(); } continue;
        case 'say': this.showLine(s.who, fill(s.text)); return;
        case 'narr': this.showLine('narr', fill(s.text)); return;
        case 'title': this.showTitle(s.text, s.sub); return;
        case 'choice': this.showChoice(s.options); return;
        case 'fight': this.launchFight(s); return;
        case 'train': this.launchTrain(s); return;
        case 'career': Career.startFromStory(); return;
        case 'end': UI.mainMenu(); return;
        case 'call': s.fn(); return;
      }
    }
    if (this.opts.onDone) this.opts.onDone(); else Story.continueStory();
  }
  setCast(list) {
    this.cast = list.map(c => {
      const look = c.id === 'player' ? playerLook(c.outfit) : Object.assign({}, CAST[c.id].look);
      if (c.id !== 'player' && c.outfit) Object.assign(look, OUTFITS[c.outfit]);
      if (c.look) Object.assign(look, c.look);
      return { id: c.id, x: c.x, face: c.face || 1, look, pose: Render.defaultPose(), anim: Math.random() * 6, talk: 0 };
    });
  }
  showLine(who, text) {
    this.dlg.innerHTML = '';
    this.speaker = who;
    const name = who === 'narr' ? null : who === 'player' ? (storyPlayer() ? storyPlayer().name : 'Tu') : CAST[who] ? CAST[who].name : who;
    const card = U.el('div', { class: 'dlg-card' + (who === 'narr' ? ' narr' : '') + (who === 'player' ? ' me' : '') });
    if (name) card.appendChild(U.el('div', { class: 'dlg-name' }, name));
    const tx = U.el('div', { class: 'dlg-text' });
    card.appendChild(tx);
    card.appendChild(U.el('div', { class: 'dlg-more' }, '▼'));
    this.dlg.appendChild(card);
    this.full = text; this.shown = 0; this.txEl = tx; this.typing = true;
    this.mode = 'line';
  }
  showTitle(text, sub) {
    this.dlg.innerHTML = '';
    this.mode = 'title'; this.typing = false;
    const c = U.el('div', { class: 'chap' }, U.el('div', { class: 'chap-t' }, text), U.el('div', { class: 'chap-s' }, sub));
    this.dlg.appendChild(c);
    Sound.stamp();
    this.titleT = 0;
  }
  showChoice(options) {
    this.mode = 'choice'; this.typing = false;
    const wrap = U.el('div', { class: 'choices' });
    options.forEach(o => wrap.appendChild(U.el('button', {
      class: 'choice', onclick: (e) => {
        e.stopPropagation(); Sound.click();
        if (o.stat) applyStatGain(o.stat, true);
        if (o.reply) this.steps.splice(this.i, 0, S_(o.reply[0], o.reply[1]));
        this.next();
      },
    }, o.text)));
    this.dlg.innerHTML = '';
    this.dlg.appendChild(wrap);
  }
  tap() {
    if (this.mode === 'choice') return;
    if (this.typing) { this.shown = this.full.length; this.txEl.textContent = this.full; this.typing = false; return; }
    if (this.mode === 'title' && this.titleT < 0.6) return;
    Sound.click();
    this.next();
  }
  skip() {
    // salta fino alla prossima azione interattiva
    while (this.i < this.steps.length) {
      const s = this.steps[this.i];
      if (['choice', 'fight', 'train', 'career', 'end', 'call', 'stat'].includes(s.t)) break;
      if (s.t === 'if') { this.i++; const ok = s.cond === 'win' ? this.flags().last === 'win' : this.flags()[s.cond]; this.steps.splice(this.i, 0, ...(ok ? s.then : (s.else || []))); continue; }
      if (s.t === 'bg') this.bg = s.bg;
      if (s.t === 'cast') this.setCast(s.list);
      if (s.t === 'music') Sound.startMusic(s.kind);
      if (s.t === 'save' && Save.data.story) { Save.data.story.chapter = s.chapter; Save.write(); }
      this.i++;
    }
    this.next();
  }
  launchFight(s) {
    const p = storyPlayer();
    let cfg;
    if (s.kind === 'street') {
      const toro = Object.assign({}, ROSTER.find(r => r.id === 'toro'), { look: CAST.toro.look });
      toro.stats = Object.assign({}, toro.stats, { spd: 26, def: 16, tec: 18 });
      cfg = { a: Object.assign({}, p, { look: playerLook('street') }), b: toro, rounds: 1, roundTime: 150, diff: 0, venue: 'street', street: true, tutorial: true, mode: 'story', title: 'IL TORO' };
    } else if (s.kind === 'amateur') {
      cfg = { a: Object.assign({}, p, { look: playerLook('ring') }), b: ROSTER.find(r => r.id === 'ventura'), rounds: 3, diff: Math.min(1, Save.settings.difficulty), venue: 'gym', mode: 'story', coach: 'Maestro Sal', title: 'TORNEO DILETTANTI' };
    } else cfg = s.cfg;
    const resume = this.steps.slice(this.i);
    cfg.onEnd = (res) => {
      if (Save.data.story) { Save.data.story.flags.last = res.winner === 'a' ? 'win' : 'lose'; Save.write(); }
      Game.setScene(new StoryScene(resume, { bg: this.bg }));
    };
    Game.setScene(new FightScene(cfg));
  }
  launchTrain(s) {
    const p = storyPlayer();
    const resume = this.steps.slice(this.i);
    const gains = { bag: { pow: 1, tec: 1 }, rope: { sta: 1, spd: 1 }, mitts: { def: 1, spd: 1 } }[s.kind];
    Game.setScene(new MiniGame({
      kind: s.kind, def: Object.assign({}, p, { look: playerLook(s.kind === 'rope' ? 'gym' : 'gym') }),
      extraResult: (sc) => U.el('p', { class: 'gain' }, 'Miglioramenti: ' + Object.entries(gains).map(([k, v]) => `${STAT_NAMES[k]} +${sc >= 0.9 ? v + 1 : v}`).join(', ')),
      onEnd: (sc) => {
        const g = {}; for (const k in gains) g[k] = sc >= 0.9 ? gains[k] + 1 : gains[k];
        applyStatGain(g);
        Game.setScene(new StoryScene(resume, { bg: 'gym' }));
      },
    }));
  }
  update(dt) {
    this.t += dt;
    if (this.mode === 'title') this.titleT += dt;
    if (this.typing) {
      const before = Math.floor(this.shown);
      this.shown += dt * 48;
      const n = Math.floor(this.shown);
      if (n > before && n % 3 === 0) Sound.tick();
      if (n >= this.full.length) { this.typing = false; this.txEl.textContent = this.full; }
      else this.txEl.textContent = this.full.slice(0, n);
    }
    for (const c of this.cast) {
      c.anim += dt;
      const P = Render.defaultPose();
      P.lg = [0.07, 0.52]; P.rg = [0.02, 0.52]; P.lean = 0.02; P.st = 0.16; P.by = Math.sin(c.anim * 1.6) * 0.008;
      if (c.look.hands === 'gloves') { P.lg = [0.18, 0.0]; P.rg = [0.1, -0.02]; }
      const talking = this.speaker === c.id && this.typing;
      if (talking) { P.hy = Math.sin(c.anim * 18) * 0.006; P.lg = [0.3, 0.2 + Math.sin(c.anim * 5) * 0.08]; }
      if (c.id === 'sal') { P.lean = 0.06; }
      if (c.id === 'toro') { P.lean = 0.12; P.lg = [0.2, -0.05]; P.rg = [0.12, -0.07]; }
      Render.lerpPose(c.pose, P, 1 - Math.exp(-8 * dt));
    }
  }
  layout(w, h) {
    const portrait = h > w * 1.05;
    return portrait ? { gy: h * 0.64, S: Math.min(w / 3.4, h * 0.64 / 2.3) } : { gy: h * 0.72, S: Math.min(w / 6.5, h * 0.72 / 2.2) };
  }
  render(ctx, w, h) {
    const L = this.layout(w, h);
    const bg = this.bg === 'gym' ? 'gymfloor' : this.bg;
    Render.venueBack(ctx, bg, w, h, L.gy, L.S, this.camX, this.t, 0.15);
    const sorted = this.cast.slice().sort((a, b) => (a.id === this.speaker) - (b.id === this.speaker));
    for (const c of sorted) {
      Render.drawAt(ctx, c.look, c.pose, w / 2 + c.x * L.S, L.gy, L.S, c.face, { blink: (c.anim % 4) < 0.12 });
    }
    Render.vignette(ctx, w, h, 0.65);
    if (this.speaker === 'narr' || this.mode === 'title') { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, h); }
  }
}

function applyStatGain(add, silent) {
  const p = storyPlayer();
  if (!p) return;
  for (const k in add) p.stats[k] = U.clamp(p.stats[k] + add[k], 1, 99);
  if (Save.data.career && Save.data.career.player) for (const k in add) Save.data.career.player.stats[k] = U.clamp(Save.data.career.player.stats[k] + add[k], 1, 99);
  Save.write();
  if (silent) UI.flash(Object.entries(add).map(([k, v]) => `${STAT_NAMES[k]} +${v}`).join('  '));
}

const Story = {
  /* entra in modalità storia dal menu */
  enter() {
    const st = Save.data.story;
    if (!st || !st.player) {
      UI.creator((def) => {
        Save.data.story = { player: def, chapter: 0, flags: {} };
        Save.write();
        Game.setScene(new StoryScene(STORY[0]));
      });
      return;
    }
    if (st.chapter >= STORY.length || Save.data.career) { Career.hub(); return; }
    Game.setScene(new StoryScene(STORY[st.chapter]));
  },
  continueStory() {
    const st = Save.data.story;
    if (!st) return UI.mainMenu();
    if (st.chapter < STORY.length) Game.setScene(new StoryScene(STORY[st.chapter]));
    else Career.hub();
  },
};
