# Orchestrator Flow Engine

## Opis projektu
Orchestrator to silnik wykonywania zadań typu flow oraz CRON, umożliwiający definiowanie, uruchamianie i harmonogramowanie procesów biznesowych na podstawie plików konfiguracyjnych. Obsługuje walidację wejścia, warunkowe przejścia, podflowy, operacje HTTP, transformacje, foreach, wait, return (w tym !file), oraz automatyczną i ręczną synchronizację harmonogramu CRON.

## Struktura projektu

```
├── engine.js                # Silnik wykonujący flow i CRON
├── index.js                 # Serwer Express, rejestracja endpointów
├── validate.js              # Walidacja input
├── sync_cron_table.js       # Synchronizacja harmonogramu CRON
├── flows.json               # Główne definicje flow/CRON
├── flows/                   # Dodatkowe pliki z flow
├── scheduler_state.json     # Stan harmonogramu CRON
├── logs/                    # Logi przebiegu flow i CRON
├── logs.html, logs.js       # Prosty frontend do przeglądania logów
├── files/                   # Bezpieczne pliki do zwracania przez !file
├── package.json, nodemon.json, .gitignore
```

## Kluczowe funkcje

- **Flow**: Definiowanie procesów w flows.json i flows/*.json, obsługa kroków (http, call_flow, transform, foreach, wait, return).
- **CRON**: Harmonogramowanie zadań cyklicznych na podstawie crontable, automatyczne i ręczne odświeżanie harmonogramu.
- **Walidacja**: Walidacja wejścia na podstawie schematów, obsługa błędów walidacji.
- **Synchronizacja CRON**: Funkcja syncCronTable automatycznie synchronizuje scheduler_state.json z aktualnymi definicjami flow typu CRON.
- **Logowanie**: Szczegółowe logi przebiegu flow i CRON w katalogu logs/.
- **Frontend logów**: logs.html + logs.js umożliwiają przeglądanie logów przez przeglądarkę.

## Endpointy HTTP

- `/admin/restart` – restart serwisu
- `/admin/recalculate_cron_table` – ręczna synchronizacja harmonogramu CRON
- `/logs/raw?date=YYYY-MM-DD` – pobranie surowych logów z danego dnia
- `/test/foreach`, `/delay/:waittime`, `/hello/:name/:surname`, ... – przykładowe endpointy flow

## Pliki konfiguracyjne

- **flows.json, flows/*.json** – definicje flow i CRON
- **scheduler_state.json** – stan harmonogramu CRON (aktualizowany automatycznie i ręcznie)
- **nodemon.json** – konfiguracja automatycznego restartu serwisu

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

## Synchronizacja CRON
- Harmonogram CRON jest synchronizowany automatycznie przy starcie serwisu oraz ręcznie przez endpoint `/admin/recalculate_cron_table`.
- Synchronizacja polega na dodaniu nowych zadań, usunięciu znikniętych, aktualizacji zmienionych oraz pozostawieniu niezmienionych.

## Bezpieczeństwo
- Pliki zwracane przez !file mogą pochodzić tylko z katalogu ./files.
- scheduler_state.json jest ignorowany przez git (patrz .gitignore).

## Rozwój i testowanie
- Flow i CRON można definiować w flows.json oraz flows/*.json.
- Testy jednostkowe i integracyjne zalecane dla sync_cron_table.js oraz validate.js.
- Logi pozwalają na analizę przebiegu i debugowanie flow.

## Autorzy
- Tadeusz Drabarek
- Współpraca: GitHub Copilot

---

W razie pytań lub problemów: sprawdź logi w katalogu logs/ lub skorzystaj z endpointów administracyjnych.
