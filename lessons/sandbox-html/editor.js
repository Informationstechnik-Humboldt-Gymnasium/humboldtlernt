// HTML-Sandbox · Code-Editor im Stil von VS Code
// Aufbau: ein durchsichtiges <textarea> (nimmt Tastatur, Maus, Touch und Auswahl entgegen) liegt genau über einer
// farbigen Ebene (<pre> mit Syntax-Hervorhebung). Daneben Zeilennummern, rechts die Minimap.
// Eigene Funktionen: Rückgängig/Wiederholen, Einrücken, Klammern und Tags automatisch schließen, Emmet (Tab),
// Autovervollständigung, Suchen/Ersetzen, Formatieren, Kommentieren, Zeilen verschieben, farbiges Hervorheben eines Bereichs.
// Braucht: quelltext.js, werkzeuge.js, hervorheben.js, vorschlaege.js
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  function el(tag, klasse, html) { var e = document.createElement(tag); if (klasse) e.className = klasse; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return HS.escHtml(String(s)); }
  var PAARE = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  var ZU = { ')': 1, ']': 1, '}': 1, '"': 1, "'": 1, '`': 1 };
  var ART_ICON = { tag: '‹›', attr: '@', wert: '=', eig: '◆', fn: 'ƒ', var: 'x', kw: 'K', schnipsel: '⎘' };

  HS.erstelleEditor = function (wurzel, opt) {
    opt = opt || {};
    var E = {};
    var einst = { tab: 2, autoSchliessen: true, minimap: true, schrift: 14 };
    var modelle = {}, m = null;                                     // m = aktuelles Modell (eine Datei)
    var nurLesen = false;

    // ------------------------------------------------------------ DOM
    var ed = el('div', 'ed');
    var rinne = el('div', 'ed-rinne'); rinne.setAttribute('aria-hidden', 'true');
    var rinneInnen = el('div', 'ed-rinne-innen'); rinne.appendChild(rinneInnen);
    var flaeche = el('div', 'ed-flaeche');
    var ebene = el('div', 'ed-ebene'); ebene.setAttribute('aria-hidden', 'true');
    var deko = el('div', 'ed-deko');
    var code = el('pre', 'ed-code');
    var mess = el('span', 'ed-mess', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    ebene.appendChild(deko); ebene.appendChild(code); ebene.appendChild(mess);
    var ta = el('textarea', 'ed-eingabe');
    ta.setAttribute('spellcheck', 'false'); ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocorrect', 'off'); ta.setAttribute('wrap', 'off'); ta.setAttribute('aria-label', opt.label || 'Code-Editor');
    ta.setAttribute('aria-autocomplete', 'list');
    var liste = el('div', 'ed-liste'); liste.setAttribute('role', 'listbox'); liste.setAttribute('aria-label', 'Vorschläge'); liste.hidden = true;
    var suche = el('div', 'ed-suche',
      '<div class="ed-suche-zeile"><button type="button" class="ed-s-erw" title="Ersetzen ein-/ausblenden" aria-label="Ersetzen ein-/ausblenden" aria-expanded="false">›</button>' +
      '<input type="text" class="ed-s-text" placeholder="Suchen" aria-label="Suchen" spellcheck="false">' +
      '<button type="button" class="ed-s-opt" data-opt="gross" title="Groß-/Kleinschreibung beachten" aria-pressed="false">Aa</button>' +
      '<button type="button" class="ed-s-opt" data-opt="regex" title="Regulärer Ausdruck" aria-pressed="false">.*</button>' +
      '<span class="ed-s-zahl" aria-live="polite">Keine Ergebnisse</span>' +
      '<button type="button" class="ed-s-zurueck" title="Vorheriger Treffer (Umschalt+Eingabe)" aria-label="Vorheriger Treffer">↑</button>' +
      '<button type="button" class="ed-s-vor" title="Nächster Treffer (Eingabe)" aria-label="Nächster Treffer">↓</button>' +
      '<button type="button" class="ed-s-zu" title="Schließen (Esc)" aria-label="Suche schließen">×</button></div>' +
      '<div class="ed-suche-zeile ed-s-ersetzen" hidden><span class="ed-s-platz"></span><input type="text" class="ed-s-neu" placeholder="Ersetzen" aria-label="Ersetzen durch" spellcheck="false">' +
      '<button type="button" class="ed-s-eins" title="Ersetzen">Ersetzen</button><button type="button" class="ed-s-alle" title="Alle ersetzen">Alle</button></div>');
    suche.hidden = true;
    suche.setAttribute('role', 'search');
    flaeche.appendChild(ebene); flaeche.appendChild(ta); flaeche.appendChild(liste); flaeche.appendChild(suche);
    var karte = el('canvas', 'ed-minimap'); karte.setAttribute('aria-hidden', 'true');
    ed.appendChild(rinne); ed.appendChild(flaeche); ed.appendChild(karte);
    wurzel.appendChild(ed);

    // ------------------------------------------------------------ Maße
    var zh = 20, zb = 8, pad = { l: 10, t: 6 };
    function messen() {
      var cs = getComputedStyle(ta);
      zh = parseFloat(cs.lineHeight) || 20;
      pad.l = parseFloat(cs.paddingLeft) || 0; pad.t = parseFloat(cs.paddingTop) || 0;
      zb = mess.getBoundingClientRect().width / 50 || 8;
    }

    // ------------------------------------------------------------ Modelle (eine pro geöffneter Datei)
    function neuesModell(name, text, sprache) {
      return { name: name, text: text, sprache: sprache, verlauf: [], zukunft: [], a: 0, e: 0, sx: 0, sy: 0, letzteArt: '', letzteZeit: 0, marken: [], starts: null, farben: null, farbText: null };
    }
    function starts() {
      if (m.starts) return m.starts;
      var s = [0], t = m.text;
      for (var p = t.indexOf('\n'); p >= 0; p = t.indexOf('\n', p + 1)) s.push(p + 1);
      return (m.starts = s);
    }
    function zeileVon(pos) {
      var s = starts(), lo = 0, hi = s.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (s[mid] <= pos) lo = mid; else hi = mid - 1; }
      return lo;
    }
    function posVon(zeile, spalte) { var s = starts(); zeile = Math.max(0, Math.min(s.length - 1, zeile)); var ende = zeile + 1 < s.length ? s[zeile + 1] - 1 : m.text.length; return Math.min(ende, s[zeile] + (spalte || 0)); }

    // ------------------------------------------------------------ Verlauf (Rückgängig / Wiederholen)
    function merke(art) {
      var jetzt = Date.now();
      if (art === 'tippen' && m.letzteArt === 'tippen' && jetzt - m.letzteZeit < 900 && m.verlauf.length) { m.letzteZeit = jetzt; return; }
      m.verlauf.push({ text: m.text, a: m.a, e: m.e });
      if (m.verlauf.length > 300) m.verlauf.shift();
      m.zukunft = []; m.letzteArt = art; m.letzteZeit = jetzt;
    }
    function zustand(z) {
      ta.value = z.text; m.text = z.text; m.starts = null;
      ta.setSelectionRange(z.a, z.e); m.a = z.a; m.e = z.e;
      geaendert(); zeigeCursor();
    }
    function rueckgaengig() { if (!m.verlauf.length) return; m.zukunft.push({ text: m.text, a: ta.selectionStart, e: ta.selectionEnd }); zustand(m.verlauf.pop()); m.letzteArt = ''; }
    function wiederholen() { if (!m.zukunft.length) return; m.verlauf.push({ text: m.text, a: ta.selectionStart, e: ta.selectionEnd }); zustand(m.zukunft.pop()); m.letzteArt = ''; }

    /** Text ersetzen (mit Verlauf) und Auswahl setzen. */
    function ersetze(von, bis, neu, a, e, art) {
      if (nurLesen) return;
      m.a = ta.selectionStart; m.e = ta.selectionEnd;
      merke(art || 'befehl');
      var sy = ta.scrollTop, sx = ta.scrollLeft;
      ta.setRangeText(neu, von, bis, 'end');
      if (a != null) ta.setSelectionRange(a, e == null ? a : e);
      ta.scrollTop = sy; ta.scrollLeft = sx;
      m.text = ta.value; m.starts = null; m.a = ta.selectionStart; m.e = ta.selectionEnd;
      geaendert(); zeigeCursor();
    }

    // ------------------------------------------------------------ Zeichnen
    var geplant = false, nurDeko = false;
    function plane(nurDekoration) { if (!nurDekoration) nurDeko = false; else if (!geplant) nurDeko = true; if (geplant) return; geplant = true; requestAnimationFrame(zeichne); }
    function zeichne() {
      geplant = false;
      if (!m) return;
      if (!nurDeko) {
        if (m.farbText !== m.text) { m.farben = HS.faerbe(m.text, m.sprache); m.farbText = m.text; }
        var zeilen = m.text.split('\n'), html = new Array(zeilen.length);
        for (var i = 0; i < zeilen.length; i++) html[i] = HS.zeileHtml(zeilen[i], m.farben[i] || []);
        code.innerHTML = html.join('\n') + '\n';
        var nr = '', marken = {};
        m.marken.forEach(function (x) { if (!marken[x.zeile] || x.art === 'fehler') marken[x.zeile] = x; });
        for (var z = 0; z < zeilen.length; z++) {
          var mk = marken[z + 1];
          nr += '<div class="ed-nr' + (mk ? ' ed-' + mk.art : '') + '"' + (mk ? ' title="' + esc(mk.text) + '"' : '') + '>' + (z + 1) + '</div>';
        }
        rinneInnen.innerHTML = nr;
        rinne.style.width = (String(zeilen.length).length * zb + 26) + 'px';
      }
      nurDeko = false;
      zeichneDeko();
      zeichneKarte();
      scrollen();
    }
    function box(zeile, s1, s2, klasse, voll) {
      var d = '<div class="' + klasse + '" style="top:' + (pad.t + zeile * zh) + 'px;';
      if (voll) return d + 'left:0;right:0;height:' + zh + 'px"></div>';
      return d + 'left:' + (pad.l + s1 * zb) + 'px;width:' + Math.max(2, (s2 - s1) * zb) + 'px;height:' + zh + 'px"></div>';
    }
    function bereichsBoxen(von, bis, klasse) {
      var z1 = zeileVon(von), z2 = zeileVon(bis), s = starts(), h = '';
      for (var z = z1; z <= z2 && z - z1 < 400; z++) {
        var ende = z + 1 < s.length ? s[z + 1] - 1 : m.text.length;
        var a = z === z1 ? von - s[z] : 0, b = z === z2 ? bis - s[z] : ende - s[z];
        if (z !== z2 || b > a) h += box(z, a, Math.max(b, a + (z !== z2 ? 1 : 0)), klasse);
      }
      return h;
    }
    var blitz = null, treffer = [], aktTreffer = -1;
    function zeichneDeko() {
      var h = '', a = ta.selectionStart, e = ta.selectionEnd;
      if (a === e) h += box(zeileVon(a), 0, 0, 'ed-zeile', true);
      treffer.forEach(function (t, i) { if (i < 2000) h += bereichsBoxen(t[0], t[1], i === aktTreffer ? 'ed-treffer ed-treffer-akt' : 'ed-treffer'); });
      if (blitz) h += bereichsBoxen(blitz.von, blitz.bis, 'ed-blitz' + (blitz.aus ? ' ed-blitz-aus' : '')) + bereichsBoxen(blitz.von, Math.min(blitz.bis, blitz.kopf || blitz.bis), 'ed-blitz-kopf' + (blitz.aus ? ' ed-blitz-aus' : ''));
      m.marken.forEach(function (x) {
        if (x.art !== 'fehler' || x.zeile < 1) return;
        var s = starts(), z = x.zeile - 1; if (z >= s.length) return;
        var ende = z + 1 < s.length ? s[z + 1] - 1 : m.text.length, txt = m.text.slice(s[z], ende), ein = /^\s*/.exec(txt)[0].length;
        if (txt.trim()) h += box(z, ein, txt.length, 'ed-wellen');
      });
      deko.innerHTML = h;
      // aktive Zeilennummer
      var nrn = rinneInnen.children, akt = zeileVon(e);
      for (var k = 0; k < nrn.length; k++) nrn[k].classList.toggle('ed-nr-akt', k === akt);
    }
    function scrollen() {
      ebene.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
      rinneInnen.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
      zeichneKartenFenster();
      if (!liste.hidden) positioniereListe();
    }

    // ------------------------------------------------------------ Minimap
    var kartenBild = null, kartenVersatz = 0;
    function farbe(k) { return getComputedStyle(ed).getPropertyValue('--t-' + k).trim() || getComputedStyle(ed).getPropertyValue('--ed-text').trim(); }
    function zeichneKarte() {
      if (!einst.minimap || karte.hidden || !karte.clientWidth) return;
      var dpr = window.devicePixelRatio || 1, w = karte.clientWidth, h = karte.clientHeight;
      if (karte.width !== Math.round(w * dpr) || karte.height !== Math.round(h * dpr)) { karte.width = Math.round(w * dpr); karte.height = Math.round(h * dpr); }
      var zeilen = m.text.split('\n'), farben = m.farben || [];
      var hoch = 2, breit = 1;
      var off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(w * dpr)); off.height = Math.max(1, Math.round(Math.min(zeilen.length * hoch + 4, 20000) * dpr));
      var c = off.getContext('2d');
      c.scale(dpr, dpr);
      var cache = {}, standard = farbe('text');
      function f(k) { return cache[k] || (cache[k] = farbe(k)); }
      c.globalAlpha = 0.75;
      for (var z = 0; z < zeilen.length && z * hoch < 20000; z++) {
        var t = zeilen[z], abschnitte = farben[z] || [], pos = 0;
        var zeichneLauf = function (von, bis, fa) {
          var s = von;
          while (s < bis) {
            while (s < bis && t[s] === ' ') s++;
            var e = s; while (e < bis && t[e] !== ' ') e++;
            if (e > s) { c.fillStyle = fa; c.fillRect(4 + s * breit, z * hoch + 2, Math.min(w, (e - s) * breit), hoch - 0.6); }
            s = e;
          }
        };
        for (var k = 0; k < abschnitte.length; k++) {
          if (abschnitte[k].von > pos) zeichneLauf(pos, abschnitte[k].von, standard);
          zeichneLauf(abschnitte[k].von, abschnitte[k].bis, f(abschnitte[k].k));
          pos = abschnitte[k].bis;
        }
        if (pos < t.length) zeichneLauf(pos, t.length, standard);
      }
      kartenBild = off;
      zeichneKartenFenster();
    }
    function zeichneKartenFenster() {
      if (!einst.minimap || karte.hidden || !kartenBild) return;
      var dpr = window.devicePixelRatio || 1, h = karte.clientHeight, w = karte.clientWidth;
      var inhalt = kartenBild.height / dpr;
      var maxScroll = Math.max(1, ta.scrollHeight - ta.clientHeight);
      kartenVersatz = inhalt > h ? (ta.scrollTop / maxScroll) * (inhalt - h) : 0;
      var c = karte.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, karte.width, karte.height);
      c.drawImage(kartenBild, 0, Math.round(kartenVersatz * dpr), kartenBild.width, Math.min(kartenBild.height, Math.round(h * dpr)), 0, 0, kartenBild.width, Math.min(kartenBild.height, Math.round(h * dpr)));
      var faktor = 2 / zh;
      c.fillStyle = farbe('minimap-fenster') || 'rgba(128,128,128,.2)';
      c.fillRect(0, (ta.scrollTop * faktor - kartenVersatz) * dpr, w * dpr, ta.clientHeight * faktor * dpr);
    }
    function karteZiehen(e) {
      var r = karte.getBoundingClientRect();
      var y = e.clientY - r.top + kartenVersatz;
      ta.scrollTop = y / (2 / zh) - ta.clientHeight / 2;
      scrollen();
    }
    karte.addEventListener('pointerdown', function (e) {
      e.preventDefault(); karteZiehen(e);
      karte.setPointerCapture(e.pointerId);
      var bew = function (ev) { karteZiehen(ev); };
      var hoch = function () { karte.removeEventListener('pointermove', bew); karte.removeEventListener('pointerup', hoch); ta.focus({ preventScroll: true }); };
      karte.addEventListener('pointermove', bew); karte.addEventListener('pointerup', hoch);
    });

    // ------------------------------------------------------------ Cursor sichtbar halten
    function koordinaten(pos) { var z = zeileVon(pos); return { x: pad.l + (pos - starts()[z]) * zb, y: pad.t + z * zh, zeile: z }; }
    function zeigeCursor(mitte) {
      var k = koordinaten(ta.selectionEnd);
      var h = ta.clientHeight, w = ta.clientWidth;
      if (mitte) ta.scrollTop = Math.max(0, k.y - h / 2 + zh / 2);
      else if (k.y < ta.scrollTop) ta.scrollTop = k.y - pad.t;
      else if (k.y + zh > ta.scrollTop + h) ta.scrollTop = k.y + zh - h + pad.t;
      if (k.x < ta.scrollLeft + 30) ta.scrollLeft = Math.max(0, k.x - 60);
      else if (k.x > ta.scrollLeft + w - 30) ta.scrollLeft = k.x - w + 60;
      scrollen();
    }

    // ------------------------------------------------------------ Änderungen melden
    var cursorPlan = 0;
    function geaendert() {
      m.starts = null;
      plane();
      if (opt.beiAenderung) opt.beiAenderung(m.name, m.text);
      cursorGemeldet();
    }
    function cursorGemeldet() {
      plane(true);
      clearTimeout(cursorPlan);
      cursorPlan = setTimeout(function () { if (opt.beiCursor && m) { var z = zeileVon(ta.selectionStart); opt.beiCursor(m.name, ta.selectionStart, z + 1, ta.selectionStart - starts()[z] + 1, ta.selectionEnd - ta.selectionStart); } }, 60);
    }

    // ------------------------------------------------------------ Hilfsfunktionen zum Tippen
    function zeilenAnfang(pos) { return m.text.lastIndexOf('\n', pos - 1) + 1; }
    function einrueckung(pos) { var a = zeilenAnfang(pos); return /^[ \t]*/.exec(m.text.slice(a, pos))[0]; }
    function leer(n) { var s = ''; for (var i = 0; i < n; i++) s += ' '; return s; }
    function imHtmlText(pos) {                                     // HTML außerhalb von Tags, <style> und <script>
      if (m.sprache !== 'html') return false;
      var lt = m.text.lastIndexOf('<', pos - 1), gt = m.text.lastIndexOf('>', pos - 1);
      if (lt > gt) return false;
      var x = HS.elementBei(HS.parseHtml(m.text), pos);
      return !(x && (x.name === 'style' || x.name === 'script') && pos >= x.startEnde && pos <= x.innerEnde);
    }
    function imTag(pos) {
      if (m.sprache !== 'html') return false;
      var lt = m.text.lastIndexOf('<', pos - 1), gt = m.text.lastIndexOf('>', pos - 1);
      return lt > gt;
    }
    function spracheBei(pos) {                                     // in HTML-Dateien: CSS in <style>, JS in <script>
      if (m.sprache !== 'html') return m.sprache;
      var x = HS.elementBei(HS.parseHtml(m.text), pos);
      if (x && pos >= x.startEnde && pos <= x.innerEnde) { if (x.name === 'style') return 'css'; if (x.name === 'script') return 'js'; }
      return 'html';
    }

    function tab(rueckwaerts) {
      var a = ta.selectionStart, e = ta.selectionEnd, t = m.text;
      if (a !== e && t.slice(a, e).indexOf('\n') >= 0 || rueckwaerts) {
        var za = zeilenAnfang(a), ze = t.indexOf('\n', e - (e > a && t[e - 1] === '\n' ? 1 : 0)); if (ze < 0) ze = t.length;
        var block = t.slice(za, ze), neu, s = leer(einst.tab);
        if (rueckwaerts) neu = block.split('\n').map(function (z) { return z.replace(new RegExp('^ {1,' + einst.tab + '}|^\\t'), ''); }).join('\n');
        else neu = block.split('\n').map(function (z) { return z.length ? s + z : z; }).join('\n');
        var erste = block.split('\n')[0], ersteNeu = neu.split('\n')[0];
        ersetze(za, ze, neu, a === e ? Math.max(za, a + ersteNeu.length - erste.length) : za, a === e ? null : za + neu.length);
        return;
      }
      // Emmet
      if (a === e && imHtmlText(a)) {
        var r = HS.emmetVor(t, a);
        if (r) {
          var eltern = HS.elementBei(HS.parseHtml(t.slice(0, r.start)), r.start);
          var x = HS.emmet(r.abk, eltern && !eltern.geschlossen ? eltern.name : (eltern ? eltern.name : ''), leer(einst.tab));
          if (x) {
            var ein = einrueckung(r.start);
            var txt = x.text.split('\n').join('\n' + ein);
            var vor = x.text.slice(0, x.cursor).split('\n').length - 1;
            ersetze(r.start, a, txt, r.start + x.cursor + vor * ein.length);
            return;
          }
        }
      }
      var spalte = a - zeilenAnfang(a);
      var n = einst.tab - (spalte % einst.tab);
      ersetze(a, e, leer(n), a + n, null, 'tippen');
    }

    function eingabe() {
      var a = ta.selectionStart, e = ta.selectionEnd, t = m.text;
      var ein = einrueckung(a), vor = t[a - 1], nach = t[a];
      var extra = '';
      var zw = (vor === '{' && nach === '}') || (vor === '(' && nach === ')') || (vor === '[' && nach === ']');
      var tagZw = m.sprache === 'html' && vor === '>' && t.slice(a, a + 2) === '</' && !imTag(a - 1);
      if (zw || tagZw) {
        var innen = ein + leer(einst.tab);
        ersetze(a, e, '\n' + innen + '\n' + ein, a + 1 + innen.length);
        return;
      }
      if (/[{(\[]\s*$/.test(t.slice(zeilenAnfang(a), a))) extra = leer(einst.tab);
      else if (m.sprache === 'html' && vor === '>' && !imTag(a - 1)) {
        // nach einem öffnenden Block-Tag eine Stufe tiefer
        var tm = /<([a-zA-Z][\w-]*)[^<>]*>$/.exec(t.slice(zeilenAnfang(a), a));
        if (tm && !HS.LEER[tm[1].toLowerCase()] && !HS.INLINE[tm[1].toLowerCase()] && !/^\/|\/>$/.test(tm[0])) extra = leer(einst.tab);
      }
      ersetze(a, e, '\n' + ein + extra, a + 1 + ein.length + extra.length);
    }

    function zeilenBereich() {
      var a = ta.selectionStart, e = ta.selectionEnd, t = m.text;
      var za = zeilenAnfang(a), ze = t.indexOf('\n', e > a && t[e - 1] === '\n' ? e - 1 : e); if (ze < 0) ze = t.length;
      return { a: za, e: ze };
    }
    function verschiebe(richtung) {
      var b = zeilenBereich(), t = m.text, a = ta.selectionStart, e = ta.selectionEnd;
      if (richtung < 0) {
        if (b.a === 0) return;
        var oa = zeilenAnfang(b.a - 1), oben = t.slice(oa, b.a - 1), block = t.slice(b.a, b.e);
        var d = -(oben.length + 1);
        ersetze(oa, b.e, block + '\n' + oben, a + d, e + d);
      } else {
        if (b.e >= t.length) return;
        var ue = t.indexOf('\n', b.e + 1); if (ue < 0) ue = t.length;
        var unten = t.slice(b.e + 1, ue), blk = t.slice(b.a, b.e);
        var d2 = unten.length + 1;
        ersetze(b.a, ue, unten + '\n' + blk, a + d2, e + d2);
      }
    }
    function dupliziere() {
      var b = zeilenBereich(), blk = m.text.slice(b.a, b.e), d = blk.length + 1;
      ersetze(b.e, b.e, '\n' + blk, ta.selectionStart + d, ta.selectionEnd + d);
    }
    function kommentar() {
      var a = ta.selectionStart, sp = spracheBei(a);
      var r = HS.kommentiere(m.text, a, ta.selectionEnd, sp);
      ersetze(0, m.text.length, r.text, r.von, r.bis);
    }
    function formatieren() {
      if (nurLesen) return;
      var neu;
      try { neu = HS.formatiere(m.text, m.sprache, leer(einst.tab)); } catch (er) { if (opt.melde) opt.melde('Formatieren hat nicht geklappt – prüfe, ob alle Tags vollständig sind.'); return; }
      if (neu === m.text) { if (opt.melde) opt.melde('Der Code ist schon ordentlich formatiert.'); return; }
      // Cursor ungefähr an der gleichen Stelle lassen (gleiche Zeile)
      var z = zeileVon(ta.selectionStart);
      ersetze(0, m.text.length, neu, 0);
      var p = posVon(z, 0); p += /^\s*/.exec(m.text.slice(p, m.text.indexOf('\n', p) < 0 ? m.text.length : m.text.indexOf('\n', p)))[0].length;
      ta.setSelectionRange(p, p); m.a = m.e = p; zeigeCursor(); cursorGemeldet();
      if (opt.melde) opt.melde('Code formatiert (Umschalt+Alt+F).');
    }

    // ------------------------------------------------------------ Autovervollständigung
    var vorschlag = null, auswahl = 0;
    function schliesseListe() { liste.hidden = true; vorschlag = null; ta.removeAttribute('aria-activedescendant'); }
    function zeigeVorschlaege(erzwungen) {
      if (nurLesen) return;
      var pos = ta.selectionStart;
      if (pos !== ta.selectionEnd) { schliesseListe(); return; }
      var r = HS.vorschlaege(m.text, pos, m.sprache);
      if (!r || (!erzwungen && r.von === r.bis && !/[<.:\s="'\/]/.test(m.text[pos - 1] || ''))) { schliesseListe(); return; }
      vorschlag = r; auswahl = 0;
      liste.innerHTML = r.liste.map(function (x, i) {
        return '<div class="ed-v" role="option" id="ed-v-' + i + '" data-i="' + i + '"><span class="ed-v-icon ed-v-' + (x.art || 'kw') + '">' + (ART_ICON[x.art] || '•') + '</span><span class="ed-v-text">' + esc(x.text) + '</span>' + (x.info ? '<span class="ed-v-info">' + esc(x.info) + '</span>' : '') + '</div>';
      }).join('');
      liste.hidden = false;
      markiereAuswahl();
      positioniereListe();
    }
    function markiereAuswahl() {
      var k = liste.children;
      for (var i = 0; i < k.length; i++) k[i].classList.toggle('ed-v-akt', i === auswahl);
      if (k[auswahl]) { k[auswahl].scrollIntoView({ block: 'nearest' }); ta.setAttribute('aria-activedescendant', 'ed-v-' + auswahl); }
    }
    function positioniereListe() {
      if (!vorschlag) return;
      var k = koordinaten(vorschlag.von);
      var x = k.x - ta.scrollLeft, y = k.y + zh - ta.scrollTop + 2;
      var bw = flaeche.clientWidth, bh = flaeche.clientHeight, lh = liste.offsetHeight || 200;
      if (y + lh > bh && k.y - ta.scrollTop - lh - 2 > 0) y = k.y - ta.scrollTop - lh - 2;
      liste.style.left = Math.max(0, Math.min(bw - liste.offsetWidth - 4, x)) + 'px';
      liste.style.top = Math.max(0, y) + 'px';
    }
    function uebernehme(i) {
      if (!vorschlag) return;
      var x = vorschlag.liste[i == null ? auswahl : i]; if (!x) return;
      var von = vorschlag.von, bis = ta.selectionStart;
      var neu = x.einfuegen;
      // „class“ vorhanden und schon „=“ dahinter: nur den Namen einsetzen
      if (x.art === 'attr' && m.text[bis] === '=') neu = x.text;
      schliesseListe();
      ersetze(von, bis, neu, von + (x.cursor != null && neu === x.einfuegen ? x.cursor : neu.length));
      if (x.erneut) setTimeout(function () { zeigeVorschlaege(true); }, 0);
    }
    liste.addEventListener('mousedown', function (e) { e.preventDefault(); });
    liste.addEventListener('click', function (e) { var v = e.target.closest('.ed-v'); if (v) uebernehme(+v.dataset.i); });

    // ------------------------------------------------------------ Suchen und Ersetzen
    var sText = suche.querySelector('.ed-s-text'), sNeu = suche.querySelector('.ed-s-neu'), sZahl = suche.querySelector('.ed-s-zahl');
    var sOpt = { gross: false, regex: false };
    function suchMuster() {
      var q = sText.value;
      if (!q) return null;
      try { return new RegExp(sOpt.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), sOpt.gross ? 'g' : 'gi'); } catch (e) { return false; }
    }
    function sucheAktualisieren(springen) {
      treffer = []; aktTreffer = -1;
      var re = suchMuster();
      if (re) { var r; while ((r = re.exec(m.text)) && treffer.length < 5000) { if (!r[0].length) { re.lastIndex++; continue; } treffer.push([r.index, r.index + r[0].length]); } }
      if (treffer.length) {
        var p = ta.selectionStart;
        aktTreffer = 0;
        for (var i = 0; i < treffer.length; i++) if (treffer[i][0] >= p - (springen ? 0 : (ta.selectionEnd - ta.selectionStart))) { aktTreffer = i; break; }
      }
      sZahl.textContent = re === false ? 'Ungültiger Ausdruck' : treffer.length ? (aktTreffer + 1) + ' von ' + treffer.length : 'Keine Ergebnisse';
      sZahl.classList.toggle('ed-s-leer', !!sText.value && !treffer.length);
      if (springen && aktTreffer >= 0) waehleTreffer();
      plane(true);
    }
    function waehleTreffer() {
      var t = treffer[aktTreffer]; if (!t) return;
      ta.setSelectionRange(t[0], t[1]); m.a = t[0]; m.e = t[1];
      zeigeCursor(true);
      sZahl.textContent = (aktTreffer + 1) + ' von ' + treffer.length;
      plane(true);
    }
    function naechster(richtung) {
      if (!treffer.length) return;
      aktTreffer = (aktTreffer + richtung + treffer.length) % treffer.length;
      waehleTreffer();
    }
    function oeffneSuche(ersetzen) {
      suche.hidden = false;
      var sel = m.text.slice(ta.selectionStart, ta.selectionEnd);
      if (sel && sel.indexOf('\n') < 0) sText.value = sel;
      suche.querySelector('.ed-s-ersetzen').hidden = !ersetzen;
      suche.querySelector('.ed-s-erw').setAttribute('aria-expanded', String(!!ersetzen));
      sText.focus(); sText.select();
      sucheAktualisieren(false);
    }
    function schliesseSuche() { suche.hidden = true; treffer = []; aktTreffer = -1; plane(true); ta.focus(); }
    function ersetzeEins() {
      if (nurLesen) return;
      var t = treffer[aktTreffer]; if (!t) return;
      var neu = sNeu.value;
      if (sOpt.regex) { var re = suchMuster(); if (re) neu = m.text.slice(t[0], t[1]).replace(new RegExp(re.source, re.flags.replace('g', '')), neu); }
      ersetze(t[0], t[1], neu, t[0] + neu.length);
      sucheAktualisieren(true);
    }
    function ersetzeAlle() {
      if (nurLesen) return;
      var re = suchMuster(); if (!re || !treffer.length) return;
      var anzahl = treffer.length;
      var neu = sOpt.regex ? m.text.replace(re, sNeu.value) : m.text.replace(re, function () { return sNeu.value; });
      ersetze(0, m.text.length, neu, 0);
      sucheAktualisieren(false);
      if (opt.melde) opt.melde(anzahl + (anzahl === 1 ? ' Stelle' : ' Stellen') + ' ersetzt.');
    }
    sText.addEventListener('input', function () { sucheAktualisieren(true); });
    sText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); naechster(e.shiftKey ? -1 : 1); }
    });
    sNeu.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (e.ctrlKey || e.metaKey) ersetzeAlle(); else ersetzeEins(); }
    });
    suche.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); schliesseSuche(); } });
    suche.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('ed-s-opt')) { sOpt[b.dataset.opt] = !sOpt[b.dataset.opt]; b.setAttribute('aria-pressed', String(sOpt[b.dataset.opt])); sucheAktualisieren(true); }
      else if (b.classList.contains('ed-s-vor')) naechster(1);
      else if (b.classList.contains('ed-s-zurueck')) naechster(-1);
      else if (b.classList.contains('ed-s-zu')) schliesseSuche();
      else if (b.classList.contains('ed-s-eins')) ersetzeEins();
      else if (b.classList.contains('ed-s-alle')) ersetzeAlle();
      else if (b.classList.contains('ed-s-erw')) { var r = suche.querySelector('.ed-s-ersetzen'); r.hidden = !r.hidden; b.setAttribute('aria-expanded', String(!r.hidden)); if (!r.hidden) sNeu.focus(); }
    });

    // ------------------------------------------------------------ Tastatur
    var tabFrei = false;                                            // nach Esc verlässt Tab den Editor (Barrierefreiheit)
    ta.addEventListener('keydown', function (e) {
      if (!m) return;
      var strg = e.ctrlKey || e.metaKey, k = e.key, kl = (k || '').toLowerCase();
      m.a = ta.selectionStart; m.e = ta.selectionEnd;
      // Vorschlagsliste
      if (!liste.hidden && vorschlag) {
        if (k === 'ArrowDown') { e.preventDefault(); auswahl = (auswahl + 1) % vorschlag.liste.length; markiereAuswahl(); return; }
        if (k === 'ArrowUp') { e.preventDefault(); auswahl = (auswahl - 1 + vorschlag.liste.length) % vorschlag.liste.length; markiereAuswahl(); return; }
        if (k === 'Enter' || k === 'Tab') { e.preventDefault(); uebernehme(); return; }
        if (k === 'Escape') { e.preventDefault(); schliesseListe(); return; }
        if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); auswahl = Math.max(0, Math.min(vorschlag.liste.length - 1, auswahl + (k === 'PageDown' ? 8 : -8))); markiereAuswahl(); return; }
      }
      if (k === 'Escape') { if (!suche.hidden) schliesseSuche(); else tabFrei = true; return; }
      if (k === 'Tab' && !strg && !e.altKey) { if (tabFrei) { tabFrei = false; return; } e.preventDefault(); if (!nurLesen) tab(e.shiftKey); return; }
      tabFrei = false;
      if (strg && !e.shiftKey && kl === 'z') { e.preventDefault(); rueckgaengig(); return; }
      if (strg && (kl === 'y' || (e.shiftKey && kl === 'z'))) { e.preventDefault(); wiederholen(); return; }
      if (strg && kl === 'f') { e.preventDefault(); oeffneSuche(false); return; }
      if (strg && kl === 'h') { e.preventDefault(); oeffneSuche(true); return; }
      if (k === 'F3') { e.preventDefault(); if (suche.hidden) oeffneSuche(false); else naechster(e.shiftKey ? -1 : 1); return; }
      if (strg && k === ' ') { e.preventDefault(); zeigeVorschlaege(true); return; }
      if (e.shiftKey && e.altKey && (kl === 'f' || e.code === 'KeyF')) { e.preventDefault(); formatieren(); return; }
      if (strg && (k === '/' || k === '#' || e.code === 'Slash')) { e.preventDefault(); if (!nurLesen) kommentar(); return; }
      if (e.altKey && !strg && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); if (nurLesen) return; if (e.shiftKey) dupliziere(); else verschiebe(k === 'ArrowUp' ? -1 : 1); return; }
      if (strg && !e.shiftKey && kl === 's') { e.preventDefault(); if (opt.beiTaste) opt.beiTaste('speichern'); return; }
      if (strg && kl === 'enter') { e.preventDefault(); if (opt.beiTaste) opt.beiTaste('ausfuehren'); return; }
      if (strg && e.shiftKey && kl === 'c') { e.preventDefault(); if (opt.beiTaste) opt.beiTaste('inspektor'); return; }
      if (nurLesen || strg || e.altKey) return;
      if (k === 'Enter') { e.preventDefault(); eingabe(); return; }
      var a = ta.selectionStart, en = ta.selectionEnd;
      if (k === 'Backspace' && a === en && a > 0) {
        var v = m.text[a - 1], n = m.text[a];
        if (einst.autoSchliessen && PAARE[v] && PAARE[v] === n) { e.preventDefault(); ersetze(a - 1, a + 1, '', a - 1, null, 'tippen'); return; }
        var vorne = m.text.slice(zeilenAnfang(a), a);
        if (vorne.length && /^ +$/.test(vorne) && vorne.length % einst.tab === 0) { e.preventDefault(); ersetze(a - einst.tab, a, '', a - einst.tab, null, 'tippen'); return; }
        return;
      }
      if (!einst.autoSchliessen || k.length !== 1) return;
      // über eine schon vorhandene schließende Klammer hinwegtippen
      if (ZU[k] && a === en && m.text[a] === k) {
        if (!(k === '"' || k === "'" || k === '`') || m.text[a - 1] !== '\\') { e.preventDefault(); ta.setSelectionRange(a + 1, a + 1); m.a = m.e = a + 1; cursorGemeldet(); return; }
      }
      if (PAARE[k]) {
        var istAnf = k === '"' || k === "'" || k === '`';
        var s = spracheBei(a);
        if (istAnf) {
          if (s === 'html' && !imTag(a)) return;                    // Apostroph im Fließtext („geht's“)
          if (/[\w\\]/.test(m.text[a - 1] || '')) return;
          if (k === '`' && s !== 'js') return;
        }
        if (a !== en) { e.preventDefault(); var sel = m.text.slice(a, en); ersetze(a, en, k + sel + PAARE[k], a + 1, en + 1); return; }
        if (/[\w$]/.test(m.text[a] || '')) return;
        e.preventDefault();
        ersetze(a, en, k + PAARE[k], a + 1, null, 'tippen');
      }
    });

    // Nach der Eingabe: Tags automatisch schließen, Vorschläge zeigen (funktioniert auch mit Handy-Tastaturen)
    ta.addEventListener('beforeinput', function (e) {
      if (nurLesen) { e.preventDefault(); return; }
      if (e.inputType === 'historyUndo') { e.preventDefault(); rueckgaengig(); return; }
      if (e.inputType === 'historyRedo') { e.preventDefault(); wiederholen(); return; }
      m.a = ta.selectionStart; m.e = ta.selectionEnd;
    });
    ta.addEventListener('input', function (e) {
      if (!m) return;
      if (ta.value === m.text) return;
      var art = e.inputType === 'insertText' && e.data && e.data.indexOf('\n') < 0 ? 'tippen' : 'befehl';
      if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') art = 'tippen';
      merke(art);
      m.text = ta.value; m.starts = null; m.a = ta.selectionStart; m.e = ta.selectionEnd;
      var pos = ta.selectionStart, t = m.text;
      if (einst.autoSchliessen && m.sprache === 'html' && e.inputType === 'insertText' && pos === ta.selectionEnd) {
        if (e.data === '>' && spracheBei(pos) === 'html') {
          var vorne = t.slice(Math.max(0, pos - 400), pos);
          var tm = /<([a-zA-Z][\w:-]*)(?:\s[^<>]*)?>$/.exec(vorne);
          if (tm && !/\/>$/.test(tm[0]) && !HS.LEER[tm[1].toLowerCase()]) {
            var zu = '</' + tm[1] + '>';
            ersetze(pos, pos, zu, pos, null, 'tippen'); schliesseListe(); return;
          }
        }
        if (e.data === '/' && t[pos - 2] === '<' && spracheBei(pos) === 'html') {
          var x = HS.elementBei(HS.parseHtml(t.slice(0, pos - 2)), pos - 2);
          while (x && (x.leer || x.geschlossen)) x = x.eltern;
          if (x) {
            var zuTag = '</' + x.name + '>';
            // End-Tag steht schon direkt dahinter: das getippte „</“ wieder entfernen und darüber springen
            if (t.slice(pos, pos + zuTag.length).toLowerCase() === zuTag) ersetze(pos - 2, pos, '', pos - 2 + zuTag.length, null, 'tippen');
            else ersetze(pos, pos, x.name + '>', pos + x.name.length + 1, null, 'tippen');
            schliesseListe(); return;
          }
        }
      }
      geaendert();
      if (e.inputType === 'insertText' && e.data && /^[\w<.:\-#\s"'=/]$/.test(e.data)) zeigeVorschlaege(false);
      else if (!liste.hidden) zeigeVorschlaege(false);
    });
    ta.addEventListener('scroll', scrollen);
    ['keyup', 'click', 'select'].forEach(function (t) { ta.addEventListener(t, function (e) { if (t === 'click' && !liste.hidden) schliesseListe(); if (m) { m.a = ta.selectionStart; m.e = ta.selectionEnd; } cursorGemeldet(); }); });
    document.addEventListener('selectionchange', function () { if (document.activeElement === ta && m) cursorGemeldet(); });
    ta.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== ta) schliesseListe(); }, 120); });
    ta.addEventListener('focus', function () { if (opt.beiFokus) opt.beiFokus(); });

    if (window.ResizeObserver) new ResizeObserver(function () { messen(); plane(); }).observe(flaeche);

    // ------------------------------------------------------------ öffentliche Schnittstelle
    E.element = ed;
    /** Datei öffnen (oder zu ihr wechseln). Beim ersten Öffnen wird der Text übernommen. */
    E.oeffne = function (name, text, sprache) {
      if (m) { m.a = ta.selectionStart; m.e = ta.selectionEnd; m.sx = ta.scrollLeft; m.sy = ta.scrollTop; }
      if (!modelle[name]) modelle[name] = neuesModell(name, text, sprache);
      m = modelle[name];
      if (text != null && text !== m.text) { m.text = text; m.starts = null; }
      m.sprache = sprache || m.sprache;
      schliesseListe();
      ta.value = m.text;
      ta.setSelectionRange(Math.min(m.a, m.text.length), Math.min(m.e, m.text.length));
      ta.scrollTop = m.sy; ta.scrollLeft = m.sx;
      ta.setAttribute('aria-label', (opt.label || 'Code-Editor') + ': ' + name);
      messen();
      if (!suche.hidden) sucheAktualisieren(false);
      plane();
      cursorGemeldet();
    };
    E.name = function () { return m ? m.name : null; };
    E.text = function (name) { var x = name ? modelle[name] : m; return x ? x.text : null; };
    /** Text von außen ändern (z. B. Zurücksetzen) – mit Rückgängig. */
    E.setzeText = function (name, text) {
      var x = modelle[name]; if (!x) return;
      if (x === m) { ersetze(0, m.text.length, text, 0); return; }
      x.verlauf.push({ text: x.text, a: x.a, e: x.e }); x.text = text; x.starts = null; x.a = x.e = 0;
    };
    E.vergiss = function (name) { delete modelle[name]; if (m && m.name === name) m = null; };
    E.umbenennen = function (alt, neu, sprache) { if (!modelle[alt]) return; modelle[neu] = modelle[alt]; delete modelle[alt]; modelle[neu].name = neu; modelle[neu].sprache = sprache; modelle[neu].farbText = null; if (m === modelle[neu]) plane(); };
    /** Bereich zeigen: Cursor an „von“, Bereich kurz farbig hervorheben (kopf = Ende des Start-Tags). */
    E.springeZu = function (von, bis, kopf) {
      if (!m) return;
      von = Math.max(0, Math.min(m.text.length, von)); bis = Math.max(von, Math.min(m.text.length, bis == null ? von : bis));
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(von, von); m.a = m.e = von;
      zeigeCursor(true);
      if (bis > von) {
        var b = blitz = { von: von, bis: bis, kopf: kopf, aus: false };
        plane(true);
        setTimeout(function () { if (blitz === b) { b.aus = true; plane(true); } }, 1500);
        setTimeout(function () { if (blitz === b) { blitz = null; plane(true); } }, 2100);
      }
      cursorGemeldet();
    };
    E.springeZuZeile = function (zeile, spalte) { if (!m) return; var p = posVon(zeile - 1, (spalte || 1) - 1); var ze = m.text.indexOf('\n', p); E.springeZu(p, ze < 0 ? m.text.length : ze); };
    E.cursor = function () { return ta.selectionStart; };
    E.setzeMarken = function (name, marken) { var x = modelle[name]; if (!x) return; x.marken = marken || []; if (x === m) plane(); };
    E.fokus = function () { ta.focus({ preventScroll: true }); };
    E.formatieren = function () { if (m) formatieren(); };
    E.suchen = function (ersetzen) { if (m) oeffneSuche(ersetzen); };
    E.rueckgaengig = function () { if (m) rueckgaengig(); };
    E.wiederholen = function () { if (m) wiederholen(); };
    E.nurLesen = function (an) { nurLesen = !!an; ta.readOnly = nurLesen; };
    E.einstellungen = function (x) {
      for (var k in x) if (Object.prototype.hasOwnProperty.call(einst, k)) einst[k] = x[k];
      ed.style.setProperty('--ed-schrift', einst.schrift + 'px');
      ed.style.setProperty('--ed-zeile', Math.round(einst.schrift * 1.45) + 'px');
      ed.style.setProperty('--ed-tab', einst.tab);
      karte.hidden = !einst.minimap;
      messen(); plane();
    };
    E.neuZeichnen = function () { messen(); if (m) { m.farbText = null; plane(); } };
    E.einstellungen({});
    return E;
  };
})(typeof window !== 'undefined' ? window : this);
