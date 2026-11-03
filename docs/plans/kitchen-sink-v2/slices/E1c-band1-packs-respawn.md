# E1c: band 1 playable: Mite packs, leash, per-pack respawn, levels on spawns

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the respawn half of **LV10**
(the 90 s band respawn; night variants are E7b), **EBW5** (no respawn in view), the band-1 part of **EB4** (species,
brains, strikes, packs, anchors) and **LS2 / LS4** for band 1 (Mk I / II / III levels, the band strip).

## 1. The showcase piece

Band 1 (NE, through the East Gate; round-5 layout, round 4's 7 packs): **7 packs × 3–5 Crate Mites, L1–3, ~28 live**,
cover every ~12 m, a few packs asleep as crate stacks. Each pack: an anchor, 18 m notice, 30 m leash (walk home, heal
to full: E0c), a swarm brain that surrounds you, attack tokens (at most 2 biting at once). A cleared pack respawns
**90 s after its last kill, never while you are within 40 m of its anchor**. Kills pay XP (E0d). The band's two chests
and its Gold 1×1s are placed (contents in E1d / E13).

## 2. Engine / game / host work, just in time

Research:

- **Packs and brains are rows already.** `src/format/creatures.ts`: the `pursue` brain (`awareRadius`, `leashRadius`,
  `returnSpeed`, `stopDistance`, `:15`), group brains (`GroupBrainSchema`, `groups`), spawns with fixed `at`, `species`,
  `variant`, `brain`, `strike`, `seed` (`:57`), coordinates bounded to ±250 (`:14`, the cube). Strikes have shapes
  `arc | lane | ring | wedge | point | sphere`, `windup`, `motion`, `eligibility.jumpDodges` (`:91`, `:160`): the
  Mite's 0.6 s crouch → 3 m lunge is a `lane` strike with a windup.
- **Attack tokens** (`fight.attackers`, `src/engine/entities/fightRules.ts`, E297) cap simultaneous biters.
- **Respawn is per kind, not per pack.** `RespawnQueue` (`src/game/population/respawn.ts:21`) keys rules by kind
  (`RespawnRule { delay: { min, max }, night? }`, `src/format/populationRespawn.ts:19`) with one global out-of-sight
  distance; `ReturnGate.step` (`respawn.ts:7`) waits for `delay` and `away`. Users: Driftwood (4–15 min, the sailor
  after dark), Pine and Nalati through `nativeReturns.ts` / `pageReturns.ts`.
- No spawn row carries a level.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| spawn `level` | `level: n` on a spawn (or `levels: [min, max]` on a group, seeded per member); read only with `progression` | format `creatures.ts` |
| pack respawn | `RespawnRule.scope: 'kind' \| 'group'` (default `kind` = today); `group`: the whole group returns `delay` after its **last** member dies, only when the player is ≥ `away` from the group's anchor | format `populationRespawn.ts`, game `respawn.ts` |
| sleep pose | a spawn `dormant: { pose: 'sleep', wake: 6 }`: brain paused until within 6 m or hit | format + the brain's dormant state (pursue) |
| band strip | the band's packs, cover, chests as rows; the band's `pays` stays on (east) | showcase data |

Host bar: creatures, groups and respawn are shared with Driftwood, Pine, Nalati and the templates; the new fields are
optional. Guards: `shard-sandbox`, the cube bounds. Tests: `test/group-species.test.ts`, `src/game/population/*`
tests, `test/fixed-page-spawn-table.test.ts`; new `pack-respawn.test.ts` (last kill + 90 s, never within 40 m, kind
scope byte-identical).

## 3. Other shards in this slice

| Shard | Respawn today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Driftwood | per kind, 4–15 min; the sailor `night` | none (scope defaults to `kind`) | seeded population replay: same spawn ids, positions, due times | **low**: the queue's pending entries are saved; `scope` absent reads as today |
| Pine, Nalati | per kind through the native / page returns | none | same replay | low |
| Templates | the blob has no return | none | `wildshard validate` | none |

## 4. Done when, hours, blockers

**Done when:** a walk through band 1 on a served build fights all 7 packs; a cleared pack comes back 90 s after its
last kill and never in view; a pack that loses you walks home and heals; XP and levels show; every other shard's
population replay is identical; the walk baseline reports 0 stuck in band 1.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex) | 6 h | 10 h (Opus: band ground, cover, crate stacks; rows) | **30 h** |

**Blockers:** E0c, E0d (levels and XP), E0h (the cap), E1b (the Mite), W0a/W0b (the East Gate).

## 5. Risks

- 28 Mites and 12 awake: a sleeping pack counts as not awake until it wakes; E0h's ranking must not freeze a pack you
  are fighting at the edge of 40 m.

## 6. Questions for Jake

1. **Respawn rule.** (a) 90 s after the pack's last kill, never within 40 m of its anchor (your 19h); (b) a fixed timer
   per pack whether you're near or not. **Recommended (a):** already decided; it is listed because the 40 m distance is
   new (no pop-in in view).
