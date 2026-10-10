# SF22: Pine departure headroom and first-entry owners

2026-10-10. Source pin `170180f1a81cc6a2b5bc68511a82692b49b7f8db`.
Pine departure measured **16.5 ms total / 14.1 ms leave**, compared with the preceding
matched pass's 32.7 / 29.5 ms. This is a repeat after a source fix, not an isolated A/B
saving. The fix avoids deriving full resident warning totals on every cache deletion
when there is no resident warning to update. Parent/page claim retirement still checks
immediately; caps, leases, refcounts and actual Developer warning totals are unchanged.

The 792-second Chromium Metal run used iPhone portrait 402×874, phone tier, 2× rendering,
Developer off, Memory saver off, Auto accepted KTX2, and the same G270 held-input route.
HTTP/disk version and owned listener matched. Shaping started after home readiness:
5 Mbit/s with the existing 3/10-second stalls. No limits or deadlines changed.

| Ruler | Result |
|---|---|
| Entries / physical crossings / activations | 6 / 12 / 5 |
| Refusals / page errors / network failures | 0 / 0 / 0 |
| Pine departure save / frame / leave | 2.2 / 0.2 / **14.1 ms** |
| Maximum entry commit / wait / activation | 0.2 / 3.3 / 5.6 ms |
| Other departures: Driftwood / Nalati / template / Sky / Signal | 15.4 / 16.4 / 29.1 / 8.2 / 3.4 ms |
| Drawn-frame p95 / p99 / maximum | 33.40000000002328 / 33.5 / 350 ms |
| Same-session standing p95 / observed timestamp quantum | 33.40000000002328 / 0.1 ms |
| First crossroads shader calls | 0 |
| Explicit warm-up calls / complete invocations / maximum invocation | 1,526 / 436 / 10.7 ms |
| Warm-up task upper bound | ≤50 ms; exact sub-threshold maximum unavailable |
| First entered-second tasks: Pine / Nalati / Signal | **67 / 84 / 52 ms** |
| First entered-second draw shader calls: Pine / Nalati / Signal | **2 / 14 / 0** |

This owner diagnostic wraps every draw and captures a boot-only CPU profile. Its cadence
is diagnostic, **not a new normative SF22 pass**; the existing [matched desktop pass](../sf22-crossing-pass-1c807/README.md)
remains the verdict. No reported Long Task overlaps any warm-up invocation: this bounds
its task at 50 ms, rather than reporting an invented exact maximum. Route load medians
were Pine 9.03, Nalati 9.74, template 32.80, Sky 37.32, Signal 30.48 and Driftwood 17.78.
Every route with any load sample >15 is labelled under load (all except Pine).

The remaining misses have named owners:

- Pine's two shader calls are one `impacts` InstancedMesh program. The ranged-feel
  entered service lazily creates it after preparation warm-up (`combat/chargeTells.ts`
  → `installRangedFeel` → `Impacts.for`). The empty debris pool is render preparation;
  its gameplay listeners must remain entered-only.
- Nalati's fourteen calls are seven object variants of its two `StaticBake` override
  ShaderMaterials (shadow depth and contact height). They first draw from `bake.update`
  in the entered look updater. They are absent from scene/post material inventory;
  the variants include coloured BatchedMesh, coloured InstancedMesh and plain meshes.
  The generic warm-up needs declared offscreen passes, without advancing simulation.
- Signal's 52 ms task has no shader calls; its CPU owner remains open.

Boot's largest observed tasks were 592 and 450 ms. The aggregate CPU profile identifies
platform seam certification and driver program-log resolution as candidates, but has no
page-clock synchronization anchor proving either owns those exact intervals. Harness-only
lazy fingerprint work also appears in the profile and is not ordinary production boot.
No exact task ownership or saving is claimed from that aggregate.

Memory remains **phone runs (G269)**. No Simulator was acquired; forced-compressed
Simulator Basis/RGBA storage is not a phone-memory verdict. All owned resources closed.

Only this summary is committed. Raw scratch:
`/private/tmp/claude-501/sp-builders/sp-x5/sf22-approach-proof/attempt-170180-cache-cut-entry-owners.json`,
SHA-256 `c1686f895159a6265d6907c82fa44399fd9e552d5b4b5657baa2dcf9d917fa36`.
Detached result `.git/proofs/20261010T003615-sf22-cache-cut-entry-owners-52476.json`.
