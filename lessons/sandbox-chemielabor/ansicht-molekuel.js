// Atom- & Chemielabor · Reiter „Moleküle“ = Molecule Builder (Oberfläche)
//
// Rechnet nichts Chemisches selbst: Modell, Validierung und Erkennung kommen aus molekuel.js, die Aufgaben aus
// aufgaben-molekuel.js. Hier liegen nur Zeiger-/Tastaturbedienung, Ansicht (Zoom/Verschieben), Verlauf (Rückgängig/
// Wiederholen), Darstellung und das Speichern im Browser (LocalStorage, nur auf diesem Gerät).
// Die 3D-Ansicht (ansicht-molekuel-3d.js) zeigt dasselbe Modell räumlich; gebaut wird nur in 2D.
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, C = CL.chemie, M = CL.molekuel, D = CL.daten, A = CL.molekuelAufgaben, D3 = CL.molekuel3d;
  var esc = U.esc, s = U.svg;
  var SPEICHER = 'chemielabor-molekuel';
  var BASIS = { w: 600, h: 380 }, ZOOM_MIN = 0.4, ZOOM_MAX = 3;
  var STATUS = {
    gueltig: ['Gültige Modellstruktur', 'info'],
    unvollstaendig: ['Unvollständig', 'warn'],
    verletzung: ['Regelverletzung', 'fehler'],
    unklar: ['Nicht abschließend beurteilbar', 'info'],
  };
  var st = {
    m: M.neu(), werkzeug: 'C', ordnung: 1, auswahl: null, verlauf: [], zukunft: [], ausBeispiel: false,
    view: { s: 1, cx: 0, cy: 0 }, zeiger: {}, geste: null, modus: 'frei', aufgabe: null, erledigt: {}, gestartet: false, dreiD: false,
  };

  // ------------------------------------------------------------ Speichern (LocalStorage, mit Fehlertoleranz)
  function speichere() {
    try { localStorage.setItem(SPEICHER, JSON.stringify({ modell: st.m, erledigt: Object.keys(st.erledigt) })); } catch (e) { /* kein Speicher verfügbar */ }
  }
  function lade() {
    try {
      var d = JSON.parse(localStorage.getItem(SPEICHER) || 'null');
      if (!d) return false;
      (d.erledigt || []).forEach(function (id) { if (A.finde(id)) st.erledigt[id] = true; });
      var r = M.importiere(d.modell);
      if (r.ok) { st.m = r.modell; return true; }
    } catch (e) { /* kaputte oder fehlende Daten: neu anfangen */ }
    return false;
  }

  // ------------------------------------------------------------ Verlauf
  function merke() {
    st.verlauf.push(JSON.stringify(st.m));
    if (st.verlauf.length > 100) st.verlauf.shift();
    st.zukunft = [];
  }
  function rueckgaengig() {
    if (!st.verlauf.length) return;
    st.zukunft.push(JSON.stringify(st.m));
    st.m = JSON.parse(st.verlauf.pop());
    st.auswahl = null; geaendert(); toast('Rückgängig gemacht.');
  }
  function wiederholen() {
    if (!st.zukunft.length) return;
    st.verlauf.push(JSON.stringify(st.m));
    st.m = JSON.parse(st.zukunft.pop());
    st.auswahl = null; geaendert(); toast('Wiederholt.');
  }

  var toastZeit = null;
  function toast(text, art) {
    var t = U.$('mol-toast');
    t.textContent = text; t.className = 'mol-toast zeigen' + (art ? ' ' + art : '');
    clearTimeout(toastZeit);
    toastZeit = setTimeout(function () { t.className = 'mol-toast'; }, art === 'fehler' ? 4500 : 2600);
  }

  // ------------------------------------------------------------ Start
  function init() {
    st.gestartet = true;
    var pal = U.$('mol-palette');
    pal.innerHTML = Object.keys(D.BAUKASTEN).map(function (el) {
      var k = D.BAUKASTEN[el], e = C.element(el);
      return '<button type="button" class="mol-el" data-el="' + el + '" aria-pressed="' + (el === st.werkzeug) + '" aria-label="' + esc(e.name + ', ' + el + ', Bindigkeit ' + k.bindigkeit) + '">' +
        '<i class="kugel-mini el-' + el + '" aria-hidden="true"></i><b>' + el + '</b><small>' + esc(e.name) + '</small></button>';
    }).join('');
    pal.addEventListener('pointerdown', paletteZiehen);
    pal.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-el]');
      if (!b) return;
      werkzeug(b.dataset.el);
      if (ev.detail === 0) { var p = freierPlatz(); setzeAtom(b.dataset.el, p.x, p.y); }   // Tastatur: gleich einsetzen
    });
    U.$('mol-ordnung').addEventListener('click', function (ev) { var b = ev.target.closest('[data-ordnung]'); if (b) ordnung(Number(b.dataset.ordnung)); });
    var bsp = U.$('mol-beispiel');
    D.MOLEKUELE.forEach(function (x) { bsp.insertAdjacentHTML('beforeend', '<option value="' + x.id + '">' + esc(x.name) + '</option>'); });
    bsp.addEventListener('change', function () {
      if (!this.value) return;
      merke(); st.m = M.beispiel(this.value); st.ausBeispiel = true; st.auswahl = null; this.value = '';
      einpassen(); geaendert();
    });
    U.$('mol-rueck').addEventListener('click', rueckgaengig);
    U.$('mol-vor').addEventListener('click', wiederholen);
    U.$('mol-loeschen').addEventListener('click', loeschen);
    U.$('mol-entfernen').addEventListener('click', molekuelEntfernen);
    U.$('mol-leeren').addEventListener('click', function () {
      if (!st.m.atome.length) return;
      merke(); st.m = M.neu(); st.auswahl = null; st.ausBeispiel = false; geaendert(); toast('Fläche geleert. Mit ↶ holst du alles zurück.');
    });
    U.$('mol-binden').addEventListener('click', function () {
      var a = Number(U.$('mol-a').value), b = Number(U.$('mol-b').value);
      if (!a || !b) return;
      bindung(a, b, st.ordnung);
    });
    U.$('mol-zoom-plus').addEventListener('click', function () { if (st.dreiD) D3.zoom(0.8); else zoom(1.25); });
    U.$('mol-zoom-minus').addEventListener('click', function () { if (st.dreiD) D3.zoom(1.25); else zoom(0.8); });
    U.$('mol-zoom-fit').addEventListener('click', function () { if (st.dreiD) D3.zuruecksetzen(); else { einpassen(); zeichne(true); } });
    U.$('mol-ansicht-2d').addEventListener('click', function () { darstellung(false); });
    U.$('mol-ansicht-3d').addEventListener('click', function () { darstellung(true); });
    U.$('mol-3d-optionen').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-option]');
      if (b) { var an = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', an); D3.option(b.dataset.option, an); }
      if (ev.target.closest('#mol-3d-zurueck')) D3.zuruecksetzen();
    });
    if (!D3 || !D3.verfuegbar()) {
      var k3 = U.$('mol-ansicht-3d');
      k3.disabled = true; k3.title = 'Die 3D-Ansicht braucht WebGL. Dein Browser oder Gerät unterstützt das gerade nicht.';
      U.$('mol-3d-fehlt').hidden = false;
    }
    U.$('mol-modus-frei').addEventListener('click', function () { modus('frei'); });
    U.$('mol-modus-lernen').addEventListener('click', function () { modus('lernen'); });
    U.$('mol-aufgaben').addEventListener('click', function (ev) { var b = ev.target.closest('[data-aufgabe]'); if (b) aufgabeWaehlen(b.dataset.aufgabe); });
    U.$('mol-aufgabe').addEventListener('click', aufgabeKlick);
    U.$('mol-auswahl').addEventListener('click', auswahlKlick);

    var svgEl = U.$('mol-svg');
    svgEl.setAttribute('tabindex', '0');
    svgEl.addEventListener('pointerdown', runter);
    svgEl.addEventListener('pointermove', bewegen);
    svgEl.addEventListener('pointerup', hoch);
    svgEl.addEventListener('pointercancel', abbrechen);
    svgEl.addEventListener('wheel', function (ev) { ev.preventDefault(); zoom(Math.exp(-Math.max(-60, Math.min(60, ev.deltaY)) * 0.004), punkt(ev)); }, { passive: false });
    svgEl.addEventListener('keydown', tasten);
    U.$('p-molekuel').addEventListener('keydown', function (ev) {
      if (ev.target.closest('input, select, textarea')) return;
      var k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === 'z' && !ev.shiftKey) { ev.preventDefault(); rueckgaengig(); }
      else if ((ev.ctrlKey || ev.metaKey) && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); wiederholen(); }
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && st.auswahl && ev.target === document.body) { ev.preventDefault(); loeschen(); }
    });

    if (!lade()) { st.m = M.beispiel('h2o'); st.ausBeispiel = true; }
    einpassen();
    geaendert(true);
  }

  /** Zwischen 2D (bauen) und 3D (ansehen) umschalten. */
  function darstellung(dreiD) {
    if (dreiD && !D3.start(U.$('mol-3d'), {
      waehle: function (id) { st.auswahl = id ? { art: 'atom', id: id } : null; zeichne(); },
      gedreht: function () { if (st.m.atome.length >= 3) root.LK.reach('mol-3d'); },
    })) { U.$('mol-ansicht-3d').disabled = true; U.$('mol-3d-fehlt').hidden = false; toast('Die 3D-Ansicht lässt sich auf diesem Gerät nicht starten.', 'fehler'); return; }
    st.dreiD = dreiD;
    U.$('mol-ansicht-2d').setAttribute('aria-pressed', !dreiD);
    U.$('mol-ansicht-3d').setAttribute('aria-pressed', dreiD);
    U.$('mol-svg').toggleAttribute('hidden', dreiD);
    U.$('mol-3d').toggleAttribute('hidden', !dreiD);
    ['mol-3d-optionen', 'mol-hilfe-3d', 'mol-3d-etikett'].forEach(function (id) { U.$(id).hidden = !dreiD; });
    U.$('mol-hilfe').hidden = dreiD;
    D3.aktiv(dreiD);
    zeichne();
  }

  function werkzeug(el) {
    st.werkzeug = el;
    document.querySelectorAll('#mol-palette [data-el]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.el === el); });
  }

  /** Bindungsart wählen. Ist eine Bindung ausgewählt, bekommt sie gleich diese Ordnung. */
  function ordnung(o) {
    st.ordnung = o;
    document.querySelectorAll('#mol-ordnung [data-ordnung]').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.ordnung) === o); });
    if (st.auswahl && st.auswahl.art === 'bindung') bindung(st.auswahl.a, st.auswahl.b, o, true);
  }

  // ------------------------------------------------------------ Bearbeiten
  function setzeAtom(el, x, y) {
    if (st.m.atome.length >= M.MAX_ATOME) { toast('Höchstens ' + M.MAX_ATOME + ' Atome auf der Fläche.', 'fehler'); return; }
    merke();
    var a = M.atomHinzu(st.m, el, x, y), angebunden = st.auswahl && st.auswahl.art === 'atom' && M.atomVon(st.m, st.auswahl.id);
    if (angebunden) {
      var r = M.setzeBindung(st.m, st.auswahl.id, a.id, st.ordnung);
      if (!r.ok) {
        // Gewählte Bindungsart ist für diese Atome nicht möglich (z. B. H=…): als Einfachbindung anfügen und sagen, warum
        var grund = r.grund;
        r = M.setzeBindung(st.m, st.auswahl.id, a.id, 1);
        toast(grund + (r.ok ? ' Stattdessen als Einfachbindung angefügt.' : ''), 'fehler');
      }
    } else st.auswahl = { art: 'atom', id: a.id };
    st.ausBeispiel = false;
    geaendert();
  }

  /** Bindung setzen/ändern. behalteAuswahl: Auswahl bleibt auf der Bindung (Ändern der Bindungsart). */
  function bindung(a, b, o, behalteAuswahl) {
    var alt = M.bindungZwischen(st.m, a, b);
    if (alt && alt.ordnung === o) { if (!behalteAuswahl) toast('Diese ' + M.ORDNUNG_NAME[o] + ' gibt es schon.'); return; }
    var probe = M.kopie(st.m), r = M.setzeBindung(probe, a, b, o);
    if (!r.ok) { toast(r.grund, 'fehler'); zeichne(); return; }
    merke(); M.setzeBindung(st.m, a, b, o);
    st.auswahl = behalteAuswahl ? { art: 'bindung', a: a, b: b } : null;
    st.ausBeispiel = false;
    geaendert();
    toast(M.ORDNUNG_NAME[o] + ' zwischen ' + C.element(M.atomVon(st.m, a).el).name + ' und ' + C.element(M.atomVon(st.m, b).el).name + '.', 'ok');
  }

  function loeschen() {
    var a = st.auswahl;
    if (!a) { toast('Wähle zuerst ein Atom oder eine Bindung aus.'); return; }
    merke();
    if (a.art === 'atom') M.atomEntfernen(st.m, a.id); else M.trenne(st.m, a.a, a.b);
    st.auswahl = null; st.ausBeispiel = false; geaendert();
  }

  function molekuelEntfernen() {
    var a = st.auswahl, id = a && (a.art === 'atom' ? a.id : a.a);
    if (!id) { toast('Wähle zuerst ein Atom des Moleküls aus.'); return; }
    merke();
    var n = M.molekuelEntfernen(st.m, id);
    st.auswahl = null; geaendert(); toast('Molekül mit ' + n + ' Atom' + (n === 1 ? '' : 'en') + ' entfernt.');
  }

  function geaendert(ohneSpeichern) {
    if (st.auswahl && st.auswahl.art === 'atom' && !M.atomVon(st.m, st.auswahl.id)) st.auswahl = null;
    if (st.auswahl && st.auswahl.art === 'bindung' && !M.bindungZwischen(st.m, st.auswahl.a, st.auswahl.b)) st.auswahl = null;
    zeichne();
    if (!ohneSpeichern) speichere();
  }

  // ------------------------------------------------------------ Ansicht und Zeiger
  function viewBox() { var v = st.view, w = BASIS.w / v.s, h = BASIS.h / v.s; return [v.cx - w / 2, v.cy - h / 2, w, h]; }
  function punkt(ev) {
    var svgEl = U.$('mol-svg'), pt = svgEl.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var ctm = svgEl.getScreenCTM();
    var p = ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    return { x: p.x, y: p.y, sx: ev.clientX, sy: ev.clientY };
  }
  function zoom(f, um) {
    var v = st.view, s2 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.s * f));
    if (um) { v.cx = um.x - (um.x - v.cx) * v.s / s2; v.cy = um.y - (um.y - v.cy) * v.s / s2; }
    v.s = s2; zeichne(true);
  }
  function einpassen() {
    var at = st.m.atome;
    if (!at.length) { st.view = { s: 1, cx: 0, cy: 0 }; return; }
    var x0 = Math.min.apply(null, at.map(function (a) { return a.x; })), x1 = Math.max.apply(null, at.map(function (a) { return a.x; }));
    var y0 = Math.min.apply(null, at.map(function (a) { return a.y; })), y1 = Math.max.apply(null, at.map(function (a) { return a.y; }));
    var sk = Math.min(BASIS.w / (x1 - x0 + 160), BASIS.h / (y1 - y0 + 160));
    st.view = { s: Math.max(ZOOM_MIN, Math.min(1.4, sk)), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function freierPlatz() {
    var v = st.view, basis = st.auswahl && st.auswahl.art === 'atom' ? M.atomVon(st.m, st.auswahl.id) : null;
    var mx = basis ? basis.x : v.cx, my = basis ? basis.y : v.cy;
    for (var r = basis ? 75 : 0; r < 400; r += 35) for (var w = 0; w < 6.28; w += 0.5) {
      var x = Math.round(mx + r * Math.cos(w)), y = Math.round(my + r * Math.sin(w));
      if (st.m.atome.every(function (a) { return Math.hypot(a.x - x, a.y - y) > 50; })) return { x: x, y: y };
    }
    return { x: mx, y: my };
  }

  function treffer(ev) {
    var t = ev.target.closest && ev.target.closest('[data-atom], [data-bindung]');
    if (!t) return null;
    if (t.dataset.atom) return { art: 'atom', id: Number(t.dataset.atom) };
    var ab = t.dataset.bindung.split('-').map(Number);
    return { art: 'bindung', a: ab[0], b: ab[1] };
  }

  function runter(ev) {
    if (ev.button > 0) return;
    ev.preventDefault();
    var svgEl = U.$('mol-svg');
    try { svgEl.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
    if (document.activeElement !== svgEl) svgEl.focus({ preventScroll: true });   // damit Entf und Pfeiltasten wirken
    var p = punkt(ev);
    st.zeiger[ev.pointerId] = p;
    var ids = Object.keys(st.zeiger);
    if (ids.length === 2) {
      var a = st.zeiger[ids[0]], b = st.zeiger[ids[1]];
      st.geste = { art: 'zoom', d0: Math.max(10, Math.hypot(a.sx - b.sx, a.sy - b.sy)), s0: st.view.s };
      return;
    }
    if (ids.length > 2) return;
    var t = treffer(ev);
    if (t && t.art === 'atom') { var at = M.atomVon(st.m, t.id); st.geste = { art: 'atom', id: t.id, start: p, dx: at.x - p.x, dy: at.y - p.y, bewegt: false }; }
    else if (t) st.geste = { art: 'bindung', ziel: t, start: p };
    else st.geste = { art: 'leer', start: p, cx: st.view.cx, cy: st.view.cy, bewegt: false };
  }

  function bewegen(ev) {
    if (!st.zeiger[ev.pointerId]) return;
    var p = punkt(ev), g = st.geste;
    st.zeiger[ev.pointerId] = p;
    if (!g) return;
    var schwelle = ev.pointerType === 'touch' ? 9 : 4;
    if (g.art === 'zoom') {
      var ids = Object.keys(st.zeiger); if (ids.length < 2) return;
      var a = st.zeiger[ids[0]], b = st.zeiger[ids[1]];
      st.view.s = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, g.s0 * Math.hypot(a.sx - b.sx, a.sy - b.sy) / g.d0));
      zeichne(true); return;
    }
    if (g.art === 'atom') {
      if (!g.bewegt && Math.hypot(p.sx - g.start.sx, p.sy - g.start.sy) < schwelle) return;
      if (!g.bewegt) { merke(); g.bewegt = true; }
      M.verschiebe(st.m, g.id, p.x + g.dx, p.y + g.dy);
      zeichne(true); return;
    }
    if (g.art === 'leer') {
      if (!g.bewegt && Math.hypot(p.sx - g.start.sx, p.sy - g.start.sy) < schwelle) return;
      g.bewegt = true;
      // Verschieben in Bildschirmpixeln → Weltkoordinaten über den aktuellen Maßstab
      var r = U.$('mol-svg').getBoundingClientRect(), f = (BASIS.w / st.view.s) / (r.width || BASIS.w);
      st.view.cx = g.cx - (p.sx - g.start.sx) * f; st.view.cy = g.cy - (p.sy - g.start.sy) * f;
      zeichne(true);
    }
  }

  function hoch(ev) {
    var war = st.zeiger[ev.pointerId];
    delete st.zeiger[ev.pointerId];
    var g = st.geste;
    if (!war || !g) return;
    if (g.art === 'zoom') { if (!Object.keys(st.zeiger).length) st.geste = null; return; }
    st.geste = null;
    if (g.art === 'atom') {
      if (g.bewegt) { geaendert(); return; }
      var aus = st.auswahl;
      if (aus && aus.art === 'atom' && aus.id !== g.id && M.atomVon(st.m, aus.id)) { bindung(aus.id, g.id, st.ordnung); return; }
      st.auswahl = aus && aus.art === 'atom' && aus.id === g.id ? null : { art: 'atom', id: g.id };
      zeichne(); return;
    }
    if (g.art === 'bindung') {
      var z = g.ziel, schon = st.auswahl && st.auswahl.art === 'bindung' && st.auswahl.a === z.a && st.auswahl.b === z.b;
      st.auswahl = schon ? null : z;
      if (!schon) { var x = M.bindungZwischen(st.m, z.a, z.b); if (x) { st.ordnung = x.ordnung; document.querySelectorAll('#mol-ordnung [data-ordnung]').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.ordnung) === x.ordnung); }); } }
      zeichne(); return;
    }
    if (g.art === 'leer' && !g.bewegt) {
      var p = punkt(ev);
      if (st.werkzeug) setzeAtom(st.werkzeug, p.x, p.y);
    }
  }

  function abbrechen(ev) {
    delete st.zeiger[ev.pointerId];
    if (st.geste && st.geste.art === 'atom' && st.geste.bewegt) geaendert();
    st.geste = null;
  }

  function tasten(ev) {
    var a = st.auswahl;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && a) { ev.preventDefault(); loeschen(); return; }
    if (ev.key === 'Escape' && a) { st.auswahl = null; zeichne(); return; }
    var d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[ev.key];
    if (d && a && a.art === 'atom') {
      ev.preventDefault();
      var at = M.atomVon(st.m, a.id);
      merke(); M.verschiebe(st.m, a.id, at.x + d[0], at.y + d[1]); geaendert();
    }
  }

  // Aus der Leiste auf die Fläche ziehen
  function paletteZiehen(ev) {
    var b = ev.target.closest('[data-el]');
    if (!b || (ev.pointerType === 'mouse' && ev.button > 0)) return;
    var start = { x: ev.clientX, y: ev.clientY }, geist = null;
    var bewege = function (e) {
      if (!geist && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
      if (!geist) { geist = document.createElement('span'); geist.className = 'kugel-mini geist el-' + b.dataset.el; geist.textContent = b.dataset.el; document.body.appendChild(geist); }
      geist.style.left = e.clientX + 'px'; geist.style.top = e.clientY + 'px';
    };
    var los = function (e) {
      document.removeEventListener('pointermove', bewege); document.removeEventListener('pointerup', los); document.removeEventListener('pointercancel', los);
      if (!geist) return;
      geist.remove();
      var r = U.$('mol-svg').getBoundingClientRect();
      if (e.type === 'pointerup' && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        werkzeug(b.dataset.el);
        var p = punkt(e); setzeAtom(b.dataset.el, p.x, p.y);
      }
    };
    document.addEventListener('pointermove', bewege); document.addEventListener('pointerup', los); document.addEventListener('pointercancel', los);
  }

  // ------------------------------------------------------------ Darstellung
  function zeichne(nurBild) {
    var svgEl = U.$('mol-svg'), m = st.m;
    svgEl.setAttribute('viewBox', viewBox().map(function (n) { return Math.round(n * 10) / 10; }).join(' '));
    U.leeren(svgEl);
    var vb = viewBox();
    s('rect', { x: vb[0], y: vb[1], width: vb[2], height: vb[3], class: 'mol-flaeche' }, svgEl);
    var analyse = M.analyse(m), markierung = {};
    analyse.forEach(function (t) { t.meldungen.forEach(function (x) { if (x.atom) markierung[x.atom] = x.art; }); });
    m.bindungen.forEach(function (b) {
      var a = M.atomVon(m, b.a), c = M.atomVon(m, b.b), dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      var gew = st.auswahl && st.auswahl.art === 'bindung' && ((st.auswahl.a === b.a && st.auswahl.b === b.b) || (st.auswahl.a === b.b && st.auswahl.b === b.a));
      var g = s('g', { 'data-bindung': b.a + '-' + b.b, class: 'bindung' + (gew ? ' gewaehlt' : '') }, svgEl);
      s('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, class: 'treffer' }, g);
      if (gew) s('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, class: 'markiert' }, g);
      for (var k = 0; k < b.ordnung; k++) {
        var o = (k - (b.ordnung - 1) / 2) * 7;
        s('line', { x1: a.x + nx * o, y1: a.y + ny * o, x2: c.x + nx * o, y2: c.y + ny * o, class: 'strich' }, g);
      }
    });
    m.atome.forEach(function (a) {
      var r = a.el === 'H' ? 15 : 20, gew = st.auswahl && st.auswahl.art === 'atom' && st.auswahl.id === a.id;
      var g = s('g', { 'data-atom': a.id, class: 'mol-atom' + (gew ? ' gewaehlt' : '') }, svgEl);
      s('circle', { cx: a.x, cy: a.y, r: r, class: 'kugel el-' + a.el + (markierung[a.id] === 'fehler' ? ' zu-viel' : markierung[a.id] === 'unklar' ? ' unklar' : '') }, g);
      s('text', { x: a.x, y: a.y + 5, 'text-anchor': 'middle', class: 'mol-sym', text: a.el }, g);
      var frei = D.BAUKASTEN[a.el].bindigkeit - M.bindungsSumme(m, a.id);
      if (frei !== 0) {
        s('circle', { cx: a.x + r * 0.8, cy: a.y - r * 0.8, r: 8, class: frei > 0 ? 'frei-marke' : markierung[a.id] === 'unklar' ? 'unklar-marke' : 'zuviel-marke' }, g);
        s('text', { x: a.x + r * 0.8, y: a.y - r * 0.8 + 4, 'text-anchor': 'middle', class: 'marke-text', text: frei > 0 ? frei : markierung[a.id] === 'unklar' ? '?' : '!' }, g);
      }
    });
    svgEl.setAttribute('aria-label', 'Molecule Builder mit ' + m.atome.length + ' Atomen und ' + m.bindungen.length + ' Bindungen. ' +
      analyse.map(function (t) { return t.formel + ': ' + STATUS[t.status][0] + (t.name ? ' (' + t.name + ')' : ''); }).join('; '));
    knoepfe();
    if (st.dreiD && !nurBild) D3.zeige(m, analyse, st.auswahl);
    if (nurBild) return;

    var opt = m.atome.map(function (a) { return '<option value="' + a.id + '">Atom ' + a.id + ' · ' + esc(C.element(a.el).name) + '</option>'; }).join('');
    var va = U.$('mol-a').value, vb2 = U.$('mol-b').value;
    U.$('mol-a').innerHTML = opt; U.$('mol-b').innerHTML = opt;
    if (va && M.atomVon(m, Number(va))) U.$('mol-a').value = va;
    if (vb2 && M.atomVon(m, Number(vb2))) U.$('mol-b').value = vb2; else if (m.atome[1]) U.$('mol-b').value = m.atome[1].id;

    U.$('mol-analyse').innerHTML = analyse.length ? analyse.map(karte).join('') : '<p class="muted">Noch keine Atome auf der Fläche. Wähle ein Element und tippe auf die Fläche.</p>';
    auswahlPanel();
    if (st.modus === 'lernen') aufgabePanel(true);

    if (!st.ausBeispiel) analyse.forEach(function (t) {
      if (t.molekuelId === 'nh3') root.LK.reach('mol-ammoniak');
      if (t.bekannt && t.bindungsTypen[2] > 0) root.LK.reach('mol-doppel');
    });
  }

  function knoepfe() {
    U.$('mol-rueck').disabled = !st.verlauf.length;
    U.$('mol-vor').disabled = !st.zukunft.length;
    U.$('mol-loeschen').disabled = !st.auswahl;
    U.$('mol-entfernen').disabled = !st.auswahl;
    U.$('mol-leeren').disabled = !st.m.atome.length;
  }

  function karte(t) {
    var stt = STATUS[t.status];
    var typen = [1, 2, 3].filter(function (o) { return t.bindungsTypen[o]; }).map(function (o) { return t.bindungsTypen[o] + ' × ' + M.ORDNUNG_NAME[o]; }).join(', ') || 'keine Bindungen';
    var erklaerung = {
      gueltig: t.bekannt ? 'Alle Bindigkeiten stimmen, und genau diese Struktur ist ein experimentell nachgewiesener Stoff.'
        : 'Alle Bindigkeiten stimmen. Diese Struktur steht aber nicht in der Liste bekannter Stoffe – ob es sie gibt oder ob sie stabil ist, kann das Modell nicht beurteilen.',
      unvollstaendig: 'Die Struktur ist unvollständig: Mindestens ein Atom hat noch freie Bindungsmöglichkeiten.',
      verletzung: 'Die Struktur verletzt die Regeln dieses Modells. So ist es nur eine Zeichnung.',
      unklar: 'Die Struktur kann mit den aktuellen Regeln nicht eindeutig beurteilt werden.',
    }[t.status];
    var geo = t.geometrie.map(function (g) {
      var x = g.geometrie;
      return '<li>Um <b>' + esc(C.element(g.el).name) + '</b>: ' + esc(x.name) + ' (' + x.partner + ' Bindungspartner, ' + (x.freiePaare === 1 ? '1 freies Elektronenpaar' : x.freiePaare + ' freie Elektronenpaare') + ') · Modellwinkel ' +
        (x.winkel ? U.fmt(x.winkel, x.winkel % 1 ? 1 : 0) + '°' : esc(x.hinweis)) + (g.gemessen ? ' · <b>gemessen: ' + U.fmt(g.gemessen, 1) + '°</b>' : '') + '</li>';
    }).join('');
    return '<div class="mol-karte"><div class="row eng"><b class="summenformel">' + esc(t.formel) + '</b><span class="badge ' + stt[1] + '">' + stt[0] + '</span>' +
      (t.bekannt ? '<span class="badge ok">Bekanntes Molekül</span><span>' + esc(t.name) + '</span>' : '') + '</div>' +
      '<p class="small muted">' + t.atomAnzahl + ' Atom' + (t.atomAnzahl === 1 ? '' : 'e') + ' · ' + t.bindungAnzahl + ' Bindung' + (t.bindungAnzahl === 1 ? '' : 'en') + ' (' + typen + ')</p>' +
      '<p class="small">' + erklaerung + '</p>' +
      (t.meldungen.length ? '<ul class="small meldungen-mol">' + t.meldungen.map(function (x) { return '<li class="' + x.art + '">' + esc(x.text) + '</li>'; }).join('') + '</ul>' : '') +
      (geo ? '<ul class="small">' + geo + '</ul>' : '') + '</div>';
  }

  function auswahlPanel() {
    var a = st.auswahl, z = U.$('mol-auswahl');
    if (!a) { z.innerHTML = '<p class="small muted">Tippe ein Atom oder eine Bindung an, um sie auszuwählen.</p>'; return; }
    if (a.art === 'atom') {
      var i = M.atomInfo(st.m, a.id);
      var arten = [1, 2, 3].filter(function (o) { return i.bindungen[o]; }).map(function (o) { return i.bindungen[o] + ' × ' + M.ORDNUNG_NAME[o]; }).join(', ') || 'keine';
      z.innerHTML = '<div class="detail-kopf"><div class="kachel kugel-kachel el-' + i.symbol + '"><span class="z">' + i.z + '</span><b>' + esc(i.symbol) + '</b></div>' +
        '<div><h3>' + esc(i.name) + '</h3><p class="small muted">Atom ' + i.id + '</p></div></div>' +
        '<table class="daten"><tbody>' +
        '<tr><th scope="row">Ordnungszahl</th><td>' + i.z + '</td></tr>' +
        '<tr><th scope="row">Außenelektronen</th><td>' + i.valenzelektronen + '</td></tr>' +
        '<tr><th scope="row">Übliche Bindigkeit</th><td>' + i.bindigkeit + (i.erweitert ? ' <span class="small muted">(in manchen Verbindungen bis ' + i.erweitert + ')</span>' : '') + '</td></tr>' +
        '<tr><th scope="row">Bindungen hier</th><td>' + arten + ' · Summe ' + i.summe + '</td></tr>' +
        '<tr><th scope="row">Noch frei</th><td>' + (i.frei >= 0 ? i.frei : '<span class="warn">' + (-i.frei) + ' zu viel</span>') + '</td></tr>' +
        (i.freiePaare !== null && i.summe > 0 ? '<tr><th scope="row">Freie Elektronenpaare</th><td>' + i.freiePaare + ' <span class="wertart">Modell</span></td></tr>' : '') +
        '</tbody></table>' +
        '<div class="row eng knoepfe"><button type="button" data-aktion="loeschen">Atom löschen</button><button type="button" data-aktion="molekuel">Ganzes Molekül entfernen</button></div>';
      return;
    }
    var b = M.bindungZwischen(st.m, a.a, a.b), x = M.atomVon(st.m, a.a), y = M.atomVon(st.m, a.b), max = M.maxOrdnung(st.m, a.a, a.b);
    z.innerHTML = '<p><b>' + M.ORDNUNG_NAME[b.ordnung] + '</b> zwischen ' + esc(C.element(x.el).name) + ' und ' + esc(C.element(y.el).name) + '</p>' +
      '<p class="small">' + (b.ordnung === 1 ? 'Ein' : b.ordnung === 2 ? 'Zwei' : 'Drei') + ' gemeinsame' + (b.ordnung === 1 ? 's Elektronenpaar' : ' Elektronenpaare') + '.</p>' +
      '<div class="seg" role="group" aria-label="Bindungsart ändern">' + [1, 2, 3].map(function (o) {
        return '<button type="button" data-setze="' + o + '" aria-pressed="' + (o === b.ordnung) + '"' + (o > max ? ' disabled title="Für diese Atome im Modell nicht möglich"' : '') + '>' + ['', '— Einfach', '= Doppel', '≡ Dreifach'][o] + '</button>';
      }).join('') + '</div>' +
      (max < 3 ? '<p class="small muted">' + (max === 1 ? 'Diese Atome bilden im Modell nur Einfachbindungen.' : 'Eine Dreifachbindung ist für diese Atome im Modell nicht vorgesehen.') + '</p>' : '') +
      '<div class="row eng knoepfe"><button type="button" data-aktion="loeschen">Bindung löschen</button></div>';
  }

  function auswahlKlick(ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.setze && st.auswahl && st.auswahl.art === 'bindung') { ordnung(Number(b.dataset.setze)); return; }
    if (b.dataset.aktion === 'loeschen') loeschen();
    if (b.dataset.aktion === 'molekuel') molekuelEntfernen();
  }

  // ------------------------------------------------------------ Lernmodus
  function modus(m) {
    st.modus = m;
    U.$('mol-modus-frei').setAttribute('aria-pressed', m === 'frei');
    U.$('mol-modus-lernen').setAttribute('aria-pressed', m === 'lernen');
    U.$('mol-lernen').hidden = m !== 'lernen';
    if (m === 'lernen' && !st.aufgabe) aufgabeWaehlen((A.liste.filter(function (a) { return !st.erledigt[a.id]; })[0] || A.liste[0]).id);
    else if (m === 'lernen') aufgabePanel();
    fortschritt();
  }

  function fortschritt() {
    var n = A.liste.filter(function (a) { return st.erledigt[a.id]; }).length;
    U.$('mol-fortschritt').textContent = 'Lernaufgaben gelöst: ' + n + ' / ' + A.liste.length;
    U.$('mol-aufgaben').innerHTML = A.liste.map(function (a, i) {
      return '<button type="button" data-aufgabe="' + a.id + '" aria-pressed="' + (st.aufgabe && st.aufgabe.id === a.id) + '" class="' + (st.erledigt[a.id] ? 'geloest' : '') + '" title="' + esc(a.titel) + '">' +
        (st.erledigt[a.id] ? '✓ ' : '') + (i + 1) + '<span class="sr-only"> ' + esc(a.titel) + (st.erledigt[a.id] ? ' (gelöst)' : '') + '</span></button>';
    }).join('');
  }

  function aufgabeWaehlen(id) {
    var a = A.finde(id);
    if (!a) return;
    st.aufgabe = { id: id, tipp: false, rueckmeldung: null };
    merke();
    st.m = a.start ? a.start() : M.neu();
    st.auswahl = null; st.ausBeispiel = true;
    einpassen();
    geaendert();
    fortschritt();
    toast(a.start ? 'Vorgegebene Struktur geladen. Mit ↶ kommst du zu deinem vorherigen Bau zurück.' : 'Fläche geleert für die Aufgabe. Mit ↶ kommst du zu deinem vorherigen Bau zurück.');
  }

  /** Aufgabenfeld. live = nach einer Änderung: Erfolg sofort melden, Misserfolg erst auf „Prüfen“. */
  function aufgabePanel(live) {
    if (!st.aufgabe) return;
    var a = A.finde(st.aufgabe.id), z = st.aufgabe;
    if (live) {
      var r = a.pruefe(st.m);
      if (r.ok) {
        z.rueckmeldung = r;
        if (!st.erledigt[a.id]) { st.erledigt[a.id] = true; speichere(); fortschritt(); }
      } else if (z.rueckmeldung && z.rueckmeldung.ok) z.rueckmeldung = null;
    }
    var rm = z.rueckmeldung;
    var naechste = A.liste.filter(function (x) { return !st.erledigt[x.id] && x.id !== a.id; })[0];
    U.$('mol-aufgabe').innerHTML = '<h3>' + esc(a.titel) + (st.erledigt[a.id] ? ' <span class="badge ok">gelöst</span>' : '') + '</h3>' +
      '<p>' + esc(a.text) + '</p>' +
      '<div class="row eng"><button type="button" class="primary" data-a="pruefen">Prüfen</button>' +
      '<button type="button" data-a="tipp" aria-expanded="' + z.tipp + '">' + (z.tipp ? 'Tipp ausblenden' : 'Tipp zeigen') + '</button>' +
      '<button type="button" data-a="neu">Neu beginnen</button></div>' +
      (z.tipp ? '<p class="small tipp">💡 ' + esc(a.tipp) + '</p>' : '') +
      (rm ? '<div class="status-box ' + (rm.ok ? 'ok' : 'warn') + '"><b>' + (rm.ok ? 'Geschafft!' : 'Noch nicht') + '</b><p class="small">' + esc(rm.text) + '</p>' +
        (rm.ok ? '<p class="small"><b>Erklärung:</b> ' + esc(a.erklaerung) + '</p>' : '') + '</div>' : '') +
      (rm && rm.ok && naechste ? '<div class="row eng knoepfe"><button type="button" data-a="weiter" data-id="' + naechste.id + '">Nächste Aufgabe: ' + esc(naechste.titel) + ' →</button></div>' : '') +
      (rm && rm.ok && !naechste ? '<p class="small"><b>Alle Lernaufgaben gelöst.</b> Probiere im freien Modus eigene Moleküle aus.</p>' : '');
  }

  function aufgabeKlick(ev) {
    var b = ev.target.closest('[data-a]');
    if (!b || !st.aufgabe) return;
    var a = A.finde(st.aufgabe.id);
    if (b.dataset.a === 'pruefen') {
      st.aufgabe.rueckmeldung = a.pruefe(st.m);
      if (st.aufgabe.rueckmeldung.ok && !st.erledigt[a.id]) { st.erledigt[a.id] = true; speichere(); fortschritt(); }
    }
    if (b.dataset.a === 'tipp') st.aufgabe.tipp = !st.aufgabe.tipp;
    if (b.dataset.a === 'neu') { aufgabeWaehlen(a.id); return; }
    if (b.dataset.a === 'weiter') { aufgabeWaehlen(b.dataset.id); return; }
    aufgabePanel();
  }

  U.ansichten.molekuel = {
    init: init,
    zeigen: function () { if (st.dreiD) D3.aktiv(true); },
    verstecken: function () { if (st.dreiD) D3.aktiv(false); },
    uebernehmen: function (d) {
      if (d.symbol && D.BAUKASTEN[d.symbol]) { werkzeug(d.symbol); toast('Werkzeug: ' + C.element(d.symbol).name + '. Tippe auf die Fläche, um ein Atom einzusetzen.'); }
    },
  };
  // Für Tests im Browser (Playwright): Zustand lesen, ohne die Oberfläche zu umgehen
  CL.molekuelAnsicht = { zustand: function () { return st; } };
})(window);
