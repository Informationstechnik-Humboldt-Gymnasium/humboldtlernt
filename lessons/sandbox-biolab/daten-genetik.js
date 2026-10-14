// BioLab · Inhalte zum Modul Genetik (nur Daten)
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});
  BL.dnaTeile = {
    phosphat: { name: 'Phosphat', text: 'Teil des Rückgrats jedes Strangs. Phosphat und Zucker wechseln sich ab wie die Holme einer Strickleiter.' },
    zucker: { name: 'Zucker (Desoxyribose)', text: 'Der Zucker der DNA. An jedem Zucker hängt eine Base. Er gibt der DNA ihren Namen: Desoxyribonukleinsäure.' },
    A: { name: 'Adenin (A)', text: 'Base, die sich immer mit Thymin paart – über zwei Wasserstoffbrücken.' },
    T: { name: 'Thymin (T)', text: 'Base, die sich immer mit Adenin paart – über zwei Wasserstoffbrücken.' },
    G: { name: 'Guanin (G)', text: 'Base, die sich immer mit Cytosin paart – über drei Wasserstoffbrücken.' },
    C: { name: 'Cytosin (C)', text: 'Base, die sich immer mit Guanin paart – über drei Wasserstoffbrücken.' },
    bruecke: { name: 'Wasserstoffbrücken', text: 'Schwache Bindungen zwischen den Basen der beiden Stränge. Sie halten die Stränge zusammen, lassen sich aber zum Kopieren der DNA leicht lösen.' },
    nukleotid: { name: 'Nukleotid', text: 'Ein Baustein der DNA aus Phosphat, Zucker und einer Base. Die Reihenfolge der Basen ist die Erbinformation.' },
  };
  BL.erbgangGrenzen = [
    'Das Modell betrachtet nur ein einziges Gen. Viele Merkmale – etwa Augenfarbe oder Körpergröße – hängen von vielen Genen und auch von der Umwelt ab.',
    'Die Prozente sind Wahrscheinlichkeiten für jedes einzelne Kind. Sie sagen nicht voraus, wie viele Kinder einer Familie ein Merkmal haben werden. Auch nach drei Kindern mit demselben Merkmal ist die Wahrscheinlichkeit beim vierten unverändert.',
    'Die Erbsenfarbe ist ein klassisches Beispiel aus Mendels Versuchen. Beim Menschen sind echte Erbgänge oft verwickelter, als einfache Schemata zeigen.',
  ];
})(typeof window !== 'undefined' ? window : this);
