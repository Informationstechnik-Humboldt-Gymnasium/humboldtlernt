// Tests für das Netzwerk-Labor (Network Builder, Fach Sandbox): Geräte und Kabel, IPv4-Prüfung, Subnetzrechnung,
// Kommunikation im gleichen Subnetz und über Router, Gateway- und Routingfehler, deaktivierte Schnittstellen,
// Paketpfad und Abbruch, MAC-Lernen, Netzwerkprüfung, Speichern/Laden, WLAN (Access Point), Firewall-Regeln, Dienste
// (Ping/HTTP/HTTPS) und die sieben Lernaufgaben.
// Die Module laufen wie im Browser (ohne DOM) in einer VM – alle Ergebnisse sind deterministisch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const LESSONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lessons');
const ctx = vm.createContext({});
for (const f of ['sandbox-netzwerk/ipv4.js', 'sandbox-netzwerk/modell.js', 'sandbox-netzwerk/simulation.js', 'sandbox-netzwerk/aufgaben.js', 'sandbox-schaltkreis/bedienung.js', 'sandbox-netzwerk/zeichnen.js']) {
  vm.runInContext(fs.readFileSync(path.join(LESSONS, f), 'utf8'), ctx, { filename: f });
}
const { ip: IP, modell: M, netzsim: S, netzAufgaben: A } = ctx.SL;
const plain = x => JSON.parse(JSON.stringify(x));

/** Gerät mit IP-Konfiguration. ifs: { port: [ip, maske, aktiv?] } */
function geraet(doc, typ, name, ifs = {}, extra = {}) {
  const w = { ifs: {}, ...extra };
  for (const [p, [ip, m, aktiv]] of Object.entries(ifs)) w.ifs[p] = { ip, maske: m, aktiv: aktiv !== false };
  const b = M.bauteil(doc, typ, doc.bauteile.length * 120, 0, w);
  assert.ok(M.setzeName(doc, b.id, name));
  return b;
}
function kabel(doc, a, pa, b, pb) { const r = M.verbinde(doc, { b: a.id, a: pa }, { b: b.id, a: pb }); assert.ok(r.ok, r.grund); return r.draht; }

/** Zwei PCs an einem Switch, gleiche /24. */
function lan(ip1 = '192.168.1.10', ip2 = '192.168.1.20', m1 = '/24', m2 = '/24') {
  const d = M.neu();
  const a = geraet(d, 'pc', 'PC1', { eth0: [ip1, m1] }), b = geraet(d, 'pc', 'PC2', { eth0: [ip2, m2] }), s = geraet(d, 'switch', 'SW1');
  kabel(d, a, 'eth0', s, 'p1'); kabel(d, b, 'eth0', s, 'p2');
  return { d, a, b, s };
}
/** Zwei Netze über einen Router (g0: 192.168.1.1/24, g1: 192.168.2.1/24). */
function zweiNetze({ gw1 = '192.168.1.1', gw2 = '192.168.2.1', g1aktiv = true } = {}) {
  const d = M.neu();
  const a = geraet(d, 'pc', 'PC1', { eth0: ['192.168.1.10', '/24'] }, { gateway: gw1 });
  const b = geraet(d, 'pc', 'PC2', { eth0: ['192.168.2.10', '/24'] }, { gateway: gw2 });
  const r = geraet(d, 'router', 'R1', { g0: ['192.168.1.1', '/24'], g1: ['192.168.2.1', '/24', g1aktiv] });
  const s1 = geraet(d, 'switch', 'SW1'), s2 = geraet(d, 'switch', 'SW2');
  kabel(d, a, 'eth0', s1, 'p1'); kabel(d, s1, 'p8', r, 'g0'); kabel(d, r, 'g1', s2, 'p1'); kabel(d, s2, 'p8', b, 'eth0');
  return { d, a, b, r, s1, s2 };
}
/** Drei Netze, zwei Router, Transfernetz 10.0.0.0/30. */
function zweiRouter(routenR1, routenR2) {
  const d = M.neu();
  const a = geraet(d, 'pc', 'PC1', { eth0: ['192.168.1.10', '/24'] }, { gateway: '192.168.1.1' });
  const r1 = geraet(d, 'router', 'R1', { g0: ['192.168.1.1', '/24'], g1: ['10.0.0.1', '/30'] }, { routen: routenR1 });
  const r2 = geraet(d, 'router', 'R2', { g0: ['10.0.0.2', '/30'], g1: ['192.168.2.1', '/24'] }, { routen: routenR2 });
  const b = geraet(d, 'pc', 'PC2', { eth0: ['192.168.2.10', '/24'] }, { gateway: '192.168.2.1' });
  kabel(d, a, 'eth0', r1, 'g0'); kabel(d, r1, 'g1', r2, 'g0'); kabel(d, r2, 'g1', b, 'eth0');
  return { d, a, b, r1, r2 };
}
const R1_ZU_NETZ2 = { ziel: '192.168.2.0', maske: '24', via: '10.0.0.2', aktiv: true };
const R2_ZU_NETZ1 = { ziel: '192.168.1.0', maske: '255.255.255.0', via: '10.0.0.1', aktiv: true };

// ------------------------------------------------------------------ IPv4
test('1 · IPv4-Adressen: gültige und ungültige Schreibweisen mit konkreter Meldung', () => {
  for (const [t, w] of [['192.168.1.10', 0xc0a8010a], ['10.0.0.1', 0x0a000001], ['255.255.255.255', 0xffffffff], ['0.0.0.0', 0], [' 172.16.5.4 ', 0xac100504]]) {
    const r = IP.adresse(t); assert.ok(r.ok, t); assert.equal(r.wert, w >>> 0, t);
  }
  const fehler = (t, muster) => { const r = IP.adresse(t); assert.equal(r.ok, false, t); assert.match(r.fehler, muster, t); };
  fehler('', /Keine IP-Adresse/);
  fehler('192.168.1', /genau vier Zahlen/);
  fehler('192.168.1.1.5', /genau vier Zahlen/);
  fehler('192.168.1.256', /zwischen 0 und 255/);
  fehler('192.168..1', /fehlt eine Zahl/);
  fehler('192.168.01.1', /nicht mit 0 beginnen/);
  fehler('192.168.1.x', /nur Ziffern und Punkte/);
  fehler('-1.2.3.4', /nur Ziffern und Punkte/);
  assert.equal(IP.text(0xc0a8010a), '192.168.1.10');
});

test('2 · Subnetzmasken und Präfixe: /24, 24, 255.255.255.0 – nicht zusammenhängende Masken werden abgelehnt', () => {
  for (const [t, p] of [['/24', 24], ['24', 24], ['255.255.255.0', 24], ['255.255.0.0', 16], ['255.255.255.252', 30], ['/8', 8], ['255.255.255.128', 25], ['0', 0], ['/32', 32]]) {
    const r = IP.praefix(t); assert.ok(r.ok, t); assert.equal(r.praefix, p, t);
  }
  assert.equal(IP.praefix('/24').maskeText, '255.255.255.0');
  for (const t of ['255.0.255.0', '255.255.255.1', '/33', '', 'abc', '255.255.256.0']) assert.equal(IP.praefix(t).ok, false, t);
  assert.match(IP.praefix('255.0.255.0').fehler, /lückenlos/);
});

