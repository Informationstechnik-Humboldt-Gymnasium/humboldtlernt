// Tests für das Logik-Labor (Fach Sandbox): Gatter, Signalweitergabe, Schalter, Taster, Takt, 7-Segment-Anzeige,
// Decoder, Relais, Lampen, Farben, Wahrheitstabellen, Speichern/Laden, ungültige Verbindungen, Rückkopplungen, Bedienung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const LESSONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lessons');
const ctx = vm.createContext({});
for (const f of ['sandbox-logik/modell.js', 'sandbox-logik/simulation.js', 'sandbox-logik/wahrheit.js', 'sandbox-schaltkreis/bedienung.js', 'sandbox-logik/zeichnen.js']) {
  vm.runInContext(fs.readFileSync(path.join(LESSONS, f), 'utf8'), ctx, { filename: f });
}
const SL = ctx.SL, M = SL.modell;
const sim = (doc, opt) => SL.sim.auswerten(doc, opt);
const plain = x => JSON.parse(JSON.stringify(x));

/** Gatter mit n Schaltern und einer Lampe. */
function gatter(typ, n = 2) {
  const doc = M.neu();
  const g = M.bauteil(doc, typ, 0, 0, { eingaenge: n });
  const s = [];
  const pins = Object.keys(M.pins(g)).filter(p => p !== 'q');
  pins.forEach((p, i) => { const x = M.bauteil(doc, 'schalter', -200, i * 80); s.push(x); assert.ok(M.verbinde(doc, { b: x.id, a: 'q' }, { b: g.id, a: p }).ok); });
  const y = M.bauteil(doc, 'lampe', 200, 0);
  assert.ok(M.verbinde(doc, { b: g.id, a: 'q' }, { b: y.id, a: 'e' }).ok);
  return { doc, g, s, y };
}
const ERWARTET = {
  und: [0, 0, 0, 1], oder: [0, 1, 1, 1], xor: [0, 1, 1, 0], nand: [1, 1, 1, 0], nor: [1, 0, 0, 0], xnor: [1, 0, 0, 1],
};

test('1 · Wahrheitstabellen aller sieben Gatter (aus der Engine berechnet)', () => {
  for (const [typ, q] of Object.entries(ERWARTET)) {
    const { doc, y } = gatter(typ);
    const t = SL.wahrheit.tabelle(doc);
    assert.equal(t.fehler, '');
    assert.deepEqual(plain(t.eingaenge.map(x => x.name)), ['A', 'B']);
    assert.deepEqual(plain(t.ausgaenge.map(x => x.name)), ['Y']);
    assert.deepEqual(plain(t.zeilen.map(z => z.ein.join(''))), ['00', '01', '10', '11']);
    assert.deepEqual(plain(t.zeilen.map(z => z.aus[0])), q, typ);
    void y;
  }
  const t = SL.wahrheit.tabelle(gatter('nicht').doc);
  assert.deepEqual(plain(t.zeilen.map(z => z.aus[0])), [1, 0], 'NICHT');
});

test('2 · Gatter mit mehr Eingängen: UND/ODER/NAND/NOR über alle, XOR = ungerade Anzahl Einsen', () => {
  for (const n of [3, 4]) {
    for (const typ of ['und', 'oder', 'nand', 'nor', 'xor', 'xnor']) {
      const t = SL.wahrheit.tabelle(gatter(typ, n).doc);
      assert.equal(t.zeilen.length, 2 ** n);
      for (const z of t.zeilen) {
        const einsen = z.ein.filter(Boolean).length;
        const soll = { und: einsen === n, oder: einsen > 0, nand: einsen < n, nor: einsen === 0, xor: einsen % 2 === 1, xnor: einsen % 2 === 0 }[typ] ? 1 : 0;
        assert.equal(z.aus[0], soll, `${typ} mit ${n} Eingängen, ${z.ein.join('')}`);
      }
    }
  }
  // Eingänge reduzieren entfernt Leitungen an weggefallenen Eingängen
  const x = gatter('und', 4);
  M.setzeWert(x.doc, x.g.id, 'eingaenge', 2);
  assert.equal(Object.keys(M.pins(x.g)).length, 3);
  assert.equal(x.doc.draehte.length, 3, 'zwei Schalter + Lampe bleiben verbunden');
  M.setzeWert(x.doc, x.g.id, 'eingaenge', 99);
  assert.equal(x.g.werte.eingaenge, 8);
});

