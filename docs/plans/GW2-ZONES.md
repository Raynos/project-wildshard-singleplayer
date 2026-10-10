# Shards as fun as Guild Wars 2 zones

**State:** `draft` 2026-10-10 — moved into docs/plans/ (E470); its decided rules live in [WORLDCLAW-SHARD](WORLDCLAW-SHARD.md) (D41 play gates) and [FINISH-LINE](FINISH-LINE.md) S8; nothing built from it directly.

> **Was:** review, 2026-10-01; moved into this repo on 2026-10-03 (E430). Its council's files
> are archived in `project/archive/2026-10-01-gw2-zones-council/`. It went through a three-round [council](../process/COUNCIL.md) (Codex + Claude seats), and every
> finding is fixed or parked in the [register](../../project/archive/2026-10-01-gw2-zones-council/register.md).
>
> **Jake decided the four "decide now" questions on 2026-10-01** (§14):
> - the director loop, with taste picks as boards;
> - Nine Dragon's P1 slice first;
> - phone-first sessions;
> - the golden-path run later.
>
> The rest is a proposal, not scheduled.
>
> **Where it landed (2026-10-03).** The director loop now lives in singleplayer's
> [WORLDCLAW-SHARD plan](WORLDCLAW-SHARD.md)
> (a draft):
> - D41: images, then the verb and session-slice play gates;
> - D42: WorldClaw and the director loop are separate tools used together;
> - D57: the verb gate comes after the mockups;
> - D58: `design.md` lives in `src/shards/<slug>/design/`, linked from SHARDS.md, which supersedes §4.4's "in
>   SHARDS.md";
> - D83: places are built in golden-path order;
> - D85 / E406: an existing shard's light front.
>
> Nine Dragon is paused for that light front. The singleplayer copy of the council protocol is
> `docs/process/COUNCIL.md` (E361).
>
> **What it does:**
> - audits the singleplayer shards at tag **`pre-normalization`** (`dcd6a29a`, 2026-09-30, the tree before
>   GAME-NORMALIZATION started);
> - compares them with Guild Wars 2 zones and with other games;
> - asks how each shard can become a fun, directed game, and what the grid needs to bring players back.
>
> It deliberately lives here, not in singleplayer, which keeps its small, incremental plans.
>
> **Evidence**, in [`evidence/`](gw2-zones/evidence/):
> - [shard-content-driftwood-pine.md](gw2-zones/evidence/shard-content-driftwood-pine.md): an inventory of Driftwood Isle and
>   Pine Hollow, with paths.
> - [shard-content-nalati-ninedragon.md](gw2-zones/evidence/shard-content-nalati-ninedragon.md): the same for Nalati Grasslands
>   and Nine Dragon Stack.
> - [gw2-zone-research.md](gw2-zones/evidence/gw2-zone-research.md): GW2 zone anatomy, metas, currencies and resets, with
>   per-shard numbers and every source URL.
> - The council's reviews are in [the council archive](../../project/archive/2026-10-01-gw2-zones-council/). Seat C's review adds Zelda, Monster
>   Hunter, Destiny, Sea of Thieves, Hunt: Showdown, Spelunky and Fortnite Discover, with sources.
>
> **How sure:**
> - The inventories come from reading code and plans at the tag. No shard was played for this review, so every
>   "minutes" figure is an estimate from distances, timers and hit points, and it includes waiting.
> - GW2 counts come from the GW2 wiki and the official map API, and the council re-checked them. GW2 play-time figures
>   are rough.

## Contents