test('3 · Subnetzberechnung: Netz, Broadcast, Hostbereich, Anzahl Hosts, gleiches Netz', () => {
  const ip = IP.adresse('192.168.1.130').wert;
  assert.deepEqual(plain(IP.info(ip, 24)), { netz: '192.168.1.0', broadcast: '192.168.1.255', ersterHost: '192.168.1.1', letzterHost: '192.168.1.254', hosts: 254, praefix: 24, maske: '255.255.255.0', cidr: '192.168.1.0/24' });
  const i25 = IP.info(ip, 25);
  assert.equal(i25.netz, '192.168.1.128'); assert.equal(i25.broadcast, '192.168.1.255'); assert.equal(i25.hosts, 126);
  const i30 = IP.info(IP.adresse('10.0.0.2').wert, 30);
  assert.equal(i30.netz, '10.0.0.0'); assert.equal(i30.broadcast, '10.0.0.3'); assert.equal(i30.hosts, 2);
  assert.equal(IP.info(IP.adresse('10.20.30.40').wert, 8).hosts, 16777214);
  const a = IP.adresse('192.168.1.10').wert, b = IP.adresse('192.168.1.200').wert, c = IP.adresse('192.168.2.10').wert;
  assert.equal(IP.gleichesNetz(a, b, 24), true);
  assert.equal(IP.gleichesNetz(a, c, 24), false);
  assert.equal(IP.gleichesNetz(a, c, 16), true);
  assert.equal(IP.gleichesNetz(a, b, 25), false, '/25 teilt bei .128');
});

test('4 · Host-Konfiguration: Netz- und Broadcastadresse, Loopback, Multicast, Präfixgrenzen', () => {
  assert.ok(IP.host('192.168.1.10', '/24').ok);
  const f = (ip, m, muster) => { const r = IP.host(ip, m); assert.equal(r.ok, false, `${ip} ${m}`); assert.ok(r.fehler.some(x => muster.test(x)), `${ip} ${m}: ${r.fehler}`); };
  f('192.168.1.0', '/24', /Netzadresse/);
  f('192.168.1.255', '/24', /Broadcast/);
  f('192.168.1.127', '/25', /Broadcast/);
  f('127.0.0.1', '/8', /Loopback/);
  f('224.0.0.5', '/24', /Multicast/);
  f('0.0.0.0', '/24', /keine gültige Geräteadresse/);
  f('10.0.0.1', '/31', /von \/8 bis \/30/);
  f('10.0.0.1', '/4', /von \/8 bis \/30/);
  f('10.0.0.1', '', /Keine Subnetzmaske/);
  f('', '/24', /Keine IP-Adresse/);
  assert.ok(IP.host('192.168.1.128', '/24').ok, 'bei /24 ist .128 ein normaler Host');
  assert.ok(IP.netzangabe('192.168.2.0', '24').ok);
  assert.match(IP.netzangabe('192.168.2.5', '24').fehler[0], /keine Netzadresse.*192\.168\.2\.0\/24/);
});

// ------------------------------------------------------------------ Modell
test('5 · Geräte und Kabel anlegen, eindeutige IDs, ein Kabel pro Anschluss, Löschen entfernt Kabel mit', () => {
  const d = M.neu();
  const p1 = M.bauteil(d, 'pc', 0, 0), p2 = M.bauteil(d, 'pc', 100, 0), s = M.bauteil(d, 'switch', 0, 200), r = M.bauteil(d, 'router', 300, 0), sv = M.bauteil(d, 'server', 400, 0);
  assert.equal(new Set(d.bauteile.map(b => b.id)).size, 5);
  assert.deepEqual(plain(d.bauteile.map(b => b.name)), ['PC1', 'PC2', 'SW1', 'R1', 'Server1']);
  assert.deepEqual(Object.keys(M.ports(s)).length, 8);
  assert.deepEqual(plain(Object.keys(M.ports(r))), ['g0', 'g1', 'g2']);
  assert.throws(() => M.bauteil(d, 'toaster', 0, 0));
  const k = M.verbinde(d, { b: p1.id, a: 'eth0' }, { b: s.id, a: 'p1' });
  assert.ok(k.ok);
  assert.match(M.verbinde(d, { b: p2.id, a: 'eth0' }, { b: s.id, a: 'p1' }).grund, /schon belegt/);
  assert.match(M.verbinde(d, { b: p1.id, a: 'eth0' }, { b: r.id, a: 'g0' }).grund, /schon belegt/);
  assert.match(M.verbinde(d, { b: r.id, a: 'g0' }, { b: r.id, a: 'g1' }).grund, /mit sich selbst/);
  assert.match(M.verbinde(d, { b: r.id, a: 'g9' }, { b: s.id, a: 'p2' }).grund, /zwei Netzwerkanschlüssen/);
  assert.ok(M.verbinde(d, { b: p2.id, a: 'eth0' }, { b: s.id, a: 'p2' }).ok);
  assert.ok(M.verbinde(d, { b: s.id, a: 'p8' }, { b: r.id, a: 'g0' }).ok);
  assert.ok(M.verbinde(d, { b: sv.id, a: 'eth0' }, { b: r.id, a: 'g1' }).ok);
  assert.equal(d.draehte.length, 4);
  assert.deepEqual(plain(M.gegenstelle(d, { b: s.id, a: 'p1' })), { b: p1.id, a: 'eth0' });
  assert.ok(M.validiere(d).ok);
  // Kabel löschen
  assert.ok(M.loesche(d, { art: 'draht', id: k.draht.id }));
  assert.equal(M.kabelAn(d, { b: p1.id, a: 'eth0' }), null);
  // Switch mit Kabeln löschen → keine verwaisten Kabel
  assert.ok(M.loesche(d, { art: 'bauteil', id: s.id }));
  assert.equal(d.draehte.length, 1);
  assert.ok(M.validiere(d).ok);
  assert.equal(M.loesche(d, { art: 'bauteil', id: 'gibtsnicht' }), false);
  assert.equal(M.loesche(d, null), false);
  // Neue IDs werden nicht wiederverwendet, solange es das Gerät gibt; Namen bleiben eindeutig
  assert.equal(M.setzeName(d, p1.id, 'PC2'), false, 'doppelter Name abgelehnt');
  assert.ok(M.setzeName(d, p1.id, 'Lehrer-PC'));
});

test('6 · Verschieben: Kabelenden folgen den Anschlüssen, Raster 20', () => {
  const { d, a, s } = lan();
  const k = M.kabelAn(d, { b: a.id, a: 'eth0' });
  assert.ok(M.verschiebe(d, a.id, 413, -77));
  assert.equal(a.x, 420); assert.equal(a.y, -80);
  const pts = M.drahtPunkte(d, k);
  assert.deepEqual(plain(pts[0]), { x: 420 + M.ports(a).eth0.x, y: -80 + M.ports(a).eth0.y });
  assert.deepEqual(plain(pts[1]), { x: s.x + M.ports(s).p1.x, y: s.y + M.ports(s).p1.y });
  assert.equal(M.verschiebe(d, a.id, 420, -80), false, 'keine Änderung');
});

