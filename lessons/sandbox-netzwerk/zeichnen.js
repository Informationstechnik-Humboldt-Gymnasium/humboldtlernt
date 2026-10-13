// Netzwerk-Labor · Darstellung (SVG-Markup). Rechnet nichts: Zustände kommen aus Modell und Simulation.
// Zustände sind nie nur an der Farbe erkennbar: deaktivierte Schnittstellen haben ein ✕ und gestrichelte Kabel,
// ungültige IP-Angaben stehen mit „!“ unter dem Gerät.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});
  var M = function () { return SL.modell; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var n1 = function (v) { return Math.round(v * 10) / 10; };
  function text(x, y, s, cls, anker) { return '<text x="' + n1(x) + '" y="' + n1(y) + '" class="' + (cls || '') + '"' + (anker ? ' text-anchor="' + anker + '"' : '') + '>' + esc(s) + '</text>'; }

  /** Symbol eines Gerätetyps in lokalen Koordinaten (auch für die Leiste). */
  function symbol(typ) {
    switch (typ) {
      case 'pc':
        return '<rect x="-30" y="-28" width="60" height="40" rx="4" class="geraet"/><rect x="-24" y="-22" width="48" height="28" rx="2" class="bildschirm"/>' +
          '<path d="M-6,12 L-8,22 L8,22 L6,12" class="geraet"/><line x1="-16" y1="23" x2="16" y2="23" class="leiter"/>';
      case 'server':
        return '<rect x="-24" y="-32" width="48" height="60" rx="4" class="geraet"/>' +
          [-22, -6, 10].map(function (y) { return '<rect x="-18" y="' + y + '" width="36" height="11" rx="2" class="einschub"/><circle cx="12" cy="' + (y + 5.5) + '" r="2.2" class="led"/>'; }).join('');
      case 'switch':
        return '<rect x="-88" y="-20" width="176" height="40" rx="6" class="geraet"/>' +
          '<path d="M-74,-6 L-50,-6 M-56,-11 L-50,-6 L-56,-1 M-50,6 L-74,6 M-68,1 L-74,6 L-68,11" class="leiter duenn"/>';
      case 'router':
        return '<circle r="30" class="geraet"/>' +
          '<path d="M-17,0 L17,0 M0,-17 L0,17 M-17,0 l6,-5 M-17,0 l6,5 M17,0 l-6,-5 M17,0 l-6,5 M0,-17 l-5,6 M0,-17 l5,6 M0,17 l-5,-6 M0,17 l5,-6" class="leiter duenn"/>';
      case 'firewall':
        // Gehäuse mit Mauerwerk (Ziegel) – das übliche Bild für eine Firewall
        return '<rect x="-32" y="-28" width="64" height="56" rx="5" class="geraet"/>' +
          '<path d="M-26,-14 H26 M-26,0 H26 M-26,14 H26 M-10,-28 V-14 M14,-28 V-14 M-20,-14 V0 M4,-14 V0 M22,-14 V0 M-10,0 V14 M14,0 V14 M-20,14 V28 M4,14 V28 M22,14 V28" class="mauer"/>';
      case 'ap':
        // Gerät mit zwei Antennen und Funkwellen
        return '<rect x="-28" y="-8" width="56" height="22" rx="6" class="geraet"/><circle cx="-14" cy="3" r="2.4" class="led"/><circle cx="-5" cy="3" r="2.4" class="led"/>' +
          '<path d="M-18,-8 L-22,-22 M18,-8 L22,-22" class="leiter"/><path d="M-8,-17 a10,10 0 0,1 16,0 M-14,-22 a18,18 0 0,1 28,0" class="welle"/>';
      case 'laptop':
        return '<rect x="-24" y="-22" width="48" height="32" rx="3" class="geraet"/><rect x="-19" y="-17" width="38" height="22" rx="1.5" class="bildschirm"/>' +
          '<path d="M-32,12 H32 L28,20 H-28 Z" class="geraet"/>';
      case 'smartphone':
        return '<rect x="-13" y="-24" width="26" height="48" rx="5" class="geraet"/><rect x="-9" y="-18" width="18" height="32" rx="1.5" class="bildschirm"/><circle cx="0" cy="19" r="2" class="led aus"/>';
    }
    return '';
  }

  function ifAktiv(doc, ref) { var b = M().finde(doc, ref.b); return !b || !b.werte.ifs || b.werte.ifs[ref.a].aktiv !== false; }

  /** Beschriftung ÜBER einem Gerät (die Anschlüsse liegen unten/seitlich): Name, IP/Präfix je Schnittstelle, Gateway.
   *  Der Switch trägt seinen Namen im Gehäuse. */
  function beschriftung(b) {
    if (b.typ === 'switch') return '';
    var zeilen = [[b.name, 'name']];
    Object.keys(b.werte.ifs || {}).forEach(function (p) {
      var f = b.werte.ifs[p];
      if (!f.ip && !f.maske) return;
      var h = SL.ip.host(f.ip, f.maske), pr = SL.ip.praefix(f.maske);
      var t = (SL.TYPEN[b.typ].routet ? p + ' ' : '') + (f.ip || '?') + (pr.ok ? '/' + pr.praefix : '');
      zeilen.push([(h.ok ? '' : '! ') + t + (f.aktiv === false ? ' (aus)' : ''), 'wert' + (h.ok && f.aktiv !== false ? '' : ' warn')]);
    });
    if (SL.TYPEN[b.typ].endgeraet && b.werte.gateway) zeilen.push(['GW ' + b.werte.gateway, 'wert klein']);
    if (b.typ === 'ap') zeilen.push(['WLAN „' + (b.werte.ssid || '–') + '“' + (b.werte.schluessel ? ' 🔒' : ''), 'wert']);
    if (b.typ === 'firewall') { var nr = b.werte.regeln.filter(function (r) { return r.aktiv; }).length; zeilen.push([nr + (nr === 1 ? ' Regel' : ' Regeln') + ' · sonst ' + b.werte.standard, 'wert klein']); }
    var bx = M().koerper(b), y0 = b.y + bx[1] - 10 - (zeilen.length - 1) * 14;
    return zeilen.map(function (z, i) { return text(b.x, y0 + i * 14, z[0], z[1], 'middle'); }).join('');
  }

  /**
   * Szene: z = { doc, auswahl, vorschau, hover, pfadKabel: { drahtId: 'anfrage'|'antwort' }, paket: { x, y, phase, fehler } | null,
   *              markiert: { geraetId: 'quelle'|'ziel'|'fehler'|'aktuell' } }
   */
  function szene(z) {
    var doc = z.doc, sel = z.auswahl || {}, s = '';
    // Reichweite des ausgewählten Access Points
    doc.bauteile.forEach(function (b) {
      if (b.typ === 'ap' && sel.art === 'bauteil' && sel.id === b.id) s += '<circle cx="' + b.x + '" cy="' + b.y + '" r="' + b.werte.reichweite + '" class="reichweite"/>';
    });
    // Funkverbindungen (WLAN): gestrichelt zwischen Gerät und Access Point; nicht verbundene WLAN-Geräte bekommen „✕ WLAN“
    doc.bauteile.forEach(function (b) {
      if (!SL.TYPEN[b.typ].funk) return;
      var f = M().funk(doc, b), pf = z.pfadKabel && z.pfadKabel['funk:' + b.id];
      if (f.ok) s += '<line x1="' + f.ap.x + '" y1="' + f.ap.y + '" x2="' + b.x + '" y2="' + b.y + '" class="funk' + (b.werte.ifs.wlan0.aktiv === false ? ' inaktiv' : '') + (pf ? ' pfad ' + pf : '') + '"/>';
    });
    // Kabel
    doc.draehte.forEach(function (d) {
      var pts = M().drahtPunkte(doc, d); if (!pts) return;
      var aktiv = ifAktiv(doc, d.von) && ifAktiv(doc, d.nach), pf = z.pfadKabel && z.pfadKabel[d.id];
      s += '<line x1="' + pts[0].x + '" y1="' + pts[0].y + '" x2="' + pts[1].x + '" y2="' + pts[1].y + '" class="kabel' + (aktiv ? '' : ' inaktiv') + (sel.art === 'draht' && sel.id === d.id ? ' gewaehlt' : '') + (pf ? ' pfad ' + pf : '') + '"/>';
      // Link-Anzeige an beiden Enden: ● Verbindung aktiv, ✕ Schnittstelle deaktiviert
      [[d.von, pts[0], pts[1]], [d.nach, pts[1], pts[0]]].forEach(function (e) {
        var dx = e[2].x - e[1].x, dy = e[2].y - e[1].y, l = Math.hypot(dx, dy) || 1, x = e[1].x + dx / l * 13, y = e[1].y + dy / l * 13;
        s += aktiv ? '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="3" class="link an"/>'
          : '<path d="M' + n1(x - 3.5) + ',' + n1(y - 3.5) + ' l7,7 m0,-7 l-7,7" class="link aus"/>';
      });
    });
    // Geräte
    doc.bauteile.forEach(function (b) {
      var bx = M().koerper(b), mk = z.markiert && z.markiert[b.id];
      var gew = sel.art === 'mehrere' ? sel.ids.indexOf(b.id) >= 0 : sel.art === 'bauteil' && sel.id === b.id;
      s += '<g class="bauteil geraet-' + b.typ + (mk ? ' mk-' + mk : '') + '" transform="translate(' + b.x + ',' + b.y + ')">' +
        '<rect x="' + (bx[0] - 5) + '" y="' + (bx[1] - 5) + '" width="' + (bx[2] + 10) + '" height="' + (bx[3] + 10) + '" rx="9" class="flaeche' + (gew ? ' auswahl' : '') + (mk ? ' markiert ' + mk : '') + '"/>' +
        symbol(b.typ) + (b.typ === 'switch' ? text(0, 5, b.name, 'symbol klein', 'middle') : '') + '</g>';
      // Anschlüsse
      M().anschluesse(b).forEach(function (t) {
        var dr = z.vorschau && z.vorschau.art === 'draht';
        var ziel = dr && z.vorschau.ziel && z.vorschau.ziel.b === t.b && z.vorschau.ziel.a === t.a;
        var start = dr && z.vorschau.von.b === t.b && z.vorschau.von.a === t.a;
        var hov = z.hover && z.hover.art === 'anschluss' && z.hover.b === t.b && z.hover.a === t.a;
        var aus = b.werte.ifs && b.werte.ifs[t.a].aktiv === false, belegt = !!M().kabelAn(doc, t);
        s += '<circle cx="' + t.x + '" cy="' + t.y + '" r="' + (dr || hov ? 8 : 5) + '" class="anschluss' + (belegt ? ' belegt' : '') + (aus ? ' aus' : '') + (dr && !belegt ? ' bereit' : '') + (start ? ' start' : '') +
          (ziel ? (z.vorschau.gueltig ? ' ok' : ' falsch') : '') + (hov ? ' hover' : '') + '"/>';
        var ps = M().ports(b)[t.a], lx = t.x + (ps.x < -30 ? -8 : ps.x > 30 ? 8 : 0), ly = t.y + (ps.y > 20 ? 15 : -9);
        if (b.typ !== 'switch' || hov || dr) s += text(lx, ly, ps.text, 'porttext', ps.x < -30 ? 'end' : ps.x > 30 ? 'start' : 'middle');
      });
    });
    // WLAN-Status unter nicht verbundenen Funkgeräten
    doc.bauteile.forEach(function (b) {
      if (SL.TYPEN[b.typ].funk && !M().funk(doc, b).ok) s += text(b.x, b.y + M().koerper(b)[1] + M().koerper(b)[3] + 14, '✕ kein WLAN', 'wert warn', 'middle');
    });
    // Beschriftungen obenauf
    s += '<g class="ebene-text">' + doc.bauteile.map(beschriftung).join('') + '</g>';
    // Vorschau der Bedienung
    var v = z.vorschau;
    if (v && v.art === 'draht') {
      var a = M().anschlussPos(doc, v.von);
      if (a) { var e = v.ziel ? M().anschlussPos(doc, v.ziel) : { x: v.x, y: v.y }; s += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + n1(e.x) + '" y2="' + n1(e.y) + '" class="gummiband' + (v.ziel ? (v.gueltig ? ' ok' : ' falsch') : '') + '"/>'; }
    }
    if (v && v.art === 'neu' && v.drin) s += '<g class="geist" transform="translate(' + v.x + ',' + v.y + ')">' + symbol(v.typ) + '</g>';
    // Paket
    if (z.paket) {
      var p = z.paket;
      s += '<g class="paket ' + (p.phase || '') + (p.fehler ? ' fehler' : '') + '" transform="translate(' + n1(p.x) + ',' + n1(p.y) + ')"><rect x="-11" y="-8" width="22" height="16" rx="3"/><path d="M-11,-8 L0,1 L11,-8"/></g>';
    }
    return s;
  }

  SL.zeichnen = { szene: szene, symbol: symbol };
})(typeof window !== 'undefined' ? window : globalThis);
