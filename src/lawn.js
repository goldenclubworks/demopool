// Rasen als „Shell“-Gras: N übereinanderliegende Ebenen (eine Zeichnung, instanziert) über dem Boden. Jede Ebene zeigt nur die
// Halm-Querschnitte, die bis zu ihrer Höhe reichen – zusammen ergibt das dichten, kurzen Rasen (4,5 cm) statt einzelner Büschel.
// Farbe und Textur sind dieselben wie beim Boden darunter (gleiche UVs, gleiche Flecken/Mähstreifen), nach oben heller, unten dunkler.
// Kosten: Pixel werden früh verworfen (vor der Beleuchtung); nur im Umkreis der Kamera (uFar), unter der Terrasse nichts.
import * as THREE from 'three';

const H = 0.06;                                    // Halmhöhe in Metern (gemähter Rasen)
const mats = new Map();
function shellMaterial(ground) {
  if (mats.has(ground)) return mats.get(ground);
  const m = new THREE.MeshStandardMaterial({ map: ground.map, color: ground.color.clone(), roughness: 1, metalness: 0 });     // ohne Normal-Map: Halme sind zu schmal dafür, spart Zeit
  const U = m.userData.u = { uNoise: { value: ground.userData.noise }, uDeck: { value: new THREE.Vector2() }, uFar: { value: 12 }, uDens: { value: 105 }, uH: { value: H } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying float vLayer; uniform float uH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz; vLayer = instanceMatrix[3].y / uH;\nvMapUv = (mapTransform * vec3(vWPos.x, -vWPos.z, 1.0)).xy;   // Textur in Weltkoordinaten: die Scheibe wandert mit der Kamera, das Muster bleibt liegen');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWPos; varying float vLayer; uniform sampler2D uNoise; uniform vec2 uDeck; uniform float uFar, uDens;
      float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
      float gTint;`)
      // früh verwerfen (vor Texturen und Licht): unter der Terrasse, außerhalb der Reichweite, kein Halm an dieser Stelle
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (abs(vWPos.x) < uDeck.x && abs(vWPos.z) < uDeck.y) discard;
      float dCam = length(vWPos.xz - cameraPosition.xz);
      if (dCam > uFar) discard;
      vec2 gp = vWPos.xz * uDens, cell = floor(gp), f = fract(gp) - 0.5 - (h22(cell) - 0.5) * 0.45;
      float hgt = (0.3 + 0.7 * h12(cell + 7.1)) * (1.0 - smoothstep(uFar * 0.55, uFar, dCam));     // Halmhöhe; zur Reichweite hin flacher (weicher Übergang zum Boden)
      if (vLayer > hgt) discard;
      float ang = h12(cell + 3.7) * 6.2832; vec2 rf = vec2(cos(ang) * f.x - sin(ang) * f.y, sin(ang) * f.x + cos(ang) * f.y);
      if (length(rf * vec2(1.0, 2.4)) > 0.46 * (1.0 - vLayer / max(hgt, 0.001))) discard;              // schmaler, spitz zulaufender Halm
      gTint = h12(cell + 11.3);`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec3 nz = texture2D(uNoise, vWPos.xz / 160.0).rgb, nm = texture2D(uNoise, vWPos.xz / 23.0 + 0.37).rgb;
      float stripe = 0.5 + 0.5 * sin(vWPos.x * 1.7 + 6.0 * nz.b);
      diffuseColor.rgb *= (0.82 + 0.4 * nm.g) * mix(vec3(0.7, 0.86, 0.52), vec3(1.1, 1.08, 0.82), clamp((nz.r * 0.6 + nm.r * 0.4 - 0.5) * 1.7 + 0.35, 0.0, 1.0)) * (0.95 + 0.07 * stripe);
      diffuseColor.rgb *= mix(0.4, 1.2, vLayer) * (0.8 + 0.4 * gTint) * mix(vec3(1.0), vec3(0.86, 1.08, 0.72), vLayer);   // unten im Halmdickicht dunkel, Spitzen hell und frischer grün
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.06, 0.78), smoothstep(0.75, 1.0, vLayer) * gTint);   // einzelne trockenere Spitzen`);
  };
  mats.set(ground, m);
  return m;
}

/** deck: Halbmaße der Terrasse (hx, hz); ground: Boden-Material (Textur, Farbe, Rauschen). count wählt die Schichtzahl (Qualitätsstufe). */
export function buildLawn({ hx, hz }, { count = 15000, ground } = {}) {
  const layers = count >= 15000 ? 12 : count >= 7000 ? 9 : count >= 3500 ? 6 : 0;
  if (!layers || !ground) { const e = new THREE.Group(); e.dispose = () => {}; return e; }
  const m = shellMaterial(ground); m.userData.u.uDeck.value.set(hx, hz); m.userData.u.uFar.value = layers >= 12 ? 7.5 : 5.5;          // weiter weg sind Halme kleiner als ein Pixel: dort trägt die Bodentextur allein
  const R = m.userData.u.uFar.value, g = new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2);     // nur eine Scheibe um die Kamera (sonst kosten 12 bildfüllende Ebenen viel Füllrate)
  const mesh = new THREE.InstancedMesh(g, m, layers), M4 = new THREE.Matrix4();
  for (let i = 0; i < layers; i++) mesh.setMatrixAt(i, M4.makeTranslation(0, ((i + 1) / layers) * H, 0));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'rasenhalme';
  const v = new THREE.Vector3();
  mesh.onBeforeRender = (r, sc, cam) => { v.setFromMatrixPosition(cam.matrixWorld); if (mesh.parent) mesh.parent.worldToLocal(v); mesh.position.set(v.x, 0, v.z); mesh.updateMatrixWorld(); };
  const base = mesh.dispose.bind(mesh); mesh.dispose = () => { base(); g.dispose(); };
  return mesh;
}
