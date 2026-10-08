# SF57 round 3: grid circuits flat (leak3)

## Result

Chromium, iPhone 16 Pro profile, muted, Developer on, phone tier, 2×. Four circuits D → Pine → Nalati → template-2 → D.
The JS heap is read with CDP `Runtime.getHeapUsage` after 3× forced GC at one fixed Driftwood pose. The driver is
`drive.mjs`: the async-owner driver with load logging, client error reports (`/api/errors`) counted as errors, and
longer route timeouts for a loaded machine (load average 10–48 during the runs).

| build | heap MB c0 / c1 / c2 / c3 / c4 | Δ a circuit (c1→c4) | page errors | route failures |
| --- | --- | ---: | ---: | ---: |
| before: HEAD `3aa32dc60` (async-owner + HUD discard + weak sky map + forEach `this` fix) | 69.5 / 130.5 / 163.1 / 191.9 / 217.4 | **+29.0** | 0 | 0 |
| after: `796813e` (`b393ff9eb` + this fix) | 69.3 / 130.6 / 137.3 / 141.7 / 145.1 | **+4.8** | 0 | 0 |

The circuit steps after the fix are +6.7, +4.4 and +3.4 MB. The first visit (c0 → c1, +61 MB) is unchanged: that is
the shards' first-visit caches. The intervening HEAD commits (SF50, SF70, SF46-p, …) do not touch the leak paths.

## What held each visit (heap snapshots after c1 and c3, `sig.py` diff, then `chain.py` / `props.py`)

1. **+130 MB of ArrayBuffers in 2 circuits: the page menu's scope → a Bag fragment → Nalati's world.**
   - Nalati registers the `nalati.finds` fragment through `ctx.bag.fragment` (`src/game/shard/context.ts`). That
     disposes the returned `remove` with the shard's scope.
   - `BagMenu.fragment` (`src/game/bag/tabs.ts`) also did `this.menu.scope.onDispose(remove)`, and an early `remove`
     never dropped that hold. The page menu therefore kept every visit's `render` closure, which reads the quest, the
     runtime state (`attachAnimals`, water, wildlife, stealth, …) and the forest's cull grid.
   - The fix: `capture('disposers', remove)` and forget it when `remove` runs. The same fix is applied to
     `BagMenu.addLoot`, `GameMenu.addSettingsSection` and `SimHost.onStep`, the other `onDispose(fn); return fn` sites.
2. **+13 MB: `Pack.all` / `HorseHerd.all`** (`src/shards/nalati-grasslands/runtime/groupRegistry.ts`).
   - These module-level arrays of every pack and herd ever registered were read by nothing but their own dedupe.
   - They held each visit's herds, their `lead.onStaggered` → the AnimalManager → its model factory, and the
     `motionConstraint` → the terrain mesh.
   - The fix: the registry keeps only its per-member WeakMaps.

After the fix, the c3 scope census is flat: `runtime.entered` 3, `AnimalGroup` 4, `ui.GameMenu` cleanups 65
(before: 3 → 5, 4 → 6, 67 → 71).

## Left (the ~4.8 MB a circuit)

- **The upload live set** (`UploadOwnership.live`, `live.py`): 867 → 1236 entries c1 → c3 in both builds, about 185 a
  circuit. About 100 of them are held only by the live set and the page level's `resources` capture. They are never
  disposed, and their owner was `null` at upload. They include `MeshDepthMaterial` (34 a circuit: the custom depth
  materials of Pine's trees and undergrowth and Nalati's spruce and flock), MeshStandard `family:pbr`, MeshBasic, and
  Pine's animal albedo / normal textures (one set per visit). This is a GPU leak as well as a heap one. The fix is an
  owner at upload, or a live set that holds its entries weakly.
- `ui.BossBar` (13) and `ui.EliteBar` (6) scopes, and the `Music` scope's cleanups (+26 a circuit), still grow slowly.
- The owner census still counts about 1320 ambient reads a circuit: `WorldRegistry.add` / `place`, `markGpuOnly`,
  `world.createCollider` and the compressed-upload dev check. The registry's retire already frees the first of these.

## Checks

- Node tests: `test/game/menu-tab-lifetime.test.ts` (an early remove of a fragment, a loot row and a settings section
  leaves the menu scope's census at its baseline, 20 visits), `test/engine/sim-host.test.ts` (50 early `onStep`
  removes). The Nalati group tests assert registration through `Pack.of` / `HorseHerd.of`.
- Full vitest on a clean export (`pnpm gen` first, heavy lane): 933 files, 5373 tests passed.
- `scripts/test-facade-instancing.mjs`: PASS on desktop, phone-tier and iphone-desktop-quality, with 0 batches.
- `physics-baseline --no-build --mode=walk`: 63 legs, 0 stuck.
- `parity/boot-smoke.mjs`: standalone ×2 and grid gameplay PASS, with 0 faults.

## Tools

- `chain.py <snap> <substring> [nth]`: the shortest root path to an ArrayBuffer, naming each Scope-shaped node and each
  closure's location.
- `props.py <snap> <id…>`: every edge of the given nodes.
- `live.py <snap> <out>`: the UploadOwnership live set.
- `sig.py`, `snapshot_lib.py` and `scopes.py` are in `../async-owner/`.
