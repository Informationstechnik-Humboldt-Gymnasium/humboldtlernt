// Tests für den Molecule Builder (Reiter „Moleküle“ im Atom- & Chemielabor): Atome und Bindungen anlegen/löschen,
// Referenzprüfung, Valenzbewertung (gültig / unvollständig / Regelverletzung / nicht abschließend beurteilbar),
// Summenformel, strukturelle Erkennung (unabhängig von der Lage), Molekül entfernen, Import, Lernaufgaben.
// Undo/Redo arbeitet in der Oberfläche mit Modell-Kopien; getestet wird hier, dass kopie() unabhängige Stände liefert.
// Ab Test 20: räumliche Anordnung für die 3D-Ansicht (raum.js) – Modellwinkel, gemessene Winkel, Ringe, Robustheit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lessons/sandbox-chemielabor');
const ctx = vm.createContext({});
for (const f of ['daten-elemente.js', 'daten-nuklide.js', 'daten-stoffe.js', 'chemie.js', 'molekuel.js', 'aufgaben-molekuel.js', 'raum.js']) {
  vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
}
const { molekuel: M, molekuelAufgaben: A, daten: D, raum: R } = ctx.CL;
const plain = x => JSON.parse(JSON.stringify(x));

/** Molekül aus Elementliste und Bindungen [i, j, ordnung] bauen – nur über die öffentlichen Funktionen. */
function bau(atome, bindungen, verschiebung = 0) {
  const m = M.neu();
  const ids = atome.map((el, i) => M.atomHinzu(m, el, i * 37 + verschiebung, (i % 3) * 53 - verschiebung).id);
  for (const [a, b, o] of bindungen) assert.ok(M.setzeBindung(m, ids[a], ids[b], o).ok, `Bindung ${a}-${b}`);
  return { m, ids };
}
const WASSER = [['O', 'H', 'H'], [[0, 1, 1], [0, 2, 1]]];
const CO2 = [['O', 'C', 'O'], [[1, 0, 2], [1, 2, 2]]];
const METHAN = [['H', 'H', 'C', 'H', 'H'], [[2, 0, 1], [2, 1, 1], [2, 3, 1], [2, 4, 1]]];
const AMMONIAK = [['H', 'N', 'H', 'H'], [[1, 0, 1], [1, 2, 1], [1, 3, 1]]];

// ------------------------------------------------------------------ Bearbeiten
test('1 · Atome anlegen und löschen; Bindungen verschwinden mit ihren Atomen', () => {
  const m = M.neu();
  const c = M.atomHinzu(m, 'C', 0, 0), h = M.atomHinzu(m, 'H', 50, 0), p = M.atomHinzu(m, 'P', 0, 60);
  assert.deepEqual(plain(m.atome.map(a => a.el)), ['C', 'H', 'P']);
  assert.notEqual(c.id, h.id); assert.notEqual(h.id, p.id);
  assert.equal(M.atomHinzu(m, 'Na', 0, 0), null, 'nur Elemente der Bibliothek');
  assert.equal(M.atomHinzu(m, 'Xx', 0, 0), null);
  M.setzeBindung(m, c.id, h.id, 1);
  assert.ok(M.atomEntfernen(m, c.id));
  assert.equal(m.atome.length, 2);
  assert.equal(m.bindungen.length, 0, 'keine Bindung zeigt mehr ins Leere');
  assert.equal(M.atomEntfernen(m, 999), false);
  assert.ok(M.validiere(m).ok);
  // Neue IDs werden nie wiederverwendet
  const neu = M.atomHinzu(m, 'O', 0, 0);
  assert.ok(neu.id > p.id);
});

test('2 · Bibliothek: H, C, N, O, S, P, F, Cl mit Bindigkeit und Außenelektronen', () => {
  const soll = { H: [1, 1], C: [4, 4], N: [3, 5], O: [2, 6], S: [2, 6], P: [3, 5], F: [1, 7], Cl: [1, 7] };
  assert.deepEqual(Object.keys(D.BAUKASTEN).sort(), Object.keys(soll).sort());
  for (const [el, [bind, val]] of Object.entries(soll)) {
    assert.equal(D.BAUKASTEN[el].bindigkeit, bind, el);
    assert.equal(D.BAUKASTEN[el].valenz, val, el);
    // Außenelektronen passen zur Elektronenkonfiguration (äußerste Schale)
    assert.equal(ctx.CL.chemie.konfiguration(ctx.CL.chemie.element(el).z).valenzelektronen, val, `${el}: Valenzelektronen`);
  }
});

