# SF72 Driftwood canonical gameplay witness (E435)

Step 1: a2fd4265f (night ecology); step 2: 734a516e4 (swords/dodge/lunge).
Step 3 uses the actual renderer-free runtime, native 2067 fixed colliders/256² heightfield, real dynamic puzzle barrel,
native finite actors and Captain. No page/model/map inputs changed; graph rises zero.

Continuous player-input tape: 22,794 ticks, Captain mid-fight tick 21,878 at 190/320 HP, reward tick 22,660.
Original continuous play and its mid-fight fork compare exactly through 916 suffix ticks; the SDK worker's first
60 suffix ticks compare exact too. Canonical native state replaces Rapier serialization byte order.
The recorded profile is granted only from native gameplay effects: castaway, all three shards, sailor and quest
achievements earned; four glass and five crab grants remain partial. The duplicate quest emission grants once.
Freshness fences actual loaded modules, native physics, the exact command tape and four committed checkpoints.

The headless nav's baked points already include world height, so its datum is 0 (no active page-level lookup).
Sailor rise/sink/deck smoothing copied to the trusted body callback under a shipping-source hash oracle; the native
10k 30/60-Hz/restore oracle runs the actual shipping lines. Extraction would alter the browser physics-bake input.
Visual/rig work stays in animateSailor, unchanged.

Validation: root strict and every touched typed-lint check pass; the 9 scoped gameplay/oracle tests also pass
under coverage (56.95 s). The source oracle alone takes 4.166 s under coverage against its unchanged 15 s deadline.
The first full clean run passed 5,889 tests with one stale aggregate compatibility consumer; it expected the old
zero-tick refusal and used Node strip-only mode. The consumer now compares two real 10k slices using the same
native runner, keeps compatible=false, and its seven-test file passes. The complete corrected rerun1069 passed: 1,068 files /5,890 tests /14 skipped in104.20 s (104.81 s lane).

Browser diagnostic 28922ee01fc633839225bbf62ea0639616006137: standalone and Developer grid boot 2/2,
zero faults/fatals; standalone gameplay 3.961 s, grid gameplay 12.320 s. Portrait iPhone 16 Pro profile, muted,
wrapped browser lane. Real phone-tier walk: 8/8 legs, zero stuck, including bridge and boat; walkErrors empty.
See boot.json and walk.json (walk frame traces omitted, every outcome retained). Old expectY values do not include
the current WORLD_DROP, so this proves zero stuck, not identical historical endpoint heights.
All owned browsers closed and preview :4401 stopped. No Simulator used. No page/model/map changes or graph rise.
Whole-shard compatibility remains false with the explicit open list in test/proof/driftwood-isle/compatibility.json.
