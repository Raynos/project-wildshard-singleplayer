# SF73 primary LEGACY control and frozen content identities

Primary clean main `6f1ff85b5`: Driftwood LEGACY reached play in 8 s; Pine LEGACY in 15 s. Muted Chromium, iPhone 16 Pro, Developer on, real SHARD SELECT button, no map substitution. Page errors: zero. Telemetry API is absent in the static preview; its 404 is not a content request failure.

Frozen diagnostic `f9f5fd35`: Driftwood with map substitution OFF failed at `level.kit` after approximately 3 s: `Shard item family driftwood-isle.wood must be named driftwood-isle-legacy.<name>`. The loading panel remained at Weapons/HUD; the bounded harness initially reported a 240 s readiness timeout. Captured `/api/errors` payload and full panel show the actual failure. `viewmodelTexturesReady()` was resolved, engine scope live, worker already gone. No main regression or rendering fix is warranted. The partial Pine retry was interrupted to capture this cause; it is not a pass.

The committed inventory generates an exact copy -> primary content-identity table. Only the composition root and the Node loader install it with the manifest list. Installation refuses missing/ordinary/orphan/self/legacy-primary endpoints atomically. A suffix or a legacy flag alone gives no namespace privilege. `bindRuntimeItems` uses the table only to validate immutable family names; existing foreign-family and shadowing refusals stay fatal. It does not replace `source.identity.slug`, the current manifest, save namespaces, placement/instance ids or feedback identity.

| Kind | Stable content id | Persistence / ownership |
| --- | --- | --- |
| Item families and row ids | Original primary family prefix, exact inventory only | Equipment is owned by the actual copy runtime scope; Inventory / Owned use actual manifest slug |
| Quests and flags | Original declared quest/flag names, no slug-prefix check | `Flags(level)` persists into the explicit copy level; quest adapters borrow those flags |
| Host state / boss records | Original numeric field id and name | `bindRuntimeState` defaults instance to unchanged source identity (copy); `platform.runtime-state` is shard scoped |
| Ledger facts and feats | Original fact / achievement names | Emitting ledger keys include actual copy shard and instance; achievement key is `[shard,id]`, entitlement key `[instance,shard,reward]` |
| Species and fixed spawn / home ids | Original local kind and row ids, no slug-prefix check | Registered/built in actual level/runtime scope; continuation is instance scoped |
| POIs / named models | Original placement/model ids and asset URLs | Actual runtime scene/scope; hard model checks reuse exact frozen historical provenance, not a suffix exemption |
| Shard Debug rows | Original row id | `registerLevelDebugRow` stores `debug.plugin.<actual levelId>.<row id>` and matches actual level id |

The regression fixture uses the real emitting ledger, `Flags`, bound quest and bound host-state installer. The same content ids and entity are written in copy/primary, then rebound: copy state/quest completion and achievement count never change primary state, and primary fact ingress never increments copy count. Profile identity and platform-wide catalogue remain intentionally shared; no second profile or renamed global item ids are introduced.

Frozen copies retain shared primary raster/GLB/texture paths. Browser proof substitutes a different valid raster at the existing map URL and requires boot/play; this proves a primary map rebake will not make the copy unloadable. It does not claim legacy map pixels stay frozen.

Open after this slice: standalone hybrid SHARDFILE entry for Sky Reach, Signal Dunes and Nine Dragon. This slice provides six frozen LEGACY copies and the three already available SHARDFILE entries (Driftwood, Pine, Nalati).

Two individually reviewed compatibility edits preserve the existing gameplay selectors: Nalati adventure.ts and Driftwood loot/effects.ts compare the content identity. The inventory stores exact original/current hashes and reasons; the landing carries Legacy-Crash-Fix. Every other source body is unchanged. Nalati runtime supplies the adventure persistence and Taming bond adapters, so neither original primary-save fallback runs.

A registered frozen copy never calls a primary legacyRead for a fresh bound field: it starts from declared defaults. Ordinary primary C26 migration remains unchanged; initialized copy fields reload their copy-owned values. The fixture exercises the real primary callback and proves the copy never calls it, even after rebinding.

By review, three device-tuning reads stay shared: frozen Pine debug/options.ts reads its primary debug.plugin.pine-hollow keys, Pine runtime/audio/score.ts reads debug.plugin.pine-hollow.pineScore, and Signal look/groundTiles.ts reads its primary debug.plugin.sunscar-dunes row. These are tuning only, never quest, inventory, boss, host-state or ledger progress. Signal's primary row removal leaves the frozen reader at its default. Registered Debug row writes otherwise remain copy-scoped.
