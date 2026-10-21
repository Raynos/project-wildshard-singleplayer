# Foliage transport and verified blob-cache diagnostic

Exact served committed SHA: ff62a7230462fbd80657953c6253eaca90c24cc0.
The combined clean source batch passed in 326.8 seconds. This build carries
48d648401a (four duplicate foliage transports) and de51698358 (verified
URL-cache fallback for blobs and released-library rereads).

Eight of ten entries and all five actual road exits/home returns pass.
Every entry passes stage accounting and detail cadence. The two remaining
failures are phone warm-grid and native warm-shardfile byte counts. These
are diagnostic receipts, not full acceptance. [All measurements](table.md)
and the compact JSON retain exact stage rows and raw-receipt digests.

Native warm grid now has no seventeen-GLB revalidation burst: 23,892
shown against 23,617 actual bytes, 1.16% error and a 776 ms detail gap.
Phone cold shardfile/grid wire totals are 143.85/143.37 MB; wall times
are 30.1/26.7 s. The four retired binaries contain 32,463,904 raw bytes.
Finished GLBs, original bake inputs and collider generation are unchanged;
the clean geometry/collider parity test remains intact. These sequential
shared-machine measurements are not an isolated speedup experiment. The
20 s CPU-4x grid target remains open.

Phone warm grid again includes a browser-owned full worker-script response
missing from Resource Timing. The later 63dc1e12b4 bootstrap reduces that
request to 95 bytes; its native freshness proof is retained separately.
Native warm shardfile records three 22,201-byte HTML responses but only
two worker timing entries. A separate diagnostic without optional Inspector
network events passes at 1.16% wire error; a late command/control experiment
has no requests in either window and does not establish causality. Default
proof behavior is retained. The later native diagnostic captures a separate
worker-buffer replay on byte failure without replacing the recorded counter.

All wire totals include actual response bodies plus actual response headers;
no response is excluded and no body-only denominator or guessed credit is
used. Phone Chromium is muted iPhone 16 Pro / CPU 4x. Native Safari uses the
portrait phone Simulator through sim-lane. All grid paths use the real 5 x 5
and normal hover input; no pose, layout, readiness or cap bypass is used.
Desktop grid asserts enabled AO. Captures were read before retention and
carry served-SHA/path labels. These transport changes alter no collider.
