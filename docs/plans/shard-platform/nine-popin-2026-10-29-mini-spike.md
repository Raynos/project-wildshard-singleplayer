# Nine pop-in audit, 2026-10-29 (QB16)

Spike for [qa-2026-10-29-2 QB16](qa-2026-10-29-2-mini-plan.md). Read-only audit by a wildshard-v subagent. The bytes per
request are in the download audit (`download-audit-2026-10-29-mini-spike.md`); this page covers what is revealed too
early and why.

## Jake's words

- 14:08: *"Yeah, 9 Dragon looks completely broken to me."*
- 14:10: *"Oh, that's because a whole bunch of fucking shit just popped in. Shit that wasn't fucking loaded or built
  properly in the loading screen. What the flying fuck? Spin up a sub-agent [audit] NineDragon. Why the fuck are we not
  loading and downloading everything correctly? Like, what the flying fuck, bro? Such a shitty experience."*

Board: [art/qa-2026-10-29/qb16-nine-broken/board.jpg](../../../art/qa-2026-10-29/qb16-nine-broken/board.jpg). A and B
are Jake's 14:08 and 14:09 frames. C and D are the same spawn on Playwright WebKit (iPhone 16 Pro) against live
`8621318d9-mvtvd1tf`, at control and at control + 10 s.

## Verdict

This is not a bug. The design does it on purpose. Since `a1cd8ca02e` + `21befea911` (10-27, **D179 B**, accepted in
**G811**), Nine boots the city fabric from the coarse L1 tiles: the layout kits, alpha kits and shell, 0.71 MB for the
whole city. The **spawn ring's L0 tiles (~84 MB) are fetched, decoded and swapped in only after the player has
control**, nearest first. D179 B's own text said so: *"each spawn-view tile sharpens in place from its coarse copy, a
visible refine"*. Its reason, I2's 12 MB before-control bar, was dropped a day later (G821 made it a per-shard ratchet).
Jake's bar today reverses it: pop-in is worse than a longer load.

"Hold at loading screen" does not help. The refine queue is fenced on control, so holding the card for minutes still
leaves every L0 tile unloaded (hold run: 0 L0 files before PLAY, all of them after).

## Timeline (WebKit, live, fast network; times from control)

| t | What arrives / shows |
|---|---|
| reveal (0 s) | Coarse fabric: flat dark tower slabs with floating window / lantern / plant cards, no gate, no carved balustrade, no deck surface (the "streaks" are the wet-deck reflection over the missing deck). Same as Jake's 14:08 frame. |
| +1.24 s | L0 tile (4,4), 14.3 MB, 130k tris (`c96c4c88da`) |
| +1.49 / +1.73 s | (3,4) 9.6 MB (`2f71fbbb26`); (4,3) 12.5 MB, 146k tris (`b02bd23a91`) |
| +1.8 s | frame 189 ms (decode / upload / links of the new pieces) |
| +1.9–2.0 s | (3,3) 7.7 + 24.2 MB, 241k tris (`989edf6fb2`, `fbecdc703f`), the spawn tile itself |
| +2 s shot | the balustrade and finials are in; the gate and facades are still coarse |
| +2.3–3.1 s | (4,5) 1.2, (5,4) 1.9, (4,2) 1.2, (3,2) 10.0, (3,1) 1.6 MB |
| +3.3 s | `signs/atlas-phone.json` 0.67 MB (`f701a34b02`) and one pack (`d17d9eee60`) |
| +5 s shot | red gate / pagoda, lit facades with balconies, sky bridges, deck and real reflections: the 14:09 frame |
| +10 s | settled, 60 fps |

That is 10 L0 files, 84.3 MB, all after control. Jake's card showed PLAY at "51.2 MB of 170.4 MB" (30 %). The
denominator is honest: most of the missing ~119 MB is this fabric plus the rest of the L0 city, which the page fetches
after control on purpose. His pop came within seconds, which fits the files already sitting in his offline cache. A cold
phone at his ~2 MB/s would refine for ~40 s.

## Causes, with file:line

1. **The fabric is classed refine-after-control.** `src/shards/nine-dragon-stack/generators/worldScenes.ts:78` puts
   every `layout-*` part whose tiles are all L0 into `native-refine` (load `'refine'`). The reader then skips it at boot
   (`src/game/shardfile/worldScenes.ts:387`, measured `scene.library:whole:native-refine` 0 ms) and draws the coarse
   cover instead (`worldScenes.ts:356`, `wholeRefinementCover`).
2. **The refine queue starts only at control.** `src/game/shardfile/controlRefinement.ts:28` runs the jobs on
   `whenControl` + two frames, nearest first, one job per `buildYield`. Nothing under the loader waits for it. The
   `world ready` / Props row, Spawn program links and World program links (`src/game/session/finish.ts:184-189`) all
   finish against the **coarse** scene.
