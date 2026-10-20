// Tests für das Feedback: Prüfung und Säuberung der Eingaben, Diagnosefelder nur nach Liste, E-Mail-Text,
// mailto-Link mit Längengrenze, Fehlerprotokoll und die Seite selbst (Escaping, nur interne „von“-Pfade).
// Der Versand über den Server (SMTP) wird in test/server.test.mjs mit einem Test-Mailserver geprüft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KATEGORIEN, DIAG_FELDER, GRENZEN, FEHLERPROTOKOLL, FEHLER_SCHLUESSEL, pruefeFeedback, mailText, mailtoHref, sammleDiagnose } from '../public/feedback-kern.js';
import { feedbackBody, feedbackVon } from '../src/feedback.js';
import { datenschutzBody, ladeImpressum } from '../src/rechtliches.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gut = { kategorie: 'fehler', betreff: 'Übung zählt falsch', beschreibung: 'Bei Übung 3 wird die richtige Antwort als falsch gewertet.', seite: '/physik/9' };

test('1 · Pflichtfelder und Kategorien werden geprüft', () => {
  assert.equal(pruefeFeedback(gut).ok, true);
  const leer = pruefeFeedback({});
  assert.equal(leer.ok, false);
  assert.equal(leer.fehler.length, 3, 'Kategorie, Betreff, Beschreibung');
  assert.equal(pruefeFeedback({ ...gut, kategorie: 'hack' }).ok, false);
  assert.equal(pruefeFeedback({ ...gut, beschreibung: 'kurz' }).ok, false);
  assert.equal(pruefeFeedback(null).ok, false);
  assert.equal(pruefeFeedback('text').ok, false);
  assert.deepEqual(KATEGORIEN.map(k => k.id), ['fehler', 'inhalt', 'idee', 'sonstiges']);
});

test('2 · Säubern: Längen, Steuerzeichen, keine Zeilenumbrüche im Betreff (keine Kopfzeilen-Injektion)', () => {
  const r = pruefeFeedback({ ...gut, betreff: 'Hallo\r\nBcc: boese@example.com\u2028x', beschreibung: 'a\u0000b\u0007c' + 'x'.repeat(10000), seite: 'y'.repeat(999) });
  assert.equal(r.ok, true);
  assert.ok(!/[\r\n\u2028]/.test(r.daten.betreff), r.daten.betreff);
  assert.equal(r.daten.beschreibung.length, GRENZEN.beschreibung);
  assert.ok(r.daten.beschreibung.startsWith('abcx'), 'Steuerzeichen entfernt');
  assert.equal(r.daten.seite.length, GRENZEN.seite);
  assert.equal(pruefeFeedback({ ...gut, betreff: 'x'.repeat(500) }).daten.betreff.length, GRENZEN.betreff);
  const m = mailText(r.daten);
  assert.ok(!/[\r\n]/.test(m.betreff), 'Betreff der E-Mail einzeilig');
});

test('3 · Kontakt nur, wenn erlaubt und angekreuzt; Diagnose nur bekannte Felder', () => {
  assert.equal(pruefeFeedback({ ...gut, kontakt: true }).daten.kontakt, false, 'ohne Anmeldung nie');
  assert.equal(pruefeFeedback({ ...gut, kontakt: true }, { kontaktErlaubt: true }).daten.kontakt, true);
  assert.equal(pruefeFeedback({ ...gut, kontakt: 'true' }, { kontaktErlaubt: true }).daten.kontakt, false, 'nur echtes true');
  const d = pruefeFeedback({ ...gut, diagnose: { browser: 'Firefox', passwort: 'geheim', cookie: 'x', fehler: 'f\n'.repeat(2000), webgl: 'ja' } }).daten.diagnose;
  assert.deepEqual(Object.keys(d).sort(), ['browser', 'fehler', 'webgl']);
  assert.ok(d.fehler.length <= GRENZEN.diagFehler);
  assert.equal(pruefeFeedback({ ...gut, diagnose: { unbekannt: 1 } }).daten.diagnose, null);
  assert.equal(pruefeFeedback({ ...gut, diagnose: 'alles' }).daten.diagnose, null);
});

