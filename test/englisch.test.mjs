// Tests für das Fach Englisch: Zeitenmaschine (lessons/en-zeitenmaschine/zeiten.js) und Satzbaukasten
// (lessons/en-satzbaukasten/saetze.js). Beide Module laufen wie im Browser (ohne DOM) in einer VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const LESSONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lessons');
const ctx = vm.createContext({});
for (const f of ['en-zeitenmaschine/zeiten.js', 'en-satzbaukasten/saetze.js']) {
  vm.runInContext(fs.readFileSync(path.join(LESSONS, f), 'utf8'), ctx, { filename: f });
}
const Z = ctx.EN.zeiten, SB = ctx.EN.satzbau;
const satz = (s, v, z, a) => Z.bilde(s, v, z, a).satz;
const plain = x => JSON.parse(JSON.stringify(x));

test('Zeitenmaschine: bejahte Sätze in allen neun Zeitformen', () => {
  assert.equal(satz('lena', 'write', 'ps', 'pos'), 'Lena writes a letter every day.');
  assert.equal(satz('i', 'write', 'ps', 'pos'), 'I write a letter every day.');
  assert.equal(satz('tom', 'watch', 'ps', 'pos'), 'Tom watches a film every day.');
  assert.equal(satz('tom', 'study', 'ps', 'pos'), 'Tom studies English every day.');
  assert.equal(satz('we', 'swim', 'pp', 'pos'), 'We are swimming in the lake right now.');
  assert.equal(satz('i', 'swim', 'pp', 'pos'), 'I am swimming in the lake right now.');
  assert.equal(satz('parents', 'stop', 'past', 'pos'), 'My parents stopped the car yesterday.');
  assert.equal(satz('lena', 'go', 'past', 'pos'), 'Lena went to school yesterday.');
  assert.equal(satz('you', 'eat', 'pastp', 'pos'), 'You were eating an apple when the phone rang.');
  assert.equal(satz('i', 'eat', 'pastp', 'pos'), 'I was eating an apple when the phone rang.');
  assert.equal(satz('lena', 'take', 'perf', 'pos'), 'Lena has taken the bus.');
  assert.equal(satz('we', 'see', 'perf', 'pos'), 'We have seen my friends.');
  assert.equal(satz('tom', 'play', 'perfp', 'pos'), 'Tom has been playing football for two hours.');
  assert.equal(satz('i', 'make', 'pastperf', 'pos'), 'I had made a cake before the film started.');
  assert.equal(satz('parents', 'have', 'will', 'pos'), 'My parents will have breakfast tomorrow.');
  assert.equal(satz('lena', 'swim', 'going', 'pos'), 'Lena is going to swim in the lake next week.');
});

test('Zeitenmaschine: Verneinung mit dem richtigen Hilfsverb und der richtigen Verbform', () => {
  assert.equal(satz('lena', 'write', 'ps', 'neg'), 'Lena doesn’t write a letter every day.');
  assert.equal(satz('we', 'write', 'ps', 'neg'), 'We don’t write a letter every day.');
  assert.equal(satz('i', 'swim', 'pp', 'neg'), 'I’m not swimming in the lake right now.');
  assert.equal(satz('tom', 'swim', 'pp', 'neg'), 'Tom isn’t swimming in the lake right now.');
  assert.equal(satz('lena', 'go', 'past', 'neg'), 'Lena didn’t go to school yesterday.');
  assert.equal(satz('parents', 'eat', 'pastp', 'neg'), 'My parents weren’t eating an apple when the phone rang.');
  assert.equal(satz('tom', 'write', 'perf', 'neg'), 'Tom hasn’t written a letter.');
  assert.equal(satz('i', 'write', 'perfp', 'neg'), 'I haven’t been writing a letter for two hours.');
  assert.equal(satz('we', 'take', 'pastperf', 'neg'), 'We hadn’t taken the bus before the film started.');
  assert.equal(satz('lena', 'make', 'will', 'neg'), 'Lena won’t make a cake tomorrow.');
  assert.equal(satz('i', 'make', 'going', 'neg'), 'I’m not going to make a cake next week.');
});

test('Zeitenmaschine: Fragen mit Hilfsverb vor dem Subjekt', () => {
  assert.equal(satz('lena', 'play', 'ps', 'frage'), 'Does Lena play football every day?');
  assert.equal(satz('parents', 'play', 'ps', 'frage'), 'Do my parents play football every day?');
  assert.equal(satz('i', 'study', 'pp', 'frage'), 'Am I studying English right now?');
  assert.equal(satz('you', 'see', 'past', 'frage'), 'Did you see my friends yesterday?');
  assert.equal(satz('tom', 'watch', 'pastp', 'frage'), 'Was Tom watching a film when the phone rang?');
  assert.equal(satz('lena', 'eat', 'perf', 'frage'), 'Has Lena eaten an apple?');
  assert.equal(satz('we', 'study', 'perfp', 'frage'), 'Have we been studying English for two hours?');
  assert.equal(satz('tom', 'go', 'pastperf', 'frage'), 'Had Tom gone to school before the film started?');
  assert.equal(satz('you', 'swim', 'will', 'frage'), 'Will you swim in the lake tomorrow?');
  assert.equal(satz('tom', 'take', 'going', 'frage'), 'Is Tom going to take the bus next week?');
});

