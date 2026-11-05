# E8a: the elite host normalised (typed drops, named stings, attribute phases, interruptible wind-ups)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the elite part of the old
**W11** ("elites G"), **EBW3** (an interruptible wind-up: damage in a window cancels an elite action), **EBW7** (an
elite spawned by a director stage, used by E11c/E11d), **LV5**'s "boss phases as attribute effects" for elites, the
elite half of **LE7** (fixed rewards `{ first, repeat }`) and **M4.4** (Nalati's elites). The first showcase elite is
E8b.

## 1. The showcase piece

None on its own: E8b's Big Pallet is the first user, in the same week. What the host gives every showcase elite: a lair;
aware → engaged → leash (walk home, heal to full); phase 2 at 50 % after a 1 s invulnerable beat; the NAMED ELITE
banner and bar; a time rule; a play-time respawn; a drop; a sting.

## 2. Engine / game / host work, just in time

Research:

- `src/format/eliteFeature.ts` (605 lines): each fight `def { id, name, epithet, lair { x, z, r }, awareR, engageR,
  leashR, rule: always | dusk | night | storm, respawnMin, once?, signature, phase2, drop { skin, skinName, weapon,
  blurb, trophyName? } }` (`:10-16`), at most 8 fights (`:59`), observations `engaged | leashing | phase2 | clock | god |
  dusk | night` (`:24-26`), and a `legacy` block (fields, rivals, lanes). Presentation stings are a closed picklist
  `pickup | death | chunk | dawn` (`:20`). Game: `src/game/server/Elite.ts` (653), `eliteSystem.ts` (330),
  `src/game/server/quest/eliteFeature.ts`, `elitePage.ts`, `eliteDecisions.ts`, `eliteStreams.ts`; engine
  `src/engine/server/ai/eliteRoster.ts`, `src/engine/shared/entities/eliteBrain.ts`. Save: `elitesSave { timer, discovered,
  skinTaken, kills, retired }` (`src/game/shared/saves.ts:18`).
- Users: Pine (`generators/eliteFeatureRows.ts`, `sourceOutput.ts`), Nalati (`generators/eliteEntryRows.ts` via
  `src/sdk/eliteEntryRows.ts`), the template (`combat/encounters` kind `elite`, "Greyback").
- The drop is weapon-skin-shaped (`skin`, `weapon`); no Scrip, title, part or trophy-wall grant.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| drops | `drop: { first: [grants], repeat: [grants] }` with W2b's typed grants (`finish`, `owned`, `item`, `currency`, `title`); the old `{ skin, weapon, … }` read as `first: [{ finish }]` | format + game `Elite.ts` |
| named stings | the sting picklist → W11b's named stings (W19a) | format |
| attribute phases | on levelled products a phase may set `attributes: { def: ×, str: × }` (E0c's actor stats) | format + game |
| interruptible wind-up | an elite action `interrupt: { window, damage }`: ≥ `damage` dealt inside the window cancels it (the Foreman's whistle) | format + engine `eliteBrain.ts` |
| stage spawn | an elite with `spawn: 'stage'` has no lair timer; a director stage's `{ spawn: <elite id> }` places it (E11b) | format + game |
| storm | `rule: 'storm'` and the `night` rule read E7b's world phase (storm counts as night when the product says so) | game |

Host bar: 3 users already (Pine, Nalati, template); typed drops fix test 3 (no weapon-skin-shaped parameters). Guards:
`engine-words`, `shard-names`. Tests: `src/game/elite-*.test.ts`, `test/` elite tests (grep `elite`), new
`elite-drops.test.ts`, `elite-interrupt.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Pine | elite fights with skin drops | drops as typed grants (same finishes) | seeded elite fight replay (phases, leash, respawn timer); a finish pickup in game | **medium**: `elitesSave.skinTaken` must map to the first grant taken |
| Nalati | elite entries + the five elite skins | same | replay; finish DOM in the Bag | medium, same |
| Template | Greyback encounter | none (no drop) | validate | none |

## 4. Done when, hours, blockers

**Done when:** every elite field above is data; Pine's and Nalati's elites fight, leash, respawn and drop exactly as
before from old saves; the template validates.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex) | 10 h | 0 | **22 h** |

**Blockers:** E0c (attributes), W2b (typed grants), W11b (named stings), E7b (world phase; soft).

## 5. Risks

- The `legacy` block holds per-shard field slots; leave it as is (it is listed debt) and add no new shard-shaped field.

## 6. Questions for Jake

None: normalising the elite host is approved Wave 1 work.
