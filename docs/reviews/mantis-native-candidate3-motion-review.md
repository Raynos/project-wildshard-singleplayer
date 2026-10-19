# Mantis native22 candidate3: independent motion review

2026-10-19. **Not admitted.** Candidate3 repairs the long active-phase pose mismatch and sampled living floor penetration. Final death-to-Retry is now encoded, and the replacement top view is valid. Walking/support and corpse contact still fail the visual admission bar. Static V7 likeness **3.6025/5 stays unchanged**; this is an animation review, not another model-art rating.

## Scope and provenance

Actual cloud Chromium arena, portrait402×874, diagnostic observer camera temporarily applied during rendering and restored afterward. Player placements are diagnostic, not normal first-person play. Product source hash `afc2b790b7e0ad59107c63d6d3953e390f39e56f752a2f142ac05f0c27d90996`. Independently verified every source/native hash in candidate3 admission.json. Native geometry and collider remain unchanged.

Decoded the complete original combat WebM: **1,598 frames,25fps,63.92s**, encoded0–1597 inclusive. Independently inspected every frame in order on34 numbered contact sheets, including repeated frames. Decoded and inspected the separate idle WebM: **457 frames,25fps,18.28s**, encoded0–456 inclusive,10 sheets. No omitted interval. Subject crops(70,290)–(320,580) include substantive observer motion; early frontal startup antennae extend outside the crop. Full-frame checks verify framing and labels. The original videos remain the authoritative full-resolution evidence; retained contact sheets are compressed review receipts, not substitute footage.

Receipts, SHA256 video indexes, extraction scripts, phase analysis and independent geometry reconstruction: `art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate3/independent-review/`.

Combat trace contains386 consecutive render samples4–389. Median wall interval126.1ms, minimum4.1ms, maximum1,025.5ms, mean6.394 rendered samples/s across the trace. Encoded25fps includes repetitions and **does not demonstrate25fps simulation, smoothness, or physical-phone performance**. Video time, performance time and game time have different origins and rates.

## Exact encoded coverage

Zero-based inclusive ranges from burned-in HUD OCR, crosschecked against trace game time (11 numeral misreads corrected in the retained validated map):

- Startup/pre-observer0–108:109frames.
- Approach render4–64:encoded109–361,253frames. Gait wrap intervals22–35 and36–50 occupy205–255 and256–314.
- Complete first strike render65–92:362–465,104frames. Windup362–382; active383–452; recovery/return453–465.
- Complete second strike render93–126:466–579,114frames. Windup466–481; active482–540; recovery541–579.
- Stationary recovery127–143:580–644,65frames.
- Resume144–169:645–802,158frames.
- Reset/subsequent hits170–216:803–977,175frames.
- Kill/collapse/settled corpse217–303:978–1276,299frames.
- Final Retry/new bout304–381:1277–1597,321frames.

These sum to1,598. All intervals were inspected, not merely their endpoints. The render trace is denser than the encoded capture in places; neither contains a continuous-time proof.

## Complete cycles and actual strike state

The first bout contains both complete strike lifecycles, not just selected attractive poses:

- First: render65–71 windup,72–89 active,90–91 recovery,92 idle. Game5.704→8.296s.
- Second: render93–96 windup,97–114 active,115–126 recovery,127 idle. Game8.396→11.633s.
- Following stationary recovery: render127–143; resumed travel/turn begins after144 and continues through169, before diagnostic reset170.
- Approach gait has successive phase wraps at render22,36,51. Wrap-to-wrap intervals22–36 and36–51 bound two complete cycles (crossings lie between neighboring samples). Initial approach stops at65. This is phase-recorded evidence, unlike candidate2's missing gait field.
- Sword hits: render178,187,196,207,217; HP55→43→31→19→7→0. Final hit starts collapse; corpse remains through303; Retry starts304. Another bout then proceeds. Its second strike is not complete in the encoded tail and is not substituted for the complete first-bout evidence.

The sickles now retain their cut pose throughout the long actual active lanes, then return during recovery. This removes candidate2's material false-recovery problem. Anticipation and left/right distinction are visible. However, the animal spends much of each active lane in a nearly held pose while translating, rather than communicating a continuing forceful cut. The limbs remain modest in amplitude; actual threat is clearer than before but still not exceptionally readable.

Independent source comparison confirms `splinterMantisPhase.as` contains the exact original tactical body, with onTick renamed to tactics and a presentation-only observation wrapper added. It reads strikeState and writes phase/clock fields before invoking preserved tactics. Source, movement, damage and strike timing are not tuned to fit the animation. The builder's three Wasm equivalence/observer tests cover tactical command/state equality, phase-clock progression and literal preservation; this review inspected those tests and source, but did not rerun build/test work.

**13 render samples have a phase boundary mismatch** between actual strike state and observed pose phase:65,72,90,92,93,97,115,174,179,341,348,367,368. They are boundary samples associated with10Hz observation. This is real lag, not perfect same-frame synchronization. The cut envelope also ramps over the first0.10s of observed active. Thus some actual-active onset can still show anticipation; cancellation can retain a stale tell briefly. Do not claim frame-exact contact-pose synchronization. No prolonged return-to-guard while actual active continues was found in the complete cycles.

