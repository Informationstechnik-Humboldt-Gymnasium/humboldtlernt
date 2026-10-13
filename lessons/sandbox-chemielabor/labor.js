// Atom- & Chemielabor · Reiter-Steuerung und Start
// Jede Ansicht meldet sich in CL.ui.ansichten an: { init(), zeigen(), verstecken() }.
// Andere Reiter öffnen: CL.ui.melde('oeffne', { reiter: 'atom', z: 11 }).
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui;
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab]'));
  var aktiv = null, gestartet = {};

  function name(tab) { return tab.id.replace(/^tab-/, ''); }

  function zeige(reiter, fokus) {
    var tab = U.$('tab-' + reiter);
    if (!tab) return;
    tabs.forEach(function (t) {
      var an = t === tab;
      t.setAttribute('aria-selected', an ? 'true' : 'false');
      t.tabIndex = an ? 0 : -1;
      U.$(t.getAttribute('aria-controls')).hidden = !an;
    });
    if (aktiv && aktiv !== reiter && U.ansichten[aktiv] && U.ansichten[aktiv].verstecken) U.ansichten[aktiv].verstecken();
    aktiv = reiter;
    var a = U.ansichten[reiter];
    if (a && !gestartet[reiter]) { gestartet[reiter] = true; a.init(); }
    if (a && a.zeigen) a.zeigen();
    if (fokus) tab.focus();
    try { history.replaceState(null, '', '#' + reiter); } catch (e) { /* in manchen Rahmen nicht erlaubt */ }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { zeige(name(t)); });
    t.addEventListener('keydown', function (e) {
      var j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      zeige(name(tabs[(j + tabs.length) % tabs.length]), true);
    });
  });

  U.an('oeffne', function (d) {
    if (d.z) U.zustand.z = d.z;
    zeige(d.reiter);
    if (U.ansichten[d.reiter] && U.ansichten[d.reiter].uebernehmen) U.ansichten[d.reiter].uebernehmen(d);
    var panel = U.$('p-' + d.reiter);
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'start' });
  });

  var start = (location.hash || '').slice(1);
  zeige(U.$('tab-' + start) ? start : 'pse');
  if (root.LK) root.LK.check();
})(window);
