// BioLab · Präparate des virtuellen Mikroskops (nur Inhaltsdaten; gezeichnet wird in modul-mikroskopie.js)
//
// groesse: typische kleinste Abmessung in µm, die man zum Erkennen der Struktur braucht.
//          Daraus berechnet optik.js, ab welcher Vergrößerung sie erkennbar ist und beschriftet wird.
// Größenangaben sind gerundete Lehrbuchwerte; echte Präparate schwanken stark.
// maxObjektiv: stärkstes sinnvolles Objektiv (Frisch- und Lebendpräparate im Schulmikroskop meist 40×,
//              Ölimmersion 100× nur bei Ausstrichen, Auflicht-Objekte mit der Stereolupe).
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});

  BL.praeparate = [
    {
      id: 'zwiebel', name: 'Zwiebelhaut', gruppe: 'Pflanze', maxObjektiv: 40,
      herstellung: 'Frischpräparat: das dünne Häutchen von der Innenseite einer Zwiebelschuppe in einen Wassertropfen legen und mit einem Deckgläschen abdecken.',
      faerbung: { name: 'Iod-Kaliumiodid-Lösung', wirkung: 'Zellkerne und Zellplasma färben sich gelbbraun und werden deutlich sichtbar.' },
      strukturen: {
        zellwand: { name: 'Zellwand', groesse: 50, text: 'Feste Hülle aus Cellulose. Sie erscheint als dunkle Linie zwischen den Zellen und gibt ihnen die eckige Form.' },
        zellkern: { name: 'Zellkern', groesse: 15, text: 'Rundlicher bis ovaler Körper mit der Erbinformation. Ohne Färbung ist er nur schwach zu sehen, mit Iodlösung deutlich.' },
        kernkoerperchen: { name: 'Kernkörperchen', groesse: 3, text: 'Ein oder zwei kleine, dichte Körnchen im Zellkern. Hier werden Bestandteile der Ribosomen hergestellt.' },
        vakuole: { name: 'Vakuole', groesse: 40, text: 'Die Zellen der Zwiebelhaut sind lang gestreckt (etwa 0,2 bis 0,4 mm). Die Vakuole füllt fast die ganze Zelle aus und erscheint farblos. Das Zellplasma ist zu einem dünnen Saum an der Zellwand zusammengedrängt.' },
      },
      hinweis: 'Zwiebelhaut-Zellen haben keine Chloroplasten, weil die Zwiebelschuppen im Dunkeln wachsen.',
    },
    {
      id: 'wasserpest', name: 'Blatt der Wasserpest', gruppe: 'Pflanze', maxObjektiv: 40,
      herstellung: 'Frischpräparat: ein ganzes, junges Blättchen der Wasserpflanze Elodea in Wasser. Das Blatt ist nur zwei Zellschichten dick und muss nicht geschnitten werden.',
      strukturen: {
        zellwand: { name: 'Zellwand', groesse: 20, text: 'Feste Hülle aus Cellulose, als Linie zwischen den Zellen sichtbar.' },
        chloroplast: { name: 'Chloroplast', groesse: 5, text: 'Grüne, linsenförmige Körnchen mit Chlorophyll – Ort der Fotosynthese. In lebenden Zellen werden sie mit dem Zellplasma an der Zellwand entlang bewegt (Plasmaströmung).' },
        vakuole: { name: 'Vakuole', groesse: 15, text: 'Der farblose Raum in der Zellmitte. Die Chloroplasten liegen deshalb im Plasmasaum am Rand.' },
      },
      bewegung: 'Plasmaströmung: Bei 400-facher Vergrößerung sieht man, wie die Chloroplasten im Zellplasma an der Wand entlangwandern.',
      hinweis: 'Den Zellkern sieht man bei der Wasserpest ohne Färbung meist nicht, weil die Chloroplasten ihn verdecken. Er ist deshalb nicht eingezeichnet.',
    },
    {
      id: 'kartoffel', name: 'Kartoffelknolle', gruppe: 'Pflanze', maxObjektiv: 40,
      herstellung: 'Mit einer Rasierklinge einen sehr dünnen Schnitt von einer rohen Kartoffel abschaben, in Wasser legen und abdecken.',
      faerbung: { name: 'Iod-Kaliumiodid-Lösung', wirkung: 'Die Stärkekörner färben sich blauschwarz – das ist der Stärkenachweis.' },
      strukturen: {
        zellwand: { name: 'Zellwand', groesse: 60, text: 'Die großen, vieleckigen Speicherzellen der Knolle sind durch dünne Zellwände getrennt.' },
        staerkekorn: { name: 'Stärkekorn', groesse: 12, text: 'Die Knolle speichert Stärke in eiförmigen Körnern. Sie stammt aus der Fotosynthese in den Blättern.' },
        schichtung: { name: 'Schichtung des Stärkekorns', groesse: 2, text: 'Bei starker Vergrößerung erkennt man feine Ringe: Die Stärke wird schichtweise um einen Bildungspunkt herum abgelagert.' },
      },
    },
    {
      id: 'mundschleimhaut', name: 'Mundschleimhaut', gruppe: 'Mensch/Tier', maxObjektiv: 100,
      herstellung: 'Mit einem sauberen Holzspatel vorsichtig über die Innenseite der Wange streichen, auf einem Objektträger in einem Tropfen Wasser verteilen und abdecken.',
      faerbung: { name: 'Methylenblau', wirkung: 'Zellkerne werden kräftig blau, das Zellplasma hellblau.' },
      strukturen: {
        zellmembran: { name: 'Zellmembran', groesse: 40, text: 'Dünne Grenze der Zelle. Tierzellen haben keine Zellwand, deshalb ist ihre Form unregelmäßig.' },
        zellkern: { name: 'Zellkern', groesse: 8, text: 'Kleiner, rundlicher Kern in der Zellmitte, mit Methylenblau dunkelblau gefärbt.' },
        zellplasma: { name: 'Zellplasma', groesse: 40, text: 'Die Zellen sind flach und unregelmäßig vieleckig, etwa 50 bis 70 µm groß. Das Zellplasma füllt die Zelle aus. Eine große Vakuole gibt es nicht.' },
        bakterien: { name: 'Bakterien', groesse: 2, text: 'Auf den Zellen haften oft Bakterien aus der Mundhöhle. Sie sind erst bei 1000-facher Vergrößerung als winzige Punkte und Stäbchen erkennbar.' },
      },
    },
    {
      id: 'blut', name: 'Blutausstrich', gruppe: 'Mensch/Tier', maxObjektiv: 100,
      herstellung: 'Fertiges Dauerpräparat: ein Tropfen Blut, dünn auf dem Objektträger ausgestrichen, getrocknet und gefärbt (z. B. nach Pappenheim).',
      strukturen: {
        erythrozyt: { name: 'Rotes Blutkörperchen', groesse: 7, text: 'Scheibenförmig, etwa 7,5 µm groß, ohne Zellkern. Die Mitte ist dünner und erscheint heller. Transportiert Sauerstoff.' },
        granulozyt: { name: 'Weißes Blutkörperchen (Granulozyt)', groesse: 6, text: 'Etwa 12 µm groß. Sein Zellkern ist in mehrere Abschnitte gelappt. Er frisst Krankheitserreger.' },
        lymphozyt: { name: 'Weißes Blutkörperchen (Lymphozyt)', groesse: 6, text: 'Etwa 8 bis 10 µm groß, mit großem, rundem Kern und schmalem Zellplasma-Saum. Wichtig für die spezifische Abwehr.' },
        thrombozyt: { name: 'Blutplättchen', groesse: 2, text: 'Nur 2 bis 3 µm große Zellbruchstücke ohne Kern. Sie sorgen für die Blutgerinnung.' },
      },
      hinweis: 'In echtem Blut kommen auf etwa 600 rote Blutkörperchen nur ein weißes. Hier sind die weißen etwas häufiger eingezeichnet, damit man sie findet.',
    },
    {
      id: 'joghurt', name: 'Joghurt-Bakterien', gruppe: 'Bakterien', maxObjektiv: 100,
      herstellung: 'Eine winzige Menge Joghurt mit Wasser verdünnen, dünn ausstreichen, trocknen, mit Methylenblau färben. Beobachtung mit dem 100×-Ölimmersionsobjektiv.',
      strukturen: {
        staebchen: { name: 'Stäbchenbakterien (Lactobacillus)', groesse: 2.5, text: 'Milchsäurebakterien, etwa 2 bis 4 µm lang und unter 1 µm dick. Sie wandeln Milchzucker in Milchsäure um.' },
        kokken: { name: 'Kugelbakterien in Ketten (Streptococcus)', groesse: 3, text: 'Kugelförmige Bakterien von knapp 1 µm, die in Ketten zusammenhängen.' },
      },
      hinweis: 'Bakterien sind so klein, dass man mit 40- und 100-facher Vergrößerung nur eine leichte Trübung sieht. Ihren inneren Aufbau zeigt auch das Lichtmikroskop nicht – dafür braucht man ein Elektronenmikroskop.',
    },
    {
      id: 'heuaufguss', name: 'Heuaufguss mit Pantoffeltierchen', gruppe: 'Einzeller', maxObjektiv: 40,
      herstellung: 'Lebendpräparat: ein Tropfen aus einem einige Tage alten Heuaufguss. Damit die Einzeller langsamer schwimmen, kann man etwas Methylcellulose zugeben.',
      strukturen: {
        pantoffeltierchen: { name: 'Pantoffeltierchen', groesse: 60, text: 'Einzeller von etwa 0,2 mm Länge in Form einer Schuhsohle. Bewegt sich mit Wimpern schnell durch das Wasser.' },
        mundfeld: { name: 'Mundfeld', groesse: 20, text: 'Trichterförmige Einbuchtung. Wimpern strudeln hier Bakterien als Nahrung hinein.' },
        grosskern: { name: 'Großkern', groesse: 15, text: 'Großer Zellkern, der den Stoffwechsel der Zelle steuert. Ein kleiner Kleinkern daneben ist für die Fortpflanzung wichtig.' },
        nahrungsvakuole: { name: 'Nahrungsvakuole', groesse: 6, text: 'Bläschen mit aufgenommenen Bakterien, die darin verdaut werden.' },
        pulsierende_vakuole: { name: 'Pulsierende Vakuole', groesse: 8, text: 'Zwei sternförmige Bläschen, die überschüssiges Wasser sammeln und regelmäßig nach außen pumpen.' },
        wimpern: { name: 'Wimpern', groesse: 3, text: 'Tausende feine Härchen auf der ganzen Oberfläche. Sie schlagen in Wellen und treiben den Einzeller an.' },
      },
      bewegung: 'Die Pantoffeltierchen schwimmen. Mit „Bewegung anhalten“ wird das Präparat wie mit Methylcellulose ruhiggestellt.',
    },
    {
      id: 'spaltoeffnung', name: 'Blattunterseite mit Spaltöffnungen', gruppe: 'Pflanze', maxObjektiv: 40,
      herstellung: 'Ein Stück der unteren Blatthaut (Epidermis) mit einer Pinzette abziehen und in Wasser legen.',
      strukturen: {
        epidermiszelle: { name: 'Epidermiszelle', groesse: 30, text: 'Die Zellen der Blatthaut sind farblos und greifen mit welligen Wänden wie Puzzleteile ineinander.' },
        schliesszelle: { name: 'Schließzelle', groesse: 8, text: 'Zwei bohnenförmige Zellen bilden eine Spaltöffnung. Anders als die übrigen Epidermiszellen enthalten sie Chloroplasten.' },
        spalt: { name: 'Spalt (Pore)', groesse: 5, text: 'Durch die Öffnung zwischen den Schließzellen tauscht das Blatt Gase aus: Kohlenstoffdioxid hinein, Sauerstoff und Wasserdampf hinaus.' },
        chloroplast: { name: 'Chloroplasten der Schließzellen', groesse: 3, text: 'Kleine grüne Körnchen in den Schließzellen.' },
      },
      parameter: 'Spaltöffnungen öffnen sich meist bei Licht und ausreichend Wasser und schließen sich bei Trockenheit.',
    },
    {
      id: 'blattquerschnitt', name: 'Querschnitt durch ein Laubblatt', gruppe: 'Pflanze', maxObjektiv: 40,
      herstellung: 'Dauerpräparat: hauchdünner Querschnitt durch ein Blatt, gefärbt. Man blickt auf die Schnittfläche.',
      strukturen: {
        kutikula: { name: 'Wachsschicht (Kutikula)', groesse: 3, text: 'Dünne, wachsartige Schicht auf der Oberseite. Sie schützt vor Wasserverlust.' },
        obere_epidermis: { name: 'Obere Epidermis', groesse: 15, text: 'Eine Lage dicht schließender, farbloser Zellen ohne Chloroplasten – Licht dringt hindurch.' },
        palisaden: { name: 'Palisadengewebe', groesse: 12, text: 'Lang gestreckte, dicht stehende Zellen mit sehr vielen Chloroplasten. Hier findet der größte Teil der Fotosynthese statt.' },
        schwamm: { name: 'Schwammgewebe', groesse: 15, text: 'Locker angeordnete Zellen mit großen Lufträumen dazwischen. Durch sie verteilen sich die Gase im Blatt.' },
        interzellulare: { name: 'Interzellularraum', groesse: 10, text: 'Lufträume zwischen den Zellen des Schwammgewebes.' },
        leitbuendel: { name: 'Leitbündel (Blattader)', groesse: 40, text: 'Leitet Wasser und Mineralstoffe (Holzteil, Xylem, oben) und Zucker (Siebteil, Phloem, unten).' },
        untere_epidermis: { name: 'Untere Epidermis', groesse: 12, text: 'Untere Blatthaut mit den Spaltöffnungen.' },
        spaltoeffnung: { name: 'Spaltöffnung im Querschnitt', groesse: 10, text: 'Zwei Schließzellen über einer Atemhöhle im Schwammgewebe.' },
        chloroplast: { name: 'Chloroplasten', groesse: 3, text: 'Grüne Körnchen in den Zellen von Palisaden- und Schwammgewebe.' },
      },
    },
    {
      id: 'komplexauge', name: 'Komplexauge einer Fliege', gruppe: 'Mensch/Tier', maxObjektiv: 10,
      herstellung: 'Beobachtung im Auflicht: Licht fällt von oben auf den Kopf der Fliege (am besten mit einer Stereolupe).',
      strukturen: {
        auge: { name: 'Komplexauge', groesse: 300, text: 'Das Auge besteht aus Tausenden Einzelaugen. Jedes sieht nur einen kleinen Ausschnitt; das Gehirn setzt daraus ein Mosaikbild zusammen.' },
        facette: { name: 'Facette (Einzelauge)', groesse: 15, text: 'Die sechseckigen Linsen der Einzelaugen, bei der Stubenfliege etwa 25 µm breit. Sechsecke füllen die gewölbte Fläche lückenlos.' },
      },
      hinweis: 'Im Auflicht sieht man nur die Oberfläche. Den Aufbau der Einzelaugen darunter zeigt erst ein Schnittpräparat.',
    },
  ];
})(typeof window !== 'undefined' ? window : this);
