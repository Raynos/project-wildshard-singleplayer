# E12e: the five shipped boss intros re-homed on the timeline

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs IN-GAME-CUTSCENES **IC2**
("port today's moments onto the timeline: `BossBrain` intro and `QuestRewardBeat`"), its **IC0** inventory (a portrait
clip of each moment before) and **M5.6** (five intros → timeline, Opus). A migration slice.

## 1. The showcase piece

None directly; after this slice the timeline has real users and the Crate Titan's intro (E12h) is the sixth.

## 2. Engine / game / host work, just in time

Research (IN-GAME-CUTSCENES §1): the five intros, all first-person eases with the letterbox and name card:

| Boss | Shard | Intro today |
|---|---|---|
| the Golden King | Nalati | 4.2 s / 1.4 s: the lid opens, he rises, the light shaft pulses (`combat/goldenKingRow.ts` `intro`) |
| the Storm Titan | Nalati | 3.6 s / 1.3 s: rises, kneels, eyes ignite, the first bolt (`combat/stormTitan.ts` `intro`) |
| the Antler King | Pine | the camera eases to his ribcage (`runtime/antlerKing.ts`) |
| the Storm Roc | Sky | 1.5 s / 0.3 s; `combat/stormRoc.ts` **snaps** the yaw, no ease |
| the Dune Matriarch | Signal | rises from the basin (`data/matriarchFight.ts`) |

Plus Driftwood's finale reward view (`QuestRewardBeat`, `src/game/server/quest/reward.ts`, 2.5 s ease, golden-hour clock ease,
7 s hold) and the template boss (1 s). Driftwood's Captain has a 0 s intro.

Work: each intro becomes a cutscene row of `pov` shots reproducing today's ease (and the Roc's snap as a cut), named by
its boss row's `intro`; `QuestRewardBeat` becomes a cutscene with a clock track; `BossBrain`'s intro state plays the
named cutscene; the old per-boss `intro(t, short)` focus functions are deleted once each matches.

Host bar: the timeline gains five users. Guards: ratchet. Tests: per-boss intro tests; the IC0 clips vs after-clips
(side-by-side frames, Opus reads every panel).

## 3. Other shards in this slice

| Shard | Moments | Proof | Save risk |
|---|---|---|---|
| Nalati | Golden King, Storm Titan | before / after portrait clips, side by side; the skip and short intro on retry | none |
| Pine | Antler King | same | none |
| Sky | Storm Roc (keeps its snap) | same | none |
| Signal | Dune Matriarch | same | none |
| Driftwood | the finale reward view | same; the ShardComplete card still follows | none |
| Template | 1 s intro | validate | none |

## 4. Done when, hours, blockers

**Done when:** every moment above plays from a cutscene row and matches its IC0 clip; no boss keeps an `intro()`
function.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 2 h | 16 h (Opus: capture, match, read) | 0 | **18 h** |

**Blockers:** E12d, E12a–E12c (the bosses on one path).

## 5. Risks

- "Look the same" is the bar (G415: similar, not identical); exact frame parity is not required, a glitch-free match is.

## 6. Questions for Jake

None: IC2 is "port, don't change"; better intros for these five are IC13, parked in their plan.
