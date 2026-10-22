// HTML-Sandbox · Brücke in der Vorschau
// HS.bruecke wird NICHT im Editor ausgeführt: ide.js fügt den Quelltext dieser Funktion als <script> ganz vorn in das
// Vorschau-Dokument ein (iframe mit sandbox="allow-scripts", ohne allow-same-origin). Dort
//  - leitet sie console.log/warn/error, JavaScript-Fehler und nicht ladbare Bilder an den Editor weiter,
//  - merkt sich für jedes Element seine Position im Code (data-src-start/-end) und entfernt die Attribute wieder,
//    damit der Schülercode sie nie sieht,
//  - meldet Klicks im Inspektor-Modus (oder mit Alt) als „springe zu Zeichen … bis …“,
//  - zeigt den Hover-Rahmen mit Tag-Namen und passenden CSS-Regeln und hebt Elemente hervor, auf denen im Editor der Cursor steht,
//  - hält Links und Formulare in der Sandbox fest und bricht Endlosschleifen ab.
// Kommunikation nur über postMessage. Die Funktion darf keine Variablen von außen benutzen.
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  HS.bruecke = function (konfig) {
    'use strict';
    var eltern = window.parent;
    var post = function (d) { d.hs = 'vorschau'; d.lauf = konfig.lauf; try { eltern.postMessage(d, '*'); } catch (e) { /* nicht übertragbar */ } };
    var inspektor = !!konfig.inspektor;

    // ------------------------------------------------------------ Positionen im Code
    var orte = new WeakMap(), nachStart = new Map();
    function merke(el) {
      var s = el.getAttribute('data-src-start');
      if (s === null) return;
      var o = { s: +s, e: +el.getAttribute('data-src-end') };
      orte.set(el, o); nachStart.set(o.s, el);
      el.removeAttribute('data-src-start'); el.removeAttribute('data-src-end');
    }
    function alleMerken(wurzel) { merke(wurzel); var l = wurzel.querySelectorAll('[data-src-start]'); for (var i = 0; i < l.length; i++) merke(l[i]); }
    alleMerken(document.documentElement);
    new MutationObserver(function (liste) {
      for (var i = 0; i < liste.length; i++) {
        var n = liste[i].addedNodes;
        for (var k = 0; k < n.length; k++) if (n[k].nodeType === 1) alleMerken(n[k]);
      }
    }).observe(document, { childList: true, subtree: true });
    // nächstes Element (selbst oder Vorfahr) mit Position – per JavaScript erzeugte Elemente haben keine
    function mitOrt(el) { while (el && el.nodeType === 1) { if (orte.has(el)) return el; el = el.parentElement || (el.parentNode && el.parentNode.host) || null; } return null; }

    // ------------------------------------------------------------ Konsole
    var KONSOLE = ['log', 'info', 'warn', 'error', 'debug', 'table', 'clear'];
    var original = {};
    function kurz(el) {
      var s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).join('.');
      return '<' + s + '>';
    }
    function darstellen(v, tiefe, gesehen) {
      var t = typeof v;
      if (t === 'string') return tiefe ? JSON.stringify(v) : v;
      if (t === 'number' || t === 'boolean' || t === 'bigint' || v === null || v === undefined) return String(v) + (t === 'bigint' ? 'n' : '');
      if (t === 'symbol') return v.toString();
      if (t === 'function') return 'ƒ ' + (v.name || 'anonym') + '()';
      try {
        if (v instanceof Element) return kurz(v);
        if (v instanceof Error) return v.name + ': ' + v.message;
        if (v instanceof Date) return v.toString();
        if (v instanceof RegExp) return String(v);
        if (v === window) return 'Window';
        if (v === document) return '#document';
        if (gesehen.indexOf(v) >= 0) return '[zirkulär]';
        if (tiefe > 2) return Array.isArray(v) ? '[…]' : '{…}';
        gesehen = gesehen.concat([v]);
        var liste = Array.isArray(v) || (typeof NodeList !== 'undefined' && v instanceof NodeList) || (typeof HTMLCollection !== 'undefined' && v instanceof HTMLCollection);
        if (liste) {
          var teile = [];
          for (var i = 0; i < v.length && i < 50; i++) teile.push(darstellen(v[i], tiefe + 1, gesehen));
          if (v.length > 50) teile.push('… ' + (v.length - 50) + ' weitere');
          var name = Array.isArray(v) ? (v.length > 3 ? '(' + v.length + ') ' : '') : v.constructor.name + '(' + v.length + ') ';
          return name + '[' + teile.join(', ') + ']';
        }
        if (v instanceof Map) return 'Map(' + v.size + ') {' + Array.from(v).slice(0, 20).map(function (p) { return darstellen(p[0], tiefe + 1, gesehen) + ' => ' + darstellen(p[1], tiefe + 1, gesehen); }).join(', ') + '}';
        if (v instanceof Set) return 'Set(' + v.size + ') {' + Array.from(v).slice(0, 20).map(function (x) { return darstellen(x, tiefe + 1, gesehen); }).join(', ') + '}';
        var schluessel = Object.keys(v);
        var inhalt = schluessel.slice(0, 20).map(function (s) { return s + ': ' + darstellen(v[s], tiefe + 1, gesehen); });
        if (schluessel.length > 20) inhalt.push('…');
        var klasse = v.constructor && v.constructor.name && v.constructor.name !== 'Object' ? v.constructor.name + ' ' : '';
        return klasse + '{' + inhalt.join(', ') + '}';
      } catch (e) { return String(v); }
    }
    // Zeilennummern aus dem Aufrufstapel (die Zuordnung zur Datei macht der Editor)
    function stapelZeilen(stack) {
      var z = [];
      String(stack || '').split('\n').forEach(function (l) { var m = /srcdoc:(\d+):(\d+)/.exec(l); if (m) z.push([+m[1], +m[2]]); });
      return z;
    }
    // Flut bremsen: höchstens 200 Ausgaben pro Sekunde an den Editor (z. B. console.log in einer langen Schleife)
    var fenster = 0, imFenster = 0, unterdrueckt = 0;
    function melden() {
      if (unterdrueckt) post({ typ: 'konsole', art: 'warn', teile: [unterdrueckt + ' weitere Ausgaben wurden ausgelassen (zu viele auf einmal).'] });
      unterdrueckt = 0;
    }
    function darfSenden() {
      var t = Date.now();
      if (t - fenster > 1000) { melden(); fenster = t; imFenster = 0; }
      if (++imFenster > 200) { if (!unterdrueckt++) setTimeout(melden, 1100); return false; }
      return true;
    }
    KONSOLE.forEach(function (art) {
      original[art] = console[art];
      console[art] = function () {
        var args = Array.prototype.slice.call(arguments);
        if (art === 'clear') post({ typ: 'leeren' });
        else if (darfSenden()) {
          var teile = args.map(function (a) { return darstellen(a, 0, []); });
          // Platzhalter %s, %d, %o, %c (vereinfacht)
          if (typeof args[0] === 'string' && /%[sdifoOc]/.test(args[0]) && args.length > 1) {
            var rest = teile.slice(1), k = 0;
            var erster = args[0].replace(/%[sdifoOc]/g, function (p) { var r = rest[k++]; return p === '%c' ? '' : r === undefined ? p : r; });
            teile = [erster].concat(rest.slice(k));
          }
          post({ typ: 'konsole', art: art === 'debug' ? 'log' : art === 'table' ? 'log' : art, teile: teile, zeilen: stapelZeilen(new Error().stack).slice(1) });
        }
        if (original[art]) try { original[art].apply(console, args); } catch (e) { /* egal */ }
      };
    });

    // ------------------------------------------------------------ Fehler
    window.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t !== window && t.nodeType === 1) {                     // Bild, Skript o. Ä. nicht gefunden
        var quelle = t.getAttribute('src') || t.getAttribute('href') || '';
        var m = mitOrt(t), o = m && orte.get(m);
        post({ typ: 'konsole', art: 'warn', teile: ['Konnte nicht geladen werden: ' + kurz(t) + (quelle ? ' ' + quelle.slice(0, 120) : '')], ort: o ? o.s : null });
        return;
      }
      post({ typ: 'fehler', text: e.message || 'Fehler', zeile: e.lineno || 0, spalte: e.colno || 0, zeilen: stapelZeilen(e.error && e.error.stack) });
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      var r = e.reason;
      post({ typ: 'fehler', text: 'Uncaught (in promise) ' + (r && r.message ? r.name + ': ' + r.message : darstellen(r, 0, [])), zeile: 0, spalte: 0, zeilen: stapelZeilen(r && r.stack) });
    });

    // ------------------------------------------------------------ Schutz: Endlosschleifen und Dialog-Flut
    var schleifen = {};
    Object.defineProperty(window, '__hsSchleife', { value: function (datei, zeile) {
      var k = datei + ':' + zeile, t = performance.now(), s = schleifen[k];
      if (!s || t - s.letzt > 100) s = schleifen[k] = { start: t, letzt: t };
      s.letzt = t;
      if (t - s.start > 1500) { delete schleifen[k]; post({ typ: 'schleife', datei: datei, zeile: zeile }); return true; }
      return false;
    } });
    var dialoge = [];
    ['alert', 'confirm', 'prompt'].forEach(function (name) {
      var orig = window[name];
      window[name] = function () {
        var jetzt = Date.now();
        dialoge = dialoge.filter(function (t) { return jetzt - t < 10000; });
        if (dialoge.length >= 15) { post({ typ: 'konsole', art: 'warn', teile: [name + '() wurde unterdrückt: zu viele Dialoge hintereinander.'] }); return name === 'confirm' ? false : name === 'prompt' ? null : undefined; }
        dialoge.push(jetzt);
        try { return orig.apply(window, arguments); } catch (e) { return null; }
      };
    });

    // ------------------------------------------------------------ Überlagerung (Rahmen, Beschriftung) im Shadow-DOM
    var host = null, schatten = null, teile = {};
    function ueberlagerung() {
      if (host && host.isConnected) return;
      if (!host) {
        host = document.createElement('hs-vorschau-hilfe');
        host.setAttribute('style', 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;display:block!important');
        schatten = host.attachShadow({ mode: 'closed' });
        schatten.innerHTML = '<style>' +
          '.r{position:fixed;box-sizing:border-box;pointer-events:none;display:none}' +
          '.hover{background:rgba(66,153,225,.18);outline:2px solid #3b8eea;outline-offset:-1px}' +
          '.dezent{outline:2px dashed rgba(230,150,30,.95);outline-offset:1px;background:rgba(255,200,60,.08)}' +
          '.blitz{outline:3px solid #e8a33d;background:rgba(255,200,60,.25);transition:opacity .6s}' +
          '.marke{position:fixed;display:none;max-width:min(360px,90vw);font:12px/1.4 system-ui,sans-serif;background:#1f2430;color:#e6e6e6;border-radius:6px;padding:5px 8px;box-shadow:0 4px 14px rgba(0,0,0,.35);white-space:normal}' +
          '.marke b{color:#9cdcfe;font-weight:600}.marke .gr{color:#aaa}.marke .rg{color:#d7ba7d;display:block;font-family:ui-monospace,Consolas,monospace;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.marke .js{color:#f0b46b}' +
          '</style><div class="r hover"></div><div class="marke"></div><div class="dezent-box"></div>';
        teile.hover = schatten.querySelector('.hover');
        teile.marke = schatten.querySelector('.marke');
        teile.dezent = schatten.querySelector('.dezent-box');
      }
      document.documentElement.appendChild(host);
    }
    function box(div, el) {
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) { div.style.display = 'none'; return r; }
      div.style.cssText = 'display:block;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
      return r;
    }
    function passendeRegeln(el) {
      var aus = [];
      (konfig.regeln || []).forEach(function (r, i) {
        var sel = r.selektor.replace(/::?(before|after|first-line|first-letter|marker|placeholder|selection|backdrop)\b/gi, '').replace(/:(hover|focus|active|visited|focus-visible|focus-within)\b/gi, '');
        try { if (sel.trim() && el.matches(sel)) aus.push(i); } catch (e) { /* ungültiger Selektor */ }
      });
      return aus;
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    var hoverEl = null;
    function zeigeHover(el) {
      ueberlagerung();
      hoverEl = el;
      if (!el) { teile.hover.style.display = 'none'; teile.marke.style.display = 'none'; return; }
      var r = box(teile.hover, el);
      var regeln = passendeRegeln(el);
      var html = '<b>' + esc(kurz(el).slice(1, -1)) + '</b> <span class="gr">' + Math.round(r.width) + ' × ' + Math.round(r.height) + '</span>';
      if (!orte.has(el)) html += '<br><span class="js">per JavaScript erzeugt – Klick springt zum Elternelement</span>';
      regeln.slice(0, 5).forEach(function (i) { var g = konfig.regeln[i]; html += '<span class="rg">' + esc(g.datei + ':' + g.zeile + '  ' + g.selektor) + '</span>'; });
      if (regeln.length > 5) html += '<span class="gr">… und ' + (regeln.length - 5) + ' weitere Regeln</span>';
      var m = teile.marke;
      m.innerHTML = html; m.style.display = 'block';
      var mh = m.offsetHeight, mw = m.offsetWidth;
      var top = r.top - mh - 6 >= 0 ? r.top - mh - 6 : Math.min(window.innerHeight - mh - 2, r.bottom + 6);
      m.style.top = Math.max(2, top) + 'px';
      m.style.left = Math.max(2, Math.min(window.innerWidth - mw - 2, r.left)) + 'px';
    }

    // dezente Hervorhebung (Cursor im Editor) – folgt beim Scrollen
    var dezentListe = [];
    function zeichneDezent() {
      if (!teile.dezent) return;
      var html = '';
      dezentListe.forEach(function (el) {
        if (!el.isConnected) return;
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        html += '<div class="r dezent" style="display:block;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px"></div>';
      });
      teile.dezent.innerHTML = html;
    }
    function dezent(liste, sichtbarMachen) {
      ueberlagerung();
      dezentListe = liste.slice(0, 60);
      zeichneDezent();
      var el = dezentListe[0];
      if (sichtbarMachen && el && el.getBoundingClientRect) {
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    var scrollPlan = 0;
    window.addEventListener('scroll', function () {
      if (hoverEl) zeigeHover(hoverEl);
      zeichneDezent();
      clearTimeout(scrollPlan);
      scrollPlan = setTimeout(function () { post({ typ: 'scroll', x: window.scrollX, y: window.scrollY }); }, 250);
    }, true);
    window.addEventListener('resize', function () { zeichneDezent(); });

    // ------------------------------------------------------------ Klicks: Inspektor, Links, Formulare
    function springe(ziel) {
      var el = mitOrt(ziel);
      if (!el) return;
      var o = orte.get(el);
      post({ typ: 'sprung', start: o.s, ende: o.e, name: kurz(el), regeln: passendeRegeln(el), erzeugt: el !== ziel });
      // kurzes Aufleuchten in der Vorschau
      ueberlagerung();
      var b = document.createElement('div');
      b.className = 'r blitz';
      schatten.appendChild(b); box(b, el);
      setTimeout(function () { b.style.opacity = '0'; }, 500);
      setTimeout(function () { b.remove(); }, 1200);
    }
    function elementAus(e) { var t = e.target; if (t && t.nodeType !== 1) t = t.parentElement; return t && t.nodeType === 1 ? t : null; }
    // Im Inspektor-Modus lösen Klicks nichts aus. Gesprungen wird beim Loslassen (funktioniert auch mit Touch),
    // per Tastatur ausgelöste Klicks (detail 0) springen beim click-Ereignis.
    ['pointerdown', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'contextmenu'].forEach(function (typ) {
      window.addEventListener(typ, function (e) {
        if (!inspektor) return;
        e.preventDefault(); e.stopImmediatePropagation();
      }, true);
    });
    window.addEventListener('pointerup', function (e) {
      if (!inspektor) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.button > 0) return;
      var t = elementAus(e);
      if (t) springe(t);
    }, true);
    window.addEventListener('click', function (e) {
      if (!inspektor && !e.altKey) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var t = elementAus(e);
      if (t && (!inspektor || e.detail === 0)) springe(t);
    }, true);
    window.addEventListener('mousemove', function (e) {
      if (!inspektor) { if (hoverEl) zeigeHover(null); return; }
      var t = elementAus(e);
      if (t && t !== hoverEl && t !== host) zeigeHover(t);
    }, true);
    document.addEventListener('mouseleave', function () { if (inspektor) zeigeHover(null); });
    // Links bleiben in der Sandbox (Ereignis auf window: läuft nach den Handlern der Seite)
    window.addEventListener('click', function (e) {
      if (e.defaultPrevented) return;
      var t = elementAus(e), a = t && t.closest('a[href], area[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (/^javascript:/i.test(href)) return;
      e.preventDefault();
      if (href.charAt(0) === '#') {
        var id = decodeURIComponent(href.slice(1));
        var ziel = id ? document.getElementById(id) || document.getElementsByName(id)[0] : null;
        if (ziel) ziel.scrollIntoView({ behavior: 'smooth' }); else if (!id || id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      var name = href.replace(/^\.\//, '').split('#')[0].split('?')[0];
      if ((konfig.dateien || []).indexOf(name) >= 0 && /\.html?$/i.test(name)) post({ typ: 'seite', name: name });
      else post({ typ: 'link', href: href.slice(0, 300) });
    });
    window.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return;
      e.preventDefault();
      post({ typ: 'formular' });
    });

    // ------------------------------------------------------------ Tastenkürzel, die auch in der Vorschau gelten
    window.addEventListener('keydown', function (e) {
      var strg = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
      var taste = strg && e.shiftKey && k === 'c' ? 'inspektor' : strg && !e.shiftKey && k === 's' ? 'speichern' : strg && k === 'enter' ? 'ausfuehren' : inspektor && k === 'escape' ? 'inspektor-aus' : '';
      if (!taste) return;
      e.preventDefault(); e.stopImmediatePropagation();
      post({ typ: 'taste', taste: taste });
    }, true);

    // ------------------------------------------------------------ Nachrichten vom Editor
    window.addEventListener('message', function (e) {
      if (e.source !== eltern || !e.data || e.data.hs !== 'editor') return;
      var d = e.data;
      if (d.typ === 'inspektor') { inspektor = !!d.an; if (!inspektor) zeigeHover(null); }
      else if (d.typ === 'zeige') {
        var el = d.start != null ? nachStart.get(d.start) : null;
        dezent(el && el.isConnected ? [el] : [], true);
      } else if (d.typ === 'zeigeSelektor') {
        var liste = [];
        try { liste = Array.prototype.slice.call(document.querySelectorAll(d.selektor)); } catch (er) { /* ungültig */ }
        dezent(liste, true);
      } else if (d.typ === 'ausfuehren') {
        var ergebnis;
        try { ergebnis = (0, eval)(String(d.code)); post({ typ: 'ergebnis', text: darstellen(ergebnis, 1, []) }); }
        catch (er) { post({ typ: 'fehler', text: er.name + ': ' + er.message, zeile: 0, spalte: 0, eingabe: true }); }
      }
    });

    document.addEventListener('DOMContentLoaded', function () { post({ typ: 'bereit', titel: document.title }); });
    window.addEventListener('load', function () {
      if (konfig.scroll) window.scrollTo(konfig.scroll.x || 0, konfig.scroll.y || 0);
      post({ typ: 'geladen', titel: document.title });
    });
  };
})(typeof window !== 'undefined' ? window : this);
