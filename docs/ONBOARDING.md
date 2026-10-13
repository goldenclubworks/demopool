# Neue Firma in ca. 30 Minuten einrichten

Alles, was eine Firma anders hat, steht in **einer JSON-Datei**. Der Konfigurator selbst bleibt unverändert.

1. `public/kataloge/firma-muster.json` kopieren (z. B. `schmidt-pool.json`).
2. Eintragen: `brand` (Name, Farbe, Logo-URL, Mail, Telefon, Adresse, Impressum-/Datenschutz-URL), `models` (Name, Form, Länge, Breite, Tiefe, Treppe, Preis), `liners` (Beckenfarben mit Hex-Wert), optional Preise für Rand, Terrasse, Abdeckung, Extras, Pakete, Finanzierung.
3. Veröffentlichen und aufrufen: `https://DEINE-DOMAIN/?katalog=schmidt-pool` (Datei in `public/kataloge/`) **oder** `?katalog=https://firma.de/pool.json` (Datei auf deren Server, CORS erlaubt).
4. Demo-Link ohne Preise: `&preise=0`. Einbettung: `&embed=1`.

## Felder der Datei (alle optional, fehlende Werte = Standard)
| Feld | Inhalt |
|---|---|
| `brand` | `firma`, `farbe` (#rrggbb), `logo` (https), `mail`, `tel`, `adresse`, `impressum`, `datenschutz`, `lead`, `stats` |
| `text` | `title`, `lead`, `product`, `intro`, `mailSubject` – Beschriftungen (z. B. „Swimspa“) |
| `models` | bis 12: `id`, `name`, `tag`, `shape` (`rect` `round` `oval` `roman` `kidney`), `length`, `width`, `depth`, `steps` (`none` `corner` `roman` `full`), `price` |
| `liners` | `{ id: { name, hex, price } }` |
| `coping` `deck` `cover` `lights` `extras` | Namen und Preise; Schlüssel wie im Standard (`stein granit beton` · `holz stein beton gras` · `none roll roof` · `weiss blau gruen wechsel` · `parasol ladder jet waterfall heatpump planters`). Nicht genannte Extras werden ausgeblendet. |
| `stepPrice` `setup` `loungerPrice` `freePerM2` | Preise für Treppen, Aushub/Technik, Liegen, freie Maße |
| `packages` | Basis/Komfort/Premium: `set` mit `coping`, `deck`, `cover`, `loungers`, `light`, `extras[]` |
| `finance` `ops` | Ratenzahlung (Laufzeit, Zins) und Betriebskosten (Richtwerte) |

Eingaben werden geprüft und begrenzt (Länge, Preise, Texte); ungültige Werte fallen auf den Standard zurück. Mitgeliefert: `spa.json` (Swimspa & Whirlpool) als zweites Beispiel für eine andere Produktart.

## Anfragen (Lead) empfangen
Ohne `brand.lead` läuft der Konfigurator im **Demo-Modus**: Das Formular funktioniert, es wird nichts gesendet, und der Kunde sieht, wie die Anfrage beim Anbieter ankäme. Mit `brand.lead` (https) wird jede Anfrage als JSON per POST gesendet, z. B. an einen **Make-/Zapier-Webhook**, der daraus eine E-Mail, eine Zeile in Google Sheets oder einen CRM-Eintrag macht.

```json
{ "typ": "anfrage", "katalog": "pool", "betreff": "Pool-Anfrage",
  "kunde": { "name": "…", "email": "…", "tel": "…", "plz": "80331", "when": "sofort", "msg": "…" },
  "konfiguration": { "model": "marina", "liner": "blau", "coping": "stein", "deck": "holz", "extras": { "parasol": true, "loungers": 2 } },
  "zusammenfassung": ["Modell: Marina …"], "richtpreis": "ab ca. 48.250 €", "link": "https://…#cfg=…",
  "bild": "data:image/jpeg;base64,…", "bewertung": { "punkte": 88, "stufe": "heiß" }, "zeitpunkt": "2026-10-13T…" }
```

## Statistik und Einbettung
- `brand.stats` (https): anonyme Ereignisse (`start`, `option`, `step`, `package`, `pdf`, `photo`, `lead_open`, `lead_sent`) per `sendBeacon`, ohne Cookies und ohne personenbezogene Daten. So sieht die Auswertung aus: `/dashboard.html` (Beispieldaten).
- Einbettung per iframe: `<iframe src="https://DEINE-DOMAIN/?katalog=firma&embed=1" allow="fullscreen" style="width:100%;height:720px;border:0"></iframe>`. Die Host-Seite erhält die Ereignisse per `postMessage` (`source: "pool-planer"`); personenbezogene Daten nur an die Seite, die den Konfigurator einbettet.

## Rechtliches (vor dem ersten Kunden)
Impressum und Datenschutz des Anbieters verlinken (`brand`), Auftragsverarbeitungsvertrag (AVV) mit jedem Kunden, der Anfragen über den Konfigurator erhält, Haftungsausschluss „Maße und Preise unverbindlich“ (steht in der Oberfläche und im PDF). Lizenzen der Assets: `LICENSE-THIRD-PARTY.md`. Dies ist keine Rechtsberatung.
