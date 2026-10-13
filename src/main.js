import * as THREE from 'three';
import qrcode from 'qrcode-generator';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { grassTextures, noiseNormal, mosaicTexture, woodTexture, paverTexture, concreteTexture, waterNormal, slatTexture } from './textures.js';
import { buildPool, groundGeometry, SHAPES, STEPS } from './pool.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const params = new URLSearchParams(location.search);
const ua = navigator.userAgent;
const isTouchPhone = /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = params.has('mobile') || matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

/* ---------- Personalisierung per Link: ?firma=…&farbe=%230a6ebd&logo=https://…&mail=anfrage@… ---------- */
const brand = {
  firma: (params.get('firma') || '').trim().slice(0, 60),
  farbe: /^#?[0-9a-f]{6}$/i.test(params.get('farbe') || '') ? '#' + params.get('farbe').replace('#', '') : null,
  logo: /^https:\/\/[^\s"'<>]+$/i.test(params.get('logo') || '') ? params.get('logo') : null,
  mail: /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(params.get('mail') || '') ? params.get('mail') : '',
};
if (brand.farbe) document.documentElement.style.setProperty('--accent', brand.farbe);
if (brand.firma) { $('#brand-name').textContent = brand.firma; document.title = `Pool-Planer – ${brand.firma}`; $('#brand-eyebrow').textContent = 'Ihr Pool-Planer'; }
if (brand.logo) { const i = $('#brand-logo'); i.src = brand.logo; i.hidden = false; i.addEventListener('error', () => { i.hidden = true; }); }

/* ---------- Konfiguration ---------- */
const OPT = {
  coping: { stein: 'Naturstein', granit: 'Granit', beton: 'Beton hell' },
  deck: { holz: 'Holz', stein: 'Stein', beton: 'Beton', gras: 'Rasen' },
  cover: { none: 'Offen', roll: 'Rollladen', roof: 'Überdachung' },
  time: { day: 'Tag', evening: 'Abend', night: 'Nacht' },
};
const LINERS = {
  hellblau: { name: 'Hellblau', hex: 0x5cc3e3 }, blau: { name: 'Blau', hex: 0x2c86c6 }, anthrazit: { name: 'Anthrazit', hex: 0x3d464c },
  sand: { name: 'Sand', hex: 0xd8c7a0 }, smaragd: { name: 'Smaragd', hex: 0x2fb3a0 },
};
const PRESETS = [[6, 3, 1.5], [8, 4, 1.5], [10, 5, 1.6], [12, 6, 1.8]];
const state = { shape: 'rect', length: 8, width: 4, depth: 1.5, steps: 'corner', coping: 'stein', deck: 'holz', liner: 'hellblau', cover: 'none', time: 'day' };
const clampNum = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);
function applyCfg(c) {
  if (!c || typeof c !== 'object') return;
  if (c.shape in SHAPES) state.shape = c.shape;
  if (c.steps in STEPS) state.steps = c.steps;
  for (const k of ['coping', 'deck', 'cover', 'time']) if (c[k] in OPT[k]) state[k] = c[k];
  if (c.liner in LINERS) state.liner = c.liner;
  state.length = clampNum(c.length, 3, 16, state.length); state.width = clampNum(c.width, 2, 6.5, state.width); state.depth = clampNum(c.depth, 1, 2.4, state.depth);
}
try { const m = location.hash.match(/cfg=([\w-]+)/); if (m) applyCfg(JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))))); } catch { /* ungültiger Link */ }
const saveHash = () => { try { history.replaceState(null, '', '#cfg=' + btoa(unescape(encodeURIComponent(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); } catch { /* egal */ } };

/* ---------- Renderer / Szene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let dpr = Math.min(devicePixelRatio, isMobile ? 1.75 : 2);
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.2, 2500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 1.5; controls.maxDistance = 60; controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.rotateSpeed = isMobile ? 0.7 : 1;
let shadowDirty = true;

/* Himmel, Sonne */
const pmrem = new THREE.PMREMGenerator(renderer);
const mkSky = (scale) => {
  const s = new Sky(); s.scale.setScalar(scale);
  const u = s.material.uniforms; u.turbidity.value = 3.2; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8; u.cloudCoverage.value = 0.45; u.cloudDensity.value = 0.5;
  return s;
};
const envSky = mkSky(50), envScene = new THREE.Scene(); envScene.add(envSky);
const sky = mkSky(1800); sky.renderOrder = 1; scene.add(sky);
const sun = new THREE.DirectionalLight(0xffeedd, 3); sun.castShadow = true; scene.add(sun, sun.target);
sun.shadow.intensity = 0.7; sun.shadow.mapSize.set(isMobile ? 2048 : 4096, isMobile ? 2048 : 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
const hemi = new THREE.HemisphereLight(0xd3e2f2, 0x4f5a42, 0.2); scene.add(hemi);
scene.fog = new THREE.Fog(0xb9c7d2, 90, 900);
const TIME = {
  day: { elev: 38, az: 150, exp: 0.62, env: 0.6, hemi: 0.2, fog: 0xb9c7d2, lamp: 0 },
  evening: { elev: 5, az: 120, exp: 0.7, env: 0.4, hemi: 0.14, fog: 0xc89d86, lamp: 0.55 },
  night: { elev: -9, az: 120, exp: 1.5, env: 0.45, hemi: 0.2, fog: 0x0b1320, lamp: 1 },
};
let envRT = null;
function setTime(key) {
  const t = TIME[key], e = Math.sin(THREE.MathUtils.degToRad(t.elev));
  const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - t.elev), THREE.MathUtils.degToRad(t.az));
  envSky.material.uniforms.sunPosition.value.copy(dir); sky.material.uniforms.sunPosition.value.copy(dir);
  sun.position.copy(dir.clone().setY(Math.max(0.12, dir.y))).multiplyScalar(60);
  if (t.elev > 0) { sun.intensity = 1.0 + 2.8 * e; sun.color.setHSL(0.085, 0.75, 0.66 + 0.2 * e); } else { sun.intensity = 0.7; sun.color.set(0x8fa6d8); }
  renderer.toneMappingExposure = t.exp; scene.environmentIntensity = t.env; hemi.intensity = t.hemi; scene.fog.color.set(t.fog);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0, 0.1, 100, { size: isMobile ? 256 : 512 });
  scene.environment = envRT.texture;
  setLamps(t.lamp);
  shadowDirty = true;
}

/* ---------- Texturen & Materialien ---------- */
const aniso = Math.min(isMobile ? 4 : 16, renderer.capabilities.getMaxAnisotropy());
const T = {
  mosaic: mosaicTexture(), wood: woodTexture(isMobile ? 512 : 1024), paverLight: paverTexture(isMobile ? 512 : 1024, [214, 208, 196], 41), paverDark: paverTexture(isMobile ? 512 : 1024, [112, 116, 122], 53),
  concrete: concreteTexture(), water: waterNormal(isMobile ? 256 : 512), slat: slatTexture(), noise: noiseNormal(),
};
for (const t of [T.mosaic, T.wood, T.paverLight, T.paverDark, T.concrete, T.slat]) t.anisotropy = aniso;
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
const mats = {
  liner: std({ map: T.mosaic, color: LINERS[state.liner].hex, roughness: 0.28, vertexColors: true, side: THREE.DoubleSide }),
  water: new THREE.MeshPhysicalMaterial({ color: LINERS[state.liner].hex, transparent: true, opacity: 0.52, roughness: 0.04, metalness: 0, ior: 1.33, normalMap: T.water, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 1.3, depthWrite: false }),
  waterAR: std({ color: LINERS[state.liner].hex, roughness: 0.18 }),
  lamp: std({ color: 0xffffff, emissive: 0xcdeeff, emissiveIntensity: 0, roughness: 0.4 }),
  slats: std({ map: T.slat, color: 0xcfd6da, roughness: 0.5, side: THREE.DoubleSide }),
  rollBox: std({ color: 0xaab2b7, roughness: 0.5, metalness: 0.3 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xe2f4f8, transparent: true, opacity: 0.2, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 }),
  alu: std({ color: 0xc2c8cc, roughness: 0.35, metalness: 0.85 }),
  loungerFrame: std({ color: 0xf0f0ee, roughness: 0.5 }), loungerCushion: std({ color: 0x8a949b, roughness: 0.95 }),
};
const copingMats = { stein: std({ map: T.paverLight, color: 0xd0ccc4, roughness: 0.85 }), granit: std({ map: T.paverDark, roughness: 0.6 }), beton: std({ map: T.concrete, color: 0xd6d6d3, roughness: 0.9 }) };
const deckMats = { holz: std({ map: T.wood, roughness: 0.75 }), stein: std({ map: T.paverLight, color: 0xc4c0b8, roughness: 0.85 }), beton: std({ map: T.concrete, color: 0xc8c8c6, roughness: 0.9 }), gras: null };
const setLinerColor = () => { const h = LINERS[state.liner].hex; mats.liner.color.setHex(h); mats.liner.emissive.setHex(h); mats.water.color.setHex(h); mats.waterAR.color.setHex(h); invalidateAR(); };

/* ---------- Rasen mit Beckenöffnung ---------- */
const grass = grassTextures(isMobile ? 1024 : 2048); grass.anisotropy = aniso; grass.repeat.set(1, 1);
const groundMat = new THREE.MeshStandardMaterial({ map: grass, bumpMap: grass, bumpScale: 1.2, roughness: 0.95, metalness: 0 });
groundMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vWPos;
    float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
    float macroNoise(vec2 p){ return 0.5*vn(p/41.0) + 0.3*vn(p/11.0) + 0.2*vn(p/2.7); }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
    float mn = macroNoise(vWPos.xz);
    diffuseColor.rgb *= mix(vec3(0.62, 0.74, 0.5), vec3(1.1, 1.06, 0.86), mn);`);
};
const ground = new THREE.Mesh(new THREE.BufferGeometry(), groundMat); ground.name = 'rasen'; ground.receiveShadow = true; scene.add(ground);

/* ---------- Pool ---------- */
let pool = null, lampLights = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0x9fe3ff, 0, 9, 1.4); scene.add(l); lampLights.push(l); }
let lampLevel = 0;
function setLamps(level) {
  lampLevel = level;
  mats.lamp.emissiveIntensity = level * 3;
  mats.liner.emissive.setHex(LINERS[state.liner].hex); mats.liner.emissiveIntensity = level * 0.45;
  lampLights.forEach((l, i) => { l.intensity = pool && pool.group.userData.lamps?.[i] ? level * 14 : 0; });
}
const matSet = () => ({ ...mats, coping: copingMats[state.coping], deck: deckMats[state.deck] || deckMats.stein });
function rebuild() {
  if (pool) { scene.remove(pool.group); pool.dispose(); }
  pool = buildPool(state, matSet(), 'scene');
  pool.group.traverse((o) => { if (o.isMesh && o.name === 'terrasse') o.receiveShadow = true; });
  scene.add(pool.group);
  ground.geometry.dispose(); ground.geometry = groundGeometry(pool.contour);
  const lamps = pool.group.userData.lamps || [];
  lampLights.forEach((l, i) => { const p = lamps[i]; if (p) l.position.set(p.x, p.y, p.z); });
  setLamps(lampLevel);
  const ext = Math.max(pool.dims.length, pool.dims.width) / 2 + 6, sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
  shadowDirty = true; invalidateAR(); updateInfo(); saveHash();
}
const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
function updateInfo() {
  const d = pool.dims;
  $('#d-size').textContent = `${fmt(state.length)} × ${fmt(state.width)} m`;
  $('#d-depth').textContent = state.depth <= 1.4 ? `${fmt(state.depth)} m` : `1,1 – ${fmt(state.depth)} m`;
  $('#d-area').textContent = `${fmt(d.area, 1)} m²`;
  $('#d-vol').textContent = `${fmt(d.volume, 1)} m³`;
}

/* ---------- Kamera ---------- */
let tween = null;
function goTo(pos, target, ms = 900) { tween = { p0: camera.position.clone(), p1: pos, t0: controls.target.clone(), t1: target, t: 0, ms }; }
const fit = () => Math.max(1, 0.78 / camera.aspect);
const views = {
  orbit(ms = 900) { const d = (Math.max(state.length, state.width * 1.6) * 0.95 + 4) * fit(); goTo(new THREE.Vector3(d * 0.62, d * 0.46, d * 0.8), new THREE.Vector3(0, -0.2, 0), ms); },
  top() { const d = (Math.max(state.length * 1.15, state.width * 2.1) + 5) * Math.max(1, 0.6 / camera.aspect); goTo(new THREE.Vector3(0.001, d, 0.6), new THREE.Vector3(0, 0, 0)); },
  near() { goTo(new THREE.Vector3(state.length * 0.22, 1.5 * fit(), state.width / 2 + 4.2 * fit()), new THREE.Vector3(-state.length * 0.05, -0.3, 0)); },
};

/* ---------- UI ---------- */
function seg(el, options, key, onChange) {
  el.innerHTML = Object.entries(options).map(([v, n]) => `<button data-v="${v}" aria-pressed="${state[key] === v}">${n}</button>`).join('');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state[key] = b.dataset.v; el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onChange(b.dataset.v);
  });
}
const sync = (el, key) => el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === state[key])));
let pending = false;
const scheduleRebuild = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; rebuild(); }); };
seg($('#o-shape'), SHAPES, 'shape', scheduleRebuild);
seg($('#o-steps'), STEPS, 'steps', scheduleRebuild);
seg($('#o-coping'), OPT.coping, 'coping', scheduleRebuild);
seg($('#o-deck'), OPT.deck, 'deck', scheduleRebuild);
seg($('#o-cover'), OPT.cover, 'cover', (v) => { pool.setCover(v); shadowDirty = true; invalidateAR(); saveHash(); });
seg($('#o-time'), OPT.time, 'time', (v) => { setTime(v); saveHash(); });
$('#o-liner').innerHTML = Object.entries(LINERS).map(([k, l]) => `<button class="sw" data-v="${k}" title="${l.name}" aria-label="${l.name}" aria-pressed="${state.liner === k}" style="--c:#${l.hex.toString(16).padStart(6, '0')}"></button>`).join('');
$('#o-liner').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.liner = b.dataset.v; sync($('#o-liner'), 'liner'); setLinerColor(); saveHash();
});
$('#o-views').innerHTML = '<button data-v="orbit">Außen</button><button data-v="top">Oben</button><button data-v="near">Nah</button>';
$('#o-views').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) views[b.dataset.v](); });
$('#o-preset').innerHTML = PRESETS.map(([l, w, d]) => `<button data-p="${l},${w},${d}">${l} × ${w}</button>`).join('');
const sliders = { length: $('#s-length'), width: $('#s-width'), depth: $('#s-depth') };
function syncSliders() { for (const [k, el] of Object.entries(sliders)) { el.value = state[k]; $(`#v-${k}`).textContent = fmt(state[k], k === 'depth' ? 1 : (k === 'length' ? 1 : 2)).replace(/,00$/, '').replace(/,0$/, '') + ' m'; } }
for (const [k, el] of Object.entries(sliders)) el.addEventListener('input', () => {
  state[k] = +el.value;
  if (k === 'length' && state.width > state.length - 0.5) state.width = Math.max(2, state.length - 0.5);
  if (k === 'width' && state.width > state.length - 0.5) state.length = Math.min(16, state.width + 0.5);
  syncSliders(); scheduleRebuild();
});
$('#o-preset').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; [state.length, state.width, state.depth] = b.dataset.p.split(',').map(Number); syncSliders(); rebuild(); views.orbit(); });
$('#b-panel').addEventListener('click', (e) => { const o = $('#cfg').classList.toggle('collapsed'); e.currentTarget.setAttribute('aria-expanded', String(!o)); });
if (isMobile) $('#cfg').classList.add('collapsed');

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 3500); }
function showModal(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').hidden = true; });
function qrSvg(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }

/* ---------- Anfrage ---------- */
function summary() {
  const d = pool.dims;
  return [
    `Form: ${SHAPES[state.shape]}`, `Maße: ${fmt(state.length)} × ${fmt(state.width)} m, Tiefe ${state.depth <= 1.4 ? fmt(state.depth) : '1,1 – ' + fmt(state.depth)} m`,
    `Fläche: ${fmt(d.area)} m², Wasserinhalt: ca. ${fmt(d.volume)} m³`, `Treppe: ${STEPS[state.steps]}`, `Beckenrand: ${OPT.coping[state.coping]}`,
    `Terrasse: ${OPT.deck[state.deck]}`, `Beckenfarbe: ${LINERS[state.liner].name}`, `Abdeckung: ${OPT.cover[state.cover]}`,
  ];
}
$('#b-ask').addEventListener('click', () => {
  const lines = summary(), link = location.href;
  const body = `Guten Tag,\n\nich interessiere mich für folgenden Pool:\n\n${lines.join('\n')}\n\nMeine Konfiguration: ${link}\n\nBitte senden Sie mir ein unverbindliches Angebot.\n\nName / Telefon / PLZ:\n`;
  const href = `mailto:${brand.mail}?subject=${encodeURIComponent('Pool-Anfrage' + (brand.firma ? '' : ''))}&body=${encodeURIComponent(body)}`;
  showModal(`<h2>Ihre Pool-Konfiguration</h2><ul class="sum">${lines.map((l) => `<li>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ul><p class="small">Unverbindliche Visualisierung. Maße und Optionen werden im Angebot bestätigt.</p><div class="row"><a class="solid btn" href="${href}">Per E-Mail anfragen</a><button class="ghost" id="b-copy">Link kopieren</button></div><div class="row"><button class="ghost" data-close>Schließen</button></div>`);
  $('#b-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); toast('Link kopiert'); } catch { toast('Kopieren nicht möglich – Adresszeile nutzen'); } });
});

/* ---------- AR (iOS Quick Look/USDZ, Android Scene Viewer/WebXR) ---------- */
// Im Gelände kann nichts ausgehoben werden: In AR liegt der Pool als flache Fläche (Wasser, Rand, Terrasse) auf dem Boden, 1:1.
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
    const root = new THREE.Group(); root.add(p.group);
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 512 });
    const usdz = await new USDZExporter().parseAsync(root, { quickLookCompatible: true, maxTextureSize: 512 });
    p.dispose();
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
$('#b-ar').addEventListener('click', async () => {
  if (!isTouchPhone) {
    const url = location.href;
    showModal(`<h2>Pool im eigenen Garten ansehen</h2><div class="qr">${qrSvg(url)}</div><p>QR-Code mit dem Handy scannen, dort „In AR ansehen“ tippen und den Pool auf der Wiese platzieren. Im Maßstab 1:1 sehen Sie, wie viel Platz er im Garten einnimmt.</p><p class="small">iPhone: Safari · Android: Chrome · nur über https</p><button class="solid" data-close>Schließen</button>`);
    return;
  }
  showModal(`<h2>AR vorbereiten</h2><p>Sie brauchen eine <b>freie, ebene Fläche von mindestens ${Math.ceil(state.length + 1)} × ${Math.ceil(state.width + 1)} m</b>. Der Pool erscheint <b>vor Ihnen</b> auf dem Boden und lässt sich per Finger verschieben und drehen.</p><div class="status" id="ar-status"><span class="spin"></span> Modell wird vorbereitet …</div><div class="row"><button class="ghost" data-close>Abbrechen</button><button class="solid" id="ar-go" disabled>AR starten</button></div>`);
  await nextFrames(2);
  if (ar.stale || !ar.ready) await buildAR();
  const st = $('#ar-status'), go = $('#ar-go'); if (!st || !go) return;
  if (!ar.ready) { st.textContent = 'Das Modell konnte nicht vorbereitet werden. Bitte Seite neu laden.'; return; }
  st.textContent = 'Bereit. Zum Platzieren den Boden mit der Kamera langsam abscannen.'; go.disabled = false;
  go.addEventListener('click', () => {
    if (ar.mv && ar.mv.canActivateAR) { $('#modal').hidden = true; ar.mv.activateAR(); }
    else { st.textContent = 'AR wird von diesem Browser/Gerät nicht unterstützt. iPhone: Safari · Android: Chrome (mit Google-Play-Diensten für AR).'; go.disabled = true; }
  }, { once: true });
});

/* ---------- Größe & Schleife ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const timer = new THREE.Timer();
let acc = 0, nF = 0, warm = 60, started = false;
renderer.setAnimationLoop(() => {
  if (!pool) return;
  timer.update(); const dt = Math.min(timer.getDelta(), 0.1);
  if (tween) {
    tween.t += dt * 1000; const k = Math.min(1, tween.t / tween.ms), e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e); if (k >= 1) tween = null;
  }
  controls.update();
  T.water.offset.x += dt * 0.012; T.water.offset.y += dt * 0.007;
  if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
  renderer.render(scene, camera);
  if (!started) { started = true; $('#loading').classList.add('done'); setTimeout(() => $('#loading').remove(), 800); }
  if (ar.building || params.has('fixed')) return;
  if (warm > 0) { warm--; return; }
  acc += dt; nF++;                                                // adaptive Auflösung: bei dauerhaft < ~30 fps schrittweise runter
  if (nF >= 60) { const avg = acc / nF; acc = 0; nF = 0; if (avg > 0.034 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); warm = 20; } }
});

/* ---------- Start ---------- */
syncSliders();
setTime(state.time);
rebuild();
camera.position.set(9, 6, 11); controls.target.set(0, -0.2, 0); views.orbit(1);
if (params.has('debug')) window.__app = { THREE, scene, camera, controls, renderer, state, rebuild, views, get pool() { return pool; }, setTime, buildAR, ar };
