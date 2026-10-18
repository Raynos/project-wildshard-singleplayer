# Brine Puffer motion3: complete-cycle frame review

2026-10-18. Independent review of actual recording; V57 mesh, motion3 pose source `2936bdd`, capture source `18de33a5b1aa4c4aa267f849a53257ace9908b9e`. No visual-model or animation score is assigned.

## Verdict first

The brace-to-release change is a useful, modest readability improvement over motion2: visible torso/pouch and front-fin pose changes make the action easier to follow. The full front-foot view is a stronger attachment check. No obvious front-fin detachment or face/pouch tearing appears in the reviewed cycles. This is a qualitative comparison: different downward look and real approach/retreat change projected size substantially. It is not a controlled amplitude comparison.

Keep this bounded motion change for further gameplay testing. Do not globally speed it up or increase its vertical bounce on this evidence. The main unresolved checks are side/rear tail attachment and contact-aware locomotion; this frontal attack recording cannot settle those. No hit or death cycle is reviewed here.

## Exact visual scope

Every encoded frame in these inclusive, zero-based ranges was visually inspected on numbered contact sheets, with additional native-resolution diagnostic frames 938, 952, 965, 993 and 1050 inspected separately:

| Recording mode | Source frames | Count | Video PTS | Contents |
| --- | --- | --- | --- | --- |
| Normal appearance | 360–650 | 291 | 14.40–26.00 seconds | Lead-in, entire first attack, recovery and alert episode |
| Post/shadows-off diagnostic | 900–1075 | 176 | 36.00–43.00 seconds | Lead-in, entire warm attack, recovery and alert episode, subsequent approach |

Total: **467 consecutive selected frames**. This is not a whole-video review. Loading and the remainder of the recording are excluded. The 25 fps video contains held poses, particularly in the normal section. Decoded RGB hashes identify exact image differences, not unique rendered poses. Maps retain a SHA256 per decoded frame/group.

Contact sheets used all cells in normal sheets 00–12 and diagnostic sheets 00–07. Crops retained the enemy, front feet, floor and controls; each cell was 260 pixels wide. Enemy width varies with real distance. Small seams and hidden surfaces remain below reliable resolution.

Authoritative telemetry gives normal attack overlay time 13.2109–18.1204 seconds, with alert ending 23.2634; diagnostic attack 35.2138–37.3709, with alert ending 39.6873. Overlay time is not video PTS: actual overlays were checked against the selected bounds, rather than treating telemetry as encoded timestamps. For example, diagnostic source F938 shows overlay 35.233, F965 shows 36.333, F993 shows 37.490, and F1050 shows 39.789.

## What the frames show

- Normal F432–489 shows the enlarged/held preparation; F490–503 contains the damage cue and stepped pose recovery. Repeated held poses dominate the presentation. It remains a poor smoothness test.
- Diagnostic F938–965 shows continuous changes across the prepared torso and feet, followed by settling through F972–993. The attack's own pose is easier to follow than the earlier motion2 diagnostic, where the damage/camera cue dominated. Approach/retreat remains a major visual confound.
- Front fin roots stay visually covered by the body throughout the inspected changes. The front toes are visible for much more of this recording, although extreme outer tips approach or cross the image edges at the closest distance. Do not call every foot fully visible in every frame.
- No abrupt detached appendage or major facial separation is visible. Ordinary facet boundaries should not be mistaken for opened seams.
- The rear tail is obscured by the frontal body. **Tail attachment is unverified visually.** Numeric mesh/transform sweeps are supplementary evidence only.
- The dark floor and disabled diagnostic shadows provide weak contact cues. Apparent vertical movement can also result from camera retreat and perspective. No definitive hop, floor penetration or planted-foot verdict follows.
- Alert breathing is subtle and connected. A complete alert-state episode is included; this does not assert a mathematically complete isolated idle sine loop.

## Timing and appearance caveats

The runtime capture reports normal rendering at 4.72 Hz and bypass rendering at 28.44 Hz. Normal attack takes about 4.91 wall seconds; diagnostic attack takes about 2.16 wall seconds. Engine delta-time clamping explains the wall/simulation slowdown. Encoding at 25 fps does not restore missing poses. Both use the 390×844, pixel-ratio-1 cloud buffer; this is not a phone or 2× rendering performance claim.

The diagnostic disables post-processing and shadows. Its brighter/raw appearance is not a visual-model acceptance reference. Both clips retain original timing, with no generated/interpolated frames, speed-up or selective pose thinning. The original recording remains unaltered. Burned-in labels distinguish the clips.

## Evidence

- `motion3-normal-frame-map.json`, `motion3-fast-frame-map.json`: exact selected source frames and decoded RGB hashes.
- `motion3-review-receipt.json`: original SHA256, exact clip counts, sizes and hashes.
- `public/review-evidence/puffer-animation-v57/motion3-normal-attack-alert.mp4`: 291 frames, 11.64 seconds.
- `public/review-evidence/puffer-animation-v57/motion3-diagnostic-attack-alert.mp4`: 176 frames, 7.04 seconds.

The compact clips are derived genuine recordings. Compression and a top-of-screen evidence label are the only presentation changes.
