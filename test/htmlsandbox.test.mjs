// Tests für die HTML-Sandbox (Fach Sandbox): Parser mit Positionen, Vorschau-Dokument (Klick-zu-Code, eingefügte
// Dateien, Zeilenkarte für Fehler), Schleifenschutz, Formatierer, Emmet, Autovervollständigung, ZIP und Teilen-Link.
// Die Dateien laufen wie im Browser (ohne DOM) in einer VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'lessons/sandbox-html');
const OHNE_DOM = ['quelltext.js', 'werkzeuge.js', 'hervorheben.js', 'vorschlaege.js', 'packen.js', 'vorlage.js'];
const ctx = vm.createContext({ TextEncoder, TextDecoder, btoa, atob, CompressionStream, DecompressionStream, Response, Blob, Uint8Array, DataView });
for (const f of [...OHNE_DOM, 'preview-bridge.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
const HS = ctx.HS;
const vorlage = () => HS.vorlage('beispiel');
const dateienVon = p => Object.fromEntries(p.dateien.map(d => [d.name, d.inhalt]));
const plain = x => JSON.parse(JSON.stringify(x));               // Werte aus der VM für deepEqual

test('1 · HTML-Parser: Positionen, Verschachtelung, Rohtext', () => {
  const t = '<!DOCTYPE html>\n<div class="a" id=x><p>Hallo <b>Welt</b></p><img src="b.svg"><script>if (a<b) {}</script></div>';
  const a = HS.parseHtml(t);
  const namen = a.elemente.map(e => e.name);
  assert.deepEqual(plain(namen), ['div', 'p', 'b', 'img', 'script']);
  for (const e of a.elemente) assert.equal(t.slice(e.start, e.start + 1 + e.name.length), '<' + e.name, e.name + ' beginnt an seiner Position');
  const b = a.elemente.find(e => e.name === 'b');
  assert.equal(t.slice(b.start, b.ende), '<b>Welt</b>');
  assert.equal(HS.elementBei(a, t.indexOf('Welt')).name, 'b', 'innerstes Element');
  assert.equal(HS.kurzname(a.elemente[0]), 'div#x.a');
  assert.equal(a.elemente.find(e => e.name === 'script').kinder.length, 1, '„<b“ im Skript ist kein Tag');
  assert.equal(a.probleme.length, 0);
  // Knoten der obersten Ebene decken den ganzen Text ab
  const k = a.wurzel.kinder;
  assert.equal(k[0].start, 0); assert.equal(k[k.length - 1].ende, t.length);
});

test('2 · HTML-Parser: fehlerhaftes und halb getipptes HTML stürzt nie ab', () => {
  const p = HS.parseHtml('<div><span>x</div><p>a<li>b</ul><a href="x');
  assert.ok(p.probleme.some(x => /span/.test(x.text)), 'nicht geschlossenes span');
  assert.ok(p.probleme.some(x => /<\/ul>/.test(x.text)), 'End-Tag ohne Start-Tag');
  assert.deepEqual(plain(HS.parseHtml('<ul><li>a<li>b</ul>').probleme), [], '</li> darf fehlen');
  const quelle = dateienVon(vorlage())['index.html'];
  let zufall = 7;
  const r = () => (zufall = (zufall * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 0; n <= quelle.length; n += 3) {
    const teil = quelle.slice(0, n);
    const kaputt = teil.slice(0, Math.floor(r() * teil.length)) + '<"\'/>='[Math.floor(r() * 6)] + teil.slice(Math.floor(r() * teil.length));
    for (const x of [teil, kaputt]) {
      const a = HS.parseHtml(x);
      for (const e of a.elemente) assert.ok(e.start < e.startEnde && e.startEnde <= e.ende && e.ende <= x.length, 'Positionen geordnet');
      const v = HS.baueVorschau({ 'index.html': x }, { bruecke: '' });
      assert.equal(typeof v.html, 'string');
    }
  }
});

test('3 · Vorschau: data-src-Positionen zeigen auf den Originalcode, Code bleibt unverändert', () => {
  const p = vorlage(), d = dateienVon(p), vorher = d['index.html'];
  const v = HS.baueVorschau(d, { bruecke: '<script>/*BRÜCKE*/</script>' });
  assert.equal(d['index.html'], vorher, 'Editor-Code unverändert');
  const re = /<([a-z][\w-]*)[^<>]*?\sdata-src-start="(\d+)" data-src-end="(\d+)"/g;
  let m, anzahl = 0;
  while ((m = re.exec(v.html))) {
    anzahl++;
    const s = +m[2], e = +m[3];
    assert.equal(vorher.slice(s, s + 1 + m[1].length).toLowerCase(), '<' + m[1], `Start von <${m[1]}>`);
    if (!HS.LEER[m[1]]) assert.ok(vorher.slice(s, e).endsWith('</' + m[1] + '>'), `Ende von <${m[1]}>`);
  }
  assert.ok(anzahl >= 15, 'alle Elemente markiert');
  assert.ok(v.html.indexOf('/*BRÜCKE*/') < v.html.indexOf('<title'), 'Brücke steht vor dem Schülercode');
  assert.ok(v.html.indexOf('/*BRÜCKE*/') > v.html.indexOf('<head'), 'Brücke im <head> (kein Quirks-Modus)');
  assert.match(v.html, /<style data-hs-datei="style\.css">/, 'style.css eingefügt');
  assert.match(v.html, /<script data-hs-datei="script\.js">/, 'script.js eingefügt');
  assert.match(v.html, /src="data:image\/svg\+xml/, 'Bild aus dem Projekt als data:-URL');
  assert.doesNotMatch(v.html, /<link rel="stylesheet"/);
  // Regeln aus style.css für den Inspektor
  const knopf = v.regeln.find(r => r.selektor === '#knopf');
  assert.equal(knopf.datei, 'style.css');
  assert.equal(d['style.css'].slice(knopf.start, knopf.kopfEnde), '#knopf {');
  assert.equal(HS.zeileVon(d['style.css'], knopf.start), 27);
});

test('4 · Zeilenkarte: Fehlerzeilen im Vorschau-Dokument → Datei und Zeile', () => {
  const d = { 'index.html': '<!doctype html>\n<html>\n<head>\n<link rel="stylesheet" href="s.css">\n</head>\n<body>\n<p>x</p>\n<script src="a.js"></script>\n<script>\nlet q = 1;\nfehler();\n</script>\n</body>\n</html>',
    's.css': 'p {\n  color: red;\n}\n', 'a.js': 'let a = 1;\n\nnichtDa();\n' };
  const v = HS.baueVorschau(d, { bruecke: '<script>\n// zwei\n// drei\n</script>' });
  const zeilen = v.html.split('\n');
  const finde = s => zeilen.findIndex(z => z.includes(s)) + 1;
  assert.deepEqual({ ...HS.ordneZeile(v.karte, finde('nichtDa')) }, { datei: 'a.js', zeile: 3 });
  assert.deepEqual({ ...HS.ordneZeile(v.karte, finde('fehler()')) }, { datei: 'index.html', zeile: 11 });
  assert.deepEqual({ ...HS.ordneZeile(v.karte, finde('color: red')) }, { datei: 's.css', zeile: 2 });
  assert.deepEqual({ ...HS.ordneZeile(v.karte, finde('</html>')) }, { datei: 'index.html', zeile: 14 });
  assert.equal(HS.ordneZeile(v.karte, finde('// drei')), null, 'Zeilen der Brücke gehören zu keiner Datei');
});

test('5 · Vorschau: fehlende Dateien, defer, fremde Adressen, mehrere Seiten', () => {
  const v = HS.baueVorschau({ 'index.html': '<head><link rel="stylesheet" href="fehlt.css"><script defer src="./a.js"></script><script src="https://example.org/x.js"></script></head><body><p>x</p></body>', 'a.js': 'tu();' }, { bruecke: '' });
  assert.ok(v.warnungen.some(w => /fehlt\.css/.test(w.text)));
  assert.ok(v.html.indexOf('tu();') > v.html.indexOf('<p'), 'defer-Skript läuft nach dem Inhalt');
  assert.match(v.html, /src="https:\/\/example\.org\/x\.js"/, 'fremde Adressen bleiben, wie sie sind');
  const z = HS.baueVorschau({ 'index.html': '<p>1</p>', 'zwei.html': '<p>2</p>' }, { haupt: 'zwei.html', bruecke: '' });
  assert.match(z.html, /<p data-src-start="0" data-src-end="8">2<\/p>/);
  const leer = HS.baueVorschau({ 'a.html': '' }, { bruecke: '' });
  assert.match(leer.html, /gibt es nicht/);
  // Brücke als Funktion bekommt die CSS-Regeln
  let regeln = null;
  HS.baueVorschau({ 'index.html': '<style>.a{}</style><p class="a">x</p>' }, { bruecke: info => { regeln = info.regeln; return ''; } });
  assert.equal(regeln[0].selektor, '.a');
});

test('6 · Schleifenschutz: Endlosschleifen brechen ab, Zeilen bleiben gleich', () => {
  const code = 'let n = 0;\nwhile (true) {\n  n++;\n}\nfor (let i = 0; ; i++) { n--; }\ndo {\n n += 2;\n} while (true);\nconst s = "while (true) {";\n// for (;;) {\nconst r = /for (x) {/;\nresultat = n;';
  const g = HS.schleifenSchutz(code, 'script.js', 1);
  assert.equal(g.split('\n').length, code.split('\n').length, 'keine neuen Zeilen');
  assert.equal((g.match(/__hsSchleife/g) || []).length, 3, 'nur echte Schleifen');
  assert.match(g, /while \(true\) \{if\(__hsSchleife\("script\.js",2\)\)break;/);
  assert.match(g, /do \{if\(__hsSchleife\("script\.js",6\)\)break;/);
  assert.match(g, /const s = "while \(true\) \{";/, 'Strings unverändert');
  const aufrufe = {};
  const sandbox = { __hsSchleife: (d, z) => (aufrufe[z] = (aufrufe[z] || 0) + 1) > 1000, resultat: null };
  vm.runInNewContext(g, sandbox, { timeout: 2000 });
  assert.deepEqual(Object.keys(aufrufe).sort(), ['2', '5', '6']);
  // Zeilen im <script> der index.html beziehen sich auf die HTML-Datei
  const v = HS.baueVorschau({ 'index.html': '<p>x</p>\n<script>\nwhile (1) {}\n</script>' }, { bruecke: '' });
  assert.match(v.html, /__hsSchleife\("index\.html",3\)/);
});

test('7 · CSS-Parser: Regeln mit Positionen, auch in @media; @keyframes übersprungen', () => {
  const css = '/* a { } */\nh1, .b > p { color: red; }\n@media (max-width: 600px) {\n  #x:hover { top: 0 }\n}\n@keyframes k { from { top: 0 } to { top: 1px } }\n.offen { color: blue';
  const r = HS.parseCss(css);
  assert.deepEqual(plain(r.map(x => x.selektor)), ['h1, .b > p', '#x:hover', '.offen']);
  assert.equal(css.slice(r[0].start, r[0].ende), 'h1, .b > p { color: red; }');
  assert.equal(r[2].ende, css.length, 'Regel ohne „}“ reicht bis zum Ende');
  assert.equal(HS.regelBei(r, css.indexOf('top: 0')).selektor, '#x:hover');
});

test('8 · Formatieren: ordentlich eingerückt, nichts geht verloren, zweimal = einmal', () => {
  const ohneLeer = s => s.replace(/\s+/g, '');
  const html = '<div><p>a</p><ul><li>x</li><li>y <b>z</b></li></ul><pre>  a\n    b</pre><section><h2>T</h2><p>Text <a href="#">Link</a>,</p></section><style>p{color:red;margin:0}</style></div>';
  const f = HS.formatiere(html, 'html');
  assert.equal(ohneLeer(f), ohneLeer(html.replace('p{color:red;margin:0}', 'p { color: red; margin: 0 }')), 'nur Leerraum verändert');
  assert.match(f, /^ {2}<ul>$/m);
  assert.match(f, /^ {4}<li>y <b>z<\/b><\/li>$/m, 'Inline-Elemente bleiben im Text');
  assert.match(f, /<pre> {2}a\n {4}b<\/pre>/, '<pre> bleibt Zeichen für Zeichen');
  assert.match(f, /<p>Text <a href="#">Link<\/a>,<\/p>/, 'kein Leerzeichen vor dem Komma');
  assert.equal(HS.formatiere(f, 'html'), f, 'idempotent');
  for (const d of vorlage().dateien) {
    const art = HS.dateiArt(d.name).sprache;
    if (art !== 'html' && art !== 'css' && art !== 'js') continue;
    const g = HS.formatiere(d.inhalt, art);
    assert.equal(ohneLeer(g), ohneLeer(d.inhalt), d.name + ': nichts verloren');
    assert.equal(HS.formatiere(g, art), g, d.name + ': idempotent');
  }
  assert.equal(HS.formatiere('a{color:red;margin:0 auto}b,i>em{x:url(a;b)}', 'css'), 'a {\n  color: red;\n  margin: 0 auto\n}\n\nb, i > em {\n  x: url(a;b)\n}\n');
  assert.equal(HS.formatiere("knopf.addEventListener('click', function () {\nalert(1);\nif (x) {\ny();\n}\n});", 'js'), "knopf.addEventListener('click', function () {\n  alert(1);\n  if (x) {\n    y();\n  }\n});\n");
  // kaputtes HTML: kein Absturz, kein Zeichen weg
  const kaputt = '<div><span>x</p></ul><a href="x';
  assert.equal(ohneLeer(HS.formatiere(kaputt, 'html')), ohneLeer(kaputt));
});

test('9 · Emmet-Abkürzungen', () => {
  const e = (a, el) => { const r = HS.emmet(a, el); return r && r.text; };
  assert.equal(e('ul>li*3'), '<ul>\n  <li></li>\n  <li></li>\n  <li></li>\n</ul>');
  assert.equal(e('div.box>h2{Titel}+p'), '<div class="box">\n  <h2>Titel</h2>\n  <p></p>\n</div>');
  assert.equal(e('ul>li.item$*2>a'), '<ul>\n  <li class="item1"><a href=""></a></li>\n  <li class="item2"><a href=""></a></li>\n</ul>');
  assert.equal(e('img'), '<img src="" alt="">');
  assert.equal(e('.x'), '<div class="x"></div>');
  assert.equal(e('.x', 'ul'), '<li class="x"></li>', 'implizites Tag in einer Liste');
  assert.equal(e('p#a[title=hi]{a<b}'), '<p id="a" title="hi">a&lt;b</p>');
  assert.match(e('!'), /^<!DOCTYPE html>\n<html lang="de">/);
  assert.equal(HS.emmet('a').cursor, 9, 'Cursor im leeren href');
  assert.equal(e('hallo'), null, 'normale Wörter bleiben Wörter');
  assert.equal(e('ul>'), null);
  assert.deepEqual({ ...HS.emmetVor('<p>ul>li', 8) }, { start: 3, abk: 'ul>li' });
  assert.deepEqual({ ...HS.emmetVor('  div{Hallo Welt}', 17) }, { start: 2, abk: 'div{Hallo Welt}' });
});

test('10 · Autovervollständigung erkennt, was gerade getippt wird', () => {
  const v = (t, s) => { const p = t.indexOf('|'); return HS.vorschlaege(t.replace('|', ''), p, s); };
  assert.equal(v('<di|', 'html').liste[0].text, 'div');
  const attr = v('<a hr|', 'html');
  assert.equal(attr.liste[0].einfuegen, 'href=""'); assert.equal(attr.liste[0].cursor, 6);
  assert.ok(v('<input type="|', 'html').liste.some(x => x.text === 'checkbox'));
  assert.deepEqual(plain(v('<div><p>x</|', 'html').liste.map(x => x.einfuegen)), ['p>']);
  assert.equal(v('p { backg| }', 'css').liste[0].text, 'background');
  assert.ok(v('p { display: f| }', 'css').liste.some(x => x.einfuegen === 'flex;'));
  assert.equal(v('p { color: red }\n|', 'css'), null, 'im Selektor keine Vorschläge');
  assert.equal(v('document.getE|', 'js').liste[0].einfuegen, 'getElementById()');
  assert.equal(v('let punkte = 0;\npu|', 'js').liste[0].text, 'punkte', 'eigene Variablen');
  assert.equal(v('const s = "doc|', 'js'), null, 'nicht in Strings');
  assert.equal(v('Hallo Welt|', 'html'), null, 'nicht im Fließtext');
  assert.equal(v('<style>h1 { col| }</style>', 'html').liste[0].text, 'color', 'CSS in <style>');
  assert.equal(v('<script>console.l|</script>', 'html').liste[0].text, 'log', 'JS in <script>');
});

test('11 · Syntax-Hervorhebung: jede Zeile, richtige Klassen', () => {
  const t = '<p class="a">x</p>\n<style>h1 { color: #fff }</style>\n<script>let a = "s"; // k\n</script>';
  const z = HS.faerbe(t, 'html');
  assert.equal(z.length, t.split('\n').length);
  const klassen = z.flat().map(s => s.k);
  for (const k of ['tag', 'attr', 'wert', 'sel-tag', 'ceig', 'zahl', 'kw', 'str', 'kom']) assert.ok(klassen.includes(k), k);
  assert.equal(HS.zeileHtml('<b>', [{ von: 1, bis: 2, k: 'tag' }]), '&lt;<span class="t-tag">b</span>&gt;');
});

test('12 · Kommentieren, Dateinamen, Projekte prüfen', () => {
  assert.equal(HS.kommentiere('a\nb', 0, 3, 'js').text, '// a\n// b');
  assert.equal(HS.kommentiere('// a\n// b', 0, 9, 'js').text, 'a\nb');
  assert.equal(HS.kommentiere('  <p>x</p>', 3, 3, 'html').text, '  <!-- <p>x</p> -->');
  assert.equal(HS.kommentiere('p { }', 0, 0, 'css').text, '/* p { } */');
  assert.equal(HS.pruefeName('seite2.html', []), '');
  assert.match(HS.pruefeName('mein bild.png', []), /Leerzeichen/);
  assert.match(HS.pruefeName('../x.html', []), /Ordner/);
  assert.match(HS.pruefeName('x.exe', []), /Endungen/);
  assert.match(HS.pruefeName('Style.CSS', ['style.css']), /schon/);
  assert.equal(HS.pruefeProjekt(null), null);
  assert.equal(HS.pruefeProjekt({ dateien: [{ name: 'x.png', inhalt: 'javascript:alert(1)' }] }), null, 'Bilder nur als data:-URL');
  const p = HS.pruefeProjekt({ name: 'A', dateien: [{ name: 'index.html', inhalt: 'x' }, { name: 'index.html', inhalt: 'y' }, { name: 'a b.js', inhalt: '' }], offen: ['fehlt.js'], aktiv: 'fehlt.js' });
  assert.deepEqual(plain(p.dateien.map(d => d.name)), ['index.html']);
  assert.equal(p.aktiv, 'index.html');
});

test('13 · ZIP und Teilen-Link: hin und zurück ohne Verlust', async () => {
  const p = vorlage();
  p.dateien.push({ name: 'bild.png', inhalt: 'data:image/png;base64,iVBORw0KGgo=' }, { name: 'ä.txt', inhalt: 'x' });
  const zip = HS.projektAlsZip(p);
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x04034b50, 'ZIP-Kopf');
  const zurueck = HS.zipAlsDateien(await HS.zipLesen(zip));
  assert.deepEqual(plain(zurueck.map(d => d.name)), plain(p.dateien.map(d => d.name).filter(n => n !== 'ä.txt')), 'ungültige Namen fallen weg');
  for (const d of zurueck) assert.equal(d.inhalt, p.dateien.find(x => x.name === d.name).inhalt, d.name);
  assert.equal(HS.crc32(HS.utf8('123456789')), 0xCBF43926, 'CRC-32 Prüfwert');
  const code = await HS.teilenKodieren(p);
  assert.match(code, /^v1\.[A-Za-z0-9_-]+$/, 'nur URL-sichere Zeichen');
  assert.ok(code.length < JSON.stringify(p.dateien).length, 'komprimiert');
  const q = await HS.teilenDekodieren(code);
  assert.deepEqual(plain(q.dateien.map(d => [d.name, d.inhalt])), plain(p.dateien.filter(d => d.name !== 'ä.txt').map(d => [d.name, d.inhalt])));
  await assert.rejects(HS.teilenDekodieren('v1.kaputt!'));
  await assert.rejects(HS.teilenDekodieren(code.slice(0, 40)));
});

test('14 · Startvorlage: kommentiertes Beispiel mit Überschrift, Absatz, Liste, Link, Bild und CSS', () => {
  const p = vorlage(), d = dateienVon(p);
  assert.ok(HS.pruefeProjekt(p), 'gültiges Projekt');
  const a = HS.parseHtml(d['index.html']);
  const tags = new Set(a.elemente.map(e => e.name));
  for (const t of ['h1', 'p', 'ul', 'li', 'a', 'img', 'link', 'script', 'button']) assert.ok(tags.has(t), t);
  assert.deepEqual(plain(a.probleme), []);
  assert.match(d['index.html'], /<!--/, 'mit Kommentaren');
  assert.match(d['index.html'], /lang="de"/);
  assert.ok(HS.parseCss(d['style.css']).length >= 5);
  assert.doesNotMatch(Object.values(d).join('\n'), /src="https?:/, 'keine Bilder oder Skripte von fremden Servern');
  assert.equal(HS.vorlage('leer').dateien.length, 3);
});

test('15 · Einbindung: Lektion, Sandbox-Eintrag, sichere Vorschau, keine externen Ressourcen', () => {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/static\/lesson-kit\.css">/);
  assert.match(html, /<script src="\.\.\/\.\.\/static\/lesson-kit\.js"><\/script>/);
  for (const [, f] of html.matchAll(/<script src="([a-z0-9-]+\.js)"><\/script>/g)) assert.ok(fs.existsSync(path.join(DIR, f)), f);
  const sandbox = /<iframe id="vorschau"[^>]*sandbox="([^"]*)"/.exec(html)[1];
  assert.ok(sandbox.split(' ').includes('allow-scripts'));
  for (const verboten of ['allow-same-origin', 'allow-top-navigation', 'allow-popups']) assert.ok(!sandbox.includes(verboten), verboten);
  for (const f of fs.readdirSync(DIR).filter(f => /\.(js|css|html)$/.test(f))) {
    const t = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.doesNotMatch(t, /src=["']https?:|<link[^>]*href=["']https?:|@import|cdn\.|unpkg|jsdelivr/i, f + ' lädt nichts von fremden Servern');
  }
  for (const f of OHNE_DOM.filter(f => f !== 'vorlage.js'))   // die Vorlage enthält Schülercode als Text
    assert.doesNotMatch(fs.readFileSync(path.join(DIR, f), 'utf8'), /\bdocument\.\w|window\.addEventListener|localStorage\.\w|fetch\(/, f + ' ohne DOM');
  assert.doesNotMatch(HS.bruecke.toString(), /<\/script|<!--/i, 'Brücke kann als <script> eingefügt werden');
  const sb = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/sandbox/stufen.json'), 'utf8'));
  const sim = sb.simulationen.find(s => s.lesson === 'sandbox-html');
  assert.ok(sim && sim.id === 'html' && sim.icon === 'html');
  assert.match(fs.readFileSync(path.join(ROOT, 'src/views-fach.js'), 'utf8'), /\n {2}html: `<svg/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(DIR, 'lesson.json'), 'utf8')).title, 'HTML-Sandbox');
});
