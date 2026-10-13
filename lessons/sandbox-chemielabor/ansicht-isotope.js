// Atom- & Chemielabor · Reiter „Isotope“ (Atom selbst zusammenbauen)
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, C = CL.chemie, D = CL.daten;
  var esc = U.esc, s = U.svg;
  var st = { p: 6, n: 6, e: 6 };
  var GRENZE = { p: 118, n: 180 };

  function init() {
    document.querySelectorAll('#p-isotope [data-aendern]').forEach(function (b) {
      b.addEventListener('click', function () { aendere(b.dataset.aendern, Number(b.dataset.um)); });
    });
    U.$('iso-bekannte').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-a]');
      if (b) { st.n = Number(b.dataset.a) - st.p; zeichne(); }
    });
    document.querySelectorAll('#p-isotope [data-ziehen]').forEach(function (chip) { chip.addEventListener('pointerdown', ziehen); });
    zeichne();
  }

  function aendere(t, um, ausZiehen) {
    var alt = st[t];
    if (t === 'e') st.e = Math.max(0, Math.min(st.p + 3, st.e + um));
    else st[t] = Math.max(0, Math.min(GRENZE[t], st[t] + um));
    if (t === 'p' && st.e > st.p + 3) st.e = st.p + 3;
    if (alt === st[t] && ausZiehen) meldung(t === 'e' ? 'Mehr Elektronen passen hier nicht: Ein Atom nimmt nur wenige zusätzliche Elektronen auf.' : 'Grenze des Labors erreicht.');
    zeichne();
  }

  function meldung(t) { var m = U.$('iso-status'); m.innerHTML = '<p class="status-box warn">' + esc(t) + '</p>'; }

  // Ziehen aus der Leiste: Kopie folgt dem Zeiger; Loslassen über dem Atom fügt das Teilchen hinzu.
  function ziehen(ev) {
    ev.preventDefault();
    var chip = ev.currentTarget, typ = chip.dataset.ziehen, geist = chip.cloneNode(true);
    geist.classList.add('geist'); document.body.appendChild(geist);
    var bewege = function (e) { geist.style.left = e.clientX + 'px'; geist.style.top = e.clientY + 'px'; };
    bewege(ev);
    var los = function (e) {
      document.removeEventListener('pointermove', bewege); document.removeEventListener('pointerup', los); document.removeEventListener('pointercancel', los);
      geist.remove();
      var r = U.$('iso-svg').getBoundingClientRect();
      if (e.type === 'pointerup' && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) aendere(typ, 1, true);
    };
    document.addEventListener('pointermove', bewege); document.addEventListener('pointerup', los); document.addEventListener('pointercancel', los);
  }

  function kern(g, p, n) {
    var gesamt = p + n;
    if (!gesamt) { s('text', { x: 200, y: 185, 'text-anchor': 'middle', class: 'val', text: 'kein Kern' }, g); return 10; }
    if (gesamt > 120) {
      s('circle', { cx: 200, cy: 180, r: 40, class: 'kern-blob' }, g);
      s('text', { x: 200, y: 176, 'text-anchor': 'middle', class: 'kern-text', text: p + ' p⁺' }, g);
      s('text', { x: 200, y: 194, 'text-anchor': 'middle', class: 'kern-text', text: n + ' n' }, g);
      return 40;
    }
    var r = gesamt > 50 ? 4.5 : 7, ip = 0, inn = 0, maxR = 0;
    for (var k = 0; k < gesamt; k++) {
      var nimmP = (ip / p || 0) <= (inn / n || 0) ? ip < p : inn >= n;
      if (nimmP) ip++; else inn++;
      var rad = r * 1.05 * Math.sqrt(k), w = k * 2.39996;
      maxR = Math.max(maxR, rad + r);
      s('circle', { cx: (200 + rad * Math.cos(w)).toFixed(1), cy: (180 + rad * Math.sin(w)).toFixed(1), r: r, class: nimmP ? 't-p' : 't-n' }, g);
    }
    return maxR;
  }

  function zeichne() {
    var svgEl = U.$('iso-svg');
    U.leeren(svgEl);
    var g = s('g', {}, svgEl), gk = s('g', {});
    var rK = kern(gk, st.p, st.n);
    var schalen = st.p >= 1 && st.p <= 118 ? C.konfiguration(st.p, st.e).schalen : (st.e ? [st.e] : []);
    var innen = rK + 18, aussen = 170, ab = schalen.length ? (aussen - innen) / schalen.length : 0;
    schalen.forEach(function (zahl, i) {
      var R = innen + ab * (i + 0.5);
      s('circle', { cx: 200, cy: 180, r: R, class: 'bahn' }, g);
      for (var j = 0; j < zahl; j++) {
        var w = j / zahl * Math.PI * 2 - Math.PI / 2;
        s('circle', { cx: (200 + R * Math.cos(w)).toFixed(1), cy: (180 + R * Math.sin(w)).toFixed(1), r: zahl > 18 ? 3 : 4.5, class: 't-e' }, g);
      }
    });
    g.appendChild(gk);
    svgEl.setAttribute('aria-label', 'Gebautes Atom mit ' + st.p + ' Protonen, ' + st.n + ' Neutronen und ' + st.e + ' Elektronen.');

    ['p', 'n', 'e'].forEach(function (t) { U.$('iso-' + t).textContent = st[t]; });
    document.querySelectorAll('#p-isotope [data-aendern]').forEach(function (b) {
      var t = b.dataset.aendern, um = Number(b.dataset.um);
      b.disabled = um < 0 ? st[t] <= 0 : (t === 'e' ? st.e >= st.p + 3 : st[t] >= GRENZE[t]);
    });

    var a = C.atom(st.p, st.n, st.e), el = a.element, q = a.ladung;
    var qText = q === 0 ? '' : C.hoch((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-'));
    U.$('iso-schreibweise').innerHTML = el
      ? '<div class="nuklidzeichen" aria-label="' + esc(el.name + '-' + a.massenzahl + ', Ladung ' + q) + '"><span class="az"><sup>' + a.massenzahl + '</sup><sub>' + st.p + '</sub></span><b>' + esc(el.symbol) + '</b><span class="q">' + qText + '</span></div>' +
        '<p><b>' + esc(el.name) + '-' + a.massenzahl + '</b> · ' + esc(a.art) + '</p>'
      : '<p><b>Kein Element</b> – ' + (st.p === 0 ? 'ohne Protonen gibt es kein Element.' : 'mit ' + st.p + ' Protonen ist kein Element bekannt.') + '</p>';
    U.$('iso-readouts').innerHTML =
      U.readout(st.p, 'Ordnungszahl Z') + U.readout(a.massenzahl, 'Massenzahl A = Z + N') + U.readout(st.n, 'Neutronenzahl N') +
      U.readout(q === 0 ? '0' : (q > 0 ? '+' : '−') + Math.abs(q), 'Ladung (p − e)') +
      U.readout(st.p ? U.fmt(st.n / st.p, 2) : '–', 'Verhältnis N : Z');

    var nk = C.nuklid(st.p, st.n), klasse = { stabil: 'ok', radioaktiv: 'warn', natuerlich: 'info', 'keine-daten': 'unbekannt', 'kein-kern': 'unbekannt' }[nk.status];
    var titel = { stabil: 'Stabiler Kern', radioaktiv: 'Radioaktiver Kern', natuerlich: 'Natürliches Isotop', 'keine-daten': 'Keine Daten im Labor', 'kein-kern': 'Kein Atomkern' }[nk.status];
    U.$('iso-status').innerHTML = '<div class="status-box ' + klasse + '"><b>' + titel + '</b><p class="small">' + esc(nk.hinweis) + '</p></div>';

    var liste = el ? C.nuklideVon(st.p) : null;
    U.$('iso-bekannte').innerHTML = el ? (liste
      ? '<p class="small"><b>Im Labor hinterlegte Nuklide von ' + esc(el.name) + '</b> (antippen zum Bauen):</p><div class="row eng">' + liste.map(function (x) {
        return '<button type="button" class="nuk ' + x.status + (x.a === a.massenzahl ? ' aktiv' : '') + '" data-a="' + x.a + '" aria-pressed="' + (x.a === a.massenzahl) + '">' + esc(el.symbol) + '-' + x.a +
          (x.status === 'stabil' ? ' · stabil' : x.halbwertszeit ? ' · T½ = ' + C.zahlText(x.halbwertszeit.wert) + ' ' + D.EINHEIT_ZEIT[x.halbwertszeit.einheit] : ' · radioaktiv') + '</button>';
      }).join('') + '</div><p class="small muted">Quelle: IAEA/ENSDF. Die Liste enthält alle stabilen, aber nur ausgewählte radioaktive Nuklide.</p>'
      : '<p class="small muted">Für ' + esc(el.name) + ' sind im Labor keine Nuklidlisten hinterlegt (Datensatz: Z = 1–20 und einige Beispiele).</p>') : '';

    if (st.p === 6 && st.n === 8 && st.e === 6) root.LK.reach('iso-c14');
    if (st.p === 9 && st.e === 10) root.LK.reach('iso-anion');
  }

  U.ansichten.isotope = {
    init: init,
    uebernehmen: function (d) {
      var el = d.z && C.element(d.z);
      if (!el) return;
      st.p = el.z; st.e = el.z; st.n = Math.min(GRENZE.n, (el.isotop || el.massenzahlLanglebig) - el.z);
      zeichne();
    },
  };
})(window);
