import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildPool } from '../src/pool.js';
import { MODELS, LINERS, priceOf, defaultExtras } from '../src/catalog.js';
const stubMats = () => new Proxy({}, { get: () => new THREE.MeshBasicMaterial() });
const finite = (g) => { const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };

import { limitsOf, bomOf } from '../src/catalog.js';
import { applyRules, ruleHints } from '../src/rules.js';

describe('Maßvarianten, Regeln, Stückliste', () => {
  const st = (m, o = {}) => ({ model: m.id, shape: m.shape, length: m.length, width: m.width, depth: m.depth, steps: m.steps, deck: 'holz', coping: 'stein', liner: Object.keys(LINERS)[0], cover: 'none', extras: defaultExtras(), ...o });
  const price = (s) => { const p = buildPool(s, stubMats(), 'scene'); const r = priceOf(s, p.dims, 20); p.dispose(); return r; };
  for (const m of MODELS) {
    it(`${m.id}: Grenzen enthalten das Nennmaß, Schrittweiten positiv`, () => {
      const l = limitsOf(m);
      for (const k of ['length', 'width', 'depth']) { expect(l[k].min).toBeLessThanOrEqual(m[k]); expect(l[k].max).toBeGreaterThanOrEqual(m[k]); expect(l[k].step).toBeGreaterThan(0); }
    });
    it(`${m.id}: Maximalvariante baut sauber, Nennmaß hat keine Maßanpassung`, () => {
      const l = limitsOf(m), s = st(m, { length: l.length.max, width: l.width.max, depth: l.depth.max });
      applyRules(s); const p = buildPool(s, stubMats(), 'scene'); p.group.traverse((o) => { if (o.isMesh) expect(finite(o.geometry)).toBe(true); }); p.dispose();
      expect(price(st(m)).lines.some(([t]) => /Maßanpassung/.test(t))).toBe(false);
    });
  }
  it('Variante kostet mehr, wenn größer', () => {
    const m = MODELS.find((x) => limitsOf(x).length.max > x.length), l = limitsOf(m); expect(m).toBeTruthy(); expect(price(st(m, { length: l.length.max })).total).toBeGreaterThan(price(st(m)).total);
  });
  it('Regeln korrigieren unbaubare Kombinationen mit Meldung', () => {
    const m = MODELS.find((x) => x.shape === 'rect') || MODELS[0], s = st(m, { width: 2, steps: 'full' });
    const f = applyRules(s); expect(f.length).toBeGreaterThan(0); expect(s.steps).not.toBe('full');
  });
  it('Stückliste: jede Position hat Muster-Artikelnummer, Menge und Einheit', () => {
    const b = bomOf(price(st(MODELS[0]))); expect(b.length).toBeGreaterThan(2);
    for (const r of b) { expect(r.artikel).toMatch(/^DEMO-/); expect(r.menge).toBeGreaterThan(0); expect(r.einheit).toBeTruthy(); }
  });
  it('Genehmigungshinweis ab 100 m³', () => {
    expect(ruleHints(st(MODELS[0]), 120).join(' ')).toMatch(/genehmigung/i); 
  });
});
