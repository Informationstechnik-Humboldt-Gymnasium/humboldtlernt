// Netzwerk-Labor · IPv4-Adressen und Subnetze (reine Rechnung, kein DOM)
//
// Adressen werden intern als vorzeichenlose 32-Bit-Zahl gerechnet (>>> 0).
//   SL.ip.adresse('192.168.1.10')   → { ok, wert, text } oder { ok: false, fehler }
//   SL.ip.praefix('/24' | '24' | '255.255.255.0') → { ok, praefix, maske } oder { ok: false, fehler }
//   SL.ip.netz(wert, praefix), broadcast(...), info(...), gleichesNetz(a, b, praefix)
//   SL.ip.host(ipText, maskeText)   → prüft eine Host-Konfiguration vollständig (für PCs, Server, Router-Schnittstellen)
// Modellgrenze: Präfixe /8 bis /30 für Hosts (keine /31-Punkt-zu-Punkt-Netze, keine /32-Hostrouten an Schnittstellen).
(function (root) {
  'use strict';
  var SL = root.SL || (root.SL = {});

  var PRAEFIX_MIN = 8, PRAEFIX_MAX = 30;

  function adresse(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return { ok: false, fehler: 'Keine IP-Adresse eingetragen.' };
    if (!/^[0-9.]+$/.test(t)) return { ok: false, fehler: '„' + t + '“ ist keine IPv4-Adresse: Erlaubt sind nur Ziffern und Punkte, z. B. 192.168.1.10.' };
    var teile = t.split('.');
    if (teile.length !== 4) return { ok: false, fehler: '„' + t + '“ ist keine IPv4-Adresse: Sie besteht aus genau vier Zahlen, getrennt durch Punkte.' };
    var wert = 0;
    for (var i = 0; i < 4; i++) {
      var s = teile[i];
      if (!s) return { ok: false, fehler: '„' + t + '“: Zwischen zwei Punkten fehlt eine Zahl.' };
      if (s.length > 1 && s[0] === '0') return { ok: false, fehler: '„' + t + '“: Die Zahl ' + s + ' darf nicht mit 0 beginnen.' };
      var n = Number(s);
      if (n > 255) return { ok: false, fehler: '„' + t + '“: Jede der vier Zahlen muss zwischen 0 und 255 liegen (' + s + ' ist zu groß).' };
      wert = wert * 256 + n;
    }
    return { ok: true, wert: wert >>> 0, text: text_(wert >>> 0) };
  }

  function text_(w) { return [w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255].join('.'); }

  function maske(p) { return p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0; }

  /** Präfix aus „/24“, „24“ oder „255.255.255.0“. */
  function praefix(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return { ok: false, fehler: 'Keine Subnetzmaske eingetragen.' };
    var p;
    if (/^\/?\d{1,2}$/.test(t)) {
      p = Number(t.replace('/', ''));
      if (p > 32) return { ok: false, fehler: 'Ein Präfix liegt zwischen /0 und /32 (' + t + ' ist zu groß).' };
    } else {
      var a = adresse(t);
      if (!a.ok) return { ok: false, fehler: '„' + t + '“ ist weder ein Präfix (z. B. /24) noch eine Subnetzmaske (z. B. 255.255.255.0).' };
      var m = a.wert, einsen = 0;
      while (einsen < 32 && (m & (0x80000000 >>> einsen))) einsen++;
      if (maske(einsen) !== m) return { ok: false, fehler: 'Die Subnetzmaske ' + t + ' ist ungültig: Die Einsen müssen links lückenlos aufeinander folgen (z. B. 255.255.255.0).' };
      p = einsen;
    }
    return { ok: true, praefix: p, maske: maske(p), maskeText: text_(maske(p)) };
  }

  function netz(w, p) { return (w & maske(p)) >>> 0; }
  function broadcast(w, p) { return (netz(w, p) | (~maske(p) >>> 0)) >>> 0; }
  function gleichesNetz(a, b, p) { return netz(a, p) === netz(b, p); }

  /** Kenngrößen eines Subnetzes (Netzadresse, Broadcast, Hostbereich, Anzahl Hosts). */
  function info(w, p) {
    var n = netz(w, p), b = broadcast(w, p), hosts = p >= 31 ? 0 : Math.pow(2, 32 - p) - 2;
    return { netz: text_(n), broadcast: text_(b), ersterHost: hosts ? text_(n + 1) : '–', letzterHost: hosts ? text_(b - 1) : '–',
      hosts: hosts, praefix: p, maske: text_(maske(p)), cidr: text_(n) + '/' + p };
  }

  /**
   * Prüft eine Host-Konfiguration (IP + Maske). Liefert { ok, ip, praefix, fehler: [...] } – ok nur, wenn alles stimmt.
   * Erkennt: ungültige Schreibweise, Netzadresse, Broadcast, 0.0.0.0, Loopback, Multicast/reserviert, unpassendes Präfix.
   */
  function host(ipText, maskeText) {
    var f = [], a = adresse(ipText), p = praefix(maskeText);
    if (!a.ok) f.push(a.fehler);
    if (!p.ok) f.push(p.fehler);
    else if (p.praefix < PRAEFIX_MIN || p.praefix > PRAEFIX_MAX) f.push('In diesem Modell sind Präfixe von /' + PRAEFIX_MIN + ' bis /' + PRAEFIX_MAX + ' erlaubt (eingetragen: /' + p.praefix + ').');
    if (a.ok) {
      var w = a.wert, o1 = w >>> 24;
      if (w === 0) f.push('0.0.0.0 ist keine gültige Geräteadresse.');
      else if (o1 === 127) f.push(a.text + ' ist eine Loopback-Adresse (127.x.x.x) und gehört nicht auf eine Netzwerkschnittstelle.');
      else if (o1 >= 224) f.push(a.text + ' ist keine Geräteadresse (Multicast oder reservierter Bereich ab 224.0.0.0).');
      else if (o1 === 0) f.push(a.text + ' liegt im reservierten Bereich 0.x.x.x.');
      else if (p.ok && p.praefix >= PRAEFIX_MIN && p.praefix <= PRAEFIX_MAX) {
        if (w === netz(w, p.praefix)) f.push(a.text + ' ist die Netzadresse von ' + info(w, p.praefix).cidr + ' und kann keinem Gerät gehören.');
        else if (w === broadcast(w, p.praefix)) f.push(a.text + ' ist die Broadcast-Adresse von ' + info(w, p.praefix).cidr + ' und kann keinem Gerät gehören.');
      }
    }
    return { ok: !f.length, ip: a.ok ? a.wert : null, ipText: a.ok ? a.text : null, praefix: p.ok ? p.praefix : null, fehler: f };
  }

  /** Netzangabe für eine Route: Ziel muss eine Netzadresse sein (Hostbits 0). Präfix /0 bis /32 erlaubt. */
  function netzangabe(zielText, maskeText) {
    var f = [], a = adresse(zielText), p = praefix(maskeText);
    if (!a.ok) f.push('Zielnetz: ' + a.fehler);
    if (!p.ok) f.push('Maske: ' + p.fehler);
    if (a.ok && p.ok && netz(a.wert, p.praefix) !== a.wert) f.push(a.text + '/' + p.praefix + ' ist keine Netzadresse – gemeint ist wohl ' + text_(netz(a.wert, p.praefix)) + '/' + p.praefix + '.');
    return { ok: !f.length, netz: a.ok ? a.wert : null, praefix: p.ok ? p.praefix : null, fehler: f };
  }

  SL.ip = {
    adresse: adresse, praefix: praefix, maske: maske, netz: netz, broadcast: broadcast, gleichesNetz: gleichesNetz, info: info,
    host: host, netzangabe: netzangabe, text: text_, PRAEFIX_MIN: PRAEFIX_MIN, PRAEFIX_MAX: PRAEFIX_MAX,
  };
})(typeof window !== 'undefined' ? window : globalThis);
