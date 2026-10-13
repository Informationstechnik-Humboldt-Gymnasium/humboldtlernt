// Atom- & Chemielabor · Lernmodus des Molecule Builders: Aufgaben und ihre Bewertung (kein DOM)
//
// Jede Aufgabe: { id, titel, text, tipp, erklaerung, start?() → Modell, pruefe(m) → { ok, text } }
// Bewertet wird die STRUKTUR (Atome + Bindungen mit Ordnung) über CL.molekuel.istStruktur bzw. analyse –
// Lage und Anordnung der Atome auf der Fläche spielen keine Rolle.
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var M = CL.molekuel, C = CL.chemie, D = CL.daten;

  function molName(id) { return D.MOLEKUELE.filter(function (x) { return x.id === id; })[0].name; }

  /** Rückmeldung, wenn das Zielmolekül (noch) nicht gefunden wurde. */
  function warumNicht(m, zielFormel) {
    var a = M.analyse(m);
    if (!a.length) return 'Die Arbeitsfläche ist leer. Setze zuerst Atome ein.';
    var t = a.slice().sort(function (p, q) { return q.atomAnzahl - p.atomAnzahl; })[0];
    if (t.formel !== zielFormel) return 'Die Summenformel stimmt noch nicht: gesucht ist ' + zielFormel + ', dein größtes Molekül ist ' + t.formel + '.';
    if (t.status !== 'gueltig') return 'Die Atome stimmen (' + t.formel + '), aber: ' + (t.meldungen[0] ? t.meldungen[0].text : 'die Bindungen passen noch nicht.');
    return 'Die Summenformel ' + t.formel + ' stimmt und alle Bindigkeiten sind erfüllt – aber die Atome sind anders verknüpft als im gesuchten Molekül.';
  }

  /** Aufgabe „baue Molekül X“. */
  function baue(id, ziel, titel, tipp, erklaerung) {
    var formel = C.hill(D.MOLEKUELE.filter(function (x) { return x.id === ziel; })[0].atome.reduce(function (z, a) { z[a[0]] = (z[a[0]] || 0) + 1; return z; }, {}));
    return {
      id: id, titel: titel, text: 'Baue ' + molName(ziel) + ' (' + formel + ').', tipp: tipp, erklaerung: erklaerung, ziel: ziel,
      pruefe: function (m) {
        var treffer = M.teile(m).some(function (ids) { return M.istStruktur(m, ids, ziel); });
        if (treffer) return { ok: true, text: 'Richtig! Das ist ' + molName(ziel) + '.' + (M.teile(m).length > 1 ? ' (Auf der Fläche liegen noch weitere Atome – die stören hier nicht.)' : '') };
        return { ok: false, text: warumNicht(m, formel) };
      },
    };
  }

  /** Start-Modell aus einer Liste von Atomen und Bindungen (für Fehler-Aufgaben). */
  function struktur(atome, bindungen) {
    var m = M.neu();
    var ids = atome.map(function (a) { return M.atomHinzu(m, a[0], a[1], a[2]).id; });
    bindungen.forEach(function (b) { m.bindungen.push({ a: ids[b[0]], b: ids[b[1]], ordnung: b[2] }); });
    return m;
  }

  var AUFGABEN = [
    baue('wasser', 'h2o', 'Wasser', 'Sauerstoff geht zwei Bindungen ein, Wasserstoff nur eine.',
      'Sauerstoff hat 6 Außenelektronen und braucht 2 weitere für ein Oktett – darum bindet er 2 Wasserstoffatome. Die zwei freien Elektronenpaare am Sauerstoff drücken die Bindungen zusammen: Das Molekül ist gewinkelt (gemessen 104,5°).'),
    baue('kohlendioxid', 'co2', 'Kohlenstoffdioxid', 'Kohlenstoff braucht 4 Bindungen, jedes Sauerstoffatom 2. Mit Einfachbindungen allein geht das nicht auf.',
      'Kohlenstoff ist vierbindig, Sauerstoff zweibindig. Mit zwei Doppelbindungen O=C=O sind alle Bindigkeiten erfüllt. Am Kohlenstoff gibt es keine freien Elektronenpaare, deshalb ist das Molekül linear (180°).'),
    baue('methan', 'ch4', 'Methan', 'Kohlenstoff hat 4 Außenelektronen und geht 4 Bindungen ein.',
      'Kohlenstoff bildet vier Einfachbindungen zu je einem Wasserstoffatom. Die vier Bindungen verteilen sich räumlich so weit wie möglich: Es entsteht ein Tetraeder mit 109,5°-Winkeln. Die Zeichnung auf der Fläche ist nur flach.'),
    baue('ammoniak', 'nh3', 'Ammoniak', 'Stickstoff hat 5 Außenelektronen und braucht 3 weitere.',
      'Stickstoff bindet drei Wasserstoffatome und behält ein freies Elektronenpaar. Darum ist Ammoniak trigonal-pyramidal (gemessen 106,7°).'),
    baue('sauerstoff', 'o2', 'Sauerstoff', 'Beide Sauerstoffatome brauchen je 2 Bindungen – und es gibt nur einen Partner.',
      'Zwei Sauerstoffatome teilen sich zwei Elektronenpaare: eine Doppelbindung O=O. (Für Fortgeschrittene: Das einfache Valenzstrichmodell erklärt nicht, warum O₂ magnetisch ist – dafür braucht man die Molekülorbitaltheorie.)'),
    {
      id: 'doppelbindung', titel: 'Doppelbindung', text: 'Baue ein Molekül mit mindestens einer Doppelbindung, in dem alle Bindigkeiten stimmen.',
      tipp: 'Wähle oben „Doppel“ als Bindungsart. Kohlenstoff, Stickstoff, Sauerstoff, Phosphor und Schwefel können Doppelbindungen eingehen.',
      erklaerung: 'Bei einer Doppelbindung teilen sich zwei Atome zwei Elektronenpaare. Beispiele sind O₂, CO₂, Ethen (C₂H₄) und Methanal (CH₂O). Eine gültige Modellstruktur heißt noch nicht, dass der Stoff existiert – das zeigt erst der Vergleich mit bekannten Stoffen.',
      pruefe: function (m) {
        var a = M.analyse(m), mitDoppel = a.filter(function (t) { return t.bindungsTypen[2] > 0; });
        if (!mitDoppel.length) return { ok: false, text: a.length ? 'In deinen Molekülen gibt es noch keine Doppelbindung.' : 'Die Arbeitsfläche ist leer.' };
        var gut = mitDoppel.filter(function (t) { return t.status === 'gueltig'; })[0];
        if (!gut) return { ok: false, text: 'Eine Doppelbindung ist da, aber: ' + (mitDoppel[0].meldungen[0] ? mitDoppel[0].meldungen[0].text : 'die Struktur ist noch nicht gültig.') };
        return { ok: true, text: gut.bekannt ? 'Richtig! ' + gut.name + ' (' + gut.formel + ') enthält eine Doppelbindung.'
          : 'Richtig: Die Struktur ' + gut.formel + ' ist im Modell gültig und hat eine Doppelbindung. Ob es diesen Stoff wirklich gibt, kann das Labor nicht sagen.' };
      },
    },
    {
      id: 'fehler-ethen', titel: 'Fehler finden: Ethen', ziel: 'c2h4',
      text: 'Diese Struktur soll Ethen (C₂H₄) sein, ist aber falsch gezeichnet. Finde den Fehler und korrigiere ihn.',
      tipp: 'Schau, welche Atome noch freie Bindungsmöglichkeiten haben. Tippe die Bindung zwischen ihnen an und ändere die Bindungsart.',
      erklaerung: 'Mit einer Einfachbindung zwischen den Kohlenstoffatomen hätte jedes C nur 3 Bindungen. Erst die Doppelbindung C=C erfüllt die Vierbindigkeit. Wegen der Doppelbindung ist Ethen eben gebaut (trigonal-planar an jedem C).',
      start: function () { return struktur([['C', -45, 0], ['C', 45, 0], ['H', -95, -55], ['H', -95, 55], ['H', 95, -55], ['H', 95, 55]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]]); },
      pruefe: function (m) {
        if (M.teile(m).some(function (ids) { return M.istStruktur(m, ids, 'c2h4'); })) return { ok: true, text: 'Richtig korrigiert: Jetzt ist es Ethen mit einer C=C-Doppelbindung.' };
        return { ok: false, text: warumNicht(m, 'C₂H₄') };
      },
    },
    {
      id: 'fehler-methan', titel: 'Fehler finden: zu viele Bindungen', ziel: 'ch4',
      text: 'Hier wollte jemand Methan (CH₄) bauen. Finde den Fehler und korrigiere ihn.',
      tipp: 'Zähle die Bindungen am Kohlenstoffatom. Ein Atom wählst du durch Antippen aus und löschst es mit „Löschen“.',
      erklaerung: 'Kohlenstoff ist vierbindig. Fünf Bindungen sind im Modell eine Regelverletzung – ein Wasserstoffatom ist zu viel. Ohne das fünfte H bleibt Methan, CH₄.',
      start: function () { return struktur([['C', 0, 0], ['H', -75, 0], ['H', 75, 0], ['H', 0, -75], ['H', 0, 75], ['H', 60, -60]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]]); },
      pruefe: function (m) {
        if (M.teile(m).some(function (ids) { return M.istStruktur(m, ids, 'ch4'); })) return { ok: true, text: 'Richtig korrigiert: Kohlenstoff hat jetzt genau vier Bindungen.' };
        return { ok: false, text: warumNicht(m, 'CH₄') };
      },
    },
  ];

  CL.molekuelAufgaben = { liste: AUFGABEN, finde: function (id) { return AUFGABEN.filter(function (a) { return a.id === id; })[0] || null; } };
})(typeof window !== 'undefined' ? window : globalThis);
