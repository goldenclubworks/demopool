// Garten-Umgebung (von allen Seiten stimmig): umlaufende Hecke aus Blatt-Karten, Sichtschutz aus Holzlamellen, Beete, Bäume,
// Pflanzen (glTF), Leuchten und Lichterkette. Skaliert mit der Terrassengröße. Kein Gebäude.
import * as THREE from 'three';
import { COPING_W, DECK_W } from './pool.js';
import { leafCard, rng } from './textures.js';
import { pbr, loadModel } from './assets.js';
import { leafMaterial, leafCloud, hedge, tree } from './foliage.js';

let sh = null;
function shared() {
  if (sh) return sh;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const bark = std({ ...pbr('bark', { metersPerTile: 0.9 }), color: 0xd8cfc4 });
  sh = {
    leaf: leafMaterial(leafCard('laub', 512, 5)), blossom: leafMaterial(leafCard('bluete', 512, 9), { wind: 0.7 }), lanzett: leafMaterial(leafCard('lanzett', 512, 3), { wind: 1.6 }),
    core: std({ color: 0x1b3319, roughness: 1 }), bark,
    soil: std({ ...pbr('soil', { metersPerTile: 1 }), color: 0x9c8a78, roughness: 1 }),
    fence: std({ ...pbr('decking', { metersPerTile: 1 }), color: 0xcdbba5 }),
    steel: std({ color: 0x2b2f33, roughness: 0.45, metalness: 0.85 }), stone: std({ color: 0xb9b4aa, roughness: 0.85 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd59a, emissiveIntensity: 0, roughness: 0.4 }),
    wire: new THREE.MeshBasicMaterial({ color: 0x15171a }),
  };
  return sh;
}

