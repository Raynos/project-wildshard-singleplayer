# P4: the ruler measures built output

The canonical ruler now reads verified `out/<slug>/runtime/**/*.ts`.
Each shard closes independently. An unclosed shard prints its raw P0
escape count and the five largest escape files, with **no percentage**.
It never receives zero credit or a source-code fallback.

The first census has four closed native/template products, each with zero
runtime lines and no frozen denominator. The ported shards remain unclosed:

| Shard | Raw runtime escapes | Output custom % |
|---|---:|---|
| Sky | 23 | unclosed |
| Signal | 6 | unclosed |
| Pine | 187 | unclosed |
| Driftwood | 112 | unclosed |
| Nalati | 159 | unclosed |
| Nine | 33 | unclosed |

[census.json](census.json) records the exact candidate and top escape files.
These are closure tasks, not newly measured regressions or claimed cuts.

## Reproduce

```sh
node scripts/build-mirror.mjs run HEAD --slot check3 -- \
  node scripts/shard-platform.mjs --json --check
```

The command prepares official inputs under the heavy build lane, then asks
the P3 writer to copy each closed runtime strictly. Products publish through
the writer's temporary directory and rename. One shard's failed strict copy
is reported as unclosed with its refusal; it cannot block another shard's
completed measure. `--no-build` reads an already built exact tree and still
refuses missing, partial, corrupt or non-standalone copies.

G294 roots are the actual copied runtime files and the defining named hosts
of emitted platform sections. Build-time imports do not supply runtime users.
The report identifies custom-section count/bytes, AssemblyScript lines and
its report-only 10% legacy budget, private binary bytes and one-user SDK build
tools separately. Unclosed shards receive no invented output columns.

Custom-section count and byte ceilings remain in `lint/ratchet.json`.
During the W2 adoption window, a rise needs a newly appended immutable
`{slug, from, to, why}` record in `lint/custom-sections.json`, with both count
and byte pairs matching the actual change. Its initial baseline adopts the
committed ceilings (DW 5 / 39,637 bytes; Pine 13 / 115,310 bytes).
Set `risesCloseAt` to `"W1 spike end"` to seal the window permanently.
Thereafter both ceilings are shrink-only, even with an appended rise.
Pre-commit and the immutable-policy comparison enforce it. Each private
name still requires its plan exit row.

G390 badges are rebased to completed output measures. Generation clears old
source percentages; `--write` republishes badges and component documentation
from the completed output census. Missing badges mean unavailable. Frozen
legacy denominators and historical no-copy baseline policies are unchanged.

Validation: 31 focused behaviours, root types and typed lint pass. The real
per-shard command completed in 77 seconds, including official generation and
strict native/template products. No browser or rendering change is involved.

## G458: outcome progress and grid evidence

The report adds M3 per shard and a line-weighted six-shard total. M3 is
`max(0, frozen legacy - custom) / (frozen legacy * (1 - target))`, with a
10% custom target for Sky/Signal and 20% for the other ported shards.
Closed shards use the output numerator. Unclosed shards show the preceding
source/G294 estimate, explicitly labelled `source`; this supplies no output
percentage or port badge. AssemblyScript remains a separate visibility unit.

Grid readiness lists baked tiles, edge profile, the four midpoint entries,
memory, HUD accent and one-frame looks individually as pass/fail/unknown.
The defining format validator and a byte-bound output receipt supply the
structural evidence and declared memory model; that model is not a physical
phone measurement. Unclosed runtimes have no current verified output, so
their grid evidence stays unknown. A one-frame look witness is not present
in current build receipts and is never inferred from metadata or a boot.

The plan line is `60% * M3 + 40% * M2`, with M2 the six grid-ready verdicts.
When grid evidence is incomplete it reports a lower/upper range, counting
unknown shards only in the upper bound. No unknown criterion is guessed to
pass. The JSON summary carries the cuts, must-go lines, basis and criterion
evidence so an hourly report can distinguish conversion from closure.

The [G458 census](milestones.json) uses candidate
`b89707dc1136354cfef5d585c6ec944bbeb6572b`. All six ported runtimes remain
unclosed. Their **source estimates** give M3 17.41% (13,956 / 80,171.5
must-go lines). Grid-ready is unknown for all six; therefore the provisional
plan range is **10.44–50.44%**, not a completed-grid claim.

| Shard | M3 | Basis | Grid-ready |
|---|---:|---|---|
| Sky | 11.66% | source | unknown |
| Signal | 62.70% | source | unknown |
| Pine | 15.69% | source | unknown |
| Driftwood | 24.68% | source | unknown |
| Nalati | 0.00% | source | unknown |
| Nine | 28.75% | source | unknown |

Validation: six focused behaviours, root types, typed lint and the real
per-shard census pass. This is a reporting change, with no rendering or
simulation changes.
