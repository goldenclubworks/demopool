// Anfrage (Lead): Formular, Plausibilitätsprüfung, Bewertung, Versand an die Firma (Webhook) oder Demo-Vorschau.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const WHEN = { sofort: 'Sofort (in den nächsten 3 Monaten)', saison: 'In 3–6 Monaten', naechste: 'Nächste Saison', info: 'Ich informiere mich erst' };

export function formHtml({ brand, product, price, showPrices }) {
  const firma = esc(brand.firma || 'dem Anbieter');
  return `<h2>Unverbindlich anfragen</h2>
  <p class="small">Ihre Konfiguration wird mitgesendet. ${showPrices && price ? `Richtwert: <b>ab ca. ${price}</b>.` : ''}</p>
  <form id="lead-form" novalidate autocomplete="on">
    <label class="fld">Name<input name="name" autocomplete="name" required maxlength="80"></label>
    <div class="two"><label class="fld">E-Mail<input name="email" type="email" autocomplete="email" required maxlength="120"></label>
    <label class="fld">Telefon <small>(optional)</small><input name="tel" type="tel" autocomplete="tel" maxlength="30"></label></div>
    <div class="two"><label class="fld">PLZ des ${esc(product)}-Standorts<input name="plz" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5" required></label>
    <label class="fld">Zeitrahmen<select name="when">${Object.entries(WHEN).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label></div>
    <label class="fld">Nachricht <small>(optional)</small><textarea name="msg" rows="2" maxlength="600" placeholder="z. B. Grundstücksgröße, Wünsche, Fragen"></textarea></label>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label class="chk"><input type="checkbox" name="consent" required><span>Ich willige ein, dass meine Angaben und meine Konfiguration zur Bearbeitung meiner Anfrage an ${firma} übermittelt werden. Widerruf jederzeit möglich.${brand.datenschutz ? ` <a href="${esc(brand.datenschutz)}" target="_blank" rel="noopener">Datenschutz</a>` : ''}</span></label>
    <p class="err" id="lead-err" role="alert" hidden></p>
    <div class="row"><button type="button" class="ghost" data-close>Abbrechen</button><button type="submit" class="solid" id="lead-send">Anfrage senden</button></div>
  </form>`;
}

export function readForm(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  const err = [];
  if (!f.name || f.name.trim().length < 2) err.push('Bitte Ihren Namen eingeben.');
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(f.email || '')) err.push('Bitte eine gültige E-Mail-Adresse eingeben.');
  if (!/^\d{5}$/.test(f.plz || '')) err.push('Bitte eine fünfstellige PLZ eingeben.');
  if (f.tel && !/^[+\d][\d\s()/.-]{5,}$/.test(f.tel)) err.push('Die Telefonnummer sieht ungültig aus.');
  if (!f.consent) err.push('Bitte stimmen Sie der Übermittlung zu.');
  return { err, spam: !!f.website, data: { name: (f.name || '').trim(), email: (f.email || '').trim(), tel: (f.tel || '').trim(), plz: f.plz || '', when: f.when in WHEN ? f.when : 'info', msg: (f.msg || '').trim() } };
}

/** Einfache Bewertung für die Firma: heiß / warm / kalt – aus Zeitrahmen, Auftragswert und Kontaktdaten */
export function scoreOf(d, total) {
  let s = { sofort: 45, saison: 30, naechste: 15, info: 5 }[d.when] || 5;
  s += total >= 30000 ? 30 : total >= 20000 ? 22 : total >= 12000 ? 14 : 6;
  if (d.tel) s += 15; if (d.msg.length > 20) s += 10;
  return { punkte: Math.min(100, s), stufe: s >= 75 ? 'heiß' : s >= 50 ? 'warm' : 'kalt' };
}

export function inboxHtml(p, brand) {
  const sc = p.bewertung, col = sc.stufe === 'heiß' ? '#d64545' : sc.stufe === 'warm' ? '#e09a1a' : '#6b7c8a';
  return `<div class="inbox"><div class="ib-head"><b>Neue Anfrage</b><span class="ib-score" style="background:${col}">${sc.stufe} · ${sc.punkte}/100</span></div>
  <p class="ib-meta">An: ${esc(brand.mail || 'anfrage@ihre-firma.de')} · Betreff: ${esc(p.betreff)}</p>
  <div class="ib-body">${p.bild ? `<img src="${p.bild}" alt="Konfiguration">` : ''}<ul><li><b>${esc(p.kunde.name)}</b> · ${esc(p.kunde.email)}${p.kunde.tel ? ' · ' + esc(p.kunde.tel) : ''}</li><li>PLZ ${esc(p.kunde.plz)} · ${esc(WHEN[p.kunde.when])}</li>${p.kunde.msg ? `<li>„${esc(p.kunde.msg)}“</li>` : ''}${p.zusammenfassung.slice(0, 4).map((l) => `<li>${esc(l)}</li>`).join('')}<li><b>${esc(p.richtpreis)}</b></li></ul></div></div>`;
}

/** Versand: brand.lead (https-Webhook, z. B. Make/Zapier/eigene API) – sonst Demo (nichts wird gesendet). */
export async function send(brand, payload) {
  if (!brand.lead) return { mode: 'demo' };
  const body = JSON.stringify(payload);
  try {
    const r = await fetch(brand.lead, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'omit' });
    if (r.ok) return { mode: 'sent' };
    throw new Error(r.status);
  } catch {
    try { await fetch(brand.lead, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body, credentials: 'omit' }); return { mode: 'sent' }; }
    catch { return { mode: 'error' }; }
  }
}
