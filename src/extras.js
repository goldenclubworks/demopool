// Zubehör um das Becken: Liegen (Alu + Teak + Leinen), Sonnenschirm, Leiter, Gegenstrom, Wasserfall, Wärmepumpe, Pflanzen (glTF).
// Im AR-Modus nur Teile, die auf ebenem Boden stehen (Liegen, Schirm, Pflanzen).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { spanAt, COPING_W, DECK_W } from './pool.js';
import { flowTexture } from './textures.js';
import { pbr, loadModel } from './assets.js';

let shared = null;
function sharedMats() {
  if (shared) return shared;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });
  const flow = flowTexture(); flow.repeat.set(1, 1);
  const flowV = flowTexture(); flowV.repeat.set(1, 1);
  const linen = (color, mpt = 0.5) => { const m = std({ ...pbr('linen', { metersPerTile: mpt, rough: false }), color, roughness: 1 }); m.normalScale.set(1.4, 1.4); m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * 1.75);'); }; return m; };
  shared = {
    flow, flowV,
    steel: std({ color: 0xdfe3e6, roughness: 0.22, metalness: 1 }),
    frame: std({ color: 0x30353a, roughness: 0.42, metalness: 0.85 }),
    teak: std({ ...pbr('decking', { metersPerTile: 0.6 }), color: 0xc79a68, roughness: 0.7 }),
    cushion: linen(0xefe9dc), towel: linen(0x2f7fb5, 0.4), towel2: linen(0xf7f5ef, 0.4), canvas: (() => { const m = linen(0xffefd0, 0.7); m.side = THREE.DoubleSide; m.emissive.setHex(0x2c2518); return m; })(),
    concrete: std({ ...pbr('concrete', { metersPerTile: 0.6 }), color: 0xcfcfcf, roughness: 1 }),
    grey: std({ color: 0xcfd4d8, roughness: 0.45, metalness: 0.25 }), dark: std({ color: 0x23282c, roughness: 0.5 }),
    jet: new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: flow, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    fall: new THREE.MeshBasicMaterial({ color: 0xeaf6ff, alphaMap: flowV, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  };
  return shared;
}

/** Sonnenschirm-Bespannung: 8 Bahnen, zwischen den Rippen leicht durchhängend. */
function canopyGeometry(R = 1.45, H = 0.5, gores = 8) {
  const pos = [], idx = [], uv = [], rings = 8, sub = 5;
  for (let g = 0; g < gores; g++) for (let j = 0; j <= sub; j++) for (let i = 0; i <= rings; i++) {
    const a = ((g + j / sub) / gores) * Math.PI * 2, r = (i / rings) * R, edge = Math.sin((j / sub) * Math.PI);
    const y = -H * Math.pow(i / rings, 1.7) - edge * 0.07 * (i / rings) * (0.4 + 0.6 * (i / rings));
    pos.push(Math.cos(a) * r, y, Math.sin(a) * r); uv.push(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    if (i < rings && j < sub) { const b = (g * (sub + 1) + j) * (rings + 1) + i, c = b + rings + 1; idx.push(b, b + 1, c, c, b + 1, c + 1); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/** state: Konfiguration, pool: Rückgabe von buildPool, mats: Szenen-Materialien, mode 'scene' | 'ar' */
export function buildExtras(state, pool, mats, mode = 'scene') {
  const M = sharedMats(), ar = mode === 'ar', x = state.extras;
  const group = new THREE.Group(); group.name = 'zubehoer';
  const disposables = []; let dead = false;
  const put = (geo, mat, { parent = group, cast = true, receive = true, pos, rot } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); disposables.push(geo); return m;
  };
  const { minX, maxX, minZ, maxZ } = pool.bounds, L = maxX - minX, topY = state.deck === 'gras' ? 0 : 0.035;
  const at = (f) => minX + L * f;
  const zTop = (xx) => (spanAt(pool.contour, xx) || [minZ, maxZ])[1];
  const zBot = (xx) => (spanAt(pool.contour, xx) || [minZ, maxZ])[0];
  const hx = L / 2 + COPING_W + DECK_W, hz = (maxZ - minZ) / 2 + COPING_W + DECK_W;
  const anim = [];
  const box = (w, h, d, px, py, pz) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(px, py, pz); return g; };

  /* Liegen: Aluminiumgestell, Teak-Leisten, Leinenauflage (Kopfteil nach außen) */
  const lounger = (i) => {
    const one = new THREE.Group(), frame = [], slats = [];
    for (const sx of [-0.29, 0.29]) {
      frame.push(box(0.04, 0.045, 1.28, sx, 0.33, -0.34));                                           // Seitenholm Sitz
      for (const lz of [-0.9, 0.12]) { const leg = new THREE.CylinderGeometry(0.02, 0.016, 0.33, 10); leg.translate(sx, 0.165, lz); frame.push(leg); }
    }
    frame.push(box(0.6, 0.035, 0.04, 0, 0.33, -0.98), box(0.6, 0.035, 0.04, 0, 0.33, 0.3), box(0.6, 0.03, 0.03, 0, 0.2, -0.9), box(0.6, 0.03, 0.03, 0, 0.2, 0.12));
    for (let k = 0; k < 17; k++) slats.push(box(0.54, 0.018, 0.058, 0, 0.358, -0.96 + k * 0.074));
    put(mergeGeometries(frame), M.frame, { parent: one }); put(mergeGeometries(slats), M.teak, { parent: one });
    const back = new THREE.Group(); back.position.set(0, 0.36, 0.3); back.rotation.x = -0.95;           // Rückenlehne, hinten angeschlagen
    for (const sx of [-0.29, 0.29]) put(box(0.04, 0.045, 0.84, sx, 0, 0.42), M.frame, { parent: back });
    const bs = []; for (let k = 0; k < 11; k++) bs.push(box(0.54, 0.018, 0.058, 0, 0.026, 0.06 + k * 0.074)); put(mergeGeometries(bs), M.teak, { parent: back });
    put(new RoundedBoxGeometry(0.56, 0.085, 0.8, 4, 0.04), M.cushion, { parent: back, pos: [0, 0.07, 0.43] });
    put(new RoundedBoxGeometry(0.56, 0.085, 1.14, 4, 0.04), M.cushion, { parent: one, pos: [0, 0.42, -0.4] });
    const roll = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 18); roll.rotateZ(Math.PI / 2); put(roll, M.cushion, { parent: back, pos: [0, 0.12, 0.76] });
    put(new RoundedBoxGeometry(0.46, 0.014, 0.82, 2, 0.006), i % 2 ? M.towel2 : M.towel, { parent: one, pos: [0, 0.472, -0.5], cast: false });   // Badetuch
    one.add(back); return one;
  };
  const lf = x.loungers >= 4 ? [0.2, 0.4, 0.6, 0.8] : x.loungers >= 2 ? [0.3, 0.7] : x.loungers === 1 ? [0.5] : [];
  lf.forEach((f, i) => { const xx = at(f), l = lounger(i); l.position.set(xx, topY, zTop(xx) + COPING_W + 1.3); l.rotation.y = (i % 2 ? 0.05 : -0.04); group.add(l); });

  /* Sonnenschirm: Edelstahlmast, 8 Rippen, Stoffbespannung, Betonfuß */
  if (x.parasol) {
    const xx = at(0.5), z = zTop(xx) + COPING_W + 1.35, g = new THREE.Group();
    put(new THREE.CylinderGeometry(0.34, 0.38, 0.1, 28), M.concrete, { parent: g, pos: [0, 0.05, 0] });
    put(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 20), M.steel, { parent: g, pos: [0, 0.13, 0] });
    put(new THREE.CylinderGeometry(0.022, 0.026, 2.4, 14), M.steel, { parent: g, pos: [0, 1.3, 0] });
    const top = new THREE.Group(); top.position.y = 2.46; g.add(top);
    put(canopyGeometry(1.45, 0.5), M.canvas, { parent: top, cast: true });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rib = new THREE.CylinderGeometry(0.008, 0.008, 1.55, 5); rib.rotateZ(Math.PI / 2 - 0.34); rib.translate(0.77, -0.27, 0); rib.rotateY(-a); put(rib, M.steel, { parent: top, cast: false }); }
    put(new THREE.SphereGeometry(0.035, 12, 8), M.steel, { parent: top, pos: [0, 0.03, 0], cast: false });
    g.position.set(xx, topY, z); group.add(g);
  }

  /* Pflanzen in den Terrassenecken (Poly-Haven-Modelle, auf Zielhöhe skaliert) */
  if (x.planters) {
    const corners = [[hx - 0.6, hz - 0.6], [-hx + 0.6, hz - 0.6], [hx - 0.6, -hz + 0.6], [-hx + 0.6, -hz + 0.6]];
    corners.forEach(([cx, cz], i) => {
      loadModel(i % 2 ? 'potted_plant_02' : 'potted_plant_04').then((src) => {
        if (dead) return;
        const m = src.clone(), bb = new THREE.Box3().setFromObject(m), h = bb.max.y - bb.min.y, s = (i % 2 ? 0.95 : 0.85) / h;
        m.scale.setScalar(s); m.position.set(cx, topY - bb.min.y * s, cz); m.rotation.y = i * 1.9;
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material.alphaTest > 0 || o.material.alphaMap || o.material.transparent) { o.material.alphaTest = 0.5; o.material.transparent = false; o.material.alphaToCoverage = true; } } });
        m.userData.gltf = true; group.add(m);
      });
    });
  }

  if (!ar) {
    /* Edelstahl-Leiter an der +z-Seite */
    if (x.ladder) {
      const xx = at(0.5) + 0.0, zw = zTop(xx) - 0.04, d = Math.min(1.1, pool.depthAt(xx) - 0.25);
      for (const sx of [-0.25, 0.25]) {
        const curve = new THREE.CatmullRomCurve3([[-d, 0.0], [0.85, 0.0], [0.98, 0.1], [1.0, 0.3], [0.9, 0.5], [0.0, 0.5]].map(([y, dz]) => new THREE.Vector3(xx + sx, y, zw + dz)), false, 'catmullrom', 0.2);
        put(new THREE.TubeGeometry(curve, 40, 0.022, 10, false), M.steel, { pos: [0, 0, 0] });
      }
      for (const y of [-0.3, -0.62, -0.94]) if (-y < d + 0.05) put(new RoundedBoxGeometry(0.5, 0.025, 0.12, 2, 0.01), M.steel, { pos: [xx, y, zw + 0.05], cast: false });
    }
    /* Gegenstromanlage an der Stirnwand (x = max) */
    if (x.jet) {
      const xx = maxX - 0.5, sp = spanAt(pool.contour, xx) || [-0.5, 0.5], zc = (sp[0] + sp[1]) / 2;
      const wx = (() => { let w = xx; for (let i = 0; i < 40 && spanAt(pool.contour, w + 0.03); i++) w += 0.03; return w; })();
      put(new RoundedBoxGeometry(0.04, 0.5, 0.7, 2, 0.015), M.steel, { pos: [wx - 0.02, -0.62, zc], cast: false });
      put(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 24), M.dark, { pos: [wx - 0.05, -0.62, zc], rot: [0, 0, Math.PI / 2], cast: false });
      const plane = new THREE.PlaneGeometry(2.6, 0.55); plane.rotateX(-Math.PI / 2); plane.translate(-1.3, 0, 0);
      const m = put(plane, M.jet, { pos: [wx - 0.1, -0.5, zc], cast: false, receive: false }); m.renderOrder = 3;
      anim.push((t) => { M.flow.offset.x = -t * 0.9; });
    }
    /* Wasserfall an der -z-Seite */
    if (x.waterfall) {
      const xx = at(0.5), z0 = zBot(xx) - COPING_W - 0.18;
      put(new RoundedBoxGeometry(1.1, 0.7, 0.28, 2, 0.02), M.steel, { pos: [xx, topY + 0.35, z0] });
      put(new RoundedBoxGeometry(1.3, 0.06, 0.4, 2, 0.02), M.steel, { pos: [xx, topY + 0.03, z0 + 0.04] });
      const h = topY + 0.45 + 0.12, plane = new THREE.PlaneGeometry(0.8, h); plane.translate(0, -h / 2, 0);
      const m = put(plane, M.fall, { pos: [xx, topY + 0.45, z0 + COPING_W * 0.9 + 0.15], cast: false, receive: false }); m.renderOrder = 3;
      anim.push((t) => { M.flowV.offset.x = -t * 0.7; });
    }
    /* Wärmepumpe an der Hauswand (hinten rechts) */
    if (x.heatpump) {
      const g = new THREE.Group();
      put(new RoundedBoxGeometry(1.0, 0.75, 0.4, 4, 0.03), M.grey, { parent: g, pos: [0, 0.4, 0] });
      put(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 32), M.dark, { parent: g, pos: [0, 0.42, 0.205], rot: [Math.PI / 2, 0, 0], cast: false });
      put(new THREE.TorusGeometry(0.26, 0.015, 8, 36), M.steel, { parent: g, pos: [0, 0.42, 0.21], cast: false });
      for (const lx of [-0.4, 0.4]) put(new THREE.BoxGeometry(0.06, 0.05, 0.35), M.dark, { parent: g, pos: [lx, 0.02, 0] });
      g.position.set(hx - 2, topY, -hz + 0.45); group.add(g);
    }
  }

  return {
    group,
    update(t) { for (const f of anim) f(t); },
    dispose() { dead = true; for (const g of disposables) g.dispose(); },
  };
}