test('3 · Schalter umschalten: Signal läuft durch mehrere Gatter bis zur Lampe', () => {
  // Y = (A UND B) ODER (NICHT C)
  const doc = M.neu();
  const [A, B, C] = [0, 1, 2].map(i => M.bauteil(doc, 'schalter', -300, i * 80));
  const u = M.bauteil(doc, 'und', -100, 40), n = M.bauteil(doc, 'nicht', -100, 160), o = M.bauteil(doc, 'oder', 100, 80), y = M.bauteil(doc, 'lampe', 260, 80);
  const v = (a, pa, b, pb) => assert.ok(M.verbinde(doc, { b: a.id, a: pa }, { b: b.id, a: pb }).ok);
  v(A, 'q', u, 'e1'); v(B, 'q', u, 'e2'); v(C, 'q', n, 'e1'); v(u, 'q', o, 'e1'); v(n, 'q', o, 'e2'); v(o, 'q', y, 'e');
  assert.equal(sim(doc).bauteile[y.id].an, 1, 'C = 0 → NICHT C = 1');
  assert.equal(M.tippAktion(doc, C.id), 'Schalter C = 1');
  let e = sim(doc);
  assert.equal(e.bauteile[y.id].an, 0);
  assert.equal(e.bauteile[n.id].q, 0);
  M.tippAktion(doc, A.id); M.tippAktion(doc, B.id);
  e = sim(doc);
  assert.equal(e.bauteile[u.id].q, 1);
  assert.equal(e.bauteile[y.id].an, 1, 'A UND B = 1');
  assert.equal(e.zyklisch, false);
  // Leitungen tragen das Signal ihres Ausgangs
  const d = doc.draehte.find(x => x.von.b === u.id);
  assert.equal(e.draehte[d.id], 1);
  // Wahrheitstabelle der ganzen Schaltung
  const t = SL.wahrheit.tabelle(doc);
  assert.deepEqual(plain(t.zeilen.map(z => z.aus[0])), [1, 0, 1, 0, 1, 0, 1, 1]);
  assert.equal(t.aktuell, 0b111, 'aktuelle Zeile: A = 1, B = 1, C = 1');
});

test('4 · Taster, Konstanten und Taktgeber', () => {
  const doc = M.neu();
  const t = M.bauteil(doc, 'taster', 0, 0), y = M.bauteil(doc, 'lampe', 200, 0);
  M.verbinde(doc, { b: t.id, a: 'q' }, { b: y.id, a: 'e' });
  assert.equal(sim(doc).bauteile[y.id].an, 0);
  t.werte.gedrueckt = 1;
  assert.equal(sim(doc).bauteile[y.id].an, 1, 'gedrückt halten → 1');
  assert.equal(JSON.parse(M.exportiere(doc)).bauteile[0].werte.gedrueckt, 0, 'gespeichert wird der Taster losgelassen');
  const doc2 = M.neu();
  const h = M.bauteil(doc2, 'eins', 0, 0), l = M.bauteil(doc2, 'null', 0, 100), u = M.bauteil(doc2, 'und', 200, 50), c = M.bauteil(doc2, 'takt', 0, 200, { frequenz: 2 });
  M.verbinde(doc2, { b: h.id, a: 'q' }, { b: u.id, a: 'e1' }); M.verbinde(doc2, { b: c.id, a: 'q' }, { b: u.id, a: 'e2' });
  assert.equal(sim(doc2).bauteile[l.id].q, 0);
  assert.equal(sim(doc2, { t: 0.1 }).bauteile[u.id].q, 1, 'Takt 2 Hz: bei t = 0,1 s ist er 1');
  assert.equal(sim(doc2, { t: 0.3 }).bauteile[u.id].q, 0, 'bei t = 0,3 s ist er 0');
});

