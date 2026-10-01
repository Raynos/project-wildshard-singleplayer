# E357 M — flat sound baselines repaired (sol-m3)

Recorded runtime: `479cc5fb54ec23c4272c35df3d1e5b3d59767c39`. Source-validation candidate: `1c37a5030b08a1d1765ce7c3adabb2d354661d35`. The main tip advanced through desert/frozen-shard concept documents only during this job; its runtime build hash equals 479cc5fb. No deploy-pin edit or push.

## Writer correction

`aggregate` now traverses original object keys, taking medians without interpreting dots inside IDs or phase names. The previous implementation retains 97 for `nd.step.stone` in a [97,93,95] fixture instead of 95. `acceptFields` replaces accepted subtrees, removes absent keys and stale spread entries, and preserves unrelated values. Wildcard acceptance also removes emptied corrupt branches. Accepted pose SSIM still carries its new golden/masks/selfMin. Three regression tests cover numeric dotted IDs, complete replacement/removal, and wildcard deletion with unrelated values preserved; all 24 focused parity tests pass. Harness version remains 2: this fixes the writer, without changing fields or comparison rules.

## Every changed field is classified

The pending file was recovered privately from a4ecfc1e, containing exactly sol-m2's five IDs and its filled expectations. A three-run full accept stopped without publishing any writes because Nalati desktop `combat.sounds.ambient` lost `steppe.marmot` in one run (see below). The authorized fresh-record alternative then passed all ten pairs, using `--record --runs=3 --shards=all --tiers=phone,desktop --jobs=4` with the default fast clock.

Against corrupt 479cc5fb baselines there are eleven red sound fields; every one matches sol-m2's pending field patterns. Against the pre-accept a4ecfc1e baselines, all 92 structural/gameplay reds are also covered by those same patterns (the two boarded Pine image scores are not recomputed by this data-only audit). Image authorization remains B3: full accept scored the old goldens while retaining its masks and thresholds, and no unaccepted image was red. Remaining recorded differences are already-green measured bands or informational record metadata/trace/census fields. The proof JSON records the field coverage. No new pending pattern, quarantine, ambient-info entry, mask or threshold was added.

## Nine rock footsteps — exposed deferred decode, not a source delta

The only `src/` change from c598fab8 to 479cc5fb is `_template/manifest.ts`'s spawn y=1. The only parity change is optional `Step.settleFrames`, used solely by the dedicated template gate; all real STEPS still have the default zero. Nine's player, audio, CuePlayer and finishStage are byte-identical across the two SHAs.

The earlier post-milestone and sol-z1b cross-build captures are **walk+combat+leak**, omitting all pose frames. Nine phone defers its CueBank decode until after the loader: `src/game/session/finish.ts:55–65` schedules a native async decode; `CuePlayer.play` returns false before that bank is installed; `PlayerVoices.footstep` then taps `footstep:rock`. A read-only diagnostic wrapper on the unmodified runtime logs the actual failure and bank delivery. Three HEAD narrow runs fail at frames 14/25/36 with audio ready=true but bank absent; the bank arrives at 44/46/45. c598fab8 reproduces the same three failures, bank arriving at frame39. Older narrow captures saw 3–5 fallbacks. Thus the cross-build 3→4 count reflects async decode completion crossing a footstep boundary, with no Nine runtime change between those commits.

All six new full-profile phone records (accept + record) and the full compare retain exactly `nd.step.stone:93`, no rock fallback. The pose sequence gives native decoding time before the measured walk. Verdict: pre-existing deferred-audio timing exposure in a different capture scenario; do not accept a narrow-profile event map as a full-profile milestone map. Exact event comparison remains enabled.

## Pine and Nalati scheduler membership

Pine phone's six like-for-like full runs (accept + record) all contain `[forest.thrall,pineLife.woodpecker]`; three narrow repeats on the exact same runtime all contain `[]`, as did the prior narrow post-milestone compare. Full versus narrow advances different frames and reaches a different scheduler phase. `forest.thrall` is a Scope.timeout callback (B52); woodpecker's perch countdown is frame-driven in `life/index.ts`, not itself a wall-clock timeout. **Do not call the woodpecker absence a newly proved wall-clock regression.** The six full repeats are stable; the narrow mismatch is a scenario/state-phase effect. Pine desktop also demonstrates wall-clock/scheduler membership variation: the full accept repeats are [], [forest.thrall], [forest.thrall], while the older accept is [forest.thrall], [forest.thrall], []. Existing forest.thrall informational treatment is unchanged. Verdict: B52 / already-classified B2 scheduler-phase capture difference, no source regression or new waiver.

Nalati desktop has one additional repeat-run observation: full accept ambient is [steppe.herd,steppe.marmot], [], [steppe.herd,steppe.marmot]. Fresh record is [steppe.marmot], [steppe.herd,steppe.marmot], [steppe.marmot]. Its original aggregation rule records the intersection [steppe.marmot]; the fresh full compare passes. `steppe.herd` remains in the pre-existing ambient-info list. No required scheduler was removed from the final recorded full-profile set. This is reported explicitly; the failed accept was not bypassed.

## Record, compare and template proof

- Fresh three-run record: all four real shards, both tiers, plus the template's first m5 phone/desktop bootstrap; all ten pairs green.
- Full compare of the validation candidate and its newly committed baselines: all ten pairs green, **zero red/pending exceptions**, `--retry=0`. Every boot.errors=[] and every class-D check passes.
- Template's separate HEAD gate: touch moved 8.500821728m, yaw -1.106547096, dodge/use true; hut stuck0, custom whip kills grey blob within limits, unload independent census exact and disposalErrors=[]. This is additional to the standard bootstrap (whose generic combat scenarios are n/a).
- All 24 recorded real-shard pose images inspected in `/private/tmp/e357-sol-m3/poses-contact.jpg`.
- Clean-export Vercel gate: CSS, generation/check, app/API/scripts types, whole oxlint, ratchet, liveness, full Vitest, Vite build all pass. Browser contexts and previews closed; browser lane0 afterward.

Evidence: `progress/normalization/m3-baseline-repair.json`; complete raw captures/logs under `/private/tmp/e357-sol-m3/{accept,record,compare,narrow-repeat,parent-narrow,template-gate}`. Existing [sol-m2 classification](m-classification.md) remains the authority for the milestone's intended and board changes. No runtime source fix or design guess was made here.
