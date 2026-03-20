import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import Database from 'better-sqlite3';
import express from 'express';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GROUPS_DIR = path.join(PROJECT_ROOT, 'groups');
const GROUP_FOLDER = process.env.HEALTH_GROUP || 'health_coach';
const HEALTH_DB = path.join(GROUPS_DIR, GROUP_FOLDER, 'health', 'health.db');
const MEDIA_DIR = path.join(GROUPS_DIR, GROUP_FOLDER, 'media');
const PHOTOS_DIR = path.join(MEDIA_DIR, 'photos');

const app = express();
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(MEDIA_DIR));

// ── Multer upload handlers ────────────────────────────────────────────────────
function makeStorage(dir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`);
    },
  });
}

const uploadPhoto = multer({
  storage: makeStorage(PHOTOS_DIR),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|heic)$/i;
    cb(null, allowed.test(file.originalname));
  },
});

// Redirect root to dashboard
app.get('/', (_req, res) => res.redirect('/public/index.html'));

// Open DB (returns null if not yet initialized)
function openDb(writable = false): Database.Database | null {
  if (!fs.existsSync(HEALTH_DB)) return null;
  return new Database(HEALTH_DB, { readonly: !writable });
}

// Migrate: add columns if not yet present
(function migrate() {
  const db = openDb(true);
  if (!db) return;
  try { db.prepare('ALTER TABLE body_metrics ADD COLUMN scan_json TEXT').run(); } catch {}
  try { db.prepare('ALTER TABLE sleep_log ADD COLUMN avg_bpm INTEGER').run(); } catch {}
  db.close();
})();

// ── Body Metrics ──────────────────────────────────────────────────────────────
app.get('/api/body', (_req, res) => {
  const db = openDb();
  if (!db) return res.json([]);
  const rows = db.prepare(
    'SELECT date, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat_level, bmr_kcal, source, notes FROM body_metrics ORDER BY date ASC'
  ).all();
  db.close();
  res.json(rows);
});

// ── Body Scans (full detail with scan_json) ───────────────────────────────────
app.get('/api/body/scans', (_req, res) => {
  const db = openDb();
  if (!db) return res.json([]);
  const rows = db.prepare(
    'SELECT date, source, weight_kg, body_fat_pct, muscle_mass_kg, bone_mass_kg, visceral_fat_level, scan_json FROM body_metrics ORDER BY date ASC'
  ).all() as any[];
  db.close();
  res.json(rows.map(r => ({
    date: r.date, source: r.source,
    weight_kg: r.weight_kg, body_fat_pct: r.body_fat_pct,
    muscle_mass_kg: r.muscle_mass_kg, bone_mass_kg: r.bone_mass_kg,
    visceral_fat_level: r.visceral_fat_level,
    scan: r.scan_json ? JSON.parse(r.scan_json) : null,
  })));
});

// ── Sleep ─────────────────────────────────────────────────────────────────────
app.get('/api/sleep', (_req, res) => {
  const db = openDb();
  if (!db) return res.json([]);
  const rows = db.prepare(
    'SELECT s.date, s.bedtime, s.wake_time, s.duration_hours, s.avg_bpm, s.body_notes, s.energy_level, b.muscle_pain, b.headache, b.fatigue_level FROM sleep_log s LEFT JOIN body_status b ON s.date = b.date ORDER BY s.date ASC'
  ).all();
  db.close();
  res.json(rows);
});

// ── Workouts ──────────────────────────────────────────────────────────────────
app.get('/api/workouts', (_req, res) => {
  const db = openDb();
  if (!db) return res.json([]);
  const rows = db.prepare(
    'SELECT id, date, photo_path, duration_mins, exercises, muscle_groups, notes, calories_burned, total_volume_lbs FROM workouts ORDER BY date DESC LIMIT 500'
  ).all();
  db.close();
  res.json(rows);
});

// ── Meals ─────────────────────────────────────────────────────────────────────
app.get('/api/meals', (req, res) => {
  const db = openDb();
  if (!db) return res.json([]);
  const { date } = req.query as { date?: string };
  let rows;
  if (date) {
    rows = db.prepare(
      "SELECT * FROM meals WHERE date(timestamp) = ? ORDER BY timestamp ASC"
    ).all(date);
  } else {
    rows = db.prepare(
      'SELECT * FROM meals ORDER BY timestamp DESC LIMIT 100'
    ).all();
  }
  db.close();
  res.json(rows);
});

// ── Log a meal (with optional photo) ─────────────────────────────────────────
app.post('/api/meals', uploadPhoto.single('photo'), (req, res) => {
  const db = openDb(true);
  if (!db) return res.status(503).json({ error: 'DB not initialized' });

  const tz = process.env.HEALTH_TZ || 'America/Los_Angeles';
  const { meal_type, description, calories, protein, carbs, fat, notes, timestamp } = req.body;
  const photoPath = req.file
    ? `/workspace/group/media/photos/${req.file.filename}`
    : null;

  const result = db.prepare(`
    INSERT INTO meals (timestamp, meal_type, photo_path, description, estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    timestamp || new Date().toLocaleString('sv-SE', { timeZone: tz }).replace('T', ' ').slice(0, 19),
    meal_type || null,
    photoPath,
    description || null,
    calories ? Number(calories) : null,
    protein ? Number(protein) : null,
    carbs ? Number(carbs) : null,
    fat ? Number(fat) : null,
    notes || null,
  );
  db.close();
  res.json({ id: result.lastInsertRowid, photo_path: photoPath });
});

