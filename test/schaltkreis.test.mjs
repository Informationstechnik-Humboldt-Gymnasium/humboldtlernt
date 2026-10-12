// Tests für das Schaltkreis-Labor (Fach Sandbox): Modell, Simulationskern, Multimeter und Bedienung (auch Touch).
// Die Dateien sind normale Browser-Skripte; hier laufen sie in einer eigenen vm-Umgebung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lessons/sandbox-schaltkreis');
const ctx = vm.createContext({});
for (const f of ['modell.js', 'simulation.js', 'bedienung.js', 'zeichnen.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const SL = ctx.SL, M = SL.modell;
const sim = (doc, laeuft = true, opt) => SL.sim.simuliere(doc, laeuft, opt);
const nah = (ist, soll, tol, text) => assert.ok(Math.abs(ist - soll) <= tol, `${text || ''} erwartet ≈ ${soll}, ist ${ist}`);

/** Reihenschaltung: Quelle → Teil 1 → Teil 2 → … → zurück zur Quelle. teile: [[typ, werte], …] */
function reihe(spannung, teile) {
  const doc = M.neu();
  const u = M.bauteil(doc, 'quelle', 0, 0, { spannung });
  const bs = teile.map(([typ, werte], i) => M.bauteil(doc, typ, 200 * (i + 1), 200, werte));
  let vorher = { b: u.id, a: 'a' };
  for (const b of bs) {
    assert.ok(M.verbinde(doc, vorher, { b: b.id, a: 'a' in SL.TYPEN[b.typ].anschluesse ? 'a' : 'com' }).ok);
    vorher = { b: b.id, a: b.typ === 'diode' ? 'k' : b.typ === 'messgeraet' ? 'v' : 'b' };
  }
  assert.ok(M.verbinde(doc, vorher, { b: u.id, a: 'b' }).ok);
  return { doc, u, bs };
}

/** Prüft: keine NaN/Infinity in den Ergebnissen und Knotenregel an jedem Anschluss. */
function pruefeKirchhoff(doc, erg) {
  for (const [id, r] of Object.entries(erg.bauteile)) for (const k of ['U', 'I', 'P']) if (r[k] != null) assert.ok(Number.isFinite(r[k]), `${id}.${k} ist ${r[k]}`);
  for (const [id, r] of Object.entries(erg.draehte)) assert.ok(Number.isFinite(r.I), `Draht ${id}`);
  if (!erg.laeuft || erg.status !== 'ok') return;
  for (const b of doc.bauteile) {
    if (b.typ === 'messgeraet' || b.typ === 'transistor') continue; // Mehrpole: eigene Tests
    const r = erg.bauteile[b.id];
    const ein = b.typ === 'quelle' ? M.pluspol(b) : 'a';
    // Strom, der über die Drähte in den Anschluss hineinfließt = Strom, der im Bauteil weiterfließt
    let zu = 0;
    for (const d of doc.draehte) {
      const I = erg.draehte[d.id].I;
      if (d.nach.b === b.id && d.nach.a === ein) zu += I;
      if (d.von.b === b.id && d.von.a === ein) zu -= I;
    }
    const imBauteil = b.typ === 'quelle' || b.typ === 'wechsel' ? -r.I : r.I;
    nah(zu, imBauteil, 1e-6 + 1e-6 * Math.abs(imBauteil), `Knotenregel an ${b.name}:`);
  }
}

test('1 · Geschlossener Stromkreis mit Schalter und Lampe: Lampe leuchtet, I = U/R', () => {
  const doc = M.beispiel();
  const erg = sim(doc);
  const lampe = doc.bauteile.find(b => b.typ === 'lampe');
  const r = erg.bauteile[lampe.id];
  assert.equal(erg.status, 'ok');
  nah(r.I, 6 / 12, 1e-3, 'Lampe 6 V / 3 W an 6 V:');
  nah(r.P, 3, 0.01);
  assert.equal(r.zustand, 'an');
  assert.ok(r.hell > 0.99);
  assert.ok(erg.meldungen.some(m => m.art === 'ok'));
  pruefeKirchhoff(doc, erg);
});

test('2 · Offener Schalter: kein Strom, Lampe aus, Spannung liegt am Schalter', () => {
  const doc = M.beispiel();
  const s = doc.bauteile.find(b => b.typ === 'schalter');
  assert.equal(M.tippAktion(doc, s.id), 'S1 geöffnet');
  const erg = sim(doc);
  const lampe = doc.bauteile.find(b => b.typ === 'lampe');
  assert.equal(erg.bauteile[lampe.id].I, 0);
  assert.equal(erg.bauteile[lampe.id].zustand, 'aus');
  nah(Math.abs(erg.bauteile[s.id].U), 6, 1e-3, 'Spannung am offenen Schalter:');
  assert.ok(erg.meldungen.some(m => /nicht geschlossen/.test(m.text)));
  for (const d of Object.values(erg.draehte)) assert.equal(Math.abs(d.I) < SL.K.I_FLIESST, true, 'kein Stromfluss auf Drähten');
});

test('3 · Einstellbarer Widerstand: 10 V an 100 Ω ergibt 0,1 A; Änderungen wirken sofort; 0 Ω ist ein Kurzschluss', () => {
  const { doc, bs: [r] } = reihe(10, [['widerstand', { widerstand: 100 }]]);
  let erg = sim(doc);
  nah(erg.bauteile[r.id].I, 0.1, 1e-4, '10 V / 100 Ω:');
  nah(erg.bauteile[r.id].U, 10, 1e-3);
  nah(erg.bauteile[r.id].P, 1, 1e-3);
  assert.equal(SL.fmt(erg.bauteile[r.id].I, 'A'), '100 mA');
  pruefeKirchhoff(doc, erg);
  M.setzeWert(doc, r.id, 'widerstand', 1000);
  nah(sim(doc).bauteile[r.id].I, 0.01, 1e-5, '10 V / 1 kΩ:');
  M.setzeWert(doc, r.id, 'widerstand', 50000);
  assert.equal(M.finde(doc, r.id).werte.widerstand, 10000, 'auf 10 kΩ begrenzt');
  M.setzeWert(doc, r.id, 'widerstand', 0);
  erg = sim(doc);
  assert.equal(erg.status, 'kurzschluss');
  assert.ok(erg.meldungen.some(m => m.art === 'fehler' && /Kurzschluss/.test(m.text)));
});

test('4 · Spannung und Polung der Quelle während der laufenden Simulation ändern', () => {
  const { doc, u, bs: [r] } = reihe(10, [['widerstand', { widerstand: 100 }]]);
  nah(sim(doc).bauteile[r.id].I, 0.1, 1e-4);
  M.setzeWert(doc, u.id, 'spannung', 5);
  nah(sim(doc).bauteile[r.id].I, 0.05, 1e-4, 'nach Änderung auf 5 V:');
  M.setzeWert(doc, u.id, 'spannung', 30);
  assert.equal(M.finde(doc, u.id).werte.spannung, 24, 'höchstens 24 V');
  M.setzeWert(doc, u.id, 'spannung', 'abc');
  assert.equal(M.finde(doc, u.id).werte.spannung, 6, 'ungültige Eingabe → Startwert');
  M.setzeWert(doc, u.id, 'spannung', 12);
  M.setzeWert(doc, u.id, 'umgepolt', true);
  const erg = sim(doc);
  nah(erg.bauteile[r.id].I, -0.12, 1e-4, 'umgepolt fließt der Strom andersherum:');
  nah(erg.bauteile[u.id].I, 0.12, 1e-4, 'die Quelle liefert weiter positiven Strom:');
  pruefeKirchhoff(doc, erg);
});

test('5 · Diode in Durchlassrichtung: leitet, etwa 0,7 V Spannungsabfall', () => {
  const { doc, bs: [d, r] } = reihe(6, [['diode'], ['widerstand', { widerstand: 100 }]]);
  const erg = sim(doc);
  const rd = erg.bauteile[d.id];
  assert.equal(rd.zustand, 'leitend');
  assert.ok(rd.U > 0.6 && rd.U < 0.8, `Durchlassspannung ${rd.U}`);
  nah(erg.bauteile[r.id].I, (6 - rd.U) / 100, 1e-4, 'Maschenregel:');
  nah(rd.U + erg.bauteile[r.id].U, 6, 1e-3, 'Summe der Teilspannungen:');
  pruefeKirchhoff(doc, erg);
});

test('6 · Diode in Sperrrichtung: sperrt, Lampe bleibt aus, volle Spannung an der Diode', () => {
  const { doc, u, bs: [d, l] } = reihe(6, [['diode'], ['lampe']]);
  M.setzeWert(doc, u.id, 'umgepolt', true);
  const erg = sim(doc);
  assert.equal(erg.bauteile[d.id].zustand, 'sperrend');
  assert.equal(erg.bauteile[l.id].zustand, 'aus');
  assert.ok(Math.abs(erg.bauteile[l.id].I) < 1e-6);
  nah(erg.bauteile[d.id].U, -6, 1e-3, 'Sperrspannung:');
  assert.ok(erg.meldungen.some(m => /sperrende Diode/.test(m.text)));
});

/** Beispiel plus Multimeter. */
function mitMessgeraet(modus) {
  const doc = M.beispiel();
  const m = M.bauteil(doc, 'messgeraet', 320, 0, { modus });
  const lampe = doc.bauteile.find(b => b.typ === 'lampe');
  return { doc, m, lampe, schalter: doc.bauteile.find(b => b.typ === 'schalter'), quelle: doc.bauteile.find(b => b.typ === 'quelle') };
}

test('7 · Gültige Spannungsmessung parallel zur Lampe', () => {
  const { doc, m, lampe } = mitMessgeraet('V');
  M.verbinde(doc, { b: m.id, a: 'v' }, { b: lampe.id, a: 'a' });
  M.verbinde(doc, { b: m.id, a: 'com' }, { b: lampe.id, a: 'b' });
  const erg = sim(doc), mm = erg.messgeraete[m.id];
  assert.equal(mm.fehler, '');
  assert.equal(mm.warnung, '');
  nah(mm.wert, erg.bauteile[lampe.id].U, 1e-4, 'Anzeige = Spannung an der Lampe:');
  nah(mm.wert, 6, 0.01);
  assert.match(mm.anzeige, /^[56],\d+ V$/);
  assert.equal(erg.bauteile[lampe.id].zustand, 'an', 'das Messgerät stört kaum');
  // Messleitungen vertauscht → negative Anzeige
  doc.draehte = doc.draehte.filter(d => d.von.b !== m.id);
  M.verbinde(doc, { b: m.id, a: 'v' }, { b: lampe.id, a: 'b' });
  M.verbinde(doc, { b: m.id, a: 'com' }, { b: lampe.id, a: 'a' });
  assert.ok(sim(doc).messgeraete[m.id].wert < -5.9);
});

test('8 · Gültige Strommessung in Reihe', () => {
  const { doc, m, lampe } = mitMessgeraet('A');
  // Draht Lampe → Quelle durch das Messgerät ersetzen
  const d = doc.draehte.find(x => x.von.b === lampe.id && x.von.a === 'b');
  M.loesche(doc, { art: 'draht', id: d.id });
  M.verbinde(doc, { b: lampe.id, a: 'b' }, { b: m.id, a: 'v' });
  M.verbinde(doc, { b: m.id, a: 'com' }, d.nach);
  const erg = sim(doc), mm = erg.messgeraete[m.id];
  assert.equal(mm.fehler, '');
  assert.equal(mm.warnung, '');
  nah(mm.wert, 0.5, 1e-3, 'Strom durch die Lampe:');
  assert.equal(mm.anzeige, '500 mA');
  assert.equal(erg.bauteile[lampe.id].zustand, 'an');
  pruefeKirchhoff(doc, erg);
});

test('9 · Ungültige Messanordnungen werden erkannt', () => {
  // a) Messleitung fehlt
  let x = mitMessgeraet('V');
  M.verbinde(x.doc, { b: x.m.id, a: 'v' }, { b: x.lampe.id, a: 'a' });
  assert.match(sim(x.doc).messgeraete[x.m.id].fehler, /schwarze Messleitung/);
  // b) Strommessgerät parallel zur Quelle → Kurzschluss über das Messgerät
  x = mitMessgeraet('A');
  M.verbinde(x.doc, { b: x.m.id, a: 'v' }, { b: x.quelle.id, a: 'a' });
  M.verbinde(x.doc, { b: x.m.id, a: 'com' }, { b: x.quelle.id, a: 'b' });
  let erg = sim(x.doc);
  assert.equal(erg.status, 'kurzschluss');
  assert.match(erg.messgeraete[x.m.id].fehler, /Kurzschluss.*in Reihe/);
  assert.ok(erg.meldungen.some(m => /über das Strommessgerät/.test(m.text)));
  // c) Widerstandsmessung unter Spannung
  x = mitMessgeraet('Ohm');
  M.verbinde(x.doc, { b: x.m.id, a: 'v' }, { b: x.lampe.id, a: 'a' });
  M.verbinde(x.doc, { b: x.m.id, a: 'com' }, { b: x.lampe.id, a: 'b' });
  assert.match(sim(x.doc, true).messgeraete[x.m.id].fehler, /nur ohne Spannung/);
  // … ohne Spannung (Simulation gestoppt) klappt sie: Lampe 12 Ω, parallel liegen Schalter + Quelle (aus = offen)
  const ohm = sim(x.doc, false).messgeraete[x.m.id];
  assert.equal(ohm.fehler, '');
  nah(ohm.wert, 12, 0.01, 'Lampenwiderstand:');
  // d) Spannungsmessgerät in Reihe: Warnung, Lampe bleibt praktisch aus
  x = mitMessgeraet('V');
  const d = x.doc.draehte.find(w => w.von.b === x.lampe.id && w.von.a === 'b');
  M.loesche(x.doc, { art: 'draht', id: d.id });
  M.verbinde(x.doc, { b: x.lampe.id, a: 'b' }, { b: x.m.id, a: 'v' });
  M.verbinde(x.doc, { b: x.m.id, a: 'com' }, d.nach);
  erg = sim(x.doc);
  assert.match(erg.messgeraete[x.m.id].warnung, /in Reihe/);
  assert.equal(erg.bauteile[x.lampe.id].zustand, 'aus');
  // e) Strommessgerät parallel zur Lampe (mit Vorwiderstand): überbrückt die Lampe
  const y = reihe(6, [['widerstand', { widerstand: 100 }], ['lampe']]);
  const m2 = M.bauteil(y.doc, 'messgeraet', 600, 0, { modus: 'A' });
  M.verbinde(y.doc, { b: m2.id, a: 'v' }, { b: y.bs[1].id, a: 'a' });
  M.verbinde(y.doc, { b: m2.id, a: 'com' }, { b: y.bs[1].id, a: 'b' });
  erg = sim(y.doc);
  assert.match(erg.messgeraete[m2.id].warnung, /parallel/);
  assert.equal(erg.bauteile[y.bs[1].id].zustand, 'aus');
});

test('10 · Widerstandsmessung: Widerstand, Leitung, offene Messspitzen (OL) und Diode', () => {
  const doc = M.neu();
  const r = M.bauteil(doc, 'widerstand', 0, 0, { widerstand: 470 });
  const m = M.bauteil(doc, 'messgeraet', 0, -200, { modus: 'Ohm' });
  M.verbinde(doc, { b: m.id, a: 'v' }, { b: r.id, a: 'a' });
  M.verbinde(doc, { b: m.id, a: 'com' }, { b: r.id, a: 'b' });
  nah(sim(doc, true).messgeraete[m.id].wert, 470, 0.1, 'ohne Quelle auch bei laufender Simulation:');
  M.setzeWert(doc, r.id, 'widerstand', 0);
  assert.ok(sim(doc).messgeraete[m.id].wert < 0.01);
  M.loesche(doc, { art: 'bauteil', id: r.id });
  const a = M.bauteil(doc, 'schalter', 0, 0, { geschlossen: false });
  M.verbinde(doc, { b: m.id, a: 'v' }, { b: a.id, a: 'a' });
  M.verbinde(doc, { b: m.id, a: 'com' }, { b: a.id, a: 'b' });
  assert.equal(sim(doc).messgeraete[m.id].anzeige, 'OL');
  M.loesche(doc, { art: 'bauteil', id: a.id });
  const di = M.bauteil(doc, 'diode', 0, 0);
  M.verbinde(doc, { b: m.id, a: 'v' }, { b: di.id, a: 'a' });
  M.verbinde(doc, { b: m.id, a: 'com' }, { b: di.id, a: 'k' });
  const vor = sim(doc).messgeraete[m.id].wert;
  assert.ok(vor > 100 && vor < 1000, `Diode in Durchlassrichtung ${vor} Ω`);
  M.setzeWert(doc, m.id, 'modus', 'V');
  assert.match(sim(doc, false).messgeraete[m.id].hinweis, /Starte die Simulation/);
});

test('11 · Offener Stromkreis (Draht fehlt) und Teile ohne Verbindung', () => {
  const doc = M.beispiel();
  M.loesche(doc, { art: 'draht', id: doc.draehte[2].id });
  M.bauteil(doc, 'lampe', 500, 500); // lose Lampe ohne Drähte
  const erg = sim(doc);
  assert.equal(erg.status, 'ok');
  assert.ok(erg.meldungen.some(m => /nicht geschlossen/.test(m.text)));
  for (const r of Object.values(erg.bauteile)) if (r.I != null) assert.equal(r.I, 0);
  pruefeKirchhoff(doc, erg);
  // Gestoppt: keine Werte, Hinweis zum Starten
  const aus = sim(M.beispiel(), false);
  assert.equal(aus.status, 'gestoppt');
  assert.ok(Object.values(aus.bauteile).every(r => r.I == null));
  assert.ok(aus.meldungen.some(m => /gestoppt/.test(m.text)));
});

test('12 · Kurzschluss: Draht direkt über der Quelle wird erkannt und markiert', () => {
  const doc = M.beispiel();
  const u = doc.bauteile.find(b => b.typ === 'quelle');
  const kurz = M.verbinde(doc, { b: u.id, a: 'a' }, { b: u.id, a: 'b' }).draht;
  const erg = sim(doc);
  assert.equal(erg.status, 'kurzschluss');
  assert.ok(erg.kurzschluss.includes(kurz.id), 'Kurzschluss-Draht markiert');
  assert.ok(erg.kurzschluss.includes(u.id));
  assert.ok(erg.bauteile[u.id].ungueltig);
  assert.equal(erg.bauteile[doc.bauteile.find(b => b.typ === 'lampe').id].I, null, 'keine falschen Messwerte');
  // Diode in Durchlassrichtung direkt an 24 V: kein Endlos-Rechnen, sondern Überlast-Meldung
  const d2 = reihe(24, [['diode']]);
  const e2 = sim(d2.doc);
  assert.equal(e2.status, 'kurzschluss');
  assert.ok(e2.meldungen.some(m => /überlastet/.test(m.text)));
});

test('13 · Reihen- und Parallelschaltung erfüllen die Kirchhoffschen Regeln', () => {
  // Parallel: zwei 100-Ω-Widerstände an 10 V → 0,2 A aus der Quelle
  const doc = M.neu();
  const u = M.bauteil(doc, 'quelle', 0, 0, { spannung: 10 });
  const r1 = M.bauteil(doc, 'widerstand', 200, -100, { widerstand: 100 });
  const r2 = M.bauteil(doc, 'widerstand', 200, 100, { widerstand: 100 });
  for (const r of [r1, r2]) { M.verbinde(doc, { b: u.id, a: 'a' }, { b: r.id, a: 'a' }); M.verbinde(doc, { b: r.id, a: 'b' }, { b: u.id, a: 'b' }); }
  let erg = sim(doc);
  nah(erg.bauteile[u.id].I, 0.2, 1e-4, 'Gesamtstrom parallel:');
  nah(erg.bauteile[r1.id].I, 0.1, 1e-4);
  pruefeKirchhoff(doc, erg);
  // Reihe: 100 Ω + 300 Ω an 8 V → 20 mA, Teilspannungen 2 V und 6 V
  const s = reihe(8, [['widerstand', { widerstand: 100 }], ['widerstand', { widerstand: 300 }]]);
  erg = sim(s.doc);
  nah(erg.bauteile[s.bs[0].id].I, 0.02, 1e-5);
  nah(erg.bauteile[s.bs[0].id].U, 2, 1e-3);
  nah(erg.bauteile[s.bs[1].id].U, 6, 1e-3);
  pruefeKirchhoff(s.doc, erg);
  // Zwei Lampen in Reihe an 6 V leuchten schwächer (je ein Viertel der Leistung)
  const l = reihe(6, [['lampe'], ['lampe']]);
  erg = sim(l.doc);
  nah(erg.bauteile[l.bs[0].id].hell, 0.25, 0.01);
});

test('14 · Bauteil verschieben: angeschlossene Drähte folgen; Drehen; Treffertest', () => {
  const doc = M.beispiel();
  const lampe = doc.bauteile.find(b => b.typ === 'lampe');
  const draht = doc.draehte.find(d => d.nach.b === lampe.id || d.von.b === lampe.id);
  assert.ok(M.verschiebe(doc, lampe.id, 333, 47), 'verschoben');
  assert.equal(lampe.x, 340, 'rastet im 20er-Raster ein');
  assert.equal(lampe.y, 40);
  const pts = M.drahtPunkte(doc, draht);
  const ende = draht.von.b === lampe.id ? pts[0] : pts[pts.length - 1];
  const ref = draht.von.b === lampe.id ? draht.von : draht.nach;
  assert.deepEqual({ ...ende }, { ...M.anschlussPos(doc, ref) }, 'Drahtende sitzt am Anschluss');
  for (const d of doc.draehte) {
    const p = M.drahtPunkte(doc, d);
    for (let i = 1; i < p.length; i++) assert.ok(p[i].x === p[i - 1].x || p[i].y === p[i - 1].y, 'nur waagerechte/senkrechte Stücke');
  }
  const vor = M.anschlussPos(doc, { b: lampe.id, a: 'a' });
  M.drehen(doc, lampe.id);
  assert.notDeepEqual({ ...M.anschlussPos(doc, { b: lampe.id, a: 'a' }) }, { ...vor });
  const t = M.anschlussPos(doc, { b: lampe.id, a: 'b' });
  assert.equal(M.trefferTest(doc, t.x + 3, t.y - 2, 10).art, 'anschluss');
  assert.equal(M.trefferTest(doc, lampe.x, lampe.y, 10).art, 'bauteil');
  assert.equal(M.trefferTest(doc, 5000, 5000, 10), null);
  assert.ok(sim(doc).bauteile[lampe.id].I > 0.4, 'Schaltung funktioniert nach dem Verschieben');
});

test('15 · Bauteil löschen entfernt seine Drähte; ungültige Verbindungen werden abgelehnt', () => {
  const doc = M.beispiel();
  const s = doc.bauteile.find(b => b.typ === 'schalter');
  assert.equal(doc.draehte.length, 3);
  assert.ok(M.loesche(doc, { art: 'bauteil', id: s.id }));
  assert.equal(doc.draehte.length, 1, 'beide Drähte des Schalters sind weg');
  assert.ok(doc.draehte.every(d => d.von.b !== s.id && d.nach.b !== s.id));
  const l = doc.bauteile.find(b => b.typ === 'lampe');
  assert.equal(M.verbinde(doc, { b: l.id, a: 'a' }, { b: l.id, a: 'a' }).ok, false, 'Anschluss mit sich selbst');
  assert.equal(M.verbinde(doc, doc.draehte[0].von, doc.draehte[0].nach).ok, false, 'doppelter Draht');
  assert.equal(M.verbinde(doc, { b: l.id, a: 'x' }, { b: l.id, a: 'b' }).ok, false, 'Anschluss gibt es nicht');
  assert.equal(M.verbinde(doc, { b: 'gibts-nicht', a: 'a' }, { b: l.id, a: 'b' }).ok, false);
  pruefeKirchhoff(doc, sim(doc));
});

/** Bedienung mit nachgebautem UI. */
function bedienung(doc) {
  const log = { merke: 0, meldungen: [], auswahl: null };
  const b = new SL.Bedienung({
    doc: () => doc, merke: () => { log.merke++; }, geaendert: () => {}, zeige: () => {},
    auswahl: s => { log.auswahl = s; }, meldung: (t, art) => log.meldungen.push([art, t]),
  });
  b.view = { x: -300, y: -200, s: 1 };
  b.groesse = { w: 800, h: 600 };
  const bild = w => ({ x: (w.x - b.view.x) * b.view.s, y: (w.y - b.view.y) * b.view.s });
  const finger = (id, w, extra = {}) => ({ id, ...bild(w), typ: 'touch', taste: 0, drin: true, ...extra });
  return { b, log, finger, bild };
}

test('16 · Touch-Bedienung: Anschlüsse antippen verbindet, Finger zieht Bauteile, Schalter antippen, zwei Finger zoomen', () => {
  const doc = M.neu();
  const u = M.bauteil(doc, 'quelle', 0, 0);
  const l = M.bauteil(doc, 'lampe', 200, 0);
  const s = M.bauteil(doc, 'schalter', 100, -120);
  const { b, log, finger } = bedienung(doc);
  const tippe = (w, id = 1) => { b.runter(finger(id, w)); b.hoch(finger(id, w)); };

  // Tippen, Tippen: Draht von U1(+) zu S1, etwas neben dem Punkt (Finger sind ungenau)
  const p1 = M.anschlussPos(doc, { b: u.id, a: 'a' }), p2 = M.anschlussPos(doc, { b: s.id, a: 'a' });
  tippe({ x: p1.x + 12, y: p1.y - 9 });
  assert.equal(b.zustand.art, 'wartet');
  tippe({ x: p2.x - 10, y: p2.y + 8 });
  assert.equal(doc.draehte.length, 1);
  assert.deepEqual({ ...doc.draehte[0].von }, { b: u.id, a: 'a' });
  // Ziehen von Anschluss zu Anschluss
  const p3 = M.anschlussPos(doc, { b: s.id, a: 'b' }), p4 = M.anschlussPos(doc, { b: l.id, a: 'a' });
  b.runter(finger(2, p3));
  b.bewegen(finger(2, { x: (p3.x + p4.x) / 2, y: p3.y + 30 }));
  assert.equal(b.vorschau.art, 'draht');
  b.bewegen(finger(2, p4));
  assert.equal(b.vorschau.gueltig, true, 'gültiges Ziel wird angezeigt');
  b.hoch(finger(2, p4));
  assert.equal(doc.draehte.length, 2);
  // Ungültig: Draht im Leeren loslassen
  b.runter(finger(3, M.anschlussPos(doc, { b: l.id, a: 'b' })));
  b.bewegen(finger(3, { x: 400, y: 300 }));
  b.hoch(finger(3, { x: 400, y: 300 }));
  assert.equal(doc.draehte.length, 2);
  assert.equal(log.meldungen.at(-1)[0], 'fehler');
  // Lampe mit dem Finger verschieben
  const merkeVor = log.merke;
  b.runter(finger(4, { x: 205, y: 5 }));
  b.bewegen(finger(4, { x: 250, y: 40 }));
  b.bewegen(finger(4, { x: 285, y: 85 }));
  b.hoch(finger(4, { x: 285, y: 85 }));
  assert.deepEqual([l.x, l.y], [280, 80]);
  assert.equal(log.merke, merkeVor + 1, 'ein Rückgängig-Schritt pro Verschiebung');
  const p5 = M.anschlussPos(doc, { b: l.id, a: 'a' }), pts = M.drahtPunkte(doc, doc.draehte[1]);
  assert.deepEqual({ ...pts.at(-1) }, { ...p5 }, 'Draht folgt der Lampe');
  // Schalter antippen → umlegen
  assert.equal(s.werte.geschlossen, true);
  tippe({ x: 100, y: -118 }, 5);
  assert.equal(s.werte.geschlossen, false);
  assert.deepEqual({ ...log.auswahl }, { art: 'bauteil', id: s.id });
  // Zwei Finger: zoomen
  const s0 = b.view.s;
  b.runter(finger(6, { x: 0, y: 200 }));
  b.runter(finger(7, { x: 100, y: 200 }));
  b.bewegen(finger(7, { x: 200, y: 200 }));
  b.hoch(finger(6, { x: 0, y: 200 })); b.hoch(finger(7, { x: 200, y: 200 }));
  assert.ok(b.view.s > s0 * 1.5, `Zoom ${s0} → ${b.view.s}`);
  // Leere Fläche ziehen verschiebt die Ansicht
  const vx = b.view.x;
  b.runter(finger(8, { x: 600, y: 600 }));
  b.bewegen(finger(8, { x: 500, y: 600 }));
  b.hoch(finger(8, { x: 500, y: 600 }));
  assert.ok(b.view.x > vx);
});

test('17 · Bauteile aus der Leiste ziehen oder antippen; Multimeter-Tasten', () => {
  const doc = M.neu();
  const { b, finger } = bedienung(doc);
  b.leisteRunter('widerstand', finger(1, { x: -400, y: 0 }, { drin: false }));
  b.bewegen(finger(1, { x: 61, y: 39 }));
  assert.equal(b.vorschau.art, 'neu');
  b.hoch(finger(1, { x: 61, y: 39 }));
  assert.equal(doc.bauteile.length, 1);
  assert.deepEqual([doc.bauteile[0].x, doc.bauteile[0].y], [60, 40]);
  // Loslassen außerhalb der Fläche fügt nichts ein
  b.leisteRunter('lampe', finger(2, { x: -400, y: 0 }, { drin: false }));
  b.bewegen(finger(2, { x: -380, y: 30 }, { drin: false }));
  b.hoch(finger(2, { x: -380, y: 30 }, { drin: false }));
  assert.equal(doc.bauteile.length, 1);
  // Antippen fügt an einem freien Platz ein
  b.leisteRunter('messgeraet', finger(3, { x: -400, y: 0 }, { drin: false }));
  b.hoch(finger(3, { x: -400, y: 0 }, { drin: false }));
  const m = doc.bauteile.find(x => x.typ === 'messgeraet');
  assert.ok(m);
  // Multimeter-Taste „A“ antippen
  const t = SL.MODUS_TASTEN.find(x => x.modus === 'A');
  const w = { x: m.x + t.x + t.w / 2, y: m.y + SL.TASTEN_Y + SL.TASTEN_H / 2 };
  b.runter(finger(4, w)); b.hoch(finger(4, w));
  assert.equal(m.werte.modus, 'A');
  assert.equal(M.drehen(doc, m.id), false, 'Multimeter dreht sich nicht');
});

test('18 · Speichern und Laden (Export/Import) mit Prüfung', () => {
  const doc = M.beispiel();
  M.bauteil(doc, 'messgeraet', 300, 0, { modus: 'Ohm' });
  const text = M.exportiere(doc);
  const r = M.importiere(text);
  assert.equal(r.ok, true);
  assert.equal(M.exportiere(r.doc), text, 'gleiche Schaltung nach dem Laden');
  assert.equal(M.importiere('kein json').ok, false);
  assert.equal(M.importiere('{"format":"anders"}').ok, false);
  const kaputt = JSON.parse(text);
  kaputt.bauteile.push({ id: 'x1', typ: 'atomkraftwerk', x: 0, y: 0 });
  kaputt.bauteile[0].werte.spannung = 1e9;
  kaputt.bauteile[0].x = 'abc';
  kaputt.draehte.push({ id: 'dx', von: { b: 'x1', a: 'a' }, nach: { b: 'b1', a: 'a' } });
  const k = M.importiere(JSON.stringify(kaputt));
  assert.equal(k.ok, true);
  assert.equal(k.doc.bauteile.length, 4);
  assert.equal(k.doc.bauteile[0].werte.spannung, 24);
  assert.equal(k.doc.bauteile[0].x, 0);
  assert.equal(k.doc.draehte.length, 3);
  assert.ok(k.hinweise.length >= 2);
});

test('19 · Robustheit: 400 zufällige Schaltungen ohne Absturz, NaN oder Endlosschleife', () => {
  let seed = 42;
  const zufall = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const typen = Object.keys(SL.TYPEN);
  const start = Date.now();
  for (let n = 0; n < 400; n++) {
    const doc = M.neu();
    const anzahl = 1 + Math.floor(zufall() * 7);
    for (let i = 0; i < anzahl; i++) {
      const typ = typen[Math.floor(zufall() * typen.length)];
      M.bauteil(doc, typ, Math.floor(zufall() * 600), Math.floor(zufall() * 400), {
        spannung: zufall() * 24, umgepolt: zufall() < 0.3, geschlossen: zufall() < 0.7, widerstand: zufall() < 0.2 ? 0 : zufall() * 10000,
        modus: SL.MODI[Math.floor(zufall() * 3)], typ: Object.keys(SL.LAMPEN)[Math.floor(zufall() * 4)],
      });
    }
    const alle = doc.bauteile.flatMap(b => M.anschluesse(b));
    for (let i = 0; i < anzahl * 2; i++) M.verbinde(doc, alle[Math.floor(zufall() * alle.length)], alle[Math.floor(zufall() * alle.length)]);
    for (const laeuft of [true, false]) {
      const erg = sim(doc, laeuft);
      pruefeKirchhoff(doc, erg);
      for (const m of Object.values(erg.messgeraete)) assert.equal(typeof m.anzeige, 'string');
      assert.ok(SL.zeichnen.szene({ doc, erg, laeuft, messwerte: true, flussAn: true }).length > 0);
    }
    if (n % 10 === 0) {
      const stat = SL.sim.zeitverlauf(doc, true, {});
      const k = SL.sim.kombiniere(sim(doc, true, { t: 0.13 }), stat);
      for (const r of Object.values(k.bauteile)) for (const x of ['U', 'I', 'P']) if (r[x] != null) assert.ok(Number.isFinite(r[x]));
      assert.ok(SL.zeichnen.szene({ doc, erg: k, laeuft: true, messwerte: true, flussAn: true }).length > 0);
    }
  }
  assert.ok(Date.now() - start < 15000, 'schnell genug');
});

test('20 · Zahlen werden mit passender Einheit angezeigt', () => {
  assert.equal(SL.fmt(0.1, 'A'), '100 mA');
  assert.equal(SL.fmt(6, 'V'), '6,00 V');
  assert.equal(SL.fmt(4700, 'Ω'), '4,70 kΩ');
  assert.equal(SL.fmt(0, 'W'), '0 W');
  assert.equal(SL.fmt(-0.5, 'A'), '−500 mA');
  assert.equal(SL.fmt(NaN, 'V'), '–');
  assert.equal(SL.fmt(0.0000123, 'A'), '12,3 µA');
});

// ---------------------------------------------------------------- Wechselspannung und Transistor

/** Quelle (Typ beliebig) in Reihe mit Teilen, wie reihe(), aber mit freier Quelle. */
function reiheMit(quelle, werte, teile) {
  const doc = M.neu();
  const u = M.bauteil(doc, quelle, 0, 0, werte);
  const bs = teile.map(([typ, w], i) => M.bauteil(doc, typ, 200 * (i + 1), 200, w));
  let vorher = { b: u.id, a: 'a' };
  for (const b of bs) { M.verbinde(doc, vorher, { b: b.id, a: 'a' }); vorher = { b: b.id, a: b.typ === 'diode' ? 'k' : 'b' }; }
  M.verbinde(doc, vorher, { b: u.id, a: 'b' });
  return { doc, u, bs };
}

test('21 · Wechselspannung: Momentanwerte folgen dem Sinus, Effektivwert = Scheitelwert / √2', () => {
  const { doc, bs: [r] } = reiheMit('wechsel', { spannung: 10, frequenz: 2 }, [['widerstand', { widerstand: 100 }]]);
  const T = 1 / 2;
  nah(sim(doc, true, { t: T / 4 }).bauteile[r.id].I, 10 * Math.SQRT2 / 100, 1e-4, 'Scheitelwert nach T/4:');
  nah(sim(doc, true, { t: 3 * T / 4 }).bauteile[r.id].I, -10 * Math.SQRT2 / 100, 1e-4, 'Richtung kehrt sich um:');
  nah(sim(doc, true, { t: T / 2 }).bauteile[r.id].I, 0, 1e-4, 'Nulldurchgang:');
  const stat = SL.sim.zeitverlauf(doc, true);
  nah(stat.bauteile[r.id].Ieff, 0.1, 1e-3, 'Effektivwert 10 V / 100 Ω:');
  nah(stat.bauteile[r.id].Imittel, 0, 1e-3, 'Mittelwert:');
  nah(stat.bauteile[r.id].Pmittel, 1, 0.01, 'mittlere Leistung:');
  assert.equal(stat.schnell, false);
  assert.ok(stat.meldungen.some(m => /Wechselstrom/.test(m.text)));
  pruefeKirchhoff(doc, sim(doc, true, { t: 0.1 }));
  assert.equal(SL.sim.zeitverlauf(doc, false), null, 'gestoppt: kein Zeitverlauf');
  // Frequenz und Spannung werden begrenzt
  M.setzeWert(doc, doc.bauteile[0].id, 'frequenz', 500);
  assert.equal(doc.bauteile[0].werte.frequenz, 50);
});

test('22 · Wechselspannung: Lampe leuchtet bei 50 Hz gleichmäßig, Messgerät zeigt den Effektivwert', () => {
  const { doc, u, bs: [l] } = reiheMit('wechsel', { spannung: 6, frequenz: 50 }, [['lampe']]);
  const m = M.bauteil(doc, 'messgeraet', 400, -100, { modus: 'V' });
  M.verbinde(doc, { b: m.id, a: 'v' }, { b: l.id, a: 'a' });
  M.verbinde(doc, { b: m.id, a: 'com' }, { b: l.id, a: 'b' });
  const stat = SL.sim.zeitverlauf(doc, true);
  assert.equal(stat.schnell, true);
  nah(stat.bauteile[l.id].hell, 1, 0.01, '6 V effektiv an 6-V-Lampe:');
  const k = SL.sim.kombiniere(sim(doc, true, { t: 0.0001 }), stat);
  nah(k.bauteile[l.id].hell, 1, 0.01, 'auch kurz nach dem Nulldurchgang volle (mittlere) Helligkeit:');
  assert.equal(k.bauteile[l.id].zustand, 'an');
  assert.equal(k.messgeraete[m.id].effektiv, true);
  nah(k.messgeraete[m.id].wert, 6, 0.05, 'Effektivwert am Messgerät:');
  assert.match(k.messgeraete[m.id].anzeige, /V~$/);
  assert.ok(Object.values(k.draehte).some(d => d.wechselnd), 'Drähte: Strom ohne mittlere Richtung');
  assert.ok(!k.meldungen.some(x => /durchbrennen/.test(x.text)), 'keine falsche Überlast durch den Scheitelwert');
  void u;
});

test('23 · Wechselspannung mit Diode: Einweggleichrichter', () => {
  const { doc, bs: [d, r] } = reiheMit('wechsel', { spannung: 10, frequenz: 1 }, [['diode'], ['widerstand', { widerstand: 100 }]]);
  assert.equal(sim(doc, true, { t: 0.25 }).bauteile[d.id].zustand, 'leitend');
  assert.equal(sim(doc, true, { t: 0.75 }).bauteile[d.id].zustand, 'sperrend');
  assert.equal(sim(doc, true, { t: 0.75 }).bauteile[r.id].I, 0);
  const stat = SL.sim.zeitverlauf(doc, true);
  assert.ok(stat.bauteile[r.id].Imittel > 0.03, `Mittelwert ${stat.bauteile[r.id].Imittel} – der Strom fließt nur in eine Richtung`);
  assert.ok(stat.bauteile[r.id].Ieff < 0.1);
});

/** Transistor als Schalter: Quelle 6 V, Lampe im Kollektorkreis, Basis über R_B an +. */
function transistorSchaltung(rb) {
  const doc = M.neu();
  const u = M.bauteil(doc, 'quelle', 0, 0, { spannung: 6 });
  const l = M.bauteil(doc, 'lampe', 200, -100);
  const t = M.bauteil(doc, 'transistor', 200, 100);
  const r = M.bauteil(doc, 'widerstand', 100, 100, { widerstand: rb });
  M.verbinde(doc, { b: u.id, a: 'a' }, { b: l.id, a: 'a' });
  M.verbinde(doc, { b: l.id, a: 'b' }, { b: t.id, a: 'c' });
  M.verbinde(doc, { b: t.id, a: 'e' }, { b: u.id, a: 'b' });
  M.verbinde(doc, { b: u.id, a: 'a' }, { b: r.id, a: 'a' });
  M.verbinde(doc, { b: r.id, a: 'b' }, { b: t.id, a: 'b' });
  return { doc, u, l, t, r };
}

test('24 · Transistor: sperrt ohne Basisstrom, verstärkt (I_C ≈ β · I_B), schaltet voll durch', () => {
  // Basis offen: sperrt
  let x = transistorSchaltung(1000);
  M.loesche(x.doc, { art: 'bauteil', id: x.r.id });
  let e = sim(x.doc);
  assert.equal(e.bauteile[x.t.id].zustand, 'sperrt');
  assert.equal(e.bauteile[x.l.id].zustand, 'aus');
  // 100 kΩ an der Basis: kleiner Basisstrom, Kollektorstrom ≈ 100-fach
  x = transistorSchaltung(100000);
  e = sim(x.doc);
  const rt = e.bauteile[x.t.id];
  assert.equal(rt.zustand, 'verstärkt');
  nah(rt.I / rt.Ib, SL.K.BETA_F, 2, 'Stromverstärkung:');
  assert.ok(rt.Ube > 0.5 && rt.Ube < 0.75, `U_BE = ${rt.Ube}`);
  // 1 kΩ: Transistor schaltet voll durch, Lampe leuchtet fast voll
  x = transistorSchaltung(1000);
  e = sim(x.doc);
  assert.equal(e.bauteile[x.t.id].zustand, 'durchgeschaltet');
  assert.ok(e.bauteile[x.t.id].U < 0.3, `U_CE = ${e.bauteile[x.t.id].U}`);
  assert.ok(e.bauteile[x.l.id].hell > 0.9);
  // Knotenregel am Transistor: I_E = I_B + I_C (aus der Quelle)
  nah(e.bauteile[x.u.id].I, e.bauteile[x.t.id].I + e.bauteile[x.t.id].Ib, 1e-6, 'Quellenstrom = I_C + I_B:');
});

test('25 · Neue Bauteile: Speichern/Laden, Anschlussnamen, Zeichnen', () => {
  const doc = M.neu();
  for (const typ of ['wechsel', 'transistor']) M.bauteil(doc, typ, 0, 0);
  const r = M.importiere(M.exportiere(doc));
  assert.equal(r.ok, true);
  assert.deepEqual([...r.doc.bauteile.map(b => b.name)], ['G1', 'T1']);
  const t = doc.bauteile[1];
  assert.equal(M.anschlussName(t, 'c'), 'Kollektor (C)');
  const svg = SL.zeichnen.szene({ doc, erg: sim(doc), laeuft: true, messwerte: true, flussAn: true });
  assert.match(svg, /T1/);
  for (const typ of Object.keys(SL.TYPEN)) assert.match(SL.zeichnen.symbol(typ), /^<svg/);
  // Logikgatter gibt es nicht mehr: alte Dateien damit laden trotzdem, die Gatter werden übersprungen
  const alt = JSON.parse(M.exportiere(doc));
  alt.bauteile.push({ id: 'b9', typ: 'und', name: 'UND1', x: 0, y: 0, rot: 0, werte: {} });
  alt.draehte.push({ id: 'd9', von: { b: 'b9', a: 'q' }, nach: { b: t.id, a: 'b' } });
  const geladen = M.importiere(JSON.stringify(alt));
  assert.equal(geladen.ok, true);
  assert.equal(geladen.doc.bauteile.length, 2);
  assert.equal(geladen.doc.draehte.length, 0);
  assert.ok(!('und' in SL.TYPEN));
});
