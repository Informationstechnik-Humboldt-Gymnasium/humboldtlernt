// Atom- & Chemielabor · Reiter „Moleküle“ (Molekülbaukasten)
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, C = CL.chemie, M = CL.molekuel, D = CL.daten;
  var esc = U.esc, s = U.svg;
  var st = { m: M.neu(), werkzeug: 'C', auswahl: null, ausBeispiel: false, zug: null };
  var STATUS = {
    zeichnung: ['Strukturzeichnung', 'warn', 'Die Bindigkeiten stimmen noch nicht. So ist es nur eine Zeichnung, kein mögliches Molekül.'],
    plausibel: ['Plausible Struktur', 'info', 'Alle Bindigkeiten stimmen. Ob es diesen Stoff wirklich gibt, kann das Labor nicht sagen – er steht nicht in der Liste nachgewiesener Moleküle.'],
    bekannt: ['Bekanntes Molekül', 'ok', 'Alle Bindigkeiten stimmen, und der Stoff ist experimentell nachgewiesen.'],
  };

  function init() {
    var pal = U.$('mol-palette');
    pal.innerHTML = Object.keys(D.BAUKASTEN).map(function (el) {
      return '<button type="button" class="mol-el el-' + el + '" data-el="' + el + '" aria-pressed="' + (el === st.werkzeug) + '" title="' + esc(C.element(el).name) + ' (Bindigkeit ' + D.BAUKASTEN[el].bindigkeit + ')">' + el + '<small>' + D.BAUKASTEN[el].bindigkeit + '</small></button>';
    }).join('');
    pal.addEventListener('pointerdown', paletteZiehen);
    pal.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-el]');
      if (!b) return;
      werkzeug(b.dataset.el);
      if (ev.detail === 0) { var p = freierPlatz(); setzeAtom(b.dataset.el, p.x, p.y); }   // per Tastatur: Atom gleich einsetzen
    });
    var bsp = U.$('mol-beispiel');
    D.MOLEKUELE.forEach(function (x) { bsp.insertAdjacentHTML('beforeend', '<option value="' + x.id + '">' + esc(x.name) + '</option>'); });
    bsp.addEventListener('change', function () { if (this.value) { st.m = M.beispiel(this.value); st.ausBeispiel = true; st.auswahl = null; this.value = ''; zeichne(); } });
    U.$('mol-leeren').addEventListener('click', function () { st.m = M.neu(); st.auswahl = null; st.ausBeispiel = false; zeichne(); });
    U.$('mol-loeschen').addEventListener('click', loeschen);
    U.$('mol-binden').addEventListener('click', function () {
      var a = Number(U.$('mol-a').value), b = Number(U.$('mol-b').value);
      if (a && b && a !== b) { M.verbinde(st.m, a, b); geaendert(); }
    });
    var svgEl = U.$('mol-svg');
    svgEl.setAttribute('tabindex', '0');
    svgEl.addEventListener('pointerdown', unten);
    svgEl.addEventListener('keydown', function (ev) { if ((ev.key === 'Delete' || ev.key === 'Backspace') && st.auswahl) { ev.preventDefault(); loeschen(); } });
    st.m = M.beispiel('h2o'); st.ausBeispiel = true;
    zeichne();
  }

  function werkzeug(el) {
    st.werkzeug = el;
    document.querySelectorAll('#mol-palette [data-el]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.el === el); });
  }

  function punkt(ev) {
    var svgEl = U.$('mol-svg'), pt = svgEl.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var p = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    return { x: Math.max(-280, Math.min(280, p.x)), y: Math.max(-170, Math.min(170, p.y)) };
  }

  function freierPlatz() {
    for (var r = 0; r < 260; r += 30) for (var w = 0; w < 6.28; w += 0.7) {
      var x = Math.round(r * Math.cos(w)), y = Math.round(r * Math.sin(w) * 0.6);
      if (st.m.atome.every(function (a) { return Math.hypot(a.x - x, a.y - y) > 55; })) return { x: x, y: y };
    }
    return { x: 0, y: 0 };
  }

  function setzeAtom(el, x, y) {
    if (st.m.atome.length >= 30) { hinweis('Höchstens 30 Atome auf der Fläche.'); return; }
    var a = M.atomHinzu(st.m, el, x, y);
    // Ist ein Atom ausgewählt, wird das neue Atom gleich daran gebunden (die Auswahl bleibt, so lassen sich schnell mehrere Partner anhängen).
    if (st.auswahl && M.atomVon(st.m, st.auswahl)) M.verbinde(st.m, st.auswahl, a.id);
    else st.auswahl = a.id;
    geaendert();
  }

  function hinweis(t) { U.$('mol-hilfe').textContent = t; }

  function loeschen() {
    if (!st.auswahl) return;
    M.atomEntfernen(st.m, st.auswahl); st.auswahl = null; geaendert();
  }

  function geaendert() { st.ausBeispiel = false; zeichne(); }

  function unten(ev) {
    if (ev.button > 0) return;
    var ziel = ev.target.closest('[data-atom], [data-bindung]'), p = punkt(ev);
    if (ziel && ziel.dataset.bindung) {
      var ab = ziel.dataset.bindung.split('-').map(Number);
      M.verbinde(st.m, ab[0], ab[1]); geaendert(); return;
    }
    if (!ziel) {
      if (st.werkzeug) setzeAtom(st.werkzeug, Math.round(p.x), Math.round(p.y));
      return;
    }
    ev.preventDefault();
    var id = Number(ziel.dataset.atom), a = M.atomVon(st.m, id), svgEl = U.$('mol-svg');
    st.zug = { id: id, dx: a.x - p.x, dy: a.y - p.y, start: p, bewegt: false };
    svgEl.setPointerCapture(ev.pointerId);
    var bewege = function (e) {
      var q = punkt(e);
      if (!st.zug.bewegt && Math.hypot(q.x - st.zug.start.x, q.y - st.zug.start.y) < 6) return;
      st.zug.bewegt = true; a.x = Math.round(q.x + st.zug.dx); a.y = Math.round(q.y + st.zug.dy); zeichne(true);
    };
    var hoch = function () {
      svgEl.removeEventListener('pointermove', bewege); svgEl.removeEventListener('pointerup', hoch); svgEl.removeEventListener('pointercancel', hoch);
      var z = st.zug; st.zug = null;
      if (z.bewegt) { zeichne(); return; }
      if (st.auswahl === null || !M.atomVon(st.m, st.auswahl)) st.auswahl = id;
      else if (st.auswahl === id) st.auswahl = null;
      else { M.verbinde(st.m, st.auswahl, id); st.auswahl = null; geaendert(); return; }
      zeichne();
    };
    svgEl.addEventListener('pointermove', bewege); svgEl.addEventListener('pointerup', hoch); svgEl.addEventListener('pointercancel', hoch);
  }

  // Aus der Leiste auf die Fläche ziehen
  function paletteZiehen(ev) {
    var b = ev.target.closest('[data-el]');
    if (!b || ev.pointerType === 'mouse' && ev.button > 0) return;
    var start = { x: ev.clientX, y: ev.clientY }, geist = null;
    var bewege = function (e) {
      if (!geist && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
      if (!geist) { geist = b.cloneNode(true); geist.classList.add('geist'); document.body.appendChild(geist); }
      geist.style.left = e.clientX + 'px'; geist.style.top = e.clientY + 'px';
    };
    var los = function (e) {
      document.removeEventListener('pointermove', bewege); document.removeEventListener('pointerup', los); document.removeEventListener('pointercancel', los);
      if (!geist) return;
      geist.remove();
      var r = U.$('mol-svg').getBoundingClientRect();
      if (e.type === 'pointerup' && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        werkzeug(b.dataset.el);
        var p = punkt(e); setzeAtom(b.dataset.el, Math.round(p.x), Math.round(p.y));
      }
    };
    document.addEventListener('pointermove', bewege); document.addEventListener('pointerup', los); document.addEventListener('pointercancel', los);
  }

  function zeichne(nurBild) {
    var svgEl = U.$('mol-svg'), m = st.m;
    U.leeren(svgEl);
    s('rect', { x: -300, y: -190, width: 600, height: 380, class: 'mol-flaeche' }, svgEl);
    var analyse = M.analyse(m), fehlerAtome = {};
    analyse.forEach(function (t) { t.meldungen.forEach(function (x) { if (x.atom) fehlerAtome[x.atom] = x.art; }); });
    m.bindungen.forEach(function (b) {
      var a = M.atomVon(m, b.a), c = M.atomVon(m, b.b), dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      var g = s('g', { 'data-bindung': b.a + '-' + b.b, class: 'bindung' }, svgEl);
      s('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, class: 'treffer' }, g);
      for (var k = 0; k < b.ordnung; k++) {
        var o = (k - (b.ordnung - 1) / 2) * 7;
        s('line', { x1: a.x + nx * o, y1: a.y + ny * o, x2: c.x + nx * o, y2: c.y + ny * o, class: 'strich' }, g);
      }
    });
    m.atome.forEach(function (a) {
      var r = a.el === 'H' ? 15 : 20, g = s('g', { 'data-atom': a.id, class: 'mol-atom' + (st.auswahl === a.id ? ' gewaehlt' : '') }, svgEl);
      s('circle', { cx: a.x, cy: a.y, r: r, class: 'kugel el-' + a.el + (fehlerAtome[a.id] === 'fehler' ? ' zu-viel' : '') }, g);
      s('text', { x: a.x, y: a.y + 5, 'text-anchor': 'middle', class: 'mol-sym', text: a.el }, g);
      var frei = D.BAUKASTEN[a.el].bindigkeit - M.bindungsSumme(m, a.id);
      if (frei !== 0) {
        s('circle', { cx: a.x + r * 0.8, cy: a.y - r * 0.8, r: 8, class: frei > 0 ? 'frei-marke' : 'zuviel-marke' }, g);
        s('text', { x: a.x + r * 0.8, y: a.y - r * 0.8 + 4, 'text-anchor': 'middle', class: 'marke-text', text: frei > 0 ? frei : '!' }, g);
      }
    });
    svgEl.setAttribute('aria-label', 'Molekülbaukasten mit ' + m.atome.length + ' Atomen und ' + m.bindungen.length + ' Bindungen. ' +
      analyse.map(function (t) { return t.formel + ': ' + STATUS[t.status][0] + (t.name ? ' (' + t.name + ')' : ''); }).join('; '));
    U.$('mol-loeschen').disabled = !st.auswahl;
    if (nurBild) return;

    var opt = m.atome.map(function (a) { return '<option value="' + a.id + '">Atom ' + a.id + ' · ' + esc(C.element(a.el).name) + '</option>'; }).join('');
    var va = U.$('mol-a').value, vb = U.$('mol-b').value;
    U.$('mol-a').innerHTML = opt; U.$('mol-b').innerHTML = opt;
    if (va) U.$('mol-a').value = va;
    if (vb) U.$('mol-b').value = vb; else if (m.atome[1]) U.$('mol-b').value = m.atome[1].id;

    U.$('mol-analyse').innerHTML = analyse.length ? analyse.map(karte).join('') : '<p class="muted">Noch keine Atome auf der Fläche.</p>';

    if (!st.ausBeispiel) analyse.forEach(function (t) {
      if (t.molekuelId === 'nh3') root.LK.reach('mol-ammoniak');
      if (t.status === 'bekannt' && m.bindungen.some(function (b) { return b.ordnung === 2 && t.atome.indexOf(b.a) >= 0; })) root.LK.reach('mol-doppel');
    });
  }

  function karte(t) {
    var stt = STATUS[t.status];
    var geo = t.geometrie.map(function (g) {
      var x = g.geometrie;
      return '<li>Um <b>' + esc(C.element(g.el).name) + '</b>: ' + esc(x.name) + ' (' + x.partner + ' Bindungspartner, ' + (x.freiePaare === 1 ? '1 freies Elektronenpaar' : x.freiePaare + ' freie Elektronenpaare') + ') · Modellwinkel ' +
        (x.winkel ? U.fmt(x.winkel, x.winkel % 1 ? 1 : 0) + '°' : esc(x.hinweis)) + (g.gemessen ? ' · <b>gemessen: ' + U.fmt(g.gemessen, 1) + '°</b>' : '') + '</li>';
    }).join('');
    return '<div class="mol-karte"><div class="row eng"><b class="summenformel">' + esc(t.formel) + '</b><span class="badge ' + stt[1] + '">' + stt[0] + '</span>' +
      (t.name ? '<span>' + esc(t.name) + '</span>' : '') + '</div>' +
      '<p class="small">' + stt[2] + '</p>' +
      (t.meldungen.length ? '<ul class="small meldungen">' + t.meldungen.map(function (x) { return '<li class="' + x.art + '">' + esc(x.text) + '</li>'; }).join('') + '</ul>' : '') +
      (geo ? '<ul class="small">' + geo + '</ul>' : '') + '</div>';
  }

  U.ansichten.molekuel = {
    init: init,
    uebernehmen: function (d) { if (d.symbol && D.BAUKASTEN[d.symbol]) { werkzeug(d.symbol); hinweis('Werkzeug: ' + C.element(d.symbol).name + '. Tippe auf die Fläche, um ein Atom einzusetzen.'); } },
  };
})(window);
