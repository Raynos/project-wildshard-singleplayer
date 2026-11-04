# KITCHEN-SINK v2: the open questions (walk-through)

Jake 2026-11-03 ("walk me through them"): every slice and mini-plan question that slice decisions D1–D61 and the
11-03 panel did not answer, 67 in all, each with its options and one recommendation. Answers go in the last column
(Jake's words); "rec" means the recommendation stands. The 54 already answered are in [slices/DECISIONS.md](slices/DECISIONS.md).

## West: foundations and town

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q1 | W0b Q1 | **Shop interiors.** (a) counters on the street front only; (b) walk-in shop rooms. **Recommended (a):** the shop is a panel (W2b); rooms cost draw calls and give nothing to do. | a | |
| Q2 | W0b Q2 | **TO LET fronts.** (a) boarded fronts with signs; (b) dressed as closed shops for future content. **Recommended (b):** reads as a living street and leaves room for later shops. | b | |
| Q3 | W0c Q1 | **What "0 % custom" counts for the showcase.** (a) only TS under `src/shards/showcase-template/` outside `generators/`; (b) also every one-user host only the showcase reaches. **Recommended (b):** a host made for the showcase alone is shard code in a generic coat until a second shard uses it or you approve it (G595); the ruler shows both lines. | b | |
| Q4 | W0d Q1 | **Stale pending rows on merge day.** (a) charge back every row past its recheck at once; (b) give them one new recheck date (four weeks) and a G595 pick sheet. **Recommended (b):** a mass charge-back would hide the showcase's own readings in noise; one pick sheet settles them. | b | |
| Q5 | W0e Q1 | **The Explore playgrounds at y 3000** (Nalati's riding course, Nine's grapple course). (a) exempt them as dev tools entered from the Explore hub, like the Practice arena; (b) move them inside each cube. **Recommended (a):** play never reaches them, and moving them under the shard would draw the whole shard behind the room (they hang at 3 km so the shard is culled). The cube rule then binds every portal, interior and arena a player can reach. | a | |
| Q6 | W1a Q2 | **Driftwood's stale `install.file` path.** (a) drop the field from the NPC schema now; (b) leave it. **Recommended (a):** it points at a deleted TS file and teaches the wrong thing to the first data-only shard. | a | |
| Q7 | W1b Q4 | **Grey "!" before levels exist.** (a) W1b ships the four states driven by flags, E0 adds the level atom; (b) wait for E0. **Recommended (a):** the states are the same; only their input changes. | a | |
| Q8 | W2a Q1 | **One currency per shard or a shared wallet?** (a) per shard, like levels (19a): Scrip is spent only here, doubloons only on Driftwood; (b) one wallet across shards. **Recommended (a):** your level-per-shard rule applies to money too, and it keeps each shard's balance its own. | a | |
| Q9 | W2a Q2 | **Silhouettes for unfound pack kinds** (loot plan item 4). (a) yes, every kind shows as a dark outline until found; (b) hidden until found. **Recommended (a)** in the showcase only; Driftwood and Pine keep today's look (a row switch, default off). | a | |

## West: weapons and the range

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q10 | W3a Q4 | **Approve the placeable dummy host (G595, one user).** (a) approve it as platform (the practice room's dummies are its engine half, and every future shard with a training yard can place them); (b) keep the dummies as showcase rows over the engine pieces with no game host. **Recommended (a):** it passes tests 2–6 and a training yard is a common shard feature. | a | |
| Q11 | W3b Q1 | **What pitch does in the west.** (a) the bale burns for 8 s (look only), no damage system yet; (b) wait for E0's burn status and ship iron and broadhead now. **Recommended (a):** the ammo practice reads complete, and E0 adds the burn damage to the same row. | a | |
| Q12 | W3c Q1 | **Rifle lane targets.** (a) swinging steel plates with a ring sound; (b) paper targets with scored rings like the bow lanes. **Recommended (a):** a rifle at 75 m reads best as a clang and a swing; rings at that range are unreadable on a phone. | a | |
| Q13 | W3d Q2 | **Parry outside the showcase.** (a) opt-in rows only, no other shard gets parry now (19z); (b) give Driftwood's sword parry too. **Recommended (a):** your ruling keeps other shards' combat as it is. | a | |

## West: toys, courses and climbing

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q14 | W10a Q2 | **One horse or a choice?** (a) one loaner; (b) three coats to pick from. **Recommended (a)** now; coats are a later cosmetic. | a | |
| Q15 | W4b Q1 | **Can the see-saw launch you?** (a) yes: stand on the low end, drop a crate stack on the high end; (b) crates only. **Recommended (a)** if the capsule rides the plank cleanly in a test, else (b) and say so. | a | |
| Q16 | W4b Q2 | **Skittles score.** (a) pins down per run, best kept (a records row); (b) just for fun, no record. **Recommended (a):** one more personal best and a feat ("Strike!") for W9b, at no extra cost. | a | |
| Q17 | W5a Q3 | **HA4d for the board.** (a) move only the board's look (model, geometry) to game, keep the motor law in the engine; (b) move the law too. **Recommended (a):** the law is movement like swimming; the look is the Wildshard part. | a | |
| Q18 | W5b Q1 | **Trick input on touch.** (a) spins only (stick in the air), no new buttons; (b) add a TRICK button for grabs and flips. **Recommended (a):** no HUD change, and spins + air + combos already make a score. | a | |
| Q19 | W5b Q2 | **Is the trick score timed?** (a) a 60 s run from the pad; (b) a running best combo with no clock. **Recommended (a):** a run has a start and an end, like the other four boards. | a | |
| Q20 | W5c Q1 | **Grind rails at all?** (a) build them (a new board law, ~20 h); (b) drop rails and give the space to a second funbox. **Recommended (a):** rails are what makes a board park read as a park, and the law is small and contained. | a | |
| Q21 | W6b Q1 | **Do belts move a hoverboard?** (a) no, belts push feet and crates only; (b) yes. **Recommended (a):** the board is how you skip the belts on a second run, a small reward for knowing. | a | |
| Q22 | W6c Q1 | **Sky Reach's bridges.** The old plan moved them onto the rope deck, but they are winch lifts and platforms, not rope. (a) leave them as movers; (b) rebuild them as rope bridges. **Recommended (a):** they work and look right as they are. | a | |
| Q23 | W6c Q2 | **Nalati's kunes bridge.** (a) stays static; (b) becomes a swaying rope-deck row. **Recommended (a):** a look change on a shipped shard needs its own board, not a ride-along. | a | |
| Q24 | W7b Q1 | **Zip both ways?** (a) one way, tower → town (today's law is top → bottom); (b) a return line. **Recommended (a):** the grapple course is the way back up. | a | |
| Q25 | W8a Q1 | **Ladders: approve as platform with one user, or find a second?** (a) approve (G595): ladders are a generic verb any shard can use; (b) also give Nine Dragon or Driftwood a ladder now as a second user. **Recommended (a):** a ladder added to a shipped shard is a level change with its own look board, not a ride-along. | a | |
| Q26 | W8a Q2 | **How a climb starts on touch.** (a) walk into the ladder and push forward; (b) a CLIMB prompt button. **Recommended (a):** no HUD change; the law already latches on approach. | a | |
| Q27 | W8b Q1 | **Stamina?** (a) none: climb as long as you like; (b) a stamina bar that drops you after ~10 s on a face. **Recommended (a):** the west is practice; ledges between pitches already pace it, and a bar is HUD. | a | |
| Q28 | W8b Q2 | **Scramble beyond the marked faces?** (a) only declared scramble faces; (b) any steep rock. **Recommended (a):** (b) means climbing everything in every shard, which is a different game. | a | |
| Q29 | W9a Q1 | **The squeeze.** (a) a real crouch squeeze (1.1 m high for 4 m; crouch exists); (b) a narrow but walkable passage. **Recommended (a):** it is called a squeeze cave, and crouch is an existing verb with no use in the west yet. | a | |
| Q30 | W9a Q2 | **Light inside.** (a) dark with the shaft and a few glowing crystals (cheap emitters); (b) lit like the outside. **Recommended (a):** the cave should feel like a place. | a | |
| Q31 | W9b Q3 | **Feats for the toys.** (a) one per course PB threshold plus "all vistas", "all caches"; (b) none in the west. **Recommended (a):** 19l says west toys have feats. | a | |

## West: weather, audio, finish

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q32 | W11b Q1 | **Orchestral under every music setting?** (audio plan Q1) (a) yes, folk and piano players hear the showcase's orchestral score, synth stays synth; (b) the setting wins and a missing genre falls back to synth. **Recommended (a).** | a | |
| Q33 | W12 Q1 | **When the showcase replaces the hologram in the grid.** (a) after your west phone pass, behind Developer as a whole shard but in the public grid cell; (b) only after the east is done too. **Recommended (b):** the public grid should not show a shard whose combat half is missing; the west pass happens in Developer from Select a shard. | b | |

## East: engine (levels, combat, HUD)

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q34 | E0a Q2 | **The Developer row.** (a) "Levels: on / off" in Debug until your east play (E17), then deleted; (b) no row, the showcase is behind Developer anyway. **Recommended (b):** the whole shard is already Developer-only, and an "off" mode would be a second, untested combat for the showcase (E451: as few rows as possible). | b | |
| Q35 | E0b Q1 | **Does a DEFLECT stop the blade?** (a) a 45 ms hit-stop and a recoil (the miss-feel page's E); (b) no stop, sparks only. **Recommended (a):** it is the "you hit armour" read the miss-feel page settled; 45 ms is under two frames at 30 fps, so combos don't stall. | a | |
| Q36 | E0c Q1 | **Does leaving a fight heal the robot only, or you too?** (a) both: the robot walks home and resets; you regen on the 5 s rule (§15 as written); (b) the robot keeps its damage for 30 s so you can come back. **Recommended (a):** it is what you locked, and (b) invites kiting the leash line. | a | |
| Q37 | E0d Q1 | **Who counts as "the killer" when a robot dies to something else** (a fall, burn after you leave, another robot's slam)? (a) XP when you dealt any damage in the last 10 s; (b) only a killing blow by you. **Recommended (a):** burn and knockback kills are your kills, and a phone player shouldn't lose XP to a ledge. | a | |
| Q38 | E0g Q1 | **Does burn tick show numbers?** (a) small orange tick numbers (one per second); (b) the tint only, no numbers. **Recommended (b):** §15 says "a nameplate tint only", and six floats on screen is already the cap. | b | |
| Q39 | E0i Q1 | **Does Forge raise every weapon at once?** (a) yes, one Forge tier for all weapons (the loot plan, your 11-02 pick); (b) per weapon. **Recommended (a):** already decided; listed so the shop text says "all weapons". | a | |

## East: robots, bands, elites

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q40 | E1a Q1 | **The robot look.** (a) the polished toy look of the round-11 remaster (rounded chamfers, orange and grey, cyan eyes by day, amber at night, baked AO, no stencils); (b) flatter low-poly with no AO. **Recommended (a):** it is ruling 19ab's look; the test robot goes to you as a spin clip with a versus board against the E1 mockup first. | a | |
| Q41 | E1b Q1 | **Sleeping Mites.** (a) some packs sleep as plain closed crates and wake when you come within 6 m (the enemies plan); (b) every Mite is awake. **Recommended (a):** it is the band's one surprise, costs one pose, and teaches "crates can be robots" before Sir Nibbles (E8c) uses it. | a | |
| Q42 | E1d Q1 | **Coin burst for Scrip.** (a) today's coin burst (gold coins fly to the chip); (b) a quieter "+3" chip only. **Recommended (a):** it is the shared look of money on every shard, and 3–15 a kill keeps it small. | a | |
| Q43 | E1e Q1 | **Parts magnetise to you?** (a) walk over each part (the loot plan); (b) parts fly to you within 4 m after the fight ends. **Recommended (b):** same rule, less walking on a phone; a part still lands where the robot broke. | b | |
| Q44 | E1g Q1 | **Hand-in items.** (a) Spare Servos takes the 6 Servos at turn-in; (b) you keep them (the quest only checks). **Recommended (a):** a hand-in that costs nothing isn't a fetch quest, and Servos respawn every 90 s. | a | |
| Q45 | E2 Q1 | **Stun into cover as the band's lesson.** (a) yes: lure the charge into a stack, then punish (the enemies plan); (b) no stun, just dodge. **Recommended (a):** it gives band 2 a skill beyond "dodge", and Big Pallet's pillars build on it. | a | |
| Q46 | E3 Q1 | **Can you shoot nails out of the air?** (a) no, nails are fast and small (dodge or take them); (b) yes, a parry deflects them. **Recommended (a):** parry is a melee skill (W3d), and the Drones are the band that teaches ranged weapons and moving. | a | |
| Q47 | E4 Q1 | **Slag lights the night.** (a) slag glows (an emissive decal, no real light) so band 4 reads at night; (b) dark decals only. **Recommended (a):** it is how Hot Mess (E8c) "lights the dark", and an emissive decal costs no light. | a | |
| Q48 | E5a Q1 | **One shield row for robots and bosses?** (a) the guard arc is a showcase-first levels row; (b) make it the shared shield row and move Signal's Matriarch shield onto it (360°, ×0) in this slice. **Recommended (b):** it gives the host its second user and deletes a plugin answer, at about 2 hours. | b | |
| Q49 | E5b Q1 | **What being seen costs.** (a) the pack engages and the yard's gate shuts for 20 s, the keycard returns to the desk; (b) seen = the quest fails and restarts from the gate. **Recommended (a):** a fight you can win or flee, no hard reset; the keycard returning is the stealth penalty. | a | |
| Q50 | E6 Q1 | **Does the Sentry's parry stagger you?** (a) a 0.5 s riposte strike you can dodge; (b) a parry also stuns you for 0.4 s. **Recommended (a):** a stun after your own miss stacks two penalties; the riposte is readable and dodgeable. | a | |
| Q51 | E7a Q1 | **Rare odds.** (a) uncommon 8 %, rare 2 % (about one rare every 50 kills); (b) rarer: 5 % / 1 %. **Recommended (a):** the enemies plan's numbers; at ~150 kills an hour you see three rares an hour. | a | |
| Q52 | E7b Q1 | **Storm hour brings out the night shift and the night elites?** (a) yes (the enemies plan Q1; 19k says storm counts as night); (b) storms change only the sky. **Recommended (a):** already your ruling; listed for the natural storms too (W11a): they count as night as well. | a | |
| Q53 | E8b Q1 | **The thrown crate stays as cover.** (a) yes, it lands as breakable cover you can use (the enemies plan); (b) it breaks on landing. **Recommended (a):** it makes the pit change during the fight, and it sets up P2's double charges into your own cover. | a | |
| Q54 | E8c Q1 | **Do night elites stay through dawn once found?** (a) an engaged or aware elite stays until it leashes, then leaves; (b) it vanishes at dawn. **Recommended (a):** nothing is worse than losing a 60 s fight to the clock. | a | |

## East: set pieces, bosses, dungeons

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q55 | E10a Q1 | **What stays loaded while you're inside.** (a) the surface's near tiles stay resident so the exit is instant (round 5's proposal); (b) the surface unloads fully and the exit reloads it. **Recommended (a):** a 1–2 s exit fade with no reload; the Simulator reading decides if (b) is needed for memory. | a | |
| Q56 | E11b Q1 | **The template's door-wave example.** (a) rewrite it on the group input (the clean example for new shards); (b) leave it. **Recommended (a):** the template is where new shards copy from; 1 hour. | a | |
| Q57 | E11d Q1 | **The Foreman's office.** (a) a balcony he whistles from, then drops in (round 5); (b) he starts on the floor. **Recommended (a):** the drop is the elite reveal, and the office roof holds a Gold 1×1 (round 5). | a | |
| Q58 | E12f Q1 | **The Titan's look.** (a) crates and cargo containers round a cyan core, orange and grey like the robots (the remaster's direction); (b) a darker, rusted "foreman's monster" variant. **Recommended (a)**, with the core and seams pushed brighter: it matches 19ab's palette, and a versus board of both goes to you before the clips are cut. | a | |
| Q59 | E12g Q1 | **Retries.** (a) respawn in the alcove with the 3 s short intro, no reload (round 5); (b) respawn at the Titan gate on the surface. **Recommended (a):** Elden Ring's stake at the fog; a surface respawn means a portal load per attempt. | a | |
| Q60 | E9 Q1 | **Delete the unused `{ weather }` director action?** (a) keep it (one line, no user); (b) delete it, holds are the one way. **Recommended (b):** a stage that sets weather fights the hold; one way to force weather. | b | |
| Q61 | E9 Q2 | **The Warden Core powering the beacons** (the mini-dungeon page's idea). (a) no: beacons need only you; (b) a beacon needs the Vault Warden's core first. **Recommended (a):** quests are freeform (decision 17); Lights Out is L9 and the Warden L12. | a | |

## East: audio, balance, finish

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q62 | E15b Q1 | **Band intensity.** (a) two east themes with layers by band (the audio plan); (b) six band themes. **Recommended (a):** fits the 12 MB budget and the layers already step with the band. | a | |
| Q63 | E16 Q1 | **If the real curve is far from ~60 h** (respawns and walking make it slower or faster). (a) retune the XP ratio to land near 60 h; (b) keep ×1.618 and report the real hours. **Recommended (b):** you picked the golden ratio itself (19p); the hours are its consequence, reported, and you decide after your play. | b | |
| Q64 | E17 Q1 | **When the showcase replaces the hologram in the grid.** (a) after your east play, as a public cell (the whole shard still Developer-gated inside if you want); (b) keep it out of the grid, reachable from Select a shard only. **Recommended (a):** both halves are done by then, and W12 deferred the swap to exactly this point. | a | |

## Mini plans (not in a slice)

| # | Slice | Question, options, recommendation | Rec | Answer |
|---|---|---|---|---|
| Q65 | enemies plan Q4 | **Blender scripts for every robot, no TRELLIS.2 / Hunyuan3D-2?** (a) yes, every robot from a Blender script; (b) image-to-3D where it looks better. **Recommended (a):** image-to-3D rounds the hard blocks off. | a | |
| Q66 | enemies plan Q5 | **Night elite names** (Sir Nibbles, Hot Mess, Riveting Rita). (a) keep them; (b) new names. **Recommended (a).** | a | |
| Q67 | audio plan Q3 | **Robot voices.** (a) mechanical chirps only, no spoken barks; (b) spoken barks. **Recommended (a):** the Foreman's whistle is the one "voice". | a | |

