// Tests für das Fach Informatik: SQL-Engine des SQL-Labors (lessons/inf-sql-labor/sql.js) mit der Beispieldatenbank
// „Schulbibliothek“ und die Übereinstimmung der SQL-Übungen mit den tatsächlichen Abfrageergebnissen.
// Die Engine läuft wie im Browser (ohne DOM) in einer VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
for (const f of ['sql.js', 'bibliothek.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'lessons/inf-sql-labor', f), 'utf8'), ctx, { filename: f });
}
const { Datenbank, BIBLIOTHEK, gleichesErgebnis } = ctx.SQLLab;
const plain = x => JSON.parse(JSON.stringify(x));
const neu = () => new Datenbank(BIBLIOTHEK);
function sel(db, q) {
  const r = plain(db.ausfuehren(q));
  assert.ok(!r.fehler, `${q}\n→ ${r.fehler}`);
  return r;
}
function fehler(db, q) {
  const r = plain(db.ausfuehren(q));
  assert.ok(r.fehler, `Erwartet Fehler für: ${q}`);
  return r.fehler;
}
const spalte = (r, i = 0) => r.zeilen.map(z => z[i]);

test('Beispieldatenbank: Tabellen, Schlüssel und Fremdschlüssel sind stimmig', () => {
  const db = neu();
  for (const t of BIBLIOTHEK.tabellen) {
    assert.ok(t.spalten[0].pk, `${t.name}: erste Spalte ist Primärschlüssel`);
    const ids = t.zeilen.map(z => z[0]);
    assert.equal(new Set(ids).size, ids.length, `${t.name}: Primärschlüssel eindeutig`);
    for (const z of t.zeilen) assert.equal(z.length, t.spalten.length, `${t.name}: Zeile ${z[0]} vollständig`);
  }
  // Jeder Fremdschlüssel verweist auf einen vorhandenen Datensatz
  const leer = sel(db, 'SELECT aid FROM ausleihe WHERE sid NOT IN (1, 2, 3, 4, 5, 6, 7, 8) OR bid < 1 OR bid > 10');
  assert.equal(leer.zeilen.length, 0);
  assert.deepEqual(spalte(sel(db, 'SELECT COUNT(*) FROM schueler')), [8]);
  assert.deepEqual(spalte(sel(db, 'SELECT COUNT(*) FROM buch')), [10]);
  assert.deepEqual(spalte(sel(db, 'SELECT COUNT(*) FROM ausleihe')), [12]);
});

test('SELECT: Spalten, WHERE, AND/OR/NOT, LIKE, BETWEEN, IN, DISTINCT, ORDER BY, LIMIT', () => {
  const db = neu();
  const alle = sel(db, 'select * from buch;');
  assert.deepEqual(alle.spalten, ['bid', 'titel', 'autor', 'jahr', 'genre']);
  assert.equal(alle.zeilen.length, 10);
  assert.deepEqual(spalte(sel(db, "SELECT titel FROM buch WHERE genre = 'Fantasy' AND jahr > 1970")), ['Momo', 'Die unendliche Geschichte', 'Krabat']);
  assert.equal(sel(db, "SELECT * FROM buch WHERE genre = 'Fantasy' OR jahr > 2000").zeilen.length, 7);
  assert.deepEqual(spalte(sel(db, "SELECT titel FROM buch WHERE NOT genre = 'Roman' AND jahr < 1950")), ['Emil und die Detektive', 'Der Hobbit']);
  assert.deepEqual(spalte(sel(db, "SELECT titel FROM buch WHERE titel LIKE 'die %'")), ['Die unendliche Geschichte', 'Die Welle', 'Die Tribute von Panem']);
  assert.deepEqual(spalte(sel(db, "SELECT titel FROM buch WHERE titel LIKE '_omo'")), ['Momo']);
  assert.deepEqual(spalte(sel(db, 'SELECT titel FROM buch WHERE jahr BETWEEN 1970 AND 1980 ORDER BY jahr DESC')), ['Die unendliche Geschichte', 'Momo', 'Krabat']);
  assert.deepEqual(spalte(sel(db, "SELECT vorname FROM schueler WHERE klasse IN ('10c') ORDER BY vorname")), ['Emma', 'Noah']);
  assert.equal(sel(db, 'SELECT DISTINCT autor FROM buch WHERE jahr < 1980').zeilen.length, 4);
  assert.deepEqual(spalte(sel(db, "SELECT vorname, nachname FROM schueler WHERE klasse = '10a' ORDER BY nachname"), 1), ['Becker', 'Hoffmann', 'Schulz']);
  assert.deepEqual(spalte(sel(db, 'SELECT titel AS t FROM buch ORDER BY t LIMIT 2')), ['Das doppelte Lottchen', 'Der Hobbit']);
  assert.deepEqual(spalte(sel(db, 'SELECT titel, jahr FROM buch ORDER BY 2 LIMIT 1')), ['Emil und die Detektive']);
  // Groß-/Kleinschreibung: = unterscheidet, LIKE nicht; Zahlen in Texten werden verglichen
  assert.equal(sel(db, "SELECT * FROM buch WHERE genre = 'fantasy'").zeilen.length, 0);
  assert.equal(sel(db, "SELECT * FROM buch WHERE genre LIKE 'fantasy'").zeilen.length, 4);
  assert.equal(sel(db, "SELECT * FROM buch WHERE jahr > '2000'").zeilen.length, 3);
  // Rechnen, ganzzahlige Division wie in SQLite, Funktionen
  assert.deepEqual(sel(db, 'SELECT 7 / 2, 7.0 / 2, 7 % 3, 2 + 3 * 4 FROM buch LIMIT 1').zeilen[0], [3, 3.5, 1, 14]);
  assert.deepEqual(sel(db, "SELECT UPPER(titel), LENGTH(titel) FROM buch WHERE bid = 1").zeilen[0], ['MOMO', 4]);
});

test('Aggregatfunktionen, GROUP BY und HAVING', () => {
  const db = neu();
  assert.deepEqual(sel(db, 'SELECT COUNT(*), MIN(jahr), MAX(jahr), SUM(jahr), AVG(jahr) FROM buch').zeilen[0], [10, 1929, 2012, 19749, 1974.9]);
  assert.deepEqual(spalte(sel(db, "SELECT COUNT(*) FROM ausleihe WHERE zurueck = 'nein'")), [7]);
  assert.deepEqual(spalte(sel(db, 'SELECT COUNT(DISTINCT sid) FROM ausleihe')), [7]);
  assert.deepEqual(spalte(sel(db, "SELECT COUNT(*) FROM buch WHERE genre = 'Gibtsnicht'")), [0]);
  assert.deepEqual(plain(sel(db, 'SELECT genre, COUNT(*) AS anzahl FROM buch GROUP BY genre ORDER BY anzahl DESC, genre').zeilen),
    [['Fantasy', 4], ['Roman', 4], ['Krimi', 1], ['Science-Fiction', 1]]);
  assert.deepEqual(plain(sel(db, 'SELECT klasse, COUNT(*) FROM schueler GROUP BY klasse ORDER BY klasse').zeilen), [['10a', 3], ['10b', 3], ['10c', 2]]);
  assert.deepEqual(plain(sel(db, 'SELECT autor, COUNT(*) FROM buch GROUP BY autor HAVING COUNT(*) > 1').zeilen), [['Michael Ende', 2], ['Erich Kästner', 2]]);
  assert.deepEqual(spalte(sel(db, 'SELECT genre FROM buch GROUP BY genre ORDER BY COUNT(*) DESC, genre DESC LIMIT 1')), ['Roman']);
});

test('Verknüpfungen: Kreuzprodukt, WHERE-Verknüpfung, JOIN … ON über drei Tabellen, Kurznamen', () => {
  const db = neu();
  assert.deepEqual(spalte(sel(db, 'SELECT COUNT(*) FROM buch, ausleihe')), [120]);
  assert.equal(sel(db, 'SELECT * FROM buch, ausleihe WHERE buch.bid = ausleihe.bid').zeilen.length, 12);
  const mia = "SELECT buch.titel FROM schueler JOIN ausleihe ON schueler.sid = ausleihe.sid JOIN buch ON ausleihe.bid = buch.bid WHERE vorname = 'Mia'";
  assert.deepEqual(spalte(sel(db, mia)), ['Die unendliche Geschichte', 'Krabat', 'Emil und die Detektive']);
  assert.deepEqual(spalte(sel(db, "SELECT titel FROM schueler, ausleihe, buch WHERE schueler.sid = ausleihe.sid AND ausleihe.bid = buch.bid AND vorname = 'Lena'")), ['Tschick', 'Momo']);
  assert.deepEqual(spalte(sel(db, "SELECT b.titel FROM ausleihe a INNER JOIN buch AS b ON a.bid = b.bid WHERE a.datum LIKE '2026-10%'")), ['Wunder', 'Die Tribute von Panem']);
  assert.deepEqual(spalte(sel(db, "SELECT COUNT(*) FROM schueler JOIN ausleihe ON schueler.sid = ausleihe.sid WHERE schueler.klasse = '10a'")), [7]);
  assert.deepEqual(plain(sel(db, 'SELECT titel, COUNT(*) FROM buch JOIN ausleihe ON buch.bid = ausleihe.bid GROUP BY titel HAVING COUNT(*) > 1').zeilen),
    [['Tschick', 3], ['Die Tribute von Panem', 2]]);
  // Stern über mehrere Tabellen nennt die Tabelle mit
  assert.deepEqual(sel(db, 'SELECT * FROM schueler JOIN ausleihe ON schueler.sid = ausleihe.sid LIMIT 1').spalten.slice(0, 2), ['schueler.sid', 'schueler.vorname']);
  assert.deepEqual(sel(db, 'SELECT buch.* FROM buch, ausleihe WHERE buch.bid = ausleihe.bid LIMIT 1').spalten, ['bid', 'titel', 'autor', 'jahr', 'genre']);
});

test('Fehlermeldungen sind verständlich und zeigen auf die Stelle', () => {
  const db = neu();
  assert.match(fehler(db, ''), /leer/);
  assert.match(fehler(db, 'SELEC * FROM buch'), /Meinst du „SELECT“/);
  assert.match(fehler(db, 'SELECT * FROM schüler'), /Meinst du „schueler“/);
  assert.match(fehler(db, 'SELECT titl FROM buch'), /Meinst du „titel“/);
  assert.match(fehler(db, 'SELECT titel FROM buch WHER jahr > 1'), /Meinst du WHERE/);
  assert.match(fehler(db, 'SELECT titel FORM buch'), /Meinst du FROM/);
  assert.match(fehler(db, 'SELECT titel buch'), /Es fehlt FROM/);
  assert.match(fehler(db, "SELECT * FROM buch WHERE genre = 'Fantasy"), /nicht geschlossen/);
  assert.match(fehler(db, 'SELECT * FROM buch WHERE jahr == 1973'), /einzelnen =/);
  assert.match(fehler(db, 'SELECT titel FROM buch WHERE jahr > 1970 AND < 1980'), /Spalte wiederholt/);
  assert.match(fehler(db, 'SELECT * FROM buch WHERE autor = Michael Ende'), /Anführungszeichen/);
  assert.match(fehler(db, 'SELECT * FROM buch WHERE genre = Fantasy'), /Anführungszeichen: 'Fantasy'/);
  assert.match(fehler(db, 'SELECT sid FROM schueler, ausleihe'), /mehreren Tabellen/);
  assert.match(fehler(db, 'SELECT titel, genre FROM buch GROUP BY genre'), /weder in GROUP BY/);
  assert.match(fehler(db, 'SELECT * FROM buch WHERE COUNT(*) > 2'), /HAVING/);
  assert.match(fehler(db, 'SELECT * FROM buch ORDER BY titel WHERE jahr > 1'), /Reihenfolge/);
  assert.match(fehler(db, 'SELECT * FROM buch LEFT JOIN ausleihe ON buch.bid = ausleihe.bid'), /JOIN … ON/);
  assert.match(fehler(db, 'DROP TABLE buch'), /nicht freigeschaltet/);
  assert.match(fehler(db, 'SELECT * FROM buch WHERE bid IN (SELECT bid FROM ausleihe)'), /Unterabfragen/);
  assert.match(fehler(db, 'SELECT * FROM buch, buch'), /zweimal/);
  // Position des Fehlers zeigt auf das falsche Wort
  const q = 'SELECT titel FROM buch WHERE jahr > 1970 AND < 1980';
  assert.equal(plain(db.ausfuehren(q)).pos, q.indexOf('<'));
  // Riesige Kreuzprodukte werden abgefangen statt den Browser einzufrieren
  assert.match(fehler(db, 'SELECT * FROM ausleihe a, ausleihe b, ausleihe c, ausleihe d, ausleihe e, ausleihe f'), /zu viele Kombinationen/);
});

test('INSERT, UPDATE, DELETE mit Prüfung von Typ, Primär- und Fremdschlüssel; Zurücksetzen', () => {
  const db = neu();
  const ins = plain(db.ausfuehren("INSERT INTO buch VALUES (11, 'Rico, Oskar und die Tieferschatten', 'Andreas Steinhöfel', 2008, 'Krimi')"));
  assert.equal(ins.anzahl, 1);
  assert.equal(sel(db, 'SELECT * FROM buch').zeilen.length, 11);
  assert.match(fehler(db, "INSERT INTO buch VALUES (11, 'x', 'y', 2000, 'z')"), /gibt es in buch schon/);
  assert.match(fehler(db, "INSERT INTO buch VALUES (12, 'x', 'y', 'zweitausend', 'z')"), /ganze Zahl/);
  assert.match(fehler(db, "INSERT INTO buch (titel) VALUES ('ohne Nummer')"), /darf nicht leer/);
  assert.match(fehler(db, "INSERT INTO buch VALUES (12, 'x')"), /2 Werte für 5 Spalten/);
  assert.match(fehler(db, "INSERT INTO ausleihe VALUES (13, 99, 1, '2026-10-03', 'nein')"), /Fremdschlüssel verletzt/);
  assert.equal(plain(db.ausfuehren("INSERT INTO ausleihe (aid, sid, bid, datum, zurueck) VALUES (13, 4, 11, '2026-10-03', 'nein'), (14, 4, 1, '2026-10-04', NULL)")).anzahl, 2);
  assert.deepEqual(spalte(sel(db, 'SELECT aid FROM ausleihe WHERE zurueck IS NULL')), [14]);
  // UPDATE
  assert.equal(plain(db.ausfuehren("UPDATE schueler SET klasse = '10b' WHERE sid = 1")).anzahl, 1);
  assert.deepEqual(spalte(sel(db, 'SELECT klasse FROM schueler WHERE sid = 1')), ['10b']);
  assert.match(plain(db.ausfuehren("UPDATE ausleihe SET zurueck = 'ja'")).meldung, /alle Datensätze/);
  assert.match(fehler(db, 'UPDATE schueler SET sid = 2 WHERE sid = 3'), /benutzt|schon/);
  assert.match(fehler(db, 'UPDATE ausleihe SET bid = 77 WHERE aid = 1'), /Fremdschlüssel verletzt/);
  assert.deepEqual(spalte(sel(db, 'SELECT bid FROM ausleihe WHERE aid = 1')), [4], 'fehlgeschlagenes UPDATE ändert nichts');
  // DELETE: verwendete Datensätze lassen sich nicht löschen
  assert.match(fehler(db, 'DELETE FROM schueler WHERE sid = 1'), /noch in ausleihe\.sid benutzt/);
  assert.equal(plain(db.ausfuehren('DELETE FROM ausleihe WHERE sid = 4')).anzahl, 2);
  assert.equal(plain(db.ausfuehren('DELETE FROM schueler WHERE sid = 4')).anzahl, 1);
  assert.equal(sel(db, 'SELECT * FROM schueler').zeilen.length, 7);
  db.zuruecksetzen();
  assert.equal(sel(db, 'SELECT * FROM schueler').zeilen.length, 8);
  assert.equal(sel(db, 'SELECT * FROM buch').zeilen.length, 10);
  assert.deepEqual(spalte(sel(db, 'SELECT klasse FROM schueler WHERE sid = 1')), ['10a']);
  // Die Ausgangsdaten selbst bleiben unverändert
  assert.equal(BIBLIOTHEK.tabellen[1].zeilen.length, 10);
});

test('Ergebnisvergleich für die Aufgaben im Labor', () => {
  const db = neu();
  const ref = db.ausfuehren("SELECT vorname, nachname FROM schueler WHERE klasse = '10a' ORDER BY nachname");
  assert.ok(gleichesErgebnis(db.ausfuehren("select vorname, nachname from schueler where klasse = '10a' order by nachname asc"), ref, true).ok);
  assert.equal(gleichesErgebnis(db.ausfuehren("SELECT vorname, nachname FROM schueler WHERE klasse = '10a'"), ref, true).grund, 'reihenfolge');
  assert.equal(gleichesErgebnis(db.ausfuehren("SELECT nachname FROM schueler WHERE klasse = '10a'"), ref, true).grund, 'spalten');
  assert.equal(gleichesErgebnis(db.ausfuehren("SELECT vorname, nachname FROM schueler"), ref, false).grund, 'anzahl');
  const genre = db.ausfuehren('SELECT genre, COUNT(*) FROM buch GROUP BY genre');
  assert.ok(gleichesErgebnis(db.ausfuehren('SELECT genre, COUNT(bid) AS anzahl FROM buch GROUP BY genre ORDER BY anzahl'), genre, false).ok);
  const mia = db.ausfuehren("SELECT buch.titel FROM schueler JOIN ausleihe ON schueler.sid = ausleihe.sid JOIN buch ON ausleihe.bid = buch.bid WHERE schueler.vorname = 'Mia' AND schueler.nachname = 'Schulz'");
  assert.ok(gleichesErgebnis(db.ausfuehren("SELECT titel FROM buch, ausleihe WHERE buch.bid = ausleihe.bid AND ausleihe.sid = 5"), mia, false).ok);
  assert.equal(gleichesErgebnis(db.ausfuehren('INSERT INTO buch VALUES (20, \'a\', \'b\', 2000, \'c\')'), mia, false).ok, false);
});

// Die SQL-Übungen der Themen beziehen sich auf die Beispieldatenbank. Ihre Lösungen müssen zu den echten Ergebnissen passen.
test('SQL-Übungen stimmen mit den Abfrageergebnissen der Beispieldatenbank überein', () => {
  const lade = (datei) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/informatik/klasse-10/4-datenbanken', datei), 'utf8'));
  const uebung = (thema, id) => thema.uebungen.find(u => u.id === id);
  const sql = lade('3-sql-abfragen.json'), sqv = lade('4-sql-verknuepfen.json');
  const db = neu();
  const anzahl = q => sel(db, q).zeilen.length;
  const wert = q => sel(db, q).zeilen[0][0];
  assert.equal(uebung(sql, 'inf-sql-03').loesung, anzahl("SELECT * FROM buch WHERE genre = 'Fantasy' OR jahr > 2000"));
  assert.equal(uebung(sql, 'inf-sql-07').loesung, anzahl('SELECT DISTINCT autor FROM buch WHERE jahr < 1980'));
  assert.deepEqual(spalte(sel(db, "SELECT titel FROM buch WHERE autor = 'Erich Kästner' ORDER BY jahr DESC")), ['Das doppelte Lottchen', 'Emil und die Detektive']);
  assert.equal(anzahl("SELECT * FROM buch WHERE autor LIKE '%Ende'"), 2);
  assert.equal(anzahl("SELECT * FROM buch WHERE autor LIKE 'Ende%'"), 0);
  assert.equal(uebung(sqv, 'inf-sqv-02').loesung, wert('SELECT COUNT(*) FROM buch, ausleihe'));
  assert.equal(uebung(sqv, 'inf-sqv-04').loesung, wert("SELECT COUNT(*) FROM ausleihe WHERE zurueck = 'nein'"));
  assert.equal(uebung(sqv, 'inf-sqv-05').loesung, wert("SELECT COUNT(*) FROM schueler WHERE klasse = '10c'"));
  assert.equal(uebung(sqv, 'inf-sqv-06').loesung, wert("SELECT COUNT(*) FROM schueler JOIN ausleihe ON schueler.sid = ausleihe.sid WHERE schueler.klasse = '10a'"));
  // Musterlösung der Freitext-Übung ist eine gültige Abfrage mit dem genannten Ergebnis
  const muster = uebung(sqv, 'inf-sqv-07').musterloesung.split('\n')[0];
  assert.deepEqual(plain(sel(db, muster).zeilen), [['Michael Ende', 2], ['Erich Kästner', 2]]);
  // Die Tabellen in den Erklärtexten zeigen genau die Daten der Beispieldatenbank
  const texte = [...sql.verstehen.abschnitte, ...sqv.verstehen.abschnitte].map(a => a.text).join('\n');
  for (const t of BIBLIOTHEK.tabellen) for (const z of t.zeilen) {
    if (t.name === 'buch') assert.ok(texte.includes(z[1]) && texte.includes(z[2]), `buch ${z[0]} im Text`);
    if (t.name === 'schueler') assert.ok(texte.includes(`${z[1].padEnd(7)} | ${z[2].padEnd(8)} | ${z[3]}`), `schueler ${z[0]} im Text`);
    if (t.name === 'ausleihe') assert.ok(texte.includes(`| ${String(z[1]).padStart(3)} | ${String(z[2]).padStart(3)} | ${z[3]} | ${z[4]}`), `ausleihe ${z[0]} im Text`);
  }
});
