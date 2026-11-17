# Dosenzettel

**Von Writern für Writer. Berlin Original.**

Der Dosenzettel macht aus einer Skizze, einem Foto vom Piece oder einer selbst zusammengestellten Farbkombi eine Einkaufsliste mit echten Dosen. Er sucht für jede Farbe die passende Dose, zeigt Ersatz aus anderen Marken, rechnet Mengenrabatte über mehrere Pieces und hilft beim Befüllen des Warenkorbs im Shop.

## Deine Daten bleiben bei dir

- Die Farberkennung läuft komplett im Browser. Fotos und Skizzen werden nicht hochgeladen.
- Sammelkorb, Kombis und Einstellungen liegen nur im Speicher des Browsers (localStorage).
- Kein Konto, kein Login, kein Tracking.
- Der Code hier ist offen, damit jeder das nachprüfen kann.

## Aufbau

| Teil | Wo | Öffentlich |
|---|---|---|
| Seite (`index.html`) | dieses Repo, gehostet über Cloudflare Pages | ja |
| Farbkarten, Staffelpreise, Markeninfos, Dosenfotos, Beispielfoto | eigene API, z. B. Cloudflare Worker | nein |

Die Seite enthält selbst keine Farbdaten. Sie lädt alles beim Start von einer API. Die Adresse steht im Kopf von `index.html`:

```html
<meta name="dosenzettel-api" content="https://api.example.org">
```

Zum Testen geht auch `index.html?api=https://api.example.org`. Ohne API startet die Seite leer.

## Datenformat der API

`GET {API}/data` liefert JSON:

```json
{
  "colors": [["Marke", "Code", "Bestellnummer", "Name", "#rrggbb", "Quelle", "Hinweis", "", "4,20 €", "Stand"]],
  "brands": [["Marke", "Lösemittel | Wasser", "Ja | Nein (im Markenmix vorausgewählt)", "High | Medium | Low"]],
  "tiers":  [["Marke", "ab Menge", "Stückpreis"]],
  "canImages": { "Marke": { "img": "data:image/png;base64,…", "mask": "data:image/png;base64,…" } },
  "piece": { "img": "…", "reg": "…", "w": 900, "h": 376 }
}
```

- `colors` hat dieselben Spalten wie der Tab „Farben“ der Farbkarten-Tabelle.
- `canImages` und `piece` sind optional. Ohne sie zeigt die Seite gezeichnete Dosen und eine Beispielskizze.
- Die API muss CORS für die Domain der Seite erlauben.

## Lizenz

AGPL-3.0, siehe `LICENSE`. Wer den Code verändert und online stellt, muss seinen Code ebenfalls offenlegen. Die Farbdaten gehören nicht zum Code und stehen nicht unter dieser Lizenz.

## Feedback

Ideen, Anregungen, Fehler: gerne als Issue hier im Repo.
