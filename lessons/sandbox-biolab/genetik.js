// BioLab · Rechenlogik Genetik (ohne DOM, getestet in test/biolab.test.mjs)
// Basenpaarung der DNA und Kreuzungsschemata für ein Gen mit zwei (bzw. drei) Allelen.
(function (root) {
  'use strict';
  var BL = root.BL || (root.BL = {});

  var PAAR = { A: 'T', T: 'A', G: 'C', C: 'G' };
  var BRUECKEN = { A: 2, T: 2, G: 3, C: 3 };
  function komplement(b) { return PAAR[b] || null; }
  function gegenstrang(seq) { return seq.split('').map(komplement).join(''); }
  function passt(a, b) { return PAAR[a] === b; }
  function zufallsStrang(n, r) { var s = ''; for (var i = 0; i < n; i++) s += 'ATGC'[Math.floor(r() * 4)]; return s; }

  // ---------------------------------------------------------------- Erbgänge
  // Jeder Erbgang: Allele, mögliche Genotypen der Eltern, Phänotyp eines Genotyps.
  var ERBGAENGE = {
    dominant: {
      name: 'dominant-rezessiv', beispiel: 'Erbse: Samenfarbe', allele: ['G', 'g'],
      genotypen: ['GG', 'Gg', 'gg'],
      phaenotyp: function (gt) { return gt.indexOf('G') >= 0 ? 'gelb' : 'grün'; },
      phaenotypen: ['gelb', 'grün'],
    },
    intermediaer: {
      name: 'intermediär', beispiel: 'Wunderblume: Blütenfarbe', allele: ['R', 'W'],
      genotypen: ['RR', 'RW', 'WW'],
      phaenotyp: function (gt) { return gt === 'RR' ? 'rot' : gt === 'WW' ? 'weiß' : 'rosa'; },
      phaenotypen: ['rot', 'rosa', 'weiß'],
    },
    ab0: {
      name: 'Blutgruppen (AB0)', beispiel: 'Mensch: Blutgruppe; A und B kodominant, 0 rezessiv', allele: ['A', 'B', '0'],
      genotypen: ['AA', 'A0', 'BB', 'B0', 'AB', '00'],
      phaenotyp: function (gt) { var a = gt.indexOf('A') >= 0, b = gt.indexOf('B') >= 0; return a && b ? 'AB' : a ? 'A' : b ? 'B' : '0'; },
      phaenotypen: ['A', 'B', 'AB', '0'],
    },
    xrezessiv: {
      name: 'X-chromosomal-rezessiv', beispiel: 'Mensch: Rot-Grün-Sehschwäche', allele: ['X', 'x', 'Y'],
      genotypenMutter: ['XX', 'Xx', 'xx'], genotypenVater: ['XY', 'xY'],
      phaenotyp: function (gt) {
        var sohn = gt.indexOf('Y') >= 0;
        if (sohn) return gt.indexOf('X') >= 0 ? 'Sohn, normal sehend' : 'Sohn, rot-grün-sehschwach';
        if (gt === 'xx') return 'Tochter, rot-grün-sehschwach';
        return gt === 'Xx' ? 'Tochter, normal sehend (Überträgerin)' : 'Tochter, normal sehend';
      },
      phaenotypen: ['Tochter, normal sehend', 'Tochter, normal sehend (Überträgerin)', 'Tochter, rot-grün-sehschwach', 'Sohn, normal sehend', 'Sohn, rot-grün-sehschwach'],
    },
  };
  var REIHE = { G: 0, g: 1, R: 0, W: 1, A: 0, B: 1, '0': 2, X: 0, x: 1, Y: 2 };
  /** Genotyp in übliche Schreibweise bringen (dominantes/zuerst genanntes Allel vorn, Y hinten) */
  function ordne(a, b) { return REIHE[a] <= REIHE[b] ? a + b : b + a; }

  /** Kreuzungsschema: 2×2-Felder, jedes mit Wahrscheinlichkeit 1/4 */
  function schema(id, p1, p2) {
    var E = ERBGAENGE[id], felder = [];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
      var gt = ordne(p1[i], p2[j]);
      felder.push({ zeile: j, spalte: i, keim1: p1[i], keim2: p2[j], genotyp: gt, phaenotyp: E.phaenotyp(gt), p: 0.25 });
    }
    return felder;
  }
  /** Wahrscheinlichkeiten der Phänotypen (und Genotypen) eines Kindes */
  function verteilung(id, p1, p2) {
    var ph = {}, gt = {};
    schema(id, p1, p2).forEach(function (f) { ph[f.phaenotyp] = (ph[f.phaenotyp] || 0) + f.p; gt[f.genotyp] = (gt[f.genotyp] || 0) + f.p; });
    return { phaenotypen: ph, genotypen: gt };
  }
  /** Zufällige Nachkommen: jedes Elternteil gibt zufällig eines seiner beiden Allele weiter */
  function nachkommen(id, p1, p2, n, r) {
    var E = ERBGAENGE[id], liste = [];
    for (var k = 0; k < n; k++) {
      var gt = ordne(p1[r() < 0.5 ? 0 : 1], p2[r() < 0.5 ? 0 : 1]);
      liste.push({ genotyp: gt, phaenotyp: E.phaenotyp(gt) });
    }
    return liste;
  }
  function zaehle(liste) { var z = {}; liste.forEach(function (k) { z[k.phaenotyp] = (z[k.phaenotyp] || 0) + 1; }); return z; }

  BL.genetik = {
    komplement: komplement, gegenstrang: gegenstrang, passt: passt, BRUECKEN: BRUECKEN, zufallsStrang: zufallsStrang,
    ERBGAENGE: ERBGAENGE, ordne: ordne, schema: schema, verteilung: verteilung, nachkommen: nachkommen, zaehle: zaehle,
  };
})(typeof window !== 'undefined' ? window : this);
