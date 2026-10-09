// Lädt die Fächer aus content/<fach>/ (z. B. content/physik, content/timp) und baut daraus die Lernstruktur:
//
//   Fach ─ Klassenstufe ─┬─ Themenfeld (aus dem SchiC, z. B. „3.6 Elektrische Stromstärke …“)
//                 │    └─ Thema ─┬─ Lernziele
//                 │              ├─ Verstehen: Erklärung, Formeln, interaktive Erklärungen (lessons/)
//                 │              └─ Üben: Übungen (Typen siehe src/exercises.js)
//
// Ordner:  content/<fach>/stufen.json                                    (Name des Fachs, Klassenstufen)
//          content/<fach>/klasse-9/<themenfeld-ordner>/themenfeld.json
//          content/<fach>/klasse-9/<themenfeld-ordner>/<thema>.json   (ein Thema pro Datei)
//
// Ein Fach ist jeder Ordner unter content/ mit einer stufen.json. Der Ordnername ist die Adresse
// (content/timp → /timp). Eine Klassenstufe erscheint, sobald es für sie mindestens ein Themenfeld gibt.
// Themen- und Übungs-IDs müssen über alle Fächer eindeutig sein (der Fortschritt wird über sie gespeichert).
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { validateExercise, DIFFICULTIES } from './exercises.js';

const ID = /^[a-z0-9][a-z0-9-]*$/;
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

const RESERVED = new Set(['admin', 'api', 'auth', 'inhalt', 'lektion', 'static']);

/**
 * Lädt ein Fach. `shared` (optional) sind die IDs-Tabellen aller Fächer, damit IDs fachübergreifend eindeutig bleiben.
 */
export function loadContent(dir = path.join(config.contentDir, 'physik'), shared = null) {
  const errors = shared?.errors || [];
  const err = (file, msg) => errors.push(`${path.relative(config.contentDir, file) || file}: ${msg}`);
  const id = path.basename(dir);
  const content = {
    id, fach: id, kurz: '', beschreibung: '', quelle: '', reihenfolge: 100, stufen: [],
    topicById: shared?.topicById || new Map(), exerciseById: shared?.exerciseById || new Map(), errors,
  };

  const stufenFile = path.join(dir, 'stufen.json');
  let stufen = [];
  try {
    const s = readJson(stufenFile);
    Object.assign(content, { fach: s.fach || id, kurz: s.kurz || s.fach || id, beschreibung: s.beschreibung || '', quelle: s.quelle || '', reihenfolge: s.reihenfolge ?? 100 });
    stufen = s.stufen || [];
  } catch (e) { err(stufenFile, e.code === 'ENOENT' ? 'fehlt' : e.message); }

  for (const st of stufen) {
    const stufe = { stufe: Number(st.stufe), name: st.name || `Klasse ${st.stufe}`, themenfelder: [] };
    const sdir = path.join(dir, `klasse-${stufe.stufe}`);
    if (fs.existsSync(sdir)) {
      for (const tfName of fs.readdirSync(sdir).sort()) {
        const tfDir = path.join(sdir, tfName);
        const tfFile = path.join(tfDir, 'themenfeld.json');
        if (!fs.statSync(tfDir).isDirectory() || tfName.startsWith('_')) continue;
        let tf;
        try { tf = readJson(tfFile); } catch (e) { err(tfFile, e.code === 'ENOENT' ? 'fehlt' : e.message); continue; }
        const themenfeld = {
          id: tfName, stufe: stufe.stufe, nummer: tf.nummer || '', titel: tf.titel || tfName,
          beschreibung: tf.beschreibung || '', inhalte: tf.inhalte || [], erweiterung: tf.erweiterung || '',
          reihenfolge: tf.reihenfolge ?? 100, topics: [],
        };
        for (const f of fs.readdirSync(tfDir).sort()) {
          if (!f.endsWith('.json') || f === 'themenfeld.json' || f.startsWith('_')) continue;
          const file = path.join(tfDir, f);
          let t;
          try { t = readJson(file); } catch (e) { err(file, e.message); continue; }
          if (!ID.test(t.id || '')) { err(file, '"id" fehlt oder ungültig'); continue; }
          if (content.topicById.has(t.id)) { err(file, `Thema-ID "${t.id}" gibt es doppelt`); continue; }
          const topic = {
            id: t.id, fach: id, stufe: stufe.stufe, themenfeldId: themenfeld.id, themenfeldTitel: themenfeld.titel,
            titel: t.titel || t.id, kurz: t.kurz || '', reihenfolge: t.reihenfolge ?? 100,
            lernziele: Array.isArray(t.lernziele) ? t.lernziele : [],
            verstehen: t.verstehen || {}, interaktiv: t.interaktiv || [], vertiefung: t.vertiefung || [],
            uebungen: [],
          };
          const goalIds = new Set(topic.lernziele.map(l => l.id));
          topic.lernziele.forEach((l, i) => { if (!l.id || !l.text) err(file, `Lernziel ${i + 1} braucht "id" und "text"`); });
          for (const ex of t.uebungen || []) {
            const problems = validateExercise(ex);
            if (ex?.lernziel && !goalIds.has(ex.lernziel)) problems.push(`Lernziel "${ex.lernziel}" gibt es in diesem Thema nicht`);
            if (ex?.id && content.exerciseById.has(ex.id)) problems.push('ID gibt es doppelt');
            if (problems.length) { err(file, `Übung ${ex?.id ?? '?'}: ${problems.join('; ')}`); continue; }
            const full = { ...ex, topicId: topic.id, fach: id };
            topic.uebungen.push(full);
            content.exerciseById.set(ex.id, full);
          }
          topic.uebungen.sort((a, b) => DIFFICULTIES.indexOf(a.schwierigkeit) - DIFFICULTIES.indexOf(b.schwierigkeit));
          themenfeld.topics.push(topic);
          content.topicById.set(topic.id, topic);
        }
        themenfeld.topics.sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel, 'de'));
        stufe.themenfelder.push(themenfeld);
      }
    }
    stufe.themenfelder.sort((a, b) => a.reihenfolge - b.reihenfolge || a.nummer.localeCompare(b.nummer, 'de', { numeric: true }));
    content.stufen.push(stufe);
  }
  return content;
}

