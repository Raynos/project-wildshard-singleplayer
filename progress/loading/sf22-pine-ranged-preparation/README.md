# SF22: prepare Pine's empty ranged effect pool before entry

Pine's entered-only weapon listeners previously created the camera/debris resources
at entry, after shader preparation. The real empty coloured InstancedMesh then
compiled its MeshBasicMaterial variant during the first visible update.

`prepareRangedFeel(game)` now creates those same inert resources before preparation
and returns the entered listener binder. Pine binds it through the existing entered
service; the regional update registration also remains entered-only. Ordinary
`installRangedFeel` callers keep immediate prepare-and-bind behavior. No particle,
material, camera, hit-stop, RNG or event-delivery law changed.

Two new tests prove the real debris variant is available to `sceneJobs` before
listeners, two re-entries leave no parked listener or duplicate pool, and an actual
seeded wood impact produces exactly the same count, matrices and colours as the
immediate installer. Nine focused tests (including camera ownership and trusted
physics freshness/reconstruction), strict source projection and touched root-config
typed lint passed. The shared checkout had unrelated stale package exports; the
focused projection contains committed exports, not those foreign hunks.

## Actual native bake

Diagnostic candidate `095afb6e5ebc26f4b1f9a4d4f9920e0c54860392`, muted Metal Chromium,
iPhone 16 Pro / phone / DPR2. The actual clean-export browser bake captured twice
with exact equality: 164 native bodies, 918 trees, 2078 solid world colliders,
50 registry pieces and the 255×255 native heightfield. All collider/actor/placement
payload bytes remain identical to HEAD excluding `inputs`, `revision` and `build`.
The only changed input hash is `combat/chargeTells.ts`. No input-only witness
manifest was edited; the serialized pusher owns that refresh. No map input changed.

First-entry latency is not claimed yet: the next matched shaped-network route
measures this slice together with Nalati's offscreen preparation. No new graph edge.
No browser or preview remains.
