// Atom- & Chemielabor · Reiter „Periodensystem“
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, C = CL.chemie, D = CL.daten;
  var esc = U.esc;
  var ZUSTAND = { s: 'fest', l: 'flüssig', g: 'gasförmig' };
  var zellen = [], gewaehlt = 6;

  function zeilePos(e) {
    // Hauptteil: Zeile = Periode, Spalte = Gruppe. f-Zeilen: Zeile 9 (Lanthanoide) und 10 (Actinoide), ab Spalte 3.
    if (e.fSpalte !== null) return { zeile: e.periode === 6 ? 9 : 10, spalte: 3 + e.fSpalte };
    return { zeile: e.periode, spalte: e.gruppe };
  }

  function init() {
    var pse = U.$('pse');
    var html = '';
    for (var g = 1; g <= 18; g++) html += '<div class="pse-kopf" style="grid-row:1;grid-column:' + (g + 1) + '" aria-hidden="true">' + g + '</div>';
    for (var p = 1; p <= 7; p++) html += '<div class="pse-kopf" style="grid-row:' + (p + 1) + ';grid-column:1" aria-hidden="true">' + p + '</div>';
    html += '<div class="pse-platz k-la" style="grid-row:7;grid-column:4" aria-hidden="true">57–71</div>';
    html += '<div class="pse-platz k-ac" style="grid-row:8;grid-column:4" aria-hidden="true">89–103</div>';
    C.elemente.forEach(function (e) {
      var pos = zeilePos(e);
      var r = pos.zeile + 1, c = pos.spalte + 1;   // Zeile 1 = Gruppennummern, Zeile 9 = Abstand
      html += '<button type="button" class="pse-zelle k-' + e.kategorie + (e.nurEinzelneAtome ? ' unsicher' : '') + '" data-z="' + e.z +
        '" data-zeile="' + r + '" data-spalte="' + c + '" style="grid-row:' + r + ';grid-column:' + c + '" tabindex="-1"' +
        ' aria-label="' + esc(e.name + ', ' + e.symbol + ', Ordnungszahl ' + e.z + (e.masse !== null ? ', relative Atommasse ' + U.fmt(e.masse, 3) : '')) + '">' +
        '<span class="z">' + e.z + '</span><span class="sym">' + esc(e.symbol) + '</span><span class="nm">' + esc(e.name) + '</span></button>';
    });
    pse.innerHTML = html;
    zellen = Array.prototype.slice.call(pse.querySelectorAll('.pse-zelle'));

    var kat = U.$('pse-kategorie');
    Object.keys(D.KATEGORIEN).forEach(function (k) { kat.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(D.KATEGORIEN[k]) + '</option>'); });
    U.$('pse-legende').innerHTML = Object.keys(D.KATEGORIEN).map(function (k) {
      return '<span class="leg"><i class="k-' + k + '"></i>' + esc(D.KATEGORIEN[k]) + '</span>';
    }).join('') + '<span class="leg"><i class="unsicher-muster"></i>Eigenschaften nicht gemessen (Z ≥ ' + D.NUR_EINZELNE_ATOME_AB + ')</span>';

    pse.addEventListener('click', function (ev) {
      var b = ev.target.closest('.pse-zelle');
      if (b) waehle(Number(b.dataset.z), true);
    });
    pse.addEventListener('keydown', tasten);
    ['pse-suche', 'pse-kategorie', 'pse-zustand'].forEach(function (id) { U.$(id).addEventListener('input', filtern); });
    U.$('pse-detail').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-oeffne]');
      if (b) U.melde('oeffne', { reiter: b.dataset.oeffne, z: gewaehlt, symbol: b.dataset.symbol });
    });
    waehle(U.zustand.z || 6, false);
    filtern();
  }

  function tasten(ev) {
    var b = ev.target.closest('.pse-zelle');
    if (!b) return;
    var r = Number(b.dataset.zeile), c = Number(b.dataset.spalte), d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    var best = null, bestWert = Infinity;
    zellen.forEach(function (x) {
      var xr = Number(x.dataset.zeile), xc = Number(x.dataset.spalte), dr = xr - r, dc = xc - c;
      if (d[0] && Math.sign(dr) !== d[0]) return;
      if (d[1] && Math.sign(dc) !== d[1]) return;
      var w = d[0] ? Math.abs(dr) * 10 + Math.abs(dc) : Math.abs(dc) * 10 + Math.abs(dr) * 100;
      if (w < bestWert) { bestWert = w; best = x; }
    });
    if (best) { fokus(best); waehle(Number(best.dataset.z), false); }
  }

  function fokus(b) { zellen.forEach(function (x) { x.tabIndex = x === b ? 0 : -1; }); b.focus(); }

  function filtern() {
    var q = U.$('pse-suche').value.trim().toLowerCase(), k = U.$('pse-kategorie').value, zst = U.$('pse-zustand').value, n = 0;
    zellen.forEach(function (b) {
      var e = C.element(Number(b.dataset.z));
      var passt = (!q || e.name.toLowerCase().indexOf(q) >= 0 || e.symbol.toLowerCase() === q || String(e.z) === q) &&
        (!k || e.kategorie === k) && (!zst || (zst === '?' ? e.zustand === null : e.zustand === zst));
      b.classList.toggle('aus', !passt);
      if (passt) n++;
    });
    U.$('pse-treffer').textContent = n === 118 ? '118 Elemente' : n + ' von 118 Elementen passen';
    if (n === 1 && q) {
      var einziger = zellen.filter(function (b) { return !b.classList.contains('aus'); })[0];
      waehle(Number(einziger.dataset.z), false);
    }
  }

  function zeile(name, wert, art) {
    return '<tr><th scope="row">' + esc(name) + '</th><td>' + wert + (art ? ' <span class="wertart">' + esc(art) + '</span>' : '') + '</td></tr>';
  }

  function waehle(z) {
    var e = C.element(z);
    if (!e) return;
    gewaehlt = z; U.zustand.z = z;
    zellen.forEach(function (b) { var an = Number(b.dataset.z) === z; b.classList.toggle('gewaehlt', an); if (an) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); if (an) b.tabIndex = 0; else b.tabIndex = -1; });
    var k = C.konfiguration(z);
    var masse = e.masse !== null ? U.fmt(e.masse, String(e.masse).split('.')[1] ? String(e.masse).split('.')[1].length : 0)
      : '– <span class="small muted">(kein stabiles Isotop; langlebiges Isotop: Massenzahl ' + e.massenzahlLanglebig + ')</span>';
    var html = '<div class="detail-kopf"><div class="kachel k-' + e.kategorie + '"><span class="z">' + e.z + '</span><b>' + esc(e.symbol) + '</b></div>' +
      '<div><h2>' + esc(e.name) + '</h2><p class="small muted">' + esc(e.kategorieName) + (e.nurEinzelneAtome ? ' (nur aus der Stellung im Periodensystem)' : '') + '</p></div></div>' +
      '<table class="daten"><tbody>' +
      zeile('Ordnungszahl (Protonen)', e.z) +
      zeile('Relative Atommasse Aᵣ', masse, e.masse !== null ? 'tabelliert, IUPAC' : '') +
      zeile('Periode / Gruppe', e.periode + ' / ' + (e.gruppe || (e.periode === 6 ? 'Lanthanoide' : 'Actinoide')), '') +
      zeile('Zustand bei 20 °C', e.zustand ? ZUSTAND[e.zustand] : '<span class="unbekannt">nicht zuverlässig bekannt</span>', e.zustand ? 'tabelliert' : '') +
      zeile('Elektronenkonfiguration', esc(k.kurz), k.vorhergesagt ? 'vorhergesagt' : 'gemessen, NIST') +
      zeile('Schalenbesetzung', k.schalen.join(', '), 'aus der Konfiguration') +
      zeile('1. Ionisierungsenergie', e.ionisierung !== null ? U.fmt(e.ionisierung, 2) + ' eV' : '<span class="unbekannt">im Labor nicht hinterlegt</span>', e.ionisierung !== null ? 'gemessen, NIST' : '') +
      zeile('Häufigstes Isotop', e.isotop ? esc(e.name) + '-' + e.isotop : '<span class="unbekannt">kommt in der Natur (fast) nicht vor</span>', e.isotop ? 'tabelliert' : '') +
      '</tbody></table>' +
      (k.ausnahme ? '<p class="small hinweis">Die Elektronenkonfiguration weicht von der einfachen Auffüllregel ab (gemessen).</p>' : '') +
      (e.nurEinzelneAtome ? '<p class="small hinweis">Von diesem Element wurden nur einzelne Atome hergestellt. Viele Eigenschaften sind deshalb unbekannt.</p>' : '') +
      '<div class="row eng knoepfe">' +
      '<button type="button" data-oeffne="atom">Im Atomlabor ansehen</button>' +
      '<button type="button" data-oeffne="isotope">Isotope bauen</button>' +
      (D.BAUKASTEN[e.symbol] ? '<button type="button" data-oeffne="molekuel" data-symbol="' + esc(e.symbol) + '">Im Molekülbaukasten verwenden</button>' : '') +
      (e.masse !== null ? '<button type="button" data-oeffne="formel" data-symbol="' + esc(e.symbol) + '">Molare Masse</button>' : '') +
      '</div>';
    U.$('pse-detail').innerHTML = html;
    if (e.zustand === 'l') root.LK.reach('pse-fluessig');
  }

  U.ansichten.pse = {
    init: init,
    uebernehmen: function (d) { if (d.z) waehle(d.z, false); },
  };
})(window);
