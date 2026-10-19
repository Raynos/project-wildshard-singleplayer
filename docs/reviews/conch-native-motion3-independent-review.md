# Conch motion3: independent complete-cycle review

Verdict: usable as a clearly labeled WIP playable on this captured host. Reject polished-animation, planted/no-sliding, collider-tuning and arena-ready promotion. Motion3 removes the previous 15cm corpse hover and supplies working guard/counter, defeat, reward and Retry evidence on the retained-dead/subject-fixed host. Remaining weak telegraphs and sliding/recoil are material WIP limitations. This is not a static likeness rescore, physical-phone benchmark or human-fun judgment.

## Scope and integrity

Read AGENTS.md, docs/process/GIT.md, the 06:12 UTC driftwood-enemies STATE and the prior motion2 event-order1 review. Independently inspected every cell of all 50 allframes sheets, encoded frames E0–2356 inclusive, including loading/duplicates, every complete and interrupted combat cycle, collapse, corpse hold, player defeat and Retry. Sheets show the 322×360 creature crop reduced to 161×180 tiles; they are not full-HUD frames. Inspected original portrait corpse/reward and player-defeat stills for HUD context. Fine feet/face detail remains limited by this presentation.

Source closure SHA256 bb2493b4797134096c931dc6a56ce64b3cdcaaaebcc4730b628473944e04c06c and capture closure 09d743c25b27923dfd6c109443c80f711925ddbd46ce29aaabaa57b3d99a3f2c match. All 14 source and 69 capture entries and the three source evidence inputs match their hashes. Capture checkpoint is a9dfb2632368842b18b4ffc75a2fcc3ee4530132, source descriptor motion3-build1 with updated retained-dead/subject host. Hash closure does not independently prove every unlisted host source.

## Complete-cycle observations

E means encoded video frame, R means engine render frame. They are separate domains; no exact E↔R mapping is invented. Phase strings are harness activity labels, not gameplay state. Authority is the strike snapshot, actor state, actual poseInput and recorded matrices.

- First complete thrust: R81–86 windup, R87 active, R88–97 recovery, R98 idle, R99–116 stage-2 rest. Player100→86. E301–320 shows slight preparation; E321–327 shows the red damage pulse/rapier extension, followed by return through E347. The shell barely participates; small weapon movement is readable but weak. R121–126 is another windup interrupted by Retry at R127, not a completed attack.
- Failed first guard trial is retained: before/after observations show enemy60→48 and player100→72. R139–145 thrust is interrupted by the unguarded hit at R146; another R176–186 thrust starts and reaches recovery before Retry R187. Do not present this trial as successful guard/counter. Its white flash is E490–499.
- Successful guarded counter: thrust windup R188–195, enemy57 at R196, stage-4 pending R197–200, counter windup R201–205, active R206–207, recovery R208–217, idle R218 and stage-2 rest R219–237. Before/after enemy60→57 and player100→84. E629–637 white flash leads into the widened counter preparation E650–663, red pulse E664–670 and recovery through E687. The guard/counter silhouette remains too close to the ordinary thrust for a confident animation-only distinction. R249–252 later windup is cut by Retry R253.
- Sword bout: R261–265 windup, guarded hit/pending R266–270, counter R271–276, recovery R277–278 interrupted by another hit R279. Repeated white flashes at E821–832, E871–877, E902–909, E933–940, E971–974 and E1011–1020 communicate hits more strongly than body recoil. Do not call this second counter a complete uninterrupted recovery.
- Death: actor dies R330, but actual poseInput is still alive/deathT−1 in that render. R331 receives dead/deathT0.125; R332 reaches stage5/deathT0.25; R340–478 are settled. This one-render onset delay is recorded honestly, not erased by using actor state as animation input. Visual collapse begins E1021, folds/rolls through E1044, and settles into the same rigid folded pose through E1337. It is visibly lower and no longer has motion2's conspicuous gap. Some weight/settle nuance is still missing.
- All 149 actor-dead samples R330–478 have idle strike, no further player damage and no revival; player84→100 is regeneration. Reward is three local coins and complete=true. Retry R479 restores enemy60/player100 and zero coins/incomplete reward; E1338 is the restored upright pose.
- Player-defeat bout contains seven complete thrust recoveries (starts R488,526,562,597,634,671,713), followed by final windup R751–759 and active R760 that defeats the player. R761–830 strikes remain idle; enemy60/alive and actual poseInput alive/deathT−1 remain intact. Unlike the older host, player death does not fold or kill Conch. Final Retry R831–837 restores full health and stage0. Final crop is visually similar, so the trace and observations establish the reset. Reentry is recorded after trace export; no transform-level reentry claim.

