---
name: start-health-web
description: Start the health dashboard (localhost:3001) and open it in the browser. Use when the user wants to view their health charts, body composition trends, sleep history, or nutrition summary.
allowed-tools: Bash
---

Start the health dashboard web server and open it in the browser.

## Steps

1. Kill any existing health dashboard process:
```bash
pkill -f "tsx dashboard/server" 2>/dev/null; sleep 0.3
```

2. Start the server in the background:
```bash
npm run dashboard > /tmp/dashboard.log 2>&1 &
```

3. Wait for it to be ready, then open:
```bash
sleep 2 && open http://localhost:3001
```

4. Confirm it's responding:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
```

5. Report: **Health dashboard → http://localhost:3001**

## Notes
- Default port is 3001. Set `HEALTH_DASHBOARD_PORT` in your `.env` to use a different port.
- The dashboard reads from `groups/health_coach/health/health.db`. If you named your group folder differently, set `HEALTH_GROUP=your_folder_name` in your `.env`.
- If `npm run dashboard` is not found, add this to your `package.json` scripts: `"dashboard": "tsx dashboard/server.ts"`
