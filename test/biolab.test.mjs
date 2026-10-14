// Tests für das BioLab (Fach Sandbox): Optik des virtuellen Mikroskops, Osmose- und Diffusionsmodell,
// Basenpaarung und Kreuzungsschemata sowie die Vollständigkeit der Inhaltsdaten.
// Die Dateien laufen wie im Browser (ohne DOM) in einer VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lessons/sandbox-biolab');
const DATEIEN = ['daten-mikroskopie.js', 'daten-organismen.js', 'daten-viren.js', 'daten-zelle.js', 'daten-anatomie.js', 'daten-genetik.js', 'optik.js', 'osmose.js', 'genetik.js'];
const ctx = vm.createContext({});
for (const f of DATEIEN) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const BL = ctx.BL;
const nahe = (ist, soll, tol, text) => assert.ok(Math.abs(ist - soll) <= tol, `${text}: ${ist} statt ${soll}`);
const plain = x => JSON.parse(JSON.stringify(x));

test('1 · Mikroskop: Vergrößerung, Sehfeld, Auflösung', () => {
  const O = BL.optik;
  assert.deepEqual(plain(O.OBJEKTIVE.map(o => o.v)), [4, 10, 40, 100]);
  assert.equal(O.gesamt(40), 400);
  nahe(O.sehfeld(4), 4500, 1e-9, 'Sehfeld 4× (18 mm / 4)');
  nahe(O.sehfeld(40), 450, 1e-9, 'Sehfeld 40×');
  nahe(O.aufloesung(100), 0.61 * 0.55 / 1.25, 1e-12, 'Auflösung Ölimmersion');
  assert.ok(O.aufloesung(4) > O.aufloesung(10) && O.aufloesung(10) > O.aufloesung(40), 'stärkeres Objektiv löst feiner auf');
  assert.ok(O.schaerfentiefe(4) > O.schaerfentiefe(40), 'Schärfentiefe nimmt mit der Vergrößerung ab');
  // Bakterien (≈ 2 µm) erst mit dem Ölobjektiv, Zwiebelzellen (≈ 200 µm) schon bei 40×
  assert.equal(O.erkennbarAb(2, 520), 1000);
  assert.equal(O.erkennbarAb(200, 520), 40);
  assert.equal(O.erkennbar(0.2, 100, 520), false, 'unterhalb der Auflösungsgrenze nie erkennbar');
  assert.equal(O.unschaerfePx(0, 40), 0);
  assert.ok(O.unschaerfePx(20, 40) > O.unschaerfePx(5, 40));
  const m = O.massstab(0.5, 60);
  assert.ok(m.px >= 60 && m.um === 200, 'Maßstabsbalken mit runder Länge');
});

test('2 · Osmose: Gleichgewichte von Pflanzenzelle und rotem Blutkörperchen', () => {
  const O = BL.osmose;
  nahe(O.gleichgewicht('blut', 2), 0.5, 1e-12, 'Blut in doppelt konzentrierter Lösung');
  nahe(O.gleichgewicht('blut', 1), 1, 1e-12, 'isotonisch');
  assert.equal(O.gleichgewicht('blut', 0), Infinity);
  const v = O.gleichgewicht('pflanze', 0);
  assert.ok(v > 1 && v < 1.2, `Pflanzenzelle in Wasser nur wenig größer (Turgor): ${v}`);
  // Zeitentwicklung nähert sich dem Gleichgewicht
  const z = O.neu('blut', 2); O.schritt(z, 30);
  nahe(z.V, 0.5, 0.01, 'Blut schrumpft');
  const p = O.neu('pflanze', 0); O.schritt(p, 30);
  nahe(p.V, v, 0.01, 'Pflanzenzelle');
  assert.ok(O.druck(p) > 0, 'Wanddruck');
  const b = O.neu('blut', 0); O.schritt(b, 30);
  assert.equal(b.geplatzt, true, 'Blutkörperchen in reinem Wasser platzt');
  assert.match(O.zustandText(b), /Hämolyse/);
  const pl = O.neu('pflanze', 2); O.schritt(pl, 30);
  assert.match(O.zustandText(pl), /Plasmolyse/);
});

test('3 · Diffusion: Teilchen verteilen sich, eine dichte Wand hält sie zurück', () => {
  const D = BL.diffusion;
  const offen = D.neu(200, 7), dicht = D.neu(200, 7);
  assert.equal(D.anteilLinks(offen), 1, 'Start: alle links');
  for (let i = 0; i < 400; i++) { D.schritt(offen, 0.05, 2, true); D.schritt(dicht, 0.05, 2, false); }
  assert.ok(D.anteilLinks(offen) < 0.75, `ohne Wand verteilt: ${D.anteilLinks(offen)}`);
  assert.equal(D.anteilLinks(dicht), 1, 'dichte Wand');
});

test('4 · DNA: Basenpaarung', () => {
  const G = BL.genetik;
  assert.equal(G.gegenstrang('ATGCGT'), 'TACGCA');
  assert.ok(G.passt('A', 'T') && G.passt('C', 'G') && !G.passt('A', 'G'));
  assert.equal(G.BRUECKEN.A, 2); assert.equal(G.BRUECKEN.G, 3);
  let s = 3; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const z = G.zufallsStrang(50, r);
  assert.match(z, /^[ATGC]{50}$/);
  assert.equal(G.gegenstrang(G.gegenstrang(z)), z);
});

