# Neutral gray v2: independent lighting and recorded-motion review

## Verdict

The gray-v2 arena lighting is a bounded visual improvement over both the original profile and warm v1. It is suitable for scoped admission on the inspected evidence. This does not change the static model likeness rating or establish complete shadow, animation, ground-contact or device-performance acceptance.

## Matched still inspection

All 21 selected actual stills were visually inspected: six fixed angles (000, 060, 120, 180, 240, 300), each with old-profile, neutral-v1 and candidate, plus real-start/right/left. The source set is `v70-neutral-gray-v2-phone`; the public capture closure is `practice-arena-lighting-neutral-gray-v2/` beside this report.

Compared with warm v1, shadowed cream is less yellow/olive and spikes read more neutrally. Compared with the original profile, dark mantle and tail facets read teal instead of navy/purple. Bright cream, eyes and large facet boundaries remain readable. The actual real-right view still has a strongly dark-tan half-face and visible fin stippling. Gray v2 improves hue consistency; it does not eliminate directional lighting contrast or shadow artifacts.

The phone-policy capture is cloud Chromium with an iPhone user agent, Linux platform, device DPR 3, renderer DPR 2, 780×1688 render buffer, one shadow cascade, three normal post passes and no AO. This is not physical-phone or Safari evidence. Shadow normal bias remains 0.05; the separately rejected 0.06 study was not adopted. This review does not extrapolate the phone-policy still result to desktop AO quality.

## Complete selected-frame inspection

The raw 25 fps recording was preserved unchanged. Every encoded frame in the following selected ranges was visually inspected on numbered creature-crop contact sheets. There was no frame interpolation or timing alteration. These are selected ranges, not a whole-video review.

- Strafe: F375–F1325 inclusive, 951 frames, encoded PTS 15.00–53.00 s. Overlay approximately 7.232–45.308 s. F783–F791 are a capture/HUD-size interruption with the creature absent; no model-deformation inference is made from it. F1319–F1325 show the paused old-profile control and are excluded from the real-play verdict. Real input boundaries are D at overlay 8.117, A at 29.320 and Pause at 44.479.
- Combat: F4300–F4775 inclusive, 476 frames, encoded PTS 172.00–191.00 s, overlay approximately 164.558–182.937 s. This includes all three nonfatal hits, fatal hit and the visible toss/return/settling interval. Retry at overlay 184.286 is outside this manual inspection range.
- Total manually inspected: 1,427 encoded frames across 60 numbered sheets. Compression-level RGB differences are not independent rendered-pose counts. Repeated/held poses are conspicuous.

Within overlay 7.232–44.459, the telemetry contains 120 samples, median interval 299.2 ms and p95 621.9 ms. Within 164.558–182.937 it contains 57 samples, median 311.1 ms and p95 629.3 ms. Thus short recoil and temporal smoothness remain weakly evidenced despite the 25 fps encoding.

## Actual motion findings

Real strafing corroborates the matched-still hue gain. Cream turns tan/dark on the shaded side and returns toward cream during the return strafe; teal facets remain identifiable. The residual half-face contrast and fin stippling are still visible. The enemy tracks the player, limiting side and tail-attachment evidence.

The first hit is visible at F4354 / overlay 166.899, second at F4400 / 168.628, third at F4449 / 170.415, and death at F4501 / 172.561. White/pastel hit flashes recover to consistent teal/cream rather than leaving a persistent palette change. No new gross part separation is visible in the inspected range. Flash, held frames, weapon occlusion and close framing mask fine recoil and foot contact, so this is not a new grounding acceptance.

Death toss/roll takes part of the body out of view before its tilted return and partial settling. This does not resolve previously documented corpse-floor penetration. No complete stage-1 opponent attack cycle occurs in these selected real-play sections; no new complete attack-cycle claim is made.

## Source integrity

Raw video SHA256: `e3e29c3379ff79bdbfb4eacfa267f1c5383ec70e8035e2290f9cc28ed65c7218`.

Raw capture JSON SHA256: `6f22c76f6b081e5bc382b88252815bc82ff5e8b607a114db80809b7af93361b7`.

Exact encoded-frame maps are in `brine-puffer-gray-v2-frame-review/`. Raw full-size boards and source video remain preserved separately. A short real-input strafe preview, if supplied, is a timing-preserving excerpt with explicit cloud phone-policy labeling; paused matched controls must not be presented as gameplay.
