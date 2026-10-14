# Schul-, Rollen- und Aufgabensystem (nur Testseite)

Dieses System läuft ausschließlich auf der statischen Testseite (GitHub Pages). `scripts/build-testseite.mjs` bettet es in `testseite.html` ein.
Die echte Lernseite (`server.js`) ist davon nicht betroffen. Grenzen und Sicherheitsmaßnahmen stehen in [SICHERHEIT.md](SICHERHEIT.md).

## Ausprobieren

```
npm run testseite        # baut testseite.html
# testseite.html im Browser öffnen → „Anmelden“ → „Mit IServ anmelden“
```

- **Schüler/innen** melden sich ohne Passwort an.
- **Lehrkräfte und Administration** brauchen das gemeinsame Testpasswort. Es wird von der Projektleitung vergeben und steht in keiner Datei.
- **Gastmodus:** „Ohne Anmeldung ausprobieren“ verhält sich wie die bisherige Testseite.
- **Daten:** Alles bleibt nur in diesem Browser. Unter Verwaltung → System lassen sich die Testdaten zurücksetzen.

| Rolle | Konten |
|---|---|
| Schüler/innen | 9a: Lena Hoffmann, Jonas Becker, Amira Haddad, Felix Wagner, Mia Schulz, Noah Krüger · 9b: Emma Richter, Paul Neumann, Sofia Ivanova, Ben Hartmann, Lea Fischer · 10a: Leon Schmitt, Hannah Wolf, Elias Braun, Zeynep Arslan, Tim Lorenz (deaktiviert) · Kurs WP TIMP 9: Jonas, Mia, Paul, Sofia |
| Lehrkräfte | Sabine Keller (Physik 9a, 9b; Klassenleitung 9a) · Murat Yilmaz (Chemie 9a, 9b, 10a) · Julia Brandt (Biologie 9b, 10a; Klassenleitung 10a) · Tobias Novak (TIMP-Kurs, Physik 10a) |
| Administration | Petra Lindner (Schulleitung) · Daniel Roth (IT-Betreuung) |

Alle Personen sind erfunden.

## Dateien

| Datei | Inhalt |
|---|---|
| `schule-daten.js` | Startdaten: Klassen, Kurse, Konten, Lehrerzuordnungen, Beispielaufgaben und -abgaben, Argon2id-Hashes |
| `backend.js` | Simulierter Server: Datenbank und Migrationen, OAuth-Simulation, Sitzungen, zentrale Rechte (`RECHTE`), alle Aktionen, Benachrichtigungen, Protokoll. Kein DOM. |
| `ansichten.js` | HTML-Bausteine der Seiten für Schüler/innen, Lehrkräfte und Administration |
| `app.js` | Routen (`#/aufgaben`, `#/lehrer/…`, `#/admin/…`), Formulare, Aktionen, Anmeldeablauf |
| `schule.css` | Ergänzungen zu `public/style.css` (gleiche Variablen, Hell/Dunkel) |
| `vendor/argon2.umd.min.js` | hash-wasm 4.12.0 (MIT, unverändert, Lizenz daneben) |
| `passwort-hash.mjs` | Erzeugt Argon2id-Hashes: `TEST_PASSWORT='…' node testseite/passwort-hash.mjs 6` |

**Tests:** `test/testseite-schule.test.mjs` deckt die 17 geforderten Fälle ab. Mit gesetztem `TEST_PASSWORT` prüft der Test zusätzlich, dass die ausgelieferten Hashes zum echten Testpasswort passen.

## Datenmodell (Tabellen in `lernseite-schule-db`)

`users` (Rolle, Status, Kennung, Argon2id-Hash) · `klassen` (Klassen und Kurse, Klassenleitung) · `mitgliedschaften` · `lehrerzuordnungen` (Lehrkraft × Klasse × Fach) · `faecher` (mit Lernbereichen) · `aufgaben` (Entwurf/veröffentlicht/archiviert, gesperrt, ausgeblendet, Bibliothek, Vorlage, Verlauf) · `zuweisungen` · `abgaben` · `feedback` · `benachrichtigungen` · `ankuendigungen` · `materialien` · `foerderhinweise` · `lernstand` (Übungsversuche je Konto) · `audit` · `anmeldeversuche` · `sitzungen` (nur Token-Hashes) · `oauthCodes` · `einstellungen`

**Migration hinzufügen:** In `backend.js` `VERSION` erhöhen und unter `MIGRATIONEN[neueVersion]` eine Funktion ergänzen, die die alten Daten umbaut. Löschen ist dabei nicht vorgesehen.
