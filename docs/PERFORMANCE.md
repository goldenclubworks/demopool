# Performance-Audit

**Ziel:** immer höchste Qualität („high“), 60 fps. Reicht die Leistung eines Geräts nicht, sinkt **zuerst nur die Auflösung** (stufenweise bis 52 % der vollen Pixeldichte); erst danach werden Effekte reduziert.

## Messmethode
Echte GPU-Zeit je Frame mit Timer-Queries (`EXT_disjoint_timer_query_webgl2`, Chrome, Apple M1, Retina 2600×1600 = 4,2 Megapixel). Debug-Funktion: `?debug&fixed` und in der Konsole `await __app.bench()`.
Einfache Wandzeit-Messungen waren unbrauchbar (Shader-Compile, V-Sync); die Werte unten sind Mediane aus mehreren Läufen.

## Befunde vor der Optimierung (4,2 MP)
| Teil | Kosten |
|---|---|
| 4× MSAA (HalfFloat) | **+100 ms** |
| Standard-Bloom (mipmapBlur) | **+24 ms**, unabhängig von Stufen/Auflösung |
| SMAA | +12 ms |
| AO (N8AO, volle Auflösung) | +19 ms |
| Szene (Rasen 3,1 · Garten 2,0 · Pool 1,3 · Himmel 1,2) | ca. 9,6 ms |
| **Summe „high“ (alt)** | **ca. 74 ms ≈ 13 fps** |

## Maßnahmen
- **MSAA entfernt** (Retina löst Kanten; bei < 1,75 facher Pixeldichte FXAA im selben Durchgang wie Tone-Mapping).
- **Eigener Glow** statt Bloom: 1/4 Auflösung, 8 Abtastungen, 1× getrennt weichzeichnen, Extremwerte begrenzt (kein Flimmern). Nur bei Abend/Nacht aktiv (+0,3 ms).
- **Farbe, Tone-Mapping, Vignette, FXAA in einem Durchgang**; AO in halber Auflösung.
- **Rasen-Shader:** Rauschen aus kleiner Textur statt pro Pixel (−3 ms); Laub mit einfacher Lambert-Beleuchtung; Klarlack am Fliesenbecken entfernt.
- **Garten nur einmal gebaut** (Hecke, Bäume, Beete für die größte Terrasse); Modellwechsel baut nur Sichtschutz/Leuchten neu (290 → 150 ms). Sichtbarkeitsprüfung für Laub-Instanzen.
- **Leerlauf** (keine Eingabe, keine Fahrt): 30 fps, spart Akku und Wärme.
- **Himmel** mit Tiefentest zuletzt gezeichnet (verdeckte Pixel entfallen).

## Ergebnis (gleiche Messung)
| Zustand | 4,2 MP (Retina) | 1,0 MP |
|---|---|---|
| **HIGH Tag** (AO, Glow aus) | **13,2 ms** | **6,7 ms** |
| HIGH Nacht (AO + Glow + AA) | 14,8 ms | 10,0 ms |
| MEDIUM (ohne AO) | 8 ms | 5,6 ms |

## Leistungsregler (src/main.js: `perfStep`, `calibrate`)
1. **Start:** Wo der Browser GPU-Zeiten liefert (Chrome/Edge/Android), misst eine Kalibrierung hinter dem Preloader und wählt die Start-Auflösung (Ziel ≤ 15 ms GPU).
2. **Laufend:** Median der Bildzeiten aus 30 aktiven Bildern (kein Leerlauf, kein Hintergrund-Tab; einzelne Ruckler zählen nicht). Über 18,7 ms: Auflösung eine Stufe tiefer (1 → 0,9 → 0,8 → 0,72 → 0,65 → 0,58 → 0,52). Danach Stufe „medium“ (AO aus), zuletzt Sparmodus.
3. **Erholung:** Läuft es 7 s rund, wird die Auflösung wieder erhöht (nach einem Fehlversuch 45 s Pause); bei voller Auflösung wird „high“ wieder zugeschaltet.
4. Pixel-Obergrenze 4,6 MP (5K-Displays, große Tablets).

Test (Gerät künstlich 6× langsamer gemacht): Auflösung 100 → 52 %, dann „medium“ bei 80 %, stabile 61 fps; nach Normalisierung zurück auf „high“ 100 % innerhalb von ~70 s.

## Gemessene Browser (Desktop und Gerätegrößen)
Chrome, Firefox, Safari-Engine (WebKit), iPhone 15, iPad Pro 11, Pixel 7: durchgehend 60 fps in „high“ bei voller Auflösung, schlechtester Einzelframe unter 26 ms. Hinweis: gemessen auf schneller Hardware (Apple M1); echte Handys sind nicht getestet.

## Parameter
`?q=high|medium|low` (Start-Stufe), `?scale=0.8` (feste Auflösung), `?fixed` (Regler aus), `?lite` (Sparmodus), `?debug` (Messfunktionen, Zeiten in der Konsole).
