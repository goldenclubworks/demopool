import * as THREE from 'three';
import qrcode from 'qrcode-generator';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { createMaterials } from './materials.js';
import { createPost } from './post.js';
import { createProbe } from './probe.js';
import { loadHDRI, onProgress, whenLoaded, setModelGate } from './assets.js';
import { buildPool, groundGeometry, patchGeometry } from './pool.js';
import { buildExtras } from './extras.js';
import { buildGarden } from './garden.js';
import { COPING_W } from './pool.js';
import { MODELS, LINERS, STEP_NAMES, COPING, DECK, COVER, TIMES, LIGHTS, EXTRAS, PACKAGES, TEXT, FINANCE, CATALOG, modelById, defaultExtras, priceOf, fmtEur, monthlyRate, yearlyCosts, applyCatalog } from './catalog.js';
import { initUI } from './ui.js';
import { track, setSink } from './track.js';
import { formHtml, readForm, scoreOf, inboxHtml, send as sendLead } from './lead.js';

const T0 = performance.now(), dbg = new URLSearchParams(location.search).has('debug'), tick = (l) => { if (dbg) console.info('[perf]', l, Math.round(performance.now() - T0), 'ms'); };
const $ = (s) => document.querySelector(s);
/* Lader: Anteil = Dateien (82 %) + Startschritte (18 %), nie rückwärts; Statuszeile nennt den aktuellen Schritt. Lange Rechenphasen geben dem Browser Zeit zum Zeichnen (wichtig auf Handys). */
const ld = (() => {
  let shown = 0, stage = 0, files = 0; const bar = $('#ld-bar'), pct = $('#ld-pct'), st = $('#ld-status');
  const render = (force) => { shown = Math.max(shown, force ? 1 : Math.min(0.99, 0.82 * files + 0.18 * stage)); if (bar) bar.style.transform = `scaleX(${shown})`; if (pct) pct.textContent = `${Math.round(shown * 100)} %`; };
  return { files(f) { files = f; render(); }, stage(label, part) { if (part > stage) stage = part; if (label && st) st.textContent = label; render(); }, done() { render(true); } };
})();
const paint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const canvas = $('#c');
const params = new URLSearchParams(location.search);
const ua = navigator.userAgent;
const isTouchPhone = /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = params.has('mobile') || matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const showPrices = params.get('preise') !== '0';
const safe = params.has('safe');                                   // Sicherheitsmodus: weniger Grafik (automatisch nach einem Grafikabbruch oder per ?safe=1)
const embed = params.has('embed');
if (embed) document.documentElement.classList.add('embed');

