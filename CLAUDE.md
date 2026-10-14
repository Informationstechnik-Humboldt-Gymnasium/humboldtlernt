# humboldtlernt – Regeln für Claude-Sitzungen

Lernplattform des Humboldt-Gymnasiums Berlin-Tegel (Node 20+, Express, SQLite, kein Build-Schritt).
Fächer nach dem schulinternen Curriculum (SchiC): **Physik**, **Chemie** und **Biologie** (Kl. 7–10) sowie **TIMP** (Wahlpflicht, Kl. 8–9). Dazu die **Sandbox** mit freien Simulationen (Schaltkreis-, Logik-, Atom- & Chemie- und Netzwerk-Labor).
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

Ein neues Fach ist nur ein neuer Ordner unter `content/` mit `stufen.json` (Adresse `/<ordnername>`).

**Sperren:** `"gesperrt": true` in einer `themenfeld.json` (oder in einem Thema) zeigt die Themen als ausgegraute Karte ohne Link. Seiten und Übungs-API antworten mit 403, und die Themen zählen nicht zum Fortschritt. Zum Freischalten die Zeile entfernen. Derzeit gesperrt: Biologie Kl. 7, Themenfeld 4 (Sexualität). Wenn du ein Fach oder eine Klassenstufe hinzufügst, ergänze die Liste `SCHIC` in `test/content.test.mjs`.

**Sandbox** (`content/sandbox/stufen.json`): Fach ohne Klassenstufen mit `"simulationen"` (`id`, `lesson`, `titel`, `untertitel`, `bereich`, `icon` = Name eines Schaltzeichens aus `SIM_SYMBOLE` in `src/views-fach.js`, z. B. `gleichspannung`, `logikgatter`). Neue Simulation = neuer Eintrag + Ordner `lessons/sandbox-<name>/`. Das Schaltkreis-Labor (`lessons/sandbox-schaltkreis/`) ist in Module geteilt: `modell.js` (Bauteile, Drähte, Speicherformat), `simulation.js` (MNA, Diode, Multimeter), `bedienung.js` (Zeiger/Touch), `zeichnen.js` (SVG), `labor.js` (Oberfläche); Tests in `test/schaltkreis.test.mjs`. Das Logik-Labor (`lessons/sandbox-logik/`): `modell.js`, `simulation.js` (digitale Engine, auch für die Wahrheitstabelle), `wahrheit.js`, `zeichnen.js`, `logik.js`; es nutzt `../sandbox-schaltkreis/bedienung.js` und `labor.css` mit – Änderungen dort in beiden Laboren prüfen. Tests in `test/logik.test.mjs`. Das Atom- & Chemielabor (`lessons/sandbox-chemielabor/`): Quelldaten nur in `daten-*.js` (Herkunft in `DATEN.md`), Rechenlogik ohne DOM in `chemie.js`, `molekuel.js`, `teilchen.js`, je Reiter eine `ansicht-*.js`, Steuerung in `labor.js`; Tests in `test/chemielabor.test.mjs`; der Molecule Builder (Reiter „Moleküle“: `molekuel.js` Modell/Validierung/Erkennung, `aufgaben-molekuel.js`, `ansicht-molekuel.js`) in `test/molekuel.test.mjs`. Keine geschätzten Werte ergänzen – Fehlendes bleibt `null` und wird als unbekannt angezeigt. Das Netzwerk-Labor (`lessons/sandbox-netzwerk/`): `ipv4.js` (Adressen, Subnetze), `modell.js` (Geräte, Kabel, Routen, Speicherformat; gleiche Schnittstelle wie die anderen Labore), `simulation.js` (Hop-für-Hop-Weiterleitung mit Hin- und Rückweg, `pruefeNetz`), `aufgaben.js`, `zeichnen.js`, `netzwerk.js`; es nutzt `../sandbox-schaltkreis/bedienung.js` und `labor.css` mit. Modellgrenzen in `MODELL.md`, Tests in `test/netzwerk.test.mjs`. Das BioLab (`lessons/sandbox-biolab/`): Inhalte nur in `daten-*.js`, Rechenlogik ohne DOM in `optik.js`, `osmose.js`, `genetik.js`, gemeinsame Bausteine in `ui.js`, je Modul eine `modul-*.js` (registriert sich in `BL.module`), Übersicht und Adressen (`#modul/unterbereich`) in `labor.js`; Tests in `test/biolab.test.mjs`. Alle Darstellungen sind Zeichnungen und tragen ein Etikett „Schema“/„Modell“/„Simulation“ – nie als Foto ausgeben. Eigene `.js`/`.css` einer Lektion mit einfachem Dateinamen (`<script src="modell.js"></script>`) oder aus einer anderen Lektion (`../<slug>/datei.js`) einbinden, dann bettet die Testseite sie ein.

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
  - Chemie: Thema `ch-k<klasse>-<name>`, Übungen `ch-<kürzel>-01`. Chemische Formeln mit Unicode-Indizes direkt im Text (H₂O, SO₄²⁻, →), nicht als Formel-Backticks (die sind kursiv).
  - Biologie: Thema `bio-k<klasse>-<name>`, Übungen `bio-<kürzel>-01`. Themenfelder heißen wie im SchiC `1` bis `8` (Themenfeld 4 ist auf Kl. 7 und 10 verteilt).
  - Neues Fach: eigenes Präfix, z. B. `geo-k8-…`.
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

- **Schulsystem der Testseite** (`testseite/`): simulierter IServ-Login, Rollen, Lehrer- und Adminbereich – nur in `testseite.html`, nicht in `server.js`. Daten nur über `testseite/backend.js` (`api(token, aktion, daten)`, Rechte in `RECHTE`), Oberfläche in `ansichten.js`/`app.js`, Tests in `test/testseite-schule.test.mjs`. Das gemeinsame Testpasswort nie im Klartext ablegen (nur Argon2id-Hashes in `schule-daten.js`). Grenzen: `testseite/SICHERHEIT.md`.

- `/<fach>`-Routen stehen in `server.js` am Ende, feste Adressen (`/admin`, `/lektion`, `/inhalt`, `/api`, `/auth`, `/static`, `/impressum`, `/datenschutz`) haben Vorrang. Diese Namen sind als Fachordner verboten.
- **Impressum/Datenschutz:** Angaben in `content/impressum.json`, Texte in `src/rechtliches.js`. Wer ändert, was gespeichert wird (`src/db.js`, IServ-Anmeldung, Cookies, LocalStorage), passt die Datenschutzerklärung mit an.
- Zahleneingaben: „13.734“ wird als Tausender- oder Dezimalpunkt gelesen, je nachdem was zur Lösung passt.
- Der Workflow `.github/workflows/zip-und-testseite.yml` entpackt hochgeladene ZIPs auf `main` und veröffentlicht die Testseite. Nicht ändern ohne Absprache.
