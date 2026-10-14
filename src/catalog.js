// KATALOG – Standardwerte (Beispielpreise, keine Marktpreise). Eine Firma braucht keinen Code zu ändern:
// Ein Katalog ist eine JSON-Datei (Beispiele: public/kataloge/*.json), geladen per ?katalog=<name oder https-URL>.
// Formen (shape): rect, round, oval, roman, kidney. Optionen, die es nicht im Katalog gibt, werden ausgeblendet.
import { COPING_W, DECK_W } from './pool.js';

export const SHAPE_IDS = ['rect', 'round', 'oval', 'roman', 'kidney'];
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
export const LOUNGER = { price: 190 };
export const SETUP = { baseFlat: 2800, perM2: 420, tech: 3200 };    // Aushub/Einbau, Technik (Filter, Pumpe, Skimmer, Düsen)
export const FREE = { perM2: 1150 };                                  // Preis je m² bei freien Maßen
/** Ausstattungspakete (Basis / Komfort / Premium): setzen mehrere Optionen auf einmal – bewährter Verkaufshebel. */
export const PACKAGES = [
  { id: 'basis', name: 'Basis', hint: 'Solide Grundausstattung', set: { coping: 'beton', deck: 'beton', cover: 'none', loungers: 0, light: 'weiss', extras: [] } },
  { id: 'komfort', name: 'Komfort', hint: 'Der Verkaufsschlager', set: { coping: 'stein', deck: 'holz', cover: 'none', loungers: 2, light: 'blau', extras: ['parasol', 'ladder', 'planters'] } },
  { id: 'premium', name: 'Premium', hint: 'Alles, was Spaß macht', set: { coping: 'granit', deck: 'holz', cover: 'roll', loungers: 4, light: 'wechsel', extras: ['parasol', 'ladder', 'jet', 'waterfall', 'heatpump', 'planters'] } },
];
export const TEXT = {
  title: 'Wählen Sie Ihr Modell', lead: 'Fünf Beckenformen, sofort in Ihrem Garten sichtbar.', product: 'Pool', productPlural: 'Pools',
  intro: 'Pool-Planer', mailSubject: 'Pool-Anfrage',
};
export const FINANCE = { enabled: true, months: 120, apr: 5.9 };   // Richtwert Ratenzahlung (effektiver Jahreszins in %)
export const OPS = { base: 280, perM3: 11 };                       // Betriebskosten pro Jahr (Strom, Chemie, Wasser) – Richtwert
export const CATALOG = { id: 'pool', label: 'Pool' };

/** Herstellergrenzen für Maßvarianten: Standard = Länge ±15 % (0,25-m-Stufen), Breite ±10 % (0,25-m-Stufen), Tiefe −0,2/+0,3 m (0,1-m-Stufen); je Modell per Katalog (`limits`) überschreibbar. Die Nennmaße liegen immer auf einer Stufe. */
export const VARIANT = { stepL: 0.25, stepW: 0.25, stepD: 0.1, areaFactor: 1, depthSurcharge: 0.015 };         // areaFactor: Anteil des Modellpreises, der mit der Fläche skaliert; depthSurcharge: Aufpreis je 0,1 m Mehrtiefe (Anteil Modellpreis)
const snapRange = (nom, below, above, step, hardMin, hardMax) => {
  const lo = Math.max(hardMin, nom - Math.floor(below / step + 1e-9) * step), hi = Math.min(hardMax, nom + Math.floor(above / step + 1e-9) * step);
  return { min: +lo.toFixed(2), max: +hi.toFixed(2), step };
};
export function limitsOf(m) {
  if (!m) return null;
  const c = m.limits || {}, pick = (k, step, below, above, a, b) => {
    const l = c[k];
    if (Array.isArray(l) && l.length === 3 && l.every((v) => Number.isFinite(+v))) { const st = Math.max(0.05, +l[2]); return { min: Math.min(m[k], Math.max(a, +l[0])), max: Math.max(m[k], Math.min(b, +l[1])), step: st }; }
    return snapRange(m[k], below, above, step, a, b);
  };
  return { length: pick('length', VARIANT.stepL, m.length * 0.15, m.length * 0.15, 1.5, 16), width: pick('width', VARIANT.stepW, m.width * 0.1, m.width * 0.1, 1, 6.5), depth: pick('depth', VARIANT.stepD, 0.2, 0.3, 0.5, 2.4) };
}
/** Konstruktionsregeln (Mindestmaße); je Katalog überschreibbar (`rules`). Siehe rules.js */
export const RULES = { stepsFullMinWidth: 3, stepsRomanMinWidth: 3.5, stepsRomanMinLength: 7, stepsCornerMinWidth: 2, jetMinLength: 5, waterfallMinWidth: 2.5, roofMaxLength: 12, rollMaxLength: 12, permitVolume: 100 };

