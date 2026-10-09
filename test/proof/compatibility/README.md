# Six native shards: compatibility witnesses (E435 / §C / SF72)

**Signal Dunes passes (`compatible: true`, SF72); the other five remain `compatible: false`.** Signal's witness
(`test/proof/sunscar-dunes/witness.ts`) runs its renderer-free trusted entry `runtime/headless.ts`, composed as the
platform's trusted adapter composes it, on a tape of tick commands alone: it walks the signal quest from the spawn,
lights the fire, fells the Dune Matriarch (no health, flag, position or fact is ever written), restores her
storm-phase checkpoint byte-exactly in process and in the shipping worker (`HeadlessSimulation` + `trustedRuntime`),
and feeds the committed facts to the real `Ledger`. The other five are executable audits of the real trusted
entries, not headless gameplay implementations: no real runtime reaches a tick, no mid-encounter checkpoint is
captured, and no replay hash is claimed. Their renderer-free extraction is separate work.

Audited from clean committed source `b13614a6e7bb218f691a5f3b7040510de13cb7e8` plus these test-only files,
using the template's unchanged `scripts/sim-node-loader.mjs`, plain Node 24.18.1, no browser/DOM shim.
Every shard has `run.mjs`, `headless.test.ts`, `replay.test.ts`, `ledger.test.ts` and an unedited-result
`compatibility.json` with source revision and invocation. `dependency-chains.json` records static
value-import paths from that clean source; it is a dependency inventory, not a captured failure stack.

Run, for example:

```sh
node --import ./scripts/sim-node-loader.mjs test/proof/sunscar-dunes/run.mjs all
# Exit 1; JSON includes compatible:false (Signal Dunes: exit 0, compatible:true). Modes: all, headless, replay, ledger.
pnpm exec vitest run test/proof/compatibility test/proof/sunscar-dunes test/proof/far-reach test/proof/pine-hollow test/proof/driftwood-isle test/proof/nalati-grasslands test/proof/nine-dragon-stack
```

Vitest checks the CLI's nonzero refusal and exact blocker, not success at gameplay. Separate native
processes must produce identical reports. A future source/entry change that removes a blocker requires
updating this audit and supplying the real runtime/replay proof; an importable entry alone cannot turn
compatibility green. Unknown modes throw rather than emit a passing result.

| Shard | Actual trusted entry | First runtime blocker | Full source / partial ledger |
| --- | --- | --- | --- |
| Signal Dunes | `sunscar-dunes/runtime/headless.ts` | none: passes (headless, replay, ledger from gameplay) | 2 rules, both from gameplay |
| Sky Reach | `far-reach/runtime/headless.ts` | none: passes (headless, replay, ledger from gameplay); CI runs it in checkpointed slices | 2 rules, both from gameplay |
| Pine Hollow | `pine-hollow/runtime/index.ts` | `runtime/audio/score.ts` parameter property | Loads; 19 rules tested |
| Driftwood | `driftwood-isle/runtime/hybrid.ts` | `game/shardfile/hybrid.ts` parameter property | Loads; 10 rules tested |
| Nalati | `nalati-grasslands/runtime/index.ts` | `engine/app/runtime.ts` | Loads; 17 rules tested |
| Nine Dragon | `nine-dragon-stack/runtime/headless.ts` | none: passes (headless, replay, ledger from gameplay, G285) | 2 rules, both from gameplay |

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

### Signal Dunes (passes)

The legacy browser entry (`runtime/index.ts -> plugin.ts -> world/meshes.ts -> engine/anim/rig.ts`) is unchanged; the
witness names the renderer-free trusted entry `runtime/headless.ts` instead. It owns the admitted terrain collider and
baked pieces, the 13 declared homes (1 dune ray, 10 sand skitterers, 2 dune striders) with their shipping policies,
stream and respawn clocks, the whip as its declared item row (contact on the head ball / body capsule, then the lane:
the browser whip's rule, `weapons/lash.ts`), the signal quest and interactions on `host.flags`, the Matriarch's
encounter on `BossBrain` with her body in the creature keeper, and the entry proof (92 lanes on the native terrain).
Its run (`compatibility.json`): the tape completes the quest and her fight in one life (victory at tick 12,516,
past the 10,000-tick floor), taking 15 creature blows that knock the player back as the browser's do (`feel.blow`,
the host's shared shove law); her storm-phase checkpoint restores byte-exactly, the 1,926-tick suffix to her fall
hashes identically, and the source-checkout worker started from the same checkpoint commits the same 60th-tick bytes; both
facts reach the durable `Ledger` once under their declared provenance and a restore re-emits nothing. Known, documented
gaps (not modelled headless): prompt line of sight, a crack command not spending the whip's cooldown, the browser
whip's unroll / second lash / pull / stagger, and no heavy attack in the tick protocol (the crank's double crack is a
`script` command).

### Sky Reach (`far-reach`)

Passes on the trusted renderer-free entry `runtime/headless.ts` (SF72). `run.mjs all` plays one tape of tick commands
from the spawn to the Storm Roc's fall (21,134 ticks): the keeper, the three vanes GUSTed, the roost's rays felled by the
War Fan, both hover bridges and the updraft on the board, the winch, the raised bridge and the Roc felled by fan play;
its gale-wall checkpoint (phase 1) restores byte-exactly, the suffix to the fall hashes identically and the shipping
worker commits the same 60th-tick bytes; both facts reach the durable `Ledger` once. The vitest legs replay that tape in
slices under DEPLOY.md's 10k-tick budget, resumed from committed checkpoints (`far-reach/checkpoints/`: step, gale,
storm; `run.mjs checkpoints` rewrites them, `run.mjs fresh` refuses a set written from other headless inputs). They
assert outcomes only, so x64 CI restores the data exactly without comparing continuations across platforms.

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
fences, gate/guard state and any gameplay-relevant world clocks. (Historical: since SF72 the witness runs
the renderer-free entry, and since G285 Nine declares two feats whose facts its tape emits from gameplay;
see `test/proof/nine-dragon-stack/README.md`.)

## Delivery boundary

The five fail-closed audits change tests/reports only. Compatibility stays false for each until real
headless/replay/gameplay-to-ledger proofs meet §C with the shipping controllers, as Signal Dunes' now do.