export function buildGarden(bounds, { isMobile = false } = {}) {
  const M = shared(), group = new THREE.Group(); group.name = 'garten';
  const disposables = [], R = rng(5), dens = isMobile ? 0.5 : 1;
  const put = (geo, mat, pos, { rot, parent = group, cast = false, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = cast; m.receiveShadow = receive; parent.add(m); disposables.push(geo); return m;
  };
  const hx = (bounds.maxX - bounds.minX) / 2 + COPING_W + DECK_W, hz = (bounds.maxZ - bounds.minZ) / 2 + COPING_W + DECK_W;
  const lotX = hx + 12, lotFront = hz + 22, lotBack = -hz - 12;     // Kamera bleibt innerhalb dieses Rechtecks
  const sideZ = (lotFront + lotBack) / 2, sideLen = lotFront - lotBack;

  /* Sichtschutz: horizontale Holzlamellen zwischen anthrazitfarbenen Pfosten */
  const sw = hx * 2, sz = -hz - 0.05, sy = 1.85, slatH = 0.145, gapH = 0.012, n = Math.floor(sy / (slatH + gapH));
  for (let i = 0; i < n; i++) {
    const g = new THREE.BoxGeometry(sw, slatH, 0.028), uv = g.attributes.uv, p = g.attributes.position, ou = R() * 5, ov = R() * 5;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getY(k) + ov, p.getX(k) + ou);                   // Maserung läuft entlang der Lamelle
    put(g, M.fence, [0, 0.12 + slatH / 2 + i * (slatH + gapH), sz], { cast: true });
  }
  const np = Math.max(2, Math.round(sw / 2.4) + 1);
  for (let i = 0; i < np; i++) put(new THREE.BoxGeometry(0.1, sy + 0.2, 0.1), M.steel, [-sw / 2 + (sw * i) / (np - 1), (sy + 0.2) / 2, sz - 0.04], { cast: true });
  put(new THREE.BoxGeometry(sw + 0.1, 0.05, 0.14), M.steel, [0, sy + 0.14, sz - 0.02]);

  /* Hecke rundum */
  const hedgeH = 1.9, hedgeT = 1.1, dh = 110 * dens;
  const H = (len, c, rotY, seed) => { const h = hedge({ len, h: hedgeH, thick: hedgeT, center: new THREE.Vector3(...c), rotY }, M.leaf, M.core, dh, seed); group.add(h); };
  H(sideLen, [-lotX, 0, sideZ], Math.PI / 2, 11); H(sideLen, [lotX, 0, sideZ], Math.PI / 2, 12);
  H(lotX * 2 + hedgeT, [0, 0, lotFront], 0, 13); H(lotX * 2 + hedgeT, [0, 0, lotBack], 0, 14);

  /* Bäume */
  const tm = { bark: M.bark, core: M.core, leaf: M.leaf };
  const T = (x, z, h, spread, seed) => { const t = tree({ height: h, spread, seed, mats: tm, density: dens }); t.position.set(x, 0, z); t.rotation.y = R() * 6; group.add(t); };
  T(-lotX + 4, lotFront - 5, 7.5, 3.2, 21); T(lotX - 5, lotFront - 8, 6.5, 2.9, 22); T(-lotX + 4, lotBack + 4, 8.5, 3.4, 23); T(lotX - 4, lotBack + 5, 7, 3, 24);
  T(-hx - 8, -hz - 5, 6, 2.6, 25); T(hx + 9, -hz - 7, 7, 3, 26);

  /* Beete an den Seitenhecken: Erde, Randsteine, Sträucher mit Blüten */
  for (const side of [-1, 1]) {
    const x = side * (lotX - 1.9), z0 = lotBack + 7, z1 = lotFront - 7, len = z1 - z0, zc = (z0 + z1) / 2;
    put(new THREE.BoxGeometry(1.7, 0.2, len), M.soil, [x, 0.1, zc]);
    for (const e of [-1, 1]) put(new THREE.BoxGeometry(0.1, 0.26, len + 0.1), M.stone, [x + e * 0.9, 0.13, zc], { cast: true });
    const bushes = Math.floor(len / 1.1);
    const cloud = (mat, per, seedOff, sizeK) => group.add(leafCloud(Math.round(bushes * per * dens), (i) => {
      const b = i % bushes, bz = z0 + (b + 0.5) * (len / bushes), c = new THREE.Vector3(x + (R() - 0.5) * 0.5, 0.2, bz + (R() - 0.5) * 0.3), o = new THREE.Vector3(R() - 0.5, R() * 0.9 + 0.1, R() - 0.5).normalize();
      return { pos: c.addScaledVector(o, 0.2 + R() * 0.45).setY(Math.max(0.28, c.y + o.y * 0.6 + 0.25)), out: o, size: 0.26 * sizeK };
    }, mat, { seed: 40 + seedOff + side, cast: true, tint: [0.8, 1.2] }));
    cloud(M.leaf, 70, 0, 1.2); cloud(M.blossom, 26, 3, 1.1);
    // glTF-Pflanzen: Buchskugeln und Gräser in den Beeten
    loadModel('celandine_01').then((m) => { for (let i = 0; i < Math.floor(len / 3.4); i++) { const c = m.clone(); c.scale.setScalar(0.9 + R() * 0.4); c.position.set(x + (R() - 0.5) * 0.5, 0.15, z0 + 1.2 + i * 3.4); group.add(c); } });
    loadModel('grass_medium_02').then((m) => { for (let i = 0; i < Math.floor(len / 2.2); i++) { const c = m.clone(); c.scale.setScalar(0.9 + R() * 0.7); c.position.set(x + (R() - 0.5) * 0.7, 0.15, z0 + 0.6 + i * 2.2 + R()); c.rotation.y = R() * 6; group.add(c); } });
  }

  /* Leuchten an den Terrassenecken + Lichterkette am Sichtschutz */
  for (const [lx, lz] of [[hx + 0.4, hz - 0.4], [-hx - 0.4, hz - 0.4], [hx + 0.4, -hz + 2], [-hx - 0.4, -hz + 2]]) {
    put(new THREE.CylinderGeometry(0.045, 0.055, 0.9, 12), M.steel, [lx, 0.45, lz], { cast: true });
    put(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 14), M.glow, [lx, 0.95, lz]);
    put(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 14), M.steel, [lx, 1.02, lz]);
  }
  const nb = Math.max(6, Math.round(sw / 0.9));
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(-sw / 2 + sw * t, sy - 0.1 - 0.18 * Math.sin(Math.PI * ((t * (nb / 2)) % 1)), sz + 0.1)); }
  put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.006, 4), M.wire, [0, 0, 0]);
  for (let i = 0; i < nb; i++) { const t = (i + 0.5) / nb; put(new THREE.SphereGeometry(0.045, 10, 8), M.glow, [-sw / 2 + sw * t, sy - 0.1 - 0.18 * Math.sin(Math.PI * ((t * (nb / 2)) % 1)) - 0.04, sz + 0.1]); }

  const leafMats = [M.leaf, M.blossom, M.lanzett];
  return {
    group, lot: { x: lotX, front: lotFront, back: lotBack },
    setNight(level) { M.glow.emissiveIntensity = level * 3.2; },
    update(t) { for (const m of leafMats) m.userData.time.value = t; },
    dispose() { for (const g of disposables) g.dispose(); group.traverse((o) => { if (o.isInstancedMesh) o.geometry.dispose(); }); },
  };
}
