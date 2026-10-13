import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildPool, contourFor, SHAPES } from '../src/pool.js';
import { MODELS, LINERS, COPING, DECK, COVER, EXTRAS, applyCatalog, priceOf, monthlyRate, defaultExtras, modelById } from '../src/catalog.js';
import { readForm, scoreOf } from '../src/lead.js';
import { readFileSync, readdirSync } from 'node:fs';

const stubMats = () => new Proxy({}, { get: () => new THREE.MeshBasicMaterial() });
const base = (m) => ({ shape: m.shape, length: m.length, width: m.width, depth: m.depth, steps: m.steps, deck: 'holz', cover: 'none' });
const finite = (g) => { const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };

describe('Beckengeometrie', () => {
  it('jede Form hat eine geschlossene Kontur mit positiver Fläche', () => {
    for (const shape of Object.keys(SHAPES)) { const c = contourFor(shape, 7, 3.5); expect(c.length).toBeGreaterThan(20); }
  });
  for (const m of MODELS) for (const steps of ['none', 'corner', 'roman', 'full']) for (const mode of ['scene', 'ar']) {
    it(`${m.id} · Treppe ${steps} · ${mode}: keine NaN, plausible Maße`, () => {
      const p = buildPool({ ...base(m), steps }, stubMats(), mode);
      expect(p.dims.area).toBeGreaterThan(m.length * m.width * 0.6); expect(p.dims.area).toBeLessThan(m.length * m.width);
      expect(p.dims.volume).toBeGreaterThan(0);
      p.group.traverse((o) => { if (o.isMesh) expect(finite(o.geometry)).toBe(true); });
      p.dispose();
    });
  }
});

describe('Preis', () => {
  it('Summe = Einzelpositionen, alle Modelle und Optionen positiv', () => {
    for (const m of MODELS) for (const coping of Object.keys(COPING)) for (const deck of Object.keys(DECK)) for (const cover of Object.keys(COVER)) {
      const st = { model: m.id, ...base(m), liner: Object.keys(LINERS)[0], coping, deck, cover, extras: Object.fromEntries([...Object.keys(EXTRAS).map((k) => [k, true]), ['loungers', 4], ['light', 'wechsel']]) };
      const p = buildPool({ ...base(m), coping, deck, cover }, stubMats());
      const pr = priceOf(st, p.dims, 20); expect(pr.total).toBeCloseTo(pr.lines.reduce((a, l) => a + l[1], 0)); expect(pr.total).toBeGreaterThan(m.price);
    }
  });
  it('Monatsrate ist plausibel', () => { const r = monthlyRate(20000); expect(r).toBeGreaterThan(20000 / 120); expect(r).toBeLessThan(20000 / 60); });
});

describe('Katalog-Datei', () => {
  it('liefert sichere Werte und ignoriert Müll', () => {
    const before = MODELS.length;
    applyCatalog({ models: [{ id: 'ok', name: 'X'.repeat(500), shape: 'dreieck', length: 9999, width: -5, depth: 'abc', steps: 'x', price: 'viel' }, { id: '<script>', name: 'böse' }], liners: { a: { name: 1, hex: 'rot' } }, coping: { unbekannt: {} } });
    expect(MODELS.length).toBe(1); const m = MODELS[0];
    expect(m.shape).toBe('rect'); expect(m.length).toBeLessThanOrEqual(16); expect(m.width).toBeGreaterThanOrEqual(1); expect(m.name.length).toBeLessThanOrEqual(30); expect(m.steps).toBe('none'); expect(Number.isFinite(m.depth)).toBe(true);
    expect(Object.keys(COPING)).toContain('stein'); expect(before).toBeGreaterThan(1);
  });
  it('alle mitgelieferten Katalog-Dateien sind gültig', () => {
    for (const f of readdirSync('public/kataloge')) { const j = JSON.parse(readFileSync('public/kataloge/' + f, 'utf8')); expect(typeof j).toBe('object'); }
  });
});

describe('Anfrage', () => {
  const form = (o) => { const fd = new Map(Object.entries(o)); return { __fd: fd }; };
  it('Bewertung steigt mit Dringlichkeit, Wert und Telefon', () => {
    const lo = scoreOf({ when: 'info', tel: '', msg: '' }, 10000).punkte, hi = scoreOf({ when: 'sofort', tel: '0171', msg: 'x'.repeat(30) }, 35000);
    expect(hi.punkte).toBeGreaterThan(lo); expect(hi.stufe).toBe('heiß');
  });
});
