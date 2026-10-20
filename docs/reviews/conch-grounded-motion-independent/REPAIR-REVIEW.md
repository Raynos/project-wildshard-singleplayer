# Independent repair review: grounded Conch contact

2026-10-20, 22:32 source freeze. This supplements, never replaces, REPORT.md and the original failed probes. The reviewed checkpoint manifest SHA-256 is `91c2ddcb12535be3a269270d847c8694590ae45c46ab0bb5587c42a5d19e0cda`; all 25 selected paths matched before execution. Runtime source remained read-only. No application build, browser, public deployment, physical-device claim or quality/admission promotion.

## Verdict

**The three original narrow refusal probes now pass, but strict continuation remains incomplete.** Full footprint validation and single-swing counting close those particular examples. Three further probes demonstrate that the underlying root/joint publication and temporal-consistency defect remains. Source-provenance repair passes the tested boundaries.

## Repaired and independently verified

- The original +100-metre off-slab restore, two-swing restore and 64-zero source-hash probes all now refuse as expected. The first two preserve owner bytes after refusal. No old witness was edited into a passing claim.
- The exact packed loader now retains owned bytes with `Uint8Array.from`, including its decoder input copy. This also avoids Node Buffer's aliasing `slice` semantics. An independently supplied Buffer can be filled with zeroes after preload and body emission without changing the retained payload identity.
- The private identity map is keyed by the exact loader-emitted dimensions object, not by authored properties. A copied dimensions object with invented `source` and `payloadIdentity` fields cannot opt in. A custom decoder wrapping the standard decoder does not receive provenance and fails contact initialization. The unchanged source checks also reject a mismatched metadata filename hash and a changed declared hash.
- Identity means the compressed payload SHA-256, not the canonical model JSON hash or a promise about every mutable model property. Bones/chains and exact hull JSON are checked separately. This is not a generic sandbox against trusted code importing internal registration helpers.
- All six complete fixture files (model, hull recipe, freeze, metadata, payload and motion declaration) match their full original files byte-for-byte and match recorded hashes. They are not sampled substitutes.
- The independent combined run reports **18 passed / 3 failed** across 21 tests. The 18 include the author's eleven positive focused tests, the three original refusal probes and four added provenance/signed-zero checks. Both existing packed-loader regression files independently pass: **8/8**.

## Remaining must-fix continuation defects

1. **Footprint validity does not establish reach or publication consistency.** Add only 3 metres to X of both contact endpoints' plant/start/target frames in a genuine initialized snapshot. All sole corners remain within the finite Arena slab, but the plants are unreachable from the stored root. Restore still commits this malformed supported state. Expected rejection fails.
2. **Even reachable forged frames break exact endpoint/interior continuity.** The same mutation with only +0.025 metres is reachable and inside the slab, but does not match saved local/published leg transforms. Restore accepts it with no failures. A separate characterization passes by measuring a 0.025000000000000133-metre ankle jump from alpha 0 to alpha 0.000001, with `failures=[]`. Its result is 1 passed / 21 skipped and is preserved as `repair1/consequence-result.txt` with `repair1/discontinuity.json`. This cannot be solved by another world-bound check or a larger tolerance.
3. **Adjacent tick labels do not validate an actual contact transition.** From a genuine mid-swing snapshot after sixteen 0.006-metre forward ticks, increase only current swing elapsed by two, keeping it strictly below swingTicks. Previous state, tick and published pose remain unchanged. Restore accepts an impossible per-tick phase jump. Validate actual release/advance/landing relationships, step ordinals and retained frame identities, rather than only each endpoint's individual value ranges.

Required repair: validate the entire detached continuation against its stored root/joint publications and lawful previous/current interval before mutating owner state. Pure FK checks can verify the supplied state without reconstructing it, advancing time, querying terrain, running authored animation or changing the actor. Account for a legitimate snapshot between advance and publish: local/current state may be newer than the published endpoint. Also preserve equal-tick event publication, which collapses previous/current at a zero-time hit. Do not replace those valid cases with a blanket local-equals-published rule.

## Signed-zero check and limits

A legitimate spawn requested with yaw negative zero did not produce a negative-zero contact yaw in the observed owner state. The saved probe records `initialNegativeZeroYaw=false`; its continuation assertion was therefore not exercised. No consequential signed-zero defect is established by this test. Contact frames still use ordinary JSON numbers, so this is not proof of universal bit-pattern preservation, and the broader exact-continuation claim must remain qualified.

All earlier envelope, continuum, recovery, player/obstacle, animation/anatomy, actual combat/lifecycle/persistence and physical-phone gates remain open. The original source, candidate geometry, source scores, channel/hull caps and negative studies are unchanged. This review does not independently rerun the full author's 68-test regression or final staged lint/type gate; it reruns the focused fixture and directly affected packed-loader tests above.

## Reproduction

`repair1/review-probes.ts.txt` and `repair1/vitest-config.ts.txt` reproduce from `tmp/conch-grounded-repair-review/review.test.ts` and `tmp/conch-grounded-repair-review/vitest.config.ts`. Run `./node_modules/.bin/vitest run --config tmp/conch-grounded-repair-review/vitest.config.ts tmp/conch-grounded-repair-review/review.test.ts --maxWorkers=1`. The three new desired-refusal tests fail on this exact freeze. Logs and the signed-zero observation are preserved under repair1. Repaired versions must keep these negative witnesses and demonstrate rejection atomically.

Publication conversion: sanitized result text has redundant terminal blank lines normalized; substantive diagnostics and original scratch outputs are preserved.
