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
