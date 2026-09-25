# Wildshard — whole-game audit (E108, 2026-09-24, live build f86b4c3)

## (a) Verdict

Right now Wildshard is three tech demos behind a good title screen. It is not yet a game.

- **Driftwood Isle** is close to a small finished game: a quest-giver, a goal, a boss and a reward.
- **Nalati** has the most content (3 chapters, 5 elites, 2 bosses, riding, weather, kokpar). It merged two days ago and still shows it:
  - the world edge is visible;
  - some assets are untextured;
  - the "elite nearby" banner is permanent;
  - wolves take you from 100 to 4 health in seconds.
- **Pine Hollow** is still the 17 September tech demo: no quest, no NPC, only kill counters, and the worst frame rate of the three.

**Nothing ties the three shards together.** There is no shared progress, no hub, no ending, and no reason to go from one to the next.

**Where the "chaos" comes from:**
- **The game still presents itself as a dev tool.** Players see "CHUNK PLAYTEST · LOCAL BUILD · UNUPLOADED", an fps/draw-call readout, loading timings, debug settings and boundary gates.
- **Scope.** Every shard keeps getting new systems before any shard is finished.

## (b) Per-shard scorecard

### Driftwood Isle: 6.5 / 10 (loads in ~7 s on desktop)

**What's there**
- A pier spawn, and Wendell the castaway with 5 lines of dialogue.
- The quest "The Sealed Ring": 3 glyph shards → the shrine → the Captain Brine boss → a golden-hour reward view.
- 10 achievements: sea glass, dive, zipline, bench and more.
- Crabs, monkeys, boar, deer, bears and a sailor, all respawning.

**What works**
- One coherent art style.
- The quest chip shows distance and bearing.
- The map fills in "?" places as you discover them.
- 60 fps on the pier.
- It's the only shard that plays like a game.

**What's broken**
- No controls explanation: you hold a sword and get no hint for attack or lock-on.
- The E36 cyan rectangle is visible.
- The debug readout is always on.
- After the reward, nothing happens: no "shard complete", no pointer to the next shard.

### Nalati Grasslands: 5 / 10 (loads in ~15–19 s on desktop)

**What's there**
- 5 camp NPCs and 3 chained chapters (Tulpar → The Golden King → Father of the Wind).
- 5 named elites and 2 bosses (the Golden King and the Storm Titan).
- Horse taming and riding, kokpar, and a stealth meter ("VISIBLE / TALL GRASS").
- Weather with lightning, day/night, 17 achievements, and its own bow / sabre / spear kit.

**What works**
- The most beautiful of the three shards.
- The camp reads well.
- 57–60 fps.

**What's broken**
- A flat grey world-edge plane, with a hard seam and cyan posts, is visible past the kurgans.
- The east edge has untextured beige slabs and black spruce cut-outs.
- "NAMED ELITE NEARBY · AQBARS THE PALE" shows at the camp and on Eagle Rock.
- Two wolves took me from 100 to 4 health in ~8 s.
- The shard picker card says "EARLY ACCESS" but the blurb says "SUPER EXPERIMENTAL".
- It goes wider than Driftwood, and less of it is tuned.

### Pine Hollow (the version on main): 3 / 10 (loads in ~7 s, 83 MB transferred)

**What's there**
- 3 cabins, a pond, 168 animals, and 6 kill achievements.
- A crossbow, plus a rifle pickup.
- Nothing else to do.

**What's broken**
- 18–38 fps on desktop: 9.6 M triangles, 820 draw calls.
- Branch cards block the view at eye level.
- The hit markers are big red "lollipops".
- The map labels are just "CABIN 1/2/3".
- The title-screen art is a painted lake-and-cabin scene that doesn't look like the game.
- AAA-PLAN.md claims "60 FPS verified".

## (c) Cross-shard findings

- **No progression across shards.**
  - Achievements, titles, quest flags and inventory are all saved per shard.
  - The title screen has no Continue and shows no completion.
  - Switching shards reloads the page and everything in it.
- **Each shard is a different game to control.**
  - **Weapons:** Driftwood has a sword with lock-on. Pine Hollow has a crossbow with R to span. Nalati has bow / sabre / spear, and it is the only shard with a weapon strip.
  - **Phone HUD:** only Nalati uses layout D (status on the left, a DAY chip, a HORSE button).
  - **NPCs:** Driftwood has 1, Nalati has 5, Pine Hollow has none.
  - **Systems only one shard has:**
    - Nalati: riding, weather, stealth, elites.
    - Driftwood: zipline, diving, sea glass.
