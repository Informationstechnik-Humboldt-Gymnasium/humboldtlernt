// Schaltkreis-Labor · Darstellung (SVG)
//
// Zeichnet Schaltung, Simulationsergebnis und Vorschau als SVG-Text in Weltkoordinaten.
// Schaltzeichen nach DIN; Beschriftungen bleiben bei gedrehten Bauteilen waagerecht.
// Farben kommen ausschließlich aus CSS-Variablen (Dark Mode).
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var n1 = function (v) { return Math.round(v * 10) / 10; };
  var M = function () { return SL.modell; };

  /** Weltposition eines Punkts im lokalen Koordinatensystem des Bauteils. */
  function wp(b, x, y) { var p = M().drehe(x, y, b.rot); return { x: b.x + p[0], y: b.y + p[1] }; }

  function text(x, y, s, cls, anker) {
    return '<text x="' + n1(x) + '" y="' + n1(y) + '" class="' + (cls || '') + '"' + (anker ? ' text-anchor="' + anker + '"' : '') + '>' + esc(s) + '</text>';
  }
  function linie(x1, y1, x2, y2, cls) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="' + (cls || 'leiter') + '"/>'; }

  // ---------------------------------------------------------------- Schaltzeichen (lokal, Anschlüsse bei x = ±40)

  var SYMBOL = {
    quelle: function (b) {
      var plusLinks = !b.werte.umgepolt, xp = plusLinks ? -6 : 6, xm = -xp;
      return linie(-40, 0, Math.min(xp, xm), 0) + linie(Math.max(xp, xm), 0, 40, 0) +
        linie(xp, -18, xp, 18, 'leiter platte') + linie(xm, -9, xm, 9, 'leiter platte dick');
    },
    schalter: function (b) {
      var zu = b.werte.geschlossen;
      return linie(-40, 0, -16, 0) + linie(16, 0, 40, 0) +
        '<circle cx="-16" cy="0" r="3" class="kontakt"/><circle cx="16" cy="0" r="3" class="kontakt"/>' +
        linie(-16, 0, zu ? 16 : 11, zu ? -1 : -19, 'leiter hebel');
    },
    lampe: function (b, r) {
      var hell = r && r.hell || 0, s = 9.9;
      var glanz = hell > 0.005 ? '<circle r="' + n1(15 + 18 * Math.sqrt(hell)) + '" class="schein" style="opacity:' + (0.12 + 0.4 * hell).toFixed(2) + '"/>' : '';
      return linie(-40, 0, -14, 0) + linie(14, 0, 40, 0) + glanz +
        '<circle r="14" class="kolben' + (r && r.zustand === 'ueberlast' ? ' ueberlast' : '') + '" style="fill-opacity:' + hell.toFixed(2) + '"/>' +
        linie(-s, -s, s, s, 'leiter duenn') + linie(-s, s, s, -s, 'leiter duenn');
    },
    widerstand: function () {
      return linie(-40, 0, -22, 0) + linie(22, 0, 40, 0) +
        '<rect x="-22" y="-9" width="44" height="18" class="koerper"/>' +
        linie(-16, 15, 15, -14, 'leiter duenn') + '<path d="M15 -14 l-8 1 M15 -14 l-1 8" class="leiter duenn"/>';
    },
    diode: function (b, r) {
      var leitend = r && r.zustand === 'leitend';
      return linie(-40, 0, -12, 0) + linie(12, 0, 40, 0) +
        '<path d="M-12 -12 L-12 12 L12 0 Z" class="dreieck' + (leitend ? ' leitend' : '') + '"/>' + linie(12, -12, 12, 12, 'leiter platte');
    },
    wechsel: function () {
      return linie(-40, 0, -17, 0) + linie(17, 0, 40, 0) + '<circle r="17" class="koerper"/>' +
        '<path d="M-11 0 C-8 -13 -3 -13 0 0 S8 13 11 0" class="leiter duenn"/>';
    },
    transistor: function (b, r) {
      var an = r && r.zustand && r.zustand !== 'sperrt';
      return '<circle cx="2" cy="0" r="25" class="koerper' + (an ? ' leitend-hell' : '') + '"/>' +
        linie(-40, 0, -10, 0) + linie(-10, -14, -10, 14, 'leiter platte') +
        '<polyline points="-10,-7 20,-24 20,-40" class="leiter' + (an ? ' an' : '') + '"/>' +
        '<polyline points="-10,7 20,24 20,40" class="leiter' + (an ? ' an' : '') + '"/>' +
        '<polygon points="16,22 7.1,21.6 11,14.6" class="pfeil"/>';
    },
  };
  ['und', 'oder', 'nicht', 'xoder'].forEach(function (typ) {
    SYMBOL[typ] = function (b, r) {
      var q = r && r.q, ein = (r && r.ein) || {}, eins = typ === 'nicht';
      var s = '<rect x="-24" y="-30" width="48" height="60" rx="3" class="koerper' + (q ? ' leitend-hell' : '') + '"/>';
      if (eins) s += linie(-40, 0, -24, 0, 'leiter' + (ein.a ? ' an' : ''));
      else s += linie(-40, -20, -24, -20, 'leiter' + (ein.a ? ' an' : '')) + linie(-40, 20, -24, 20, 'leiter' + (ein.b ? ' an' : ''));
      if (eins) s += '<circle cx="28" cy="0" r="4" class="kontakt"/>' + linie(32, 0, 40, 0, 'leiter' + (q ? ' an' : ''));
      else s += linie(24, 0, 40, 0, 'leiter' + (q ? ' an' : ''));
      return s + linie(0, 30, 0, 40, 'leiter masse');
    };
  });

  function messgeraet(b, m) {
    var modus = b.werte.modus, kopf = modus === 'V' ? 'V' : modus === 'A' ? 'A' : 'Ω';
    var anzeige = m ? m.anzeige : '- - -', fehler = m && m.fehler;
    var s = '<rect x="-46" y="-56" width="92" height="106" rx="10" class="geraet"/>' +
      '<rect x="-38" y="-48" width="76" height="42" rx="5" class="display' + (fehler ? ' fehler' : '') + '"/>' +
      text(-33, -36, kopf, 'display-modus') +
      text(0, -15, anzeige, 'display-wert' + (anzeige.length > 9 ? ' klein' : ''), 'middle') +
      linie(-20, 50, -20, 60, 'leiter') + linie(20, 50, 20, 60, 'leiter');
    SL.MODUS_TASTEN.forEach(function (t) {
      s += '<rect x="' + t.x + '" y="' + SL.TASTEN_Y + '" width="' + t.w + '" height="' + SL.TASTEN_H + '" rx="5" class="taste' + (t.modus === modus ? ' aktiv' : '') + '"/>' +
        text(t.x + t.w / 2, SL.TASTEN_Y + 15.5, t.modus === 'Ohm' ? 'Ω' : t.modus, 'taste-text' + (t.modus === modus ? ' aktiv' : ''), 'middle');
    });
    s += text(-20, 46, 'COM', 'buchse-text', 'middle') + text(20, 46, 'VΩA', 'buchse-text', 'middle');
    s += '<circle cx="-20" cy="60" r="6" class="buchse schwarz"/><circle cx="20" cy="60" r="6" class="buchse rot"/>';
    return s;
  }

  // ---------------------------------------------------------------- Beschriftung

  var F = function (x, e) { return SL.fmt(x, e); };

  /** Anzuzeigende Werte: bei schneller Wechselspannung Effektivwerte (mit „~“), sonst Momentanwerte. */
  function wahl(r, z) {
    var e = z.erg && z.erg.wechsel && z.erg.wechsel.schnell && r && r.eff;
    return e ? { U: e.Ueff, I: e.Ieff, P: e.Pmittel, s: '~' } : { U: r && r.U, I: r && r.I, P: r && r.P, s: '' };
  }

  /** Zeilen unter/neben einem Bauteil: Name, Kennwert und – wenn gewünscht – Messwerte. */
  function zeilen(b, r, z) {
    var w = b.werte, out = [], lauf = z.laeuft && r && !r.ungueltig, mw = z.messwerte, x = wahl(r, z);
    if (lauf && mw && b.typ !== 'transistor' && !SL.TYPEN[b.typ].gatter) r = { U: x.U, I: x.I, P: x.P, zustand: r.zustand };
    var UI = function () { return F(r.U, 'V') + x.s + ' · ' + F(r.I, 'A') + x.s; };
    switch (b.typ) {
      case 'wechsel': out.push(b.name + '  ' + F(w.spannung, 'V') + '~ · ' + String(w.frequenz).replace('.', ',') + ' Hz'); if (lauf && mw) out.push((x.s ? 'I = ' + F(r.I, 'A') + '~' : 'u = ' + F(r.U, 'V') + ' · i = ' + F(r.I, 'A'))); break;
      case 'transistor': out.push(b.name + (lauf ? '  ' + r.zustand : '')); if (lauf && mw && r.Ube != null) out.push('Ic = ' + F(r.I, 'A') + ' · Ib = ' + F(r.Ib, 'A')); break;
      case 'und': case 'oder': case 'nicht': case 'xoder': out.push(b.name); break;
      case 'quelle': out.push(b.name + '  ' + F(w.spannung, 'V')); if (lauf && mw) out.push('I = ' + F(r.I, 'A')); break;
      case 'schalter': out.push(b.name + (w.geschlossen ? '  zu' : '  offen')); if (lauf && mw && !w.geschlossen && r.U != null) out.push('U = ' + F(r.U, 'V')); break;
      case 'lampe': out.push(b.name); if (lauf && mw) { out.push(UI()); out.push('P = ' + F(r.P, 'W') + (x.s ? ' (Mittel)' : '')); } break;
      case 'widerstand': out.push(b.name + '  ' + F(w.widerstand, 'Ω')); if (lauf && mw) out.push(UI()); break;
      case 'diode': out.push(b.name + (z.laeuft && r && !r.ungueltig && !x.s ? '  ' + r.zustand : '')); if (lauf && mw) out.push(UI()); break;
    }
    if (z.laeuft && r && r.ungueltig) out.push('Kurzschluss!');
    return out;
  }

  /** Ausdehnung eines Bauteils samt Anschlüssen (relativ zur Mitte, gedreht). */
  function ausdehnung(b) {
    var T = SL.TYPEN[b.typ], bx = T.box, pts = [[bx[0], bx[1]], [bx[0] + bx[2], bx[1] + bx[3]]];
    for (var a in T.anschluesse) pts.push(T.anschluesse[a]);
    var e = { x0: 0, x1: 0, y0: 0, y1: 0 };
    pts.forEach(function (p) { var q = M().drehe(p[0], p[1], b.rot); e.x0 = Math.min(e.x0, q[0]); e.x1 = Math.max(e.x1, q[0]); e.y0 = Math.min(e.y0, q[1]); e.y1 = Math.max(e.y1, q[1]); });
    return e;
  }

  function beschriftung(b, r, z) {
    var liste = zeilen(b, r, z), senkrecht = b.rot === 90 || b.rot === 270, s = '', aus = ausdehnung(b);
    var rechts = b.typ === 'transistor' || SL.TYPEN[b.typ].gatter ? Math.max(aus.x1 + 4, 26) : 26;
    liste.forEach(function (t, i) {
      var cls = i === 0 ? 'name' : t === 'Kurzschluss!' ? 'wert warn' : 'wert';
      s += senkrecht ? text(b.x + rechts, b.y - 8 + i * 15 - (liste.length - 1) * 5, t, cls, 'start') : text(b.x, b.y + Math.max(aus.y1, 24) + 14 + i * 15, t, cls, 'middle');
    });
    if (SL.TYPEN[b.typ].gatter) {
      var g = SL.GATTER[b.typ], mitte = wp(b, 0, 0);
      s += text(mitte.x, mitte.y + 6, g.zeichen, 'gatter-zeichen', 'middle');
      if (z.laeuft && r && !r.ungueltig) {
        var pegel = function (lx, ly, wert) { var p = wp(b, lx, ly); return text(p.x, p.y + 4, String(wert), 'pegel' + (wert ? ' an' : ''), 'middle'); };
        if (g.einEingang) s += pegel(-32, -9, r.ein.a); else s += pegel(-32, -29, r.ein.a) + pegel(-32, 11, r.ein.b);
        s += pegel(34, -9, r.q);
      }
    }
    if (b.typ === 'transistor') {
      [['b', -32, -9], ['c', 30, -34], ['e', 30, 34]].forEach(function (x) { var p = wp(b, x[1], x[2]); s += text(p.x, p.y + 4, x[0].toUpperCase(), 'pol klein', 'middle'); });
    }
    // Pole und Anschlüsse kennzeichnen
    if (b.typ === 'quelle') {
      var p = M().pluspol(b), lp = SL.TYPEN.quelle.anschluesse[p][0] < 0 ? -1 : 1;
      var a = wp(b, lp * 20, 15), c = wp(b, -lp * 20, 15);
      s += text(a.x, a.y + 5, '+', 'pol', 'middle') + text(c.x, c.y + 5, '−', 'pol', 'middle');
    }
    if (b.typ === 'diode') {
      var an = wp(b, -30, -11), ka = wp(b, 30, -11);
      s += text(an.x, an.y + 4, 'A', 'pol klein', 'middle') + text(ka.x, ka.y + 4, 'K', 'pol klein', 'middle');
    }
    if (b.typ === 'messgeraet') s += text(b.x, b.y - 62, b.name, 'name', 'middle');
    return s;
  }

  // ---------------------------------------------------------------- Ganze Szene

  function punkte(pts) { return pts.map(function (p) { return n1(p.x) + ',' + n1(p.y); }).join(' '); }
  function pfad(pts) { return 'M' + pts.map(function (p) { return n1(p.x) + ' ' + n1(p.y); }).join(' L'); }

  /** Geschwindigkeit der Strom-Animation in px/s (wächst mit der Stromstärke, logarithmisch). */
  function tempo(I) { var a = Math.abs(I); return a < SL.K.I_FLIESST ? 0 : Math.min(160, 12 + 45 * Math.log10(1 + a / 0.005)); }

  /**
   * z: { doc, erg, auswahl, vorschau, hover, laeuft, messwerte, flussAn }
   * Gibt { welt: svg-Text } zurück.
   */
  function szene(z) {
    var doc = z.doc, erg = z.erg || { bauteile: {}, draehte: {}, messgeraete: {} };
    var s = '';
    var sel = z.auswahl || {};

    // Drähte
    var draehte = '', fluss = '';
    doc.draehte.forEach(function (d) {
      var pts = M().drahtPunkte(doc, d);
      if (!pts) return;
      var r = erg.draehte[d.id] || {};
      var sonde = [d.von, d.nach].map(function (e) { var b = M().finde(doc, e.b); return b.typ === 'messgeraet' ? e.a : null; }).filter(Boolean)[0];
      var cls = 'draht' + (sonde === 'v' ? ' sonde-rot' : sonde === 'com' ? ' sonde-schwarz' : '') + (r.kurzschluss && z.laeuft ? ' kurz' : '') + (sel.art === 'draht' && sel.id === d.id ? ' gewaehlt' : '');
      draehte += '<polyline points="' + punkte(pts) + '" class="' + cls + '" data-draht="' + d.id + '"/>';
      if (z.laeuft && z.flussAn && r.I && !r.ungueltig) {
        var v = tempo(r.I);
        if (v) fluss += '<path d="' + pfad(r.I > 0 ? pts : pts.slice().reverse()) + '" class="fluss" data-tempo="' + n1(v) + '"/>';
      } else if (z.laeuft && z.flussAn && r.wechselnd) {
        fluss += '<path d="' + pfad(pts) + '" class="fluss wechselnd" data-tempo="0"/>';
      }
    });
    s += '<g class="ebene-draehte">' + draehte + '</g><g class="ebene-fluss" aria-hidden="true">' + fluss + '</g>';

    // Bauteile
    var teile = '', texte = '', punkteA = '';
    doc.bauteile.forEach(function (b) {
      var r = erg.bauteile[b.id], gew = sel.art === 'bauteil' && sel.id === b.id;
      var box = SL.TYPEN[b.typ].box;
      var inhalt = b.typ === 'messgeraet' ? messgeraet(b, erg.messgeraete[b.id]) : SYMBOL[b.typ](b, z.laeuft ? r : null);
      var kurz = z.laeuft && erg.kurzschluss && erg.kurzschluss.indexOf(b.id) >= 0;
      teile += '<g class="bauteil typ-' + b.typ + (gew ? ' gewaehlt' : '') + (kurz ? ' kurz' : '') + '" data-bauteil="' + b.id + '" transform="translate(' + b.x + ' ' + b.y + ')' + (b.rot ? ' rotate(' + b.rot + ')' : '') + '">' +
        '<rect x="' + box[0] + '" y="' + box[1] + '" width="' + box[2] + '" height="' + box[3] + '" rx="8" class="flaeche' + (gew ? ' auswahl' : '') + '"/>' + inhalt + '</g>';
      texte += beschriftung(b, r, z);
      M().anschluesse(b).forEach(function (t) {
        var ziel = z.vorschau && z.vorschau.art === 'draht';
        var istZiel = ziel && z.vorschau.ziel && z.vorschau.ziel.b === t.b && z.vorschau.ziel.a === t.a;
        var istStart = ziel && z.vorschau.von.b === t.b && z.vorschau.von.a === t.a;
        var hov = z.hover && z.hover.art === 'anschluss' && z.hover.b === t.b && z.hover.a === t.a;
        var cls = 'anschluss' + (ziel ? ' bereit' : '') + (istStart ? ' start' : '') + (istZiel ? (z.vorschau.gueltig ? ' ok' : ' falsch') : '') + (hov ? ' hover' : '');
        punkteA += '<circle cx="' + t.x + '" cy="' + t.y + '" r="' + (ziel || hov ? 9 : 4.5) + '" class="' + cls + '"/>';
      });
    });
    s += '<g class="ebene-bauteile">' + teile + '</g><g class="ebene-text">' + texte + '</g><g class="ebene-anschluesse">' + punkteA + '</g>';

    // Vorschau: Draht in Arbeit oder neues Bauteil
    var v = z.vorschau;
    if (v && v.art === 'draht') {
      var a = M().anschlussPos(doc, v.von);
      if (a) {
        var e = v.ziel ? M().anschlussPos(doc, v.ziel) : { x: v.x, y: v.y };
        s += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + n1(e.x) + '" y2="' + n1(e.y) + '" class="gummiband' + (v.ziel ? (v.gueltig ? ' ok' : ' falsch') : '') + '"/>';
      }
    }
    if (v && v.art === 'neu' && v.drin) {
      var geist = { id: '_neu', typ: v.typ, name: '', x: v.x, y: v.y, rot: 0, werte: M().normalisiere(v.typ, SL.TYPEN[v.typ].werte) };
      s += '<g class="geist" transform="translate(' + v.x + ' ' + v.y + ')">' + (v.typ === 'messgeraet' ? messgeraet(geist, null) : SYMBOL[v.typ](geist, null)) + '</g>';
    }
    return s;
  }

  /** Kleines Symbol für die Bauteilleiste. */
  function symbol(typ) {
    var b = { id: '_', typ: typ, name: '', x: 0, y: 0, rot: 0, werte: M().normalisiere(typ, SL.TYPEN[typ].werte) };
    var vb = typ === 'messgeraet' ? '-50 -60 100 128' : typ === 'transistor' ? '-44 -44 80 88' : SL.TYPEN[typ].gatter ? '-44 -34 88 78' : '-44 -26 88 52';
    var inhalt = typ === 'messgeraet' ? messgeraet(b, null) : SYMBOL[typ](b, null);
    if (typ === 'quelle') inhalt += text(-20, -10, '+', 'pol', 'middle') + text(20, -10, '−', 'pol', 'middle');
    if (SL.TYPEN[typ].gatter) inhalt += text(0, 7, SL.GATTER[typ].zeichen, 'gatter-zeichen', 'middle');
    return '<svg viewBox="' + vb + '" aria-hidden="true" focusable="false">' + inhalt + '</svg>';
  }

  SL.zeichnen = { szene: szene, symbol: symbol, tempo: tempo };
})(typeof window !== 'undefined' ? window : globalThis);
