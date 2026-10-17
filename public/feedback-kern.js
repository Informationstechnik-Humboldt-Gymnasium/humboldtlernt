// Feedback (Fehler melden, Ideen vorschlagen) – gemeinsamer Kern für Browser, Server und Testseite.
// Keine Abhängigkeiten, kein DOM außer in sammleDiagnose(win). Der Server prüft mit denselben Regeln wie der Browser,
// verlässt sich aber nie auf die Prüfung im Browser.
//
// Datenschutz: Diagnosedaten werden nur mitgeschickt, wenn die Person das Häkchen setzt, und sie sieht vorher genau
// den Text, der verschickt wird. Name und E-Mail-Adresse nur mit eigenem Häkchen. Es werden keine Eingaben aus
// Übungen, kein Lernstand und keine Inhalte aus dem Browser-Speicher mitgeschickt.

export const KATEGORIEN = [
  { id: 'fehler', name: 'Fehler melden', hilfe: 'Etwas funktioniert nicht, sieht kaputt aus oder lädt nicht.' },
  { id: 'inhalt', name: 'Inhalt falsch', hilfe: 'Eine Aufgabe, Lösung oder Erklärung stimmt fachlich nicht.' },
  { id: 'idee', name: 'Idee oder Wunsch', hilfe: 'Ein neues Thema, eine Simulation oder eine Verbesserung.' },
  { id: 'sonstiges', name: 'Sonstiges', hilfe: 'Lob, Fragen und alles andere.' },
];

/** Erlaubte Diagnosefelder (alles andere wird verworfen) mit Beschriftung in der E-Mail. */
export const DIAG_FELDER = [
  ['zeit', 'Zeitpunkt (Browser)'], ['seite', 'Seite'], ['browser', 'Browser'], ['sprache', 'Sprache'],
  ['bildschirm', 'Bildschirm'], ['fenster', 'Fenstergröße'], ['pixel', 'Pixelverhältnis'], ['farbschema', 'Farbschema'],
  ['bewegung', 'Weniger Bewegung'], ['touch', 'Touch'], ['webgl', 'WebGL (3D)'], ['speicher', 'Browser-Speicher'],
  ['online', 'Online'], ['zeitzone', 'Zeitzone'], ['fehler', 'Letzte Fehlermeldungen der Seite'],
];

export const GRENZEN = { betreff: 120, beschreibung: 4000, seite: 200, diagWert: 300, diagFehler: 1600, beschreibungMin: 10 };

/** Schlüssel im sessionStorage für das Fehlerprotokoll (siehe FEHLERPROTOKOLL und public/lesson-kit.js). */
export const FEHLER_SCHLUESSEL = 'lernseite-fehler';

/**
 * Kleines Skript für jede Seite: merkt sich die letzten JavaScript-Fehler im sessionStorage dieses Tabs
 * (Uhrzeit, Seite, Meldung, Dateiname, Zeile – keine Eingaben). Wird beim Schließen des Tabs gelöscht.
 */
export const FEHLERPROTOKOLL = "(function(){var k='" + FEHLER_SCHLUESSEL + "';function m(t,d,l){try{var a=JSON.parse(sessionStorage.getItem(k)||'[]');" +
  "a.push({z:new Date().toTimeString().slice(0,8),s:(location.pathname+location.hash).slice(0,120),m:String(t||'').slice(0,200),d:String(d||'').split('/').pop().split('?')[0].slice(0,60),l:l||0});" +
  "sessionStorage.setItem(k,JSON.stringify(a.slice(-8)))}catch(e){}}window.addEventListener('error',function(e){m(e.message,e.filename,e.lineno)});" +
  "window.addEventListener('unhandledrejection',function(e){var r=e.reason;m('Promise: '+(r&&r.message?r.message:r),'',0)})})();";

const STEUERZEICHEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const text = (v, max) => String(v ?? '').replace(STEUERZEICHEN, '').trim().slice(0, max);
const zeile = (v, max) => text(v, max).replace(/[\r\n\u2028\u2029]+/g, ' ');

/**
 * Eingaben prüfen und säubern. kontaktErlaubt: Darf überhaupt ein Absender mitgeschickt werden (nur angemeldet)?
 * Liefert { ok, fehler: [Text], daten: { kategorie, betreff, beschreibung, seite, kontakt, diagnose|null } }.
 */
export function pruefeFeedback(eingabe, { kontaktErlaubt = false } = {}) {
  const e = eingabe && typeof eingabe === 'object' ? eingabe : {};
  const fehler = [];
  const kategorie = KATEGORIEN.some(k => k.id === e.kategorie) ? e.kategorie : null;
  if (!kategorie) fehler.push('Bitte wähle aus, worum es geht.');
  const betreff = zeile(e.betreff, GRENZEN.betreff);
  if (!betreff) fehler.push('Bitte gib einen kurzen Betreff ein.');
  const beschreibung = text(e.beschreibung, GRENZEN.beschreibung).replace(/\r\n?/g, '\n');
  if (beschreibung.length < GRENZEN.beschreibungMin) fehler.push(`Bitte beschreibe es etwas genauer (mindestens ${GRENZEN.beschreibungMin} Zeichen).`);
  const seite = zeile(e.seite, GRENZEN.seite);
  let diagnose = null;
  if (e.diagnose && typeof e.diagnose === 'object') {
    diagnose = {};
    for (const [k] of DIAG_FELDER) {
      if (e.diagnose[k] === undefined || e.diagnose[k] === null || e.diagnose[k] === '') continue;
      diagnose[k] = k === 'fehler' ? text(e.diagnose[k], GRENZEN.diagFehler) : zeile(e.diagnose[k], GRENZEN.diagWert);
    }
    if (!Object.keys(diagnose).length) diagnose = null;
  }
  return { ok: !fehler.length, fehler, daten: { kategorie, betreff, beschreibung, seite, kontakt: kontaktErlaubt && e.kontakt === true, diagnose } };
}

