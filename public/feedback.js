// Feedback-Seite im Browser: Vorschau des E-Mail-Texts, Diagnosedaten nur mit Häkchen, Senden über den Server
// oder Vorbereiten im eigenen E-Mail-Programm (mailto). Die Seite selbst kommt aus src/feedback.js.
import { pruefeFeedback, mailText, mailtoHref, sammleDiagnose } from './feedback-kern.js';

export function initFeedback() {
  const form = document.getElementById('feedback-form');
  if (!form || form.dataset.bereit) return;
  form.dataset.bereit = '1';
  const $ = id => document.getElementById(id);
  const an = form.dataset.an, seitenName = form.dataset.seitenname || 'Lernseite';
  let modus = form.dataset.modus;
  let absender = null;
  try { absender = form.dataset.absender ? JSON.parse(form.dataset.absender) : null; } catch (e) { absender = null; }
  // Diagnose beim Öffnen der Seite erfassen – so stehen die Fehler der vorherigen Seite drin, nicht die dieser
  const diagnose = sammleDiagnose(window, '');
  let letzterText = '';

  function eingabe() {
    const fd = new FormData(form);
    const kontakt = form.querySelector('[name=kontakt]');
    return {
      kategorie: fd.get('kategorie'), betreff: fd.get('betreff'), beschreibung: fd.get('beschreibung'), seite: fd.get('seite'),
      kontakt: !!(kontakt && kontakt.checked),
      diagnose: $('fb-diagnose').checked ? Object.assign({}, diagnose, { seite: String(fd.get('seite') || '') }) : null,
    };
  }
  function text(daten) {
    const mitAbsender = modus === 'server' && daten.kontakt && absender;
    return mailText(daten, { absender: mitAbsender ? absender : null, seitenName });
  }
  function vorschau() {
    const d = pruefeFeedback(eingabe(), { kontaktErlaubt: !!absender }).daten;
    const v = text(Object.assign({}, d, {
      kategorie: d.kategorie || '(bitte wählen)', betreff: d.betreff || '(Betreff fehlt noch)', beschreibung: d.beschreibung || '(Beschreibung fehlt noch)',
    }));
    $('fb-text').textContent = `Betreff: ${v.betreff}\n\n${v.text}`;
  }
  function zeigeFehler(liste) {
    const f = $('fb-fehler');
    f.hidden = !liste.length;
    f.innerHTML = '';
    if (!liste.length) return;
    if (liste.length === 1) f.textContent = liste[0];
    else { const ul = document.createElement('ul'); liste.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); f.appendChild(ul); }
    f.setAttribute('tabindex', '-1');
    f.focus();
  }
  function mailtoZeigen(daten) {
    const v = mailText(daten, { absender: null, seitenName });
    letzterText = v.text;
    const m = mailtoHref(an, v.betreff, v.text);
    $('fb-mailto-link').href = m.href;
    $('fb-gekuerzt').hidden = !m.gekuerzt;
    $('fb-mailto').hidden = false;
    $('fb-mailto-link').focus();
  }

  form.addEventListener('input', vorschau);
  form.addEventListener('change', vorschau);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const r = pruefeFeedback(eingabe(), { kontaktErlaubt: !!absender });
    zeigeFehler(r.fehler);
    if (!r.ok) return;
    if (modus !== 'server') { mailtoZeigen(r.daten); return; }
    const knopf = form.querySelector('button[type=submit]');
    knopf.disabled = true; knopf.textContent = 'Wird gesendet …';
    try {
      const antwort = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.daten) });
      const d = await antwort.json().catch(() => ({}));
      if (antwort.ok && d.ok) {
        form.hidden = true;
        $('fb-danke').hidden = false;
        $('fb-danke').focus();
        return;
      }
      if (d.mailto) {   // Versand über den Server gerade nicht möglich → eigenes E-Mail-Programm
        modus = 'mailto';
        zeigeFehler([d.error || 'Der Versand über die Lernseite klappt gerade nicht. Du kannst die E-Mail aber selbst verschicken.']);
        mailtoZeigen(r.daten);
        return;
      }
      zeigeFehler([d.error || 'Das Senden hat nicht geklappt. Bitte versuche es später noch einmal.']);
    } catch (e) {
      modus = 'mailto';
      zeigeFehler(['Keine Verbindung zum Server. Du kannst die E-Mail stattdessen selbst verschicken.']);
      mailtoZeigen(r.daten);
    } finally {
      knopf.disabled = false; knopf.textContent = 'Feedback senden';
    }
  });

  $('fb-kopieren').addEventListener('click', async () => {
    const t = letzterText;
    let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {
      // Ohne Zwischenablage-Rechte: Text markieren, damit man ihn selbst kopieren kann
      const pre = $('fb-text'), sel = window.getSelection(), range = document.createRange();
      $('fb-vorschau').open = true; range.selectNodeContents(pre); sel.removeAllRanges(); sel.addRange(range);
    }
    $('fb-kopiert').textContent = ok ? 'Kopiert.' : 'Text ist markiert – kopiere ihn mit Strg+C.';
  });
  $('fb-neu').addEventListener('click', () => {
    form.reset(); form.hidden = false; $('fb-danke').hidden = true; $('fb-mailto').hidden = true; zeigeFehler([]); vorschau();
    form.querySelector('input[name=kategorie]').focus();
  });
  vorschau();
}

initFeedback();
