// Garten-Umgebung (von allen Seiten stimmig): umlaufende Hecke aus Blatt-Karten, Sichtschutz aus Holzlamellen, Beete, Bäume,
// Pflanzen (glTF), Leuchten und Lichterkette. Kein Gebäude.
// Zwei Teile: FEST (Hecke, Bäume, Beete – einmal für die größte denkbare Terrasse gebaut, kostet beim Modellwechsel nichts)
// und ANPASSBAR (Sichtschutz, Leuchten, Lichterkette – folgen der Beckengröße, wenige Objekte).
import * as THREE from 'three';
import { COPING_W, DECK_W } from './pool.js';
import { leafCard, rng } from './textures.js';
import { pbr, loadModel } from './assets.js';
import { leafMaterial, leafCloud, hedge, tree } from './foliage.js';
import { buildLawn } from './lawn.js';
import { instancePlants } from './plants.js';

let sh = null;
function shared() {
  if (sh) return sh;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const bark = std({ ...pbr('bark', { metersPerTile: 0.9, rough: false }), color: 0xd8cfc4 });
  sh = {
    leaf: leafMaterial(leafCard('laub', 512, 5)), blossom: leafMaterial(leafCard('bluete', 512, 9)),
    core: std({ color: 0x24401f, roughness: 1 }), bark,
    soil: std({ ...pbr('soil', { metersPerTile: 1, rough: false }), color: 0x9c8a78, roughness: 1 }),
    // Lamellen matt, wenig Umgebungsspiegelung (streifende Oberseiten reflektierten sonst den hellen Himmel als feine Linie)
    fence: std({ ...pbr('decking', { metersPerTile: 1, rough: false }), color: 0xe0cdb2, vertexColors: true, roughness: 1, envMapIntensity: 0.35 }),
    // Rückwand unbeleuchtet: Licht, das durch die engen Spalten fiele (Schattenauflösung gröber als der Spalt), würde sonst helle Striche zeichnen
    fenceBack: new THREE.MeshBasicMaterial({ color: 0x1d1510 }),
    steel: std({ color: 0x2b2f33, roughness: 0.45, metalness: 0.85 }), stone: std({ color: 0xb9b4aa, roughness: 0.85 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd59a, emissiveIntensity: 0, roughness: 0.4 }),
    wire: new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.55, metalness: 0.2 }),
    socket: new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.5, metalness: 0.4 }),
  };
  return sh;
}

const half = (b) => ({ hx: (b.maxX - b.minX) / 2 + COPING_W + DECK_W, hz: (b.maxZ - b.minZ) / 2 + COPING_W + DECK_W });

