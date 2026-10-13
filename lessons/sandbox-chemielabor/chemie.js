// Atom- & Chemielabor · Rechenlogik (keine Darstellung, kein DOM)
//
// Liest ausschließlich die Quelldaten aus daten-elemente.js, daten-nuklide.js und daten-stoffe.js.
//   CL.chemie.elemente            Liste aller 118 Elemente als Objekte (inkl. Stellung im Periodensystem)
//   CL.chemie.element(z|symbol)   ein Element
//   CL.chemie.konfiguration(z, e) Elektronenkonfiguration (Aufbauprinzip + Ausnahmen nach NIST, auch für Ionen)
//   CL.chemie.atom(p, n, e)       Ordnungszahl, Massenzahl, Ladung, Element (nur aus der Protonenzahl!)
//   CL.chemie.nuklid(p, n)        stabil / radioaktiv / keine Daten
//   CL.chemie.parseFormel(text)   Parser für Summenformeln (rekursiver Abstieg)
//   CL.chemie.molareMasse(text)   molare Masse mit Rechenschritten
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var D = CL.daten;

  var HOCH = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
  var TIEF = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  var hoch = function (s) { return String(s).split('').map(function (c) { return HOCH[c] || c; }).join(''); };
  var tief = function (s) { return String(s).split('').map(function (c) { return TIEF[c] || c; }).join(''); };

  // ------------------------------------------------------------ Stellung im Periodensystem (aus Z berechnet)
  var EDELGASE = [2, 10, 18, 36, 54, 86, 118];

  /** Periode, Gruppe (1–18) und Block. Lanthanoide/Actinoide (57–71, 89–103) stehen in der f-Zeile: gruppe = null. */
  function stellung(z) {
    if (!(z >= 1 && z <= 118) || z % 1) return null;
    var periode = 1;
    while (z > EDELGASE[periode - 1]) periode++;
    var start = periode === 1 ? 1 : EDELGASE[periode - 2] + 1;
    var i = z - start, gruppe = null, fSpalte = null;
    if (periode === 1) gruppe = z === 1 ? 1 : 18;
    else if (periode <= 3) gruppe = i < 2 ? i + 1 : i + 11;
    else if (periode <= 5) gruppe = i + 1;
    else if (i < 2) gruppe = i + 1;
    else if (i <= 16) fSpalte = i - 2;
    else gruppe = i - 13;
    var block = fSpalte !== null ? 'f' : (gruppe <= 2 || z === 2) ? 's' : gruppe >= 13 ? 'p' : 'd';
    return { periode: periode, gruppe: gruppe, fSpalte: fSpalte, block: block };
  }

  // ------------------------------------------------------------ Elemente
  var elemente = D.ELEMENTE.map(function (r, i) {
    var z = i + 1, st = stellung(z);
    var standard = typeof r[2] === 'number';
    return {
      z: z, symbol: r[0], name: r[1],
      masse: standard ? r[2] : null,                                     // relative Atommasse (Standardatomgewicht) oder null
      massenzahlLanglebig: standard ? null : Number(String(r[2]).replace(/[[\]]/g, '')),
      kategorie: r[3], kategorieName: D.KATEGORIEN[r[3]],
      zustand: r[4], isotop: r[5],
      periode: st.periode, gruppe: st.gruppe, fSpalte: st.fSpalte, block: st.block,
      nurEinzelneAtome: z >= D.NUR_EINZELNE_ATOME_AB,
      ionisierung: z <= D.IONISIERUNG.length ? D.IONISIERUNG[z - 1] : null,
    };
  });
  var nachSymbol = {};
  elemente.forEach(function (e) { nachSymbol[e.symbol] = e; });

  /** Element nach Ordnungszahl oder Symbol, sonst null. */
  function element(x) {
    if (typeof x === 'number') return x >= 1 && x <= 118 && x % 1 === 0 ? elemente[x - 1] : null;
    return Object.prototype.hasOwnProperty.call(nachSymbol, x) ? nachSymbol[x] : null;
  }

  // ------------------------------------------------------------ Elektronenkonfiguration
  // Reihenfolge der Unterschalen nach der Madelung-Regel (n + l aufsteigend, bei Gleichstand n aufsteigend).
  var L_NAME = 'spdf';
  var UNTERSCHALEN = [];
  (function () {
    var alle = [];
    for (var n = 1; n <= 7; n++) for (var l = 0; l < Math.min(n, 4); l++) alle.push({ n: n, l: l });
    alle.sort(function (a, b) { return (a.n + a.l) - (b.n + b.l) || a.n - b.n; });
    alle.forEach(function (u) { u.name = u.n + L_NAME[u.l]; u.max = 2 * (2 * u.l + 1); UNTERSCHALEN.push(u); });
  })();
  var nachName = {};
  UNTERSCHALEN.forEach(function (u) { nachName[u.name] = u; });

  function aufbau(anzahl) {
    var bes = {}, rest = anzahl;
    for (var i = 0; i < UNTERSCHALEN.length && rest > 0; i++) {
      var u = UNTERSCHALEN[i], k = Math.min(u.max, rest);
      bes[u.name] = k; rest -= k;
    }
    return bes;
  }

  /** Grundzustand des neutralen Atoms: Aufbauprinzip, korrigiert durch die NIST-Ausnahmeliste. */
  function neutraleBesetzung(z) {
    var bes = aufbau(z), aus = D.KONFIG_AUSNAHMEN[z];
    if (aus) Object.keys(aus).forEach(function (k) { bes[k] = aus[k]; });
    Object.keys(bes).forEach(function (k) { if (!bes[k]) delete bes[k]; });
    return bes;
  }

  function summe(bes) { return Object.keys(bes).reduce(function (s, k) { return s + bes[k]; }, 0); }

  // Schreibreihenfolge: nach n, dann l (so schreibt NIST, z. B. [Ar] 3d¹⁰ 4s²)
  function sortiert(bes) {
    return Object.keys(bes).map(function (k) { return nachName[k]; })
      .sort(function (a, b) { return a.n - b.n || a.l - b.l; });
  }

  /**
   * Elektronenkonfiguration für Element z mit e Elektronen (Standard: neutral, e = z).
   * Ionen: Bei Kationen werden Elektronen zuerst aus der Unterschale mit dem größten n (bei Gleichstand größtes l)
   * entfernt (z. B. Fe²⁺ = [Ar] 3d⁶), bei Anionen in die nächste freie Unterschale nach dem Aufbauprinzip gesetzt.
   */
  function konfiguration(z, e) {
    var el = element(z);
    if (!el) return null;
    if (e === undefined) e = z;
    if (!(e >= 0) || e % 1) return null;
    var bes = neutraleBesetzung(z);
    while (summe(bes) > e) {
      var u = sortiert(bes).filter(function (x) { return bes[x.name] > 0; })
        .sort(function (a, b) { return b.n - a.n || b.l - a.l; })[0];
      bes[u.name]--; if (!bes[u.name]) delete bes[u.name];
    }
    while (summe(bes) < e) {
      var frei = null;
      for (var i = 0; i < UNTERSCHALEN.length; i++) if ((bes[UNTERSCHALEN[i].name] || 0) < UNTERSCHALEN[i].max) { frei = UNTERSCHALEN[i]; break; }
      if (!frei) break;
      bes[frei.name] = (bes[frei.name] || 0) + 1;
    }
    var liste = sortiert(bes).map(function (u) { return { name: u.name, n: u.n, l: u.l, max: u.max, anzahl: bes[u.name] }; });
    var schalen = [];
    liste.forEach(function (u) { schalen[u.n - 1] = (schalen[u.n - 1] || 0) + u.anzahl; });
    for (var s = 0; s < schalen.length; s++) schalen[s] = schalen[s] || 0;
    var text = liste.map(function (u) { return u.name + hoch(u.anzahl); }).join(' ');
    return {
      z: z, elektronen: e, unterschalen: liste, schalen: schalen, text: text, kurz: kurzform(liste, e),
      ausnahme: e === z && !!D.KONFIG_AUSNAHMEN[z], vorhergesagt: z >= D.KONFIG_VORHERGESAGT_AB,
      valenzelektronen: schalen.length ? schalen[schalen.length - 1] : 0,
    };
  }

  /** Kurzschreibweise mit Edelgasrumpf, z. B. [Ne] 3s¹. Nur wenn die inneren Schalen genau dem Edelgas entsprechen. */
  function kurzform(liste, e) {
    for (var g = EDELGASE.length - 1; g >= 0; g--) {
      var ng = EDELGASE[g];
      if (ng >= e) continue;
      var rumpf = konfiguration(ng).unterschalen, passt = true;
      rumpf.forEach(function (r) { var x = liste.filter(function (u) { return u.name === r.name; })[0]; if (!x || x.anzahl !== r.anzahl) passt = false; });
      if (!passt) continue;
      var rumpfNamen = rumpf.map(function (r) { return r.name; });
      var rest = liste.filter(function (u) { return rumpfNamen.indexOf(u.name) < 0; });
      return '[' + element(ng).symbol + '] ' + rest.map(function (u) { return u.name + hoch(u.anzahl); }).join(' ');
    }
    return liste.map(function (u) { return u.name + hoch(u.anzahl); }).join(' ');
  }

  // ------------------------------------------------------------ Atome, Ionen, Isotope
  /**
   * Atom aus Protonen p, Neutronen n und Elektronen e. Das Element hängt NUR von p ab.
   * Liefert immer Ordnungszahl, Massenzahl und Ladung; element ist null, wenn p = 0 oder p > 118.
   */
  function atom(p, n, e) {
    var gueltig = [p, n, e].every(function (x) { return typeof x === 'number' && x >= 0 && x % 1 === 0; });
    if (!gueltig) return { fehler: 'Teilchenzahlen müssen ganze Zahlen ab 0 sein.' };
    var ladung = p - e;
    var el = element(p);
    var art = ladung === 0 ? 'Atom' : ladung > 0 ? 'Kation (positives Ion)' : 'Anion (negatives Ion)';
    var ladungText = ladung === 0 ? '' : (Math.abs(ladung) === 1 ? '' : Math.abs(ladung)) + (ladung > 0 ? '+' : '-');
    return {
      element: el, ordnungszahl: p, massenzahl: p + n, ladung: ladung, art: el ? art : '–',
      schreibweise: el ? hoch(p + n) + el.symbol + hoch(ladungText) : '',
      isotopName: el ? el.name + '-' + (p + n) : '',
    };
  }

  /**
   * Was weiß das Labor über den Kern mit p Protonen und n Neutronen?
   *   status: 'stabil' | 'radioaktiv' | 'natuerlich' (häufigstes natürliches Isotop, sonst keine Daten) | 'keine-daten' | 'kein-kern'
   *   datenVorhanden: ob das Labor für dieses Element überhaupt Nukliddaten hat
   *   hinweis: verständlicher Text; trend: Lage relativ zu den stabilen Nukliden ('wenig-n' | 'viel-n' | null)
   */
  function nuklid(p, n) {
    if (!(p >= 1) || !(n >= 0) || p % 1 || n % 1) return { status: 'kein-kern', hinweis: 'Ohne Protonen gibt es keinen Atomkern eines Elements.' };
    var el = element(p);
    if (!el) return { status: 'kein-kern', hinweis: 'Ein Element mit ' + p + ' Protonen ist nicht bekannt (bisher sind 118 Elemente nachgewiesen).' };
    var a = p + n, d = D.NUKLIDE[p], name = el.name + '-' + a;
    if (d && d.stabil.indexOf(a) >= 0) return { status: 'stabil', datenVorhanden: true, hinweis: name + ' ist ein stabiles Nuklid.' };
    var r = d && d.radioaktiv.filter(function (x) { return x[0] === a; })[0];
    if (r) {
      var hwz = r[1] === null ? null : { wert: r[1], einheit: r[2] };
      return { status: 'radioaktiv', datenVorhanden: true, halbwertszeit: hwz,
        hinweis: name + ' ist radioaktiv' + (hwz ? ' (Halbwertszeit ' + zahlText(r[1]) + ' ' + D.EINHEIT_ZEIT[r[2]] + ').' : '; sein Zerfall ist nachgewiesen, die Halbwertszeit ist extrem lang.') };
    }
    if (a === el.isotop) return { status: 'natuerlich', datenVorhanden: false, hinweis: name + ' ist das häufigste natürlich vorkommende Isotop von ' + el.name + '. Weitere Nukliddaten zu ' + el.name + ' sind im Labor nicht hinterlegt.' };
    var trend = null, stabile = d ? d.stabil : [];
    if (stabile.length) {
      var minN = Math.min.apply(null, stabile) - p, maxN = Math.max.apply(null, stabile) - p;
      if (n < minN) trend = 'wenig-n'; else if (n > maxN) trend = 'viel-n';
    }
    var text = d
      ? 'Für ' + name + ' sind im Labor keine Daten hinterlegt. Es ist jedenfalls kein stabiles Nuklid.'
      : 'Für ' + el.name + ' sind im Labor keine Nukliddaten hinterlegt. Ob ' + name + ' existiert, kann das Labor nicht beurteilen.';
    if (trend === 'wenig-n') text += ' Der Kern hat weniger Neutronen als alle stabilen ' + el.name + '-Kerne – solche Kerne sind, falls es sie gibt, radioaktiv.';
    if (trend === 'viel-n') text += ' Der Kern hat mehr Neutronen als alle stabilen ' + el.name + '-Kerne – solche Kerne sind, falls es sie gibt, radioaktiv.';
    if (D.OHNE_STABILE_NUKLIDE(p)) text += ' ' + el.name + ' hat überhaupt kein stabiles Isotop.';
    return { status: 'keine-daten', datenVorhanden: !!d, trend: trend, hinweis: text };
  }

  /** Bekannte Nuklide eines Elements aus dem Datensatz (für die Anzeige), sortiert nach Massenzahl. */
  function nuklideVon(p) {
    var d = D.NUKLIDE[p];
    if (!d) return null;
    var liste = d.stabil.map(function (a) { return { a: a, status: 'stabil' }; })
      .concat(d.radioaktiv.map(function (r) { return { a: r[0], status: 'radioaktiv', halbwertszeit: r[1] === null ? null : { wert: r[1], einheit: r[2] } }; }));
    return liste.sort(function (x, y) { return x.a - y.a; });
  }

  function zahlText(x) {
    if (x >= 1e5) { var exp = Math.floor(Math.log10(x)), m = x / Math.pow(10, exp); return String(Math.round(m * 100) / 100).replace('.', ',') + ' · 10' + hoch(exp); }
    return String(x).replace('.', ',');
  }

  // ------------------------------------------------------------ Energieniveaus (Wasserstoff)
  // Bohr-Modell / Rydberg-Formel: E_n = −E_I / n² mit E_I = 13,598 eV (gemessene Ionisierungsenergie von H, NIST).
  // Gilt in dieser einfachen Form NUR für das Wasserstoffatom (ein Elektron).
  var E_I_H = 13.598;
  function wasserstoffNiveau(n) { return n >= 1 && n % 1 === 0 ? -E_I_H / (n * n) : NaN; }

  /** Übergang zwischen zwei Niveaus: Energie des Photons (eV, immer positiv), Wellenlänge (nm), Spektralbereich. */
  function uebergang(nVon, nNach) {
    if (!(nVon >= 1 && nNach >= 1) || nVon === nNach) return null;
    var dE = Math.abs(wasserstoffNiveau(nNach) - wasserstoffNiveau(nVon));
    var lambda = D.KONSTANTEN.hc / dE;
    return { energie: dE, wellenlaenge: lambda, art: nNach < nVon ? 'Emission' : 'Absorption', bereich: spektralbereich(lambda) };
  }
  function spektralbereich(nm) { return nm < 380 ? 'Ultraviolett (unsichtbar)' : nm <= 780 ? 'sichtbares Licht' : 'Infrarot (unsichtbar)'; }

  /** Ungefähre Farbe einer Wellenlänge im sichtbaren Bereich (nur Darstellung), sonst null. */
  function farbeVon(nm) {
    if (nm < 380 || nm > 780) return null;
    var stufen = [[380, 'violett', '#7a3fd1'], [450, 'blau', '#2f5fe0'], [490, 'türkis', '#1aa3b8'], [520, 'grün', '#2f9a3f'], [565, 'gelb', '#d9b400'], [590, 'orange', '#e8801c'], [625, 'rot', '#d8322b']];
    var s = stufen[0];
    for (var i = 0; i < stufen.length; i++) if (nm >= stufen[i][0]) s = stufen[i];
    return { name: s[1], hex: s[2] };
  }

  // ------------------------------------------------------------ Formel-Parser (rekursiver Abstieg)
  // Grammatik:
  //   formel  = teil { ('·' | '*' | '.') teil } [ ladung ]
  //   teil    = [ koeffizient ] gruppe { gruppe }
  //   gruppe  = ( element | '(' gruppe { gruppe } ')' | '[' gruppe { gruppe } ']' ) [ index ]
  //   element = Großbuchstabe [ Kleinbuchstabe ]        (muss ein bekanntes Symbol sein)
  //   index   = Ziffern (auch ₀–₉), Wert ≥ 1
  //   ladung  = '^' [Ziffern] ('+'|'-')  |  [hochgestellte Ziffern] ('⁺'|'⁻')  |  '+' | '-'   (nur am Ende)
  var TIEF_ZU = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  var HOCH_ZU = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' };
  var MAX_ZAHL = 999, MAX_TIEFE = 6;

  function FormelFehler(text, pos) { this.text = text; this.pos = pos; }

  function parseFormel(eingabe) {
    var roh = String(eingabe == null ? '' : eingabe).trim();
    if (!roh) return { ok: false, fehler: 'Gib eine Formel ein, zum Beispiel H2O oder CO2.', pos: 0 };
    if (roh.length > 60) return { ok: false, fehler: 'Die Formel ist zu lang (höchstens 60 Zeichen).', pos: 60 };
    var s = roh.replace(/\s*([·*.])\s*/g, '$1').replace(/−/g, '-');
    var i = 0, anzeige = '';

    var istZiffer = function (c) { return c >= '0' && c <= '9' || TIEF_ZU[c] !== undefined; };
    var ziffer = function (c) { return TIEF_ZU[c] !== undefined ? TIEF_ZU[c] : c; };

    function zahl(art) {
      var start = i, t = '';
      while (i < s.length && istZiffer(s[i])) t += ziffer(s[i++]);
      if (!t) return null;
      var v = Number(t);
      if (v === 0) throw new FormelFehler((art === 'koef' ? 'Ein Vorfaktor' : 'Eine Anzahl (Index)') + ' muss mindestens 1 sein.', start);
      if (t.length > 1 && t[0] === '0') throw new FormelFehler('Zahlen beginnen nicht mit 0.', start);
      if (v > MAX_ZAHL) throw new FormelFehler('Die Zahl ' + v + ' ist für dieses Werkzeug zu groß.', start);
      anzeige += art === 'koef' ? t : tief(t);
      return v;
    }

    function gruppe(tiefe) {
      var c = s[i], start = i, inhalt;
      if (c === '(' || c === '[') {
        if (tiefe >= MAX_TIEFE) throw new FormelFehler('Zu viele Klammern ineinander.', i);
        var zu = c === '(' ? ')' : ']';
        i++; anzeige += c;
        if (s[i] === zu) throw new FormelFehler('Leere Klammer.', i);
        inhalt = folge(tiefe + 1);
        if (s[i] !== zu) throw new FormelFehler(i >= s.length ? 'Die Klammer „' + c + '“ wird nicht geschlossen.' : 'Hier wird „' + zu + '“ erwartet.', i >= s.length ? start : i);
        i++; anzeige += zu;
      } else if (c >= 'A' && c <= 'Z') {
        var sym = c; i++;
        if (s[i] >= 'a' && s[i] <= 'z') sym += s[i++];
        if (s[i] >= 'a' && s[i] <= 'z') throw new FormelFehler('„' + sym + s[i] + '“ ist kein Elementsymbol. Elementsymbole haben höchstens zwei Buchstaben.', start);
        var el = element(sym);
        if (!el) throw new FormelFehler('„' + sym + '“ ist kein Elementsymbol.', start);
        inhalt = [{ symbol: sym, anzahl: 1 }];
        anzeige += sym;
      } else if (c >= 'a' && c <= 'z') {
        throw new FormelFehler('„' + c + '“: Elementsymbole beginnen mit einem Großbuchstaben (z. B. H, He, Cl).', i);
      } else if (c === ')' || c === ']') {
        throw new FormelFehler('Zu dieser Klammer „' + c + '“ fehlt die öffnende Klammer.', i);
      } else {
        throw new FormelFehler(c === undefined ? 'Die Formel endet unerwartet.' : '„' + c + '“ ist hier nicht erlaubt.', i);
      }
      var k = zahl('index') || 1;
      return inhalt.map(function (x) { return { symbol: x.symbol, anzahl: x.anzahl * k }; });
    }

    function folge(tiefe) {
      var out = [];
      do { out = out.concat(gruppe(tiefe)); } while (i < s.length && /[A-Za-z([]/.test(s[i]));
      return out;
    }

    function teil() {
      var k = zahl('koef') || 1;
      if (i >= s.length) throw new FormelFehler('Nach dem Vorfaktor fehlt die Formel.', i);
      return folge(0).map(function (x) { return { symbol: x.symbol, anzahl: x.anzahl * k }; });
    }

    function ladung() {
      var start = i, t = '';
      if (s[i] === '^') { i++; while (s[i] >= '0' && s[i] <= '9') t += s[i++]; }
      else while (HOCH_ZU[s[i]] && HOCH_ZU[s[i]] !== '+' && HOCH_ZU[s[i]] !== '-') t += HOCH_ZU[s[i++]];
      var z = HOCH_ZU[s[i]] || s[i];
      if (z !== '+' && z !== '-') { i = start; return null; }
      i++;
      if (t && Number(t) === 0) throw new FormelFehler('Eine Ladung von 0 schreibt man nicht.', start);
      return (z === '+' ? 1 : -1) * (t ? Number(t) : 1);
    }

    try {
      var atome = teil();
      while (s[i] === '·' || s[i] === '*' || s[i] === '.') { i++; anzeige += ' · '; atome = atome.concat(teil()); }
      var q = i < s.length ? ladung() : null;
      if (i < s.length && q !== null) throw new FormelFehler('Eine Ladung darf nur ganz am Ende stehen.', i);
      if (i < s.length) throw new FormelFehler(s[i] === '+' || s[i] === '-' || s[i] === '^' ? 'Eine Ladung darf nur ganz am Ende stehen.'
        : s[i] === ')' || s[i] === ']' ? 'Zu dieser Klammer „' + s[i] + '“ fehlt die öffnende Klammer.' : '„' + s[i] + '“ ist hier nicht erlaubt.', i);
      var zaehlung = {}, reihenfolge = [];
      atome.forEach(function (x) {
        if (!zaehlung[x.symbol]) { zaehlung[x.symbol] = 0; reihenfolge.push(x.symbol); }
        zaehlung[x.symbol] += x.anzahl;
      });
      var gesamt = reihenfolge.reduce(function (a, k) { return a + zaehlung[k]; }, 0);
      if (gesamt > 9999) throw new FormelFehler('Zu viele Atome für dieses Werkzeug.', 0);
      if (q) anzeige += hoch((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-'));
      return { ok: true, eingabe: roh, anzeige: anzeige, elemente: reihenfolge.map(function (k) { return { symbol: k, anzahl: zaehlung[k] }; }), anzahl: zaehlung, ladung: q || 0, atomeGesamt: gesamt };
    } catch (err) {
      if (err instanceof FormelFehler) return { ok: false, fehler: err.text, pos: err.pos };
      throw err;
    }
  }

  /** Formel als Text mit tiefgestellten Indizes, Elemente in Eingabereihenfolge (z. B. H₂O). */
  function formelText(elementeListe, q) {
    var t = elementeListe.map(function (x) { return x.symbol + (x.anzahl > 1 ? tief(x.anzahl) : ''); }).join('');
    if (q) t += hoch((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-'));
    return t;
  }

  /** Summenformel nach Hill: C zuerst, dann H, dann alphabetisch; ohne C rein alphabetisch. */
  function hill(anzahl) {
    var k = Object.keys(anzahl).filter(function (s) { return anzahl[s] > 0; });
    var c = k.indexOf('C') >= 0;
    k.sort(function (a, b) {
      if (c) { var r = function (s) { return s === 'C' ? 0 : s === 'H' ? 1 : 2; }; if (r(a) !== r(b)) return r(a) - r(b); }
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return formelText(k.map(function (s) { return { symbol: s, anzahl: anzahl[s] }; }), 0);
  }

  /** Molare Masse M in g/mol aus den Standardatomgewichten, mit allen Rechenschritten. */
  function molareMasse(eingabe) {
    var f = parseFormel(eingabe);
    if (!f.ok) return f;
    var ohne = f.elemente.filter(function (x) { return element(x.symbol).masse === null; });
    if (ohne.length) {
      return { ok: false, formel: f, fehler: ohne.map(function (x) { return element(x.symbol).name; }).join(', ') +
        (ohne.length > 1 ? ' haben' : ' hat') + ' kein Standardatomgewicht (kein stabiles Isotop). Eine molare Masse lässt sich hier nicht sinnvoll angeben.' };
    }
    var schritte = f.elemente.map(function (x) {
      var m = element(x.symbol).masse;
      return { symbol: x.symbol, name: element(x.symbol).name, anzahl: x.anzahl, atommasse: m, beitrag: x.anzahl * m };
    });
    var summeM = schritte.reduce(function (a, x) { return a + x.beitrag; }, 0);
    return { ok: true, formel: f, schritte: schritte, molareMasse: summeM, text: f.anzeige };
  }

  CL.chemie = {
    elemente: elemente, element: element, stellung: stellung, konfiguration: konfiguration, unterschalen: UNTERSCHALEN,
    atom: atom, nuklid: nuklid, nuklideVon: nuklideVon, wasserstoffNiveau: wasserstoffNiveau, uebergang: uebergang,
    spektralbereich: spektralbereich, farbeVon: farbeVon, parseFormel: parseFormel, molareMasse: molareMasse,
    formelText: formelText, hill: hill, hoch: hoch, tief: tief, zahlText: zahlText, E_I_H: E_I_H,
  };
})(typeof window !== 'undefined' ? window : globalThis);
