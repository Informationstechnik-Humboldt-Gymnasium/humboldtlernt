// Tests für das Physik-Labor (Fach Sandbox): Rechenmodule ohne DOM, Ablaufsteuerung (eine Schleife, Pause, Neustart),
// Eingabeprüfung, Diagrammachsen, Aufgaben des Lernmodus und Einbindung in die Lektion.
// Die Dateien laufen wie im Browser (ohne DOM) in einer VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'lessons/sandbox-physik');
const DATEIEN = ['kern.js', 'fall.js', 'wurf.js', 'reibung.js', 'feder.js', 'optik.js', 'katalog.js', 'aufgaben.js'];
const ctx = vm.createContext({});
for (const f of DATEIEN) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const PL = ctx.PL;
const nahe = (ist, soll, tol, text) => assert.ok(Math.abs(ist - soll) <= tol, `${text}: ${ist} statt ${soll}`);
const plain = x => JSON.parse(JSON.stringify(x));

test('1 · Eingaben: deutsche Zahlen, Grenzen, verständliche Fehler', () => {
  const E = PL.eingabe;
  assert.equal(E.lies('2,5'), 2.5);
  assert.equal(E.lies(' 0.25 '), 0.25);
  assert.equal(E.lies('−3'), -3, 'typografisches Minus');
  assert.equal(E.lies(',5'), 0.5);
  for (const schlecht of ['', 'abc', '1,2,3', '2 m', '1e3', '--1', null, undefined]) assert.ok(Number.isNaN(E.lies(schlecht)), String(schlecht));
  assert.deepEqual(plain(E.pruefe('12', { min: 0, max: 200, einheit: 'm' })), { ok: true, wert: 12, fehler: '' });
  const zuGross = E.pruefe('250', { min: 0, max: 200, einheit: 'm' });
  assert.equal(zuGross.ok, false);
  assert.match(zuGross.fehler, /0 m bis 200 m/);
  assert.match(E.pruefe('x', { min: 0, max: 1 }).fehler, /Zahl/);
  assert.equal(E.antwort('2,0', 2.02, 0.03), 'richtig');
  assert.equal(E.antwort('2,2', 2.02, 0.03), 'falsch');
  assert.equal(E.antwort('zwei', 2.02, 0.03), 'ungueltig');
});

test('2 · Diagrammachsen: runde Schritte, Bereich enthalten', () => {
  for (const [a, b] of [[0, 20], [0, 2.02], [-19.8, 0], [0, 0], [3, 3], [-0.137, 0.21], [0, 1234]]) {
    const s = PL.skala(a, b, 5);
    assert.ok(s.min <= Math.min(a, b) + 1e-9 && s.max >= Math.max(a, b) - 1e-9, `${a}–${b} enthalten`);
    const q = s.schritt / Math.pow(10, Math.floor(Math.log10(s.schritt)));
    assert.ok([1, 2, 2.5, 5].some(x => Math.abs(q - x) < 1e-9), `runder Schritt ${s.schritt}`);
    assert.ok(s.werte.length >= 2 && s.werte.length <= 12, `Anzahl Striche ${s.werte.length}`);
  }
  assert.deepEqual(plain(PL.skala(0, 20, 4).werte), [0, 5, 10, 15, 20]);
  assert.equal(PL.skala(0, 2.02, 5).stellen, 1);
});

/** künstliche Bildwiederholung: Rückrufe sammeln und von Hand auslösen */
function fakeRaf() {
  let n = 0; const warte = new Map();
  return {
    raf: f => { n++; warte.set(n, f); return n; },
    caf: id => warte.delete(id),
    get anzahl() { return warte.size; },
    bild(ts) { const f = [...warte.values()]; warte.clear(); f.forEach(g => g(ts)); },
  };
}

