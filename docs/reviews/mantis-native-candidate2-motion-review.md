# Mantis native22 candidate2: independent motion review

2026-10-19. **Not admitted.** Real combat works in the supplied diagnostic, but animation/combat readability and contact remain below the acceptance bar. Static V7 likeness **3.6025/5 remains unchanged**; this is not another model-art vote.

## Exact scope and provenance

- Product source hash `8e4ce9548975175ff813e556976def02c8a15505ce155177a0892a53459303f6`. Candidate2 admission.json pins the unchanged native payload `dff33ee217c763612d0ce3fad9c3627ea4414454e074fc092e1c86775ba192d2`, metadata and motion sources. Original candidate1 stays rejected: no enemy damage and floor-penetrating death.
- Reviewed actual cloud Chromium arena output, portrait 402×874. The observer temporarily changes only render camera position, following enemy at offset (6,4,8), looking at body Y+1.6, then restores it. Diagnostic player placements are logged. It is not ordinary first-person play or a physical iPhone result.
- Original completed WebM SHA256 `b028bfaffef731af2795bd6c434349bead80dc368e6d73ddbbe32a0063cb9ae0`; public `public/review-evidence/mantis-v7-candidate2/live-observer.mp4` SHA256 `cdbf9e38d9b1e791a6f66e279913ff3a2b1ce6eafa283832426e8e3e6cbb82e7`. Both have **1,177 encoded frames, 25 fps, 47.08 seconds**. This review decoded the original WebM, not a resampled selection.
- Every encoded frame **0–1176 inclusive** was visually inspected in order on 33 numbered, 36-frame contact sheets. No skipped interval. Subject crops are (70,290)–(310,550); startup close view antennae can extend outside this crop. Full-frame checks at encoded 350,450,700,980,1176 verify labels and framing. All substantive observer motion fits the crop. Receipts/sheets: `art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate2/independent-review/`.
- Repeated encoded frames are repeated visual evidence, not extra simulation samples. Trace has **247 consecutive render samples, game frames5–251**, 22 local position/quaternion joint transforms plus full 16-element mesh world matrix each. Game clock .2556→22.2361, performance clock3.8027→45.5973 seconds. Video zero differs from performance zero; do not convert one directly into another.

## Exact encoded ranges

HUD OCR corroborated the visually inspected transitions (raw OCR retained, not treated as a quality judgment). Zero-based inclusive ranges:

- Approach render5–64: encoded124–356, **233 frames**, 4.96–14.24s.
- First complete attack stage render65–91: encoded357–461, **105 frames**, 14.28–18.44s.
- Second complete attack stage render92–117: encoded462–621, **160 frames**, 18.48–24.84s.
- Recovery render118–133: encoded622–698, **77 frames**, 24.88–27.92s.
- Resume/reset render134–151: encoded699–788, **90 frames**, 27.96–31.52s.
- Subsequent attack/hits render152–196: encoded789–979, **191 frames**, 31.56–39.16s.
- Kill/collapse/settled corpse render197–243: encoded980–1176, **197 frames**, 39.20–47.04s.
- Final Retry render244–251: **zero encoded frames identified**.

All233+105+160+77+90+191+197=1,053 observer frames, plus startup/pre-observer0–123, total1,177 were inspected. Render trace cadence is irregular: median134.1ms, minimum7.1ms, maximum1,607.5ms, mean rate5.886 render samples/s over its observed span. Encoded25fps therefore cannot establish smooth25fps simulation or phone performance. All candidate2 admission file hashes independently matched at review time.

## Coverage and findings

### Walking, stopping, resuming

Trace0–59 (render5–64) covers continuous approach, game .2556–5.4028, with root (-.00020,900,-6.87735)→(-.00423,900,-1.18174). Render65 begins attack stop. The feet alternate, but travel reads as little paddling motions under a largely suspended body. Ground plane is dark and lacks local contact marks. No planted-foot pass: a translating camera and pose oscillation are not evidence of stance locking. Many gait oscillations are visible; trace does not record gait phase explicitly, so a mathematically bounded exact phase cycle cannot be certified from these fields alone.

Recovery trace113–128 (render118–133), game10.7287–12.2287, holds root (3.86391,900,6.11262). Trace129–146 (render134–151) resumes approach/turning, then includes the diagnostic Retry/reset. Visually, body orientation changes sharply during the resume and the next fresh bout; this is not a clean uninterrupted stop/resume quality test. The first complete walk-to-attack transition is present.

### Both attacks and recovery

First complete stage: trace60–86, render65–91, game5.4330–8.0287; second: trace87–112, render92–117, game8.1287–10.6287. Followed by recovery and return to stage0. Full encoded footage covering these intervals was inspected, including anticipation, arm movement, return to guard and stationary recovery.

The opposing hook arms visibly articulate and identity survives. But the slashing motion is modest, and each arm returns to guard while the real strike stage continues. This is consequential: an apparently recovered animal can still occupy its attack movement/contact phase. Numeric damage success cannot make that readable.

