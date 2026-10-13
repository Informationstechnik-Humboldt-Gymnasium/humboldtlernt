// Atom- & Chemielabor · Teilchenmodell der Aggregatzustände (kein DOM)
//
// BERECHNET (physikalisch begründet):
//   – Umrechnung °C → K (T/K = ϑ/°C + 273,15)
//   – Aggregatzustand aus TABELLIERTEN Schmelz- und Siedetemperaturen bei 1013 hPa (daten-stoffe.js)
//   – Verhältnis der mittleren Teilchengeschwindigkeiten bei zwei Temperaturen: v₂/v₁ = √(T₂/T₁)
//     (kinetische Gastheorie; die mittlere Bewegungsenergie der Teilchen ist proportional zur Temperatur in K)
// QUALITATIV (nur Veranschaulichung, keine Messwerte):
//   – Abstände, Anordnung und Bewegungsbahnen der Punkte in der Animation. Das Modell kennt weder die Masse noch die
//     Größe echter Teilchen und berechnet deshalb KEINE Dichte, keinen Druck und keine Geschwindigkeit in m/s.
(function (root) {
  'use strict';
  var CL = root.CL || (root.CL = {});
  var D = CL.daten;

  var NULLPUNKT = 273.15;
  function kelvin(celsius) { return celsius + NULLPUNKT; }

  function stoff(id) { return D.STOFFE_ZUSTAND.filter(function (s) { return s.id === id; })[0] || null; }

  /** 'fest' | 'schmelzen' | 'fluessig' | 'sieden' | 'gas' bei 1013 hPa. Genau am Schmelz-/Siedepunkt liegen zwei Zustände nebeneinander vor. */
  function zustand(s, celsius) {
    if (typeof s === 'string') s = stoff(s);
    if (!s || !isFinite(celsius) || kelvin(celsius) < 0) return null;
    if (celsius < s.schmelz) return 'fest';
    if (celsius === s.schmelz) return 'schmelzen';
    if (celsius < s.siede) return 'fluessig';
    if (celsius === s.siede) return 'sieden';
    return 'gas';
  }

  /** Verhältnis der mittleren Teilchengeschwindigkeiten v(ϑ) / v(ϑ_ref) = √(T / T_ref). */
  function geschwindigkeitsVerhaeltnis(celsius, refCelsius) {
    var t = kelvin(celsius), r = kelvin(refCelsius);
    if (!(t >= 0) || !(r > 0)) return NaN;
    return Math.sqrt(t / r);
  }

  // ------------------------------------------------------------ Animation (qualitativ)
  function zufall(seed) {
    var x = seed >>> 0 || 1;
    return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; };
  }

  /** Teilchen auf einem dichten Gitter im unteren Teil des Behälters. */
  function erzeugen(anzahl, breite, hoehe, seed) {
    var rnd = zufall(seed || 7), proReihe = Math.ceil(Math.sqrt(anzahl * 1.6)), d = 16;
    var x0 = (breite - (proReihe - 1) * d) / 2, teilchen = [];
    for (var i = 0; i < anzahl; i++) {
      var r = Math.floor(i / proReihe), c = i % proReihe;
      var hx = x0 + c * d + (r % 2 ? d / 2 : 0), hy = hoehe - 14 - r * d * 0.87;
      teilchen.push({ x: hx, y: hy, vx: (rnd() - 0.5) * 20, vy: (rnd() - 0.5) * 20, hx: hx, hy: hy });
    }
    return { breite: breite, hoehe: hoehe, teilchen: teilchen, rnd: rnd, radius: 6 };
  }

  /** Ein Zeitschritt dt (s). Geschwindigkeitsmaßstab ∝ √T (in K); Darstellung, keine echten Geschwindigkeiten. */
  function schritt(sys, dt, celsius, zst) {
    var T = Math.max(1, kelvin(celsius)), v0 = Math.min(170, 34 * Math.sqrt(T / 293.15));
    var rnd = sys.rnd, r = sys.radius, W = sys.breite, H = sys.hoehe, ts = sys.teilchen;
    var fest = zst === 'fest', gas = zst === 'gas' || zst === 'sieden', obergrenze = gas ? r : H * 0.42;
    ts.forEach(function (p, i) {
      if (fest || (zst === 'schmelzen' && i % 2 === 0)) {
        // Schwingung um den Gitterplatz: Feder zurück zum Platz + zufällige Stöße, Ausschlag wächst mit √T
        var k = 60, amp = 0.9 * v0;
        p.vx += (-(p.x - p.hx) * k + (rnd() - 0.5) * amp * 8) * dt;
        p.vy += (-(p.y - p.hy) * k + (rnd() - 0.5) * amp * 8) * dt;
        p.vx *= 0.9; p.vy *= 0.9;
      } else {
        var v = Math.hypot(p.vx, p.vy) || 1;
        if (!gas) { p.vx += (rnd() - 0.5) * v0 * 3 * dt; p.vy += (rnd() - 0.5) * v0 * 3 * dt + 30 * dt; }
        v = Math.hypot(p.vx, p.vy) || 1;
        var ziel = gas ? v0 * 1.6 : v0 * 0.7;
        p.vx *= 1 + (ziel / v - 1) * Math.min(1, dt * 3); p.vy *= 1 + (ziel / v - 1) * Math.min(1, dt * 3);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx); }
      if (p.x > W - r) { p.x = W - r; p.vx = -Math.abs(p.vx); }
      if (p.y > H - r) { p.y = H - r; p.vy = -Math.abs(p.vy); }
      if (p.y < obergrenze) { p.y = obergrenze; p.vy = Math.abs(p.vy) * (gas ? 1 : 0.3); }
    });
    if (!fest) abstossen(ts, r * 2.2);
  }

  function abstossen(ts, d) {
    for (var i = 0; i < ts.length; i++) for (var j = i + 1; j < ts.length; j++) {
      var a = ts[i], b = ts[j], dx = b.x - a.x, dy = b.y - a.y, q = dx * dx + dy * dy;
      if (q > 0 && q < d * d) {
        var l = Math.sqrt(q), s = (d - l) / 2 / l;
        a.x -= dx * s; a.y -= dy * s; b.x += dx * s; b.y += dy * s;
      }
    }
  }

  /** Mittlerer Abstand zum nächsten Nachbarn in der Animation (Pixel) – nur zur Beschreibung des Bildes. */
  function mittlererAbstand(sys) {
    var ts = sys.teilchen, s = 0;
    ts.forEach(function (a) {
      var m = Infinity;
      ts.forEach(function (b) { if (a !== b) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y)); });
      s += m;
    });
    return ts.length > 1 ? s / ts.length : NaN;
  }

  CL.teilchen = {
    kelvin: kelvin, stoff: stoff, zustand: zustand, geschwindigkeitsVerhaeltnis: geschwindigkeitsVerhaeltnis,
    erzeugen: erzeugen, schritt: schritt, mittlererAbstand: mittlererAbstand,
  };
})(typeof window !== 'undefined' ? window : globalThis);