test('3 · Ablauf: nur eine Schleife, Pause hält an, Fortsetzen, Zurücksetzen, Ende', () => {
  const R = fakeRaf(), uhr = PL.uhr(R.raf, R.caf);
  let t = 0, gezeichnet = 0; const meldungen = [];
  const L = PL.lauf(uhr, {
    schritt: dt => { t += dt; return t >= 1; }, zeichne: () => gezeichnet++, zuruecksetzen: () => { t = 0; }, gemeldet: z => meldungen.push(z),
  });
  L.start(); L.start(); L.start();
  assert.equal(R.anzahl, 1, 'mehrfaches Starten erzeugt keine zweite Schleife');
  R.bild(0); R.bild(50); R.bild(100);
  nahe(t, 0.1, 1e-9, 'zwei Bilder à 50 ms');
  L.pause();
  assert.equal(R.anzahl, 0, 'pausiert: keine Bildanforderung mehr');
  R.bild(5000);
  nahe(t, 0.1, 1e-9, 'pausiert: Zeit steht');
  L.start(); R.bild(6000); R.bild(6050);
  nahe(t, 0.15, 1e-9, 'Fortsetzen ohne Zeitsprung');
  L.tempo = 2; R.bild(6100);
  nahe(t, 0.25, 1e-9, 'Tempo 2× verdoppelt die Simulationszeit');
  R.bild(60000);
  nahe(t, 0.45, 1e-9, 'langer Aussetzer (Tab im Hintergrund) wird auf 0,1 s begrenzt');
  L.zuruecksetzen();
  assert.equal(t, 0); assert.equal(L.zustand, 'bereit'); assert.equal(R.anzahl, 0);
  L.tempo = 1;
  assert.equal(L.bisEnde(0.01), true);
  assert.equal(L.zustand, 'fertig');
  L.start();
  assert.ok(t < 0.01 && L.zustand === 'laeuft', 'Start nach dem Ende beginnt von vorn');
  assert.deepEqual(plain(meldungen.slice(0, 4)), ['laeuft', 'pause', 'laeuft', 'bereit']);
});

test('4 · Ablauf: Wechsel der Simulation hält die alte an', () => {
  const R = fakeRaf(), uhr = PL.uhr(R.raf, R.caf);
  let a = 0, b = 0;
  const A = PL.lauf(uhr, { schritt: dt => { a += dt; return false; }, zeichne() {}, zuruecksetzen() {} });
  const B = PL.lauf(uhr, { schritt: dt => { b += dt; return false; }, zeichne() {}, zuruecksetzen() {} });
  A.start(); R.bild(0); R.bild(16);
  B.start();
  assert.equal(A.zustand, 'pause', 'A verliert die Schleife und gilt als pausiert');
  assert.equal(R.anzahl, 1);
  R.bild(32); R.bild(48);
  nahe(a, 0.016, 1e-9, 'A rechnet nicht weiter'); nahe(b, 0.016, 1e-9, 'B läuft');
  uhr.aus();
  assert.equal(R.anzahl, 0, 'Übersicht: alles angehalten');
});

test('5 · Freier Fall: Bewegungsgleichungen, Aufprall, Grenzfälle', () => {
  const F = PL.fall;
  nahe(F.aufprallZeit(20, 0, 9.81), Math.sqrt(40 / 9.81), 1e-12, 't = √(2h/g)');
  nahe(F.aufprallZeit(0, 10, 9.81), 20 / 9.81, 1e-12, 'senkrechter Wurf vom Boden');
  assert.equal(F.aufprallZeit(0, 0, 9.81), 0);
  const p = F.param({ h0: 20, v0: 5, g: 9.81 });
  const w = F.ideal(p, 1);
  nahe(w.h, 20 + 5 - 4.905, 1e-12, 'h(1 s)'); nahe(w.v, 5 - 9.81, 1e-12, 'v(1 s)'); assert.equal(w.a, -9.81);
  nahe(F.strecke(20, 5, 9.81, 1), 2 * (25 / 19.62) - (20 + 5 - 4.905 - 20), 1e-9, 'Weg mit Umkehrpunkt');
  // Simulation mit unregelmäßigen Bildern trifft den Aufprall exakt und fällt nie unter den Boden
  const z = F.neu(p); let n = 0;
  while (!F.schritt(z, p, 0.037) && n++ < 1000) assert.ok(z.h >= 0);
  nahe(z.t, F.aufprallZeit(20, 5, 9.81), 1e-12, 'Aufprallzeit');
  assert.equal(z.h, 0);
  nahe(z.v, -Math.sqrt(25 + 2 * 9.81 * 20), 1e-9, 'Aufprallgeschwindigkeit');
  nahe(z.hMax, F.maxHoehe(20, 5, 9.81), 1e-2, 'höchster Punkt');
  nahe(z.s, (F.maxHoehe(20, 5, 9.81) - 20) * 2 + 20, 1e-9, 'gesamter Weg');
  assert.equal(F.schritt(z, p, 1), true, 'nach dem Aufprall bleibt der Körper liegen');
  assert.equal(z.h, 0);
  const amBoden = F.neu({ h0: 0, v0: 0 });
  assert.equal(amBoden.gelandet, true, 'h₀ = 0 und v₀ = 0: kein Fall');
});

