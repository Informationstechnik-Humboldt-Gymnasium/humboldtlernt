# Sicherheit des Schulsystems der Testseite – was echt ist und was simuliert

Das Schul-, Rollen- und Aufgabensystem gibt es **nur auf der statischen Testseite** (GitHub Pages, `testseite.html`).
Die echte Lernseite (`server.js`, IServ-Anmeldung, SQLite) ist davon nicht berührt.

GitHub Pages liefert nur Dateien aus. Es gibt **keinen Server**. Alles läuft im Browser der Person, die die Testseite öffnet.
Das hat Folgen, die man kennen muss:

> **Wer die Entwicklerwerkzeuge des Browsers benutzt, kann die simulierte Datenbank im `localStorage` direkt ändern**
> (z. B. sich selbst zur Administration machen). Ein echter Schutz ist ohne Server nicht möglich.
> Die Testseite enthält deshalb ausschließlich erfundene Testdaten und darf nie für echte Schülerdaten genutzt werden.

## Simuliert

| Teil | Wie es simuliert ist |
|---|---|
| IServ-Login (OAuth 2 / OpenID Connect) | Eine eigene, neutral gestaltete Anmeldeseite („Schulserver – Anmeldung (Simulation)“) spielt den Identitätsanbieter. Ablauf wie bei OAuth: zufälliger `state` → Autorisierungscode (einmalig, 60 s gültig) → Rückleitung → Code gegen Sitzung tauschen (`state` muss passen). Es gibt keine Verbindung zu IServ und kein IServ-Logo. |
| Identitätsdaten | Rolle und Gruppen (Klassen/Kurse) kommen als „Claims“ aus der Testdatenbank (`/konto` zeigt sie). Bei einer echten Integration kämen sie verifiziert vom IServ. |
| „Server“ | `testseite/backend.js` ist die einzige Stelle, die Daten liest oder schreibt. Die Oberfläche spricht nur über `api(token, aktion, daten)` damit. |
| Datenbank | JSON im `localStorage` (Schlüssel `lernseite-schule-db`), mit Schema-Version und Migrationen. |

## Tatsächlich umgesetzt (innerhalb dieser Simulation)

- **Argon2id** für Lehrkräfte und Administration. Genutzt wird die gepflegte Bibliothek hash-wasm 4.12.0 (MIT, unverändert in `vendor/`). Ein Test prüft ihre Ergebnisse gegen libargon2.
  - Parameter wie von OWASP empfohlen: m = 19 MiB, t = 2, p = 1.
  - Jedes Konto hat einen eigenen zufälligen 16-Byte-Salt.
  - Das gemeinsame Testpasswort steht **nirgends im Klartext**, weder im Repository noch im Speicher. Die Hashes wurden einmalig mit `passwort-hash.mjs` erzeugt, das Passwort dabei nur als Umgebungsvariable übergeben.
  - Neue Konten werden im Browser mit frischem Salt gehasht.
- **Abweichung von der Vorgabe:** Weil es keinen Server gibt, *müssen* die Hashes mit der Seite ausgeliefert werden, damit das Passwort überhaupt geprüft werden kann. Die Vorgabe „keine Hashes im Frontend“ ist damit nicht erfüllbar. Das Passwort hat 10 zufällige Zeichen, und Argon2id mit diesen Parametern macht Durchprobieren teuer.
- **Zentrale Rechte:** Die Tabelle `RECHTE` legt pro Rolle fest, was erlaubt ist. Jede Aktion nennt genau ein Recht.
  - Zusätzlich prüft jede Aktion, ob sie den richtigen Bereich betrifft: eigene Klasse, eigenes Fach, eigene Aufgabe, eigene Mitteilung.
  - Fremde Aufgaben melden Schüler/innen „nicht gefunden“.
  - Ein Test ruft *jede* Aktion mit *jeder* nicht berechtigten Rolle auf und erwartet `403`.
- **Bei jeder Anfrage geprüft:** ob die Sitzung gültig ist, ob das Konto noch aktiv ist und welche Rolle es aktuell in der Datenbank hat. Die Rolle kommt nie aus dem Token oder einem Formular. Sperren, Deaktivieren, Rollenwechsel und „Sitzungen widerrufen“ wirken sofort.
- **Sitzungen:**
  - Das Token besteht aus 32 Zufallsbytes und liegt im `sessionStorage`.
  - Gespeichert wird nur sein SHA-256-Hash.
  - Eine Sitzung endet nach 60 Minuten Inaktivität (einstellbar) und spätestens nach 8 Stunden.
  - Bei jeder Anmeldung entsteht ein neues Token; ein altes wird verworfen. Das schützt vor Session-Fixation.
- **Rate-Limit:** Höchstens 5 Fehlversuche pro Konto und 20 insgesamt in 15 Minuten.
- **Rollenwechsel:** Die Administration muss dafür ihr eigenes Passwort eingeben.
  - Das eigene Konto und das letzte aktive Administrationskonto sind geschützt.
  - Auffällige Wechsel werden gemeldet, z. B. ein Schülerkonto, das direkt Administration wird, oder drei oder mehr Wechsel in 24 Stunden.
- **Eingaben:** Länge, Typ, Auswahllisten, Datumsformat und Bezüge (Thema passt zum Fach, Klasse existiert, Punkte im erlaubten Bereich) werden in `backend.js` geprüft.
  - Links in Materialien sind nur als Thema, Lektion, Sandbox oder `https:` erlaubt.
  - Alle Ausgaben laufen durch `esc()`.
- **Fehlermeldungen** verraten nichts. Bei falschem Benutzernamen und bei falschem Passwort erscheint dieselbe Meldung. Interne Fehler zeigen keine Details.
- **Protokoll (Audit-Log):** Erfasst werden Sperren und Entsperren, Rollen, Zuordnungen, Aufgaben (Veröffentlichung, Bearbeitung, Sperre, Löschen), Einstellungen, abgelehnte Zugriffe und Anmeldeversuche.
  - Niemals mit Passwort, Token oder Lerninhalten.
  - Lesen darf es nur die Administration.
- **Referentielle Integrität:**
  - Löschen geht nur ohne Abgaben und laufende Zuweisungen; sonst wird archiviert oder gesperrt.
  - Konten werden nie gelöscht, nur deaktiviert.
  - `integritaet()` prüft alle Bezüge und ist im Systemstatus sichtbar.
- **CSRF:** Entfällt. Es gibt keine Cookies und keine Anfragen an einen Server, und das Token wird nie automatisch mitgeschickt.

## Was für einen echten Betrieb fehlen würde

- Das Backend müsste als Server-API laufen (z. B. als Express-Routen in `server.js` mit SQLite) und Sitzungs-Cookies mit `HttpOnly`, `Secure` und `SameSite` verwenden. Die Prüfungen aus `backend.js` lassen sich dafür übernehmen.
- Ein echter IServ-OAuth-Client mit verifizierten Claims (die echte Lernseite hat dafür schon `src/iserv.js`). Ein gemeinsames Passwort für alle Lehrkräfte entfiele dann.
- Die Datenschutzerklärung müsste angepasst werden, bevor echte Personen das System nutzen.
