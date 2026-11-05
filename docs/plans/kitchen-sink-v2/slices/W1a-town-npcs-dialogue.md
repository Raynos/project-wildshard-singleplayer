# W1a: six dev-bot NPCs and their dialogue

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the NPC part of the old **W5**
and **M2.5** (Sky / Signal / Nine NPC rows, nothing to move), parent §2 19e/19y.

## 1. The showcase piece

| NPC (placeholder names) | Where | Rows |
|---|---|---|
| G1 Yard Boss (tier 1, L1–6) | gate plaza, quest board | `actors/npcs` `posed-talk` + dialogue |
| G2 Surveyor (tier 2, L7–12) | gate plaza | same |
| G3 Shift Boss (tier 3, L13–20) | gate plaza | same |
| Tinker Rook | Main Street stall | `trader` kind (stock arrives in W2b) |
| Weapons-shop keeper | Main Street, facing Rook | `trader` kind (stock in W2b) |
| Stable hand | inside the Stable Gate | `talk` (the loaner horse in W10a) |

Six dev-bot figures (Blender scripts, toon look, small idle loops), `figures` rows (`src/format/figures.ts`, host
`src/game/client/systems/npc/figureRows.ts`), talk prompts, 3–6 dialogue nodes each with flag-conditioned lines. Robots chirp,
no voice lines (19k).

## 2. Engine / game / host work, just in time

Research: NPC rows are an existing shared host. `src/format/npcs.ts` (546 lines) admits three kinds, `talk`,
`posed-talk`, `trader`; dialogue lines carry a `when` condition over **flags only** (`src/format/quests.ts:8`
`condition {all, any, none}`). Users today: Driftwood (`out/driftwood-isle/sections/actors/npcs.json` 2 KB), Pine
(5 KB), Sky (1.7 KB), Signal (1.3 KB). Tests: `test/declared-npc-talks.test.ts`, `test/quest-figures.test.ts`,
`test/entered-quest-figures.test.ts`.

- **No host change is needed for W1a.** "Lines change as you level" (19e) needs a level atom in `when`; levels don't exist
  until E0, so W1a writes flag-conditioned lines and E0 adds `level ≥ n` to the condition grammar (one atom, its own
  slice there).
- **Stale identity found:** Driftwood's NPC row carries `install.file: "src/shards/driftwood-isle/quest/Spine.ts"`
  (`npcs.ts:109` `file: text`), a path that no longer exists (`src/shards/driftwood-isle/quest/` is gone). It is a
  label, not an import, so it is harmless, but a showcase author copying Driftwood would copy a TS path. Rename the
  field to `id`-only or drop it in this slice (Q2).

Layer: shard data + Blender models. Guards: `wildshard/shard-sandbox` (no TS), the layout check.

## 3. Other shards in this slice

Only if Q2 is (a): drop `install.file` from the NPC row schema and from Driftwood's generator
(`src/shards/driftwood-isle/generators/questStory.ts` writes it). Proof: `test/declared-npc-talks.test.ts`,
`test/driftwood-quest-figures-product.test.ts`; talk to Wendell in game. No save risk (the field is not saved).

## 4. Done when, hours, blockers

**Done when:** in Developer all six NPCs stand at their round-4 spots, idle, face you, and each talk opens its dialogue;
the stable hand's and the shopkeepers' lines say "come back when…" until their slices land; a portrait capture of the
plaza with the three givers.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 1 h | 2 h | 14 h (Opus: six bot figures + idles; Codex: dialogue rows) | **17 h** |

**Blockers:** W0b (the plaza and street exist).

## 5. Risks

- Six new rigged figures cost draw calls in the plaza; one shared rig and skin atlas for all six keeps it to a few
  draws.

## 6. Questions for Jake

1. **NPC names.** Two placeholder sets exist: the quests mini plan's Quartermaster Ada / Warden Scout, and round 4's
   board labels G1 Yard Boss, G2 Surveyor, G3 Shift Boss. (a) round 4's job titles as the givers' names, plus Tinker
   Rook, a weapons keeper and a stable hand in the same voice; (b) a naming pass by you. **Recommended (a):** the job
   titles say which tier each gives (Yard Boss L1–6, Surveyor L7–12, Shift Boss L13–20), with Gunsmith Brass and Stable
   Bot Hay for the other two.
2. **Driftwood's stale `install.file` path.** (a) drop the field from the NPC schema now; (b) leave it. **Recommended (a):**
   it points at a deleted TS file and teaches the wrong thing to the first data-only shard.
