// Zeitenmaschine: bildet englische Sätze in neun Zeitformen (ohne DOM, auch für Tests in Node).
//   EN.zeiten.bilde(subjektId, verbId, zeitId, art)  art: 'pos' | 'neg' | 'frage'
//   → { satz, teile: [{ text, rolle: 'subjekt'|'hilfsverb'|'verb'|'rest' }] }
(function (root) {
  'use strict';

  // Personen: dritte Person Einzahl (he/she/it) bekommt das s im simple present
  var SUBJEKTE = [
    { id: 'i', text: 'I', p: 'i' },
    { id: 'you', text: 'you', p: 'pl' },
    { id: 'lena', text: 'Lena', p: '3' },
    { id: 'tom', text: 'Tom', p: '3' },
    { id: 'we', text: 'we', p: 'pl' },
    { id: 'parents', text: 'my parents', p: 'pl' },
  ];

  // Verben: Grundform, simple past, past participle, -ing-Form, he/she/it-Form, Ergänzung
  var VERBEN = [
    { id: 'play', v: ['play', 'played', 'played', 'playing', 'plays'], rest: 'football', regel: true },
    { id: 'study', v: ['study', 'studied', 'studied', 'studying', 'studies'], rest: 'English', regel: true },
    { id: 'watch', v: ['watch', 'watched', 'watched', 'watching', 'watches'], rest: 'a film', regel: true },
    { id: 'stop', v: ['stop', 'stopped', 'stopped', 'stopping', 'stops'], rest: 'the car', regel: true },
    { id: 'go', v: ['go', 'went', 'gone', 'going', 'goes'], rest: 'to school' },
    { id: 'write', v: ['write', 'wrote', 'written', 'writing', 'writes'], rest: 'a letter' },
    { id: 'eat', v: ['eat', 'ate', 'eaten', 'eating', 'eats'], rest: 'an apple' },
    { id: 'swim', v: ['swim', 'swam', 'swum', 'swimming', 'swims'], rest: 'in the lake' },
    { id: 'take', v: ['take', 'took', 'taken', 'taking', 'takes'], rest: 'the bus' },
    { id: 'make', v: ['make', 'made', 'made', 'making', 'makes'], rest: 'a cake' },
    { id: 'have', v: ['have', 'had', 'had', 'having', 'has'], rest: 'breakfast' },
    { id: 'see', v: ['see', 'saw', 'seen', 'seeing', 'sees'], rest: 'my friends' },
  ];

  // Zeitformen mit Signalwörtern, Zeitangabe für den Beispielsatz und Erklärung
  var ZEITEN = [
    { id: 'ps', name: 'simple present', zusatz: 'every day', signal: 'always, usually, often, never, every day, on Mondays', wann: 'Gewohnheiten, regelmäßige Handlungen, Fakten, Fahrpläne' },
    { id: 'pp', name: 'present progressive', zusatz: 'right now', signal: 'now, right now, at the moment, Look!, Listen!', wann: 'Handlung, die gerade jetzt abläuft oder vorübergehend ist' },
    { id: 'past', name: 'simple past', zusatz: 'yesterday', signal: 'yesterday, last week, two days ago, in 2020, when I was …', wann: 'abgeschlossene Handlung zu einem bestimmten Zeitpunkt in der Vergangenheit' },
    { id: 'pastp', name: 'past progressive', zusatz: 'when the phone rang', signal: 'while, when, at 8 o’clock yesterday', wann: 'Handlung, die in der Vergangenheit gerade im Gange war (oft unterbrochen)' },
    { id: 'perf', name: 'present perfect', zusatz: '', signal: 'already, just, ever, never, yet, so far, since, for', wann: 'Ergebnis oder Erfahrung bis jetzt – der Zeitpunkt ist unwichtig' },
    { id: 'perfp', name: 'present perfect progressive', zusatz: 'for two hours', signal: 'for, since, all day, how long …?', wann: 'Handlung, die in der Vergangenheit begonnen hat und bis jetzt andauert' },
    { id: 'pastperf', name: 'past perfect', zusatz: 'before the film started', signal: 'before, after, by the time, already (in der Vergangenheit)', wann: 'Handlung, die vor einer anderen vergangenen Handlung abgeschlossen war (Vorvergangenheit)' },
    { id: 'will', name: 'will-future', zusatz: 'tomorrow', signal: 'tomorrow, next week, I think, probably, I’m sure', wann: 'Vermutungen, Versprechen, spontane Entschlüsse' },
    { id: 'going', name: 'going-to future', zusatz: 'next week', signal: 'tomorrow, next week (wenn es schon geplant ist), Look! (Anzeichen)', wann: 'Pläne und Absichten, Vorhersagen mit sichtbaren Anzeichen' },
  ];

  function finde(liste, id) { for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i]; throw new Error('unbekannt: ' + id); }
  function gross(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Form von be im Präsens / Präteritum und von have
  function be(p, neg) {
    if (p === 'i') return neg ? 'am not' : 'am';
    if (p === '3') return neg ? 'isn’t' : 'is';
    return neg ? 'aren’t' : 'are';
  }
  function beFrage(p) { return p === 'i' ? 'am' : p === '3' ? 'is' : 'are'; }
  function was(p, neg) { var w = (p === 'pl') ? 'were' : 'was'; return neg ? w + 'n’t' : w; }
  function have(p, neg) { var h = p === '3' ? 'has' : 'have'; return neg ? h + 'n’t' : h; }

  /**
   * Teile: Hilfsverb(e) und Verbform, getrennt nach Rolle.
   * Rückgabe { hilf: [Wörter vor dem Verb], verb: 'Form', hilfFrage: 'Wort vor das Subjekt', hilfNachSubj: [weitere Hilfsverben] }
   */
  function bausteine(p, v, z, art) {
    var neg = art === 'neg', f = art === 'frage';
    switch (z) {
      case 'ps':
        if (neg) return { hilf: [p === '3' ? 'doesn’t' : 'don’t'], verb: v[0] };
        if (f) return { frage: p === '3' ? 'does' : 'do', nach: [], verb: v[0] };
        return { hilf: [], verb: p === '3' ? v[4] : v[0] };
      case 'pp':
        if (f) return { frage: beFrage(p), nach: [], verb: v[3] };
        return { hilf: [be(p, neg)], verb: v[3] };
      case 'past':
        if (neg) return { hilf: ['didn’t'], verb: v[0] };
        if (f) return { frage: 'did', nach: [], verb: v[0] };
        return { hilf: [], verb: v[1] };
      case 'pastp':
        if (f) return { frage: was(p, false), nach: [], verb: v[3] };
        return { hilf: [was(p, neg)], verb: v[3] };
      case 'perf':
        if (f) return { frage: have(p, false), nach: [], verb: v[2] };
        return { hilf: [have(p, neg)], verb: v[2] };
      case 'perfp':
        if (f) return { frage: have(p, false), nach: ['been'], verb: v[3] };
        return { hilf: [have(p, neg), 'been'], verb: v[3] };
      case 'pastperf':
        if (f) return { frage: 'had', nach: [], verb: v[2] };
        return { hilf: [neg ? 'hadn’t' : 'had'], verb: v[2] };
      case 'will':
        if (f) return { frage: 'will', nach: [], verb: v[0] };
        return { hilf: [neg ? 'won’t' : 'will'], verb: v[0] };
      case 'going':
        if (f) return { frage: beFrage(p), nach: ['going', 'to'], verb: v[0] };
        return { hilf: [be(p, neg), 'going', 'to'], verb: v[0] };
    }
    throw new Error('Zeit unbekannt: ' + z);
  }

  function bilde(subjektId, verbId, zeitId, art) {
    var s = finde(SUBJEKTE, subjektId), vb = finde(VERBEN, verbId), z = finde(ZEITEN, zeitId);
    var b = bausteine(s.p, vb.v, zeitId, art || 'pos');
    var teile = [];
    // I + am not → I’m not (übliche Kurzform)
    if (art === 'neg' && b.hilf && b.hilf[0] === 'am not') b.hilf[0] = '’m not';
    if (art === 'frage') {
      teile.push({ text: gross(b.frage), rolle: 'hilfsverb' });
      teile.push({ text: s.text, rolle: 'subjekt' });
      b.nach.forEach(function (w) { teile.push({ text: w, rolle: 'hilfsverb' }); });
    } else {
      teile.push({ text: gross(s.text), rolle: 'subjekt' });
      b.hilf.forEach(function (w) { teile.push({ text: w, rolle: 'hilfsverb' }); });
    }
    teile.push({ text: b.verb, rolle: 'verb' });
    var rest = vb.rest + (z.zusatz ? ' ' + z.zusatz : '');
    teile.push({ text: rest, rolle: 'rest' });
    var satz = teile.map(function (t) { return t.text; }).join(' ').replace(' ’m', '’m') + (art === 'frage' ? '?' : '.');
    return { satz: satz, teile: teile, zeit: z, unregelmaessig: !vb.regel };
  }

  root.EN = root.EN || {};
  root.EN.zeiten = { SUBJEKTE: SUBJEKTE, VERBEN: VERBEN, ZEITEN: ZEITEN, bilde: bilde };
})(typeof window !== 'undefined' ? window : globalThis);
