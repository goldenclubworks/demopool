// Vergleichs-Screenshots für die Optik (echte GPU über Chrome/Metal), ohne Bedienfeld.
// Aufruf: npm run dev (anderes Terminal), dann:  node scripts/shots.mjs <ausgabeordner> [tag,abend,nacht]
// Umgebung: BASE_URL (Standard http://localhost:5174), W/H (Standard 1600×1000), DSF (Pixeldichte, Standard 1)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || 'shots'; mkdirSync(out, { recursive: true });
const times = (process.argv[3] || 'day,evening').split(',');
const base = process.env.BASE_URL || 'http://localhost:5174';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await b.newContext({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 1000) }, deviceScaleFactor: +(process.env.DSF || 1) })).newPage();
page.on('pageerror', (e) => console.log('Seitenfehler:', e.message));
await page.goto(`${base}/?nointro&debug&fixed${process.env.Q ? '&q=' + process.env.Q : ''}`, { waitUntil: 'commit' });
await page.waitForFunction(() => !document.querySelector('#loading'), null, { timeout: 90000 });
await page.addStyleTag({ content: '#cfg,#actions,#viewbar,#toast,.panel{display:none!important}' });
// Kamera-Positionen: Übersicht, Augenhöhe am Becken, Detail Wasser/Rand, Garten-Gegenblick
const cams = {
  uebersicht: [[11, 6.5, 13], [0, -0.3, 0]],
  augenhoehe: [[6.5, 1.65, 6.2], [-1, 0, -0.5]],
  detail: [[2.6, 1.1, 3.2], [0.5, -0.4, 0.3]],
  garten: [[-9, 2.2, -1], [6, 0.8, 2]],
};
for (const t of times) {
  await page.evaluate(async (t) => { const a = window.__app; await a.api.change('time', t); }, t);
  await page.waitForTimeout(1500);
  for (const [name, [p, q]] of Object.entries(cams)) {
    await page.evaluate(([p, q]) => { const a = window.__app; a.controls.autoRotate = false; a.camera.clearViewOffset(); a.camera.position.set(...p); a.controls.target.set(...q); a.controls.update(); a.camera.updateProjectionMatrix(); }, [p, q]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${t}-${name}.png` });
  }
}
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(Math.round(n / ((performance.now() - t0) / 1000))); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
console.log('fps (Fenster, rAF):', fps);
await b.close();
