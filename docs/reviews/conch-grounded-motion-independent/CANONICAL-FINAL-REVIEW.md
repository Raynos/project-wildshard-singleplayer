# Independent final review: canonical contact continuation

2026-10-20. Reviewed the 22:57 canonical repair freeze, checkpoint manifest SHA-256 `ff58470150c24969dccbde079def29974d32d22e6f5f58d5a1e8ecf891ff699c`. All 25 selected paths matched before the independent run at 22:58. Runtime source remained read-only. This report supplements all earlier reviews and preserves their failed evidence unchanged.

## Result

**29/29 focused independent tests pass. No further blocker was found within this bounded continuation/provenance review.** The final initial-boundary forgery now refuses atomically. This closes the concrete findings of the preceding reviews, not the candidate's broader source, motion or gameplay admission gates.

The combined scratch test contains the author's sixteen current focused tests and thirteen retained independent probes. It checks original off-slab plants, concurrent swings and false payload identity; in-slab unreachable and reachable-but-unpublished plants; impossible swing elapsed; root/joint/frame corruption; and the last previous-tick-zero tie-break forgery. These now refuse without changing the owner snapshot. The historical 25 mm discontinuity remains preserved as evidence of the earlier implementation, not a current passing behavior.

## Canonical repair inspected

Both tick-zero endpoints are compared with canonical initialization using their own detached root transforms. A state with no steps must retain the initial next-foot value. During an active swing, the next-foot value must name the opposite foot and the retained plant must equal the swing start. Each never-stepped foot retains identical plant/start/target frames. These are direct laws of the existing writer, not tuning parameters or gameplay exemptions.

The prior detached FK, ankle/sole, knee branch/orientation, hull clearance, joint-limit and root-publication checks remain. Previous/current comparison uses cloned state and the pure fixed-step helper, not authored animation or an owner clock advance. Validation runs before copying owner state. It admits legitimate pending-before-publish and published-current forms and equal-tick event publication; it does not require pending locals to equal an older publication.

## Positive coverage and retained limitations

- Genuine complete 48-tick sequences at yaw 0 and 0.7, scales 0.8 and 1.3, restore exactly before and after publication, including swing and landing. Repeated real nonlethal hits preserve valid equal-tick continuations.
- Independent nine-case turning, reverse-X, reverse-Z and stop sequences retain exact pending/current snapshots, unchanged actor/contact observations and sampled support. Explicit placement/reset continuation also passes.
- The original and subsequent malformed-continuation probes pass, including a coherent forged previous initial endpoint with adjusted joints that isolates canonical initialization rather than merely failing FK.
- Loader provenance remains tied to owned compressed bytes and the exact emitted dimensions object. Caller Buffer mutation, authored identity fields on detached dimensions and a custom decoder do not forge that provenance in the retained probes.
- Failed/released contact snapshots remain diagnostic-only and explicitly refuse restoration atomically. This is a narrowed supported restore contract, not recovery or support admission.
- The negative-zero spawn probe did not produce a negative-zero contact yaw. It does not establish universal signed-zero bit preservation; no consequential signed-zero defect was demonstrated.

No geometry, source score, root height, collider padding, channel/hull cap or motion parameter was changed by this review. All continuum/predictive-reach, full weapon/additive-impulse envelope, recovery, player/obstacle, animated anatomy, actual corpse/gameplay/lifecycle/persistence, Explorer and physical-phone gates remain open. Positive sampled contact tests are not a universal world-contact proof. No app build, browser, deployment or Git mutation was performed.

## Exact evidence and reproduction

The successful run took 18.15 seconds and ended before the heavy slot was handed to the complete-motion author. It was not rerun after environment reattachment: the retained source and result log were inspected and preserved.

Copy `repair3/review-probes.ts.txt` and `repair3/vitest-config.ts.txt` to `tmp/conch-grounded-canonical-review/review.test.ts` and `tmp/conch-grounded-canonical-review/vitest.config.ts`. Run `./node_modules/.bin/vitest run --config tmp/conch-grounded-canonical-review/vitest.config.ts tmp/conch-grounded-canonical-review/review.test.ts --maxWorkers=1`. `repair3/repro-result.txt` records 29 passed; `repair3/signed-zero.json` records the qualified observation above. The author separately reports 81/81 seven-file regression tests and final strict/lint passes; this review does not claim to have independently rerun those broader gates.
