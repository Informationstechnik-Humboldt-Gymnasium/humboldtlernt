// Atom- & Chemielabor · Reiter „Atom“ (Bohr-Modell und Schalenmodell)
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, C = CL.chemie, D = CL.daten;
  var esc = U.esc, s = U.svg;
  var SCHALE = 'KLMNOPQ';
  var st = { z: 6, e: 6, modell: 'bohr', bewegung: false, winkel: 0, lauf: null };

  var HINWEIS = {
    bohr: '<b>Vereinfachtes Modell:</b> Im Bohr-Modell kreisen Elektronen auf festen Bahnen. Richtig daran ist, dass Elektronen nur bestimmte Energien haben. Feste Bahnen gibt es aber nicht – die heutige Beschreibung (Quantenmechanik) kennt nur Aufenthaltswahrscheinlichkeiten. Größen sind nicht maßstäblich: Der Kern ist in Wirklichkeit rund 10 000- bis 100 000-mal kleiner als das Atom.',
    schale: '<b>Schalenmodell:</b> Die Elektronen sind nach Energiestufen (Schalen K, L, M, …) geordnet. Die Kästchen zeigen die Unterschalen s, p, d, f mit je zwei Plätzen pro Kästchen. Die Besetzung folgt den gemessenen Grundzuständen (NIST), nicht nur einer Faustregel – darum hat z. B. Kalium schon Elektronen in der N-Schale, obwohl die M-Schale noch Platz hätte.',
  };

  // Neutronenzahl N = A − Z für das häufigste natürliche Isotop (sonst ein langlebiges Isotop)
  function neutronen(e) { return (e.isotop || e.massenzahlLanglebig) - e.z; }

  function init() {
    U.elementOptionen(U.$('atom-element'));
    U.$('atom-element').addEventListener('change', function () { setze(Number(this.value)); });
    U.$('atom-zurueck').addEventListener('click', function () { setze(Math.max(1, st.z - 1)); });
    U.$('atom-vor').addEventListener('click', function () { setze(Math.min(118, st.z + 1)); });
    U.$('atom-e-minus').addEventListener('click', function () { if (st.e > 0) { st.e--; zeichne(); } });
    U.$('atom-e-plus').addEventListener('click', function () { if (st.e < st.z + 3) { st.e++; zeichne(); } });
    U.$('atom-neutral').addEventListener('click', function () { st.e = st.z; zeichne(); });
    U.$('atom-bohr').addEventListener('click', function () { modell('bohr'); });
    U.$('atom-schale').addEventListener('click', function () { modell('schale'); });
    U.$('atom-bewegung').addEventListener('click', function () { bewegung(!st.bewegung); });
    U.$('atom-svg').addEventListener('click', function (ev) { var t = ev.target.closest('[data-teilchen]'); if (t) teilchen(t.dataset.teilchen); });
    document.querySelectorAll('#atom-teilchen [data-teilchen]').forEach(function (b) { b.addEventListener('click', function () { teilchen(b.dataset.teilchen); }); });
    setze(U.zustand.z || 6);
  }

  function setze(z) { st.z = z; st.e = z; U.zustand.z = z; U.$('atom-element').value = z; zeichne(); }

  function modell(m) {
    st.modell = m;
    U.$('atom-bohr').setAttribute('aria-pressed', m === 'bohr');
    U.$('atom-schale').setAttribute('aria-pressed', m === 'schale');
    U.$('atom-bewegung').hidden = m !== 'bohr';
    if (m !== 'bohr') bewegung(false);
    zeichne();
  }

  function bewegung(an) {
    st.bewegung = an;
    var b = U.$('atom-bewegung');
    b.setAttribute('aria-pressed', an); b.textContent = an ? 'Bewegung aus' : 'Bewegung an';
    if (an && !st.lauf) {
      var t0 = null;
      var f = function (t) {
        if (!st.bewegung) { st.lauf = null; return; }
        if (t0 !== null) st.winkel += (t - t0) / 1000 * 0.6;
        t0 = t;
        document.querySelectorAll('#atom-svg .bahn-e').forEach(function (g) {
          var i = Number(g.dataset.schale);
          g.setAttribute('transform', 'rotate(' + (st.winkel * 57.3 / (i + 1)) + ' 200 200)');
        });
        st.lauf = requestAnimationFrame(f);
      };
      st.lauf = requestAnimationFrame(f);
    }
  }

  function kern(g, p, n) {
    var gesamt = p + n;
    if (gesamt > 90) {
      var R = 34;
      s('circle', { cx: 200, cy: 200, r: R, class: 'kern-blob', 'data-teilchen': 'p' }, g);
      s('text', { x: 200, y: 196, 'text-anchor': 'middle', class: 'kern-text', text: p + ' p⁺' }, g);
      s('text', { x: 200, y: 213, 'text-anchor': 'middle', class: 'kern-text', text: n + ' n' }, g);
      return R;
    }
    // Sonnenblumen-Anordnung; Protonen und Neutronen abwechselnd verteilt
    var r = gesamt > 40 ? 4 : 6, liste = [], ip = 0, inn = 0;
    for (var i = 0; i < gesamt; i++) {
      var nimmP = (ip / p || 0) <= (inn / n || 0) ? ip < p : inn >= n;
      liste.push(nimmP ? 'p' : 'n'); if (nimmP) ip++; else inn++;
    }
    var maxR = 0;
    liste.forEach(function (t, k) {
      var rad = r * 1.05 * Math.sqrt(k), w = k * 2.39996;
      var x = 200 + rad * Math.cos(w), y = 200 + rad * Math.sin(w);
      maxR = Math.max(maxR, rad + r);
      s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r, class: 't-' + t, 'data-teilchen': t }, g);
    });
    return Math.max(maxR, 8);
  }

  function zeichne() {
    var e = C.element(st.z), n = neutronen(e), k = C.konfiguration(st.z, st.e);
    var svgEl = U.$('atom-svg');
    U.leeren(svgEl);
    var g = s('g', {}, svgEl);
    var schalen = k.schalen, anz = schalen.length;
    var gk = s('g', {}, null);
    var rKern = kern(gk, st.z, n);
    var innen = rKern + 22, aussen = 186, abstand = anz ? (aussen - innen) / Math.max(anz, 1) : 0;
    schalen.forEach(function (zahl, i) {
      var R = innen + abstand * (i + 0.5);
      if (st.modell === 'schale') {
        s('circle', { cx: 200, cy: 200, r: R, class: 'schale-band', 'stroke-width': Math.max(6, abstand - 6) }, g);
        s('text', { x: 200, y: 200 - R + 4, 'text-anchor': 'middle', class: 'schale-text', text: SCHALE[i] + ': ' + zahl }, g);
      } else {
        s('circle', { cx: 200, cy: 200, r: R, class: 'bahn' }, g);
      }
      var ge = s('g', { class: 'bahn-e', 'data-schale': i }, g);
      if (st.modell === 'bohr') {
        for (var j = 0; j < zahl; j++) {
          var w = (j / zahl) * Math.PI * 2 + i * 0.4;
          s('circle', { cx: (200 + R * Math.cos(w)).toFixed(1), cy: (200 + R * Math.sin(w)).toFixed(1), r: zahl > 18 ? 3.2 : 4.5, class: 't-e', 'data-teilchen': 'e' }, ge);
        }
      }
    });
    g.appendChild(gk);
    var q = st.z - st.e;
    svgEl.setAttribute('aria-label', (st.modell === 'bohr' ? 'Bohr-Modell' : 'Schalenmodell') + ' von ' + e.name + ': Kern mit ' + st.z + ' Protonen und ' + n +
      ' Neutronen, ' + st.e + ' Elektronen in den Schalen ' + schalen.map(function (x, i) { return SCHALE[i] + ' ' + x; }).join(', ') + '.');

    U.$('atom-modellhinweis').innerHTML = HINWEIS[st.modell] + (st.modell === 'schale' ? kaestchen(k) : '');
    U.$('atom-e-out').textContent = st.e;
    U.$('atom-e-plus').disabled = st.e >= st.z + 3;
    U.$('atom-e-minus').disabled = st.e <= 0;
    var a = C.atom(st.z, n, st.e);
    U.$('atom-readouts').innerHTML =
      U.readout(esc(e.symbol), e.name) +
      U.readout(st.z, 'Protonen = Ordnungszahl') +
      U.readout(n, 'Neutronen (' + (e.isotop ? 'häufigstes Isotop' : 'langlebiges Isotop') + ')') +
      U.readout(st.e, 'Elektronen') +
      U.readout(q === 0 ? '0' : (q > 0 ? '+' : '−') + Math.abs(q), 'Ladung in e') +
      U.readout(a.massenzahl, 'Massenzahl A') +
      U.readout(e.masse !== null ? U.fmt(e.masse, 2) : '–', 'rel. Atommasse Aᵣ') +
      U.readout(esc(k.kurz), 'Konfiguration' + (k.vorhergesagt ? ' (vorhergesagt)' : ''));
    U.$('atom-ion').innerHTML = ionText(e, k, q, a);
    if (st.z === 11 && st.e === 10) root.LK.reach('atom-na-ion');
  }

  function kaestchen(k) {
    var proN = {};
    k.unterschalen.forEach(function (u) { (proN[u.n] = proN[u.n] || []).push(u); });
    return '<span class="kaestchen" aria-label="Kästchenschreibweise der Unterschalen">' + Object.keys(proN).map(function (n) {
      return '<span class="ks-zeile"><span class="ks-name">' + SCHALE[n - 1] + '</span>' + proN[n].map(function (u) {
        var plaetze = u.max / 2, boxen = [];
        for (var b = 0; b < plaetze; b++) {
          var e1 = u.anzahl > b ? 1 : 0, e2 = u.anzahl > plaetze + b ? 1 : 0;   // erst einzeln besetzen (Hund'sche Regel), dann paaren
          boxen.push('<i>' + (e1 ? '↑' : '') + (e2 ? '↓' : '') + '</i>');
        }
        return '<span class="ks-u"><span>' + u.name + '</span>' + boxen.join('') + '</span>';
      }).join('') + '</span>';
    }).join('') + '</span>';
  }

  function ionText(e, k, q, a) {
    var edelgas = [2, 10, 18, 36, 54, 86, 118].filter(function (z) { return z === st.e && C.konfiguration(z).text === k.text; })[0];
    var t;
    if (q === 0) t = '<b>Neutrales Atom:</b> ' + st.z + ' Protonen (+) und ' + st.e + ' Elektronen (−) gleichen sich aus.';
    else if (q > 0) t = '<b>Kation ' + esc(e.symbol) + C.hoch((q > 1 ? q : '') + '+') + ':</b> Das Atom hat ' + q + ' Elektron' + (q > 1 ? 'en' : '') + ' abgegeben. Es bleiben mehr positive Protonen als negative Elektronen übrig – das Ion ist positiv geladen. Der Kern (und damit das Element) bleibt gleich.';
    else t = '<b>Anion ' + esc(e.symbol) + C.hoch((-q > 1 ? -q : '') + '-') + ':</b> Das Atom hat ' + (-q) + ' Elektron' + (q < -1 ? 'en' : '') + ' aufgenommen und ist jetzt negativ geladen. Der Kern bleibt gleich.';
    if (edelgas && q !== 0) t += ' Es hat jetzt dieselbe Elektronenkonfiguration wie das Edelgas <b>' + esc(C.element(edelgas).name) + '</b> (Edelgaskonfiguration) – solche Ionen sind besonders häufig.';
    if (q > 3) t += ' <span class="hinweis">So hoch geladene Ionen entstehen nur unter extremen Bedingungen, z. B. in sehr heißem Plasma.</span>';
    if (q < -1 && !edelgas) t += ' <span class="hinweis">Mehrfach negativ geladene Einzelatome ohne Edelgaskonfiguration sind nicht beständig.</span>';
    if (st.e === 0) t += ' Ohne Elektronen bleibt nur der nackte Atomkern übrig.';
    void a;
    return t;
  }

  function teilchen(t) {
    var d = D.TEILCHEN[t];
    U.$('atom-teilchen-text').innerHTML = '<p class="small"><b>' + d.name + '</b> · Ort: ' + d.ort +
      ' · Ladung: ' + (d.ladung > 0 ? '+1 e' : d.ladung < 0 ? '−1 e' : '0 (ungeladen)') +
      ' · Masse: ' + U.fmt(d.masse, t === 'e' ? 6 : 4) + ' u' +
      (t === 'e' ? ' (rund 1/1836 eines Protons)' : '') + '<br><span class="muted">e = 1,602 · 10⁻¹⁹ C (Elementarladung), u = atomare Masseneinheit. Quelle: CODATA 2018.</span></p>';
  }

  U.ansichten.atom = {
    init: init,
    zeigen: function () { if (U.zustand.z && U.zustand.z !== st.z) setze(U.zustand.z); },
    verstecken: function () { bewegung(false); },
    uebernehmen: function (d) { if (d.z) setze(d.z); },
  };
})(window);
