# Portal Engine

## Opis projektu
Portal to aplikacja serwerowa łącząca w sobie funkcjonalność silnika wykonywania zadań (flow) oraz serwera stron WWW. Umożliwia definiowanie i obsługę dynamicznych stron portalu na podstawie konfiguracji w pages.json, a także wykonywanie procesów biznesowych typu flow i CRON. Obsługuje walidację wejścia, podflowy, operacje HTTP, transformacje, autoryzację, szablony stron oraz logowanie aktywności.

## Struktura projektu

```
├── engine.js                # Silnik wykonujący flow i CRON
├── index.js                 # Serwer Express, obsługa endpointów i portalu
├── validate.js              # Walidacja input
├── uid.js                   # Generowanie unikalnych identyfikatorów
├── sync_cron_table.js       # Synchronizacja harmonogramu CRON
├── pages.json               # Konfiguracja stron portalu
├── logs.html, logs.js       # Frontend do przeglądania logów
├── logsRoute.js             # Routing logów
├── flows/                   # Dodatkowe pliki z definicjami flow
├── pages/                   # Pliki HTML, CSS, JS dla stron portalu
├── scheduler_state.json     # Stan harmonogramu CRON (git ignored)
├── files/                   # Pliki statyczne
├── doc/                     # Dokumentacja (CRON.md, FLOWS.md)
├── package.json, nodemon.json, .gitignore
```

## Kluczowe funkcje

- **Portal WWW**: Dynamiczne strony pod `/portal/*` konfigurowane w pages.json z obsługą szablonów, autoryzacji i niestandardowego JS.
- **Flow**: Definiowanie procesów biznesowych, obsługa kroków (http, call_flow, transform, foreach, wait, return).
- **CRON**: Harmonogramowanie zadań cyklicznych, automatyczne i ręczne odświeżanie harmonogramu.
- **Walidacja**: Walidacja wejścia na podstawie schematów JSON Schema.
- **Autoryzacja**: Obsługa autoryzacji użytkowników dla chronionych stron portalu.
- **Logowanie**: Szczegółowe logi przebiegu flow i żądań HTTP.
- **Frontend logów**: Przeglądarke logów przez interfejs webowy (logs.html).

## Endpointy HTTP

### Portal
- `/portal/{pageName}` – dynamiczne strony portalu wg konfiguracji z pages.json

### Administracja
- `/admin/restart` – restart serwisu
- `/admin/recalculate_cron_table` – ręczna synchronizacja harmonogramu CRON

### Logi
- `/logs/raw?date=YYYY-MM-DD` – pobranie surowych logów z danego dnia
- `/logs.html` – przeglądarka logów

### Przykładowe endpointy flow
- `/hello/:name/:surname` – przykładowy endpoint z parametrami
- `/delay/:waittime` – endpoint z opóźnieniem i warunkami
- `/test/loop` – testowanie pętli foreach
- `/test/html` – zwracanie HTML z plików
- `/if_demo` – demonstracja operacji warunkowych

## Pliki konfiguracyjne

- **pages.json** – definicje stron portalu (ścieżki, szablony, autoryzacja, skrypty JS)
- **flows/*.json** – definicje flow i CRON (opcjonalnie, oprócz wbudowanych w engine.js)
- **scheduler_state.json** – stan harmonogramu CRON (generowany automatycznie, ignorowany przez Git)
- **nodemon.json** – konfiguracja automatycznego restartu serwisu
- **.gitignore** – pliki ignorowane przez Git

## Uruchomienie

1. Zainstaluj zależności:
   ```bash
   npm install
   ```
2. Uruchom serwis developersko:
   ```bash
   npm run dev
   ```
3. Serwis nasłuchuje na porcie 3001 (domyślnie)

### Uruchomienie z parametrami

Możesz przekazać katalog roboczy oraz port jako argumenty:

```bash
node index.js [baseDir] [port]
```

Przykłady:
```bash
# Uruchomienie z domyślnymi ustawieniami (bieżący katalog, port 3001)
node index.js

# Uruchomienie z niestandardowym katalogiem roboczym
node index.js C:\Projects\dev2\testy

# Uruchomienie z niestandardowym katalogiem i portem
node index.js C:\Projects\dev2\testy 3002
```

Katalog roboczy określa lokalizację plików konfiguracyjnych (pages.json, flows/, pages/, etc.).

### Dostęp do aplikacji

4. Odwiedź:
   - `http://localhost:3001/logs.html` – przeglądarka logów
   - `http://localhost:3001/portal/{pageName}` – strony portalu

## Konfiguracja pages.json

Przykładowa struktura konfiguracji strony:

```json
{
  "pageName": {
    "path": "/nazwa-pliku.html",           // ścieżka do pliku HTML w katalogu pages/
    "title": "Tytuł strony",               // tytuł dla szablonu
    "description": "Opis strony",          // opis dla szablonu
    "auth": true,                          // czy wymagana autoryzacja
    "template": "/template.html",          // ścieżka do szablonu
    "useJS": "/pages/script.js"           // skrypt JS specyficzny dla strony
  }
}
```

## Synchronizacja CRON
- Harmonogram CRON jest synchronizowany automatycznie przy starcie serwisu oraz ręcznie przez endpoint `/admin/recalculate_cron_table`.
- Synchronizacja polega na dodaniu nowych zadań, usunięciu znikniętych, aktualizacji zmienionych oraz pozostawieniu niezmienionych.

## Bezpieczeństwo
- Pliki serwowane z katalogu pages/ są walidowane pod kątem path traversal.
- Autoryzacja użytkowników dla chronionych stron portalu.
- Walidacja danych wejściowych dla wszystkich endpointów flow.


## Rozwój i testowanie
- Strony portalu definiuje się w pages.json, pliki HTML/CSS/JS umieszcza w katalogu pages/.
- Flow i CRON można definiować w flows/*.json lub bezpośrednio w engine.js.
- Obsługiwane operacje flow: http, call_flow, transform, foreach/loop, wait, return, if.
- Przykładowe flow dostępne w katalogu testowym (flows/tests.json).
- Logi pozwalają na analizę przebiegu i debugowanie flow oraz żądań HTTP.
- Dokumentacja szczegółowa w katalogu doc/ (CRON.md, FLOWS.md).

## Autorzy
- Tadeusz Drabarek
- Współpraca: GitHub Copilot

---

W razie pytań lub problemów: sprawdź logi przez interfejs `/logs.html` lub skorzystaj z endpointów administracyjnych.