/** maxBounds: Beckenmaße der größten Variante (bestimmt Grundstück, Hecke, Bäume); mit fit() folgt der Rest dem aktuellen Becken. */
export function buildGarden(maxBounds, opts = {}) {
  const { isMobile = false } = opts;
  const M = shared(), group = new THREE.Group(); group.name = 'garten';
  const fixed = new THREE.Group(), adaptive = new THREE.Group(); group.add(fixed, adaptive);
  const geos = []; let adaptiveGeos = [], alive = true;
  const R = rng(5), hedgeD = opts.hedge ?? (isMobile ? 0.5 : 1), treeD = opts.tree ?? (isMobile ? 0.5 : 1);
  const mk = (list, parent) => (geo, mat, pos, { cast = false, receive = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = cast; m.receiveShadow = receive; parent.add(m); list.push(geo); return m; };
  const put = mk(geos, fixed);
  const { hx, hz } = half(maxBounds);
  const lotX = hx + 12, lotFront = hz + 22, lotBack = -hz - 12;     // Kamera bleibt innerhalb dieses Rechtecks
  const sideZ = (lotFront + lotBack) / 2, sideLen = lotFront - lotBack;

  /* Hecke rundum */
  const hedgeH = 1.9, hedgeT = 1.1, dh = 110 * hedgeD;
  const H = (len, c, rotY, seed) => fixed.add(hedge({ len, h: hedgeH, thick: hedgeT, center: new THREE.Vector3(...c), rotY, size: 0.34 * (1 + (1 - Math.min(1, hedgeD)) * 0.55) }, M.leaf, M.core, dh, seed));       // weniger Karten → größere Karten: Deckung bleibt
  H(sideLen, [-lotX, 0, sideZ], Math.PI / 2, 11); H(sideLen, [lotX, 0, sideZ], Math.PI / 2, 12);
  H(lotX * 2 + hedgeT, [0, 0, lotFront], 0, 13); H(lotX * 2 + hedgeT, [0, 0, lotBack], 0, 14);

  /* Bäume */
  const tm = { bark: M.bark, core: M.core, leaf: M.leaf };
  const T = (x, z, h, spread, seed) => { const t = tree({ height: h, spread, seed, mats: tm, density: treeD, size: 0.72 * (1 + (1 - Math.min(1, treeD)) * 0.55) }); t.position.set(x, 0, z); t.rotation.y = R() * 6; fixed.add(t); };
  T(-lotX + 4, lotFront - 5, 7.5, 3.2, 21); T(lotX - 5, lotFront - 8, 6.5, 2.9, 22); T(-lotX + 4, lotBack + 4, 8.5, 3.4, 23); T(lotX - 4, lotBack + 5, 7, 3, 24);
  T(-hx - 8, -hz - 5, 6, 2.6, 25); T(hx + 9, -hz - 7, 7, 3, 26);

  /* Beete an den Seitenhecken: Erde, Randsteine, Sträucher mit Blüten */
  for (const side of [-1, 1]) {
    const x = side * (lotX - 1.9), z0 = lotBack + 7, z1 = lotFront - 7, len = z1 - z0, zc = (z0 + z1) / 2;
    put(new THREE.BoxGeometry(1.7, 0.2, len), M.soil, [x, 0.1, zc]);
    for (const e of [-1, 1]) put(new THREE.BoxGeometry(0.1, 0.26, len + 0.1), M.stone, [x + e * 0.9, 0.13, zc], { cast: true });
    const bushes = Math.floor(len / 1.1);
    const cloud = (mat, per, seedOff, sizeK) => fixed.add(leafCloud(Math.round(bushes * per * Math.max(0.3, hedgeD)), (i) => {
      const b = i % bushes, bz = z0 + (b + 0.5) * (len / bushes), c = new THREE.Vector3(x + (R() - 0.5) * 0.5, 0.2, bz + (R() - 0.5) * 0.3), o = new THREE.Vector3(R() - 0.5, R() * 0.9 + 0.1, R() - 0.5).normalize();
      return { pos: c.addScaledVector(o, 0.2 + R() * 0.45).setY(Math.max(0.28, c.y + o.y * 0.6 + 0.25)), out: o, size: 0.26 * sizeK };
    }, mat, { seed: 40 + seedOff + side, cast: true, tint: [0.8, 1.2] }));
    cloud(M.leaf, 70, 0, 1.2); cloud(M.blossom, 26, 3, 1.1);
    // glTF-Pflanzen: Buchskugeln und Gräser in den Beeten (laden nach dem Preloader nach)
    // Pflanzen in den Beeten (Poly Haven, als Instanzen: ein Zeichenaufruf je Teilmesh statt Dutzender Klone)
    const place = (n, fx, fz, s0, s1, step) => Array.from({ length: n }, (_, i) => new THREE.Matrix4().compose(new THREE.Vector3(x + (R() - 0.5) * fx, 0.15, z0 + fz + i * step + R() * 0.8), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28), new THREE.Vector3().setScalar(s0 + R() * s1)));
    loadModel('celandine_01').then((m) => { if (alive) fixed.add(instancePlants(m, place(Math.floor(len / 3.4), 0.5, 1.2, 0.9, 0.4, 3.4))); });
    loadModel('grass_medium_02').then((m) => { if (alive) fixed.add(instancePlants(m, place(Math.floor(len / 2.2), 0.7, 0.6, 0.9, 0.7, 2.2))); });
  }

  let key = '', lawnOn = !opts.noLawn, lawnTok = 0, lawnMesh = null;
  /** Sichtschutz, Leuchten und Lichterkette an die aktuelle Terrasse anpassen */
  function fit(bounds) {
    const k = ['minX', 'maxX', 'minZ', 'maxZ'].map((n) => bounds[n].toFixed(2)).join(); if (k === key) return; key = k;
    for (const c of [...adaptive.children]) adaptive.remove(c); adaptiveGeos.forEach((g) => g.dispose()); adaptiveGeos = [];
    const A = mk(adaptiveGeos, adaptive), { hx: ax, hz: az } = half(bounds);
    if (lawnOn && (opts.lawn ?? 1) > 0) {                          // Rasenhalme etwas später (nächster Takt): der Umbau eines Modells bleibt so auf einem Bild, das alte Rasenstück liegt bis dahin weiter
      const tok = ++lawnTok;
      setTimeout(() => { if (!alive || tok !== lawnTok) return; const l = buildLawn({ hx: ax + 0.1, hz: az + 0.1 }, { count: opts.lawn ?? (isMobile ? 6000 : 15000), ground: opts.ground }); if (lawnMesh) { group.remove(lawnMesh); lawnMesh.dispose(); } lawnMesh = l; group.add(l); }, 30);
    }
    const sw = ax * 2, sz = -az - 0.05, sy = 1.85, slatH = 0.145, gapH = 0.012, n = Math.floor(sy / (slatH + gapH)), F = rng(7);
    /* Sichtschutz: horizontale Holzlamellen zwischen anthrazitfarbenen Pfosten; dunkle Rückwand, damit die schmalen Spalten dunkel wirken statt als helle Strichelchen zu flimmern */
    A(new THREE.BoxGeometry(sw, sy - 0.06, 0.02), M.fenceBack, [0, 0.12 + (sy - 0.06) / 2, sz - 0.03]);
    for (let i = 0; i < n; i++) {
      const g = new THREE.BoxGeometry(sw, slatH, 0.028), uv = g.attributes.uv, p = g.attributes.position, ou = F() * 5, ov = F() * 5;
      for (let q = 0; q < uv.count; q++) uv.setXY(q, p.getY(q) + ov, p.getX(q) + ou);                   // Maserung läuft entlang der Lamelle
      // Oberseiten dunkler: von oben gesehen waren sie als schmale helle Striche (Strichelchen) zu erkennen, die flimmern
      const nrm = g.attributes.normal, col = new Float32Array(p.count * 3); for (let q = 0; q < p.count; q++) { const k = nrm.getY(q) > 0.5 ? 0.16 : nrm.getY(q) < -0.5 ? 0.14 : 1; col.set([k, k, k], q * 3); } g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      A(g, M.fence, [0, 0.12 + slatH / 2 + i * (slatH + gapH), sz], { cast: true });
    }
    const np = Math.max(2, Math.round(sw / 2.4) + 1);
    for (let i = 0; i < np; i++) A(new THREE.BoxGeometry(0.1, sy + 0.2, 0.1), M.steel, [-sw / 2 + (sw * i) / (np - 1), (sy + 0.2) / 2, sz - 0.04], { cast: true });
    A(new THREE.BoxGeometry(sw + 0.1, 0.05, 0.14), M.steel, [0, sy + 0.14, sz - 0.02]);
    /* Leuchten an den Terrassenecken + Lichterkette am Sichtschutz */
    for (const [lx, lz] of [[ax + 0.4, az - 0.4], [-ax - 0.4, az - 0.4], [ax + 0.4, -az + 2], [-ax - 0.4, -az + 2]]) {
      A(new THREE.CylinderGeometry(0.045, 0.055, 0.9, 12), M.steel, [lx, 0.45, lz], { cast: true });
      A(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 14), M.glow, [lx, 0.95, lz]);
      A(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 14), M.steel, [lx, 1.02, lz]);
    }
    const nb = Math.max(6, Math.round(sw / 0.9)), sag = (t) => sy - 0.1 - 0.18 * Math.sin(Math.PI * ((t * (nb / 2)) % 1));
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(-sw / 2 + sw * t, sag(t), sz + 0.1)); }
    // Kabel mit sichtbarer Stärke (1,2 cm): dünnere Röhren (< 1 Pixel) wurden von Kantenglättung und AO zerrissen und wirkten wie ein Geist
    A(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0065, 6), M.wire, [0, 0, 0]);
    for (let i = 0; i < nb; i++) { const t = (i + 0.5) / nb, x = -sw / 2 + sw * t, y = sag(t);
      A(new THREE.CylinderGeometry(0.014, 0.014, 0.035, 8), M.socket, [x, y - 0.022, sz + 0.1]);
      A(new THREE.SphereGeometry(0.042, 14, 10), M.glow, [x, y - 0.068, sz + 0.1]); }
  }

  return {
    group, lot: { x: lotX, front: lotFront, back: lotBack }, fit,
    setLawn(on) { lawnOn = on; key = ''; },
    setNight(level) { M.glow.emissiveIntensity = level * 3.2; },
    dispose() { alive = false; if (lawnMesh) lawnMesh.dispose(); for (const g of [...geos, ...adaptiveGeos]) g.dispose(); group.traverse((o) => { if (o.isInstancedMesh) o.geometry.dispose(); }); },
  };
}
