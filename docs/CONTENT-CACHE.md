# Immutable content on disk

`@wildshard/engine/boot/contentCache` owns one `ws-content-v0` Cache Storage
cache. Its keys contain only the SHA-256 address, under an origin-local
namespace. Two shard sources or instances requesting the same address share
the same bytes. Every read rechecks the hash and returns an owned byte array;
there is no second in-memory byte store.

The default limit is 256 MiB and 2,048 entries. The quota estimate can lower
that limit to one quarter of the origin quota, while reserving 32 MiB for
other origin storage. Least recently used, unpinned bytes leave first. A real
`QuotaExceededError` triggers eviction and a retry; insufficient capacity
returns `false`, allowing an admitted online load to continue. An offline
miss fails without trying the network. The estimate is advisory, as
[WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
requires handling actual write failures.

`pin(hashes)` returns an idempotent release function. Overlapping owners
protect active critical bytes until all leases release. A durable LRU index
tracks wire size and access order. Reads update access ages in memory; one
scoped two-second flush coalesces their index writes. Writes, eviction and
pagehide flush promptly, and remove the pending timer/listener. Entries carry
recovery metadata if a
quota failure prevented an index write. Browser-evicted or corrupted bytes
become cache misses. Concurrent reads of a missing address share one download.

The product loader owns the visited manifest and publishes it only when its
offline asset set is complete. It owns leases and releases decoded tile
transport bytes. The cache retains wire bytes on disk; CPU/GPU residency is
the session's separate budget. Service-worker activation keeps both this
cache and `ws-shardfile-products-v0` across builds. Clear downloads still
deletes them explicitly.

The injected ports supply storage, origin, SHA-256, quota estimates and an
optional clock/limits. Tests cover repeat visits, offline reload, concurrent
downloads, leased LRU eviction, quota retries, corruption, browser eviction
and service-worker activation.

## Paced browser storage

The actual page CacheStorage uses one explicit ContentCacheWorker shared
by all product wrappers. It runs the existing capped, SHA-verified cache
in a dedicated worker; injected storage ports keep their original path.
Reads transfer fresh owned bytes. Puts snapshot caller bytes without
detaching them. A verified presence query checks SHA and exact length in
the worker, avoiding a discarded main-thread copy during durable checks.

The bridge allows 64 pending requests, a 15-second request deadline,
30-second idle close and two-minute lifetime followed by a bounded flush.
Pagehide also flushes before closing. Control and data use one queue, so
leases precede subsequent writes. Error, messageerror, silent exit or
startup failure terminates the worker before pending operations replay
through one shared original cache, with every live lease installed first.
Verified data refusals remain errors. No admission or reveal skips a file.
