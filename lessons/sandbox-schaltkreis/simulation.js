// Schaltkreis-Labor · Simulationskern
//
// Berechnet eine Schaltung aus modell.js mit der modifizierten Knotenpotenzialanalyse (MNA):
//   - jeder Anschluss ist ein Knoten, Drähte und geschlossene Schalter sind sehr kleine Widerstände (1 mΩ),
//     dadurch gibt es auch für jeden Draht eine Stromstärke (für die Stromfluss-Animation),
//   - Spannungsquellen sind ideale Quellen (eigene Unbekannte: ihre Stromstärke),
//   - die Diode folgt der Shockley-Gleichung und wird mit dem Newton-Verfahren (mit Spannungsbegrenzung) gelöst,
//   - der NPN-Transistor folgt dem Ebers-Moll-Modell (zwei pn-Übergänge, Stromverstärkung β),
//   - Wechselspannungsquellen: Die Schaltung wird zu einem Zeitpunkt t berechnet (es gibt keine Spulen und
//     Kondensatoren, deshalb ist jeder Zeitpunkt unabhängig); zeitverlauf() tastet eine Periode ab und liefert
//     Effektiv- und Mittelwerte,
//   - Logikgatter haben eine eingebaute 5-V-Versorgung: Eingänge mit 100 kΩ gegen Masse (offen = 0),
//     Schaltschwellen 2 V / 3 V mit Hysterese, Ausgang 5 V oder 0 V mit 1 Ω Innenwiderstand,
//   - getrennte Schaltungsteile („Inseln“) bekommen je einen eigenen Bezugspunkt (0 V).
// Dazu kommen Kurzschluss-Erkennung, Multimeter (V, A, Ω) mit Prüfung der Messanordnung und verständliche Meldungen.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});

  var K = {
    R_LEITUNG: 1e-3,        // Draht, geschlossener Schalter, Strommessgerät
    R_NIEDRIG: 0.5,         // darunter zählt ein Widerstand als „ohne Widerstand“ (Kurzschluss-Prüfung)
    R_VOLTMETER: 1e7,       // Innenwiderstand Spannungsmessgerät
    I_TEST: 1e-3,           // Messstrom Widerstandsmessung
    R_OHM_INNEN: 1e8,
    R_OL: 2e7,              // darüber zeigt das Ohmmeter „OL“ (Überlauf)
    I_MAX: 10,              // ab hier ist die Quelle überlastet
    I_FLIESST: 1e-6,        // darunter gilt: es fließt kein Strom
    DIODE_IS: 1.5e-11, DIODE_NVT: 0.031, DIODE_GMIN: 1e-9, DIODE_LEITEND: 1e-4,
    MAX_ITER: 300,
    BETA_F: 100, BETA_R: 1, T_GMIN: 1e-9,
    GATTER_U: 5, GATTER_R_AUS: 1, GATTER_R_EIN: 1e5, GATTER_H: 3, GATTER_L: 2, GATTER_I_MAX: 1,
    AC_SCHNELL: 5,          // ab dieser Frequenz (Hz) zeigt die Anzeige Effektiv- und Mittelwerte
    PROBEN: 32,             // Abtastpunkte je Periode
  };
  var istGatter = function (typ) { return !!(SL.TYPEN[typ] && SL.TYPEN[typ].gatter); };
  var istQuelle = function (typ) { return typ === 'quelle' || typ === 'wechsel'; };

  // ---------------------------------------------------------------- Lineares Gleichungssystem

  /** Gauß-Verfahren mit Spaltenpivotsuche. Gibt null zurück, wenn das System (fast) singulär ist. */
  function gauss(A, z) {
    var n = z.length, i, j, k;
    for (k = 0; k < n; k++) {
      var p = k, max = Math.abs(A[k][k]);
      for (i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > max) { max = Math.abs(A[i][k]); p = i; }
      if (!(max > 1e-20)) return null;
      if (p !== k) { var t = A[k]; A[k] = A[p]; A[p] = t; var tz = z[k]; z[k] = z[p]; z[p] = tz; }
      var piv = A[k][k];
      for (i = k + 1; i < n; i++) {
        var f = A[i][k] / piv;
        if (f === 0) continue;
        for (j = k; j < n; j++) A[i][j] -= f * A[k][j];
        z[i] -= f * z[k];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = z[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
      if (!isFinite(x[i])) return null;
    }
    return x;
  }

  // ---------------------------------------------------------------- Diode

  function pn(v) {
    var e = Math.exp(Math.min(v / K.DIODE_NVT, 200));
    return { i: K.DIODE_IS * (e - 1), g: K.DIODE_IS / K.DIODE_NVT * e };
  }
  function diodeStrom(v) { var c = pn(v); return { i: c.i + K.DIODE_GMIN * v, g: c.g + K.DIODE_GMIN }; }

  /** NPN-Transistor (Ebers-Moll): Ströme, die von außen in Basis und Kollektor hineinfließen, und ihre Ableitungen. */
  function transistorStroeme(vbe, vbc) {
    var f = pn(vbe), r = pn(vbc), bf = K.BETA_F, br = K.BETA_R;
    return {
      ic: f.i - r.i * (1 + 1 / br), ib: f.i / bf + r.i / br,
      dic_be: f.g, dic_bc: -r.g * (1 + 1 / br), dib_be: f.g / bf, dib_bc: r.g / br,
    };
  }
  var V_KRIT = K.DIODE_NVT * Math.log(K.DIODE_NVT / (Math.SQRT2 * K.DIODE_IS));
  /** Spannungsbegrenzung wie in SPICE (pnjlim), damit Newton nicht über die Exponentialfunktion „hinausschießt“. */
  function begrenze(vneu, valt) {
    var vt = K.DIODE_NVT;
    if (vneu > V_KRIT && Math.abs(vneu - valt) > 2 * vt) {
      if (valt > 0) { var arg = 1 + (vneu - valt) / vt; vneu = arg > 0 ? valt + vt * Math.log(arg) : V_KRIT; }
      else vneu = vt * Math.log(vneu / vt);
    }
    return vneu;
  }

  // ---------------------------------------------------------------- Netz aufbauen

  function UnionFind(n) { this.p = []; for (var i = 0; i < n; i++) this.p.push(i); }
  UnionFind.prototype.find = function (i) { while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; } return i; };
  UnionFind.prototype.union = function (a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[a] = b; };

  /**
   * Elemente der Schaltung. art: R (Widerstand), V (Spannungsquelle), D (Diode), T (Transistor: i = Basis, j = Emitter, c = Kollektor),
   * I (Stromquelle: Ohmmeter, Gatterausgang).
   * opt.quellen: Quellen einschalten; opt.t: Zeitpunkt in s (Wechselspannung); opt.gatter: Zustände der Gatter {id: {q, a, b}};
   * opt.ohmmeter: id des Multimeters, das gerade Widerstand misst.
   */
  function netz(doc, opt) {
    var M = SL.modell, knoten = {}, liste = [], el = [];
    doc.bauteile.forEach(function (b) {
      for (var a in SL.TYPEN[b.typ].anschluesse) { knoten[b.id + ':' + a] = liste.length; liste.push({ b: b.id, a: a }); }
    });
    var k = function (b, a) { return knoten[b + ':' + a]; };
    doc.draehte.forEach(function (d) {
      var i = k(d.von.b, d.von.a), j = k(d.nach.b, d.nach.a);
      if (i == null || j == null) return;
      el.push({ art: 'R', i: i, j: j, g: 1 / K.R_LEITUNG, niedrig: true, draht: d.id });
    });
    doc.bauteile.forEach(function (b) {
      var w = b.werte;
      switch (b.typ) {
        case 'quelle':
          if (opt.quellen) { var p = M.pluspol(b); el.push({ art: 'V', i: k(b.id, p), j: k(b.id, p === 'a' ? 'b' : 'a'), v: w.spannung, bauteil: b.id }); }
          break;
        case 'wechsel':
          if (opt.quellen) el.push({ art: 'V', i: k(b.id, 'a'), j: k(b.id, 'b'), v: Math.SQRT2 * w.spannung * Math.sin(2 * Math.PI * w.frequenz * (opt.t || 0)), bauteil: b.id });
          break;
        case 'transistor':
          el.push({ art: 'T', i: k(b.id, 'b'), j: k(b.id, 'e'), c: k(b.id, 'c'), bauteil: b.id });
          break;
        case 'und': case 'oder': case 'nicht': case 'xoder': {
          var m = k(b.id, 'm');
          ['a', 'b'].forEach(function (e) { if (k(b.id, e) != null) el.push({ art: 'R', i: k(b.id, e), j: m, g: 1 / K.GATTER_R_EIN, bauteil: b.id, eingang: e }); });
          el.push({ art: 'R', i: k(b.id, 'q'), j: m, g: 1 / K.GATTER_R_AUS, bauteil: b.id, ausgang: true });
          var q = opt.gatter && opt.gatter[b.id] ? opt.gatter[b.id].q : 0;
          if (opt.quellen && q) el.push({ art: 'I', i: m, j: k(b.id, 'q'), strom: K.GATTER_U / K.GATTER_R_AUS, bauteil: b.id, quelle: true });
          break;
        }
        case 'schalter':
          if (w.geschlossen) el.push({ art: 'R', i: k(b.id, 'a'), j: k(b.id, 'b'), g: 1 / K.R_LEITUNG, niedrig: true, bauteil: b.id });
          break;
        case 'lampe': {
          var l = SL.LAMPEN[w.typ];
          el.push({ art: 'R', i: k(b.id, 'a'), j: k(b.id, 'b'), g: l.p / (l.u * l.u), bauteil: b.id });
          break;
        }
        case 'widerstand': {
          var r = Math.max(w.widerstand, K.R_LEITUNG);
          el.push({ art: 'R', i: k(b.id, 'a'), j: k(b.id, 'b'), g: 1 / r, niedrig: r < K.R_NIEDRIG, bauteil: b.id });
          break;
        }
        case 'diode':
          el.push({ art: 'D', i: k(b.id, 'a'), j: k(b.id, 'k'), bauteil: b.id });
          break;
        case 'messgeraet':
          if (w.modus === 'V') el.push({ art: 'R', i: k(b.id, 'v'), j: k(b.id, 'com'), g: 1 / K.R_VOLTMETER, bauteil: b.id });
          else if (w.modus === 'A') el.push({ art: 'R', i: k(b.id, 'v'), j: k(b.id, 'com'), g: 1 / K.R_LEITUNG, niedrig: true, amperemeter: true, bauteil: b.id });
          else if (opt.ohmmeter === b.id) {
            el.push({ art: 'I', i: k(b.id, 'com'), j: k(b.id, 'v'), strom: K.I_TEST, bauteil: b.id });
            el.push({ art: 'R', i: k(b.id, 'v'), j: k(b.id, 'com'), g: 1 / K.R_OHM_INNEN, bauteil: b.id, innen: true });
          }
          break;
      }
    });
    // Inseln: zusammenhängende Teile. Bezugspunkt bevorzugt am Minuspol einer Quelle.
    var uf = new UnionFind(liste.length);
    el.forEach(function (e) { uf.union(e.i, e.j); if (e.c != null) uf.union(e.i, e.c); });
    var bezug = {};
    el.forEach(function (e) { if (e.art === 'V') { var r = uf.find(e.j); if (bezug[r] == null) bezug[r] = e.j; } });
    for (var i = 0; i < liste.length; i++) { var r = uf.find(i); if (bezug[r] == null) bezug[r] = i; }
    return { knoten: knoten, liste: liste, el: el, uf: uf, bezug: bezug };
  }

  /** Löst das Netz (Newton-Verfahren, falls Dioden vorkommen). */
  function loese(n) {
    var nk = n.liste.length, idx = new Array(nk), N = 0, i;
    var istBezug = {};
    for (var r in n.bezug) istBezug[n.bezug[r]] = true;
    for (i = 0; i < nk; i++) idx[i] = istBezug[i] ? -1 : N++;
    var quellen = n.el.filter(function (e) { return e.art === 'V'; });
    quellen.forEach(function (e, q) { e.zeile = N + q; });
    var dioden = n.el.filter(function (e) { return e.art === 'D'; });
    var vd = dioden.map(function () { return 0; });
    var trans = n.el.filter(function (e) { return e.art === 'T'; });
    var vt = trans.map(function () { return { be: 0, bc: 0 }; });
    var G = N + quellen.length;
    var x = [];
    var konvergiert = false, iter = 0;

    for (iter = 0; iter < K.MAX_ITER; iter++) {
      var A = [], z = [];
      for (i = 0; i < G; i++) { var row = new Array(G); for (var j = 0; j < G; j++) row[j] = 0; A.push(row); z.push(0); }
      var leit = function (a, b, g) {
        var ia = idx[a], ib = idx[b];
        if (ia >= 0) A[ia][ia] += g;
        if (ib >= 0) A[ib][ib] += g;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
      };
      var strom = function (a, b, s) { // Strom s fließt im Element von a nach b (verlässt Knoten a)
        if (idx[a] >= 0) z[idx[a]] -= s;
        if (idx[b] >= 0) z[idx[b]] += s;
      };
      n.el.forEach(function (e) {
        if (e.art === 'R') leit(e.i, e.j, e.g);
        else if (e.art === 'I') strom(e.i, e.j, e.strom);
        else if (e.art === 'V') {
          var ip = idx[e.i], in_ = idx[e.j];
          if (ip >= 0) { A[ip][e.zeile] -= 1; A[e.zeile][ip] += 1; }
          if (in_ >= 0) { A[in_][e.zeile] += 1; A[e.zeile][in_] -= 1; }
          z[e.zeile] = e.v;
        }
      });
      dioden.forEach(function (e, d) {
        var c = diodeStrom(vd[d]);
        leit(e.i, e.j, c.g);
        strom(e.i, e.j, c.i - c.g * vd[d]);
      });
      trans.forEach(function (e, t) {
        var s = vt[t], c = transistorStroeme(s.be, s.bc), B = e.i, E = e.j, C = e.c;
        var add = function (r, s2, v) { if (idx[r] >= 0 && idx[s2] >= 0) A[idx[r]][idx[s2]] += v; };
        // Linearisierung: I_X ≈ I0 + a·(vbe − vbe0) + b·(vbc − vbc0), vbe = V_B − V_E, vbc = V_B − V_C
        var zeile = function (X, I0, a, b) {
          add(X, B, a + b); add(X, E, -a); add(X, C, -b);
          if (idx[X] >= 0) z[idx[X]] -= I0 - a * s.be - b * s.bc;
        };
        zeile(C, c.ic, c.dic_be, c.dic_bc);
        zeile(B, c.ib, c.dib_be, c.dib_bc);
        zeile(E, -(c.ic + c.ib), -(c.dic_be + c.dib_be), -(c.dic_bc + c.dib_bc));
        leit(B, E, K.T_GMIN); leit(B, C, K.T_GMIN);
      });
      x = gauss(A, z);
      if (!x) return { ok: false, grund: 'singulaer' };
      if (!dioden.length && !trans.length) { konvergiert = true; break; }
      var fertig = true;
      var spannung = function (a, b) { return (idx[a] >= 0 ? x[idx[a]] : 0) - (idx[b] >= 0 ? x[idx[b]] : 0); };
      trans.forEach(function (e, t) {
        var s = vt[t], be = spannung(e.i, e.j), bc = spannung(e.i, e.c);
        var nbe = begrenze(be, s.be), nbc = begrenze(bc, s.bc);
        if (Math.abs(nbe - s.be) > 1e-9 + 1e-7 * Math.abs(s.be) || Math.abs(nbc - s.bc) > 1e-9 + 1e-7 * Math.abs(s.bc) || nbe !== be || nbc !== bc) fertig = false;
        s.be = nbe; s.bc = nbc;
      });
      dioden.forEach(function (e, d) {
        var v = (idx[e.i] >= 0 ? x[idx[e.i]] : 0) - (idx[e.j] >= 0 ? x[idx[e.j]] : 0);
        var neu = begrenze(v, vd[d]);
        if (Math.abs(neu - vd[d]) > 1e-9 + 1e-7 * Math.abs(vd[d]) || neu !== v) fertig = false;
        vd[d] = neu;
      });
      if (fertig) { konvergiert = true; break; }
    }
    if (!konvergiert) return { ok: false, grund: 'konvergenz' };
    var V = new Array(nk);
    for (i = 0; i < nk; i++) V[i] = idx[i] >= 0 ? x[idx[i]] : 0;
    for (i = 0; i < nk; i++) if (!isFinite(V[i]) || Math.abs(V[i]) > 1e7) return { ok: false, grund: 'unsinnig' };
    var Iq = {};
    quellen.forEach(function (e) { Iq[e.bauteil] = x[e.zeile]; });
    return { ok: true, V: V, Iq: Iq, iter: iter + 1 };
  }

  // ---------------------------------------------------------------- Auswertung

  /** Kürzester Weg vom Plus- zum Minuspol nur über Elemente ohne Widerstand (für die Markierung des Kurzschlusses). */
  function kurzschlussWeg(n, von, nach) {
    var nachbarn = {};
    n.el.forEach(function (e) {
      if (!e.niedrig) return;
      (nachbarn[e.i] = nachbarn[e.i] || []).push({ k: e.j, e: e });
      (nachbarn[e.j] = nachbarn[e.j] || []).push({ k: e.i, e: e });
    });
    var vor = {}; vor[von] = null;
    var schlange = [von];
    while (schlange.length) {
      var k = schlange.shift();
      if (k === nach) break;
      (nachbarn[k] || []).forEach(function (x) { if (!(x.k in vor)) { vor[x.k] = { k: k, e: x.e }; schlange.push(x.k); } });
    }
    var weg = [];
    if (!(nach in vor)) return weg;
    for (var k2 = nach; vor[k2]; k2 = vor[k2].k) weg.push(vor[k2].e);
    return weg;
  }

  /** Drahtnetze (nur über Drähte verbunden) mit der Anzahl der Anschlüsse darin – für die Prüfung der Messanordnung. */
  function drahtNetze(doc, n) {
    var uf = new UnionFind(n.liste.length);
    n.el.forEach(function (e) { if (e.draht) uf.union(e.i, e.j); });
    var groesse = {};
    for (var i = 0; i < n.liste.length; i++) { var r = uf.find(i); groesse[r] = (groesse[r] || 0) + 1; }
    return {
      groesse: function (k) { return groesse[uf.find(k)]; },
      andere: function (k) { var r = uf.find(k), out = []; for (var i = 0; i < n.liste.length; i++) if (i !== k && uf.find(i) === r) out.push(i); return out; },
    };
  }

  /** Ein- und Ausgänge der Gatter aus den Knotenspannungen bestimmen (mit Hysterese). */
  function gatterAuswerten(doc, n, V, alt) {
    var neu = {};
    doc.bauteile.forEach(function (b) {
      if (!istGatter(b.typ)) return;
      var vorher = alt[b.id] || { q: 0, a: 0, b: 0 }, m = n.knoten[b.id + ':m'], z = { q: 0 };
      ['a', 'b'].forEach(function (e) {
        var i = n.knoten[b.id + ':' + e];
        if (i == null) return;
        var u = n.uf.find(i) === n.uf.find(m) ? V[i] - V[m] : 0;
        z[e] = u > K.GATTER_H ? 1 : u < K.GATTER_L ? 0 : (vorher[e] || 0);
      });
      z.q = SL.GATTER[b.typ].f(z.a, z.b || 0);
      neu[b.id] = z;
    });
    return neu;
  }
  var gleicheGatter = function (x, y) { for (var id in x) if (!y[id] || x[id].q !== y[id].q || x[id].a !== y[id].a || x[id].b !== y[id].b) return false; return true; };

  /**
   * Simuliert die Schaltung zu einem Zeitpunkt.
   * laeuft = false: Quellen sind aus, es wird nur die Widerstandsmessung berechnet.
   * opt.t: Zeitpunkt in s (für Wechselspannung), opt.gatter: Gatterzustände vom vorigen Zeitpunkt.
   * Ergebnis: { laeuft, status, bauteile: {id: {U, I, P, …}}, draehte: {id: {I}}, messgeraete: {id: {…}}, gatter, kurzschluss: [ids], meldungen: [] }
   */
  function simuliere(doc, laeuft, opt) {
    opt = opt || {};
    var M = SL.modell, F = SL.fmt;
    var erg = { laeuft: !!laeuft, status: laeuft ? 'ok' : 'gestoppt', bauteile: {}, draehte: {}, messgeraete: {}, gatter: {}, kurzschluss: [], meldungen: [] };
    var meld = function (art, text, ids, code) { erg.meldungen.push({ art: art, text: text, ids: ids || [], code: code || '' }); };
    var quellen = doc.bauteile.filter(function (b) { return istQuelle(b.typ); });
    var gatter = doc.bauteile.filter(function (b) { return istGatter(b.typ); });

    // Gatterzustände: ausgehend vom vorigen Zustand so lange nachrechnen, bis sich nichts mehr ändert
    var gz = {};
    gatter.forEach(function (b) { gz[b.id] = (opt.gatter && opt.gatter[b.id]) || { q: SL.GATTER[b.typ].f(0, 0), a: 0, b: 0 }; });
    var n = netz(doc, { quellen: !!laeuft, t: opt.t, gatter: gz });
    var lsg = loese(n), stabil = true;
    if (laeuft && gatter.length) {
      stabil = false;
      for (var runde = 0; runde < 12 && lsg.ok; runde++) {
        var neu = gatterAuswerten(doc, n, lsg.V, gz);
        if (gleicheGatter(neu, gz)) { stabil = true; break; }
        gz = neu;
        n = netz(doc, { quellen: true, t: opt.t, gatter: gz });
        lsg = loese(n);
      }
    }
    erg.gatter = gz;
    var k = function (b, a) { return n.knoten[b + ':' + a]; };
    var verbunden = {};
    doc.draehte.forEach(function (d) { verbunden[d.von.b + ':' + d.von.a] = 1; verbunden[d.nach.b + ':' + d.nach.a] = 1; });
    var netze = drahtNetze(doc, n);

    // Kurzschluss: beide Pole einer eingeschalteten Quelle nur über Elemente ohne Widerstand verbunden
    var ungueltig = {};   // Inseln (Wurzel im UnionFind) mit Kurzschluss/Überlast
    var kurz = {};
    if (laeuft) {
      var ufN = new UnionFind(n.liste.length);
      n.el.forEach(function (e) { if (e.niedrig) ufN.union(e.i, e.j); });
      n.el.forEach(function (e) {
        if (e.art !== 'V' || ufN.find(e.i) !== ufN.find(e.j)) return;
        var b = M.finde(doc, e.bauteil);
        ungueltig[n.uf.find(e.i)] = true;
        var weg = kurzschlussWeg(n, e.i, e.j), ids = [b.id];
        weg.forEach(function (x) { var id = x.draht || x.bauteil; kurz[id] = 1; ids.push(id); });
        kurz[b.id] = 1;
        var mitAmpere = weg.some(function (x) { return x.amperemeter; });
        var pole = b.typ === 'quelle' ? 'Plus- und Minuspol sind' : 'Die beiden Anschlüsse sind';
        meld('fehler', mitAmpere
          ? 'Kurzschluss an ' + b.name + ' über das Strommessgerät! Es hat fast keinen Widerstand. Strom misst man in Reihe zum Bauteil.'
          : 'Kurzschluss an ' + b.name + ': ' + pole + ' ohne Widerstand verbunden. In Wirklichkeit würde die Quelle überlastet.', ids, 'kurzschluss');
      });
    }

    if (!lsg.ok) {
      erg.status = 'fehler';
      meld('fehler', lsg.grund === 'konvergenz'
        ? 'Diese Schaltung lässt sich nicht stabil berechnen. Prüfe Dioden, Transistoren und die Verbindungen.'
        : 'Diese Schaltung lässt sich nicht berechnen (z. B. Spannungsquellen direkt parallel mit verschiedenen Spannungen).', [], 'fehler');
      lsg = { V: n.liste.map(function () { return 0; }), Iq: {} };
      doc.bauteile.forEach(function (b) { ungueltig[n.uf.find(k(b.id, Object.keys(SL.TYPEN[b.typ].anschluesse)[0]))] = true; });
    }
    var V = lsg.V;
    var U = function (i, j) { return n.uf.find(i) === n.uf.find(j) ? V[i] - V[j] : null; };

    // Überlast (z. B. Diode in Durchlassrichtung direkt an der Quelle)
    if (laeuft) quellen.forEach(function (b) {
      var I = lsg.Iq[b.id];
      var r = n.uf.find(k(b.id, 'a'));
      if (I != null && Math.abs(I) > K.I_MAX && !ungueltig[r]) {
        ungueltig[r] = true; kurz[b.id] = 1;
        meld('fehler', 'Sehr großer Strom an ' + b.name + ' (' + F(Math.abs(I), 'A') + '). Die Quelle wäre überlastet – fast wie ein Kurzschluss.', [b.id], 'ueberlast');
      }
    });
    var istUngueltig = function (i) { return !!ungueltig[n.uf.find(i)]; };
    if (Object.keys(ungueltig).length && erg.status === 'ok') erg.status = 'kurzschluss';
    erg.kurzschluss = Object.keys(kurz);

    // Drähte
    doc.draehte.forEach(function (d) {
      var i = k(d.von.b, d.von.a), j = k(d.nach.b, d.nach.a);
      var bad = istUngueltig(i);
      erg.draehte[d.id] = { I: laeuft && !bad ? (V[i] - V[j]) / K.R_LEITUNG : 0, ungueltig: laeuft && bad, kurzschluss: !!kurz[d.id] };
    });

    // Bauteile
    var irgendwoStrom = false;
    var POLE = { quelle: null, wechsel: ['a', 'b'], diode: ['a', 'k'], transistor: ['c', 'e'] };
    doc.bauteile.forEach(function (b) {
      var w = b.werte, r = { U: null, I: null, P: null, ungueltig: false };
      erg.bauteile[b.id] = r;
      if (b.typ === 'messgeraet') return;
      var pole = b.typ === 'quelle' ? [M.pluspol(b), M.pluspol(b) === 'a' ? 'b' : 'a'] : istGatter(b.typ) ? ['q', 'm'] : POLE[b.typ] || ['a', 'b'];
      var i = k(b.id, pole[0]), j = k(b.id, pole[1]);
      if (b.typ === 'lampe') { var l = SL.LAMPEN[w.typ]; r.R = l.u * l.u / l.p; r.nenn = l; r.hell = 0; r.zustand = 'aus'; }
      if (b.typ === 'widerstand') r.R = w.widerstand;
      if (b.typ === 'diode') r.zustand = 'sperrend';
      if (b.typ === 'transistor') r.zustand = 'sperrt';
      if (b.typ === 'schalter') r.zustand = w.geschlossen ? 'geschlossen' : 'offen';
      if (istGatter(b.typ)) { r.ein = { a: 0, b: 0 }; r.q = 0; }
      if (!laeuft) return;
      if (istUngueltig(i)) { r.ungueltig = true; return; }
      var u = U(i, j);
      r.U = u;
      switch (b.typ) {
        case 'quelle': case 'wechsel': r.I = lsg.Iq[b.id] || 0; break;
        case 'schalter': r.I = w.geschlossen ? u / K.R_LEITUNG : 0; break;
        case 'lampe': r.I = u / r.R; break;
        case 'widerstand': r.I = u / Math.max(w.widerstand, K.R_LEITUNG); break;
        case 'diode': r.I = u == null ? 0 : diodeStrom(u).i; r.zustand = r.I > K.DIODE_LEITEND ? 'leitend' : 'sperrend'; break;
        case 'transistor': {
          var ib = k(b.id, 'b');
          var be = U(ib, j), bc = U(ib, i);
          if (be == null || bc == null) { r.Ube = null; r.Ib = 0; r.I = 0; break; }
          var c = transistorStroeme(be, bc);
          r.Ube = be; r.Ib = c.ib + K.T_GMIN * (be + bc); r.I = c.ic - K.T_GMIN * bc;
          if (Math.abs(r.Ib) < 1e-9) r.Ib = 0;
          r.zustand = r.I < 1e-5 ? 'sperrt' : u < 0.3 ? 'durchgeschaltet' : 'verstärkt';
          break;
        }
        default: if (istGatter(b.typ)) {
          var g = gz[b.id] || { q: 0, a: 0, b: 0 };
          r.q = g.q; r.ein = { a: g.a, b: g.b || 0 };
          r.I = u == null ? 0 : (g.q ? K.GATTER_U : 0) / K.GATTER_R_AUS - u / K.GATTER_R_AUS;
          if (!verbunden[b.id + ':m']) meld('hinweis', 'Verbinde den Masseanschluss (⊥, unten) von ' + b.name + ' mit dem Minuspol, sonst haben Ein- und Ausgang keinen Bezugspunkt.', [b.id], 'gatter-masse');
          if (Math.abs(r.I) > K.GATTER_I_MAX) meld('warnung', 'Der Ausgang von ' + b.name + ' ist überlastet (' + F(Math.abs(r.I), 'A') + '). Ein Gatter schafft nur kleine Ströme – nimm z. B. eine 5-V-Lampe oder einen Widerstand.', [b.id], 'gatter-last');
        }
      }
      if (r.I != null && Math.abs(r.I) < 1e-7) r.I = 0; // Leckströme (Diode in Sperrrichtung, Messgerät) nicht anzeigen
      r.P = u == null ? 0 : u * r.I;
      if (b.typ === 'transistor' && r.Ube != null) r.P += r.Ube * r.Ib;
      if (b.typ === 'lampe') {
        r.hell = Math.min(1, Math.max(0, r.P / r.nenn.p));
        r.zustand = r.P < 0.01 * r.nenn.p ? 'aus' : r.P > 1.44 * r.nenn.p ? 'ueberlast' : 'an';
        if (r.zustand === 'ueberlast') meld('warnung', 'Lampe ' + b.name + ' bekommt ' + F(Math.abs(u), 'V') + ', ausgelegt ist sie für ' + F(r.nenn.u, 'V') + '. Sie würde durchbrennen.', [b.id], 'lampe-ueberlast');
      }
      if ((istQuelle(b.typ) || istGatter(b.typ)) && Math.abs(r.I) > K.I_FLIESST) irgendwoStrom = true;
    });
    if (laeuft && !stabil) meld('warnung', 'Die Logikgatter schalten ständig um: Ein Ausgang wirkt auf seinen eigenen Eingang zurück (z. B. NICHT-Gatter im Kreis).', gatter.map(function (b) { return b.id; }), 'gatter-schwingt');

    // Messgeräte
    doc.bauteile.forEach(function (b) { if (b.typ === 'messgeraet') erg.messgeraete[b.id] = messe(doc, b, n, V, U, netze, verbunden, laeuft, istUngueltig, kurz, k); });

    // Allgemeine Hinweise
    if (!doc.bauteile.length) meld('hinweis', 'Ziehe Bauteile aus der Leiste auf die Arbeitsfläche oder lade die Beispielschaltung.');
    else if (!laeuft) meld('hinweis', 'Die Simulation ist gestoppt. Starte sie mit „▶ Start“.');
    else if (!quellen.length && !gatter.length) meld('hinweis', 'Ohne Spannungsquelle fließt kein Strom.');
    else if (erg.status === 'ok' && !irgendwoStrom) {
      meld('hinweis', quellen.length && !gatter.length && quellen.every(function (q) { return q.werte.spannung === 0; })
        ? 'Die Spannungsquelle steht auf 0 V.'
        : 'Es fließt kein Strom: Der Stromkreis ist nicht geschlossen (offener Schalter, fehlender Draht, sperrende Diode oder sperrender Transistor).', [], 'kein-strom');
    }
    if (laeuft && erg.status === 'ok' && irgendwoStrom) meld('ok', 'Der Stromkreis ist geschlossen, es fließt Strom.', [], 'strom');
    return erg;
  }

  // ---------------------------------------------------------------- Wechselspannung: eine Periode abtasten

  /** Laufende Wechselspannungsquellen (mit Spannung > 0). */
  function wechselquellen(doc) { return doc.bauteile.filter(function (b) { return b.typ === 'wechsel' && b.werte.spannung > 0; }); }

  /**
   * Tastet eine Periode (der langsamsten Wechselspannung) ab und berechnet Effektiv- und Mittelwerte.
   * Gibt null zurück, wenn keine Wechselspannung läuft.
   */
  function zeitverlauf(doc, laeuft, opt) {
    var ac = laeuft ? wechselquellen(doc) : [];
    if (!ac.length) return null;
    opt = opt || {};
    var fmin = Math.min.apply(null, ac.map(function (b) { return b.werte.frequenz; }));
    var fmax = Math.max.apply(null, ac.map(function (b) { return b.werte.frequenz; }));
    var T = 1 / fmin, N = K.PROBEN, gz = opt.gatter;
    var sb = {}, sd = {}, sm = {}, meldungen = {}, reihenfolge = [], status = 'ok', strom = false;
    var RANG = { ok: 0, kurzschluss: 1, fehler: 2 };
    for (var s = 0; s < 2 * N; s++) {
      var t = (s + 0.5) * T / N;
      var e = simuliere(doc, true, { t: t, gatter: gz });
      gz = e.gatter;
      if (s < N) continue; // erste Periode: Gatter einschwingen lassen
      if (RANG[e.status] > RANG[status]) status = e.status;
      e.meldungen.forEach(function (m) {
        if (m.code === 'strom') strom = true;
        if (m.code === 'kein-strom' || m.code === 'strom' || m.code === 'lampe-ueberlast') return;
        if (!meldungen[m.text]) { meldungen[m.text] = m; reihenfolge.push(m.text); }
      });
      Object.keys(e.bauteile).forEach(function (id) {
        var r = e.bauteile[id], a = sb[id] || (sb[id] = { u: 0, u2: 0, i: 0, i2: 0, p: 0 });
        a.u += r.U || 0; a.u2 += (r.U || 0) * (r.U || 0); a.i += r.I || 0; a.i2 += (r.I || 0) * (r.I || 0); a.p += r.P || 0;
      });
      Object.keys(e.draehte).forEach(function (id) {
        var I = e.draehte[id].I || 0, a = sd[id] || (sd[id] = { i: 0, i2: 0 });
        a.i += I; a.i2 += I * I;
      });
      Object.keys(e.messgeraete).forEach(function (id) {
        var m = e.messgeraete[id], a = sm[id] || (sm[id] = { w: 0, w2: 0, n: 0, fehler: '', m: m });
        if (m.fehler && !a.fehler) a.fehler = m.fehler;
        if (typeof m.wert === 'number' && isFinite(m.wert)) { a.w += m.wert; a.w2 += m.wert * m.wert; a.n++; }
      });
    }
    var erg = { f: fmax, fmin: fmin, T: T, schnell: fmax >= K.AC_SCHNELL, status: status, bauteile: {}, draehte: {}, messgeraete: {}, gatter: gz, meldungen: [] };
    var F = SL.fmt;
    doc.bauteile.forEach(function (b) {
      var a = sb[b.id]; if (!a) return;
      var r = { Umittel: a.u / N, Ueff: Math.sqrt(a.u2 / N), Imittel: a.i / N, Ieff: Math.sqrt(a.i2 / N), Pmittel: a.p / N };
      if (b.typ === 'lampe') {
        var l = SL.LAMPEN[b.werte.typ];
        r.hell = Math.min(1, Math.max(0, r.Pmittel / l.p));
        r.zustand = r.Pmittel < 0.01 * l.p ? 'aus' : r.Pmittel > 1.44 * l.p ? 'ueberlast' : 'an';
        if (r.zustand === 'ueberlast') { var t = 'Lampe ' + b.name + ' bekommt im Mittel zu viel Leistung (' + F(r.Pmittel, 'W') + ', ausgelegt für ' + F(l.p, 'W') + '). Sie würde durchbrennen.'; meldungen[t] = { art: 'warnung', text: t, ids: [b.id], code: 'lampe-ueberlast' }; reihenfolge.push(t); }
      }
      erg.bauteile[b.id] = r;
    });
    Object.keys(sd).forEach(function (id) { erg.draehte[id] = { Imittel: sd[id].i / N, Ieff: Math.sqrt(sd[id].i2 / N) }; });
    Object.keys(sm).forEach(function (id) {
      var a = sm[id], m = a.m, x = { modus: m.modus, wert: null, anzeige: m.anzeige, fehler: a.fehler, warnung: m.warnung, hinweis: m.hinweis, effektiv: false };
      if (!a.fehler && (m.modus === 'V' || m.modus === 'A') && a.n) {
        x.wert = Math.sqrt(a.w2 / a.n); x.mittel = a.w / a.n; x.effektiv = true;
        x.anzeige = F(x.wert, m.modus) + '~';
        x.hinweis = 'Bei Wechselspannung zeigt das Messgerät den Effektivwert (~). Mittelwert: ' + F(x.mittel, m.modus) + '.';
      } else if (m.modus === 'Ohm') { x.wert = m.wert; }
      erg.messgeraete[id] = x;
    });
    erg.meldungen = reihenfolge.filter(function (t, i, l) { return l.indexOf(t) === i; }).map(function (t) { return meldungen[t]; });
    if (status === 'ok') erg.meldungen.push(strom
      ? { art: 'ok', text: 'Wechselstrom: Die Richtung des Stroms wechselt ' + String(Math.round(2 * fmax * 10) / 10).replace('.', ',') + '-mal pro Sekunde' + (ac.length > 1 ? ' (schnellste Quelle).' : '.'), ids: [], code: 'strom' }
      : { art: 'hinweis', text: 'Es fließt kein Strom: Der Stromkreis ist nicht geschlossen.', ids: [], code: 'kein-strom' });
    return erg;
  }

  /**
   * Ergebnis für die Anzeige: Momentanwerte (erg) kombiniert mit dem Zeitverlauf (stat).
   * Bei schneller Wechselspannung (ab 5 Hz) zeigen Lampen die mittlere Helligkeit und Drähte den mittleren Strom.
   */
  function kombiniere(erg, stat) {
    if (!stat) return erg;
    var out = {}; for (var k2 in erg) out[k2] = erg[k2];
    out.wechsel = { f: stat.f, schnell: stat.schnell };
    out.status = stat.status;
    out.meldungen = stat.meldungen;
    out.bauteile = {}; out.draehte = {}; out.messgeraete = {};
    Object.keys(erg.bauteile).forEach(function (id) {
      var r = {}, e = stat.bauteile[id];
      for (var x in erg.bauteile[id]) r[x] = erg.bauteile[id][x];
      r.eff = e || null;
      if (e && e.hell != null) {
        if (stat.schnell) r.hell = e.hell;
        r.zustand = e.zustand === 'ueberlast' ? 'ueberlast' : (stat.schnell ? e.zustand : (r.hell >= 0.01 ? 'an' : 'aus'));
      }
      out.bauteile[id] = r;
    });
    Object.keys(erg.draehte).forEach(function (id) {
      var r = {}, e = stat.draehte[id];
      for (var x in erg.draehte[id]) r[x] = erg.draehte[id][x];
      if (stat.schnell && e) { r.I = Math.abs(e.Imittel) > 0.05 * e.Ieff ? e.Imittel : 0; r.wechselnd = e.Ieff > K.I_FLIESST && !r.I; }
      out.draehte[id] = r;
    });
    Object.keys(erg.messgeraete).forEach(function (id) {
      var m = stat.messgeraete[id] || erg.messgeraete[id], r = {};
      for (var x in m) r[x] = m[x];
      r.momentan = erg.messgeraete[id].wert;
      out.messgeraete[id] = r;
    });
    return out;
  }

  /** Multimeter auswerten: Messwert oder verständlicher Fehler. */
  function messe(doc, b, n, V, U, netze, verbunden, laeuft, istUngueltig, kurz, k) {
    var M = SL.modell, F = SL.fmt, modus = b.werte.modus;
    var m = { modus: modus, wert: null, anzeige: '', fehler: '', warnung: '', hinweis: '' };
    var ic = k(b.id, 'com'), iv = k(b.id, 'v');
    var fehlt = [];
    if (!verbunden[b.id + ':v']) fehlt.push('rote Messleitung (V/Ω/A)');
    if (!verbunden[b.id + ':com']) fehlt.push('schwarze Messleitung (COM)');
    if (fehlt.length) { m.fehler = 'Schließe die ' + fehlt.join(' und die ') + ' an.'; m.anzeige = '- - -'; return m; }

    if (modus === 'Ohm') {
      if (laeuft) {
        var unterSpannung = n.el.some(function (e) { return (e.art === 'V' || e.quelle) && (n.uf.find(e.i) === n.uf.find(ic) || n.uf.find(e.i) === n.uf.find(iv)); });
        if (unterSpannung) { m.fehler = 'Widerstand misst man nur ohne Spannung. Stoppe die Simulation oder trenne die Spannungsquelle.'; m.anzeige = 'Err'; return m; }
      }
      var no = netz(doc, { quellen: false, ohmmeter: b.id });
      var l = loese(no);
      if (!l.ok) { m.fehler = 'Der Widerstand lässt sich hier nicht bestimmen.'; m.anzeige = 'Err'; return m; }
      var u = l.V[no.knoten[b.id + ':v']] - l.V[no.knoten[b.id + ':com']];
      var rest = K.I_TEST - u / K.R_OHM_INNEN;
      var R = rest > 0 ? u / rest : Infinity;
      if (!(R < K.R_OL)) { m.wert = Infinity; m.anzeige = 'OL'; m.hinweis = 'OL: Der Widerstand ist zu groß zum Messen – zwischen den Messspitzen gibt es keinen leitenden Weg.'; return m; }
      m.wert = Math.max(0, R); m.anzeige = F(m.wert, 'Ω');
      if (doc.bauteile.some(function (x) { return x.typ === 'diode'; })) m.hinweis = 'Mit einer Diode im Messweg hängt der Wert von der Messrichtung ab.';
      return m;
    }

    if (!laeuft) { m.anzeige = '- - -'; m.hinweis = 'Starte die Simulation, um ' + (modus === 'V' ? 'Spannung' : 'Stromstärke') + ' zu messen.'; return m; }

    if (istUngueltig(ic)) {
      var imKurzschluss = kurz[b.id];
      m.fehler = modus === 'A' && imKurzschluss
        ? 'Kurzschluss! Das Strommessgerät hat fast keinen Widerstand. Schalte es in Reihe zum Bauteil, nicht parallel.'
        : 'Kurzschluss im Stromkreis – keine sinnvolle Messung möglich.';
      m.anzeige = 'Err';
      return m;
    }

    if (modus === 'V') {
      m.wert = U(iv, ic) || 0;
      if (Math.abs(m.wert) < 5e-6) m.wert = 0;
      m.anzeige = F(m.wert, 'V');
      // In Reihe? Eine Messleitung führt allein zu einem Bauteil, dessen anderer Anschluss weiter verbunden ist.
      [ic, iv].forEach(function (t) {
        var andere = netze.andere(t);
        if (m.warnung || andere.length !== 1) return;
        var x = n.liste[andere[0]], xb = M.finde(doc, x.b);
        if (xb.id === b.id || istQuelle(xb.typ) || xb.typ === 'messgeraet' || istGatter(xb.typ) || xb.typ === 'transistor') return;
        var zweiter = Object.keys(SL.TYPEN[xb.typ].anschluesse).filter(function (a) { return a !== x.a; })[0];
        if (netze.groesse(k(xb.id, zweiter)) > 1) m.warnung = 'Das Spannungsmessgerät liegt in Reihe mit ' + xb.name + '. Es lässt fast keinen Strom durch. Spannung misst man parallel zum Bauteil.';
      });
    } else {
      m.wert = (V[iv] - V[ic]) / K.R_LEITUNG;
      if (Math.abs(m.wert) < 1e-9) m.wert = 0;
      m.anzeige = F(m.wert, 'A');
      if (netze.groesse(ic) >= 3 && netze.groesse(iv) >= 3) m.warnung = 'Das Strommessgerät liegt parallel zu anderen Bauteilen und überbrückt sie. Stromstärke misst man in Reihe.';
    }
    return m;
  }

  SL.K = K;
  SL.sim = { simuliere: simuliere, zeitverlauf: zeitverlauf, kombiniere: kombiniere, wechselquellen: wechselquellen, gauss: gauss, diodeStrom: diodeStrom, transistorStroeme: transistorStroeme, netz: netz, loese: loese };
})(typeof window !== 'undefined' ? window : globalThis);
