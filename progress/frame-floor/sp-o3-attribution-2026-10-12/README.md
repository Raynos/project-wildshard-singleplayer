# Simulator travel misses: GPU-side attribution (sp-o3, 2026-10-12)

These are diagnostics, with no timing credit. The build pin is `c661d98f2`, with Developer grid, DEVSERVER, build
pacing ON, Auto fps and 2× scale. The milestone baseline is `c66b5b324`
([summary](../milestone-c66b5b324-2026-10-11/README.md)).

## Discriminator: WebKit Timeline gives no timings on the Simulator

WebKit's Timeline reports `startTime` / `endTime` = 0 for every record when it is read through `ios_webkit_debug_proxy`
on the Simulator. `recordingStarted` is also 0. I probed six setups and all of them failed:
- plain `Timeline.start`;
- `Timeline.enable`;
- `Inspector.enable` + `initialized`;
- `Debugger.enable`;
- `ScriptProfiler.startTracking`;
- `setInstruments` + `setAutoCaptureEnabled`.

ScriptProfiler showed the same zero-clock fault earlier. `scripts/frame-floor-webkit-timeline.mjs` (`cb32a58e2`,
wired in `6d20db071`) therefore marks every frame **unproven**: it reports zero timestamps, 2,367 spans with no
duration and no coverage. It does not label any of that time idle.

The idle-versus-task split has to come from in-page clocks, through sp-x1's `--frame-timeline` and a task clock.

## Pine road entry: the 120-frame travel window, Simulator

Travel p95 was 59 ms and the drive max 553 ms. sp-o5's browsers overlapped this run, so the timing numbers are void.
The GL attribution below still stands.

`c661d98f2` keeps each long frame's start-frame GL (`glStart`). The GL take falls at the end of each interval, so the
render that caused a gap used to be booked on the interval before it.

What the long frames break down to:

- **37896 (170 ms).** One drawn frame spent 162 ms rendering. That render compiled **9 programs**: 18 `compileShader`,
  9 `linkProgram`, and 9 `getProgramInfoLog` totalling 148 ms. The programs were:
  - `grid-road-solid`
  - `ridge0` (page horizon)
  - three MeshLambert variants
  - two MeshStandard variants
  - one MeshBasic variant

  This happened in the `world` hook. The page's own visible materials were recompiled at draw time. Some program-key
  input changed for the whole scene during construction, before or outside `warmEnteredFrame`. My lead is the light
  count, which is in every program's key: lights added to the root while unparked. **This is the next owned fix.**
- **37458 (80 ms).** A 44 ms `getProgramParameter` on a ShaderMaterial ran between frames, in the preparation's
  settle task. That is a synchronous wait on the GPU process (a Metal library build).
- **Ten other travel frames (51–71 ms).** Start-frame work was 2–7 ms, GL was about 0, and the sampler callback delay
  was 3–5 ms. The rAF timestamp itself arrived late. Without timeline clocks this cannot be split into JS tasks versus
  display backpressure.
- **Entry preparation stages:**

  | Stage | Time | Units |
  | --- | ---: | ---: |
  | compile | 5.5 s | 652 |
  | link | 0.37 s | 11 |
  | upload | 2.2 s | 205 |
  | shaders-and-composer | 8.2 s | — |
  | parked draws | 1.9 s | 251 |

## Pine desktop

The `6d20db071` run (gl-time and timeline, no trace) had one 1,616 ms gap. It came from a 1,471 ms render: a
`bufferData` blocked on the GPU process (sp-x1's sampler data). It also had a 400 ms frame from a draw-time
`texSubImage2D` of two 1024² ImageBitmaps (200 ms) in `afterKit`.

The `c661d98f2` re-run, with `--gpu-trace`, did not reproduce the 1.6 s stall. Its maximum was 83 ms. Long
between-hook frames show the renderer in `CommandBufferProxyImpl::WaitForToken` (43 ms) on `bufferData`,
`multiDrawElementsWEBGL` and `texSubImage2D`. Meanwhile the GPU main thread runs `CommandBufferService:PutChanged`
for 56 ms. That is GPU-process backpressure from uploads.

## Sunscar interior: the 46 ms row no longer reproduces

This run was clean (after sp-o5's browsers stopped). On `c661d98f2` the interior is **p95 34 / max 34**, where
`c66b5b324` had 46 / 53. Travel is 37 / 94 (was 52 / 117). Drive is 34 / 238; its maximum is in `afterPlay`.

`--gpu-bisect` measured the interior with 23 single-feature variants. Each of these was switched off on its own:
- the post chain;
- FXAA;
- the shadow update;
- the region;
- each subtree.

Every variant held p95 34 ms and a 33.3 ms mean. The interior has no GPU-bound miss left to attribute.