test('3 · Bindungen setzen, ändern und löschen; nur chemisch mögliche Ordnungen', () => {
  const { m, ids } = bau(['C', 'C', 'O', 'H'], []);
  const [c1, c2, o, h] = ids;
  assert.deepEqual(plain(M.setzeBindung(m, c1, c2, 3)), { ok: true, ordnung: 3 });
  assert.equal(M.bindungZwischen(m, c2, c1).ordnung, 3, 'Richtung egal');
  assert.equal(M.setzeBindung(m, c1, c2, 2).ok, true);
  assert.equal(M.bindungZwischen(m, c1, c2).ordnung, 2);
  assert.equal(m.bindungen.length, 1, 'Ändern legt keine zweite Bindung an');
  const ho = M.setzeBindung(m, h, o, 2);
  assert.equal(ho.ok, false); assert.match(ho.grund, /Wasserstoff bildet nur Einfachbindungen/);
  const oo = M.setzeBindung(m, o, c1, 3);
  assert.equal(oo.ok, false); assert.match(oo.grund, /Dreifachbindung ist für Sauerstoff/);
  assert.equal(M.setzeBindung(m, c1, c1, 1).ok, false, 'nicht mit sich selbst');
  assert.equal(M.setzeBindung(m, c1, 999, 1).ok, false, 'nur vorhandene Atome');
  assert.equal(M.setzeBindung(m, c1, o, 4).ok, false, 'Ordnung 4 gibt es nicht');
  assert.equal(M.setzeBindung(m, c1, o, 0).ok, false, 'Löschen ohne Bindung');
  assert.equal(M.setzeBindung(m, c1, c2, 0).ok, true);
  assert.equal(m.bindungen.length, 0);
  // Weiterschalten überspringt unmögliche Ordnungen
  const oh = bau(['O', 'O'], []);
  assert.deepEqual([1, 2, 3].map(() => M.verbinde(oh.m, oh.ids[0], oh.ids[1])), [1, 2, 0]);
  assert.ok(M.validiere(m).ok);
});

test('4 · Formale Prüfung erkennt kaputte Referenzen, doppelte IDs und ungültige Ordnungen', () => {
  assert.equal(M.validiere(null).ok, false);
  const kaputt = { atome: [{ id: 1, el: 'C', x: 0, y: 0 }, { id: 1, el: 'H', x: 0, y: 0 }, { id: 2, el: 'Xx', x: 0, y: 0 }, { id: 3, el: 'O', x: NaN, y: 0 }],
    bindungen: [{ a: 1, b: 9, ordnung: 1 }, { a: 1, b: 1, ordnung: 1 }, { a: 1, b: 2, ordnung: 5 }, { a: 1, b: 2, ordnung: 1 }], naechsteId: 2 };
  const v = M.validiere(kaputt);
  assert.equal(v.ok, false);
  for (const muster of [/doppelt vergeben/, /„Xx“/, /keine gültige Position/, /Atom, das es nicht gibt/, /mit sich selbst/, /ungültige Bindungsordnung/, /mehrere Bindungen/, /Zähler/]) {
    assert.ok(v.fehler.some(f => muster.test(f)), `erwartet: ${muster}`);
  }
  for (const [atome, bindungen] of [WASSER, CO2, METHAN, AMMONIAK]) assert.deepEqual(plain(M.validiere(bau(atome, bindungen).m)), { ok: true, fehler: [] });
});

test('5 · Import übernimmt nur gültige Teile und vergibt neue IDs', () => {
  const r = M.importiere({ atome: [{ id: 7, el: 'O', x: 0, y: 0 }, { id: 8, el: 'H', x: 40, y: 0 }, { id: 8, el: 'H', x: 0, y: 0 }, { id: 9, el: 'U', x: 0, y: 0 }],
    bindungen: [{ a: 7, b: 8, ordnung: 1 }, { a: 7, b: 99, ordnung: 1 }, { a: 7, b: 8, ordnung: 3 }] });
  assert.ok(r.ok);
  assert.equal(r.modell.atome.length, 2);
  assert.equal(r.modell.bindungen.length, 1);
  assert.ok(r.hinweise.length >= 3);
  assert.ok(M.validiere(r.modell).ok);
  assert.equal(M.importiere({}).ok, false);
  assert.equal(M.importiere(null).ok, false);
});

test('6 · Kopien sind unabhängig (Grundlage für Rückgängig/Wiederholen)', () => {
  const { m, ids } = bau(...WASSER);
  const vorher = M.kopie(m);
  M.atomEntfernen(m, ids[1]);
  assert.equal(vorher.atome.length, 3);
  assert.equal(vorher.bindungen.length, 2);
  assert.equal(M.analyse(vorher)[0].molekuelId, 'h2o', 'alter Stand ist unverändert');
  assert.equal(M.analyse(m)[0].status, 'unvollstaendig');
});

// ------------------------------------------------------------------ Bewertung und Erkennung
test('7 · Wasser, Kohlenstoffdioxid, Methan und Ammoniak werden strukturell erkannt – auch anders angeordnet', () => {
  for (const [def, id, formel] of [[WASSER, 'h2o', 'H₂O'], [CO2, 'co2', 'CO₂'], [METHAN, 'ch4', 'CH₄'], [AMMONIAK, 'nh3', 'H₃N']]) {
    for (const verschiebung of [0, 300, -517]) {
      const a = M.analyse(bau(def[0], def[1], verschiebung).m);
      assert.equal(a.length, 1);
      assert.equal(a[0].status, 'gueltig', id);
      assert.equal(a[0].bekannt, true, id);
      assert.equal(a[0].molekuelId, id);
      assert.equal(a[0].formel, formel);
    }
  }
});