test('5 · Erbgänge: Kreuzungsschemata', () => {
  const G = BL.genetik;
  const v = (id, a, b) => plain(G.verteilung(id, a, b));
  assert.deepEqual(v('dominant', 'Gg', 'Gg').phaenotypen, { gelb: 0.75, grün: 0.25 });
  assert.deepEqual(v('dominant', 'Gg', 'Gg').genotypen, { GG: 0.25, Gg: 0.5, gg: 0.25 });
  assert.deepEqual(v('intermediaer', 'RW', 'RW').phaenotypen, { rot: 0.25, rosa: 0.5, weiß: 0.25 });
  assert.deepEqual(v('ab0', 'A0', 'B0').phaenotypen, { AB: 0.25, A: 0.25, B: 0.25, 0: 0.25 });
  assert.deepEqual(v('ab0', 'AB', '00').phaenotypen, { A: 0.5, B: 0.5 });
  // Überträgerin × normal sehender Vater: Hälfte der Söhne betroffen, keine Tochter
  const x = v('xrezessiv', 'Xx', 'XY').phaenotypen;
  assert.equal(x['Sohn, rot-grün-sehschwach'], 0.25);
  assert.equal(x['Sohn, normal sehend'], 0.25);
  assert.equal(x['Tochter, rot-grün-sehschwach'], undefined);
  assert.equal(x['Tochter, normal sehend (Überträgerin)'], 0.25);
  assert.equal(v('xrezessiv', 'XX', 'xY').phaenotypen['Tochter, normal sehend (Überträgerin)'], 0.5, 'alle Töchter Überträgerinnen');
  // jedes Feld enthält einen bekannten Phänotyp, Genotypen in üblicher Schreibweise
  for (const [id, e] of Object.entries(G.ERBGAENGE)) {
    const m = e.genotypenMutter || e.genotypen, f = e.genotypenVater || e.genotypen;
    for (const a of m) for (const b of f) for (const feld of G.schema(id, a, b)) {
      assert.ok(e.phaenotypen.includes(feld.phaenotyp), `${id} ${a}×${b}: ${feld.phaenotyp}`);
      assert.ok((e.genotypen || [...e.genotypenMutter, ...e.genotypenVater]).includes(feld.genotyp), `${id}: Genotyp ${feld.genotyp}`);
    }
  }
  // Zufällige Nachkommen nähern sich 3 : 1
  let s = 11; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const z = G.zaehle(G.nachkommen('dominant', 'Gg', 'Gg', 4000, r));
  nahe(z['gelb'] / 4000, 0.75, 0.03, 'Anteil gelb');
});

test('6 · Inhaltsdaten vollständig', () => {
  const textOk = (o, wo) => { assert.ok(o && typeof o.name === 'string' && o.name && typeof o.text === 'string' && o.text.length > 10, `${wo}: Name und Text`); };
  const ids = new Set();
  for (const p of BL.praeparate) {
    assert.ok(!ids.has(p.id), `Präparat ${p.id} doppelt`); ids.add(p.id);
    assert.ok([4, 10, 40, 100].includes(p.maxObjektiv), `${p.id}: maxObjektiv`);
    assert.ok(p.herstellung && Object.keys(p.strukturen).length >= 2, `${p.id}: Herstellung und Strukturen`);
    for (const [k, s] of Object.entries(p.strukturen)) textOk(s, `${p.id}.${k}`);
  }
  for (const id of ['zwiebel', 'wasserpest', 'mundschleimhaut', 'spaltoeffnung', 'blattquerschnitt', 'komplexauge']) assert.ok(ids.has(id), id);
  for (const [k, o] of Object.entries(BL.organismen)) { textOk(o, k); for (const [s, t] of Object.entries(o.strukturen || {})) textOk(t, `${k}.${s}`); }
  for (const v of BL.viren) { assert.ok(v.nm > 0 && v.erbgut && v.wirt, v.id); assert.ok(v.text.length > 10); }
  for (const z of Object.values(BL.zyklen)) { assert.ok(z.schritte.length >= 4); z.schritte.forEach(s => assert.ok(s.titel && s.text && s.dauer > 0)); }
  BL.organellen.forEach(o => { textOk(o, o.id); assert.ok(o.pflanze || o.tier, o.id); assert.ok(['LM', 'EM'].includes(o.sichtbar), o.id); });
  for (const [bereich, teile] of Object.entries(BL.anatomie)) for (const [k, t] of Object.entries(teile)) textOk(t, `${bereich}.${k}`);
  for (const [k, t] of Object.entries(BL.dnaTeile)) textOk(t, k);
  // Größenvergleich aufsteigend sortierbar, alle Größen positiv
  BL.groessen.forEach(g => assert.ok(g.um > 0, g.id));
});

test('7 · Lektion: lokale Dateien, keine externen Quellen, Logik ohne DOM', () => {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/static\/lesson-kit\.css">/);
  assert.match(html, /<script src="\.\.\/\.\.\/static\/lesson-kit\.js"><\/script>/);
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
    if (m[1].startsWith('../../static/')) continue;
    assert.ok(fs.existsSync(path.join(DIR, m[1])), `${m[1]} vorhanden`);
  }
  for (const f of fs.readdirSync(DIR).filter(f => /\.(js|css|html)$/.test(f))) {
    assert.doesNotMatch(fs.readFileSync(path.join(DIR, f), 'utf8'), /https?:\/\/(?!www\.w3\.org)/, `${f}: keine externen Adressen`);
  }
  for (const f of DATEIEN) {
    assert.doesNotMatch(fs.readFileSync(path.join(DIR, f), 'utf8'), /document\.|fetch\(|XMLHttpRequest/, `${f} ohne DOM`);
  }
  const lesson = JSON.parse(fs.readFileSync(path.join(DIR, 'lesson.json'), 'utf8'));
  assert.equal(lesson.subject, 'Biologie');
});
