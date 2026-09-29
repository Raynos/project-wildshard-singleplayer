# Hourly prebuilt production deployment

**State:** `in progress` 2026-09-28 — E273 and E275: workflow and production verification remain; E274 records the asset trim plan.

| Step | Result | Status |
| --- | --- | --- |
| D1 | Keep push and pull request verification, move production deployment to hourly and manual triggers | in progress |
| D2 | Skip the hourly job when `/version.json` already identifies the current commit | in progress |
| D3 | Build Vercel output in GitHub Actions and deploy it with `--prebuilt`, preserving API functions and routing | in progress |
| D4 | Run CSS, type, lint and unit gates once in GitHub; Vercel's build command runs only Vite | in progress |
| D5 | Verify a scheduled/manual deployment, public version, API paths, cache headers and a repeat skip | open |

The current project-scoped deployment token can upload a deployment but cannot
run `vercel pull` or `vercel build`. A separate team-scoped CI build token is
needed for the standard Vercel prebuilt path; it stays in GitHub Actions secrets.
Do not replace the deployment token or commit any token or downloaded environment
file. Vercel's CLI rejected creating that token from the current app login (403),
so D5 needs the GitHub secret `VERCEL_BUILD_TOKEN` from a human-created token.

Vercel project `wildshard-singleplayer` remains the only production target.
The hourly job checks the public `version.json` build ID, whose first seven
characters are the Git SHA. A failed check proceeds to a deploy so a stale or
unavailable site can recover. GitHub Actions concurrency prevents overlapping
production jobs.
