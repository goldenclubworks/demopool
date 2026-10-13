// Prozedurale Texturen (keine externen Dateien nötig, alles 1k–2k, kachelbar)
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

/** Rasen, 2k, kachelbar */
export function grassTextures(size = 2048) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = [1, 2, 3, 4, 5].map((i) => makeNoise(300 + i, 8 * 2 ** (i - 1)));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const f = fbm(n, x / size, y / size, 8, 5);
    const g = fbm(n, x / size + 0.25, y / size + 0.5, 8, 3);
    const i = (y * size + x) * 4;
    const l = 0.55 + f * 0.55;
    img.data[i] = (70 + 44 * g) * l; img.data[i + 1] = (96 + 44 * f) * l; img.data[i + 2] = (44 + 22 * g) * l; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const r = rng(7);
  const blade = (x, y) => {
    const len = 6 + r() * 14, ang = -Math.PI / 2 + (r() - 0.5) * 1.1;
    const h = 70 + r() * 40, s = 40 + r() * 30, l = 14 + r() * 26;
    ctx.strokeStyle = `hsla(${h},${s}%,${l}%,${0.35 + r() * 0.4})`;
    ctx.lineWidth = 0.8 + r() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + (r() - 0.5) * 4, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  };
  for (let i = 0; i < 90000; i++) {
    const x = r() * size, y = r() * size;
    blade(x, y);
    if (x < 24) blade(x + size, y);
    if (y < 24) blade(x, y + size);
    if (x > size - 24) blade(x - size, y);
    if (y > size - 24) blade(x, y - size);
  }
  return finish(new THREE.CanvasTexture(c), { repeat: [90, 90], aniso: 16 });
}

/** Erdboden im Gewächshaus (Farbe + Bump) */
export function soilTextures(size = 1024) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = [1, 2, 3, 4, 5].map((i) => makeNoise(500 + i, 8 * 2 ** (i - 1)));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const f = fbm(n, x / size, y / size, 8, 5);
    const i = (y * size + x) * 4;
    const l = 0.4 + f * 0.9;
    img.data[i] = 70 * l; img.data[i + 1] = 52 * l; img.data[i + 2] = 40 * l; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const r = rng(21);
  for (let i = 0; i < 700; i++) {
    const x = r() * size, y = r() * size, rr = 0.8 + r() * 3.2, l = 22 + r() * 22;
    ctx.fillStyle = `hsla(${25 + r() * 15},${8 + r() * 10}%,${l}%,0.9)`;
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  const map = finish(new THREE.CanvasTexture(c), { repeat: [3, 4] });
  const bump = finish(new THREE.CanvasTexture(c), { srgb: false, repeat: [3, 4] });
  return { map, bump };
}

/** Feine Verwitterungsmaske für Gummi/Kunststoffteile */
export function noiseNormal(size = 256) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = [1, 2, 3].map((i) => makeNoise(900 + i, 8 * 2 ** (i - 1)));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = fbm(n, x / size, y / size, 8, 3) * 255;
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(new THREE.CanvasTexture(c), { srgb: false, repeat: [4, 4] });
}

/* ---------- Pool-Texturen (1 Textur = 2 × 2 m, kachelbar; UV in Metern, repeat = 0.5) ---------- */
const M2 = [0.5, 0.5];

/** Graustufen-Mosaik (wird mit der Beckenfarbe multipliziert) */
export function mosaicTexture(size = 512) {
  const c = canvas(size, size), x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, size, size);
  const n = size / 16, r = rng(11);                        // 16 × 16 Fliesen à 12,5 cm
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const v = 232 + Math.floor(r() * 23);
    x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i * n + 1, j * n + 1, n - 2, n - 2);
  }
  x.strokeStyle = 'rgba(120,130,135,.55)'; x.lineWidth = 1.5;
  for (let k = 0; k <= 16; k++) { x.beginPath(); x.moveTo(k * n, 0); x.lineTo(k * n, size); x.stroke(); x.beginPath(); x.moveTo(0, k * n); x.lineTo(size, k * n); x.stroke(); }
  return finish(new THREE.CanvasTexture(c), { repeat: M2 });
}

