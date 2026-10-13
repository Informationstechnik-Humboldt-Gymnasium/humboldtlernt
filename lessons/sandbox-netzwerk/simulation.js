// Netzwerk-Labor · Simulation (pädagogisches Modell, kein echter Netzwerkverkehr, kein DOM)
//
// SL.netzsim.sende(doc, quelleId, zielId, macTab?, dienst?) – simuliert eine Verbindung (Anfrage UND Antwort) Hop für Hop.
//   dienst: 'ping' (Standard), 'http' (Web, Port 80) oder 'https' (Port 443). Für HTTP/HTTPS muss am Ziel ein Server mit
//   eingeschaltetem Webdienst laufen; Firewalls filtern nach Quelle, Ziel und Dienst.
//   1. Endgerät: Ziel im eigenen Netz? → direkt zustellen, sonst an das Standardgateway.
//   2. Schicht 2: Vom Ausgangsanschluss über Kabel, Switches und Access Points (WLAN) das Gerät mit der IP des nächsten
//      Hops suchen. Switches und Access Points lernen Absender-MAC-Adressen und fluten Rahmen an unbekannte Ziele.
//      WLAN-Geräte erreichen das Netz nur, wenn sie mit einem Access Point verbunden sind (SSID, Schlüssel, Reichweite).
//   3. Router/Firewall: direkt angeschlossenes Netz (längster Präfix) oder passende statische Route (längster Präfix).
//      Eine Firewall prüft vorher ihre Regeln von oben nach unten (erste passende Regel gilt, sonst Standardrichtlinie).
//      Sie arbeitet zustandsbehaftet: Antworten auf eine durchgelassene Anfrage dürfen zurück.
//   4. Am Ziel: Antwort auf demselben Weg zurück prüfen.
// Ergebnis: { status: 'erfolg' | 'fehler' | 'unklar', meldung, ursache, schritte: [...], pfad: [...], ablauf: [...], mac }
//   ablauf: Reihenfolge für die Animation – { typ: 'schritt', i } (Gerät entscheidet) und { typ: 'kabel', i } (Paket auf Kabel pfad[i])
//   ursache (Kennwort für Tests/Aufgaben): kein-kabel, ip-ungueltig, ziel-ip-ungueltig, gateway-fehlt, subnetz, gateway-falsch,
//   gateway-unerreichbar, keine-verbindung, if-deaktiviert, keine-route, route-deaktiviert, route-falsch, ttl, ip-doppelt,
//   schleife, gleiches-geraet, kein-endgeraet, firewall, dienst-aus, wlan-keine-ssid, wlan-ssid, wlan-reichweite,
//   wlan-schluessel, unbekannt
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

  function istBruecke(b) { return !!SL.TYPEN[b.typ].bruecke || b.typ === 'switch'; }
  function ifName(b) { return M().ifName(b); }

  /** Verbindungen ab einem Anschluss: ein Kabel oder – bei WLAN-Geräten – die Funkverbindung zum Access Point. */
  function kanten(doc, ref) {
    var b = M().finde(doc, ref.b), T = SL.TYPEN[b.typ];
    if (T.funk && ref.a === T.funk) {
      var f = M().funk(doc, b);
      return f.ok ? [{ draht: null, funk: true, von: ref, nach: { b: f.ap.id, a: 'funk' } }] : [];
    }
    var d = M().kabelAn(doc, ref);
    return d ? [{ draht: d.id, funk: false, von: ref, nach: M().gegenstelle(doc, ref) }] : [];
  }
  /** Ausgänge einer Brücke (Switch, Access Point) außer dem Eingang. */
  function brueckenAusgaenge(doc, b, ein, vonGeraet) {
    var out = [];
    if (b.typ === 'switch') Object.keys(M().ports(b)).forEach(function (p) { if (p !== ein.a) out = out.concat(kanten(doc, { b: b.id, a: p })); });
    else if (b.typ === 'ap') {
      if (ein.a !== 'eth0') out = out.concat(kanten(doc, { b: b.id, a: 'eth0' }));
      M().funkKunden(doc, b).forEach(function (c) { if (c.id !== vonGeraet) out.push({ draht: null, funk: true, von: { b: b.id, a: 'funk' }, nach: { b: c.id, a: SL.TYPEN[c.typ].funk } }); });
    }
    return out;
  }

  /**
   * Schicht-2-Segment ab einem Anschluss: alle über Kabel, Switches und Access Points erreichbaren Endpunkte (Router-,
   * Firewall- oder Endgeräte-Schnittstellen) mit dem Weg dorthin. Liefert { endpunkte: [{ ref, pfad }], schleife }.
   * pfad: [{ draht, funk, von: ref, nach: ref }] – jedes Kabel- oder Funkstück in Laufrichtung.
   */
  function segment(doc, start) {
    var out = { endpunkte: [], schleife: false }, besucht = {};
    var schlange = kanten(doc, start).map(function (k) { return { kante: k, pfad: [] }; });
    while (schlange.length) {
      var x = schlange.shift(), k = x.kante, b = M().finde(doc, k.nach.b);
      var pfad = x.pfad.concat([k]);
      if (istBruecke(b)) {
        if (besucht[b.id]) { out.schleife = true; continue; }
        besucht[b.id] = true;
        brueckenAusgaenge(doc, b, k.nach, k.von.b).forEach(function (k2) { schlange.push({ kante: k2, pfad: pfad }); });
      } else out.endpunkte.push({ ref: k.nach, pfad: pfad });
    }
    return out;
  }

  // ------------------------------------------------------------ Paket weiterleiten (eine Richtung)
  /** paket: { src, dst, dienst } – für Firewall-Regeln. */
  function Lauf(doc, macTab, phase, ergebnis, paket) { this.doc = doc; this.mac = macTab; this.phase = phase; this.e = ergebnis; this.paket = paket; }

  Lauf.prototype.schritt = function (s) { s.phase = this.phase; this.e.schritte.push(s); this.e.ablauf.push({ typ: 'schritt', i: this.e.schritte.length - 1 }); return s; };
  Lauf.prototype.fehler = function (b, ursache, text) {
    this.schritt({ geraet: b ? b.id : null, name: b ? b.name : '', art: 'fehler', grund: text });
    return { ok: false, ursache: ursache, text: text };
  };

  /** Schicht-2-Weg ablaufen: Kabelstücke ins Ergebnis, Switch-Schritte mit MAC-Lernen. */
  Lauf.prototype.l2 = function (pfad, quelleMac, zielMac) {
    var self = this, doc = this.doc;
    pfad.forEach(function (st, k) {
      self.e.pfad.push({ draht: st.draht, funk: !!st.funk, von: st.von, nach: st.nach, phase: self.phase });
      self.e.ablauf.push({ typ: 'kabel', i: self.e.pfad.length - 1 });
      var b = M().finde(doc, st.nach.b);
      if (!istBruecke(b)) return;
      var aus = pfad[k + 1].von.a, tab = self.mac[b.id] || (self.mac[b.id] = {});
      var bekannt = tab[zielMac] === aus;
      tab[quelleMac] = st.nach.a;   // Absender lernen
      self.schritt({ geraet: b.id, name: b.name, art: b.typ === 'ap' ? 'ap' : 'switch', schnittstelle: M().anschlussName(b, st.nach.a) + ' → ' + M().anschlussName(b, aus),
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
        var ifn = ifName(cur), k = konfig(cur, ifn);
        if (!k.host.ok) return this.fehler(cur, 'ip-ungueltig', 'Die IP-Konfiguration von ' + cur.name + ' ist ungültig: ' + k.host.fehler[0]);
        if (!k.aktiv) return this.fehler(cur, 'if-deaktiviert', 'Eine benötigte Schnittstelle ist deaktiviert: ' + cur.name + ' (' + ifn + ').');
        var eigen = k.host;
        if (IP().gleichesNetz(dst, eigen.ip, eigen.praefix)) {
          naechster = dst; aus = ifn;
          grund = dstText + ' liegt im eigenen Netz ' + cidr(eigen) + ' → direkt zustellen.';
        } else {
          var gwText = cur.werte.gateway;
          if (!gwText) {
            // Ist das Ziel trotzdem über Kabel/Switch erreichbar? Dann ist es ein Subnetzfehler, kein fehlendes Kabel.
            var seg = segment(doc, { b: cur.id, a: ifn });
            var nah = seg.endpunkte.filter(function (p) { return p.ref.b === ziel.id; })[0];
            var zh = konfig(ziel, ifName(ziel)).host;
            if (nah) return this.fehler(cur, 'subnetz', cur.name + ' und ' + ziel.name + ' sind direkt verbunden, befinden sich laut IP-Konfiguration aber in unterschiedlichen Subnetzen (' + cidr(eigen) +
              ' und ' + (zh.ok ? cidr(zh) : dstText) + '). Ohne Standardgateway kann ' + cur.name + ' das Ziel nicht erreichen. Prüfe IP-Adressen und Subnetzmasken.');
            return this.fehler(cur, 'gateway-fehlt', 'Das Ziel ' + dstText + ' liegt nicht im eigenen Netz ' + cidr(eigen) + ' von ' + cur.name + ', und es ist kein Standardgateway eingetragen. Die Geräte befinden sich in unterschiedlichen Subnetzen.');
          }
          var g = IP().adresse(gwText);
          if (!g.ok) return this.fehler(cur, 'gateway-falsch', 'Das Standardgateway von ' + cur.name + ' ist nicht korrekt konfiguriert: ' + g.fehler);
          if (!IP().gleichesNetz(g.wert, eigen.ip, eigen.praefix)) return this.fehler(cur, 'gateway-falsch', 'Das Standardgateway ist nicht korrekt konfiguriert: ' + g.text + ' liegt nicht im eigenen Netz ' + cidr(eigen) + ' von ' + cur.name + '. Ein Gateway muss im selben Subnetz liegen.');
          if (g.wert === eigen.ip) return this.fehler(cur, 'gateway-falsch', 'Das Standardgateway ist nicht korrekt konfiguriert: ' + cur.name + ' hat seine eigene Adresse ' + g.text + ' als Gateway eingetragen.');
          naechster = g.wert; aus = ifn; gw = g.wert;
          grund = dstText + ' liegt nicht im eigenen Netz ' + cidr(eigen) + ' → an das Standardgateway ' + g.text + '.';
        }
        this.schritt({ geraet: cur.id, name: cur.name, art: cur === quelle ? 'start' : 'info', schnittstelle: ifn, naechster: IP().text(naechster), grund: grund });
      } else if (SL.TYPEN[cur.typ].routet) {
        if (cur.typ === 'firewall') { var fw = this.filter(cur); if (!fw.ok) return fw; }
        var r = this.route(cur, dst, ein);
        if (!r.ok) return r;
        aus = r.aus; naechster = r.naechster;
        this.schritt({ geraet: cur.id, name: cur.name, art: 'router', schnittstelle: r.ein + ' → ' + r.aus, naechster: IP().text(naechster), grund: r.grund });
      } else return this.fehler(cur, 'unbekannt', 'Unerwarteter Gerätetyp im Weg.');

      // Schicht 2: Gerät mit der IP „naechster“ im Segment hinter „aus“ suchen
      if (!kanten(doc, { b: cur.id, a: aus }).length) {
        if (SL.TYPEN[cur.typ].funk) { var fu = M().funk(doc, cur); return this.fehler(cur, fu.ursache || 'keine-verbindung', 'Keine WLAN-Verbindung: ' + fu.grund); }
        return this.fehler(cur, 'kein-kabel', 'Keine direkte Verbindung: An ' + cur.name + ' (' + M().anschlussName(cur, aus) + ') ist kein Kabel angeschlossen.');
      }
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
          return this.fehler(cur, 'keine-verbindung', zielIrgendwo ? 'Keine direkte Verbindung zwischen den Geräten: ' + ziel.name + ' ist im gleichen Subnetz eingetragen, aber nicht über Kabel, Switch oder WLAN mit ' + cur.name + ' verbunden.'
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

  /** Beschreibung einer Firewall-Regel für Meldungen. */
  function regelText(r, nr) {
    return 'Regel ' + nr + ' (' + r.aktion + ' · ' + (r.dienst === 'alle' ? 'alle Dienste' : M().DIENSTE[r.dienst].kurz) + ' · von ' + (r.quelle || 'alle') + ' nach ' + (r.ziel || 'alle') + ')';
  }
  /** Erste passende aktive Regel für ein Paket oder null. Regeln mit ungültigen Angaben werden übersprungen. */
  function passendeRegel(fw, p) {
    var l = fw.werte.regeln;
    for (var i = 0; i < l.length; i++) {
      var r = l[i];
      if (!r.aktiv) continue;
      var q = IP().bereich(r.quelle), z = IP().bereich(r.ziel);
      if (!q.ok || !z.ok) continue;
      if (IP().imBereich(p.src, q) && IP().imBereich(p.dst, z) && (r.dienst === 'alle' || r.dienst === p.dienst)) return { regel: r, nr: i + 1 };
    }
    return null;
  }
  /** Paketfilter einer Firewall (zustandsbehaftet: durchgelassene Anfragen öffnen den Rückweg für die Antwort). */
  Lauf.prototype.filter = function (fw) {
    var p = this.paket, offen = this.e.offen || (this.e.offen = {});
    var d = M().DIENSTE[p.dienst].kurz, was = d + ' von ' + IP().text(p.src) + ' an ' + IP().text(p.dst);
    if (this.phase === 'antwort' && offen[fw.id]) {
      this.schritt({ geraet: fw.id, name: fw.name, art: 'firewall', grund: 'Antwort auf eine erlaubte Verbindung – die Firewall kennt die Verbindung und lässt die Antwort durch (zustandsbehaftet).' });
      return { ok: true };
    }
    var t = passendeRegel(fw, p);
    var erlaubt = t ? t.regel.aktion === 'erlauben' : fw.werte.standard === 'erlauben';
    var grund = t ? regelText(t.regel, t.nr) : 'keine Regel passt → Standardrichtlinie „' + fw.werte.standard + '“';
    if (!erlaubt) return this.fehler(fw, 'firewall', 'Die Firewall ' + fw.name + ' blockiert ' + was + ': ' + grund + '.');
    if (this.phase === 'anfrage') offen[fw.id] = true;
    this.schritt({ geraet: fw.id, name: fw.name, art: 'firewall', grund: was + ' ist erlaubt: ' + grund + '.' });
    return { ok: true };
  };

  /** Routing-Entscheidung eines Routers (oder einer Firewall) für dst. */
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
  function sende(doc, quelleId, zielId, macTab, dienst) {
    dienst = M().DIENSTE[dienst] ? dienst : 'ping';
    var e = { status: 'fehler', meldung: '', ursache: '', dienst: dienst, schritte: [], pfad: [], ablauf: [], mac: macTab || {}, offen: {} };
    var q = M().finde(doc, quelleId), z = M().finde(doc, zielId);
    var ende = function (status, ursache, text) { e.status = status; e.ursache = ursache; e.meldung = text; return e; };
    if (!q || !z) return ende('fehler', 'unbekannt', 'Wähle ein Quell- und ein Zielgerät aus.');
    if (!istEnd(q) || !istEnd(z)) return ende('fehler', 'kein-endgeraet', 'Quelle und Ziel müssen Endgeräte sein (PC, Laptop, Smartphone, Server). Switches, Access Points, Router und Firewalls leiten nur weiter.');
    if (q.id === z.id) return ende('fehler', 'gleiches-geraet', 'Quelle und Ziel sind dasselbe Gerät.');
    var kz = konfig(z, ifName(z));
    if (!kz.host.ok) return ende('fehler', 'ziel-ip-ungueltig', 'Die IP-Adresse ist ungültig: ' + z.name + ' hat keine gültige IP-Konfiguration (' + kz.host.fehler[0] + ')');
    var kq = konfig(q, ifName(q));
    if (!kq.host.ok) { e.schritte.push({ geraet: q.id, name: q.name, art: 'fehler', phase: 'anfrage', grund: kq.host.fehler[0] }); e.ablauf.push({ typ: 'schritt', i: 0 }); return ende('fehler', 'ip-ungueltig', 'Die IP-Adresse ist ungültig: ' + q.name + ' hat keine gültige IP-Konfiguration (' + kq.host.fehler[0] + ')'); }

    if (kq.host.ip === kz.host.ip) return ende('unklar', 'ip-doppelt', q.name + ' und ' + z.name + ' haben dieselbe IP-Adresse ' + IP().text(kq.host.ip) + '. Bei einem Adresskonflikt ist nicht festgelegt, welches Gerät antwortet – das Ergebnis ist unklar. Jede Adresse darf im Netz nur einmal vorkommen.');
    var D = M().DIENSTE[dienst];
    var hin = new Lauf(doc, e.mac, 'anfrage', e, { src: kq.host.ip, dst: kz.host.ip, dienst: dienst }).laufe(q, z, kz.host.ip);
    if (!hin.ok) return ende(hin.unklar ? 'unklar' : 'fehler', hin.ursache, hin.text);
    if (D.port) {
      // HTTP/HTTPS: Läuft am Ziel ein passender Dienst? Sonst lehnt das Ziel die Verbindung ab.
      var an = z.werte.dienste && z.werte.dienste[dienst === 'http' ? 'web' : 'https'];
      if (!an) {
        var t = z.name + ' ist erreichbar, bietet aber keinen Dienst auf Port ' + D.port + ' an (' + D.kurz + ')' + (z.werte.dienste ? ' – der ' + (dienst === 'http' ? 'Webserver' : 'HTTPS-Dienst') + ' ist ausgeschaltet.' : ' – nur Server stellen Webdienste bereit.') + ' Die Verbindung wird abgelehnt.';
        e.schritte.push({ geraet: z.id, name: z.name, art: 'fehler', phase: 'anfrage', grund: t }); e.ablauf.push({ typ: 'schritt', i: e.schritte.length - 1 });
        return ende('fehler', 'dienst-aus', t);
      }
    }
    var zurueck = new Lauf(doc, e.mac, 'antwort', e, { src: kz.host.ip, dst: kq.host.ip, dienst: dienst }).laufe(z, q, kq.host.ip);
    if (!zurueck.ok) return ende(zurueck.unklar ? 'unklar' : 'fehler', zurueck.ursache, 'Die Anfrage kommt bei ' + z.name + ' an, aber die Antwort nicht zurück: ' + zurueck.text);
    if (hin.schleife || zurueck.schleife) return ende('unklar', 'schleife', 'Ein Weg wurde gefunden, aber zwischen den Switches gibt es eine Schleife. In einem echten Netz kreisen Broadcasts dann endlos (dagegen hilft das Spanning-Tree-Protokoll, das hier nicht simuliert wird). Das Ergebnis ist deshalb unklar.');
    return ende('erfolg', '', 'Verbindung erfolgreich (' + D.kurz + '): ' + q.name + ' erreicht ' + z.name + ', und die Antwort kommt zurück.');
  }

  // ------------------------------------------------------------ Netzwerk prüfen
  function pruefeNetz(doc) {
    var liste = [], push = function (art, b, text) { liste.push({ art: art, geraet: b ? b.id : null, text: (b ? b.name + ': ' : '') + text }); };
    var v = M().validiere(doc);
    v.fehler.forEach(function (t) { push('fehler', null, t); });
    if (!doc.bauteile.length) { push('hinweis', null, 'Das Netzwerk ist leer. Ziehe Geräte aus der Leiste auf die Arbeitsfläche.'); return { meldungen: liste, erreichbar: [] }; }
    var ips = {};
    doc.bauteile.forEach(function (b) {
      if (b.typ === 'ap') {
        if (!b.werte.ssid) push('warnung', b, 'Der Access Point hat keine SSID – kein Gerät kann sich verbinden.');
        if (!M().kabelAn(doc, { b: b.id, a: 'eth0' })) push('warnung', b, 'Der Access Point ist nicht per Kabel mit dem Netz verbunden. WLAN-Geräte erreichen dann nur einander.');
        var kunden = M().funkKunden(doc, b);
        push('hinweis', b, kunden.length ? 'Verbundene WLAN-Geräte: ' + kunden.map(function (c) { return c.name; }).join(', ') + '.' : 'Noch kein WLAN-Gerät verbunden.');
      }
      if (!hatIfs(b)) return;
      var netze = [];
      Object.keys(b.werte.ifs).forEach(function (p) {
        var f = b.werte.ifs[p], kabel = kanten(doc, { b: b.id, a: p }).length > 0, name = M().anschlussName(b, p), wlan = SL.TYPEN[b.typ].funk === p;
        if (!f.ip && !f.maske) { if (kabel || istEnd(b)) push('warnung', b, name + ' hat noch keine IP-Adresse.'); return; }
        var h = IP().host(f.ip, f.maske);
        if (!h.ok) { h.fehler.forEach(function (t) { push('fehler', b, name + ': ' + t); }); return; }
        if (!f.aktiv) push('warnung', b, 'Die Schnittstelle ' + name + ' ist deaktiviert.');
        if (!kabel && !wlan) push('hinweis', b, name + ' ist konfiguriert, aber kein Kabel ist angeschlossen.');
        (ips[h.ip] = ips[h.ip] || []).push(b.name + (istEnd(b) ? '' : ' (' + name + ')'));
        netze.forEach(function (n) { if (IP().netz(h.ip, Math.min(h.praefix, n.h.praefix)) === IP().netz(n.h.ip, Math.min(h.praefix, n.h.praefix))) push('fehler', b, name + ' und ' + n.p + ' liegen im selben bzw. in überlappenden Netzen (' + cidr(h) + ', ' + cidr(n.h) + '). Jede Router-Schnittstelle braucht ein eigenes Netz.'); });
        netze.push({ p: name, h: h });
      });
      if (istEnd(b)) {
        var ifn = ifName(b), k = konfig(b, ifn), verbunden = kanten(doc, { b: b.id, a: ifn }).length > 0;
        if (b.werte.gateway) {
          var g = IP().adresse(b.werte.gateway);
          if (!g.ok) push('fehler', b, 'Standardgateway: ' + g.fehler);
          else if (k.host.ok && !IP().gleichesNetz(g.wert, k.host.ip, k.host.praefix)) push('fehler', b, 'Das Standardgateway ' + g.text + ' liegt nicht im eigenen Netz ' + cidr(k.host) + '.');
          else if (k.host.ok && verbunden) {
            // Gibt es unter der Gateway-Adresse im angeschlossenen Segment überhaupt einen Router?
            var gwGeraet = segment(doc, { b: b.id, a: ifn }).endpunkte.map(function (p) { return { g: M().finde(doc, p.ref.b), p: p.ref.a }; })
              .filter(function (x) { return ipVon(x.g, x.p) === g.wert; })[0];
            if (!gwGeraet) push('fehler', b, 'Unter dem Standardgateway ' + g.text + ' ist im angeschlossenen Netz kein Gerät erreichbar.');
            else if (!SL.TYPEN[gwGeraet.g.typ].routet) push('fehler', b, 'Das Standardgateway ' + g.text + ' gehört zu ' + gwGeraet.g.name + ' – das ist kein Router.');
          }
        }
        if (b.werte.dns) { var dn = IP().adresse(b.werte.dns); if (!dn.ok) push('fehler', b, 'DNS-Server: ' + dn.fehler); }
        if (!verbunden) push('warnung', b, SL.TYPEN[b.typ].funk ? 'Keine WLAN-Verbindung: ' + M().funk(doc, b).grund : 'Kein Kabel angeschlossen.');
      }
      if (b.typ === 'firewall') {
        b.werte.regeln.forEach(function (r, i) {
          [['Quelle', r.quelle], ['Ziel', r.ziel]].forEach(function (x) { var br = IP().bereich(x[1]); if (!br.ok) push('fehler', b, 'Regel ' + (i + 1) + ', ' + x[0] + ': ' + br.fehler + ' Die Regel wird ignoriert.'); });
        });
        if (b.werte.standard === 'blockieren' && !b.werte.regeln.some(function (r) { return r.aktiv && r.aktion === 'erlauben'; })) push('hinweis', b, 'Es gibt keine aktive „erlauben“-Regel und die Standardrichtlinie ist „blockieren“: Die Firewall lässt nichts durch.');
      }
      if (SL.TYPEN[b.typ].routet) b.werte.routen.forEach(function (rt) {
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
      var kb = konfig(b, ifName(b)).host; if (!kb.ok) return;
      var seg = segment(doc, { b: b.id, a: ifName(b) });
      if (seg.schleife && !gemeldet.schleife) { gemeldet.schleife = true; push('warnung', null, 'Zwischen den Switches/Access Points gibt es eine Schleife. Ohne Spanning Tree würden Broadcasts endlos kreisen.'); }
      seg.endpunkte.forEach(function (p) {
        var o = M().finde(doc, p.ref.b); if (!istEnd(o) || gemeldet[[b.id, o.id].sort().join()]) return;
        var ko = konfig(o, ifName(o)).host; if (!ko.ok) return;
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
  // Für die Anzeige: Firewall-Regeltext und passende Regel (auch in der Oberfläche genutzt)
  function regelInfo(fw, p) { var t = passendeRegel(fw, p); return t ? { regel: t.regel, nr: t.nr, text: regelText(t.regel, t.nr) } : null; }

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

  SL.netzsim = { sende: sende, pruefeNetz: pruefeNetz, segment: segment, kanten: kanten, konfig: konfig, routingTabelle: routingTabelle, regelInfo: regelInfo, MAX_HOPS: MAX_HOPS };
})(typeof window !== 'undefined' ? window : globalThis);
