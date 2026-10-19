# Candidate5 independent actual-capture review

2026-10-19. **HOLD promotion. Preserve the failed diagnostic and keep candidate4 public.** The bounded diagnostic capture was justified and is complete. It establishes the requested first-observed-active behavior, but does not establish acceptable animation, floor contact, collider behavior, physical-phone performance or production runtime acceptance. No repair or additional capture is required to report this result.

## Identity and integrity

Product `984bfeb67b6fbd80371783923ccfbdff0a942d77ab83b3fcc4ad616a1ac5e962`.
Capture closure SHA256 `dc5797524839191780fa48769fb4e9d3f02f381d4eb7b4dcebde7db2d1f29025`: all 28 files independently hashed with zero mismatches. All provenance original hashes match. Complete 137-file host and 49-file native inventories match before/after and current files. The earlier frozen source review remains unchanged; this report adds actual evidence rather than rewriting its conditional GO.

Original video SHA256 `9620ceec42e73529d96ba8053fcd0ded7cb16ed685b63502706627550e8bb282`, 16,178,130 bytes, 4,066 VP8 frames, 25 fps, 162.64 seconds, 402×874. Native browser emulation and Swiftshader are not physical-phone evidence. The diagnostic oblique camera tracks the actor; logged player placement induces combat and ordinary AI approach/stop/resume. This is not normal uncontrolled player footage.

## Complete visual coverage and limits

Decoded every encoded frame and hashed the complete RGB image. Inspected all 3,218 distinct decoded images in chronological contact sheets; the remaining 848 encoded frames are exact full-pixel duplicates mapped to inspected representatives. All 51 sheets were inspected. Full-resolution HUD/detail inspection additionally covered encoded 368/369, 433/434, 1231/1235/1238/1241, 1693, 3805 and 4065. The frame index and sheet hashes preserve coverage.

This was frame-sequence inspection, not real-time video playback. Contact-sheet crops reduce fine-detail visibility and omit the HUD; full-resolution source frames and trace remain authoritative. The framewise coverage supports transition/pose findings, but is not a claim about subjective smoothness at normal speed. Encoded repeats are not new simulation samples. Compositor trace has 1,355 poses with nonuniform intervals; unsampled continuous contact cannot be certified.

The first two complete windup/active/recovery cycles are present, as are subsequent attacks, real hit flashes, collapse, long corpse tail, Retry, real player defeat, final Retry and reload. Small leg paddles accompany approach, but the upper body is often held while translating. Selected blades visibly cock then switch abruptly into the cut. Active poses remain held for substantial intervals; this does not supply a readable continuous sweeping arc or establish planted gait quality. There is no persistent missing limb. Collapse packs overlapping legs, sickles and wings into a crowded stationary corpse, with no prolonged visible jitter in the settled tail. Bright hit flash and the dark floor obscure fine contact at the failing early-death pose. Visibility cannot override measured penetration.

## Actual onset semantics

Encoded 368 (14.72 s), HUD frame74/game6.51: authoritative active elapsed .050, observed windup clock .600. Encoded369 (14.76 s), HUD75/game6.61: active elapsed .150, observed active clock0; blade is already in full cut. Likewise encoded433/HUD98 remains observed windup despite authoritative active .017, then encoded434/HUD99 has observed active clock0 with active elapsed .117 and the cut present. These are distinct authoritative-versus-observed boundaries, not an active-at-time-zero authoritative claim.

Thus the old observed clock0 tell hold is removed. The existing observation delay remains, and the large pose change has moved to the earlier observed boundary rather than being smoothed away. Both neighboring poses are retained. This narrow timing hypothesis succeeds; broad visual-quality acceptance does not follow. The first recovery has only one compositor sample, limiting detailed recovery judgment.

## Independent geometry failure

`check_contact.py` reconstructs all 1,355 recorded poses independently with NumPy: captured local translations and xyzw quaternions, full parent hierarchy, native absolute bind-position subtraction, all rigid native-part vertices, complete column-major mesh world transform and recorded floor900. This is actual weighted rigid geometry, not bone-endpoint or root-clearance estimation.

Living sampled minimum: +0.0006716942377806845 m. Global/dead sampled minimum: **−0.10222949073886411 m**. Exactly one sampled pose is below floor: trace385/HUD390/game34.1994, stage5, deathT .110375, flinch .615297. Lowest part `leg-1_1_knee`; 98 vertices below floor, 93 below −5 mm. Encoded1235 at49.40 s shows HUD390 under the hit flash. Full pose measurements are retained in `world-contact-independent.json`.

This invalidates fresh-capture floor-clearance acceptance. The earlier counterfactual's positive minimum only describes its historical sampled trajectory. The candidate edit changes active terms that are gated off in stage5; it does not directly change the early-death formula. The current host/lifecycle and trajectory differ from the old candidate4 capture, and there is no paired same-host baseline capture here. Therefore do not label this causally as an onset-induced regression or as a proven host bug. It is a newly observed failure of this candidate's actual captured death trajectory. A separate scoped death/flinch/ground-contact investigation, with identical-input baseline comparison, is the appropriate next implementation scope if root authorizes one.

## Runtime evidence, failures and missing cases

The frozen harness passes **18 of 19**, with `actualPlayerDamage:false` retained. It checks terminal defense health after regeneration, so misses real earlier damage. Independently checked compositor stream shows health90 already at HUD83/game7.3915; coarser report samples first show it at7.4915. Both streams support actual damage, but neither turns the original assertion into a pass. There are no recorded page/fatal errors. The first prebrowser launcher failure is preserved rather than hidden.

Actual sword hit55→43 occurs during active stage1 at HUD297 with flinch1; the active strike persists. Later hits reduce43→31→19→7 and lethal7→0, followed by collapse, corpse, practice-local3-coin reward and no postdeath strike. **No struck windup was captured.** Do not claim windup-interruption coverage or active-strike cancellation. Report and trace corroborate real approach/stop/resume/restop, Retry, real player defeat, blocked defeated attack, final Retry and reload reentry. Empty browser stores and unchanged empty world/shard state are retained; the original observer trace ends before reload destroys its page, while video and postreload snapshots continue.

## Decision

Archive/publish as failed diagnostic evidence with all WIP warnings and the current public candidate4 unchanged. Do not promote candidate5 on the basis of onset timing, test success, earlier scalar replay or tiny positive living clearance. Runtime assertion design, unsampled contact, physical-phone behavior and missing struck-windup coverage remain bounded limitations. The actual early-death penetration and visually abrupt cut are sufficient to withhold acceptance without another capture.
