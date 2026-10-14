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
1. **Start:** Wo der Browser GPU-Zeiten liefert (Chrome/Edge/Android), misst eine Kalibrierung hinter dem Preloader und wählt die Start-Auflösung (Ziel ≤ 17 ms GPU).
2. **Laufend:** Median der Bildzeiten aus 30 aktiven Bildern (kein Leerlauf, kein Hintergrund-Tab; einzelne Ruckler zählen nicht). Über 18,7 ms: Auflösung eine Stufe tiefer (1 → 0,9 → 0,8 → 0,72 → 0,65 → 0,58 → 0,52). Danach Stufe „medium“ (AO aus), zuletzt Sparmodus.
3. **Erholung:** Läuft es 7 s rund, wird die Auflösung wieder erhöht (nach einem Fehlversuch 45 s Pause); bei voller Auflösung wird „high“ wieder zugeschaltet.
4. Pixel-Obergrenze 4,6 MP (5K-Displays, große Tablets).

Test (Gerät künstlich 6× langsamer gemacht): Auflösung 100 → 52 %, dann „medium“ bei 80 %, stabile 61 fps; nach Normalisierung zurück auf „high“ 100 % innerhalb von ~70 s.

## Gemessene Browser (Desktop und Gerätegrößen)
Chrome, Firefox, Safari-Engine (WebKit), iPhone 15, iPad Pro 11, Pixel 7: durchgehend 60 fps in „high“ bei voller Auflösung, schlechtester Einzelframe unter 26 ms. Hinweis: gemessen auf schneller Hardware (Apple M1); echte Handys sind nicht getestet.

## Parameter
`?q=high|medium|low` (Start-Stufe), `?scale=0.8` (feste Auflösung), `?fixed` (Regler aus), `?lite` (Sparmodus), `?debug` (Messfunktionen, Zeiten in der Konsole).

## Kein Nachladen, keine Ruckler (Stand Oktober 2026)
- **Alles vor dem ersten Bild:** Texturen, alle Belag-Varianten, Pflanzen-Modelle und alle drei Himmel (Tag, Abend, Nacht) laufen über den Preloader. Nach dem Start werden **keine Dateien mehr geladen** (gemessen: 0 Anfragen in Chrome, Safari-Engine, Firefox).
- **Aufwärmen:** Tageszeiten, Wasserspiegelung je Tageszeit, jede Abdeckung, jeder Rand/Belag und jedes Zubehör werden hinter dem Preloader einmal gezeichnet (Shader, Textur-Upload). Der Start dauert dafür 2–4 s länger, danach gibt es kein Ruckeln beim ersten Umschalten.
- **Rand/Terrasse umstellen** tauscht nur das Material (kein Neubau); Tageszeitwechsel ist ein reines Umschalten.
- **Schlimmster Einzelframe je Aktion** (Tageszeit, 5 Modelle, Rand, Terrasse, Abdeckung, Zubehör, Farbe, Paket, Ansichten): vorher bis 600 ms (Tageszeitwechsel, Safari-Engine), jetzt ≤ 60 ms (ein Frame beim Modellwechsel).
- Regler wird nach Umbauten für ca. 40 Bilder pausiert, damit ein einzelner Umbau nicht die Auflösung senkt.

## Bildfehler („Geisterschleier“, dunkle Fäden)
- AO mit kleinem Radius/engem Abstandsbereich: große Radien erzeugten helle Schleier und dunkle Säume, wo Nahes vor Fernem steht.
- Laubkarten: Farbe unter transparenten Pixeln auf Blattgrün gesetzt (Mipmaps mischten Schwarz in die Blattränder).
- Grashalme: hellere Wurzeln; Himmel: Horizont-Dunst statt schwarzem Baumsaum.

## Geräteklassen (Stand Oktober 2026)
Beim Start misst ein kurzer Grafiktest (`src/devicebench.js`, ca. 0,1 s) 60 alphagetestete Texturschichten bei 0,6 Megapixel. Das Verhältnis zur Referenz (Apple M1 ≈ 4 ms) bestimmt die Klasse:

