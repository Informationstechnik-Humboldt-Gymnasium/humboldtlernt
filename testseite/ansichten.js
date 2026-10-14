// Testseite · Ansichten des Schul-, Rollen- und Aufgabensystems (nur HTML-Bausteine, keine Logik).
// Wird in scripts/build-testseite.mjs in denselben Gültigkeitsbereich wie die Seiten der Lernseite eingebettet
// und nutzt deren Helfer (esc, FAECHER, LESSONS, topicById). Alle Texte aus der Datenbank werden mit esc() ausgegeben.

const SV = (function () {
  const FACH = id => { const f = FAECHER.find(x => x.id === id); return f ? f.kurz : (id || '–'); };
  const TAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  const heute = () => new Date().toISOString().slice(0, 10);
  function datum(x) {
    if (!x) return '–';
    const d = typeof x === 'number' ? new Date(x) : new Date(x + 'T12:00:00');
    return `${TAGE[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }
  function zeit(ms) {
    if (!ms) return '–';
    const d = new Date(ms);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function relativ(iso) {
    if (!iso) return '';
    const t = Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(heute() + 'T12:00:00Z')) / 86400000);
    if (t === 0) return 'heute';
    if (t === 1) return 'morgen';
    if (t === -1) return 'gestern';
    return t > 0 ? `in ${t} Tagen` : `vor ${-t} Tagen`;
  }
  const avatar = (p, gross) => `<span class="avatar${gross ? ' gross' : ''}" style="background:${/^#[0-9a-f]{6}$/i.test(p.farbe || '') ? p.farbe : '#4a5a6a'}" aria-hidden="true">${esc(p.initialen || '?')}</span>`;
  const chip = (t, art) => `<span class="st${art ? ' st-' + art : ''}">${esc(t)}</span>`;
  const STATUS = {
    offen: ['offen', 'info'], in_arbeit: ['in Arbeit', 'info'], zurueckgegeben: ['zur Überarbeitung', 'warn'], ueberfaellig: ['überfällig', 'warn'],
    abgegeben: ['abgegeben', ''], korrigiert: ['korrigiert', 'ok'], kontrolliert: ['kontrolliert', 'ok'],
    aktiv: ['aktiv', 'ok'], gesperrt: ['gesperrt', 'warn'], deaktiviert: ['deaktiviert', ''],
    entwurf: ['Entwurf', ''], veroeffentlicht: ['veröffentlicht', 'ok'], archiviert: ['archiviert', ''],
  };
  const statusChip = s => chip((STATUS[s] || [s])[0], (STATUS[s] || [])[1]);
  const rolleChip = (r, name) => chip(name || r, r === 'admin' ? 'admin' : r === 'teacher' ? 'info' : '');
  const balken = (p, art) => `<span class="bar" role="img" aria-label="${Math.round(p)} Prozent"><span class="${art || ''}" style="width:${Math.max(0, Math.min(100, p))}%"></span></span>`;
  const miniBar = (p, art) => `<span class="mini-bar">${balken(p, art)}<span class="small">${Math.round(p)} %</span></span>`;
  const kachel = (titel, wert, zusatz, art, href) => `<${href ? `a href="${esc(href)}"` : 'div'} class="kachel${art ? ' ' + art : ''}"><span class="titel">${esc(titel)}</span><span class="wert">${esc(wert)}</span>${zusatz ? `<span class="zusatz">${esc(zusatz)}</span>` : ''}</${href ? 'a' : 'div'}>`;
  const leer = t => `<p class="leer">${esc(t)}</p>`;
  const NAV = {
    schueler: [['/aufgaben', 'Meine Aufgaben'], ['/fortschritt', 'Mein Fortschritt'], ['/mitteilungen', 'Mitteilungen']],
    lehrer: [['/lehrer', 'Übersicht'], ['/lehrer/aufgaben', 'Meine Aufgaben'], ['/lehrer/bibliothek', 'Aufgabenbibliothek'], ['/lehrer/statistik', 'Statistik']],
    admin: [['/admin', 'Übersicht'], ['/admin/benutzer', 'Konten'], ['/admin/aufgaben', 'Aufgaben'], ['/admin/schule', 'Klassen & Fächer'], ['/admin/system', 'System'], ['/admin/protokoll', 'Protokoll']],
  };
  const BEREICH = { schueler: 'Schülerbereich', lehrer: 'Lehrerbereich', admin: 'Verwaltung' };
  function kopf(bereich, titel, unter, aktiv, rechts) {
    return `<header class="bereich-kopf ${bereich}"><span class="bereich">${BEREICH[bereich]}</span>
      <div class="head-row"><div><h1>${esc(titel)}</h1>${unter ? `<p class="muted" style="margin:0">${unter}</p>` : ''}</div>${rechts || ''}</div></header>
      <nav class="unternav" aria-label="${BEREICH[bereich]}">${NAV[bereich].map(([h, t]) => `<a href="${h}"${h === aktiv ? ' class="active" aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
  }
  const text = s => `<div class="anweisung">${esc(s)}</div>`;
  function themaHref(id) { const t = topicById.get(id); return t ? `/${t.fach}/${t.stufe}/${t.id}` : null; }
  function materialLink(m) {
    const [art, wert] = String(m).split(/:(.+)/);
    if (art === 'thema') { const t = topicById.get(wert); return t ? { href: themaHref(wert), text: `Thema: ${t.titel}` } : null; }
    if (art === 'lektion') { const l = LESSONS[wert]; return l ? { href: `/lektion/${wert}`, text: `Interaktive Erklärung: ${l.title}` } : null; }
    if (art === 'sandbox') { const s = FAECHER.flatMap(f => f.simulationen || []).find(x => x.id === wert); return { href: `/sandbox/${wert}`, text: `Sandbox: ${s ? s.titel : wert}` }; }
    if (art === 'https') return { href: m, text: m, extern: true };
    return null;
  }
  const materialListe = liste => {
    const l = (liste || []).map(materialLink).filter(Boolean);
    return l.length ? `<ul class="liste">${l.map(m => `<li><a href="${esc(m.href)}"${m.extern ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(m.text)}</a></li>`).join('')}</ul>` : '';
  };
  const fehlerBox = '<p class="alert form-fehler" role="alert" hidden></p>';
  function auswahl(name, optionen, wert, leerText) {
    return `<select name="${name}" id="f-${name}">${leerText !== undefined ? `<option value="">${esc(leerText)}</option>` : ''}${optionen.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(wert ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  }
  const FAECHER_OPT = () => FAECHER.filter(f => f.stufen.length).map(f => [f.id, f.kurz]);
  const SCHWIERIGKEIT = [['leicht', 'leicht'], ['mittel', 'mittel'], ['schwer', 'schwer']];
  const LOESUNG = [['nie', 'nie anzeigen'], ['nach_faelligkeit', 'nach dem Abgabedatum'], ['nach_korrektur', 'nach der Korrektur'], ['sofort', 'sofort']];

  // ================================================================== Anmeldung
  function anmelden(meldung) {
    return `<section class="login">
      <h1>Anmelden</h1>
      <p class="muted">Melde dich mit deinem Schulkonto an, um Aufgaben, Abgaben und deinen Fortschritt zu sehen.</p>
      ${meldung ? `<p class="alert" role="alert">${esc(meldung)}</p>` : ''}
      <button type="button" class="btn primary big voll" id="iserv-start">Mit IServ anmelden</button>
      <p class="small muted" style="margin:0">Testumgebung: Der Login ist <strong>simuliert</strong>. Es wird keine Verbindung zu IServ aufgebaut.</p>
      <div class="oder">oder</div>
      <a class="btn voll" href="/">Ohne Anmeldung ausprobieren (Gastmodus)</a>
      <div class="testkonten-hinweis">
        <strong>Testkonten:</strong> Schüler/innen melden sich ohne Passwort an. Lehrkräfte und Administration brauchen das gemeinsame Testpasswort, das die Projektleitung vergibt – es steht nicht auf dieser Seite.
      </div>
    </section>`;
  }
  const SCHULE_ICON = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 17 20 7l16 10"/><path d="M8 16v17h24V16"/><path d="M17 33v-8h6v8"/><path d="M13 21h3M24 21h3"/></svg>';
  function idp(konten, params, fehler, gewaehlt) {
    const gruppen = [
      ['Schüler/innen', konten.filter(k => k.rolle === 'student')],
      ['Lehrkräfte', konten.filter(k => k.rolle === 'teacher')],
      ['Administration', konten.filter(k => k.rolle === 'admin')],
    ];
    const karte = k => `<label class="konto${k.status !== 'aktiv' ? ' aus' : ''}">
        <input type="radio" name="username" value="${esc(k.username)}" data-passwort="${k.passwort ? 1 : 0}"${k.username === gewaehlt ? ' checked' : ''} required>
        ${avatar(k)}<span><strong>${esc(k.name)}</strong><small>${esc(k.klasse || k.funktion || k.rolleName)}${k.status !== 'aktiv' ? ' · ' + esc(STATUS[k.status][0]) : ''}</small></span></label>`;
    return `<div class="idp">
      <div class="idp-kopf">${SCHULE_ICON}<div><h1>Schulserver – Anmeldung</h1><p>Simulierter Anmeldedienst der Testumgebung (OpenID Connect)</p></div></div>
      <div class="idp-koerper">
        <div class="sim-hinweis" role="note"><span aria-hidden="true">⚠</span><div><strong>Simulation – keine echte IServ-Seite.</strong>Hier gibt es nur erfundene Testkonten. Gib niemals dein echtes IServ-Passwort ein.</div></div>
        <div class="idp-zugriff"><strong>„Lernseite (Testseite)“</strong> möchte auf dein Konto zugreifen:<ul><li>Name und Benutzername</li><li>Rolle (Schüler/in, Lehrkraft, Administration)</li><li>Klassen und Lerngruppen</li></ul></div>
        ${fehler ? `<p class="alert" role="alert">${esc(fehler)}</p>` : ''}
        <form id="idp-form" autocomplete="off">
          <input type="hidden" name="state" value="${esc(params.state || '')}">
          <input type="hidden" name="client_id" value="${esc(params.client_id || '')}">
          ${gruppen.map(([t, l]) => `<fieldset class="konten-gruppe"><legend>${t}</legend><div class="konten">${l.map(karte).join('')}</div></fieldset>`).join('')}
          <div class="idp-passwort" id="idp-pw" hidden>
            <label for="idp-passwort"><strong>Passwort</strong> <span class="small muted">(gemeinsames Testpasswort für Lehrkräfte und Administration)</span></label>
            <input type="password" id="idp-passwort" name="passwort" autocomplete="off" maxlength="256">
          </div>
          <div class="idp-aktionen">
            <button type="submit" class="btn primary" id="idp-weiter">Anmelden und zustimmen</button>
            <a href="/anmelden" class="btn">Abbrechen</a>
          </div>
        </form>
      </div>
    </div>`;
  }
  function wartung(text) {
    return `<section class="wartung panel"><h1>Wartungsarbeiten</h1><p>${esc(text)}</p><p class="small muted">Die Administration hat den Wartungsmodus der Testumgebung eingeschaltet.</p></section>`;
  }
  const deaktiviert = was => `<section class="login"><h1>Nicht verfügbar</h1><p>${esc(was)} ist in der Testumgebung gerade ausgeschaltet.</p><p><a class="btn" href="/">Zur Übersicht</a></p></section>`;
  const fehlerSeite = (titel, t) => `<section class="login"><h1>${esc(titel)}</h1><p>${esc(t)}</p><p><a class="btn" href="/">Zur Übersicht</a></p></section>`;

  // ================================================================== Schüler/innen
  function aufgabeKarte(a) {
    const erledigt = ['abgegeben', 'korrigiert', 'kontrolliert'].includes(a.status);
    const klasse = a.status === 'ueberfaellig' ? 'ueberfaellig' : erledigt ? 'erledigt' : 'offen';
    return `<a class="aufgabe-karte ${klasse}" href="/aufgaben/${esc(a.zuweisungId)}">
      <div><h3>${esc(a.titel)}</h3><div class="meta">${chip(FACH(a.fachId))}<span>fällig ${esc(datum(a.faellig))} (${esc(relativ(a.faellig))})</span>${a.bewertung && a.bewertung.punkte != null ? `<span>· ${a.bewertung.punkte}/${a.punkte} Punkte</span>` : ''}</div></div>
      <div>${statusChip(a.status)}</div></a>`;
  }
  function schuelerAufgaben(d, filter) {
    const st = d.aufgaben;
    if (!st) return kopf('schueler', 'Meine Aufgaben', '', '/aufgaben') + leer('Aufgaben sind in der Testumgebung gerade ausgeschaltet.');
    const offen = st.liste.filter(a => !['abgegeben', 'korrigiert', 'kontrolliert'].includes(a.status));
    const fertig = st.liste.filter(a => ['abgegeben', 'korrigiert', 'kontrolliert'].includes(a.status));
    const liste = filter === 'erledigt' ? fertig : filter === 'alle' ? st.liste : offen;
    liste.sort((a, b) => (a.faellig < b.faellig ? -1 : 1) * (filter === 'erledigt' ? -1 : 1));
    return `${kopf('schueler', 'Meine Aufgaben', 'Aufgaben deiner Lehrkräfte, Ankündigungen und Material für deine Klassen.', '/aufgaben')}
      <div class="kacheln">${kachel('Offen', st.offen, '', st.offen ? '' : 'ok')}${kachel('Überfällig', st.ueberfaellig, '', st.ueberfaellig ? 'warn' : '')}${kachel('Erledigt', st.erledigt, st.liste.length ? st.prozent + ' % aller Aufgaben' : '', 'ok')}</div>
      <div class="seitenleiste"><div>
        <div class="filters" role="group" aria-label="Aufgaben filtern">${[['offen', 'Offen (' + offen.length + ')'], ['erledigt', 'Erledigt (' + fertig.length + ')'], ['alle', 'Alle']].map(([f, t]) => `<a class="chip-btn${(filter || 'offen') === f ? ' active' : ''}" href="/aufgaben?filter=${f}"${(filter || 'offen') === f ? ' aria-current="true"' : ''} style="text-decoration:none">${t}</a>`).join('')}</div>
        <div class="aufgaben-liste">${liste.length ? liste.map(aufgabeKarte).join('') : leer(filter === 'erledigt' ? 'Noch keine erledigten Aufgaben.' : 'Keine offenen Aufgaben – gut gemacht!')}</div>
      </div><aside class="stapel">
        <section class="panel" style="margin:0"><h2>Ankündigungen</h2>${d.ankuendigungen.length ? d.ankuendigungen.slice(0, 5).map(a => `<article style="margin-bottom:10px"><strong>${esc(a.titel)}</strong><div class="small muted">${esc(a.klasse)} · ${esc(a.autor)} · ${esc(zeit(a.zeit))}</div><div class="anweisung small">${esc(a.text)}</div></article>`).join('') : leer('Keine Ankündigungen.')}</section>
        <section class="panel" style="margin:0"><h2>Lernmaterial</h2>${d.materialien.length ? `<ul class="liste">${d.materialien.map(m => { const l = materialLink(m.link); return `<li><div><strong>${l ? `<a href="${esc(l.href)}"${l.extern ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(m.titel)}</a>` : esc(m.titel)}</strong><div class="meta">${esc(m.beschreibung)} · ${esc(m.klasse)}</div></div></li>`; }).join('')}</ul>` : leer('Noch kein Material.')}</section>
      </aside></div>`;
  }
  function schuelerAufgabe(d) {
    const a = d.aufgabe, ab = d.abgabe, z = d.zuweisung;
    const loesungHinweis = { nie: 'Für diese Aufgabe gibt es keine Musterlösung.', nach_faelligkeit: 'Die Musterlösung erscheint nach dem Abgabedatum.', nach_korrektur: 'Die Musterlösung erscheint, sobald deine Abgabe korrigiert ist.', sofort: '' }[a.loesungFreigabe];
    return `<nav class="crumbs"><a href="/aufgaben">Meine Aufgaben</a><span>›</span><span>${esc(a.titel)}</span></nav>
      <header class="bereich-kopf schueler"><span class="bereich">Aufgabe · ${esc(FACH(a.fachId))}</span><h1>${esc(a.titel)}</h1>
        <div class="topic-status">${statusChip(ab ? ab.status : (z.ueberfaellig ? 'ueberfaellig' : 'offen'))}<span>fällig ${esc(datum(z.faellig))} (${esc(relativ(z.faellig))})</span><span>${esc(z.lehrer)} · ${esc(z.klasse)}</span></div></header>
      ${a.gesperrt ? '<p class="gesperrt-hinweis">Diese Aufgabe wurde vorübergehend gesperrt. Du kannst sie gerade nicht bearbeiten.</p>' : ''}
      <div class="seitenleiste"><div>
        <section class="panel"><h2>Arbeitsauftrag</h2>${a.beschreibung ? `<p class="muted">${esc(a.beschreibung)}</p>` : ''}${text(a.anweisung)}
          ${a.kriterien ? `<h3>Bewertung</h3><p>${esc(a.kriterien)}</p>` : ''}
          ${a.hinweise ? `<h3>Hinweise</h3>${text(a.hinweise)}` : ''}
          ${a.loesungSichtbar ? `<div class="loesung"><strong>Musterlösung</strong>${text(a.musterloesung)}</div>` : loesungHinweis ? `<p class="small muted">${loesungHinweis}</p>` : ''}
        </section>
        ${d.feedback.length ? `<section class="panel"><h2>Rückmeldung</h2>${d.feedback.map(f => `<div class="feedback${f.punkte == null && ab && ab.status === 'zurueckgegeben' ? ' zurueck' : ''}"><strong>${esc(f.lehrer)}</strong> <span class="small muted">${esc(zeit(f.zeit))}</span>${f.punkte != null ? ` · <strong>${f.punkte} von ${a.punkte} Punkten</strong>` : ''}${f.text ? text(f.text) : ''}</div>`).join('')}</section>` : ''}
        <section class="panel"><h2>Deine Lösung</h2>
          ${d.bearbeitbar ? `<form class="formular" data-aktion="schueler.speichern" data-erfolg="Gespeichert." data-weiter="/aufgaben/${esc(z.id)}">
              ${fehlerBox}<input type="hidden" name="id" value="${esc(z.id)}">
              ${ab && ab.status === 'zurueckgegeben' ? '<p class="alert">Deine Lehrkraft bittet dich, die Abgabe zu überarbeiten.</p>' : ''}
              <label class="feld"><span>Antwort</span><textarea name="text" rows="9" maxlength="5000">${esc(ab ? ab.text : '')}</textarea><small>Höchstens 5000 Zeichen. Zwischenspeichern ist jederzeit möglich.</small></label>
              <div class="knoepfe"><button type="submit" class="btn">Zwischenspeichern</button><button type="submit" class="btn primary" name="abgeben" value="1" data-erfolg="Abgegeben! Deine Lehrkraft wurde benachrichtigt." data-bestaetigen="Jetzt abgeben? Danach kannst du nichts mehr ändern, außer deine Lehrkraft gibt die Aufgabe zurück.">Abgeben</button></div>
            </form>`
            : ab ? `<p class="small muted">Abgegeben ${esc(zeit(ab.abgegebenAm))}${ab.verspaetet ? ' · nach dem Abgabedatum' : ''}</p><div class="abgabe-text">${esc(ab.text)}</div>` : leer('Diese Aufgabe kann nicht mehr bearbeitet werden.')}
        </section>
      </div><aside class="stapel">
        <section class="panel" style="margin:0"><h2>Auf einen Blick</h2><ul class="liste">
          <li><span class="meta">Fach</span><span>${esc(FACH(a.fachId))}</span></li>
          <li><span class="meta">Schwierigkeit</span><span class="diff diff-${esc(a.schwierigkeit)}">${esc(a.schwierigkeit)}</span></li>
          <li><span class="meta">Bearbeitungszeit</span><span>ca. ${a.minuten} min</span></li>
          ${a.punkte ? `<li><span class="meta">Punkte</span><span>${a.punkte}</span></li>` : ''}
        </ul></section>
        ${materialListe(a.material) ? `<section class="panel" style="margin:0"><h2>Material</h2>${materialListe(a.material)}</section>` : ''}
      </aside></div>`;
  }
  function fortschritt(d, profil) {
    const f = d.fortschritt, st = d.aufgaben;
    const fertig = st ? st.liste.filter(a => ['abgegeben', 'korrigiert', 'kontrolliert'].includes(a.status)) : [];
    return `${kopf('schueler', 'Mein Fortschritt', profil.klasse ? `Klasse ${esc(profil.klasse)} – Übungen der Klassenstufe ${profil.stufe} und deine Aufgaben` : '', '/fortschritt')}
      <div class="kacheln">${kachel('Gelöste Übungen', f.geloest)}${kachel('Richtige Antworten', f.richtigQuote == null ? '–' : f.richtigQuote + ' %', f.versuche + ' Versuche')}${st ? kachel('Aufgaben erledigt', st.erledigt + ' / ' + st.liste.length, '', 'ok') : ''}${kachel('Schwierige Themen', f.schwierig.length, '', f.schwierig.length ? 'warn' : '')}</div>
      <div class="zwei">
        <section class="panel"><h2>Übungen nach Fach</h2>${f.proFach.length ? `<div class="fach-balken">${f.proFach.map(p => `<div class="zeile"><span>${esc(FACH(p.fach))}</span>${balken(p.prozent, 'info')}<span class="small zahl">${p.geloest}/${p.uebungen}</span></div>`).join('')}</div><p class="small muted">Gelöste Übungen aller Themen deiner Klassenstufe.</p>` : leer('Noch keine Daten.')}</section>
        <section class="panel"><h2>Hier lohnt sich Wiederholen</h2>${f.schwierig.length ? `<ul class="liste">${f.schwierig.map(t => `<li><div><a href="${esc(themaHref(t.id) || '#')}"><strong>${esc(t.titel)}</strong></a><div class="meta">${esc(FACH(t.fach))} · ${t.quote} % richtig bei ${t.versuche} Versuchen${t.aufgedeckt ? ' · ' + t.aufgedeckt + '× Lösung angesehen' : ''}</div></div><a class="btn klein" href="${esc((themaHref(t.id) || '') + '/ueben')}">Üben</a></li>`).join('')}</ul>` : leer('Keine Auffälligkeiten – weiter so!')}</section>
      </div>
      <section class="panel"><h2>Themen, an denen du gearbeitet hast</h2>${f.themen.length ? `<div class="table-wrap"><table class="tabelle"><thead><tr><th>Thema</th><th>Fach</th><th>Gelöst</th><th class="zahl">Richtig</th></tr></thead><tbody>${f.themen.map(t => `<tr><td><a href="${esc(themaHref(t.id) || '#')}">${esc(t.titel)}</a></td><td>${esc(FACH(t.fach))} ${t.stufe}</td><td>${miniBar(t.uebungen ? 100 * t.geloest / t.uebungen : 0)}</td><td class="zahl">${t.quote == null ? '–' : t.quote + ' %'}</td></tr>`).join('')}</tbody></table></div>` : leer('Du hast noch keine Übungen bearbeitet.')}</section>
      ${st ? `<section class="panel"><h2>Erledigte Aufgaben</h2>${fertig.length ? `<ul class="liste">${fertig.map(a => `<li><div><a href="/aufgaben/${esc(a.zuweisungId)}"><strong>${esc(a.titel)}</strong></a><div class="meta">${esc(FACH(a.fachId))} · abgegeben ${esc(zeit(a.abgegebenAm))}${a.bewertung && a.bewertung.punkte != null ? ` · ${a.bewertung.punkte}/${a.punkte} Punkte` : ''}</div></div>${statusChip(a.status)}</li>`).join('')}</ul>` : leer('Noch nichts abgegeben.')}</section>` : ''}`;
  }
  function mitteilungen(liste, bereich) {
    const neu = liste.filter(n => !n.gelesen).length;
    return `${bereich === 'schueler' ? kopf('schueler', 'Mitteilungen', '', '/mitteilungen') : `<header class="page-head"><h1>Mitteilungen</h1></header>`}
      <section class="panel"><div class="panel-kopf"><h2>${neu ? neu + ' ungelesen' : 'Alles gelesen'}</h2>${neu ? `<button type="button" class="btn klein" data-aktion="mitteilungen.gelesen" data-daten='{"alle":true}' data-erfolg="Alle als gelesen markiert.">Alle als gelesen markieren</button>` : ''}</div>
      ${liste.length ? liste.map(n => `<div class="mitteilung${n.gelesen ? '' : ' neu'}"><span class="punkt" aria-hidden="true"></span><div style="flex:1">${n.link ? `<a href="${esc(n.link)}" data-gelesen="${esc(n.id)}">${esc(n.text)}</a>` : esc(n.text)}<div class="small muted" style="font-weight:400">${esc(zeit(n.zeit))}${n.gelesen ? '' : ' · neu'}</div></div></div>`).join('') : leer('Keine Mitteilungen.')}</section>`;
  }
  function suche(q, r) {
    const gruppe = (t, l) => l.length ? `<section class="panel"><h2>${t} (${l.length})</h2><ul class="liste">${l.map(x => `<li><div><a href="${esc(x.link)}"><strong>${esc(x.titel)}</strong></a>${x.info ? `<div class="meta">${esc(x.info)}</div>` : ''}</div></li>`).join('')}</ul></section>` : '';
    const themen = (r ? r.themen : []).map(t => ({ titel: t.titel, link: themaHref(t.id) || '/', info: FACH(t.fach) + ' · Klasse ' + t.stufe }));
    const n = r ? r.aufgaben.length + themen.length + r.materialien.length + r.personen.length + r.klassen.length : 0;
    return `<header class="page-head"><h1>Suche</h1><p class="muted">Durchsucht Aufgaben, Themen, Material${r && (r.personen.length || r.klassen.length) ? ', Personen und Klassen' : ''} – nur, was du sehen darfst.</p></header>
      <form class="filterleiste" data-get="/suche" role="search"><label class="suche">Suchbegriff<input type="search" name="q" value="${esc(q)}" minlength="2" maxlength="80" autofocus></label><button class="btn primary" type="submit">Suchen</button></form>
      ${q && q.length < 2 ? leer('Bitte mindestens zwei Zeichen eingeben.') : ''}
      ${r && q.length >= 2 && !n ? leer('Keine Treffer für „' + q + '“.') : ''}
      ${r ? gruppe('Aufgaben', r.aufgaben) + gruppe('Themen der Lernseite', themen) + gruppe('Material', r.materialien) + gruppe('Personen', r.personen) + gruppe('Klassen', r.klassen) : ''}`;
  }
  function konto(d, claims) {
    const p = d.profil;
    return `<header class="page-head"><h1>Mein Konto</h1></header>
      <section class="panel"><div class="zelle-person">${avatar(p, true)}<div><h2 style="margin:0">${esc(p.name)}</h2><div class="muted">${esc(p.username)} · ${rolleChip(p.rolle, p.rolleName)}</div></div></div>
        <div class="table-wrap"><table><tbody>
          <tr><th>Schulische Kennung (simuliert)</th><td>${esc(p.kennung || '–')}</td></tr>
          ${p.funktion ? `<tr><th>Funktion</th><td>${esc(p.funktion)}</td></tr>` : ''}
          <tr><th>Klassen und Lerngruppen</th><td>${p.klassen.length ? p.klassen.map(k => esc(k.name)).join(', ') : '–'}</td></tr>
          ${p.unterricht ? `<tr><th>Unterricht</th><td>${p.unterricht.map(u => esc(u.fach + ' ' + u.klasseId)).join(', ') || '–'}</td></tr>` : ''}
        </tbody></table></div>
        <div class="aktionen" style="margin-top:14px"><button type="button" class="btn" id="abmelden">Abmelden</button></div>
      </section>
      ${claims ? `<section class="panel"><h2>Identitätsdaten aus der Anmeldung (simuliert)</h2><p class="small muted">So würde ein echter IServ-Login (OpenID Connect) Rolle und Gruppen liefern. Hier stammen sie aus der Testdatenbank.</p><pre class="code">${esc(JSON.stringify(claims, null, 2))}</pre></section>` : ''}`;
  }

  // ================================================================== Lehrkräfte
  function stapel(st) {
    const n = st.schueler || 1, w = x => (100 * x / n).toFixed(1) + '%';
    return `<span class="stapelbalken" role="img" aria-label="${st.korrigiert} korrigiert, ${st.abgegeben} abgegeben, ${st.inArbeit} in Arbeit, ${st.ueberfaellig} überfällig, ${st.offen} offen"><span style="width:${w(st.korrigiert)};background:var(--ok)"></span><span style="width:${w(st.abgegeben)};background:var(--accent)"></span><span style="width:${w(st.inArbeit)};background:var(--mid)"></span><span style="width:${w(st.ueberfaellig)};background:var(--warn)"></span></span>`;
  }
  const LEGENDE = '<div class="legende"><span><i style="background:var(--ok)"></i>korrigiert</span><span><i style="background:var(--accent)"></i>abgegeben</span><span><i style="background:var(--mid)"></i>in Arbeit</span><span><i style="background:var(--warn)"></i>überfällig</span><span><i style="background:var(--border)"></i>offen</span></div>';
  function zuweisungZeile(z, mitKlasse, mitAktionen) {
    return `<tr${z.zurueckgezogen ? ' class="inaktiv"' : ''}><td><a href="/lehrer/aufgaben/${esc(z.aufgabeId)}">${esc(z.titel)}</a>${z.gesperrt ? ' ' + chip('gesperrt', 'warn') : ''}${z.zurueckgezogen ? ' ' + chip('zurückgezogen') : ''}</td>
      ${mitKlasse ? `<td>${esc(z.klasse)}</td>` : ''}
      <td>${esc(datum(z.faellig))}${z.ueberfaellig && !z.zurueckgezogen ? ' ' + chip('abgelaufen', 'warn') : ''}</td>
      <td>${stapel(z.statistik)}<div class="small muted">${z.statistik.abgegeben + z.statistik.korrigiert}/${z.statistik.schueler} abgegeben</div></td>
      <td><div class="aktionen"><a class="btn klein" href="/lehrer/zuweisungen/${esc(z.id)}">Abgaben</a>${mitAktionen && !z.zurueckgezogen ? `
        <form class="inline-form" data-aktion="zuweisung.frist" data-erfolg="Frist geändert. Die Klasse wurde benachrichtigt."><input type="hidden" name="id" value="${esc(z.id)}"><label class="sr-only" for="frist-${esc(z.id)}">Neue Frist</label><input type="date" id="frist-${esc(z.id)}" name="faellig" value="${esc(z.faellig)}" required><button class="btn klein" type="submit">Frist ändern</button></form>
        <button type="button" class="btn klein gefahr" data-aktion="zuweisung.zurueckziehen" data-daten='${esc(JSON.stringify({ id: z.id }))}' data-bestaetigen="Aufgabe für ${esc(z.klasse)} zurückziehen? Die Schüler/innen werden informiert, vorhandene Abgaben bleiben erhalten." data-erfolg="Zuweisung zurückgezogen.">Zurückziehen</button>` : ''}</div></td></tr>`;
  }
  function lehrerDashboard(d) {
    const z = d.zahlen;
    return `${kopf('lehrer', 'Guten Tag, ' + d.profil.name, d.profil.funktion ? esc(d.profil.funktion) : 'Deine Klassen, Aufgaben und Abgaben auf einen Blick.', '/lehrer', '<a class="btn primary" href="/lehrer/aufgaben/neu">+ Neue Aufgabe</a>')}
      <div class="kacheln">
        ${kachel('Klassen & Kurse', d.klassen.length, d.klassen.reduce((s, k) => s + k.schueler, 0) + ' Schüler/innen')}
        ${kachel('Laufende Aufgaben', z.aktiv)}
        ${kachel('Überfällig', z.ueberfaellig, 'mit fehlenden Abgaben', z.ueberfaellig ? 'warn' : '')}
        ${kachel('Abgeschlossen', z.abgeschlossen, 'alle abgegeben', 'ok')}
        ${kachel('Zu korrigieren', z.zuKorrigieren, '', z.zuKorrigieren ? 'warn' : 'ok')}
        ${kachel('Ø Bearbeitungsstand', z.aufgabenstand + ' %', 'Aufgaben · Übungen ' + z.uebungsstand + ' %')}
      </div>
      <section class="panel"><h2>Meine Klassen und Lerngruppen</h2><div class="cards">${d.klassen.map(k => `<a class="card" href="/lehrer/klassen/${esc(k.id)}"><div class="card-top"><h3>${esc(k.name)}</h3>${k.leitung ? chip('Klassenleitung', 'info') : ''}</div><p>${k.schueler} Schüler/innen${k.faecher.length ? ' · ' + esc(k.faecher.join(', ')) : ''}</p></a>`).join('') || leer('Dir sind noch keine Klassen zugeordnet. Die Administration verwaltet die Zuordnungen.')}</div></section>
      <section class="panel"><div class="panel-kopf"><h2>Laufende und überfällige Aufgaben</h2><a href="/lehrer/aufgaben">Alle Aufgaben →</a></div>
        ${d.aktiv.length ? `<div class="table-wrap"><table class="tabelle"><thead><tr><th>Aufgabe</th><th>Klasse</th><th>Fällig</th><th>Stand</th><th></th></tr></thead><tbody>${d.aktiv.map(x => zuweisungZeile(x, true, false)).join('')}</tbody></table></div>${LEGENDE}` : leer('Keine laufenden Aufgaben.')}</section>
      <div class="zwei">
        <section class="panel"><h2>Neueste Abgaben</h2>${d.neuesteAbgaben.length ? `<ul class="liste">${d.neuesteAbgaben.map(a => `<li><div class="haupt"><div><a href="/lehrer/abgaben/${esc(a.id)}"><strong>${esc(a.schueler)}</strong></a><div class="meta">${esc(a.aufgabe)} · ${esc(a.klasse)} · ${esc(zeit(a.abgegebenAm))}${a.verspaetet ? ' · verspätet' : ''}</div></div></div>${statusChip(a.status)}</li>`).join('')}</ul>` : leer('Noch keine Abgaben.')}</section>
        <section class="panel"><h2>Brauchen Unterstützung</h2>${d.hilfe.length ? `<ul class="liste">${d.hilfe.map(h => `<li><div><a href="/lehrer/schueler/${esc(h.id)}"><strong>${esc(h.name)}</strong></a> <span class="meta">${esc(h.klasse)}</span><div class="meta">${h.gruende.map(esc).join(' · ')}</div></div></li>`).join('')}</ul>` : leer('Niemand fällt gerade auf.')}</section>
      </div>
      <div class="zwei">
        <section class="panel"><h2>Schwierige Lerngebiete</h2><p class="small muted">Aus den Übungsversuchen deiner Schüler/innen auf der Lernseite.</p>${d.schwierig.length ? `<ul class="liste">${d.schwierig.map(t => `<li><div><a href="${esc(themaHref(t.id) || '#')}"><strong>${esc(t.titel)}</strong></a><div class="meta">${esc(FACH(t.fach))} ${t.stufe} · ${t.schueler} Schüler/innen · ${t.versuche} Versuche</div></div>${miniBar(t.fehlerquote, 'warn')}</li>`).join('')}</ul><p class="small muted">Balken = Anteil falscher Antworten.</p>` : leer('Noch zu wenige Daten.')}</section>
        <section class="panel"><h2>Meine letzten Aktivitäten</h2>${d.aktivitaeten.length ? `<ul class="liste">${d.aktivitaeten.map(l => `<li><div><strong>${esc(AKTION(l.aktion))}</strong><div class="meta">${esc(l.ziel)}${l.details ? ' · ' + esc(l.details) : ''}</div></div><span class="meta">${esc(zeit(l.zeit))}</span></li>`).join('')}</ul>` : leer('Noch keine Aktivitäten.')}</section>
      </div>`;
  }
  const AKTIONEN = {
    anmeldung: 'Anmeldung', aufgabe_erstellt: 'Aufgabe erstellt', aufgabe_veroeffentlicht: 'Aufgabe veröffentlicht', aufgabe_bearbeitet: 'Aufgabe bearbeitet',
    aufgabe_archiviert: 'Aufgabe archiviert', aufgabe_entwurf: 'Aufgabe zurück in den Entwurf', aufgabe_dupliziert: 'Aufgabe dupliziert', aufgabe_zugewiesen: 'Aufgabe zugewiesen',
    aufgabe_veroeffentlicht_wiederhergestellt: 'Aufgabe wiederhergestellt', aufgabe_archiviert_wiederhergestellt: 'Aufgabe wiederhergestellt', aufgabe_entwurf_wiederhergestellt: 'Aufgabe wiederhergestellt',
    frist_geaendert: 'Frist geändert', zuweisung_zurueckgezogen: 'Zuweisung zurückgezogen', abgabe_bewertet: 'Abgabe bewertet', abgabe_wiedergeoeffnet: 'Erneute Bearbeitung ermöglicht',
    ankuendigung_erstellt: 'Ankündigung', material_veroeffentlicht: 'Material veröffentlicht', foerderhinweis_erstellt: 'Förderhinweis notiert',
    konto_gesperrt: 'Konto gesperrt', konto_entsperrt: 'Konto entsperrt', konto_deaktiviert: 'Konto deaktiviert', konto_reaktiviert: 'Konto reaktiviert', konto_erstellt: 'Konto erstellt',
    rolle_geaendert: 'Rolle geändert', rollenwechsel_abgelehnt: 'Rollenwechsel abgelehnt', sitzungen_widerrufen: 'Sitzungen widerrufen', klassenzuordnung_geaendert: 'Klassenzuordnung geändert',
    lehrerzuordnung_hinzugefuegt: 'Lehrerzuordnung hinzugefügt', lehrerzuordnung_entfernt: 'Lehrerzuordnung entfernt', aufgabe_gesperrt: 'Aufgabe gesperrt', aufgabe_entsperrt: 'Aufgabe entsperrt',
    aufgabe_ausgeblendet: 'Aufgabe ausgeblendet', aufgabe_eingeblendet: 'Aufgabe eingeblendet', aufgabe_geloescht: 'Aufgabe gelöscht', bibliothek_freigegeben: 'In Bibliothek freigegeben', bibliothek_entfernt: 'Aus Bibliothek entfernt',
    klasse_angelegt: 'Klasse angelegt', klasse_geaendert: 'Klasse geändert', fach_geaendert: 'Fach geändert', einstellungen_geaendert: 'Einstellungen geändert',
    testdaten_angelegt: 'Testdaten angelegt', testdaten_zurueckgesetzt: 'Testdaten zurückgesetzt', migration: 'Datenbank-Migration', zugriff_verweigert: 'Zugriff verweigert',
  };
  const AKTION = a => AKTIONEN[a] || a;
  function lehrerKlasse(d, sort, tab, q) {
    const k = d.klasse, st = d.statistik;
    const s = d.schueler.slice();
    const sortierer = { name: (a, b) => (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname, 'de'), stand: (a, b) => a.aufgabenProzent - b.aufgabenProzent, quote: (a, b) => (a.richtigQuote ?? 101) - (b.richtigQuote ?? 101), aktivitaet: (a, b) => (a.letzteAktivitaet || 0) - (b.letzteAktivitaet || 0) };
    s.sort(sortierer[sort] || sortierer.name);
    const gefiltert = q ? s.filter(x => (x.name + ' ' + x.kennung).toLowerCase().includes(q.toLowerCase())) : s;
    const tabs = [['schueler', 'Schüler/innen'], ['aufgaben', 'Aufgaben'], ['ankuendigungen', 'Ankündigungen'], ['material', 'Material'], ['statistik', 'Statistik']];
    tab = tab || 'schueler';
    const basis = `/lehrer/klassen/${encodeURIComponent(k.id)}`;
    let inhalt = '';
    if (tab === 'schueler') inhalt = `<form class="filterleiste" data-get="${basis}"><input type="hidden" name="tab" value="schueler"><label class="suche">Name suchen<input type="search" name="q" value="${esc(q || '')}"></label><label>Sortieren nach${auswahl('sort', [['name', 'Name'], ['stand', 'Aufgabenstand (niedrig zuerst)'], ['quote', 'Richtige Antworten (niedrig zuerst)'], ['aktivitaet', 'Letzte Aktivität (älteste zuerst)']], sort || 'name')}</label><button class="btn" type="submit">Anwenden</button></form>
      <div class="table-wrap"><table class="tabelle"><thead><tr><th>Name</th><th>Aufgaben erledigt</th><th class="zahl">Offen</th><th class="zahl">Übungen richtig</th><th>Zuletzt aktiv</th><th></th></tr></thead><tbody>
      ${gefiltert.map(x => `<tr${x.status !== 'aktiv' ? ' class="inaktiv"' : ''}><td><div class="zelle-person">${avatar(x)}<div><a href="/lehrer/schueler/${esc(x.id)}">${esc(x.name)}</a><div class="small muted">${esc(x.kennung || '')}${x.status !== 'aktiv' ? ' · ' + esc(STATUS[x.status][0]) : ''}</div></div></div></td>
        <td>${miniBar(x.aufgabenProzent, x.aufgabenProzent < 50 ? 'warn' : '')}</td><td class="zahl">${x.offen}${x.ueberfaellig ? ` <span class="st st-warn">${x.ueberfaellig} überfällig</span>` : ''}</td>
        <td class="zahl">${x.richtigQuote == null ? '–' : x.richtigQuote + ' %'}<div class="small muted">${x.versuche} Versuche</div></td><td class="small">${esc(x.letzteAktivitaet ? zeit(x.letzteAktivitaet) : '–')}</td><td>${x.schwierig ? chip(x.schwierig + ' schwierige Themen', 'warn') : ''}</td></tr>`).join('') || `<tr><td colspan="6">${leer('Keine Treffer.')}</td></tr>`}
      </tbody></table></div>`;
    if (tab === 'aufgaben') inhalt = `<div class="aktionen" style="margin-bottom:10px"><a class="btn primary" href="/lehrer/aufgaben/neu">+ Neue Aufgabe</a><a class="btn" href="/lehrer/bibliothek">Aus der Bibliothek zuweisen</a></div>
      ${d.zuweisungen.length ? `<div class="table-wrap"><table class="tabelle"><thead><tr><th>Aufgabe</th><th>Fällig</th><th>Stand</th><th>Aktionen</th></tr></thead><tbody>${d.zuweisungen.map(z => zuweisungZeile(z, false, true)).join('')}</tbody></table></div>${LEGENDE}` : leer('Dieser Klasse sind noch keine Aufgaben zugewiesen.')}`;
    if (tab === 'ankuendigungen') inhalt = `<div class="zwei"><section class="panel"><h2>Neue Ankündigung</h2>
        <form class="formular" data-aktion="ankuendigung.erstellen" data-erfolg="Ankündigung veröffentlicht. Die Klasse wurde benachrichtigt." data-weiter="${basis}?tab=ankuendigungen">${fehlerBox}<input type="hidden" name="klassen" value="${esc(k.id)}">
          <label class="feld"><span>Titel</span><input name="titel" required maxlength="120" minlength="3"></label>
          <label class="feld"><span>Text</span><textarea name="text" required maxlength="2000" rows="4"></textarea></label>
          <div class="knoepfe"><button class="btn primary" type="submit">Veröffentlichen</button></div></form></section>
        <section class="panel"><h2>Bisherige Ankündigungen</h2>${d.ankuendigungen.length ? d.ankuendigungen.map(a => `<article style="margin-bottom:12px"><div class="panel-kopf"><strong>${esc(a.titel)}</strong>${a.eigene ? `<button type="button" class="btn klein gefahr" data-aktion="ankuendigung.loeschen" data-daten='${esc(JSON.stringify({ id: a.id }))}' data-bestaetigen="Ankündigung löschen?" data-erfolg="Gelöscht.">Löschen</button>` : ''}</div><div class="small muted">${esc(a.autor)} · ${esc(zeit(a.zeit))}</div><div class="anweisung">${esc(a.text)}</div></article>`).join('') : leer('Noch keine Ankündigungen.')}</section></div>`;
    if (tab === 'material') inhalt = `<div class="zwei"><section class="panel"><h2>Material veröffentlichen</h2>
        <form class="formular" data-aktion="material.erstellen" data-erfolg="Material veröffentlicht." data-weiter="${basis}?tab=material">${fehlerBox}<input type="hidden" name="klasseId" value="${esc(k.id)}">
          <label class="feld"><span>Titel</span><input name="titel" required maxlength="120" minlength="3"></label>
          <label class="feld"><span>Beschreibung</span><textarea name="beschreibung" maxlength="1000" rows="3"></textarea></label>
          <label class="feld"><span>Verknüpfung</span>${materialAuswahl('link', '')}<small>Thema oder interaktive Erklärung der Lernseite.</small></label>
          <div class="knoepfe"><button class="btn primary" type="submit">Veröffentlichen</button></div></form></section>
        <section class="panel"><h2>Veröffentlicht</h2>${d.materialien.length ? `<ul class="liste">${d.materialien.map(m => { const l = materialLink(m.link); return `<li><div><strong>${l ? `<a href="${esc(l.href)}">${esc(m.titel)}</a>` : esc(m.titel)}</strong><div class="meta">${esc(m.beschreibung)} · ${esc(m.autor)}</div></div>${m.eigene ? `<button type="button" class="btn klein gefahr" data-aktion="material.loeschen" data-daten='${esc(JSON.stringify({ id: m.id }))}' data-bestaetigen="Material entfernen?" data-erfolg="Entfernt.">Entfernen</button>` : ''}</li>`; }).join('')}</ul>` : leer('Noch kein Material.')}</section></div>`;
    if (tab === 'statistik') inhalt = `<div class="zwei"><section class="panel"><h2>Erledigungsquote je Aufgabe</h2>${d.zuweisungen.filter(z => !z.zurueckgezogen).length ? `<div class="fach-balken">${d.zuweisungen.filter(z => !z.zurueckgezogen).map(z => `<div class="zeile" style="grid-template-columns:minmax(0,1fr) 1fr 50px"><span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(z.titel)}">${esc(z.titel)}</span>${balken(z.statistik.erledigtProzent, z.statistik.erledigtProzent < 50 ? 'warn' : '')}<span class="small zahl">${z.statistik.erledigtProzent} %</span></div>`).join('')}</div>` : leer('Keine Aufgaben.')}</section>
      <section class="panel"><h2>Häufige Fehler</h2>${d.schwierig.length ? `<ul class="liste">${d.schwierig.map(t => `<li><div><a href="${esc(themaHref(t.id) || '#')}"><strong>${esc(t.titel)}</strong></a><div class="meta">${esc(FACH(t.fach))} · ${t.schueler} Schüler/innen · ${t.versuche} Versuche</div></div>${miniBar(t.fehlerquote, 'warn')}</li>`).join('')}</ul><p class="small muted">Anteil falscher Antworten in den Übungen der Lernseite.</p>` : leer('Noch zu wenige Übungsdaten.')}</section></div>
      <section class="panel"><h2>Unterstützungsbedarf</h2>${d.hilfe.length ? `<ul class="liste">${d.hilfe.map(h => `<li><div><a href="/lehrer/schueler/${esc(h.id)}"><strong>${esc(h.name)}</strong></a><div class="meta">${h.gruende.map(esc).join(' · ')}</div></div></li>`).join('')}</ul>` : leer('Niemand fällt gerade auf.')}</section>`;
    return `<nav class="crumbs"><a href="/lehrer">Lehrerbereich</a><span>›</span><span>${esc(k.name)}</span></nav>
      ${kopf('lehrer', k.name, `${k.typ === 'kurs' ? 'Lerngruppe' : 'Klasse'} · Klassenstufe ${k.stufe}${k.leitung !== '–' ? ' · Klassenleitung ' + esc(k.leitung) : ''}${d.meineFaecher.length ? ' · dein Unterricht: ' + d.meineFaecher.map(f => esc(FACH(f))).join(', ') : ''}`, '')}
      <div class="kacheln">${kachel('Schüler/innen', st.schueler)}${kachel('Ø Aufgaben erledigt', st.aufgabenstand + ' %')}${kachel('Ø richtige Antworten', st.richtigQuote == null ? '–' : st.richtigQuote + ' %', 'Übungen der Lernseite')}${kachel('Überfällige Abgaben', st.ueberfaellig, '', st.ueberfaellig ? 'warn' : 'ok')}</div>
      <nav class="tabs klassen-tabs" aria-label="Bereiche der Klasse">${tabs.map(([t, n]) => `<a href="${basis}?tab=${t}"${t === tab ? ' class="active" aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
      <div style="margin-top:14px">${inhalt}</div>
      <p class="small muted">Lehrkräfte dieser Klasse: ${d.lehrkraefte.map(l => esc(l.name + ' (' + l.fach + ')')).join(', ') || '–'}</p>`;
  }
  function materialAuswahl(name, wert) {
    const themen = [];
    for (const f of FAECHER) for (const g of f.stufen) for (const tf of g.themenfelder) for (const t of tf.topics) if (!t.gesperrt) themen.push([`thema:${t.id}`, `${f.kurz} ${g.stufe}: ${t.titel}`]);
    const lektionen = Object.values(LESSONS).map(l => [l.slug.startsWith('sandbox-') ? `sandbox:${l.slug.slice(8)}` : `lektion:${l.slug}`, l.title]).sort((a, b) => a[1].localeCompare(b[1], 'de'));
    return `<select name="${name}" id="f-${name}"><option value="">– keine –</option><optgroup label="Themen">${themen.map(([v, t]) => `<option value="${esc(v)}"${v === wert ? ' selected' : ''}>${esc(t)}</option>`).join('')}</optgroup><optgroup label="Interaktive Erklärungen und Sandbox">${lektionen.map(([v, t]) => `<option value="${esc(v)}"${v === wert ? ' selected' : ''}>${esc(t)}</option>`).join('')}</optgroup></select>`;
  }
  function lehrerSchueler(d, zurueck) {
    const p = d.profil, f = d.fortschritt;
    return `<nav class="crumbs"><a href="/lehrer">Lehrerbereich</a><span>›</span>${p.klasse ? `<a href="/lehrer/klassen/${esc(p.klasse)}">Klasse ${esc(p.klasse)}</a><span>›</span>` : ''}<span>${esc(p.name)}</span></nav>
      <header class="bereich-kopf"><span class="bereich">Lehrerbereich · Schülerprofil</span><div class="zelle-person">${avatar(p, true)}<div><h1 style="margin:0">${esc(p.name)}</h1><div class="muted">${esc(p.kennung || '')} · ${p.klassen.map(k => esc(k.name)).join(', ')} · ${statusChip(p.status)}</div></div></div></header>
      <div class="kacheln">${kachel('Gelöste Übungen', f.geloest)}${kachel('Richtige Antworten', f.richtigQuote == null ? '–' : f.richtigQuote + ' %', f.versuche + ' Versuche')}${kachel('Offene Aufgaben', d.aufgaben.filter(a => !['abgegeben', 'korrigiert', 'kontrolliert'].includes(a.status)).length)}${kachel('Zuletzt aktiv', f.letzteAktivitaet ? zeit(f.letzteAktivitaet) : '–')}</div>
      <div class="zwei">
        <section class="panel"><h2>Lernstand nach Fach</h2>${f.proFach.length ? `<div class="fach-balken">${f.proFach.map(x => `<div class="zeile"><span>${esc(FACH(x.fach))}</span>${balken(x.prozent, 'info')}<span class="small zahl">${x.geloest}/${x.uebungen}</span></div>`).join('')}</div>` : leer('Keine Daten.')}
          <h3>Wiederholt Schwierigkeiten</h3>${f.schwierig.length ? `<ul class="liste">${f.schwierig.map(t => `<li><span>${esc(t.titel)}</span><span class="meta">${t.quote} % richtig · ${t.versuche} Versuche</span></li>`).join('')}</ul>` : leer('Keine Auffälligkeiten.')}</section>
        <section class="panel"><h2>Förderhinweise</h2><p class="small muted">Nur für Lehrkräfte sichtbar.</p>
          ${d.foerderhinweise.map(h => `<div class="feedback"><div class="panel-kopf"><strong>${esc(h.lehrer)}</strong><span class="small muted">${esc(zeit(h.zeit))}</span></div>${text(h.text)}${h.eigene ? `<button type="button" class="btn klein gefahr" data-aktion="foerderhinweis.loeschen" data-daten='${esc(JSON.stringify({ id: h.id }))}' data-bestaetigen="Hinweis löschen?" data-erfolg="Gelöscht.">Löschen</button>` : ''}</div>`).join('') || leer('Noch keine Hinweise.')}
          <form class="formular" data-aktion="foerderhinweis.speichern" data-erfolg="Förderhinweis gespeichert.">${fehlerBox}<input type="hidden" name="schuelerId" value="${esc(p.id)}"><label class="feld"><span>Neuer Hinweis</span><textarea name="text" rows="3" maxlength="1000" required></textarea></label><div class="knoepfe"><button class="btn" type="submit">Hinweis speichern</button></div></form></section>
      </div>
      <section class="panel"><h2>Aufgaben</h2>${d.aufgaben.length ? `<div class="table-wrap"><table class="tabelle"><thead><tr><th>Aufgabe</th><th>Fällig</th><th>Status</th><th class="zahl">Punkte</th></tr></thead><tbody>${d.aufgaben.map(a => { const ab = d.abgaben.find(x => x.aufgabe === a.titel); return `<tr><td>${ab ? `<a href="/lehrer/abgaben/${esc(ab.id)}">${esc(a.titel)}</a>` : esc(a.titel)}</td><td>${esc(datum(a.faellig))}</td><td>${statusChip(a.status)}</td><td class="zahl">${a.bewertung && a.bewertung.punkte != null ? a.bewertung.punkte + '/' + a.punkte : '–'}</td></tr>`; }).join('')}</tbody></table></div>` : leer('Keine Aufgaben in deinen Klassen.')}</section>
      <section class="panel"><h2>Lernverlauf (letzte Übungsversuche)</h2>${d.verlauf.length ? `<ul class="liste">${d.verlauf.map(v => `<li><span>${esc(v.thema)}</span><span class="meta">${esc(zeit(v.zeit))} · ${v.aufgedeckt ? 'Lösung angesehen' : v.richtig ? '<span class="ok-text">richtig</span>' : 'falsch'}</span></li>`).join('')}</ul>` : leer('Noch keine Übungen bearbeitet.')}</section>`;
  }
  function aufgabenFilter(basis, q, admin, extra) {
    return `<form class="filterleiste" data-get="${basis}">
      <label class="suche">Suche<input type="search" name="q" value="${esc(q.q || '')}" maxlength="80"></label>
      <label>Fach${auswahl('fach', FAECHER_OPT(), q.fach, 'alle')}</label>
      <label>Status${auswahl('status', [['entwurf', 'Entwurf'], ['veroeffentlicht', 'veröffentlicht'], ['archiviert', 'archiviert'], ['vorlage', 'Vorlage'], ...(admin ? [['gesperrt', 'gesperrt'], ['ausgeblendet', 'ausgeblendet'], ['bibliothek', 'Bibliothek']] : [])], q.status, 'alle')}</label>
      ${extra || ''}
      <button class="btn" type="submit">Filtern</button>${Object.keys(q).some(k => q[k]) ? `<a class="btn" href="${basis}">Zurücksetzen</a>` : ''}</form>`;
  }
  function aufgabenTabelle(liste, basis, admin) {
    return liste.length ? `<div class="table-wrap"><table class="tabelle"><thead><tr><th>Titel</th><th>Fach</th>${admin ? '<th>Erstellt von</th>' : ''}<th>Status</th><th>Klassen</th><th class="zahl">Abgaben</th><th>Geändert</th></tr></thead><tbody>
      ${liste.map(a => `<tr${a.status === 'archiviert' ? ' class="inaktiv"' : ''}><td><a href="${basis}/${esc(a.id)}">${esc(a.titel)}</a>${a.bibliothek ? ' ' + chip('Bibliothek', 'info') : ''}${a.vorlage ? ' ' + chip('Vorlage') : ''}</td><td>${esc(a.fach)}</td>${admin ? `<td>${esc(a.ersteller)}</td>` : ''}<td>${statusChip(a.status)}${a.gesperrt ? ' ' + chip('gesperrt', 'warn') : ''}${a.ausgeblendet ? ' ' + chip('ausgeblendet', 'warn') : ''}</td><td>${esc(a.klassen.join(', ') || '–')}</td><td class="zahl">${a.abgaben}</td><td class="small">${esc(zeit(a.geaendert))}</td></tr>`).join('')}
      </tbody></table></div>` : leer('Keine Aufgaben gefunden.');
  }
  function lehrerAufgaben(liste, q) {
    return `${kopf('lehrer', 'Meine Aufgaben', 'Entwürfe, veröffentlichte und archivierte Aufgaben.', '/lehrer/aufgaben', '<div class="aktionen"><a class="btn primary" href="/lehrer/aufgaben/neu">+ Neue Aufgabe</a><a class="btn" href="/lehrer/bibliothek">Aus Bibliothek</a></div>')}
      ${aufgabenFilter('/lehrer/aufgaben', q, false)}${aufgabenTabelle(liste, '/lehrer/aufgaben', false)}`;
  }
  function aufgabeFormular(a, bereich, admin) {
    a = a || {};
    const neu = !a.id, basis = bereich === 'admin' ? '/admin/aufgaben' : '/lehrer/aufgaben';
    const themen = [];
    for (const f of FAECHER) for (const g of f.stufen) { const l = g.themenfelder.flatMap(tf => tf.topics).filter(t => !t.gesperrt); if (l.length) themen.push([`${f.kurz} – Klasse ${g.stufe}`, l]); }
    const lektionen = Object.values(LESSONS).map(l => [l.slug.startsWith('sandbox-') ? `sandbox:${l.slug.slice(8)}` : `lektion:${l.slug}`, l.title]).sort((x, y) => x[1].localeCompare(y[1], 'de'));
    const mat = new Set(a.material || []);
    return `<nav class="crumbs"><a href="${basis}">${bereich === 'admin' ? 'Aufgabenverwaltung' : 'Meine Aufgaben'}</a><span>›</span><span>${neu ? 'Neue Aufgabe' : esc(a.titel)}</span></nav>
      <header class="bereich-kopf${bereich === 'admin' ? ' admin' : ''}"><span class="bereich">${bereich === 'admin' ? 'Verwaltung' : 'Lehrerbereich'}</span><h1>${neu ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}</h1></header>
      <form class="formular panel" data-aktion="${neu ? 'aufgabe.erstellen' : 'aufgabe.bearbeiten'}" data-weiter="${basis}/{id}" data-erfolg="${neu ? 'Aufgabe gespeichert.' : 'Änderungen gespeichert.'}" data-listen="material">
        ${fehlerBox}${neu ? '' : `<input type="hidden" name="id" value="${esc(a.id)}">`}
        <label class="feld"><span>Titel *</span><input name="titel" required minlength="3" maxlength="120" value="${esc(a.titel || '')}"></label>
        <label class="feld"><span>Kurzbeschreibung</span><input name="beschreibung" maxlength="500" value="${esc(a.beschreibung || '')}"><small>Erscheint in Listen und über dem Arbeitsauftrag.</small></label>
        <label class="feld"><span>Arbeitsanweisung *</span><textarea name="anweisung" required minlength="10" maxlength="4000" rows="6">${esc(a.anweisung || '')}</textarea></label>
        <div class="reihe">
          <label class="feld"><span>Fach *</span>${auswahl('fachId', FAECHER_OPT(), a.fachId || '')}</label>
          <label class="feld"><span>Thema / Lerngebiet</span><select name="themaId" id="f-themaId"><option value="">– ohne –</option>${themen.map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(t => `<option value="${esc(t.id)}" data-fach="${esc(t.fach)}"${t.id === a.themaId ? ' selected' : ''}>${esc(t.titel)}</option>`).join('')}</optgroup>`).join('')}</select><small>Muss zum Fach passen.</small></label>
        </div>
        <div class="reihe">
          <label class="feld"><span>Schwierigkeit</span>${auswahl('schwierigkeit', SCHWIERIGKEIT, a.schwierigkeit || 'mittel')}</label>
          <label class="feld"><span>Bearbeitungszeit (Minuten)</span><input type="number" name="minuten" min="5" max="240" step="1" value="${esc(a.minuten || 20)}"></label>
          <label class="feld"><span>Punkte (0 = ohne)</span><input type="number" name="punkte" min="0" max="100" step="1" value="${esc(a.punkte ?? 0)}"></label>
        </div>
        <label class="feld"><span>Bewertungskriterien</span><textarea name="kriterien" maxlength="1000" rows="2">${esc(a.kriterien || '')}</textarea></label>
        <label class="feld"><span>Weitere Lernmaterialien</span><select name="material" multiple size="5">${lektionen.map(([v, t]) => `<option value="${esc(v)}"${mat.has(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select><small>Mehrfachauswahl mit Strg/⌘. Das gewählte Thema wird automatisch verlinkt.</small></label>
        <fieldset><legend>Hinweise und Musterlösung (geschützt)</legend>
          <label class="feld"><span>Hinweise für Schüler/innen</span><textarea name="hinweise" maxlength="1000" rows="2">${esc(a.hinweise || '')}</textarea></label>
          <label class="feld"><span>Hinweise sichtbar</span>${auswahl('hinweiseFreigabe', [['sofort', 'sofort'], ['mit_loesung', 'erst mit der Musterlösung']], a.hinweiseFreigabe || 'sofort')}</label>
          <label class="feld"><span>Musterlösung</span><textarea name="musterloesung" maxlength="4000" rows="3">${esc(a.musterloesung || '')}</textarea></label>
          <label class="feld"><span>Musterlösung freigeben</span>${auswahl('loesungFreigabe', LOESUNG, a.loesungFreigabe || 'nie')}<small>Vor der Freigabe wird die Lösung gar nicht erst an Schüler/innen ausgeliefert.</small></label>
        </fieldset>
        <label class="feld"><span>Schlagwörter</span><input name="tags" maxlength="200" value="${esc((a.tags || []).join(', '))}"><small>Mit Kommas trennen, z. B. „Elektrik, Messung“.</small></label>
        <div class="checks"><label class="check"><input type="checkbox" name="vorlage"${a.vorlage ? ' checked' : ''}> Als wiederverwendbare Vorlage speichern</label>${admin ? `<label class="check"><input type="checkbox" name="bibliothek"${a.bibliothek ? ' checked' : ''}> In die zentrale Aufgabenbibliothek</label>` : ''}</div>
        <div class="knoepfe">${neu ? '<button class="btn" type="submit" name="status" value="entwurf">Als Entwurf speichern</button><button class="btn primary" type="submit" name="status" value="veroeffentlicht">Speichern und veröffentlichen</button>' : '<button class="btn primary" type="submit">Änderungen speichern</button>'}<a class="btn" href="${neu ? basis : basis + '/' + esc(a.id)}">Abbrechen</a></div>
      </form>`;
  }
  function vorschau(a) {
    const ha = { titel: a.titel, beschreibung: a.beschreibung, anweisung: a.anweisung, kriterien: a.kriterien, material: a.material };
    return `<div class="vorschau"><span class="vorschau-etikett">Vorschau – so sehen Schüler/innen die Aufgabe</span><h3 style="margin:6px 0">${esc(ha.titel)}</h3>${ha.beschreibung ? `<p class="muted">${esc(ha.beschreibung)}</p>` : ''}${text(ha.anweisung)}${ha.kriterien ? `<p><strong>Bewertung:</strong> ${esc(ha.kriterien)}</p>` : ''}${a.hinweise && a.hinweiseFreigabe === 'sofort' ? `<p><strong>Hinweise:</strong> ${esc(a.hinweise)}</p>` : ''}${materialListe(ha.material)}<p class="small muted">Musterlösung: ${esc(LOESUNG.find(x => x[0] === a.loesungFreigabe)[1])}</p></div>`;
  }
  function aufgabeDetails(d, bereich, ichId) {
    const a = d.aufgabe, admin = bereich === 'admin', basis = admin ? '/admin/aufgaben' : '/lehrer/aufgaben', eigene = a.erstellerId === ichId;
    const knopf = (aktion, daten, t, o = {}) => `<button type="button" class="btn ${o.art || ''}" data-aktion="${aktion}" data-daten='${esc(JSON.stringify(daten))}'${o.frage ? ` data-bestaetigen="${esc(o.frage)}"` : ''} data-erfolg="${esc(o.erfolg || 'Erledigt.')}"${o.weiter ? ` data-weiter="${esc(o.weiter)}"` : ''}>${t}</button>`;
    const aktionen = [];
    if (d.darfBearbeiten) aktionen.push(`<a class="btn" href="${basis}/${esc(a.id)}/bearbeiten">Bearbeiten</a>`);
    if (d.darfBearbeiten && a.status === 'entwurf') aktionen.push(knopf('aufgabe.status', { id: a.id, status: 'veroeffentlicht' }, 'Veröffentlichen', { art: 'primary', erfolg: 'Aufgabe veröffentlicht.' }));
    if (d.darfBearbeiten && a.status === 'veroeffentlicht') aktionen.push(knopf('aufgabe.status', { id: a.id, status: 'archiviert' }, 'Archivieren', { frage: 'Aufgabe archivieren? Sie wird für Schüler/innen ohne Abgabe ausgeblendet, vorhandene Abgaben bleiben erhalten.', erfolg: 'Aufgabe archiviert.' }));
    if (d.darfBearbeiten && a.status === 'archiviert') aktionen.push(knopf('aufgabe.status', { id: a.id, status: 'veroeffentlicht' }, 'Wiederherstellen', { erfolg: 'Aufgabe wiederhergestellt.' }));
    if (d.darfBearbeiten && a.status === 'veroeffentlicht' && !d.zuweisungen.some(z => !z.zurueckgezogen)) aktionen.push(knopf('aufgabe.status', { id: a.id, status: 'entwurf' }, 'Zurück in den Entwurf', { erfolg: 'Wieder ein Entwurf.' }));
    if (!a.gesperrt || admin) aktionen.push(knopf('aufgabe.duplizieren', { id: a.id }, eigene ? 'Duplizieren' : 'Als Kopie übernehmen', { erfolg: 'Kopie als Entwurf angelegt.', weiter: basis + '/{id}/bearbeiten' }));
    const adminAktionen = admin ? [
      a.gesperrt ? knopf('admin.aufgabeSperren', { id: a.id, gesperrt: false }, 'Entsperren', { erfolg: 'Aufgabe entsperrt.' }) : `<form class="inline-form" data-aktion="admin.aufgabeSperren" data-erfolg="Aufgabe gesperrt. Betroffene wurden informiert."><input type="hidden" name="id" value="${esc(a.id)}"><input type="hidden" name="gesperrt" value="true"><label class="sr-only" for="sperrgrund">Grund</label><input id="sperrgrund" name="grund" placeholder="Grund (optional)" maxlength="200"><button class="btn gefahr" type="submit" data-bestaetigen="Aufgabe sperren? Sie kann dann weder bearbeitet noch zugewiesen werden. Abgaben bleiben erhalten.">Sperren</button></form>`,
      knopf('admin.aufgabeAusblenden', { id: a.id, ausgeblendet: !a.ausgeblendet }, a.ausgeblendet ? 'Wieder einblenden' : 'Vorübergehend ausblenden', { erfolg: a.ausgeblendet ? 'Wieder sichtbar.' : 'Ausgeblendet.', frage: a.ausgeblendet ? '' : 'Aufgabe für Schüler/innen vorübergehend ausblenden?' }),
      knopf('admin.aufgabeBibliothek', { id: a.id, bibliothek: !a.bibliothek }, a.bibliothek ? 'Aus Bibliothek entfernen' : 'In Bibliothek freigeben', { erfolg: 'Bibliothek aktualisiert.' }),
      knopf('admin.aufgabeLoeschen', { id: a.id }, 'Löschen', { art: 'gefahr', frage: 'Aufgabe endgültig löschen? Das geht nur, wenn es keine Abgaben gibt.', erfolg: 'Aufgabe gelöscht.', weiter: basis }),
    ] : [];
    return `<nav class="crumbs"><a href="${basis}">${admin ? 'Aufgabenverwaltung' : 'Meine Aufgaben'}</a><span>›</span><span>${esc(a.titel)}</span></nav>
      <header class="bereich-kopf${admin ? ' admin' : ''}"><span class="bereich">${admin ? 'Verwaltung' : 'Lehrerbereich'} · Aufgabe</span><h1>${esc(a.titel)}</h1>
        <div class="topic-status">${statusChip(a.status)}${a.gesperrt ? chip('gesperrt', 'warn') : ''}${a.ausgeblendet ? chip('ausgeblendet', 'warn') : ''}${a.bibliothek ? chip('Bibliothek', 'info') : ''}${a.vorlage ? chip('Vorlage') : ''}<span>${esc(FACH(a.fachId))}${a.thema ? ' · ' + esc(a.thema) : ''}</span><span>von ${esc(a.ersteller)}</span></div></header>
      ${a.gesperrt ? '<p class="gesperrt-hinweis">Diese Aufgabe ist von der Administration gesperrt: Sie kann nicht bearbeitet und nicht neu zugewiesen werden. Bestehende Abgaben bleiben erhalten.</p>' : ''}
      <div class="aktionen" style="margin:12px 0">${aktionen.join('')}</div>
      ${adminAktionen.length ? `<section class="panel"><h2>Verwaltung</h2><div class="aktionen">${adminAktionen.join('')}</div></section>` : ''}
      <div class="seitenleiste"><div>
        ${vorschau(a)}
        ${a.musterloesung ? `<section class="panel"><h2>Musterlösung (nur für Lehrkräfte)</h2>${text(a.musterloesung)}</section>` : ''}
        <section class="panel"><h2>Zuweisungen</h2>${d.zuweisungen.length ? `<div class="table-wrap"><table class="tabelle"><thead><tr><th>Klasse</th><th>Fällig</th><th>Stand</th><th>Aktionen</th></tr></thead><tbody>${d.zuweisungen.map(z => zuweisungZeile(Object.assign({}, z, { titel: z.klasse }), false, true).replace(`href="/lehrer/aufgaben/${esc(z.aufgabeId)}"`, `href="${admin ? '/admin/schule' : '/lehrer/klassen/' + esc(z.klasseId)}"`)).join('')}</tbody></table></div>${LEGENDE}` : leer('Noch keiner Klasse zugewiesen.')}
          ${d.darfZuweisen && d.meineKlassen.length ? `<h3>Zuweisen</h3><form class="formular" data-aktion="aufgabe.zuweisen" data-listen="klassen" data-erfolg="Zugewiesen. Die Schüler/innen wurden benachrichtigt.">${fehlerBox}<input type="hidden" name="id" value="${esc(a.id)}">
            <fieldset><legend>Klassen und Lerngruppen</legend><div class="checks">${d.meineKlassen.map(k => `<label class="check"><input type="checkbox" name="klassen" value="${esc(k.id)}"> ${esc(k.name)}</label>`).join('')}</div></fieldset>
            <label class="feld" style="max-width:220px"><span>Fällig am</span><input type="date" name="faellig" required min="${heute()}"></label>
            <div class="knoepfe"><button class="btn primary" type="submit">Zuweisen</button></div></form>`
            : !d.darfZuweisen ? `<p class="small muted">${a.status !== 'veroeffentlicht' ? 'Veröffentliche die Aufgabe, um sie zuzuweisen.' : 'Diese Aufgabe kann gerade nicht zugewiesen werden.'}</p>` : `<p class="small muted">Du unterrichtest das Fach ${esc(FACH(a.fachId))} in keiner deiner Klassen.</p>`}
        </section>
      </div><aside class="stapel">
        <section class="panel" style="margin:0"><h2>Eckdaten</h2><ul class="liste">
          <li><span class="meta">Schwierigkeit</span><span class="diff diff-${esc(a.schwierigkeit)}">${esc(a.schwierigkeit)}</span></li>
          <li><span class="meta">Zeit</span><span>ca. ${a.minuten} min</span></li><li><span class="meta">Punkte</span><span>${a.punkte || '–'}</span></li>
          <li><span class="meta">Schlagwörter</span><span>${esc(a.tags.join(', ') || '–')}</span></li>
          <li><span class="meta">Erstellt</span><span>${esc(zeit(a.erstellt))}</span></li><li><span class="meta">Geändert</span><span>${esc(zeit(a.geaendert))}</span></li>
        </ul></section>
        <section class="panel" style="margin:0"><h2>Änderungsverlauf</h2><ul class="liste">${d.verlauf.map(v => `<li><div><strong class="small">${esc(v.aktion)}</strong><div class="meta">${esc(v.wer)} · ${esc(zeit(v.zeit))}</div></div></li>`).join('')}</ul></section>
      </aside></div>`;
  }
  function zuweisungAbgaben(d, admin) {
    const z = d.zuweisung;
    return `<nav class="crumbs"><a href="${admin ? '/admin/aufgaben' : '/lehrer'}">${admin ? 'Aufgabenverwaltung' : 'Lehrerbereich'}</a><span>›</span><a href="${admin ? '/admin/aufgaben/' : '/lehrer/aufgaben/'}${esc(d.aufgabe.id)}">${esc(d.aufgabe.titel)}</a><span>›</span><span>${esc(z.klasse)}</span></nav>
      <header class="bereich-kopf${admin ? ' admin' : ''}"><span class="bereich">Abgaben</span><h1>${esc(d.aufgabe.titel)} – ${esc(z.klasse)}</h1><p class="muted" style="margin:0">fällig ${esc(datum(z.faellig))}${z.zurueckgezogen ? ' · zurückgezogen' : ''}</p></header>
      <div class="kacheln">${kachel('Schüler/innen', z.statistik.schueler)}${kachel('Abgegeben', z.statistik.abgegeben, 'warten auf Korrektur', z.statistik.abgegeben ? 'warn' : '')}${kachel('Korrigiert', z.statistik.korrigiert, '', 'ok')}${kachel('Überfällig', z.statistik.ueberfaellig, '', z.statistik.ueberfaellig ? 'warn' : '')}${kachel('Erledigt', z.statistik.erledigtProzent + ' %')}</div>
      <section class="panel"><div class="table-wrap"><table class="tabelle"><thead><tr><th>Name</th><th>Status</th><th>Abgegeben</th><th class="zahl">Punkte</th><th></th></tr></thead><tbody>
        ${d.liste.map(s => `<tr${s.kontoStatus !== 'aktiv' ? ' class="inaktiv"' : ''}><td><a href="${admin ? '/admin/benutzer/' : '/lehrer/schueler/'}${esc(s.schuelerId)}">${esc(s.name)}</a>${s.kontoStatus !== 'aktiv' ? ' ' + statusChip(s.kontoStatus) : ''}</td><td>${statusChip(s.status)}</td><td class="small">${esc(s.abgegebenAm ? zeit(s.abgegebenAm) : '–')}</td><td class="zahl">${s.punkte == null ? '–' : s.punkte + '/' + d.aufgabe.punkte}</td><td>${s.abgabeId && s.status !== 'in_arbeit' ? `<a class="btn klein${s.status === 'abgegeben' ? ' primary' : ''}" href="/lehrer/abgaben/${esc(s.abgabeId)}">${s.status === 'abgegeben' ? 'Korrigieren' : 'Ansehen'}</a>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }
  function abgabeKorrektur(d) {
    const ab = d.abgabe, a = d.aufgabe, z = d.zuweisung;
    const eingereicht = !['in_arbeit', 'zurueckgegeben', 'offen', 'ueberfaellig'].includes(ab.status);
    return `<nav class="crumbs"><a href="/lehrer">Lehrerbereich</a><span>›</span><a href="/lehrer/zuweisungen/${esc(z.id)}">${esc(a.titel)} · ${esc(z.klasse)}</a><span>›</span><span>${esc(ab.schueler)}</span></nav>
      <header class="bereich-kopf"><span class="bereich">Lehrerbereich · Abgabe</span><h1>${esc(ab.schueler)}: ${esc(a.titel)}</h1>
        <div class="topic-status">${statusChip(ab.status)}<span>abgegeben ${esc(zeit(ab.abgegebenAm))}${ab.verspaetet ? ' · <strong>nach dem Abgabedatum</strong>' : ''}</span><span>Versuch ${ab.versuch || 1}</span></div></header>
      <div class="seitenleiste"><div>
        <section class="panel"><h2>Abgabe</h2><div class="abgabe-text">${esc(ab.text || '(leer)')}</div></section>
        <section class="panel"><h2>Bisheriges Feedback</h2>${d.feedback.length ? d.feedback.map(f => `<div class="feedback"><strong>${esc(f.lehrer)}</strong> <span class="small muted">${esc(zeit(f.zeit))}</span>${f.punkte != null ? ` · ${f.punkte}/${a.punkte} Punkte` : ''}${f.text ? text(f.text) : ''}</div>`).join('') : leer('Noch kein Feedback.')}</section>
        ${eingereicht ? `<section class="panel"><h2>Bewerten</h2><form class="formular" data-aktion="abgabe.bewerten" data-erfolg="Bewertung gespeichert. ${esc(ab.schueler)} wurde benachrichtigt." data-weiter="/lehrer/zuweisungen/${esc(z.id)}">${fehlerBox}<input type="hidden" name="id" value="${esc(ab.id)}">
            <label class="feld"><span>Feedback</span><textarea name="text" rows="4" maxlength="2000"></textarea><small>Pflicht bei „korrigiert“. „Kontrolliert“ geht auch ohne Text.</small></label>
            <div class="reihe">${a.punkte ? `<label class="feld"><span>Punkte (max. ${a.punkte})</span><input type="number" name="punkte" min="0" max="${a.punkte}" step="0.5"></label>` : ''}<label class="feld"><span>Markieren als</span>${auswahl('status', [['korrigiert', 'korrigiert (mit Feedback)'], ['kontrolliert', 'kontrolliert (gesehen)']], 'korrigiert')}</label></div>
            <div class="knoepfe"><button class="btn primary" type="submit">Speichern</button></div></form></section>
          <section class="panel"><h2>Erneute Bearbeitung ermöglichen</h2><form class="formular" data-aktion="abgabe.wiederoeffnen" data-erfolg="Zur Überarbeitung zurückgegeben." data-weiter="/lehrer/zuweisungen/${esc(z.id)}">${fehlerBox}<input type="hidden" name="id" value="${esc(ab.id)}">
            <label class="feld"><span>Hinweis an ${esc(ab.schueler)} (optional)</span><textarea name="text" rows="2" maxlength="2000"></textarea></label>
            <div class="knoepfe"><button class="btn" type="submit" data-bestaetigen="Abgabe zur Überarbeitung zurückgeben?">Zurückgeben</button></div></form></section>` : `<p class="small muted">Die Abgabe ist gerade nicht eingereicht.</p>`}
      </div><aside class="stapel">
        <section class="panel" style="margin:0"><h2>Aufgabe</h2>${text(a.anweisung)}${a.kriterien ? `<h3>Kriterien</h3><p>${esc(a.kriterien)}</p>` : ''}</section>
        ${a.musterloesung ? `<section class="panel" style="margin:0"><h2>Musterlösung</h2>${text(a.musterloesung)}</section>` : ''}
      </aside></div>`;
  }
  function bibliothek(d, q) {
    return `${kopf('lehrer', 'Aufgabenbibliothek', 'Freigegebene Aufgaben der Schule und deine eigenen Vorlagen.', '/lehrer/bibliothek')}
      <form class="filterleiste" data-get="/lehrer/bibliothek"><label class="suche">Suche<input type="search" name="q" value="${esc(q.q || '')}" maxlength="80"></label>
        <label>Fach${auswahl('fach', FAECHER_OPT(), q.fach, 'alle')}</label><label>Schwierigkeit${auswahl('schwierigkeit', SCHWIERIGKEIT, q.schwierigkeit, 'alle')}</label>
        <label>Schlagwort${auswahl('tag', d.tags.map(t => [t, t]), q.tag, 'alle')}</label><button class="btn" type="submit">Filtern</button>${Object.keys(q).some(k => q[k]) ? '<a class="btn" href="/lehrer/bibliothek">Zurücksetzen</a>' : ''}</form>
      <div class="cards">${d.liste.map(a => `<article class="card"><div class="card-top"><h3><a href="/lehrer/aufgaben/${esc(a.id)}">${esc(a.titel)}</a></h3>${a.vorlage && !a.bibliothek ? chip('meine Vorlage') : chip(a.fach, 'info')}</div>
        <p>${esc(a.anweisung.length > 160 ? a.anweisung.slice(0, 157) + '…' : a.anweisung)}</p>
        <div class="card-meta"><span class="diff diff-${esc(a.schwierigkeit)}">${esc(a.schwierigkeit)}</span>${chip('ca. ' + a.minuten + ' min')}${a.tags.map(t => chip(t)).join('')}</div>
        <div class="aktionen" style="margin-top:8px"><a class="btn klein primary" href="/lehrer/aufgaben/${esc(a.id)}">Ansehen & zuweisen</a><button type="button" class="btn klein" data-aktion="aufgabe.duplizieren" data-daten='${esc(JSON.stringify({ id: a.id }))}' data-erfolg="Als Entwurf übernommen." data-weiter="/lehrer/aufgaben/{id}/bearbeiten">Als Kopie übernehmen</button></div></article>`).join('') || leer('Keine passenden Aufgaben.')}</div>`;
  }
  function lehrerStatistik(liste) {
    return `${kopf('lehrer', 'Statistik', 'Bearbeitungsstand aller Aufgaben in deinen Klassen.', '/lehrer/statistik')}
      ${liste.map(k => `<section class="panel"><div class="panel-kopf"><h2><a href="/lehrer/klassen/${esc(k.id)}">${esc(k.klasse)}</a></h2><span class="muted">${k.aufgaben} Aufgaben${k.mittel != null ? ' · Ø ' + k.mittel + ' % erledigt' : ''}</span></div>
        ${k.zuweisungen.length ? `<div class="table-wrap"><table class="tabelle"><thead><tr><th>Aufgabe</th><th>Fällig</th><th>Stand</th><th></th></tr></thead><tbody>${k.zuweisungen.map(z => zuweisungZeile(z, false, false)).join('')}</tbody></table></div>` : leer('Keine Aufgaben.')}</section>`).join('')}${LEGENDE}`;
  }

  // ================================================================== Administration
  function adminUebersicht(d) {
    const k = d.konten;
    const liste = (l, f) => l.length ? `<ul class="liste">${l.map(f).join('')}</ul>` : leer('Keine Einträge.');
    return `${kopf('admin', 'Verwaltung', 'Konten, Aufgaben, Schulstruktur und Einstellungen der Testumgebung.', '/admin')}
      ${d.wartung ? '<p class="alert"><strong>Wartungsmodus ist an.</strong> Nur die Administration kann die Lernseite nutzen. <a href="/admin/system">Ändern</a></p>' : ''}
      <div class="kacheln">
        ${kachel('Konten', k.gesamt, `${k.rollen.student || 0} Schüler · ${k.rollen.teacher || 0} Lehrer · ${k.rollen.admin || 0} Admin`, '', '/admin/benutzer')}
        ${kachel('Gesperrt / deaktiviert', (k.status.gesperrt || 0) + ' / ' + (k.status.deaktiviert || 0), '', k.status.gesperrt ? 'warn' : '', '/admin/benutzer?status=gesperrt')}
        ${kachel('Aktive Sitzungen', k.aktiveSitzungen)}
        ${kachel('Aufgaben', d.aufgaben.veroeffentlicht, `${d.aufgaben.entwurf} Entwürfe · ${d.aufgaben.archiviert} archiviert`, '', '/admin/aufgaben')}
        ${kachel('Gesperrte Aufgaben', d.aufgaben.gesperrt, d.aufgaben.ausgeblendet + ' ausgeblendet', d.aufgaben.gesperrt ? 'warn' : '', '/admin/aufgaben?status=gesperrt')}
        ${kachel('Fehlversuche (24 h)', d.fehlversuche24h, 'Anmeldungen', d.fehlversuche24h >= 5 ? 'warn' : '', '/admin/protokoll')}
      </div>
      <div class="zwei">
        <section class="panel"><h2>Auffällige Rollenwechsel</h2>${liste(d.auffaellig, l => `<li><div><strong>${esc(l.ziel)}</strong><div class="meta">${esc(l.details)} · durch ${esc(l.akteur)} · ${esc(zeit(l.zeit))}</div><div class="small" style="color:var(--warn)">${esc(l.grund)}</div></div></li>`)}</section>
        <section class="panel"><h2>Kürzlich gesperrte Konten</h2>${liste(d.gesperrteKonten, l => `<li><div><strong>${esc(l.ziel)}</strong><div class="meta">${esc(l.akteur)} · ${esc(zeit(l.zeit))}${l.details ? ' · ' + esc(l.details) : ''}</div></div></li>`)}</section>
      </div>
      <div class="zwei">
        <section class="panel"><div class="panel-kopf"><h2>Fehlgeschlagene Anmeldungen</h2><a href="/admin/protokoll">Alle →</a></div>${liste(d.fehlversuche, v => `<li><span><strong>${esc(v.username || '(leer)')}</strong> <span class="meta">${esc(v.grund)}</span></span><span class="meta">${esc(zeit(v.zeit))}</span></li>`)}</section>
        <section class="panel"><div class="panel-kopf"><h2>Letzte Aktionen</h2><a href="/admin/protokoll">Protokoll →</a></div>${liste(d.letzteAktionen, l => `<li><div><strong class="small">${esc(AKTION(l.aktion))}</strong><div class="meta">${esc(l.akteur)} · ${esc(l.ziel)}</div></div><span class="meta">${esc(zeit(l.zeit))}</span></li>`)}</section>
      </div>`;
  }
  function adminBenutzer(liste, q, klassen) {
    return `${kopf('admin', 'Konten', 'Alle Konten der Testumgebung durchsuchen, filtern und verwalten.', '/admin/benutzer', '<a class="btn admin" href="/admin/benutzer/neu">+ Testkonto anlegen</a>')}
      <form class="filterleiste" data-get="/admin/benutzer"><label class="suche">Name, Benutzername, Kennung<input type="search" name="q" value="${esc(q.q || '')}" maxlength="80"></label>
        <label>Rolle${auswahl('rolle', [['student', 'Schüler/in'], ['teacher', 'Lehrkraft'], ['admin', 'Administration']], q.rolle, 'alle')}</label>
        <label>Status${auswahl('status', [['aktiv', 'aktiv'], ['gesperrt', 'gesperrt'], ['deaktiviert', 'deaktiviert']], q.status, 'alle')}</label>
        <label>Klasse${auswahl('klasse', klassen.map(k => [k.id, k.name]), q.klasse, 'alle')}</label>
        <button class="btn" type="submit">Filtern</button>${Object.keys(q).some(k => q[k]) ? '<a class="btn" href="/admin/benutzer">Zurücksetzen</a>' : ''}</form>
      <p class="small muted">${liste.length} Konten</p>
      <div class="table-wrap"><table class="tabelle"><thead><tr><th>Name</th><th>Rolle</th><th>Klassen / Unterricht</th><th>Status</th><th>Letzter Login</th><th class="zahl">Sitzungen</th></tr></thead><tbody>
        ${liste.map(p => `<tr${p.status !== 'aktiv' ? ' class="inaktiv"' : ''}><td><div class="zelle-person">${avatar(p)}<div><a href="/admin/benutzer/${esc(p.id)}">${esc(p.name)}</a><div class="small muted">${esc(p.username)} · ${esc(p.kennung || '')}</div></div></div></td><td>${rolleChip(p.rolle, p.rolleName)}</td>
          <td class="small">${esc(p.klassen.map(k => k.id).join(', ') || (p.unterricht || []).map(u => u.fach + ' ' + u.klasseId).join(', ') || p.funktion || '–')}</td><td>${statusChip(p.status)}</td><td class="small">${esc(p.letzterLogin ? zeit(p.letzterLogin) : 'noch nie')}</td><td class="zahl">${p.sitzungen}</td></tr>`).join('') || `<tr><td colspan="6">${leer('Keine Konten gefunden.')}</td></tr>`}
      </tbody></table></div>`;
  }
  function adminBenutzerNeu(klassen) {
    return `<nav class="crumbs"><a href="/admin/benutzer">Konten</a><span>›</span><span>Testkonto anlegen</span></nav>
      <header class="bereich-kopf admin"><span class="bereich">Verwaltung</span><h1>Testkonto anlegen</h1><p class="muted" style="margin:0">Das Konto erscheint danach auf der simulierten Anmeldeseite.</p></header>
      <form class="formular panel" data-aktion="admin.benutzerErstellen" data-erfolg="Konto angelegt." data-weiter="/admin/benutzer/{id}" style="max-width:640px">${fehlerBox}
        <div class="reihe"><label class="feld"><span>Vorname *</span><input name="vorname" required maxlength="40"></label><label class="feld"><span>Nachname *</span><input name="nachname" required maxlength="40"></label></div>
        <div class="reihe"><label class="feld"><span>Rolle</span>${auswahl('rolle', [['student', 'Schüler/in'], ['teacher', 'Lehrkraft'], ['admin', 'Administration']], 'student')}</label>
          <label class="feld"><span>Klasse (nur Schüler/innen)</span>${auswahl('klasse', klassen.filter(k => k.typ === 'klasse').map(k => [k.id, k.name]), '', '– wählen –')}</label></div>
        <label class="feld"><span>Passwort (nur Lehrkräfte und Administration)</span><input type="password" name="passwort" minlength="10" maxlength="128" autocomplete="new-password"><small>Mindestens 10 Zeichen. Wird sofort mit Argon2id gehasht, der Klartext wird nicht gespeichert.</small></label>
        <div class="knoepfe"><button class="btn admin" type="submit">Konto anlegen</button><a class="btn" href="/admin/benutzer">Abbrechen</a></div></form>`;
  }
  function adminBenutzerDetail(d) {
    const p = d.profil;
    const knopf = (status, t, art, frage) => `<button type="button" class="btn ${art || ''}" data-aktion="admin.status" data-daten='${esc(JSON.stringify({ id: p.id, status }))}' data-bestaetigen="${esc(frage)}" data-erfolg="Status geändert.">${t}</button>`;
    const statusKnoepfe = d.ich ? '<p class="small muted">Das eigene Konto kannst du hier nicht sperren oder ändern.</p>' : [
      p.status === 'aktiv' ? knopf('gesperrt', 'Sperren', 'gefahr', `${p.name} sperren? Alle Sitzungen enden sofort.`) : '',
      p.status === 'gesperrt' ? knopf('aktiv', 'Entsperren', 'primary', `${p.name} entsperren?`) : '',
      p.status !== 'deaktiviert' ? knopf('deaktiviert', 'Deaktivieren', 'gefahr', `${p.name} deaktivieren? Das Konto kann sich nicht mehr anmelden und erhält keine Mitteilungen.`) : knopf('aktiv', 'Reaktivieren', 'primary', `${p.name} reaktivieren?`),
      `<button type="button" class="btn" data-aktion="admin.sitzungenWiderrufen" data-daten='${esc(JSON.stringify({ id: p.id }))}' data-bestaetigen="Alle Sitzungen von ${esc(p.name)} beenden?" data-erfolg="Sitzungen beendet.">Sitzungen widerrufen (${d.sitzungen.length})</button>`,
    ].join('');
    const lz = d.lehrerzuordnungen;
    return `<nav class="crumbs"><a href="/admin/benutzer">Konten</a><span>›</span><span>${esc(p.name)}</span></nav>
      <header class="bereich-kopf admin"><span class="bereich">Verwaltung · Konto</span><div class="zelle-person">${avatar(p, true)}<div><h1 style="margin:0">${esc(p.name)}</h1><div class="muted">${esc(p.username)} · ${esc(p.kennung || '')} · ${rolleChip(p.rolle, p.rolleName)} ${statusChip(p.status)}</div></div></div></header>
      <section class="panel"><h2>Status</h2><div class="aktionen">${statusKnoepfe}</div>
        <p class="small muted">Erstellt ${esc(zeit(p.erstellt))} (${p.quelle === 'admin' ? 'von der Administration' : 'aus dem simulierten Schulverzeichnis'}) · letzter Login ${esc(p.letzterLogin ? zeit(p.letzterLogin) : 'noch nie')}</p></section>
      <div class="zwei">
        ${d.ich ? '' : `<section class="panel"><h2>Rolle ändern</h2><form class="formular" data-aktion="admin.rolle" data-erfolg="Rolle geändert. Alle Sitzungen des Kontos wurden beendet.">${fehlerBox}<input type="hidden" name="id" value="${esc(p.id)}">
          <label class="feld"><span>Neue Rolle</span>${auswahl('rolle', [['student', 'Schüler/in'], ['teacher', 'Lehrkraft'], ['admin', 'Administration']], p.rolle)}</label>
          <label class="feld"><span>Passwort für das Konto</span><input type="password" name="neuesPasswort" minlength="10" maxlength="128" autocomplete="new-password"><small>Nur nötig, wenn ein Schülerkonto Lehrkraft oder Administration wird.</small></label>
          <label class="feld"><span>Dein eigenes Passwort zur Bestätigung *</span><input type="password" name="passwort" required maxlength="256" autocomplete="current-password"><small>Rollenwechsel verlangen eine erneute Berechtigungsprüfung.</small></label>
          <div class="knoepfe"><button class="btn admin" type="submit" data-bestaetigen="Rolle wirklich ändern? Das wird protokolliert.">Rolle ändern</button></div></form></section>`}
        ${p.rolle === 'student' ? `<section class="panel"><h2>Klassen und Lerngruppen</h2><form class="formular" data-aktion="admin.klassenzuordnung" data-listen="klassen" data-erfolg="Zuordnung gespeichert.">${fehlerBox}<input type="hidden" name="id" value="${esc(p.id)}">
            <fieldset><legend>Genau eine Klasse, beliebig viele Kurse</legend><div class="checks">${d.klassen.map(k => `<label class="check"><input type="checkbox" name="klassen" value="${esc(k.id)}"${p.klassen.some(x => x.id === k.id) ? ' checked' : ''}> ${esc(k.name)}</label>`).join('')}</div></fieldset>
            <div class="knoepfe"><button class="btn" type="submit">Speichern</button></div></form></section>` : ''}
        ${p.rolle === 'teacher' ? `<section class="panel"><h2>Lehrerzuordnungen</h2>${lz.length ? `<ul class="liste">${lz.map(z => `<li><span>${esc(FACH(z.fachId))} in ${esc(z.klasseId)}</span><button type="button" class="btn klein gefahr" data-aktion="admin.lehrerzuordnung" data-daten='${esc(JSON.stringify({ modus: 'entfernen', zuordnungId: z.id }))}' data-bestaetigen="Zuordnung entfernen?" data-erfolg="Zuordnung entfernt.">Entfernen</button></li>`).join('')}</ul>` : leer('Keine Zuordnungen.')}
            <form class="formular" data-aktion="admin.lehrerzuordnung" data-erfolg="Zuordnung hinzugefügt.">${fehlerBox}<input type="hidden" name="modus" value="hinzu"><input type="hidden" name="lehrerId" value="${esc(p.id)}"><div class="reihe"><label class="feld"><span>Klasse</span>${auswahl('klasseId', d.klassen.map(k => [k.id, k.name]), '')}</label><label class="feld"><span>Fach</span>${auswahl('fachId', d.faecher.map(f => [f.id, f.name]), '')}</label></div><div class="knoepfe"><button class="btn" type="submit">Hinzufügen</button></div></form></section>` : ''}
      </div>
      ${d.aufgabenstand ? `<section class="panel"><h2>Lernstand</h2><div class="kacheln">${kachel('Aufgaben erledigt', d.aufgabenstand.prozent + ' %')}${kachel('Offen', d.aufgabenstand.offen)}${kachel('Gelöste Übungen', d.fortschritt.geloest)}${kachel('Richtige Antworten', d.fortschritt.richtigQuote == null ? '–' : d.fortschritt.richtigQuote + ' %')}</div></section>` : ''}
      <div class="zwei">
        <section class="panel"><h2>Aktivität</h2>${d.aktivitaet.length ? `<ul class="liste">${d.aktivitaet.map(l => `<li><div><strong class="small">${esc(AKTION(l.aktion))}</strong><div class="meta">${esc(l.akteur)} · ${esc(l.details)}</div></div><span class="meta">${esc(zeit(l.zeit))}</span></li>`).join('')}</ul>` : leer('Keine Einträge.')}</section>
        <section class="panel"><h2>Anmeldeversuche</h2>${d.anmeldungen.length ? `<ul class="liste">${d.anmeldungen.map(v => `<li><span>${v.erfolg ? '<span class="ok-text">erfolgreich</span>' : `<span style="color:var(--warn);font-weight:600">fehlgeschlagen</span> <span class="meta">${esc(v.grund)}</span>`}</span><span class="meta">${esc(zeit(v.zeit))}</span></li>`).join('')}</ul>` : leer('Keine Anmeldungen.')}</section>
      </div>`;
  }
  function adminAufgaben(liste, q, personen, klassen) {
    return `${kopf('admin', 'Aufgaben', 'Alle Aufgaben der Schule: filtern, sperren, ausblenden, archivieren, Bibliothek pflegen.', '/admin/aufgaben', '<a class="btn admin" href="/admin/aufgaben/neu">+ Zentrale Aufgabe</a>')}
      ${aufgabenFilter('/admin/aufgaben', q, true, `<label>Erstellt von${auswahl('ersteller', personen.map(p => [p.id, p.name]), q.ersteller, 'alle')}</label><label>Klasse${auswahl('klasse', klassen.map(k => [k.id, k.name]), q.klasse, 'alle')}</label><label>Erstellt ab<input type="date" name="von" value="${esc(q.von || '')}"></label><label>bis<input type="date" name="bis" value="${esc(q.bis || '')}"></label>`)}
      <p class="small muted">${liste.length} Aufgaben</p>${aufgabenTabelle(liste, '/admin/aufgaben', true)}`;
  }
  function adminSchule(d) {
    return `${kopf('admin', 'Klassen & Fächer', 'Klassen, Lerngruppen, Fächer, Lernbereiche und Lehrerzuordnungen.', '/admin/schule')}
      <section class="panel"><h2>Klassen und Lerngruppen</h2>
        ${d.klassen.map(k => `<details class="aufklapp"><summary>${esc(k.name)} <span class="meta">· ${k.typ === 'kurs' ? 'Kurs' : 'Klasse'} · Stufe ${k.stufe} · ${k.schueler} Schüler/innen · ${k.lehrer} Zuordnungen · Leitung ${esc(k.leitung)}</span> ${k.aktiv ? '' : chip('inaktiv')}</summary>
          <form class="formular" data-aktion="admin.klasseSpeichern" data-erfolg="Klasse gespeichert.">${fehlerBox}<input type="hidden" name="id" value="${esc(k.id)}">
            <div class="reihe"><label class="feld"><span>Name</span><input name="name" required maxlength="60" value="${esc(k.name)}"></label><label class="feld"><span>Typ</span>${auswahl('typ', [['klasse', 'Klasse'], ['kurs', 'Kurs / Lerngruppe']], k.typ)}</label><label class="feld"><span>Stufe</span><input type="number" name="stufe" min="5" max="13" value="${k.stufe}"></label><label class="feld"><span>Klassenleitung</span>${auswahl('leitungId', d.lehrer.map(l => [l.id, l.name]), k.leitungId, '– keine –')}</label></div>
            <label class="check"><input type="checkbox" name="aktiv"${k.aktiv ? ' checked' : ''}> aktiv</label>
            <div class="knoepfe"><button class="btn" type="submit">Speichern</button><a class="btn" href="/admin/benutzer?klasse=${esc(k.id)}">Mitglieder anzeigen</a></div></form></details>`).join('')}
        <details class="aufklapp"><summary>+ Neue Klasse oder Lerngruppe</summary><form class="formular" data-aktion="admin.klasseSpeichern" data-erfolg="Klasse angelegt.">${fehlerBox}<input type="hidden" name="neu" value="true">
          <div class="reihe"><label class="feld"><span>Kennung (z. B. 8b)</span><input name="id" required maxlength="20" pattern="[a-z0-9-]+"></label><label class="feld"><span>Name</span><input name="name" required maxlength="60"></label><label class="feld"><span>Typ</span>${auswahl('typ', [['klasse', 'Klasse'], ['kurs', 'Kurs / Lerngruppe']], 'klasse')}</label><label class="feld"><span>Stufe</span><input type="number" name="stufe" min="5" max="13" value="9"></label></div>
          <div class="knoepfe"><button class="btn admin" type="submit">Anlegen</button></div></form></details>
      </section>
      <section class="panel"><h2>Fächer und Lernbereiche</h2><div class="zwei">${d.faecher.map(f => `<form class="formular" data-aktion="admin.fachSpeichern" data-erfolg="Fach gespeichert." style="border:1px solid var(--border);border-radius:10px;padding:12px">${fehlerBox}<input type="hidden" name="id" value="${esc(f.id)}">
          <div class="panel-kopf"><h3>${esc(f.name)}</h3><span class="meta">${f.themen} Themen · ${f.aufgaben} Aufgaben</span></div>
          <label class="check"><input type="checkbox" name="aktiv"${f.aktiv ? ' checked' : ''}> für neue Aufgaben verfügbar</label>
          <label class="feld"><span>Lernbereiche (eine Zeile je Bereich)</span><textarea name="lernbereiche" rows="4" maxlength="1000">${esc(f.lernbereiche.join('\n'))}</textarea></label>
          <div class="knoepfe"><button class="btn klein" type="submit">Speichern</button></div></form>`).join('')}</div></section>
      <section class="panel"><h2>Lehrerzuordnungen</h2>
        <form class="filterleiste" data-aktion="admin.lehrerzuordnung" data-erfolg="Zuordnung hinzugefügt."><input type="hidden" name="modus" value="hinzu">${fehlerBox}
          <label>Lehrkraft${auswahl('lehrerId', d.lehrer.map(l => [l.id, l.name]), '', '– wählen –')}</label><label>Klasse${auswahl('klasseId', d.klassen.map(k => [k.id, k.name]), '', '– wählen –')}</label><label>Fach${auswahl('fachId', d.faecher.map(f => [f.id, f.name]), '', '– wählen –')}</label><button class="btn admin" type="submit">Zuordnen</button></form>
        <div class="table-wrap"><table class="tabelle"><thead><tr><th>Lehrkraft</th><th>Klasse</th><th>Fach</th><th></th></tr></thead><tbody>${d.zuordnungen.map(z => `<tr><td><a href="/admin/benutzer/${esc(z.lehrerId)}">${esc(z.lehrer)}</a></td><td>${esc(z.klasse)}</td><td>${esc(z.fach)}</td><td><button type="button" class="btn klein gefahr" data-aktion="admin.lehrerzuordnung" data-daten='${esc(JSON.stringify({ modus: 'entfernen', zuordnungId: z.id }))}' data-bestaetigen="Zuordnung ${esc(z.lehrer)} · ${esc(z.klasse)} · ${esc(z.fach)} entfernen?" data-erfolg="Zuordnung entfernt.">Entfernen</button></td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function adminSystem(d) {
    const e = d.einstellungen, s = d.status;
    return `${kopf('admin', 'System', 'Einstellungen der Testumgebung, Systemstatus, Export und Zurücksetzen.', '/admin/system')}
      <div class="zwei">
        <section class="panel"><h2>Einstellungen</h2><form class="formular" data-aktion="admin.einstellungen" data-erfolg="Einstellungen gespeichert.">${fehlerBox}
          <fieldset><legend>Wartungsmodus</legend><label class="check"><input type="checkbox" name="wartung"${e.wartung ? ' checked' : ''}> Wartungsmodus an (nur Administration kann die Seite nutzen)</label><label class="feld"><span>Hinweistext</span><input name="wartungstext" maxlength="300" value="${esc(e.wartungstext)}"></label></fieldset>
          <fieldset><legend>Lernfunktionen</legend>${Object.entries(d.funktionen).map(([k, t]) => `<label class="check"><input type="checkbox" name="f_${k}"${e.funktionen[k] !== false ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>
          <fieldset><legend>Benachrichtigungen</legend>${Object.entries(d.benachrichtigungen).map(([k, t]) => `<label class="check"><input type="checkbox" name="b_${k}"${e.benachrichtigungen[k] !== false ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>
          <label class="feld" style="max-width:260px"><span>Sitzung endet nach Inaktivität (Minuten)</span><input type="number" name="sitzungMinuten" min="5" max="480" value="${e.sitzungMinuten}"></label>
          <div class="knoepfe"><button class="btn admin" type="submit">Speichern</button></div></form></section>
        <div class="stapel">
          <section class="panel" style="margin:0"><h2>Systemstatus</h2><ul class="liste">
            <li><span class="meta">Datenbank</span><span>${esc(s.speicher)}</span></li>
            <li><span class="meta">Schema-Version</span><span>${s.version}${s.version === s.zielVersion ? ' (aktuell)' : ' → ' + s.zielVersion}</span></li>
            <li><span class="meta">Angelegt</span><span>${esc(zeit(s.erstellt))}</span></li>
            <li><span class="meta">Größe</span><span>${(s.groesse / 1024).toFixed(1)} KB</span></li>
            <li><span class="meta">Server-Verbindung</span><span>keine (statische Testseite)</span></li>
            <li><span class="meta">Integrität</span><span>${s.integritaet.length ? `<span style="color:var(--warn)">${s.integritaet.length} Probleme</span>` : '<span class="ok-text">in Ordnung</span>'}</span></li>
          </ul>${s.integritaet.length ? `<ul class="small">${s.integritaet.slice(0, 10).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          <details class="aufklapp" style="margin-top:10px"><summary>Tabellen (${s.tabellen.length})</summary><div class="table-wrap"><table><tbody>${s.tabellen.map(t => `<tr><td class="code-klein">${esc(t.name)}</td><td class="zahl">${t.zeilen}</td></tr>`).join('')}</tbody></table></div></details></section>
          <section class="panel" style="margin:0"><h2>Statistik exportieren</h2><p class="small muted">CSV mit zusammengefassten Zahlen je Klasse – ohne Namen oder andere personenbezogene Daten.</p><button type="button" class="btn" id="export-csv">CSV herunterladen</button></section>
          <section class="panel" style="margin:0;border-color:var(--warn)"><h2>Testdaten zurücksetzen</h2><p class="small">Löscht alle Änderungen dieser Testumgebung (in diesem Browser) und legt die Testdaten neu an. Alle Sitzungen enden. Produktive Daten gibt es hier nicht – betroffen ist nur der Speicher der Testseite.</p>
            <form class="formular" data-aktion="admin.zuruecksetzen" data-erfolg="Testdaten wurden zurückgesetzt." data-weiter="/anmelden">${fehlerBox}<label class="feld"><span>Zur Bestätigung „TESTDATEN ZURÜCKSETZEN“ eingeben</span><input name="bestaetigung" required autocomplete="off"></label><div class="knoepfe"><button class="btn gefahr" type="submit" data-bestaetigen="Wirklich alle Testdaten zurücksetzen?">Zurücksetzen</button></div></form></section>
        </div>
      </div>`;
  }
  function adminProtokoll(d, q) {
    return `${kopf('admin', 'Protokoll', 'Wichtige Aktionen und Anmeldeversuche. Ohne Passwörter, Tokens oder Lerninhalte.', '/admin/protokoll')}
      <form class="filterleiste" data-get="/admin/protokoll"><label class="suche">Suche (Person, Ziel, Details)<input type="search" name="q" value="${esc(q.q || '')}" maxlength="80"></label><label>Aktion${auswahl('aktion', d.aktionen.map(a => [a, AKTION(a)]), q.aktion, 'alle')}</label><button class="btn" type="submit">Filtern</button>${q.q || q.aktion ? '<a class="btn" href="/admin/protokoll">Zurücksetzen</a>' : ''}</form>
      <section class="panel"><h2>Audit-Log (${d.eintraege.length})</h2><div class="table-wrap"><table class="tabelle"><thead><tr><th>Zeit</th><th>Aktion</th><th>Wer</th><th>Ziel</th><th>Details</th></tr></thead><tbody>
        ${d.eintraege.map(l => `<tr><td class="small" style="white-space:nowrap">${esc(zeit(l.zeit))}</td><td>${l.aktion === 'zugriff_verweigert' || l.aktion === 'rollenwechsel_abgelehnt' ? chip(AKTION(l.aktion), 'warn') : esc(AKTION(l.aktion))}</td><td class="small">${esc(l.akteur)}</td><td class="small">${esc(l.ziel)}</td><td class="small">${esc(l.details)}</td></tr>`).join('') || `<tr><td colspan="5">${leer('Keine Einträge.')}</td></tr>`}
      </tbody></table></div></section>
      <section class="panel"><h2>Anmeldeversuche</h2><div class="table-wrap"><table class="tabelle"><thead><tr><th>Zeit</th><th>Benutzername</th><th>Ergebnis</th></tr></thead><tbody>${d.anmeldungen.map(v => `<tr><td class="small">${esc(zeit(v.zeit))}</td><td>${esc(v.username)}</td><td>${v.erfolg ? chip('erfolgreich', 'ok') : chip(v.grund, 'warn')}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  return {
    FACH, datum, zeit, avatar, chip, kopf, leer, anmelden, idp, wartung, deaktiviert, fehlerSeite, schuelerAufgaben, schuelerAufgabe, fortschritt, mitteilungen, suche, konto,
    lehrerDashboard, lehrerKlasse, lehrerSchueler, lehrerAufgaben, aufgabeFormular, aufgabeDetails, zuweisungAbgaben, abgabeKorrektur, bibliothek, lehrerStatistik,
    adminUebersicht, adminBenutzer, adminBenutzerNeu, adminBenutzerDetail, adminAufgaben, adminSchule, adminSystem, adminProtokoll, aufgabeKarte,
  };
})();
