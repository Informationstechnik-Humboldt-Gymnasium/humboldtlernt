// Hilfen für interaktive Erklärungen (lessons/k9-*).
// Einbinden mit <script src="../../static/lesson-kit.js"></script>
//
//   LK.fmt(zahl, stellen)   deutsche Zahl, z. B. LK.fmt(0.25, 2) → "0,25"
//   LK.reach('ziel-id')     Ziel-Aufgabe <div class="task" data-goal="ziel-id"> als erledigt markieren
//   Fragen:  <div class="task"><p class="task-q">…</p><div class="choices">
//              <button data-ok data-fb="Begründung">richtig</button><button data-fb="Warum falsch">…</button>
//            </div><p class="fb"></p></div>
//   Sind alle Aufgaben erledigt, meldet die Seite „erledigt“ an die Lernseite.
// Fehlerprotokoll für die Feedback-Seite – gleicher Ablauf wie FEHLERPROTOKOLL in public/feedback-kern.js:
// die letzten 8 JavaScript-Fehler (Uhrzeit, Seite, Meldung, Datei, Zeile) im sessionStorage dieses Tabs.
(function () {
  var k = 'lernseite-fehler';
  function merke(t, d, l) {
    try {
      var a = JSON.parse(sessionStorage.getItem(k) || '[]');
      a.push({ z: new Date().toTimeString().slice(0, 8), s: (location.pathname + location.hash).slice(0, 120), m: String(t || '').slice(0, 200), d: String(d || '').split('/').pop().split('?')[0].slice(0, 60), l: l || 0 });
      sessionStorage.setItem(k, JSON.stringify(a.slice(-8)));
    } catch (e) { /* kein Speicher */ }
  }
  window.addEventListener('error', function (e) { merke(e.message, e.filename, e.lineno); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; merke('Promise: ' + (r && r.message ? r.message : r), '', 0); });
})();

(function () {
  'use strict';
  var inFrame = window.parent && window.parent !== window;
  var sent = false;

  function fmt(x, digits) {
    if (!isFinite(x)) return '–';
    return Number(x).toLocaleString('de-DE', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
  }

  function check() {
    var tasks = document.querySelectorAll('.task');
    var done = document.querySelectorAll('.task.done').length;
    var c = document.querySelector('[data-task-count]');
    if (c) c.textContent = done + ' / ' + tasks.length;
    if (tasks.length && done === tasks.length) {
      var box = document.querySelector('.all-done');
      if (box) box.classList.add('show');
      if (inFrame && !sent) { sent = true; window.parent.postMessage({ type: 'lernseite:erledigt' }, '*'); }
    }
  }

  function reach(id) {
    var t = document.querySelector('.task[data-goal="' + id + '"]');
    if (t && !t.classList.contains('done')) { t.classList.add('done'); check(); }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.choices button');
    if (!b) return;
    var task = b.closest('.task'), fb = task.querySelector('.fb');
    task.querySelectorAll('.choices button').forEach(function (x) { x.classList.remove('wrong'); });
    if (b.hasAttribute('data-ok')) {
      b.classList.add('right');
      task.classList.add('done');
      task.querySelectorAll('.choices button').forEach(function (x) { x.disabled = true; });
      fb.textContent = '✓ ' + (b.dataset.fb || 'Richtig!');
      check();
    } else {
      b.classList.add('wrong');
      fb.textContent = b.dataset.fb || 'Noch nicht. Probiere es in der Simulation aus und versuche es noch einmal.';
    }
  });

  // Höhe an die Lernseite melden, damit der Rahmen genau passt
  function reportHeight() {
    if (inFrame) window.parent.postMessage({ type: 'lernseite:hoehe', h: document.documentElement.scrollHeight }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(reportHeight).observe(document.documentElement);
  window.addEventListener('load', function () { reportHeight(); check(); });

  window.LK = { fmt: fmt, reach: reach, check: check };
})();
