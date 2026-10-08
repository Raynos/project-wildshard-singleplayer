# G226 retained asset and composer ledger (E435 / E452)

Pinned **d739e3149**, build `d739e31-muz5vjpf`: **lifecycle/accounting PASS in 99.89 s**.
One muted Metal Chromium iPhone 16 Pro portrait browser drove Driftwood → Pine → Nalati → rebuilt Driftwood.
All three held-input route witnesses passed (six fixed-step transfers, one opaque runtime at a time, source retirement
before destination construction). No crossing navigation. Real saved creature HP: sailor 59, boar 99, wolf 54;
rebuilt home sailor HP 59. Same-document final unload: **0 bodies, 0 colliders, every level-scope census field 0,
0 page/console/disposal errors**. Four native listeners are Playwright's; events return to the 7-listener/5-answerer baseline.
Browser and preview closed.

| Stop | Model playing MB | Model loading MB | Raw GL MB | Composer GL / claim MB |
| --- | ---: | ---: | ---: | ---: |
| Driftwood first | 933.331 | 1013.331 | 206.084 | 40.830 / 40.830 |
| Pine | 1155.117 | 1235.117 | 263.345 | 40.830 / 40.830 |
| Nalati | 1179.177 | 1259.177 | 321.391 | 40.830 / 40.830 |
| Driftwood rebuilt | 1044.591 | 1124.591 | 275.497 | 40.830 / 40.830 |

**Not a memory-cap or SF57 pass.** Developer permits the over-cap stops; public admission stays strict. These are
allocator model totals, not WebContent footprint readings. The continuous Simulator soak and content/residency reductions
remain open. The cache bridge exposes retained costs; it does not reduce their footprint.

Final retained GL is **54,135,336 B = 13,140,576 B composer + 40,994,760 B caches**. The surviving composer claim is
exactly **13,140,576 B**. All cache claims are effective commons, with **no sim claims / no remaining coverage**:
GPU reservations **54,019,164 B**, CPU backing-store reservations **45,630,588 B**, each allocation identity charged once.
There is **no aggregate uncharged retained GPU gap**; conservative GPU reservations exceed currently uploaded cache GL
by **13,024,404 B**. Reservations include retained geometry capacity not currently uploaded; CPU reservations are not a
measurement of garbage-collected JS heap. Shared CPU backing stores, attributes and texture source/sampler identities
are deduplicated by the bridge fixtures. Compressed mip payloads use actual block bytes, with array layers counted once.

The composer calibrated credit is **13,140,576 B**, leaving engineBase **286,859,424 B**; baseline remains 300 MB.
During play, native target textures/renderbuffers total **40,829,808 B**, including legitimate luminance/downsample/upsample
auxiliary targets. The additional **27,689,232 B** is charged explicitly. After unload those auxiliary targets retire and
the guarded disposal observer updates the page claim to the surviving 13,140,576 B. Final model playing is 490,611,225 B
(including the existing 80 MB overlap allowance), not an assertion that all renderer-owned caches disappeared.

Correction to the `41097c02c` commit-body diagnosis: the earlier `ee87b56d0` browser failure was a **stale post-unload
composer claim**, not evidence that sampled textures inflated its playing reading. Its actual playing post-target sum
also was 40,829,808 B. The sampled-texture exclusion is an additional ownership guard proven by the unit fixture.
The failed raw witness is preserved in `diagnostic-ee87b56d0.json.gz`; its verdict is not rewritten. An interrupted
41097 scratch run stopped for the coordinator's quiet window and is discarded as a verdict.

Source commits: `6dc8abbac` allocator exact-once coverage/calibration; `479122378` honest ledger contract;
`ee87b56d0` AssetService/composer bridge; `41097c02c` post-retirement refresh and target-only guard. Full clean-export
Vitest: **845 files / 4996 tests PASS (84.14 s)**; strict TypeScript and scoped typed lint green. Tests cover native handle
dedup, released attachments, sampled texture exclusion, three owner lifetimes, compressed arrays, refusal rollback,
coverage retirement, final renderer lifetime and resize calibration.

`summary.json` retains key fields and SHA256 seals. Gzip payloads retain every raw route trace, claim, resource, save
and assertion (decoded checksums in the summary). Reproduce against a pinned `serve-build --rev` URL:
`scripts/browser-lane.sh --max 15 node progress/memory/g226-asset-ledger/capture.mjs <url> <output.json>`.
This is a desktop controller/lifecycle/accounting proof, not the physical-phone or SF57 footprint gate.
