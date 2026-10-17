# M3 ruler basis integrity

The legacy jump was a bug, not a deliberate recount. Restore and pin the
pre-jump basis at `1258254a368566f52dac078512cf96095356a174`.
No shard source or gameplay changes belong to this repair.

## Exact causes

| Commit | Shard | Legacy before | Legacy after | Cause |
| --- | --- | ---: | ---: | --- |
| `a888b0ac1` | Pine Hollow | 21,305 | 21,401 | Frozen compatibility additions: `species/deerRows.ts` +42, `species/elkRows.ts` +52, `models/creatures.ts` +2. |
| `e45fe0e4d` | Driftwood | 17,167 | 17,618 | Retired `data/movers.ts` was removed from the live producer catalogue, removing its projected frozen exclusion: +451. |
| `e45fe0e4d` | Sky Reach (`far-reach`) | 6,779 | 9,645 | The same obsolete mover-output removal reclassified 2,866 frozen lines. |

These are the only commits in `1258254a3..be6a061ea` changing the ruler,
legacy inventory, or source-output catalogue relevant to the denominator.
The total legacy increase is **3,413**. Because Sky's target is 10% and
Pine/Driftwood's is 20%, weighted `mustGo` rises **3,017.0**:
`0.9 * 2866 + 0.8 * (451 + 96)`.

`672481538` changes mirror/output preparation, not these counts.
Generator moves `c280fbe49`, `e8cf0599d`, and `8b280a432` do not change the
frozen denominator. Retiring live producer paths was appropriate; undoing
that cleanup would hide the coupling instead of fixing it.

## Stable baseline

`lint/legacy-line-basis.json` records each eligible file's nonblank physical
TypeScript lines after parser comment removal, plus exact historical
producer exclusions. It is a measurement of the checkpoint's sealed legacy
folders, not a new generation catalogue. Declaration files, tests and AS
remain outside the TS denominator. It records the checkpoint revision and
each frozen shard's original source revision.

| Shard | Pinned legacy lines |
| --- | ---: |
| Driftwood | 17,167 |
| Pine Hollow | 21,305 |
| Nalati | 28,370 |
| Sky Reach | 6,779 |
| Signal Dunes | 4,122 |
| Nine Dragon Stack | 21,111 |

Both the ruler and generated AS build-policy numbers read this same basis.
Producer catalogue edits and compatibility-only frozen fixes cannot change
it. A missing basis or mismatched frozen source revision refuses. A future
intentional rebase must explicitly replace this policy and explain its
effect; it must never appear as custom lines removed.

Reproduce every entry directly from historical Git objects without a repo
copy: `node progress/shard-platform/ruler-basis-2026-10-17/verify.mjs`.

## Product inventory integrity

The source progress ruler used to treat a missing `out/<slug>/shard.json`
as an empty section list. That can remove a real second data-selected host
user and charge another shard for unchanged platform code. It cannot
explain the legacy jump: legacy counting did not read `out/` at all.

The source census now requires every shard's section inventory, verifies
its section bytes, and refuses missing/partial inventories. The normal
`node scripts/shard-platform.mjs --json` path generates inputs and builds
all products before measuring; `--no-build` and direct source census calls
must prepare the same complete inventory. No missing product grants a
zero-user fallback. Regression coverage removes a real second-user
product, requires refusal, restores it, and requires the identical count.

## Measurements and checks

Historical comparisons run in the shared build mirror's `check` slot,
never a copied repository:

```sh
node scripts/build-mirror.mjs run <sha> --slot check -- bash -c \
  'pnpm gen >/dev/null 2>&1; node scripts/shard-platform.mjs --json'
```

At `1258254a3`, the full ruler measures **31,729 / 80,173.3 = 39.5755%**.
The weighted total is fractional; earlier state text rounded it to 80,173.

The full `e45fe0e4d^` run measures 32,700 / 80,250.1 = 40.7476%.
Pine's extra 96 lines are already present there, while Sky and Driftwood
retain their original counts. Mirror-only denominator probes immediately
before/after `a888b0ac1` and after `e45fe0e4d` reproduce every value in the
cause table, independently of whether any `out/` product exists.

The full `be6a061ea` run exactly reproduces the reported inflation:
**36,219 / 83,190.3 = 43.5375%**. Keeping that same source numerator and
restoring the pinned baseline yields **32,806 / 80,173.3 = 40.9189%**.
The real net custom reduction since `1258254a3` is **1,077** lines:
Driftwood -211, Pine -867, Nalati +1, and the other three unchanged.
The +1 Nalati growth accounts for the difference from the rough 1,078
figure in the coordinator's initial report.

| Shard at `be6a061ea` | Custom lines | Corrected legacy | Inflated legacy |
| --- | ---: | ---: | ---: |
| Driftwood | 6,804 | 17,167 | 17,618 |
| Pine Hollow | 11,063 | 21,305 | 21,401 |
| Nalati | 28,361 | 28,370 | 28,370 |
| Sky Reach | 1,790 | 6,779 | 9,645 |
| Signal Dunes | 1,809 | 4,122 | 4,122 |
| Nine Dragon Stack | 16,221 | 21,111 | 21,111 |

The correction removes **2.6187 percentage points** of false M3 progress
at that endpoint. It deletes no custom shard lines itself.

The repaired code was checked in mirror tree
`fa21b96faae1861242f8325ad19cd286462ba2c1`, based on source commit
`427cf3ecd4cbed7862271f813261c16f82fc5ab0`. Later source reductions in
that snapshot put M3 at **33,029 / 80,173.3 = 41.1970%** (Driftwood
6,709; Pine 10,935; other four custom counts as above). Two consecutive
reads, first with a full generated product build and then `--no-build`,
returned identical per-shard M3 values and the same weighted baseline.

Validation on that exact tree: root and layer types, typed lint, all ten
shardfile products, and 35 focused tests (including all 17 shard-headless
cases) passed. The historical Git-object verifier also passed. No browser
or look proof is needed for this tooling-only correction.
