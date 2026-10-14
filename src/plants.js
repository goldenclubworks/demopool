// Pflanzen als Instanzen: ein Modell, viele Plätze → pro Teilmesh ein einziger Zeichenaufruf (statt ein Klon mit eigenen Aufrufen je Pflanze).
import * as THREE from 'three';

/** Materialien von Poly-Haven-Pflanzen: Blätter mit hartem Alpha-Test (kein Blending, keine Sortierfehler) */
export function fixPlantMaterial(m) { if (m.alphaTest > 0 || m.alphaMap || m.transparent) { m.alphaTest = 0.5; m.transparent = false; m.depthWrite = true; } return m; }

/**
 * src: geladene Modell-Szene; transforms: Liste von THREE.Matrix4 (Platz, Maßstab, Drehung). Rückgabe: Gruppe aus InstancedMesh.
 * Die Geometrie bleibt geteilt; Sichtbarkeitsprüfung je Teilmesh über die Hüllkugel.
 */
export function instancePlants(src, transforms, { cast = false, receive = true } = {}) {
  src.updateMatrixWorld(true);
  const g = new THREE.Group(), tmp = new THREE.Matrix4();
  src.traverse((o) => {
    if (!o.isMesh) return;
    const mesh = new THREE.InstancedMesh(o.geometry, fixPlantMaterial(o.material.clone()), transforms.length);
    transforms.forEach((T, i) => mesh.setMatrixAt(i, tmp.multiplyMatrices(T, o.matrixWorld)));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.computeBoundingSphere(); g.add(mesh);
  });
  return g;
}
