// Netzwerk-Labor · Datenmodell: Geräte, Schnittstellen, IP-Konfiguration, Kabel, Routen, Speicherformat (kein DOM)
//
// Ein Netzwerk (zugleich das Speicherformat für Export/Import und LocalStorage):
//   { format: 'netzwerk-labor', version: 1,
//     bauteile: [{ id, typ, name, x, y, rot, werte }],          // Geräte (Feldname wie in den anderen Laboren)
//     draehte:  [{ id, von: { b, a }, nach: { b, a } }] }        // Kabel zwischen zwei Anschlüssen (ungerichtet)
//   werte je Typ:
//     pc, server: { ifs: { eth0: { ip, maske, aktiv } }, gateway, dns }
//     router:     { ifs: { g0: {…}, g1: {…}, g2: {…} }, routen: [{ id, ziel, maske, via, aktiv }] }
//     switch:     {}                                             (8 Ports, reine Schicht-2-Weiterleitung)
// IP-Angaben werden als TEXT gespeichert, genau wie eingegeben. Die Prüfung (SL.ip) meldet Fehler, statt sie still zu
// „reparieren“. Jeder Anschluss nimmt höchstens ein Kabel auf. MAC-Adressen werden aus Geräte-ID und Port abgeleitet.
//
// Stellt dieselbe Schnittstelle bereit wie die Modelle des Schaltkreis- und Logik-Labors, damit
// ../sandbox-schaltkreis/bedienung.js (Ziehen, Verkabeln, Zoom, Touch) auch hier funktioniert.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});

  var RASTER = 20, GRENZE = 4000, FORMAT = 'netzwerk-labor';
  var runde = function (v) { return Math.round(v / RASTER) * RASTER; };
  var klemme = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var zahl = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };

  var ENDGERAET_PORTS = { eth0: { x: 0, y: 40, text: 'eth0' } };
  var SWITCH_PORTS = {};
  for (var i = 1; i <= 8; i++) SWITCH_PORTS['p' + i] = { x: -70 + (i - 1) * 20, y: 30, text: String(i) };
  var ROUTER_PORTS = { g0: { x: -46, y: 0, text: 'g0' }, g1: { x: 46, y: 0, text: 'g1' }, g2: { x: 0, y: 46, text: 'g2' } };

  var ifsLeer = function (ports) { var o = {}; Object.keys(ports).forEach(function (p) { o[p] = { ip: '', maske: '', aktiv: true }; }); return o; };

  var TYPEN = {
    pc: { name: 'PC', kategorie: 'Endgeräte', kuerzel: 'PC', hilfe: 'Arbeitsplatzrechner mit einer Netzwerkkarte (eth0).', ports: ENDGERAET_PORTS, box: [-36, -30, 72, 58], endgeraet: true,
      werte: function () { return { ifs: ifsLeer(ENDGERAET_PORTS), gateway: '', dns: '' }; } },
    server: { name: 'Server', kategorie: 'Endgeräte', kuerzel: 'Server', hilfe: 'Stellt Dienste bereit, z. B. eine Webseite. Netzwerktechnisch wie ein PC.', ports: ENDGERAET_PORTS, box: [-28, -34, 56, 64], endgeraet: true,
      werte: function () { return { ifs: ifsLeer(ENDGERAET_PORTS), gateway: '', dns: '' }; } },
    switch: { name: 'Switch', kategorie: 'Netzgeräte', kuerzel: 'SW', hilfe: 'Verbindet Geräte im selben Netz und leitet Rahmen anhand von MAC-Adressen weiter (Schicht 2).', ports: SWITCH_PORTS, box: [-90, -22, 180, 44],
      werte: function () { return {}; } },
    router: { name: 'Router', kategorie: 'Netzgeräte', kuerzel: 'R', hilfe: 'Verbindet verschiedene IP-Netze und leitet Pakete anhand seiner Routing-Tabelle weiter (Schicht 3).', ports: ROUTER_PORTS, box: [-34, -34, 68, 68],
      werte: function () { return { ifs: ifsLeer(ROUTER_PORTS), routen: [] }; } },
  };
  var KATEGORIEN = ['Endgeräte', 'Netzgeräte'];

  // ---------------------------------------------------------------- Werte bereinigen
  var feld = function (v) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>"'&]/g, '').trim().slice(0, 20); };
  function normalisiere(typ, w) {
    w = w || {};
    var T = TYPEN[typ], neu = T.werte();
    if (neu.ifs) Object.keys(neu.ifs).forEach(function (p) {
      var q = (w.ifs && w.ifs[p]) || {};
      neu.ifs[p] = { ip: feld(q.ip), maske: feld(q.maske), aktiv: q.aktiv !== false };
    });
    if ('gateway' in neu) { neu.gateway = feld(w.gateway); neu.dns = feld(w.dns); }
    if (neu.routen) {
      var ids = {};
      neu.routen = (Array.isArray(w.routen) ? w.routen : []).slice(0, 16).map(function (r, k) {
        var id = typeof r.id === 'string' && /^r[0-9]{1,3}$/.test(r.id) && !ids[r.id] ? r.id : 'r' + (k + 1);
        while (ids[id]) id = 'r' + (Number(id.slice(1)) + 1);
        ids[id] = true;
        return { id: id, ziel: feld(r && r.ziel), maske: feld(r && r.maske), via: feld(r && r.via), aktiv: !(r && r.aktiv === false) };
      });
    }
    return neu;
  }
  // Für bedienung.js (freierPlatz): werte für einen neuen Typ
  function standardWerte(typ) { return TYPEN[typ].werte(); }

  // ---------------------------------------------------------------- Grundfunktionen
  function neu() { return { format: FORMAT, version: 1, bauteile: [], draehte: [] }; }
  function finde(doc, id) { for (var k = 0; k < doc.bauteile.length; k++) if (doc.bauteile[k].id === id) return doc.bauteile[k]; return null; }
  function findeDraht(doc, id) { for (var k = 0; k < doc.draehte.length; k++) if (doc.draehte[k].id === id) return doc.draehte[k]; return null; }
  function neueId(doc, p) {
    var used = {};
    doc.bauteile.forEach(function (b) { used[b.id] = 1; }); doc.draehte.forEach(function (d) { used[d.id] = 1; });
    for (var n = 1; ; n++) if (!used[p + n]) return p + n;
  }
  function neuerName(doc, typ) {
    var used = {}, k = TYPEN[typ].kuerzel;
    doc.bauteile.forEach(function (b) { used[b.name] = 1; });
    for (var n = 1; ; n++) if (!used[k + n]) return k + n;
  }
  function bauteil(doc, typ, x, y, werte) {
    if (!TYPEN[typ]) throw new Error('Unbekanntes Gerät: ' + typ);
    var b = { id: neueId(doc, 'g'), typ: typ, name: neuerName(doc, typ), x: runde(klemme(zahl(x, 0), -GRENZE, GRENZE)), y: runde(klemme(zahl(y, 0), -GRENZE, GRENZE)), rot: 0, werte: normalisiere(typ, werte) };
    doc.bauteile.push(b);
    return b;
  }
  function ports(b) { return TYPEN[b.typ].ports; }
  function anschlussName(b, a) { var p = ports(b)[a]; return !p ? a : b.typ === 'switch' ? 'Port ' + p.text : p.text; }
  /** Gerätefläche (lokal) für die gemeinsame Bedienung (Einpassen, freier Platz) – inklusive Beschriftung darüber. */
  function box(b) { var bx = TYPEN[b.typ].box; return b.typ === 'switch' ? bx : [bx[0] - 10, bx[1] - 52, bx[2] + 20, bx[3] + 52]; }
  /** Nur das Gerät selbst (Treffertest, Zeichnung). */
  function koerper(b) { return TYPEN[b.typ].box; }

  /** MAC-Adresse einer Schnittstelle (abgeleitet, deterministisch, „lokal verwaltet“: beginnt mit 02). */
  function mac(b, a) {
    var n = Number(String(b.id).replace(/\D/g, '')) || 0, k = Object.keys(ports(b)).indexOf(a) + 1;
    var hx = function (v) { return ('0' + (v & 255).toString(16)).slice(-2); };
    return ['02', '00', hx(n >> 8), hx(n), '00', hx(k)].join(':');
  }

  // ---------------------------------------------------------------- Geometrie
  function drehe(x, y) { return [x, y]; }   // Netzwerkgeräte werden nicht gedreht
  function anschluesse(b) {
    var ps = ports(b), out = [];
    Object.keys(ps).forEach(function (a) { out.push({ b: b.id, a: a, x: b.x + ps[a].x, y: b.y + ps[a].y, text: ps[a].text }); });
    return out;
  }
  function anschlussPos(doc, ref) { var b = finde(doc, ref.b), p = b && ports(b)[ref.a]; return p ? { x: b.x + p.x, y: b.y + p.y } : null; }
  function drahtPunkte(doc, d) { var p = anschlussPos(doc, d.von), q = anschlussPos(doc, d.nach); return p && q ? [p, q] : null; }
  function abstandStrecke(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    var t = l ? klemme(((px - a.x) * dx + (py - a.y) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }
  function trefferTest(doc, x, y, tol) {
    tol = tol || 10;
    var best = null, bestD = tol;
    doc.bauteile.forEach(function (b) {
      anschluesse(b).forEach(function (t) { var dd = Math.hypot(t.x - x, t.y - y); if (dd <= bestD) { bestD = dd; best = { art: 'anschluss', b: t.b, a: t.a, x: t.x, y: t.y }; } });
    });
    if (best) return best;
    for (var k = doc.bauteile.length - 1; k >= 0; k--) {
      var b = doc.bauteile[k], bx = koerper(b);
      if (x >= b.x + bx[0] && x <= b.x + bx[0] + bx[2] && y >= b.y + bx[1] && y <= b.y + bx[1] + bx[3]) return { art: 'bauteil', b: b.id };
    }
    var bw = null; bestD = tol * 0.8;
    doc.draehte.forEach(function (d) {
      var pts = drahtPunkte(doc, d); if (!pts) return;
      var dd = abstandStrecke(x, y, pts[0], pts[1]);
      if (dd <= bestD) { bestD = dd; bw = { art: 'draht', d: d.id }; }
    });
    return bw;
  }

  // ---------------------------------------------------------------- Kabel
  var gleich = function (r, s) { return r.b === s.b && r.a === s.a; };
  /** Kabel an einem Anschluss oder null. */
  function kabelAn(doc, ref) {
    for (var k = 0; k < doc.draehte.length; k++) { var d = doc.draehte[k]; if (gleich(d.von, ref) || gleich(d.nach, ref)) return d; }
    return null;
  }
  /** Gegenstelle eines Anschlusses ({ b, a }) oder null. */
  function gegenstelle(doc, ref) { var d = kabelAn(doc, ref); return d ? (gleich(d.von, ref) ? d.nach : d.von) : null; }

  function verbindungFehler(doc, x, y) {
    var bx = x && finde(doc, x.b), by = y && finde(doc, y.b);
    if (!bx || !by || !ports(bx)[x.a] || !ports(by)[y.a]) return 'Ein Kabel muss an zwei Netzwerkanschlüssen enden.';
    if (gleich(x, y)) return 'Ein Kabel braucht zwei verschiedene Anschlüsse.';
    if (x.b === y.b) return 'Ein Gerät wird nicht mit sich selbst verkabelt.';
    if (kabelAn(doc, x)) return bx.name + ' (' + anschlussName(bx, x.a) + ') ist schon belegt. Jeder Netzwerkanschluss nimmt genau ein Kabel auf.';
    if (kabelAn(doc, y)) return by.name + ' (' + anschlussName(by, y.a) + ') ist schon belegt. Jeder Netzwerkanschluss nimmt genau ein Kabel auf.';
    return null;
  }
  function verbinde(doc, x, y) {
    var grund = verbindungFehler(doc, x, y);
    if (grund) return { ok: false, grund: grund };
    var d = { id: neueId(doc, 'k'), von: { b: x.b, a: x.a }, nach: { b: y.b, a: y.a } };
    doc.draehte.push(d);
    return { ok: true, draht: d };
  }

  // ---------------------------------------------------------------- Bearbeiten
  function verschiebe(doc, id, x, y) {
    var b = finde(doc, id); if (!b) return false;
    var nx = runde(klemme(x, -GRENZE, GRENZE)), ny = runde(klemme(y, -GRENZE, GRENZE));
    if (nx === b.x && ny === b.y) return false;
    b.x = nx; b.y = ny; return true;
  }
  /** Löschen: ein Kabel, ein Gerät oder mehrere Geräte (ihre Kabel verschwinden mit). */
  function loesche(doc, sel) {
    if (!sel) return false;
    if (sel.art === 'draht') { var n = doc.draehte.length; doc.draehte = doc.draehte.filter(function (d) { return d.id !== sel.id; }); return doc.draehte.length !== n; }
    var ids = sel.art === 'mehrere' ? sel.ids : [sel.id], vorher = doc.bauteile.length;
    doc.bauteile = doc.bauteile.filter(function (b) { return ids.indexOf(b.id) < 0; });
    doc.draehte = doc.draehte.filter(function (d) { return ids.indexOf(d.von.b) < 0 && ids.indexOf(d.nach.b) < 0; });
    return doc.bauteile.length !== vorher;
  }
  function setzeName(doc, id, name) {
    var b = finde(doc, id); if (!b) return false;
    name = String(name == null ? '' : name).replace(/[\u0000-\u001f<>"'&]/g, '').trim().slice(0, 16);
    if (name && doc.bauteile.some(function (x) { return x !== b && x.name === name; })) return false;
    b.name = name || neuerName(doc, b.typ);
    return true;
  }
  /** Feld einer Schnittstelle setzen (ip, maske, aktiv). */
  function setzeIf(doc, id, port, k, v) {
    var b = finde(doc, id);
    if (!b || !b.werte.ifs || !b.werte.ifs[port] || ['ip', 'maske', 'aktiv'].indexOf(k) < 0) return false;
    b.werte.ifs[port][k] = k === 'aktiv' ? !!v : feld(v);
    return true;
  }
  /** Gateway oder DNS eines Endgeräts setzen. */
  function setzeWert(doc, id, k, v) {
    var b = finde(doc, id);
    if (!b || !TYPEN[b.typ].endgeraet || ['gateway', 'dns'].indexOf(k) < 0) return false;
    b.werte[k] = feld(v);
    return true;
  }
  function routeHinzu(doc, id, r) {
    var b = finde(doc, id);
    if (!b || b.typ !== 'router' || b.werte.routen.length >= 16) return null;
    var used = {}; b.werte.routen.forEach(function (x) { used[x.id] = 1; });
    var n = 1; while (used['r' + n]) n++;
    var neuR = { id: 'r' + n, ziel: feld(r && r.ziel), maske: feld(r && r.maske), via: feld(r && r.via), aktiv: !(r && r.aktiv === false) };
    b.werte.routen.push(neuR);
    return neuR;
  }
  function routeSetze(doc, id, rid, k, v) {
    var b = finde(doc, id), r = b && b.typ === 'router' && b.werte.routen.filter(function (x) { return x.id === rid; })[0];
    if (!r || ['ziel', 'maske', 'via', 'aktiv'].indexOf(k) < 0) return false;
    r[k] = k === 'aktiv' ? !!v : feld(v);
    return true;
  }
  function routeLoesche(doc, id, rid) {
    var b = finde(doc, id); if (!b || b.typ !== 'router') return false;
    var n = b.werte.routen.length;
    b.werte.routen = b.werte.routen.filter(function (x) { return x.id !== rid; });
    return b.werte.routen.length !== n;
  }
  function tippAktion() { return null; }
  function kopie(doc) { return JSON.parse(JSON.stringify(doc)); }

  /** Formale Konsistenz: eindeutige IDs, bekannte Typen, Kabel an existierenden, nur einfach belegten Anschlüssen. */
  function validiere(doc) {
    var f = [];
    if (!doc || !Array.isArray(doc.bauteile) || !Array.isArray(doc.draehte)) return { ok: false, fehler: ['Kein gültiges Netzwerk.'] };
    var ids = {}, belegt = {};
    doc.bauteile.forEach(function (b) {
      if (!b || typeof b.id !== 'string' || !b.id) { f.push('Ein Gerät hat keine ID.'); return; }
      if (ids[b.id]) f.push('Die ID ' + b.id + ' ist doppelt vergeben.');
      ids[b.id] = b;
      if (!TYPEN[b.typ]) f.push(b.id + ': unbekannter Gerätetyp „' + b.typ + '“.');
    });
    doc.draehte.forEach(function (d) {
      if (!d || typeof d.id !== 'string') { f.push('Ein Kabel hat keine ID.'); return; }
      if (ids[d.id]) f.push('Die ID ' + d.id + ' ist doppelt vergeben.');
      ids[d.id] = true;
      [d.von, d.nach].forEach(function (r) {
        var b = r && ids[r.b];
        if (!b || b === true || !TYPEN[b.typ] || !ports(b)[r.a]) { f.push('Kabel ' + d.id + ' endet an einem Anschluss, den es nicht gibt.'); return; }
        var k = r.b + '/' + r.a;
        if (belegt[k]) f.push('An ' + b.name + ' (' + anschlussName(b, r.a) + ') hängen mehrere Kabel.');
        belegt[k] = true;
      });
      if (d.von && d.nach && d.von.b === d.nach.b) f.push('Kabel ' + d.id + ' verbindet ein Gerät mit sich selbst.');
    });
    return { ok: !f.length, fehler: f };
  }

  // ---------------------------------------------------------------- Speichern und Laden
  function exportiere(doc) {
    return JSON.stringify({ format: FORMAT, version: 1,
      bauteile: doc.bauteile.map(function (b) { return { id: b.id, typ: b.typ, name: b.name, x: b.x, y: b.y, rot: 0, werte: normalisiere(b.typ, b.werte) }; }),
      draehte: doc.draehte.map(function (d) { return { id: d.id, von: { b: d.von.b, a: d.von.a }, nach: { b: d.nach.b, a: d.nach.a } }; }),
    }, null, 1);
  }
  /** Netzwerk laden: nur gültige Teile übernehmen. Liefert { ok, doc, hinweise } oder { ok: false, fehler }. */
  function importiere(text) {
    var data;
    try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, fehler: 'Die Datei ist kein gültiges Netzwerk (kein JSON).' }; }
    if (!data || data.format !== FORMAT || !Array.isArray(data.bauteile) || !Array.isArray(data.draehte)) return { ok: false, fehler: 'Die Datei ist kein Netzwerk aus dem Netzwerk-Labor.' };
    if (data.version !== 1) return { ok: false, fehler: 'Diese Version des Speicherformats wird nicht unterstützt.' };
    if (data.bauteile.length > 60 || data.draehte.length > 200) return { ok: false, fehler: 'Das Netzwerk ist zu groß.' };
    var doc = neu(), hinweise = [];
    data.bauteile.forEach(function (b) {
      if (!b || !TYPEN[b.typ] || typeof b.id !== 'string' || !/^[a-z][a-z0-9-]{0,23}$/.test(b.id) || finde(doc, b.id)) { hinweise.push('Ein ungültiges Gerät wurde übersprungen.'); return; }
      var nb = { id: b.id, typ: b.typ, name: '', x: runde(klemme(zahl(b.x, 0), -GRENZE, GRENZE)), y: runde(klemme(zahl(b.y, 0), -GRENZE, GRENZE)), rot: 0, werte: normalisiere(b.typ, b.werte) };
      doc.bauteile.push(nb);
      if (!setzeName(doc, nb.id, typeof b.name === 'string' ? b.name : '')) setzeName(doc, nb.id, '');
    });
    data.draehte.forEach(function (d) {
      var ok = d && d.von && d.nach && typeof d.id === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(d.id) && !findeDraht(doc, d.id) && !finde(doc, d.id);
      if (ok) {
        var r = verbinde(doc, { b: d.von.b, a: d.von.a }, { b: d.nach.b, a: d.nach.a });
        if (r.ok) { r.draht.id = d.id; return; }
      }
      hinweise.push('Ein ungültiges Kabel wurde übersprungen.');
    });
    return { ok: true, doc: doc, hinweise: hinweise };
  }

  SL.TYPEN = TYPEN;
  SL.KATEGORIEN = KATEGORIEN;
  SL.modell = {
    neu: neu, bauteil: bauteil, finde: finde, findeDraht: findeDraht, normalisiere: normalisiere, standardWerte: standardWerte, ports: ports, box: box, koerper: koerper,
    anschluesse: anschluesse, anschlussPos: anschlussPos, anschlussName: anschlussName, drahtPunkte: drahtPunkte, trefferTest: trefferTest,
    verbindungFehler: verbindungFehler, verbinde: verbinde, kabelAn: kabelAn, gegenstelle: gegenstelle, verschiebe: verschiebe, loesche: loesche,
    setzeName: setzeName, setzeIf: setzeIf, setzeWert: setzeWert, routeHinzu: routeHinzu, routeSetze: routeSetze, routeLoesche: routeLoesche,
    tippAktion: tippAktion, kopie: kopie, validiere: validiere, exportiere: exportiere, importiere: importiere, mac: mac, drehe: drehe,
    runde: runde, neuerName: neuerName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
