// Physik-Labor · Übersicht, Suche/Filter, Navigation und Start
// Adressen: #fall, #wurf, #reibung, #feder, #optik (bei der Optik auch #optik/spiegel …). Auf der Lernseite wird die
// Adresse zusätzlich in der äußeren Seite gespiegelt (/sandbox/physiklabor#wurf), damit Direktlinks funktionieren.
(function (root) {
  'use strict';
  var PL = root.PL, U = PL.ui, K = PL.katalog;
  var aktiv = null, gestartet = {}, filter = { suche: '', bereich: '' };

  // ---------------------------------------------------------------- äußere Seite (nur Lernseite, nicht Testseite)
  function aussen() {
    try {
      if (root.parent === root) return null;
      var l = root.parent.location;
      if (/^#\//.test(l.hash)) return { testseite: true, l: l };   // Testseite routet selbst über #/…
      return { testseite: false, l: l };
    } catch (e) { return null; }
  }
  function spiegeln(h) {
    try { history.replaceState(null, '', h ? '#' + h : location.pathname); } catch (e) { /* ignorieren */ }
    var a = aussen();
    if (a && !a.testseite) {
      try { root.parent.history.replaceState(null, '', a.l.pathname + (h ? '#' + h : '')); } catch (e) { /* ignorieren */ }
    }
  }
  (function pfadSandbox() {
    var a = aussen(), link = U.$('pfad-sandbox');
    if (!a) { link.href = '../../sandbox'; link.removeAttribute('target'); return; }
    link.href = a.testseite ? a.l.pathname + '#/sandbox' : '/sandbox';
    // Die eingebettete Seite darf das Hauptfenster nicht selbst umleiten (iframe-sandbox).
    // Deshalb den Rückweg-Link der äußeren Seite auslösen; fehlt er, bleibt „Sandbox“ reiner Text.
    var zurueck = null;
    try { zurueck = root.parent.document.querySelector('.lesson-bar a.back'); } catch (e) { /* fremde Seite */ }
    if (!zurueck) { var span = document.createElement('span'); span.textContent = link.textContent; link.replaceWith(span); return; }
    link.removeAttribute('target');
    link.addEventListener('click', function (e) { e.preventDefault(); zurueck.click(); });
  })();

  // ---------------------------------------------------------------- Übersicht mit Suche und Filter
  var kacheln = U.$('kacheln'), leer = U.$('keine-treffer'), anzahl = U.$('treffer');
  function zeigeKacheln() {
    var liste = K.filtere(filter.suche, filter.bereich);
    U.leeren(kacheln);
    liste.forEach(function (s) {
      var m = PL.module[s.id];
      if (!m) return;
      var a = U.html('a', { class: 'pl-kachel', href: '#' + s.id }, kacheln);
      a.innerHTML = '<span class="pl-kachel-icon" aria-hidden="true">' + m.icon + '</span>' +
        '<span class="pl-tag">' + U.esc(K.bereichText(s.bereich)) + '</span>' +
        '<h2>' + U.esc(s.titel) + '</h2><p>' + U.esc(s.kurz) + '</p>' +
        '<span class="pl-bezug small">' + U.esc(s.bezug) + '</span>' +
        '<span class="oeffnen">Simulation öffnen →</span>';
    });
    leer.hidden = liste.length > 0;
    anzahl.textContent = liste.length === K.SIMULATIONEN.length ? K.SIMULATIONEN.length + ' Simulationen' : liste.length + ' von ' + K.SIMULATIONEN.length + ' Simulationen';
  }
  U.seg(U.$('filter-bereich'), [{ wert: '', text: 'Alle' }].concat(K.BEREICHE.map(function (b) { return { wert: b.id, text: b.text }; })), '',
    function (w) { filter.bereich = w; zeigeKacheln(); }, 'Themengebiet');
  U.$('suche').addEventListener('input', function (e) { filter.suche = e.target.value; zeigeKacheln(); });
  U.$('filter-zuruecksetzen').addEventListener('click', function () {
    filter = { suche: '', bereich: '' }; U.$('suche').value = ''; U.segSetze(U.$('filter-bereich'), ''); zeigeKacheln(); U.$('suche').focus();
  });
  zeigeKacheln();

  // ---------------------------------------------------------------- Umschalten
  function zeige(modul, unter, quelle) {
    if (modul && !PL.module[modul]) { modul = null; unter = null; }
    if (aktiv && aktiv !== modul && PL.module[aktiv].verstecken) PL.module[aktiv].verstecken();
    if (!modul) PL.takt.aus();                         // in der Übersicht läuft keine Animation
    U.$('uebersicht').hidden = !!modul;
    K.SIMULATIONEN.forEach(function (s) { var e = U.$('m-' + s.id); if (e) e.hidden = s.id !== modul; });
    U.$('zur-uebersicht').hidden = !modul;
    U.$('pfad-trenner').hidden = !modul;
    U.$('pfad-modul').textContent = modul ? PL.module[modul].titel : '';
    U.$('pfad-labor').toggleAttribute('aria-current', !modul);
    aktiv = modul;
    if (modul) {
      var m = PL.module[modul];
      if (!gestartet[modul]) { gestartet[modul] = true; m.init(U.$('m-' + modul)); }
      unter = (m.zeigen && m.zeigen(unter)) || unter;
    }
    if (quelle !== 'hash') spiegeln(modul ? modul + (unter ? '/' + unter : '') : '');
    if (quelle === 'klick') root.scrollTo(0, 0);
  }
  /** Module melden Wechsel ihres Unterbereichs, damit Adresse und Rückweg stimmen. */
  PL.unterGewechselt = function (modul, unter) { if (modul === aktiv) spiegeln(modul + (unter ? '/' + unter : '')); };
  PL.aktiv = function () { return aktiv; };

  function lies(h) { var p = (h || '').replace(/^#/, '').split('/'); return { modul: p[0] || null, unter: p[1] || null }; }

  kacheln.addEventListener('click', function (e) {
    var a = e.target.closest('a.pl-kachel');
    if (!a) return;
    e.preventDefault();
    zeige(a.getAttribute('href').slice(1), null, 'klick');
  });
  U.$('pfad-labor').addEventListener('click', function (e) { e.preventDefault(); zeige(null, null, 'klick'); });
  U.$('zur-uebersicht').addEventListener('click', function () { zeige(null, null, 'klick'); });
  root.addEventListener('hashchange', function () { var r = lies(location.hash); zeige(r.modul, r.unter, 'hash'); });
  // Im Hintergrund (anderer Tab) pausieren alle Simulationen
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && aktiv && PL.module[aktiv].verstecken) PL.module[aktiv].verstecken();
  });

  // Start: eigene Adresse, sonst die der äußeren Seite (Direktlink /sandbox/physiklabor#wurf)
  var startHash = location.hash;
  if (!startHash) { var a = aussen(); if (a && !a.testseite) startHash = a.l.hash; }
  var r = lies(startHash);
  zeige(r.modul, r.unter, 'start');
})(window);
