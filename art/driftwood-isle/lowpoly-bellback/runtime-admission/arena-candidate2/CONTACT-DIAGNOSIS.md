# Bellback corpse contact diagnosis 2

Status: measurement tools prepared; actual render capture pending. No candidate
pose, geometry, decision, collider or engine changes. Candidate1 remains unaccepted.

## Existing contract

AnimalView.startRagdoll selects `rigid` for custom capsuleAxis z, `upright`
for custom capsuleAxis y. There is no independent corpse-build declaration.
The rigid contract freely rotates one cuboid, centered at y=.6*bodyY, with
half-extents [halfWidth,.5*bodyY,max(bodyHalfLen,bodyRadius)]. Bellback's
measured core dimensions yield [.94,.600000024,.950368345], centered at
.720000029. This box tops at 1.320000052m in the root frame.

The original body joint owns both barrel and carrier. Exact bind replay shows
the tall stern plank spans y=1.530466318..3.482150316m; the crown tie reaches
3.374969482m and arches 3.336558104..3.368744373m. All remain rigidly attached
to body, regardless of bell/clapper joint poses. Thus a pose-only bell adjustment
cannot bring the carrier inside the freely rotating core cuboid. Enlarging the
living dimensions to hide this would conflate living and corpse contracts.

Existing upright corpses use a foot ball with locked rotation, but selecting
capsuleAxis y also changes the living capsule. That is not an approved corpse-only
fix. If exact capture demonstrates carrier penetration under rigid roll, an
independent explicit corpse-build setting or a properly authored corpse collision
shape requires coordinator review before any shared engine/API change.

## Measurement

scripts/qa-bellback-corpse-observer.mjs serves immutable build1, pins sourceHash
2193cde3e47ba8d17a3dcfb642cbaf3458f12bde60f39d1268d58e7ff957a87a,
and records full-body render-only observer footage and every-render mesh world
matrix, all eight bone position/quaternions, real tg clock/stage, strike phase,
gait/flinch/deathT, HP/alive and ragdoll build/state/body count. Player sword
inputs are real; diagnostic player placement is logged. Enemy state, health,
clocks and physics are not injected. Capture includes full collapse, at least
8 seconds of corpse observation, and fresh Retry. This old host predates the
PracticeCreature early applied-hit drain and must not be confused with a fresh build.

scripts/measure-bellback-world-contact.mjs pins original native JSON SHA256
32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44.
It replays exact rigid weighted vertices with world * posed hierarchy * inverse
bind, reports each joint and each original named mesh, and uses explicit floor900.
A bind-frame synthetic sanity check returns exactly zero minimum clearance.
This verifies transform reconstruction, not actual corpse contact.