test('5 · 7-Segment-Anzeige: Segmente einzeln aus den Eingangssignalen', () => {
  const doc = M.neu();
  const anz = M.bauteil(doc, 'segment', 200, 0);
  const sw = {};
  for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']) { sw[s] = M.bauteil(doc, 'schalter', -200, 0); M.verbinde(doc, { b: sw[s].id, a: 'q' }, { b: anz.id, a: s }); }
  let r = sim(doc).bauteile[anz.id];
  assert.equal(r.zeichen, '', 'alle Segmente aus');
  for (const s of ['b', 'c']) sw[s].werte.an = 1;
  r = sim(doc).bauteile[anz.id];
  assert.equal(r.segmente.b, 1); assert.equal(r.segmente.a, 0);
  assert.equal(r.zeichen, '1');
  sw.dp.werte.an = 1;
  assert.equal(sim(doc).bauteile[anz.id].segmente.dp, 1);
  sw.g.werte.an = 1; // b, c, g ist kein Zeichen 0–F
  assert.equal(sim(doc).bauteile[anz.id].zeichen, null);
  // nur ein Teil der Segmente angeschlossen: die anderen bleiben aus
  const d2 = M.neu(), a2 = M.bauteil(d2, 'segment', 0, 0), e = M.bauteil(d2, 'eins', -200, 0);
  M.verbinde(d2, { b: e.id, a: 'q' }, { b: a2.id, a: 'g' });
  assert.deepEqual(plain(SL.SEGMENTE.filter(s => sim(d2).bauteile[a2.id].segmente[s])), ['g']);
});

test('6 · Decoder steuert die Anzeige: Ziffern 0–9 und A–F', () => {
  const doc = SL.BEISPIELE.segment.bauen();
  const sw = ['Bit 8', 'Bit 4', 'Bit 2', 'Bit 1'].map(n => doc.bauteile.find(b => b.name === n));
  const anz = doc.bauteile.find(b => b.typ === 'segment');
  for (let z = 0; z < 16; z++) {
    sw.forEach((s, i) => { s.werte.an = (z >> (3 - i)) & 1; });
    assert.equal(sim(doc).bauteile[anz.id].zeichen, '0123456789AbCdEF'[z], `Zahl ${z}`);
  }
  const t = SL.wahrheit.tabelle(doc);
  assert.equal(t.zeilen.map(z => z.aus[0]).join(''), '0123456789AbCdEF');
});

test('7 · Relais: Ruhe (COM–NC) und angezogen (COM–NO), Steuerkreis getrennt', () => {
  const doc = SL.BEISPIELE.relais.bauen();
  const A = doc.bauteile.find(b => b.name === 'A'), K = doc.bauteile.find(b => b.typ === 'relais');
  const gruen = doc.bauteile.find(b => b.name === 'Grün'), rot = doc.bauteile.find(b => b.name === 'Rot');
  let e = sim(doc);
  assert.equal(e.bauteile[K.id].angezogen, 0);
  assert.equal(e.bauteile[K.id].aus.nc, 1); assert.equal(e.bauteile[K.id].aus.no, 0);
  assert.equal(e.bauteile[rot.id].an, 1); assert.equal(e.bauteile[gruen.id].an, 0);
  M.tippAktion(doc, A.id);
  e = sim(doc);
  assert.equal(e.bauteile[K.id].angezogen, 1);
  assert.equal(e.bauteile[gruen.id].an, 1); assert.equal(e.bauteile[rot.id].an, 0);
  // Ohne Signal an COM schaltet das Relais, aber keine Lampe leuchtet
  doc.draehte = doc.draehte.filter(d => d.nach.a !== 'com');
  e = sim(doc);
  assert.equal(e.bauteile[K.id].angezogen, 1);
  assert.equal(e.bauteile[gruen.id].an, 0);
  assert.ok(e.meldungen.some(m => /COM/.test(m.text)), 'offener COM-Eingang wird gemeldet');
});

