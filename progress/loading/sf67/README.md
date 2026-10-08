# SF67 / E461 — loading fixes, desktop and Safari reports

**The loading target remains open.** All 16 matched entries reached playable. The
template warm visit fell from 4.967 s to 3.138 s; cold fell from 5.794 s to 5.380 s.
Its longest cold main-thread task fell from 755 ms to 305 ms. Other cold timings
were mixed, and Driftwood / Nalati still contain large synchronous world builders.
These desktop rows are single observations per arm and cache state, not statistical speedup claims.

The [matched Simulator Safari report](safari/README.md) adds all seven shards, two
AB/BA pairs each, cold + same-tab warm: 56/56 valid entries. Its medians/ranges and
shared-machine load are reported separately. Template Safari cold median is
6.856 → 5.429 s, warm 3.558 → 3.263 s; n=2 and all capture loads >30.
The 3.138 s figure above remains Chromium only, never a physical-phone claim.

The strict consumer artifacts are [before/report.json](before/report.json) and
[after/report.json](after/report.json), both `loading-benchmark/1`, validated by
`scripts/admin-data/validate.mjs`. Every measured renderer-main task **over 50 ms**
through playable is included, with its top sampled app owner. Full sampled stacks,
progress, resources, failures and checksums are in [evidence/manifest.json](evidence/manifest.json).

## Ruler

- Before: `19e647272191b6e823bd6dd7caf06b71780052f4`; served build `19e6472-muzwdqcv`.
- After: `6f4490e833fabf317d81578508983f96d118ca26`; served build `6f4490e-muzwx1d6`.
- Desktop Chromium / Metal, muted, iPhone 16 Pro portrait emulation (402 × 874,
  DPR 3), CPU throttled 4×. This is **not Safari, Simulator or physical-phone evidence**.
- Real bare title → SHARD SELECT → card dot → ENTER WORLD. The template uses its
  compiled-product button and Developer on; the other three use their ordinary
  public selection, Developer off. No grid entry or synthetic direct shard boot.
- Cold means a fresh context with empty HTTP / service-worker / IndexedDB caches;
  warm repeats in that context with normal caches enabled. Each pair launches a
  fresh browser. Arms alternate by shard: before/after, after/before, before/after,
  after/before. One browser at a time through `browser-lane.sh`, 19:20–19:24 UTC.
- HTTP and disk version were checked against each immutable preview; the preview
  listeners and exports were separately verified. No Simulator was acquired.
- Time-to-playable starts at the host timestamp immediately before clicking Enter
  and ends when Loading has faded and the game probe exists. Per-document trace
  clocks are joined using the injected origin mark. Navigation overhead is included
  in the reports and table (the console runner prints it separately).
- Phase spans describe the visible loading step, including awaits; they are not CPU
  attribution. CPU owners are the most frequent first app frame in V8 samples in
  each outer renderer-main task, an attribution estimate rather than exclusive cost.
  Post-play tasks are excluded. Browser observer durations remain separate raw data.

## Matched time to playable

| Shard | Before cold s | After cold s | Before warm s | After warm s | Longest cold task before → after ms |
|---|---:|---:|---:|---:|---:|
| Driftwood | 7.015 | 6.676 | 6.644 | 6.523 | 748 → 733 |
| Nalati | 10.180 | 10.395 | 11.755 | 9.731 | 1190 → 1207 |
| Template | 5.794 | 5.380 | 4.967 | 3.138 | 755 → 305 |
| Pine | 13.597 | 13.909 | 13.658 | 13.551 | 261 → 263 |

The template's first-party admission eliminates the repeated `budget.ts` cost scan
from all after long-task stacks. Its warm admission phases sum to 1.328 s after,
versus 2.794 s before. Cold admission still spends 1.416 s in publication and related
awaited work (not a 1.416 s CPU task). The first visit still verifies assets and
publishes them durably; the build verdict does not skip immutable hashes.

Driftwood Props remains 3.273 s cold after; Nalati Props remains 5.445 s. No single
10 s task was reproduced. Repeated long tasks with a parked progress label were the
audit's explanation for the perceived freeze. The matched after screen now says
“Building the world” while Props runs, even with audio/extras incomplete. A late
review found the Driftwood hybrid wrapper dropped the new progress argument:
`11da76006` forwards it into the counted builder. **That forwarding change is not
included in these timings.** Nalati already forwards its counted Props sink.

## Remaining >100 ms work

| After cold owner (top sampled app frame) | Task ms | Meaning |
|---|---:|---|
| Driftwood `world/islandInstances.ts:206`, `coverTriangles` | 733 | Procedural / island geometry processing |
| Driftwood `engine/physics/Physics.ts:43`, `createCollider` | 515 | Native collider construction |
| Nalati `world/paint.ts:82`, `add` | 1207 | World construction / paint / voxel AO stack |
| Nalati `world/granite.ts:11` | 946 | Procedural outcrop construction |
| Pine `world/homestead.ts:540`, `floorHeightAt` | 263 | Homestead geometry/floor preparation |
| Template `engine/audio/Audio.ts:172`, `graph` | 305 | Audio graph setup |
| Template `engine/world/terrainTileView.ts:61` | 226 | Terrain view preparation |

