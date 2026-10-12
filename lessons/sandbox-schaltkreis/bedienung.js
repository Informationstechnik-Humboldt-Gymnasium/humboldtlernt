// Schaltkreis-Labor · Bedienung (Maus, Stift und Touch)
//
// Übersetzt Zeiger-Ereignisse in Änderungen an der Schaltung. Kennt kein DOM: Koordinaten kommen
// relativ zur Arbeitsfläche (Bildschirmpixel) herein, die Ansicht (Verschieben/Zoomen) liegt hier.
//
//   Bauteil ziehen          → verschieben (rastet im 20er-Raster ein)
//   Bauteil antippen        → auswählen; Schalter umlegen, Multimeter-Taste drücken
//   Von Anschluss ziehen    → Draht zu einem anderen Anschluss
//   Anschluss antippen      → Draht beginnt, zweiten Anschluss antippen (gut auf Tablets)
//   Leere Fläche ziehen     → Ansicht verschieben;  zwei Finger / Mausrad → zoomen
//
// ctx (vom UI): doc() · merke(vorher) · geaendert() · zeige() · auswahl(sel) · meldung(text, art)
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});

  var ZOOM_MIN = 0.35, ZOOM_MAX = 3;

  function Bedienung(ctx) {
    this.ctx = ctx;
    this.view = { x: -300, y: -220, s: 1 };   // Weltkoordinate der linken oberen Ecke und Maßstab
    this.zeiger = {};                          // gedrückte Zeiger: id → {x, y}
    this.zustand = null;                       // laufende Geste
    this.vorschau = null;                      // für die Darstellung: Draht in Arbeit / neues Bauteil
    this.hover = null;
  }
  var P = Bedienung.prototype;
  var M = function () { return SL.modell; };

  P.welt = function (p) { return { x: this.view.x + p.x / this.view.s, y: this.view.y + p.y / this.view.s }; };
  P.fang = function (typ) { return (typ === 'touch' ? 24 : typ === 'pen' ? 14 : 11) / Math.min(this.view.s, 1.4); };
  P.schwelle = function (typ) { return typ === 'touch' ? 10 : 5; };
  var abstand = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  P.anzahl = function () { return Object.keys(this.zeiger).length; };

  P.runter = function (p) {
    var ctx = this.ctx, doc = ctx.doc();
    this.zeiger[p.id] = { x: p.x, y: p.y };
    if (this.anzahl() === 2) return this.starteZoom();
    if (this.anzahl() > 2 || (p.taste != null && p.taste !== 0)) return;
    var w = this.welt(p), h = M().trefferTest(doc, w.x, w.y, this.fang(p.typ));

    if (this.zustand && this.zustand.art === 'wartet') {
      var von = this.zustand.von;
      this.zustand = null; this.vorschau = null;
      if (h && h.art === 'anschluss') { this.zustand = { art: 'beendet' }; this.verbinde(von, h); return; }
      ctx.meldung('Verbinden abgebrochen.', 'hinweis');
      ctx.zeige();
    }
    if (!h) {
      ctx.auswahl(null);
      this.zustand = { art: 'schieben', start: p, view0: { x: this.view.x, y: this.view.y } };
      return;
    }
    if (h.art === 'anschluss') {
      this.zustand = { art: 'draht', von: { b: h.b, a: h.a }, start: p };
      this.vorschau = { art: 'draht', von: { b: h.b, a: h.a }, x: w.x, y: w.y, ziel: null, gueltig: false };
      ctx.zeige();
      return;
    }
    if (h.art === 'bauteil') {
      var b = M().finde(doc, h.b);
      ctx.auswahl({ art: 'bauteil', id: b.id });
      this.zustand = { art: 'ziehen', id: b.id, start: p, w0: w, x0: b.x, y0: b.y, bewegt: false, vorher: M().kopie(doc) };
      return;
    }
    ctx.auswahl({ art: 'draht', id: h.d });
    this.zustand = null;
  };

  P.bewegen = function (p) {
    var ctx = this.ctx, doc = ctx.doc(), z = this.zustand, w;
    if (!this.zeiger[p.id]) {
      // Zeiger nicht gedrückt (Maus schwebt): Anschlüsse hervorheben, Draht im Wartemodus folgt
      w = this.welt(p);
      var h = M().trefferTest(doc, w.x, w.y, this.fang(p.typ));
      var alt = this.hover && JSON.stringify(this.hover);
      this.hover = h;
      if (z && z.art === 'wartet') { this.aktualisiereDraht(z.von, w, h); ctx.zeige(); }
      else if (alt !== (h && JSON.stringify(h))) ctx.zeige();
      return;
    }
    this.zeiger[p.id] = { x: p.x, y: p.y };
    if (!z) return;
    if (z.art === 'zoom') {
      var ids = Object.keys(this.zeiger), a = this.zeiger[ids[0]], b = this.zeiger[ids[1]];
      var d = Math.max(10, abstand(a, b)), mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      var s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z.s0 * d / z.d0));
      this.view.s = s;
      this.view.x = z.anker.x - mitte.x / s;
      this.view.y = z.anker.y - mitte.y / s;
      ctx.zeige();
      return;
    }
    if (z.art === 'ziehen') {
      if (!z.bewegt && abstand(p, z.start) < this.schwelle(p.typ)) return;
      w = this.welt(p);
      z.bewegt = true;
      if (M().verschiebe(doc, z.id, z.x0 + w.x - z.w0.x, z.y0 + w.y - z.w0.y)) {
        if (!z.gemerkt) { z.gemerkt = true; ctx.merke(z.vorher); }
        ctx.geaendert('bewegen');
      }
      return;
    }
    if (z.art === 'draht') {
      w = this.welt(p);
      if (abstand(p, z.start) >= this.schwelle(p.typ)) z.bewegt = true;
      this.aktualisiereDraht(z.von, w, M().trefferTest(doc, w.x, w.y, this.fang(p.typ)));
      ctx.zeige();
      return;
    }
    if (z.art === 'schieben') {
      if (!z.bewegt && abstand(p, z.start) < this.schwelle(p.typ)) return;
      z.bewegt = true;
      this.view.x = z.view0.x - (p.x - z.start.x) / this.view.s;
      this.view.y = z.view0.y - (p.y - z.start.y) / this.view.s;
      ctx.zeige();
      return;
    }
    if (z.art === 'neu') {
      w = this.welt(p);
      if (abstand(p, z.start) >= this.schwelle(p.typ)) z.bewegt = true;
      this.vorschau = { art: 'neu', typ: z.typ, x: M().runde(w.x), y: M().runde(w.y), drin: !!p.drin };
      ctx.zeige();
    }
  };

  P.aktualisiereDraht = function (von, w, h) {
    var ziel = h && h.art === 'anschluss' ? { b: h.b, a: h.a } : null;
    var grund = ziel ? M().verbindungFehler(this.ctx.doc(), von, ziel) : null;
    this.vorschau = { art: 'draht', von: von, x: w.x, y: w.y, ziel: ziel, gueltig: !!ziel && !grund, grund: grund };
  };

  P.hoch = function (p) {
    var ctx = this.ctx, doc = ctx.doc(), z = this.zustand, w = this.welt(p);
    var warGedrueckt = !!this.zeiger[p.id];
    delete this.zeiger[p.id];
    if (!z || !warGedrueckt) return;
    if (z.art === 'zoom') { if (!this.anzahl()) this.zustand = null; return; }
    if (z.art === 'beendet') { this.zustand = null; return; }
    if (z.art === 'ziehen') {
      this.zustand = null;
      if (!z.bewegt) {
        var vorher = M().kopie(doc), text = M().tippAktion(doc, z.id, w.x, w.y);
        if (text) { ctx.merke(vorher); ctx.geaendert('tippen'); ctx.meldung(text, 'ok'); }
      }
      return;
    }
    if (z.art === 'draht') {
      var h = M().trefferTest(doc, w.x, w.y, this.fang(p.typ));
      if (h && h.art === 'anschluss' && !(h.b === z.von.b && h.a === z.von.a)) {
        this.zustand = null; this.vorschau = null;
        this.verbinde(z.von, h);
        return;
      }
      if (!z.bewegt) {
        // Antippen: Draht hängt am Anschluss und wartet auf den zweiten
        this.zustand = { art: 'wartet', von: z.von };
        this.aktualisiereDraht(z.von, w, null);
        var b = M().finde(doc, z.von.b);
        ctx.meldung('Draht an ' + b.name + ' (' + M().anschlussName(b, z.von.a) + '). Tippe jetzt auf einen zweiten Anschluss.', 'hinweis');
        ctx.zeige();
        return;
      }
      this.zustand = null; this.vorschau = null;
      ctx.meldung('Ein Draht muss an einem Anschluss enden. Ziehe bis auf einen Anschlusspunkt.', 'fehler');
      ctx.zeige();
      return;
    }
    if (z.art === 'neu') {
      this.zustand = null; this.vorschau = null;
      if (z.bewegt && !p.drin) { ctx.meldung('Lass das Bauteil über der Arbeitsfläche los.', 'hinweis'); ctx.zeige(); return; }
      var pos = z.bewegt ? { x: w.x, y: w.y } : this.freierPlatz(z.typ);
      this.fuegeEin(z.typ, pos.x, pos.y);
      return;
    }
    this.zustand = null;
  };

  P.abbrechen = function (p) {
    delete this.zeiger[p.id];
    var z = this.zustand;
    if (z && z.art === 'ziehen' && z.bewegt) this.ctx.geaendert('bewegen');
    if (!z || z.art !== 'wartet') { this.zustand = null; this.vorschau = null; }
    this.ctx.zeige();
  };

  /** Escape: laufenden Draht abbrechen. */
  P.escape = function () {
    if (this.zustand && (this.zustand.art === 'wartet' || this.zustand.art === 'draht')) {
      this.zustand = null; this.vorschau = null;
      this.ctx.meldung('Verbinden abgebrochen.', 'hinweis');
      this.ctx.zeige();
      return true;
    }
    return false;
  };

  P.starteZoom = function () {
    var z = this.zustand;
    if (z && z.art === 'ziehen' && z.bewegt) this.ctx.geaendert('bewegen');
    var ids = Object.keys(this.zeiger), a = this.zeiger[ids[0]], b = this.zeiger[ids[1]];
    var mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.zustand = { art: 'zoom', d0: Math.max(10, abstand(a, b)), s0: this.view.s, anker: this.welt(mitte) };
    this.vorschau = null;
    this.ctx.zeige();
  };

  P.verbinde = function (von, nach) {
    var ctx = this.ctx, doc = ctx.doc(), vorher = M().kopie(doc);
    var r = M().verbinde(doc, von, { b: nach.b, a: nach.a });
    this.vorschau = null;
    if (!r.ok) { ctx.meldung(r.grund, 'fehler'); ctx.zeige(); return false; }
    ctx.merke(vorher);
    ctx.geaendert('verbinden');
    var b1 = M().finde(doc, von.b), b2 = M().finde(doc, nach.b);
    ctx.meldung('Verbunden: ' + b1.name + ' (' + M().anschlussName(b1, von.a) + ') mit ' + b2.name + ' (' + M().anschlussName(b2, nach.a) + ').', 'ok');
    return true;
  };

  // ---------------------------------------------------------------- Bauteile aus der Leiste

  /** Ziehen aus der Bauteilleiste beginnt (p in Koordinaten der Arbeitsfläche, p.drin: Zeiger über der Fläche). */
  P.leisteRunter = function (typ, p) {
    this.zeiger[p.id] = { x: p.x, y: p.y };
    this.zustand = { art: 'neu', typ: typ, start: p, bewegt: false };
  };

  /** Rechteck (Weltkoordinaten) eines Bauteils, auch gedreht. */
  function rechteck(typ, x, y, rot, rand) {
    var bx = SL.TYPEN[typ].box, a = M().drehe(bx[0], bx[1], rot), c = M().drehe(bx[0] + bx[2], bx[1] + bx[3], rot);
    return { x0: x + Math.min(a[0], c[0]) - rand, y0: y + Math.min(a[1], c[1]) - rand, x1: x + Math.max(a[0], c[0]) + rand, y1: y + Math.max(a[1], c[1]) + rand };
  }
  var ueberlappt = function (r, q) { return r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1; };

  /** Freier Platz für ein neues Bauteil: möglichst mittig in der Ansicht, ohne andere Bauteile und Drähte zu überdecken. */
  P.freierPlatz = function (typ) {
    var doc = this.ctx.doc(), g = this.groesse || { w: 600, h: 400 };
    typ = typ || 'lampe';
    var mx = M().runde(this.view.x + g.w / 2 / this.view.s), my = M().runde(this.view.y + g.h / 2 / this.view.s);
    var hindernisse = doc.bauteile.map(function (b) { return rechteck(b.typ, b.x, b.y, b.rot, 6); });
    doc.draehte.forEach(function (d) {
      var pts = M().drahtPunkte(doc, d) || [];
      for (var i = 0; i < pts.length - 1; i++) hindernisse.push({ x0: Math.min(pts[i].x, pts[i + 1].x) - 4, y0: Math.min(pts[i].y, pts[i + 1].y) - 4, x1: Math.max(pts[i].x, pts[i + 1].x) + 4, y1: Math.max(pts[i].y, pts[i + 1].y) + 4 });
    });
    var frei = function (x, y) { var r = rechteck(typ, x, y, 0, 14); return hindernisse.every(function (h) { return !ueberlappt(r, h); }); };
    // Spirale um die Mitte, in Rasterschritten
    for (var ring = 0; ring < 25; ring++) {
      for (var dx = -ring; dx <= ring; dx++) for (var dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        var x = mx + dx * 40, y = my + dy * 40;
        if (frei(x, y)) return { x: x, y: y };
      }
    }
    return { x: mx, y: my };
  };

  P.fuegeEin = function (typ, x, y) {
    var ctx = this.ctx, doc = ctx.doc(), vorher = M().kopie(doc);
    var b = M().bauteil(doc, typ, x, y);
    ctx.merke(vorher);
    ctx.auswahl({ art: 'bauteil', id: b.id });
    ctx.geaendert('einfuegen');
    ctx.meldung(SL.TYPEN[typ].name + ' ' + b.name + ' eingefügt. Verbinde seine Anschlüsse mit Drähten.', 'ok');
    return b;
  };

  // ---------------------------------------------------------------- Ansicht

  P.zoomUm = function (p, faktor) {
    var w = this.welt(p);
    var s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.view.s * faktor));
    this.view.s = s;
    this.view.x = w.x - p.x / s;
    this.view.y = w.y - p.y / s;
    this.ctx.zeige();
  };

  /** Alles sichtbar machen. */
  P.einpassen = function () {
    var doc = this.ctx.doc(), g = this.groesse || { w: 600, h: 400 };
    if (!doc.bauteile.length) { this.view = { x: -g.w / 2, y: -g.h / 2, s: 1 }; this.ctx.zeige(); return; }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    doc.bauteile.forEach(function (b) {
      var bx = SL.TYPEN[b.typ].box, ecken = [[bx[0], bx[1]], [bx[0] + bx[2], bx[1] + bx[3]], [bx[0], bx[1] + bx[3]], [bx[0] + bx[2], bx[1]]];
      ecken.concat(Object.keys(SL.TYPEN[b.typ].anschluesse).map(function (a) { return SL.TYPEN[b.typ].anschluesse[a]; })).forEach(function (e) {
        var p = M().drehe(e[0], e[1], b.rot);
        x0 = Math.min(x0, b.x + p[0]); x1 = Math.max(x1, b.x + p[0]); y0 = Math.min(y0, b.y + p[1]); y1 = Math.max(y1, b.y + p[1]);
      });
      // Platz für die Beschriftung (rechts bei senkrechten, unten bei waagerechten Bauteilen)
      if (b.typ !== 'messgeraet' && (b.rot === 90 || b.rot === 270)) x1 = Math.max(x1, b.x + 140);
      else y1 = Math.max(y1, b.y + 75);
    });
    var rand = 30;
    var s = Math.min(1.6, Math.max(ZOOM_MIN, Math.min(g.w / (x1 - x0 + 2 * rand), g.h / (y1 - y0 + 2 * rand))));
    this.view = { s: s, x: (x0 + x1) / 2 - g.w / 2 / s, y: (y0 + y1) / 2 - g.h / 2 / s };
    this.ctx.zeige();
  };

  SL.Bedienung = Bedienung;
})(typeof window !== 'undefined' ? window : globalThis);
