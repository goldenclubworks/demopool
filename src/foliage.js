// Prozedurales Laub: viele kleine Blatt-Karten (instanziert), Normalen zeigen von der Mitte nach außen → weiche, volle Kronen und Hecken.
import * as THREE from 'three';
import { leafCard, rng } from './textures.js';

const Z = new THREE.Vector3(0, 0, 1);

/** Material für Blatt-Karten: Alpha-Test mit Alpha-to-Coverage, Normalen aus Instanz-Richtung `aDir`, leichter Wind. */
export function leafMaterial(map, { wind = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, color: 0xd9e6d0 });
  m.userData.wind = { value: wind }; m.userData.time = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = m.userData.wind; sh.uniforms.uTime = m.userData.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aDir; uniform float uWind, uTime;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(transpose(mat3(instanceMatrix)) * aDir);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = instanceMatrix[3].xyz;
        float ph = uTime * 1.6 + ip.x * 0.7 + ip.z * 0.5;
        transformed.x += sin(ph) * 0.35 * uWind; transformed.y += cos(ph * 1.3) * 0.2 * uWind;`);
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
  mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.frustumCulled = false;
  return mesh;
}

/** Hecke als Quader: dunkler Kern + Blatt-Karten auf den Außenflächen. Quader mittig bei `c`, Maße (len × h × thick), um y gedreht. */
export function hedge({ len, h, thick, center, rotY = 0 }, mat, core, density, seed) {
  const g = new THREE.Group(), half = new THREE.Vector3(len / 2, h / 2, thick / 2);
  const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(len - 0.15, h - 0.02, thick - 0.15), core); coreMesh.position.y = (h - 0.02) / 2; g.add(coreMesh);
  const areas = [len * h, len * h, thick * h, thick * h, len * thick], total = areas.reduce((a, b) => a + b, 0);
  const count = Math.round(total * density);
  const cloud = leafCloud(count, (i, R) => {
    let r = R() * total, f = 0; while (r > areas[f]) { r -= areas[f]; f++; }
    const u = R() * 2 - 1, w = R() * 2 - 1, out = new THREE.Vector3(), pos = new THREE.Vector3();
    if (f < 2) { const s = f ? 1 : -1; pos.set(u * half.x, (w * 0.5 + 0.5) * h, s * half.z); out.set(0, 0.15, s); }
    else if (f < 4) { const s = f === 3 ? 1 : -1; pos.set(s * half.x, (w * 0.5 + 0.5) * h, u * half.z); out.set(s, 0.15, 0); }
    else { pos.set(u * half.x, h, w * half.z); out.set(0, 1, 0); }
    pos.addScaledVector(out, R() * 0.1);
    return { pos, out: out.normalize(), size: 0.34 };
  }, mat, { seed, tint: [0.7, 1.15] });
  g.add(cloud); g.position.copy(center); g.rotation.y = rotY;
  return g;
}

/** Laubbaum: Stamm mit Rinde, Äste, Krone aus mehreren Blatt-Wolken. */
export function tree({ height = 5, spread = 2.4, seed = 1, mats, density = 1 }) {
  const R = rng(seed), g = new THREE.Group(), trunkH = height * 0.42;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * height / 5, 0.2 * height / 5, trunkH + 0.4, 10, 4), mats.bark); trunk.position.y = (trunkH + 0.4) / 2 - 0.05; trunk.castShadow = true; g.add(trunk);
  const lobes = 5 + Math.floor(R() * 3), cards = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + R(), d = i === 0 ? 0 : spread * (0.35 + R() * 0.3), r = spread * (0.5 + R() * 0.25);
    const c = new THREE.Vector3(Math.cos(a) * d, trunkH + height * (0.3 + R() * 0.3) + (i === 0 ? height * 0.12 : 0), Math.sin(a) * d);
    cards.push({ c, r });
    if (i) {                                                                                  // Ast vom Stamm zur Kronenmitte
      const S = new THREE.Vector3(0, trunkH * 0.7, 0), dv = c.clone().sub(S), br = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * height / 5, 0.07 * height / 5, dv.length(), 6), mats.bark);
      br.position.copy(S).addScaledVector(dv, 0.5); br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize()); br.castShadow = true; g.add(br);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.9, 1), mats.core); core.position.copy(c); core.scale.y = 0.85; core.castShadow = true; g.add(core);
  }
  const per = Math.round(1900 * density), total = per * lobes;
  const cloud = leafCloud(total, (i) => {
    const L = cards[i % lobes], o = new THREE.Vector3(R() - 0.5, (R() - 0.5) * 0.8, R() - 0.5).normalize();
    return { pos: L.c.clone().addScaledVector(o, L.r * (0.88 + R() * 0.22)).setY(L.c.y + o.y * L.r * 0.82 + (L.c.y - L.c.y)), out: o.clone().setY(o.y * 0.8 + 0.2).normalize(), size: 0.72 };
  }, mats.leaf, { seed: seed + 9, cast: true, tint: [0.62, 1.22] });
  g.add(cloud);
  return g;
}
