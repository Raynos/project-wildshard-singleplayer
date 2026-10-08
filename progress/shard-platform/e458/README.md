# E458 — loading progress before shardfile admission

The production report was a blank loading name/tier, a stopped `00:00.0` clock and zero tracks before the template eventually played. The root cause is the boot order: `entry.startSelected` awaited `installManifestShardfile` and the complete immutable product admission before `session/data` constructed `Loading`. That interval includes descriptor fetch/parse, cache reads or four-file fetch waves, hashes, synchronous asset validation, durable cache writes and presence checks. It was outside the ordinary boot plan.

Source `6aadc5dfb` fills the existing first-HTML fields and runs its clock before application modules arrive. Title navigation supplies the display name as metadata without consuming the arrival intent. Completed module resources report their actual bytes; an unknown denominator says “total pending”. Typed descriptor, asset, hash, validation and publication progress then feeds the same panel. The session adopts that instance and time origin, retaining admitted bytes through texture/audio waits. `f4f9eb73e` uses the public defining Loading module and reuses its existing clock sample. There is no CSS, layout, gameplay or renderer change.

`414a98ad7` avoids rewriting immutable cache hits whose exact bytes were already re-admitted. Final durable presence checks remain; an intervening eviction is repaired and checked again. Hash, wire, validation and offline-publication refusals are unchanged. A warm fixture proves zero asset puts, and an eviction fixture proves repair before publication. Native/phone saving is not claimed.

## Real shard-select observations

Runtime `6aadc5dfb63bfca6c9c35309c433408924d766ad`, build `6aadc5d-muzpnt5t`; HTTP/disk version and owned listener verified. One muted Chromium/Metal browser lane, iPhone 16 Pro portrait emulation, phone tier, DPR 2, Developer on, ordinary title → SHARD SELECT → chosen card → Enter world. Each product has a fresh browser context for cold, then the same context/cache for warm. HTTP and service-worker caches remain enabled. These are local Mac observations under shared-machine load, **not Simulator or physical-phone timings**, and not an isolated speedup comparison.

| Shard | Cold playable | Warm playable | Result |
|---|---:|---:|---|
| Template | 2.061 s | 1.650 s | both ready, no errors |
| Driftwood | 2.859 s | 2.360 s | both ready, no errors |
| Nalati | 3.780 s | 3.277 s | both ready, no errors |
| Nine Dragon | 2.836 s | 2.366 s | both ready, no errors |
| Sky Reach | 2.899 s | 2.114 s | both ready, no errors |
| Signal Dunes | 2.639 s | 2.187 s | both ready, no errors |
| Pine | blocked | not run | known compressed-texture P0 owned by sp-x4 |

Pine's preserved cold observation timed out at 30 s, last changing detail “12 / 195 textures uploaded”, 99 programs, all 106.1 MB boot bytes read. It emitted no JavaScript exception in this run; do not claim the exact no-mipmaps error was observed here. The coordinator classifies it with the separately reproduced compressed-texture P0. It is not a pass. The next loading benchmark uses an explicit 150 s deadline and the fixed runtime pin.

The template's first sampled screen at **41.5 ms** already names “Template shard”, shows the provisional phone tier, module bytes and an active clock. The same panel subsequently names cache/asset/publication work and finishes ordinary setup. Its descriptor declares **167 immutable files / 5,850,600 wire bytes** (81 native binaries, 81 GLBs, three Wasm and two JSON). Admission occupied about 1.0 s in this cold observation, before the old screen would have started. Shared audio/extras follow: the recorded resource bodies include 9.43 MB music and 1.42 MB SFX. Resource body bytes can come from the service worker; they are not network-transfer totals.

A separate synthetic four-times CPU diagnostic is retained (6.507 / 6.257 s). CDP also requested 4 Mbps/80 ms, but that cannot establish a whole-service-worker bandwidth cap, so **do not interpret it as a phone-network measurement**. Its cache-publication phase occupied about 2.1–2.4 s. Production phone delay is not quantified by these observations; SF67 owns the desktop/Simulator phase and long-task benchmark.

## Evidence and validation

`manifest.json` gives raw JSON SHA-256 and lengths; every gzip was round-trip verified. `primary-*` contains the six successful cold/warm pairs and the Pine refusal. The earlier template card-selection refusal is a harness error: a synthetic card click ran inside the carousel's 400 ms swipe fence, so the runner selected Driftwood. It was corrected to the real dot control before the primary observations and is retained separately.

Focused checks: 33 first-paint, loading handoff, title-intent, literal-text and product tests; 23 product/content-cache checks after the cache change; root strict and scoped typed lint green. First-paint test executes the actual HTML script with application imports blocked and checks metadata, clock, resource bytes and handoff cleanup. Legacy non-product completion, one-panel adoption and admission byte preservation are covered. The serialized coordinator owns the final gate and push.

E458 progress source is complete locally; the ask closes after its green serialized push. SF67 remains open for measured Simulator loading, long-task attribution and the freezes themselves. No phone chores are assigned to Jake.
