// BioLab · Inhalte zum Modul Viren (nur Daten). Größen sind typische Werte aus Lehrbüchern, gerundet.
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});

  BL.viren = [
    {
      id: 't4', name: 'Bakteriophage T4', kurz: 'Bakteriophage',
      groesse: 'Kopf etwa 90 × 110 nm, insgesamt etwa 200 nm lang', nm: 200,
      erbgut: 'DNA (doppelsträngig)', huelle: false, wirt: 'Darmbakterium Escherichia coli', krankheit: 'Befällt nur Bakterien, nicht den Menschen.',
      text: 'Bakteriophagen („Bakterienfresser“) sind Viren, die Bakterien befallen. Mit ihren Schwanzfasern setzen sie sich auf der Bakterienwand fest und spritzen ihre DNA hinein.',
      strukturen: {
        kopf: { name: 'Kopf (Kapsid)', text: 'Hülle aus Eiweißbausteinen in Form eines lang gestreckten Zwanzigflächners. Sie schützt die DNA.' },
        dna: { name: 'DNA', text: 'Die Erbinformation des Phagen. Sie enthält die Bauanleitung für neue Phagen.' },
        kragen: { name: 'Kragen', text: 'Verbindung zwischen Kopf und Schwanz.' },
        schwanz: { name: 'Schwanz mit Scheide', text: 'Hohles Rohr in einer zusammenziehbaren Eiweißscheide. Zieht sich die Scheide zusammen, wird das Rohr durch die Bakterienwand gedrückt.' },
        grundplatte: { name: 'Grundplatte', text: 'Sitzt am Ende des Schwanzes auf der Bakterienwand auf.' },
        fasern: { name: 'Schwanzfasern', text: 'Lange Fasern, die passende Stellen auf der Oberfläche des Bakteriums erkennen und sich dort anheften.' },
      },
    },
    {
      id: 'influenza', name: 'Grippevirus (Influenzavirus)', kurz: 'Grippevirus',
      groesse: 'etwa 80 bis 120 nm', nm: 100,
      erbgut: 'RNA (8 einzelne Abschnitte)', huelle: true, wirt: 'Zellen der Atemwege von Menschen und Tieren', krankheit: 'Grippe (Influenza)',
      text: 'Behülltes Virus. Seine Hülle stammt von der Zellmembran der Zelle, in der es entstanden ist. Zwei Sorten von Oberflächenproteinen ragen heraus.',
      strukturen: {
        huelle: { name: 'Virushülle', text: 'Doppelschicht aus Fett (Lipid), die das Virus beim Verlassen der Wirtszelle von deren Zellmembran mitnimmt.' },
        haemagglutinin: { name: 'Hämagglutinin (H)', text: 'Stäbchenförmiges Oberflächenprotein. Es bindet an passende Empfänger auf der Wirtszelle – so heftet sich das Virus an.' },
        neuraminidase: { name: 'Neuraminidase (N)', text: 'Pilzförmiges Oberflächenprotein. Es löst neue Viren von der Wirtszelle ab. Die Buchstaben H und N stehen in Namen wie H1N1.' },
        matrix: { name: 'Matrixprotein', text: 'Eiweißschicht unter der Hülle, die dem Virus Form gibt.' },
        rna: { name: 'RNA mit Nukleoprotein', text: 'Die Erbinformation liegt in acht einzelnen RNA-Stücken vor, die mit Eiweißen umwickelt sind.' },
      },
    },
    {
      id: 'corona', name: 'Coronavirus SARS-CoV-2', kurz: 'Coronavirus',
      groesse: 'etwa 60 bis 140 nm', nm: 100,
      erbgut: 'RNA (ein sehr langer Strang)', huelle: true, wirt: 'Zellen der Atemwege', krankheit: 'COVID-19',
      text: 'Behülltes Virus mit keulenförmigen Oberflächenproteinen. Im Elektronenmikroskop erinnern sie an einen Kranz (lateinisch corona).',
      strukturen: {
        huelle: { name: 'Virushülle', text: 'Fettdoppelschicht aus der Membran der Wirtszelle.' },
        spike: { name: 'Spike-Protein', text: 'Keulenförmiges Oberflächenprotein, das an einen Empfänger auf Zellen der Atemwege bindet. Viele Impfstoffe bringen dem Immunsystem dieses Protein bei.' },
        membranprotein: { name: 'Membran- und Hüllproteine', text: 'Kleinere Proteine in der Hülle, die beim Zusammenbau neuer Viren helfen.' },
        rna: { name: 'RNA mit Nukleokapsid-Protein', text: 'Ein langer RNA-Strang, umhüllt von Eiweißbausteinen.' },
      },
    },
    {
      id: 'hiv', name: 'HI-Virus (HIV)', kurz: 'HIV',
      groesse: 'etwa 100 bis 120 nm', nm: 110,
      erbgut: 'RNA (zwei gleiche Stränge)', huelle: true, wirt: 'bestimmte Abwehrzellen (T-Helferzellen)', krankheit: 'HIV-Infektion; unbehandelt Aids',
      text: 'Behülltes Virus, das Abwehrzellen des Immunsystems befällt. Es schreibt seine RNA in DNA um und baut sie in die Erbinformation der Wirtszelle ein.',
      strukturen: {
        huelle: { name: 'Virushülle', text: 'Fettdoppelschicht aus der Membran der Wirtszelle.' },
        oberflaechenprotein: { name: 'Oberflächenprotein (gp120)', text: 'Bindet an einen Empfänger auf T-Helferzellen. Darum befällt HIV gezielt diese Abwehrzellen.' },
        matrix: { name: 'Matrixprotein', text: 'Eiweißschicht unter der Hülle.' },
        kapsid: { name: 'Kapsid', text: 'Kegelförmige Eiweißhülle im Inneren, die die RNA umschließt.' },
        rna: { name: 'RNA', text: 'Zwei gleiche RNA-Stränge mit der Erbinformation.' },
        enzym: { name: 'Reverse Transkriptase', text: 'Enzym, das die Virus-RNA in DNA umschreibt. Viele HIV-Medikamente hemmen dieses Enzym.' },
      },
    },
    {
      id: 'adeno', name: 'Adenovirus', kurz: 'Adenovirus',
      groesse: 'etwa 90 nm (ohne Fasern)', nm: 90,
      erbgut: 'DNA (doppelsträngig)', huelle: false, wirt: 'Zellen von Atemwegen, Augen und Darm', krankheit: 'z. B. Erkältungen, Bindehautentzündung',
      text: 'Unbehülltes Virus in Form eines Zwanzigflächners (Ikosaeder). An seinen zwölf Ecken ragen Fasern heraus.',
      strukturen: {
        kapsid: { name: 'Kapsid', text: 'Eiweißhülle aus vielen gleichen Bausteinen, die zu einem Zwanzigflächner zusammengesetzt sind. Es gibt keine Fetthülle.' },
        fasern: { name: 'Fasern', text: 'Stäbchen mit einem Knopf am Ende, die an Empfänger der Wirtszelle binden.' },
        dna: { name: 'DNA', text: 'Die Erbinformation im Inneren.' },
      },
    },
    {
      id: 'tmv', name: 'Tabakmosaikvirus', kurz: 'Tabakmosaikvirus',
      groesse: 'etwa 300 nm lang und 18 nm dick', nm: 300,
      erbgut: 'RNA (ein Strang)', huelle: false, wirt: 'Tabak, Tomaten und andere Pflanzen', krankheit: 'Mosaikartige Flecken auf Blättern',
      text: 'Stäbchenförmiges Pflanzenvirus. Es war 1892 das erste Virus, das entdeckt wurde: Sein Erreger ging durch Filter, die Bakterien zurückhalten.',
      strukturen: {
        kapsid: { name: 'Kapsid aus Proteinbausteinen', text: 'Rund 2000 gleiche Eiweißbausteine sind schraubenförmig um die RNA angeordnet.' },
        rna: { name: 'RNA', text: 'Ein RNA-Strang liegt schraubenförmig zwischen den Proteinbausteinen.' },
      },
    },
  ];

  BL.zyklen = {
    phage: {
      name: 'Bakteriophage befällt ein Bakterium (lytischer Zyklus)',
      schritte: [
        { titel: 'Anheftung', text: 'Die Schwanzfasern erkennen passende Stellen auf der Bakterienwand. Der Phage setzt mit der Grundplatte auf.', dauer: 3 },
        { titel: 'Injektion', text: 'Die Schwanzscheide zieht sich zusammen. Das Rohr durchstößt die Wand, die DNA wird ins Bakterium gespritzt. Die leere Eiweißhülle bleibt draußen.', dauer: 3 },
        { titel: 'Vermehrung', text: 'Die Phagen-DNA übernimmt die Steuerung: Das Bakterium stellt jetzt viele Kopien der Phagen-DNA und die Eiweißbausteine für neue Phagen her.', dauer: 3.5 },
        { titel: 'Zusammenbau', text: 'Aus DNA und Bausteinen setzen sich neue Phagen zusammen – oft mehr als hundert in einem Bakterium.', dauer: 3 },
        { titel: 'Freisetzung', text: 'Ein Enzym löst die Bakterienwand auf. Das Bakterium platzt (Lyse), die neuen Phagen werden frei und können weitere Bakterien befallen. Das alles dauert etwa 20 bis 30 Minuten.', dauer: 3 },
      ],
    },
    grippe: {
      name: 'Grippevirus befällt eine Zelle der Atemwege',
      schritte: [
        { titel: 'Anheftung', text: 'Das Hämagglutinin auf der Virushülle bindet an passende Empfänger auf der Zellmembran.', dauer: 3 },
        { titel: 'Aufnahme', text: 'Die Zelle stülpt ihre Membran um das Virus und nimmt es in einem Bläschen auf.', dauer: 3 },
        { titel: 'Freisetzung der RNA', text: 'Die Virushülle verschmilzt mit der Bläschenmembran. Die RNA-Stücke gelangen ins Zellplasma und weiter in den Zellkern.', dauer: 3 },
        { titel: 'Vermehrung', text: 'Im Zellkern wird die Virus-RNA vielfach kopiert. An den Ribosomen der Zelle entstehen die Virusproteine.', dauer: 3.5 },
        { titel: 'Zusammenbau', text: 'Neue RNA und Virusproteine sammeln sich unter der Zellmembran, in die Hämagglutinin und Neuraminidase eingebaut wurden.', dauer: 3 },
        { titel: 'Knospung', text: 'Neue Viren schnüren sich mit einem Stück Zellmembran als Hülle ab. Die Neuraminidase löst sie von der Zelle. Die befallene Zelle geht später zugrunde.', dauer: 3 },
      ],
    },
  };

  BL.virusBakterium = [
    ['Aufbau', 'Zelle mit Zellwand, Zellmembran, Zellplasma, Ribosomen', 'keine Zelle: Erbinformation in einer Eiweißhülle, manchmal mit Fetthülle'],
    ['Größe', 'etwa 1 bis 5 µm', 'etwa 20 bis 300 nm – also meist 10- bis 100-mal kleiner'],
    ['Sichtbar im', 'Lichtmikroskop (1000-fach, gefärbt)', 'nur Elektronenmikroskop'],
    ['Erbinformation', 'DNA (Bakterienchromosom und Plasmide)', 'DNA oder RNA'],
    ['Stoffwechsel', 'ja, eigener Stoffwechsel', 'nein'],
    ['Vermehrung', 'selbstständig durch Zweiteilung', 'nur in einer Wirtszelle, die die Viren herstellt'],
    ['Lebewesen?', 'ja', 'nein – Viren erfüllen nicht alle Kennzeichen des Lebendigen'],
    ['Mittel dagegen', 'Antibiotika (wirken nicht gegen Viren)', 'Impfungen, bei manchen Viren antivirale Medikamente'],
  ];
})(typeof window !== 'undefined' ? window : this);
