// KATALOG – die einzige Datei, die eine Poolfirma für ihre eigenen Produkte tauschen muss.
// Modelle, Optionen und Preise sind hier Platzhalter (Beispielpreise, keine Marktpreise).
import { COPING_W, DECK_W } from './pool.js';

export const MODELS = [
  { id: 'lido',   name: 'Lido',   tag: 'Klassiker',  shape: 'rect',   length: 6,   width: 3,   depth: 1.4, steps: 'corner', price: 14900 },
  { id: 'marina', name: 'Marina', tag: 'Familie',    shape: 'round',  length: 7,   width: 3.5, depth: 1.5, steps: 'corner', price: 18900 },
  { id: 'laguna', name: 'Laguna', tag: 'Oval',       shape: 'oval',   length: 8,   width: 4,   depth: 1.5, steps: 'full',   price: 22900 },
  { id: 'roma',   name: 'Roma',   tag: 'Römisch',    shape: 'roman',  length: 9,   width: 4,   depth: 1.6, steps: 'roman',  price: 26900 },
  { id: 'bali',   name: 'Bali',   tag: 'Freiform',   shape: 'kidney', length: 8.5, width: 4.5, depth: 1.5, steps: 'roman',  price: 28900 },
  { id: 'arena',  name: 'Arena',  tag: 'Schwimmen',  shape: 'rect',   length: 10,  width: 4.5, depth: 1.8, steps: 'full',   price: 31900 },
];

export const LINERS = {
  hellblau: { name: 'Hellblau', hex: 0x5cc3e3, price: 0 },
  blau: { name: 'Blau', hex: 0x2c86c6, price: 0 },
  smaragd: { name: 'Smaragd', hex: 0x2fb3a0, price: 390 },
  sand: { name: 'Sand', hex: 0xd8c7a0, price: 290 },
  anthrazit: { name: 'Anthrazit', hex: 0x3d464c, price: 590 },
};
export const STEP_NAMES = { none: 'Ohne', corner: 'Ecktreppe', roman: 'Römertreppe', full: 'Breittreppe' };
export const STEP_PRICE = { none: 0, corner: 690, roman: 1290, full: 1490 };
export const COPING = { stein: { name: 'Naturstein', perM: 95 }, granit: { name: 'Granit', perM: 140 }, beton: { name: 'Beton hell', perM: 70 } };
export const DECK = { holz: { name: 'Holz', perM2: 135 }, stein: { name: 'Stein', perM2: 120 }, beton: { name: 'Beton', perM2: 85 }, gras: { name: 'Rasen', perM2: 0 } };
export const COVER = { none: { name: 'Offen', perM2: 0 }, roll: { name: 'Rollladen', perM2: 95 }, roof: { name: 'Überdachung', perM2: 220 } };
export const TIMES = { day: 'Tag', evening: 'Abend', night: 'Nacht' };
export const LIGHTS = { weiss: { name: 'Weiß', hex: 0xdff4ff, price: 0 }, blau: { name: 'Blau', hex: 0x3a9cff, price: 390 }, gruen: { name: 'Grün', hex: 0x3cff9a, price: 390 }, wechsel: { name: 'Farbwechsel', hex: 0xffffff, price: 790 } };
export const EXTRAS = {
  parasol: { name: 'Sonnenschirm', price: 690, hint: '3,0 m, mit Standfuß' },
  ladder: { name: 'Edelstahl-Leiter', price: 490, hint: 'V4A, 3 Stufen' },
  jet: { name: 'Gegenstromanlage', price: 3400, hint: 'Schwimmen auf der Stelle' },
  waterfall: { name: 'Wasserfall', price: 1900, hint: 'Edelstahl-Schwall' },
  heatpump: { name: 'Wärmepumpe', price: 3900, hint: 'Bis 9 kW' },
  planters: { name: 'Pflanzkübel', price: 290, hint: '4 Stück, bepflanzt' },
};
export const LOUNGER_PRICE = 190;
export const SETUP = { baseFlat: 2800, perM2: 420, tech: 3200 };    // Aushub/Einbau, Technik (Filter, Pumpe, Skimmer, Düsen)

export const defaultExtras = () => ({ parasol: true, ladder: false, jet: false, waterfall: false, heatpump: false, planters: true, loungers: 2, light: 'weiss' });
export const modelById = (id) => MODELS.find((m) => m.id === id) || MODELS[2];

const eur = (v) => Math.round(v / 50) * 50;
export const fmtEur = (v) => eur(v).toLocaleString('de-DE') + ' €';

/** Preis + Aufschlüsselung. dims aus buildPool().dims, perimeter = Umfang Beckenrand in m */
export function priceOf(state, dims, perimeter) {
  const m = state.model === 'frei' ? { name: 'Individuell', price: Math.round(1150 * state.length * state.width) } : modelById(state.model), lines = [];
  const add = (label, v) => { if (v > 0) lines.push([label, v]); };
  add(`Becken ${m.name} (${dims.length.toFixed(1).replace('.', ',')} × ${dims.width.toFixed(1).replace('.', ',')} m)`, m.price);
  add('Aushub, Einbau, Hinterfüllung', SETUP.baseFlat + SETUP.perM2 * dims.area);
  add('Technik (Filter, Pumpe, Skimmer, Düsen)', SETUP.tech);
  add(`Treppe: ${STEP_NAMES[state.steps]}`, STEP_PRICE[state.steps]);
  add(`Beckenfarbe ${LINERS[state.liner].name}`, LINERS[state.liner].price);
  add(`Beckenrand ${COPING[state.coping].name}`, COPING[state.coping].perM * perimeter);
  const deckArea = (dims.length + 2 * (COPING_W + DECK_W)) * (dims.width + 2 * (COPING_W + DECK_W)) - (dims.length + 2 * COPING_W) * (dims.width + 2 * COPING_W);
  add(`Terrasse ${DECK[state.deck].name} (${Math.round(deckArea)} m²)`, DECK[state.deck].perM2 * deckArea);
  add(`Abdeckung ${COVER[state.cover].name}`, COVER[state.cover].perM2 * dims.length * dims.width);
  const x = state.extras;
  for (const k of Object.keys(EXTRAS)) if (x[k]) add(EXTRAS[k].name, EXTRAS[k].price);
  add(`Liegen (${x.loungers})`, LOUNGER_PRICE * x.loungers);
  add(`Beleuchtung ${LIGHTS[x.light].name}`, LIGHTS[x.light].price);
  const total = lines.reduce((a, l) => a + l[1], 0);
  return { total, lines };
}
