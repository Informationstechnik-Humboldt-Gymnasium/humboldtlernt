// HTML-Sandbox · Oberfläche (Explorer, Tabs, Splitter, Vorschau, Konsole, Speichern, Teilen, Hilfe)
// Daten: Projekte im localStorage des Browsers (Schlüssel SPEICHER), Ansicht/Einstellungen getrennt (ANSICHT).
// Vorschau: <iframe sandbox="allow-scripts allow-forms allow-modals" srcdoc="…"> ohne allow-same-origin – der Schülercode
// kann die Lernseite nicht erreichen. Austausch nur über postMessage (siehe preview-bridge.js).
(function (root) {
  'use strict';
  var HS = root.HS;
  var $ = function (id) { return document.getElementById(id); };
  var SPEICHER = 'humboldtlernt-html-sandbox', ANSICHT = 'humboldtlernt-html-sandbox-ansicht', LAUF = 'humboldtlernt-html-sandbox-lauf';
  var app = $('app'), arbeit = $('arbeit'), frame = $('vorschau');

  // ---------------------------------------------------------------- Symbole (16 × 16, Linien)
  var ICONS = {
    play: '<path d="M5 3.2l7.5 4.8L5 12.8z" fill="currentColor" stroke="none"/>',
    auto: '<path d="M13.2 8A5.2 5.2 0 1 1 11.7 4.3"/><path d="M12.2 1.8v2.8H9.4"/>',
    inspektor: '<path d="M7 13.5H3.2a1.2 1.2 0 0 1-1.2-1.2V3.2A1.2 1.2 0 0 1 3.2 2h9.1a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M8.2 8.2l6 2.1-2.6 1.1-1.1 2.6z" fill="currentColor"/>',
    neben: '<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.2"/><path d="M8 2.8v10.4"/>',
    ueber: '<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.2"/><path d="M1.8 8h12.4"/>',
    mond: '<path d="M13.3 9.6A5.6 5.6 0 1 1 6.4 2.7a4.4 4.4 0 0 0 6.9 6.9z"/>',
    sonne: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>',
    teilen: '<circle cx="12" cy="3.8" r="1.8"/><circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="12.2" r="1.8"/><path d="M5.6 7.1l4.8-2.4M5.6 8.9l4.8 2.4"/>',
    laden: '<path d="M8 2v8.2M4.8 7.2L8 10.4l3.2-3.2M2.8 13.6h10.4"/>',
    oeffnen: '<path d="M2 4.4v7.8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.2a1 1 0 0 0-1-1H8L6.6 3.4H3a1 1 0 0 0-1 1z"/>',
    reset: '<path d="M2.9 8a5.1 5.1 0 1 0 1.6-3.7"/><path d="M3.9 1.8v2.9h2.9"/>',
    hilfe: '<circle cx="8" cy="8" r="6.2"/><path d="M6.2 6.3a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.7.6-.7 1.1v.4"/><circle cx="8" cy="11.6" r=".5" fill="currentColor"/>',
    dateien: '<path d="M9.2 1.8H4.2a1.2 1.2 0 0 0-1.2 1.2v10a1.2 1.2 0 0 0 1.2 1.2h7.6a1.2 1.2 0 0 0 1.2-1.2V5.6z"/><path d="M9.2 1.8v3.8H13"/>',
    zahnrad: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/><circle cx="8" cy="8" r="4.4"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    stift: '<path d="M10.8 2.6l2.6 2.6-7.6 7.6-3.3.7.7-3.3z"/>',
    muell: '<path d="M2.8 4.4h10.4M6.4 4.4V2.8h3.2v1.6M4.4 4.4l.6 9h6l.6-9"/>',
    neu: '<path d="M13 2.8v3.6H9.4"/><path d="M12.8 6.2A5.1 5.1 0 1 0 13.1 9"/>',
    voll: '<path d="M2.2 6V2.2H6M10 2.2h3.8V6M13.8 10v3.8H10M6 13.8H2.2V10"/>',
    vollAus: '<path d="M6 2.2V6H2.2M13.8 6H10V2.2M10 13.8V10h3.8M2.2 10H6v3.8"/>',
    format: '<path d="M5.8 2.4c-1.4 0-1.9.7-1.9 1.9v1.6c0 .8-.5 1.5-1.5 2.1 1 .6 1.5 1.3 1.5 2.1v1.6c0 1.2.5 1.9 1.9 1.9M10.2 2.4c1.4 0 1.9.7 1.9 1.9v1.6c0 .8.5 1.5 1.5 2.1-1 .6-1.5 1.3-1.5 2.1v1.6c0 1.2-.5 1.9-1.9 1.9"/>',
    lupe: '<circle cx="7" cy="7" r="4.4"/><path d="M10.3 10.3L14 14"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>'; }
  function setzeIcon(span, name) { span.dataset.icon = name; span.innerHTML = icon(name); }
  document.querySelectorAll('[data-icon]').forEach(function (s) { s.innerHTML = icon(s.dataset.icon); });
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---------------------------------------------------------------- Speicher
  function lies(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function ladeDaten() {
    var o = lies(SPEICHER);
    if (o && Array.isArray(o.projekte)) {
      var ps = o.projekte.map(HS.pruefeProjekt).filter(Boolean);
      if (ps.length) return { aktiv: ps.some(function (p) { return p.id === o.aktiv; }) ? o.aktiv : ps[0].id, projekte: ps };
    }
    var v = HS.vorlage('beispiel');
    return { aktiv: v.id, projekte: [v] };
  }
  var daten = ladeDaten();
  var ansicht = { thema: 'dunkel', schrift: 14, tab: 2, minimap: true, autoSchliessen: true, auto: true, mitlaufen: true, leeren: true,
    layout: 'neben', aufteilung: { neben: 50, ueber: 50 }, seitenleiste: 'explorer', konsole: true };
  (function () {
    var a = lies(ANSICHT);
    if (!a) return;
    Object.keys(ansicht).forEach(function (k) { if (a[k] !== undefined && typeof a[k] === typeof ansicht[k]) ansicht[k] = a[k]; });
    if (ansicht.thema !== 'hell') ansicht.thema = 'dunkel';
    if (ansicht.layout !== 'ueber') ansicht.layout = 'neben';
    ansicht.schrift = Math.max(11, Math.min(22, +ansicht.schrift || 14));
    ansicht.tab = ansicht.tab === 4 ? 4 : 2;
  })();
  function merkeAnsicht() { try { localStorage.setItem(ANSICHT, JSON.stringify(ansicht)); } catch (e) { /* kein Speicher */ } }

  var ungespeichert = {}, speicherPlan = 0;
  function projekt() { return daten.projekte.filter(function (p) { return p.id === daten.aktiv; })[0]; }
  function datei(name) { return projekt().dateien.filter(function (d) { return d.name === name; })[0]; }
  function namen() { return projekt().dateien.map(function (d) { return d.name; }); }
  function speichere(laut) {
    clearTimeout(speicherPlan);
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(daten));
      ungespeichert = {};
      $('s-speicher').textContent = '✓ Gespeichert';
      if (laut) toast('Gespeichert – im Speicher dieses Browsers.');
    } catch (e) {
      $('s-speicher').textContent = '⚠ Nicht gespeichert';
      toast('Speichern hat nicht geklappt: Der Browser-Speicher ist voll oder gesperrt. Lade dein Projekt als ZIP herunter.');
    }
    zeigeTabs();
  }
  function planeSpeichern() { $('s-speicher').textContent = '● Ungespeichert'; clearTimeout(speicherPlan); speicherPlan = setTimeout(speichere, 800); }
  window.addEventListener('pagehide', function () { if (Object.keys(ungespeichert).length) speichere(); });

  // ---------------------------------------------------------------- Meldung und Dialog
  var toastPlan = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastPlan);
    toastPlan = setTimeout(function () { t.hidden = true; }, Math.max(2600, text.length * 55));
  }
  var dialogFokus = null;
  /** Dialog: { titel, html, knoepfe: [{ text, wert, art: 'primaer'|'gefahr' }], eingabe: { wert, pruefe } } → Promise(wert | null).
      Mit Eingabefeld: Promise({ wahl: wert des Knopfs, text: Eingabe } | null) */
  function dialog(o) {
    return new Promise(function (fertig) {
      var huelle = $('dialog');
      dialogFokus = document.activeElement;
      $('dialog-titel').textContent = o.titel;
      $('dialog-inhalt').innerHTML = (o.html || '') + (o.eingabe ? '<p><input type="text" id="dialog-eingabe" spellcheck="false" aria-label="' + esc(o.eingabe.label || o.titel) + '"></p><p class="hs-dialog-fehler" id="dialog-fehler" role="alert"></p>' : '');
      var knoepfe = o.knoepfe || [{ text: 'OK', wert: true, art: 'primaer' }];
      $('dialog-knoepfe').innerHTML = knoepfe.map(function (k, i) { return '<button type="button" data-i="' + i + '" class="' + (k.art === 'primaer' ? 'hs-primaer' : k.art === 'gefahr' ? 'hs-gefahr' : '') + '">' + esc(k.text) + '</button>'; }).join('');
      huelle.hidden = false;
      var eing = $('dialog-eingabe');
      if (eing) { eing.value = o.eingabe.wert || ''; eing.focus(); eing.select(); }
      else { var p = $('dialog-knoepfe').querySelector('.hs-primaer, .hs-gefahr') || $('dialog-knoepfe').querySelector('button'); if (p) p.focus({ preventScroll: true }); }
      huelle.querySelector('.hs-dialog').scrollTop = 0;
      function zu(wert) {
        huelle.hidden = true;
        huelle.removeEventListener('click', klick); huelle.removeEventListener('keydown', taste);
        if (dialogFokus && dialogFokus.focus) dialogFokus.focus({ preventScroll: true });
        fertig(wert);
      }
      function waehle(k) {
        if (k.wert !== null && k.wert !== false && eing) {
          var f = o.eingabe.pruefe ? o.eingabe.pruefe(eing.value.trim()) : '';
          if (f) { $('dialog-fehler').textContent = f; eing.focus(); return; }
          zu({ wahl: k.wert, text: eing.value.trim() }); return;
        }
        zu(k.wert);
      }
      function klick(e) {
        if (e.target === huelle) { zu(null); return; }
        var b = e.target.closest('[data-i]'); if (b) waehle(knoepfe[+b.dataset.i]);
        var kopie = e.target.closest('[data-kopieren]'); if (kopie) kopiere(kopie);
      }
      function taste(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu(null); }
        else if (e.key === 'Enter' && e.target === eing) { e.preventDefault(); waehle(knoepfe.filter(function (k) { return k.art === 'primaer'; })[0] || knoepfe[0]); }
        else if (e.key === 'Tab') {                                   // Fokus bleibt im Dialog
          var f = Array.prototype.slice.call(huelle.querySelectorAll('button, input, select, a[href], textarea'));
          if (!f.length) return;
          var i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      }
      huelle.addEventListener('click', klick); huelle.addEventListener('keydown', taste);
    });
  }
  function bestaetige(titel, text, knopf) { return dialog({ titel: titel, html: '<p>' + text + '</p>', knoepfe: [{ text: 'Abbrechen', wert: false }, { text: knopf || 'OK', wert: true, art: 'gefahr' }] }); }
  function kopiere(knopf) {
    var feld = $(knopf.dataset.kopieren);
    feld.focus(); feld.select();
    var ok = false;
    function fertig() { knopf.textContent = ok ? 'Kopiert ✓' : 'Bitte mit Strg+C kopieren'; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(feld.value).then(function () { ok = true; fertig(); }, function () { try { ok = document.execCommand('copy'); } catch (e) { ok = false; } fertig(); }); return; }
      ok = document.execCommand('copy');
    } catch (e) { ok = false; }
    fertig();
  }

  // ---------------------------------------------------------------- Editor
  var seite = 'index.html';                                         // in der Vorschau angezeigte HTML-Seite
  var editor = HS.erstelleEditor($('editor'), {
    label: 'Code-Editor',
    beiAenderung: function (name, text) {
      var d = datei(name); if (!d) return;
      d.inhalt = text; projekt().geaendert = Date.now();
      if (!ungespeichert[name]) { ungespeichert[name] = true; zeigeTabs(); }
      planeSpeichern(); planeVorschau();
    },
    beiCursor: function (name, pos, zeile, spalte, auswahl) {
      $('s-pos').textContent = 'Zeile ' + zeile + ', Spalte ' + spalte + (auswahl ? ' (' + auswahl + ' ausgewählt)' : '');
      planeMitlaufen(name, pos);
    },
    beiTaste: taste,
    melde: toast
  });

  // ---------------------------------------------------------------- Tabs und Explorer
  function symbol(name) {
    var a = HS.dateiArt(name), e = a.endung;
    var k = e === 'html' || e === 'htm' ? ['html', '&lt;&gt;'] : e === 'css' ? ['css', '#'] : e === 'js' ? ['js', 'JS'] : e === 'svg' ? ['svg', 'SVG'] : a.bild ? ['bild', '▣'] : ['text', '≡'];
    return '<span class="hs-dsym hs-dsym-' + k[0] + '" aria-hidden="true">' + k[1] + '</span>';
  }
  function zeigeTabs() {
    var p = projekt();
    $('tabs').innerHTML = p.offen.map(function (n) {
      return '<div class="hs-tab' + (ungespeichert[n] ? ' ungespeichert' : '') + '" role="tab" tabindex="' + (n === p.aktiv ? 0 : -1) + '" aria-selected="' + (n === p.aktiv) + '" data-name="' + esc(n) + '" title="' + esc(n) + '">' +
        symbol(n) + '<span>' + esc(n) + '</span><button type="button" class="hs-tab-zu" data-zu="' + esc(n) + '" aria-label="' + esc(n) + ' schließen" title="Schließen"><span>×</span></button></div>';
    }).join('');
    var akt = $('tabs').querySelector('[aria-selected="true"]');
    if (akt && akt.scrollIntoView) akt.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  $('tabs').addEventListener('click', function (e) {
    var zu = e.target.closest('[data-zu]');
    if (zu) { e.stopPropagation(); schliesseTab(zu.dataset.zu); return; }
    var t = e.target.closest('.hs-tab'); if (t) oeffneDatei(t.dataset.name);
  });
  $('tabs').addEventListener('auxclick', function (e) { var t = e.target.closest('.hs-tab'); if (t && e.button === 1) { e.preventDefault(); schliesseTab(t.dataset.name); } });
  $('tabs').addEventListener('keydown', function (e) {
    var t = e.target.closest('.hs-tab'); if (!t) return;
    var alle = Array.prototype.slice.call($('tabs').children), i = alle.indexOf(t);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = alle[(i + (e.key === 'ArrowRight' ? 1 : -1) + alle.length) % alle.length]; oeffneDatei(n.dataset.name); $('tabs').querySelector('[aria-selected="true"]').focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editor.fokus(); }
    else if (e.key === 'Delete') { e.preventDefault(); schliesseTab(t.dataset.name); }
  });

  function oeffneDatei(name, ohneFokus) {
    var p = projekt(), d = datei(name);
    if (!d) return;
    if (p.offen.indexOf(name) < 0) p.offen.push(name);
    p.aktiv = name;
    var art = HS.dateiArt(name);
    $('editor').hidden = art.bild;
    $('bild-ansicht').hidden = !art.bild;
    if (art.bild) {
      $('bild-ansicht').innerHTML = '<img src="' + esc(d.inhalt) + '" alt="Bild ' + esc(name) + '"><p>' + esc(name) + ' · ' + Math.round(d.inhalt.length * 0.75 / 1024) + ' KB · Bilder kannst du nicht im Editor bearbeiten. Einbinden mit <code>&lt;img src="' + esc(name) + '" alt="…"&gt;</code></p>';
      $('s-sprache').textContent = 'Bild';
    } else {
      editor.oeffne(name, d.inhalt, art.sprache);
      $('s-sprache').textContent = art.anzeige;
      if (!ohneFokus) editor.fokus();
    }
    zeigeTabs(); zeigeDateien(); planeSpeichern();
  }
  function schliesseTab(name) {
    var p = projekt(), i = p.offen.indexOf(name);
    if (i < 0) return;
    p.offen.splice(i, 1);
    if (p.aktiv === name) {
      var naechste = p.offen[Math.min(i, p.offen.length - 1)];
      if (naechste) oeffneDatei(naechste);
      else { p.aktiv = ''; $('editor').hidden = true; $('bild-ansicht').hidden = false; $('bild-ansicht').innerHTML = '<p>Keine Datei geöffnet. Wähle links im Explorer eine Datei aus.</p>'; zeigeTabs(); zeigeDateien(); }
    } else zeigeTabs();
    planeSpeichern();
  }

  function zeigeDateien() {
    var p = projekt();
    var liste = p.dateien.map(function (d) { return d.name; }).sort(function (a, b) { return a.localeCompare(b, 'de'); });
    $('dateien').innerHTML = liste.map(function (n) {
      return '<li class="hs-datei" tabindex="0" data-name="' + esc(n) + '" aria-current="' + (n === p.aktiv) + '" title="' + esc(n) + '">' + symbol(n) +
        '<span class="hs-datei-name">' + esc(n) + '</span>' +
        '<button type="button" class="hs-mini" data-aktion="umbenennen" title="Umbenennen (F2)" aria-label="' + esc(n) + ' umbenennen"><span class="hs-i">' + icon('stift') + '</span></button>' +
        '<button type="button" class="hs-mini" data-aktion="loeschen" title="Löschen (Entf)" aria-label="' + esc(n) + ' löschen"><span class="hs-i">' + icon('muell') + '</span></button></li>';
    }).join('');
    $('s-projekt').textContent = p.name;
    var w = $('projekt-wahl');
    w.innerHTML = daten.projekte.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
  }
  $('dateien').addEventListener('click', function (e) {
    var li = e.target.closest('.hs-datei'); if (!li || e.target.closest('input')) return;
    var b = e.target.closest('[data-aktion]');
    if (b && b.dataset.aktion === 'umbenennen') umbenennen(li.dataset.name);
    else if (b && b.dataset.aktion === 'loeschen') loeschen(li.dataset.name);
    else oeffneDatei(li.dataset.name);
  });
  $('dateien').addEventListener('keydown', function (e) {
    var li = e.target.closest('.hs-datei'); if (!li || e.target.closest('input') || e.target !== li) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffneDatei(li.dataset.name); }
    else if (e.key === 'F2') { e.preventDefault(); umbenennen(li.dataset.name); }
    else if (e.key === 'Delete') { e.preventDefault(); loeschen(li.dataset.name); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = e.key === 'ArrowDown' ? li.nextElementSibling : li.previousElementSibling; if (n) n.focus(); }
  });

  /** Eingabefeld im Explorer (neue Datei / umbenennen). fertig(name) wird nur mit gültigem Namen aufgerufen. */
  function namensFeld(li, vorgabe, andere, fertig) {
    var feld = document.createElement('input');
    feld.type = 'text'; feld.value = vorgabe; feld.setAttribute('aria-label', 'Dateiname'); feld.spellcheck = false;
    var fehler = document.createElement('p'); fehler.className = 'hs-datei-fehler'; fehler.setAttribute('role', 'alert');
    li.querySelector('.hs-datei-name').replaceWith(feld);
    li.querySelectorAll('.hs-mini').forEach(function (b) { b.hidden = true; });
    li.after(fehler);
    feld.focus();
    var punkt = vorgabe.lastIndexOf('.'); feld.setSelectionRange(0, punkt > 0 ? punkt : vorgabe.length);
    var erledigt = false;
    function ende(ok) {
      if (erledigt) return;
      var n = feld.value.trim();
      if (ok && n !== vorgabe) {
        var f = HS.pruefeName(n, andere);
        if (f) { fehler.textContent = f; feld.focus(); return; }
      }
      erledigt = true; fehler.remove();
      fertig(ok && n !== vorgabe ? n : null);
    }
    feld.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); ende(true); }
      else if (e.key === 'Escape') { e.preventDefault(); erledigt = true; fehler.remove(); fertig(null); }
    });
    feld.addEventListener('blur', function () { setTimeout(function () { if (!erledigt) { var n = feld.value.trim(); if (!n || n === vorgabe || HS.pruefeName(n, andere)) { erledigt = true; fehler.remove(); fertig(null); } else ende(true); } }, 150); });
  }
  function neueDatei() {
    zeigeSeitenleiste('explorer');
    if (projekt().dateien.length >= HS.MAX_DATEIEN) { toast('Ein Projekt kann höchstens ' + HS.MAX_DATEIEN + ' Dateien haben.'); return; }
    var li = document.createElement('li');
    li.className = 'hs-datei';
    li.innerHTML = symbol('neu.txt') + '<span class="hs-datei-name"></span>';
    $('dateien').prepend(li);
    namensFeld(li, '', namen(), function (n) {
      li.remove();
      if (!n) { zeigeDateien(); return; }
      if (HS.dateiArt(n).bild) { toast('Bilder fügst du über „Datei öffnen“ hinzu.'); zeigeDateien(); return; }
      var inhalt = /\.html?$/i.test(n) ? HS.emmet('!').text.replace('<body>\n  \n</body>', '<body>\n  <h1>' + esc(n.replace(/\.html?$/i, '')) + '</h1>\n</body>').replace('</title>', '</title>\n  <link rel="stylesheet" href="style.css">') : '';
      projekt().dateien.push({ name: n, inhalt: inhalt });
      oeffneDatei(n);
      planeVorschau();
    });
  }
  function umbenennen(alt) {
    var li = $('dateien').querySelector('[data-name="' + CSS.escape(alt) + '"]'); if (!li) return;
    namensFeld(li, alt, namen().filter(function (n) { return n !== alt; }), function (neu) {
      if (!neu) { zeigeDateien(); return; }
      if (HS.dateiArt(neu).bild !== HS.dateiArt(alt).bild) { toast('Ein Bild bleibt ein Bild: Die Endung muss zur Dateiart passen.'); zeigeDateien(); return; }
      var p = projekt(), d = datei(alt);
      d.name = neu;
      p.offen = p.offen.map(function (n) { return n === alt ? neu : n; });
      if (p.aktiv === alt) p.aktiv = neu;
      if (seite === alt) seite = neu;
      if (ungespeichert[alt]) { delete ungespeichert[alt]; ungespeichert[neu] = true; }
      editor.umbenennen(alt, neu, HS.dateiArt(neu).sprache);
      if (p.aktiv === neu) oeffneDatei(neu, true);
      zeigeTabs(); zeigeDateien(); planeSpeichern(); aktualisiere();
      toast('Umbenannt. Denk daran, Verweise wie href="' + alt + '" anzupassen.');
    });
  }
  function loeschen(name) {
    bestaetige('Datei löschen?', '„' + esc(name) + '“ wird aus dem Projekt gelöscht. Das kann man nicht rückgängig machen.', 'Löschen').then(function (ok) {
      if (!ok) return;
      var p = projekt();
      p.dateien = p.dateien.filter(function (d) { return d.name !== name; });
      editor.vergiss(name);
      delete ungespeichert[name];
      if (!p.dateien.length) p.dateien.push({ name: 'index.html', inhalt: HS.vorlage('leer').dateien[0].inhalt });
      if (p.offen.indexOf(name) >= 0) schliesseTab(name);
      if (!p.aktiv) oeffneDatei(p.dateien[0].name);
      zeigeDateien(); planeSpeichern(); aktualisiere();
    });
  }
  $('d-neu').addEventListener('click', neueDatei);
  $('d-hochladen').addEventListener('click', function () { $('datei-eingabe').click(); });

  // ---------------------------------------------------------------- Projekte
  function wechsleProjekt(id) {
    speichere();
    projekt().dateien.forEach(function (d) { editor.vergiss(d.name); });
    daten.aktiv = id;
    var p = projekt();
    seite = 'index.html';
    scrollPos = {};
    if (!p.aktiv || !datei(p.aktiv)) p.aktiv = p.dateien[0].name;
    oeffneDatei(p.aktiv, true);
    zeigeDateien();
    aktualisiere();
  }
  $('projekt-wahl').addEventListener('change', function () { wechsleProjekt(this.value); });
  function eindeutigerName(n) {
    var vorhanden = daten.projekte.map(function (p) { return p.name; }), name = n, k = 2;
    while (vorhanden.indexOf(name) >= 0) name = n + ' (' + (k++) + ')';
    return name;
  }
  $('pr-neu').addEventListener('click', function () {
    dialog({ titel: 'Neues Projekt', html: '<p>Wie soll das Projekt heißen?</p>', eingabe: { wert: eindeutigerName('Neues Projekt'), label: 'Projektname', pruefe: function (v) { return v ? '' : 'Bitte gib einen Namen ein.'; } },
      knoepfe: [{ text: 'Abbrechen', wert: null }, { text: 'Mit Beispiel', wert: 'beispiel' }, { text: 'Leer anlegen', wert: 'leer', art: 'primaer' }] }).then(function (r) {
      if (!r) return;
      var p = HS.vorlage(r.wahl);
      p.name = r.text.slice(0, 60);
      daten.projekte.push(p);
      wechsleProjekt(p.id);
      toast('Projekt „' + p.name + '“ angelegt.');
    });
  });
  $('pr-umbenennen').addEventListener('click', function () {
    var p = projekt();
    dialog({ titel: 'Projekt umbenennen', eingabe: { wert: p.name, label: 'Projektname', pruefe: function (v) { return v ? '' : 'Bitte gib einen Namen ein.'; } },
      knoepfe: [{ text: 'Abbrechen', wert: null }, { text: 'Umbenennen', wert: true, art: 'primaer' }] }).then(function (r) {
      if (!r) return;
      p.name = r.text.slice(0, 60); zeigeDateien(); speichere();
    });
  });
  $('pr-loeschen').addEventListener('click', function () {
    var p = projekt();
    bestaetige('Projekt löschen?', 'Das Projekt „' + esc(p.name) + '“ mit allen Dateien wird gelöscht. Das kann man nicht rückgängig machen.', 'Projekt löschen').then(function (ok) {
      if (!ok) return;
      p.dateien.forEach(function (d) { editor.vergiss(d.name); });
      daten.projekte = daten.projekte.filter(function (x) { return x !== p; });
      if (!daten.projekte.length) daten.projekte.push(HS.vorlage('beispiel'));
      daten.aktiv = daten.projekte[0].id;
      wechsleProjekt(daten.aktiv);
    });
  });

  // ---------------------------------------------------------------- Vorschau
  var laufNr = 0, karte = [], regeln = [], vorschauPlan = 0, pausiert = false, scrollPos = {}, marken = {};
  var seiteAnalyse = { text: null, a: null };
  function analyse(text) { if (seiteAnalyse.text !== text) seiteAnalyse = { text: text, a: HS.parseHtml(text) }; return seiteAnalyse.a; }
  function planeVorschau() { if (!ansicht.auto || pausiert) return; clearTimeout(vorschauPlan); vorschauPlan = setTimeout(aktualisiere, 300); }
  function anVorschau(d) { d.hs = 'editor'; try { frame.contentWindow.postMessage(d, '*'); } catch (e) { /* Vorschau noch nicht bereit */ } }
  function htmlSeiten() { return namen().filter(function (n) { return /\.html?$/i.test(n); }).sort(function (a, b) { return a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b, 'de'); }); }

  function aktualisiere() {
    clearTimeout(vorschauPlan);
    pausiert = false;
    $('angehalten').hidden = true;
    var p = projekt(), dateien = {};
    p.dateien.forEach(function (d) { dateien[d.name] = d.inhalt; });
    var seiten = htmlSeiten();
    if (seiten.indexOf(seite) < 0) seite = seiten[0] || 'index.html';
    $('seite-wahl').innerHTML = seiten.map(function (n) { return '<option' + (n === seite ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
    $('seite-wahl').parentNode.hidden = seiten.length < 2;
    var nr = ++laufNr;
    var v = HS.baueVorschau(dateien, { haupt: seite, bruecke: function (info) {
      regeln = info.regeln.map(function (r) { return { selektor: r.selektor, datei: r.datei, zeile: HS.zeileVon(dateien[r.datei], r.start), start: r.start, ende: r.ende, kopfEnde: r.kopfEnde }; });
      var konfig = { lauf: nr, inspektor: inspektorAn, dateien: Object.keys(dateien), scroll: scrollPos[seite] || null,
        regeln: regeln.map(function (r) { return { selektor: r.selektor, datei: r.datei, zeile: r.zeile }; }) };
      return '<script>(' + HS.bruecke.toString() + ')(' + JSON.stringify(konfig).replace(/</g, '\\u003c') + ');</' + 'script>';
    } });
    karte = v.karte;
    if (ansicht.leeren) leereKonsole();
    // Hinweise zum HTML (nicht geschlossene Tags …) und fehlende Dateien
    marken = {};
    var probleme = v.analyse.probleme.slice(0, 20);
    probleme.forEach(function (x) {
      var z = HS.zeileVon(dateien[seite] || '', x.start);
      merkeMarke(seite, z, 'warnung', x.text);
      konsole('warn', 'HTML: ' + x.text, { datei: seite, zeile: z });
    });
    v.warnungen.forEach(function (w) { merkeMarke(w.datei, w.zeile, 'warnung', w.text); konsole('warn', w.text, { datei: w.datei, zeile: w.zeile }); });
    zeigeMarken();
    try { localStorage.setItem(LAUF, String(Date.now())); } catch (e) { /* egal */ }
    $('vorschau-titel').textContent = '';
    frame.srcdoc = v.html;
  }
  function merkeMarke(name, zeile, art, text) { (marken[name] = marken[name] || []).push({ zeile: zeile, art: art, text: text }); }
  function zeigeMarken() { namen().forEach(function (n) { editor.setzeMarken(n, marken[n] || []); }); }

  // Nachrichten aus der Vorschau
  var geladenPlan = 0;
  window.addEventListener('message', function (e) {
    if (e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || d.hs !== 'vorschau' || d.lauf !== laufNr) return;
    if (d.typ === 'konsole') konsole(d.art === 'info' ? 'info' : d.art === 'warn' ? 'warn' : d.art === 'error' ? 'fehler' : 'log', (d.teile || []).join(' '), d.ort != null ? { datei: seite, zeile: HS.zeileVon(datei(seite) ? datei(seite).inhalt : '', d.ort) } : ortAus(d.zeilen));
    else if (d.typ === 'leeren') leereKonsole();
    else if (d.typ === 'fehler') {
      var ort = d.eingabe ? null : (d.zeile ? HS.ordneZeile(karte, d.zeile) : null) || ortAus(d.zeilen);
      if (ort && d.spalte) ort.spalte = d.spalte;
      konsole('fehler', d.text, ort, tipp(d.text));
      if (ort) { merkeMarke(ort.datei, ort.zeile, 'fehler', d.text); zeigeMarken(); }
    } else if (d.typ === 'schleife') {
      var o = { datei: d.datei, zeile: d.zeile };
      konsole('fehler', 'Endlosschleife? Die Schleife in ' + d.datei + ', Zeile ' + d.zeile + ' lief länger als 1,5 Sekunden und wurde abgebrochen.', o, 'Prüfe die Bedingung der Schleife: Wird sie irgendwann falsch? Wird die Zählvariable verändert?');
      merkeMarke(d.datei, d.zeile, 'fehler', 'Endlosschleife abgebrochen'); zeigeMarken();
    } else if (d.typ === 'sprung') springeZuElement(d);
    else if (d.typ === 'seite') { if (datei(d.name)) { seite = d.name; scrollPos[seite] = null; aktualisiere(); toast('Vorschau zeigt jetzt „' + d.name + '“.'); } }
    else if (d.typ === 'link') toast('Links zu anderen Webseiten öffnen sich in der Sandbox nicht: ' + d.href);
    else if (d.typ === 'formular') toast('Formular abgeschickt – in der Sandbox wird nichts wirklich gesendet. Tipp: Mit event.preventDefault() und JavaScript kannst du die Eingaben selbst auswerten.');
    else if (d.typ === 'taste') taste(d.taste);
    else if (d.typ === 'scroll') scrollPos[seite] = { x: d.x, y: d.y };
    else if (d.typ === 'ergebnis') konsole('ergebnis', d.text, null);
    else if (d.typ === 'bereit' || d.typ === 'geladen') {
      $('vorschau-titel').textContent = d.titel ? '– ' + d.titel : '';
      if (d.typ === 'geladen') { clearTimeout(geladenPlan); geladenPlan = setTimeout(function () { try { localStorage.removeItem(LAUF); } catch (er) { /* egal */ } }, 1500); }
      if (editor.name()) planeMitlaufen(editor.name(), editor.cursor());
      if (inspektorAn) anVorschau({ typ: 'inspektor', an: true });
    }
  });
  function ortAus(zeilen) {
    for (var i = 0; zeilen && i < zeilen.length; i++) { var o = HS.ordneZeile(karte, zeilen[i][0]); if (o) { o.spalte = zeilen[i][1]; return o; } }
    return null;
  }
  function tipp(text) {
    var t = String(text);
    if (/is not defined|Can't find variable/i.test(t)) return 'Tipp: Diesen Namen kennt JavaScript nicht. Ist er richtig geschrieben (auch Groß- und Kleinschreibung)? Wurde die Variable mit let oder const angelegt?';
    if (/of null|null is not an object|null \(reading/i.test(t)) return 'Tipp: Ein Element wurde nicht gefunden (null). Stimmen Selektor bzw. id? Steht das <script> unterhalb des Elements?';
    if (/of undefined|undefined is not an object/i.test(t)) return 'Tipp: Hier ist etwas undefined – vielleicht ein Tippfehler im Namen einer Eigenschaft oder ein Element außerhalb der Liste?';
    if (/is not a function/i.test(t)) return 'Tipp: Das ist keine Funktion. Ist der Name richtig geschrieben? Fehlen Klammern an der richtigen Stelle?';
    if (/Assignment to constant/i.test(t)) return 'Tipp: Eine mit const angelegte Variable kann man nicht ändern. Nimm let, wenn sich der Wert ändern soll.';
    if (/Unexpected end of input|missing \) |missing } |Unexpected token|Unexpected identifier|Invalid or unexpected token|SyntaxError/i.test(t)) return 'Tipp: Syntaxfehler – fehlt eine Klammer, ein Komma, ein Anführungszeichen oder ein Semikolon?';
    if (/already been declared|redeclaration/i.test(t)) return 'Tipp: Diesen Namen hast du schon einmal mit let/const angelegt. Nimm einen anderen Namen oder lass let/const weg.';
    return '';
  }

  function springeZuElement(d) {
    var text = datei(seite) ? datei(seite).inhalt : '';
    if (projekt().aktiv !== seite) oeffneDatei(seite, true);
    var el = analyse(text).elemente.filter(function (x) { return x.start === d.start; })[0];
    editor.springeZu(d.start, d.ende, el ? el.startEnde : d.ende);
    var zeile = HS.zeileVon(text, d.start);
    var info = $('element-info');
    var r = (d.regeln || []).map(function (i) { return regeln[i]; }).filter(Boolean);
    info.innerHTML = '<code>' + esc(d.name) + '</code><span>' + esc(seite) + ', Zeile ' + zeile + (d.erzeugt ? ' · das angeklickte Element entstand per JavaScript' : '') + '</span>' +
      (r.length ? '<span>· CSS:</span>' + r.map(function (x) { var i = regeln.indexOf(x); return '<button type="button" class="hs-regel" data-regel="' + i + '" title="Zur Regel in ' + esc(x.datei) + ', Zeile ' + x.zeile + '">' + esc(x.selektor) + ' <span class="hs-k-ort">' + esc(x.datei) + ':' + x.zeile + '</span></button>'; }).join('') : '<span>· keine CSS-Regel</span>') +
      '<span class="hs-platz"></span><button type="button" class="hs-mini" data-info-zu aria-label="Leiste schließen" title="Schließen">×</button>';
    info.hidden = false;
  }
  $('element-info').addEventListener('click', function (e) {
    if (e.target.closest('[data-info-zu]')) { $('element-info').hidden = true; return; }
    var b = e.target.closest('[data-regel]'); if (!b) return;
    var r = regeln[+b.dataset.regel]; if (!r || !datei(r.datei)) return;
    oeffneDatei(r.datei, true);
    editor.springeZu(r.start, r.ende, r.kopfEnde);
  });

  // Cursor im Editor → Element in der Vorschau dezent hervorheben
  var mitlaufPlan = 0;
  function planeMitlaufen(name, pos) {
    clearTimeout(mitlaufPlan);
    mitlaufPlan = setTimeout(function () {
      if (!ansicht.mitlaufen) { anVorschau({ typ: 'zeige', start: null }); return; }
      var d = datei(name); if (!d) return;
      if (name === seite) {
        var el = HS.elementBei(analyse(d.inhalt), pos);
        anVorschau({ typ: 'zeige', start: el && !/^(html|head|body)$/.test(el.name) ? el.start : null });
      } else if (HS.dateiArt(name).sprache === 'css') {
        var r = HS.regelBei(HS.parseCss(d.inhalt), pos);
        var sel = r ? r.selektor.replace(/::?(before|after|first-line|first-letter|marker|placeholder|selection)\b/gi, '').replace(/:(hover|focus|active|visited|focus-visible|focus-within)\b/gi, '') : '';
        if (sel.trim()) anVorschau({ typ: 'zeigeSelektor', selektor: sel }); else anVorschau({ typ: 'zeige', start: null });
      } else anVorschau({ typ: 'zeige', start: null });
    }, 120);
  }

  // ---------------------------------------------------------------- Konsole
  var zahl = { fehler: 0, warn: 0 }, letzter = null;
  function leereKonsole() {
    $('k-liste').innerHTML = '<div class="hs-konsole-leer">Ausgaben von console.log() und Fehler erscheinen hier.</div>';
    zahl = { fehler: 0, warn: 0 }; letzter = null; zeigeZahlen();
  }
  function zeigeZahlen() {
    $('k-zahlen').innerHTML = (zahl.fehler ? '<span class="f">✕ ' + zahl.fehler + '</span> ' : '') + (zahl.warn ? '<span class="w">⚠ ' + zahl.warn + '</span>' : '');
    $('s-fehler').textContent = zahl.fehler; $('s-warn').textContent = zahl.warn;
  }
  function konsole(art, text, ort, hinweis) {
    var liste = $('k-liste');
    var leer = liste.querySelector('.hs-konsole-leer'); if (leer) leer.remove();
    if (art === 'fehler') zahl.fehler++; else if (art === 'warn') zahl.warn++;
    zeigeZahlen();
    var schluessel = art + '|' + text + '|' + (ort ? ort.datei + ':' + ort.zeile : '');
    if (letzter && letzter.schluessel === schluessel && letzter.el.isConnected) {     // gleiche Meldung: nur zählen
      letzter.anzahl++;
      var anz = letzter.el.querySelector('.hs-k-anz');
      if (!anz) { anz = document.createElement('span'); anz.className = 'hs-k-anz'; letzter.el.insertBefore(anz, letzter.el.children[1]); }
      anz.textContent = letzter.anzahl;
      return;
    }
    var sym = { fehler: '✕', warn: '⚠', info: 'ℹ', ergebnis: '←', eingabe: '›', log: '' }[art] || '';
    var el = document.createElement('div');
    el.className = 'hs-k ' + art;
    el.innerHTML = '<span class="hs-k-sym" aria-hidden="true">' + sym + '</span><span class="hs-k-text">' + esc(text) + (hinweis ? '<span class="hs-k-tipp">' + esc(hinweis) + '</span>' : '') + '</span>' +
      (ort ? '<button type="button" class="hs-k-ort" data-datei="' + esc(ort.datei) + '" data-zeile="' + ort.zeile + '" data-spalte="' + (ort.spalte || 1) + '" title="Zur Stelle springen">' + esc(ort.datei) + ':' + ort.zeile + '</button>' : '');
    if (art === 'fehler' || art === 'warn') el.setAttribute('role', 'alert');
    liste.appendChild(el);
    while (liste.children.length > 500) liste.firstChild.remove();
    liste.scrollTop = liste.scrollHeight;
    letzter = { schluessel: schluessel, el: el, anzahl: 1 };
    if (art === 'fehler' && $('konsole').classList.contains('zu')) zeigeKonsole(true);
  }
  $('k-liste').addEventListener('click', function (e) {
    var b = e.target.closest('.hs-k-ort'); if (!b || !datei(b.dataset.datei)) return;
    oeffneDatei(b.dataset.datei);
    editor.springeZuZeile(+b.dataset.zeile, +b.dataset.spalte);
  });
  function zeigeKonsole(an) {
    ansicht.konsole = an; merkeAnsicht();
    $('konsole').classList.toggle('zu', !an);
    $('k-auf').setAttribute('aria-expanded', String(an));
  }
  $('k-auf').addEventListener('click', function () { zeigeKonsole($('konsole').classList.contains('zu')); });
  $('k-leeren').addEventListener('click', leereKonsole);
  $('s-probleme').addEventListener('click', function () { zeigeKonsole(true); $('k-eingabe').focus(); });
  var eingaben = [], eingabePos = 0;
  $('k-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var code = $('k-eingabe').value.trim(); if (!code) return;
    eingaben.push(code); eingabePos = eingaben.length;
    konsole('eingabe', code, null);
    anVorschau({ typ: 'ausfuehren', code: code });
    $('k-eingabe').value = '';
  });
  $('k-eingabe').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' && eingabePos > 0) { e.preventDefault(); this.value = eingaben[--eingabePos]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); eingabePos = Math.min(eingaben.length, eingabePos + 1); this.value = eingaben[eingabePos] || ''; }
  });

  // ---------------------------------------------------------------- Inspektor
  var inspektorAn = false;
  function setzeInspektor(an) {
    inspektorAn = an;
    ['b-inspektor', 'v-inspektor'].forEach(function (id) { $(id).setAttribute('aria-pressed', String(an)); });
    $('f-vorschau').classList.toggle('inspektor', an);
    $('s-inspektor').hidden = !an;
    anVorschau({ typ: 'inspektor', an: an });
    if (an) toast('Inspektor an: Fahre mit der Maus über die Vorschau und klicke auf ein Element. Esc beendet.');
  }
  $('b-inspektor').addEventListener('click', function () { setzeInspektor(!inspektorAn); });
  $('v-inspektor').addEventListener('click', function () { setzeInspektor(!inspektorAn); });

  // ---------------------------------------------------------------- Tastenkürzel
  function taste(t) {
    if (t === 'speichern') speichere(true);
    else if (t === 'ausfuehren') aktualisiere();
    else if (t === 'inspektor') setzeInspektor(!inspektorAn);
    else if (t === 'inspektor-aus') setzeInspektor(false);
  }
  document.addEventListener('keydown', function (e) {
    var strg = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (!$('dialog').hidden) return;
    if (strg && e.shiftKey && k === 'c') { e.preventDefault(); taste('inspektor'); }
    else if (strg && !e.shiftKey && k === 's') { e.preventDefault(); taste('speichern'); }
    else if (strg && k === 'enter') { e.preventDefault(); taste('ausfuehren'); }
    else if (strg && e.shiftKey && k === 'e') { e.preventDefault(); zeigeSeitenleiste(ansicht.seitenleiste === 'explorer' ? null : 'explorer'); }
    else if (k === 'escape' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
      if (arbeit.dataset.voll) setzeVoll(null);
      else if (inspektorAn) setzeInspektor(false);
    }
  });

  // ---------------------------------------------------------------- Anordnung, Splitter, Vollbild
  var schmal = false;
  function layout() { return schmal ? 'ueber' : ansicht.layout; }
  function wendeLayoutAn() {
    var l = layout();
    arbeit.dataset.layout = l;
    $('trenner').setAttribute('aria-orientation', l === 'neben' ? 'vertical' : 'horizontal');
    var b = $('b-layout');
    setzeIcon(b.querySelector('.hs-i'), ansicht.layout === 'neben' ? 'ueber' : 'neben');
    b.disabled = schmal;
    b.title = schmal ? 'Auf schmalen Bildschirmen stehen Vorschau und Editor immer übereinander' : ansicht.layout === 'neben' ? 'Übereinander anordnen' : 'Nebeneinander anordnen';
    setzeAufteilung(ansicht.aufteilung[l]);
  }
  function setzeAufteilung(prozent) {
    var l = layout(), r = arbeit.getBoundingClientRect();
    var gesamt = l === 'neben' ? r.width : r.height;
    var min = gesamt > 0 ? Math.min(45, (l === 'neben' ? 180 : 120) / gesamt * 100) : 15;
    var p = Math.max(min, Math.min(100 - min, +prozent || 50));
    arbeit.style.setProperty('--hs-a', 'calc(' + p.toFixed(2) + '% - 2.5px)');
    $('trenner').setAttribute('aria-valuenow', String(Math.round(p)));
    ansicht.aufteilung[l] = Math.round(p * 10) / 10;
  }
  (function splitter() {
    var t = $('trenner');
    function ausZeiger(e) {
      var r = arbeit.getBoundingClientRect();
      setzeAufteilung(layout() === 'neben' ? (e.clientX - r.left) / r.width * 100 : (e.clientY - r.top) / r.height * 100);
    }
    t.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      t.setPointerCapture(e.pointerId);
      arbeit.classList.add('zieht');
      function bew(ev) { ausZeiger(ev); }
      function los() { arbeit.classList.remove('zieht'); t.removeEventListener('pointermove', bew); t.removeEventListener('pointerup', los); t.removeEventListener('pointercancel', los); merkeAnsicht(); editor.neuZeichnen(); }
      t.addEventListener('pointermove', bew); t.addEventListener('pointerup', los); t.addEventListener('pointercancel', los);
    });
    t.addEventListener('dblclick', function () { setzeAufteilung(50); merkeAnsicht(); toast('Aufteilung 50 : 50'); });
    t.addEventListener('keydown', function (e) {
      var l = layout(), p = ansicht.aufteilung[l], neu = null;
      if ((l === 'neben' && e.key === 'ArrowLeft') || (l === 'ueber' && e.key === 'ArrowUp')) neu = p - 2;
      else if ((l === 'neben' && e.key === 'ArrowRight') || (l === 'ueber' && e.key === 'ArrowDown')) neu = p + 2;
      else if (e.key === 'Home') neu = 0; else if (e.key === 'End') neu = 100; else if (e.key === 'Enter') neu = 50;
      if (neu === null) return;
      e.preventDefault(); setzeAufteilung(neu); merkeAnsicht();
    });
  })();
  $('b-layout').addEventListener('click', function () { ansicht.layout = ansicht.layout === 'neben' ? 'ueber' : 'neben'; wendeLayoutAn(); merkeAnsicht(); });
  function setzeVoll(welches) {
    if (welches) arbeit.dataset.voll = welches; else delete arbeit.dataset.voll;
    [['v-voll', 'vorschau'], ['e-voll', 'editor']].forEach(function (x) {
      var b = $(x[0]), an = welches === x[1];
      b.setAttribute('aria-pressed', String(an));
      setzeIcon(b.querySelector('.hs-i'), an ? 'vollAus' : 'voll');
      b.title = an ? 'Vollbild beenden (Esc)' : (x[1] === 'vorschau' ? 'Vorschau im Vollbild' : 'Editor im Vollbild');
    });
    editor.neuZeichnen();
  }
  $('v-voll').addEventListener('click', function () { setzeVoll(arbeit.dataset.voll === 'vorschau' ? null : 'vorschau'); });
  $('e-voll').addEventListener('click', function () { setzeVoll(arbeit.dataset.voll === 'editor' ? null : 'editor'); });
  if (window.ResizeObserver) new ResizeObserver(function () {
    var war = schmal;
    schmal = document.documentElement.clientWidth < 700;
    if (war !== schmal) wendeLayoutAn(); else setzeAufteilung(ansicht.aufteilung[layout()]);
  }).observe(document.body);

  // ---------------------------------------------------------------- Seitenleiste und Einstellungen
  function zeigeSeitenleiste(welche) {
    app.dataset.seite = welche ? 'auf' : 'zu';
    $('p-explorer').hidden = welche !== 'explorer';
    $('p-einstellungen').hidden = welche !== 'einstellungen';
    $('a-explorer').setAttribute('aria-pressed', String(welche === 'explorer'));
    $('a-einstellungen').setAttribute('aria-pressed', String(welche === 'einstellungen'));
    if (!schmalSeite()) { ansicht.seitenleiste = welche || ''; merkeAnsicht(); }
    editor.neuZeichnen();
    setTimeout(function () { setzeAufteilung(ansicht.aufteilung[layout()]); }, 0);
  }
  function schmalSeite() { return document.documentElement.clientWidth <= 760; }
  $('a-explorer').addEventListener('click', function () { zeigeSeitenleiste(this.getAttribute('aria-pressed') === 'true' ? null : 'explorer'); });
  $('a-einstellungen').addEventListener('click', function () { zeigeSeitenleiste(this.getAttribute('aria-pressed') === 'true' ? null : 'einstellungen'); });
  arbeit.addEventListener('pointerdown', function () { if (schmalSeite() && app.dataset.seite === 'auf') zeigeSeitenleiste(null); });

  function wendeEinstellungenAn() {
    document.body.dataset.thema = ansicht.thema;
    setzeIcon($('b-thema').querySelector('.hs-i'), ansicht.thema === 'dunkel' ? 'sonne' : 'mond');
    $('b-thema').title = ansicht.thema === 'dunkel' ? 'Helles Design' : 'Dunkles Design';
    editor.einstellungen({ schrift: ansicht.schrift, tab: ansicht.tab, minimap: ansicht.minimap, autoSchliessen: ansicht.autoSchliessen });
    editor.neuZeichnen();
    $('e-thema').value = ansicht.thema; $('e-schrift').value = ansicht.schrift; $('e-schrift-wert').textContent = ansicht.schrift;
    $('e-tab').value = String(ansicht.tab); $('e-minimap').checked = ansicht.minimap; $('e-schliessen').checked = ansicht.autoSchliessen;
    $('e-auto').checked = ansicht.auto; $('e-mitlaufen').checked = ansicht.mitlaufen; $('e-leeren').checked = ansicht.leeren;
    $('b-auto').setAttribute('aria-pressed', String(ansicht.auto));
    $('s-tab').textContent = 'Leerzeichen: ' + ansicht.tab;
  }
  function einstellung(k, v) { ansicht[k] = v; merkeAnsicht(); wendeEinstellungenAn(); }
  $('b-thema').addEventListener('click', function () { einstellung('thema', ansicht.thema === 'dunkel' ? 'hell' : 'dunkel'); });
  $('e-thema').addEventListener('change', function () { einstellung('thema', this.value); });
  $('e-schrift').addEventListener('input', function () { einstellung('schrift', +this.value); });
  $('e-tab').addEventListener('change', function () { einstellung('tab', +this.value); });
  $('e-minimap').addEventListener('change', function () { einstellung('minimap', this.checked); });
  $('e-schliessen').addEventListener('change', function () { einstellung('autoSchliessen', this.checked); });
  $('e-mitlaufen').addEventListener('change', function () { einstellung('mitlaufen', this.checked); if (!this.checked) anVorschau({ typ: 'zeige', start: null }); });
  $('e-leeren').addEventListener('change', function () { einstellung('leeren', this.checked); });
  function setzeAuto(an) { einstellung('auto', an); if (an) aktualisiere(); toast(an ? 'Die Vorschau aktualisiert sich beim Tippen.' : 'Auto-Aktualisierung aus: Klicke auf „Ausführen“ (Strg+Eingabe).'); }
  $('e-auto').addEventListener('change', function () { setzeAuto(this.checked); });
  $('b-auto').addEventListener('click', function () { setzeAuto(!ansicht.auto); });
  $('b-ausfuehren').addEventListener('click', aktualisiere);
  $('v-neu').addEventListener('click', aktualisiere);
  $('v-trotzdem').addEventListener('click', aktualisiere);
  $('seite-wahl').addEventListener('change', function () { seite = this.value; aktualisiere(); });
  $('e-format').addEventListener('click', function () { editor.formatieren(); editor.fokus(); });
  $('e-suche').addEventListener('click', function () { editor.suchen(false); });

  // ---------------------------------------------------------------- Zurücksetzen, ZIP, Datei öffnen
  $('b-reset').addEventListener('click', function () {
    bestaetige('Projekt zurücksetzen?', 'Alle Dateien von „' + esc(projekt().name) + '“ werden durch die Startvorlage ersetzt. Deine Änderungen gehen verloren.', 'Zurücksetzen').then(function (ok) {
      if (!ok) return;
      var p = projekt(), v = HS.vorlage('beispiel');
      p.dateien.forEach(function (d) { editor.vergiss(d.name); });
      p.dateien = v.dateien; p.offen = v.offen; p.aktiv = v.aktiv;
      seite = 'index.html'; scrollPos = {};
      oeffneDatei(p.aktiv); speichere(); aktualisiere();
      toast('Projekt zurückgesetzt.');
    });
  });
  function dateiname(s) { return (s || 'projekt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'projekt'; }
  function herunterladen(bytes, name, typ) {
    var url = URL.createObjectURL(new Blob([bytes], { type: typ }));
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
  $('b-zip').addEventListener('click', function () {
    speichere();
    herunterladen(HS.projektAlsZip(projekt()), dateiname(projekt().name) + '.zip', 'application/zip');
    toast('ZIP-Datei wird heruntergeladen.');
  });
  $('b-oeffnen').addEventListener('click', function () { $('datei-eingabe').click(); });
  $('datei-eingabe').addEventListener('change', function () {
    var liste = Array.prototype.slice.call(this.files || []);
    this.value = '';
    oeffneDateien(liste);
  });
  function liesDatei(f) {
    return new Promise(function (ok, fehler) {
      var r = new FileReader();
      r.onload = function () { ok(r.result); }; r.onerror = function () { fehler(r.error); };
      if (/\.zip$/i.test(f.name)) r.readAsArrayBuffer(f);
      else if (HS.dateiArt(f.name).bild) r.readAsDataURL(f);
      else r.readAsText(f);
    });
  }
  function oeffneDateien(liste) {
    var zip = liste.filter(function (f) { return /\.zip$/i.test(f.name); })[0];
    if (zip) {
      liesDatei(zip).then(function (ab) { return HS.zipLesen(new Uint8Array(ab)); }).then(function (eintraege) {
        var dateien = HS.zipAlsDateien(eintraege);
        var p = HS.pruefeProjekt({ name: zip.name.replace(/\.zip$/i, ''), dateien: dateien, offen: [] });
        if (!p) { toast('In der ZIP-Datei sind keine passenden Dateien (.html, .css, .js, Bilder).'); return; }
        p.name = eindeutigerName(p.name);
        p.offen = p.dateien.filter(function (d) { return !HS.dateiArt(d.name).bild; }).slice(0, 4).map(function (d) { return d.name; });
        daten.projekte.push(p);
        wechsleProjekt(p.id);
        toast('ZIP als neues Projekt „' + p.name + '“ geöffnet (' + p.dateien.length + ' Dateien).');
      }).catch(function (e) { toast('Die ZIP-Datei konnte nicht gelesen werden. ' + (e && e.message ? e.message : '')); });
      return;
    }
    var kette = Promise.resolve();
    liste.forEach(function (f) {
      kette = kette.then(function () { return fuegeHinzu(f); });
    });
    kette.then(function () { zeigeDateien(); speichere(); aktualisiere(); });
  }
  function fuegeHinzu(f) {
    var name = f.name.replace(/\s+/g, '-');
    var art = HS.dateiArt(name);
    if (!art.erlaubt) { toast('„' + f.name + '“ kann die Sandbox nicht öffnen. Erlaubt: .html, .css, .js, .svg, .txt, Bilder und .zip.'); return Promise.resolve(); }
    if (f.size > (art.bild ? 300 : 400) * 1024) { toast('„' + f.name + '“ ist zu groß (höchstens ' + (art.bild ? 300 : 400) + ' KB).'); return Promise.resolve(); }
    return liesDatei(f).then(function (inhalt) {
      var vorhanden = datei(name);
      var frage = Promise.resolve('hinzufuegen');
      if (/\.html?$/i.test(name) && name !== 'index.html' && datei('index.html')) {
        frage = dialog({ titel: 'HTML-Datei öffnen', html: '<p>Wie möchtest du „' + esc(name) + '“ öffnen?</p>',
          knoepfe: [{ text: 'Abbrechen', wert: null }, { text: 'Als ' + name + ' hinzufügen', wert: 'hinzufuegen' }, { text: 'Als index.html (ersetzt sie)', wert: 'index', art: 'primaer' }] });
      } else if (vorhanden) {
        frage = dialog({ titel: 'Datei ersetzen?', html: '<p>„' + esc(name) + '“ gibt es schon im Projekt. Soll sie ersetzt werden?</p>', knoepfe: [{ text: 'Abbrechen', wert: null }, { text: 'Ersetzen', wert: 'hinzufuegen', art: 'gefahr' }] });
      }
      return frage.then(function (wahl) {
        if (!wahl) return;
        if (wahl === 'index') name = 'index.html';
        var fehler = HS.pruefeName(name, []);
        if (fehler) { toast('„' + f.name + '“: ' + fehler); return; }
        var d = datei(name);
        if (d) { d.inhalt = inhalt; editor.vergiss(name); }
        else {
          if (projekt().dateien.length >= HS.MAX_DATEIEN) { toast('Ein Projekt kann höchstens ' + HS.MAX_DATEIEN + ' Dateien haben.'); return; }
          projekt().dateien.push({ name: name, inhalt: inhalt });
        }
        oeffneDatei(name);
        toast('„' + name + '“ geöffnet.');
      });
    }, function () { toast('„' + f.name + '“ konnte nicht gelesen werden.'); });
  }
  // Dateien in den Editor ziehen
  app.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); });
  app.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault(); oeffneDateien(Array.prototype.slice.call(e.dataTransfer.files));
  });

  // ---------------------------------------------------------------- Teilen-Link
  // Die äußere Seite (Lernseite /sandbox/html bzw. Testseite #/sandbox/html) – nur lesbar, wenn gleiche Herkunft
  function aussen() {
    try {
      if (window.parent === window) return null;
      var l = window.parent.location; void l.href;
      return { testseite: /^#\//.test(l.hash), l: l };
    } catch (e) { return null; }
  }
  function teilenBasis() {
    var a = aussen();
    if (a && a.testseite) return a.l.href.split('#')[0] + a.l.hash.split('?')[0] + '?code=';
    if (a) return a.l.href.split('#')[0] + '#code=';
    return location.href.split('#')[0] + '#code=';
  }
  $('b-teilen').addEventListener('click', function () {
    speichere();
    HS.teilenKodieren(projekt()).then(function (code) {
      var url = teilenBasis() + code;
      dialog({ titel: 'Teilen-Link', html:
        '<p>Der ganze Code von „' + esc(projekt().name) + '“ steckt in diesem Link. Wer ihn öffnet, bekommt eine eigene Kopie als neues Projekt – dein Projekt bleibt unverändert. Lehrkräfte können so Aufgaben mit Startcode verteilen.</p>' +
        '<p style="display:flex;gap:6px"><input type="text" id="teilen-link" readonly value="' + esc(url) + '" aria-label="Teilen-Link"><button type="button" class="hs-knopf" data-kopieren="teilen-link">Kopieren</button></p>' +
        '<p class="hs-k-tipp">' + url.length.toLocaleString('de-DE') + ' Zeichen.' + (url.length > 8000 ? ' <strong>Der Link ist sehr lang.</strong> Manche Programme kürzen lange Links – lade dann lieber eine ZIP-Datei herunter.' : '') + ' Der Code steht hinter dem #-Zeichen und wird nicht an den Server geschickt.</p>',
        knoepfe: [{ text: 'Schließen', wert: true, art: 'primaer' }] });
      setTimeout(function () { var f = $('teilen-link'); if (f) { f.focus(); f.select(); } }, 30);
    }).catch(function () { toast('Der Link konnte nicht erzeugt werden.'); });
  });
  function codeAusAdresse() {
    var quellen = [location.hash], a = aussen();
    if (a) quellen.push(a.l.hash);
    for (var i = 0; i < quellen.length; i++) { var m = /[#?&]code=([A-Za-z0-9._-]+)/.exec(quellen[i] || ''); if (m) return m[1]; }
    return null;
  }
  function adresseAufraeumen() {
    try { if (/code=/.test(location.hash)) history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* egal */ }
    var a = aussen();
    if (a && /code=/.test(a.l.hash)) {
      try { window.parent.history.replaceState(null, '', a.l.href.split('#')[0] + (a.testseite ? a.l.hash.split('?')[0] : '')); } catch (e) { /* egal */ }
    }
  }
  function ladeGeteilt(code) {
    return HS.teilenDekodieren(code).then(function (p) {
      adresseAufraeumen();
      var gleich = daten.projekte.filter(function (x) {
        return x.dateien.length === p.dateien.length && x.dateien.every(function (d) { return p.dateien.some(function (y) { return y.name === d.name && y.inhalt === d.inhalt; }); });
      })[0];
      if (gleich) { wechsleProjekt(gleich.id); toast('Dieses geteilte Projekt hast du schon: „' + gleich.name + '“.'); return; }
      p.id = HS.neueId();
      p.name = eindeutigerName('Geteilt: ' + p.name);
      p.offen = p.dateien.filter(function (d) { return !HS.dateiArt(d.name).bild; }).slice(0, 4).map(function (d) { return d.name; });
      if (p.offen.indexOf(p.aktiv) < 0) p.offen.unshift(p.aktiv);
      daten.projekte.push(p);
      wechsleProjekt(p.id);
      toast('Geteiltes Projekt geladen: „' + p.name + '“. Deine anderen Projekte findest du im Explorer.');
    }, function () {
      adresseAufraeumen();
      aktualisiere();
      toast('Der Teilen-Link ist unvollständig oder beschädigt. Bitte den ganzen Link kopieren.');
    });
  }

  // ---------------------------------------------------------------- Hilfe
  function hilfe() {
    dialog({ titel: 'Hilfe zur HTML-Sandbox', html:
      '<p>Rechts schreibst du HTML, CSS und JavaScript, links siehst du sofort das Ergebnis. Alles bleibt in deinem Browser gespeichert.</p>' +
      '<h3>Inspektor: vom Ergebnis zum Code</h3>' +
      '<p>Schalte den <strong>Inspektor</strong> ein (Pfeil-Knopf oder <kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>C</kbd>). Fährst du dann mit der Maus über die Vorschau, zeigt ein Rahmen das Element mit seinem Namen (z. B. <code>div.box</code>) und den CSS-Regeln, die dafür gelten. Ein Klick springt im Editor genau zu dem Code, der dieses Element erzeugt – Links und Knöpfe lösen dabei nichts aus. <kbd>Esc</kbd> beendet den Inspektor.</p>' +
      '<p>Ohne Inspektor verhält sich die Seite normal. Mit <kbd>Alt</kbd>+Klick springst du trotzdem zum Code. Unter der Vorschau kannst du danach direkt zu den passenden CSS-Regeln springen.</p>' +
      '<p>Umgekehrt: Steht der Cursor im Editor in einem Element oder einer CSS-Regel, wird das Element in der Vorschau gestrichelt markiert. Elemente, die erst per JavaScript entstehen, haben keinen eigenen Code – dann springt der Editor zum nächsten Elternelement.</p>' +
      '<h3>Tastenkürzel</h3><table>' +
      [['Strg+S', 'Speichern (passiert auch automatisch)'], ['Strg+Eingabe', 'Vorschau neu ausführen'], ['Strg+Umschalt+C', 'Inspektor an/aus'], ['Alt+Klick in der Vorschau', 'zum Code springen'],
        ['Tab', 'Emmet-Abkürzung ausklappen, z. B. <code>ul>li*3</code>, <code>div.box>h2+p</code> oder <code>!</code> für das Grundgerüst'], ['Strg+Leertaste', 'Vorschläge anzeigen'],
        ['Umschalt+Alt+F', 'Code formatieren'], ['Strg+F / Strg+H', 'Suchen / Ersetzen'], ['Strg+Z / Strg+Y', 'Rückgängig / Wiederholen'], ['Strg+# / Strg+/', 'Zeile(n) aus- oder einkommentieren'],
        ['Alt+↑ / Alt+↓', 'Zeile verschieben'], ['Umschalt+Alt+↓', 'Zeile verdoppeln'], ['Umschalt+Tab', 'Einrückung verringern'], ['Esc, dann Tab', 'Editor mit der Tastatur verlassen']]
        .map(function (z) { return '<tr><td><kbd>' + z[0].split(' / ').join('</kbd> / <kbd>').replace(/\+(?!Klick)/g, '</kbd>+<kbd>') + '</kbd></td><td>' + z[1] + '</td></tr>'; }).join('') +
      '</table>' +
      '<h3>Gut zu wissen</h3><ul>' +
      '<li>Die Vorschau ist abgeschottet: Dein Code kann die Lernseite nicht verändern, Links zu anderen Seiten öffnen sich nicht und Formulare werden nicht wirklich abgeschickt.</li>' +
      '<li><code>console.log()</code> und Fehler erscheinen unten in der Konsole. Ein Klick auf <em>datei:zeile</em> springt zur Stelle. In der Zeile mit › kannst du JavaScript direkt in der Vorschau ausführen.</li>' +
      '<li>Eine Schleife, die länger als 1,5 Sekunden läuft, wird abgebrochen, damit nichts einfriert.</li>' +
      '<li>„Teilen“ erzeugt einen Link, in dem der ganze Code steckt. „ZIP“ lädt das Projekt herunter, „Öffnen“ lädt Dateien oder eine ZIP-Datei.</li>' +
      '</ul>', knoepfe: [{ text: 'Verstanden', wert: true, art: 'primaer' }] });
  }
  $('b-hilfe').addEventListener('click', hilfe);
  $('a-hilfe').addEventListener('click', hilfe);

  // ---------------------------------------------------------------- Rückweg zur Sandbox (wie in den anderen Laboren)
  (function pfadSandbox() {
    var a = aussen(), link = $('pfad-sandbox');
    if (!a) { link.href = '../../sandbox'; link.removeAttribute('target'); return; }
    link.href = a.testseite ? a.l.pathname + '#/sandbox' : '/sandbox';
    var zurueck = null;
    try { zurueck = window.parent.document.querySelector('.lesson-bar a.back'); } catch (e) { /* fremde Seite */ }
    if (!zurueck) { var span = document.createElement('span'); span.textContent = link.textContent; link.replaceWith(span); return; }
    link.removeAttribute('target');
    link.addEventListener('click', function (e) { e.preventDefault(); zurueck.click(); });
  })();

  // ---------------------------------------------------------------- Start
  schmal = document.documentElement.clientWidth < 700;
  wendeEinstellungenAn();
  wendeLayoutAn();
  zeigeKonsole(ansicht.konsole);
  zeigeSeitenleiste(schmalSeite() ? null : (ansicht.seitenleiste || null));
  leereKonsole();
  var p0 = projekt();
  if (!p0.aktiv || !datei(p0.aktiv)) p0.aktiv = p0.dateien[0].name;
  oeffneDatei(p0.aktiv, true);
  zeigeDateien();
  $('s-speicher').textContent = '✓ Gespeichert';
  var geteilt = codeAusAdresse();
  var haengt = null;
  try { haengt = localStorage.getItem(LAUF); } catch (e) { /* egal */ }
  if (geteilt) ladeGeteilt(geteilt);
  else if (haengt) {                                                // letzter Lauf ist nicht fertig geworden
    pausiert = true;
    $('angehalten').hidden = false;
    try { localStorage.removeItem(LAUF); } catch (e) { /* egal */ }
  } else aktualisiere();
})(typeof window !== 'undefined' ? window : this);
