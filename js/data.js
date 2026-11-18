'use strict';
/* ===== Dati di gioco ===== */
const STAT_KEYS = ['pow', 'spd', 'sta', 'chn', 'def', 'tec', 'hrt'];
const STAT_NAMES = { pow: 'Potenza', spd: 'Velocità', sta: 'Resistenza', chn: 'Mento', def: 'Difesa', tec: 'Tecnica', hrt: 'Cuore' };
const STAT_DESC = {
  pow: 'Danno dei colpi e capacità di stordire.',
  spd: 'Rapidità di caricamento e recupero dei colpi, riflessi, passo.',
  sta: 'Rigenerazione del fiato e recupero tra i round. Riduce la fatica accumulata.',
  chn: 'Quanto stordimento assorbi da un colpo alla testa.',
  def: 'Rende più difficile essere colpiti e migliora le schivate.',
  tec: 'Precisione e probabilità di colpi puliti.',
  hrt: 'Recupero tra i round, capacità di rialzarsi dal tappeto.',
};

/* Colpi: tempi in secondi (scalati dalla velocità e dalla fatica) */
const PUNCHES = {
  jab:   { name: 'Jab',      hand: 'lead', range: 1.22, wind: 0.11,  act: 0.07, rec: 0.15, stam: 2.0, dmg: 3.0, stun: 6,  acc: 0.84 },
  cross: { name: 'Diretto',  hand: 'rear', range: 1.17, wind: 0.19,  act: 0.08, rec: 0.22, stam: 4.0, dmg: 6.2, stun: 14, acc: 0.74 },
  hook:  { name: 'Gancio',   hand: 'lead', range: 1.02, wind: 0.24,  act: 0.09, rec: 0.27, stam: 5.0, dmg: 9.0, stun: 22, acc: 0.73 },
  upper: { name: 'Montante', hand: 'rear', range: 0.93, wind: 0.27,  act: 0.09, rec: 0.3,  stam: 5.4, dmg: 9.8, stun: 26, acc: 0.68 },
};
const PUNCH_TYPES = ['jab', 'cross', 'hook', 'upper'];

/* Efficacia delle schivate per tipo di colpo */
const DODGE_TABLE = {
  slip: { jab: 0.92, cross: 0.88, hook: 0.35, upper: 0.5, body: 0.05 },
  duck: { jab: 0.95, cross: 0.93, hook: 0.95, upper: 0.0, body: 0.15 },
  back: { jab: 0.6,  cross: 0.6,  hook: 0.75, upper: 0.75, body: 0.6 },
};
/* Riduzione danno della guardia alta per tipo di colpo alla testa */
const BLOCK_HIGH = { jab: 0.9, cross: 0.85, hook: 0.74, upper: 0.42 };

const WEIGHTS = {
  leggeri: { name: 'Pesi Leggeri', pow: 0.86, spd: 1.08, reach: 0.97, size: 0.93, bulk: 0.88 },
  welter:  { name: 'Pesi Welter',  pow: 0.95, spd: 1.03, reach: 1.0,  size: 0.97, bulk: 0.95 },
  medi:    { name: 'Pesi Medi',    pow: 1.04, spd: 1.0,  reach: 1.02, size: 1.0,  bulk: 1.03 },
  massimi: { name: 'Pesi Massimi', pow: 1.22, spd: 0.9,  reach: 1.06, size: 1.06, bulk: 1.18 },
};

const STYLES = {
  brawler: { name: 'Picchiatore', aggr: 0.85, dist: 0.86, defense: 0.58, guard: 0.45, counter: 0.22, body: 0.4,
    combos: [['hook'], ['jab', 'hook'], ['hook', 'upper'], ['cross', 'hook'], ['hook_b', 'hook'], ['jab', 'cross', 'hook'], ['upper', 'hook'], ['hook_b', 'upper']] },
  boxer: { name: 'Tecnico', aggr: 0.55, dist: 1.14, defense: 0.64, guard: 0.45, counter: 0.45, body: 0.25,
    combos: [['jab'], ['jab'], ['jab', 'jab'], ['jab', 'cross'], ['jab', 'cross', 'hook'], ['jab', 'jab_b', 'cross'], ['jab', 'cross_b']] },
  counter: { name: 'Contrattaccante', aggr: 0.38, dist: 1.06, defense: 0.72, guard: 0.6, counter: 0.88, body: 0.25,
    combos: [['jab'], ['cross'], ['jab', 'cross'], ['cross', 'hook'], ['hook_b', 'cross']] },
  slugger: { name: 'Incassatore', aggr: 0.66, dist: 0.96, defense: 0.48, guard: 0.58, counter: 0.25, body: 0.35,
    combos: [['cross'], ['hook'], ['jab', 'cross'], ['cross', 'hook', 'upper'], ['upper'], ['cross_b', 'hook']] },
  speed: { name: 'Velocista', aggr: 0.66, dist: 1.1, defense: 0.62, guard: 0.28, counter: 0.5, body: 0.3,
    combos: [['jab', 'jab', 'cross'], ['jab', 'cross', 'jab'], ['jab', 'cross', 'hook', 'cross'], ['jab_b', 'cross'], ['jab', 'jab']] },
};

