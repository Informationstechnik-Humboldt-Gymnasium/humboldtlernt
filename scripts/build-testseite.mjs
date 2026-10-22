// Baut eine eigenständige Testseite (eine einzige HTML-Datei) aus dem echten Code und den echten Inhalten:
// Fächer, Klassenstufen, Themen, Verstehen-Seiten mit interaktiven Erklärungen und alle Übungen.
// Läuft ohne Server, ohne Login und ohne Installation – einfach im Browser öffnen.
// Der Fortschritt wird nur im Browser gespeichert.
//
// Aufruf: npm run testseite   →  erzeugt testseite.html im Projektordner
//
// Hinweis: In der Testseite stehen die Lösungen im Quelltext. Sie ist zum Ausprobieren
// gedacht, nicht als Ersatz für die echte Lernseite.
//
// Zusätzlich enthält nur die Testseite ein simuliertes Schul-, Rollen- und Aufgabensystem (Ordner testseite/):
// simulierter IServ-Login, Schüler-, Lehrer- und Adminbereich. Die echte Lernseite (server.js) bleibt unverändert.
// Aufbau und Grenzen: testseite/README.md und testseite/SICHERHEIT.md.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config } from '../src/config.js';
import { loadAll } from '../src/faecher.js';
import { ladeImpressum } from '../src/rechtliches.js';
import { FEHLERPROTOKOLL } from '../public/feedback-kern.js';

const out = process.argv[2] || path.join(ROOT, 'testseite.html');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---------------------------------------------------------------- Inhalte
const content = loadAll();
if (content.errors.length) { console.error('Fehler in den Inhalten:\n  ' + content.errors.join('\n  ')); process.exit(1); }
const faecher = content.faecher
  .map(f => ({ id: f.id, fach: f.fach, kurz: f.kurz, beschreibung: f.beschreibung, stufen: f.stufen.filter(s => s.themenfelder.length), simulationen: f.simulationen }))
  .filter(f => f.stufen.length || f.simulationen.length);
const stufen = faecher.flatMap(f => f.stufen);

// ---------------------------------------------------------------- Interaktive Erklärungen einbetten
const kitCss = read('public/lesson-kit.css');
const kitJs = read('public/lesson-kit.js').replace(/<\/script/gi, '<\\/script');   // darf das eingebettete <script> nicht beenden
const lessons = {};
const slugs = new Set([
  ...stufen.flatMap(s => s.themenfelder.flatMap(tf => tf.topics.flatMap(t => [...t.interaktiv, ...t.vertiefung]))),
  ...faecher.flatMap(f => f.simulationen.map(sim => sim.lesson)),
]);
// Eigene Dateien einer Lektion (z. B. <script src="modell.js">, <link rel="stylesheet" href="labor.css">) direkt einbetten
// Auch Dateien einer anderen Lektion: <script src="../sandbox-schaltkreis/bedienung.js">
const local = (dir, f, andere) => fs.readFileSync(andere ? path.join(config.lessonsDir, andere, f) : path.join(dir, f), 'utf8');
for (const slug of slugs) {
  const dir = path.join(config.lessonsDir, slug);
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.json'), 'utf8')); } catch {}
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
    .replace(/<link rel="stylesheet" href="\.\.\/\.\.\/static\/lesson-kit\.css">/, () => `<style>${kitCss}</style>`)
    .replace(/<script src="\.\.\/\.\.\/static\/lesson-kit\.js"><\/script>/, () => `<script>${kitJs}</script>`)
    .replace(/<link rel="stylesheet" href="(?:\.\.\/([a-z0-9-]+)\/)?([a-z0-9-]+\.css)">/g, (_, l, f) => `<style>${local(dir, f, l)}</style>`)
    .replace(/<script src="(?:\.\.\/([a-z0-9-]+)\/)?([a-z0-9-]+\.js)"><\/script>/g, (_, l, f) => `<script>${local(dir, f, l).replace(/<\/script/gi, '<\\/script')}</script>`);
  lessons[slug] = { slug, title: meta.title || slug, description: meta.description || '', html };
}

