# Six native shards: fail-closed compatibility witnesses (E435 / §C / SF72)

**All six remain `compatible: false`.** These are executable audits of the real trusted entries, not
headless gameplay implementations. No real runtime reaches a tick, no mid-encounter checkpoint is
captured, and no replay hash is claimed. The renderer-free extraction is separate work.

Audited from clean committed source `b13614a6e7bb218f691a5f3b7040510de13cb7e8` plus these test-only files,
using the template's unchanged `scripts/sim-node-loader.mjs`, plain Node 24.18.1, no browser/DOM shim.
Every shard has `run.mjs`, `headless.test.ts`, `replay.test.ts`, `ledger.test.ts` and an unedited-result
`compatibility.json` with source revision and invocation. `dependency-chains.json` records static
value-import paths from that clean source; it is a dependency inventory, not a captured failure stack.

Run, for example:

```sh
node --import ./scripts/sim-node-loader.mjs test/proof/sunscar-dunes/run.mjs all
# Exit 1; JSON includes compatible:false. Modes: all, headless, replay, ledger.
pnpm exec vitest run test/proof/compatibility test/proof/sunscar-dunes test/proof/far-reach test/proof/pine-hollow test/proof/driftwood-isle test/proof/nalati-grasslands test/proof/nine-dragon-stack
```

Vitest checks the CLI's nonzero refusal and exact blocker, not success at gameplay. Separate native
processes must produce identical reports. A future source/entry change that removes a blocker requires
updating this audit and supplying the real runtime/replay proof; an importable entry alone cannot turn
compatibility green. Unknown modes throw rather than emit a passing result.

| Shard | Actual trusted entry | First runtime blocker | Full source / partial ledger |
| --- | --- | --- | --- |
| Signal Dunes | `sunscar-dunes/runtime/index.ts` | `engine/anim/rig.ts` | Loads; 2 rules tested |
| Sky Reach | `far-reach/runtime/index.ts` | `engine/anim/rig.ts` | Source rejects `engine/app/runtime.ts`; blocked |
| Pine Hollow | `pine-hollow/runtime/index.ts` | `runtime/audio/score.ts` parameter property | Loads; 19 rules tested |
| Driftwood | `driftwood-isle/runtime/hybrid.ts` | `game/shardfile/hybrid.ts` parameter property | Loads; 10 rules tested |
| Nalati | `nalati-grasslands/runtime/index.ts` | `engine/app/runtime.ts` | Loads; 17 rules tested |
| Nine Dragon | `nine-dragon-stack/runtime/index.ts` | `engine/combat/view/SweptMelee.ts` | Source rejects `engine/render/tiers.ts`; blocked |

## What the ledger checks establish

For the four loadable full shard sources, the fixture admits their **real, parsed ledger rows** into
`Ledger` backed by the real `SaveStore`. It submits explicitly synthetic admitted outcome inputs,
refuses the first durable write, confirms a fresh store cannot read it, retries, reopens the durable
profile, checks every declared achievement's first count/threshold, and replays the same facts without
incrementing or granting twice. This is **partial contract coverage**: `gameplayEmissionProven:false`.
It does not prove a real quest, kill, boss victory or reward produced the input. Native gameplay is never
stubbed or replaced to manufacture that claim. Sky/Nine's full source cannot load, so their CLI does not
peel off an independently importable ledger leaf and present it as whole-source coverage.

All four loadable sources have **zero ordinary `creatures.spawns`**. Those are runtime-owned actors.
Passing their data through `createShardfileSim` without the runtime would exercise an empty proxy, not
these shards. Runtime binds, exact declared runtime spawns, quest ids and ledger rules are in each JSON.
Existing M3 migration/browser, per-policy oracle and platform factory tests remain useful separate
proofs; none supplies the missing whole-shard §C headless/continuation witness.

## Renderer-free installer requirements, by shard

These are extraction boundaries, not requests to relax the Node fence or move presentation into the
simulation. Each installer needs real physics/player/query ports, stable native actor ids, its actual
quest/item/ledger ingress and fixed-step ownership. Restore must reinstall adapters without setup RNG
draws, body duplication or reward replay. Snapshot adapters must cover gameplay continuation outside
`AnimalSim`/`StrikeRunner`/the declared script lane; persisted save fields alone are not a mid-tick snapshot.

### Signal Dunes

Cut `runtime/index.ts -> plugin.ts -> world/meshes.ts -> engine/anim/rig.ts`; keep rig/model loading in a
view installer. Also split `combat/matriarch.ts -> engine/ui/BossBar.ts` and `look/light.ts ->
engine/render/shaderPatches.ts`, loot UI and the world/fire view from decisions/collision.
The current native runtime owns 13 declared homes (1 dune ray, 10 sand skitterers, 2 dune striders),
`sunscar.matriarch`, the whip and signal/Matriarch quest outcomes. Keep the real home spawn/respawn gates,
ray hold, light/fire/crackable state and native Matriarch combat ports. Continuation needs home clocks,
actor identities, weapon action/cooldown, quest/director pending work, Matriarch phase/strike/intro/death/
checkpoint state and its invulnerability/storm goal/timer. Fog, burst meshes and boss bar can observe it.
Next executable target: signal completion and Matriarch mid-fight snapshot, suffix and durable reward.

### Sky Reach (`far-reach`)

