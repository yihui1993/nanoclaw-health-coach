// Tab navigation
const navLinks = document.querySelectorAll('nav ul a');
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  navLinks.forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  navLinks.forEach(a => { if (a.getAttribute('onclick')?.includes(`'${name}'`)) a.classList.add('active'); });
  if (!loadedTabs.has(name)) { loadTab(name); loadedTabs.add(name); }
}
const loadedTabs = new Set();

// Chart defaults
Chart.defaults.color = '#64748b';
Chart.defaults.borderColor = '#2d3148';
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function makeLineChart(id, labels, datasets) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: datasets.length > 1 } },
      scales: {
        x: { grid: { color: '#2d3148' }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: '#2d3148' } }
      }
    }
  });
}

function lineDataset(label, data, color) {
  return {
    label, data,
    borderColor: color,
    backgroundColor: color + '22',
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.3,
    fill: false,
  };
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function api(path) {
  const r = await fetch(path);
  return r.json();
}

// ── Overview ──────────────────────────────────────────────────────────────────
function setDelta(id, current, previous, unit, lowerIsBetter) {
  const el = document.getElementById(id);
  if (!el || current == null || previous == null) return;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) { el.textContent = 'no change'; return; }
  const sign = diff > 0 ? '+' : '';
  el.textContent = `${sign}${diff}${unit} vs prev scan`;
  el.className = 'stat-delta ' + ((diff > 0) === lowerIsBetter ? 'down' : 'up');
}

async function loadHome() {
  const stats = await api('/api/stats');
  if (!stats.initialized) {
    document.getElementById('stats-grid').innerHTML = '<p style="color:var(--muted);grid-column:1/-1">No health data yet. Start logging via your messaging app!</p>';
    return;
  }

  const b = stats.lastBody;
  const p = stats.prevBody;
  document.getElementById('stat-weight').textContent = b?.weight_kg ? b.weight_kg + ' kg' : '—';
  document.getElementById('stat-fat').textContent = b?.body_fat_pct ? b.body_fat_pct + '%' : '—';
  document.getElementById('stat-muscle').textContent = b?.muscle_mass_kg ? b.muscle_mass_kg + ' kg' : '—';
  document.getElementById('stat-sleep').textContent = stats.avgSleep ? stats.avgSleep + 'h' : '—';
  document.getElementById('stat-workouts-week').textContent = stats.workoutsThisWeek ?? '—';
  document.getElementById('stat-hr').textContent = stats.lastAvgBpm ? stats.lastAvgBpm + ' bpm' : '—';

  setDelta('stat-weight-delta', b?.weight_kg, p?.weight_kg, ' kg', true);
  setDelta('stat-fat-delta', b?.body_fat_pct, p?.body_fat_pct, '%', true);
  setDelta('stat-muscle-delta', b?.muscle_mass_kg, p?.muscle_mass_kg, ' kg', false);

  const [bodyData, sleepData, workoutData, nutritionData] = await Promise.all([
    api('/api/body'), api('/api/sleep'), api('/api/workouts'), api('/api/nutrition-summary')
  ]);

  const recentBody = bodyData.slice(-10);
  makeLineChart('chart-home-body',
    recentBody.map(r => r.date),
    [lineDataset('Fat %', recentBody.map(r => r.body_fat_pct), '#fb923c'),
     lineDataset('Muscle kg', recentBody.map(r => r.muscle_mass_kg), '#4ade80')]
  );

  const last30sleep = sleepData.slice(-30);
  makeLineChart('chart-home-sleep',
    last30sleep.map(r => r.date),
    [lineDataset('Hours', last30sleep.map(r => r.duration_hours), '#6c8cff')]
  );

  // Workout frequency bar chart (last 12 weeks)
  const now = new Date();
  const weeks = [], weekCounts = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    weeks.push(weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' }));
    weekCounts.push(workoutData.filter(w => { const d = new Date(w.date); return d >= weekStart && d < weekEnd; }).length);
  }
  const woCtx = document.getElementById('chart-home-workouts');
  if (woCtx) {
    if (woCtx._chart) woCtx._chart.destroy();
    woCtx._chart = new Chart(woCtx, {
      type: 'bar',
      data: { labels: weeks, datasets: [{ label: 'Workouts', data: weekCounts, backgroundColor: '#6c8cff99', borderColor: '#6c8cff', borderWidth: 1, borderRadius: 4 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#2d3148' } }, y: { grid: { color: '#2d3148' }, ticks: { stepSize: 1 }, min: 0 } } }
    });
  }

  // Nutrition trend (last 14 days: protein bars + calorie line)
  const last14nutrition = nutritionData.slice(-14);
  const nutCtx = document.getElementById('chart-home-nutrition');
  if (nutCtx) {
    if (nutCtx._chart) nutCtx._chart.destroy();
    nutCtx._chart = new Chart(nutCtx, {
      type: 'bar',
      data: {
        labels: last14nutrition.map(r => r.date),
        datasets: [
          { label: 'Protein (g)', data: last14nutrition.map(r => r.protein), backgroundColor: '#4ade8099', borderColor: '#4ade80', borderWidth: 1, borderRadius: 4, yAxisID: 'y' },
          { label: 'Calories', data: last14nutrition.map(r => r.calories), type: 'line', borderColor: '#fb923c', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.3, yAxisID: 'y1' },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          x: { grid: { color: '#2d3148' }, ticks: { maxTicksLimit: 8 } },
          y: { grid: { color: '#2d3148' }, position: 'left', title: { display: true, text: 'Protein (g)', color: '#4ade80', font: { size: 10 } } },
          y1: { grid: { drawOnChartArea: false }, position: 'right', title: { display: true, text: 'kcal', color: '#fb923c', font: { size: 10 } } },
        }
      }
    });
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────
function makeGroupedBarChart(id, labels, datasets, yLabel) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: true, labels: { font: { size: 11 }, color: '#64748b' } } },
      scales: {
        x: { grid: { color: '#2d3148' } },
        y: { grid: { color: '#2d3148' }, title: { display: true, text: yLabel, color: '#64748b', font: { size: 11 } } },
      },
    },
  });
}

