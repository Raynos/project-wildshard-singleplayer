# Motion3: near-stationary first-release check

2026-10-18. Same V57 mesh and motion3 pose `2936bdd`. This is additional diagnostic evidence, not a new animation score.

**Finding:** the own-body release accent is visible with much less camera-perspective change. At source F411 (overlay 14.077 seconds), the crown/torso is higher relative to the feet; by F421 (14.461) it settles while the front feet remain around the same image row. F439 (15.156) is settled. This supports the earlier modest readability-improvement verdict without attributing the entire effect to player retreat. Keep the bounded accent; this evidence does not justify increasing bounce.

All **101 encoded frames F405–505 inclusive**, video PTS 16.20–20.20 seconds, were manually inspected on five consecutively numbered sheets. One exact repeated decoded frame pair is grouped in the map; all source frames are represented. Additional native-size checks: F405, F411, F421 and F439. This is a selected release/recovery and alert segment, not a whole-attack or whole-video manual review.

The initial F405 overlay is 13.789 seconds and still includes the tail end of retreat settling. The runtime camera telemetry restricts the near-stationary claim to overlay **14.0–15.29**, attack clock approximately 0.9–2.1: camera Z range 5.47 mm, Y range below 1 mm and quaternion-component drift below 0.000034. After 14.3 the reported position drift is below 1 mm. Anticipation included a genuine 220 ms backward input beginning 13.5545. Later cycles involve real knockback and are excluded from any static-camera claim.

The first attack runs overlay 13.0777–15.2918, followed by alert through 17.5861. The clip intentionally retains a short pre-release lead-in, and is labelled diagnostic. It is not labelled as an entirely stationary camera shot.

Visible front-fin roots remain covered; no obvious front appendage detachment or face/pouch tear occurs during release and settling. The tail is hidden behind the frontal body, so tail attachment is still visually unverified. Dark floor and disabled shadows prevent a definitive planted-foot, hop-clearance or floor-penetration verdict. The body lift is a screen-space observation, not proof of physical root elevation.

Capture reports roughly 21.53 Hz rendering; video is 25 fps, 390×844, pixel ratio 1 cloud. Post-processing and shadows are disabled. This is not final-appearance or phone-performance acceptance. No hit, death or locomotion cycle is scored here.

## Evidence

- `motion3-stationary-frame-map.json`: exact source frame IDs and decoded RGB hashes.
- `motion3-stationary-review-receipt.json`: original video SHA256 and derived clip count/size/hash.
- `motion3-stationary-telemetry.json`: runtime's authoritative camera/stage telemetry.
- `public/review-evidence/puffer-animation-v57/motion3-stationary-release.mp4`: 101 frames, 4.04 seconds, genuine recording at original timing; no interpolation, speed-up or pose thinning. Only lossy encoding and an explanatory top label are added.