/* ---------- Firmen-Datei: Katalog + Marke + Endpunkte in EINER JSON (?katalog=spa oder ?katalog=https://…/firma.json) ---------- */
async function loadTenant() {
  const k = params.get('katalog'); if (!k) return null;
  const url = /^https:\/\/[^\s"'<>]+$/i.test(k) ? k : /^[a-z0-9_-]{1,24}$/i.test(k) ? `${import.meta.env.BASE_URL}kataloge/${k}.json` : null;
  if (!url) return { error: true };
  try { const r = await fetch(url, { credentials: 'omit' }); if (!r.ok) throw new Error(r.status); const j = await r.json(); applyCatalog(j); return j; } catch (e) { console.warn('Katalog konnte nicht geladen werden', e); return { error: true }; }
}
const tenant = await loadTenant();
if (tenant && tenant.error) setTimeout(() => toast('Katalog nicht gefunden – es wird der Standardkatalog angezeigt'), 2500);
const tb = (tenant && tenant.brand) || {};
const httpsUrl = (v) => (typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : '');
const hexColor = (v) => (/^#?[0-9a-f]{6}$/i.test(v || '') ? '#' + v.replace('#', '') : null);
const mailOk = (v) => (/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v || '') ? v : '');
/* ---------- Personalisierung: Datei, überschrieben per Link ?firma=…&farbe=%230a6ebd&logo=https://…&mail=anfrage@… ---------- */
const brand = {
  firma: (params.get('firma') || tb.firma || '').toString().trim().slice(0, 60),
  farbe: hexColor(params.get('farbe')) || hexColor(tb.farbe),
  logo: httpsUrl(params.get('logo')) || httpsUrl(tb.logo) || null,
  mail: mailOk(params.get('mail')) || mailOk(tb.mail),
  tel: (tb.tel || '').toString().slice(0, 30), adresse: (tb.adresse || '').toString().slice(0, 100),
  datenschutz: httpsUrl(tb.datenschutz), impressum: httpsUrl(tb.impressum),
  lead: httpsUrl(params.get('lead')) || httpsUrl(tb.lead), stats: httpsUrl(params.get('stats')) || httpsUrl(tb.stats),
};
if (brand.farbe) document.documentElement.style.setProperty('--accent', brand.farbe);
$('#brand-name').textContent = brand.firma || TEXT.intro;
document.title = brand.firma ? `${TEXT.intro} – ${brand.firma}` : TEXT.intro;
$('#brand-eyebrow').textContent = brand.firma ? TEXT.intro : '3D-Konfigurator';
if (brand.logo) { const i = $('#brand-logo'); i.src = brand.logo; i.hidden = false; i.addEventListener('error', () => { i.hidden = true; }); }
{ const f = $('#foot'); const l = [['Impressum', brand.impressum], ['Datenschutz', brand.datenschutz]].filter((x) => x[1]).map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join(' · '); if (l) f.innerHTML += ` ${l}`; }
setSink({ url: brand.stats, embed, catalog: CATALOG.id });

/* ---------- Konfiguration ---------- */
const first = (o, pref) => (pref in o ? pref : Object.keys(o)[0]);
const state = { model: MODELS[0].id, shape: 'round', length: 7, width: 3.5, depth: 1.5, steps: 'corner', liner: Object.keys(LINERS)[0], coping: first(COPING, 'stein'), deck: first(DECK, 'holz'), cover: 'none', time: 'day', garden: true, extras: defaultExtras() };
for (const k of Object.keys(state.extras)) if (!(k in EXTRAS) && !['loungers', 'light'].includes(k)) state.extras[k] = false;
function applyModel(id) { const m = modelById(id); Object.assign(state, { model: m.id, shape: m.shape, length: m.length, width: m.width, depth: m.depth, steps: m.steps }); }
applyModel(MODELS[Math.min(1, MODELS.length - 1)].id);
const clampNum = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);
function applyCfg(c) {
  if (!c || typeof c !== 'object') return;
  if (MODELS.some((m) => m.id === c.model)) applyModel(c.model);
  else if (c.model === 'frei' || ['rect', 'round', 'oval', 'roman', 'kidney'].includes(c.shape)) {      // freie Maße / alte Links ohne Modell
    state.model = 'frei'; if (['rect', 'round', 'oval', 'roman', 'kidney'].includes(c.shape)) state.shape = c.shape;
    state.length = clampNum(c.length, 1.5, 16, state.length); state.width = clampNum(c.width, 1, 6.5, state.width); state.depth = clampNum(c.depth, 0.5, 2.4, state.depth);
  }
  if (c.steps in STEP_NAMES) state.steps = c.steps;
  if (c.liner in LINERS) state.liner = c.liner;
  if (c.coping in COPING) state.coping = c.coping;
  if (c.deck in DECK) state.deck = c.deck;
  if (c.cover in COVER) state.cover = c.cover;
  if (c.time in TIMES) state.time = c.time;
  if (typeof c.garden === 'boolean') state.garden = c.garden;
  if (c.extras && typeof c.extras === 'object') {
    for (const k of Object.keys(EXTRAS)) if (typeof c.extras[k] === 'boolean') state.extras[k] = c.extras[k];
    if ([0, 1, 2, 4].includes(c.extras.loungers)) state.extras.loungers = c.extras.loungers;
    if (c.extras.light in LIGHTS) state.extras.light = c.extras.light;
  }
}
try { const m = location.hash.match(/cfg=([\w-]+)/); if (m) applyCfg(JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))))); } catch { /* ungültiger Link */ }
if (params.has('frei') && state.model !== 'frei') state.model = 'frei';
let hashT = 0;
const saveHash = () => { clearTimeout(hashT); hashT = setTimeout(writeHash, 250); };
const writeHash = () => { try { history.replaceState(null, '', '#cfg=' + btoa(unescape(encodeURIComponent(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); } catch { /* egal */ } };

/* ---------- Renderer / Szene ---------- */
const tier0 = ['high', 'medium', 'low'].includes(params.get('q')) ? params.get('q') : safe ? 'medium' : 'high';          // immer die höchste Stufe; reicht die Leistung nicht, sinkt zuerst nur die Auflösung (siehe Leistungsregler)
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' }); }
catch (e) { $('#loading').innerHTML = 'Die 3D-Ansicht wird von diesem Gerät oder Browser nicht unterstützt.<br>Bitte einen aktuellen Browser (Safari, Chrome, Firefox, Edge) verwenden.'; throw e; }
canvas.addEventListener('webglcontextlost', (e) => {                // z. B. Speichermangel auf dem Handy: einmal im Sicherheitsmodus neu starten (keine Schleife)
  e.preventDefault();
  if (!safe) { const u = new URL(location.href); u.searchParams.set('safe', '1'); toast('Die Grafik wurde unterbrochen – Sicherheitsmodus wird geladen …'); setTimeout(() => location.replace(u), 1200); }
  else toast('Die Grafik wurde unterbrochen – bitte Seite neu laden');
});
const NATIVE = Math.max(1, Math.min(devicePixelRatio, safe ? 1.25 : isMobile ? 2 : 3, Math.sqrt((safe ? 1.2e6 : isMobile ? 2.4e6 : 4.6e6) / (innerWidth * innerHeight))));   // volle Pixeldichte; Handys/Tablets max. 2× und 2,4 MP (Speicher), Desktop 4,6 MP
const SCALES = [1, 0.9, 0.8, 0.72, 0.65, 0.58, 0.52];                                                      // Stufen der dynamischen Auflösung
const perf = { tierUpAt: 0, scale: [...SCALES].reverse().find((v) => v >= (+params.get('scale') || 1) - 1e-6) || 1, good: 0, last: 0, noUpUntil: 0, raisedAt: 0 };
let dpr = NATIVE * perf.scale;
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.NoToneMapping;                         // Tone-Mapping läuft in der Nachbearbeitung (post.js)
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
const stage = new THREE.Group(); scene.add(stage);                 // alles, was zum Becken gehört (verschiebbar im Foto-Modus)
const camera = new THREE.PerspectiveCamera(38, 1, 0.2, 700);
const post = createPost(renderer, scene, camera, tier0);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 2.5; controls.maxDistance = 42; controls.minPolarAngle = 0.1; controls.maxPolarAngle = 1.46; controls.enablePan = false;
controls.rotateSpeed = isMobile ? 0.6 : 1; controls.zoomSpeed = isMobile ? 0.9 : 1; controls.dampingFactor = isMobile ? 0.12 : 0.08; controls.autoRotateSpeed = 1.1;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };   // Pan ist aus: zwei Finger = Zoom
let shadowDirty = true;

/* Himmel (Foto-HDRI als Kulisse und Beleuchtung), Sonne */
const pmrem = new THREE.PMREMGenerator(renderer);
const sun = new THREE.DirectionalLight(0xffeedd, 3); sun.castShadow = true; scene.add(sun, sun.target);
sun.shadow.intensity = 0.9; sun.shadow.mapSize.set(safe ? 1024 : isMobile ? 2048 : 4096, safe ? 1024 : isMobile ? 2048 : 4096); sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
// az: gewünschte Himmelsrichtung der Sonne (Grad, in der x-z-Ebene), damit Wasser und Becken von der Kamerarichtung aus schön beleuchtet sind
const TIME = {
  day: { hdri: 'day', fog: 0.0062, grass: 0.8, az: 205, exp: 0.95, env: 0.95, sun: 2.5, bg: 1, lamp: 0, caus: 1, light: 1 },
  evening: { hdri: 'evening', fog: 0.0075, grass: 0.8, az: 215, exp: 0.8, env: 0.85, sun: 2.2, bg: 1, lamp: 0.55, caus: 0.45, light: 0.45 },
  night: { hdri: 'night', fog: 0.007, grass: 0.8, az: 150, exp: 1.15, env: 0.55, sun: 0.55, sunCol: 0x9db4ff, bg: 1, lamp: 1, caus: 0.25, light: 0.07 },
};
let skybox = null, envToken = 0;
const envRT = {};
async function setTime(key) {
  const t = TIME[key], token = ++envToken, h = await loadHDRI(t.hdri);
  if (token !== envToken) return;
  if (!started) await paint();
  const rot = Math.atan2(h.sun.dir.z, h.sun.dir.x) - THREE.MathUtils.degToRad(t.az);          // Drehung der Kulisse um y, damit die Sonne bei az steht
  const dir = h.sun.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  sun.position.copy(dir).multiplyScalar(60);
  sun.intensity = t.sun; sun.color.copy(t.sunCol ? tmpC.set(t.sunCol) : h.sun.color).lerp(new THREE.Color(1, 1, 1), t === TIME.day ? 0.25 : 0);
  if (!envRT[key]) envRT[key] = pmrem.fromEquirectangular(h.texture);
  scene.environment = envRT[key].texture; scene.environmentIntensity = t.env; scene.environmentRotation.set(0, rot, 0);
  if (skybox) { scene.remove(skybox); skybox.geometry.dispose(); skybox.material.dispose(); }
  skybox = new GroundedSkybox(h.texture, 3, 320);
  skybox.material.onBeforeCompile = (sh) => {
    // weich (Mip-Bias) und der Boden der Kulisse wird zur Rasenfarbe gezogen, damit der Übergang vom Rasen nahtlos ist
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLY;')
      .replace('#include <map_fragment>', `vec4 sampledDiffuseColor = texture2D( map, vMapUv, 1.5 ); diffuseColor *= sampledDiffuseColor;
      float gm = smoothstep(0.0, -1.5, vLY); float gl = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.42, 0.18) * gl * ${t.grass.toFixed(2)}, gm);`);
  };
  skybox.material.fog = false; skybox.material.color.setScalar(t.bg); skybox.material.depthWrite = false; skybox.renderOrder = 1000; skybox.frustumCulled = false; skybox.rotation.y = -rot; skybox.position.y = 3 - 2.7; scene.add(skybox);
  scene.fog = new THREE.FogExp2(h.sun.horizon.clone().multiplyScalar(t.bg * 0.92), t.fog); post.setExposure(t.exp); U.uCaus.value = t.caus; U.uLight.value = t.light; U.uSunCol.value.copy(sun.color);
  setLamps(t.lamp); post.setGlow(t.lamp > 0 || params.has('glow')); scheduleProbe();
  shadowDirty = true;
  if (window.__app) window.__app.sunDir = dir;
}

/* ---------- Materialien ---------- */
const aniso = Math.min(isMobile ? 4 : 16, renderer.capabilities.getMaxAnisotropy());
tick('renderer+post');
const { mats, U, copingMats, deckMats, ground: groundMat, ensure, prefetch } = createMaterials({ aniso, isMobile });
tick('materials+texturen'); ld.stage('Szene wird aufgebaut …', 0.2); await paint();
const loaded = new Promise((res) => setTimeout(() => whenLoaded().then(res), 0));      // alle bis hierher angeforderten Dateien
setModelGate(loaded);
function applyLiner() {
  const h = LINERS[state.liner].hex;
  mats.liner.color.setHex(h); mats.waterAR.color.setHex(h);
  U.uScatter.value.setHex(h).multiplyScalar(0.3).lerp(new THREE.Color(0.02, 0.2, 0.26), 0.55);
}
function setLinerColor() { applyLiner(); invalidateAR(); }
applyLiner();

/* ---------- Rasen mit Beckenöffnung ---------- */
const ground = new THREE.Mesh(new THREE.BufferGeometry(), groundMat); ground.name = 'rasen'; ground.receiveShadow = true; ground.renderOrder = -1; stage.add(ground);
const patch = new THREE.Mesh(new THREE.BufferGeometry(), groundMat); patch.name = 'rasen-vorher'; patch.visible = false; patch.receiveShadow = true; patch.renderOrder = -1; stage.add(patch);

/* ---------- Pool, Zubehör, Garten ---------- */
let pool = null, extras = null, garden = null, before = false;
const probe = createProbe(renderer, scene, isMobile || safe ? 128 : 256); let probeT = 0, probeOn = false;
/** Wasserspiegelung der Umgebung neu aufnehmen – erst, wenn 0,7 s nichts geändert wurde (kein Ruckeln bei der Bedienung) */
function scheduleProbe() {
  clearTimeout(probeT);
  probeT = setTimeout(() => {
    if (!pool || photo.on || lite || safe || post.tier === 'low') return;
    const w = pool.group.getObjectByName('wasser'); mats.water.envMap = probe.update([w, occluder, shadowCatcher].filter(Boolean));
    if (!probeOn) { probeOn = true; mats.water.needsUpdate = true; }
  }, 700);
}
const lampLights = [];
for (let i = 0; i < (isMobile ? 2 : 4); i++) { const l = new THREE.PointLight(0x9fe3ff, 0, 5.5, 2); l.visible = false; stage.add(l); lampLights.push(l); }
let lampLevel = 0;
const tmpC = new THREE.Color();
function applyLightColor(tSec = 0) {
  const k = state.extras.light, c = k === 'wechsel' ? tmpC.setHSL((tSec * 0.05) % 1, 0.85, 0.55) : tmpC.setHex(LIGHTS[k].hex);
  mats.lamp.emissive.copy(c); lampLights.forEach((l) => l.color.copy(c));
  mats.liner.emissive.copy(c).lerp(new THREE.Color(LINERS[state.liner].hex), k === 'weiss' ? 0.6 : 0.15);
}
function setLamps(level) {
  lampLevel = level;
  mats.lamp.emissiveIntensity = level * 3; mats.liner.emissiveIntensity = level * 0.45;
  lampLights.forEach((l, i) => { const on = level > 0 && pool && pool.group.userData.lamps?.[i]; l.intensity = on ? level * 22 : 0; l.visible = !!on && !lite; });
  if (garden) garden.setNight(level);
  applyLightColor(performance.now() / 1000);
}
const matSet = () => { const c = copingMats[state.coping] || copingMats.stein, d = deckMats[state.deck] || deckMats.stein; ensure(c); ensure(d); return { ...mats, coping: c, deck: d }; };
function buildExtrasNow() {
  if (extras) { stage.remove(extras.group); extras.dispose(); }
  extras = buildExtras(state, pool, mats, 'scene'); extras.group.visible = !before; stage.add(extras.group);
}
function rebuildExtras() { buildExtrasNow(); scheduleProbe(); shadowDirty = true; invalidateAR(); saveHash(); ui && ui.refresh(); }
function rebuild() {
  if (pool) { stage.remove(pool.group); pool.dispose(); }
  pool = buildPool(state, matSet(), 'scene');
  pool.group.traverse((o) => { if (o.isMesh && o.name === 'terrasse') o.receiveShadow = true; });
  pool.group.visible = !before; stage.add(pool.group);
  ground.geometry.dispose(); ground.geometry = groundGeometry(pool.contour, 170, 1);
  if (typeof photo !== 'undefined' && photo.on) { occluder.geometry = shadowCatcher.geometry = ground.geometry; }
  patch.geometry.dispose(); patch.geometry = patchGeometry(pool.contour);
  if (!garden) {                                                  // Hecke, Bäume, Beete: einmal für die größte Terrasse gebaut – Modellwechsel baut sie nicht neu
    const free = state.model === 'frei' || params.has('frei'), L = Math.max(free ? 16 : 0, state.length, ...MODELS.map((m) => m.length)), W = Math.max(free ? 6.5 : 0, state.width, ...MODELS.map((m) => m.width));
    garden = buildGarden({ minX: -L / 2, maxX: L / 2, minZ: -W / 2, maxZ: W / 2 }, { isMobile, noLawn: safe, dens: safe ? 0.3 : undefined }); stage.add(garden.group);
  }
  garden.fit(pool.bounds);
  garden.group.visible = state.garden;
  buildExtrasNow(); buildDims();
  const lamps = pool.group.userData.lamps || [];
  lampLights.forEach((l, i) => { const p = lamps[i]; if (p) l.position.set(p.x, p.y, p.z); });
  setLamps(lampLevel);
  const ext = Math.max(pool.dims.length, pool.dims.width) / 2 + 9, sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
  shadowDirty = true; invalidateAR(); saveHash(); ui && ui.refresh(); scheduleProbe();
}
let pending = false;
const scheduleRebuild = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; rebuild(); }); };
const perimeter = () => { const c = pool.contour; let s = 0; for (let i = 0; i < c.length; i++) s += c[i].distanceTo(c[(i + 1) % c.length]); return s; };