The **source** already reaches `shard.config.ts -> world/risingIslet.ts -> engine/world/registry.ts ->
engine/app/runtime.ts`; extract the rising-islet collider/manifest constants from the runtime registry.
The entry also imports `world/meshes.ts -> engine/anim/rig.ts`, shader patches, memory-saver views and
`combat/stormRoc.ts -> engine/ui/BossBar.ts`. Split those from physics/quest/flight logic.
Native ownership: `far.ray.0`, `far.roost.0..2`, `far.wisp.0..2`, `far.goat.0..4`, `far.roc`, the fan/gust,
winch/rope bridges and moving islets/gates. Keep deferred goat WORLD-floor placement and spawn identity
order, home/flight policy state, shared RNG, vane/roost flags, Roc phase/strike clocks and encounter
checkpoint/reward state. The mover script continuation, rider attachment and pending interactions must
join the same host snapshot. Next target: source load first, then winch/quest and Roc fight suffix.

### Pine Hollow

First observed refusal is Node strip-only syntax in `runtime/audio/score.ts:42` (constructor parameter
property). Removing that alone is insufficient: the entry imports `engine/ai/view/DebugOverlay.ts`,
`combat/spawns.ts -> engine/app/runtime.ts`, `species/hulls.ts -> engine/anim/rig.ts`, and native weapons
reach `engine/combat/view/ranged.ts`. Split the clock/audio/UI/model installation from gameplay.
Native ownership: declared `pine.antler-king`, dynamic forest/lair/elite actors, King's thralls/adds,
night-watch/dawn actors and the crossbow/rifle/longbow. Preserve actual forest spawn order and RNG,
quest/night-dawn/director timers, inventory/ammo/loadout and item continuation. `runtime/antlerKing.ts`
contains mutable parked/fallen/thrall lists, phase goals, damage/invulnerability locks, seals, hazards and
checkpoint/victory fences; those gameplay fields need stable actor/handle references and adapters.
The camera, fog/light dimming, tells and widget recipes remain presentation observers. Next target:
real King encounter checkpoint/death/restore/victory suffix with the declared progress facts.

### Driftwood

Use the **actual declared `runtime/hybrid.ts`**, not legacy `runtime/index.ts` by itself. Its first
observed refusal is the parameter property in `game/shardfile/hybrid.ts:304`. Its value closure continues
`hybrid.ts -> game/grid/boot.ts -> engine/app/runtime.ts`; the browser resident-world wrapper must not be
the headless installer. `world/build.ts -> world/Ocean.ts -> engine/render/shaderPatches.ts` and
`creatures/install.ts -> creatures/Enemies.ts -> engine/fx/ParticlePool.ts` need view/FX separation.
Native ownership: declared `driftwood.captain`, crab/monkey/sailor ecology and practice actors, boar/bear,
boat/rope bridge, native equipment and the altar/finale/reward sequence. Preserve night/out-of-sight/
distance/random respawn rules, monkey perch/token/RNG and sailor rise. Capture spawn gates, native
projectiles, bridge/boat continuation, quest anchors/flags, Captain BossBrain and reward-beat/director
pending clocks/requests, including exactly-once completion. The golden-hour camera can observe state.
Next target: real altar wake -> Captain mid-fight -> restored suffix -> one durable finale fact.

### Nalati

Cut `runtime/index.ts -> species/rows.ts -> engine/app/runtime.ts` and `species/hulls.ts ->
engine/anim/rig.ts`; remove `engine/ui/Settings.ts` and bag/UI import requirements from the simulation
installer. `runtime/state.ts` currently builds the world and installs native wildlife/group controllers
alongside views; the existing engine group/crowd policies do not install the whole shard into SimHost.
Native ownership: declared `nalati.golden-king`, dynamic packs/herds/flocks, marmot/sheepdog/horse/riders
and mesh-backed Storm Titan. Preserve shared RNG/order, prey/raid/taming/contact ports and original
20/10 Hz/paused crowd scheduling via explicit clocks. Capture pack/herd tokens/prey/timers, ordered
Float32 crowd state and scheduler continuation, tamed/mounted identities, raid/retry/director/quest
clocks, Golden King and Storm Titan fight/checkpoint state, item pending actions and instance state.
Horse names/cosmetics and feat projection must reload through the existing state/ledger ports. Next
target: same real herd/raid encounter before/after restore plus durable chapter/feat output.

### Nine Dragon Stack

Cut `runtime/index.ts -> plugin.ts -> kit/weapons/melee/SweptMelee.ts -> game/weapons/Sword.ts ->
engine/combat/view/SweptMelee.ts`; the native Sword's combat continuation needs a view-independent port.
The source also reaches `shard.config.ts -> world/entries.ts -> look/paint.ts -> engine/boot/bytes.ts ->
engine/core/tier.ts -> engine/render/tiers.ts`: split collider/portal descriptors from paint/load/tier
selection. The world builder explicitly requires `ctx.app.render`; world/model placement, grade and
specimen lighting cannot be prerequisites of native collision/traversal.
Native ownership: prebuilt Jian, play-built Fei Zhua, portal rider/transfer and the `NdRuntime` traversal/
world controllers (no declared quest/feat/state or creature rows are invented here). Capture melee
strike/pending actions, grapple cable/anchor/climb/zip state, player attachment and portal transition
fences, gate/guard state and any gameplay-relevant world clocks. Nine declares no ledger rewards, but
its full source import is blocked, so this witness makes no independently peeled-leaf ledger claim.
Next target: real equipment/traversal host boot and grapple/portal restore suffix; only actual future
reward declarations should add a ledger emission witness.

## Delivery boundary

This commit changes tests/reports only. No production dependency, runtime, save, rendering, map or
shard behaviour is changed. Extraction stops here for the coordinator's separate SF72 row. Compatibility
stays false until real headless/replay/gameplay-to-ledger proofs meet §C with the shipping controllers.