test('6 · Freier Fall mit Luftwiderstand: Numerik gegen die exakte Lösung', () => {
  const F = PL.fall;
  const p = F.param({ h0: 500, v0: 0, g: 9.81, luft: true, m: 0.5, cw: 0.47, A: 0.05 });
  const vt = F.grenzgeschwindigkeit(p);
  nahe(vt, Math.sqrt(9.81 * 0.5 / (0.5 * 1.2 * 0.47 * 0.05)), 1e-12, 'Grenzgeschwindigkeit');
  const z = F.neu(p);
  for (let i = 0; i < 60; i++) F.schritt(z, p, 1 / 60);
  // Fall aus der Ruhe: v(t) = −v_t · tanh(g·t / v_t),  h₀ − h(t) = v_t² / g · ln cosh(g·t / v_t)
  nahe(z.v, -vt * Math.tanh(9.81 / vt), 1e-6, 'v(1 s)');
  nahe(500 - z.h, vt * vt / 9.81 * Math.log(Math.cosh(9.81 / vt)), 1e-6, 'Fallstrecke nach 1 s');
  while (!F.schritt(z, p, 0.05));
  assert.equal(z.h, 0);
  assert.ok(Math.abs(z.v) < vt && Math.abs(z.v) > 0.99 * vt, 'Aufprall knapp unter der Grenzgeschwindigkeit');
  assert.ok(z.t > F.aufprallZeit(500, 0, 9.81), 'mit Luftwiderstand dauert der Fall länger');
  const ohne = F.param({ h0: 20, luft: false });
  assert.equal(F.grenzgeschwindigkeit(ohne), Infinity);
  // Mit Luftwiderstand, aber winziger Fläche: fast wie ideal
  const fast = F.param({ h0: 20, luft: true, m: 10, cw: 0.1, A: 0.0001 }), zf = F.neu(fast);
  while (!F.schritt(zf, fast, 0.02));
  nahe(zf.t, Math.sqrt(40 / 9.81), 1e-3, 'kaum Luftwiderstand');
});

