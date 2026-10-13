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

## Geräte

| Gerät | Anschlüsse | Aufgabe im Modell |
|---|---|---|
| PC | eth0 (Kabel) | Endgerät |
| Server | eth0 (Kabel) | Endgerät mit Diensten: Webserver (HTTP, Port 80), HTTPS (Port 443) an/aus |
| Laptop, Smartphone | wlan0 (Funk, kein Kabel) | Endgerät im WLAN |
| Switch | 8 Ports | Schicht 2, MAC-Lernen |
| Access Point | eth0 (Kabel) + Funk | Schicht 2 wie ein Switch; verbindet WLAN-Geräte mit dem Kabelnetz |
| Router | g0, g1, g2 | Schicht 3, direkt angeschlossene Netze + statische Routen |
| Firewall | g0, g1, g2 | wie Router, zusätzlich Paketfilter mit Regeln |

## Datenmodell

```
{ format: 'netzwerk-labor', version: 1,
  bauteile: [{ id, typ, name, x, y, rot: 0, werte }],
  draehte:  [{ id, von: { b, a }, nach: { b, a } }] }       // Kabel, ungerichtet, ein Kabel pro Anschluss
werte (pc):                 { ifs: { eth0: { ip, maske, aktiv } }, gateway, dns }
werte (server):             wie pc + dienste: { web, https }
werte (laptop, smartphone): { ifs: { wlan0: {…} }, gateway, dns, ssid, schluessel }
werte (router):             { ifs: { g0, g1, g2 }, routen: [{ id, ziel, maske, via, aktiv }] }
werte (firewall):           wie router + regeln: [{ id, aktion, quelle, ziel, dienst, aktiv }], standard
werte (switch):             {}                                     // 8 Ports
werte (ap):                 { ssid, schluessel, reichweite }       // Reichweite 80–600 (Einheiten der Arbeitsfläche)
```

IP-Angaben werden als Text gespeichert, so wie eingegeben. Fehlerhafte Eingaben werden **nicht** still korrigiert,
sondern bei der Eingabe, bei „Netzwerk prüfen“ und in der Simulation mit konkreter Meldung angezeigt.
MAC-Adressen werden aus Geräte-ID und Port abgeleitet (`02:00:…`, lokal verwaltet).

## Was simuliert wird

0. **Dienst:** Getestet wird Ping (ICMP), Web (HTTP, Port 80) oder sicheres Web (HTTPS, Port 443). Ping beantwortet
   jedes Endgerät; HTTP/HTTPS nur ein Server mit eingeschaltetem Dienst, sonst wird die Verbindung abgelehnt.
1. **Endgerät:** Liegt das Ziel im eigenen Netz (IP und Maske des PCs), wird direkt zugestellt, sonst an das
   Standardgateway. Das Gateway muss gültig sein und im eigenen Netz liegen.
2. **Schicht 2:** Vom Ausgangsanschluss aus werden über Kabel, Switches und Access Points alle erreichbaren Schnittstellen gesucht.
   Das Gerät mit der IP des nächsten Hops empfängt den Rahmen. Switches lernen die Absender-MAC und fluten an
   unbekannte Ziele. Die MAC-Tabelle wird beim Switch angezeigt und bei jeder Änderung am Netz geleert.
   **WLAN:** Ein Laptop/Smartphone ist mit dem nächstgelegenen Access Point verbunden, dessen SSID gleich ist, dessen
   Schlüssel passt (leer = offenes WLAN) und in dessen Reichweite (Abstand auf der Arbeitsfläche) es steht. Sonst meldet
   die Simulation die genaue Ursache (keine SSID, unbekannte SSID, außer Reichweite, falscher Schlüssel).
