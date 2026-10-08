# SF57 a1c4 retry: rehearsal refused by Pine afterPlay

**The five-minute rehearsal failed on its first Pine crossing. The thirty-minute run was not started.** Runtime pin `a1c4f02b3ecd66ba255822ecdb4b8cd22edf6ef0` includes the compressed-array fix, hidden compressed-2D registration/fencing and late compressed-upload queue. One queued preview was built, with disk and HTTP both reporting `a1c4f02-muznkv1v`, time 2026-10-08T14:50:04.350Z.

Command: `scripts/browser-lane.sh --max 12 node <archived-driver.mjs> rehearsal`. The driver verifies exact preview identity and ten frozen harness hashes, then invokes the existing soak runner through sim-lane. Developer ON, phone tier, portrait, render scale 2, mute, approved D/P/N/template subset, light c132 observer plus coalesced exact-state journal. **Raw upload tracing and call-site stacks were OFF**; the uploads file is exactly zero bytes. No extra GPU probes, source changes, manual eviction or in-drive navigation were introduced.

Cold boot and baseline completed. At **2026-10-08T15:16:41.218Z**, Pine's `afterPlay` failed with:

```
Regional runtime entry failed TypeError: undefined is not an object (evaluating 'y[0].width')
```

The same document remained connected; no context-loss event or GPU restart was observed. Pine was current, pending was empty and rings were ready, but gameplayReady stayed false. Feet were `(0.012, 0.021, 305.015)`, waypoint target `(0, 325)`. The first route timed out after its existing 150-second deadline. Native drive-phase coverage was **149.6 seconds / 150 samples**; zero fenced entries, zero completed laps. Process exit 1, functionalPass false, memoryPass false and gatePass false are preserved.

[Source attribution](source-attribution.json) records exact bundle/map SHA-256 hashes and the offline source-map candidates for the minified expression: Three 0.186 `build/three.module.js:12056` (compressed array storage) and `:12132` (compressed 2D storage), plus the length-guarded data-texture occurrence at `:12000`. These correspond to `src/renderers/webgl/WebGLTextures.js:1038` / `:1114`. **The light console observer retained String(Error), not its JS stack**: this is not an actual source-mapped failure stack, and it does not identify an exact Three texture, clone or warm-up subphase. Re-initialization after released CPU mip data is a hypothesis routed to the compressed-upload owner, sp-x4.

The last new GL texture before the error was `texture:1507`, created/labelled at **15:16:41.214Z**, owner `engine/scene`, asset `generated/Group/Mesh[3]/map/Texture`. No storage allocation followed that create/label. This is a candidate, not proof of the failed object. Its original events are retained alongside the source attribution; all surrounding allocation/tombstone events remain in the raw journal.

Truncated WC + labelled live GL peak: **717.327 MB**; loading peak **1,357.464 MB**. Maximum observed allocator accounted sum: **705.063 MB**. Separate native GPU-process drive peak: **255 MB**. These incomplete-route numbers provide **no memory-cap clearance or saving claim**. Sampling reports 176 actual observations, 41 reconstructed journal rows and no missing GL joins; reconstructed rows do not invent allocator/settled state. The cleanup grade is leakZero true; retained baseline event listeners/answerers remain visible in the unchanged raw census.

`archives.json` retains the rehearsal's **nine original UTF-8 files** in `rehearsal.json.br` (manifest, result, native/GL/journal/empty-uploads, phase, command log and exit), the exact injected fixture and the launch driver. Total compressed bytes: **120,150**. All original and archive hashes were round-trip verified. Decode using Node `brotliDecompressSync`, then JSON.parse for the `files` container. `failure.json` exposes the original failed runtime state without unpacking the archive.

G232/G233 briefly returned to needs-pick during this run (826b96c0c); the coordinator then reported Jake's real confirmation (d0da071b6). Both messages are recorded chronologically in protocol.json. This was the previously approved Developer diagnostic subset throughout, independent of public-grid opening or a visual-choice verdict. No public opening clearance is claimed.

Simulator/browser resources were explicitly released to sp-x4 (0/1 and 0/4 verified); Safari, Inspector, proxy and sampler closed. The exact archived fixture was removed and the plain preview retained for the upload owner's authorized diagnosis. No new source fix or automatic repeat was attempted. **SF57 rehearsal + thirty-minute retry remain open until the Pine entry fix**, as do full-catalogue, other-layout and road-only coverage.
