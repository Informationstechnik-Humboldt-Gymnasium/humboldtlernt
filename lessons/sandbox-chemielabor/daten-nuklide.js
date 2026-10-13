// Atom- & Chemielabor · Quelldaten zu Nukliden (nur Daten)
//
// Ein Nuklid ist eine Atomkernsorte mit fester Protonenzahl Z und Neutronenzahl N (Massenzahl A = Z + N).
// Quelle: IAEA Live Chart of Nuclides / ENSDF (Halbwertszeiten auf drei gültige Ziffern gerundet).
//
// BEWUSST BEGRENZTER DATENSATZ: Hinterlegt sind
//   – alle stabilen Nuklide der Elemente Z = 1–20 (vollständig) sowie von Fe und Pb,
//   – einige bekannte, gut vermessene radioaktive Nuklide, die im Unterricht vorkommen.
// Fehlt eine Kombination, heißt das NICHT, dass es sie nicht gibt – nur, dass das Labor keine Daten dazu hat.
//
// Format: Z: { stabil: [A, …], radioaktiv: [[A, Halbwertszeit, Einheit], …] }
//   Einheiten der Halbwertszeit: 's' Sekunden, 'min' Minuten, 'h' Stunden, 'd' Tage, 'a' Jahre.
//   Halbwertszeit null = Zerfall nachgewiesen, aber für das Labor kein sicherer Zahlenwert hinterlegt.
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var D = CL.daten || (CL.daten = {});

  D.NUKLIDE = {
    1: { stabil: [1, 2], radioaktiv: [[3, 12.3, 'a']] },
    2: { stabil: [3, 4], radioaktiv: [] },
    3: { stabil: [6, 7], radioaktiv: [] },
    4: { stabil: [9], radioaktiv: [[7, 53.2, 'd'], [10, 1.39e6, 'a']] },
    5: { stabil: [10, 11], radioaktiv: [] },
    6: { stabil: [12, 13], radioaktiv: [[11, 20.4, 'min'], [14, 5700, 'a']] },
    7: { stabil: [14, 15], radioaktiv: [[13, 9.97, 'min']] },
    8: { stabil: [16, 17, 18], radioaktiv: [[15, 122, 's']] },
    9: { stabil: [19], radioaktiv: [[18, 110, 'min']] },
    10: { stabil: [20, 21, 22], radioaktiv: [] },
    11: { stabil: [23], radioaktiv: [[22, 2.60, 'a'], [24, 15.0, 'h']] },
    12: { stabil: [24, 25, 26], radioaktiv: [] },
    13: { stabil: [27], radioaktiv: [[26, 7.17e5, 'a']] },
    14: { stabil: [28, 29, 30], radioaktiv: [] },
    15: { stabil: [31], radioaktiv: [[32, 14.3, 'd']] },
    16: { stabil: [32, 33, 34, 36], radioaktiv: [[35, 87.4, 'd']] },
    17: { stabil: [35, 37], radioaktiv: [[36, 3.01e5, 'a']] },
    18: { stabil: [36, 38, 40], radioaktiv: [[39, 268, 'a']] },
    19: { stabil: [39, 41], radioaktiv: [[40, 1.25e9, 'a']] },
    20: { stabil: [40, 42, 43, 44, 46], radioaktiv: [[41, 9.94e4, 'a'], [48, null, 'a']] },
    26: { stabil: [54, 56, 57, 58], radioaktiv: [[55, 2.74, 'a'], [59, 44.5, 'd'], [60, 2.62e6, 'a']] },
    27: { stabil: [59], radioaktiv: [[60, 5.27, 'a']] },
    38: { stabil: [84, 86, 87, 88], radioaktiv: [[90, 28.9, 'a']] },
    53: { stabil: [127], radioaktiv: [[131, 8.03, 'd']] },
    55: { stabil: [133], radioaktiv: [[137, 30.1, 'a']] },
    82: { stabil: [204, 206, 207, 208], radioaktiv: [[210, 22.2, 'a']] },
    86: { stabil: [], radioaktiv: [[222, 3.82, 'd']] },
    88: { stabil: [], radioaktiv: [[226, 1600, 'a']] },
    92: { stabil: [], radioaktiv: [[234, 2.46e5, 'a'], [235, 7.04e8, 'a'], [238, 4.47e9, 'a']] },
  };

  // Elemente ohne ein einziges stabiles Nuklid (alle Isotope sind radioaktiv). Quelle: IAEA/ENSDF.
  // Gilt für Tc (43), Pm (61) und alle Elemente ab Z = 84. Bi (83) gilt als praktisch stabil,
  // sein einziges natürliches Isotop Bi-209 zerfällt aber mit einer Halbwertszeit von rund 2·10¹⁹ Jahren.
  D.OHNE_STABILE_NUKLIDE = function (z) { return z === 43 || z === 61 || z >= 84; };

  D.EINHEIT_ZEIT = { s: 'Sekunden', min: 'Minuten', h: 'Stunden', d: 'Tage', a: 'Jahre' };
})(typeof window !== 'undefined' ? window : globalThis);
