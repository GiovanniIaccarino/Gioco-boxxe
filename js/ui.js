'use strict';
/* ===== Interfaccia e menu ===== */
const UI = {
  get root() { return document.getElementById('ui'); },
  clear() { const r = this.root; r.innerHTML = ''; return r; },
  btn(label, fn, cls) {
    return U.el('button', { class: 'btn ' + (cls || ''), onclick: (e) => { e.stopPropagation(); Sound.click(); fn(e); } }, label);
  },
  topbar(title, back) {
    return U.el('div', { class: 'topbar' },
      back ? U.el('button', { class: 'back', onclick: () => { Sound.back(); back(); } }, '‹') : U.el('span'),
      U.el('h2', null, title), U.el('span'));
  },
  flash(msg) {
    const e = U.el('div', { class: 'flash' }, msg);
    document.body.appendChild(e);
    setTimeout(() => e.classList.add('out'), 1600);
    setTimeout(() => e.remove(), 2100);
  },

  /* ----- Intro ----- */
  start() { Game.setScene(new IntroScene()); },

  /* ----- Menu principale ----- */
  mainMenu() {
    Game.setScene(new AttractScene());
    Sound.startMusic('menu');
    const ui = this.clear();
    const st = Save.data.story, c = Save.data.career;
    let storySub = 'Dal Rione Sole al titolo mondiale';
    if (c) storySub = `Carriera — ${c.rec.w}-${c.rec.l}-${c.rec.d} · Settimana ${c.week}`;
    else if (st && st.player) storySub = `Continua — Capitolo ${Math.min(STORY.length, st.chapter + 1)}`;
    const q = Save.data.records.quick;
    const scr = U.el('div', { class: 'screen menu' },
      U.el('div', { class: 'menu-logo' }, U.el('div', { class: 'logo' }, 'BOXXE'), U.el('div', { class: 'logo-sub' }, 'DAL QUARTIERE AL RING')),
      U.el('div', { class: 'menu-btns' },
        this.menuBtn('STORIA', storySub, () => Story.enter(), 'primary'),
        this.menuBtn('MATCH RAPIDO', `Classica · Record ${q.w}-${q.l}-${q.d}`, () => this.quickMatch()),
        this.menuBtn('ALLENAMENTO', 'Palestra, sparring e guida tecnica', () => this.trainingMenu()),
        U.el('div', { class: 'menu-row' },
          this.menuBtn('IMPOSTAZIONI', null, () => this.settings(), 'small'),
          this.menuBtn('CREDITI', null, () => this.credits(), 'small'))),
      U.el('div', { class: 'menu-foot' }, 'v1.0 · Tocca, schiva, colpisci.'));
    ui.appendChild(scr);
  },
  menuBtn(t, sub, fn, cls) {
    return U.el('button', { class: 'mbtn ' + (cls || ''), onclick: () => { Sound.click(); fn(); } }, U.el('b', null, t), sub ? U.el('small', null, sub) : null);
  },

  /* ----- Match rapido ----- */
  quickMatch() {
    const own = [];
    const sp = Save.data.career ? Save.data.career.player : storyPlayer();
    if (sp) own.push(Object.assign({}, sp, { id: 'me', look: Object.assign({}, sp.look, OUTFITS.ring), mine: true }));
    const avail = ROSTER.filter(r => !r.unlock || Save.data.unlocks[r.unlock]);
    const listA = own.concat(avail), listB = avail.concat(own);
    const st = this.qs || (this.qs = { a: 0, b: 1, rounds: 3, diff: Save.settings.difficulty, venue: 'hall' });
    st.a = U.clamp(st.a, 0, listA.length - 1); st.b = U.clamp(st.b, 0, listB.length - 1);
    const scene = new SelectScene();
    Game.setScene(scene);
    const ui = this.clear();
    const scr = U.el('div', { class: 'screen select' });
    scr.appendChild(this.topbar('MATCH RAPIDO', () => this.mainMenu()));
    scr.appendChild(U.el('div', { class: 'sel-space' }));
    const panel = U.el('div', { class: 'sel-panel' });
    const card = (list, key, label) => {
      const wrap = U.el('div', { class: 'sel-card' });
      const draw = () => {
        const d = list[st[key]];
        wrap.innerHTML = '';
        const rat = Math.round(STAT_KEYS.reduce((a, k) => a + d.stats[k], 0) / 7);
        wrap.append(
          U.el('div', { class: 'sel-lbl' }, label),
          U.el('div', { class: 'sel-nav' },
            U.el('button', { class: 'arr', onclick: () => { st[key] = (st[key] - 1 + list.length) % list.length; Sound.click(); draw(); upd(); } }, '‹'),
            U.el('div', { class: 'sel-name' }, U.el('b', null, d.name), U.el('small', null, (d.nick ? `"${d.nick}" · ` : '') + (d.country || 'ITA'))),
            U.el('button', { class: 'arr', onclick: () => { st[key] = (st[key] + 1) % list.length; Sound.click(); draw(); upd(); } }, '›')),
          U.el('div', { class: 'sel-meta' }, `${STYLES[d.style].name} · ${WEIGHTS[d.wc].name} · ${d.stance === 'mancino' ? 'Mancino' : 'Ortodosso'} · OVR ${rat}`),
          U.el('div', { class: 'mini-stats' }, ...STAT_KEYS.map(k => U.el('div', null, U.el('span', null, STAT_NAMES[k].slice(0, 3)), U.el('i', { style: { width: d.stats[k] + '%' } })))));
      };
      draw();
      return wrap;
    };
    const upd = () => { scene.set(listA[st.a], listB[st.b], st.venue); };
    panel.appendChild(U.el('div', { class: 'sel-cards' }, card(listA, 'a', 'TU'), card(listB, 'b', 'AVVERSARIO')));
    const opt = (label, values, key, names) => {
      const row = U.el('div', { class: 'opt' }, U.el('span', null, label));
      const g = U.el('div', { class: 'seg' });
      values.forEach((v, i) => g.appendChild(U.el('button', { class: st[key] === v ? 'on' : '', onclick: (e) => { st[key] = v; g.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); Sound.click(); upd(); } }, names ? names[i] : String(v))));
      row.appendChild(g);
      return row;
    };
    panel.appendChild(opt('Round', [3, 4, 6, 8, 10, 12], 'rounds'));
    panel.appendChild(opt('Difficoltà', [0, 1, 2, 3], 'diff', AI_DIFF.map(d => d.name)));
    panel.appendChild(opt('Luogo', ['gym', 'hall', 'arena', 'street'], 'venue', ['Palestra', 'Palazzetto', 'Arena', 'Strada']));
    const go = () => {
      const a = listA[st.a], b = Object.assign({}, listB[st.b]);
      const street = st.venue === 'street';
      const mk = (d) => street ? Object.assign({}, d, { look: Object.assign({}, d.look, OUTFITS.street, { topColor: d.look.shorts }) }) : d;
      const cfg = {
        a: mk(a), b: mk(b), rounds: street ? 1 : st.rounds, diff: st.diff, venue: st.venue, mode: 'quick', street,
        roundTime: street ? 150 : undefined,
        onEnd: (r) => {
          const q = Save.data.records.quick;
          if (r.winner === 'a') q.w++; else if (r.winner === 'b') q.l++; else q.d++;
          Save.write();
          this.quickMatch();
        },
        onExit: () => this.quickMatch(),
      };
      cfg.rematch = () => Game.setScene(new FightScene(cfg));
      Game.setScene(new FightScene(cfg));
    };
    panel.appendChild(this.btn('COMBATTI!', go, 'primary big'));
    scr.appendChild(panel);
    ui.appendChild(scr);
    upd();
  },

  /* ----- Allenamento ----- */
  trainee() {
    const sp = Save.data.career ? Save.data.career.player : storyPlayer();
    if (sp) return Object.assign({}, sp, { look: Object.assign({}, sp.look, OUTFITS.gym) });
    return { name: 'Allievo', nick: '', wc: 'welter', style: 'boxer', stance: 'orto', stats: mkStats([50, 50, 50, 50, 50, 50, 50]), look: mkLook(Object.assign({ skin: SKINS[2], hair: 1 }, OUTFITS.gym)) };
  },
  trainingMenu() {
    Game.setScene(new MenuBgScene('gym', 0.55));
    const ui = this.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(this.topbar('ALLENAMENTO', () => this.mainMenu()));
    const me = this.trainee();
    scr.appendChild(U.el('p', { class: 'muted center' }, `Ti alleni con: ${me.name}. In questa modalità non cambiano le statistiche: serve a imparare.`));
    const mini = (k) => () => Game.setScene(new MiniGame({ kind: k, def: me, onEnd: () => this.trainingMenu(), onRetry: () => mini(k)(), onQuit: () => this.trainingMenu() }));
    const list = U.el('div', { class: 'menu-btns' },
      this.menuBtn('SACCO PESANTE', 'Combinazioni e colpi al corpo', mini('bag')),
      this.menuBtn('SALTO DELLA CORDA', 'Ritmo e tempismo', mini('rope')),
      this.menuBtn('COLPITORI', 'Riflessi e schivate col maestro', mini('mitts')),
      this.menuBtn('SPARRING LIBERO', 'Combattimento con dati in tempo reale', () => this.sparMenu()),
      this.menuBtn('GUIDA AL COMBATTIMENTO', 'Cosa c\'è sotto il cofano', () => this.guide()),
      this.menuBtn('COMANDI', 'Levetta, pulsanti, tastiera', () => this.controlsHelp(null, () => this.trainingMenu())));
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  sparMenu() {
    const me = this.trainee();
    const partner = { name: 'Sparring partner', nick: 'Il Paziente', wc: me.wc, style: 'boxer', stance: 'orto', stats: mkStats([50, 50, 55, 55, 50, 50, 50]), look: mkLook({ skin: SKINS[4], hair: 0, shorts: '#1d4ed8', trim: '#f5f5f5', gloves: '#1d4ed8' }) };
    const ui = this.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(this.topbar('SPARRING LIBERO', () => this.trainingMenu()));
    scr.appendChild(U.el('p', { class: 'muted center' }, 'Caschetto e guantoni da allenamento: niente KO. In alto vedrai i valori reali della simulazione: testa, corpo, fiato, stordimento.'));
    const list = U.el('div', { class: 'menu-btns' });
    AI_DIFF.forEach((d, i) => list.appendChild(this.menuBtn('Partner ' + d.name, ['Lento e prevedibile', 'Reagisce ai tuoi colpi', 'Ti legge e contrattacca', 'Impara le tue abitudini'][i], () => {
      Game.setScene(new FightScene({ a: Object.assign({}, me, { look: Object.assign({}, me.look, OUTFITS.ring) }), b: partner, rounds: 1, roundTime: 120, diff: i, venue: 'gym', spar: true, mode: 'training', aOpts: { headgear: '#7a0f14' }, bOpts: { headgear: '#1d4ed8' }, title: 'SPARRING', onEnd: () => this.sparMenu(), onExit: () => this.sparMenu() }));
    })));
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  guide() {
    const ui = this.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(this.topbar('GUIDA AL COMBATTIMENTO', () => this.trainingMenu()));
    const G = [
      ['Il fiato', 'Ogni colpo costa fiato, e un colpo a vuoto costa ancora di più. Con poco fiato i pugni diventano lenti e deboli, le mani si abbassano e ti muovi peggio. La parte scura a destra della barra gialla è la fatica accumulata: il massimo cala round dopo round e con i colpi al corpo.'],
      ['Testa e corpo', 'I colpi alla testa fanno danno e stordiscono. Quelli al corpo (levetta in basso mentre colpisci) svuotano il fiato dell\'avversario e ne riducono il massimo: un investimento che paga nei round finali. Con il corpo distrutto si può finire al tappeto anche senza un colpo alla testa.'],
      ['Stordimento e mento', 'Ogni colpo alla testa accumula stordimento, che svanisce col tempo in base al Mento. Quando un pugile "barcolla" diventa lento e vulnerabile: un altro colpo pesante può mandarlo al tappeto.'],
      ['Guardia', 'GUARDIA alta para i colpi alla testa (il montante passa in parte). Con la levetta in basso la guardia copre il corpo ma lascia scoperta la testa. Parare costa fiato: se sei a secco, la guardia viene sfondata.'],
      ['Schivate', 'SCHIVA con la levetta al centro: piega il busto, perfetto contro jab e diretti. Levetta in basso: ti abbassi, ottimo contro i ganci... ma il montante ti punisce. Levetta indietro: passo indietro. Una schivata al momento giusto apre una finestra di contrattacco.'],
      ['Contropiede', 'Colpire mentre l\'avversario sta caricando un pugno è il modo migliore per fare male: più precisione, +30% danno, +50% stordimento. Vale anche dopo una schivata riuscita.'],
      ['Combinazioni', 'I colpi lanciati mentre il precedente sta rientrando partono più veloci. Ma le combinazioni lunghe perdono precisione e costano sempre più fiato.'],
      ['Distanza', 'Ogni colpo ha una portata: il jab è il più lungo, il montante il più corto. Indietreggiare è più lento che avanzare: per questo chi attacca riesce a chiudere chi scappa.'],
      ['Le corde', 'Alle corde non puoi arretrare e sei più facile da colpire. Esci di lato... o fai clinch.'],
      ['Clinch', 'Da vicino, tieni GUARDIA e spingi la levetta in avanti: ti aggrappi all\'avversario e recuperi lucidità. L\'arbitro vi separa dopo poco.'],
      ['Guardia mancina', 'Tra un mancino e un ortodosso il diretto entra meglio e il jab peggio.'],
      ['Tagli e gonfiori', 'I gonfiori ti fanno vedere meno: i tuoi colpi sono meno precisi e prendi più colpi. Un taglio grave può far fermare l\'incontro dal medico. All\'angolo scegli se recuperare fiato, mettere il ghiaccio o curare il taglio.'],
      ['I giudici', 'Tre giudici, tre criteri: uno premia i colpi potenti, uno il volume, uno la difesa. Gli atterramenti valgono un punto in più. Puoi vincere un round e perdere il match.'],
      ['L\'arbitro', 'Ferma l\'incontro se incassi colpi senza rispondere mentre barcolli. Tre atterramenti nello stesso round sono K.O. tecnico.'],
      ['Rialzarsi', 'Al tappeto tocca lo schermo più velocemente che puoi. Ogni atterramento rende più difficile rialzarsi, e il Cuore aiuta.'],
      ['L\'avversario impara', 'L\'IA non bara: usa gli stessi comandi e le stesse regole. Ma ricorda i colpi che usi di più e diventa più brava a pararli. Varia!'],
    ];
    const list = U.el('div', { class: 'guide' });
    G.forEach(([t, d]) => list.appendChild(U.el('details', null, U.el('summary', null, t), U.el('p', null, d))));
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  controlsHelp(container, back) {
    const box = U.el('div', { class: 'panel help' },
      U.el('h2', null, 'COMANDI'),
      U.el('div', { class: 'help-grid' },
        U.el('b', null, 'Levetta ← →'), U.el('span', null, 'Muoviti avanti e indietro'),
        U.el('b', null, 'Levetta ↓ + colpo'), U.el('span', null, 'Colpo al corpo'),
        U.el('b', null, 'JAB / DIRETTO'), U.el('span', null, 'Colpi dritti: lunghi e veloci'),
        U.el('b', null, 'GANCIO / MONTANTE'), U.el('span', null, 'Colpi corti e potenti'),
        U.el('b', null, 'GUARDIA (tieni)'), U.el('span', null, 'Para alla testa; con ↓ para al corpo'),
        U.el('b', null, 'SCHIVA'), U.el('span', null, 'Centro: schivata · ↓: abbassati · ←: passo indietro'),
        U.el('b', null, 'GUARDIA + →'), U.el('span', null, 'Da vicino: clinch'),
        U.el('b', null, 'Tastiera'), U.el('span', null, 'A/D muovi · S basso · J jab · K diretto · U gancio · I montante · Spazio guardia · L schiva · Esc pausa')),
      UI.btn('Indietro', () => { if (container) { container.innerHTML = ''; container.classList.remove('show'); } back(); }, 'primary'));
    if (container) { container.innerHTML = ''; container.appendChild(box); container.classList.add('show'); }
    else { const ui = this.clear(); ui.appendChild(U.el('div', { class: 'screen center-col' }, box)); }
  },

  /* ----- Impostazioni ----- */
  settings() {
    const S = Save.settings;
    const ui = this.clear();
    const scr = U.el('div', { class: 'screen' });
    scr.appendChild(this.topbar('IMPOSTAZIONI', () => this.mainMenu()));
    const list = U.el('div', { class: 'settings' });
    const slider = (label, key) => {
      const inp = U.el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S[key] });
      inp.addEventListener('input', () => { S[key] = +inp.value; Sound.applyVolumes(); Save.write(); });
      return U.el('label', { class: 'set' }, U.el('span', null, label), inp);
    };
    const seg = (label, values, names, key) => {
      const g = U.el('div', { class: 'seg' });
      values.forEach((v, i) => g.appendChild(U.el('button', { class: S[key] === v ? 'on' : '', onclick: (e) => { S[key] = v; Save.write(); g.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); Sound.click(); } }, names[i])));
      return U.el('div', { class: 'set' }, U.el('span', null, label), g);
    };
    list.append(
      slider('Effetti sonori', 'sfx'),
      slider('Musica', 'music'),
      seg('Vibrazione', [true, false], ['Sì', 'No'], 'vibration'),
      seg('Durata round (reale)', [60, 90, 120, 180], ['1:00', '1:30', '2:00', '3:00'], 'roundLen'),
      seg('Difficoltà predefinita', [0, 1, 2, 3], AI_DIFF.map(d => d.name), 'difficulty'),
      seg('Dati avanzati in match', [false, true], ['No', 'Sì'], 'advHud'),
      seg('Dimensione comandi', [0.85, 1, 1.15], ['Piccoli', 'Normali', 'Grandi'], 'ctrlSize'),
      U.el('div', { class: 'set' }, U.el('span', null, 'Schermo intero'), this.btn('Attiva', () => Game.fullscreen(), 'small')),
      U.el('div', { class: 'set' }, U.el('span', null, 'Salvataggi'), this.btn('Cancella tutto', () => {
        if (confirm('Cancellare storia, carriera e record?')) { Save.reset(); this.flash('Salvataggi cancellati'); this.mainMenu(); }
      }, 'danger small')));
    scr.appendChild(list);
    ui.appendChild(scr);
  },
  credits() {
    const ui = this.clear();
    const scr = U.el('div', { class: 'screen center-col' },
      this.topbar('CREDITI', () => this.mainMenu()),
      U.el('div', { class: 'logo' }, 'BOXXE'),
      U.el('div', { class: 'logo-sub' }, 'DAL QUARTIERE AL RING'),
      U.el('p', null, 'Un simulatore di pugilato travestito da gioco semplice.'),
      U.el('p', { class: 'muted' }, 'Grafica, animazioni, musica ed effetti sonori sono generati in tempo reale dal codice.'),
      U.el('p', { class: 'muted' }, 'Tutti i personaggi, i luoghi e le organizzazioni sono di fantasia.'),
      U.el('p', { class: 'muted' }, 'Grazie a chi si rialza sempre.'));
    ui.appendChild(scr);
  },

  /* ----- Creazione personaggio ----- */
  creator(onDone) {
    const st = {
      name: '', nick: '', skin: 2, hair: 1, hairColor: 0, beard: 0, shorts: 0, trim: 3, gloves: 0, shoes: 2,
      wc: 'welter', stance: 'orto', style: 'brawler', pts: { pow: 0, spd: 0, sta: 0, chn: 0, def: 0, tec: 0, hrt: 0 },
    };
    const FREE = 10;
    const STY = {
      brawler: { n: 'Picchiatore', d: 'Mani pesanti e mento duro.', b: { pow: 8, chn: 4, spd: -2 } },
      boxer: { n: 'Tecnico', d: 'Precisione e difesa.', b: { tec: 8, def: 4 } },
      speed: { n: 'Velocista', d: 'Mani rapide e fiato lungo.', b: { spd: 8, sta: 4 } },
      slugger: { n: 'Incassatore', d: 'Non va mai giù.', b: { chn: 8, hrt: 4 } },
    };
    const WCB = { leggeri: { spd: 4, sta: 2, pow: -3 }, welter: { spd: 2, tec: 1 }, medi: { pow: 1, chn: 1 }, massimi: { pow: 5, chn: 3, spd: -4, sta: -2 } };
    const stats = () => {
      const s = {};
      STAT_KEYS.forEach(k => s[k] = 34 + (STY[st.style].b[k] || 0) + (WCB[st.wc][k] || 0) + st.pts[k]);
      return s;
    };
    const look = () => mkLook({
      skin: SKINS[st.skin], hair: st.hair, hairColor: HAIR_COLORS[st.hairColor], beard: st.beard,
      shorts: GEAR_COLORS[st.shorts], trim: GEAR_COLORS[st.trim], gloves: GEAR_COLORS[st.gloves], shoes: GEAR_COLORS[st.shoes],
    });
    const scene = new CreatorScene();
    Game.setScene(scene);
    Sound.startMusic('story');
    const ui = this.clear();
    const scr = U.el('div', { class: 'screen creator' });
    scr.appendChild(this.topbar('CHI SEI?', () => this.mainMenu()));
    scr.appendChild(U.el('div', { class: 'cr-space' }));
    const panel = U.el('div', { class: 'cr-panel' });
    const tabs = U.el('div', { class: 'tabs' });
    const body = U.el('div', { class: 'cr-body' });
    const refresh = () => { scene.set(look(), st.wc, st.stance); };
    const sw = (label, list, key) => {
      const g = U.el('div', { class: 'swatches' });
      list.forEach((c, i) => g.appendChild(U.el('button', { class: 'sw' + (st[key] === i ? ' on' : ''), style: { background: c }, onclick: (e) => { st[key] = i; g.querySelectorAll('.sw').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); Sound.click(); refresh(); } })));
      return U.el('div', { class: 'cr-row' }, U.el('span', null, label), g);
    };
    const cyc = (label, names, key, values) => {
      const val = U.el('b');
      const idx = () => values ? values.indexOf(st[key]) : st[key];
      const show = () => { val.textContent = names[idx()]; };
      const mv = (d) => { let i = (idx() + d + names.length) % names.length; st[key] = values ? values[i] : i; show(); refresh(); Sound.click(); if (key === 'wc' || key === 'style') renderStats && pane === 2 && renderPane(); };
      show();
      return U.el('div', { class: 'cr-row' }, U.el('span', null, label), U.el('div', { class: 'cyc' }, U.el('button', { class: 'arr', onclick: () => mv(-1) }, '‹'), val, U.el('button', { class: 'arr', onclick: () => mv(1) }, '›')));
    };
    let pane = 0;
    let renderStats = null;
    const renderPane = () => {
      body.innerHTML = '';
      tabs.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('on', i === pane));
      if (pane === 0) {
        const nm = U.el('input', { type: 'text', maxlength: 18, placeholder: 'Nome e cognome', value: st.name });
        nm.addEventListener('input', () => st.name = nm.value);
        const nk = U.el('input', { type: 'text', maxlength: 16, placeholder: 'Soprannome (facoltativo)', value: st.nick });
        nk.addEventListener('input', () => st.nick = nk.value);
        body.append(U.el('div', { class: 'cr-row col' }, nm, nk),
          sw('Pelle', SKINS, 'skin'), cyc('Capelli', HAIR_STYLES, 'hair'), sw('Colore capelli', HAIR_COLORS, 'hairColor'), cyc('Barba', BEARDS, 'beard'));
      } else if (pane === 1) {
        body.append(sw('Pantaloncini', GEAR_COLORS, 'shorts'), sw('Bordo', GEAR_COLORS, 'trim'), sw('Guantoni', GEAR_COLORS, 'gloves'), sw('Scarpe', GEAR_COLORS, 'shoes'));
      } else {
        body.append(
          cyc('Categoria', Object.values(WEIGHTS).map(w => w.name), 'wc', Object.keys(WEIGHTS)),
          cyc('Guardia', ['Ortodossa', 'Mancina'], 'stance', ['orto', 'mancino']),
          cyc('Stile', Object.values(STY).map(s => s.n), 'style', Object.keys(STY)),
          U.el('p', { class: 'muted small' }, STY[st.style].d));
        const box = U.el('div', { class: 'cr-stats' });
        renderStats = () => {
          box.innerHTML = '';
          const s = stats();
          const used = STAT_KEYS.reduce((a, k) => a + st.pts[k], 0);
          box.appendChild(U.el('div', { class: 'cr-pts' }, `Punti da assegnare: ${FREE - used}`));
          STAT_KEYS.forEach(k => box.appendChild(U.el('div', { class: 'cr-stat' },
            U.el('span', null, STAT_NAMES[k]),
            U.el('button', { class: 'arr sm', onclick: () => { if (st.pts[k] > 0) { st.pts[k]--; renderStats(); Sound.click(); } } }, '−'),
            U.el('div', { class: 'bar sb' }, U.el('i', { class: 'fill', style: { width: s[k] + '%' } })),
            U.el('b', null, String(s[k])),
            U.el('button', { class: 'arr sm', onclick: () => { if (used < FREE && st.pts[k] < 6) { st.pts[k]++; renderStats(); Sound.click(); } } }, '+'))));
        };
        renderStats();
        body.appendChild(box);
      }
    };
    ['Aspetto', 'Tenuta', 'Pugile'].forEach((n, i) => tabs.appendChild(U.el('button', { class: 'tab', onclick: () => { pane = i; Sound.click(); renderPane(); } }, n)));
    panel.append(tabs, body);
    panel.appendChild(this.btn('INIZIA LA STORIA', () => {
      const name = (st.name || '').trim() || 'Ciro Bianco';
      const def = { name, nick: (st.nick || '').trim(), wc: st.wc, stance: st.stance, style: st.style, stats: stats(), look: look() };
      onDone(def);
    }, 'primary big'));
    scr.appendChild(panel);
    ui.appendChild(scr);
    renderPane(); refresh();
  },
};

