# E0b: the hit stage (fail roll, DEFLECT / DODGE / PARRY, glance, crit, damage)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LV3** (the engine half:
`DamageRequest` outcome and damage type, `damage.missed`, the `combat` rng stream), **LV4** (the stat stage; its
"streak guard" is dropped, 19n), the miss-feel rows **LVF1** (slip), **LVF2** (deflect clang and recoil), **LVF5**
(the hurt arc on you) and **LVF6** (the one-time DEFLECT hint). Floating words are E0f; parry *input* is W3d.

## 1. The showcase piece

A **calibration pen** just inside the East Gate: two training robots on posts (an equal-level one and a +4 one) that
take hits and swing back slowly. Hitting them shows the four outcomes: a clean hit, a crit (yellow, bigger), a glance
(grey, half), a DEFLECT (silver sparks, clang, 45 ms stop, blade recoil, 0 damage) and a DODGE (the robot slips aside).
Its swings at you show the same both ways (the silver hurt arc). No XP (the pen is `pays: false`, E0d).

## 2. Engine / game / host work, just in time

Research:

- **The pipeline** is `CombatPipeline.hit` (`src/engine/combat/pipeline.ts:119`): `damage.admit` → line of sight →
  `damage.modify` (an ordered ask chain) → `applyDamage` → `damage.dealt` + `actor.died` (`:134-135`). The chain today:
  order **0** death-fade refusal (`:85`), **1** boss-god (`:100`, opt-in), **10** dodge i-frames (`:101`), **40**
  `damageTakenMul` on creatures (`:86-92`), **50** the species/elite `damageMul` adapter (`:93-98`), **90** `incomingCap`
  (`:103-108`), any authored `DamageRuleDef` at its own order (`:110`), the Signal shield and the bossRow shield
  (`src/game/plugin/ui.ts:1330`, `src/game/shardfile/bossRow.ts:89`) and the phase rules (`src/engine/ai/phases.ts:61`).
- `DamageRequest` (`pipeline.ts:27-32`) has `amount`, `headshot`, `stagger`, `knockback`, `weaponId`, `moveId`,
  `sourceTags`; **no outcome, no damage type, no miss**. A refused hit returns `null` and emits nothing.
- The only "MISS" today is the aim miss in `src/engine/ui/Combat.ts:22` (a shot that lands in a tree); ruling 19r keeps
  that word for aim misses only.
- `AnimalSim.stagger(dir, strength)` (`src/engine/entities/AnimalSim.ts:264`) already shoves a creature back with a stun
  timer: the DODGE slip is a short version of it (LVF1).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| request fields | `DamageRequest.outcome?: 'clean' \| 'crit' \| 'glance' \| 'deflect' \| 'dodge' \| 'parry'`, `damageType?: 'physical' \| 'energy'` (absent = today) | engine `pipeline.ts` (generic words) |
| a failed hit | the stat stage returns the request with `amount: 0, outcome: 'deflect' \| 'dodge' \| 'parry'`; the pipeline emits a new `damage.failed` event and skips `applyDamage` (a 0 hit never kills, never flinches) | engine `pipeline.ts`, `events/maps.ts` |
| `combat` rng stream | `RngStreams.combat`, created on the first levelled roll only | engine `core/rng.ts` (a merge row in game) |
| the stat stage | one `damage.modify` answer at **order 30** (before today's 40/50 multipliers, so species `damageTakenMul` still applies on top): FAIL roll with the DEX/AGI nudge and lucky saves, DRESS (parry share if the defender owns parry and faces you; DODGE = AGI/(AGI+DEF) − 0.1·max(0,g), floor 0.1; DEFLECT the rest), GLANCE, CRIT and size, DAMAGE `weapon × Forge × ATK × K/(K+DEF)`, floor 1 on a landed hit | game `src/game/combat/statStage.ts` (new), installed only when `progression` exists |
| the looks | DEFLECT: spark burst, clang (W19e `metal`, E15a; until then the stone clang), 45 ms hit-stop, blade recoil (`engine/combat/view/SweptMelee.ts`); DODGE: a 0.25 s slip (`AnimalSim.stagger` with no stun); on you: a silver arc (`engine/ui/HurtArc.ts`) | engine view, generic words (Opus) |
| first hint | one-time "DEFLECT: hit harder targets at your level" hint (`engine/ui/FirstHints.ts`), levelled products only | engine UI (E332 notice) |

Parry: the player's parry and riposte are W3d's mechanic; here the dress only *labels* a failed enemy hit as PARRY when
the player is inside W3d's parry window, and the riposte's "guaranteed crit" becomes a crit flag on the next request.

Host bar: the stage is part of the levels host (E0a's approval). Guards: `engine-words`, `no-raw-*`, the ratchet. Tests:
new `test/stat-stage.test.ts` (each outcome from fixed rolls, order 30 runs before 40/50, a flat product never
reaches it, a fail emits `damage.failed` and no `damage.dealt`); extend `levels-flat-parity.test.ts`.

## 3. Other shards in this slice

No shard opts in, so the stage never installs for them. The proof is E0a's parity test (every product's weapon ×
strike rows deep-equal, rng snapshots equal: the `combat` stream never exists on a flat product) plus the existing
`test/fight-rules.test.ts`, `test/melee-author-base.test.ts`. The two new optional request fields are ignored by every
existing reader. No save risk.

## 4. Done when, hours, blockers

**Done when:** in the calibration pen, a run of 200 scripted swings at the +4 robot gives fail / glance / crit shares
within 2 points of §15's formula; DEFLECT and DODGE read at 30 fps on a capture; the parity test stays green.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 18 h (Codex stage; Opus 6 h of it for the looks) | 2 h | 4 h (the pen, two posts) | **24 h** |

**Blockers:** E0a. Soft: W3d (the PARRY dress lights up when W3d's window exists; DEFLECT and DODGE don't need it).

## 5. Risks

- Order 30 is new; a shard rule authored at 30 would interleave. The stage only installs on levelled products, and the
  format refuses an authored `DamageRuleDef` at order 30 on a levelled product.
- Ranged misses: a bolt that physically misses is an aim MISS (no roll); only a bolt that connects rolls. The roll must
  run at the contact, not at fire time, or the bow's aim and the dice double-count.

## 6. Questions for Jake

1. **Does a DEFLECT stop the blade?** (a) a 45 ms hit-stop and a recoil (the miss-feel page's E); (b) no stop, sparks
   only. **Recommended (a):** it is the "you hit armour" read the miss-feel page settled; 45 ms is under two frames at
   30 fps, so combos don't stall.