test('8 · Alle Beispielmoleküle des Datensatzes werden erkannt; Molekülinfos stimmen', () => {
  for (const mol of D.MOLEKUELE) {
    const a = M.analyse(M.beispiel(mol.id));
    assert.equal(a.length, 1, mol.id);
    assert.equal(a[0].status, 'gueltig', `${mol.id}: ${a[0].meldungen.map(x => x.text).join(' ')}`);
    assert.equal(a[0].molekuelId, mol.id);
    assert.equal(a[0].atomAnzahl, mol.atome.length);
    assert.equal(a[0].bindungAnzahl, mol.bindungen.length);
    const typen = { 1: 0, 2: 0, 3: 0 };
    mol.bindungen.forEach(b => typen[b[2]]++);
    assert.deepEqual(plain(a[0].bindungsTypen), typen, mol.id);
  }
  const co2 = M.analyse(bau(...CO2).m)[0];
  assert.deepEqual(plain(co2.bindungsTypen), { 1: 0, 2: 2, 3: 0 });
  const hcn = M.analyse(M.beispiel('hcn'))[0];
  assert.equal(hcn.formel, 'CHN'); assert.equal(hcn.bindungsTypen[3], 1);
});

test('9 · Summenformel nach Hill', () => {
  const f = def => M.analyse(bau(...def).m)[0].formel;
  assert.equal(f([['C', 'C', 'O', 'H', 'H', 'H', 'H', 'H', 'H'], [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1]]]), 'C₂H₆O');
  assert.equal(f([['P', 'Cl', 'Cl', 'Cl'], [[0, 1, 1], [0, 2, 1], [0, 3, 1]]]), 'Cl₃P');
  assert.equal(f([['S', 'H', 'H'], [[0, 1, 1], [0, 2, 1]]]), 'H₂S');
  assert.equal(f([['C'], []]), 'C');
});

test('10 · Gleiche Summenformel, andere Struktur: Isomere werden unterschieden', () => {
  const ethanol = M.analyse(M.beispiel('c2h5oh'))[0];
  const ether = M.analyse(bau(['C', 'O', 'C', 'H', 'H', 'H', 'H', 'H', 'H'], [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [2, 6, 1], [2, 7, 1], [2, 8, 1]]).m)[0];
  assert.equal(ethanol.formel, ether.formel);
  assert.equal(ethanol.molekuelId, 'c2h5oh');
  assert.equal(ether.status, 'gueltig');
  assert.equal(ether.bekannt, false);
  assert.equal(ether.name, null, 'kein erfundener Name');
});

test('11 · Vier Stufen: gültig, unvollständig, Regelverletzung, nicht abschließend beurteilbar', () => {
  const ch5 = M.analyse(bau(['C', 'H', 'H', 'H', 'H', 'H'], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]]).m)[0];
  assert.equal(ch5.status, 'verletzung');
  assert.ok(ch5.meldungen.some(x => x.art === 'fehler' && /Kohlenstoff hat in diesem Modell seine übliche Bindigkeit überschritten \(5 statt 4\)/.test(x.text)));
  assert.equal(ch5.bekannt, false); assert.equal(ch5.geometrie.length, 0);

  const oh = M.analyse(bau(['O', 'H'], [[0, 1, 1]]).m)[0];
  assert.equal(oh.status, 'unvollstaendig');
  assert.ok(oh.meldungen.some(x => x.art === 'offen' && /Sauerstoff besitzt noch eine freie Bindungsmöglichkeit/.test(x.text)));
  assert.equal(M.analyse(bau(['C'], []).m)[0].status, 'unvollstaendig');

  const sf4 = M.analyse(bau(['S', 'F', 'F', 'F', 'F'], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]]).m)[0];
  assert.equal(sf4.status, 'unklar');
  assert.ok(sf4.meldungen.some(x => x.art === 'unklar' && /nicht abschließend beurteilen/.test(x.text)));
  const pcl5 = M.analyse(bau(['P', 'Cl', 'Cl', 'Cl', 'Cl', 'Cl'], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]]).m)[0];
  assert.equal(pcl5.status, 'unklar');
  // Mehr als in jeder bekannten Verbindung → echte Regelverletzung
  const s7 = bau(['S', 'F', 'F', 'F', 'F', 'F', 'F', 'F'], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1], [0, 7, 1]]);
  assert.equal(M.analyse(s7.m)[0].status, 'verletzung');
  // Unvollständig hat Vorrang vor „unklar“; Regelverletzung vor allem anderen
  const gemischt = M.analyse(bau(['S', 'F', 'F', 'F', 'O'], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]]).m)[0];
  assert.equal(gemischt.status, 'unvollstaendig');
  // Ungültige Bindungsordnung (z. B. aus beschädigten Daten) wird als Regelverletzung erkannt
  const m = M.neu(); const h1 = M.atomHinzu(m, 'H', 0, 0), h2 = M.atomHinzu(m, 'H', 40, 0);
  m.bindungen.push({ a: h1.id, b: h2.id, ordnung: 2 });
  const hh = M.analyse(m)[0];
  assert.equal(hh.status, 'verletzung');
  assert.ok(hh.meldungen.some(x => /Doppelbindung ist zwischen Wasserstoff und Wasserstoff/.test(x.text)));
});