/** Holzdielen (WPC/Bangkirai), Dielen laufen entlang U (x) */
export function woodTexture(size = 1024) {
  const c = canvas(size, size), x = c.getContext('2d'), r = rng(31);
  const rows = 14, h = size / rows;
  const n = [1, 2, 3].map((i) => makeNoise(700 + i, 4 * 2 ** i));
  for (let j = 0; j < rows; j++) {
    let px = -r() * size * 0.6;
    while (px < size) {
      const len = size * (0.5 + r() * 0.5), base = 0.78 + r() * 0.3;
      for (let yy = 0; yy < h - 2; yy += 2) for (let xx = 0; xx < len; xx += 4) {
        const u = ((px + xx) % size + size) % size, v = j * h + yy;
        const g = fbm(n, u / size * 0.25, v / size * 4, 2, 3);
        const l = base * (0.8 + g * 0.45);
        x.fillStyle = `rgb(${Math.round(150 * l)},${Math.round(104 * l)},${Math.round(68 * l)})`;
        x.fillRect(u, v + 1, 4, 2);
      }
      x.fillStyle = 'rgba(25,15,8,.75)'; x.fillRect(((px % size) + size) % size, j * h, 2, h);
      px += len;
    }
    x.fillStyle = 'rgba(25,15,8,.8)'; x.fillRect(0, j * h, size, 2);
  }
  return finish(new THREE.CanvasTexture(c), { repeat: M2 });
}

/** Terrassenplatten 50 × 50 cm (hell, Naturstein/Feinsteinzeug) */
export function paverTexture(size = 1024, tint = [200, 196, 188], seed = 41) {
  const c = canvas(size, size), x = c.getContext('2d'), r = rng(seed), t = size / 4;
  const n = [1, 2, 3, 4].map((i) => makeNoise(seed * 7 + i, 8 * 2 ** (i - 1)));
  const img = x.createImageData(size, size);
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
    const f = fbm(n, xx / size, yy / size, 6, 4);
    const ti = Math.floor(xx / t) + Math.floor(yy / t) * 4;
    const k = 0.78 + f * 0.4 + (((ti * 2654435761) >>> 0) % 100) / 100 * 0.12 - 0.06;
    const i = (yy * size + xx) * 4;
    img.data[i] = tint[0] * k; img.data[i + 1] = tint[1] * k; img.data[i + 2] = tint[2] * k; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(70,68,64,.8)'; x.lineWidth = 3;
  for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(k * t, 0); x.lineTo(k * t, size); x.stroke(); x.beginPath(); x.moveTo(0, k * t); x.lineTo(size, k * t); x.stroke(); }
  r();
  return finish(new THREE.CanvasTexture(c), { repeat: M2 });
}

/** Beton/Feinbeton: nur feines Rauschen, mit Dehnfugen alle 1 m */
export function concreteTexture(size = 512) {
  const c = canvas(size, size), x = c.getContext('2d');
  const n = [1, 2, 3, 4].map((i) => makeNoise(950 + i, 8 * 2 ** (i - 1)));
  const img = x.createImageData(size, size);
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
    const v = 150 + fbm(n, xx / size, yy / size, 6, 4) * 70, i = (yy * size + xx) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 0.98; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(60,60,60,.65)'; x.lineWidth = 2.5;
  for (const k of [0, size / 2]) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, size); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(size, k); x.stroke(); }
  return finish(new THREE.CanvasTexture(c), { repeat: M2 });
}

/** Wellen-Normalmap für die Wasserfläche (kachelbar, repeat in Metern über uv) */
export function waterNormal(size = 512) {
  const c = canvas(size, size), x = c.getContext('2d');
  const n = [1, 2, 3, 4].map((i) => makeNoise(1300 + i, 4 * 2 ** (i - 1)));
  const h = new Float32Array(size * size);
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) h[yy * size + xx] = fbm(n, xx / size, yy / size, 3, 4);
  const img = x.createImageData(size, size), s = 5;
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
    const l = h[yy * size + ((xx - 1 + size) % size)], rr = h[yy * size + ((xx + 1) % size)];
    const u = h[((yy - 1 + size) % size) * size + xx], d = h[((yy + 1) % size) * size + xx];
    let nx = (l - rr) * s, ny = (u - d) * s, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (yy * size + xx) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return finish(new THREE.CanvasTexture(c), { srgb: false, repeat: [0.5, 0.5] });
}

/** Rollladen-Lamellen (Graustufen) */
export function slatTexture(size = 256) {
  const c = canvas(size, size), x = c.getContext('2d');
  x.fillStyle = '#d9dde0'; x.fillRect(0, 0, size, size);
  const n = size / 16;
  for (let k = 0; k < 16; k++) { x.fillStyle = 'rgba(40,50,60,.5)'; x.fillRect(0, k * n, size, 2); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, k * n + 2, size, 2); }
  return finish(new THREE.CanvasTexture(c), { repeat: [1, 1] });
}
