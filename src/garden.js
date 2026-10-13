// Garten-Umgebung (von allen Seiten stimmig): umlaufende Hecke, Holz-Sichtschutz an der Terrasse, Beete, Bäume,
// ferne Baumkulisse, Laternen und Lichterkette. Skaliert mit der Terrassengröße. Kein Gebäude.
import * as THREE from 'three';
import { COPING_W, DECK_W } from './pool.js';
import { leafTexture, woodTexture, rng } from './textures.js';

let sh = null;
function shared() {
  if (sh) return sh;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  sh = {
    leaf: leafTexture(), wood: woodTexture(512),
    trunk: std({ color: 0x5b4636 }), crown: [std({ color: 0x3f7a35 }), std({ color: 0x4f8f3d }), std({ color: 0x2f6a3a })],
    farCrown: std({ color: 0xffffff, roughness: 1 }),
    bed: std({ color: 0x3b2c20, roughness: 1 }), flower: [std({ color: 0xe85d75 }), std({ color: 0xf2d04b }), std({ color: 0xf5f5f5 }), std({ color: 0xa06ad8 })],
    post: std({ color: 0x2c3135, roughness: 0.5 }), woodPost: std({ color: 0x6b5340, roughness: 0.8 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd59a, emissiveIntensity: 0, roughness: 0.4 }),
  };
  return sh;
}

