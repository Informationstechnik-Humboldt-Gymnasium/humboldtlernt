// Satzbaukasten: Aufgaben und Prüfung (ohne DOM, auch für Tests in Node).
//   EN.satzbau.AUFGABEN: [{ id, gruppe, auftrag, woerter, loesungen, punkt, tipps }]
//   EN.satzbau.pruefe(aufgabe, gebaut) → { ok, meldung }
// Wörter werden ohne Rücksicht auf Groß-/Kleinschreibung verglichen. Ein Komma gehört zum Wort davor.
(function (root) {
  'use strict';

  var GRUPPEN = {
    wortstellung: 'Wortstellung', fragen: 'Fragen', if: 'If-Sätze', reported: 'Indirekte Rede', passiv: 'Passiv',
  };

  var AUFGABEN = [
    {
      id: 'w1', gruppe: 'wortstellung', auftrag: 'Gestern habe ich meine Freunde im Park getroffen.',
      woerter: ['met', 'yesterday', 'the', 'I', 'park', 'friends', 'in', 'my'],
      loesungen: [['I', 'met', 'my', 'friends', 'in', 'the', 'park', 'yesterday'], ['yesterday', 'I', 'met', 'my', 'friends', 'in', 'the', 'park']],
      punkt: '.',
      tipps: [],
      reihenfolgeTipp: 'Denk an S-V-O-P-T: Subjekt – Verb – Objekt – Ort – Zeit. Eine Zeitangabe darf auch ganz vorne stehen, danach folgen aber Subjekt und Verb.',
    },
    {
      id: 'w2', gruppe: 'wortstellung', auftrag: 'Wir spielen samstags oft Fußball im Park.',
      woerter: ['football', 'on', 'we', 'park', 'play', 'Saturdays', 'often', 'the', 'in'],
      loesungen: [['we', 'often', 'play', 'football', 'in', 'the', 'park', 'on', 'Saturdays'], ['on', 'Saturdays', 'we', 'often', 'play', 'football', 'in', 'the', 'park']],
      punkt: '.',
      tipps: [],
      reihenfolgeTipp: 'Häufigkeitsadverbien wie often stehen vor dem Hauptverb. Ort (in the park) vor Zeit (on Saturdays).',
    },
    {
      id: 'f1', gruppe: 'fragen', auftrag: 'Wo hast du deine Ferien verbracht?',
      woerter: ['spend', 'you', 'did', 'holidays', 'where', 'spent', 'your'],
      loesungen: [['where', 'did', 'you', 'spend', 'your', 'holidays']],
      punkt: '?',
      tipps: [{ wort: 'spent', text: 'Nach did steht die Grundform: spend, nicht spent.' }],
      reihenfolgeTipp: 'Fragewort – Hilfsverb – Subjekt – Verb: Where did you …?',
    },
    {
      id: 'f2', gruppe: 'fragen', auftrag: 'Wer hat das Fenster zerbrochen?',
      woerter: ['window', 'did', 'broke', 'who', 'break', 'the'],
      loesungen: [['who', 'broke', 'the', 'window']],
      punkt: '?',
      tipps: [{ wort: 'did', text: 'Hier fragt who nach dem Subjekt (Wer?). Dann braucht man kein did: Who broke …?' }, { wort: 'break', text: 'Ohne did steht das Verb im simple past: broke.' }],
      reihenfolgeTipp: 'Bei Fragen nach dem Subjekt bleibt die normale Wortstellung: Who + Verb + Objekt.',
    },
    {
      id: 'i1', gruppe: 'if', typ: 'I', auftrag: 'Wenn es morgen regnet, bleiben wir zu Hause.',
      woerter: ['stay', 'it', 'home', 'we', 'tomorrow,', 'if', 'at', 'will', 'rains', 'would'],
      loesungen: [['if', 'it', 'rains', 'tomorrow,', 'we', 'will', 'stay', 'at', 'home']],
      punkt: '.',
      tipps: [{ wort: 'would', text: 'Der Regen ist gut möglich: if-Satz Typ I mit will, nicht would.' }],
      reihenfolgeTipp: 'Typ I: If + simple present, will + Grundform. Nach dem if-Satz steht ein Komma.',
    },
    {
      id: 'i2', gruppe: 'if', typ: 'II', auftrag: 'Wenn ich ein Pferd hätte, würde ich jeden Tag reiten.',
      woerter: ['ride', 'a', 'I', 'had', 'day', 'if', 'would', 'horse,', 'every', 'I', 'have'],
      loesungen: [['if', 'I', 'had', 'a', 'horse,', 'I', 'would', 'ride', 'every', 'day']],
      punkt: '.',
      tipps: [{ wort: 'have', text: 'Gedachte Situation (Typ II): im if-Satz das simple past – had.' }],
      reihenfolgeTipp: 'Typ II: If + simple past, would + Grundform.',
    },
    {
      id: 'i3', gruppe: 'if', typ: 'III', auftrag: 'Wenn wir den Bus genommen hätten, wären wir pünktlich gewesen.',
      woerter: ['been', 'taken', 'we', 'had', 'on', 'bus,', 'if', 'would', 'the', 'have', 'we', 'time', 'took'],
      loesungen: [['if', 'we', 'had', 'taken', 'the', 'bus,', 'we', 'would', 'have', 'been', 'on', 'time']],
      punkt: '.',
      tipps: [{ wort: 'took', text: 'Typ III: if + past perfect (had taken), nicht simple past.' }],
      reihenfolgeTipp: 'Typ III: If + had + 3. Form, would have + 3. Form.',
    },
    {
      id: 'r1', gruppe: 'reported', auftrag: '„I am tired“, said Mia. → Berichte, was Mia gesagt hat.',
      woerter: ['that', 'tired', 'Mia', 'was', 'she', 'said', 'is'],
      loesungen: [['Mia', 'said', 'that', 'she', 'was', 'tired'], ['Mia', 'said', 'she', 'was', 'tired']],
      punkt: '.',
      tipps: [{ wort: 'is', text: 'Nach said rückt die Zeit zurück: am/is → was.' }],
      reihenfolgeTipp: 'Mia said (that) + Subjekt + Verb in der zurückverschobenen Zeit.',
    },
    {
      id: 'r2', gruppe: 'reported', auftrag: '„Where do you live?“, he asked me. → Berichte die Frage.',
      woerter: ['lived', 'asked', 'where', 'I', 'did', 'he', 'me', 'live'],
      loesungen: [['he', 'asked', 'me', 'where', 'I', 'lived']],
      punkt: '.',
      tipps: [{ wort: 'did', text: 'In der indirekten Frage gibt es kein did und keine Fragewortstellung.' }, { wort: 'live', text: 'Die Zeit rückt zurück: live → lived.' }],
      reihenfolgeTipp: 'He asked me + Fragewort + Subjekt + Verb (wie im Aussagesatz).',
    },
    {
      id: 'p1', gruppe: 'passiv', auftrag: 'Die Brücke wurde 1894 eröffnet.',
      woerter: ['opened', 'bridge', 'the', 'in', 'was', '1894', 'is'],
      loesungen: [['the', 'bridge', 'was', 'opened', 'in', '1894']],
      punkt: '.',
      tipps: [{ wort: 'is', text: '1894 liegt in der Vergangenheit: was opened.' }],
      reihenfolgeTipp: 'Passiv: Subjekt + was/were + 3. Form.',
    },
    {
      id: 'p2', gruppe: 'passiv', auftrag: 'Englisch wird überall auf der Welt gesprochen.',
      woerter: ['spoken', 'world', 'English', 'over', 'is', 'the', 'all', 'speaks'],
      loesungen: [['English', 'is', 'spoken', 'all', 'over', 'the', 'world']],
      punkt: '.',
      tipps: [{ wort: 'speaks', text: 'Englisch spricht nicht selbst – es wird gesprochen: is spoken.' }],
      reihenfolgeTipp: 'Passiv: Subjekt + am/is/are + 3. Form.',
    },
  ];

  function norm(w) { return String(w).toLowerCase(); }
  function gleich(a, b) { return a.length === b.length && a.every(function (w, i) { return norm(w) === norm(b[i]); }); }
  function sortiert(a) { return a.map(norm).sort().join('|'); }

  function pruefe(aufgabe, gebaut) {
    if (!gebaut.length) return { ok: false, meldung: 'Tippe die Wörter in der richtigen Reihenfolge an.' };
    for (var i = 0; i < aufgabe.loesungen.length; i++) if (gleich(gebaut, aufgabe.loesungen[i])) return { ok: true, meldung: 'Richtig!' };
    var gebautNorm = gebaut.map(norm);
    for (var t = 0; t < aufgabe.tipps.length; t++) if (gebautNorm.indexOf(norm(aufgabe.tipps[t].wort)) >= 0) return { ok: false, meldung: aufgabe.tipps[t].text };
    var sameWords = aufgabe.loesungen.some(function (l) { return sortiert(l) === sortiert(gebaut); });
    if (sameWords) return { ok: false, meldung: 'Die Wörter stimmen, aber die Reihenfolge noch nicht. ' + aufgabe.reihenfolgeTipp };
    var kuerzeste = Math.min.apply(null, aufgabe.loesungen.map(function (l) { return l.length; }));
    if (gebaut.length < kuerzeste) return { ok: false, meldung: 'Es fehlen noch Wörter.' };
    return { ok: false, meldung: 'Noch nicht ganz. ' + aufgabe.reihenfolgeTipp };
  }

  /** Satz zur Anzeige: erstes Wort groß, Satzzeichen am Ende. */
  function satz(woerter, punkt) {
    if (!woerter.length) return '';
    var s = woerter.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1) + (punkt || '');
  }

  root.EN = root.EN || {};
  root.EN.satzbau = { GRUPPEN: GRUPPEN, AUFGABEN: AUFGABEN, pruefe: pruefe, satz: satz };
})(typeof window !== 'undefined' ? window : globalThis);
