// BioLab · Optik des virtuellen Lichtmikroskops (ohne DOM, getestet in test/biolab.test.mjs)
//
// Werte typischer Schulmikroskope (Okular 10×, Sehfeldzahl 18 mm):
//   Objektiv  numerische Apertur (NA)
//     4×        0,10
//    10×        0,25
//    40×        0,65
//   100×        1,25 (Ölimmersion)
// Auflösung nach Abbe/Rayleigh: d = 0,61 · λ / NA mit λ = 0,55 µm (grünes Licht).
// Schärfentiefe (vereinfacht, nur Wellenoptik): t ≈ λ · n / NA²; n = 1 (Luft) bzw. 1,52 (Immersionsöl).
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});
  var LAMBDA = 0.55, OKULAR = 10, SEHFELDZAHL_MM = 18;
  var OBJEKTIVE = [
    { v: 4, na: 0.10, n: 1 },
    { v: 10, na: 0.25, n: 1 },
    { v: 40, na: 0.65, n: 1 },
    { v: 100, na: 1.25, n: 1.52, oel: true },
  ];

  function objektiv(v) { for (var i = 0; i < OBJEKTIVE.length; i++) if (OBJEKTIVE[i].v === v) return OBJEKTIVE[i]; return null; }
  /** Gesamtvergrößerung = Okular · Objektiv */
  function gesamt(v) { return OKULAR * v; }
  /** Durchmesser des sichtbaren Ausschnitts im Präparat in µm */
  function sehfeld(v) { return SEHFELDZAHL_MM * 1000 / v; }
  /** kleinster Abstand zweier Punkte, die noch getrennt erscheinen, in µm */
  function aufloesung(v) { return 0.61 * LAMBDA / objektiv(v).na; }
  /** Schärfentiefe in µm */
  function schaerfentiefe(v) { var o = objektiv(v); return LAMBDA * o.n / (o.na * o.na); }
  /** Bildpunkte pro µm, wenn das Sehfeld durchmesserPx Bildpunkte breit dargestellt wird */
  function pxProUm(v, durchmesserPx) { return durchmesserPx / sehfeld(v); }

  /**
   * Ist eine Struktur der Größe groesseUm erkennbar?
   *  – optisch: größer als zweimal die Auflösung
   *  – auf dem Bildschirm: mindestens MIN_PX Bildpunkte groß
   */
  var MIN_PX = 3;
  function erkennbar(groesseUm, v, durchmesserPx) {
    return groesseUm >= 2 * aufloesung(v) && groesseUm * pxProUm(v, durchmesserPx) >= MIN_PX;
  }
  /** kleinste Gesamtvergrößerung, ab der die Struktur erkennbar ist (oder null) */
  function erkennbarAb(groesseUm, durchmesserPx) {
    for (var i = 0; i < OBJEKTIVE.length; i++) if (erkennbar(groesseUm, OBJEKTIVE[i].v, durchmesserPx)) return gesamt(OBJEKTIVE[i].v);
    return null;
  }

  /** Unschärfe in Bildpunkten, wenn die Fokusebene um abstandUm von der Präparatebene abweicht. */
  function unschaerfePx(abstandUm, v) {
    var t = schaerfentiefe(v);
    var u = Math.abs(abstandUm) <= t / 2 ? 0 : (Math.abs(abstandUm) - t / 2) / t * 1.6;
    return Math.min(14, u);
  }

  /** Länge des Maßstabsbalkens: „runde“ Länge, die mindestens minPx breit ist. */
  var RUND = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  function massstab(pxJeUm, minPx) {
    for (var i = 0; i < RUND.length; i++) if (RUND[i] * pxJeUm >= (minPx || 60)) return { um: RUND[i], px: RUND[i] * pxJeUm };
    var l = RUND[RUND.length - 1];
    return { um: l, px: l * pxJeUm };
  }
  function laengeText(um) {
    if (um >= 1000) return (um / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' mm';
    if (um < 1) return (um * 1000).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' nm';
    return um.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' µm';
  }

  BL.optik = {
    OKULAR: OKULAR, OBJEKTIVE: OBJEKTIVE, MIN_PX: MIN_PX, objektiv: objektiv, gesamt: gesamt, sehfeld: sehfeld,
    aufloesung: aufloesung, schaerfentiefe: schaerfentiefe, pxProUm: pxProUm, erkennbar: erkennbar,
    erkennbarAb: erkennbarAb, unschaerfePx: unschaerfePx, massstab: massstab, laengeText: laengeText,
  };
})(typeof window !== 'undefined' ? window : this);