test('7 · Wurf: Flugzeit, Wurfweite, Gipfel, bester Winkel, waagerechter Wurf', () => {
  const W = PL.wurf;
  const p = { v0: 15, winkel: 45, h0: 0, g: 9.81 };
  nahe(W.wurfweite(p), 225 / 9.81, 1e-9, 'w = v₀² sin 2α / g');
  nahe(W.maxHoehe(p), 225 * 0.5 / (2 * 9.81), 1e-9, 'Gipfelhöhe');
  nahe(W.flugzeit(p), 2 * 15 * Math.SQRT1_2 / 9.81, 1e-9, 'Flugzeit');
  nahe(W.wurfweite({ ...p, winkel: 30 }), W.wurfweite({ ...p, winkel: 60 }), 1e-9, '30° und 60° gleich weit');
  // bester Winkel: 45° bei h₀ = 0; numerisch gesucht bei h₀ > 0
  nahe(W.besterWinkel(15, 0, 9.81), 45, 1e-9, '45°');
  let best = 0, bw = 0;
  for (let a = 0; a <= 90; a += 0.01) { const w = W.wurfweite({ v0: 10, winkel: a, h0: 5, g: 9.81 }); if (w > bw) { bw = w; best = a; } }
  nahe(W.besterWinkel(10, 5, 9.81), best, 0.02, 'bester Winkel bei Abwurfhöhe');
  assert.ok(best < 45);
  // waagerechter Wurf: Flugzeit unabhängig von v₀
  nahe(W.flugzeit({ v0: 4, winkel: 0, h0: 5, g: 9.81 }), Math.sqrt(10 / 9.81), 1e-12, 'Fallzeit');
  nahe(W.flugzeit({ v0: 8, winkel: 0, h0: 5, g: 9.81 }), W.flugzeit({ v0: 4, winkel: 0, h0: 5, g: 9.81 }), 1e-12, 'unabhängig von v₀');
  nahe(W.wurfweite({ v0: 8, winkel: 0, h0: 5, g: 9.81 }), 2 * W.wurfweite({ v0: 4, winkel: 0, h0: 5, g: 9.81 }), 1e-12, 'Weite doppelt');
  // Grenzfälle
  assert.equal(W.flugzeit({ v0: 0, winkel: 45, h0: 0 }), 0);
  nahe(W.flugzeit({ v0: 0, winkel: 45, h0: 20, g: 9.81 }), Math.sqrt(40 / 9.81), 1e-12, 'v₀ = 0: freier Fall');
  assert.equal(W.wurfweite({ v0: 0, winkel: 45, h0: 20 }), 0);
  // Simulation landet genau auf dem Boden
  const q = { v0: 12, winkel: 40, h0: 1.5, g: 9.81 }, z = W.neu(q);
  let n = 0; while (!W.schritt(z, q, 0.033) && n++ < 1000) assert.ok(z.y >= 0);
  nahe(z.x, W.wurfweite(q), 1e-9, 'Landepunkt'); assert.equal(z.y, 0);
  nahe(z.vx, 12 * Math.cos(40 * Math.PI / 180), 1e-12, 'vₓ bleibt konstant');
  nahe(z.yMax, W.maxHoehe(q), 0.01, 'Gipfel gemessen');
  const b = W.bahn(q, 50);
  assert.equal(b.length, 51); assert.equal(b[0].y, 1.5); nahe(b[50].x, W.wurfweite(q), 1e-9, 'Bahnende');
});

test('8 · Reibung: Haften bis μ_H·F_N, dann Gleiten mit μ_G·F_N, Anhalten ohne Umkehr', () => {
  const R = PL.reibung;
  const p = { m: 5, F: 24, muH: 0.5, muG: 0.3, g: 9.81 };
  nahe(R.haftGrenze(p), 24.525, 1e-9, 'F_H,max');
  const z = R.neu();
  R.schritt(z, p, 2);
  assert.equal(z.x, 0, 'zu kleine Kraft: der Körper bleibt liegen');
  const k = R.kraefte(z, p);
  assert.equal(k.haftet, true); assert.equal(k.FR, -24); assert.equal(k.Fres, 0); nahe(k.FN, 49.05, 1e-9, 'Normalkraft');
  // knapp über der Grenze: gleitet mit a = (F − μ_G m g)/m
  const p2 = { ...p, F: 25 };
  R.schritt(z, p2, 1);
  nahe(z.v, (25 - 0.3 * 49.05) / 5, 1e-9, 'v nach 1 s');
  nahe(z.x, 0.5 * (25 - 0.3 * 49.05) / 5, 1e-9, 'x nach 1 s');
  // konstante Geschwindigkeit bei F = μ_G·F_N
  const v1 = z.v; R.schritt(z, { ...p, F: 0.3 * 49.05 }, 1);
  nahe(z.v, v1, 1e-9, 'F = F_Gleit: v konstant');
  // Kraft weg: bremst bis zum Stillstand und bleibt dann liegen (keine Rückwärtsbewegung)
  const vor = z.x;
  R.schritt(z, { ...p, F: 0 }, 10);
  assert.equal(z.v, 0);
  const brems = v1 * v1 / (2 * 0.3 * 9.81);
  nahe(z.x - vor, brems, 1e-9, 'Bremsweg v²/(2 μ_G g)');
  // Gleitreibung wird nie größer als die Haftreibung
  assert.equal(R.param({ muH: 0.2, muG: 0.4 }).muG, 0.2);
  // sehr kleine Masse, große Kraft: bleibt endlich
  const klein = { m: 0.1, F: 200, muH: 0.5, muG: 0.3, g: 9.81 }, zk = R.neu();
  R.schritt(zk, klein, 0.1);
  nahe(zk.v, (200 - 0.3 * 0.981) / 0.1 * 0.1, 1e-9, 'sehr kleine Masse');
  // ohne Reibung (μ = 0): jede Kraft beschleunigt
  const glatt = R.neu(); R.schritt(glatt, { m: 2, F: 1, muH: 0, muG: 0 }, 1);
  nahe(glatt.v, 0.5, 1e-12, 'reibungsfrei');
});

