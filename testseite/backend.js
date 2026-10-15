// Testseite · Simuliertes Backend für das Schul-, Rollen- und Aufgabensystem.
//
// Die Testseite (GitHub Pages) ist eine statische Datei ohne Server. Dieses Modul spielt deshalb die Rolle des
// Servers: Es hält die Datenbank (im localStorage des Browsers), prüft bei JEDER Aktion Sitzung, Accountstatus und
// Rechte und gibt nur die Daten heraus, die die angemeldete Rolle sehen darf. Die Oberfläche spricht ausschließlich
// über api(token, aktion, daten) mit diesem Modul. Grenzen dieser Simulation: siehe testseite/SICHERHEIT.md.
//
// Kein DOM, keine Netzwerkzugriffe. Getestet in test/testseite-schule.test.mjs.
(function (root) {
  'use strict';

  var VERSION = 4;                       // Schema-Version der Datenbank (Migrationen unten)
  var SPEICHER_SCHLUESSEL = 'lernseite-schule-db';
  var CLIENT_ID = 'lernseite-testseite';
  var MIN = 60 * 1000, TAG = 24 * 60 * MIN;
  var ROLLEN = ['student', 'teacher', 'admin'];
  var ROLLEN_NAME = { student: 'Schüler/in', teacher: 'Lehrkraft', admin: 'Administration' };

  // ------------------------------------------------------------------ Zentrale Rechte
  // Jede Aktion nennt genau ein Recht. Zusätzlich prüfen die Aktionen den Bereich (eigene Klasse, eigene Aufgabe …).
  var RECHTE = {
    student: ['konto', 'lernstand', 'mitteilungen', 'suche', 'schueler.aufgaben', 'schueler.abgeben', 'klasse.lesen'],
    teacher: ['konto', 'lernstand', 'mitteilungen', 'suche', 'lehrer.bereich', 'aufgaben.eigene', 'aufgaben.zuweisen',
      'abgaben.bewerten', 'bibliothek.lesen', 'klassen.eigene', 'ankuendigungen', 'materialien', 'foerderung'],
    admin: ['konto', 'lernstand', 'mitteilungen', 'suche', 'admin.bereich', 'aufgaben.alle', 'aufgaben.eigene', 'aufgaben.zuweisen', 'abgaben.bewerten',
      'bibliothek.lesen', 'bibliothek.verwalten', 'benutzer.verwalten', 'schule.verwalten', 'system.verwalten', 'protokoll.lesen'],
  };
  function hatRecht(rolle, recht) { return !!RECHTE[rolle] && RECHTE[rolle].indexOf(recht) >= 0; }

  var FUNKTIONEN = {
    aufgaben: 'Aufgaben für Schüler/innen', uebungen: 'Übungen auf der Lernseite', sandbox: 'Sandbox-Simulationen',
    ankuendigungen: 'Ankündigungen', materialien: 'Lernmaterialien',
  };
  var BENACHRICHTIGUNGEN = {
    neue_aufgabe: 'Neue Aufgabe', frist: 'Geänderte Abgabefrist', feedback: 'Feedback der Lehrkraft', korrektur: 'Korrektur / erneute Bearbeitung',
    ankuendigung: 'Neue Ankündigung', aufgabe_gesperrt: 'Aufgabe gesperrt oder zurückgezogen',
  };
  var STATUS_AUFGABE = ['entwurf', 'veroeffentlicht', 'archiviert'];
  var SCHWIERIGKEIT = ['leicht', 'mittel', 'schwer'];
  var LOESUNG = ['nie', 'sofort', 'nach_faelligkeit', 'nach_korrektur'];

  // ------------------------------------------------------------------ Fehler und Eingabeprüfung
  function Fehler(text, code, felder) { this.text = text; this.code = code || 400; this.felder = felder || null; }
  function wirf(text, code, felder) { throw new Fehler(text, code, felder); }
  function nichtErlaubt() { wirf('Dafür fehlt dir die Berechtigung.', 403); }
  function nichtGefunden(was) { wirf((was || 'Eintrag') + ' nicht gefunden.', 404); }

  var V = {
    text: function (d, k, o) {
      o = o || {};
      var v = d[k];
      if (v === undefined || v === null) v = '';
      if (typeof v !== 'string') wirf('Ungültige Eingabe.', 400, feld(k, 'Text erwartet.'));
      v = v.replace(/\r\n/g, '\n').trim();
      if (o.pflicht && !v) wirf('Bitte alle Pflichtfelder ausfüllen.', 400, feld(k, 'Pflichtfeld.'));
      if (v && o.min && v.length < o.min) wirf('Eingabe zu kurz.', 400, feld(k, 'Mindestens ' + o.min + ' Zeichen.'));
      if (v.length > (o.max || 200)) wirf('Eingabe zu lang.', 400, feld(k, 'Höchstens ' + (o.max || 200) + ' Zeichen.'));
      if (o.muster && v && !o.muster.test(v)) wirf('Ungültiges Format.', 400, feld(k, 'Ungültiges Format.'));
      return v;
    },
    wahl: function (d, k, liste, std) {
      var v = d[k] === undefined || d[k] === '' ? std : d[k];
      if (liste.indexOf(v) < 0) wirf('Ungültige Auswahl.', 400, feld(k, 'Ungültige Auswahl.'));
      return v;
    },
    zahl: function (d, k, o) {
      var v = d[k];
      if ((v === undefined || v === '' || v === null) && o.std !== undefined) return o.std;
      v = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
      if (typeof v !== 'number' || !isFinite(v) || (o.ganz && Math.floor(v) !== v) || v < o.min || v > o.max) {
        wirf('Ungültige Zahl.', 400, feld(k, 'Zahl von ' + o.min + ' bis ' + o.max + ' erwartet.'));
      }
      return v;
    },
    datum: function (d, k, pflicht) {
      var v = d[k];
      if (!v && !pflicht) return null;
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v + 'T12:00:00Z'))) wirf('Ungültiges Datum.', 400, feld(k, 'Datum im Format JJJJ-MM-TT.'));
      return v;
    },
    bool: function (d, k) { var v = d[k]; return v === true || v === 'true' || v === 'on' || v === '1' || v === 1; },
    liste: function (d, k) { var v = d[k]; if (v === undefined || v === null || v === '') return []; if (!Array.isArray(v)) v = [v]; return v.map(String); },
    id: function (d, k) { var v = d[k]; if (typeof v !== 'string' || !/^[a-z0-9._-]{1,64}$/.test(v)) wirf('Ungültige Kennung.', 400, feld(k, 'Ungültig.')); return v; },
  };
  function feld(k, t) { var o = {}; o[k] = t; return o; }

  // ------------------------------------------------------------------ Hilfen
  function kopie(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function datumIso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hashText(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function initialen(u) { return ((u.vorname || '?')[0] + (u.nachname || '?')[0]).toUpperCase(); }

  // ================================================================== Backend erstellen
  /**
   * opt: speicher (getItem/setItem/removeItem), argon2 (hash-wasm: argon2id, argon2Verify), zufall(n) → Uint8Array,
   *      sha256(text) → Promise<hex>, jetzt() → ms, inhalte { topics: [{id, titel, fach, stufe, uebungen: [id]}], lessons: [{slug, title}] },
   *      daten (SCHULE_DATEN)
   */
  function erstelle(opt) {
    var jetzt = opt.jetzt || function () { return Date.now(); };
    var D = opt.daten;
    var INH = opt.inhalte || { topics: [], lessons: [] };
    var topicById = {}, exTopic = {}, lessonBySlug = {};
    INH.topics.forEach(function (t) { topicById[t.id] = t; t.uebungen.forEach(function (e) { exTopic[e] = t.id; }); });
    (INH.lessons || []).forEach(function (l) { lessonBySlug[l.slug] = l; });
    var db = null;

    // ---------------------------------------------------------------- Speicher und Migrationen
    function speichern() { opt.speicher.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(db)); }
    function laden() {
      var roh = null;
      try { roh = opt.speicher.getItem(SPEICHER_SCHLUESSEL); } catch (e) { roh = null; }
      var neu = null;
      if (roh) { try { neu = JSON.parse(roh); } catch (e) { neu = null; } }
      if (!neu || typeof neu !== 'object' || !neu.version) { db = startdaten(); speichern(); return; }
      db = neu;
      if (db.version < VERSION) migriere();
    }
    // Jede Migration hebt die Datenbank genau eine Version höher. Bestehende Daten bleiben erhalten.
    var MIGRATIONEN = {
      2: function (d) {
        // Version 2: Sitzungsdauer einstellbar, Fächer mit Lernbereichen, Aufgaben mit Hinweis-Freigabe
        d.einstellungen.sitzungMinuten = d.einstellungen.sitzungMinuten || 60;
        d.faecher.forEach(function (f) { if (!Array.isArray(f.lernbereiche)) f.lernbereiche = []; });
        d.aufgaben.forEach(function (a) { if (!a.hinweiseFreigabe) a.hinweiseFreigabe = 'sofort'; });
      },
      3: function (d) {
        // Version 3: neues Fach Ethik (mit Lernbereichen aus den Inhalten) und Ethik-Unterricht von Julia Brandt in 9a
        if (!d.faecher.some(function (f) { return f.id === 'ethik'; })) {
          var lb = [];
          INH.topics.forEach(function (t) { if (t.fach === 'ethik' && t.themenfeld && lb.indexOf(t.themenfeld) < 0) lb.push(t.themenfeld); });
          d.faecher.push({ id: 'ethik', name: 'Ethik', aktiv: true, lernbereiche: lb });
        }
        var bra = d.users.find(function (u) { return u.username === 'julia.brandt' && u.rolle === 'teacher'; });
        if (bra && d.klassen.some(function (k) { return k.id === '9a'; }) && !d.lehrerzuordnungen.some(function (z) { return z.lehrerId === bra.id && z.klasseId === '9a' && z.fachId === 'ethik'; })) {
          d.seq = (d.seq || 0) + 1;
          d.lehrerzuordnungen.push({ id: 'lz' + d.seq, lehrerId: bra.id, klasseId: '9a', fachId: 'ethik' });
        }
      },
      4: function (d) {
        // Version 4: neues Fach Informatik (Wahlpflicht Kl. 10), Kurs wp-inf-10 mit Leon Schmitt und Hannah Wolf, Lehrkraft Tobias Novak
        if (!d.faecher.some(function (f) { return f.id === 'informatik'; })) {
          var lb = [];
          INH.topics.forEach(function (t) { if (t.fach === 'informatik' && t.themenfeld && lb.indexOf(t.themenfeld) < 0) lb.push(t.themenfeld); });
          d.faecher.push({ id: 'informatik', name: 'Informatik', aktiv: true, lernbereiche: lb });
        }
        if (!d.klassen.some(function (k) { return k.id === 'wp-inf-10'; })) {
          d.klassen.push({ id: 'wp-inf-10', name: 'Wahlpflichtkurs Informatik 10', typ: 'kurs', stufe: 10, aktiv: true, leitungId: null });
        }
        ['leon.schmitt', 'hannah.wolf'].forEach(function (name) {
          var s = d.users.find(function (u) { return u.username === name && u.rolle === 'student'; });
          if (s && !d.mitgliedschaften.some(function (m) { return m.userId === s.id && m.klasseId === 'wp-inf-10'; })) d.mitgliedschaften.push({ userId: s.id, klasseId: 'wp-inf-10' });
        });
        var nov = d.users.find(function (u) { return u.username === 'tobias.novak' && u.rolle === 'teacher'; });
        if (nov && !d.lehrerzuordnungen.some(function (z) { return z.lehrerId === nov.id && z.klasseId === 'wp-inf-10' && z.fachId === 'informatik'; })) {
          d.seq = (d.seq || 0) + 1;
          d.lehrerzuordnungen.push({ id: 'lz' + d.seq, lehrerId: nov.id, klasseId: 'wp-inf-10', fachId: 'informatik' });
        }
      },
    };
    function migriere() {
      while (db.version < VERSION) {
        var ziel = db.version + 1;
        MIGRATIONEN[ziel](db);
        db.version = ziel;
        audit(null, 'migration', 'Datenbank', 'Schema auf Version ' + ziel + ' gebracht');
      }
      speichern();
    }
    function nextId(p) { db.seq = (db.seq || 0) + 1; return p + db.seq; }

    // ---------------------------------------------------------------- Startdaten (Seed)
    function startdaten() {
      var t0 = jetzt();
      db = {
        version: VERSION, erstellt: t0, seq: 0,
        users: [], klassen: [], mitgliedschaften: [], lehrerzuordnungen: [], faecher: [],
        aufgaben: [], zuweisungen: [], abgaben: [], feedback: [], benachrichtigungen: [], ankuendigungen: [], materialien: [],
        foerderhinweise: [], lernstand: {}, audit: [], anmeldeversuche: [], sitzungen: [], oauthCodes: [],
        einstellungen: {
          wartung: false, wartungstext: 'Die Testumgebung wird gerade gewartet. Bitte versuche es später noch einmal.',
          funktionen: {}, benachrichtigungen: {}, sitzungMinuten: 60,
        },
      };
      Object.keys(FUNKTIONEN).forEach(function (k) { db.einstellungen.funktionen[k] = true; });
      Object.keys(BENACHRICHTIGUNGEN).forEach(function (k) { db.einstellungen.benachrichtigungen[k] = true; });
      D.FAECHER.forEach(function (f) { db.faecher.push({ id: f.id, name: f.name, aktiv: true, lernbereiche: [] }); });
      INH.topics.forEach(function (t) {
        var f = db.faecher.find(function (x) { return x.id === t.fach; });
        if (f && f.lernbereiche.indexOf(t.themenfeld) < 0 && t.themenfeld) f.lernbereiche.push(t.themenfeld);
      });
      D.KLASSEN.forEach(function (k) { db.klassen.push({ id: k.id, name: k.name, typ: k.typ, stufe: k.stufe, aktiv: true, leitungId: null }); });
      var nr = {};
      function konto(username, vorname, nachname, rolle, extra) {
        var u = Object.assign({
          id: nextId('u'), username: username, vorname: vorname, nachname: nachname, rolle: rolle, status: 'aktiv',
          pwHash: null, kuerzel: null, funktion: null, sitzungenAb: 0, erstellt: t0, letzterLogin: null, quelle: 'verzeichnis',
          farbe: D.FARBEN[hashText(username) % D.FARBEN.length],
        }, extra || {});
        db.users.push(u);
        return u;
      }
      D.SCHUELER.forEach(function (s) {
        nr[s[3]] = (nr[s[3]] || 0) + 1;
        var u = konto(s[0], s[1], s[2], 'student', { status: s[5], kennung: 'S-' + s[3].toUpperCase() + '-' + String(nr[s[3]]).padStart(2, '0') });
        db.mitgliedschaften.push({ userId: u.id, klasseId: s[3] });
        s[4].forEach(function (k) { db.mitgliedschaften.push({ userId: u.id, klasseId: k }); });
      });
      D.LEHRER.forEach(function (l, i) {
        var u = konto(l[0], l[1], l[2], 'teacher', { kuerzel: l[3], kennung: 'L-' + l[3], pwHash: D.HASHES[i], funktion: l[5] ? 'Klassenleitung ' + l[5] : null });
        l[4].forEach(function (z) { db.lehrerzuordnungen.push({ id: nextId('lz'), lehrerId: u.id, klasseId: z[0], fachId: z[1] }); });
        if (l[5]) klasse(l[5]).leitungId = u.id;
      });
      D.ADMINS.forEach(function (a, i) {
        konto(a[0], a[1], a[2], 'admin', { kuerzel: a[3], kennung: 'A-' + a[3], pwHash: D.HASHES[D.LEHRER.length + i], funktion: a[4] });
      });
      // Aufgaben, Zuweisungen, Abgaben
      var key = {};
      D.AUFGABEN.forEach(function (a) {
        var ersteller = userByName(a.ersteller);
        var auf = {
          id: nextId('a'), titel: a.titel, beschreibung: a.beschreibung, anweisung: a.anweisung, fachId: a.fach, themaId: a.thema || null,
          schwierigkeit: a.schwierigkeit, minuten: a.minuten, punkte: a.punkte, kriterien: a.kriterien, material: a.thema ? ['thema:' + a.thema] : [],
          hinweise: a.hinweise, musterloesung: a.musterloesung, loesungFreigabe: a.loesungFreigabe, hinweiseFreigabe: 'sofort',
          status: a.status, gesperrt: false, ausgeblendet: false, bibliothek: !!a.bibliothek, vorlage: false, tags: a.tags.slice(),
          erstellerId: ersteller.id, erstellt: t0 - 10 * TAG, geaendert: t0 - 10 * TAG,
          verlauf: [{ zeit: t0 - 10 * TAG, userId: ersteller.id, aktion: 'erstellt' }],
        };
        if (a.status === 'veroeffentlicht') auf.verlauf.push({ zeit: t0 - 9 * TAG, userId: ersteller.id, aktion: 'veröffentlicht' });
        db.aufgaben.push(auf);
        key[a.key] = auf;
        a.klassen.forEach(function (k) {
          db.zuweisungen.push({ id: nextId('z'), aufgabeId: auf.id, klasseId: k[0], faellig: datumIso(t0 + k[1] * TAG), lehrerId: ersteller.id, erstellt: t0 - 9 * TAG, zurueckgezogen: false });
        });
      });
      D.ABGABEN.forEach(function (x) {
        var a = key[x[0]], u = userByName(x[2]);
        var z = db.zuweisungen.find(function (z) { return z.aufgabeId === a.id && z.klasseId === x[1]; });
        var ab = { id: nextId('ab'), zuweisungId: z.id, schuelerId: u.id, text: x[4], status: x[3], abgegebenAm: x[3] === 'in_arbeit' ? null : t0 - 2 * TAG, geaendert: t0 - 2 * TAG, versuch: 1 };
        db.abgaben.push(ab);
        if (x[5]) db.feedback.push({ id: nextId('fb'), abgabeId: ab.id, lehrerId: a.erstellerId, text: x[5], punkte: x[6], zeit: t0 - TAG });
      });
      // Ankündigungen, Material, Förderhinweis
      var kel = userByName('sabine.keller'), bra = userByName('julia.brandt');
      db.ankuendigungen.push({ id: nextId('an'), klasseId: '9a', autorId: kel.id, titel: 'Physik-Test am Freitag', text: 'Der Test behandelt Stromstärke, Spannung und das ohmsche Gesetz. Wiederholt die Übungen auf der Lernseite.', zeit: t0 - TAG });
      db.materialien.push({ id: nextId('m'), klasseId: '9a', autorId: kel.id, titel: 'Interaktive Erklärung: Ohmsches Gesetz', beschreibung: 'Zum Wiederholen vor dem Test.', link: 'thema:k9-ohmsches-gesetz', zeit: t0 - TAG });
      db.materialien.push({ id: nextId('m'), klasseId: '10a', autorId: bra.id, titel: 'BioLab: Erbgänge ausprobieren', beschreibung: 'In der Sandbox unter BioLab → Genetik.', link: 'sandbox:biolab', zeit: t0 - 2 * TAG });
      db.foerderhinweise.push({ id: nextId('fh'), schuelerId: userByName('noah.krueger').id, lehrerId: kel.id, text: 'Braucht beim Umstellen von Formeln noch Unterstützung. Mehr Zeit bei Rechenaufgaben einplanen.', zeit: t0 - 3 * TAG });
      // Benachrichtigungen für bestehende Zuweisungen
      db.zuweisungen.forEach(function (z) {
        var a = aufgabe(z.aufgabeId);
        mitglieder(z.klasseId).forEach(function (u) { db.benachrichtigungen.push({ id: nextId('n'), userId: u.id, typ: 'neue_aufgabe', text: 'Neue Aufgabe: ' + a.titel, link: '/aufgaben/' + z.id, gelesen: false, zeit: t0 - 9 * TAG }); });
      });
      // Übungsversuche (reproduzierbar)
      db.users.filter(function (u) { return u.rolle === 'student'; }).forEach(function (u) {
        var r = rng(hashText(u.username)), staerke = D.STAERKE[u.username] || 0.5, ks = klasseVon(u);
        var stufe = ks ? ks.stufe : 9, attempts = [];
        ['physik', 'chemie', 'biologie'].forEach(function (f) {
          var themen = INH.topics.filter(function (t) { return t.fach === f && t.stufe === stufe && !t.gesperrt; });
          themen.slice(0, 4).forEach(function (t, ti) {
            if (r() < 0.25 && ti > 0) return;
            t.uebungen.forEach(function (e) {
              if (r() > 0.75) return;
              var zeit = t0 - Math.floor(r() * 14) * TAG - Math.floor(r() * 600) * MIN;
              var ok = r() < staerke - (ti === 2 ? 0.25 : 0);
              attempts.push({ e: e, c: ok ? 1 : 0, t: zeit });
              if (!ok && r() < 0.6) attempts.push({ e: e, c: r() < staerke ? 1 : 0, t: zeit + MIN });
            });
          });
        });
        attempts.sort(function (a, b) { return a.t - b.t; });
        db.lernstand[u.id] = { attempts: attempts, understood: [], lessons: [] };
      });
      db.audit.push({ id: nextId('log'), zeit: t0, akteurId: null, akteur: 'System', aktion: 'testdaten_angelegt', ziel: 'Datenbank', details: 'Testdaten Version ' + VERSION });
      return db;
    }

    // ---------------------------------------------------------------- Abfragen
    function user(id) { return db.users.find(function (u) { return u.id === id; }) || null; }
    function userByName(n) { return db.users.find(function (u) { return u.username === n; }) || null; }
    function klasse(id) { return db.klassen.find(function (k) { return k.id === id; }) || null; }
    function aufgabe(id) { return db.aufgaben.find(function (a) { return a.id === id; }) || null; }
    function zuweisung(id) { return db.zuweisungen.find(function (z) { return z.id === id; }) || null; }
    function abgabe(id) { return db.abgaben.find(function (a) { return a.id === id; }) || null; }
    function fach(id) { return db.faecher.find(function (f) { return f.id === id; }) || null; }
    function klassenVon(u) { return db.mitgliedschaften.filter(function (m) { return m.userId === u.id; }).map(function (m) { return klasse(m.klasseId); }).filter(Boolean); }
    function klasseVon(u) { return klassenVon(u).find(function (k) { return k.typ === 'klasse'; }) || null; }
    function mitglieder(kid) {
      return db.mitgliedschaften.filter(function (m) { return m.klasseId === kid; }).map(function (m) { return user(m.userId); })
        .filter(function (u) { return u && u.rolle === 'student'; })
        .sort(function (a, b) { return (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname, 'de'); });
    }
    function aktiveMitglieder(kid) { return mitglieder(kid).filter(function (u) { return u.status === 'aktiv'; }); }
    function name(u) { return u ? u.vorname + ' ' + u.nachname : '–'; }

    // Bereichsprüfungen (serverseitig, bei jeder Aktion)
    function klassenDesLehrers(u) {
      if (u.rolle === 'admin') return db.klassen.slice();
      var ids = {};
      db.lehrerzuordnungen.forEach(function (z) { if (z.lehrerId === u.id) ids[z.klasseId] = true; });
      db.klassen.forEach(function (k) { if (k.leitungId === u.id) ids[k.id] = true; });
      return db.klassen.filter(function (k) { return ids[k.id]; });
    }
    function darfKlasse(u, kid, fid) {
      if (u.rolle === 'admin') return !!klasse(kid);
      if (u.rolle !== 'teacher') return false;
      var k = klasse(kid);
      if (!k) return false;
      if (k.leitungId === u.id) return true;
      return db.lehrerzuordnungen.some(function (z) { return z.lehrerId === u.id && z.klasseId === kid && (!fid || z.fachId === fid); });
    }
    function darfSchueler(u, sid) {
      var s = user(sid);
      if (!s || s.rolle !== 'student') return false;
      if (u.rolle === 'admin') return true;
      return klassenVon(s).some(function (k) { return darfKlasse(u, k.id); });
    }
    function darfAufgabeBearbeiten(u, a) {
      if (!a) return false;
      if (hatRecht(u.rolle, 'aufgaben.alle')) return true;
      return a.erstellerId === u.id && !a.gesperrt;
    }
    function darfAufgabeSehen(u, a) {
      if (!a) return false;
      if (hatRecht(u.rolle, 'aufgaben.alle') || a.erstellerId === u.id) return true;
      if (u.rolle === 'teacher') {
        if (a.bibliothek && a.status === 'veroeffentlicht' && !a.ausgeblendet) return true;
        return db.zuweisungen.some(function (z) { return z.aufgabeId === a.id && darfKlasse(u, z.klasseId); });
      }
      return false;
    }

    // ---------------------------------------------------------------- Protokoll und Benachrichtigungen
    function audit(akteur, aktion, ziel, details) {
      db.audit.push({ id: nextId('log'), zeit: jetzt(), akteurId: akteur ? akteur.id : null, akteur: akteur ? name(akteur) + ' (' + akteur.username + ')' : 'System', aktion: aktion, ziel: ziel || '', details: details || '' });
      if (db.audit.length > 2000) db.audit.splice(0, db.audit.length - 2000);
    }
    function benachrichtige(userIds, typ, text, link) {
      if (db.einstellungen.benachrichtigungen[typ] === false) return 0;
      var n = 0, gesehen = {};
      userIds.forEach(function (id) {
        if (gesehen[id]) return; gesehen[id] = true;
        var u = user(id); if (!u || u.status === 'deaktiviert') return;
        db.benachrichtigungen.push({ id: nextId('n'), userId: id, typ: typ, text: text, link: link || null, gelesen: false, zeit: jetzt() });
        n++;
      });
      return n;
    }
    function betroffeneSchueler(aufgabeId) {
      var ids = [];
      db.zuweisungen.forEach(function (z) { if (z.aufgabeId === aufgabeId && !z.zurueckgezogen) aktiveMitglieder(z.klasseId).forEach(function (u) { ids.push(u.id); }); });
      return ids;
    }

    // ---------------------------------------------------------------- Ansichten auf Daten (nur Erlaubtes herausgeben)
    function profil(u, mitStatus) {
      var p = {
        id: u.id, username: u.username, vorname: u.vorname, nachname: u.nachname, name: name(u), rolle: u.rolle, rolleName: ROLLEN_NAME[u.rolle],
        kennung: u.kennung, kuerzel: u.kuerzel, funktion: u.funktion, initialen: initialen(u), farbe: u.farbe,
        klassen: klassenVon(u).map(function (k) { return { id: k.id, name: k.name, typ: k.typ, stufe: k.stufe }; }),
      };
      var k = klasseVon(u); p.klasse = k ? k.id : null; p.stufe = k ? k.stufe : null;
      if (u.rolle === 'teacher') p.unterricht = db.lehrerzuordnungen.filter(function (z) { return z.lehrerId === u.id; }).map(function (z) { return { klasseId: z.klasseId, fachId: z.fachId, fach: (fach(z.fachId) || {}).name }; });
      if (mitStatus) { p.status = u.status; p.letzterLogin = u.letzterLogin; p.erstellt = u.erstellt; p.quelle = u.quelle; }
      return p;
    }
    function istFaellig(z) { return z.faellig && datumIso(jetzt()) > z.faellig; }
    function loesungSichtbar(a, z, ab) {
      if (a.loesungFreigabe === 'sofort') return true;
      if (a.loesungFreigabe === 'nach_faelligkeit') return istFaellig(z);
      if (a.loesungFreigabe === 'nach_korrektur') return !!ab && (ab.status === 'korrigiert' || ab.status === 'kontrolliert');
      return false;
    }
    function aufgabeFuerSchueler(a, z, ab) {
      var sicht = loesungSichtbar(a, z, ab);
      return {
        id: a.id, titel: a.titel, beschreibung: a.beschreibung, anweisung: a.anweisung, fachId: a.fachId, fach: (fach(a.fachId) || {}).name, themaId: a.themaId,
        schwierigkeit: a.schwierigkeit, minuten: a.minuten, punkte: a.punkte, kriterien: a.kriterien, material: a.material.slice(), tags: a.tags.slice(),
        gesperrt: a.gesperrt, archiviert: a.status === 'archiviert',
        hinweise: (a.hinweiseFreigabe === 'sofort' || sicht) ? a.hinweise : '',
        musterloesung: sicht ? a.musterloesung : '', loesungFreigabe: a.loesungFreigabe, loesungSichtbar: sicht && !!a.musterloesung,
      };
    }
    function abgabeStatus(ab, z) {
      if (!ab || ab.status === 'in_arbeit' || ab.status === 'zurueckgegeben') return istFaellig(z) ? 'ueberfaellig' : (ab ? (ab.status === 'zurueckgegeben' ? 'zurueckgegeben' : 'in_arbeit') : 'offen');
      return ab.status;
    }
    function feedbackZu(abId) { return db.feedback.filter(function (f) { return f.abgabeId === abId; }).map(function (f) { return Object.assign({}, f, { lehrer: name(user(f.lehrerId)) }); }); }
    function sichtbareZuweisungen(s) {
      var kids = klassenVon(s).map(function (k) { return k.id; });
      return db.zuweisungen.filter(function (z) {
        if (kids.indexOf(z.klasseId) < 0 || z.zurueckgezogen) return false;
        var a = aufgabe(z.aufgabeId);
        if (!a || a.ausgeblendet || a.status === 'entwurf') return false;
        if (a.status === 'archiviert') return db.abgaben.some(function (ab) { return ab.zuweisungId === z.id && ab.schuelerId === s.id; });
        return true;
      });
    }
    function zuweisungStatistik(z) {
      var ms = aktiveMitglieder(z.klasseId), abs = db.abgaben.filter(function (ab) { return ab.zuweisungId === z.id; });
      var st = { schueler: ms.length, abgegeben: 0, korrigiert: 0, offen: 0, inArbeit: 0, ueberfaellig: 0 };
      ms.forEach(function (u) {
        var ab = abs.find(function (x) { return x.schuelerId === u.id; });
        var s = abgabeStatus(ab, z);
        if (s === 'abgegeben') st.abgegeben++;
        else if (s === 'korrigiert' || s === 'kontrolliert') st.korrigiert++;
        else if (s === 'ueberfaellig') st.ueberfaellig++;
        else if (s === 'in_arbeit' || s === 'zurueckgegeben') st.inArbeit++;
        else st.offen++;
      });
      st.erledigtProzent = ms.length ? Math.round(100 * (st.abgegeben + st.korrigiert) / ms.length) : 0;
      return st;
    }
    function zuweisungInfo(z) {
      var a = aufgabe(z.aufgabeId), k = klasse(z.klasseId);
      return { id: z.id, aufgabeId: z.aufgabeId, titel: a ? a.titel : '?', fachId: a ? a.fachId : null, klasseId: z.klasseId, klasse: k ? k.name : z.klasseId, faellig: z.faellig, ueberfaellig: istFaellig(z), zurueckgezogen: z.zurueckgezogen, gesperrt: a ? a.gesperrt : false, statistik: zuweisungStatistik(z) };
    }
    function lernstandVon(uid) {
      if (!db.lernstand[uid]) db.lernstand[uid] = { attempts: [], understood: [], lessons: [] };
      return db.lernstand[uid];
    }
    // Lernfortschritt: gelöste Übungen je Fach/Thema, Schwierigkeiten
    function fortschritt(u) {
      var ls = lernstandVon(u.id), geloest = {}, aufgedeckt = {}, versuche = {}, falsch = {};
      ls.attempts.forEach(function (a) {
        versuche[a.e] = (versuche[a.e] || 0) + 1;
        if (a.r) aufgedeckt[a.e] = true; else if (a.c && !aufgedeckt[a.e]) geloest[a.e] = true;
        if (!a.c && !a.r) falsch[a.e] = (falsch[a.e] || 0) + 1;
      });
      var stufe = (klasseVon(u) || {}).stufe;
      var proFach = {}, themen = [];
      INH.topics.forEach(function (t) {
        var n = t.uebungen.length, g = t.uebungen.filter(function (e) { return geloest[e]; }).length;
        var v = t.uebungen.reduce(function (s, e) { return s + (versuche[e] || 0); }, 0);
        var f = t.uebungen.reduce(function (s, e) { return s + (falsch[e] || 0); }, 0);
        var aufg = t.uebungen.filter(function (e) { return aufgedeckt[e]; }).length;
        if (t.stufe === stufe && !t.gesperrt) {
          var pf = proFach[t.fach] || (proFach[t.fach] = { fach: t.fach, uebungen: 0, geloest: 0, themen: 0, begonnen: 0 });
          pf.uebungen += n; pf.geloest += g; pf.themen++; if (v) pf.begonnen++;
        }
        if (v) themen.push({ id: t.id, titel: t.titel, fach: t.fach, stufe: t.stufe, uebungen: n, geloest: g, versuche: v, falsch: f, aufgedeckt: aufg, quote: v ? Math.round(100 * (v - f - aufg) / v) : null });
      });
      var schwierig = themen.filter(function (t) { return t.versuche >= 3 && (t.quote < 55 || t.aufgedeckt >= 2); }).sort(function (a, b) { return a.quote - b.quote; });
      var gesV = ls.attempts.length, gesR = ls.attempts.filter(function (a) { return a.c; }).length;
      return {
        proFach: Object.keys(proFach).map(function (k) { var p = proFach[k]; p.prozent = p.uebungen ? Math.round(100 * p.geloest / p.uebungen) : 0; return p; }),
        themen: themen, schwierig: schwierig, versuche: gesV, richtigQuote: gesV ? Math.round(100 * gesR / gesV) : null,
        geloest: Object.keys(geloest).length, letzteAktivitaet: gesV ? ls.attempts[gesV - 1].t : null,
      };
    }
    function aufgabenstand(s) {
      var liste = sichtbareZuweisungen(s).map(function (z) {
        var ab = db.abgaben.find(function (x) { return x.zuweisungId === z.id && x.schuelerId === s.id; });
        return { zuweisungId: z.id, status: abgabeStatus(ab, z), faellig: z.faellig, titel: aufgabe(z.aufgabeId).titel, fachId: aufgabe(z.aufgabeId).fachId, punkte: aufgabe(z.aufgabeId).punkte, bewertung: ab ? (feedbackZu(ab.id).slice(-1)[0] || null) : null, abgegebenAm: ab ? ab.abgegebenAm : null };
      });
      var erledigt = liste.filter(function (x) { return x.status === 'abgegeben' || x.status === 'korrigiert' || x.status === 'kontrolliert'; }).length;
      return { liste: liste, offen: liste.length - erledigt, erledigt: erledigt, ueberfaellig: liste.filter(function (x) { return x.status === 'ueberfaellig'; }).length, prozent: liste.length ? Math.round(100 * erledigt / liste.length) : 100 };
    }

    // ---------------------------------------------------------------- Simulierter IServ-OAuth-Ablauf
    function versuche(username, sekunden) {
      var grenze = jetzt() - sekunden * 1000;
      return db.anmeldeversuche.filter(function (v) { return v.zeit >= grenze && !v.erfolg && (!username || v.username === username); });
    }
    function protokolliereVersuch(username, erfolg, grund) {
      db.anmeldeversuche.push({ zeit: jetzt(), username: String(username || '').slice(0, 64), erfolg: erfolg, grund: grund });
      if (db.anmeldeversuche.length > 1000) db.anmeldeversuche.splice(0, db.anmeldeversuche.length - 1000);
    }
    var oauth = {
      // Anmeldeseite des simulierten Schulservers: verfügbare Testkonten (ohne Hashes, ohne Lernstand)
      konten: function () {
        laden();
        return db.users.map(function (u) {
          var k = klasseVon(u);
          return { username: u.username, name: name(u), initialen: initialen(u), farbe: u.farbe, rolle: u.rolle, rolleName: ROLLEN_NAME[u.rolle], klasse: k ? k.name : null, funktion: u.funktion, status: u.status, passwort: u.rolle !== 'student' };
        });
      },
      /** Schritt 1: Zustimmung auf dem simulierten Schulserver → einmaliger Autorisierungscode */
      autorisieren: async function (d) {
        laden();
        if (!d || d.client_id !== CLIENT_ID) return { fehler: 'Unbekannte Anwendung.', code: 400 };
        if (typeof d.state !== 'string' || d.state.length < 16) return { fehler: 'Ungültige Anfrage.', code: 400 };
        var un = typeof d.username === 'string' ? d.username : '';
        var u = userByName(un);
        var allgemein = 'Anmeldung fehlgeschlagen. Benutzername oder Passwort ist falsch.';
        if (!u) { protokolliereVersuch(un, false, 'unbekanntes Konto'); speichern(); return { fehler: allgemein, code: 401 }; }
        if (u.rolle !== 'student') {
          // Rate-Limit: höchstens 5 Fehlversuche je Konto und 20 insgesamt in 15 Minuten
          var fk = versuche(u.username, 900), fg = versuche(null, 900);
          if (fk.length >= 5 || fg.length >= 20) {
            var bis = Math.max(fk.length >= 5 ? fk[fk.length - 5].zeit : 0, fg.length >= 20 ? fg[fg.length - 20].zeit : 0) + 15 * MIN;
            protokolliereVersuch(u.username, false, 'Rate-Limit');
            speichern();
            return { fehler: 'Zu viele Fehlversuche. Bitte warte ' + Math.max(1, Math.ceil((bis - jetzt()) / MIN)) + ' Minuten.', code: 429 };
          }
          var pw = typeof d.passwort === 'string' ? d.passwort : '';
          var ok = false;
          if (pw && pw.length <= 256 && u.pwHash) { try { ok = await opt.argon2.argon2Verify({ password: pw, hash: u.pwHash }); } catch (e) { ok = false; } }
          laden();
          if (!ok) { protokolliereVersuch(u.username, false, 'falsches Passwort'); speichern(); return { fehler: allgemein, code: 401 }; }
        }
        if (u.status === 'gesperrt') { protokolliereVersuch(u.username, false, 'Konto gesperrt'); speichern(); return { fehler: 'Dieses Konto ist gesperrt. Wende dich an die Administration.', code: 403 }; }
        if (u.status === 'deaktiviert') { protokolliereVersuch(u.username, false, 'Konto deaktiviert'); speichern(); return { fehler: 'Dieses Konto ist deaktiviert.', code: 403 }; }
        var code = hex(opt.zufall(24));
        db.oauthCodes = db.oauthCodes.filter(function (c) { return c.ablauf > jetzt() && !c.benutzt; });
        db.oauthCodes.push({ code: code, state: d.state, userId: u.id, ablauf: jetzt() + MIN, benutzt: false });
        speichern();
        return { ok: true, daten: { code: code, state: d.state } };
      },
      /** Schritt 2: Code gegen Sitzung tauschen (einmalig, 60 s gültig, state muss passen) */
      token: async function (d) {
        laden();
        var c = db.oauthCodes.find(function (x) { return d && x.code === d.code; });
        if (!c || c.benutzt || c.ablauf < jetzt() || !d.state || c.state !== d.state || d.erwarteterState !== d.state) {
          if (c) c.benutzt = true;
          speichern();
          return { fehler: 'Die Anmeldung ist abgelaufen oder ungültig. Bitte erneut anmelden.', code: 400 };
        }
        c.benutzt = true;
        var u = user(c.userId);
        if (!u || u.status !== 'aktiv') { speichern(); return { fehler: 'Konto nicht verfügbar.', code: 403 }; }
        // Schutz vor Session-Fixation: immer ein neues, zufälliges Token; ein mitgebrachtes altes wird verworfen
        if (d.altesToken) await abmelden(d.altesToken);
        var token = hex(opt.zufall(32)), t = jetzt();
        db.sitzungen.push({ hash: await opt.sha256(token), userId: u.id, erstellt: t, zuletzt: t, ablauf: t + 8 * 60 * MIN });
        u.letzterLogin = t;
        protokolliereVersuch(u.username, true, 'angemeldet');
        audit(u, 'anmeldung', u.username, 'Simulierter IServ-Login (' + ROLLEN_NAME[u.rolle] + ')');
        speichern();
        // Identitätsdaten wie in einem ID-Token (OpenID Connect) – simuliert
        var claims = { sub: u.id, preferred_username: u.username, given_name: u.vorname, family_name: u.nachname, roles: [u.rolle], groups: klassenVon(u).map(function (k) { return k.id; }) };
        return { ok: true, daten: { token: token, claims: claims } };
      },
      clientId: CLIENT_ID,
    };
    async function abmelden(token) {
      laden();
      if (typeof token !== 'string') return;
      var h = await opt.sha256(token);
      var vorher = db.sitzungen.length;
      db.sitzungen = db.sitzungen.filter(function (s) { return s.hash !== h; });
      if (db.sitzungen.length !== vorher) speichern();
    }
    async function sitzungPruefen(token) {
      if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return { grund: 'keine' };
      var h = await opt.sha256(token);
      var s = db.sitzungen.find(function (x) { return x.hash === h; });
      if (!s) return { grund: 'abgelaufen' };
      var t = jetzt(), u = user(s.userId), idle = (db.einstellungen.sitzungMinuten || 60) * MIN;
      var grund = null;
      if (s.beendet) grund = s.beendet;
      else if (t > s.ablauf || t - s.zuletzt > idle) grund = 'abgelaufen';
      else if (!u) grund = 'abgelaufen';
      else if (u.status === 'gesperrt') grund = 'gesperrt';
      else if (u.status === 'deaktiviert') grund = 'deaktiviert';
      else if (s.erstellt < (u.sitzungenAb || 0)) grund = 'widerrufen';
      if (grund) { db.sitzungen = db.sitzungen.filter(function (x) { return x !== s; }); speichern(); return { grund: grund }; }
      s.zuletzt = t;
      return { u: u, s: s };
    }

    // ================================================================== Aktionen
    var A = {};
    function aktion(nameA, recht, fn, o) { A[nameA] = Object.assign({ recht: recht, fn: fn }, o || {}); }
    function pruefeFunktion(f) { if (db.einstellungen.funktionen[f] === false) wirf('Diese Funktion ist in der Testumgebung gerade deaktiviert.', 403); }

    // ---------------------------------------------------------------- Konto, Mitteilungen, Suche
    aktion('konto.ich', 'konto', function (u) {
      var ungelesen = db.benachrichtigungen.filter(function (n) { return n.userId === u.id && !n.gelesen; }).length;
      var r = { profil: profil(u), ungelesen: ungelesen, einstellungen: { wartung: db.einstellungen.wartung, wartungstext: db.einstellungen.wartungstext, funktionen: kopie(db.einstellungen.funktionen) }, rechte: RECHTE[u.rolle].slice() };
      if (u.rolle === 'student') r.offeneAufgaben = db.einstellungen.funktionen.aufgaben === false ? 0 : aufgabenstand(u).offen;
      return r;
    }, { immer: true });
    aktion('konto.abmelden', 'konto', function () { return { ok: true }; }, { immer: true });
    aktion('mitteilungen.liste', 'mitteilungen', function (u) {
      return db.benachrichtigungen.filter(function (n) { return n.userId === u.id; }).sort(function (a, b) { return b.zeit - a.zeit; }).slice(0, 100).map(kopie);
    });
    aktion('mitteilungen.gelesen', 'mitteilungen', function (u, d) {
      var ids = d.alle ? null : V.liste(d, 'ids');
      var n = 0;
      db.benachrichtigungen.forEach(function (x) {
        if (x.userId !== u.id) return;            // nur eigene Mitteilungen
        if (ids && ids.indexOf(x.id) < 0) return;
        if (!x.gelesen) { x.gelesen = true; n++; }
      });
      if (ids && ids.length && !n && !db.benachrichtigungen.some(function (x) { return x.userId === u.id && ids.indexOf(x.id) >= 0; })) nichtGefunden('Mitteilung');
      return { gelesen: n };
    }, { schreibt: true });
    aktion('suche', 'suche', function (u, d) {
      var q = V.text(d, 'q', { max: 80 }).toLowerCase();
      var r = { aufgaben: [], themen: [], materialien: [], personen: [], klassen: [] };
      if (q.length < 2) return r;
      var passt = function () { for (var i = 0; i < arguments.length; i++) if (String(arguments[i] || '').toLowerCase().indexOf(q) >= 0) return true; return false; };
      INH.topics.forEach(function (t) { if (!t.gesperrt && passt(t.titel, t.kurz)) r.themen.push({ id: t.id, titel: t.titel, fach: t.fach, stufe: t.stufe }); });
      r.themen = r.themen.slice(0, 15);
      if (u.rolle === 'student') {
        if (db.einstellungen.funktionen.aufgaben !== false) sichtbareZuweisungen(u).forEach(function (z) { var a = aufgabe(z.aufgabeId); if (passt(a.titel, a.beschreibung, a.tags.join(' '))) r.aufgaben.push({ id: z.id, titel: a.titel, link: '/aufgaben/' + z.id, info: 'fällig ' + z.faellig }); });
        var kids = klassenVon(u).map(function (k) { return k.id; });
        if (db.einstellungen.funktionen.materialien !== false) db.materialien.forEach(function (m) { if (kids.indexOf(m.klasseId) >= 0 && passt(m.titel, m.beschreibung)) r.materialien.push({ titel: m.titel, link: '/aufgaben', info: (klasse(m.klasseId) || {}).name }); });
      } else {
        db.aufgaben.forEach(function (a) {
          if (!darfAufgabeSehen(u, a) || !passt(a.titel, a.beschreibung, a.tags.join(' '))) return;
          r.aufgaben.push({ id: a.id, titel: a.titel, link: (u.rolle === 'admin' ? '/admin/aufgaben/' : '/lehrer/aufgaben/') + a.id, info: a.bibliothek ? 'Bibliothek' : statusName(a) });
        });
        var klassen = klassenDesLehrers(u);
        klassen.forEach(function (k) { if (passt(k.name, k.id)) r.klassen.push({ titel: k.name, link: (u.rolle === 'admin' ? '/admin/schule' : '/lehrer/klassen/' + k.id) }); });
        db.users.forEach(function (p) {
          if (!passt(name(p), p.username, p.kennung)) return;
          if (u.rolle === 'admin') r.personen.push({ titel: name(p), link: '/admin/benutzer/' + p.id, info: ROLLEN_NAME[p.rolle] });
          else if (darfSchueler(u, p.id)) r.personen.push({ titel: name(p), link: '/lehrer/schueler/' + p.id, info: (klasseVon(p) || {}).name });
        });
        db.materialien.forEach(function (m) { if (darfKlasse(u, m.klasseId) && passt(m.titel, m.beschreibung)) r.materialien.push({ titel: m.titel, link: '/lehrer/klassen/' + m.klasseId, info: (klasse(m.klasseId) || {}).name }); });
      }
      Object.keys(r).forEach(function (k) { r[k] = r[k].slice(0, 20); });
      return r;
    });

    // ---------------------------------------------------------------- Lernstand (Übungen der Lernseite) – nur eigener
    aktion('lernstand.lesen', 'lernstand', function (u) { return kopie(lernstandVon(u.id)); });
    aktion('lernstand.versuch', 'lernstand', function (u, d) {
      pruefeFunktion('uebungen');
      var e = V.id(d, 'e');
      if (!exTopic[e]) nichtGefunden('Übung');
      lernstandVon(u.id).attempts.push({ e: e, c: V.bool(d, 'c') ? 1 : 0, r: V.bool(d, 'r') ? 1 : 0, t: jetzt() });
      return { ok: true };
    }, { schreibt: true });
    aktion('lernstand.verstanden', 'lernstand', function (u, d) {
      var t = V.id(d, 't');
      if (!topicById[t]) nichtGefunden('Thema');
      var ls = lernstandVon(u.id);
      ls.understood = ls.understood.filter(function (x) { return x !== t; });
      if (d.done !== false) ls.understood.push(t);
      return { ok: true };
    }, { schreibt: true });
    aktion('lernstand.lektion', 'lernstand', function (u, d) {
      var s = V.id(d, 'slug');
      if (!lessonBySlug[s]) nichtGefunden('Lektion');
      var ls = lernstandVon(u.id);
      if (ls.lessons.indexOf(s) < 0) ls.lessons.push(s);
      return { ok: true };
    }, { schreibt: true });

    // ---------------------------------------------------------------- Schüler/innen
    aktion('schueler.uebersicht', 'schueler.aufgaben', function (u) {
      var st = null;
      if (db.einstellungen.funktionen.aufgaben !== false) {
        st = aufgabenstand(u);
        st.liste.forEach(function (x) { if (x.bewertung) x.bewertung = { punkte: x.bewertung.punkte, text: x.bewertung.text }; });
      }
      return { aufgaben: st, fortschritt: fortschritt(u), ankuendigungen: db.einstellungen.funktionen.ankuendigungen === false ? [] : ankuendigungenFuer(u), materialien: db.einstellungen.funktionen.materialien === false ? [] : materialienFuer(u) };
    });
    function ankuendigungenFuer(u) {
      var kids = klassenVon(u).map(function (k) { return k.id; });
      return db.ankuendigungen.filter(function (a) { return kids.indexOf(a.klasseId) >= 0; }).sort(function (a, b) { return b.zeit - a.zeit; })
        .map(function (a) { return { id: a.id, titel: a.titel, text: a.text, zeit: a.zeit, klasse: (klasse(a.klasseId) || {}).name, autor: name(user(a.autorId)) }; });
    }
    function materialienFuer(u) {
      var kids = klassenVon(u).map(function (k) { return k.id; });
      return db.materialien.filter(function (m) { return kids.indexOf(m.klasseId) >= 0; }).sort(function (a, b) { return b.zeit - a.zeit; })
        .map(function (m) { return { id: m.id, titel: m.titel, beschreibung: m.beschreibung, link: m.link, klasse: (klasse(m.klasseId) || {}).name, autor: name(user(m.autorId)) }; });
    }
    function eigeneZuweisung(u, zid) {
      var z = zuweisung(zid);
      if (!z || !sichtbareZuweisungen(u).some(function (x) { return x.id === z.id; })) nichtGefunden('Aufgabe');   // fremde Aufgaben sind „nicht vorhanden“
      return z;
    }
    aktion('schueler.aufgabe', 'schueler.aufgaben', function (u, d) {
      pruefeFunktion('aufgaben');
      var z = eigeneZuweisung(u, V.id(d, 'id')), a = aufgabe(z.aufgabeId);
      var ab = db.abgaben.find(function (x) { return x.zuweisungId === z.id && x.schuelerId === u.id; }) || null;
      var lehrer = user(z.lehrerId);
      return {
        zuweisung: { id: z.id, faellig: z.faellig, ueberfaellig: istFaellig(z), klasse: (klasse(z.klasseId) || {}).name, lehrer: name(lehrer) },
        aufgabe: aufgabeFuerSchueler(a, z, ab),
        abgabe: ab ? { text: ab.text, status: abgabeStatus(ab, z), abgegebenAm: ab.abgegebenAm, versuch: ab.versuch, verspaetet: ab.abgegebenAm && z.faellig && datumIso(ab.abgegebenAm) > z.faellig } : null,
        feedback: ab ? feedbackZu(ab.id).map(function (f) { return { text: f.text, punkte: f.punkte, zeit: f.zeit, lehrer: f.lehrer }; }) : [],
        bearbeitbar: !a.gesperrt && a.status === 'veroeffentlicht' && (!ab || ab.status === 'in_arbeit' || ab.status === 'zurueckgegeben'),
      };
    });
    aktion('schueler.speichern', 'schueler.abgeben', function (u, d) {
      pruefeFunktion('aufgaben');
      var z = eigeneZuweisung(u, V.id(d, 'id')), a = aufgabe(z.aufgabeId);
      if (a.gesperrt) wirf('Diese Aufgabe wurde gesperrt und kann nicht bearbeitet werden.', 409);
      if (a.status !== 'veroeffentlicht') wirf('Diese Aufgabe kann nicht mehr bearbeitet werden.', 409);
      var abgeben = V.bool(d, 'abgeben');
      var text = V.text(d, 'text', { max: 5000, pflicht: abgeben });
      var ab = db.abgaben.find(function (x) { return x.zuweisungId === z.id && x.schuelerId === u.id; });
      if (ab && ab.status !== 'in_arbeit' && ab.status !== 'zurueckgegeben') wirf('Du hast diese Aufgabe schon abgegeben.', 409);
      if (!ab) { ab = { id: nextId('ab'), zuweisungId: z.id, schuelerId: u.id, text: '', status: 'in_arbeit', abgegebenAm: null, geaendert: jetzt(), versuch: 1 }; db.abgaben.push(ab); }
      ab.text = text; ab.geaendert = jetzt();
      if (abgeben) {
        ab.status = 'abgegeben'; ab.abgegebenAm = jetzt();
        benachrichtige([z.lehrerId], 'neue_aufgabe', name(u) + ' hat „' + a.titel + '“ abgegeben.', '/lehrer/abgaben/' + ab.id);
      }
      return { status: ab.status };
    }, { schreibt: true });

    // ---------------------------------------------------------------- Lehrkräfte: Dashboard, Klassen, Schüler
    // Welche Fächer sieht eine Lehrkraft in einer Klasse? Klassenleitung und Administration: alle (null)
    function faecherIn(u, kid) {
      if (!u || u.rolle === 'admin') return null;
      var k = klasse(kid);
      if (k && k.leitungId === u.id) return null;
      return db.lehrerzuordnungen.filter(function (z) { return z.lehrerId === u.id && z.klasseId === kid; }).map(function (z) { return z.fachId; });
    }
    function hilfebedarf(klassen, u) {
      var r = [];
      klassen.forEach(function (k) {
        var fs = faecherIn(u, k.id);
        aktiveMitglieder(k.id).forEach(function (s) {
          var gruende = [];
          db.zuweisungen.forEach(function (z) {
            if (z.klasseId !== k.id || z.zurueckgezogen || !istFaellig(z)) return;
            var a = aufgabe(z.aufgabeId); if (!a || a.status !== 'veroeffentlicht') return;
            var ab = db.abgaben.find(function (x) { return x.zuweisungId === z.id && x.schuelerId === s.id; });
            if (abgabeStatus(ab, z) === 'ueberfaellig') gruende.push('„' + a.titel + '“ überfällig');
          });
          var f = fortschritt(s);
          if (f.versuche >= 8 && f.richtigQuote < 50) gruende.push('nur ' + f.richtigQuote + ' % richtige Antworten');
          var schwer = f.schwierig.filter(function (t) { return !fs || fs.indexOf(t.fach) >= 0; });
          if (schwer.length) gruende.push('Schwierigkeiten bei „' + schwer[0].titel + '“');
          if (gruende.length) r.push({ id: s.id, name: name(s), klasse: k.name, klasseId: k.id, gruende: gruende });
        });
      });
      var seen = {};
      return r.filter(function (x) { if (seen[x.id]) return false; seen[x.id] = true; return true; });
    }
    function schwierigeThemen(klassen, u) {
      var stat = {};
      klassen.forEach(function (k) {
        var fs = faecherIn(u, k.id);
        aktiveMitglieder(k.id).forEach(function (s) {
          lernstandVon(s.id).attempts.forEach(function (a) {
            var t = exTopic[a.e]; if (!t) return;
            if (fs && fs.indexOf(topicById[t].fach) < 0) return;
            var x = stat[t] || (stat[t] = { versuche: 0, falsch: 0, uebungen: {}, schueler: {} });
            x.versuche++; if (!a.c) { x.falsch++; x.uebungen[a.e] = (x.uebungen[a.e] || 0) + 1; } x.schueler[s.id] = true;
          });
        });
      });
      return Object.keys(stat).filter(function (t) { return stat[t].versuche >= 6; }).map(function (t) {
        var x = stat[t], schwerste = Object.keys(x.uebungen).sort(function (a, b) { return x.uebungen[b] - x.uebungen[a]; })[0] || null;
        return { id: t, titel: topicById[t].titel, fach: topicById[t].fach, stufe: topicById[t].stufe, versuche: x.versuche, fehlerquote: Math.round(100 * x.falsch / x.versuche), schueler: Object.keys(x.schueler).length, schwersteUebung: schwerste };
      }).sort(function (a, b) { return b.fehlerquote - a.fehlerquote; }).slice(0, 8);
    }
    aktion('lehrer.dashboard', 'lehrer.bereich', function (u) {
      var klassen = klassenDesLehrers(u);
      var kids = klassen.map(function (k) { return k.id; });
      var zs = db.zuweisungen.filter(function (z) { return z.lehrerId === u.id || (kids.indexOf(z.klasseId) >= 0 && aufgabe(z.aufgabeId).erstellerId === u.id); })
        .filter(function (z) { return !z.zurueckgezogen && aufgabe(z.aufgabeId).status === 'veroeffentlicht'; }).map(zuweisungInfo);
      var aktiv = zs.filter(function (z) { return !z.ueberfaellig && z.statistik.erledigtProzent < 100; });
      var abgeschlossen = zs.filter(function (z) { return z.statistik.erledigtProzent === 100 && z.statistik.schueler > 0; });
      var ueberfaellig = zs.filter(function (z) { return z.ueberfaellig && z.statistik.erledigtProzent < 100; });
      var eigeneZ = {}; db.zuweisungen.forEach(function (z) { if (kids.indexOf(z.klasseId) >= 0 && (z.lehrerId === u.id || aufgabe(z.aufgabeId).erstellerId === u.id)) eigeneZ[z.id] = z; });
      var abgaben = db.abgaben.filter(function (ab) { return eigeneZ[ab.zuweisungId] && ab.status !== 'in_arbeit'; }).sort(function (a, b) { return (b.abgegebenAm || 0) - (a.abgegebenAm || 0); });
      var schuelerAlle = {};
      klassen.forEach(function (k) { aktiveMitglieder(k.id).forEach(function (s) { schuelerAlle[s.id] = s; }); });
      var stand = Object.keys(schuelerAlle).map(function (id) { var s = schuelerAlle[id]; var a = aufgabenstand(s), f = fortschritt(s); var fp = f.proFach.length ? f.proFach.reduce(function (x, p) { return x + p.prozent; }, 0) / f.proFach.length : 0; return { a: a.prozent, f: fp }; });
      var mittel = function (k) { return stand.length ? Math.round(stand.reduce(function (s, x) { return s + x[k]; }, 0) / stand.length) : 0; };
      return {
        profil: profil(u),
        klassen: klassen.map(function (k) { return { id: k.id, name: k.name, typ: k.typ, stufe: k.stufe, schueler: aktiveMitglieder(k.id).length, faecher: db.lehrerzuordnungen.filter(function (z) { return z.lehrerId === u.id && z.klasseId === k.id; }).map(function (z) { return (fach(z.fachId) || {}).name; }), leitung: k.leitungId === u.id }; }),
        zahlen: { aktiv: aktiv.length, abgeschlossen: abgeschlossen.length, ueberfaellig: ueberfaellig.length, zuKorrigieren: abgaben.filter(function (a) { return a.status === 'abgegeben'; }).length, aufgabenstand: mittel('a'), uebungsstand: mittel('f') },
        aktiv: aktiv.concat(ueberfaellig).sort(function (a, b) { return a.faellig < b.faellig ? -1 : 1; }),
        neuesteAbgaben: abgaben.slice(0, 8).map(abgabeKurz),
        hilfe: hilfebedarf(klassen, u).slice(0, 10),
        aktivitaeten: db.audit.filter(function (l) { return l.akteurId === u.id; }).slice(-8).reverse().map(kopie),
        schwierig: schwierigeThemen(klassen, u).slice(0, 5),
      };
    });
    function abgabeKurz(ab) {
      var z = zuweisung(ab.zuweisungId), a = aufgabe(z.aufgabeId), s = user(ab.schuelerId);
      return { id: ab.id, schueler: name(s), schuelerId: s.id, aufgabe: a.titel, aufgabeId: a.id, klasse: (klasse(z.klasseId) || {}).name, status: abgabeStatus(ab, z), abgegebenAm: ab.abgegebenAm, verspaetet: !!(ab.abgegebenAm && z.faellig && datumIso(ab.abgegebenAm) > z.faellig) };
    }
    aktion('lehrer.klasse', 'klassen.eigene', function (u, d) {
      var kid = V.id(d, 'id');
      if (!darfKlasse(u, kid)) { if (!klasse(kid)) nichtGefunden('Klasse'); nichtErlaubt(); }
      var k = klasse(kid);
      var zs = db.zuweisungen.filter(function (z) { return z.klasseId === kid; }).map(zuweisungInfo).sort(function (a, b) { return a.faellig < b.faellig ? 1 : -1; });
      var schueler = mitglieder(kid).map(function (s) {
        var a = aufgabenstand(s), f = fortschritt(s);
        return { id: s.id, name: name(s), vorname: s.vorname, nachname: s.nachname, initialen: initialen(s), farbe: s.farbe, kennung: s.kennung, status: s.status, aufgabenProzent: a.prozent, offen: a.offen, ueberfaellig: a.ueberfaellig, richtigQuote: f.richtigQuote, versuche: f.versuche, geloest: f.geloest, schwierig: f.schwierig.length, letzteAktivitaet: f.letzteAktivitaet };
      });
      var aktive = schueler.filter(function (s) { return s.status === 'aktiv'; });
      return {
        klasse: { id: k.id, name: k.name, typ: k.typ, stufe: k.stufe, leitung: name(user(k.leitungId)) },
        meineFaecher: db.lehrerzuordnungen.filter(function (z) { return z.lehrerId === u.id && z.klasseId === kid; }).map(function (z) { return z.fachId; }),
        lehrkraefte: db.lehrerzuordnungen.filter(function (z) { return z.klasseId === kid; }).map(function (z) { return { name: name(user(z.lehrerId)), fach: (fach(z.fachId) || {}).name }; }),
        schueler: schueler, zuweisungen: zs,
        statistik: {
          schueler: aktive.length,
          aufgabenstand: aktive.length ? Math.round(aktive.reduce(function (s, x) { return s + x.aufgabenProzent; }, 0) / aktive.length) : 0,
          richtigQuote: (function () { var m = aktive.filter(function (s) { return s.richtigQuote !== null; }); return m.length ? Math.round(m.reduce(function (s, x) { return s + x.richtigQuote; }, 0) / m.length) : null; })(),
          ueberfaellig: aktive.reduce(function (s, x) { return s + x.ueberfaellig; }, 0),
        },
        schwierig: schwierigeThemen([k], u),
        hilfe: hilfebedarf([k], u),
        ankuendigungen: db.ankuendigungen.filter(function (a) { return a.klasseId === kid; }).sort(function (a, b) { return b.zeit - a.zeit; }).map(function (a) { return Object.assign(kopie(a), { autor: name(user(a.autorId)), eigene: a.autorId === u.id }); }),
        materialien: db.materialien.filter(function (m) { return m.klasseId === kid; }).sort(function (a, b) { return b.zeit - a.zeit; }).map(function (m) { return Object.assign(kopie(m), { autor: name(user(m.autorId)), eigene: m.autorId === u.id }); }),
      };
    });
    aktion('lehrer.schueler', 'klassen.eigene', function (u, d) {
      var sid = V.id(d, 'id');
      if (!darfSchueler(u, sid)) { if (!user(sid)) nichtGefunden('Person'); nichtErlaubt(); }
      var s = user(sid);
      var meineKlassen = klassenVon(s).filter(function (k) { return darfKlasse(u, k.id); }).map(function (k) { return k.id; });
      var aufgabenListe = aufgabenstand(s).liste.filter(function (x) { return meineKlassen.indexOf(zuweisung(x.zuweisungId).klasseId) >= 0; });
      var abgaben = db.abgaben.filter(function (ab) { return ab.schuelerId === sid && meineKlassen.indexOf(zuweisung(ab.zuweisungId).klasseId) >= 0; }).map(abgabeKurz);
      return {
        profil: profil(s, true), fortschritt: fortschritt(s), aufgaben: aufgabenListe, abgaben: abgaben,
        verlauf: lernstandVon(sid).attempts.slice(-30).reverse().map(function (a) { var t = topicById[exTopic[a.e]]; return { zeit: a.t, thema: t ? t.titel : a.e, richtig: !!a.c, aufgedeckt: !!a.r }; }),
        foerderhinweise: db.foerderhinweise.filter(function (f) { return f.schuelerId === sid; }).map(function (f) { return Object.assign(kopie(f), { lehrer: name(user(f.lehrerId)), eigene: f.lehrerId === u.id }); }),
      };
    });
    aktion('foerderhinweis.speichern', 'foerderung', function (u, d) {
      var sid = V.id(d, 'schuelerId');
      if (!darfSchueler(u, sid)) nichtErlaubt();
      var text = V.text(d, 'text', { pflicht: true, max: 1000 });
      db.foerderhinweise.push({ id: nextId('fh'), schuelerId: sid, lehrerId: u.id, text: text, zeit: jetzt() });
      audit(u, 'foerderhinweis_erstellt', name(user(sid)), '');
      return { ok: true };
    }, { schreibt: true });
    aktion('foerderhinweis.loeschen', 'foerderung', function (u, d) {
      var id = V.id(d, 'id'), f = db.foerderhinweise.find(function (x) { return x.id === id; });
      if (!f) nichtGefunden('Hinweis');
      if (f.lehrerId !== u.id) nichtErlaubt();
      db.foerderhinweise = db.foerderhinweise.filter(function (x) { return x !== f; });
      return { ok: true };
    }, { schreibt: true });
    aktion('ankuendigung.erstellen', 'ankuendigungen', function (u, d) {
      pruefeFunktion('ankuendigungen');
      var kids = V.liste(d, 'klassen');
      if (!kids.length) wirf('Bitte mindestens eine Klasse wählen.', 400, { klassen: 'Pflichtfeld.' });
      kids.forEach(function (k) { if (!darfKlasse(u, k)) nichtErlaubt(); });
      var titel = V.text(d, 'titel', { pflicht: true, min: 3, max: 120 }), text = V.text(d, 'text', { pflicht: true, max: 2000 });
      kids.forEach(function (k) {
        db.ankuendigungen.push({ id: nextId('an'), klasseId: k, autorId: u.id, titel: titel, text: text, zeit: jetzt() });
        benachrichtige(aktiveMitglieder(k).map(function (s) { return s.id; }), 'ankuendigung', 'Ankündigung (' + klasse(k).name + '): ' + titel, '/aufgaben');
      });
      audit(u, 'ankuendigung_erstellt', kids.join(', '), titel);
      return { ok: true };
    }, { schreibt: true });
    aktion('ankuendigung.loeschen', 'ankuendigungen', function (u, d) {
      var id = V.id(d, 'id'), a = db.ankuendigungen.find(function (x) { return x.id === id; });
      if (!a) nichtGefunden('Ankündigung');
      if (a.autorId !== u.id) nichtErlaubt();
      db.ankuendigungen = db.ankuendigungen.filter(function (x) { return x !== a; });
      return { ok: true };
    }, { schreibt: true });
    function pruefeLink(v) {
      if (!v) return '';
      var m = /^(thema|lektion|sandbox):([a-z0-9-]+)$/.exec(v);
      if (m) {
        if (m[1] === 'thema' && !topicById[m[2]]) wirf('Unbekanntes Thema.', 400, { link: 'Unbekanntes Thema.' });
        if (m[1] === 'lektion' && !lessonBySlug[m[2]]) wirf('Unbekannte Lektion.', 400, { link: 'Unbekannte Lektion.' });
        return v;
      }
      if (/^https:\/\/[^\s<>"']{4,300}$/.test(v)) return v;
      wirf('Ungültiger Link.', 400, { link: 'Thema, Lektion oder https-Adresse.' });
    }
    aktion('material.erstellen', 'materialien', function (u, d) {
      pruefeFunktion('materialien');
      var k = V.id(d, 'klasseId');
      if (!darfKlasse(u, k)) nichtErlaubt();
      var titel = V.text(d, 'titel', { pflicht: true, min: 3, max: 120 }), beschreibung = V.text(d, 'beschreibung', { max: 1000 });
      var link = pruefeLink(V.text(d, 'link', { max: 300 }));
      db.materialien.push({ id: nextId('m'), klasseId: k, autorId: u.id, titel: titel, beschreibung: beschreibung, link: link, zeit: jetzt() });
      audit(u, 'material_veroeffentlicht', klasse(k).name, titel);
      return { ok: true };
    }, { schreibt: true });
    aktion('material.loeschen', 'materialien', function (u, d) {
      var id = V.id(d, 'id'), m = db.materialien.find(function (x) { return x.id === id; });
      if (!m) nichtGefunden('Material');
      if (m.autorId !== u.id) nichtErlaubt();
      db.materialien = db.materialien.filter(function (x) { return x !== m; });
      return { ok: true };
    }, { schreibt: true });

    // ---------------------------------------------------------------- Aufgaben (Lehrkräfte und Administration)
    function statusName(a) {
      if (a.gesperrt) return 'gesperrt';
      if (a.ausgeblendet) return 'ausgeblendet';
      return { entwurf: 'Entwurf', veroeffentlicht: 'veröffentlicht', archiviert: 'archiviert' }[a.status];
    }
    function aufgabeKurz(a) {
      var zs = db.zuweisungen.filter(function (z) { return z.aufgabeId === a.id; });
      return {
        id: a.id, titel: a.titel, fachId: a.fachId, fach: (fach(a.fachId) || {}).name, schwierigkeit: a.schwierigkeit, status: a.status, statusName: statusName(a),
        gesperrt: a.gesperrt, ausgeblendet: a.ausgeblendet, bibliothek: a.bibliothek, vorlage: a.vorlage, tags: a.tags.slice(), minuten: a.minuten, punkte: a.punkte,
        ersteller: name(user(a.erstellerId)), erstellerId: a.erstellerId, erstellt: a.erstellt, geaendert: a.geaendert, themaId: a.themaId,
        klassen: zs.filter(function (z) { return !z.zurueckgezogen; }).map(function (z) { return z.klasseId; }),
        abgaben: db.abgaben.filter(function (ab) { return zs.some(function (z) { return z.id === ab.zuweisungId; }); }).length,
      };
    }
    function liesAufgabe(d, alt) {
      var r = {
        titel: V.text(d, 'titel', { pflicht: true, min: 3, max: 120 }),
        beschreibung: V.text(d, 'beschreibung', { max: 500 }),
        anweisung: V.text(d, 'anweisung', { pflicht: true, min: 10, max: 4000 }),
        fachId: V.wahl(d, 'fachId', db.faecher.filter(function (f) { return f.aktiv || (alt && alt.fachId === f.id); }).map(function (f) { return f.id; })),
        themaId: d.themaId ? V.id(d, 'themaId') : null,
        schwierigkeit: V.wahl(d, 'schwierigkeit', SCHWIERIGKEIT, 'mittel'),
        minuten: V.zahl(d, 'minuten', { min: 5, max: 240, ganz: true, std: 20 }),
        punkte: V.zahl(d, 'punkte', { min: 0, max: 100, ganz: true, std: 0 }),
        kriterien: V.text(d, 'kriterien', { max: 1000 }),
        hinweise: V.text(d, 'hinweise', { max: 1000 }),
        hinweiseFreigabe: V.wahl(d, 'hinweiseFreigabe', ['sofort', 'mit_loesung'], 'sofort'),
        musterloesung: V.text(d, 'musterloesung', { max: 4000 }),
        loesungFreigabe: V.wahl(d, 'loesungFreigabe', LOESUNG, 'nie'),
        tags: V.text(d, 'tags', { max: 200 }).split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 8),
        material: V.liste(d, 'material').slice(0, 6),
      };
      if (r.themaId && (!topicById[r.themaId] || topicById[r.themaId].fach !== r.fachId)) wirf('Das Thema passt nicht zum Fach.', 400, { themaId: 'Thema aus dem gewählten Fach wählen.' });
      r.material.forEach(function (m) { pruefeLink(m); });
      if (r.themaId && r.material.indexOf('thema:' + r.themaId) < 0) r.material.unshift('thema:' + r.themaId);
      return r;
    }
    function eigeneAufgabe(u, id, nurLesen) {
      var a = aufgabe(id);
      if (!a) nichtGefunden('Aufgabe');
      if (nurLesen ? !darfAufgabeSehen(u, a) : !darfAufgabeBearbeiten(u, a)) {
        if (a.gesperrt && a.erstellerId === u.id) wirf('Diese Aufgabe wurde von der Administration gesperrt.', 409);
        nichtErlaubt();
      }
      return a;
    }
    aktion('aufgaben.liste', 'aufgaben.eigene', function (u, d) {
      var alle = hatRecht(u.rolle, 'aufgaben.alle') && V.bool(d, 'alle');
      var q = V.text(d, 'q', { max: 80 }).toLowerCase(), f = d.fach ? V.id(d, 'fach') : '', st = d.status ? V.id(d, 'status') : '';
      var k = d.klasse ? V.id(d, 'klasse') : '', er = d.ersteller ? V.id(d, 'ersteller') : '', von = V.datum(d, 'von'), bis = V.datum(d, 'bis');
      var liste = db.aufgaben.filter(function (a) {
        if (!alle && a.erstellerId !== u.id) return false;
        if (q && (a.titel + ' ' + a.beschreibung + ' ' + a.tags.join(' ')).toLowerCase().indexOf(q) < 0) return false;
        if (f && a.fachId !== f) return false;
        if (er && a.erstellerId !== er) return false;
        if (k && !db.zuweisungen.some(function (z) { return z.aufgabeId === a.id && z.klasseId === k; })) return false;
        if (von && datumIso(a.erstellt) < von) return false;
        if (bis && datumIso(a.erstellt) > bis) return false;
        if (st === 'gesperrt') return a.gesperrt;
        if (st === 'ausgeblendet') return a.ausgeblendet;
        if (st === 'bibliothek') return a.bibliothek;
        if (st === 'vorlage') return a.vorlage;
        if (st && a.status !== st) return false;
        return true;
      });
      return liste.sort(function (a, b) { return b.geaendert - a.geaendert; }).map(aufgabeKurz);
    });
    aktion('aufgaben.bibliothek', 'bibliothek.lesen', function (u, d) {
      var q = V.text(d, 'q', { max: 80 }).toLowerCase(), f = d.fach ? V.id(d, 'fach') : '', sw = d.schwierigkeit ? V.wahl(d, 'schwierigkeit', SCHWIERIGKEIT) : '', tag = V.text(d, 'tag', { max: 40 }).toLowerCase();
      var liste = db.aufgaben.filter(function (a) {
        var zentral = a.bibliothek && a.status === 'veroeffentlicht' && !a.gesperrt && !a.ausgeblendet;
        var vorlage = a.vorlage && a.erstellerId === u.id && a.status !== 'archiviert';
        if (!zentral && !vorlage) return false;
        if (q && (a.titel + ' ' + a.beschreibung + ' ' + a.anweisung + ' ' + a.tags.join(' ')).toLowerCase().indexOf(q) < 0) return false;
        if (f && a.fachId !== f) return false;
        if (sw && a.schwierigkeit !== sw) return false;
        if (tag && !a.tags.some(function (t) { return t.toLowerCase() === tag; })) return false;
        return true;
      }).map(function (a) { var k = aufgabeKurz(a); k.anweisung = a.anweisung; k.thema = a.themaId && topicById[a.themaId] ? topicById[a.themaId].titel : null; return k; });
      var tags = {}; db.aufgaben.forEach(function (a) { if (a.bibliothek && a.status === 'veroeffentlicht' && !a.gesperrt && !a.ausgeblendet) a.tags.forEach(function (t) { tags[t] = true; }); });
      return { liste: liste, tags: Object.keys(tags).sort() };
    });
    aktion('aufgabe.details', 'aufgaben.eigene', function (u, d) {
      var a = eigeneAufgabe(u, V.id(d, 'id'), true);
      var zs = db.zuweisungen.filter(function (z) { return z.aufgabeId === a.id && (u.rolle === 'admin' || darfKlasse(u, z.klasseId)); }).map(zuweisungInfo);
      return {
        aufgabe: Object.assign(kopie(a), { ersteller: name(user(a.erstellerId)), statusName: statusName(a), thema: a.themaId && topicById[a.themaId] ? topicById[a.themaId].titel : null }),
        verlauf: a.verlauf.map(function (v) { return { zeit: v.zeit, aktion: v.aktion, wer: name(user(v.userId)) }; }).reverse(),
        zuweisungen: zs,
        darfBearbeiten: darfAufgabeBearbeiten(u, a),
        darfZuweisen: a.status === 'veroeffentlicht' && !a.gesperrt && !a.ausgeblendet,
        meineKlassen: (u.rolle === 'admin' ? db.klassen.filter(function (k) { return k.aktiv; }) : klassenDesLehrers(u)).filter(function (k) { return darfKlasse(u, k.id, a.fachId); }).map(function (k) { return { id: k.id, name: k.name }; }),
      };
    });
    function verlauf(a, u, text) { a.verlauf.push({ zeit: jetzt(), userId: u.id, aktion: text }); a.geaendert = jetzt(); }
    aktion('aufgabe.erstellen', 'aufgaben.eigene', function (u, d) {
      var r = liesAufgabe(d);
      var status = V.wahl(d, 'status', ['entwurf', 'veroeffentlicht'], 'entwurf');
      var bib = hatRecht(u.rolle, 'bibliothek.verwalten') && V.bool(d, 'bibliothek');
      var a = Object.assign({ id: nextId('a'), status: status, gesperrt: false, ausgeblendet: false, bibliothek: bib, vorlage: V.bool(d, 'vorlage'), erstellerId: u.id, erstellt: jetzt(), geaendert: jetzt(), verlauf: [] }, r);
      verlauf(a, u, 'erstellt');
      if (status === 'veroeffentlicht') verlauf(a, u, 'veröffentlicht');
      db.aufgaben.push(a);
      audit(u, status === 'veroeffentlicht' ? 'aufgabe_veroeffentlicht' : 'aufgabe_erstellt', a.titel, a.id);
      return { id: a.id };
    }, { schreibt: true });
    aktion('aufgabe.bearbeiten', 'aufgaben.eigene', function (u, d) {
      var a = eigeneAufgabe(u, V.id(d, 'id'));
      var r = liesAufgabe(d, a);
      Object.assign(a, r);
      if (hatRecht(u.rolle, 'bibliothek.verwalten')) a.bibliothek = V.bool(d, 'bibliothek');
      a.vorlage = V.bool(d, 'vorlage');
      verlauf(a, u, 'bearbeitet');
      audit(u, 'aufgabe_bearbeitet', a.titel, a.id);
      return { id: a.id };
    }, { schreibt: true });
    aktion('aufgabe.status', 'aufgaben.eigene', function (u, d) {
      var a = eigeneAufgabe(u, V.id(d, 'id'));
      var neu = V.wahl(d, 'status', STATUS_AUFGABE);
      if (neu === a.status) return { status: a.status };
      if (neu === 'entwurf' && db.zuweisungen.some(function (z) { return z.aufgabeId === a.id && !z.zurueckgezogen; })) wirf('Zugewiesene Aufgaben können nicht zurück in den Entwurf. Ziehe zuerst die Zuweisungen zurück oder archiviere die Aufgabe.', 409);
      var alt = a.status;
      a.status = neu;
      verlauf(a, u, { veroeffentlicht: 'veröffentlicht', archiviert: 'archiviert', entwurf: 'zurück in den Entwurf' }[neu] + (alt === 'archiviert' ? ' (wiederhergestellt)' : ''));
      audit(u, { veroeffentlicht: 'aufgabe_veroeffentlicht', archiviert: 'aufgabe_archiviert', entwurf: 'aufgabe_entwurf' }[neu] + (alt === 'archiviert' ? '_wiederhergestellt' : ''), a.titel, a.id);
      if (neu === 'archiviert') benachrichtige(betroffeneSchueler(a.id), 'aufgabe_gesperrt', 'Die Aufgabe „' + a.titel + '“ wurde zurückgezogen.', '/aufgaben');
      return { status: a.status };
    }, { schreibt: true });
    aktion('aufgabe.duplizieren', 'aufgaben.eigene', function (u, d) {
      var a = eigeneAufgabe(u, V.id(d, 'id'), true);
      if (a.gesperrt && !hatRecht(u.rolle, 'aufgaben.alle')) wirf('Gesperrte Aufgaben können nicht übernommen werden.', 409);
      var k = kopie(a);
      Object.assign(k, { id: nextId('a'), titel: (a.erstellerId === u.id ? 'Kopie von ' : '') + a.titel, status: 'entwurf', gesperrt: false, ausgeblendet: false, bibliothek: false, vorlage: false, erstellerId: u.id, erstellt: jetzt(), geaendert: jetzt(), verlauf: [] });
      k.titel = k.titel.slice(0, 120);
      verlauf(k, u, 'erstellt als Kopie von ' + a.id);
      db.aufgaben.push(k);
      audit(u, 'aufgabe_dupliziert', k.titel, a.id + ' → ' + k.id);
      return { id: k.id };
    }, { schreibt: true });
    aktion('aufgabe.zuweisen', 'aufgaben.zuweisen', function (u, d) {
      var a = eigeneAufgabe(u, V.id(d, 'id'), true);
      if (a.gesperrt) wirf('Gesperrte Aufgaben können nicht zugewiesen werden.', 409);
      if (a.ausgeblendet) wirf('Ausgeblendete Aufgaben können nicht zugewiesen werden.', 409);
      if (a.status !== 'veroeffentlicht') wirf('Veröffentliche die Aufgabe, bevor du sie zuweist.', 409);
      if (a.erstellerId !== u.id && !a.bibliothek && !hatRecht(u.rolle, 'aufgaben.alle')) nichtErlaubt();
      var kids = V.liste(d, 'klassen');
      if (!kids.length) wirf('Bitte mindestens eine Klasse oder Lerngruppe wählen.', 400, { klassen: 'Pflichtfeld.' });
      var faellig = V.datum(d, 'faellig', true);
      if (faellig < datumIso(jetzt())) wirf('Das Fälligkeitsdatum liegt in der Vergangenheit.', 400, { faellig: 'Heute oder später.' });
      kids.forEach(function (k) { if (!klasse(k)) nichtGefunden('Klasse'); if (!darfKlasse(u, k, a.fachId)) nichtErlaubt(); });
      var neu = [];
      kids.forEach(function (k) {
        if (db.zuweisungen.some(function (z) { return z.aufgabeId === a.id && z.klasseId === k && !z.zurueckgezogen; })) return;
        var z = { id: nextId('z'), aufgabeId: a.id, klasseId: k, faellig: faellig, lehrerId: u.id, erstellt: jetzt(), zurueckgezogen: false };
        db.zuweisungen.push(z); neu.push(z);
        benachrichtige(aktiveMitglieder(k).map(function (s) { return s.id; }), 'neue_aufgabe', 'Neue Aufgabe: ' + a.titel + ' (fällig ' + faellig + ')', '/aufgaben/' + z.id);
      });
      if (!neu.length) wirf('Die Aufgabe ist diesen Klassen bereits zugewiesen.', 409);
      verlauf(a, u, 'zugewiesen an ' + neu.map(function (z) { return z.klasseId; }).join(', '));
      audit(u, 'aufgabe_zugewiesen', a.titel, neu.map(function (z) { return z.klasseId; }).join(', ') + ' bis ' + faellig);
      return { zuweisungen: neu.map(function (z) { return z.id; }) };
    }, { schreibt: true });
    function eigeneZuweisungLehrer(u, zid) {
      var z = zuweisung(zid);
      if (!z) nichtGefunden('Zuweisung');
      if (!(u.rolle === 'admin' || (darfKlasse(u, z.klasseId) && (z.lehrerId === u.id || aufgabe(z.aufgabeId).erstellerId === u.id)))) nichtErlaubt();
      return z;
    }
    aktion('zuweisung.frist', 'aufgaben.zuweisen', function (u, d) {
      var z = eigeneZuweisungLehrer(u, V.id(d, 'id'));
      var f = V.datum(d, 'faellig', true);
      if (f === z.faellig) return { ok: true };
      var alt = z.faellig; z.faellig = f;
      var a = aufgabe(z.aufgabeId);
      var n = benachrichtige(aktiveMitglieder(z.klasseId).map(function (s) { return s.id; }), 'frist', 'Neue Abgabefrist für „' + a.titel + '“: ' + f + ' (vorher ' + alt + ')', '/aufgaben/' + z.id);
      verlauf(a, u, 'Frist ' + z.klasseId + ': ' + alt + ' → ' + f);
      audit(u, 'frist_geaendert', a.titel + ' (' + z.klasseId + ')', alt + ' → ' + f);
      return { benachrichtigt: n };
    }, { schreibt: true });
    aktion('zuweisung.zurueckziehen', 'aufgaben.zuweisen', function (u, d) {
      var z = eigeneZuweisungLehrer(u, V.id(d, 'id'));
      if (z.zurueckgezogen) return { ok: true };
      z.zurueckgezogen = true;
      var a = aufgabe(z.aufgabeId);
      benachrichtige(aktiveMitglieder(z.klasseId).map(function (s) { return s.id; }), 'aufgabe_gesperrt', 'Die Aufgabe „' + a.titel + '“ wurde zurückgezogen.', '/aufgaben');
      verlauf(a, u, 'zurückgezogen für ' + z.klasseId);
      audit(u, 'zuweisung_zurueckgezogen', a.titel, z.klasseId);
      return { ok: true };
    }, { schreibt: true });
    aktion('zuweisung.abgaben', 'abgaben.bewerten', function (u, d) {
      var z = eigeneZuweisungLehrer(u, V.id(d, 'id'));
      var a = aufgabe(z.aufgabeId);
      return {
        zuweisung: zuweisungInfo(z), aufgabe: { id: a.id, titel: a.titel, punkte: a.punkte },
        liste: mitglieder(z.klasseId).map(function (s) {
          var ab = db.abgaben.find(function (x) { return x.zuweisungId === z.id && x.schuelerId === s.id; });
          var fb = ab ? feedbackZu(ab.id).slice(-1)[0] : null;
          return { schuelerId: s.id, name: name(s), kontoStatus: s.status, abgabeId: ab ? ab.id : null, status: abgabeStatus(ab, z), abgegebenAm: ab ? ab.abgegebenAm : null, punkte: fb ? fb.punkte : null };
        }),
      };
    });
    function eigeneAbgabe(u, id) {
      var ab = abgabe(id);
      if (!ab) nichtGefunden('Abgabe');
      eigeneZuweisungLehrer(u, ab.zuweisungId);
      if (u.rolle !== 'admin' && !darfSchueler(u, ab.schuelerId)) nichtErlaubt();
      return ab;
    }
    aktion('abgabe.details', 'abgaben.bewerten', function (u, d) {
      var ab = eigeneAbgabe(u, V.id(d, 'id')), z = zuweisung(ab.zuweisungId), a = aufgabe(z.aufgabeId);
      return { abgabe: Object.assign(kopie(ab), { status: abgabeStatus(ab, z), schueler: name(user(ab.schuelerId)), verspaetet: !!(ab.abgegebenAm && datumIso(ab.abgegebenAm) > z.faellig) }), aufgabe: kopie(a), zuweisung: zuweisungInfo(z), feedback: feedbackZu(ab.id) };
    });
    aktion('abgabe.bewerten', 'abgaben.bewerten', function (u, d) {
      var ab = eigeneAbgabe(u, V.id(d, 'id')), z = zuweisung(ab.zuweisungId), a = aufgabe(z.aufgabeId);
      if (ab.status === 'in_arbeit' || ab.status === 'zurueckgegeben') wirf('Diese Abgabe ist noch nicht eingereicht.', 409);
      var status = V.wahl(d, 'status', ['korrigiert', 'kontrolliert'], 'korrigiert');
      var text = V.text(d, 'text', { max: 2000, pflicht: status === 'korrigiert' });
      var punkte = a.punkte ? V.zahl(d, 'punkte', { min: 0, max: a.punkte, std: null }) : null;
      if (text || punkte !== null) db.feedback.push({ id: nextId('fb'), abgabeId: ab.id, lehrerId: u.id, text: text, punkte: punkte, zeit: jetzt() });
      ab.status = status;
      benachrichtige([ab.schuelerId], text ? 'feedback' : 'korrektur', (text ? 'Feedback zu „' : 'Deine Abgabe wurde kontrolliert: „') + a.titel + '“' + (punkte !== null ? ' – ' + punkte + ' von ' + a.punkte + ' Punkten' : ''), '/aufgaben/' + z.id);
      audit(u, 'abgabe_bewertet', a.titel, name(user(ab.schuelerId)) + ' · ' + status);
      return { ok: true };
    }, { schreibt: true });
    aktion('abgabe.wiederoeffnen', 'abgaben.bewerten', function (u, d) {
      var ab = eigeneAbgabe(u, V.id(d, 'id')), z = zuweisung(ab.zuweisungId), a = aufgabe(z.aufgabeId);
      if (a.gesperrt) wirf('Die Aufgabe ist gesperrt.', 409);
      var text = V.text(d, 'text', { max: 2000 });
      ab.status = 'zurueckgegeben'; ab.versuch = (ab.versuch || 1) + 1;
      if (text) db.feedback.push({ id: nextId('fb'), abgabeId: ab.id, lehrerId: u.id, text: text, punkte: null, zeit: jetzt() });
      benachrichtige([ab.schuelerId], 'korrektur', 'Bitte überarbeite „' + a.titel + '“.' + (text ? ' Hinweis: ' + text.slice(0, 80) : ''), '/aufgaben/' + z.id);
      audit(u, 'abgabe_wiedergeoeffnet', a.titel, name(user(ab.schuelerId)));
      return { ok: true };
    }, { schreibt: true });
    aktion('lehrer.statistik', 'lehrer.bereich', function (u) {
      var klassen = klassenDesLehrers(u);
      return klassen.map(function (k) {
        var zs = db.zuweisungen.filter(function (z) { return z.klasseId === k.id && !z.zurueckgezogen; }).map(zuweisungInfo);
        return { klasse: k.name, id: k.id, aufgaben: zs.length, mittel: zs.length ? Math.round(zs.reduce(function (s, z) { return s + z.statistik.erledigtProzent; }, 0) / zs.length) : null, zuweisungen: zs };
      });
    });

    // ---------------------------------------------------------------- Administration
    function adminAktion(n, recht, fn, o) { aktion(n, recht, fn, Object.assign({ schreibt: true }, o || {})); }
    aktion('admin.uebersicht', 'admin.bereich', function () {
      var t = jetzt();
      var rollen = {}, status = {};
      db.users.forEach(function (u) { rollen[u.rolle] = (rollen[u.rolle] || 0) + 1; status[u.status] = (status[u.status] || 0) + 1; });
      var aufg = { entwurf: 0, veroeffentlicht: 0, archiviert: 0, gesperrt: 0, ausgeblendet: 0, bibliothek: 0 };
      db.aufgaben.forEach(function (a) { aufg[a.status]++; if (a.gesperrt) aufg.gesperrt++; if (a.ausgeblendet) aufg.ausgeblendet++; if (a.bibliothek) aufg.bibliothek++; });
      return {
        konten: { gesamt: db.users.length, rollen: rollen, status: status, aktiveSitzungen: db.sitzungen.filter(function (s) { return s.ablauf > t && !s.beendet; }).length },
        aufgaben: aufg, zuweisungen: db.zuweisungen.filter(function (z) { return !z.zurueckgezogen; }).length, abgaben: db.abgaben.length,
        gesperrteKonten: db.audit.filter(function (l) { return l.aktion === 'konto_gesperrt'; }).slice(-5).reverse().map(kopie),
        fehlversuche: db.anmeldeversuche.filter(function (v) { return !v.erfolg; }).slice(-8).reverse().map(kopie),
        fehlversuche24h: db.anmeldeversuche.filter(function (v) { return !v.erfolg && v.zeit > t - TAG; }).length,
        auffaellig: auffaelligeRollenwechsel(),
        letzteAktionen: db.audit.slice(-8).reverse().map(kopie),
        wartung: db.einstellungen.wartung,
      };
    });
    function auffaelligeRollenwechsel() {
      var t = jetzt(), r = [];
      var wechsel = db.audit.filter(function (l) { return l.aktion === 'rolle_geaendert'; });
      wechsel.forEach(function (l) {
        var grund = null;
        if (/→ admin/.test(l.details) && /student →/.test(l.details)) grund = 'Schülerkonto direkt zur Administration';
        else if (/→ admin/.test(l.details)) grund = 'Neues Administrationskonto';
        var gleich = wechsel.filter(function (x) { return x.akteurId === l.akteurId && Math.abs(x.zeit - l.zeit) < TAG; }).length;
        if (gleich >= 3) grund = (grund ? grund + '; ' : '') + gleich + ' Rollenwechsel in 24 h durch dieselbe Person';
        if (grund && l.zeit > t - 30 * TAG) r.push(Object.assign(kopie(l), { grund: grund }));
      });
      return r.reverse().slice(0, 10);
    }
    aktion('admin.benutzer', 'benutzer.verwalten', function (u, d) {
      var q = V.text(d, 'q', { max: 80 }).toLowerCase(), rolle = d.rolle ? V.wahl(d, 'rolle', ROLLEN) : '', st = d.status ? V.wahl(d, 'status', ['aktiv', 'gesperrt', 'deaktiviert']) : '', k = d.klasse ? V.id(d, 'klasse') : '';
      return db.users.filter(function (p) {
        if (q && (name(p) + ' ' + p.username + ' ' + (p.kennung || '')).toLowerCase().indexOf(q) < 0) return false;
        if (rolle && p.rolle !== rolle) return false;
        if (st && p.status !== st) return false;
        if (k && !klassenVon(p).some(function (x) { return x.id === k; }) && !db.lehrerzuordnungen.some(function (z) { return z.lehrerId === p.id && z.klasseId === k; })) return false;
        return true;
      }).map(function (p) { var pr = profil(p, true); pr.sitzungen = db.sitzungen.filter(function (s) { return s.userId === p.id && !s.beendet; }).length; return pr; })
        .sort(function (a, b) { return ROLLEN.indexOf(b.rolle) - ROLLEN.indexOf(a.rolle) || (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname, 'de'); });
    });
    aktion('admin.benutzerDetail', 'benutzer.verwalten', function (u, d) {
      var p = user(V.id(d, 'id'));
      if (!p) nichtGefunden('Konto');
      return {
        profil: profil(p, true), sitzungen: db.sitzungen.filter(function (s) { return s.userId === p.id && !s.beendet; }).map(function (s) { return { erstellt: s.erstellt, zuletzt: s.zuletzt, ablauf: s.ablauf }; }),
        aktivitaet: db.audit.filter(function (l) { return l.akteurId === p.id || l.ziel.indexOf(p.username) >= 0 || l.ziel === name(p); }).slice(-15).reverse().map(kopie),
        anmeldungen: db.anmeldeversuche.filter(function (v) { return v.username === p.username; }).slice(-10).reverse().map(kopie),
        lehrerzuordnungen: db.lehrerzuordnungen.filter(function (z) { return z.lehrerId === p.id; }).map(kopie),
        fortschritt: p.rolle === 'student' ? fortschritt(p) : null,
        aufgabenstand: p.rolle === 'student' ? aufgabenstand(p) : null,
        klassen: db.klassen.map(function (k) { return { id: k.id, name: k.name, typ: k.typ }; }),
        faecher: db.faecher.map(function (f) { return { id: f.id, name: f.name }; }),
        ich: u.id === p.id,
      };
    });
    function zielKonto(u, d) {
      var p = user(V.id(d, 'id'));
      if (!p) nichtGefunden('Konto');
      if (p.id === u.id) wirf('Das eigene Konto kann so nicht verändert werden.', 409);
      return p;
    }
    function aktiveAdmins() { return db.users.filter(function (x) { return x.rolle === 'admin' && x.status === 'aktiv'; }); }
    function sitzungenBeenden(p, grund) { p.sitzungenAb = jetzt() + 1; db.sitzungen.forEach(function (s) { if (s.userId === p.id) s.beendet = grund || 'widerrufen'; }); }
    adminAktion('admin.status', 'benutzer.verwalten', function (u, d) {
      var p = zielKonto(u, d);
      var neu = V.wahl(d, 'status', ['aktiv', 'gesperrt', 'deaktiviert']);
      if (neu === p.status) return { status: neu };
      if (p.rolle === 'admin' && neu !== 'aktiv' && aktiveAdmins().length <= 1) wirf('Das letzte aktive Administrationskonto kann nicht gesperrt werden.', 409);
      var alt = p.status;
      p.status = neu;
      if (neu !== 'aktiv') sitzungenBeenden(p, neu);
      var aktionName = neu === 'gesperrt' ? 'konto_gesperrt' : neu === 'deaktiviert' ? 'konto_deaktiviert' : alt === 'gesperrt' ? 'konto_entsperrt' : 'konto_reaktiviert';
      audit(u, aktionName, name(p) + ' (' + p.username + ')', alt + ' → ' + neu + (d.grund ? ' · ' + V.text(d, 'grund', { max: 200 }) : ''));
      return { status: neu };
    });
    adminAktion('admin.sitzungenWiderrufen', 'benutzer.verwalten', function (u, d) {
      var p = user(V.id(d, 'id'));
      if (!p) nichtGefunden('Konto');
      var n = db.sitzungen.filter(function (s) { return s.userId === p.id && !s.beendet; }).length;
      sitzungenBeenden(p, 'widerrufen');
      audit(u, 'sitzungen_widerrufen', name(p) + ' (' + p.username + ')', n + ' Sitzung(en)');
      return { beendet: n };
    });
    // Rollenwechsel: erneute Berechtigungsprüfung durch Eingabe des eigenen Passworts
    aktion('admin.rolle', 'benutzer.verwalten', async function (u, d) {
      var p = zielKonto(u, d);
      var neu = V.wahl(d, 'rolle', ROLLEN);
      var pw = typeof d.passwort === 'string' ? d.passwort : '';
      var ok = false;
      if (pw && pw.length <= 256 && u.pwHash) { try { ok = await opt.argon2.argon2Verify({ password: pw, hash: u.pwHash }); } catch (e) { ok = false; } }
      laden();
      u = user(u.id); p = user(p.id);
      if (!ok) { audit(u, 'rollenwechsel_abgelehnt', name(p) + ' (' + p.username + ')', 'Bestätigung fehlgeschlagen'); speichern(); wirf('Bestätigung fehlgeschlagen: Das Passwort ist falsch.', 403, { passwort: 'Falsches Passwort.' }); }
      if (neu === p.rolle) return { rolle: neu };
      if (p.rolle === 'admin' && aktiveAdmins().length <= 1) wirf('Das letzte aktive Administrationskonto kann seine Rolle nicht verlieren.', 409);
      if (neu !== 'student' && !p.pwHash) {
        var npw = typeof d.neuesPasswort === 'string' ? d.neuesPasswort : '';
        if (npw.length < 10 || npw.length > 128) wirf('Für Lehrer- und Administrationskonten wird ein Passwort (mindestens 10 Zeichen) benötigt.', 400, { neuesPasswort: 'Mindestens 10 Zeichen.' });
        var h = await neuerHash(npw);
        laden(); u = user(u.id); p = user(p.id);
        p.pwHash = h;
      }
      var alt = p.rolle;
      p.rolle = neu;
      if (neu === 'student') p.pwHash = null;
      if (alt === 'teacher' && neu !== 'teacher') {
        db.lehrerzuordnungen = db.lehrerzuordnungen.filter(function (z) { return z.lehrerId !== p.id; });
        db.klassen.forEach(function (k) { if (k.leitungId === p.id) k.leitungId = null; });
      }
      if (alt === 'student' && neu !== 'student') db.mitgliedschaften = db.mitgliedschaften.filter(function (m) { return m.userId !== p.id; });
      sitzungenBeenden(p, 'widerrufen');
      audit(u, 'rolle_geaendert', name(p) + ' (' + p.username + ')', alt + ' → ' + neu);
      speichern();
      return { rolle: neu };
    }, { asynchron: true });
    async function neuerHash(pw) {
      return opt.argon2.argon2id({ password: pw, salt: opt.zufall(16), parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: 'encoded' });
    }
    adminAktion('admin.klassenzuordnung', 'benutzer.verwalten', function (u, d) {
      var p = user(V.id(d, 'id'));
      if (!p) nichtGefunden('Konto');
      if (p.rolle !== 'student') wirf('Klassen und Lerngruppen werden nur Schülerkonten zugeordnet. Lehrkräfte erhalten Lehrerzuordnungen.', 400);
      var kids = V.liste(d, 'klassen');
      kids.forEach(function (k) { if (!klasse(k)) nichtGefunden('Klasse'); });
      if (kids.filter(function (k) { return klasse(k).typ === 'klasse'; }).length > 1) wirf('Ein Schülerkonto gehört zu genau einer Klasse (plus beliebig vielen Kursen).', 400, { klassen: 'Nur eine Klasse wählen.' });
      var alt = klassenVon(p).map(function (k) { return k.id; });
      db.mitgliedschaften = db.mitgliedschaften.filter(function (m) { return m.userId !== p.id; });
      kids.forEach(function (k) { db.mitgliedschaften.push({ userId: p.id, klasseId: k }); });
      audit(u, 'klassenzuordnung_geaendert', name(p) + ' (' + p.username + ')', (alt.join(', ') || '–') + ' → ' + (kids.join(', ') || '–'));
      return { ok: true };
    });
    adminAktion('admin.lehrerzuordnung', 'schule.verwalten', function (u, d) {
      var modus = V.wahl(d, 'modus', ['hinzu', 'entfernen']);
      if (modus === 'entfernen') {
        var id = V.id(d, 'zuordnungId'), z = db.lehrerzuordnungen.find(function (x) { return x.id === id; });
        if (!z) nichtGefunden('Zuordnung');
        db.lehrerzuordnungen = db.lehrerzuordnungen.filter(function (x) { return x !== z; });
        audit(u, 'lehrerzuordnung_entfernt', name(user(z.lehrerId)), z.klasseId + ' · ' + z.fachId);
        return { ok: true };
      }
      var l = user(V.id(d, 'lehrerId')), k = V.id(d, 'klasseId'), f = V.id(d, 'fachId');
      if (!l || l.rolle !== 'teacher') wirf('Nur Lehrkräfte können zugeordnet werden.', 400, { lehrerId: 'Lehrkraft wählen.' });
      if (!klasse(k)) nichtGefunden('Klasse');
      if (!fach(f)) nichtGefunden('Fach');
      if (db.lehrerzuordnungen.some(function (x) { return x.lehrerId === l.id && x.klasseId === k && x.fachId === f; })) wirf('Diese Zuordnung gibt es schon.', 409);
      db.lehrerzuordnungen.push({ id: nextId('lz'), lehrerId: l.id, klasseId: k, fachId: f });
      audit(u, 'lehrerzuordnung_hinzugefuegt', name(l), k + ' · ' + f);
      return { ok: true };
    });
    aktion('admin.benutzerErstellen', 'benutzer.verwalten', async function (u, d) {
      var vorname = V.text(d, 'vorname', { pflicht: true, max: 40, muster: /^[\p{L}][\p{L} '-]*$/u });
      var nachname = V.text(d, 'nachname', { pflicht: true, max: 40, muster: /^[\p{L}][\p{L} '-]*$/u });
      var rolle = V.wahl(d, 'rolle', ROLLEN, 'student');
      var kid = rolle === 'student' ? V.id(d, 'klasse') : null;
      if (kid && (!klasse(kid) || klasse(kid).typ !== 'klasse')) wirf('Bitte eine Klasse wählen.', 400, { klasse: 'Klasse wählen.' });
      var h = null;
      if (rolle !== 'student') {
        var pw = typeof d.passwort === 'string' ? d.passwort : '';
        if (pw.length < 10 || pw.length > 128) wirf('Für Lehrer- und Administrationskonten wird ein Passwort mit mindestens 10 Zeichen benötigt.', 400, { passwort: 'Mindestens 10 Zeichen.' });
        h = await neuerHash(pw);
      }
      laden();
      u = user(u.id);
      if (!u || u.status !== 'aktiv' || !hatRecht(u.rolle, 'benutzer.verwalten')) nichtErlaubt();
      var basis = (vorname + '.' + nachname).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[^a-z.]/g, '');
      var un = basis, i = 2;
      while (userByName(un)) un = basis + i++;
      var nu = {
        id: nextId('u'), username: un, vorname: vorname, nachname: nachname, rolle: rolle, status: 'aktiv', pwHash: h, kuerzel: rolle === 'student' ? null : nachname.slice(0, 3).toUpperCase(),
        funktion: null, sitzungenAb: 0, erstellt: jetzt(), letzterLogin: null, quelle: 'admin', farbe: D.FARBEN[hashText(un) % D.FARBEN.length],
        kennung: (rolle === 'student' ? 'S-' + kid.toUpperCase() + '-' : rolle === 'teacher' ? 'L-' : 'A-') + 'T' + db.seq,
      };
      db.users.push(nu);
      if (kid) db.mitgliedschaften.push({ userId: nu.id, klasseId: kid });
      audit(u, 'konto_erstellt', vorname + ' ' + nachname + ' (' + un + ')', ROLLEN_NAME[rolle]);
      speichern();
      return { id: nu.id, username: un };
    }, { asynchron: true });
    // Aufgabenverwaltung (schulweit)
    function adminAufgabe(d) { var a = aufgabe(V.id(d, 'id')); if (!a) nichtGefunden('Aufgabe'); return a; }
    adminAktion('admin.aufgabeSperren', 'aufgaben.alle', function (u, d) {
      var a = adminAufgabe(d), an = V.bool(d, 'gesperrt');
      if (a.gesperrt === an) return { ok: true };
      a.gesperrt = an;
      var grund = V.text(d, 'grund', { max: 200 });
      verlauf(a, u, an ? 'gesperrt' + (grund ? ': ' + grund : '') : 'entsperrt');
      audit(u, an ? 'aufgabe_gesperrt' : 'aufgabe_entsperrt', a.titel, a.id + (grund ? ' · ' + grund : ''));
      if (an) {
        benachrichtige(betroffeneSchueler(a.id), 'aufgabe_gesperrt', 'Die Aufgabe „' + a.titel + '“ wurde vorübergehend gesperrt.', '/aufgaben');
        benachrichtige([a.erstellerId], 'aufgabe_gesperrt', 'Deine Aufgabe „' + a.titel + '“ wurde von der Administration gesperrt.' + (grund ? ' Grund: ' + grund : ''), '/lehrer/aufgaben/' + a.id);
      }
      return { ok: true };
    });
    adminAktion('admin.aufgabeAusblenden', 'aufgaben.alle', function (u, d) {
      var a = adminAufgabe(d), an = V.bool(d, 'ausgeblendet');
      if (a.ausgeblendet === an) return { ok: true };
      a.ausgeblendet = an;
      verlauf(a, u, an ? 'ausgeblendet' : 'wieder eingeblendet');
      audit(u, an ? 'aufgabe_ausgeblendet' : 'aufgabe_eingeblendet', a.titel, a.id);
      return { ok: true };
    });
    adminAktion('admin.aufgabeBibliothek', 'bibliothek.verwalten', function (u, d) {
      var a = adminAufgabe(d), an = V.bool(d, 'bibliothek');
      a.bibliothek = an;
      verlauf(a, u, an ? 'in die Bibliothek aufgenommen' : 'aus der Bibliothek entfernt');
      audit(u, an ? 'bibliothek_freigegeben' : 'bibliothek_entfernt', a.titel, a.id);
      return { ok: true };
    });
    adminAktion('admin.aufgabeLoeschen', 'aufgaben.alle', function (u, d) {
      var a = adminAufgabe(d);
      var zs = db.zuweisungen.filter(function (z) { return z.aufgabeId === a.id; });
      if (db.abgaben.some(function (ab) { return zs.some(function (z) { return z.id === ab.zuweisungId; }); })) wirf('Zu dieser Aufgabe gibt es Abgaben. Damit die Lernhistorie erhalten bleibt, kann sie nur archiviert oder gesperrt werden.', 409);
      if (zs.some(function (z) { return !z.zurueckgezogen; })) wirf('Die Aufgabe ist noch Klassen zugewiesen. Ziehe die Zuweisungen zuerst zurück oder archiviere die Aufgabe.', 409);
      db.zuweisungen = db.zuweisungen.filter(function (z) { return z.aufgabeId !== a.id; });
      db.aufgaben = db.aufgaben.filter(function (x) { return x !== a; });
      audit(u, 'aufgabe_geloescht', a.titel, a.id);
      return { ok: true };
    });
    // Schulverwaltung
    aktion('admin.schule', 'schule.verwalten', function () {
      return {
        klassen: db.klassen.map(function (k) { return Object.assign(kopie(k), { schueler: aktiveMitglieder(k.id).length, leitung: name(user(k.leitungId)), lehrer: db.lehrerzuordnungen.filter(function (z) { return z.klasseId === k.id; }).length }); }),
        faecher: db.faecher.map(function (f) { return Object.assign(kopie(f), { aufgaben: db.aufgaben.filter(function (a) { return a.fachId === f.id; }).length, themen: INH.topics.filter(function (t) { return t.fach === f.id; }).length }); }),
        zuordnungen: db.lehrerzuordnungen.map(function (z) { return Object.assign(kopie(z), { lehrer: name(user(z.lehrerId)), klasse: (klasse(z.klasseId) || {}).name, fach: (fach(z.fachId) || {}).name }); })
          .sort(function (a, b) { return a.lehrer.localeCompare(b.lehrer, 'de') || a.klasseId.localeCompare(b.klasseId); }),
        lehrer: db.users.filter(function (x) { return x.rolle === 'teacher'; }).map(function (x) { return { id: x.id, name: name(x), status: x.status }; }),
      };
    });
    adminAktion('admin.klasseSpeichern', 'schule.verwalten', function (u, d) {
      var neu = V.bool(d, 'neu');
      var id = V.text(d, 'id', { pflicht: true, max: 20, muster: /^[a-z0-9-]+$/ });
      var k = klasse(id);
      if (neu && k) wirf('Diese Kennung ist schon vergeben.', 409, { id: 'Schon vergeben.' });
      if (!neu && !k) nichtGefunden('Klasse');
      var werte = {
        name: V.text(d, 'name', { pflicht: true, max: 60 }), typ: V.wahl(d, 'typ', ['klasse', 'kurs'], 'klasse'),
        stufe: V.zahl(d, 'stufe', { min: 5, max: 13, ganz: true }), aktiv: neu ? true : V.bool(d, 'aktiv'),
      };
      var leitung = d.leitungId ? user(V.id(d, 'leitungId')) : null;
      if (d.leitungId && (!leitung || leitung.rolle !== 'teacher')) wirf('Klassenleitung muss eine Lehrkraft sein.', 400, { leitungId: 'Lehrkraft wählen.' });
      if (neu) { k = { id: id, leitungId: null }; db.klassen.push(k); }
      if (!werte.aktiv && db.zuweisungen.some(function (z) { return z.klasseId === id && !z.zurueckgezogen && !istFaellig(z); })) wirf('Die Klasse hat noch laufende Aufgaben.', 409);
      Object.assign(k, werte);
      k.leitungId = leitung ? leitung.id : null;
      audit(u, neu ? 'klasse_angelegt' : 'klasse_geaendert', werte.name, id + (leitung ? ' · Leitung ' + name(leitung) : ''));
      return { ok: true };
    });
    adminAktion('admin.fachSpeichern', 'schule.verwalten', function (u, d) {
      var f = fach(V.id(d, 'id'));
      if (!f) nichtGefunden('Fach');
      f.aktiv = V.bool(d, 'aktiv');
      f.lernbereiche = V.text(d, 'lernbereiche', { max: 1000 }).split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 30);
      audit(u, 'fach_geaendert', f.name, (f.aktiv ? 'aktiv' : 'inaktiv') + ' · ' + f.lernbereiche.length + ' Lernbereiche');
      return { ok: true };
    });
    // System
    aktion('admin.system', 'system.verwalten', function () {
      var roh = '';
      try { roh = opt.speicher.getItem(SPEICHER_SCHLUESSEL) || ''; } catch (e) { roh = ''; }
      return {
        einstellungen: kopie(db.einstellungen), funktionen: FUNKTIONEN, benachrichtigungen: BENACHRICHTIGUNGEN,
        status: {
          version: db.version, zielVersion: VERSION, erstellt: db.erstellt, groesse: roh.length,
          speicher: 'localStorage dieses Browsers (simulierte Datenbank, kein Server)', schluessel: SPEICHER_SCHLUESSEL,
          tabellen: ['users', 'klassen', 'mitgliedschaften', 'lehrerzuordnungen', 'faecher', 'aufgaben', 'zuweisungen', 'abgaben', 'feedback', 'benachrichtigungen', 'ankuendigungen', 'materialien', 'foerderhinweise', 'audit', 'anmeldeversuche', 'sitzungen']
            .map(function (t) { return { name: t, zeilen: db[t].length }; }),
          integritaet: integritaet(),
        },
      };
    });
    adminAktion('admin.einstellungen', 'system.verwalten', function (u, d) {
      var e = db.einstellungen, alt = kopie(e), aenderungen = [];
      e.wartung = V.bool(d, 'wartung');
      e.wartungstext = V.text(d, 'wartungstext', { max: 300 }) || alt.wartungstext;
      e.sitzungMinuten = V.zahl(d, 'sitzungMinuten', { min: 5, max: 480, ganz: true, std: alt.sitzungMinuten });
      Object.keys(FUNKTIONEN).forEach(function (k) { e.funktionen[k] = V.bool(d, 'f_' + k); });
      Object.keys(BENACHRICHTIGUNGEN).forEach(function (k) { e.benachrichtigungen[k] = V.bool(d, 'b_' + k); });
      if (alt.wartung !== e.wartung) aenderungen.push('Wartungsmodus ' + (e.wartung ? 'an' : 'aus'));
      if (alt.sitzungMinuten !== e.sitzungMinuten) aenderungen.push('Sitzungsdauer ' + e.sitzungMinuten + ' min');
      Object.keys(FUNKTIONEN).forEach(function (k) { if (alt.funktionen[k] !== e.funktionen[k]) aenderungen.push(FUNKTIONEN[k] + (e.funktionen[k] ? ' an' : ' aus')); });
      Object.keys(BENACHRICHTIGUNGEN).forEach(function (k) { if (alt.benachrichtigungen[k] !== e.benachrichtigungen[k]) aenderungen.push('Mitteilung „' + BENACHRICHTIGUNGEN[k] + '“ ' + (e.benachrichtigungen[k] ? 'an' : 'aus')); });
      if (aenderungen.length) audit(u, 'einstellungen_geaendert', 'System', aenderungen.join('; '));
      return { aenderungen: aenderungen.length };
    });
    aktion('admin.protokoll', 'protokoll.lesen', function (u, d) {
      var q = V.text(d, 'q', { max: 80 }).toLowerCase(), ak = d.aktion ? V.id(d, 'aktion') : '';
      var aktionen = {}; db.audit.forEach(function (l) { aktionen[l.aktion] = true; });
      return {
        eintraege: db.audit.filter(function (l) { return (!ak || l.aktion === ak) && (!q || (l.akteur + ' ' + l.ziel + ' ' + l.details).toLowerCase().indexOf(q) >= 0); }).slice(-300).reverse().map(kopie),
        aktionen: Object.keys(aktionen).sort(),
        anmeldungen: db.anmeldeversuche.slice(-50).reverse().map(kopie),
      };
    });
    aktion('admin.export', 'system.verwalten', function () {
      // Nur zusammengefasste, nicht personenbezogene Zahlen
      var zeilen = [['Klasse', 'Typ', 'Schüler/innen', 'Aufgaben', 'Abgaben', 'Erledigt (%)', 'Richtige Antworten Übungen (%)']];
      db.klassen.forEach(function (k) {
        var zs = db.zuweisungen.filter(function (z) { return z.klasseId === k.id && !z.zurueckgezogen; });
        var abg = db.abgaben.filter(function (ab) { return zs.some(function (z) { return z.id === ab.zuweisungId; }) && ab.status !== 'in_arbeit'; }).length;
        var erledigt = zs.length ? Math.round(zs.reduce(function (s, z) { return s + zuweisungStatistik(z).erledigtProzent; }, 0) / zs.length) : '';
        var v = 0, r = 0; aktiveMitglieder(k.id).forEach(function (s) { lernstandVon(s.id).attempts.forEach(function (a) { v++; if (a.c) r++; }); });
        zeilen.push([k.name, k.typ, aktiveMitglieder(k.id).length, zs.length, abg, erledigt, v ? Math.round(100 * r / v) : '']);
      });
      return { csv: zeilen.map(function (z) { return z.map(function (x) { var s = String(x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\n') };
    });
    adminAktion('admin.zuruecksetzen', 'system.verwalten', function (u, d) {
      if (d.bestaetigung !== 'TESTDATEN ZURÜCKSETZEN') wirf('Bitte zur Bestätigung genau „TESTDATEN ZURÜCKSETZEN“ eingeben.', 400, { bestaetigung: 'Bestätigungstext stimmt nicht.' });
      var wer = name(u) + ' (' + u.username + ')';
      // Nur der eigene Speicherschlüssel der Testseite wird ersetzt – es gibt keine produktiven Daten in diesem Speicher.
      db = startdaten();
      db.audit.push({ id: nextId('log'), zeit: jetzt(), akteurId: null, akteur: wer, aktion: 'testdaten_zurueckgesetzt', ziel: 'Datenbank', details: 'Alle Testdaten neu angelegt, alle Sitzungen beendet' });
      return { ok: true };
    });

    // Referentielle Integrität prüfen (Anzeige im Systemstatus, Tests)
    function integritaet() {
      var p = [];
      var uid = {}; db.users.forEach(function (u) { if (uid[u.id]) p.push('Doppelte Konto-ID ' + u.id); uid[u.id] = true; });
      var kid = {}; db.klassen.forEach(function (k) { kid[k.id] = true; });
      db.mitgliedschaften.forEach(function (m) { if (!uid[m.userId] || !kid[m.klasseId]) p.push('Mitgliedschaft verweist ins Leere: ' + m.userId + ' / ' + m.klasseId); });
      db.lehrerzuordnungen.forEach(function (z) { if (!uid[z.lehrerId] || !kid[z.klasseId] || !fach(z.fachId)) p.push('Lehrerzuordnung ungültig: ' + z.id); else if (user(z.lehrerId).rolle !== 'teacher') p.push('Lehrerzuordnung für Nicht-Lehrkraft: ' + z.id); });
      db.klassen.forEach(function (k) { if (k.leitungId && !uid[k.leitungId]) p.push('Klassenleitung unbekannt: ' + k.id); });
      var aid = {}; db.aufgaben.forEach(function (a) { aid[a.id] = true; if (!uid[a.erstellerId]) p.push('Aufgabe ohne Ersteller: ' + a.id); });
      var zid = {}; db.zuweisungen.forEach(function (z) { zid[z.id] = true; if (!aid[z.aufgabeId] || !kid[z.klasseId]) p.push('Zuweisung ungültig: ' + z.id); });
      var abid = {}; db.abgaben.forEach(function (ab) { abid[ab.id] = true; if (!zid[ab.zuweisungId] || !uid[ab.schuelerId]) p.push('Abgabe ungültig: ' + ab.id); });
      db.feedback.forEach(function (f) { if (!abid[f.abgabeId]) p.push('Feedback ohne Abgabe: ' + f.id); });
      db.benachrichtigungen.forEach(function (n) { if (!uid[n.userId]) p.push('Mitteilung ohne Empfänger: ' + n.id); });
      db.sitzungen.forEach(function (s) { if (!uid[s.userId]) p.push('Sitzung ohne Konto'); });
      return p;
    }

    // ================================================================== Zentrale Eingangstür
    /** Jede Anfrage: Sitzung prüfen → Konto aktiv? → Recht der Rolle? → Wartung/Funktion → Aktion. */
    async function api(token, name_, daten) {
      laden();
      var a = Object.prototype.hasOwnProperty.call(A, name_) ? A[name_] : null;
      if (!a) return { fehler: 'Unbekannte Aktion.', code: 404 };
      var s = await sitzungPruefen(token);
      if (!s.u) return { fehler: { gesperrt: 'Dein Konto wurde gesperrt.', deaktiviert: 'Dein Konto wurde deaktiviert.', widerrufen: 'Deine Sitzung wurde beendet. Bitte melde dich neu an.' }[s.grund] || 'Bitte melde dich an.', code: 401, grund: s.grund };
      var u = s.u;
      if (!hatRecht(u.rolle, a.recht)) { audit(u, 'zugriff_verweigert', name_, ROLLEN_NAME[u.rolle]); speichern(); return { fehler: 'Dafür fehlt dir die Berechtigung.', code: 403 }; }
      if (db.einstellungen.wartung && u.rolle !== 'admin' && !a.immer) return { fehler: db.einstellungen.wartungstext, code: 503, wartung: true };
      var d = daten && typeof daten === 'object' && !Array.isArray(daten) ? daten : {};
      try {
        var r = a.fn(u, d);
        if (a.asynchron) r = await r;
        if (a.schreibt || a.asynchron) speichern();
        else speichern();       // Sitzungs-Zeitstempel
        return { ok: true, daten: r };
      } catch (e) {
        if (e instanceof Fehler) { if (a.asynchron) laden(); else laden(); return { fehler: e.text, code: e.code, felder: e.felder }; }
        laden();
        return { fehler: 'Interner Fehler. Bitte versuche es erneut.', code: 500 };
      }
    }

    laden();
    return {
      api: api, oauth: oauth, abmelden: abmelden, RECHTE: RECHTE, hatRecht: hatRecht, ROLLEN_NAME: ROLLEN_NAME, FUNKTIONEN: FUNKTIONEN,
      aktionen: function () { return Object.keys(A).map(function (k) { return { name: k, recht: A[k].recht }; }); },
      // nur für Tests und Systemstatus (kein Zugriff aus der Oberfläche)
      _db: function () { laden(); return db; }, _integritaet: function () { laden(); return integritaet(); },
      funktionAn: function (f) { laden(); return db.einstellungen.funktionen[f] !== false; },
      wartung: function () { laden(); return { an: db.einstellungen.wartung, text: db.einstellungen.wartungstext }; },
    };
  }

  root.SchulBackend = { erstelle: erstelle, VERSION: VERSION, SPEICHER_SCHLUESSEL: SPEICHER_SCHLUESSEL, CLIENT_ID: CLIENT_ID };
})(typeof window !== 'undefined' ? window : this);
