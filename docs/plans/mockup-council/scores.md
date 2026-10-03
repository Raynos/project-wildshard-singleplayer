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
