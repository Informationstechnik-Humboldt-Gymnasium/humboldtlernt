# humboldtlernt – Regeln für Claude-Sitzungen

Lernplattform des Humboldt-Gymnasiums Berlin-Tegel (Node 20+, Express, SQLite, kein Build-Schritt).
Fächer nach dem schulinternen Curriculum (SchiC): **Physik** (Kl. 7–10) und **TIMP** (Wahlpflicht, Kl. 8–9).
Mehrere Personen arbeiten gleichzeitig mit eigenen Claude-Sitzungen am Repo. Halte dich deshalb genau an diese Regeln.

## Zusammenarbeit (wichtig)

- **Nie direkt auf `main` pushen.** Für jede Aufgabe einen eigenen Branch `claude/<thema>` von aktuellem `origin/main` anlegen, committen, pushen und einen Pull Request öffnen. `main` wird automatisch als Testseite (GitHub Pages) veröffentlicht.
- **Vor Beginn und vor dem Pull Request** `git fetch origin main` und auf den neuesten Stand rebasen.
- **Nur in deinem Bereich arbeiten.** Inhalte liegen in eigenen Ordnern (`content/<fach>/klasse-<n>/<themenfeld>/`, `lessons/<slug>/`). Gemeinsame Dateien (`src/`, `server.js`, `public/`, `scripts/`, `test/`, `README.md`, `.github/`) nur ändern, wenn die Aufgabe es verlangt, und die Änderung im Pull Request deutlich nennen.
- **Niemals committen:** `.env`, `data/`, `node_modules/`, `testseite.html`, Schülerlisten oder andere personenbezogene Daten. Keine IServ-Passwörter irgendwo speichern.
- In Produktion gilt `DEV_LOGIN=false`, `SESSION_SECRET` ist zufällig. Daran nichts ändern.

## Befehle

```
npm install          # einmalig
npm run check        # Inhalte prüfen – muss fehlerfrei sein
npm test             # alle Tests – müssen bestehen
npm run testseite    # baut testseite.html (statisch, zum Durchklicken)
DEV_LOGIN=true SESSION_SECRET=test npm start   # lokal mit Test-Login
```

Vor jedem Pull Request: `npm run check` **und** `npm test` ausführen. Bei neuen Inhalten zusätzlich die Testseite im Browser (Playwright, Chromium ist vorinstalliert) durchklicken: keine Konsolenfehler, Desktop-, Handy-Breite (380 px) und Dark Mode ansehen.

## Aufbau

```
content/<fach>/stufen.json                         Fach: "fach", "kurz", "beschreibung", "reihenfolge", Klassenstufen
content/<fach>/klasse-<n>/<tf-ordner>/themenfeld.json   Themenfeld: "nummer", "titel", "beschreibung", "inhalte" (laut SchiC)
content/<fach>/klasse-<n>/<tf-ordner>/<n>-<name>.json   ein Thema pro Datei
lessons/<slug>/index.html + lesson.json            interaktive Erklärung (läuft im iframe)
src/faecher.js        lädt alle Fächer      src/exercises.js  Aufgabentypen und Bewertung
src/views-fach.js     Seiten eines Fachs    src/markup.js     Text-Auszeichnung
```

Ein neues Fach ist nur ein neuer Ordner unter `content/` mit `stufen.json` (Adresse `/<ordnername>`). Wenn du ein Fach oder eine Klassenstufe hinzufügst, ergänze die Liste `SCHIC` in `test/content.test.mjs`.

## Inhalte schreiben

**Vorbild lesen:** z. B. `content/physik/klasse-9/3-06-elektrik/2-ohmsches-gesetz.json` und `content/timp/klasse-9/9-1-informatik/4-schleifen.json`.

Thema:
```
{ "id": "…", "titel": "…", "kurz": "1 Satz", "reihenfolge": 1,
  "lernziele": [{ "id": "lz1", "niveau": "G|H", "text": "…" }],          // 3–5, aus dem SchiC
  "verstehen": { "einstieg": "Alltagsfrage", "abschnitte": [{ "titel": "…", "text": "…" }],
                 "formeln": [{ "formel": "…", "bedeutung": "…" }], "merksatz": "…", "alltag": "…" },
  "interaktiv": ["<slug>"], "vertiefung": ["<slug>"], "uebungen": [ … ] }
```

- **IDs** sind über **alle Fächer** eindeutig (der Fortschritt wird darüber gespeichert) und bestehen nur aus a–z, 0–9, `-`.
  - Physik: Thema `k<klasse>-<name>`, Übungen `k<klasse>-<kürzel>-01`.
  - TIMP: Thema `timp-k<klasse>-<name>`, Übungen `timp-<kürzel>-01`.
  - Neues Fach: eigenes Präfix, z. B. `chemie-k8-…`.
  - Kürzel vorher mit `grep -r '"<präfix>-<kürzel>-' content` auf Eindeutigkeit prüfen.
