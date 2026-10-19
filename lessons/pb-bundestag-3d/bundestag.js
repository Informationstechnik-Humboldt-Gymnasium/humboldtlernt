// Bundestag-Modell: Sitzverteilung, Sitzplan und Mehrheiten (kein DOM, auch in Tests nutzbar)
//
// Quelle der Sitzzahlen: amtliches Endergebnis der Bundestagswahl vom 23. Februar 2025 (Bundeswahlleiterin,
// Deutscher Bundestag). Während der Wahlperiode kann sich die Zahl der Fraktionsmitglieder durch Austritte ändern.
// Sitzordnung vereinfacht: von links nach rechts aus Sicht des Präsidiums wie üblich Linke, SPD, Grüne, CDU/CSU, AfD;
// der fraktionslose Abgeordnete des SSW sitzt im Modell in der letzten Reihe in der Mitte. Die genaue Platzverteilung
// legt der Ältestenrat fest. Das Modell ist eine Schemazeichnung, kein maßstabsgetreuer Plan des Plenarsaals.
(function (root) {
  'use strict';
  var BT = root.BT || (root.BT = {});

  var FRAKTIONEN = [
    { id: 'linke', name: 'Die Linke', kurz: 'Linke', sitze: 64 },
    { id: 'spd', name: 'SPD', kurz: 'SPD', sitze: 120 },
    { id: 'gruene', name: 'Bündnis 90/Die Grünen', kurz: 'Grüne', sitze: 85 },
    { id: 'union', name: 'CDU/CSU', kurz: 'CDU/CSU', sitze: 208 },
    { id: 'afd', name: 'AfD', kurz: 'AfD', sitze: 152 },
    { id: 'ssw', name: 'SSW (fraktionslos)', kurz: 'SSW', sitze: 1, fraktionslos: true },
  ];
  var GESAMT = FRAKTIONEN.reduce(function (s, f) { return s + f.sitze; }, 0);   // 630

  /** Mehrheiten bei voller Mitgliederzahl. */
  function schwellen(gesamt) {
    gesamt = gesamt || GESAMT;
    return { kanzler: Math.floor(gesamt / 2) + 1, zweidrittel: Math.ceil(gesamt * 2 / 3) };
  }

  function fraktion(id) { for (var i = 0; i < FRAKTIONEN.length; i++) if (FRAKTIONEN[i].id === id) return FRAKTIONEN[i]; return null; }

  /** Summe der Sitze einer Auswahl von Fraktions-IDs und welche Mehrheiten sie erreicht. */
  function bewerte(ids) {
    var s = schwellen(), sitze = 0;
    (ids || []).forEach(function (id) { var f = fraktion(id); if (f) sitze += f.sitze; });
    return { sitze: sitze, kanzler: sitze >= s.kanzler, zweidrittel: sitze >= s.zweidrittel, fehlenKanzler: Math.max(0, s.kanzler - sitze), fehlenZweidrittel: Math.max(0, s.zweidrittel - sitze) };
  }

  /** Alle Kombinationen aus genau n Fraktionen (nur Fraktionen, ohne Fraktionslose), rechnerisch mit Sitzsumme. */
  function kombinationen(n) {
    var fr = FRAKTIONEN.filter(function (f) { return !f.fraktionslos; }), out = [];
    (function weiter(start, wahl) {
      if (wahl.length === n) { out.push({ ids: wahl.slice(), sitze: bewerte(wahl).sitze }); return; }
      for (var i = start; i < fr.length; i++) { wahl.push(fr[i].id); weiter(i + 1, wahl); wahl.pop(); }
    })(0, []);
    return out;
  }

  /**
   * Sitzplan als Halbrund. Liefert Sitze { reihe, winkel, x, z, y, fraktion }.
   * Koordinaten: Mittelpunkt des Halbrunds im Ursprung, Präsidium bei negativem z (Blick des Präsidiums Richtung +z).
   * Aus Sicht des Präsidiums ist links +x. Die Fraktionen werden wie in Parlamentsgrafiken in Keilen verteilt:
   * alle Sitze nach Winkel sortiert und der Reihe nach vergeben.
   */
  function sitzplan(opt) {
    opt = opt || {};
    var reihen = opt.reihen || 13, r0 = opt.r0 || 5, dr = opt.dr || 0.72, stufe = opt.stufe || 0.2;
    var von = (opt.von === undefined ? -16 : opt.von) * Math.PI / 180, bis = (opt.bis === undefined ? 196 : opt.bis) * Math.PI / 180;
    var fraktionsSitze = FRAKTIONEN.filter(function (f) { return !f.fraktionslos; });
    var anzahl = fraktionsSitze.reduce(function (s, f) { return s + f.sitze; }, 0);
    // Sitze je Reihe proportional zum Radius (Bogenlänge), Rundung so verteilen, dass die Summe genau stimmt
    var radien = [], summeR = 0;
    for (var i = 0; i < reihen; i++) { radien.push(r0 + i * dr); summeR += r0 + i * dr; }
    var roh = radien.map(function (r) { return anzahl * r / summeR; });
    var proReihe = roh.map(Math.floor), rest = anzahl - proReihe.reduce(function (a, b) { return a + b; }, 0);
    roh.map(function (v, k) { return { k: k, b: v - Math.floor(v) }; }).sort(function (a, b) { return b.b - a.b || b.k - a.k; })
      .slice(0, rest).forEach(function (x) { proReihe[x.k]++; });
    var sitze = [];
    proReihe.forEach(function (n, reihe) {
      for (var j = 0; j < n; j++) {
        var w = n === 1 ? (von + bis) / 2 : von + (bis - von) * j / (n - 1);
        sitze.push({ reihe: reihe, winkel: w, x: radien[reihe] * Math.cos(w), z: radien[reihe] * Math.sin(w), y: reihe * stufe });
      }
    });
    // Nach Winkel sortieren (bei gleichem Winkel innen zuerst) und Fraktionen von links (+x, Winkel klein) vergeben
    sitze.sort(function (a, b) { return a.winkel - b.winkel || a.reihe - b.reihe; });
    var k = 0;
    fraktionsSitze.forEach(function (f) { for (var m = 0; m < f.sitze; m++) sitze[k++].fraktion = f.id; });
    // Fraktionslose: hinter der letzten Reihe in der Mitte
    var rAussen = r0 + reihen * dr + 0.15;
    FRAKTIONEN.filter(function (f) { return f.fraktionslos; }).forEach(function (f, idx) {
      for (var m = 0; m < f.sitze; m++) {
        var w = Math.PI / 2 + (idx * f.sitze + m) * 0.05;
        sitze.push({ reihe: reihen, winkel: w, x: rAussen * Math.cos(w), z: rAussen * Math.sin(w), y: reihen * stufe, fraktion: f.id });
      }
    });
    return { sitze: sitze, radien: radien, proReihe: proReihe, aussen: rAussen };
  }

  /** Mittlerer Winkel jeder Fraktion (für Beschriftungen). */
  function fraktionsMitten(plan) {
    var m = {};
    plan.sitze.forEach(function (s) { var x = m[s.fraktion] || (m[s.fraktion] = { x: 0, z: 0, n: 0 }); x.x += s.x; x.z += s.z; x.n++; });
    Object.keys(m).forEach(function (k) { m[k] = { x: m[k].x / m[k].n, z: m[k].z / m[k].n }; });
    return m;
  }

  BT.daten = { FRAKTIONEN: FRAKTIONEN, GESAMT: GESAMT, STAND: 'Bundestagswahl 2025, amtliches Endergebnis' };
  BT.schwellen = schwellen;
  BT.fraktion = fraktion;
  BT.bewerte = bewerte;
  BT.kombinationen = kombinationen;
  BT.sitzplan = sitzplan;
  BT.fraktionsMitten = fraktionsMitten;
})(typeof window !== 'undefined' ? window : globalThis);
