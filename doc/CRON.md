# Instrukcja definiowania zadań CRON

## Flow typu CRON
Flow CRON definiuje się w flows.json lub flows/*.json jako obiekt z:
- `name`: unikalna nazwa
- `type`: CRON
- `crontable`: tablica wpisów CRON
- `start`: pierwszy krok
- `steps`: obiekt kroków

### Przykład
```json
{
  "name": "cron_hello",
  "type": "CRON",
  "crontable": [ "10:00:00", "11:00:00", "*:10:00", "*3" ],
  "start": "say_hello",
  "steps": { "say_hello": { "operation": "return", "status": 200, "body": { "message": "Hello!" } } }
}
```

## Format crontable
- `HH:MM:SS` – codziennie o podanej godzinie
- `*:MM:SS` – co godzinę o podanej minucie i sekundzie
- `*N` – co N minut

## Synchronizacja CRON
- Harmonogram CRON jest synchronizowany automatycznie przy starcie serwisu oraz ręcznie przez endpoint `/admin/recalculate_cron_table`.
- Synchronizacja polega na dodaniu nowych zadań, usunięciu znikniętych, aktualizacji zmienionych oraz pozostawieniu niezmienionych.

## Przykład nowego zadania CRON
1. Dodaj nowy flow typu CRON do flows.json lub flows/*.json.
2. Zrestartuj serwis lub wywołaj endpoint `/admin/recalculate_cron_table`.
3. Sprawdź scheduler_state.json – nowe zadanie powinno się pojawić.

---
Szczegóły: patrz flows.json, flows/*.json oraz README.md.
