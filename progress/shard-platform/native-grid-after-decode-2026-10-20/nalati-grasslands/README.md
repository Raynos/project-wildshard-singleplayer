# Nalati native memory remeasure

| Run | App SHA | Playing MB | Loading MB | Texture protocol |
|---|---|---:|---:|---|
| Baseline | 2ae1ef409857afb091a341634752d426dd1f5a44 | 2556.8 | 2474.2 | probe enabled; images path |
| Bounded preparation | 401fac0ce0586855dace52b65ab5fd55c7857000 | 1967.0 | 1481.6 | G386: KTX2 probe skipped |

Corrected run: playing FAIL against 1200 MB; loading PASS against 1800 MB. Playing FAIL against the requested approximate 1150 MB target.

The loading native high occurred 3.468 seconds after page start. It precedes Nalati preparation and belongs to initial grid boot.

The original and corrected texture protocols differ, so their difference does not isolate the decode cuts. The collector adds the independent native phase maximum and global labelled GPU maximum, a conservative envelope. It gives no frame-time credit (not quiet, no GL observer or profiler). Render scale is 2; Memory saver is off.

The measured source includes the shared one-slot GLB decode bound, deferred queued byte copies, two-slot tile decoder admission, owned GLB attributes, uploaded ground/static instance channel retirement, browser parse pacing, creature inflate burst reuse, and the image-worker fallback bound. Descendant sources also include the measured follow-up cuts identified below. The receipt protocol records far-loader coverage at the measured SHA.

Follow-up source cuts outside this measurement: eab17db360.

See [receipt.json](receipt.json) for source, protocol, complete route and labelled GPU peak. [phases.json](phases.json) separates initial-grid playing from target preparation and records native peaks inside live runtime hooks.