test('7 · Formale Prüfung und Import: doppelte IDs, verwaiste Kabel, doppelt belegte Ports', () => {
  const kaputt = { format: 'netzwerk-labor', version: 1,
    bauteile: [{ id: 'g1', typ: 'pc', name: 'A' }, { id: 'g1', typ: 'pc', name: 'B' }, { id: 'g2', typ: 'switch', name: 'S' }, { id: 'g3', typ: 'toaster', name: 'T' }],
    draehte: [{ id: 'k1', von: { b: 'g1', a: 'eth0' }, nach: { b: 'g2', a: 'p1' } }, { id: 'k2', von: { b: 'g1', a: 'eth0' }, nach: { b: 'g2', a: 'p2' } }, { id: 'k3', von: { b: 'g9', a: 'eth0' }, nach: { b: 'g2', a: 'p3' } }] };
  const v = M.validiere(kaputt);
  assert.equal(v.ok, false);
  for (const m of [/doppelt vergeben/, /unbekannter Gerätetyp/, /Anschluss, den es nicht gibt/, /mehrere Kabel/]) assert.ok(v.fehler.some(f => m.test(f)), String(m));
  const r = M.importiere(JSON.stringify(kaputt));
  assert.ok(r.ok);
  assert.equal(r.doc.bauteile.length, 2);
  assert.equal(r.doc.draehte.length, 1);
  assert.ok(r.hinweise.length >= 4);
  assert.ok(M.validiere(r.doc).ok);
  assert.equal(M.importiere('kein json').ok, false);
  assert.equal(M.importiere({ format: 'logik-labor', bauteile: [], draehte: [] }).ok, false);
  // Rundreise: Export → Import ergibt dasselbe Netz
  const { d } = zweiNetze();
  const zurueck = M.importiere(M.exportiere(d));
  assert.ok(zurueck.ok);
  assert.equal(M.exportiere(zurueck.doc), M.exportiere(d));
  // Werte werden bereinigt, aber nicht „repariert“
  const roh = M.normalisiere('pc', { ifs: { eth0: { ip: ' 192.168.1.300<script>', maske: '/24' } } });
  assert.equal(roh.ifs.eth0.ip, '192.168.1.300script');
  assert.equal(IP.host(roh.ifs.eth0.ip, roh.ifs.eth0.maske).ok, false);
});

// ------------------------------------------------------------------ Simulation
test('8 · Gleiches Subnetz über einen Switch: Erfolg, Weg über den Switch, Antwort zurück', () => {
  const { d, a, b, s } = lan();
  const r = S.sende(d, a.id, b.id, {});
  assert.equal(r.status, 'erfolg', r.meldung);
  assert.match(r.meldung, /Verbindung erfolgreich/);
  assert.deepEqual(plain(r.schritte.map(x => x.phase + ':' + x.name + ':' + x.art)),
    ['anfrage:PC1:start', 'anfrage:SW1:switch', 'anfrage:PC2:ziel', 'antwort:PC2:start', 'antwort:SW1:switch', 'antwort:PC1:ziel']);
  assert.equal(r.pfad.length, 4, 'zwei Kabel hin, zwei zurück');
  assert.ok(r.pfad.every(p => M.findeDraht(d, p.draht)), 'Paket läuft nur über echte Kabel');
  assert.equal(r.ablauf.filter(x => x.typ === 'kabel').length, 4);
  // MAC-Lernen: erst fluten, dann gezielt
  assert.match(r.schritte[1].grund, /noch unbekannt.*geflutet/);
  assert.match(r.schritte[4].grund, /steht in der MAC-Tabelle/);
  assert.deepEqual(plain(r.mac[s.id]), { [M.mac(a, 'eth0')]: 'p1', [M.mac(b, 'eth0')]: 'p2' });
});

test('9 · Direkt per Kabel ohne Switch funktioniert ebenfalls; gezeichnete Linie allein reicht nicht', () => {
  const d = M.neu();
  const a = geraet(d, 'pc', 'PC1', { eth0: ['10.1.1.1', '/24'] }), b = geraet(d, 'pc', 'PC2', { eth0: ['10.1.1.2', '/24'] });
  assert.equal(S.sende(d, a.id, b.id).ursache, 'kein-kabel', 'ohne Kabel keine Verbindung');
  kabel(d, a, 'eth0', b, 'eth0');
  assert.equal(S.sende(d, a.id, b.id).status, 'erfolg');
});

test('10 · Unterschiedliche Subnetze am selben Switch: Subnetzfehler statt erfundener Ursache', () => {
  const { d, a, b } = lan('192.168.1.10', '192.168.2.20');
  const r = S.sende(d, a.id, b.id);
  assert.equal(r.status, 'fehler');
  assert.equal(r.ursache, 'subnetz');
  assert.match(r.meldung, /unterschiedlichen Subnetzen \(192\.168\.1\.0\/24 und 192\.168\.2\.0\/24\)/);
  // Masken verschieden: PC1 sieht PC2 im eigenen Netz, PC2 sieht PC1 nicht → Antwort scheitert
  const m = lan('192.168.1.10', '192.168.1.200', '/24', '/25');
  const r2 = S.sende(m.d, m.a.id, m.b.id);
  assert.equal(r2.status, 'fehler');
  assert.match(r2.meldung, /Anfrage kommt bei PC2 an, aber die Antwort nicht zurück/);
});

test('11 · Ungültige IP-Konfiguration wird erkannt, bevor gesendet wird', () => {
  const { d, a, b } = lan('192.168.1.300', '192.168.1.20');
  const r = S.sende(d, a.id, b.id);
  assert.equal(r.ursache, 'ip-ungueltig'); assert.match(r.meldung, /Die IP-Adresse ist ungültig: PC1/);
  const z = lan('192.168.1.10', '192.168.1.255');
  assert.equal(S.sende(z.d, z.a.id, z.b.id).ursache, 'ziel-ip-ungueltig');
  const leer = lan('192.168.1.10', '');
  assert.match(S.sende(leer.d, leer.a.id, leer.b.id).meldung, /Keine IP-Adresse/);
});

test('12 · Zwischen Subnetzen mit korrekt konfiguriertem Router: Erfolg über den Router', () => {
  const { d, a, b, r } = zweiNetze();
  const e = S.sende(d, a.id, b.id);
  assert.equal(e.status, 'erfolg', e.meldung);
  const routerSchritte = e.schritte.filter(x => x.art === 'router');
  assert.equal(routerSchritte.length, 2, 'Router auf Hin- und Rückweg');
  assert.equal(routerSchritte[0].geraet, r.id);
  assert.equal(routerSchritte[0].schnittstelle, 'g0 → g1');
  assert.match(routerSchritte[0].grund, /direkt an g1 angeschlossen/);
  assert.equal(e.schritte[0].naechster, '192.168.1.1', 'erster Hop ist das Gateway');
  assert.match(e.schritte[0].grund, /an das Standardgateway/);
  // Pfad ist zusammenhängend: jedes Kabelstück beginnt dort, wo das vorige Gerät liegt
  const hin = e.pfad.filter(p => p.phase === 'anfrage');
  for (let i = 1; i < hin.length; i++) assert.equal(hin[i].von.b, hin[i - 1].nach.b);
  assert.equal(hin[0].von.b, a.id); assert.equal(hin[hin.length - 1].nach.b, b.id);
});

test('13 · Fehlendes oder falsches Standardgateway', () => {
  const ohne = zweiNetze({ gw1: '' });
  const r1 = S.sende(ohne.d, ohne.a.id, ohne.b.id);
  assert.equal(r1.ursache, 'gateway-fehlt'); assert.match(r1.meldung, /kein Standardgateway eingetragen/);
  const fremd = zweiNetze({ gw1: '192.168.2.1' });
  const r2 = S.sende(fremd.d, fremd.a.id, fremd.b.id);
  assert.equal(r2.ursache, 'gateway-falsch'); assert.match(r2.meldung, /nicht im eigenen Netz/);
  const niemand = zweiNetze({ gw1: '192.168.1.254' });
  const r3 = S.sende(niemand.d, niemand.a.id, niemand.b.id);
  assert.equal(r3.ursache, 'gateway-unerreichbar'); assert.match(r3.meldung, /Standardgateway ist nicht korrekt konfiguriert/);
  const kaputt = zweiNetze({ gw1: '192.168.1' });
  assert.equal(S.sende(kaputt.d, kaputt.a.id, kaputt.b.id).ursache, 'gateway-falsch');
  // Gateway zeigt auf einen PC statt auf einen Router
  const pc = zweiNetze({ gw1: '192.168.1.11' });
  const p3 = geraet(pc.d, 'pc', 'PC3', { eth0: ['192.168.1.11', '/24'] });
  kabel(pc.d, p3, 'eth0', pc.s1, 'p2');
  const r4 = S.sende(pc.d, pc.a.id, pc.b.id);
  assert.equal(r4.ursache, 'gateway-falsch'); assert.match(r4.meldung, /gehört zu PC3.*kein Router/);
  // Rückweg: PC2 ohne Gateway
  const zurueck = zweiNetze({ gw2: '' });
  const r5 = S.sende(zurueck.d, zurueck.a.id, zurueck.b.id);
  assert.equal(r5.ursache, 'gateway-fehlt'); assert.match(r5.meldung, /Antwort nicht zurück/);
});

