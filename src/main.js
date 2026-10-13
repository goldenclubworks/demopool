import * as THREE from 'three';
import qrcode from 'qrcode-generator';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { grassTextures, mosaicTexture, woodTexture, paverTexture, concreteTexture, waterNormal, slatTexture } from './textures.js';
import { buildPool, groundGeometry, patchGeometry } from './pool.js';
import { buildExtras } from './extras.js';
import { buildGarden } from './garden.js';
import { COPING_W } from './pool.js';
import { MODELS, LINERS, STEP_NAMES, COPING, DECK, COVER, TIMES, LIGHTS, EXTRAS, modelById, defaultExtras, priceOf, fmtEur } from './catalog.js';
import { initUI } from './ui.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const params = new URLSearchParams(location.search);
const ua = navigator.userAgent;
const isTouchPhone = /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = params.has('mobile') || matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const showPrices = params.get('preise') !== '0';

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
const state = { model: 'marina', shape: 'round', length: 7, width: 3.5, depth: 1.5, steps: 'corner', liner: 'hellblau', coping: 'stein', deck: 'holz', cover: 'none', time: 'day', garden: true, extras: defaultExtras() };
function applyModel(id) { const m = modelById(id); Object.assign(state, { model: m.id, shape: m.shape, length: m.length, width: m.width, depth: m.depth, steps: m.steps }); }
applyModel('marina');
const clampNum = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);
function applyCfg(c) {
  if (!c || typeof c !== 'object') return;
  if (MODELS.some((m) => m.id === c.model)) applyModel(c.model);
  else if (c.model === 'frei' || ['rect', 'round', 'oval', 'roman', 'kidney'].includes(c.shape)) {      // freie Maße / alte Links ohne Modell
    state.model = 'frei'; if (['rect', 'round', 'oval', 'roman', 'kidney'].includes(c.shape)) state.shape = c.shape;
    state.length = clampNum(c.length, 3, 16, state.length); state.width = clampNum(c.width, 2, 6.5, state.width); state.depth = clampNum(c.depth, 1, 2.4, state.depth);
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
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('#loading').innerHTML = 'Die 3D-Ansicht wird von diesem Gerät oder Browser nicht unterstützt.<br>Bitte einen aktuellen Browser (Safari, Chrome, Firefox, Edge) verwenden.'; throw e; }
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); toast('Die Grafik wurde unterbrochen – Seite wird neu geladen …'); setTimeout(() => location.reload(), 1200); });
let dpr = Math.min(devicePixelRatio, isMobile ? 1.5 : 2);
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.2, 2500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 2.5; controls.maxDistance = 42; controls.minPolarAngle = 0.1; controls.maxPolarAngle = 1.46; controls.enablePan = false;
controls.rotateSpeed = isMobile ? 0.6 : 1; controls.zoomSpeed = isMobile ? 0.9 : 1; controls.dampingFactor = isMobile ? 0.12 : 0.08; controls.autoRotateSpeed = 1.1;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };   // Pan ist aus: zwei Finger = Zoom
let shadowDirty = true;