Source corroboration: `mantisGroundedClips.ts` assumes the first envelope ends1.37s and second2.05s; recorded stage clocks extend to2.6s for each. `src/engine/ai/strikes.ts` update explicitly runs a moving lane until distance completion or length/speed+1.2 timeout, rather than declared active .5s. The source explains the mismatch; actual active/contact phase is not logged in this candidate2 trace, so this review does not invent exact damage-active encoded boundaries. Repair requires pose synchronization to actual strike phases, followed by fresh visual evidence, not combat timing changes to fit the clip.

### Hits, death and Retry

Normal sword inputs reduce HP55→43→31→19→7→0 at trace152/161/172/182/192. Bright white hit flashes are very clear; the underlying recoil is modest and partly obscured by those flashes. Example first visible flash encoded803; each subsequent flash and return to colored guard was inspected. Kill begins encoded980 (39.20s), burned render197/game17.85, matching trace192 alive=false. Collapse then visibly lowers and curls the legs; it becomes a compact sideways body instead of candidate1's failed plunge. Sheets27–32 show every collapse/settled frame through the end.

**Ground contact still unaccepted.** Actual corpse world translation ends at (-1.44442,899.859924,-8.67737), below live root900 by .140076. Dark background and overlapping folded limbs prevent confident identification of every contact point. No gross mesh explosion is visible, but this is not proof of no penetration or correct support. The 41-sample local envelope's zero-below-floor result excludes this full world transform. Source inspection identifies the generic rigid ragdoll path as relevant; the precise cause of displacement is not established here. Do not describe it as proven fade sinking; practice loot does not call fadeOut.

**Independent composed-geometry cross-check (04:42 UTC):** after visual review, independently reconstructed all247 captured poses in NumPy using native rigid vertices, absolute bind translations, hierarchical local quaternion matrices and the captured world matrix. This matches the builder’s separate analyzer exactly: **28 render samples below floor by more than5mm**, overall minimum **−0.1239444506m**, living minimum **−0.0716187004m**. Living violations occur during hit reactions at render158–160,167–169,178–181,188–189 (rear-right knee-weighted part). Dead violations include198–199 and230–243; deepest is left hook at render231. Receipt: independent-review/world-contact-crosscheck.json. Thus composed geometry does penetrate the explicit arena plane; this is no longer merely an unresolved numerical suspicion. The dark visual floor made exact contact hard to read, which is why the visual and geometric findings are stated separately. No claim of collider penetration is inferred from vertex penetration.

**Visual Retry gap:** final encoded1176 (47.04s) still displays render243/game21.63 and the settled corpse with “Collected 3 local practice coins.” Trace244–251 shows a successful fresh living state, but those final Retry renders are absent from the encoded recording. Thus state-level Retry passed; visual final Retry is unreviewed. A previous reset is visible during the earlier bout, not a substitute for the requested final death→Retry sequence.

**Idle gap:** no isolated complete idle cycle. The obvious stationary recovery lasts only1.5 game seconds; authored idle period is 2π/1.8≈3.491 seconds. Walking/attack footage includes idle channel overlays but does not establish a complete standalone idle cycle.

## Native appearance

All nine submitted source/native pair files were inspected. Front, back, left, right, front-left, front-right, rear-left and rear-right are usable. Silhouette, eye masks, hooked arms, leaf fan and segmented brown body survive conversion. Facet/shading patches change visibly on right and three-quarter body/wing views; the known437 source-normal deviations and material-side policy difference remain caveats.

**Top pair is invalid evidence:** both panels in top-source-native.jpg show empty blue floor. Eight usable views, not nine. No replacement still has been reviewed here. These are frozen rest comparisons, never motion evidence.

## Applicable five-point axes

These are candid candidate2 quality assessments, not a weighted static likeness rerating and not an overall admission score.

| Axis | Rating /5 | Reason |
|---|---:|---|
| Native identity retention in usable rest views | 4.0 | Recognizable and close conversion, facet differences and missing valid top remain |
| Rig articulation / shape continuity | 3.0 | Limbs move without an obvious explosion; modest articulation and overlapping folded forms |
| Walking and floor anchoring | 2.0 | Leg oscillation reads, convincing stance/contact does not |
| Attack anticipation and combat readability | 2.0 | Two arms distinguishable, pose recovers ahead of real strike lifecycle |
| Hit reaction readability | 3.0 | Flash unmistakable, recoil subtle and partly hidden |
| Death settling / supported contact | 2.5 | Clear low curled collapse, composed-world hook penetration confirmed |
| Complete idle cycle | Not rated | Missing required standalone cycle |
| Final death-to-Retry visual transition | Not rated | State trace passes, encoded tail does not show it |
| Physical-phone performance / human fun | Not rated | Not tested |

Independent gameplay receipts report real enemy damage, real sword damage, death/three bout-local coins and Retry; separate player-defeat/Retry and empty global/shard/browser storage checks passed. They are useful functional evidence, not a motion-quality pass. Earlier long-run browser crash is preserved; cause remains unproven.

## Next acceptance evidence

Preserve candidate2 as the failed visual admission. Next candidate should use real strike phases, demonstrate a complete standalone idle, a continuous walk/stop/resume, both windup/active/recovery cycles, visible hits and complete collapse/settle/final Retry with an encoded tail long enough to show it. Record game-frame mapping and actual phase. Evaluate composed world-space contact, not only local poses. Repair the invalid top view. Keep phone and fun claims unset.