const SKINS = ['#f3d2b3', '#e8b98e', '#d39b6a', '#b97a4c', '#8d5a36', '#6b4126', '#4a2c1a'];
const HAIR_COLORS = ['#141010', '#3a2416', '#6b4423', '#a8743d', '#d8b56a', '#8a8a8a', '#b8322a'];
const HAIR_STYLES = ['Rasati', 'Corti', 'Ricci', 'Cresta', 'Codino', 'Calvo', 'Afro'];
const BEARDS = ['Nessuna', 'Accenno', 'Barba', 'Baffi', 'Pizzetto'];
const GEAR_COLORS = ['#d62828', '#1d4ed8', '#111111', '#f5f5f5', '#f2b705', '#15803d', '#7c3aed', '#ea580c', '#0e7490', '#be185d'];

const VENUES = {
  street: { name: 'Strada — Rione Sole', ring: false },
  gym: { name: 'Palestra Leone', ring: true },
  hall: { name: 'Palazzetto', ring: true },
  arena: { name: 'Arena Mondiale', ring: true },
};

function mkLook(o) {
  return Object.assign({
    skin: SKINS[2], hair: 1, hairColor: HAIR_COLORS[0], beard: 0,
    shorts: '#d62828', trim: '#f5f5f5', gloves: '#d62828', shoes: '#111111',
    top: 'none', bottom: 'shorts', hands: 'gloves', topColor: '#333333', pantsColor: '#2b3a55',
    size: 1, bulk: 1, age: 0,
  }, o);
}
function mkStats(a) { const s = {}; STAT_KEYS.forEach((k, i) => s[k] = a[i]); return s; }

/* Roster match rapido (tutti personaggi di fantasia) */
const ROSTER = [
  { id: 'toro', name: 'Tonino Russo', nick: 'Il Toro', wc: 'medi', style: 'brawler', stance: 'orto', country: 'ITA',
    stats: mkStats([52, 30, 38, 55, 22, 20, 45]), look: mkLook({ skin: SKINS[1], hair: 0, beard: 1, shorts: '#3f3f46', trim: '#a1a1aa', gloves: '#3f3f46', bulk: 1.12 }) },
  { id: 'ventura', name: 'Marco Ventura', nick: 'Il Ragioniere', wc: 'welter', style: 'boxer', stance: 'orto', country: 'ITA',
    stats: mkStats([38, 46, 48, 42, 42, 46, 40]), look: mkLook({ skin: SKINS[0], hair: 1, hairColor: HAIR_COLORS[2], shorts: '#1d4ed8', trim: '#f5f5f5', gloves: '#1d4ed8' }) },
  { id: 'squalo', name: 'Dario Ferri', nick: 'Lo Squalo', wc: 'welter', style: 'speed', stance: 'mancino', country: 'ITA',
    stats: mkStats([72, 84, 76, 70, 74, 80, 66]), look: mkLook({ skin: SKINS[1], hair: 3, hairColor: HAIR_COLORS[0], beard: 4, shorts: '#0e7490', trim: '#f5f5f5', gloves: '#111111' }) },
  { id: 'mensah', name: 'Kofi Mensah', nick: 'Thunder', wc: 'massimi', style: 'slugger', stance: 'orto', country: 'GHA',
    stats: mkStats([90, 58, 66, 82, 52, 60, 74]), look: mkLook({ skin: SKINS[6], hair: 0, beard: 2, shorts: '#f2b705', trim: '#15803d', gloves: '#f2b705' }) },
  { id: 'petrov', name: 'Ivan Petrov', nick: 'Il Muro', wc: 'massimi', style: 'slugger', stance: 'orto', country: 'RUS',
    stats: mkStats([78, 48, 70, 94, 60, 58, 80]), look: mkLook({ skin: SKINS[0], hair: 5, beard: 0, shorts: '#f5f5f5', trim: '#d62828', gloves: '#d62828', bulk: 1.1 }) },
  { id: 'morales', name: 'Javier Morales', nick: 'El Rayo', wc: 'leggeri', style: 'speed', stance: 'orto', country: 'MEX',
    stats: mkStats([62, 92, 80, 60, 70, 76, 78]), look: mkLook({ skin: SKINS[3], hair: 1, beard: 3, shorts: '#15803d', trim: '#f5f5f5', gloves: '#d62828' }) },
  { id: 'tanaka', name: 'Kenji Tanaka', nick: 'Shadow', wc: 'leggeri', style: 'counter', stance: 'mancino', country: 'JPN',
    stats: mkStats([60, 84, 70, 62, 90, 86, 64]), look: mkLook({ skin: SKINS[1], hair: 4, hairColor: HAIR_COLORS[0], shorts: '#111111', trim: '#d62828', gloves: '#f5f5f5' }) },
  { id: 'obrien', name: 'Liam O\'Brien', nick: 'The Hammer', wc: 'medi', style: 'brawler', stance: 'orto', country: 'IRL',
    stats: mkStats([84, 62, 74, 76, 48, 58, 88]), look: mkLook({ skin: SKINS[0], hair: 1, hairColor: HAIR_COLORS[6], beard: 2, shorts: '#15803d', trim: '#f2b705', gloves: '#15803d' }) },
  { id: 'dupont', name: 'André Dupont', nick: 'Silk', wc: 'medi', style: 'boxer', stance: 'orto', country: 'FRA',
    stats: mkStats([66, 80, 78, 64, 82, 90, 66]), look: mkLook({ skin: SKINS[4], hair: 2, hairColor: HAIR_COLORS[0], beard: 4, shorts: '#1d4ed8', trim: '#d62828', gloves: '#f5f5f5' }) },
  { id: 'kaya', name: 'Mehmet Kaya', nick: 'Il Sultano', wc: 'welter', style: 'boxer', stance: 'orto', country: 'TUR',
    stats: mkStats([70, 72, 74, 70, 70, 72, 72]), look: mkLook({ skin: SKINS[2], hair: 1, beard: 2, shorts: '#d62828', trim: '#f5f5f5', gloves: '#d62828' }) },
  { id: 'cole', name: 'Marcus Cole', nick: 'Ironside', wc: 'welter', style: 'slugger', stance: 'mancino', country: 'USA',
    stats: mkStats([82, 66, 70, 80, 56, 62, 76]), look: mkLook({ skin: SKINS[5], hair: 6, hairColor: HAIR_COLORS[0], shorts: '#7c3aed', trim: '#f2b705', gloves: '#7c3aed' }) },
  { id: 'esposito', name: 'Salvatore Esposito', nick: 'Il Leone', wc: 'medi', style: 'counter', stance: 'orto', country: 'ITA', unlock: 'champion',
    stats: mkStats([88, 86, 86, 84, 90, 94, 96]), look: mkLook({ skin: SKINS[2], hair: 1, hairColor: HAIR_COLORS[1], beard: 3, shorts: '#f2b705', trim: '#111111', gloves: '#f2b705' }) },
];

