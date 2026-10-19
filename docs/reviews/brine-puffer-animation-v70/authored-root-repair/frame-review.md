# V70 authored-root repair: independent recorded-frame review

Reviewed 2026-10-19 UTC. **The bounded living-hit correction is supported. Corpse contact remains unresolved; this is not all-phase animation acceptance.** Baseline failure evidence remains unchanged in the parent directory.

## Scope and reproducibility

Source checkpoint `a617d3d718e34437104d28842f97d2d713772479`, weighted V70 `b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762`, gait5 wrapper `54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d`. Selected optional `rootFlinch: authored-pose`; authored local recoil remains.

Manually inspected every group on 21 numbered contact sheets representing **492 encoded frames**:
- Normal F970–1310 inclusive:341 frames, PTS38.80–52.40, burned overlay32.585–45.910. Contains all three nonlethal hits, lethal hit, recorded corpse interval and Retry.
- Diagnostic F825–975 inclusive:151 frames, PTS33.00–39.00, burned overlay29.662–35.563. Contains three complete nonlethal hit/recovery episodes, lethal hit, recorded corpse interval and Retry.

Frame indices are zero-based. Original encoded rate25fps; no interpolated observations. Normal334 RGB hash groups and diagnostic151 groups are compression/image differences, not distinct rendered poses. Full native-size endpoints and diagnostic F854 were additionally inspected. Loading and all unlisted frames were excluded; no whole-video claim.

Normal uses unchanged post-processing/shadows,390×844,1× cloud capture. Actual209 rAF samples across the recording; median223.9ms/p95404ms. Diagnostic explicitly disables post-processing/shadows;930 samples, selected hit-window median32.25ms. This is not phone performance evidence. Burned overlays establish timing rather than assuming one fixed video/telemetry offset.

Authoritative HP boundaries: normal33.0508/34.1326/36.1118 seconds, death38.8587, Retry45.3296; diagnostic30.3378/31.2545/31.8713, death32.5384, Retry35.2454. Normal and diagnostic use real inputs and real actor transforms. Stage1 contains tell/burst; stage2 is recovery.

## Actual visual findings

Normal F975–1043 and F1067–1078 retain foretoe silhouettes through bright flashes and recovery, without the previous sideways whole-root collapse. Diagnostic F848–866, F867–884 and F885–904 show repeated hit response and a modest torso pitch/rebound after flash; visible forefin roots stay connected. No new isolated foot hop, gross tear or asymmetric stop-pop is apparent in these hit windows. This supports keeping the living-hit correction. It does not independently prove millimetric floor clearance.

Normal short recoil remains difficult to judge because of low rendered cadence, long repeated-looking flash poses and weapon occlusion. Diagnostic improves temporal readability but changes appearance and still has camera/distance movement. Some outer toes clip the frame during close hits. Rear tail attachment remains hidden. No new gait, turning, terrain, side-view, phone or overall animation score is assigned.

Death still produces a large coherent toss/roll. The corpse moves partly offscreen, then returns to a tilted pose; no obvious part separation appears. Dark floor and perspective cannot clear the reported corpse penetration or establish a physically correct final landing. Numeric world audit independently reports living minima+4mm relative to collider/+34mm visible floor in both captures, but corpse minima−40.78mm/−41.647mm collider (normal/diagnostic), corresponding to−10.78mm/−11.647mm below visible floor. These remain separate unresolved defects. The living repair does not fix them.

## Evidence pins

Normal raw video SHA256 `f6f92e0db51ffa0af66c9206e71be80c0cc6f2977d58890e01970d59c8a44df9`; telemetry `917c3aabed6cea6f00952b7bf01ad45030e89a952e1be19e824749f35b0b267d`.
Diagnostic raw video SHA256 `d33c665bbe7fc57f0507eb6529f8feee35bef17804906137fd9731dc85b7f14c`; telemetry `96449b9be9000b889338b0dd08bb663199efef2756c0d6510ee3057696933a82`.

The two frame maps preserve exact decoded RGB groups. `selected-hit-poses.jpg` uses actual crops and frame labels only. Raw videos are unchanged. Compact clips are pending a free encoding lane; this report does not claim they exist.