test('4 · E-Mail-Text: Inhalt, Absender nur wenn freigegeben, Diagnose nur wenn mitgeschickt', () => {
  const anonym = mailText(pruefeFeedback(gut).daten, { seitenName: 'Lernseite' });
  assert.equal(anonym.betreff, '[Lernseite · Feedback] Fehler melden: Übung zählt falsch');
  assert.match(anonym.text, /Absender: nicht angegeben \(anonym\)/);
  assert.match(anonym.text, /Diagnosedaten: nicht mitgeschickt/);
  assert.match(anonym.text, /Seite: \/physik\/9/);
  assert.ok(anonym.text.includes(gut.beschreibung));
  const mit = mailText(pruefeFeedback({ ...gut, kontakt: true, diagnose: { browser: 'Testbrowser 1.0', fehler: '12:00:00 /x – kaputt' } }, { kontaktErlaubt: true }).daten,
    { absender: { name: 'Max Muster', email: 'max@schule.de', rolle: 'Schüler/in', klasse: '9a' } });
  assert.match(mit.text, /Absender \(freigegeben\): Max Muster <max@schule.de>, Schüler\/in, Klasse 9a/);
  assert.match(mit.text, /Browser: Testbrowser 1\.0/);
  assert.match(mit.text, /Letzte Fehlermeldungen der Seite:\n12:00:00 \/x – kaputt/);
});

test('5 · mailto-Link: kodiert, mit Längengrenze und Hinweis beim Kürzen', () => {
  const kurz = mailtoHref('a@b.de', 'Betreff & mehr', 'Zeile 1\nZeile 2 ä');
  assert.equal(kurz.gekuerzt, false);
  assert.equal(kurz.href, 'mailto:a@b.de?subject=Betreff%20%26%20mehr&body=Zeile%201%0AZeile%202%20%C3%A4');
  const lang = mailtoHref('a@b.de', 'B', 'ä'.repeat(4000));
  assert.equal(lang.gekuerzt, true);
  assert.ok(lang.href.length <= 1900, String(lang.href.length));
  assert.ok(decodeURIComponent(lang.href.split('body=')[1]).includes('gekürzt'));
});

test('6 · Fehlerprotokoll merkt sich die letzten 8 Fehler ohne Eingaben; lesson-kit macht dasselbe', () => {
  for (const code of [FEHLERPROTOKOLL, fs.readFileSync(path.join(ROOT, 'public/lesson-kit.js'), 'utf8')]) {
    const speicher = {}, hoerer = {};
    const ctx = vm.createContext({
      sessionStorage: { getItem: k => speicher[k] ?? null, setItem: (k, v) => { speicher[k] = String(v); } },
      location: { pathname: '/physik/9', hash: '' },
      window: { addEventListener: (n, f) => { hoerer[n] = f; }, parent: null },
      document: { addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, readyState: 'complete' },
      Date, JSON, String,
    });
    ctx.window.parent = ctx.window;
    vm.runInContext(code, ctx);
    for (let i = 0; i < 10; i++) hoerer.error({ message: 'Fehler ' + i, filename: 'https://x.de/static/datei.js?v=1', lineno: i });
    hoerer.unhandledrejection({ reason: new Error('weg') });
    const liste = JSON.parse(speicher[FEHLER_SCHLUESSEL]);
    assert.equal(liste.length, 8);
    assert.equal(liste.at(-1).m, 'Promise: weg');
    assert.equal(liste[0].d, 'datei.js', 'nur Dateiname, keine Adresse mit Parametern');
    assert.deepEqual(Object.keys(liste[0]).sort(), ['d', 'l', 'm', 's', 'z']);
  }
});

