// BioLab · gemeinsame Bausteine für alle Module (kein Modul hängt von einem anderen ab)
//
//   BL.svg(tag, attrs, parent)          SVG-Element erzeugen
//   BL.seg(box, optionen, wert, fn)     Umschalter (.seg) mit aria-pressed
//   BL.info(box, eintrag)               Infobereich füllen: { name, text, hinweis, art }
//   BL.auswahl(svg, fn)                 Elemente mit data-s antippbar und per Tastatur wählbar machen
//   BL.markiere(svg, id)                gewählte Struktur hervorheben
//   BL.player(box, optionen)            Ablauf mit Start/Pause, Schritt, Neustart und Fortschrittsanzeige
//   BL.werkbank(titel, …)               einheitliches Grundgerüst eines Modul-Bereichs
//   BL.rng(seed)                        reproduzierbarer Zufall für erzeugte Präparate
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});
  var NS = 'http://www.w3.org/2000/svg';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(e);
    return e;
  }
  function html(tag, attrs, parent) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(e);
    return e;
  }
  function leeren(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function fmt(x, stellen) { return root.LK ? root.LK.fmt(x, stellen) : String(x); }
  var reduziert = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** Reproduzierbarer Zufall (LCG), damit erzeugte Präparate bei jedem Laden gleich aussehen. */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /** Umschalter: optionen = [{ wert, text }] */
  function seg(box, optionen, wert, fn, label) {
    leeren(box);
    box.classList.add('seg');
    box.setAttribute('role', 'group');
    if (label) box.setAttribute('aria-label', label);
    optionen.forEach(function (o) {
      var b = html('button', { type: 'button', text: o.text, 'aria-pressed': o.wert === wert ? 'true' : 'false', 'data-wert': o.wert }, box);
      if (o.titel) b.title = o.titel;
      b.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        fn(o.wert);
      });
    });
  }
  function segSetze(box, wert) {
    box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-wert') === String(wert) ? 'true' : 'false'); });
  }

  /** Infobereich. art: 'schema' | 'modell' | 'foto' – wird als kleines Etikett angezeigt. */
  function info(box, e) {
    if (!e) { box.innerHTML = '<p class="muted small">Tippe eine Struktur an, um mehr zu erfahren.</p>'; return; }
    box.innerHTML = '<h3>' + esc(e.name) + '</h3>' + (e.text ? '<p>' + e.text + '</p>' : '') +
      (e.hinweis ? '<p class="small muted">' + e.hinweis + '</p>' : '');
  }

  /** Alle Elemente mit data-s im SVG werden antippbar (Maus, Touch, Tastatur). */
  function auswahl(svgEl, fn) {
    svgEl.addEventListener('click', function (ev) {
      var t = ev.target.closest && ev.target.closest('[data-s]');
      if (t && svgEl.contains(t)) fn(t.getAttribute('data-s'), t);
    });
    svgEl.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var t = ev.target.closest && ev.target.closest('[data-s]');
      if (t) { ev.preventDefault(); fn(t.getAttribute('data-s'), t); }
    });
  }
  /** Element als wählbar kennzeichnen (Fokus per Tab, Name für Screenreader). */
  function waehlbar(el, id, name) {
    el.setAttribute('data-s', id);
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', name);
    el.classList.add('wahl');
    return el;
  }
  function markiere(svgEl, id) {
    svgEl.querySelectorAll('[data-s]').forEach(function (e) { e.classList.toggle('gewaehlt', e.getAttribute('data-s') === id); });
  }

  /**
   * Ablaufsteuerung. optionen:
   *   schritte: [{ titel, text, dauer (s) }]
   *   zeichne(i, t)  – Schritt i, Fortschritt t ∈ [0, 1] innerhalb des Schritts
   *   schleife: true → nach dem letzten Schritt von vorn
   *   tempo: Faktor (veränderbar über player.tempo = x)
   */
  function player(box, opt) {
    leeren(box);
    box.classList.add('player');
    var bar = html('div', { class: 'row eng' }, box);
    var bStart = html('button', { type: 'button', class: 'primary', text: '▶ Start', 'aria-label': 'Ablauf starten' }, bar);
    var bZurueck = html('button', { type: 'button', text: '◀', 'aria-label': 'vorheriger Schritt', title: 'vorheriger Schritt' }, bar);
    var bVor = html('button', { type: 'button', text: '▶|', 'aria-label': 'nächster Schritt', title: 'nächster Schritt' }, bar);
    var bNeu = html('button', { type: 'button', text: '↺ Neu', 'aria-label': 'Ablauf von vorn' }, bar);
    var stufen = html('ol', { class: 'stufen' }, box);
    var text = html('div', { class: 'schritt-text', 'aria-live': 'polite' }, box);
    var P = { i: 0, t: 0, laeuft: false, tempo: opt.tempo || 1 };
    opt.schritte.forEach(function (s, k) {
      var li = html('li', {}, stufen);
      var b = html('button', { type: 'button', text: (k + 1) + ' ' + s.titel }, li);
      b.addEventListener('click', function () { gehe(k, 0); });
    });
    function anzeigen() {
      stufen.querySelectorAll('li').forEach(function (li, k) { li.classList.toggle('aktiv', k === P.i); li.classList.toggle('fertig', k < P.i); });
      var s = opt.schritte[P.i];
      text.innerHTML = '<b>' + (P.i + 1) + '. ' + esc(s.titel) + '</b> ' + s.text;
      bStart.textContent = P.laeuft ? '❚❚ Pause' : '▶ Start';
      bStart.setAttribute('aria-label', P.laeuft ? 'Ablauf anhalten' : 'Ablauf starten');
      opt.zeichne(P.i, P.t);
    }
    function gehe(i, t) { P.i = Math.max(0, Math.min(opt.schritte.length - 1, i)); P.t = t; anzeigen(); }
    var last = 0;
    function frame(ts) {
      if (!P.laeuft) return;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
      var dauer = (opt.schritte[P.i].dauer || 3) / P.tempo;
      P.t += dt / dauer;
      if (P.t >= 1) {
        if (P.i < opt.schritte.length - 1) { P.i++; P.t = 0; anzeigen(); }
        else if (opt.schleife) { P.i = 0; P.t = 0; anzeigen(); }
        else { P.t = 1; P.laeuft = false; anzeigen(); return; }
      }
      opt.zeichne(P.i, P.t);
      requestAnimationFrame(frame);
    }
    function start() {
      if (P.i === opt.schritte.length - 1 && P.t >= 1) gehe(0, 0);
      P.laeuft = true; last = 0; anzeigen(); requestAnimationFrame(frame);
    }
    function pause() { P.laeuft = false; anzeigen(); }
    bStart.addEventListener('click', function () { if (P.laeuft) pause(); else start(); });
    // Schrittweise: erst den laufenden Schritt abschließen, dann jeweils zum Ende des nächsten
    bVor.addEventListener('click', function () { pause(); if (P.t < 1) gehe(P.i, 1); else gehe(P.i + 1, 1); });
    bZurueck.addEventListener('click', function () { pause(); gehe(P.i - 1, 1); });
    bNeu.addEventListener('click', function () { pause(); gehe(0, 0); });
    P.start = start; P.pause = pause; P.gehe = gehe; P.neu = function () { pause(); gehe(0, 0); };
    anzeigen();
    return P;
  }

  /** Einheitliches Gerüst eines Untersuchungsbereichs: links Bühne, rechts Werkzeuge und Info. */
  function werkbank(panel, o) {
    panel.innerHTML =
      '<div class="bl-bereich-kopf">' +
        (o.unter ? '<div class="unter" id="' + o.id + '-unter"></div>' : '') +
      '</div>' +
      '<div class="bl-werkbank">' +
        '<div class="bl-buehne lk-card">' +
          '<div class="bl-leiste" id="' + o.id + '-leiste"></div>' +
          '<div class="bl-flaeche" id="' + o.id + '-flaeche"></div>' +
          '<p class="bl-art small" id="' + o.id + '-art"></p>' +
        '</div>' +
        '<aside class="bl-seite">' +
          '<div class="lk-card" id="' + o.id + '-werkzeug"></div>' +
          '<div class="lk-card bl-info" id="' + o.id + '-info" aria-live="polite"></div>' +
        '</div>' +
      '</div>' +
      '<div id="' + o.id + '-extra"></div>';
    return {
      unter: $(o.id + '-unter'), leiste: $(o.id + '-leiste'), flaeche: $(o.id + '-flaeche'),
      art: $(o.id + '-art'), werkzeug: $(o.id + '-werkzeug'), info: $(o.id + '-info'), extra: $(o.id + '-extra'),
    };
  }

  /** Kennzeichnung der Darstellungsart unter der Bühne. */
  var ARTEN = {
    schema: '<span class="art-etikett">Schema</span> Gezeichnete, vereinfachte Darstellung – keine Mikroskopaufnahme.',
    modell: '<span class="art-etikett">Modell</span> Vereinfachtes Modell. Formen und Größenverhältnisse sind teilweise angepasst, damit man die Bestandteile erkennt.',
    simulation: '<span class="art-etikett">Simulation</span> Rechenmodell mit vereinfachten Annahmen. Die Grenzen stehen im Text daneben.',
  };
  function art(box, wer, zusatz) { box.innerHTML = ARTEN[wer] + (zusatz ? ' ' + zusatz : ''); }

  /** Kleiner Animations-Takt, der nur läuft, solange das Modul sichtbar ist. */
  function takt(fn) {
    var aktiv = false, last = 0;
    function f(ts) {
      if (!aktiv) return;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
      fn(dt, ts / 1000);
      requestAnimationFrame(f);
    }
    return {
      an: function () { if (!aktiv) { aktiv = true; last = 0; requestAnimationFrame(f); } },
      aus: function () { aktiv = false; },
      get laeuft() { return aktiv; },
    };
  }

  /** Beschriftungen: Text mit Hintergrund-Kasten, Linie zum Ziel. */
  function etikett(parent, x, y, tx, ty, text, id) {
    var g = svg('g', { class: 'etikett' }, parent);
    svg('line', { x1: x, y1: y, x2: tx, y2: ty, class: 'etikett-linie' }, g);
    svg('circle', { cx: x, cy: y, r: 2.5, class: 'etikett-punkt' }, g);
    var t = svg('text', { x: tx, y: ty, class: 'etikett-text', 'text-anchor': tx < x ? 'end' : 'start', 'dominant-baseline': 'middle', text: text }, g);
    if (id) g.setAttribute('data-ziel', id);
    return t;
  }

  /**
   * Beschriftungen in zwei Spalten am linken und rechten Rand einer Fläche (Breite w, Höhe h).
   * punkte: [{ id, x, y, text }] – Zielpunkte in SVG-Koordinaten. Texte werden nach der Höhe sortiert
   * und so verschoben, dass sie sich nicht überdecken. Gibt die Gruppe zurück.
   */
  function beschriftung(parent, punkte, w, h, opt) {
    opt = opt || {};
    var g = svg('g', { class: 'etiketten', 'pointer-events': 'none' }, parent);
    var rand = opt.rand || 8, ab = opt.abstand || 18, oben = opt.oben || 14, unten = h - (opt.unten || 10);
    var mitte = opt.mitte !== undefined ? opt.mitte : w / 2;
    var links = punkte.filter(function (p) { return p.x < mitte; }), rechts = punkte.filter(function (p) { return p.x >= mitte; });
    [[links, -1], [rechts, 1]].forEach(function (sp) {
      var col = sp[0].slice().sort(function (a, b) { return a.y - b.y; }), n = col.length;
      col.forEach(function (q) { q.ty = Math.max(oben, Math.min(unten, q.y)); });
      for (var i = 1; i < n; i++) if (col[i].ty < col[i - 1].ty + ab) col[i].ty = col[i - 1].ty + ab;
      if (n && col[n - 1].ty > unten) { col[n - 1].ty = unten; for (var j = n - 2; j >= 0; j--) if (col[j].ty > col[j + 1].ty - ab) col[j].ty = col[j + 1].ty - ab; }
      col.forEach(function (q) {
        var tx = sp[1] < 0 ? rand : w - rand;
        var t = svg('text', { x: tx, y: q.ty, 'dominant-baseline': 'middle', 'text-anchor': sp[1] < 0 ? 'start' : 'end', class: 'etikett-text', text: q.text }, g);
        var tw = t.getComputedTextLength ? t.getComputedTextLength() : 60;
        var lx = sp[1] < 0 ? tx + tw + 4 : tx - tw - 4;
        g.insertBefore(svg('line', { x1: q.x, y1: q.y, x2: lx, y2: q.ty, class: 'etikett-linie' }), t);
        g.insertBefore(svg('circle', { cx: q.x, cy: q.y, r: 2.5, class: 'etikett-punkt' }), t);
      });
    });
    return g;
  }

  /** Unterbereiche eines Moduls als Reiterleiste */
  function unterReiter(box, optionen, wert, fn) {
    seg(box, optionen, wert, fn, 'Bereich wählen');
    box.classList.remove('seg');
  }

  BL.ui = {
    beschriftung: beschriftung, unterReiter: unterReiter,
    $: $, esc: esc, svg: svg, html: html, leeren: leeren, fmt: fmt, rng: rng, reduziert: reduziert,
    seg: seg, segSetze: segSetze, info: info, auswahl: auswahl, waehlbar: waehlbar, markiere: markiere,
    player: player, werkbank: werkbank, art: art, takt: takt, etikett: etikett,
  };
  BL.module = BL.module || {};
})(window);
