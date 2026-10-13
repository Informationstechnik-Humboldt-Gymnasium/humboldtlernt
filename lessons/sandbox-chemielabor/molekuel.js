// Atom- & Chemielabor · Molecule Builder: Datenmodell, Bearbeitung, Validierung, Erkennung, Geometrie (kein DOM)
//
// Ein Modell (zugleich Speicherformat):
//   { atome: [{ id, el, x, y }], bindungen: [{ a, b, ordnung }], naechsteId }   (a, b = Atom-IDs, ordnung 1–3)
//
// Zwei getrennte Prüfungen:
//   validiere(m)  – formale Konsistenz: eindeutige IDs, bekannte Elemente, Bindungen mit gültigen Endpunkten,
//                   zulässige Bindungsordnungen, keine doppelten Bindungen. Schützt vor kaputten Daten (z. B. Import).
//   analyse(m)    – chemische Bewertung je zusammenhängendem Molekül nach VEREINFACHTEN Valenzregeln:
//     'verletzung'      Strukturelle Regelverletzung: Bindigkeit überschritten oder Bindungsordnung nicht möglich.
//     'unvollstaendig'  Kein Regelverstoß, aber mindestens ein Atom hat noch freie Bindungsmöglichkeiten.
//     'unklar'          Nur S oder P haben mehr Bindungen als üblich, aber nicht mehr als in bekannten Verbindungen mit
//                       erweitertem Oktett. Das einfache Modell kann das nicht abschließend beurteilen.
//     'gueltig'         Gültige Modellstruktur: jedes Atom hat genau seine übliche Bindigkeit. Das heißt NICHT, dass der
//                       Stoff existiert oder stabil ist – nur „bekannt: true“ (Struktur im Datensatz) sagt das.
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var D = CL.daten, C = CL.chemie;
  var B = D.BAUKASTEN;
  var MAX_ATOME = 40;
  var ORDNUNG_NAME = { 1: 'Einfachbindung', 2: 'Doppelbindung', 3: 'Dreifachbindung' };

  function neu() { return { atome: [], bindungen: [], naechsteId: 1 }; }
  function kopie(m) { return JSON.parse(JSON.stringify(m)); }

  function atomHinzu(m, el, x, y) {
    if (!B[el] || m.atome.length >= MAX_ATOME) return null;
    var a = { id: m.naechsteId++, el: el, x: Math.round(x || 0), y: Math.round(y || 0) };
    m.atome.push(a);
    return a;
  }

  function atomVon(m, id) { for (var i = 0; i < m.atome.length; i++) if (m.atome[i].id === id) return m.atome[i]; return null; }
  function bindungZwischen(m, a, b) {
    for (var i = 0; i < m.bindungen.length; i++) { var x = m.bindungen[i]; if ((x.a === a && x.b === b) || (x.a === b && x.b === a)) return x; }
    return null;
  }
  function maxOrdnung(m, a, b) { return Math.min(B[atomVon(m, a).el].maxOrdnung, B[atomVon(m, b).el].maxOrdnung); }
  function name(el) { return C.element(el).name; }

  /**
   * Bindung zwischen zwei Atomen auf eine bestimmte Ordnung setzen (0 = entfernen).
   * Liefert { ok, ordnung, grund }. Eine Ordnung, die eines der Elemente im Modell nie eingeht, wird abgelehnt.
   */
  function setzeBindung(m, a, b, ordnung) {
    if (a === b) return { ok: false, grund: 'Ein Atom kann nicht mit sich selbst verbunden werden.' };
    var x = atomVon(m, a), y = atomVon(m, b);
    if (!x || !y) return { ok: false, grund: 'Mindestens eines der Atome gibt es nicht (mehr).' };
    if ([0, 1, 2, 3].indexOf(ordnung) < 0) return { ok: false, grund: 'Unterstützt werden Einfach-, Doppel- und Dreifachbindungen.' };
    var vorhanden = bindungZwischen(m, a, b);
    if (ordnung === 0) {
      if (!vorhanden) return { ok: false, grund: 'Zwischen diesen Atomen gibt es keine Bindung.' };
      m.bindungen.splice(m.bindungen.indexOf(vorhanden), 1);
      return { ok: true, ordnung: 0 };
    }
    var max = maxOrdnung(m, a, b);
    if (ordnung > max) {
      var begrenzt = B[x.el].maxOrdnung <= B[y.el].maxOrdnung ? x.el : y.el;
      return { ok: false, grund: 'Eine ' + ORDNUNG_NAME[ordnung] + ' ist für ' + name(begrenzt) + ' in diesem Modell nicht vorgesehen' +
        (B[begrenzt].maxOrdnung === 1 ? ' – ' + name(begrenzt) + ' bildet nur Einfachbindungen.' : '.') };
    }
    if (vorhanden) vorhanden.ordnung = ordnung;
    else m.bindungen.push({ a: a, b: b, ordnung: ordnung });
    return { ok: true, ordnung: ordnung };
  }

  /** Bindung weiterschalten: keine → Einfach → Doppel → Dreifach → keine (unmögliche Ordnungen werden übersprungen). */
  function verbinde(m, a, b) {
    if (a === b || !atomVon(m, a) || !atomVon(m, b)) return null;
    var x = bindungZwischen(m, a, b), max = maxOrdnung(m, a, b);
    var ziel = !x ? 1 : x.ordnung < max ? x.ordnung + 1 : 0;
    setzeBindung(m, a, b, ziel);
    return ziel;
  }

  function trenne(m, a, b) { return setzeBindung(m, a, b, 0).ok; }

  function atomEntfernen(m, id) {
    var n = m.atome.length;
    m.atome = m.atome.filter(function (a) { return a.id !== id; });
    m.bindungen = m.bindungen.filter(function (x) { return x.a !== id && x.b !== id; });
    return m.atome.length !== n;
  }

  function verschiebe(m, id, x, y) {
    var a = atomVon(m, id);
    if (!a) return false;
    a.x = Math.round(Math.max(-2000, Math.min(2000, x))); a.y = Math.round(Math.max(-2000, Math.min(2000, y)));
    return true;
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
      out.push(teil.sort(function (p, q) { return p - q; }));
    });
    return out;
  }

  /** Das Molekül, zu dem ein Atom gehört (Liste von Atom-IDs). */
  function molekuelVon(m, id) { return teile(m).filter(function (t) { return t.indexOf(id) >= 0; })[0] || []; }

  /** Ganzes Molekül entfernen (alle verbundenen Atome), der Rest der Arbeitsfläche bleibt. */
  function molekuelEntfernen(m, id) {
    var ids = molekuelVon(m, id);
    if (!ids.length) return 0;
    m.atome = m.atome.filter(function (a) { return ids.indexOf(a.id) < 0; });
    m.bindungen = m.bindungen.filter(function (x) { return ids.indexOf(x.a) < 0; });
    return ids.length;
  }

  // ------------------------------------------------------------ Formale Prüfung
  /** Prüft das Modell auf formale Fehler. Liefert { ok, fehler: [Text] }. Ändert nichts. */
  function validiere(m) {
    var fehler = [];
    if (!m || !Array.isArray(m.atome) || !Array.isArray(m.bindungen)) return { ok: false, fehler: ['Das Modell hat kein gültiges Format.'] };
    var ids = {};
    m.atome.forEach(function (a, i) {
      if (!a || typeof a.id !== 'number' || a.id % 1) { fehler.push('Atom ' + (i + 1) + ' hat keine gültige ID.'); return; }
      if (ids[a.id]) fehler.push('Die Atom-ID ' + a.id + ' ist doppelt vergeben.');
      ids[a.id] = true;
      if (!B[a.el]) fehler.push('Atom ' + a.id + ': Das Element „' + a.el + '“ gibt es im Baukasten nicht.');
      if (!isFinite(a.x) || !isFinite(a.y)) fehler.push('Atom ' + a.id + ' hat keine gültige Position.');
    });
    var paare = {};
    m.bindungen.forEach(function (x, i) {
      var n = 'Bindung ' + (i + 1);
      if (!x || !ids[x.a] || !ids[x.b]) { fehler.push(n + ' zeigt auf ein Atom, das es nicht gibt.'); return; }
      if (x.a === x.b) fehler.push(n + ' verbindet ein Atom mit sich selbst.');
      if ([1, 2, 3].indexOf(x.ordnung) < 0) fehler.push(n + ' hat eine ungültige Bindungsordnung (' + x.ordnung + ').');
      var k = Math.min(x.a, x.b) + '-' + Math.max(x.a, x.b);
      if (paare[k]) fehler.push('Zwischen Atom ' + x.a + ' und Atom ' + x.b + ' gibt es mehrere Bindungen.');
      paare[k] = true;
    });
    if (m.atome.length && typeof m.naechsteId === 'number') {
      var max = Math.max.apply(null, m.atome.map(function (a) { return a.id || 0; }));
      if (m.naechsteId <= max) fehler.push('Der Zähler für neue Atom-IDs ist zu klein.');
    }
    return { ok: !fehler.length, fehler: fehler };
  }

  /** Gespeichertes Modell einlesen: nur gültige Teile übernehmen, IDs neu vergeben. Liefert { ok, modell, hinweise }. */
  function importiere(daten) {
    var hinweise = [];
    if (!daten || !Array.isArray(daten.atome) || !Array.isArray(daten.bindungen)) return { ok: false, fehler: 'Kein gültiges Molekülmodell.' };
    var m = neu(), alt = {};
    daten.atome.slice(0, MAX_ATOME).forEach(function (a) {
      if (!a || !B[a.el] || alt[a.id] !== undefined || !isFinite(a.x) || !isFinite(a.y)) { hinweise.push('Ein ungültiges Atom wurde übersprungen.'); return; }
      alt[a.id] = atomHinzu(m, a.el, a.x, a.y).id;
    });
    daten.bindungen.forEach(function (x) {
      var r = x && alt[x.a] !== undefined && alt[x.b] !== undefined ? setzeBindung(m, alt[x.a], alt[x.b], x.ordnung) : { ok: false };
      if (!r.ok) hinweise.push('Eine ungültige Bindung wurde übersprungen.');
    });
    return { ok: true, modell: m, hinweise: hinweise };
  }

  // ------------------------------------------------------------ Strukturvergleich (Graph-Isomorphie)
  // Zwei Moleküle sind gleich, wenn es eine Zuordnung ihrer Atome gibt, die Elemente und Bindungen (mit Ordnung) erhält.
  // Positionen spielen keine Rolle. Kleine Moleküle (≤ 40 Atome) → Backtracking mit Vorsortierung reicht.
  function graph(atome, bindungen) {
    var idx = {}, g = { el: [], adj: [] };
    atome.forEach(function (a, i) { idx[a.id] = i; g.el.push(a.el); g.adj.push({}); });
    bindungen.forEach(function (x) { g.adj[idx[x.a]][idx[x.b]] = x.ordnung; g.adj[idx[x.b]][idx[x.a]] = x.ordnung; });
    g.grad = g.adj.map(function (n) { return Object.keys(n).map(function (k) { return g.el[k] + n[k]; }).sort().join(','); });
    return g;
  }
  function isomorph(g, h) {
    var n = g.el.length;
    if (n !== h.el.length) return false;
    if (g.grad.slice().map(function (s, i) { return g.el[i] + ':' + s; }).sort().join('|') !==
        h.grad.slice().map(function (s, i) { return h.el[i] + ':' + s; }).sort().join('|')) return false;
    var map = new Array(n), benutzt = new Array(n);
    // Reihenfolge: Atome mit den meisten Nachbarn zuerst, dann über Nachbarn weiter (schneller Abbruch)
    var reihe = [];
    var drin = {};
    var start = g.el.map(function (e, i) { return i; }).sort(function (p, q) { return Object.keys(g.adj[q]).length - Object.keys(g.adj[p]).length; });
    start.forEach(function (s) {
      if (drin[s]) return;
      var q = [s]; drin[s] = true;
      while (q.length) { var v = q.shift(); reihe.push(v); Object.keys(g.adj[v]).forEach(function (w) { w = Number(w); if (!drin[w]) { drin[w] = true; q.push(w); } }); }
    });
    function passt(i, j) {
      if (g.el[i] !== h.el[j] || g.grad[i] !== h.grad[j]) return false;
      for (var k in g.adj[i]) {
        var mk = map[k];
        if (mk !== undefined && h.adj[j][mk] !== g.adj[i][k]) return false;
      }
      return true;
    }
    function suche(t) {
      if (t === n) return true;
      var i = reihe[t];
      for (var j = 0; j < n; j++) {
        if (benutzt[j] || !passt(i, j)) continue;
        map[i] = j; benutzt[j] = true;
        if (suche(t + 1)) return true;
        map[i] = undefined; benutzt[j] = false;
      }
      return false;
    }
    return suche(0);
  }

  var BEKANNT = null;
  function bekannteGraphen() {
    if (BEKANNT) return BEKANNT;
    BEKANNT = D.MOLEKUELE.map(function (mol) {
      var atome = mol.atome.map(function (a, i) { return { id: i, el: a[0] }; });
      var bindungen = mol.bindungen.map(function (b) { return { a: b[0], b: b[1], ordnung: b[2] }; });
      return { mol: mol, g: graph(atome, bindungen) };
    });
    return BEKANNT;
  }
  /** Bekanntes Molekül (Datensatz-Eintrag) mit genau dieser Struktur oder null. */
  function erkenne(atome, bindungen) {
    var g = graph(atome, bindungen), liste = bekannteGraphen();
    for (var i = 0; i < liste.length; i++) if (isomorph(g, liste[i].g)) return liste[i].mol;
    return null;
  }
  /** Hat ein Molekül (Atom-ID-Liste aus m) genau die Struktur des Datensatz-Moleküls molId? */
  function istStruktur(m, ids, molId) {
    var ziel = bekannteGraphen().filter(function (x) { return x.mol.id === molId; })[0];
    if (!ziel) return false;
    var atome = m.atome.filter(function (a) { return ids.indexOf(a.id) >= 0; });
    var bindungen = m.bindungen.filter(function (x) { return ids.indexOf(x.a) >= 0; });
    return isomorph(graph(atome, bindungen), ziel.g);
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

  // ------------------------------------------------------------ Geometrie
  // Elektronenpaarabstoßungsmodell (EPA/VSEPR). Mehrfachbindungen zählen als ein Bindungspartner.
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
  // Für hinterlegte Messwinkel: das Zentralatom ist das erste Atom des Datensatz-Moleküls mit mindestens zwei Partnern.
  function zentral(mol, el) {
    for (var i = 0; i < mol.atome.length; i++) {
      var k = mol.bindungen.filter(function (b) { return b[0] === i || b[1] === i; }).length;
      if (k >= 2) return mol.atome[i][0] === el;
    }
    return false;
  }

  // ------------------------------------------------------------ Informationen
  /** Alles Wissenswerte zu einem Atom im gebauten Molekül. */
  function atomInfo(m, id) {
    var a = atomVon(m, id);
    if (!a) return null;
    var e = C.element(a.el), k = B[a.el], arten = { 1: 0, 2: 0, 3: 0 };
    nachbarn(m, id).forEach(function (n) { arten[n.ordnung]++; });
    var summe = bindungsSumme(m, id);
    return {
      id: id, symbol: a.el, name: e.name, z: e.z, valenzelektronen: k.valenz, bindigkeit: k.bindigkeit, erweitert: k.erweitert || null,
      maxOrdnung: k.maxOrdnung, bindungen: arten, partner: nachbarn(m, id).length, summe: summe, frei: k.bindigkeit - summe,
      freiePaare: summe <= k.valenz && (k.valenz - summe) % 2 === 0 ? (k.valenz - summe) / 2 : null,
    };
  }

  /** Bewertet alle Moleküle auf der Arbeitsfläche (siehe Kopf der Datei). */
  function analyse(m) {
    return teile(m).map(function (ids) {
      var atome = m.atome.filter(function (a) { return ids.indexOf(a.id) >= 0; });
      var bindungen = m.bindungen.filter(function (x) { return ids.indexOf(x.a) >= 0; });
      var meldungen = [], anzahl = {}, verletzung = false, offen = false, unklar = false, typen = { 1: 0, 2: 0, 3: 0 };
      bindungen.forEach(function (x) { typen[x.ordnung] = (typen[x.ordnung] || 0) + 1; });
      atome.forEach(function (a) {
        anzahl[a.el] = (anzahl[a.el] || 0) + 1;
        var k = B[a.el], soll = k.bindigkeit, ist = bindungsSumme(m, a.id), n = name(a.el);
        if (ist > soll && k.erweitert && ist <= k.erweitert) {
          unklar = true;
          meldungen.push({ art: 'unklar', atom: a.id, text: n + ' hat hier ' + ist + ' Bindungen. Das ist mehr als nach der einfachen Regel (' + soll + '). ' + n +
            ' kann in echten Verbindungen aber bis zu ' + k.erweitert + ' Bindungen eingehen (z. B. ' + (a.el === 'S' ? 'SF₆' : 'PCl₅') + '). Mit den Regeln dieses Modells lässt sich das nicht abschließend beurteilen.' });
        } else if (ist > soll) {
          verletzung = true;
          meldungen.push({ art: 'fehler', atom: a.id, text: n + ' hat in diesem Modell seine übliche Bindigkeit überschritten (' + ist + ' statt ' + soll + ').' });
        } else if (ist < soll) {
          offen = true;
          meldungen.push({ art: 'offen', atom: a.id, text: n + ' besitzt noch ' + (soll - ist === 1 ? 'eine freie Bindungsmöglichkeit' : (soll - ist) + ' freie Bindungsmöglichkeiten') + '.' });
        }
      });
      bindungen.forEach(function (x) {
        if (x.ordnung > maxOrdnung(m, x.a, x.b)) { verletzung = true; meldungen.push({ art: 'fehler', bindung: [x.a, x.b], text: 'Eine ' + ORDNUNG_NAME[x.ordnung] + ' ist zwischen ' + name(atomVon(m, x.a).el) + ' und ' + name(atomVon(m, x.b).el) + ' in diesem Modell nicht möglich.' }); }
      });
      var status = verletzung ? 'verletzung' : offen ? 'unvollstaendig' : unklar ? 'unklar' : 'gueltig';
      var mol = status === 'gueltig' ? erkenne(atome, bindungen) : null;
      var geo = [];
      if (status === 'gueltig') atome.forEach(function (a) {
        var g = geometrie(m, a.id);
        if (g) geo.push({ atom: a.id, el: a.el, geometrie: g, gemessen: mol && mol.winkel && zentral(mol, a.el) ? mol.winkel : null });
      });
      return {
        atome: ids, formel: C.hill(anzahl), anzahl: anzahl, atomAnzahl: atome.length, bindungAnzahl: bindungen.length, bindungsTypen: typen,
        status: status, bekannt: !!mol, name: mol ? mol.name : null, molekuelId: mol ? mol.id : null, meldungen: meldungen, geometrie: geo,
      };
    });
  }

  CL.molekuel = {
    neu: neu, kopie: kopie, atomHinzu: atomHinzu, atomVon: atomVon, setzeBindung: setzeBindung, verbinde: verbinde, trenne: trenne,
    atomEntfernen: atomEntfernen, verschiebe: verschiebe, nachbarn: nachbarn, bindungsSumme: bindungsSumme, teile: teile,
    molekuelVon: molekuelVon, molekuelEntfernen: molekuelEntfernen, validiere: validiere, importiere: importiere,
    analyse: analyse, atomInfo: atomInfo, geometrie: geometrie, beispiel: beispiel, erkenne: erkenne, istStruktur: istStruktur,
    bindungZwischen: bindungZwischen, maxOrdnung: maxOrdnung, ORDNUNG_NAME: ORDNUNG_NAME, MAX_ATOME: MAX_ATOME,
  };
})(typeof window !== 'undefined' ? window : globalThis);