test('12 · Mehrere Moleküle werden getrennt bewertet; „Molekül entfernen“ lässt den Rest stehen', () => {
  const m = M.beispiel('h2o');
  const n = M.beispiel('ch4');
  const off = Math.max(...m.atome.map(a => a.id));
  n.atome.forEach(a => { m.atome.push({ ...a, id: a.id + off }); });
  n.bindungen.forEach(b => m.bindungen.push({ a: b.a + off, b: b.b + off, ordnung: b.ordnung }));
  m.naechsteId = off + n.naechsteId;
  assert.ok(M.validiere(m).ok);
  assert.deepEqual(plain(M.analyse(m).map(t => t.molekuelId).sort()), ['ch4', 'h2o']);
  const c = m.atome.find(x => x.el === 'C').id;
  assert.equal(M.molekuelVon(m, c).length, 5);
  assert.equal(M.molekuelEntfernen(m, c), 5);
  assert.deepEqual(plain(M.analyse(m).map(t => t.molekuelId)), ['h2o']);
  assert.equal(M.molekuelEntfernen(m, 999), 0);
  assert.ok(M.validiere(m).ok);
});

test('13 · Atominfo: Ordnungszahl, Außenelektronen, Bindigkeit, aktuelle Bindungen', () => {
  const { m, ids } = bau(...CO2);
  const c = M.atomInfo(m, ids[1]);
  assert.equal(c.name, 'Kohlenstoff'); assert.equal(c.z, 6); assert.equal(c.valenzelektronen, 4); assert.equal(c.bindigkeit, 4);
  assert.deepEqual(plain(c.bindungen), { 1: 0, 2: 2, 3: 0 }); assert.equal(c.summe, 4); assert.equal(c.frei, 0); assert.equal(c.partner, 2);
  const o = M.atomInfo(m, ids[0]);
  assert.equal(o.freiePaare, 2); assert.equal(o.frei, 0);
  const p = M.atomInfo(bau(['P'], []).m, 1);
  assert.equal(p.z, 15); assert.equal(p.erweitert, 5); assert.equal(p.frei, 3);
  assert.equal(M.atomInfo(m, 999), null);
});

test('14 · Geometrie nach dem Elektronenpaarabstoßungsmodell, gemessene Winkel nur wo hinterlegt', () => {
  const geo = id => M.analyse(M.beispiel(id))[0].geometrie;
  assert.equal(geo('h2o')[0].geometrie.name, 'gewinkelt'); assert.equal(geo('h2o')[0].gemessen, 104.5);
  assert.equal(geo('ch4')[0].geometrie.name, 'tetraedrisch');
  assert.equal(geo('nh3')[0].geometrie.name, 'trigonal-pyramidal'); assert.equal(geo('nh3')[0].gemessen, 106.7);
  assert.equal(geo('ph3')[0].geometrie.name, 'trigonal-pyramidal'); assert.equal(geo('ph3')[0].gemessen, 93.3);
  assert.equal(geo('pcl3')[0].gemessen, null, 'kein Messwert hinterlegt → keiner angezeigt');
  assert.equal(geo('co2')[0].geometrie.name, 'linear');
  assert.equal(geo('hcn')[0].geometrie.name, 'linear');
  assert.equal(geo('ch2o')[0].geometrie.name, 'trigonal-planar'); assert.equal(geo('ch2o')[0].gemessen, null);
});