/* ---------- Maßanzeige ---------- */
let dimsGroup = null, dimsOn = false;
function labelSprite(text, scale) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 112; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.94)'; x.strokeStyle = 'rgba(20,33,43,.35)'; x.lineWidth = 3; x.beginPath(); if (x.roundRect) x.roundRect(6, 6, 308, 100, 50); else { x.moveTo(56, 6); x.arcTo(314, 6, 314, 106, 50); x.arcTo(314, 106, 6, 106, 50); x.arcTo(6, 106, 6, 6, 50); x.arcTo(6, 6, 314, 6, 50); x.closePath(); } x.fill(); x.stroke();
  x.fillStyle = '#14212b'; let fs = 50; do { x.font = `600 ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`; fs -= 2; } while (x.measureText(text).width > 270 && fs > 20); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 160, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(scale * 2.86, scale, 1); s.renderOrder = 12; return s;
}
function buildDims() {
  if (dimsGroup) { stage.remove(dimsGroup); dimsGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); dimsGroup = null; }
  const { minX, maxX, minZ, maxZ } = pool.bounds, g = new THREE.Group(), y = 0.14, off = COPING_W + 0.45, t = 0.18;
  const zl = maxZ + off, xr = maxX + off, pts = [
    minX, y, zl, maxX, y, zl, minX, y, zl - t, minX, y, zl + t, maxX, y, zl - t, maxX, y, zl + t,
    xr, y, minZ, xr, y, maxZ, xr - t, y, minZ, xr + t, y, minZ, xr - t, y, maxZ, xr + t, y, maxZ,
  ];
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x14212b, depthTest: false, transparent: true })); lines.renderOrder = 11; g.add(lines);
  const sc = Math.max(0.42, Math.min(0.8, state.length * 0.06));
  const a = labelSprite(`${fmt(maxX - minX)} m`, sc); a.position.set((minX + maxX) / 2, y + 0.3, zl + 0.1); g.add(a);
  const b = labelSprite(`${fmt(maxZ - minZ)} m`, sc); b.position.set(xr + 0.1, y + 0.3, (minZ + maxZ) / 2); g.add(b);
  const d = labelSprite(state.depth <= 1.4 ? `Tiefe ${fmt(state.depth)} m` : `Tiefe 1,1–${fmt(state.depth)} m`, sc); d.position.set(0, 0.3, 0); g.add(d);
  g.visible = dimsOn && !before; stage.add(g); dimsGroup = g;
}