/* Himmel, Sonne */
const pmrem = new THREE.PMREMGenerator(renderer);
const mkSky = (scale) => {
  const s = new Sky(); s.scale.setScalar(scale);
  const u = s.material.uniforms; u.turbidity.value = 3.2; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8; u.cloudCoverage.value = 0.45; u.cloudDensity.value = 0.5;
  return s;
};
const envSky = mkSky(50), envScene = new THREE.Scene(); envScene.add(envSky);
// Himmel einmal in eine Cube-Map gebacken (statt Wolken-Shader pro Frame): deutlich leichter auf Handys
const cubeRT = new THREE.WebGLCubeRenderTarget(isMobile ? 512 : 1024, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
const sun = new THREE.DirectionalLight(0xffeedd, 3); sun.castShadow = true; scene.add(sun, sun.target);
sun.shadow.intensity = 0.7; sun.shadow.mapSize.set(isMobile ? 1536 : 4096, isMobile ? 1536 : 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
const hemi = new THREE.HemisphereLight(0xd3e2f2, 0x4f5a42, 0.2); scene.add(hemi);
scene.fog = new THREE.Fog(0xb9c7d2, 70, 520);
const TIME = {
  day: { elev: 38, az: 150, exp: 0.62, env: 0.6, hemi: 0.2, fog: 0xb9c7d2, lamp: 0, caus: 1 },
  evening: { elev: 5, az: 120, exp: 0.7, env: 0.4, hemi: 0.14, fog: 0xc89d86, lamp: 0.55, caus: 0.45 },
  night: { elev: -9, az: 120, exp: 1.5, env: 0.45, hemi: 0.2, fog: 0x0b1320, lamp: 1, caus: 0.25 },
};
const causU = { uTime: { value: 0 }, uCaus: { value: 1 } };
let envRT = null;
function setTime(key) {
  const t = TIME[key], e = Math.sin(THREE.MathUtils.degToRad(t.elev));
  const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - t.elev), THREE.MathUtils.degToRad(t.az));
  envSky.material.uniforms.sunPosition.value.copy(dir);
  sun.position.copy(dir.clone().setY(Math.max(0.12, dir.y))).multiplyScalar(60);
  if (t.elev > 0) { sun.intensity = 1.0 + 2.8 * e; sun.color.setHSL(0.085, 0.75, 0.66 + 0.2 * e); } else { sun.intensity = 0.7; sun.color.set(0x8fa6d8); }
  renderer.toneMappingExposure = t.exp; scene.environmentIntensity = t.env; hemi.intensity = t.hemi; scene.fog.color.set(t.fog); causU.uCaus.value = t.caus;
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0, 0.1, 100, { size: isMobile ? 256 : 512 });
  scene.environment = envRT.texture;
  cubeCam.update(renderer, envScene); scene.background = cubeRT.texture;
  setLamps(t.lamp);
  shadowDirty = true;
}

