# Immutable content on disk

MF8 replaces the page cache with the service worker's exact-URL store,
`ws-assets-v1` (`ASSET_CACHE_NAME`). There is no page `ContentCache`, hash
worker, cache worker, protocol, request queue, LRU index or periodic flush.
The service worker retains its shell/build generations independently.

## First-party reads

The browser supplies `ProductOptions.firstPartyRead`; publication already
validated those files. Ordinary fetch reaches the controlling service
worker. A hit is used as is: the only content check is the manifest byte
length, never a digest (G881/G887). Root indexes without a declared length
keep the existing source-byte cap; no size is invented.

A stale length retries the same URL with `cache: reload`. An interrupted
transport retries once and then stays on the existing loading-card RETRY.
The source cap, HTML refusal, abort signal and native response metadata
remain intact. Before the first controller, only the successful complete
response clone is published under its exact URL in `ws-assets-v1`. Disk
refusal keeps complete online bytes usable.

Product demand shares pending reads only for their live wave; it does not
keep settled transport backing. Decoded geometry and texture residency
still belong to their existing session scopes and allocators. Prefetch
packs publish members at canonical URLs in the same store, with their MIME
and byte lengths. Runtime-authored road archives also use that store;
encoding still derives their immutable names, and decoding keeps structural,
identity and byte-plan checks. Cache reads do not rehash them.

## Read-only migration

Existing `ws-content-v0` and visited-product stores remain inert so an
upgrade does not erase offline visits. They have no active page writer.
After native transport fails, the browser may read the exact old hash key;
it never enumerates body keys or rebuilds an index. A visited root is used
only when its recorded index hash equals the exact current build's root
hash. A different old root is never renamed as current content.

The successful length-checked response is published once at its canonical
URL in `ws-assets-v1`. Native hits perform no old-cache lookup or hash work.
The old stores remain read only until their migration coverage is complete.

## Author and external inputs

Node author and external readers omit the native first-party capability
and retain their strict checks. Explicit author fixture caches remain
injected ports. The browser's strict external adapter stores its metadata
and bodies in `ws-assets-v1` too, without an independent page owner.
