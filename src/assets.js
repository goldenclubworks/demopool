// Laden der CC0-Assets (Poly Haven): PBR-Texturen, HDRI-Kulissen, kleine glTF-Pflanzen. Alles gecacht und bei Bedarf geladen.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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

/* Ersatz bei fehlender Datei (Netz weg, Datei blockiert): eine Farbfläche statt Schwarz, die App läuft weiter */
const FALLBACK = { grass: '#4a6a2a', decking: '#9c7650', sandstone: '#cbb89a', granite: '#55595e', concrete: '#9a9a98', slabs: '#8c8c8a', linen: '#d8d2c4', bark: '#5b4636', soil: '#5a4333' };
function solid(color) { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 4, 4); return c; }
function tex(url, srgb, aniso, mpt, name, kind) {
  // Jede Verwendung bekommt ein eigenes Texture-Objekt (eigene Wiederholung); das Bild kommt aus dem Browser-Cache.
  // Fehlt die Datei, tritt eine neutrale Farbfläche an die Stelle (nie Schwarz). Ein Material wird erst benutzt, wenn alle Bilder da sind (texturesReady).
  const t = texLoader.load(base + url, undefined, undefined, () => { t.image = solid(kind === 'nor' ? '#8080ff' : kind === 'rough' ? '#ffffff' : FALLBACK[name] || '#808080'); t.needsUpdate = true; });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.repeat.set(1 / mpt, 1 / mpt);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** PBR-Satz {map, normalMap, roughnessMap}; `metersPerTile` = Kantenlänge einer Kachel in Metern. */
export function pbr(name, { metersPerTile = 1, aniso = 8, rough = true } = {}) {
  const set = { map: tex(`textures/${name}_diff.jpg`, true, aniso, metersPerTile, name, 'diff'), normalMap: tex(`textures/${name}_nor.jpg`, false, aniso, metersPerTile, name, 'nor') };
  if (rough) set.roughnessMap = tex(`textures/${name}_rough.jpg`, false, aniso, metersPerTile, name, 'rough');
  return set;
}

/* ---------- HDRI ---------- */
/** Ersatzhimmel (Verlauf), falls die HDRI-Datei nicht kommt: Himmelblau → heller Horizont → Wiesengrün; Sonne ca. 40° hoch */
function fallbackSky(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'), night = name === 'night', eve = name === 'evening';
  const g = x.createLinearGradient(0, 0, 0, 128);
  const cols = night ? [[0, '#0a1020'], [0.5, '#1a2538'], [0.52, '#0d1510'], [1, '#080c08']] : eve ? [[0, '#4a6a9a'], [0.45, '#f0b48a'], [0.5, '#c88a6a'], [0.52, '#3a4a2a'], [1, '#222a18']] : [[0, '#4f86c6'], [0.45, '#b9d6ee'], [0.5, '#dfe9ee'], [0.52, '#5a7a3a'], [1, '#34471f']];
  for (const [p, col] of cols) g.addColorStop(p, col); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true;
  const dir = new THREE.Vector3(0.6, night ? 0.5 : eve ? 0.12 : 0.65, 0.5).normalize();
  return { texture: t, sun: { dir, color: new THREE.Color(night ? 0.7 : 1, night ? 0.8 : 0.93, night ? 1 : eve ? 0.75 : 0.85), peak: 1, horizon: new THREE.Color(night ? 0.01 : 0.55, night ? 0.015 : 0.62, night ? 0.03 : 0.66) }, fallback: true };
}
const hdriCache = new Map();
export function loadHDRI(name) {
  if (!hdriCache.has(name)) {
    hdriCache.set(name, new HDRLoader(manager).loadAsync(`${base}hdri/${name}.hdr`).catch((e) => { console.warn('Himmel konnte nicht geladen werden, Ersatzhimmel:', e && e.message); return null; }).then((t) => {
      if (!t) return fallbackSky(name);
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
      return { texture: t, sun: findSun(t) };
    }));
  }
  return hdriCache.get(name);
}

/** Sonne bzw. Mond im Panorama finden: Richtung (Einheitsvektor in HDRI-Koordinaten, y oben) und Farbe. Abtastung in Schritten, ohne Objekt-Allokation. */
function findSun(t) {
  const { data, width: w, height: h } = t.image, half = data instanceof Uint16Array, f = half ? THREE.DataUtils.fromHalfFloat : (v) => v, step = 4;
  const lum = (i) => 0.2126 * f(data[i]) + 0.7152 * f(data[i + 1]) + 0.0722 * f(data[i + 2]);
  let max = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { const l = lum((y * w + x) * 4); if (l > max) max = l; }
  // Die Sonne liegt über dem Horizont: die Zeilenreihenfolge so wählen, dass die Höhe positiv ist
  const ax = [0, 0], ay = [0, 0], az = [0, 0]; let sum = 0, upper = 0, lower = 0, cr = 0, cg = 0, cb = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4, l = lum(i); if (l < max * 0.35) continue;
    const lon = (x / w - 0.5) * Math.PI * 2, row = y / h, cl = Math.cos(lon), sl = Math.sin(lon);
    for (let k = 0; k < 2; k++) { const lat = (k === 0 ? 0.5 - row : row - 0.5) * Math.PI, c = Math.cos(lat); ax[k] += c * cl * l; ay[k] += Math.sin(lat) * l; az[k] += c * sl * l; }
    sum += l; cr += f(data[i]) * l; cg += f(data[i + 1]) * l; cb += f(data[i + 2]) * l; if (row < 0.5) upper += l; else lower += l;
  }
  const k = upper >= lower ? 0 : 1, dir = new THREE.Vector3(ax[k], ay[k], az[k]).normalize();
  const col = new THREE.Color(cr / Math.max(sum, 1e-6), cg / Math.max(sum, 1e-6), cb / Math.max(sum, 1e-6)); col.multiplyScalar(1 / Math.max(col.r, col.g, col.b, 1e-6));
  // Horizontfarbe (Mittelwert des Bandes um die Horizontlinie): Farbe des Dunstes in der Ferne
  const hz = new THREE.Color(); let hn = 0;
  for (let y = Math.floor(h * 0.47); y < Math.floor(h * 0.5); y += 2) for (let x = 0; x < w; x += 8) { const i = (y * w + x) * 4; hz.r += f(data[i]); hz.g += f(data[i + 1]); hz.b += f(data[i + 2]); hn++; }
  hz.multiplyScalar(1 / Math.max(hn, 1));
  return { dir, color: col, peak: max, horizon: hz };
}

