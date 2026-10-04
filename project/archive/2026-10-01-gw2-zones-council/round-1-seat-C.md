# CONTENT-GAP council, round 1, seat C (red team: the framing)

> Seat C, Claude subagent, 2026-10-01. Lens: is GW2 the right frame for a first-person action game played in short
> sessions as an iOS PWA with player-authored 500 m shards; does §4's diagnosis and §4.4's director model survive
> contact with one human creative director plus AI agents; what would make each shard most fun. Read: the doc, both
> inventories, the GW2 research, VISION, SHARD-IDEAS, the ledger, the battery. Checked against singleplayer at
> `pre-normalization` with `git show` only. Web sources are at the end.

## Overall read

The audit half (§2, §3, §6, §8) is strong, and §3 is the most useful thing in the doc: content a player can't finish
counts as zero. The prescription half has two framing faults. **First, the diagnosis in §4 is contradicted by the
doc's own evidence.** Driftwood was the shard whose content was retrofitted, yet it is the only one that is finishable and
that Jake called fun. Nalati was pitched and its systems designed before its layout, and Nine Dragon designed its content
up front. The factor all three failures share is that nobody played them end to end on the phone. So §4.3 answers a
playtest failure with four paper gates. AI agents are very good at producing paper, so that answer leans into the thing
they over-produce. **Second, the doc says GW2 is a comparison, not a target (L4), but §1, §11 and §12 adopt its five
multipliers as a mandatory grammar.** Three of those multipliers need a crowd. One needs long sessions. None was designed
for one thumb on a hot iPhone. Better models exist for each of the four shards: Zelda shrines, Monster Hunter hunts, a
daily seeded run, a sport. All of them work in singleplayer today and in the MMO later. Keep §3, §8 and the three-loop
table in §4.4. Rebuild §4.3's order around play, make the grammar a menu with a small required core, and decide the
session shape before setting any number in §9 or §11.

## The frame, argued: eight alternatives to the GW2 lens

Each model below says what it fits, and what it would change in the doc.

