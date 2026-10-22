// Impressum und Datenschutzerklärung (/impressum, /datenschutz, ohne Anmeldung erreichbar).
// Die Angaben zur verantwortlichen Person stehen in content/impressum.json.
// Die Texte beschreiben, was die Lernseite tatsächlich speichert – bei Änderungen an src/db.js,
// der IServ-Anmeldung, den Cookies oder dem Feedback (src/feedback.js, public/feedback-kern.js) bitte hier mitändern.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { esc } from './markup.js';

export const IMPRESSUM_FELDER = ['name', 'strasse', 'ort', 'email'];

/** Angaben aus content/impressum.json (fehlende Datei → leere Angaben). */
export function ladeImpressum() {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(config.contentDir, 'impressum.json'), 'utf8'));
    return { name: '', strasse: '', ort: '', email: '', telefon: '', stand: '', ...d };
  } catch {
    return { name: '', strasse: '', ort: '', email: '', telefon: '', stand: '' };
  }
}

/** Welche Pflichtangaben fehlen noch? */
export const impressumFehlt = d => IMPRESSUM_FELDER.filter(k => !String(d[k] || '').trim());

const feld = v => (String(v || '').trim() ? esc(v) : '<span class="fehlt">wird ergänzt</span>');
const adresse = d => `${feld(d.name)}<br>${feld(d.strasse)}<br>${feld(d.ort)}`;
const mail = d => (String(d.email || '').trim() ? `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>` : feld(''));

export function impressumBody(d) {
  return `
    <article class="recht">
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>${adresse(d)}</p>
      <h2>Kontakt</h2>
      <p>${String(d.telefon || '').trim() ? `Telefon: ${esc(d.telefon)}<br>` : ''}E-Mail: ${mail(d)}</p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>${adresse(d)}</p>
      <div class="recht-hinweis">
        <p><strong>Hinweis zum Schulprojekt:</strong> Diese Website wurde im Rahmen eines Schulprojekts zu Bildungszwecken erstellt. Das Angebot ist komplett kostenlos, werbefrei und verfolgt keinerlei kommerzielle Interessen.</p>
        <p>Die Strukturierung der Themen orientiert sich am Schulinternen Curriculum (SchiC) der Schule. Alle Übungsaufgaben wurden selbstständig erstellt.</p>
      </div>
      <p class="small muted"><a href="/datenschutz">Zur Datenschutzerklärung</a></p>
    </article>`;
}

