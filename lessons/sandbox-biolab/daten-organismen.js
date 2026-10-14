// BioLab · Inhalte zum Modul Mikroorganismen (nur Daten)
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});

  BL.organismen = {
    amoebe: {
      name: 'Amöbe (Wechseltierchen)', groesse: 'bis etwa 0,5 mm',
      text: 'Einzeller ohne feste Form. Die Amöbe bewegt sich, indem Zellplasma in Ausstülpungen fließt, und umfließt so auch ihre Nahrung.',
      strukturen: {
        zellmembran: { name: 'Zellmembran', text: 'Begrenzt die Zelle. Weil es keine feste Zellwand gibt, kann die Amöbe ständig ihre Form ändern.' },
        zellplasma: { name: 'Zellplasma', text: 'Außen etwas zähflüssiger, innen flüssiger. Das innere Plasma strömt in die Scheinfüßchen nach.' },
        zellkern: { name: 'Zellkern', text: 'Steuert die Lebensvorgänge der Zelle und enthält die Erbinformation.' },
        scheinfuesschen: { name: 'Scheinfüßchen', text: 'Ausstülpungen der Zelle, in die Zellplasma fließt. Mit ihnen kriecht die Amöbe und umschließt Nahrung.' },
        nahrungsvakuole: { name: 'Nahrungsvakuole', text: 'Bläschen mit aufgenommener Nahrung, z. B. Bakterien oder Algen. Die Nahrung wird darin verdaut, unverdauliche Reste werden ausgeschieden.' },
        pulsierende_vakuole: { name: 'Pulsierende Vakuole', text: 'Sammelt Wasser, das ständig in die Zelle eindringt, und gibt es regelmäßig nach außen ab. Sonst würde die Zelle platzen.' },
      },
    },
    pantoffeltierchen: {
      name: 'Pantoffeltierchen', groesse: 'etwa 0,2 bis 0,3 mm',
      text: 'Einzeller mit fester Form, der sich mit Tausenden Wimpern schnell fortbewegt. Er strudelt Bakterien in sein Mundfeld.',
      strukturen: {
        wimpern: { name: 'Wimpern', text: 'Feine Härchen auf der ganzen Oberfläche. Sie schlagen nicht gleichzeitig, sondern in Wellen nacheinander – wie bei einem Kornfeld im Wind.' },
        zellmembran: { name: 'Zellmembran mit Pellicula', text: 'Eine feste, aber biegsame Hülle unter der Zellmembran gibt die typische Schuhsohlen-Form.' },
        mundfeld: { name: 'Mundfeld und Zellmund', text: 'Wimpern strudeln Nahrungsteilchen in diese Einbuchtung. Am Ende des Zellschlunds entsteht daraus eine Nahrungsvakuole.' },
        nahrungsvakuole: { name: 'Nahrungsvakuole', text: 'Wandert mit dem Zellplasma durch die Zelle. Erst wird ihr Inhalt sauer, dann wird er verdaut; die Reste werden am Zellafter abgegeben.' },
        zellafter: { name: 'Zellafter', text: 'Feste Stelle an der Oberfläche, an der unverdauliche Reste ausgeschieden werden.' },
        grosskern: { name: 'Großkern', text: 'Steuert den Stoffwechsel der Zelle.' },
        kleinkern: { name: 'Kleinkern', text: 'Wichtig für die Weitergabe der Erbinformation bei der Fortpflanzung.' },
        pulsierende_vakuole: { name: 'Pulsierende Vakuole', text: 'Zwei sternförmige Organellen. Zuführende Kanäle sammeln Wasser, die Blase pumpt es nach außen. Die beiden arbeiten abwechselnd.' },
      },
      kongorot: 'Versuch: Hefezellen werden mit dem Farbstoff Kongorot angefärbt und verfüttert. Kongorot ist rot und wird in Säure blau. In jungen Nahrungsvakuolen färbt sich die Hefe blau – der Inhalt wird angesäuert. Später wird sie wieder rot, wenn die Verdauung weiterläuft.',
    },
    euglena: {
      name: 'Augentierchen (Euglena)', groesse: 'etwa 0,05 mm',
      text: 'Einzeller mit Chloroplasten, der sich mit einer Geißel bewegt. Er kann Fotosynthese betreiben, im Dunkeln aber auch Nährstoffe aus dem Wasser aufnehmen.',
      strukturen: {
        geissel: { name: 'Geißel', text: 'Langer Faden, der schraubenförmig schlägt und den Einzeller vorwärts zieht.' },
        augenfleck: { name: 'Augenfleck', text: 'Roter Farbfleck nahe der Geißelbasis. Er beschattet bei bestimmten Lichtrichtungen einen lichtempfindlichen Bereich der Geißel. So kann Euglena die Richtung des Lichts erkennen.' },
        chloroplast: { name: 'Chloroplasten', text: 'Hier findet die Fotosynthese statt. Ihretwegen ist Euglena grün.' },
        zellkern: { name: 'Zellkern', text: 'Steuert die Zelle und enthält die Erbinformation.' },
        pulsierende_vakuole: { name: 'Pulsierende Vakuole', text: 'Gibt überschüssiges Wasser in das Geißelsäckchen ab.' },
        paramylon: { name: 'Paramylonkörner', text: 'Speicherstoff, ähnlich der Stärke, aus den Produkten der Fotosynthese.' },
        geisselsaeckchen: { name: 'Geißelsäckchen', text: 'Einstülpung am Vorderende, aus der die Geißel herausragt.' },
      },
      licht: 'Lichtversuch: Euglena schwimmt zum Licht (positive Fototaxis), weil sie dort Fotosynthese betreiben kann. Im Dunkeln schwimmt sie ungerichtet. Sehr grelles Licht meidet sie in Wirklichkeit; das ist hier nicht nachgebildet.',
    },
    bakterien: {
      name: 'Bakterien', groesse: 'meist 0,5 bis 5 µm',
      text: 'Einzellige Lebewesen ohne Zellkern (Prokaryoten). Sie unterscheiden sich in Form und Anordnung.',
      strukturen: {
        zellwand: { name: 'Zellwand', text: 'Feste Hülle, die Form gibt und schützt. Viele Antibiotika greifen sie an.' },
        zellmembran: { name: 'Zellmembran', text: 'Grenzt das Zellplasma ab und regelt den Stofftransport.' },
        zellplasma: { name: 'Zellplasma', text: 'Hier laufen die Stoffwechselvorgänge ab.' },
        chromosom: { name: 'Bakterienchromosom', text: 'Ringförmige DNA, frei im Zellplasma – es gibt keinen Zellkern.' },
        plasmid: { name: 'Plasmide', text: 'Kleine DNA-Ringe mit zusätzlichen Genen, z. B. für eine Antibiotikaresistenz. Sie können zwischen Bakterien weitergegeben werden.' },
        ribosom: { name: 'Ribosomen', text: 'Winzige Körnchen, an denen Eiweiße hergestellt werden. Sie sind kleiner als die Ribosomen in Pflanzen- und Tierzellen.' },
        geissel: { name: 'Geißel', text: 'Fortbewegungsorgan, das sich wie ein Propeller dreht. Nicht alle Bakterien haben eine.' },
        kapsel: { name: 'Schleimkapsel', text: 'Schützende Schleimschicht bei manchen Bakterien, z. B. gegen Fresszellen.' },
        pili: { name: 'Pili (Fimbrien)', text: 'Feine Härchen, mit denen sich Bakterien an Oberflächen festhalten.' },
      },
      formen: [
        { id: 'kokken', name: 'Kugelbakterien (Kokken)', beispiel: 'Einzeln liegende Kokken, z. B. bei manchen Hautbakterien', text: 'Kugelförmig, etwa 1 µm.' },
        { id: 'diplokokken', name: 'Diplokokken', beispiel: 'z. B. Erreger der Hirnhautentzündung (Meningokokken)', text: 'Kokken, die zu zweit zusammenbleiben.' },
        { id: 'streptokokken', name: 'Streptokokken', beispiel: 'z. B. Erreger von Scharlach; Joghurtbakterien', text: 'Kokken in Ketten – sie teilen sich immer in derselben Richtung.' },
        { id: 'staphylokokken', name: 'Staphylokokken', beispiel: 'z. B. Staphylococcus aureus, Erreger von Wundinfektionen', text: 'Kokken in traubenartigen Haufen – sie teilen sich in wechselnden Richtungen.' },
        { id: 'staebchen', name: 'Stäbchenbakterien', beispiel: 'z. B. Escherichia coli im Darm, Salmonellen', text: 'Länglich, etwa 1 × 2 bis 3 µm; viele tragen Geißeln.' },
        { id: 'vibrionen', name: 'Vibrionen', beispiel: 'z. B. Erreger der Cholera', text: 'Kommaförmig gekrümmte Stäbchen mit einer Geißel.' },
        { id: 'spirillen', name: 'Schraubenbakterien (Spirillen)', beispiel: 'z. B. Spirillum-Arten in Gewässern', text: 'Starr schraubenförmig gewunden.' },
      ],
    },
  };

  // Größen für den Größenvergleich (typische Werte, gerundet)
  BL.groessen = [
    { id: 'virus', name: 'Grippevirus', um: 0.1, form: 'virus', text: 'etwa 100 nm' },
    { id: 'bakterium', name: 'Bakterium (E. coli)', um: 2, form: 'stab', text: 'etwa 2 µm lang' },
    { id: 'ery', name: 'Rotes Blutkörperchen', um: 7.5, form: 'scheibe', text: 'etwa 7,5 µm' },
    { id: 'hefe', name: 'Hefezelle', um: 6, form: 'oval', text: 'etwa 5 bis 10 µm' },
    { id: 'euglena', name: 'Euglena', um: 50, form: 'spindel', text: 'etwa 50 µm' },
    { id: 'haar', name: 'Dicke eines Haares', um: 70, form: 'haar', text: 'etwa 50 bis 100 µm' },
    { id: 'pantoffel', name: 'Pantoffeltierchen', um: 250, form: 'pantoffel', text: 'etwa 0,2 bis 0,3 mm' },
    { id: 'amoebe', name: 'Amöbe (Amoeba proteus)', um: 500, form: 'amoebe', text: 'bis etwa 0,5 mm' },
    { id: 'wasserfloh', name: 'Wasserfloh', um: 2000, form: 'floh', text: 'etwa 1 bis 3 mm' },
  ];
  BL.grenzen = [
    { name: 'Auge', um: 100, text: 'Mit bloßem Auge erkennt man Dinge ab etwa 0,1 mm.' },
    { name: 'Lichtmikroskop', um: 0.2, text: 'Das Lichtmikroskop löst bis etwa 0,2 µm auf.' },
    { name: 'Elektronenmikroskop', um: 0.001, text: 'Elektronenmikroskope lösen bis unter 1 nm auf – damit sieht man Viren.' },
  ];
})(typeof window !== 'undefined' ? window : this);
