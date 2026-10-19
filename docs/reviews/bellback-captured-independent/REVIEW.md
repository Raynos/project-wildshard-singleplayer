# Bellback candidate5: reject promotion, captured death regresses readability

Independent complete-cycle review, 2026-10-19. This is a frozen review of candidate5, not a review of subsequent solver experiments. All four static milestones remain done; no new likeness scoring or anatomy change is requested. No engine, product, STATE, Git, browser, Mac or production changes by this reviewer.

## Verdict

**Reject candidate5 for promotion.** Preserve it only as a clearly labelled failed diagnostic WIP. Capturing the exact lethal local pose works, but does not pass the unchanged 5 mm contact threshold and produces an upright, stiff corpse that is hard to distinguish from living idle. Better transient contact numbers than candidate4 do not compensate for the death-performance regression. This is not quality-complete or arena-ready animation acceptance.

Product `22a5dec83554617cfc56fc587dde955e75d08a24f49d67b6cdf22d10f03f414f`; engine checkpoint `803359c25722126591ea08c9e4e63872af5b5db5`. Independent read-only verification matched all **1,600 source-closure files and 186 built files** to their SHA256/byte pins. Source manifest SHA256 `8bbe5985f6fb2d3d658ae246179b1fe24ee43a58ab8ed87bda81f271395a66b6`; build manifest `4a403570569f6b8600f6709c423890b12cfc50a18b096c5af48e2d8e89a484fa`. Capture sources are preserved in `docs/reviews/bellback-runtimecandidate5-actual/` and pinned by its capture manifest.

## Every-frame visual review and cadence

All **3,637 encoded frames, zero-based 0–3636**, decoded chronologically and inspected through 57 full-frame contact sheets. Twelve exact consecutive pixel duplicates map to their already-inspected preceding frame; there are no selection/time skips. `encoded-frame-map.json` maps every frame to its sheet/tile. Twenty native-resolution extracted frames were additionally inspected across telegraphs, interruption, both lethal hits, tipping, rest, player defeat and Retry. `detail-board.jpg` is a labelled cropped evidence board (439,362 bytes); full original frames and the full-resolution board remain in temporary evidence. Thumbnail review establishes gross continuity, not subpixel contact; numerical geometry reconstruction below establishes the latter.

Explicit broad encoded review regions, including surrounding transitions:

- 0–257: boot, entry, idle and initial approach.
- 258–530: full uninterrupted pulse/echo/stomp sequence and post-cycle idle.
- 531–965: Retry, unhit approach, stop and resumed movement.
- 966–1170: single interruption, stagger, recovery and renewed pulse.
- 1171–1672: repeated normal sword inputs leading to the first lethal hit.
- 1673–1880: first root throw, tipping, settle, frozen upright corpse and local reward.
- 1881–2476: Retry and second bout with angled lethal approach.
- 2477–2680: second root throw, tipping, settle and frozen upright corpse.
- 2681–3477: subsequent player-defeat sequence and blocked input.
- 3478–3636: final Retry and reload; recording ends during the reload screen.

These are broad visual regions, not precise event timestamps. Exact live-state ranges below are authoritative. Recording startup-to-document performance clock offset was not logged; encoded time must not be presented as game time. Burned-in frame/game-clock labels anchor the inspected events. Reload completion is established by the report, not by a post-reload arena frame in this movie.

Movie: 402×874, 25 encoded fps, 145.48 s, CSS-resolution deviceScaleFactor1. **1,247 actual render observations span 134.9271 wall seconds**, with 1,246 intervals: **9.2346 observed renders/s**; median interval 100.10 ms, p95 197.25 ms, maximum 473.70 ms. Game time advances 109.3311 s. Encoded repeats do not create new animation samples. Cloud Chromium/SwiftShader is not a physical iPhone/Safari, thermal or frame-floor result; no phone smoothness or human-fun claim.

The diagnostic camera follows the enemy and is restored after rendering; viewmodel is hidden. Diagnostic player placement/aim is logged. This is real AI/combat but not ordinary first-person play or a camera-independent gait test.

## Complete live cycles and gameplay

The full-combat report has **28/28 true functional checks**, independently read alongside the traces. It is not a quality score.

- Uninterrupted pulse: live 48–59 windup, 60 active, 61–62 recovery, 63 phase idle. Echo: 64–71 windup, 72–73 active, 74–79 recovery, 80 phase idle; AI idle 81–93. Stomp: 94–102 windup, 103 active, 104–111 recovery, 112 phase idle; AI idle 113–128. Enemy remains 180 HP; player 100→70. All full phases are captured, albeit at coarse render cadence.
- Unhit approach: live 144–228 moving, 229–279 stopped, 280–288 moving again. Front-leg local lift ranges≈17.26 cm and rear≈8.05 cm. Real local leg motion exists, while body translation within the rig stays fixed and weight shift remains weak.
- One normal sword input changes HP 180→168 at 295; stagger 296–312, idle 313–326; a full renewed pulse 327–344 reaches active 341–342 and recovery 343–344 before echo begins 345. Unlike candidate4, the renewed pulse is not truncated before activation.
- First death starts 532; frozen 565–603, 39 observations; Retry 604. Second death 819; frozen 849–903, 55 observations; Retry 904. Both earn 12 practice-local coins. First corpse interval has no post-death strike.
- Actual enemy attacks defeat the player. Input after defeat leaves enemy HP unchanged. Retry/reload restore 180 enemy HP, 100 player HP and zero reward state. Local/session storage and state-store remain empty and unchanged.

