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
/** Glow: helle Bildanteile bei 1/4 Auflösung herausziehen (4 Abtastungen), zweimal getrennt weichzeichnen. Nur kleine Durchgänge. */
class GlowPass extends Pass {
  constructor(effect) {
    super('GlowPass'); this.needsSwap = false; this.effect = effect;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.a = new THREE.WebGLRenderTarget(2, 2, opts); this.b = new THREE.WebGLRenderTarget(2, 2, opts);
    const mat = (frag, u) => new THREE.ShaderMaterial({ uniforms: { tIn: { value: null }, texel: { value: new THREE.Vector2() }, ...u }, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.down = mat(`uniform sampler2D tIn; uniform vec2 texel; uniform float thr; varying vec2 vUv;
      // 8 bilineare Abtastungen decken den 4×4-Block gleichmäßig ab (keine Lücken → kein Flimmern); Extremwerte (Glanzpunkte) werden begrenzt
      vec3 br(vec2 o) { vec3 c = min(texture2D(tIn, vUv + o * texel).rgb, vec3(8.0)); return max(c - thr, 0.0); }
      void main() { vec3 s = br(vec2(-1.5, -0.5)) + br(vec2(1.5, 0.5)) + br(vec2(-0.5, 1.5)) + br(vec2(0.5, -1.5)) + br(vec2(-0.5, -0.5)) + br(vec2(0.5, 0.5)) + br(vec2(-1.5, 1.5)) + br(vec2(1.5, -1.5));
        gl_FragColor = vec4(s * 0.125, 1.0); }`, { thr: { value: 1.0 } });
    this.blur = mat(`uniform sampler2D tIn; uniform vec2 texel; uniform vec2 dir; varying vec2 vUv;
      void main() { vec3 s = texture2D(tIn, vUv).rgb * 0.227; vec2 d = dir * texel;
        s += (texture2D(tIn, vUv + d * 1.385).rgb + texture2D(tIn, vUv - d * 1.385).rgb) * 0.316; s += (texture2D(tIn, vUv + d * 3.231).rgb + texture2D(tIn, vUv - d * 3.231).rgb) * 0.070; gl_FragColor = vec4(s, 1.0); }`, { dir: { value: new THREE.Vector2() } });
    this.effect.uniforms.get('tGlow').value = this.a.texture;
  }
  get threshold() { return this.down.uniforms.thr.value; } set threshold(v) { this.down.uniforms.thr.value = v; }
  setSize(w, h) { const sw = Math.max(2, w >> 2), sh = Math.max(2, h >> 2); this.a.setSize(sw, sh); this.b.setSize(sw, sh); this.down.uniforms.texel.value.set(1 / w, 1 / h); this.blur.uniforms.texel.value.set(1 / sw, 1 / sh); }
  render(renderer, inputBuffer) {
    const run = (m, from, to) => { m.uniforms.tIn.value = from.texture; this.fullscreenMaterial = m; renderer.setRenderTarget(to); renderer.render(this.scene, this.camera); };
    run(this.down, inputBuffer, this.a);
    this.blur.uniforms.dir.value.set(2.5, 0); run(this.blur, this.a, this.b); this.blur.uniforms.dir.value.set(0, 2.5); run(this.blur, this.b, this.a);
  }
}

export function createPost(renderer, scene, camera, tier = 'high') {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  const size = renderer.getSize(new THREE.Vector2());
  const ao = new N8AOPostPass(scene, camera, size.x, size.y);
  ao.configuration.aoRadius = 0.45; ao.configuration.distanceFalloff = 0.9; ao.configuration.intensity = 2.4; ao.configuration.color = new THREE.Color(0x14181c);
  ao.configuration.gammaCorrection = false; ao.configuration.halfRes = true; ao.setQualityMode('Medium');
  const glow = new GlowEffect(), glowPass = new GlowPass(glow); glowPass.threshold = 1.7;
  composer.addPass(glowPass);         // vor AO: liest den frischen Szenen-Puffer (die umgekehrte Reihenfolge war 18 ms langsamer)
  composer.addPass(ao);
  const exposure = new ExposureEffect(), grade = new HueSaturationEffect({ saturation: 0.06, hue: 0 });
  const vignette = new VignetteEffect({ eskil: false, offset: 0.3, darkness: 0.42 }), tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const noAA = new EffectPass(camera, glow, exposure, grade, vignette, tone);
  const withAA = new EffectPass(camera, glow, exposure, grade, vignette, tone, new FXAAEffect()); withAA.enabled = false;
  composer.addPass(noAA); composer.addPass(withAA);

  const api = {
    composer, ao, tier, parts: { glowPass, noAA, withAA, glow }, aa: false, glowOn: true,
    setTier(t) { api.tier = t; ao.enabled = t === 'high'; api.updateGlow(); },
    /** Glow nur, wenn es etwas zum Leuchten gibt (Abend/Nacht, Lampen); am Tag spart das einen Durchgang */
    setGlow(on) { api.glowOn = on; api.updateGlow(); },
    updateGlow() { glowPass.enabled = api.glowOn && api.tier !== 'low'; glow.uniforms.get('uGlow').value = glowPass.enabled ? 0.45 : 0; },
    /** FXAA nur bei kleiner Pixeldichte nötig (bei Retina löst die Auflösung die Kanten) */
    setAA(on) { api.aa = on; noAA.enabled = !on; withAA.enabled = on; },
    setExposure(v) { exposure.exposure = v; },
    setSize(w, h) { composer.setSize(w, h, false); ao.setSize(w, h); },
    render(dt) { composer.render(dt); },
  };
  api.setTier(tier);
  return api;
}
