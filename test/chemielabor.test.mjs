// Tests für das Atom- & Chemielabor (Fach Sandbox): Datenkonsistenz des Periodensystems, Element aus der Protonenzahl,
// Massenzahl und Ionenladung, Elektronenkonfigurationen, Nukliddaten (auch fehlende), Formel-Parser, molare Massen,
// Energiestufen und Teilchenmodell (Molekülbaukasten: test/molekuel.test.mjs). Die Moduldateien laufen wie im Browser (ohne DOM) in einer VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lessons/sandbox-chemielabor');
const ctx = vm.createContext({});
for (const f of ['daten-elemente.js', 'daten-nuklide.js', 'daten-stoffe.js', 'chemie.js', 'molekuel.js', 'teilchen.js']) {
  vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
}
const { chemie: C, molekuel: M, teilchen: T, daten: D } = ctx.CL;
const plain = x => JSON.parse(JSON.stringify(x));
const nahe = (ist, soll, tol, text) => assert.ok(Math.abs(ist - soll) <= tol, `${text}: ${ist} statt ${soll}`);

// ------------------------------------------------------------------ Periodensystem / Datenkonsistenz
test('1 · Genau 118 Elemente mit eindeutigen Symbolen und Namen, Ordnungszahl = Position', () => {
  assert.equal(C.elemente.length, 118);
  assert.equal(new Set(C.elemente.map(e => e.symbol)).size, 118);
  assert.equal(new Set(C.elemente.map(e => e.name)).size, 118);
  C.elemente.forEach((e, i) => {
    assert.equal(e.z, i + 1);
    assert.match(e.symbol, /^[A-Z][a-z]?$/, e.symbol);
    assert.equal(C.element(e.symbol), e);
    assert.equal(C.element(e.z), e);
    assert.ok(D.KATEGORIEN[e.kategorie], `${e.symbol}: unbekannte Stoffklasse`);
    assert.ok(e.zustand === null || ['s', 'l', 'g'].includes(e.zustand), e.symbol);
  });
  assert.equal(C.element(0), null);
  assert.equal(C.element(119), null);
  assert.equal(C.element('Xx'), null);
  assert.equal(C.element('toString'), null);
});

test('2 · Stichproben der IUPAC-Daten (Symbol, Name, Atommasse)', () => {
  const soll = { 1: ['H', 'Wasserstoff', 1.008], 6: ['C', 'Kohlenstoff', 12.011], 8: ['O', 'Sauerstoff', 15.999], 11: ['Na', 'Natrium', 22.990],
    17: ['Cl', 'Chlor', 35.45], 26: ['Fe', 'Eisen', 55.845], 29: ['Cu', 'Kupfer', 63.546], 79: ['Au', 'Gold', 196.97], 82: ['Pb', 'Blei', 207.2],
    92: ['U', 'Uran', 238.03], 117: ['Ts', 'Tenness', null], 118: ['Og', 'Oganesson', null] };
  for (const [z, [sym, name, m]] of Object.entries(soll)) {
    const e = C.element(Number(z));
    assert.equal(e.symbol, sym); assert.equal(e.name, name);
    if (m === null) assert.equal(e.masse, null); else nahe(e.masse, m, 1e-9, sym);
  }
});

test('3 · Atommassen steigen fast immer mit Z – nur die bekannten Ausnahmen (Ar/K, Co/Ni, Te/I, Th/Pa, U)', () => {
  const ausnahmen = [];
  const mit = C.elemente.filter(e => e.masse !== null);
  for (let i = 1; i < mit.length; i++) if (mit[i].masse < mit[i - 1].masse) ausnahmen.push(mit[i - 1].symbol + '>' + mit[i].symbol);
  assert.deepEqual(ausnahmen, ['Ar>K', 'Co>Ni', 'Te>I', 'Th>Pa']);
});

