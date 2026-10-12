// Logik-Labor · Wahrheitstabellen-Generator
//
// Spielt alle Kombinationen der gewählten unabhängigen Eingänge (Schalter, Taster, Taktgeber) durch und rechnet
// jede Zeile mit derselben Engine wie die Live-Simulation (SL.sim.auswerten). Nicht gewählte Eingänge behalten
// ihren aktuellen Wert. Jede Zeile startet vom Ruhezustand (alle Ausgänge 0), damit das Ergebnis eindeutig ist.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});
  var MAX_EINGAENGE = 8;   // 2^8 = 256 Zeilen

  var EINGABE = { schalter: 1, taster: 1, takt: 1 };
  var AUSGABE = { lampe: 'Lampe', segment: 'Anzeige', relais: 'Relais' };

  /** Mögliche Ein- und Ausgänge der Tabelle, sortiert nach Lage (oben → unten, links → rechts). */
  function kandidaten(doc) {
    var lage = function (a, b) { return a.y - b.y || a.x - b.x; };
    var ein = doc.bauteile.filter(function (b) { return EINGABE[b.typ]; }).sort(lage);
    var genutzt = {};
    doc.draehte.forEach(function (d) { genutzt[d.von.b + ':' + d.von.a] = 1; });
    var aus = doc.bauteile.filter(function (b) { return AUSGABE[b.typ] || SL.TYPEN[b.typ].gatter; }).sort(lage);
    return {
      eingaenge: ein.map(function (b) { return { id: b.id, name: b.name }; }),
      ausgaenge: aus.map(function (b) {
        return { id: b.id, name: b.name, art: AUSGABE[b.typ] || SL.GATTER[b.typ].name, standard: !!AUSGABE[b.typ] && b.typ !== 'relais', ende: !!SL.TYPEN[b.typ].gatter && !genutzt[b.id + ':q'] };
      }),
    };
  }

  function wert(b, r) {
    if (b.typ === 'lampe') return r.an;
    if (b.typ === 'relais') return r.angezogen;
    if (b.typ === 'segment') return r.zeichen == null ? '?' : r.zeichen === '' ? '–' : r.zeichen;
    return r.q;
  }

  /**
   * opt.eingaenge / opt.ausgaenge: ids (sonst automatisch). Ergebnis:
   * { eingaenge: [{id, name}], ausgaenge: [{id, name, art}], zeilen: [{ein: [0|1], aus: [..], schwingt}], aktuell, fehler, warnungen }
   */
  function tabelle(doc, opt) {
    opt = opt || {};
    var k = kandidaten(doc), out = { eingaenge: [], ausgaenge: [], zeilen: [], aktuell: -1, fehler: '', warnungen: [], kandidaten: k };
    var ein = opt.eingaenge ? k.eingaenge.filter(function (x) { return opt.eingaenge.indexOf(x.id) >= 0; }) : k.eingaenge.slice();
    var aus = opt.ausgaenge ? k.ausgaenge.filter(function (x) { return opt.ausgaenge.indexOf(x.id) >= 0; }) : k.ausgaenge.filter(function (x) { return x.standard; });
    if (!opt.ausgaenge && !aus.length) aus = k.ausgaenge.filter(function (x) { return x.ende; });
    if (!k.eingaenge.length) { out.fehler = 'Für eine Wahrheitstabelle braucht die Schaltung mindestens einen Schalter, Taster oder Taktgeber als Eingang.'; return out; }
    if (!ein.length) { out.fehler = 'Wähle mindestens einen Eingang für die Tabelle aus.'; return out; }
    if (!aus.length) { out.fehler = k.ausgaenge.length ? 'Wähle mindestens einen Ausgang für die Tabelle aus.' : 'Für eine Wahrheitstabelle braucht die Schaltung einen Ausgang: eine Lampe, eine Anzeige oder ein Gatter.'; return out; }
    if (ein.length > MAX_EINGAENGE) {
      out.warnungen.push('Die Schaltung hat ' + ein.length + ' Eingänge, das wären ' + Math.pow(2, ein.length) + ' Zeilen. Die Tabelle zeigt nur die ersten ' + MAX_EINGAENGE + ' – wähle unten aus, welche Eingänge untersucht werden.');
      ein = ein.slice(0, MAX_EINGAENGE);
    }
    out.eingaenge = ein; out.ausgaenge = aus;
    var teile = {}; doc.bauteile.forEach(function (b) { teile[b.id] = b; });
    var n = ein.length, schwingt = false, zyklisch = false;
    for (var z = 0; z < (1 << n); z++) {
      var setzen = {}, bits = [];
      for (var i = 0; i < n; i++) { var v = (z >> (n - 1 - i)) & 1; setzen[ein[i].id] = v; bits.push(v); }
      var r = SL.sim.auswerten(doc, { setzen: setzen, t: 0 });
      zyklisch = zyklisch || r.zyklisch;
      schwingt = schwingt || r.schwingt;
      out.zeilen.push({ ein: bits, aus: aus.map(function (a) { return r.schwingt ? '~' : wert(teile[a.id], r.bauteile[a.id]); }), schwingt: r.schwingt });
    }
    // Zeile des aktuellen Zustands (Schalter-/Tasterstellung)
    var jetzt = 0;
    ein.forEach(function (x, i) { var b = teile[x.id]; var v = b.typ === 'schalter' ? b.werte.an : b.typ === 'taster' ? b.werte.gedrueckt : (opt.takt != null ? opt.takt[x.id] || 0 : 0); jetzt |= (v ? 1 : 0) << (n - 1 - i); });
    out.aktuell = jetzt;
    if (schwingt) out.warnungen.push('In manchen Zeilen schwingt die Schaltung (~): Dort gibt es keinen festen Wert.');
    else if (zyklisch) out.warnungen.push('Die Schaltung hat eine Rückkopplung. Die Tabelle zeigt jede Zeile ausgehend vom Ruhezustand (alle Ausgänge 0); im Betrieb kann sich die Schaltung einen anderen Zustand merken.');
    return out;
  }

  SL.wahrheit = { tabelle: tabelle, kandidaten: kandidaten, MAX_EINGAENGE: MAX_EINGAENGE };
})(typeof window !== 'undefined' ? window : globalThis);
