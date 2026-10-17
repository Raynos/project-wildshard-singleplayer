# Milestone performance — 2026-10-17

**Floor FAIL; grid incomplete; production boot not cleared.** Desktop
standing passes all seven shards. Simulator Driftwood standing and
Sky/Nalati travel exceed the frame-time bar. Pine asset admission blocks
the remaining grid journey. This measurement lane changes no game code.

Pinned `origin/main` at dispatch: `4fa329e26f8a1454c8891778d719c4d383ad169f`.
Later landings on shared `main` are outside this proof.
Build `4fa329e-mvbzp0xe`. One stock DEVSERVER preview, built by
`serve-build.sh --rev <pin>` in the shared `check` mirror; uncommitted
lane work is excluded. Harness files
match the pin. Muted, Developer on, live clocks, render scale 2×,
120-frame samples, 2-second settling, no profiler or GL observer.
Desktop: Chromium/Metal, 1440×900. Simulator: portrait iPhone 17 Pro
Safari, phone tier, shipped 30 fps cap, through browser/sim lanes.
Host: Apple M5 Max, 128 GiB memory, macOS 26.7.1; Node 24.18.1.
No visual or game-code changes.

Primary sampling ran under the coordinator's BOTH-surface CPU hold and
owned `.git/quiet`, after draining the push lock and existing push jobs:
desktop 06:02:40–06:10:52Z, Simulator 06:10:52–06:22:20Z. One-minute load
at cohort boundaries was 5.70 → 4.44 → 4.00 → 4.28 → 4.03.

Gate: rounded median ≥60/30 fps, p95 ≤17.5/35 ms, every observed frame
≤100/200 ms (desktop/Simulator), valid content CPU ownership.
Simulator results describe Mac-backed Safari, not physical-iPhone fps.
Each table cell uses the worst-p95 pose's median fps and p95, then the
maximum frame across that shard's measured poses; windows are not pooled.

| Shard | Desktop fps / p95 / max ms | Simulator fps / p95 / max ms |
| --- | ---: | ---: |
| Pine | 59.88 / 16.7 / 16.8 PASS | 30.30 / 34 / 37 PASS |
| Driftwood | 59.88 / 16.8 / 16.8 PASS | 30.30 / 45 / 50 **FAIL** |
| Nalati | 59.88 / 16.8 / 16.8 PASS | 30.30 / 34 / 34 PASS |
| Nine Dragon | 59.88 / 16.8 / 16.8 PASS | 30.30 / 34 / 34 PASS |
| Sky | 59.88 / 16.7 / 16.8 PASS | 30.30 / 35 / 36 PASS |
| Signal | 59.88 / 16.8 / 16.8 PASS | 30.30 / 34 / 35 PASS |
| Template | 59.88 / 16.8 / 16.8 PASS | 30.30 / 34 / 34 PASS |

All fourteen standalone cases complete; zero page errors, skipped frames
or context losses. Driftwood's failing pose is spawn; beach/pier pass.

Comparison: [16 October follow-up](../milestone-2026-10-16-follow-up/README.md),
`4fa84dbe9`: desktop standing remains within the floor; Driftwood Safari
p95 45 ms matches the prior 44/45 ms failure. Pine/Sky/Signal standing
remain within the floor. Nalati/Nine/Template were last included in the
[13 October seven-shard milestone](../../frame-floor/milestone-2026-10-13/README.md)
and still pass. Historical Safari Debug saves were not isolated until
`0132d7935`; current runs clear those overrides before every page.

## Grid travel

The full milestone route was attempted once per surface. The table shows
worst p95 and maximum frame over each route's travel/drive/interior rows;
all medians were 59.88 fps desktop and 30.30 fps Simulator.

| Route | Desktop p95 / max ms | Simulator p95 / max ms |
| --- | ---: | ---: |
| Template outward | 16.8 / 83.4 PASS | 34 / 127 PASS |
| Template return | 16.8 / 33.3 PASS | 35 / 92 PASS |
| Nine Dragon | 16.8 / 33.3 PASS | 35 / 121 PASS |
| Sky | 16.8 / 83.3 PASS | 46 / 159 **FAIL** |
| Nalati | 16.8 / 50 PASS | 44 / 93 **FAIL** |
| Pine | admission refused | admission refused |
| Signal / Driftwood | not reached | not reached |

Pine refused admission on both surfaces:
`[pine-hollow] the King's baked king-lantern-frame is not loaded`.
The route timed out before entry, near `(0, 0.5, 298.4)`, current/inside
null. This is an asset-admission failure, not a physics stuck count.
The grid matrix is **incomplete**, not a performance clearance. Neither
Pine nor the later Signal/Driftwood travel rows are claimed passing.
Zero JavaScript page errors; the admission error is retained separately.

Sky Safari p95 46 ms is close to the prior 47/48 ms failures. Nalati
travel worsened from 34/35 to 44 ms; whole-drive p95 36 ms matches the
prior second-pass 36 ms. Nine improved from prior travel 47/48 ms and a
415 ms drive spike to 35/121 ms in this run; this is not causal attribution.

