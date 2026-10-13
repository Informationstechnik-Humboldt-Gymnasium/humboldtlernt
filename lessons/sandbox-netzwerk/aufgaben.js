// Netzwerk-Labor · Lernaufgaben (reproduzierbare Szenarien, kein DOM)
//
// Jede Aufgabe: { id, titel, beschreibung, hinweise: [...], ziel, erklaerung, bauen() → doc, pruefe(doc) → { ok, text } }
// Die Szenarien sind fest gebaut (keine Zufallswerte). Fehler sind gezielt eingebaut. Geprüft wird immer über die
// Simulation SL.netzsim.sende – also am tatsächlichen Netzwerkmodell, nie an der Zeichnung.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});
  var M = function () { return SL.modell; }, S = function () { return SL.netzsim; };

  /** Gerät mit Konfiguration anlegen. ifs: { port: [ip, maske, aktiv?] } */
  function geraet(doc, typ, name, x, y, ifs, extra) {
    var w = { ifs: {} };
    Object.keys(ifs || {}).forEach(function (p) { w.ifs[p] = { ip: ifs[p][0], maske: ifs[p][1], aktiv: ifs[p][2] !== false }; });
    Object.keys(extra || {}).forEach(function (k) { w[k] = extra[k]; });
    var b = M().bauteil(doc, typ, x, y, w);
    M().setzeName(doc, b.id, name);
    return b;
  }
  function kabel(doc, a, pa, b, pb) { var r = M().verbinde(doc, { b: a.id, a: pa }, { b: b.id, a: pb }); if (!r.ok) throw new Error(r.grund); }
  function nachName(doc, name) { return doc.bauteile.filter(function (b) { return b.name === name; })[0] || null; }

  /** Prüft Verbindungen zwischen benannten Geräten. bedingung(ergebnis) optional, z. B. „Weg über einen Router“. */
  function verbindungen(doc, paare, bedingung) {
    for (var i = 0; i < paare.length; i++) {
      var a = nachName(doc, paare[i][0]), b = nachName(doc, paare[i][1]);
      if (!a || !b) return { ok: false, text: 'Das Gerät „' + (a ? paare[i][1] : paare[i][0]) + '“ fehlt. Benenne ein Gerät so oder lade die Aufgabe neu.' };
      var r = S().sende(doc, a.id, b.id, {});
      if (r.status !== 'erfolg') return { ok: false, text: paare[i][0] + ' → ' + paare[i][1] + ': ' + r.meldung };
      if (bedingung) { var t = bedingung(doc, r); if (t) return { ok: false, text: paare[i][0] + ' → ' + paare[i][1] + ': ' + t }; }
    }
    return { ok: true };
  }
  var ueber = function (typ, name) {
    return function (doc, r) {
      return r.pfad.some(function (st) { var b = M().finde(doc, st.nach.b); return b && b.typ === typ; }) ? null : 'Die Verbindung klappt, läuft aber nicht über einen ' + name + '.';
    };
  };

  var AUFGABEN = [
    {
      id: 'zwei-pcs', titel: '1 · Zwei PCs verbinden',
      beschreibung: 'Verbinde PC1 und PC2 über den Switch SW1. Gib beiden PCs passende IP-Adressen im selben Subnetz und teste die Verbindung.',
      hinweise: ['Ziehe von eth0 eines PCs zu einem freien Port des Switches – oder tippe beide Anschlüsse nacheinander an.',
        'Wähle einen PC aus und trage rechts IP-Adresse und Subnetzmaske ein, z. B. 192.168.1.10 und /24.',
        'Im selben Subnetz sind die ersten drei Zahlen bei /24 gleich, die letzte unterscheidet sich: 192.168.1.10 und 192.168.1.20.'],
      ziel: 'PC1 erreicht PC2 über einen Switch (und die Antwort kommt zurück).',
      erklaerung: 'Ein Switch verbindet Geräte innerhalb eines Netzes. Damit sie sich direkt erreichen, müssen beide im selben Subnetz liegen – ein Router ist dafür nicht nötig. Der Switch lernt beim ersten Rahmen, an welchem Port welche MAC-Adresse hängt.',
      bauen: function () {
        var d = M().neu();
        geraet(d, 'pc', 'PC1', -200, -60); geraet(d, 'pc', 'PC2', 200, -60); geraet(d, 'switch', 'SW1', 0, 100);
        return d;
      },
      pruefe: function (doc) { return verbindungen(doc, [['PC1', 'PC2']], ueber('switch', 'Switch')); },
    },
    {
      id: 'subnetz', titel: '2 · Subnetzfehler beheben',
      beschreibung: 'PC1 und PC2 hängen am selben Switch, können sich aber nicht erreichen. Finde den Fehler in der IP-Konfiguration und korrigiere ihn.',
      hinweise: ['Teste zuerst die Verbindung PC1 → PC2 und lies die Fehlermeldung.', 'Vergleiche die Netzadressen beider PCs. Bei /24 bestimmen die ersten drei Zahlen das Netz.',
        'Ändere die Adresse eines PCs so, dass beide im selben Netz liegen (eine Adresse, die noch niemand hat).'],
      ziel: 'PC1 erreicht PC2.',
      erklaerung: '192.168.1.10/24 liegt im Netz 192.168.1.0/24, 192.168.2.20/24 im Netz 192.168.2.0/24. Für PC1 liegt PC2 damit „woanders“, und ohne Router und Gateway gibt es keinen Weg. Gleiches Kabel reicht nicht – die IP-Konfiguration muss auch passen.',
      bauen: function () {
        var d = M().neu();
        var a = geraet(d, 'pc', 'PC1', -200, -60, { eth0: ['192.168.1.10', '/24'] });
        var b = geraet(d, 'pc', 'PC2', 200, -60, { eth0: ['192.168.2.20', '/24'] });
        var s = geraet(d, 'switch', 'SW1', 0, 100);
        kabel(d, a, 'eth0', s, 'p1'); kabel(d, b, 'eth0', s, 'p8');
        return d;
      },
      pruefe: function (doc) { return verbindungen(doc, [['PC1', 'PC2']]); },
    },
    {
      id: 'zwei-netze', titel: '3 · Zwei Netzwerke verbinden',
      beschreibung: 'Links liegt das Netz 192.168.1.0/24, rechts 192.168.2.0/24. Verbinde beide Netze mit dem Router R1: Kabel stecken, Router-Schnittstellen konfigurieren und bei beiden PCs das Standardgateway eintragen.',
      hinweise: ['Verbinde SW1 mit g0 und SW2 mit g1 des Routers.', 'Jede Router-Schnittstelle bekommt eine freie Adresse im jeweiligen Netz, üblich ist .1: g0 = 192.168.1.1/24, g1 = 192.168.2.1/24.',
        'Das Standardgateway eines PCs ist die Adresse der Router-Schnittstelle in seinem Netz.'],
      ziel: 'PC1 erreicht PC2 über den Router.',
      erklaerung: 'Ein Router verbindet verschiedene IP-Netze. Jede seiner Schnittstellen gehört zu einem Netz. Ein PC schickt alles, was nicht in seinem eigenen Netz liegt, an sein Standardgateway. Beide direkt angeschlossenen Netze kennt der Router automatisch – eine zusätzliche Route braucht er hier nicht.',
      bauen: function () {
        var d = M().neu();
        var a = geraet(d, 'pc', 'PC1', -340, -80, { eth0: ['192.168.1.10', '/24'] });
        var s1 = geraet(d, 'switch', 'SW1', -260, 100);
        var b = geraet(d, 'pc', 'PC2', 340, -80, { eth0: ['192.168.2.10', '/24'] });
        var s2 = geraet(d, 'switch', 'SW2', 260, 100);
        geraet(d, 'router', 'R1', 0, -60);
        kabel(d, a, 'eth0', s1, 'p1'); kabel(d, b, 'eth0', s2, 'p8');
        return d;
      },
      pruefe: function (doc) { return verbindungen(doc, [['PC1', 'PC2']], ueber('router', 'Router')); },
    },
    {
      id: 'routing', titel: '4 · Routing reparieren',
      beschreibung: 'Zwei Netze sind über zwei Router verbunden. Alle Kabel und Adressen stimmen, trotzdem klappt der Ping von PC1 zu PC2 nicht. Untersuche die Routing-Tabellen und ergänze die fehlende Route.',
      hinweise: ['Starte eine Paketsimulation von PC1 nach PC2 und verfolge, wo das Paket hängen bleibt.',
        'Die Anfrage kommt an – aber findet die Antwort den Weg zurück? Jeder Router braucht Routen in BEIDE Richtungen.',
        'R2 braucht eine Route zum Netz 192.168.1.0/24 über die Adresse von R1 im Transfernetz (10.0.0.1).'],
      ziel: 'PC1 erreicht PC2 (Hin- und Rückweg).',
      erklaerung: 'R1 kennt den Weg zu 192.168.2.0/24, R2 aber nicht den Weg zurück zu 192.168.1.0/24. Ein Ping braucht eine Antwort – fehlt der Rückweg, scheitert die Verbindung, obwohl die Anfrage ankommt. Statische Routen müssen deshalb auf jedem Router für jedes nicht direkt angeschlossene Netz eingetragen werden.',
      bauen: function () {
        var d = M().neu();
        var a = geraet(d, 'pc', 'PC1', -380, -40, { eth0: ['192.168.1.10', '/24'] }, { gateway: '192.168.1.1' });
        var r1 = geraet(d, 'router', 'R1', -140, -40, { g0: ['192.168.1.1', '/24'], g1: ['10.0.0.1', '/30'] }, { routen: [{ ziel: '192.168.2.0', maske: '/24', via: '10.0.0.2', aktiv: true }] });
        var r2 = geraet(d, 'router', 'R2', 140, -40, { g0: ['10.0.0.2', '/30'], g1: ['192.168.2.1', '/24'] }, { routen: [] });
        var b = geraet(d, 'pc', 'PC2', 380, -40, { eth0: ['192.168.2.10', '/24'] }, { gateway: '192.168.2.1' });
        kabel(d, a, 'eth0', r1, 'g0'); kabel(d, r1, 'g1', r2, 'g0'); kabel(d, r2, 'g1', b, 'eth0');
        return d;
      },
      pruefe: function (doc) { return verbindungen(doc, [['PC1', 'PC2']]); },
    },
    {
      id: 'debuggen', titel: '5 · Netzwerk debuggen',
      beschreibung: 'Im Schulnetz sollen PC1 und PC2 den Server erreichen. Im Netz stecken zwei Fehler. Finde und behebe beide.',
      hinweise: ['„Netzwerk prüfen“ zeigt Konfigurationsprobleme aller Geräte auf einen Blick.', 'Teste PC1 → Server und PC2 → Server einzeln. Die Fehlermeldungen nennen das betroffene Gerät.',
        'Prüfe die Gateways der PCs und den Status der Router-Schnittstellen.'],
      ziel: 'PC1 und PC2 erreichen beide den Server.',
      erklaerung: 'Fehler 1: PC2 hatte 192.168.1.254 als Gateway eingetragen – unter dieser Adresse gibt es aber kein Gerät; der Router hat 192.168.1.1. Fehler 2: Die Router-Schnittstelle g1 zum Servernetz war deaktiviert. Systematisch vorgehen hilft: erst die Konfiguration prüfen, dann jede Verbindung einzeln testen.',
      bauen: function () {
        var d = M().neu();
        var p1 = geraet(d, 'pc', 'PC1', -380, -100, { eth0: ['192.168.1.11', '/24'] }, { gateway: '192.168.1.1' });
        var p2 = geraet(d, 'pc', 'PC2', -380, 80, { eth0: ['192.168.1.12', '/24'] }, { gateway: '192.168.1.254' });
        var s1 = geraet(d, 'switch', 'SW1', -200, -10);
        var r = geraet(d, 'router', 'R1', 20, -10, { g0: ['192.168.1.1', '/24'], g1: ['192.168.10.1', '/24', false] }, { routen: [] });
        var s2 = geraet(d, 'switch', 'SW2', 240, -10);
        var srv = geraet(d, 'server', 'Server', 380, -150, { eth0: ['192.168.10.5', '/24'] }, { gateway: '192.168.10.1', dns: '' });
        kabel(d, p1, 'eth0', s1, 'p1'); kabel(d, p2, 'eth0', s1, 'p2'); kabel(d, s1, 'p8', r, 'g0');
        kabel(d, r, 'g1', s2, 'p1'); kabel(d, s2, 'p8', srv, 'eth0');
        return d;
      },
      pruefe: function (doc) { return verbindungen(doc, [['PC1', 'Server'], ['PC2', 'Server']]); },
    },
  ];

  SL.netzAufgaben = { liste: AUFGABEN, finde: function (id) { return AUFGABEN.filter(function (a) { return a.id === id; })[0] || null; } };
})(typeof window !== 'undefined' ? window : globalThis);