test('14 · Fehlende, deaktivierte und fehlerhafte Routen', () => {
  const ohne = zweiRouter([], []);
  const r1 = S.sende(ohne.d, ohne.a.id, ohne.b.id);
  assert.equal(r1.ursache, 'keine-route'); assert.match(r1.meldung, /unterschiedlichen Subnetzen und es fehlt eine passende Route: R1/);
  const nurHin = zweiRouter([R1_ZU_NETZ2], []);
  const r2 = S.sende(nurHin.d, nurHin.a.id, nurHin.b.id);
  assert.equal(r2.ursache, 'keine-route'); assert.match(r2.meldung, /Antwort nicht zurück.*R2/);
  const beide = zweiRouter([R1_ZU_NETZ2], [R2_ZU_NETZ1]);
  assert.equal(S.sende(beide.d, beide.a.id, beide.b.id).status, 'erfolg');
  const aus = zweiRouter([{ ...R1_ZU_NETZ2, aktiv: false }], [R2_ZU_NETZ1]);
  const r3 = S.sende(aus.d, aus.a.id, aus.b.id);
  assert.equal(r3.ursache, 'route-deaktiviert'); assert.match(r3.meldung, /passende Route.*deaktiviert/);
  const falschHop = zweiRouter([{ ...R1_ZU_NETZ2, via: '10.9.9.9' }], [R2_ZU_NETZ1]);
  const r4 = S.sende(falschHop.d, falschHop.a.id, falschHop.b.id);
  assert.equal(r4.ursache, 'route-falsch'); assert.match(r4.meldung, /keinem direkt angeschlossenen Netz/);
  const niemand = zweiRouter([{ ...R1_ZU_NETZ2, via: '10.0.0.3' }], [R2_ZU_NETZ1]);
  assert.equal(S.sende(niemand.d, niemand.a.id, niemand.b.id).ursache, 'route-falsch', 'nächster Hop im Netz, aber kein Gerät');
  // Standardroute 0.0.0.0/0 und längster Präfix
  const standard = zweiRouter([{ ziel: '0.0.0.0', maske: '/0', via: '10.0.0.2', aktiv: true }], [R2_ZU_NETZ1]);
  assert.equal(S.sende(standard.d, standard.a.id, standard.b.id).status, 'erfolg');
  const lp = zweiRouter([{ ziel: '192.168.0.0', maske: '/16', via: '10.9.9.9', aktiv: true }, R1_ZU_NETZ2], [R2_ZU_NETZ1]);
  assert.equal(S.sende(lp.d, lp.a.id, lp.b.id).status, 'erfolg', 'die spezifischere /24-Route gewinnt gegen die kaputte /16');
});

test('15 · Deaktivierte Schnittstellen an Router und Endgerät', () => {
  const { d, a, b } = zweiNetze({ g1aktiv: false });
  const r = S.sende(d, a.id, b.id);
  assert.equal(r.ursache, 'if-deaktiviert');
  assert.match(r.meldung, /Eine benötigte Schnittstelle ist deaktiviert.*R1 \(g1\)/);
  const z = zweiNetze();
  M.setzeIf(z.d, z.r.id, 'g0', 'aktiv', false);
  const r2 = S.sende(z.d, z.a.id, z.b.id);
  assert.equal(r2.ursache, 'if-deaktiviert'); assert.match(r2.meldung, /R1 \(g0\)/);
  const l = lan();
  M.setzeIf(l.d, l.b.id, 'eth0', 'aktiv', false);
  const r3 = S.sende(l.d, l.a.id, l.b.id);
  assert.equal(r3.ursache, 'if-deaktiviert'); assert.match(r3.meldung, /PC2 \(eth0\)/);
  M.setzeIf(l.d, l.b.id, 'eth0', 'aktiv', true); M.setzeIf(l.d, l.a.id, 'eth0', 'aktiv', false);
  assert.match(S.sende(l.d, l.a.id, l.b.id).meldung, /PC1 \(eth0\)/);
});

test('16 · Paketpfad bricht am Fehler ab: letzter Schritt nennt Gerät und Grund, kein Weiterlaufen', () => {
  const { d, a, b, r } = zweiNetze({ g1aktiv: false });
  const e = S.sende(d, a.id, b.id);
  const letzter = e.schritte[e.schritte.length - 1];
  assert.equal(letzter.art, 'fehler');
  assert.equal(letzter.geraet, r.id);
  assert.ok(e.schritte.every(x => x.phase === 'anfrage'), 'keine Antwort-Schritte nach dem Abbruch');
  assert.ok(!e.pfad.some(p => p.nach.b === b.id), 'Paket erreicht PC2 nicht');
  assert.deepEqual(plain(e.ablauf[e.ablauf.length - 1]), { typ: 'schritt', i: e.schritte.length - 1 });
});

test('17 · Unklare Fälle: doppelte IP-Adresse und Schleife zwischen Switches', () => {
  const { d, a, b, s } = lan();
  const c = geraet(d, 'pc', 'PC3', { eth0: ['192.168.1.20', '/24'] });
  kabel(d, c, 'eth0', s, 'p3');
  const r = S.sende(d, a.id, b.id);
  assert.equal(r.status, 'unklar'); assert.equal(r.ursache, 'ip-doppelt'); assert.match(r.meldung, /mehrfach vergeben/);
  // Quelle und Ziel mit derselben Adresse: Adresskonflikt, kein „Erfolg“
  const gleich = lan('192.168.1.10', '192.168.1.10');
  const rg = S.sende(gleich.d, gleich.a.id, gleich.b.id);
  assert.equal(rg.status, 'unklar'); assert.equal(rg.ursache, 'ip-doppelt'); assert.match(rg.meldung, /dieselbe IP-Adresse/);
  const sl = lan();
  const s2 = geraet(sl.d, 'switch', 'SW2');
  kabel(sl.d, sl.s, 'p7', s2, 'p1'); kabel(sl.d, sl.s, 'p8', s2, 'p2');
  const r2 = S.sende(sl.d, sl.a.id, sl.b.id);
  assert.equal(r2.status, 'unklar'); assert.equal(r2.ursache, 'schleife');
});

