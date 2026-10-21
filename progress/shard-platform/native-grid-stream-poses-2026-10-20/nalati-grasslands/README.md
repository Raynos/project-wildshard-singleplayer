# Nalati native memory: stream poses

| App SHA | Playing MB | Loading MB |
|---|---:|---:|
| 9bed83c7b2c442c757bd1f4441e18d7f1406d0f3 | 1855.4 | 970.0 |
| 9bcd2d71781215ec38d69d774515f29f7ec9542c | 970.6 | 1089.5 |

Playing: **PASS** against 1200 MB; loading: **PASS** against 1800 MB. The requested approximate 1150 MB playing target: **PASS**.

The playing native maximum is 648.3 MB, sampled at page 42.107 s. The independent global GPU ledger maximum adds 322.3 MB. Target span overlap: after dressing, outside the recorded target preparation spans. The two maxima form a conservative envelope; they need not occur simultaneously.

The loading native maximum is 767.2 MB at page 26.791 s. It precedes Nalati preparation and belongs to page-wide initial grid boot.

Measured source includes f067d97a2c, 40988dfb4b, 9d40530bad, 9bcd2d7178: one phone Basis worker, dressing preparation spans, and factored draft-07 schema compilation, plus streamed numeric pose validation and a task boundary after each completed layer scope. Other shared-main changes are present; the before/after difference does not isolate one cut.

Both runs skip the Simulator KTX2 probe per G386, use render scale 2 with Memory saver off, and are not quiet. Network reads remain parallel. No profiler, heap capture or GL observer supplies the readings. Completed scalar preparation spans are read after sampling stops. Preview lifetime ends with the sample. This is Simulator memory evidence, with no frame-time, visual or physical-phone clearance.

[receipt.json](receipt.json) records exact source, served build, protocol, raw hashes and labelled GPU peak. [phases.json](phases.json) separates initial-grid playing from target preparation. [preparation.json](preparation.json) correlates native intervals with bounded User Timing spans.

[allocation-at-peak.json](allocation-at-peak.json) brackets the native maximum with scalar CPU/GPU totals. Their difference is unclassified native footprint; it does not identify JavaScript, JIT, images or allocator retention.
Dressing’s native interval maximum fell from 1534.8 MB to 578.6 MB. The new sampled stone-pose maximum is 578.6 MB; spans shorter than a sampling interval remain unknown. The largest playing native interval occurs after dressing, at page 42.107 s. Shared-main changes, including the custom-section validation paint queue, are included, so this run does not isolate the streaming cut’s effect.
