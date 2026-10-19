# Independent Puffer closed-anatomy rig1 lifecycle review

2026-10-19. **Reject promotion. Keep the existing public Puffer fallback unchanged.**
This recording closes important functional evidence gaps. It also proves a new
settled-corpse contact failure: the right fin remains 41.586 mm through the floor.
Functional completion does not grant presentation, animation or physical acceptance.

## Method and exact coverage

Reviewed the immutable attempt2 original movie, SHA256
`57ecaea24d60b0e1b4f84fbb868136f2dbdcb39472a97b4283c033f131ab5afb`.
It is 390×844, 274.16 seconds, 6,854 encoded frames at 25 fps. The recorder ran
276.945 wall seconds. Attempt1 was a pre-page browser-launch failure; it is not
play evidence and was left intact.

- Decoded **every one of the 6,854 encoded frames**, in order, into 35 numbered
  JPEG overview sheets, 200 frames per sheet except the final 54. Every sheet was
  visually inspected. Each thumbnail is 78×169, with encoded index and marker.
- Inspected **77 native-resolution 390×844 encoded keyframes** in 13 labelled
  montage sheets, each panel retaining native dimensions. These cover boot,
  close attack cycles, defeat, blocked attack, Retry, approach, full-body
  windup/active/recovery, all four lethal-bout hits, death transition, coins,
  settled endpoint, reload hit and exact final encoded frame. Individual JPEGs
  remain available. This is **not an all-frames-at-native-resolution claim** and
  not real-time playback/phone playtesting or audio review.
- Independently decoded the marker in every encoded image. There are **618
  distinct valid render markers: 581 initial and 37 reload**. The 723 consecutive
  telemetry rows are 665 initial (f2–666) plus 58 reload (f1–58). Video sampling
  omits some telemetry frames and repeats others; these are different counts.
- The final initial-bout movie marker is **665**, not 666. The movie visibly
  establishes **5.2442 simulated seconds after lethal f609**; 5.3442 seconds is
  the telemetry/checkpoint duration. Both exceed five seconds, and the actual
  frozen endpoint appears repeatedly in the movie.
- The exact final encoded frame e6854 decodes to **10046**, reload f46, with
  burned-in wall-relative t13.072. Its simulation time is 2.9327. That proves
  **2.2117 simulated seconds after checkpoint f23**, and 2.3117 after damage
  first appears at f22. Reload telemetry f47–58 is not claimed as movie evidence.

`decode.py`, `extra.py` and `recompute.py` are reproducible read-only audit tools.
Their output is in the separate ignored `tmp/puffer-full-lifecycle-independent-review`
folder. No full native PNG dump was made. JPEG overviews/keyframes, indexes and
analysis total about 40.6 MB; original evidence was not edited or replaced.

## Identity, clocks and renderer

Independent current-file hashing passes **all 137 app files and 50 product files**.
The app has exactly 137 files; before/after pin receipts are equal. Product
sourceHash is `99a69f9d3fc61912beaf08db8e7d67456756773976bb9a199dbd033910d610ed`.
Raw report SHA256 is
`e1406a4151bff1a84a401942f49e5340eb3212aca058eb73787fb2d0d75b82ca`.
The source remains explicitly unaccepted with no physical/death/animation admission.

All 723 rows are unpaused, scale1, captureFps=null. FrameTime equals the app
clock's elapsed value in every row. Pose input t equals frameTime before Retry
and in reload; after actual Retry it correctly uses the new bout clock, with
frameTime minus rigCtx.t consistently 48.8994 seconds (f501–666). The displayed
wall-relative t and Three Clock are not substituted for the pose/simulation clock.
Full scalar rigCtx, bone world matrices, inverse binds, bind matrix, mesh world
and camera transforms are recorded. Cloud RAF median intervals are 350/300 ms;
25 fps encoding repeats are not normal engine throughput or phone performance.

DPR2, canvas780×1688, viewport390×844, three enabled renderer passes, one shadow
cascade, no AO, authored-pose recoil and gray-v2 lighting remain pinned. Browser
local/session storage, cookies, caches, workers and databases are empty before,
after and at every checkpoint; world stores contain no keys, no shard and
zero generation. Reload-before-boot stores are empty. The recorder logs three
explicit player-only diagnostic placements. Later camera look/movement and
attacks use actual inputs. This is a bounded practice sequence, not an entirely
organic player route, physical phone run, or live-world reward test.

## Actual sequence, with visible evidence

1. **Defeat:** repeated actual attacks reduce player100→88→76→64→52→40→28→16→4→0.
   HP0 first occurs at initial f489/e4646 (185.80 movie seconds). The defeat
   message and zero-health HUD are visible. Most of this long close-range
   segment crops the lower body behind controls; it proves damage, not whole
   body animation quality.
2. **Blocked attack and Retry:** the f490 input is followed by player0/enemy45
   through f496. e4713/m496 visibly retains the defeated state, and no successful
   hit flash appears. Retry genuinely restores player100/enemy45 at f501;
   e4761/m501 shows the fresh bout. Inputs and telemetry establish the attempted
   blocked action; a static image alone cannot establish that an input occurred.
3. **Whole-body attack cycle:** the new view exposes front body, fins and toes.
   Telemetry windup f540–548, active f549, recovery f550–560 and idle f561 are
   represented in the movie. e5205/m549 explicitly shows the active frame.
   Full-body framing is clear in later windup, active and recovery, but early
   windup f540–542 and portions of approach still clip the outer fins or overlap
   controls. Camera retreat changes apparent scale and must not be mistaken for
   a strong authored inflation animation.
