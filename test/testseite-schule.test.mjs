// Tests für das Schul-, Rollen- und Aufgabensystem der statischen Testseite (testseite/backend.js).
// Das simulierte Backend läuft wie im Browser (ohne DOM) in einer VM, mit echtem Argon2id (hash-wasm) und echter
// Web-Crypto. Für die Anmeldung von Lehrkräften und Administration ersetzen die Tests die gespeicherten Hashes durch
// Hashes eines Test-Passworts – das echte gemeinsame Testpasswort steht nirgends im Repository.
// Ist TEST_PASSWORT gesetzt, prüft Test 0 zusätzlich, dass die ausgelieferten Hashes genau zu diesem Passwort passen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadAll } from '../src/faecher.js';
import { ladeArgon2 } from '../testseite/passwort-hash.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'testseite');
const ctx = vm.createContext({});
for (const f of ['schule-daten.js', 'backend.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const argon2 = ladeArgon2();
const PW = 'Test-Passwort-fuer-CI-123';
const TEST_HASHES = await Promise.all(ctx.SCHULE_DATEN.HASHES.map(() => argon2.argon2id({ password: PW, salt: crypto.randomBytes(16), parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: 'encoded' })));
const ECHTE_HASHES = ctx.SCHULE_DATEN.HASHES.slice();

const content = loadAll();
const inhalte = {
  topics: content.faecher.flatMap(f => f.stufen.flatMap(s => s.themenfelder.flatMap(tf => tf.topics.map(t => ({
    id: t.id, titel: t.titel, kurz: t.kurz, fach: f.id, stufe: s.stufe, themenfeld: tf.titel, gesperrt: !!t.gesperrt, uebungen: t.uebungen.map(e => e.id),
  }))))),
  lessons: fs.readdirSync(path.join(ROOT, 'lessons')).map(slug => ({ slug, title: slug })),
};
const plain = x => JSON.parse(JSON.stringify(x));

function speicher() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }; }
function neu(o = {}) {
  let uhr = o.start || Date.parse('2026-10-14T10:00:00Z');
  const sp = o.speicher || speicher();
  const daten = Object.assign({}, ctx.SCHULE_DATEN, { HASHES: o.echt ? ECHTE_HASHES : TEST_HASHES });
  const b = ctx.SchulBackend.erstelle({
    speicher: sp, argon2, daten, inhalte, jetzt: () => uhr,
    zufall: n => new Uint8Array(crypto.randomBytes(n)),
    sha256: async t => crypto.createHash('sha256').update(t).digest('hex'),
  });
  return { b, sp, vor: ms => { uhr += ms; }, jetzt: () => uhr };
}
// Vollständiger simulierter OAuth-Ablauf → Sitzungstoken
async function login(b, username, passwort) {
  const state = crypto.randomBytes(16).toString('hex');
  const a = await b.oauth.autorisieren({ client_id: b.oauth.clientId, state, username, passwort });
  if (!a.ok) return a;
  const t = await b.oauth.token({ code: a.daten.code, state: a.daten.state, erwarteterState: state });
  return t.ok ? { ok: true, token: t.daten.token, claims: t.daten.claims } : t;
}
async function als(b, username, pw) { const r = await login(b, username, pw); assert.ok(r.ok, `${username}: ${r.fehler}`); return (aktion, daten) => b.api(r.token, aktion, daten); }
const ok = r => { assert.ok(r.ok, `erwartet ok, bekam ${r.code}: ${r.fehler}`); return r.daten; };
const verboten = (r, code = 403) => { assert.equal(r.ok, undefined, 'darf nicht gelingen'); assert.equal(r.code, code, `Code ${r.code}: ${r.fehler}`); };
const morgen = t => new Date(t + 86400000 * 3).toISOString().slice(0, 10);