/* Personaggi della storia (aspetto) */
const CAST = {
  nino: { name: 'Nino', look: mkLook({ skin: SKINS[2], hair: 2, hairColor: HAIR_COLORS[1], top: 'hoodie', topColor: '#f2b705', bottom: 'jeans', pantsColor: '#27354f', hands: 'bare', shoes: '#f5f5f5', size: 0.95, bulk: 0.9 }) },
  toro: { name: 'Il Toro', look: mkLook({ skin: SKINS[1], hair: 0, beard: 1, top: 'tank', topColor: '#e5e5e5', bottom: 'jeans', pantsColor: '#1f2937', hands: 'bare', shoes: '#111111', bulk: 1.15 }) },
  sal: { name: 'Maestro Sal', look: mkLook({ skin: SKINS[2], hair: 1, hairColor: '#cfcfcf', beard: 3, top: 'track', topColor: '#111111', bottom: 'track', pantsColor: '#111111', hands: 'bare', shoes: '#f5f5f5', bulk: 1.05, age: 1 }) },
  dario: { name: 'Dario "Lo Squalo"', look: Object.assign({}, ROSTER[2].look, { top: 'track', topColor: '#0e7490', bottom: 'track', pantsColor: '#0e3a47', hands: 'bare', shoes: '#f5f5f5' }) },
  ref: { name: 'Arbitro', look: mkLook({ skin: SKINS[1], hair: 1, hairColor: '#555555', top: 'ref', bottom: 'slacks', pantsColor: '#111111', hands: 'bare', shoes: '#111111', size: 0.98 }) },
  ventura: { name: 'Marco Ventura', look: ROSTER[1].look },
  promoter: { name: 'Gaetano Rinaldi', look: mkLook({ skin: SKINS[1], hair: 5, beard: 2, top: 'suit', topColor: '#1f1f2e', bottom: 'slacks', pantsColor: '#1f1f2e', hands: 'bare', shoes: '#111111', bulk: 1.2 }) },
};