test('18 · Routing-Schleife wird erkannt (Hop-Grenze), ungültige Aufrufe sauber abgefangen', () => {
  const { d, a, b } = zweiRouter([{ ziel: '192.168.2.0', maske: '24', via: '10.0.0.2', aktiv: true }], [{ ziel: '192.168.2.128', maske: '25', via: '10.0.0.1', aktiv: true }]);
  // PC2 ins Netz .128/25 verschieben, damit R2 es nicht direkt kennt … R2 schickt zurück zu R1, R1 wieder zu R2
  M.setzeIf(d, b.id, 'eth0', 'ip', '192.168.3.130'); M.setzeIf(d, b.id, 'eth0', 'maske', '/24');
  d.bauteile.find(x => x.name === 'R1').werte.routen.push({ id: 'r9', ziel: '192.168.3.0', maske: '24', via: '10.0.0.2', aktiv: true });
  d.bauteile.find(x => x.name === 'R2').werte.routen.push({ id: 'r9', ziel: '192.168.3.0', maske: '24', via: '10.0.0.1', aktiv: true });
  const r = S.sende(d, a.id, b.id);
  assert.equal(r.ursache, 'ttl'); assert.match(r.meldung, /Routing-Schleife/);
  assert.equal(S.sende(d, a.id, a.id).ursache, 'gleiches-geraet');
  assert.equal(S.sende(d, a.id, 'gibtsnicht').ursache, 'unbekannt');
  const rid = d.bauteile.find(x => x.typ === 'router').id;
  assert.equal(S.sende(d, a.id, rid).ursache, 'kein-endgeraet');
  // Die Simulation verändert das Modell nicht
  const vorher = M.exportiere(d);
  S.sende(d, a.id, b.id); S.pruefeNetz(d);
  assert.equal(M.exportiere(d), vorher);
});

test('19 · „Netzwerk prüfen“ meldet Konfigurationsfehler und zeigt, wer wen erreicht', () => {
  assert.match(S.pruefeNetz(M.neu()).meldungen[0].text, /leer/);
  const { d } = zweiNetze({ gw1: '192.168.2.1', g1aktiv: false });
  const r1 = d.bauteile.find(b => b.name === 'R1');
  M.routeHinzu(d, r1.id, { ziel: '10.5.5.5', maske: '24', via: '10.9.9.9' });
  const p = S.pruefeNetz(d), texte = p.meldungen.map(m => m.art + ': ' + m.text);
  for (const m of [/fehler: PC1: Das Standardgateway 192\.168\.2\.1 liegt nicht im eigenen Netz/, /warnung: R1: Die Schnittstelle g1 ist deaktiviert/, /keine Netzadresse/, /keinem direkt angeschlossenen Netz/]) {
    assert.ok(texte.some(t => m.test(t)), `${m} in ${texte.join(' | ')}`);
  }
  assert.deepEqual(plain(p.erreichbar.map(x => x.status)), ['fehler']);
  const ok = S.pruefeNetz(zweiNetze().d);
  assert.ok(ok.meldungen.some(m => m.art === 'ok'));
  assert.deepEqual(plain(ok.erreichbar.map(x => x.status)), ['erfolg']);
  // Router mit zwei Schnittstellen im selben Netz, doppelte IP
  const z = zweiNetze();
  M.setzeIf(z.d, z.r.id, 'g2', 'ip', '192.168.1.99'); M.setzeIf(z.d, z.r.id, 'g2', 'maske', '/24');
  M.setzeIf(z.d, z.b.id, 'eth0', 'ip', '192.168.2.1');
  const t2 = S.pruefeNetz(z.d).meldungen.map(m => m.text);
  assert.ok(t2.some(t => /überlappenden Netzen/.test(t)));
  assert.ok(t2.some(t => /192\.168\.2\.1 ist mehrfach vergeben/.test(t)));
});

test('20 · Routing-Tabelle zeigt direkt angeschlossene Netze (C) und statische Routen (S)', () => {
  const { d, r1 } = zweiRouter([R1_ZU_NETZ2], []);
  assert.deepEqual(plain(S.routingTabelle(r1).map(x => [x.art, x.ziel, x.via])), [['C', '192.168.1.0/24', 'direkt'], ['C', '10.0.0.0/30', 'direkt'], ['S', '192.168.2.0/24', '10.0.0.2']]);
  const neu = M.routeHinzu(d, r1.id, {});
  assert.ok(M.routeSetze(d, r1.id, neu.id, 'ziel', '172.16.0.0'));
  assert.ok(M.routeSetze(d, r1.id, neu.id, 'aktiv', false));
  assert.equal(M.routeSetze(d, r1.id, neu.id, 'quatsch', 1), false);
  assert.ok(M.routeLoesche(d, r1.id, neu.id));
  assert.equal(r1.werte.routen.length, 1);
});

// ------------------------------------------------------------------ Lernaufgaben
test('21 · Sieben Lernaufgaben: reproduzierbar, vollständig beschrieben, anfangs nicht gelöst', () => {
  assert.deepEqual(plain(A.liste.map(a => a.id)), ['zwei-pcs', 'subnetz', 'zwei-netze', 'routing', 'debuggen', 'wlan', 'firewall']);
  for (const a of A.liste) {
    for (const f of ['titel', 'beschreibung', 'ziel', 'erklaerung']) assert.ok(a[f] && a[f].length > 10, `${a.id}.${f}`);
    assert.ok(a.hinweise.length >= 2, a.id);
    const d1 = a.bauen(), d2 = a.bauen();
    assert.equal(M.exportiere(d1), M.exportiere(d2), `${a.id}: Szenario ist reproduzierbar`);
    assert.ok(M.validiere(d1).ok, a.id);
    assert.equal(a.pruefe(d1).ok, false, `${a.id}: Startzustand darf nicht gelöst sein`);
  }
});

const nach = (d, n) => d.bauteile.find(b => b.name === n);
test('22 · Lösungen der Lernaufgaben werden anerkannt – und typische Fehlversuche nicht', () => {
  // 1 · Zwei PCs
  let a = A.finde('zwei-pcs'), d = a.bauen();
  kabel(d, nach(d, 'PC1'), 'eth0', nach(d, 'SW1'), 'p3'); kabel(d, nach(d, 'PC2'), 'eth0', nach(d, 'SW1'), 'p6');
  M.setzeIf(d, nach(d, 'PC1').id, 'eth0', 'ip', '10.0.5.1'); M.setzeIf(d, nach(d, 'PC1').id, 'eth0', 'maske', '255.255.255.0');
  assert.equal(a.pruefe(d).ok, false);
  M.setzeIf(d, nach(d, 'PC2').id, 'eth0', 'ip', '10.0.5.2'); M.setzeIf(d, nach(d, 'PC2').id, 'eth0', 'maske', '/24');
  assert.equal(a.pruefe(d).ok, true);
  // Direktkabel ohne Switch zählt bei Aufgabe 1 nicht
  const direkt = a.bauen();
  kabel(direkt, nach(direkt, 'PC1'), 'eth0', nach(direkt, 'PC2'), 'eth0');
  for (const [n, ip] of [['PC1', '10.0.0.1'], ['PC2', '10.0.0.2']]) { M.setzeIf(direkt, nach(direkt, n).id, 'eth0', 'ip', ip); M.setzeIf(direkt, nach(direkt, n).id, 'eth0', 'maske', '/24'); }
  assert.match(a.pruefe(direkt).text, /nicht über einen Switch/);

  // 2 · Subnetzfehler
  a = A.finde('subnetz'); d = a.bauen();
  M.setzeIf(d, nach(d, 'PC2').id, 'eth0', 'ip', '192.168.1.10');
  assert.equal(a.pruefe(d).ok, false, 'doppelte Adresse ist keine Lösung');
  M.setzeIf(d, nach(d, 'PC2').id, 'eth0', 'ip', '192.168.1.20');
  assert.equal(a.pruefe(d).ok, true);

  // 3 · Zwei Netze
  a = A.finde('zwei-netze'); d = a.bauen();
  const r = nach(d, 'R1');
  kabel(d, nach(d, 'SW1'), 'p8', r, 'g0'); kabel(d, nach(d, 'SW2'), 'p1', r, 'g1');
  M.setzeIf(d, r.id, 'g0', 'ip', '192.168.1.1'); M.setzeIf(d, r.id, 'g0', 'maske', '/24');
  M.setzeIf(d, r.id, 'g1', 'ip', '192.168.2.1'); M.setzeIf(d, r.id, 'g1', 'maske', '/24');
  M.setzeWert(d, nach(d, 'PC1').id, 'gateway', '192.168.1.1');
  assert.match(a.pruefe(d).text, /Antwort nicht zurück/);
  M.setzeWert(d, nach(d, 'PC2').id, 'gateway', '192.168.2.1');
  assert.equal(a.pruefe(d).ok, true);

  // 4 · Routing
  a = A.finde('routing'); d = a.bauen();
  M.routeHinzu(d, nach(d, 'R2').id, { ziel: '192.168.1.0', maske: '/24', via: '10.0.0.9' });
  assert.equal(a.pruefe(d).ok, false, 'falscher nächster Hop');
  M.routeSetze(d, nach(d, 'R2').id, 'r1', 'via', '10.0.0.1');
  assert.equal(a.pruefe(d).ok, true);

  // 5 · Debuggen: beide Fehler müssen behoben werden
  a = A.finde('debuggen'); d = a.bauen();
  M.setzeIf(d, nach(d, 'R1').id, 'g1', 'aktiv', true);
  assert.match(a.pruefe(d).text, /PC2 → Server/);
  M.setzeWert(d, nach(d, 'PC2').id, 'gateway', '192.168.1.1');
  assert.equal(a.pruefe(d).ok, true);
  // Geräte umbenannt/gelöscht → verständliche Meldung
  M.loesche(d, { art: 'bauteil', id: nach(d, 'Server').id });
  assert.match(a.pruefe(d).text, /fehlt/);
});

