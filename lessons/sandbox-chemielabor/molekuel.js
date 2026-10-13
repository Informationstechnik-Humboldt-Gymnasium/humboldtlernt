// Atom- & Chemielabor · Molekülbaukasten: Modell, Prüfung der Bindigkeit, Erkennung, Geometrie (kein DOM)
//
// Ein Modell: { atome: [{ id, el, x, y }], bindungen: [{ a, b, ordnung }] }   (a, b = Atom-IDs, ordnung 1–3)
//
// Bewertung je zusammenhängendem Molekül (status):
//   'zeichnung'  – nur eine Strukturzeichnung: Bindigkeit überschritten, freie Bindungen oder unmögliche Bindungsordnung
//   'plausibel'  – jedes Atom hat genau seine übliche Bindigkeit (Oktettregel / Duettregel bei H). Ob es den Stoff
//                  wirklich gibt, sagt das NICHT.
//   'bekannt'    – plausibel UND im Datensatz der experimentell nachgewiesenen Moleküle (daten-stoffe.js) enthalten.
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var D = CL.daten, C = CL.chemie;
  var B = D.BAUKASTEN;

  function neu() { return { atome: [], bindungen: [], naechsteId: 1 }; }

  function atomHinzu(m, el, x, y) {
    if (!B[el]) return null;
    var a = { id: m.naechsteId++, el: el, x: x || 0, y: y || 0 };
    m.atome.push(a);
    return a;
  }

  function atomVon(m, id) { return m.atome.filter(function (a) { return a.id === id; })[0] || null; }
  function bindungZwischen(m, a, b) {
    return m.bindungen.filter(function (x) { return (x.a === a && x.b === b) || (x.a === b && x.b === a); })[0] || null;
  }
  function maxOrdnung(m, a, b) { return Math.min(B[atomVon(m, a).el].maxOrdnung, B[atomVon(m, b).el].maxOrdnung); }

  /**
   * Bindung zwischen zwei Atomen anlegen oder weiterschalten: keine → Einfach → Doppel → Dreifach → keine.
   * Bindungsordnungen, die ein beteiligtes Element nie eingeht (z. B. H=H, O≡O), werden übersprungen.
   * Liefert die neue Ordnung (0 = getrennt) oder null bei ungültigem Aufruf.
   */
  function verbinde(m, a, b) {
    if (a === b || !atomVon(m, a) || !atomVon(m, b)) return null;
    var x = bindungZwischen(m, a, b), max = maxOrdnung(m, a, b);
    if (!x) { m.bindungen.push({ a: a, b: b, ordnung: 1 }); return 1; }
    if (x.ordnung < max) { x.ordnung++; return x.ordnung; }
    m.bindungen.splice(m.bindungen.indexOf(x), 1);
    return 0;
  }

  function trenne(m, a, b) {
    var x = bindungZwischen(m, a, b);
    if (x) m.bindungen.splice(m.bindungen.indexOf(x), 1);
    return !!x;
  }

  function atomEntfernen(m, id) {
    m.atome = m.atome.filter(function (a) { return a.id !== id; });
    m.bindungen = m.bindungen.filter(function (x) { return x.a !== id && x.b !== id; });
  }

  function nachbarn(m, id) {
    return m.bindungen.filter(function (x) { return x.a === id || x.b === id; })
      .map(function (x) { return { id: x.a === id ? x.b : x.a, ordnung: x.ordnung }; });
  }

  function bindungsSumme(m, id) { return nachbarn(m, id).reduce(function (s, n) { return s + n.ordnung; }, 0); }

  /** Zusammenhängende Teile (Moleküle) als Listen von Atom-IDs. */
  function teile(m) {
    var gesehen = {}, out = [];
    m.atome.forEach(function (a) {
      if (gesehen[a.id]) return;
      var stapel = [a.id], teil = [];
      gesehen[a.id] = true;
      while (stapel.length) {
        var id = stapel.pop(); teil.push(id);
        nachbarn(m, id).forEach(function (n) { if (!gesehen[n.id]) { gesehen[n.id] = true; stapel.push(n.id); } });
      }
      out.push(teil);
    });
    return out;
  }

  /** Beschreibung eines Atoms mit seinen Nachbarn – Grundlage für den Vergleich mit bekannten Molekülen. */
  function signatur(atome, bindungen) {
    var nb = {};
    atome.forEach(function (a) { nb[a.id] = []; });
    bindungen.forEach(function (x) {
      var ea = atome.filter(function (a) { return a.id === x.a; })[0].el, eb = atome.filter(function (a) { return a.id === x.b; })[0].el;
      nb[x.a].push(eb + x.ordnung); nb[x.b].push(ea + x.ordnung);
    });
    // zwei Runden Verfeinerung (Atom + Nachbarbeschreibung) unterscheiden alle Moleküle des Datensatzes
    var stufe = {};
    atome.forEach(function (a) { stufe[a.id] = a.el + '(' + nb[a.id].sort().join(',') + ')'; });
    var naechste = {};
    atome.forEach(function (a) {
      var um = bindungen.filter(function (x) { return x.a === a.id || x.b === a.id; })
        .map(function (x) { return stufe[x.a === a.id ? x.b : x.a] + x.ordnung; }).sort();
      naechste[a.id] = stufe[a.id] + '[' + um.join(';') + ']';
    });
    return atome.map(function (a) { return naechste[a.id]; }).sort().join('|');
  }

  var BEKANNT = null;
  function bekannteSignaturen() {
    if (BEKANNT) return BEKANNT;
    BEKANNT = {};
    D.MOLEKUELE.forEach(function (mol) {
      var atome = mol.atome.map(function (a, i) { return { id: i, el: a[0] }; });
      var bindungen = mol.bindungen.map(function (b) { return { a: b[0], b: b[1], ordnung: b[2] }; });
      BEKANNT[signatur(atome, bindungen)] = mol;
    });
    return BEKANNT;
  }

  /** Modell für ein Beispielmolekül aus dem Datensatz (zum Laden). */
  function beispiel(id, mx, my) {
    var mol = D.MOLEKUELE.filter(function (x) { return x.id === id; })[0];
    if (!mol) return null;
    var m = neu();
    var ids = mol.atome.map(function (a) { return atomHinzu(m, a[0], (mx || 0) + a[1], (my || 0) + a[2]).id; });
    mol.bindungen.forEach(function (b) { m.bindungen.push({ a: ids[b[0]], b: ids[b[1]], ordnung: b[2] }); });
    return m;
  }

  // Geometrie nach dem Elektronenpaarabstoßungsmodell (EPA/VSEPR). Mehrfachbindungen zählen als ein Bindungspartner.
  var GEOMETRIE = {
    '2-0': { name: 'linear', winkel: 180 },
    '3-0': { name: 'trigonal-planar', winkel: 120 },
    '2-1': { name: 'gewinkelt', winkel: null, hinweis: 'etwas kleiner als 120°' },
    '4-0': { name: 'tetraedrisch', winkel: 109.5 },
    '3-1': { name: 'trigonal-pyramidal', winkel: null, hinweis: 'etwas kleiner als 109,5°' },
    '2-2': { name: 'gewinkelt', winkel: null, hinweis: 'deutlich kleiner als 109,5°' },
  };

  /** Geometrie um ein Zentralatom (nur sinnvoll, wenn alle Bindigkeiten stimmen). */
  function geometrie(m, id) {
    var a = atomVon(m, id), nb = nachbarn(m, id);
    if (!a || nb.length < 2) return null;
    var freiePaare = (B[a.el].valenz - bindungsSumme(m, id)) / 2;
    if (freiePaare < 0 || freiePaare % 1) return null;
    var g = GEOMETRIE[nb.length + '-' + freiePaare];
    return g ? { name: g.name, winkel: g.winkel, hinweis: g.hinweis || '', freiePaare: freiePaare, partner: nb.length } : null;
  }

  /** Bewertet alle Moleküle auf der Arbeitsfläche. */
  function analyse(m) {
    var bekannt = bekannteSignaturen();
    return teile(m).map(function (ids) {
      var atome = m.atome.filter(function (a) { return ids.indexOf(a.id) >= 0; });
      var bindungen = m.bindungen.filter(function (x) { return ids.indexOf(x.a) >= 0; });
      var meldungen = [], anzahl = {}, status = 'plausibel';
      atome.forEach(function (a) {
        anzahl[a.el] = (anzahl[a.el] || 0) + 1;
        var soll = B[a.el].bindigkeit, ist = bindungsSumme(m, a.id), name = C.element(a.el).name;
        if (ist > soll) { status = 'zeichnung'; meldungen.push({ art: 'fehler', atom: a.id, text: name + ' hat ' + ist + ' Bindungen, üblich ' + (soll === 1 ? 'ist nur eine' : 'sind ' + soll) + '. Die Bindigkeit ist überschritten.' }); }
        else if (ist < soll) { status = 'zeichnung'; meldungen.push({ art: 'offen', atom: a.id, text: name + ' hat noch ' + (soll - ist) + ' freie Bindung' + (soll - ist > 1 ? 'en' : '') + '.' }); }
      });
      bindungen.forEach(function (x) {
        if (x.ordnung > maxOrdnung(m, x.a, x.b)) { status = 'zeichnung'; meldungen.push({ art: 'fehler', text: 'Diese Mehrfachbindung ist für die beteiligten Atome nicht möglich.' }); }
      });
      var formel = C.hill(anzahl), mol = null;
      if (status === 'plausibel') {
        mol = bekannt[signatur(atome, bindungen)] || null;
        if (mol) status = 'bekannt';
      }
      var geo = [];
      if (status !== 'zeichnung') atome.forEach(function (a) {
        var g = geometrie(m, a.id);
        if (g) geo.push({ atom: a.id, el: a.el, geometrie: g, gemessen: mol && mol.winkel && zentral(mol, a.el) ? mol.winkel : null });
      });
      return { atome: ids, formel: formel, anzahl: anzahl, status: status, name: mol ? mol.name : null, molekuelId: mol ? mol.id : null, meldungen: meldungen, geometrie: geo };
    });
  }

  // Für hinterlegte Messwinkel: das Zentralatom ist das erste Atom des Datensatz-Moleküls mit mindestens zwei Partnern.
  function zentral(mol, el) {
    for (var i = 0; i < mol.atome.length; i++) {
      var k = mol.bindungen.filter(function (b) { return b[0] === i || b[1] === i; }).length;
      if (k >= 2) return mol.atome[i][0] === el;
    }
    return false;
  }

  CL.molekuel = {
    neu: neu, atomHinzu: atomHinzu, atomVon: atomVon, verbinde: verbinde, trenne: trenne, atomEntfernen: atomEntfernen,
    nachbarn: nachbarn, bindungsSumme: bindungsSumme, teile: teile, analyse: analyse, geometrie: geometrie, beispiel: beispiel,
    bindungZwischen: bindungZwischen,
  };
})(typeof window !== 'undefined' ? window : globalThis);
