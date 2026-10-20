// Startet den Server mit einer leeren Test-Datenbank und prüft die wichtigsten Abläufe.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
let server, dataDir, smtp;
const SMTP_PORT = 2600 + Math.floor(Math.random() * 300);
const mails = [];

/** Minimaler Test-Mailserver (ohne TLS, ohne Anmeldung): nimmt Nachrichten an und merkt sie sich. */
function testMailserver(port) {
  const s = net.createServer(sock => {
    let puffer = '', daten = false, mail = { an: [], roh: '' };
    sock.write('220 test ESMTP\r\n');
    sock.on('data', d => {
      puffer += d.toString('latin1');
      let i;
      while ((i = daten ? puffer.indexOf('\r\n.\r\n') : puffer.indexOf('\r\n')) >= 0) {
        if (daten) {
          mail.roh = puffer.slice(0, i); puffer = puffer.slice(i + 5); daten = false;
          mails.push(mail); mail = { an: [], roh: '' };
          sock.write('250 OK\r\n'); continue;
        }
        const zeile = puffer.slice(0, i); puffer = puffer.slice(i + 2);
        const cmd = zeile.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-test\r\n250 8BITMIME\r\n');
        else if (cmd === 'MAIL') { mail.von = zeile; sock.write('250 OK\r\n'); }
        else if (cmd === 'RCPT') { mail.an.push(zeile); sock.write('250 OK\r\n'); }
        else if (cmd === 'DATA') { daten = true; sock.write('354 weiter\r\n'); }
        else if (cmd === 'QUIT') { sock.end('221 tschuess\r\n'); }
        else sock.write('250 OK\r\n');
      }
    });
  });
  return new Promise(r => s.listen(port, '127.0.0.1', () => r(s)));
}
/** Kopfzeilen und Text einer Mail lesbar machen (Encoded Words, quoted-printable, base64). */
function lesbar(roh) {
  const [kopf, ...rest] = roh.split('\r\n\r\n');
  const dekodiere = (zs, art, t) => Buffer.from(art.toUpperCase() === 'B' ? Buffer.from(t, 'base64') : Buffer.from(t.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1')).toString(zs.toLowerCase() === 'utf-8' ? 'utf8' : 'latin1');
  const k = kopf.replace(/\r\n[ \t]+/g, ' ').replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, zs, art, t) => dekodiere(zs, art, t));
  let text = rest.join('\r\n\r\n');
  if (/content-transfer-encoding: quoted-printable/i.test(k)) text = Buffer.from(text.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
  else if (/content-transfer-encoding: base64/i.test(k)) text = Buffer.from(text, 'base64').toString('utf8');
  return { kopf: k, text: text.replace(/\r\n/g, '\n') };
}

class Client {
  constructor() { this.cookies = new Map(); }
  async req(url, opts = {}) {
    const headers = { ...(opts.headers || {}), cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (opts.method === 'POST') headers.origin = BASE;
    const r = await fetch(BASE + url, { ...opts, headers, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.cookies.set(kv.slice(0, i), kv.slice(i + 1)); }
    return r;
  }
  async login(username, role, email) {
    const body = new URLSearchParams({ username, role, email: email || `${username}@schule.de` });
    const r = await this.req('/auth/dev', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(r.status, 302, 'Login sollte weiterleiten');
    return this;
  }
  json(url, body) { return this.req(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }); }
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lernseite-test-'));
  smtp = await testMailserver(SMTP_PORT);
  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), BASE_URL: BASE, DATA_DIR: dataDir, DEV_LOGIN: 'true', ROSTER_REQUIRED: 'true', SESSION_SECRET: 'test-secret-123', ISERV_URL: '', ISERV_CLIENT_ID: '', ISERV_CLIENT_SECRET: '',
      SMTP_HOST: '127.0.0.1', SMTP_PORT: String(SMTP_PORT), SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'false', SMTP_USER: '', SMTP_PASS: '',
      SMTP_FROM: 'lernseite@schule.de', FEEDBACK_AN: 'empfang@schule.de' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stderr.on('data', d => { log += d; });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', d => { log += d; if (String(d).includes('läuft auf Port')) resolve(); });
    server.on('exit', code => reject(new Error(`Server beendet (${code}):\n${log}`)));
    setTimeout(() => reject(new Error(`Server startet nicht:\n${log}`)), 8000);
  });
});

