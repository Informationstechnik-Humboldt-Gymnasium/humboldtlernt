// HTML-Sandbox · Startvorlagen
// HS.vorlage('beispiel') = kommentiertes Beispielprojekt (Überschrift, Absatz, Liste, Link, Bild, CSS, JavaScript)
// HS.vorlage('leer')     = leeres Grundgerüst mit index.html, style.css und script.js
// Lehrkräfte können die Texte hier anpassen; die Dateien sind ganz normales HTML, CSS und JavaScript.
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  var BEISPIEL_HTML = [
    '<!DOCTYPE html>',
    '<html lang="de">',
    '<head>',
    '  <!-- Zeichensatz: damit Umlaute wie ä, ö und ü richtig angezeigt werden -->',
    '  <meta charset="UTF-8">',
    '  <!-- Die Seite passt sich der Bildschirmbreite an (wichtig für Handys) -->',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <!-- Der Titel steht im Browser-Tab -->',
    '  <title>Meine erste Webseite</title>',
    '  <!-- Hier wird die CSS-Datei eingebunden: Sie bestimmt das Aussehen -->',
    '  <link rel="stylesheet" href="style.css">',
    '</head>',
    '<body>',
    '  <!-- Überschrift der Stufe 1: die wichtigste Überschrift der Seite -->',
    '  <h1>Hallo, Welt!</h1>',
    '',
    '  <!-- Ein Absatz. <strong> macht ein Wort wichtig (fett). -->',
    '  <p>Das ist meine erste <strong>eigene</strong> Webseite. Ändere den Text rechts im Editor und schau, was links in der Vorschau passiert!</p>',
    '',
    '  <!-- Ein Absatz mit einer Klasse: In style.css steht, wie .hinweis aussieht -->',
    '  <p class="hinweis">Tipp: Halte <kbd>Alt</kbd> gedrückt und klicke in der Vorschau auf etwas – der Editor springt zum passenden Code.</p>',
    '',
    '  <h2>Was ich schon kann</h2>',
    '  <!-- Eine Aufzählung: <ul> ist die Liste, jedes <li> ist ein Punkt -->',
    '  <ul>',
    '    <li>Überschriften mit &lt;h1&gt; bis &lt;h6&gt;</li>',
    '    <li>Absätze mit &lt;p&gt;</li>',
    '    <li>Listen, Links und Bilder</li>',
    '  </ul>',
    '',
    '  <!-- Ein Bild: src = Datei, alt = Beschreibung für Menschen, die das Bild nicht sehen können -->',
    '  <img src="bild.svg" alt="Gezeichnete Landschaft mit Sonne und Bergen" width="240">',
    '',
    '  <!-- Ein Link: href = Ziel der Verknüpfung. In der Sandbox öffnen sich Links zu anderen Seiten nicht. -->',
    '  <p>Mehr über HTML: <a href="https://de.wikipedia.org/wiki/Hypertext_Markup_Language">HTML bei Wikipedia</a></p>',
    '',
    '  <!-- Ein Knopf, der mit JavaScript (script.js) etwas tut -->',
    '  <button id="knopf" type="button">Klick mich!</button>',
    '  <p id="ausgabe">Noch nicht geklickt.</p>',
    '',
    '  <!-- JavaScript am Ende einbinden: Dann gibt es den Knopf schon, wenn das Skript startet -->',
    '  <script src="script.js"></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  var BEISPIEL_CSS = [
    '/* style.css – hier steht, wie die Seite aussieht.',
    '   Aufbau einer Regel:  Selektor { Eigenschaft: Wert; } */',
    '',
    '/* body = die ganze sichtbare Seite */',
    'body {',
    '  font-family: system-ui, sans-serif;   /* Schriftart */',
    '  max-width: 640px;                     /* nicht breiter als 640 Pixel */',
    '  margin: 0 auto;                       /* in der Mitte */',
    '  padding: 16px;                        /* Innenabstand */',
    '  background-color: #f4f7fb;            /* Hintergrundfarbe */',
    '  color: #1d2b3a;                       /* Textfarbe */',
    '}',
    '',
    '/* alle Überschriften <h1> */',
    'h1 {',
    '  color: steelblue;',
    '}',
    '',
    '/* alle Elemente mit class="hinweis" (Punkt = Klasse) */',
    '.hinweis {',
    '  background-color: #fff6d6;',
    '  border-left: 4px solid orange;',
    '  padding: 8px 12px;',
    '}',
    '',
    '/* das Element mit id="knopf" (Raute = id) */',
    '#knopf {',
    '  padding: 8px 16px;',
    '  border: none;',
    '  border-radius: 8px;',
    '  background-color: steelblue;',
    '  color: white;',
    '  font-size: 1rem;',
    '  cursor: pointer;',
    '}',
    '',
    '/* :hover = solange die Maus darüber ist */',
    '#knopf:hover {',
    '  background-color: #2b5d87;',
    '}',
    '',
    'img {',
    '  border-radius: 12px;',
    '}',
    ''
  ].join('\n');

  var BEISPIEL_JS = [
    '// script.js – hier steht, was die Seite tut.',
    '',
    '// Den Knopf und den Absatz über ihre id finden',
    "const knopf = document.querySelector('#knopf');",
    "const ausgabe = document.querySelector('#ausgabe');",
    'let anzahl = 0;',
    '',
    '// Wenn der Knopf geklickt wird, läuft diese Funktion',
    "knopf.addEventListener('click', function () {",
    '  anzahl = anzahl + 1;',
    "  ausgabe.textContent = 'Du hast ' + anzahl + '-mal geklickt.';",
    "  console.log('Klick Nummer', anzahl);   // erscheint unten in der Konsole",
    '});',
    ''
  ].join('\n');

  var BILD_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150">',
    '  <!-- Himmel -->',
    '  <rect width="240" height="150" fill="#bfe3ff"/>',
    '  <!-- Sonne -->',
    '  <circle cx="190" cy="38" r="20" fill="#ffd43b"/>',
    '  <!-- Berge -->',
    '  <polygon points="0,150 70,55 140,150" fill="#5b7c99"/>',
    '  <polygon points="90,150 165,70 240,150" fill="#3f5f7a"/>',
    '  <!-- Wiese -->',
    '  <rect y="128" width="240" height="22" fill="#6cbf5a"/>',
    '</svg>',
    ''
  ].join('\n');

  var LEER_HTML = [
    '<!DOCTYPE html>',
    '<html lang="de">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>Meine Seite</title>',
    '  <link rel="stylesheet" href="style.css">',
    '</head>',
    '<body>',
    '  ',
    '  <script src="script.js"></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  HS.vorlage = function (art) {
    var leer = art === 'leer';
    var dateien = leer
      ? [{ name: 'index.html', inhalt: LEER_HTML }, { name: 'style.css', inhalt: '/* Hier kommt dein CSS hin */\n' }, { name: 'script.js', inhalt: '// Hier kommt dein JavaScript hin\n' }]
      : [{ name: 'index.html', inhalt: BEISPIEL_HTML }, { name: 'style.css', inhalt: BEISPIEL_CSS }, { name: 'script.js', inhalt: BEISPIEL_JS }, { name: 'bild.svg', inhalt: BILD_SVG }];
    return { id: HS.neueId(), name: leer ? 'Neues Projekt' : 'Mein erstes Projekt', dateien: dateien, offen: ['index.html', 'style.css', 'script.js'], aktiv: 'index.html', geaendert: 0 };
  };
})(typeof window !== 'undefined' ? window : this);
