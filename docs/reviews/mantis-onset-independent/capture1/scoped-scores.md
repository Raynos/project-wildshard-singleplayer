# Candidate5 actual capture: scoped five-point assessment

2026-10-19. **HOLD promotion. Candidate4 remains public.** This is a separate, evidence-bounded scoring supplement to [the frozen independent review](REVIEW.md), not a replacement review or a new art council. The static nine-view likeness **3.6025/5 remains unchanged**. No combined average, revised likeness score or production acceptance follows from these scores.

## Scale and meaning

All new numeric judgments use an ordinal five-point scale: **1 = poor / fundamentally deficient; 2 = weak / major shortcomings; 3 = functional / substantial limitations; 4 = strong / minor shortcomings; 5 = excellent / convincing within the stated scope.** These are reviewer judgments, not percentages or test-pass conversions. Confidence concerns the narrow stated judgment, not the wider game. **Not rated (NR)** means the capture cannot responsibly establish that axis; it is neither zero nor a pass.

| Requested axis | Scoped score | Confidence | Evidence and boundary |
| --- | --- | --- | --- |
| Graphics | **3/5**, captured runtime presentation only | Medium | Full-resolution frames show a distinct faceted mantis, readable green wings and orange sickles, and an intact silhouette. The dark floor gives weak grounding cues; overlapping appendages crowd the collapse and bright hit flash washes out form. This assesses presentation in this diagnostic arena/camera only, not reference likeness, environmental art or a new nine-view art review. |
| Animation | **2/5**, sampled attack/death transitions | High for sampled defects | Both observed attack boundaries jump from cocked to cut poses; subsequent active samples hold very similar poses rather than showing a continuous sweep. The death sequence collapses into overlapping limbs. Independent full-vertex reconstruction establishes a fresh early-death floor penetration of **10.22 cm**. Frame inspection establishes pose discontinuity, not subjective normal-speed smoothness; recovery and continuous ground contact remain incompletely sampled. |
| AI | **3/5**, one-enemy approach/stop/resume and attack execution | Medium | Recorded positions, state transitions and checks establish actual approach, stop, resume, second stop, both strikes and real player damage. No recorded page/fatal errors. Diagnostic player placements deliberately trigger these cases. This does not rate pathfinding around obstacles, tactical intelligence, adaptation, multiple enemies or robustness across encounters. |
| Combat readability | **2/5**, visible tell-to-cut and hit feedback | Medium | The raised blades supply a tell and health loss/hit flash supplies feedback. However, the first visible active cut arrives as a large switch, active poses stay held, and the observed pose clock lags authoritative strike state. The old observed-clock-zero tell hold is removed without demonstrating a continuous readable arc. No struck-windup evidence; no claim of reliable interruption or dodge readability in ordinary first-person play. |
| Gameplay | **3/5**, functional practice-bout loop only | Medium | Real enemy and player damage, enemy defeat, practice-local reward, Retry, player defeat, blocked defeated attack, final Retry and reload reentry are supported. Empty browser/world state is preserved. The harness remains **18/19**, with its terminal-health damage assertion false despite earlier real damage and natural regeneration. This is functional-loop evidence, not a rating of human controls, collision fairness, exploration, progression or overall gameplay quality. |
| Balance | **NR** | Insufficient evidence | Enemy HP 55, repeated 12-point sword damage and player HP loss are observations, not tuning validation. Scripted placement, regeneration and one opponent do not establish fair difficulty, skill-relative win rates, resource economy or encounter pacing. |
| Variety | **2/5**, demonstrated attack-pattern variety only | Low | Two distinct recorded strikes plus approach/recovery/death show more than one state, but the observed combat repertoire is narrow and repeated. This rates only what this single-mantis capture demonstrates; it is not a claim that unseen content is absent or a score for game-wide enemy, encounter or build variety. |
| Performance | **NR**, including physical-phone performance | Insufficient evidence | VP8 encoding at 25 fps is not simulation or display performance. Swiftshader browser emulation, duplicate encoded frames and nonuniform compositor samples do not establish sustained iPhone 17 Pro Safari/PWA frame rate, thermals, latency or memory. No physical-phone run or benchmark was done for this supplement. |
| Estimated fun / human fun | **NR** | Insufficient evidence | No person played this diagnostic for the review, and no normal-speed visual playback was performed. Scripted interaction and discrete frames cannot substantiate an enjoyment score. Hypothesis only: the visible tell/hit/retry loop may support a satisfying bout, while abrupt attack transitions could reduce perceived fairness; neither is a measured human response. |

## Direct inspection and provenance

This supplement inspected **16 original full-resolution 402×874 decoded frames**, sequentially within the selected attack and death passages: encoded indices **300, 350, 368, 369, 374, 400, 433, 434, 445, 1231, 1235, 1238, 1241, 1693, 3805, 4065**. Indices are zero-based; video time is index / 25 seconds. Each extracted frame's decoded RGB SHA256 matches its entry in the existing `video-index.json`. The diagnostic HUD is included, with no crop or resizing. These are selected frame sequences, **not normal-speed playback or a second exhaustive review**.