// ------------------------------------------------------------------ Lernaufgaben
test('15 · Lernaufgaben: mindestens die sieben geforderten, alle vollständig beschrieben', () => {
  const ids = A.liste.map(a => a.id);
  for (const id of ['wasser', 'kohlendioxid', 'methan', 'ammoniak', 'sauerstoff', 'doppelbindung', 'fehler-ethen']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  for (const a of A.liste) for (const f of ['titel', 'text', 'tipp', 'erklaerung']) assert.ok(typeof a[f] === 'string' && a[f].length > (f === 'titel' ? 2 : 10), `${a.id}.${f}`);
});

test('16 · Lernaufgaben werden strukturell bewertet: Lösung in beliebiger Anordnung, Fehlversuche mit passender Rückmeldung', () => {
  const p = (id, m) => A.finde(id).pruefe(m);
  assert.equal(p('wasser', M.neu()).ok, false);
  assert.match(p('wasser', M.neu()).text, /leer/);
  assert.equal(p('wasser', bau(...WASSER, 123).m).ok, true);
  assert.equal(p('kohlendioxid', bau(...CO2, -40).m).ok, true);
  assert.equal(p('methan', bau(...METHAN, 77).m).ok, true);
  assert.equal(p('ammoniak', bau(...AMMONIAK, 9).m).ok, true);
  assert.equal(p('sauerstoff', bau(['O', 'O'], [[0, 1, 2]]).m).ok, true);
  // Falsche Formel / richtige Formel, aber Bindungen falsch
  assert.match(p('wasser', bau(['O', 'H'], [[0, 1, 1]]).m).text, /Summenformel stimmt noch nicht/);
  const co2einfach = p('kohlendioxid', bau(['O', 'C', 'O'], [[1, 0, 1], [1, 2, 1]]).m);
  assert.equal(co2einfach.ok, false); assert.match(co2einfach.text, /Die Atome stimmen/);
  assert.equal(p('sauerstoff', bau(['O', 'O'], [[0, 1, 1]]).m).ok, false);
  // Mit zusätzlichen Atomen auf der Fläche wird die Lösung trotzdem erkannt
  const extra = bau(['O', 'H', 'H', 'C'], [[0, 1, 1], [0, 2, 1]]);
  assert.equal(p('wasser', extra.m).ok, true);
});

test('17 · Aufgabe „Doppelbindung“: nur gültige Strukturen mit Doppelbindung; unbekannte Stoffe ehrlich benannt', () => {
  const p = m => A.finde('doppelbindung').pruefe(m);
  assert.equal(p(bau(...WASSER).m).ok, false);
  assert.equal(p(bau(['C', 'O'], [[0, 1, 2]]).m).ok, false, 'C hat noch freie Bindungen');
  const ethen = p(M.beispiel('c2h4'));
  assert.equal(ethen.ok, true); assert.match(ethen.text, /Ethen/);
  // Gültig, aber nicht im Datensatz: H₂C=S (Thioformaldehyd ist nicht hinterlegt) → ok, mit Hinweis
  const unbekannt = p(bau(['C', 'S', 'H', 'H'], [[0, 1, 2], [0, 2, 1], [0, 3, 1]]).m);
  assert.equal(unbekannt.ok, true); assert.match(unbekannt.text, /kann das Labor nicht sagen/);
});

test('18 · Fehler-Aufgaben: Startstruktur ist fehlerhaft, die Korrektur wird erkannt', () => {
  for (const [id, molId, status] of [['fehler-ethen', 'c2h4', 'unvollstaendig'], ['fehler-methan', 'ch4', 'verletzung']]) {
    const a = A.finde(id);
    const start = a.start();
    assert.ok(M.validiere(start).ok, id);
    assert.equal(M.analyse(start)[0].status, status, id);
    assert.equal(a.pruefe(start).ok, false);
    assert.equal(a.pruefe(M.beispiel(molId)).ok, true);
  }
  // Korrektur direkt an der Startstruktur
  const e = A.finde('fehler-ethen').start();
  const cs = e.atome.filter(x => x.el === 'C').map(x => x.id);
  assert.ok(M.setzeBindung(e, cs[0], cs[1], 2).ok);
  assert.equal(A.finde('fehler-ethen').pruefe(e).ok, true);
  const m = A.finde('fehler-methan').start();
  const zuviel = m.atome.filter(x => x.el === 'H').pop().id;
  M.atomEntfernen(m, zuviel);
  assert.equal(A.finde('fehler-methan').pruefe(m).ok, true);
});

test('19 · Robustheit: leere Fläche, gelöschte Atome, große Modelle', () => {
  assert.deepEqual(plain(M.analyse(M.neu())), []);
  assert.deepEqual(plain(M.teile(M.neu())), []);
  const m = M.neu();
  for (let i = 0; i < M.MAX_ATOME; i++) assert.ok(M.atomHinzu(m, 'C', i, 0));
  assert.equal(M.atomHinzu(m, 'C', 0, 0), null, 'Obergrenze');
  // Lange Kette + Erkennung bleibt schnell
  for (let i = 1; i < M.MAX_ATOME; i++) M.setzeBindung(m, m.atome[i - 1].id, m.atome[i].id, 1);
  const t0 = Date.now();
  const a = M.analyse(m);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(a.length, 1); assert.equal(a[0].status, 'unvollstaendig');
});

// ------------------------------------------------------------------ 3D-Ansicht (raum.js)
const TETRA = Math.acos(-1 / 3) * 180 / Math.PI;
/** Molekül mit 2D-Positionen bauen (für Ringe: so, wie man sie zeichnet). */
function bauXY(atome, xy, bindungen) {
  const m = M.neu();
  const ids = atome.map((el, i) => M.atomHinzu(m, el, xy[i][0], xy[i][1]).id);
  for (const [a, b, o] of bindungen) assert.ok(M.setzeBindung(m, ids[a], ids[b], o).ok);
  return { m, ids };
}
/** Räumliche Daten + Hilfen: Position, Winkel an einem Atom, Bindungslängen. */
function raum(m, optionen) {
  const r = R.berechne(m, optionen), P = {};
  r.atome.forEach(a => { P[a.id] = a.p; });
  const winkelAn = id => {
    const nb = M.nachbarn(m, id).map(x => x.id), out = [];
    for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) out.push(R.winkelAus(P[id], P[nb[i]], P[nb[j]]));
    return out;
  };
  const abstand = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]);
  return { r, P, winkelAn, abstand };
}
const nahe = (x, soll, tol, text) => assert.ok(Math.abs(x - soll) <= tol, `${text}: ${x.toFixed(2)} statt ${soll}`);