All tasks, including smaller tasks and full source-mapped sampled stacks, remain in
the artifacts. The after cold/warm counts over 100 ms are Driftwood 14/14, Nalati
12/12, template 5/3, Pine 10/8. The ~100 ms goal is **not met**. Baking code-built
worlds, minimap work, shadow sorting and other audit follow-ups are still open;
this slice does not claim their savings or change their look.

## Landed changes and trust boundary

1. `443f4831b` / correction `fcc79ea28`: ordinary boot fingerprints are lazy;
   explicit pinned harnesses retain eager boot snapshots. No scene retained by an
   unread retired getter. The correction removed an accidentally swept foreign hunk.
2. `165287a41`: real authored builder-unit progress through `slicer`; world-byte
   readiness excludes menu art/music/SFX for the existing loading label. No changed
   geometry, RNG order or yield budget. `11da76006` fixes the hybrid forwarding.
3. `7c4a98e2e` plus `414a98ad7`: first-party build validation/cost receipts, exact
   content-hash durable verdict reuse, bounded cost memoization, and no repeated
   warm immutable puts. The compiled catalogue trusts only build-owned receipts;
   fetched author sidecars are not trust inputs. All assets are still hashed and
   closure/runtime checks remain. Current memory policy is reapplied. Unbundled
   products require full validation before a local receipt is cached.
   `62c426f46` additionally invalidates on parser dependency/lock changes and refuses
   malformed fractional receipt costs; it is after the measured pin.
4. `ab179b6fb`: the GPU allocation journal runs only with Developer or an explicit
   census marker. Turning it off restores native methods and retires journal refs.
   The template intentionally keeps Developer on; no journal saving is claimed there.
5. `6f4490e83`: the first live physics step after loading admits one tick; later
   ordinary bounded catch-up is preserved. Pausing keeps the first-step fence.
6. `34fece188`: exact cartridge file inventories include the emitted `validation.json`.

## Limits and failures

No game exception or load failure occurred in the matched 16 cases. The local Vite
preview does not implement `/api/telemetry`: the scalar records preserve its 404 and
console errors (two records cold, four warm, from title and entry). They are not
reported as zero errors. Earlier invalid template-button/fence trials are retained
separately as rejected harness observations. Initial accepted exploratory batches
are also archived separately; their noisy, non-alternated results are not mixed into
the matched comparison. Full traces are transient scratch because of their size;
the manifest retains input hashes and the committed analysis retains every long task.

Simulator Safari phase measurements, all-seven-shard coverage and repeated
matched cohorts are now in [the Safari receipt](safari/README.md). Safari CPU task
durations/owners and physical-phone loading remain **missing**, not zeros. The
Safari observer is unsupported and Inspector task timestamps are all zero; rAF gaps
are not substituted for CPU durations. Pine's original
audit no-mipmaps P0 predates the fixed runtime used here; Pine is playable in both
arms. Async shader compilation already exists; this slice preserves it and makes no
new compile-speed claim. The before/after range contains other agents' commits, so
the table is not a causal estimate for each individual fix.

## Reproduce

Build each exact pin with `scripts/serve-build.sh --rev` through the build queue.
Run one muted batch through the browser lane:

```sh
scripts/browser-lane.sh --max 15 node scripts/loading-benchmark/matched.mjs \
  --before=http://127.0.0.1:4412 --before-pin=19e647272191b6e823bd6dd7caf06b71780052f4 \
  --after=http://127.0.0.1:4413 --after-pin=6f4490e833fabf317d81578508983f96d118ca26 \
  --out=<scratch>
node scripts/loading-benchmark/analyze.mjs --dir=<scratch>/before --dist=<before-dist> > <scratch>/before-tasks.json
node scripts/loading-benchmark/report.mjs --captures=<scratch>/before --analysis=<scratch>/before-tasks.json \
  --pin=19e647272191b6e823bd6dd7caf06b71780052f4 --output=<report-directory>
```

Repeat the last two commands for after. `capture.mjs` checks the served pin and closes
its browser in `finally`; `report.mjs` refuses mixed-pin captures and validates the
strict consumer schema. The later capture tool also records the existing setup
detail field; the matched captures above predate that additive observation.

## Verification

Clean committed export at `11da76006`: **925 files / 5337 tests passed**, 106.86 s
through the heavy-lane, plus root strict typecheck and scoped typed lint. The subsequent
module-path correction `ea8634804` passed its two focused converter checks, typed lint
and check-paths; clean-export root strict and the moved-module focused check also
passed. The coordinator owns the clean Vercel-tree gate and push. Sixteen
compressed evidence archives passed SHA-256, decoded-length and JSON round-trip checks.
The report converter rejects stale navigation fences, preserves failed runs / missing
owners, excludes post-play tasks and checks the strict 50 ms threshold.

The first gate retry also exposed lint rules that did not apply under progress/.
The receipt commit fixes the entire scripts/loading-benchmark folder under the root
**type-aware** lint configuration, with no disabled rules, and reruns its focused
converter checks. These tool-only edits preserve the matched measurements.
