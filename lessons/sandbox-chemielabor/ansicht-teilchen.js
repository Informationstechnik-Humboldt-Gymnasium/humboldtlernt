// Atom- & Chemielabor · Reiter „Teilchen & Zustände“
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, T = CL.teilchen, D = CL.daten;
  var esc = U.esc, s = U.svg;
  var st = { stoff: 'wasser', t: 20, lauf: !U.bewegungReduziert, sichtbar: false, sys: null, kreise: [], raf: null };
  var NAME = { fest: 'fest', schmelzen: 'fest + flüssig', fluessig: 'flüssig', sieden: 'flüssig + gasförmig', gas: 'gasförmig' };
  var TEXT = {
    fest: 'Die Teilchen sitzen auf festen Plätzen und <b>schwingen</b> nur hin und her. Sie halten sich gegenseitig fest – der Stoff behält Form und Volumen.',
    schmelzen: 'Am <b>Schmelzpunkt</b> liegen fester und flüssiger Stoff nebeneinander vor. Zugeführte Wärme löst Teilchen aus ihren festen Plätzen, die Temperatur steigt dabei nicht weiter.',
    fluessig: 'Die Teilchen sind noch dicht beieinander, können sich aber <b>aneinander vorbeibewegen</b>. Eine Flüssigkeit hat ein festes Volumen, aber keine feste Form.',
    sieden: 'Am <b>Siedepunkt</b> verlassen Teilchen die Flüssigkeit und bilden Gasblasen. Flüssigkeit und Gas liegen nebeneinander vor.',
    gas: 'Die Teilchen fliegen <b>frei und schnell</b> durch den ganzen Raum. Die Abstände sind sehr groß – ein Gas füllt jeden Behälter aus.',
  };

  function init() {
    var sel = U.$('tz-stoff');
    sel.innerHTML = D.STOFFE_ZUSTAND.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name + ' (' + x.formel + ')') + '</option>'; }).join('');
    sel.addEventListener('change', function () { stoffWahl(this.value, 20); });
    U.$('tz-t').addEventListener('input', function () { st.t = Number(this.value); aktualisiere(); });
    U.$('tz-lauf').addEventListener('click', function () { st.lauf = !st.lauf; knopf(); schleife(); });
    U.$('tz-sprung').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-t]');
      if (b) { st.t = Number(b.dataset.t); U.$('tz-t').value = st.t; aktualisiere(); }
    });
    var svgEl = U.$('tz-svg');
    s('rect', { x: 8, y: 8, width: 384, height: 254, rx: 6, class: 'behaelter' }, svgEl);
    st.g = s('g', { transform: 'translate(10 10)' }, svgEl);
    st.sys = T.erzeugen(42, 380, 250, 3);
    st.kreise = st.sys.teilchen.map(function () { return s('circle', { r: st.sys.radius, class: 'teilchen-punkt' }, st.g); });
    knopf();
    stoffWahl('wasser', 20);
  }

  function knopf() {
    var b = U.$('tz-lauf');
    b.setAttribute('aria-pressed', st.lauf); b.textContent = st.lauf ? '⏸ Anhalten' : '▶ Bewegung starten';
  }

  function stoffWahl(id, t) {
    st.stoff = id;
    var x = T.stoff(id), r = U.$('tz-t');
    r.min = Math.max(-273, x.schmelz - 60); r.max = x.siede + 60;
    st.t = Math.max(Number(r.min), Math.min(Number(r.max), t));
    r.value = st.t;
    var mitte = Math.round((x.schmelz + x.siede) / 2);
    U.$('tz-sprung').innerHTML = [[x.schmelz - 30, 'fest'], [x.schmelz, 'Schmelzpunkt'], [mitte, 'flüssig'], [x.siede, 'Siedepunkt'], [x.siede + 30, 'gasförmig']]
      .map(function (p) { return '<button type="button" data-t="' + p[0] + '">' + p[1] + ' (' + U.fmt(p[0], 0) + ' °C)</button>'; }).join('');
    aktualisiere();
  }

  function aktualisiere() {
    var x = T.stoff(st.stoff), z = T.zustand(x, st.t);
    st.zustand = z;
    U.$('tz-t-out').textContent = U.fmt(st.t, 0) + ' °C';
    U.$('tz-readouts').innerHTML =
      U.readout(U.fmt(st.t, 0) + ' °C', 'Temperatur ϑ') +
      U.readout(U.fmt(T.kelvin(st.t), 2) + ' K', 'T = ϑ + 273,15 (berechnet)') +
      U.readout(NAME[z], 'Zustand bei 1013 hPa') +
      U.readout(U.fmt(T.geschwindigkeitsVerhaeltnis(st.t, 20), 2) + '×', 'mittl. Geschwindigkeit verglichen mit 20 °C');
    U.$('tz-text').innerHTML = '<p>' + TEXT[z] + '</p><p class="small muted">' + esc(x.name) + ' schmilzt bei ' + U.fmt(x.schmelz, 0) + ' °C und siedet bei ' + U.fmt(x.siede, 0) +
      ' °C (Tabellenwerte bei 1013 hPa). Je höher die Temperatur, desto größer die mittlere Bewegungsenergie der Teilchen.</p>';
    U.$('tz-svg').setAttribute('aria-label', 'Teilchenmodell: ' + x.name + ' bei ' + st.t + ' °C ist ' + NAME[z] + '.');
    if (st.stoff === 'sauerstoff' && z === 'fest') root.LK.reach('tz-sauerstoff-fest');
    if (!st.lauf) { for (var i = 0; i < 90; i++) T.schritt(st.sys, 1 / 30, st.t, z); male(); }
    schleife();
  }

  function male() {
    st.sys.teilchen.forEach(function (p, i) { st.kreise[i].setAttribute('cx', p.x.toFixed(1)); st.kreise[i].setAttribute('cy', p.y.toFixed(1)); });
  }

  function schleife() {
    if (!st.lauf || !st.sichtbar || st.raf) return;
    var t0 = null;
    var f = function (t) {
      if (!st.lauf || !st.sichtbar) { st.raf = null; return; }
      var dt = t0 === null ? 1 / 60 : Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      T.schritt(st.sys, dt, st.t, st.zustand);
      male();
      st.raf = requestAnimationFrame(f);
    };
    st.raf = requestAnimationFrame(f);
  }

  U.ansichten.teilchen = {
    init: init,
    zeigen: function () { st.sichtbar = true; if (!st.lauf) aktualisiere(); schleife(); },
    verstecken: function () { st.sichtbar = false; },
  };
})(window);
