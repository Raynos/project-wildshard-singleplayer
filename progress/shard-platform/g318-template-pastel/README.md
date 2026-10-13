# Template and Pastel G318 qualification

The two complete author-only products match on Darwin arm64 and Linux x64,
Node 24.18.1, at `5a8118bc6415644042580c0f2b87f390ccdea01d`.
[Linux run 38379719719](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38379719719)
compared all 338 pinned product bytes independently, after eight cold and
forced jobs and deletion of 13 runtime/legacy roots, every output and cache.
The union SHA256 is `a3f02742eea35110700e1aa4e61db95536a2e136dd9c330e9e96ecd6aa8817a3`.

The [per-output decisions](outputs.csv) cover all 332 tracked CPU outputs.
Cold duration is the complete producer time for each of its outputs, a
conservative bound. Every output is below 2 MB, but every job takes less
than 30 seconds on both hosts; G318 therefore selects regeneration/cache.
Curated skin and frozen map inputs remain sources. No shipped bytes change.

Generation qualification alone does not admit removals. Each removal also
needs the registered complete product, unchanged pins, a fresh staged-tree
clean room, the ordinary production build and actual Developer standalone
boots for both `_template` and `pastel-plain`. The hidden products are not
covered by the default public/developer smoke catalogue.

Run `pnpm gen` in the repository before copying `_template`. Retained source
and pinned cache jobs restore its CPU files; the copied project then uses
the ordinary SDK build/validate. The official stale-map gate and asset,
missing-output, hash, admission and whole-product refusals remain active.

The final all-removals candidate `9ebefdc675d1b7501f58fcc4644144ae887b2c68`
passed the ordinary build and all 338 published product hashes on Darwin
and [Linux run 38383767243](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38383767243).
Both actual Developer shardfile entries reached gameplay with zero faults
and fatal errors: Darwin 2.013/1.812 s, Linux 26.849/22.229 s, followed by
ten live frames. Run 38382665930 failed only the prerequisite-restoration
command before building; the corrected rerun restores admitted pinned
component outputs between jobs. No pin, deadline or refusal changed.
The last series commit needs exact-tree requalification when it differs
from this candidate; earlier parent identity is never blanket credit.
