# Pool-Planer 3D (Mustervorlage)

3D-Konfigurator für Schwimmbecken (three.js + Vite). Geführter Ablauf in 5 Schritten, Beispielpreise, Zubehör, Garten-Umgebung, AR. Neutral, ohne Hersteller-Branding, pro Kunde per Link personalisierbar.

1. **Modell** (6 GFK-Modelle als Karten) + Treppe
2. **Farbe** (5 Beckenfarben), Beckenrand, Abdeckung (offen / Rollladen / Überdachung)
3. **Terrasse** (Holz, Stein, Beton, Rasen), Garten ein/aus, Tageszeit (Tag, Abend, Nacht)
4. **Extras**: Sonnenschirm, Leiter, Gegenstromanlage, Wasserfall, Wärmepumpe, Pflanzkübel, Liegen, Beleuchtungsfarbe
5. **Fertig**: Bild, Zusammenfassung, Preisaufschlüsselung, Anfrage per E-Mail, Bild speichern, Link kopieren, AR

Dazu: Einstiegsfahrt (Kamera fährt heran, Wasser läuft ein), Ansichten (Außen, Von oben, Nah, Rundflug, Vorher ohne Pool), Maßanzeige am Pool, Live-Preis, Kaustik-Licht im Becken, Poolbeleuchtung bei Nacht, AR 1:1 (iOS Quick Look, Android Scene Viewer/WebXR, nur über https; am Desktop per QR-Code).

```bash
npm install
npm run assets   # lädt die CC0-Texturen/HDRIs/Modelle nach public/ (bereits eingecheckt, nur zum Erneuern)
npm run dev      # Entwicklung (Port 5173)
npm run build    # Produktion -> dist/
npm run preview
```

Hosting: Vercel (Framework „Vite“, Build `npm run build`, Output `dist`) oder jeder statische Webspace mit https.

## Für eine Firma anpassen: Katalog-Datei (kein Code nötig)
Siehe **[docs/ONBOARDING.md](docs/ONBOARDING.md)**: Marke, Modelle, Farben, Preise, Pakete und Endpunkte in einer JSON (`?katalog=<name>` oder `?katalog=https://…`). Mitgeliefert: `firma-muster` (Beispiel für eine Firma) und `spa` (Swimspa & Whirlpool). Die Standardwerte stehen in `src/catalog.js`.

## Für eine Poolfirma anpassen: `src/catalog.js` (Standardwerte)
Dort stehen **alle Modelle, Optionen und Preise** (Beispielwerte):
- `MODELS`: Name, Form (`rect`, `round`, `oval`, `roman`, `kidney`), Länge, Breite, Tiefe, Treppe, Preis
- `LINERS`, `COPING`, `DECK`, `COVER`, `LIGHTS`, `EXTRAS`: Namen und Preise
- `SETUP`: Preis für Aushub/Einbau und Technik
Firmenname, Farbe, Logo und Anfrage-Adresse kommen per Link (siehe unten). Weitere Beckenformen/Geometrie: `src/pool.js`.

## Personalisierung und Schalter per URL

| Parameter | Wirkung | Beispiel |
|---|---|---|
| `firma` | Name im Kopf, „Ihr Pool-Planer“ | `?firma=Schmidt-Pool` |
| `farbe` | Akzentfarbe (Hex) | `&farbe=%230a6ebd` |
| `logo` | Logo (nur https-Bild) | `&logo=https://…/logo.png` |
| `mail` | Empfänger der Anfrage | `&mail=anfrage@schmidt-pool.de` |
| `preise=0` | Preise ausblenden | `&preise=0` |
| `frei=1` | zusätzlich freie Maße per Schieberegler | `&frei=1` |
| `nointro` | Einstiegsfahrt überspringen | `&nointro` |
| `lite` | Sparmodus erzwingen (kein Wolken-Himmel, keine Schatten) | `&lite` |

Komplett: `https://DEINE-DOMAIN/?firma=Schmidt-Pool&farbe=%230a6ebd&mail=anfrage@schmidt-pool.de`
| `q` | Grafikqualität erzwingen: `high` (AO, 4× MSAA), `medium` (AO halbe Auflösung), `low` (kein AO/Bloom) | `&q=medium` |

| `katalog` | Firmen-Datei (Name oder https-URL) | `&katalog=spa` |
| `embed=1` | Einbettung (für iframe), Ereignisse per `postMessage` | `&embed=1` |
| `lead`, `stats` | Endpunkte (https) für Anfragen und anonyme Statistik | `&lead=https://…` |

Debug: `?debug` (setzt `window.__app`), `?fixed` schaltet die adaptive Auflösung ab. Die Konfiguration steckt im Link (`#cfg=…`) und kann geteilt werden.