test('8 · Lampen: leuchten nur bei Signal 1 über eine echte Verbindung', () => {
  const doc = M.neu();
  const h = M.bauteil(doc, 'eins', 0, 0), y = M.bauteil(doc, 'lampe', 0, 0); // Lampe liegt direkt auf der Quelle, aber ohne Leitung
  assert.equal(sim(doc).bauteile[y.id].an, 0, 'keine Verbindung → aus');
  M.verbinde(doc, { b: h.id, a: 'q' }, { b: y.id, a: 'e' });
  assert.equal(sim(doc).bauteile[y.id].an, 1);
  const svg = SL.zeichnen.szene({ doc, erg: sim(doc) });
  assert.match(svg, />AN</);
});

test('9 · Farben ändern nur die Darstellung', () => {
  const { doc, s, y, g } = gatter('und');
  s.forEach(x => { x.werte.an = 1; });
  const vorher = plain(sim(doc));
  M.setzeWert(doc, y.id, 'farbe', '#2fbf5b');
  M.setzeWert(doc, g.id, 'farbe', '#dbeafe');
  doc.draehte[0].farbe = '#9333ea';
  doc.optionen.aktiv = '#2563eb';
  assert.deepEqual(plain(sim(doc)), vorher, 'Logik unverändert');
  const svg = SL.zeichnen.szene({ doc, erg: sim(doc) });
  assert.match(svg, /fill:#2fbf5b/, 'Leuchtfarbe der Lampe');
  assert.match(svg, /fill:#dbeafe/, 'Bauteilfarbe');
  assert.match(svg, /stroke:#9333ea/, 'Leitungsfarbe');
  assert.match(svg, /stroke:#2563eb/, 'Farbe für aktive Signale');
  M.setzeWert(doc, y.id, 'farbe', 'javascript:alert(1)');
  assert.equal(y.werte.farbe, '#ffc83d', 'ungültige Farbe → Standard');
  assert.equal(M.setzeName(doc, y.id, '<b>Ausgang</b>'), true);
  assert.equal(y.name, 'bAusgang/b');
});

test('10 · Wahrheitstabelle: Auswahl, mehrere Ausgänge, Grenzen und Fehlermeldungen', () => {
  const ha = SL.BEISPIELE.halbaddierer.bauen();
  let t = SL.wahrheit.tabelle(ha);
  assert.deepEqual(plain(t.ausgaenge.map(x => x.name)), ['S', 'C']);
  assert.deepEqual(plain(t.zeilen.map(z => z.aus.join(''))), ['00', '10', '10', '01']);
  const A = ha.bauteile.find(b => b.name === 'A');
  t = SL.wahrheit.tabelle(ha, { eingaenge: [A.id] });
  assert.equal(t.zeilen.length, 2, 'nur gewählter Eingang, B behält seinen Wert (0)');
  const gatterId = ha.bauteile.find(b => b.typ === 'xor').id;
  t = SL.wahrheit.tabelle(ha, { ausgaenge: [gatterId] });
  assert.deepEqual(plain(t.ausgaenge.map(x => x.art)), ['XOR']);
  // ohne Eingänge / ohne Ausgänge
  const leer = M.neu(); M.bauteil(leer, 'lampe', 0, 0);
  assert.match(SL.wahrheit.tabelle(leer).fehler, /mindestens einen Schalter/);
  const nurEin = M.neu(); M.bauteil(nurEin, 'schalter', 0, 0);
  assert.match(SL.wahrheit.tabelle(nurEin).fehler, /Ausgang/);
  // zu viele Eingänge: Warnung und Begrenzung auf 8 (256 Zeilen)
  const gross = gatter('und', 8).doc;
  M.bauteil(gross, 'schalter', 0, 900); M.bauteil(gross, 'schalter', 0, 1000);
  t = SL.wahrheit.tabelle(gross);
  assert.equal(t.zeilen.length, 256);
  assert.ok(t.warnungen.some(w => /10 Eingänge/.test(w)));
});

test('11 · Ungültige Verbindungen werden verhindert und erklärt', () => {
  const doc = M.neu();
  const a = M.bauteil(doc, 'schalter', 0, 0), b = M.bauteil(doc, 'schalter', 0, 100), u = M.bauteil(doc, 'und', 200, 0), y = M.bauteil(doc, 'lampe', 400, 0);
  assert.match(M.verbinde(doc, { b: a.id, a: 'q' }, { b: b.id, a: 'q' }).grund, /Zwei Ausgänge/);
  assert.match(M.verbinde(doc, { b: u.id, a: 'e1' }, { b: y.id, a: 'e' }).grund, /Zwei Eingänge/);
  assert.ok(M.verbinde(doc, { b: u.id, a: 'e1' }, { b: a.id, a: 'q' }).ok, 'Richtung egal: Eingang → Ausgang wird umgedreht');
  assert.equal(doc.draehte[0].von.b, a.id);
  assert.match(M.verbinde(doc, { b: b.id, a: 'q' }, { b: u.id, a: 'e1' }).grund, /schon angeschlossen/);
  assert.ok(M.verbinde(doc, { b: a.id, a: 'q' }, { b: u.id, a: 'e2' }).ok, 'ein Ausgang darf mehrere Eingänge versorgen');
  assert.match(M.verbinde(doc, { b: a.id, a: 'q' }, { b: a.id, a: 'q' }).grund, /zwei verschiedene/);
  assert.match(M.verbinde(doc, { b: a.id, a: 'x' }, { b: u.id, a: 'e1' }).grund, /zwei Anschlüssen/);
  // Offene Eingänge gelten als 0 und werden gemeldet
  const d2 = M.neu(); const n = M.bauteil(d2, 'nand', 0, 0);
  const e = sim(d2);
  assert.equal(e.bauteile[n.id].q, 1);
  assert.ok(e.meldungen.some(m => /gelten als 0/.test(m.text)));
});

test('12 · Rückkopplung: Flipflop speichert, NICHT-Schleife schwingt ohne Endlosschleife', () => {
  const doc = SL.BEISPIELE.flipflop.bauen();
  const S = doc.bauteile.find(b => b.name === 'Setzen'), R = doc.bauteile.find(b => b.name === 'Rücksetzen'), Q = doc.bauteile.find(b => b.name === 'Q');
  let e = sim(doc);
  assert.equal(e.zyklisch, true); assert.equal(e.schwingt, false);
  assert.equal(e.bauteile[Q.id].an, 0);
  S.werte.gedrueckt = 1; e = sim(doc, { vorher: SL.sim.zustand(e) }); assert.equal(e.bauteile[Q.id].an, 1, 'setzen');
  S.werte.gedrueckt = 0; e = sim(doc, { vorher: SL.sim.zustand(e) }); assert.equal(e.bauteile[Q.id].an, 1, 'merkt sich 1');
  R.werte.gedrueckt = 1; e = sim(doc, { vorher: SL.sim.zustand(e) }); assert.equal(e.bauteile[Q.id].an, 0, 'rücksetzen');
  R.werte.gedrueckt = 0; e = sim(doc, { vorher: SL.sim.zustand(e) }); assert.equal(e.bauteile[Q.id].an, 0, 'merkt sich 0');
  assert.ok(e.meldungen.some(m => /Rückkopplung/.test(m.text)));
  assert.ok(SL.wahrheit.tabelle(doc).warnungen.some(w => /Ruhezustand/.test(w)));
  // NICHT-Gatter auf sich selbst
  const d2 = M.neu(), n = M.bauteil(d2, 'nicht', 0, 0);
  M.verbinde(d2, { b: n.id, a: 'q' }, { b: n.id, a: 'e1' });
  const t0 = Date.now(), e2 = sim(d2);
  assert.ok(Date.now() - t0 < 200);
  assert.equal(e2.schwingt, true);
  assert.ok(e2.meldungen.some(m => /kommt nicht zur Ruhe/.test(m.text)));
  assert.deepEqual(plain(sim(d2)), plain(e2), 'deterministisch');
});

test('13 · Speichern und Laden stellt die Schaltung vollständig wieder her', () => {
  const doc = SL.BEISPIELE.halbaddierer.bauen();
  doc.optionen = { aktiv: '#2563eb', inaktiv: '#6b7280', pegel: false };
  doc.draehte[1].farbe = '#dc2626';
  M.drehen(doc, doc.bauteile[2].id);
  M.setzeName(doc, doc.bauteile[0].id, 'Eingang 1');
  const text = M.exportiere(doc);
  const r = M.importiere(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.hinweise.length, 0);
  assert.equal(M.exportiere(r.doc), text);
  assert.deepEqual(plain(sim(r.doc)), plain(sim(doc)));
  // Prüfung beim Laden
  assert.equal(M.importiere('{').ok, false);
  assert.equal(M.importiere(JSON.stringify({ format: 'schaltkreis-labor', version: 1, bauteile: [], draehte: [] })).ok, false);
  const kaputt = JSON.parse(text);
  kaputt.bauteile.push({ id: 'zz', typ: 'fluxkompensator', x: 0, y: 0 });
  kaputt.draehte.push({ id: 'dx', von: { b: kaputt.bauteile[0].id, a: 'q' }, nach: { b: kaputt.bauteile[1].id, a: 'q' } });
  kaputt.bauteile[2].werte.eingaenge = 1000;
  const k = M.importiere(JSON.stringify(kaputt));
  assert.equal(k.ok, true);
  assert.equal(k.hinweise.length, 2);
  assert.equal(k.doc.bauteile[2].werte.eingaenge, 8);
});

test('14 · Bedienung: Leitung ziehen, Schalter antippen, Gruppe verschieben, Taster halten', () => {
  const doc = M.neu();
  const a = M.bauteil(doc, 'schalter', 0, 0), y = M.bauteil(doc, 'lampe', 200, 0);
  const log = { gehalten: [] };
  let gruppe = null;
  const b = new SL.Bedienung({
    doc: () => doc, merke: () => {}, geaendert: () => {}, zeige: () => {}, auswahl: s => { log.auswahl = s; }, meldung: (t, art) => { log.meldung = [art, t]; },
    gruppe: id => (gruppe && gruppe.includes(id) ? gruppe : null), halten: (id, an) => { log.gehalten.push([id, an]); M.finde(doc, id).werte.gedrueckt = an ? 1 : 0; },
  });
  b.view = { x: -300, y: -200, s: 1 }; b.groesse = { w: 800, h: 600 };
  const f = (id, w) => ({ id, x: w.x + 300, y: w.y + 200, typ: 'touch', taste: 0, drin: true });
  // Leitung vom Ausgang des Schalters zum Lampeneingang ziehen
  const q = M.anschlussPos(doc, { b: a.id, a: 'q' }), e = M.anschlussPos(doc, { b: y.id, a: 'e' });
  b.runter(f(1, q)); b.bewegen(f(1, { x: 100, y: 30 })); b.bewegen(f(1, e)); b.hoch(f(1, e));
  assert.equal(doc.draehte.length, 1);
  assert.equal(sim(doc).bauteile[y.id].an, 0);
  // Schalter antippen
  b.runter(f(2, { x: -5, y: 0 })); b.hoch(f(2, { x: -5, y: 0 }));
  assert.equal(a.werte.an, 1);
  assert.equal(sim(doc).bauteile[y.id].an, 1);
  // Ungültig: Ausgang auf Ausgang
  const c = M.bauteil(doc, 'eins', 0, 200);
  const qc = M.anschlussPos(doc, { b: c.id, a: 'q' });
  b.runter(f(3, q)); b.bewegen(f(3, { x: 30, y: 100 })); b.bewegen(f(3, qc));
  assert.equal(b.vorschau.gueltig, false, 'ungültiges Ziel wird markiert');
  b.hoch(f(3, qc));
  assert.equal(log.meldung[0], 'fehler');
  // Gruppe verschieben
  gruppe = [a.id, y.id];
  b.runter(f(4, { x: 0, y: 5 })); b.bewegen(f(4, { x: 40, y: 45 })); b.bewegen(f(4, { x: 80, y: 85 })); b.hoch(f(4, { x: 80, y: 85 }));
  assert.deepEqual([a.x, a.y, y.x, y.y], [80, 80, 280, 80]);
  assert.deepEqual(plain(M.drahtPunkte(doc, doc.draehte[0]).at(-1)), plain(M.anschlussPos(doc, { b: y.id, a: 'e' })), 'Leitung folgt');
  // Taster halten
  gruppe = null;
  const t = M.bauteil(doc, 'taster', 0, 400);
  b.runter(f(5, { x: 0, y: 400 }));
  assert.equal(t.werte.gedrueckt, 1);
  b.hoch(f(5, { x: 0, y: 400 }));
  assert.equal(t.werte.gedrueckt, 0);
  assert.equal(log.gehalten.length, 2);
  // Löschen mit Mehrfachauswahl
  assert.ok(M.loesche(doc, { art: 'mehrere', ids: [a.id, y.id] }));
  assert.equal(doc.draehte.length, 0);
});

test('15 · Alle Beispiele sind echte, auswertbare Schaltungen; Zeichnen ohne Fehler', () => {
  for (const [k, bsp] of Object.entries(SL.BEISPIELE)) {
    const doc = bsp.bauen();
    assert.ok(doc.bauteile.length >= 3, k);
    const e = sim(doc);
    assert.equal(e.schwingt, false, k);
    assert.equal(SL.wahrheit.tabelle(doc).fehler, '', k);
    assert.ok(SL.zeichnen.szene({ doc, erg: e, auswahl: { art: 'mehrere', ids: [doc.bauteile[0].id] } }).length > 100);
    assert.equal(M.importiere(M.exportiere(doc)).ok, true);
  }
  for (const typ of Object.keys(SL.TYPEN)) assert.match(SL.zeichnen.symbol(typ), /^<svg/);
});

test('16 · Robustheit: 300 zufällige Schaltungen ohne Absturz', () => {
  let seed = 7;
  const zufall = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const typen = Object.keys(SL.TYPEN);
  for (let n = 0; n < 300; n++) {
    const doc = M.neu();
    const k = 1 + Math.floor(zufall() * 8);
    for (let i = 0; i < k; i++) M.bauteil(doc, typen[Math.floor(zufall() * typen.length)], zufall() * 600, zufall() * 400, { an: zufall() < 0.5 ? 1 : 0, eingaenge: 2 + Math.floor(zufall() * 3) });
    const pins = doc.bauteile.flatMap(b => M.anschluesse(b));
    for (let i = 0; i < k * 3; i++) M.verbinde(doc, pins[Math.floor(zufall() * pins.length)], pins[Math.floor(zufall() * pins.length)]);
    const e = sim(doc, { t: zufall() });
    for (const v of Object.values(e.aus)) assert.ok(v === 0 || v === 1);
    assert.ok(e.schritte <= SL.sim.MAX_SCHRITTE + 1);
    SL.wahrheit.tabelle(doc);
    SL.zeichnen.szene({ doc, erg: e });
  }
});
