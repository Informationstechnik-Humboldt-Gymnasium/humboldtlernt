# HTML-Sandbox

Editor im Stil von VS Code: rechts HTML, CSS und JavaScript schreiben, links sofort das Ergebnis sehen.
Adresse auf der Lernseite: `/sandbox/html`. Auf der Testseite: `#/sandbox/html`.

## Warum kein Monaco?

Die Lernseite lädt nichts von fremden Servern (siehe `CLAUDE.md` und die Datenschutzerklärung, Abschnitt 6).
Darum ist der Editor selbst geschrieben, in Vanilla-JS und ohne CDN. Er läuft auch in der eigenständigen
Testseite (GitHub Pages).

## Dateien

| Datei | Aufgabe |
|---|---|
| `quelltext.js` | HTML-Parser mit Zeichenpositionen (fehlertolerant), CSS-Regeln mit Positionen, Vorschau-Dokument, Zeilenkarte für Fehler, Schleifenschutz. **Ohne DOM.** |
| `werkzeuge.js` | Formatieren (Umschalt+Alt+F), Emmet-Abkürzungen (Tab), Kommentare umschalten. **Ohne DOM.** |
| `hervorheben.js` | Syntax-Hervorhebung für HTML, CSS und JavaScript. **Ohne DOM.** |
| `vorschlaege.js` | Autovervollständigung: Tags, Attribute, CSS-Eigenschaften und -Werte, JavaScript. **Ohne DOM.** |
| `packen.js` | Dateinamen prüfen, ZIP schreiben und lesen, Teilen-Link (komprimiert mit `CompressionStream`). **Ohne DOM.** |
| `vorlage.js` | Startvorlage (kommentiertes Beispiel) und leeres Projekt. Hier passt man den Startcode an. |
| `preview-bridge.js` | Skript, das **in der Vorschau** läuft: Konsole, Fehler, Inspektor, Links, Schleifenabbruch. |
| `editor.js` | Code-Editor: durchsichtiges `<textarea>` über farbigem `<pre>`, dazu Zeilennummern, Minimap, Suchen und Ersetzen. |
| `ide.js` | Oberfläche: Explorer, Projekte, Tabs, Splitter, Vorschau, Konsole, Speichern, ZIP, Teilen, Hilfe. |
| `sandbox.css` | Aussehen. Die Farben beider Designs (dunkel/hell) stehen als Variablen ganz oben. |

Tests: `test/htmlsandbox.test.mjs`.

## So funktioniert „Klick in der Vorschau → Sprung in den Code“

1. `HS.baueVorschau` liest `index.html` mit Positionen ein. In eine **Kopie** für die Vorschau schreibt es in jedes Start-Tag
   `data-src-start` und `data-src-end` (Zeichenpositionen im Original). Der Code im Editor bleibt unverändert.
   `style.css`, `script.js` und Bilder aus dem Projekt werden direkt in diese Kopie eingefügt.
2. Ganz vorn im `<head>` steht die Brücke (`preview-bridge.js`). Sie merkt sich die Positionen jedes Elements und
   entfernt die Attribute wieder. Schülercode sieht sie also nie.
3. Im Inspektor-Modus (oder mit Alt+Klick) schickt die Brücke die Position des angeklickten Elements per `postMessage`
   an den Editor. Bei Elementen, die erst per JavaScript entstanden sind, nimmt sie das nächste Elternelement mit Position.
4. Der Editor öffnet die Datei, setzt den Cursor auf das Start-Tag und hebt den Bereich 1,5 Sekunden lang hervor.
   Unter der Vorschau stehen die passenden CSS-Regeln. Ein Klick darauf springt zur Regel.
5. Umgekehrt: Steht der Cursor in einem Element oder einer CSS-Regel, markiert die Vorschau die passenden Elemente gestrichelt.

## Sicherheit

- Die Vorschau ist ein `<iframe srcdoc="…" sandbox="allow-scripts allow-forms allow-modals">`. Es gibt **kein**
  `allow-same-origin`, kein `allow-popups` und kein `allow-top-navigation`. Schülercode kann die Lernseite, Cookies und
  den Speicher der Lernseite also nicht erreichen. Austausch gibt es nur über `postMessage`.
- `allow-forms` ist nötig, damit `submit`-Ereignisse ankommen. Die Brücke verhindert danach das echte Absenden.
  `allow-modals` erlaubt `alert()`, `prompt()` und `confirm()`. Bei mehr als 15 Dialogen in 10 Sekunden werden weitere unterdrückt.
- Links zu anderen Seiten öffnen sich nicht. Links auf eigene `.html`-Dateien des Projekts wechseln die Vorschau-Seite.
- Schleifen mit `{ … }` werden nach 1,5 Sekunden ununterbrochener Laufzeit abgebrochen (`HS.schleifenSchutz`).
  Friert die Vorschau trotzdem ein, startet die Sandbox beim nächsten Öffnen mit angehaltener Vorschau.

## Speichern und Teilen

- Projekte liegen im `localStorage` (`humboldtlernt-html-sandbox`), Ansicht und Einstellungen getrennt
  (`humboldtlernt-html-sandbox-ansicht`). Je Projekt sind höchstens 30 Dateien erlaubt, Bilder höchstens 300 KB.
- Teilen-Link: `…/sandbox/html#code=v1.…`, auf der Testseite `#/sandbox/html?code=v1.…`. Der Code steht hinter dem `#`
  und wird nicht an den Server geschickt. Wer den Link öffnet, bekommt das Projekt als neue Kopie.
  So können Lehrkräfte Aufgaben mit Startcode verteilen.
- ZIP: Herunterladen speichert unkomprimiert. Öffnen liest auch normale (deflate-)ZIP-Dateien.