The separate producer arena-walk report passes 15 checks including live-corpse crossing, but this review does not re-run that browser. It is flat-floor evidence, not Explorer/terrain-host acceptance.

## Independent all-vertex and actual-native-shape contact

`recompute.py` validates unit quaternions, hierarchy, weights and inverse-bind translations, then computes weighted skinning of **all 13,374 original vertices** at every render observation. It does not infer contact from local bounds. Original geometry SHA256 `32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44`; flat floor Y900; unchanged threshold−0.005 m.

- **Rendered contact FAIL:** one of 1,247 observations crosses−5 mm. Live 533/game 48.7966 s, first death, left hind stone foot (`leg2`) vertex 859 reaches **−0.005834327715 m**, world[-5.780267454,899.994165672,-7.862000934]. Seven original hind-foot vertices cross the threshold. Core and other parts remain above it at that observation.
- No living observation crosses5 mm. Of 157 dead observations, only that first-death frame crosses. Second-death rendered minimum−0.000368759 m.
- Frozen rendered minima are−0.0000351623 m and−0.0000162663 m. All bone poses and mesh world matrices remain exactly unchanged throughout each frozen range. These flat rests are genuinely observed.

`fixed-shapes.py` transforms original bind-local vertices by all eight **actual recorded collider world poses**. Among 175 fixedPost records, three cross−5 mm, all in the first fall. `native-contact.py` separately includes both creation records and every one of the 88/87 native post-solver steps through the terminal frozen result. The first post-solver endpoint (live 533) reaches **−0.010302153088 m**, again left hind foot; recorded native manifold minimum is **−0.010302066803 m**. This is not an animated-local-shape artifact or render-only interpolation inference. Second native fall minimum−0.000515601 m; no 5 mm violation.

All actual native hulls are non-sensors. Original-to-native support differences are≤3.83e−8 m; every original vertex's maximum outward distance against all native convex triangle planes is3.775e−7 m. Frozen local bones and collider-local transforms have exact zero change. Initial and terminal native body velocities/manifolds are preserved; terminal linear/angular components are tiny (absolute components<0.000125), unlike a moving MAX_T freeze. The source still has MAX_T behavior, but it does not explain these two stable actual rests.

The 350 fixed-trace rows include 175 fixedPre rows; native world getters at fixedPre can retain cached poses. Do not call these newly assigned target geometry. Use the actual fixedPost/native-step world shapes above. Render interpolation and latest physics endpoints are separate clocks and must not be equated.

## What actually moves after death

Every local bone position/quaternion is identical from first dead render to frozen rest, and identical to the captured lethal endpoints throughout native steps: maximum component delta 0. This is an exact captured-pose hold, with no authored tuck or fold. It is not a static root:

- First observed root path 1.6383 m, net displacement 0.5810 m, vertical range 0.7098 m, maximum tilt 26.507°. Final tilt≈0.00095°.
- Second path 1.5535 m, displacement 0.4947 m, vertical range 0.6855 m, maximum tilt 26.178°. Final tilt≈0.00044°.

The visible result is a stiff, whole-creature hop/tip followed by a return onto its four feet. The held head, bell/carrier and legs keep their living silhouette. The first fall has modest rocking; the second changes root direction, but neither leaves a convincing dead silhouette. Stopping animation alone is not persuasive death acting.

## Five-point motion/readability axes

Same applicable axes as the candidate4 review; these are separate qualitative judgments, not static likeness scores or an averaged acceptance grade:

- Idle presence **2.5/5**: head/bell/clapper motion exists, but the rigid carrier and small accents dominate.
- Locomotion/weight **2.5/5**: real approach/stop/resume and changing legs, weak mass transfer. Observer tracking suppresses some translation cues.
- Pulse/echo telegraph differentiation **2/5**: working timing/damage, almost the same silhouette; subtle bell/clapper accents do not strongly separate the attacks.
- Stomp impact/readability **1.5/5**: damage flash reads more strongly than a whole-body stomp or planted impact.
- Hit reaction/recovery **2.5/5**: immediate white flash and successful stagger/recovery; the flash carries much of the response.
- Death/corpse performance **1.5/5**, down from candidate4's 3/5: real root dynamics, but stiff living-pose hopping and upright rest regress corpse readability. Neither successful rewards nor stable rest raise this score.
- Grounding/contact **3/5**: stable near-exact flat rest and no gross buried core, but strict transient contact still fails both render and native fixed geometry. Dark, weakly marked ground makes millimetre errors hard to see.

## Scope and next decision

Candidate4's22.03 mm rendered/24.27 mm fixed failures remain preserved; candidate5's 5.83/10.30 mm maxima are smaller, with different actual falls, not a controlled guarantee of universal improvement. Its poorer death silhouette is an independent rejection reason.

The parallel `captured-corpse-terrain/README.md` reports13/28 controlled native cases passing combined contact/rest, with scale 1 flat failures up to19.317 mm, a 2× slope case47.052 mm, and moving/floating MAX_T failures. Those fixtures use candidate4-recorded lethal inputs under captured policy and deliberate terrain placements. They are not candidate5 nonflat gameplay, and this reviewer did not execute or independently re-score that matrix. They reinforce the need to withhold broad terrain acceptance.

Preserve this candidate and its failure evidence. Do not promote it merely after a solver-number fix: contact and death readability need separate proof. Any new death approach should keep the admitted appearance/living combat and produce a materially distinct dead silhouette, with complete actual-cycle and contact review on its own pinned build. No further static art-score chasing is indicated.
