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


## Matched cleanup rerun and Safari Auto subset

On f2a6921fb, desktop again completed five real-input shaped-network routes before
the Signal → Driftwood return timed out. Upload refusal 1281 was first named
`nalati-cards`, then an unnamed ASTC-format texture at Driftwood. Extra native
upload/program-query wrappers were absent; no page exception followed cleanup.
The upload cause is still open. Desktop evidence SHA-256:
`0d2013c60915ac2e4ffb33fd52b52b715594ebebfa2e4b923a1a647feccbb48e`.

The same build's iOS Simulator Safari Auto subset completed Driftwood → Signal →
Driftwood: four crossings, zero refusals/errors. Activation costs were 2.3 / 2.0 ms;
entry commits 0.28 / 0.24 ms. Driftwood departure was 36.92 ms (checkpoint 0.94 ms,
commit 0.48 ms, remainder 35.5 ms), so the unchanged 33 ms install gate FAILS.
Signal departure was 7.30 ms. Demand waits were 3.82 / 3.30 / 3.08 / 18.62 ms.
Drawn-frame p95 was 61 ms, p99 102 ms: cadence FAILS. Both routes were under heavy
machine load (medians 130.08 and 126.08; range 123.83–131.17). These are valid
under-load observations, not an isolated performance verdict. Safari longtask
observation is unavailable; it is not credited as zero. This subset proves no
all-G270 or phone-memory pass; phone memory remains G269. Safari evidence SHA-256:
`b2ad3b8bea16b128767bdbb8bad19ee8dc5c8deced477982f7beee0991fd307b`.
Both browsers, Safari/Inspector/proxy, Simulator and preview closed in finally.


## Disposed borrowed uploads

The 005c04b44 diagnostic repeated the return refusal. Chromium's native warnings
preceded the compressed upload fence: `texSubImage2D: no canvas`, then
`texStorage2D: One or more image dimensions are not positive` and invalid mip
creation. The captured ASTC uploads have intact 512 → 1 mip chains. The fence
observes an existing GL error; its texture name alone does not identify its origin.
Diagnostic evidence SHA-256:
`ec2bf619514d4eb407604d127fee43e36b46c0295acfdf6a65059c962a2e3d99`.
The bounded mutation ring adds no GL reads or error drains; these timing samples
are diagnostic only. All resources closed.

Sliced preparation borrowed a texture inventory across paints without observing
sibling disposal. Grid loading cards remove their meshes, dispose their textures
and zero their canvases on slot retirement. Preparation could then upload that
retired snapshot. It now observes texture disposal under a temporary page child
scope, skips retired inventory entries, and cancels a retired compressed entry
inside its queued paint fence. A live neighbour, its material draws, and strict
faults on live textures remain unchanged. Listeners are removed on all exits.

Two regressions prove a retired 1024 × 640 CanvasTexture is not revived after the
compile yield, and an in-flight retired compressed texture does not upload or
cancel the surviving texture. Five focused files / 51 tests, strict committed
HEAD + own hunks, and touched lint pass. No new public API, import edge, collider,
input manifest, or visual change. Native error clearance and performance remain
pending the quiet matched desktop/Safari run; this is not a pass receipt.


## Quiet normative run on 5ee864810

The matched Chromium phone-tier G270 circuit PASS: all six real-input routes
completed at 5 Mbit/s with the unchanged 3 / 10 s stalls, zero refusals, page errors,
or native WebGL warnings. In particular, the return no longer reports invalid
canvas uploads or the subsequent 1281 compressed-upload refusal. This run has no
extra GL mutation wrappers, program-query wrappers, or error drains.

| Crossing owner | Departure synchronous ms | Entry synchronous ms |
| --- | ---: | ---: |
| Driftwood → Pine | 17.7 | 0.2 |
| Pine → Nalati | 16.8 | 0.1 |
| Nalati → Template 1 | 15.2 | 0.1 |
| Template 1 → Sky Reach | 30.1 | 0.1 |
| Sky Reach → Signal Dunes | 13.9 | 0.1 |
| Signal Dunes → Driftwood | 5.7 | 0.0 |

The largest demand wait is 3.5 ms; the largest activation is 3.5 ms. The maximum
30.1 ms departure includes a 29.6 ms template checkpoint and stays below 33 ms.
Drawn-frame p95 is 33.4 ms, exactly the same session's standing p95 (33.4 ms);
p99 is 33.5 ms. The measured timestamp quantum is 0.1 ms: this passes the explicit
same-session resolution rule, with the raw figures retained. No draw-time, driver,
or unclassified compilation occurred. There were 1,876 explicit compileShader
warm-up calls in 556 renderer.compile invocations; the largest invocation is
7.4 ms. None overlaps an observed >50 ms task, so its observed task upper bound
is 50 ms, not an invented exact zero. The first crossroads window has zero
compilation calls of any class.

Route one-minute load medians are 5.35 / 4.74 / 4.57 / 3.40 / 2.54 / 2.71
(range 2.46–6.35). The owned quiet marker ran 09:15:27–09:32:35 UTC on
2026-10-10, below its 25-minute ceiling, and was removed in finally. The preview,
browsers, Simulator, Inspector and proxy also closed. Desktop evidence SHA-256:
`b2a1bbf2f992e10208a636837478e6b5f02d26fb61e913a2b118169bd35ced67`.

The same-pin Simulator Safari Auto Driftwood/Signal subset is a completed FAIL
before measurement: public home never became grid-ready, final grid state is
null, and no route, crossing, activation or drawn-frame sample exists. Auto chose
images because Driftwood's KTX2 set was not cached. No page error was captured;
that does not establish the missing boot cause. Its load median is 5.81
(range 4.68–18.76). No Simulator cadence/install pass is claimed. Evidence SHA-256:
`631fc736ec9e4439606c2a3b00ccdd5ad572fea4cb4b0d92a80f63ad40261ec1`.
The Simulator subset still needs a boot-diagnosed run. Phone memory remains G269.

This closes the disposed-inventory native GL fault and the desktop SF22 gates,
not the loading budget: the initial boot still contains a 129 ms task, and a
208 ms route task outside the measured crossing install remains open. Raw evidence
stays in the lane scratchpad; only this summary is committed.
