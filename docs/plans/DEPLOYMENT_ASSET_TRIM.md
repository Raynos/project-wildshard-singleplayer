# Wildshard deployment asset trim

**State:** `in progress` 2026-09-28 — E274: removed API test functions; remaining asset cuts await usage and offline fallback verification.

The clean-export prebuilt output contains 1,375 static files / 524.5 MiB.
Largest classes: GPU assets 202.7 MiB, original textures 82.7 MiB,
HDRIs 38.9 MiB, audio 30.6 MiB, source maps 19.2 MiB, video 9.6 MiB.
The Vercel build also creates four API functions. Two are test files under
`api/` (about 6.4 MiB combined) and are not visitor routes.

| Priority | Candidate | Gate before removal | Expected effect |
| --- | --- | --- | --- |
| T1 — done | Move `api/*.test.ts` out of Vercel's function discovery path | Unit tests still run; `/api/inbox` and `/api/errors` keep their handlers and status codes | Remove two unnecessary functions from every deployment |
| T2 | Audit production `.js.map` files | Confirm Sentry debugging does not depend on publicly served maps; retain a private upload if needed | Up to 19.2 MiB less static output |
| T3 | Map original `assets/tex/` textures against GPU KTX2 variants and runtime fallbacks | Automated reference search plus real desktop and phone boot/offline checks for all three shards | Remove only verified duplicate originals from the 82.7 MiB class |
| T4 | Inventory 26 HDRIs and two videos against live scenes and trailer links | Keep every selected sky/time-of-day and user-facing video | Compress or omit unused members of the 48.5 MiB combined class |
| T5 | Keep large immutable packs outside frequent deployment output only after a measured cost comparison | Compare Vercel deployment storage against Blob/CDN storage and transfer, then verify offline precache and update behavior | Reduce per-deployment bytes if the external path is cheaper |

The `public/assets/` tree is part of the offline PWA and has content-hash
versioning. Do not blanket-ignore it or remove a raw texture merely because a
KTX2 counterpart exists. Every accepted cut needs a clean-export build, byte
manifest comparison, desktop and mobile visitor flow, offline reload, and
production URL check. E273's hourly prebuilt deploy and one-day Vercel retention
are already the immediate storage controls; this plan targets bytes per release.
