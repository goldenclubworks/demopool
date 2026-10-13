// Laden der CC0-Assets (Poly Haven): PBR-Texturen, HDRI-Kulissen, kleine glTF-Pflanzen. Alles gecacht und bei Bedarf geladen.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* Fortschritt: alle Dateien laufen über einen Manager, der Preloader zeigt den Anteil in Prozent. Nur eigene Dateien, keine externen Server. */
export const manager = new THREE.LoadingManager();
const listeners = new Set(); let lastActivity = performance.now(), total = 0, done = 0;
manager.onStart = (u, l, t) => { total = t; lastActivity = performance.now(); };
manager.onProgress = (u, l, t) => { total = t; done = l; lastActivity = performance.now(); listeners.forEach((f) => f(l / Math.max(1, t))); };
manager.onError = (u) => console.warn('Datei konnte nicht geladen werden:', u);
export const onProgress = (f) => listeners.add(f);
/** Löst auf, wenn alle angeforderten Dateien geladen sind und 350 ms lang keine neue dazukam (Spät-Anforderungen werden mitgenommen). */
export function whenLoaded(maxMs = 30000) {
  const t0 = performance.now();
  return new Promise((res) => { const tick = () => { const now = performance.now(); if ((done >= total && now - lastActivity > 350) || now - t0 > maxMs) res(); else setTimeout(tick, 100); }; tick(); });
}
const texLoader = new THREE.TextureLoader(manager);
const base = import.meta.env.BASE_URL;

function tex(url, srgb, aniso, mpt) {
  // Jede Verwendung bekommt ein eigenes Texture-Objekt (eigene Wiederholung); das Bild kommt aus dem Browser-Cache.
  const t = texLoader.load(base + url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.repeat.set(1 / mpt, 1 / mpt);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** PBR-Satz {map, normalMap, roughnessMap}; `metersPerTile` = Kantenlänge einer Kachel in Metern. */
export function pbr(name, { metersPerTile = 1, aniso = 8, rough = true } = {}) {
  const set = { map: tex(`textures/${name}_diff.jpg`, true, aniso, metersPerTile), normalMap: tex(`textures/${name}_nor.jpg`, false, aniso, metersPerTile) };
  if (rough) set.roughnessMap = tex(`textures/${name}_rough.jpg`, false, aniso, metersPerTile);
  return set;
}

/* ---------- HDRI ---------- */
const hdriCache = new Map();
export function loadHDRI(name) {
  if (!hdriCache.has(name)) {
    hdriCache.set(name, new HDRLoader(manager).loadAsync(`${base}hdri/${name}.hdr`).then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
      return { texture: t, sun: findSun(t) };
    }));
  }
  return hdriCache.get(name);
}

/** Sonne bzw. Mond im Panorama finden: Richtung (Einheitsvektor in HDRI-Koordinaten, y oben) und Farbe. */
function findSun(t) {
  const { data, width: w, height: h } = t.image, half = data instanceof Uint16Array, f = half ? THREE.DataUtils.fromHalfFloat : (v) => v;
  const lum = (i) => 0.2126 * f(data[i]) + 0.7152 * f(data[i + 1]) + 0.0722 * f(data[i + 2]);
  let max = 0;
  const step = 2;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) max = Math.max(max, lum((y * w + x) * 4));
  const dir = new THREE.Vector3(), col = new THREE.Color(); let sum = 0;
  // Die Sonne liegt über dem Horizont: die Zeilenreihenfolge so wählen, dass die Höhe positiv ist
  let upper = 0, lower = 0;
  const acc = [new THREE.Vector3(), new THREE.Vector3()];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4, l = lum(i);
    if (l < max * 0.35) continue;
    const lon = (x / w - 0.5) * Math.PI * 2, rowFromTop = y / h;
    for (let k = 0; k < 2; k++) {
      const lat = (k === 0 ? 0.5 - rowFromTop : rowFromTop - 0.5) * Math.PI;
      acc[k].add(new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).multiplyScalar(l));
    }
    sum += l; col.r += f(data[i]) * l; col.g += f(data[i + 1]) * l; col.b += f(data[i + 2]) * l;
    if (rowFromTop < 0.5) upper += l; else lower += l;
  }
  dir.copy(acc[upper >= lower ? 0 : 1]).normalize();
  col.multiplyScalar(1 / Math.max(sum, 1e-6)); const m = Math.max(col.r, col.g, col.b, 1e-6); col.multiplyScalar(1 / m);
  return { dir, color: col, peak: max };
}

/* ---------- glTF ---------- */
/* Pflanzen-Modelle sind nicht kritisch: sie laden erst nach dem Preloader (eigener Loader, ohne Fortschrittsanzeige) und erscheinen dann */
let gate = Promise.resolve();
export const setModelGate = (p) => { gate = p; };
const gltfCache = new Map();
export function loadModel(id) {
  if (!gltfCache.has(id)) gltfCache.set(id, gate.then(() => new GLTFLoader().loadAsync(`${base}models/${id}/${id}.gltf`)).then((g) => g.scene));
  return gltfCache.get(id);
}
