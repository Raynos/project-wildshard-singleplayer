# E0a: progression rows, the level maths and the flat-parity guard (opt-in levels)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LV1** (progression rows),
**LV2** (pure formula module, golden tests), **LV11** (the system behind Developer), **LV12** (flat-profile admission
and the parity test, rewritten for ruling 19z: other shards have no levels at all, not a hidden level 1) and the maths of
levels-combat §15 (locked, 19aa). Nothing in this slice changes a fight; E0b–E0d switch the maths on.

## 1. The showcase piece

- A `progression` section in the showcase product: range 1–20, the seven attributes (VIT, STR, DEX, AGI, DEF, MDEF,
  LUK) with their L1 / L10 / L20 averages, shapes and caps (§15 table), aptitude two 1.2 / three 1.0 / two 0.8, swing
  0.4–1.6, the golden-ratio XP curve (19p), kill XP `10 × enemy L` with the gap table (0 at 6 under), death cost 25 %
  of the level's span (never a delevel), the fail / glance / crit / damage constants, the weapon base × and cadence
  table, Forge I–IV ×1.0 / 1.2 / 1.4 / 1.6, kind multipliers for the six robot kinds.
- LV11's Developer switch: the showcase itself is behind Developer, so no extra Debug row is recommended (Q2).

## 2. Engine / game / host work, just in time

Research (HEAD `83fe4ad845`):

- Nothing levelled exists. The player is `PlayerHealth` with a fixed `{ health: 100, maxHealth: 100, incomingCap:
  Infinity }` (`src/engine/shared/combat/health.ts:29`); creatures carry their authored `hp` per species variant
  (`out/_template/sections/actors/species.json`). No `progression` section is registered in `src/format/sections.ts`.
- Opt-in works by section presence: a product that ships no section gets no reader (the custom-section freeze and the
  section registry in `src/format/sections.ts`, `src/format/platformFileFamilies.ts`). A missing `progression` section
  is the whole "off" switch; no manifest flag is needed.
- Word guard: `lint/engine-words.json` (38 words) does not forbid "level", but the engine uses "level" for a map
  (`level.loaded`, `src/engine/level/`), so the engine-side field is `grade` (levels-combat §6); the format and game
  layers may say `level`.
- RNG: named streams are `gameplay | ai | spawn | cosmetic` (`src/engine/shared/core/rng.ts:68`) plus the game's `loot`
  (`src/game/shared/rng.merge.d.ts`); streams are created lazily, so a `combat` stream that is never created leaves every
  replay and snapshot as it is (E0b adds it).

Work:

| Row / module | Shape | Layer, why |
|---|---|---|
| `progression` section | `{ range: [1, 20], attributes: [{ id, shape: 'exp' \| 'front' \| 'linear' \| 'late' \| 'flat', l1, l10, l20, cap }], aptitude: { high: [1.2, 2], mid: [1.0, 3], low: [0.8, 2] }, swing: [0.4, 1.6], xp: { curve: { base, ratio }, kill: { perLevel: 10 }, gap: [...] }, death: { spanShare: 0.25 }, hit: { fail, dress, glance, crit }, damage: { kPerParDef: 2.5 }, weapons: [{ family, baseMul, cadence }], forge: [1, 1.2, 1.4, 1.6], kinds: [{ id, hp, def, mdef, strike }] }` | format `src/format/progression.ts` (new) + registry entry in `sections.ts`; pure rows, no hooks |
| level maths | `par(attr, L)`, `edge(X, L)`, `failChance`, `dressShares`, `glanceChance`, `critChance`, `critSize`, `hit(weapon, forge, atk, def, attackerL)`, `xpToNext(L)`, `killXp(enemyL, playerL)`, `deathLoss(L, xp)`, `rollGrowth(rng, L, aptitudes)` | game `src/game/combat/levelMath.ts` (new), pure, server-safe, no three.js |
| opt-in | readers install only when the section is present; a levelled product that also sets `fight.maxHitDamage` is refused (the cap would fight the maths) | format rule beside `shardSchema.ts` checks |
| golden tests | the §15 pacing targets as numbers: a common dies in ~7 swings at equal level, kills you in ~11, +3 ≈ 50 % wins, elites ×7, Titan ×22; the gap table; the XP curve's total to 20 | `test/level-math.test.ts` (new) |
| flat parity | every shipped product admits with no `progression` section and is untouched: deep-equal `DamageDealt` and rng snapshots for each shard's weapon × strike rows through `CombatPipeline.hit` before and after E0b–E0d land; PlayerHealth snapshot after 60 s; no level DOM | `test/levels-flat-parity.test.ts` (new; extended by every E0 slice) |

Host bar: `progression` has one real user (the showcase) under 19z, so it needs Jake's G595 approval as platform from
day one with a pending-user row naming the future rollout (`lint/platform-pending-users.json`, Q1). Tests 2–6 pass by
construction (no shard nouns, rows only, server-safe, kept if the showcase vanished as the documented opt-in).
Guards: `engine-words`, `layer` (levelMath stays in game), `public-index` (`src/game/package.json` exports the new
module), the ratchet. Docs: a SHARDS.md "Levels (opt-in)" section and ENGINE.md source docs for the format.

## 3. Other shards in this slice

None migrate: 19z keeps every other shard on today's flat combat. The parity test is written here and stays red-proof
for the whole E0 series: Driftwood (`fight.maxHitDamage`, the only user: `src/shards/driftwood-isle/manifest.json`),
Pine, Nalati, Nine, Sky, Signal, the three templates and the open plots all admit flat. No save risk (no new key yet).

## 4. Done when, hours, blockers

**Done when:** the showcase product validates with its `progression` section; `level-math.test.ts` reproduces the §15
pacing targets within ±1 swing; `levels-flat-parity.test.ts` is green on every product.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex) | 4 h (parity fixtures for 11 products) | 2 h | **20 h** |

**Blockers:** W0a (a product to declare into). West slices it leans on: none.

## 5. Risks

- The §15 constants were fitted on a page simulation; the golden test pins targets, not constants, so E16 can retune
  without editing tests.
- The parity test must capture today's answers **before** E0b touches the pipeline, or it proves nothing.

## 6. Questions for Jake

1. **Approve the levels system as platform with one user (G595).** (a) approve it now as an opt-in platform host, the
   rollout to other shards named as its future second user; (b) keep it as showcase-only rows with the maths in the
   showcase's AssemblyScript. **Recommended (a):** the maths runs in the damage pipeline for every hit; AS per hit would
   cost a Wasm call on the hottest path, and a second shard opting in later should be one section, not a port.
2. **The Developer row.** (a) "Levels: on / off" in Debug until your east play (E17), then deleted; (b) no row, the
   showcase is behind Developer anyway. **Recommended (b):** the whole shard is already Developer-only, and an "off"
   mode would be a second, untested combat for the showcase (E451: as few rows as possible).
