// Schaltkreis-Labor · Oberfläche
// Verbindet Modell (modell.js), Simulation (simulation.js), Bedienung (bedienung.js) und Darstellung (zeichnen.js)
// mit Werkzeugleiste, Bauteilleiste, Eigenschaften und Messwert-Anzeige.
(function () {
  'use strict';
  var SL = window.SL, M = SL.modell, F = SL.fmt;
  var SPEICHER = 'schaltkreis-labor:v1';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var st = { doc: M.neu(), laeuft: false, messwerte: true, flussAn: true, auswahl: null, erg: null, verlauf: [], t: 0, gatter: {}, stat: null, hatAC: false };
  var svg = $('flaeche'), welt = $('welt'), raster = $('raster'), box = $('flaeche-box');

  // ---------------------------------------------------------------- Zustand ändern

  function merke(vorher) {
    st.verlauf.push(JSON.stringify(vorher || st.doc));
    if (st.verlauf.length > 80) st.verlauf.shift();
    $('rueck').disabled = false;
  }

  // Momentanwerte zum Zeitpunkt st.t; bei Wechselspannung zusätzlich Effektiv-/Mittelwerte über eine Periode (st.stat)
  function momentan() {
    var e = SL.sim.simuliere(st.doc, st.laeuft, { t: st.t, gatter: st.gatter });
    st.gatter = e.gatter;
    st.erg = SL.sim.kombiniere(e, st.stat);
  }
  function rechne() {
    st.stat = SL.sim.zeitverlauf(st.doc, st.laeuft, { gatter: st.gatter });
    momentan();
    var ac = SL.sim.wechselquellen(st.doc).length > 0;
    if (ac !== st.hatAC) { st.hatAC = ac; if (st.auswahl) eigenschaften(); }
  }

  function geaendert() {
    rechne();
    starteSchleife();
    if (st.auswahl && !(st.auswahl.art === 'bauteil' ? M.finde(st.doc, st.auswahl.id) : M.findeDraht(st.doc, st.auswahl.id))) waehle(null);
    zeichne();
    werte();
    speichere();
  }

  function waehle(sel) {
    var alt = JSON.stringify(st.auswahl);
    st.auswahl = sel;
    if (alt !== JSON.stringify(sel)) { eigenschaften(); zeichne(); }
  }

  function speichere() { try { localStorage.setItem(SPEICHER, M.exportiere(st.doc)); } catch (e) { /* privates Fenster o. ä. */ } }

  function neuesDoc(doc, einpassen) {
    st.doc = doc;
    st.auswahl = null;
    geaendert();
    eigenschaften();
    if (einpassen) bed.einpassen();
  }

  // ---------------------------------------------------------------- Bedienung

  var bed = new SL.Bedienung({
    doc: function () { return st.doc; },
    merke: merke,
    geaendert: geaendert,
    zeige: zeichne,
    auswahl: waehle,
    meldung: toast,
  });

  function punkt(e) {
    var r = svg.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    return { id: e.pointerId, x: x, y: y, typ: e.pointerType || 'mouse', taste: e.button, drin: x >= 0 && y >= 0 && x <= r.width && y <= r.height };
  }

  svg.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    bed.runter(punkt(e));
  });
  svg.addEventListener('pointermove', function (e) { if (!leisteAktiv) bed.bewegen(punkt(e)); });
  svg.addEventListener('pointerup', function (e) { if (!leisteAktiv) bed.hoch(punkt(e)); });
  svg.addEventListener('pointercancel', function (e) { if (!leisteAktiv) bed.abbrechen(punkt(e)); });
  svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && bed.hover && !bed.anzahl()) { bed.hover = null; zeichne(); } });
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    bed.zoomUm(punkt(e), Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004));
  }, { passive: false });
  svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Bauteilleiste: ziehen oder antippen
  var leisteAktiv = null;
  $('leiste').innerHTML = Object.keys(SL.TYPEN).map(function (typ) {
    return '<button type="button" class="teil" data-typ="' + typ + '" title="' + esc(SL.TYPEN[typ].name) + ' – ziehen oder antippen">' +
      SL.zeichnen.symbol(typ) + '<span>' + esc(SL.TYPEN[typ].leiste || SL.TYPEN[typ].name) + '</span></button>';
  }).join('');
  $('leiste').addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.teil');
    if (!b || e.button > 0) return;
    leisteAktiv = e.pointerId;
    bed.leisteRunter(b.dataset.typ, punkt(e));
  });
  document.addEventListener('pointermove', function (e) { if (leisteAktiv === e.pointerId) bed.bewegen(punkt(e)); });
  document.addEventListener('pointerup', function (e) { if (leisteAktiv === e.pointerId) { leisteAktiv = null; bed.hoch(punkt(e)); } });
  document.addEventListener('pointercancel', function (e) { if (leisteAktiv === e.pointerId) { leisteAktiv = null; bed.abbrechen(punkt(e)); } });
  // Tastatur (Enter/Leertaste auf einem Bauteil der Leiste): Klick ohne Zeiger
  $('leiste').addEventListener('click', function (e) {
    var b = e.target.closest('.teil');
    if (b && e.detail === 0) { var p = bed.freierPlatz(b.dataset.typ); bed.fuegeEin(b.dataset.typ, p.x, p.y); }
  });

  // ---------------------------------------------------------------- Zeichnen

  var groesse = { w: 600, h: 400 };
  function zeichne() {
    var v = bed.view, w = groesse.w / v.s, h = groesse.h / v.s;
    svg.setAttribute('viewBox', [v.x, v.y, w, h].map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
    raster.setAttribute('x', v.x); raster.setAttribute('y', v.y);
    raster.setAttribute('width', w); raster.setAttribute('height', h);
    welt.innerHTML = SL.zeichnen.szene({ doc: st.doc, erg: st.erg, auswahl: st.auswahl, vorschau: bed.vorschau, hover: bed.hover, laeuft: st.laeuft, messwerte: st.messwerte, flussAn: st.flussAn });
    var h0 = bed.hover;
    svg.style.cursor = bed.zustand && bed.zustand.art === 'schieben' && bed.zustand.bewegt ? 'grabbing' : h0 && h0.art === 'anschluss' ? 'crosshair' : h0 ? 'pointer' : 'default';
    $('leer').hidden = st.doc.bauteile.length > 0;
    flussTempo = [].map.call(welt.querySelectorAll('.fluss'), function (p) { return { p: p, v: Number(p.dataset.tempo) }; });
    animiere(performance.now());
  }

  // Stromfluss-Animation: Striche wandern in technischer Stromrichtung (+ → −)
  var flussTempo = [], animation = null;
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animiere(t) {
    flussTempo.forEach(function (f) { f.p.style.strokeDashoffset = ruhig ? 0 : -((t / 1000 * f.v) % 16); });
  }
  // Bei Wechselspannung läuft die Zeit: jedes Bild wird die Schaltung zum neuen Zeitpunkt berechnet.
  var letzteZeit = null, letzteWerte = 0;
  var brauchtSchleife = function () { return st.laeuft && (!!st.stat || (st.flussAn && !ruhig)); };
  function schleife(t) {
    if (st.stat && st.laeuft) {
      var dt = letzteZeit == null ? 0 : Math.min(0.1, (t - letzteZeit) / 1000);
      st.t += dt;
      momentan();
      zeichne();
      if (t - letzteWerte > 150) { letzteWerte = t; werte(); }
    } else animiere(t);
    letzteZeit = t;
    animation = brauchtSchleife() ? requestAnimationFrame(schleife) : null;
    if (!animation) letzteZeit = null;
  }
  function starteSchleife() { if (!animation && brauchtSchleife()) animation = requestAnimationFrame(schleife); }

  if (window.ResizeObserver) new ResizeObserver(function () { groesse = { w: box.clientWidth || 600, h: box.clientHeight || 400 }; bed.groesse = groesse; zeichne(); }).observe(box);
  groesse = { w: box.clientWidth || 600, h: box.clientHeight || 400 };
  bed.groesse = groesse;

  // ---------------------------------------------------------------- Kurze Meldungen

  var toastZeit = null;
  function toast(text, art) {
    var t = $('toast');
    t.textContent = text;
    t.className = 'toast zeigen ' + (art || '');
    clearTimeout(toastZeit);
    toastZeit = setTimeout(function () { t.className = 'toast'; }, art === 'fehler' ? 5000 : 3200);
  }

  // ---------------------------------------------------------------- Eigenschaften

  // Schieberegler für 0 Ω … 10 kΩ: 0 = 0 Ω, sonst logarithmisch von 1 Ω bis 10 kΩ
  var logZuR = function (s) { s = Number(s); if (s <= 0) return 0; var r = Math.pow(10, s / 25); var g = Math.pow(10, Math.floor(Math.log10(r)) - 1); return Math.round(r / g) * g; };
  var rZuLog = function (r) { return r <= 0 ? 0 : Math.max(1, Math.min(100, Math.round(Math.log10(Math.max(r, 1)) * 25))); };

  var ANLEITUNG = {
    V: 'Spannung misst man <b>parallel</b>: rote Leitung an den einen, schwarze an den anderen Anschluss des Bauteils.',
    A: 'Stromstärke misst man <b>in Reihe</b>: Stromkreis auftrennen und das Messgerät dazwischen schalten.',
    Ohm: 'Widerstand misst man <b>ohne Spannung</b>: Simulation stoppen oder Quelle abklemmen, dann die Messleitungen an das Bauteil.',
  };

  // name ist fester Text; html = true erlaubt <sub> im Namen
  function anzeige(name, feld, html) { return '<div class="readout"><b data-zeige="' + feld + '">–</b><span>' + (html ? name : esc(name)) + '</span></div>'; }
  var FREQ = [0.1, 0.2, 0.5, 1, 2, 5, 10, 25, 50];
  var freqStufe = function (f) { var best = 0; FREQ.forEach(function (x, i) { if (Math.abs(Math.log(x / f)) < Math.abs(Math.log(FREQ[best] / f))) best = i; }); return best; };
  function knoepfe(b) {
    return '<div class="row knoepfe"><button type="button" data-aktion="drehen"' + (SL.TYPEN[b.typ].fest ? ' disabled title="Das Multimeter steht immer aufrecht."' : '') + '>⟳ Drehen</button>' +
      '<button type="button" data-aktion="loeschen" class="gefahr">Löschen</button></div>';
  }

  function eigenschaften() {
    var el = $('eig'), sel = st.auswahl, h = '';
    if (!sel) {
      el.innerHTML = '<p class="muted small">Tippe ein Bauteil oder einen Draht an, um es einzustellen. Neue Bauteile ziehst du aus der Leiste auf die Arbeitsfläche.</p>';
      return;
    }
    if (sel.art === 'draht') {
      var d = M.findeDraht(st.doc, sel.id), b1 = M.finde(st.doc, d.von.b), b2 = M.finde(st.doc, d.nach.b);
      el.innerHTML = '<h3>Draht</h3><p class="small">von <b>' + esc(b1.name) + '</b> (' + esc(M.anschlussName(b1, d.von.a)) + ')<br>nach <b>' + esc(b2.name) + '</b> (' + esc(M.anschlussName(b2, d.nach.a)) + ')</p>' +
        '<div class="readouts">' + anzeige('Stromstärke', 'I') + '</div>' +
        '<p class="small muted">Drähte haben fast keinen Widerstand. Kreuzende Drähte sind nicht verbunden – verbunden ist nur, was an einem gemeinsamen Anschluss hängt.</p>' +
        '<div class="row knoepfe"><button type="button" data-aktion="loeschen" class="gefahr">Draht löschen</button></div>';
      werte();
      return;
    }
    var b = M.finde(st.doc, sel.id), w = b.werte;
    h += '<h3>' + esc(b.name) + ' · ' + esc(SL.TYPEN[b.typ].name) + '</h3>';
    switch (b.typ) {
      case 'quelle':
        h += '<label class="ctrl"><span>Spannung <output data-zeige="spannung"></output></span>' +
          '<input type="range" min="0" max="24" step="0.1" data-wert="spannung" aria-label="Spannung in Volt"></label>' +
          '<div class="row"><label class="zahl">U = <input type="number" min="0" max="24" step="0.1" inputmode="decimal" data-wert="spannung" aria-label="Spannung in Volt (Zahl)"> V</label>' +
          '<button type="button" data-aktion="umpolen" aria-pressed="false">Umpolen (+/−)</button></div>' +
          '<p class="small muted" data-zeige="polung"></p>' +
          '<div class="readouts">' + anzeige('Spannung', 'U') + anzeige('Stromstärke', 'I') + anzeige('Leistung', 'P') + '</div>';
        break;
      case 'schalter':
        h += '<div class="row"><button type="button" data-aktion="schalten" aria-pressed="false"></button></div>' +
          '<p class="small muted">Du kannst den Schalter auch direkt auf der Arbeitsfläche antippen.</p>' +
          '<div class="readouts">' + anzeige('Spannung am Schalter', 'U') + anzeige('Stromstärke', 'I') + '</div>';
        break;
      case 'lampe':
        h += '<label class="ctrl"><span>Lampentyp (Nennwerte)</span><select data-wert="typ">' +
          Object.keys(SL.LAMPEN).map(function (k) { return '<option value="' + k + '">' + esc(SL.LAMPEN[k].name) + '</option>'; }).join('') + '</select></label>' +
          '<p class="small muted">Widerstand der Lampe: <b data-zeige="R"></b> (vereinfacht: konstant, in Wirklichkeit steigt er mit der Temperatur).</p>' +
          '<div class="readouts">' + anzeige('Spannung', 'U') + anzeige('Stromstärke', 'I') + anzeige('Leistung', 'P') + anzeige('Helligkeit', 'hell') + '</div>';
        break;
      case 'widerstand':
        h += '<label class="ctrl"><span>Widerstand <output data-zeige="widerstand"></output></span>' +
          '<input type="range" min="0" max="100" step="1" data-wert="widerstand-log" aria-label="Widerstand (logarithmisch)"></label>' +
          '<div class="row"><label class="zahl">R = <input type="number" min="0" max="10000" step="any" inputmode="decimal" data-wert="widerstand" aria-label="Widerstand in Ohm"> Ω</label></div>' +
          '<p class="small muted">0 Ω bis 10 kΩ. Bei 0 Ω wirkt der Widerstand wie ein Draht.</p>' +
          '<div class="readouts">' + anzeige('Spannung', 'U') + anzeige('Stromstärke', 'I') + anzeige('Leistung', 'P') + '</div>';
        break;
      case 'diode':
        h += '<p class="small">Strom fließt nur von der <b>Anode (A)</b> zur <b>Kathode (K)</b>, also in Pfeilrichtung des Dreiecks. In Durchlassrichtung fallen etwa 0,7 V ab, in Sperrrichtung sperrt sie.</p>' +
          '<div class="readouts">' + anzeige('Zustand', 'zustand') + anzeige('Spannung A→K', 'U') + anzeige('Stromstärke', 'I') + '</div>';
        break;
      case 'wechsel':
        h += '<label class="ctrl"><span>Effektivwert <output data-zeige="spannung"></output></span>' +
          '<input type="range" min="0" max="24" step="0.1" data-wert="spannung" aria-label="Effektivwert der Spannung in Volt"></label>' +
          '<div class="row"><label class="zahl">U<sub>eff</sub> = <input type="number" min="0" max="24" step="0.1" inputmode="decimal" data-wert="spannung" aria-label="Effektivwert in Volt (Zahl)"> V</label></div>' +
          '<label class="ctrl"><span>Frequenz <output data-zeige="frequenz"></output></span>' +
          '<input type="range" min="0" max="' + (FREQ.length - 1) + '" step="1" data-wert="frequenz-stufe" aria-label="Frequenz (Stufen)"></label>' +
          '<div class="row"><label class="zahl">f = <input type="number" min="0.1" max="50" step="0.1" inputmode="decimal" data-wert="frequenz" aria-label="Frequenz in Hertz"> Hz</label></div>' +
          '<p class="small muted" data-zeige="ac-info"></p>' +
          '<div class="readouts">' + anzeige('Scheitelwert û', 'scheitel') + anzeige('Momentan u', 'U') + anzeige('Momentan i', 'I') + anzeige('Effektiv I', 'Ieff') + '</div>';
        break;
      case 'transistor':
        h += '<p class="small">Ein kleiner Strom in die <b>Basis (B)</b> steuert einen großen Strom vom <b>Kollektor (C)</b> zum <b>Emitter (E)</b>. Hier gilt I<sub>C</sub> ≈ 100 · I<sub>B</sub>, bis der Transistor voll durchgeschaltet ist. Ohne Basisstrom sperrt er (Basis-Emitter-Spannung unter etwa 0,6 V).</p>' +
          '<div class="readouts">' + anzeige('Zustand', 'zustand') + anzeige('U<sub>BE</sub>', 'Ube', true) + anzeige('U<sub>CE</sub>', 'U', true) + anzeige('I<sub>B</sub>', 'Ib', true) + anzeige('I<sub>C</sub>', 'I', true) + anzeige('I<sub>C</sub> / I<sub>B</sub>', 'beta', true) + '</div>';
        break;
      case 'und': case 'oder': case 'nicht': case 'xoder': {
        var g = SL.GATTER[b.typ], zwei = !g.einEingang, reihen = zwei ? [[0, 0], [0, 1], [1, 0], [1, 1]] : [[0], [1]];
        h += '<p class="small"><b>' + esc(g.name) + ' (' + esc(g.zeichen) + '):</b> ' + esc(g.regel) + '</p>' +
          '<table class="wahrheit"><thead><tr><th>A</th>' + (zwei ? '<th>B</th>' : '') + '<th>Q</th></tr></thead><tbody>' +
          reihen.map(function (x) { return '<tr data-zeile="' + x.join('') + '"><td>' + x.join('</td><td>') + '</td><td>' + g.f(x[0], x[1] || 0) + '</td></tr>'; }).join('') + '</tbody></table>' +
          '<div class="readouts">' + anzeige('Eingang A', 'ea') + (zwei ? anzeige('Eingang B', 'eb') : '') + anzeige('Ausgang Q', 'q') + anzeige('U am Ausgang', 'U') + '</div>' +
          '<p class="small muted">Das Gatter hat eine eingebaute 5-V-Versorgung. Verbinde den Anschluss ⊥ (unten) mit dem Minuspol. Ein Eingang ist 1 ab 3 V und 0 unter 2 V, offen gilt er als 0. Der Ausgang liefert 5 V (1) oder 0 V (0) – gut für eine 5-V-Lampe.</p>';
        break;
      }
      case 'messgeraet':
        h += '<div class="seg" role="group" aria-label="Messart">' + SL.MODI.map(function (m) {
          return '<button type="button" data-aktion="modus" data-modus="' + m + '" aria-pressed="false">' + (m === 'V' ? 'Spannung V' : m === 'A' ? 'Strom A' : 'Widerstand Ω') + '</button>';
        }).join('') + '</div>' +
          '<div class="mm-anzeige" data-zeige="mm"></div>' +
          '<p class="mm-meldung" data-zeige="mm-meldung"></p>' +
          '<p class="small muted" data-zeige="anleitung"></p>' +
          '<p class="small muted">Rote Buchse: V/Ω/A, schwarze Buchse: COM. Ziehe von den Buchsen Messleitungen zu den Anschlüssen.</p>';
        break;
    }
    if (st.hatAC && st.laeuft && ['lampe', 'widerstand', 'diode', 'schalter'].indexOf(b.typ) >= 0) {
      h += '<p class="small muted ac-hinweis">Wechselspannung: oben stehen die Momentanwerte, hier die Werte über eine Periode.</p>' +
        '<div class="readouts">' + anzeige('U<sub>eff</sub>', 'Ueff', true) + anzeige('I<sub>eff</sub>', 'Ieff', true) + anzeige('P (Mittel)', 'Pm') + '</div>';
    }
    h += knoepfe(b);
    el.innerHTML = h;
    werte();
  }

  /** Veränderliche Werte im Eigenschaften- und Messbereich nachführen (ohne die Eingabefelder neu zu bauen). */
  function werte() {
    var el = $('eig'), sel = st.auswahl, erg = st.erg;
    var setze = function (feld, wert, html) { el.querySelectorAll('[data-zeige="' + feld + '"]').forEach(function (x) { if (html) x.innerHTML = wert; else x.textContent = wert; }); };
    var feld = function (name, wert) { el.querySelectorAll('[data-wert="' + name + '"]').forEach(function (x) { if (document.activeElement !== x || x.type === 'range') x.value = wert; }); };
    var lauf = st.laeuft;
    if (sel && sel.art === 'draht') {
      var rd = erg.draehte[sel.id] || {};
      setze('I', !lauf ? '–' : rd.ungueltig ? 'Kurzschluss' : F(Math.abs(rd.I), 'A'));
    } else if (sel) {
      var b = M.finde(st.doc, sel.id), r = erg.bauteile[b.id] || {}, w = b.werte;
      var zeig = function (v, e) { return !lauf ? '–' : r.ungueltig ? 'Kurzschluss' : F(v, e); };
      setze('U', zeig(r.U, 'V')); setze('I', zeig(r.I, 'A')); setze('P', zeig(r.P, 'W'));
      if (r.eff) { setze('Ueff', zeig(r.eff.Ueff, 'V')); setze('Ieff', zeig(r.eff.Ieff, 'A')); setze('Pm', zeig(r.eff.Pmittel, 'W')); }
      switch (b.typ) {
        case 'quelle':
          setze('spannung', F(w.spannung, 'V')); feld('spannung', w.spannung);
          el.querySelector('[data-aktion="umpolen"]').setAttribute('aria-pressed', String(w.umgepolt));
          setze('polung', 'Pluspol: ' + (w.umgepolt ? 'rechts' : 'links') + ' (ohne Drehung). Die Quelle liefert Gleichspannung.');
          break;
        case 'schalter': {
          var k = el.querySelector('[data-aktion="schalten"]');
          k.textContent = w.geschlossen ? 'Geschlossen – zum Öffnen tippen' : 'Offen – zum Schließen tippen';
          k.setAttribute('aria-pressed', String(w.geschlossen));
          break;
        }
        case 'lampe':
          feld('typ', w.typ); setze('R', F(r.R, 'Ω'));
          setze('hell', !lauf ? '–' : r.ungueltig ? 'aus' : r.zustand === 'ueberlast' ? 'zu hell!' : Math.round(r.hell * 100) + ' %');
          break;
        case 'widerstand':
          setze('widerstand', F(w.widerstand, 'Ω')); feld('widerstand', w.widerstand); feld('widerstand-log', rZuLog(w.widerstand));
          break;
        case 'diode':
          setze('zustand', !lauf ? '–' : r.ungueltig ? 'überlastet' : r.zustand);
          break;
        case 'wechsel':
          setze('spannung', F(w.spannung, 'V')); feld('spannung', w.spannung);
          setze('frequenz', String(w.frequenz).replace('.', ',') + ' Hz'); feld('frequenz', w.frequenz); feld('frequenz-stufe', freqStufe(w.frequenz));
          setze('scheitel', F(w.spannung * Math.SQRT2, 'V'));
          setze('Ieff', !lauf || !r.eff ? '–' : F(r.eff.Ieff, 'A'));
          setze('ac-info', 'Die Spannung ändert sich wie eine Sinuskurve zwischen +' + F(w.spannung * Math.SQRT2, 'V') + ' und −' + F(w.spannung * Math.SQRT2, 'V') + '; die Stromrichtung wechselt ' + String(Math.round(w.frequenz * 20) / 10).replace('.', ',') + '-mal pro Sekunde. ' +
            (w.frequenz < 5 ? 'Bei dieser Frequenz kannst du zusehen, wie Lampen pulsieren und der Strom die Richtung wechselt.' : 'So schnell sieht man das Wechseln nicht mehr: Lampen leuchten gleichmäßig, angezeigt werden Effektivwerte (~). Im Stromnetz sind es 50 Hz.'));
          break;
        case 'transistor':
          setze('zustand', !lauf ? '–' : r.ungueltig ? 'überlastet' : r.zustand);
          setze('Ube', zeig(r.Ube, 'V')); setze('Ib', zeig(r.Ib, 'A'));
          setze('beta', !lauf || r.ungueltig || !r.Ib || r.zustand === 'sperrt' ? '–' : String(Math.round(r.I / r.Ib)).replace('.', ','));
          break;
        case 'und': case 'oder': case 'nicht': case 'xoder': {
          var ein = r.ein || {};
          setze('ea', lauf ? String(ein.a || 0) : '–'); setze('eb', lauf ? String(ein.b || 0) : '–'); setze('q', lauf ? String(r.q || 0) : '–');
          var zeile = SL.GATTER[b.typ].einEingang ? String(ein.a || 0) : String(ein.a || 0) + String(ein.b || 0);
          el.querySelectorAll('tr[data-zeile]').forEach(function (tr) { tr.classList.toggle('aktiv', lauf && tr.dataset.zeile === zeile); });
          break;
        }
        case 'messgeraet': {
          var m = erg.messgeraete[b.id] || {};
          el.querySelectorAll('[data-aktion="modus"]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.modus === w.modus)); });
          setze('mm', esc(m.anzeige || '–'), true);
          var t = m.fehler || m.warnung || m.hinweis || '';
          setze('mm-meldung', t);
          el.querySelector('[data-zeige="mm-meldung"]').className = 'mm-meldung ' + (m.fehler ? 'fehler' : m.warnung ? 'warnung' : 'hinweis');
          setze('anleitung', ANLEITUNG[w.modus], true);
          break;
        }
      }
    }
    messbereich();
  }

  function messbereich() {
    var erg = st.erg;
    var status = !st.laeuft ? 'Simulation gestoppt' : erg.status === 'kurzschluss' ? 'Kurzschluss!' : erg.status === 'fehler' ? 'Nicht berechenbar' : 'Simulation läuft';
    var s = $('status');
    s.textContent = status;
    s.className = 'status ' + (!st.laeuft ? '' : erg.status === 'ok' ? 'ok' : 'fehler');
    $('meldungen').innerHTML = erg.meldungen.map(function (m) {
      return '<li class="' + m.art + '">' + esc(m.text) + '</li>';
    }).join('');
    var zeilen = st.doc.bauteile.map(function (b) {
      var r = erg.bauteile[b.id] || {}, sp, i;
      if (b.typ === 'messgeraet') {
        var m = erg.messgeraete[b.id] || {};
        return '<tr data-id="' + b.id + '"><th>' + esc(b.name) + '</th><td colspan="3">' + esc(m.anzeige || '–') + (m.fehler ? ' <span class="warn">⚠</span>' : '') + '</td></tr>';
      }
      var eff = erg.wechsel && erg.wechsel.schnell && r.eff, P = eff ? r.eff.Pmittel : r.P;
      if (!st.laeuft) { sp = i = '–'; } else if (r.ungueltig) { sp = '—'; i = 'Kurzschluss'; } else if (eff) { sp = F(r.eff.Ueff, 'V') + '~'; i = F(r.eff.Ieff, 'A') + '~'; } else { sp = F(r.U, 'V'); i = F(r.I, 'A'); }
      if (SL.TYPEN[b.typ].gatter && st.laeuft && !r.ungueltig) i = 'Q = ' + (r.q || 0);
      return '<tr data-id="' + b.id + '"><th>' + esc(b.name) + '</th><td>' + sp + '</td><td>' + i + '</td><td>' + (st.laeuft && !r.ungueltig ? F(P, 'W') : '–') + '</td></tr>';
    }).join('');
    $('tabelle').innerHTML = zeilen ? '<table class="werte"><thead><tr><th>Bauteil</th><th>U</th><th>I</th><th>P</th></tr></thead><tbody>' + zeilen + '</tbody></table>' +
      (erg.wechsel ? '<p class="small muted">' + (erg.wechsel.schnell ? '~ = Effektivwert, P = mittlere Leistung.' : 'Momentanwerte – sie ändern sich laufend mit der Wechselspannung.') + '</p>' : '') : '';
  }

  // Eingaben im Eigenschaften-Bereich
  var sliderMerk = false;
  function aendereWert(b, schluessel, wert, gemerkt) {
    if (!gemerkt) merke();
    M.setzeWert(st.doc, b.id, schluessel, wert);
    geaendert();
  }
  $('eig').addEventListener('input', function (e) {
    var x = e.target, name = x.dataset.wert;
    if (!name || !st.auswahl || st.auswahl.art !== 'bauteil') return;
    var b = M.finde(st.doc, st.auswahl.id);
    if (x.type === 'range') {
      if (!sliderMerk) { merke(); sliderMerk = true; }
      if (name === 'widerstand-log') aendereWert(b, 'widerstand', logZuR(x.value), true);
      else if (name === 'frequenz-stufe') aendereWert(b, 'frequenz', FREQ[Number(x.value)], true);
      else aendereWert(b, name, Number(x.value), true);
    } else if (x.type === 'number') {
      var v = parseFloat(String(x.value).replace(',', '.'));
      if (!isFinite(v)) return;
      aendereWert(b, name, v);
    }
  });
  $('eig').addEventListener('change', function (e) {
    var x = e.target, name = x.dataset.wert;
    sliderMerk = false;
    if (!name || !st.auswahl) return;
    var b = M.finde(st.doc, st.auswahl.id);
    if (x.tagName === 'SELECT') aendereWert(b, name, x.value);
    if (x.type === 'number') { var v = parseFloat(String(x.value).replace(',', '.')); if (!isFinite(v)) { toast('Bitte eine Zahl eingeben.', 'fehler'); werte(); return; } x.value = b.werte[name]; }
  });
  $('eig').addEventListener('click', function (e) {
    var k = e.target.closest('[data-aktion]');
    if (!k || !st.auswahl) return;
    var a = k.dataset.aktion, b = st.auswahl.art === 'bauteil' ? M.finde(st.doc, st.auswahl.id) : null;
    if (a === 'loeschen') return loeschen();
    if (a === 'drehen') return drehen();
    if (!b) return;
    if (a === 'umpolen') aendereWert(b, 'umgepolt', !b.werte.umgepolt);
    if (a === 'schalten') aendereWert(b, 'geschlossen', !b.werte.geschlossen);
    if (a === 'modus' && b.werte.modus !== k.dataset.modus) aendereWert(b, 'modus', k.dataset.modus);
  });
  $('tabelle').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]');
    if (tr) waehle({ art: 'bauteil', id: tr.dataset.id });
  });

  function loeschen() {
    if (!st.auswahl) return;
    var vorher = M.kopie(st.doc), sel = st.auswahl;
    var name = sel.art === 'draht' ? 'Draht' : M.finde(st.doc, sel.id).name;
    var n = st.doc.draehte.length;
    if (!M.loesche(st.doc, sel)) return;
    merke(vorher);
    waehle(null);
    geaendert();
    var weg = n - st.doc.draehte.length;
    toast(name + ' gelöscht' + (sel.art === 'bauteil' && weg ? ' (mit ' + weg + ' Draht' + (weg > 1 ? 'en' : '') + ')' : '') + '.', 'ok');
  }
  function drehen() {
    if (!st.auswahl || st.auswahl.art !== 'bauteil') return;
    var vorher = M.kopie(st.doc);
    if (M.drehen(st.doc, st.auswahl.id)) { merke(vorher); geaendert(); }
  }

  // ---------------------------------------------------------------- Werkzeugleiste

  function setzeLauf(an) {
    st.laeuft = an;
    if (!an) { st.gatter = {}; st.t = 0; }
    var k = $('start');
    k.setAttribute('aria-pressed', String(an));
    k.innerHTML = an ? '■ Stopp' : '▶ Start';
    k.classList.toggle('primary', !an);
    geaendert();
    starteSchleife();
  }
  $('start').addEventListener('click', function () { setzeLauf(!st.laeuft); toast(st.laeuft ? 'Simulation läuft.' : 'Simulation gestoppt.', 'hinweis'); });
  $('messwerte').addEventListener('click', function () { st.messwerte = !st.messwerte; this.setAttribute('aria-pressed', String(st.messwerte)); zeichne(); });
  $('fluss').addEventListener('click', function () { st.flussAn = !st.flussAn; this.setAttribute('aria-pressed', String(st.flussAn)); zeichne(); starteSchleife(); });
  $('rueck').addEventListener('click', rueckgaengig);
  function rueckgaengig() {
    var alt = st.verlauf.pop();
    $('rueck').disabled = !st.verlauf.length;
    if (!alt) return;
    var sel = st.auswahl;
    st.doc = JSON.parse(alt);
    st.auswahl = null;
    geaendert();
    if (sel && (sel.art === 'bauteil' ? M.finde(st.doc, sel.id) : M.findeDraht(st.doc, sel.id))) st.auswahl = sel;
    eigenschaften(); zeichne();
    toast('Rückgängig gemacht.', 'hinweis');
  }
  $('beispiel').addEventListener('click', ladeBeispiel);
  $('leer-beispiel').addEventListener('click', ladeBeispiel);
  function ladeBeispiel() {
    if (st.doc.bauteile.length && !confirm('Die aktuelle Schaltung durch die Beispielschaltung ersetzen? (Rückgängig ist möglich.)')) return;
    merke();
    neuesDoc(M.beispiel(), true);
    toast('Beispiel: Quelle, Schalter und Lampe. Starte die Simulation und tippe auf den Schalter.', 'ok');
  }
  $('leeren').addEventListener('click', function () {
    if (!st.doc.bauteile.length) return;
    if (!confirm('Die ganze Schaltung löschen? (Rückgängig ist möglich.)')) return;
    merke();
    neuesDoc(M.neu(), false);
    toast('Arbeitsfläche geleert.', 'hinweis');
  });
  $('export').addEventListener('click', function () {
    try {
      var url = URL.createObjectURL(new Blob([M.exportiere(st.doc)], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = 'schaltung.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Schaltung als Datei gespeichert.', 'ok');
    } catch (e) { toast('Speichern als Datei ist hier nicht möglich.', 'fehler'); }
  });
  $('import').addEventListener('change', function () {
    var f = this.files[0];
    this.value = '';
    if (!f) return;
    if (f.size > 500000) return toast('Die Datei ist zu groß.', 'fehler');
    var r = new FileReader();
    r.onload = function () {
      var x = M.importiere(String(r.result));
      if (!x.ok) return toast(x.fehler, 'fehler');
      merke();
      neuesDoc(x.doc, true);
      toast('Schaltung geladen.' + (x.hinweise.length ? ' ' + x.hinweise.join(' ') : ''), x.hinweise.length ? 'hinweis' : 'ok');
    };
    r.readAsText(f);
  });
  $('hilfe').addEventListener('click', function () {
    var h = $('hilfetext'), offen = h.hidden;
    h.hidden = !offen;
    this.setAttribute('aria-expanded', String(offen));
    if (offen) h.scrollIntoView({ block: 'nearest' });
  });
  var mitte = function () { return { x: groesse.w / 2, y: groesse.h / 2 }; };
  $('zoom-plus').addEventListener('click', function () { bed.zoomUm(mitte(), 1.25); });
  $('zoom-minus').addEventListener('click', function () { bed.zoomUm(mitte(), 0.8); });
  $('zoom-fit').addEventListener('click', function () { bed.einpassen(); });

  document.addEventListener('keydown', function (e) {
    var t = e.target, tippen = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !tippen) { e.preventDefault(); rueckgaengig(); return; }
    if (tippen) return;
    if (e.key === 'Escape') { if (!bed.escape()) waehle(null); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (st.auswahl) { e.preventDefault(); loeschen(); } }
    else if (e.key === 'r' || e.key === 'R') drehen();
  });

  // ---------------------------------------------------------------- Start

  (function laden() {
    var text = null;
    try { text = localStorage.getItem(SPEICHER); } catch (e) { /* kein Speicher */ }
    var x = text ? M.importiere(text) : null;
    st.doc = x && x.ok ? x.doc : M.neu();
    rechne();
    eigenschaften();
    bed.einpassen();
    werte();
  })();

  // Für Tests im Browser
  window.Labor = { st: st, bed: bed, setzeLauf: setzeLauf, neuesDoc: neuesDoc };
})();
