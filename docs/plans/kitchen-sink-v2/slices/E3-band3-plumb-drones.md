# E3: band 3: Plumb Drones (flyers; creature projectiles that roll the dice)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **EBW2** (creature projectile
strikes: nails, rivets, arc bolts, on the projectile rows, rolling the dice), band 3 of **EB1 / EB3 / EB4**, **LS2 / LS4**
for L7–9, the band-3 economy rows and the tier-2 quest **Drone Season** (L7, down 8 Plumb Drones).

## 1. The showcase piece

Band 3: **6 packs × 3 Plumb Drones, L7–9, ~18 live**, high perches; it teaches the bow and the rifle. The Drone: a
quad-rotor box with a nail gun and a plumb-bob tail, 0.9 m, 900 / 700 / 250 tris, kites at 12–18 m, 3–5 m up. A
plumb-line laser 0.7 s → a 3-nail burst (each nail rolls); under 30 % a dive ram (0.8 s whine). Pays 7 Scrip and a
Rotor; the "Drone Season" quest and contract.

## 2. Engine / game / host work, just in time

Research:

- **Flyers are rows**: `burst-flyer`, `orbit-diver`, `patrol-diver`, `diver` (`src/format/flyers.ts`, via
  `creatures.ts:8`), shipped by Sky Reach's wisp (`burst-flyer`, `far.wisp.burst`) and ray (`orbit-diver`)
  (`src/shards/far-reach/generators/rows/brains.ts:12-17`).
- **Creature projectiles exist once, as a special case**: Driftwood's monkey throws coconuts from a perch
  (`perch-hunter`: `throwRadius`, `throwDuration`, `throwCooldownMin/Max`, `src/format/brains.ts:55-57`;
  `src/shards/driftwood-isle/generators/brains.ts:17`); "the loader's authority over perches, projectiles and tokens"
  (`brains.ts:60`). Player projectiles are rows (`AmmoRow` flight, `src/engine/combat/ammo.ts`;
  `projectileFlight.ts`, `projectileLaw.ts`, `projectileContact.ts`).
- No strike row fires a projectile; a creature "ranged" strike today is a `sphere` / `point` with a range.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| projectile strike | strike `projectile: { ammo: <AmmoRow id>, count, spread, interval, speed }`: fired at the strike's active time from the creature's muzzle, flown by the projectile law, contact → `combat.hit` with the strike's damage (so it rolls on levelled products) | format `creatures.ts` + engine `projectileFlight` / `projectileContact` (creature as source) |
| telegraph | the laser line is the strike's telegraph (a `lane` decal from the muzzle) | data |
| dive ram | a second strike gated `when: { hpBelow: 0.3 }` (a strike eligibility row) | format |
| migration | Driftwood's coconut throw becomes a projectile strike row with the same flight | Driftwood data |

Host bar: creature projectiles get two users (Driftwood's monkey, the showcase), test 6 passes (rows, no loader-owned
special case). Guards: `engine-words` (no "nail" in engine). Tests: `test/` perch-hunter tests, projectile law tests;
new `creature-projectile-strike.test.ts` (each nail a separate request; a dodge in flight avoids it).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Driftwood | the monkey's coconut throw inside the perch-hunter loader | a projectile strike row, same arc, speed and damage | seeded monkey fight replay: same throws, hits, damage; a look in game | low (no saved projectile state) |
| Sky Reach (wisp, ray) | flyer rows | none | replay | none |

## 4. Done when, hours, blockers

**Done when:** Drones kite and fire 3-nail bursts that each roll (DEFLECT / DODGE on you at the right shares); the dive
ram fires under 30 %; Drone Season completes; Driftwood's monkey throws as before.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex) | 2 h | 18 h (Opus: the Drone 10 h, perches 6 h, rows 2 h) | **34 h** |

**Blockers:** E1c, E0b (rolls), W3b (projectile rows). E5a and E6 reuse the projectile strike.

## 5. Risks

- 18 Drones × 3-nail bursts is the most projectiles in any shard; the projectile pool and E0h's awake cap bound it,
  measured on a 30 fps Chromium sample in the band.

## 6. Questions for Jake

1. **Can you shoot nails out of the air?** (a) no, nails are fast and small (dodge or take them); (b) yes, a parry
   deflects them. **Recommended (a):** parry is a melee skill (W3d), and the Drones are the band that teaches ranged
   weapons and moving.
