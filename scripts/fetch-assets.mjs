// Lädt die CC0-Assets (Poly Haven, https://polyhaven.com/license) nach public/. Idempotent.
// Aufruf: npm run assets   (nur zum Erneuern nötig, die Dateien sind bereits eingecheckt)
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'public');
const exists = (p) => access(p).then(() => true, () => false);
async function download(url, file) {
  if (await exists(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log('✓', path.relative(root, file));
}
const api = (id) => fetch(`https://api.polyhaven.com/files/${id}`).then((r) => r.json());

/* Texturen (PBR: Farbe, Normal, Rauheit, 1k) – Name im Projekt : Poly-Haven-ID.
   Hinweis: bark, soil, linen und concrete werden nach dem Download auf 512 px verkleinert, alle JPGs mit 72–80 % neu kodiert (kürzere Ladezeit). */
const TEX = {
  grass: 'leafy_grass',
  decking: 'wooden_planks',
  sandstone: 'sandstone_blocks_08',
  granite: 'granite_tile',
  concrete: 'brushed_concrete_03',
  slabs: 'concrete_tiles_02',
  linen: 'rough_linen',
  bark: 'bark_brown_02',
  soil: 'farm_soil',
};
const MAPS = [['Diffuse', 'diff'], ['nor_gl', 'nor'], ['Rough', 'rough']];
for (const [name, id] of Object.entries(TEX)) {
  const files = await api(id);
  for (const [key, suffix] of MAPS) await download(files[key]['1k'].jpg.url, path.join(root, 'textures', `${name}_${suffix}.jpg`));
}

/* Kleine Pflanzen-Modelle (glTF + Texturen, 1k) */
for (const id of ['potted_plant_04', 'potted_plant_02', 'celandine_01', 'grass_medium_02']) {
  const g = (await api(id)).gltf['1k'].gltf;
  const dir = path.join(root, 'models', id);
  await download(g.url, path.join(dir, `${id}.gltf`));
  for (const [rel, f] of Object.entries(g.include)) await download(f.url, path.join(dir, rel));
}

/* HDRI-Kulissen (1k reicht: die Kulisse wird weichgezeichnet): Tag, Abend, Nacht */
const HDRI = [['meadow_2', '1k', 'day'], ['grasslands_sunset', '1k', 'evening'], ['moonlit_golf', '1k', 'night']];
for (const [id, res, name] of HDRI) {
  const h = await api(id);
  await download(h.hdri[res].hdr.url, path.join(root, 'hdri', `${name}.hdr`));
}
console.log('Fertig.');