// ── Delete a meal ─────────────────────────────────────────────────────────────
app.delete('/api/meals/:id', (req, res) => {
  const db = openDb(true);
  if (!db) return res.status(503).json({ error: 'DB not initialized' });
  db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

// Daily nutrition summary (last 30 days)
app.get('/api/nutrition-summary', (_req, res) => {
  const db = openDb();
  if (!db) return res.json([]);
  const rows = db.prepare(`
    SELECT date(timestamp) as date,
           SUM(estimated_calories) as calories,
           SUM(estimated_protein_g) as protein,
           SUM(estimated_carbs_g) as carbs,
           SUM(estimated_fat_g) as fat,
           COUNT(*) as meal_count
    FROM meals
    WHERE timestamp >= date('now', '-7 hours', '-30 days')
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `).all();
  db.close();
  res.json(rows);
});

// ── Stats summary for dashboard home ─────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  const db = openDb();
  if (!db) return res.json({ initialized: false });

  const lastBody = db.prepare('SELECT * FROM body_metrics ORDER BY date DESC LIMIT 1').get() as any;
  const prevBody = db.prepare('SELECT * FROM body_metrics ORDER BY date DESC LIMIT 1 OFFSET 1').get() as any;
  const lastSleep = db.prepare('SELECT * FROM sleep_log ORDER BY date DESC LIMIT 1').get() as any;
  const lastWorkout = db.prepare('SELECT date FROM workouts ORDER BY date DESC LIMIT 1').get() as any;
  const workoutsThisWeek = (db.prepare("SELECT COUNT(*) as c FROM workouts WHERE date >= date('now', '-7 hours', '-7 days')").get() as any)?.c ?? 0;
  const mealCountToday = (db.prepare("SELECT COUNT(*) as c FROM meals WHERE date(timestamp, '-6 hours') = date('now', '-13 hours')").get() as any)?.c ?? 0;
  const proteinToday = (db.prepare("SELECT SUM(estimated_protein_g) as p FROM meals WHERE date(timestamp, '-6 hours') = date('now', '-13 hours')").get() as any)?.p ?? null;
  const avgSleep = (db.prepare("SELECT AVG(duration_hours) as avg FROM sleep_log WHERE date >= date('now', 'localtime', '-14 days')").get() as any)?.avg;
  const lastHR = db.prepare('SELECT avg_bpm FROM sleep_log WHERE avg_bpm IS NOT NULL ORDER BY date DESC LIMIT 1').get() as any;

  db.close();
  res.json({
    initialized: true,
    lastBody,
    prevBody,
    lastSleep,
    lastWorkout,
    workoutsThisWeek,
    mealCountToday,
    proteinToday: proteinToday != null ? Math.round(proteinToday) : null,
    avgSleep: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
    lastAvgBpm: lastHR?.avg_bpm ?? null,
  });
});

const PORT = Number(process.env.HEALTH_DASHBOARD_PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Health dashboard running at http://localhost:${PORT}`);
});
