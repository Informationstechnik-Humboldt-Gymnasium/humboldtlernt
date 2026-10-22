// HTML-Sandbox · Werkzeuge für den Editor (ohne DOM)
// - formatiere(text, sprache): Code ordentlich einrücken (Shift+Alt+F) – HTML, CSS, JavaScript
// - emmet(abkuerzung, eltern): Emmet-Abkürzungen wie ul>li*3 oder div.box>h2{Titel}+p ausklappen
// - kommentiere(text, von, bis, sprache): Zeilen ein-/auskommentieren (Strg+#, Strg+/)
// Braucht quelltext.js (HS.parseHtml).
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  function menge(s) { var m = {}; s.split(' ').forEach(function (w) { m[w] = true; }); return m; }
  function wdh(s, n) { var r = ''; for (var k = 0; k < n; k++) r += s; return r; }

  // Elemente, die im Fließtext stehen (werden beim Formatieren nicht auf eigene Zeilen verteilt)
  var INLINE = menge('a abbr b bdi bdo br button cite code data dfn em i img input kbd label mark meter output progress q s samp select small span strong sub sup time u var wbr');
  var WOERTLICH = menge('pre textarea');

  // ---------------------------------------------------------------- HTML formatieren
  // Prinzip: Blöcke kommen auf eigene Zeilen und werden eingerückt. Fließtext mit Inline-Elementen bleibt,
  // wie er ist (nur neu eingerückt), damit sich die Darstellung der Seite nicht ändert.
  function formatiereHtml(text, einr) {
    einr = einr || '  ';
    var a = HS.parseHtml(text), aus = [];
    function zeile(tiefe, s) { aus.push(wdh(einr, tiefe) + s); }
    function hatBlock(el) {
      for (var k = 0; k < el.kinder.length; k++) {
        var x = el.kinder[k];
        if (x.typ === 'element' && (!INLINE[x.name] || hatBlock(x))) return true;
        if (x.typ === 'kommentar' || x.typ === 'doctype') return true;
      }
      return false;
    }
    function istInline(x) {
      if (x.typ === 'text' || x.typ === 'fremd') return true;
      if (x.typ === 'element') return !!INLINE[x.name] && !hatBlock(x) && !WOERTLICH[x.name];
      if (x.typ === 'kommentar') {                                   // Kommentar mitten im Text bleibt im Text
        var vor = text.lastIndexOf('\n', x.start - 1);
        return text.slice(vor + 1, x.start).trim() !== '';
      }
      return false;
    }
    function lauf(knoten, tiefe) {                                   // Fließtext: Zeilen behalten, nur einrücken
      var s = text.slice(knoten[0].start, knoten[knoten.length - 1].ende);
      var zeilen = s.split('\n').map(function (z) { return z.trim(); });
      while (zeilen.length && !zeilen[0]) zeilen.shift();
      while (zeilen.length && !zeilen[zeilen.length - 1]) zeilen.pop();
      var leer = false;
      zeilen.forEach(function (z) { if (!z) { if (!leer) aus.push(''); leer = true; } else { zeile(tiefe, z); leer = false; } });
      if (!zeilen.length && /\n[ \t]*\n/.test(s) && aus.length && aus[aus.length - 1] !== '') aus.push('');   // eine Leerzeile zwischen Blöcken bleibt
    }
    function kinder(liste, tiefe) {
      var puffer = [];
      function leeren() { if (puffer.length) lauf(puffer, tiefe); puffer = []; }
      liste.forEach(function (x) {
        if (istInline(x)) { puffer.push(x); return; }
        leeren();
        if (x.typ === 'element') element(x, tiefe);
        else text.slice(x.start, x.ende).split('\n').forEach(function (z, k) { zeile(k ? tiefe + 1 : tiefe, z.trim()); });
      });
      leeren();
    }
    function startTag(el, tiefe) {
      text.slice(el.start, el.startEnde).split('\n').forEach(function (z, k) { zeile(k ? tiefe + 1 : tiefe, z.trim()); });
    }
    function element(el, tiefe) {
      var ganz = text.slice(el.start, el.ende);
      var endTag = el.geschlossen ? text.slice(el.innerEnde, el.ende) : '';
      if (WOERTLICH[el.name]) {                                      // <pre>: Inhalt bleibt Zeichen für Zeichen
        var zz = ganz.split('\n');
        zeile(tiefe, zz[0]); for (var k = 1; k < zz.length; k++) aus.push(zz[k]);
        return;
      }
      if (el.name === 'script' || el.name === 'style') {
        var inner = text.slice(el.startEnde, el.innerEnde);
        if (!inner.trim() || (inner.indexOf('\n') < 0 && ganz.length + tiefe * einr.length <= 100)) { zeile(tiefe, text.slice(el.start, el.startEnde) + inner.trim() + endTag); return; }
        startTag(el, tiefe);
        var typ = HS.attr(el, 'type');
        var istJs = el.name === 'script' && (!typ || !typ.wert || /javascript|module/i.test(typ.wert));
        var f = el.name === 'style' ? formatiereCss(inner, einr) : istJs ? formatiereJs(inner, einr) : inner.trim();
        f.split('\n').forEach(function (z) { if (z.trim()) zeile(tiefe + 1, z.replace(/\s+$/, '')); else aus.push(''); });
        if (endTag) zeile(tiefe, endTag);
        return;
      }
      if (el.leer) { startTag(el, tiefe); return; }
      if (!hatBlock(el)) {
        var kompakt = ganz.indexOf('\n') < 0 ? ganz : ganz.replace(/\s*\n\s*/g, ' ');
        var st = text.slice(el.start, el.startEnde).replace(/\s*\n\s*/g, ' ');
        if (kompakt.indexOf('\n') < 0) {
          var innen = kompakt.slice(st.length, kompakt.length - endTag.length).trim();
          kompakt = st + innen + endTag;
        }
        if (kompakt.length + tiefe * einr.length <= 100) { zeile(tiefe, kompakt); return; }
      }
      startTag(el, tiefe);
      kinder(el.kinder, tiefe + 1);
      if (endTag) zeile(tiefe, endTag);
    }
    kinder(a.wurzel.kinder, 0);
    var erg = aus.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
    return erg + (erg ? '\n' : '');
  }

  // ---------------------------------------------------------------- CSS formatieren
  function formatiereCss(text, einr) {
    einr = einr || '  ';
    var aus = [], puffer = '', tiefe = 0, klammern = 0, arten = [], i = 0, n = text.length;
    function art() { return arten.length ? arten[arten.length - 1] : 'regeln'; }
    function zeile(s) { aus.push(s ? wdh(einr, Math.max(0, tiefe)) + s : ''); }
    function dekl(s) {
      s = s.trim();
      if (art() !== 'dekl') return s;
      var k = 0, t = 0;
      for (; k < s.length; k++) { if (s[k] === '(') t++; else if (s[k] === ')') t--; else if (s[k] === ':' && !t) break; }
      return k < s.length ? s.slice(0, k).trim() + ': ' + s.slice(k + 1).trim() : s;
    }
    function leeren() { var s = puffer.trim(); if (s) zeile(dekl(s)); puffer = ''; }
    while (i < n) {
      var c = text[i];
      if (c === '/' && text[i + 1] === '*') {
        var e = text.indexOf('*/', i + 2), ende = e < 0 ? n : e + 2;
        var kom = text.slice(i, ende);
        if (puffer.trim()) puffer += kom;
        else kom.split('\n').forEach(function (z, k) { zeile((k ? ' ' : '') + z.trim()); });
        i = ende; continue;
      }
      if (c === '"' || c === "'") { var q = i + 1; while (q < n && text[q] !== c && text[q] !== '\n') q += text[q] === '\\' ? 2 : 1; puffer += text.slice(i, q + 1); i = q + 1; continue; }
      if (/\s/.test(c)) { if (puffer && !/\s$/.test(puffer)) puffer += ' '; i++; continue; }
      if (c === '(') klammern++;
      if (c === ')') klammern--;
      if (c === '{' && !klammern) {
        var kopf = puffer.trim();
        if (art() === 'regeln' && kopf[0] !== '@') kopf = kopf.replace(/\s*,\s*/g, ', ').replace(/\s*>\s*/g, ' > ');
        zeile((kopf ? kopf + ' ' : '') + '{'); puffer = '';
        arten.push(kopf[0] === '@' && /^@(media|supports|container|layer|scope|document)\b/i.test(kopf) ? 'regeln' : 'dekl');
        tiefe++; i++; continue;
      }
      if (c === ';' && !klammern) { puffer += ';'; leeren(); i++; continue; }
      if (c === '}' && !klammern) {
        leeren(); tiefe--; arten.pop();
        while (aus.length && aus[aus.length - 1] === '') aus.pop();
        zeile('}');
        if (art() === 'regeln') aus.push('');
        i++; continue;
      }
      puffer += c; i++;
    }
    leeren();
    while (aus.length && aus[aus.length - 1] === '') aus.pop();
    return aus.join('\n').replace(/\n{3,}/g, '\n\n') + (aus.length ? '\n' : '');
  }

  // ---------------------------------------------------------------- JavaScript einrücken
  // Bewusst vorsichtig: Zeilen bleiben, wie sie sind; nur die Einrückung folgt den Klammern { ( [.
  // Öffnen mehrere Klammern in einer Zeile (z. B. „addEventListener('click', function () {“), gibt es nur eine Stufe.
  function formatiereJs(text, einr) {
    einr = einr || '  ';
    var zeilen = String(text).replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
    var offen = [], aus = [], blockKommentar = false, template = false;
    function stufen(bis) {                                           // Anzahl verschiedener Zeilen mit offenen Klammern
      var z = 0, letzte = -1;
      for (var k = 0; k < bis; k++) if (offen[k] !== letzte) { z++; letzte = offen[k]; }
      return z;
    }
    zeilen.forEach(function (roh, nr) {
      var z = roh.trim();
      if (template) { aus.push(roh); scanne(roh, nr); return; }
      if (blockKommentar) { aus.push(z ? wdh(einr, stufen(offen.length)) + (z[0] === '*' ? ' ' : '') + z : ''); scanne(roh, nr); return; }
      var m = /^[}\])]+/.exec(z), weniger = m ? m[0].length : 0;
      aus.push(z ? wdh(einr, stufen(Math.max(0, offen.length - weniger))) + z : '');
      scanne(z, nr);
    });
    function scanne(z, nr) {
      var i = 0, n = z.length;
      while (i < n) {
        var c = z[i];
        if (blockKommentar) { var e = z.indexOf('*/', i); if (e < 0) return; blockKommentar = false; i = e + 2; continue; }
        if (template) { if (c === '\\') { i += 2; continue; } if (c === '`') template = false; i++; continue; }
        if (c === '/' && z[i + 1] === '/') return;
        if (c === '/' && z[i + 1] === '*') { blockKommentar = true; i += 2; continue; }
        if (c === '`') { template = true; i++; continue; }
        if (c === '"' || c === "'") { var k = i + 1; while (k < n && z[k] !== c) k += z[k] === '\\' ? 2 : 1; i = k + 1; continue; }
        if (c === '{' || c === '(' || c === '[') offen.push(nr);
        else if (c === '}' || c === ')' || c === ']') offen.pop();
        i++;
      }
    }
    return aus.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  function formatiere(text, sprache, einr) {
    if (sprache === 'html') return formatiereHtml(text, einr);
    if (sprache === 'css') return formatiereCss(text, einr);
    if (sprache === 'js') return formatiereJs(text, einr);
    return text;
  }

  // ---------------------------------------------------------------- Kommentare umschalten
  function kommentiere(text, von, bis, sprache) {
    var a = text.lastIndexOf('\n', von - 1) + 1;
    var e = text.indexOf('\n', bis > von && text[bis - 1] === '\n' ? bis - 1 : bis); if (e < 0) e = text.length;
    var block = text.slice(a, e);
    var neu;
    if (sprache === 'js') {
      var zeilen = block.split('\n');
      var alle = zeilen.every(function (z) { return !z.trim() || /^\s*\/\//.test(z); });
      if (alle) neu = zeilen.map(function (z) { return z.replace(/^(\s*)\/\/ ?/, '$1'); }).join('\n');
      else {
        var min = Math.min.apply(null, zeilen.filter(function (z) { return z.trim(); }).map(function (z) { return /^\s*/.exec(z)[0].length; }).concat([1000]));
        neu = zeilen.map(function (z) { return z.trim() ? z.slice(0, min) + '// ' + z.slice(min) : z; }).join('\n');
      }
    } else {
      var auf = sprache === 'css' ? '/*' : '<!--', zu = sprache === 'css' ? '*/' : '-->';
      var t = block.trim(), vorne = /^\s*/.exec(block)[0];
      if (t.indexOf(auf) === 0 && t.slice(-zu.length) === zu) neu = vorne + t.slice(auf.length, t.length - zu.length).trim();
      else neu = vorne + auf + ' ' + t + ' ' + zu;
    }
    return { text: text.slice(0, a) + neu + text.slice(e), von: a, bis: a + neu.length };
  }

  // ---------------------------------------------------------------- Emmet
  var TAGS = menge('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script section select small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr svg circle rect line path polygon polyline ellipse text g');
  var STANDARD = {
    a: [['href', '']], img: [['src', ''], ['alt', '']], input: [['type', 'text']], link: [['rel', 'stylesheet'], ['href', '']],
    form: [['action', '']], label: [['for', '']], iframe: [['src', '']], script: [], area: [['shape', ''], ['coords', ''], ['href', ''], ['alt', '']],
    audio: [['src', '']], video: [['src', '']], source: [['src', '']], meta: [], select: [['name', '']], textarea: [['name', '']], button: [], abbr: [['title', '']]
  };
  var KIND = { ul: 'li', ol: 'li', table: 'tr', tbody: 'tr', thead: 'tr', tfoot: 'tr', tr: 'td', select: 'option', optgroup: 'option', dl: 'dt', menu: 'li' };
  var MARKE = '\u0001';

  function parseEmmet(s) {
    var p = 0, n = s.length;
    function fehler() { throw new Error('emmet'); }
    function zahl() { var m = /^\d+/.exec(s.slice(p)); if (!m) fehler(); p += m[0].length; return parseInt(m[0], 10); }
    function element() {
      var el = { tag: '', id: '', klassen: [], attrs: [], text: null, kinder: [], mal: 1 };
      var m = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(s.slice(p));
      if (m) { el.tag = m[0]; p += m[0].length; }
      var etwas = !!m;
      for (;;) {
        var c = s[p];
        if (c === '#') { p++; var mi = /^[\w$@-]+/.exec(s.slice(p)); if (!mi) fehler(); el.id = mi[0]; p += mi[0].length; etwas = true; }
        else if (c === '.') { p++; var mk = /^[\w$@-]+/.exec(s.slice(p)); if (!mk) fehler(); el.klassen.push(mk[0]); p += mk[0].length; etwas = true; }
        else if (c === '[') {
          var e = s.indexOf(']', p); if (e < 0) fehler();
          var inhalt = s.slice(p + 1, e), re = /([^\s=]+)(?:=("[^"]*"|'[^']*'|[^\s]*))?/g, r;
          while ((r = re.exec(inhalt))) el.attrs.push([r[1], r[2] == null ? '' : r[2].replace(/^["']|["']$/g, '')]);
          p = e + 1; etwas = true;
        } else if (c === '{') {
          var t = 1, k = p + 1;
          while (k < n && t) { if (s[k] === '{') t++; else if (s[k] === '}') t--; k++; }
          if (t) fehler();
          el.text = s.slice(p + 1, k - 1); p = k; etwas = true;
        } else break;
      }
      if (!etwas) fehler();
      if (s[p] === '*') { p++; el.mal = Math.min(100, zahl()); }
      return el;
    }
    function item() {
      if (s[p] === '(') {
        p++;
        var g = { gruppe: true, kinder: folge(), mal: 1 };
        if (s[p] !== ')') fehler();
        p++;
        if (s[p] === '*') { p++; g.mal = Math.min(100, zahl()); }
        return g;
      }
      return element();
    }
    function folge() {
      var wurzel = { kinder: [] }, eltern = [wurzel], aktuell = wurzel, letztes = null;
      for (;;) {
        var x = item();
        aktuell.kinder.push(x); letztes = x;
        var op = s[p];
        if (op === '>') { p++; if (letztes.gruppe) fehler(); eltern.push(aktuell); aktuell = letztes; }
        else if (op === '+') p++;
        else if (op === '^') { while (s[p] === '^') { p++; if (eltern.length > 1) aktuell = eltern.pop(); } }
        else break;
      }
      return wurzel.kinder;
    }
    var baum = folge();
    if (p !== n) fehler();
    return baum;
  }

  function nummer(s, idx) { return s.replace(/\$+/g, function (d) { var z = String(idx); while (z.length < d.length) z = '0' + z; return z; }); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function rendere(liste, elternTag, tiefe, idxAussen, aus, einr) {
    liste.forEach(function (x) {
      for (var m = 1; m <= x.mal; m++) {
        var idx = x.mal > 1 ? m : idxAussen;
        if (x.gruppe) { rendere(x.kinder, elternTag, tiefe, idx, aus, einr); continue; }
        var tag = x.tag || KIND[elternTag] || (elternTag === 'p' || INLINE[elternTag] ? 'span' : 'div');
        var attrs = [];
        if (x.id) attrs.push(['id', nummer(x.id, idx)]);
        if (x.klassen.length) attrs.push(['class', x.klassen.map(function (k) { return nummer(k, idx); }).join(' ')]);
        (STANDARD[tag] || []).forEach(function (d) { if (!x.attrs.some(function (a) { return a[0] === d[0]; })) attrs.push(d); });
        x.attrs.forEach(function (a) { attrs.push([a[0], nummer(a[1], idx)]); });
        var st = '<' + tag + attrs.map(function (a) { return ' ' + a[0] + '="' + (a[1] === '' ? MARKE : a[1].replace(/"/g, '&quot;')) + '"'; }).join('') + '>';
        if (HS.LEER[tag]) { aus.push({ tiefe: tiefe, s: st }); continue; }
        var text = x.text == null ? '' : esc(nummer(x.text, idx));
        var einzeilig = !x.kinder.length || x.kinder.every(function (k) { return !k.gruppe && INLINE[k.tag] && !k.kinder.length && k.mal === 1; });
        if (einzeilig) {
          var innen = [];
          rendere(x.kinder, tag, 0, idx, innen, einr);
          aus.push({ tiefe: tiefe, s: st + text + innen.map(function (z) { return z.s; }).join('') + (!text && !innen.length ? MARKE : '') + '</' + tag + '>' });
        } else {
          aus.push({ tiefe: tiefe, s: st + text });
          rendere(x.kinder, tag, tiefe + 1, idx, aus, einr);
          aus.push({ tiefe: tiefe, s: '</' + tag + '>' });
        }
      }
    });
  }

  var GERUEST = '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' + MARKE + 'Meine Seite</title>\n</head>\n<body>\n  \n</body>\n</html>';

  // Liefert { text, cursor } (cursor = Position im Text) oder null, wenn es keine gültige Abkürzung ist.
  function emmet(abk, elternTag, einr) {
    einr = einr || '  ';
    abk = String(abk || '').trim();
    if (!abk) return null;
    var roh;
    if (abk === '!' || abk === 'html:5') roh = GERUEST;
    else {
      var baum;
      try { baum = parseEmmet(abk); } catch (e) { return null; }
      var ok = true;
      (function pruefe(l) { l.forEach(function (x) { if (x.gruppe) pruefe(x.kinder); else { if (x.tag && !TAGS[x.tag.toLowerCase()] && x.tag.indexOf('-') < 0) ok = false; pruefe(x.kinder); } }); })(baum);
      // ein einzelnes Wort ohne Zeichen wie > . # ist nur dann eine Abkürzung, wenn es ein bekanntes Tag ist
      if (!ok) return null;
      var zeilen = [];
      rendere(baum, (elternTag || '').toLowerCase(), 0, 1, zeilen, einr);
      roh = zeilen.map(function (z) { return wdh(einr, z.tiefe) + z.s; }).join('\n');
    }
    var cursor = roh.indexOf(MARKE);
    var text = roh.split(MARKE).join('');
    return { text: text, cursor: cursor < 0 ? text.length : cursor };
  }

  /** Abkürzung vor dem Cursor finden: liefert { start, abk } oder null. */
  function emmetVor(text, pos) {
    var a = pos, klammer = 0;
    while (a > 0) {
      var c = text[a - 1];
      if (c === '}') klammer++;
      else if (c === '{') { if (!klammer) break; klammer--; }
      if (!klammer && !/[\w!.#*>+^$\[\]{}()=:"'@-]/.test(c)) break;
      if (klammer && c === '\n') break;
      a--;
    }
    var abk = text.slice(a, pos);
    // „<p>ul>li“: Der Teil bis zum „>“ gehört zum Tag davor
    if (text[a - 1] === '<') { var g = abk.indexOf('>'); if (g < 0) return null; a += g + 1; abk = abk.slice(g + 1); }
    if (!abk || /^[>+^*]/.test(abk)) return null;
    return { start: a, abk: abk };
  }

  HS.formatiere = formatiere;
  HS.formatiereHtml = formatiereHtml;
  HS.formatiereCss = formatiereCss;
  HS.formatiereJs = formatiereJs;
  HS.kommentiere = kommentiere;
  HS.emmet = emmet;
  HS.emmetVor = emmetVor;
  HS.INLINE = INLINE;
  HS.TAGS = TAGS;
})(typeof window !== 'undefined' ? window : this);
