// Netzwerk-Labor · Oberfläche: Werkzeugleiste, Geräteleiste, Konfiguration, Verbindungstest, Paketanimation, Aufgaben.
// Modell (modell.js), IPv4-Rechnung (ipv4.js), Simulation (simulation.js) und Aufgaben (aufgaben.js) kennen kein DOM.
// Zeiger, Touch, Zoom und Verkabeln kommen aus ../sandbox-schaltkreis/bedienung.js (gemeinsam mit den anderen Laboren).
(function () {
  'use strict';
  var SL = window.SL, M = SL.modell, S = SL.netzsim, IP = SL.ip, A = SL.netzAufgaben;
  var SPEICHER = 'netzwerk-labor', SPEICHER_AUFGABEN = 'netzwerk-labor-aufgaben';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var reduziert = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var st = { doc: M.neu(), auswahl: null, verlauf: [], zukunft: [], mac: {}, aufgabe: null, hinweise: 0, rueckmeldung: null, erledigt: {}, test: null,
    sim: null, testmodus: false, pick: null, log: [] };   // sim: { erg, k (Index in erg.ablauf), t0, laeuft, raf, paket, gen }

  // ---------------------------------------------------------------- Verlauf und Speichern
  function knoepfe() { $('rueck').disabled = !st.verlauf.length; $('vor').disabled = !st.zukunft.length; $('loeschen').disabled = !st.auswahl; }
  function merke(vorher) {
    st.verlauf.push(JSON.stringify(vorher || st.doc));
    if (st.verlauf.length > 100) st.verlauf.shift();
    st.zukunft = [];
    knoepfe();
  }
  function speichere() {
    try { localStorage.setItem(SPEICHER, M.exportiere(st.doc)); localStorage.setItem(SPEICHER_AUFGABEN, JSON.stringify(Object.keys(st.erledigt))); } catch (e) { /* kein Speicher */ }
  }
  function gueltigeAuswahl() {
    var a = st.auswahl;
    if (!a) return;
    if (a.art === 'bauteil' && !M.finde(st.doc, a.id)) st.auswahl = null;
    if (a.art === 'draht' && !M.findeDraht(st.doc, a.id)) st.auswahl = null;
    if (a.art === 'mehrere') st.auswahl = null;
  }
  /** Nach jeder Änderung am Netzwerk. art: 'bewegen' ändert nur die Lage – dann bleiben Simulation und Panel.
   *  art 'feld': Texteingabe im Konfigurationsbereich – die Felder selbst werden NICHT neu aufgebaut (Fokus bleibt). */
  function geaendert(art) {
    gueltigeAuswahl();
    // Beim Verschieben ändert sich nur die Lage – außer bei WLAN: Dort entscheidet der Abstand über die Verbindung.
    var funk = art === 'bewegen' && st.doc.bauteile.some(function (b) { return SL.TYPEN[b.typ].funk; });
    if (art !== 'bewegen' || funk) { simStopp(); st.mac = {}; }
    zeichne();
    if (art !== 'bewegen') { auswahlListen(); if (art === 'feld') meldungenAktualisieren(); else eigenschaften(); aufgabeLive(); }
    else if (funk) { meldungenAktualisieren(); aufgabeLive(); }
    knoepfe();
    speichere();
  }
  function waehle(sel) {
    // Freier Testmodus: Antippen von Endgeräten wählt Quelle und Ziel und startet sofort einen Test
    if (st.testmodus && sel && sel.art === 'bauteil') {
      var b = M.finde(st.doc, sel.id);
      if (!SL.TYPEN[b.typ].endgeraet) { toast(SL.TYPEN[b.typ].name + ' leitet nur weiter. Tippe ein Endgerät an (PC, Laptop, Smartphone, Server).', 'hinweis'); return; }
      if (!st.pick || st.pick.z) { st.pick = { q: b.id }; st.test = { q: b.id, z: null }; toast('Quelle: ' + b.name + '. Tippe jetzt das Ziel an.', 'hinweis'); zeichne(); return; }
      if (st.pick.q === b.id) { st.pick = null; st.test = null; toast('Auswahl aufgehoben.', 'hinweis'); zeichne(); return; }
      st.pick.z = b.id;
      $('quelle').value = st.pick.q; $('ziel').value = b.id;
      senden();
      return;
    }
    st.auswahl = sel; knoepfe(); eigenschaften(); zeichne();
  }

  // ---------------------------------------------------------------- Bedienung (gemeinsam mit den anderen Laboren)
  var svg = $('flaeche'), welt = $('welt'), raster = $('raster'), box = $('flaeche-box'), leisteAktiv = null;
  var bed = new SL.Bedienung({
    doc: function () { return st.doc; }, merke: merke, geaendert: geaendert, zeige: zeichne, auswahl: waehle, meldung: toast,
  });
  function punkt(e) {
    var r = svg.getBoundingClientRect();
    return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, typ: e.pointerType, taste: e.button, drin: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  }
  svg.addEventListener('pointerdown', function (e) { if (e.button > 0) return; e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (x) { /* egal */ } bed.runter(punkt(e)); });
  svg.addEventListener('pointermove', function (e) { if (!leisteAktiv) bed.bewegen(punkt(e)); });
  svg.addEventListener('pointerup', function (e) { if (!leisteAktiv) bed.hoch(punkt(e)); });
  svg.addEventListener('pointercancel', function (e) { if (!leisteAktiv) bed.abbrechen(punkt(e)); });
  svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && bed.hover && !bed.anzahl()) { bed.hover = null; zeichne(); } });
  svg.addEventListener('wheel', function (e) { e.preventDefault(); bed.zoomUm(punkt(e), Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004)); }, { passive: false });
  svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Geräteleiste
  $('leiste').innerHTML = SL.KATEGORIEN.map(function (k) {
    return '<h3>' + esc(k) + '</h3>' + Object.keys(SL.TYPEN).filter(function (t) { return SL.TYPEN[t].kategorie === k; }).map(function (typ) {
      var T = SL.TYPEN[typ], bx = T.box, vb = [bx[0] - 4, bx[1] - 4, bx[2] + 8, bx[3] + 8].join(' ');
      return '<button type="button" class="teil" data-typ="' + typ + '" title="' + esc(T.hilfe) + '"><svg viewBox="' + vb + '" aria-hidden="true">' + SL.zeichnen.symbol(typ) + '</svg><span>' + esc(T.name) + '</span></button>';
    }).join('');
  }).join('');
  $('leiste').addEventListener('pointerdown', function (e) { var b = e.target.closest('.teil'); if (!b || e.button > 0) return; leisteAktiv = e.pointerId; bed.leisteRunter(b.dataset.typ, punkt(e)); });
  document.addEventListener('pointermove', function (e) { if (leisteAktiv === e.pointerId) bed.bewegen(punkt(e)); });
  document.addEventListener('pointerup', function (e) { if (leisteAktiv === e.pointerId) { leisteAktiv = null; bed.hoch(punkt(e)); } });
  document.addEventListener('pointercancel', function (e) { if (leisteAktiv === e.pointerId) { leisteAktiv = null; bed.abbrechen(punkt(e)); } });
  $('leiste').addEventListener('click', function (e) { var b = e.target.closest('.teil'); if (b && e.detail === 0) { var p = bed.freierPlatz(b.dataset.typ); bed.fuegeEin(b.dataset.typ, p.x, p.y); } });

  // ---------------------------------------------------------------- Zeichnen
  var groesse = { w: 600, h: 400 };
  function zeichne() {
    var v = bed.view, w = groesse.w / v.s, h = groesse.h / v.s;
    svg.setAttribute('viewBox', [v.x, v.y, w, h].map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
    raster.setAttribute('x', v.x); raster.setAttribute('y', v.y); raster.setAttribute('width', w); raster.setAttribute('height', h);
    var sim = st.sim, pfadKabel = {}, markiert = {};
    if (st.test) { markiert[st.test.q] = 'quelle'; if (st.test.z) markiert[st.test.z] = 'ziel'; }
    if (sim) {
      sim.erg.ablauf.slice(0, sim.k + 1).forEach(function (x) {
        if (x.typ !== 'kabel') return;
        var pf = sim.erg.pfad[x.i];
        // Funkstrecken werden über das WLAN-Gerät markiert (die Seite, die nicht der Access Point ist)
        pfadKabel[pf.funk ? 'funk:' + (pf.von.a === 'funk' ? pf.nach.b : pf.von.b) : pf.draht] = pf.phase;
      });
      var akt = sim.erg.ablauf[Math.min(sim.k, sim.erg.ablauf.length - 1)];
      if (akt && akt.typ === 'schritt') { var s = sim.erg.schritte[akt.i]; if (s.geraet) markiert[s.geraet] = s.art === 'fehler' ? 'fehler' : 'aktuell'; }
    }
    welt.innerHTML = SL.zeichnen.szene({ doc: st.doc, auswahl: st.auswahl, vorschau: bed.vorschau, hover: bed.hover, pfadKabel: pfadKabel, paket: sim && sim.paket, markiert: markiert });
    var h0 = bed.hover;
    svg.style.cursor = h0 && h0.art === 'anschluss' ? 'crosshair' : h0 ? 'pointer' : 'default';
    $('leer').hidden = st.doc.bauteile.length > 0;
    svg.setAttribute('aria-label', 'Netzwerk mit ' + st.doc.bauteile.length + ' Geräten und ' + st.doc.draehte.length + ' Kabeln: ' +
      st.doc.bauteile.map(function (b) { return SL.TYPEN[b.typ].name + ' ' + b.name; }).join(', ') + '.');
  }
  if (window.ResizeObserver) new ResizeObserver(function () { groesse = { w: box.clientWidth || 600, h: box.clientHeight || 400 }; bed.groesse = groesse; zeichne(); }).observe(box);
  groesse = { w: box.clientWidth || 600, h: box.clientHeight || 400 };
  bed.groesse = groesse;

  var toastZeit = null;
  function toast(text, art) {
    var t = $('toast');
    // Die gemeinsame Bedienung spricht von „Drähten“ – im Netzwerk sind es Kabel
    t.textContent = String(text).replace(/Drähten/g, 'Kabeln').replace(/Draht/g, 'Kabel');
    t.className = 'toast zeigen ' + (art || '');
    clearTimeout(toastZeit);
    toastZeit = setTimeout(function () { t.className = 'toast'; }, art === 'fehler' ? 5000 : 3000);
  }

  // ---------------------------------------------------------------- Konfiguration (rechte Spalte)
  /** Prüfmeldung für ein Eingabefeld (leer = in Ordnung). */
  function feldMeldung(b, schluessel) {
    var t = schluessel.split(':');   // if:port:feld | gw | dns | route:rid | regel:fid | funk | kunden
    if (t[0] === 'if') {
      var f = b.werte.ifs[t[1]];
      if (!f.ip && !f.maske) return '';
      var h = IP.host(f.ip, f.maske);
      if (h.ok) { var i = IP.info(h.ip, h.praefix); return 'ok:Netz ' + i.cidr + ' · Maske ' + i.maske + ' · Hosts ' + i.ersterHost + ' – ' + i.letzterHost + ' (' + i.hosts.toLocaleString('de-DE') + ')'; }
      return h.fehler.join(' ');
    }
    if (t[0] === 'gw' || t[0] === 'dns') {
      var v = t[0] === 'gw' ? b.werte.gateway : b.werte.dns;
      if (!v) return t[0] === 'gw' ? 'hinweis:Ohne Gateway erreicht das Gerät nur Geräte im eigenen Netz.' : '';
      var a = IP.adresse(v);
      if (!a.ok) return a.fehler;
      var eigen = b.werte.ifs[M.ifName(b)], h2 = IP.host(eigen.ip, eigen.maske);
      if (t[0] === 'gw' && h2.ok && !IP.gleichesNetz(a.wert, h2.ip, h2.praefix)) return 'Das Gateway muss im eigenen Netz ' + IP.info(h2.ip, h2.praefix).cidr + ' liegen.';
      return t[0] === 'dns' ? 'hinweis:Nur gespeichert – DNS-Auflösung wird nicht simuliert.' : '';
    }
    if (t[0] === 'funk') {
      var fu = M.funk(st.doc, b);
      return fu.ok ? 'ok:Verbunden mit ' + fu.ap.name + ' („' + b.werte.ssid + '“), Abstand ' + Math.round(fu.abstand) + ' von ' + fu.ap.werte.reichweite + '.' : fu.grund;
    }
    if (t[0] === 'kunden') {
      var ku = M.funkKunden(st.doc, b);
      return 'hinweis:' + (ku.length ? 'Verbunden: ' + ku.map(function (c) { return c.name; }).join(', ') : 'Noch kein WLAN-Gerät verbunden.');
    }
    if (t[0] === 'regel') {
      var rg = b.werte.regeln.filter(function (x) { return x.id === t[1]; })[0];
      if (!rg) return '';
      var fe = [];
      [['Quelle', rg.quelle], ['Ziel', rg.ziel]].forEach(function (x) { var br = IP.bereich(x[1]); if (!br.ok) fe.push(x[0] + ': ' + br.fehler); });
      return fe.length ? fe.join(' ') + ' Die Regel wird ignoriert.' : '';
    }
    if (t[0] === 'route') {
      var r = b.werte.routen.filter(function (x) { return x.id === t[1]; })[0];
      if (!r || (!r.ziel && !r.maske && !r.via)) return '';
      var n = IP.netzangabe(r.ziel, r.maske), via = IP.adresse(r.via), f2 = n.fehler.slice();
      if (!via.ok) f2.push('Nächster Hop: ' + via.fehler);
      return f2.join(' ');
    }
    return '';
  }
  function meldungHtml(m) {
    if (!m) return '';
    var art = /^(ok|hinweis):/.exec(m), text = art ? m.slice(art[0].length) : m;
    return '<span class="feld-meldung ' + (art ? art[1] : 'fehler') + '">' + esc(text) + '</span>';
  }
  function gegenstelleText(b, port) {
    var g = M.gegenstelle(st.doc, { b: b.id, a: port });
    if (!g) return '<span class="muted">kein Kabel</span>';
    var o = M.finde(st.doc, g.b);
    return 'Kabel zu <b>' + esc(o.name) + '</b> (' + esc(M.anschlussName(o, g.a)) + ')';
  }
  function ifFeld(b, port, titel) {
    var f = b.werte.ifs[port], k = 'if:' + port;
    return '<fieldset class="schnitt"><legend>' + esc(titel) + '</legend>' +
      '<div class="felder2"><label class="ctrl"><span>IP-Adresse</span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-feld="' + k + ':ip" value="' + esc(f.ip) + '" placeholder="z. B. 192.168.1.10"></label>' +
      '<label class="ctrl"><span>Subnetzmaske</span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-feld="' + k + ':maske" value="' + esc(f.maske) + '" placeholder="/24 oder 255.255.255.0"></label></div>' +
      '<div class="meldung" data-meldung="' + k + '">' + meldungHtml(feldMeldung(b, k)) + '</div>' +
      '<label class="haken"><input type="checkbox" data-feld="' + k + ':aktiv"' + (f.aktiv ? ' checked' : '') + '> Schnittstelle aktiv</label>' +
      '<p class="small muted">MAC ' + esc(M.mac(b, port)) + ' · ' + gegenstelleText(b, port) + '</p></fieldset>';
  }
  function eigenschaften() {
    var z = $('eig'), a = st.auswahl;
    if (!a) { z.innerHTML = '<p class="small muted">Tippe ein Gerät oder ein Kabel an, um es zu konfigurieren.</p>'; return; }
    if (a.art === 'draht') {
      var d = M.findeDraht(st.doc, a.id), b1 = M.finde(st.doc, d.von.b), b2 = M.finde(st.doc, d.nach.b);
      var aus = [[b1, d.von.a], [b2, d.nach.a]].filter(function (x) { return x[0].werte.ifs && x[0].werte.ifs[x[1]].aktiv === false; });
      z.innerHTML = '<p><b>Kabel</b> von ' + esc(b1.name) + ' (' + esc(M.anschlussName(b1, d.von.a)) + ') zu ' + esc(b2.name) + ' (' + esc(M.anschlussName(b2, d.nach.a)) + ')</p>' +
        '<p class="status ' + (aus.length ? 'fehler' : 'ok') + '">' + (aus.length ? 'Keine Verbindung: Schnittstelle ' + aus.map(function (x) { return x[0].name + ' ' + x[1]; }).join(', ') + ' ist deaktiviert.' : 'Verbindung aktiv (beide Schnittstellen eingeschaltet).') + '</p>' +
        '<button type="button" data-aktion="loeschen" class="gefahr">Kabel entfernen</button>';
      return;
    }
    var b = M.finde(st.doc, a.id), T = SL.TYPEN[b.typ], h = '';
    h += '<p class="small muted">' + esc(T.name) + ' · ' + esc(T.hilfe) + '</p>';
    h += '<label class="ctrl"><span>Gerätename</span><input type="text" data-name maxlength="16" value="' + esc(b.name) + '"></label><div class="meldung" data-meldung="name"></div>';
    if (T.endgeraet) {
      var ifn = M.ifName(b);
      if (T.funk) {
        var ssids = {}; st.doc.bauteile.forEach(function (x) { if (x.typ === 'ap' && x.werte.ssid) ssids[x.werte.ssid] = true; });
        h += '<fieldset class="schnitt"><legend>WLAN</legend>' +
          '<label class="ctrl"><span>Netzwerkname (SSID)</span><input type="text" list="ssid-liste" autocomplete="off" spellcheck="false" data-feld="wert:ssid" value="' + esc(b.werte.ssid) + '" placeholder="z. B. Schul-WLAN"></label>' +
          '<datalist id="ssid-liste">' + Object.keys(ssids).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
          '<label class="ctrl"><span>WLAN-Schlüssel <span class="muted">(nur Simulation – kein echtes Passwort eingeben)</span></span><input type="text" autocomplete="off" spellcheck="false" data-feld="wert:schluessel" value="' + esc(b.werte.schluessel) + '"></label>' +
          '<div class="meldung" data-meldung="funk">' + meldungHtml(feldMeldung(b, 'funk')) + '</div>' +
          '<p class="small muted">Verbunden wird mit dem nächstgelegenen Access Point mit dieser SSID, wenn der Schlüssel stimmt und das Gerät in Reichweite steht. Zum Ändern der Entfernung das Gerät verschieben.</p></fieldset>';
      }
      h += ifFeld(b, ifn, T.funk ? 'WLAN-Karte ' + ifn : 'Netzwerkkarte ' + ifn);
      h += '<label class="ctrl"><span>Standardgateway <span class="muted">(optional)</span></span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-feld="gw" value="' + esc(b.werte.gateway) + '" placeholder="z. B. 192.168.1.1"></label>' +
        '<div class="meldung" data-meldung="gw">' + meldungHtml(feldMeldung(b, 'gw')) + '</div>';
      h += '<label class="ctrl"><span>DNS-Server <span class="muted">(optional)</span></span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-feld="dns" value="' + esc(b.werte.dns) + '"></label>' +
        '<div class="meldung" data-meldung="dns">' + meldungHtml(feldMeldung(b, 'dns')) + '</div>';
      if (b.werte.dienste) h += '<h3>Dienste</h3>' +
        '<label class="haken"><input type="checkbox" data-feld="wert:dienst:web"' + (b.werte.dienste.web ? ' checked' : '') + '> Webserver (HTTP, Port 80)</label>' +
        '<label class="haken"><input type="checkbox" data-feld="wert:dienst:https"' + (b.werte.dienste.https ? ' checked' : '') + '> Sicheres Web (HTTPS, Port 443)</label>' +
        '<p class="small muted">Ping beantwortet jedes Endgerät. Für „Web“-Tests muss der passende Dienst eingeschaltet sein.</p>';
    } else if (b.typ === 'ap') {
      h += '<label class="ctrl"><span>Netzwerkname (SSID)</span><input type="text" autocomplete="off" spellcheck="false" data-feld="wert:ssid" value="' + esc(b.werte.ssid) + '"></label>' +
        '<label class="ctrl"><span>WLAN-Schlüssel <span class="muted">(leer = offenes WLAN; nur Simulation)</span></span><input type="text" autocomplete="off" spellcheck="false" data-feld="wert:schluessel" value="' + esc(b.werte.schluessel) + '"></label>' +
        '<label class="ctrl"><span>Reichweite <output data-ausgabe="reichweite">' + b.werte.reichweite + '</output></span><input type="range" min="80" max="600" step="10" data-feld="wert:reichweite" value="' + b.werte.reichweite + '" aria-label="Reichweite"></label>' +
        '<div class="meldung" data-meldung="kunden">' + meldungHtml(feldMeldung(b, 'kunden')) + '</div>' +
        '<p class="small muted">LAN-Anschluss eth0: ' + gegenstelleText(b, 'eth0') + '. Der Access Point arbeitet wie ein Switch mit Funk (Schicht 2) und braucht selbst keine IP-Adresse. Die Reichweite ist eine Vereinfachung (fester Kreis, keine Wände).</p>';
      h += macTabelle(b);
    } else if (T.routet) {
      Object.keys(b.werte.ifs).forEach(function (p) { h += ifFeld(b, p, 'Schnittstelle ' + p); });
      h += '<h3>Routing-Tabelle</h3><div class="tab-rahmen" data-routen-tabelle>' + routenTabelle(b) + '</div>' +
        '<p class="small muted">C = direkt angeschlossenes Netz (automatisch aus den Schnittstellen), S = statische Route (unten eintragen). Bei mehreren passenden Einträgen gewinnt der längste Präfix.</p>';
      h += b.werte.routen.map(function (r) {
        var k = 'route:' + r.id;
        return '<fieldset class="route"><legend>Statische Route ' + esc(r.id.slice(1)) + '</legend><div class="felder3">' +
          '<label class="ctrl"><span>Zielnetz</span><input type="text" inputmode="decimal" spellcheck="false" data-feld="' + k + ':ziel" value="' + esc(r.ziel) + '" placeholder="192.168.2.0"></label>' +
          '<label class="ctrl"><span>Maske</span><input type="text" inputmode="decimal" spellcheck="false" data-feld="' + k + ':maske" value="' + esc(r.maske) + '" placeholder="/24"></label>' +
          '<label class="ctrl"><span>Nächster Hop</span><input type="text" inputmode="decimal" spellcheck="false" data-feld="' + k + ':via" value="' + esc(r.via) + '" placeholder="10.0.0.2"></label></div>' +
          '<div class="meldung" data-meldung="' + k + '">' + meldungHtml(feldMeldung(b, k)) + '</div>' +
          '<div class="row eng"><label class="haken"><input type="checkbox" data-feld="' + k + ':aktiv"' + (r.aktiv ? ' checked' : '') + '> Route aktiv</label>' +
          '<button type="button" data-route-loeschen="' + r.id + '" class="gefahr">Route löschen</button></div></fieldset>';
      }).join('');
      h += '<button type="button" data-aktion="route-neu"' + (b.werte.routen.length >= 16 ? ' disabled' : '') + '>+ Route hinzufügen</button>';
      if (b.typ === 'firewall') h += firewallRegeln(b);
    } else if (b.typ === 'switch') {
      h += '<h3>Ports</h3><ul class="ports">' + Object.keys(M.ports(b)).map(function (p) {
        return '<li><b>' + esc(M.anschlussName(b, p)) + '</b>: ' + gegenstelleText(b, p) + '</li>';
      }).join('') + '</ul>';
      h += macTabelle(b);
    }
    h += '<div class="knoepfe"><button type="button" data-aktion="loeschen" class="gefahr">Gerät entfernen</button></div>';
    z.innerHTML = h;
  }
  /** Gelernte MAC-Adressen eines Switches oder Access Points (aus der letzten Simulation). */
  function macTabelle(b) {
      var tab = st.mac[b.id] || {}, eintraege = Object.keys(tab);
      return '<h3>Gelernte MAC-Adressen</h3>' + (eintraege.length
        ? '<table class="werte"><thead><tr><th>MAC-Adresse</th><th>Port</th><th>Gerät</th></tr></thead><tbody>' + eintraege.map(function (m) {
          var g = st.doc.bauteile.filter(function (x) { return Object.keys(x.werte.ifs || M.ports(x)).some(function (p) { return M.mac(x, p) === m; }); })[0];
          return '<tr><td><code>' + esc(m) + '</code></td><td>' + esc(M.anschlussName(b, tab[m])) + '</td><td>' + esc(g ? g.name : '?') + '</td></tr>';
        }).join('') + '</tbody></table>'
        : '<p class="small muted">Noch leer. Gelernt wird erst, wenn Verkehr durchläuft – teste eine Verbindung.</p>') +
        '<p class="small muted">Vereinfachtes Modell: Gemerkt wird die Absender-MAC jedes Rahmens. Ist das Ziel noch unbekannt, wird der Rahmen an alle anderen Ports geflutet. VLANs werden nicht simuliert. Die Tabelle wird bei jeder Änderung am Netz geleert.</p>';
  }
  /** Regel-Editor einer Firewall: Reihenfolge zählt, erste passende Regel gilt. */
  function firewallRegeln(b) {
    var D = M.DIENSTE;
    var h = '<h3>Firewall-Regeln</h3><p class="small muted">Jedes Paket wird von oben nach unten geprüft – die <b>erste passende</b> Regel entscheidet. Passt keine, gilt die Standardrichtlinie. Antworten auf erlaubte Verbindungen dürfen automatisch zurück. Adressen: „alle“, eine Adresse (10.0.0.5) oder ein Netz (192.168.1.0/24).</p>';
    h += b.werte.regeln.map(function (r, i) {
      var k = 'regel:' + r.id;
      return '<fieldset class="route regel ' + r.aktion + '"><legend>Regel ' + (i + 1) + '</legend><div class="felder2">' +
        '<label class="ctrl"><span>Aktion</span><select data-feld="' + k + ':aktion"><option value="erlauben"' + (r.aktion === 'erlauben' ? ' selected' : '') + '>erlauben</option><option value="blockieren"' + (r.aktion === 'blockieren' ? ' selected' : '') + '>blockieren</option></select></label>' +
        '<label class="ctrl"><span>Dienst</span><select data-feld="' + k + ':dienst"><option value="alle"' + (r.dienst === 'alle' ? ' selected' : '') + '>alle Dienste</option>' +
        Object.keys(D).map(function (d) { return '<option value="' + d + '"' + (r.dienst === d ? ' selected' : '') + '>' + esc(D[d].kurz) + '</option>'; }).join('') + '</select></label>' +
        '<label class="ctrl"><span>Quelle</span><input type="text" spellcheck="false" data-feld="' + k + ':quelle" value="' + esc(r.quelle) + '" placeholder="alle"></label>' +
        '<label class="ctrl"><span>Ziel</span><input type="text" spellcheck="false" data-feld="' + k + ':ziel" value="' + esc(r.ziel) + '" placeholder="alle"></label></div>' +
        '<div class="meldung" data-meldung="' + k + '">' + meldungHtml(feldMeldung(b, k)) + '</div>' +
        '<div class="row eng"><label class="haken"><input type="checkbox" data-feld="' + k + ':aktiv"' + (r.aktiv ? ' checked' : '') + '> aktiv</label>' +
        '<button type="button" data-regel="hoch" data-id="' + r.id + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Regel ' + (i + 1) + ' nach oben">↑</button>' +
        '<button type="button" data-regel="runter" data-id="' + r.id + '"' + (i === b.werte.regeln.length - 1 ? ' disabled' : '') + ' aria-label="Regel ' + (i + 1) + ' nach unten">↓</button>' +
        '<button type="button" data-regel="loeschen" data-id="' + r.id + '" class="gefahr">Löschen</button></div></fieldset>';
    }).join('');
    h += '<button type="button" data-aktion="regel-neu"' + (b.werte.regeln.length >= 16 ? ' disabled' : '') + '>+ Regel hinzufügen</button>';
    h += '<label class="ctrl standard"><span>Standardrichtlinie (wenn keine Regel passt)</span><select data-feld="wert:standard"><option value="blockieren"' + (b.werte.standard === 'blockieren' ? ' selected' : '') + '>blockieren (empfohlen)</option><option value="erlauben"' + (b.werte.standard === 'erlauben' ? ' selected' : '') + '>erlauben</option></select></label>';
    return h;
  }
  function routenTabelle(b) {
    return '<table class="werte routen"><thead><tr><th>Typ</th><th>Zielnetz</th><th>Nächster Hop</th><th>Aktiv</th></tr></thead><tbody>' +
      S.routingTabelle(b).map(function (r) {
        if (r.art === 'C') return '<tr><td title="direkt angeschlossen">C</td><td>' + esc(r.ziel) + '</td><td>direkt (' + esc(r.schnittstelle) + ')</td><td>' + (r.aktiv ? 'ja' : '<span class="warn">nein</span>') + '</td></tr>';
        return '<tr><td title="statisch eingetragen">S</td><td>' + esc(r.ziel) + '</td><td>' + esc(r.via) + '</td><td>' + (r.aktiv ? 'ja' : '<span class="warn">nein</span>') + (r.gueltig ? '' : ' <span class="warn">!</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  /** Nur Prüfmeldungen und abgeleitete Anzeigen neu schreiben – Eingabefelder bleiben stehen (Fokus, Cursor). */
  function meldungenAktualisieren(b) {
    var a = st.auswahl;
    b = b || (a && a.art === 'bauteil' && M.finde(st.doc, a.id));
    if (!b) return;
    $('eig').querySelectorAll('[data-meldung]').forEach(function (el) { if (el.dataset.meldung !== 'name') el.innerHTML = meldungHtml(feldMeldung(b, el.dataset.meldung)); });
    var t = $('eig').querySelector('[data-routen-tabelle]');
    if (t && SL.TYPEN[b.typ].routet) t.innerHTML = routenTabelle(b);
    var o = $('eig').querySelector('[data-ausgabe="reichweite"]');
    if (o && b.typ === 'ap') o.textContent = b.werte.reichweite;
  }
  $('eig').addEventListener('input', function (e) {
    var x = e.target, a = st.auswahl, b = a && a.art === 'bauteil' && M.finde(st.doc, a.id);
    if (!b) return;
    if (!x._gemerkt) { merke(); x._gemerkt = true; }
    if (x.hasAttribute('data-name')) {
      var ok = M.setzeName(st.doc, b.id, x.value);
      $('eig').querySelector('[data-meldung="name"]').innerHTML = ok ? '' : meldungHtml('Diesen Namen hat schon ein anderes Gerät.');
    } else if (x.dataset.feld && x.type !== 'checkbox' && x.tagName !== 'SELECT') setzeFeld(b, x.dataset.feld, x.value);
    simStopp(); st.mac = {};
    zeichne(); meldungenAktualisieren(b); speichere(); aufgabeLive();
  });
  $('eig').addEventListener('change', function (e) {
    var x = e.target, a = st.auswahl, b = a && a.art === 'bauteil' && M.finde(st.doc, a.id);
    if (!b) return;
    x._gemerkt = false;
    if (x.type === 'checkbox') { merke(); setzeFeld(b, x.dataset.feld, x.checked); geaendert(); return; }
    if (x.tagName === 'SELECT' && x.dataset.feld) { merke(); setzeFeld(b, x.dataset.feld, x.value); geaendert(); return; }
    geaendert('feld');
  });
  function setzeFeld(b, feld, wert) {
    var t = feld.split(':');
    if (t[0] === 'if') M.setzeIf(st.doc, b.id, t[1], t[2], wert);
    else if (t[0] === 'gw') M.setzeWert(st.doc, b.id, 'gateway', wert);
    else if (t[0] === 'dns') M.setzeWert(st.doc, b.id, 'dns', wert);
    else if (t[0] === 'route') M.routeSetze(st.doc, b.id, t[1], t[2], wert);
    else if (t[0] === 'regel') M.regelSetze(st.doc, b.id, t[1], t[2], wert);
    else if (t[0] === 'wert') M.setzeWert(st.doc, b.id, t.slice(1).join(':'), wert);
  }
  $('eig').addEventListener('click', function (e) {
    var x = e.target.closest('button'); if (!x) return;
    var a = st.auswahl, b = a && a.art === 'bauteil' && M.finde(st.doc, a.id);
    if (x.dataset.aktion === 'loeschen') loeschen();
    else if (x.dataset.aktion === 'route-neu' && b) { merke(); M.routeHinzu(st.doc, b.id); geaendert(); var f = $('eig').querySelectorAll('fieldset.route input'); if (f.length) f[f.length - 3].focus(); }
    else if (x.dataset.routeLoeschen && b) { merke(); M.routeLoesche(st.doc, b.id, x.dataset.routeLoeschen); geaendert(); }
    else if (x.dataset.aktion === 'regel-neu' && b) { merke(); M.regelHinzu(st.doc, b.id); geaendert(); var q = $('eig').querySelectorAll('fieldset.regel input[type=text]'); if (q.length) q[q.length - 2].focus(); }
    else if (x.dataset.regel && b) {
      merke();
      if (x.dataset.regel === 'loeschen') M.regelLoesche(st.doc, b.id, x.dataset.id);
      else M.regelVerschiebe(st.doc, b.id, x.dataset.id, x.dataset.regel === 'hoch' ? -1 : 1);
      geaendert();
    }
  });

  function loeschen() {
    if (!st.auswahl) { toast('Wähle zuerst ein Gerät oder ein Kabel aus.', 'hinweis'); return; }
    var vorher = M.kopie(st.doc);
    if (!M.loesche(st.doc, st.auswahl)) return;
    merke(vorher); st.auswahl = null; geaendert();
  }
  function rueckgaengig() {
    var alt = st.verlauf.pop(); if (!alt) return;
    st.zukunft.push(JSON.stringify(st.doc)); st.doc = JSON.parse(alt); geaendert();
  }
  function wiederholen() {
    var neu = st.zukunft.pop(); if (!neu) return;
    st.verlauf.push(JSON.stringify(st.doc)); st.doc = JSON.parse(neu); geaendert();
  }

  // ---------------------------------------------------------------- Verbindung testen und Paketanimation
  function endgeraete() { return st.doc.bauteile.filter(function (b) { return SL.TYPEN[b.typ].endgeraet; }); }
  function auswahlListen() {
    var e = endgeraete(), q = $('quelle'), z = $('ziel'), vq = q.value, vz = z.value;
    var opt = e.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>'; }).join('') || '<option value="">– keine Endgeräte –</option>';
    q.innerHTML = opt; z.innerHTML = opt;
    if (vq && M.finde(st.doc, vq)) q.value = vq;
    if (vz && M.finde(st.doc, vz)) z.value = vz; else if (e[1]) z.value = e[1].id;
    if (q.value === z.value && e.length > 1) z.value = e.find(function (b) { return b.id !== q.value; }).id;
    $('testen').disabled = $('senden').disabled = e.length < 2;
  }

  var STATUS_TEXT = { erfolg: ['ok', '✓ Verbindung erfolgreich'], fehler: ['fehler', '✕ Keine Verbindung'], unklar: ['unklar', '? Ergebnis unklar'] };
  function zeigeErgebnis(erg, bisSchritt) {
    var s = STATUS_TEXT[erg.status];
    $('ergebnis').innerHTML = bisSchritt === undefined || bisSchritt >= erg.ablauf.length - 1
      ? '<div class="test-ergebnis ' + s[0] + '"><b>' + s[1] + '</b><p class="small">' + esc(erg.meldung) + '</p></div>' : '<p class="small muted">Paket unterwegs …</p>';
    var aktuell = -1, sichtbar = erg.schritte.length;
    if (bisSchritt !== undefined) {
      sichtbar = 0;
      erg.ablauf.slice(0, bisSchritt + 1).forEach(function (x) { if (x.typ === 'schritt') { sichtbar = x.i + 1; aktuell = x.i; } });
    }
    var phase = null;
    $('schritte').innerHTML = erg.schritte.slice(0, sichtbar).map(function (sch, i) {
      var kopf = sch.phase !== phase ? '<li class="phase">' + (sch.phase === 'antwort' ? 'Antwort zurück' : 'Anfrage') + '</li>' : '';
      phase = sch.phase;
      return kopf + '<li class="schritt ' + sch.art + (i === aktuell ? ' aktuell' : '') + '"><b>' + esc(sch.name) + '</b>' + (sch.schnittstelle ? ' <span class="muted">(' + esc(sch.schnittstelle) + ')</span>' : '') +
        (sch.naechster ? ' → nächster Hop <b>' + esc(sch.naechster) + '</b>' : '') + '<br><span class="small">' + esc(sch.grund) + '</span></li>';
    }).join('');
  }
  function testen() {
    var q = $('quelle').value, z = $('ziel').value;
    simStopp();
    st.mac = {};
    var erg = S.sende(st.doc, q, z, st.mac, $('dienst').value);
    st.test = { q: q, z: z };
    protokolliere(q, z, erg);
    zeigeErgebnis(erg);
    zeichne(); eigenschaften();
  }
  /** Testprotokoll (letzte 12 Tests) – besonders für den freien Testmodus. */
  function protokolliere(q, z, erg) {
    var bq = M.finde(st.doc, q), bz = M.finde(st.doc, z);
    if (!bq || !bz) return;
    st.log.unshift({ q: q, z: z, dienst: erg.dienst, status: erg.status, text: bq.name + ' → ' + bz.name, meldung: erg.meldung });
    st.log = st.log.slice(0, 12);
    zeigeProtokoll();
  }
  function zeigeProtokoll() {
    var l = $('testlog');
    l.hidden = !st.log.length;
    l.innerHTML = '<h3>Testprotokoll</h3><ol>' + st.log.map(function (x, i) {
      var s = STATUS_TEXT[x.status];
      return '<li><button type="button" class="log ' + s[0] + '" data-log="' + i + '" title="' + esc(x.meldung) + '"><span class="log-zeichen">' + s[1].charAt(0) + '</span> ' + esc(x.text) + ' <span class="muted">· ' + esc(M.DIENSTE[x.dienst].kurz) + '</span></button></li>';
    }).join('') + '</ol><button type="button" id="log-leeren" class="klein">Protokoll leeren</button>';
  }

  // Paketanimation: läuft erg.ablauf ab. Ein Generationszähler verhindert, dass alte Animationen nach Stopp/Neustart weiterlaufen.
  var DAUER_KABEL = 650, DAUER_SCHRITT = 650;
  function senden() {
    var q = $('quelle').value, z = $('ziel').value;
    simStopp();
    st.mac = {};
    var erg = S.sende(st.doc, q, z, st.mac, $('dienst').value);
    st.test = { q: q, z: z };
    protokolliere(q, z, erg);
    if (!erg.ablauf.length) { zeigeErgebnis(erg); zeichne(); return; }
    st.sim = { erg: erg, k: 0, t0: null, laeuft: true, raf: null, paket: null, gen: (st.sim && st.sim.gen || 0) + 1 };
    $('abspielen').hidden = false;
    pauseKnopf();
    simZeichne(0);
    simWeiter();
  }
  function posGeraet(id) { var b = M.finde(st.doc, id); return b ? { x: b.x, y: b.y } : null; }
  function simZeichne(anteil) {
    var sim = st.sim, x = sim.erg.ablauf[sim.k];
    if (x.typ === 'kabel') {
      var st2 = sim.erg.pfad[x.i], a = M.anschlussPos(st.doc, st2.von), b = M.anschlussPos(st.doc, st2.nach);
      if (a && b) sim.paket = { x: a.x + (b.x - a.x) * anteil, y: a.y + (b.y - a.y) * anteil, phase: st2.phase };
    } else {
      var s = sim.erg.schritte[x.i], p = s.geraet && posGeraet(s.geraet);
      if (p) sim.paket = { x: p.x, y: p.y - 6, phase: s.phase, fehler: s.art === 'fehler' };
    }
    zeigeErgebnis(sim.erg, sim.k);
    zeichne();
  }
  function simWeiter() {
    var sim = st.sim; if (!sim || !sim.laeuft) return;
    var gen = sim.gen;
    var dauer = reduziert ? 0 : sim.erg.ablauf[sim.k].typ === 'kabel' ? DAUER_KABEL : DAUER_SCHRITT;
    sim.t0 = null;
    var f = function (t) {
      if (!st.sim || st.sim.gen !== gen || !st.sim.laeuft) return;
      if (sim.t0 === null) sim.t0 = t;
      var anteil = dauer ? Math.min(1, (t - sim.t0) / dauer) : 1;
      simZeichne(anteil);
      if (anteil < 1 || (reduziert && t - sim.t0 < 500)) { sim.raf = requestAnimationFrame(f); return; }
      if (sim.k >= sim.erg.ablauf.length - 1) { simEnde(); return; }
      sim.k++; simWeiter();
    };
    sim.raf = requestAnimationFrame(f);
  }
  function simEnde() {
    var sim = st.sim; if (!sim) return;
    sim.laeuft = false; sim.k = sim.erg.ablauf.length - 1;
    zeigeErgebnis(sim.erg);
    pauseKnopf(true);
    zeichne(); eigenschaften();
  }
  function simStopp() {
    var sim = st.sim;
    if (sim && sim.raf) cancelAnimationFrame(sim.raf);
    st.sim = null;
    $('abspielen').hidden = true;
  }
  function pauseKnopf(fertig) {
    var b = $('pause'), sim = st.sim;
    b.disabled = !!fertig; $('schritt').disabled = !!fertig;
    b.setAttribute('aria-pressed', sim && !sim.laeuft && !fertig ? 'true' : 'false');
    b.textContent = sim && !sim.laeuft && !fertig ? '▶ Weiter' : '⏸ Pause';
  }
  $('pause').addEventListener('click', function () {
    var sim = st.sim; if (!sim) return;
    sim.laeuft = !sim.laeuft;
    if (sim.raf) cancelAnimationFrame(sim.raf);
    pauseKnopf();
    if (sim.laeuft) simWeiter();
  });
  $('schritt').addEventListener('click', function () {
    var sim = st.sim; if (!sim) return;
    sim.laeuft = false; if (sim.raf) cancelAnimationFrame(sim.raf);
    if (sim.k >= sim.erg.ablauf.length - 1) { simEnde(); return; }
    sim.k++; simZeichne(1); pauseKnopf();
    if (sim.k >= sim.erg.ablauf.length - 1) simEnde();
  });
  $('stopp').addEventListener('click', function () { simStopp(); st.test = null; $('ergebnis').innerHTML = ''; $('schritte').innerHTML = ''; zeichne(); });
  $('testen').addEventListener('click', testen);
  $('dienst').addEventListener('change', function () { simStopp(); $('ergebnis').innerHTML = ''; $('schritte').innerHTML = ''; zeichne(); });
  $('testlog').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'log-leeren') { st.log = []; zeigeProtokoll(); return; }
    var x = st.log[Number(b.dataset.log)];
    if (!x || !M.finde(st.doc, x.q) || !M.finde(st.doc, x.z)) { toast('Eines der Geräte gibt es nicht mehr.', 'hinweis'); return; }
    $('quelle').value = x.q; $('ziel').value = x.z; $('dienst').value = x.dienst;
    st.log.splice(Number(b.dataset.log), 1);
    senden();
  });
  // Freier Testmodus: Endgeräte antippen statt konfigurieren, jeder Test wird sofort als Paket abgespielt und protokolliert
  function testmodus(an) {
    st.testmodus = an; st.pick = null;
    var k = $('testmodus');
    k.setAttribute('aria-pressed', String(an));
    $('testmodus-hinweis').hidden = !an;
    document.body.classList.toggle('testend', an);
    if (an) { st.auswahl = null; eigenschaften(); knoepfe(); $('test-karte').scrollIntoView({ block: 'nearest' }); toast('Freier Testmodus: Tippe Quelle und Ziel an. Geräte lassen sich weiter verschieben.', 'hinweis'); }
    else { st.test = null; toast('Testmodus beendet – Geräte antippen öffnet wieder die Konfiguration.', 'hinweis'); }
    zeichne();
  }
  $('testmodus').addEventListener('click', function () { testmodus(!st.testmodus); });
  $('testmodus-ende').addEventListener('click', function () { testmodus(false); });
  $('senden').addEventListener('click', senden);
  ['quelle', 'ziel'].forEach(function (id) { $(id).addEventListener('change', function () { simStopp(); st.test = null; $('ergebnis').innerHTML = ''; $('schritte').innerHTML = ''; zeichne(); }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && st.sim && st.sim.laeuft) { st.sim.laeuft = false; if (st.sim.raf) cancelAnimationFrame(st.sim.raf); pauseKnopf(); } });

  // ---------------------------------------------------------------- Netzwerk prüfen
  $('pruefen').addEventListener('click', function () {
    var r = S.pruefeNetz(st.doc), k = $('diagnose-karte');
    k.hidden = false;
    var namen = {}; st.doc.bauteile.forEach(function (b) { namen[b.id] = b.name; });
    $('diagnose').innerHTML = '<ul class="meldungen">' + r.meldungen.map(function (m) { return '<li class="' + (m.art === 'fehler' ? 'fehler' : m.art === 'warnung' ? 'warnung' : m.art === 'ok' ? 'ok' : '') + '">' + esc(m.text) + '</li>'; }).join('') + '</ul>' +
      (r.erreichbar.length ? '<h3>Wer erreicht wen?</h3><table class="werte erreichbar"><tbody>' + r.erreichbar.map(function (x) {
        var s = STATUS_TEXT[x.status];
        return '<tr title="' + esc(x.meldung) + '"><td>' + esc(namen[x.a]) + ' ↔ ' + esc(namen[x.b]) + '</td><td class="' + s[0] + '">' + (x.status === 'erfolg' ? '✓ ja' : x.status === 'unklar' ? '? unklar' : '✕ nein') + '</td></tr>';
      }).join('') + '</tbody></table><p class="small muted">Zeile antippen bzw. darauf zeigen für den Grund. „Verbindung testen“ zeigt alle Schritte.</p>' : '');
    k.scrollIntoView({ block: 'nearest' });
  });

  // ---------------------------------------------------------------- Aufgaben
  function aufgabenListe() {
    $('aufgaben').innerHTML = '<option value="">Lernaufgaben …</option>' + A.liste.map(function (a) {
      return '<option value="' + a.id + '">' + (st.erledigt[a.id] ? '✓ ' : '') + esc(a.titel) + '</option>';
    }).join('');
  }
  function aufgabeLaden(id) {
    var a = A.finde(id); if (!a) return;
    merke();
    simStopp(); st.test = null; $('ergebnis').innerHTML = ''; $('schritte').innerHTML = ''; $('diagnose-karte').hidden = true;
    st.doc = a.bauen(); st.auswahl = null; st.aufgabe = id; st.hinweise = 0; st.rueckmeldung = null;
    geaendert();
    bed.einpassen();
    aufgabePanel();
    toast('Aufgabe geladen: ' + a.titel + '. Mit ↶ kommst du zu deinem vorherigen Netz zurück.', 'hinweis');
  }
  function aufgabePanel() {
    var k = $('aufgabe-karte'), a = st.aufgabe && A.finde(st.aufgabe);
    k.hidden = !a;
    if (!a) return;
    var rm = st.rueckmeldung;
    $('aufgabe').innerHTML = '<h3>' + esc(a.titel) + (st.erledigt[a.id] ? ' <span class="badge-ok">gelöst</span>' : '') + '</h3>' +
      '<p class="small">' + esc(a.beschreibung) + '</p><p class="small"><b>Ziel:</b> ' + esc(a.ziel) + '</p>' +
      (st.hinweise ? '<ol class="small hinweise">' + a.hinweise.slice(0, st.hinweise).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ol>' : '') +
      '<div class="row eng"><button type="button" class="primary" data-a="pruefen">Aufgabe prüfen</button>' +
      (st.hinweise < a.hinweise.length ? '<button type="button" data-a="hinweis">Hinweis ' + (st.hinweise + 1) + ' zeigen</button>' : '') +
      '<button type="button" data-a="neu">Neu laden</button><button type="button" data-a="schliessen">Beenden</button></div>' +
      (rm ? '<div class="test-ergebnis ' + (rm.ok ? 'ok' : 'fehler') + '"><b>' + (rm.ok ? '✓ Geschafft!' : 'Noch nicht') + '</b><p class="small">' + esc(rm.ok ? a.ziel : rm.text) + '</p>' +
        (rm.ok ? '<p class="small"><b>Erklärung:</b> ' + esc(a.erklaerung) + '</p>' : '') + '</div>' : '');
  }
  /** Nach Änderungen: Erfolg sofort melden (Misserfolg erst auf „Aufgabe prüfen“). */
  function aufgabeLive() {
    if (!st.aufgabe) return;
    var a = A.finde(st.aufgabe), r = a.pruefe(st.doc);
    if (r.ok && !(st.rueckmeldung && st.rueckmeldung.ok)) { st.rueckmeldung = r; markiereErledigt(a.id); aufgabePanel(); }
    else if (!r.ok && st.rueckmeldung && st.rueckmeldung.ok) { st.rueckmeldung = null; aufgabePanel(); }
  }
  function markiereErledigt(id) { if (!st.erledigt[id]) { st.erledigt[id] = true; aufgabenListe(); speichere(); } }
  $('aufgaben').addEventListener('change', function () { var id = this.value; this.value = ''; if (id) aufgabeLaden(id); });
  $('aufgabe').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || !st.aufgabe) return;
    var a = A.finde(st.aufgabe);
    if (b.dataset.a === 'pruefen') { st.rueckmeldung = a.pruefe(st.doc); if (st.rueckmeldung.ok) markiereErledigt(a.id); }
    if (b.dataset.a === 'hinweis') st.hinweise = Math.min(a.hinweise.length, st.hinweise + 1);
    if (b.dataset.a === 'neu') { aufgabeLaden(a.id); return; }
    if (b.dataset.a === 'schliessen') { st.aufgabe = null; }
    aufgabePanel();
  });
  $('leer-aufgabe').addEventListener('click', function () { aufgabeLaden('zwei-pcs'); });

  // ---------------------------------------------------------------- Werkzeugleiste
  $('neu').addEventListener('click', function () {
    if (!st.doc.bauteile.length) return;
    merke(); st.doc = M.neu(); st.auswahl = null; st.aufgabe = null; aufgabePanel(); geaendert(); toast('Arbeitsfläche geleert. Mit ↶ holst du alles zurück.', 'hinweis');
  });
  $('rueck').addEventListener('click', rueckgaengig);
  $('vor').addEventListener('click', wiederholen);
  $('loeschen').addEventListener('click', loeschen);
  $('aufraeumen').addEventListener('click', function () { bed.einpassen(); });
  $('export').addEventListener('click', function () {
    var blob = new Blob([M.exportiere(st.doc)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'netzwerk.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  $('import').addEventListener('change', function () {
    var f = this.files && this.files[0], feld = this; if (!f) return;
    if (f.size > 300000) { toast('Die Datei ist zu groß.', 'fehler'); feld.value = ''; return; }
    var r = new FileReader();
    r.onload = function () {
      var x = M.importiere(String(r.result)); feld.value = '';
      if (!x.ok) { toast(x.fehler, 'fehler'); return; }
      merke(); st.doc = x.doc; st.auswahl = null; st.aufgabe = null; aufgabePanel(); geaendert(); bed.einpassen();
      toast(x.hinweise.length ? 'Geladen. ' + x.hinweise[0] : 'Netzwerk geladen.', x.hinweise.length ? 'hinweis' : 'ok');
    };
    r.readAsText(f);
  });
  $('hilfe').addEventListener('click', function () { var h = $('hilfetext'), offen = h.hidden; h.hidden = !offen; this.setAttribute('aria-expanded', String(offen)); if (offen) h.scrollIntoView({ block: 'nearest' }); });
  var mitte = function () { return { x: groesse.w / 2, y: groesse.h / 2 }; };
  $('zoom-plus').addEventListener('click', function () { bed.zoomUm(mitte(), 1.25); });
  $('zoom-minus').addEventListener('click', function () { bed.zoomUm(mitte(), 0.8); });
  $('zoom-fit').addEventListener('click', function () { bed.einpassen(); });

  document.addEventListener('keydown', function (e) {
    if (e.target.closest('input, select, textarea')) return;
    var taste = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && taste === 'z' && !e.shiftKey) { e.preventDefault(); rueckgaengig(); }
    else if ((e.ctrlKey || e.metaKey) && (taste === 'y' || (taste === 'z' && e.shiftKey))) { e.preventDefault(); wiederholen(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && st.auswahl) { e.preventDefault(); loeschen(); }
    else if (e.key === 'Escape') { if (bed.escape()) return; if (st.testmodus) testmodus(false); else if (st.auswahl) waehle(null); }
  });

  // ---------------------------------------------------------------- Start
  (function laden() {
    try { JSON.parse(localStorage.getItem(SPEICHER_AUFGABEN) || '[]').forEach(function (id) { if (A.finde(id)) st.erledigt[id] = true; }); } catch (e) { /* egal */ }
    var text = null;
    try { text = localStorage.getItem(SPEICHER); } catch (e) { /* kein Speicher */ }
    if (text) { var x = M.importiere(text); if (x.ok) st.doc = x.doc; }
    aufgabenListe();
    auswahlListen();
    eigenschaften();
    knoepfe();
    zeichne();
    bed.einpassen();
  })();
  // Für automatisierte Browser-Tests: lesender Zugriff auf den Zustand
  SL.netzAnsicht = { zustand: function () { return st; }, bed: bed };
})();
