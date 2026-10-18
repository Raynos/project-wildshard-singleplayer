# V57 motion2: independent recorded-frame review

Date: 2026-10-18, 20:42 UTC. Status: animation is visibly present; motion quality remains provisional. Visual model likeness stays at the prior 3.87/5; this review adds no animation score.

## Scope and reproducibility

Actual browser recording: `page@8f962476bf502c3178b5bb21ba6f2788.webm`, 390×844, 59.2 seconds, 25 encoded frames/s, 1,480 frames. Capture used real movement, a downward LOOK drag, touch attacks and retreat. No posed animation frames were generated.

Decoded all 1,480 frames and computed RGB SHA256 hashes. Manually inspected every consecutive frame represented in these inclusive zero-based ranges, in numbered contact sheets, with additional native-resolution checks:

| Frames | Video time | Count | Coverage |
|---|---|---:|---|
| 312–407 | 12.48–16.28 s | 96 | A complete alternating locomotion cycle, including telemetry capture t=8.285–10.269 |
| 480–817 | 19.20–32.68 s | 338 | Complete first attack and recovery, complete alert episode, next attack entry |
| 1010–1479 | 40.40–59.16 s | 470 | Hit responses, lethal hit, toss, squash/roll and final corpse settling |

Total manually covered: **904 encoded frames**, not the entire video. Intro/loading, earlier approach, intervening second attack and other gaps were excluded. The extraction produced 1,469 exact unique RGB images; codec differences make that number unsuitable as a rendered-pose count. Contact sheets 13–16, 20–33 and 42–61 are in `tmp/puffer-motion2-visible-review/`; the full index is `frame-map.json` there. A compact machine-readable inspection receipt and selected actual-frame storyboard accompany this report. Storyboard frames are illustrative; the review ranges above were inspected consecutively.

Contact sheets retained the enemy and surrounding floor/UI, with roughly 200-pixel-wide enemy images in close sequences. Native 390×844 frames were additionally checked for attachment/occlusion. Distant pursuit is lower-resolution evidence even when enlarged. No subpixel contact claim is justified.

## Phase alignment

Video PTS is different from the onscreen capture timer. Use the recorded timer and authoritative telemetry, rather than subtracting a presumed constant offset.

- Locomotion: capture t=8.285–10.269, left-fin extreme → right-fin extreme → left-fin extreme, actor speed 0.7.
- First attack: stage 1 begins t=15.693; stage 2 begins t=20.794. Swell, release and return are visible in the inspected window.
- Alert: t=20.794–26.209, then next stage 1 at 26.448. This complete alert episode is shorter than one pure idle sinusoid. A full stationary breath/tail period from about20.233 to26.448 crosses recovery/alert/next-attack boundaries. **A full isolated idle-state loop is not established by this recording.** Tail is mostly hidden frontally.
- Hits: authoritative HP falls 45→33 at36.145, →21 at37.274, →9 at39.476, →0/alive=false at40.930. The review assesses the actual flash/recoil images, not HP as animation proof.
- Death: alive/deathT define it; retained attack-stage memory does not. Root rises to about900.707, then returns to899.940 during settling. Existing rigid-ragdoll throw combines with the added local bone squash and roll.

## Findings and priorities

1. **Performance is the strongest visible continuity limitation.** The telemetry median sample gap is about0.223 seconds, roughly4.5 Hz. The recording contains held poses followed by conspicuous jumps. First attack consumes about5.1 wall seconds for2.1 authored simulation seconds under timestep clamping. This recording proves changing poses, but cannot certify normal-speed smooth animation or a phone's actual performance.
2. **Locomotion exists but still reads as sliding/paddling.** Alternating fore-fin tilt is visible through the complete selected cycle; body and feet remain together at this viewing scale. The forward root travel is much more prominent than the small foot stroke. There is no convincing planted-foot support interval. Camera movement and sparse cadence prevent a precise world-space foot-slip measurement. Improve gait/contact readability, then record side/three-quarter motion at normal cadence.
3. **Attack shape change is present but the action is understated.** Pouch swelling and return can be followed; no obvious detached pouch/fin part appears in the selected cycle. Weapon and controls obscure the lower central body and portions of the feet at closer distance. The release is read more strongly through screen damage/camera movement than a distinct full-body attack silhouette. A clearer anticipatory brace and release pose would improve readability without merely increasing scale.
4. **Hit feedback is legible, but flash obscures deformation.** The white flash, directional recoil/turn and return are clear. At the observed low cadence, the flash holds for multiple encoded frames and hides much of the recoil. No obvious mesh explosion or detached appendage was seen. Reduce visual masking only after checking normal-rate playback; this capture stretches time.
5. **Death has a complete visible ending.** The lethal flash is followed by an upward toss, changing body proportions, a tilt and a stable squashed corpse. The sequence does not show a repeated full spin or endlessly floating root. The final pose remains stable through frame1479. The combination feels buoyant and prolonged at this cadence; it is not automatically a geometry bug. Floor penetration and millimetre contact are unresolved in the dark floor/limited view. Local bone-floor sampling is not proof of world-ragdoll contact. Rear fin roots and tail attachment remain partly hidden.

No obvious large part separation was found in the inspected front-facing ranges. This is a limited observation, not all-angle animation acceptance. Next decisive evidence is a normal-cadence capture with a static side/three-quarter view, a full isolated idle loop and feet visible throughout movement and landing.
