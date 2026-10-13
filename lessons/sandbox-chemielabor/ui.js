// Atom- & Chemielabor · kleine Hilfen für die Oberfläche (DOM, SVG, gemeinsamer Zustand zwischen den Reitern)
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var NS = 'http://www.w3.org/2000/svg';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /** SVG-Element mit Attributen erzeugen und optional anhängen. */
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(e);
    return e;
  }

  function leeren(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function $(id) { return document.getElementById(id); }

  /** Zahl deutsch formatiert (über LK.fmt aus dem lesson-kit). */
  function fmt(x, stellen) { return root.LK ? root.LK.fmt(x, stellen) : String(x); }

  /** Kachel für .readouts */
  function readout(wert, beschriftung, titel) {
    return '<div class="readout"' + (titel ? ' title="' + esc(titel) + '"' : '') + '><b>' + wert + '</b><span>' + esc(beschriftung) + '</span></div>';
  }

  var bewegungReduziert = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // gemeinsamer Zustand + einfache Ereignisse zwischen den Reitern
  var hoerer = {};
  var zustand = { z: 6 };
  function an(name, fn) { (hoerer[name] = hoerer[name] || []).push(fn); }
  function melde(name, daten) { (hoerer[name] || []).forEach(function (fn) { fn(daten); }); }

  /** Elementauswahl-Liste füllen (alle 118 oder bis maxZ). */
  function elementOptionen(select, maxZ, filter) {
    var C = CL.chemie;
    select.innerHTML = C.elemente.filter(function (e) { return e.z <= (maxZ || 118) && (!filter || filter(e)); })
      .map(function (e) { return '<option value="' + e.z + '">' + e.z + ' · ' + esc(e.symbol) + ' · ' + esc(e.name) + '</option>'; }).join('');
  }

  CL.ui = {
    esc: esc, svg: svg, leeren: leeren, $: $, fmt: fmt, readout: readout, bewegungReduziert: bewegungReduziert,
    zustand: zustand, an: an, melde: melde, elementOptionen: elementOptionen, ansichten: {},
  };
})(window);
