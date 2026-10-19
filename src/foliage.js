// Prozedurales Laub: viele kleine Blatt-Karten (instanziert), Normalen zeigen von der Mitte nach außen → weiche, volle Kronen und Hecken.
import * as THREE from 'three';
import { leafCard, rng } from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Z = new THREE.Vector3(0, 0, 1);

/** Material für Blatt-Karten: Alpha-Test mit harten Kanten (SMAA glättet), Normalen aus Instanz-Richtung `aDir` (weiche, volle Kronen). Bewusst ohne Wind: ruhiges Bild, weniger Last. */
export function leafMaterial(map) {
  const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, color: 0xd9e6d0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aDir;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(transpose(mat3(instanceMatrix)) * aDir);');
    // beide Kartenseiten gleich beleuchten
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'));
  };
  return m;
}

/**
 * Karten-Wolke: `count` Karten, Positionen aus `place(i, rand)` → { pos, out, size }.
 * out = Richtung nach außen (Einheitsvektor): Kartenfläche schaut ungefähr dorthin, die Beleuchtung nutzt sie als Normale.
 */
export function leafCloud(count, place, mat, { seed = 1, tint = [0.78, 1.18], cast = false, receive = true } = {}) {
  const R = rng(seed), geo = new THREE.PlaneGeometry(1, 1);
  const dirs = new Float32Array(count * 3);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3(), col = new THREE.Color(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const { pos, out, size } = place(i, R);
    v.copy(out).addScaledVector(new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5), 1.1).normalize();      // Kartenrichtung: grob nach außen, gestreut
    q.setFromUnitVectors(Z, v); q2.setFromAxisAngle(Z, R() * Math.PI * 2); q.multiply(q2);
    m.compose(pos, q, s.setScalar(size * (0.8 + R() * 0.45))); mesh.setMatrixAt(i, m);
    dirs.set([out.x, out.y, out.z], i * 3);
    const k = tint[0] + R() * (tint[1] - tint[0]); mesh.setColorAt(i, col.setRGB(k * (0.96 + R() * 0.08), k, k * (0.9 + R() * 0.08)));
  }
  geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(dirs, 3));
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.computeBoundingSphere();      // Sichtbarkeitsprüfung: Hecken und Kronen hinter der Kamera kosten nichts
  return mesh;
}

/** Hecke als Quader: dunkler Kern + Blatt-Karten auf den Außenflächen. Quader mittig bei `c`, Maße (len × h × thick), um y gedreht. */
export function hedge({ len, h, thick, center, rotY = 0, size = 0.34 }, mat, core, density, seed) {
  const g = new THREE.Group(), half = new THREE.Vector3(len / 2, h / 2, thick / 2);
  const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(len - 0.15, h - 0.02, thick - 0.15), core); coreMesh.position.y = (h - 0.02) / 2; g.add(coreMesh);
  // Die Kamera bleibt im Grundstück: sichtbar sind nur die Innenseite (zum Garten) und die Oberseite. Außenseite und Enden bekommen keine Karten (unsichtbar, kosteten aber Rechenzeit).
  const dirW = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)), inner = dirW.dot(center.clone().setY(0).negate()) >= 0 ? 1 : 0;      // welche lange Seite zeigt zur Mitte? (lokal +z bzw. -z)
  const areas = [inner ? 0 : len * h, inner ? len * h : 0, 0, 0, len * thick], total = areas.reduce((a, b) => a + b, 0);
  const count = Math.round(total * density);
  const cloud = leafCloud(count, (i, R) => {
    let r = R() * total, f = 0; while (r > areas[f]) { r -= areas[f]; f++; }
    const u = R() * 2 - 1, w = R() * 2 - 1, out = new THREE.Vector3(), pos = new THREE.Vector3();
    if (f < 2) { const s = f ? 1 : -1; pos.set(u * half.x, (w * 0.5 + 0.5) * h, s * half.z); out.set(0, 0.15, s); }
    else if (f < 4) { const s = f === 3 ? 1 : -1; pos.set(s * half.x, (w * 0.5 + 0.5) * h, u * half.z); out.set(s, 0.15, 0); }
    else { pos.set(u * half.x, h, w * half.z); out.set(0, 1, 0); }
    pos.addScaledVector(out, R() * 0.1);
    return { pos, out: out.normalize(), size };
  }, mat, { seed, tint: [0.7, 1.15] });
  g.add(cloud); g.position.copy(center); g.rotation.y = rotY;
  return g;
}