after(() => { server?.kill(); smtp?.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('Ohne Anmeldung: Login-Seite, geschützte Seiten leiten um', async () => {
  const c = new Client();
  assert.match(await (await c.req('/')).text(), /Test-Login/);
  assert.equal((await c.req('/physik')).status, 302);
  assert.equal((await c.json('/api/uebung/k9-ss-01', { antwort: { wahl: '1' } })).status, 401);
});

test('Schülerliste, Klassenstufe, Übungen, Fortschritt und Lehrer-Übersicht', async () => {
  const admin = await new Client().login('chef', 'admin');
  const roster = 'E-Mail;Name;Klasse\nmax@schule.de;Max Muster;9a\nerika@schule.de;Erika Beispiel;10b';
  const up = await admin.req('/admin/schuelerliste', { method: 'POST', body: new URLSearchParams({ csv: roster }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(up.status, 302);

  // Nicht in der Liste → kein Zugang
  const r = await new Client().req('/auth/dev', { method: 'POST', body: new URLSearchParams({ username: 'fremd', role: 'student', email: 'fremd@schule.de' }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(r.status, 403);

  const max = await new Client().login('max', 'student', 'max@schule.de');
  const home = await (await max.req('/')).text();
  assert.match(home, /class="grade-name">Physik</);
  assert.match(home, /href="\/physik\/9"/, 'Startseite führt zur eigenen Klassenstufe');
  assert.doesNotMatch(home, /Stromkreis-Labor/, 'Themen-Lektionen erscheinen nicht doppelt auf der Startseite');

  const picker = await (await max.req('/physik')).text();
  for (const g of [7, 8, 9, 10]) assert.match(picker, new RegExp(`href="/physik/${g}"`));
  assert.doesNotMatch(picker, /href="\/physik\/5"/);
  assert.equal((await max.req('/physik/5')).status, 404);
  assert.match(picker, /Deine Klasse/);

  const k9 = await (await max.req('/physik/9')).text();
  assert.match(k9, /3\.6/); assert.match(k9, /Widerstand und ohmsches Gesetz/);
  const k10 = await (await max.req('/physik/10')).text();
  assert.match(k10, /3\.7/); assert.match(k10, /Gleichmäßig beschleunigte Bewegung/);
  for (const g of [7, 8]) assert.doesNotMatch(await (await max.req(`/physik/${g}`)).text(), /In Vorbereitung/);

  const verstehen = await (await max.req('/physik/9/k9-ohmsches-gesetz')).text();
  assert.match(verstehen, /Das lernst du hier/);
  assert.match(verstehen, /\/inhalt\/k9-ohmsches-gesetz\/index\.html/);
  assert.match(verstehen, /class="frac"/);
  assert.equal((await max.req('/physik/10/k9-ohmsches-gesetz')).status, 404, 'Thema nur unter seiner Klassenstufe');

  const ueben = await (await max.req('/physik/9/k9-ohmsches-gesetz/ueben')).text();
  assert.match(ueben, /data-id="k9-oh-01"/);
  assert.doesNotMatch(ueben, /"richtig"|data-ok/, 'Lösungen dürfen nicht im Seitenquelltext stehen');

  // Falsch → kein Lösungstext; richtig → Lösung, Erklärung und Fortschritt
  let res = await (await max.json('/api/uebung/k9-oh-01', { antwort: { wahl: '0' } })).json();
  assert.equal(res.status, 'falsch'); assert.equal(res.loesung, undefined); assert.equal(res.fortschritt.done, 0);
  res = await (await max.json('/api/uebung/k9-oh-01', { antwort: { wahl: '1' } })).json();
  assert.equal(res.status, 'richtig'); assert.ok(res.erklaerung); assert.equal(res.fortschritt.done, 1);
  res = await (await max.json('/api/uebung/k9-oh-02', { antwort: { wert: '24' } })).json();
  assert.equal(res.status, 'richtig'); assert.equal(res.fortschritt.done, 2);

  // Lösung zeigen → spätere richtige Antwort zählt nicht
  res = await (await max.json('/api/uebung/k9-oh-04/loesung', {})).json();
  assert.equal(res.status, 'geloest');
  res = await (await max.json('/api/uebung/k9-oh-04', { antwort: { wahl: '0' } })).json();
  assert.equal(res.status, 'richtig'); assert.equal(res.fortschritt.done, 2);

  // Freitext + Selbsteinschätzung
  res = await (await max.json('/api/uebung/k9-oh-08', { antwort: { text: 'Die Atomrümpfe schwingen stärker, die Elektronen stoßen öfter.' } })).json();
  assert.equal(res.status, 'selbst');
  res = await (await max.json('/api/uebung/k9-oh-08/selbst', { ok: true })).json();
  assert.equal(res.fortschritt.done, 3);

  // Fehler verständlich
  const bad = await max.json('/api/uebung/k9-oh-02', { antwort: { wert: 'viel' } });
  assert.equal(bad.status, 400); assert.match((await bad.json()).error, /Zahl/);
  assert.equal((await max.json('/api/uebung/gibts-nicht', { antwort: {} })).status, 404);

  // Verstanden
  res = await (await max.json('/api/verstanden/k9-ohmsches-gesetz', { done: true })).json();
  assert.equal(res.fortschritt.verstanden, true);
  assert.match(await (await max.req('/physik/9')).text(), /✓ Verstanden/);

  // Zweites Fach: TIMP (Klasse 8 und 9) mit eigenen Seiten und eigenem Fortschritt
  assert.match(home, /class="grade-name">TIMP</);
  assert.match(home, /href="\/timp\/9"/);
  const timp = await (await max.req('/timp')).text();
  assert.match(timp, /href="\/timp\/8"/); assert.match(timp, /href="\/timp\/9"/);
  assert.doesNotMatch(timp, /href="\/timp\/10"/);
  assert.equal((await max.req('/timp/10')).status, 404);
  assert.match(await (await max.req('/timp/8')).text(), /Logische Schaltungen/);
  const prog = await (await max.req('/timp/9/timp-k9-schleifen')).text();
  assert.match(prog, /\/inhalt\/timp-programmierlabor\/index\.html/);
  assert.match(prog, /href="\/timp"/, 'Brotkrümel führen ins Fach');
  assert.equal((await max.req('/physik/9/timp-k9-schleifen')).status, 404, 'Thema nur in seinem Fach');
  assert.equal((await max.req('/timp/9/k9-ohmsches-gesetz')).status, 404);
  assert.match(await (await max.req('/timp/9/timp-k9-schleifen/ueben')).text(), /data-id="timp-sl-01"/);
  res = await (await max.json('/api/verstanden/timp-k9-schleifen', { done: true })).json();
  assert.equal(res.fortschritt.verstanden, true);
  assert.equal((await max.req('/gibts-nicht')).status, 404);

  // Drittes Fach: Chemie (Klasse 7 bis 10)
  assert.match(home, /class="grade-name">Chemie</);
  assert.match(await (await max.req('/chemie/9')).text(), /Säuren und Laugen/);
  const ester = await (await max.req('/chemie/10/ch-k10-ester')).text();
  assert.match(ester, /\/inhalt\/ch-veresterung\/index\.html/);
  assert.equal((await max.req('/physik/10/ch-k10-ester')).status, 404);

  // Viertes Fach: Biologie, mit gesperrtem Themenfeld (Klasse 7, Sexualität)
  assert.match(home, /class="grade-name">Biologie</);
  const mendel = await (await max.req('/biologie/10/bio-k10-mendel')).text();
  assert.match(mendel, /\/inhalt\/bio-mendel\/index\.html/);
  const bio7 = await (await max.req('/biologie/7')).text();
  assert.match(bio7, /Pubertät und Hormone/, 'gesperrtes Thema ist sichtbar');
  assert.match(bio7, /class="card topic locked"/);
  assert.doesNotMatch(bio7, /href="\/biologie\/7\/bio-k7-pubertaet"/, 'gesperrtes Thema ist nicht verlinkt');
  assert.match(bio7, /href="\/biologie\/7\/bio-k7-zellaufbau"/);
  assert.equal((await max.req('/biologie/7/bio-k7-pubertaet')).status, 403);
  assert.equal((await max.req('/biologie/7/bio-k7-pubertaet/ueben')).status, 403);
  assert.equal((await max.json('/api/uebung/bio-pub-02', { antwort: { wahl: '0' } })).status, 403);
  assert.equal((await max.json('/api/uebung/bio-pub-02/loesung', {})).status, 403);
  assert.equal((await max.json('/api/verstanden/bio-k7-pubertaet', { done: true })).status, 403);

  // Schüler dürfen nicht in die Verwaltung
  assert.equal((await max.req('/admin')).status, 403);

  // Lehrkraft sieht den Fortschritt der Klasse 9a
  const teacher = await new Client().login('lehrer', 'teacher');
  const adm = await (await teacher.req('/admin?klasse=9a')).text();
  assert.match(adm, /Physik · Klasse 9/);
  assert.match(adm, /TIMP · Klasse 9/);
  assert.match(adm, /Schleifen: 0\/7, verstanden/);
  assert.match(adm, /Max Muster/);
  assert.match(adm, /Widerstand und ohmsches Gesetz: 3\/10, verstanden/);
});

test('Bestehende Funktionen: Lektionen, alter Fortschritt, Inhalte nur angemeldet', async () => {
  const t = await new Client().login('lehrer2', 'teacher');
  assert.equal((await t.req('/lektion/dioden-schaltung')).status, 200);
  assert.equal((await t.req('/lektion/ohmsches-gesetz')).status, 200);
  assert.equal((await t.json('/api/fortschritt', { slug: 'ohmsches-gesetz', done: true })).status, 200);
  assert.equal((await t.req('/inhalt/k9-halbwertszeit/index.html')).status, 200);
  assert.equal((await new Client().req('/inhalt/k9-halbwertszeit/index.html')).status, 302);
  assert.equal((await t.req('/static/lesson-kit.js')).status, 200);
});

test('Sandbox: Simulationsübersicht, Schaltkreis-Labor und Rückweg zur Fachübersicht', async () => {
  const t = await new Client().login('sandkasten', 'teacher');
  const home = await (await t.req('/')).text();
  assert.match(home, /class="eyebrow">Sandbox</);
  assert.match(home, /href="\/sandbox"/);
  assert.doesNotMatch(home, /href="\/lektion\/sandbox-schaltkreis"/, 'Simulation erscheint nicht doppelt als Lerneinheit');
  const nav = await (await t.req('/physik')).text();
  assert.match(nav, /<a href="\/sandbox">Sandbox<\/a>/, 'Sandbox im Hauptmenü');

  const uebersicht = await (await t.req('/sandbox')).text();
  assert.match(uebersicht, /Schaltkreis-Labor/);
  assert.match(uebersicht, /Baue eigene elektrische Schaltungen und untersuche Spannung, Stromstärke und Widerstand\./);
  assert.match(uebersicht, /href="\/sandbox\/schaltkreis"/);
  assert.doesNotMatch(uebersicht, /grade-card/, 'keine Klassenstufen');

  const labor = await (await t.req('/sandbox/schaltkreis')).text();
  assert.match(labor, /src="\/inhalt\/sandbox-schaltkreis\/index\.html"/);
  assert.match(labor, /<a href="\/sandbox" class="back">← Sandbox<\/a>/, 'Rückweg zur Sandbox-Übersicht');
  for (const f of ['index.html', 'modell.js', 'simulation.js', 'bedienung.js', 'zeichnen.js', 'labor.js', 'labor.css']) {
    assert.equal((await t.req(`/inhalt/sandbox-schaltkreis/${f}`)).status, 200, f);
  }
  assert.equal((await new Client().req('/sandbox/schaltkreis')).status, 302, 'nur angemeldet');
  // Zweite Simulation: Logik-Labor (nutzt Bedienung und Grundlayout des Schaltkreis-Labors mit)
  assert.match(uebersicht, /href="\/sandbox\/logik"/);
  assert.match(uebersicht, /Logik-Labor/);
  assert.doesNotMatch(uebersicht, /⚡|🔀/, 'Schaltzeichen statt Emojis');
  assert.equal((uebersicht.match(/<span class="sim-icon" aria-hidden="true"><svg/g) || []).length, 5);
  // Fünfte Simulation: BioLab
  assert.match(uebersicht, /href="\/sandbox\/biolab"/);
  const bio = await (await t.req('/sandbox/biolab')).text();
  assert.match(bio, /src="\/inhalt\/sandbox-biolab\/index\.html"/);
  for (const f of ['index.html', 'biolab.css', 'ui.js', 'labor.js', 'optik.js', 'modul-genetik.js']) {
    assert.equal((await t.req(`/inhalt/sandbox-biolab/${f}`)).status, 200, f);
  }
  // Vierte Simulation: Netzwerk-Labor (nutzt Bedienung und Grundlayout des Schaltkreis-Labors mit)
  assert.match(uebersicht, /href="\/sandbox\/netzwerk"/);
  const netz = await (await t.req('/sandbox/netzwerk')).text();
  assert.match(netz, /src="\/inhalt\/sandbox-netzwerk\/index\.html"/);
  for (const f of ['index.html', 'netzwerk.css', 'ipv4.js', 'modell.js', 'simulation.js', 'aufgaben.js', 'zeichnen.js', 'netzwerk.js']) {
    assert.equal((await t.req(`/inhalt/sandbox-netzwerk/${f}`)).status, 200, f);
  }
  // Dritte Simulation: Atom- & Chemielabor
  assert.match(uebersicht, /href="\/sandbox\/chemielabor"/);
  assert.match(uebersicht, /Atom- &amp; Chemielabor/);
  const chem = await (await t.req('/sandbox/chemielabor')).text();
  assert.match(chem, /src="\/inhalt\/sandbox-chemielabor\/index\.html"/);
  for (const f of ['index.html', 'chemielabor.css', 'daten-elemente.js', 'chemie.js', 'molekuel.js', 'aufgaben-molekuel.js', 'labor.js']) {
    assert.equal((await t.req(`/inhalt/sandbox-chemielabor/${f}`)).status, 200, f);
  }
  const logik = await (await t.req('/sandbox/logik')).text();
  assert.match(logik, /src="\/inhalt\/sandbox-logik\/index\.html"/);
  assert.match(logik, /<a href="\/sandbox" class="back">← Sandbox<\/a>/);
  const html = await (await t.req('/inhalt/sandbox-logik/index.html')).text();
  assert.match(html, /src="\.\.\/sandbox-schaltkreis\/bedienung\.js"/);
  for (const f of ['modell.js', 'simulation.js', 'wahrheit.js', 'zeichnen.js', 'logik.js', 'logik.css']) {
    assert.equal((await t.req(`/inhalt/sandbox-logik/${f}`)).status, 200, f);
  }
  assert.equal((await t.req('/sandbox/gibts-nicht')).status, 404);
  assert.equal((await t.req('/sandbox/9')).status, 404);
  // Die anderen Fächer funktionieren weiter
  assert.equal((await t.req('/physik/9')).status, 200);
  assert.equal((await t.req('/physik/9/k9-ohmsches-gesetz')).status, 200);
  assert.equal((await t.req('/admin?klasse=9a')).status, 200);
});

test('Impressum und Datenschutzerklärung sind ohne Anmeldung erreichbar und überall verlinkt', async () => {
  const gast = new Client();
  const login = await (await gast.req('/')).text();
  assert.match(login, /href="\/impressum"/);
  assert.match(login, /href="\/datenschutz"/);
  const imp = await gast.req('/impressum');
  assert.equal(imp.status, 200);
  const impText = await imp.text();
  assert.match(impText, /Angaben gemäß § 5 DDG/);
  assert.match(impText, /§ 18 Abs\. 2 MStV/);
  assert.match(impText, /Schulinternen Curriculum \(SchiC\)/);
  assert.doesNotMatch(impText, /ec\.europa\.eu\/consumers\/odr/, 'OS-Plattform gibt es nicht mehr');
  const ds = await gast.req('/datenschutz');
  assert.equal(ds.status, 200);
  const dsText = await ds.text();
  assert.match(dsText, /IServ-Passwort/);
  assert.match(dsText, /12 Stunden/);
  assert.match(dsText, /Art\. 77 DSGVO/);
  const t = await new Client().login('rechtlich', 'teacher');
  assert.match(await (await t.req('/physik')).text(), /<footer class="fuss">/);
});

test('Anfragen von fremden Seiten werden abgelehnt', async () => {
  const c = await new Client().login('anna', 'teacher');
  const r = await fetch(BASE + '/api/verstanden/k9-ohmsches-gesetz', {
    method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie: [...c.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
  });
  assert.equal(r.status, 403);
});

test('Feedback: Seite für alle, Versand per E-Mail nur angemeldet, anonym oder mit Namen, Diagnose nur auf Wunsch', async () => {
  const gast = new Client();
  const login = await (await gast.req('/')).text();
  assert.match(login, /href="\/feedback" id="fb-link"/, 'Fußzeile verlinkt das Feedback');
  assert.match(login, /lernseite-fehler/, 'Fehlerprotokoll auf jeder Seite');
  const seiteGast = await (await gast.req('/feedback?von=/physik/9')).text();
  assert.match(seiteGast, /data-modus="mailto"/, 'ohne Anmeldung: eigenes E-Mail-Programm');
  assert.match(seiteGast, /value="\/physik\/9"/);
  assert.match(seiteGast, /empfang@schule\.de/);
  assert.doesNotMatch(seiteGast, /name="kontakt"/);
  assert.equal((await gast.json('/api/feedback', { kategorie: 'fehler', betreff: 'x', beschreibung: 'y'.repeat(20) })).status, 401);

  const roster = 'E-Mail;Name;Klasse\nfeed@schule.de;Fe Edback;8b';
  const admin = await new Client().login('chef2', 'admin');
  await admin.req('/admin/schuelerliste', { method: 'POST', body: new URLSearchParams({ csv: roster }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const s = await new Client().login('feed', 'student', 'feed@schule.de');
  const seite = await (await s.req('/feedback')).text();
  assert.match(seite, /data-modus="server"/);
  assert.match(seite, /name="kontakt"/);
  assert.match(seite, /type="module" src="\/static\/feedback\.js"/);
  assert.equal((await s.req('/static/feedback-kern.js')).status, 200);

  // Ungültig → 400, nichts verschickt
  const vorher = mails.length;
  const bad = await s.json('/api/feedback', { kategorie: 'fehler', betreff: '', beschreibung: 'kurz' });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /Betreff/);
  assert.equal(mails.length, vorher);

  // Anonym, ohne Diagnose
  let r = await s.json('/api/feedback', { kategorie: 'fehler', betreff: 'Übung kaputt\r\nBcc: x@evil.de', beschreibung: 'Bei Übung 3 passiert nichts, wenn ich prüfe.', seite: '/physik/8', kontakt: false });
  assert.equal(r.status, 200, await r.clone().text());
  assert.deepEqual(await r.json(), { ok: true });
  let m = lesbar(mails.at(-1).roh);
  assert.match(mails.at(-1).an.join(), /empfang@schule\.de/);
  assert.equal(mails.at(-1).an.length, 1, 'keine weiteren Empfänger');
  assert.match(m.kopf, /Subject: \[Lernseite · Feedback\] Fehler melden: Übung kaputt Bcc: x@evil\.de/);
  assert.doesNotMatch(m.kopf, /^Bcc:/mi);
  assert.doesNotMatch(m.kopf, /Reply-To/i);
  assert.match(m.text, /Absender: nicht angegeben \(anonym\)/);
  assert.match(m.text, /Diagnosedaten: nicht mitgeschickt/);
  assert.doesNotMatch(m.text, /Fe Edback|feed@schule/, 'ohne Häkchen kein Name');

  // Mit Namen und Diagnose
  r = await s.json('/api/feedback', { kategorie: 'idee', betreff: 'Mehr Chemie', beschreibung: 'Ein Labor für Säuren und Basen wäre toll.', kontakt: true,
    diagnose: { browser: 'Testbrowser', fehler: '10:00:00 /x – kaputt (a.js:1)', passwort: 'geheim' } });
  assert.equal(r.status, 200);
  m = lesbar(mails.at(-1).roh);
  assert.match(m.kopf, /Reply-To: feed@schule\.de/i);
  assert.match(m.text, /Absender \(freigegeben\): Fe Edback <feed@schule\.de>, Schüler\/in, Klasse 8b/);
  assert.match(m.text, /Browser: Testbrowser/);
  assert.doesNotMatch(m.text, /geheim/, 'unbekannte Diagnosefelder fallen weg');

  // Höchstens 5 pro Stunde und Person
  for (let i = 0; i < 3; i++) assert.equal((await s.json('/api/feedback', { kategorie: 'sonstiges', betreff: 'Test ' + i, beschreibung: 'Noch eine Nachricht zum Test.' })).status, 200);
  const zuviel = await s.json('/api/feedback', { kategorie: 'sonstiges', betreff: 'zu viel', beschreibung: 'Diese Nachricht ist eine zu viel.' });
  assert.equal(zuviel.status, 429);

  // Von fremden Seiten abgelehnt
  const fremd = await fetch(BASE + '/api/feedback', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie: [...s.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } });
  assert.equal(fremd.status, 403);

  // Datenschutzerklärung nennt Feedback und Empfänger
  const ds = await (await gast.req('/datenschutz')).text();
  assert.match(ds, /id="feedback"/);
  assert.match(ds, /empfang@schule\.de/);
});