export const defaultExtras = () => ({ parasol: true, ladder: false, jet: false, waterfall: false, heatpump: false, planters: true, loungers: 2, light: 'weiss' });
export const modelById = (id) => MODELS.find((m) => m.id === id) || MODELS[0];

const eur = (v) => Math.round(v / 50) * 50;
export const fmtEur = (v) => eur(v).toLocaleString('de-DE') + ' €';

/** Preis + Aufschlüsselung. dims aus buildPool().dims, perimeter = Umfang Beckenrand in m */
export function priceOf(state, dims, perimeter) {
  const free = state.model === 'frei', m = free ? { id: 'frei', name: 'Individuell', price: Math.round(FREE.perM2 * state.length * state.width) } : modelById(state.model), lines = [];
  const add = (label, v, sku, qty = 1, unit = 'Stk') => { if (v > 0) lines.push([label, v, { sku, qty, unit }]); };
  const D = (k) => dims[k].toFixed(1).replace('.', ',');
  // Maßvariante eines festen Modells: Preis wächst mit der Fläche (Anteil areaFactor) und der Mehrtiefe; die Abweichung steht als eigene Position
  let base = m.price, variant = 0;
  if (!free && m.length > 0 && m.width > 0) {
    const ratio = (state.length * state.width) / (m.length * m.width), dDepth = Math.max(0, Math.round(((state.depth - m.depth) / 0.1) * 100) / 100);
    variant = Math.round(m.price * ((ratio - 1) * VARIANT.areaFactor + dDepth * VARIANT.depthSurcharge));
  }
  add(`Becken ${m.name} (${D('length')} × ${D('width')} m)`, base, m.sku || `DEMO-BECKEN-${String(m.id).toUpperCase()}`);
  if (variant > 0) add(`Maßanpassung (Länge ${state.length.toFixed(2).replace(/0$/, '').replace('.', ',')} m, Breite ${state.width.toFixed(2).replace(/0$/, '').replace('.', ',')} m, Tiefe ${state.depth.toFixed(1).replace('.', ',')} m)`, variant, `DEMO-MASS-${String(m.id).toUpperCase()}`);
  else if (variant < 0) lines.push([`Maßanpassung (kleiner)`, variant, { sku: `DEMO-MASS-${String(m.id).toUpperCase()}`, qty: 1, unit: 'Stk' }]);
  add('Aushub, Einbau, Hinterfüllung', SETUP.baseFlat + SETUP.perM2 * dims.area, 'DEMO-EINBAU', Math.round(dims.area * 10) / 10, 'm²');
  add('Technik (Filter, Pumpe, Skimmer, Düsen)', SETUP.tech, 'DEMO-TECHNIK');
  add(`Treppe: ${STEP_NAMES[state.steps]}`, STEP_PRICE[state.steps] || 0, `DEMO-TREPPE-${String(state.steps).toUpperCase()}`);
  add(`Beckenfarbe ${LINERS[state.liner].name}`, LINERS[state.liner].price, LINERS[state.liner].sku || `DEMO-FARBE-${String(state.liner).toUpperCase()}`);
  add(`Beckenrand ${COPING[state.coping].name}`, COPING[state.coping].perM * perimeter, COPING[state.coping].sku || `DEMO-RAND-${String(state.coping).toUpperCase()}`, Math.round(perimeter * 10) / 10, 'm');
  const deckArea = (dims.length + 2 * (COPING_W + DECK_W)) * (dims.width + 2 * (COPING_W + DECK_W)) - (dims.length + 2 * COPING_W) * (dims.width + 2 * COPING_W);
  add(`Terrasse ${DECK[state.deck].name} (${Math.round(deckArea)} m²)`, DECK[state.deck].perM2 * deckArea, DECK[state.deck].sku || `DEMO-TERRASSE-${String(state.deck).toUpperCase()}`, Math.round(deckArea), 'm²');
  add(`Abdeckung ${COVER[state.cover].name}`, COVER[state.cover].perM2 * dims.length * dims.width, COVER[state.cover].sku || `DEMO-ABDECKUNG-${String(state.cover).toUpperCase()}`, Math.round(dims.length * dims.width * 10) / 10, 'm²');
  const x = state.extras;
  for (const k of Object.keys(EXTRAS)) if (x[k]) add(EXTRAS[k].name, EXTRAS[k].price, EXTRAS[k].sku || `DEMO-EXTRA-${k.toUpperCase()}`);
  add(`Liegen (${x.loungers})`, LOUNGER.price * x.loungers, 'DEMO-LIEGE', x.loungers);
  add(`Beleuchtung ${LIGHTS[x.light].name}`, LIGHTS[x.light].price, LIGHTS[x.light].sku || `DEMO-LICHT-${String(x.light).toUpperCase()}`);
  const total = lines.reduce((a, l) => a + l[1], 0);
  return { total, lines };
}

