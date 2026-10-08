# Native WebContent region audit, first pass

E435 / G227. Existing verified Simulator capture `65106ea87`, Developer / Memory saver ON, phone Auto/KTX2, same process PID 76367. These are rounded `vmmap -summary` **dirty decimal MB**, converted from the tool's binary units. Physical footprints differ slightly from the original three-sample median because vmmap runs after the samples.

| Region | Home | Nalati centre | Empty road |
| --- | ---: | ---: | ---: |
| WebKit Malloc | 283.011 | 461.373 | 468.713 |
| JS VM Gigacage | 227.960 | 231.945 | 228.694 |
| JS JIT generated code | 33.345 | 39.426 | 39.636 |
| CG raster data | 3.260 | 5.849 | 8.471 |
| VM_ALLOCATE graphics | 12.583 | 10.486 | 12.163 |
| Owned unmapped graphics | 4.719 | 11.010 | 8.913 |
| Region dirty TOTAL | 623.064 | 819.986 | 826.278 |
| Rounded physical footprint | 609.537 | 806.565 | 812.856 |

The retained centre→road bill is primarily WebKit Malloc, not tagged Image IO (0 dirty), fonts (near zero), or the small QuartzCore/audio allocator zones. The WebKit malloc **zone** total includes allocations across several region tags, including the Gigacage; adding its 699.3 MiB centre dirty size to the table double-counts. Reserved virtual space is not resident memory. WebKit Malloc includes JavaScript allocations too: this table does **not** prove 461 MB of non-JS ownership.

The newer Mac heap is a different process/platform/pin and reports native GL external payload. Subtracting it from this Simulator WC footprint cannot produce an exact 300 MB remainder. The remainder is the next measurement question, not an established owner or reclaimable amount.

The next same-process diagnostic is opt-in `G227_NATIVE_DETAIL=1` on `native.mjs`: after each original WC/GL pose sample, collect passive WebKit `Memory.trackingUpdate` categories, `vmmap -v`, and `footprint -f bytes` on the **same fixed admitted WebContent PID**. No Heap.snapshot, GC or pressure request occurs. Unsupported protocol errors remain in the report; missing PID refuses substitution. The failure record also preserves the recovery save records, loading text, last pre-reset samples and document fence.

WebKit's official [Memory protocol](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/JavaScriptCore/inspector/protocol/Memory.json) exposes JavaScript, JIT, images, layers, page and other categories. Its [Cocoa collector](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/page/cocoa/ResourceUsageThreadCocoa.mm) subtracts GC allocation/owned memory from the malloc bucket, while [InspectorMemoryAgent](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/inspector/agents/InspectorMemoryAgent.cpp) reports the remaining bucket as page memory. These engine categories can include external payload; they are not identical to a JS object snapshot or kernel physical footprint. The shipped Simulator implementation must be checked by the actual protocol result.

`vmmapSummary.py` creates `native-region-summary-65106ea87.json` from the committed verified home/centre/road summaries. The earlier requested-ON trial that actually ran OFF is excluded. Passive collector lifecycle/invalid-event tests pass (3); existing census non-restoring regressions pass. No new native reading or cap pass is claimed here.

Plan-State: unchanged.
