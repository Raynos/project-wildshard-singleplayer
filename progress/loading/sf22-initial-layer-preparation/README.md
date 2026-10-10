# SF22: settle initial grid presentation before shader preparation

The e0ce4c3 source-mapped driver trace found a 394 ms first-live boot task. Its
31 slow native program resolutions cover road, home terrain/props, skinned actors
and effects. Warm and live programs have the same point-light count (one), but
warm-up has no home PMREM; the ordinary first layered frame supplies it and changes
the program keys. This is an environment ordering problem, not evidence for adding
lights or pinning a larger pool.

After composer construction, boot now publishes the existing GridSession
presentation frame and applies the current SkyRig layer weights before collecting
shader jobs. `prepareLayers()` uses zero delta without advancing cloud time,
simulation or alternating-cascade cadence. The ordinary frame still restores and
reapplies those slots. The grid frame installs the existing grade/effects through
its existing feet-based owner law. No material, pixel rule, light count, grade,
shadow law or variant changes.

Four focused files, 23 tests pass, including exact layer environment/light state
against the ordinary zero-delta application, repeated preparation, owner weight
zero, unchanged clocks/cascade cadence, and the real grid frame's road weights.
Touched typed lint and strict checking against committed public package exports
pass. No new import edge, collider, map or witness payload change.

Browser re-measurement remains open. The source fix is not a measured boot-time
pass. Signal's 54.3 ms native upload is now before entry but still exceeds the
50 ms loading-task budget; audio and fingerprint owners remain open too. See
the material-readiness receipt for the preceding run and its raw evidence hash.
