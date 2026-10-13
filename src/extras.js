// Zubehör um das Becken: Liegen, Schirm, Leiter, Gegenstrom, Wasserfall, Wärmepumpe, Pflanzkübel.
// Alles prozedural; im AR-Modus nur Teile, die auf ebenem Boden stehen (Liegen, Schirm, Kübel).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { spanAt, COPING_W, DECK_W } from './pool.js';
import { flowTexture } from './textures.js';

let shared = null;
function sharedMats() {
  if (shared) return shared;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });
  const flow = flowTexture(); flow.repeat.set(1, 1);
  const flowV = flowTexture(); flowV.repeat.set(1, 1);
  shared = {
    flow, flowV,
    steel: std({ color: 0xdfe3e6, roughness: 0.25, metalness: 0.95 }),
    towel: std({ color: 0x2a7fb8, roughness: 1 }), towel2: std({ color: 0xf4f4f0, roughness: 1 }),
    canvas: std({ color: 0xf1e8d6, roughness: 0.95, side: THREE.DoubleSide }), pole: std({ color: 0x9aa2a8, roughness: 0.4, metalness: 0.7 }),
    pot: std({ color: 0x3b3f43, roughness: 0.6 }), soil: std({ color: 0x3b2c20, roughness: 1 }),
    leaf: [std({ color: 0x3f7a35, roughness: 0.9 }), std({ color: 0x5b9a40, roughness: 0.9 }), std({ color: 0x2f6a3a, roughness: 0.9 })],
    grey: std({ color: 0xcfd4d8, roughness: 0.5, metalness: 0.2 }), dark: std({ color: 0x23282c, roughness: 0.5 }),
    jet: new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: flow, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    fall: new THREE.MeshBasicMaterial({ color: 0xeaf6ff, alphaMap: flowV, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  };
  return shared;
}

/** state: Konfiguration, pool: Rückgabe von buildPool, mats: Szenen-Materialien, mode 'scene' | 'ar' */
export function buildExtras(state, pool, mats, mode = 'scene') {
  const M = sharedMats(), ar = mode === 'ar', x = state.extras;
  const group = new THREE.Group(); group.name = 'zubehoer';
  const disposables = [];
  const put = (geo, mat, { parent = group, cast = true, receive = true, pos, rot } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); disposables.push(geo); return m;
  };
  const { minX, maxX, minZ, maxZ } = pool.bounds, L = maxX - minX, topY = state.deck === 'gras' ? 0 : 0.055;
  const at = (f) => minX + L * f;
  const zTop = (xx) => (spanAt(pool.contour, xx) || [minZ, maxZ])[1];
  const zBot = (xx) => (spanAt(pool.contour, xx) || [minZ, maxZ])[0];
  const hx = L / 2 + COPING_W + DECK_W, hz = (maxZ - minZ) / 2 + COPING_W + DECK_W;
  const anim = [];

  /* Liegen (Rückseite zum Pool, Kopfteil nach außen) */
  const lf = x.loungers >= 4 ? [0.2, 0.4, 0.6, 0.8] : x.loungers >= 2 ? [0.3, 0.7] : x.loungers === 1 ? [0.5] : [];
  lf.forEach((f, i) => {
    const xx = at(f), z = zTop(xx) + COPING_W + 1.3, one = new THREE.Group();
    const frame = new RoundedBoxGeometry(0.62, 0.05, 1.95, 2, 0.02); frame.translate(0, 0.34, 0);
    put(frame, mats.loungerFrame, { parent: one });
    for (const lx of [-0.27, 0.27]) for (const lz of [-0.9, 0.9]) put(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8), mats.loungerFrame, { parent: one, pos: [lx, 0.17, lz] });
    put(new RoundedBoxGeometry(0.58, 0.08, 1.15, 3, 0.035), mats.loungerCushion, { parent: one, pos: [0, 0.41, -0.41] });
    put(new RoundedBoxGeometry(0.58, 0.08, 0.78, 3, 0.035), mats.loungerCushion, { parent: one, pos: [0, 0.715, 0.39], rot: [-0.9, 0, 0] });
    put(new THREE.BoxGeometry(0.5, 0.012, 0.9), i % 2 ? M.towel2 : M.towel, { parent: one, pos: [0, 0.455, -0.41], cast: false });
    one.position.set(xx, topY, z); one.rotation.y = 0; group.add(one);
  });

  /* Sonnenschirm */
  if (x.parasol) {
    const xx = at(0.5), z = zTop(xx) + COPING_W + 1.35, g = new THREE.Group();
    put(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 20), M.pole, { parent: g, pos: [0, 0.04, 0] });
    put(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 8), M.pole, { parent: g, pos: [0, 1.25, 0] });
    put(new THREE.ConeGeometry(1.3, 0.45, 24, 1, true), M.canvas, { parent: g, pos: [0, 2.4, 0] });
    put(new THREE.SphereGeometry(0.05, 8, 6), M.pole, { parent: g, pos: [0, 2.67, 0], cast: false });
    g.position.set(xx, topY, z); group.add(g);
  }

  /* Pflanzkübel in den Terrassenecken */
  if (x.planters) {
    const corners = [[hx - 0.6, hz - 0.6], [-hx + 0.6, hz - 0.6], [hx - 0.6, -hz + 0.6], [-hx + 0.6, -hz + 0.6]];
    corners.forEach(([cx, cz], i) => {
      const g = new THREE.Group();
      put(new THREE.CylinderGeometry(0.3, 0.22, 0.55, 18), M.pot, { parent: g, pos: [0, 0.275, 0] });
      put(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 18), M.soil, { parent: g, pos: [0, 0.55, 0], cast: false });
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + i, r = 0.12 * (k % 3), s = 0.22 + 0.06 * ((k + i) % 3);
        const leaf = put(new THREE.IcosahedronGeometry(s, 1), M.leaf[(k + i) % 3], { parent: g, pos: [Math.cos(a) * r, 0.78 + 0.1 * k, Math.sin(a) * r] });
        leaf.scale.y = 0.85 + 0.25 * (k % 2);
      }
      g.position.set(cx, topY, cz); group.add(g);
    });
  }

  if (!ar) {
    /* Edelstahl-Leiter an der +z-Seite */
    if (x.ladder) {
      const xx = at(0.5) + 0.0, zw = zTop(xx) - 0.04, d = Math.min(1.1, pool.depthAt(xx) - 0.25);
      for (const sx of [-0.25, 0.25]) {
        const curve = new THREE.CatmullRomCurve3([[-d, 0.0], [0.85, 0.0], [0.98, 0.1], [1.0, 0.3], [0.9, 0.5], [0.0, 0.5]].map(([y, dz]) => new THREE.Vector3(xx + sx, y, zw + dz)), false, 'catmullrom', 0.2);
        put(new THREE.TubeGeometry(curve, 40, 0.022, 8, false), M.steel, { pos: [0, 0, 0] });
      }
      for (const y of [-0.3, -0.62, -0.94]) if (-y < d + 0.05) put(new THREE.BoxGeometry(0.5, 0.025, 0.12), M.steel, { pos: [xx, y, zw + 0.05], cast: false });
    }
    /* Gegenstromanlage an der Stirnwand (x = max) */
    if (x.jet) {
      const xx = maxX - 0.5, sp = spanAt(pool.contour, xx) || [-0.5, 0.5], zc = (sp[0] + sp[1]) / 2;
      const wx = (() => { let w = xx; for (let i = 0; i < 40 && spanAt(pool.contour, w + 0.03); i++) w += 0.03; return w; })();
      put(new THREE.BoxGeometry(0.04, 0.5, 0.7), M.steel, { pos: [wx - 0.02, -0.62, zc], cast: false });
      put(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 20), M.dark, { pos: [wx - 0.05, -0.62, zc], rot: [0, 0, Math.PI / 2], cast: false });
      const plane = new THREE.PlaneGeometry(2.6, 0.55); plane.rotateX(-Math.PI / 2); plane.translate(-1.3, 0, 0);
      const m = put(plane, M.jet, { pos: [wx - 0.1, -0.5, zc], cast: false, receive: false }); m.renderOrder = 3;
      anim.push((t) => { M.flow.offset.x = -t * 0.9; });
    }
    /* Wasserfall an der -z-Seite */
    if (x.waterfall) {
      const xx = at(0.5), z0 = zBot(xx) - COPING_W - 0.18;
      put(new THREE.BoxGeometry(1.1, 0.7, 0.28), M.steel, { pos: [xx, topY + 0.35, z0] });
      put(new THREE.BoxGeometry(1.3, 0.06, 0.4), M.steel, { pos: [xx, topY + 0.03, z0 + 0.04] });
      const h = topY + 0.45 + 0.12, plane = new THREE.PlaneGeometry(0.8, h); plane.translate(0, -h / 2, 0);
      const m = put(plane, M.fall, { pos: [xx, topY + 0.45, z0 + COPING_W * 0.9 + 0.15], cast: false, receive: false }); m.renderOrder = 3;
      anim.push((t) => { M.flowV.offset.x = -t * 0.7; });
    }
    /* Wärmepumpe an der Hauswand (hinten rechts) */
    if (x.heatpump) {
      const g = new THREE.Group();
      put(new RoundedBoxGeometry(1.0, 0.75, 0.4, 3, 0.03), M.grey, { parent: g, pos: [0, 0.4, 0] });
      put(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 24), M.dark, { parent: g, pos: [0, 0.42, 0.205], rot: [Math.PI / 2, 0, 0], cast: false });
      put(new THREE.TorusGeometry(0.26, 0.015, 6, 28), M.pole, { parent: g, pos: [0, 0.42, 0.21], cast: false });
      for (const lx of [-0.4, 0.4]) put(new THREE.BoxGeometry(0.06, 0.05, 0.35), M.dark, { parent: g, pos: [lx, 0.02, 0] });
      g.position.set(hx - 2, topY, -hz + 0.45); group.add(g);
    }
  }

  return {
    group,
    update(t) { for (const f of anim) f(t); },
    dispose() { for (const g of disposables) g.dispose(); },
  };
}
