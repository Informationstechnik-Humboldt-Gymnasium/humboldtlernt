// Tests für das Fach Politik: Rechenmodelle der interaktiven Erklärungen (Bundestag, Wahlsystem, Gesetzgebung, Markt)
// und Übereinstimmung von Übungslösungen mit diesen Modellen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = path.join(ROOT, 'lessons');
function lade(...dateien) {
  const ctx = vm.createContext({});
  for (const f of dateien) vm.runInContext(fs.readFileSync(path.join(L, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
const plain = x => JSON.parse(JSON.stringify(x));
const { BT } = lade('pb-bundestag-3d/bundestag.js');
const { WS } = lade('pb-wahlsystem/wahl.js');
const { GG } = lade('pb-gesetzgebung/gesetz.js');
const { MK } = lade('pb-markt/markt.js');

/** Alle Übungen des Fachs Politik nach ID. */
const uebungen = new Map();
(function sammle(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sammle(p);
    else if (e.name.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(p, 'utf8')); for (const u of d.uebungen || []) uebungen.set(u.id, u); }
  }
})(path.join(ROOT, 'content/politik'));

test('1 · Bundestag: 630 Sitze nach der Wahl 2025, Kanzler- und Zweidrittelmehrheit', () => {
  assert.equal(BT.daten.GESAMT, 630);
  const sitze = Object.fromEntries(BT.daten.FRAKTIONEN.map(f => [f.id, f.sitze]));
  assert.deepEqual(plain(sitze), { linke: 64, spd: 120, gruene: 85, union: 208, afd: 152, ssw: 1 });
  assert.deepEqual(plain(BT.schwellen()), { kanzler: 316, zweidrittel: 420 });
  assert.equal(BT.bewerte(['union', 'spd']).sitze, 328);
  assert.equal(BT.bewerte(['union', 'spd']).kanzler, true);
  assert.equal(BT.bewerte(['union']).fehlenKanzler, 108);
  assert.equal(BT.bewerte([]).sitze, 0);
  assert.equal(BT.bewerte(['gibtsnicht']).sitze, 0);
});

test('2 · Bundestag: Kein Zweierbündnis erreicht rechnerisch die Zweidrittelmehrheit (Aufgabe im Modell)', () => {
  const zweier = BT.kombinationen(2);
  assert.equal(zweier.length, 10, '5 Fraktionen → 10 Paare');
  assert.equal(Math.max(...zweier.map(k => k.sitze)), 360);
  assert.ok(zweier.every(k => k.sitze < 420));
  assert.ok(BT.kombinationen(3).some(k => k.sitze >= 420), 'mit drei Fraktionen ist es rechnerisch möglich');
});

test('3 · Sitzplan: jede Fraktion mit ihrer Sitzzahl, Keile von links (Präsidium) nach rechts, keine Überlappung', () => {
  const plan = BT.sitzplan();
  assert.equal(plan.sitze.length, 630);
  const zahl = {};
  for (const s of plan.sitze) zahl[s.fraktion] = (zahl[s.fraktion] || 0) + 1;
  for (const f of BT.daten.FRAKTIONEN) assert.equal(zahl[f.id], f.sitze, f.id);
  // Mittlere Winkel: Linke < SPD < Grüne < CDU/CSU < AfD (kleiner Winkel = links aus Sicht des Präsidiums, +x)
  const mittel = id => { const w = plan.sitze.filter(s => s.fraktion === id).map(s => s.winkel); return w.reduce((a, b) => a + b, 0) / w.length; };
  const reihe = ['linke', 'spd', 'gruene', 'union', 'afd'].map(mittel);
  for (let i = 1; i < reihe.length; i++) assert.ok(reihe[i] > reihe[i - 1], 'Reihenfolge der Keile');
  assert.ok(plan.sitze.filter(s => s.fraktion === 'linke').every(s => s.x > -6), 'Linke auf der linken Seite (+x)');
  for (let i = 0; i < plan.sitze.length; i++) for (let j = i + 1; j < plan.sitze.length; j++) {
    const a = plan.sitze[i], b = plan.sitze[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.5, 'Sitze überlappen nicht');
  }
});

test('4 · Wahlsystem: Sainte-Laguë, Hürde, Grundmandatsklausel, Minderheitenpartei', () => {
  assert.deepEqual(plain(WS.saintLague([{ id: 'a', stimmen: 6 }, { id: 'b', stimmen: 3 }, { id: 'c', stimmen: 1 }], 100)), { a: 60, b: 30, c: 10 });
  // Kleines Beispiel, bei dem gerundet werden muss: 7 Sitze, 53 % / 30 % / 17 %
  assert.deepEqual(plain(WS.saintLague([{ id: 'a', stimmen: 53 }, { id: 'b', stimmen: 30 }, { id: 'c', stimmen: 17 }], 7)), { a: 4, b: 2, c: 1 });
  assert.equal(WS.zieht(0.05, 0), true, 'genau 5 % reichen');
  assert.equal(WS.zieht(0.0499, 2), false);
  assert.equal(WS.zieht(0.031, 3), true, 'drei Direktmandate');
  assert.equal(WS.zieht(0.0015, 0, true), true, 'Minderheitenpartei');
  const e = WS.auswerten([{ id: 'a', stimmen: 60 }, { id: 'b', stimmen: 36 }, { id: 'c', stimmen: 4 }], 100);
  assert.equal(e.parteien.find(p => p.id === 'c').sitze, 0);
  assert.equal(e.parteien.reduce((s, p) => s + p.sitze, 0), 100);
  assert.ok(Math.abs(e.verloren - 0.04) < 1e-9);
  assert.ok(e.parteien.find(p => p.id === 'a').sitzanteil > 0.6, 'Sitzanteil größer als Stimmenanteil');
});

test('5 · Wahlsystem: Zweitstimmen 2025 (gerundet) ergeben die tatsächliche Sitzverteilung', () => {
  // Bundesweite Zweitstimmenanteile laut amtlichem Endergebnis, auf zwei Stellen gerundet
  const e = WS.auswerten([
    { id: 'union', stimmen: 28.52 }, { id: 'afd', stimmen: 20.80 }, { id: 'spd', stimmen: 16.41 }, { id: 'gruene', stimmen: 11.61 },
    { id: 'linke', stimmen: 8.77 }, { id: 'ssw', stimmen: 0.15, minderheit: true }, { id: 'bsw', stimmen: 4.98 }, { id: 'fdp', stimmen: 4.33 }, { id: 'andere', stimmen: 4.43 },
  ], 630);
  const sitze = Object.fromEntries(e.parteien.map(p => [p.id, p.sitze]));
  for (const f of BT.daten.FRAKTIONEN) assert.equal(sitze[f.id], f.sitze, f.id);
  assert.equal(sitze.bsw, 0); assert.equal(sitze.fdp, 0);
});

test('6 · Gesetzgebung: alle Wege enden, Einspruch kann überstimmt werden, Zustimmung nicht', () => {
  for (const art of ['einspruch', 'zustimmung']) {
    const s = GG.schritte(art);
    for (const [id, schritt] of Object.entries(s)) {
      if (schritt.ende) continue;
      assert.ok(schritt.wahl.length >= 2, id);
      for (const w of schritt.wahl) assert.ok(s[w.weiter], `${art}: ${id} → ${w.weiter}`);
    }
    // Jeder Weg endet nach höchstens 8 Schritten in „inkraft“ oder „gescheitert“
    (function lauf(z, tiefe) {
      assert.ok(tiefe < 8, 'endlich');
      const sch = s[z.schritt];
      if (sch.ende) { assert.ok(['inkraft', 'gescheitert'].includes(sch.ende)); return; }
      for (const w of sch.wahl) lauf(GG.waehle(z, w.id), tiefe + 1);
    })(GG.neu(art), 0);
  }
  const wege = (art, ...ws) => ws.reduce((z, w) => GG.waehle(z, w), GG.neu(art));
  assert.equal(wege('einspruch', 'beschliessen', 'vermittlung', 'keiner', 'einspruch', 'ueberstimmt', 'unterzeichnen').schritt, 'inkraft');
  assert.equal(wege('zustimmung', 'beschliessen', 'verweigern').schritt, 'gescheitert');
  assert.ok(!GG.schritte('einspruch').bundesrat.wahl.some(w => w.weiter === 'gescheitert'), 'Bundesrat allein kann ein Einspruchsgesetz nicht stoppen');
  assert.equal(GG.waehle(GG.neu('einspruch'), 'gibtsnicht'), null);
});

test('7 · Markt: Gleichgewicht, Überhänge und Anpassung zum Gleichgewicht', () => {
  const m = { ...MK.STANDARD };
  assert.deepEqual(plain(MK.gleichgewicht(m)), { preis: 10, menge: 60 });
  assert.equal(MK.lage(m, 7).art, 'nachfrageueberhang');
  assert.equal(MK.lage(m, 7).ueberhang, 30);
  assert.equal(MK.lage(m, 13).art, 'angebotsueberhang');
  assert.equal(MK.lage(m, 10).art, 'gleichgewicht');
  // Hitzewelle (+30 Nachfrage) → höherer Preis; teurere Milch (−30 Angebot) → höherer Preis
  assert.ok(MK.gleichgewicht({ ...m, dN: 30 }).preis > 10);
  assert.ok(MK.gleichgewicht({ ...m, dA: -30 }).preis > 10);
  let p = 3;
  for (let i = 0; i < 400; i++) p = MK.schritt(m, p, 0.015);
  assert.ok(Math.abs(p - 10) < 0.01, 'Preis pendelt sich ein');
});

test('8 · Übungslösungen passen zu den Modellen und Daten', () => {
  assert.equal(uebungen.get('pb-btg-02').loesung, BT.schwellen().kanzler);
  assert.equal(uebungen.get('pb-btg-03').loesung, BT.schwellen().zweidrittel);
  assert.equal(uebungen.get('pb-btg-04').loesung, BT.bewerte(['union', 'spd']).sitze);
  assert.equal(uebungen.get('pb-mkt-04').loesung, MK.gleichgewicht(MK.STANDARD).preis);
  assert.equal(uebungen.get('pb-mkt-05').loesung, MK.lage(MK.STANDARD, 7).ueberhang);
  const whl = WS.auswerten([{ id: 'a', stimmen: 6 }, { id: 'b', stimmen: 3 }, { id: 'c', stimmen: 1 }], 100);
  assert.equal(uebungen.get('pb-whl-04').loesung, whl.parteien.find(p => p.id === 'b').sitze);
  // Bundesrat: 4 Länder mit 6, 1 mit 5, 7 mit 4, 4 mit 3 Stimmen
  assert.equal(uebungen.get('pb-ges-02').loesung, 4 * 6 + 5 + 7 * 4 + 4 * 3);
  assert.equal(uebungen.get('pb-ges-03').loesung, Math.floor(69 / 2) + 1);
  assert.equal(uebungen.size, 21 * 7);
});

test('9 · Lektionen: lokal, mit Etikett „Modell“, 4–6 Aufgaben, Three.js nur aus dem Chemielabor', () => {
  for (const slug of ['pb-bundestag-3d', 'pb-wahlsystem', 'pb-gesetzgebung', 'pb-markt']) {
    const html = fs.readFileSync(path.join(L, slug, 'index.html'), 'utf8');
    const meta = JSON.parse(fs.readFileSync(path.join(L, slug, 'lesson.json'), 'utf8'));
    assert.equal(meta.subject, 'Politik', slug);
    assert.ok(!/(src|href)="https?:/.test(html), `${slug}: keine fremden Server`);
    const n = (html.match(/class="task"/g) || []).length;
    assert.ok(n >= 4 && n <= 6, `${slug}: ${n} Aufgaben`);
    assert.match(html, /\[data-task-count\]|data-task-count/);
    assert.ok(/Modell|Schema/.test(html), `${slug}: als Modell oder Schema gekennzeichnet`);
    for (const m of html.matchAll(/<button(?![^>]*type="button")/g)) assert.fail(`${slug}: Button ohne type="button" bei ${m.index}`);
  }
  const bt = fs.readFileSync(path.join(L, 'pb-bundestag-3d/index.html'), 'utf8');
  assert.match(bt, /<script src="\.\.\/sandbox-chemielabor\/three\.js"><\/script>/);
  assert.ok(!fs.existsSync(path.join(L, 'pb-bundestag-3d/three.js')), 'keine zweite Kopie von Three.js');
});