## Walking, hits and support

Walking shows alternating small leg swings, a visibly stable upper-body identity, and no gross joint explosion. It still reads like a suspended body with feet paddling underneath. The floor is dark with no local contact shadow/mark, and observer tracking cancels much of the translation. This does not establish planted stance. Stop and resume are present continuously before the diagnostic reset; turning changes the viewing silhouette substantially.

White hit flashes are unmistakable, with a visible but small body recoil/lift. Flashes hide much of the recoil geometry, so hit detection success is stronger evidence than sophisticated hit animation. Candidate3's added lift resolves the recorded living vertex-floor violations at sampled poses; that does not establish support or continuous collision clearance.

## Independent composed-world contact

Reconstructed all386 captured combat poses and62 idle poses independently in NumPy, using the exact native rigid vertices, absolute bind translations, hierarchical local xyz/quaternion xyzw transforms, and full column-major mesh world matrices. This independently matches the builder's world analyzer:

- Living combat minimum **+0.0006686888m**; zero living samples below the explicit Y900 floor.
- Corpse minimum **−0.1448217846m**;59 dead samples below−5mm.
- Worst collapse sample render219: rear-left knee-weighted geometry,102 vertices below−5mm, rootY900.160443. This occurs even while the root is above its original height, so root sinking alone does not explain every violation.
- Last corpse render303: left-hook minimum **−0.1229238230m**,76 vertices below−5mm, rootY899.859924.
- Isolated idle minimum **+0.0053079739m**, zero sampled below-floor poses.

Collapse visibly lowers and rolls the body, but the final result is a flattened, overlapping form. It does not read as convincingly weight-supported. The composed-world measurements confirm penetration; the dark floor makes exact offending points difficult to judge visually. These are mesh vertex findings, **not** claims about collider penetration. Sampled nonpenetration is not an all-time guarantee or proof of planted feet. Corpse contact remains rejected.

## Idle is an isolated pose diagnostic

The separate video explicitly says “POSE DIAGNOSTIC ONLY” and “simulation held.” It advances a copied authored pose context by wall clock on the loaded native geometry. The62 samples span poseTime0.0033→7.3377s, more than two periods of2π/1.8≈3.490659s. Full cycle windows are0.0033→3.493959 and3.493959→6.984617, bracketed by trace render0→31 and30→60 respectively. Encoded108 begins the diagnostic;221 first crosses the first period;304 first crosses the second period. Thus108–221 and221–304 bracket those cycle spans. However, encoded pose timestamps jump3.732→4.618 and6.363→7.338, among smaller gaps. Every encoded frame was inspected, but several trace poses were never encoded. This is not dense frame-by-frame coverage of every authored phase value. The head/neck and leaf fan gently sway; body breathing is barely perceptible. The silhouette is stable, but the motion is very restrained. The long held encoded tail adds no further cycles.

This supplies standalone **authored idle pose-cycle spans**, closing the absence of any isolated idle evidence while retaining the encoded sampling limitation. It does **not** prove that live AI enters and sustains idle in gameplay. Actual AI stationary recovery and this held-simulation diagnostic are separate evidence.

## Retry and top view

Final death-to-Retry is visibly present: encoded1276 still shows the corpse;1277(51.08s) shows the fresh living Mantis. The remainder includes renewed approach and attacks. Final encoded1597 still shows the fresh bout, render381/game35.11, actual active/2; the trace continues to389 afterward, so do not claim its last eight renders are encoded. Unlike candidate2, the required death→Retry transition itself is covered.

Replacement top-source/top-native captures in candidate3 evidence are usable, showing the complete body, leaf fan, arms and antennae with matching framing. They repair the empty-floor view. Facet/shading differences remain obvious on body and leaves. No static likeness rerating and no inference of animation quality from these stills.

## Applicable five-point axes

| Axis | Rating /5 | Reason |
|---|---:|---|
| Rig articulation / shape continuity |3.0|Stable identity and controlled articulation; folded forms overlap|
| Walking and floor anchoring |2.0|Alternation reads; convincing planted stance/support does not|
| Attack anticipation and combat readability |3.0|Long active pose mismatch repaired; held cut and boundary lag remain|
| Hit reaction readability |3.0|Clear flash, modest recoil partly concealed|
| Death settling / supported contact |2.0|Readable collapse but flattened mass and confirmed world penetration|
| Isolated authored idle cycle |3.0|Complete cycles, stable subtle sway; limited liveliness|
| Final death-to-Retry visual transition |4.0|Clear replacement by fresh living actor and resumed combat|
| Live-AI idle behavior |Not rated|Held-simulation pose diagnostic is not this test|
| Physical-phone performance / human fun |Not rated|Not tested|

Candidate3 is a useful repair, not an admission. Next acceptance work should preserve the tactical timings, improve planted walking/support and death anatomy under the actual rigid world transform, then record fresh complete phase/contact cycles. Physical-phone and human-fun claims remain unset.
