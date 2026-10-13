# Pool-Planer 3D (Mustervorlage)

3D-Konfigurator für Schwimmbecken (three.js + Vite). Neutral, ohne Hersteller-Branding, pro Kunde per Link personalisierbar.

- Formen: Rechteck, Rundecken, Oval, Römisch, Niere · Länge 3–16 m, Breite 2–6,5 m, Tiefe 1–2,4 m (ab 1,5 m mit Gefälle)
- Treppe (Ecke/Römer/Breit), Beckenrand (Naturstein/Granit/Beton), Terrasse (Holz/Stein/Beton/Rasen), 5 Beckenfarben
- Abdeckung: offen, Rollladen, Überdachung · Tageszeit: Tag, Abend, Nacht (Poolbeleuchtung)
- Maße, Wasserfläche und Wasserinhalt live
- „Im Garten ansehen (AR)“: Pool 1:1 auf dem Rasen (iOS Quick Look, Android Scene Viewer/WebXR, nur über https). Am Desktop per QR-Code.
- „Anfrage senden“: E-Mail mit Konfiguration und Link. Die Konfiguration steckt im Link (`#cfg=…`) und kann geteilt werden.

```bash
npm install
npm run dev      # Entwicklung (Port 5173)
npm run build    # Produktion -> dist/
npm run preview
```

Hosting: Vercel (Framework „Vite“, Build `npm run build`, Output `dist`) oder jeder statische Webspace mit https.

## Personalisierung per URL

| Parameter | Wirkung | Beispiel |
|---|---|---|
| `firma` | Name im Kopf, „Ihr Pool-Planer“ | `?firma=Schmidt-Pool` |
| `farbe` | Akzentfarbe (Hex) | `&farbe=%230a6ebd` |
| `logo` | Logo (nur https-Bild) | `&logo=https://…/logo.png` |
| `mail` | Empfänger der Anfrage | `&mail=anfrage@schmidt-pool.de` |

Komplett: `https://DEINE-DOMAIN/?firma=Schmidt-Pool&farbe=%230a6ebd&mail=anfrage@schmidt-pool.de`

Debug: `?debug` (setzt `window.__app`), `?fixed` schaltet die adaptive Auflösung ab.

## Hinweise
- In AR wird der Pool flach auf dem Boden gezeigt (Wasser, Rand, Terrasse, Liegen, Abdeckung), weil ein echtes Gelände nicht ausgehoben werden kann.
- Vor dem Verkauf: Impressum/Datenschutz, Lizenzvertrag/AGB und Haftungsausschluss (Visualisierung, Maße unverbindlich) ergänzen und rechtlich prüfen lassen. Drittlizenzen: `LICENSE-THIRD-PARTY.md`.
- Nicht auf echten Geräten getestet: AR (iPhone/Android) – bitte nach dem Hosting prüfen.