Pine's lifecycle regression is narrowed to `6f83b6547..7bc1c2ca8`
(the latter commit's exact parent/commit pair), owner: the Opus Pine W2a
King-kit port. A source-level replay uses each revision's untouched preload
function and the real pinned ModelLibrary: preload, retire a borrowed
geometry, preload again. Parent: two loads, geometry present; `7bc1c2ca8`:
one load, geometry absent. Its fulfilled outer `kitLoading` promise hides
the library's disposal invalidation. This identifies the cache regression;
it is not an FPS bisection or a historical full-browser clearance.

The previous source `4fa84dbe9` could not regenerate: its isolated
generation closure omits
`src/shards/driftwood-isle/data/trailsideBake.json`. No modified
historical build is credited.

Safari cove controls ran ABBA at exact parent `a5e53cc7d` (A) and original
port `b08b8ffa9` (B), each a fresh Simulator session. Only the identical
spawn is compared below (approximately `(0, 1.21, -194)`, yaw π); other
poses selected by the harness varied. All medians were 30.30 fps; all
four cases completed with zero page errors and valid CPU ownership.
**Load caveat:** quiet ran 06:54:29–06:59:09Z, but the start snapshot
still contains sp-x7's product build (PID 6136, under `measure.sh after`)
and a starting preview. Push jobs had drained; those jobs had not.
Load started at 8.53; immediately after the batch it was 18.52 (5-minute
22.77). These controls are load-confounded, not clean causal evidence.

| Order | Spawn p95 / max ms | Game work p95 ms | Spawn verdict |
| --- | ---: | ---: | --- |
| A1 parent | 36 / 66 | 11 | FAIL |
| B1 port | 38 / 49 | 23 | FAIL |
| B2 port | 37 / 47 | 30 | FAIL |
| A2 parent | 34 / 44 | 10 | PASS |

Measured work is higher in both port controls; B2 also misses at
wreck/pier (p95 44/41 ms). A1 is already marginally over the gate, so
this does not establish the first-ever failing commit. `b08b8ffa9` is a
historical prototype, not an ancestor of the measured pin. Its mainline
replay `98753efbc` is the likely cove-cost contributor (original owner
sp-o225, replay owner sp-o231, both Opus); the later kit graph ports
`538eef095` and `dd994628e` are additional inspection targets, not
independently bisected causes. Mainline standing changed from passing
`fea49ae28` to failing `4fa84dbe9`; current 45 ms retains that failure.

Sky's miss predates this milestone, including failing old-pin `c66b5b324`
controls. The earlier `c66b5b324..fea49ae28` investigation identified
`fd1b0a9a4` (props), `b7dd70203` (dressing), and `3ed995b80` (physics),
owned by the Opus Sky lane, as candidates for its additional cost.
Current 46 ms is within the follow-up's 47/48 ms failures. There is no
known passing travel endpoint here, so a first-bad Sky commit remains
unidentified; these older candidates are not newly proven culprits.

Nalati's independent filtered road-entry repeat also misses: median
30.30 fps, travel p95/max 45/90 ms, drive 37/105 ms, interior 34/37 ms;
zero page errors, valid CPU ownership, complete. This takes a different
approach/residency history from the full journey and shares the loaded
window above. It confirms another observed miss, not an isolated code
regression. The new-worsening interval is `4fa84dbe9..4fa329e26`;
the Opus Nalati look ports `60b2e883b` (grass) and `9cfdf3e46` (storm)
are inspection candidates, not identified causes. The blocked historical
build prevents a matched old-pin FPS bisection. Exact first-bad FPS
commits remain unresolved for Driftwood, Sky and Nalati.

## Boot and physics

Boot is **partial**, not production-cleared. On the pinned DEVSERVER
preview, public Driftwood/Pine/Nalati standalone boot 3/3 and the separate
Developer group 8/8 pass, including grid home/rings and the Signal road
crossing; zero faults/reports. The all-case run's public Nine policy
assertion was invalid for DEVSERVER: that mode intentionally permits
experimental entry. It is excluded, not called a game regression.

A production build of the same source pin could not regenerate:
`ERR_MODULE_NOT_FOUND .../driftwood-isle/data/npcScenes.generated.json`
in an isolated generation closure. The warm DEVSERVER build had succeeded.
Public Nine policy therefore remains unmeasured; no game code or generator
catalogue was changed to force a green result.

Canonical physics walk **PASS** on the same pinned preview, using
`node scripts/physics-baseline.mjs --no-build --mode=walk --url=<url>`:
75 legs, zero stuck, zero walk errors, zero boundary-escape frames. Run time
06:26:38–06:50:10Z; muted iPhone 16 Pro browser through browser-lane.

| Canonical route | Legs | Stuck |
| --- | ---: | ---: |
| Pine | 7 | 0 |
| Driftwood | 8 | 0 |
| Nalati | 12 | 0 |
| Nine Dragon | 19 | 0 |
| Sky | 10 | 0 |
| Signal | 7 | 0 |
| Blender-template | 12 | 0 |

The canonical script walks Blender-template, not primary `_template`;
`_template` has no authored route in this script and is not claimed walked.

## Reproduction and bounds

Run `scripts/serve-build.sh --rev <pin> --devserver` from owned scratch.
Reuse that URL with `node scripts/frame-floor.mjs --rev=<pin>
--serve-base=<url> --devserver --gl-observer=off --surface=desktop
--shards=pine-hollow,driftwood-isle,nalati-grasslands,nine-dragon-stack,far-reach,sunscar-dunes,_template
--scratch-dir=<owned scratch> --output-dir=<owned scratch>`.
Repeat with `--surface=sim`; grid uses
`--shards=grid --grid-scenario=milestone`. The CLI owns its
browser/Simulator lanes; Simulator also takes an outer browser lane.
These finite standing/travel windows cannot prove every gameplay moment.
Raw traces are discarded after summarizing; this receipt retains the
measured numbers. Managed command logs remain under `.git/proofs/`.
