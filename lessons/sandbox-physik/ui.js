// Physik-Labor · gemeinsame Bausteine der Oberfläche (die Physik steckt in fall.js, wurf.js, …)
//
//   U.regler(box, o)          Schieberegler + Zahlenfeld mit Einheit und Prüfung der Eingabe
//   U.schalter(box, o)        Ein/Aus-Knopf mit aria-pressed
//   U.seg(box, optionen, …)   Umschalter
//   U.steuerung(box, lauf, o) Start/Pause/Fortsetzen, Zurücksetzen, Ergebnis berechnen, Tempo
//   U.messwerte(box, liste)   Messwertanzeige
//   U.pfeil(svg, …)           Pfeil mit Spitze (Kräfte, Geschwindigkeiten)
//   U.werkbank(section, o)    Grundgerüst einer Simulation
//   U.aufgaben(box, liste, o) Lernmodus: Vermutung → Experiment → Ergebnis prüfen, Hinweise, Erklärung
(function (root) {
  'use strict';
  var PL = root.PL, NS = 'http://www.w3.org/2000/svg';
  var zaehler = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function setzeAttr(e, attrs) {
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    return e;
  }
  function svg(tag, attrs, parent) { var e = setzeAttr(document.createElementNS(NS, tag), attrs); if (parent) parent.appendChild(e); return e; }
  function html(tag, attrs, parent) { var e = setzeAttr(document.createElement(tag), attrs); if (parent) parent.appendChild(e); return e; }
  function leeren(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function fmt(x, stellen) { return root.LK ? root.LK.fmt(x, stellen) : String(x); }
  /** Zahl mit sinnvoller Stellenzahl: große Werte ohne, kleine mit mehr Nachkommastellen */
  function fmtAuto(x, stellen) {
    if (!isFinite(x)) return '–';
    if (stellen !== undefined) return fmt(x, stellen);
    var a = Math.abs(x);
    return fmt(x, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4);
  }
  function id(p) { zaehler++; return 'pl-' + (p || 'e') + '-' + zaehler; }
  var reduziert = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------------------------------------------------------------- Regler
  /**
   * o: { name (HTML erlaubt), einheit, min, max, schritt, wert, stellen, hilfe, beiAenderung(wert) }
   * Schieberegler und Zahlenfeld zeigen immer denselben Wert. Ungültige Eingaben werden gemeldet
   * und nicht übernommen; beim Verlassen des Felds gilt wieder der letzte gültige Wert.
   */
  function regler(box, o) {
    var rid = id('r'), wrap = html('div', { class: 'pl-regler' }, box);
    var kopf = html('div', { class: 'pl-regler-kopf' }, wrap);
    html('label', { for: rid + '-z', html: o.name }, kopf);
    var zahlBox = html('span', { class: 'pl-zahl' }, kopf);
    var zahl = html('input', { id: rid + '-z', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': rid + '-f' }, zahlBox);
    if (o.einheit) html('span', { class: 'einheit', text: o.einheit }, zahlBox);
    var range = html('input', { type: 'range', min: o.min, max: o.max, step: o.schritt, 'aria-label': (o.label || stripTags(o.name)) + (o.einheit ? ' in ' + o.einheit : '') }, wrap);
    var fehler = html('p', { class: 'pl-fehler', id: rid + '-f', role: 'status' }, wrap);
    fehler.hidden = true;
    if (o.hilfe) html('p', { class: 'pl-hilfe small muted', html: o.hilfe }, wrap);
    var R = { wert: o.wert, el: wrap };
    var grenzen = { min: o.min, max: o.max, einheit: o.einheit };
    function zeigeWert() {
      range.value = R.wert;
      zahl.value = fmt(R.wert, o.stellen === undefined ? 2 : o.stellen).replace(/ /g, '');
      zahl.removeAttribute('aria-invalid');
    }
    function meldung(text) { fehler.textContent = text || ''; fehler.hidden = !text; }
    R.setze = function (w, still) {
      R.wert = Math.max(o.min, Math.min(o.max, w));
      zeigeWert(); meldung('');
      if (!still && o.beiAenderung) o.beiAenderung(R.wert);
    };
    range.addEventListener('input', function () { R.setze(Number(range.value)); });
    zahl.addEventListener('input', function () {
      var p = PL.eingabe.pruefe(zahl.value, grenzen);
      zahl.toggleAttribute('aria-invalid', !p.ok);
      meldung(p.ok ? '' : p.fehler);
    });
    function uebernehmen() {
      var p = PL.eingabe.pruefe(zahl.value, grenzen);
      if (p.ok) { if (p.wert !== R.wert) R.setze(p.wert); else zeigeWert(); return true; }
      meldung(p.fehler);
      zahl.setAttribute('aria-invalid', 'true');
      return false;
    }
    zahl.addEventListener('change', uebernehmen);
    zahl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); uebernehmen(); } });
    zahl.addEventListener('blur', function () {
      if (!PL.eingabe.pruefe(zahl.value, grenzen).ok) {
        var alt = fehler.textContent;
        zeigeWert();
        meldung(alt + ' Es gilt weiter ' + fmt(R.wert, o.stellen === undefined ? 2 : o.stellen) + (o.einheit ? ' ' + o.einheit : '') + '.');
      }
    });
    R.sperren = function (an) { range.disabled = !!an; zahl.disabled = !!an; wrap.classList.toggle('gesperrt', !!an); };
    zeigeWert();
    return R;
  }
  function stripTags(s) { var d = document.createElement('div'); d.innerHTML = s; return d.textContent; }

  function schalter(box, o) {
    var b = html('button', { type: 'button', class: 'pl-schalter', 'aria-pressed': o.an ? 'true' : 'false', html: o.text }, box);
    var S = { an: !!o.an, el: b };
    S.setze = function (an, still) { S.an = !!an; b.setAttribute('aria-pressed', S.an ? 'true' : 'false'); if (!still && o.beiAenderung) o.beiAenderung(S.an); };
    b.addEventListener('click', function () { S.setze(!S.an); });
    return S;
  }

  function seg(box, optionen, wert, fn, label) {
    leeren(box);
    box.classList.add('seg');
    box.setAttribute('role', 'group');
    if (label) box.setAttribute('aria-label', label);
    optionen.forEach(function (op) {
      var b = html('button', { type: 'button', html: op.text, 'aria-pressed': String(op.wert) === String(wert) ? 'true' : 'false', 'data-wert': op.wert }, box);
      if (op.titel) b.title = op.titel;
      b.addEventListener('click', function () { segSetze(box, op.wert); fn(op.wert); });
    });
    return box;
  }
  function segSetze(box, wert) {
    box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-wert') === String(wert) ? 'true' : 'false'); });
  }

  /** Feld zur Wahl der Gravitationsbeschleunigung: Himmelskörper + Regler */
  var ORTE = [
    { wert: 1.62, text: 'Mond' }, { wert: 3.71, text: 'Mars' }, { wert: 9.81, text: 'Erde' }, { wert: 24.79, text: 'Jupiter' },
  ];
  function gravitation(box, wert, fn) {
    var feld = html('div', { class: 'pl-feld' }, box);
    var s = html('div', { class: 'pl-orte' }, feld);
    var R = regler(feld, { name: 'Ortsfaktor <span class="f">g</span>', einheit: 'm/s²', min: 0.5, max: 30, schritt: 0.01, wert: wert, stellen: 2,
      hilfe: 'Werte an der Oberfläche (gerundet). 1 m/s² = 1 N/kg.',
      beiAenderung: function (w) { segSetze(s, w); fn(w); } });
    seg(s, ORTE.map(function (o) { return { wert: o.wert, text: o.text, titel: fmt(o.wert, 2) + ' m/s²' }; }), wert, function (w) { R.setze(w); }, 'Himmelskörper');
    return { setze: function (w, still) { R.setze(w, still); segSetze(s, w); }, get wert() { return R.wert; } };
  }

  // ---------------------------------------------------------------- Steuerung
  var TEMPI = [{ wert: 0.1, text: '0,1×' }, { wert: 0.25, text: '0,25×' }, { wert: 0.5, text: '0,5×' }, { wert: 1, text: '1×' }, { wert: 2, text: '2×' }];
  var STATUS = { bereit: 'bereit', laeuft: 'läuft', pause: 'pausiert', fertig: 'beendet' };
  /** o: { ende: true (Knopf „Ergebnis berechnen“), endeText, tempo: true } */
  function steuerung(box, lauf, o) {
    o = o || {};
    var reihe = html('div', { class: 'pl-steuerung' }, box);
    var bStart = html('button', { type: 'button', class: 'primary pl-start' }, reihe);
    var bReset = html('button', { type: 'button', text: '↺ Zurücksetzen' }, reihe);
    var bEnde = o.ende ? html('button', { type: 'button', text: o.endeText || '⏭ Ergebnis berechnen', title: 'ohne Animation bis zum Ende rechnen' }, reihe) : null;
    var status = html('span', { class: 'pl-status', role: 'status' }, reihe);
    if (o.tempo !== false) {
      var t = html('div', { class: 'pl-tempo' }, reihe);
      html('span', { class: 'small muted', text: 'Tempo' }, t);
      seg(html('div', {}, t), TEMPI, lauf.tempo, function (w) { lauf.tempo = w; }, 'Simulationsgeschwindigkeit');
    }
    var zusatz = '';
    function zeige() {
      var z = lauf.zustand;
      bStart.textContent = z === 'laeuft' ? '❚❚ Pause' : z === 'pause' ? '▶ Fortsetzen' : z === 'fertig' ? '▶ Noch einmal' : '▶ Start';
      bStart.setAttribute('aria-label', z === 'laeuft' ? 'Simulation anhalten' : z === 'pause' ? 'Simulation fortsetzen' : 'Simulation starten');
      status.textContent = STATUS[z] + (zusatz ? ' · ' + zusatz : '');
      status.setAttribute('data-zustand', z);
      if (bEnde) bEnde.disabled = z === 'fertig';
    }
    bStart.addEventListener('click', function () { lauf.umschalten(); });
    bReset.addEventListener('click', function () { lauf.zuruecksetzen(); });
    if (bEnde) bEnde.addEventListener('click', function () { lauf.bisEnde(o.endeSchritt || 0.005); });
    if (reduziert && o.ende) html('p', { class: 'small muted pl-reduziert', text: 'Reduzierte Bewegung ist eingestellt: Mit „Ergebnis berechnen“ erhältst du die Messwerte ohne Animation.' }, box);
    zeige();
    return { zeige: zeige, setzeZusatz: function (s) { zusatz = s || ''; zeige(); }, startKnopf: bStart };
  }

  // ---------------------------------------------------------------- Messwerte
  /** liste: [{ id, name (HTML), einheit }] */
  function messwerte(box, liste) {
    var r = html('div', { class: 'readouts pl-messwerte', 'aria-live': 'off' }, box), felder = {};
    liste.forEach(function (m) {
      var d = html('div', { class: 'readout' }, r);
      var b = html('b', {}, d);
      var w = html('span', { class: 'wert', text: '–' }, b);
      if (m.einheit) html('span', { class: 'einheit', text: ' ' + m.einheit }, b);
      html('span', { class: 'name', html: m.name }, d);
      felder[m.id] = { w: w, d: d };
    });
    return {
      setze: function (idx, text) { if (felder[idx]) felder[idx].w.textContent = text; },
      alle: function (o) { Object.keys(o).forEach(function (k) { if (felder[k]) felder[k].w.textContent = o[k]; }); },
      markiere: function (idx, an) { if (felder[idx]) felder[idx].d.classList.toggle('hervor', !!an); },
    };
  }

  // ---------------------------------------------------------------- Zeichnen
  /** Pfeil von (x1|y1) nach (x2|y2); klasse färbt Linie und Spitze. Gibt die Gruppe zurück. */
  function pfeil(parent, x1, y1, x2, y2, klasse, spitze) {
    var g = svg('g', { class: 'pl-pfeil ' + (klasse || '') }, parent);
    var dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
    if (l < 0.5) return g;
    var s = Math.min(spitze || 9, l * 0.6), ux = dx / l, uy = dy / l;
    var bx = x2 - ux * s, by = y2 - uy * s;
    svg('line', { x1: r1(x1), y1: r1(y1), x2: r1(bx + ux * 0.5), y2: r1(by + uy * 0.5) }, g);
    svg('polygon', { points: r1(x2) + ',' + r1(y2) + ' ' + r1(bx - uy * s * 0.45) + ',' + r1(by + ux * s * 0.45) + ' ' + r1(bx + uy * s * 0.45) + ',' + r1(by - ux * s * 0.45) }, g);
    return g;
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  var ARTEN = {
    simulation: '<span class="art-etikett">Simulation</span> Rechenmodell mit vereinfachten Annahmen – die Grenzen stehen unter „Modell und Formeln“.',
    schema: '<span class="art-etikett">Schema</span> Gezeichnete Konstruktion im Strahlenmodell.',
  };
  function art(box, wer, zusatz) { box.innerHTML = ARTEN[wer] + (zusatz ? ' ' + zusatz : ''); }

  /**
   * Grundgerüst einer Simulation. o: { id, titel, einleitung, unter (Reiter) }
   * Gibt die Bereiche zurück: buehne, steuer, flaeche, art, messwerte, einstellungen, diagramm, modell, aufgaben, unter
   */
  function werkbank(section, o) {
    section.innerHTML =
      '<div class="pl-kopfzeile"><h1>' + esc(o.titel) + '</h1><p class="muted pl-einleitung">' + o.einleitung + '</p></div>' +
      (o.unter ? '<div class="pl-unter" id="' + o.id + '-unter"></div>' : '') +
      '<div class="pl-werkbank">' +
        '<div class="lk-card pl-buehne">' +
          '<div id="' + o.id + '-steuer"></div>' +
          '<div class="pl-flaeche" id="' + o.id + '-flaeche"></div>' +
          '<p class="pl-art small" id="' + o.id + '-art"></p>' +
          '<div id="' + o.id + '-messwerte"></div>' +
          '<div id="' + o.id + '-hinweis" class="pl-hinweise" aria-live="polite"></div>' +
        '</div>' +
        '<aside class="lk-card pl-seite"><h2>Einstellungen</h2><div id="' + o.id + '-einstellungen"></div></aside>' +
      '</div>' +
      '<div class="pl-unten">' +
        '<section class="lk-card pl-diagramm-karte" aria-label="Diagramm"><div id="' + o.id + '-diagramm"></div></section>' +
        '<section class="lk-card pl-modell" aria-label="Modell und Formeln"><div id="' + o.id + '-modell"></div></section>' +
      '</div>' +
      '<section class="lk-card pl-lernmodus" aria-labelledby="' + o.id + '-lm-titel"><div id="' + o.id + '-aufgaben"></div></section>';
    var B = {};
    ['steuer', 'flaeche', 'art', 'messwerte', 'hinweis', 'einstellungen', 'diagramm', 'modell', 'aufgaben', 'unter'].forEach(function (k) { B[k] = $(o.id + '-' + k); });
    B.lmTitelId = o.id + '-lm-titel';
    return B;
  }

  /** Hinweise/Warnungen unter der Simulation: liste [{ text, art: 'info'|'warn' }] */
  function hinweise(box, liste) {
    leeren(box);
    (liste || []).forEach(function (h) { html('p', { class: 'pl-hinweis ' + (h.art || 'info'), html: h.text }, box); });
  }

  /** Einstellungsgruppe mit Überschrift */
  function gruppe(box, titel) {
    var g = html('div', { class: 'pl-gruppe' }, box);
    if (titel) html('p', { class: 'pl-gruppe-titel', html: titel }, g);
    return g;
  }

  // ---------------------------------------------------------------- Lernmodus
  /**
   * Experimentieraufgaben aus PL.aufgaben. o: { einstellen(param) (setzt die Simulation), titelId }
   * Ablauf je Aufgabe: 1 Vermutung festhalten → 2 Versuch durchführen → 3 Ergebnis prüfen.
   * Hinweise gibt es einzeln; die Lösung erst nach einem Versuch oder allen Hinweisen.
   */
  function aufgaben(box, liste, o) {
    leeren(box);
    var kopf = html('div', { class: 'pl-lm-kopf' }, box);
    html('h2', { id: o.titelId, html: 'Lernmodus <span class="muted small">· Experimentieraufgaben</span>' }, kopf);
    var stand = html('span', { class: 'pl-lm-stand small' }, kopf);
    html('p', { class: 'small muted', text: 'Stelle zuerst eine Vermutung auf, prüfe sie dann im Versuch. Hinweise helfen, wenn du nicht weiterkommst.' }, box);
    var geloest = 0;
    function zaehle() { stand.textContent = geloest + ' / ' + liste.length + ' gelöst'; }
    liste.forEach(function (a, i) {
      var d = html('details', { class: 'pl-aufgabe' }, box);
      if (i === 0) d.open = true;
      var sum = html('summary', {}, d);
      html('span', { class: 'pl-haken', 'aria-hidden': 'true', text: '○' }, sum);
      html('span', { text: (i + 1) + '. ' + a.titel }, sum);
      var innen = html('div', { class: 'pl-aufgabe-innen' }, d);
      html('p', { class: 'pl-frage', html: '<b>' + esc(a.frage) + '</b>' }, innen);

      // 1 Vermutung
      var s1 = html('div', { class: 'pl-schritt aktiv' }, innen);
      html('p', { class: 'pl-schritt-titel', text: '1 · Deine Vermutung' }, s1);
      var verm = null, s1Eingabe = html('div', { class: 'pl-antwort' }, s1);
      var s2 = html('div', { class: 'pl-schritt' }, innen), s3 = html('div', { class: 'pl-schritt' }, innen);
      s2.hidden = true; s3.hidden = true;
      function weiter(text) {
        verm = text;
        leeren(s1Eingabe);
        html('p', { class: 'pl-vermutung', html: 'Festgehalten: <b>' + esc(text) + '</b>' }, s1Eingabe);
        s1.classList.remove('aktiv'); s2.hidden = false; s3.hidden = false; s2.classList.add('aktiv'); s3.classList.add('aktiv');
      }
      if (a.vermutung.art === 'zahl') {
        var vz = html('span', { class: 'pl-zahl' }, s1Eingabe);
        var vin = html('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Vermutung' + (a.vermutung.einheit ? ' in ' + a.vermutung.einheit : '') }, vz);
        if (a.vermutung.einheit) html('span', { class: 'einheit', text: a.vermutung.einheit }, vz);
        var vb = html('button', { type: 'button', text: 'Vermutung festhalten' }, s1Eingabe);
        var vf = html('p', { class: 'pl-fehler', role: 'status' }, s1Eingabe); vf.hidden = true;
        var fest = function () {
          var x = PL.eingabe.lies(vin.value);
          if (isNaN(x)) { vf.textContent = 'Bitte schätze eine Zahl, z. B. 3 oder 2,5.'; vf.hidden = false; vin.focus(); return; }
          weiter(fmtAuto(x) + (a.vermutung.einheit ? ' ' + a.vermutung.einheit : ''));
        };
        vb.addEventListener('click', fest);
        vin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fest(); } });
      } else {
        var vc = html('div', { class: 'choices' }, s1Eingabe);
        a.pruefen.optionen.forEach(function (op) {
          html('button', { type: 'button', text: op.text }, vc).addEventListener('click', function () { weiter(op.text); });
        });
      }

      // 2 Experiment
      html('p', { class: 'pl-schritt-titel', text: '2 · Experiment' }, s2);
      html('p', { text: a.auftrag }, s2);
      var be = html('button', { type: 'button', text: '⚙ Versuch einstellen' }, s2);
      be.addEventListener('click', function () { o.einstellen(a.einstellen); });

      // 3 Ergebnis prüfen
      html('p', { class: 'pl-schritt-titel', text: '3 · Ergebnis prüfen' }, s3);
      var antwort = html('div', { class: 'pl-antwort' }, s3), fb = html('p', { class: 'fb pl-fb', role: 'status' }, s3);
      var hilfe = html('div', { class: 'pl-hilfen' }, s3), hinweisListe = html('ol', { class: 'pl-hinweisliste small' }, s3);
      var bH = html('button', { type: 'button', class: 'pl-klein' }, hilfe), bL = html('button', { type: 'button', class: 'pl-klein', text: 'Lösung zeigen' }, hilfe);
      bL.hidden = true;
      var erkl = html('div', { class: 'pl-erklaerung' }, s3); erkl.hidden = true;
      var gezeigt = 0, versuche = 0, fertig = false;
      function hKnopf() { bH.textContent = gezeigt < a.hinweise.length ? '💡 Hinweis ' + (gezeigt + 1) + ' von ' + a.hinweise.length : 'Alle Hinweise gezeigt'; bH.disabled = gezeigt >= a.hinweise.length; }
      hKnopf();
      bH.addEventListener('click', function () {
        if (gezeigt >= a.hinweise.length) return;
        html('li', { text: a.hinweise[gezeigt] }, hinweisListe); gezeigt++; hKnopf();
        if (gezeigt >= a.hinweise.length && !fertig) bL.hidden = false;
      });
      function abschluss(richtig) {
        if (fertig) return;
        fertig = true;
        erkl.hidden = false;
        erkl.innerHTML = '<p><b>' + (richtig ? 'Erklärung' : 'Lösung') + ':</b> ' + esc(a.erklaerung) + '</p>' +
          (verm ? '<p class="small muted">Deine Vermutung war: ' + esc(verm) + '. Vergleiche sie mit dem Ergebnis.</p>' : '');
        bL.hidden = true; bH.disabled = true;
        antwort.querySelectorAll('button, input').forEach(function (x) { x.disabled = true; });
        if (richtig) { d.classList.add('geloest'); sum.querySelector('.pl-haken').textContent = '✓'; geloest++; zaehle(); }
      }
      bL.addEventListener('click', function () {
        fb.textContent = a.pruefen.art === 'zahl' ? 'Richtig ist etwa ' + fmtAuto(a.pruefen.loesung) + ' ' + a.pruefen.einheit + '.' : 'Richtig ist: ' + a.pruefen.optionen.filter(function (x) { return x.ok; })[0].text;
        abschluss(false);
      });
      function falsch() { versuche++; if (versuche >= 2) bL.hidden = false; }
      if (a.pruefen.art === 'zahl') {
        var az = html('span', { class: 'pl-zahl' }, antwort);
        var ain = html('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Messergebnis in ' + a.pruefen.einheit }, az);
        html('span', { class: 'einheit', text: a.pruefen.einheit }, az);
        var ab = html('button', { type: 'button', class: 'primary', text: 'Prüfen' }, antwort);
        var pruefe = function () {
          var e = PL.eingabe.antwort(ain.value, a.pruefen.loesung, a.pruefen.toleranz, a.pruefen.abs);
          fb.classList.toggle('falsch', e !== 'richtig');
          if (e === 'ungueltig') { fb.textContent = 'Bitte gib eine Zahl ein (z. B. 2,5).'; return; }
          if (e === 'richtig') { fb.textContent = '✓ Stimmt – das passt zum Ergebnis von ' + fmtAuto(a.pruefen.loesung) + ' ' + a.pruefen.einheit + '.'; abschluss(true); return; }
          var x = PL.eingabe.lies(ain.value);
          fb.textContent = 'Noch nicht. Dein Wert ist ' + (x > a.pruefen.loesung ? 'zu groß' : 'zu klein') + '. Wiederhole den Versuch oder hol dir einen Hinweis.';
          falsch();
        };
        ab.addEventListener('click', pruefe);
        ain.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pruefe(); } });
      } else {
        var ac = html('div', { class: 'choices' }, antwort);
        a.pruefen.optionen.forEach(function (op) {
          var b = html('button', { type: 'button', text: op.text }, ac);
          b.addEventListener('click', function () {
            ac.querySelectorAll('button').forEach(function (x) { x.classList.remove('wrong'); });
            b.classList.add(op.ok ? 'right' : 'wrong');
            fb.classList.toggle('falsch', !op.ok);
            fb.textContent = (op.ok ? '✓ ' : '') + op.fb;
            if (op.ok) abschluss(true); else falsch();
          });
        });
      }
    });
    zaehle();
  }

  PL.ui = {
    $: $, esc: esc, svg: svg, html: html, leeren: leeren, fmt: fmt, fmtAuto: fmtAuto, id: id, reduziert: reduziert,
    regler: regler, schalter: schalter, seg: seg, segSetze: segSetze, gravitation: gravitation, steuerung: steuerung,
    messwerte: messwerte, pfeil: pfeil, art: art, werkbank: werkbank, hinweise: hinweise, gruppe: gruppe, aufgaben: aufgaben,
  };
  PL.module = PL.module || {};
  // gemeinsame Schleife für das ganze Labor
  PL.takt = PL.uhr(function (f) { return root.requestAnimationFrame(f); }, function (i) { root.cancelAnimationFrame(i); });
})(window);
