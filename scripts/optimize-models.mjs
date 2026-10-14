// Verkleinert die Pflanzen-Modelle (Poly Haven, CC0) ohne sichtbaren Verlust: Duplikate zusammenführen, Geometrie behutsam vereinfachen
// (fehlerbegrenzt), quantisieren, Texturen als WebP (Qualität 92), alles in eine .glb. Quelle: assets-src/models/<id>/<id>.gltf (npm run assets lädt sie),
// Ergebnis: public/models/<id>.glb.  Aufruf: node scripts/optimize-models.mjs [id ...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, quantize, textureCompress, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..', 'public'), srcRoot = path.resolve(import.meta.dirname, '..', 'assets-src', 'models');
// ratio = Anteil der Dreiecke, error = zulässiger Fehler (Anteil der Modellgröße); 1 = unverändert
// Stufen je Modell: suffix '' = Nahversion (praktisch verlustfrei), '_lod' = nur für große Entfernung (Dreiecke stark reduziert)
const PLAN = {
  potted_plant_02: [{ suffix: '', ratio: 1, error: 0.0001 }, { suffix: '_lod', ratio: 0.3, error: 0.006 }],
  potted_plant_04: [{ suffix: '', ratio: 1, error: 0.0001 }],
  celandine_01: [{ suffix: '', ratio: 0.55, error: 0.002 }],
  grass_medium_02: [{ suffix: '', ratio: 0.6, error: 0.0015 }],
};
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PLAN);
fs.mkdirSync(path.join(root, 'models'), { recursive: true });
for (const id of ids) for (const lv of PLAN[id]) {
  const src = path.join(srcRoot, id, `${id}.gltf`);
  const doc = await io.read(src), p = lv;
  const tri = () => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, pr) => b + (pr.getIndices() ? pr.getIndices().getCount() / 3 : 0), 0), 0);
  const before = tri();
  await doc.transform(dedup(), weld({ tolerance: 0.0001 }), p.ratio < 1 ? simplify({ simplifier: MeshoptSimplifier, ratio: p.ratio, error: p.error, lockBorder: false }) : (d) => d,
    prune(), quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }),       // verlustfreie Geometriekompression (Dekoder: three/addons meshopt_decoder)
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: lv.suffix ? 80 : 92, lossless: false, effort: 6, resize: lv.suffix ? [512, 512] : undefined }));
  const out = path.join(root, 'models', `${id}${lv.suffix}.glb`);
  await io.write(out, doc);
  const srcBytes = fs.readdirSync(path.dirname(src), { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).reduce((a, e) => a + fs.statSync(path.join(e.parentPath || e.path, e.name)).size, 0);
  console.log(`${(id + lv.suffix).padEnd(22)} Dreiecke ${before} → ${tri()} · ${(srcBytes / 1e6).toFixed(2)} MB → ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
}
