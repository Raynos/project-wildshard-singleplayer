# Nalati dressing allocation witness

App `529f3def428c158557b3bd2241536ec75b871586`: **1916.4 MB playing — FAIL 1200 MB**, **1566.9 MB loading — PASS 1800 MB**. The requested approximate 1150 MB playing target also fails.

The native playing maximum is 1592.2 MB at page 47.078 s, inside `world.dressing` (42.124–52.982 s). The independent global labelled GPU maximum adds 324.2 MB. The dressing step is the only recorded client feature overlapping the maximum. This identifies a preparation owner, not an allocator or causal proof. Detailed spans are read after native sampling stops; no profiler or GL observer runs.

The preceding G386-pinned build `401fac0ce0586855dace52b65ab5fd55c7857000` measured 1967.0 MB playing / 1481.6 MB loading. Both runs skip the Simulator KTX2 probe, use render scale 2 and Memory saver off, and are not quiet (memory credit only). Source includes the packed-contact scratch bound and client preparation spans. It excludes the later native byte decoder, one-worker phone Basis bound and regional runtime spans (`42ead5e164`, `f067d97a2c`, `cae60d085a`). No reduction is attributed to those unmeasured cuts.

Initial loading peaks at page 3.489 s, before target preparation; that loading high belongs to page-wide grid boot. The preview stopped immediately after the sample.

[receipt.json](receipt.json) records the exact source, settings, collector arguments, raw hashes and labelled GPU peak. [phases.json](phases.json) separates initial boot from target preparation. [preparation.json](preparation.json) correlates the native maximum with bounded User Timing spans. These receipts give no frame-time or visual credit.
