// Nachbearbeitung: Umgebungsverdeckung (N8AO), leichter Glow, Belichtung, Farbkorrektur, Vignette, Tone-Mapping, FXAA.
// Bewusst schlank (Messung mit GPU-Zeitmessern, Retina 4,2 MP): kein MSAA (+100 ms), Glow bei 1/4 Auflösung statt Standard-Bloom (+25 ms),
// Farbe + Tone-Mapping + FXAA in EINEM Durchgang. Stufen: high = AO + Glow · medium = Glow · low = nichts.
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, VignetteEffect, ToneMappingEffect, ToneMappingMode, FXAAEffect, Effect, Pass, BlendFunction, HueSaturationEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', 'uniform float uExp; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * uExp, inputColor.a); }',
      { blendFunction: BlendFunction.SET, uniforms: new Map([['uExp', new THREE.Uniform(1)]]) });
  }
  set exposure(v) { this.uniforms.get('uExp').value = v; }
}

/** addiert die weichgezeichnete Textur tGlow (Helles aus dem HDR-Bild) auf das Bild, vor dem Tone-Mapping */
class GlowEffect extends Effect {
  constructor() {
    super('GlowEffect', 'uniform sampler2D tGlow; uniform float uGlow; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb + texture2D(tGlow, uv).rgb * uGlow, inputColor.a); }',
      { blendFunction: BlendFunction.SET, uniforms: new Map([['tGlow', new THREE.Uniform(null)], ['uGlow', new THREE.Uniform(0.5)]]) });
  }
}

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
/** Glow: helle Bildanteile bei 1/4 Auflösung herausziehen (8 Abtastungen), dann drei Paare getrennter Weichzeichnung mit wachsendem Radius.
 *  Jeder Schritt schreibt in ein EIGENES kleines Ziel: Auf Apple-GPUs (Metal/ANGLE) erzwingt das Zurückschreiben in eine im selben Bild
 *  bereits gelesene Textur eine Synchronisation (gemessen ca. 9 ms bei 4,2 MP) – Hin-und-her zwischen zwei Puffern war deshalb teuer. */
