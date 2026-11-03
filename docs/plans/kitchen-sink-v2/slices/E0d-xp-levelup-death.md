# E0d: XP from kills, level-up growth and the death cost

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LV6** (experience host: XP on
`actor.died`, level-up with automatic growth, death XP loss, killer heal and reset, save keyed by shard, the road flat,
achievements), the levels half of **LV8** (`pays: false` zones; quest `minLevel` is E1g) and the "a level-up refills HP"
rule (§15). The HUD that shows it is E0e.

## 1. The showcase piece

The calibration pen's +0 robot pays XP when killed (it respawns on its post in 20 s); the +4 one pays the gap bonus.
Killing enough levels you up: HP refills, the attributes grow by `round(step × aptitude × swing)`. Dying costs 25 % of
the current level's span, never below the level's first XP. The whole west half is a `pays: false` zone.

## 2. Engine / game / host work, just in time

Research:

- Kills are `actor.died { actor, req }` (`src/engine/events/maps.ts:15`, emitted at `pipeline.ts:135`); the game's
  death listeners run in a fixed order `spine 10, ecology 20, keepsakes 30, loot 40` (`src/game/loot/deaths.ts:4`,
  `onCreatureDeath`). XP slots in as one more ordered listener.
- Kill counts and titles already exist per shard: `Progress.recordKill(kind, variant)` (`src/game/Progress.ts`,
  `progressSave` with `scope: 'shard'`, `src/game/saves.ts:11`). XP is a new slot beside it, not inside it.
- Death: `PlayerHealth.update` emits `player.died { actor, checkpoint, cause }` (`health.ts`) and the game respawns you
  at `LastPlace` (`src/game/LastPlace.ts`). The killer keeps its HP today.
- Per-shard saves: `saves.define({ key, scope: 'shard', version, schema, initial })` (`src/game/saves.ts:10`); the road
  between shards has no shard slug, so it reads as "no progression" for free (19a / 19z).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| experience host | on `actor.died` (order 15, after spine): if the dead actor has a `grade` and the killer is the player, add `killXp(enemyL, playerL) × rank` (normal 1, night shift 1.25, elite ×, Titan ×; ranks from the `progression` rows); grey (≥ 6 under) pays 0 | game `src/game/progression/experience.ts` (new) |
| level-up | at the threshold: L+1, roll growth for the seven (`levelMath.rollGrowth`, `combat` stream), clamp to caps, refill HP; emit `progression.levelUp { level, gains }` for the HUD, stings and feats | game |
| death cost | on `player.died`: lose `spanShare × span`, floor at the level's first XP; emit `progression.xpLost { amount }` (E0e prints it on the death card); the killer heals to full and resets | game |
| `pays` zones | `world/zones` row `pays: false` (box list); a kill inside pays no XP (and no Scrip, E1d) | format + game |
| save | `experience: { level, xp, attributes, aptitudes, seed }` per shard, version 1 | game `saves.ts` |
| feats | "Level 10", "Level 20" as achievement rows on `event: 'progression.levelUp'` with a `count` threshold | data (existing achievement registry, `src/format/quests.ts:23`) |

Host bar: same levels host. Guards: `engine-words` (progression events are game-layer names), `shard-names`. Tests: new
`test/experience.test.ts` (XP per kill by gap, grey pays 0, level-up refills HP, death floor, the save round-trip, the
road reads no progression), `pays-zones.test.ts`.

## 3. Other shards in this slice

None opt in; the experience host installs only with a `progression` section. The death path for flat shards is
untouched (no killer heal, no XP event): proof in the parity test (a scripted death on Driftwood, Pine and Nalati:
same `player.died` payload, same respawn point). No save risk: the `experience` key is new and written only by the
showcase.

## 4. Done when, hours, blockers

**Done when:** in the pen, kills raise XP by the table, a level-up refills HP and grows attributes, a death removes 25 %
of the span (never a delevel), the save survives a reload, the west pays nothing.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex) | 2 h | 2 h | **18 h** |

**Blockers:** E0a, E0c.

## 5. Risks

- Golden-ratio XP is steep (~60 h to 20, 19p). E16 must check the curve against the real band respawn times, not the
  page's estimate.

## 6. Questions for Jake

1. **Who counts as "the killer" when a robot dies to something else** (a fall, burn after you leave, another robot's
   slam)? (a) XP when you dealt any damage in the last 10 s; (b) only a killing blow by you. **Recommended (a):**
   burn and knockback kills are your kills, and a phone player shouldn't lose XP to a ledge.