All 24 harness checks are true, with zero recorded errors. Read underlying guard trials, defeat/Retry/reentry observations, empty local/session storage and unchanged empty state snapshots. These establish scoped automated functionality, not playtest quality or exhaustive correctness.

## Independent weighted geometry and clocks

A separately written NumPy implementation reconstructs every captured vertex through bind, all four bone weights, inverse bind, captured bone-world transforms, captured bind inverse and mesh-world matrix. Verified captured position/skin-index/skin-weight arrays against the pinned original payload under T(0,0,.05) Ry(pi): all7338 vertices exact, 94 vertices have multiple positive weights. No geometry/model edits.

All833 consecutive render samples R5–837: minimum floor clearance2.986063675mm, maximum per-frame minimum4.977697015mm, zero vertices below the strict zero plane and no sample without a vertex within2cm. Living684 samples:3.000–4.978mm. Settled139 corpse samples:3.000mm throughout. Difference from supplied JS minima is at most1.14e−13m. This supports sampled geometric floor proximity only, not collider accuracy or behavior between samples.

No planted/no-sliding acceptance: identical vertices within2cm of the floor in consecutive samples travel up to38.4cm horizontally per100ms during hit knockback (e.g. R196,266,279). Those transforms move feet with the body rather than demonstrating a stance anchor. Knockback motion may be intentional, but proximity cannot prove friction or believable contact. Moving/approach samples also show near-floor vertex displacement. The independent JSON preserves the largest cases and excludes pose-clock resets. It is a movement diagnostic, not a fitted foot-contact classifier.

Video has2357 encoded frames at25fps (94.28s). Trace spans83.0168 wall seconds and68.5591 global game seconds. Median render interval90.95ms, maximum419.1ms. poseInput.t resets with the bout while top-level gameTime continues; strike.clock also resets, and top-level clock is a separate behavior clock. Render/encoded duplicates and capture cadence are not phone performance.

## Applicable five-point ratings

Scale:1 broken/poor,2 clearly unfinished,3 serviceable prototype,4 polished,5 exceptional. Independent judgments of this motion capture only; no average or replacement static score.

- Character readability in motion:3.5/5. Shell/shield and palette hold together; face/weapon action remain small under the dominant shell.
- Guard/thrust/counter telegraphs:2.5/5. Complete mechanics are proven; animation-only distinction and anticipation remain weak.
- Hit reaction/recovery:2.5/5. Flash is strong; recoil is small or rigid, and knockback does not establish foot anchoring.
- Death presentation:3/5. Recognizable collapse and floor-adjacent persistent corpse; rigid final shape and onset lag remain.
- Grounding/weight/contact:3/5. Major clearance defect corrected across living/dead samples, but near-floor horizontal motion and light body response prevent a planted-weight pass.

Keep labeled WIP playable; next polish should target distinct guard/counter anticipation, hit weight and stance/knockback contact. Do not change static likeness acceptance or claim a quality-complete enemy.

## Freeze and preservation

Portable local review: this document plus docs/reviews/conch-motion3-independent-cycles/verify.py, numeric-verification.json and freeze-manifest.json. Large original video, render trace, weighted proof and50 sheets remain unchanged in the existing capture directory for later verified native Site protection. No Git operation, remote backup, Site publish, browser run, build, engine/AI change or model change was performed by this review.
