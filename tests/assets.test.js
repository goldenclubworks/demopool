import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { classify } from '../src/devicebench.js';

describe('Assets', () => {
  it('Pflanzenmodelle sind kompakt (insgesamt unter 3,5 MB)', () => {
    const files = readdirSync('public/models').filter((f) => f.endsWith('.glb'));
    expect(files.sort()).toEqual(['celandine_01.glb', 'grass_medium_02.glb', 'potted_plant_02.glb', 'potted_plant_02_lod.glb', 'potted_plant_04.glb']);
    const total = files.reduce((a, f) => a + statSync('public/models/' + f).size, 0);
    expect(total).toBeLessThan(3.5e6);
  });
  it('Der Preloader lädt höchstens 9 MB (Standard-Texturen, Pflanzen, Tageshimmel)', () => {
    const tex = ['grass', 'sandstone', 'decking', 'bark', 'soil', 'linen', 'concrete'].flatMap((n) => ['diff', 'nor', 'rough'].map((k) => `public/textures/${n}_${k}.jpg`));
    const bytes = [...tex.filter((f) => { try { statSync(f); return true; } catch { return false; } }), 'public/hdri/day.hdr', ...readdirSync('public/models').map((f) => 'public/models/' + f)].reduce((a, f) => a + statSync(f).size, 0);
    expect(bytes).toBeLessThan(9e6);
  });
});

describe('Geräteklassen', () => {
  it('ordnet nach Verhältnis zur Referenz', () => {
    expect(classify(1.2)).toBe('high'); expect(classify(0.5)).toBe('high'); expect(classify(0.3)).toBe('mid'); expect(classify(0.1)).toBe('low'); expect(classify(0.01)).toBe('low');
  });
});