- **IDs bestehender Themen und Übungen nie ändern oder wiederverwenden**, sonst geht Schülerfortschritt verloren.
- **Übungen:** 7 pro Thema, mindestens je eine `leicht`, `mittel`, `schwer`, jedes Lernziel mindestens einmal (`"lernziel": "lz…"`). Jede Übung hat `erklaerung`, falsche Optionen haben `feedback`.
- **Typen** (Details in `src/exercises.js`):
  - `single`, `multi`
  - `zahl` (mit `rechenweg`, `einheit`; ohne Einheit `""`; exakte Ganzzahlen `"toleranz": 0`; optional `alternativEinheiten`)
  - `text`: Freitext ohne KI, mit `stichworte` [{aspekt, woerter[]}] und `musterloesung`. Die Musterlösung muss alle Aspekte treffen, das prüft ein Test. Wörter werden normalisiert: klein, ä→ae, ö→oe, ü→ue, ß→ss, Teilwort-Treffer. Höchstens 1–2 pro Thema.
  - `zuordnung` (`paare`, optional `extraRechts`)
  - `reihenfolge` (`elemente` in richtiger Reihenfolge)
- **Auszeichnung** (`src/markup.js`):
  - `**fett**`
  - Formel in Backticks `` `R = U / I` ``
  - Index `R_{ges}`, Hochzahl `10^{3}`
  - im JSON `\\frac{a}{b}` und `\\sqrt{x}` (sonst kein LaTeX)
  - Aufzählung: Zeilen mit `- `
  - Absatz: Leerzeile
  - Programmcode im Text: ` ``x = 1`` `
  - Code-Block: eigener Absatz zwischen zwei ```` ``` ````-Zeilen, ohne Leerzeilen darin
- **Informatik-Programme** in der deutschen Scratch-ähnlichen Schreibweise der bestehenden TIMP-Themen (`setze … auf …`, `ändere … um …`, `wiederhole …-mal`, `wiederhole bis …`, `falls … dann … sonst`, `sage …`, `definiere …`). Ausgaben exakt nachrechnen.
- **Fachlich korrekt:** Werte, Einheiten und Formeln prüfen, Rechnungen nachrechnen (z. B. mit `node -e`). g = 9,81 N/kg. Vereinfachungen offen benennen.
- **Sprache:** Deutsch, Du-Form, kurze klare Sätze, für 12- bis 16-Jährige.

## Interaktive Erklärungen (`lessons/<slug>/`)

**Vorbild lesen:** `lessons/k9-ohmsches-gesetz/index.html` sowie `public/lesson-kit.css` und `public/lesson-kit.js`.

- **`lesson.json`:** `{ "title": "…", "subject": "Physik|TIMP|…", "description": "1 Satz", "minutes": 8 }`
- **Einbinden** exakt so, denn die Testseite ersetzt genau diese Tags:
  - `<link rel="stylesheet" href="../../static/lesson-kit.css">`
  - `<script src="../../static/lesson-kit.js"></script>`
- **Keine externen Ressourcen:** nur Vanilla-JS und SVG.
- **Layout:**
  - `<h1>`, kurze Anleitung
  - `.lk-grid`: links Simulation in `.lk-card`, rechts Einstellungen (`.ctrl`, `.row`, `.seg`, `.readouts`)
  - darunter `.lk-card.tasks` „Entdecke selbst“
- **„Entdecke selbst“** mit 4–6 Aufgaben:
  - Ziel-Aufgaben `<div class="task" data-goal="id">`, abgehakt per `LK.reach('id')`, wenn der Zustand wirklich erreicht ist
  - Fragen mit `.choices button[data-ok][data-fb]`
  - am Ende `.all-done`, im h2 `[data-task-count]`
- **Farben** nur über die CSS-Variablen aus `lesson-kit.css`, damit der Dark Mode funktioniert.
- **SVG-Elemente** nie mit `.hidden = …` verstecken, sondern mit `toggleAttribute('hidden', …)`. Keine `vh`-Einheiten.
- **Zahlen und Formeln:** Zahlen mit `LK.fmt(x, stellen)`, Formelzeichen in `<span class="f">`.
- **Bedienung:**
  - touch-tauglich
  - SVG mit `role="img"` und `aria-label`
  - Buttons mit `type="button"`
  - `aria-pressed` bei Umschaltern
- Danach im Thema über `"interaktiv": ["<slug>"]` verlinken.

## Bekannte Eigenheiten

- `/<fach>`-Routen stehen in `server.js` am Ende, feste Adressen (`/admin`, `/lektion`, `/inhalt`, `/api`, `/auth`, `/static`) haben Vorrang. Diese Namen sind als Fachordner verboten.
- Zahleneingaben: „13.734“ wird als Tausender- oder Dezimalpunkt gelesen, je nachdem was zur Lösung passt.
- Der Workflow `.github/workflows/zip-und-testseite.yml` entpackt hochgeladene ZIPs auf `main` und veröffentlicht die Testseite. Nicht ändern ohne Absprache.
