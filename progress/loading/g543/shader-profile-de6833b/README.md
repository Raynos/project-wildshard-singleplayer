# Current cold-entry CPU profile

Served committed SHA: `de6833b8b7b2e11a5ddb80cbec7e684f6263227a`.
Both cold inputs independently pass the entry accuracy gates, retained in
[`diagnostic-de6833b`](../diagnostic-de6833b/README.md). The full matrix's
separate warm Chromium byte failure does not change these cold inputs.
Capture: muted Chromium, iPhone 16 Pro, CPU 4x, through browser-lane.

| CPU location | SHARD SELECT ms | Grid entry ms | Measurement |
|---|---:|---:|---|
| Precompile work | 10,341.8 | 5,644.7 | Inclusive samples |
| Node-material build | 7,656.7 | 3,987.5 | Inclusive samples |
| Loading panel paint | 534.7 | 633.0 | Self samples |

Inclusive rows contain their descendants and overlap each other; do not
sum them. Node-material building remains the largest identified loading
CPU cost. The panel row-reuse cut `52860bd662` landed after this capture;
its effect is unmeasured here. The next combined O5/O6 proof carries it
and sp-o2's newer precompile/link changes.

The JSON retains top self/inclusive frames, original source locations,
sample totals, unmapped URLs and raw-profile SHA-256 digests. Source maps
come from this exact served dist. Runtime/preload helpers and the root
document are unmapped; the grid also lists the Rapier Wasm URL. Those
frames are retained rather than attributed to an invented source line.

These sequential shared-machine samples identify work; they are not an
isolated before/after speedup measurement. Cold grid wall time is 28.7 s,
so the roughly 20 s CPU-4x target remains open.
