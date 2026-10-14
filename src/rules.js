// Konstruktionsregeln: verhindern unbaubare Konfigurationen. Reine Funktionen (ohne Oberfläche, gut testbar); Grenzwerte stehen in catalog.js (RULES)
// und sind je Firma über den Katalog (`rules`) überschreibbar. Eine verletzte Regel wird nicht still ignoriert, sondern korrigiert und benannt.
import { RULES, STEP_NAMES, EXTRAS, COVER } from './catalog.js';

const m1 = (v) => (+v).toFixed(1).replace('.', ',');

/**
 * Prüft und korrigiert den Zustand (verändert `state`). Rückgabe: Liste der vorgenommenen Korrekturen als Klartext.
 * Reihenfolge: erst Treppe (hängt an Maßen), dann Extras, dann Abdeckung.
 */
export function applyRules(state) {
  const fixes = [], { length: L, width: W } = state;
  const step = (to, why) => { fixes.push(`${STEP_NAMES[state.steps]} ist hier nicht möglich (${why}) – ${STEP_NAMES[to]} gewählt.`); state.steps = to; };
  if (state.steps === 'full' && W < RULES.stepsFullMinWidth) step(W >= RULES.stepsCornerMinWidth ? 'corner' : 'none', `Breite mindestens ${m1(RULES.stepsFullMinWidth)} m`);
  if (state.steps === 'roman' && (W < RULES.stepsRomanMinWidth || L < RULES.stepsRomanMinLength)) step(W >= RULES.stepsCornerMinWidth ? 'corner' : 'none', `Breite mindestens ${m1(RULES.stepsRomanMinWidth)} m und Länge mindestens ${m1(RULES.stepsRomanMinLength)} m`);
  if (state.steps === 'corner' && W < RULES.stepsCornerMinWidth) step('none', `Breite mindestens ${m1(RULES.stepsCornerMinWidth)} m`);
  const x = state.extras;
  if (x.jet && L < RULES.jetMinLength) { x.jet = false; fixes.push(`${EXTRAS.jet ? EXTRAS.jet.name : 'Gegenstromanlage'} braucht mindestens ${m1(RULES.jetMinLength)} m Beckenlänge – abgewählt.`); }
  if (x.waterfall && W < RULES.waterfallMinWidth) { x.waterfall = false; fixes.push(`${EXTRAS.waterfall ? EXTRAS.waterfall.name : 'Wasserfall'} braucht mindestens ${m1(RULES.waterfallMinWidth)} m Beckenbreite – abgewählt.`); }
  if (state.cover === 'roof' && L > RULES.roofMaxLength) { state.cover = 'roll'; fixes.push(`${COVER.roof ? COVER.roof.name : 'Überdachung'} ist nur bis ${m1(RULES.roofMaxLength)} m Länge lieferbar – ${COVER.roll ? COVER.roll.name : 'Rollladen'} gewählt.`); }
  if (state.cover === 'roll' && L > RULES.rollMaxLength) { state.cover = 'none'; fixes.push(`${COVER.roll ? COVER.roll.name : 'Rollladen'} ist nur bis ${m1(RULES.rollMaxLength)} m Länge lieferbar – offen gewählt.`); }
  return fixes;
}

/** Hinweise ohne Korrektur (Planung, Genehmigung); volume in m³ */
export function ruleHints(state, volume) {
  const h = [];
  if (volume > RULES.permitVolume) h.push(`Mit ca. ${m1(volume)} m³ Beckeninhalt ist in den meisten Bundesländern eine Baugenehmigung nötig. Bitte frühzeitig bei der Gemeinde klären.`);
  else h.push(`Pools bis ${RULES.permitVolume} m³ (hier ca. ${m1(volume)} m³) sind in vielen Bundesländern genehmigungsfrei. Die Landesbauordnung und örtliche Satzungen sind trotzdem zu prüfen.`);
  return h;
}
