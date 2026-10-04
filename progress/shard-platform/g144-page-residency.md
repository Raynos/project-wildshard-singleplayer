# G144 early page residency — source receipt

E435, sp-x2, 2026-10-04. Source is landed locally; the serialized push and browser proofs wait for the SF57 quiet
window to finish. **Grid memory admission remains default OFF.** This receipt does not claim a measured memory pass.

## One owner before allocation

- `2b866baa9`: `PageResidency` admits the immutable `sim:<instance>` claim before allocation. Repeated admission does
  not add a reference. The live registry retains a separate lease; stale admission/retain after disposal refuses.
- `5a5026cc0`: `LiveGridHost` adopts that exact instance, byte count and allocator rather than charging the home twice.
- `cfe98c532`: production durable-only continuation mode retains zero unloaded snapshots or packed strings and claims
  no fixed memory cache. It requires a durable reload capability before world construction. The memory-only Node
  default still reserves its bounded 33,570,816-byte cache; quota refusal still prevents an unsafe crossing.
- `dd443c1ef`: session, game services and grid share the owner. Level cleanup releases consumers before the boot lease.
- `27a97d6ad` / `1a43fe3ef`: strict measurement helper and shard-owned Driftwood provenance. Manifest and runtime config
  refer to the same constant; computed cost is not stored in content.
- `bbda6b285` / `db2a28a45`: literal reviewed reload Debug row and public page-boot selection. Row OFF does not consume
  the grid intent early; Select a shard acquires no grid owner. Data-only homes use admitted sim and separate actual
  library/tile claims, rather than a measured opaque-runtime total.
- `5703b5791` / `03d0e7119`: root and hybrid forwarding. Driftwood passes its installation context; the defining game
  adapter forwards its existing residency binding. Conflicting owners refuse. The shard's coupling ceiling is unchanged.

The optional loader/handoff, runtime-cost schema and fallback data-home tile metering are sp-x5's `f9c2bcd64`,
`108122c7b` and `b3b01d554`. The loader does not create an additional sim claim.

## Truthful measured home cost

Provenance: [SF22a measurement](../../memory/sf22a-2026-10-04.json), revision `91f97bdfc`. The label is Simulator
Safari WebContent plus the desktop labelled GL census; it is not a physical-phone reading.

Driftwood records 613 MB WebContent, 272 MB GL and 299 MB engine base. The game helper computes
`ceil((613 + 272 - 299) * 1,000,000 / 1.11) = 527,927,928` accounted bytes. The shared allocator then reports
966,000,001 playing bytes, including its engine base and overlap allowance. The calibration factor is applied once.

The measured 885 MB home alone leaves about 115 MB under the 1.0 GB playing limit before overlap and additional grid
content. The modeled remaining headroom is about 34 MB. Neighbours that do not fit must remain far proxies behind
closed soft walls; no budget ceiling increased. The old permanent continuation pool would consume most of that headroom,
which is why durable production factories now have zero retained cache.

## Focused checks

These files passed individually during the quiet window; they are not a combined full-gate result:

- `pnpm exec vitest run test/grid-page-residency.test.ts`: 5/5.
- `pnpm exec vitest run test/live-grid.test.ts`: 2/2, real frame changes and durable reload, frozen HP/door state and quota fencing.
- `pnpm exec vitest run test/live-grid-durability.test.ts`: 2/2, rewards, reload and cleanup assertions preserved.
- `pnpm exec vitest run test/grid-runtime-cost.test.ts`: 2/2, measured reconstruction and malformed evidence refusal.
- `pnpm exec vitest run test/grid-menu.test.ts`: 17/17, including default OFF, persisted ON and row cleanup.
- `pnpm exec vitest run test/grid-page-boot.test.ts`: 5/5, 877 ms on the final root candidate.
- `pnpm exec vitest run test/grid-hybrid-residency.test.ts`: 2/2, 1.56 s, matching owner without a second claim or
  pre-entry trusted constructor; conflicting, wrong-instance and disposed owners refuse.

Scoped typed lint passed for each source step and the final root/hybrid candidate. Source precommit retained all hard
rules. The root-to-game public `grid/pageBoot` edge is coordinator-approved for the serialized generated receipt.

## Still open

After quiet release, run the clean carrier gate, then enter Infinite Wildshard with the new row ON and verify the
measured home is admitted, one allocator is shared and refusal telemetry stays safe. Keep the row OFF if admission
fails; route the measured limitation to Jake rather than increasing a budget. Review platform road/native residency
costs as part of the remaining real-total admission proof; this source receipt alone does not prove those allocations.

The separate reveal-readiness fix also needs its post-fix hybrid-ON browser capture. No browsers, builds, full gates or
pushes were started by this lane during the SF57 soak.