/* ---------- Texturen & Materialien ---------- */
const aniso = Math.min(isMobile ? 4 : 16, renderer.capabilities.getMaxAnisotropy());
const T = {
  mosaic: mosaicTexture(), wood: woodTexture(isMobile ? 512 : 1024), paverLight: paverTexture(isMobile ? 512 : 1024, [214, 208, 196], 41), paverDark: paverTexture(isMobile ? 512 : 1024, [112, 116, 122], 53),
  concrete: concreteTexture(), water: waterNormal(isMobile ? 256 : 512), slat: slatTexture(),
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
// Lichtmuster (Kaustik) am Beckenboden/-wand: nur unter der Wasserlinie, animiert
mats.liner.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, causU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vWPos; uniform float uTime; uniform float uCaus;
    float caustic(vec2 p, float t){
      vec2 q = p * 1.7; float c = 0.0;
      for (int i = 0; i < 3; i++) {
        q += vec2(sin(q.y * 1.3 + t * 0.7 + float(i) * 2.0), sin(q.x * 1.1 - t * 0.6 + float(i) * 1.3)) * 0.55;
        c += 1.0 - abs(sin(q.x * 1.9 + q.y * 0.7));
      }
      return pow(clamp(c / 3.0, 0.0, 1.0), 7.0);
    }`).replace('#include <map_fragment>', `#include <map_fragment>
    float under = smoothstep(-0.1, -0.35, vWPos.y);
    diffuseColor.rgb += vec3(0.95, 1.0, 1.0) * caustic(vWPos.xz + vWPos.y * 0.3, uTime) * uCaus * 0.55 * under;`);
};
const copingMats = { stein: std({ map: T.paverLight, color: 0xd0ccc4, roughness: 0.85 }), granit: std({ map: T.paverDark, roughness: 0.6 }), beton: std({ map: T.concrete, color: 0xd6d6d3, roughness: 0.9 }) };
const deckMats = { holz: std({ map: T.wood, roughness: 0.75 }), stein: std({ map: T.paverLight, color: 0xc4c0b8, roughness: 0.85 }), beton: std({ map: T.concrete, color: 0xc8c8c6, roughness: 0.9 }), gras: null };
function setLinerColor() { const h = LINERS[state.liner].hex; mats.liner.color.setHex(h); mats.water.color.setHex(h); mats.waterAR.color.setHex(h); invalidateAR(); }

/* ---------- Rasen mit Beckenöffnung ---------- */
const grass = grassTextures(1024); grass.anisotropy = aniso; grass.repeat.set(1, 1);
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
const patch = new THREE.Mesh(new THREE.BufferGeometry(), groundMat); patch.name = 'rasen-vorher'; patch.visible = false; patch.receiveShadow = true; scene.add(patch);

/* ---------- Pool, Zubehör, Garten ---------- */
let pool = null, extras = null, garden = null, gardenKey = '', before = false;
const lampLights = [];
for (let i = 0; i < (isMobile ? 2 : 4); i++) { const l = new THREE.PointLight(0x9fe3ff, 0, 9, 1.4); l.visible = false; scene.add(l); lampLights.push(l); }
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
  lampLights.forEach((l, i) => { const on = level > 0 && pool && pool.group.userData.lamps?.[i]; l.intensity = on ? level * 14 : 0; l.visible = !!on && !lite; });
  if (garden) garden.setNight(level);
  applyLightColor(performance.now() / 1000);
}
const matSet = () => ({ ...mats, coping: copingMats[state.coping], deck: deckMats[state.deck] || deckMats.stein });
function buildExtrasNow() {
  if (extras) { scene.remove(extras.group); extras.dispose(); }
  extras = buildExtras(state, pool, mats, 'scene'); extras.group.visible = !before; scene.add(extras.group);
}
function rebuildExtras() { buildExtrasNow(); shadowDirty = true; invalidateAR(); saveHash(); ui && ui.refresh(); }
function rebuild() {
  if (pool) { scene.remove(pool.group); pool.dispose(); }
  pool = buildPool(state, matSet(), 'scene');
  pool.group.traverse((o) => { if (o.isMesh && o.name === 'terrasse') o.receiveShadow = true; });
  pool.group.visible = !before; scene.add(pool.group);
  ground.geometry.dispose(); ground.geometry = groundGeometry(pool.contour);
  patch.geometry.dispose(); patch.geometry = patchGeometry(pool.contour);
  const gk = ['minX', 'maxX', 'minZ', 'maxZ'].map((k) => pool.bounds[k].toFixed(2)).join();
  if (!garden || gk !== gardenKey) { if (garden) { scene.remove(garden.group); garden.dispose(); } garden = buildGarden(pool.bounds); scene.add(garden.group); gardenKey = gk; }
  garden.group.visible = state.garden;
  buildExtrasNow(); buildDims();
  const lamps = pool.group.userData.lamps || [];
  lampLights.forEach((l, i) => { const p = lamps[i]; if (p) l.position.set(p.x, p.y, p.z); });
  setLamps(lampLevel);
  const ext = Math.max(pool.dims.length, pool.dims.width) / 2 + 6, sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
  shadowDirty = true; invalidateAR(); saveHash(); ui && ui.refresh();
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
  if (dimsGroup) { scene.remove(dimsGroup); dimsGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); dimsGroup = null; }
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
  g.visible = dimsOn && !before; scene.add(g); dimsGroup = g;
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
  if (!isSheet()) { vo.tx = -(r.right + 14) / 2; vo.ty = 0; } else { vo.tx = 0; vo.ty = (r.height + 8 - topUi()) / 2; }   // Szene in die Mitte des freien Bereichs
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
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/jpeg', 0.88);
  applyVO();
  return Promise.resolve(url);
}
async function download() { const a = document.createElement('a'); a.href = await snap(); a.download = 'pool-konfiguration.jpg'; document.body.append(a); a.click(); a.remove(); }
function ask() {
  const lines = summaryLines(), p = price(), link = location.href;
  const priceLine = showPrices ? `\nBeispielpreis laut Konfigurator: ab ca. ${fmtEur(p.total)}\n` : '\n';
  const body = `Guten Tag,\n\nich interessiere mich für folgenden Pool:\n\n${lines.join('\n')}\n${priceLine}\nMeine Konfiguration: ${link}\n\nBitte senden Sie mir ein unverbindliches Angebot.\n\nName / Telefon / PLZ:\n`;
  const href = `mailto:${brand.mail}?subject=${encodeURIComponent('Pool-Anfrage')}&body=${encodeURIComponent(body)}`;
  showModal(`<h2>Ihre Pool-Konfiguration</h2><ul class="sum">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${showPrices ? `<p><b>ab ca. ${fmtEur(p.total)}</b> (Beispielpreis)</p>` : ''}<p class="small">Unverbindliche Visualisierung. Maße, Preise und Ausführung werden im Angebot bestätigt.</p><div class="row"><a class="solid btn" href="${href}">Per E-Mail anfragen</a><button class="ghost" id="b-copy">Link kopieren</button></div><div class="row"><button class="ghost" data-close>Schließen</button></div>`);
  $('#b-copy').addEventListener('click', copyLink);
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
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 512 });
    const usdz = await new USDZExporter().parseAsync(root, { quickLookCompatible: true, maxTextureSize: 512 });
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
    showModal(`<h2>Pool im eigenen Garten ansehen</h2><div class="qr">${qrSvg(location.href)}</div><p>QR-Code mit dem Handy scannen, dort „Im Garten ansehen“ tippen und den Pool auf der Wiese platzieren. Im Maßstab 1:1 sehen Sie, wie viel Platz er im Garten einnimmt.</p><p class="small">iPhone: Safari · Android: Chrome · nur über https</p><button class="solid" data-close>Schließen</button>`);
    return;
  }
  showModal(`<h2>AR vorbereiten</h2><p>Sie brauchen eine <b>freie, ebene Fläche von mindestens ${Math.ceil(state.length + 6)} × ${Math.ceil(state.width + 6)} m</b>. Der Pool erscheint <b>vor Ihnen</b> auf dem Boden und lässt sich per Finger verschieben und drehen.</p><div class="status" id="ar-status"><span class="spin"></span> Modell wird vorbereitet …</div><div class="row"><button class="ghost" data-close>Abbrechen</button><button class="solid" id="ar-go" disabled>AR starten</button></div>`);
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

/* ---------- Bedienung anbinden ---------- */
let ui = null;
const api = {
  state, showPrices, free: params.has('frei'),
  change(key, v) {
    if (key === 'model') { applyModel(v); rebuild(); views.orbit(); return; }
    state[key] = v;
    if (key === 'steps' || key === 'coping' || key === 'deck') rebuild();
    else if (key === 'liner') { setLinerColor(); applyLightColor(performance.now() / 1000); saveHash(); ui.refresh(); }
    else if (key === 'cover') { pool.setCover(v); shadowDirty = true; invalidateAR(); saveHash(); ui.refresh(); if (v === 'roof') views.wide(); }
    else if (key === 'time') { setTime(v); saveHash(); }
    else if (key === 'garden') { garden.group.visible = v; saveHash(); }
  },
  changeExtra(k, v) {
    state.extras[k] = v;
    if (k === 'light') { applyLightColor(performance.now() / 1000); saveHash(); ui.refresh(); } else { rebuildExtras(); if (v && k === 'jet') { controls.autoRotate = false; views.flip(); } }
  },
  changeSize(k, v) { state.model = 'frei'; state[k] = v; if (k === 'length' && state.width > v - 0.5) state.width = Math.max(2, v - 0.5); if (k === 'width' && v > state.length - 0.5) state.length = Math.min(16, v + 0.5); scheduleRebuild(); },
  price, dims: () => pool && pool.dims, summaryLines, snap, download, copyLink, ask, ar: openAR, layout,
  view(v) { controls.autoRotate = false; views[v](); },
  spin() { controls.autoRotate = !controls.autoRotate; return controls.autoRotate; },
  before(on) { before = on; pool.group.visible = !on; extras.group.visible = !on; patch.visible = on; ground.visible = !on; if (dimsGroup) dimsGroup.visible = dimsOn && !on; shadowDirty = true; },
  toggleDims() { dimsOn = !dimsOn; if (dimsGroup) dimsGroup.visible = dimsOn && !before; return dimsOn; },
  onStep(n) { const v = STEP_VIEW[n]; if (v) { controls.autoRotate = false; views[v](); } },
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

/* ---------- Sparmodus: schwache Geräte (keine Wolken-Shader, keine Schatten/Punktlichter) ---------- */
let lite = false;
function goLite() {
  if (lite) return; lite = true;
  sun.castShadow = false; lampLights.forEach((l) => { l.visible = false; });
  dpr = Math.max(1, Math.min(dpr, 1.25)); resize();
}
if (params.has('lite')) setTimeout(goLite, 0);

/* ---------- Größe & Schleife ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  if (w === lastW && h === lastH && dpr === lastDpr) { layout(true); return; }
  lastW = w; lastH = h; lastDpr = dpr;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; layout(true);
}
let lastW = 0, lastH = 0, lastDpr = 0, rsT = 0;
addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(resize, 120); });   // Adressleisten-Ein-/Ausblenden löst viele resize-Ereignisse aus
resize();
new ResizeObserver(() => layout()).observe($('#cfg'));
const timer = new THREE.Timer();
let acc = 0, nF = 0, warm = 60, started = false, clock = 0;
let intro = (params.has('nointro') || matchMedia('(prefers-reduced-motion: reduce)').matches) ? null : { t: 0 };
// Handy im Leerlauf (keine Berührung, keine Fahrt): nur jedes zweite Bild zeichnen → kühler, akkuschonender
let lastActive = 0, frameNo = 0;
const wake = () => { lastActive = performance.now(); };
controls.addEventListener('change', wake); canvas.addEventListener('pointerdown', wake); addEventListener('wheel', wake, { passive: true });
renderer.setAnimationLoop(() => {
  if (!pool) return;
  timer.update(); const dt = Math.min(timer.getDelta(), 0.1); clock += dt;
  if (isMobile && !tween && !intro && !controls.autoRotate && performance.now() - lastActive > 900 && (frameNo++ & 1)) return;
  if (tween) tweenStep(dt);
  controls.update();
  if (Math.abs(vo.x - vo.tx) > 0.3 || Math.abs(vo.y - vo.ty) > 0.3) { const f = Math.min(1, dt * 9); vo.x += (vo.tx - vo.x) * f; vo.y += (vo.ty - vo.y) * f; applyVO(); wake(); }
  if (garden) { const l = garden.lot, p = camera.position; p.x = Math.max(-l.x + 1.5, Math.min(l.x - 1.5, p.x)); p.z = Math.max(l.back + 1.5, Math.min(l.front - 1.5, p.z)); p.y = Math.max(0.7, Math.min(45, p.y)); }
  if (intro) {                                                    // Einstieg: Wasser läuft ein, Kamera fährt heran
    intro.t += dt; const k = Math.min(1, Math.max(0, (intro.t - 0.4) / 2.8)), e = 1 - (1 - k) ** 3, w = pool.group.getObjectByName('wasser');
    if (w) w.position.y = -(pool.dims.depth - 0.1) * (1 - e);
    if (k >= 1) { if (w) w.position.y = 0; intro = null; toast(isMobile ? 'Ziehen zum Drehen · zwei Finger zum Zoomen' : 'Ziehen zum Drehen · Scrollen zum Zoomen'); }
  }
  T.water.offset.x += dt * 0.012; T.water.offset.y += dt * 0.007; causU.uTime.value = clock;
  if (extras) extras.update(clock);
  if (lampLevel > 0 && state.extras.light === 'wechsel') applyLightColor(clock);
  if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
  renderer.render(scene, camera);
  if (!started) { started = true; $('#loading').classList.add('done'); setTimeout(() => $('#loading').remove(), 800); }
  if (ar.building || params.has('fixed')) return;
  if (warm > 0) { warm--; return; }
  acc += dt; nF++;                                                // adaptive Auflösung: bei dauerhaft < ~30 fps schrittweise runter
  if (nF >= 40) { const avg = acc / nF; acc = 0; nF = 0; if (avg > 0.034) { if (dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); warm = 20; } else if (!lite) { goLite(); warm = 20; } } }
});

/* ---------- Start ---------- */
ui = initUI(api);
setTime(state.time);
rebuild();
if (isSheet()) { $('#cfg').classList.add('collapsed'); $('#b-panel').textContent = 'Konfigurieren ▴'; $('#b-panel').setAttribute('aria-expanded', 'false'); }
layout();
camera.position.set(9, 6, 11); controls.target.set(0, -0.2, 0); views.orbit(1);
if (intro) { camera.position.set(-14, 12, 26); controls.target.set(0, -0.2, 0); views.orbit(3600); }
if (params.has('debug')) window.__app = { THREE, scene, camera, controls, renderer, state, rebuild, views, ui, get pool() { return pool; }, get garden() { return garden; }, get extras() { return extras; }, setTime, buildAR, ar, api };
