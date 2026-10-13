// Bedienung: geführter Ablauf in 5 Schritten, Modellkarten, Extras, Preisleiste, Zusammenfassung.
import { contourFor } from './pool.js';
import { MODELS, LINERS, STEP_NAMES, STEP_PRICE, COPING, DECK, COVER, TIMES, LIGHTS, EXTRAS, LOUNGER, PACKAGES, TEXT, fmtEur } from './catalog.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const STEPS = [[1, 'Modell'], [2, 'Farbe'], [3, 'Terrasse'], [4, 'Extras'], [5, 'Fertig']];

function outlineSvg(shape, L, W) {
  const pts = contourFor(shape, L, W), xs = pts.map((p) => p.x), zs = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const sx = 100 / (maxX - minX), sz = 44 / (maxZ - minZ), k = Math.min(sx, sz);
  const ox = 60 - ((maxX + minX) / 2) * k, oz = 30 - ((maxZ + minZ) / 2) * k;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(p.x * k + ox).toFixed(1)} ${(p.y * k + oz).toFixed(1)}`).join('') + 'Z';
  return `<svg viewBox="0 0 120 60" aria-hidden="true"><path d="${d}" /></svg>`;
}
const seg = (id, options, current) => `<div class="seg" id="${id}">${Object.entries(options).map(([v, n]) => `<button data-v="${v}" aria-pressed="${String(current) === String(v)}">${n}</button>`).join('')}</div>`;
const fmtM = (v) => v.toFixed(1).replace('.', ',');

export function initUI(api) {
  const { state } = api, body = $('#body');
  const price = (v) => (api.showPrices ? `<small class="p">${fmtEur(v)}</small>` : '');

  /* ---------- Schritte aufbauen ---------- */
  const s1 = `<section class="step" data-step="1"><h2>${esc(TEXT.title)}</h2><p class="lead">${esc(TEXT.lead)}</p>
    <div class="cards" id="o-model">${MODELS.map((m) => `<button class="mc" data-v="${m.id}" aria-pressed="${state.model === m.id}">${outlineSvg(m.shape, m.length, m.width)}<b>${m.name}</b><span>${fmtM(m.length)} × ${fmtM(m.width)} m · ${m.tag}</span>${api.showPrices ? `<em>ab ${fmtEur(m.price)}</em>` : ''}</button>`).join('')}</div>
    ${MODELS.some((m) => m.steps !== 'none') ? `<div class="sec"><div class="lab">Treppe</div>${seg('o-steps', STEP_NAMES, state.steps)}</div>` : '<div hidden id="o-steps"></div>'}
    ${api.free ? `<div class="sec"><div class="lab">Freie Maße</div><label>Länge <output id="v-length"></output></label><input id="s-length" type="range" min="${Math.min(3, ...MODELS.map((m) => m.length))}" max="16" step="0.5"><label>Breite <output id="v-width"></output></label><input id="s-width" type="range" min="${Math.min(2, ...MODELS.map((m) => m.width))}" max="6.5" step="0.25"><label>Tiefe <output id="v-depth"></output></label><input id="s-depth" type="range" min="${Math.min(1, ...MODELS.map((m) => m.depth))}" max="2.4" step="0.1"></div>` : ''}
    <dl class="facts"><dt>Maße</dt><dd id="d-size"></dd><dt>Tiefe</dt><dd id="d-depth"></dd><dt>Wasserfläche</dt><dd id="d-area"></dd><dt>Wasserinhalt</dt><dd id="d-vol"></dd></dl></section>`;
  const s2 = `<section class="step" data-step="2"><h2>Farbe &amp; Beckenrand</h2>
    <div class="sec"><div class="lab">Beckenfarbe</div><div id="o-liner">${Object.entries(LINERS).map(([k, l]) => `<button class="sw" data-v="${k}" title="${l.name}" aria-label="${l.name}" aria-pressed="${state.liner === k}" style="--c:#${l.hex.toString(16).padStart(6, '0')}"></button>`).join('')}</div><p class="note" id="n-liner"></p></div>
    <div class="sec"><div class="lab">Beckenrand</div>${seg('o-coping', Object.fromEntries(Object.entries(COPING).map(([k, v]) => [k, v.name])), state.coping)}</div>
    <div class="sec"><div class="lab">Abdeckung</div>${seg('o-cover', Object.fromEntries(Object.entries(COVER).map(([k, v]) => [k, v.name])), state.cover)}</div></section>`;
  const s3 = `<section class="step" data-step="3"><h2>Terrasse &amp; Garten</h2>
    <div class="sec"><div class="lab">Terrasse</div>${seg('o-deck', Object.fromEntries(Object.entries(DECK).map(([k, v]) => [k, v.name])), state.deck)}</div>
    <div class="sec"><div class="lab">Umgebung</div>${seg('o-garden', { on: 'Mit Garten', off: 'Ohne' }, state.garden ? 'on' : 'off')}</div>
    <div class="sec"><div class="lab">Tageszeit</div>${seg('o-time', TIMES, state.time)}</div></section>`;
  const s4 = `<section class="step" data-step="4"><h2>Extras</h2>${PACKAGES.length ? `<div class="sec"><div class="lab">Ausstattungspaket <small>mit einem Klick</small></div><div class="pk" id="o-pack">${PACKAGES.map((q) => `<button data-v="${q.id}"><b>${esc(q.name)}</b><span>${esc(q.hint)}</span></button>`).join('')}</div></div>` : ''}<div class="extras" id="o-extras">${Object.entries(EXTRAS).map(([k, e]) => `<button class="ex" data-k="${k}" aria-pressed="${!!state.extras[k]}"><span class="tick" aria-hidden="true"></span><span class="t"><b>${e.name}</b><i>${e.hint}</i></span>${price(e.price)}</button>`).join('')}</div>
    <div class="sec"><div class="lab">Liegen ${api.showPrices ? `<small>je ${fmtEur(LOUNGER.price)}</small>` : ''}</div>${seg('o-loungers', { 0: 'Keine', 2: '2 Liegen', 4: '4 Liegen' }, state.extras.loungers)}</div>
    <div class="sec"><div class="lab">Beleuchtung</div>${seg('o-light', Object.fromEntries(Object.entries(LIGHTS).map(([k, v]) => [k, v.name])), state.extras.light)}<p class="note">Am schönsten bei „Abend“ oder „Nacht“ (Schritt 3).</p></div></section>`;
  const s5 = `<section class="step" data-step="5"><h2>Ihre Konfiguration</h2><img id="snap" alt="Ihre Konfiguration" /><ul class="sum" id="sum"></ul>
    <div class="sec" id="sum-price"></div>
    <div id="sum-extra"></div>
    <div class="row"><button class="solid" id="b-final-ask">Unverbindlich anfragen</button><button class="ghost" id="b-pdf">Angebots-PDF</button></div>
    <div class="row"><button class="ghost" id="b-final-ar">Im Garten ansehen (AR)</button><button class="ghost" id="b-save">Bild speichern</button><button class="ghost" id="b-link">Link kopieren</button></div></section>`;
  body.innerHTML = s1 + s2 + s3 + s4 + s5;
  $('#stepper').innerHTML = STEPS.map(([n, l]) => `<button data-s="${n}" aria-label="Schritt ${n}: ${l}"><i>${n}</i><span>${l}</span></button>`).join('');

  /* ---------- Verhalten ---------- */
  const pressIn = (root, test) => root.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(test(b))));
  const bindSeg = (id, onPick) => { const el = $('#' + id); el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pressIn(el, (x) => x === b); onPick(b.dataset.v); refresh(); }); };
  $('#o-model').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pressIn($('#o-model'), (x) => x === b); api.change('model', b.dataset.v); pressIn($('#o-steps'), (x) => x.dataset.v === state.steps); refresh(); });
  bindSeg('o-steps', (v) => api.change('steps', v));
  $('#o-liner').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pressIn($('#o-liner'), (x) => x === b); api.change('liner', b.dataset.v); refresh(); });
  bindSeg('o-coping', (v) => api.change('coping', v));
  bindSeg('o-cover', (v) => api.change('cover', v));
  bindSeg('o-deck', (v) => api.change('deck', v));
  bindSeg('o-garden', (v) => api.change('garden', v === 'on'));
  bindSeg('o-time', (v) => api.change('time', v));
  bindSeg('o-loungers', (v) => api.changeExtra('loungers', +v));
  bindSeg('o-light', (v) => api.changeExtra('light', v));
  $('#o-extras').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); api.changeExtra(k, on); refresh(); });
  function sync() {
    pressIn($('#o-coping'), (x) => x.dataset.v === state.coping); pressIn($('#o-deck'), (x) => x.dataset.v === state.deck); pressIn($('#o-cover'), (x) => x.dataset.v === state.cover);
    pressIn($('#o-loungers'), (x) => +x.dataset.v === state.extras.loungers); pressIn($('#o-light'), (x) => x.dataset.v === state.extras.light);
    $('#o-extras').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(!!state.extras[b.dataset.k])));
  }
  const pack = $('#o-pack'); if (pack) pack.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pressIn(pack, (x) => x === b); api.applyPackage(b.dataset.v); sync(); refresh(); });
  if (api.free) for (const k of ['length', 'width', 'depth']) $('#s-' + k).addEventListener('input', (e) => { api.changeSize(k, +e.target.value); refresh(); });

  let step = 1;
  function setStep(n, { silent = false } = {}) {
    step = Math.max(1, Math.min(5, n));
    body.querySelectorAll('.step').forEach((s) => { s.hidden = +s.dataset.step !== step; });
    $('#stepper').querySelectorAll('button').forEach((b) => { b.setAttribute('aria-current', String(+b.dataset.s === step)); b.classList.toggle('done', +b.dataset.s < step); });
    $('#b-prev').disabled = step === 1;
    $('#b-next').textContent = step === 4 ? 'Zusammenfassung' : step === 5 ? 'Anfragen' : 'Weiter';
    body.scrollTop = 0; closeBreak();
    if (step === 5) fillSummary();
    if (!silent) api.onStep(step);
  }
  $('#stepper').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setStep(+b.dataset.s); });
  $('#b-prev').addEventListener('click', () => setStep(step - 1));
  $('#b-next').addEventListener('click', () => (step === 5 ? api.ask() : setStep(step + 1)));
  $('#b-final-ask').addEventListener('click', () => api.ask());
  $('#b-final-ar').addEventListener('click', () => api.ar());
  $('#b-pdf').addEventListener('click', () => api.pdf());
  $('#b-save').addEventListener('click', () => api.download());
  $('#b-link').addEventListener('click', () => api.copyLink());

  function fillSummary() {
    api.snap().then((url) => { $('#snap').src = url; });
    $('#sum').innerHTML = api.summaryLines().map((l) => `<li>${esc(l)}</li>`).join('');
    const p = api.price();
    $('#sum-price').innerHTML = api.showPrices
      ? `<table class="brk">${p.lines.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${fmtEur(v)}</td></tr>`).join('')}<tr class="tot"><td>Gesamt (Beispielpreis)</td><td>ab ca. ${fmtEur(p.total)}</td></tr></table><p class="note">Beispielpreise zur Veranschaulichung. Verbindliche Preise erhalten Sie im Angebot.</p>`
      : '<p class="note">Das verbindliche Angebot erhalten Sie nach Ihrer Anfrage.</p>';
    const e = api.extraInfo();
    $('#sum-extra').innerHTML = `${e.finance ? `<p class="note"><b>Ratenzahlung (Richtwert):</b> ca. ${Math.round(e.finance.rate).toLocaleString('de-DE')} € pro Monat bei ${e.finance.months} Monaten.</p>` : ''}${e.yearly ? `<p class="note"><b>Laufende Kosten (Richtwert):</b> ca. ${(Math.round(e.yearly / 10) * 10).toLocaleString('de-DE')} € pro Jahr.</p>` : ''}<details class="hints"><summary>Gut zu wissen vor der Planung</summary><ul>${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>`;
  }

  /* ---------- Preisleiste ---------- */
  const priceEl = $('#price'), breakEl = $('#breakdown'), bb = $('#b-break');
  const closeBreak = () => { breakEl.hidden = true; bb.setAttribute('aria-expanded', 'false'); };
  bb.addEventListener('click', () => { const o = breakEl.hidden; breakEl.hidden = !o; bb.setAttribute('aria-expanded', String(o)); });
  document.addEventListener('pointerdown', (e) => { if (!breakEl.hidden && !e.target.closest('#pricebar')) closeBreak(); });
  if (!api.showPrices) bb.hidden = true;

  function refresh() {
    const d = api.dims();
    if (d) {
      $('#d-size').textContent = `${fmtM(state.length)} × ${fmtM(state.width)} m`;
      $('#d-depth').textContent = state.depth <= 1.4 ? `${fmtM(state.depth)} m` : `1,1 – ${fmtM(state.depth)} m`;
      $('#d-area').textContent = `${fmtM(d.area)} m²`; $('#d-vol').textContent = `${fmtM(d.volume)} m³`;
      if (api.free) for (const k of ['length', 'width', 'depth']) { $('#s-' + k).value = state[k]; $('#v-' + k).textContent = fmtM(state[k]) + ' m'; }
      const p = api.price();
      priceEl.textContent = `ab ca. ${fmtEur(p.total)}`;
      breakEl.innerHTML = p.lines.map(([l, v]) => `<div><span>${esc(l)}</span><b>${fmtEur(v)}</b></div>`).join('');
      const ln = LINERS[state.liner].price; $('#n-liner').textContent = ln ? `Aufpreis ${fmtEur(ln)}` : 'Serienfarbe';
    }
    if (step === 5) fillSummary();
  }

  /* ---------- Ansichtsleiste ---------- */
  $('#viewbar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.v;
    if (v === 'spin') { const on = api.spin(); b.setAttribute('aria-pressed', String(on)); return; }
    if (v === 'dims') { const on = api.toggleDims(); b.setAttribute('aria-pressed', String(on)); return; }
    if (v === 'before') { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); api.before(on); return; }
    api.view(v);
  });
  $('#b-panel').addEventListener('click', (e) => { const c = $('#cfg').classList.toggle('collapsed'); e.currentTarget.setAttribute('aria-expanded', String(!c)); e.currentTarget.textContent = c ? 'Konfigurieren ▴' : 'Einklappen ▾'; api.layout(); });

  setStep(1, { silent: true });
  return { refresh, sync, setStep, get step() { return step; } };
}
