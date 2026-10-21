# Bootstrap, cache and rolling-admission acceptance

Exact served committed SHA: `de6833b8b7b2e11a5ddb80cbec7e684f6263227a`.
The combined clean source batch passed in 793.2 seconds. This build carries
the 95-byte worker bootstrap, immutable content-hashed core, verified
metadata/blob cache hints and rolling four-slot admission window. The
unchanged page-wide GLTF parser remains one. No cap changed.

[Ten entry measurements](table.md) retain every result. Nine entries pass
all accuracy checks; all ten pass stage accounting and detail cadence.
All five actual road exits and home returns pass. Desktop grid asserts AO
present and enabled. The four retained portraits were viewed and include
their served-SHA/path labels. No collider, layout or pose bypass is used.

Native Safari cold shardfile/grid are 12.5/13.6 seconds and warm entries
are 10.1/10.1 seconds. Both warm paths display 23,892 against 23,617 actual
wire bytes (1.16% error). Their detail gaps are 387/655 ms. This is the
Simulator Safari surface corresponding to Jake's iPhone browser.

Phone Chromium cold shardfile/grid are 29.2/28.7 seconds; warm entries are
25.1/16.8 seconds. The warm grid byte check fails: 57,300 displayed against
78,273 actual wire bytes (26.79%). Its 458.7 ms detail gap and stage sum
pass. This result remains a failure in the raw and compact measurements.
It is not relabelled as a green byte check.

The warm Chromium grid update refetches the unchanged bootstrap (95 body
bytes plus 257 response-header bytes) and core (20,532 gzip body bytes plus
319 response-header bytes), without validators. Those browser-owned
responses are absent from Resource Timing. The other requests' fixed
Resource Timing header estimates overcount by 230 bytes, leaving the
observed 20,973-byte counter shortfall.

The small Chromium fixture isolates cache pressure. Before pressure, both
identity and gzip cores remain cached across same-page updates and a new
page, and the bootstrap revalidates with 304. After 192 MiB of ordinary
sequential cacheable responses, the unchanged pair is fetched in full with
no validators; the next check again returns 304. Same-length changed cores
still reach the controlled client. The two retained fixture receipts record
those requests. This reproduces the cache-pressure miss independently of
the game, compression and page lifetime; the game trace matches it.

The maintained [Chromium fixture](../../../../scripts/loading-benchmark/worker-core-chromium.mjs)
is `f164da3f97`. Run it through browser-lane with Node's existing loader:

```sh
scripts/browser-lane.sh --max 5 node --experimental-transform-types \
  --import ./scripts/sim-node-loader.mjs \
  scripts/loading-benchmark/worker-core-chromium.mjs --pressure=192 \
  --out=tmp/loading-lane/worker-core-chromium/reproduction.json
```

Use `--pressure=0` for the no-pressure comparison. The diagnostic transfers
the requested MiB sequentially; it does not change browser cache limits.

The coordinator accepted O2/O4 on 2026-10-21 with this Chromium-only
cache-pressure residual recorded explicitly. Safari warm acceptance is
green. No production workaround, cache-cap increase, guessed byte credit,
request exclusion or body-only denominator is used. Every actual response
body and actual response header stays in the independent wire denominator.

O5/O6 remain open: cold CPU-4x phone grid is still above the roughly
20-second target. Warm 16.8 seconds does not close that cold-path gap.
These sequential shared-machine timings are not an isolated speedup A/B.
The retained CPU summaries remain separate from this accuracy verdict.

Phone Chromium is muted iPhone 16 Pro at CPU 4x. Native Safari uses the
portrait phone Simulator through sim-lane. Grid entries use the real 5 x 5;
crossings use normal hover controls. Source batch and full matrix proofs
are `loading-bootstrap-reef-source-batch-23514` and
`loading-worker-bootstrap-entries-70320`; the latter correctly exits red
for the documented Chromium byte failure. Its acceptance-summary job also
refuses full green acceptance. Compact receipts retain raw SHA-256 digests.
