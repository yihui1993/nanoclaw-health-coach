# nanoclaw-health-coach

A personal AI health coach for [NanoClaw](https://github.com/qwibitai/NanoClaw). Tracks nutrition, sleep, workouts, and body composition directly from your messaging app. Understands your goals and gives advice grounded in your actual data.

Works with **any NanoClaw channel**: Telegram, WhatsApp, Discord, Slack, or any other channel you have installed.

---

## Features

### Meal logging
- Log meals by text description ("I just had chicken and rice")
- Log meals from a photo — the agent reads the photo and estimates nutrition
- Use named shortcuts for meals you eat frequently (e.g., "standard breakfast" → instantly logged with exact macros)
- See running daily totals (calories, protein, carbs, fat) after every log

### Sleep logging
- Log bedtime and wake time in natural language ("went to bed at 11, woke up at 7")
- Tracks duration, optional avg heart rate, energy level, and body notes
- Flags short sleep (<6.5h)

### Workout logging
- Log from a text description ("just did squats 4x8 at 60kg, bench 3x10 at 50kg")
- Or send a screenshot from your gym app — the agent reads it automatically
- Tracks exercises, sets, reps, weights, muscle groups

### Exercise suggestions
- "What should I do at the gym today?"
- Agent checks your recent workout history, last sleep quality, and any body pain to recommend what to train and at what intensity
- Applies muscle group rotation (no re-training the same group within 48h)

### Body status
- Log pain, soreness, headaches, fatigue, mood
- Agent factors this into exercise and recovery suggestions

### Daily nutrition summary
- Ask "how am I doing today?" to see calories, protein, carbs, fat vs. your targets
- Proactive flagging if protein falls short or calories go out of range

### Bedtime recommendation
- "When should I go to bed tonight?"
- Based on your sleep history and recovery needs

### Body composition tracking
- Log manual weigh-ins or body fat measurements
- Query and compare to previous data
- Compatible with [BodySpec DEXA sync](https://github.com/qwibitai/NanoClaw) if you use BodySpec

---

## Supported Channels

Works with any NanoClaw channel. After setup, register the group with:

| Channel | Registration command |
|---------|---------------------|
| Telegram | `register health_coach as tg:<chat_id>` |
| WhatsApp | `register health_coach as wa:<phone_number>` |
| Discord  | `register health_coach as discord:<channel_id>` |
| Slack    | `register health_coach as slack:<channel_id>` |

---

## Prerequisites

1. **NanoClaw** must be installed and running. See: https://github.com/qwibitai/NanoClaw
2. **A channel skill** must be installed for whichever messaging app you want to use:
   - Telegram: run `/add-telegram` in Claude Code inside your NanoClaw directory
   - WhatsApp: run `/add-whatsapp`
   - Discord: run `/add-discord`
   - Slack: run `/add-slack`

---

## Installation

```bash
# Step 1: Navigate to your NanoClaw directory
cd /path/to/your/NanoClaw

# Step 2: Clone this skill into your NanoClaw skills directory
git clone https://github.com/yihuima/nanoclaw-health-coach .claude/skills/health-coach

# Step 3: Apply the skill — it will walk you through setup interactively
npx tsx scripts/apply-skill.ts .claude/skills/health-coach
```

The setup wizard will ask for:
- Your current weight and body fat % (optional)
- Your primary goal (body recomposition / fat loss / muscle gain / general health)
- Your daily calorie and protein targets
- Your timezone
- Which channel to connect

It will then create the `groups/health_coach/` directory, initialize the SQLite database, and write a personalized agent configuration.

---

## Meal Shortcuts

Meal shortcuts let you log common meals instantly by name. The default shortcuts included are generic staples (protein powder, greek yogurt, eggs, white rice, etc.).

**To use a shortcut:** Just mention the name — "I had greek yogurt" logs it with exact macros.

**To add your own shortcuts**, edit `groups/health_coach/meal-shortcuts.json`:

```json
{
  "standard breakfast": {
    "description": "1 egg, 1 scoop protein, 240ml soymilk",
    "calories": 230,
    "protein_g": 29,
    "carbs_g": 6,
    "fat_g": 9
  }
}
```

Or ask Claude Code: "add 'standard breakfast' to my meal shortcuts — 230 kcal, 29g protein, 6g carbs, 9g fat"

---

## Day Boundary Rule

The agent treats a "day" as running from **6:00am to 5:59am** in your local timezone (configurable during setup). This matches how most people actually think about their day — late-night meals count toward the day you're still awake, not the next calendar day.

The timezone is set during installation and embedded in the agent's configuration. To change it later, edit `groups/health_coach/CLAUDE.md` and update the day boundary SQL queries.

---

## Database

All health data is stored in a local SQLite database at `groups/health_coach/health/health.db`.

Tables:
| Table | Contents |
|-------|----------|
| `meals` | Meal logs with timestamps, macros, photos |
| `sleep_log` | Sleep records: bedtime, wake, duration, heart rate |
| `workouts` | Workout sessions: exercises, sets, reps, weights |
| `body_status` | Daily pain, fatigue, mood |
| `body_metrics` | Body composition: weight, body fat %, lean mass |

You can query it directly:
```bash
sqlite3 groups/health_coach/health/health.db "SELECT * FROM meals ORDER BY timestamp DESC LIMIT 10;"
```

---

## Updating

```bash
cd .claude/skills/health-coach
git pull
cd ../../../
npx tsx scripts/apply-skill.ts .claude/skills/health-coach
```

The skills engine will apply any new template files from `add/` without touching your existing data or CLAUDE.md.

---

## Companion Claude Code Skills

This repo also includes Claude Code skills for logging health data directly from Claude Code — useful when you're at your computer and don't want to go through your messaging app. They read and write the same `health.db` as the chat agent.

| Skill | Description |
|-------|-------------|
| `/log-meal` | Log a meal with nutrition estimation and running daily totals |
| `/log-sleep` | Log bedtime/wake time with duration and heart rate |
| `/sync-bodyspec` | Sync BodySpec DEXA scan results into the database (requires BodySpec MCP) |

### Install companion skills

```bash
# From inside your NanoClaw directory
cp -r .claude/skills/health-coach/skills/log-meal .claude/skills/
cp -r .claude/skills/health-coach/skills/log-sleep .claude/skills/
cp -r .claude/skills/health-coach/skills/sync-bodyspec .claude/skills/
```

Then use them in Claude Code:
```
/log-meal I had oatmeal with protein powder for breakfast
/log-sleep went to bed at 11pm, woke up at 7am
/sync-bodyspec
```
