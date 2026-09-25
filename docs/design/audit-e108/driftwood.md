# Driftwood Isle: feel audit (E108, build f86b4c3, 2026-09-24)

## (a) What it feels like

I step off a boat onto a long sunny pier. Turquoise water, a huge ringed planet in the sky, palms and a hut on a cliff: it looks like a finished Wind Waker postcard.

Nothing tells me the controls. A chip reads "WHO LIT THE FIRE? CASTAWAY 164 M", so I walk. That's 14 seconds of pier, then sand, then plank stairs up the crag. It's smooth, and I never catch on anything. At the top, Wendell talks in a tidy text box, sends me after three glyph shards, and gives me an achievement for saying hello.

Then I look for a fight, and it falls apart:
- The beach boars charge me, bite, then sprint 25 m away. I can't catch them.
- The crabs are great: a *thwack*, a tiny freeze on impact, a blade trail, "16 KILL", and the crab spins off.
- A brown bear I never saw kills me in four seconds. There is no death screen; I'm just back on the pier.
- In the wreck's hold, something keeps hitting me from behind a beam while my face is pressed into planks.

The island is lovely. The fights feel random.

## (b) First run, condensed

- **0:00–0:19 Loading** (18.3 MB from cache). The loading steps still list Pine Hollow things: sky photo, pine branch cards, "Forest 0 trees", cabins, crossbow (`01-loading-early.jpg`). The title screen is beautiful (`02-title-menu.jpg`).
- **0:20 Pier spawn** (`03-enter-world-t0.jpg`). No controls hint anywhere. A dev panel ("PROJECT WILDSHARD · CHUNK PLAYTEST · LOCAL BUILD · UNUPLOADED") takes up the top-left corner.
- **0:50 Sand path, then stairs** (`05-sand-path-start.jpg`). About 45 s of walking to the hut, with 0 stuck spots.
- **1:10 Wendell.** "E TALK TO WENDELL" shows while he stands behind you; he never turns to face you (`06-plateau-arrival.jpg`, `08-wendell-dialogue.jpg`). Every line takes two presses, because the first press only finishes the text.
- **1:40 Quest starts.** The "NEW QUEST" and "ACHIEVEMENT" pop-ups appear underneath the minimap (`09-quest-started-hud.jpg`).
- **~3:00 Beach boars.** They go alert, run, stop, run again. I landed 0 swings in 30 s, twice.
- **~5:00 Wreck Cove** (`15-crabs-tidepool.jpg`). A brown bear killed me in 4.4 s (3 hits of 45), and I was back at the pier.
- **~7:00 Crabs**, after I moved the bear away by hand for testing (`sheet-16-crab-fight.jpg`). A small crab takes 5 front hits, 6 damage each, because its shell halves damage from the front. It snapped at me once for 10.
- **Lock-on and dodge.** Lock-on (Z) and dodge (Alt) both work (`sheet-19-21-lock-swing.jpg`, `20-dodge-mid.jpg`).
- **~9:00 Wreck hold.** The sailor landed 7 hits of 18 from behind the beams, and I died (`sheet-23-sailor.jpg`).
- **Phone.** The touch controls are clean and readable (`sheet-30-phone.jpg`).
  - A boar charged within 2 s (health 100 → 75), then ran 27 m away (`32-phone-E36-boar-beach.jpg`).
  - My health dropped again from something off screen.
  - Night and golden hour both work (`sheet-34-35-night-golden.jpg`).

## (c) Scorecard

| Area | /10 | Why |
|---|---|---|
| Camera | 7 | A wide view with gentle bob. The camera kicks on hits, and the dodge roll reads well. But the sword covers the centre-right of the screen, where enemies and NPCs usually stand, and the camera clips into planks in the wreck. |
| Movement | 7 | Walk 4.3 m/s, sprint 7.2 m/s. It starts and stops quickly. Jumps ~1.2 m, has a double jump, and steps up 0.35 m. Crisp, and I never got stuck. The pier at the start is dead time. |
| Combat | 6 | The hits have real punch: a 60–140 ms freeze on impact, a blade trail, damage numbers, ragdolls, debris. But crabs are almost the only thing you can use it on. |
| Enemies | 3 | Boars run away like prey. A bear with 320 health that never gives up sits on the quest path. Hits come from off screen. |
| World | 8 | Lots of places close together, with landmarks you can read from far away. Little leads you from one place to the next. |
| Audio (read from the code) | 7 | Almost every action has a sound: footsteps per surface, swing whooshes, a warning sound before an enemy attacks, hurt grunts from the attacker's side, sound zones, music that reacts to what's happening. |
| UI | 5 | Good on the phone. On desktop: the dev panel, pop-ups under the minimap, overlapping map labels, a map with no buildings (E105), Pine Hollow loading steps, a crossbow-only setting (Tracer bolts) in a sword game, and M opening Settings. |
| Performance | 7 | Title screen in 19 s from cache. The phone view held 60 fps in the headless browser. Desktop showed 30–60 fps, but other agents were using the machine at the time. The console had no errors. |
| Polish | 6 | Flat grey hut windows. The waterfall is still a flat strip lying on the slope. Big stretched triangles on the cove hillside (`19-lockon-crab.jpg`). Wendell stands like a statue. |

