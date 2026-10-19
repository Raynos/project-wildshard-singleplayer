# Candidate7 actual capture independent review

## Decision

GO only for a clearly labelled UNACCEPTED diagnostic WIP replacement. HOLD visual/gameplay-contact acceptance. Animation/readability remains 2/5. The original source decision remains GO diagnostic-build only. No essential supplemental recording is required for this narrow WIP decision; early-windup hit, sweep-time death and actual stun interruption remain unproved and must not be promoted to passed coverage.

## Identity and scope

Reviewed source checkpoint `5df5e1be3327063967cbd3dd14c38df13794d100`, product `123eab925eca95a5275637259803235c85c670cb85c184e186334a3c24f8c9f7`, closed `tmp/mantis-precontact-capture-run2`. Original video SHA256 `130fd5eeca4507c74e133bb7d3766709119fab9bee8f9ed43154df642bc26821`; trace SHA256 `8e48ee230fe7bf739b0303ba3c0463c087bea9778828f8d19b42c2f5d1558826`. Run1 setup failure is not replaced by run2. This review neither builds nor changes the product and does not certify later Site mounting or transcoding.

## Actual motion and authoritative inputs

All 1,306 captured poses independently replay from their recorded pose-owned inputs, including actual `frame.attack`: zero missing inputs and maximum local transform error 1.1102230246251565e-16. Outer render/event state is not substituted for animator input. No reconstructed attack clock is used. This is actual evaluator/output parity, not an assumption that the outer event snapshot was evaluated at the exact damage instant.

Both strikes visibly raise then sweep before active. They do not introduce a delayed active-ramp regression. Across 16 sampled endpoint-to-active transitions, raptor quaternion change is zero. The actual capture is sparse: maximum within-windup adjacent raptor rotation is 0.683691 rad over 100 ms (frames 816–817, second strike). Maximum living adjacent local rotation is 0.708301 rad across recovery onset (312–313). Continuous source functions therefore do not establish smoothly rendered playback at this cadence. No stale observed-recovery/live-attack case occurred here; source tests cover that case separately.

The first successful approach reaches full cut at frame 103, pose time 9.1562 s, then damages at frame 113, event time 10.0837 s: about 0.928 s holding the cut pose before damage. Other approach hits have roughly 0.598–0.912 s endpoint lead. Close-contact hits generally have 0–0.100 s sampled endpoint lead. This is real evidence of frozen cut-pose charging and a readability weakness, even though the underlying strike timing was intentionally preserved. It is not proof of a new timing regression against candidate6.

Native skin-weighted vertices were transformed with actual full world matrices and compared to the actual-size player capsule. No active raptor assembly vertex overlaps the player in 186 sampled windup poses. Two windup samples, frames 905–906, have overlap of the opposite, non-striking proximal arm (about 95 and 120 mm penetration), about 188 and 91 ms before damage. The striking arm remains outside in those samples. Positive vertex clearance does not exclude a triangle crossing, and samples do not establish continuous swept-volume clearance. This bounded check must not be described as collision acceptance.

## Hits, death and lifecycle

Preserve the recorder's 17/19 result: `earlyLegalHit=false`, `lateLegalHit=false`. The early-labelled attempt actually lands at frame 163 during late sweep, attack 0.918533 and strike elapsed 0.600 s. The late-labelled attempt lands in active at frame 226. One real late-sweep hit is evidenced, but neither failed named check becomes a pass.

Five subsequent moving-hit events culminate in a real lethal hit at frame 471, speed 4.7649 m/s, active elapsed 0.6667 s, attack -1. This is moving active death, not death during precontact sweep. The recorded collapse, settled corpse, three practice coins, actual player defeat, blocked post-defeat attacks, Retry, reentry and empty persistent stores are covered by the original checks and visible sequence. White hit flash partly obscures onset geometry.

All 1,306 full-world native weighted poses have nonnegative floor clearance. Minimum living clearance is 0.674 mm. The one actual death has 173 samples and minimum clearance 13.685 mm; maximum early adjacent knee rotation is 0.444416 rad. This confirms the sampled floor bound, not tasteful contact or polished collapse. Earlier source review separately proves exact candidate6/7 weighted-world death parity over 224 recorded old poses; that source evidence was not rerun or relabelled as new runtime coverage.

## Complete encoded-frame review

Decoded all 4,598 original 402×874 frames at 25 fps. Full decoded RGB hashing identifies 3,491 unique representatives and 1,107 exact duplicates. Inspected every representative in chronological sheets 000–054; duplicate mappings are retained in `video-index.json`. Additional full-resolution inspection: encoded frames 234, 248, 263, 319, 329, 670, 1680, 1687, 1700, 1744, 3295, 3400 and 4542. This is chronological image-sequence review, not a claim of normal-speed video playback. Full-resolution fine contact was not inspected on every frame.

The orange sickles and green leaf silhouette remain recognizable. Precontact movement is visible. Long upper-body pose holds, sliding/weak planted gait, coarse recovery transitions and a tightly folded overlapping corpse remain. No exploding/disappearing model was observed. The final sequence visibly reloads and reenters first-person practice. Thumbnail coverage and floor bounds do not justify higher visual scores, anatomical-intersection clearance, collider acceptance, or production acceptance.

## Reproducible artifacts

`pose-parity.test.ts` and `pose-tests.txt`: one independent actual-input test passed over all poses. `check_contact.py` / `world-contact-independent.json`: native weighted full-world floor calculation. `attack-timing.py` / `attack-timing.json`: pose/event timing and vertex/capsule distances. `active-contact-summary.json`: active versus passive arm distinction. `adjacent-audit.py` / `adjacent-audit.json`: actual quaternion adjacency and endpoint transitions. `inspect_video.py` / `video-index.json`: every encoded frame identity and duplicate mapping. Generated sheets remain in temporary review storage; the exact original video and decoding recipe permit regeneration.
