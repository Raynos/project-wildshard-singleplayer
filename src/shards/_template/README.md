# Template shard (`_template`)

Copy this folder to start a shard ([docs/SHARDS.md](../../../docs/SHARDS.md) walks through it). It is small and grey
on purpose and uses every plugin verb once. It is `hidden`: no title card. Enter it through Debug ▸ Developer tools ▸
Template shard. The `_` prefix also keeps it out of the layout check.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `hidden`, 1000 |
| `style`, `kitLook` | `greybox`, `toon` |
| `uses` | all 15 mechanisms, so each one is exercised |
| `ground` | a 200 × 200 m one-octave heightfield, one trail, a swim pool (`world/pool.ts`) |
| `loadout` | the kit iron sword, the custom whip (held), the custom lantern, the kit hoverboard |
| `species` | the kit boar and `greyBlob` |
| `encounters` | Greyback (an elite boar) and Big Blob (a two-phase boss) |
| `bag` | MAP · GEAR · PACK · NOTES, a pack of 8 |
| `hud` | bands 1–3; an oil meter in band 3, a JUMP relabel, a pin over the hut door |
| `tiers` | `template.propCount` (phone 10, desktop 20); no god rays, no AO |
| `assets` | none: no ground sets, no KTX2 table, no asset globs, no downloaded art |
| saves | one shard key, `template.notes` |

## Its custom code, and why

Each piece shows one rung of the API. None of it is meant to ship.

| File | Shows |
|---|---|
| `plugin.ts` | the three hooks, the declaration merges, `buildEquipment`, every `ctx` verb |
| `weapons/TemplateWhip.ts` | a custom weapon (`extends Weapon`) from `blocks.viewmodel` + `blocks.melee`; its heavy applies `effect.poison` |
| `weapons/TemplateLantern.ts` | a Tool in the off hand with its own action, `template.lantern.toggle` |
| `species/greyBlob.ts` | a species row, a look row with a rig contract, a `CreatureBrain` with two `StrikeSpec`s (point, lane) |
| `combat/encounters.ts` | an `EliteBrain` and a `BossBrain` with two HP phases, checkpoint and retry |
| `quest/install.ts` | a two-step quest (reach the hut, beat the blob) with a five-coin reward and a shard-scoped save |
| `world/build.ts` | registry pieces: a hut with box colliders, a door (piece + interactable), a ramp with stair treads, props |
| `world/climate.ts` | a `DayCycle` and a `Weather` with two states |
| `look/render.ts` | an `extend` look that passes the engine chain through, with a gradient dome and linear fog via `patchShader` |
| `audio/cues.ts` | a cue map that points every cue at kit sounds |
| `playground/JumpCourse.ts` | a playground: three pads that collide only while it is open |
| `debug.ts` | one Debug row (`template.oil`) |

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms). No `ceilings`: a new shard has none. See `budgets.ts`.

## Look

Grey-box: flat-shaded primitives, a plain gradient sky, linear fog, a neutral grade, no LUT.

## Tests

- `test/shards/_template/contract.test.ts` boots it headless through every stage.
- The gate's `_template` job boots it on `macos-15`, walks to the hut, kills the blob and runs the leak test
  (`scripts/test-template-gate.mjs`).

## Open asks

- E357 Z1 / Z4: the gate's template job green on every push.
- E357 Z3: a fresh agent builds a fifth shard from this folder and the docs alone.
