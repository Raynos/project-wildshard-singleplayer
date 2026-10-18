# V70 gait5 actual-frame review

2026-10-18. Scoped review of the smaller V70 mesh using the existing gait5 wrapper. **Promotion remains on hold pending reconciliation/correction of world-space hit contact.** Same animation source does not establish new-mesh safety. No phone-performance, terrain, turning, planted-gait, fun or final visual acceptance claim is made.

## Evidence and inspected scope

Capture source checkpoint 207c95b5; original native source SHA256 3d0606971754f7788e899fe31214748fd38f43b38b363f2d2b291be588de48dc; weighted mesh b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762; gait5 wrapper 54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d.

Normal recording SHA256: 6c975937476c07b317d3426068433e2862b4076dfb3aeda1587145d98cef99c8. Diagnostic recording SHA256: 64ded1b1739479ac2c80f1b68d5d11e46776ec3021b783f405d10a84bb9a0025. Both are genuine 390×844, 1× cloud captures with real inputs. Diagnostic explicitly disables post-processing and shadows; it is not normal appearance evidence.

Manually inspected every frame represented in 22 numbered contact sheets, with selected native-size checks: **493 encoded frames total**, at 25 fps:

- Diagnostic walk F450–510 inclusive: 61 frames, PTS18.00–20.40. Contains a full variable-speed gait phase cycle, authoritative phase wraps at overlay16.1386 and17.6026. This is not a constant-speed planting test.
- Diagnostic transition F610–765: 156 frames, PTS24.40–30.60, visually checked overlay endpoints22.067–28.188. Includes stop/charge at22.5314, release within stage1, recovery stage2 from24.7317, reset27.016, brief resume27.1252 and next stop27.4371. Stage1 contains tell and burst; stage2 is recovery. Do not label all stage2 frames as burst.
- Normal combat F925–1200: 276 frames, PTS37.00–48.00. Begins at burned overlay32.235 and includes all three nonlethal hits, lethal hit, recorded corpse motion and Retry. Hit HP samples33.3525/34.4338/36.5555, death37.7327, fresh Retry sample43.7259. This covers the recorded death interval, not proof of a completely settled final pose.

Maps preserve every source frame through exact RGB hash groups. There are61/156/268 groups respectively; compression changes mean these counts are not independent poses. Loading/intro and other unlisted video ranges were not manually reviewed. Normal cadence:211 rAF samples over47.5156s, median220.8ms, p95427.1ms, approximately4.5Hz. Diagnostic:1452 total samples,1413 diagnostic samples, median33.1ms/p9555.3ms. Encoded25fps does not repair slow normal simulation/render cadence. No interpolation or speed changes were used.

## Findings

The diagnostic frontal walk remains paddling rather than a convincingly planted gait. Stop and brief resume do not show the earlier gait4 asymmetric-to-neutral foot snap. Visible forefin roots remain attached through the selected charge/recovery cycle, without an obvious new crack or isolated foot hop. Body swell/release remains readable but modest. Player damage/knockback around F647–651 visibly changes perspective, so that displacement cannot be attributed wholly to the creature. Outer toe extrema approach or cross the frame edge in close diagnostic views; the sword masks part of the lower center. Tail and rear attachments remain hidden. No side or tail-motion clearance is claimed.

Normal hits produce repeated bright flashes and whole-body tilt, with the same low-cadence limitations seen in V57 gait5 evidence. No gross mesh tearing is apparent, but flash and weapon occlusion prevent strong short-recoil quality judgments. **Native-size normal F1036 reads overlay36.817 and shows the screen-left toe silhouette flattened/partly lost during whole-body tilt.** This is compatible with the separately reported contact failure; dark floor/flash do not establish the penetration depth visually or clear it.

The native-export audit independently reports exact Three.js/packed-Float32 reconstruction of finR138.979mm below collider top900 and108.979mm below visible floor899.97 at overlay36.8172. Applying the same captured transforms to V57 rig1 gives identical per-frame floor clearance across211 samples. This establishes an inherited engine root-flinch interaction rather than a demonstrated V70 mesh-specific regression. It does not make the contact error acceptable. Preserve the existing candidate hold until root decides the fix and its actual-frame validation.

Death produces coherent whole-body toss/roll and a visible defeated/reward state. The recorded corpse continues changing orientation before Retry; do not claim exact landing contact or fully settled rest from this framing. Functional reward/Retry/storage checks are separate from motion quality.

## Compact evidence

- `normal-fullbody-f925.webp`: lossless actual full viewport, normal post/shadows on, F925/PTS37.000/burned overlay32.235. Full body and both front feet before hit flash; stage2 recovery rather than a posed static render.197,730 bytes, below250KB preview cap.
- `normal-hit-contact-board.jpg`: labelled F1029/F1036/F1041 crops,125,782 bytes, below250KB. Cropping/labels only; no semantic image changes.
- Three frame maps and `clip-receipt.json` contain exact ranges/hashes.
- `public/review-evidence/puffer-animation-v70/diagnostic-stop-attack-recovery.mp4`: F610–765,156frames,6.24s,479,958 bytes.
- `public/review-evidence/puffer-animation-v70/normal-hits-death.mp4`: F925–1198,274frames,10.96s,614,991 bytes. Retry omitted from this clip but included in manual review.

Both clips are under1MB, retain original25fps timing, and have explicit normal/diagnostic labels. Exact counts/durations were probed and first encoded frames visually checked. Raw recordings remain unchanged. These are scoped WIP evidence, not animation acceptance or a new numerical quality rating.
