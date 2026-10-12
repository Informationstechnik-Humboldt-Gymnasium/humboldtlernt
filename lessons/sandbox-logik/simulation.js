// Logik-Labor · Simulations-Engine (ohne Darstellung, auch für die Wahrheitstabelle benutzt)
//
// Modell: rein digital. Jeder Ausgang hat den Wert 0 oder 1, jeder Eingang übernimmt den Wert des Ausgangs,
// mit dem er verbunden ist. Offene Eingänge gelten als 0. „1“ heißt: Spannung liegt an.
// Relais: Der Steuereingang S schaltet den Kontakt um. Der Kontakt gibt das Signal von COM an NO (angezogen)
// bzw. NC (Ruhe) weiter; ein offener Kontakt liefert 0. Damit ist der geschaltete Kreis logisch vom Steuerkreis getrennt.
//
// Auswertung: Die Bauteile werden in Signalrichtung sortiert (topologisch) und so lange der Reihe nach neu
// berechnet, bis sich nichts mehr ändert. Ohne Rückkopplung genügt ein Durchlauf. Mit Rückkopplung (z. B.
// Flipflop) startet die Rechnung vom vorherigen Zustand; ändert sich nach MAX_SCHRITTE Durchläufen noch etwas,
// schwingt die Schaltung (z. B. NICHT-Gatter, dessen Ausgang auf den eigenen Eingang führt) – das wird gemeldet.
// Gleiche Eingänge und gleicher Ausgangszustand liefern immer dasselbe Ergebnis.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});
  var MAX_SCHRITTE = 64;

  /** Ausgänge eines Bauteils aus seinen Eingängen berechnen. e = { pin: 0|1 }, opt = Auswertungsoptionen. */
  function rechne(b, e, opt) {
    var w = b.werte, s = opt.setzen || {};
    switch (b.typ) {
      case 'schalter': return { q: s[b.id] != null ? s[b.id] : w.an };
      case 'taster': return { q: s[b.id] != null ? s[b.id] : w.gedrueckt };
      case 'eins': return { q: 1 };
      case 'null': return { q: 0 };
      case 'takt': return { q: s[b.id] != null ? s[b.id] : (((opt.t || 0) * w.frequenz) % 1 < 0.5 ? 1 : 0) };
      case 'relais': return { no: e.s ? e.com : 0, nc: e.s ? 0 : e.com };
      case 'decoder': {
        var n = e.d0 + 2 * e.d1 + 4 * e.d2 + 8 * e.d3, muster = SL.HEX[n], out = {};
        SL.SEGMENTE.forEach(function (seg, i) { out[seg] = muster.charAt(i) === '1' ? 1 : 0; });
        return out;
      }
      default:
        if (SL.GATTER[b.typ]) {
          var liste = Object.keys(SL.modell.pins(b)).filter(function (p) { return p !== 'q'; }).map(function (p) { return e[p]; });
          return { q: SL.GATTER[b.typ].f(liste) };
        }
        return {};
    }
  }

  /** Welches Zeichen zeigt eine 7-Segment-Anzeige? null, wenn das Muster kein Zeichen 0–F ist. */
  function zeichenVon(seg) {
    var m = SL.SEGMENTE.map(function (s) { return seg[s] ? '1' : '0'; }).join('');
    if (m === '0000000') return '';
    var i = SL.HEX.indexOf(m);
    return i >= 0 ? SL.HEX_ZEICHEN.charAt(i) : null;
  }

  /**
   * Wertet die Schaltung aus.
   * opt.t: Zeit in s (Taktgeber) · opt.vorher: Ausgangswerte der letzten Auswertung (für Rückkopplungen)
   * opt.setzen: { bauteilId: 0|1 } überschreibt Schalter/Taster/Takt (für die Wahrheitstabelle)
   */
  function auswerten(doc, opt) {
    opt = opt || {};
    var M = SL.modell, key = function (b, a) { return b + ':' + a; };
    var teile = doc.bauteile.slice().sort(function (x, y) { return x.id < y.id ? -1 : x.id > y.id ? 1 : 0; });
    var treiber = {};   // Eingang → Ausgang
    doc.draehte.forEach(function (d) { treiber[key(d.nach.b, d.nach.a)] = key(d.von.b, d.von.a); });

    // Reihenfolge in Signalrichtung (Kahn); Bauteile in Rückkopplungsschleifen kommen danach
    var nach = {}, grad = {};
    teile.forEach(function (b) { nach[b.id] = []; grad[b.id] = 0; });
    doc.draehte.forEach(function (d) { nach[d.von.b].push(d.nach.b); grad[d.nach.b]++; });
    var reihe = [], frei = teile.filter(function (b) { return !grad[b.id]; }).map(function (b) { return b.id; });
    while (frei.length) {
      var id = frei.shift();
      reihe.push(id);
      nach[id].forEach(function (z) { if (--grad[z] === 0) frei.push(z); });
    }
    var zyklisch = reihe.length < teile.length;
    teile.forEach(function (b) { if (reihe.indexOf(b.id) < 0) reihe.push(b.id); });
    var nachId = {}; teile.forEach(function (b) { nachId[b.id] = b; });

    var aus = {}, vorher = opt.vorher || {};
    teile.forEach(function (b) { M.anschluesse(b).forEach(function (p) { if (p.art === 'aus') aus[key(b.id, p.a)] = vorher[key(b.id, p.a)] ? 1 : 0; }); });
    var eingang = function (b, a) { var t = treiber[key(b.id, a)]; return t ? aus[t] || 0 : 0; };
    var eingaenge = function (b) { var e = {}; M.anschluesse(b).forEach(function (p) { if (p.art === 'ein') e[p.a] = eingang(b, p.a); }); return e; };

    var schritte = 0, stabil = false;
    for (; schritte < MAX_SCHRITTE; schritte++) {
      var geaendert = false;
      for (var i = 0; i < reihe.length; i++) {
        var b = nachId[reihe[i]], neu = rechne(b, eingaenge(b), opt);
        for (var p in neu) { var k = key(b.id, p); if (aus[k] !== neu[p]) { aus[k] = neu[p]; geaendert = true; } }
      }
      if (!geaendert) { stabil = true; break; }
    }

    // Ergebnis je Bauteil, Eingang und Leitung
    var erg = { aus: aus, ein: {}, offen: [], draehte: {}, bauteile: {}, zyklisch: zyklisch, schwingt: !stabil, schritte: schritte + 1, meldungen: [] };
    teile.forEach(function (b) {
      var e = eingaenge(b), r = { ein: e, aus: {} };
      M.anschluesse(b).forEach(function (p) {
        if (p.art === 'ein') { erg.ein[key(b.id, p.a)] = e[p.a]; if (!treiber[key(b.id, p.a)] && !(b.typ === 'segment' && p.a === 'dp')) erg.offen.push({ b: b.id, a: p.a }); }
        else r.aus[p.a] = aus[key(b.id, p.a)];
      });
      if (b.typ === 'lampe') r.an = e.e;
      if (b.typ === 'relais') r.angezogen = e.s;
      if (b.typ === 'segment') { r.segmente = e; r.zeichen = zeichenVon(e); }
      if (r.aus.q != null) r.q = r.aus.q;
      erg.bauteile[b.id] = r;
    });
    doc.draehte.forEach(function (d) { erg.draehte[d.id] = aus[key(d.von.b, d.von.a)] || 0; });

    // Meldungen
    var meld = function (art, text, ids) { erg.meldungen.push({ art: art, text: text, ids: ids || [] }); };
    if (!doc.bauteile.length) meld('hinweis', 'Ziehe Bauteile aus der Bibliothek auf die Arbeitsfläche oder lade ein Beispiel.');
    if (erg.schwingt) meld('warnung', 'Die Schaltung kommt nicht zur Ruhe: Ein Signal wirkt über eine Rückkopplung so auf sich selbst zurück, dass es ständig umschaltet (z. B. ein NICHT-Gatter im Kreis). Angezeigt wird der letzte berechnete Zustand.');
    else if (zyklisch) meld('hinweis', 'Die Schaltung hat eine Rückkopplung (z. B. ein Flipflop). Sie merkt sich ihren Zustand: Das Ergebnis kann davon abhängen, was vorher war.');
    var offenGruppen = {};
    erg.offen.forEach(function (o) { var b = nachId[o.b]; if (b.typ === 'segment') return; (offenGruppen[b.name] = offenGruppen[b.name] || []).push(SL.modell.pins(b)[o.a].text || o.a); });
    var liste = Object.keys(offenGruppen).map(function (n) { var t = offenGruppen[n].filter(Boolean); return n + (t.length ? ' (' + t.join(', ') + ')' : ''); });
    if (liste.length) meld('hinweis', 'Nicht angeschlossene Eingänge gelten als 0: ' + liste.join('; ') + '.', erg.offen.map(function (o) { return o.b; }));
    var lampen = doc.bauteile.filter(function (b) { return b.typ === 'lampe' || b.typ === 'segment'; });
    if (doc.bauteile.length && !lampen.length) meld('hinweis', 'Tipp: Schließe eine Lampe oder Anzeige an, um das Ergebnis zu sehen.');
    return erg;
  }

  /** Ausgangswerte für die nächste Auswertung (Gedächtnis von Rückkopplungen). */
  function zustand(erg) { var z = {}; for (var k in erg.aus) z[k] = erg.aus[k]; return z; }

  SL.sim = { auswerten: auswerten, rechne: rechne, zeichenVon: zeichenVon, zustand: zustand, MAX_SCHRITTE: MAX_SCHRITTE };
})(typeof window !== 'undefined' ? window : globalThis);
