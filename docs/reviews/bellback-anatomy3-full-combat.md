# Bellback anatomy3: full attacks pass; rolled corpse fails contact

2026-10-19. Runtime-unaccepted WIP. This is a new actual isolated capture of the
unchanged anatomy3 product and its exact already-built host. The previous scoped
contact pass remains valid for its original capture; it is not general contact
acceptance across different falls.

## Result

23 of 24 runner checks pass. The sole runner failure is incomplete coverage of
unhit approach-stop-resume, not a demonstrated gameplay defect. Independent
post-capture geometry reveals a separate, important failure: the corpse rolls and
18 observed frames penetrate ground, reaching −0.856456 m. No model, animation,
AI, clocks, damage values, shared engine, physics or product bytes were changed.

Exact product: `1f6d7ce33de9e3f2113fe632ac65c252ceb8953b6b9e0720f40357b268fb1bf3`.
Built host PracticeCreature pin: `ee97d17f4e90e7a74454055baefa167006122cd2299b5e614d8ce63603906dec`.
All186 existing build-file hashes and byte counts verified before browser launch.
Existing app: `tmp/bellback-tucked-preview-dist-build1`.
Source and old build closures remain unchanged. This is not evidence for an
unbuilt current working-tree host.

## Actual combat evidence

- Pulse: windup frames48–59, active60, recover61–63; echo follows uninterrupted.
- Echo: windup65–73, active74–75, recover76–82, then idle84–97.
- Stomp: windup98–107, active108, recover109–116, then idle120 onward.
- Player HP100→70 in this uninterrupted attack sequence. No attacks from the player
  occur during those completed windows. Close player placement after echo/idle
  makes stomp eligible; enemy behavior/state is never injected.
- One sword hit interrupts pulse tell at227; stagger lasts227–244; idle returns245;
  next pulse begins258 and reaches active271. Enemy HP180→168.
- Later repeated normal sword inputs defeat the enemy, yield12 practice-local
  coins, and show no post-death strike. Retry resets enemy180/player100/coins0.
- Another actual bout ends in player defeat. A subsequent attack input does not
  damage the living enemy. Retry and page reload start clean bouts.
- Local/session storage stay empty; state-store snapshots stay empty and unchanged.
- Keyboard retreat produces real player motion and enemy approach. The separate
  diagnostic move/stop/resume segment ended before the full pulse/echo cooldown,
  so its resume assertion remains false. Recovery after the single interrupted
  hit does include renewed approach, but does not replace that missing unhit test.

## Contact failure and limits

778 full-body render observations retain all8 bones, mesh world matrices, state
clock, strike phase, player HP/position and scenario labels. The independent NumPy
reconstruction validates unit rigid weights and quaternions, and agrees with the
Three.js reconstruction exactly (maximum difference0).

At frame449/game40.9027s, the lowest vertex is body vertex4637, Tall stern plank,
world position[-4.357791792,899.143544315,-16.194866789], 0.856456m below groundY900.
This is not feet-only: Barrel timber hull reaches−0.404207m; bell−0.149966m;
hind legs−0.242949/−0.290626m. Front legs and head remain above ground. At this
frame2377 vertices are below−5mm,1588 belonging to the body joint. The entire
Tall stern plank is below ground (its highest vertex is−0.054951m).

Captured root[-3.795453804,901.119420654,-13.332598198]; world quaternion
[-0.751828983,0.039924637,0.045717385,0.656558546]; scale approximately[1,1,1].
Ragdoll is rigid, one body, still live. All40 dead observations precede a frozen
settle; this run retries shortly after reward and does not establish final rest.
An earlier transient at frame413 also penetrates−0.065947m before the late roll.

The camera is offset during rendering only, with the viewmodel hidden. Diagnostic
player repositioning is explicitly logged. This is real simulation with diagnostic
view/placement, not ordinary first-person play. The video is402×874,25 encoded fps,
125.72seconds;778 observations span116.225 wall seconds, about6.69 actual observed
renders/sec. Coarse cloud cadence limits pose smoothness and transient judgments.
No physical-phone, fun, full-video independent visual review or quality acceptance.

## Evidence and next action

Ordinary screened evidence is under
`art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3/full-combat1/`.
The manifest pins new runner/analyzer sources, all evidence, prior closures and raw
video. The complete original world-contact JSON is retained as one native Site
source file, identified in world-contact-location.json. Raw WebM remains in its
ignored capture directory, pinned by SHA/bytes.
Entry, completed attack, corpse, and extracted roll-context images were inspected.
Extracted video contexts are labeled by the captured live frame overlay, not claimed
as exact worst-frame stills.

Prioritize the rolled-body collision/contact mismatch before further quality claims.
Do not discard the old scoped pass or silently alter physics/model to satisfy this
capture. A prepared, unrun supplemental runner uses only keyboard retreat and waits
through the full enemy cooldown: `scripts/qa-bellback-natural-approach.mjs`.
Run it only in the assigned browser lane, with the same existing app and product pin.

## Bounded collider-contract recommendation

The measured carrier/core failure supports evaluating the proposed generic optional
`rigidCorpseBox` without changing living dimensions. It does not justify shipping
an enclosing box on vertex containment alone. A sampled union of both corpse traces
and their last living poses (187observations, not dense clip admission) needs center
[-0.012313467,1.741075158,0.123132088] and half-extents
[1.902296704,1.741075158,1.713353970]. At unchanged observed orientations, the gap
between the enclosing box's lowest corner and the actual mesh minimum reaches
1.198268m during the older fall; it is0.122488m at the old frozen settle and0.068814m
at new worst frame449. These vertical support-gap calculations are not predictions
of orientation under a newly simulated collider.

A fixed generous box is therefore a bounded first experiment with a real floating
risk. A measured convex hull or bounded compound is likely needed if it cannot
meet visible support/contact gates, and needs separate reviewed scope. Do not
alter bodyY, inflate living melee bounds, change anatomy to hide the problem, or
expand automatically from a box trial to compound contact. This task implements
no collider contract or physics changes.
