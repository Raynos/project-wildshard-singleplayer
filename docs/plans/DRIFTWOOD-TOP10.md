# Plan: Driftwood top 10 (E126)

**State:** `in progress` 2026-09-25.
- **Done:** 8 (E129), and 10's first four bugs (E125).
- **In flight:** 7 (E130) and 10's phone shadows (E128).
- **Needs pick:** 9's complete screen (E132).
- **Not started:** 1–6.
- **Timing:** the GAME-NORMALIZATION full feature freeze starts once Pine Hollow is merged. Rows still open then pause until the freeze ends.

## Read this first

The user asked for the top 10 things to improve Driftwood (E126, 2026-09-24). The list comes from the E108 audit (`docs/design/audit-e108/driftwood.md`) and the phone audit (`art/driftwood-audit/round-1-phone/README.md`).
- Rows 1–5 fix how it *feels* in the first ten minutes: the fights are the "chaos".
- Rows 6–10 are polish.

It overlaps FINISH-LINE's D-rows. This file is the working list for Driftwood; FINISH-LINE stays the umbrella.

**Rules**
- Each row gets its own ask file when it starts.
- Screenshots and boards are iPhone portrait only (the game is played as a Safari PWA on iOS).
- A taste call goes to the user as a board before it ships.

## The ten

| # | What | Ask | Status | Evidence / next |
|---|---|---|---|---|
| 1 | **One set of fight rules for every enemy.** An enemy faces you and winds up before it strikes. At most 2 attack at once. An arrow at the screen edge warns of an attacker you can't see. Boars circle back and fight instead of fleeing (`AnimalManager.ts` ~644/675/727) | — | **not started** | the biggest feel fix; FINISH-LINE D1 |
| 2 | **Damage caps, and the bear moved.** No single hit takes more than ~20% of your health: bear 45 → ~20, sailor 18 → ~14. You survive about 5 hits from any common enemy. The brown bear moves off the wreck path (`driftwood-isle.ts:207`) | — | **not started** | FINISH-LINE D2 |
| 3 | **A readable wreck fight.** The camera stays out of the planks, and nothing hits you through a beam (use the physics `lineOfSight`) | — | **not started** | FINISH-LINE D2 |
| 4 | **Death and respawn.** A short fade, a "Killed by …" card, and you respawn at the last place you discovered, not the pier (`main.ts:769`) | — | **not started** | FINISH-LINE D4 |
| 5 | **The first three minutes.** Control hints appear the first time each control matters: move, jump, attack, lock, dodge, talk. A practice crab on the sand path. A shorter walk down the pier | — | **not started** | FINISH-LINE D3 / P3 |
| 6 | **Hide the dev screens in normal play.** The "LOCAL BUILD · UNUPLOADED" panel, the fps readout and the boundary gate (probably E36) show only with `?dev`. The loading steps use Driftwood's words, not Pine Hollow's | — | **not started** | FINISH-LINE P1 |
| 7 | **HUD and map.** Pop-ups stack under the quest chip (**A1**). The map draws paths and structures (**B1**; closes E105). Shorter labels with a ◆ status, nudged apart so they don't overlap (**C**). M opens and closes the Map, I opens Inventory, Esc pauses (**D**). Settings that don't apply are hidden (**E**) | E130 | **in flight** (subagent) | picks A1, B1, C, D, E made 2026-09-25; board `art/hud/round-10-toast-placement/board.jpg` |
| 8 | **Wendell and the sword.** Wendell turns to face you. The sword rests lower and is put away while you talk | E129 | **done**: commit `4d3fc77`, live in `683c765-mugv1zua` | sheet `progress/239-e129-wendell-sword-before-after.jpg`. **The user should check the sword height on the phone** (a taste call: tell us if it's too low or too high) |
| 9 | **An ending, and reasons to keep playing.** (a) A "Driftwood complete" screen after the reward view, with **Keep exploring** as the main button, plus "Next shard: Nalati" and "Title screen". (b) Reasons to wander: gulls fly toward places you haven't found, sea glass is counted on the map, and the map marks found and unfound places | E132 | (a) **needs pick** (A / B / C); (b) **not started** | board `art/quest/round-2-complete-screen/board.jpg`. The trigger design is in E132. The same agent builds the pick. Time played and total defeats need new counters |
| 10 | **Phone visual bugs.** Animals in Explore World, foam rings, blue gully faces and the horizon seam are done (E125). Coarse phone shadows are in flight (E128). The style items T1–T6 (banner, rock colours, driftwood logs, orange halo, waterfall, ocean facets) are the user's call | E125, E128 | **E125 done** (`03c583b-muggdq8j`) · **E128 in flight** | T1–T6 need a board when the user wants them |

## Related, running alongside (not in the ten)

- **E133**, error handling: a system that throws gets switched off instead of freezing the game, errors are reported to the inbox, and a "Reload here" crash screen. It's in flight and applies to every shard.
