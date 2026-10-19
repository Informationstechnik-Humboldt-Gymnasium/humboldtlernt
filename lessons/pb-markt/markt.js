// Marktmodell mit geraden Kurven (kein DOM). Nachfrage N(p) = a + dN − b·p, Angebot A(p) = c·p + dA (jeweils ≥ 0).
// Vereinfachtes Lehrmodell: ein Gut, viele Anbieter und Käufer, vollständige Information.
(function (root) {
  'use strict';
  var MK = root.MK || (root.MK = {});
  var STANDARD = { a: 100, b: 4, c: 6, dN: 0, dA: 0 };

  function nachfrage(m, p) { return Math.max(0, m.a + m.dN - m.b * p); }
  function angebot(m, p) { return Math.max(0, m.c * p + m.dA); }

  /** Gleichgewicht: N(p) = A(p). Liefert { preis, menge } (Preis nicht negativ). */
  function gleichgewicht(m) {
    var p = Math.max(0, (m.a + m.dN - m.dA) / (m.b + m.c));
    return { preis: p, menge: nachfrage(m, p) };
  }

  /** Lage bei einem Preis: Mengen, Überhang und verkaufte Menge (die kleinere der beiden). */
  function lage(m, p) {
    var n = nachfrage(m, p), an = angebot(m, p), d = an - n;
    return { nachfrage: n, angebot: an, verkauft: Math.min(n, an), ueberhang: Math.abs(d), art: Math.abs(d) < 1e-9 ? 'gleichgewicht' : d > 0 ? 'angebotsueberhang' : 'nachfrageueberhang' };
  }

  /** Ein Anpassungsschritt: Bei Nachfrageüberhang steigt der Preis, bei Angebotsüberhang sinkt er. */
  function schritt(m, p, k) {
    var l = lage(m, p);
    return Math.max(0, p - (k || 0.02) * (l.angebot - l.nachfrage));
  }

  MK.STANDARD = STANDARD; MK.nachfrage = nachfrage; MK.angebot = angebot; MK.gleichgewicht = gleichgewicht; MK.lage = lage; MK.schritt = schritt;
})(typeof window !== 'undefined' ? window : globalThis);