/* ===== Scene di sfondo ===== */
class IntroScene {
  constructor() {
    this.t = 0; this.stage = 'tap';
    const ui = UI.clear();
    this.el = U.el('div', { class: 'screen intro' }, U.el('div', { class: 'tap-start' }, U.el('div', { class: 'ts-icon' }, '🥊'), U.el('div', null, 'TOCCA PER INIZIARE'), U.el('small', null, 'Audio consigliato')));
    this.el.addEventListener('pointerdown', () => this.tap());
    ui.appendChild(this.el);
    this.parts = [];
  }
  tap() {
    if (this.stage === 'tap') {
      Sound.init(); Game.fullscreen(true);
      this.stage = 'anim'; this.t = 0; this.el.innerHTML = '';
      this.el.appendChild(this.studio = U.el('div', { class: 'studio' }, 'BOXXE STUDIOS', U.el('small', null, 'presenta')));
      return;
    }
    if (this.stage === 'anim' && this.t < 4.2) { this.t = 4.2; return; }
    if (this.t > 4.2) { Sound.bell(1); UI.mainMenu(); }
  }
  update(dt) {
    if (this.stage !== 'anim') return;
    const prev = this.t;
    this.t += dt;
    if (prev < 1.6 && this.t >= 1.6 && this.studio) this.studio.classList.add('out');
    if (prev < 2.35 && this.t >= 2.35) {
      Sound.punch(1); Sound.thud(); this.shake = 18;
      for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, v = 100 + Math.random() * 500; this.parts.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0.8 + Math.random() * 0.5 }); }
    }
    if (prev < 2.6 && this.t >= 2.6) { Sound.bell(3); Sound.cheer(0.8); }
    if (prev < 4.2 && this.t >= 4.2) {
      this.el.appendChild(U.el('div', { class: 'press' }, 'TOCCA PER CONTINUARE'));
    }
    if (this.shake) this.shake = U.damp(this.shake, 0, 6, dt);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; p.l -= dt; }
    this.parts = this.parts.filter(p => p.l > 0);
  }
  render(ctx, w, h) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if (this.stage !== 'anim' || this.t < 1.8) return;
    const t = this.t, cx = w / 2, cy = h * 0.44, S = Math.min(w, h);
    ctx.save();
    if (this.shake) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    // spot
    const on = U.clamp((t - 1.8) / 0.4, 0, 1);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.8);
    g.addColorStop(0, `rgba(255,220,150,${0.25 * on})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // guantoni che si scontrano
    const k = U.clamp((t - 1.8) / 0.55, 0, 1), e = U.easeIn(k);
    const back = t > 2.35 ? U.easeOut(U.clamp((t - 2.35) / 0.5, 0, 1)) * 0.1 : 0;
    const gl = (dir, col) => {
      const x = cx + dir * (S * 0.75 * (1 - e) + S * 0.11 + S * back);
      ctx.save(); ctx.translate(x, cy); ctx.scale(-dir, 1); ctx.rotate(-0.15);
      const r = S * 0.12;
      ctx.fillStyle = '#eee'; ctx.fillRect(r * 0.55, -r * 0.55, r * 0.7, r * 1.1);
      const gg = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r * 1.2);
      gg.addColorStop(0, U.shade(col, 0.35)); gg.addColorStop(1, U.shade(col, -0.4));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.92, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-r * 0.25, r * 0.45, r * 0.45, r * 0.32, -0.4, 0, 7); ctx.fill();
      ctx.restore();
    };
    gl(-1, '#c62828'); gl(1, '#1d4ed8');
    for (const p of this.parts) { ctx.globalAlpha = U.clamp(p.l, 0, 1); ctx.fillStyle = '#ffe9b0'; ctx.fillRect(cx + p.x, cy + p.y, 3, 3); }
    ctx.globalAlpha = 1;
    if (t > 2.35) {
      const f = U.clamp(1 - (t - 2.35) * 3, 0, 1);
      if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${f * 0.8})`; ctx.fillRect(-50, -50, w + 100, h + 100); }
      // logo
      const lk = U.clamp((t - 2.4) / 0.35, 0, 1);
      const sc = 1 + (1 - U.easeOut3(lk)) * 2.2;
      ctx.save(); ctx.translate(cx, cy + S * 0.02); ctx.scale(sc, sc); ctx.globalAlpha = lk;
      const fs = Math.min(w * 0.3, h * 0.24);
      ctx.font = `${fs}px "Bebas Neue", Impact, "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#5a0a0e'; ctx.fillText('BOXXE', fs * 0.04, fs * 0.05);
      const lg = ctx.createLinearGradient(0, -fs * 0.4, 0, fs * 0.4);
      lg.addColorStop(0, '#fff3c4'); lg.addColorStop(0.45, '#f2b705'); lg.addColorStop(1, '#a86b00');
      ctx.fillStyle = lg; ctx.fillText('BOXXE', 0, 0);
      ctx.lineWidth = fs * 0.02; ctx.strokeStyle = '#2a0505'; ctx.strokeText('BOXXE', 0, 0);
      ctx.restore();
      const sk = U.clamp((t - 2.9) / 0.6, 0, 1);
      ctx.globalAlpha = sk; ctx.fillStyle = '#e8e8e8';
      ctx.font = `${Math.min(w * 0.065, 30)}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('D A L   Q U A R T I E R E   A L   R I N G', cx, cy + fs * 0.55);
      ctx.fillStyle = '#d62828'; ctx.fillRect(cx - w * 0.2 * sk, cy + fs * 0.42, w * 0.4 * sk, 3);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    Render.vignette(ctx, w, h, 0.8);
  }
}