/**
 * Laubbaum, prozedural gewachsen: Stamm → 3–4 Hauptäste → Zweige (bis Ebene 4), Äste verjüngen sich (Rohrmodell), leicht
 * gebogen, nach oben strebend und auf eine Kronen-Hüllform begrenzt. Laub sitzt in Büscheln an den äußeren Zweigen
 * (keine Kugeln): unregelmäßige Silhouette mit Lücken, in der Krone innen und unten dunkler (Verdeckung), gesprenkelte Schatten.
 * Alle Äste sind EIN Mesh, alles Laub EIN instanziertes Mesh → 2 Zeichenaufrufe je Baum.
 */
export function tree({ height = 5, spread = 2.4, seed = 1, mats, density = 1, size = 0.72 }) {
  const R = rng(seed), g = new THREE.Group();
  const trunkH = height * (0.3 + R() * 0.08), crownH = height - trunkH * 0.85;
  const C = new THREE.Vector3(0, trunkH + crownH * 0.48, 0), rad = new THREE.Vector3(spread, crownH * 0.56, spread * (0.85 + R() * 0.25));
  const inside = (p) => ((p.x - C.x) / rad.x) ** 2 + ((p.y - C.y) / rad.y) ** 2 + ((p.z - C.z) / rad.z) ** 2;
  const segs = [], leafSegs = [], up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  const r0 = 0.06 + height * 0.022;

  // Wachstum: jedes Stück aus 3 Teilstücken mit kleinem Knick; am Ende Verzweigung
  function grow(start, dir, len, r, level) {
    let p = start.clone(), d = dir.clone();
    const n = level === 0 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      d.add(tmp.set(R() - 0.5, (R() - 0.35) * 0.6, R() - 0.5).multiplyScalar(level === 0 ? 0.12 : 0.32)).normalize();
      if (level >= 2) d.y -= 0.04 * level;                                  // äußere Zweige hängen leicht
      d.normalize();
      let q = p.clone().addScaledVector(d, len / n);
      if (level > 0 && inside(q) > 1) { const k = 0.55; q = p.clone().addScaledVector(d, (len / n) * k); }        // an der Kronen-Hülle kürzer
      const r1 = r * (1 - (0.28 / n) * (i + 1));
      segs.push({ a: p.clone(), b: q.clone(), ra: r * (1 - (0.28 / n) * i), rb: r1 });
      if (level >= 2) leafSegs.push({ a: p.clone(), b: q.clone(), level });
      p = q;
    }
    if (level >= 4 || r < 0.012) { leafSegs.push({ a: p.clone().addScaledVector(d, -0.05), b: p.clone(), level: 5 }); return; }
    const kids = level === 0 ? 3 + (R() < 0.5 ? 1 : 0) : 2 + (R() < 0.45 ? 1 : 0);
    const perp = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0)).normalize();
    const phase = R() * Math.PI * 2;
    for (let k = 0; k < kids; k++) {
      const axis = perp.clone().applyAxisAngle(d, phase + (k / kids) * Math.PI * 2 + (R() - 0.5) * 0.6);
      const ang = level === 0 ? 0.62 + R() * 0.3 : 0.42 + R() * 0.38;
      const cd = d.clone().applyAxisAngle(axis, ang); cd.y += level === 0 ? 0.25 : 0.12; cd.normalize();
      const cl = len * (level === 0 ? (crownH * 0.55) / len : 0.66 + R() * 0.14);
      grow(p, cd, cl, r * Math.pow(1 / kids, 0.42) * (0.92 + R() * 0.1), level + 1);
    }
  }
  grow(new THREE.Vector3(0, -0.15, 0), new THREE.Vector3((R() - 0.5) * 0.12, 1, (R() - 0.5) * 0.12).normalize(), trunkH + 0.15, r0, 0);

  /* Äste: Kegelstümpfe zu einem Mesh verschmolzen; UVs in Metern (Rindentextur gleich groß an dünnen und dicken Ästen) */
  const geos = [], Y = new THREE.Vector3(0, 1, 0);
  for (const sg of segs) {
    const v = sg.b.clone().sub(sg.a), l = v.length() + sg.ra * 0.6, radial = sg.ra > 0.08 ? 10 : sg.ra > 0.03 ? 7 : 5;
    const c = new THREE.CylinderGeometry(sg.rb, sg.ra, l, radial, 1, sg.rb < 0.03);
    const uv = c.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * sg.ra, uv.getY(i) * l);
    c.translate(0, l / 2 - sg.ra * 0.6, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, v.normalize())); c.translate(sg.a.x, sg.a.y, sg.a.z);
    geos.push(c.index ? c.toNonIndexed() : c);
  }
  const wood = new THREE.Mesh(mergeGeometries(geos), mats.bark);              // Zylinder-Normalen bleiben weich (applyQuaternion dreht sie mit)
  geos.forEach((x) => x.dispose());
  wood.castShadow = true; wood.receiveShadow = true; g.add(wood);

  /* Laub: Büschel entlang der äußeren Zweige; Kartenrichtung grob von der Kronenmitte nach außen */
  let total = 0; for (const ls of leafSegs) total += ls.level >= 5 ? 1 : ls.b.distanceTo(ls.a);
  const want = Math.round(6200 * density * (spread * crownH) / 12), count = Math.max(200, want);
  const dirs = new Float32Array(count * 3), geo = new THREE.PlaneGeometry(1, 1), mesh = new THREE.InstancedMesh(geo, mats.leaf, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color(), out = new THREE.Vector3(), pos = new THREE.Vector3();
  // gewichtete Auswahl der Zweige nach Länge (Spitzen extra)
  // Laub in Wolken um die Zweigspitzen (Ebene 5) und an den äußeren Zweigen (Ebene 4): dazwischen bleiben Lücken mit Himmel und Astwerk
  const cum = []; let acc = 0; for (const ls of leafSegs) { acc += ls.level >= 5 ? 2.2 : ls.level === 4 ? ls.b.distanceTo(ls.a) * 0.5 : ls.level === 3 ? ls.b.distanceTo(ls.a) * 0.08 : 0; cum.push(acc); }
  for (let i = 0; i < count; i++) {
    const t = R() * acc; let j = 0; while (cum[j] < t) j++;
    const ls = leafSegs[j], tip = ls.level >= 5, f = tip ? 1 : 0.45 + R() * 0.55;
    tmp.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); if (tmp.lengthSq() > 1) tmp.normalize();
    const cr = tip ? 0.55 + (j % 5) * 0.08 : 0.3;                                       // Wolkengröße je Spitze etwas verschieden
    pos.copy(ls.a).lerp(ls.b, f).addScaledVector(tmp, cr * Math.cbrt(R()));            // kugelige Laubwolke um die Spitze
    const clumpUp = THREE.MathUtils.clamp(tmp.y * 0.5 + 0.5, 0, 1);                      // Lage in der Wolke: oben (Himmelslicht) hell, unten dunkel
    out.copy(pos).sub(C); out.x /= rad.x; out.y /= rad.y; out.z /= rad.z;
    const depth = Math.min(1.2, out.length());                                   // 0 = Kronenmitte, 1 = Hülle
    out.normalize(); out.y = out.y * 0.85 + 0.25; out.normalize();
    const v = out.clone().addScaledVector(tmp.set(R() - 0.5, R() - 0.5, R() - 0.5), 1.2).normalize();
    q.setFromUnitVectors(Z, v); q2.setFromAxisAngle(Z, R() * Math.PI * 2); q.multiply(q2);
    m.compose(pos, q, s.setScalar(size * (0.42 + R() * 0.4))); mesh.setMatrixAt(i, m);
    dirs.set([out.x, out.y, out.z], i * 3);
    // Verdeckung: innen und unten dunkler, außen oben hell; dazu leichte Farbstreuung je Büschel
    const hgt = THREE.MathUtils.clamp((pos.y - (C.y - rad.y)) / (2 * rad.y), 0, 1);
    const k = (0.5 + 0.7 * THREE.MathUtils.smoothstep(depth, 0.3, 1.0)) * (0.8 + 0.3 * hgt) * (0.62 + 0.55 * clumpUp) * (0.88 + R() * 0.24);
    mesh.setColorAt(i, col.setRGB(k * (0.98 + R() * 0.16), k * 1.04, k * (0.78 + R() * 0.12)));     // etwas gelblicher: frisches Laub statt Moosgrün
  }
  geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(dirs, 3));
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); g.add(mesh);
  return g;
}
