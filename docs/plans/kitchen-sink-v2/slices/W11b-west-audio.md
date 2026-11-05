# W11b: west audio (hub and west music, ambience zones, traversal sounds)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the west half of the audio mini
plan: **W19a** (named stings) and **W19d** (one-genre set) of the old **W19**; **AU1–AU5** for the west cues. W19b, c, e
and f (band layers, boss/elite scene fields, metal impacts, combat cue rows) are east. M8.1/M8.2 (Nalati's scene,
Pine's cabin ambience) are not touched by these rows and wait.

## 1. The showcase piece

| Piece | West content |
|---|---|
| Music | `hub` (warm strings and horns, D major, 92 bpm) and `west` (pizzicato and woodwinds, G major, 104 bpm), calm + tension stems, orchestral (MiniMax Music 3, two seeds a cue); `night` and `storm` slots for the west's night and natural storms |
| Stings | `newBest` (a PB on any board), `questComplete` (the tour quest, W1b), `pickup` (Gold cube, reuse) |
| Ambience zones | hub (low HVAC air, flag halyards, obelisk hum, bot chirps at the givers), west (light wind, far machinery), the squeeze cave (`wet` ~0.45), each toy's positional loops |
| SFX (~30 of the plan's ~95) | lift clank + hum, spinner, slider, conveyor loop, jump-pad launch, grapple fire / latch / reel, zip run, board hum, trick landed, combo up, grind, plate click, gate open, crate topple, skittles, see-saw creak, chest open, bench sit, Gold chime, buy, locked, Scrip coins, ring hit (range), steel plate clang, bale ignite, parry clang |

Every new generic SFX goes into the shared `best` set (19k); MOSS-SoundEffect v2 and Stable Audio 3 Medium both
generate each, the better take ships (AGENTS.md). Credits are licence conditions (`engine/client/audio/credits.ts`).

## 2. Engine / game / host work, just in time

Research (the audio mini plan's §1 audit, re-checked): `src/format/audio.ts` (463 lines: `music` slots with calm /
tension stems and `selection` rows, `zones`, `scene`, `patches`), `src/format/audioScene.ts` (342),
`engine/client/audio/SetScore.ts`, `Stems.ts`. **Stings are four fixed names** (`pickup`, `death`, `chunk`, `dawn`). A missing
genre falls back to synth. Positional loops ≤ 32 per zone set.

| Gap | Shape | Layer |
|---|---|---|
| W19a named stings | `stings: [{ id, file }]` (≤ 12) on the set's manifest and the cue map; the four old names stay as ids | format `audio.ts`, engine score |
| W19d one-genre set | `set.genres: ['orchestral']` plays under every music setting (synth stays synth if Q1 says so) | format + engine `SetScore.ts` |
| PB sting cue | the records host (W3a) raises `record.best`; a cue row maps it to `newBest` | data |

Guards: none new. Tests: `test/declared-audio-score.test.ts`, `test/declared-audio-set.test.ts`,
`test/declared-audio-gameplay.test.ts`, `test/declared-audio-ambience.test.ts`, `test/audio-catalogue-manifest.test.ts`,
`test/boot-audio-packs.test.ts`.

## 3. Other shards in this slice

The four sting names keep working as ids (every shard's stings unchanged; proof: an identical cue log per tick on
Driftwood and Nalati, `test/driftwood-audio-environment.test.ts`, `test/nalati-audio-data.test.ts`). New sounds in the
shared `best` set don't change any shard's cue map. No save risk.

## 4. Done when, hours, blockers

**Done when:** the hub and west cues play and cross-fade at the gates, night and storms switch slots, every west toy
has its sounds and loops, a PB plays `newBest`; download for the west's music ≤ 6 MB of the 12 MB budget; other shards'
cue logs unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 6 h | 2 h | 18 h (model runs under the model lock, picks, stems, zones; ear check) | **26 h** |

**Blockers:** the toys whose sounds it wires (W4–W10); can start on music and ambience after W0b.

## 5. Risks

- One local model at a time (AGENTS.md): music and ~30 SFX through two engines is several hours of model time; batch
  under 30 minutes each.

## 6. Questions for Jake

1. **Orchestral under every music setting?** (audio plan Q1) (a) yes, folk and piano players hear the showcase's
   orchestral score, synth stays synth; (b) the setting wins and a missing genre falls back to synth. **Recommended (a).**
2. **New generic sounds into the shared set** (audio plan Q4; you ruled yes for SFX in 19k): confirmed as the default
   for the west's traversal and UI sounds, robot voices stay showcase-only.
