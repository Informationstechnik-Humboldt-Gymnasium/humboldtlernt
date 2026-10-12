// Logik-Labor · Oberfläche. Verbindet Modell (modell.js), Engine (simulation.js), Wahrheitstabelle (wahrheit.js),
// Darstellung (zeichnen.js) und die gemeinsame Bedienung des Schaltkreis-Labors (../sandbox-schaltkreis/bedienung.js).
(function () {
  'use strict';
  var SL = window.SL, M = SL.modell;
  var SPEICHER = 'logik-labor:v1';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var st = { doc: M.neu(), auswahl: null, verlauf: [], zukunft: [], erg: null, zustand: {}, t: 0, laeuft: true, tabEin: null, tabAus: null };
  var svg = $('flaeche'), welt = $('welt'), raster = $('raster'), box = $('flaeche-box');

  // ---------------------------------------------------------------- Zustand

  function knoepfe() { $('rueck').disabled = !st.verlauf.length; $('vor').disabled = !st.zukunft.length; }
  function merke(vorher) {
    st.verlauf.push(JSON.stringify(vorher || st.doc));
    if (st.verlauf.length > 100) st.verlauf.shift();
    st.zukunft = [];
    knoepfe();
  }
  function rechne() {
    st.erg = SL.sim.auswerten(st.doc, { t: st.t, vorher: st.zustand });
    st.zustand = SL.sim.zustand(st.erg);
  }
  function gueltigeAuswahl() {
    var a = st.auswahl;
    if (!a) return;
    if (a.art === 'mehrere') { a.ids = a.ids.filter(function (id) { return M.finde(st.doc, id); }); if (!a.ids.length) st.auswahl = null; }
    else if (!(a.art === 'bauteil' ? M.finde(st.doc, a.id) : M.findeDraht(st.doc, a.id))) st.auswahl = null;
  }
  function geaendert(art) {
    rechne();
    var vorher = JSON.stringify(st.auswahl);
    gueltigeAuswahl();
    zeichne();
    if (vorher !== JSON.stringify(st.auswahl)) eigenschaften(); else werte();
    if (art !== 'bewegen') tabelle();
    meldungen();
    speichere();
    $('takt').disabled = !hatTakt();
    starteTakt();
  }
  function waehle(sel) {
    var alt = JSON.stringify(st.auswahl);
    st.auswahl = sel;
    if (alt !== JSON.stringify(sel)) { eigenschaften(); zeichne(); }
  }
  function speichere() { try { localStorage.setItem(SPEICHER, M.exportiere(st.doc)); } catch (e) { /* kein Speicher */ } }
  function neuesDoc(doc, einpassen) {
    st.doc = doc; st.auswahl = null; st.zustand = {}; st.tabEin = null; st.tabAus = null;
    geaendert(); eigenschaften();
    if (einpassen) bed.einpassen();
  }

  // ---------------------------------------------------------------- Bedienung (gemeinsam mit dem Schaltkreis-Labor)

  var bed = new SL.Bedienung({
    doc: function () { return st.doc; }, merke: merke, geaendert: geaendert, zeige: zeichne, auswahl: waehle, meldung: toast,
    gruppe: function (id) { return st.auswahl && st.auswahl.art === 'mehrere' && st.auswahl.ids.indexOf(id) >= 0 ? st.auswahl.ids.slice() : null; },
    halten: function (id, an) { var b = M.finde(st.doc, id); if (b) { b.werte.gedrueckt = an ? 1 : 0; geaendert('halten'); } },
  });
  function punkt(e) {
    var r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    return { id: e.pointerId, x: x, y: y, typ: e.pointerType || 'mouse', taste: e.button, drin: x >= 0 && y >= 0 && x <= r.width && y <= r.height };
  }
  var leisteAktiv = null;
  svg.addEventListener('pointerdown', function (e) { if (e.button > 0) return; e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (x) { /* egal */ } bed.runter(punkt(e)); });
  svg.addEventListener('pointermove', function (e) { if (!leisteAktiv) bed.bewegen(punkt(e)); });
  svg.addEventListener('pointerup', function (e) { if (!leisteAktiv) bed.hoch(punkt(e)); });
  svg.addEventListener('pointercancel', function (e) { if (!leisteAktiv) bed.abbrechen(punkt(e)); });
  svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && bed.hover && !bed.anzahl()) { bed.hover = null; zeichne(); } });
  svg.addEventListener('wheel', function (e) { e.preventDefault(); bed.zoomUm(punkt(e), Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004)); }, { passive: false });
  svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Bauteilbibliothek nach Kategorien
  $('leiste').innerHTML = SL.KATEGORIEN.map(function (k) {
    return '<h3>' + esc(k) + '</h3>' + Object.keys(SL.TYPEN).filter(function (t) { return SL.TYPEN[t].kategorie === k; }).map(function (typ) {
      var T = SL.TYPEN[typ], tip = T.hilfe || (SL.GATTER[typ] ? SL.GATTER[typ].regel : '');
      return '<button type="button" class="teil" data-typ="' + typ + '" title="' + esc(T.name + (tip ? ' – ' + tip : '') + ' (ziehen oder antippen)') + '">' + SL.zeichnen.symbol(typ) + '<span>' + esc(T.name.replace('-Gatter', '')) + '</span></button>';
    }).join('');
  }).join('');
  $('leiste').addEventListener('pointerdown', function (e) { var b = e.target.closest('.teil'); if (!b || e.button > 0) return; leisteAktiv = e.pointerId; bed.leisteRunter(b.dataset.typ, punkt(e)); });
  document.addEventListener('pointermove', function (e) { if (leisteAktiv === e.pointerId) bed.bewegen(punkt(e)); });
  document.addEventListener('pointerup', function (e) { if (leisteAktiv === e.pointerId) { leisteAktiv = null; bed.hoch(punkt(e)); } });
  document.addEventListener('pointercancel', function (e) { if (leisteAktiv === e.pointerId) { leisteAktiv = null; bed.abbrechen(punkt(e)); } });
  $('leiste').addEventListener('click', function (e) { var b = e.target.closest('.teil'); if (b && e.detail === 0) { var p = bed.freierPlatz(b.dataset.typ); bed.fuegeEin(b.dataset.typ, p.x, p.y); } });

  // ---------------------------------------------------------------- Zeichnen und Takt

  var groesse = { w: 600, h: 400 };
  function zeichne() {
    var v = bed.view, w = groesse.w / v.s, h = groesse.h / v.s;
    svg.setAttribute('viewBox', [v.x, v.y, w, h].map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
    raster.setAttribute('x', v.x); raster.setAttribute('y', v.y); raster.setAttribute('width', w); raster.setAttribute('height', h);
    welt.innerHTML = SL.zeichnen.szene({ doc: st.doc, erg: st.erg, auswahl: st.auswahl, vorschau: bed.vorschau, hover: bed.hover });
    var h0 = bed.hover;
    svg.style.cursor = h0 && h0.art === 'anschluss' ? 'crosshair' : h0 ? 'pointer' : 'default';
    $('leer').hidden = st.doc.bauteile.length > 0;
  }
  if (window.ResizeObserver) new ResizeObserver(function () { groesse = { w: box.clientWidth || 600, h: box.clientHeight || 400 }; bed.groesse = groesse; zeichne(); }).observe(box);
  groesse = { w: box.clientWidth || 600, h: box.clientHeight || 400 };
  bed.groesse = groesse;

  var taktLauf = null, letzte = null;
  var hatTakt = function () { return st.doc.bauteile.some(function (b) { return b.typ === 'takt'; }); };
  function takt(zeit) {
    var dt = letzte == null ? 0 : Math.min(0.1, (zeit - letzte) / 1000);
    letzte = zeit;
    st.t += dt;
    var alt = JSON.stringify(st.erg.aus);
    rechne();
    if (JSON.stringify(st.erg.aus) !== alt) { zeichne(); werte(); markiereZeile(); }
    taktLauf = st.laeuft && hatTakt() ? requestAnimationFrame(takt) : null;
    if (!taktLauf) letzte = null;
  }
  function starteTakt() { if (!taktLauf && st.laeuft && hatTakt()) taktLauf = requestAnimationFrame(takt); }

  // ---------------------------------------------------------------- Meldungen

  var toastZeit = null;
  function toast(text, art) {
    var t = $('toast');
    t.textContent = text; t.className = 'toast zeigen ' + (art || '');
    clearTimeout(toastZeit);
    toastZeit = setTimeout(function () { t.className = 'toast'; }, art === 'fehler' ? 5000 : 3000);
  }
  function meldungen() {
    $('meldungen').innerHTML = st.erg.meldungen.map(function (m) { return '<li class="' + m.art + '">' + esc(m.text) + '</li>'; }).join('') ||
      '<li class="ok">Die Schaltung wird laufend berechnet. Schalte die Eingänge um und beobachte die Ausgänge.</li>';
  }

  // ---------------------------------------------------------------- Eigenschaften

  function farbwahl(feld, liste, aktuell, titel) {
    return '<div class="farbwahl" role="group" aria-label="' + esc(titel) + '"><span>' + esc(titel) + '</span><div class="felder">' +
      liste.map(function (f) {
        return '<button type="button" class="farbe' + (f[0] ? '' : ' standard') + '" data-feld="' + feld + '" data-farbe="' + f[0] + '" title="' + esc(f[1]) + '" aria-label="' + esc(f[1]) + '" aria-pressed="' + (aktuell === f[0]) + '"' + (f[0] ? ' style="background:' + f[0] + '"' : '') + '></button>';
      }).join('') +
      '<label class="eigene" title="Eigene Farbe"><input type="color" data-feld="' + feld + '" value="' + (aktuell || '#888888') + '" aria-label="' + esc(titel) + ': eigene Farbe"></label></div></div>';
  }

  function eigenschaften() {
    var el = $('eig'), sel = st.auswahl, h = '';
    if (!sel) {
      var o = st.doc.optionen;
      el.innerHTML = '<p class="small muted">Tippe ein Bauteil oder eine Leitung an, um es einzustellen. Schalter schaltest du direkt auf der Arbeitsfläche um.</p>' +
        '<h3>Darstellung</h3>' + farbwahl('opt-aktiv', SL.FARBEN.leitung, o.aktiv || '', 'Farbe für 1 (aktiv)') + farbwahl('opt-inaktiv', SL.FARBEN.leitung, o.inaktiv || '', 'Farbe für 0 (inaktiv)') +
        '<label class="haken"><input type="checkbox" data-opt="pegel"' + (o.pegel !== false ? ' checked' : '') + '> 0 und 1 an den Anschlüssen zeigen</label>' +
        '<p class="small muted">Farben ändern nur die Darstellung, nie die Logik. Aktive Leitungen sind zusätzlich dicker.</p>';
      return;
    }
    if (sel.art === 'mehrere') {
      el.innerHTML = '<h3>' + sel.ids.length + ' Bauteile ausgewählt</h3><p class="small muted">Ziehe eines davon, um alle zu verschieben.</p>' +
        '<div class="row knoepfe"><button type="button" data-aktion="loeschen" class="gefahr">Alle löschen</button><button type="button" data-aktion="abwaehlen">Auswahl aufheben</button></div>';
      return;
    }
    if (sel.art === 'draht') {
      var d = M.findeDraht(st.doc, sel.id), b1 = M.finde(st.doc, d.von.b), b2 = M.finde(st.doc, d.nach.b);
      el.innerHTML = '<h3>Leitung</h3><p class="small">von <b>' + esc(b1.name) + '</b> (' + esc(M.anschlussName(b1, d.von.a)) + ')<br>nach <b>' + esc(b2.name) + '</b> (' + esc(M.anschlussName(b2, d.nach.a)) + ')</p>' +
        '<div class="readouts"><div class="readout"><b data-zeige="signal">–</b><span>Signal</span></div></div>' +
        farbwahl('draht', SL.FARBEN.leitung, d.farbe || '', 'Leitungsfarbe') +
        '<div class="row knoepfe"><button type="button" data-aktion="loeschen" class="gefahr">Leitung löschen</button></div>';
      werte();
      return;
    }
    var b = M.finde(st.doc, sel.id), T = SL.TYPEN[b.typ], w = b.werte;
    h += '<h3>' + esc(T.name) + '</h3>' +
      '<label class="ctrl"><span>Beschriftung</span><input type="text" maxlength="20" data-name value="' + esc(b.name) + '" aria-label="Beschriftung"></label>';
    if (T.hilfe) h += '<p class="small muted">' + esc(T.hilfe) + '</p>';
    switch (b.typ) {
      case 'schalter': h += '<div class="row"><button type="button" data-aktion="schalten" aria-pressed="false"></button></div>'; break;
      case 'takt':
        h += '<label class="ctrl"><span>Frequenz <output data-zeige="frequenz"></output></span><input type="range" min="0.2" max="5" step="0.1" data-wert="frequenz" aria-label="Frequenz in Hertz"></label>';
        break;
      case 'lampe':
        h += farbwahl('farbe', SL.FARBEN.leucht, w.farbe, 'Leuchtfarbe') + farbwahl('gehaeuse', SL.FARBEN.leitung, w.gehaeuse, 'Gehäusefarbe');
        break;
      case 'segment':
        h += farbwahl('farbe', SL.FARBEN.leucht, w.farbe, 'Segmentfarbe') +
          '<p class="small muted">Jedes Segment hat einen eigenen Eingang (a–g, dp). Angezeigt wird genau das, was an den Eingängen anliegt.</p>';
        break;
      case 'relais':
        h += '<p class="small muted">Modell: S = 1 zieht das Relais an. Dann gibt der Kontakt das Signal von COM an NO weiter, sonst an NC. Lege an COM z. B. eine Konstante 1 („Spannung“) an.</p>';
        break;
      case 'decoder': break;
      default:
        if (SL.GATTER[b.typ]) {
          var g = SL.GATTER[b.typ];
          h += '<p class="small"><b>' + esc(g.name) + ' (' + esc(g.en) + ', Symbol ' + esc(g.zeichen) + (g.negiert ? ' mit Kreis = Negation' : '') + '):</b> ' + esc(g.regel) + '</p>';
          if (b.typ !== 'nicht') h += '<label class="ctrl"><span>Anzahl der Eingänge</span><select data-wert="eingaenge">' + [2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option value="' + n + '"' + (n === w.eingaenge ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>';
        }
    }
    h += '<div class="readouts" data-zustand></div>';
    if (b.typ === 'segment') h += farbwahl('gehaeuse', SL.FARBEN.bauteil, w.gehaeuse, 'Gehäusefarbe');
    else if (b.typ !== 'lampe') h += farbwahl('farbe', SL.FARBEN.bauteil, w.farbe, 'Bauteilfarbe');
    h += '<div class="row knoepfe"><button type="button" data-aktion="drehen">⟳ Drehen</button><button type="button" data-aktion="loeschen" class="gefahr">Löschen</button></div>';
    el.innerHTML = h;
    werte();
  }

  /** Zustände im Eigenschaftenbereich nachführen. */
  function werte() {
    var el = $('eig'), sel = st.auswahl, r;
    if (!sel || sel.art === 'mehrere') return;
    if (sel.art === 'draht') { var x = el.querySelector('[data-zeige="signal"]'); if (x) x.textContent = st.erg.draehte[sel.id] ? '1' : '0'; return; }
    var b = M.finde(st.doc, sel.id); if (!b) return;
    r = st.erg.bauteile[b.id] || { ein: {}, aus: {} };
    var k = el.querySelector('[data-aktion="schalten"]');
    if (k) { k.textContent = b.werte.an ? 'EIN (1) – zum Ausschalten tippen' : 'AUS (0) – zum Einschalten tippen'; k.setAttribute('aria-pressed', String(!!b.werte.an)); }
    var f = el.querySelector('[data-wert="frequenz"]'); if (f && document.activeElement !== f) f.value = b.werte.frequenz;
    var fo = el.querySelector('[data-zeige="frequenz"]'); if (fo) fo.textContent = String(b.werte.frequenz).replace('.', ',') + ' Hz';
    var z = el.querySelector('[data-zustand]'); if (!z) return;
    var felder = [];
    var ps = M.pins(b);
    Object.keys(ps).forEach(function (a) { if (ps[a].art === 'ein' && b.typ !== 'segment') felder.push([ps[a].text || 'Eingang', r.ein[a]]); });
    Object.keys(ps).forEach(function (a) { if (ps[a].art === 'aus') felder.push([ps[a].text || 'Ausgang', r.aus[a]]); });
    if (b.typ === 'lampe') felder = [['Eingang', r.an], ['Lampe', r.an ? 'AN' : 'AUS']];
    if (b.typ === 'relais') felder.push(['Relais', r.angezogen ? 'angezogen' : 'Ruhe']);
    if (b.typ === 'segment') felder = [['zeigt', r.zeichen == null ? '?' : r.zeichen === '' ? 'aus' : r.zeichen], ['Segmente an', SL.SEGMENTE.concat(['dp']).filter(function (s) { return r.segmente && r.segmente[s]; }).join(' ') || '–']];
    if (b.typ === 'decoder') felder = [['Zahl', String((r.ein.d0 || 0) + 2 * (r.ein.d1 || 0) + 4 * (r.ein.d2 || 0) + 8 * (r.ein.d3 || 0))]];
    z.innerHTML = felder.map(function (x) { return '<div class="readout"><b>' + esc(x[1] === 1 || x[1] === 0 ? String(x[1]) : x[1]) + '</b><span>' + esc(x[0]) + '</span></div>'; }).join('');
  }

  $('eig').addEventListener('click', function (e) {
    var fb = e.target.closest('button[data-farbe]');
    if (fb) return setzeFarbe(fb.dataset.feld, fb.dataset.farbe);
    var k = e.target.closest('[data-aktion]'); if (!k) return;
    var a = k.dataset.aktion, b = st.auswahl && st.auswahl.art === 'bauteil' ? M.finde(st.doc, st.auswahl.id) : null;
    if (a === 'loeschen') loeschen();
    else if (a === 'abwaehlen') waehle(null);
    else if (a === 'drehen' && b) { merke(); M.drehen(st.doc, b.id); geaendert(); }
    else if (a === 'schalten' && b) { merke(); M.tippAktion(st.doc, b.id); geaendert(); }
  });
  $('eig').addEventListener('input', function (e) {
    var x = e.target;
    if (x.type === 'color') return setzeFarbe(x.dataset.feld, x.value, true);
    if (x.hasAttribute('data-name')) { var b = M.finde(st.doc, st.auswahl.id); if (!x._gemerkt) { merke(); x._gemerkt = true; } M.setzeName(st.doc, b.id, x.value || b.name); zeichne(); tabelle(); speichere(); return; }
    if (x.dataset.wert === 'frequenz') { if (!x._gemerkt) { merke(); x._gemerkt = true; } M.setzeWert(st.doc, st.auswahl.id, 'frequenz', Number(x.value)); geaendert(); }
  });
  $('eig').addEventListener('change', function (e) {
    var x = e.target; x._gemerkt = false;
    if (x.dataset.wert === 'eingaenge') {
      merke();
      var vorher = st.doc.draehte.length;
      M.setzeWert(st.doc, st.auswahl.id, 'eingaenge', Number(x.value));
      geaendert();
      if (st.doc.draehte.length < vorher) toast('Leitungen an weggefallenen Eingängen wurden entfernt.', 'hinweis');
    }
    if (x.dataset.opt === 'pegel') { merke(); st.doc.optionen.pegel = x.checked; geaendert(); }
    if (x.hasAttribute('data-name')) eigenschaften();
  });
  var farbeGemerkt = false;
  function setzeFarbe(feld, wert, fortlaufend) {
    if (!fortlaufend || !farbeGemerkt) merke();
    farbeGemerkt = !!fortlaufend;
    var sel = st.auswahl;
    if (feld === 'opt-aktiv') st.doc.optionen.aktiv = wert;
    else if (feld === 'opt-inaktiv') st.doc.optionen.inaktiv = wert;
    else if (feld === 'draht') { var d = M.findeDraht(st.doc, sel.id); if (wert) d.farbe = SL.FARBEN.pruefe(wert, undefined); else delete d.farbe; }
    else M.setzeWert(st.doc, sel.id, feld, wert);
    geaendert();
    if (!fortlaufend) eigenschaften();
  }

  // ---------------------------------------------------------------- Wahrheitstabelle

  function tabelle() {
    var t = SL.wahrheit.tabelle(st.doc, { eingaenge: st.tabEin, ausgaenge: st.tabAus });
    var k = t.kandidaten, h = '';
    if (t.fehler) h += '<p class="mm-meldung hinweis">' + esc(t.fehler) + '</p>';
    t.warnungen.forEach(function (w) { h += '<p class="mm-meldung warnung">' + esc(w) + '</p>'; });
    if (t.zeilen.length) {
      h += '<div class="tab-rahmen"><table class="wahrheit"><thead><tr>' + t.eingaenge.map(function (x) { return '<th>' + esc(x.name) + '</th>'; }).join('') +
        '<th class="trenn" aria-hidden="true"></th>' + t.ausgaenge.map(function (x) { return '<th class="aus" title="' + esc(x.art) + '">' + esc(x.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        t.zeilen.map(function (z, i) {
          return '<tr data-zeile="' + i + '"' + (i === t.aktuell ? ' class="aktiv"' : '') + '>' + z.ein.map(function (v) { return '<td>' + v + '</td>'; }).join('') +
            '<td class="trenn" aria-hidden="true"></td>' + z.aus.map(function (v) { return '<td class="aus">' + esc(v) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="small muted">' + t.zeilen.length + ' Zeilen = 2<sup>' + t.eingaenge.length + '</sup> Kombinationen. Markiert: aktuelle Schalterstellung. Berechnet mit derselben Simulation wie die Arbeitsfläche.</p>';
    }
    if (k.eingaenge.length || k.ausgaenge.length) {
      var ein = t.eingaenge.map(function (x) { return x.id; }), aus = t.ausgaenge.map(function (x) { return x.id; });
      h += '<details class="tab-wahl"><summary>Ein- und Ausgänge wählen</summary><div class="spalten"><fieldset><legend>Eingänge</legend>' +
        k.eingaenge.map(function (x) { return '<label class="haken"><input type="checkbox" data-tab="ein" value="' + x.id + '"' + (ein.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + '</label>'; }).join('') +
        '</fieldset><fieldset><legend>Ausgänge</legend>' +
        k.ausgaenge.map(function (x) { return '<label class="haken"><input type="checkbox" data-tab="aus" value="' + x.id + '"' + (aus.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">(' + esc(x.art) + ')</span></label>'; }).join('') +
        '</fieldset></div></details>';
    }
    var offen = $('tabelle').querySelector('details[open]');
    $('tabelle').innerHTML = h;
    if (offen) { var d = $('tabelle').querySelector('details'); if (d) d.open = true; }
    st.tabelleDaten = t;
  }
  function markiereZeile() {
    var t = st.tabelleDaten; if (!t || !t.zeilen.length) return;
    var takt = {};
    st.doc.bauteile.forEach(function (b) { if (b.typ === 'takt') takt[b.id] = st.erg.bauteile[b.id] ? st.erg.bauteile[b.id].q : 0; });
    var neu = SL.wahrheit.tabelle(st.doc, { eingaenge: t.eingaenge.map(function (x) { return x.id; }), ausgaenge: t.ausgaenge.map(function (x) { return x.id; }), takt: takt });
    $('tabelle').querySelectorAll('tr[data-zeile]').forEach(function (tr) { tr.classList.toggle('aktiv', Number(tr.dataset.zeile) === neu.aktuell); });
  }
  $('tabelle').addEventListener('change', function (e) {
    var x = e.target; if (!x.dataset.tab) return;
    var werteVon = function (art) { return [].map.call($('tabelle').querySelectorAll('input[data-tab="' + art + '"]:checked'), function (i) { return i.value; }); };
    st.tabEin = werteVon('ein'); st.tabAus = werteVon('aus');
    tabelle();
  });

  // ---------------------------------------------------------------- Werkzeugleiste

  function loeschen() {
    var sel = st.auswahl; if (!sel) return;
    var vorher = M.kopie(st.doc);
    if (!M.loesche(st.doc, sel)) return;
    merke(vorher); st.auswahl = null; geaendert(); eigenschaften();
    toast(sel.art === 'draht' ? 'Leitung gelöscht.' : sel.art === 'mehrere' ? sel.ids.length + ' Bauteile gelöscht.' : 'Bauteil mit seinen Leitungen gelöscht.', 'ok');
  }
  function rueckgaengig() {
    var alt = st.verlauf.pop(); if (!alt) return;
    st.zukunft.push(JSON.stringify(st.doc));
    st.doc = JSON.parse(alt); knoepfe(); geaendert(); eigenschaften();
  }
  function wiederholen() {
    var neu = st.zukunft.pop(); if (!neu) return;
    st.verlauf.push(JSON.stringify(st.doc));
    st.doc = JSON.parse(neu); knoepfe(); geaendert(); eigenschaften();
  }
  function allesWaehlen() {
    if (!st.doc.bauteile.length) return;
    waehle({ art: 'mehrere', ids: st.doc.bauteile.map(function (b) { return b.id; }) });
    toast('Alle Bauteile ausgewählt. Ziehen verschiebt alle, Entf löscht alle.', 'hinweis');
  }
  $('neu').addEventListener('click', function () {
    if (st.doc.bauteile.length && !confirm('Neues Projekt beginnen? Die aktuelle Schaltung wird geleert (Rückgängig ist möglich).')) return;
    merke(); neuesDoc(M.neu(), true); toast('Neues Projekt.', 'hinweis');
  });
  $('rueck').addEventListener('click', rueckgaengig);
  $('vor').addEventListener('click', wiederholen);
  $('alle').addEventListener('click', allesWaehlen);
  $('loeschen').addEventListener('click', function () { if (st.auswahl) loeschen(); else toast('Wähle zuerst ein Bauteil oder eine Leitung aus.', 'hinweis'); });
  $('zuruecksetzen').addEventListener('click', function () {
    merke();
    st.doc.bauteile.forEach(function (b) { if (b.typ === 'schalter') b.werte.an = 0; if (b.typ === 'taster') b.werte.gedrueckt = 0; });
    st.zustand = {}; st.t = 0;
    geaendert(); toast('Alle Schalter auf 0, Speicher (Flipflops) im Ruhezustand.', 'ok');
  });
  $('takt').addEventListener('click', function () {
    st.laeuft = !st.laeuft;
    this.setAttribute('aria-pressed', String(st.laeuft));
    this.textContent = st.laeuft ? '⏸ Takt anhalten' : '▶ Takt starten';
    starteTakt();
  });
  $('aufraeumen').addEventListener('click', function () { bed.einpassen(); });
  $('beispiele').innerHTML = '<option value="">Beispiele …</option>' + Object.keys(SL.BEISPIELE).map(function (k, i) { return '<option value="' + k + '">' + (i + 1) + '. ' + esc(SL.BEISPIELE[k].titel) + '</option>'; }).join('');
  $('beispiele').addEventListener('change', function () {
    var k = this.value; this.value = '';
    if (!k) return;
    if (st.doc.bauteile.length && !confirm('Beispiel „' + SL.BEISPIELE[k].titel + '“ laden? Es ersetzt die aktuelle Schaltung (Rückgängig ist möglich). Speichere sie vorher, wenn du sie behalten willst.')) return;
    merke(); neuesDoc(SL.BEISPIELE[k].bauen(), true);
    toast('Beispiel geladen – du kannst es frei verändern.', 'ok');
  });
  $('export').addEventListener('click', function () {
    try {
      var url = URL.createObjectURL(new Blob([M.exportiere(st.doc)], { type: 'application/json' }));
      var a = document.createElement('a'); a.href = url; a.download = 'logikschaltung.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Projekt als Datei gespeichert.', 'ok');
    } catch (e) { toast('Speichern als Datei ist hier nicht möglich.', 'fehler'); }
  });
  $('import').addEventListener('change', function () {
    var f = this.files[0]; this.value = '';
    if (!f) return;
    if (f.size > 500000) return toast('Die Datei ist zu groß.', 'fehler');
    var r = new FileReader();
    r.onload = function () {
      var x = M.importiere(String(r.result));
      if (!x.ok) return toast(x.fehler, 'fehler');
      merke(); neuesDoc(x.doc, true);
      toast('Projekt geladen.' + (x.hinweise.length ? ' ' + x.hinweise.join(' ') : ''), x.hinweise.length ? 'hinweis' : 'ok');
    };
    r.readAsText(f);
  });
  $('hilfe').addEventListener('click', function () { var h = $('hilfetext'), offen = h.hidden; h.hidden = !offen; this.setAttribute('aria-expanded', String(offen)); if (offen) h.scrollIntoView({ block: 'nearest' }); });
  var mitte = function () { return { x: groesse.w / 2, y: groesse.h / 2 }; };
  $('zoom-plus').addEventListener('click', function () { bed.zoomUm(mitte(), 1.25); });
  $('zoom-minus').addEventListener('click', function () { bed.zoomUm(mitte(), 0.8); });
  $('zoom-fit').addEventListener('click', function () { bed.einpassen(); });
  $('leer-beispiel').addEventListener('click', function () { merke(); neuesDoc(SL.BEISPIELE.und.bauen(), true); });

  document.addEventListener('keydown', function (e) {
    var t = e.target, tippen = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
    var strg = e.ctrlKey || e.metaKey, taste = e.key.toLowerCase();
    if (tippen) return;
    if (strg && taste === 'z') { e.preventDefault(); if (e.shiftKey) wiederholen(); else rueckgaengig(); return; }
    if (strg && taste === 'y') { e.preventDefault(); wiederholen(); return; }
    if (strg && taste === 'a') { e.preventDefault(); allesWaehlen(); return; }
    if (e.key === 'Escape') { if (!bed.escape()) waehle(null); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (st.auswahl) { e.preventDefault(); loeschen(); } }
    else if (taste === 'r' && st.auswahl && st.auswahl.art === 'bauteil') { merke(); M.drehen(st.doc, st.auswahl.id); geaendert(); }
    else if ((e.key === ' ' || e.key === 'Enter') && st.auswahl && st.auswahl.art === 'bauteil' && t === document.body) {
      var b = M.finde(st.doc, st.auswahl.id);
      if (b && b.typ === 'schalter') { e.preventDefault(); merke(); M.tippAktion(st.doc, b.id); geaendert(); }
    }
  });

  // ---------------------------------------------------------------- Start

  (function laden() {
    var text = null;
    try { text = localStorage.getItem(SPEICHER); } catch (e) { /* kein Speicher */ }
    var x = text ? M.importiere(text) : null;
    st.doc = x && x.ok ? x.doc : M.neu();
    rechne(); eigenschaften(); tabelle(); meldungen(); knoepfe();
    $('takt').disabled = !hatTakt();
    bed.einpassen();
    starteTakt();
  })();

  window.Logik = { st: st, bed: bed, neuesDoc: neuesDoc, rechne: rechne };
})();
