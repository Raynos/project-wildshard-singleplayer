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

The matched diagnostic on f39297f33 reduced the first-live task from 394 to
69 ms. It is still not a loading-budget pass: an earlier 175 ms preparation task
contains a 162.5 ms native `getProgramInfoLog` call; the harness fingerprint costs
134 ms and audio construction 111 ms. Signal's book upload was 40.7 ms before
activation in this run; the preceding 54.3 ms upload remains an open budget gap.

Five of six shaped-network routes completed. The Signal → Driftwood return
refused with graphics error 1281 after a compressed upload, then its cleanup
threw “Regional construction requires a live resident and owner”. Nalati later
reported the same graphics message. 37808 is the ASTC 4×4 format, not a texture
identity: these messages do not establish one shared texture, nor that initTexture
originated the GL error (getError was only checked afterward). Resource attribution
and a run without the extra upload/program-query diagnostics remain open.

The cleanup failure is independently reproduced and fixed: construction restoration
now belongs to the runtime child, which can retire while its resident parent lives.
A real factory regression fails before the fix with an aggregate cleanup error,
then preserves the exact original upload refusal and permits a subsequent honest
retry. Four focused files / 42 tests, touched typed lint, and strict checking of
committed HEAD plus the two owned hunks pass. No import, collider or witness change.

This attempt is a completed FAIL, not a six-route pass. Route median machine loads
were 19.72, 12.76, 9.58, 8.46 and 6.77 for the five completed routes; the first is
under load (>15). Evidence SHA-256:
`79685f1385a84e8cd1017b5bb862e3a9da9dd8193ab0c80b516a7009d8b978ef`.
Raw evidence stays in the lane scratchpad, not git.


## Enabled zero-threshold bloom preparation

The slow boot program is `LuminanceMaterial`, first drawn by the bloom update in
`Game.firstFrame`. The preparation inventory incorrectly inferred that every
luminance material without `THRESHOLD` was idle. The grid's ordinary effect law can
set threshold and smoothing to zero; its enabled bloom luminance pass still draws.
A real BloomEffect/EffectPass inventory regression fails before the correction.

Preparation now skips inactive tone adaptation by the actual ToneMappingEffect
mode, and skips disabled passes, while retaining enabled zero-threshold bloom.
Adaptive mode's real luminance/adaptation materials remain admitted too. Materials,
defines, target sizes, uniforms and draw behaviour are unchanged; only the program
inventory prepared before first draw changes. Seven focused preparation files /
29 tests, strict checking against committed HEAD plus owned hunks, and touched
lint pass. No new public API or workspace import edge. Browser timing improvement
for this inventory correction remains unmeasured.