| Klasse | Verhältnis | typische Geräte (Schätzung, nicht auf Geräten gemessen) | Pixelbudget | Laub (Hecke/Bäume) | Rasen | Schatten | Spiegelung | Start-Effekte |
|---|---|---|---|---|---|---|---|---|
| high | ≥ 0,45 | Laptops/Desktops, iPhone 13–15, aktuelle Spitzen-Androids | 4,6 MP (Handy 2,4 MP) | 100 % (Handy 70 %/65 %) | ja | 4096 (Handy 2048) | 256 (Handy 128) | AO + Glow |
| mid | 0,16–0,45 | iPhone 11/12, Mittelklasse-Androids, ältere Laptops | 1,6 MP | 50 % / 45 % | 3.500 Halme | 2048 | 128 | AO + Glow |
| low | < 0,16 | iPhone 8/X, schwache Androids, Software-Grafik | 0,9 MP | 30 % / 28 % (größere Karten, gleiche Deckung) | aus | 1024 | aus | ohne AO |

Der Leistungsregler (siehe oben) korrigiert zur Laufzeit. Erzwingen zum Testen: `?class=high|mid|low`. **Die Schwellen sind aus Datenblättern abgeleitet und müssen auf echten Geräten bestätigt werden.**

## Weitere Maßnahmen dieser Runde
- **Hecke:** Karten nur noch auf der Innenseite und Oberseite (Außenseite/Enden sind für die Kamera im Grundstück unsichtbar) – ca. 40 % weniger Karten ohne sichtbare Änderung.
- **Pflanzen-Modelle:** 7,1 → 3,0 MB (Geometrie quantisiert + Meshopt, Texturen WebP 92). Bildvergleich alt/neu: mittlere Abweichung < 0,7 von 255, bei Normalansicht < 0,07. Die große Topfpflanze (70.000 Dreiecke) hat ab 7 m Abstand eine Stufe mit 30 % der Dreiecke. Gartenpflanzen sind Instanzen (ein Zeichenaufruf je Teilmesh statt ~40 Klone). Reproduzierbar: `npm run assets`.
- **AR:** ohne Topfpflanzen (vorher gerieten sie unbemerkt mit beiden Detailstufen in die Datei): GLB 3,5 → 1,0 MB, USDZ 9,6 → 2,6 MB.
- **Preloader:** nur Tageshimmel und die gewählten Beläge; Abend/Nacht und übrige Beläge laden danach im Hintergrund, in Ruheschritten (nur wenn keine Eingabe läuft). Wird früh umgeschaltet: kurzer Hinweis, dann Wechsel; jeder Vorbereitungslauf ist dedupliziert (nie doppelt). Start ca. 9 MB statt 17 MB.
- **Aufwärmen:** alle Beleuchtungszustände mit voller Ausstattung, alle Abdeckungen; ohne Sichtfeld-Ausschluss und mit allen LOD-Stufen gezeichnet, damit jede Shader-Variante vorab entsteht. Der erste Tageszeitwechsel kostet 24 statt 95 ms.
- **Wasserspiegelung** wird auf mehrere Bilder verteilt (eine Würfelseite je Bild); das Wasser liegt auf Ebene 1 und muss nie ausgeblendet werden.
- Rasenhalme werden einen Takt nach dem Umbau gebaut; Modellwechsel bleibt unter ca. 50 ms (ein Bild).
- **Fehler behoben:** Preis/Link zeigten nach dem Aufwärmen kurz den Zustand mit allen Extras (Aufwärmen schreibt jetzt nichts mehr in Oberfläche und Link).
- **Bildfehler:** Lichterkette (Kabel 1,3 cm statt 0,6 mm), Sichtschutz (unbeleuchtete Rückwand, matte Lamellen, dunkle Oberseiten gegen helle Striche), leere Zeichenfläche nach Größenänderung (sofortiges Neuzeichnen).
