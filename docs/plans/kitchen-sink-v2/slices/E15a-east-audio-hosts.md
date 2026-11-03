# E15a: east audio hosts (layers by band, boss and elite scene fields, metal impacts, combat cues)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the east half of the old
**W19**: **W19b** (layers by a scene field, `band` 1–6), **W19c** (the boss path writes `scene.boss`, the elite host
`scene.elite`, so each picks its slot by row), **W19e** (`metal` impacts and clangs), **W19f** (cue rows on
`damage.failed` and the outcome, XP, level-up, Scrip and shop), and **M8.3** (boss slots) plus the Pine / Nalati parts
of **M8.1 / M8.2** that these rows touch. W19a and W19d landed in W11b.

## 1. The showcase piece

Stand-in content (the real cues are E15b): the east bands' music layers rise with the band you stand in, an elite fight
switches to its slot, the Titan's slot gains its layers per phase, sword hits on robots clang as metal, DEFLECT / DODGE
/ crit / XP / level-up / Scrip each have a UI cue.

## 2. Engine / game / host work, just in time

Research (the audio plan's §1 audit, re-checked):

- `src/format/audio.ts` (463 lines): `music` slots with calm / tension stems, `selection` rows over scene fields (first
  match wins), `zones`, `scene`, `patches`; boss `layers` gain **by boss phase 1–3 only** (Pine's Antler King). Engine:
  `src/engine/audio/SetScore.ts`, `Stems.ts`, `scoreSelection.ts`, `score/score.ts`.
- **Scene fields are written per shard** (Nalati's `audio.scene` kind; Pine's King layers): no boss or elite host
  writes them.
- **No metal impact**: ranged impacts map `metal` to the `stone` kind (`src/engine/combat/view/rangedFeel.ts:33`); melee
  impacts pick `wood | ground | flesh` and clangs `wood | stone`. `metal` exists only as a footstep surface
  (`src/engine/audio/surface.ts:13`).
- Combat events for cues: `damage.dealt` (with E0b's `outcome`), `damage.failed` (E0b), `progression.levelUp` (E0d).

Work:

| Gap | Shape | Layer |
|---|---|---|
| W19b | `layers[].gainBy: { field, values: [...] }`: any numeric scene field (`band`), phase gains read as `field: 'boss.phase'` | format `audio.ts` + engine score |
| W19c | the boss host (E12a) writes `scene.boss = id`, `scene.boss.phase`; the elite host (E8a) `scene.elite = id` while engaged | game hosts |
| W19e | impact and clang material `metal` (robots, plates, crates) with its own sample set | engine `rangedFeel.ts`, melee cues, `Cues.ts` |
| W19f | cue rows `{ on: 'damage.failed' \| 'outcome.crit' \| 'progression.levelUp' \| 'currency.gain' \| 'shop.buy' \| 'shop.locked', cue }` on the ui bus | format + engine `cueRouting.ts` |
| band field | the showcase's zones set `scene.band` (data) | showcase data |

Host bar: the score host is shared by every shard; new fields are optional. Guards: `engine-words`. Tests:
`test/declared-audio-score.test.ts`, `test/declared-audio-gameplay.test.ts`, `test/nalati-audio-data.test.ts`,
`test/driftwood-audio-environment.test.ts`; new `score-layers-by-field.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Pine | King layers by phase, written by its own code | `gainBy: { field: 'boss.phase' }`, the field written by the boss host | identical score event log per tick through a King fight | none |
| Nalati | `audio.scene` writes `boss`, `storm`, `night`, `zone` | `boss` now from the boss host; the rest unchanged | identical cue log per tick | none |
| every shard | ranged impacts on `metal` surfaces played `stone` | they now play `metal` | **a sound change**: listed per shard (Q1) | none |

## 4. Done when, hours, blockers

**Done when:** in the showcase the band layers, elite and boss slots and combat cues fire from rows; Pine's and Nalati's
score logs are identical; the metal change is Jake's pick.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 10 h (Codex) | 6 h | 0 | **16 h** |

**Blockers:** E12a (boss host), E8a (elite host), E0b / E0d (events), W11b.

## 5. Risks

- W19e changes what other shards hear when a bolt hits a metal surface; that is the one audible change in the east's
  migrations.

## 6. Questions for Jake

1. **Metal impacts on other shards.** (a) bolts and blades on metal surfaces play the new metal clang everywhere (Sky's
   vanes, Signal's machinery); (b) only the showcase's robots use `metal`, other shards keep `stone`.
   **Recommended (a):** it is a fix (metal sounded like stone), and new SFX go into the shared set by your 19k.
