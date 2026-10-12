// Logik-Labor · Bauteile, Anschlüsse, Verbindungen, Speicherformat, Beispiele
//
// Eine Schaltung (zugleich das Speicherformat für Export/Import):
//   { format: 'logik-labor', version: 1,
//     bauteile: [{ id, typ, name, x, y, rot, werte: { … } }],
//     draehte:  [{ id, von: { b, a }, nach: { b, a }, farbe? }],   // von = Ausgang, nach = Eingang
//     optionen: { aktiv, inaktiv, pegel } }                          // Darstellung (Farben nur Optik)
//
// Jeder Anschluss ist ein Eingang („ein“) oder ein Ausgang („aus“). Ein Draht verbindet immer genau einen
// Ausgang mit einem Eingang; ein Eingang hat höchstens ein Signal, ein Ausgang darf mehrere Eingänge versorgen.
// Die Lage der Anschlüsse hängt bei manchen Bauteilen von ihren Werten ab (z. B. Anzahl der Gatter-Eingänge).
// Stellt dieselbe Schnittstelle bereit wie das Modell des Schaltkreis-Labors, damit bedienung.js für beide funktioniert.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});

  var RASTER = 20, GRENZE = 4000;
  var FARBE = /^#[0-9a-f]{6}$/i;
  var runde = function (v) { return Math.round(v / RASTER) * RASTER; };
  var klemme = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var zahl = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };
  var farbe = function (v, d) { return typeof v === 'string' && FARBE.test(v) ? v.toLowerCase() : d; };
  var bit = function (v) { return v === 1 || v === true || v === '1' ? 1 : 0; };

  /** Logische Funktion der Gatter. e = Liste der Eingänge (0/1). XOR mit mehr Eingängen = ungerade Anzahl Einsen. */
  var GATTER = {
    und: { zeichen: '&', name: 'UND', en: 'AND', f: function (e) { return e.every(Boolean) ? 1 : 0; }, regel: 'Q = 1 nur, wenn alle Eingänge 1 sind.' },
    oder: { zeichen: '≥1', name: 'ODER', en: 'OR', f: function (e) { return e.some(Boolean) ? 1 : 0; }, regel: 'Q = 1, wenn mindestens ein Eingang 1 ist.' },
    nicht: { zeichen: '1', name: 'NICHT', en: 'NOT', f: function (e) { return e[0] ? 0 : 1; }, negiert: true, regel: 'Q ist das Gegenteil des Eingangs.' },
    xor: { zeichen: '=1', name: 'XOR', en: 'Exklusiv-ODER', f: function (e) { return e.reduce(function (a, b) { return a ^ b; }, 0); }, regel: 'Q = 1, wenn eine ungerade Anzahl Eingänge 1 ist (bei zwei Eingängen: genau einer).' },
    nand: { zeichen: '&', name: 'NAND', en: 'NICHT-UND', f: function (e) { return e.every(Boolean) ? 0 : 1; }, negiert: true, regel: 'Q = 0 nur, wenn alle Eingänge 1 sind (UND mit Negation).' },
    nor: { zeichen: '≥1', name: 'NOR', en: 'NICHT-ODER', f: function (e) { return e.some(Boolean) ? 0 : 1; }, negiert: true, regel: 'Q = 1 nur, wenn alle Eingänge 0 sind (ODER mit Negation).' },
    xnor: { zeichen: '=1', name: 'XNOR', en: 'Äquivalenz', f: function (e) { return e.reduce(function (a, b) { return a ^ b; }, 0) ? 0 : 1; }, negiert: true, regel: 'Q = 1, wenn eine gerade Anzahl Eingänge 1 ist (bei zwei Eingängen: beide gleich).' },
  };

  // 7-Segment: Segmente a–g für die Zeichen 0–9 und A–F (Reihenfolge a b c d e f g)
  var SEGMENTE = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  var HEX = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011',
    '1110111', '0011111', '1001110', '0111101', '1001111', '1000111'];
  var HEX_ZEICHEN = '0123456789AbCdEF';

  var LEUCHTFARBEN = [['#ffc83d', 'Gelb'], ['#ff4d3d', 'Rot'], ['#2fbf5b', 'Grün'], ['#3d8bff', 'Blau'], ['#ffffff', 'Weiß'], ['#ff8a1f', 'Orange'], ['#b06bff', 'Violett']];
  var BAUTEILFARBEN = [['', 'Standard'], ['#dbeafe', 'Hellblau'], ['#dcfce7', 'Hellgrün'], ['#fef3c7', 'Gelb'], ['#fde2e2', 'Rosa'], ['#ede9fe', 'Lila'], ['#e5e7eb', 'Grau'], ['#1f2937', 'Dunkel']];
  var LEITUNGSFARBEN = [['', 'Standard'], ['#2563eb', 'Blau'], ['#dc2626', 'Rot'], ['#16a34a', 'Grün'], ['#9333ea', 'Lila'], ['#d97706', 'Orange'], ['#6b7280', 'Grau']];

  // ---------------------------------------------------------------- Bauteilkatalog
  // pins(b): Anschlüsse in lokalen Koordinaten (Drehung 0°): { name: { x, y, art: 'ein'|'aus', text } }

  var einAus = function () { return { q: { x: 40, y: 0, art: 'aus', text: 'Q' } }; };
  function gatterPins(b) {
    var n = b.typ === 'nicht' ? 1 : b.werte.eingaenge, pins = {};
    for (var i = 0; i < n; i++) pins['e' + (i + 1)] = { x: -40, y: n === 1 ? 0 : (i - (n - 1) / 2) * 20, art: 'ein', text: String.fromCharCode(65 + i) };
    pins.q = { x: 40, y: 0, art: 'aus', text: 'Q' };
    return pins;
  }
  function gatterBox(b) { var n = b.typ === 'nicht' ? 1 : b.werte.eingaenge, h = Math.max(2, n) * 20 + 8; return [-26, -h / 2, 52, h]; }

  var TYPEN = {
    schalter: { name: 'Schalter', kategorie: 'Eingänge', hilfe: 'Antippen schaltet zwischen 0 und 1 um.', buchstabe: true, werte: { an: 0, farbe: '' }, pins: einAus, box: function () { return [-30, -20, 60, 40]; } },
    taster: { name: 'Taster', kategorie: 'Eingänge', hilfe: 'Gibt 1, solange er gedrückt gehalten wird.', buchstabe: true, halten: true, werte: { gedrueckt: 0, farbe: '' }, pins: einAus, box: function () { return [-26, -20, 52, 40]; } },
    eins: { name: 'Konstante 1', kategorie: 'Eingänge', hilfe: 'Liefert immer 1 (Spannung liegt an).', kuerzel: 'H', werte: { farbe: '' }, pins: einAus, box: function () { return [-22, -18, 44, 36]; } },
    null: { name: 'Konstante 0', kategorie: 'Eingänge', hilfe: 'Liefert immer 0.', kuerzel: 'L', werte: { farbe: '' }, pins: einAus, box: function () { return [-22, -18, 44, 36]; } },
    takt: { name: 'Taktgeber', kategorie: 'Eingänge', hilfe: 'Wechselt gleichmäßig zwischen 1 und 0, solange die Simulation läuft.', kuerzel: 'CLK', werte: { frequenz: 1, farbe: '' }, pins: einAus, box: function () { return [-28, -20, 56, 40]; } },
    und: { name: 'UND-Gatter', kategorie: 'Gatter', kuerzel: 'G', gatter: true, werte: { eingaenge: 2, farbe: '' }, pins: gatterPins, box: gatterBox },
    oder: { name: 'ODER-Gatter', kategorie: 'Gatter', kuerzel: 'G', gatter: true, werte: { eingaenge: 2, farbe: '' }, pins: gatterPins, box: gatterBox },
    nicht: { name: 'NICHT-Gatter', kategorie: 'Gatter', kuerzel: 'G', gatter: true, werte: { farbe: '' }, pins: gatterPins, box: gatterBox },
    xor: { name: 'XOR-Gatter', kategorie: 'Gatter', kuerzel: 'G', gatter: true, werte: { eingaenge: 2, farbe: '' }, pins: gatterPins, box: gatterBox },
    nand: { name: 'NAND-Gatter', kategorie: 'Gatter', kuerzel: 'G', gatter: true, werte: { eingaenge: 2, farbe: '' }, pins: gatterPins, box: gatterBox },
    nor: { name: 'NOR-Gatter', kategorie: 'Gatter', kuerzel: 'G', gatter: true, werte: { eingaenge: 2, farbe: '' }, pins: gatterPins, box: gatterBox },
    xnor: { name: 'XNOR-Gatter', kategorie: 'Gatter', kuerzel: 'G', gatter: true, werte: { eingaenge: 2, farbe: '' }, pins: gatterPins, box: gatterBox },
    lampe: { name: 'Lampe', kategorie: 'Ausgaben', hilfe: 'Leuchtet, wenn am Eingang 1 anliegt.', kuerzel: 'Y', werte: { farbe: '#ffc83d', gehaeuse: '' },
      pins: function () { return { e: { x: -40, y: 0, art: 'ein', text: '' } }; }, box: function () { return [-26, -26, 52, 52]; } },
    segment: { name: '7-Segment-Anzeige', kategorie: 'Ausgaben', hilfe: 'Jedes Segment a–g und der Punkt (dp) hat einen eigenen Eingang.', kuerzel: 'ANZ', werte: { farbe: '#ff4d3d', gehaeuse: '' },
      pins: function () { var p = {}; SEGMENTE.concat(['dp']).forEach(function (s, i) { p[s] = { x: -60, y: -70 + i * 20, art: 'ein', text: s }; }); return p; },
      box: function () { return [-46, -84, 92, 168]; } },
    relais: { name: 'Relais', kategorie: 'Bausteine', hilfe: 'Steuereingang S zieht das Relais an: dann ist COM mit NO verbunden, sonst mit NC.', kuerzel: 'K', werte: { farbe: '' },
      pins: function () { return { s: { x: -60, y: -30, art: 'ein', text: 'S' }, com: { x: -60, y: 30, art: 'ein', text: 'COM' }, no: { x: 60, y: 10, art: 'aus', text: 'NO' }, nc: { x: 60, y: 50, art: 'aus', text: 'NC' } }; },
      box: function () { return [-46, -54, 92, 118]; } },
    decoder: { name: 'Decoder (BCD → 7 Segmente)', kategorie: 'Bausteine', hilfe: 'Wandelt eine 4-Bit-Zahl (Eingänge 1, 2, 4, 8) in die Segmentsignale a–g für 0–9 und A–F um.', kuerzel: 'DEC', werte: { farbe: '' },
      pins: function () {
        var p = {};
        [1, 2, 4, 8].forEach(function (w, i) { p['d' + i] = { x: -60, y: -30 + i * 20, art: 'ein', text: String(w) }; });
        SEGMENTE.forEach(function (s, i) { p[s] = { x: 60, y: -60 + i * 20, art: 'aus', text: s }; });
        return p;
      },
      box: function () { return [-46, -74, 92, 148]; } },
  };
  var KATEGORIEN = ['Eingänge', 'Gatter', 'Ausgaben', 'Bausteine'];

  // ---------------------------------------------------------------- Werte

  function normalisiere(typ, w) {
    w = w || {};
    var d = TYPEN[typ].werte, out = {};
    for (var k in d) out[k] = d[k];
    if ('an' in d) out.an = bit(w.an);
    if ('gedrueckt' in d) out.gedrueckt = bit(w.gedrueckt);
    if ('eingaenge' in d) out.eingaenge = Math.round(klemme(zahl(w.eingaenge, d.eingaenge), 2, 8));
    if ('frequenz' in d) out.frequenz = Math.round(klemme(zahl(w.frequenz, d.frequenz), 0.2, 5) * 10) / 10;
    if ('farbe' in d) out.farbe = w.farbe === '' ? (typ === 'lampe' || typ === 'segment' ? d.farbe : '') : farbe(w.farbe, d.farbe);
    if ('gehaeuse' in d) out.gehaeuse = w.gehaeuse === '' ? '' : farbe(w.gehaeuse, d.gehaeuse);
    return out;
  }
  var pins = function (b) { return TYPEN[b.typ].pins(b); };
  var box = function (b) { return TYPEN[b.typ].box(b); };
  function anschlussName(b, a) { var p = pins(b)[a]; return p ? (p.art === 'ein' ? 'Eingang ' : 'Ausgang ') + (p.text || '') : a; }
  function art(doc, ref) { var b = finde(doc, ref.b); var p = b && pins(b)[ref.a]; return p ? p.art : null; }

  function neu() { return { format: 'logik-labor', version: 1, bauteile: [], draehte: [], optionen: { aktiv: '', inaktiv: '', pegel: true } }; }
  function finde(doc, id) { for (var i = 0; i < doc.bauteile.length; i++) if (doc.bauteile[i].id === id) return doc.bauteile[i]; return null; }
  function findeDraht(doc, id) { for (var i = 0; i < doc.draehte.length; i++) if (doc.draehte[i].id === id) return doc.draehte[i]; return null; }
  function neueId(doc, p) {
    var used = {};
    doc.bauteile.forEach(function (b) { used[b.id] = 1; }); doc.draehte.forEach(function (d) { used[d.id] = 1; });
    for (var i = 1; ; i++) if (!used[p + i]) return p + i;
  }
  /** Name: Eingänge A, B, C …, Lampen Y, Y2 …, sonst Kürzel + Nummer (G1, K1, …). */
  function neuerName(doc, typ) {
    var used = {}, T = TYPEN[typ];
    doc.bauteile.forEach(function (b) { used[b.name] = 1; });
    if (T.buchstabe) for (var c = 0; c < 26; c++) { var n = String.fromCharCode(65 + c); if (!used[n] && n !== 'Y' && n !== 'Q') return n; }
    if (typ === 'lampe' && !used.Y) return 'Y';
    var k = T.kuerzel || 'E';
    for (var i = typ === 'lampe' ? 2 : 1; ; i++) if (!used[k + i]) return k + i;
  }

  function bauteil(doc, typ, x, y, werte) {
    if (!TYPEN[typ]) throw new Error('Unbekanntes Bauteil: ' + typ);
    var w = {}, d = TYPEN[typ].werte, k;
    for (k in d) w[k] = d[k];
    for (k in (werte || {})) w[k] = werte[k];
    var b = { id: neueId(doc, 'b'), typ: typ, name: neuerName(doc, typ), x: runde(klemme(zahl(x, 0), -GRENZE, GRENZE)), y: runde(klemme(zahl(y, 0), -GRENZE, GRENZE)), rot: 0, werte: normalisiere(typ, w) };
    doc.bauteile.push(b);
    return b;
  }

  // ---------------------------------------------------------------- Geometrie

  function drehe(x, y, rot) {
    switch (((rot % 360) + 360) % 360) { case 90: return [-y, x]; case 180: return [-x, -y]; case 270: return [y, -x]; default: return [x, y]; }
  }
  function lokal(b, x, y) { var p = drehe(x - b.x, y - b.y, 360 - b.rot); return { x: p[0], y: p[1] }; }
  function anschluesse(b) {
    var out = [], ps = pins(b);
    for (var a in ps) { var p = drehe(ps[a].x, ps[a].y, b.rot); out.push({ b: b.id, a: a, x: b.x + p[0], y: b.y + p[1], art: ps[a].art, text: ps[a].text }); }
    return out;
  }
  function anschlussPos(doc, ref) {
    var b = finde(doc, ref.b); if (!b) return null;
    var p = pins(b)[ref.a]; if (!p) return null;
    var q = drehe(p.x, p.y, b.rot);
    return { x: b.x + q[0], y: b.y + q[1] };
  }
  function richtung(doc, ref) {
    var b = finde(doc, ref.b), p = pins(b)[ref.a];
    var dx = Math.abs(p.x) >= Math.abs(p.y) ? Math.sign(p.x) : 0, dy = dx ? 0 : Math.sign(p.y);
    var q = drehe(dx, dy, b.rot);
    return { x: q[0], y: q[1] };
  }
  /** Orthogonale Leitung: gerade, L- oder Z-förmig. */
  function drahtPunkte(doc, d) {
    var p = anschlussPos(doc, d.von), q = anschlussPos(doc, d.nach);
    if (!p || !q) return null;
    if (p.x === q.x || p.y === q.y) return [p, q];
    var rv = richtung(doc, d.von), rn = richtung(doc, d.nach), hv = rv.x !== 0, hn = rn.x !== 0;
    // Rückwärts (Ausgang liegt rechts vom Eingang, z. B. Rückkopplung): außen herum statt durch die Bauteile
    if (hv && hn && (q.x - p.x) * rv.x < 40) {
      var x1 = p.x + rv.x * 20, x2 = q.x + rn.x * 20, ym = Math.round((p.y + q.y) / 20) * 10;
      if (ym === p.y || ym === q.y) ym += 20;
      return [p, { x: x1, y: p.y }, { x: x1, y: ym }, { x: x2, y: ym }, { x: x2, y: q.y }, q];
    }
    if (hv && !hn) return [p, { x: q.x, y: p.y }, q];
    if (!hv && hn) return [p, { x: p.x, y: q.y }, q];
    if (hv) {
      // Senkrechtes Stück leicht versetzt (je nach Ziel), damit Leitungen zu benachbarten Eingängen nicht aufeinanderliegen
      var versatz = ((((Math.round(q.y / 20) % 4) + 4) % 4) - 1.5) * 10;
      var mx = klemme(Math.round((p.x + q.x) / 20) * 10 + versatz, Math.min(p.x, q.x) + 10, Math.max(p.x, q.x) - 10);
      return [p, { x: mx, y: p.y }, { x: mx, y: q.y }, q];
    }
    var my = Math.round((p.y + q.y) / 20) * 10;
    return [p, { x: p.x, y: my }, { x: q.x, y: my }, q];
  }
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
    for (var i = doc.bauteile.length - 1; i >= 0; i--) {
      var b = doc.bauteile[i], p = lokal(b, x, y), bx = box(b);
      if (p.x >= bx[0] && p.x <= bx[0] + bx[2] && p.y >= bx[1] && p.y <= bx[1] + bx[3]) return { art: 'bauteil', b: b.id };
    }
    var bw = null; bestD = tol * 0.8;
    doc.draehte.forEach(function (d) {
      var pts = drahtPunkte(doc, d); if (!pts) return;
      for (var k = 0; k < pts.length - 1; k++) { var dd = abstandStrecke(x, y, pts[k], pts[k + 1]); if (dd <= bestD) { bestD = dd; bw = { art: 'draht', d: d.id }; } }
    });
    return bw;
  }

  // ---------------------------------------------------------------- Bearbeiten

  var gleich = function (r, s) { return r.b === s.b && r.a === s.a; };

  /** Ist die Verbindung erlaubt? Gibt den Grund zurück oder null. */
  function verbindungFehler(doc, x, y) {
    var ax = x && art(doc, x), ay = y && art(doc, y);
    if (!ax || !ay) return 'Eine Leitung muss an zwei Anschlüssen enden.';
    if (gleich(x, y)) return 'Eine Leitung braucht zwei verschiedene Anschlüsse.';
    if (ax === 'aus' && ay === 'aus') return 'Zwei Ausgänge dürfen nicht verbunden werden – sie würden gegeneinander arbeiten.';
    if (ax === 'ein' && ay === 'ein') return 'Zwei Eingänge lassen sich nicht direkt verbinden: Ein Eingang braucht sein Signal von einem Ausgang.';
    var aus = ax === 'aus' ? x : y, ein = ax === 'aus' ? y : x;
    for (var i = 0; i < doc.draehte.length; i++) {
      var d = doc.draehte[i];
      if (gleich(d.von, aus) && gleich(d.nach, ein)) return 'Diese Anschlüsse sind schon verbunden.';
      if (gleich(d.nach, ein)) return 'Dieser Eingang ist schon angeschlossen. Ein Eingang bekommt nur ein Signal – ein Ausgang darf aber mehrere Eingänge versorgen.';
    }
    return null;
  }
  function verbinde(doc, x, y) {
    var grund = verbindungFehler(doc, x, y);
    if (grund) return { ok: false, grund: grund };
    var vonAus = art(doc, x) === 'aus';
    var d = { id: neueId(doc, 'd'), von: { b: (vonAus ? x : y).b, a: (vonAus ? x : y).a }, nach: { b: (vonAus ? y : x).b, a: (vonAus ? y : x).a } };
    doc.draehte.push(d);
    return { ok: true, draht: d };
  }
  function verschiebe(doc, id, x, y) {
    var b = finde(doc, id); if (!b) return false;
    var nx = runde(klemme(x, -GRENZE, GRENZE)), ny = runde(klemme(y, -GRENZE, GRENZE));
    if (nx === b.x && ny === b.y) return false;
    b.x = nx; b.y = ny; return true;
  }
  function drehen(doc, id) { var b = finde(doc, id); if (!b) return false; b.rot = (b.rot + 90) % 360; return true; }
  /** Leitungen entfernen, deren Anschluss es nicht (mehr) gibt, z. B. nach weniger Gatter-Eingängen. */
  function aufraeumen(doc) {
    var n = doc.draehte.length;
    doc.draehte = doc.draehte.filter(function (d) { return art(doc, d.von) === 'aus' && art(doc, d.nach) === 'ein'; });
    return n - doc.draehte.length;
  }
  function loesche(doc, sel) {
    if (!sel) return false;
    var ids = sel.art === 'mehrere' ? sel.ids : [sel.id];
    if (sel.art === 'draht') { var n = doc.draehte.length; doc.draehte = doc.draehte.filter(function (d) { return d.id !== sel.id; }); return doc.draehte.length !== n; }
    var vorher = doc.bauteile.length;
    doc.bauteile = doc.bauteile.filter(function (b) { return ids.indexOf(b.id) < 0; });
    doc.draehte = doc.draehte.filter(function (d) { return ids.indexOf(d.von.b) < 0 && ids.indexOf(d.nach.b) < 0; });
    return doc.bauteile.length !== vorher;
  }
  function setzeWert(doc, id, k, v) {
    var b = finde(doc, id); if (!b) return false;
    var w = {}; for (var x in b.werte) w[x] = b.werte[x];
    w[k] = v;
    b.werte = normalisiere(b.typ, w);
    aufraeumen(doc);
    return true;
  }
  function setzeName(doc, id, name) {
    var b = finde(doc, id); if (!b) return false;
    name = String(name == null ? '' : name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
    b.name = name || neuerName(doc, b.typ);
    return true;
  }
  /** Klick/Tippen: Schalter umlegen. */
  function tippAktion(doc, id) {
    var b = finde(doc, id);
    if (b && b.typ === 'schalter') { b.werte.an = b.werte.an ? 0 : 1; return 'Schalter ' + b.name + ' = ' + b.werte.an; }
    return null;
  }
  function kopie(doc) { return JSON.parse(JSON.stringify(doc)); }

  // ---------------------------------------------------------------- Speichern und Laden

  function exportiere(doc) {
    return JSON.stringify({
      format: 'logik-labor', version: 1,
      bauteile: doc.bauteile.map(function (b) { var w = {}; for (var k in b.werte) w[k] = b.werte[k]; if ('gedrueckt' in w) w.gedrueckt = 0; return { id: b.id, typ: b.typ, name: b.name, x: b.x, y: b.y, rot: b.rot, werte: w }; }),
      draehte: doc.draehte.map(function (d) { var x = { id: d.id, von: d.von, nach: d.nach }; if (d.farbe) x.farbe = d.farbe; return x; }),
      optionen: doc.optionen || neu().optionen,
    }, null, 1);
  }
  function importiere(text) {
    var data;
    try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, fehler: 'Die Datei ist keine gültige Schaltung (kein JSON).' }; }
    if (!data || data.format !== 'logik-labor' || !Array.isArray(data.bauteile) || !Array.isArray(data.draehte)) return { ok: false, fehler: 'Die Datei ist keine Schaltung aus dem Logik-Labor.' };
    if (data.version !== 1) return { ok: false, fehler: 'Diese Version des Speicherformats wird nicht unterstützt.' };
    if (data.bauteile.length > 300 || data.draehte.length > 900) return { ok: false, fehler: 'Die Schaltung ist zu groß.' };
    var doc = neu(), hinweise = [], ids = {};
    var o = data.optionen || {};
    doc.optionen = { aktiv: farbe(o.aktiv, ''), inaktiv: farbe(o.inaktiv, ''), pegel: o.pegel !== false };
    data.bauteile.forEach(function (b) {
      if (!b || !TYPEN[b.typ] || typeof b.id !== 'string' || !/^[a-z0-9-]{1,24}$/.test(b.id) || ids[b.id]) { hinweise.push('Ein unbekanntes oder ungültiges Bauteil wurde übersprungen.'); return; }
      var nb = { id: b.id, typ: b.typ, name: '', x: runde(klemme(zahl(b.x, 0), -GRENZE, GRENZE)), y: runde(klemme(zahl(b.y, 0), -GRENZE, GRENZE)), rot: [0, 90, 180, 270].indexOf(b.rot) >= 0 ? b.rot : 0, werte: normalisiere(b.typ, b.werte) };
      ids[b.id] = 1;
      doc.bauteile.push(nb);
      setzeName(doc, nb.id, typeof b.name === 'string' ? b.name : '');
    });
    data.draehte.forEach(function (d) {
      var ok = d && d.von && d.nach && typeof d.von.b === 'string' && typeof d.nach.b === 'string';
      var r = ok ? verbinde(doc, { b: d.von.b, a: String(d.von.a) }, { b: d.nach.b, a: String(d.nach.a) }) : { ok: false };
      if (r.ok && d.farbe) r.draht.farbe = farbe(d.farbe, undefined);
      if (r.ok && !r.draht.farbe) delete r.draht.farbe;
      if (!r.ok) hinweise.push('Eine ungültige Leitung wurde übersprungen.');
    });
    return { ok: true, doc: doc, hinweise: hinweise.filter(function (h, i, a) { return a.indexOf(h) === i; }) };
  }

  // ---------------------------------------------------------------- Beispiele (echte, bearbeitbare Schaltungen)

  function verb(doc, a, pa, b, pb) { var r = verbinde(doc, { b: a.id, a: pa }, { b: b.id, a: pb }); if (!r.ok) throw new Error(r.grund); }
  function zweiSchalterGatter(typ) {
    var doc = neu();
    var a = bauteil(doc, 'schalter', -160, -40), b = bauteil(doc, 'schalter', -160, 40);
    var g = bauteil(doc, typ, 0, 0), y = bauteil(doc, 'lampe', 160, 0);
    verb(doc, a, 'q', g, 'e1'); verb(doc, b, 'q', g, 'e2'); verb(doc, g, 'q', y, 'e');
    return doc;
  }
  var BEISPIELE = {
    und: { titel: 'UND-Gatter mit zwei Schaltern und Lampe', bauen: function () { return zweiSchalterGatter('und'); } },
    oder: { titel: 'ODER-Gatter mit zwei Eingängen', bauen: function () { return zweiSchalterGatter('oder'); } },
    nicht: { titel: 'NICHT-Gatter mit einem Eingang', bauen: function () {
      var doc = neu(), a = bauteil(doc, 'schalter', -140, 0), g = bauteil(doc, 'nicht', 0, 0), y = bauteil(doc, 'lampe', 140, 0);
      verb(doc, a, 'q', g, 'e1'); verb(doc, g, 'q', y, 'e'); return doc;
    } },
    xor: { titel: 'XOR-Gatter mit zwei Schaltern', bauen: function () { return zweiSchalterGatter('xor'); } },
    halbaddierer: { titel: 'Kombination: Halbaddierer (XOR + UND)', bauen: function () {
      var doc = neu();
      var a = bauteil(doc, 'schalter', -200, -40), b = bauteil(doc, 'schalter', -200, 60);
      var x = bauteil(doc, 'xor', 0, -60), u = bauteil(doc, 'und', 0, 80);
      var s = bauteil(doc, 'lampe', 180, -60, { farbe: '#2fbf5b' }), c = bauteil(doc, 'lampe', 180, 80, { farbe: '#ff4d3d' });
      setzeName(doc, s.id, 'S'); setzeName(doc, c.id, 'C');
      verb(doc, a, 'q', x, 'e1'); verb(doc, b, 'q', x, 'e2'); verb(doc, a, 'q', u, 'e1'); verb(doc, b, 'q', u, 'e2');
      verb(doc, x, 'q', s, 'e'); verb(doc, u, 'q', c, 'e');
      return doc;
    } },
    relais: { titel: 'Relaissteuerung mit Lampen', bauen: function () {
      var doc = neu();
      var a = bauteil(doc, 'schalter', -200, -40), v = bauteil(doc, 'eins', -200, 60);
      var k = bauteil(doc, 'relais', 0, 0);
      var y1 = bauteil(doc, 'lampe', 200, -40, { farbe: '#2fbf5b' }), y2 = bauteil(doc, 'lampe', 200, 80, { farbe: '#ff4d3d' });
      setzeName(doc, y1.id, 'Grün'); setzeName(doc, y2.id, 'Rot');
      verb(doc, a, 'q', k, 's'); verb(doc, v, 'q', k, 'com'); verb(doc, k, 'no', y1, 'e'); verb(doc, k, 'nc', y2, 'e');
      return doc;
    } },
    segment: { titel: '7-Segment-Anzeige mit 4 Schaltern und Decoder', bauen: function () {
      var doc = neu(), sw = [];
      for (var i = 0; i < 4; i++) sw.push(bauteil(doc, 'schalter', -260, -60 + i * 80));
      // oben das höchstwertige Bit (8), damit die Wahrheitstabelle wie eine Dualzahl gelesen wird
      ['8', '4', '2', '1'].forEach(function (n, i) { setzeName(doc, sw[i].id, 'Bit ' + n); });
      var dec = bauteil(doc, 'decoder', -40, 60), anz = bauteil(doc, 'segment', 180, 60);
      sw.forEach(function (s, i) { verb(doc, s, 'q', dec, 'd' + (3 - i)); });
      SEGMENTE.forEach(function (s) { verb(doc, dec, s, anz, s); });
      return doc;
    } },
    flipflop: { titel: 'Speicher: RS-Flipflop aus zwei NOR-Gattern (Rückkopplung)', bauen: function () {
      var doc = neu();
      var s = bauteil(doc, 'taster', -200, -40), r = bauteil(doc, 'taster', -200, 80);
      setzeName(doc, s.id, 'Setzen'); setzeName(doc, r.id, 'Rücksetzen');
      var n1 = bauteil(doc, 'nor', 0, -40), n2 = bauteil(doc, 'nor', 0, 80), y = bauteil(doc, 'lampe', 180, 80);
      setzeName(doc, y.id, 'Q');
      verb(doc, r, 'q', n2, 'e2'); verb(doc, s, 'q', n1, 'e1');
      verb(doc, n1, 'q', n2, 'e1'); verb(doc, n2, 'q', n1, 'e2'); verb(doc, n2, 'q', y, 'e');
      return doc;
    } },
  };

  SL.RASTER = RASTER;
  SL.TYPEN = TYPEN;
  SL.KATEGORIEN = KATEGORIEN;
  SL.GATTER = GATTER;
  SL.SEGMENTE = SEGMENTE;
  SL.HEX = HEX;
  SL.HEX_ZEICHEN = HEX_ZEICHEN;
  SL.FARBEN = { leucht: LEUCHTFARBEN, bauteil: BAUTEILFARBEN, leitung: LEITUNGSFARBEN, pruefe: farbe };
  SL.BEISPIELE = BEISPIELE;
  SL.modell = {
    neu: neu, bauteil: bauteil, finde: finde, findeDraht: findeDraht, normalisiere: normalisiere, pins: pins, box: box, art: art,
    anschlussName: anschlussName, drehe: drehe, lokal: lokal, anschluesse: anschluesse, anschlussPos: anschlussPos, richtung: richtung,
    drahtPunkte: drahtPunkte, trefferTest: trefferTest, tippAktion: tippAktion, verbinde: verbinde, verbindungFehler: verbindungFehler,
    verschiebe: verschiebe, drehen: drehen, loesche: loesche, setzeWert: setzeWert, setzeName: setzeName, aufraeumen: aufraeumen, kopie: kopie,
    exportiere: exportiere, importiere: importiere, runde: runde, neuerName: neuerName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
