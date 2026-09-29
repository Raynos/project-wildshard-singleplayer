# Hourly prebuilt production deployment

**State:** `archived` 2026-09-28 (finished 2026-09-28) — hourly prebuilt production deployment verified; further asset cuts remain in E274.

| Step | Result | Status |
| --- | --- | --- |
| D1 | Keep push and pull request verification, move production deployment to hourly and manual triggers | done — push run 36521695425 passed without a deployment; project Git link is null |
| D2 | Skip the hourly job when `/version.json` already identifies the current commit | done — live check against `b15142b` wrote `skip=true` to `GITHUB_OUTPUT` |
| D3 | Build Vercel output in GitHub Actions and deploy it with `--prebuilt`, preserving API functions and routing | done — manual run 36521701229 deployed `dpl_QSvwYxzDjTG3yYLMXLNZnvvpcfdE` |
| D4 | Run CSS, type, lint and unit gates once in GitHub; Vercel's build command runs only Vite | done — push CI and clean export passed; `vercel build` ran in Actions |
| D5 | Verify production version, API paths and cache headers | done — `b15142b-mum6h1vq`, root 200, protected APIs 401, root/version `no-store` |

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

The first CI run exposed strict API test assertions; commit `4c91b4d3` fixed
them. The first manual run built successfully but the old project token failed
the prebuilt upload's account lookup. Commit `b15142b6` switched the upload to
the same team token used for `pull` and `build`; manual run 36521701229 then
passed end to end. The team Build CPU Minutes reading was $8.442 immediately
before and after this deployment (metering may lag). A second manual workflow
run became stale when another agent pushed a newer commit, so it was canceled;
the exact live-SHA skip step was run directly and emitted `skip=true`.
