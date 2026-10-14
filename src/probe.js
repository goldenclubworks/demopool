// Lokale Spiegelung: Hecke, Bäume, Sichtschutz und Möbel spiegeln sich im Wasser. Ein kleiner Würfel-Schnappschuss von der Beckenmitte,
// auf mehrere Bilder verteilt (eine Würfelseite je Bild, danach die Umrechnung) – nie als ein einziger Ruckler – als Umgebungskarte nur für das Wasser.
// Das Wasser selbst liegt auf Ebene 1 (Hauptkamera sieht Ebene 0 und 1, die Würfelkameras nur Ebene 0): es muss nie ausgeblendet werden.
import * as THREE from 'three';

export function createProbe(renderer, scene, size = 256) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const cam = new THREE.CubeCamera(0.3, 500, rt); cam.position.set(0, 0.5, 0); cam.updateMatrixWorld(true);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let phase = -1;
  const renderFace = (i, mips) => {
    const prev = renderer.getRenderTarget(), pf = renderer.getActiveCubeFace(), pm = renderer.getActiveMipmapLevel(), gm = rt.texture.generateMipmaps;
    rt.texture.generateMipmaps = mips && gm; renderer.setRenderTarget(rt, i, 0); renderer.render(scene, cam.children[i]); rt.texture.generateMipmaps = gm; renderer.setRenderTarget(prev, pf, pm);
  };
  return {
    get busy() { return phase >= 0; },
    /** neue Aufnahme beginnen (läuft mit step() weiter, ein Schritt je Bild) */
    begin() { phase = 0; },
    abort() { phase = -1; },
    /** ein Schritt; gibt das fertige Ergebnis (Render-Target mit Umgebungskarte) zurück, sonst null. Der Aufrufer gibt es frei. */
    step() {
      if (phase < 0) return null;
      if (phase < 6) { renderFace(phase, phase === 5); phase++; return null; }
      rt.texture.needsPMREMUpdate = true; phase = -1;
      return pmrem.fromCubemap(rt.texture);
    },
    /** alles auf einmal (nur beim Start hinter dem Preloader) */
    updateNow() { for (let i = 0; i < 6; i++) renderFace(i, i === 5); rt.texture.needsPMREMUpdate = true; phase = -1; return pmrem.fromCubemap(rt.texture); },
  };
}
