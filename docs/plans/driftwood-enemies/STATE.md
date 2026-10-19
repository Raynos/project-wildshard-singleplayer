# DRIFTWOOD-ENEMIES — State

Updated 2026-10-19 12:35 UTC. Static milestones complete; runtime WIP.

OWNER12:32: Loop ALL FIVE until4/5, including Puffer again. Separate likeness, animation and combat-readability gates; no rounding or overall average. Supersedes four-enemy>3.5, Puffer parking and historical V100 stop. Twenty extras stay parked. Current plan: docs/reviews/five-enemy-four-star-loop.md.

Independent full-nine static: Bellback V6 3.5625; Mantis V7 3.6025; Colossus V4 3.65; Conch character 3.57. Zero quality-complete enemies, physical-phone or human-fun acceptance.

PUBLIC: Site62 live12:29:30UTC, source d7386dd4559b919f91a7e9895b00163b331587ad. Same four hosts;23 historical images losslessly compacted with browser pixel equality and retained originals. Owner requests one pinned Arena entry/all-five selector: implemented locally, browser QA pending. Bellback disabled. No host changes.

MANTIS7: Product123eab925eca95a5275637259803235c85c670cb85c184e186334a3c24f8c9f7. Authoritative frame.attack drives precontact sweep; AI/strike clocks, geometry, gait and accelerated knee death remain unchanged. Source10+independent15 tests, strict admission3 and mounted24 checks pass. Root typecheck resource-killed137, not passed. Actual run2 is17/19: both named early/late-hit checks fail. The early-labelled attempt actually lands a late-sweep hit; the other lands active. No early-windup hit or death during sweep observed.

All4598 encoded frames and1306 exact pose inputs independently reviewed; evaluator error <=1.11e-16. Sampled floor minima living0.674mm/dead13.685mm. One moving active death,3 coins, actual player defeat/blocked attack, Retry/reload and empty stores pass.16 sampled endpoint transitions have zero raptor jump. Sparse100ms windup still jumps0.684rad; recovery onset0.708rad; first approach holds cut pose0.928s before damage. Passive proximal-arm overlap, weak gait and corpse overlap remain. Animation/readability stay2/5; no continuous-contact acceptance. docs/reviews/mantis-precontact-independent/capture2/REVIEW.md. Originals protected in native Site; failed preflight/run1 and prior candidates retained.

CONCH4: Mounted34 checks and4460 frames reviewed. Tells3/5 from2.5; hit/recovery2.5, death3, grounding3. Sliding matches intentional stagger push; do not suppress physics. Deferred hit-handoff audit: docs/reviews/conch-hit-handoff/audit.md.

BELLBACK: Candidates4/5 rejected for contact;5 also regresses death to1.5/5. Solver/timing/CCD failures preserved; do not repeat parameter chasing. OWNER DECISION pending since08:38: isolated five-body/four-joint Ragdolls prototype with eight shapes. No implementation before approval; do not repeat question.

Mantis gait audit: stance slip1.010x root travel; pointwise fit fails0.217rad seam and20.408mm speed-blend contact. One global periodic fit underway, unaccepted. Six-shard work open. Sources verified through9cce68423723afccad887039ae5621be71252bca. Root connector gamedev-dot only; preserve unrelated/sparse work.
