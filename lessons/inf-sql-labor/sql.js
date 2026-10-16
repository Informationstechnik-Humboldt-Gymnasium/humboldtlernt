// SQL-Labor: kleine SQL-Engine ohne DOM (läuft im Browser und in Node-Tests).
//
// Unterstützt (Groß-/Kleinschreibung der Schlüsselwörter egal):
//   SELECT [DISTINCT] * | ausdruck [AS name], …  FROM tabelle [alias] {, tabelle [alias] | [INNER] JOIN tabelle [alias] ON bedingung}
//          [WHERE …] [GROUP BY …] [HAVING …] [ORDER BY ausdruck|name|nummer [ASC|DESC], …] [LIMIT n]
//   INSERT INTO tabelle [(spalten)] VALUES (…), (…)
//   UPDATE tabelle SET spalte = ausdruck, … [WHERE …]
//   DELETE FROM tabelle [WHERE …]
// Ausdrücke: Zahlen, 'Text' (auch "Text"), NULL, Spalten (spalte oder tabelle.spalte), + - * / %,
//   = <> != < <= > >=, LIKE (% und _, ohne Unterschied von Groß-/Kleinschreibung), BETWEEN … AND …,
//   IN (…), IS [NOT] NULL, AND, OR, NOT, Klammern,
//   COUNT(*), COUNT([DISTINCT] x), SUM, AVG, MIN, MAX, UPPER, LOWER, LENGTH.
// Vergleiche mit = unterscheiden Groß- und Kleinschreibung (wie in SQLite).
// Primärschlüssel (erste Spalte, pk) und Fremdschlüssel (fk) werden beim Ändern geprüft.
(function (root) {
  'use strict';

  var MAX_KOMBINATIONEN = 200000;   // Schutz vor riesigen Kreuzprodukten
  var SCHLUESSELWOERTER = ['SELECT', 'DISTINCT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT',
    'AS', 'AND', 'OR', 'NOT', 'LIKE', 'BETWEEN', 'IN', 'IS', 'NULL', 'JOIN', 'INNER', 'ON', 'INSERT', 'INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE', 'LEFT', 'RIGHT', 'OUTER', 'CROSS', 'UNION', 'CREATE', 'DROP', 'ALTER', 'TABLE'];
  var AGGREGATE = { COUNT: 1, SUM: 1, AVG: 1, MIN: 1, MAX: 1 };
  var FUNKTIONEN = { UPPER: 1, LOWER: 1, LENGTH: 1 };

  function SqlFehler(text, pos) { this.text = text; this.pos = pos; }

  // Tippfehler-Hilfe: ähnlichstes Wort (höchstens 2 Buchstaben anders)
  function abstand(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function vorschlag(wort, kandidaten) {
    var best = null, bd = 3;
    kandidaten.forEach(function (k) { var x = abstand(String(wort).toLowerCase(), k.toLowerCase()); if (x < bd) { bd = x; best = k; } });
    return best ? ' Meinst du „' + best + '“?' : '';
  }

  // ------------------------------------------------------------------ Zerlegen in Wörter (Tokens)
  function zerlege(q) {
    var t = [], i = 0, n = q.length;
    while (i < n) {
      var c = q[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && q[i + 1] === '-') { while (i < n && q[i] !== '\n') i++; continue; }
      var start = i;
      if (c === "'" || c === '"') {
        var s = ''; i++;
        while (true) {
          if (i >= n) throw new SqlFehler('Ein Text in Anführungszeichen ist nicht geschlossen. Es fehlt ein ' + c + '.', start);
          if (q[i] === c) { if (q[i + 1] === c) { s += c; i += 2; continue; } i++; break; }
          s += q[i++];
        }
        t.push({ typ: 'text', wert: s, pos: start, ende: i });
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(q[i + 1] || ''))) {
        while (i < n && /[0-9]/.test(q[i])) i++;
        if (q[i] === '.' && /[0-9]/.test(q[i + 1] || '')) { i++; while (i < n && /[0-9]/.test(q[i])) i++; }
        t.push({ typ: 'zahl', wert: Number(q.slice(start, i)), real: q.slice(start, i).indexOf('.') >= 0, pos: start, ende: i });
        continue;
      }
      if (/[A-Za-z_ÄÖÜäöüß]/.test(c)) {
        while (i < n && /[A-Za-z0-9_ÄÖÜäöüß]/.test(q[i])) i++;
        var w = q.slice(start, i), gross = w.toUpperCase();
        if (SCHLUESSELWOERTER.indexOf(gross) >= 0) t.push({ typ: 'kw', wert: gross, pos: start, ende: i });
        else t.push({ typ: 'name', wert: w, pos: start, ende: i });
        continue;
      }
      var zwei = q.slice(i, i + 2);
      if (zwei === '<=' || zwei === '>=' || zwei === '<>' || zwei === '!=') { t.push({ typ: 'op', wert: zwei === '!=' ? '<>' : zwei, pos: i, ende: i + 2 }); i += 2; continue; }
      if ('=<>+-*/%(),.;'.indexOf(c) >= 0) { t.push({ typ: 'op', wert: c, pos: i, ende: i + 1 }); i++; continue; }
      throw new SqlFehler('Das Zeichen „' + c + '“ kenne ich in SQL nicht.', i);
    }
    t.push({ typ: 'ende', wert: '', pos: n, ende: n });
    return t;
  }

  // ------------------------------------------------------------------ Parser
  function Parser(q) { this.q = q; this.t = zerlege(q); this.i = 0; }
  Parser.prototype.akt = function () { return this.t[this.i]; };
  Parser.prototype.ist = function (typ, wert) { var a = this.t[this.i]; return a.typ === typ && (wert === undefined || a.wert === wert); };
  Parser.prototype.kw = function (w) { return this.ist('kw', w); };
  Parser.prototype.op = function (w) { return this.ist('op', w); };
  Parser.prototype.weiter = function () { return this.t[this.i++]; };
  Parser.prototype.erwarte = function (typ, wert, text) {
    if (!this.ist(typ, wert)) {
      var a = this.akt();
      throw new SqlFehler((text || ('Hier erwarte ich „' + wert + '“')) + (a.typ === 'ende' ? ', aber die Anfrage ist zu Ende.' : ', gefunden habe ich „' + this.q.slice(a.pos, a.ende) + '“.'), a.pos);
    }
    return this.weiter();
  };
  // Ein Name an der Stelle eines Kurznamens, der fast wie ein Schlüsselwort aussieht (WHER, FORM …), ist meist ein Tippfehler.
  Parser.prototype.kurzname = function () {
    var a = this.weiter(), gross = a.wert.toUpperCase();
    var kw = ['FROM', 'WHERE', 'ORDER', 'GROUP', 'JOIN', 'HAVING', 'LIMIT', 'SELECT'].filter(function (k) { return gross.length > 2 && abstand(gross, k) <= 1 || (gross === 'FORM' && k === 'FROM'); });
    if (kw.length) throw new SqlFehler('„' + a.wert + '“ verstehe ich nicht. Meinst du ' + kw[0] + '?', a.pos);
    return a.wert;
  };
  Parser.prototype.name = function (wofuer) {
    var a = this.akt();
    if (a.typ === 'name') { this.i++; return a.wert; }
    if (a.typ === 'kw') throw new SqlFehler('„' + a.wert + '“ ist ein SQL-Schlüsselwort. Hier erwarte ich ' + wofuer + '.', a.pos);
    throw new SqlFehler('Hier erwarte ich ' + wofuer + (a.typ === 'ende' ? ', aber die Anfrage ist zu Ende.' : '.'), a.pos);
  };

  Parser.prototype.anweisung = function () {
    var a = this.akt(), erg;
    if (this.kw('SELECT')) erg = this.select();
    else if (this.kw('INSERT')) erg = this.insert();
    else if (this.kw('UPDATE')) erg = this.update();
    else if (this.kw('DELETE')) erg = this.loesche();
    else if (a.typ === 'ende') throw new SqlFehler('Die Anfrage ist leer. Beginne z. B. mit SELECT.', 0);
    else if (a.typ === 'kw' && ['CREATE', 'DROP', 'ALTER'].indexOf(a.wert) >= 0) throw new SqlFehler(a.wert + ' ist in diesem Labor nicht freigeschaltet. Du kannst Daten abfragen (SELECT), einfügen (INSERT), ändern (UPDATE) und löschen (DELETE).', a.pos);
    else throw new SqlFehler('Eine Anfrage beginnt mit SELECT, INSERT, UPDATE oder DELETE.' + (a.typ === 'name' ? vorschlag(a.wert, ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) : ''), a.pos);
    if (this.op(';')) this.weiter();
    if (!this.ist('ende')) {
      var r = this.akt();
      var vor = this.t[this.i - 1];
      if (r.typ === 'name' && vor && vor.typ === 'name') throw new SqlFehler('Nach „' + vor.wert + '“ steht noch „' + r.wert + '“. Ist das ein Text ohne Anführungszeichen? Texte schreibt man in SQL so: \'' + vor.wert + ' ' + r.wert + '\'.', vor.pos);
      throw new SqlFehler('Nach dem Ende der Anfrage steht noch „' + this.q.slice(r.pos, r.ende) + '“. Fehlt ein Komma, ein Schlüsselwort oder steht etwas zu viel da?', r.pos);
    }
    return erg;
  };

  Parser.prototype.select = function () {
    this.erwarte('kw', 'SELECT');
    var s = { art: 'select', distinct: false, spalten: [], von: [], wo: null, gruppe: [], having: null, ordnung: [], limit: null };
    if (this.kw('DISTINCT')) { this.weiter(); s.distinct = true; }
    do {
      if (this.op('*')) { this.weiter(); s.spalten.push({ stern: true }); continue; }
      if (this.ist('name') && this.t[this.i + 1].wert === '.' && this.t[this.i + 2].wert === '*' && this.t[this.i + 2].typ === 'op') {
        var tab = this.weiter().wert; this.weiter(); this.weiter(); s.spalten.push({ stern: true, tabelle: tab }); continue;
      }
      var start = this.akt().pos, e = this.ausdruck(), ende = this.t[this.i - 1].ende, alias = null;
      if (this.kw('AS')) { this.weiter(); alias = this.ist('text') ? this.weiter().wert : this.name('einen Namen für die Spalte'); }
      else if (this.ist('name')) alias = this.kurzname();
      s.spalten.push({ ausdruck: e, name: alias || this.q.slice(start, ende) });
    } while (this.op(',') && this.weiter());
    if (!this.kw('FROM')) {
      var a = this.akt();
      throw new SqlFehler(a.typ === 'ende' ? 'Es fehlt FROM mit dem Namen der Tabelle.' : 'Hier erwarte ich FROM oder ein Komma zwischen den Spalten, gefunden habe ich „' + this.q.slice(a.pos, a.ende) + '“.', a.pos);
    }
    this.weiter();
    s.von.push(this.tabellenangabe());
    while (true) {
      if (this.op(',')) { this.weiter(); s.von.push(this.tabellenangabe()); continue; }
      if (this.kw('INNER') || this.kw('JOIN')) {
        if (this.kw('INNER')) this.weiter();
        this.erwarte('kw', 'JOIN');
        var tj = this.tabellenangabe();
        this.erwarte('kw', 'ON', 'Nach JOIN tabelle braucht es ON mit der Verknüpfungsbedingung');
        tj.on = this.ausdruck();
        s.von.push(tj);
        continue;
      }
      if (this.kw('LEFT') || this.kw('RIGHT') || this.kw('CROSS') || this.kw('OUTER')) throw new SqlFehler(this.akt().wert + ' JOIN gibt es in diesem Labor nicht. Nutze JOIN … ON … oder mehrere Tabellen mit WHERE.', this.akt().pos);
      break;
    }
    if (this.kw('WHERE')) { this.weiter(); s.wo = this.ausdruck(); }
    if (this.kw('GROUP')) {
      this.weiter(); this.erwarte('kw', 'BY', 'Nach GROUP folgt BY');
      do { s.gruppe.push(this.ausdruck()); } while (this.op(',') && this.weiter());
    }
    if (this.kw('HAVING')) { this.weiter(); s.having = this.ausdruck(); }
    if (this.kw('ORDER')) {
      this.weiter(); this.erwarte('kw', 'BY', 'Nach ORDER folgt BY');
      do {
        var o = { ausdruck: this.ausdruck(), ab: false };
        if (this.kw('ASC')) this.weiter(); else if (this.kw('DESC')) { this.weiter(); o.ab = true; }
        s.ordnung.push(o);
      } while (this.op(',') && this.weiter());
    }
    if (this.kw('LIMIT')) {
      this.weiter();
      var l = this.erwarte('zahl', undefined, 'Nach LIMIT steht eine Zahl');
      s.limit = l.wert;
    }
    if (this.kw('WHERE') || this.kw('GROUP') || this.kw('ORDER') || this.kw('HAVING')) throw new SqlFehler('Die Reihenfolge stimmt nicht: Es gilt SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT …', this.akt().pos);
    return s;
  };
  Parser.prototype.tabellenangabe = function () {
    var pos = this.akt().pos, name = this.name('den Namen einer Tabelle'), alias = null;
    if (this.kw('AS')) { this.weiter(); alias = this.name('einen Kurznamen für die Tabelle'); }
    else if (this.ist('name')) alias = this.kurzname();
    return { name: name, alias: alias || name, pos: pos };
  };
  Parser.prototype.insert = function () {
    this.erwarte('kw', 'INSERT'); this.erwarte('kw', 'INTO', 'Nach INSERT folgt INTO');
    var pos = this.akt().pos, s = { art: 'insert', tabelle: this.name('den Namen einer Tabelle'), pos: pos, spalten: null, zeilen: [] };
    if (this.op('(')) {
      this.weiter(); s.spalten = [];
      do { s.spalten.push(this.name('den Namen einer Spalte')); } while (this.op(',') && this.weiter());
      this.erwarte('op', ')');
    }
    this.erwarte('kw', 'VALUES', 'Hier erwarte ich VALUES');
    do {
      this.erwarte('op', '(');
      var z = [];
      do { z.push(this.ausdruck()); } while (this.op(',') && this.weiter());
      this.erwarte('op', ')');
      s.zeilen.push(z);
    } while (this.op(',') && this.weiter());
    return s;
  };
  Parser.prototype.update = function () {
    this.erwarte('kw', 'UPDATE');
    var pos = this.akt().pos, s = { art: 'update', tabelle: this.name('den Namen einer Tabelle'), pos: pos, setze: [], wo: null };
    this.erwarte('kw', 'SET', 'Nach UPDATE tabelle folgt SET');
    do {
      var sp = this.akt().pos, n = this.name('den Namen einer Spalte');
      this.erwarte('op', '=');
      s.setze.push({ spalte: n, ausdruck: this.ausdruck(), pos: sp });
    } while (this.op(',') && this.weiter());
    if (this.kw('WHERE')) { this.weiter(); s.wo = this.ausdruck(); }
    return s;
  };
  Parser.prototype.loesche = function () {
    this.erwarte('kw', 'DELETE'); this.erwarte('kw', 'FROM', 'Nach DELETE folgt FROM');
    var pos = this.akt().pos, s = { art: 'delete', tabelle: this.name('den Namen einer Tabelle'), pos: pos, wo: null };
    if (this.kw('WHERE')) { this.weiter(); s.wo = this.ausdruck(); }
    return s;
  };

  // Ausdrücke (Vorrang: OR < AND < NOT < Vergleich < + - < * / % < Vorzeichen)
  Parser.prototype.ausdruck = function () {
    var l = this.und();
    while (this.kw('OR')) { this.weiter(); l = { k: 'oder', a: l, b: this.und() }; }
    return l;
  };
  Parser.prototype.und = function () {
    var l = this.nicht();
    while (this.kw('AND')) { this.weiter(); l = { k: 'und', a: l, b: this.nicht() }; }
    return l;
  };
  Parser.prototype.nicht = function () {
    if (this.kw('NOT')) { this.weiter(); return { k: 'nicht', a: this.nicht() }; }
    return this.vergleich();
  };
  Parser.prototype.vergleich = function () {
    var l = this.summe(), a = this.akt();
    if (a.typ === 'op' && ['=', '<>', '<', '<=', '>', '>='].indexOf(a.wert) >= 0) {
      this.weiter();
      if (this.op('=')) throw new SqlFehler('In SQL vergleicht man mit einem einzelnen =, nicht mit ==.', this.akt().pos);
      return { k: 'vgl', op: a.wert, a: l, b: this.summe() };
    }
    var neg = false;
    if (this.kw('NOT') && (this.t[this.i + 1].wert === 'LIKE' || this.t[this.i + 1].wert === 'IN' || this.t[this.i + 1].wert === 'BETWEEN')) { this.weiter(); neg = true; }
    if (this.kw('LIKE')) { this.weiter(); return { k: 'like', a: l, b: this.summe(), neg: neg }; }
    if (this.kw('BETWEEN')) {
      this.weiter(); var von = this.summe();
      this.erwarte('kw', 'AND', 'Bei BETWEEN steht zwischen den Grenzen AND');
      return { k: 'between', a: l, von: von, bis: this.summe(), neg: neg };
    }
    if (this.kw('IN')) {
      this.weiter(); this.erwarte('op', '(', 'Nach IN folgt eine Liste in Klammern');
      if (this.kw('SELECT')) throw new SqlFehler('Unterabfragen (SELECT in Klammern) gibt es in diesem Labor nicht.', this.akt().pos);
      var liste = [];
      do { liste.push(this.summe()); } while (this.op(',') && this.weiter());
      this.erwarte('op', ')');
      return { k: 'in', a: l, liste: liste, neg: neg };
    }
    if (this.kw('IS')) {
      this.weiter(); var n2 = false;
      if (this.kw('NOT')) { this.weiter(); n2 = true; }
      this.erwarte('kw', 'NULL', 'Nach IS folgt NULL oder NOT NULL');
      return { k: 'istnull', a: l, neg: n2 };
    }
    return l;
  };
  Parser.prototype.summe = function () {
    var l = this.produkt();
    while (this.op('+') || this.op('-')) { var o = this.weiter().wert; l = { k: 'rechne', op: o, a: l, b: this.produkt() }; }
    return l;
  };
  Parser.prototype.produkt = function () {
    var l = this.vorzeichen();
    while (this.op('*') || this.op('/') || this.op('%')) { var o = this.weiter().wert; l = { k: 'rechne', op: o, a: l, b: this.vorzeichen() }; }
    return l;
  };
  Parser.prototype.vorzeichen = function () {
    if (this.op('-')) { this.weiter(); return { k: 'rechne', op: '-', a: { k: 'wert', w: 0 }, b: this.vorzeichen() }; }
    if (this.op('+')) { this.weiter(); return this.vorzeichen(); }
    return this.einfach();
  };
  Parser.prototype.einfach = function () {
    var a = this.akt();
    if (a.typ === 'zahl' || a.typ === 'text') { this.weiter(); return { k: 'wert', w: a.wert, real: !!a.real }; }
    if (this.kw('NULL')) { this.weiter(); return { k: 'wert', w: null }; }
    if (this.op('(')) {
      this.weiter();
      if (this.kw('SELECT')) throw new SqlFehler('Unterabfragen (SELECT in Klammern) gibt es in diesem Labor nicht.', this.akt().pos);
      var e = this.ausdruck(); this.erwarte('op', ')', 'Hier fehlt eine schließende Klammer'); return e;
    }
    if (a.typ === 'name') {
      this.weiter();
      var gross = a.wert.toUpperCase();
      if (this.op('(')) {
        if (!AGGREGATE[gross] && !FUNKTIONEN[gross]) throw new SqlFehler('Die Funktion ' + a.wert + ' kenne ich nicht. Es gibt COUNT, SUM, AVG, MIN, MAX, UPPER, LOWER und LENGTH.', a.pos);
        this.weiter();
        var f = { k: AGGREGATE[gross] ? 'agg' : 'fn', f: gross, arg: null, distinct: false, pos: a.pos };
        if (gross === 'COUNT' && this.op('*')) { this.weiter(); f.stern = true; }
        else {
          if (this.kw('DISTINCT')) { if (!AGGREGATE[gross]) throw new SqlFehler('DISTINCT geht nur in Aggregatfunktionen.', this.akt().pos); this.weiter(); f.distinct = true; }
          f.arg = this.ausdruck();
        }
        this.erwarte('op', ')', 'Hier fehlt die schließende Klammer der Funktion ' + gross);
        return f;
      }
      if (this.op('.')) { this.weiter(); var sp = this.name('den Namen einer Spalte'); return { k: 'spalte', tabelle: a.wert, name: sp, pos: a.pos }; }
      return { k: 'spalte', tabelle: null, name: a.wert, pos: a.pos };
    }
    if (a.typ === 'ende') throw new SqlFehler('Die Anfrage hört mitten in einem Ausdruck auf.', a.pos);
    if (a.typ === 'kw') throw new SqlFehler('„' + a.wert + '“ steht hier an der falschen Stelle. Fehlt davor ein Wert oder Spaltenname?', a.pos);
    if (a.typ === 'op' && ['=', '<>', '<', '<=', '>', '>='].indexOf(a.wert) >= 0)
      throw new SqlFehler('Vor „' + a.wert + '“ fehlt ein Wert oder Spaltenname. Nach AND oder OR muss die Spalte wiederholt werden, z. B. jahr > 1970 AND jahr < 1980.', a.pos);
    throw new SqlFehler('„' + this.q.slice(a.pos, a.ende) + '“ steht hier an der falschen Stelle.', a.pos);
  };

  // ------------------------------------------------------------------ Hilfen für Werte
  function istZahl(v) { return typeof v === 'number'; }
  function alsZahl(v) {
    if (istZahl(v)) return v;
    if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
    return null;
  }
  // Vergleich zweier Werte: <0, 0, >0 oder null (unbekannt, wenn ein Wert NULL ist)
  function vergleichsWert(a, b) {
    if (a === null || b === null) return null;
    if (istZahl(a) && istZahl(b)) return a - b;
    if (istZahl(a) || istZahl(b)) {
      var za = alsZahl(a), zb = alsZahl(b);
      if (za !== null && zb !== null) return za - zb;
      return istZahl(a) ? -1 : 1;     // Zahlen vor Texten
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function sortierVergleich(a, b) {
    if (a === null && b === null) return 0;
    if (a === null) return -1;      // NULL zuerst (wie SQLite)
    if (b === null) return 1;
    if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'de', { sensitivity: 'variant' });
    return vergleichsWert(a, b);
  }
  // Ist ein Ausdruck eine Kommazahl (z. B. 7.0 oder AVG(…))? Dann rechnet / nicht ganzzahlig.
  function istReal(e) {
    if (!e) return false;
    if (e.k === 'wert') return !!e.real;
    if (e.k === 'agg') return e.f === 'AVG';
    if (e.k === 'rechne') return istReal(e.a) || istReal(e.b);
    return false;
  }
  function wahr(v) { return v !== null && v !== false && v !== 0 && v !== ''; }
  function likeRegex(muster) {
    var r = '^';
    for (var i = 0; i < muster.length; i++) {
      var c = muster[i];
      if (c === '%') r += '[\\s\\S]*';
      else if (c === '_') r += '[\\s\\S]';
      else r += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(r + '$', 'i');
  }
  function runde(x) { return Math.round(x * 1e10) / 1e10; }

  // ------------------------------------------------------------------ Auswerten
  // Ein "Bereich" beschreibt die Spalten der verbundenen Tabellen: [{ tabelle (Alias), echt (Tabellenname), spalte }]
  function finde(bereich, ref) {
    var treffer = [];
    for (var i = 0; i < bereich.length; i++) {
      var b = bereich[i];
      if (b.spalte.toLowerCase() !== ref.name.toLowerCase()) continue;
      if (ref.tabelle && b.tabelle.toLowerCase() !== ref.tabelle.toLowerCase()) continue;
      treffer.push(i);
    }
    if (!treffer.length) {
      if (ref.tabelle && !bereich.some(function (b) { return b.tabelle.toLowerCase() === ref.tabelle.toLowerCase(); }))
        throw new SqlFehler('Die Tabelle „' + ref.tabelle + '“ steht nicht hinter FROM bzw. JOIN.', ref.pos);
      var tabs = [];
      bereich.forEach(function (b) { if (tabs.indexOf(b.tabelle) < 0) tabs.push(b.tabelle); });
      var kw = SCHLUESSELWOERTER.filter(function (k) { return abstand(k, ref.name.toUpperCase()) <= 1 && ref.name.length > 2; });
      var tipp = vorschlag(ref.name, bereich.map(function (b) { return b.spalte; }));
      if (kw.length && !ref.tabelle) tipp = ' Ist das ein vertipptes Schlüsselwort (' + kw[0] + ')?';
      else if (!tipp && !ref.tabelle && /^[A-ZÄÖÜ]/.test(ref.name)) tipp = ' Ist das ein Text? Dann gehört er in Anführungszeichen: \'' + ref.name + '\'.';
      throw new SqlFehler('Die Spalte „' + (ref.tabelle ? ref.tabelle + '.' : '') + ref.name + '“ gibt es in ' + tabs.join(', ') + ' nicht.' + tipp, ref.pos);
    }
    if (treffer.length > 1) {
      throw new SqlFehler('Die Spalte „' + ref.name + '“ gibt es in mehreren Tabellen. Schreibe davor, welche gemeint ist, z. B. ' + bereich[treffer[0]].tabelle + '.' + ref.name + '.', ref.pos);
    }
    return treffer[0];
  }
  // Spaltenverweise vorab auflösen (damit Fehler auch bei leeren Tabellen auffallen)
  function binde(e, bereich) {
    if (!e) return;
    if (e.k === 'spalte') { e.idx = finde(bereich, e); return; }
    ['a', 'b', 'von', 'bis', 'arg'].forEach(function (x) { if (e[x]) binde(e[x], bereich); });
    if (e.liste) e.liste.forEach(function (x) { binde(x, bereich); });
  }
  function hatAggregat(e) {
    if (!e) return false;
    if (e.k === 'agg') return true;
    return ['a', 'b', 'von', 'bis', 'arg'].some(function (x) { return hatAggregat(e[x]); }) || (e.liste || []).some(hatAggregat);
  }
  function gleicheAusdruecke(x, y) {
    if (x.k !== y.k) return false;
    if (x.k === 'spalte') return x.idx === y.idx;
    return JSON.stringify(ohnePos(x)) === JSON.stringify(ohnePos(y));
  }
  function ohnePos(e) { return JSON.parse(JSON.stringify(e, function (k, v) { return k === 'pos' ? undefined : v; })); }
  // Prüft bei Gruppierung: Jede Spalte außerhalb einer Aggregatfunktion muss in GROUP BY stehen.
  function pruefeGruppe(e, gruppe) {
    if (!e || e.k === 'agg') return;
    if (gruppe.some(function (g) { return gleicheAusdruecke(g, e); })) return;
    if (e.k === 'spalte') throw new SqlFehler('Die Spalte „' + e.name + '“ steht weder in GROUP BY noch in einer Aggregatfunktion wie COUNT oder SUM. Welcher Wert der Gruppe soll angezeigt werden?', e.pos);
    ['a', 'b', 'von', 'bis', 'arg'].forEach(function (x) { if (e[x]) pruefeGruppe(e[x], gruppe); });
    (e.liste || []).forEach(function (x) { pruefeGruppe(x, gruppe); });
  }

  function werte(e, zeile, gruppe) {
    switch (e.k) {
      case 'wert': return e.w;
      case 'spalte': return zeile[e.idx];
      case 'oder': {
        var a = werte(e.a, zeile, gruppe), b = werte(e.b, zeile, gruppe);
        if (wahr(a) || wahr(b)) return 1;
        return (a === null || b === null) ? null : 0;
      }
      case 'und': {
        var a2 = werte(e.a, zeile, gruppe), b2 = werte(e.b, zeile, gruppe);
        if ((a2 !== null && !wahr(a2)) || (b2 !== null && !wahr(b2))) return 0;
        return (a2 === null || b2 === null) ? null : 1;
      }
      case 'nicht': { var n = werte(e.a, zeile, gruppe); return n === null ? null : (wahr(n) ? 0 : 1); }
      case 'vgl': {
        var v = vergleichsWert(werte(e.a, zeile, gruppe), werte(e.b, zeile, gruppe));
        if (v === null) return null;
        return ({ '=': v === 0, '<>': v !== 0, '<': v < 0, '<=': v <= 0, '>': v > 0, '>=': v >= 0 })[e.op] ? 1 : 0;
      }
      case 'like': {
        var t = werte(e.a, zeile, gruppe), m = werte(e.b, zeile, gruppe);
        if (t === null || m === null) return null;
        var ok = likeRegex(String(m)).test(String(t));
        return (e.neg ? !ok : ok) ? 1 : 0;
      }
      case 'between': {
        var x = werte(e.a, zeile, gruppe), v1 = vergleichsWert(x, werte(e.von, zeile, gruppe)), v2 = vergleichsWert(x, werte(e.bis, zeile, gruppe));
        if (v1 === null || v2 === null) return null;
        var ok2 = v1 >= 0 && v2 <= 0;
        return (e.neg ? !ok2 : ok2) ? 1 : 0;
      }
      case 'in': {
        var y = werte(e.a, zeile, gruppe);
        if (y === null) return null;
        var drin = e.liste.some(function (l) { return vergleichsWert(y, werte(l, zeile, gruppe)) === 0; });
        return (e.neg ? !drin : drin) ? 1 : 0;
      }
      case 'istnull': { var z = werte(e.a, zeile, gruppe) === null; return (e.neg ? !z : z) ? 1 : 0; }
      case 'rechne': {
        var p = werte(e.a, zeile, gruppe), q = werte(e.b, zeile, gruppe);
        if (p === null || q === null) return null;
        var zp = alsZahl(p), zq = alsZahl(q);
        if (zp === null || zq === null) throw new SqlFehler('Mit Text kann man nicht rechnen (' + JSON.stringify(zp === null ? p : q) + ').', e.pos);
        if (e.op === '+') return runde(zp + zq);
        if (e.op === '-') return runde(zp - zq);
        if (e.op === '*') return runde(zp * zq);
        if (zq === 0) return null;
        if (e.op === '%') return zp % zq;
        // wie in SQLite: ganze Zahl / ganze Zahl ergibt eine ganze Zahl (7 / 2 = 3, aber 7.0 / 2 = 3.5)
        if (Number.isInteger(zp) && Number.isInteger(zq) && !istReal(e.a) && !istReal(e.b)) return Math.trunc(zp / zq);
        return runde(zp / zq);
      }
      case 'fn': {
        var w = werte(e.arg, zeile, gruppe);
        if (w === null) return null;
        if (e.f === 'UPPER') return String(w).toUpperCase();
        if (e.f === 'LOWER') return String(w).toLowerCase();
        return String(w).length;
      }
      case 'agg': {
        if (!gruppe) throw new SqlFehler('Die Aggregatfunktion ' + e.f + ' darf nicht in WHERE stehen. Für Bedingungen an Gruppen gibt es HAVING.', e.pos);
        if (e.stern) return gruppe.length;
        var liste = [];
        gruppe.forEach(function (r) { var u = werte(e.arg, r, null); if (u !== null) liste.push(u); });
        if (e.distinct) {
          var ohne = [];
          liste.forEach(function (u) { if (!ohne.some(function (o) { return vergleichsWert(o, u) === 0; })) ohne.push(u); });
          liste = ohne;
        }
        if (e.f === 'COUNT') return liste.length;
        if (!liste.length) return null;
        if (e.f === 'MIN' || e.f === 'MAX') {
          return liste.reduce(function (m, u) { var c = sortierVergleich(u, m); return (e.f === 'MIN' ? c < 0 : c > 0) ? u : m; });
        }
        var zahlen = liste.map(alsZahl);
        if (zahlen.some(function (u) { return u === null; })) throw new SqlFehler(e.f + ' geht nur mit Zahlen, nicht mit Text.', e.pos);
        var sum = zahlen.reduce(function (s, u) { return s + u; }, 0);
        return e.f === 'SUM' ? runde(sum) : runde(sum / zahlen.length);
      }
    }
    throw new SqlFehler('Unbekannter Ausdruck.', 0);
  }

  // ------------------------------------------------------------------ Datenbank
  function kopie(x) { return JSON.parse(JSON.stringify(x)); }

  /**
   * Datenbank aus einer Beschreibung: { tabellen: [{ name, spalten: [{ name, typ: 'int'|'text', pk?, fk?: 'tabelle.spalte' }], zeilen: [[…]] }] }
   */
  function Datenbank(beschreibung) { this.start = kopie(beschreibung); this.zuruecksetzen(); }
  Datenbank.prototype.zuruecksetzen = function () { this.tabellen = kopie(this.start.tabellen); };
  Datenbank.prototype.tabelle = function (name, pos) {
    var t = this.tabellen.find(function (x) { return x.name.toLowerCase() === String(name).toLowerCase(); });
    var namen = this.tabellen.map(function (x) { return x.name; });
    if (!t) throw new SqlFehler('Eine Tabelle „' + name + '“ gibt es nicht.' + (vorschlag(name, namen) || ' Vorhanden: ' + namen.join(', ') + '.'), pos || 0);
    return t;
  };

  Datenbank.prototype.ausfuehren = function (q) {
    try {
      var s = new Parser(String(q || '')).anweisung();
      if (s.art === 'select') return this.select(s);
      if (s.art === 'insert') return this.einfuegen(s);
      if (s.art === 'update') return this.aendern(s);
      return this.entfernen(s);
    } catch (e) {
      if (e instanceof SqlFehler) return { fehler: e.text, pos: e.pos };
      throw e;
    }
  };

  Datenbank.prototype.select = function (s) {
    var self = this, bereich = [], quellen = [];
    s.von.forEach(function (v) {
      var t = self.tabelle(v.name, v.pos);
      if (quellen.some(function (q) { return q.alias.toLowerCase() === v.alias.toLowerCase(); }))
        throw new SqlFehler('Die Tabelle „' + v.alias + '“ kommt zweimal vor. Gib ihr einen zweiten Namen, z. B. ' + v.name + ' AS b.', v.pos);
      quellen.push({ alias: v.alias, t: t, on: v.on, start: bereich.length });
      t.spalten.forEach(function (sp) { bereich.push({ tabelle: v.alias, echt: t.name, spalte: sp.name }); });
    });
    // Kombinationen bilden (Kreuzprodukt, JOIN-Bedingungen gleich unterwegs prüfen)
    var zeilen = [[]], anzahl = 1;
    quellen.forEach(function (qu, qi) {
      anzahl *= Math.max(1, qu.t.zeilen.length);
      if (anzahl > MAX_KOMBINATIONEN) throw new SqlFehler('Diese Verknüpfung ergäbe zu viele Kombinationen. Verknüpfe die Tabellen mit JOIN … ON oder einer Bedingung in WHERE.', 0);
      var teilBereich = bereich.slice(0, qu.start + qu.t.spalten.length);
      if (qu.on) binde(qu.on, teilBereich);
      var neu = [];
      zeilen.forEach(function (z) {
        qu.t.zeilen.forEach(function (r) {
          var k = z.concat(r);
          if (!qu.on || wahr(werte(qu.on, k, null))) neu.push(k);
        });
      });
      zeilen = neu;
    });
    if (s.wo) { binde(s.wo, bereich); if (hatAggregat(s.wo)) throw new SqlFehler('Aggregatfunktionen wie COUNT oder SUM dürfen nicht in WHERE stehen. Für Bedingungen an Gruppen gibt es HAVING.', 0); zeilen = zeilen.filter(function (z) { return wahr(werte(s.wo, z, null)); }); }

    // Ausgabespalten
    var aus = [];
    s.spalten.forEach(function (sp) {
      if (sp.stern) {
        var gefunden = false;
        bereich.forEach(function (b, i) {
          if (sp.tabelle && b.tabelle.toLowerCase() !== sp.tabelle.toLowerCase()) return;
          gefunden = true;
          aus.push({ name: quellen.length > 1 && !sp.tabelle ? b.tabelle + '.' + b.spalte : b.spalte, ausdruck: { k: 'spalte', idx: i, name: b.spalte } });
        });
        if (!gefunden) throw new SqlFehler('Die Tabelle „' + sp.tabelle + '“ steht nicht hinter FROM.', 0);
      } else { binde(sp.ausdruck, bereich); aus.push({ name: sp.name, ausdruck: sp.ausdruck }); }
    });
    s.gruppe.forEach(function (g) { binde(g, bereich); });
    // ORDER BY: Nummer, Name einer Ausgabespalte oder Ausdruck
    var ordnung = s.ordnung.map(function (o) {
      var e = o.ausdruck;
      if (e.k === 'wert' && istZahl(e.w)) {
        if (e.w < 1 || e.w > aus.length || !Number.isInteger(e.w)) throw new SqlFehler('ORDER BY ' + e.w + ': So viele Spalten hat das Ergebnis nicht.', 0);
        return { aus: e.w - 1, ab: o.ab };
      }
      if (e.k === 'spalte' && !e.tabelle) {
        var ai = aus.findIndex(function (a) { return a.name.toLowerCase() === e.name.toLowerCase(); });
        var istSpalte = bereich.some(function (b) { return b.spalte.toLowerCase() === e.name.toLowerCase(); });
        if (ai >= 0 && !istSpalte) return { aus: ai, ab: o.ab };
      }
      binde(e, bereich);
      return { ausdruck: e, ab: o.ab };
    });

    var gruppiert = s.gruppe.length > 0 || aus.some(function (a) { return hatAggregat(a.ausdruck); }) || (s.having && true);
    var ergebnis = [];   // { werte: [...], schluessel: [...] }
    if (gruppiert) {
      aus.forEach(function (a) { pruefeGruppe(a.ausdruck, s.gruppe); });
      if (s.having) { binde(s.having, bereich); pruefeGruppe(s.having, s.gruppe); }
      ordnung.forEach(function (o) { if (o.ausdruck) pruefeGruppe(o.ausdruck, s.gruppe); });
      var gruppen = [], index = {};
      zeilen.forEach(function (z) {
        var key = JSON.stringify(s.gruppe.map(function (g) { return werte(g, z, null); }));
        if (!(key in index)) { index[key] = gruppen.length; gruppen.push([]); }
        gruppen[index[key]].push(z);
      });
      if (!s.gruppe.length && !gruppen.length) gruppen.push([]);   // SELECT COUNT(*) auf leerer Menge
      gruppen.forEach(function (g) {
        var vertreter = g[0] || bereich.map(function () { return null; });
        if (s.having && !wahr(werte(s.having, vertreter, g))) return;
        ergebnis.push({
          werte: aus.map(function (a) { return werte(a.ausdruck, vertreter, g); }),
          ordnung: ordnung.map(function (o) { return o.ausdruck ? werte(o.ausdruck, vertreter, g) : null; }),
        });
      });
    } else {
      zeilen.forEach(function (z) {
        ergebnis.push({
          werte: aus.map(function (a) { return werte(a.ausdruck, z, null); }),
          ordnung: ordnung.map(function (o) { return o.ausdruck ? werte(o.ausdruck, z, null) : null; }),
        });
      });
    }
    if (ordnung.length) {
      ergebnis = ergebnis.map(function (r, i) { r.nr = i; return r; });
      ergebnis.sort(function (x, y) {
        for (var i = 0; i < ordnung.length; i++) {
          var o = ordnung[i];
          var a = o.aus !== undefined ? x.werte[o.aus] : x.ordnung[i], b = o.aus !== undefined ? y.werte[o.aus] : y.ordnung[i];
          var c = sortierVergleich(a, b);
          if (c) return o.ab ? -c : c;
        }
        return x.nr - y.nr;
      });
    }
    var rows = ergebnis.map(function (r) { return r.werte; });
    if (s.distinct) {
      var gesehen = {};
      rows = rows.filter(function (r) { var k = JSON.stringify(r); if (gesehen[k]) return false; gesehen[k] = 1; return true; });
    }
    if (s.limit !== null) rows = rows.slice(0, s.limit);
    return { art: 'select', spalten: aus.map(function (a) { return a.name; }), zeilen: rows, geordnet: ordnung.length > 0 };
  };

  // ------------------------------------------------------------------ Ändern (mit Prüfung von Typ, Primär- und Fremdschlüssel)
  Datenbank.prototype.pruefeZeile = function (t, zeile, alteZeile) {
    var self = this;
    t.spalten.forEach(function (sp, i) {
      var v = zeile[i];
      if (v === null || v === undefined) {
        if (sp.pk) throw new SqlFehler('Der Primärschlüssel ' + t.name + '.' + sp.name + ' darf nicht leer (NULL) sein.', 0);
        zeile[i] = null; return;
      }
      if (sp.typ === 'int') {
        var z = alsZahl(v);
        if (z === null || !Number.isInteger(z)) throw new SqlFehler('In die Spalte ' + t.name + '.' + sp.name + ' gehört eine ganze Zahl, nicht ' + JSON.stringify(v) + '.', 0);
        zeile[i] = z;
      } else if (typeof v !== 'string') zeile[i] = String(v);
      if (sp.pk) {
        var doppelt = t.zeilen.some(function (r) { return r !== alteZeile && vergleichsWert(r[i], zeile[i]) === 0; });
        if (doppelt) throw new SqlFehler('Den Primärschlüssel ' + sp.name + ' = ' + zeile[i] + ' gibt es in ' + t.name + ' schon. Jeder Wert darf nur einmal vorkommen.', 0);
      }
      if (sp.fk && zeile[i] !== null) {
        var ziel = sp.fk.split('.'), zt = self.tabelle(ziel[0]), zi = zt.spalten.findIndex(function (x) { return x.name === ziel[1]; });
        if (!zt.zeilen.some(function (r) { return vergleichsWert(r[zi], zeile[i]) === 0; }))
          throw new SqlFehler('Fremdschlüssel verletzt: In ' + zt.name + ' gibt es keinen Datensatz mit ' + ziel[1] + ' = ' + zeile[i] + '.', 0);
      }
    });
  };
  // Wird ein Wert dieser Zeile noch von einem Fremdschlüssel einer anderen Tabelle benutzt?
  Datenbank.prototype.verweise = function (t, zeile) {
    var treffer = null;
    this.tabellen.forEach(function (andere) {
      andere.spalten.forEach(function (sp, j) {
        if (!sp.fk || treffer) return;
        var ziel = sp.fk.split('.');
        if (ziel[0] !== t.name) return;
        var zi = t.spalten.findIndex(function (x) { return x.name === ziel[1]; });
        if (andere.zeilen.some(function (r) { return vergleichsWert(r[j], zeile[zi]) === 0; })) treffer = andere.name + '.' + sp.name;
      });
    });
    return treffer;
  };
  Datenbank.prototype.einfuegen = function (s) {
    var t = this.tabelle(s.tabelle, s.pos), self = this;
    var idx = (s.spalten || t.spalten.map(function (x) { return x.name; })).map(function (n) {
      var i = t.spalten.findIndex(function (x) { return x.name.toLowerCase() === n.toLowerCase(); });
      if (i < 0) throw new SqlFehler('Die Spalte „' + n + '“ gibt es in ' + t.name + ' nicht.', s.pos);
      return i;
    });
    var neu = [];
    s.zeilen.forEach(function (werteListe) {
      if (werteListe.length !== idx.length) throw new SqlFehler('Es sind ' + werteListe.length + ' Werte für ' + idx.length + ' Spalten angegeben.', s.pos);
      var zeile = t.spalten.map(function () { return null; });
      werteListe.forEach(function (e, k) { zeile[idx[k]] = werte(e, [], null); });
      self.pruefeZeile(t, zeile, null);
      t.zeilen.push(zeile); neu.push(zeile);
    });
    return { art: 'aenderung', anzahl: neu.length, meldung: neu.length + (neu.length === 1 ? ' Datensatz' : ' Datensätze') + ' in ' + t.name + ' eingefügt.' };
  };
  Datenbank.prototype.aendern = function (s) {
    var t = this.tabelle(s.tabelle, s.pos), self = this;
    var bereich = t.spalten.map(function (sp) { return { tabelle: t.name, echt: t.name, spalte: sp.name }; });
    if (s.wo) binde(s.wo, bereich);
    var setze = s.setze.map(function (x) {
      var i = t.spalten.findIndex(function (sp) { return sp.name.toLowerCase() === x.spalte.toLowerCase(); });
      if (i < 0) throw new SqlFehler('Die Spalte „' + x.spalte + '“ gibt es in ' + t.name + ' nicht.', x.pos);
      binde(x.ausdruck, bereich);
      return { i: i, e: x.ausdruck };
    });
    var sicherung = kopie(t.zeilen), n = 0;
    try {
      t.zeilen.forEach(function (r, ri) {
        if (s.wo && !wahr(werte(s.wo, sicherung[ri], null))) return;
        var neu = r.slice();
        setze.forEach(function (x) { neu[x.i] = werte(x.e, sicherung[ri], null); });
        setze.forEach(function (x) {
          if (vergleichsWert(neu[x.i], r[x.i]) !== 0 && (t.spalten[x.i].pk) && self.verweise(t, r))
            throw new SqlFehler('Der Primärschlüssel wird noch in ' + self.verweise(t, r) + ' benutzt und kann nicht geändert werden.', 0);
        });
        self.pruefeZeile(t, neu, r);
        for (var k = 0; k < neu.length; k++) r[k] = neu[k];
        n++;
      });
    } catch (e) { t.zeilen = sicherung; throw e; }
    return { art: 'aenderung', anzahl: n, meldung: n + (n === 1 ? ' Datensatz' : ' Datensätze') + ' in ' + t.name + ' geändert.' + (s.wo ? '' : ' (Ohne WHERE betrifft UPDATE alle Datensätze!)') };
  };
  Datenbank.prototype.entfernen = function (s) {
    var t = this.tabelle(s.tabelle, s.pos), self = this;
    var bereich = t.spalten.map(function (sp) { return { tabelle: t.name, echt: t.name, spalte: sp.name }; });
    if (s.wo) binde(s.wo, bereich);
    var weg = t.zeilen.filter(function (r) { return !s.wo || wahr(werte(s.wo, r, null)); });
    weg.forEach(function (r) {
      var v = self.verweise(t, r);
      if (v) throw new SqlFehler('Ein Datensatz wird noch in ' + v + ' benutzt (Fremdschlüssel). Lösche zuerst die verweisenden Datensätze.', 0);
    });
    t.zeilen = t.zeilen.filter(function (r) { return weg.indexOf(r) < 0; });
    return { art: 'aenderung', anzahl: weg.length, meldung: weg.length + (weg.length === 1 ? ' Datensatz' : ' Datensätze') + ' aus ' + t.name + ' gelöscht.' + (s.wo ? '' : ' (Ohne WHERE löscht DELETE alle Datensätze!)') };
  };

  // ------------------------------------------------------------------ Ergebnisse vergleichen (für Aufgaben)
  function normWert(v) { return typeof v === 'number' ? Math.round(v * 1000) / 1000 : v; }
  /** Stimmt das Ergebnis mit der Referenz überein? Spaltennamen zählen nicht; Reihenfolge nur, wenn geordnet. */
  function gleichesErgebnis(erg, ref, geordnet) {
    if (!erg || erg.art !== 'select' || !ref || ref.art !== 'select') return { ok: false };
    if (erg.zeilen.length !== ref.zeilen.length) return { ok: false, grund: 'anzahl' };
    if (erg.spalten.length !== ref.spalten.length) return { ok: false, grund: 'spalten' };
    var a = erg.zeilen.map(function (r) { return JSON.stringify(r.map(normWert)); });
    var b = ref.zeilen.map(function (r) { return JSON.stringify(r.map(normWert)); });
    if (!geordnet) { a = a.slice().sort(); b = b.slice().sort(); }
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) {
      if (geordnet && a.slice().sort().join() === b.slice().sort().join()) return { ok: false, grund: 'reihenfolge' };
      return { ok: false, grund: 'werte' };
    }
    return { ok: true };
  }

  root.SQLLab = root.SQLLab || {};
  root.SQLLab.Datenbank = Datenbank;
  root.SQLLab.zerlege = function (q) { try { return zerlege(q); } catch (e) { return []; } };
  root.SQLLab.gleichesErgebnis = gleichesErgebnis;
  root.SQLLab.SCHLUESSELWOERTER = SCHLUESSELWOERTER;
})(typeof window !== 'undefined' ? window : globalThis);
