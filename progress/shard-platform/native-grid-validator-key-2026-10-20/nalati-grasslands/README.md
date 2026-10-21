# Nalati native memory after bounded compilation

| App SHA | Playing MB | Loading MB |
|---|---:|---:|
| 529f3def428c158557b3bd2241536ec75b871586 | 1916.4 | 1566.9 |
| 9bed83c7b2c442c757bd1f4441e18d7f1406d0f3 | 1855.4 | 970.0 |

Playing: **FAIL** against 1200 MB; loading: **PASS** against 1800 MB. The requested approximate 1150 MB playing target: **FAIL**.

The playing native maximum is 1534.8 MB, sampled at page 52.069 s. The independent global GPU ledger maximum adds 320.6 MB. Target span overlap: wildshard.prepare:nalati-grasslands:world.world.dressing, wildshard.prepare:nalati-grasslands:dressing.layers. The two maxima form a conservative envelope; they need not occur simultaneously.

Dressing packs, geometry and materials peak at 519.5, 529.4 and 530.8 MB native respectively. Layers contain the 1534.8 MB maximum; statics peak at 709.9 MB. The maximum after dressing completes is 813.8 MB native. Bracketing reads near the layer maximum account for only 175.1–176.5 MB of CPU buffers and 176.3 MB of GPU storage. Most native storage remains unclassified; the spans identify a preparation stage, not its allocator. No further memory cut is justified by a guessed owner.

The loading native maximum is 649.4 MB at page 10.409 s. It precedes Nalati preparation and belongs to page-wide initial grid boot.

Measured source includes f067d97a2c, 40988dfb4b, 9d40530bad: one phone Basis worker, dressing preparation spans, and factored draft-07 schema compilation. Other shared-main changes are present; the before/after difference does not isolate one cut.

Both runs skip the Simulator KTX2 probe per G386, use render scale 2 with Memory saver off, and are not quiet. Network reads remain parallel. No profiler, heap capture or GL observer supplies the readings. Completed scalar preparation spans are read after sampling stops. Preview lifetime ends with the sample. This is Simulator memory evidence, with no frame-time, visual or physical-phone clearance.

[receipt.json](receipt.json) records exact source, served build, protocol, raw hashes and labelled GPU peak. [phases.json](phases.json) separates initial-grid playing from target preparation. [preparation.json](preparation.json) correlates native intervals with bounded User Timing spans.

[allocation-at-peak.json](allocation-at-peak.json) brackets the native maximum with scalar CPU/GPU totals. Their difference is unclassified native footprint; it does not identify JavaScript, JIT, images or allocator retention.

A separate same-source diagnostic captured a [native map](native-map.txt) after confirming the live WebContent PID/start identity at 1184.5 MB. [allocator-diagnostic.json](allocator-diagnostic.json) preserves that sample and map provenance. WebKit Malloc dominates dirty storage at a rounded 1.1G; JIT code is 57.5M and JS buffer storage 50.1M (vmmap binary units). The map identifies an allocator, not an allocating function. Its corpse-copy capture perturbed later footprint readings, so this separate run supplies no cap or frame-time credit. Its preview also stopped when the diagnostic ended.