// ---------------------------------------------------------------- Echten Code für den Browser zusammensetzen
const asScript = f => read(f).split('\n').filter(l => !/^import\s/.test(l)).join('\n').replace(/^export\s+(?=(const|function|let|class|async)\b)/gm, '');
// Feedback: gleicher Kern und gleiche Seite wie auf dem Server; ohne Server wird die E-Mail im eigenen Programm vorbereitet
const appCode = ['src/markup.js', 'src/exercises.js', 'src/progress.js', 'src/views-fach.js', 'src/rechtliches.js', 'public/feedback-kern.js', 'src/feedback.js', 'public/feedback.js'].map(f => `// ---- ${f}\n${asScript(f)}`).join('\n\n');
// Schulsystem der Testseite (nur hier, nicht auf der echten Lernseite)
const schule = ['testseite/vendor/argon2.umd.min.js', 'testseite/schule-daten.js', 'testseite/backend.js', 'testseite/ansichten.js', 'testseite/app.js']
  .map(f => `// ---- ${f}\n${read(f).replace(/<\/script/gi, '<\\/script')}`).join('\n\n');
const uebung = read('public/uebung.js').replace(/^\(function \(\) \{/m, 'function initUebung() {').replace(/^\}\)\(\);\s*$/m, '}');

const json = v => JSON.stringify(v).replace(/</g, '\\u003c');
let feedbackAn = '';
try { feedbackAn = JSON.parse(read('content/feedback.json')).empfaenger || ''; } catch { /* ohne Datei kein Empfänger */ }

