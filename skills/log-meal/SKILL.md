---
name: log-meal
description: Log a meal to the health database. Use when the user wants to record food intake, log breakfast/lunch/dinner/snack, or track calories and macros.
allowed-tools: Bash, Read
---

Log a meal entry to the health database.

## Steps

1. If the user hasn't already described their meal, ask what they ate and when.

2. Check meal shortcuts for any named items:
```bash
cat groups/health_coach/meal-shortcuts.json
```
Use exact macro values from the shortcut. For portions (e.g. "1/2 chicken breast"), scale proportionally.

3. For any items NOT in shortcuts, estimate nutrition using standard USDA values. Show a breakdown table:

| Item | Kcal | P | C | F |
|------|------|---|---|---|
| ... | ... | ... | ... | ... |
| **Total** | **X** | **Xg** | **Xg** | **Xg** |

4. Infer meal_type from time if not stated (breakfast 6–10, lunch 11–14, dinner 17–21, otherwise snack).

5. Ask for confirmation if anything is ambiguous. Otherwise log immediately:
```bash
sqlite3 groups/health_coach/health/health.db "INSERT INTO meals (timestamp, meal_type, description, estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g) VALUES ('[YYYY-MM-DD HH:MM:SS]', '[meal_type]', '[description]', [cal], [protein], [carbs], [fat]);"
```

6. Show today's running totals. Replace `-6 hours` and `-13 hours` with your timezone offsets if not on PDT (UTC-7):
```bash
sqlite3 groups/health_coach/health/health.db "SELECT SUM(estimated_calories), SUM(estimated_protein_g), SUM(estimated_carbs_g), SUM(estimated_fat_g) FROM meals WHERE date(timestamp, '-6 hours') = date('now', '-13 hours');"
```

## Notes
- Timestamps should be stored in your local timezone (default: PDT, UTC-7). Adjust the SQL offsets if you're in a different timezone.
- "Today's intake" = 6:00am today through 5:59am next day (configurable day boundary)
- Never estimate when a shortcut exists — use exact shortcut values
- Keep the confirmation reply concise