test('20 · 3D: Modellwinkel nach dem Elektronenpaarabstoßungsmodell, schematische Bindungslängen', () => {
  const ch4 = bau(...METHAN), w = raum(ch4.m);
  assert.equal(w.winkelAn(ch4.ids[2]).length, 6);
  w.winkelAn(ch4.ids[2]).forEach(x => nahe(x, TETRA, 0.05, 'CH₄'));
  ch4.m.bindungen.forEach(b => nahe(w.abstand(b.a, b.b), R.L_H, 1e-9, 'C–H'));
  const co2 = bau(...CO2), c = raum(co2.m);
  nahe(c.winkelAn(co2.ids[1])[0], 180, 0.01, 'CO₂ linear');
  co2.m.bindungen.forEach(b => nahe(c.abstand(b.a, b.b), R.L_SCHWER, 1e-9, 'C=O'));
  const ch2o = M.beispiel('ch2o'), f = raum(ch2o);
  f.winkelAn(ch2o.atome[0].id).forEach(x => nahe(x, 120, 0.05, 'Methanal trigonal-planar'));
  const pcl5 = bau(['P', 'Cl', 'Cl', 'Cl', 'Cl', 'Cl'], [1, 2, 3, 4, 5].map(i => [0, i, 1])), p = raum(pcl5.m);
  assert.deepEqual([...new Set(p.winkelAn(pcl5.ids[0]).map(Math.round))].sort((a, b) => a - b), [90, 120, 180], 'PCl₅ trigonal-bipyramidal');
  const sf6 = bau(['S', 'F', 'F', 'F', 'F', 'F', 'F'], [1, 2, 3, 4, 5, 6].map(i => [0, i, 1])), s = raum(sf6.m);
  assert.deepEqual([...new Set(s.winkelAn(sf6.ids[0]).map(Math.round))].sort((a, b) => a - b), [90, 180], 'SF₆ oktaedrisch');
});

test('21 · 3D: gemessene Winkel nur, wo sie im Datensatz stehen – sonst Modellwinkel', () => {
  const wasser = bau(...WASSER);
  raum(wasser.m).winkelAn(wasser.ids[0]).forEach(x => nahe(x, TETRA, 0.05, 'H₂O ohne Messwert'));
  const mw = plain(R.messwinkel(M.analyse(wasser.m)));
  assert.deepEqual(mw, { [wasser.ids[0]]: 104.5 });
  nahe(raum(wasser.m, { winkel: mw }).winkelAn(wasser.ids[0])[0], 104.5, 0.01, 'H₂O gemessen');
  const nh3 = bau(...AMMONIAK), wn = raum(nh3.m, { winkel: R.messwinkel(M.analyse(nh3.m)) });
  wn.winkelAn(nh3.ids[1]).forEach(x => nahe(x, 106.7, 0.01, 'NH₃ gemessen'));
  // Unbekannte Struktur ohne Messwert: keine Winkel
  const ethanol = M.beispiel('c2h5oh');
  assert.deepEqual(plain(R.messwinkel(M.analyse(ethanol))), {});
  // Alle Datensatz-Moleküle mit Messwert: der angezeigte Winkel am Zentralatom ist genau der hinterlegte
  for (const mol of D.MOLEKUELE.filter(x => x.winkel)) {
    const m = M.beispiel(mol.id), mw2 = R.messwinkel(M.analyse(m)), ids = Object.keys(mw2).map(Number);
    assert.equal(ids.length, 1, mol.id);
    raum(m, { winkel: mw2 }).winkelAn(ids[0]).forEach(x => nahe(x, mol.winkel, 0.1, mol.id));
  }
});

test('22 · 3D: freie Elektronenpaare und offene Bindungsmöglichkeiten', () => {
  const zaehle = (m, art) => R.berechne(m).extras.filter(e => e.art === art).length;
  assert.equal(zaehle(bau(...WASSER).m, 'paar'), 2);
  assert.equal(zaehle(bau(...AMMONIAK).m, 'paar'), 1);
  assert.equal(zaehle(bau(...METHAN).m, 'paar'), 0);
  assert.equal(zaehle(bau(...CO2).m, 'paar'), 4, 'je zwei an den O-Atomen');
  const so2 = bau(['O', 'S', 'O'], [[1, 0, 2], [1, 2, 2]]);
  assert.equal(R.berechne(so2.m).extras.filter(e => e.atom === so2.ids[1] && e.art === 'paar').length, 1, 'S in SO₂: ein freies Paar');
  const sf6 = bau(['S', 'F', 'F', 'F', 'F', 'F', 'F'], [1, 2, 3, 4, 5, 6].map(i => [0, i, 1]));
  assert.equal(R.berechne(sf6.m).extras.filter(e => e.atom === sf6.ids[0]).length, 0, 'S in SF₆: keine freien Paare');
  assert.equal(zaehle(bau(['C', 'H', 'H'], [[0, 1, 1], [0, 2, 1]]).m, 'offen'), 2, 'CH₂: zwei offene Bindungsmöglichkeiten');
  assert.equal(zaehle(bau(['C'], []).m, 'offen'), 4);
  // Richtungen sind Einheitsvektoren und zeigen nicht in eine Bindung hinein
  const nh3 = bau(...AMMONIAK), w = raum(nh3.m);
  for (const e of w.r.extras) {
    nahe(Math.hypot(...e.richtung), 1, 1e-9, 'Einheitsvektor');
    for (const nb of M.nachbarn(nh3.m, e.atom)) {
      const p = w.P[e.atom], q = w.P[nb.id], d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      const cos = ((q[0] - p[0]) * e.richtung[0] + (q[1] - p[1]) * e.richtung[1] + (q[2] - p[2]) * e.richtung[2]) / d;
      assert.ok(cos < 0.5, 'Paar liegt nicht auf einer Bindung');
    }
  }
});