test('9 · Federpendel: Periodendauer, Numerik, Energie, Dämpfung', () => {
  const FE = PL.feder;
  const p = { m: 0.5, D: 20, b: 0, y0: -0.1 };
  nahe(FE.periodeUngedaempft(p), 2 * Math.PI * Math.sqrt(0.025), 1e-12, 'T = 2π√(m/D)');
  nahe(FE.periodeUngedaempft({ m: 1, D: 20 }) / FE.periodeUngedaempft(p), Math.SQRT2, 1e-12, 'doppelte Masse → √2');
  nahe(FE.ruhelageDehnung(p), 0.5 * 9.81 / 20, 1e-12, 'Dehnung in der Ruhelage');
  const z = FE.neu(p), e0 = FE.energie(z, FE.param(p)).ges;
  for (let i = 0; i < 300; i++) FE.schritt(z, p, 1 / 60);       // 5 s mit 60 Bildern pro Sekunde
  nahe(z.y, FE.analytisch(p, 5), 1e-6, 'Auslenkung nach 5 s');
  nahe(FE.energie(z, FE.param(p)).ges, e0, 1e-8, 'ohne Dämpfung bleibt die Energie erhalten');
  nahe(z.periodeGemessen, FE.periodeUngedaempft(p), 1e-4, 'gemessene Periodendauer');
  // gedämpft: gegen die exakte Lösung, Energie nimmt ab
  const q = { m: 0.5, D: 20, b: 0.4, y0: -0.15 }, zq = FE.neu(q);
  for (let i = 0; i < 240; i++) FE.schritt(zq, q, 1 / 60);
  nahe(zq.y, FE.analytisch(q, 4), 1e-6, 'gedämpfte Auslenkung nach 4 s');
  assert.ok(FE.energie(zq, FE.param(q)).ges < zq.eStart * 0.3, 'Energie nimmt ab');
  nahe(zq.periodeGemessen, FE.periode(q), 1e-3, 'gedämpfte Periodendauer');
  assert.ok(FE.periode(q) > FE.periodeUngedaempft(q));
  // Kriechfall
  assert.equal(FE.periode({ m: 0.5, D: 20, b: 10 }), null);
  assert.equal(FE.art({ m: 0.5, D: 20, b: 10 }), 'kriechfall');
  assert.equal(FE.art({ m: 0.5, D: 20, b: 2 * Math.sqrt(20 * 0.5) }), 'grenzfall');
  // sehr kleine Masse, harte Feder: stabil
  const h = { m: 0.05, D: 200, b: 0, y0: 0.2 }, zh = FE.neu(h);
  for (let i = 0; i < 600; i++) FE.schritt(zh, h, 1 / 60);
  nahe(FE.energie(zh, FE.param(h)).ges, zh.eStart, 1e-5, 'kleine Masse: Energie stabil');
  nahe(zh.y, FE.analytisch(h, 10), 1e-4, 'kleine Masse: Auslenkung');
  // Parameterwechsel mitten in der Schwingung
  FE.parameterGeaendert(zh, { ...h, m: 1 });
  assert.equal(zh.periodeGemessen, null);
});