| Model | What it is | Fit for Wildshard (FP, touch, portrait, short sessions, 500 m, UGC) | What it would change in the doc |
|---|---|---|---|
| **Zelda shrines / dungeons** | 120 shrines, each "designed to be completed in about 10 minutes" because long dungeons kept players out of the world too long (Fujibayashi); the overworld pulls you between them | **High.** A shrine is a bounded, authorable, bot-checkable unit and a perfect phone session. Driftwood's three glyph sites already are shrines. SHARD-IDEAS §5.1 pocket shards and §5.3 "instanced" mode are the platform hooks | The grammar's core slot is a **10-minute challenge room with a reward that travels** (orbs → hearts = §10's profile), not "5–10 events". The validator's played check gets an easy start → end goal per room |
| **Roguelite runs** | A 10–30 min run, varied by seed, with meta-unlocks. The Spelunky 2 daily: one seed for everyone, one try a day, a leaderboard | **High for the return loop.** It needs no server clock and no crowd: the date is the seed. Pine's contract board is already a deterministic hash | §7.2's and §10's "resets" become a **daily seed** (today's elite, today's modifier, today's course) that works offline now and becomes a shared leaderboard later. It answers S4 without new authored content |
| **Destiny patrol + public events + Lost Sectors** | A first-person shooter's open zones: public events on timers with optional "heroic" conditions, and Lost Sectors (caves with a boss, short) | **Medium-high.** It is the genre GW2 is not: first-person combat. Its most-played open-world unit is the short instanced cave, not the patrol | Keep events, but size them to first-person combat (≤ 2 attackers, telegraphs) and give each an optional hard mode. The **Lost Sector** (a 5–10 min cave with a boss) is the unit Driftwood's wreck hold and Nalati's kurgan already are |
| **Sea of Thieves** | Self-chosen voyages; world events signalled diegetically across the whole map (the skull cloud, a horn) so players converge | **Medium.** The steal is the signal, not the sandbox | Every timed happening in §7.1 should have a **visible-from-anywhere signal** in the world (Jel Ata's storm wall, a lantern on the wreck, a smoke column at the camp), not a HUD timer. That is BotW "gravity" in time as well as in space |
| **Monster Hunter (and MH Now)** | The session is one hunt of one big monster; the zone is the stage; parts become gear. MH Now cut 10+ min fights to **75 s** for phones | **High for Pine, medium for Nalati.** Pine's elites, journal, trophy wall and board are a Monster Hunter loop missing only its session frame. Crafting is out (L12), but cosmetic finishes already play the "parts → gear" role | Pine's "meta" should be a **hunt contract** (pick, find, fight, mount the trophy), not a 40-min lantern siege. Elite fights should be sized for a phone session |
| **Genshin commissions** | 4 small daily tasks, 15–30 min total, in a single-player world; co-op optional | **High; the doc already cites it** but then builds GW2's version | The §10 daily router works in singleplayer now: a date-seeded task list per shard, no server needed. It is the "15-minute check-in" answer to §14.1 |
| **Extraction shooters** (Hunt: Showdown, Arc Raiders) | A small map (Hunt: 1 × 1 km, 16 compounds) replayed hundreds of times. Hunt's bounty: clues narrow the lair, then fight, then extract. Arc Raiders raids run ≤ 30 min | **Medium.** It proves a ~1 km² map stays fresh through **stakes and variation**, not more authored content | A shard does not need GW2 density to last: a seeded objective, a clue structure and something at stake ("carry it home") carry replay. The clue structure suits Pine's ravens and owl, which already fly toward unseen places |
| **Roblox / Fortnite UGC** | Discover ranks islands by playtime, retention, qualified play-through rate and bounce; it tests every new island for up to 2 weeks; islands sit in one of 13 **genre rows** | **Decisive for the MMO half (§10–§12, S5).** UGC wins on variety of game types and a 30-second hook, not on every map having the same slots | §11 should be **genre templates with their own floors** (adventure, hunt, race, run, hub…), not one grammar for all. §10.3's router needs a **cold-start test window** and bounce / play-through signals like Discover's. The author feedback loop (SHARD-IDEAS §5.5) is the creator-side half |

**Verdict on the frame:** GW2 is the right ruler for *scale* (§5 holds up). It is the wrong template for *structure*.
Its multipliers 1, 2 and 5 assume a full map: the megaserver keeps adding players to an instance "until the game
determines that the map is getting full". Wildshard will have no crowd for years, and few players per shard on a
25-shard grid even after that. Its meta lengths (1–2 h) assume a desktop sit-down. And VISION already limits GW2's role
to "parkour and traversal readability", excluding "its combat model". For structure, take the shrine, the hunt, the
daily seed and the genre row. Keep GW2 for zone-scale density and for the Wizard's Vault idea of routing players.

## Findings

| ID | Severity | Location | Finding | Evidence | Proposed fix |
|---|---|---|---|---|---|
| C1 | must-fix | §1 "The root cause is the process"; §4 intro ("This is the root cause of §3 and §7"); §4.1 | **The causal claim is wrong against the doc's own evidence.** Retrofit did not make the shards unfinishable or unfun, and designing content first did not prevent emptiness. (L6 stands: content and world should co-evolve. What is wrong is the claim that this caused §3.) | (1) Driftwood's content was retrofitted (§4.1), yet it is "the only shard that plays like a game" (E108, inventory A1), proven end to end (§2), and it scores the best feel, 6.5 (FINISH-LINE). Jake, 05:10 in the Driftwood blow-by-blow: "a really fun chunk in five hours", built verb-first: "Deploy the first checkpoint before it is good… The phone found the bug that mattered". (2) Nalati had a **Pitch** line and full content design (combat, enemies, elites, bosses, storms) before its layout: `docs/design/nalati/elites-and-bosses.md` and the others were committed in `c7a5cfbc` (2026-09-22); `layout-v2.md` came in `4770c648` (2026-09-23). That contradicts §4.1's "layout picked as a map … content after" and §4.1's bold "No content-design documents exist". (3) Nine Dragon designed its content up front (§4.1 says so) and still has none. (4) SHARD-CHECKPOINTS, which §4.1 says "confirms" the process, is a `draft` dated 2026-09-28 that "Jake has not reviewed" (E207). It postdates the Driftwood, Pine and Nalati builds, so it cannot have caused them. (5) What every §3 friction row shares is that the shard was never played clean on the device: Nalati in "god mode only" with forged saves; Pine never completed by Jake | Rewrite the root cause as two causes. **(a) No played verification of a session on the phone**: the direct cause of §3, as Driftwood's success and Nalati's failure show. **(b) World and content split across owners**: L6's cohesion and ebb-and-flow problem, the cause of §7's empty south third and N/W landings. Correct §4.1's Nalati row and the "no content-design documents" line to "content systems were designed (Nalati `docs/design/nalati/`); sessions, pacing and discovery order were not" |
| C2 | must-fix | §4.3 table (steps 0–4), §13's Beats gate, §14 Q0 | **Paper first, play fourth.** Pitch → beat sheet → content map (with lock-and-key graph and sightlines) → pacing curve, each with a Jake review, before anything runs. That inverts the one method Jake has called fun, and it rewards what agents over-produce: checkable artefacts | Driftwood's lessons 3 and 7 (blow-by-blow, "The magic"): "Deploy the first checkpoint before it is good"; "Steer on feel, not implementation". Nine Dragon is the cautionary tale: "the most ambitious design doc in the repo" (inventory 2 §6), 24+ art rounds, and one verb. A pacing curve drawn on paper and "checked against the density rule" is a self-graded artefact | Reorder: **0. Pitch** (one paragraph: fantasy, verb, the story players will tell) **+ verb greybox on the phone in the same step**. **1. Jake plays the verb** (≤ 10 min, one yes/no). **2. One-page beats and content map**, drawn only after the verb is fun. **3. A playable session slice** (one 10–15 min arc, real enemies, grey boxes). **The pacing curve is measured from play traces of that slice, not drawn** (see C9). 4. Look. 5. Return loop. Cap every paper artefact at one page |
| C3 | must-fix | §1 "masteries as verbs"; §10 row 2 | **Two of the four masteries name verbs the shards don't have, and one was cut by Jake.** "Track (Pine)": the Pine remaster decided "No tracking, calls or tree stands" (PH-U10). "Dive (Driftwood)": Jake's D18 steer was "Diving: just decorative stuff on the water, coral. Swim forever, no drowning", and the reef holds one treasure chest. A director acting on §10 would rebuild a cut feature or gate other shards on a verb with no gameplay | `project/archive/2026-09-25-pine-hollow-remaster.md:116` (PH-U10); Driftwood blow-by-blow, Jake at D18 (pdf text: "Diving: just decorative stuff"); inventory A5 (one dive treasure) and B10 ("Cut by the designer … tracking, calls") | List only verbs that exist and play: **ride** (Nalati), **grapple** (Nine Dragon). Pine's real candidate is the **draw-and-hold longbow with drop and wind** (the Warden's Longbow, shared with Nalati's bow), or none. Driftwood's mastery is "swim / dive" **only if** its director first gives diving a challenge (C12); otherwise none. Add: "a mastery must be fun in its home shard before other shards may gate on it" |
| C4 | must-fix | §1 "five multipliers"; §6; §11 intro ("Wildshard needs the same"); §12.1 | **GW2's structure is adopted as the target, against L4 and VISION.** The doc makes the five multipliers the definition of "hours of play" and turns them into engine types and validator floors. Multipliers 1 (meta climax), 2 (fail branches that change a map) and 5 (crowd scaling) presuppose a populated map. A solo player on a phone meets a meta built for a crowd as a long, failing timer | L4: "GW2 is the comparison asked for, not the design target". VISION's references: GW2 contributes "parkour and traversal readability", not "its combat model". The GW2 megaserver fills an instance "until the game determines that the map is getting full" (GW2 wiki). The VISION's own ghost-town worry and a 25-shard grid mean thin populations per shard | Re-title §1's bullet "What turns 30 minutes into hours **in GW2**". Add the alternative models above as peers with what each needs: crowd yes / no, server yes / no, session length. Mark multipliers 1, 2 and 5 "needs players; build after presence exists". Promote the ones that work solo and offline: session units (shrines, hunts), a **daily seed**, a currency with a sink, adventures with medals |
| C5 | should-fix | §9 (every "Clock"), §11 floors (meta 30–60 min, story 30–60 min), §12.2, §14 Q1 | **Session shape is left open (§14.1), yet the numbers already assume long sessions.** On L8's device, a 15-minute player sees a third of a 30–60 min meta. A wall-clock world night (§12.2) means the bus rider at 08:00 may never see Pine's King. The doc names the singleplayer cost but not the phone cost | L8 (iOS PWA). Jake's iPhone 17 Pro throttles the GPU ~2× within 1–2 min (memory, E189), so a crowd event is the hardest frame at the worst time. BotW shrines are ~10 min, Genshin commissions 15–30 min a day, MH Now fights 75 s. S3 fails on exactly this | Decide §14.1 **before** §9 and §11, with a recommended default: **"phone-first: a session unit of ≤ 10–15 min with a payoff; longer play is several units in a row."** Then the meta floor becomes "a happening every ≤ 15 min of play". Phase windows open on the player's arrival or on a short repeating cycle, not on a 30–60 min wall clock. The story is split into chapters of ≤ 15 min, each ending at a checkpoint |
| C6 | should-fix | §11 (all slots as floors); §14 Q7 | **One mandatory grammar makes every shard the same shard.** 13 slots with floors (hub, 5–10 events, meta, currency, adventure…) is the "checklist open world" pattern critics call the Ubisoft formula. For uploads it removes the genre variety that UGC discovery runs on: a race shard or a horror shard shouldn't have to ship a vendor and a meta | §4.4's own aim is that "directors differ". Fortnite Discover sorts islands into 13 genre rows, each island in one row. The critique of map-icon checklists: NME on the Ubisoft formula | Split §11 into a **required core** (edge entries; finishable; one session unit with a payoff; checkpoints; a completion signal; a played-bot pass) and **genre templates**, each with its own floors: *Adventure* (shrines and dungeons: Driftwood), *Hunt* (Pine), *Ride / Sport* (Nalati), *Run / Course* (Nine Dragon), *Hub* (the centre, Night Market). Each first-party shard is the reference for one genre, not for all slots. Answer Q7 accordingly: the core is required, templates are recommended, and the router rewards play-through, not slot count |
| C7 | should-fix | §7.1 event type; §11 "Events 5–10 from templates"; §5 (GW2 templates: escort, defend, collect, kill-champion, capture) | **GW2's event templates are third-person crowd templates.** First-person touch combat has a hard ceiling on simultaneous threats. "Defend the camp from waves" and "escort" are the least fun shapes on a phone in first person | Driftwood had to add fight rules to be fair: at most 2 attackers, an off-screen wind-up chevron, a 20-damage hit cap, line-of-sight hits (E294 / E297, inventory A3). Nalati without them: "two wolves took me from 100 to 4 health in ~8 s" (E108). FINISH-LINE: Driftwood "fights are unfair" before the fixes | Make **fight rules an engine default for every event** (≤ 2 engaged attackers, telegraphs, off-screen chevrons). Pick the template set for first-person and the shard's verb: *chase / hunt*, *race / courier*, *hold a spot against telegraphed waves of ≤ 2*, *puzzle under a timer*, *duel an elite*. Mark escort "avoid" |
| C8 | should-fix | §4.4 "a long-lived agent session with its own plan file"; §4.3 "one owner per shard" | **The director as a long-lived session is the pattern Jake banned on cost**, and four concurrent directors plus their builders break the agent cap. Directors also drift between sessions, because a session's taste dies when it ends | E352 (2026-09-30, memory `use-subagents-liberally`): long-lived subagents were 73 % of subagent spend; Jake: "short lived subagents and not recycling them is best"; limits ≤ 400k context and ≤ 90 min; at most 3 live | Define the director as **a role plus an owned `design.md`**: pillars, the three loops, the current session slice, and a **verdict log** of Jake's quotes on each played build. Any fresh session takes the role by reading it. That file is the continuity; a session is not. Add a **WIP limit**: one shard in active direction at a time (two at most). The others are frozen at a pinned, playable state |
| C9 | should-fix | §4.4 "The fun test … The director plays it on the phone"; §3 lesson; §11 "Played" check | **Fun has no working test.** An agent cannot judge feel, and Jake won't run chores on the phone. The "played" check §11 cites is FINISH-LINE S1, a 20-second scripted walk, not a golden-path finish. The doc ignores the feedback channel that already exists | Memory `no-manual-debug-toggling`: "Am not gonna toggle shit for you". FINISH-LINE S1: "a scripted 20 s walk (0 stuck), a swing and a shot". At the tag there is an in-game feedback inbox: `src/ui/Feedback.ts`, `api/inbox.ts`, `scripts/inbox-pull.mjs`, the drain-inbox skill. SHARD-IDEAS §5.5 already proposes play telemetry | Split the test in two. **Bots measure:** golden path finished; time to first fight; gaps between notices measured against the density rule (flag every stretch over 40 s); deaths per minute; walk-back distance after a death; stuck points. **Jake judges:** one build, one ≤ 10 min session, notes through the in-game inbox. Add a session trace to the inbox (route, deaths, idle time, quest-step times) so Jake's real sessions **produce** the pacing curve. Add a kill rule: a verb or beat Jake calls dull twice is cut or redesigned before any art. Correct §11: the S1 reference is a smoke test, and the played check needs a new golden-path bot |
| C10 | should-fix | §4.4 "Jake is the creative director above the shard directors" | **Taste has no written form.** Four agent directors will drift toward their own idea of fun, or toward GW2's, because Jake's taste is scattered across hundreds of ask files | Jake's own rules, from the evidence: "mostly say no. Each no deleted a week"; "swim forever, no drowning"; "we are trying to CRAM way too many biomes in" (Nalati); per-shard looks never unified (L10); low-poly Driftwood never photoreal; no screenshot cheats | Add a one-page **"Jake's fun rules"** to the shared rules Jake owns (next to the grammar, HUD and fight rules). Each rule is a quote with a date. Every director's pitch names which rules it leans on, and the council reviews each `design.md` against the page |
| C11 | should-fix | §4.3 "Jake reviews" column; §4.4 "He no longer has to approve every look variant first" | **Jake's review load goes up, not down.** §4.3 gives him seven review points per shard (pitch, beats, map, curve, clip, "Boards, as today", the meta cycle). Four directors means up to 28. Step 5 keeps today's boards, which contradicts §4.4's promise. S8 fails | §4.3 table rows 0–6; §4.4 "the roles" | **Two Jake gates per shard:** (1) the pitch plus the played verb build; (2) the played session slice. Each is one yes/no, plus at most one taste pick for the look. Everything else is the director's call and is checked by the council and the bots |
| C12 | should-add | §9 (all four shards); new §9.0 | **The per-shard growth plans are all GW2-shaped**: clock, events, currency, adventure for every shard. Each shard has a better model that plays to its own verb, works solo today and survives into the MMO. This changes what gets built first in each shard | See "Per-shard proposals" below: Driftwood → shrine trials + a daily seed; Pine → Monster Hunter hunt contracts; Nalati → ride-and-sport (kokpar ladder, races, storm on the horizon); Nine Dragon → courier runs per stratum (envelopes as shrines) and a time trial, with the Night Market held until there are players | Replace §9's headings with, per shard: **its model, its session unit (≤ 15 min), its return loop that needs no server, and what waits for multiplayer**. Keep the GW2-shaped ideas as "later, with players" |
| C13 | should-add | §7.2, §10 row 3, §12.3 | **A daily seed is the cheapest return loop and is missing.** Every reset the doc proposes needs a server (router, shared clock, server-side caps). A date-seeded variant (today's contract, today's elite modifier, today's course layout) needs none. It is one deterministic hash on today's date, which Pine's contract board already uses, and it becomes a shared leaderboard as soon as presence exists | Spelunky 2's daily: one seed for every player, one try, a leaderboard. Pine: "The draw is a deterministic hash, so there is no clock" (inventory B1) | Add to §10 as glue #0: **"the daily seed"**, singleplayer-safe. Its MMO form is the router and leaderboards. Add one line to §13 noting that it is one row per shard, not a plan |

**Nits: none.**

## Per-shard proposals (backing C12)

Each one starts with §3's friction fixes, which the doc already lists and I agree with. What follows is the fun, using
the inventories.

**Driftwood Isle: a Zelda island of trials** (shrines + Sea of Thieves signals).
- Its strengths are the best sword feel (6.5), three puzzle sites that work, finishability and the smallest map.
- **Session unit:** the quest is already three ~10-min glyph sites plus the Captain. End each site at a checkpoint card
  ("Glyph 1 / 3 · the wreck awaits") so a bus ride is one glyph.
- **Return loop with no server:** the wreck hold, the sea cave and the lookout become **Tide Trials**. Each is a
  date-seeded remix: the barrel's start, which lever is jammed, the crab and monkey placement, a par time with bronze /
  silver / gold.
  - It is built from interact rows and `Ecology` that already exist.
  - Doubloons get a daily cap, not a lifetime one (§12.3 agrees).
- **Diving becomes a game, or stops being a mastery:** a 60 s pearl run on the reef. Pearls go to Maren for cosmetics.
  It keeps "swim forever, no drowning"; the clock is the stake.
- **The Captain stays dead** (the fiction holds). The night's drowned sailor becomes a signalled happening instead: a
  green lantern burns on the wreck, visible from the hut, the Sea of Thieves cue.

**Pine Hollow: Monster Hunter in a photoreal forest** (hunts + a clue structure; tracking stays cut, per PH-U10).
- **Session unit = one hunt contract** (8–12 min) from the lodge board:
  - the target is an elite or a rare variant;
  - the ravens and the owl give two "sign" flights that narrow the lair (they already fly toward unseen places);
  - the fight is the content;
  - the trophy goes on the wall and the finish is the reward.
- **Fix first:** `LastPlace` on the 18 places; a "hunt tonight" button on the board that is always available, replacing
  Hale's one-time fast-forward.
- **Return:** **the daily bounty** (a date-seeded elite plus a modifier: rain, dawn fog, night) and a weekly King hunt
  with tiers by time or damage taken. Ribbons buy wall mounts, cabin decor and finishes (§9 agrees).
- **Don't** build the 40 / 20 lantern-siege meta on a 24-min clock. It is a crowd event for a solo hunter.

**Nalati Grasslands: ride and sport** (horse game + kokpar as a real sport + storms as a visible event).
- **First a clean, touch, no-dev-flags playthrough and the wolf balance** (§3).
- **Session unit = one ride:** saddle up at the rail and pick one of:
  - a kokpar round against **named rivals with real AI** (Dauren, Erlan; 2–3 min rounds, a ladder);
  - a **horse race** on the bowl (the dev lap timer and jumps exist);
  - an elite hunt;
  - the storm.
- **Use the empty south third as a ride, not as 5 events:** a courier route from the camp through Snow Lotus Valley to
  the watchtower, as a timed course with medal times.
- **The storm is a skull cloud:** visible from anywhere when it builds. Offer Jake again the "summon at the cairn"
  option he did not pick, because a 15-min session may never meet a natural storm (the first comes 12–18 min after a
  load).
- **Payoffs promised in dialogue:** the plaque on the pole, calm skies after Jel Ata (§9 agrees).
- **Multiplayer later:** kokpar is the natural two-player game (S7). Teams beat a shared meta.

**Nine Dragon Stack: a vertical courier-and-time-trial city** (roguelite / time trial + shrine-sized runs).
- **The fragment is already an over-built greybox, so P1 makes the grapple a game inside it** before any new stratum:
  - the dev grapple course becomes a player-facing **time trial** through the square, the stair-street and the Well;
  - one **red-envelope run** (a timed vertical delivery) is the shrine unit;
  - a Tong enforcer pair adds one **yank** fight.
- **Nine Red Envelopes = nine ~10-min runs, one per stratum.** That is the phone session unit, and it scales stratum by
  stratum without a 500 m cube up front.
- **Hold the Lantern Night Market** until multiplayer exists. A social hub with no people is the ghost town VISION fears.
- **Its own audio before more look:** today it plays Pine's mood (inventory 2 §4).

## Battery

| # | Result | Why |
|---|---|---|
| S1 | partial | The doc gives the order (pitch → … → look) and Jake's reviews. But the first played thing comes at step 4, after four paper reviews (C2). The director is a "long-lived session" (C8). The §11 floors need event, meta and currency devices that don't exist yet (§12, "new"), so in its first two weeks the director must either write custom code or wait. The first mockup comes after the greybox, which is right |
| S2 | partial | §9 names the right minimum loop (strata 5–7, enforcers, one envelope, a lift, the yank). The doc never says what happens to the fragment's 1,306 art files under §4.3's rule that "the world agent may not add a place that has no beat" (Lantern Square has no beat). It also never notices that the fragment can serve as the greybox (see Per-shard). The 500 m cube vs 200 m tension (VISION) is unaddressed |
| S3 | fail | The 15-min Pine player walks ~200 m to Hale, does the dam, and maybe lights one lantern. A death sends them back to the gate, and the night (4 of 24 min) or a wall-clock night (§12.2) decides whether the King exists that session. They leave with resin that buys ammo. §9's grown Pine is a 30–60 min meta, so the doc's own target fails a phone session (C5). The board contract is the only fitting unit, and the doc doesn't frame it as one |
| S4 | partial | The router, grid currency, masteries and festivals give a GW2 answer, but every piece is server-side and future. On day 30 nothing is new except routing. The cheap answer, a daily seed (C13), is missing, and so is the UGC answer: new player shards, found through discovery |
| S5 | partial | The grammar forces 13 slots (C6, too many and all the same). The validator checks flags and runs a bot on "the golden path", but an arbitrary shard has to declare that path, and the doc doesn't say how. Discovery is "the router routes players to shards it wants played", with no cold-start window or play-through and bounce signals (compare Fortnite Discover's 2-week test) |
| S6 | partial | The density rule is stated but never applied to Driftwood's real distances. The dead stretches are visible in the inventory: hut → lookout ~200 m, cove → shrine ~280 m (~65 s walking), and the whole island after the quest. §9's "tide" adds night-only events (8 of 48 min), which most first hours never see |
| S7 | partial | §7.3 and §12.6 say Boss and Elite need a participant list and events must scale. What two players actually do differently isn't designed. Nalati's natural answer, kokpar as a two-player or team sport, is absent. Once-ever boss rewards per player vs shared kills is unanswered |
| S8 | fail | Up to 7 Jake reviews per shard × 4 directors, with "Boards, as today" kept (C11). No WIP limit (C8), and no written taste reference, so the directors' drift lands on his desk as rework (C10) |
| S9 (new) | fail | **"Jake says boring."** Jake plays a director's greybox on his phone for 8 minutes and writes one inbox note: "boring". What does the director do next, what evidence does it gather, and what decides whether to iterate or kill? The doc has no kill rule, no telemetry to locate the dull minutes, and no pointer to the in-game inbox (C9). Under §4.3 the director would most likely revise the paper (the beat sheet, the pacing curve) rather than the play |

**New scenario for battery.md:** S9, **"Jake says boring"**: Jake plays a director's greybox for under 10 minutes on his
phone and files one inbox note, "boring". Walk what the director does next, what evidence it gathers, and what rule
decides between iterating and cutting the verb or beat.

## Sources

- Fujibayashi and Aonuma on shrines (~10 minutes each; why long dungeons were cut):
  https://miketendo64.com/2017/12/23/interview-zelda-devs-on-shrines-and-divine-beasts/ ·
  https://www.levelup.com/noticias/fujibayashi-explico-el-origen-del-sistema-de-shrines-en-zelda-breath-of-the-wild/
- Monster Hunter Now's 75 s hunts: https://mobilesyrup.com/2023/04/18/new-augmented-reality-monster-hunter-niantic-game/ ·
  https://www.gamespark.jp/article/2023/04/20/129209.html
- Destiny 2 patrol, Lost Sectors, heroic public events: https://blog.playstation.com/2017/08/24/five-ways-destiny-2-is-reinventing-patrol/
- Sea of Thieves world events and skull clouds: https://seaofthieves.wiki.gg/wiki/World_Events
- Hunt: Showdown maps (1 km × 1 km, 16 compounds, clues): https://huntshowdown.fandom.com/wiki/Maps ·
  https://en.wikipedia.org/wiki/Hunt:_Showdown
- Arc Raiders raids (≤ 30 min): https://en.wikipedia.org/wiki/ARC_Raiders
- Spelunky 2 daily challenge: https://spelunky.fandom.com/wiki/Daily_Challenge_Mode_(HD) ·
  https://gamedeveloper.com/design/the-24-hour-ticket-examining-daily-runs-
- Genshin daily commissions (15–30 min): https://invenglobal.com/articles/12804/guide-genshin-impact-beginners-guide-top-5-daily-tasks-to-complete-for-beginners
- Fortnite Discover (signals, 2-week test, 13 genre rows): https://dev.epicgames.com/documentation/en-us/fortnite/how-discover-works-in-fortnite
- The GW2 megaserver ("until the game determines that the map is getting full"): https://wiki.guildwars2.com/wiki/Megaserver
- The Ubisoft formula critique: https://www.nme.com/gaming-features/ubisofts-formula-tried-and-true-or-time-to-change-2812353
- Singleplayer at `pre-normalization`: `docs/Driftwood-Isle-blow-by-blow.pdf` ("The magic"; D18), `project/archive/2026-09-25-pine-hollow-remaster.md:114–116`,
  `project/archive/2026-09-23-nalati.md` (Pitch, Decisions), `docs/design/nalati/*.md` (`c7a5cfbc`) vs `layout-v2.md` (`4770c648`),
  `docs/plans/SHARD-CHECKPOINTS.md` (State line), `docs/plans/FINISH-LINE.md` (feel scores; S1), `src/ui/Feedback.ts`, `api/inbox.ts`.

Verdict: not clean — 4 must, 7 should, 2 should-add
