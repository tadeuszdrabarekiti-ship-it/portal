# Instrukcja definiowania flow

## Struktura pliku flow
Flow definiuje się w plikach JSON (flows.json lub flows/*.json) jako obiekt lub tablicę obiektów. Każdy flow ma:
- `name`: unikalna nazwa
- `type`: FLOW lub CRON
- `input`: schemat wejścia (params, query, body)
- `start`: nazwa pierwszego kroku
- `steps`: obiekt kroków

### Przykład
```json
{
  "name": "register",
  "type": "FLOW",
  "input": { "params": {}, "query": {}, "body": {} },
  "start": "step_10",
  "steps": {
    "step_10": { "operation": "http", "method": "GET", "url": "...", "next": "step_20" },
    "step_20": { "operation": "return", "status": 200, "body": { "result": "$step_10.response" } }
  }
}
```

## Kroki (operation)
- `http`: wywołanie HTTP (GET/POST/PATCH...)
- `call_flow`: wywołanie innego flow
- `transform`: przekształcenie danych
- `foreach`: iteracja po tablicy
- `wait`: opóźnienie (ms)
- `return`: zwrócenie odpowiedzi

## Zmienne i referencje
- Zmienne dostępne w flow: `$input.body`, `$step_10.response`, `$current_step`, `$previous_step`, itp.
- Referencje: `$nazwa.zmiennej` (np. `$step_20.httpstatus`)
- W stringach można używać referencji: "Witaj $input.body.name!"

## Funkcje !funkcja
Wyrażenia funkcyjne pozwalają na operacje logiczne, matematyczne, warunkowe:
- `!if`, `!lt`, `!gte`, `!eq`, `!parseInt`, `!parseString`, `!and`, `!or`, `!not`, `!cases`, `!random`, `!length`, `!concat`, `!includes`, `!match`, `!dateNow`, `!toUpperCase`, `!toLowerCase`, `!slice`, `!startsWith`, `!endsWith`, `!trim`, `!replace`, `!split`, `!join`, `!typeof`, `!file` (tylko w return)

### Przykład użycia !if
```json
"next": { "!if": [ { "!lt": [ "$step_10.httpstatus", 400 ] }, "step_20", "error_step" ] }
```

### Przykład !file
```json
"body": { "!file": "example.html" }
```

## Walidacja input
- Można zdefiniować `validation_schema` dla flow, obsługa błędów przez `validation_error_step`.

## Dobre praktyki
- Każdy krok powinien mieć unikalną nazwę.
- Używaj referencji do zmiennych i funkcji !funkcja dla logiki warunkowej.
- Testuj flow na prostych przykładach zanim wdrożysz produkcyjnie.

---
Szczegóły: patrz przykłady w flows.json i flows/*.json.
