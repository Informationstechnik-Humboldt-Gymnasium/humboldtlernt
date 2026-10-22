// HTML-Sandbox · Quelltext verstehen (ohne DOM)
// - parseHtml: fehlertoleranter HTML-Parser mit Zeichenpositionen (auch für halb getippten Code)
// - parseCss:  CSS-Regeln mit Positionen (für den Inspektor: „welche Regel greift?“)
// - baueVorschau: Vorschau-Dokument mit data-src-start/-end, eingefügtem style.css/script.js und Zeilenkarte
// - schleifenSchutz: bricht Endlosschleifen im Schülercode nach kurzer Zeit ab
// Läuft im Browser und in den Tests (Node-VM). Keine DOM-Zugriffe in dieser Datei.
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  // Elemente ohne Endtag
  var LEER = mengeAus('area base br col embed hr img input link meta source track wbr');
  // Elemente, deren Inhalt reiner Text ist (darin gibt es keine Tags)
  var ROH = mengeAus('script style textarea title');
  // Diese Elemente beenden ein offenes <p> (vereinfachte Regel aus dem HTML-Standard)
  var P_ENDE = mengeAus('address article aside blockquote details div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr main menu nav ol p pre section table ul');
  // Diese Elemente beenden ein offenes Element gleicher Art (z. B. <li> nach <li>)
  // Elemente, deren End-Tag weggelassen werden darf (kein Hinweis „nicht geschlossen“)
  var OPTIONAL = mengeAus('html head body p li td th tr dt dd option optgroup thead tbody tfoot colgroup caption rt rp');
  var SCHLIESST = { li: mengeAus('li'), dt: mengeAus('dt dd'), dd: mengeAus('dt dd'), tr: mengeAus('tr td th'), td: mengeAus('td th'), th: mengeAus('td th'), option: mengeAus('option'), thead: mengeAus('tbody tfoot'), tbody: mengeAus('thead tbody'), tfoot: mengeAus('thead tbody') };

  function mengeAus(s) { var m = {}; s.split(' ').forEach(function (w) { m[w] = true; }); return m; }
  function istBuchstabe(c) { return !!c && /[a-zA-Z]/.test(c); }
  function istLeer(c) { return c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f'; }

  // ---------------------------------------------------------------- HTML
  // Ergebnis: Baum aus Knoten { typ: 'element'|'text'|'kommentar'|'doctype'|'fremd', start, ende, … }.
  // Ein Element hat zusätzlich name, startEnde (hinter „>“ des Start-Tags), innerEnde (vor dem End-Tag),
  // geschlossen (true = eigenes End-Tag vorhanden), attrs [{ name, wert, start, ende, wertStart, wertEnde }], kinder, eltern.
  // Die Knoten der obersten Ebene decken zusammen den ganzen Text ab – nichts geht verloren.
  function liesStartTag(text, i) {
    var n = text.length, j = i + 1;
    var m = /^[a-zA-Z][a-zA-Z0-9:_-]*/.exec(text.slice(j, j + 80));
    var name = m[0]; j += name.length;
    var attrs = [];
    while (j < n) {
      while (j < n && istLeer(text[j])) j++;
      if (j >= n) break;
      var c = text[j];
      if (c === '>') return { name: name.toLowerCase(), attrs: attrs, ende: j + 1, selbst: text[j - 1] === '/' };
      if (c === '/') { j++; continue; }
      if (c === '<') return null;                                 // vermutlich wird gerade getippt: kein gültiges Tag
      var as = j;
      while (j < n && !istLeer(text[j]) && text[j] !== '=' && text[j] !== '>' && text[j] !== '/' && text[j] !== '<') j++;
      if (j === as) j++;                                           // einzelnes „=“ o. Ä. überspringen
      var a = { name: text.slice(as, j).toLowerCase(), wert: null, start: as, ende: j, wertStart: -1, wertEnde: -1 };
      var k = j;
      while (k < n && istLeer(text[k])) k++;
      if (text[k] === '=') {
        k++;
        while (k < n && istLeer(text[k])) k++;
        if (text[k] === '"' || text[k] === "'") {
          var e = text.indexOf(text[k], k + 1);
          if (e < 0) return null;                                  // Anführungszeichen noch nicht geschlossen
          a.wertStart = k + 1; a.wertEnde = e; j = e + 1;
        } else {
          a.wertStart = k;
          while (k < n && !istLeer(text[k]) && text[k] !== '>') k++;
          a.wertEnde = k; j = k;
        }
        a.wert = text.slice(a.wertStart, a.wertEnde);
        a.ende = j;
      }
      attrs.push(a);
    }
    return null;
  }

  function parseHtml(text) {
    text = String(text == null ? '' : text);
    var n = text.length;
    var wurzel = { typ: 'wurzel', start: 0, ende: n, kinder: [], eltern: null, tiefe: -1 };
    var stapel = [wurzel], elemente = [], probleme = [];
    var i = 0, textStart = 0;
    function oben() { return stapel[stapel.length - 1]; }
    function textBis(bis) { if (bis > textStart) oben().kinder.push({ typ: 'text', start: textStart, ende: bis }); }
    function schliesseOben(pos) { var el = stapel.pop(); el.innerEnde = pos; el.ende = pos; el.geschlossen = false; }

    while (i < n) {
      if (text[i] !== '<') { i = text.indexOf('<', i); if (i < 0) i = n; continue; }
      var c1 = text[i + 1];
      if (text.startsWith('<!--', i)) {
        textBis(i);
        var ke = text.indexOf('-->', i + 4);
        if (ke < 0) probleme.push({ art: 'kommentar', start: i, text: 'Kommentar ohne Ende „-->“' });
        var kende = ke < 0 ? n : ke + 3;
        oben().kinder.push({ typ: 'kommentar', start: i, ende: kende });
        i = textStart = kende; continue;
      }
      if (c1 === '!' || c1 === '?') {
        textBis(i);
        var g = text.indexOf('>', i), gende = g < 0 ? n : g + 1;
        oben().kinder.push({ typ: /^<!doctype/i.test(text.slice(i, i + 9)) ? 'doctype' : 'fremd', start: i, ende: gende });
        i = textStart = gende; continue;
      }
      if (c1 === '/' && istBuchstabe(text[i + 2])) {
        var em = /^[a-zA-Z][a-zA-Z0-9:_-]*/.exec(text.slice(i + 2, i + 82));
        var ename = em[0].toLowerCase();
        var eg = text.indexOf('>', i + 2), eende = eg < 0 ? n : eg + 1;
        textBis(i);
        var s = stapel.length - 1;
        while (s > 0 && stapel[s].name !== ename) s--;
        if (s > 0) {
          while (stapel.length - 1 > s) {
            if (!OPTIONAL[oben().name]) probleme.push({ art: 'offen', start: oben().start, name: oben().name, text: '<' + oben().name + '> wurde nicht geschlossen' });
            schliesseOben(i);
          }
          var el = stapel.pop();
          el.innerEnde = i; el.ende = eende; el.geschlossen = true;
        } else {
          probleme.push({ art: 'fremd', start: i, name: ename, text: '</' + ename + '> hat kein passendes Start-Tag' });
          oben().kinder.push({ typ: 'fremd', start: i, ende: eende });
        }
        i = textStart = eende; continue;
      }
      if (istBuchstabe(c1)) {
        var t = liesStartTag(text, i);
        if (!t) { probleme.push({ art: 'tag', start: i, text: 'Tag ohne „>“' }); i++; continue; }
        textBis(i);
        // offene Elemente, die durch dieses Element automatisch enden (z. B. <li> nach <li>)
        while (oben().typ === 'element' && ((SCHLIESST[t.name] && SCHLIESST[t.name][oben().name]) || (oben().name === 'p' && P_ENDE[t.name]))) schliesseOben(i);
        var elem = { typ: 'element', name: t.name, start: i, startEnde: t.ende, innerEnde: t.ende, ende: t.ende, geschlossen: true,
          leer: !!LEER[t.name], attrs: t.attrs, kinder: [], eltern: oben() === wurzel ? null : oben(), tiefe: stapel.length - 1 };
        oben().kinder.push(elem);
        elemente.push(elem);
        i = textStart = t.ende;
        if (elem.leer) continue;
        if (ROH[t.name]) {
          var re = new RegExp('</' + t.name + '(?=[\\s/>])', 'ig');
          re.lastIndex = t.ende;
          var r = re.exec(text);
          if (r) {
            var rg = text.indexOf('>', r.index), rende = rg < 0 ? n : rg + 1;
            if (r.index > t.ende) elem.kinder.push({ typ: 'text', start: t.ende, ende: r.index });
            elem.innerEnde = r.index; elem.ende = rende;
          } else {
            if (n > t.ende) elem.kinder.push({ typ: 'text', start: t.ende, ende: n });
            elem.innerEnde = n; elem.ende = n; elem.geschlossen = false;
            probleme.push({ art: 'offen', start: i, name: t.name, text: '<' + t.name + '> wurde nicht geschlossen' });
          }
          i = textStart = elem.ende;
          continue;
        }
        stapel.push(elem);
        continue;
      }
      i++;                                                          // einzelnes „<“ ist normaler Text
    }
    textBis(n);
    while (stapel.length > 1) {
      var offen = oben();
      if (!OPTIONAL[offen.name]) probleme.push({ art: 'offen', start: offen.start, name: offen.name, text: '<' + offen.name + '> wurde nicht geschlossen' });
      schliesseOben(n);
    }
    return { text: text, wurzel: wurzel, elemente: elemente, probleme: probleme };
  }

  /** Tiefstes Element, das die Position enthält (bei Gleichstand das innerste). */
  function elementBei(analyse, pos) {
    var treffer = null;
    (function suche(liste) {
      for (var k = 0; k < liste.length; k++) {
        var x = liste[k];
        if (x.typ !== 'element') continue;
        if (pos >= x.start && (pos < x.ende || (pos === x.ende && !x.geschlossen))) { treffer = x; suche(x.kinder); return; }
      }
    })(analyse.wurzel.kinder);
    return treffer;
  }

  function attr(el, name) {
    for (var k = 0; k < el.attrs.length; k++) if (el.attrs[k].name === name) return el.attrs[k];
    return null;
  }

  /** Kurzname wie in den DevTools: div#start.box.rot */
  function kurzname(el) {
    var s = el.name, id = attr(el, 'id'), kl = attr(el, 'class');
    if (id && id.wert) s += '#' + id.wert.trim();
    if (kl && kl.wert) s += kl.wert.trim().split(/\s+/).filter(Boolean).map(function (k) { return '.' + k; }).join('');
    return s;
  }

  // ---------------------------------------------------------------- CSS
  // Regeln mit Positionen: { selektor, start, kopfEnde, ende }. Regeln in @media/@supports werden mit erfasst,
  // @keyframes/@font-face übersprungen. Fehlende „}“ am Ende sind erlaubt (Regel reicht dann bis zum Textende).
  function parseCss(text, versatz) {
    text = String(text == null ? '' : text);
    versatz = versatz || 0;
    var regeln = [], stapel = [], i = 0, n = text.length, kopfStart = -1;
    while (i < n) {
      var c = text[i];
      if (c === '/' && text[i + 1] === '*') { var e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '"' || c === "'") { var q = i + 1; while (q < n && text[q] !== c && text[q] !== '\n') q += text[q] === '\\' ? 2 : 1; if (kopfStart < 0 && !stapel.length) kopfStart = i; i = q + 1; continue; }
      var art = stapel.length ? stapel[stapel.length - 1].art : 'regeln';
      if (art === 'regeln') {
        if (c === '{') {
          var kopf = kopfStart < 0 ? '' : text.slice(kopfStart, i).trim();
          if (kopf[0] === '@') stapel.push({ art: /^@(media|supports|container|layer|scope|document)\b/i.test(kopf) ? 'regeln' : 'aus' });
          else {
            var r = { selektor: kopf.replace(/\s+/g, ' '), start: (kopfStart < 0 ? i : kopfStart) + versatz, kopfEnde: i + 1 + versatz, ende: n + versatz };
            if (kopf) regeln.push(r);
            stapel.push({ art: 'dekl', regel: r });
          }
          kopfStart = -1; i++; continue;
        }
        if (c === '}' || c === ';') { if (c === '}') stapel.pop(); kopfStart = -1; i++; continue; }
        if (kopfStart < 0 && !istLeer(c)) kopfStart = i;
        i++; continue;
      }
      if (c === '{') stapel.push({ art: 'aus' });
      else if (c === '}') { var b = stapel.pop(); if (b.regel) b.regel.ende = i + 1 + versatz; }
      i++;
    }
    return regeln;
  }

  /** Regel, in der die Position steht (für die Markierung passender Elemente in der Vorschau). */
  function regelBei(regeln, pos) {
    for (var k = 0; k < regeln.length; k++) if (pos >= regeln[k].start && pos <= regeln[k].ende) return regeln[k];
    return null;
  }

  // ---------------------------------------------------------------- Schleifenschutz
  // Fügt am Anfang jedes Schleifenrumpfs „if(__hsSchleife("datei",zeile))break;“ ein (ohne neue Zeilen),
  // damit eine Endlosschleife die Seite nicht einfriert. Nur Schleifen mit geschweiften Klammern.
  function schleifenSchutz(code, datei, ersteZeile) {
    code = String(code == null ? '' : code);
    ersteZeile = ersteZeile || 1;
    var aus = '', i = 0, n = code.length, zeile = ersteZeile, letztes = '', zuletzt = 0;
    function weiter(bis) { for (var k = i; k < bis; k++) if (code[k] === '\n') zeile++; i = bis; }
    function ueberspringeLeer(p) {
      for (;;) {
        while (p < n && /\s/.test(code[p])) p++;
        if (code[p] === '/' && code[p + 1] === '/') { while (p < n && code[p] !== '\n') p++; continue; }
        if (code[p] === '/' && code[p + 1] === '*') { var e = code.indexOf('*/', p + 2); p = e < 0 ? n : e + 2; continue; }
        return p;
      }
    }
    function klammerEnde(p) {                                      // p zeigt auf „(“; liefert Position hinter der passenden „)“
      var t = 0;
      while (p < n) {
        var c = code[p];
        if (c === '"' || c === "'" || c === '`') { p = stringEnde(p); continue; }
        if (c === '(') t++;
        else if (c === ')') { t--; if (!t) return p + 1; }
        p++;
      }
      return -1;
    }
    function stringEnde(p) {
      var q = code[p], k = p + 1;
      while (k < n && code[k] !== q) { if (code[k] === '\\') k++; else if (q !== '`' && code[k] === '\n') break; k++; }
      return k + 1;
    }
    var einfuegen = [];                                             // Positionen hinter „{“ mit Zeile der Schleife
    while (i < n) {
      var c = code[i];
      if (c === '/' && code[i + 1] === '/') { var z = code.indexOf('\n', i); weiter(z < 0 ? n : z); continue; }
      if (c === '/' && code[i + 1] === '*') { var ze = code.indexOf('*/', i + 2); weiter(ze < 0 ? n : ze + 2); continue; }
      if (c === '"' || c === "'" || c === '`') { weiter(Math.min(n, stringEnde(i))); letztes = 'wert'; continue; }
      if (c === '/' && /^(|[(,=:[!&|?{};+\-*%<>~^]|return|typeof|case|do|else)$/.test(letztes)) {
        // regulärer Ausdruck
        var k = i + 1, inKlasse = false;
        while (k < n && code[k] !== '\n') { if (code[k] === '\\') k++; else if (code[k] === '[') inKlasse = true; else if (code[k] === ']') inKlasse = false; else if (code[k] === '/' && !inKlasse) break; k++; }
        weiter(Math.min(n, k + 1)); letztes = 'wert'; continue;
      }
      var w = /^[A-Za-z_$][\w$]*/.exec(code.slice(i, i + 40));
      if (w) {
        var wort = w[0], vorher = i > 0 ? code[i - 1] : '';
        if ((wort === 'for' || wort === 'while') && vorher !== '.') {
          var p = ueberspringeLeer(i + wort.length);
          if (code[p] === '(') {
            var pe = klammerEnde(p);
            if (pe > 0) { var b = ueberspringeLeer(pe); if (code[b] === '{') einfuegen.push({ pos: b + 1, zeile: zeile }); }
          }
        } else if (wort === 'do' && vorher !== '.') {
          var d = ueberspringeLeer(i + 2);
          if (code[d] === '{') einfuegen.push({ pos: d + 1, zeile: zeile });
        }
        weiter(i + wort.length); letztes = wort; continue;
      }
      if (!/\s/.test(c)) letztes = c;
      weiter(i + 1);
    }
    for (var m = 0; m < einfuegen.length; m++) {
      aus += code.slice(zuletzt, einfuegen[m].pos) + 'if(__hsSchleife(' + JSON.stringify(String(datei)) + ',' + einfuegen[m].zeile + '))break;';
      zuletzt = einfuegen[m].pos;
    }
    return aus + code.slice(zuletzt);
  }

  // ---------------------------------------------------------------- Vorschau-Dokument
  function istJsTyp(el) {
    var t = attr(el, 'type');
    return !t || !t.wert || /^(text\/javascript|application\/javascript|module)$/i.test(t.wert.trim());
  }
  function dateiName(pfad) { return String(pfad || '').trim().replace(/^\.\//, ''); }
  function zeileVon(text, pos) { var z = 1; for (var k = 0; k < pos; k++) if (text.charCodeAt(k) === 10) z++; return z; }
  function zeilenIn(s) { var z = 0; for (var k = 0; k < s.length; k++) if (s.charCodeAt(k) === 10) z++; return z; }
  var BILD = /\.(png|jpe?g|gif|webp|svg)$/i;

  /** Datei-Inhalt als data:-URL (Bilder aus dem Projekt in der Vorschau anzeigen). */
  function alsDataUrl(name, inhalt) {
    if (/^data:/.test(inhalt)) return inhalt;
    if (/\.svg$/i.test(name)) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(inhalt);
    return '';
  }
  /** url(bild.svg) in CSS durch die data:-URL ersetzen (gleiche Zeilenzahl). */
  function cssUrlsErsetzen(css, dateien) {
    return css.replace(/url\(\s*(["']?)([^"')\s]+)\1\s*\)/g, function (ganz, q, pfad) {
      var name = dateiName(pfad);
      return BILD.test(name) && dateien[name] != null ? 'url("' + alsDataUrl(name, dateien[name]) + '")' : ganz;
    });
  }

  // Baut aus den Projektdateien das Dokument für den <iframe srcdoc>. Der Code im Editor bleibt unverändert.
  // dateien: { 'index.html': '…', 'style.css': '…' }, opt: { haupt: 'index.html', bruecke: '<script>…</script>' oder function ({ regeln }) → Text }
  // Ergebnis: { html, karte (Zeilen des Vorschau-Dokuments → Datei und Zeile), regeln, warnungen, analyse }
  function baueVorschau(dateien, opt) {
    opt = opt || {};
    var haupt = opt.haupt || 'index.html';
    var quelle = dateien[haupt];
    var warnungen = [], regeln = [];
    if (quelle == null) quelle = '<!doctype html><p style="font-family:sans-serif;color:#888">Die Datei „' + haupt + '“ gibt es nicht.</p>';
    var a = parseHtml(quelle);
    var ops = [];                                                    // { start, ende, stuecke: [{ text, datei, zeile }] }
    var amEnde = [];                                                 // Skripte mit defer: ans Ende des Dokuments
    var ersetzt = {};

    a.elemente.forEach(function (el) {
      var vollstaendig = quelle[el.startEnde - 1] === '>';
      if (el.name === 'link' && vollstaendig) {
        var rel = attr(el, 'rel'), href = attr(el, 'href'), name = href && dateiName(href.wert);
        if (rel && /stylesheet/i.test(rel.wert || '') && name && !/^[a-z]+:|^\/\//i.test(name)) {
          if (dateien[name] != null) {
            var media = attr(el, 'media');
            var css = cssUrlsErsetzen(dateien[name], dateien);
            regeln = regeln.concat(parseCss(dateien[name]).map(function (r) { r.datei = name; return r; }));
            ops.push({ start: el.start, ende: el.ende, stuecke: [
              { text: '<style data-hs-datei="' + name + '"' + (media && media.wert ? ' media="' + media.wert.replace(/"/g, '&quot;') + '"' : '') + '>' },
              { text: css, datei: name, zeile: 1 },
              { text: '</style>' }] });
            ersetzt[el.start] = true;
          } else warnungen.push({ text: 'Die Datei „' + name + '“ gibt es im Projekt nicht (<link> in ' + haupt + ').', datei: haupt, zeile: zeileVon(quelle, el.start) });
        }
      }
      if (el.name === 'script' && vollstaendig) {
        var src = attr(el, 'src'), sname = src && dateiName(src.wert);
        if (sname && !/^[a-z]+:|^\/\//i.test(sname)) {
          if (dateien[sname] != null) {
            var andere = el.attrs.filter(function (x) { return x.name !== 'src' && x.name !== 'defer' && x.name !== 'async'; })
              .map(function (x) { return ' ' + quelle.slice(x.start, x.ende).replace(/\s*\n\s*/g, ' '); }).join('');
            var js = dateien[sname].replace(/<\/script/gi, '<\\/script');
            if (istJsTyp(el)) js = schleifenSchutz(js, sname, 1);
            var st = [{ text: '<script' + andere + ' data-hs-datei="' + sname + '">' }, { text: js, datei: sname, zeile: 1 }, { text: '\n</script>' }];
            if (attr(el, 'defer') && !/module/i.test((attr(el, 'type') || {}).wert || '')) { amEnde.push(st); ops.push({ start: el.start, ende: el.ende, stuecke: [] }); }
            else ops.push({ start: el.start, ende: el.ende, stuecke: st });
            ersetzt[el.start] = true;
          } else warnungen.push({ text: 'Die Datei „' + sname + '“ gibt es im Projekt nicht (<script> in ' + haupt + ').', datei: haupt, zeile: zeileVon(quelle, el.start) });
        } else if (!src && el.geschlossen && istJsTyp(el) && el.innerEnde > el.startEnde) {
          var inner = quelle.slice(el.startEnde, el.innerEnde);
          var geschuetzt = schleifenSchutz(inner, haupt, zeileVon(quelle, el.startEnde));
          if (geschuetzt !== inner) ops.push({ start: el.startEnde, ende: el.innerEnde, stuecke: [{ text: geschuetzt, datei: haupt, zeile: zeileVon(quelle, el.startEnde) }] });
        }
      }
      if (el.name === 'style' && el.innerEnde > el.startEnde) {
        regeln = regeln.concat(parseCss(quelle.slice(el.startEnde, el.innerEnde), el.startEnde).map(function (r) { r.datei = haupt; return r; }));
      }
      // Bilder aus dem Projekt (img src, source srcset nicht)
      if ((el.name === 'img' || el.name === 'source' || el.name === 'video' || el.name === 'audio') && vollstaendig) {
        var bild = attr(el, 'src');
        var bname = bild && dateiName(bild.wert);
        if (bname && bild.wertStart >= 0 && BILD.test(bname) && dateien[bname] != null) {
          ops.push({ start: bild.wertStart, ende: bild.wertEnde, stuecke: [{ text: alsDataUrl(bname, dateien[bname]) }], klein: true });
        }
      }
      // Positionen für den Klick in der Vorschau – nur im Vorschau-Dokument, nie im Editor
      if (vollstaendig && !ersetzt[el.start]) {
        ops.push({ start: el.startEnde - 1, ende: el.startEnde - 1, stuecke: [{ text: ' data-src-start="' + el.start + '" data-src-end="' + el.ende + '"' }] });
      }
    });

    // Brücke (Konsole, Fehler, Inspektor) möglichst früh: hinter <head>, sonst hinter <html> bzw. <!doctype>, sonst ganz vorn
    var kopf = a.elemente.filter(function (el) { return el.name === 'head'; })[0] || a.elemente.filter(function (el) { return el.name === 'html'; })[0];
    var bruecke = 0;
    if (kopf && quelle[kopf.startEnde - 1] === '>') bruecke = kopf.startEnde;
    else {
      var dt = a.wurzel.kinder.filter(function (k) { return k.typ === 'doctype'; })[0];
      if (dt) bruecke = dt.ende;
    }
    var brueckeText = typeof opt.bruecke === 'function' ? opt.bruecke({ regeln: regeln }) : (opt.bruecke || '');
    ops.push({ start: bruecke, ende: bruecke, stuecke: [{ text: brueckeText }], zuerst: true });

    ops.sort(function (x, y) { return x.start - y.start || (y.zuerst ? 1 : 0) - (x.zuerst ? 1 : 0) || (x.ende - x.start) - (y.ende - y.start); });

    var stuecke = [], pos = 0;
    ops.forEach(function (op) {
      if (op.start < pos) return;                                    // überlappt eine schon ersetzte Stelle
      if (op.start > pos) stuecke.push({ text: quelle.slice(pos, op.start), datei: haupt, zeile: zeileVon(quelle, pos) });
      op.stuecke.forEach(function (s) { stuecke.push(s); });
      pos = op.ende;
    });
    if (pos < quelle.length) stuecke.push({ text: quelle.slice(pos), datei: haupt, zeile: zeileVon(quelle, pos) });
    amEnde.forEach(function (st) { stuecke.push({ text: '\n' }); st.forEach(function (s) { stuecke.push(s); }); });

    var html = '', karte = [], gen = 1;
    stuecke.forEach(function (s) {
      if (s.datei) karte.push({ gen: gen, zeilen: zeilenIn(s.text), datei: s.datei, zeile: s.zeile });
      html += s.text;
      gen += zeilenIn(s.text);
    });
    return { html: html, karte: karte, regeln: regeln, warnungen: warnungen, analyse: a, haupt: haupt };
  }

  /** Zeile im Vorschau-Dokument → { datei, zeile } im Projekt (oder null). */
  function ordneZeile(karte, gen) {
    var treffer = null;
    for (var k = 0; k < karte.length; k++) {
      var s = karte[k];
      if (gen >= s.gen && gen <= s.gen + s.zeilen) treffer = { datei: s.datei, zeile: s.zeile + (gen - s.gen) };
    }
    return treffer;
  }

  HS.LEER = LEER;
  HS.parseHtml = parseHtml;
  HS.elementBei = elementBei;
  HS.attr = attr;
  HS.kurzname = kurzname;
  HS.parseCss = parseCss;
  HS.regelBei = regelBei;
  HS.schleifenSchutz = schleifenSchutz;
  HS.baueVorschau = baueVorschau;
  HS.ordneZeile = ordneZeile;
  HS.zeileVon = zeileVon;
})(typeof window !== 'undefined' ? window : this);
