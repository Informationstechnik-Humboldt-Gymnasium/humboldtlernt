// Atom- & Chemielabor · Reiter „Formeln“ (Formel-Parser und molare Masse)
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, C = CL.chemie;
  var esc = U.esc;
  var BEISPIELE = ['H2O', 'CO2', 'NaCl', 'H2SO4', 'Ca(OH)2', 'Al2(SO4)3', 'CuSO4·5H2O', 'NH4+', 'C6H12O6'];
  var letztes = null;

  function init() {
    U.$('fo-beispiele').innerHTML = BEISPIELE.map(function (b) {
      return '<button type="button" data-f="' + esc(b) + '">' + esc(C.parseFormel(b).anzeige) + '</button>';
    }).join('');
    U.$('fo-beispiele').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-f]');
      if (b) { U.$('fo-eingabe').value = b.dataset.f; rechne(); }
    });
    U.$('fo-form').addEventListener('submit', function (ev) { ev.preventDefault(); rechne(); });
    U.$('fo-n').addEventListener('input', masseAusStoffmenge);
    rechne();
  }

  function rechne() {
    var text = U.$('fo-eingabe').value, r = C.molareMasse(text);
    letztes = r.ok ? r : null;
    var feld = U.$('fo-eingabe');
    feld.setAttribute('aria-invalid', r.ok ? 'false' : 'true');
    if (!r.ok) {
      var markiert = '';
      if (r.pos !== undefined && text.trim()) {
        var t = text.trim(), p = Math.min(r.pos, t.length);
        markiert = '<p class="formel-fehlerstelle"><code>' + esc(t.slice(0, p)) + '<mark>' + esc(t.slice(p, p + 1) || ' ') + '</mark>' + esc(t.slice(p + 1)) + '</code></p>';
      }
      var analyse = r.formel ? '<p class="small">Erkannt: ' + esc(r.formel.anzeige) + ' – ' + r.formel.elemente.map(function (x) { return x.anzahl + ' × ' + esc(x.symbol); }).join(', ') + '</p>' : '';
      U.$('fo-ergebnis').innerHTML = '<div class="status-box warn"><b>' + (r.formel ? 'Keine molare Masse' : 'Eingabe prüfen') + '</b><p class="small">' + esc(r.fehler) + '</p>' + markiert + analyse + '</div>';
      masseAusStoffmenge();
      return;
    }
    var f = r.formel, M = r.molareMasse;
    var zeilen = r.schritte.map(function (x) {
      return '<tr><td><b>' + esc(x.symbol) + '</b> <span class="muted small">' + esc(x.name) + '</span></td><td>' + x.anzahl + '</td><td>' + U.fmt(x.atommasse, nachkomma(x.atommasse)) +
        '</td><td>' + x.anzahl + ' · ' + U.fmt(x.atommasse, nachkomma(x.atommasse)) + ' = ' + U.fmt(x.beitrag, 3) + '</td></tr>';
    }).join('');
    U.$('fo-ergebnis').innerHTML =
      '<p class="formel-gross">' + esc(r.text) + '</p>' +
      '<p class="small">' + f.atomeGesamt + ' Atome in ' + r.schritte.length + ' Element' + (r.schritte.length > 1 ? 'en' : '') +
      (f.ladung ? ' · Ladung ' + (f.ladung > 0 ? '+' : '−') + Math.abs(f.ladung) + ' (Ion)' : '') + ' · Summenformel nach Hill: ' + esc(C.hill(f.anzahl)) + '</p>' +
      '<table class="daten rechnung"><thead><tr><th>Element</th><th>Anzahl</th><th>Aᵣ</th><th>Beitrag in g/mol</th></tr></thead><tbody>' + zeilen + '</tbody></table>' +
      '<p class="ergebnis-zeile"><span class="f">M</span>(' + esc(r.text) + ') = ' + r.schritte.map(function (x) { return U.fmt(x.beitrag, 3); }).join(' + ') + ' ≈ <b>' + U.fmt(M, 2) + ' g/mol</b></p>' +
      '<p class="small muted">So geht’s: Für jedes Element die Anzahl der Atome mit seiner relativen Atommasse Aᵣ malnehmen und alles addieren. Der Zahlenwert in g/mol ist gleich der Summe der Aᵣ. Gerundet auf zwei Nachkommastellen; die Genauigkeit ist durch die Atommassen begrenzt.</p>';
    var a = f.anzahl;
    if (Object.keys(a).length === 3 && a.C === 6 && a.H === 12 && a.O === 6) root.LK.reach('fo-glucose');
    masseAusStoffmenge();
  }

  function nachkomma(x) { var t = String(x).split('.')[1]; return t ? t.length : 0; }

  function masseAusStoffmenge() {
    var n = Number(String(U.$('fo-n').value).replace(',', '.'));
    var ziel = U.$('fo-rechnung');
    if (!letztes) { ziel.innerHTML = '<p class="small muted">Berechne zuerst links eine molare Masse.</p>'; return; }
    if (!(n >= 0) || !isFinite(n)) { ziel.innerHTML = '<p class="small">Gib eine Stoffmenge ab 0 mol ein.</p>'; return; }
    var M = letztes.molareMasse;
    ziel.innerHTML = '<p><span class="f">m</span> = <span class="f">n</span> · <span class="f">M</span> = ' + U.fmt(n, 3).replace(/,?0+$/, '') + ' mol · ' + U.fmt(M, 2) + ' g/mol = <b>' + U.fmt(n * M, 2) + ' g</b></p>' +
      '<p class="small muted">' + U.fmt(n, 3).replace(/,?0+$/, '') + ' mol ' + esc(letztes.text) + ' wiegen also rund ' + U.fmt(n * M, 1) + ' g. Ein Mol enthält 6,022 · 10²³ Teilchen (Avogadro-Konstante, CODATA).</p>';
  }

  U.ansichten.formel = {
    init: init,
    uebernehmen: function (d) { if (d.symbol) { U.$('fo-eingabe').value = d.symbol; rechne(); } },
  };
})(window);
