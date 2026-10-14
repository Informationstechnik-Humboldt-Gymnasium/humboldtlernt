// BioLab · Übersicht, Navigation und Start
// Adressen: #mikroskopie, #viren/zyklus … (Modul/Unterbereich). Auf der Lernseite wird die Adresse
// zusätzlich in der äußeren Seite gespiegelt (/sandbox/biolab#viren), damit Direktlinks funktionieren.
(function (root) {
  'use strict';
  var BL = root.BL, U = BL.ui;
  var REIHE = ['mikroskopie', 'mikroorganismen', 'viren', 'zelle', 'anatomie', 'genetik'];
  var aktiv = null, gestartet = {};

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

  // ---------------------------------------------------------------- Übersichtskacheln
  var kacheln = U.$('kacheln');
  REIHE.forEach(function (id) {
    var m = BL.module[id];
    if (!m) return;
    var a = U.html('a', { class: 'bl-kachel', href: '#' + id }, kacheln);
    a.innerHTML = '<span aria-hidden="true">' + m.icon + '</span><h2>' + U.esc(m.titel) + '</h2><p>' + U.esc(m.kurz) + '</p>' +
      (m.unter ? '<span class="wege">' + m.unter.map(function (u) { return U.esc(u.text); }).join(' · ') + '</span>' : '') +
      '<span class="oeffnen">Untersuchen →</span>';
  });

  // ---------------------------------------------------------------- Umschalten
  function zeige(modul, unter, quelle) {
    if (modul && !BL.module[modul]) { modul = null; unter = null; }
    if (aktiv && aktiv !== modul && BL.module[aktiv].verstecken) BL.module[aktiv].verstecken();
    U.$('uebersicht').hidden = !!modul;
    REIHE.forEach(function (id) { var s = U.$('m-' + id); if (s) s.hidden = id !== modul; });
    U.$('zur-uebersicht').hidden = !modul;
    U.$('pfad-trenner').hidden = !modul;
    U.$('pfad-modul').textContent = modul ? BL.module[modul].titel : '';
    U.$('pfad-biolab').toggleAttribute('aria-current', !modul);
    aktiv = modul;
    if (modul) {
      var m = BL.module[modul];
      if (!gestartet[modul]) { gestartet[modul] = true; m.init(U.$('m-' + modul)); }
      unter = m.zeigen(unter) || unter;
    }
    if (quelle !== 'hash') spiegeln(modul ? modul + (unter ? '/' + unter : '') : '');
    if (quelle === 'klick') root.scrollTo(0, 0);
  }
  /** Module melden Wechsel ihres Unterbereichs, damit Adresse und Rückweg stimmen. */
  BL.unterGewechselt = function (modul, unter) { if (modul === aktiv) spiegeln(modul + (unter ? '/' + unter : '')); };

  function lies(h) { var p = (h || '').replace(/^#/, '').split('/'); return { modul: p[0] || null, unter: p[1] || null }; }

  kacheln.addEventListener('click', function (e) {
    var a = e.target.closest('a.bl-kachel');
    if (!a) return;
    e.preventDefault();
    zeige(a.getAttribute('href').slice(1), null, 'klick');
  });
  U.$('pfad-biolab').addEventListener('click', function (e) { e.preventDefault(); zeige(null, null, 'klick'); });
  U.$('zur-uebersicht').addEventListener('click', function () { zeige(null, null, 'klick'); });
  root.addEventListener('hashchange', function () { var r = lies(location.hash); zeige(r.modul, r.unter, 'hash'); });

  // Start: eigene Adresse, sonst die der äußeren Seite (Direktlink /sandbox/biolab#viren)
  var startHash = location.hash;
  if (!startHash) { var a = aussen(); if (a && !a.testseite) startHash = a.l.hash; }
  var r = lies(startHash);
  zeige(r.modul, r.unter, 'start');
})(window);