export const kategorieName = id => (KATEGORIEN.find(k => k.id === id) || { name: id }).name;

/**
 * Text der E-Mail. absender: { name, email, rolle, klasse } oder null; extra: zusätzliche Zeilen vom Server
 * (z. B. Rolle ohne Namen, Serverzeit) als [[Beschriftung, Wert]].
 */
export function mailText(daten, { absender = null, extra = [], seitenName = 'Lernseite' } = {}) {
  const betreff = `[${seitenName} · Feedback] ${kategorieName(daten.kategorie)}: ${daten.betreff}`.replace(/[\r\n]+/g, ' ');
  const z = [];
  z.push(`Art: ${kategorieName(daten.kategorie)}`);
  z.push(`Betreff: ${daten.betreff}`);
  if (daten.seite) z.push(`Seite: ${daten.seite}`);
  z.push('', 'Beschreibung:', daten.beschreibung, '');
  if (absender) z.push(`Absender (freigegeben): ${absender.name || '–'} <${absender.email || 'keine E-Mail'}>${absender.rolle ? `, ${absender.rolle}` : ''}${absender.klasse ? `, Klasse ${absender.klasse}` : ''}`);
  else z.push('Absender: nicht angegeben (anonym)');
  for (const [k, v] of extra) z.push(`${k}: ${v}`);
  if (daten.diagnose) {
    z.push('', '--- Diagnosedaten (vom Absender freigegeben) ---');
    for (const [k, label] of DIAG_FELDER) {
      if (daten.diagnose[k] === undefined) continue;
      if (k === 'fehler') z.push(`${label}:`, daten.diagnose[k]);
      else z.push(`${label}: ${daten.diagnose[k]}`);
    }
  } else z.push('', 'Diagnosedaten: nicht mitgeschickt');
  return { betreff, text: z.join('\n') };
}

/**
 * mailto-Link für den Fall ohne Mailversand über den Server. Lange Texte werden gekürzt (manche Mailprogramme
 * öffnen sehr lange Links nicht) – dann steht ein Hinweis im Text, und die Seite bietet „Text kopieren“ an.
 */
export function mailtoHref(an, betreff, inhalt, maxLaenge = 1900) {
  const basis = `mailto:${an}?subject=${encodeURIComponent(betreff)}&body=`;
  let body = encodeURIComponent(inhalt), gekuerzt = false;
  if (basis.length + body.length > maxLaenge) {
    const hinweis = '\n\n[… gekürzt – bitte den kopierten Text hier einfügen]';
    let n = inhalt.length;
    do { n = Math.floor(n * 0.85); body = encodeURIComponent(inhalt.slice(0, n) + hinweis); } while (basis.length + body.length > maxLaenge && n > 0);
    gekuerzt = true;
  }
  return { href: basis + body, gekuerzt };
}

/** Diagnosedaten im Browser sammeln (nur technische Angaben, keine Inhalte). */
export function sammleDiagnose(win, seite) {
  const nav = win.navigator || {}, scr = win.screen || {};
  const mm = q => { try { return !!(win.matchMedia && win.matchMedia(q).matches); } catch (e) { return false; } };
  let webgl = 'nein';
  try { const c = win.document.createElement('canvas'); webgl = c.getContext('webgl2') ? 'ja (WebGL 2)' : c.getContext('webgl') ? 'ja (WebGL 1)' : 'nein'; } catch (e) { webgl = 'nein'; }
  let speicher = 'nicht verfügbar';
  try { win.localStorage.setItem('lernseite-probe', '1'); win.localStorage.removeItem('lernseite-probe'); speicher = 'verfügbar'; } catch (e) { /* gesperrt */ }
  let fehler = [];
  try { fehler = JSON.parse(win.sessionStorage.getItem(FEHLER_SCHLUESSEL) || '[]'); } catch (e) { fehler = []; }
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { zone = ''; }
  return {
    zeit: new Date().toISOString(),
    seite: seite || '',
    browser: nav.userAgent || '',
    sprache: nav.language || '',
    bildschirm: scr.width ? `${scr.width} × ${scr.height}` : '',
    fenster: `${win.innerWidth} × ${win.innerHeight}`,
    pixel: String(win.devicePixelRatio || 1),
    farbschema: mm('(prefers-color-scheme: dark)') ? 'dunkel' : 'hell',
    bewegung: mm('(prefers-reduced-motion: reduce)') ? 'ja' : 'nein',
    touch: (nav.maxTouchPoints || 0) > 0 ? `ja (${nav.maxTouchPoints} Punkte)` : 'nein',
    webgl,
    speicher,
    online: nav.onLine === false ? 'nein' : 'ja',
    zeitzone: zone,
    fehler: Array.isArray(fehler) && fehler.length
      ? fehler.slice(-8).map(f => `${f.z || ''} ${f.s || ''} – ${f.m || ''}${f.d ? ` (${f.d}:${f.l || 0})` : ''}`).join('\n')
      : 'keine',
  };
}
