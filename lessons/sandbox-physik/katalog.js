// Physik-Labor · Verzeichnis der Simulationen und Suche (ohne DOM, getestet in test/physiklabor.test.mjs)
(function (root) {
  'use strict';
  var PL = root.PL || (root.PL = {});

  var BEREICHE = [
    { id: 'bewegung', text: 'Bewegungen' },
    { id: 'kraefte', text: 'Kräfte' },
    { id: 'schwingungen', text: 'Schwingungen' },
    { id: 'optik', text: 'Optik' },
  ];
  var SIMULATIONEN = [
    { id: 'fall', titel: 'Freier Fall', bereich: 'bewegung', bezug: 'Themenfeld 3.7 · Kl. 10',
      kurz: 'Lass einen Körper aus einer gewählten Höhe fallen – mit oder ohne Luftwiderstand – und miss Höhe, Geschwindigkeit und Beschleunigung.',
      stichworte: 'fallbeschleunigung gravitation erdbeschleunigung luftwiderstand senkrechter wurf grenzgeschwindigkeit mond mars diagramm' },
    { id: 'wurf', titel: 'Wurfbewegung', bereich: 'bewegung', bezug: 'Vertiefung zu 3.7 · Kl. 10',
      kurz: 'Waagerechter und schräger Wurf: Winkel, Abwurfgeschwindigkeit und -höhe verändern und Flugbahnen vergleichen.',
      stichworte: 'schräger wurf waagerechter wurf horizontal parabel wurfweite flughöhe flugzeit winkel unabhängigkeitsprinzip' },
    { id: 'reibung', titel: 'Kräfte und Reibung', bereich: 'kraefte', bezug: 'Themenfeld 3.8 · Kl. 10',
      kurz: 'Ziehe einen Körper über eine Fläche: Haftreibung, Gleitreibung und resultierende Kraft als beschriftete Pfeile.',
      stichworte: 'haftreibung gleitreibung reibungszahl normalkraft gewichtskraft newton beschleunigung kraftpfeil' },
    { id: 'feder', titel: 'Federpendel', bereich: 'schwingungen', bezug: 'Themenfelder 3.2 und 3.12 · Kl. 8 und 10',
      kurz: 'Ein Körper schwingt an einer Feder. Untersuche Periodendauer, Dämpfung und Energieumwandlung.',
      stichworte: 'schwingung feder federkonstante hooke periodendauer frequenz dämpfung energie amplitude' },
    { id: 'optik', titel: 'Optik-Labor', bereich: 'optik', bezug: 'Ergänzung über das Physik-SchiC hinaus',
      kurz: 'Sammel- und Zerstreuungslinse, ebener Spiegel und ein Strahlengang mit Spiegeln: Bilder konstruieren und vermessen.',
      stichworte: 'linse sammellinse zerstreuungslinse brennweite bildweite gegenstandsweite spiegel reflexion lichtstrahl virtuelles bild lupe' },
  ];

  function norm(s) {
    return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();
  }
  function bereichText(id) { for (var i = 0; i < BEREICHE.length; i++) if (BEREICHE[i].id === id) return BEREICHE[i].text; return id; }
  /** Simulationen nach Suchtext (alle Wörter müssen vorkommen) und Bereich ('' = alle) filtern */
  function filtere(suche, bereich) {
    var woerter = norm(suche).split(' ').filter(Boolean);
    return SIMULATIONEN.filter(function (s) {
      if (bereich && s.bereich !== bereich) return false;
      var heu = norm([s.titel, s.kurz, s.stichworte, bereichText(s.bereich)].join(' '));
      return woerter.every(function (w) { return heu.indexOf(w) >= 0; });
    });
  }

  PL.katalog = { BEREICHE: BEREICHE, SIMULATIONEN: SIMULATIONEN, filtere: filtere, bereichText: bereichText, norm: norm };
})(typeof window !== 'undefined' ? window : this);
