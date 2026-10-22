// HTML-Sandbox · Projekte prüfen, ZIP-Dateien und Teilen-Links (ohne DOM)
// - Dateinamen und Dateiarten (HS.dateiArt, HS.pruefeName, HS.pruefeProjekt)
// - ZIP schreiben (unkomprimiert) und lesen (unkomprimiert oder „deflate“, über DecompressionStream des Browsers)
// - Teilen-Link: Projekt als JSON → deflate (CompressionStream) → base64url; ohne CompressionStream unkomprimiert
// Alles mit Bordmitteln des Browsers, ohne fremde Bibliotheken.
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  var MAX_DATEIEN = 30;
  var MAX_ZEICHEN = 400000;                                         // je Datei (Bilder als data:-URL eingeschlossen)

  // ---------------------------------------------------------------- Dateien
  var ARTEN = { html: 'html', htm: 'html', css: 'css', js: 'js', svg: 'html', txt: 'text', md: 'text', json: 'text', png: 'bild', jpg: 'bild', jpeg: 'bild', gif: 'bild', webp: 'bild' };
  var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  function endung(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  /** { sprache: 'html'|'css'|'js'|'text', bild: true|false, anzeige: 'HTML' … } */
  function dateiArt(name) {
    var e = endung(name), a = ARTEN[e] || '';
    var anzeige = { html: 'HTML', htm: 'HTML', css: 'CSS', js: 'JavaScript', svg: 'SVG', txt: 'Text', md: 'Markdown', json: 'JSON', png: 'Bild', jpg: 'Bild', jpeg: 'Bild', gif: 'Bild', webp: 'Bild' }[e] || '';
    return { sprache: a === 'bild' ? 'text' : a, bild: a === 'bild', anzeige: anzeige, endung: e, erlaubt: !!a };
  }
  /** Fehlermeldung oder '' (Name ist in Ordnung). */
  function pruefeName(name, vorhanden) {
    name = String(name || '');
    if (!name.trim()) return 'Bitte gib einen Dateinamen ein.';
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$/.test(name)) return 'Erlaubt sind Buchstaben ohne Umlaute, Ziffern, „-“, „_“ und „.“ (keine Leerzeichen, keine Ordner).';
    if (!dateiArt(name).erlaubt) return 'Erlaubte Endungen: .html, .css, .js, .svg, .txt, .md, .json und Bilder (.png, .jpg, .gif, .webp).';
    if (vorhanden && vorhanden.some(function (v) { return v.toLowerCase() === name.toLowerCase(); })) return 'Eine Datei mit diesem Namen gibt es schon.';
    return '';
  }

  /** Projekt aus fremder Quelle (Speicher, Link, ZIP) prüfen und bereinigen. Liefert null, wenn unbrauchbar. */
  function pruefeProjekt(p) {
    if (!p || typeof p !== 'object') return null;
    var dateien = [], namen = [];
    (Array.isArray(p.dateien) ? p.dateien : []).forEach(function (d) {
      if (!d || typeof d.name !== 'string' || typeof d.inhalt !== 'string') return;
      if (pruefeName(d.name, namen) || dateien.length >= MAX_DATEIEN) return;
      var art = dateiArt(d.name);
      if (art.bild && !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]*$/.test(d.inhalt)) return;
      dateien.push({ name: d.name, inhalt: d.inhalt.slice(0, MAX_ZEICHEN) });
      namen.push(d.name);
    });
    if (!dateien.length) return null;
    var offen = (Array.isArray(p.offen) ? p.offen : []).filter(function (n) { return namen.indexOf(n) >= 0; });
    var aktiv = namen.indexOf(p.aktiv) >= 0 ? p.aktiv : (offen[0] || (namen.indexOf('index.html') >= 0 ? 'index.html' : namen[0]));
    if (offen.indexOf(aktiv) < 0) offen.push(aktiv);
    return {
      id: typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) ? p.id : neueId(),
      name: String(p.name || 'Projekt').replace(/[\u0000-\u001f]/g, '').slice(0, 60) || 'Projekt',
      dateien: dateien, offen: offen, aktiv: aktiv, geaendert: typeof p.geaendert === 'number' ? p.geaendert : 0
    };
  }
  function neueId() { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

  // ---------------------------------------------------------------- Bytes, UTF-8, Base64
  function utf8(s) { return new TextEncoder().encode(s); }
  function text(b) { return new TextDecoder().decode(b); }
  function base64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function ausBase64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function base64url(bytes) { return base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function ausBase64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return ausBase64(s); }
  /** Bilddatei (data:-URL) ↔ Bytes */
  function dataUrlBytes(url) { var m = /^data:[^;,]*;base64,(.*)$/.exec(url); return m ? ausBase64(m[1]) : utf8(''); }
  function bytesDataUrl(name, bytes) { return 'data:' + (MIME[endung(name)] || 'application/octet-stream') + ';base64,' + base64(bytes); }

  // ---------------------------------------------------------------- CRC-32 und ZIP
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  // Eintrag: { name, daten: Uint8Array }. Ergebnis: Uint8Array (ZIP ohne Kompression, Dateinamen in UTF-8).
  function zipErstellen(eintraege, datum) {
    var d = datum || new Date();
    var zeit = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var tag = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var teile = [], zentral = [], versatz = 0;
    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
    eintraege.forEach(function (e) {
      var name = utf8(e.name), daten = e.daten, crc = crc32(daten);
      var kopf = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(zeit), u16(tag), u32(crc), u32(daten.length), u32(daten.length), u16(name.length), u16(0));
      teile.push(new Uint8Array(kopf), name, daten);
      zentral.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(zeit), u16(tag), u32(crc), u32(daten.length), u32(daten.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(versatz))), name);
      versatz += kopf.length + name.length + daten.length;
    });
    var zLaenge = zentral.reduce(function (s, x) { return s + x.length; }, 0);
    var ende = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(eintraege.length), u16(eintraege.length), u32(zLaenge), u32(versatz), u16(0)));
    var alle = teile.concat(zentral, [ende]);
    var gesamt = new Uint8Array(alle.reduce(function (s, x) { return s + x.length; }, 0)), p = 0;
    alle.forEach(function (x) { gesamt.set(x, p); p += x.length; });
    return gesamt;
  }

  function strom(bytes, transform) {
    var antwort = new Response(new Blob([bytes]).stream().pipeThrough(transform));
    return antwort.arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  /** ZIP lesen → Promise<[{ name, daten }]>. Ordner werden flach gemacht, versteckte Dateien übersprungen. */
  function zipLesen(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var e = bytes.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) return Promise.reject(new Error('Das ist keine gültige ZIP-Datei.'));
    var anzahl = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true);
    var aufgaben = [];
    for (var k = 0; k < anzahl && k < 200; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var methode = dv.getUint16(p + 10, true), groesse = dv.getUint32(p + 20, true);
      var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), kl = dv.getUint16(p + 32, true), lokal = dv.getUint32(p + 42, true);
      var name = text(bytes.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + kl;
      if (/\/$/.test(name) || /(^|\/)(\.|__MACOSX)/.test(name)) continue;
      var lnl = dv.getUint16(lokal + 26, true), lxl = dv.getUint16(lokal + 28, true);
      var daten = bytes.subarray(lokal + 30 + lnl + lxl, lokal + 30 + lnl + lxl + groesse);
      var kurz = name.split('/').pop();
      if (methode === 0) aufgaben.push(Promise.resolve({ name: kurz, daten: daten }));
      else if (methode === 8 && typeof DecompressionStream !== 'undefined') {
        aufgaben.push((function (n) { return strom(daten, new DecompressionStream('deflate-raw')).then(function (d) { return { name: n, daten: d }; }); })(kurz));
      }
    }
    return Promise.all(aufgaben);
  }

  /** Projekt → ZIP-Einträge (Bilder als echte Bilddateien). */
  function projektAlsZip(projekt) {
    return zipErstellen(projekt.dateien.map(function (d) {
      return { name: d.name, daten: dateiArt(d.name).bild ? dataUrlBytes(d.inhalt) : utf8(d.inhalt) };
    }));
  }
  /** ZIP-Einträge → Projektdateien (nur erlaubte Dateien). */
  function zipAlsDateien(eintraege) {
    var namen = [];
    return eintraege.filter(function (e) {
      if (pruefeName(e.name, namen)) return false;
      namen.push(e.name); return true;
    }).map(function (e) {
      return { name: e.name, inhalt: dateiArt(e.name).bild ? bytesDataUrl(e.name, e.daten) : text(e.daten) };
    });
  }

  // ---------------------------------------------------------------- Teilen-Link
  // Format: „v1.“ + base64url(deflate-raw(JSON)), ohne CompressionStream „r1.“ + base64url(JSON)
  function teilenKodieren(projekt) {
    var json = JSON.stringify({ n: projekt.name, a: projekt.aktiv, d: projekt.dateien.map(function (d) { return [d.name, d.inhalt]; }) });
    if (typeof CompressionStream === 'undefined') return Promise.resolve('r1.' + base64url(utf8(json)));
    return strom(utf8(json), new CompressionStream('deflate-raw')).then(function (b) { return 'v1.' + base64url(b); });
  }
  function teilenDekodieren(s) {
    return Promise.resolve().then(function () {
      s = String(s || '').trim();
      var art = s.slice(0, 3), rest = s.slice(3);
      if (!/^[A-Za-z0-9_-]+$/.test(rest)) throw new Error('kaputt');
      if (art === 'r1.') return text(ausBase64url(rest));
      if (art === 'v1.') return strom(ausBase64url(rest), new DecompressionStream('deflate-raw')).then(text);
      throw new Error('unbekannt');
    }).then(function (json) {
      var o = JSON.parse(json);
      var p = pruefeProjekt({ name: o.n, aktiv: o.a, dateien: (o.d || []).map(function (x) { return { name: x[0], inhalt: x[1] }; }) });
      if (!p) throw new Error('leer');
      return p;
    });
  }

  HS.MAX_DATEIEN = MAX_DATEIEN;
  HS.dateiArt = dateiArt;
  HS.pruefeName = pruefeName;
  HS.pruefeProjekt = pruefeProjekt;
  HS.neueId = neueId;
  HS.utf8 = utf8;
  HS.crc32 = crc32;
  HS.zipErstellen = zipErstellen;
  HS.zipLesen = zipLesen;
  HS.projektAlsZip = projektAlsZip;
  HS.zipAlsDateien = zipAlsDateien;
  HS.bytesDataUrl = bytesDataUrl;
  HS.teilenKodieren = teilenKodieren;
  HS.teilenDekodieren = teilenDekodieren;
})(typeof window !== 'undefined' ? window : this);
