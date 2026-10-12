// Seiten eines Fachs (Physik, TIMP, …): Klassenstufe wählen → Themenfelder → Thema (Verstehen / Üben)
import { layout, esc } from './views.js';
import { md, mdBlock } from './markup.js';
import { TYPES, renderExercise } from './exercises.js';
import { topicProgress, gradeProgress, topicsOfGrade } from './progress.js';

const DIFF = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };

const bar = (prozent, label) => `
  <div class="progress-line">
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prozent}" aria-label="${esc(label)}"><span style="width:${prozent}%"></span></div>
    <span class="small muted">${esc(label)}</span>
  </div>`;

const crumbs = items => `
  <nav class="crumbs" aria-label="Brotkrümel">
    ${items.map((it, i) => i < items.length - 1 ? `<a href="${esc(it.href)}">${esc(it.label)}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(it.label)}</span>`).join('')}
  </nav>`;

const gradeSwitch = (fach, grades, current) => `
  <nav class="grade-switch" aria-label="Klassenstufe wechseln">
    ${grades.map(g => `<a href="/${fach.id}/${g.stufe}" class="${g.stufe === current ? 'active' : ''}" ${g.stufe === current ? 'aria-current="page"' : ''}>${g.stufe}</a>`).join('')}
  </nav>`;

// ---------------------------------------------------------------- Fach wählen

export function subjectPickerPage({ user, faecher, own, sets }) {
  return layout({
    title: 'Fächer', user, body: `
    <header class="page-head">
      <h1>Was möchtest du lernen?</h1>
      <p class="muted">Wähle ein Fach. Die Inhalte folgen dem schulinternen Curriculum.</p>
    </header>
    <div class="grade-grid">${faecher.map(f => subjectCard(f, own, sets)).join('')}</div>`,
  });
}

/** Karte eines Fachs: führt direkt zur eigenen Klassenstufe, sonst zur Auswahl. Gleiche Optik wie die Klassenstufen-Karten. */
export function subjectCard(fach, own, sets) {
  const grades = fach.stufen.filter(s => s.themenfelder.length);
  const sims = fach.simulationen || [];
  if (!grades.length && sims.length) return `
    <a class="hero" href="/${esc(fach.id)}">
      <div class="hero-text">
        <span class="eyebrow">${esc(fach.fach)}</span>
        <h2>Simulationen zum Ausprobieren</h2>
        <p>${esc(fach.beschreibung || '')} ${sims.length === 1 ? `Neu: ${esc(sims[0].titel)}.` : `${sims.length} Simulationen.`}</p>
      </div>
      <span class="btn primary">Zur Übersicht →</span>
    </a>`;
  const grade = grades.find(g => g.stufe === own && topicsOfGrade(g).length);
  const p = grade ? gradeProgress(grade, sets.solved, sets.understood) : null;
  const href = grade ? `/${fach.id}/${grade.stufe}` : `/${fach.id}`;
  const stufen = grades.map(g => g.stufe);
  return `
    <a class="grade-card" href="${esc(href)}">
      <span class="grade-num" aria-hidden="true">${esc(fach.fach.charAt(0))}</span>
      <span class="grade-name">${esc(fach.fach)}</span>
      <span class="small muted">${grade ? `${p.topics} Themen mit Erklärungen und Übungen` : esc(fach.beschreibung || `Klasse ${stufen.join(', ')}`)}</span>
      ${p ? bar(p.prozent, `${p.done} von ${p.total} Übungen gelöst`) : ''}
    </a>`;
}

// ---------------------------------------------------------------- Simulationen eines Fachs (z. B. Sandbox)

/**
 * Schaltzeichen für die Karten der Simulationen ("icon" in stufen.json). Ein unbekannter Name wird als Text gezeigt.
 * Zeichnen mit currentColor, damit sie im Dark Mode mitfärben.
 */