## (d) Bugs, worst first

1. **HIGH: the brown bear.** It spawns at about (126, 10) (`src/chunks/driftwood-isle.ts:207`), right beside the crabs and the wreck. It never gives up, and each hit does 45 damage (`src/entities/species/bear.ts:270`). It kills you in ~4.4 s, and the wooden sword needs ~31 hits to kill it. To see it, spawn at (118, 0) and wait.
2. **HIGH: boars can't be fought.** They use the prey behaviour: they flee once they notice you, and turn and run after every charge (`src/entities/AnimalManager.ts:644, 675, 727`).
3. **MED: the wreck hold fight is unreadable.** Hits come from behind beams, the camera sits inside planks, and the prompts overlap each other (`sheet-23-sailor.jpg`).
4. **MED: pop-ups render under the minimap** (`09-quest-started-hud.jpg`, `15-crabs-tidepool.jpg`).
5. **MED: map problems.** The "SEA CAVE SHARD" and "WRECK SHARD" labels overlap, and the map shows no buildings or paths (this confirms E105; `18-map-island.jpg`).
6. **MED: death is a silent teleport to the pier** (`src/main.ts:769–772`). No fade, no death card, and no respawn point nearer to where you died.
7. **LOW: wrong crab markers.** Inside the wreck, two "REEF CRAB · 1 M" markers show while the crabs are ~30 m away.
8. **LOW: Pine Hollow loading steps.** The loading screen still lists them (plan row V-X1 is open).
9. **LOW: M opens the wrong tab.** It opens the menu on whichever tab was last used, not the Map.
10. **LOW: Wendell and the sword.** Wendell doesn't turn to face you, and the sword covers both him and the dialogue box.
11. **Out-of-date docs.**
    - D38 says day/night isn't built. It is, and it runs by default (`src/world/DayNight.ts`).
    - The 09-18 plan says "no dodge", but dodge exists.
12. **Checked but not seen.** E36 did not show at its repro spot. E91 and E93 need the real iPhone.

## (e) Top changes, ranked by impact for the effort

1. **One set of fight rules for every enemy.**
   - Driftwood's boars circle back and attack again instead of fleeing (`AnimalManager.ts`, the `engage` code and line 727).
   - At most 2 enemies attack you at once.
   - A screen-edge warning before an off-screen hit lands (the amber telegraph idea parked in E74).
2. **Move and soften the bears.**
   - Move the brown bear off the path to the wreck.
   - Cap a single hit at ~20% of your health: bear 45 → 20, sailor 18 → 14.
   - Rule of thumb: you should survive 5 hits from any common enemy.
3. **Design the first three minutes.**
   - Show each control hint the first time it matters: move, jump, attack, lock (Z), dodge (Alt), E.
   - Put one small crab on the sand path as a practice fight.
   - Spawn ~30 m further up the pier, or arrive by boat.
4. **A proper death, and a nearer respawn.** A 1.2 s fade, "Killed by a brown bear", then respawn at the last place you discovered.
5. **Clean up the desktop HUD.**
   - Hide the dev panel.
   - Stack pop-ups under the quest chip.
   - Fix the map label overlap.
   - Draw the paths, bridge and wreck on the map (E105).
   - Name the loading steps after Driftwood.
   - Hide Tracer bolts in sword games.
   - Make M always open the Map.
6. **Get the sword out of the way.**
   - Lower its resting pose (`src/player/SwordMoves.ts`, REST from `0.27,-0.33` to ~`0.33,-0.42`).
   - Put it away during dialogue.
   - Make Wendell turn to face you.
7. **Reasons to walk between places.**
   - Gulls that fly toward places you haven't visited yet (V-M3, open).
   - A sea-glass counter on the HUD and the map.
   - Mark found and unfound places on the map.

## Verdict

Driftwood is **A Short Hike** in size and mood, painted like **Wind Waker**, and it already looks the part.

What separates it from BotW, Tunic or Hi-Fi Rush is how enemies fight. In those games an enemy faces you, warns before it strikes, takes turns, and stays until one of you wins. Here every creature plays by its own rules:
- boars flee like prey;
- the bear kills you in seconds;
- the sailor hides behind walls;
- coconuts come from off screen;
- death is a teleport.

That is the "chaos". There are plenty of systems (hoverboard, double jump, lock-on, dodge, heavy attack, harvesting, achievements, day/night), but no difficulty curve ties them together.

**The biggest gap:** make every fight readable and winnable with the wooden sword, and teach it in the first three minutes. Everything else is polish.

*How this was tested: live build, desktop 1600×900 (no shortcut URL flags, mouse captured) and phone 390×844. There was no sound, so the audio row is from reading `src/audio/`. I used debug teleports between places and set the time of day directly. Night may look too bright, because I jumped the clock and the lighting refreshes only every 15 s.*
