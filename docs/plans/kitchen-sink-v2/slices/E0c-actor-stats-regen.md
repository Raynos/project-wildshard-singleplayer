# E0c: attributes on actors, HP = VIT, regen and the leash reset

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LV5** (actor stats: player max
HP via `setMaxHealth`, grade and the seven on each `AttributeSet`, strike `damage` → multiplier when levelled; boss
phases as attribute effects are E8a / E12a), the regen rule of §15 ("5 s after the last hit, full in 12 s") and the
"every enemy that loses you walks home and resets to full" rule. Growth on level-up is E0d.

## 1. The showcase piece

The calibration pen's two robots (E0b) get real species stats: a level, the seven attributes from the kind table
(`kinds` in E0a's section), HP from VIT × kind. You arrive with a rolled level-1 character (base values, the two 1.2s
and two 0.8s shuffled per shard, saved). Walk away mid-fight: the robot walks home and heals to full; you regen 5 s
after the last hit, full in 12 s.

## 2. Engine / game / host work, just in time

Research:

- `PlayerHealth` is fixed at 100 / 100 (`src/engine/shared/combat/health.ts:29`) with `setMaxHealth(max)` already there
  (`:61`, it raises current HP by the gain). Regen is hard-coded: **4 HP/s after 6,000 ms** (`:77`). The snapshot is
  `version: 1` (`:41`); `restore` throws on any other version.
- `HealthAttributes extends AttributeSet` (`pipeline.ts:12`, `engine/client/combat/effects/types.ts`): an open record, so the
  seven attributes and `grade` can live on it without a schema break, but the snapshot copies every key, so a levelled
  player's snapshot grows (a levelled-only change).
- Creature HP: `AnimalSim` exposes `health` / `maxHealth` / `damageTakenMul` from its variant row
  (`src/engine/shared/entities/AnimalSim.ts:243`). Strike damage is a flat authored number (`combat/strikes` rows, e.g. the
  template's `template.blob.bump` damage 8).
- **Leash and walk home already exist** in the `pursue` brain row (`awareRadius`, `leashRadius`, `returnSpeed`,
  `src/format/creatures.ts:15`) and in elites (`leashR`, `src/format/eliteFeature.ts:12`), but a creature that walks
  home keeps its lost HP; only the elite host heals to full on leash.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| player character | on first entry a roll from the `combat` stream: aptitudes per attribute, base values; saved per shard (`saves.define({ scope: 'shard' })`, `src/game/shared/saves.ts:10`) as `experience` (with E0d's XP) | game `src/game/progression/character.ts` (new) |
| HP = VIT | levelled only: `setMaxHealth(VIT)` on entry and level-up; the snapshot gains the attributes (version 2, read only by levelled products; flat products keep writing version 1) | engine `health.ts` (a version-2 reader) + game |
| regen | `regen: { after: 5, fill: 12 }` as a levelled row; the engine's `update` reads `after`/rate from attributes with today's 6 s / 4 HP/s as the default | engine `health.ts` (numbers only) |
| species stats | `kinds` rows → each spawn's `AttributeSet` at its level (VIT × kind HP, DEF/MDEF × kind, STR/DEX from par); strike `damage` read as a **multiplier** of the level's strike base when levelled | game `src/game/combat/actorStats.ts` (new), format `creatures.ts` (a levelled reading, no new field) |
| leash reset | a creature that leashes heals to full on reaching home (levelled products; an opt-in `resetOnLeash: true` brain field otherwise) | engine `AnimalSim` / the brain's return state |

Host bar: same host as E0a. Guards: `engine-words` (`grade`, not level, in engine), the ratchet. Tests: new
`test/actor-stats.test.ts` (L1/L10/L20 averages over 10k rolls within the §15 table; a Mite at L2 has the kind's HP),
`test/player-health-v2.test.ts` (v1 snapshots still restore; v2 only on levelled products); extend the parity test
(PlayerHealth after 60 s on every flat product, regen 4 HP/s after 6 s unchanged).

## 3. Other shards in this slice

| Shard | Touched | Proof | Save risk |
|---|---|---|---|
| every flat product | `health.ts` regen reads a default; snapshot stays v1 | parity test: PlayerHealth snapshots equal after 60 s with a hit at 0 s | **medium**: a v1 snapshot must restore exactly; fixture of a mid-regen save |
| Driftwood, Pine, Nalati, Sky, Signal, templates (creatures with `pursue` / leash) | the leash reset is opt-in, off for them | `test/fight-rules.test.ts`, the population replays | none |

## 4. Done when, hours, blockers

**Done when:** a new showcase character shows its rolled stats in a debug read-out (the Character tab is E0f); the
pen's robots have kind HP and hit for kind strikes; walking away resets them; regen matches 5 s / 12 s; flat shards'
health is byte-identical.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex) | 2 h | 2 h | **18 h** |

**Blockers:** E0a. Runs beside E0b (different files except the parity test).

## 5. Risks

- Two snapshot versions for one class: keep v1 the default writer so no flat save ever changes shape.

## 6. Questions for Jake

1. **Does leaving a fight heal the robot only, or you too?** (a) both: the robot walks home and resets; you regen on
   the 5 s rule (§15 as written); (b) the robot keeps its damage for 30 s so you can come back. **Recommended (a):**
   it is what you locked, and (b) invites kiting the leash line.
