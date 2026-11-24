# Dosenzettel

**Von Writern für Writer. Berliner Original.**

Der Dosenzettel macht aus einer Skizze, einem Foto vom Piece oder einer selbst zusammengestellten Farbkombi eine Einkaufsliste mit echten Dosen. Er sucht für jede Farbe die passende Dose, zeigt Ersatz aus anderen Marken, rechnet Mengenrabatte über mehrere Pieces und hilft beim Befüllen des Warenkorbs im Shop.

## Deine Daten bleiben bei dir

- Die Farberkennung läuft komplett im Browser. Fotos und Skizzen werden nicht hochgeladen.
- Sammelkorb, Kombis und Einstellungen liegen nur im Speicher des Browsers (localStorage).
- Kein Konto, kein Login, keine Cookies.
- Gezählt wird nur anonym, welche Funktionen benutzt werden (siehe [Was gezählt wird](#was-gezählt-wird)).
- Der Code hier ist offen, damit jeder das nachprüfen kann.

## Was gezählt wird

Damit klar ist, ob der Dosenzettel ankommt und welche Funktionen gebraucht werden, zählt die Seite anonym mit [Umami](https://umami.is) (Umami Cloud, Datenregion EU). Umami setzt keine Cookies und erkennt niemanden über Tage hinweg wieder.

Alles, was gezählt wird, steht in einer einzigen Datei: [`tracking.js`](tracking.js).

| Event | Wann | Zusatzinfo |
|---|---|---|
| Seitenaufruf | Seite wird geöffnet | Seite, Herkunft, Land, Gerätetyp (macht Umami selbst) |
| `bild-geladen` | Foto oder Skizze geladen | Modus (Skizze/Foto), ausgewählt oder reingezogen |
| `beispiel-geladen` | Button „Beispiel“ | – |
| `modus-gewechselt` | Skizze / Foto vom Piece / Farbkombi | Modus |
| `markenwahl` | „Eine Marke“ oder „Markenmix“ | Art |
| `marke-gewaehlt` | Marke im Auswahlfeld geändert | Markenname |
| `liste-kopiert` | Einkaufsliste kopiert | Modus |
| `sammelkorb-hinzugefuegt` | „In den Sammelkorb“ | – |
| `sammelkorb-kopiert` | Sammelkorb-Liste kopiert | – |
| `kombi-gespeichert` | Farbkombi gespeichert | – |
| `warenkorb-skript` | Warenkorb-Skript kopiert | Marke, Shop, aus Einkaufsliste oder Sammelkorb |
| `shop-geoeffnet` | Button „Zum Shop“ | Marke, aus Einkaufsliste oder Sammelkorb |
| `ersatz-angesehen` | Dose in der Einkaufsliste angetippt | – |
| `ersatz-getauscht` | Dose gegen eine andere Marke getauscht | – |
| `extra-dose-hinzugefuegt` | zusätzliche Dose in die Liste gelegt | – |
| `feedback-geklickt` | Feedback-Button | Instagram oder Mail |

**Nie gezählt oder verschickt:** Bilder, Farbwerte aus Bildern, Einkaufslisten, Kombis, Mengen, Inhalte des Sammelkorbs.

Außerdem:

- Gezählt wird nur auf `dosenzettel.pages.dev`, nicht lokal und nicht in den Vorschau-Adressen von Cloudflare.
- Ist im Browser „Do Not Track“ aktiviert, wird gar nichts gezählt.
- URL-Parameter (z. B. `?api=…`) werden nicht mitgeschickt.
- Blockt ein Adblocker Umami, funktioniert die Seite ganz normal weiter.
- Selbst abschalten, z. B. für die eigenen Geräte: auf der Seite die Browser-Konsole öffnen und `localStorage.setItem("umami.disabled", 1)` eingeben.

## Shop-Links mit UTM-Parametern

Steht im Tab „Marken“ in Spalte E der Link zur Markenseite im Shop (z. B. die Seite „Double A Cans 400ml“ mit allen Farben), bekommt jede Marke in Einkaufsliste und Sammelkorb einen Button „Zum Shop“. Der Link wird um UTM-Parameter ergänzt:

```
?utm_source=dosenzettel&utm_medium=referral&utm_campaign=warenkorb-skript&utm_content=einkaufsliste
```

`utm_content` ist `einkaufsliste` oder `sammelkorb`. So sieht der Shop in seiner eigenen Auswertung, wie viele Besuche und Bestellungen vom Dosenzettel kommen. Ohne Link in Spalte E erscheint kein Button. Nach dem Eintragen muss nichts neu deployt werden, der Worker holt das Sheet spätestens nach 10 Minuten neu.

Das Warenkorb-Skript selbst kann keine UTM-Parameter mitschicken: Es läuft auf der Shopseite, die schon offen ist, und ruft keine neue Seite auf. Gezählt wird deshalb der Weg über „Zum Shop“.

## Aufbau

| Teil | Wo | Öffentlich |
|---|---|---|
| Seite (`index.html`) | dieses Repo, gehostet über Cloudflare Pages | ja |
| Zählung (`tracking.js`) | dieses Repo, Auswertung bei Umami Cloud | Code ja, Zahlen nein |
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
  "brands": [["Marke", "Lösemittel | Wasser", "Ja | Nein (im Markenmix vorausgewählt)", "High | Medium | Low", "https://shop.example/marken-seite"]],
  "tiers":  [["Marke", "ab Menge", "Stückpreis"]],
  "canImages": { "Marke": { "img": "data:image/png;base64,…", "mask": "data:image/png;base64,…" } },
  "piece": { "img": "…", "reg": "…", "w": 900, "h": 376 }
}
```

- `colors` hat dieselben Spalten wie der Tab „Farben“ der Farbkarten-Tabelle.
- `brands` Spalte 5 (Tab „Marken“, Spalte E) ist optional: der Link zur Seite der Marke im Shop. Ist er gesetzt, zeigt die Seite neben dem Warenkorb-Skript einen Button „Zum Shop“ (siehe [Shop-Links mit UTM-Parametern](#shop-links-mit-utm-parametern)).
- `canImages` und `piece` sind optional. Ohne sie zeigt die Seite gezeichnete Dosen und eine Beispielskizze.
- Die API muss CORS für die Domain der Seite erlauben.

## Datenquelle einrichten (Cloudflare Worker)

Der Ordner `api/` enthält den Worker. Er liest das Google Sheet über einen Google-Service-Account und holt die Dosenfotos und das Beispiel-Piece aus einem KV-Speicher. Der Code ist öffentlich, die Daten und Schlüssel nicht: die liegen nur bei Google, im KV-Speicher und in den Secrets des Workers.

### 1. Google: Service-Account fürs Sheet

1. In der Google Cloud Console ein Projekt wählen oder anlegen.
2. Unter **APIs & Dienste → Bibliothek** die **Google Sheets API** aktivieren.
3. Unter **IAM & Verwaltung → Dienstkonten** ein Dienstkonto anlegen, z. B. `dosenzettel-api`. Keine Rollen nötig.
4. Beim Dienstkonto unter **Schlüssel → Schlüssel hinzufügen → JSON** eine Schlüsseldatei herunterladen. Die Datei nie ins Repo legen.
5. Das Farbkarten-Sheet mit der E-Mail-Adresse des Dienstkontos (`…@….iam.gserviceaccount.com`) teilen, Rolle **Betrachter**.

### 2. Cloudflare: Worker anlegen

```bash
cd api
npm install
npx wrangler login
npx wrangler kv namespace create ASSETS
```

Die ausgegebene `id` in `api/wrangler.toml` bei `kv_namespaces` eintragen.

### 3. Bilder in den KV-Speicher laden

Die Dateien `canImages.json` (Dosenfotos) und `piece.json` (Beispiel-Piece) liegen nicht im Repo. Leg sie in einen Ordner `kv-daten/` neben `api/` (der Ordner ist in `.gitignore`) und lade sie hoch:

```bash
npx wrangler kv key put canImages --path=../kv-daten/canImages.json --binding=ASSETS --remote
npx wrangler kv key put piece --path=../kv-daten/piece.json --binding=ASSETS --remote
```

### 4. Bot-Check (Cloudflare Turnstile) anlegen

1. Im Cloudflare-Dashboard unter **Turnstile** → **Add widget**.
2. Name `dosenzettel`, Hostname die Pages-Domain (z. B. `dosenzettel.pages.dev`, Vorschau-Adressen sind damit automatisch abgedeckt), Modus **Invisible**.
3. Den **Site Key** in `index.html` bei `TURNSTILE_SITEKEY` eintragen. Der ist öffentlich.
4. Den **Secret Key** nur als Secret im Worker setzen (Schritt 5), nie ins Repo.

### 5. Secrets setzen und deployen

```bash
npx wrangler secret put SHEET_ID                 # die ID aus der Sheet-URL
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT < pfad/zur/schluesseldatei.json
npx wrangler secret put TURNSTILE_SECRET         # Secret Key aus Schritt 4
npx wrangler deploy
```

Wrangler zeigt danach die Adresse des Workers, z. B. `https://dosenzettel-api.<dein-name>.workers.dev`. Test: `https://…workers.dev/data` im Browser öffnen. Es sollte `{"error":"origin not allowed"}` kommen. So soll es sein: Direkt gibt der Worker nichts heraus, nur über die Seite.

### 6. Seite mit dem Worker verbinden

1. In `index.html` die Worker-Adresse eintragen: `<meta name="dosenzettel-api" content="https://dosenzettel-api.<dein-name>.workers.dev">`
2. Die Domain der Seite in `api/wrangler.toml` bei `ALLOWED_ORIGINS` eintragen und `npx wrangler deploy` erneut ausführen.

### 7. Seite über Cloudflare Pages veröffentlichen

Cloudflare Dashboard → **Workers & Pages → Erstellen → Pages → Mit Git verbinden** → Repo `dosenzettel`, Branch `main`, kein Build-Befehl, Ausgabeverzeichnis `/`.

### Gut zu wissen

- Der Worker merkt sich die Daten 10 Minuten (`CACHE_SECONDS`). Änderungen im Sheet sind spätestens dann online.
- So sind die Farbkarten geschützt:
  - **Nur über die Seite:** Ohne erlaubte Herkunft (`ALLOWED_ORIGINS`) gibt es `403`. Wer `/data` direkt im Browser öffnet oder per Skript abruft, bekommt nichts.
  - **Bot-Check:** Jeder Abruf braucht ein frisches Turnstile-Token. Die Seite holt es unsichtbar, Besucher merken davon nichts.
  - **Rate-Limit:** Höchstens 10 Abrufe pro IP und Minute (`[[ratelimits]]` in `wrangler.toml`).
  - **Grenze:** Wer die Seite normal öffnet, bekommt die Farbkarten in seinen Browser, sonst könnte der Dosenzettel nicht rechnen. Mit den Entwicklertools lassen sie sich dort weiterhin auslesen. Vollständig geschützt wären sie erst, wenn die Zuordnung Farbe → Dose im Worker passiert und die Seite nur noch die passenden Dosen bekommt.
- Vorschau-Adressen von Cloudflare Pages (z. B. `dev.dosenzettel.pages.dev`) sind über `https://*.dosenzettel.pages.dev` in `ALLOWED_ORIGINS` freigegeben.
- Lokal testen: `api/.dev.vars.example` nach `api/.dev.vars` kopieren, `cd api && npm run dev` starten und die Seite mit `?api=http://localhost:8787` öffnen. Auf `localhost` nutzt die Seite automatisch Cloudflares Test-Schlüssel.
- Lokaler Test des Workers ohne Google und Cloudflare: `cd api && npm test`

## Lizenz

AGPL-3.0, siehe `LICENSE`. Wer den Code verändert und online stellt, muss seinen Code ebenfalls offenlegen. Die Farbdaten gehören nicht zum Code und stehen nicht unter dieser Lizenz.

## Feedback

Ideen, Anregungen, Fehler: gerne als Issue hier im Repo oder per Nachricht auf Instagram an [@paulsonson](https://www.instagram.com/paulsonson/).