test('10 · Optik: Linsengleichung, Hauptstrahlen schneiden sich im Bild', () => {
  const O = PL.optik;
  const bild = O.abbildung(10, 20, 3);
  assert.equal(bild.b, 20); assert.equal(bild.A, -1); assert.equal(bild.reell, true);
  nahe(O.abbildung(10, 30, 2).b, 15, 1e-12, 'g = 3f');
  const lupe = O.abbildung(10, 6, 2);
  assert.equal(lupe.virtuell, true); assert.equal(lupe.aufrecht, true); nahe(lupe.b, -15, 1e-12, 'Lupe'); nahe(lupe.A, 2.5, 1e-12, 'vergrößert');
  assert.equal(O.abbildung(10, 10, 2).unendlich, true, 'g = f: Bild im Unendlichen');
  const zer = O.abbildung(-10, 20, 3);
  assert.equal(zer.virtuell, true); assert.ok(zer.A > 0 && zer.A < 1, 'Zerstreuungslinse: verkleinert, aufrecht');

  // Schnittpunkt zweier Geraden (Strahlen oder ihre Verlängerungen)
  const schnitt = (s, t) => {
    const [a, b] = [s, t].map(q => ({ x: q.x1, y: q.y1, dx: q.x2 - q.x1, dy: q.y2 - q.y1 }));
    const n = a.dx * b.dy - a.dy * b.dx, u = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / n;
    return { x: a.x + u * a.dx, y: a.y + u * a.dy };
  };
  for (const [f, g, G] of [[10, 25, 3], [10, 15, 2], [8, 5, 2], [-10, 20, 3], [-6, 4, 2], [15, 40, -2]]) {
    const b = O.abbildung(f, g, G), S = O.hauptstrahlen(f, g, G, 200);
    assert.equal(S.length, 3);
    // Für jedes Paar Hauptstrahlen: auslaufende Strahlen (reell) bzw. ihre Verlängerungen (virtuell) treffen sich im Bildpunkt
    // reell: der auslaufende Strahl; virtuell: seine Verlängerung nach hinten (der Mittelpunktstrahl ist ein einziges Stück)
    const linie = s => (b.virtuell && s.teile.find(t => t.art === 'verlaengert' && t.x1 === 0 && Math.abs(t.x2 - b.b) < 1e-9))
      || s.teile.find(t => t.x1 === 0 && t.art === 'echt') || s.teile[0];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const p = schnitt(linie(S[i]), linie(S[j]));
      nahe(p.x, b.b, 1e-6, `f=${f} g=${g}: x des Bildpunkts (${S[i].name}/${S[j].name})`);
      nahe(p.y, b.B, 1e-6, `f=${f} g=${g}: y des Bildpunkts`);
    }
    // Brennpunkt-Regeln: Sammellinse: Parallelstrahl geht danach durch F' (f | 0)
    const aus = S[0].teile[1];
    const yBeiF = aus.y1 + (aus.y2 - aus.y1) * (f - aus.x1) / (aus.x2 - aus.x1);
    nahe(yBeiF, 0, 1e-9, `Parallelstrahl ${f > 0 ? 'durch' : 'scheinbar von'} F'`);
    // beliebige Strahlen treffen ebenfalls den Bildpunkt
    for (const yL of [-3, 0.5, 4]) {
      const s = O.strahlDurch(f, g, G, yL, 200), aus2 = s.teile[1];
      const yb = aus2.y1 + (aus2.y2 - aus2.y1) * (b.b - aus2.x1) / (aus2.x2 - aus2.x1);
      nahe(yb, b.B, 1e-9, `Strahl durch y = ${yL}`);
    }
  }
  assert.equal(O.hauptstrahlen(10, 10, 2, 100).length, 2, 'g = f: kein Brennpunktstrahl');
});

