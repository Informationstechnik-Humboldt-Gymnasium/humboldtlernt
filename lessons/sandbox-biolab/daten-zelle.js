// BioLab · Inhalte zum Modul Zellbiologie (nur Daten)
// sichtbar: 'LM' = im Lichtmikroskop erkennbar, 'EM' = nur im Elektronenmikroskop
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});
  BL.organellen = [
    { id: 'zellwand', name: 'Zellwand', pflanze: true, tier: false, sichtbar: 'LM', text: 'Feste Hülle aus Cellulose außerhalb der Zellmembran. Sie gibt der Pflanzenzelle Form und Halt und verhindert, dass sie bei Wasseraufnahme platzt.' },
    { id: 'zellmembran', name: 'Zellmembran', pflanze: true, tier: true, sichtbar: 'LM', text: 'Dünne Hülle, die das Zellplasma umschließt. Sie ist halbdurchlässig: Wasser gelangt leicht hindurch, viele gelöste Stoffe nur über besondere Transportwege.' },
    { id: 'zellplasma', name: 'Zellplasma', pflanze: true, tier: true, sichtbar: 'LM', text: 'Zähflüssige Grundsubstanz, in der die Organellen liegen. Hier laufen viele Stoffwechselvorgänge ab.' },
    { id: 'zellkern', name: 'Zellkern', pflanze: true, tier: true, sichtbar: 'LM', text: 'Steuerzentrale der Zelle. Enthält die Erbinformation (DNA). Er ist von einer doppelten Kernhülle mit Poren umgeben.' },
    { id: 'kernkoerperchen', name: 'Kernkörperchen', pflanze: true, tier: true, sichtbar: 'LM', text: 'Dichter Bereich im Zellkern, in dem Bestandteile der Ribosomen gebildet werden.' },
    { id: 'mitochondrium', name: 'Mitochondrien', pflanze: true, tier: true, sichtbar: 'LM', text: 'Ort der Zellatmung: Traubenzucker wird mit Sauerstoff abgebaut, dabei wird Energie für die Zelle frei. Im Lichtmikroskop nur als winzige Körnchen zu sehen, die gefaltete Innenmembran erst im Elektronenmikroskop.' },
    { id: 'chloroplast', name: 'Chloroplasten', pflanze: true, tier: false, sichtbar: 'LM', text: 'Ort der Fotosynthese. Sie enthalten den grünen Farbstoff Chlorophyll in gestapelten Membranen.' },
    { id: 'vakuole', name: 'Vakuole', pflanze: true, tier: false, sichtbar: 'LM', text: 'Großer, mit Zellsaft gefüllter Raum. Sie speichert Wasser und Stoffe und hält die Zelle durch ihren Innendruck prall. Tierzellen haben höchstens kleine Bläschen.' },
    { id: 'er', name: 'Endoplasmatisches Retikulum', pflanze: true, tier: true, sichtbar: 'EM', text: 'Netz aus Membranen. Mit Ribosomen besetzt (raues ER) stellt es Eiweiße her und transportiert sie.' },
    { id: 'golgi', name: 'Golgi-Apparat', pflanze: true, tier: true, sichtbar: 'EM', text: 'Stapel flacher Membransäckchen. Hier werden Stoffe verändert, sortiert und in Bläschen verpackt.' },
    { id: 'ribosom', name: 'Ribosomen', pflanze: true, tier: true, sichtbar: 'EM', text: 'Winzige Körnchen, an denen nach der Bauanleitung aus dem Zellkern Eiweiße zusammengesetzt werden.' },
  ];
})(typeof window !== 'undefined' ? window : this);
