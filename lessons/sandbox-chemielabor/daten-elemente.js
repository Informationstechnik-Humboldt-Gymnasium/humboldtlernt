// Atom- & Chemielabor · Quelldaten der 118 Elemente (nur Daten, keine Rechen- oder Darstellungslogik)
//
// Diese Datei ist die EINZIGE Stelle, an der Elementdaten gepflegt werden. Periodensystem, Atomlabor,
// Isotopenlabor, Energielabor, Moleküllabor und Formellabor lesen alle hieraus (über CL.chemie).
//
// Felder je Element (Reihenfolge im Array):
//   0 symbol      Elementsymbol nach IUPAC
//   1 name        deutscher Name (Schreibweise nach IUPAC/GDCh-Empfehlung, z. B. „Bismut“, „Iod“, „Tenness“)
//   2 masse       Zahl  = relative Atommasse A_r (einheitenlos; zahlengleich mit der molaren Masse in g/mol).
//                         Quelle: IUPAC/CIAAW, gekürzte Standardatomgewichte („abridged“, Tabelle 2021) –
//                         TABELLIERTE Werte. Bei Elementen mit Intervall (H, C, N, O, …) ist der Konventionswert angegeben.
//                 Text  = „[A]“: Element ohne stabiles Isotop und ohne Standardatomgewicht. A ist die Massenzahl
//                         eines langlebigen Isotops; je nach Tabelle werden hier verschiedene Isotope genannt.
//                         Das ist KEINE Atommasse und wird für Molmassen nicht verwendet.
//   3 kategorie   Stoffklasse für das Periodensystem (Schlüssel siehe KATEGORIEN)
//   4 zustand     Aggregatzustand des Elements bei 20 °C und 1013 hPa: 's' fest, 'l' flüssig, 'g' gasförmig,
//                 null = nicht zuverlässig bekannt (nie in wägbarer Menge hergestellt oder sehr unsicher).
//   5 isotop      Massenzahl des häufigsten natürlich vorkommenden Isotops (aus den IUPAC-Isotopenhäufigkeiten,
//                 TABELLIERT), null = Element hat keine natürlichen Isotope in nennenswerter Häufigkeit.
//
// Nicht hier: Elektronenkonfigurationen (siehe daten-konfiguration in chemie.js: Aufbauprinzip + Ausnahmeliste nach NIST),
// Ionisierungsenergien (IONISIERUNG unten, nur Z = 1–36), Nukliddaten (daten-nuklide.js).
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var D = CL.daten || (CL.daten = {});

  D.KATEGORIEN = {
    nm: 'Nichtmetall', ha: 'Halogen', eg: 'Edelgas', am: 'Alkalimetall', eam: 'Erdalkalimetall',
    um: 'Übergangsmetall', mt: 'Metall (Hauptgruppe)', hm: 'Halbmetall', la: 'Lanthanoid', ac: 'Actinoid',
  };

  /* eslint-disable */
  D.ELEMENTE = [
    ['H', 'Wasserstoff', 1.0080, 'nm', 'g', 1],
    ['He', 'Helium', 4.0026, 'eg', 'g', 4],
    ['Li', 'Lithium', 6.94, 'am', 's', 7],
    ['Be', 'Beryllium', 9.0122, 'eam', 's', 9],
    ['B', 'Bor', 10.81, 'hm', 's', 11],
    ['C', 'Kohlenstoff', 12.011, 'nm', 's', 12],
    ['N', 'Stickstoff', 14.007, 'nm', 'g', 14],
    ['O', 'Sauerstoff', 15.999, 'nm', 'g', 16],
    ['F', 'Fluor', 18.998, 'ha', 'g', 19],
    ['Ne', 'Neon', 20.180, 'eg', 'g', 20],
    ['Na', 'Natrium', 22.990, 'am', 's', 23],
    ['Mg', 'Magnesium', 24.305, 'eam', 's', 24],
    ['Al', 'Aluminium', 26.982, 'mt', 's', 27],
    ['Si', 'Silicium', 28.085, 'hm', 's', 28],
    ['P', 'Phosphor', 30.974, 'nm', 's', 31],
    ['S', 'Schwefel', 32.06, 'nm', 's', 32],
    ['Cl', 'Chlor', 35.45, 'ha', 'g', 35],
    ['Ar', 'Argon', 39.95, 'eg', 'g', 40],
    ['K', 'Kalium', 39.098, 'am', 's', 39],
    ['Ca', 'Calcium', 40.078, 'eam', 's', 40],
    ['Sc', 'Scandium', 44.956, 'um', 's', 45],
    ['Ti', 'Titan', 47.867, 'um', 's', 48],
    ['V', 'Vanadium', 50.942, 'um', 's', 51],
    ['Cr', 'Chrom', 51.996, 'um', 's', 52],
    ['Mn', 'Mangan', 54.938, 'um', 's', 55],
    ['Fe', 'Eisen', 55.845, 'um', 's', 56],
    ['Co', 'Cobalt', 58.933, 'um', 's', 59],
    ['Ni', 'Nickel', 58.693, 'um', 's', 58],
    ['Cu', 'Kupfer', 63.546, 'um', 's', 63],
    ['Zn', 'Zink', 65.38, 'um', 's', 64],
    ['Ga', 'Gallium', 69.723, 'mt', 's', 69],
    ['Ge', 'Germanium', 72.630, 'hm', 's', 74],
    ['As', 'Arsen', 74.922, 'hm', 's', 75],
    ['Se', 'Selen', 78.971, 'nm', 's', 80],
    ['Br', 'Brom', 79.904, 'ha', 'l', 79],
    ['Kr', 'Krypton', 83.798, 'eg', 'g', 84],
    ['Rb', 'Rubidium', 85.468, 'am', 's', 85],
    ['Sr', 'Strontium', 87.62, 'eam', 's', 88],
    ['Y', 'Yttrium', 88.906, 'um', 's', 89],
    ['Zr', 'Zirconium', 91.224, 'um', 's', 90],
    ['Nb', 'Niob', 92.906, 'um', 's', 93],
    ['Mo', 'Molybdän', 95.95, 'um', 's', 98],
    ['Tc', 'Technetium', '[97]', 'um', 's', null],
    ['Ru', 'Ruthenium', 101.07, 'um', 's', 102],
    ['Rh', 'Rhodium', 102.91, 'um', 's', 103],
    ['Pd', 'Palladium', 106.42, 'um', 's', 106],
    ['Ag', 'Silber', 107.87, 'um', 's', 107],
    ['Cd', 'Cadmium', 112.41, 'um', 's', 114],
    ['In', 'Indium', 114.82, 'mt', 's', 115],
    ['Sn', 'Zinn', 118.71, 'mt', 's', 120],
    ['Sb', 'Antimon', 121.76, 'hm', 's', 121],
    ['Te', 'Tellur', 127.60, 'hm', 's', 130],
    ['I', 'Iod', 126.90, 'ha', 's', 127],
    ['Xe', 'Xenon', 131.29, 'eg', 'g', 132],
    ['Cs', 'Caesium', 132.91, 'am', 's', 133],
    ['Ba', 'Barium', 137.33, 'eam', 's', 138],
    ['La', 'Lanthan', 138.91, 'la', 's', 139],
    ['Ce', 'Cer', 140.12, 'la', 's', 140],
    ['Pr', 'Praseodym', 140.91, 'la', 's', 141],
    ['Nd', 'Neodym', 144.24, 'la', 's', 142],
    ['Pm', 'Promethium', '[145]', 'la', 's', null],
    ['Sm', 'Samarium', 150.36, 'la', 's', 152],
    ['Eu', 'Europium', 151.96, 'la', 's', 153],
    ['Gd', 'Gadolinium', 157.25, 'la', 's', 158],
    ['Tb', 'Terbium', 158.93, 'la', 's', 159],
    ['Dy', 'Dysprosium', 162.50, 'la', 's', 164],
    ['Ho', 'Holmium', 164.93, 'la', 's', 165],
    ['Er', 'Erbium', 167.26, 'la', 's', 166],
    ['Tm', 'Thulium', 168.93, 'la', 's', 169],
    ['Yb', 'Ytterbium', 173.05, 'la', 's', 174],
    ['Lu', 'Lutetium', 174.97, 'la', 's', 175],
    ['Hf', 'Hafnium', 178.49, 'um', 's', 180],
    ['Ta', 'Tantal', 180.95, 'um', 's', 181],
    ['W', 'Wolfram', 183.84, 'um', 's', 184],
    ['Re', 'Rhenium', 186.21, 'um', 's', 187],
    ['Os', 'Osmium', 190.23, 'um', 's', 192],
    ['Ir', 'Iridium', 192.22, 'um', 's', 193],
    ['Pt', 'Platin', 195.08, 'um', 's', 195],
    ['Au', 'Gold', 196.97, 'um', 's', 197],
    ['Hg', 'Quecksilber', 200.59, 'um', 'l', 202],
    ['Tl', 'Thallium', 204.38, 'mt', 's', 205],
    ['Pb', 'Blei', 207.2, 'mt', 's', 208],
    ['Bi', 'Bismut', 208.98, 'mt', 's', 209],
    ['Po', 'Polonium', '[209]', 'mt', 's', null],
    ['At', 'Astat', '[210]', 'ha', null, null],
    ['Rn', 'Radon', '[222]', 'eg', 'g', null],
    ['Fr', 'Francium', '[223]', 'am', null, null],
    ['Ra', 'Radium', '[226]', 'eam', 's', null],
    ['Ac', 'Actinium', '[227]', 'ac', 's', null],
    ['Th', 'Thorium', 232.04, 'ac', 's', 232],
    ['Pa', 'Protactinium', 231.04, 'ac', 's', 231],
    ['U', 'Uran', 238.03, 'ac', 's', 238],
    ['Np', 'Neptunium', '[237]', 'ac', 's', null],
    ['Pu', 'Plutonium', '[244]', 'ac', 's', null],
    ['Am', 'Americium', '[243]', 'ac', 's', null],
    ['Cm', 'Curium', '[247]', 'ac', 's', null],
    ['Bk', 'Berkelium', '[247]', 'ac', 's', null],
    ['Cf', 'Californium', '[251]', 'ac', 's', null],
    ['Es', 'Einsteinium', '[252]', 'ac', 's', null],
    ['Fm', 'Fermium', '[257]', 'ac', null, null],
    ['Md', 'Mendelevium', '[258]', 'ac', null, null],
    ['No', 'Nobelium', '[259]', 'ac', null, null],
    ['Lr', 'Lawrencium', '[262]', 'ac', null, null],
    ['Rf', 'Rutherfordium', '[267]', 'um', null, null],
    ['Db', 'Dubnium', '[268]', 'um', null, null],
    ['Sg', 'Seaborgium', '[269]', 'um', null, null],
    ['Bh', 'Bohrium', '[270]', 'um', null, null],
    ['Hs', 'Hassium', '[269]', 'um', null, null],
    ['Mt', 'Meitnerium', '[278]', 'um', null, null],
    ['Ds', 'Darmstadtium', '[281]', 'um', null, null],
    ['Rg', 'Roentgenium', '[282]', 'um', null, null],
    ['Cn', 'Copernicium', '[285]', 'um', null, null],
    ['Nh', 'Nihonium', '[286]', 'mt', null, null],
    ['Fl', 'Flerovium', '[289]', 'mt', null, null],
    ['Mc', 'Moscovium', '[290]', 'mt', null, null],
    ['Lv', 'Livermorium', '[293]', 'mt', null, null],
    ['Ts', 'Tenness', '[294]', 'ha', null, null],
    ['Og', 'Oganesson', '[294]', 'eg', null, null],
  ];
  /* eslint-enable */

  // Ab dieser Ordnungszahl wurden nur einzelne Atome erzeugt: Stoffeigenschaften (Zustand, Stoffklasse im
  // chemischen Sinn) sind nicht gemessen; die Stoffklasse folgt nur aus der Stellung im Periodensystem.
  D.NUR_EINZELNE_ATOME_AB = 100;

  // Erste Ionisierungsenergie E_I in eV (Elektronenvolt), GEMESSEN. Quelle: NIST Atomic Spectra Database,
  // „Ground States and Ionization Energies“, auf zwei Nachkommastellen gerundet.
  // Bewusst nur Z = 1–36 hinterlegt; für alle anderen Elemente zeigt das Labor „im Labor nicht hinterlegt“.
  D.IONISIERUNG = [
    13.60, 24.59, 5.39, 9.32, 8.30, 11.26, 14.53, 13.62, 17.42, 21.56,
    5.14, 7.65, 5.99, 8.15, 10.49, 10.36, 12.97, 15.76, 4.34, 6.11,
    6.56, 6.83, 6.75, 6.77, 7.43, 7.90, 7.88, 7.64, 7.73, 9.39,
    6.00, 7.90, 9.79, 9.75, 11.81, 14.00,
  ];

  // Elektronenkonfigurationen im Grundzustand, die vom Aufbauprinzip (Madelung-Regel) abweichen.
  // Quelle: NIST Atomic Spectra Database (Ground States). Angegeben als Besetzung der Unterschalen.
  D.KONFIG_AUSNAHMEN = {
    24: { '3d': 5, '4s': 1 },              // Cr
    29: { '3d': 10, '4s': 1 },             // Cu
    41: { '4d': 4, '5s': 1 },              // Nb
    42: { '4d': 5, '5s': 1 },              // Mo
    44: { '4d': 7, '5s': 1 },              // Ru
    45: { '4d': 8, '5s': 1 },              // Rh
    46: { '4d': 10, '5s': 0 },             // Pd
    47: { '4d': 10, '5s': 1 },             // Ag
    57: { '4f': 0, '5d': 1 },              // La
    58: { '4f': 1, '5d': 1 },              // Ce
    64: { '4f': 7, '5d': 1 },              // Gd
    78: { '5d': 9, '6s': 1 },              // Pt
    79: { '5d': 10, '6s': 1 },             // Au
    89: { '5f': 0, '6d': 1 },              // Ac
    90: { '5f': 0, '6d': 2 },              // Th
    91: { '5f': 2, '6d': 1 },              // Pa
    92: { '5f': 3, '6d': 1 },              // U
    93: { '5f': 4, '6d': 1 },              // Np
    96: { '5f': 7, '6d': 1 },              // Cm
    103: { '6d': 0, '7p': 1 },             // Lr
  };
  // Ab dieser Ordnungszahl sind Grundzustandskonfigurationen nicht experimentell bestimmt, sondern berechnet/vorhergesagt.
  D.KONFIG_VORHERGESAGT_AB = 100;
})(typeof window !== 'undefined' ? window : globalThis);
