// Parametrisches Schwimmbecken: Becken (Wand, Boden, Treppe), Wasser, Rand, Terrasse, Abdeckung, Liegen.
// Koordinaten: Meter, y = oben, Gelände bei y = 0, Beckenmitte im Ursprung, Längsachse = x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from './textures.js';

export const SHAPES = {
  rect: 'Rechteck',
  round: 'Rundecken',
  oval: 'Oval',
  roman: 'Römisch',
  kidney: 'Niere',
};
export const STEPS = { none: 'Ohne', corner: 'Ecktreppe', roman: 'Römertreppe', full: 'Breittreppe' };

export const WATER_Y = -0.12;      // Wasserspiegel unter Beckenrand-Oberkante
export const COPING_W = 0.32;      // Breite Beckenrand
export const DECK_W = 2.2;         // Breite Terrasse außerhalb des Beckenrands

/* ---------- 2D-Konturen in der (x, z)-Ebene, gegen den Uhrzeigersinn ---------- */
function arc(cx, cz, rx, rz, a0, a1, n, out) {
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push(new THREE.Vector2(cx + rx * Math.cos(a), cz + rz * Math.sin(a))); }
}
function roundedRect(a, b, r) {
  r = Math.max(0.001, Math.min(r, a, b));
  const p = [];
  arc(a - r, -b + r, r, r, -Math.PI / 2, 0, 10, p);
  arc(a - r, b - r, r, r, 0, Math.PI / 2, 10, p);
  arc(-a + r, b - r, r, r, Math.PI / 2, Math.PI, 10, p);
  arc(-a + r, -b + r, r, r, Math.PI, Math.PI * 1.5, 10, p);
  return p;
}
function baseContour(shape, L, W) {
  const a = L / 2, b = W / 2;
  switch (shape) {
    case 'round': return roundedRect(a, b, Math.min(1.2, b * 0.6));
    case 'oval': { const p = []; arc(0, 0, a, b, 0, Math.PI * 2, 120, p); p.pop(); return p; }
    case 'roman': {                                   // Treppenende (x<0) rund, anderes Ende gerade mit kleinem Radius
      const r = Math.min(b, a), p = [];
      arc(a - 0.1, -b + 0.1, 0.1, 0.1, -Math.PI / 2, 0, 4, p);
      arc(a - 0.1, b - 0.1, 0.1, 0.1, 0, Math.PI / 2, 4, p);
      arc(-a + r, 0, r, b, Math.PI / 2, Math.PI * 1.5, 40, p);
      return p;
    }
    case 'kidney': {                                  // Bohne: gewölbte Mittellinie, abgerundete Enden, eingezogene Oberseite
      const raw = [], N = 60, pw = 2.5;
      const prof = (u, side) => {
        const h = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), pw)), 1 / pw);
        return (side > 0 ? 1 - 0.2 * Math.exp(-u * u * 5) : 1) * h;
      };
      for (let i = 0; i <= N; i++) { const u = Math.cos((i / N) * Math.PI); raw.push(new THREE.Vector2(u * a, 0.3 * (1 - u * u) * b + prof(u, 1) * b * 0.85)); }
      for (let i = N - 1; i > 0; i--) { const u = Math.cos((i / N) * Math.PI); raw.push(new THREE.Vector2(u * a, 0.3 * (1 - u * u) * b - prof(u, -1) * b * 0.85)); }
      const zs = raw.map((v) => v.y), zmin = Math.min(...zs), zmax = Math.max(...zs);
      return raw.map((v) => new THREE.Vector2(v.x, ((v.y - zmin) / (zmax - zmin) - 0.5) * W)).reverse();
    }
    default: return roundedRect(a, b, 0.12);
  }
}
function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i].x * q.y - q.x * p[i].y; } return s / 2; }
function resample(p, step) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}
export function contourFor(shape, L, W) {
  let p = resample(baseContour(shape, L, W), 0.2);
  if (area(p) < 0) p = p.reverse();
  return p;
}
function offsetPoly(p, o) {
  const n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
    const e1 = b.clone().sub(a).normalize(), e2 = c.clone().sub(b).normalize();
    const n1 = new THREE.Vector2(e1.y, -e1.x), n2 = new THREE.Vector2(e2.y, -e2.x);   // Außennormalen (CCW)
    const nv = n1.clone().add(n2).normalize();
    out.push(b.clone().addScaledVector(nv, o / Math.max(0.35, nv.dot(n1))));
  }
  return out;
}
/** [zmin, zmax] der Kontur bei x (Konturen sind je x ein einzelnes Intervall) */
export function spanAt(p, x) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) { const t = (x - a.x) / (b.x - a.x), z = a.y + (b.y - a.y) * t; lo = Math.min(lo, z); hi = Math.max(hi, z); }
  }
  return lo === Infinity ? null : [lo, hi];
}
const toShape = (p) => new THREE.Shape(p.map((v) => new THREE.Vector2(v.x, -v.y)));   // Shape-y = -Welt-z (nach rotateX(-90°) korrekt)
const flatGeo = (g) => g.rotateX(-Math.PI / 2);

