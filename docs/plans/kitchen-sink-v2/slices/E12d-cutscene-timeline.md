# E12d: the cutscene timeline core (camera shots, letterbox, skip, cue track, rows)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the old **W12** ("IN-GAME-
CUTSCENES IC1–IC4": IC1 the engine timeline core, IC3 the SDK data and a boss row's `intro` naming a cutscene, IC4 the
caption and cue tracks). IC2 (porting today's intros) is E12e. The IN-GAME-CUTSCENES plan owns the rows and is a
**draft** that "starts only when Jake says so" (`docs/plans/IN-GAME-CUTSCENES.md:3`): Q1.

## 1. The showcase piece

A **test cutscene** in the Titan gate plaza (round 5's surface gate): three shots of the empty plaza and the 18 m portal
arch (`pov` ease, a `rig` crane, a cut), letterbox, HUD hidden, a line of caption, a sting on a cue, **hold to skip**.
It proves the timeline before the Titan's 12 s intro (E12h) uses it.

## 2. Engine / game / host work, just in time

Research (IN-GAME-CUTSCENES §1, re-checked):

- **There is no camera but the player's**: every moment today eases the player's own yaw and pitch
  (`src/game/server/Boss.ts` `faceToward`, k = 1 − e^(−3.2 dt)); there is no player body (first person). No
  `src/engine/cinematic/` exists.
- Pieces to lift: the letterbox, name card, skip ring and fade in `src/engine/client/ui/BossBar.ts` (`showNameCard`, `setSkip`,
  `fade`); `BossBrain`'s intro state with `SKIP_HOLD = 0.6` (`src/engine/shared/ai/BossBrain.ts`); `QuestRewardBeat`'s
  carried camera (`src/game/client/quest/reward.ts`); dialogue lines (`src/engine/client/quest/view/ui.ts` `DialogueBox`).
- `src/engine/client/render/regionCinematic.ts` is a post-effect chain (shafts, fringe, grain) for cinematic regions, not a
  camera timeline.

Work:

| Piece | Shape | Layer |
|---|---|---|
| timeline | `src/engine/cinematic/`: a clock, a camera owner (borrows the render camera, returns it), shot kinds `pov` (ease the player's view) / `rig` (an authored camera on keys) / `hold` / cut; a control track (input lock, HUD hide, skip, letterbox from `BossBar`); snapshot / restore | engine (IC1) |
| rows | `cutscenes: [{ id, shots: [{ kind, from, to, seconds, look? }], captions?, cues?, skip: 'hold', short?: { from: shot } }]`; a boss row's `intro: <cutscene id>` | format + `@wildshard/sdk/cutscenes` (IC3) |
| tracks | captions in the dialogue style, music / SFX events on the timeline clock (`audio` cue ids) | engine + format (IC4) |
| docs | an ENGINE.md section, a SHARDS.md section, the template's example | docs |

Host bar: an engine feature (data in, no shard nouns); users after E12e: five bosses and the Crate Titan. Guards:
`engine-words`, `no-url-switch` (the timeline's Debug row only), E332 (HUD hiding). Tests: unit tests on the clock and
shot interpolation; the template example validates; a headless run of the test cutscene ends with the camera returned.

## 3. Other shards in this slice

None (IC1 "no shard uses it yet"). The template gains its example; `wildshard validate` passes.

## 4. Done when, hours, blockers

**Done when:** the plaza test cutscene plays from rows with letterbox, captions, a cue and hold-to-skip; the camera is
returned exactly; a portrait clip goes to Jake (the timeline is a new look moment: D3 of the cutscene plan).

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 26 h (Opus: camera and feel; Codex 8 h of rows) | 0 | 2 h | **28 h** |

**Blockers:** Jake's go on IN-GAME-CUTSCENES IC1–IC4 (Q1). Otherwise independent: it can start in phase 1.

## 5. Risks

- A `rig` camera in a first-person game: the player's weapon viewmodel and the HUD must be hidden for every rig shot,
  or the first shot shows floating arms.

## 6. Questions for Jake

1. **Start IN-GAME-CUTSCENES' engine rows (IC1–IC4) inside the Kitchen Sink east?** The plan is a draft that waits for
   your word; 19j wants the Titan's cutscene. (a) yes: run IC1–IC4 here (owned by that plan), the generated-video rows
   (IC6–IC11) stay parked; (b) no: the Titan gets today's first-person intro (a camera ease, letterbox and name card).
   **Recommended (a):** the Titan intro needs shots off the player (the assemble, the high wide from the stands), and
   IC1–IC4 are in-engine only, no model time.