class AttractScene {
  constructor(venue) {
    this.venue = venue || U.pick(['arena', 'hall']);
    const pool = ROSTER.filter(r => r.id !== 'toro' && r.id !== 'esposito');
    const a = U.pick(pool); let b = U.pick(pool); while (b === a) b = U.pick(pool);
    this.sim = new FightSim({ a, b, rounds: 99, roundTime: 9999, attract: true, dmgScale: 0.3 });
    this.sim.a.ctrl = 'ai';
    this.ai1 = new AI(this.sim.a, this.sim.b, a.style, 2); this.ai2 = new AI(this.sim.b, this.sim.a, b.style, 2);
    this.t = 0; this.camX = 0; this.flashes = [];
  }
  update(dt) {
    this.t += dt;
    this.ai1.update(dt, this.sim); this.ai2.update(dt, this.sim);
    this.sim.step(dt);
    for (const e of this.sim.events) if (e.type === 'hit' && Math.random() < 0.5) this.flashes.push({ x: Math.random(), y: 0.3 + Math.random() * 0.5, l: 1 });
    this.sim.events.length = 0;
    this.flashes.forEach(f => f.l -= dt * 5); this.flashes = this.flashes.filter(f => f.l > 0);
    this.camX = U.damp(this.camX, (this.sim.a.x + this.sim.b.x) / 2, 2, dt);
  }
  render(ctx, w, h) {
    const portrait = h > w;
    const gy = portrait ? h * 0.62 : h * 0.82, S = portrait ? Math.min(w / 3.2, h / 3.4) : Math.min(w / 6, h / 2.6);
    Render.venueBack(ctx, this.venue, w, h, gy, S, this.camX, this.t, 0.5, this.flashes);
    for (const f of [this.sim.a, this.sim.b]) f.draw(ctx, w / 2 + (f.x - this.camX) * S, gy, S);
    Render.venueFront(ctx, this.venue, w, h, gy, S, this.camX);
    ctx.fillStyle = 'rgba(5,5,10,0.55)'; ctx.fillRect(0, 0, w, h);
    Render.vignette(ctx, w, h, 0.85);
  }
}
class MenuBgScene {
  constructor(venue, dim) { this.venue = venue; this.dim = dim; this.t = 0; }
  update(dt) { this.t += dt; }
  render(ctx, w, h) {
    const gy = h * 0.75, S = Math.min(w / 4, h / 3);
    Render.venueBack(ctx, this.venue === 'gym' ? 'gymfloor' : this.venue, w, h, gy, S, Math.sin(this.t * 0.1) * 0.5, this.t, 0.2);
    ctx.fillStyle = `rgba(5,5,10,${this.dim})`; ctx.fillRect(0, 0, w, h);
    Render.vignette(ctx, w, h, 0.8);
  }
}
class SelectScene {
  constructor() { this.t = 0; this.fa = null; this.fb = null; this.venue = 'hall'; }
  set(a, b, venue) {
    this.venue = venue;
    const mkF = (d, side) => { const f = new Fighter(d, side, {}); f.x = side * 0.75; return f; };
    this.fa = mkF(venue === 'street' ? Object.assign({}, a, { look: Object.assign({}, a.look, OUTFITS.street, { topColor: a.look.shorts }) }) : a, -1);
    this.fb = mkF(venue === 'street' ? Object.assign({}, b, { look: Object.assign({}, b.look, OUTFITS.street, { topColor: b.look.shorts }) }) : b, 1);
  }
  update(dt) {
    this.t += dt;
    const stub = { phase: 'x', onThrow() { }, resolve() { } };
    for (const f of [this.fa, this.fb]) if (f) { f.update(dt, f === this.fa ? this.fb : this.fa, stub); f.updatePose(dt); }
  }
  render(ctx, w, h) {
    const portrait = h > w;
    const gy = portrait ? h * 0.36 : h * 0.5, S = portrait ? Math.min(w / 3.1, h * 0.36 / 2.1) : Math.min(w / 7, h * 0.5 / 2.1);
    const camX = 0;
    Render.venueBack(ctx, this.venue, w, h, gy, S, camX, this.t, 0.4, null);
    const x0 = portrait ? w / 2 : w * 0.5;
    if (this.fa) this.fa.draw(ctx, x0 + this.fa.x * S, gy, S);
    if (this.fb) this.fb.draw(ctx, x0 + this.fb.x * S, gy, S);
    Render.venueFront(ctx, this.venue, w, h, gy, S, camX);
    Render.vignette(ctx, w, h, 0.6);
  }
}
class CreatorScene {
  constructor() { this.t = 0; this.f = null; }
  set(look, wc, stance) {
    const d = { name: 'x', wc, stance, style: 'boxer', stats: mkStats([50, 50, 50, 50, 50, 50, 50]), look };
    const old = this.f;
    this.f = new Fighter(d, -1, {}); this.f.x = 0; this.f.facing = 1;
    if (old) this.f.pose = old.pose;
  }
  update(dt) {
    this.t += dt;
    if (!this.f) return;
    const stub = { phase: 'fight', onThrow() { }, resolve() { } };
    // shadow boxing
    this.next = (this.next || 1.5) - dt;
    if (this.next <= 0) { this.next = U.rand(0.8, 2); if (this.f.state === 'idle') this.f.startPunch(U.pick(PUNCH_TYPES), Math.random() < 0.25 ? 'body' : 'head', false, null); }
    this.f.update(dt, { x: 3 }, stub); this.f.updatePose(dt);
  }
  render(ctx, w, h) {
    const portrait = h > w;
    const gy = portrait ? h * 0.38 : h * 0.86, S = portrait ? Math.min(w / 2.6, h * 0.38 / 2.05) : Math.min(w / 5, h / 2.3);
    Render.venueBack(ctx, 'locker', w, h, gy, S, 0, this.t, 0);
    const g = ctx.createRadialGradient(portrait ? w / 2 : w * 0.25, gy - S, 0, portrait ? w / 2 : w * 0.25, gy - S, S * 2);
    g.addColorStop(0, 'rgba(255,240,200,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (this.f) this.f.draw(ctx, portrait ? w / 2 - S * 0.15 : w * 0.25 - S * 0.15, gy, S);
    Render.vignette(ctx, w, h, 0.6);
  }
}