test('4 · Elemente ohne stabiles Isotop haben keine Atommasse, sondern nur eine Massenzahl in Klammern', () => {
  const ohne = C.elemente.filter(e => e.masse === null).map(e => e.z);
  for (const z of [43, 61, 84, 85, 86, 87, 88, 89, 93, 118]) assert.ok(ohne.includes(z), `Z=${z}`);
  for (const z of [83, 90, 91, 92]) assert.ok(!ohne.includes(z), `Z=${z} hat ein Standardatomgewicht`);
  for (const e of C.elemente.filter(e => e.masse === null)) {
    assert.ok(Number.isInteger(e.massenzahlLanglebig) && e.massenzahlLanglebig > e.z, e.symbol);
    assert.equal(e.isotop, null, `${e.symbol}: kein natürliches Hauptisotop`);
  }
  // Wo es ein häufigstes Isotop gibt, liegt es nahe der Atommasse
  for (const e of C.elemente.filter(e => e.isotop)) assert.ok(Math.abs(e.isotop - e.masse) < 3.5, `${e.symbol}: ${e.isotop} vs ${e.masse}`);
});

test('5 · Stellung im Periodensystem: Perioden, Gruppen, f-Block und jede Zelle nur einmal', () => {
  const p = z => plain(C.stellung(z));
  assert.deepEqual(p(1), { periode: 1, gruppe: 1, fSpalte: null, block: 's' });
  assert.deepEqual(p(2), { periode: 1, gruppe: 18, fSpalte: null, block: 's' });
  assert.equal(C.stellung(5).gruppe, 13);
  assert.equal(C.stellung(21).gruppe, 3);
  assert.equal(C.stellung(31).gruppe, 13);
  assert.deepEqual(p(57), { periode: 6, gruppe: null, fSpalte: 0, block: 'f' });
  assert.deepEqual(p(71), { periode: 6, gruppe: null, fSpalte: 14, block: 'f' });
  assert.equal(C.stellung(72).gruppe, 4);
  assert.equal(C.stellung(104).gruppe, 4);
  assert.deepEqual(p(118), { periode: 7, gruppe: 18, fSpalte: null, block: 'p' });
  assert.equal(C.stellung(0), null);
  assert.equal(C.stellung(119), null);
  const zellen = new Set();
  for (const e of C.elemente) {
    const key = e.fSpalte !== null ? `f${e.periode}-${e.fSpalte}` : `${e.periode}-${e.gruppe}`;
    assert.ok(!zellen.has(key), `${e.symbol} doppelt belegt: ${key}`);
    zellen.add(key);
  }
  for (const [g, syms] of Object.entries({ 1: ['H', 'Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'], 17: ['F', 'Cl', 'Br', 'I', 'At', 'Ts'], 18: ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og'] })) {
    assert.deepEqual(plain(C.elemente.filter(e => e.gruppe === Number(g)).map(e => e.symbol)), syms);
  }
  assert.equal(C.elemente.filter(e => e.kategorie === 'la').length, 15);
  assert.equal(C.elemente.filter(e => e.kategorie === 'ac').length, 15);
});

test('6 · Zustand bei 20 °C: genau Br und Hg flüssig, elf Gase, ab Z = 100 nicht gemessen', () => {
  assert.deepEqual(plain(C.elemente.filter(e => e.zustand === 'l').map(e => e.symbol)), ['Br', 'Hg']);
  assert.deepEqual(plain(C.elemente.filter(e => e.zustand === 'g').map(e => e.symbol)), ['H', 'He', 'N', 'O', 'F', 'Ne', 'Cl', 'Ar', 'Kr', 'Xe', 'Rn']);
  for (const e of C.elemente.filter(e => e.z >= 100)) { assert.equal(e.zustand, null, e.symbol); assert.ok(e.nurEinzelneAtome); }
});

// ------------------------------------------------------------------ Atome, Ionen, Isotope
test('7 · Das Element hängt nur von der Protonenzahl ab', () => {
  for (const [n, e] of [[6, 6], [8, 6], [6, 2], [0, 6], [20, 10]]) assert.equal(C.atom(6, n, e).element.symbol, 'C');
  assert.equal(C.atom(7, 6, 6).element.symbol, 'N');
  assert.equal(C.atom(1, 0, 0).element.symbol, 'H');
  assert.equal(C.atom(118, 176, 118).element.symbol, 'Og');
  assert.equal(C.atom(0, 1, 0).element, null);
  assert.equal(C.atom(119, 180, 119).element, null);
  for (let p = 1; p <= 118; p++) assert.equal(C.atom(p, 3, 1).element.z, p);
});

test('8 · Massenzahl A = Z + N und Ladung = Protonen − Elektronen', () => {
  const na = C.atom(11, 12, 10);
  assert.equal(na.massenzahl, 23); assert.equal(na.ladung, 1); assert.equal(na.schreibweise, '²³Na⁺'); assert.match(na.art, /Kation/);
  const cl = C.atom(17, 18, 18);
  assert.equal(cl.massenzahl, 35); assert.equal(cl.ladung, -1); assert.equal(cl.schreibweise, '³⁵Cl⁻'); assert.match(cl.art, /Anion/);
  const o = C.atom(8, 8, 10);
  assert.equal(o.ladung, -2); assert.equal(o.schreibweise, '¹⁶O²⁻');
  const c14 = C.atom(6, 8, 6);
  assert.equal(c14.massenzahl, 14); assert.equal(c14.ladung, 0); assert.equal(c14.isotopName, 'Kohlenstoff-14'); assert.equal(c14.art, 'Atom');
  assert.equal(C.atom(26, 30, 23).ladung, 3);
});

test('9 · Ungültige Teilchenzahlen werden abgelehnt', () => {
  for (const args of [[-1, 0, 0], [1, -1, 1], [1, 0, -2], [1.5, 0, 1], [NaN, 0, 0], ['6', 6, 6]]) assert.ok(C.atom(...args).fehler, JSON.stringify(args));
});

test('10 · Nuklide: stabil, radioaktiv mit Halbwertszeit, natürlich, keine Daten, kein Kern', () => {
  assert.equal(C.nuklid(6, 6).status, 'stabil');
  assert.equal(C.nuklid(6, 7).status, 'stabil');
  const c14 = C.nuklid(6, 8);
  assert.equal(c14.status, 'radioaktiv'); assert.deepEqual(plain(c14.halbwertszeit), { wert: 5700, einheit: 'a' });
  assert.equal(C.nuklid(1, 2).status, 'radioaktiv');
  assert.equal(C.nuklid(92, 146).status, 'radioaktiv');
  // Kein Zahlenwert hinterlegt → keine erfundene Halbwertszeit
  const ca48 = C.nuklid(20, 28);
  assert.equal(ca48.status, 'radioaktiv'); assert.equal(ca48.halbwertszeit, null);
  // Fehlende Daten werden ausdrücklich als unbekannt behandelt
  const c8 = C.nuklid(6, 2);
  assert.equal(c8.status, 'keine-daten'); assert.equal(c8.trend, 'wenig-n'); assert.match(c8.hinweis, /keine Daten/);
  const c22 = C.nuklid(6, 16);
  assert.equal(c22.status, 'keine-daten'); assert.equal(c22.trend, 'viel-n');
  const sn = C.nuklid(50, 70);
  assert.equal(sn.status, 'natuerlich'); assert.equal(sn.datenVorhanden, false);
  const sn2 = C.nuklid(50, 90);
  assert.equal(sn2.status, 'keine-daten'); assert.equal(sn2.datenVorhanden, false); assert.match(sn2.hinweis, /nicht beurteilen/);
  assert.doesNotMatch(sn2.hinweis, /\bstabil\b(?! )/);
  assert.match(C.nuklid(43, 55).hinweis, /kein stabiles Isotop/);
  assert.equal(C.nuklid(0, 1).status, 'kein-kern');
  assert.equal(C.nuklid(119, 180).status, 'kein-kern');
  assert.equal(C.nuklid(-1, 0).status, 'kein-kern');
});

test('11 · Nukliddatensatz: Z = 1–20 vollständig, stabile Liste plausibel, Halbwertszeiten positiv', () => {
  for (let z = 1; z <= 20; z++) assert.ok(D.NUKLIDE[z] && D.NUKLIDE[z].stabil.length >= 1, `Z=${z}`);
  const anzahlStabil = Object.entries(D.NUKLIDE).filter(([z]) => z <= 20).reduce((s, [, d]) => s + d.stabil.length, 0);
  assert.equal(anzahlStabil, 45);   // Zahl der stabilen Nuklide von H bis Ca (IAEA; Ca-48 zählt als radioaktiv)
  for (const [z, d] of Object.entries(D.NUKLIDE)) {
    const alle = [...d.stabil, ...d.radioaktiv.map(r => r[0])];
    assert.equal(new Set(alle).size, alle.length, `Z=${z}: Massenzahl doppelt`);
    for (const a of alle) assert.ok(a >= Number(z), `Z=${z}, A=${a}`);
    for (const r of d.radioaktiv) {
      assert.ok(r[1] === null || r[1] > 0);
      assert.ok(D.EINHEIT_ZEIT[r[2]], `Z=${z}: Einheit`);
    }
    if (D.OHNE_STABILE_NUKLIDE(Number(z))) assert.equal(d.stabil.length, 0, `Z=${z} hat kein stabiles Nuklid`);
    const e = C.element(Number(z));
    if (e.isotop && Number(z) <= 20) assert.ok(d.stabil.includes(e.isotop), `${e.symbol}: Hauptisotop ist stabil`);
  }
});

// ------------------------------------------------------------------ Elektronenkonfiguration
test('12 · Elektronenkonfigurationen ausgewählter Elemente (NIST-Grundzustände)', () => {
  const soll = {
    1: '1s¹', 2: '1s²', 6: '[He] 2s² 2p²', 8: '[He] 2s² 2p⁴', 10: '[He] 2s² 2p⁶', 11: '[Ne] 3s¹', 17: '[Ne] 3s² 3p⁵',
    19: '[Ar] 4s¹', 20: '[Ar] 4s²', 21: '[Ar] 3d¹ 4s²', 24: '[Ar] 3d⁵ 4s¹', 26: '[Ar] 3d⁶ 4s²', 29: '[Ar] 3d¹⁰ 4s¹', 30: '[Ar] 3d¹⁰ 4s²',
    35: '[Ar] 3d¹⁰ 4s² 4p⁵', 46: '[Kr] 4d¹⁰', 47: '[Kr] 4d¹⁰ 5s¹', 57: '[Xe] 5d¹ 6s²', 64: '[Xe] 4f⁷ 5d¹ 6s²', 79: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹',
    80: '[Xe] 4f¹⁴ 5d¹⁰ 6s²', 86: '[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶', 92: '[Rn] 5f³ 6d¹ 7s²',
  };
  for (const [z, k] of Object.entries(soll)) assert.equal(C.konfiguration(Number(z)).kurz, k, `Z=${z}`);
  assert.equal(C.konfiguration(26).text, '1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ 4s²');
});

test('13 · Schalen: K/L/M/N-Besetzung, Kalium nicht nach der starren 2-8-18-Regel', () => {
  assert.deepEqual(plain(C.konfiguration(11).schalen), [2, 8, 1]);
  assert.deepEqual(plain(C.konfiguration(19).schalen), [2, 8, 8, 1]);
  assert.deepEqual(plain(C.konfiguration(20).schalen), [2, 8, 8, 2]);
  assert.deepEqual(plain(C.konfiguration(26).schalen), [2, 8, 14, 2]);
  assert.deepEqual(plain(C.konfiguration(36).schalen), [2, 8, 18, 8]);
  assert.equal(C.konfiguration(17).valenzelektronen, 7);
  for (const e of C.elemente) {
    const k = C.konfiguration(e.z);
    assert.equal(k.schalen.reduce((a, b) => a + b, 0), e.z, e.symbol);
    for (const u of k.unterschalen) assert.ok(u.anzahl >= 1 && u.anzahl <= u.max, `${e.symbol} ${u.name}`);
    k.schalen.forEach((x, i) => assert.ok(x <= 2 * (i + 1) ** 2, `${e.symbol}: Schale ${i + 1} überfüllt`));
  }
});

test('14 · Ausnahmen und vorhergesagte Konfigurationen sind gekennzeichnet', () => {
  assert.equal(C.konfiguration(24).ausnahme, true);
  assert.equal(C.konfiguration(29).ausnahme, true);
  assert.equal(C.konfiguration(26).ausnahme, false);
  assert.equal(C.konfiguration(99).vorhergesagt, false);
  assert.equal(C.konfiguration(100).vorhergesagt, true);
  assert.equal(C.konfiguration(118).vorhergesagt, true);
  for (const z of Object.keys(D.KONFIG_AUSNAHMEN)) {
    const k = C.konfiguration(Number(z));
    assert.equal(k.schalen.reduce((a, b) => a + b, 0), Number(z), `Ausnahme Z=${z} hat falsche Elektronenzahl`);
  }
});

test('15 · Konfiguration von Ionen: Edelgaskonfiguration, Übergangsmetalle geben zuerst 4s ab', () => {
  assert.equal(C.konfiguration(11, 10).text, C.konfiguration(10).text);   // Na⁺ wie Ne
  assert.equal(C.konfiguration(17, 18).text, C.konfiguration(18).text);   // Cl⁻ wie Ar
  assert.equal(C.konfiguration(8, 10).text, C.konfiguration(10).text);    // O²⁻ wie Ne
  assert.equal(C.konfiguration(12, 10).text, C.konfiguration(10).text);   // Mg²⁺ wie Ne
  assert.equal(C.konfiguration(26, 24).kurz, '[Ar] 3d⁶');                 // Fe²⁺
  assert.equal(C.konfiguration(26, 23).kurz, '[Ar] 3d⁵');                 // Fe³⁺
  assert.equal(C.konfiguration(29, 28).kurz, '[Ar] 3d¹⁰');                // Cu⁺
  assert.deepEqual(plain(C.konfiguration(1, 0).unterschalen), []);        // H⁺: nackter Kern
  assert.equal(C.konfiguration(0), null);
  assert.equal(C.konfiguration(6, -1), null);
  assert.equal(C.konfiguration(6, 2.5), null);
});

test('16 · Ionisierungsenergien nur für Z = 1–36, Edelgase sind Maxima ihrer Periode', () => {
  assert.equal(D.IONISIERUNG.length, 36);
  assert.equal(C.element(37).ionisierung, null);
  nahe(C.element(1).ionisierung, 13.60, 1e-9, 'H');
  nahe(C.element(2).ionisierung, 24.59, 1e-9, 'He');
  for (const [a, b] of [[3, 10], [11, 18], [19, 36]]) {
    const werte = D.IONISIERUNG.slice(a - 1, b);
    assert.equal(Math.max(...werte), werte[werte.length - 1], `Periode ab Z=${a}`);
    assert.equal(Math.min(...werte), werte[0], `Alkalimetall Z=${a} ist Minimum`);
  }
});

// ------------------------------------------------------------------ Energiestufen
test('17 · Wasserstoff: Energiestufen, Balmer-Linien, Emission/Absorption', () => {
  nahe(C.wasserstoffNiveau(1), -13.598, 1e-9, 'E1');
  nahe(C.wasserstoffNiveau(2), -3.3995, 1e-4, 'E2');
  assert.ok(Number.isNaN(C.wasserstoffNiveau(0)));
  const ha = C.uebergang(3, 2);
  assert.equal(ha.art, 'Emission'); nahe(ha.energie, 1.889, 0.001, 'Hα-Energie'); nahe(ha.wellenlaenge, 656.5, 0.3, 'Hα');
  assert.equal(ha.bereich, 'sichtbares Licht'); assert.equal(C.farbeVon(ha.wellenlaenge).name, 'rot');
  nahe(C.uebergang(4, 2).wellenlaenge, 486.1, 0.4, 'Hβ');
  const ly = C.uebergang(1, 2);
  assert.equal(ly.art, 'Absorption'); nahe(ly.energie, 10.20, 0.01, 'Lyman α'); assert.match(ly.bereich, /Ultraviolett/);
  assert.match(C.uebergang(4, 3).bereich, /Infrarot/);
  assert.equal(C.uebergang(2, 2), null);
  assert.equal(C.farbeVon(200), null);
});

// ------------------------------------------------------------------ Formel-Parser
test('18 · Parser: Elemente, Indizes, Klammern, Kristallwasser, Ladungen, Unicode-Indizes', () => {
  const zaehle = f => { const r = C.parseFormel(f); assert.ok(r.ok, `${f}: ${r.fehler}`); return plain(r.anzahl); };
  assert.deepEqual(zaehle('H2O'), { H: 2, O: 1 });
  assert.deepEqual(zaehle('NaCl'), { Na: 1, Cl: 1 });
  assert.deepEqual(zaehle('Ca(OH)2'), { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(zaehle('Al2(SO4)3'), { Al: 2, S: 3, O: 12 });
  assert.deepEqual(zaehle('K4[Fe(CN)6]'), { K: 4, Fe: 1, C: 6, N: 6 });
  assert.deepEqual(zaehle('CuSO4·5H2O'), { Cu: 1, S: 1, O: 9, H: 10 });
  assert.deepEqual(zaehle('CuSO4*5H2O'), { Cu: 1, S: 1, O: 9, H: 10 });
  assert.deepEqual(zaehle('H₂SO₄'), { H: 2, S: 1, O: 4 });
  assert.deepEqual(zaehle('2H2O'), { H: 4, O: 2 });
  assert.deepEqual(zaehle('C6H12O6'), { C: 6, H: 12, O: 6 });
  assert.deepEqual(zaehle('CH3COOH'), { C: 2, H: 4, O: 2 });
  assert.deepEqual(zaehle(' h'.trim().toUpperCase()), { H: 1 });
  assert.equal(C.parseFormel('SO4^2-').ladung, -2);
  assert.equal(C.parseFormel('SO₄²⁻').ladung, -2);
  assert.equal(C.parseFormel('NH4+').ladung, 1);
  assert.equal(C.parseFormel('Fe^3+').ladung, 3);
  assert.equal(C.parseFormel('Cl-').ladung, -1);
  assert.equal(C.parseFormel('H2O').ladung, 0);
  assert.equal(C.parseFormel('Ca(OH)2').anzeige, 'Ca(OH)₂');
  assert.equal(C.parseFormel('SO4^2-').anzeige, 'SO₄²⁻');
  assert.equal(C.parseFormel('Co').anzahl.Co, 1);                 // Cobalt …
  assert.deepEqual(zaehle('CO'), { C: 1, O: 1 });                 // … nicht Kohlenstoffmonoxid
});

test('19 · Parser: ungültige Eingaben mit verständlicher Meldung und Fehlerstelle', () => {
  const fehler = (f, muster, pos) => {
    const r = C.parseFormel(f);
    assert.equal(r.ok, false, `${f} sollte ungültig sein`);
    assert.match(r.fehler, muster, f);
    if (pos !== undefined) assert.equal(r.pos, pos, `${f}: Fehlerstelle`);
  };
  fehler('', /Gib eine Formel ein/);
  fehler('   ', /Gib eine Formel ein/);
  fehler('h2o', /Großbuchstaben/, 0);
  fehler('Xy', /kein Elementsymbol/, 0);
  fehler('HXz', /kein Elementsymbol/, 1);
  fehler('Uuo', /höchstens zwei Buchstaben/);
  fehler('Ca(OH', /nicht geschlossen/, 2);
  fehler('CaOH)2', /öffnende Klammer/, 4);
  fehler('Ca()2', /Leere Klammer/);
  fehler('H0', /mindestens 1/, 1);
  fehler('H02', /mindestens 1|nicht mit 0/);
  fehler('0H2', /mindestens 1/);
  fehler('H2O%', /nicht erlaubt/, 3);
  fehler('H+2O', /Ende/);
  fehler('2', /fehlt die Formel/);
  fehler('H1000', /zu groß/);
  fehler('((((((((H))))))))', /Zu viele Klammern/);
  fehler('H'.repeat(61), /zu lang/);
  fehler('Na^0+', /0/);
  fehler(null, /Gib eine Formel ein/);
});

test('20 · Molare Massen mit Rechenschritten', () => {
  const M_ = f => { const r = C.molareMasse(f); assert.ok(r.ok, `${f}: ${r.fehler}`); return r.molareMasse; };
  nahe(M_('H2O'), 18.015, 0.001, 'H2O');
  nahe(M_('CO2'), 44.009, 0.001, 'CO2');
  nahe(M_('NaCl'), 58.44, 0.001, 'NaCl');
  nahe(M_('H2SO4'), 98.07, 0.01, 'H2SO4');
  nahe(M_('C6H12O6'), 180.156, 0.001, 'Glucose');
  nahe(M_('CaCO3'), 100.086, 0.001, 'CaCO3');
  nahe(M_('CuSO4·5H2O'), 249.68, 0.01, 'Kupfersulfat-Pentahydrat');
  nahe(M_('Fe2O3'), 159.687, 0.001, 'Fe2O3');
  nahe(M_('2H2O'), 2 * M_('H2O'), 1e-9, 'Vorfaktor');
  const r = C.molareMasse('H2SO4');
  assert.deepEqual(plain(r.schritte.map(s => [s.symbol, s.anzahl])), [['H', 2], ['S', 1], ['O', 4]]);
  nahe(r.schritte.reduce((a, s) => a + s.beitrag, 0), r.molareMasse, 1e-12, 'Summe der Schritte');
  assert.equal(r.text, 'H₂SO₄');
});

test('21 · Keine molare Masse für Elemente ohne Standardatomgewicht, Parserfehler werden durchgereicht', () => {
  const pu = C.molareMasse('PuO2');
  assert.equal(pu.ok, false); assert.match(pu.fehler, /Plutonium/); assert.ok(pu.formel.ok);
  assert.equal(C.molareMasse('Tc').ok, false);
  assert.equal(C.molareMasse('xyz').ok, false);
});

test('22 · Summenformel nach Hill', () => {
  assert.equal(C.hill({ O: 1, H: 6, C: 2 }), 'C₂H₆O');
  assert.equal(C.hill({ H: 2, O: 1 }), 'H₂O');
  assert.equal(C.hill({ Cl: 1, Na: 1 }), 'ClNa');
  assert.equal(C.hill({ C: 1, O: 2 }), 'CO₂');
  assert.equal(C.hill({ N: 1, H: 3 }), 'H₃N');
});

// Molekülbaukasten (Molecule Builder): eigene Datei test/molekuel.test.mjs

// ------------------------------------------------------------------ Teilchenmodell
test('28 · Teilchenmodell: Kelvin, Zustand aus Tabellenwerten, Geschwindigkeitsverhältnis', () => {
  assert.equal(T.kelvin(0), 273.15);
  assert.equal(T.kelvin(-273.15), 0);
  assert.equal(T.zustand('wasser', -10), 'fest');
  assert.equal(T.zustand('wasser', 0), 'schmelzen');
  assert.equal(T.zustand('wasser', 20), 'fluessig');
  assert.equal(T.zustand('wasser', 100), 'sieden');
  assert.equal(T.zustand('wasser', 120), 'gas');
  assert.equal(T.zustand('sauerstoff', 20), 'gas');
  assert.equal(T.zustand('sauerstoff', -200), 'fluessig');
  assert.equal(T.zustand('sauerstoff', -230), 'fest');
  assert.equal(T.zustand('eisen', 1000), 'fest');
  assert.equal(T.zustand('wasser', -300), null, 'unter dem absoluten Nullpunkt');
  assert.equal(T.zustand('gibtsnicht', 20), null);
  nahe(T.geschwindigkeitsVerhaeltnis(20, 20), 1, 1e-12, 'gleich');
  nahe(T.geschwindigkeitsVerhaeltnis(80, 20), Math.sqrt(353.15 / 293.15), 1e-12, '80 °C');
  for (const s of D.STOFFE_ZUSTAND) assert.ok(s.schmelz < s.siede, s.id);
});

test('29 · Animation bleibt im Behälter und rechnet ohne Fehler (alle Zustände)', () => {
  const sys = T.erzeugen(30, 380, 250, 5);
  for (const [t, z] of [[-30, 'fest'], [0, 'schmelzen'], [50, 'fluessig'], [100, 'sieden'], [150, 'gas']]) {
    for (let i = 0; i < 200; i++) T.schritt(sys, 1 / 30, t, z);
    for (const p of sys.teilchen) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), z);
      assert.ok(p.x >= 0 && p.x <= 380 && p.y >= 0 && p.y <= 250, `${z}: Teilchen außerhalb (${p.x}, ${p.y})`);
    }
  }
  assert.ok(Number.isFinite(T.mittlererAbstand(sys)));
});

test('30 · Quelldaten sind von Logik getrennt: Datendateien enthalten keine Rechenfunktionen außer der Nuklid-Regel', () => {
  for (const f of ['daten-elemente.js', 'daten-stoffe.js']) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.doesNotMatch(src, /document\.|window\.LK|Math\./, f);
  }
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/static\/lesson-kit\.css">/);
  assert.match(html, /<script src="\.\.\/\.\.\/static\/lesson-kit\.js"><\/script>/);
  assert.doesNotMatch(html, /https?:\/\//, 'keine externen Ressourcen');
  for (const m of html.matchAll(/<button(?![^>]*type="(button|submit)")/g)) assert.fail('Button ohne type: ' + m[0]);
});