/** Lädt alle Fächer unter content/. */
export function loadAll(root = config.contentDir) {
  const all = { faecher: [], byId: new Map(), topicById: new Map(), exerciseById: new Map(), errors: [] };
  let dirs = [];
  try { dirs = fs.readdirSync(root).filter(d => !d.startsWith('_') && !d.startsWith('.') && fs.existsSync(path.join(root, d, 'stufen.json'))); }
  catch (e) { all.errors.push(`${root}: ${e.message}`); }
  for (const d of dirs.sort()) {
    if (!ID.test(d) || RESERVED.has(d)) { all.errors.push(`${d}/: Der Ordnername eignet sich nicht als Fach-Adresse (nur a–z, 0–9, -; nicht ${[...RESERVED].join(', ')})`); continue; }
    const f = loadContent(path.join(root, d), all);
    all.faecher.push(f);
    all.byId.set(f.id, f);
  }
  all.faecher.sort((a, b) => a.reihenfolge - b.reihenfolge || a.fach.localeCompare(b.fach, 'de'));
  return all;
}

// Kurzer Cache: Änderungen an den Dateien sind nach wenigen Sekunden sichtbar (auch per update.sh).
let cache = null, cacheTime = 0;
export function content() {
  if (cache && Date.now() - cacheTime < 5000) return cache;
  const fresh = loadAll();
  if (fresh.errors.length && (!cache || fresh.errors.join() !== cache.errors.join())) {
    console.warn(`⚠  Fehler in den Inhalten (diese Teile werden übersprungen):\n   ${fresh.errors.join('\n   ')}`);
  }
  cache = fresh; cacheTime = Date.now();
  return cache;
}

/** Klassenstufen eines Fachs, für die es Inhalte gibt. */
export const visibleGrades = fach => fach.stufen.filter(s => s.themenfelder.length);
export const getGrade = (fach, n) => visibleGrades(fach).find(s => s.stufe === Number(n));
/** Fächer mit mindestens einer sichtbaren Klassenstufe. */
export const visibleFaecher = () => content().faecher.filter(f => visibleGrades(f).length);
export const getFach = id => visibleFaecher().find(f => f.id === id);

export { gradeOf, topicsOfGrade, topicProgress, gradeProgress } from './progress.js';
