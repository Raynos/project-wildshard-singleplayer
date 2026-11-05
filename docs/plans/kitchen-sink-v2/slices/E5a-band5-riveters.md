# E5a: band 5: Riveters (a frontal plate block, the slam ring, the rivet gun)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **EBW1** (frontal-arc block on
a creature: plate ×0.2, knocked aside by a heavy or a parry for 2 s), band 5 of **EB1 / EB3 / EB4**, **LS2 / LS4** for
L13–15 and the band-5 economy rows (Scrip 12, the Rivet plate, the contract, chests). The stealth yard (band 5's
patrols, the keycard) is E5b. Quest: **Rivet Count** (L13, bring 10 Rivet plates, Forge III unlocked).

## 1. The showcase piece

Band 5 (SE top, round 5): **5 packs × 2–3 Riveters + 4 patrols, L13–15, ~16 live**. The Riveter: a broad biped with a
riot plate and a rivet gun, 2.2 m, 2,200 / 1,600 / 500 tris. **Plate up**: hits on its front take ×0.2; a heavy attack
or a parry knocks the plate aside for 2 s. A **slam ring** 1.0 s → a shockwave you jump. The **rivet gun** (laser
0.7 s) uses E3's projectile strikes. Flank it or break the plate. Pitch bolts (E4's Nozzles) burn it.

## 2. Engine / game / host work, just in time

Research:

- Strike `ring` shapes with `eligibility.jumpDodges` exist (`src/format/creatures.ts:91`, `:160`): the shockwave you
  jump needs only rows.
- **No frontal block on a creature exists.** The nearest are boss shields: Signal's Matriarch refuses every hit while
  shielded (`src/game/client/plugin/ui.ts:1322-1330`) and `bossRow`'s shield (`src/game/server/shardfile/bossRow.ts:89`), both
  all-or-nothing, both bosses.
- Heavy attacks are a move id on the request (`moveId`), parry is W3d's window; E4 added `zones` with `facing`.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| guard arc | species `guard: { arc: 120, mul: 0.2, breakOn: ['move.heavy', 'parry'], broken: 2 }`: a `damage.modify` answer (order 45, after the stat stage, before `damageTakenMul`) scales a hit from inside the arc; a breaking hit sets `state.guard-broken` for 2 s | game levels host (or the engine pipeline as a generic `DamageRuleDef` with a facing test: Q1) |
| plate look | the guard state drives a clip (plate up / knocked aside) | data |
| rows | species, the slam ring, the rivet projectile, packs, patrol routes (shared with E5b) | showcase data |

Host bar: one user (the showcase) unless Q1 folds the Matriarch's shield in. Guards: `engine-words`. Tests: new
`guard-arc.test.ts` (front ×0.2, back ×1, heavy breaks it for 2 s, a flat product never installs it).

## 3. Other shards in this slice

None migrate unless Q1 (b): then Signal's Matriarch shield becomes a `guard: { arc: 360, mul: 0 }` row and its
`ui.ts` answer is deleted (proof: the Matriarch fight replay, phases and shield beats identical).

## 4. Done when, hours, blockers

**Done when:** Riveters block from the front, a heavy or parry opens them for 2 s, the slam ring is jumpable, the
rivet gun fires; Rivet Count completes and unlocks Forge III.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 10 h (Codex) | 2 h (Q1 b: the Matriarch's shield) | 18 h (Opus: the Riveter 10 h, band 6 h, rows 2 h) | **30 h** |

**Blockers:** E3 (projectile strikes), E4 (hit zones), W3d (parry), E1c.

## 5. Risks

- On a phone you can't easily circle a robot; the plate break (heavy or parry) is the main answer, so heavy attacks
  must read clearly on touch (W3a's melee).

## 6. Questions for Jake

1. **One shield row for robots and bosses?** (a) the guard arc is a showcase-first levels row; (b) make it the shared
   shield row and move Signal's Matriarch shield onto it (360°, ×0) in this slice. **Recommended (b):** it gives the
   host its second user and deletes a plugin answer, at about 2 hours.
