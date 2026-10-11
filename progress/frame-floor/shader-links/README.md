# Shader-link preparation: bounded work, floor still incomplete

Source `64a9b48a9` separates live WebKit compile jobs, waits for KHR completion before first use,
settles one program per drawn frame, and remembers resolved identities weakly. Shader diagnostics,
GLSL, materials, lighting, render scale and ordinary boot/desktop batching are preserved. A material
can issue two side variants; one native query can still overshoot.

Matched builds: `adab6caa893179616ad441caa9676b99c6177b3f` before and isolated child
`734f86ea24fcd2bdd94575f79f5510af9ce3d3dd` after. Developer ON, buildPacing ON, render scale 2,
FPS Auto, seed 357; DEVSERVER includes Nine. Safari is portrait iPhone; desktop is Chromium/ANGLE
Metal. All routes entered their real destination and had zero game/context-loss errors.
Timing rows have GL timing and CPU profiling OFF. Values are whole-drive p95 / max milliseconds.

| Cell | Simulator before | Simulator after | Desktop before | Desktop after |
| --- | ---: | ---: | ---: | ---: |
| Nalati | 46 / 86 | 38 / 89 | 16.8 / 66.6 | 33.2 / 50 |
| Sky Reach | 39 / 2056 | 36 / 79 | 16.8 / 66.6 | 16.8 / 49.9 |
| Nine Dragon | 34 / 384 | 34 / 152 | 16.8 / 66.7 | 16.8 / 66.7 |
| template-2 | 34 / 62 | 34 / 77 | 16.7 / 16.8 | 16.7 / 16.8 |

**This does not close the 33 ms target.** Nalati and Sky still miss the operational Simulator p95
floor too. Their remaining long frames are world/kit/play/activation work; Nine's maximum is world
construction. Template has between-hook frames. Median FPS is 30.303 on Simulator and 59.88 on
desktop throughout. No quality or resolution reduction was used.

**Cost:** Nalati's crossing/preparation grows 13.430 → 23.142 s; afterPlay grows 8.564 → 18.073 s.
Sky is 10.480 → 11.138 s, Nine 45.409 → 45.042 s, template 3.084 → 3.152 s. Whole-drive percentiles
include the extra waiting frames, so their improvement alone is not evidence of cheaper individual
queries. The large Sky/Nine spikes remain in the baseline, without claiming each was solely a link.

The Nalati desktop regression prompted one additional matched control: before **33.3 / 66.6**,
after **16.8 / 66.7**, both about 5.15 s. Both original rows are retained. P95 varies on both arms;
there is no consistent regression, but Nalati is not an unconditional desktop floor pass. Desktop
afterPlay stays about 1.7 s. Other desktop rows are unchanged or better.

## Which programs, and where

Separate `--gl-time` captures on both surfaces, plus desktop `--cpu-profile` and emitted source maps,
identify these slow queries. These captures have **no timing credit**. Listed durations are single
slow calls; the JSON preserves every recorded slow program variant, duration and call count.

| Cell | Material/program variant | Observed hook | Slow query |
| --- | --- | --- | ---: |
| Nalati | EffectMaterial `5c8883d/e15f8ac0` | between hooks | Simulator info log 30 ms |
| Nalati | anonymous normal/shadow variant `cc314b/51187d19` | afterPlay | Simulator info log 19 ms; desktop status 17 ms |
| Nalati | nalati-viewmodel, nalati-steel | afterKit | desktop info logs 8.8 / 8.3 ms |
| Sky | EffectMaterial; MeshStandardMaterial `4f62ca61/5cacb000` | play / afterPlay / between hooks | desktop 5.4 / 4.9 ms; Simulator post 6 ms |
| Nine | NdReflectTrace `c5bb3546/d0ccf830`; EffectMaterial | between hooks | desktop reflection 38.6 ms; Simulator post 9 ms |
| template | family:pbr variants | between hooks | desktop 14 ms; Simulator 10 ms |

The early Nalati reader incorrectly consumed the next define after an empty SHADER_NAME. Its
fingerprints are preserved; the exact material type for that anonymous variant is unavailable.
`89f182a7f`, `32feeb68b`, `b9855c896` correct the opt-in reader and use SHADER_TYPE as the fallback.
Ordinary game and non-GL-time harness paths are unchanged.

Source-map stacks confirm first use in `getUniforms → runPrecompileWork`, parked draws, the live
world/composer draw, and Nine's reflection ShaderPass. Sampled inclusive query time includes Nalati
34.455 ms in the composer path, 28.861 ms in completion polling, 22.337 ms in parked rendering and
19.410 ms in uniform resolution; Nine has 44.340 ms in the reflection/pass path. These are sampled
stack totals, not additional frame durations. Late compositor/reflection links remain identifiable;
the patch does not claim to remove every first-use query.

Quiet timing windows were released after each surface. One-minute load averages before the four
Simulator rows were 4.89, 10.09, 13.85, 9.77; desktop 6.57, 6.93, 5.75, 5.38. The reciprocal Nalati
desktop control and attribution captures are retained separately in the summary. The attribution
window immediately followed that control; it is diagnostic only.

The earlier separate poll/resolve candidate `c17ae0eda` was rejected for preparation latency. Its
Nalati sample also overlapped an automatic-push retry and is excluded from quiet credit. All four
exploratory rows are summarized. One diagnostic launch was rejected before browser startup for an
absent profile directory; it was corrected. No failed gameplay sample was replaced.

Validation: 35 focused precompile/owner/material/entered-frame checks, root strict, touched typed
lint. The opt-in program-name fixture also passes. Raw profiles/captures stay out of git; see
[summary.json](summary.json) for the compact measurements. No memory or physical-device claim.