test('7 · Diagnose im Browser: nur die Felder aus DIAG_FELDER, keine Inhalte', () => {
  const fenster = {
    navigator: { userAgent: 'UA', language: 'de-DE', maxTouchPoints: 0, onLine: true },
    screen: { width: 1920, height: 1080 }, innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2,
    matchMedia: q => ({ matches: q.includes('dark') }),
    document: { createElement: () => ({ getContext: () => null }) },
    localStorage: { setItem() {}, removeItem() {}, getItem: () => 'geheimer Lernstand' },
    sessionStorage: { getItem: () => JSON.stringify([{ z: '10:00:00', s: '/x', m: 'kaputt', d: 'a.js', l: 3 }]) },
  };
  const d = sammleDiagnose(fenster, '/physik');
  assert.deepEqual(Object.keys(d).sort(), DIAG_FELDER.map(([k]) => k).sort());
  assert.equal(d.farbschema, 'dunkel');
  assert.equal(d.webgl, 'nein');
  assert.equal(d.fehler, '10:00:00 /x – kaputt (a.js:3)');
  assert.ok(!JSON.stringify(d).includes('geheim'));
});

test('8 · Seite: escapt Eingaben, übernimmt nur interne Pfade, Kontakt-Häkchen nur im Server-Modus', () => {
  assert.equal(feedbackVon('/physik/9?x=1'), '/physik/9?x=1');
  for (const boese of ['https://evil.de', '//evil.de', 'javascript:alert(1)', '/feedback?von=/x']) assert.equal(feedbackVon(boese), '', boese);
  const html = feedbackBody({ modus: 'mailto', empfaenger: 'a@b.de', von: '/x"><script>alert(1)</script>' });
  assert.ok(!html.includes('<script>alert'), 'escaped');
  assert.ok(!html.includes('name="kontakt"'));
  assert.match(html, /E-Mail vorbereiten/);
  const server = feedbackBody({ modus: 'server', empfaenger: 'a@b.de', absender: { name: 'Max <b>', email: 'max@schule.de' } });
  assert.match(server, /name="kontakt"/);
  assert.match(server, /Feedback senden/);
  assert.ok(!server.includes('Max <b>'));
  assert.equal((server.match(/name="kategorie"/g) || []).length, KATEGORIEN.length);
});

test('9 · Empfänger und Datenschutzerklärung', () => {
  const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/feedback.json'), 'utf8'));
  assert.equal(f.empfaenger, 'philipp.konstantin.gomann@humboldtschule-berlin.eu');
  const ds = datenschutzBody(ladeImpressum(), { feedbackAn: f.empfaenger });
  assert.match(ds, /id="feedback"/);
  assert.ok(ds.includes(f.empfaenger));
  assert.match(ds, /sessionStorage/);
  // Jedes Diagnosefeld ist in der Datenschutzerklärung beschrieben (Stichwort je Feld)
  const stichwort = { zeit: 'Zeitpunkt', seite: 'Seite', browser: 'Browser', sprache: 'Sprache', bildschirm: 'Bildschirm', fenster: 'Fenster', pixel: 'Pixelverhältnis',
    farbschema: 'Farbschema', bewegung: 'weniger Bewegung', touch: 'Touch', webgl: 'WebGL', speicher: 'Browser-Speicher', online: 'online', zeitzone: 'Zeitzone', fehler: 'Fehlermeldungen' };
  for (const [k] of DIAG_FELDER) assert.ok(ds.includes(stichwort[k]), `Datenschutz nennt ${k}`);
});

test('10 · Keine Zugangsdaten im Repo: .env.example ohne Passwort, Mailer liest nur die Umgebung', () => {
  const beispiel = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.match(beispiel, /^SMTP_PASS=$/m);
  const mailer = fs.readFileSync(path.join(ROOT, 'src/mailer.js'), 'utf8');
  assert.ok(!/pass\s*:\s*['"]/.test(mailer), 'kein festes Passwort');
  assert.match(mailer, /disableFileAccess: true/);
});