/** Gelände mit Loch (Beckenöffnung) */
export function groundGeometry(contour, size = 1800, uvScale = 5) {
  const s = new THREE.Shape([new THREE.Vector2(-size / 2, -size / 2), new THREE.Vector2(size / 2, -size / 2), new THREE.Vector2(size / 2, size / 2), new THREE.Vector2(-size / 2, size / 2)]);
  s.holes.push(toShape(contour));
  const g = flatGeo(new THREE.ShapeGeometry(s));
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / uvScale, -pos.getZ(i) / uvScale);
  return g;
}

/** Flächenstück über der Beckenöffnung (für „Vorher“-Ansicht) */
export function patchGeometry(contour) {
  const g = flatGeo(new THREE.ShapeGeometry(toShape(contour)));
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  return g;
}

function ring(outer, inner, y0, h) {
  const s = toShape(outer); s.holes.push(toShape(inner));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}

/**
 * opts: { shape, length, width, depth, steps, coping, deck, cover }
 * mats: { liner, linerDark, water, copingStone|copingDark|copingWood, deck… } siehe main.js (createMaterials)
 * mode: 'scene' (mit Grube, Wasser mit Tiefe) | 'ar' (flach, ohne Grube – das Gelände kann nicht ausgehoben werden)
 */
const mortarMat = new THREE.MeshStandardMaterial({ color: 0x6d6a65, roughness: 1 });

/** UVs in Metern für Boxen und Halbzylinder (Fliesenmuster bleibt maßstäblich). cx != null: Halbzylinder um (cx, 0). */
function worldUV(g, cx = null) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    if (ny > 0.7) uv.setXY(i, x, z);
    else if (cx !== null) uv.setXY(i, Math.atan2(z, x - cx) * Math.hypot(z, x - cx), y);
    else if (nx > nz) uv.setXY(i, z, y); else uv.setXY(i, x, y);
  }
}

/**
 * Beckenrand aus einzelnen Natursteinplatten (~50 cm) mit Fugen, gefasten Kanten und überstehender Wasserkante.
 * inner = Beckenkontur, outer = um COPING_W versetzte Kontur (gleiche Punktanzahl). Zufällige Textur-Ausschnitte je Stein.
 */
