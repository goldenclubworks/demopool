// Kurzer Grafik-Leistungstest (ca. 0,1 s, hinter dem Preloader): misst, wie schnell das Gerät viele alphagetestete, texturlastige Vollbild-Schichten
// zeichnet – genau das Lastprofil von Laub, AO und Nachbearbeitung. Das Ergebnis ist ein Verhältnis zu einer Referenz (schneller Laptop = 1,0).
// Es funktioniert in jedem Browser (Wandzeit mit Synchronisation), auch ohne GPU-Zeitmesser.
import * as THREE from 'three';

const REF_MS = 4;            // Referenz: Apple M1 (Chrome, Safari, Firefox) braucht für den Test 3,3–5 ms; Software-Grafik ca. 470 ms (Verhältnis 0,01)
export function benchGPU(renderer) {
  const W = 960, H = 640, LAYERS = 60;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
  const noise = new THREE.DataTexture(new Uint8Array(Array.from({ length: 64 * 64 * 4 }, (_, i) => (i * 2654435761 >>> 24) & 255)), 64, 64); noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.minFilter = THREE.LinearMipmapLinearFilter; noise.generateMipmaps = true; noise.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: noise }, k: { value: 0 } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D t; uniform float k; varying vec2 vUv;
      void main() { vec2 p = vUv * (5.0 + k); vec4 a = texture2D(t, p), b = texture2D(t, p * 1.7 + a.xy), c = texture2D(t, p * 0.6 - b.zw);
        float v = a.r * b.g + c.b; v = sin(v * 6.0) * 0.5 + 0.5; if (v < 0.35) discard; gl_FragColor = vec4(vec3(v * a.g, v * b.r, v * c.g), 1.0); }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), scene = new THREE.Scene(), cam = new THREE.Camera(); scene.add(quad);
  const gl = renderer.getContext(), px = new Float32Array(4), prev = renderer.getRenderTarget(), ac = renderer.autoClear;
  const once = () => { renderer.setRenderTarget(rt); renderer.autoClear = false; renderer.clear(); for (let i = 0; i < LAYERS; i++) { mat.uniforms.k.value = i * 0.37; renderer.render(scene, cam); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px); };       // Halbfloat-Ziel wird als FLOAT gelesen; das erzwingt das Warten auf die Grafikkarte
  let best = 1e9;
  try { once(); once(); for (let i = 0; i < 4; i++) { const t0 = performance.now(); once(); best = Math.min(best, performance.now() - t0); } }
  finally { renderer.setRenderTarget(prev); renderer.autoClear = ac; rt.dispose(); noise.dispose(); mat.dispose(); quad.geometry.dispose(); }
  return { ms: best, ratio: REF_MS / Math.max(best, 0.1) };
}

/** Einstufung nach Verhältnis: 'high' (schneller Laptop/aktuelles Spitzenhandy), 'mid' (gutes Mittelklassegerät, ältere iPhones), 'low' (schwach/alt) */
export const classify = (ratio) => (ratio >= 0.45 ? 'high' : ratio >= 0.16 ? 'mid' : 'low');
