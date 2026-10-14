// BioLab · Inhalte zum Modul Anatomie (nur Daten). Zahlenwerte sind typische Werte für Erwachsene in Ruhe, gerundet.
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});
  BL.anatomie = {
    herz: {
      ra: { name: 'Rechter Vorhof', text: 'Nimmt sauerstoffarmes Blut aus dem Körper über die obere und untere Hohlvene auf.' },
      rv: { name: 'Rechte Kammer', text: 'Pumpt sauerstoffarmes Blut über die Lungenarterie zur Lunge (Lungenkreislauf).' },
      la: { name: 'Linker Vorhof', text: 'Nimmt sauerstoffreiches Blut aus der Lunge über die Lungenvenen auf.' },
      lv: { name: 'Linke Kammer', text: 'Pumpt sauerstoffreiches Blut in die Aorta und damit in den ganzen Körper. Ihre Muskelwand ist am dicksten, weil sie den größten Druck erzeugen muss.' },
      septum: { name: 'Herzscheidewand', text: 'Trennt rechte und linke Herzhälfte. So vermischt sich sauerstoffarmes und sauerstoffreiches Blut nicht.' },
      segelklappe: { name: 'Segelklappen', text: 'Ventile zwischen Vorhof und Kammer. Sie schließen sich, wenn sich die Kammern zusammenziehen – das Blut kann nicht in die Vorhöfe zurück.' },
      taschenklappe: { name: 'Taschenklappen', text: 'Ventile am Ausgang der Kammern. Sie schließen sich, wenn die Kammern erschlaffen – das Blut kann nicht aus den Arterien zurückfließen.' },
      hohlvene: { name: 'Hohlvenen', text: 'Die obere und die untere Hohlvene bringen sauerstoffarmes Blut aus dem Körper zum rechten Vorhof.' },
      lungenarterie: { name: 'Lungenarterie', text: 'Führt sauerstoffarmes Blut von der rechten Kammer zur Lunge. Arterien heißen so, weil sie vom Herzen wegführen – nicht wegen des Sauerstoffs.' },
      lungenvene: { name: 'Lungenvenen', text: 'Bringen sauerstoffreiches Blut von der Lunge zum linken Vorhof.' },
      aorta: { name: 'Aorta (Hauptschlagader)', text: 'Größte Arterie. Sie verteilt sauerstoffreiches Blut aus der linken Kammer in den Körper.' },
    },
    kreislauf: {
      herz: { name: 'Herz', text: 'Doppelpumpe: Die rechte Hälfte treibt den Lungenkreislauf an, die linke den Körperkreislauf.' },
      lunge: { name: 'Kapillaren der Lunge', text: 'Hier nimmt das Blut Sauerstoff auf und gibt Kohlenstoffdioxid ab.' },
      koerper: { name: 'Kapillaren der Organe', text: 'Hier gibt das Blut Sauerstoff und Nährstoffe an die Zellen ab und nimmt Kohlenstoffdioxid und Abfallstoffe auf.' },
      arterie: { name: 'Arterien', text: 'Führen Blut vom Herzen weg. Ihre Wände sind dick und elastisch.' },
      vene: { name: 'Venen', text: 'Führen Blut zum Herzen hin. Venenklappen verhindern, dass das Blut zurückfließt.' },
    },
    atmung: {
      nase: { name: 'Nasenhöhle', text: 'Die Atemluft wird hier angewärmt, angefeuchtet und von Staub gereinigt.' },
      luftroehre: { name: 'Luftröhre', text: 'Wird von Knorpelspangen offen gehalten. Flimmerhärchen befördern Schleim und Staub nach oben.' },
      bronchien: { name: 'Bronchien', text: 'Die Luftröhre teilt sich in zwei Hauptbronchien, die sich in der Lunge immer feiner verzweigen.' },
      lunge: { name: 'Lungenflügel', text: 'Schwammartiges Organ aus Bronchien, Bronchiolen und Hunderten Millionen Lungenbläschen.' },
      zwerchfell: { name: 'Zwerchfell', text: 'Kuppelförmiger Muskel unter der Lunge. Zieht er sich zusammen, flacht er ab, der Brustraum wird größer und Luft strömt ein (Bauchatmung).' },
      rippen: { name: 'Rippen und Zwischenrippenmuskeln', text: 'Die Zwischenrippenmuskeln heben beim Einatmen die Rippen an und erweitern so den Brustraum (Brustatmung).' },
      blaeschen: { name: 'Lungenbläschen', text: 'Winzige Bläschen mit sehr dünner Wand, umgeben von Kapillaren. Hier diffundiert Sauerstoff ins Blut und Kohlenstoffdioxid in die Atemluft.' },
    },
    verdauung: {
      mund: { name: 'Mund', text: 'Zähne zerkleinern die Nahrung. Ein Enzym im Speichel beginnt, Stärke zu Zucker abzubauen.' },
      speiseroehre: { name: 'Speiseröhre', text: 'Muskelschlauch, der den Bissen durch wellenförmige Bewegungen zum Magen schiebt.' },
      magen: { name: 'Magen', text: 'Salzsäure tötet Keime ab, Enzyme beginnen mit der Eiweißverdauung. Eine Schleimschicht schützt die Magenwand.' },
      leber: { name: 'Leber', text: 'Bildet die Gallenflüssigkeit und verarbeitet die Nährstoffe aus dem Blut des Darms.' },
      galle: { name: 'Gallenblase', text: 'Speichert die Galle und gibt sie in den Dünndarm ab. Galle zerteilt Fett in feine Tröpfchen.' },
      bauchspeicheldruese: { name: 'Bauchspeicheldrüse', text: 'Gibt Verdauungssaft mit Enzymen für Kohlenhydrate, Eiweiße und Fette in den Dünndarm ab.' },
      duenndarm: { name: 'Dünndarm', text: 'Mehrere Meter lang. Hier werden alle Nährstoffe in Bausteine zerlegt und über die Darmzotten ins Blut aufgenommen.' },
      dickdarm: { name: 'Dickdarm', text: 'Entzieht dem Nahrungsbrei Wasser und Mineralstoffe. Viele Bakterien zersetzen hier Reste.' },
      blinddarm: { name: 'Blinddarm mit Wurmfortsatz', text: 'Sackförmiger Anfang des Dickdarms. Der Wurmfortsatz kann sich entzünden („Blinddarmentzündung“).' },
      enddarm: { name: 'Enddarm', text: 'Sammelt die unverdaulichen Reste, die als Kot ausgeschieden werden.' },
    },
    nerven: {
      gehirn: { name: 'Gehirn', text: 'Verarbeitet Sinneseindrücke und steuert bewusste Bewegungen. Teil des Zentralnervensystems.' },
      rueckenmark: { name: 'Rückenmark', text: 'Leitet Signale zwischen Gehirn und Körper und schaltet einfache Reflexe direkt um. Teil des Zentralnervensystems.' },
      rezeptor: { name: 'Dehnungsrezeptor im Muskel', text: 'Sinneszellen im Muskel melden, wenn der Muskel gedehnt wird.' },
      auge: { name: 'Auge', text: 'Nimmt den Lichtreiz auf und wandelt ihn in elektrische Signale um.' },
      sensorisch: { name: 'Sensorische Nervenfaser', text: 'Leitet Signale von Sinneszellen zum Rückenmark oder Gehirn.' },
      motorisch: { name: 'Motorische Nervenfaser', text: 'Leitet Signale vom Rückenmark zum Muskel.' },
      muskel: { name: 'Oberschenkelmuskel', text: 'Erfolgsorgan: Er zieht sich zusammen, und das Bein schnellt nach vorn.' },
      synapse: { name: 'Umschaltstelle (Synapse)', text: 'Hier wird das Signal mit Botenstoffen auf die nächste Nervenzelle übertragen.' },
    },
    neuron: {
      dendrit: { name: 'Dendriten', text: 'Kurze, verzweigte Fortsätze, die Signale von anderen Zellen empfangen.' },
      soma: { name: 'Zellkörper (Soma)', text: 'Enthält den Zellkern und verarbeitet die eingehenden Signale.' },
      kern: { name: 'Zellkern', text: 'Steuert die Zelle.' },
      axon: { name: 'Axon', text: 'Langer Fortsatz, der das Signal weiterleitet – bei manchen Nervenzellen über einen Meter lang.' },
      myelin: { name: 'Myelinscheide', text: 'Isolierende Hülle um das Axon. Das Signal springt von Lücke zu Lücke und ist dadurch viel schneller.' },
      endknoepfchen: { name: 'Endknöpfchen', text: 'Hier schüttet die Nervenzelle Botenstoffe aus, die das Signal über die Synapse übertragen.' },
    },
  };
})(typeof window !== 'undefined' ? window : this);
