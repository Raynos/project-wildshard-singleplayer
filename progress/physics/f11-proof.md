# E357 F11 proof — 2026-10-01

Implementation: `bfdb1d53` (colliders), `bcffe7e9` (host/capture retirement),
`8f711032` (compatibility), `8d3a45a0` (box tags/census). Runtime comparison:
pre-F11 `c44c616a` against corrected `8f711032`; ANGLE Metal, phone tier.

| Shard | Parent colliders | Corrected colliders | Walk legs stuck |
|---|---:|---:|---:|
| Driftwood Isle | 2195 | 2195 | 0 / 8 |
| Pine Hollow | 2419 | 2419 | 0 / 7 |
| Nalati Grasslands | 2772 | 2772 | 0 / 12 |
| Nine Dragon Stack | 525 | 525 | 0 / 19 |

The full trails comparison has 38 legs. Driftwood repeats the parent's ten
[E354](../../docs/tasks/asks/E354.md) stuck points, with per-leg counts
`[0,0,2,5,1,1,1,0]`. Pine's 14 and Nalati's 16 legs have no stuck points;
Nine has no trails. The lead clarified the F11 bar as no regression from the parent.

Pine porch repetitions: parent `[0,0,0]`, initial port `[0,1,1]`, correction
`[0,0,0]`. The NPC groups turn toward the player; the legacy collision boxes
remained axis aligned. Translate-only following preserves that behavior.
Puzzle state refresh also changes box heights; descriptor replacement now rebuilds
the Rapier shape without adding colliders.

All four narrow phone walk/combat/leak checks are green, including weather
cleanup on Pine and Nalati. The first three use `bcffe7e9`; corrected Pine uses
`8f711032`. All unload counters return to their baseline. Cove surfaces stay wood
to preserve the bridge's footsteps. Existing dynamic barrels stay dynamic.

One paired Nine hover-escape peak differed by 0.38 m. Three repetitions showed
parent peaks `[128.03,128.0,128.38]` and corrected peaks `[128.0,127.99,128.38]`:
the maximum is identical, and every repetition has zero stuck/out-of-bounds frames.

Clean `8d3a45a0` export: Vercel-tree gate passes CSS, generation, application/API
typechecks, whole oxlint, ratchet, Vitest and Vite build. Full `pnpm test` also
passes bake/source checks and 158 test files / 1239 cases. Rapier is 0.20.0.

[f11-proof.json](f11-proof.json) holds compact results and raw SHA-256 hashes.
The adjacent `.json.gz` files preserve full traces/probes; decompress before
using `scripts/physics-baseline.mjs --compare`. The walk script's `--leg` and
`--repeat` flags select unchanged authored routes for reproduction.

Full parity remains the lead's batch per decision 104. NPC following introduces
one Driftwood and three Pine kinematic bodies while keeping collider totals exact;
this representation change is recorded for structural parity review. No baseline,
pending board, quarantine or tolerance was widened. Builder did not push or move
the production pin.
