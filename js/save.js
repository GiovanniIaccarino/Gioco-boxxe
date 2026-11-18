'use strict';
/* Salvataggio su localStorage */
const Save = {
  KEY: 'boxxe_save_v1',
  settings: { sfx: 0.8, music: 0.5, vibration: true, roundLen: 90, advHud: false, ctrlSize: 1, difficulty: 1, view: 'fp' },
  data: { story: null, career: null, records: { quick: { w: 0, l: 0, d: 0 } }, unlocks: {} },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.settings) Object.assign(this.settings, o.settings);
        if (o.data) Object.assign(this.data, o.data);
      }
    } catch (e) { /* storage non disponibile */ }
  },
  write() {
    try { localStorage.setItem(this.KEY, JSON.stringify({ settings: this.settings, data: this.data })); } catch (e) { /* */ }
  },
  reset() {
    this.data = { story: null, career: null, records: { quick: { w: 0, l: 0, d: 0 } }, unlocks: {} };
    this.write();
  },
};
