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
  };

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

  /** Zeilen unter/neben einem Bauteil: Name, Kennwert und – wenn gewünscht – Messwerte. */
  function zeilen(b, r, z) {
    var w = b.werte, out = [], lauf = z.laeuft && r && !r.ungueltig, mw = z.messwerte;
    switch (b.typ) {
      case 'quelle': out.push(b.name + '  ' + F(w.spannung, 'V')); if (lauf && mw) out.push('I = ' + F(r.I, 'A')); break;
      case 'schalter': out.push(b.name + (w.geschlossen ? '  zu' : '  offen')); if (lauf && mw && !w.geschlossen && r.U != null) out.push('U = ' + F(r.U, 'V')); break;
      case 'lampe': out.push(b.name); if (lauf && mw) { out.push(F(r.U, 'V') + ' · ' + F(r.I, 'A')); out.push('P = ' + F(r.P, 'W')); } break;
      case 'widerstand': out.push(b.name + '  ' + F(w.widerstand, 'Ω')); if (lauf && mw) out.push(F(r.U, 'V') + ' · ' + F(r.I, 'A')); break;
      case 'diode': out.push(b.name + (z.laeuft && r && !r.ungueltig ? '  ' + r.zustand : '')); if (lauf && mw) out.push(F(r.U, 'V') + ' · ' + F(r.I, 'A')); break;
    }
    if (z.laeuft && r && r.ungueltig) out.push('Kurzschluss!');
    return out;
  }

  function beschriftung(b, r, z) {
    var liste = zeilen(b, r, z), senkrecht = b.rot === 90 || b.rot === 270, s = '';
    liste.forEach(function (t, i) {
      var cls = i === 0 ? 'name' : t === 'Kurzschluss!' ? 'wert warn' : 'wert';
      s += senkrecht ? text(b.x + 26, b.y - 8 + i * 15 - (liste.length - 1) * 5, t, cls, 'start') : text(b.x, b.y + 38 + i * 15, t, cls, 'middle');
    });
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
    var vb = typ === 'messgeraet' ? '-50 -60 100 128' : '-44 -26 88 52';
    var inhalt = typ === 'messgeraet' ? messgeraet(b, null) : SYMBOL[typ](b, null);
    if (typ === 'quelle') inhalt += text(-20, -10, '+', 'pol', 'middle') + text(20, -10, '−', 'pol', 'middle');
    return '<svg viewBox="' + vb + '" aria-hidden="true" focusable="false">' + inhalt + '</svg>';
  }

  SL.zeichnen = { szene: szene, symbol: symbol, tempo: tempo };
})(typeof window !== 'undefined' ? window : globalThis);
