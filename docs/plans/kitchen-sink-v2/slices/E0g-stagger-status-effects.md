# E0g: the stagger bar and the status effects (burn, shock, blast)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the stagger and status lines of
levels-combat §15 ("every body has a bar … full = 1.5 s stun taking ×1.25"; "burn = damage over 3 s · shock = 0.4 s
stagger · blast = knockback; no stacking, a nameplate tint only") and finishes W3b's pitch bolt on actors (W3b set
straw bales alight only).

## 1. The showcase piece

- The calibration pen's robots get a **stagger bar** (thin, under the nameplate HP): hits fill it, STR faster; full =
  a 1.5 s stun in which they take ×1.25; it drains when idle. A Mite's bar is small, a Riveter's big (per kind).
- **Status on hits:** pitch bolts burn a robot (damage over 3 s, an orange tint), Welder torches burn you (E4), Arc
  Sentry bolts shock (0.4 s stagger, E6), the Titan's slam blasts (knockback, E12g). No stacking.

## 2. Engine / game / host work, just in time

Research (correcting W3b's "no burn exists outside one boss"):

- **Status effects already exist in the engine.** `EffectService` (`src/engine/client/combat/effects/EffectService.ts:55`,
  `apply(target, id, source, { duration })` at `:124`) runs `instant | timed | permanent` effects with a `period` and
  `tickDamage` routed through `combat.hit` (`effects/types.ts:10-12`); starter rows ship `effect.stun`, `effect.burn`,
  `effect.poison`, `effect.bleed`, `effect.slow` (`src/game/server/systems/effects/starterRows.json`). They are bound to the
  player (`bindPlayerEffects`, `EffectService.ts:18`) and to owned charms (`src/game/server/loadout/effects.ts`).
- Missing: **a hit that applies an effect** (no strike or ammo row names one), creatures as effect targets on the
  levelled path, and the "no stacking, tint only" rule as data.
- **Stagger exists per hit**, not as a bar: `DamageRequest.stagger` (`pipeline.ts:29`) and `AnimalSim.stagger(dir,
  strength)` (`AnimalSim.ts:264`, a lerped `STAGGER_STUN` and a shove). Nalati's arena boss has its own `burnSeconds` /
  `fireDps` (`src/format/bossProfiles.ts:292`, `arenaScriptRows.ts`).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| on-hit effects | `onHit: [{ effect: 'effect.burn', seconds: 3 }]` on strike rows (`combat/strikes`), ammo rows (`AmmoRow`, W3b's `effects`) and weapon moves | format `creatures.ts` strike schema, `engine/shared/combat/ammo.ts`; engine applies via `EffectService.apply` |
| creature targets | `AnimalSim` actors become `EffectTarget`s (tags, attributes, periodic ticks) | engine |
| no stacking | levelled rows set `stacking: 'refresh'` and one status per target at a time | data (EffectDef already has `stacking`) |
| stagger bar | `stagger: { max, drain, stun: 1.5, takenMul: 1.25 }` per kind; each landed hit adds `amount × (STR edge)`; full → `AnimalSim.stagger` with the stun and a `state.staggered` tag the stat stage reads for ×1.25 | game levels host + engine `AnimalSim` (a generic stun call, already there) |
| blast | `knockback` on the request (exists) with a levelled strength | data |
| tints | the nameplate provider (E0f) reads the target's status tags | game |

Host bar: `EffectService` is already shared (player effects, charms); this adds a second kind of source. Guards:
`engine-words`, the ratchet. Tests: new `test/on-hit-effects.test.ts` (a pitch bolt burns a creature for 3 s through
`combat.hit`, refresh not stack; a flat product's ammo without `onHit` is unchanged), `stagger-bar.test.ts`; existing
`test/` effect tests for the player.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Pine | bolts, the tool effects, `effect.*` on the player | none (no `onHit` row declared) | `test/isolated-shard-pine-*-values.test.ts` | none |
| Nalati | the arena boss's own `burnSeconds` / `fireDps` | **folds into `onHit: effect.burn`** only when E12c re-homes the Storm Titan; not here | — | — |
| every shard | `AnimalSim` becomes an effect target but no row applies anything | none | parity test (damage + rng deep-equal) | none |

## 4. Done when, hours, blockers

**Done when:** pitch bolts burn a pen robot for 3 s with an orange tint, hits fill its stagger bar to a 1.5 s stun
that takes ×1.25, statuses never stack; every flat shard's combat is unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex rows; Opus 4 h for the bar and tints) | 6 h (fixtures over Pine's effects and Nalati's arena) | 2 h | **22 h** |

**Blockers:** E0b, E0f (the bar lives under the nameplate). W3b (the ammo rows).

## 5. Risks

- Periodic ticks route through `combat.hit`, so a burn tick would roll the dice; §15 says damage over time never rolls:
  the stage must pass `env`/effect-sourced requests straight through.

## 6. Questions for Jake

1. **Does burn tick show numbers?** (a) small orange tick numbers (one per second); (b) the tint only, no numbers.
   **Recommended (b):** §15 says "a nameplate tint only", and six floats on screen is already the cap.
