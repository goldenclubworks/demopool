// Nachbearbeitung: Umgebungsverdeckung (N8AO), Bloom, Belichtung, Tone-Mapping, Vignette, Kantenglättung.
// Qualitätsstufen: high (AO voll, 4× MSAA) · medium (AO halbe Auflösung) · low (kein AO, SMAA).
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode, SMAAEffect, Effect, BlendFunction, HueSaturationEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', 'uniform float uExp; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * uExp, inputColor.a); }',
      { blendFunction: BlendFunction.SET, uniforms: new Map([['uExp', new THREE.Uniform(1)]]) });
  }
  set exposure(v) { this.uniforms.get('uExp').value = v; }
}

export function createPost(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: quality === 'high' ? 4 : 0 });
  composer.addPass(new RenderPass(scene, camera));
  const size = renderer.getSize(new THREE.Vector2());
  const ao = new N8AOPostPass(scene, camera, size.x, size.y);
  ao.configuration.aoRadius = 0.45; ao.configuration.distanceFalloff = 0.9; ao.configuration.intensity = 2.4; ao.configuration.color = new THREE.Color(0x14181c);
  ao.configuration.gammaCorrection = false;
  composer.addPass(ao);
  const bloom = new BloomEffect({ intensity: 0.22, luminanceThreshold: 1.0, luminanceSmoothing: 0.5, mipmapBlur: true });
  const exposure = new ExposureEffect();
  const smaa = new SMAAEffect();
  const grade = new HueSaturationEffect({ saturation: 0.06, hue: 0 });
  const vignette = new VignetteEffect({ eskil: false, offset: 0.3, darkness: 0.42 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const bloomPass = new EffectPass(camera, bloom);
  const finalPass = new EffectPass(camera, exposure, grade, vignette, tone, smaa);
  composer.addPass(bloomPass); composer.addPass(finalPass);

  const api = {
    composer, ao, quality,
    setQuality(q) {
      api.quality = q;
      ao.enabled = q !== 'low';
      ao.configuration.halfRes = q === 'medium';
      ao.setQualityMode(q === 'high' ? 'High' : 'Medium');
      bloomPass.enabled = q !== 'low';
    },
    setExposure(v) { exposure.exposure = v; },
    setSize(w, h) { composer.setSize(w, h, false); ao.setSize(w, h); },
    render(dt) { composer.render(dt); },
  };
  api.setQuality(quality);
  return api;
}