/* Nomi per la carriera */
const FIRST_NAMES = ['Luca', 'Antonio', 'Ciro', 'Gennaro', 'Fabio', 'Mattia', 'Kevin', 'Omar', 'Samir', 'Diego', 'Rafael', 'Jamal', 'Tyrone', 'Viktor', 'Aleksandr', 'Ji-ho', 'Hiroshi', 'Mateo', 'Ricky', 'Ahmed', 'Youssef', 'Patrick', 'Sean', 'Elia', 'Kwame', 'Lucas', 'Pierre', 'Thomas', 'Bogdan', 'Emre', 'Nikolai', 'Andrés', 'Isaac', 'Dmitri', 'Leon', 'Malik', 'Santiago', 'Ruben', 'Federico', 'Salvo'];
const LAST_NAMES = ['Romano', 'Ferrara', 'Marino', 'Greco', 'Conti', 'De Luca', 'Bianchi', 'Gallo', 'Costa', 'Rizzo', 'Moretti', 'Barbieri', 'Okafor', 'Diallo', 'Kovac', 'Novak', 'Ivanov', 'Silva', 'Santos', 'Ramírez', 'Castillo', 'Kim', 'Sato', 'Murphy', 'Walsh', 'Mbeki', 'Haddad', 'Brennan', 'Schmidt', 'Müller', 'Lindqvist', 'Yilmaz', 'Petrenko', 'Vargas', 'Herrera', 'Johnson', 'Brooks', 'Fontaine', 'Leclerc', 'Abara'];
const NICKNAMES = ['Il Martello', 'Dinamite', 'La Furia', 'Il Professore', 'Cobra', 'Tornado', 'Il Lupo', 'Uragano', 'Mano di Pietra', 'Il Gladiatore', 'Scorpione', 'Il Falco', 'Vulcano', 'Il Diavolo', 'Ghiaccio', 'Fulmine', 'Il Sergente', 'Bisonte', 'Lampo', 'Il Chirurgo', 'Pitbull', 'Il Barone', 'Saetta', 'Leopardo', 'Il Boia', 'Panzer', 'Il Poeta', 'Anaconda'];
const COUNTRIES = ['ITA', 'ITA', 'ITA', 'ESP', 'FRA', 'GER', 'GBR', 'IRL', 'USA', 'MEX', 'UKR', 'POL', 'NGA', 'GHA', 'JPN', 'KOR', 'TUR', 'BRA', 'ARG', 'CUB'];

const TIERS = [
  { name: 'Circuito Regionale', belt: 'Cintura Regionale', rounds: 6, purse: [800, 2500], statRange: [34, 52], color: '#b0b7c3' },
  { name: 'Campionato Italiano', belt: 'Titolo Italiano', rounds: 8, purse: [3000, 9000], statRange: [48, 66], color: '#15803d' },
  { name: 'Titolo Europeo', belt: 'Cintura Europea', rounds: 10, purse: [12000, 40000], statRange: [60, 78], color: '#1d4ed8' },
  { name: 'Mondiale', belt: 'Cintura Mondiale', rounds: 12, purse: [60000, 400000], statRange: [72, 92], color: '#f2b705' },
];

const STAFF = [
  { id: 'prep', name: 'Preparatore atletico', desc: '+25% esperienza in Resistenza e Velocità.', cost: 2500 },
  { id: 'nutri', name: 'Nutrizionista', desc: 'Recuperi la forma più in fretta durante il riposo.', cost: 2000 },
  { id: 'cutman', name: 'Cutman esperto', desc: 'Chiude meglio i tagli e riduce i gonfiori all\'angolo.', cost: 3500 },
  { id: 'sparring', name: 'Sparring partner di livello', desc: '+30% esperienza dallo sparring, meno infortuni.', cost: 5000 },
  { id: 'analyst', name: 'Analista video', desc: 'Vedi stile e punti deboli degli avversari prima del match.', cost: 4000 },
];

const TRAININGS = [
  { id: 'bag', name: 'Sacco pesante', stats: { pow: 1, tec: 0.5 }, fatigue: 14, mini: 'bag', desc: 'Combinazioni al sacco: potenza e tecnica.' },
  { id: 'rope', name: 'Corda e corsa', stats: { sta: 1, spd: 0.5 }, fatigue: 12, mini: 'rope', desc: 'Ritmo e fiato: resistenza e velocità.' },
  { id: 'mitts', name: 'Lavoro ai colpitori', stats: { def: 1, spd: 0.6, tec: 0.4 }, fatigue: 13, mini: 'mitts', desc: 'Riflessi e schivate col maestro.' },
  { id: 'spar', name: 'Sparring', stats: { chn: 0.7, hrt: 0.7, tec: 0.6, def: 0.4 }, fatigue: 22, mini: 'spar', desc: 'Combattimento vero con caschetto. Rischio infortuni.' },
  { id: 'strength', name: 'Pesi e core', stats: { pow: 0.8, chn: 0.6 }, fatigue: 15, mini: null, desc: 'Forza e collo più robusto (solo simulato).' },
];