- **The menu shell is the same everywhere and reads well.** Map, Inventory, Achievements and Settings form the most finished-feeling part of the game.
- **Dev framing leaks into every shard:**
  - the chunk panel (`chunk://local/…`, "LOCAL BUILD · UNUPLOADED");
  - the "NOTHING HAS BEEN GENERATED HERE" boundary warning;
  - the fps · ms · calls · tris readout, on both desktop and phone;
  - a build-id RELOAD tag;
  - loading screens that list milliseconds and shader counts;
  - Settings sections "DEBUG — FOR PLAYTESTS — GOES AWAY WHEN THE GAME SHIPS" and a review-password field.
- **No onboarding.** There are no controls hints anywhere outside Explore mode.
- **The docs describe the old game.**
  - README and SUBAGENT-BRIEF still say "a pine forest, three cabins, a crossbow".
  - SHARDS.md calls Pine Hollow the first shard.
  - RUNNING.md says to use `vercel deploy`.
- **Too much in flight.** 504 commits in 48 h, 9 live plans (4 of them drafts waiting on Jake), and ~35 open asks. About a dozen of those asks are iPhone checks only Jake can do.

## (d) Bugs, ranked

Every repro link starts with `https://wildshard-singleplayer.vercel.app/?mute=1&nolock&skipintro&chunk=…`

1. **HIGH: Nalati's world edge is visible from mid-map.** A flat plane with a seam and cyan posts. N23 fixes only the stretch near the camp.
   - Repro: `chunk=nalati-grasslands&x=-106&z=100&yaw=3.14`
   - Shot: `deep-nalati-grasslands-poi-kurgans.jpg`
2. **HIGH: Pine Hollow runs at 18–38 fps.** 9.6 M triangles, 83 MB.
   - Shot: `pine-hollow-desktop-04-entered-8s.jpg`
3. **MED: Nalati's east edge.** Untextured slabs and black spruce cut-outs.
   - Repro: `x=209&z=100`
   - Shot: `deep-nalati-grasslands-edge-2.jpg`
4. **MED: The debug perf readout is always on,** on desktop and phone.
5. **MED: The Aqbars "elite nearby" banner fires far from his lair.**
   - Shot: `deep-nalati-grasslands-poi-eagle-rock.jpg`
6. **MED: Nalati's wolves take you from 100 to 4 health in ~8 s,** with little warning.
   - Repro: `x=-95&z=54`
7. **LOW: Driftwood's floating cyan rectangle (E36).** It is most likely the Boundary's entry-road "no-man's land" gate (`src/world/Boundary.ts`), seen across the sea.
   - Shot: `driftwood-bug-floating-glass-rect-crop.jpg`
8. **LOW: Pine Hollow's branch cards block the view at eye level, and its red hit markers look like placeholders.**
9. **LOW: The Debug and Review sections show in Settings.**
10. **LOW: Pine Hollow's hero art doesn't match the game.**
11. **LOW: In dev mode, Esc opens and closes the pause menu in one press (E32).**

There were no page or console errors in any run, only three.js deprecation warnings.

## (e) What's missing, ranked by impact vs effort

1. **Separate player mode from dev mode (small effort, big impact).**
   - Put the perf readout, chunk panel, build tag, boundary gates, loading timings and the Debug/Review settings behind `?dev`.
   - Write loading text for players.
   - This alone would make every shard feel more finished within a day.
2. **Freeze features and finish one shard (small to decide, medium to do).**
   - Get Driftwood to 9/10: a controls card, a guided first minute, a "shard complete" screen after the reward (time, achievements, "try Nalati next"), and credits.
   - No new systems anywhere until Driftwood passes.
3. **Hide Pine Hollow from the picker until its remaster lands (small),** or label it "Tech preview" and put it last. Today it drags down first impressions.
4. **Tune Nalati instead of adding to it (medium).**
   - Hide the world edge and replace the untextured slabs.
   - Fix the elite banner's range, and tune wolf damage and telegraphs.
   - Polish one chapter end to end as the golden path.
5. **One controls and HUD spec for every shard (medium).**
   - The same actions on the same buttons.
   - The weapon strip in every shard.
   - One phone layout.
   - One onboarding card that each shard fills in.
6. **A thin layer that ties the shards together (medium).**
   - A shard map on the title screen with progress per shard.
   - Titles and trophies that carry across shards.
   - Finishing one shard's story unlocks the next.
   - This is what turns three demos into one game.
7. **A "finished" gate before every push (medium).**
   - One scripted golden-path run per shard: load, talk, fight, reach one objective, walk to the edge, 0 errors, fps above target.
   - Rewrite README and SHARDS.md so agents build today's game, not the 17 September brief.

*Caveat: 3–9 other agents' browsers were running throughout, so the fps numbers are pessimistic. Tested with short Playwright runs; every browser was closed afterwards.*