## Dateien
`src/main.js` (Szene, Zustand, AR) · `src/ui.js` (Ablauf, Preisleiste) · `src/catalog.js` (Modelle/Preise) · `src/pool.js` (Becken) · `src/extras.js` (Zubehör) · `src/garden.js` (Umgebung: Hecke, Sichtschutz, Bäume; kein Gebäude, Kamera bleibt im Grundstück) · `src/materials.js` (Mosaik-Becken, Wasser, Stein, Holz, Rasen) · `src/assets.js` (CC0-Texturen, HDRI, glTF) · `src/post.js` (AO, Bloom, Tone-Mapping) · `src/foliage.js` (Hecken, Bäume aus Blatt-Karten) · `src/textures.js` (prozedurale Texturen: Fliesen, Wellen, Laub)

## Bedienung (Maus und Touch)
Ziehen = drehen · Scrollen / zwei Finger = zoomen · Doppeltippen/Doppelklick = Standardansicht. Verschieben (Pan) ist bewusst aus, damit man sich nicht verirrt. Kamerafahrten laufen als Bogen um den Pool; wer währenddessen zieht, übernimmt sofort.

## Verkaufs- und B2B-Funktionen
- **Anfrage-Formular** mit Plausibilitätsprüfung, Einwilligung, Spam-Schutz und automatischer Bewertung (heiß/warm/kalt); ohne Endpunkt Demo-Vorschau „so kommt die Anfrage an“.
- **Angebots-PDF** (A4, Logo-Farbe, 3 Ansichten, Auswahl, Kostenübersicht, Ratenzahlung, Betriebskosten, Planungshinweise) – erzeugt im Browser.
- **Ausstattungspakete** Basis / Komfort / Premium, Ratenzahlung und Betriebskosten als Richtwerte.
- **Mein Foto:** eigenes Gartenfoto hochladen, Becken maßstäblich darauf verschieben, drehen, Sonne und Horizont anpassen (Foto bleibt im Browser).
- **Statistik-Muster** unter `/dashboard.html`; Einbettung und Marken-Datei siehe oben.
- **Tests:** `npm test` (Geometrie aller Modelle, Preislogik, Katalog-Prüfung, Lead-Bewertung).

## Preloader und Datenschutz
Vor dem ersten Bild lädt ein Preloader mit Prozentanzeige alle nötigen Dateien (Boden, Terrasse, Himmel); erst dann erscheint die Szene, so gibt es keinen schwarzen Boden mehr. Pflanzen-Modelle, weitere Beläge und die übrigen Tageszeiten laden danach leise im Hintergrund (ca. 7 MB vorab statt vorher 32 MB). Der Konfigurator verwendet **nur eigene Dateien**: keine externen Server oder Schriften, keine Cookies, kein localStorage/sessionStorage/IndexedDB, kein Tracking (gemessen im Test). Das gilt auch für die Foto-Funktion (das Foto bleibt im Browser). Statistik und Anfragen werden nur gesendet, wenn eine Firma dafür Adressen hinterlegt. Hinweis: Wird auf Vercel „Web Analytics“ oder „Speed Insights“ eingeschaltet, ist das eine eigene Datenverarbeitung und gehört in die Datenschutzerklärung. Keine Rechtsberatung.

## Layout
Breit (Desktop, Tablet quer): Bedienfeld links, Szene wird in den freien Bereich verschoben. Schmal oder hochkant (Handy, Tablet): kompaktes Sheet unten (max. 46 % der Höhe), Szene und Kamera rahmen nur den sichtbaren Bereich. Tippen auf die Szene klappt das Sheet ein; „Zusätzlich“ fährt die Kamera bei Gegenstromanlage und Überdachung auf die passende Seite.

## Optik
Foto-HDRI als Himmel und Beleuchtung (Tag, Abend, Nacht; Sonne wird aus dem Bild gelesen), PBR-Materialien (Mosaikfliesen mit Fugen und Glasur, Natursteinplatten einzeln mit Fugen, Holzdielen, Rasen), Wasser mit Fresnel-Spiegelung, Wellen, Lichtmuster und Tiefenfärbung, Ambient Occlusion (N8AO), Bloom, Vignette. Hecken und Bäume bestehen aus tausenden instanziierten Blatt-Karten.

## Performance
HDRI-Kulisse, adaptive Qualität (high → medium → low, dann Auflösung und Sparmodus), auf Handys kleinere Schattenkarte, 2 statt 4 Poolleuchten, Auflösung max. 1,5×, im Leerlauf nur jedes zweite Bild, adaptive Auflösung und Sparmodus bei dauerhaft niedriger Bildrate, Garten wird nur bei geänderter Beckengröße neu gebaut.

## Hinweise
- In AR liegt der Pool flach auf dem Boden (Wasser, Rand, Terrasse, Liegen, Schirm, Kübel, Abdeckung), weil ein echtes Gelände nicht ausgehoben werden kann.
- Preise sind Platzhalter. Vor dem Verkauf: Impressum/Datenschutz, Lizenzvertrag/AGB und Haftungsausschluss rechtlich prüfen lassen. Drittlizenzen: `LICENSE-THIRD-PARTY.md`.
- Nicht auf echten Geräten getestet: AR (iPhone/Android) – bitte nach dem Hosting prüfen.