3. **The same fence holds back other spawn-near work.** Late welds (`worldScenes.ts:554-560`) and the dressing
   catalogue reads (`src/game/shardfile/sceneDressing.ts:224`) also go through `ControlRefinement`, so whatever of them
   sits in the spawn view pops too.
4. **The shader warm-up links only what the coarse scene draws.** The fine pieces' materials link in play, which is
   part of the 181 ms (Jake) / 189 ms (WebKit) frames during the pop.
5. **QA3 / QA8's caps are not the cause.** Spawn links took 751 ms and world links 602 ms, both well under their 3 s /
   6 s caps (`fb6f43a80e`, `0865113756`). Raising the caps would change nothing, because the fine geometry does not
   exist yet at the reveal.

**The 4.4 s gap after Audio** is one main-thread block between the audio step ending (`finish.ts:133`) and the
`readyFrame` step starting (`finish.ts:171`). The timeline's gap row and the "largest frame-update gap" read the same
value: 4.4 s on Jake's phone, 0.59 s on Mac WebKit. Almost all of that window is `game.start()` (`finish.ts:168`),
whose first world frame runs synchronously (`src/engine/core/Game.ts:1351`, `loop()`): the first full draw of the spawn
view, with its uploads and first-use compiles. No named step covers it. This is likely, not proven; NP-4 confirms it with
one Simulator timeline.

**Not pop-in.** The painted sky scroll drawn as a close, seamed ceiling and the crowd's dark silhouettes look the same
at 14:09. They stay in QB16's LEGACY vs SHARDFILE look board.

**Other shards.** Pine Hollow on the same harness (live, WebKit, iPhone 16 Pro) shows no visible change in the spawn
view between control and +10 s. It fetches 66 requests after control (NPC GLBs, the fire pit, a lantern, a few packs),
none of them in the opening frame. The coarse-then-refine path (`load: 'refine'`) is used only by Nine today.

## Rows

| Row | What | Fix / done when | Lane | Size |
|---|---|---|---|---|
| NP-1 | **Refine the spawn view under the loader** (reverses D179 B for the spawn view; Jake 10-29: pop-in is worse than a longer load) | `ControlRefinement` gets a loader fence: every job whose tile or weld lies in the spawn view (the spawn ring's L0 tiles, the fabric, late welds, dressing catalogue reads) runs and publishes before `world ready`, under its own loading row ("Spawn detail"), before Spawn / World program links, so those link the fine materials. Only jobs outside the spawn view stay after control. Done when, on live-equivalent WebKit iPhone 16 Pro, cold and warm: no L0 file of tiles (3,1)-(5,4) is fetched after control, shots at control and control + 10 s match in the spawn view, and no frame is over 100 ms from 2 s after the reveal. Nine's before-control download ratchet (G821, 19.2 MB) rises to the measured value, citing Jake's 10-29 words. Focused test in `test/world-scene-refinement.test.ts`: a spawn-view job never waits for control. | folded into MF5 | M |
| NP-2 | **Refines out of view only, or faded** | Jobs past the spawn view that refine in play swap a coarse piece only while it is outside the frustum, or cross-fade (dither) it over ~0.4 s. Never a hard pop in view. Done when a walk from spawn over the first two bridges (WebKit, 4 shots) shows no visible swap, and the decode / upload per job stays inside the in-play slice (no frame over 100 ms past 2 s). | wave 2 MF13 | M |
| NP-3 | **Retire the D179 B wording** | `decisions.md` G811's Nine line and BURN-DAMAGE-LIST D179 say "superseded by Jake 10-29 (QB16): spawn view whole before the reveal". The generator comment at `worldScenes.ts:68-70` describes NP-1. Lands in NP-1's commit. | Opus sp-o3 (with MF5) | S |
| NP-4 | **Name and split the 4.4 s block after Audio** | One iOS Simulator Web Inspector timeline (sim-lane, cold) confirms the block is `game.start()`'s synchronous first frame (`Game.ts:1351`). If it is, the first draw runs inside a named step ("First world frame"), and its uploads / compiles are sliced over frames under the loader, so the loader's clock keeps ticking. Done when the card names the step and the largest frame-update gap on a cold Simulator load is under 1 s. | folded into MF5 | M |
| NP-5 | **No PLAY at 30 % without saying why** | With NP-1, the DOWNLOAD line splits "needed for the spawn view" (must be 100 % at PLAY) from "streams in play". Folded into the download audit's rows if it already has one. Done when Jake's card at PLAY reads 100 % of the spawn-view share. | folded into MF4 | S |
