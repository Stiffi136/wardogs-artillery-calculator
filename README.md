# WARDOGS Artillery Calculator

Browserbasierter Koordinatenrechner für WARDOGS. Er berechnet Entfernung, Differenzen und Azimut vollständig lokal im Browser.

## Start

```bash
npm install
npm run dev
npm run build
```

Für die Sprachsteuerung wird ein moderner Browser mit Mikrofonzugriff benötigt. Das Whisper-Modell wird zusammen mit dem statischen Build ausgeliefert und anschließend zusätzlich im Browser-Cache gehalten. WebGPU wird bevorzugt, andernfalls nutzt Transformers.js WASM/CPU. Es gibt keinen Whisper-Server und keine dauerhaft gespeicherten Audiodaten.

## GitHub Pages und lokales Whisper-Modell

Der Workflow `.github/workflows/deploy-pages.yml` lädt beim Deployment die für die Anwendung benötigten Dateien von `onnx-community/whisper-base` nach `public/models/` und veröffentlicht sie mit dem Vite-Build. Die Gewichte werden nicht in Git eingecheckt, weil GitHub normale Dateien über 100 MiB ablehnt und Git LFS nicht mit GitHub Pages funktioniert.

Aktiviere vor dem ersten Deployment in den Repository-Einstellungen unter **Pages** als Quelle **GitHub Actions**. Jeder Push auf `main` erstellt danach die statische Seite inklusive Modell. Der erste Aufruf im Browser lädt das Modell von derselben GitHub-Pages-Domain; spätere Aufrufe nutzen den Browser-Cache.

Für lokale Sprachsteuerung müssen die gleichen Dateien unter `public/models/onnx-community/whisper-base/` liegen. Lade sie mit `npm run download:model` herunter. Ohne diese Dateien bleibt der Rechner nutzbar, die Sprachsteuerung meldet jedoch den fehlenden lokalen Modell-Download.

## Bedienung

Die Eingabefelder sind der zuverlässige Hauptweg: vollständige Koordinaten aktualisieren das Ergebnis sofort. Die zuletzt verwendeten Koordinaten werden ohne personenbezogene Daten in `localStorage` gespeichert.

Sprachbefehle:

- `Artillerie 45 32, Ziel 67 81`
- `Geschütz 45 32 Ziel 67 81`
- `Artillerie 45 32`
- `Ziel 67 81`
- `67 81` (wird ohne Befehl als Zielkoordinate übernommen)
- `Berechnen`, `Ergebnis`, `Vorlesen`, `Zurücksetzen`, `Stop`

Zahlwörter wie `fünfundvierzig` sowie Dezimalwerte mit `Komma` werden verarbeitet. Zwei Zahlen ohne weiteren Befehl werden als X- und Y-Koordinate des Ziels übernommen. Unvollständige Ziel- oder Artilleriekoordinaten werden nicht übernommen.

## Architektur

- `logic/calculator`: Validierung, zentrale Kartenkonfiguration und Azimut-/Entfernungsberechnung.
- `logic/speech`: Mikrofonaufnahme, RMS-VAD mit 500-ms-Pre-Roll, Speech-Session, Whisper-Web-Worker, Parser und Sprachausgabe.
- `App.tsx`: responsive Bedienoberfläche und UI-Zustand.

Eine Koordinateneinheit entspricht zentral konfiguriert 100 Metern. Der Azimut verwendet `atan2(deltaX, deltaY)`: 0° = Norden, 90° = Osten. Bei identischen Koordinaten wird 0° angezeigt.

## Bekannte Einschränkungen

Das initiale Whisper-Modell umfasst rund 300 MB und benötigt je nach Gerät Zeit zum Herunterladen. Die RMS-basierte Sprachaktivitätserkennung ist ein bewusst einfaches MVP und kann später durch Silero VAD ersetzt werden. Der Browser muss Web Worker, Web Audio und Speech Synthesis unterstützen.
