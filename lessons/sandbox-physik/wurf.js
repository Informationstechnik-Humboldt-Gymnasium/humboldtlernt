// Physik-Labor · Waagerechter und schräger Wurf ohne Luftwiderstand (ohne DOM, getestet in test/physiklabor.test.mjs)
//
// Abwurf im Punkt (0 | h₀) mit Geschwindigkeit v₀ unter dem Winkel α zur Waagerechten.
//   waagerecht (gleichförmig):            x(t) = v₀·cos α · t           vₓ = v₀·cos α
//   senkrecht (gleichmäßig beschleunigt): y(t) = h₀ + v₀·sin α · t − ½·g·t²   v_y = v₀·sin α − g·t
// Die beiden Bewegungen überlagern sich ungestört (Unabhängigkeitsprinzip).
(function (root) {
  'use strict';
  var PL = root.PL || (root.PL = {});
  var GRAD = Math.PI / 180;

  function param(p) {
    p = p || {};
    return { v0: p.v0 === undefined ? 12 : p.v0, winkel: p.winkel === undefined ? 45 : p.winkel, h0: p.h0 || 0, g: p.g === undefined ? 9.81 : p.g };
  }
  function komponenten(p) { return { vx: p.v0 * Math.cos(p.winkel * GRAD), vy: p.v0 * Math.sin(p.winkel * GRAD) }; }
  function flugzeit(p) {
    p = param(p);
    var c = komponenten(p);
    if (p.h0 <= 0 && c.vy <= 1e-12) return 0;
    return (c.vy + Math.sqrt(c.vy * c.vy + 2 * p.g * p.h0)) / p.g;
  }
  function wurfweite(p) { p = param(p); return Math.max(0, komponenten(p).vx * flugzeit(p)); }
  function maxHoehe(p) { p = param(p); var vy = komponenten(p).vy; return vy > 0 ? p.h0 + vy * vy / (2 * p.g) : p.h0; }
  /** Zeitpunkt des höchsten Punkts (0, wenn der Körper nicht steigt) */
  function steigzeit(p) { p = param(p); var vy = komponenten(p).vy; return vy > 0 ? vy / p.g : 0; }
  /** Winkel mit der größten Wurfweite (in Grad). Für h₀ = 0 sind das 45°, für h₀ > 0 weniger. */
  function besterWinkel(v0, h0, g) {
    if (v0 <= 0) return 0;
    return Math.atan(v0 / Math.sqrt(v0 * v0 + 2 * g * Math.max(0, h0))) / GRAD;
  }
  function zustand(p, t) {
    p = param(p);
    var T = flugzeit(p), tc = Math.max(0, Math.min(t, T)), c = komponenten(p);
    return {
      t: tc, x: c.vx * tc, y: t >= T ? 0 : Math.max(0, p.h0 + c.vy * tc - 0.5 * p.g * tc * tc),
      vx: c.vx, vy: c.vy - p.g * tc, gelandet: t >= T,
    };
  }
  /** n + 1 Punkte der Flugbahn vom Abwurf bis zur Landung */
  function bahn(p, n) {
    p = param(p); n = n || 60;
    var T = flugzeit(p), pts = [];
    for (var i = 0; i <= n; i++) { var s = zustand(p, T * i / n); pts.push({ x: s.x, y: s.y }); }
    return pts;
  }
  function neu(p) { var s = zustand(param(p), 0); s.yMax = s.y; return s; }
  function schritt(z, p, dt) {
    var s = zustand(p, z.t + dt);
    z.t = s.t; z.x = s.x; z.y = s.y; z.vx = s.vx; z.vy = s.vy; z.gelandet = s.gelandet;
    z.yMax = Math.max(z.yMax, z.y);
    return z.gelandet;
  }

  PL.wurf = {
    param: param, komponenten: komponenten, flugzeit: flugzeit, wurfweite: wurfweite, maxHoehe: maxHoehe, steigzeit: steigzeit,
    besterWinkel: besterWinkel, zustand: zustand, bahn: bahn, neu: neu, schritt: schritt,
  };
})(typeof window !== 'undefined' ? window : this);