function copingStones(inner, outer, y0 = -0.02, y1 = 0.05) {
  const N = inner.length, W = COPING_W, R = rng(23), GAP = 0.006, OV = 0.035, B = 0.012;
  const cum = [0]; for (let i = 0; i < N; i++) cum.push(cum[i] + inner[i].distanceTo(inner[(i + 1) % N]));
  const total = cum[N], pos = [], nor = [], uvs = [], cols = [], idx = [];
  const along = (s) => {                                   // Punkt und Querrichtung bei Bogenlänge s
    s = ((s % total) + total) % total; let i = 0; while (cum[i + 1] < s) i++;
    const t = (s - cum[i]) / (cum[i + 1] - cum[i]), a = inner[i], b = inner[(i + 1) % N], qa = outer[i], qb = outer[(i + 1) % N];
    const d = new THREE.Vector2().lerpVectors(qa.clone().sub(a), qb.clone().sub(b), t).divideScalar(W);
    return { p: new THREE.Vector2().lerpVectors(a, b, t), d };
  };
  // Profil quer zur Kante: (s, y) mit s = Abstand von der Beckenkante nach außen
  const prof = [[-OV, y0], [-OV, y1 - B], [-OV + B, y1], [W - B, y1], [W, y1 - B], [W, y0]];
  const sizeStep = 0.2;
  let s0 = 0;
  while (s0 < total - 0.05) {
    let len = 0.46 + R() * 0.2; if (total - (s0 + len) < 0.35) len = total - s0;          // Rest nicht als Splitter
    const a = s0 + GAP / 2, b = s0 + len - GAP / 2, n = Math.max(1, Math.ceil((b - a) / sizeStep));
    const col = 0.9 + R() * 0.14, warm = (R() - 0.5) * 0.05, ou = R() * 3, ov = R() * 3, swap = R() < 0.5;
    const pts = []; for (let j = 0; j <= n; j++) pts.push(along(a + ((b - a) * j) / n));
    for (let k = 0; k < prof.length; k++) {                // ein Streifen je Profilsegment, getrennte Eckpunkte → harte Kanten
      if (k === prof.length - 1) continue;
      const [sa, ya] = prof[k], [sb, yb] = prof[k + 1], base = pos.length / 3;
      for (let j = 0; j <= n; j++) {
        const { p, d } = pts[j], u = (a - s0) + ((b - a) * j) / n;
        for (const [sv, yv] of [[sa, ya], [sb, yb]]) {
          pos.push(p.x + d.x * sv, yv, p.y + d.y * sv); nor.push(0, 1, 0);
          const flat = k === 2 || k === 3, uu = u + ou, vv = (flat ? sv : yv) + ov;     // Oberseite: (längs, quer), Seiten: (längs, Höhe)
          if (swap) uvs.push(vv, uu); else uvs.push(uu, vv);
          cols.push(col * (1 + warm), col, col * (1 - warm));
        }
        if (j < n) { const q = base + j * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
    }
    s0 += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // Die Streifen sind je nach Umlaufrichtung nach innen gewickelt: Normalen nach außen/oben ausrichten
  const nn = g.attributes.normal; let up = 0; for (let i = 0; i < nn.count; i++) up += nn.getY(i);
  if (up < 0) { g.setIndex(idx.map((v, i) => (i % 3 === 1 ? idx[i + 1] : i % 3 === 2 ? idx[i - 1] : v))); g.computeVertexNormals(); }
  return g;
}

export function buildPool(opts, mats, mode = 'scene') {
  const { shape, length: L, width: W, depth: D, steps } = opts;
  const ar = mode === 'ar';
  const group = new THREE.Group(); group.name = 'pool';
  const disposables = [];
  const add = (geo, mat, name, { cast = false, receive = true, parent = group } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = cast; m.receiveShadow = receive; parent.add(m); disposables.push(geo); return m;
  };

  const contour = contourFor(shape, L, W);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of contour) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y); }

  // Tiefenprofil: flacher Bereich -> Gefälle -> tiefer Bereich (bei ≤ 1,4 m konstant)
  const shallow = D <= 1.4 ? D : 1.1;
  const depthAt = (x) => {
    if (D <= 1.4) return D;
    const u = (x - minX) / (maxX - minX);
    if (u < 0.32) return shallow;
    if (u > 0.72) return D;
    const t = (u - 0.32) / 0.4; return shallow + (D - shallow) * (t * t * (3 - 2 * t));
  };

  /* ---- Maße ---- */
  const pArea = Math.abs(area(contour));
  let volume = 0;
  { const nx = 120, dx = (maxX - minX) / nx; for (let i = 0; i < nx; i++) { const x = minX + (i + 0.5) * dx, sp = spanAt(contour, x); if (sp) volume += (sp[1] - sp[0]) * dx * Math.max(0, depthAt(x) + WATER_Y); } }
  const dims = { area: pArea, volume, length: maxX - minX, width: maxZ - minZ, depth: D };

  /* ---- Becken ---- */
  if (!ar) {
    // Wand
    const N = contour.length, pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), col = new Float32Array((N + 1) * 2 * 3), idx = [];
    let u = 0;
    for (let i = 0; i <= N; i++) {
      const p = contour[i % N], q = contour[(i - 1 + N) % N];
      if (i > 0) u += p.distanceTo(q);
      const d = depthAt(p.x);
      pos.set([p.x, 0, p.y, p.x, -d, p.y], i * 6);
      uv.set([u, 0, u, -d], i * 4);
      col.set([1, 1, 1, 1, 1, 1], i * 6);
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); wg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); wg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    wg.setIndex(idx); wg.computeVertexNormals();
    add(wg, mats.liner, 'beckenwand');

    // Boden: Gitter zwischen zmin(x) und zmax(x) der (leicht vergrößerten) Kontur
    const fc = offsetPoly(contour, 0.05), nx = Math.max(32, Math.ceil((maxX - minX) / 0.25)), nz = 10;
    const fpos = [], fuv = [], fcol = [], fidx = [];
    for (let i = 0; i <= nx; i++) {
      const x = minX + 0.0005 + (maxX - minX - 0.001) * (i / nx), sp = spanAt(fc, x) || [0, 0], d = depthAt(x), k = 1;
      for (let j = 0; j <= nz; j++) { const z = sp[0] + (sp[1] - sp[0]) * (j / nz); fpos.push(x, -d, z); fuv.push(x, z); fcol.push(k, k, k); }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + nz + 1; fidx.push(a, a + 1, b, b, a + 1, b + 1); }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fcol, 3));
    fg.setIndex(fidx); fg.computeVertexNormals();
    add(fg, mats.liner, 'beckenboden');

    // Treppe (am flachen Ende, x = minX)
    if (steps !== 'none') {
      const wall = minX, sd = depthAt(wall), n = Math.max(2, Math.min(4, Math.floor((sd - 0.15) / 0.3)));
      const stairs = new THREE.Group(); stairs.name = 'treppe'; group.add(stairs);
      for (let i = 0; i < n; i++) {
        const top = -0.3 * (i + 1), h = sd + top + 0.06;
        let g;
        if (steps === 'roman') {
          const r = Math.min(W / 2 - 0.08, 0.5 + 0.3 * i);
          g = new THREE.CylinderGeometry(r, r, h, 40, 1, false, 0, Math.PI); g.translate(wall + 0.0, top - h / 2, 0);
        } else {
          const lenX = 0.3 * (i + 1) + 0.25, z0 = steps === 'full' ? minZ - 0.25 : maxZ - 1.2, z1 = maxZ + 0.25;
          g = new THREE.BoxGeometry(lenX, h, z1 - z0); g.translate(wall - 0.25 + lenX / 2, top - h / 2, (z0 + z1) / 2);
        }
        worldUV(g, steps === 'roman' ? wall : null);
        add(g, mats.liner, `stufe${i}`, { parent: stairs });
      }
    }

    // Skimmer (+z-Wand) und Einströmdüsen (-z-Wand)
    const sk = new THREE.Group(); sk.name = 'technik'; group.add(sk);
    const trim = new THREE.MeshStandardMaterial({ color: 0xf2f4f5, roughness: 0.5 });
    const sx = minX + (maxX - minX) * 0.7, sp = spanAt(contour, sx);
    if (sp) {                                           // Skimmer: Deckel liegt bündig im Beckenrand, Öffnung in der Wand knapp unter der Wasserlinie
      const lid = add(new RoundedBoxGeometry(0.36, 0.012, 0.22, 2, 0.005), trim, 'skimmer', { parent: sk, cast: false });
      lid.position.set(sx, 0.054, sp[1] + COPING_W * 0.5); disposables.push(trim);
      const mouth = add(new THREE.BoxGeometry(0.34, 0.09, 0.03), trim, 'skimmer-klappe', { parent: sk, cast: false }); mouth.position.set(sx, WATER_Y + 0.02, sp[1] - 0.012);
    }
    for (const f of [0.3, 0.7]) {
      const x = minX + (maxX - minX) * f, s2 = spanAt(contour, x);
      if (s2) { const m = add(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20), mats.steel, 'duese', { parent: sk }); m.rotation.x = Math.PI / 2; m.position.set(x, -0.65, s2[0] + 0.01); }
    }
    // LED-Scheinwerfer
    const lightN = L > 9 ? 4 : 2, lamps = [];
    for (let k = 0; k < lightN; k++) {
      const x = minX + (maxX - minX) * ((k + 0.5) / lightN), s2 = spanAt(contour, x); if (!s2) continue;
      const side = k % 2 ? 1 : -1, z = side > 0 ? s2[1] - 0.012 : s2[0] + 0.012;
      const ringM = add(new THREE.RingGeometry(0.098, 0.125, 28), mats.steel, 'led-ring', { parent: sk, receive: false });
      ringM.position.set(x, -Math.min(0.75, depthAt(x) - 0.2), z + (side > 0 ? -0.003 : 0.003)); ringM.rotation.y = side > 0 ? Math.PI : 0;
      const m = add(new THREE.CircleGeometry(0.1, 24), mats.lamp, 'led', { parent: sk, receive: false });
      m.position.set(x, -Math.min(0.75, depthAt(x) - 0.2), z); m.rotation.y = side > 0 ? Math.PI : 0;
      lamps.push({ x, z: z - side * 0.35, y: m.position.y });
    }
    group.userData.lamps = lamps;

    // Wasser
    const wg2 = flatGeo(new THREE.ShapeGeometry(toShape(contour))); wg2.translate(0, WATER_Y, 0);
    const water = add(wg2, mats.water, 'wasser', { receive: false }); water.renderOrder = 2;
  } else {
    // AR: flache, deckende Wasserfläche auf Geländehöhe
    const wg = flatGeo(new THREE.ShapeGeometry(toShape(contour))); wg.translate(0, 0.004, 0);
    add(wg, mats.waterAR, 'wasser', { receive: false });
  }

  /* ---- Beckenrand + Terrasse ---- */
  const copeOut = offsetPoly(contour, COPING_W);
  add(ring(copeOut, contour, -0.02, 0.05), mortarMat, 'rand-bett', { cast: false });                  // Mörtelbett unter den Steinen (Fugen)
  add(copingStones(contour, copeOut), mats.coping, 'rand', { cast: true });
  if (opts.deck !== 'gras') {
    const dw = DECK_W, ob = roundedRect((maxX - minX) / 2 + COPING_W + dw, (maxZ - minZ) / 2 + COPING_W + dw, 0.6);
    add(ring(ob, copeOut, -0.02, 0.055), mats.deck, 'terrasse');
  }

  /* ---- Abdeckungen (umschaltbar) ---- */
  const covers = { none: new THREE.Group(), roll: new THREE.Group(), roof: new THREE.Group() };
  const rollSlat = new THREE.ShapeGeometry(toShape(contour)); flatGeo(rollSlat);
  { const uv = rollSlat.attributes.uv, p = rollSlat.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, p.getZ(i) / 2); }
  rollSlat.translate(0, ar ? 0.012 : -0.045, 0);
  add(rollSlat, mats.slats, 'rollladen', { cast: false, parent: covers.roll });
  { const box = new THREE.BoxGeometry(0.4, 0.28, (maxZ - minZ) + 0.2); box.translate(maxX + COPING_W + 0.3, 0.17, (minZ + maxZ) / 2);
    add(box, mats.rollBox, 'rollkasten', { cast: true, parent: covers.roll }); }
  {
    const ln = (maxX - minX) + 1.6, hw = (maxZ - minZ) / 2 + COPING_W + 0.45, H = Math.min(2.2, Math.max(1.2, W * 0.4 + 0.6)), cz = (minZ + maxZ) / 2;
    const shell = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true, 0, Math.PI); shell.rotateZ(Math.PI / 2); shell.scale(ln, H, hw); shell.translate(0, 0.03, cz);
    add(shell, mats.glass, 'dach', { cast: false, receive: false, parent: covers.roof }).renderOrder = 3;
    const nr = Math.max(3, Math.round(ln / 1.3) + 1);
    for (let k = 0; k < nr; k++) {
      const rib = new THREE.TorusGeometry(1, 0.022, 6, 40, Math.PI); rib.rotateY(Math.PI / 2); rib.scale(1, H, hw);
      rib.translate(-ln / 2 + (ln * k) / (nr - 1), 0.03, cz);
      add(rib, mats.alu, 'bogen', { cast: true, parent: covers.roof });
    }
    for (const sz of [-1, 1]) { const rail = new THREE.CylinderGeometry(0.03, 0.03, ln, 8); rail.rotateZ(Math.PI / 2); rail.translate(0, 0.05, cz + sz * hw); add(rail, mats.alu, 'schiene', { cast: true, parent: covers.roof }); }
    const rt = new THREE.CylinderGeometry(0.02, 0.02, ln, 6); rt.rotateZ(Math.PI / 2); rt.translate(0, H + 0.03, cz); add(rt, mats.alu, 'first', { parent: covers.roof });
  }
  for (const k of Object.keys(covers)) { covers[k].name = 'abdeckung-' + k; group.add(covers[k]); }
  const setCover = (c) => { for (const k of Object.keys(covers)) covers[k].visible = k === c; };
  setCover(opts.cover || 'none');

  return {
    group, dims, contour, depthAt, setCover, bounds: { minX, maxX, minZ, maxZ },
    dispose() { for (const g of disposables) g.dispose(); },
  };
}
