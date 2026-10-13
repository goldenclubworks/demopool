// Prozedurale Texturen: Mosaik-Fliesen (PBR), Wasser-Wellen, Strömung, Rollladen-Lamellen, Blatt-Karten.
// Foto-Materialien (Holz, Stein, Rasen …) kommen als CC0-Dateien aus public/textures (siehe assets.js).
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// kachelbares Value-Noise + fBm
export function makeNoise(seed, period) {
  const r = rng(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => g[((y % period) + period) % period * period + (((x % period) + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = sm(x - xi), ty = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

export function fbm(noises, x, y, base, octaves) {
  let v = 0, amp = 0.5, f = base, norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += amp * noises[o](x * f, y * f);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return v / norm;
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function finish(tex, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* ---------- Mosaik-Fliesen (PBR) ---------- */
/** Größe einer Textur-Kachel in Metern: 16 × 16 Fliesen à 3 cm (inkl. 3-mm-Fuge) */
export const TILE_REPEAT_M = 0.48;

/**
 * Glasierte Keramik-Mosaikfliesen als PBR-Satz: Farbe (Graustufen mit leichtem Farbstich, wird mit der Beckenfarbe
 * multipliziert), Normal (gefaste, leicht gewölbte, einzeln verkippte Fliesen, vertiefte Fuge), Rauheit (Glasur glänzt, Fuge matt).
 */
export function tileMaps(size = 1024, aniso = 8) {
  const N = 16, t = size / N, gap = Math.max(3, Math.round(t * 0.11)), r = rng(11);
  const noise = [1, 2, 3].map((i) => makeNoise(200 + i, 4 * 2 ** (i - 1)));
  const cell = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) cell.push({ l: 0.9 + r() * 0.1, hue: (r() - 0.5) * 0.05, tx: (r() - 0.5) * 0.16, ty: (r() - 0.5) * 0.16, glaze: 0.85 + r() * 0.3 });
  const H = new Float32Array(size * size), col = new Uint8ClampedArray(size * size * 4), rgh = new Uint8ClampedArray(size * size * 4);
  const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ti = Math.floor(x / t), tj = Math.floor(y / t), c = cell[tj * N + ti];
    const lx = x - ti * t, ly = y - tj * t;                                   // Position in der Fliese
    const d = Math.min(lx, ly, t - 1 - lx, t - 1 - ly);                       // Abstand zum Fliesenrand in px
    const inTile = smooth(gap * 0.5, gap * 0.5 + 1.2, d);                     // 0 = Fuge, 1 = Fliese
    const bevel = smooth(gap * 0.5, gap * 0.5 + t * 0.13, d);                 // Fase zum Rand hin
    const u = lx / t - 0.5, v = ly / t - 0.5;
    const pillow = (1 - (u * u + v * v) * 1.6) * 0.35;                        // leichte Wölbung
    const n = fbm(noise, x / size, y / size, 8, 3);
    const i = (y * size + x) * 4;
    H[y * size + x] = inTile * (0.55 + 0.4 * bevel + pillow * 0.5 + c.tx * u + c.ty * v) - (1 - inTile) * 0.25;
    // Farbe: Fliese hell mit leichter Glasur-Schattierung, Fuge dunkler (Zement) mit Schmutzkante
    const tile = 0.82 + 0.14 * c.l + (n - 0.5) * 0.06 + (bevel - 1) * 0.07;
    const grout = 0.50 + (n - 0.5) * 0.12;
    const L = grout + (tile - grout) * inTile;
    col[i] = Math.min(255, 255 * L * (1 + c.hue)); col[i + 1] = Math.min(255, 255 * L); col[i + 2] = Math.min(255, 255 * L * (1 - c.hue)); col[i + 3] = 255;
    const R = (0.16 * c.glaze + (n - 0.5) * 0.05) * inTile + 0.9 * (1 - inTile) + 0.08 * (1 - bevel) * inTile;
    rgh[i] = rgh[i + 1] = rgh[i + 2] = Math.min(255, 255 * R); rgh[i + 3] = 255;
  }
  const nrm = new Uint8ClampedArray(size * size * 4), s = 5.2;
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let nx = (at(x - 1, y) - at(x + 1, y)) * s, ny = (at(x, y + 1) - at(x, y - 1)) * s, nz = 1;       // OpenGL-Normalen, v zeigt nach oben
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4;
    nrm[i] = (nx * 0.5 + 0.5) * 255; nrm[i + 1] = (ny * 0.5 + 0.5) * 255; nrm[i + 2] = (nz * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const mk = (data, srgb) => { const cv = canvas(size, size); cv.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0); return finish(new THREE.CanvasTexture(cv), { srgb, repeat: [1 / TILE_REPEAT_M, 1 / TILE_REPEAT_M], aniso }); };
  return { map: mk(col, true), normalMap: mk(nrm, false), roughnessMap: mk(rgh, false) };
}

/** Wellen-Normalmap für die Wasserfläche (kachelbar; xy = Neigung) */
export function waterNormal(size = 512) {
  const c = canvas(size, size), x = c.getContext('2d');
  const n = [1, 2, 3, 4].map((i) => makeNoise(1300 + i, 4 * 2 ** (i - 1)));
  const h = new Float32Array(size * size);
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) h[yy * size + xx] = fbm(n, xx / size, yy / size, 3, 4);
  const img = x.createImageData(size, size), s = 7;
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
    const l = h[yy * size + ((xx - 1 + size) % size)], rr = h[yy * size + ((xx + 1) % size)];
    const u = h[((yy - 1 + size) % size) * size + xx], d = h[((yy + 1) % size) * size + xx];
    let nx = (l - rr) * s, ny = (u - d) * s, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (yy * size + xx) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return finish(new THREE.CanvasTexture(c), { srgb: false, repeat: [1, 1] });
}

/** Rollladen-Lamellen (Graustufen) */
export function slatTexture(size = 256) {
  const c = canvas(size, size), x = c.getContext('2d');
  x.fillStyle = '#d9dde0'; x.fillRect(0, 0, size, size);
  const n = size / 16;
  for (let k = 0; k < 16; k++) { x.fillStyle = 'rgba(40,50,60,.5)'; x.fillRect(0, k * n, size, 2); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, k * n + 2, size, 2); }
  return finish(new THREE.CanvasTexture(c), { repeat: [1, 1] });
}

/** Strömungsstreifen als Alpha-Textur (Gegenstrom, Wasserfall); Streifen laufen entlang U */
export function flowTexture(size = 256) {
  const c = canvas(size, size), x = c.getContext('2d'), r = rng(91);
  x.fillStyle = '#000'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const y = r() * size, len = size * (0.25 + r() * 0.6), x0 = r() * size, a = 0.35 + r() * 0.65;
    const g = x.createLinearGradient(x0, 0, x0 + len, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(x0, y, len, 1.5 + r() * 3);
    if (x0 + len > size) { x.fillRect(x0 - size, y, len, 1.5); }
  }
  return finish(new THREE.CanvasTexture(c), { srgb: false, repeat: [1, 1] });
}

/* ---------- Blatt-Karten für Hecken, Bäume und Beete (RGBA, nicht kachelnd) ---------- */
/**
 * Büschel aus vielen Einzelblättern mit Mittelrippe, Farbverlauf und Tiefenstaffelung (dunkle Blätter hinten, helle vorn).
 * kind: 'laub' (Laubbaum/Hecke) · 'lanzett' (schmale Blätter, Gräser/Lavendel) · 'bluete' (Blüten über Laub)
 */
export function leafCard(kind = 'laub', size = 512, seed = 5) {
  const c = canvas(size, size), x = c.getContext('2d'), r = rng(seed);
  const leaf = (px, py, ang, len, wid, h, s, l) => {
    x.save(); x.translate(px, py); x.rotate(ang);
    const g = x.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `hsl(${h - 8},${s}%,${l * 0.62}%)`); g.addColorStop(0.55, `hsl(${h},${s}%,${l}%)`); g.addColorStop(1, `hsl(${h + 6},${s - 6}%,${Math.min(70, l * 1.25)}%)`);
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0);
    x.bezierCurveTo(len * 0.22, -wid, len * 0.7, -wid * 0.85, len, 0);
    x.bezierCurveTo(len * 0.7, wid * 0.85, len * 0.22, wid, 0, 0); x.fill();
    x.strokeStyle = `hsla(${h + 14},${s - 10}%,${Math.min(75, l + 20)}%,.55)`; x.lineWidth = Math.max(1, wid * 0.07);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(len * 0.94, 0); x.stroke();
    x.restore();
  };
  const layers = kind === 'lanzett' ? 3 : 4;
  for (let k = 0; k < layers; k++) {
    const depth = k / (layers - 1), n = Math.round((kind === 'lanzett' ? 14 : 22) * (1 - depth * 0.35));
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * size * 0.36;
      const px = size / 2 + Math.cos(a) * rad * 0.9, py = size / 2 + Math.sin(a) * rad * 0.9;
      const out = Math.atan2(py - size / 2, px - size / 2) + (r() - 0.5) * 1.5;
      const len = size * (kind === 'lanzett' ? 0.3 + r() * 0.14 : 0.13 + r() * 0.07), wid = len * (kind === 'lanzett' ? 0.11 : 0.34 + r() * 0.12);
      leaf(px, py, out, len, wid, 92 + r() * 30, 42 + r() * 24, (kind === 'lanzett' ? 22 : 14) + depth * 24 + r() * 8);
    }
  }
  if (kind === 'bluete') {
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * size * 0.34, px = size / 2 + Math.cos(a) * rad, py = size / 2 + Math.sin(a) * rad, pr = size * (0.025 + r() * 0.02);
      x.fillStyle = '#ffffff'; x.globalAlpha = 1;
      for (let p = 0; p < 5; p++) { const pa = (p / 5) * Math.PI * 2; x.beginPath(); x.ellipse(px + Math.cos(pa) * pr * 0.9, py + Math.sin(pa) * pr * 0.9, pr * 0.8, pr * 0.62, pa, 0, 7); x.fill(); }
      x.fillStyle = '#f5d24a'; x.beginPath(); x.arc(px, py, pr * 0.42, 0, 7); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