class GlowPass extends Pass {
  constructor(effects) {
    super('GlowPass'); this.needsSwap = false; this.effects = effects;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.radii = [1.2, 2.4, 4.0];
    this.rts = Array.from({ length: 1 + this.radii.length * 2 }, () => new THREE.WebGLRenderTarget(2, 2, opts));
    this.a = this.rts[this.rts.length - 1];                         // Ergebnis (wird im Abschluss-Durchgang addiert)
    const mat = (frag, u) => new THREE.ShaderMaterial({ uniforms: { tIn: { value: null }, texel: { value: new THREE.Vector2() }, ...u }, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.down = mat(`uniform sampler2D tIn; uniform vec2 texel; uniform float thr; varying vec2 vUv;
      // 8 bilineare Abtastungen decken den 4×4-Block gleichmäßig ab (keine Lücken → kein Flimmern); Extremwerte (Glanzpunkte) werden begrenzt
      // ungültige Werte (NaN/Unendlich aus extrem hellen Spiegelpunkten) verwerfen: sonst verteilt die Weichzeichnung sie als dunkle Scheiben
      vec3 br(vec2 o) { vec3 c = texture2D(tIn, vUv + o * texel).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = min(c, vec3(8.0)); return max(c - thr, 0.0); }
      void main() { vec3 s = br(vec2(-1.5, -0.5)) + br(vec2(1.5, 0.5)) + br(vec2(-0.5, 1.5)) + br(vec2(0.5, -1.5)) + br(vec2(-0.5, -0.5)) + br(vec2(0.5, 0.5)) + br(vec2(-1.5, 1.5)) + br(vec2(1.5, -1.5));
        gl_FragColor = vec4(s * 0.125, 1.0); }`, { thr: { value: 1.0 } });
    this.blur = mat(`uniform sampler2D tIn; uniform vec2 texel; uniform vec2 dir; varying vec2 vUv;
      void main() { vec3 s = texture2D(tIn, vUv).rgb * 0.227; vec2 d = dir * texel;
        s += (texture2D(tIn, vUv + d * 1.385).rgb + texture2D(tIn, vUv - d * 1.385).rgb) * 0.316; s += (texture2D(tIn, vUv + d * 3.231).rgb + texture2D(tIn, vUv - d * 3.231).rgb) * 0.070; gl_FragColor = vec4(s, 1.0); }`, { dir: { value: new THREE.Vector2() } });
    for (const e of this.effects) e.uniforms.get('tGlow').value = this.a.texture;
  }
  get threshold() { return this.down.uniforms.thr.value; } set threshold(v) { this.down.uniforms.thr.value = v; }
  setSize(w, h) { const sw = Math.max(2, w >> 2), sh = Math.max(2, h >> 2); for (const t of this.rts) t.setSize(sw, sh); this.down.uniforms.texel.value.set(1 / w, 1 / h); this.blur.uniforms.texel.value.set(1 / sw, 1 / sh); }
  render(renderer, inputBuffer) {
    const run = (m, from, to) => { m.uniforms.tIn.value = from.texture; this.fullscreenMaterial = m; renderer.setRenderTarget(to); renderer.render(this.scene, this.camera); };
    const t = this.rts; run(this.down, inputBuffer, t[0]);
    // drei Paare mit wachsendem Radius: kleine helle Lichter (Lichterkette) werden rund statt als 4×4-Klötzchen sichtbar
    this.radii.forEach((r, i) => { this.blur.uniforms.dir.value.set(r, 0); run(this.blur, t[2 * i], t[2 * i + 1]); this.blur.uniforms.dir.value.set(0, r); run(this.blur, t[2 * i + 1], t[2 * i + 2]); });
  }
}

export function createPost(renderer, scene, camera, tier = 'high') {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.autoRenderToScreen = false;         // wichtig: sonst gilt immer der zuletzt HINZUGEFÜGTE Durchgang als Ausgabe – ist der abgeschaltet, bliebe das Bild schwarz (Retina!)
  composer.addPass(new RenderPass(scene, camera));
  const size = renderer.getSize(new THREE.Vector2());
  const ao = new N8AOPostPass(scene, camera, size.x, size.y);
  // kleiner Radius und enger Abstandsbereich: nur echte Kontaktschatten (Ecken, Fugen); große Radien erzeugten helle Geisterschleier und dunkle Säume, wo Nahes vor Fernem steht
  ao.configuration.aoRadius = 0.3; ao.configuration.distanceFalloff = 0.25; ao.configuration.intensity = 1.7; ao.configuration.color = new THREE.Color(0x14181c);
  ao.configuration.gammaCorrection = false; ao.configuration.halfRes = true; ao.setQualityMode('Medium');
  // Transparenz-Erkennung aus: n8ao durchsucht sonst jedes Bild die Szene und zeichnet sie bei durchsichtigen Materialien (Wasser, Glasdach,
  // Rasenrand) zusätzlich zweimal (gemessen bis +15 ms bei 4,2 MP). Wasser schreibt keine Tiefe – AO am Beckenboden bleibt richtig.
  ao.autoDetectTransparency = false; ao.configuration.transparencyAware = false;      // erst die Automatik aus (die Einstellung allein greift nur bei geändertem Wert)
  // Abschluss: Glow, Belichtung, Farbe, Vignette, Tone-Mapping in EINEM Durchgang. FXAA danach als eigener Durchgang auf dem
  // fertigen (tone-gemappten) Bild: im selben Durchgang las FXAA das HDR-Bild und überschrieb um sehr helle Lampen herum den Glow
  // (dunkle Scheiben bei Nacht). Kein Effekt-Objekt wird zwischen Durchgängen geteilt (Safari-Engine renderte sonst schwarz).
  const glow = new GlowEffect(), exposure = new ExposureEffect(), grade = new HueSaturationEffect({ saturation: 0.06, hue: 0 });
  const vignette = new VignetteEffect({ eskil: false, offset: 0.3, darkness: 0.42 }), tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const main = new EffectPass(camera, glow, exposure, grade, vignette, tone), fxaa = new EffectPass(camera, new FXAAEffect());
  const finals = [{ pass: main, glow, exposure }];
  const glowPass = new GlowPass([glow]); glowPass.threshold = 1.7;
  composer.addPass(ao);               // AO direkt nach der Szene: nur so nutzt es deren Tiefenpuffer (dazwischen ein Durchgang → AO zeichnet die Szene erneut, nachts +15 ms)
  composer.addPass(glowPass);         // liest das Bild nach AO
  fxaa.enabled = false; main.renderToScreen = true;
  composer.addPass(main); composer.addPass(fxaa);

  const api = {
    composer, ao, tier, parts: { glowPass, main, fxaa }, aa: false, glowOn: true,
    setTier(t) { api.tier = t; ao.enabled = t === 'high'; api.updateGlow(); },
    /** Glow nur, wenn es etwas zum Leuchten gibt (Abend/Nacht, Lampen); am Tag spart das einen Durchgang */
    setGlow(on) { api.glowOn = on; api.updateGlow(); },
    updateGlow() { glowPass.enabled = api.glowOn && api.tier !== 'low'; for (const f of finals) f.glow.uniforms.get('uGlow').value = glowPass.enabled ? 0.45 : 0; },
    /** FXAA nur bei kleiner Pixeldichte nötig (bei Retina löst die Auflösung die Kanten) */
    setAA(on) { api.aa = on; fxaa.enabled = on; main.renderToScreen = !on; fxaa.renderToScreen = on; },
    setExposure(v) { for (const f of finals) f.exposure.exposure = v; },
    setSize(w, h) { composer.setSize(w, h, false); ao.setSize(w, h); },
    render(dt) { composer.render(dt); },
  };
  api.setTier(tier);
  return api;
}