1. [The answer in one page](#1-the-answer-in-one-page)
2. [What the four shards hold](#2-what-the-four-shards-hold)
3. [Authored minutes against played minutes](#3-authored-minutes-against-played-minutes)
4. [Why, and how to direct a shard](#4-why-and-how-to-direct-a-shard)
5. [Scale: what a shard is in GW2 terms](#5-scale-what-a-shard-is-in-gw2-terms)
6. [Content type by content type](#6-content-type-by-content-type)
7. [The gap, named: places, not happenings](#7-the-gap-named-places-not-happenings)
8. [What already exists that is MMO-shaped](#8-what-already-exists-that-is-mmo-shaped)
9. [Each shard, directed](#9-each-shard-directed)
10. [Stringing shards into one world](#10-stringing-shards-into-one-world)
11. [A shard content grammar: a core and genre templates](#11-a-shard-content-grammar-a-core-and-genre-templates)
12. [What this changes in the platform plan](#12-what-this-changes-in-the-platform-plan)
13. [What it means for the singleplayer repo now](#13-what-it-means-for-the-singleplayer-repo-now)
14. [Open questions for Jake](#14-open-questions-for-jake)
15. [Sources](#15-sources)

---

## 1. The answer in one page

> **Jake's decisions, 2026-10-01** (details in §14; everything else here is reference for the directors):
> 1. **A director per shard: yes, with boards.**
>    - Pitch + style → verb (gate 1) → slice (gate 2) → look → arc (gate 3) → return loop.
>    - He approves the pillars and plays three gates.
>    - Taste picks stay **A / B / C boards**, batched into the weekly packet.
> 2. **First under it: Nine Dragon's P1 slice**, with its look rounds paused until gate 2. **Yes.**
> 3. **Session shape: phone-first.** ≤ 15 min units plus 1–2 signalled climaxes of ≤ 25 min per shard.
> 4. **The golden-path run per shard: later.**

- **Don't build giant zones. The grid is the zone.**
  - One 500 m shard (0.25 km²) is about **1/13 of Queensdale**, GW2's starter zone (3.24 km²).
  - It is about the size of **Bloodstone Fen** (0.37 km²), GW2's smallest open map.
  - The whole first 5 × 5 grid (6.25 km² of shards) is about **two Queensdales**.
  - Use GW2 as a **ruler for scale**, not as a template for structure (§7).
- **You played ~5 minutes; the code holds more, mostly out of reach.**
  - Read from code, Driftwood's quest is 25–40 min, Pine Hollow's 40–70 min and Nalati's three chapters 1.5–2.5 h.
  - Those minutes include waiting on nights and storms, walking back after deaths, and fights nobody has balanced.
  - So the inventories show **more implemented systems than a player can reach**. They don't show enough variety, and
    no one has timed a run.
  - What stands in the way (§3):
    - Pine's night-only steps (4 min of night in a 24-min cycle);
    - respawning at the gate (Pine's Den is ~470 m away);
    - Pine's fight frame rate on the phone;
    - Nalati never having had a clean playthrough (its test forges the boss saves);
    - balance nobody has checked.
  - **Content a player can't finish counts as zero.**
- **Two causes** (§4):
  1. **Nobody played a shard end to end on the phone.** This is the direct cause of §3.
     - Driftwood, the one shard you finished and found fun, was built by deploying "the first checkpoint before it is
       good" and steering on feel.
     - Nalati had its enemies, elites and bosses designed up front and still was never played clean.
  2. **World and content had different owners, and nobody owned the sequence.**
     - Worlds were mocked up and built; content was fitted in afterwards.
     - Places ended up with no beat, like Nalati's empty south third.
     - Nalati shows that a feature list is not a beat sheet.
- **The fix is a director per shard, working the way Driftwood was built** (§4.3–4.4).
  - Steps: a pitch, the style picked for what the engine can hit, and under an hour of mockups → the core verb as a
    greybox on the phone → Jake plays it → one-page beats and content map → a playable session slice → the full look →
    Jake plays the whole arc.
  - Every taste pick stays Jake's, as a board in the weekly packet that never blocks the work. **Three play gates per
    shard** are his minimum, not his maximum.
  - Each shard keeps **its own pillars and signature moment**.
  - Bots measure; Jake judges on his phone and through the in-game inbox.
- **The shards built places; GW2 builds happenings.**
  - Named places: Driftwood 9, Pine 18, Nalati 17. That is above GW2's ~1.6–4.7 per shard-area.
  - Dynamic events: GW2 has ~4.6–13 per shard-area; the shards have none. Nalati has three spawns on a clock (the raid,
    the dusk balbals, the night riders) that are not yet events.
  - NPCs: 0–5 per shard.
- **What turns 30 minutes into hours, in GW2:** five multipliers:
  1. a meta clock;
  2. fail branches;
  3. a currency with a long sink;
  4. resets;
  5. other people.
  - Three of them assume a full map and long sittings.
  - **Build the solo, phone-sized versions first:**
    - a session unit of ≤ 15 min with a payoff;
    - one or two signalled climaxes per shard for the big moments;
    - a **daily seed** that changes a decision;
    - rewards with a sink;
    - timed challenges with medals.
  - Crowd-shaped metas wait until there are players.
- **Each shard stays itself** (§9). Its own pillars and signature moment come from its own pitch, and a borrowed format
  shapes only its session units:
  - Driftwood's glyph sites as Zelda-style trials;
  - Pine's night hunts framed the way Monster Hunter frames a hunt;
  - Nalati's rides;
  - Nine Dragon's envelope runs.
- **Stringing shards together** (§10) is a profile, a daily seed now and a router later, verbs that travel (**ride** and
  **grapple** exist; the others don't yet), a grid currency over each shard's own rewards, a hub at the centre and the highway. It is not one big map.
- **For uploads, a small required core plus genre templates**, not one 13-slot checklist (§11). Authors copy the
  first-party shards, so each of the four is the reference for one genre.

---

## 2. What the four shards hold

At the tag. The detail, with file paths, is in the two inventories.

| | Driftwood Isle | Pine Hollow | Nalati Grasslands | Nine Dragon Stack |
|---|---|---|---|---|
| Genre and verb | Zelda-like island, sword; swim and dive (decorative by design) | Photoreal hunting, ranged only | Mounted steppe: bow, sabre, spear, horse | Vertical neon city, jian, grapple |
| Story quest | *The Sealed Ring*: 4 steps, 3 puzzle sites, boss, reward view, a "complete" card | *The Warden's Hollow*: 7 steps (3 lanterns, zipline, ghost-stag lead, boss, dawn) | 3 chained chapters, 11 steps (Tulpar, The Golden King, Father of the Wind) | none |
| Finishable in code | yes, traced end to end, with a fail-safe | yes by flags; night-gated, gate respawn | on paper; chapters 2–3 only "verified" by forging saves | — |
| Bosses | Drowned Captain (3 phases, **never again**) | Antler King (3 phases, **every night**) | Golden King (kurgan dungeon), Jel Ata the Storm Titan (mounted, storm-only); re-fights pay nothing | none (Well Dragon planned) |
| Elites / mini-bosses | the drowned sailor; the brown bear as an optional trophy fight | 4 named elites, 20-min respawn | 5 named elites gated by time or weather, 20-min respawn | none (3 planned) |
| Hostiles | ~34: boar, bear, crab, monkey | ~168 herd animals, den bears, night thralls | wolves, the wild stallion, dusk balbals, night ghost riders, lightning | none |
| NPCs (lines) | 2 (13; the trader has none) | 3 (~30) | 5 (60, ~1,230 words) + a mounted shepherd | 0 (~700 frozen crowd figures) |
| Collectibles | 15 sea glass, 1 dive treasure, 3 trophies, 2 cosmetics | 30 resin, 8 tokens, 3 secrets, ~17 journal pages, 7 trophy mounts, 7 weapon finishes | 5 skins, 2 legendary weapons; no pickups | none |
| Places | 9 | 18 | 17 | 6 (Explorer sets, no discovery) |
| Achievements | 10 | 19 | 17 | 0 |
| Economy | coins, **capped per enemy**: 92 on the island, 90 to spend | no currency; barter for ammo and 2 finishes | none | none |
| Repeatable | respawns that pay nothing | **contract board** (endless), elites, nightly King | elites, nightly enemies, unpaid re-fights | dev-mode grapple time trial |
| Clock and weather | 48-min day, no weather | 24-min day (4 night), rain and dawn fog | 26-min day (not saved), storms with lightning | fixed blue hour |
| First pass (estimate, includes waiting) | quest 25–40 min, 100 % 60–90 min | quest 40–70 min, 100 % 2.5–4 h | golden path 1.5–2.5 h, +1–2 h to 100 % | 10–20 min of looking |
| Replay value | low | medium | low–moderate | ~none |
| Every shard | a **hoverboard** (14 m/s, rides over water, climbs slopes, skips paths, bridges and ziplines; VISION calls it "staging-only") | ← | ← | ← |

**Reading across the rows:**
- **Pine Hollow has the most repeatable pieces:** the board, named elites on timers, a boss every night, weather that
  changes behaviour, a journal and a trade economy. Its friction (§3) is the most likely reason you didn't finish it.
- **Nalati has the richest world systems:** clock, storms, night spawns, raids, the horse.
- **Driftwood is the only one proven end to end.** It is a one-shot: its economy is capped so nothing repeats.
- **Nine Dragon is a diorama with one verb.**

---

## 3. Authored minutes against played minutes

The inventories say Driftwood holds an hour, Pine several hours and Nalati two or more. You played about five minutes
and finished one quest. Both can be true: the inventories count implemented systems and minutes that include waiting,
and **no run has been timed on the phone**. The gap between them is the first thing to fix, and it is the one finding
that matters in singleplayer **today**.

**What stands between a player and the content** (from the inventories):

| Friction | Where | Effect |
|---|---|---|
| Night-only steps | Pine: the stag lead and the King need night, 4 min of a 24-min cycle. The ranger's fast-forward is offered once, before the stag. Miss the night and you wait up to ~20 min | The quest stalls on a timer the player can't see |
| Respawn at the gate | Pine and Nalati: `LastPlace` is only fed by Driftwood's places (`main.ts` ~950). Pine's Den is ~470 m from the south gate in a straight line, more by trail | Every death costs a long walk; deaths are likely in elite fights |
| Frame rate in fights | Pine: GPU 35–48 ms in the Ironhide fight on the phone; fixes unconfirmed (F-P6) | Fights feel broken on the device the game is played on |
| Never played clean | Nalati: chapters 2–3 checked by writing "defeated" into the saves; the King "played in god mode only"; your N24 bug list is still owed | Nobody knows if a real player can finish it |
| Unchecked balance | Nalati: two wolves took the E108 tester from 100 to 4 health in ~8 s; the Aqbars banner fires at the camp | Early deaths and false alarms before any story |
| Gated by weather | Nalati: the Titan's tie only works mounted, in a natural storm (12–18 min after a load, a ~2–3 min window) | A long wait the player isn't told about |
| No ending | Pine and Nalati don't feed the "shard complete" card; Nalati's ending promises a plaque and calm skies, and neither happens | No sense of done |

**What a real measurement needs.** Time one phone run per shard and split it into:
- active decisions and fights;
- traversal and discovery;
- forced waiting;
- retries and walk-backs after deaths;
- completion.

A partial session that ends somewhere satisfying counts as play, even if the quest isn't finished. Only that split says
whether a shard needs friction fixes or more content.

**The lesson for the MMO.** GW2's content is legible: a heart is a bar you fill, an event has a radius and a timer you
can see. Wildshard's content is flag chains that only the code can see. Uploaded shards will have the same problem at
scale, so the validator must **play the shard**, not just check it (§11).

---

## 4. Why, and how to direct a shard

**Jake, 2026-10-01:**

> "All the development of shards has just been focused on mockups, graphics, world, and really basic features. At no
> point during the development of a shard are we designing content, scenarios, quests, what people are going to
> discover, what order they're going to discover in … Then once the world is complete, another agent has to retrofit
> content, enemies, quests into the world. It's not cohesive … they have to go together, and they have to ebb and flow."

> "How do we make the most fun shards possible that feel like a game that was designed by a game director … each shard
> would be designed by its own game director."

### 4.1 The evidence: two causes

**Cause 1: nobody played a shard end to end on the phone.** This is the direct cause of §3.

| Shard | What happened |
|---|---|
| **Driftwood** | Its content was retrofitted: the E7 audit found "~5 minutes … no quests, NPCs, chests, keys, doors, collectibles, secrets", and the v0.2 remaster fitted *The Sealed Ring* into the existing island. Yet it is the one shard that is finishable, scores best (6.5 in E108) and that you called fun. Its blow-by-blow says why, in "The magic": *"Deploy the first checkpoint before it is good … The phone found the bug that mattered"*, and *"Steer on feel, not implementation"*. |
| **Nalati** | It had a pitch and full encounter design first: combat, enemies, 5 elites, 2 bosses, storms and time gating, in `docs/design/nalati/` (`c7a5cfbc`, 2026-09-22). Layout v2 came a day later (`4770c648`, 09-23), and the next morning (`baa205c8`, 09-24) the three chapters were chained through the existing elites and bosses. It has still never been played clean. |
| **Nine Dragon** | It has the most ambitious content design in the repo (Nine Red Envelopes, the Well Dragon, three elites, three enemy types) and still has no content. Its effort went to 24+ art rounds, 8 domes, 9 labs and 1,306 art files. Its content is sequenced after the world, in P5–P6 of a plan whose P1 still waits. |
| **Pine Hollow** | The 16–17 Sep hunting sandbox scored 3/10 in E108 ("no quest, no NPC, only kill counters"). The remaster's content goal was a bar, "content is on Nalati's level". The result has never been finished on the phone, and its friction is in §3. |

**Cause 2: world and content had different owners, and nobody owned the sequence.** This is your point (L6), and the
evidence for it:
- **Places with no beat.** Nalati's south third (Snow Lotus Valley, the summer camp, the watchtower) has no gameplay; it
  came from a map pick, not a design.
- **Edge roads with no goal.** Driftwood's N/W jetties lead to empty beach. They exist because every shard must have
  four edge roads (VISION), but no design gave them anywhere to lead. §11's core now requires each edge road to lead to
  a goal.
- **A feature list, not a beat sheet.** Nalati designed its encounters; no one designed the order a player meets them,
  the pacing between them, or what they discover on the way.
- **The process has no gate for it.** The shard-checkpoints loop (singleplayer `docs/plans/SHARD-CHECKPOINTS.md`, an
  unreviewed draft from 2026-09-28) has four gates:
  - **Frame**: one look direction;
  - **Form**: assets from nine angles;
  - **Play**: collision, controls, hit or miss;
  - **Pin**: phone frame rate and memory.
  None asks what the player does, in what order, or why.
- **The look has a measured method; content has none.** The look loop (`docs/design/LOOK-LOOP.md`) uses nine cameras,
  ΔE00 and a LUT.
- **No content planning exists, though design docs do.** At the tag, `art/` holds 3,294 files; the 26 under
  `art/quest/` are HUD mockups. Encounter-design docs exist (Nalati's), but no beat sheet, pacing plan or discovery
  order exists for any shard.

### 4.2 How other teams do it

- **Driftwood's own lesson is the best one available, and it has two halves** (its blow-by-blow):
  1. **About 35 minutes of mockups that fix the style and the map:**
     - 00:24, mockups ordered;
     - 00:44, Jake picks the style the engine can hit;
     - 00:47, a round in the real HUD;
     - 00:50, a mockup map becomes the island's layout.
  2. **Then a playable checkpoint on the phone, steered on feel:** code from 01:00, 25 deploys by 04:23, and 33 of
     Jake's 47 steering prompts between 01:00 and 02:44.
  - Nine Dragon did only the first half (24+ art rounds). Pine shows the cost of a look chosen without a frame budget:
    its fights run at 35–48 ms on the phone.
- **BotW** (CEDEC 2017, in [the research](gw2-zones/evidence/gw2-zone-research.md#52-breath-of-the-wild--tears-of-the-kingdom)):
  - The map is shaped so points of interest pull the player ("gravity"), and hills hide and reveal on purpose.
  - Playtest heat maps checked that it worked.
  - Shrines were sized to **about 10 minutes** because long dungeons kept players out of the world (Fujibayashi; seat
    C's sources).
- **Level-design practice:** a short paper pass, then a greybox that is **played and timed**. The pacing comes from the
  play, and the art pass comes last, constrained by the layout that played well.

### 4.3 A director loop built the way Driftwood was (proposal)

The **director** owns the shard's design, which both the world and the content work from (§4.4 says where it lives).
Rules:
- **No place without a beat.** The world may not add a place that has no beat, and the content may not place a beat with
  no place. The four mandated edge roads must lead somewhere (§11).
- **One page per paper artefact at most.** Agents over-produce paper, and paper is not play.
- **A pitch lists the Jake decisions it would reverse.** Example: a daily bounty on Pine reverses PH-U21's "no real-time
  clock".

| Step | What is made | Who decides |
|---|---|---|
| 0. **Pitch + style** | One paragraph: the fantasy, the core verb, the antagonist, the shard's **pillars** and its **signature moment** (the story players will tell). **The style picked for what the engine hits on the phone**, and **one** round of 3–5 beat mockups in the real HUD, under an hour, no second round until gate 1 passes | **Jake approves the pitch, the pillars and the signature moment, and picks the style** |
| 1. **Verb** | The verb as a greybox on the phone (grapple, gallop, sword, crossbow) with real controls, at the target style's phone frame budget. Jake plays it for ≤ 10 min: a verb that isn't fun in grey won't be fun in Jiehua Neon | **Jake, gate 1** (played; yes / no + one note) |
| 2. **Beats + content map** | One page: 5–9 beats, then one top-down map placing the hub, the critical path, optional loops, the climax arena, discoveries and session units. A lock-and-key list of what unlocks what. Sightlines: from each beat, which two or three next attractors are visible | Director |
| 3. **A playable session slice** | One complete session unit (≤ 15 min, including its payoff and clean stop) in grey boxes, with real enemies and real quest steps. If the shard's return loop depends on an event chain, the slice includes one chain with its fail and recovery branches. Tested solo, and with two once rooms exist (§7.4). **The pacing is measured from play traces of this slice** against the density rule (§4.4), not drawn | **Jake, gate 2** (played, the whole unit; yes / no + one note) |
| 4. **Look** | The look loop and mockups, now of **beats** (the stag stepping out of the fog, the kurgan door at dusk), not of vistas. Art fits the content map | **Taste stays Jake's**, each pick as an A / B / C board (his choice, 2026-10-01), batched into the weekly packet. Work doesn't wait: the director goes on with the recommended option behind a Debug row, with the old look still selectable, until he picks. The director decides only what plays: placement, pacing, encounter tuning |
| 5. **Arc** | The first playthrough end to end: every unit, the climax and the ending, built in the look. **A person plays it on the phone**, with touch, no dev flags and no forged saves: Jake, as his ordinary sessions over a week, timed by the session trace. This is cause 1's fix built into the loop | **Jake, gate 3** (played; yes / no + one note) |
| 6. **Return loop** | Seeds, rewards with a sink, medals, happenings (§9–§10). It extends an arc that has been played and proven fun; it doesn't introduce one | Director, with Jake's pick on any reversal |

- **Frame rate is checked at every gate**, not only at Pin.
- **A failed gate goes back, not forward.** Failed fun or flow returns to step 0 or 2, and may move or delete places.
- **The kill rule:** a verb or beat Jake calls dull twice is cut or redesigned before any art. If it is a pillar, the
  director brings Jake one recommended yes / no: change the pillar, or redesign within it. **Only Jake changes a
  pillar.**
- **In shard-checkpoints terms**, the new order is **Pitch + style → Verb → Slice → Frame → Form → Play → Pin → Arc**:
  - Verb, Slice and Arc are the three play gates Jake plays.
  - Frame and Form keep Jake's taste picks, as boards batched into the packet.
  - Play's steering note moves to the director, except at the three gates and any slice Jake chooses to play.
  - Pin's approve-or-revise stays Jake's, as one packet item, and its frame-rate check moves to every gate.

**For the MMO this order matters even more.**
- Claude Code **is** the level editor (VISION). Authors get whatever order the Wildshard skill and SDK impose.
- If `wildshard new` starts with terrain and a look, every upload will be a diorama with a quest fitted in.
- So `wildshard new` should scaffold the pitch, the pillars and a verb greybox first.

### 4.4 One game director per shard

**The director is a role plus a written section, not a long-lived session.**
- **Why not a session:** long-lived agents are expensive and drift (E352: long-lived subagents were 73 % of subagent
  spend; at most 3 live).
- **Where the design lives** (superseded by WORLDCLAW-SHARD D58: `src/shards/<slug>/design/`, linked from SHARDS.md):
  in the **shard's own section of `docs/SHARDS.md`** in singleplayer, which is permanent and
  never archived. Plan files come and go: three of the four shards' plans are already archived. It holds:
  - the pitch;
  - the **pillars and signature moment**;
  - the loops;
  - the current slice;
  - a **verdict log**: the ask ids of Jake's notes on each played build, each with a one-line quote.
- **When a director session opens:** at each gate, each weekly packet and each inbox drain. It is a fresh, short-lived
  session that:
  1. reads the section, the log and the new inbox notes;
  2. acts on them;
  3. writes the packet;
  4. updates the section.
- **Who may edit:** only a director session edits the beats and map; only Jake changes the pillars. Builders append to
  their own ask files.
- **What the director owns:** the shard's fun end to end, meaning the beats, map, encounters, the climax, rewards and the
  briefs to art, model, audio and tech agents. Other agents build pieces, each asked for by the design and judged
  against it.

**Work in progress: one shard in active direction at a time, two at most.** The others stay pinned in a playable state.

**Jake is the creative director.**
- **His obligations: three play gates per shard, plus every taste pick as an A / B / C board, batched into the weekly
  packet** (his choice, 2026-10-01).
  - He has said both "everything is a decision on my plate for me to give the taste back into the game" (2026-09-23)
    and "whatever the picks are, I can't even … But the plans, I care about the plans" (2026-09-28). So taste stays his,
    but it comes batched, with a recommended option, and never blocks the work.
  - Picks he hasn't answered ride behind Debug rows until he does.
- **The gates are his minimum, not his maximum.**
  - Every deploy of the active shard is playable on his phone.
  - Any inbox note or dictation is a steer the director acts on and logs.
  - With one shard active, he can run Driftwood-style pairing evenings whenever he chooses.
- **His weekly packet per active shard:**
  1. the playable build first;
  2. a ≤ 1 min clip;
  3. what changed;
  4. the measured session arc;
  5. failed tests;
  6. one recommended decision.
- **The rules every shard shares are his:**
  - the core (§11);
  - one HUD;
  - the fight rules;
  - the session shape;
  - **a one-page "fun rules" page**: his own words, each quoted and dated, checked for later reversals. Examples:
    *"First person, first person, first person"*; *"swim forever, no drowning"*; *"we are trying to CRAM way too many
    biomes in"*; Driftwood is low-poly, never photoreal.
- **Every pitch names the fun rules it leans on.**

**Four loops every director answers:**

| Loop | Question | Example (Nalati) |
|---|---|---|
| **Moment** (~30 s) | What are the thumbs doing, and why does it feel good on a portrait touch screen? | Galloping, drawing the bow at full gallop, the arrow's drop |
| **Session** (≤ 15 min) | What does one sitting give: a goal, a payoff, a clean stop? | One ride: break a horse, a kokpar round, an elite hunt |
| **Arc** (first playthrough, 30–120 min) | What story do the sessions build, and what is its climax? Sessions are its episodes; each ends on a hook toward the next | Tulpar → the Golden King → Jel Ata in the storm |
| **Return** (days) | Why come back tomorrow? | Today's shard of the day, a seeded rival, the ladder, the camp growing |

**How fun gets tested: bots measure, Jake judges.**
- **The density rule** is a working hypothesis from
  [the research](gw2-zones/evidence/gw2-zone-research.md#53-density-rules-of-thumb), measured from play traces at each speed
  the shard allows:
  - a **notice** every 20–40 s;
  - an **interaction** every 1–2 min;
  - a **set piece** every 5–15 min.
  - Every gap over a bound is flagged, unless it is marked as deliberate quiet.
- **Bots measure:** the golden path finished, time to first fight, the three density gaps, deaths per minute, the walk
  back after a death, and stuck points. They run on desktop and are checked on the phone.
- **Jake judges** each gate on his phone, with notes through the in-game inbox (`src/ui/Feedback.ts`, `api/inbox.ts`,
  the drain-inbox skill).
- **A session trace in the inbox** (route, deaths, idle time, step times) lets Jake's real sessions **produce** the
  pacing curve.
- **A phone control test for each core loop.** Observe it on the phone and repeat it with a new player:
  - Driftwood: spot an off-screen attacker, lock, dodge and counter;
  - Pine: aim, shoot, reload and harvest without losing the prey;
  - Nalati: steer, read a charge lane and fire while mounted;
  - Nine Dragon: pick a hook, zip, land and yank an enemy without targeting confusion.

  Record simultaneous inputs, unreadable tells, accidental actions and frame drops.
- **Rewards must show in first person**: hands, tools, camp displays, an inspect view or a journal plate. A hat seen only
  on the body shadow doesn't sell a return loop.

**Directors differ; the core doesn't.** Each director gives a shard its own pillars, verb, antagonist and rewards (§9),
inside one shared core and one HUD (§11), so a player learns the controls once.

---

## 5. Scale: what a shard is in GW2 terms

| | Area | In shards (0.25 km²) | Content |
|---|---|---|---|
| One Wildshard shard | 0.25 km² | 1 | see §2 |
| **Bloodstone Fen** (LW S3) | 0.37 km² | ~1.5 | 20+ events, 7 POIs, 3 vistas, 2 mastery insights, a map currency, a 60–90 min meta on a per-instance timer; **three vertical layers** |
| **Silverwastes** (LW S2) | 1.17 km² | ~4.7 | ~39 events, 18 POIs, 7 vistas, a progress-driven meta, Bandit Crests + key chests; farmed for years |
| **Dry Top** (LW S2) | 1.95 km² | ~7.8 | 36 events on a 1-h cycle (40 min Crash Site, 20 min Sandstorm), a six-tier vendor currency |
| **Queensdale** (core, levels 1–15) | 3.24 km² | ~13 | 17 hearts, 60+ events, 21 POIs, 9 vistas, 7 hero challenges, 1 jumping puzzle, a world boss every 2 h |
| The first 5 × 5 grid | 6.25 km² | 25 | ≈ two Queensdales |
| A typical HoT–Janthir map | 1.8–7.2 km² | 7–29 | 2-h meta cycle, 20–60 min climax |

**Per shard-sized area, GW2 holds roughly:**
- ~4.6–13 dynamic events;
- 1.6–4.7 POIs;
- 0.7–2 vistas;
- 0.5–1.5 hero challenges or mastery insights;
- ~1 heart in core maps, ~0.2–1.2 in later ones;
- a slice of a 1–2 h meta;
- per-player nodes that reset.

**What this means:**
- **A shard is a small map, not a zone.** A "zone" is a cluster of three to five themed shards (1–2 km², Silverwastes
  to Dry Top size), tied by a shared currency.
- **Layers multiply content per m².** Bloodstone Fen (sky, ground, underground) and TotK (sky, surface, Depths) do it.
  - The fundamentals give a shard 100 m up and 100 m down. Driftwood's sea cave and the kurgan dungeon are small
    examples.
  - Nine Dragon is a ±250 m cube (its spawn alone is at +125 m). **Jake OK'd a 500 m cube for shard 4** (E169,
    2026-09-25). What stays open is the platform rule for uploaded shards (VISION; SHARD-PLATFORM-PLAN lock-in 5, whose
    candidate answer is pocket shards).
- **Production reality.** ArenaNet shipped one Living World map per 2–3-month episode from 3–4 rotating teams; ~6–12
  months of one team per map is inferred. Agents are fast at world and tech (Pine's remaster took 24 h). The
  bottleneck is design and your steering time, which is why §4 limits work in progress and §11 uses templates.

---

## 6. Content type by content type

GW2's content types, against the four shards. ✓ built · ◐ partial / one-off / dev-only · ✗ none.

| GW2 content type | What it does for GW2 | Driftwood | Pine | Nalati | Nine Dragon |
|---|---|---|---|---|---|
| Personal story / story instance | Narrative thread; unlocks maps | ✓ one quest | ✓ one quest | ✓ three chapters | ✗ (planned) |
| Renown heart (always-there task, a bar of chores, then a vendor) | Baseline "something to do" | ✗ | ◐ the contract board | ✗ | ✗ |
| Dynamic event (objective, timer, success / fail, scaling) | The core unit of a living map | ✗ | ✗ (thralls are ambient) | ◐ a scheduled raid, no player objective | ✗ |
| Event chain with fail branch | Makes one spot "live" | ✗ | ✗ | ✗ | ✗ |
| Meta event on a clock | The map's heartbeat | ✗ | ◐ night → King | ◐ storm → Titan (once) | ✗ |
| World boss on a timer | An appointment; "boss train" | ✗ (once) | ◐ nightly, solo | ◐ re-fight, no pay | ✗ |
| Champions / elites / bounties | Difficulty grammar; on-demand bosses | ◐ sailor, bear | ✓ 4 | ✓ 5 | ✗ |
| POIs | Free density | ✓ 9 | ✓ 18 | ✓ 17 | ◐ |
| Vistas | Traversal micro-puzzle + view | ◐ bench | ◐ bench | ✗ | ✗ |
| Jumping puzzle / mini-dungeon | Hidden skill content | ◐ sea cave, wreck hold | ◐ hollow log, islet | ◐ kurgan (boss only) | ◐ the Well |
| Adventure (timed solo challenge, medals, leaderboard) | Async replay, phone-friendly | ✗ | ✗ | ◐ dev-only horse laps | ◐ dev-only grapple course |
| Collection / achievements | Long tail | ✓ | ✓ | ✓ (achievements only) | ✗ |
| Map currency with a long sink | Weeks of return visits | ◐ capped coins | ◐ barter | ✗ | ✗ |
| Gathering nodes, per player, resetting | Daily reason to pass through | ✗ | ◐ harvest (not resetting) | ✗ | ✗ |
| Daily / weekly objectives (Wizard's Vault) | Routes players across the world | ✗ | ✗ | ✗ | ✗ |
| Day / night gating | Cheap "living world" signal | ◐ sailor at night | ✓ | ✓ | ✗ |
| Mastery / account progression | Verbs that open content everywhere | ✗ | ✗ | ✗ | ✗ |
| Megaserver, LFG, group scaling | Other people | ✗ | ✗ | ✗ | ✗ |

**The pattern.**
- **Rich:** the one-time, solo, static rows (story, places, collections, bosses).
- **Empty:** every row about **time, repetition or other people**.
- That is expected for a singleplayer demo. §7 sorts these rows by which ones work without a crowd.

---

## 7. The gap, named: places, not happenings

### 7.1 GW2's multipliers, and which work solo

| GW2 multiplier | Needs other players? | Needs a server? | The solo, phone-sized version to build first |
|---|---|---|---|
| 1. A meta on a clock with a climax | **Yes**: built for a full map; one player meets it as a long, failing timer | yes | A **happening every ≤ 15 min of play**, started on arrival or on a short cycle, with a signal you can see from anywhere |
| 2. Events with fail branches | Built for crowds; works solo only if sized to the fight rules | no | Small events that obey the fight rules (≤ 2 attackers, telegraphs), with a cheap, visible consequence |
| 3. A currency with a long sink | no | no | A reward with a sink under the shard's own law: a currency where the shard has one (Driftwood), barter (Pine), rank and medals (Nalati); a **daily cap** instead of a lifetime cap |
| 4. Daily and weekly resets | no | GW2's do | **A daily seed**: one deterministic hash on today's date picks today's target, route, threat or weather. **It must change a decision**, not a cosmetic parameter. Pine's board has a reusable serial-hash draw but no clock, by Jake's pick (PH-U21), so a date seed is new work and, on Pine, a reversal for Jake to make. Offline now; a shared leaderboard once presence exists |
| 5. Other people | **yes** | yes | Async presence first: leaderboards, ghosts of runs, notes left at places, shared counters |

**Better rulers for structure** (from seat C's review, with sources):

| Model | What it gives a phone shard |
|---|---|
| **Zelda shrines** | ~10-minute challenge rooms with a reward that travels |
| **Monster Hunter / MH Now** | The session is one hunt; MH Now cut fights to ~75 s for phones |
| **Spelunky's daily** | One seed for everyone, one try, a leaderboard |
| **Destiny's Lost Sectors** | A short first-person cave with a boss |
| **Sea of Thieves** | World events signalled across the map (the skull cloud), so players converge |
| **Hunt: Showdown** | A ~1 km² map stays fresh through clues and stakes, not more authored content |
| **Fortnite Discover** | Islands sorted into genre rows and ranked by play-through and retention, with a test window for new islands |

### 7.2 Happenings

**What exists.** Each shard is a set of places plus one quest that walks you through them once. Nalati and Pine have
spawns on a clock: the wolf raid, the dusk balbals, the night riders, Pine's thralls. The raid is the closest to an
event, and it is only a scheduled raid with an NPC defender:
- the player gets no objective and no countdown;
- the shepherd wins on his own;
- the outcome changes nothing: a raid recurs every 6–9 min while you are near the pasture, until the flock drops below 20, and the pack respawns at most twice if you kill it (`src/nalati/sheepRaid.ts`, `MAX_PACKS = 2`).

**What an engine event needs:**
- a spot and a radius, and a trigger (arrival, a short clock, a chain or the player);
- an objective from a **first-person template set**: chase or hunt, race or courier, hold a spot against telegraphed
  waves of ≤ 2, a timed puzzle, a duel with an elite. Escort is marked "avoid";
- a visible timer, a success and a fail outcome, a participation reward;
- **a signal visible from anywhere** (Jel Ata's storm wall, a green lantern on the wreck, a smoke column at the camp);
- later, scaling with players.

**The fight rules are the engine default for every event.** Driftwood needed them to be fair: at most 2 attackers, an
off-screen chevron, a 20-damage hit cap, line-of-sight hits. Nalati without them: 100 to 4 health in ~8 s.

### 7.3 Reasons to repeat

- **Driftwood caps its coins**, so a full clear buys the whole shop (92 earned, 90 to spend; E314). That ends replay.
- **Nalati has nothing to earn after the story.**
- **Pine's contracts repeat**, but pay into a barter that buys only ammo and two finishes.
- **Fix:** each shard's own reward track under its own law, with a sink (doubloons on Driftwood need new cosmetic goods
  at Maren; Pine's barter needs mounts, decor and finishes to buy; Nalati's ladder ranks unlock tack). Add a daily cap
  rather than a lifetime one, seeds that change a decision, and medals on timed challenges.
- **In the MMO**, the vision's "prevent trivial activity farming" becomes daily caps and diminishing returns.

### 7.4 People

- **Today:** 0–5 NPCs per shard, fixed in place, with 13–60 lines; no other players.
- **Before multiplayer:** async presence suits a phone PWA: leaderboards, ghosts, notes at places, shared counters
  ("the steppe has tamed 4,212 horses").
- **After multiplayer:** events and bosses scale with participants. Today `Boss.ts` and `Elite.ts` assume one player.

---

## 8. What already exists that is MMO-shaped

Singleplayer already built most of the **kit**, mostly once and wired to one shard (the inventories' Part C):

| Kit | Path at the tag | Wired to | Role |
|---|---|---|---|
| Quest schema + state machine (pure data) | `src/game/quest/quest.ts`, `core.ts` | Driftwood, Pine, Nalati | Story quests as data, already |
| Interactables as JSON rows + flags, with a validator that every read flag is raised somewhere | `src/world/interact/` | Driftwood, Pine | The upload format for puzzles. It checks membership, not reachability (§11) |
| Boss system: arena, phase bar, checkpoints, a once-ever reward, re-fight | `src/game/Boss.ts` | Pine, Nalati (Driftwood's Captain is a separate path) | Boss tables |
| Elite system: lair, leash, phase 2, banner, respawn, first-kill drop | `src/game/Elite.ts` | Pine, Nalati | Hunts and bounties |
| Respawn queue | `src/game/quest/Ecology.ts` | Driftwood | Event and ecology respawns |
| Loot: coins, purse, bounty cap, shop, perks, Owned | `src/game/loot/` | coins / shop Driftwood-only | Currency and vendor rows |
| Contract board, drawn by a hash of a serial, with no clock (PH-U21) | `src/pinehollow/quest/contracts.ts` | Pine | A reusable deterministic draw. A daily seed would hash the date instead, which is new work |
| Achievements + titles | `src/game/achievements.ts`, `Progress.ts` | all, per shard | Account titles |
| Compendium + trophy wall | `src/ui/compendium/`, `src/world/TrophyWall.ts` | Pine (built shard-agnostic) | Collections |
| Shard-complete card; last-place checkpoint | `src/ui/ShardComplete.ts`, `src/game/LastPlace.ts` | Driftwood only | Completion; checkpoints |
| Breadcrumb guides (gulls; ravens and owl) | `gullGuide.ts`, `src/pinehollow/life/` | Driftwood, Pine (built twice) | Diegetic "what's over there"; clue flights for hunts |
| Clocks (three), weather (two) | `src/world/DayNight.ts`, `PineDayNight.ts`, `DayClock.ts`, `Weather.ts`, `PineWeather.ts` | per shard | Happenings and signals |
| Practice arena, horse and grapple playgrounds with timers | `src/practice/`, `src/playgrounds/` | dev mode | Timed challenges with medals |
| **In-game feedback inbox** | `src/ui/Feedback.ts`, `api/inbox.ts`, `scripts/inbox-pull.mjs`, the drain-inbox skill | all | How Jake judges a slice; add a session trace |

GAME-NORMALIZATION will merge the duplicates. Merging them as data rows (guardrail G-2) is what keeps §11 possible.

---

## 9. Each shard, directed

Each shard starts from **its own pillars and signature moment**, taken from its pitch and Jake's picks, and kept. A
borrowed game only shapes the **format of its session units**. A model that drops a pillar is a Jake pick at gate 1.

Each entry also gives a session unit (≤ 15 min), a climax, a return loop that needs no server, and what waits for
multiplayer. **These are proposals for each director's pitch, not builds**, and each starts with §3's friction fixes.

### Driftwood Isle

- **Pillars (kept):**
  - the sword;
  - a small island with every place in sight of another (proposed; not from its plans);
  - *The Sealed Ring*'s mystery;
  - "swim forever, no drowning".
- **Signature moment:** the Captain rising from the shrine pool, then the planet framed in the stone ring.
- **Session units, framed as Zelda-style trials:** each glyph site is a **3–8 min** unit (the lookout 3–5, the wreck
  5–8, the cave 3–6) ending at a checkpoint card ("Glyph 1 / 3 · the wreck awaits"). A bus ride is two sites, or one site
  and a trial. The lookout needs a challenge before it counts as a trial.
- **Climax:** the shrine and the Captain (§11's climax rule).
- **A first hour to test against the density rule** (hypotheses to measure from traces, not targets):

  | Minutes | Beat |
  |---|---|
  | 0–5 | pier, practice crab, Wendell, the chest |
  | 5–12 | bridge, lookout, the beacon's reveal |
  | 12–22 | zipline, wreck, sailor, pump and winch |
  | 22–30 | sea cave and barrel |
  | 30–40 | shrine, Captain, the planet in the ring |
  | 40–50 | Maren, the reef treasure, a charm |
  | 50–60 | one trial, then a clear exit |

  - Trace the hut → lookout leg (~200 m) and the cove → shrine leg (~280 m, ~65 s walking) first.
  - Give each jetty a goal before asking for new scenery.
  - Mark the finale's stillness as deliberate quiet.
- **A happening on a short cycle**, not only at night (night is 8 of 48 min): the monkey troop raids Maren's stall,
  signalled from the hut. The night's drowned sailor stays a bonus, with a green lantern on the wreck that is visible
  from the hut.
- **Return loop with no server:** the wreck hold, the cave and the lookout become **time trials against your own best
  ghost** (offline async presence), with bronze / silver / gold.
  - A seed must change a decision: the route or the threat (which troop is in which palm, where the big crab sits), not
    which lever is jammed.
  - Doubloons get a daily cap instead of the lifetime one.
- **Diving** stays decorative unless the director gives it a challenge (say, a 60 s pearl run on the reef, pearls to
  Maren for cosmetics); "swim forever" holds, and the clock is the stake.
- **The Captain stays dead** in singleplayer: "he only dies once".
- **Waits for players:** a defence of Wendell's camp; the Captain as a timed boss (the director's call).

### Pine Hollow

- **Pillars (kept):**
  - the night hunt with ranged weapons;
  - eerie folklore (PH-U20: fog, lantern light, glassy-eyed thralls, "the King an ancient guardian gone wrong …
    cleansed at dawn");
  - the lantern quest **and** the board (PH-U3).
- **Jake's picks in force** (scoping rules, not pillars; changing one is his call): no currency, only barter (PH-U16); a
  rotating board with no real-time clock (PH-U21).
- **Signature moment:** following the Ghost Stag into the King's clearing; dawn over the Hollow.
- **Fix first:**
  - `LastPlace` on all 18 places;
  - a "hunt tonight" choice that is always available, replacing Hale's one-time fast-forward;
  - the fight frame rate on the phone.
- **Session units, framed the way Monster Hunter frames a hunt:** one contract from the board (tracking stays cut, per
  PH-U10; clue flights replace it). A sketch to test:

  | Minutes | Beat |
  |---|---|
  | 0–1 | pick a contract whose target is **available now**: an elite off cooldown, or a rare variant the contract provisions. If one isn't, the board offers an equivalent short hunt; waiting out an elite's 20-min respawn is never the session |
  | 1–3 | ravens and the owl fly two "sign" flights that narrow the lair (they already fly toward unseen places) |
  | 3–8 | stalk and the ranged kill |
  | 8–10 | harvest |
  | 10–13 | claim at the nearest waystone |
  | 13–15 | a first-person journal plate of the mount, "mounted at the cabin", and the barter goods earned; stop. The physical wall is an optional visit |

- **Climax:** the Antler King at night, with checkpoints, once the three lanterns burn. It is repeatable nightly, as
  today.
- **Return loop that respects PH-U21 / PH-U16:**
  - a **bounty drawn on every Nth claim** (`board.claimed`, not the draw serial, which tearing a contract down also
    advances), with a weather or time-of-day modifier that changes the hunt;
  - ribbons stay barter goods, for mounts, decor and finishes;
  - the journal's rare variants.
- **What would need Jake to reverse a pick:** a date-seeded daily bounty (PH-U21); ribbons as a currency (PH-U16).
- **Don't build** a lantern-siege meta on a 24-minute clock: it is a crowd event for a solo hunter.
- **Waits for players:** a co-op King night.

### Nalati Grasslands

- **Pillars (kept, from its pitch):**
  - tame a wild steppe horse;
  - hunt wolves from the saddle;
  - hide from them in the grass;
  - ride out the storms;
  - the two kings, the Golden King and Jel Ata.
- **Signature moment:** breaking Tulpar; Jel Ata in the storm.
- **Fix first:**
  - a clean, touch, no-dev-flags playthrough;
  - the wolf balance;
  - the elite banner;
  - the payoffs its dialogue promises: the plaque on the ribbon pole, calm skies after Jel Ata.
- **Session units: one ride.** Saddle up at the rail and pick one:
  - break a horse;
  - a wolf or elite hunt from the saddle, or by stealth in the grass;
  - a kokpar round against **named rivals with real AI** (Dauren, Erlan; 2–3 min rounds, a ladder);
  - a horse race on the bowl (the dev lap timer and jumps exist).
- **Use the empty south third as a ride:** a courier route from the camp through Snow Lotus Valley to the watchtower,
  with medal times.
- **Climaxes:**
  - **the Golden King** in the kurgan (always open);
  - **Jel Ata** in the storm. The storm becomes a skull cloud, visible from anywhere as it builds, so the player chooses
    to ride to the cairn.
  - Jake picked "only during a natural storm" over a cairn summon (2026-09-22). **Keep natural storms and make them
    reachable:**
    - save the storm clock as minutes of *play* across loads, so the design's "one storm every 20–30 min of play" holds
      across short sessions instead of restarting at every load;
    - show a forecast at the rail ("storm within your next ride").
    - A summon stays his call.
- **Return loop:**
  - today's seeded rival or course, which changes the route or the opponent;
  - the ladder;
  - **saddles and tack unlocked by ladder rank and medals**. Nalati never had a currency, and it has no pack by Jake's
    pick (E314 C). The loot plan leaves its currency to a later pick, so rank and medals are this doc's proposal for that
    pick;
  - the camp growing.
- **Waits for players:** kokpar teams. A two-player flock recovery:
  - one turns the sheep while the other intercepts wolves, and both get credit;
  - each player keeps personal story flags, and once-ever boss rewards stay per player;
  - one player leaving must not make the other's session unwinnable.

### Nine Dragon Stack

- **Pillars (kept, from its plan):**
  - the ascent through a vertical city;
  - the grapple;
  - streets that feel like ground, with the drop only at the Wells;
  - the Nine Red Envelopes.
- **Signature moment:** the Well Dragon, a solo climbing fight up the Yamen Well that ends on the Crown's VTOL pad.
- **Gate 1:** Jake plays the existing Fei Zhua crossing for ≤ 10 min. A yes goes to step 2; a no reworks the grapple
  before any envelope run.
- **The fragment is already an over-built greybox, so the slice makes the grapple a game inside it**, as gate 2:
  1. an envelope sender in Lantern Square;
  2. a safe grapple crossing that teaches targeting;
  3. a choice between a stair route past a Tong pair and a harder hook route;
  4. one enforcer fight that teaches the yank;
  5. delivery to a shrine opens a return lift.
  - The dev grapple course becomes a player-facing time trial.
  - Keep the square, the gate and the usable Well crossings as staging; move props and hooks to fit play.
- **Session units:** envelope runs of ~10 min, one per stratum, added stratum by stratum once the first is fun.
- **Climax:** the Well Dragon, under §11's climax rule, staged in phases with a checkpoint per stratum it climbs.
- **Height:**
  - Jake OK'd a 500 m cube for this shard (E169, 2026-09-25), and the nine runs and the Crown finish depend on it.
  - Build the slice where it stands (+115…+135 m). The open question is the platform's rule for uploads, not
    shard 4.
- **If Jake says yes to §14 "Decide now" 3, look rounds pause until gate 2** (E281 round 3, the F3 trailer). Phone memory and stability work
  (F9, E264) continues, because every slice needs it.
- **Its own audio before more look:** today it plays Pine's music mood.
- **Waits for players:** the Lantern Night Market (a hub with no people is the ghost town VISION fears) and the full
  crowd.

---

## 10. Stringing shards into one world

Today progress, titles, inventory and currency are all saved per shard (E108 §c). FINISH-LINE's M1 / M2 (continue
screen, titles across shards) were never built.

| # | Glue | Analogue | Notes |
|---|---|---|---|
| 0 | **Seeded tasks** | Spelunky's daily, Genshin's commissions | One seeded task per shard that changes a decision, offline and singleplayer-safe: date-seeded where the shard's law allows a clock, drawn by claim where it doesn't (Pine, PH-U21). Its MMO form is #3 plus leaderboards |
| 1 | **One player profile** | Account | Identity, titles, cosmetics, currency and verbs travel. Already lock-in 6 / G-6 in SHARD-PLATFORM-PLAN |
| 2 | **Verbs that travel** | HoT masteries | Only verbs that exist and play: **ride** (Nalati) and **grapple** (Nine Dragon). Pine's candidate is the draw-and-hold longbow (the Warden's Longbow); Driftwood has none until diving gets a challenge (tracking was cut, PH-U10; diving is shared, decorative code). **Rule: a verb must be fun in its home shard before other shards may gate on it** |
| 3 | **A daily and weekly router** | Wizard's Vault | Server-picked objectives across the grid, only ones reachable with the player's verbs and the shard's current phase, with a replacement if one expires. **It is also how player shards get found** (see below) |
| 4 | **A grid currency over shard rewards** | Unbound Magic + map currency | In the MMO, a grid-wide currency, plus each shard's own reward track under its own law: Driftwood doubloons, Pine barter goods, Nalati rank and medals |
| 5 | **A hub at the centre shard** | Lion's Arch | The hardcoded centre (VISION; SHARD-PLATFORM-PLAN R5): vendors, the router board, the upload ritual, portals |
| 6 | **The highway** | The world-boss train | Caravans and highway events; server-owned, so first-party by definition |
| 7 | **A story thread** | Personal story | Each first-party boss yields a symbolic object (the ring, the lanterns, the storm feathers) that could key one larger story. Open |
| 8 | **Seams** | — | SHARD-IDEAS §5.2: shards export and accept interfaces, so a quest can cross shards |
| 9 | **Presence, then crowds** | Megaserver, LFG | Async first; then rooms with event and boss scaling |
| 10 | **Seasons and festivals** | Festivals | Living shards (SHARD-IDEAS §5.4) plus a calendar |

**Day 30, illustrated** (every number is a hypothesis to test):
- **What is new today leads: the shard of the day.** One player-made shard, from the newcomer window or curated, with a
  24-hour leaderboard (Trackmania's Track of the Day is a curated community map every day, with a daily board and a cup).
  New shards are this game's own reason to return.
- **Then the first-party tasks:**
  - a Pine bounty (drawn by claim, per §9);
  - a Nalati rival race whose seed changes the course;
  - a Driftwood ghost trial.
- **Each takes 10–15 min and pays what its shard pays**, under a daily cap:
  - doubloons on Driftwood (for new cosmetic goods at Maren, since a full clear buys today's six);
  - barter goods on Pine (for mounts, decor and finishes);
  - ladder rank on Nalati;
  - in the MMO, some grid currency.
- **The player is one ladder rank from a named saddle shown at Nalati's rail.** Target: one cosmetic per ~8–12 visits,
  cosmetics only, never power.
- **A capped player can still chase medals and leaderboard times.**

**How an outside author's shard gets found:**
1. SDK `design.md` + a genre template;
2. local preview and validate;
3. the nine-beacon ritual;
4. server validation;
5. public placement;
6. **a newcomer window:** every validated public shard gets a guaranteed share of router traffic for a fixed test
   period, regardless of popularity (Fortnite tests new islands for up to two weeks);
7. then ranking by play-through, bounce and return, with the author excluded.

Its card shows its genre, session length, required verbs and what is on now. Private shards stay invite-only.

**Not on the list: levels.** No shard has XP or levels. That means horizontal progression through cosmetics, titles,
verbs and collections, which suits shards that can't share one level band. Treat it as a decision to confirm (§14).

---

## 11. A shard content grammar: a core and genre templates

One 13-slot checklist would make every shard the same shard, the "map-icon checklist" open world. For uploads it would
remove the genre variety that UGC discovery runs on. So the grammar has two layers.

**The required core: every shard ships this, and the validator checks it.**

| Slot | Requirement |
|---|---|
| Edge entries | 4 walkable roads (VISION; SHARD-PLATFORM-PLAN R4), **each leading to a goal**: a beat, a place or a session unit within sight |
| Finishable | Every quest and session unit reachable and finishable; static + played checks below |
| A session unit | At least one ≤ 15 min unit with a payoff and a clean stop |
| Climaxes | **Optional; if a shard has one (at most 2), it may run longer than a unit**: ≤ 25 min, phase checkpoints, never more than 5 min without a save. Each starts only from a signalled place the player chooses ("the storm is building — ride to the cairn"), never by surprise in the middle of a unit. **Its checkpoints survive closing the app**: resuming restores the saved phase and the conditions it needs (for Jel Ata, the mount and the held storm); natural-weather gating applies to the first entry, not to a resume; resuming grants no duplicate reward. Test close and reload after each phase |
| Checkpoints | Every place is a respawn point |
| Completion | A completion signal fed by the shard's own content |
| Travel speed | Pacing is measured at the speeds the shard allows. A shard declares where the hoverboard is allowed. **Scored runs declare their movement modes; using a forbidden mode invalidates the attempt** (no subtracting time). The hoverboard is off in trial and verb-gate space, so a gate can't be crossed on it. Test hover → dismount → finish |
| Fight rules | ≤ 2 engaged attackers, telegraphs, off-screen warnings, unless the shard's law says otherwise |

**Genre templates: recommended, each with its own floors.** Each first-party shard is the reference for one:

| Template | Reference shard | Typical slots |
|---|---|---|
| **Adventure** (trials, dungeons) | Driftwood | 3+ trials with medals, a boss, collectibles, a daily seed remix |
| **Hunt** | Pine Hollow | a contract board, elites with clues, a journal, a trophy wall, a bounty (drawn by claim on Pine; date-seeded only where a hunt shard's law allows a clock) |
| **Ride / sport** | Nalati | rival matches, courses with medals, a ladder |
| **Run / course** | Nine Dragon | timed runs, routes, a leaderboard |
| **Hub** | the centre, a Night Market | vendors, the router board, social space (needs players) |

**Two validator checks:**
1. **Static, beyond membership.**
   - `validateTable` today checks that every read flag is raised somewhere (`src/world/interact/validate.ts`).
   - The new check must also prove **reachability**: the dependency graph from a start state reaches every step, has no
     unreachable cycles, and resolves every external raiser.
2. **Played, a new check.** Nothing at the tag plays a quest to the end. FINISH-LINE's S1 (a draft) boots, walks 20 s,
   swings and shoots, and the only quest script forges its saves. The new check:
   - plays each session unit and the golden path from every entrance;
   - starts at each clock phase;
   - includes a death and retry, a reload at a checkpoint, and every declared fail / recovery branch.
   - **Desktop headless proves logic and navigation; a real iPhone run checks controls, frame rate and fun. Neither
     check proves fun on its own.**

---

## 12. What this changes in the platform plan

[SHARD-PLATFORM-PLAN](../design/mmo/SHARD-PLATFORM-PLAN.md) is about code safety and shape. It is silent on content shape. Additions
to consider when phase 2 is written:

1. **Content types as engine data, next to the devices:**
   - **event** (first-person templates, spot, signal, timer, outcomes, scaling);
   - **session unit** (trial, hunt, ride, run);
   - **daily seed**;
   - **currency**, **vendor** and **resource node** with a reset;
   - **timed challenge** (course, medal times, leaderboard);
   - **bounty**.
   - Participation, scaling, caps and resets are server-authoritative in the MMO, so they belong in phase 3's server
     design from the start.
2. **Which meta clock.** Three options:
   - a **global server clock** (Dry Top, HoT);
   - a **per-room cooldown** (Bloodstone Fen: "instance-based rather than set on a global timer");
   - a **progress-driven meta** (Silverwastes).

   The last two need no global time, fit "a room keyed by shard id", and keep a player-controlled clock possible in
   singleplayer. With thin populations per shard, a per-room or progress-driven meta is the likelier fit. Today there
   are three per-player clocks (24, 26 and 48 min), and Nalati's isn't saved.
3. **Reward rules instead of reward caps:** daily caps and diminishing returns per player per shard; the same event log
   feeds popularity's "meaningful activity".
4. **The profile scope (lock-in 6) carries verbs, the grid currency and titles.** G-6 already reserves it.
5. **The core (§11) joins the validator (lock-in 5)**, the played check joins the Z3 shard-5 clean-room test, and shard 5
   ships a `design.md` and one genre template.
6. **Multiplayer seam:** Boss, Elite and event objectives need a participant list, not a single player. G-3
   (`sim-no-render` everywhere) is the precondition.
7. **The hoverboard is a shard-law setting** (SHARD-IDEAS §5.3), not a global player tool, if Jake keeps it at all
   (§14).

---

## 13. What it means for the singleplayer repo now

Very little, deliberately: singleplayer's job is small, incremental, polished work, and GAME-NORMALIZATION is under
way. Nothing here should be filed as an ask there without Jake's word.

**The decisions are in §14 ("Decide now").** Two of them touch singleplayer:
- **The golden-path run** (Now 1). It is the most valuable singleplayer lesson here. No plan row owns it: FINISH-LINE's
  S1 is a 20 s smoke test in an unapproved draft, and GAME-NORMALIZATION's harness checks parity, not quests.
- **The director loop** (Now 2) for the next shard or big area. In shard-checkpoints terms, the order becomes Pitch +
  style → Verb → Slice → Frame → Form → Play → Pin → Arc, with the frame rate checked at every gate.

**Already in singleplayer plans, so no new work:**
- **D4** (death and restart at the last place) is built only on Driftwood.
- **M1 / M2** (a continue screen and titles across shards) are the seeds of §10's profile.
- **When GAME-NORMALIZATION merges the clocks, weather systems, boss paths and breadcrumb guides (§8)**, merging them as
  data rows (G-2) keeps §11 possible.
- **The daily seed** is new work, one row per shard when its time comes. Pine's serial-hash draw is reusable, but Pine
  itself has no clock, by Jake's pick (PH-U21).

---

## 14. Open questions for Jake

Each has a recommended answer.

### Decided (Jake, 2026-10-01)

1. **A golden-path run per shard: later.** One person plays each shard on the phone (touch, no dev flags or forged
   saves), timed and split as in §3. Parked; it is not filed in singleplayer.
2. **The director loop (§4.3–4.4): yes, with boards.**
   - Pitch + style → verb (gate 1) → slice (gate 2) → look → arc (gate 3) → return loop.
   - He approves each shard's pitch, pillars and signature moment, and only he changes a pillar.
   - One shard is in active direction at a time.
   - **Taste picks stay A / B / C boards** (not yes / no items), batched into the weekly packet. Work continues behind a
     Debug row with the old look selectable until he picks.
3. **The first shard under it: Nine Dragon's P1 slice**, with its look rounds (E281 round 3, the F3 trailer) paused until
   gate 2. **Yes.**
4. **Session shape: phone-first.** ≤ 15 min units plus 1–2 signalled climaxes of ≤ 25 min per shard. This sets the
   numbers in §9 and §11.

### Later, when the MMO's phase 2 is written (nothing waits on these)

5. **Async or real-time first?** *Recommended: async presence (leaderboards, ghosts, notes, counters) first.*
6. **Horizontal progression only** (no XP or levels)? *Recommended: yes.*
7. **Loadouts across shards.** *Recommended: shard law sets them; cosmetics travel.*
8. **A world story.** *Recommended: shards stay self-contained for now; the centre can carry one light thread later,
   keyed by the bosses' symbolic rewards (§10 #7).*
9. **Which meta clock** (§12.2). *Recommended: per-room or progress-driven.*
10. **Content floors for uploads.** *Recommended: the core (§11) is required; genre templates are recommended; the router
    rewards play-through, not slot count.*
11. **The hoverboard.** *Recommended: a per-shard setting, off where pacing or verb gates matter.*
12. **The fun rules page** (§4.4), seeded from your quotes for you to edit. *Recommended: yes.*

### Your earlier picks the proposals would reverse (§9)

- a date-seeded Pine bounty (PH-U21);
- ribbons as a Pine currency (PH-U16);
- a Jel Ata summon at the cairn (2026-09-22).

*Recommended: none of them; §9 gives a version of each that respects your pick.* A Nalati currency is not a reversal:
the loot plan left it open, and §9 proposes rank and medals instead.

---

## 15. Sources

**Singleplayer, tag `pre-normalization` (`dcd6a29a`):**
- the blow-by-blow PDFs in `docs/` (Driftwood Isle, Pine Hollow Remaster, Nalati Grasslands; Nine Dragon Stack's was
  added after the tag, in `a9bbe4fd`);
- `docs/SHARDS.md`; `docs/plans/FINISH-LINE.md`, `NINE-DRAGON-STACK.md`, `SHARD-CHECKPOINTS.md`,
  `DRIFTWOOD-REMASTER-V2.md`, `GAME-NORMALIZATION.md` and `game-normalization/`;
- `docs/design/nalati/`, `docs/design/LOOK-LOOP.md`, `docs/design/audit-e108/`, `docs/tasks/asks/`;
- `project/archive/` (Driftwood remaster, slop, loot; Pine Hollow remaster and follow-ups; Nalati, Nalati merge, Nalati
  finish);
- the code paths cited in §8 and in the inventories; commits `c7a5cfbc`, `4770c648` and `baa205c8`.

**The MMO docs:** [VISION.md](../design/mmo/VISION.md), [SHARD-PLATFORM-PLAN.md](../design/mmo/SHARD-PLATFORM-PLAN.md),
[SHARD-IDEAS.md](../design/mmo/SHARD-IDEAS.md), [ONE-SHOT-REVIEW.md](../design/mmo/ONE-SHOT-REVIEW.md), [COUNCIL.md](../process/COUNCIL.md).

**GW2:** the full list is at the end of [evidence/gw2-zone-research.md](gw2-zones/evidence/gw2-zone-research.md):
- the GW2 wiki (Queensdale, Silverwastes, Dry Top, Bloodstone Fen, Event timers, Map bonus reward, Wizard's Vault,
  Adventure, Mastery insight, Megaserver);
- the GW2 API map rectangles;
- ArenaNet interviews on Living World cadence;
- Cojanu & Jaber 2021 (the 40-second rule);
- the BotW CEDEC 2017 talk.

**Other games:** the list with URLs is at the end of
[council/round-1-seat-C.md](../../project/archive/2026-10-01-gw2-zones-council/round-1-seat-C.md):
- Fujibayashi on shrines;
- Monster Hunter Now;
- Destiny 2 patrol;
- Sea of Thieves world events;
- Hunt: Showdown;
- Spelunky's daily;
- Fortnite Discover;
- Trackmania's Track of the Day ([round-2 seat C](../../project/archive/2026-10-01-gw2-zones-council/round-2-seat-C.md#sources)).
