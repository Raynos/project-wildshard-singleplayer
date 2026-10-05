# SF20a durable crossing fence / SF20d G130 receipt

Ask E435; sp-x2; 2026-10-04. Source pin `5e2ab6eb25e9a7c8da9e1e778dabf8f8aba30812`.

- G130: `544243894`, `1213516ea`. Authoritative combat checks the geometric cell at hit delivery, independently of the motor frame. Outside-cell melee/projectiles/impulses are rejected before reactions/modifiers/damage; regional actor provenance and G129 terminal-fall recovery are preserved.
- Save protocol: `10c90935e`. A current-tick polled checkpoint returns true, false or pending. Five-second pending saves remain blocked; quota refusal latches until explicit retry or retreat. A stale completion cannot commit after retreat.
- Physics primitive: `d55cabb33`. Capsule-radius-adjusted, always-solid transfer fences reach the unchanged 10 m exit / 6 m entry thresholds. The source wall never opens; only a durable fixed-boundary transfer changes worlds. Native allocations are explicitly owned and released; 65,536 bytes per cell fence set are reserved before construction.
- Live wiring: `5e2ab6eb2`. Home, highway and regional fences share the allocator; regional handles are in the snapshot adapter and immutable basis, so exact restore allocates no duplicates. The source traveller remains the only enabled capsule. Original admission errors survive through the G167 pull accessor; M3 waits are typed. G168 regional script notices use the existing page HUD on fresh and exact-restored hosts.

## Native proof

`pnpm exec vitest run test/live-grid-save-fence.test.ts test/transfer-walls.test.ts test/grid-crossing.test.ts test/grid-crossing-residency.test.ts test/live-grid-durability.test.ts test/live-grid-combat.test.ts test/grid-live-recovery.test.ts test/grid-traveller-combat.test.ts test/grid-minimap-blend.test.ts test/script-disabled-notice.test.ts test/grid-refusal.test.ts`

**41/41 tests across 11 files pass.** The real hoverboard runs 15 and 30 m/s on all four edges: 300 pending ticks, quota failure, current-tick retry, one enabled capsule, local coins/pack unchanged and free retreat. Exact restored regional state retains completed quest, 5 coins and 1 fact, fence/socket/border handles, script notice ports, and clean allocator/world teardown. Strict root TypeScript and owned typed lint pass.

## Browser proof

`scripts/browser-lane.sh --max 12 node scripts/physics-baseline.mjs --mode=grid --url=http://127.0.0.1:4402 --label=sf20a-save-fence --device-save=debug.plugin.driftwood-isle.driftwoodHybrid=on`

Clean `serve-build --rev 5e2ab6eb2`; build `5e2ab6e-muumsjm9`; muted iPhone 16 Pro preset. Each route enters INFINITE WILDSHARD through its title card and continuously drives Driftwood → deck → template-4 → deck → Driftwood:

| Speed | Frame crossings | Stuck | Completed | Motion samples | Minimum feet y |
|---|---:|---:|---|---:|---:|
| 15 m/s | 4 | 0 | yes | 643 | 0.219175 m |
| 30 m/s | 4 | 0 | yes | 543 | 0.219151 m |

Both routes have no failures, page errors, falls or disabled traveller samples. [Full trace](../../physics/sf20a-save-fence-5e2ab6e-muumsjm9.json). Test fixture picks are retained; incidental generated browser session/device telemetry is omitted. All owned browsers and preview processes are closed.

The approved shipped path is hybrid ON (Jake G172). Row OFF has the previously recorded legacy G91 dike-corner limitation; this receipt does not relabel it as a pass. Background non-shardfile neighbours remain typed M3 waits behind readiness walls. No motor tuning, hysteresis, seam or stuck assertion changed. The browser run proves the normal durable round trip; the injected five-second/quota matrix is the native proof above.
