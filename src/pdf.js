// Angebots-/Projektbrief als PDF (A4, lädt jsPDF erst bei Bedarf). Alles im Browser, es wird nichts versendet.
const hexToRgb = (h) => { const n = parseInt((h || '#1b86c4').replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const eur = (v) => (Math.round(v / 50) * 50).toLocaleString('de-DE') + ' €';

/**
 * ctx: { brand, title, lines[], price: {total, lines}|null, images: [{label, url, w, h}], link, id, notes[], finance: {rate, months, apr}|null, yearly, accent }
 * Rückgabe: jsPDF-Dokument
 */
export async function buildPdf(ctx) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 16, CW = W - 2 * M, accent = hexToRgb(ctx.accent);
  const brandName = ctx.brand.firma || ctx.title;
  let y = 0, page = 1;
  const footer = () => {
    doc.setDrawColor(210); doc.line(M, 284, W - M, 284);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
    const contact = [ctx.brand.firma, ctx.brand.adresse, ctx.brand.tel, ctx.brand.mail].filter(Boolean).join('  ·  ');
    doc.text(contact || 'Unverbindliche Visualisierung (Demo)', M, 289);
    doc.text(`Seite ${page}`, W - M, 289, { align: 'right' });
    doc.text('Unverbindliche Visualisierung. Maße, Preise und Ausführung werden im Angebot bestätigt.', M, 293);
  };
  const newPage = () => { footer(); doc.addPage(); page++; y = 20; };
  const need = (h) => { if (y + h > 278) newPage(); };
  const h2 = (t) => { need(14); y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...accent); doc.text(t, M, y); y += 2; doc.setDrawColor(...accent); doc.setLineWidth(0.4); doc.line(M, y, M + 22, y); y += 5; };

  // Kopf
  doc.setFillColor(...accent); doc.rect(0, 0, W, 5, 'F');
  y = 18; doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 33, 43); doc.text(brandName, M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 107, 120);
  y += 7; doc.text(`Ihre Konfiguration · ${ctx.title}`, M, y);
  doc.text(`${new Date().toLocaleDateString('de-DE')}  ·  Nr. ${ctx.id}`, W - M, y, { align: 'right' });
  y += 6;

  // Bilder
  const imgs = ctx.images;
  if (imgs[0]) { const w = CW, h = Math.min(100, (w * imgs[0].h) / imgs[0].w); doc.addImage(imgs[0].url, 'JPEG', M, y, w, h, undefined, 'FAST'); y += h + 3; }
  if (imgs.length > 1) {
    const w = (CW - 4) / (imgs.length - 1), h = Math.min(58, (w * imgs[1].h) / imgs[1].w);
    imgs.slice(1).forEach((im, i) => doc.addImage(im.url, 'JPEG', M + i * (w + 4), y, w, h, undefined, 'FAST'));
    y += h + 2;
  }

  // Auswahl
  h2('Ihre Auswahl');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 40, 50);
  for (const l of ctx.lines) { const parts = doc.splitTextToSize(l, CW - 4); need(parts.length * 5 + 1); doc.text('•', M, y); doc.text(parts, M + 4, y); y += parts.length * 5 + 0.5; }

  // Preis
  if (ctx.price) {
    h2('Kostenübersicht (Richtwert)');
    doc.setFontSize(9.5);
    for (const [label, v] of ctx.price.lines) { need(6); const t = doc.splitTextToSize(label, CW - 34); doc.setTextColor(30, 40, 50); doc.text(t, M, y); doc.text(eur(v), W - M, y, { align: 'right' }); y += t.length * 4.6 + 0.8; doc.setDrawColor(235); doc.line(M, y - 3.2, W - M, y - 3.2); }
    need(14); y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...accent); doc.text('Gesamt, ab ca. (inkl. MwSt.)', M, y); doc.text(eur(ctx.price.total), W - M, y, { align: 'right' }); y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 107, 120);
    if (ctx.finance) { const t = doc.splitTextToSize(`Ratenzahlung (Richtwert): ca. ${Math.round(ctx.finance.rate).toLocaleString('de-DE')} € pro Monat bei ${ctx.finance.months} Monaten und ${String(ctx.finance.apr).replace('.', ',')} % effektivem Jahreszins. Keine Finanzierungszusage.`, CW); need(t.length * 4.4); doc.text(t, M, y); y += t.length * 4.4 + 1; }
    if (ctx.yearly) { const t = doc.splitTextToSize(`Laufende Kosten (Strom, Chemie, Wasser, Richtwert): ca. ${Math.round(ctx.yearly / 10) * 10} € pro Jahr.`, CW); need(t.length * 4.4); doc.text(t, M, y); y += t.length * 4.4 + 1; }
  }

  // Hinweise
  h2('Gut zu wissen vor der Planung');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 72, 84);
  for (const n of ctx.notes) { const t = doc.splitTextToSize(n, CW - 4); need(t.length * 4.4 + 1); doc.text('•', M, y); doc.text(t, M + 4, y); y += t.length * 4.4 + 1; }
  need(16); y += 3; doc.setFontSize(8.5); doc.setTextColor(120);
  const lk = doc.splitTextToSize(`Ihre Konfiguration online ansehen und anpassen: ${ctx.link}`, CW); doc.text(lk, M, y);
  footer();
  return doc;
}