async function loadBody() {
  const [data, scans] = await Promise.all([api('/api/body'), api('/api/body/scans')]);

  if (!data.length) {
    document.getElementById('tab-body').querySelector('h1').insertAdjacentHTML('afterend',
      '<p style="color:var(--muted);margin-bottom:1.5rem">No body scan data yet. Run /sync-bodyspec in Claude Code.</p>');
    return;
  }

  const labels = data.map(r => r.date);
  const SCAN_COLORS = ['#6c8cff', '#fb923c', '#4ade80', '#f43f5e', '#a78bfa'];

  makeLineChart('chart-weight', labels, [lineDataset('Weight (kg)', data.map(r => r.weight_kg), '#6c8cff')]);
  makeLineChart('chart-fat', labels, [lineDataset('Fat %', data.map(r => r.body_fat_pct), '#fb923c')]);
  makeLineChart('chart-muscle', labels, [lineDataset('Lean Mass (kg)', data.map(r => r.muscle_mass_kg), '#4ade80')]);
  makeLineChart('chart-vat', labels, [lineDataset('VAT (kg)', data.map(r => r.visceral_fat_level), '#f43f5e')]);

  const richScans = scans.filter(s => s.scan);
  if (richScans.length) {
    // Bone density trend
    makeLineChart('chart-bone-density', richScans.map(s => s.date), [
      lineDataset('BMD (g/cm²)', richScans.map(s => s.scan.bone_density?.total?.bmd_g_cm2 ?? null), '#a78bfa'),
    ]);

    // Regional body fat % — timeline
    const scanDates = richScans.map(s => s.date);
    const fatRegionDefs = [
      { key: 'trunk',   label: 'Trunk',   color: '#6c8cff' },
      { key: 'android', label: 'Android', color: '#fb923c' },
      { key: 'gynoid',  label: 'Gynoid',  color: '#4ade80' },
      { key: 'arms',    label: 'Arms',    color: '#f43f5e' },
      { key: 'legs',    label: 'Legs',    color: '#a78bfa' },
    ];
    makeLineChart('chart-regional-fat', scanDates,
      fatRegionDefs.map(({ key, label, color }) =>
        lineDataset(label, richScans.map(s => s.scan.composition[key]?.region_fat_pct ?? null), color)
      )
    );

    // Regional lean mass — timeline
    const leanRegionDefs = [
      { key: 'trunk', label: 'Trunk', color: '#6c8cff' },
      { key: 'arms',  label: 'Arms',  color: '#f43f5e' },
      { key: 'legs',  label: 'Legs',  color: '#a78bfa' },
    ];
    makeLineChart('chart-regional-lean', scanDates,
      leanRegionDefs.map(({ key, label, color }) =>
        lineDataset(label, richScans.map(s => s.scan.composition[key]?.lean_mass?.kg ?? null), color)
      )
    );

  }

  // Scan history table
  const tbody = document.querySelector('#body-table tbody');
  tbody.innerHTML = scans.slice().reverse().map(r => {
    const bmd = r.scan?.bone_density?.total?.bmd_g_cm2;
    const pct = r.scan?.percentiles?.metrics;
    return `
      <tr>
        <td>${r.date}</td>
        <td>${r.weight_kg != null ? r.weight_kg + ' kg' : '—'}</td>
        <td>${r.body_fat_pct != null ? r.body_fat_pct + '%' : '—'}</td>
        <td>${r.muscle_mass_kg != null ? r.muscle_mass_kg + ' kg' : '—'}</td>
        <td>${r.bone_mass_kg != null ? r.bone_mass_kg + ' kg' : '—'}</td>
        <td>${r.visceral_fat_level != null ? r.visceral_fat_level + ' kg' : '—'}</td>
        <td>${bmd != null ? bmd : '—'}</td>
        <td>${pct?.total_body_fat_pct?.percentile != null ? pct.total_body_fat_pct.percentile + 'th' : '—'}</td>
        <td>${pct?.limb_lmi_kg_m2?.percentile != null ? pct.limb_lmi_kg_m2.percentile + 'th' : '—'}</td>
      </tr>`;
  }).join('');
}

