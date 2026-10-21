# Indexed home-region reads

Served committed SHA: `32cde805434270f8ab04091082bfc6b6fcc3c733`.

O3 is already implemented by indexed product prefetch: product admission reads
every immutable file through at most four transports before publishing it.
Grid uses that same admission function. World-scene owned segments use
Promise.all for their reads, then the existing page-wide parser slot decodes
one GLTF at a time. No new cap, parser, branch or runtime code is added.

| Surface | Path | GLB reads | Peak overlap | Read span ms | Entry s | Detail gap ms |
|---|---|---|---|---|---|---|
| phone | shardfile | 238 | 4 | 3877.5 | 26.9 | 371.7 |
| phone | grid | 238 | 4 | 3868.4 | 30 | 689.9 |
| simulator | shardfile | 238 | 4 | 2320.0 | 14.1 | 282.0 |
| simulator | grid | 238 | 4 | 2360.0 | 15.2 | 374.0 |

Each entry also passes stage sum, detail cadence and independent byte
parity. The diagnostic matrix retains actual return crossings on every
surface; its two native warm byte failures remain open and do not become
acceptance here. This closes the stale one-request-at-a-time
audit finding; O4 separately removes slowest-file barriers within the
existing four-read admission window.

Code: src/game/shardfile/product.ts:241-283 (complete index, four reads),
src/game/grid/products.ts:121-122 (same admission), and
src/game/shardfile/worldScenes.ts:248-265 (parallel owned-segment reads).
