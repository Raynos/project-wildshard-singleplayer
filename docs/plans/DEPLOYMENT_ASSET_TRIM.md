# Wildshard deployment asset trim

**State:** `in progress` 2026-10-03 — unblocked 2026-10-03 (Jake, E404): the E357 lock ended when GAME-NORMALIZATION was archived (`5390d75f9`). Unowned. Done: T1 (API test functions out of the deploy). T3 moved to GAME-NORMALIZATION X3. Open: T2 (public source maps), T4 (HDRIs + videos), T5 (big packs off the deploy, after a cost comparison), each with its offline-reload gate; T6 (the hourly cron fires every 4–6 h and *Verify production* reds a good deploy).

The clean-export prebuilt output contains 1,375 static files / 524.5 MiB.
Largest classes: GPU assets 202.7 MiB, original textures 82.7 MiB,
HDRIs 38.9 MiB, audio 30.6 MiB, source maps 19.2 MiB, video 9.6 MiB.
The Vercel build also creates four API functions. Two are test files under
`api/` (about 6.4 MiB combined) and are not visitor routes.

| Priority | Candidate | Gate before removal | Expected effect |
| --- | --- | --- | --- |
| T1 — done | Move `api/*.test.ts` out of Vercel's function discovery path | 619 tests pass; clean prebuilt output has two real functions; production `/api/inbox` and `/api/errors` each return 401 without credentials | Removed two unnecessary functions from every deployment |
| T2 | Audit production `.js.map` files | Confirm Sentry debugging does not depend on publicly served maps; retain a private upload if needed | Up to 19.2 MiB less static output |
| T3 | Map original `assets/tex/` textures against GPU KTX2 variants and runtime fallbacks | Automated reference search plus real desktop and phone boot/offline checks for all three shards | Remove only verified duplicate originals from the 82.7 MiB class |
| T4 | Inventory 26 HDRIs and two videos against live scenes and trailer links | Keep every selected sky/time-of-day and user-facing video | Compress or omit unused members of the 48.5 MiB combined class |
| T5 | Keep large immutable packs outside frequent deployment output only after a measured cost comparison | Compare Vercel deployment storage against Blob/CDN storage and transfer, then verify offline precache and update behavior | Reduce per-deployment bytes if the external path is cheaper |
| T6 | **The hourly deploy is not hourly** (found by E278/E411's desk, 2026-10-03): the `17 * * * *` cron in `.github/workflows/deploy.yml` fired 12 times 10-01 → 10-03, every 4–6 h (GitHub drops scheduled runs), and the 23:08Z run went red on *Verify production* although `version.json` already showed that run's build (`495eae4-mut0cg35`) | A green `main` reaches production within ~1 h without a hand `gh workflow run deploy` (e.g. a 15-minute cron behind the existing already-deployed skip), and *Verify production* retries `version.json` past the CDN's cache instead of failing a good deploy | Releases stop lagging main by half a day |

The `public/assets/` tree is part of the offline PWA and has content-hash
versioning. Do not blanket-ignore it or remove a raw texture merely because a
KTX2 counterpart exists. Every accepted cut needs a clean-export build, byte
manifest comparison, desktop and mobile visitor flow, offline reload, and
production URL check. E273's hourly prebuilt deploy and one-day Vercel retention
are already the immediate storage controls; this plan targets bytes per release.