/** Kopie des Panoramas OHNE Sonnenscheibe (Helligkeit gedeckelt) – nur für das Umgebungslicht.
 *  Sonst steckt die Sonne doppelt in der Szene: als schattenwerfendes Licht UND verschmiert im Umgebungslicht,
 *  das hellt jeden Schatten auf und das Bild wirkt wie bei Hochnebel. Grenze: ein Vielfaches der mittleren Himmelshelligkeit. */
export function sunlessTexture(t, factor = 4) {
  if (!t.image || !t.image.data) return t;                         // Ersatzhimmel (Canvas): hat keine Sonnenscheibe
  const { data, width: w, height: h } = t.image, half = data instanceof Uint16Array;
  const from = half ? THREE.DataUtils.fromHalfFloat : (v) => v, to = half ? THREE.DataUtils.toHalfFloat : (v) => v;
  let sum = 0, n = 0;
  for (let y = 0; y < h / 2; y += 2) for (let x = 0; x < w; x += 4) { const i = (y * w + x) * 4; sum += 0.2126 * from(data[i]) + 0.7152 * from(data[i + 1]) + 0.0722 * from(data[i + 2]); n++; }
  const limit = Math.max(0.05, (sum / Math.max(n, 1)) * factor);
  const out = new data.constructor(data.length); out.set(data);
  for (let i = 0; i < out.length; i += 4) {
    const l = 0.2126 * from(out[i]) + 0.7152 * from(out[i + 1]) + 0.0722 * from(out[i + 2]);
    if (l > limit) { const k = limit / l; out[i] = to(from(out[i]) * k); out[i + 1] = to(from(out[i + 1]) * k); out[i + 2] = to(from(out[i + 2]) * k); }
  }
  const c = new THREE.DataTexture(out, w, h, t.format, t.type); c.mapping = THREE.EquirectangularReflectionMapping; c.colorSpace = t.colorSpace;
  c.minFilter = THREE.LinearFilter; c.magFilter = THREE.LinearFilter; c.generateMipmaps = false; c.flipY = t.flipY; c.needsUpdate = true;
  return c;
}

/* ---------- glTF ---------- */
/* Pflanzen-Modelle laufen über denselben Manager: der Preloader wartet auf sie, nichts erscheint später „nachgeladen“. Fehlt ein Modell, wird es übersprungen. */
const gltfCache = new Map();
export function loadModel(id) {
  if (!gltfCache.has(id)) gltfCache.set(id, new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).loadAsync(`${base}models/${id}.glb`).then((g) => g.scene).catch((e) => { console.warn('Modell fehlt:', id, e && e.message); return new THREE.Group(); }));
  return gltfCache.get(id);
}
export const modelsReady = () => Promise.all([...gltfCache.values()]);

/** true, wenn alle Texturen des Materials fertig geladen sind (sonst würde es schwarz erscheinen) */
export const texturesReady = (m) => ['map', 'normalMap', 'roughnessMap'].every((k) => !m[k] || (m[k].image && (m[k].image.complete !== false) && (m[k].image.width || m[k].image.videoWidth)));