/* ---------- Kamera ---------- */
let tween = null;
// Kamerafahrt als Bogen um das Ziel (Azimut auf kürzestem Weg, Radius logarithmisch) statt gerader Linie durch die Szene.
// Während der Fahrt ist das Dämpfen der Steuerung aus, damit sich Restschwung und Fahrt nicht gegeneinander bewegen.
function goTo(pos, target, ms = 1100) {
  const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)), s1 = new THREE.Spherical().setFromVector3(pos.clone().sub(target));
  const d = s1.theta - s0.theta;
  tween = { s0, s1, dTheta: Math.atan2(Math.sin(d), Math.cos(d)), t0: controls.target.clone(), t1: target.clone(), t: 0, ms: Math.max(1, ms) };
  controls.enableDamping = false; controls.autoRotate = false;
}
function endTween() { tween = null; controls.enableDamping = true; }
const tweenStep = (dt) => {
  tween.t += dt * 1000; const k = Math.min(1, tween.t / tween.ms), e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2, { s0, s1 } = tween;
  controls.target.lerpVectors(tween.t0, tween.t1, e);
  camera.position.setFromSpherical(new THREE.Spherical(s0.radius * (s1.radius / s0.radius) ** e, s0.phi + (s1.phi - s0.phi) * e, s0.theta + tween.dTheta * e)).add(controls.target);
  if (k >= 1) endTween();
};
// Schmale/hochkant stehende Geräte: Bedienfeld als Sheet unten, sonst als Seitenleiste links
const sheetMQ = matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1100px)');
const isSheet = () => sheetMQ.matches;
const topUi = () => (isSheet() ? Math.max(0, $('#viewbar').getBoundingClientRect().bottom + 6) : 0);
// Anteil des Bildes, der nicht vom Bedienfeld verdeckt wird. Der vertikale Sichtwinkel bezieht sich auf das GANZE Bild:
// Breite also aus camera.aspect (Vollbild), der freie Anteil kommt separat dazu.
function freeFrac() {
  const w = innerWidth, h = innerHeight, r = $('#cfg').getBoundingClientRect();
  return isSheet() ? { x: 1, y: Math.max(0.25, (h - (r.height + 8) - topUi()) / h) } : { x: Math.max(0.3, (w - (r.right + 14)) / w), y: 1 };
}
const needDist = (span) => span / (0.76 * camera.aspect * freeFrac().x);         // Abstand, bei dem 'span' Meter Breite in den freien Bereich passen (Sichtfeld 38°, schräger Blick)
const views = {
  orbit(ms = 900, k = 1, flip = 1) { const d = Math.max((Math.max(state.length, state.width * 1.6) * 0.95 + 4) * 1.2 * k, needDist(state.length + 4) * k); goTo(new THREE.Vector3(d * 0.62 * flip, d * 0.46, d * 0.8), new THREE.Vector3(0, -0.2, 0), ms); },
  mid(ms = 900) { views.orbit(ms, 0.85); },
  flip(ms = 900) { views.orbit(ms, 1, -1); },
  wide(ms = 900) { views.orbit(ms, 1.55); },
  top() { const f = freeFrac(), d = Math.max((Math.max(state.length * 1.15, state.width * 2.1) + 5), (state.length + 4) / (0.689 * camera.aspect * f.x), (state.width + 4) / (0.689 * f.y)); goTo(new THREE.Vector3(0.001, d, 0.6), new THREE.Vector3(0, 0, 0)); },
  near() { const f = Math.max(1, 0.8 / (camera.aspect * freeFrac().x)); goTo(new THREE.Vector3(state.length * 0.22, 1.5 * f, state.width / 2 + 4.2 * f), new THREE.Vector3(-state.length * 0.05, -0.3, 0)); },
};
const STEP_VIEW = [null, 'orbit', 'mid', 'wide', 'orbit', 'orbit'];
// Das Bedienfeld verdeckt einen Teil des Bildes: Szene in den freien Bereich verschieben
const vo = { x: 0, y: 0, tx: 0, ty: 0, init: false };
function applyVO() { camera.setViewOffset(innerWidth, innerHeight, vo.x, vo.y, innerWidth, innerHeight); camera.updateProjectionMatrix(); }
function layout(snap = false) {
  const r = $('#cfg').getBoundingClientRect();
  if (photo.on) { vo.tx = 0; vo.ty = 0; } else if (!isSheet()) { vo.tx = -(r.right + 14) / 2; vo.ty = 0; } else { vo.tx = 0; vo.ty = (r.height + 8 - topUi()) / 2; }   // Szene in die Mitte des freien Bereichs
  if (snap || !vo.init) { vo.x = vo.tx; vo.y = vo.ty; vo.init = true; applyVO(); }
}

