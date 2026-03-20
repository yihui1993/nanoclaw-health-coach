#!/bin/bash
# Initialize the health database
DB=/workspace/group/health/health.db

sqlite3 "$DB" <<'SQL'
CREATE TABLE IF NOT EXISTS body_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  source TEXT NOT NULL,          -- 'bodyspec' | 'manual'
  weight_kg REAL,
  body_fat_pct REAL,
  muscle_mass_kg REAL,
  bone_mass_kg REAL,
  visceral_fat_level REAL,
  bmr_kcal INTEGER,
  notes TEXT,
  file_path TEXT,                -- path to uploaded scan document
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,       -- ISO8601, exact time of meal
  meal_type TEXT,                -- 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
  photo_path TEXT,               -- container path to photo
  description TEXT,              -- agent's vision description of food
  estimated_calories INTEGER,
  estimated_protein_g REAL,
  estimated_carbs_g REAL,
  estimated_fat_g REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sleep_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,     -- YYYY-MM-DD (the date you woke up)
  bedtime TEXT NOT NULL,         -- ISO8601
  wake_time TEXT NOT NULL,       -- ISO8601
  duration_hours REAL,
  avg_bpm INTEGER,               -- avg heart rate for the night (optional)
  body_notes TEXT,               -- soreness, headache, etc.
  energy_level INTEGER,          -- 1-5 subjective scale
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,            -- YYYY-MM-DD
  photo_path TEXT,               -- screenshot from workout app
  duration_mins INTEGER,
  exercises TEXT,                -- JSON: [{name, sets:[{reps,weight_kg}]}]
  muscle_groups TEXT,            -- JSON array: ["chest","triceps"]
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS body_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,     -- YYYY-MM-DD
  muscle_pain TEXT,              -- description of pain areas or 'none'
  headache INTEGER DEFAULT 0,    -- 0/1
  fatigue_level INTEGER,         -- 1-5
  mood INTEGER,                  -- 1-5
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
SQL

echo "Health database initialized at $DB"
