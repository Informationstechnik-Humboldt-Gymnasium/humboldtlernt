# Atom- & Chemielabor – Datengrundlage und Modellgrenzen

Alle Werte stehen in den Dateien `daten-*.js`. Rechen- und Darstellungslogik (`chemie.js`, `molekuel.js`,
`teilchen.js`, `ansicht-*.js`) enthält keine eigenen Messwerte. Fehlende Daten sind `null` und werden in der
Oberfläche ausdrücklich als „nicht bekannt“ oder „im Labor nicht hinterlegt“ angezeigt – sie werden **nie**
geschätzt oder ergänzt.

## Wertarten

| Kennzeichnung in der Oberfläche | Bedeutung |
|---|---|
| tabelliert | aus einer anerkannten Tabelle übernommen (z. B. IUPAC-Atommassen) |
| gemessen | experimentell bestimmter Wert aus einer Datenbank (z. B. NIST) |
| berechnet | im Labor aus Formeln und tabellierten Werten berechnet (Rechenweg sichtbar) |
| vorhergesagt | nur theoretisch berechnet, nicht gemessen (Konfigurationen ab Z = 100) |
| qualitativ | nur Veranschaulichung, keine Zahlenwerte (Teilchenanimation) |

## Dateien und Felder

### `daten-elemente.js`

| Feld | Einheit | Quelle | Art |
|---|---|---|---|
| Symbol, Name | – | IUPAC; deutsche Namen nach GDCh/IUPAC-Empfehlung | tabelliert |
| relative Atommasse Aᵣ | ohne Einheit (= molare Masse in g/mol) | IUPAC/CIAAW, gekürzte Standardatomgewichte (Tabelle 2021); bei Intervallen der Konventionswert | tabelliert |
| `[A]` statt Atommasse | Massenzahl | Massenzahl eines langlebigen Isotops für Elemente ohne Standardatomgewicht | tabelliert, keine Masse |
| Stoffklasse | – | übliche Einteilung im Schulbuch; ab Z = 100 nur aus der Stellung im PSE | Einordnung |
| Zustand bei 20 °C | – | CRC Handbook; `null` = nicht zuverlässig bekannt | tabelliert |
| häufigstes Isotop | Massenzahl | IUPAC-Isotopenhäufigkeiten; `null` = kein natürliches Hauptisotop | tabelliert |
| 1. Ionisierungsenergie | eV | NIST Atomic Spectra Database, nur Z = 1–36 hinterlegt | gemessen |
| Ausnahmen der Elektronenkonfiguration | – | NIST Atomic Spectra Database (Ground States) | gemessen |

Elektronenkonfigurationen werden aus dem Aufbauprinzip (Madelung-Regel) **plus** der NIST-Ausnahmeliste
erzeugt, also nicht pauschal mit einer starren Schalenregel. Ab Z = 100 sind sie als „vorhergesagt“ markiert.
Bei Kationen werden Elektronen zuerst aus der äußersten Unterschale entfernt (Fe²⁺ = [Ar] 3d⁶).

### `daten-nuklide.js`

Quelle: IAEA Live Chart of Nuclides / ENSDF, Halbwertszeiten auf drei gültige Ziffern gerundet.
Bewusst begrenzt: alle stabilen Nuklide von H bis Ca (45 Stück) sowie Fe und Pb, dazu ausgewählte
radioaktive Nuklide aus dem Unterricht (z. B. H-3, C-14, K-40, Co-60, Sr-90, I-131, Cs-137, Rn-222, Ra-226, U-235, U-238).
Für alle anderen Kombinationen zeigt das Labor „keine Daten im Labor“ und behauptet weder Existenz noch Stabilität.
Ausnahme: Liegt ein Kern außerhalb des Bereichs der stabilen Kerne eines Elements, sagt das Labor nur, dass er –
falls es ihn gibt – radioaktiv ist. Das Labor berechnet selbst keine Halbwertszeiten oder Zerfallsraten.

### `daten-stoffe.js`

| Inhalt | Quelle | Art |
|---|---|---|
| Elementarladung, Teilchenmassen, hc | CODATA 2018 (NIST) | tabelliert |
| Na-D-Linien, Hα (Luft) | NIST Atomic Spectra Database | gemessen |
| Schmelz-/Siedetemperatur von Wasser, Ethanol, Sauerstoff, Eisen | CRC Handbook, gerundet, 1013 hPa | tabelliert |
| Bindigkeit und Valenzelektronen (H, C, N, O, F, S, Cl) | Lehrbuchregel für einfache ungeladene Moleküle | Modell |
| Beispielmoleküle (19 Stoffe) | experimentell nachgewiesene Stoffe | tabelliert |
| Bindungswinkel H₂O, H₂S, NH₃, CH₄, CO₂ | NIST CCCBDB (Gasphase) | gemessen |

## Modellgrenzen

- **Bohr-Modell:** Feste Kreisbahnen gibt es nicht; nur die Idee diskreter Energiestufen ist richtig. Das Labor sagt das
  bei jedem Modell dazu. Größen sind nicht maßstäblich.
- **Energiestufen:** `Eₙ = −13,598 eV / n²` gilt nur für Wasserstoff. Berechnete Linien gelten im Vakuum
  (Hα 656,5 nm), gemessene Luftwerte sind etwa 0,2 nm kleiner (656,3 nm).
- **Ionen-Faustregeln** gelten für Hauptgruppenelemente in einfachen Salzen; für Übergangsmetalle zeigt das Labor
  ausdrücklich, dass sie nicht gelten.
- **Teilchenmodell:** Berechnet sind nur T in Kelvin, der Zustand aus Tabellenwerten bei 1013 hPa und das Verhältnis
  der mittleren Geschwindigkeiten `√(T/T₀)`. Abstände und Bewegungen der Punkte sind qualitativ. Dichte, Druck oder
  Geschwindigkeiten in m/s werden nicht angezeigt, weil das Modell sie nicht bestimmen kann.
- **Molekülbaukasten:** feste Bindigkeiten. Drei Stufen: Strukturzeichnung (Bindigkeit verletzt) → plausible Struktur
  (Bindigkeiten erfüllt, Existenz unbekannt) → bekanntes Molekül (im Datensatz). Ausnahmen wie SO₂, CO oder geladene
  Teilchen werden nicht gebaut. Geometrien nach dem Elektronenpaarabstoßungsmodell sind Modellwerte.
- **Formelrechner:** Summenformeln mit Klammern `()`/`[]`, Vorfaktoren, Kristallwasser (`·`, `*`, `.`) und Ladung am
  Ende. Keine Isotopenangaben, Strukturformeln oder Reaktionsgleichungen. Für Elemente ohne Standardatomgewicht wird
  keine molare Masse berechnet. Die Elektronenmasse bei Ionen wird vernachlässigt.

## Lizenz und Nutzung der Quellen

Übernommen wurden nur einzelne, allgemein bekannte Zahlenwerte (Fakten) in gerundeter Form, keine Datenbankauszüge
oder Texte. IUPAC- und NIST-Daten sind für Bildungszwecke frei nutzbar; NIST-Daten sind als Werk der US-Regierung
gemeinfrei. Bei einer Erweiterung des Datensatzes die Nutzungsbedingungen der jeweiligen Quelle erneut prüfen.
