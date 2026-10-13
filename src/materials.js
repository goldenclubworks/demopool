// Materialien: Mosaik-Becken mit Unterwasser-Optik, Wasseroberfläche (Fresnel, Wellen, Spiegelung), Beckenrand, Terrasse, Rasen.
import * as THREE from 'three';
import { tileMaps, waterNormal, slatTexture, macroNoiseTexture } from './textures.js';
import { pbr } from './assets.js';
import { LINERS } from './catalog.js';

import { WATER_Y } from './pool.js';

const VPOS = '#include <common>\nvarying vec3 vWPos;';
const VPOS_SET = '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;';

/** Foto-Materialien lassen sich per `sat` (Sättigung) neutralisieren, z. B. Beton aus braunstichiger Vorlage. */
function desaturate(mat, sat) {
  mat.userData.sat = { value: sat };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSat = mat.userData.sat;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSat;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, uSat);');
  };
}

export function createMaterials({ aniso = 8, isMobile = false } = {}) {
  /* gemeinsame Uniforms (Zeit, Licht, Kaustik) */
  const U = {
    uTime: { value: 0 }, uCaus: { value: 1 }, uLight: { value: 1 }, uWaterY: { value: WATER_Y },
    uAbsorb: { value: new THREE.Vector3(0.62, 0.17, 0.09) }, uScatter: { value: new THREE.Color(0.02, 0.2, 0.26) },
    uSunCol: { value: new THREE.Color(1, 0.95, 0.85) }, uWave: { value: waterNormal(isMobile ? 256 : 512) },
  };
  U.uWave.value.anisotropy = aniso;

  /* ---------- Becken: glasierte Mosaikfliesen ---------- */
  const tiles = tileMaps(isMobile ? 512 : 1024, aniso);
  const liner = new THREE.MeshPhysicalMaterial({
    ...tiles, color: Object.values(LINERS)[0].hex, roughness: 1, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
    normalScale: new THREE.Vector2(1.1, 1.1),
  });
  liner.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', VPOS).replace('#include <begin_vertex>', VPOS_SET);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWPos; uniform float uTime, uCaus, uLight, uWaterY; uniform vec3 uAbsorb, uScatter, uSunCol;
      float caustic(vec2 p, float t){
        vec2 q = p * 1.9; float c = 0.0;
        for (int i = 0; i < 3; i++) {
          q += vec2(sin(q.y * 1.3 + t * 0.7 + float(i) * 2.0), sin(q.x * 1.1 - t * 0.6 + float(i) * 1.3)) * 0.55;
          c += 1.0 - abs(sin(q.x * 1.9 + q.y * 0.7));
        }
        return pow(clamp(c / 3.0, 0.0, 1.0), 9.0);
      }`).replace('#include <opaque_fragment>', `
      float dw = uWaterY - vWPos.y;
      if (dw > 0.0) {
        // Unterwasser: Lichtweg durch das Wasser (Beer-Lambert), Streulicht des Wassers, Lichtmuster der Wellen
        vec3 Vw = normalize(cameraPosition - vWPos);
        float path = dw / max(0.3, abs(Vw.y));
        vec3 T = exp(-uAbsorb * path);
        outgoingLight += diffuseColor.rgb * caustic(vWPos.xz + vWPos.y * 0.3, uTime) * uCaus * uSunCol * 1.5 * smoothstep(0.0, 0.25, dw);
        outgoingLight = outgoingLight * T + uScatter * (1.0 - T) * uLight;
      } else {
        float wet = smoothstep(0.07, 0.0, -dw);                            // feuchter Streifen über der Wasserlinie
        outgoingLight *= 1.0 - 0.22 * wet;
      }
      outgoingLight += uLight * 0.5 * exp(-pow(dw / 0.007, 2.0)) * vec3(0.8, 0.95, 1.0);   // Wasserlinie: heller Meniskus
      #include <opaque_fragment>`);
  };

  /* ---------- Wasseroberfläche: Fresnel-Spiegelung mit zwei gegenläufigen Wellenschichten ---------- */
  const water = new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.04, metalness: 0, ior: 1.33, envMapIntensity: 1, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  water.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', VPOS).replace('#include <begin_vertex>', VPOS_SET);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform float uTime; uniform sampler2D uWave;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec2 p = vWPos.xz;
        vec2 d = (texture2D(uWave, p * 0.31 + vec2(uTime * 0.011, uTime * 0.006)).xy * 2.0 - 1.0)
               + (texture2D(uWave, p * 0.77 - vec2(uTime * 0.009, -uTime * 0.013) + 0.37).xy * 2.0 - 1.0) * 0.8
               + (texture2D(uWave, p * 2.3 + vec2(uTime * 0.03, uTime * 0.021)).xy * 2.0 - 1.0) * 0.35;
        vec3 nw = normalize(vec3(d.x * 0.17, 1.0, d.y * 0.17));
        normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        float nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        diffuseColor.a = clamp(0.02 + 0.98 * pow(1.0 - nv, 5.0), 0.0, 1.0);   // Fresnel: steil = durchsichtig, flach = Spiegel
      }`);
  };
  const waterAR = new THREE.MeshStandardMaterial({ color: Object.values(LINERS)[0].hex, roughness: 0.18, metalness: 0 });

  /* ---------- Beckenrand und Terrasse: Foto-PBR ---------- */
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
  // Steinmaterialien laden ihre Texturen erst, wenn sie gebraucht werden (Standard sofort, übrige nach dem Start im Hintergrund)
  const stone = (name, mpt, color, sat = 1, normalScale = 1, vertexColors = true) => {
    const m = std({ color, roughness: 1, vertexColors }); m.normalScale.setScalar(normalScale); if (sat !== 1) desaturate(m, sat);
    m.userData.load = () => { if (m.userData.loaded) return; m.userData.loaded = true; Object.assign(m, pbr(name, { metersPerTile: mpt, aniso })); m.needsUpdate = true; };
    return m;
  };
  const copingMats = {
    stein: stone('sandstone', 1.1, 0xfff3e2, 0.9),
    granit: stone('granite', 1.0, 0xe9edf2, 0.9),
    beton: stone('concrete', 0.9, 0xf0f0f0, 0.15),
  };
  const deckMats = {
    holz: stone('decking', 1.0, 0xf2dcc2, 1, 1.2, false),
    stein: stone('sandstone', 1.5, 0xd2cfc8, 0.7, 1, false),
    beton: stone('slabs', 1.4, 0xf6f6f6, 0.15, 1, false),
  };
  deckMats.beton.color.setScalar(2.1); copingMats.beton.color.setScalar(1.7);

  /* ---------- Rasen ---------- */
  const grassSet = pbr('grass', { metersPerTile: 1.8, aniso, rough: false });
  const ground = new THREE.MeshStandardMaterial({ map: grassSet.map, normalMap: grassSet.normalMap, color: new THREE.Color(0.55, 0.74, 0.40), roughness: 1, metalness: 0, transparent: true });
  ground.normalScale.set(0.8, 0.8);
  const noiseTex = macroNoiseTexture();
  ground.onBeforeCompile = (sh) => {
    sh.uniforms.uNoise = { value: noiseTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', VPOS).replace('#include <begin_vertex>', VPOS_SET);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform sampler2D uNoise;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      // Flecken und Mähstreifen aus einer kleinen Rauschtextur (statt Rauschen pro Pixel): große/mittlere Helligkeit und Farbton, Streifen längs x
      vec3 nz = texture2D(uNoise, vWPos.xz / 160.0).rgb, nm = texture2D(uNoise, vWPos.xz / 23.0 + 0.37).rgb;
      float stripe = 0.5 + 0.5 * sin(vWPos.x * 1.7 + 6.0 * nz.b);
      diffuseColor.rgb *= (0.82 + 0.4 * nm.g) * mix(vec3(0.7, 0.86, 0.52), vec3(1.1, 1.08, 0.82), clamp((nz.r * 0.6 + nm.r * 0.4 - 0.5) * 1.7 + 0.35, 0.0, 1.0)) * (0.95 + 0.07 * stripe);
      diffuseColor.a *= 1.0 - smoothstep(70.0, 110.0, length(vWPos.xz));`);
  };

  /* ---------- sonstiges ---------- */
  const mats = {
    liner, water, waterAR,
    lamp: std({ color: 0xffffff, emissive: 0xcdeeff, emissiveIntensity: 0, roughness: 0.4 }),
    slats: std({ map: slatTexture(), color: 0xcfd6da, roughness: 0.45, side: THREE.DoubleSide }),
    rollBox: std({ color: 0xaab2b7, roughness: 0.5, metalness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe2f4f8, transparent: true, opacity: 0.16, roughness: 0.04, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8, clearcoat: 1 }),
    alu: std({ color: 0xc2c8cc, roughness: 0.3, metalness: 0.9 }),
    loungerFrame: std({ color: 0xf0f0ee, roughness: 0.5 }), loungerCushion: std({ color: 0x8a949b, roughness: 0.95 }),
    trim: std({ color: 0xeef0f1, roughness: 0.45 }),
    steel: std({ color: 0xdfe3e6, roughness: 0.22, metalness: 1 }),
  };
  /** lädt die Texturen einer Steinoption (falls noch nicht geschehen) */
  const ensure = (m) => { if (m && m.userData.load) m.userData.load(); };
  const prefetch = () => { [...Object.values(copingMats), ...Object.values(deckMats)].forEach(ensure); };
  return { mats, U, copingMats, deckMats, ground, ensure, prefetch };
}
