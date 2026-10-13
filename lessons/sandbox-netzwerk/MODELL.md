# Netzwerk-Labor (Network Builder) – Bedienung, Modell und Grenzen

Pädagogische Simulation für den Informatik- und Informationstechnikunterricht. Es werden **keine echten
Netzwerkpakete** gesendet; alles läuft lokal im Browser.

## Aufbau der Dateien

| Datei | Aufgabe | DOM? |
|---|---|---|
| `ipv4.js` | IPv4-Adressen und Subnetzmasken prüfen, Netz/Broadcast/Hostbereich berechnen | nein |
| `modell.js` | Geräte, Schnittstellen, Kabel, Routen, Speicherformat; dieselbe Schnittstelle wie die Modelle des Schaltkreis-/Logik-Labors | nein |
| `simulation.js` | Ping-Simulation Hop für Hop (Anfrage und Antwort), Netzwerkprüfung, Routing-Tabelle | nein |
| `aufgaben.js` | fünf feste Lernszenarien mit gezielt eingebauten Fehlern und ihrer Bewertung | nein |
| `zeichnen.js` | SVG-Darstellung | erzeugt Markup |
| `netzwerk.js` | Oberfläche: Konfiguration, Test, Paketanimation, Aufgaben, Speichern | ja |
| `../sandbox-schaltkreis/bedienung.js` | gemeinsame Zeiger-/Touch-Bedienung (Ziehen, Verkabeln, Zoom) | nein |

Tests: `test/netzwerk.test.mjs` (läuft ohne Browser in einer VM).

## Datenmodell

```
{ format: 'netzwerk-labor', version: 1,
  bauteile: [{ id, typ: 'pc'|'server'|'switch'|'router', name, x, y, rot: 0, werte }],
  draehte:  [{ id, von: { b, a }, nach: { b, a } }] }       // Kabel, ungerichtet, ein Kabel pro Anschluss
werte (pc, server): { ifs: { eth0: { ip, maske, aktiv } }, gateway, dns }
werte (router):     { ifs: { g0, g1, g2 }, routen: [{ id, ziel, maske, via, aktiv }] }
werte (switch):     {}                                     // 8 Ports
```

IP-Angaben werden als Text gespeichert, so wie eingegeben. Fehlerhafte Eingaben werden **nicht** still korrigiert,
sondern bei der Eingabe, bei „Netzwerk prüfen“ und in der Simulation mit konkreter Meldung angezeigt.
MAC-Adressen werden aus Geräte-ID und Port abgeleitet (`02:00:…`, lokal verwaltet).

## Was simuliert wird

1. **Endgerät:** Liegt das Ziel im eigenen Netz (IP und Maske des PCs), wird direkt zugestellt, sonst an das
   Standardgateway. Das Gateway muss gültig sein und im eigenen Netz liegen.
2. **Schicht 2:** Vom Ausgangsanschluss aus werden über Kabel und Switches alle erreichbaren Schnittstellen gesucht.
   Das Gerät mit der IP des nächsten Hops empfängt den Rahmen. Switches lernen die Absender-MAC und fluten an
   unbekannte Ziele. Die MAC-Tabelle wird beim Switch angezeigt und bei jeder Änderung am Netz geleert.
3. **Router:** Zuerst direkt angeschlossene Netze (aktiv, längster Präfix), dann statische Routen (aktiv, längster
   Präfix, auch 0.0.0.0/0). Der nächste Hop einer Route muss in einem direkt angeschlossenen Netz liegen.
4. **Rückweg:** Ein Ping ist nur erfolgreich, wenn auch die Antwort zurückkommt.
5. **Abbruch:** Die Simulation stoppt am ersten Fehler und nennt Gerät, Schnittstelle und Ursache.

Ergebnisse: **erfolg**, **fehler** (mit eindeutiger Ursache) oder **unklar** – unklar bei doppelt vergebenen
IP-Adressen und bei Schleifen zwischen Switches, weil sich dort das Verhalten echter Netze nicht eindeutig
vorhersagen lässt.

## Bewusst nicht simuliert

ARP-Tabellen, DHCP, DNS-Auflösung (der DNS-Eintrag wird nur auf gültige Schreibweise geprüft), VLANs, NAT,
Firewalls, Access Points/WLAN, Spanning Tree, IPv6, /31- und /32-Netze an Schnittstellen, Übertragungszeiten,
Paketverlust und TTL-Werte im Paket (Routing-Schleifen werden über eine Grenze von 16 Routern erkannt).

## Lernaufgaben

| Nr. | Szenario | eingebauter Fehler / Ziel |
|---|---|---|
| 1 | Zwei PCs verbinden | nichts verkabelt, keine IPs – Ziel: Verbindung über den Switch |
| 2 | Subnetzfehler beheben | 192.168.1.10/24 und 192.168.2.20/24 am selben Switch |
| 3 | Zwei Netzwerke verbinden | Router unverkabelt und unkonfiguriert, keine Gateways |
| 4 | Routing reparieren | R2 fehlt die Route zurück nach 192.168.1.0/24 (Anfrage kommt an, Antwort nicht) |
| 5 | Netzwerk debuggen | PC2 hat ein falsches Gateway, Router-Schnittstelle g1 ist deaktiviert |

Bewertet wird immer mit der Simulation am tatsächlichen Netzwerkmodell.

## Speichern

Das Netzwerk und die gelösten Aufgaben liegen im LocalStorage des Browsers (`netzwerk-labor`,
`netzwerk-labor-aufgaben`) – nur auf diesem Gerät, ohne Personenbezug. „Speichern“ lädt eine JSON-Datei herunter,
„Laden“ liest sie wieder ein (nur gültige Geräte und Kabel werden übernommen).
