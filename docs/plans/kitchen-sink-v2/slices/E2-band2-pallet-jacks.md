# E2: band 2: Pallet Jacks (charges, stun into cover, tine toss)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs band 2 of **EB1 / EB3 / EB4**
(model, clips, rows), **LS2 / LS4** for L4–6, the band-2 rows of **LW1 / LW2 / LW4 / LW5** (Scrip 5, the Tine, the
contract, two chests) and the tier-1 quest **Survey the Yard** (L4, W1b's discover step).

## 1. The showcase piece

Band 2 (NE, round-4 grid): **6 packs × 2–3 Pallet Jacks, L4–6, ~15 live**, 3 m walls between close packs (no aggro
through them), lanes between crate stacks so charges read. The Jack: low, wide, forklift tines, four hydraulic legs,
1.4 m, 1,200 / 900 / 300 tris. Tines lift + a red lane 0.9 s → a charge with knockback; **a charge into cover stuns it
1.5 s** (back hydraulics exposed); tine toss (0.7 s, a short lobbed strike). Pays 5 Scrip and a Tine; the "Forklift
Patrol" contract; Survey the Yard (discover 4 places in bands 1–2). The Big Pallet pit is reserved (E8b).

## 2. Engine / game / host work, just in time

Research:

- The charge is the **`ram-grazer` brain** (`src/format/grazers.ts:18-19`, `{ strike, thinkDivisor, … }`), shipped by
  Sky Reach's goat (`src/shards/far-reach/generators/rows/brains.ts:8`, strike `far.goat.ram`). Re-engage after a
  charge is E297's rule (`src/engine/server/entities/fightRules.ts`).
- A `lane` strike with `motion: { speed, track, overshoot, skid }` (`src/format/creatures.ts:160`) is the charge; the
  red lane is the strike's telegraph decal.
- **No "stunned by hitting cover" exists**: a charge that meets a collider skids (`skid`) and continues.
- Knockback is a request field (`DamageRequest.knockback`, `pipeline.ts:29`) with the player impulse
  (`PlayerHealth.impulse`, `health.ts`).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| wall stun | strike `motion.onBlocked: { stun: 1.5, exposes?: 'rear' }`: a moving strike that meets a static collider stops and stuns its owner (`AnimalSim.stagger` with a long stun) | format `creatures.ts` + engine strike motion |
| weak side | `exposes: 'rear'` → hits from behind during the stun take ×1.5 (a hit-zone row, reused by E4's tank and E12g's knees) | format + game levels stage |
| tine toss | an `arc` strike with `motion.delay` (a lob); no projectile body needed | data |
| band rows | species, brain, strikes, packs, walls, chests, the contract row, payouts, salvage | showcase data |

Host bar: strike motion is shared (Sky, Driftwood); `onBlocked` is optional. Tests: extend the strike-motion tests
(grep `test/*strike*`); new `strike-blocked-stun.test.ts`.

## 3. Other shards in this slice

| Shard | Touched | Proof | Save risk |
|---|---|---|---|
| Sky Reach (goat ram) | strike motion gains an optional field | seeded fight replay of a goat charge: identical | none |
| Driftwood (boars and bears charge through E297) | same | `test/fight-rules.test.ts`, replay | none |

## 4. Done when, hours, blockers

**Done when:** band 2 plays on a served build; a Jack that charges into a crate stack stuns and takes ×1.5 from behind;
Survey the Yard completes; Sky's goat and Driftwood's chargers replay unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 2 h | 18 h (Opus: the Jack, 10 h; band ground and walls, 6 h; rows 2 h) | **28 h** |

**Blockers:** E1c (the band template), E1a. Runs beside E3–E6.

## 5. Risks

- Knockback near band 2's 3 m walls can pin you; the charge's knockback is horizontal and short (≤ 3 m), checked on the
  walk baseline.

## 6. Questions for Jake

1. **Stun into cover as the band's lesson.** (a) yes: lure the charge into a stack, then punish (the enemies plan);
   (b) no stun, just dodge. **Recommended (a):** it gives band 2 a skill beyond "dodge", and Big Pallet's pillars build
   on it.
