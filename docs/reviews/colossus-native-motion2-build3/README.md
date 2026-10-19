# Colossus motion2: actual corpse contact clears

2026-10-19. Bounded death articulation passes the rebuilt host's measured contact and lifecycle checks. This is not final animation, collider, visual, fun or phone-performance acceptance.

## Exact candidate and change

Product source hash: `052535ba72fa042ee5895194390d31b489123494143c27f837bafaa112bcb349`.

Native source hash remains `32c4f9b55c5303e75877c8abae7765947a3814c39bb15d3c7a0046e61cb93641`; payload remains `bfb9cd8333fb8ba2b17209a51126e26cc5c1e56a521627fc68910af86b506e46`.

Motion1's rigid corpse settled its upright root 228 mm below floor reference while the unflexed feet remained only 27 mm above the local origin. Motion2 adds death-only bilateral hip −0.4 rad, knee +0.65 rad, ankle −0.25 rad flexion. The lower chains shorten; net sole pitch stays unchanged. Static geometry, bind translations, dimensions, weights, materials, living motion, AI, strike timing, damage, colliders and engine code are unchanged. No root lift or body-axis workaround.

## Actual combat and lifecycle

All 20 combat checks and all seven lifecycle/identity checks pass. Real normal sword inputs defeat the 480-HP enemy; exposed damage is 18; reward is 35 bout-local coins; there are no post-death strikes; both Retry paths reset; defeated-player attacks stay blocked; re-entry is fresh; global, shard and browser stores remain empty and unchanged.

Four distinct actor instances and mesh UUIDs are observed. Own death arrives in state 6 on the next sampled frame: first dead frame 706, state 6 frame 707, 0.1 game seconds / 115.1 ms later. The surviving enemy after player death never enters its death state.

Ten complete windup → active → recover → idle cycles: four left sweeps, two right sweeps, four slams. Five other observed cycles are incomplete/interrupted and remain explicitly marked in the summary. No trace frames are synthesized.

## Exact full-weight world contact

The 1,080 recorded frames retain every local translation, quaternion and scale of all 22 bones and the actual mesh-world matrix, including the rigid corpse launch and landing. Analysis visits all 15,600 vertices, including all 4,384 multiweight vertices, with all four influences.

- Living minimum: +0.027000001 m
- Dead minimum: +0.018563022 m
- Frames below the −5 mm threshold: zero
- Independent NumPy quaternion/hierarchy/skin implementation versus Three.js maximum frame-minimum difference: 1.14e−13 m

The independent implementation also reproduces the preserved build2 failure: −0.201038894 m and 100 penetrating frames. Prior failures remain intact; candidate2 offline replay separately clears both prior root trajectories (+12.36 mm and +26.02 mm minima), and 1,001 dense death poses plus 305 living poses are finite and nonpenetrating. Those replays are not substituted for this actual new run.

## Limits and evidence

The corpse's upper body remains upright; this narrow correction does not deliver a finished collapse animation. The reviewed portrait corpse capture shows the modest bent legs. No art polishing was performed after the 3.65 static likeness milestone.

Cloud SwiftShader captured 134.028 wall seconds / 96.099 game seconds. Aggregate within-bout cadence is 8.046 FPS, median interval 105.3 ms, p95 258.1 ms, max 823 ms. These are software-rendering observations, not phone performance.

`closure.json` pins the complete evidence, exact host bytes, product tuple and frozen source closure. The new product and host were built into separate motion2 directories. Browser observer-v3 preserves observer-v2's diagnostic player/camera placement and normal sword input; it changes only labels and default paths. No enemy/health/clock/RNG injection. All browsers are closed and lanes released. Failed setup attempts before browser creation are retained in the logs.

The source admission flags remain false: this contact test is bounded evidence, not permission to silently mark the whole enemy accepted. Full video remains in the original capture directory; its name, bytes and SHA-256 are in the closure.