/** feedbackAn: Empfänger der Feedback-Seite (content/feedback.json bzw. FEEDBACK_AN). */
export function datenschutzBody(d, { feedbackAn = '' } = {}) {
  const fbMail = String(feedbackAn || '').trim() ? `<a href="mailto:${esc(feedbackAn)}">${esc(feedbackAn)}</a>` : 'die oben genannte Kontaktadresse';
  return `
    <article class="recht">
      <h1>Datenschutzerklärung</h1>
      ${d.stand ? `<p class="muted">Stand: ${esc(d.stand)}</p>` : ''}

      <h2>1. Wer ist verantwortlich?</h2>
      <p>${adresse(d)}<br>E-Mail: ${mail(d)}</p>
      <p>Wir nehmen den Schutz deiner persönlichen Daten ernst und behandeln sie vertraulich, nach der Datenschutz-Grundverordnung (DSGVO) und dieser Datenschutzerklärung.</p>

      <h2>2. Das Wichtigste in Kürze</h2>
      <ul>
        <li>Die Lernseite ist ein kostenloses Schulprojekt ohne Werbung.</li>
        <li>Es gibt <strong>keine</strong> Tracking-, Analyse- oder Werbedienste und keine Inhalte von fremden Servern (keine externen Schriftarten, Videos oder Skripte).</li>
        <li>Alle Daten werden ausschließlich auf dem schuleigenen Server verarbeitet, auf dem die Lernseite läuft. Es werden keine Daten an externe Server oder Drittanbieter übertragen. Einzige Ausnahme: Feedback, das du selbst abschickst, geht per E-Mail an die Betreuer der Lernseite (siehe 7).</li>
        <li>Dein IServ-Passwort bekommt die Lernseite nie zu sehen.</li>
      </ul>

      <h2>3. Anmeldung über IServ</h2>
      <p>Du meldest dich mit dem IServ-Konto deiner Schule an (Verfahren OAuth 2.0 / OpenID Connect). Dabei wirst du auf die Anmeldeseite deines IServ weitergeleitet und gibst dein Passwort nur dort ein. Nach der Anmeldung übermittelt IServ an die Lernseite:</p>
      <ul>
        <li><strong>Benutzername und Name</strong> – damit dein Konto eindeutig ist und du begrüßt werden kannst,</li>
        <li><strong>E-Mail-Adresse</strong> – zur Zuordnung zu deiner Klasse (siehe 4.),</li>
        <li><strong>IServ-Rollen bzw. -Gruppen</strong> – um festzustellen, ob du Schüler/in oder Lehrkraft bist und ob du Verwaltungsrechte auf der Lernseite hast.</li>
      </ul>

      <h2>4. Welche Daten speichert die Lernseite?</h2>
      <ul>
        <li><strong>Dein Konto:</strong> Benutzername, Name, E-Mail-Adresse, Rolle (Schüler/in, Lehrkraft oder Admin), Klasse, die von IServ übermittelten Rollen sowie Zeitpunkt der ersten und letzten Anmeldung.</li>
        <li><strong>Schülerliste:</strong> Die Klasse stammt aus einer Schülerliste (E-Mail-Adresse, Name, Klasse), die ein Admin der Lernseite hochlädt. Sie dient dazu, dir die Inhalte deiner Klassenstufe zu zeigen und gegebenenfalls nur Schülerinnen und Schülern der Liste den Zugang zu erlauben.</li>
        <li><strong>Lernfortschritt:</strong> welche Lerneinheiten du als erledigt markiert hast, welche Themen du als „verstanden“ markiert hast, und zu jeder bearbeiteten Übung jeder Versuch mit Zeitpunkt, Ergebnis (richtig/falsch, Lösung angezeigt) und deiner eingegebenen Antwort.</li>
      </ul>
      <p>Die Lernseite selbst speichert keine IP-Adressen. Deine IP-Adresse wird nur technisch verwendet, um dir die Seiten auszuliefern.</p>

      <h2>5. Wer kann die Daten sehen?</h2>
      <ul>
        <li><strong>Du</strong> siehst deinen eigenen Lernfortschritt.</li>
        <li><strong>Lehrkräfte</strong> sehen für eine Klasse, wer welche Übungen gelöst, welche Themen als verstanden markiert und welche Lerneinheiten erledigt hat. Deine eingegebenen Antworttexte werden auf der Seite nicht angezeigt.</li>
        <li><strong>Admins der Lernseite</strong> sehen zusätzlich die Schülerliste und die Liste der angemeldeten Konten.</li>
      </ul>
      <p>Daten werden nicht verkauft und nicht an Dritte weitergegeben.</p>

      <h2>6. Cookies und Speicher im Browser</h2>
      <p>Die Lernseite setzt genau ein Cookie („lernseite“). Es enthält nur die Nummer deines Kontos, signiert gegen Fälschung, damit du angemeldet bleibst. Es ist für den Betrieb technisch notwendig, für Skripte nicht lesbar, gilt höchstens 12 Stunden und wird beim Abmelden gelöscht.</p>
      <p>Jede Seite merkt sich die letzten bis zu acht technischen Fehlermeldungen (Uhrzeit, Seite, Meldung, Dateiname und Zeile – keine Eingaben) im Sitzungsspeicher deines Browsers (sessionStorage). Sie bleiben auf deinem Gerät, werden beim Schließen des Tabs gelöscht und nur dann verschickt, wenn du auf der Feedback-Seite „Diagnosedaten mitschicken“ ankreuzt.</p>
      <p>Einige Simulationen in der Sandbox speichern deinen letzten Stand im Speicher deines Browsers (LocalStorage), damit er beim nächsten Öffnen wieder da ist: das <strong>Schaltkreis-Labor</strong> und das <strong>Logik-Labor</strong> deine Schaltung, das <strong>Netzwerk-Labor</strong> dein Netzwerk und welche Lernaufgaben du gelöst hast, der <strong>Molekülbaukasten</strong> im Atom- &amp; Chemielabor dein Molekül und deine gelösten Lernaufgaben. Diese Daten enthalten keine Angaben zu deiner Person, bleiben auf deinem Gerät und werden nicht an den Server übertragen. Du kannst sie löschen, indem du im Labor die Arbeitsfläche leerst bzw. „Neu“ wählst oder die Websitedaten im Browser löschst.</p>
      <p>Die <strong>HTML-Sandbox</strong> speichert deine Projekte (Dateinamen und Code, auch eingefügte Bilder) und deine Einstellungen (Design, Schriftgröße, Aufteilung der Fenster) ebenfalls nur im LocalStorage deines Browsers. Ein Teilen-Link enthält den Code des Projekts hinter dem #-Zeichen der Adresse; dieser Teil wird nicht an den Server geschickt. Wer den Link bekommt, sieht den Code – trage deshalb keine persönlichen Daten in geteilte Projekte ein. Die Vorschau lädt nur, was in deinem Code steht: Trägst du selbst Adressen fremder Server ein (z. B. ein Bild aus dem Internet), lädt dein Browser diese Inhalte von dort. Projekte löschst du im Explorer der Sandbox oder über die Websitedaten im Browser.</p>

      <h2 id="feedback">7. Feedback und Fehlermeldungen</h2>
      <p>Über die Seite „Feedback &amp; Fehler melden“ kannst du freiwillig Fehler melden oder Ideen vorschlagen. Die Nachricht geht per E-Mail an ${fbMail}. Sie enthält:</p>
      <ul>
        <li>was du ausgewählt und geschrieben hast (Art, Betreff, Beschreibung, Seite),</li>
        <li><strong>nur wenn du das Häkchen setzt:</strong> Diagnosedaten – Zeitpunkt, Browser und Betriebssystem (User-Agent), Sprache, Bildschirm- und Fenstergröße, Pixelverhältnis, helles oder dunkles Farbschema, ob „weniger Bewegung“ eingestellt ist, Touch, ob 3D (WebGL) und der Browser-Speicher funktionieren, online, Zeitzone und die letzten Fehlermeldungen (siehe 6),</li>
        <li><strong>nur wenn du das Häkchen setzt:</strong> deinen Namen, deine E-Mail-Adresse, deine Rolle und Klasse, damit man dir antworten kann.</li>
      </ul>
      <p>Vor dem Senden siehst du genau den Text, der verschickt wird. Antworten in Übungen, dein Lernstand und Passwörter werden nie mitgeschickt.</p>
      <p>Bist du angemeldet und hat die Schule den Mailversand eingerichtet, verschickt der Server der Lernseite die E-Mail über das Mailkonto der Schule. Ohne Häkchen kommt die Nachricht dann ohne deinen Namen an. Der Server speichert die Nachricht nicht, er merkt sich nur für eine Stunde im Arbeitsspeicher, wie oft du gesendet hast (Schutz vor Missbrauch). Sonst – oder wenn du nicht angemeldet bist – öffnet die Seite dein eigenes E-Mail-Programm (z. B. IServ-Mail); dann sieht der Empfänger deine E-Mail-Adresse wie bei jeder anderen E-Mail.</p>
      <p>Die Nachrichten werden nur gelesen, um Fehler zu beheben und die Lernseite zu verbessern, und gelöscht, sobald sie erledigt sind, spätestens wenn das Projekt endet. Rechtsgrundlage ist deine Einwilligung durch das Absenden (Art. 6 Abs. 1 lit. a DSGVO).</p>

      <h2>8. Zweck und Rechtsgrundlage</h2>
      <p>Die Daten werden ausschließlich verwendet, um die Funktionen der Lernseite bereitzustellen: Anmeldung, Rechte (Schüler/in, Lehrkraft, Admin), Inhalte passend zur Klassenstufe und das Speichern des Lernfortschritts.</p>
      <p>Die Datenverarbeitung erfolgt auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) im Rahmen des Schulprojekts. Du kannst die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, z. B. per E-Mail an die oben genannte Adresse. Das Anmelde-Cookie ist technisch unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse an einer funktionierenden Website).</p>

      <h2>9. Wie lange werden die Daten gespeichert?</h2>
      <p>Konto und Lernfortschritt bleiben gespeichert, solange das Konto besteht. Auf Wunsch löschen wir dein Konto mit allen Fortschrittsdaten. Wenn das Projekt endet, werden alle Daten gelöscht.</p>

      <h2>10. Deine Rechte</h2>
      <p>Du hast jederzeit das Recht, unentgeltlich Auskunft über deine gespeicherten Daten zu bekommen (Art. 15 DSGVO) und ihre Berichtigung (Art. 16), Löschung (Art. 17) oder Einschränkung der Verarbeitung (Art. 18) zu verlangen. Außerdem hast du das Recht auf Datenübertragbarkeit (Art. 20) und auf Widerspruch (Art. 21). Wende dich dazu einfach an die oben genannte Kontaktadresse.</p>
      <p>Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), in Berlin bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit.</p>
      <p class="small muted"><a href="/impressum">Zum Impressum</a></p>
    </article>`;
}
