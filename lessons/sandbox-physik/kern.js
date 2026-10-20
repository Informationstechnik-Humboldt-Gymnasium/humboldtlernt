// Physik-Labor · gemeinsamer Kern ohne DOM (getestet in test/physiklabor.test.mjs)
//
//   PL.eingabe.lies(text)                 Zahl aus Texteingabe („1,5“, „−2“, „0.25“) oder NaN
//   PL.eingabe.pruefe(text, grenzen)      { ok, wert, fehler } mit verständlicher Fehlermeldung
//   PL.eingabe.antwort(text, soll, tol)   'richtig' | 'falsch' | 'ungueltig' (Lernmodus)
//   PL.skala(min, max, n)                 „runde“ Achseneinteilung für Diagramme
//   PL.uhr(raf, caf)                      genau eine Animationsschleife für das ganze Labor
//   PL.lauf(uhr, optionen)                Start / Pause / Fortsetzen / Zurücksetzen einer Simulation
(function (root) {
  'use strict';
  var PL = root.PL || (root.PL = {});

  // ---------------------------------------------------------------- Eingaben
  var ZAHL = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;
  function lies(text) {
    if (typeof text === 'number') return isFinite(text) ? text : NaN;
    var s = String(text == null ? '' : text).trim().replace(/−/g, '-').replace(/\s+/g, '');
    if (!ZAHL.test(s)) return NaN;
    return Number(s.replace(',', '.'));
  }
  function zahlText(x) {
    return Number(x).toLocaleString('de-DE', { maximumFractionDigits: 6 });
  }
  /** grenzen: { min, max, einheit } */
  function pruefe(text, g) {
    var x = lies(text), e = g && g.einheit ? ' ' + g.einheit : '';
    if (isNaN(x)) return { ok: false, wert: NaN, fehler: 'Bitte eine Zahl eingeben (z. B. 2,5).' };
    if (g && (x < g.min || x > g.max)) {
      return { ok: false, wert: x, fehler: 'Erlaubt sind Werte von ' + zahlText(g.min) + e + ' bis ' + zahlText(g.max) + e + '.' };
    }
    return { ok: true, wert: x, fehler: '' };
  }
  /** Antwort im Lernmodus prüfen: relative Toleranz tol (z. B. 0,03 = 3 %), mindestens abs */
  function antwort(text, soll, tol, abs) {
    var x = lies(text);
    if (isNaN(x)) return 'ungueltig';
    var grenze = Math.max(Math.abs(soll) * (tol || 0), abs || 0);
    return Math.abs(x - soll) <= grenze + 1e-12 ? 'richtig' : 'falsch';
  }
  PL.eingabe = { lies: lies, pruefe: pruefe, antwort: antwort };

  // ---------------------------------------------------------------- Achseneinteilung
  function rundeSchritt(roh) {
    if (!(roh > 0) || !isFinite(roh)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(roh))), q = roh / p;
    return (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * p;
  }
  /** Einteilung mit etwa n Abschnitten, die [min, max] vollständig enthält. */
  function skala(min, max, n) {
    n = n || 5;
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (max < min) { var t = min; min = max; max = t; }
    if (max - min < 1e-9) { var d = Math.abs(max) > 1e-9 ? Math.abs(max) * 0.5 : 1; min -= d; max += d; }
    var schritt = rundeSchritt((max - min) / n);
    var a = Math.floor(min / schritt + 1e-9) * schritt, b = Math.ceil(max / schritt - 1e-9) * schritt;
    var werte = [];
    for (var v = a, i = 0; v <= b + schritt * 1e-6 && i < 50; v += schritt, i++) werte.push(Math.abs(v) < schritt * 1e-9 ? 0 : +v.toPrecision(12));
    var stellen = Math.max(0, -Math.floor(Math.log10(schritt) + 1e-9));
    if (Math.abs(schritt * Math.pow(10, stellen) - Math.round(schritt * Math.pow(10, stellen))) > 1e-9) stellen++;
    return { min: a, max: b, schritt: schritt, werte: werte, stellen: stellen };
  }
  PL.skala = skala;

  // ---------------------------------------------------------------- eine Schleife für alles
  /**
   * Es gibt im ganzen Labor nur diese eine Schleife. an(fn) übergibt sie an eine Simulation
   * (eine vorherige verliert sie), aus(fn) gibt sie frei. raf/caf sind austauschbar (Tests).
   */
  function uhr(raf, caf) {
    var fn = null, id = null, last = null, beiEntzug = null;
    function frame(ts) {
      id = null;
      if (!fn) return;
      var dt = last === null ? 0 : Math.max(0, (ts - last) / 1000);
      last = ts;
      fn(dt);
      if (fn && id === null) id = raf(frame);
    }
    return {
      an: function (f, entzug) {
        if (fn && fn !== f && beiEntzug) { var e = beiEntzug; beiEntzug = null; e(); }
        fn = f; beiEntzug = entzug || null; last = null;
        if (id === null) id = raf(frame);
      },
      aus: function (f) {
        if (f && fn !== f) return;
        fn = null; beiEntzug = null; last = null;
        if (id !== null) { caf(id); id = null; }
      },
      get laeuft() { return !!fn; },
      get wartet() { return id !== null; },
    };
  }
  PL.uhr = uhr;

  /**
   * Ablauf einer Simulation. optionen:
   *   schritt(dt)      Physik um dt Sekunden (Simulationszeit) weiterrechnen; true = Versuch beendet
   *   zeichne()        aktuellen Zustand anzeigen
   *   zuruecksetzen()  Anfangszustand herstellen
   *   gemeldet(z)      Zustand hat gewechselt ('bereit' | 'laeuft' | 'pause' | 'fertig')
   *   maxDt            größter Zeitschritt pro Bild in echten Sekunden (Standard 0,1 s)
   */
  function lauf(u, o) {
    var L = { zustand: 'bereit', tempo: 1 };
    function setze(z) { if (L.zustand !== z) { L.zustand = z; if (o.gemeldet) o.gemeldet(z); } }
    function tick(dtEcht) {
      if (L.zustand !== 'laeuft') return;
      var dt = Math.min(dtEcht, o.maxDt || 0.1) * L.tempo;
      var fertig = dt > 0 ? o.schritt(dt) : false;
      o.zeichne();
      if (fertig) { u.aus(tick); setze('fertig'); }
    }
    function entzogen() { if (L.zustand === 'laeuft') setze('pause'); }
    L.start = function () {
      if (L.zustand === 'laeuft') return;
      if (L.zustand === 'fertig') { o.zuruecksetzen(); o.zeichne(); }
      setze('laeuft');
      u.an(tick, entzogen);
    };
    L.pause = function () {
      if (L.zustand !== 'laeuft') return;
      u.aus(tick);
      setze('pause');
    };
    L.umschalten = function () { if (L.zustand === 'laeuft') L.pause(); else L.start(); };
    L.zuruecksetzen = function () {
      u.aus(tick);
      o.zuruecksetzen();
      o.zeichne();
      setze('bereit');
    };
    /** Ohne Animation bis zum Ende rechnen (z. B. bei reduzierter Bewegung). */
    L.bisEnde = function (schritt, max) {
      u.aus(tick);
      if (L.zustand === 'fertig') return true;
      var n = 0, fertig = false;
      while (!fertig && n < (max || 200000)) { fertig = o.schritt(schritt || 0.01); n++; }
      o.zeichne();
      setze(fertig ? 'fertig' : 'pause');
      return fertig;
    };
    L.beenden = function () { u.aus(tick); setze('fertig'); };
    return L;
  }
  PL.lauf = lauf;
})(typeof window !== 'undefined' ? window : this);