test('23 · Schnittstelle zur gemeinsamen Bedienung (bedienung.js) und Darstellung', () => {
  const B = new ctx.SL.Bedienung({ doc: () => d, merke() {}, geaendert() {}, zeige() {}, auswahl() {}, meldung() {} });
  const d = M.neu();
  const p = B.freierPlatz('pc');
  const pc = B.fuegeEin('pc', p.x, p.y);
  assert.equal(d.bauteile.length, 1);
  const sw = B.fuegeEin('switch', p.x + 300, p.y + 200);
  // Verkabeln über die Bedienung (Antippen von zwei Anschlüssen)
  B.view = { x: -500, y: -500, s: 1 };
  const pos = (b, a) => { const q = M.anschlussPos(d, { b: b.id, a }); return { id: 1, x: q.x + 500, y: q.y + 500, typ: 'mouse', taste: 0 }; };
  B.runter(pos(pc, 'eth0')); B.hoch(pos(pc, 'eth0'));
  B.runter(pos(sw, 'p4')); B.hoch(pos(sw, 'p4'));
  assert.equal(d.draehte.length, 1);
  assert.deepEqual(plain(M.gegenstelle(d, { b: pc.id, a: 'eth0' })), { b: sw.id, a: 'p4' });
  // Treffertest: Anschluss vor Gerät vor Kabel
  const t = M.trefferTest(d, pc.x, pc.y, 10);
  assert.equal(t.art, 'bauteil');
  assert.equal(M.trefferTest(d, pc.x + M.ports(pc).eth0.x, pc.y + M.ports(pc).eth0.y, 10).art, 'anschluss');
  // Darstellung erzeugt Markup ohne Ausnahme, auch mit Paket und Markierungen
  const svg = ctx.SL.zeichnen.szene({ doc: d, auswahl: { art: 'bauteil', id: pc.id }, vorschau: null, hover: null, pfadKabel: {}, paket: { x: 0, y: 0, phase: 'anfrage' }, markiert: { [pc.id]: 'quelle' } });
  assert.match(svg, /class="kabel/); assert.match(svg, /class="paket anfrage/); assert.match(svg, /PC1/);
  assert.doesNotMatch(svg, /undefined|NaN/);
});

