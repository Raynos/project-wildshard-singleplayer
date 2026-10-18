# Gait5 actual-frame review — 2026-10-18

## Verdict
The gait4 abrupt stop reset is visibly improved. This passes the narrow frontal stop/resume continuity gate, pending normal-rendering functional regression. It is not acceptance of planted walking, hit interruption behavior, side attachment, terrain handling, or phone performance.

## Actual inspection
Manually inspected every encoded frame in three ranges from `page@c5b745555390d235408a9cf930b96bf6.webm`, 25 fps, 390 × 844: walk F335–385 inclusive (51 frames; PTS 13.40–15.40), stop/attack/alert F600–745 (146; 24.00–29.80), resume F945–1025 (81; 37.80–41.00). Total **278 frames**, represented by 14 numbered contact sheets. Additional native-size checks: F623, F624, F625, F627, F630. Intro/loading, other cycles, and later strafes were not manually reviewed. Frame maps retain exact decoded RGB hashes; hash uniqueness does not measure rendered pose cadence.

This is the explicitly labelled post/shadows-disabled, 1× cloud diagnostic. Telemetry reports about 28.53 samples/s during bypass, median gap 33.4 ms, maximum gap 516.4 ms. Encoding at 25 fps does not prove uniform rendering. The source wrapper is 54662e with rig1; the recorded scene remains unaccepted WIP.

## Findings
- F623 overlay 22.638 precedes stop; F624 overlay 22.671 is stopped; F625 22.698, F627 22.766 and F630 22.898 show progressive settling. Unlike gait4 F562–564, the staggered feet do not instantly reset to a neutral pair while the head stays fixed. The native images support the continuity improvement independently of the reported millimetre audit.
- The entire first attack (telemetry overlay 22.6709–24.8858) and subsequent alert through 27.1765 are included. Face, pouch and visible front roots remain coherent; no obvious exaggerated foot hop or open attachment gap appears. F649–654 includes a red player-damage vignette and perspective recoil. The sudden image-size change there must not be attributed solely to enemy body movement.
- Resume (telemetry 36.4484–36.4769 speed 0→0.1953) is enclosed by F945–1025. Alternation grows into walking without the obvious prior start reset. The walk sample contains repeated left/right alternation, but it still reads as shuffling/paddling rather than demonstrably planted steps.
- The close stop frames clip outer toe tips; the weapon obscures the lower central body. Tail/rear attachment is hidden. The floor has inadequate contact cues for a reliable pixel-level slip or penetration verdict. There is no meaningful side/turn proof.
- Enemy HP remains 45 throughout the telemetry. **Enemy hit interruptions were not exercised**, so the rising-flinch reset fix remains visually untested by this recording.

## Evidence
`gait5-{walk,stop,resume}-frame-map.json` records exact ranges. `gait5-stop-continuity.jpg` preserves native-scale crops F623/F624/F630. The genuine compact clip `public/review-evidence/puffer-animation-v57/gait5-stop-attack-alert.mp4` contains all 146 source frames, 5.84 seconds, original timing, with a diagnostic label. No interpolation or speed change. Its receipt includes source and output hashes. Original recording is preserved unchanged.

No animation score or static-model score was changed. Normal-look regression and a real enemy-hit interruption check remain necessary before broader acceptance.