test('11 · Optik: ebener Spiegel und Strahlverfolgung (Reflexionsgesetz)', () => {
  const O = PL.optik;
  assert.deepEqual(plain(O.spiegelbild(15, 3)), { b: -15, B: 3, A: 1, virtuell: true, reell: false, aufrecht: true });
  for (const s of O.spiegelStrahlen(15, 3, [-2, 1, 4], -40)) {
    const v = s.teile[2];
    assert.equal(v.x2, 15); assert.equal(v.y2, 3);
    const ein = s.teile[0], aus = s.teile[1];
    // Einfallswinkel = Reflexionswinkel zum Lot (waagerecht)
    nahe(Math.abs(Math.atan2(ein.y2 - ein.y1, ein.x2 - ein.x1)), Math.PI - Math.abs(Math.atan2(aus.y2 - aus.y1, aus.x2 - aus.x1)), 1e-9, 'Winkel');
  }
  // Strahl trifft einen 45°-Spiegel und wird um 90° umgelenkt
  const r = O.verfolge(0, 0, 0, [{ x: 10, y: 0, laenge: 4, winkel: 45 }], 5, 100);
  assert.equal(r.reflexionen.length, 1);
  nahe(r.reflexionen[0].einfall, 45, 1e-9, 'Einfallswinkel');
  const ende = r.punkte[2];
  nahe(ende.x, 10, 1e-9, 'senkrecht umgelenkt'); assert.ok(ende.y > 50);
  // Winkelspiegel (zwei Spiegel unter 90°) schickt den Strahl parallel zurück
  const w = O.verfolge(0, 1, 0, [{ x: 10, y: 0, laenge: 6, winkel: 45 }, { x: 10, y: 6, laenge: 6, winkel: -45 }], 5, 100);
  assert.equal(w.reflexionen.length, 2);
  const a = w.punkte[w.punkte.length - 2], e = w.punkte[w.punkte.length - 1];
  nahe(e.y - a.y, 0, 1e-9, 'parallel zurück'); assert.ok(e.x < a.x);
  // verfehlt der Strahl alle Spiegel, läuft er geradeaus
  const m = O.verfolge(0, 0, 90, [{ x: 10, y: 0, laenge: 4, winkel: 45 }], 5, 50);
  assert.equal(m.reflexionen.length, 0); nahe(m.punkte[1].y, 50, 1e-9, 'geradeaus');
});

test('12 · Lernmodus: jede Aufgabe ist vollständig, Lösungen stimmen mit den Rechenmodulen', () => {
  const A = PL.aufgaben, ids = new Set();
  assert.deepEqual(Object.keys(A).sort(), ['fall', 'feder', 'optik', 'reibung', 'wurf']);
  for (const [modul, liste] of Object.entries(A)) {
    assert.ok(liste.length >= 3, `${modul}: mindestens drei Aufgaben`);
    for (const a of liste) {
      assert.ok(!ids.has(a.id), `doppelte ID ${a.id}`); ids.add(a.id);
      for (const k of ['titel', 'frage', 'auftrag', 'erklaerung']) assert.ok(a[k] && a[k].length > 10, `${a.id}.${k}`);
      assert.ok(a.hinweise.length >= 1, `${a.id}: Hinweise`);
      assert.ok(['zahl', 'wahl'].includes(a.vermutung.art));
      assert.ok(a.einstellen && typeof a.einstellen === 'object');
      if (a.pruefen.art === 'zahl') {
        assert.ok(Number.isFinite(a.pruefen.loesung) && a.pruefen.toleranz > 0 && typeof a.pruefen.einheit === 'string', a.id);
      } else {
        assert.equal(a.pruefen.optionen.filter(o => o.ok).length, 1, `${a.id}: genau eine richtige Wahl`);
        for (const o of a.pruefen.optionen) assert.ok(o.fb, `${a.id}: Rückmeldung zu „${o.text}“`);
      }
    }
  }
  const by = id => Object.values(A).flat().find(a => a.id === id);
  nahe(by('fall-20m').pruefen.loesung, 2.02, 1e-9, '20 m');
  nahe(by('wurf-weite').pruefen.loesung, PL.wurf.wurfweite({ v0: 12, winkel: 40, h0: 1.5, g: 9.81 }), 0.05, 'Wurfweite');
  nahe(by('reibung-haft').pruefen.loesung, 24.5, 1e-9, 'Haftreibung');
  nahe(by('reibung-gleit').pruefen.loesung, 14.7, 1e-9, 'Gleitreibung');
  nahe(by('feder-periode').pruefen.loesung, 1.03, 1e-9, 'Periodendauer');
  assert.equal(by('optik-2f').pruefen.loesung, 20);
  assert.equal(by('optik-spiegel').pruefen.loesung, 15);
  // Die Zahlenlösung muss sich mit der Toleranz als „richtig“ werten lassen
  for (const a of Object.values(A).flat()) if (a.pruefen.art === 'zahl') {
    assert.equal(PL.eingabe.antwort(String(a.pruefen.loesung).replace('.', ','), a.pruefen.loesung, a.pruefen.toleranz), 'richtig', a.id);
  }
});

