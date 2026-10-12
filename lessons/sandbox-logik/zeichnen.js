// Logik-Labor · Darstellung (SVG). Rechnet keine Logik: Alle Zustände kommen aus dem Ergebnis von SL.sim.auswerten.
// Zustände sind nie nur an der Farbe erkennbar: aktive Leitungen sind dicker, an den Anschlüssen stehen 0/1,
// Lampen zeigen AN/AUS, Schalter ihre Stellung.
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});
  var M = function () { return SL.modell; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var n1 = function (v) { return Math.round(v * 10) / 10; };
  var col = function (c, d) { return c && SL.FARBEN.pruefe(c, '') ? c : d; };

  function text(x, y, s, cls, anker) { return '<text x="' + n1(x) + '" y="' + n1(y) + '" class="' + (cls || '') + '"' + (anker ? ' text-anchor="' + anker + '"' : '') + '>' + esc(s) + '</text>'; }
  function linie(x1, y1, x2, y2, cls) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="' + (cls || 'leiter') + '"/>'; }
  function wp(b, x, y) { var p = M().drehe(x, y, b.rot); return { x: b.x + p[0], y: b.y + p[1] }; }
  var fuell = function (b) { return b.werte.farbe ? ' style="fill:' + b.werte.farbe + '"' : ''; };

  // 7-Segment-Geometrie (lokal, Ziffer zwischen x −18…22, y −48…48)
  var SEG = {
    a: 'M-12,-50 L16,-50 L20,-46 L16,-42 L-12,-42 L-16,-46 Z', g: 'M-12,-4 L16,-4 L20,0 L16,4 L-12,4 L-16,0 Z', d: 'M-12,42 L16,42 L20,46 L16,50 L-12,50 L-16,46 Z',
    f: 'M-22,-42 L-18,-46 L-14,-42 L-14,-8 L-18,-4 L-22,-8 Z', b: 'M18,-42 L22,-46 L26,-42 L26,-8 L22,-4 L18,-8 Z',
    e: 'M-22,8 L-18,4 L-14,8 L-14,42 L-18,46 L-22,42 Z', c: 'M18,8 L22,4 L26,8 L26,42 L22,46 L18,42 Z',
  };

  /** Körper eines Bauteils in lokalen Koordinaten. r = Ergebnis (oder null). */
  function koerper(b, r) {
    var w = b.werte, bx = M().box(b), s = '', ps = M().pins(b), a;
    // Anschlussleitungen bis zum Körper
    for (a in ps) {
      var p = ps[a], rand = p.x < 0 ? bx[0] : bx[0] + bx[2];
      if (SL.GATTER[b.typ] && a === 'q' && SL.GATTER[b.typ].negiert) rand = bx[0] + bx[2] + 8;
      s += linie(p.x, p.y, rand, p.y, 'leiter');
    }
    switch (b.typ) {
      case 'schalter': {
        var an = r ? r.q : w.an;
        s += '<rect x="-30" y="-20" width="60" height="40" rx="8" class="koerper"' + fuell(b) + '/>' +
          '<rect x="-20" y="-9" width="34" height="18" rx="9" class="schiene' + (an ? ' an' : '') + '"/>' +
          '<circle cx="' + (an ? 5 : -11) + '" cy="0" r="7" class="knopf"/>';
        break;
      }
      case 'taster': {
        var gedr = r ? r.q : w.gedrueckt;
        s += '<rect x="-26" y="-20" width="52" height="40" rx="8" class="koerper"' + fuell(b) + '/>' +
          '<circle cx="-2" cy="0" r="' + (gedr ? 11 : 13) + '" class="tastknopf' + (gedr ? ' an' : '') + '"/>';
        break;
      }
      case 'eins': case 'null':
        s += '<rect x="-22" y="-18" width="44" height="36" rx="6" class="koerper"' + fuell(b) + '/>';
        break;
      case 'takt':
        s += '<rect x="-28" y="-20" width="56" height="40" rx="6" class="koerper"' + fuell(b) + '/>' +
          '<path d="M-20,8 L-14,8 L-14,-8 L-4,-8 L-4,8 L6,8 L6,-8 L16,-8 L16,8 L20,8" class="leiter duenn' + (r && r.q ? ' an' : '') + '"/>';
        break;
      case 'lampe': {
        var hell = r && r.an, lf = col(w.farbe, '#ffc83d');
        if (hell) s += '<circle r="30" class="schein" style="fill:' + lf + '"/>';
        s += '<circle r="20" class="gehaeuse"' + (w.gehaeuse ? ' style="stroke:' + w.gehaeuse + '"' : '') + '/>' +
          '<circle r="14" class="kolben' + (hell ? ' an' : '') + '"' + (hell ? ' style="fill:' + lf + '"' : '') + '/>' +
          linie(-9, -9, 9, 9, 'leiter duenn') + linie(-9, 9, 9, -9, 'leiter duenn');
        break;
      }
      case 'segment': {
        var sf = col(w.farbe, '#ff4d3d'), seg = (r && r.segmente) || {};
        s += '<rect x="-46" y="-84" width="92" height="168" rx="8" class="anzeige"' + (w.gehaeuse ? ' style="fill:' + w.gehaeuse + '"' : '') + '/>';
        SL.SEGMENTE.forEach(function (k) { s += '<path d="' + SEG[k] + '" transform="translate(4 0)" class="seg' + (seg[k] ? ' an' : '') + '"' + (seg[k] ? ' style="fill:' + sf + '"' : '') + '/>'; });
        s += '<circle cx="36" cy="48" r="4" class="seg' + (seg.dp ? ' an' : '') + '"' + (seg.dp ? ' style="fill:' + sf + '"' : '') + '/>';
        break;
      }
      case 'relais': {
        var zu = r && r.angezogen;
        s += '<rect x="-46" y="-54" width="92" height="118" rx="8" class="koerper"' + fuell(b) + '/>' +
          '<rect x="-36" y="-42" width="24" height="24" class="spule' + (zu ? ' an' : '') + '"/>' + linie(-36, -18, -12, -42, 'leiter duenn') +
          linie(-46, -30, -36, -30, 'leiter') +
          '<line x1="-24" y1="-18" x2="' + (zu ? 8 : 8) + '" y2="' + (zu ? 20 : 39) + '" class="mechanik"/>' +
          linie(-46, 30, -12, 30, 'leiter') + '<circle cx="-12" cy="30" r="3" class="kontakt"/>' +
          linie(30, 10, 46, 10, 'leiter') + linie(30, 50, 46, 50, 'leiter') +
          '<circle cx="30" cy="10" r="3" class="kontakt"/><circle cx="30" cy="50" r="3" class="kontakt"/>' +
          linie(-12, 30, 28, zu ? 12 : 48, 'leiter hebel' + (r && r.ein.com ? ' an' : ''));
        break;
      }
      case 'decoder':
        s += '<rect x="-46" y="-74" width="92" height="148" rx="6" class="koerper"' + fuell(b) + '/>';
        break;
      default:
        if (SL.GATTER[b.typ]) {
          s += '<rect x="' + (bx[0] + 2) + '" y="' + (bx[1] + 4) + '" width="' + (bx[2] - 4) + '" height="' + (bx[3] - 8) + '" rx="3" class="koerper' + (r && r.q ? ' aktiv' : '') + '"' + fuell(b) + '/>';
          if (SL.GATTER[b.typ].negiert) s += '<circle cx="' + (bx[0] + bx[2] + 4) + '" cy="0" r="4" class="blase"/>';
        }
    }
    return s;
  }

  /** Beschriftungen (immer waagerecht): Name, Symbol, Anschlussnamen, Zustandstext. */
  function texte(b, r, z) {
    var bx = M().box(b), s = '', w = b.werte, mitte = wp(b, 0, 0);
    // Name über dem Bauteil
    var ecken = [[bx[0], bx[1]], [bx[0] + bx[2], bx[1] + bx[3]]].map(function (e) { return wp(b, e[0], e[1]); });
    var oben = Math.min(ecken[0].y, ecken[1].y);
    s += text(mitte.x, oben - 7, b.name, 'name', 'middle');
    var zeigen = function (lx, ly, t, cls) { var p = wp(b, lx, ly); s += text(p.x, p.y + 4, t, cls || 'pintext', 'middle'); };
    switch (b.typ) {
      case 'schalter': { var an = r ? r.q : w.an; s += text(mitte.x, mitte.y + bx[3] / 2 + 14, an ? 'EIN (1)' : 'AUS (0)', 'zustand' + (an ? ' an' : ''), 'middle'); break; }
      case 'taster': { var g = r ? r.q : w.gedrueckt; s += text(mitte.x, mitte.y + bx[3] / 2 + 14, g ? 'gedrückt (1)' : 'los (0)', 'zustand' + (g ? ' an' : ''), 'middle'); break; }
      case 'eins': zeigen(-2, 2, '1', 'symbol'); break;
      case 'null': zeigen(-2, 2, '0', 'symbol'); break;
      case 'takt': s += text(mitte.x, mitte.y + bx[3] / 2 + 14, String(w.frequenz).replace('.', ',') + ' Hz', 'zustand', 'middle'); break;
      case 'lampe': s += text(mitte.x, mitte.y + 40, r && r.an ? 'AN' : 'AUS', 'zustand' + (r && r.an ? ' an' : ''), 'middle'); break;
      case 'segment': {
        SL.SEGMENTE.concat(['dp']).forEach(function (k, i) { zeigen(-38, -70 + i * 20, k, 'pintext klein'); });
        var zch = r ? r.zeichen : '';
        s += text(mitte.x, mitte.y + 100, zch == null ? 'kein Zeichen' : zch === '' ? 'aus' : 'zeigt ' + zch, 'zustand', 'middle');
        break;
      }
      case 'relais':
        zeigen(-30, -48, 'S', 'pintext klein'); zeigen(-34, 40, 'COM', 'pintext klein'); zeigen(34, 0, 'NO', 'pintext klein'); zeigen(34, 60, 'NC', 'pintext klein');
        s += text(mitte.x, mitte.y + 80, r && r.angezogen ? 'angezogen' : 'Ruhe', 'zustand' + (r && r.angezogen ? ' an' : ''), 'middle');
        break;
      case 'decoder':
        zeigen(0, -6, 'BCD', 'symbol klein'); zeigen(0, 12, '→ 7-Seg', 'pintext');
        ['1', '2', '4', '8'].forEach(function (t, i) { zeigen(-36, -30 + i * 20, t, 'pintext klein'); });
        SL.SEGMENTE.forEach(function (t, i) { zeigen(36, -60 + i * 20, t, 'pintext klein'); });
        break;
      default:
        if (SL.GATTER[b.typ]) {
          zeigen(-3, -4, SL.GATTER[b.typ].zeichen, 'symbol');
          if (bx[3] > 50) {
            var ps = M().pins(b);
            for (var a in ps) if (ps[a].art === 'ein') zeigen(-18, ps[a].y, ps[a].text, 'pintext klein');
          }
        }
    }
    // Pegel 0/1 an den Anschlüssen
    if (r && z.pegel) {
      M().anschluesse(b).forEach(function (p) {
        if (b.typ === 'segment' && p.art === 'ein') return;
        var v = p.art === 'ein' ? r.ein[p.a] : r.aus[p.a];
        var d = M().richtung(z.doc, { b: b.id, a: p.a });
        var ox = d.x ? d.x * 8 : 9, oy = d.y ? d.y * 12 : -6;
        s += text(p.x + ox, p.y + oy, String(v ? 1 : 0), 'pegel' + (v ? ' an' : ''), d.x < 0 ? 'end' : d.x > 0 ? 'start' : 'middle');
      });
    }
    return s;
  }

  function punkte(pts) { return pts.map(function (p) { return n1(p.x) + ',' + n1(p.y); }).join(' '); }

  /** z: { doc, erg, auswahl, vorschau, hover } */
  function szene(z) {
    var doc = z.doc, erg = z.erg || { bauteile: {}, draehte: {} }, opt = doc.optionen || {};
    var aktiv = col(opt.aktiv, 'var(--an)'), inaktiv = col(opt.inaktiv, 'var(--aus)');
    var sel = z.auswahl || {}, gewaehlt = function (id) { return sel.art === 'mehrere' ? sel.ids.indexOf(id) >= 0 : sel.art === 'bauteil' && sel.id === id; };
    var zz = { doc: doc, pegel: opt.pegel !== false };
    var halo = '', leitungen = '';
    doc.draehte.forEach(function (d) {
      var pts = M().drahtPunkte(doc, d); if (!pts) return;
      var v = erg.draehte[d.id], farbe = d.farbe || (v ? aktiv : inaktiv);
      if (v) halo += '<polyline points="' + punkte(pts) + '" class="halo" style="stroke:' + aktiv + '"/>';
      leitungen += '<polyline points="' + punkte(pts) + '" class="leitung' + (v ? ' an' : '') + (sel.art === 'draht' && sel.id === d.id ? ' gewaehlt' : '') + '" style="stroke:' + farbe + '" data-draht="' + d.id + '"/>';
    });
    var teile = '', schrift = '', pins = '';
    doc.bauteile.forEach(function (b) {
      var r = erg.bauteile[b.id], bx = M().box(b);
      teile += '<g class="bauteil typ-' + b.typ + '" transform="translate(' + b.x + ' ' + b.y + ')' + (b.rot ? ' rotate(' + b.rot + ')' : '') + '">' +
        '<rect x="' + (bx[0] - 4) + '" y="' + (bx[1] - 4) + '" width="' + (bx[2] + 8) + '" height="' + (bx[3] + 8) + '" rx="8" class="flaeche' + (gewaehlt(b.id) ? ' auswahl' : '') + '"/>' +
        koerper(b, r) + '</g>';
      schrift += texte(b, r, zz);
      M().anschluesse(b).forEach(function (t) {
        var dr = z.vorschau && z.vorschau.art === 'draht';
        var ziel = dr && z.vorschau.ziel && z.vorschau.ziel.b === t.b && z.vorschau.ziel.a === t.a;
        var start = dr && z.vorschau.von.b === t.b && z.vorschau.von.a === t.a;
        var hov = z.hover && z.hover.art === 'anschluss' && z.hover.b === t.b && z.hover.a === t.a;
        var v = r ? (t.art === 'ein' ? r.ein[t.a] : r.aus[t.a]) : 0;
        pins += '<circle cx="' + t.x + '" cy="' + t.y + '" r="' + (dr || hov ? 8 : 4.5) + '" class="pin ' + t.art + (v ? ' an' : '') + (dr ? ' bereit' : '') + (start ? ' start' : '') + (ziel ? (z.vorschau.gueltig ? ' ok' : ' falsch') : '') + (hov ? ' hover' : '') + '"' + (v && !dr ? ' style="fill:' + aktiv + '"' : '') + '/>';
      });
    });
    var s = '<g class="ebene-halo" aria-hidden="true">' + halo + '</g><g class="ebene-leitungen">' + leitungen + '</g><g class="ebene-bauteile">' + teile + '</g><g class="ebene-text">' + schrift + '</g><g class="ebene-pins">' + pins + '</g>';
    var v = z.vorschau;
    if (v && v.art === 'draht') {
      var a = M().anschlussPos(doc, v.von);
      if (a) { var e = v.ziel ? M().anschlussPos(doc, v.ziel) : { x: v.x, y: v.y }; s += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + n1(e.x) + '" y2="' + n1(e.y) + '" class="gummiband' + (v.ziel ? (v.gueltig ? ' ok' : ' falsch') : '') + '"/>'; }
    }
    if (v && v.art === 'neu' && v.drin) {
      var g = { id: '_', typ: v.typ, name: '', x: v.x, y: v.y, rot: 0, werte: M().normalisiere(v.typ, SL.TYPEN[v.typ].werte) };
      s += '<g class="geist" transform="translate(' + v.x + ' ' + v.y + ')">' + koerper(g, null) + '</g>';
    }
    return s;
  }

  /** Symbol für die Bauteilbibliothek. */
  function symbol(typ) {
    var b = { id: '_', typ: typ, name: '', x: 0, y: 0, rot: 0, werte: M().normalisiere(typ, SL.TYPEN[typ].werte) };
    var bx = M().box(b), ps = M().pins(b), x0 = bx[0], x1 = bx[0] + bx[2];
    for (var a in ps) { x0 = Math.min(x0, ps[a].x); x1 = Math.max(x1, ps[a].x); }
    var mitte = '';
    if (SL.GATTER[typ]) mitte = text(-3, 6, SL.GATTER[typ].zeichen, 'symbol', 'middle');
    if (typ === 'eins' || typ === 'null') mitte = text(-2, 7, typ === 'eins' ? '1' : '0', 'symbol', 'middle');
    if (typ === 'decoder') mitte = text(0, 4, 'BCD', 'symbol klein', 'middle');
    return '<svg viewBox="' + [x0 - 4, bx[1] - 4, x1 - x0 + 8, bx[3] + 8].join(' ') + '" aria-hidden="true" focusable="false">' + koerper(b, null) + mitte + '</svg>';
  }

  SL.zeichnen = { szene: szene, symbol: symbol };
})(typeof window !== 'undefined' ? window : globalThis);