export function buildGarden(bounds) {
  const M = shared(), group = new THREE.Group(); group.name = 'garten';
  const disposables = [], ownMats = [];
  const put = (geo, mat, pos, { rot, parent = group } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); disposables.push(geo); return m;
  };
  const tiled = (tex, rx, ry, color = 0xffffff, rough = 0.9) => { const t = tex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; const m = new THREE.MeshStandardMaterial({ map: t, color, roughness: rough }); ownMats.push(m, t); return m; };
  const hx = (bounds.maxX - bounds.minX) / 2 + COPING_W + DECK_W, hz = (bounds.maxZ - bounds.minZ) / 2 + COPING_W + DECK_W;
  const lotX = hx + 12, lotFront = hz + 22, lotBack = -hz - 12;     // Kamera bleibt innerhalb dieses Rechtecks
  const R = rng(5);

  /* Sichtschutz aus Holz hinter der Terrasse */
  const sw = hx * 2, sz = -hz - 0.05, sy = 1.85;
  put(new THREE.BoxGeometry(sw, sy, 0.06), tiled(M.wood, sw / 2, sy / 2, 0xd9c2a4, 0.8), [0, sy / 2 + 0.02, sz]);
  const np = Math.max(2, Math.round(sw / 2.4) + 1);
  for (let i = 0; i < np; i++) put(new THREE.BoxGeometry(0.12, sy + 0.14, 0.14), M.woodPost, [-sw / 2 + (sw * i) / (np - 1), (sy + 0.14) / 2, sz]);
  put(new THREE.BoxGeometry(sw + 0.12, 0.08, 0.2), M.woodPost, [0, sy + 0.1, sz]);

  /* Hecke rundum */
  const hedgeH = 1.8, hedgeT = 1.0;
  const hedge = (len, pos, rotY = 0) => put(new THREE.BoxGeometry(len, hedgeH, hedgeT), tiled(M.leaf, len / 3, 1, 0xb8d0a8, 1), pos, { rot: [0, rotY, 0] });
  const sideLen = lotFront - lotBack, sideZ = (lotFront + lotBack) / 2;
  hedge(sideLen, [-lotX, hedgeH / 2, sideZ], Math.PI / 2); hedge(sideLen, [lotX, hedgeH / 2, sideZ], Math.PI / 2);
  hedge(lotX * 2 + hedgeT, [0, hedgeH / 2, lotFront]); hedge(lotX * 2 + hedgeT, [0, hedgeH / 2, lotBack]);

  /* Bäume im Grundstück */
  const tree = (x, z, s) => {
    const g = new THREE.Group();
    put(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 3.2 * s, 8), M.trunk, [0, 1.6 * s, 0], { parent: g });
    [[0, 4.2, 0, 1.9], [0.9, 3.5, 0.4, 1.4], [-0.8, 3.7, -0.5, 1.5], [0.2, 5.1, -0.2, 1.2]].forEach(([ox, oy, oz, r], i) => { const c = put(new THREE.IcosahedronGeometry(r * s, 1), M.crown[i % 3], [ox * s, oy * s, oz * s], { parent: g }); c.scale.y = 0.9; });
    g.position.set(x, 0, z); group.add(g);
  };
  tree(-lotX + 3.5, lotFront - 4, 1.2); tree(lotX - 4, lotFront - 6, 1.0); tree(-lotX + 3, lotBack + 3, 1.3); tree(lotX - 3.5, lotBack + 4, 1.1);
  tree(-hx - 6, -hz - 4, 0.9); tree(hx + 7, -hz - 6, 1.15);

  /* Beete an den Seitenhecken (Sträucher und Blumen) */
  for (const side of [-1, 1]) {
    const x = side * (lotX - 1.6), z0 = lotBack + 6, z1 = lotFront - 6, len = z1 - z0;
    put(new THREE.BoxGeometry(1.4, 0.22, len), M.bed, [x, 0.11, (z0 + z1) / 2]);
    const n = Math.floor(len * 1.1);
    for (let i = 0; i < n; i++) {
      const pz = z0 + (i + 0.5) * (len / n), px = x + (R() - 0.5) * 0.7, flower = i % 4 === 0;
      put(new THREE.SphereGeometry(0.2 + R() * 0.18, 8, 6), flower ? M.flower[(i >> 2) % 4] : M.crown[i % 3], [px, 0.34 + R() * 0.12, pz]);
    }
  }

  /* Ferne Baumkulisse (instanziert): schließt den Horizont, kein Blick auf „nichts“ */
  const FAR = 70, trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 6), M.trunk, FAR), crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.farCrown, FAR);
  disposables.push(trunks.geometry, crowns.geometry);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  for (let i = 0; i < FAR; i++) {
    const a = (i / FAR) * Math.PI * 2 + R() * 0.08, rr = 1 + R() * 0.18, rx = (lotX + 22) * rr, rz = (lotFront - lotBack) / 2 + 22, s = 4 + R() * 3.5;
    const x = Math.cos(a) * rx, z = sideZ + Math.sin(a) * rz * rr;
    m4.compose(new THREE.Vector3(x, 2.5 * (s / 5), z), q, new THREE.Vector3(s / 5, s / 5, s / 5)); trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, s * 1.35, z), q, new THREE.Vector3(s * 0.95, s * 0.85, s * 0.95)); crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, col.setHSL(0.28 + R() * 0.06, 0.45 + R() * 0.15, 0.1 + R() * 0.08));
  }
  group.add(trunks, crowns);

  /* Laternen an den Terrassenecken + Lichterkette am Sichtschutz */
  for (const [lx, lz] of [[hx + 0.4, hz - 0.4], [-hx - 0.4, hz - 0.4], [hx + 0.4, -hz + 2], [-hx - 0.4, -hz + 2]]) {
    put(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 8), M.post, [lx, 0.5, lz]);
    put(new THREE.SphereGeometry(0.13, 12, 10), M.glow, [lx, 1.08, lz]);
  }
  const nb = Math.max(6, Math.round(sw / 0.9));
  for (let i = 0; i < nb; i++) { const t = (i + 0.5) / nb; put(new THREE.SphereGeometry(0.05, 8, 6), M.glow, [-sw / 2 + sw * t, sy - 0.12 - 0.12 * Math.sin(Math.PI * ((t * 4) % 1)), sz + 0.1]); }

  return {
    group, lot: { x: lotX, front: lotFront, back: lotBack },
    setNight(level) { M.glow.emissiveIntensity = level * 3.2; },
    dispose() { for (const g of disposables) g.dispose(); for (const m of ownMats) m.dispose(); },
  };
}