/* ---------- Anfrage, Zusammenfassung ---------- */
const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
function summaryLines() {
  const d = pool.dims, x = state.extras, m = state.model === 'frei' ? 'Individuell' : modelById(state.model).name;
  const ex = Object.keys(EXTRAS).filter((k) => x[k]).map((k) => EXTRAS[k].name);
  if (x.loungers) ex.push(`${x.loungers} Liegen`);
  return [
    `Modell: ${m} (${fmt(state.length)} × ${fmt(state.width)} m, Tiefe ${state.depth <= 1.4 ? fmt(state.depth) : '1,1 – ' + fmt(state.depth)} m)`,
    `Wasserfläche ${fmt(d.area)} m², Wasserinhalt ca. ${fmt(d.volume)} m³`, `Treppe: ${STEP_NAMES[state.steps]} · Beckenfarbe: ${LINERS[state.liner].name}`,
    `Beckenrand: ${COPING[state.coping].name} · Terrasse: ${DECK[state.deck].name}`, `Abdeckung: ${COVER[state.cover].name} · Beleuchtung: ${LIGHTS[x.light].name}`,
    `Extras: ${ex.length ? ex.join(', ') : 'keine'}`,
  ];
}
const price = () => priceOf(state, pool.dims, perimeter());
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 3500); }
function showModal(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modal').hidden = true; });
function qrSvg(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function copyLink() { try { await navigator.clipboard.writeText(location.href); toast('Link kopiert'); } catch { toast('Kopieren nicht möglich – Adresszeile nutzen'); } }
function snap() {                                                  // Bild der aktuellen Szene (ohne Bedienfeld-Verschiebung)
  camera.clearViewOffset(); camera.updateProjectionMatrix();
  post.render(0);
  const url = canvas.toDataURL('image/jpeg', 0.88);
  applyVO();
  return Promise.resolve(url);
}
async function download() { const a = document.createElement('a'); a.href = await snap(); a.download = 'pool-konfiguration.jpg'; document.body.append(a); a.click(); a.remove(); }
const nowSlug = () => (brand.firma || TEXT.product).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
const cfgId = () => { let h = 0; const t = location.hash || JSON.stringify(state); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6); };
const scaleImg = (url, w) => new Promise((res) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = Math.round((w * i.height) / i.width); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); res({ url: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height }); }; i.onerror = () => res(null); i.src = url; });
/** Drei feste Ansichten (Außen, Von oben, Nah) in 1200 × 750 für das PDF; danach wird alles zurückgesetzt */
function captureViews() {
  const L = state.length, W = state.width, keep = { p: camera.position.clone(), asp: camera.aspect };
  const dO = Math.max((Math.max(L, W * 1.6) * 0.95 + 4) * 1.2, (L + 4) / (0.76 * 1.6)), dT = Math.max(Math.max(L * 1.15, W * 2.1) + 5, (L + 4) / (0.689 * 1.6), (W + 4) / 0.689);
  const poses = [['Außen', [0.62 * dO, 0.46 * dO, 0.8 * dO], [0, -0.2, 0]], ['Von oben', [0.001, dT, 0.6], [0, 0, 0]], ['Nah', [L * 0.22, 1.5, W / 2 + 4.2], [-L * 0.05, -0.3, 0]]];
  camera.clearViewOffset(); camera.aspect = 1.6; renderer.setPixelRatio(1); post.setSize(1200, 750);
  const out = [];
  for (const [label, pos, tgt] of poses) {
    camera.position.set(...pos); camera.lookAt(...tgt); camera.updateProjectionMatrix();
    if (garden) { const l = garden.lot; camera.position.x = Math.max(-l.x + 1.5, Math.min(l.x - 1.5, camera.position.x)); camera.position.z = Math.max(l.back + 1.5, Math.min(l.front - 1.5, camera.position.z)); }
    post.render(0); out.push({ label, url: canvas.toDataURL('image/jpeg', 0.88), w: 1200, h: 750 });
  }
  camera.position.copy(keep.p); camera.aspect = keep.asp; renderer.setPixelRatio(dpr); lastW = 0; resize(); controls.update();
  return out;
}
/** Hinweise zur Planung (allgemein, keine Rechtsberatung) */
function planningNotes() {
  const v = pool.dims.volume, n = [];
  n.push(v > 100 ? `Mit ca. ${fmt(v)} m³ Beckeninhalt ist in den meisten Bundesländern eine Baugenehmigung nötig. Bitte frühzeitig bei der Gemeinde klären.` : `Pools bis 100 m³ (hier ca. ${fmt(v)} m³) sind in vielen Bundesländern genehmigungsfrei. Die Landesbauordnung und örtliche Satzungen sind trotzdem zu prüfen.`);
  n.push('Für den Aushub sollte eine Zufahrt von mindestens 2,5 m Breite für den Bagger vorhanden sein.');
  n.push('Abstand zu Nachbargrenzen, Bäumen und Leitungen (Strom, Wasser, Abwasser) vor der Planung klären.');
  n.push('Elektroanschluss für Pumpe, Beleuchtung und Wärmepumpe immer durch einen Elektrofachbetrieb.');
  return n;
}
const extraInfo = () => { const p = price(); return { finance: showPrices && FINANCE.enabled ? { rate: monthlyRate(p.total), months: FINANCE.months, apr: FINANCE.apr } : null, yearly: showPrices ? yearlyCosts(pool.dims.volume) : 0, notes: planningNotes() }; };
let pdfBusy = false;
async function makePdf() {
  if (pdfBusy) return; pdfBusy = true; toast('PDF wird erstellt …');
  try {
    const { buildPdf } = await import('./pdf.js'), e = extraInfo(), p = price();
    const doc = await buildPdf({ brand, title: `${TEXT.product}-Konfigurator`, lines: summaryLines(), price: showPrices ? p : null, images: captureViews(), link: location.href, id: cfgId(), notes: e.notes, finance: e.finance, yearly: e.yearly, accent: brand.farbe || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() });
    doc.save(`${nowSlug()}-konfiguration-${cfgId()}.pdf`); track('pdf'); toast('PDF gespeichert');
  } catch (err) { console.warn(err); toast('PDF konnte nicht erstellt werden'); }
  finally { pdfBusy = false; }
}
function mailtoHref() {
  const lines = summaryLines(), p = price();
  const body = `Guten Tag,\n\nich interessiere mich für folgende Konfiguration:\n\n${lines.join('\n')}\n${showPrices ? `\nRichtpreis laut Konfigurator: ab ca. ${fmtEur(p.total)}\n` : '\n'}\nMeine Konfiguration: ${location.href}\n\nBitte senden Sie mir ein unverbindliches Angebot.\n\nName / Telefon / PLZ:\n`;
  return `mailto:${brand.mail}?subject=${encodeURIComponent(TEXT.mailSubject)}&body=${encodeURIComponent(body)}`;
}
function ask() {
  const p = price(); track('lead_open');
  showModal(formHtml({ brand, product: TEXT.product, price: fmtEur(p.total), showPrices }));
  const form = $('#lead-form'), errEl = $('#lead-err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = readForm(form);
    if (r.err.length) { errEl.textContent = r.err[0]; errEl.hidden = false; return; }
    const btn = $('#lead-send'); btn.disabled = true; btn.textContent = 'Wird gesendet …';
    const img = await scaleImg(await snap(), 640);
    const payload = { typ: 'anfrage', katalog: CATALOG.id, betreff: TEXT.mailSubject, kunde: r.data, konfiguration: JSON.parse(JSON.stringify(state)), zusammenfassung: summaryLines(), richtpreis: showPrices ? `ab ca. ${fmtEur(p.total)}` : '', link: location.href, bild: img ? img.url : '', bewertung: scoreOf(r.data, p.total), zeitpunkt: new Date().toISOString() };
    const res = r.spam ? { mode: 'sent' } : await sendLead(brand, payload);
    if (!r.spam) { track('lead_sent', { modell: state.model, preis: Math.round(p.total), bewertung: payload.bewertung.stufe }); track('lead', payload, { personal: true }); }
    const pdfBtn = '<button class="ghost" id="b-lead-pdf">Angebots-PDF speichern</button>';
    if (res.mode === 'sent') showModal(`<h2>Vielen Dank!</h2><p>Ihre Anfrage wurde an <b>${esc(brand.firma || 'den Anbieter')}</b> gesendet. Sie hören in Kürze von uns.</p><div class="row">${pdfBtn}<button class="solid" data-close>Schließen</button></div>`);
    else if (res.mode === 'demo') showModal(`<h2>Demo: so kommt die Anfrage an</h2><p class="small">Demo-Modus – es wurde <b>nichts gesendet</b>. Mit hinterlegtem Anfrage-Endpunkt landet genau das beim Anbieter (Mail, CRM, Excel):</p>${inboxHtml(payload, brand)}<div class="row">${pdfBtn}${brand.mail ? `<a class="ghost btn" href="${mailtoHref()}">Per E-Mail öffnen</a>` : ''}<button class="solid" data-close>Schließen</button></div>`);
    else showModal(`<h2>Senden nicht möglich</h2><p>Die Anfrage konnte nicht übermittelt werden. Bitte versuchen Sie es erneut${brand.mail ? ' oder senden Sie uns eine E-Mail' : ''}.</p><div class="row">${brand.mail ? `<a class="solid btn" href="${mailtoHref()}">Per E-Mail anfragen</a>` : ''}<button class="ghost" data-close>Schließen</button></div>`);
    const b = $('#b-lead-pdf'); if (b) b.addEventListener('click', makePdf);
  });
}

