# Nine Simulator route after fa33af75d (sp-o118, 2026-10-13)

What `fa33af75d` (perf(nine): shrink spill and glyph atlas work) did to the iOS Simulator road entry into Nine. Each
build is a clean `--rev` DEVSERVER preview, measured with
`node scripts/frame-floor.mjs --shards=grid --grid-scenario=milestone --devserver --grid-routes=nine-dragon-stack-road-entry --surface=sim --rev=<sha>`
(the route is named `nine-dragon-stack-road-entry`; `--grid-routes=nine-dragon-stack` is refused as a missing route).
The numbers are in `summary.json`.

| build | travel p95 / max (ms) | whole drive p95 / max (ms) | > 50 ms frames | pass |
|---|---|---|---|---|
| before `d6e957e42` (= fa33af75d^, has 77bfbba70) run 1* | 34 / 88 | 34 / 88 | 4 | yes |
| before run 2 | 34 / 88 | 34 / 98 | 3 | yes |
| after `fa33af75d` run 1 | 34 / 88 | 34 / 96 | 5 | yes |
| after run 2 | 34 / 99 | 34 / 106 | 3 | yes |
| after, Safari profile (diagnostic, no credit) | 36 / 86 | 36 / 102 | 6 | no (p95) |
| HEAD `a629653cd` (near tier on for everyone) run 1 | 41 / 93 | 34 / 196 | 5 | no (travel p95) |
| HEAD run 2 | 34 / 84 | 34 / 84 | 5 | yes |
| desktop, after `fa33af75d` | 16.8 / 33.3 | 16.8 / 50 | 0 | yes |

\* A 40 s parity browser overlapped the start of before run 1.

**Verdict.** Simulator travel p95 sits on the 30 fps cadence floor (34 ms) both before and after: no measurable change.
The longest frames are about the same (88–106 ms against 88–98 ms) and stay well inside the 200 ms gate. That fits the
commit: its cut work was already spread across build slices, and the slice length decides the frame, not the total work.
sp-o112's 34/42/34/38 ms baseline came on a busier machine. HEAD run 1's 41 ms travel p95 and 196 ms `activate` frame
did not come back in HEAD run 2 (34 / 84). It was the first run of the session, with machine load at about 30.

**Parity.** `scripts/proof-nine-layout-parity.mjs` on `d6e957e` against `fa33af7`: identical on 6 poses (phone and
desktop: pixels, draws, triangles), GPU bytes, colliders and programs; CPU backing bytes did not rise.
**Witnesses.** In a clean export of `313de0199`, whose Nine sources are the same as `fa33af75d`:
`test/proof/nine-dragon-stack/` passes 7 of 7 (headless, replay, ledger, checkpoints, grid-ready). The glyph-field and
vertex-spill oracles pass 8 of 8.

**What is left in Nine's world hook** comes from the Safari sampling profile of the whole road-entry drive: 3,499 JSC
samples at about 1 ms each, so a sample count is roughly ms of main-thread JS. The vertexSpill bake is 463 (300 self) and
the WholeGeometryAssembler tile reads (`game/plugin/geometry.ts`) are 318. Then come glyphField prepare 145 (81 in
`fillText` / `getImageData`), layoutBake prepare/copy 112, kitConvert + sweptKit 84, lightVolume 60 and paintArray 31.
Outside the hook: engine precompile 171 (57 in texture uploads), grid cellScreen 165 (91 in `texSubImage2D`) and
compressedUpload 142. Each of the long frames (60–106 ms) falls in `world`, `activate` or `constructor`, one to three
per hook. The spill bake (19.4 M light-vertex pairs) is still the biggest single owner.