The earlier independent reviewer covered all 4,066 encoded frames through 3,218 distinct decoded images and reconstructed all 1,355 recorded world poses. Its exhaustive scope is attributed to that review; this supplement relies on its preserved contact result and inspected supporting method, alongside the recorded report/trace and analysis. No original capture or reviewer file was changed. All seven files listed by `review-closure.json` were rehashed and matched before this supplement was written.

Specific anchors:

- Encoded 368/HUD74 shows authoritative active elapsed 0.050 while observed windup remains 0.600; 369/HUD75 shows the cut at observed active clock zero, already 0.150 into authoritative active. Encoded 374 and 400 retain a similar cut pose; 400 visibly shows health 90. Encoded 433→434 supplies the second boundary (authoritative active elapsed 0.017→0.117), with 445 retaining the second cut pose.
- Encoded 1231→1235→1238→1241 covers lethal flash and early collapse. At 1235/HUD390 the flash and dark floor make pixel-only clearance judgment unreliable. Independent reconstruction records trace385, deathT 0.110375, flinch 0.615297, minimum −0.10222949073886411 m, 98 vertices below floor, 93 below −5 mm. Living sampled minimum is +0.0006716942377806845 m; this tiny sampled clearance is not continuous clearance certification.
- Encoded 1693 and 3805 show fresh-bout Retry states; 4065 shows postreload first-person reentry. Reported actual sword damage 55→43 occurs during active stage1, with flinch1 and strike persistence; subsequent hits reach zero. **No struck windup was captured.**
- The raw report's 18/19 assertion outcome is retained. Earlier trace health 90 and later terminal defense health 100 establish why terminal-only detection misses actual damage. This explanatory evidence does not rewrite the failed assertion as a pass.

The floor failure is newly observed in this candidate's actual trajectory. There is no paired same-host candidate4 capture here; do not call it an onset-caused regression or a proven host defect. Candidate5's earlier first-observed active cut is a narrow timing success, not a visual-quality pass. Abrupt attack transitions and actual early-death penetration are sufficient to retain HOLD without demanding another capture or assigning phone chores to the user.

## Input hashes

SHA256 values below identify the files used by this supplement. Paths are repository-relative. Original video and raw capture files remain local diagnostic evidence; the screened equivalents are identified by the candidate5 provenance manifest. No publication was performed by this assessment.

- `docs/reviews/mantis-onset-independent/capture1/REVIEW.md`
  - `038874836bc14a45a6ca140893cbe8ab25218e62da6fdc03af534cc4cfc5d997`
- `docs/reviews/mantis-onset-independent/capture1/review-closure.json`
  - `4c326ebb8273c514c114c241ba5599d58e64272eb9ea1a327a19b9c1c451cd3b`
- `docs/reviews/mantis-onset-independent/capture1/capture-verification.json`
  - `4cecf8dee246f3672c626fd56827f06dddace459946c9f9c79fede7162a0c19c`
- `docs/reviews/mantis-onset-independent/capture1/video-index.json`
  - `c45d7311e0b536bf7cad3953b29ed3029862029ad80c383c7ff18fa86718bcef`
- `docs/reviews/mantis-onset-independent/capture1/check_contact.py`
  - `10b235f92e6e88383873b681a79f378bd805c1cc331a8221903bc7be763b4bbd`
- `docs/reviews/mantis-onset-independent/capture1/world-contact-independent.json`
  - `59f70ff7073314c9b21ff921068e01d693447afb75d1b38caaf53c7321c96c73`
- `art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate5/evidence/provenance.json`
  - `4bfd361e37dadab58e3719768b67d0cba5e3b22066f85178b9eab086ec718211`
- `art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate5/capture-closure.json`
  - `dc5797524839191780fa48769fb4e9d3f02f381d4eb7b4dcebde7db2d1f29025`
- `tmp/mantis-onset-capture1/qa/video/page@8563bab3fe2db8bb40a0166c56837b05.webm`
  - `9620ceec42e73529d96ba8053fcd0ded7cb16ed685b63502706627550e8bb282`
- `tmp/mantis-onset-capture1/qa/report.json`
  - `43c0a0c5637dfd037f99f5b301769f8e7eb0a7f45606560c34875610166dd382`
- `tmp/mantis-onset-capture1/qa/render-trace.json`
  - `53d1e2ae3efe3c56ffd919f62bf4474f04e7a77ead8d598d7973edae2158d94d`
- `tmp/mantis-onset-capture1/capture-analysis.json`
  - `2e3e194620631c65a6f883cf95b41c49f981a2c5ad61688e8ce2965781d9c5f5`
