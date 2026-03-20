---
name: log-sleep
description: Log a sleep entry to the health database. Use when the user reports bedtime, wake time, or sleep quality.
allowed-tools: Bash
---

Log a sleep entry to the health database.

## Steps

1. If not already provided, ask for bedtime and wake time.

2. Parse natural language times — infer dates from context:
   - Bedtime is usually the previous night (yesterday's date if wake time is this morning)
   - Wake time is today

3. Calculate duration in hours (rounded to 1 decimal).

4. Extract any body notes from the same message (soreness, headache, fatigue level, mood).

5. Extract avg heart rate if mentioned (e.g. "avg HR 58", "heart rate was 62 bpm") — use NULL if not mentioned, do not ask for it.

6. Log to DB (INSERT OR REPLACE to avoid duplicates for the same wake date):
```bash
sqlite3 groups/health_coach/health/health.db "INSERT OR REPLACE INTO sleep_log (date, bedtime, wake_time, duration_hours, avg_bpm, body_notes, energy_level) VALUES ('[YYYY-MM-DD wake date]', '[YYYY-MM-DD HH:MM:SS bedtime]', '[YYYY-MM-DD HH:MM:SS wake]', [hours], [bpm or NULL], '[notes or NULL]', [1-5 or NULL]);"
```

7. Confirm: duration + avg HR if logged + brief observation:
   - < 6.5h: flag it — poor sleep impairs recovery and muscle retention
   - 7–9h: optimal for muscle recovery and body recomposition
   - ≥ 9h: note it's extra rest

## Notes
- Timestamps should be stored in your local timezone. Adjust the SQL date filter if not on PDT (UTC-7).
- The `date` field = wake date (the calendar day you woke up)
- `energy_level`: 1 (exhausted) to 5 (fully rested) — extract from context if mentioned
