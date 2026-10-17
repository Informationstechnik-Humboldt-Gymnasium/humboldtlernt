// Atom- & Chemielabor · Molecule Builder: räumliche Anordnung für die 3D-Ansicht (kein DOM, keine eigenen Messwerte)
//
// berechne(m, optionen) → { atome: [{ id, el, p: [x, y, z] }], bindungen: [{ a, b, ordnung, normale }],
//                           extras: [{ atom, art: 'paar' | 'offen', richtung }], radius }
//
// MODELL, nicht maßstäblich:
// - Richtungen nach dem Elektronenpaarabstoßungsmodell (EPA/VSEPR): Bindungspartner (Mehrfachbindungen zählen einfach),
//   freie Elektronenpaare und noch offene Bindungsmöglichkeiten verteilen sich so weit wie möglich voneinander
//   (2 linear, 3 trigonal-planar, 4 tetraedrisch, 5 trigonal-bipyramidal, 6 oktaedrisch).
// - Hat das Datensatz-Molekül einen gemessenen Bindungswinkel (daten-stoffe.js, NIST CCCBDB), wird er am Zentralatom
//   verwendet (optionen.winkel = { atomId: Grad }). Sonst gelten die idealen Modellwinkel – es wird nichts geschätzt.
// - Bindungslängen sind schematisch: 1 zwischen schweren Atomen, 0,8 zu Wasserstoff. Echte Längen hinterlegt das Labor nicht.
// - Ketten werden gestaffelt und zickzackförmig aufgebaut, Doppelbindungen eben. Ringe werden mit einer einfachen
//   Ausgleichsrechnung (Abstände und Winkel) angenähert.
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var B = CL.daten.BAUKASTEN, M = CL.molekuel;
  var L_SCHWER = 1, L_H = 0.8, TETRAEDER = Math.acos(-1 / 3), S3 = Math.sqrt(3) / 2;

  // ------------------------------------------------------------ Vektoren
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [1, 0, 0]; }
  /** Summe k1·a + k2·b + k3·c (fehlende Teile weglassen). */
  function kombi(a, k1, b, k2, c, k3) { var r = mul(a, k1); if (b) r = add(r, mul(b, k2)); if (c) r = add(r, mul(c, k3)); return r; }
  /** Anteil von v senkrecht zu u (u Einheitsvektor). */
  function senkrecht(v, u) { return sub(v, mul(u, dot(v, u))); }
  /** Irgendein Einheitsvektor senkrecht zu u. */
  function lot(u) { return norm(senkrecht(Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u)); }

  // ------------------------------------------------------------ Elektronenpaar-Bereiche eines Atoms
  /**
   * Bindungspartner, freie Elektronenpaare und offene Bindungsmöglichkeiten.
   * Freie Paare: Außenelektronen, die nicht für Bindungen gebraucht werden (bei erweitertem Oktett von S/P entsprechend weniger).
   */
  function bereiche(m, id) {
    var a = M.atomVon(m, id), k = B[a.el], nb = M.nachbarn(m, id), summe = M.bindungsSumme(m, id);
    var paare = Math.floor(Math.max(0, k.valenz - Math.max(summe, k.bindigkeit)) / 2);
    var offen = Math.max(0, k.bindigkeit - summe);
    return { nachbarn: nb, paare: paare, offen: offen, n: nb.length + paare + offen };
  }

  /** Ideale Winkel zwischen zwei Bindungen bei n Bereichen (für die Ausgleichsrechnung bei Ringen). */
  function idealWinkel(n) { return n <= 2 ? Math.PI : n === 3 ? 2 * Math.PI / 3 : TETRAEDER; }

  /**
   * n Richtungen. Die erste ist u (zum Elternatom), r legt die Drehung um u fest (Einheitsvektor senkrecht zu u).
   * Reihenfolge: zuerst die Plätze für Bindungen, die letzten Plätze bekommen freie Paare
   * (bei 5 Bereichen liegen die hinteren Plätze äquatorial – dort sitzen freie Paare im EPA-Modell).
   */
  function plaetze(n, u, r) {
    var s = cross(u, r);
    if (n <= 1) return [u];
    if (n === 2) return [u, mul(u, -1)];
    if (n === 3) return [u, kombi(u, -0.5, r, -S3), kombi(u, -0.5, r, S3)];   // erstes Kind auf der Gegenseite von r (Zickzack)
    if (n === 4) {
      var c = -1 / 3, q = Math.sqrt(8) / 3;
      return [u].concat([180, 300, 60].map(function (g) { var w = g * Math.PI / 180; return kombi(u, c, r, q * Math.cos(w), s, q * Math.sin(w)); }));   // gestaffelt
    }
    if (n === 5) return [u, mul(u, -1), r, kombi(r, -0.5, s, S3), kombi(r, -0.5, s, -S3)];
    if (n === 6) return [u, mul(u, -1), r, mul(r, -1), s, mul(s, -1)];
    return kugelPunkte(n, u, r);
  }

  /** Mehr als 6 Bereiche (nur bei Regelverletzungen): gleichmäßig auf der Kugel, erster Punkt = u. */
  function kugelPunkte(n, u, r) {
    var s = cross(u, r), out = [u], gold = Math.PI * (3 - Math.sqrt(5));
    for (var i = 1; i < n; i++) {
      var z = 1 - 2 * i / (n - 1 + 1e-9) , rad = Math.sqrt(Math.max(0, 1 - z * z)), w = gold * i;
      out.push(norm(kombi(u, z, r, rad * Math.cos(w), s, rad * Math.sin(w))));
    }
    return out;
  }

  /**
   * Plätze am Zentralatom mit gemessenem Winkel θ (in Grad), nur für die Fälle mit eindeutiger Symmetrie:
   * 2 Partner (gewinkelt, z. B. H₂O) und 3 Partner (Pyramide, z. B. NH₃). Sonst null → ideale Plätze.
   */
  function plaetzeGemessen(partner, n, grad, u, r) {
    var th = grad * Math.PI / 180, s = cross(u, r);
    if (partner === 2 && (n === 3 || n === 4) && grad > 0 && grad < 180) {
      var bindungen = [kombi(u, -Math.cos(th / 2), r, -Math.sin(th / 2)), kombi(u, -Math.cos(th / 2), r, Math.sin(th / 2))];
      if (n === 3) return bindungen.concat([u]);
      var h = TETRAEDER / 2;
      return bindungen.concat([kombi(u, Math.cos(h), s, Math.sin(h)), kombi(u, Math.cos(h), s, -Math.sin(h))]);
    }
    if (partner === 3 && n === 4) {
      var c2 = (Math.cos(th) + 0.5) / 1.5;
      if (c2 < 0 || c2 > 1) return null;
      var cb = Math.sqrt(c2), sb = Math.sqrt(1 - c2);
      return [0, 120, 240].map(function (g) { var w = g * Math.PI / 180; return kombi(u, -cb, r, sb * Math.cos(w), s, sb * Math.sin(w)); }).concat([u]);
    }
    return null;
  }

  function laenge(m, a, b) { return M.atomVon(m, a).el === 'H' || M.atomVon(m, b).el === 'H' ? L_H : L_SCHWER; }

  // ------------------------------------------------------------ Ein Molekül
  function teil(m, ids, winkel) {
    var pos = {}, eltern = {}, extras = [];
    var info = {};
    ids.forEach(function (id) { info[id] = bereiche(m, id); });
    // Startatom: hinterlegter Messwinkel, sonst das Atom mit den meisten Partnern (schwere Atome vor H, dann kleinste ID)
    var start = ids.filter(function (id) { return winkel && winkel[id]; })[0];
    if (start === undefined) start = ids.slice().sort(function (p, q) {
      return info[q].nachbarn.length - info[p].nachbarn.length || (M.atomVon(m, p).el === 'H') - (M.atomVon(m, q).el === 'H') || p - q;
    })[0];
    var ring = m.bindungen.filter(function (x) { return ids.indexOf(x.a) >= 0; }).length >= ids.length;

    pos[start] = [0, 0, 0]; eltern[start] = null;
    var schlange = [start];
    while (schlange.length) {
      var id = schlange.shift(), d = info[id], p = eltern[id], u, r, sl = null;
      if (p !== null) {
        u = norm(sub(pos[p], pos[id]));
        var q = info[p].nachbarn.map(function (x) { return x.id; }).filter(function (x) { return x !== id && pos[x]; })[0];
        r = q !== undefined ? senkrecht(sub(pos[q], pos[p]), u) : null;
        r = r && len(r) > 1e-6 ? norm(r) : lot(u);
      } else if (d.nachbarn.length <= 1 || d.n === 2) { u = [1, 0, 0]; r = [0, 1, 0]; }
      else { u = [0, 1, 0]; r = [1, 0, 0]; }
      if (p === null && winkel && winkel[id]) sl = plaetzeGemessen(d.nachbarn.length, d.n, winkel[id], u, r);
      var gemessen = !!sl;
      if (!sl) sl = plaetze(d.n, u, r);
      var frei = sl.slice();
      if (p !== null) frei.shift();   // Platz 0 gehört der Bindung zum Elternatom
      d.nachbarn.forEach(function (nb) {
        if (nb.id === p) return;
        if (pos[nb.id]) { if (frei.length > d.paare + d.offen) frei.shift(); return; }   // Ringschluss: Platz ist belegt
        var dir = frei.shift() || lot(u);
        pos[nb.id] = add(pos[id], mul(dir, laenge(m, id, nb.id)));
        eltern[nb.id] = id;
        schlange.push(nb.id);
      });
      if (!ring) {
        for (var i = 0; i < d.offen; i++) extras.push({ atom: id, art: 'offen', richtung: frei.shift() });
        for (var j = 0; j < d.paare; j++) extras.push({ atom: id, art: 'paar', richtung: frei.pop() });
      }
      d.gemessen = gemessen;
    }
    if (ring) { ausgleichen(m, ids, pos, info); extras = extrasNeu(m, ids, pos, info); }
    return { pos: pos, extras: extras, gemessen: ids.filter(function (id) { return info[id].gemessen; }) };
  }

  /** Ringe: Abstände (Bindungen und 1-3-Abstände über die Modellwinkel) schrittweise angleichen, Atome nicht überlappen lassen. */
  function ausgleichen(m, ids, pos, info) {
    var ziele = [];
    m.bindungen.forEach(function (x) { if (ids.indexOf(x.a) >= 0) ziele.push([x.a, x.b, laenge(m, x.a, x.b), 1]); });
    ids.forEach(function (c) {
      var nb = info[c].nachbarn.map(function (x) { return x.id; }), th = idealWinkel(info[c].n);
      for (var i = 0; i < nb.length; i++) for (var j = i + 1; j < nb.length; j++) {
        if (M.bindungZwischen(m, nb[i], nb[j])) continue;   // Dreiring: der Winkel ergibt sich aus den Bindungen
        var la = laenge(m, c, nb[i]), lb = laenge(m, c, nb[j]);
        ziele.push([nb[i], nb[j], Math.sqrt(la * la + lb * lb - 2 * la * lb * Math.cos(th)), 0.4]);
      }
    });
    var paar = {};
    ziele.forEach(function (z) { paar[Math.min(z[0], z[1]) + '-' + Math.max(z[0], z[1])] = true; });
    // Start: die 2D-Zeichnung der Schülerin / des Schülers (Ringe sind dort meist schon sinnvoll angeordnet),
    // auf die Bindungslänge skaliert und leicht aus der Ebene gehoben, damit sich gewellte Ringe bilden können
    var summe2d = 0, n2d = 0;
    m.bindungen.forEach(function (x) {
      if (ids.indexOf(x.a) < 0) return;
      var a = M.atomVon(m, x.a), b = M.atomVon(m, x.b);
      summe2d += Math.hypot(a.x - b.x, a.y - b.y); n2d++;
    });
    var f = n2d && summe2d > 1e-6 ? n2d / summe2d : 1 / 60;
    ids.forEach(function (id, k) {
      var a = M.atomVon(m, id);
      pos[id] = [a.x * f + 0.001 * Math.sin(k * 1.7), -a.y * f + 0.001 * Math.cos(k * 2.3), 0.08 * Math.sin(k * 2.1 + 0.5)];
    });
    for (var schritt = 0; schritt < 1500; schritt++) {
      ziele.forEach(function (z) { zieheAuf(pos, z[0], z[1], z[2], z[3] * 0.5); });
      for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
        if (paar[Math.min(ids[i], ids[j]) + '-' + Math.max(ids[i], ids[j])]) continue;
        var dd = len(sub(pos[ids[i]], pos[ids[j]]));
        if (dd < 1.6) zieheAuf(pos, ids[i], ids[j], 1.6, 0.15);
      }
    }
  }
  function zieheAuf(pos, a, b, soll, k) {
    var d = sub(pos[b], pos[a]), l = len(d) || 1e-6, f = (l - soll) / l * k * 0.5;
    pos[a] = add(pos[a], mul(d, f)); pos[b] = sub(pos[b], mul(d, f));
  }

  /** Freie Paare und offene Bindungsmöglichkeiten nach dem Ausgleich: Plätze möglichst weit weg von den Bindungen. */
  function extrasNeu(m, ids, pos, info) {
    var out = [];
    ids.forEach(function (id) {
      var d = info[id], e = d.paare + d.offen;
      if (!e) return;
      var dirs = d.nachbarn.map(function (x) { return norm(sub(pos[x.id], pos[id])); });
      var kandidaten;
      if (!dirs.length) kandidaten = plaetze(e, [1, 0, 0], [0, 1, 0]);
      else {
        var r = dirs[1] ? senkrecht(dirs[1], dirs[0]) : null;
        kandidaten = plaetze(Math.max(d.n, dirs.length + e), dirs[0], r && len(r) > 1e-6 ? norm(r) : lot(dirs[0]));
        // Gegenrichtung der Bindungssumme als weiterer Kandidat (bei Ringatomen oft der beste Platz)
        var summe = dirs.reduce(add, [0, 0, 0]);
        if (len(summe) > 1e-6) kandidaten.push(norm(mul(summe, -1)));
      }
      var gewaehlt = [];
      for (var k = 0; k < e; k++) {
        var best = null, bestWert = Infinity;
        kandidaten.forEach(function (c) {
          if (gewaehlt.indexOf(c) >= 0) return;
          var nah = dirs.concat(gewaehlt).reduce(function (mx, v) { return Math.max(mx, dot(c, v)); }, -1);
          if (nah < bestWert - 1e-9) { bestWert = nah; best = c; }
        });
        gewaehlt.push(best);
      }
      gewaehlt.forEach(function (c, k) { out.push({ atom: id, art: k < d.offen ? 'offen' : 'paar', richtung: c }); });
    });
    return out;
  }

  // ------------------------------------------------------------ Ganze Arbeitsfläche
  /**
   * Alle Moleküle der Fläche räumlich anordnen, nebeneinander entlang x (in der Reihenfolge der 2D-Zeichnung von links).
   * optionen.winkel: { atomId: gemessener Winkel in Grad } für Zentralatome bekannter Moleküle.
   */
  function berechne(m, optionen) {
    var winkel = (optionen && optionen.winkel) || null;
    var teile = M.teile(m).map(function (ids) {
      var t = teil(m, ids, winkel);
      var mitte = ids.reduce(function (s, id) { return add(s, t.pos[id]); }, [0, 0, 0]);
      mitte = mul(mitte, 1 / ids.length);
      var rad = 0;
      ids.forEach(function (id) { t.pos[id] = sub(t.pos[id], mitte); rad = Math.max(rad, len(t.pos[id])); });
      var x2d = ids.reduce(function (s, id) { return s + M.atomVon(m, id).x; }, 0) / ids.length;
      return { ids: ids, t: t, radius: rad + 0.6, x2d: x2d };
    }).sort(function (p, q) { return p.x2d - q.x2d; });
    var breite = teile.reduce(function (s, x) { return s + 2 * x.radius; }, 0) + Math.max(0, teile.length - 1) * 0.6;
    var x = -breite / 2, atome = [], extras = [], gemessen = [];
    teile.forEach(function (tl) {
      var dx = x + tl.radius;
      tl.ids.forEach(function (id) { atome.push({ id: id, el: M.atomVon(m, id).el, p: add(tl.t.pos[id], [dx, 0, 0]) }); });
      extras = extras.concat(tl.t.extras);
      gemessen = gemessen.concat(tl.t.gemessen);
      x += 2 * tl.radius + 0.6;
    });
    var P = {};
    atome.forEach(function (a) { P[a.id] = a.p; });
    var bindungen = m.bindungen.map(function (b) {
      var achse = norm(sub(P[b.b], P[b.a])), normale = null;
      if (b.ordnung > 1) {
        var nachbar = M.nachbarn(m, b.a).concat(M.nachbarn(m, b.b)).map(function (x) { return x.id; }).filter(function (id) { return id !== b.a && id !== b.b; })[0];
        if (nachbar !== undefined) { var v = senkrecht(sub(P[nachbar], P[b.a]), achse); if (len(v) > 1e-6) normale = norm(v); }
        if (!normale) normale = lot(achse);
      }
      return { a: b.a, b: b.b, ordnung: b.ordnung, normale: normale };
    });
    var radius = atome.reduce(function (r, a) { return Math.max(r, len(a.p)); }, 0) + 0.6;
    return { atome: atome, bindungen: bindungen, extras: extras, radius: radius, gemessen: gemessen };
  }

  /** Winkel a–Zentrum–b in Grad aus den Positionen (für Anzeige und Tests). */
  function winkelAus(p, a, b) {
    var u = norm(sub(a, p)), v = norm(sub(b, p));
    return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180 / Math.PI;
  }

  /** Gemessene Winkel aus M.analyse(m): { atomId: Grad } – nur für erkannte Moleküle mit hinterlegtem Messwert. */
  function messwinkel(analyse) {
    var out = {};
    analyse.forEach(function (t) { t.geometrie.forEach(function (g) { if (g.gemessen) out[g.atom] = g.gemessen; }); });
    return out;
  }

  CL.raum = { berechne: berechne, bereiche: bereiche, winkelAus: winkelAus, messwinkel: messwinkel, L_SCHWER: L_SCHWER, L_H: L_H };
})(typeof window !== 'undefined' ? window : globalThis);
