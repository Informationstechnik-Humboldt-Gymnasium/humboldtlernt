// Atom- & Chemielabor · Quelldaten zu Teilchen, Konstanten, Molekülen und Stoffen (nur Daten)
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var D = CL.daten || (CL.daten = {});

  // Physikalische Konstanten. Quelle: CODATA 2018 (NIST), gerundet. e ist seit 2019 exakt festgelegt.
  D.KONSTANTEN = {
    e: 1.602176634e-19,       // Elementarladung in C (exakt)
    mProton: 1.007276,        // Masse des Protons in u
    mNeutron: 1.008665,       // Masse des Neutrons in u
    mElektron: 0.000548580,   // Masse des Elektrons in u
    hc: 1239.842,             // Planck-Konstante · Lichtgeschwindigkeit in eV·nm (für λ = hc / E)
  };

  // Teilchen für das Atom- und Isotopenlabor (Ladung in Vielfachen der Elementarladung e).
  D.TEILCHEN = {
    p: { name: 'Proton', ladung: +1, masse: D.KONSTANTEN.mProton, ort: 'Atomkern' },
    n: { name: 'Neutron', ladung: 0, masse: D.KONSTANTEN.mNeutron, ort: 'Atomkern' },
    e: { name: 'Elektron', ladung: -1, masse: D.KONSTANTEN.mElektron, ort: 'Atomhülle' },
  };

  // Gemessene Spektrallinien als Beispiele für Emission/Absorption. Quelle: NIST Atomic Spectra Database.
  // Wellenlängen in nm, in Luft gemessen.
  D.SPEKTRALLINIEN = [
    { element: 'Na', name: 'Natrium-D-Linien (gelb, z. B. Straßenlaterne)', wellenlaengen: [589.0, 589.6] },
    { element: 'H', name: 'Wasserstoff Hα (rot)', wellenlaengen: [656.3] },
  ];

  // Schmelz- und Siedetemperaturen in °C bei 1013 hPa, TABELLIERT (Quelle: CRC Handbook of Chemistry and Physics, gerundet).
  D.STOFFE_ZUSTAND = [
    { id: 'wasser', name: 'Wasser', formel: 'H₂O', schmelz: 0, siede: 100 },
    { id: 'ethanol', name: 'Ethanol', formel: 'C₂H₅OH', schmelz: -114, siede: 78 },
    { id: 'sauerstoff', name: 'Sauerstoff', formel: 'O₂', schmelz: -219, siede: -183 },
    { id: 'eisen', name: 'Eisen', formel: 'Fe', schmelz: 1538, siede: 2861 },
  ];

  // Elemente im Molekülbaukasten mit ihrer üblichen Bindigkeit (Anzahl Elektronenpaarbindungen in einfachen
  // ungeladenen Molekülen) und der Zahl der Valenzelektronen. VEREINFACHUNG: Ausnahmen wie Schwefel mit mehr
  // als zwei Bindungen (z. B. in SO₂, H₂SO₄) oder Kohlenstoffmonoxid werden bewusst nicht gebaut.
  D.BAUKASTEN = {
    H: { bindigkeit: 1, valenz: 1, maxOrdnung: 1 },
    C: { bindigkeit: 4, valenz: 4, maxOrdnung: 3 },
    N: { bindigkeit: 3, valenz: 5, maxOrdnung: 3 },
    O: { bindigkeit: 2, valenz: 6, maxOrdnung: 2 },
    F: { bindigkeit: 1, valenz: 7, maxOrdnung: 1 },
    S: { bindigkeit: 2, valenz: 6, maxOrdnung: 2 },
    Cl: { bindigkeit: 1, valenz: 7, maxOrdnung: 1 },
  };

  // Bekannte, experimentell nachgewiesene Moleküle. Atome mit Zeichenposition (x, y) zum Laden als Beispiel,
  // Bindungen als [Atom a, Atom b, Bindungsordnung]. winkel = gemessener Bindungswinkel in Grad (Gasphase,
  // Quelle: NIST CCCBDB), nur wo hinterlegt; sonst zeigt das Labor den Modellwinkel nach dem Elektronenpaarabstoßungsmodell.
  D.MOLEKUELE = [
    { id: 'h2', name: 'Wasserstoff', atome: [['H', -40, 0], ['H', 40, 0]], bindungen: [[0, 1, 1]] },
    { id: 'o2', name: 'Sauerstoff', atome: [['O', -45, 0], ['O', 45, 0]], bindungen: [[0, 1, 2]] },
    { id: 'n2', name: 'Stickstoff', atome: [['N', -45, 0], ['N', 45, 0]], bindungen: [[0, 1, 3]] },
    { id: 'cl2', name: 'Chlor', atome: [['Cl', -50, 0], ['Cl', 50, 0]], bindungen: [[0, 1, 1]] },
    { id: 'f2', name: 'Fluor', atome: [['F', -45, 0], ['F', 45, 0]], bindungen: [[0, 1, 1]] },
    { id: 'hcl', name: 'Chlorwasserstoff', atome: [['H', -45, 0], ['Cl', 45, 0]], bindungen: [[0, 1, 1]] },
    { id: 'hf', name: 'Fluorwasserstoff', atome: [['H', -40, 0], ['F', 40, 0]], bindungen: [[0, 1, 1]] },
    { id: 'h2o', name: 'Wasser', winkel: 104.5, atome: [['O', 0, -20], ['H', -64, 30], ['H', 64, 30]], bindungen: [[0, 1, 1], [0, 2, 1]] },
    { id: 'h2s', name: 'Schwefelwasserstoff', winkel: 92.1, atome: [['S', 0, -20], ['H', -58, 42], ['H', 58, 42]], bindungen: [[0, 1, 1], [0, 2, 1]] },
    { id: 'nh3', name: 'Ammoniak', winkel: 106.7, atome: [['N', 0, -10], ['H', -70, 30], ['H', 70, 30], ['H', 0, 70]], bindungen: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
    { id: 'ch4', name: 'Methan', winkel: 109.5, atome: [['C', 0, 0], ['H', -70, 0], ['H', 70, 0], ['H', 0, -70], ['H', 0, 70]], bindungen: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
    { id: 'co2', name: 'Kohlenstoffdioxid', winkel: 180, atome: [['O', -90, 0], ['C', 0, 0], ['O', 90, 0]], bindungen: [[0, 1, 2], [1, 2, 2]] },
    { id: 'ch2o', name: 'Methanal (Formaldehyd)', atome: [['C', 0, 0], ['O', 0, -80], ['H', -65, 45], ['H', 65, 45]], bindungen: [[0, 1, 2], [0, 2, 1], [0, 3, 1]] },
    { id: 'h2o2', name: 'Wasserstoffperoxid', atome: [['O', -40, 0], ['O', 40, 0], ['H', -80, 55], ['H', 80, -55]], bindungen: [[0, 1, 1], [0, 2, 1], [1, 3, 1]] },
    { id: 'c2h6', name: 'Ethan', atome: [['C', -45, 0], ['C', 45, 0], ['H', -45, -70], ['H', -45, 70], ['H', -115, 0], ['H', 45, -70], ['H', 45, 70], ['H', 115, 0]],
      bindungen: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1]] },
    { id: 'c2h4', name: 'Ethen', atome: [['C', -40, 0], ['C', 40, 0], ['H', -90, -55], ['H', -90, 55], ['H', 90, -55], ['H', 90, 55]],
      bindungen: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]] },
    { id: 'c2h2', name: 'Ethin', atome: [['H', -130, 0], ['C', -45, 0], ['C', 45, 0], ['H', 130, 0]], bindungen: [[0, 1, 1], [1, 2, 3], [2, 3, 1]] },
    { id: 'ch3oh', name: 'Methanol', atome: [['C', -40, 0], ['O', 50, 0], ['H', -40, -70], ['H', -40, 70], ['H', -110, 0], ['H', 100, -50]],
      bindungen: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1]] },
    { id: 'c2h5oh', name: 'Ethanol', atome: [['C', -90, 0], ['C', 0, 0], ['O', 90, 0], ['H', -90, -70], ['H', -90, 70], ['H', -160, 0], ['H', 0, -70], ['H', 0, 70], ['H', 140, -50]],
      bindungen: [[0, 1, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [1, 2, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1]] },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
