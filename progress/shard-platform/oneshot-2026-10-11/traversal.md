# OS-F8 — vertical ladder and authored collision contract

The original isolated outpost used inclined treads. Its 0-stuck walk proves those
colliders, not vertical climbing. That original source/result is unchanged.

The SDK now declares `Ladder` through `@wildshard/sdk/modes`, read from the same
three.js hierarchy as its visible meshes and explicit collider objects. The
format's `modes.traverse` admits a bounded vertical route and upper landing.
A ladder-only shard needs no runtime binding: the normal data-host client and
real Node worker install `climb` at the existing player traversal phase.

Authored data: stable id; bottom/top feet positions; upper exit floor position;
outward horizontal unit normal; reach in metres; climb speed in metres/second.
Visible rungs/rails, solid walls, floor and deck remain explicit mesh/collider
rows. Leave the 0.76 m by 1.8 m capsule corridor clear. The ladder row grants no
floor, colliders, items, rewards or teleport. See docs/SHARDFILE.md, OS-F8.

Focused real Rapier tests cover continuous ascent onto a solid deck, descent,
ceiling collision, release, earlier traversal precedence, scope disposal, native
mid-climb restore and the real SDK worker's exact continuation. Scene declaration
round trips preserve bytes and parent transforms. No-row snapshots stay exact.
These are native gameplay/authoring proofs; no phone/rendered ladder-look claim
or conversion of the isolated outpost geometry is made.

Validation: 43 focused traversal/scene/physics/spot checks passed after the final
input-lifetime guards; the nine ladder cases and both unchanged page board
tape hashes passed. Root and composite strict plus touched root-config typed lint
pass. The actual Signal, Sky, Nine, Driftwood, Pine and Nalati witnesses/replays/
Ledger retain their outcomes (including all three honest partial refusals).
Affected Node physics/spots gameplay fields and all map inputs/pixels stay exact;
no collider geometry changed. The continuous real ladder/deck test has 0 stuck
by the 0.3 m / 120-tick ruler. No input-only witness manifests are committed.

Boundary: ladder rows require the data-only player owner (`runtime: null`).
Native/hybrid player-owner combinations refuse rather than silently dropping
a traversal. The real page reads its current admitted fixed-step command without
a second device sample or allocation; that reference clears on success/refusal.
Paused installation/client clocks release their attachment. Restoring a changed
route recipe refuses atomically. The normal HUD and existing control wires stay
unchanged.