test('24 · Seite: Einbindung wie vorgeschrieben, keine externen Ressourcen, Buttons mit type', () => {
  const html = fs.readFileSync(path.join(LESSONS, 'sandbox-netzwerk/index.html'), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/static\/lesson-kit\.css">/);
  assert.match(html, /<script src="\.\.\/\.\.\/static\/lesson-kit\.js"><\/script>/);
  assert.match(html, /<script src="\.\.\/sandbox-schaltkreis\/bedienung\.js"><\/script>/, 'gemeinsame Bedienung wird mitgenutzt');
  assert.doesNotMatch(html, /https?:\/\//);
  assert.equal((html.match(/<button(?![^>]*type="(button|submit)")/g) || []).length, 0);
  for (const f of ['ipv4.js', 'modell.js', 'simulation.js', 'aufgaben.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(LESSONS, 'sandbox-netzwerk', f), 'utf8'), /document\.|window\.addEventListener|fetch\(|XMLHttpRequest|WebSocket/, `${f} ist frei von DOM und Netzwerkzugriffen`);
  }
});

// ------------------------------------------------------------------ WLAN (Access Point, Laptop, Smartphone)
/** LAN mit Server, Switch, Access Point und einem Laptop. */
function wlanNetz({ ssid = 'Schule', schluessel = 'abc', laptopSsid = 'Schule', laptopSchluessel = 'abc', abstand = 100, reichweite = 200 } = {}) {
  const d = M.neu();
  const srv = geraet(d, 'server', 'Server', { eth0: ['192.168.1.5', '/24'] });
  const sw = geraet(d, 'switch', 'SW1');
  const ap = geraet(d, 'ap', 'AP1', {}, { ssid, schluessel, reichweite });
  M.verschiebe(d, ap.id, 0, 0);
  const lap = geraet(d, 'laptop', 'Laptop1', { wlan0: ['192.168.1.50', '/24'] }, { ssid: laptopSsid, schluessel: laptopSchluessel });
  M.verschiebe(d, lap.id, abstand, 0);
  kabel(d, srv, 'eth0', sw, 'p1'); kabel(d, sw, 'p2', ap, 'eth0');
  return { d, srv, sw, ap, lap };
}

test('25 · Neue Gerätetypen: Laptop und Smartphone ohne Kabelanschluss, Access Point und Firewall mit Anschlüssen', () => {
  const d = M.neu();
  const l = M.bauteil(d, 'laptop', 0, 0), h = M.bauteil(d, 'smartphone', 0, 0), ap = M.bauteil(d, 'ap', 0, 0), fw = M.bauteil(d, 'firewall', 0, 0), s = M.bauteil(d, 'switch', 0, 0);
  assert.deepEqual(plain(Object.keys(M.ports(l))), []);
  assert.deepEqual(plain(Object.keys(l.werte.ifs)), ['wlan0']);
  assert.equal(M.ifName(h), 'wlan0');
  assert.deepEqual(plain(Object.keys(M.ports(ap))), ['eth0']);
  assert.deepEqual(plain(Object.keys(M.ports(fw))), ['g0', 'g1', 'g2']);
  assert.equal(fw.werte.standard, 'blockieren', 'Firewall blockiert standardmäßig');
  assert.ok(M.verbinde(d, { b: ap.id, a: 'eth0' }, { b: s.id, a: 'p1' }).ok);
  assert.ok(M.verbinde(d, { b: fw.id, a: 'g0' }, { b: s.id, a: 'p2' }).ok);
  assert.equal(M.verbinde(d, { b: l.id, a: 'wlan0' }, { b: s.id, a: 'p3' }).ok, false, 'WLAN-Karte nimmt kein Kabel');
  assert.ok(M.validiere(d).ok);
  const r = M.importiere(M.exportiere(d));
  assert.equal(M.exportiere(r.doc), M.exportiere(d), 'neue Felder überstehen Speichern/Laden');
});

test('26 · WLAN-Anmeldung: SSID, Schlüssel, Reichweite – mit genauer Ursache', () => {
  const ok = wlanNetz();
  assert.equal(M.funk(ok.d, ok.lap).ok, true);
  assert.deepEqual(plain(M.funkKunden(ok.d, ok.ap).map(b => b.name)), ['Laptop1']);
  assert.equal(M.funk(wlanNetz({ laptopSsid: '' }).d, wlanNetz({ laptopSsid: '' }).lap).ursache, 'wlan-keine-ssid');
  const falsch = wlanNetz({ laptopSsid: 'Gast' });
  assert.equal(M.funk(falsch.d, falsch.lap).ursache, 'wlan-ssid');
  const weit = wlanNetz({ abstand: 400 });
  const fw = M.funk(weit.d, weit.lap);
  assert.equal(fw.ursache, 'wlan-reichweite'); assert.match(fw.grund, /Abstand 400, Reichweite 200/);
  const key = wlanNetz({ laptopSchluessel: 'xyz' });
  assert.equal(M.funk(key.d, key.lap).ursache, 'wlan-schluessel');
  const offen = wlanNetz({ schluessel: '', laptopSchluessel: 'egal' });
  assert.equal(M.funk(offen.d, offen.lap).ok, true, 'offenes WLAN ohne Schlüssel');
  assert.equal(M.funk(ok.d, ok.srv).ok, false, 'Server ist kein WLAN-Gerät');
  // Reichweite vergrößern holt den Laptop ins Netz; Verschieben ebenso
  M.setzeWert(weit.d, weit.ap.id, 'reichweite', 450);
  assert.equal(M.funk(weit.d, weit.lap).ok, true);
  M.setzeWert(weit.d, weit.ap.id, 'reichweite', 5000);
  assert.equal(weit.ap.werte.reichweite, 600, 'Reichweite begrenzt');
  // Zwei Access Points mit gleicher SSID: der nächste gewinnt
  const zwei = wlanNetz({ abstand: 150 });
  const ap2 = geraet(zwei.d, 'ap', 'AP2', {}, { ssid: 'Schule', schluessel: 'abc', reichweite: 200 });
  M.verschiebe(zwei.d, ap2.id, 200, 0);
  assert.equal(M.funk(zwei.d, zwei.lap).ap.name, 'AP2');
});

test('27 · Paket über WLAN: Laptop ↔ Server über Access Point und Switch, Laptop ↔ Smartphone am selben AP', () => {
  const { d, lap, srv, ap, sw } = wlanNetz();
  const r = S.sende(d, lap.id, srv.id);
  assert.equal(r.status, 'erfolg', r.meldung);
  assert.deepEqual(plain(r.schritte.filter(x => x.phase === 'anfrage').map(x => x.name + ':' + x.art)), ['Laptop1:start', 'AP1:ap', 'SW1:switch', 'Server:ziel']);
  const funk = r.pfad.filter(p => p.funk);
  assert.equal(funk.length, 2, 'eine Funkstrecke hin, eine zurück');
  assert.ok(funk.every(p => p.draht === null));
  assert.ok(r.mac[ap.id] && r.mac[sw.id], 'Access Point und Switch lernen MAC-Adressen');
  const handy = geraet(d, 'smartphone', 'Handy1', { wlan0: ['192.168.1.60', '/24'] }, { ssid: 'Schule', schluessel: 'abc' });
  M.verschiebe(d, handy.id, -80, 60);
  const r2 = S.sende(d, lap.id, handy.id);
  assert.equal(r2.status, 'erfolg');
  assert.deepEqual(plain(r2.schritte.filter(x => x.phase === 'anfrage').map(x => x.name)), ['Laptop1', 'AP1', 'Handy1']);
});

test('28 · Ohne WLAN-Verbindung: Fehler mit WLAN-Ursache; AP ohne Kabel trennt vom Kabelnetz', () => {
  const weit = wlanNetz({ abstand: 500 });
  const r = S.sende(weit.d, weit.lap.id, weit.srv.id);
  assert.equal(r.ursache, 'wlan-reichweite'); assert.match(r.meldung, /Keine WLAN-Verbindung/);
  const key = wlanNetz({ laptopSchluessel: 'falsch' });
  assert.equal(S.sende(key.d, key.lap.id, key.srv.id).ursache, 'wlan-schluessel');
  const ohneKabel = wlanNetz();
  M.loesche(ohneKabel.d, { art: 'draht', id: M.kabelAn(ohneKabel.d, { b: ohneKabel.ap.id, a: 'eth0' }).id });
  assert.equal(S.sende(ohneKabel.d, ohneKabel.lap.id, ohneKabel.srv.id).ursache, 'keine-verbindung');
  const p = S.pruefeNetz(ohneKabel.d).meldungen.map(m => m.text);
  assert.ok(p.some(t => /nicht per Kabel mit dem Netz verbunden/.test(t)));
  // Deaktivierte WLAN-Karte
  const aus = wlanNetz();
  M.setzeIf(aus.d, aus.lap.id, 'wlan0', 'aktiv', false);
  assert.equal(S.sende(aus.d, aus.lap.id, aus.srv.id).ursache, 'if-deaktiviert');
  assert.match(S.pruefeNetz(weit.d).meldungen.map(m => m.text).join(' '), /Keine WLAN-Verbindung/);
});

// ------------------------------------------------------------------ Firewall
/** LAN 192.168.1.0/24 – FW1 – 10.0.0.0/24 mit Webserver. */
function fwNetz(regeln = [], standard = 'blockieren', dienste = { web: true, https: false }) {
  const d = M.neu();
  const pc = geraet(d, 'pc', 'PC1', { eth0: ['192.168.1.10', '/24'] }, { gateway: '192.168.1.1' });
  const fw = geraet(d, 'firewall', 'FW1', { g0: ['192.168.1.1', '/24'], g1: ['10.0.0.1', '/24'] }, { regeln, standard });
  const srv = geraet(d, 'server', 'Webserver', { eth0: ['10.0.0.10', '/24'] }, { gateway: '10.0.0.1', dienste });
  kabel(d, pc, 'eth0', fw, 'g0'); kabel(d, fw, 'g1', srv, 'eth0');
  return { d, pc, fw, srv };
}
const ERLAUBE_HTTP = { aktion: 'erlauben', dienst: 'http', quelle: '192.168.1.0/24', ziel: '10.0.0.10' };

test('29 · Adressbereiche für Regeln: alle, einzelne Adresse, Netz – ungültige Angaben werden erkannt', () => {
  assert.equal(IP.bereich('alle').alle, true);
  assert.equal(IP.bereich('').alle, true);
  assert.equal(IP.bereich('any').alle, true);
  const n = IP.bereich('192.168.1.0/24');
  assert.ok(IP.imBereich(IP.adresse('192.168.1.77').wert, n));
  assert.ok(!IP.imBereich(IP.adresse('192.168.2.1').wert, n));
  const e = IP.bereich('10.0.0.5');
  assert.equal(e.praefix, 32); assert.ok(IP.imBereich(IP.adresse('10.0.0.5').wert, e)); assert.ok(!IP.imBereich(IP.adresse('10.0.0.6').wert, e));
  assert.match(IP.bereich('192.168.1.5/24').fehler, /keine Netzadresse/);
  assert.equal(IP.bereich('10.0.0/8').ok, false);
  assert.equal(IP.bereich('1.2.3.4/8/9').ok, false);
});

test('30 · Firewall: Standardrichtlinie, erste passende Regel, Dienst, zustandsbehaftete Antwort', () => {
  const zu = fwNetz();
  const r0 = S.sende(zu.d, zu.pc.id, zu.srv.id, {}, 'http');
  assert.equal(r0.ursache, 'firewall'); assert.match(r0.meldung, /Standardrichtlinie „blockieren“/);
  const offen = fwNetz([], 'erlauben');
  assert.equal(S.sende(offen.d, offen.pc.id, offen.srv.id, {}, 'ping').status, 'erfolg');
  const http = fwNetz([ERLAUBE_HTTP]);
  const r1 = S.sende(http.d, http.pc.id, http.srv.id, {}, 'http');
  assert.equal(r1.status, 'erfolg', r1.meldung);
  const fwSchritte = r1.schritte.filter(x => x.art === 'firewall');
  assert.equal(fwSchritte.length, 2);
  assert.match(fwSchritte[0].grund, /erlaubt: Regel 1/);
  assert.match(fwSchritte[1].grund, /zustandsbehaftet/, 'Antwort darf ohne eigene Regel zurück');
  assert.equal(S.sende(http.d, http.pc.id, http.srv.id, {}, 'ping').ursache, 'firewall', 'Ping bleibt blockiert');
  assert.equal(S.sende(http.d, http.pc.id, http.srv.id, {}, 'https').ursache, 'firewall');
  // Server darf von sich aus keine Verbindung ins LAN öffnen (Regel gilt nur in eine Richtung)
  assert.equal(S.sende(http.d, http.srv.id, http.pc.id, {}, 'ping').ursache, 'firewall');
  // Erste passende Regel gewinnt: blockieren vor erlauben
  const zuerst = fwNetz([{ aktion: 'blockieren', quelle: '192.168.1.10', ziel: 'alle', dienst: 'alle' }, ERLAUBE_HTTP]);
  const r2 = S.sende(zuerst.d, zuerst.pc.id, zuerst.srv.id, {}, 'http');
  assert.equal(r2.ursache, 'firewall'); assert.match(r2.meldung, /Regel 1 \(blockieren/);
  M.regelVerschiebe(zuerst.d, zuerst.fw.id, 'f2', -1);
  assert.equal(S.sende(zuerst.d, zuerst.pc.id, zuerst.srv.id, {}, 'http').status, 'erfolg', 'nach dem Umsortieren erlaubt');
  // Deaktivierte und ungültige Regeln zählen nicht
  const aus = fwNetz([{ ...ERLAUBE_HTTP, aktiv: false }]);
  assert.equal(S.sende(aus.d, aus.pc.id, aus.srv.id, {}, 'http').ursache, 'firewall');
  const kaputt = fwNetz([{ ...ERLAUBE_HTTP, quelle: '192.168.1.5/24' }]);
  assert.equal(S.sende(kaputt.d, kaputt.pc.id, kaputt.srv.id, {}, 'http').ursache, 'firewall');
  assert.ok(S.pruefeNetz(kaputt.d).meldungen.some(m => /Regel 1, Quelle: .*keine Netzadresse/.test(m.text)));
  assert.ok(S.pruefeNetz(zu.d).meldungen.some(m => /lässt nichts durch/.test(m.text)));
});

test('31 · Firewall routet wie ein Router (Routen, deaktivierte Schnittstellen) und lässt sich als Gateway nutzen', () => {
  const { d, pc, fw, srv } = fwNetz([], 'erlauben');
  M.setzeIf(d, fw.id, 'g1', 'aktiv', false);
  assert.equal(S.sende(d, pc.id, srv.id).ursache, 'if-deaktiviert');
  M.setzeIf(d, fw.id, 'g1', 'aktiv', true);
  assert.ok(M.routeHinzu(d, fw.id, { ziel: '172.16.0.0', maske: '/16', via: '10.0.0.99' }));
  assert.deepEqual(plain(S.routingTabelle(fw).map(r => r.art)), ['C', 'C', 'S']);
  assert.ok(!S.pruefeNetz(d).meldungen.some(m => /kein Router/.test(m.text)), 'Firewall zählt als Gateway');
  // Regel-Bearbeitung
  const r = M.regelHinzu(d, fw.id, { aktion: 'blockieren', dienst: 'ping' });
  assert.equal(r.id, 'f1');
  assert.ok(M.regelSetze(d, fw.id, 'f1', 'quelle', '192.168.1.0/24'));
  assert.ok(M.regelSetze(d, fw.id, 'f1', 'dienst', 'quatsch'));
  assert.equal(fw.werte.regeln[0].dienst, 'alle', 'unbekannter Dienst → alle');
  assert.equal(M.regelSetze(d, fw.id, 'f1', 'xyz', 1), false);
  assert.equal(M.regelVerschiebe(d, fw.id, 'f1', -1), false, 'erste Regel kann nicht weiter nach oben');
  assert.ok(M.regelLoesche(d, fw.id, 'f1'));
  assert.equal(M.regelHinzu(d, pc.id), null, 'nur Firewalls haben Regeln');
});

test('32 · Dienste: Ping an jedes Endgerät, HTTP/HTTPS nur an Server mit eingeschaltetem Dienst', () => {
  const { d, pc, srv } = fwNetz([], 'erlauben', { web: false, https: true });
  const r = S.sende(d, pc.id, srv.id, {}, 'http');
  assert.equal(r.ursache, 'dienst-aus'); assert.match(r.meldung, /Port 80/);
  assert.ok(!r.schritte.some(x => x.phase === 'antwort'), 'keine Antwort bei abgelehnter Verbindung');
  assert.equal(S.sende(d, pc.id, srv.id, {}, 'https').status, 'erfolg');
  M.setzeWert(d, srv.id, 'dienst:web', true);
  assert.equal(S.sende(d, pc.id, srv.id, {}, 'http').status, 'erfolg');
  assert.match(S.sende(d, pc.id, srv.id, {}, 'http').meldung, /\(HTTP\)/);
  const r2 = S.sende(d, srv.id, pc.id, {}, 'http');
  assert.equal(r2.ursache, 'dienst-aus'); assert.match(r2.meldung, /nur Server/);
  assert.equal(S.sende(d, pc.id, srv.id, {}, 'unbekannt').dienst, 'ping', 'unbekannter Dienst → Ping');
});

test('33 · Lösungen der neuen Aufgaben: WLAN einrichten und Firewall konfigurieren', () => {
  let a = A.finde('wlan'), d = a.bauen();
  const lap = nach(d, 'Laptop1');
  M.setzeWert(d, lap.id, 'ssid', 'Schul-WLAN'); M.setzeWert(d, lap.id, 'schluessel', 'Humboldt2026');
  assert.match(a.pruefe(d).text, /außer Reichweite/);
  M.verschiebe(d, lap.id, nach(d, 'AP1').x + 120, nach(d, 'AP1').y);
  assert.equal(a.pruefe(d).ok, true);
  a = A.finde('firewall'); d = a.bauen();
  const fw = nach(d, 'FW1');
  M.setzeWert(d, fw.id, 'standard', 'erlauben');
  assert.match(a.pruefe(d).text, /Ping zum Webserver ist auch erlaubt/, 'alles öffnen ist keine Lösung');
  M.setzeWert(d, fw.id, 'standard', 'blockieren');
  M.regelHinzu(d, fw.id, { aktion: 'erlauben', dienst: 'alle', quelle: '192.168.1.0/24', ziel: 'alle' });
  assert.equal(a.pruefe(d).ok, false, 'Regel für alle Dienste öffnet auch Ping');
  M.regelSetze(d, fw.id, 'f1', 'dienst', 'http');
  assert.equal(a.pruefe(d).ok, true);
});
