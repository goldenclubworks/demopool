// Bildprüfung: startet die Seite in mehreren Größen und Pixeldichten und prüft, dass das 3D-Bild NICHT leer/schwarz ist
// (ein Fehler bei Retina-Displays blieb sonst unbemerkt, weil Tests nur mit Pixeldichte 1 liefen).
// Aufruf:  npm run build && npm run preview   (anderes Terminal)   dann:   npm run check:render
// Umgebung: BASE_URL (Standard http://localhost:4173), BROWSERS=chrome,webkit,firefox (Standard chrome; webkit/firefox brauchen `npx playwright-core install`)
import { chromium, webkit, firefox } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:4173';
const want = (process.env.BROWSERS || 'chrome').split(',');
const engines = { chrome: () => chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] }), webkit: () => webkit.launch(), firefox: () => firefox.launch() };
const sizes = [['Desktop 1300×800', { width: 1300, height: 800 }], ['Handy 393×659', { width: 393, height: 659 }], ['Tablet 820×1100', { width: 820, height: 1100 }]];
let bad = 0;
for (const name of want) {
  const b = await engines[name]();
  for (const [sn, vp] of sizes) for (const dsf of [1, 2, 3]) {
    const page = await (await b.newContext({ viewport: vp, deviceScaleFactor: dsf })).newPage();
    let msg;
    try {
      await page.goto(`${base}/?nointro&debug`, { waitUntil: 'commit' });
      await page.waitForFunction(() => !document.querySelector('#loading'), null, { timeout: 60000 }); await page.waitForTimeout(1500);
      const [avg, max] = await page.evaluate(() => { const a = window.__app, c = document.querySelector('#c'); a.post.render(0); const u = c.toDataURL('image/png'), im = new Image(); return new Promise((res) => { im.onload = () => { const k = document.createElement('canvas'); k.width = k.height = 24; const x = k.getContext('2d'); x.drawImage(im, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data; let s = 0, m = 0; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; m = Math.max(m, l); } res([s / 576, m]); }; im.src = u; }); });
      const ok = avg > 25 && max > 120; if (!ok) bad++; msg = `${ok ? 'ok  ' : 'LEER'} Helligkeit ${avg.toFixed(0)}`;
    } catch (e) { bad++; msg = 'FEHLER ' + e.message.split('\n')[0]; }
    console.log(`${name.padEnd(8)} ${sn.padEnd(18)} @${dsf}x  ${msg}`); await page.close();
  }
  await b.close();
}
console.log(bad ? `\n${bad} Probleme` : '\nalle Kombinationen zeigen ein Bild'); process.exit(bad ? 1 : 0);
