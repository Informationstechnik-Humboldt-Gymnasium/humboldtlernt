// Gesetzgebung des Bundes als Ablauf (kein DOM). Vereinfacht nach Art. 76–78 und 82 GG:
// Bundestag → Bundesrat → (Vermittlungsausschuss) → ggf. Einspruch/Zustimmung → Bundespräsident → Verkündung.
// Nicht abgebildet: Stellungnahme des Bundesrats zu Regierungsentwürfen, Fristen, Anrufung des VA durch Bundestag oder Regierung.
(function (root) {
  'use strict';
  var GG = root.GG || (root.GG = {});

  // Schritte: text = was passiert, wahl = Möglichkeiten { id, text, weiter }
  function schritte(art) {
    var zust = art === 'zustimmung';
    return {
      bundestag: { ort: 'Bundestag', text: 'Der Bundestag berät den Entwurf in drei Lesungen und in den Ausschüssen und stimmt ab.', wahl: [
        { id: 'beschliessen', text: 'Mehrheit stimmt zu', weiter: 'bundesrat' },
        { id: 'ablehnen', text: 'Mehrheit lehnt ab', weiter: 'gescheitert', grund: 'Der Bundestag hat den Entwurf abgelehnt.' }] },
      bundesrat: { ort: 'Bundesrat', text: zust
        ? 'Es ist ein Zustimmungsgesetz: Ohne die Zustimmung des Bundesrats (mindestens 35 von 69 Stimmen) kommt es nicht zustande.'
        : 'Es ist ein Einspruchsgesetz: Der Bundesrat kann es passieren lassen oder den Vermittlungsausschuss anrufen.', wahl: zust ? [
        { id: 'zustimmen', text: 'Bundesrat stimmt zu', weiter: 'praesident' },
        { id: 'vermittlung', text: 'Vermittlungsausschuss anrufen', weiter: 'va' },
        { id: 'verweigern', text: 'Zustimmung verweigern', weiter: 'gescheitert', grund: 'Der Bundesrat hat die Zustimmung verweigert.' }] : [
        { id: 'billigen', text: 'Gesetz passieren lassen', weiter: 'praesident' },
        { id: 'vermittlung', text: 'Vermittlungsausschuss anrufen', weiter: 'va' }] },
      va: { ort: 'Vermittlungsausschuss', text: '16 Mitglieder des Bundestages und 16 Vertreter der Länder suchen einen Kompromiss.', wahl: [
        { id: 'kompromiss', text: 'Kompromiss gefunden – Bundestag beschließt die geänderte Fassung', weiter: 'bundesrat2' },
        { id: 'keiner', text: 'Kein Kompromiss', weiter: 'bundesrat2' }] },
      bundesrat2: { ort: 'Bundesrat', text: zust ? 'Der Bundesrat stimmt nun endgültig ab.' : 'Der Bundesrat entscheidet, ob er Einspruch einlegt.', wahl: zust ? [
        { id: 'zustimmen', text: 'Bundesrat stimmt zu', weiter: 'praesident' },
        { id: 'verweigern', text: 'Zustimmung verweigern', weiter: 'gescheitert', grund: 'Ohne Zustimmung des Bundesrats ist ein Zustimmungsgesetz gescheitert.' }] : [
        { id: 'keinEinspruch', text: 'Kein Einspruch', weiter: 'praesident' },
        { id: 'einspruch', text: 'Einspruch einlegen', weiter: 'zurueckweisen' }] },
      zurueckweisen: { ort: 'Bundestag', text: 'Der Bundestag kann den Einspruch zurückweisen – mit der Mehrheit seiner Mitglieder (316 von 630), bei einem Einspruch mit Zweidrittelmehrheit sogar mit zwei Dritteln der Abstimmenden.', wahl: [
        { id: 'ueberstimmt', text: 'Einspruch zurückgewiesen', weiter: 'praesident' },
        { id: 'nichtUeberstimmt', text: 'Nötige Mehrheit verfehlt', weiter: 'gescheitert', grund: 'Der Bundestag konnte den Einspruch des Bundesrats nicht zurückweisen.' }] },
      praesident: { ort: 'Bundespräsident', text: 'Nach der Gegenzeichnung durch die Regierung prüft der Bundespräsident, ob das Gesetz ordnungsgemäß zustande gekommen und nicht offensichtlich verfassungswidrig ist, und unterzeichnet es.', wahl: [
        { id: 'unterzeichnen', text: 'Unterzeichnen und verkünden', weiter: 'inkraft' },
        { id: 'verweigern', text: 'Unterschrift verweigern (sehr selten)', weiter: 'gescheitert', grund: 'Der Bundespräsident hat das Gesetz nicht ausgefertigt. Das kam seit 1949 nur wenige Male vor.' }] },
      inkraft: { ort: 'Bundesgesetzblatt', text: 'Das Gesetz wird im Bundesgesetzblatt verkündet und tritt in Kraft. Das Bundesverfassungsgericht kann es später auf Antrag überprüfen.', ende: 'inkraft' },
      gescheitert: { ort: '–', text: 'Das Gesetz ist gescheitert.', ende: 'gescheitert' },
    };
  }

  /** Neuer Ablauf. art: 'einspruch' | 'zustimmung'. */
  function neu(art) { return { art: art === 'zustimmung' ? 'zustimmung' : 'einspruch', schritt: 'bundestag', weg: ['bundestag'], wahlen: [], grund: '' }; }

  /** Eine Wahl treffen; liefert den neuen Zustand (unveränderlich) oder null bei ungültiger Wahl. */
  function waehle(z, wahlId) {
    var s = schritte(z.art)[z.schritt];
    if (!s || s.ende) return null;
    var w = s.wahl.filter(function (x) { return x.id === wahlId; })[0];
    if (!w) return null;
    return { art: z.art, schritt: w.weiter, weg: z.weg.concat([w.weiter]), wahlen: z.wahlen.concat([z.schritt + ':' + wahlId]), grund: w.grund || z.grund };
  }

  GG.schritte = schritte;
  GG.neu = neu;
  GG.waehle = waehle;
})(typeof window !== 'undefined' ? window : globalThis);
