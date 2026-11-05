# W3d: parry and riposte (opt-in per weapon row), the parry dummy

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the parry part of the old
**W6** ("parry window + stagger on the melee profile"; the audit: "Parry is only an animation clip; no mechanic") and
the parry clauses of levels-combat §15 (0.15 s window, Parry Gyro 0.22 s, a riposte). Stagger and crits are E0.

## 1. The showcase piece

- A **parry dummy** in the melee yard: a training figure on a post that swings a padded arm every 3–5 s with a
  readable 0.6 s tell; a parry inside the window flashes PARRY, knocks the arm back and opens a 1 s riposte (a free
  heavy hit at ×1.5 damage on a dummy). Drill "Parry ten" with a PB.
- The showcase sword and spear rows declare `parry`.

## 2. Engine / game / host work, just in time

Research: no parry exists. The only hit is an animation clip name in `src/game/client/systems/viewmodel/clips.generated.ts`.
The melee family is `src/engine/server/combat/meleeProfile.ts` (`MeleeProfile`: damage, reach, combo, lunge, sweep,
`dodgeKick`), `Melee.ts`, `sweptMeleeCore.ts`. The touch HUD has DODGE and JUMP on the right-thumb arc
(`src/engine/client/player/TouchControls.ts:41-44`); there is no block or guard input.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| `parry` on a melee profile | `parry?: { window: 0.15, riposte: { seconds, damageMul }, clip }` (absent = today's weapon, unchanged) | engine `meleeProfile.ts` (numbers only) |
| parry input | a hold on the attack button? or a new GUARD button (Q1) | engine input + HUD (E332 notice; a HUD change needs your pick first) |
| incoming strike tell | strikes carry `parryable: true` and a tell time; the dummy's swing is a declared strike | format `combat/strikes` (already rows) |
| riposte | a timed damage multiplier on the next hit (E0 turns it into a guaranteed crit) | engine combat pipeline |
| words | "PARRY" floating word (the HC3 floating-numbers piece's first word; shared HUD) | engine UI, E332 |

Host bar: the melee family is shared (Driftwood, Nine, Sky, Signal, the template); the new field is optional, so every
other shard keeps today's combat (ruling 19z). Guards: `engine-words` (no "sword" in engine), the HUD rule (E332).
Tests: `test/melee-author-base.test.ts`, `test/held-arms-platform.test.ts`; new `melee-parry.test.ts` (window edges,
riposte expiry, a profile without `parry` is bit-identical).

## 3. Other shards in this slice

Every melee shard (Driftwood, Nine, Sky, Signal, Nalati's sabre, the template) declares no `parry`, so nothing changes
for them; the proof is the bit-identical test above plus their existing melee tests. If Q1 picks a new button, it shows
only when the equipped weapon declares `parry`, so no other shard's HUD changes. No save risk.

## 4. Done when, hours, blockers

**Done when:** the parry dummy's swings can be parried inside the window, PARRY shows, the riposte lands harder, the
drill records a PB; other shards' melee unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Opus: input, feel, words) | 2 h | 4 h | **18 h** |

**Blockers:** W3a. The HUD part waits for your pick (Q1); the mechanic and dummy don't.

## 5. Risks

- 0.15 s is about 4–5 frames at 30 fps in Low Power Mode; the window must be measured in sim time, not frames, and
  checked on a 30 fps capture.

## 6. Questions for Jake

1. **How you parry on touch.** (a) a GUARD button above DODGE, shown only with a parry weapon; (b) tap attack during the
   tell (no new button); (c) swipe toward the strike. **Recommended (a):** a dedicated thumb target is the only one
   that reads at 30 fps; (b) collides with combo taps. A board of the three goes to you first.
2. **Parry outside the showcase.** (a) opt-in rows only, no other shard gets parry now (19z); (b) give Driftwood's sword
   parry too. **Recommended (a):** your ruling keeps other shards' combat as it is.