/* ---------- AR (iOS Quick Look/USDZ, Android Scene Viewer/WebXR) ---------- */
// Im Gelände kann nichts ausgehoben werden: In AR liegt der Pool als flache Fläche (Wasser, Rand, Terrasse, Liegen, Schirm) auf dem Boden, 1:1.
const ar = { mv: null, ready: false, building: false, stale: true, urls: [] };
function invalidateAR() { ar.stale = true; }
async function ensureMV() {
  if (ar.mv) return ar.mv;
  await import('@google/model-viewer');
  const mv = document.createElement('model-viewer');
  mv.setAttribute('ar', ''); mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look'); mv.setAttribute('ar-scale', 'fixed'); mv.setAttribute('ar-placement', 'floor');
  mv.setAttribute('loading', 'eager'); mv.setAttribute('alt', 'Pool in AR');
  mv.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(mv); ar.mv = mv; return mv;
}
async function buildAR() {
  if (ar.building) return; ar.building = true; ar.ready = false;
  try {
    const p = buildPool(state, { ...matSet(), glass: mats.glass.clone() }, 'ar');
    const ex = buildExtras(state, p, mats, 'ar');
    const root = new THREE.Group(); root.add(p.group, ex.group);
    // AR-Datei klein halten: nur Farbtextur (keine Normal-/Rauheitskarten), keine Pflanzen-Modelle
    ex.group.traverse((o) => { if (o.userData?.gltf) o.visible = false; });
    const light = new Map();
    root.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) { if (!light.has(o.material)) { const m = o.material.clone(); m.normalMap = null; m.roughnessMap = null; m.aoMap = null; m.onBeforeCompile = () => {}; if (m.map) m.map.userData.mimeType = 'image/jpeg'; light.set(o.material, m); } o.material = light.get(o.material); } });
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 384 });
    const usdz = await new USDZExporter().parseAsync(root, { quickLookCompatible: true, maxTextureSize: 192 });
    p.dispose(); ex.dispose();
    const mv = await ensureMV();
    ar.urls.forEach((u) => URL.revokeObjectURL(u));
    const glbUrl = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })), usdzUrl = URL.createObjectURL(new Blob([usdz], { type: 'model/vnd.usdz+zip' }));
    ar.urls = [glbUrl, usdzUrl]; mv.setAttribute('ios-src', usdzUrl); mv.src = glbUrl;
    await new Promise((r) => { if (mv.loaded) r(); else mv.addEventListener('load', r, { once: true }); setTimeout(r, 8000); });
    ar.ready = true; ar.stale = false;
  } catch (e) { console.warn('AR-Vorbereitung fehlgeschlagen', e); }
  finally { ar.building = false; }
}
const nextFrames = (n = 2) => new Promise((r) => { const f = (k) => (k <= 0 ? r() : requestAnimationFrame(() => f(k - 1))); f(n); });
async function openAR() {
  if (!isTouchPhone) {
    showModal(`<h2>${TEXT.product} im eigenen Garten ansehen</h2><div class="qr">${qrSvg(location.href)}</div><p>QR-Code mit dem Handy scannen, dort „Im Garten ansehen“ tippen und das Becken auf der Wiese platzieren. Im Maßstab 1:1 sehen Sie, wie viel Platz er im Garten einnimmt.</p><p class="small">iPhone: Safari · Android: Chrome · nur über https</p><button class="solid" data-close>Schließen</button>`);
    return;
  }
  showModal(`<h2>AR vorbereiten</h2><p>Sie brauchen eine <b>freie, ebene Fläche von mindestens ${Math.ceil(state.length + 6)} × ${Math.ceil(state.width + 6)} m</b>. Das Becken erscheint <b>vor Ihnen</b> auf dem Boden und lässt sich per Finger verschieben und drehen.</p><div class="status" id="ar-status"><span class="spin"></span> Modell wird vorbereitet …</div><div class="row"><button class="ghost" data-close>Abbrechen</button><button class="solid" id="ar-go" disabled>AR starten</button></div>`);
  await nextFrames(2);
  if (ar.stale || !ar.ready) await buildAR();
  const st = $('#ar-status'), go = $('#ar-go'); if (!st || !go) return;
  if (!ar.ready) { st.textContent = 'Das Modell konnte nicht vorbereitet werden. Bitte Seite neu laden.'; return; }
  st.textContent = 'Bereit. Zum Platzieren den Boden mit der Kamera langsam abscannen.'; go.disabled = false;
  go.addEventListener('click', () => {
    if (ar.mv && ar.mv.canActivateAR) { $('#modal').hidden = true; ar.mv.activateAR(); }
    else { st.textContent = 'AR wird von diesem Browser/Gerät nicht unterstützt. iPhone: Safari · Android: Chrome (mit Google-Play-Diensten für AR).'; go.disabled = true; }
  }, { once: true });
}

