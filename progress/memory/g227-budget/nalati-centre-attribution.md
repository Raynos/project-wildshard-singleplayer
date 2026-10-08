# Nalati centre attribution and platform lifetime decision

E435 / SHARD-PLATFORM G227. Source `0e6d69988`, build `0e6d699-muz9mvsb`, 2026-10-08. Fresh Mac Playwright WebKit, iPhone 16 Pro phone tier / 2×, Developer, Auto/KTX2, Memory saver ON. Real title tap → owned Driftwood → direct Nalati entry → centre. Both routes completed, zero page errors, browser and owned preview closed. This is **retainer attribution**, not a Simulator WebContent reading or a cap pass. The last verified Simulator centre remains 1,101.026 MB WC + GL (single cold run, `46c249c07`).

The local WebKit pipe finally captured the centre heap. The Inspector reports native GL payload inside its heap accounting: **do not add this heap total to GL**. Class totals and nested dominators are not independent process-footprint estimates. Root-only native ArrayBuffers get owners only through exact remote-object identity, never equal-sized arrays.

| Class, Inspector shallow total | MB |
| --- | ---: |
| WebGL2RenderingContext, including native external payload | 305.387 |
| ArrayBuffer | 140.811 |
| AudioBuffer (37 objects; includes a live bank transition) | 68.355 |
| ImageBitmap | 56.034 |
| Float32Array (small arrays can report inline storage) | 38.276 |
| FunctionCodeBlock | 31.342 |
| Object | 24.442 |
| CanvasRenderingContext2D | 19.777 |

Exact large identities: Rapier/WASM memory 51.904512 MB; outcrop positions 5.926752 MB; unseen kurgan-interior position/normal/colour each 4.007376 MB (12.022128 MB total); camp mesh positions 1.891584 MB; dressing stone instance matrices 1.266624 MB; sky-dome-v2 panorama ImageBitmap 12.516128 MB. These are allocations, not automatically reclaimable bytes. sp-x4 owns the Nalati cuts and is inspecting the sky upload-source lifetime and lazy kurgan construction.

The `plain` / `ao` paired-property scan finds 19 records, 0.411336 MB unique plain arrays and 0.432864 MB unique AO arrays, including Inspector object overhead. This is under 1 MB, so the proposed colour-backup removal is not the large lever. The paired names do not by themselves identify a minified source symbol. No rig-loader result cache was found in source; no such cache saving is claimed.

## Platform: visibility is not disposal

Platform render claims total 99.777680 MB at this pose. The current camera is at (554.420, 27.398, 0.134), looking approximately west. `roadView` draws 5 meshes / 10,737 triangles. These are the current view's findings, not proof after a turn or hover.

| Owner | Claim MB | Actual currently mapped GPU MB | Lifetime finding |
| --- | ---: | ---: | --- |
| Road signs | 22.733 | 22.646 (atlas alone 22.370) | Whole mesh intersects view; cannot release whole atlas |
| Road deck | 22.513 | 14.005 mapped buffers; grain texture is separate | Intersects view and draws; collider remains permanent |
| Road junctions | 5.630 | 5.619 | Whole bounds intersect view |
| Road asphalt | 2.845 | 2.832 | Intersects view and draws |
| Curtain / void | 0.033 / 0.0003 | 0.019 / 0.0001 | Intersects view and draws |
| Open plots, shared | 33.790 | 18.976 mapped (atlases 17.301) | NW / SW already hidden by existing 900 m rule; SE remains enabled and can appear after a turn |
| Two cell screen slots | 12.233 | 6.991; live canvases 5.243 MB in heap | Off current frustum but within existing 320 m range; a turn can show them |

Buffer labels shared by identically named plot meshes are weaker than texture identity. The full per-resource table preserves that distinction. NW and SW have **1.005408 MB of unique direct CPU arrays**; releasing their visual scopes under the existing 900 m visibility rule could retire roughly another 1 MB of GPU geometry. It cannot retire the shared atlases while SE uses them. No saving has yet been credited.

Next platform step: scopes and separately charged geometry per plot, created before the existing visibility boundary, disposed outside it; shared atlases stay once, colliders stay permanent. A larger road/atlas reduction requires smaller independently owned pieces with the same pixels. Wholesale platform deletion inside a cell is rejected by this capture.

## Reproduce / artifacts

`webkit-centre.mjs` performs the real route and closes the browser. `analyze-heap.mjs` uses the integrity-checked official WebKit v3 dominator algorithm; `platformSummary.py` maps exact texture/object identities and explicitly weaker buffer labels. The source analyzer now also includes the small paired-property suspects absent from largest-object tables.

`webkit-nalati-centre-0e6d69988.{json,heap.json,heap-owners.json,heap-analysis.json,platform.json}.gz` preserve the full capture and analysis; `nalati-centre-attribution-0e6d69988.json` is the compact joined receipt. Full heap uncompressed SHA-256: `2de7492dbcb1b64ecd87e6f1ab5423361c535f3c1036a3bd66f62ad135665ed5`.

Earlier attempts on `8844eb1f7` produced no accepted reading: one used the wrong title URL, the corrected title attempt hit the independent UUID-less render-target boot collision. `0e6d69988` fixes that boot boundary. No earlier road heap is labelled as a centre capture.

Plan-State: unchanged; attribution and measured-release work continue under G227.