4. **Sword response/kill:** real sword hits reduce45→33→21→9→0 at f586,593,603,609.
   Visible flashes and changing pose correspond to all four hits; e5756/m609
   shows the defeated-opponent message. The white flash is very strong and
   obscures the surface/pose during the contact frames.
5. **Death and coins:** corpse rotation and settling are visible, with two local
   coins collected at f617/e5838. The body initially moves partly offscreen left,
   becomes thin/edge-on during rotation, then returns to a low, tilted settled
   shape. The final freeze is materially different from the older short airborne
   capture. The later “loot” checkpoint observes the same completed pickup;
   there was no second coin action.
6. **Reload:** fresh bout, real swing and flash at reload f22/e6591, damage45→33,
   then visible hold through f46/e6854. Enemy HP is a telemetry measurement;
   the video supplies matching swing, impact and continued living opponent.

The 15 stationary living stage0 telemetry rows provide only brief ordinary idle
coverage. “Idle” strike/controller labels during cooldown are not automatically
ordinary idle animation. There is no full separate idle showcase or all-angle
motion proof.

## Independently confirmed settled-contact defect

The independent calculation accumulates by bone, rather than copying the prior
analyzer's four-weight-slot einsum. For each runtime vertex it applies:

`sum(weight × boneWorld × inverseBind × bindMatrix × homogeneousPosition)`.

The mesh is attached-bind with identity bindMatrix. In world space, the current
mesh matrix and attached bind inverse cancel; adding meshWorld again would
incorrectly double-transform the result. The recorded slab is centered y898
with half-height2, so its actual top is **y900**. All offending vertices are
inside the slab's horizontal footprint.

- 10,458 runtime vertices, all 723 actual rendered telemetry rows evaluated.
- Source concatenated positions match runtime positions within 5.723e-8 m;
  maximum weight-sum error is 1.491e-8.
- 665 living rows: minimum gap **+4.000000 mm**, zero penetrations beyond1 mm.
- 58 dead rows: 34 penetrate beyond1 mm; worst gap **−41.613230 mm**.
- Actual freeze first occurs at **f639**, ragdoll age2.7845s, quietT0.5161s,
  fastest0.000543825 m/s. All **28 frozen rows f639–666** retain
  **−41.585511 mm**, with **43 offending vertices** beyond1 mm.
- Every offender is in **Volumetric connected finR**, not the central belly.
  Worst runtime vertex **9466**, part-local **292**, has weight1.0 to finR and
  world position approximately **(−1.636830, 899.958414, −5.677982)**.
- Exact zero-based runtime indices: 9343,9345,9349,9351,9352,9355,9357,9358,
  9364,9426,9429,9430,9431,9434,9441,9442,9446,9448,9456,9459,9460,9463,
  9466,9477,9480,9481,9483,9484,9485,9486,9487,9488,9489,9490,9491,
  9493,9494,9495,9496,9497,9500,9501,9503.
- Maximum difference from the previous world-contact analyzer is **1.137e-13 m**.

In the actual rendered corpse frames (m635/639/640/650/660/665), the low tilted
shape and flat fin placement remain stable. The dark feature-poor floor makes
millimetre-scale clipping difficult to judge from pixels alone; the exact depth
and offending vertices come from the recorded world-space reconstruction, not
an invented visual measurement. The render does not contradict that failure.
There is no basis to accept contact because the clipping is visually subtle.
The evidence does not identify whether the eventual remedy belongs in the rig,
corpse support/colliders or their interaction; no root lift, padding or tuning
change was attempted.

## Independent scores (out of 5)

These are distinct criteria, not an averaged acceptance score.

| Criterion | Score | Basis |
| --- | ---: | --- |
| In-engine presentation | 3.0 | Strong teal/orange/cream identity and facial silhouette; coarse pouch/fins and weak grounding, often crowded by HUD/camera. |
| Living animation | 2.5 | Real movement, fin asymmetry, bob and hit response exist; limited articulation and weak whole-body anticipation/attack separation. Cloud cadence prevents a smoothness verdict. |
| Combat readability | 2.5 | Damage/kill/Retry feedback works; active burst is visually too similar to adjacent poses, close body cropped, strong flash masks recoil. |
| Death motion/presentation | 2.0 | Complete visible rotation and settling, but edge-on/offscreen transition and squashed tilted endpoint are not convincing finished death acting. |
| Living floor contact, observed route only | 4.0 | Independently positive clearance throughout; one route does not cover all approaches, poses or terrain. |
| Settled corpse physical contact | 1.0 | Persistent measured41.586 mm fin penetration; hard acceptance failure. |
| Bounded functional lifecycle coverage | 4.5 | All requested major outcomes substantiated; diagnostic placements, sampled encoded markers and brief ordinary idle remain explicit limits. |

Hero-reference likeness is **not rescored** by this lifecycle review; prior source
ratings remain separate. Physical iPhone/Safari performance, thermal behavior,
touch feel, audio and fun are **untested**. No test-green or functional score is
converted into visual or physical approval. No score above supplies an overall
4/5 acceptance claim.

## Disposition

Keep the current public Puffer fallback and isolated candidate status unchanged.
Record the settled finR contact failure as newly established actual-runtime
evidence. Preserve the older capture as history, while replacing its “settled
death unproven” limitation with this longer capture's **settled death proven,
contact failed** result. The functional defeat/Retry and final reload-hold gaps
are now closed within this exact bounded recording. Presentation, readable
attack acting, credible corpse presentation/contact and physical-device/fun
acceptance remain open. No product, model, runtime, browser, build, Git or Site
changes were made in this review.