/** Stückliste (Muster-Artikelnummern) aus den Preispositionen */
export const bomOf = (price) => price.lines.map(([text, , m]) => ({ artikel: m.sku, text, menge: m.qty, einheit: m.unit }));

/** Monatsrate bei Ratenzahlung (Annuität), Richtwert */
export const monthlyRate = (total) => {
  const i = FINANCE.apr / 100 / 12, n = FINANCE.months;
  return i > 0 ? (total * i) / (1 - (1 + i) ** -n) : total / n;
};
export const yearlyCosts = (volume) => OPS.base + OPS.perM3 * volume;

/* ---------- Katalog aus JSON laden (prüft und begrenzt alle Werte, ersetzt die Standardwerte in place) ---------- */
const str = (v, d, n = 60) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : d);
const num = (v, a, b, d) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.min(b, Math.max(a, +v)) : d);
const hex = (v, d) => (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : d);
const slug = (k) => /^[a-z0-9_-]{1,24}$/i.test(k);
function replace(target, entries) { for (const k of Object.keys(target)) delete target[k]; Object.assign(target, entries); }

export function applyCatalog(cfg) {
  if (!cfg || typeof cfg !== 'object') return false;
  if (Array.isArray(cfg.models)) {
    const ms = cfg.models.slice(0, 12).filter((m) => m && slug(String(m.id))).map((m) => ({
      id: String(m.id), name: str(m.name, 'Modell', 30), tag: str(m.tag, '', 24), shape: SHAPE_IDS.includes(m.shape) ? m.shape : 'rect',
      length: num(m.length, 1.5, 16, 6), width: num(m.width, 1, 6.5, 3), depth: num(m.depth, 0.5, 2.4, 1.5),
      steps: ['none', 'corner', 'roman', 'full'].includes(m.steps) ? m.steps : 'none', price: num(m.price, 0, 5e6, 0),
      sku: m.sku ? str(m.sku, '', 30) : undefined, limits: m.limits && typeof m.limits === 'object' ? m.limits : undefined,
    }));
    if (ms.length) { MODELS.length = 0; MODELS.push(...ms); }
  }
  const opts = (src, keys, map) => { if (src && typeof src === 'object') { const e = {}; for (const [k, v] of Object.entries(src).slice(0, 12)) if (slug(k) && keys(k) && v && typeof v === 'object') e[k] = map(v, k); return Object.keys(e).length ? e : null; } return null; };
  const liners = opts(cfg.liners, () => true, (v) => ({ name: str(v.name, 'Farbe', 24), hex: hex(v.hex, 0x2c86c6), price: num(v.price, 0, 1e5, 0), sku: v.sku ? str(v.sku, '', 30) : undefined }));
  if (liners) replace(LINERS, liners);
  const coping = opts(cfg.coping, (k) => ['stein', 'granit', 'beton'].includes(k), (v) => ({ name: str(v.name, 'Rand', 24), perM: num(v.perM, 0, 2000, 0), sku: v.sku ? str(v.sku, '', 30) : undefined }));
  if (coping) replace(COPING, coping);
  const deck = opts(cfg.deck, (k) => ['holz', 'stein', 'beton', 'gras'].includes(k), (v) => ({ name: str(v.name, 'Terrasse', 24), perM2: num(v.perM2, 0, 2000, 0), sku: v.sku ? str(v.sku, '', 30) : undefined }));
  if (deck) replace(DECK, deck);
  const cover = opts(cfg.cover, (k) => ['none', 'roll', 'roof'].includes(k), (v) => ({ name: str(v.name, 'Abdeckung', 24), perM2: num(v.perM2, 0, 2000, 0), sku: v.sku ? str(v.sku, '', 30) : undefined }));
  if (cover && cover.none) replace(COVER, cover);
  const lights = opts(cfg.lights, (k) => ['weiss', 'blau', 'gruen', 'wechsel'].includes(k), (v, k) => ({ name: str(v.name, 'Licht', 24), hex: hex(v.hex, LIGHTS[k] ? LIGHTS[k].hex : 0xffffff), price: num(v.price, 0, 1e5, 0) }));
  if (lights && lights.weiss) replace(LIGHTS, lights);
  const extras = opts(cfg.extras, (k) => ['parasol', 'ladder', 'jet', 'waterfall', 'heatpump', 'planters'].includes(k), (v) => ({ name: str(v.name, 'Extra', 30), price: num(v.price, 0, 2e5, 0), hint: str(v.hint, '', 50), sku: v.sku ? str(v.sku, '', 30) : undefined }));
  if (extras) replace(EXTRAS, extras);
  if (cfg.stepPrice && typeof cfg.stepPrice === 'object') for (const k of Object.keys(STEP_PRICE)) STEP_PRICE[k] = num(cfg.stepPrice[k], 0, 1e5, STEP_PRICE[k]);
  if (cfg.loungerPrice !== undefined) LOUNGER.price = num(cfg.loungerPrice, 0, 1e5, LOUNGER.price);
  if (cfg.setup) for (const k of Object.keys(SETUP)) SETUP[k] = num(cfg.setup[k], 0, 1e6, SETUP[k]);
  if (cfg.rules && typeof cfg.rules === 'object') for (const k of Object.keys(RULES)) RULES[k] = num(cfg.rules[k], 0, 100, RULES[k]);
  if (cfg.variant && typeof cfg.variant === 'object') { VARIANT.areaFactor = num(cfg.variant.areaFactor, 0, 2, VARIANT.areaFactor); VARIANT.depthSurcharge = num(cfg.variant.depthSurcharge, 0, 0.2, VARIANT.depthSurcharge); }
  if (cfg.freePerM2) FREE.perM2 = num(cfg.freePerM2, 0, 1e5, FREE.perM2);
  if (cfg.finance) Object.assign(FINANCE, { enabled: cfg.finance.enabled !== false, months: num(cfg.finance.months, 6, 240, FINANCE.months), apr: num(cfg.finance.apr, 0, 25, FINANCE.apr) });
  if (cfg.ops) Object.assign(OPS, { base: num(cfg.ops.base, 0, 1e5, OPS.base), perM3: num(cfg.ops.perM3, 0, 1e4, OPS.perM3) });
  if (Array.isArray(cfg.packages)) {
    const ps = cfg.packages.slice(0, 4).filter((p) => p && slug(String(p.id))).map((p) => ({ id: String(p.id), name: str(p.name, 'Paket', 20), hint: str(p.hint, '', 40), set: p.set && typeof p.set === 'object' ? p.set : {} }));
    PACKAGES.length = 0; PACKAGES.push(...ps);
  }
  if (cfg.text && typeof cfg.text === 'object') for (const k of Object.keys(TEXT)) TEXT[k] = str(cfg.text[k], TEXT[k], 90);
  CATALOG.id = str(cfg.id, CATALOG.id, 24); CATALOG.label = str(cfg.label, CATALOG.label, 24);
  return true;
}
