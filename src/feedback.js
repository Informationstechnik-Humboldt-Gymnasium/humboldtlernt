// Feedback-Seite (/feedback): Fehler melden, Inhalte korrigieren, Ideen vorschlagen.
// Wird vom Server und von der Testseite benutzt (darum nur reine Funktionen, die HTML liefern).
// Zwei Arten zu senden:
//   modus 'server'  – angemeldet und SMTP eingerichtet: Der Server schickt die E-Mail (POST /api/feedback).
//   modus 'mailto'  – sonst (auch auf der Testseite): Die Seite bereitet die E-Mail vor, verschickt wird sie mit dem
//                     eigenen E-Mail-Programm (z. B. IServ-Mail). Der Text lässt sich auch kopieren.
// Die Bedienung im Browser steckt in public/feedback.js, Prüfung und E-Mail-Text in public/feedback-kern.js.
import { esc } from './markup.js';
import { KATEGORIEN, GRENZEN } from '../public/feedback-kern.js';

/** Nur interne Pfade als „Seite, um die es geht“ übernehmen. */
export function feedbackVon(von) {
  const v = String(von || '');
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/feedback') ? v.slice(0, GRENZEN.seite) : '';
}

/**
 * modus: 'server' | 'mailto'; empfaenger: E-Mail-Adresse; absender: { name, email, rolle, klasse } nur wenn angemeldet
 * und der Server die Adresse mitschicken darf; von: Pfad der Seite, von der man kam; seitenName: für den Betreff.
 */
export function feedbackBody({ modus, empfaenger, absender = null, von = '', seitenName = 'Lernseite', hinweis = '' }) {
  const seite = feedbackVon(von);
  const kontakt = modus === 'server' && absender && absender.email;
  return `
    <article class="feedback">
      <header class="page-head">
        <h1>Feedback</h1>
        <p class="muted">Hast du einen Fehler gefunden, stimmt eine Aufgabe nicht oder hast du eine Idee? Schreib es hier auf – jede Rückmeldung hilft, die Lernseite besser zu machen.</p>
      </header>
      ${hinweis ? `<p class="notice">${esc(hinweis)}</p>` : ''}
      <form id="feedback-form" class="panel fb-form" novalidate data-modus="${esc(modus)}" data-an="${esc(empfaenger)}" data-seitenname="${esc(seitenName)}"
        ${kontakt ? `data-absender="${esc(JSON.stringify(absender))}"` : ''}>
        <fieldset class="fb-arten">
          <legend>Worum geht es?</legend>
          ${KATEGORIEN.map((k, i) => `
          <label class="fb-art">
            <input type="radio" name="kategorie" value="${esc(k.id)}" ${i === 0 ? 'required' : ''}>
            <span><b>${esc(k.name)}</b><small>${esc(k.hilfe)}</small></span>
          </label>`).join('')}
        </fieldset>

        <label class="fb-feld" for="fb-betreff">Betreff</label>
        <input id="fb-betreff" name="betreff" maxlength="${GRENZEN.betreff}" required autocomplete="off" placeholder="z. B. Übung 3 zum ohmschen Gesetz zählt richtige Antwort als falsch">

        <label class="fb-feld" for="fb-beschreibung">Beschreibung</label>
        <textarea id="fb-beschreibung" name="beschreibung" rows="7" maxlength="${GRENZEN.beschreibung}" required aria-describedby="fb-tipp"></textarea>
        <p class="small muted" id="fb-tipp">Bei Fehlern hilft: Was hast du gemacht? Was ist passiert? Was hättest du erwartet? Schreib bitte keine Passwörter oder Angaben über andere Personen hinein.</p>

        <label class="fb-feld" for="fb-seite">Seite, um die es geht <span class="small muted">(optional)</span></label>
        <input id="fb-seite" name="seite" maxlength="${GRENZEN.seite}" value="${esc(seite)}" autocomplete="off" placeholder="z. B. /physik/9/k9-ohmsches-gesetz/ueben">

        <div class="fb-optionen">
          <label class="fb-check"><input type="checkbox" name="diagnose" id="fb-diagnose">
            <span><b>Diagnosedaten mitschicken</b> <span class="small muted">– empfohlen bei Fehlern</span><br>
            <span class="small muted">Technische Angaben zu Browser, Bildschirm und den letzten Fehlermeldungen dieser Seite. Keine Antworten, kein Lernstand, keine Passwörter.</span></span>
          </label>
          ${kontakt ? `
          <label class="fb-check"><input type="checkbox" name="kontakt" id="fb-kontakt">
            <span><b>Meinen Namen und meine E-Mail-Adresse mitschicken</b><br>
            <span class="small muted">Dann kann man dir antworten (${esc(absender.name || '')}, ${esc(absender.email)}). Ohne Häkchen kommt dein Feedback ohne Namen an.</span></span>
          </label>` : ''}
        </div>

        <details class="fb-vorschau" id="fb-vorschau">
          <summary>Vorschau: genau dieser Text wird verschickt</summary>
          <pre id="fb-text" tabindex="0" aria-label="Vorschau der E-Mail"></pre>
        </details>

        <p class="alert" id="fb-fehler" role="alert" hidden></p>
        ${modus === 'server' ? `
        <div class="fb-knoepfe"><button type="submit" class="btn primary">Feedback senden</button>
          <span class="small muted">An: ${esc(empfaenger)}</span></div>` : `
        <div class="fb-knoepfe"><button type="submit" class="btn primary">E-Mail vorbereiten</button></div>
        <p class="small muted">Die Nachricht wird mit deinem eigenen E-Mail-Programm verschickt (zum Beispiel IServ-Mail) an <a href="mailto:${esc(empfaenger)}">${esc(empfaenger)}</a>. Der Empfänger sieht dabei deine E-Mail-Adresse.</p>`}
        <div class="fb-mailto" id="fb-mailto" hidden>
          <p><b>Fast geschafft:</b> Öffne die E-Mail in deinem E-Mail-Programm und schicke sie dort ab. Klappt das nicht, kopiere den Text und schicke ihn an <b>${esc(empfaenger)}</b>.</p>
          <p class="small hinweis" id="fb-gekuerzt" hidden>Der Text ist für den direkten Link zu lang und wurde dort gekürzt. Bitte kopiere den vollständigen Text und füge ihn in die E-Mail ein.</p>
          <div class="fb-knoepfe"><a class="btn primary" id="fb-mailto-link" href="mailto:${esc(empfaenger)}">Im E-Mail-Programm öffnen</a>
            <button type="button" class="btn" id="fb-kopieren">Text kopieren</button><span class="small muted" id="fb-kopiert" role="status"></span></div>
        </div>
      </form>
      <section class="panel fb-danke" id="fb-danke" hidden tabindex="-1" aria-labelledby="fb-danke-titel">
        <h2 id="fb-danke-titel">Danke für dein Feedback!</h2>
        <p>Deine Nachricht ist verschickt. Wir schauen sie uns an.</p>
        <div class="fb-knoepfe">${seite ? `<a class="btn" href="${esc(seite)}">Zurück zur Seite</a>` : `<a class="btn" href="/">Zur Startseite</a>`}
          <button type="button" class="btn" id="fb-neu">Noch etwas melden</button></div>
      </section>
      <p class="small muted">Was mit deinen Angaben passiert, steht in der <a href="/datenschutz#feedback">Datenschutzerklärung</a>.</p>
    </article>`;
}