const SIM_SYMBOLE = {
  // Gleichspannungsquelle (DIN): langer dünner Strich = Pluspol, kurzer dicker = Minuspol
  gleichspannung: `<svg viewBox="0 0 64 40" width="64" height="40" focusable="false">
    <path d="M4 20 H27 M37 20 H60" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M27 6 V34" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M37 12 V28" stroke="currentColor" stroke-width="6"/>
    <path d="M14 8 H20 M17 5 V11 M45 8 H51" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  // UND-Gatter (IEC): Rechteck mit „&“, zwei Eingänge, ein Ausgang
  logikgatter: `<svg viewBox="0 0 64 40" width="64" height="40" focusable="false">
    <path d="M4 12 H20 M4 28 H20 M44 20 H60" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <rect x="20" y="4" width="24" height="32" rx="2" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <text x="32" y="26" text-anchor="middle" font-size="16" font-weight="700" fill="currentColor" font-family="system-ui, sans-serif">&amp;</text>
  </svg>`,
};
const simSymbol = icon => SIM_SYMBOLE[icon] || esc(icon);

const simKarte = (href, x, unten) => `
      <a class="card sim-card" href="${esc(href)}">
        ${x.icon ? `<span class="sim-icon" aria-hidden="true">${simSymbol(x.icon)}</span>` : ''}
        <div class="card-top"><h3>${esc(x.titel)}</h3>${x.bereich ? `<span class="chip">${esc(x.bereich)}</span>` : ''}</div>
        ${x.untertitel ? `<p>${esc(x.untertitel)}</p>` : ''}
        <span class="sim-open">${unten}</span>
      </a>`;

/** Simulationen einer Kategorie ('' = direkt im Fach). */
export const simulationenIn = (fach, kat = '') => fach.simulationen.filter(s => (s.kategorie || '') === kat);
/** Kategorien, die mindestens eine Simulation enthalten. */
export const kategorienMitInhalt = fach => (fach.kategorien || []).filter(k => simulationenIn(fach, k.id).length);

/** Übersicht der Simulationen und Unterkategorien. Neue erscheinen hier, sobald sie in stufen.json stehen. */
export function simulationsPage({ user, fach }) {
  return layout({
    title: fach.fach, user, body: `
    <header class="page-head">
      <h1>${esc(fach.fach)}</h1>
      <p class="muted">${fach.beschreibung ? md(fach.beschreibung) : 'Wähle eine Simulation.'}</p>
    </header>
    <div class="cards sim-cards">
      ${simulationenIn(fach).map(sim => simKarte(`/${fach.id}/${sim.id}`, sim, 'Öffnen →')).join('')}
      ${kategorienMitInhalt(fach).map(k => simKarte(`/${fach.id}/${k.id}`, k, `${simulationenIn(fach, k.id).length} Module ansehen →`)).join('')}
    </div>`,
  });
}

/** Übersicht einer Unterkategorie (z. B. Atom- und Moleküllabor). */
export function kategoriePage({ user, fach, kat }) {
  return layout({
    title: kat.titel, user, body: `
    ${crumbs([{ href: `/${fach.id}`, label: fach.kurz }, { label: kat.titel }])}
    <header class="page-head">
      <h1>${esc(kat.titel)}</h1>
      ${kat.untertitel ? `<p class="muted">${esc(kat.untertitel)}</p>` : ''}
    </header>
    <div class="cards sim-cards">
      ${simulationenIn(fach, kat.id).map(sim => simKarte(`/${fach.id}/${kat.id}/${sim.id}`, sim, 'Öffnen →')).join('')}
    </div>`,
  });
}

/** Eine Simulation im Vollbild: schmale Leiste mit Rückweg, darunter die Simulation. */
export function simulationPage({ user, fach, sim, kat = null }) {
  const zurueck = kat ? { href: `/${fach.id}/${kat.id}`, label: kat.titel } : { href: `/${fach.id}`, label: fach.kurz };
  return layout({
    title: sim.titel, user, bare: true, wide: true, body: `
    <div class="lesson-bar sim-bar">
      <a href="${esc(zurueck.href)}" class="back">← ${esc(zurueck.label)}</a>
      <h1>${esc(sim.titel)}</h1>
      ${sim.bereich ? `<span class="chip">${esc(sim.bereich)}</span>` : ''}
    </div>
    <iframe id="lesson" class="sim-frame" src="/inhalt/${esc(sim.lesson)}/index.html${sim.modul ? '#' + esc(sim.modul) : ''}" title="${esc(sim.titel)}"${sim.modul ? ` data-modul="${esc(sim.modul)}"` : ''}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe>`,
  });
}

// ---------------------------------------------------------------- Klassenstufe wählen

export function gradePickerPage({ user, fach, grades, own, sets }) {
  return layout({
    title: fach.fach, user, body: `
    <header class="page-head">
      <h1>${esc(fach.fach)}</h1>
      <p class="muted">${fach.beschreibung ? `${md(fach.beschreibung)} ` : ''}Wähle deine Klassenstufe. Die Inhalte folgen dem schulinternen Curriculum.</p>
    </header>
    <div class="grade-grid">
      ${grades.map(g => {
        const p = gradeProgress(g, sets.solved, sets.understood);
        const ready = p.topics > 0;
        return `
        <a class="grade-card ${g.stufe === own ? 'own' : ''}" href="/${fach.id}/${g.stufe}">
          <span class="grade-num" aria-hidden="true">${g.stufe}</span>
          <span class="grade-name">${esc(g.name)}${g.stufe === own ? ' <span class="badge">Deine Klasse</span>' : ''}</span>
          <span class="small muted">${g.themenfelder.length} Themenfeld${g.themenfelder.length === 1 ? '' : 'er'}${ready ? ` · ${p.topics} Themen` : ' · in Vorbereitung'}</span>
          ${ready ? bar(p.prozent, `${p.prozent} % geschafft`) : ''}
        </a>`;
      }).join('')}
    </div>
    ${own && !grades.some(g => g.stufe === own) ? `<p class="muted small">Für Klasse ${own} gibt es noch keine Inhalte.</p>` : ''}`,
  });
}

// ---------------------------------------------------------------- Themenfelder einer Klassenstufe

export function gradePage({ user, fach, grade, grades, sets }) {
  const p = gradeProgress(grade, sets.solved, sets.understood);
  return layout({
    title: `${fach.kurz} ${grade.name}`, user, body: `
    ${crumbs([{ href: `/${fach.id}`, label: fach.kurz }, { label: grade.name }])}
    <header class="page-head head-row">
      <div>
        <h1>${esc(grade.name)}</h1>
        ${p.topics ? bar(p.prozent, `${p.done} von ${p.total} Übungen gelöst · ${p.verstanden} von ${p.topics} Themen verstanden`) : ''}
      </div>
      ${gradeSwitch(fach, grades, grade.stufe)}
    </header>
    ${grade.themenfelder.map(tf => `
    <section class="themenfeld" aria-labelledby="tf-${esc(tf.id)}">
      <h2 id="tf-${esc(tf.id)}"><span class="tf-num">${esc(tf.nummer)}</span> ${esc(tf.titel)}</h2>
      ${tf.beschreibung ? `<p class="muted">${md(tf.beschreibung)}</p>` : ''}
      ${tf.topics.length ? `
      <div class="cards">
        ${tf.topics.map(t => {
          const tp = topicProgress(t, sets.solved, sets.understood);
          return `
          <a class="card topic ${tp.total && tp.done === tp.total ? 'done' : ''}" href="/${fach.id}/${grade.stufe}/${esc(t.id)}">
            <div class="card-top"><h3>${esc(t.titel)}</h3>${tp.verstanden ? '<span class="badge ok" title="Verstehen abgeschlossen">✓ Verstanden</span>' : ''}</div>
            ${t.kurz ? `<p>${md(t.kurz)}</p>` : ''}
            <div class="card-meta">
              ${t.interaktiv.length ? '<span class="chip">Interaktiv</span>' : ''}
              <span class="chip">${tp.total} Übungen</span>
            </div>
            ${tp.total ? bar(tp.prozent, `${tp.done} / ${tp.total} gelöst`) : ''}
          </a>`;
        }).join('')}
      </div>` : `
      <div class="card planned">
        <div class="card-top"><h3>In Vorbereitung</h3><span class="chip">bald</span></div>
        <p>Inhalte laut Curriculum:</p>
        <ul class="small">${tf.inhalte.map(i => `<li>${md(i)}</li>`).join('')}</ul>
      </div>`}
    </section>`).join('')}`,
  });
}

// ---------------------------------------------------------------- Thema: gemeinsamer Kopf

function topicHead({ fach, grade, topic, tab, progress }) {
  const base = `/${fach.id}/${grade.stufe}/${esc(topic.id)}`;
  return `
    ${crumbs([{ href: `/${fach.id}`, label: fach.kurz }, { href: `/${fach.id}/${grade.stufe}`, label: grade.name }, { label: topic.titel }])}
    <header class="page-head topic-head">
      <span class="eyebrow">${esc(topic.themenfeldTitel)}</span>
      <h1>${esc(topic.titel)}</h1>
      <div class="topic-status">
        <span class="${progress.verstanden ? 'ok-text' : 'muted'}">Verstehen ${progress.verstanden ? '✓' : '○'}</span>
        <span class="muted">Übungen <b data-progress-count>${progress.done} / ${progress.total}</b></span>
        <div class="bar" aria-hidden="true"><span data-progress-bar style="width:${progress.prozent}%"></span></div>
        <span class="muted" data-progress-pct>${progress.prozent} %</span>
      </div>
      <nav class="tabs" aria-label="Bereiche des Themas">
        <a href="${base}" class="${tab === 'verstehen' ? 'active' : ''}" ${tab === 'verstehen' ? 'aria-current="page"' : ''}><span class="tab-step">1</span> Verstehen</a>
        <a href="${base}/ueben" class="${tab === 'ueben' ? 'active' : ''}" ${tab === 'ueben' ? 'aria-current="page"' : ''}><span class="tab-step">2</span> Üben</a>
      </nav>
    </header>`;
}

const lessonFrame = (l, done) => `
  <figure class="interactive" data-lesson="${esc(l.slug)}">
    <figcaption>
      <span><span class="chip">Interaktiv</span> <strong>${esc(l.title)}</strong>${done ? ' <span class="badge ok">✓ ausprobiert</span>' : ''}</span>
      <a href="/lektion/${esc(l.slug)}" target="_blank" rel="noopener">Im Vollbild öffnen ↗</a>
    </figcaption>
    ${l.description ? `<p class="small muted">${esc(l.description)}</p>` : ''}
    <iframe src="/inhalt/${esc(l.slug)}/index.html" title="${esc(l.title)}" loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe>
  </figure>`;

// ---------------------------------------------------------------- Thema: Verstehen

export function topicUnderstandPage({ user, fach, grade, topic, progress, lessons, extras, lessonDone, nextTopic }) {
  const v = topic.verstehen;
  return layout({
    title: topic.titel, user, scripts: ['/static/uebung.js'], body: `
    ${topicHead({ fach, grade, topic, tab: 'verstehen', progress })}
    <div class="topic-grid" data-topic="${esc(topic.id)}">
      <div class="topic-main">
        ${topic.lernziele.length ? `
        <section class="box goals">
          <h2>Das lernst du hier</h2>
          <ul>${topic.lernziele.map(l => `<li>${md(l.text)}</li>`).join('')}</ul>
        </section>` : ''}
        ${v.einstieg ? `<section class="box question"><h2>Frage zum Einstieg</h2>${mdBlock(v.einstieg)}</section>` : ''}
        ${(v.abschnitte || []).map(a => `
        <section class="explain">
          <h2>${md(a.titel)}</h2>
          ${mdBlock(a.text)}
        </section>`).join('')}
        ${(v.formeln || []).length ? `
        <section class="box formulas">
          <h2>Formeln</h2>
          ${v.formeln.map(f => `
          <div class="formula">
            <div class="formula-main">${md(f.formel)}</div>
            ${f.bedeutung ? `<div class="formula-legend">${md(f.bedeutung)}</div>` : ''}
          </div>`).join('')}
        </section>` : ''}
        ${lessons.map(l => lessonFrame(l, lessonDone.has(l.slug))).join('')}
        ${v.merksatz ? `<section class="box merksatz"><h2>Merksatz</h2>${mdBlock(v.merksatz)}</section>` : ''}
        ${v.alltag ? `<section class="box alltag"><h2>Im Alltag</h2>${mdBlock(v.alltag)}</section>` : ''}
        ${extras.length ? `
        <section class="explain">
          <h2>Vertiefung für Schnelle</h2>
          <div class="cards">${extras.map(l => `
            <a class="card lesson" href="/lektion/${esc(l.slug)}">
              <div class="card-top"><h3>${esc(l.title)}</h3>${lessonDone.has(l.slug) ? '<span class="badge ok">Erledigt</span>' : ''}</div>
              ${l.description ? `<p>${esc(l.description)}</p>` : ''}
            </a>`).join('')}</div>
        </section>` : ''}
        <div class="next-step">
          <button type="button" class="btn ${progress.verstanden ? 'ok' : ''}" data-understood="${progress.verstanden ? 1 : 0}" data-topic="${esc(topic.id)}">
            ${progress.verstanden ? '✓ Verstanden' : 'Ich habe es verstanden'}
          </button>
          ${topic.uebungen.length ? `<a class="btn primary" href="/${fach.id}/${grade.stufe}/${esc(topic.id)}/ueben">Weiter zu den Übungen →</a>` : ''}
        </div>
      </div>
    </div>`,
  });
}

// ---------------------------------------------------------------- Thema: Üben

export function topicPracticePage({ user, fach, grade, topic, progress, solved, stats, nextTopic }) {
  const goals = Object.fromEntries(topic.lernziele.map(l => [l.id, l.text]));
  return layout({
    title: `${topic.titel} – Üben`, user, scripts: ['/static/uebung.js'], body: `
    ${topicHead({ fach, grade, topic, tab: 'ueben', progress })}
    ${topic.uebungen.length ? `
    <div class="filters" role="group" aria-label="Übungen filtern">
      <button type="button" class="chip-btn active" data-filter="alle" aria-pressed="true">Alle</button>
      ${Object.entries(DIFF).map(([k, v]) => `<button type="button" class="chip-btn" data-filter="${k}" aria-pressed="false">${v}</button>`).join('')}
      <button type="button" class="chip-btn" data-filter="offen" aria-pressed="false">Noch offen</button>
    </div>
    <div class="exercises" data-topic="${esc(topic.id)}">
      ${topic.uebungen.map((ex, i) => {
        const st = stats.get(ex.id);
        const isSolved = solved.has(ex.id);
        return `
      <article class="exercise ${isSolved ? 'solved' : ''}" id="${esc(ex.id)}" data-id="${esc(ex.id)}" data-diff="${esc(ex.schwierigkeit)}" data-typ="${esc(ex.typ)}" aria-labelledby="q-${esc(ex.id)}">
        <header class="ex-head">
          <span class="ex-num">Aufgabe ${i + 1}</span>
          <span class="diff diff-${esc(ex.schwierigkeit)}">${DIFF[ex.schwierigkeit]}</span>
          <span class="chip">${esc(TYPES[ex.typ].label)}</span>
          <span class="ex-state" data-state>${isSolved ? '✓ gelöst' : st ? `${st.versuche} Versuch${st.versuche === 1 ? '' : 'e'}` : ''}</span>
        </header>
        <div class="ex-q" id="q-${esc(ex.id)}">${mdBlock(ex.frage)}</div>
        ${ex.lernziel && goals[ex.lernziel] ? `<p class="small muted ex-goal">Lernziel: ${md(goals[ex.lernziel])}</p>` : ''}
        <form class="ex-form" novalidate>
          ${renderExercise(ex)}
          <div class="ex-actions">
            <button class="btn primary" type="submit">Prüfen</button>
            <button class="btn" type="button" data-retry hidden>Nochmal versuchen</button>
            <button class="btn" type="button" data-reveal hidden>Lösung zeigen</button>
          </div>
        </form>
        <div class="ex-result" data-result aria-live="polite"></div>
      </article>`;
      }).join('')}
    </div>
    <p class="filter-empty muted" hidden>In dieser Auswahl gibt es keine Aufgaben.</p>` : '<p class="muted">Für dieses Thema gibt es noch keine Übungen.</p>'}
    <div class="next-step">
      <a class="btn" href="/${fach.id}/${grade.stufe}/${esc(topic.id)}">← Zurück zu Verstehen</a>
      ${nextTopic ? `<a class="btn primary" href="/${fach.id}/${grade.stufe}/${esc(nextTopic.id)}">Nächstes Thema: ${esc(nextTopic.titel)} →</a>` : `<a class="btn primary" href="/${fach.id}/${grade.stufe}">Zur Übersicht ${esc(grade.name)} →</a>`}
    </div>`,
  });
}

// ---------------------------------------------------------------- Lehrkräfte: Fortschritt einer Klasse in einem Fach

export function progressMatrix({ fach, grade, students, solvedBy, understoodBy }) {
  if (!grade) return `<p class="muted small">Zu dieser Klasse gibt es keine passende Klassenstufe mit ${esc(fach.fach)}-Inhalten.</p>`;
  const topics = topicsOfGrade(grade);
  if (!topics.length) return `<p class="muted small">Für ${esc(grade.name)} gibt es noch keine Themen.</p>`;
  const empty = new Set();
  return `
    <h3>${esc(fach.fach)} · ${esc(grade.name)}</h3>
    <p class="small muted">Prozent = gelöste Übungen des Themas, ✓ = „Verstanden“ markiert.</p>
    <div class="table-wrap">
    <table class="matrix heat">
      <thead><tr><th>Schüler/in</th>${topics.map(t => `<th title="${esc(t.titel)}"><span>${esc(t.titel)}</span></th>`).join('')}<th>Gesamt</th></tr></thead>
      <tbody>
      ${students.map(s => {
        const solved = solvedBy.get(s.id) || empty, und = understoodBy.get(s.id) || empty;
        const gp = gradeProgress(grade, solved, und);
        return `<tr><td>${esc(s.name || s.username)}</td>${topics.map(t => {
          const p = topicProgress(t, solved, und);
          return `<td style="--p:${p.prozent}" title="${esc(t.titel)}: ${p.done}/${p.total}${p.verstanden ? ', verstanden' : ''}">${p.done ? p.prozent + ' %' : '–'}${p.verstanden ? ' ✓' : ''}</td>`;
        }).join('')}<td><b>${gp.prozent} %</b></td></tr>`;
      }).join('') || `<tr><td colspan="${topics.length + 2}" class="muted">Aus dieser Klasse hat sich noch niemand angemeldet.</td></tr>`}
      </tbody>
    </table></div>`;
}
