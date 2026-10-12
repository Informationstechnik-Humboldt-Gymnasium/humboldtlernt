// Schaltkreis-Labor · Bauteil- und Verbindungsmodell
//
// Eine Schaltung ist ein einfaches Objekt (das ist auch das Speicherformat für Export/Import):
//   { format: 'schaltkreis-labor', version: 1,
//     bauteile: [{ id, typ, name, x, y, rot, werte: { … } }],
//     draehte:  [{ id, von: { b: <bauteil-id>, a: <anschluss> }, nach: { b, a } }] }
//
// Drähte hängen immer an echten Anschlüssen. Ihre Lage wird aus den Anschlüssen berechnet,
// deshalb folgen sie automatisch, wenn ein Bauteil verschoben oder gedreht wird.
// Läuft im Browser (window.SL) und in Node (Tests laden die Datei mit vm).
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});

  var RASTER = 20;
  var GRENZE = 4000; // Bauteile bleiben in diesem Bereich (± in beide Richtungen)

  var LAMPEN = {
    '6v-3w': { name: '6 V / 3 W', u: 6, p: 3 },
    '12v-6w': { name: '12 V / 6 W', u: 12, p: 6 },
    '3v5-0w7': { name: '3,5 V / 0,7 W', u: 3.5, p: 0.7 },
    '24v-5w': { name: '24 V / 5 W', u: 24, p: 5 },
    '5v-1w': { name: '5 V / 1 W (für Logik)', u: 5, p: 1 },
  };
  var MODI = ['V', 'A', 'Ohm'];
  var ZWEIPOL = { a: [-40, 0], b: [40, 0] };
  var BOX2 = [-40, -24, 80, 48];

  // Logikgatter: Eingänge A, B, Ausgang Q und Masse M (Bezugspunkt, an den Minuspol anschließen)
  var GATTER2 = { a: [-40, -20], b: [-40, 20], q: [40, 0], m: [0, 40] };
  var BOXG = [-40, -32, 80, 64];
  var GATTER = {
    und: { zeichen: '&', name: 'UND', regel: 'Q = 1 nur, wenn A = 1 und B = 1.', f: function (a, b) { return a & b; } },
    oder: { zeichen: '≥1', name: 'ODER', regel: 'Q = 1, wenn mindestens ein Eingang 1 ist.', f: function (a, b) { return a | b; } },
    nicht: { zeichen: '1', name: 'NICHT', regel: 'Q ist immer das Gegenteil von A.', f: function (a) { return a ? 0 : 1; }, einEingang: true },
    xoder: { zeichen: '=1', name: 'XODER', regel: 'Q = 1, wenn genau ein Eingang 1 ist.', f: function (a, b) { return a ^ b; } },
  };

  // Bauteilkatalog: Anschlüsse (lokale Lage bei Drehung 0°), Fläche zum Anfassen, Startwerte
  var TYPEN = {
    quelle: { name: 'Spannungsquelle', leiste: 'Gleich\u00adspannung', kuerzel: 'U', anschluesse: ZWEIPOL, box: BOX2, werte: { spannung: 6, umgepolt: false } },
    wechsel: { name: 'Wechselspannungsquelle', leiste: 'Wechsel\u00adspannung', kuerzel: 'G', anschluesse: ZWEIPOL, box: BOX2, werte: { spannung: 6, frequenz: 1 } },
    schalter: { name: 'Schalter', kuerzel: 'S', anschluesse: ZWEIPOL, box: BOX2, werte: { geschlossen: true } },
    lampe: { name: 'Lampe', kuerzel: 'L', anschluesse: ZWEIPOL, box: BOX2, werte: { typ: '6v-3w' } },
    widerstand: { name: 'Einstellbarer Widerstand', kuerzel: 'R', anschluesse: ZWEIPOL, box: BOX2, werte: { widerstand: 100 } },
    diode: { name: 'Diode', kuerzel: 'D', anschluesse: { a: [-40, 0], k: [40, 0] }, box: BOX2, werte: {} },
    transistor: { name: 'Transistor (NPN)', kuerzel: 'T', anschluesse: { b: [-40, 0], c: [20, -40], e: [20, 40] }, box: [-40, -30, 70, 60], werte: {} },
    und: { name: 'UND-Gatter', kuerzel: 'UND', anschluesse: GATTER2, box: BOXG, werte: {}, gatter: true },
    oder: { name: 'ODER-Gatter', kuerzel: 'ODER', anschluesse: GATTER2, box: BOXG, werte: {}, gatter: true },
    nicht: { name: 'NICHT-Gatter', kuerzel: 'NICHT', anschluesse: { a: [-40, 0], q: [40, 0], m: [0, 40] }, box: BOXG, werte: {}, gatter: true },
    xoder: { name: 'XODER-Gatter', kuerzel: 'XODER', anschluesse: GATTER2, box: BOXG, werte: {}, gatter: true },
    messgeraet: { name: 'Multimeter', kuerzel: 'M', anschluesse: { com: [-20, 60], v: [20, 60] }, box: [-46, -56, 92, 106], werte: { modus: 'V' }, fest: true },
  };
  // Tasten am Multimeter (lokale Koordinaten): zum direkten Umschalten per Klick/Tippen
  var MODUS_TASTEN = [{ modus: 'V', x: -40, w: 25 }, { modus: 'A', x: -12.5, w: 25 }, { modus: 'Ohm', x: 15, w: 25 }];
  var TASTEN_Y = 16, TASTEN_H = 22;

  function anschlussName(b, a) {
    if (b.typ === 'quelle') return a === pluspol(b) ? 'Pluspol' : 'Minuspol';
    if (b.typ === 'diode') return a === 'a' ? 'Anode' : 'Kathode';
    if (b.typ === 'messgeraet') return a === 'com' ? 'COM-Buchse (schwarz)' : 'V/Ω/A-Buchse (rot)';
    if (b.typ === 'transistor') return { b: 'Basis (B)', c: 'Kollektor (C)', e: 'Emitter (E)' }[a];
    if (TYPEN[b.typ].gatter) return { a: 'Eingang A', b: 'Eingang B', q: 'Ausgang Q', m: 'Masse (⊥)' }[a];
    return 'Anschluss ' + (a === 'a' ? 1 : 2);
  }

  /** Welcher Anschluss der Quelle ist der Pluspol? */
  function pluspol(b) { return b.werte.umgepolt ? 'b' : 'a'; }

  var runde = function (v) { return Math.round(v / RASTER) * RASTER; };
  var klemme = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var zahl = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };

  /** Werte eines Bauteils auf gültige Bereiche bringen (gegen Tippfehler und manipulierte Dateien). */
  function normalisiere(typ, w) {
    w = w || {};
    var d = TYPEN[typ].werte;
    switch (typ) {
      case 'quelle': return { spannung: Math.round(klemme(zahl(w.spannung, d.spannung), 0, 24) * 100) / 100, umgepolt: w.umgepolt === true };
      case 'wechsel': return { spannung: Math.round(klemme(zahl(w.spannung, d.spannung), 0, 24) * 100) / 100, frequenz: Math.round(klemme(zahl(w.frequenz, d.frequenz), 0.1, 50) * 10) / 10 };
      case 'schalter': return { geschlossen: w.geschlossen !== false };
      case 'lampe': return { typ: LAMPEN[w.typ] ? w.typ : d.typ };
      case 'widerstand': return { widerstand: Math.round(klemme(zahl(w.widerstand, d.widerstand), 0, 10000) * 1000) / 1000 };
      case 'messgeraet': return { modus: MODI.indexOf(w.modus) >= 0 ? w.modus : 'V' };
      default: return {};
    }
  }

  function neu() { return { format: 'schaltkreis-labor', version: 1, bauteile: [], draehte: [] }; }

  function neueId(doc, praefix) {
    var used = {};
    doc.bauteile.forEach(function (b) { used[b.id] = 1; });
    doc.draehte.forEach(function (d) { used[d.id] = 1; });
    for (var i = 1; ; i++) if (!used[praefix + i]) return praefix + i;
  }

  /** Nächster freier Name je Typ: L1, L2, … */
  function neuerName(doc, typ) {
    var k = TYPEN[typ].kuerzel, used = {};
    doc.bauteile.forEach(function (b) { used[b.name] = 1; });
    for (var i = 1; ; i++) if (!used[k + i]) return k + i;
  }

  function finde(doc, id) { for (var i = 0; i < doc.bauteile.length; i++) if (doc.bauteile[i].id === id) return doc.bauteile[i]; return null; }
  function findeDraht(doc, id) { for (var i = 0; i < doc.draehte.length; i++) if (doc.draehte[i].id === id) return doc.draehte[i]; return null; }

  function bauteil(doc, typ, x, y, werte) {
    if (!TYPEN[typ]) throw new Error('Unbekanntes Bauteil: ' + typ);
    var start = {}, d = TYPEN[typ].werte;
    for (var k in d) start[k] = d[k];
    for (k in (werte || {})) start[k] = werte[k];
    var b = { id: neueId(doc, 'b'), typ: typ, name: neuerName(doc, typ), x: runde(klemme(zahl(x, 0), -GRENZE, GRENZE)), y: runde(klemme(zahl(y, 0), -GRENZE, GRENZE)), rot: 0, werte: normalisiere(typ, start) };
    doc.bauteile.push(b);
    return b;
  }

  // ---------------------------------------------------------------- Geometrie

  /** Punkt um 0/90/180/270° im Uhrzeigersinn drehen (Bildschirm: y nach unten). */
  function drehe(x, y, rot) {
    switch (((rot % 360) + 360) % 360) {
      case 90: return [-y, x];
      case 180: return [-x, -y];
      case 270: return [y, -x];
      default: return [x, y];
    }
  }
  function lokal(b, x, y) { var p = drehe(x - b.x, y - b.y, 360 - b.rot); return { x: p[0], y: p[1] }; }

  function anschlussPos(doc, ref) {
    var b = finde(doc, ref.b);
    if (!b) return null;
    var l = TYPEN[b.typ].anschluesse[ref.a];
    if (!l) return null;
    var p = drehe(l[0], l[1], b.rot);
    return { x: b.x + p[0], y: b.y + p[1] };
  }

  /** Richtung, in die ein Anschluss vom Bauteil weg zeigt (für die Drahtführung). */
  function richtung(doc, ref) {
    var b = finde(doc, ref.b), l = TYPEN[b.typ].anschluesse[ref.a];
    var dx = Math.abs(l[0]) >= Math.abs(l[1]) ? Math.sign(l[0]) : 0, dy = dx ? 0 : Math.sign(l[1]);
    var p = drehe(dx, dy, b.rot);
    return { x: p[0], y: p[1] };
  }

  function anschluesse(b) {
    var out = [], t = TYPEN[b.typ].anschluesse;
    for (var a in t) { var p = drehe(t[a][0], t[a][1], b.rot); out.push({ b: b.id, a: a, x: b.x + p[0], y: b.y + p[1] }); }
    return out;
  }

  /** Eckpunkte eines Drahts: gerade, als L oder als Z, immer waagerecht/senkrecht. */
  function drahtPunkte(doc, d) {
    var p = anschlussPos(doc, d.von), q = anschlussPos(doc, d.nach);
    if (!p || !q) return null;
    if (p.x === q.x || p.y === q.y) return [p, q];
    var rv = richtung(doc, d.von), rn = richtung(doc, d.nach);
    var hv = rv.x !== 0, hn = rn.x !== 0;
    if (hv && !hn) return [p, { x: q.x, y: p.y }, q];
    if (!hv && hn) return [p, { x: p.x, y: q.y }, q];
    if (hv) { var mx = Math.round((p.x + q.x) / 20) * 10; return [p, { x: mx, y: p.y }, { x: mx, y: q.y }, q]; }
    var my = Math.round((p.y + q.y) / 20) * 10;
    return [p, { x: p.x, y: my }, { x: q.x, y: my }, q];
  }

  function abstandStrecke(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    var t = l ? klemme(((px - a.x) * dx + (py - a.y) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  /**
   * Was liegt an Punkt (x, y)? Anschlüsse haben Vorrang vor Bauteilen, Bauteile vor Drähten.
   * tol = Fangradius in Weltkoordinaten (bei Touch größer).
   */
  function trefferTest(doc, x, y, tol) {
    tol = tol || 10;
    var best = null, bestD = tol;
    doc.bauteile.forEach(function (b) {
      anschluesse(b).forEach(function (t) {
        var dd = Math.hypot(t.x - x, t.y - y);
        if (dd <= bestD) { bestD = dd; best = { art: 'anschluss', b: t.b, a: t.a, x: t.x, y: t.y }; }
      });
    });
    if (best) return best;
    for (var i = doc.bauteile.length - 1; i >= 0; i--) {
      var b = doc.bauteile[i], p = lokal(b, x, y), bx = TYPEN[b.typ].box;
      if (p.x >= bx[0] && p.x <= bx[0] + bx[2] && p.y >= bx[1] && p.y <= bx[1] + bx[3]) return { art: 'bauteil', b: b.id };
    }
    var bestW = null; bestD = tol * 0.8;
    doc.draehte.forEach(function (d) {
      var pts = drahtPunkte(doc, d);
      if (!pts) return;
      for (var k = 0; k < pts.length - 1; k++) {
        var dd = abstandStrecke(x, y, pts[k], pts[k + 1]);
        if (dd <= bestD) { bestD = dd; bestW = { art: 'draht', d: d.id }; }
      }
    });
    return bestW;
  }

  /** Klick/Tippen auf ein Bauteil: Schalter umlegen, Multimeter-Taste drücken. Gibt eine Beschreibung oder null zurück. */
  function tippAktion(doc, id, x, y) {
    var b = finde(doc, id);
    if (!b) return null;
    if (b.typ === 'schalter') { b.werte.geschlossen = !b.werte.geschlossen; return b.name + (b.werte.geschlossen ? ' geschlossen' : ' geöffnet'); }
    if (b.typ === 'messgeraet' && x != null) {
      var p = lokal(b, x, y);
      for (var i = 0; i < MODUS_TASTEN.length; i++) {
        var t = MODUS_TASTEN[i];
        if (p.x >= t.x && p.x <= t.x + t.w && p.y >= TASTEN_Y && p.y <= TASTEN_Y + TASTEN_H) {
          if (b.werte.modus === t.modus) return null;
          b.werte.modus = t.modus;
          return b.name + ': Messart ' + modusName(t.modus);
        }
      }
    }
    return null;
  }

  function modusName(m) { return m === 'V' ? 'Spannung (V)' : m === 'A' ? 'Stromstärke (A)' : 'Widerstand (Ω)'; }

  // ---------------------------------------------------------------- Bearbeiten

  function gleich(r, s) { return r.b === s.b && r.a === s.a; }

  /** Draht zwischen zwei Anschlüssen anlegen. Gibt { ok, draht } oder { ok: false, grund } zurück. */
  /** Warum dürfen die beiden Anschlüsse nicht verbunden werden? null = alles in Ordnung. */
  function verbindungFehler(doc, von, nach) {
    if (!von || !nach || !anschlussPos(doc, von) || !anschlussPos(doc, nach)) return 'Ein Draht muss an zwei Anschlüssen enden.';
    if (gleich(von, nach)) return 'Ein Draht braucht zwei verschiedene Anschlüsse.';
    for (var i = 0; i < doc.draehte.length; i++) {
      var d = doc.draehte[i];
      if ((gleich(d.von, von) && gleich(d.nach, nach)) || (gleich(d.von, nach) && gleich(d.nach, von))) return 'Diese Anschlüsse sind schon verbunden.';
    }
    return null;
  }

  function verbinde(doc, von, nach) {
    var grund = verbindungFehler(doc, von, nach);
    if (grund) return { ok: false, grund: grund };
    var draht = { id: neueId(doc, 'd'), von: { b: von.b, a: von.a }, nach: { b: nach.b, a: nach.a } };
    doc.draehte.push(draht);
    return { ok: true, draht: draht };
  }

  function verschiebe(doc, id, x, y) {
    var b = finde(doc, id);
    if (!b) return false;
    var nx = runde(klemme(x, -GRENZE, GRENZE)), ny = runde(klemme(y, -GRENZE, GRENZE));
    if (nx === b.x && ny === b.y) return false;
    b.x = nx; b.y = ny;
    return true;
  }

  function drehen(doc, id) {
    var b = finde(doc, id);
    if (!b || TYPEN[b.typ].fest) return false;
    b.rot = (b.rot + 90) % 360;
    return true;
  }

  /** Bauteil (mit allen angeschlossenen Drähten) oder einzelnen Draht löschen. */
  function loesche(doc, auswahl) {
    if (!auswahl) return false;
    if (auswahl.art === 'draht') {
      var n = doc.draehte.length;
      doc.draehte = doc.draehte.filter(function (d) { return d.id !== auswahl.id; });
      return doc.draehte.length !== n;
    }
    if (!finde(doc, auswahl.id)) return false;
    doc.bauteile = doc.bauteile.filter(function (b) { return b.id !== auswahl.id; });
    doc.draehte = doc.draehte.filter(function (d) { return d.von.b !== auswahl.id && d.nach.b !== auswahl.id; });
    return true;
  }

  function setzeWert(doc, id, schluessel, wert) {
    var b = finde(doc, id);
    if (!b) return false;
    var w = {}; for (var k in b.werte) w[k] = b.werte[k];
    w[schluessel] = wert;
    b.werte = normalisiere(b.typ, w);
    return true;
  }

  function kopie(doc) { return JSON.parse(JSON.stringify(doc)); }

  // ---------------------------------------------------------------- Speichern und Laden

  function exportiere(doc) {
    return JSON.stringify({
      format: 'schaltkreis-labor', version: 1,
      bauteile: doc.bauteile.map(function (b) { return { id: b.id, typ: b.typ, name: b.name, x: b.x, y: b.y, rot: b.rot, werte: b.werte }; }),
      draehte: doc.draehte.map(function (d) { return { id: d.id, von: d.von, nach: d.nach }; }),
    }, null, 1);
  }

  /** Liest eine gespeicherte Schaltung und prüft alles. Gibt { ok, doc, hinweise } oder { ok: false, fehler } zurück. */
  function importiere(text) {
    var data;
    try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, fehler: 'Die Datei ist keine gültige Schaltung (kein JSON).' }; }
    if (!data || data.format !== 'schaltkreis-labor' || !Array.isArray(data.bauteile) || !Array.isArray(data.draehte)) return { ok: false, fehler: 'Die Datei ist keine Schaltung aus dem Schaltkreis-Labor.' };
    if (data.version !== 1) return { ok: false, fehler: 'Diese Version des Speicherformats wird nicht unterstützt.' };
    if (data.bauteile.length > 300 || data.draehte.length > 800) return { ok: false, fehler: 'Die Schaltung ist zu groß.' };
    var doc = neu(), hinweise = [], ids = {}, namen = {};
    data.bauteile.forEach(function (b) {
      if (!b || !TYPEN[b.typ] || typeof b.id !== 'string' || !/^[a-z0-9-]{1,24}$/.test(b.id) || ids[b.id]) { hinweise.push('Ein ungültiges Bauteil wurde übersprungen.'); return; }
      var name = typeof b.name === 'string' && /^[A-Za-z0-9-]{1,8}$/.test(b.name) && !namen[b.name] ? b.name : null;
      var rot = [0, 90, 180, 270].indexOf(b.rot) >= 0 && !TYPEN[b.typ].fest ? b.rot : 0;
      var nb = { id: b.id, typ: b.typ, name: name || '', x: runde(klemme(zahl(b.x, 0), -GRENZE, GRENZE)), y: runde(klemme(zahl(b.y, 0), -GRENZE, GRENZE)), rot: rot, werte: normalisiere(b.typ, b.werte) };
      if (!name) nb.name = neuerName(doc, b.typ);
      ids[nb.id] = 1; namen[nb.name] = 1;
      doc.bauteile.push(nb);
    });
    data.draehte.forEach(function (d) {
      var ok = d && d.von && d.nach && typeof d.von.b === 'string' && typeof d.nach.b === 'string';
      var r = ok ? verbinde(doc, { b: d.von.b, a: String(d.von.a) }, { b: d.nach.b, a: String(d.nach.a) }) : { ok: false };
      if (!r.ok) hinweise.push('Ein ungültiger Draht wurde übersprungen.');
    });
    return { ok: true, doc: doc, hinweise: hinweise.filter(function (h, i, a) { return a.indexOf(h) === i; }) };
  }

  /** Beispielschaltung: Spannungsquelle, geschlossener Schalter, Lampe. */
  function beispiel() {
    var doc = neu();
    var u = bauteil(doc, 'quelle', -120, 60, { spannung: 6 });
    u.rot = 90; // Pluspol oben
    var s = bauteil(doc, 'schalter', 0, -60, { geschlossen: true });
    var l = bauteil(doc, 'lampe', 120, 60, { typ: '6v-3w' });
    l.rot = 90;
    verbinde(doc, { b: u.id, a: 'a' }, { b: s.id, a: 'a' });
    verbinde(doc, { b: s.id, a: 'b' }, { b: l.id, a: 'a' });
    verbinde(doc, { b: l.id, a: 'b' }, { b: u.id, a: 'b' });
    return doc;
  }

  // ---------------------------------------------------------------- Zahlen anzeigen

  var PRAEFIXE = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ']];
  /** Zahl mit Einheit und passendem Vorsatz, 3 gültige Ziffern, deutsches Komma: 0.1 A → "100 mA". */
  function fmt(x, einheit, stellen) {
    if (x == null || !isFinite(x)) return '–';
    stellen = stellen || 3;
    if (Math.abs(x) < 1e-9) return '0 ' + einheit;
    var r = Number(x.toPrecision(stellen)), ax = Math.abs(r);   // erst runden, dann den Vorsatz wählen (999,96 mA → 1,00 A)
    var p = PRAEFIXE[PRAEFIXE.length - 1];
    for (var i = 0; i < PRAEFIXE.length; i++) if (ax >= PRAEFIXE[i][0]) { p = PRAEFIXE[i]; break; }
    var v = r / p[0];
    var dec = Math.max(0, stellen - 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-9));
    return v.toFixed(dec).replace('-', '−').replace('.', ',') + ' ' + p[1] + einheit;
  }

  SL.RASTER = RASTER;
  SL.LAMPEN = LAMPEN;
  SL.MODI = MODI;
  SL.TYPEN = TYPEN;
  SL.GATTER = GATTER;
  SL.MODUS_TASTEN = MODUS_TASTEN;
  SL.TASTEN_Y = TASTEN_Y;
  SL.TASTEN_H = TASTEN_H;
  SL.modell = {
    neu: neu, bauteil: bauteil, finde: finde, findeDraht: findeDraht, normalisiere: normalisiere, pluspol: pluspol,
    anschlussName: anschlussName, modusName: modusName,
    drehe: drehe, lokal: lokal, anschlussPos: anschlussPos, anschluesse: anschluesse, richtung: richtung, drahtPunkte: drahtPunkte,
    trefferTest: trefferTest, tippAktion: tippAktion,
    verbinde: verbinde, verbindungFehler: verbindungFehler, verschiebe: verschiebe, drehen: drehen, loesche: loesche, setzeWert: setzeWert, kopie: kopie,
    exportiere: exportiere, importiere: importiere, beispiel: beispiel, runde: runde,
  };
  SL.fmt = fmt;
})(typeof window !== 'undefined' ? window : globalThis);
