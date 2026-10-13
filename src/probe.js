// Lokale Spiegelung: Hecke, Bäume, Sichtschutz und Möbel spiegeln sich im Wasser. Ein kleiner Würfel-Schnappschuss (256²) von der Beckenmitte,
// einmalig nach Änderungen (nie während der Bedienung), als Umgebungskarte nur für das Wasser. Kostet im Betrieb nichts.
import * as THREE from 'three';

export function createProbe(renderer, scene) {
  const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const cam = new THREE.CubeCamera(0.3, 500, rt); cam.position.set(0, 0.5, 0);
  const pmrem = new THREE.PMREMGenerator(renderer); let env = null;
  return {
    /** hide: Objekte, die nicht im Schnappschuss erscheinen sollen (Wasser selbst) */
    update(hide = []) {
      const was = hide.map((o) => o.visible); hide.forEach((o) => { o.visible = false; });
      cam.update(renderer, scene);
      hide.forEach((o, i) => { o.visible = was[i]; });
      if (env) env.dispose(); env = pmrem.fromCubemap(rt.texture);
      return env.texture;
    },
  };
}
