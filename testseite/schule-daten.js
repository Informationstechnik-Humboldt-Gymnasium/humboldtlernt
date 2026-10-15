// Testseite · Simulierte Schule: Klassen, Lerngruppen, Testkonten, Lehrerzuordnungen und Beispielaufgaben.
// Alle Personen sind erfunden. Die Daten gelten nur für die statische Testseite (GitHub Pages) und landen
// dort ausschließlich im Browser der Person, die die Testseite öffnet.
//
// Passwörter: Lehrkräfte und Administration teilen sich ein gemeinsames Testpasswort. Es steht hier NICHT im
// Klartext, sondern nur als Argon2id-Hash (je Konto mit eigenem, zufälligem Salt; erzeugt mit
// testseite/passwort-hash.mjs). Schülerkonten haben kein Passwort (wie in der Aufgabenstellung verlangt).
(function (root) {
  'use strict';

  var KLASSEN = [
    { id: '9a', name: 'Klasse 9a', typ: 'klasse', stufe: 9 },
    { id: '9b', name: 'Klasse 9b', typ: 'klasse', stufe: 9 },
    { id: '10a', name: 'Klasse 10a', typ: 'klasse', stufe: 10 },
    { id: 'wp-timp-9', name: 'Wahlpflichtkurs TIMP 9', typ: 'kurs', stufe: 9 },
  ];

  // Fächer der Lernseite (gleiche IDs wie die Ordner unter content/)
  var FAECHER = [
    { id: 'physik', name: 'Physik' },
    { id: 'chemie', name: 'Chemie' },
    { id: 'biologie', name: 'Biologie' },
    { id: 'ethik', name: 'Ethik' },
    { id: 'timp', name: 'TIMP' },
  ];

  // s = Schüler/in: [Benutzername, Vorname, Nachname, Klasse, weitere Lerngruppen, Status]
  var SCHUELER = [
    ['lena.hoffmann', 'Lena', 'Hoffmann', '9a', [], 'aktiv'],
    ['jonas.becker', 'Jonas', 'Becker', '9a', ['wp-timp-9'], 'aktiv'],
    ['amira.haddad', 'Amira', 'Haddad', '9a', [], 'aktiv'],
    ['felix.wagner', 'Felix', 'Wagner', '9a', [], 'aktiv'],
    ['mia.schulz', 'Mia', 'Schulz', '9a', ['wp-timp-9'], 'aktiv'],
    ['noah.krueger', 'Noah', 'Krüger', '9a', [], 'aktiv'],
    ['emma.richter', 'Emma', 'Richter', '9b', [], 'aktiv'],
    ['paul.neumann', 'Paul', 'Neumann', '9b', ['wp-timp-9'], 'aktiv'],
    ['sofia.ivanova', 'Sofia', 'Ivanova', '9b', ['wp-timp-9'], 'aktiv'],
    ['ben.hartmann', 'Ben', 'Hartmann', '9b', [], 'aktiv'],
    ['lea.fischer', 'Lea', 'Fischer', '9b', [], 'aktiv'],
    ['leon.schmitt', 'Leon', 'Schmitt', '10a', [], 'aktiv'],
    ['hannah.wolf', 'Hannah', 'Wolf', '10a', [], 'aktiv'],
    ['elias.braun', 'Elias', 'Braun', '10a', [], 'aktiv'],
    ['zeynep.arslan', 'Zeynep', 'Arslan', '10a', [], 'aktiv'],
    ['tim.lorenz', 'Tim', 'Lorenz', '10a', [], 'deaktiviert'],
  ];

  // Lehrkräfte: [Benutzername, Vorname, Nachname, Kürzel, [[Klasse, Fach], …], Klassenleitung]
  var LEHRER = [
    ['sabine.keller', 'Sabine', 'Keller', 'KEL', [['9a', 'physik'], ['9b', 'physik']], '9a'],
    ['murat.yilmaz', 'Murat', 'Yilmaz', 'YIL', [['9a', 'chemie'], ['9b', 'chemie'], ['10a', 'chemie']], null],
    ['julia.brandt', 'Julia', 'Brandt', 'BRA', [['9b', 'biologie'], ['10a', 'biologie'], ['9a', 'ethik']], '10a'],
    ['tobias.novak', 'Tobias', 'Novak', 'NOV', [['wp-timp-9', 'timp'], ['10a', 'physik']], null],
  ];
  var ADMINS = [
    ['petra.lindner', 'Petra', 'Lindner', 'LIN', 'Schulleitung'],
    ['daniel.roth', 'Daniel', 'Roth', 'ROT', 'IT-Betreuung'],
  ];

  // Argon2id (m = 19456 KiB, t = 2, p = 1), je Konto eigener Salt. Reihenfolge: LEHRER, dann ADMINS.
  var HASHES = [
    '$argon2id$v=19$m=19456,t=2,p=1$uWQzrIBYIJJZW5680N/eBw$djKVGD4afNC0cNS6UYjzCJcUih8N2/XaTnSliVD4His',
    '$argon2id$v=19$m=19456,t=2,p=1$PMSx4TEAW7IpTBEdASnB1w$IurNlW7QTjDmF0BdYIXg9a8rapn9ENOuI+SihcLnEiQ',
    '$argon2id$v=19$m=19456,t=2,p=1$AXBdq8A65grrr0eSzwmO6Q$DTGy5ivaGhUKXoKRCsFlpL4xWJ20RRrrl6QZ6SvR2PE',
    '$argon2id$v=19$m=19456,t=2,p=1$NForhIZkIH9Ezb9Kprgc0Q$FSzi8VnNKV+72nHM0zjwnGMdfEOF/ChnLznNPVStH0I',
    '$argon2id$v=19$m=19456,t=2,p=1$02WjMkU6WWf6aieziOfM8A$jstvTqCGXH7Ob62yS7nSXCl+DDNOlCdPfAvtc7DCOhA',
    '$argon2id$v=19$m=19456,t=2,p=1$TkB4IonNy7cnz+bq3tXxPQ$+UbxLEuk5ndwGyd/1IfLXoFVMLYpk3eCt8n0JqlAYpo',
  ];

  var FARBEN = ['#2563a8', '#2f8a4c', '#b4441f', '#7a4fb3', '#b7791f', '#0f7c86', '#a8326e', '#4a5a6a'];

  // Beispielaufgaben. tage = Fälligkeit relativ zum ersten Start der Testseite.
  // ersteller: Benutzername; klassen: [[Klasse, Tage bis fällig], …]
  var AUFGABEN = [
    {
      key: 'ohm-protokoll', ersteller: 'sabine.keller', fach: 'physik', thema: 'k9-ohmsches-gesetz', status: 'veroeffentlicht',
      titel: 'Messprotokoll: Ohmsches Gesetz', schwierigkeit: 'mittel', minuten: 30, punkte: 10,
      beschreibung: 'Werte die Messreihe aus dem Unterricht aus.',
      anweisung: 'Berechne für jede Messung den Widerstand R = U / I. Beschreibe in zwei bis drei Sätzen, was dir an den Ergebnissen auffällt, und erkläre, ob das Bauteil dem ohmschen Gesetz folgt.',
      kriterien: 'Rechnung vollständig (4 P.), Einheiten korrekt (2 P.), Deutung schlüssig (4 P.)',
      hinweise: 'Achte auf die Umrechnung von mA in A.', musterloesung: 'R ist bei allen Messungen etwa 47 Ω. Weil R konstant bleibt, gilt U ~ I – das Bauteil ist ein ohmscher Widerstand.',
      loesungFreigabe: 'nach_korrektur', tags: ['Elektrik', 'Messung'], klassen: [['9a', 5], ['9b', 6]],
    },
    {
      key: 'reihe-parallel', ersteller: 'sabine.keller', fach: 'physik', thema: 'k9-reihe-parallel', status: 'veroeffentlicht',
      titel: 'Übungsblatt Reihen- und Parallelschaltung', schwierigkeit: 'leicht', minuten: 20, punkte: 6,
      beschreibung: 'Bearbeite die Übungen zum Thema auf der Lernseite.',
      anweisung: 'Löse auf der Lernseite mindestens fünf Übungen zum Thema „Reihen- und Parallelschaltung“. Schreibe danach auf, welche Übung dir am schwersten fiel und warum.',
      kriterien: '', hinweise: '', musterloesung: '', loesungFreigabe: 'nie', tags: ['Elektrik'], klassen: [['9a', -2]],
    },
    {
      key: 'saeuren-alltag', ersteller: 'murat.yilmaz', fach: 'chemie', thema: 'ch-k9-saeuren-basen', status: 'veroeffentlicht',
      titel: 'Säuren und Basen im Haushalt', schwierigkeit: 'leicht', minuten: 25, punkte: 8,
      beschreibung: 'Recherche zu Haushaltsprodukten.',
      anweisung: 'Suche zu Hause drei Produkte, die sauer oder basisch sind (Etikett lesen!). Notiere Name, vermuteten pH-Bereich und wofür das Produkt verwendet wird.',
      kriterien: 'Drei Produkte (3 P.), pH-Bereich begründet (3 P.), Sicherheitshinweis (2 P.)', hinweise: 'Nichts mischen, nichts probieren!', musterloesung: '',
      loesungFreigabe: 'nie', tags: ['Säuren', 'Alltag'], klassen: [['9a', 9], ['9b', 9]],
    },
    {
      key: 'ethanol', ersteller: 'murat.yilmaz', fach: 'chemie', thema: 'ch-k10-ethanol', status: 'entwurf',
      titel: 'Steckbrief Ethanol', schwierigkeit: 'mittel', minuten: 30, punkte: 10,
      beschreibung: 'Entwurf – noch nicht veröffentlicht.', anweisung: 'Erstelle einen Steckbrief zu Ethanol: Strukturformel, Eigenschaften, Verwendung, Gefahren.',
      kriterien: '', hinweise: '', musterloesung: '', loesungFreigabe: 'nie', tags: ['Alkohole'], klassen: [],
    },
    {
      key: 'mendel', ersteller: 'julia.brandt', fach: 'biologie', thema: 'bio-k10-mendel', status: 'veroeffentlicht',
      titel: 'Kreuzungsschema Erbsenfarbe', schwierigkeit: 'mittel', minuten: 20, punkte: 6,
      beschreibung: 'Kreuzung zweier mischerbiger Erbsen.',
      anweisung: 'Zwei mischerbige gelbe Erbsen (Gg) werden gekreuzt. Zeichne das Kreuzungsschema und gib das Zahlenverhältnis der Phänotypen an.',
      kriterien: 'Schema korrekt (4 P.), Verhältnis 3 : 1 (2 P.)', hinweise: 'Das BioLab in der Sandbox hilft beim Ausprobieren.', musterloesung: 'GG, Gg, Gg, gg → 3 gelb : 1 grün.',
      loesungFreigabe: 'nach_faelligkeit', tags: ['Genetik'], klassen: [['10a', -1]],
    },
    {
      key: 'immunsystem', ersteller: 'julia.brandt', fach: 'biologie', thema: 'bio-k9-immunsystem', status: 'veroeffentlicht',
      titel: 'Mindmap Immunsystem', schwierigkeit: 'leicht', minuten: 25, punkte: 0,
      beschreibung: 'Ordne die Abwehrmechanismen.', anweisung: 'Erstelle eine Mindmap mit unspezifischer und spezifischer Abwehr. Beschreibe die Mindmap kurz in Textform.',
      kriterien: '', hinweise: '', musterloesung: '', loesungFreigabe: 'nie', tags: ['Immunsystem'], klassen: [['9b', 12]],
    },
    {
      key: 'schleifen', ersteller: 'tobias.novak', fach: 'timp', thema: 'timp-k9-schleifen', status: 'veroeffentlicht',
      titel: 'Programm mit Schleife', schwierigkeit: 'schwer', minuten: 40, punkte: 12,
      beschreibung: 'Ein kleines Programm schreiben.',
      anweisung: 'Schreibe ein Programm in der Scratch-Schreibweise, das die Zahlen von 1 bis 10 addiert und das Ergebnis mit „sage“ ausgibt. Erkläre jede Zeile.',
      kriterien: 'Programm korrekt (6 P.), Erklärung (6 P.)', hinweise: '', musterloesung: 'setze summe auf 0, setze i auf 1, wiederhole 10-mal: ändere summe um i, ändere i um 1; sage summe → 55',
      loesungFreigabe: 'nach_korrektur', tags: ['Programmieren'], klassen: [['wp-timp-9', 3]],
    },
    {
      key: 'alt-induktion', ersteller: 'sabine.keller', fach: 'physik', thema: 'k9-induktion', status: 'archiviert',
      titel: 'Induktion – Versuchsbeschreibung (Vorjahr)', schwierigkeit: 'mittel', minuten: 30, punkte: 8,
      beschreibung: 'Archivierte Aufgabe aus dem Vorjahr.', anweisung: 'Beschreibe den Versuch mit Spule und Magnet.',
      kriterien: '', hinweise: '', musterloesung: '', loesungFreigabe: 'nie', tags: ['Elektromagnetismus'], klassen: [],
    },
    // Zentrale Aufgabenbibliothek (von der Administration freigegeben)
    {
      key: 'bib-energie', ersteller: 'petra.lindner', fach: 'physik', thema: 'k9-leistung-energie', status: 'veroeffentlicht', bibliothek: true,
      titel: 'Stromkosten im Haushalt berechnen', schwierigkeit: 'mittel', minuten: 30, punkte: 10,
      beschreibung: 'Aus der zentralen Aufgabenbibliothek.', anweisung: 'Wähle drei Elektrogeräte bei dir zu Hause. Berechne mit Leistung und Nutzungsdauer die Energie pro Woche und die Kosten bei 0,35 € pro kWh.',
      kriterien: 'E = P · t richtig angewandt (6 P.), Kosten (4 P.)', hinweise: '1 kWh = 1000 W · 1 h', musterloesung: '', loesungFreigabe: 'nie', tags: ['Energie', 'Alltag'], klassen: [],
    },
    {
      key: 'bib-sucht', ersteller: 'petra.lindner', fach: 'biologie', thema: 'bio-k9-sucht', status: 'veroeffentlicht', bibliothek: true,
      titel: 'Plakat: Wie entsteht Sucht?', schwierigkeit: 'leicht', minuten: 45, punkte: 0,
      beschreibung: 'Aus der zentralen Aufgabenbibliothek.', anweisung: 'Gestalte ein Plakat, das erklärt, wie eine Sucht entsteht und wo man Hilfe bekommt. Beschreibe dein Plakat in Stichpunkten.',
      kriterien: '', hinweise: '', musterloesung: '', loesungFreigabe: 'nie', tags: ['Gesundheit'], klassen: [],
    },
    {
      key: 'bib-algorithmus', ersteller: 'daniel.roth', fach: 'timp', thema: 'timp-k9-algorithmen', status: 'veroeffentlicht', bibliothek: true,
      titel: 'Alltagsalgorithmus aufschreiben', schwierigkeit: 'leicht', minuten: 15, punkte: 4,
      beschreibung: 'Aus der zentralen Aufgabenbibliothek.', anweisung: 'Schreibe einen Algorithmus für eine Tätigkeit aus deinem Alltag (z. B. Tee kochen) in nummerierten, eindeutigen Schritten.',
      kriterien: '', hinweise: '', musterloesung: '', loesungFreigabe: 'nie', tags: ['Algorithmen'], klassen: [],
    },
  ];

  // Abgaben der Beispielaufgaben: [Aufgabe, Klasse, Benutzername, Status, Text, Feedback, Punkte]
  var ABGABEN = [
    ['ohm-protokoll', '9a', 'lena.hoffmann', 'korrigiert', 'Messung 1: R = 4,7 V / 0,1 A = 47 Ω, Messung 2: 47 Ω, Messung 3: 46,8 Ω. R bleibt fast gleich, also gilt das ohmsche Gesetz.', 'Sehr sauber gerechnet und gut gedeutet!', 10],
    ['ohm-protokoll', '9a', 'jonas.becker', 'abgegeben', 'R = U/I. Bei allen Messungen kommt ungefähr 47 raus.', null, null],
    ['ohm-protokoll', '9a', 'amira.haddad', 'abgegeben', 'R1 = 47 Ω, R2 = 47 Ω, R3 = 47 Ω. Der Widerstand ist konstant, deshalb ist das ein ohmscher Widerstand.', null, null],
    ['ohm-protokoll', '9a', 'felix.wagner', 'in_arbeit', 'Messung 1: 4,7 / 100 = 0,047', null, null],
    ['ohm-protokoll', '9b', 'emma.richter', 'abgegeben', 'Alle Widerstände liegen bei 47 Ω.', null, null],
    ['reihe-parallel', '9a', 'lena.hoffmann', 'abgegeben', 'Fünf Übungen gelöst. Am schwersten war der Gesamtwiderstand der Parallelschaltung.', null, null],
    ['reihe-parallel', '9a', 'mia.schulz', 'korrigiert', 'Ich habe sechs Übungen gemacht. Schwer war Aufgabe 4.', 'Gut! Schreib beim nächsten Mal genauer, warum sie schwer war.', 4],
    ['saeuren-alltag', '9b', 'sofia.ivanova', 'abgegeben', 'Essigreiniger (sauer, pH 2–3), Seife (basisch, pH 9–10), Rohrreiniger (stark basisch, pH 13).', null, null],
    ['mendel', '10a', 'hannah.wolf', 'korrigiert', 'GG, Gg, Gg, gg → 3 gelb : 1 grün', 'Richtig!', 6],
    ['mendel', '10a', 'leon.schmitt', 'abgegeben', 'Es gibt 3 gelbe und eine grüne.', null, null],
    ['schleifen', 'wp-timp-9', 'paul.neumann', 'abgegeben', 'setze summe auf 0\nsetze i auf 1\nwiederhole 10-mal\n  ändere summe um i\n  ändere i um 1\nsage summe', null, null],
  ];

  // Lernstand der Testschüler: Anteil richtiger Antworten (Stärke) – erzeugt reproduzierbare Übungsversuche
  var STAERKE = {
    'lena.hoffmann': 0.9, 'jonas.becker': 0.6, 'amira.haddad': 0.8, 'felix.wagner': 0.35, 'mia.schulz': 0.7, 'noah.krueger': 0.25,
    'emma.richter': 0.75, 'paul.neumann': 0.55, 'sofia.ivanova': 0.85, 'ben.hartmann': 0.3, 'lea.fischer': 0.65,
    'leon.schmitt': 0.5, 'hannah.wolf': 0.9, 'elias.braun': 0.4, 'zeynep.arslan': 0.7, 'tim.lorenz': 0.5,
  };

  root.SCHULE_DATEN = {
    KLASSEN: KLASSEN, FAECHER: FAECHER, SCHUELER: SCHUELER, LEHRER: LEHRER, ADMINS: ADMINS, HASHES: HASHES, FARBEN: FARBEN,
    AUFGABEN: AUFGABEN, ABGABEN: ABGABEN, STAERKE: STAERKE,
  };
})(typeof window !== 'undefined' ? window : this);
