// Netzwerk-Labor · Simulation (pädagogisches Modell, kein echter Netzwerkverkehr, kein DOM)
//
// SL.netzsim.sende(doc, quelleId, zielId, macTab?) – simuliert ein Ping-Paket (Anfrage UND Antwort) Hop für Hop:
//   1. Endgerät: Ziel im eigenen Netz? → direkt zustellen, sonst an das Standardgateway.
//   2. Schicht 2: Vom Ausgangsanschluss über Kabel und Switches das Gerät mit der IP des nächsten Hops suchen.
//      Switches lernen Absender-MAC-Adressen und fluten Rahmen an unbekannte Ziele (vereinfachtes MAC-Lernen).
//   3. Router: direkt angeschlossenes Netz (längster Präfix) oder passende statische Route (längster Präfix).
//   4. Am Ziel: Antwort auf demselben Weg zurück prüfen.
// Ergebnis: { status: 'erfolg' | 'fehler' | 'unklar', meldung, ursache, schritte: [...], pfad: [...], ablauf: [...], mac }
//   ablauf: Reihenfolge für die Animation – { typ: 'schritt', i } (Gerät entscheidet) und { typ: 'kabel', i } (Paket auf Kabel pfad[i])
//   ursache (Kennwort für Tests/Aufgaben): kein-kabel, ip-ungueltig, ziel-ip-ungueltig, gateway-fehlt, subnetz, gateway-falsch,
//   gateway-unerreichbar, keine-verbindung, if-deaktiviert, keine-route, route-deaktiviert, route-falsch, ttl, ip-doppelt,
//   schleife, gleiches-geraet, kein-endgeraet, unbekannt
// SL.netzsim.pruefeNetz(doc) – Konfigurationsprüfung aller Geräte und Übersicht, welche Endgeräte sich erreichen.
//
// Nicht simuliert (bewusst): ARP-Tabellen, TTL-Werte im Paket, VLANs, DHCP, DNS-Auflösung, NAT, Firewalls,
// Spanning Tree, Übertragungszeiten, Paketverlust. Bei Switch-Schleifen meldet die Simulation „unklar“.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});
  var M = function () { return SL.modell; }, IP = function () { return SL.ip; };
  var MAX_HOPS = 16;

  function istEnd(b) { return b && SL.TYPEN[b.typ] && !!SL.TYPEN[b.typ].endgeraet; }
  function hatIfs(b) { return b && b.werte && b.werte.ifs; }

  /** Konfiguration einer Schnittstelle: { aktiv, host: SL.ip.host(...) }. */
  function konfig(b, port) {
    var f = b.werte.ifs[port];
    return { aktiv: f.aktiv !== false, host: IP().host(f.ip, f.maske), ipText: f.ip, maskeText: f.maske };
  }
  function cidr(h) { return IP().info(h.ip, h.praefix).cidr; }
  function ipVon(b, port) { var h = konfig(b, port).host; return h.ok ? h.ip : null; }

  /**
   * Schicht-2-Segment ab einem Anschluss: alle über Kabel und Switches erreichbaren Endpunkte (Router- oder
   * Endgeräte-Anschlüsse) mit dem Weg dorthin. Liefert { endpunkte: [{ ref, pfad }], schleife }.
   * pfad: [{ draht, von: ref, nach: ref }] – jedes Kabelstück in Laufrichtung.
   */
  function segment(doc, start) {
    var out = { endpunkte: [], schleife: false }, besucht = {};
    var d0 = M().kabelAn(doc, start);
    if (!d0) return out;
    var schlange = [{ ref: start, pfad: [] }];
    while (schlange.length) {
      var x = schlange.shift(), d = M().kabelAn(doc, x.ref);
      if (!d) continue;
      var weiter = M().gegenstelle(doc, x.ref), b = M().finde(doc, weiter.b);
      var pfad = x.pfad.concat([{ draht: d.id, von: x.ref, nach: weiter }]);
      if (b.typ === 'switch') {
        if (besucht[b.id]) { out.schleife = true; continue; }
        besucht[b.id] = true;
        Object.keys(M().ports(b)).forEach(function (p) {
          if (p !== weiter.a && M().kabelAn(doc, { b: b.id, a: p })) schlange.push({ ref: { b: b.id, a: p }, pfad: pfad });
        });
      } else out.endpunkte.push({ ref: weiter, pfad: pfad });
    }
    return out;
  }

  // ------------------------------------------------------------ Paket weiterleiten (eine Richtung)
  function Lauf(doc, macTab, phase, ergebnis) { this.doc = doc; this.mac = macTab; this.phase = phase; this.e = ergebnis; }

  Lauf.prototype.schritt = function (s) { s.phase = this.phase; this.e.schritte.push(s); this.e.ablauf.push({ typ: 'schritt', i: this.e.schritte.length - 1 }); return s; };
  Lauf.prototype.fehler = function (b, ursache, text) {
    this.schritt({ geraet: b ? b.id : null, name: b ? b.name : '', art: 'fehler', grund: text });
    return { ok: false, ursache: ursache, text: text };
  };

  /** Schicht-2-Weg ablaufen: Kabelstücke ins Ergebnis, Switch-Schritte mit MAC-Lernen. */
  Lauf.prototype.l2 = function (pfad, quelleMac, zielMac) {
    var self = this, doc = this.doc;
    pfad.forEach(function (st, k) {
      self.e.pfad.push({ draht: st.draht, von: st.von, nach: st.nach, phase: self.phase });
      self.e.ablauf.push({ typ: 'kabel', i: self.e.pfad.length - 1 });
      var b = M().finde(doc, st.nach.b);
      if (b.typ !== 'switch') return;
      var aus = pfad[k + 1].von.a, tab = self.mac[b.id] || (self.mac[b.id] = {});
      var bekannt = tab[zielMac] === aus;
      tab[quelleMac] = st.nach.a;   // Absender lernen
      self.schritt({ geraet: b.id, name: b.name, art: 'switch', schnittstelle: M().anschlussName(b, st.nach.a) + ' → ' + M().anschlussName(b, aus),
        naechster: M().finde(doc, pfad[pfad.length - 1].nach.b).name,
        grund: bekannt ? 'Ziel-MAC ' + zielMac + ' steht in der MAC-Tabelle an ' + M().anschlussName(b, aus) + ' – gezielt weitergeleitet.'
          : 'Ziel-MAC ' + zielMac + ' ist noch unbekannt – der Rahmen wird an alle anderen belegten Ports geflutet und kommt über ' + M().anschlussName(b, aus) + ' an. Absender-MAC ' + quelleMac + ' gelernt (an ' + M().anschlussName(b, st.nach.a) + ').' });
    });
  };

  /**
   * Leitet ein Paket von Gerät quelle an die IP dst weiter, bis es beim Gerät ziel ankommt.
   * Liefert { ok, ursache, text } bzw. { ok: true }.
   */
  Lauf.prototype.laufe = function (quelle, ziel, dst) {
    var doc = this.doc, cur = quelle, ein = null, gw = null, schleife = false;
    var dstText = IP().text(dst);
    for (var hop = 0; hop <= MAX_HOPS; hop++) {
      var aus, naechster, grund;
      if (istEnd(cur)) {
        var k = konfig(cur, 'eth0');
        if (!k.host.ok) return this.fehler(cur, 'ip-ungueltig', 'Die IP-Konfiguration von ' + cur.name + ' ist ungültig: ' + k.host.fehler[0]);
        if (!k.aktiv) return this.fehler(cur, 'if-deaktiviert', 'Eine benötigte Schnittstelle ist deaktiviert: ' + cur.name + ' (eth0).');
        var eigen = k.host;
        if (IP().gleichesNetz(dst, eigen.ip, eigen.praefix)) {
          naechster = dst; aus = 'eth0';
          grund = dstText + ' liegt im eigenen Netz ' + cidr(eigen) + ' → direkt zustellen.';
        } else {
          var gwText = cur.werte.gateway;
          if (!gwText) {
            // Ist das Ziel trotzdem über Kabel/Switch erreichbar? Dann ist es ein Subnetzfehler, kein fehlendes Kabel.
            var seg = segment(doc, { b: cur.id, a: 'eth0' });
            var nah = seg.endpunkte.filter(function (p) { return p.ref.b === ziel.id; })[0];
            var zh = konfig(ziel, 'eth0').host;
            if (nah) return this.fehler(cur, 'subnetz', cur.name + ' und ' + ziel.name + ' sind direkt verbunden, befinden sich laut IP-Konfiguration aber in unterschiedlichen Subnetzen (' + cidr(eigen) +
              ' und ' + (zh.ok ? cidr(zh) : dstText) + '). Ohne Standardgateway kann ' + cur.name + ' das Ziel nicht erreichen. Prüfe IP-Adressen und Subnetzmasken.');
            return this.fehler(cur, 'gateway-fehlt', 'Das Ziel ' + dstText + ' liegt nicht im eigenen Netz ' + cidr(eigen) + ' von ' + cur.name + ', und es ist kein Standardgateway eingetragen. Die Geräte befinden sich in unterschiedlichen Subnetzen.');
          }
          var g = IP().adresse(gwText);
          if (!g.ok) return this.fehler(cur, 'gateway-falsch', 'Das Standardgateway von ' + cur.name + ' ist nicht korrekt konfiguriert: ' + g.fehler);
          if (!IP().gleichesNetz(g.wert, eigen.ip, eigen.praefix)) return this.fehler(cur, 'gateway-falsch', 'Das Standardgateway ist nicht korrekt konfiguriert: ' + g.text + ' liegt nicht im eigenen Netz ' + cidr(eigen) + ' von ' + cur.name + '. Ein Gateway muss im selben Subnetz liegen.');
          if (g.wert === eigen.ip) return this.fehler(cur, 'gateway-falsch', 'Das Standardgateway ist nicht korrekt konfiguriert: ' + cur.name + ' hat seine eigene Adresse ' + g.text + ' als Gateway eingetragen.');
          naechster = g.wert; aus = 'eth0'; gw = g.wert;
          grund = dstText + ' liegt nicht im eigenen Netz ' + cidr(eigen) + ' → an das Standardgateway ' + g.text + '.';
        }
        this.schritt({ geraet: cur.id, name: cur.name, art: cur === quelle ? 'start' : 'info', schnittstelle: 'eth0', naechster: IP().text(naechster), grund: grund });
      } else if (cur.typ === 'router') {
        var r = this.route(cur, dst, ein);
        if (!r.ok) return r;
        aus = r.aus; naechster = r.naechster;
        this.schritt({ geraet: cur.id, name: cur.name, art: 'router', schnittstelle: r.ein + ' → ' + r.aus, naechster: IP().text(naechster), grund: r.grund });
      } else return this.fehler(cur, 'unbekannt', 'Unerwarteter Gerätetyp im Weg.');

      // Schicht 2: Gerät mit der IP „naechster“ im Segment hinter „aus“ suchen
      if (!M().kabelAn(doc, { b: cur.id, a: aus })) return this.fehler(cur, 'kein-kabel', 'Keine direkte Verbindung: An ' + cur.name + ' (' + M().anschlussName(cur, aus) + ') ist kein Kabel angeschlossen.');
      var segm = segment(doc, { b: cur.id, a: aus });
      if (segm.schleife) schleife = true;
      var kandidaten = segm.endpunkte.filter(function (p) {
        var b = M().finde(doc, p.ref.b), a = IP().adresse(b.werte.ifs[p.ref.a].ip);
        return a.ok && a.wert === naechster;
      });
      var nhText = IP().text(naechster);
      if (kandidaten.length > 1) {
        var namen = kandidaten.map(function (p) { return M().finde(doc, p.ref.b).name; }).join(' und ');
        this.schritt({ geraet: cur.id, name: cur.name, art: 'fehler', grund: 'Die Adresse ' + nhText + ' ist im Netzsegment mehrfach vergeben (' + namen + ').' });
        return { ok: false, unklar: true, ursache: 'ip-doppelt', text: 'Die IP-Adresse ' + nhText + ' ist mehrfach vergeben (' + namen + '). Welches Gerät antwortet, ist nicht festgelegt – das Ergebnis ist unklar.' };
      }
      if (!kandidaten.length) {
        if (istEnd(cur) && gw !== null && naechster === gw) return this.fehler(cur, 'gateway-unerreichbar', 'Das Standardgateway ist nicht korrekt konfiguriert: Unter ' + nhText + ' ist von ' + cur.name + ' aus kein Gerät erreichbar.');
        if (istEnd(cur)) {
          var zielIrgendwo = naechster === dst;
          return this.fehler(cur, 'keine-verbindung', zielIrgendwo ? 'Keine direkte Verbindung zwischen den Geräten: ' + ziel.name + ' ist im gleichen Subnetz eingetragen, aber nicht über Kabel oder Switch mit ' + cur.name + ' verbunden.'
            : 'Keine Verbindung zu ' + nhText + '.');
        }
        return this.fehler(cur, naechster === dst ? 'keine-verbindung' : 'route-falsch', naechster === dst
          ? cur.name + ' erreicht ' + nhText + ' nicht: Im Netz an ' + M().anschlussName(cur, aus) + ' hat kein Gerät diese Adresse.'
          : 'Der nächste Hop ' + nhText + ' (laut Route von ' + cur.name + ') ist im Netz an ' + M().anschlussName(cur, aus) + ' nicht erreichbar.');
      }
      var treffer = kandidaten[0], nb = M().finde(doc, treffer.ref.b), nk = konfig(nb, treffer.ref.a);
      if (!nk.host.ok) return this.fehler(nb, 'ip-ungueltig', 'Die IP-Konfiguration von ' + nb.name + ' (' + M().anschlussName(nb, treffer.ref.a) + ') ist ungültig: ' + nk.host.fehler[0]);
      if (!nk.aktiv) return this.fehler(nb, 'if-deaktiviert', 'Eine benötigte Schnittstelle ist deaktiviert: ' + nb.name + ' (' + M().anschlussName(nb, treffer.ref.a) + ').');
      this.l2(treffer.pfad, M().mac(cur, aus), M().mac(nb, treffer.ref.a));
      if (nb.id === ziel.id && naechster === dst) {
        this.schritt({ geraet: nb.id, name: nb.name, art: 'ziel', schnittstelle: M().anschlussName(nb, treffer.ref.a), grund: this.phase === 'anfrage' ? 'Paket an ' + dstText + ' angekommen.' : 'Antwort angekommen.' });
        return { ok: true, schleife: schleife };
      }
      if (naechster === dst) {
        // Gerät mit der Ziel-IP gefunden, aber es ist nicht das gewählte Ziel → doppelte Adresse im Netz
        return { ok: false, unklar: true, ursache: 'ip-doppelt', text: 'Die Adresse ' + dstText + ' gehört auch ' + nb.name + '. Weil sie mehrfach vergeben ist, ist das Ergebnis unklar.' };
      }
      if (istEnd(nb)) return this.fehler(nb, 'gateway-falsch', 'Das Standardgateway ist nicht korrekt konfiguriert: ' + nhText + ' gehört zu ' + nb.name + ' (' + SL.TYPEN[nb.typ].name + ') – das ist kein Router.');
      cur = nb; ein = treffer.ref.a;   // Eingangsschnittstelle merken, ohne das Modell zu verändern
    }
    return this.fehler(cur, 'ttl', 'Routing-Schleife: Das Paket wird zwischen Routern hin- und hergeschickt und erreicht das Ziel nicht (mehr als ' + MAX_HOPS + ' Router).');
  };

  /** Routing-Entscheidung eines Routers für dst. */
  Lauf.prototype.route = function (r, dst, einPort) {
    var ein = einPort ? M().anschlussName(r, einPort) : '?', dstText = IP().text(dst);
    var direkt = [], direktAus = [];
    Object.keys(r.werte.ifs).forEach(function (p) {
      var k = konfig(r, p);
      if (!k.host.ok || !IP().gleichesNetz(dst, k.host.ip, k.host.praefix)) return;
      (k.aktiv ? direkt : direktAus).push({ p: p, praefix: k.host.praefix, h: k.host });
    });
    direkt.sort(function (a, b) { return b.praefix - a.praefix; });
    if (direkt.length) return { ok: true, ein: ein, aus: direkt[0].p, naechster: dst, grund: 'Das Zielnetz ' + cidr(direkt[0].h) + ' ist direkt an ' + direkt[0].p + ' angeschlossen → direkt zustellen.' };
    if (direktAus.length) return this.fehler(r, 'if-deaktiviert', 'Eine benötigte Schnittstelle ist deaktiviert: Das Zielnetz ' + cidr(direktAus[0].h) + ' hängt an ' + r.name + ' (' + direktAus[0].p + '), die Schnittstelle ist aber abgeschaltet.');

    var passend = [], ausgeschaltet = [];
    r.werte.routen.forEach(function (rt) {
      var n = IP().netzangabe(rt.ziel, rt.maske), v = IP().adresse(rt.via);
      if (!n.ok || !v.ok || !IP().gleichesNetz(dst, n.netz, n.praefix)) return;
      (rt.aktiv ? passend : ausgeschaltet).push({ rt: rt, praefix: n.praefix, via: v.wert, text: IP().text(n.netz) + '/' + n.praefix });
    });
    passend.sort(function (a, b) { return b.praefix - a.praefix; });
    if (!passend.length) {
      if (ausgeschaltet.length) return this.fehler(r, 'route-deaktiviert', r.name + ' hat eine passende Route (' + ausgeschaltet[0].text + ' über ' + IP().text(ausgeschaltet[0].via) + '), sie ist aber deaktiviert.');
      return this.fehler(r, 'keine-route', 'Die Geräte befinden sich in unterschiedlichen Subnetzen und es fehlt eine passende Route: ' + r.name + ' kennt keinen Weg zu ' + dstText + ' (kein direkt angeschlossenes Netz, keine passende Route).');
    }
    var best = passend[0], vText = IP().text(best.via), ausP = null, ausAus = null;
    Object.keys(r.werte.ifs).forEach(function (p) {
      var k = konfig(r, p);
      if (!k.host.ok || !IP().gleichesNetz(best.via, k.host.ip, k.host.praefix)) return;
      if (k.aktiv) ausP = ausP || p; else ausAus = ausAus || p;
    });
    if (!ausP && ausAus) return this.fehler(r, 'if-deaktiviert', 'Eine benötigte Schnittstelle ist deaktiviert: Der nächste Hop ' + vText + ' liegt an ' + r.name + ' (' + ausAus + '), die Schnittstelle ist abgeschaltet.');
    if (!ausP) return this.fehler(r, 'route-falsch', 'Die Route ' + best.text + ' von ' + r.name + ' ist fehlerhaft: Der nächste Hop ' + vText + ' liegt in keinem direkt angeschlossenen Netz.');
    return { ok: true, ein: ein, aus: ausP, naechster: best.via, grund: 'Route ' + best.text + ' passt (längster Präfix) → weiter an ' + vText + ' über ' + ausP + '.' };
  };

  // ------------------------------------------------------------ Ping (Anfrage + Antwort)
  function sende(doc, quelleId, zielId, macTab) {
    var e = { status: 'fehler', meldung: '', ursache: '', schritte: [], pfad: [], ablauf: [], mac: macTab || {} };
    var q = M().finde(doc, quelleId), z = M().finde(doc, zielId);
    var ende = function (status, ursache, text) { e.status = status; e.ursache = ursache; e.meldung = text; return e; };
    if (!q || !z) return ende('fehler', 'unbekannt', 'Wähle ein Quell- und ein Zielgerät aus.');
    if (!istEnd(q) || !istEnd(z)) return ende('fehler', 'kein-endgeraet', 'Quelle und Ziel müssen PCs oder Server sein. Switches und Router leiten nur weiter.');
    if (q.id === z.id) return ende('fehler', 'gleiches-geraet', 'Quelle und Ziel sind dasselbe Gerät.');
    var kz = konfig(z, 'eth0');
    if (!kz.host.ok) return ende('fehler', 'ziel-ip-ungueltig', 'Die IP-Adresse ist ungültig: ' + z.name + ' hat keine gültige IP-Konfiguration (' + kz.host.fehler[0] + ')');
    var kq = konfig(q, 'eth0');
    if (!kq.host.ok) { e.schritte.push({ geraet: q.id, name: q.name, art: 'fehler', phase: 'anfrage', grund: kq.host.fehler[0] }); e.ablauf.push({ typ: 'schritt', i: 0 }); return ende('fehler', 'ip-ungueltig', 'Die IP-Adresse ist ungültig: ' + q.name + ' hat keine gültige IP-Konfiguration (' + kq.host.fehler[0] + ')'); }

    if (kq.host.ip === kz.host.ip) return ende('unklar', 'ip-doppelt', q.name + ' und ' + z.name + ' haben dieselbe IP-Adresse ' + IP().text(kq.host.ip) + '. Bei einem Adresskonflikt ist nicht festgelegt, welches Gerät antwortet – das Ergebnis ist unklar. Jede Adresse darf im Netz nur einmal vorkommen.');
    var hin = new Lauf(doc, e.mac, 'anfrage', e).laufe(q, z, kz.host.ip);
    if (!hin.ok) return ende(hin.unklar ? 'unklar' : 'fehler', hin.ursache, hin.text);
    var zurueck = new Lauf(doc, e.mac, 'antwort', e).laufe(z, q, kq.host.ip);
    if (!zurueck.ok) return ende(zurueck.unklar ? 'unklar' : 'fehler', zurueck.ursache, 'Die Anfrage kommt bei ' + z.name + ' an, aber die Antwort nicht zurück: ' + zurueck.text);
    if (hin.schleife || zurueck.schleife) return ende('unklar', 'schleife', 'Ein Weg wurde gefunden, aber zwischen den Switches gibt es eine Schleife. In einem echten Netz kreisen Broadcasts dann endlos (dagegen hilft das Spanning-Tree-Protokoll, das hier nicht simuliert wird). Das Ergebnis ist deshalb unklar.');
    return ende('erfolg', '', 'Verbindung erfolgreich: ' + q.name + ' erreicht ' + z.name + ', und die Antwort kommt zurück.');
  }

  // ------------------------------------------------------------ Netzwerk prüfen
  function pruefeNetz(doc) {
    var liste = [], push = function (art, b, text) { liste.push({ art: art, geraet: b ? b.id : null, text: (b ? b.name + ': ' : '') + text }); };
    var v = M().validiere(doc);
    v.fehler.forEach(function (t) { push('fehler', null, t); });
    if (!doc.bauteile.length) { push('hinweis', null, 'Das Netzwerk ist leer. Ziehe Geräte aus der Leiste auf die Arbeitsfläche.'); return { meldungen: liste, erreichbar: [] }; }
    var ips = {};
    doc.bauteile.forEach(function (b) {
      if (!hatIfs(b)) return;
      var netze = [];
      Object.keys(b.werte.ifs).forEach(function (p) {
        var f = b.werte.ifs[p], kabel = !!M().kabelAn(doc, { b: b.id, a: p }), name = M().anschlussName(b, p);
        if (!f.ip && !f.maske) { if (kabel || istEnd(b)) push('warnung', b, name + ' hat noch keine IP-Adresse.'); return; }
        var h = IP().host(f.ip, f.maske);
        if (!h.ok) { h.fehler.forEach(function (t) { push('fehler', b, name + ': ' + t); }); return; }
        if (!f.aktiv) push('warnung', b, 'Die Schnittstelle ' + name + ' ist deaktiviert.');
        if (!kabel) push('hinweis', b, name + ' ist konfiguriert, aber kein Kabel ist angeschlossen.');
        (ips[h.ip] = ips[h.ip] || []).push(b.name + (istEnd(b) ? '' : ' (' + name + ')'));
        netze.forEach(function (n) { if (IP().netz(h.ip, Math.min(h.praefix, n.h.praefix)) === IP().netz(n.h.ip, Math.min(h.praefix, n.h.praefix))) push('fehler', b, name + ' und ' + n.p + ' liegen im selben bzw. in überlappenden Netzen (' + cidr(h) + ', ' + cidr(n.h) + '). Jede Router-Schnittstelle braucht ein eigenes Netz.'); });
        netze.push({ p: name, h: h });
      });
      if (istEnd(b)) {
        var k = konfig(b, 'eth0');
        if (b.werte.gateway) {
          var g = IP().adresse(b.werte.gateway);
          if (!g.ok) push('fehler', b, 'Standardgateway: ' + g.fehler);
          else if (k.host.ok && !IP().gleichesNetz(g.wert, k.host.ip, k.host.praefix)) push('fehler', b, 'Das Standardgateway ' + g.text + ' liegt nicht im eigenen Netz ' + cidr(k.host) + '.');
          else if (k.host.ok && M().kabelAn(doc, { b: b.id, a: 'eth0' })) {
            // Gibt es unter der Gateway-Adresse im angeschlossenen Segment überhaupt einen Router?
            var gwGeraet = segment(doc, { b: b.id, a: 'eth0' }).endpunkte.map(function (p) { return { g: M().finde(doc, p.ref.b), p: p.ref.a }; })
              .filter(function (x) { return ipVon(x.g, x.p) === g.wert; })[0];
            if (!gwGeraet) push('fehler', b, 'Unter dem Standardgateway ' + g.text + ' ist im angeschlossenen Netz kein Gerät erreichbar.');
            else if (gwGeraet.g.typ !== 'router') push('fehler', b, 'Das Standardgateway ' + g.text + ' gehört zu ' + gwGeraet.g.name + ' – das ist kein Router.');
          }
        }
        if (b.werte.dns) { var dn = IP().adresse(b.werte.dns); if (!dn.ok) push('fehler', b, 'DNS-Server: ' + dn.fehler); }
        if (!M().kabelAn(doc, { b: b.id, a: 'eth0' })) push('warnung', b, 'Kein Kabel angeschlossen.');
      }
      if (b.typ === 'router') b.werte.routen.forEach(function (rt) {
        var n = IP().netzangabe(rt.ziel, rt.maske), vv = IP().adresse(rt.via), was = 'Route ' + (rt.ziel || '?') + '/' + (rt.maske || '?');
        n.fehler.forEach(function (t) { push('fehler', b, was + ': ' + t); });
        if (!vv.ok) push('fehler', b, was + ': Nächster Hop – ' + vv.fehler);
        if (vv.ok) {
          var erreichbar = Object.keys(b.werte.ifs).some(function (p) { var h = konfig(b, p).host; return h.ok && IP().gleichesNetz(vv.wert, h.ip, h.praefix); });
          if (!erreichbar) push('fehler', b, was + ': Der nächste Hop ' + vv.text + ' liegt in keinem direkt angeschlossenen Netz.');
        }
        if (n.ok && vv.ok && !rt.aktiv) push('hinweis', b, was + ' ist deaktiviert.');
      });
    });
    Object.keys(ips).forEach(function (ip) { if (ips[ip].length > 1) push('fehler', null, 'Die IP-Adresse ' + IP().text(Number(ip)) + ' ist mehrfach vergeben: ' + ips[ip].join(', ') + '.'); });
    // Gleiches Segment, verschiedene Subnetze
    var ende = doc.bauteile.filter(istEnd), gemeldet = {};
    ende.forEach(function (b) {
      var kb = konfig(b, 'eth0').host; if (!kb.ok) return;
      var seg = segment(doc, { b: b.id, a: 'eth0' });
      if (seg.schleife && !gemeldet.schleife) { gemeldet.schleife = true; push('warnung', null, 'Zwischen den Switches gibt es eine Schleife. Ohne Spanning Tree würden Broadcasts endlos kreisen.'); }
      seg.endpunkte.forEach(function (p) {
        var o = M().finde(doc, p.ref.b); if (!istEnd(o) || gemeldet[[b.id, o.id].sort().join()]) return;
        var ko = konfig(o, 'eth0').host; if (!ko.ok) return;
        gemeldet[[b.id, o.id].sort().join()] = true;
        if (cidr(kb) !== cidr(ko)) push('warnung', null, b.name + ' und ' + o.name + ' sind direkt verbunden, liegen aber in verschiedenen Subnetzen (' + cidr(kb) + ' und ' + cidr(ko) + ').');
      });
    });
    // Erreichbarkeit aller Endgeräte-Paare
    var erreichbar = [];
    for (var i = 0; i < ende.length; i++) for (var j = i + 1; j < ende.length; j++) {
      var r = sende(doc, ende[i].id, ende[j].id, {});
      erreichbar.push({ a: ende[i].id, b: ende[j].id, status: r.status, meldung: r.meldung });
    }
    if (!liste.some(function (m) { return m.art === 'fehler' || m.art === 'warnung'; })) {
      push('ok', null, 'Keine Konfigurationsfehler an den einzelnen Geräten gefunden.');
      if (erreichbar.some(function (x) { return x.status !== 'erfolg'; })) push('hinweis', null, 'Trotzdem klappen nicht alle Verbindungen. Ursache kann z. B. eine fehlende Route oder ein fehlendes Kabel sein – teste die Verbindungen einzeln.');
    }
    return { meldungen: liste, erreichbar: erreichbar };
  }

  /** Netze, die ein Router direkt kennt, als Teil der Routing-Tabelle (Anzeige). */
  function routingTabelle(b) {
    var out = [];
    Object.keys(b.werte.ifs).forEach(function (p) {
      var k = konfig(b, p);
      if (k.host.ok) out.push({ art: 'C', ziel: cidr(k.host), via: 'direkt', schnittstelle: p, aktiv: k.aktiv });
    });
    b.werte.routen.forEach(function (rt) {
      var n = IP().netzangabe(rt.ziel, rt.maske), v = IP().adresse(rt.via);
      out.push({ art: 'S', id: rt.id, ziel: n.ok ? IP().text(n.netz) + '/' + n.praefix : (rt.ziel || '?') + '/' + (rt.maske || '?'), via: v.ok ? v.text : rt.via || '?', aktiv: rt.aktiv, gueltig: n.ok && v.ok });
    });
    return out;
  }

  SL.netzsim = { sende: sende, pruefeNetz: pruefeNetz, segment: segment, konfig: konfig, routingTabelle: routingTabelle, MAX_HOPS: MAX_HOPS };
})(typeof window !== 'undefined' ? window : globalThis);