test('23 · 3D: Doppelbindungen eben, Ketten gestaffelt', () => {
  const ethen = M.beispiel('c2h4'), w = raum(ethen);
  const ids = ethen.atome.map(a => a.id), P = ids.map(id => w.P[id]);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const n = kreuz(sub(P[1], P[0]), sub(P[2], P[0])), nl = Math.hypot(...n);
  P.forEach((p, i) => nahe(Math.abs((sub(p, P[0])[0] * n[0] + sub(p, P[0])[1] * n[1] + sub(p, P[0])[2] * n[2]) / nl), 0, 1e-6, 'Ethen eben, Atom ' + i));
  const doppel = w.r.bindungen.find(b => b.ordnung === 2);
  nahe(Math.abs(doppel.normale[0] * n[0] + doppel.normale[1] * n[1] + doppel.normale[2] * n[2]) / nl, 0, 1e-6, 'Doppelstrich liegt in der Molekülebene');
  // Ethan: gestaffelt → H–C–C–H-Diederwinkel 60° und 180°
  const ethan = M.beispiel('c2h6'), e = raum(ethan), [c1, c2] = ethan.atome.filter(a => a.el === 'C').map(a => a.id);
  const h1 = M.nachbarn(ethan, c1).map(x => x.id).filter(id => id !== c2), h2 = M.nachbarn(ethan, c2).map(x => x.id).filter(id => id !== c1);
  const dieder = (a, b, c, d) => {
    const b1 = sub(e.P[b], e.P[a]), b2 = sub(e.P[c], e.P[b]), b3 = sub(e.P[d], e.P[c]);
    const n1 = kreuz(b1, b2), n2 = kreuz(b2, b3);
    const x = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2], y = Math.hypot(...b2) * (b1[0] * n2[0] + b1[1] * n2[1] + b1[2] * n2[2]);
    return Math.abs(Math.atan2(y, x) * 180 / Math.PI);
  };
  const werte = h1.flatMap(a => h2.map(b => Math.round(dieder(a, c1, c2, b))));
  assert.ok(werte.every(x => x === 60 || x === 180), 'gestaffelt: ' + werte);
  assert.ok(werte.includes(180));
});

test('24 · 3D: Ringe werden angenähert (Benzol eben, Cyclohexan gewellt, Cyclopropan 60°)', () => {
  const kreis = (n, r, d = 0) => Array.from({ length: n }, (_, i) => [r * Math.cos(i * 2 * Math.PI / n) + d, r * Math.sin(i * 2 * Math.PI / n)]);
  const ring = n => Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);
  const benzol = bauXY([...Array(6).fill('C'), ...Array(6).fill('H')], [...kreis(6, 70), ...kreis(6, 130)],
    [...ring(6).map(([a, b], i) => [a, b, i % 2 ? 1 : 2]), ...Array.from({ length: 6 }, (_, i) => [i, 6 + i, 1])]);
  const wb = raum(benzol.m);
  benzol.ids.slice(0, 6).forEach(id => wb.winkelAn(id).forEach(x => nahe(x, 120, 1.5, 'Benzol')));
  ring(6).forEach(([a, b]) => nahe(wb.abstand(benzol.ids[a], benzol.ids[b]), 1, 0.03, 'Benzol C–C'));
  const hy = kreis(6, 70).flatMap(([x, y]) => [[x * 1.8 + 10, y * 1.8], [x * 1.8 - 10, y * 1.8]]);
  const cyclo = bauXY([...Array(6).fill('C'), ...Array(12).fill('H')], [...kreis(6, 70), ...hy],
    [...ring(6).map(([a, b]) => [a, b, 1]), ...Array.from({ length: 6 }, (_, i) => [[i, 6 + 2 * i, 1], [i, 7 + 2 * i, 1]]).flat()]);
  const wc = raum(cyclo.m);
  cyclo.ids.slice(0, 6).forEach(id => wc.winkelAn(id).forEach(x => nahe(x, TETRA, 5, 'Cyclohexan')));
  const zs = cyclo.ids.slice(0, 6).map(id => wc.P[id][2]);
  assert.ok(Math.max(...zs) - Math.min(...zs) > 0.3, 'Cyclohexan ist nicht eben');
  const prop = bauXY(['C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H'], [[0, 0], [60, 0], [30, 50], [-40, -30], [-40, 30], [100, -30], [100, 30], [0, 90], [60, 90]],
    [[0, 1, 1], [1, 2, 1], [2, 0, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [2, 7, 1], [2, 8, 1]]);
  const wp = raum(prop.m);
  nahe(R.winkelAus(wp.P[prop.ids[0]], wp.P[prop.ids[1]], wp.P[prop.ids[2]]), 60, 2, 'Cyclopropan');
});

