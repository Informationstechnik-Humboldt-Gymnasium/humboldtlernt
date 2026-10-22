// HTML-Sandbox · Syntax-Hervorhebung (ohne DOM)
// HS.faerbe(text, sprache) zerlegt den Code in Abschnitte mit einer Klasse (tag, attr, wert, kom, kw, str, …).
// Ergebnis: eine Liste pro Zeile mit { von, bis, k } (Spalten in dieser Zeile). Daraus baut der Editor
// das farbige HTML (HS.zeileHtml) und die Minimap. Die Farben stehen in sandbox.css (--t-tag, --t-attr …).
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  function menge(s) { var m = {}; s.split(' ').forEach(function (w) { m[w] = true; }); return m; }
  var JS_STEUER = menge('if else for while do return break continue switch case default try catch finally throw new delete typeof instanceof in of await yield void');
  var JS_WORT = menge('const let var function class extends this null undefined true false async static get set super import export from NaN Infinity');
  var JS_TYP = menge('console document window Math JSON Array Object String Number Boolean Date Promise Map Set RegExp Error localStorage sessionStorage navigator location setTimeout setInterval clearTimeout clearInterval requestAnimationFrame alert prompt confirm parseInt parseFloat isNaN fetch event');

  // ---------------------------------------------------------------- JavaScript
  function js(text, von, bis, aus) {
    var i = von, letztes = '';
    while (i < bis) {
      var c = text[i];
      if (c === '/' && text[i + 1] === '/') { var z = text.indexOf('\n', i); z = z < 0 || z > bis ? bis : z; aus.push([i, z, 'kom']); i = z; continue; }
      if (c === '/' && text[i + 1] === '*') { var e = text.indexOf('*/', i + 2); e = e < 0 || e + 2 > bis ? bis : e + 2; aus.push([i, e, 'kom']); i = e; continue; }
      if (c === '"' || c === "'" || c === '`') {
        var k = i + 1;
        while (k < bis && text[k] !== c) { if (text[k] === '\\') k++; else if (c !== '`' && text[k] === '\n') break; k++; }
        k = Math.min(bis, k + 1); aus.push([i, k, 'str']); i = k; letztes = 'wert'; continue;
      }
      if (c === '/' && /^(|[(,=:[!&|?{};+\-*%<>~^]|return|typeof|case|do|else)$/.test(letztes)) {
        var r = i + 1, kl = false;
        while (r < bis && text[r] !== '\n') { if (text[r] === '\\') r++; else if (text[r] === '[') kl = true; else if (text[r] === ']') kl = false; else if (text[r] === '/' && !kl) break; r++; }
        if (text[r] === '/') { r++; while (r < bis && /[a-z]/.test(text[r])) r++; aus.push([i, r, 'regex']); i = r; letztes = 'wert'; continue; }
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(text[i + 1] || ''))) {
        var m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*\.?\d*(e[+-]?\d+)?|\.\d+(e[+-]?\d+)?)n?/.exec(text.slice(i, Math.min(bis, i + 40)));
        var l = m ? m[0].length : 1; aus.push([i, i + l, 'zahl']); i += l; letztes = 'wert'; continue;
      }
      var w = /^[A-Za-z_$][\w$]*/.exec(text.slice(i, Math.min(bis, i + 60)));
      if (w) {
        var wort = w[0], ende = i + wort.length, nach = ende;
        while (nach < bis && (text[nach] === ' ' || text[nach] === '\t')) nach++;
        var nachPunkt = letztes === '.';
        var k2 = !nachPunkt && JS_STEUER[wort] ? 'kw2' : !nachPunkt && JS_WORT[wort] ? 'kw'
          : text[nach] === '(' ? 'fn' : !nachPunkt && JS_TYP[wort] ? 'typ' : nachPunkt ? 'eig' : /^[A-Z]/.test(wort) ? 'typ' : 'var';
        aus.push([i, ende, k2]); i = ende; letztes = wort; continue;
      }
      if (!/\s/.test(c)) letztes = c;
      i++;
    }
  }

  // ---------------------------------------------------------------- CSS
  function css(text, von, bis, aus) {
    var i = von, arten = [], wert = false;
    function art() { return arten.length ? arten[arten.length - 1] : 'regeln'; }
    while (i < bis) {
      var c = text[i];
      if (c === '/' && text[i + 1] === '*') { var e = text.indexOf('*/', i + 2); e = e < 0 || e + 2 > bis ? bis : e + 2; aus.push([i, e, 'kom']); i = e; continue; }
      if (c === '"' || c === "'") { var k = i + 1; while (k < bis && text[k] !== c && text[k] !== '\n') k += text[k] === '\\' ? 2 : 1; k = Math.min(bis, k + 1); aus.push([i, k, 'str']); i = k; continue; }
      if (art() === 'regeln') {
        if (c === '@') {
          var at = /^@[\w-]+/.exec(text.slice(i, i + 40)); var al = at ? at[0].length : 1;
          aus.push([i, i + al, 'kw2']);
          var ak = i + al, ae = ak;
          while (ae < bis && text[ae] !== '{' && text[ae] !== ';') ae++;
          var istRegeln = /^@(media|supports|container|layer|scope|document)$/i.test(at ? at[0] : '');
          i = ak;
          while (i < ae) {                                           // Prelude: Zahlen und Wörter
            var mz = /^-?\d*\.?\d+[a-z%]*/i.exec(text.slice(i, ae));
            if (mz && /[\d]/.test(mz[0])) { aus.push([i, i + mz[0].length, 'zahl']); i += mz[0].length; continue; }
            var mw = /^[a-zA-Z-]+/.exec(text.slice(i, ae));
            if (mw) { aus.push([i, i + mw[0].length, text[i + mw[0].length] === ':' ? 'ceig' : 'cwert']); i += mw[0].length; continue; }
            i++;
          }
          if (text[i] === '{') { arten.push(istRegeln ? 'regeln' : 'aus'); i++; }
          else i++;
          continue;
        }
        if (c === '{') { arten.push('dekl'); wert = false; i++; continue; }
        if (c === '}') { arten.pop(); i++; continue; }
        if (c === '.' || c === '#') { var ms = /^[.#][\w-]+/.exec(text.slice(i, i + 80)); if (ms) { aus.push([i, i + ms[0].length, c === '.' ? 'sel-kl' : 'sel-id']); i += ms[0].length; continue; } }
        if (c === ':') { var mp = /^::?[\w-]+/.exec(text.slice(i, i + 60)); if (mp) { aus.push([i, i + mp[0].length, 'sel-ps']); i += mp[0].length; continue; } }
        if (c === '[') { var ka = text.indexOf(']', i); ka = ka < 0 || ka > bis ? bis : ka + 1; aus.push([i, ka, 'attr']); i = ka; continue; }
        var mt = /^[a-zA-Z][\w-]*/.exec(text.slice(i, i + 60));
        if (mt) { aus.push([i, i + mt[0].length, 'sel-tag']); i += mt[0].length; continue; }
        if (c === '*') { aus.push([i, i + 1, 'sel-tag']); i++; continue; }
        i++; continue;
      }
      if (art() === 'aus') { if (c === '{') arten.push('aus'); else if (c === '}') arten.pop(); i++; continue; }
      // Deklarationen
      if (c === '}') { arten.pop(); wert = false; i++; continue; }
      if (c === '{') { arten.push('dekl'); wert = false; i++; continue; }
      if (c === ';') { wert = false; i++; continue; }
      if (!wert) {
        if (c === ':') { wert = true; i++; continue; }
        var me = /^-{0,2}[a-zA-Z][\w-]*/.exec(text.slice(i, i + 60));
        if (me) { aus.push([i, i + me[0].length, 'ceig']); i += me[0].length; continue; }
        // verschachtelte Regel (CSS-Nesting) oder Selektor-Zeichen
        i++; continue;
      }
      if (c === '#') { var mh = /^#[0-9a-fA-F]{3,8}\b/.exec(text.slice(i, i + 10)); if (mh) { aus.push([i, i + mh[0].length, 'zahl']); i += mh[0].length; continue; } }
      if (c === '!') { var mi = /^!\s*important/i.exec(text.slice(i, i + 20)); if (mi) { aus.push([i, i + mi[0].length, 'kw2']); i += mi[0].length; continue; } }
      var mn = /^-?(\d+\.?\d*|\.\d+)([a-zA-Z%]*)/.exec(text.slice(i, i + 30));
      if (mn && (i === 0 || !/[\w-]/.test(text[i - 1]))) { aus.push([i, i + mn[0].length, 'zahl']); i += mn[0].length; continue; }
      var mf = /^[a-zA-Z-][\w-]*/.exec(text.slice(i, i + 60));
      if (mf) { aus.push([i, i + mf[0].length, text[i + mf[0].length] === '(' ? 'fn' : 'cwert']); i += mf[0].length; continue; }
      i++;
    }
  }

  // ---------------------------------------------------------------- HTML
  function html(text, aus) {
    var i = 0, n = text.length;
    while (i < n) {
      var lt = text.indexOf('<', i), amp = text.indexOf('&', i);
      if (amp >= 0 && (lt < 0 || amp < lt)) {
        var me = /^&(#?[a-zA-Z0-9]+);/.exec(text.slice(amp, amp + 12));
        if (me) aus.push([amp, amp + me[0].length, 'ent']);
        i = amp + 1; continue;
      }
      if (lt < 0) break;
      i = lt;
      if (text.startsWith('<!--', i)) { var ke = text.indexOf('-->', i + 4); ke = ke < 0 ? n : ke + 3; aus.push([i, ke, 'kom']); i = ke; continue; }
      if (text[i + 1] === '!' || text[i + 1] === '?') { var de = text.indexOf('>', i); de = de < 0 ? n : de + 1; aus.push([i, de, 'doc']); i = de; continue; }
      var ende = text[i + 1] === '/';
      var mn = /^[a-zA-Z][\w:-]*/.exec(text.slice(i + (ende ? 2 : 1), i + 80));
      if (!mn) { i++; continue; }
      var name = mn[0].toLowerCase();
      aus.push([i, i + (ende ? 2 : 1), 'punkt']);
      var p = i + (ende ? 2 : 1);
      aus.push([p, p + mn[0].length, 'tag']);
      p += mn[0].length;
      while (p < n && text[p] !== '>' && text[p] !== '<') {
        var c = text[p];
        if (/\s/.test(c)) { p++; continue; }
        if (c === '/') { aus.push([p, p + 1, 'punkt']); p++; continue; }
        if (c === '=') { aus.push([p, p + 1, 'punkt']); p++; continue; }
        if (c === '"' || c === "'") { var q = text.indexOf(c, p + 1); q = q < 0 ? n : q + 1; aus.push([p, q, 'wert']); p = q; continue; }
        var ma = /^[^\s=>\/<"']+/.exec(text.slice(p, p + 80));
        var al = ma ? ma[0].length : 1;
        // unquotierter Wert direkt nach „=“
        var vor = p - 1; while (vor > i && /\s/.test(text[vor])) vor--;
        if (text[vor] === '=') aus.push([p, p + al, 'wert']);
        else aus.push([p, p + al, 'attr']);
        p += al;
      }
      if (text[p] === '>') { aus.push([p, p + 1, 'punkt']); p++; }
      i = p;
      if (!ende && (name === 'script' || name === 'style')) {
        var re = new RegExp('</' + name + '(?=[\\s/>])', 'ig'); re.lastIndex = i;
        var r = re.exec(text), bis = r ? r.index : n;
        var kopf = text.slice(lt, i);
        var typM = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(kopf);
        if (name === 'style') css(text, i, bis, aus);
        else if (!typM || /javascript|module/i.test(typM[1])) js(text, i, bis, aus);
        i = bis;
      }
    }
  }

  /** Abschnitte pro Zeile. sprache: 'html' | 'css' | 'js' | sonst nur Text */
  function faerbe(text, sprache) {
    var t = [];
    if (sprache === 'html' || sprache === 'svg') html(text, t);
    else if (sprache === 'css') css(text, 0, text.length, t);
    else if (sprache === 'js') js(text, 0, text.length, t);
    // Abschnitte an Zeilenumbrüchen teilen
    var zeilen = [[]], z = 0, zs = 0, k = 0;
    var umbrueche = [];
    for (var p = text.indexOf('\n'); p >= 0; p = text.indexOf('\n', p + 1)) umbrueche.push(p);
    for (var u = 0; u < umbrueche.length; u++) zeilen.push([]);
    var starts = [0].concat(umbrueche.map(function (x) { return x + 1; }));
    function zeileVon(pos) {                                         // binäre Suche
      var lo = 0, hi = starts.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
      return lo;
    }
    for (k = 0; k < t.length; k++) {
      var a = t[k][0], b = t[k][1], kl = t[k][2];
      if (b <= a) continue;
      z = zeileVon(a);
      while (a < b) {
        zs = starts[z];
        var zEnde = z + 1 < starts.length ? starts[z + 1] - 1 : text.length;
        var e = Math.min(b, zEnde);
        if (e > a) zeilen[z].push({ von: a - zs, bis: e - zs, k: kl });
        a = zEnde + 1; z++;
        if (z >= starts.length) break;
      }
    }
    return zeilen;
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /** Eine Zeile als HTML mit <span class="t-…">. */
  function zeileHtml(zeile, abschnitte) {
    var aus = '', pos = 0;
    for (var k = 0; k < abschnitte.length; k++) {
      var s = abschnitte[k];
      if (s.von < pos) continue;
      if (s.von > pos) aus += esc(zeile.slice(pos, s.von));
      aus += '<span class="t-' + s.k + '">' + esc(zeile.slice(s.von, s.bis)) + '</span>';
      pos = s.bis;
    }
    return aus + esc(zeile.slice(pos));
  }

  HS.faerbe = faerbe;
  HS.zeileHtml = zeileHtml;
  HS.escHtml = esc;
})(typeof window !== 'undefined' ? window : this);