// Convert ISO/time string to decimal hour (bedtime after noon uses 24+ for next-day wrapping)
function timeToDecimalHour(iso, wrapAfterNoon = false) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const h = d.getHours() + d.getMinutes() / 60;
    // bedtime: if hour < 12 (e.g. 1am), treat as 24+h so chart doesn't jump
    if (wrapAfterNoon && h < 12) return h + 24;
    return h;
  } catch { return null; }
}

function makeTimeChart(id, labels, data, color) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [lineDataset('', data, color)],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#2d3148' }, ticks: { maxTicksLimit: 8 } },
        y: {
          grid: { color: '#2d3148' },
          ticks: {
            callback: v => {
              const h = Math.floor(v % 24);
              const m = Math.round((v % 1) * 60);
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            },
          },
        },
      },
    },
  });
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
async function loadSleep() {
  const data = await api('/api/sleep');
  const last60 = data.slice(-60);

  // Chart 1: Sleep Duration + Avg Heart Rate (dual y-axis)
  (function() {
    const ctx = document.getElementById('chart-sleep-duration');
    if (!ctx) return;
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last60.map(r => r.date),
        datasets: [
          { ...lineDataset('Duration (h)', last60.map(r => r.duration_hours), '#6c8cff'), yAxisID: 'y' },
          { ...lineDataset('Avg HR (bpm)', last60.map(r => r.avg_bpm ?? null), '#f87171'), yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          x: { grid: { color: '#2d3148' }, ticks: { maxTicksLimit: 8 } },
          y: { grid: { color: '#2d3148' }, title: { display: true, text: 'h', color: '#6c8cff', font: { size: 10 } } },
          y1: { grid: { drawOnChartArea: false }, position: 'right', title: { display: true, text: 'bpm', color: '#f87171', font: { size: 10 } } },
        },
      },
    });
  })();

  // Chart 2: Bedtime + Wake-up Time (shared time y-axis)
  (function() {
    const ctx = document.getElementById('chart-sleep-bedtime');
    if (!ctx) return;
    if (ctx._chart) ctx._chart.destroy();
    const timeTick = v => {
      const h = Math.floor(v % 24);
      const m = Math.round((v % 1) * 60);
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    };
    ctx._chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last60.map(r => r.date),
        datasets: [
          { ...lineDataset('Bedtime', last60.map(r => timeToDecimalHour(r.bedtime, true)), '#a78bfa'), yAxisID: 'y' },
          { ...lineDataset('Wake-up', last60.map(r => timeToDecimalHour(r.wake_time, false)), '#34d399'), yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          x: { grid: { color: '#2d3148' }, ticks: { maxTicksLimit: 8 } },
          y: { grid: { color: '#2d3148' }, ticks: { callback: timeTick }, title: { display: true, text: 'Bedtime', color: '#a78bfa', font: { size: 10 } } },
          y1: { grid: { drawOnChartArea: false }, position: 'right', ticks: { callback: timeTick }, title: { display: true, text: 'Wake-up', color: '#34d399', font: { size: 10 } } },
        },
      },
    });
  })();

  const tbody = document.querySelector('#sleep-table tbody');
  tbody.innerHTML = data.slice().reverse().map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${fmtTime(r.bedtime)}</td>
      <td>${fmtTime(r.wake_time)}</td>
      <td>${r.duration_hours ? r.duration_hours + 'h' : '—'}</td>
      <td>${r.avg_bpm ? r.avg_bpm + ' bpm' : '—'}</td>
    </tr>`).join('');
}

function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// ── Workouts ──────────────────────────────────────────────────────────────────
function getExerciseCategory(name) {
  const n = name.toLowerCase();
  if (/treadmill|walk|run|jog|cardio|bike|elliptical|stair/.test(n)) return 'cardio';
  if (/leg raise|crunch|plank|sit.?up|\bab\b|core|oblique|russian/.test(n)) return 'core';
  if (/squat|leg extension|leg curl|leg press|lunge|deadlift|calf raise|hip thrust/.test(n)) return 'legs';
  if (/bench press|chest fly|\bchest\b|push.?up|\bpec\b/.test(n)) return 'chest';
  if (/lat pulldown|pulldown|pull.?up|chin.?up|\brow\b|back extension/.test(n)) return 'back';
  if (/shoulder press|military press|lateral raise|front raise|dumbbell raise|overhead press|arnold/.test(n)) return 'shoulders';
  if (/\bcurl\b|tricep|bicep|\bdip\b|hammer|preacher/.test(n)) return 'arms';
  return null;
}

async function loadWorkouts() {
  const data = await api('/api/workouts');
  const container = document.getElementById('workout-calendar');

  if (!data.length) {
    container.innerHTML = '<p style="color:var(--muted)">No workouts logged yet. Send a gym screenshot via your messaging app!</p>';
    return;
  }

  // ── Summary chart: workouts per week (last 12 weeks) ──────────────────────
  const now = new Date();
  const weeks = [];
  const weekCounts = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const label = `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    const count = data.filter(w => {
      const d = new Date(w.date);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeks.push(label);
    weekCounts.push(count);
  }
  const freqCtx = document.getElementById('chart-workout-frequency');
  if (freqCtx) {
    if (freqCtx._chart) freqCtx._chart.destroy();
    freqCtx._chart = new Chart(freqCtx, {
      type: 'bar',
      data: {
        labels: weeks,
        datasets: [{ label: 'Workouts', data: weekCounts, backgroundColor: '#6c8cff99', borderColor: '#6c8cff', borderWidth: 1, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#2d3148' }, ticks: { maxTicksLimit: 12 } },
          y: { grid: { color: '#2d3148' }, ticks: { stepSize: 1 }, min: 0 }
        }
      }
    });
  }

  // ── Calendar layout ────────────────────────────────────────────────────────
  // Index workouts by date string
  const byDate = {};
  for (const w of data) {
    byDate[w.date] = w;
  }

  // Get sorted unique year-months (DESC)
  const months = [...new Set(data.map(w => w.date.slice(0, 7)))].sort().reverse();

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  container.innerHTML = months.map(ym => {
    const [year, month] = ym.split('-').map(Number);
    const monthName = new Date(year, month - 1, 1).toLocaleString([], { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();

    // Build flat array of cells: nulls for padding + day numbers
    const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    const tableRows = rows.map(row => {
      const tds = row.map(day => {
        if (!day) return '<td class="cal-day empty"></td>';
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const w = byDate[dateStr];
        if (!w) return `<td class="cal-day"><span class="cal-date-num">${day}</span></td>`;

        const exercises = safeJson(w.exercises, []);
        const byCategory = {};
        for (const ex of exercises) {
          const cat = getExerciseCategory(ex.name) || 'other';
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(ex.name);
        }
        const catPills = Object.entries(byCategory).map(([cat, names]) =>
          `<span class="cat-tag cat-${cat} cal-cat-pill" data-ex="${names.join(' · ')}">${cat}</span>`
        ).join('');

        return `<td class="cal-day has-workout">
          <span class="cal-date-num">${day}</span>
          <div class="cal-cats">${catPills}</div>
        </td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    return `
      <div class="workout-month">
        <h3>${monthName}</h3>
        <table class="workout-calendar">
          <thead><tr>${DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
  }).join('');
}

// ── Nutrition ─────────────────────────────────────────────────────────────────
async function loadNutrition() {
  const [summary, meals] = await Promise.all([api('/api/nutrition-summary'), api('/api/meals')]);

  const nutCtx = document.getElementById('chart-calories');
  if (nutCtx) {
    if (nutCtx._chart) nutCtx._chart.destroy();
    nutCtx._chart = new Chart(nutCtx, {
      type: 'line',
      data: {
        labels: summary.map(r => r.date),
        datasets: [
          { ...lineDataset('Calories', summary.map(r => r.calories), '#fb923c'), yAxisID: 'y' },
          { ...lineDataset('Protein (g)', summary.map(r => r.protein), '#4ade80'), yAxisID: 'y1' },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          x: { grid: { color: '#2d3148' }, ticks: { maxTicksLimit: 8 } },
          y:  { grid: { color: '#2d3148' }, position: 'left',  title: { display: true, text: 'kcal', color: '#fb923c', font: { size: 10 } } },
          y1: { grid: { drawOnChartArea: false }, position: 'right', title: { display: true, text: 'Protein (g)', color: '#4ade80', font: { size: 10 } } },
        }
      }
    });
  }

  const list = document.getElementById('meal-list');
  if (!meals.length) {
    list.innerHTML = '<p style="color:var(--muted)">No meals logged yet. Send a food photo via your messaging app!</p>';
    return;
  }

  list.innerHTML = meals.map(m => {
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const thumbHtml = m.photo_path
      ? `<img src="${containerToWebPath(m.photo_path)}" class="meal-row-thumb" onerror="this.style.display='none'">`
      : `<div class="meal-row-placeholder">🍽️</div>`;
    const macros = [
      m.estimated_calories ? `🔥 <span>${m.estimated_calories}</span> kcal` : '',
      m.estimated_protein_g ? `P <span>${m.estimated_protein_g}g</span>` : '',
      m.estimated_carbs_g ? `C <span>${m.estimated_carbs_g}g</span>` : '',
      m.estimated_fat_g ? `F <span>${m.estimated_fat_g}g</span>` : '',
    ].filter(Boolean).join(' ');
    return `
      <div class="meal-row">
        ${thumbHtml}
        <div class="meal-row-time">${time}</div>
        <div class="meal-row-type">${m.meal_type || ''}</div>
        <div class="meal-row-desc">${m.description || '—'}</div>
        <div class="meal-row-macros">${macros}</div>
      </div>`;
  }).join('');
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function safeJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// Convert container path to web-accessible URL
// /workspace/group/media/photos/x.jpg → /media/photos/x.jpg
function containerToWebPath(p) {
  if (!p) return '';
  return p.replace('/workspace/group/media', '/media');
}

// ── Router ────────────────────────────────────────────────────────────────────
function loadTab(name) {
  switch (name) {
    case 'home': loadHome(); break;
    case 'body': loadBody(); break;
    case 'sleep': loadSleep(); break;
    case 'workouts': loadWorkouts(); break;
    case 'nutrition': loadNutrition(); break;
  }
}

// Boot
loadHome();
loadedTabs.add('home');