/* ---------- Gartenfoto-Modus: eigenes Foto als Hintergrund, Becken maßstäblich darauf platzieren (Foto bleibt im Browser) ---------- */
const photo = { on: false, tex: null, aspect: 1, rot: 0, sun: 0, pitch: -14, h: 1.6, saved: null };
const occluder = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ colorWrite: false })); occluder.renderOrder = -900; occluder.visible = false; stage.add(occluder);   // Boden mit Beckenöffnung: verdeckt die Grube außerhalb des Lochs
const shadowCatcher = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShadowMaterial({ opacity: 0.38 })); shadowCatcher.position.y = 0.002; shadowCatcher.receiveShadow = true; shadowCatcher.visible = false; shadowCatcher.renderOrder = -800; stage.add(shadowCatcher);
function photoFit() {                                                // Foto füllt das Bild (Zuschnitt wie CSS cover)
  if (!photo.tex) return; const va = innerWidth / innerHeight, t = photo.tex; t.repeat.set(1, 1); t.offset.set(0, 0);
  if (va > photo.aspect) { t.repeat.y = photo.aspect / va; t.offset.y = (1 - t.repeat.y) / 2; } else { t.repeat.x = va / photo.aspect; t.offset.x = (1 - t.repeat.x) / 2; }
}
function photoCamera() {
  camera.fov = 62; camera.position.set(0, photo.h, 0); camera.rotation.set(THREE.MathUtils.degToRad(photo.pitch), 0, 0, 'YXZ'); camera.updateProjectionMatrix();
  const d = new THREE.Vector3(-60, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(photo.sun)); void d;
  placeSun();
}
function placeSun() {
  const base = sun.userData.base || (sun.userData.base = sun.position.clone());
  if (!photo.on) return;
  sun.position.copy(base).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(photo.sun)).add(stage.position); sun.target.position.copy(stage.position); sun.target.updateMatrixWorld(); shadowDirty = true;
}
function photoStage() { stage.rotation.y = THREE.MathUtils.degToRad(photo.rot); placeSun(); shadowDirty = true; }
async function photoOpen(file) {
  if (!file || !/^image\//.test(file.type)) { toast('Bitte ein Foto (JPG oder PNG) wählen'); return; }
  try {
    let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
    const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; photo.tex = t; photo.aspect = c.width / c.height;
  } catch { toast('Das Foto konnte nicht geladen werden'); return; }
  photo.saved = { fov: camera.fov, pos: camera.position.clone(), tgt: controls.target.clone(), bg: scene.background, time: state.time };
  photo.on = true; document.documentElement.classList.add('photo-mode'); controls.enabled = false; controls.autoRotate = false; tween = null;
  if (state.time === 'night') api.change('time', 'day');
  scene.background = photo.tex; photoFit();
  if (skybox) skybox.visible = false; ground.visible = false; patch.visible = false; if (garden) garden.group.visible = false; if (dimsGroup) dimsGroup.visible = false;
  occluder.geometry = shadowCatcher.geometry = ground.geometry; occluder.visible = shadowCatcher.visible = true;
  { const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(31)) * (innerWidth / innerHeight)), d = (pool.dims.length + 6) / (2 * Math.tan(hf / 2)); stage.position.set(0, 0, -Math.min(40, Math.max(6, d))); }       // Becken samt Terrasse passt ins Bild photo.rot = 0; photo.sun = 0; photo.pitch = -14; photo.h = 1.6;
  for (const [id, v] of [['ph-rot', 0], ['ph-sun', 0], ['ph-pitch', -14], ['ph-h', 1.6]]) $('#' + id).value = v;
  photoStage(); photoCamera(); layout(true); track('photo');
  $('#photo-ui').hidden = false; toast('Becken mit dem Finger oder der Maus an die richtige Stelle ziehen');
}
function photoClose() {
  photo.on = false; document.documentElement.classList.remove('photo-mode'); controls.enabled = true; $('#photo-ui').hidden = true;
  scene.background = photo.saved.bg; if (photo.tex) photo.tex.dispose(); photo.tex = null;
  if (skybox) skybox.visible = true; ground.visible = !before; if (garden) garden.group.visible = state.garden; if (dimsGroup) dimsGroup.visible = dimsOn && !before;
  occluder.visible = shadowCatcher.visible = false; stage.position.set(0, 0, 0); stage.rotation.y = 0;
  const base = sun.userData.base; if (base) sun.position.copy(base); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
  camera.fov = photo.saved.fov; camera.updateProjectionMatrix(); camera.position.copy(photo.saved.pos); controls.target.copy(photo.saved.tgt); controls.update(); layout(true); views.orbit(600); shadowDirty = true;
}
{ // Platzieren: Ziehen auf dem Bild verschiebt das Becken auf der Bodenebene
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2(); let drag = false;
  const at = (e) => { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit : null; };
  canvas.addEventListener('pointerdown', (e) => { if (photo.on) { drag = true; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => { if (!photo.on || !drag) return; const h = at(e); if (h && h.length() < 60) { stage.position.set(h.x, 0, h.z); placeSun(); } });
  const up = () => { drag = false; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  for (const [id, key] of [['ph-rot', 'rot'], ['ph-sun', 'sun'], ['ph-pitch', 'pitch'], ['ph-h', 'h']]) $('#' + id).addEventListener('input', (e) => { photo[key] = +e.target.value; if (key === 'rot') photoStage(); else if (key === 'sun') placeSun(); else photoCamera(); });
  $('#ph-pick').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; photoOpen(f); });
  $('#ph-close').addEventListener('click', photoClose); $('#ph-save').addEventListener('click', () => download());
}
addEventListener('resize', () => { if (photo.on) photoFit(); });

/* ---------- Bedienung anbinden ---------- */
let ui = null;
const api = {
  state, showPrices, free: params.has('frei'),
  applyPackage(id) {
    const pk = PACKAGES.find((q) => q.id === id); if (!pk) return;
    const st = pk.set || {};
    if (st.coping in COPING) state.coping = st.coping;
    if (st.deck in DECK) state.deck = st.deck;
    if (st.cover in COVER) state.cover = st.cover;
    if ([0, 1, 2, 4].includes(st.loungers)) state.extras.loungers = st.loungers;
    if (st.light in LIGHTS) state.extras.light = st.light;
    if (Array.isArray(st.extras)) for (const k of Object.keys(EXTRAS)) state.extras[k] = st.extras.includes(k);
    track('package', { id }); rebuild(); applyLightColor(performance.now() / 1000); if (state.cover === 'roof') views.wide();
  },
  change(key, v) {
    if (typeof v !== 'object') track('option', { key, value: String(v) });
    if (key === 'model') { applyModel(v); rebuild(); views.orbit(); return; }
    state[key] = v;
    if (key === 'steps' || key === 'coping' || key === 'deck') rebuild();
    else if (key === 'liner') { setLinerColor(); applyLightColor(performance.now() / 1000); saveHash(); ui.refresh(); }
    else if (key === 'cover') { pool.setCover(v); shadowDirty = true; invalidateAR(); saveHash(); ui.refresh(); if (v === 'roof') views.wide(); }
    else if (key === 'time') { setTime(v); saveHash(); }
    else if (key === 'garden') { garden.group.visible = v; saveHash(); }
  },
  changeExtra(k, v) {
    track('option', { key: k, value: String(v) });
    state.extras[k] = v;
    if (k === 'light') { applyLightColor(performance.now() / 1000); saveHash(); ui.refresh(); } else { rebuildExtras(); if (v && k === 'jet') { controls.autoRotate = false; views.flip(); } }
  },
  changeSize(k, v) { state.model = 'frei'; state[k] = v; if (k === 'length' && state.width > v - 0.5) state.width = Math.max(2, v - 0.5); if (k === 'width' && v > state.length - 0.5) state.length = Math.min(16, v + 0.5); scheduleRebuild(); },
  price, dims: () => pool && pool.dims, summaryLines, extraInfo, pdf: makePdf, snap, download, copyLink, ask, ar: openAR, layout, packages: PACKAGES,
  view(v) { if (v === 'photo') { $('#ph-pick').click(); return; } controls.autoRotate = false; views[v](); },
  spin() { controls.autoRotate = !controls.autoRotate; return controls.autoRotate; },
  before(on) { before = on; pool.group.visible = !on; extras.group.visible = !on; patch.visible = on; ground.visible = !on; if (dimsGroup) dimsGroup.visible = dimsOn && !on; shadowDirty = true; },
  toggleDims() { dimsOn = !dimsOn; if (dimsGroup) dimsGroup.visible = dimsOn && !before; return dimsOn; },
  onStep(n) { track('step', { n }); const v = STEP_VIEW[n]; if (v) { controls.autoRotate = false; views[v](); } },
};
controls.addEventListener('start', () => { if (tween) endTween(); if (controls.autoRotate) { controls.autoRotate = false; $('#viewbar [data-v="spin"]').setAttribute('aria-pressed', 'false'); } });
// Doppeltippen / Doppelklick auf die Szene: zurück zur Standardansicht
const taps = { n: 0, last: 0, x: 0, y: 0, moved: false };
const live = new Set();
canvas.addEventListener('pointerdown', (e) => { live.add(e.pointerId); if (live.size > 1) taps.moved = true; else { taps.x = e.clientX; taps.y = e.clientY; taps.moved = false; } });
canvas.addEventListener('pointermove', (e) => { if (live.size === 1 && Math.hypot(e.clientX - taps.x, e.clientY - taps.y) > 8) taps.moved = true; });
const lift = (e) => { live.delete(e.pointerId); };
canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('pointerup', (e) => {
  const was = live.size; live.delete(e.pointerId);
  if (e.pointerType === 'mouse' || was !== 1 || taps.moved) { if (was <= 1) taps.moved = false; return; }
  const now = performance.now();
  if (now - taps.last < 330) { views.orbit(); taps.last = 0; return; }
  taps.last = now;
  if (isSheet() && !$('#cfg').classList.contains('collapsed')) $('#b-panel').click();     // Tippen auf die Szene: Menü einklappen, Ergebnis ansehen
});
canvas.addEventListener('dblclick', () => views.orbit());
$('#b-ask').addEventListener('click', () => ask());
$('#b-ar').addEventListener('click', () => openAR());

/* ---------- Leistungsregler: Ziel 60 fps bei höchster Qualität ----------
   Reihenfolge, wenn ein Gerät das Ziel verfehlt: 1) Auflösung stufenweise bis 52 % der vollen Pixeldichte, 2) AO aus (Stufe „medium“),
   3) Sparmodus (keine Schatten/Glow/Lampenlichter). Läuft es wieder gut, wird die Auflösung vorsichtig wieder erhöht. */
let lite = false;
function setScale(v) { perf.scale = v; dpr = NATIVE * v; lastW = 0; resize(); }
function goLite() {
  if (lite) return; lite = true;
  sun.castShadow = false; post.setTier('low'); lampLights.forEach((l) => { l.visible = false; });
  setScale(Math.min(perf.scale, 0.72));
}
if (params.has('lite')) setTimeout(goLite, 0);
function perfStep(ms) {                                          // ms = mittlere Bildzeit der letzten Sekunde (nur aktive Bilder)
  const now = performance.now(), target = 1000 / 60;
  if (ms > target * 1.12) {                                       // zu langsam
    perf.good = 0; if (now - perf.last < 1300) return; perf.last = now;
    if (now - perf.raisedAt < 6000) perf.noUpUntil = now + 45000;  // eben erhöhte Stufe war zu viel: lange nicht wieder probieren
    const i = SCALES.indexOf(perf.scale);
    if (i < SCALES.length - 1) setScale(SCALES[i + 1]);
    else if (post.tier === 'high') { post.setTier('medium'); perf.tierUpAt = now + 90000; setScale(0.8); }
    else if (!lite) goLite();
    warm = 18;
  } else if (ms <= target * 1.05) {                              // läuft rund
    if (++perf.good >= 14 && now > perf.noUpUntil && !lite) {
      if (perf.scale < 1) { perf.good = 0; perf.raisedAt = now; setScale(SCALES[Math.max(0, SCALES.indexOf(perf.scale) - 1)]); warm = 12; }
      else if (post.tier === 'medium' && now > perf.tierUpAt) { perf.good = 0; perf.raisedAt = now; post.setTier('high'); setScale(0.9); warm = 12; }       // volle Auflösung stabil: Effekte (AO) wieder zuschalten
    }
  }
}
/** Messung beim Start (hinter dem Preloader): echte GPU-Zeit (wo der Browser sie liefert) bestimmt die Start-Auflösung */
async function calibrate() {
  if (params.has('fixed') || params.has('scale')) return;
  try {
    const gl = renderer.getContext(); if (!gl.getExtension('EXT_disjoint_timer_query_webgl2')) return;
    let ms = await bench(10), tries = 0;
    while (ms > 15.5 && tries++ < 3 && perf.scale > SCALES[SCALES.length - 1]) { const want = Math.sqrt(14.5 / ms) * perf.scale; setScale(SCALES.find((v) => v <= want + 1e-6) || SCALES[SCALES.length - 1]); ms = await bench(8); }
    tick('kalibriert: ' + ms.toFixed(1) + ' ms GPU bei ' + Math.round(perf.scale * 100) + ' % Auflösung');
  } catch { /* egal */ }
}
/* ---------- Größe & Schleife ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  if (w === lastW && h === lastH && dpr === lastDpr) { layout(true); return; }
  lastW = w; lastH = h; lastDpr = dpr;
  renderer.setPixelRatio(dpr); post.setSize(w, h); post.setAA(dpr < 1.75); camera.aspect = w / h; layout(true);
}
let lastW = 0, lastH = 0, lastDpr = 0, rsT = 0;
addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(resize, 120); });   // Adressleisten-Ein-/Ausblenden löst viele resize-Ereignisse aus
resize();
new ResizeObserver(() => layout()).observe($('#cfg'));
const timer = new THREE.Timer();
const samples = []; let warm = 60, started = false, assetsDone = false, clock = 0, sceneReady = null;
{ // Preloader: sobald alle Dateien da sind und die Szene steht, kalibrieren und enthüllen; spätestens nach 20 s wird enthüllt (Dateien, die nicht kommen, blockieren nicht)
  onProgress(ld.files);
  Promise.all([whenLoaded(18000), new Promise((r) => { sceneReady = r; })]).then(async () => { ld.stage('Letzte Schritte …', 0.9); await paint(); await calibrate(); assetsDone = true; });
}
let intro = (params.has('nointro') || matchMedia('(prefers-reduced-motion: reduce)').matches) ? null : { t: 0 };
// Handy im Leerlauf (keine Berührung, keine Fahrt): nur jedes zweite Bild zeichnen → kühler, akkuschonender
let lastActive = 0, frameNo = 0;
const wake = () => { lastActive = performance.now(); };
controls.addEventListener('change', wake); canvas.addEventListener('pointerdown', wake); addEventListener('wheel', wake, { passive: true });
renderer.setAnimationLoop(() => {
  if (!pool) return;
  timer.update(); const dt = Math.min(timer.getDelta(), 0.1); clock += dt;
  // Leerlauf (keine Eingabe, keine Fahrt): nur jedes zweite Bild – spart Akku und Wärme, Wasser läuft mit 30 fps weiter ruhig
  const idle = !tween && !intro && !controls.autoRotate && !photo.on && performance.now() - lastActive > 1500;
  if (idle && (frameNo++ & 1)) return;
  if (tween && (started || !intro)) tweenStep(dt);
  if (!photo.on) controls.update();
  if (Math.abs(vo.x - vo.tx) > 0.3 || Math.abs(vo.y - vo.ty) > 0.3) { const f = Math.min(1, dt * 9); vo.x += (vo.tx - vo.x) * f; vo.y += (vo.ty - vo.y) * f; applyVO(); wake(); }
  if (garden && !photo.on) { const l = garden.lot, p = camera.position; p.x = Math.max(-l.x + 1.5, Math.min(l.x - 1.5, p.x)); p.z = Math.max(l.back + 1.5, Math.min(l.front - 1.5, p.z)); p.y = Math.max(0.7, Math.min(45, p.y)); }
  if (intro && started) {                                         // Einstieg: Wasser läuft ein, Kamera fährt heran
    intro.t += dt; const k = Math.min(1, Math.max(0, (intro.t - 0.4) / 2.8)), e = 1 - (1 - k) ** 3, w = pool.group.getObjectByName('wasser');
    if (w) w.position.y = -(pool.dims.depth - 0.1) * (1 - e);
    if (k >= 1) { if (w) w.position.y = 0; intro = null; toast(isMobile ? 'Ziehen zum Drehen · zwei Finger zum Zoomen' : 'Ziehen zum Drehen · Scrollen zum Zoomen'); }
  }
  U.uTime.value = clock;
  if (extras) extras.update(clock);
  if (lampLevel > 0 && state.extras.light === 'wechsel') applyLightColor(clock);
  if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
  post.render(dt);
  if (!started && assetsDone) { started = true; window.__started = true; ld.done(); tick('erstes Bild nach Preloader'); $('#loading').classList.add('done'); setTimeout(() => $('#loading').remove(), 800); setTimeout(() => { prefetch(); loadHDRI('evening'); loadHDRI('night'); }, 1500); }       // übrige Tageszeiten leise nachladen
  if (ar.building || params.has('fixed')) return;
  if (warm > 0) { warm--; return; }
  if (idle || document.hidden) { samples.length = 0; return; }       // Leerlauf (30 fps) und Hintergrund-Tab sagen nichts über die Leistung
  samples.push(dt); if (samples.length >= 30) { samples.sort((x, y) => x - y); perfStep(samples[15] * 1000); samples.length = 0; }       // Median: einzelne Ruckler (Speicherbereinigung, Seitenwechsel) lösen nichts aus
});

/* ---------- Start ---------- */
tick('vor ui');
ui = initUI(api);
track('start', { w: innerWidth, mobile: isMobile });
await paint(); rebuild(); tick('pool+garten+zubehoer'); ld.stage('Himmel wird berechnet …', 0.55); await paint();
await setTime(state.time); tick('himmel'); ld.stage('Letzte Schritte …', 0.8); sceneReady && sceneReady();
if (isSheet()) { $('#cfg').classList.add('collapsed'); $('#b-panel').textContent = 'Konfigurieren ▴'; $('#b-panel').setAttribute('aria-expanded', 'false'); }
layout();
camera.position.set(9, 6, 11); controls.target.set(0, -0.2, 0); views.orbit(1);
if (intro) { camera.position.set(-14, 12, 26); controls.target.set(0, -0.2, 0); views.orbit(3600); }
/** Messung (nur ?debug): echte Bildzeit in ms ohne V-Sync – Frames werden bis zur GPU-Fertigstellung abgewartet */
async function bench(n = 25) {        // echte GPU-Zeit je Frame (Timer-Query, Chrome); sonst Wandzeit mit Synchronisation
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), ts = [], px = new Uint8Array(4);
  for (let i = 0; i < n + 14; i++) {
    if (ext) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); post.render(0); gl.endQuery(ext.TIME_ELAPSED_EXT);
      let guard = 0; while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && guard++ < 400) await new Promise((r) => setTimeout(r, 2));
      const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q); if (i >= 14) ts.push(ms); }
    else { const t0 = performance.now(); post.render(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (i >= 14) ts.push(performance.now() - t0); }
  }
  ts.sort((x, y) => x - y); return ts[n >> 1];
}
if (params.has('debug')) window.__app = { bench, THREE, scene, camera, controls, renderer, state, rebuild, views, ui, get pool() { return pool; }, get garden() { return garden; }, get extras() { return extras; }, setTime, buildAR, ar, api, mats, post, stage, perf, setScale };
