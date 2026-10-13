// Rasenhalme rund um die Terrasse: instanziierte Büschel (4 Halme je Büschel), ruhig (kein Wind), mit Verlauf von dunkel (Wurzel) nach hell (Spitze).
// Dichte nimmt nach außen ab; der Boden darunter (Fototextur) trägt den Rest. Wird mit der Terrassengröße neu verteilt (wenige Millisekunden).
import * as THREE from 'three';
import { rng } from './textures.js';

let geo = null;
function tuftGeometry() {
  if (geo) return geo;
  const R = rng(99), pos = [], col = [], nor = [], idx = [], blades = 4, seg = 3;
  for (let b = 0; b < blades; b++) {
    const a = R() * Math.PI * 2, ox = (R() - 0.5) * 0.05, oz = (R() - 0.5) * 0.05, h = 0.8 + R() * 0.45, bend = 0.25 + R() * 0.4, w = 0.0062 + R() * 0.002, base = pos.length / 3;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, y = t * h * 0.062, out = bend * t * t * 0.035, ww = w * (1 - t * 0.9);
      for (const side of [-1, 1]) {                                  // zwei Ränder des Halms, Breite quer zur Biegerichtung
        pos.push(ox + ca * out - sa * ww * side, y, oz + sa * out + ca * ww * side); nor.push(0, 1, 0);
        const k = 0.2 + 0.8 * t; col.push(0.07 + 0.3 * k, 0.12 + 0.42 * k, 0.04 + 0.12 * k);
      }
    }
    for (let i = 0; i < seg; i++) { const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  return geo;
}
let mat = null;

/** deck: Halbmaße der Terrasse (hx, hz); Büschel nur außerhalb, bis `reach` Meter nach außen */
export function buildLawn({ hx, hz }, { count = 14000, reach = 6.5, seed = 3 } = {}) {
  mat = mat || new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const g = tuftGeometry(), mesh = new THREE.InstancedMesh(g, mat, count), R = rng(seed), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  let n = 0;
  for (let tries = 0; tries < count * 3 && n < count; tries++) {
    const x = (R() * 2 - 1) * (hx + reach), z = (R() * 2 - 1) * (hz + reach);
    // Abstand zum Terrassenrechteck (außerhalb), Dichte fällt quadratisch ab
    const dx = Math.max(Math.abs(x) - hx, 0), dz = Math.max(Math.abs(z) - hz, 0), d = Math.hypot(dx, dz);
    if (d < 0.08 || d > reach) continue; if (R() > (1 - d / reach) ** 1.9) continue;
    e.set(0, R() * 6.28, 0); q.setFromEuler(e); const sc = 0.8 + R() * 0.9; s.set(sc, sc * (0.7 + R() * 0.8), sc);
    m.compose(v.set(x, -0.005, z), q, s); mesh.setMatrixAt(n, m);
    const k = 0.8 + R() * 0.4; mesh.setColorAt(n, c.setRGB(k * (0.9 + R() * 0.15), k, k * (0.85 + R() * 0.2))); n++;
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'rasenhalme';
  return mesh;
}
