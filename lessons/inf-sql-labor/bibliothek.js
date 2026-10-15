// Beispieldatenbank „Schulbibliothek“ für das SQL-Labor.
// Schülerinnen, Schüler und Ausleihen sind ausgedacht. Die Bücher sind echte Jugendbücher;
// angegeben ist das Jahr der Erstausgabe im Original.
(function (root) {
  'use strict';
  root.SQLLab = root.SQLLab || {};
  root.SQLLab.BIBLIOTHEK = {
    tabellen: [
      {
        name: 'schueler',
        beschreibung: 'Schülerinnen und Schüler, die Bücher ausleihen dürfen',
        spalten: [
          { name: 'sid', typ: 'int', pk: true },
          { name: 'vorname', typ: 'text' },
          { name: 'nachname', typ: 'text' },
          { name: 'klasse', typ: 'text' },
        ],
        zeilen: [
          [1, 'Lena', 'Hoffmann', '10a'],
          [2, 'Jonas', 'Becker', '10a'],
          [3, 'Amira', 'Haddad', '10b'],
          [4, 'Felix', 'Wagner', '10b'],
          [5, 'Mia', 'Schulz', '10a'],
          [6, 'Noah', 'Krüger', '10c'],
          [7, 'Emma', 'Richter', '10c'],
          [8, 'Paul', 'Neumann', '10b'],
        ],
      },
      {
        name: 'buch',
        beschreibung: 'Bücher im Bestand der Bibliothek',
        spalten: [
          { name: 'bid', typ: 'int', pk: true },
          { name: 'titel', typ: 'text' },
          { name: 'autor', typ: 'text' },
          { name: 'jahr', typ: 'int' },
          { name: 'genre', typ: 'text' },
        ],
        zeilen: [
          [1, 'Momo', 'Michael Ende', 1973, 'Fantasy'],
          [2, 'Die unendliche Geschichte', 'Michael Ende', 1979, 'Fantasy'],
          [3, 'Krabat', 'Otfried Preußler', 1971, 'Fantasy'],
          [4, 'Tschick', 'Wolfgang Herrndorf', 2010, 'Roman'],
          [5, 'Die Welle', 'Morton Rhue', 1981, 'Roman'],
          [6, 'Emil und die Detektive', 'Erich Kästner', 1929, 'Krimi'],
          [7, 'Das doppelte Lottchen', 'Erich Kästner', 1949, 'Roman'],
          [8, 'Der Hobbit', 'J. R. R. Tolkien', 1937, 'Fantasy'],
          [9, 'Die Tribute von Panem', 'Suzanne Collins', 2008, 'Science-Fiction'],
          [10, 'Wunder', 'R. J. Palacio', 2012, 'Roman'],
        ],
      },
      {
        name: 'ausleihe',
        beschreibung: 'Ausleihen: welcher Schüler welches Buch wann ausgeliehen hat',
        spalten: [
          { name: 'aid', typ: 'int', pk: true },
          { name: 'sid', typ: 'int', fk: 'schueler.sid' },
          { name: 'bid', typ: 'int', fk: 'buch.bid' },
          { name: 'datum', typ: 'text' },
          { name: 'zurueck', typ: 'text' },
        ],
        zeilen: [
          [1, 1, 4, '2026-09-01', 'ja'],
          [2, 1, 1, '2026-09-15', 'nein'],
          [3, 2, 8, '2026-09-03', 'ja'],
          [4, 3, 4, '2026-09-10', 'ja'],
          [5, 3, 9, '2026-09-22', 'nein'],
          [6, 5, 2, '2026-09-05', 'ja'],
          [7, 5, 3, '2026-09-18', 'nein'],
          [8, 5, 6, '2026-09-25', 'nein'],
          [9, 6, 5, '2026-09-12', 'ja'],
          [10, 7, 4, '2026-09-28', 'nein'],
          [11, 8, 10, '2026-10-01', 'nein'],
          [12, 2, 9, '2026-10-02', 'nein'],
        ],
      },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
