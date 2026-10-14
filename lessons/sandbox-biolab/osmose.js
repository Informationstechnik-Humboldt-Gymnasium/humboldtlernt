// BioLab · Rechenmodelle für Diffusion und Osmose (ohne DOM, getestet in test/biolab.test.mjs)
//
// Osmose-Modell (vereinfacht, dimensionslos):
//   Die Zelle enthält eine feste Menge gelöster Teilchen n (sie können die Membran nicht passieren).
//   Startvolumen V = 1, Innenkonzentration c_innen = n / V = 1.
//   Außenkonzentration c als Vielfaches der Startkonzentration (1 = gleich konzentriert, „isotonisch“).
//   Wasser strömt durch die halbdurchlässige Membran zur Seite mit der höheren Konzentration gelöster Teilchen:
//       dV/dt = k · (n / V − c − p)
//   p ist der Gegendruck der Zellwand (nur Pflanzenzelle): p = E · (V − 1) für V > 1, sonst 0.
//   Pflanzenzelle bei V < 1: Der Zellinhalt löst sich von der Wand (Plasmolyse).
//   Rotes Blutkörperchen ohne Zellwand: wird V größer als PLATZT, platzt es (Hämolyse).
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});
  var K = 0.6, E = 8, PLATZT = 1.45, VMIN = 0.25;

  function neu(typ, c) { return { typ: typ, n: 1, V: 1, c: c, t: 0, geplatzt: false }; }
  function druck(z) { return z.typ === 'pflanze' && z.V > 1 ? E * (z.V - 1) : 0; }
  /** Netto-Wasserstrom (positiv = in die Zelle hinein) */
  function strom(z) { return z.geplatzt ? 0 : K * (z.n / z.V - z.c - druck(z)); }
  function schritt(z, dt) {
    if (z.geplatzt) return z;
    var steps = Math.max(1, Math.ceil(dt / 0.02)), h = dt / steps;
    for (var i = 0; i < steps; i++) {
      z.V = Math.max(VMIN, z.V + strom(z) * h);
      z.t += h;
      if (z.typ === 'blut' && z.V > PLATZT) { z.geplatzt = true; break; }
    }
    return z;
  }
  /** Volumen im Gleichgewicht (Infinity: platzt bzw. wächst ohne Grenze) */
  function gleichgewicht(typ, c) {
    if (typ === 'blut') return c <= 0 ? Infinity : Math.max(VMIN, 1 / c);
    // Pflanzenzelle: 1/V − c − E·(V−1) = 0 für V > 1, sonst V = 1/c
    if (c >= 1) return Math.max(VMIN, 1 / c);
    var lo = 1, hi = 2;
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2, f = 1 / m - c - E * (m - 1); if (f > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function zustandText(z) {
    var ci = z.n / z.V;
    if (z.geplatzt) return 'Das rote Blutkörperchen ist geplatzt (Hämolyse): Ohne Zellwand hält es dem Wassereinstrom nicht stand.';
    if (z.typ === 'pflanze') {
      if (z.V < 0.97) return 'Plasmolyse: Wasser hat die Zelle verlassen, der Zellinhalt hat sich von der Zellwand gelöst.';
      if (z.V > 1.01) return 'Die Zelle ist prall (Turgor): Die Zellwand drückt dagegen und verhindert weiteres Anschwellen.';
      return 'Gleichgewicht: Ein- und ausströmendes Wasser halten sich die Waage.';
    }
    if (z.V < 0.95) return 'Wasser strömt aus, das Blutkörperchen schrumpft und wird stachelig (Stechapfelform).';
    if (z.V > 1.05) return 'Wasser strömt ein, das Blutkörperchen schwillt an und wird kugelig.';
    return 'Gleich konzentriert (isotonisch): Das Blutkörperchen behält seine Scheibenform.';
  }

  // ---------------------------------------------------------------- Diffusion: Teilchen in zwei Kammern
  /** Teilchen mit Zufallsbewegung; Trennwand bei x = 0.5 mit Poren (Durchlass, wenn porig und Teilchen klein genug) */
  function diffusionNeu(anzahl, seed) {
    var s = seed || 1, r = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    var t = [];
    for (var i = 0; i < anzahl; i++) t.push({ x: 0.03 + r() * 0.44, y: 0.03 + r() * 0.94 });
    return { teilchen: t, r: r, zeit: 0 };
  }
  /** Ein Schritt: tempo ~ Wurzel der Temperatur; poren: Teilchen dürfen durch die Wand */
  function diffusionSchritt(d, dt, tempo, durchlaessig) {
    var sigma = 0.15 * tempo * Math.sqrt(dt);
    d.teilchen.forEach(function (p) {
      var nx = p.x + (d.r() - 0.5) * 2 * sigma * 1.73, ny = p.y + (d.r() - 0.5) * 2 * sigma * 1.73;
      if (ny < 0.02) ny = 0.04 - ny; if (ny > 0.98) ny = 1.96 - ny;
      if (nx < 0.02) nx = 0.04 - nx; if (nx > 0.98) nx = 1.96 - nx;
      var quert = (p.x < 0.5) !== (nx < 0.5);
      if (quert && !durchlaessig) nx = p.x;               // an der Wand abprallen
      p.x = Math.max(0.02, Math.min(0.98, nx)); p.y = Math.max(0.02, Math.min(0.98, ny));
    });
    d.zeit += dt;
    return d;
  }
  function anteilLinks(d) { var n = 0; d.teilchen.forEach(function (p) { if (p.x < 0.5) n++; }); return n / d.teilchen.length; }

  BL.osmose = { K: K, E: E, PLATZT: PLATZT, neu: neu, strom: strom, schritt: schritt, druck: druck, gleichgewicht: gleichgewicht, zustandText: zustandText };
  BL.diffusion = { neu: diffusionNeu, schritt: diffusionSchritt, anteilLinks: anteilLinks };
})(typeof window !== 'undefined' ? window : this);
