# Hourly prebuilt production deployment

**State:** `in progress` 2026-09-28 — E273 and E275: workflow and production verification remain; E274 records the asset trim plan.

| Step | Result | Status |
| --- | --- | --- |
| D1 | Keep push and pull request verification, move production deployment to hourly and manual triggers | in progress |
| D2 | Skip the hourly job when `/version.json` already identifies the current commit | in progress |
| D3 | Build Vercel output in GitHub Actions and deploy it with `--prebuilt`, preserving API functions and routing | in progress |
| D4 | Run CSS, type, lint and unit gates once in GitHub; Vercel's build command runs only Vite | in progress |
| D5 | Verify a scheduled/manual deployment, public version, API paths, cache headers and a repeat skip | open |

The old project-scoped token fails Vercel CLI's account lookup, including on
`vercel deploy --prebuilt`. The team-scoped `VERCEL_BUILD_TOKEN` now handles
`vercel pull`, `vercel build`, and the prebuilt upload. It stays in GitHub Actions
secrets; no token or downloaded environment file belongs in Git. Vercel's CLI
rejected creating this token from the desktop login (403), so the user created it
in Vercel account settings and supplied it for the repository secret.

Vercel project `wildshard-singleplayer` remains the only production target.
The hourly job checks the public `version.json` build ID, whose first seven
characters are the Git SHA. A failed check proceeds to a deploy so a stale or
unavailable site can recover. GitHub Actions concurrency prevents overlapping
production jobs.
