# Signal Dunes loop 4 (round 13), 2026-10-02

The lead's round-0 baseline (`art/shard-polish-council/round-0-baseline/compare-*.jpg`): next to the other four shards,
Signal Dunes read as sparse (thin foreground, an empty middle distance, little surface detail). This loop fills the frame
in layers. Captures: `scripts/shard-progress.mjs`, iPhone portrait 390x844 @3, phone tier.

| File | Shows |
|---|---|
| `board-before-after-target.jpg` | before (8f3d7e10) · after (eaeb401f) · target: first frame, H2 caravan, H3 waymark, H4 deck, the two aerials |
| `cards.jpg` | the new title (portrait, landscape) and Explore (world, models, sets, practice) cards |

What changed (eaeb401f and the commits before it):
- sky: a lit dusk cloud deck, a taller warmer afterglow band;
- far: 14 sandstone buttes and mesas past the playable square; real aerial perspective (fogDistDensity; the engine's fog
  is exponential, the old near / far were unused);
- mid: outcrop clusters, dead acacias, carcasses; near: shrubs, grass, gravel, marker posts with rags, cairns, scree;
  the sand's tonal drifts and wind streaks; a warmer grade;
- the minimap in sand; the caravan lantern pool; the barrel; the H4 deck haze (the boss copied the placeholder fog);
- cards from the hero scenes.

Open: the H4 back sky band is still paler than its target; the Matriarch storm's fog close-in never applied (the engine's
fog is exponential: `STORM.near / far` are unused, only the sand shells read); hands and whip next to the bar's.
