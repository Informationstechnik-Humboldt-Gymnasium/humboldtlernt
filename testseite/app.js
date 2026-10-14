// Testseite · Steuerung des Schul-, Rollen- und Aufgabensystems: Anmeldung (simulierter IServ-OAuth-Ablauf),
// Sitzung, Seiten der drei Bereiche, Formulare und Aktionen. Alle Daten kommen über SCHULE.api() – dort werden
// Sitzung, Kontostatus und Rechte bei jeder Anfrage geprüft. Diese Datei entscheidet nichts über Berechtigungen.

const SchulApp = (function () {
  let SCHULE = null;
  let ICH = null, CLAIMS = null, LERNSTAND = null, meldung = null, idpFehler = null, idpWahl = null;
  const TOKEN_KEY = 'lernseite-sitzung', STATE_KEY = 'lernseite-oauth-state', CLAIMS_KEY = 'lernseite-identitaet';
  const merk = {};   // Ersatz, wenn sessionStorage nicht verfügbar ist
  const ss = {
    get: k => { try { return sessionStorage.getItem(k); } catch (e) { return merk[k] ?? null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { merk[k] = v; } },
    del: k => { try { sessionStorage.removeItem(k); } catch (e) { delete merk[k]; } },
  };
  const token = () => ss.get(TOKEN_KEY);
  const zufallHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');

  async function api(aktion, daten) {
    const r = await SCHULE.api(token(), aktion, daten || {});
    if (r.code === 401 && token()) {
      ss.del(TOKEN_KEY); ss.del(CLAIMS_KEY); ICH = null; LERNSTAND = null;
      meldung = { text: r.fehler, fehler: true };
    }
    return r;
  }

  /** Vor jeder Seite: Konto und Lernstand der angemeldeten Person laden */
  async function vorbereiten() {
    ICH = null; LERNSTAND = null; CLAIMS = null;
    if (!token()) return;
    const r = await api('konto.ich');
    if (!r.ok) return;
    ICH = r.daten;
    try { CLAIMS = JSON.parse(ss.get(CLAIMS_KEY) || 'null'); } catch (e) { CLAIMS = null; }
    const l = await api('lernstand.lesen');
    if (l.ok) LERNSTAND = l.daten;
  }

  const rolle = () => (ICH ? ICH.profil.rolle : null);
  const START = { student: '/aufgaben', teacher: '/lehrer', admin: '/admin' };
  const query = q => { const o = {}; for (const [k, v] of new URLSearchParams(q || '')) o[k] = v; return o; };

  function antwortSeite(r) {
    if (r.wartung) return { title: 'Wartung', body: SV.wartung(r.fehler) };
    if (r.code === 401) return { umleiten: '/anmelden' };
    if (r.code === 403) return { title: 'Kein Zugriff', body: SV.fehlerSeite('Kein Zugriff', r.fehler) };
    if (r.code === 404) return { title: 'Nicht gefunden', body: SV.fehlerSeite('Nicht gefunden', r.fehler) };
    return { title: 'Fehler', body: SV.fehlerSeite('Fehler', r.fehler || 'Unbekannter Fehler') };
  }
  // Lädt Daten; bei Fehler wird eine passende Fehlerseite statt des Inhalts gezeigt
  async function mit(aktion, daten, fn) {
    const r = await api(aktion, daten);
    return r.ok ? fn(r.daten) : antwortSeite(r);
  }
  function brauche(...rollen) {
    if (!ICH) return { umleiten: '/anmelden' };
    if (!rollen.includes(rolle())) return { title: 'Kein Zugriff', body: SV.fehlerSeite('Kein Zugriff', 'Dieser Bereich ist für deine Rolle nicht freigegeben.') };
    return null;
  }

  /** Seiten des Schulsystems. Gibt null zurück, wenn der Pfad zur normalen Lernseite gehört. */
  async function seite(pfad) {
    const [p, qs] = pfad.split('?');
    const q = query(qs);
    const t = p.split('/').filter(Boolean);
    const w = SCHULE.wartung();
    const frei = ['anmelden', 'iserv', 'impressum', 'datenschutz', 'konto'];
    if (w.an && rolle() !== 'admin' && !frei.includes(t[0])) return { title: 'Wartung', body: SV.wartung(w.text) };

    // ---------------------------------------------------------- Anmeldung
    if (p === '/anmelden') {
      if (ICH) return { umleiten: START[rolle()] };
      return { title: 'Anmelden', body: SV.anmelden() };
    }
    if (p === '/iserv/anmelden') {
      if (!q.state || q.client_id !== SchulBackend.CLIENT_ID || q.redirect_uri !== '/iserv/rueckkehr') return { title: 'Ungültige Anfrage', body: SV.fehlerSeite('Ungültige Anmeldeanfrage', 'Bitte starte die Anmeldung erneut auf der Lernseite.') };
      const f = idpFehler; idpFehler = null;
      return { title: 'Schulserver – Anmeldung (Simulation)', body: SV.idp(SCHULE.oauth.konten(), q, f, idpWahl), ohneNav: true };
    }
    if (p === '/iserv/rueckkehr') {
      const erwartet = ss.get(STATE_KEY);
      ss.del(STATE_KEY);
      const r = await SCHULE.oauth.token({ code: q.code, state: q.state, erwarteterState: erwartet, altesToken: token() });
      if (!r.ok) return { title: 'Anmeldung fehlgeschlagen', body: SV.anmelden(r.fehler) };
      ss.set(TOKEN_KEY, r.daten.token);
      ss.set(CLAIMS_KEY, JSON.stringify(r.daten.claims));
      await vorbereiten();
      meldung = { text: `Angemeldet als ${ICH.profil.name} (${ICH.profil.rolleName}).` };
      return { umleiten: START[rolle()] || '/', ersetzen: true };
    }
    if (p === '/konto') { const b = brauche('student', 'teacher', 'admin'); if (b) return b; return { title: 'Mein Konto', body: SV.konto(ICH, CLAIMS) }; }
    if (p === '/mitteilungen') { const b = brauche('student', 'teacher', 'admin'); if (b) return b; return mit('mitteilungen.liste', {}, l => ({ title: 'Mitteilungen', body: SV.mitteilungen(l, rolle() === 'student' ? 'schueler' : '') })); }
    if (p === '/suche') {
      const b = brauche('student', 'teacher', 'admin'); if (b) return b;
      if (!q.q || q.q.length < 2) return { title: 'Suche', body: SV.suche(q.q || '', null) };
      return mit('suche', { q: q.q }, r => ({ title: 'Suche', body: SV.suche(q.q, r) }));
    }

    // ---------------------------------------------------------- Schüler/innen
    if (t[0] === 'aufgaben') {
      const b = brauche('student'); if (b) return b;
      if (!SCHULE.funktionAn('aufgaben')) return { title: 'Aufgaben', body: SV.deaktiviert('Der Aufgabenbereich') };
      if (t.length === 1) return mit('schueler.uebersicht', {}, d => ({ title: 'Meine Aufgaben', body: SV.schuelerAufgaben(d, q.filter) }));
      return mit('schueler.aufgabe', { id: t[1] }, d => ({ title: d.aufgabe.titel, body: SV.schuelerAufgabe(d) }));
    }
    if (p === '/fortschritt') { const b = brauche('student'); if (b) return b; return mit('schueler.uebersicht', {}, d => ({ title: 'Mein Fortschritt', body: SV.fortschritt(d, ICH.profil) })); }

    // ---------------------------------------------------------- Lehrkräfte
    if (t[0] === 'lehrer') {
      const istAdmin = rolle() === 'admin';
      // Abgaben dürfen auch Admins einsehen; alles andere ist Lehrerbereich
      const b = (t[1] === 'zuweisungen' || t[1] === 'abgaben') ? brauche('teacher', 'admin') : brauche('teacher'); if (b) return b;
      if (t.length === 1) return mit('lehrer.dashboard', {}, d => ({ title: 'Lehrerbereich', body: SV.lehrerDashboard(d) }));
      if (t[1] === 'klassen' && t[2]) return mit('lehrer.klasse', { id: t[2] }, d => ({ title: d.klasse.name, body: SV.lehrerKlasse(d, q.sort, q.tab, q.q) }));
      if (t[1] === 'schueler' && t[2]) return mit('lehrer.schueler', { id: t[2] }, d => ({ title: d.profil.name, body: SV.lehrerSchueler(d) }));
      if (t[1] === 'bibliothek') return mit('aufgaben.bibliothek', q, d => ({ title: 'Aufgabenbibliothek', body: SV.bibliothek(d, q) }));
      if (t[1] === 'statistik') return mit('lehrer.statistik', {}, d => ({ title: 'Statistik', body: SV.lehrerStatistik(d) }));
      if (t[1] === 'zuweisungen' && t[2]) return mit('zuweisung.abgaben', { id: t[2] }, d => ({ title: 'Abgaben', body: SV.zuweisungAbgaben(d, istAdmin) }));
      if (t[1] === 'abgaben' && t[2]) return mit('abgabe.details', { id: t[2] }, d => ({ title: 'Abgabe', body: SV.abgabeKorrektur(d) }));
      if (t[1] === 'aufgaben') return aufgabenSeiten(t.slice(2), q, 'lehrer');
    }

    // ---------------------------------------------------------- Administration
    if (t[0] === 'admin') {
      const b = brauche('admin'); if (b) return b;
      if (t.length === 1) return mit('admin.uebersicht', {}, d => ({ title: 'Verwaltung', body: SV.adminUebersicht(d), admin: true }));
      if (t[1] === 'benutzer') {
        if (t[2] === 'neu') return mit('admin.schule', {}, d => ({ title: 'Testkonto anlegen', body: SV.adminBenutzerNeu(d.klassen), admin: true }));
        if (t[2]) return mit('admin.benutzerDetail', { id: t[2] }, d => ({ title: d.profil.name, body: SV.adminBenutzerDetail(d), admin: true }));
        const s = await api('admin.schule', {});
        return mit('admin.benutzer', q, l => ({ title: 'Konten', body: SV.adminBenutzer(l, q, s.ok ? s.daten.klassen : []), admin: true }));
      }
      if (t[1] === 'aufgaben') {
        if (t.length === 2) {
          const s = await api('admin.schule', {}), u = await api('admin.benutzer', {});
          const personen = u.ok ? u.daten.filter(x => x.rolle !== 'student') : [];
          return mit('aufgaben.liste', Object.assign({ alle: true }, q), l => ({ title: 'Aufgaben', body: SV.adminAufgaben(l, q, personen, s.ok ? s.daten.klassen : []), admin: true }));
        }
        const r = await aufgabenSeiten(t.slice(2), q, 'admin');
        return Object.assign(r, { admin: true });
      }
      if (t[1] === 'schule') return mit('admin.schule', {}, d => ({ title: 'Klassen & Fächer', body: SV.adminSchule(d), admin: true }));
      if (t[1] === 'system') return mit('admin.system', {}, d => ({ title: 'System', body: SV.adminSystem(d), admin: true }));
      if (t[1] === 'protokoll') return mit('admin.protokoll', q, d => ({ title: 'Protokoll', body: SV.adminProtokoll(d, q), admin: true }));
    }
    return null;
  }
  async function aufgabenSeiten(t, q, bereich) {
    const admin = bereich === 'admin';
    if (!t.length) return mit('aufgaben.liste', q, l => ({ title: 'Meine Aufgaben', body: SV.lehrerAufgaben(l, q) }));
    if (t[0] === 'neu') return { title: 'Neue Aufgabe', body: SV.aufgabeFormular(null, bereich, admin) };
    if (t[1] === 'bearbeiten') return mit('aufgabe.details', { id: t[0] }, d => d.darfBearbeiten ? ({ title: 'Bearbeiten', body: SV.aufgabeFormular(d.aufgabe, bereich, admin) }) : ({ title: 'Kein Zugriff', body: SV.fehlerSeite('Kein Zugriff', 'Diese Aufgabe kannst du nicht bearbeiten.') }));
    return mit('aufgabe.details', { id: t[0] }, d => ({ title: d.aufgabe.titel, body: SV.aufgabeDetails(d, bereich, ICH.profil.id) }));
  }

  // ---------------------------------------------------------------- Navigation und Rahmen
  const ICON_SUCHE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
  const ICON_GLOCKE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  function navRechts() {
    if (!ICH) return '<a href="/anmelden" class="rolle-link">Anmelden</a>';
    const p = ICH.profil, r = p.rolle;
    const links = [];
    if (r === 'student' && ICH.einstellungen.funktionen.aufgaben !== false) links.push(`<a href="/aufgaben" class="rolle-link">Aufgaben${ICH.offeneAufgaben ? ` <span class="badge">${ICH.offeneAufgaben}</span>` : ''}</a>`);
    if (r === 'student') links.push('<a href="/fortschritt">Fortschritt</a>');
    if (r === 'teacher') links.push('<a href="/lehrer" class="rolle-link">Lehrerbereich</a>');
    if (r === 'admin') links.push('<a href="/admin" class="rolle-link" style="color:var(--admin)">Verwaltung</a>');
    links.push(`<a href="/suche" class="nav-icon" aria-label="Suche" title="Suche">${ICON_SUCHE}</a>`);
    links.push(`<a href="/mitteilungen" class="nav-icon" aria-label="Mitteilungen${ICH.ungelesen ? ', ' + ICH.ungelesen + ' ungelesen' : ''}" title="Mitteilungen">${ICON_GLOCKE}${ICH.ungelesen ? `<span class="zaehler">${ICH.ungelesen > 99 ? '99+' : ICH.ungelesen}</span>` : ''}</a>`);
    links.push(`<a href="/konto" class="ich" title="Mein Konto">${SV.avatar(p)}<span class="ich-text">${esc(p.name)}<small>${esc(p.rolleName)}${p.klasse ? ' · ' + esc(p.klasse) : ''}</small></span></a>`);
    return links.join('');
  }
  function banner() {
    if (!ICH) return null;
    return `<strong>Testseite</strong> · Simulierte Anmeldung als <strong>${esc(ICH.profil.rolleName)}</strong> · alle Daten nur in diesem Browser <button type="button" class="link" data-abmelden>Abmelden</button>`;
  }
  function meldungHtml() {
    if (!meldung) return '';
    const m = meldung; meldung = null;
    return `<div class="meldung${m.fehler ? ' fehler' : ''}" role="status"><span>${esc(m.text)}</span><button type="button" class="link" data-schliessen aria-label="Meldung schließen">✕</button></div>`;
  }

  // ---------------------------------------------------------------- Formulare und Aktionen
  function formDaten(f, knopf) {
    let fd;
    try { fd = new FormData(f, knopf || undefined); } catch (e) { fd = new FormData(f); if (knopf && knopf.name) fd.append(knopf.name, knopf.value); }
    const listen = (f.dataset.listen || '').split(',').filter(Boolean);
    const d = {};
    for (const k of new Set(fd.keys())) { const alle = fd.getAll(k).map(String); d[k] = listen.includes(k) ? alle : alle[alle.length - 1]; }
    for (const l of listen) if (!(l in d)) d[l] = [];
    return d;
  }
  function zeigeFehler(f, r) {
    let box = f.querySelector('.form-fehler');
    if (!box) { box = document.createElement('p'); box.className = 'alert form-fehler'; box.setAttribute('role', 'alert'); f.prepend(box); }
    box.textContent = r.fehler || 'Das hat nicht geklappt.';
    box.hidden = false;
    f.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    f.querySelectorAll('.feld-fehler').forEach(x => x.remove());
    let erstes = null;
    for (const [k, t] of Object.entries(r.felder || {})) {
      const el = f.querySelector(`[name="${CSS.escape(k)}"]`);
      if (!el) continue;
      el.setAttribute('aria-invalid', 'true');
      const s = document.createElement('span'); s.className = 'feld-fehler'; s.textContent = t; s.id = 'fehler-' + k + '-' + Math.random().toString(36).slice(2, 7);
      el.setAttribute('aria-describedby', s.id);
      (el.closest('.feld') || el.parentElement).appendChild(s);
      erstes = erstes || el;
    }
    (erstes || box).focus?.();
    if (!erstes) box.scrollIntoView({ block: 'nearest' });
  }
  function weiter(ziel, daten) {
    if (!ziel) { window.dispatchEvent(new Event('hashchange')); return; }
    const z = ziel.replace('{id}', daten && daten.id ? encodeURIComponent(daten.id) : '');
    if ('#' + z === location.hash) window.dispatchEvent(new Event('hashchange'));
    else location.hash = z;
  }
  async function beschaeftigt(el, fn) {
    if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; }
    try { return await fn(); } finally { if (el && el.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
  }
  async function abmelden() {
    await SCHULE.abmelden(token());
    ss.del(TOKEN_KEY); ss.del(CLAIMS_KEY);
    ICH = null;
    meldung = { text: 'Du bist abgemeldet.' };
    location.hash = '/anmelden';
    window.dispatchEvent(new Event('hashchange'));
  }

  let gebunden = false;
  function binden() {
    if (gebunden) return;
    gebunden = true;
    document.addEventListener('submit', async e => {
      const f = e.target;
      if (f.id === 'idp-form') {
        e.preventDefault();
        const d = formDaten(f);
        idpWahl = d.username || null;
        const knopf = f.querySelector('#idp-weiter');
        const r = await beschaeftigt(knopf, () => SCHULE.oauth.autorisieren({ client_id: d.client_id, state: d.state, username: d.username, passwort: d.passwort || '' }));
        if (!r.ok) { idpFehler = r.fehler; window.dispatchEvent(new Event('hashchange')); return; }
        idpWahl = null;
        location.replace(`#/iserv/rueckkehr?code=${encodeURIComponent(r.daten.code)}&state=${encodeURIComponent(r.daten.state)}`);
        return;
      }
      if (f.dataset.get !== undefined && !f.dataset.aktion) {
        e.preventDefault();
        const qs = new URLSearchParams();
        for (const [k, v] of new FormData(f)) if (String(v).trim()) qs.append(k, String(v).trim());
        location.hash = f.dataset.get + (qs.toString() ? '?' + qs : '');
        return;
      }
      if (!f.dataset.aktion) return;
      e.preventDefault();
      const knopf = e.submitter;
      if (knopf && knopf.dataset.bestaetigen && !confirm(knopf.dataset.bestaetigen)) return;
      const d = formDaten(f, knopf);
      const r = await beschaeftigt(knopf || f.querySelector('[type=submit]'), () => api(f.dataset.aktion, d));
      if (!r.ok) { if (r.code === 401) { window.dispatchEvent(new Event('hashchange')); return; } zeigeFehler(f, r); return; }
      const erfolg = (knopf && knopf.dataset.erfolg) || f.dataset.erfolg;
      if (erfolg) meldung = { text: erfolg };
      weiter(f.dataset.weiter, r.daten);
    });
    document.addEventListener('click', async e => {
      const start = e.target.closest('#iserv-start');
      if (start) {
        const state = zufallHex(16);
        ss.set(STATE_KEY, state);
        location.hash = `/iserv/anmelden?client_id=${encodeURIComponent(SchulBackend.CLIENT_ID)}&state=${state}&redirect_uri=${encodeURIComponent('/iserv/rueckkehr')}`;
        return;
      }
      if (e.target.closest('#abmelden, [data-abmelden]')) { await abmelden(); return; }
      if (e.target.closest('[data-schliessen]')) { e.target.closest('.meldung').remove(); return; }
      if (e.target.closest('#export-csv')) {
        const r = await api('admin.export');
        if (!r.ok) { alert(r.fehler); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + r.daten.csv], { type: 'text/csv;charset=utf-8' }));
        a.download = 'lernseite-statistik-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        return;
      }
      const gelesen = e.target.closest('a[data-gelesen]');
      if (gelesen) { api('mitteilungen.gelesen', { ids: [gelesen.dataset.gelesen] }); return; }
      const b = e.target.closest('button[data-aktion]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.bestaetigen && !confirm(b.dataset.bestaetigen)) return;
      let daten = {};
      try { daten = JSON.parse(b.dataset.daten || '{}'); } catch (x) { daten = {}; }
      const r = await beschaeftigt(b, () => api(b.dataset.aktion, daten));
      if (!r.ok) { if (r.code !== 401) meldung = { text: r.fehler, fehler: true }; window.dispatchEvent(new Event('hashchange')); return; }
      if (b.dataset.erfolg) meldung = { text: b.dataset.erfolg };
      weiter(b.dataset.weiter, r.daten);
    }, true);
    document.addEventListener('change', e => {
      // Simulierte Anmeldeseite: Passwortfeld nur für Lehrkräfte und Administration
      if (e.target.name === 'username' && e.target.closest('#idp-form')) passwortFeld();
      // Aufgabenformular: nur Themen des gewählten Fachs anbieten
      if (e.target.id === 'f-fachId') themenFiltern();
    });
  }
  function passwortFeld() {
    const w = document.querySelector('#idp-form input[name=username]:checked');
    const box = document.getElementById('idp-pw');
    if (!box) return;
    const noetig = !!w && w.dataset.passwort === '1';
    box.hidden = !noetig;
    const pw = document.getElementById('idp-passwort');
    pw.required = noetig;
    if (!noetig) pw.value = '';
    const k = document.getElementById('idp-weiter');
    if (k) k.textContent = w ? `Als ${w.closest('.konto').querySelector('strong').textContent} anmelden` : 'Anmelden und zustimmen';
  }
  function themenFiltern() {
    const fach = document.getElementById('f-fachId'), thema = document.getElementById('f-themaId');
    if (!fach || !thema) return;
    thema.querySelectorAll('optgroup').forEach(g => {
      const passt = [...g.querySelectorAll('option')].some(o => o.dataset.fach === fach.value);
      g.hidden = !passt; g.disabled = !passt;
    });
    const gew = thema.selectedOptions[0];
    if (gew && gew.dataset.fach && gew.dataset.fach !== fach.value) thema.value = '';
  }
  function nachRender() {
    passwortFeld();
    themenFiltern();
    const m = document.querySelector('.meldung');
    if (m) m.setAttribute('tabindex', '-1');
  }

  // ---------------------------------------------------------------- Lernstand der Lernseite (Übungen, Verstanden, Lektionen)
  async function lernstandMerken(art, daten) {
    if (!ICH) return null;
    const aktion = { versuch: 'lernstand.versuch', verstanden: 'lernstand.verstanden', lektion: 'lernstand.lektion' }[art];
    const r = await api(aktion, daten);
    if (r.ok) { const l = await api('lernstand.lesen'); if (l.ok) LERNSTAND = l.daten; }
    return r;
  }

  return {
    init(backend) { SCHULE = backend; binden(); },
    vorbereiten, seite, navRechts, banner, meldungHtml, nachRender, lernstandMerken,
    ich: () => ICH, lernstand: () => LERNSTAND, angemeldet: () => !!ICH,
    funktionAn: f => SCHULE.funktionAn(f),
  };
})();
