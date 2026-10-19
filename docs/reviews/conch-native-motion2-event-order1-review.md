# Conch motion2: independent event-order1 review

Verdict: reject animation/contact promotion; retain as labeled work in progress. Actual guard-hit/counter damage, defeat/reward and Retry are supported, but contact and readability remain unfinished. This is the frozen event-order1 host, checkpoint 6fb8b293d415a8f01638dca50e52132164b71034. It excludes subsequent retained-dead/borrowed-subject fixes. No claim of human fun, physical-phone speed, or current-host acceptance.

## Scope and method

Read AGENTS.md, docs/process/GIT.md and the 05:46 UTC driftwood-enemies STATE. Visually inspected every cell in all 43 allframes sheets: encoded frames 0–2028, including loading portions, repeated frames, complete thrust/counter cycles, all hit reactions, collapse, corpse hold, player-defeat sequence and Retry transitions. Creature-region crops are 322×360 source pixels reduced to sheet tiles; small facial/foot detail and HUD are limited. Read observation records and rendering instrumentation. Independently recomputed every rendered sample using a separately written NumPy four-weight homogeneous matrix implementation. Verified captured positions/indices/weights against the pinned native payload with its canonical T(0,0,.05) Ry(pi) transform. All 7338 vertices match exactly; 94 use more than one positive weight.

Closure SHA256 7f9dbe17d972283cb3837b2629a2af9f77be33f9c5b1fdba2bf7ca35c7be82f2 and every listed source/evidence hash match. Review changes no gameplay source, host, Site, Git state, production assets or original evidence.

## What the complete cycles show

Numbers prefixed E are zero-based encoded frame numbers. Numbers prefixed R are engine render frame IDs, not video frame IDs. The exact state-authoritative ranges below come from the uninterrupted R4–737 trace. Full event segments with wall time, game time and resettable strike clock are in numeric-verification.json.

- First complete thrust: R70–76 guarded windup; R77 active; R78–88 recovery; R89 idle and R90–101 stage-2 rest. Game time 5.8607–8.5236 s. Visually, the small arm preparation leads to the rapier-forward pulse and red damage vignette at E296–303, then lowers through E304–319 and rests. The preparation reads weakly at phone crop size; shell dominates the silhouette.
- Guarded-hit counter cycle: guard R115–122; hit/flinch begins R121, stage-4 pending R123–127; counter windup R128–133, active R134, recovery R135–145, idle/rest R146–162. Game time 9.4964–13.3693 s. Encoded white hit flash E413–416, pose returns E417–430, larger counter preparation E431–440, red damage pulse E441–447, recovery E448–460. Player HP100→84 and enemy HP60→57 corroborate the guarded hit/counter. Guard/counter differ in telemetry, but their silhouettes are too similar to read confidently without that evidence.
- Next thrust R172–180 is interrupted by Retry R181; do not call it a complete recovery. Sword-bout guard R185–189, pending counter R190–196, counter windup R197–202, active R203; a new hit interrupts it at R204. Do not describe this second counter as a fully recovered cycle.
- Actual repeated sword hits: clearly visible encoded flashes E607–613, E645–652, E675–680, E716–720, E756–760, E804–806. Recoil exists but is small and dominated by white tint; feet do not convincingly anchor the torso.
- Enemy death begins R261 (game22.1096 s, wall30.6143 s); all R261–410 are dead/strike-idle. Visual collapse starts E807, rolls/folds through E823, and the settled folded pose persists E824–1123. All 141 settled samples are rigidly suspended 15.0365cm over the floor. This is a strong visual/contact defect even though it never clips through the floor.
- Corpse Retry: R411 is alive again, full HP. Visually E1124 is the first restored upright pose after E1123 corpse. Observation confirms enemy60, player100, zero coins/incomplete reward.
- Second-bout thrusts repeat to real player defeat. The last active samples are R701–702; R703 idle, then R704–731 stage5 while the enemy remains alive at60HP and player0HP. This is evidence of the old host's borrowed death subject problem, not a passing result for the later fix. A defeated attack leaves enemy60HP. Final Retry R732–737 returns stage0 and full player/enemy HP; the final crop looks almost identical, so the trace/observation establishes this transition rather than an invented visible frame boundary. Reentry is separately recorded after trace export; no instrumented transform claim for reentry.

## Independent contact and clock findings

All734 renders: minimum clearance 0.0027652523m; zero vertices below zero, including a stricter zero-plane check than the original −5mm tolerance. Living584 samples: minimum clearance varies 0.0027652523–0.0873128504m; 546 have no vertex within2cm of floor. Settled corpse141 samples: minimum clearance is exactly0.1503653421m; none within2cm. Independent result differs from the original JS minima by at most1.14e−13m. These are sampled geometric proximity results, not collider validation or a guarantee between samples.

Raw noPostDeathStrike=false is retained honestly. The harness compared exact pre/post HP, but regeneration raises it. Independent inspection of all150 dead renders finds HP84→100, no decreases, and only idle strikes. This supports no observed post-death damage during the retained hold; it does not prove the later retained-body fix.

Video is2029 encoded frames at25fps (81.16s). Render trace has734 consecutive samples spanning70.8623 wall seconds and59.9341 game seconds; median render interval88.9ms, maximum511.6ms. Strike clock is another quantity and resets on Retry. Encoded repeated frames are not additional simulation observations; phase labels are harness activity labels and can include a Retry. No one-to-one encoded/render mapping is supplied, so no exact clock alignment is fabricated. Cloud diagnostic capture cadence is not phone performance.

## Scoped five-point ratings

These are independent review judgments on this actual capture, not a new static-likeness gate or an averaged completion score. Scale:1 broken/poor,2 clearly unfinished,3 serviceable prototype,4 polished,5 exceptional.

- Character readability in motion:3.5/5. Strong orange/cream shell and shield silhouette; small face/rapier actions are crowded by it.
- Guard/thrust/counter telegraph readability:2.5/5. Actions occur, but the small windup and similar counter silhouette need stronger separation. Trace is clearer than animation.
- Hit reaction and recovery quality:2.5/5. White flash is clear; bodily recoil and return lack planted weight.
- Death presentation:2/5. Collapse is recognisable, then holds a rigid floating pose.
- Grounding/weight/contact:1.5/5. No penetration, but pervasive living gaps and15cm corpse hover prevent grounded motion.

No overall average, arena-ready claim, human-fun rating, or physical-phone rating. Static likeness milestone remains the existing separate independent3.57 result; this review does not supersede it.

## Next acceptance work

Correct grounded motion/corpse placement, then capture complete cycles on the updated retained-dead/subject-fixed host and repeat both visual and weighted checks. Keep exact older failure evidence. Preserve the large original video, trace and43 sheets in their existing temporary directory until native Site protection is verified. Portable review sources are this document, verify.py, canonical-verify.py and numeric-verification.json; freeze-manifest.json hashes them. This is a local review freeze only; no remote backup is claimed.