test('Zeitenmaschine: Verbdaten vollständig, unregelmäßige Verben markiert, Rollen der Satzteile', () => {
  for (const v of Z.VERBEN) {
    assert.equal(v.v.length, 5, v.id);
    assert.equal(v.v[0], v.id);
    if (v.regel) assert.ok(v.v[1].endsWith('ed') && v.v[2] === v.v[1], `${v.id} ist regelmäßig`);
  }
  assert.ok(Z.VERBEN.filter(v => !v.regel).length >= 6);
  const r = Z.bilde('lena', 'write', 'perfp', 'frage');
  assert.deepEqual(plain(r.teile.map(t => t.rolle)), ['hilfsverb', 'subjekt', 'hilfsverb', 'verb', 'rest']);
  assert.equal(Z.ZEITEN.length, 9);
  for (const z of Z.ZEITEN) for (const s of Z.SUBJEKTE) for (const v of Z.VERBEN) for (const a of ['pos', 'neg', 'frage']) {
    const x = Z.bilde(s.id, v.id, z.id, a).satz;
    assert.match(x, /^[A-Z].*[.?]$/, x);
    assert.ok(!/\s{2}|\s[.?]$/.test(x), x);
  }
});

test('Satzbaukasten: Lösungen bestehen nur aus vorhandenen Wörtern, Hinweise passen zu Fallen-Wörtern', () => {
  const norm = w => w.toLowerCase();
  const zaehle = l => l.reduce((m, w) => (m[norm(w)] = (m[norm(w)] || 0) + 1, m), {});
  assert.ok(SB.AUFGABEN.length >= 10);
  const ids = new Set();
  for (const a of SB.AUFGABEN) {
    assert.ok(!ids.has(a.id)); ids.add(a.id);
    assert.ok(SB.GRUPPEN[a.gruppe], a.id);
    const vorrat = zaehle(a.woerter);
    for (const l of a.loesungen) {
      const bedarf = zaehle(l);
      for (const [w, n] of Object.entries(bedarf)) assert.ok((vorrat[w] || 0) >= n, `${a.id}: „${w}“ fehlt im Vorrat`);
      assert.equal(SB.pruefe(a, l).ok, true, a.id);
      // Groß-/Kleinschreibung spielt keine Rolle
      assert.equal(SB.pruefe(a, l.map(w => w.toUpperCase())).ok, true, a.id);
    }
    for (const t of a.tipps) {
      assert.ok(vorrat[norm(t.wort)], `${a.id}: Tipp-Wort ${t.wort} nicht im Vorrat`);
      assert.ok(!a.loesungen[0].map(norm).includes(norm(t.wort)), `${a.id}: Tipp-Wort ${t.wort} gehört zur Lösung`);
    }
    // vertauschte Reihenfolge wird erkannt
    const l = a.loesungen[0].slice(); [l[0], l[l.length - 1]] = [l[l.length - 1], l[0]];
    if (!a.loesungen.some(x => x.join() === l.join())) assert.match(SB.pruefe(a, l).meldung, /Reihenfolge/, a.id);
  }
  // Jede Gruppe des Labors hat mindestens eine Aufgabe; if-Sätze aller drei Typen
  for (const g of Object.keys(SB.GRUPPEN)) assert.ok(SB.AUFGABEN.some(a => a.gruppe === g), g);
  assert.deepEqual(plain(SB.AUFGABEN.filter(a => a.gruppe === 'if').map(a => a.typ).sort()), ['I', 'II', 'III']);
});

test('Satzbaukasten: gezielte Rückmeldungen bei typischen Fehlern', () => {
  const a = id => SB.AUFGABEN.find(x => x.id === id);
  assert.match(SB.pruefe(a('f1'), ['where', 'did', 'you', 'spent', 'your', 'holidays']).meldung, /Grundform/);
  assert.match(SB.pruefe(a('f2'), ['who', 'did', 'break', 'the', 'window']).meldung, /kein did/);
  assert.match(SB.pruefe(a('i1'), ['if', 'it', 'rains', 'tomorrow,', 'we', 'would', 'stay', 'at', 'home']).meldung, /Typ I/);
  assert.match(SB.pruefe(a('r1'), ['Mia', 'said', 'she', 'is', 'tired']).meldung, /zurück/);
  assert.match(SB.pruefe(a('w1'), ['I', 'met']).meldung, /fehlen/);
  assert.equal(SB.pruefe(a('w1'), []).ok, false);
  assert.equal(SB.satz(['yesterday', 'I', 'met', 'my', 'friends', 'in', 'the', 'park'], '.'), 'Yesterday I met my friends in the park.');
});
