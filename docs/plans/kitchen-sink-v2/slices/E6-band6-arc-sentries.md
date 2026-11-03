# E6: band 6: Arc Sentries (the duellist that parries; shock bolts)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs band 6 of **EB1 / EB3 / EB4**,
**LS2 / LS4** for L16–18, **LS7** (the Arc Sentry's parry; its "by PRE" is retired: §15's DRESS gives a parrying
defender 25 % of fails), **LV9** (AS queries for grade and attributes, the parts the Sentry's brain needs) and the band-6
economy rows (Scrip 15, the Arc coil). The road gate into band 6 stays (19y).

## 1. The showcase piece

Band 6 (SE top): **5 packs × 2 Arc Sentries, L16–18, ~10 live**, on open duelling ground behind the kept road gate. The
Sentry: a tall thin biped with a shock lance, 2.3 m, 1,800 / 1,400 / 450 tris. Lance crackle 0.6 s → a 3-hit combo; a
lunge 0.8 s; **it parries** (a PARRY on 25 % of your failed melee hits while it faces you, then a 0.5 s riposte); bow
and rifle bypass the parry. Its bolts **shock** (0.4 s stagger, E0g). The night shift's L19 variant fills the L19 gap
(E7b; 19n keeps it).

## 2. Engine / game / host work, just in time

Research:

- The `skirmisher` brain (Driftwood's crab, `src/shards/driftwood-isle/generators/brains.ts:3`) circles and darts in;
  the Sentry is a skirmisher with a combo.
- **AS queries today** (`src/format/scriptQueriesV2.ts`, `src/engine/script/queriesV2.ts`): the decision host reads
  declared `reads` (`src/format/decisionScripts.ts:30`), with no grade, attributes or "facing the player" read.
- The parry dress is E0b's stage (25 % of fails when the defender "parries and faces you"); the defender's "parries"
  flag and facing are what the Sentry needs.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| defender parry | species `parries: { share: 0.25, arc: 90, riposte: { strike, delay: 0.5 }, melee: true }`: the stat stage dresses a fail as PARRY and queues the riposte strike | format + game levels stage |
| AS reads | `grade`, `attr.<id>`, `target.facing` as read names in the v2 query set (for brains that choose by them; the Sentry's combo picks by your distance and facing) | format `scriptQueriesV2.ts`, engine `queriesV2.ts` |
| shock | lance strikes `onHit: effect.stun 0.4` (E0g) | data |
| rows | species, combo strikes, lunge, packs, the road-gate band | showcase data |

Host bar: AS reads are shared (every decision script); new read names are additive. Guards: `engine-words` (`grade`),
the decision-module cap (W0e). Tests: `test/` script query tests, new `defender-parry.test.ts` (25 % of fails, only
facing, never ranged).

## 3. Other shards in this slice

None migrate: new read names and an optional species field. The script ABI is not bumped (WASM-HOST H13 is not run
during this plan, migration map §4). Proof: every shipped decision module admits unchanged (`wildshard validate` on
every product).

## 4. Done when, hours, blockers

**Done when:** Sentries duel, parry 25 % of your failed melee hits while facing you and riposte, arrows and rifle
rounds are never parried, bolts shock; band 6 is reachable through the road gate.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 0 | 18 h (Opus: the Sentry 10 h, ground 6 h, rows 2 h) | **26 h** |

**Blockers:** E0b, E0g, E3 (bolts as projectile strikes), W3d.

## 5. Risks

- A parry that fires on a phone player's spammed taps feels unfair; the share applies to *failed* hits only, so a
  levelled-up player sees it rarely (the gap table).

## 6. Questions for Jake

1. **Does the Sentry's parry stagger you?** (a) a 0.5 s riposte strike you can dodge; (b) a parry also stuns you for
   0.4 s. **Recommended (a):** a stun after your own miss stacks two penalties; the riposte is readable and dodgeable.
