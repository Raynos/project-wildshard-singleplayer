# Colossus motion2 independent complete-cycle review

2026-10-19. Recommendation: **usable as an explicitly labeled WIP isolated playable**. The measured corpse penetration blocker is cleared for this exact recorded trajectory. Do not call the enemy animation-complete, visually accepted, collider-approved, phone-tested or fun-proven. This review changes no admission flag and publishes nothing.

## Frozen scope and verification

Input: `../colossus-native-motion2-build3/closure.json`, SHA-256 `72226a9dc20f51db713f93fdd67113166b379dfd59de559400c69ed159b737eb`.
Product source: `052535ba72fa042ee5895194390d31b489123494143c27f837bafaa112bcb349`.
Candidate2 source closure: `5505a8fe6e39d82ce2ad36e87c17225011ef82c68b06799d0c37a68be054808d`.
All 21 files listed by the original input evidence closure, its observer/geometry/source-closure files, and its video hash/bytes were checked. This is an evidence review, not a fresh browser run or rebuild. AGENTS, GIT and Driftwood-enemies STATE were read; engine, models, AI, admission, shared STATE, Git, remotes and Sites were untouched.

## Complete encoded-frame inspection

FFprobe reports 3,570 encoded frames, 402×874, 25 fps, 142.8 seconds. I inspected every zero-based encoded frame 0–3569 in 30 consecutive numbered sheets, including startup, every strike, repeated sword-hit reactions, own defeat, corpse launch/landing/rest, Retry and player defeat. Sheets crop x0/y230/402×570 to show the actor/ground; the full portrait corpse still was also inspected. Sheets are diagnostic filmstrips, not new game captures. Final sheet's unused black cells are padding, not missing frames.

The broad crown, long arms, turquoise chest and foliage stay coherent through the recorded poses. No visible exploding weights, detached limbs or gross floor crossing appears. Sweeps and the two-arm attack are distinguishable, but shoulders/arms carry most action; hips/feet and torso do not sell convincing mass transfer. Hit flashes dominate a long sword sequence, with limited visible recoil. This does not revisit or improve the retained static V4 likeness score of 3.65/5; thin side depth, regular limbs and sparse foliage remain.

## Ordered cycles and separate clocks

The independent extractor requires the ordered phase sequence windup → active → recover → idle. Ten complete cycles are present; frame ranges below are **render trace frame IDs, not encoded video frame numbers**:

- Actor 1: left 22–38 (game 1.125–2.667 s), slam 47–78 (3.440–6.280), right 91–109 (7.429–8.949)
- Actor 2: left 126–143 (10.383–11.903), slam 153–174 (12.735–14.589)
- Actor 3: left 861–878 (77.013–78.545), slam 887–918 (79.330–82.059), right 932–951 (83.308–84.843), slam 961–991 (85.635–88.375), left 1004–1023 (89.552–91.053)
- Excluded incomplete/interrupted: 587–589, 622–623, 656–657, 674–675, 1032–1046. Last cycle lacks recover after player defeat; do not count the surviving enemy's held attack pose as its death.

`analysis.json` includes every phase boundary's render ID, game time, wall time, state, state clock and strike clock. There are 1,080 render samples (IDs 5–1084), 141 dead samples and four distinct actor/mesh instances. Trace duration is 134.028 wall seconds versus 96.0988 game seconds; encoded video includes held frames and startup/outro. Within-bout aggregate 8.0458 FPS, median 105.3 ms, p95 258.1 ms and max 823 ms are cloud SwiftShader observations, not 25-fps gameplay or phone performance.

First alive=false/deathT=0 is frame 706; state 6 arrives at 707, 0.1 game seconds/115.1 wall ms later. deathT reaches 1 at 715, while root physics continues. The event callback records game time 64.347 s, whereas the first dead render carries 64.247 s: these samples are different hooks/clocks and should not be used to claim zero-latency event-to-render ordering. Dead state clock stays zero after state 6, while game/wall clocks advance. DeathT completion is not a settled-corpse or visual-completion signal.

## Contact versus death performance

I inspected and reran the supplied NumPy all-weight oracle (not a newly authored skin solver), then independently compared each of its 1,080 frame minima against the Three.js contact output. It includes all 22 captured local bone TRS, actual mesh-world transform, inverse binds and four influences for all 15,600 vertices, of which 4,384 are multiweight. Minima reproduce +27.000001 mm living and +18.563022 mm dead, zero frames below −5 mm; maximum solver difference is 1.1369e−13 m. This is sampled floor clearance, not proof of planted feet, body collision, terrain behavior or all possible death trajectories.

The actual dead root rises to y901.622727 and settles near y899.771973 relative to floor900. Full-world transforms matter: local-only tests would miss launch/tilt/landing. The lower-chain bend prevents the old floor crossing, but the final body is nearly upright with modest knee flexion. It reads like an immobilized crouching character, not a convincing fallen corpse. Dark floor and weak contact cues also limit visual grounding confidence. Retain the previously failed build2 evidence unchanged.

## Scoped ratings, out of five

- Functional isolated-bout evidence: **4.0/5**. Reported 20 combat and seven lifecycle checks agree with observed cycles, defeat, reward, fresh Retry identities and empty state/storage. Diagnostic player placement and observer camera limit generalization to normal play.
- Living attack readability/animation: **2.75/5**. Distinct gestures and full returns; weak full-body weight, limited follow-through and repetitive recovery.
- Sampled geometry floor-clearance confidence: **4.5/5**. Exact weighted world replay and two implementations agree; finite capture cannot establish all trajectories or collision correctness.
- Perceived grounding/weight: **2.5/5**. No gross penetration, but limited foot planting/weight transfer and poor floor contrast.
- Death performance: **1.5/5**. Visible launch/settle, then upright bent-leg rest; a finished collapse is absent.

Physical-phone performance and human fun: **unknown/unrated**. Static likeness remains the earlier 3.65/5 milestone, not a new motion score. Do not average these dimensions into an admission score. Keep the exact playable labeled WIP; preserve death-animation, foot-contact and collider limitations for subsequent work rather than restarting static art-score chasing.

## Reproducibility and preservation

`review.py` verifies input hashes and independently extracts ordered cycles/clocks. Rerun the input `verify_world.py` to `tmp/colossus-motion2-independent-cycles/recomputed-world.json` before running it. The local sheets and recomputation stay under that tmp directory, with hashes in this review's closure; large sheets/video are suitable for later native Site preservation, not ordinary source storage. No browser, build, model workflow or external publication was started.

Provenance addendum: after the original validation, the coordinator normalized only whitespace in host-build.log and retry-test.log and added log-whitespace-normalization.json retaining original hashes. The successor input closure is `0f92a822d8e111480732974b7831edcac9429f4b2282ec21d147c9750bf72cca`. I revalidated that closure; measurement, video and source bytes are unchanged. The analysis input pin now names this successor. This is log hygiene, not a gameplay change.
