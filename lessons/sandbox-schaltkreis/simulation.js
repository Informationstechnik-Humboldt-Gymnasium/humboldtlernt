// Schaltkreis-Labor · Simulationskern
//
// Berechnet eine Schaltung aus modell.js mit der modifizierten Knotenpotenzialanalyse (MNA):
//   - jeder Anschluss ist ein Knoten, Drähte und geschlossene Schalter sind sehr kleine Widerstände (1 mΩ),
//     dadurch gibt es auch für jeden Draht eine Stromstärke (für die Stromfluss-Animation),
//   - Spannungsquellen sind ideale Quellen (eigene Unbekannte: ihre Stromstärke),
//   - die Diode folgt der Shockley-Gleichung und wird mit dem Newton-Verfahren (mit Spannungsbegrenzung) gelöst,
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
  };

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

  function diodeStrom(v) {
    var e = Math.exp(Math.min(v / K.DIODE_NVT, 200));
    return { i: K.DIODE_IS * (e - 1) + K.DIODE_GMIN * v, g: K.DIODE_IS / K.DIODE_NVT * e + K.DIODE_GMIN };
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
   * Elemente der Schaltung. art: R (Widerstand), V (Spannungsquelle), D (Diode), I (Stromquelle des Ohmmeters).
   * opt.quellen: Spannungsquellen einschalten; opt.ohmmeter: id des Multimeters, das gerade Widerstand misst.
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
    el.forEach(function (e) { uf.union(e.i, e.j); });
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
      x = gauss(A, z);
      if (!x) return { ok: false, grund: 'singulaer' };
      if (!dioden.length) { konvergiert = true; break; }
      var fertig = true;
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

  /**
   * Simuliert die Schaltung.
   * laeuft = false: Quellen sind aus, es wird nur die Widerstandsmessung berechnet.
   * Ergebnis: { laeuft, status, bauteile: {id: {U, I, P, …}}, draehte: {id: {I}}, messgeraete: {id: {…}}, kurzschluss: [ids], meldungen: [] }
   */
  function simuliere(doc, laeuft) {
    var M = SL.modell, F = SL.fmt;
    var erg = { laeuft: !!laeuft, status: laeuft ? 'ok' : 'gestoppt', bauteile: {}, draehte: {}, messgeraete: {}, kurzschluss: [], meldungen: [] };
    var meld = function (art, text, ids) { erg.meldungen.push({ art: art, text: text, ids: ids || [] }); };
    var quellen = doc.bauteile.filter(function (b) { return b.typ === 'quelle'; });

    var n = netz(doc, { quellen: !!laeuft });
    var k = function (b, a) { return n.knoten[b + ':' + a]; };
    var verbunden = {};
    doc.draehte.forEach(function (d) { verbunden[d.von.b + ':' + d.von.a] = 1; verbunden[d.nach.b + ':' + d.nach.a] = 1; });
    var netze = drahtNetze(doc, n);

    // Kurzschluss: Plus- und Minuspol einer eingeschalteten Quelle nur über Elemente ohne Widerstand verbunden
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
        meld('fehler', mitAmpere
          ? 'Kurzschluss an ' + b.name + ' über das Strommessgerät! Es hat fast keinen Widerstand. Strom misst man in Reihe zum Bauteil.'
          : 'Kurzschluss an ' + b.name + ': Plus- und Minuspol sind ohne Widerstand verbunden. In Wirklichkeit würde die Quelle überlastet.', ids);
      });
    }

    var lsg = loese(n);
    if (!lsg.ok) {
      erg.status = 'fehler';
      meld('fehler', lsg.grund === 'konvergenz'
        ? 'Diese Schaltung lässt sich nicht stabil berechnen. Prüfe die Dioden und die Verbindungen.'
        : 'Diese Schaltung lässt sich nicht berechnen (z. B. Spannungsquellen direkt parallel mit verschiedenen Spannungen).');
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
        meld('fehler', 'Sehr großer Strom an ' + b.name + ' (' + F(Math.abs(I), 'A') + '). Die Quelle wäre überlastet – fast wie ein Kurzschluss.', [b.id]);
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
    doc.bauteile.forEach(function (b) {
      var w = b.werte, r = { U: null, I: null, P: null, ungueltig: false };
      erg.bauteile[b.id] = r;
      if (b.typ === 'messgeraet') return;
      var p = b.typ === 'quelle' ? M.pluspol(b) : 'a', m = b.typ === 'quelle' ? (p === 'a' ? 'b' : 'a') : b.typ === 'diode' ? 'k' : 'b';
      var i = k(b.id, p), j = k(b.id, m);
      if (b.typ === 'lampe') { var l = SL.LAMPEN[w.typ]; r.R = l.u * l.u / l.p; r.nenn = l; r.hell = 0; r.zustand = 'aus'; }
      if (b.typ === 'widerstand') r.R = w.widerstand;
      if (b.typ === 'diode') r.zustand = 'sperrend';
      if (b.typ === 'schalter') r.zustand = w.geschlossen ? 'geschlossen' : 'offen';
      if (!laeuft) return;
      if (istUngueltig(i)) { r.ungueltig = true; return; }
      var u = U(i, j);
      r.U = u;
      switch (b.typ) {
        case 'quelle': r.I = lsg.Iq[b.id] || 0; break;
        case 'schalter': r.I = w.geschlossen ? u / K.R_LEITUNG : 0; break;
        case 'lampe': r.I = u / r.R; break;
        case 'widerstand': r.I = u / Math.max(w.widerstand, K.R_LEITUNG); break;
        case 'diode': r.I = u == null ? 0 : diodeStrom(u).i; r.zustand = r.I > K.DIODE_LEITEND ? 'leitend' : 'sperrend'; break;
      }
      if (r.I != null && Math.abs(r.I) < 1e-7) r.I = 0; // Leckströme (Diode in Sperrrichtung, Messgerät) nicht anzeigen
      r.P = u == null ? 0 : u * r.I;
      if (b.typ === 'lampe') {
        r.hell = Math.min(1, Math.max(0, r.P / r.nenn.p));
        r.zustand = r.P < 0.01 * r.nenn.p ? 'aus' : r.P > 1.44 * r.nenn.p ? 'ueberlast' : 'an';
        if (r.zustand === 'ueberlast') meld('warnung', 'Lampe ' + b.name + ' bekommt ' + F(Math.abs(u), 'V') + ', ausgelegt ist sie für ' + F(r.nenn.u, 'V') + '. Sie würde durchbrennen.', [b.id]);
      }
      if (b.typ === 'quelle' && Math.abs(r.I) > K.I_FLIESST) irgendwoStrom = true;
    });

    // Messgeräte
    doc.bauteile.forEach(function (b) { if (b.typ === 'messgeraet') erg.messgeraete[b.id] = messe(doc, b, n, V, U, netze, verbunden, laeuft, istUngueltig, kurz, k); });

    // Allgemeine Hinweise
    if (!doc.bauteile.length) meld('hinweis', 'Ziehe Bauteile aus der Leiste auf die Arbeitsfläche oder lade die Beispielschaltung.');
    else if (!laeuft) meld('hinweis', 'Die Simulation ist gestoppt. Starte sie mit „▶ Start“.');
    else if (!quellen.length) meld('hinweis', 'Ohne Spannungsquelle fließt kein Strom.');
    else if (erg.status === 'ok' && !irgendwoStrom) {
      meld('hinweis', quellen.every(function (q) { return q.werte.spannung === 0; })
        ? 'Die Spannungsquelle steht auf 0 V.'
        : 'Es fließt kein Strom: Der Stromkreis ist nicht geschlossen (offener Schalter, fehlender Draht oder sperrende Diode).');
    }
    if (laeuft && erg.status === 'ok' && irgendwoStrom) meld('ok', 'Der Stromkreis ist geschlossen, es fließt Strom.');
    return erg;
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
        var unterSpannung = n.el.some(function (e) { return e.art === 'V' && (n.uf.find(e.i) === n.uf.find(ic) || n.uf.find(e.i) === n.uf.find(iv)); });
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
        if (xb.id === b.id || xb.typ === 'quelle' || xb.typ === 'messgeraet') return;
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
  SL.sim = { simuliere: simuliere, gauss: gauss, diodeStrom: diodeStrom, netz: netz, loese: loese };
})(typeof window !== 'undefined' ? window : globalThis);
