// HTML-Sandbox · Autovervollständigung (ohne DOM)
// HS.vorschlaege(text, pos, sprache) erkennt, was gerade getippt wird (Tag, Attribut, CSS-Eigenschaft, CSS-Wert,
// JavaScript), und liefert passende Vorschläge: { von, bis, liste: [{ text, einfuegen, cursor, info, art }] }.
// einfuegen = einzusetzender Text, cursor = Cursorposition darin (sonst am Ende).
// Braucht quelltext.js (HS.parseHtml, HS.elementBei).
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  // Tags mit kurzer Erklärung (Deutsch, für die Liste)
  var TAGS = {
    a: 'Link', abbr: 'Abkürzung', article: 'Artikel', aside: 'Randbereich', audio: 'Audio', b: 'fett', blockquote: 'Zitat',
    body: 'sichtbarer Teil der Seite', br: 'Zeilenumbruch', button: 'Knopf', canvas: 'Zeichenfläche', caption: 'Tabellentitel',
    code: 'Programmcode', dd: 'Beschreibung', details: 'aufklappbar', div: 'Bereich (Block)', dl: 'Beschreibungsliste', dt: 'Begriff',
    em: 'betont (kursiv)', fieldset: 'Formulargruppe', figcaption: 'Bildunterschrift', figure: 'Abbildung', footer: 'Fußbereich',
    form: 'Formular', h1: 'Überschrift 1', h2: 'Überschrift 2', h3: 'Überschrift 3', h4: 'Überschrift 4', h5: 'Überschrift 5', h6: 'Überschrift 6',
    head: 'Kopf (unsichtbar)', header: 'Kopfbereich', hr: 'Trennlinie', html: 'ganze Seite', i: 'kursiv', iframe: 'eingebettete Seite',
    img: 'Bild', input: 'Eingabefeld', label: 'Beschriftung', legend: 'Titel einer Gruppe', li: 'Listenpunkt', link: 'verknüpfte Datei (CSS)',
    main: 'Hauptinhalt', mark: 'markiert', meta: 'Metadaten', nav: 'Navigation', ol: 'nummerierte Liste', option: 'Auswahlpunkt',
    p: 'Absatz', pre: 'vorformatiert', progress: 'Fortschrittsbalken', script: 'JavaScript', section: 'Abschnitt', select: 'Auswahlliste',
    small: 'klein', span: 'Bereich (im Text)', strong: 'wichtig (fett)', style: 'CSS', sub: 'tiefgestellt', summary: 'Titel von details',
    sup: 'hochgestellt', table: 'Tabelle', tbody: 'Tabellenkörper', td: 'Tabellenzelle', textarea: 'mehrzeiliges Textfeld', tfoot: 'Tabellenfuß',
    th: 'Kopfzelle', thead: 'Tabellenkopf', title: 'Titel im Browser-Tab', tr: 'Tabellenzeile', u: 'unterstrichen', ul: 'Aufzählung', video: 'Video',
    svg: 'Vektorgrafik', circle: 'Kreis (SVG)', rect: 'Rechteck (SVG)', line: 'Linie (SVG)', path: 'Pfad (SVG)', text: 'Text (SVG)'
  };
  var GLOBAL = ['class', 'id', 'style', 'title', 'hidden', 'lang', 'tabindex', 'onclick', 'onmouseover', 'onmouseout', 'onkeydown', 'oninput', 'onchange', 'contenteditable', 'draggable', 'data-'];
  var ATTRS = {
    a: ['href', 'target', 'download', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading'], input: ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'checked', 'min', 'max', 'step', 'maxlength', 'autofocus', 'readonly'],
    button: ['type', 'disabled', 'name', 'value'], form: ['action', 'method'], label: ['for'], link: ['rel', 'href', 'media'], script: ['src', 'defer', 'type', 'async'],
    meta: ['charset', 'name', 'content'], html: ['lang'], ol: ['start', 'reversed', 'type'], li: ['value'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'],
    textarea: ['name', 'rows', 'cols', 'placeholder', 'required', 'disabled', 'readonly', 'maxlength'], select: ['name', 'multiple', 'required', 'disabled'], option: ['value', 'selected', 'disabled'],
    iframe: ['src', 'width', 'height', 'title'], video: ['src', 'controls', 'autoplay', 'loop', 'muted', 'width', 'height', 'poster'], audio: ['src', 'controls', 'autoplay', 'loop', 'muted'],
    source: ['src', 'type'], progress: ['value', 'max'], details: ['open'], canvas: ['width', 'height'], svg: ['width', 'height', 'viewBox', 'xmlns'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'], rect: ['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke'], line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
    path: ['d', 'fill', 'stroke', 'stroke-width'], text: ['x', 'y', 'fill', 'font-size']
  };
  var OHNE_WERT = { hidden: 1, required: 1, disabled: 1, checked: 1, autofocus: 1, readonly: 1, defer: 1, async: 1, multiple: 1, selected: 1, controls: 1, autoplay: 1, loop: 1, muted: 1, open: 1, reversed: 1, download: 1 };
  var ATTR_WERTE = {
    type: ['text', 'number', 'password', 'email', 'checkbox', 'radio', 'range', 'color', 'date', 'time', 'file', 'submit', 'button', 'reset'],
    target: ['_blank', '_self'], rel: ['stylesheet', 'icon', 'noopener'], method: ['get', 'post'], loading: ['lazy', 'eager'], lang: ['de', 'en'], charset: ['UTF-8'],
    name: ['viewport', 'description', 'author'], scope: ['col', 'row'], contenteditable: ['true', 'false']
  };

  // CSS-Eigenschaften mit typischen Werten
  var FARBEN = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'gray', 'pink', 'brown', 'transparent', 'currentColor', 'steelblue', 'tomato', 'gold', 'navy', 'teal', 'crimson', 'lightgray', 'darkgreen', 'rgb()', 'rgba()', 'hsl()', '#'];
  var GROESSE = ['0', 'auto', 'px', 'em', 'rem', '%', 'vw', 'vh'];
  var CSS = {
    'color': FARBEN, 'background': FARBEN.concat(['none', 'url()', 'linear-gradient()']), 'background-color': FARBEN, 'background-image': ['url()', 'linear-gradient()', 'radial-gradient()', 'none'],
    'background-size': ['cover', 'contain', 'auto'], 'background-repeat': ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'], 'background-position': ['center', 'top', 'bottom', 'left', 'right'],
    'border': ['1px solid black', 'none', 'solid', 'dashed', 'dotted', 'double'], 'border-top': ['1px solid'], 'border-bottom': ['1px solid'], 'border-left': ['1px solid'], 'border-right': ['1px solid'],
    'border-radius': ['4px', '50%', '8px'], 'border-color': FARBEN, 'border-width': GROESSE, 'border-style': ['solid', 'dashed', 'dotted', 'none'], 'border-collapse': ['collapse', 'separate'],
    'box-shadow': ['0 2px 6px rgba(0, 0, 0, 0.2)', 'none'], 'box-sizing': ['border-box', 'content-box'],
    'width': GROESSE.concat(['fit-content', 'max-content', 'min-content']), 'height': GROESSE, 'max-width': GROESSE.concat(['none']), 'min-width': GROESSE, 'max-height': GROESSE.concat(['none']), 'min-height': GROESSE,
    'margin': GROESSE.concat(['0 auto']), 'margin-top': GROESSE, 'margin-bottom': GROESSE, 'margin-left': GROESSE, 'margin-right': GROESSE,
    'padding': GROESSE, 'padding-top': GROESSE, 'padding-bottom': GROESSE, 'padding-left': GROESSE, 'padding-right': GROESSE,
    'display': ['block', 'inline', 'inline-block', 'flex', 'grid', 'none', 'inline-flex'], 'position': ['static', 'relative', 'absolute', 'fixed', 'sticky'],
    'top': GROESSE, 'right': GROESSE, 'bottom': GROESSE, 'left': GROESSE, 'z-index': ['1', '10', '-1', 'auto'], 'float': ['left', 'right', 'none'], 'clear': ['both', 'left', 'right'],
    'overflow': ['hidden', 'auto', 'scroll', 'visible'], 'visibility': ['visible', 'hidden'], 'opacity': ['0', '0.5', '1'], 'cursor': ['pointer', 'default', 'move', 'text', 'not-allowed'],
    'font-family': ['sans-serif', 'serif', 'monospace', 'Arial, sans-serif', 'Georgia, serif', 'system-ui, sans-serif'], 'font-size': ['16px', '1.2em', '2rem', 'small', 'large', 'x-large'],
    'font-weight': ['bold', 'normal', '300', '600', '700'], 'font-style': ['italic', 'normal'], 'line-height': ['1.5', 'normal', '1.2'], 'letter-spacing': ['1px', '0.1em', 'normal'],
    'text-align': ['left', 'center', 'right', 'justify'], 'text-decoration': ['none', 'underline', 'line-through', 'overline'], 'text-transform': ['uppercase', 'lowercase', 'capitalize', 'none'],
    'text-shadow': ['1px 1px 2px gray', 'none'], 'white-space': ['nowrap', 'normal', 'pre', 'pre-wrap'], 'vertical-align': ['middle', 'top', 'bottom', 'baseline'], 'list-style': ['none', 'disc', 'circle', 'square', 'decimal'], 'list-style-type': ['none', 'disc', 'circle', 'square', 'decimal', 'upper-roman', 'lower-alpha'],
    'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'], 'flex-wrap': ['wrap', 'nowrap'], 'justify-content': ['center', 'flex-start', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
    'align-items': ['center', 'flex-start', 'flex-end', 'stretch', 'baseline'], 'align-content': ['center', 'space-between', 'stretch'], 'align-self': ['center', 'flex-start', 'flex-end', 'stretch'], 'flex': ['1', 'auto', 'none', '1 1 0'], 'flex-grow': ['0', '1'], 'flex-shrink': ['0', '1'], 'flex-basis': GROESSE, 'gap': ['8px', '1rem', '16px'], 'order': ['0', '1', '-1'],
    'grid-template-columns': ['repeat(3, 1fr)', '1fr 1fr', '200px 1fr', 'repeat(auto-fill, minmax(150px, 1fr))'], 'grid-template-rows': ['auto', '1fr'], 'grid-column': ['1 / 3', 'span 2'], 'grid-row': ['1 / 3', 'span 2'], 'place-items': ['center'],
    'transition': ['all 0.3s ease', 'transform 0.2s', 'none'], 'transform': ['rotate(45deg)', 'scale(1.1)', 'translate(10px, 0)', 'none'], 'animation': ['name 1s ease infinite'], 'outline': ['none', '2px solid'],
    'object-fit': ['cover', 'contain', 'fill'], 'aspect-ratio': ['16 / 9', '1'], 'content': ['""'], 'user-select': ['none', 'auto'], 'filter': ['blur(2px)', 'grayscale(100%)', 'brightness(1.2)', 'none'],
    'table-layout': ['fixed', 'auto'], 'scroll-behavior': ['smooth', 'auto'], 'accent-color': FARBEN, 'resize': ['none', 'both', 'vertical']
  };
  var CSS_LISTE = Object.keys(CSS).sort();

  // JavaScript: Schlüsselwörter und häufige Funktionen
  var JS_WOERTER = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'switch', 'case', 'default', 'new', 'class', 'this', 'true', 'false', 'null', 'undefined', 'typeof', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'of', 'in',
    'console', 'document', 'window', 'Math', 'JSON', 'Array', 'Object', 'String', 'Number', 'Date', 'localStorage', 'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout', 'alert', 'prompt', 'confirm', 'parseInt', 'parseFloat', 'isNaN', 'requestAnimationFrame'];
  var JS_SCHNIPSEL = [
    { text: 'for', einfuegen: 'for (let i = 0; i < 10; i++) {\n  \n}', cursor: -1, info: 'Zählschleife' },
    { text: 'if', einfuegen: 'if () {\n  \n}', cursor: 4, info: 'Bedingung' },
    { text: 'ifelse', einfuegen: 'if () {\n  \n} else {\n  \n}', cursor: 4, info: 'Bedingung mit sonst' },
    { text: 'while', einfuegen: 'while () {\n  \n}', cursor: 7, info: 'Schleife' },
    { text: 'function', einfuegen: 'function name() {\n  \n}', cursor: 9, info: 'Funktion' },
    { text: 'log', einfuegen: 'console.log();', cursor: 12, info: 'console.log()' },
    { text: 'klick', einfuegen: "addEventListener('click', function () {\n  \n});", cursor: -1, info: 'auf Klick reagieren' }
  ];
  // cursor -1: in die leere Zeile im Rumpf
  JS_SCHNIPSEL.forEach(function (s) { if (s.cursor < 0) s.cursor = s.einfuegen.indexOf('\n  \n') + 3; });
  var MITGLIEDER = {
    console: ['log', 'warn', 'error', 'info', 'table', 'clear'],
    document: ['querySelector', 'querySelectorAll', 'getElementById', 'getElementsByClassName', 'createElement', 'body', 'title', 'addEventListener', 'documentElement'],
    Math: ['random', 'floor', 'ceil', 'round', 'abs', 'max', 'min', 'sqrt', 'pow', 'PI', 'sin', 'cos', 'trunc'],
    JSON: ['stringify', 'parse'], localStorage: ['getItem', 'setItem', 'removeItem', 'clear'],
    classList: ['add', 'remove', 'toggle', 'contains', 'replace'],
    style: ['color', 'backgroundColor', 'display', 'width', 'height', 'fontSize', 'left', 'top', 'transform', 'opacity', 'border', 'margin', 'padding'],
    Array: ['isArray', 'from'], Object: ['keys', 'values', 'entries', 'assign'], Number: ['isInteger', 'parseFloat', 'parseInt'], window: ['innerWidth', 'innerHeight', 'addEventListener', 'scrollTo', 'alert'],
    event: ['target', 'key', 'preventDefault', 'clientX', 'clientY', 'code'], e: ['target', 'key', 'preventDefault', 'clientX', 'clientY', 'code']
  };
  // allgemeine Mitglieder (Elemente, Strings, Arrays, Zahlen)
  var ALLGEMEIN = ['textContent', 'innerHTML', 'innerText', 'value', 'style', 'classList', 'addEventListener', 'removeEventListener', 'appendChild', 'append', 'prepend', 'remove', 'setAttribute', 'getAttribute', 'removeAttribute',
    'querySelector', 'querySelectorAll', 'children', 'parentElement', 'id', 'className', 'checked', 'disabled', 'focus', 'click', 'dataset', 'src', 'href',
    'length', 'push', 'pop', 'shift', 'unshift', 'map', 'filter', 'forEach', 'find', 'includes', 'indexOf', 'join', 'slice', 'splice', 'sort', 'reverse', 'reduce', 'some', 'every',
    'toUpperCase', 'toLowerCase', 'trim', 'split', 'replace', 'startsWith', 'endsWith', 'charAt', 'padStart', 'repeat', 'toFixed', 'toString'];
  var FUNKTIONEN = { querySelector: 1, querySelectorAll: 1, getElementById: 1, getElementsByClassName: 1, createElement: 1, addEventListener: 1, removeEventListener: 1, appendChild: 1, append: 1, prepend: 1, remove: 1, setAttribute: 1, getAttribute: 1, removeAttribute: 1,
    focus: 1, click: 1, push: 1, pop: 1, shift: 1, unshift: 1, map: 1, filter: 1, forEach: 1, find: 1, includes: 1, indexOf: 1, join: 1, slice: 1, splice: 1, sort: 1, reverse: 1, reduce: 1, some: 1, every: 1,
    toUpperCase: 1, toLowerCase: 1, trim: 1, split: 1, replace: 1, startsWith: 1, endsWith: 1, charAt: 1, padStart: 1, repeat: 1, toFixed: 1, toString: 1, log: 1, warn: 1, error: 1, info: 1, table: 1, clear: 1,
    random: 1, floor: 1, ceil: 1, round: 1, abs: 1, max: 1, min: 1, sqrt: 1, pow: 1, sin: 1, cos: 1, trunc: 1, stringify: 1, parse: 1, getItem: 1, setItem: 1, removeItem: 1, add: 1, toggle: 1, contains: 1,
    isArray: 1, from: 1, keys: 1, values: 1, entries: 1, assign: 1, isInteger: 1, parseFloat: 1, parseInt: 1, scrollTo: 1, alert: 1, preventDefault: 1,
    setTimeout: 1, setInterval: 1, clearInterval: 1, clearTimeout: 1, prompt: 1, confirm: 1, isNaN: 1, requestAnimationFrame: 1 };

  function passt(liste, praefix) {
    var p = praefix.toLowerCase();
    var anfang = [], mitte = [];
    liste.forEach(function (x) {
      var t = (typeof x === 'string' ? x : x.text).toLowerCase();
      if (t === p) return;
      if (t.indexOf(p) === 0) anfang.push(x); else if (p.length > 1 && t.indexOf(p) > 0) mitte.push(x);
    });
    return anfang.concat(mitte);
  }

  // ---------------------------------------------------------------- HTML
  function html(text, pos) {
    var a = HS.parseHtml(text);
    // in <style> oder <script>?
    var el = HS.elementBei(a, pos);
    if (el && (el.name === 'style' || el.name === 'script') && pos >= el.startEnde && pos <= el.innerEnde) {
      var inner = text.slice(el.startEnde, el.innerEnde);
      var r = el.name === 'style' ? css(inner, pos - el.startEnde) : js(inner, pos - el.startEnde);
      if (r) { r.von += el.startEnde; r.bis += el.startEnde; }
      return r;
    }
    // im Tag?
    var lt = text.lastIndexOf('<', pos - 1), gt = text.lastIndexOf('>', pos - 1);
    if (lt < 0 || gt > lt) return null;
    var tagText = text.slice(lt, pos);
    var m;
    if ((m = /^<\/([\w:-]*)$/.exec(tagText))) {                     // </… → offenes Element schließen
      var offen = HS.elementBei(HS.parseHtml(text.slice(0, lt)), lt);
      while (offen && offen.leer) offen = offen.eltern;
      var liste = offen && !offen.geschlossen ? [{ text: offen.name, einfuegen: offen.name + '>', info: 'schließen', art: 'tag' }] : [];
      return { von: lt + 2, bis: pos, liste: m[1] ? passt(liste, m[1]) : liste };
    }
    if ((m = /^<([\w:-]*)$/.exec(tagText))) {
      var tags = Object.keys(TAGS).map(function (t) { return { text: t, einfuegen: t, info: TAGS[t], art: 'tag' }; });
      return { von: lt + 1, bis: pos, liste: m[1] ? passt(tags, m[1]) : tags };
    }
    var tm = /^<([\w:-]+)/.exec(tagText);
    if (!tm) return null;
    var tag = tm[1].toLowerCase();
    // in einem Attributwert?
    var wm = /([\w:-]+)\s*=\s*(["'])([^"']*)$/.exec(tagText);
    if (wm) {
      var an = wm[1].toLowerCase(), werte = ATTR_WERTE[an] || [];
      if (an === 'href' || an === 'src') werte = (HS.projektDateien || []).filter(function (d) { return an === 'src' ? /\.(js|png|jpe?g|gif|webp|svg)$/i.test(d) : true; });
      var wl = werte.map(function (w) { return { text: w, einfuegen: w, art: 'wert' }; });
      return { von: pos - wm[3].length, bis: pos, liste: wm[3] ? passt(wl, wm[3]) : wl };
    }
    // Attributname
    var am = /\s([\w:-]*)$/.exec(tagText);
    if (!am) return null;
    var schon = {};
    tagText.replace(/\s([\w:-]+)\s*=/g, function (_, n) { schon[n.toLowerCase()] = true; });
    var attrs = (ATTRS[tag] || []).concat(GLOBAL).filter(function (x) { return !schon[x]; });
    var liste2 = attrs.map(function (x) {
      if (OHNE_WERT[x] && !(x === 'download' && tag !== 'a')) return { text: x, einfuegen: x, art: 'attr' };
      if (x === 'data-') return { text: 'data-…', einfuegen: 'data-=""', cursor: 5, art: 'attr', info: 'eigenes Attribut' };
      return { text: x, einfuegen: x + '=""', cursor: x.length + 2, art: 'attr', erneut: !!ATTR_WERTE[x] || x === 'href' || x === 'src' };
    });
    return { von: pos - am[1].length, bis: pos, liste: am[1] ? passt(liste2, am[1]) : liste2 };
  }

  // ---------------------------------------------------------------- CSS
  function css(text, pos) {
    // letzte Struktur-Zeichen vor dem Cursor (Kommentare und Strings ignorieren)
    var i = 0, letzte = -1, letztesZeichen = '', tiefe = 0;
    while (i < pos) {
      var c = text[i];
      if (c === '/' && text[i + 1] === '*') { var e = text.indexOf('*/', i + 2); if (e < 0 || e + 2 > pos) return null; i = e + 2; continue; }
      if (c === '"' || c === "'") { var q = text.indexOf(c, i + 1); if (q < 0 || q >= pos) return null; i = q + 1; continue; }
      if (c === '{' || c === '}' || c === ';') { letzte = i; letztesZeichen = c; tiefe += c === '{' ? 1 : c === '}' ? -1 : 0; }
      i++;
    }
    if (tiefe <= 0 || letztesZeichen === '}') return null;          // im Selektor: keine Vorschläge
    var stueck = text.slice(letzte + 1, pos);
    var dp = stueck.indexOf(':');
    if (dp < 0) {
      var w = /[\w-]*$/.exec(stueck)[0];
      if (/^\s*[\w-]*$/.test(stueck) === false) return null;
      var liste = CSS_LISTE.map(function (p) { return { text: p, einfuegen: p + ': ', art: 'eig', erneut: true }; });
      return { von: pos - w.length, bis: pos, liste: w ? passt(liste, w) : [] };
    }
    var eig = stueck.slice(0, dp).trim().toLowerCase();
    var wert = /[\w#().%-]*$/.exec(stueck.slice(dp + 1))[0];
    var werte = (CSS[eig] || []).map(function (v) { return { text: v, einfuegen: v + (/\(\)$/.test(v) ? '' : ';'), cursor: /\(\)$/.test(v) ? v.length - 1 : undefined, art: 'wert' }; });
    return { von: pos - wert.length, bis: pos, liste: wert ? passt(werte, wert) : werte };
  }

  // ---------------------------------------------------------------- JavaScript
  function js(text, pos) {
    // nicht in Kommentar oder String (vereinfacht: aktuelle Zeile)
    var zeile = text.slice(text.lastIndexOf('\n', pos - 1) + 1, pos);
    if (/\/\//.test(zeile.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""'))) return null;
    var ohneStrings = zeile.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
    if (/["'`]/.test(ohneStrings)) return null;
    var m = /([\w$]+)?\.([\w$]*)$/.exec(zeile);
    if (m) {
      var obj = m[1] || '';
      var liste = (MITGLIEDER[obj] || ALLGEMEIN).map(function (x) {
        return FUNKTIONEN[x] ? { text: x, einfuegen: x + '()', cursor: x.length + 1, art: 'fn' } : { text: x, einfuegen: x, art: 'eig' };
      });
      return { von: pos - m[2].length, bis: pos, liste: m[2] ? passt(liste, m[2]) : liste };
    }
    var w = /[\w$]*$/.exec(zeile)[0];
    if (!w || /^\d/.test(w)) return null;
    var eigene = {};
    text.replace(/\b(?:const|let|var|function|class)\s+([\w$]+)/g, function (_, n) { if (n !== w) eigene[n] = true; });
    text.replace(/\b(?:function\s*[\w$]*\s*\(|\()([\w$\s,]*)\)\s*(?:=>|\{)/g, function (_, ps) { ps.split(',').forEach(function (p) { p = p.trim(); if (/^[\w$]+$/.test(p) && p !== w) eigene[p] = true; }); });
    var alle = Object.keys(eigene).map(function (x) { return { text: x, einfuegen: x, art: 'var' }; })
      .concat(JS_SCHNIPSEL.map(function (s) { return { text: s.text, einfuegen: s.einfuegen, cursor: s.cursor, info: s.info, art: 'schnipsel' }; }))
      .concat(JS_WOERTER.filter(function (x) { return !eigene[x]; }).map(function (x) { return FUNKTIONEN[x] ? { text: x, einfuegen: x + '()', cursor: x.length + 1, art: 'fn' } : { text: x, einfuegen: x, art: 'kw' }; }));
    return { von: pos - w.length, bis: pos, liste: passt(alle, w) };
  }

  function vorschlaege(text, pos, sprache) {
    var r = null;
    try {
      if (sprache === 'html') r = html(text, pos);
      else if (sprache === 'css') r = css(text, pos);
      else if (sprache === 'js') r = js(text, pos);
    } catch (e) { r = null; }                                        // halb getippter Code: lieber keine Vorschläge als ein Absturz
    if (!r || !r.liste.length) return null;
    r.liste = r.liste.slice(0, 60);
    return r;
  }

  HS.vorschlaege = vorschlaege;
  HS.CSS_EIGENSCHAFTEN = CSS_LISTE;
})(typeof window !== 'undefined' ? window : this);
