---
name: sync-bodyspec
description: Sync BodySpec DEXA scan results into the health database. Use when the user wants to pull the latest BodySpec scans, refresh body composition data, or sync new scan results.
allowed-tools: mcp__bodyspec__list_scan_results, Bash
---

Sync all BodySpec DEXA scan results into the health SQLite database.

## Requirements

- BodySpec MCP server must be configured in your NanoClaw `.mcp.json`. See: https://github.com/qwibitai/NanoClaw for setup instructions.
- The `scripts/sync-bodyspec.ts` script must be present in your NanoClaw installation.

## Steps

1. Call `mcp__bodyspec__list_scan_results` with `page_size: 100` to fetch all scans.

2. Pass the full JSON response to the sync script:
```bash
npx tsx scripts/sync-bodyspec.ts '<json>'
```

3. Report how many scans were synced and the date range covered.

4. If new scans were added, remind the user to update `groups/health_coach/health/current-status.md` with the latest body composition data.
