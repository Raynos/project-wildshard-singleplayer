# Scores: the 8/10 mockup council

A shard passes at a three-seat mean of 8.0 or more (ledger 4). One row per shard per round.

| Round | Shard | Capture | Seat A | Seat B | Seat C | Mean | Passed |
|---|---|---|---|---|---|---|---|
| 1 | Signal Dunes | `progress/sunscar-dunes/20261002-2149-7ec2c737` | 4.7 | 4.8 | 4.6 | **4.70** | no |
| 1 | Sky Reach | `progress/far-reach/20261002-2149-7ec2c737` | 4.4 | 4.6 | 5.0 | **4.67** | no |
| 2 | Signal Dunes | `progress/sunscar-dunes/20261002-2243-cb48ab8f` | 5.2 | 5.3 | 5.1 | **5.20** | no |
| 2 | Sky Reach | `progress/far-reach/20261002-2249-1b278da3` | (hung) | 5.1 | 5.6 | **5.35** (2 seats) | no |
| 3 | Sky Reach | `progress/far-reach/20261002-2333-b69c79d1` | 5.5 | 5.7 | 6.0 | **5.73** | no |
| 3 | Signal Dunes | `progress/sunscar-dunes/20261002-2351-a9e50413` | 5.7 | 5.3 | 4.9 | **5.30** | no |
| 4 | Sky Reach | `progress/far-reach/20261003-0009-fb93141c` | 5.8 | 6.0 | 5.9 | **5.90** | no |
| 4 | Signal Dunes | `progress/sunscar-dunes/20261003-0019-8221a34a` | 5.9 | 5.4 | 5.2 | **5.50** | no |
| 5 | Sky Reach | `progress/far-reach/20261003-0033-9dbf50f8` | 5.8 | 5.9 | 5.9 | **5.87** | no |
| 5 | Signal Dunes | `progress/sunscar-dunes/20261003-0057-56c23085` | 6.1 | 5.7 | 5.6 | **5.80** | no |
| 6 | Signal Dunes | `progress/sunscar-dunes/20261003-0132-28e3eb78` | 6.1 | 5.5 | 5.3 | **5.63** | no |
| 7 | Signal Dunes | `progress/sunscar-dunes/20261003-0156-eeee0e02` | 5.8 | 5.7 | 5.7 | **5.73** | no |
| 6 | Sky Reach | `progress/far-reach/20261003-0201-fc54d9df` | 6.2 | 6.1 | 6.0 | **6.10** | no |
| 7 | Sky Reach | `progress/far-reach/20261003-0250-1c2c026e` | 6.3 | 6.3 | 6.2 | **6.27** | no |

Notes:
- Round 1: seat A accepts its numbers as diagnosis only, since two staged shots did not reach the real state (the harness
  calmed the Storm Roc out of its stalk; Signal Dunes' waymark stage skipped side effects of normal play); both were fixed
  before round 2.
- Round 2, Sky Reach: the Codex seat hung for 47 minutes before creating a session and was stopped; round 3 (a newer
  capture) superseded it, so its mean is from the two Claude seats and counts only as a progress reading, never as a pass.
  Seat C voided mockup C's frame (the `fan-gust` freeze, now a ledger rule) and seat B found three re-aims that moved away
  from their mockups; all were fixed before round 3.
- Round 3, Signal Dunes: the round README listed the camera re-aims from the builder's message and got them wrong (seats B and C); it carries a correction from the cameras.json diff, and from round 4 the list is generated from the cameras blobs in meta.json. Seat C: matching mean colours flattened the contrast (the ground's tonal spread a third to a half of the mockups').
- Round 4, Sky Reach: two process gaps the seats found. A new knoll lifted mockup C's camera 1.1 m with no cameras.json change, so the generated list missed it; and the Roc's staged spot changed while the README said staging was unchanged. From round 5, shard-progress records each shot's real camera (meta.json camAt), and the round's list adds real-camera moves and the commits touching staging code. The Roc's spot is outside its 13 m flight circle (not shown reachable): should-fix, stage it on the circle.
- Round 5, Sky Reach: a plateau (5.90 → 5.87). The builder's highlight claim counted a clipped red channel; the brief now measures brightness as Rec. 709 luminance. The seats' persistent items: the meadow (every round), the sun on the wrong side of four of five mockups, the highlights (the AgX tone mapper unchanged), the knoll.
- Round 5, Signal Dunes: the README's "no commit touched staging code" missed a dusk change in plugin.ts that re-lights the staged B view (real play state, not a breach); the generated diff now lists every shard commit between the captures. After round 5 the lead restarted sky-reach as a fresh session from its handoff (d9a90d79c): a plateau and a full context.
- Round 6, Signal Dunes: down from 5.80. The sand grain doubled, but the terrain reshape (no re-aim; it moved the real cameras 3–8 m, which the camAt list now shows) broke C and D, the dune forms lost their light/shade line, and the coil turned copper. A builder measurement included the coil in a ground patch; measure on ground clear of the viewmodel.
- Round 7, Signal Dunes: a revert to round 5 (nearly pixel-identical), so round 6's gains went with its regressions; several builder measurements matched no patch the seats measured, so the builder adopts one tool (far-reach's measure.py, Rec. 709, the seats' regions) and quotes its output.
- Round 6, Sky Reach: up from 5.87 (fresh builder session). The highlights now match (luminance), proposal B's axis and D's dais read right; still open in every seat: the meadow reads as moss clumps and big flower dots, the islands are smooth domes rather than layered crags, the fan and glove are simpler than the mockups, the sun is a ring with a separate glow, and the Roc is not captured mid-approach.
- Round 7, Sky Reach: up from 6.10. The sun is one disc, the near-ground darkening is gone, and the storm eye, the netted bridges and the fan's straps landed. Two regressions: the gamma lift and the keeper's short-grass ring flattened A's meadow into a lawn, and moving the overhead isles to the horizon took mockup A's isle cluster away. The 'slate' Roc is still brown. Its 60 ms staged settle with a heading off the player is a should-fix under ledger 5, not a void: stage the Roc's real circling lap instead. Both Claude seats found that the engine could not bank a flyer; it can now (SpeciesFlight.bank, 8252e3978).