test('25 · 3D: Robustheit – leere Fläche, Einzelatome, Regelverletzungen, 40 Atome, mehrere Moleküle', () => {
  assert.deepEqual(plain(R.berechne(M.neu()).atome), []);
  const endlich = r => r.atome.every(a => a.p.every(Number.isFinite)) && r.extras.every(e => e.richtung.every(Number.isFinite));
  const ch5 = bau(['C', 'H', 'H', 'H', 'H', 'H', 'H', 'H'], [1, 2, 3, 4, 5, 6, 7].map(i => [0, i, 1]));
  assert.equal(M.analyse(ch5.m)[0].status, 'verletzung');
  assert.ok(endlich(R.berechne(ch5.m)), 'auch Regelverletzungen werden dargestellt');
  const kette = M.neu();
  for (let i = 0; i < M.MAX_ATOME; i++) M.atomHinzu(kette, i % 5 ? 'C' : 'O', i * 30, (i % 2) * 20);
  for (let i = 1; i < M.MAX_ATOME; i++) M.setzeBindung(kette, kette.atome[i - 1].id, kette.atome[i].id, 1);
  const t0 = Date.now(), rk = R.berechne(kette);
  assert.ok(Date.now() - t0 < 500);
  assert.ok(endlich(rk));
  for (let i = 0; i < rk.atome.length; i++) for (let j = i + 1; j < rk.atome.length; j++) {
    const p = rk.atome[i].p, q = rk.atome[j].p;
    assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 0.5, 'Atome überlappen nicht');
  }
  // Zwei Moleküle nebeneinander, ohne sich zu berühren, in der Reihenfolge der Zeichnung
  const zwei = M.beispiel('h2o', 300, 0);
  const nh3 = M.beispiel('nh3', -300, 0);
  const off = zwei.naechsteId;
  nh3.atome.forEach(a => zwei.atome.push({ ...a, id: a.id + off }));
  nh3.bindungen.forEach(b => zwei.bindungen.push({ a: b.a + off, b: b.b + off, ordnung: b.ordnung }));
  zwei.naechsteId = off + nh3.naechsteId;
  const rz = R.berechne(zwei), teile = M.teile(zwei);
  const xMittel = ids => ids.reduce((s, id) => s + rz.atome.find(a => a.id === id).p[0], 0) / ids.length;
  const [wasserIds, ammoniakIds] = teile[0].some(id => M.atomVon(zwei, id).el === 'O') ? teile : [teile[1], teile[0]];
  assert.ok(xMittel(ammoniakIds) < xMittel(wasserIds), 'links gezeichnet = links im Raum');
  for (const a of wasserIds) for (const b of ammoniakIds) {
    const p = rz.atome.find(x => x.id === a).p, q = rz.atome.find(x => x.id === b).p;
    assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1, 'Moleküle getrennt');
  }
  // Alle Beispielmoleküle: endliche Werte, schematische Längen
  for (const mol of D.MOLEKUELE) {
    const m = M.beispiel(mol.id), w = raum(m, { winkel: R.messwinkel(M.analyse(m)) });
    assert.ok(endlich(w.r), mol.id);
    m.bindungen.forEach(b => nahe(w.abstand(b.a, b.b), M.atomVon(m, b.a).el === 'H' || M.atomVon(m, b.b).el === 'H' ? R.L_H : R.L_SCHWER, 1e-9, mol.id));
  }
});

test('26 · 3D: Three.js liegt lokal mit Lizenz vor und wird vor der 3D-Ansicht geladen', () => {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const lade = f => html.indexOf(`<script src="${f}"></script>`);
  for (const f of ['three.js', 'raum.js', 'ansicht-molekuel-3d.js']) assert.ok(lade(f) > 0, f + ' eingebunden');
  assert.ok(lade('three.js') < lade('ansicht-molekuel-3d.js') && lade('molekuel.js') < lade('raum.js'));
  assert.ok(!/src="https?:/.test(html), 'keine fremden Server');
  const three = fs.readFileSync(path.join(DIR, 'three.js'), 'utf8');
  assert.match(three.slice(0, 600), /SPDX-License-Identifier: MIT/);
  assert.ok(!three.includes('are deprecated with r150+'), 'keine Konsolenwarnung beim Laden');
  assert.match(fs.readFileSync(path.join(DIR, 'THREE-LIZENZ.txt'), 'utf8'), /Permission is hereby granted, free of charge/);
  const c = vm.createContext({});
  vm.runInContext(three, c);
  assert.equal(c.THREE.REVISION, '160');
});