test('0 · Ausgelieferte Hashes: Argon2id, eigener Salt je Konto, kein Klartext', async () => {
  const salze = new Set();
  for (const h of ECHTE_HASHES) {
    assert.match(h, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
    salze.add(h.split('$')[4]);
  }
  assert.equal(salze.size, ECHTE_HASHES.length, 'jeder Hash hat einen eigenen Salt');
  assert.equal(ECHTE_HASHES.length, ctx.SCHULE_DATEN.LEHRER.length + ctx.SCHULE_DATEN.ADMINS.length);
  // Referenzwert von libargon2 (argon2-cffi) für password / Salt 16×0x01 / m=19456, t=2, p=1
  assert.equal(await argon2.argon2id({ password: 'password', salt: new Uint8Array(16).fill(1), parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: 'encoded' }),
    '$argon2id$v=19$m=19456,t=2,p=1$AQEBAQEBAQEBAQEBAQEBAQ$FGlXh8itGiEPkJl4VLoHXFF7l5JO1RPiRKoFjEigPqM');
  if (process.env.TEST_PASSWORT) {
    for (const h of ECHTE_HASHES) assert.ok(await argon2.argon2Verify({ password: process.env.TEST_PASSWORT, hash: h }));
    const { b } = neu({ echt: true });
    assert.ok((await login(b, 'sabine.keller', process.env.TEST_PASSWORT)).ok, 'Lehrer-Login mit dem echten Testpasswort');
    // Das Klartextpasswort steht in keiner ausgelieferten Datei
    for (const f of fs.readdirSync(DIR)) if (/\.(js|mjs|css|md)$/.test(f)) assert.ok(!fs.readFileSync(path.join(DIR, f), 'utf8').includes(process.env.TEST_PASSWORT), f);
  }
});

test('1 · Schüler-Login ohne Passwort; sieht nur eigene Aufgaben und Daten', async () => {
  const { b } = neu();
  const r = await login(b, 'lena.hoffmann');
  assert.ok(r.ok);
  assert.deepEqual(plain(r.claims.groups), ['9a'], 'Klasse aus den simulierten Identitätsdaten');
  const lena = (a, d) => b.api(r.token, a, d);
  const ich = ok(await lena('konto.ich'));
  assert.equal(ich.profil.rolle, 'student');
  assert.equal(ich.profil.klasse, '9a');
  const ue = ok(await lena('schueler.uebersicht'));
  const titel = ue.aufgaben.liste.map(x => x.titel);
  assert.ok(titel.includes('Messprotokoll: Ohmsches Gesetz'));
  assert.ok(!titel.includes('Kreuzungsschema Erbsenfarbe'), 'Aufgabe der 10a nicht sichtbar');
  assert.ok(!titel.includes('Programm mit Schleife'), 'Kurs, in dem Lena nicht ist');
  assert.ok(!titel.includes('Steckbrief Ethanol'), 'Entwurf nicht sichtbar');
  // Fremde Zuweisung direkt abrufen → „nicht gefunden“
  const db = b._db();
  const fremd = db.zuweisungen.find(z => z.klasseId === '10a');
  verboten(await lena('schueler.aufgabe', { id: fremd.id }), 404);
  // Musterlösung erst nach Freigabe (nach Korrektur): Lena (korrigiert) sieht sie, Jonas (nur abgegeben) nicht
  const ohm = db.zuweisungen.find(z => z.klasseId === '9a' && db.aufgaben.find(a => a.id === z.aufgabeId).titel.startsWith('Messprotokoll'));
  assert.ok(ok(await lena('schueler.aufgabe', { id: ohm.id })).aufgabe.musterloesung.includes('47'));
  const jonas = await als(b, 'jonas.becker');
  assert.equal(ok(await jonas('schueler.aufgabe', { id: ohm.id })).aufgabe.musterloesung, '');
  // Keine Lehrer- oder Adminfunktionen
  verboten(await lena('lehrer.dashboard'));
  verboten(await lena('admin.benutzer'));
  verboten(await lena('lehrer.schueler', { id: db.users.find(u => u.username === 'jonas.becker').id }));
  // Konten-Liste der Anmeldeseite enthält keine Hashes
  assert.ok(!JSON.stringify(b.oauth.konten()).includes('argon2'));
});

test('2 · Rolle lässt sich nicht selbst erhöhen', async () => {
  const { b } = neu();
  const lena = await als(b, 'lena.hoffmann');
  const id = b._db().users.find(u => u.username === 'lena.hoffmann').id;
  verboten(await lena('admin.rolle', { id, rolle: 'admin', passwort: 'egal' }));
  verboten(await lena('admin.status', { id, status: 'aktiv' }));
  // Mitgeschickte Rolle in anderen Aktionen wird ignoriert
  ok(await lena('lernstand.versuch', { e: inhalte.topics[0].uebungen[0], c: true, rolle: 'admin' }));
  assert.equal(ok(await lena('konto.ich', { rolle: 'admin' })).profil.rolle, 'student');
  // Lehrer-Konto ohne Passwort → abgelehnt
  verboten(await login(b, 'sabine.keller'), 401);
  // Gefälschte/fremde Tokens werden nicht akzeptiert
  verboten(await b.api('0'.repeat(64), 'admin.benutzer'), 401);
  verboten(await b.api(undefined, 'konto.ich'), 401);
  assert.ok(b._db().audit.some(l => l.aktion === 'zugriff_verweigert'), 'verweigerte Zugriffe werden protokolliert');
});

test('3 · Lehrer-Login mit Passwort, Rate-Limit, OAuth-Code nur einmal gültig', async () => {
  const { b, vor } = neu();
  assert.ok((await login(b, 'sabine.keller', PW)).ok);
  verboten(await login(b, 'sabine.keller', 'falsch'), 401);
  // Code kann nicht zweimal eingelöst werden; falscher state wird abgelehnt
  const state = crypto.randomBytes(16).toString('hex');
  const a = ok(await b.oauth.autorisieren({ client_id: b.oauth.clientId, state, username: 'murat.yilmaz', passwort: PW }));
  verboten(await b.oauth.token({ code: a.code, state, erwarteterState: 'anders-anders-anders' }), 400);
  verboten(await b.oauth.token({ code: a.code, state, erwarteterState: state }), 400);
  verboten(await b.oauth.autorisieren({ client_id: 'fremde-app', state, username: 'lena.hoffmann' }), 400);
  // Rate-Limit nach 5 Fehlversuchen – auch das richtige Passwort wird dann abgewiesen
  for (let i = 0; i < 4; i++) await login(b, 'julia.brandt', 'falsch' + i);
  verboten(await login(b, 'julia.brandt', 'falsch5'), 401);
  verboten(await login(b, 'julia.brandt', PW), 429);
  vor(16 * 60 * 1000);
  assert.ok((await login(b, 'julia.brandt', PW)).ok, 'nach Ablauf der Sperrzeit wieder möglich');
  const log = JSON.stringify(b._db().anmeldeversuche) + JSON.stringify(b._db().audit);
  assert.ok(!log.includes(PW) && !log.includes('falsch5'), 'keine Passwörter im Protokoll');
  // Session-Fixation: jede Anmeldung erzeugt ein neues Token, Sitzungen werden nur als Hash gespeichert
  const t1 = (await login(b, 'tobias.novak', PW)).token, t2 = (await login(b, 'tobias.novak', PW)).token;
  assert.notEqual(t1, t2);
  assert.ok(!JSON.stringify(b._db().sitzungen).includes(t1));
  // Sitzungen laufen nach Inaktivität ab
  vor(61 * 60 * 1000);
  verboten(await b.api(t2, 'konto.ich'), 401);
});

test('4 · Lehrer erstellt, veröffentlicht und weist Aufgabe zu; Schüler werden benachrichtigt', async () => {
  const { b, jetzt } = neu();
  const kel = await als(b, 'sabine.keller', PW);
  const { id } = ok(await kel('aufgabe.erstellen', { titel: 'Widerstand eines Drahts', anweisung: 'Berechne den Widerstand für drei Drahtlängen.', fachId: 'physik', themaId: 'k9-widerstandsgesetz', schwierigkeit: 'mittel', minuten: '25', punkte: '8', musterloesung: 'R ~ l', loesungFreigabe: 'nach_faelligkeit' }));
  verboten(await kel('aufgabe.zuweisen', { id, klassen: ['9a'], faellig: morgen(jetzt()) }), 409);   // Entwurf
  ok(await kel('aufgabe.status', { id, status: 'veroeffentlicht' }));
  const z = ok(await kel('aufgabe.zuweisen', { id, klassen: ['9a', '9b'], faellig: morgen(jetzt()) }));
  assert.equal(z.zuweisungen.length, 2);
  const lena = await als(b, 'lena.hoffmann');
  const liste = ok(await lena('schueler.uebersicht')).aufgaben.liste;
  assert.ok(liste.some(x => x.titel === 'Widerstand eines Drahts'));
  const det = ok(await lena('schueler.aufgabe', { id: z.zuweisungen[0] }));
  assert.equal(det.aufgabe.musterloesung, '', 'Musterlösung vor der Fälligkeit verborgen');
  // Duplizieren und archivieren
  const kopie = ok(await kel('aufgabe.duplizieren', { id }));
  assert.equal(b._db().aufgaben.find(a => a.id === kopie.id).status, 'entwurf');
  ok(await kel('aufgabe.status', { id: kopie.id, status: 'archiviert' }));
  ok(await kel('aufgabe.status', { id: kopie.id, status: 'veroeffentlicht' }));
  // Abgabe und Lernstand
  ok(await lena('schueler.speichern', { id: z.zuweisungen[0], text: 'Entwurf' }));
  ok(await lena('schueler.speichern', { id: z.zuweisungen[0], text: 'R wächst mit der Länge.', abgeben: true }));
  verboten(await lena('schueler.speichern', { id: z.zuweisungen[0], text: 'nachträglich', abgeben: true }), 409);
  // Frist ändern → Betroffene werden informiert
  const r = ok(await kel('zuweisung.frist', { id: z.zuweisungen[0], faellig: morgen(jetzt() + 86400000 * 4) }));
  assert.equal(r.benachrichtigt, 6);
  assert.ok(ok(await lena('mitteilungen.liste')).some(n => n.typ === 'frist'));
  // Verlauf und Protokoll
  assert.ok(ok(await kel('aufgabe.details', { id })).verlauf.length >= 3);
  // Bibliothek: Vorlage speichern und zentrale Aufgabe zuweisen
  const bib = ok(await kel('aufgaben.bibliothek', {}));
  const energie = bib.liste.find(a => a.titel.startsWith('Stromkosten'));
  assert.ok(energie);
  ok(await kel('aufgabe.zuweisen', { id: energie.id, klassen: ['9b'], faellig: morgen(jetzt()) }));
  verboten(await kel('aufgabe.bearbeiten', { id: energie.id, titel: 'Fremd geändert', anweisung: 'xxxxxxxxxxxx', fachId: 'physik' }));
});

test('5 · Lehrer kann keine fremde Klasse verwalten', async () => {
  const { b, jetzt } = neu();
  const kel = await als(b, 'sabine.keller', PW);
  verboten(await kel('lehrer.klasse', { id: '10a' }));
  ok(await kel('lehrer.klasse', { id: '9a' }));
  const { id } = ok(await kel('aufgabe.erstellen', { titel: 'Test', anweisung: 'Eine Anweisung mit Text.', fachId: 'physik', status: 'veroeffentlicht' }));
  verboten(await kel('aufgabe.zuweisen', { id, klassen: ['10a'], faellig: morgen(jetzt()) }));
  verboten(await kel('aufgabe.zuweisen', { id, klassen: ['9a', 'wp-timp-9'], faellig: morgen(jetzt()) }));
  assert.equal(b._db().zuweisungen.filter(z => z.aufgabeId === id).length, 0, 'nichts teilweise zugewiesen');
  // Fach, das sie in der Klasse nicht unterrichtet (Biologie in 9a)
  const bio = ok(await kel('aufgabe.erstellen', { titel: 'Bio', anweisung: 'Eine Anweisung mit Text.', fachId: 'biologie', status: 'veroeffentlicht' }));
  verboten(await kel('aufgabe.zuweisen', { id: bio.id, klassen: ['9b'], faellig: morgen(jetzt()) }));
  const db = b._db();
  const hannah = db.users.find(u => u.username === 'hannah.wolf');
  verboten(await kel('lehrer.schueler', { id: hannah.id }));
  verboten(await kel('ankuendigung.erstellen', { klassen: ['10a'], titel: 'Hallo', text: 'Test' }));
  verboten(await kel('material.erstellen', { klasseId: '10a', titel: 'Hallo', link: '' }));
  // Fremde Aufgabe (von Brandt) nicht bearbeiten, Zuweisung nicht zurückziehen
  const mendel = db.aufgaben.find(a => a.titel.startsWith('Kreuzungsschema'));
  verboten(await kel('aufgabe.bearbeiten', { id: mendel.id, titel: 'x', anweisung: 'yyyyyyyyyyyy', fachId: 'biologie' }));
  verboten(await kel('aufgabe.details', { id: mendel.id }));
  verboten(await kel('zuweisung.zurueckziehen', { id: db.zuweisungen.find(z => z.aufgabeId === mendel.id).id }));
  verboten(await kel('foerderhinweis.speichern', { schuelerId: hannah.id, text: 'x' }));
});

test('6 · Schüler sehen nur zugewiesene, veröffentlichte und nicht ausgeblendete Aufgaben', async () => {
  const { b, jetzt } = neu();
  const nov = await als(b, 'tobias.novak', PW);
  const { id } = ok(await nov('aufgabe.erstellen', { titel: 'Kursaufgabe', anweisung: 'Nur für den TIMP-Kurs.', fachId: 'timp', status: 'veroeffentlicht' }));
  const [zid] = ok(await nov('aufgabe.zuweisen', { id, klassen: ['wp-timp-9'], faellig: morgen(jetzt()) })).zuweisungen;
  const jonas = await als(b, 'jonas.becker'), lena = await als(b, 'lena.hoffmann');
  assert.ok(ok(await jonas('schueler.uebersicht')).aufgaben.liste.some(x => x.zuweisungId === zid), 'Kursmitglied sieht sie');
  assert.ok(!ok(await lena('schueler.uebersicht')).aufgaben.liste.some(x => x.zuweisungId === zid), 'Nicht-Mitglied nicht');
  verboten(await lena('schueler.aufgabe', { id: zid }), 404);
  verboten(await lena('schueler.speichern', { id: zid, text: 'x', abgeben: true }), 404);
  // Admin blendet aus → verschwindet; zurückgezogen → verschwindet
  const admin = await als(b, 'petra.lindner', PW);
  ok(await admin('admin.aufgabeAusblenden', { id, ausgeblendet: true }));
  assert.ok(!ok(await jonas('schueler.uebersicht')).aufgaben.liste.some(x => x.zuweisungId === zid));
  ok(await admin('admin.aufgabeAusblenden', { id, ausgeblendet: false }));
  ok(await nov('zuweisung.zurueckziehen', { id: zid }));
  assert.ok(!ok(await jonas('schueler.uebersicht')).aufgaben.liste.some(x => x.zuweisungId === zid));
  assert.ok(ok(await jonas('mitteilungen.liste')).some(n => n.typ === 'aufgabe_gesperrt'));
});

test('7 · Lehrer sieht Abgaben berechtigter Schüler, gibt Feedback und öffnet erneut', async () => {
  const { b } = neu();
  const db = b._db();
  const kel = await als(b, 'sabine.keller', PW);
  const jonasId = db.users.find(u => u.username === 'jonas.becker').id;
  const ab = db.abgaben.find(a => a.schuelerId === jonasId);
  const det = ok(await kel('abgabe.details', { id: ab.id }));
  assert.equal(det.abgabe.schueler, 'Jonas Becker');
  verboten(await kel('abgabe.bewerten', { id: ab.id, text: 'Gut', punkte: '11' }), 400);    // mehr als 10 Punkte
  ok(await kel('abgabe.bewerten', { id: ab.id, text: 'Rechnung fehlt teilweise.', punkte: '6', status: 'korrigiert' }));
  const jonas = await als(b, 'jonas.becker');
  const auf = ok(await jonas('schueler.aufgabe', { id: ab.zuweisungId }));
  assert.equal(auf.feedback[0].punkte, 6);
  assert.ok(auf.aufgabe.musterloesung, 'nach Korrektur freigegeben');
  ok(await kel('abgabe.wiederoeffnen', { id: ab.id, text: 'Bitte ergänze die Einheiten.' }));
  assert.equal(ok(await jonas('schueler.aufgabe', { id: ab.zuweisungId })).bearbeitbar, true);
  ok(await jonas('schueler.speichern', { id: ab.zuweisungId, text: 'Mit Einheiten: 47 Ω', abgeben: true }));
  // Abgaben der 10a (Brandt) bleiben für Keller unzugänglich
  const fremd = db.abgaben.find(a => db.zuweisungen.find(z => z.id === a.zuweisungId).klasseId === '10a');
  verboten(await kel('abgabe.details', { id: fremd.id }));
  verboten(await kel('abgabe.bewerten', { id: fremd.id, text: 'x' }));
  // Dashboard-Kennzahlen
  const dash = ok(await kel('lehrer.dashboard'));
  assert.deepEqual(plain(dash.klassen.map(k => k.id)).sort(), ['9a', '9b']);
  assert.ok(dash.zahlen.zuKorrigieren >= 1);
  assert.ok(dash.hilfe.length >= 1, 'Unterstützungsbedarf erkannt');
});

test('8/9 · Admin sperrt Konto → sofort keine geschützten Aktionen mehr; entsperren', async () => {
  const { b } = neu();
  const admin = await als(b, 'petra.lindner', PW);
  const lenaLogin = await login(b, 'lena.hoffmann');
  const lenaId = b._db().users.find(u => u.username === 'lena.hoffmann').id;
  ok(await b.api(lenaLogin.token, 'schueler.uebersicht'));
  ok(await admin('admin.status', { id: lenaId, status: 'gesperrt' }));
  const r = await b.api(lenaLogin.token, 'schueler.uebersicht');
  verboten(r, 401);
  assert.equal(r.grund, 'gesperrt');
  verboten(await login(b, 'lena.hoffmann'), 403);
  ok(await admin('admin.status', { id: lenaId, status: 'aktiv' }));
  assert.ok((await login(b, 'lena.hoffmann')).ok);
  // Gesperrte Lehrkraft: auch die laufende Sitzung endet
  const kel = await login(b, 'sabine.keller', PW);
  ok(await admin('admin.status', { id: b._db().users.find(u => u.username === 'sabine.keller').id, status: 'gesperrt' }));
  verboten(await b.api(kel.token, 'aufgabe.erstellen', { titel: 'xyz', anweisung: 'abcdefghijk', fachId: 'physik' }), 401);
  // Sitzungen widerrufen
  const mia = await login(b, 'mia.schulz');
  ok(await admin('admin.sitzungenWiderrufen', { id: b._db().users.find(u => u.username === 'mia.schulz').id }));
  verboten(await b.api(mia.token, 'konto.ich'), 401);
  // Eigenes Konto / letzter Admin sind geschützt
  const petraId = b._db().users.find(u => u.username === 'petra.lindner').id;
  verboten(await admin('admin.status', { id: petraId, status: 'gesperrt' }), 409);
  const aktionen = b._db().audit.map(l => l.aktion);
  for (const a of ['konto_gesperrt', 'konto_entsperrt', 'sitzungen_widerrufen']) assert.ok(aktionen.includes(a), a);
});

test('10 · Admin erstellt, bearbeitet, sperrt, archiviert und stellt Aufgaben wieder her', async () => {
  const { b, jetzt } = neu();
  const admin = await als(b, 'petra.lindner', PW);
  const { id } = ok(await admin('aufgabe.erstellen', { titel: 'Zentrale Aufgabe', anweisung: 'Eine zentrale Aufgabe für alle.', fachId: 'chemie', status: 'veroeffentlicht', bibliothek: 'on', tags: 'Säuren, Basen' }));
  ok(await admin('aufgabe.bearbeiten', { id, titel: 'Zentrale Aufgabe (überarbeitet)', anweisung: 'Eine zentrale Aufgabe für alle.', fachId: 'chemie', bibliothek: 'on' }));
  ok(await admin('aufgabe.zuweisen', { id, klassen: ['10a'], faellig: morgen(jetzt()) }));
  ok(await admin('admin.aufgabeSperren', { id, gesperrt: true, grund: 'Fehler in der Anweisung' }));
  const yil = await als(b, 'murat.yilmaz', PW);
  verboten(await yil('aufgabe.zuweisen', { id, klassen: ['9a'], faellig: morgen(jetzt()) }), 409);
  assert.ok(!ok(await yil('aufgaben.bibliothek', {})).liste.some(a => a.id === id), 'gesperrt: nicht mehr in der Bibliothek');
  const leon = await als(b, 'leon.schmitt');
  const zid = b._db().zuweisungen.find(z => z.aufgabeId === id).id;
  assert.equal(ok(await leon('schueler.aufgabe', { id: zid })).bearbeitbar, false, 'gesperrt: nicht mehr bearbeitbar');
  verboten(await leon('schueler.speichern', { id: zid, text: 'x', abgeben: true }), 409);
  ok(await admin('admin.aufgabeSperren', { id, gesperrt: false }));
  ok(await admin('aufgabe.status', { id, status: 'archiviert' }));
  ok(await admin('aufgabe.status', { id, status: 'veroeffentlicht' }));
  // Löschen nur ohne Abgaben und ohne laufende Zuweisungen
  const ohm = b._db().aufgaben.find(a => a.titel.startsWith('Messprotokoll'));
  verboten(await admin('admin.aufgabeLoeschen', { id: ohm.id }), 409);
  verboten(await admin('admin.aufgabeLoeschen', { id }), 409);
  const leer = ok(await admin('aufgabe.erstellen', { titel: 'Wegwerf', anweisung: 'Wird gleich gelöscht.', fachId: 'physik' }));
  ok(await admin('admin.aufgabeLoeschen', { id: leer.id }));
  // Filter
  assert.ok(ok(await admin('aufgaben.liste', { alle: true, status: 'bibliothek' })).every(a => a.bibliothek));
  assert.ok(ok(await admin('aufgaben.liste', { alle: true, fach: 'biologie' })).every(a => a.fachId === 'biologie'));
  assert.ok(ok(await admin('aufgaben.liste', { alle: true, klasse: '10a' })).length >= 2);
  const verlauf = ok(await admin('aufgabe.details', { id })).verlauf.map(v => v.aktion).join(' | ');
  assert.match(verlauf, /gesperrt.*|entsperrt/);
  for (const a of ['aufgabe_gesperrt', 'aufgabe_entsperrt', 'aufgabe_archiviert', 'aufgabe_veroeffentlicht_wiederhergestellt', 'aufgabe_geloescht']) assert.ok(b._db().audit.some(l => l.aktion === a), a);
});

test('11 · Jede Aktion prüft Rechte auch bei direkten Aufrufen', async () => {
  const { b } = neu();
  const lena = await als(b, 'lena.hoffmann'), kel = await als(b, 'sabine.keller', PW), admin = await als(b, 'petra.lindner', PW);
  const rechte = b.RECHTE;
  for (const { name, recht } of b.aktionen()) {
    for (const [rolle, f] of [['student', lena], ['teacher', kel], ['admin', admin]]) {
      if (rechte[rolle].includes(recht)) continue;
      const r = await f(name, { id: 'u1' });
      assert.equal(r.code, 403, `${rolle} → ${name}`);
    }
  }
  verboten(await kel('gibt-es-nicht'), 404);
});

test('12 · Passwörter nur als Argon2id-Hash; Rollenwechsel verlangt erneute Bestätigung', async () => {
  const { b, sp } = neu();
  const admin = await als(b, 'petra.lindner', PW);
  const roh = [...sp._m.values()].join('');
  assert.ok(!roh.includes(PW), 'kein Klartext im Speicher');
  for (const u of b._db().users) {
    if (u.rolle === 'student') assert.equal(u.pwHash, null);
    else assert.match(u.pwHash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  }
  // Neues Lehrerkonto: Passwort wird mit eigenem Salt gehasht
  const neuK = ok(await admin('admin.benutzerErstellen', { vorname: 'Anna', nachname: 'Test', rolle: 'teacher', passwort: 'Ein-langes-Passwort' }));
  const anna = b._db().users.find(u => u.id === neuK.id);
  assert.match(anna.pwHash, /^\$argon2id\$/);
  assert.ok(!JSON.stringify(b._db()).includes('Ein-langes-Passwort'));
  assert.ok((await login(b, neuK.username, 'Ein-langes-Passwort')).ok);
  verboten(await admin('admin.benutzerErstellen', { vorname: 'Kurz', nachname: 'Pw', rolle: 'teacher', passwort: 'kurz' }), 400);
  // Rollenwechsel: falsches eigenes Passwort → abgelehnt
  const lenaId = b._db().users.find(u => u.username === 'lena.hoffmann').id;
  verboten(await admin('admin.rolle', { id: lenaId, rolle: 'admin', passwort: 'falsch' }));
  assert.equal(b._db().users.find(u => u.id === lenaId).rolle, 'student');
  verboten(await admin('admin.rolle', { id: lenaId, rolle: 'teacher', passwort: PW }), 400);   // Lehrkraft braucht Passwort
  ok(await admin('admin.rolle', { id: lenaId, rolle: 'teacher', passwort: PW, neuesPasswort: 'Neues-Lehrer-Passwort' }));
  assert.equal(b._db().users.find(u => u.id === lenaId).rolle, 'teacher');
  assert.equal(b._db().mitgliedschaften.filter(m => m.userId === lenaId).length, 0);
  assert.ok(ok(await admin('admin.uebersicht')).auffaellig !== undefined);
  // Zweimal Schüler → Admin → als auffällig gemeldet
  const benId = b._db().users.find(u => u.username === 'ben.hartmann').id;
  ok(await admin('admin.rolle', { id: benId, rolle: 'admin', passwort: PW, neuesPasswort: 'Admin-Passwort-123' }));
  assert.ok(ok(await admin('admin.uebersicht')).auffaellig.some(x => /Schülerkonto direkt/.test(x.grund)));
});

test('13 · Fehlerhafte Eingaben werden abgewiesen', async () => {
  const { b, jetzt } = neu();
  const kel = await als(b, 'sabine.keller', PW);
  verboten(await kel('aufgabe.erstellen', { titel: '', anweisung: 'Eine Anweisung mit Text.', fachId: 'physik' }), 400);
  verboten(await kel('aufgabe.erstellen', { titel: 'Gut', anweisung: 'Eine Anweisung mit Text.', fachId: 'latein' }), 400);
  verboten(await kel('aufgabe.erstellen', { titel: 'Gut', anweisung: 'Eine Anweisung mit Text.', fachId: 'physik', minuten: '9999' }), 400);
  verboten(await kel('aufgabe.erstellen', { titel: 'Gut', anweisung: 'Eine Anweisung mit Text.', fachId: 'physik', themaId: 'ch-k9-alkane' }), 400);
  verboten(await kel('aufgabe.erstellen', { titel: 'x'.repeat(200), anweisung: 'Eine Anweisung mit Text.', fachId: 'physik' }), 400);
  verboten(await kel('aufgabe.erstellen', { titel: { $ne: 1 }, anweisung: 'Eine Anweisung mit Text.', fachId: 'physik' }), 400);
  const r = await kel('aufgabe.erstellen', { titel: 'Gut', anweisung: 'kurz', fachId: 'physik' });
  verboten(r, 400);
  assert.ok(r.felder.anweisung);
  const { id } = ok(await kel('aufgabe.erstellen', { titel: 'Gut', anweisung: 'Eine Anweisung mit Text.', fachId: 'physik', status: 'veroeffentlicht' }));
  verboten(await kel('aufgabe.zuweisen', { id, klassen: ['9a'], faellig: '2020-01-01' }), 400);
  verboten(await kel('aufgabe.zuweisen', { id, klassen: ['9a'], faellig: 'morgen' }), 400);
  verboten(await kel('aufgabe.zuweisen', { id, klassen: ['9a'], faellig: morgen(jetzt()), }).then(() => kel('aufgabe.zuweisen', { id, klassen: ['9a'], faellig: morgen(jetzt()) })), 409);
  verboten(await kel('material.erstellen', { klasseId: '9a', titel: 'Link', link: 'javascript:alert(1)' }), 400);
  verboten(await kel('lehrer.klasse', { id: '../9a' }), 400);
  const lena = await als(b, 'lena.hoffmann');
  verboten(await lena('schueler.speichern', { id: b._db().zuweisungen.find(z => z.klasseId === '10a').id, text: 'x', abgeben: true }), 404);
  verboten(await lena('lernstand.versuch', { e: 'gibt-es-nicht', c: true }), 404);
  const zid = ok(await lena('schueler.uebersicht')).aufgaben.liste.find(x => x.status !== 'korrigiert' && x.status !== 'abgegeben').zuweisungId;
  verboten(await lena('schueler.speichern', { id: zid, text: '', abgeben: true }), 400);
  verboten(await lena('schueler.speichern', { id: zid, text: 'x'.repeat(6000) }), 400);
});

test('14 · Benachrichtigungen nur an die Betroffenen', async () => {
  const { b, jetzt } = neu();
  const db0 = b._db();
  const vorher = id => db0.benachrichtigungen.filter(n => n.userId === id).length;
  const ids = n => b._db().users.find(u => u.username === n).id;
  const zaehle = n => b._db().benachrichtigungen.filter(x => x.userId === ids(n)).length;
  const start = Object.fromEntries(['lena.hoffmann', 'emma.richter', 'hannah.wolf', 'jonas.becker'].map(n => [n, vorher(ids(n))]));
  const bra = await als(b, 'julia.brandt', PW);
  ok(await bra('ankuendigung.erstellen', { klassen: ['10a'], titel: 'Exkursion', text: 'Am Montag geht es in den Zoo.' }));
  assert.equal(zaehle('hannah.wolf'), start['hannah.wolf'] + 1);
  assert.equal(zaehle('lena.hoffmann'), start['lena.hoffmann']);
  assert.equal(zaehle('emma.richter'), start['emma.richter']);
  assert.equal(b._db().benachrichtigungen.filter(n => n.userId === ids('tim.lorenz') && n.typ === 'ankuendigung').length, 0, 'deaktiviertes Konto bekommt nichts');
  const { id } = ok(await bra('aufgabe.erstellen', { titel: 'Nur 9b', anweisung: 'Eine Anweisung mit Text.', fachId: 'biologie', status: 'veroeffentlicht' }));
  ok(await bra('aufgabe.zuweisen', { id, klassen: ['9b'], faellig: morgen(jetzt()) }));
  assert.equal(zaehle('emma.richter'), start['emma.richter'] + 1);
  assert.equal(zaehle('lena.hoffmann'), start['lena.hoffmann']);
  // Fremde Mitteilungen können nicht gelesen oder als gelesen markiert werden
  const lena = await als(b, 'lena.hoffmann'), emma = await als(b, 'emma.richter');
  const emmasN = ok(await emma('mitteilungen.liste'))[0];
  assert.ok(!ok(await lena('mitteilungen.liste')).some(n => n.id === emmasN.id));
  verboten(await lena('mitteilungen.gelesen', { ids: [emmasN.id] }), 404);
  assert.equal(b._db().benachrichtigungen.find(n => n.id === emmasN.id).gelesen, false);
  // Admin schaltet eine Mitteilungsart ab
  const admin = await als(b, 'petra.lindner', PW);
  const sys = ok(await admin('admin.system'));
  const form = { wartung: false, sitzungMinuten: 60 };
  for (const k of Object.keys(sys.funktionen)) form['f_' + k] = 'on';
  for (const k of Object.keys(sys.benachrichtigungen)) if (k !== 'ankuendigung') form['b_' + k] = 'on';
  ok(await admin('admin.einstellungen', form));
  ok(await bra('ankuendigung.erstellen', { klassen: ['10a'], titel: 'Noch eine', text: 'Ohne Mitteilung.' }));
  assert.equal(zaehle('hannah.wolf'), start['hannah.wolf'] + 1);
});

test('15 · Bestehende Lernfunktionen: Lernstand je Konto; Funktionen und Wartungsmodus schaltbar', async () => {
  const { b } = neu();
  const lena = await als(b, 'lena.hoffmann'), emma = await als(b, 'emma.richter');
  const e = inhalte.topics.find(t => t.id === 'k9-ohmsches-gesetz').uebungen[0];
  const vorher = ok(await emma('lernstand.lesen')).attempts.length;
  ok(await lena('lernstand.versuch', { e, c: true }));
  ok(await lena('lernstand.verstanden', { t: 'k9-ohmsches-gesetz' }));
  ok(await lena('lernstand.lektion', { slug: 'k9-ohmsches-gesetz' }));
  const ls = ok(await lena('lernstand.lesen'));
  assert.equal(ls.attempts.at(-1).e, e);
  assert.ok(ls.understood.includes('k9-ohmsches-gesetz'));
  assert.equal(ok(await emma('lernstand.lesen')).attempts.length, vorher, 'Lernstand ist je Konto getrennt');
  const f = ok(await lena('schueler.uebersicht')).fortschritt;
  assert.ok(f.proFach.some(p => p.fach === 'physik' && p.geloest > 0));
  // Funktionen abschalten
  const admin = await als(b, 'petra.lindner', PW);
  const sys = ok(await admin('admin.system'));
  const form = { wartung: 'on', wartungstext: 'Kurze Wartung', sitzungMinuten: 60 };
  for (const k of Object.keys(sys.funktionen)) if (k !== 'uebungen') form['f_' + k] = 'on';
  for (const k of Object.keys(sys.benachrichtigungen)) form['b_' + k] = 'on';
  ok(await admin('admin.einstellungen', form));
  const w = await lena('lernstand.versuch', { e, c: true });
  verboten(w, 503);
  assert.equal(w.fehler, 'Kurze Wartung');
  ok(await lena('konto.ich'));
  ok(await admin('admin.uebersicht'));
  delete form.wartung;
  ok(await admin('admin.einstellungen', form));
  verboten(await lena('lernstand.versuch', { e, c: true }), 403);
  assert.ok(b._db().audit.some(l => l.aktion === 'einstellungen_geaendert' && /Wartungsmodus an/.test(l.details)));
});

test('17 · Datenbank: Startdaten konsistent, Migration erhält Daten, Zurücksetzen nur mit Bestätigung', async () => {
  const { b, sp } = neu();
  assert.deepEqual(plain(b._integritaet()), []);
  const db = b._db();
  // Jeder Schüler in genau einer Klasse, jede Lehrkraft mit Unterricht, jede Zuweisung an eine zugeordnete Lehrkraft
  for (const u of db.users.filter(u => u.rolle === 'student')) assert.equal(db.mitgliedschaften.filter(m => m.userId === u.id && db.klassen.find(k => k.id === m.klasseId).typ === 'klasse').length, 1, u.username);
  for (const u of db.users.filter(u => u.rolle === 'teacher')) assert.ok(db.lehrerzuordnungen.some(z => z.lehrerId === u.id), u.username);
  for (const z of db.zuweisungen) {
    const a = db.aufgaben.find(x => x.id === z.aufgabeId);
    const l = db.users.find(u => u.id === z.lehrerId);
    assert.ok(l.rolle === 'admin' || db.lehrerzuordnungen.some(x => x.lehrerId === l.id && x.klasseId === z.klasseId && x.fachId === a.fachId), `${a.titel} → ${z.klasseId}`);
  }
  for (const a of db.aufgaben) for (const m of a.material) {
    assert.match(m, /^(thema|lektion|sandbox):[a-z0-9-]+$|^https:\/\//, `${a.titel}: Material ${m}`);
    if (m.startsWith('thema:')) assert.ok(inhalte.topics.some(t => t.id === m.slice(6)), m);
  }
  for (const ab of db.abgaben) {
    const z = db.zuweisungen.find(x => x.id === ab.zuweisungId);
    assert.ok(db.mitgliedschaften.some(m => m.userId === ab.schuelerId && m.klasseId === z.klasseId), 'Abgabe nur von Mitgliedern');
  }
  // Migration von Version 1 auf 2
  const alt = JSON.parse(sp.getItem(ctx.SchulBackend.SPEICHER_SCHLUESSEL));
  alt.version = 1; delete alt.einstellungen.sitzungMinuten; alt.aufgaben.forEach(a => delete a.hinweiseFreigabe);
  const sp2 = speicher(); sp2.setItem(ctx.SchulBackend.SPEICHER_SCHLUESSEL, JSON.stringify(alt));
  const { b: b2 } = neu({ speicher: sp2 });
  const m = b2._db();
  assert.equal(m.version, ctx.SchulBackend.VERSION);
  assert.equal(m.einstellungen.sitzungMinuten, 60);
  assert.ok(m.aufgaben.every(a => a.hinweiseFreigabe === 'sofort'));
  assert.equal(m.abgaben.length, alt.abgaben.length, 'Daten bleiben erhalten');
  // Version 3: Fach Ethik ergänzt, ohne bestehende Fächer zu verändern
  const altOhneEthik = JSON.parse(JSON.stringify(alt)); altOhneEthik.faecher = altOhneEthik.faecher.filter(f => f.id !== 'ethik');
  altOhneEthik.lehrerzuordnungen = altOhneEthik.lehrerzuordnungen.filter(z => z.fachId !== 'ethik');
  const sp4 = speicher(); sp4.setItem(ctx.SchulBackend.SPEICHER_SCHLUESSEL, JSON.stringify(altOhneEthik));
  const m3 = neu({ speicher: sp4 }).b._db();
  assert.ok(m3.faecher.some(f => f.id === 'ethik' && f.lernbereiche.length >= 16), 'Ethik mit Lernbereichen (Thema 8 und 14 haben denselben Titel)');
  assert.equal(m3.faecher.length, altOhneEthik.faecher.length + 1);
  assert.ok(m3.lehrerzuordnungen.some(z => z.fachId === 'ethik' && z.klasseId === '9a'));
  assert.ok(m.audit.some(l => l.aktion === 'migration'));
  assert.deepEqual(plain(b2._integritaet()), []);
  // Zurücksetzen
  const admin = await als(b, 'petra.lindner', PW);
  ok(await admin('admin.benutzerErstellen', { vorname: 'Neu', nachname: 'Schüler', rolle: 'student', klasse: '9a' }));
  verboten(await admin('admin.zuruecksetzen', { bestaetigung: 'ja' }), 400);
  ok(await admin('admin.zuruecksetzen', { bestaetigung: 'TESTDATEN ZURÜCKSETZEN' }));
  assert.ok(!b._db().users.some(u => u.username === 'neu.schueler'));
  verboten(await admin('konto.ich'), 401);   // alle Sitzungen beendet
  // Kaputter Speicher → saubere Neuanlage statt Absturz
  const sp3 = speicher(); sp3.setItem(ctx.SchulBackend.SPEICHER_SCHLUESSEL, '{kaputt');
  assert.deepEqual(plain(neu({ speicher: sp3 }).b._integritaet()), []);
});

test('Suche und Export beachten Berechtigungen', async () => {
  const { b } = neu();
  const lena = await als(b, 'lena.hoffmann'), kel = await als(b, 'sabine.keller', PW), admin = await als(b, 'petra.lindner', PW);
  const s1 = ok(await lena('suche', { q: 'Kreuzung' }));
  assert.equal(s1.aufgaben.length, 0, 'Schülerin findet keine fremden Aufgaben');
  assert.equal(s1.personen.length, 0);
  assert.ok(ok(await lena('suche', { q: 'Ohm' })).themen.length > 0);
  const s2 = ok(await kel('suche', { q: 'Wolf' }));
  assert.equal(s2.personen.length, 0, 'Hannah Wolf (10a) ist nicht Kellers Schülerin');
  assert.ok(ok(await kel('suche', { q: 'Becker' })).personen.length === 1);
  assert.ok(ok(await admin('suche', { q: 'Wolf' })).personen.length === 1);
  const csv = ok(await admin('admin.export')).csv;
  assert.match(csv, /^Klasse;Typ;/);
  assert.ok(!/Hoffmann|lena/.test(csv), 'Export ohne Namen');
  verboten(await kel('admin.export'));
});
