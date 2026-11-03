# Jungle Ziggurat round 3: climbable stairs (sp-o1, 2026-11-03)

`board.jpg`: the eight plot goldens, GOLDEN 2026-11-03 (`87d997316d`, the accepted round 2) against NOW (`9c82257231`).

Why: sp-x6's walk on `87d997316d` stuck at the stair's foot. The far model is the plot's collider, and its stair ramp rose
35 m over 21.5 m, which is 58°. The player climbs at most 40° (`PLAYER_CAPSULE`), so nobody could reach the top.
`ziggurat.py` now has lower tiers (5.0 m), steps them in further (4.4 m) and pushes the foot out to 52.35 m, so every
ramp climbs at 36.5°. One long stair would have moved the model's box 10 m off the plaza, because `stand()` centres the
box, so there is now a stair up each face. The layout is 54 m (was 66), the base stays 40 m from the centre and the stair
feet reach 60.6 m. Two 1.2 m egrets fly over each stele walk (bar 7's second source in the road-entry view).

Decided under G872 (a walkable landmark over the steeper single-stair silhouette). Views 5 and 6 change, as meant (the
long south stair and the lower red tiers). The top-down shows the four-stair cross, and view 7 shows the west stair.
Nothing went missing, there are no holes, and the other views hold at SSIM 0.93–0.98.

The walk on `9c82257231` is 0 stuck and complete, reaching y 31.04 (the platform) in 188 s on the shortened route
(`scripts/physics-route.json`, under the 240 s cap).