3. **Router/Firewall:** Zuerst direkt angeschlossene Netze (aktiv, längster Präfix), dann statische Routen (aktiv, längster
   Präfix, auch 0.0.0.0/0). Der nächste Hop einer Route muss in einem direkt angeschlossenen Netz liegen.
   **Firewall:** Vor der Weiterleitung prüft sie ihre Regeln von oben nach unten. Eine Regel passt, wenn Quelle
   („alle“, Adresse oder Netz), Ziel und Dienst passen; die erste passende Regel entscheidet („erlauben“ oder
   „blockieren“), sonst die Standardrichtlinie (neu: „blockieren“). Die Firewall ist zustandsbehaftet: Hat sie eine
   Anfrage durchgelassen, darf die Antwort zurück. Regeln mit ungültigen Adressen werden ignoriert und gemeldet.
4. **Rückweg:** Ein Ping ist nur erfolgreich, wenn auch die Antwort zurückkommt.
5. **Abbruch:** Die Simulation stoppt am ersten Fehler und nennt Gerät, Schnittstelle und Ursache.

Ergebnisse: **erfolg**, **fehler** (mit eindeutiger Ursache) oder **unklar** – unklar bei doppelt vergebenen
IP-Adressen und bei Schleifen zwischen Switches, weil sich dort das Verhalten echter Netze nicht eindeutig
vorhersagen lässt.

## Bewusst nicht simuliert

ARP-Tabellen, DHCP, DNS-Auflösung (der DNS-Eintrag wird nur auf gültige Schreibweise geprüft), VLANs, NAT,
Funkstörungen, Wände und Kanäle (die WLAN-Reichweite ist ein fester Kreis), WLAN-Verschlüsselungsverfahren (der Schlüssel
wird nur verglichen), Ports außer 80/443, Firewall-Protokolle außer Ping/HTTP/HTTPS, Spanning Tree, IPv6, /31- und /32-Netze an Schnittstellen, Übertragungszeiten,
Paketverlust und TTL-Werte im Paket (Routing-Schleifen werden über eine Grenze von 16 Routern erkannt).

## Lernaufgaben

| Nr. | Szenario | eingebauter Fehler / Ziel |
|---|---|---|
| 1 | Zwei PCs verbinden | nichts verkabelt, keine IPs – Ziel: Verbindung über den Switch |
| 2 | Subnetzfehler beheben | 192.168.1.10/24 und 192.168.2.20/24 am selben Switch |
| 3 | Zwei Netzwerke verbinden | Router unverkabelt und unkonfiguriert, keine Gateways |
| 4 | Routing reparieren | R2 fehlt die Route zurück nach 192.168.1.0/24 (Anfrage kommt an, Antwort nicht) |
| 5 | Netzwerk debuggen | PC2 hat ein falsches Gateway, Router-Schnittstelle g1 ist deaktiviert |
| 6 | WLAN einrichten | Laptop ohne SSID/Schlüssel und außer Reichweite des Access Points |
| 7 | Firewall konfigurieren | Firewall blockiert alles – HTTP soll erlaubt, Ping weiter blockiert sein |

Bewertet wird immer mit der Simulation am tatsächlichen Netzwerkmodell.

## Freier Testmodus

Mit „🧪 Frei testen“ werden Endgeräte durch Antippen als Quelle und Ziel gewählt; das Paket startet sofort mit dem
gewählten Dienst. Geräte lassen sich weiter verschieben (z. B. ein Laptop aus der WLAN-Reichweite). Alle Tests landen im
Testprotokoll (die letzten 12, nur im Speicher der Seite); ein Eintrag lässt sich erneut abspielen. Esc oder „Beenden“
schaltet zurück in den Bearbeitungsmodus.

## Speichern

Das Netzwerk und die gelösten Aufgaben liegen im LocalStorage des Browsers (`netzwerk-labor`,
`netzwerk-labor-aufgaben`) – nur auf diesem Gerät, ohne Personenbezug. „Speichern“ lädt eine JSON-Datei herunter,
„Laden“ liest sie wieder ein (nur gültige Geräte und Kabel werden übernommen). WLAN-Schlüssel werden im Klartext
gespeichert – im Labor deshalb keine echten Passwörter verwenden (die Oberfläche weist darauf hin).