const shell = /* js */ `
// ---------------------------------------------------------------- Testseite: Daten, Speicher, nachgebauter Server
const FAECHER = ${json(faecher)};
const LESSONS = ${json(lessons)};
const IMPRESSUM = ${json(ladeImpressum())};
const FEEDBACK_AN = ${json(feedbackAn)};
const topicById = new Map(), exerciseById = new Map();
for (const f of FAECHER) for (const g of f.stufen) for (const tf of g.themenfelder) for (const t of tf.topics) { topicById.set(t.id, t); for (const e of t.uebungen) exerciseById.set(e.id, e); }

const KEY = 'lernseite-testseite';
let state = { attempts: [], understood: [], lessons: [], klasse: '9a' };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) state = Object.assign(state, s); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

// ---------------------------------------------------------------- Simuliertes Schulsystem (testseite/)
const INHALTE = { topics: [], lessons: Object.values(LESSONS).map(l => ({ slug: l.slug, title: l.title })) };
for (const f of FAECHER) for (const g of f.stufen) for (const tf of g.themenfelder) for (const t of tf.topics) {
  INHALTE.topics.push({ id: t.id, titel: t.titel, kurz: t.kurz, fach: f.id, stufe: g.stufe, themenfeld: tf.titel, gesperrt: !!t.gesperrt, uebungen: t.uebungen.map(e => e.id) });
}
const speicherErsatz = {};
const SCHULE = SchulBackend.erstelle({
  speicher: {
    getItem: k => { try { return localStorage.getItem(k); } catch (e) { return speicherErsatz[k] ?? null; } },
    setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { speicherErsatz[k] = v; } },
    removeItem: k => { try { localStorage.removeItem(k); } catch (e) { delete speicherErsatz[k]; } },
  },
  argon2: hashwasm, daten: SCHULE_DATEN, inhalte: INHALTE, jetzt: () => Date.now(),
  zufall: n => crypto.getRandomValues(new Uint8Array(n)),
  sha256: async t => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))), b => b.toString(16).padStart(2, '0')).join(''),
});
SchulApp.init(SCHULE);
// Lernstand: angemeldet → aus dem Konto (simulierte Datenbank), sonst Gastmodus wie bisher
const LS = () => (SchulApp.angemeldet() ? (SchulApp.lernstand() || { attempts: [], understood: [], lessons: [] }) : state);

function sets() {
  const solved = new Set(), revealed = new Set();
  for (const a of LS().attempts) { if (a.r) revealed.add(a.e); else if (a.c && !revealed.has(a.e)) solved.add(a.e); }
  return { solved, understood: new Set(LS().understood) };
}
const user = () => {
  const ich = SchulApp.ich();
  if (ich) return { name: ich.profil.name, username: ich.profil.username, role: ich.profil.rolle, klasse: ich.profil.klasse };
  return { name: 'Testschüler', username: 'test', role: 'student', klasse: state.klasse || null };
};
const eigeneKlasse = () => (SchulApp.ich() ? SchulApp.ich().profil.klasse : state.klasse);
// Einen Lernschritt merken: angemeldet über die API (Rechte und Funktionen werden dort geprüft), sonst lokal
async function merke(art, d) {
  if (SchulApp.angemeldet()) return SchulApp.lernstandMerken(art, d);
  if (art === 'versuch') state.attempts.push(d.r ? { e: d.e, c: 0, r: 1 } : { e: d.e, c: d.c ? 1 : 0 });
  if (art === 'verstanden') { state.understood = state.understood.filter(x => x !== d.t); if (d.done !== false) state.understood.push(d.t); }
  if (art === 'lektion' && !state.lessons.includes(d.slug)) state.lessons.push(d.slug);
  save();
  return { ok: true };
}
const status = t => { const s = sets(); return topicProgress(topicById.get(t), s.solved, s.understood); };

// Nachbau der Server-API (gleiche Antworten wie server.js)
const realFetch = window.fetch.bind(window);
window.fetch = async function (url, opts) {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  const body = opts && opts.body ? JSON.parse(opts.body) : {};
  const reply = (data, code) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'Content-Type': 'application/json' } });
  let m;
  const gesperrt = (m = u.match(/^\\/api\\/(?:uebung\\/([^/]+)|verstanden\\/([^/]+))/)) && (m[1] ? topicById.get(exerciseById.get(decodeURIComponent(m[1]))?.topicId) : topicById.get(decodeURIComponent(m[2])))?.gesperrt;
  if (gesperrt) return reply({ error: 'Dieses Thema ist noch nicht freigeschaltet.' }, 403);
  if (/^\\/api\\/uebung\\//.test(u) && !SchulApp.funktionAn('uebungen')) return reply({ error: 'Übungen sind in der Testumgebung gerade ausgeschaltet.' }, 403);
  const gemerkt = async (art, d) => { const x = await merke(art, d); return x && !x.ok ? reply({ error: x.fehler }, x.code || 400) : null; };
  if ((m = u.match(/^\\/api\\/uebung\\/([^/]+)$/))) {
    const ex = exerciseById.get(decodeURIComponent(m[1]));
    if (!ex) return reply({ error: 'Diese Aufgabe gibt es nicht.' }, 404);
    const r = checkAnswer(ex, body.antwort || {});
    if (r.error) return reply({ error: r.error }, 400);
    if (r.status !== 'selbst') { const f = await gemerkt('versuch', { e: ex.id, c: r.status === 'richtig' }); if (f) return f; }
    return reply(Object.assign({}, r, { fortschritt: status(ex.topicId) }));
  }
  if ((m = u.match(/^\\/api\\/uebung\\/([^/]+)\\/loesung$/))) {
    const ex = exerciseById.get(decodeURIComponent(m[1]));
    const f = await gemerkt('versuch', { e: ex.id, c: false, r: true }); if (f) return f;
    return reply(Object.assign({}, revealSolution(ex), { fortschritt: status(ex.topicId) }));
  }
  if ((m = u.match(/^\\/api\\/uebung\\/([^/]+)\\/selbst$/))) {
    const ex = exerciseById.get(decodeURIComponent(m[1]));
    const f = await gemerkt('versuch', { e: ex.id, c: !!body.ok }); if (f) return f;
    return reply({ status: body.ok ? 'richtig' : 'falsch', fortschritt: status(ex.topicId) });
  }
  if ((m = u.match(/^\\/api\\/verstanden\\/([^/]+)$/))) {
    const t = decodeURIComponent(m[1]);
    const f = await gemerkt('verstanden', { t, done: body.done !== false }); if (f) return f;
    return reply({ ok: true, fortschritt: status(t) });
  }
  if (u === '/api/fortschritt') {
    if (body.done) { const f = await gemerkt('lektion', { slug: body.slug }); if (f) return f; }
    return reply({ ok: true });
  }
  return reply({ error: 'unbekannt' }, 404);
};

// ---------------------------------------------------------------- Seitenrahmen (ersetzt views.js)
function layout({ title, body, ohneNav, admin, wide, bare }) {
  document.title = (title ? title + ' · ' : '') + 'Lernseite – Testseite';
  const klassen = ['', '5a', '6a', '7a', '8a', '9a', '10a'];
  const fachLinks = FAECHER.filter(f => f.stufen.length || SchulApp.funktionAn('sandbox')).map(f => \`<a href="/\${f.id}">\${esc(f.kurz)}</a>\`).join('');
  const angemeldet = SchulApp.banner();
  return \`
  <div class="test-banner">\${angemeldet || \`
    <strong>Testseite</strong> · Gastmodus ohne Anmeldung · Fortschritt nur in diesem Browser
    <label>Simulierte Klasse <select id="tKlasse">\${klassen.map(k => \`<option value="\${k}" \${k === (state.klasse || '') ? 'selected' : ''}>\${k || 'keine'}</option>\`).join('')}</select></label>
    <button type="button" id="tReset" class="link">Fortschritt zurücksetzen</button>\`}
  </div>
  \${ohneNav ? '' : \`<nav class="top" aria-label="Hauptmenü">
    <a class="brand" href="/">Lernseite</a>
    <div class="nav-right">\${fachLinks}\${SchulApp.angemeldet() ? '' : '<span class="who">Gast' + (state.klasse ? ' · ' + esc(state.klasse) : '') + '</span>'}\${SchulApp.navRechts()}</div>
  </nav>\`}
  <main id="inhalt"\${admin || wide || bare ? ' class="' + [admin && 'admin-seite', wide && 'wide', bare && 'bare'].filter(Boolean).join(' ') + '"' : ''}>\${SchulApp.meldungHtml()}\${body}</main>
  <footer class="fuss"><a href="\${fbLink()}">Feedback &amp; Fehler melden</a><span aria-hidden="true">·</span><a href="/impressum">Impressum</a><span aria-hidden="true">·</span><a href="/datenschutz">Datenschutz</a></footer>\`;
}
function fbLink() {
  const hier = (location.hash.slice(1) || '/').split('?')[0];
  return hier.startsWith('/feedback') ? '/feedback' : '/feedback?von=' + encodeURIComponent(hier);
}

// ---------------------------------------------------------------- Seiten
const lessonList = slugs => slugs.map(s => LESSONS[s]).filter(Boolean);
function page(p) {
  const s = sets(), parts = p.split('/').filter(Boolean);
  const lessonDone = new Set(LS().lessons);
  if (p === '/impressum') return layout({ title: 'Impressum', body: impressumBody(IMPRESSUM) });
  if (p === '/datenschutz') return layout({ title: 'Datenschutzerklärung', body: datenschutzBody(IMPRESSUM, { feedbackAn: FEEDBACK_AN }) });
  if (p === '/feedback') {
    const von = new URLSearchParams(location.hash.split('?')[1] || '').get('von') || '';
    return layout({ title: 'Feedback', body: feedbackBody({ modus: 'mailto', empfaenger: FEEDBACK_AN, von, seitenName: 'Lernseite (Testseite)' }) });
  }
  if (!parts.length) {
    const html = subjectPickerPage({ user: user(), faecher: FAECHER.filter(f => f.stufen.length || SchulApp.funktionAn('sandbox')), own: gradeOf(eigeneKlasse()), sets: s });
    const ich = SchulApp.ich();
    let hinweis = '';
    if (!ich) hinweis = '<p class="notice" style="margin-bottom:16px">Du nutzt den <strong>Gastmodus</strong>. <a href="/anmelden">Mit einem Testkonto anmelden</a>, um Aufgaben, Lehrer- und Adminbereich auszuprobieren.</p>';
    else if (ich.profil.rolle === 'student' && ich.offeneAufgaben) hinweis = \`<p class="notice" style="margin-bottom:16px">Du hast <strong>\${ich.offeneAufgaben} offene Aufgabe\${ich.offeneAufgaben === 1 ? '' : 'n'}</strong>. <a href="/aufgaben">Zu meinen Aufgaben →</a></p>\`;
    else if (ich.profil.rolle === 'teacher') hinweis = '<p class="notice" style="margin-bottom:16px"><a href="/lehrer">Zum Lehrerbereich →</a></p>';
    else if (ich.profil.rolle === 'admin') hinweis = '<p class="notice" style="margin-bottom:16px"><a href="/admin">Zur Verwaltung →</a></p>';
    return html.replace(/(<main id="inhalt"[^>]*>(?:<div class="meldung[\\s\\S]*?<\\/div>)?)/, '$1' + hinweis);
  }
  const fach = FAECHER.find(f => f.id === parts[0]);
  const grades = fach ? fach.stufen : [];
  if (fach && fach.id === 'sandbox' && !SchulApp.funktionAn('sandbox')) return layout({ title: 'Sandbox', body: SV.deaktiviert('Die Sandbox') });
  if (fach && !grades.length && parts.length === 1) return simulationsPage({ user: user(), fach });
  const sim = fach && parts.length === 2 && (fach.simulationen || []).find(x => x.id === parts[1]);
  if (sim && LESSONS[sim.lesson]) return simulationPage({ user: user(), fach, sim });
  if (fach && parts.length === 1) return gradePickerPage({ user: user(), fach, grades, own: gradeOf(eigeneKlasse()), sets: s });
  if (parts[0] === 'lektion' && LESSONS[parts[1]]) {
    const l = LESSONS[parts[1]];
    return layout({ title: l.title, body: \`<div class="lesson-bar"><a href="javascript:history.back()" class="back">← zurück</a><h1>\${esc(l.title)}</h1></div>
      <iframe id="lesson" data-slug="\${esc(l.slug)}" title="\${esc(l.title)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>\` });
  }
  if (fach) {
    const grade = grades.find(g => g.stufe === Number(parts[1]));
    if (grade && parts.length === 2) return gradePage({ user: user(), fach, grade, grades, sets: s });
    const topic = topicById.get(parts[2]);
    if (grade && topic && topic.fach === fach.id && topic.stufe === grade.stufe && topic.gesperrt) {
      return layout({ title: 'Noch gesperrt', body: '<section class="login"><h1>Noch gesperrt</h1><p>Dieses Thema ist noch nicht freigeschaltet.</p><p><a class="btn" href="/">Zur Übersicht</a></p></section>' });
    }
    if (grade && topic && topic.fach === fach.id && topic.stufe === grade.stufe) {
      const all = topicsOfGrade(grade);
      const ctx = { user: user(), fach, grade, topic, sets: s, progress: topicProgress(topic, s.solved, s.understood), nextTopic: all[all.indexOf(topic) + 1] || null };
      if (parts.length === 3) return topicUnderstandPage(Object.assign(ctx, { lessons: lessonList(topic.interaktiv), extras: lessonList(topic.vertiefung), lessonDone }));
      if (parts[3] === 'ueben' && !SchulApp.funktionAn('uebungen')) return layout({ title: 'Üben', body: SV.deaktiviert('Das Üben') });
      if (parts[3] === 'ueben') {
        const stats = new Map();
        for (const a of LS().attempts) { if (exerciseById.get(a.e)?.topicId !== topic.id) continue; const x = stats.get(a.e) || { versuche: 0 }; x.versuche++; stats.set(a.e, x); }
        return topicPracticePage(Object.assign(ctx, { solved: s.solved, stats }));
      }
    }
  }
  return layout({ title: 'Nicht gefunden', body: '<section class="login"><h1>Nicht gefunden</h1><p><a class="btn" href="/">Zur Übersicht</a></p></section>' });
}

let renderNr = 0;
async function render() {
  const nr = ++renderNr;
  const roh = location.hash.slice(1) || '/';
  const [pfadRoh, qs] = roh.split('?');
  let pfad;
  try { pfad = decodeURIComponent(pfadRoh); } catch (e) { pfad = pfadRoh; }
  await SchulApp.vorbereiten();
  const schul = await SchulApp.seite(pfad + (qs ? '?' + qs : ''));
  if (nr !== renderNr) return;
  if (schul && schul.umleiten) {
    // Gleiche Adresse löst kein hashchange aus – dann direkt neu zeichnen
    if (location.hash.slice(1) === schul.umleiten) { setTimeout(render, 0); return; }
    if (schul.ersetzen) location.replace('#' + schul.umleiten); else location.hash = schul.umleiten;
    return;
  }
  const html = schul ? layout({ title: schul.title, body: schul.body, ohneNav: schul.ohneNav, admin: schul.admin }) : page(pfad);
  const app = document.getElementById('app');
  app.innerHTML = html.replace(/^[\\s\\S]*<body[^>]*>|<\\/body>[\\s\\S]*$/g, '');
  // Eingebettete Erklärungen aus den mitgelieferten Dateien laden
  app.querySelectorAll('iframe').forEach(f => {
    const m = (f.getAttribute('src') || '').match(/^\\/inhalt\\/([^/]+)\\//);
    const slug = m ? m[1] : f.dataset.slug;
    if (LESSONS[slug]) { f.removeAttribute('src'); f.srcdoc = LESSONS[slug].html; }
  });
  app.querySelectorAll('a[target=_blank]').forEach(a => a.removeAttribute('target'));
  const k = document.getElementById('tKlasse');
  if (k) k.onchange = () => { state.klasse = k.value; save(); render(); };
  const r = document.getElementById('tReset');
  if (r) r.onclick = () => { if (confirm('Gesamten Test-Fortschritt löschen?')) { state = { attempts: [], understood: [], lessons: [], klasse: state.klasse }; save(); render(); } };
  initUebung();
  initFeedback();
  SchulApp.nachRender();
  const m = app.querySelector('.meldung');
  if (m) m.focus({ preventScroll: true });
}

// Interne Links (/physik/…, /timp/…) als Sprungmarken (#/physik/…) behandeln
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  location.hash = a.getAttribute('href');
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
// Vollbild-Erklärung meldet „erledigt“
window.addEventListener('message', e => {
  const f = document.getElementById('lesson');
  if (f && e.source === f.contentWindow && e.data && e.data.type === 'lernseite:erledigt') window.fetch('/api/fortschritt', { method: 'POST', body: JSON.stringify({ slug: f.dataset.slug, done: true }) });
});
render();
`;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lernseite – Testseite</title>
<script>${FEHLERPROTOKOLL}</script>
<style>
${read('public/style.css')}
.test-banner { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; justify-content: center; padding: 6px 16px; font-size: .85rem; background: var(--warn-soft); color: var(--warn); }
.test-banner select { font: inherit; padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); }
.test-banner .link { color: var(--warn); text-decoration: underline; }
#lesson { height: calc(100vh - 150px); }
main.bare { padding: 0; }   /* Simulationen: volle Breite wie auf der Lernseite (wide/bare aus views-fach.js) */
${read('testseite/schule.css')}
</style>
</head>
<body>
<div id="app"></div>
<script>
(function () {
'use strict';
${appCode}

${uebung}

${schule}

${shell}
})();
</script>
</body>
</html>
`;

fs.writeFileSync(out, html);
const n = stufen.reduce((a, g) => a + g.themenfelder.reduce((b, tf) => b + tf.topics.length, 0), 0);
console.log(`✔ Testseite erstellt: ${path.relative(process.cwd(), out) || out} (${(html.length / 1024).toFixed(0)} KB, ${n} Themen, ${content.exerciseById.size} Übungen, ${Object.keys(lessons).length} interaktive Erklärungen)`);