test('13 · Verzeichnis und Suche', () => {
  const K = PL.katalog;
  assert.deepEqual(plain(K.SIMULATIONEN.map(s => s.id)), ['fall', 'wurf', 'reibung', 'feder', 'optik']);
  assert.deepEqual(plain(K.filtere('', '').map(s => s.id)).length, 5);
  assert.deepEqual(plain(K.filtere('', 'bewegung').map(s => s.id)), ['fall', 'wurf']);
  assert.deepEqual(plain(K.filtere('Dämpfung', '').map(s => s.id)), ['feder']);
  assert.deepEqual(plain(K.filtere('daempfung', '').map(s => s.id)), ['feder'], 'Umlaute egal');
  assert.deepEqual(plain(K.filtere('linse brennweite', '').map(s => s.id)), ['optik']);
  assert.deepEqual(plain(K.filtere('linse', 'kraefte')), []);
  for (const s of K.SIMULATIONEN) assert.ok(K.BEREICHE.some(b => b.id === s.bereich) && s.bezug, s.id);
});

test('14 · Lektion: Einbindung, Dateien, Regeln der Lernseite', () => {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/static\/lesson-kit\.css">/);
  assert.match(html, /<script src="\.\.\/\.\.\/static\/lesson-kit\.js"><\/script>/);
  const skripte = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(s => !s.includes('static/'));
  for (const s of skripte) {
    assert.match(s, /^[a-z0-9-]+\.js$/, `einfacher Dateiname (wird von der Testseite eingebettet): ${s}`);
    assert.ok(fs.existsSync(path.join(DIR, s)), s);
  }
  for (const f of DATEIEN) assert.ok(skripte.includes(f), `${f} eingebunden`);
  assert.ok(skripte.indexOf('kern.js') < skripte.indexOf('aufgaben.js') && skripte.indexOf('optik.js') < skripte.indexOf('aufgaben.js'), 'Reihenfolge');
  assert.doesNotMatch(html, /https?:\/\//, 'keine externen Ressourcen');
  const lesson = JSON.parse(fs.readFileSync(path.join(DIR, 'lesson.json'), 'utf8'));
  assert.equal(lesson.subject, 'Physik');
  const alles = fs.readdirSync(DIR).filter(f => /\.(js|css|html)$/.test(f)).map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
  assert.doesNotMatch(alles, /\d+(\.\d+)?vh\b/, 'keine vh-Einheiten');
  assert.doesNotMatch(alles, /localStorage|sessionStorage/, 'keine Speicherung im Browser');
  for (const m of alles.matchAll(/<button(?![^>]*type=)[^>]*>/g)) assert.fail(`Button ohne type: ${m[0]}`);
  const sb = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/sandbox/stufen.json'), 'utf8'));
  const sim = sb.simulationen.find(s => s.lesson === 'sandbox-physik');
  assert.ok(sim, 'in der Sandbox eingetragen');
  const views = fs.readFileSync(path.join(ROOT, 'src/views-fach.js'), 'utf8');
  assert.match(views, new RegExp(`\\n  ${sim.icon}: \``), 'Symbol vorhanden');
});
