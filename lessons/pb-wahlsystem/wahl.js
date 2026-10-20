// Wahlsystem-Rechner (kein DOM): Fünf-Prozent-Hürde, Grundmandatsklausel und Sitzverteilung nach Sainte-Laguë/Schepers.
// Vereinfachung: bundesweite Verteilung ohne Länderlisten und ohne Zweitstimmendeckung der Wahlkreissieger.
(function (root) {
  'use strict';
  var WS = root.WS || (root.WS = {});

  /** Zieht eine Partei ins Parlament ein? (≥ 5 % oder ≥ 3 Direktmandate oder Partei einer nationalen Minderheit) */
  function zieht(anteil, direkt, minderheit) { return !!minderheit || anteil >= 0.05 - 1e-12 || (direkt || 0) >= 3; }

  /**
   * Sitzverteilung nach dem Höchstzahlverfahren von Sainte-Laguë: Stimmen durch 0,5; 1,5; 2,5; … teilen,
   * die höchsten Quotienten bekommen die Sitze. Gleichstand: Partei mit mehr Stimmen, dann Reihenfolge.
   * parteien: [{ id, stimmen }]; liefert { id: sitze }.
   */
  function saintLague(parteien, sitze) {
    var out = {}, q = [];
    parteien.forEach(function (p, i) {
      out[p.id] = 0;
      if (p.stimmen > 0) for (var k = 0; k < sitze; k++) q.push({ id: p.id, w: p.stimmen / (k + 0.5), s: p.stimmen, i: i });
    });
    q.sort(function (a, b) { return b.w - a.w || b.s - a.s || a.i - b.i; });
    for (var j = 0; j < Math.min(sitze, q.length); j++) out[q[j].id]++;
    return out;
  }

  /**
   * Ganze Auswertung. parteien: [{ id, name, stimmen, direkt, minderheit }].
   * Liefert { gesamt, parteien: [{ …, anteil, drin, sitze, sitzanteil }], verloren (Stimmenanteil ohne Sitz) }.
   */
  function auswerten(parteien, sitze) {
    var gesamt = parteien.reduce(function (s, p) { return s + Math.max(0, p.stimmen); }, 0) || 1;
    var liste = parteien.map(function (p) {
      var anteil = Math.max(0, p.stimmen) / gesamt;
      return { id: p.id, name: p.name, stimmen: p.stimmen, direkt: p.direkt || 0, minderheit: !!p.minderheit, anteil: anteil, drin: zieht(anteil, p.direkt, p.minderheit) };
    });
    var verteilung = saintLague(liste.filter(function (p) { return p.drin; }), sitze);
    var verloren = 0;
    liste.forEach(function (p) { p.sitze = verteilung[p.id] || 0; p.sitzanteil = p.sitze / sitze; if (!p.drin) verloren += p.anteil; });
    return { gesamt: gesamt, parteien: liste, verloren: verloren, sitze: sitze };
  }

  WS.zieht = zieht;
  WS.saintLague = saintLague;
  WS.auswerten = auswerten;
})(typeof window !== 'undefined' ? window : globalThis);
