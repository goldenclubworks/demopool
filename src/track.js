// Cookielose, anonyme Ereignisse (kein Fingerprinting, keine personenbezogenen Daten außer beim ausdrücklich gesendeten Lead).
// - Einbettung (?embed=1): postMessage an die Host-Seite
// - Statistik-Endpunkt der Firma (brand.stats, https): sendBeacon mit JSON
const sink = { url: '', embed: false, catalog: '' };
export const setSink = (s) => Object.assign(sink, s);
const parentOrigin = (() => { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; } })();

/** personal = Daten einer Person (nur an die Host-Seite, wenn deren Herkunft bekannt ist, nie per Beacon) */
export function track(event, data = {}, { personal = false } = {}) {
  const payload = { source: 'pool-planer', event, t: Date.now(), catalog: sink.catalog, ...data };
  if (sink.embed && window.parent !== window) { try { if (!personal || parentOrigin) window.parent.postMessage(payload, personal ? parentOrigin : '*'); } catch { /* egal */ } }
  if (sink.url && !personal) { try { navigator.sendBeacon(sink.url, new Blob([JSON.stringify(payload)], { type: 'application/json' })); } catch { /* egal */ } }
}
