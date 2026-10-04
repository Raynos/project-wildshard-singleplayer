# GW2-ZONES council: the findings register

> **State:** open, 2026-10-01. One row per finding across every round; the ID never changes. Statuses: `fixed`
> (commit), `rejected` (reason), `settled` (re-argues the [ledger](ledger.md) without new evidence), `parked` (a
> should-add not taken now), `escalated` (sent to Jake). Protocol: [singleplayer `docs/process/COUNCIL.md`](../../../docs/process/COUNCIL.md). The cap is
> 3 rounds (Jake's number). **Closed 2026-10-01 after round 3.** The doc was `docs/CONTENT-GAP.md` during the
> council and is now `docs/gw2-zones/GW2-ZONES.md`; the seat reviews keep the old paths (they are history). Since 2026-10-03 (E430) the doc is singleplayer
> `docs/design/gw2-zones/GW2-ZONES.md` and these files are archived here; the commits named below are
> project-wildshard-meta's. "R1 fix" = commit `e81d65c`; "R2 fix" = commit `ea4da44`; "R3 fix" = commit `666dd23`.

| ID | Round | Seat | Severity | Location | Finding (one line) | Status | Resolution |
|---|---|---|---|---|---|---|---|
| A1 | 1 | A | must | §4.3, §4.4 | Events and the meta arrive after the look; no return path from a failed playtest | fixed | R1 fix: §4.3 step 3 slice includes one event chain + fail / recovery when the return loop depends on it; step 5 extends a proven loop; "a failed gate goes back" + the kill rule |
| A2 | 1 | A | should | §4.3–4.4, §13, §14.0 | No first-fortnight sequence; Jake's review burden unclear; roles unassigned | fixed (partly) | R1 fix: two Jake gates, a "who decides" column, the weekly packet, a WIP limit. The day-by-day fortnight is **parked**: it depends on the SDK and on §14 Q1 |
| A3 | 1 | A | should | §9 Nine Dragon | No plan for redirecting the existing fragment or its art | fixed | R1 fix: §9 Nine Dragon slice (envelope → teaching crossing → route choice → yank fight → return lift), what is kept or moved, what waits |
| A4 | 1 | A | must | §9 Pine, §11, §14.1 | The grown Pine worsens the phone session; the board closes on failure; lantern states undefined | fixed | R1 fix: §9 Pine's 15-min hunt contract, always-available "hunt tonight", claim at the nearest waystone; the siege meta removed (C12) |
| A5 | 1 | A | should | §7.2, §9, §10 | Day 30 has no concrete goal, pace or budget | fixed | R1 fix: §10 "Day 30, illustrated", with numbers marked as hypotheses |
| A6 | 1 | A | should | §10.3, §11, §14.7 | Outside author's path to publication and discovery is ambiguous; no cold start | fixed | R1 fix: §10 "How an outside author's shard gets found" (newcomer window, signals, reachable routing); §14 Q7 recommended answer |
| A7 | 1 | A | should | §3, §11 | A happy-path bot can't prove finishability; flag membership ≠ reachability | fixed | R1 fix: §11 validator checks (reachability; played coverage of entrances, clock phases, death / reload, branches; bot ≠ fun) |
| A8 | 1 | A | should | §4.3, §9 Driftwood | The director must invent Driftwood's first hour | fixed | R1 fix: §9 Driftwood's first-hour strip, legs to test first, intended quiet |
| A9 | 1 | A | should | §7.3, §9 Nalati, §12.6 | "Scale with participants" doesn't direct a two-player experience | fixed (partly) | R1 fix: §9 Nalati's two-player flock recovery and kokpar teams, credit, personal flags, leave rule. Jel Ata join / leave scaling **parked** for the multiplayer design |
| A10 | 1 | A | must | §1, §3, §5 | "First-pass quantity is not the main gap" isn't established; minutes include waiting | fixed | R1 fix: §1 and §3 reworded ("more implemented systems than a player can reach … no run timed"); §3 "what a real measurement needs" |
| A11 | 1 | A | should | §4.4, §9 | The fun test has no acceptance criteria for portrait touch; rewards invisible in first person | fixed | R1 fix: §4.4 phone control test per core loop; rewards shown in first person |
| B1 | 1 | B | must | §11, §13 | Finishability is claimed covered by FINISH-LINE S1 / GN N9; neither plays a quest | fixed | R1 fix: §11 "Played, a new check"; §13 decision 2 (a golden-path run per shard) |
| B2 | 1 | B | must | §1, §10 row 2 | Two of four mastery verbs are wrong (tracking cut, diving shared) | fixed | R1 fix: §10 row 2: ride + grapple; Pine longbow as candidate; Driftwood none until diving has a challenge; the home-shard rule |
| B3 | 1 | B | should | §4.3, §10, §11 | The every-shard 14 m/s hoverboard is never mentioned | fixed | R1 fix: §2 row, §11 core "Travel speed", §12.7, §14 Q8 |
| B4 | 1 | B | should | §5, §9 Nine Dragon | Nine Dragon's ±250 m plan breaks the 200 m envelope | fixed | R1 fix: §5 layers bullet; §9 Nine Dragon "only as high as the open height decision allows" |
| B5 | 1 | B | should | §12.2, §14 Q6 | "An MMO needs one global clock" contradicts its own analogues | fixed | R1 fix: §12.2 three clock options; §14 Q6 reworded with a recommendation |
| B6 | 1 | B | should | §4.1 | Nalati designed encounters first; what it lacked was sequence | fixed | R1 fix: §4.1 rewritten with `c7a5cfbc` / `4770c648` (merged with C1) |
| B7 | 1 | B | should | §7.1 | The wolf raid is overstated as a complete dynamic event | fixed | R1 fix: §7.2 and §6 reworded (scheduled raid, NPC defender, `MAX_PACKS = 2`) |
| B8 | 1 | B | should | §1, §3 | The Den is ~470 m, not ~430 m | fixed | R1 fix: §1, §3 and the inventory |
| B9 | 1 | B | should | §1 | "About as much content per m²" is 2–5× and counts waiting | fixed | R1 fix: merged with A10 |
| B10 | 1 | B | should | §4.3, §4.4, §13, §14 Q0 | The Beats gate is defined three ways; §13's still mocks up before play | fixed | R1 fix: one definition, Verb → Slice → Frame → Form → Play → Pin, used in §4.3, §13, §14 |
| B11 | 1 | B | should | §4.3 vs §4.4 | Jake reviews 7 steps in one place, 3 in another | fixed | R1 fix: merged with C11 (two gates) |
| B12 | 1 | B | nit | §11 Hub row | Hale and Mott are not one hub | fixed | R1 fix: the Hub slot left the core; Hub is a genre template |
| B13 | 1 | B | nit | §15 | Nine Dragon's PDF is not at the tag | fixed | R1 fix: §15 notes `a9bbe4fd` |
| B14 | 1 | B | nit | §1, §5 | Event range and heart range inconsistent; R4 / R5 uncited | fixed | R1 fix: ~4.6–13; ~0.2–1.2; "SHARD-PLATFORM-PLAN R4 / R5" |
| C1 | 1 | C | must | §1, §4 | The root cause is wrong against the doc's own evidence | fixed | R1 fix: §4.1 "two causes": no played session on the phone; world and content split, with no owner of sequence (L6 kept) |
| C2 | 1 | C | must | §4.3, §13, §14 Q0 | Paper first, play fourth | fixed | R1 fix: §4.3 reordered: pitch + verb greybox → Jake plays → one-page beats → playable slice with a measured pacing curve; one-page cap |
| C3 | 1 | C | must | §1, §10 | Masteries name cut or decorative verbs | fixed | R1 fix: merged with B2 |
| C4 | 1 | C | must | §1, §6, §11, §12.1 | GW2's structure adopted as the target, against L4 | fixed | R1 fix: §1 "ruler for scale"; §7.1 multipliers table (needs players / server; solo version) + better rulers |
| C5 | 1 | C | should | §9, §11, §12.2, §14 Q1 | Session shape open while numbers assume long sessions | fixed | R1 fix: ≤ 10–15 min session unit throughout; §14 Q1 recommended "phone-first" |
| C6 | 1 | C | should | §11, §14 Q7 | One mandatory grammar makes shards samey | fixed | R1 fix: §11 required core + genre templates |
| C7 | 1 | C | should | §7.1, §11, §5 | GW2 event templates are third-person crowd templates | fixed | R1 fix: §7.2 first-person template set; fight rules as engine default; escort "avoid" |
| C8 | 1 | C | should | §4.4 | A long-lived director session is the pattern E352 banned | fixed | R1 fix: §4.4 the director is a role + `design.md` with a verdict log; WIP limit |
| C9 | 1 | C | should | §4.4, §3, §11 | Fun has no working test; the inbox is ignored | fixed | R1 fix: §4.4 "bots measure, Jake judges", the inbox + session trace, the kill rule; §8 inbox row |
| C10 | 1 | C | should | §4.4 | Jake's taste has no written form | fixed | R1 fix: §4.4 "fun rules" page; §14 Q9 |
| C11 | 1 | C | should | §4.3, §4.4 | Jake's review load goes up | fixed | R1 fix: two gates per shard; director decides the rest |
| C12 | 1 | C | should-add | §9 | Per-shard growth plans are all GW2-shaped | fixed | R1 fix: §9 rewritten per shard: model, session unit, server-free return, what waits |
| C13 | 1 | C | should-add | §7.2, §10, §12.3 | A daily seed is the cheapest return loop and missing | fixed | R1 fix: §7.1 row 4, §10 glue #0, §12.1, §13 |
| R2-A1 | 2 | A | must | §7.1, §8, §13 | Pine's board is not a daily seed (serial hash, no clock) | fixed | R2 fix: §7.1 row 4, §8 row, §13 corrected; daily seed marked new work (merged with R2-B1, R2-C3) |
| R2-A2 | 2 | A | should | §4.3 step 3, §4.4 | Gate 2 can't see the whole 10–15 min unit inside a ≤ 10 min play budget | fixed | R2 fix: gate 1 ≤ 10 min; gate 2 plays the whole unit (≤ 15 min, incl. payoff and stop) |
| R2-A3 | 2 | A | should | §9 Pine | An available board doesn't ensure an available hunt target (20-min elite cooldown) | fixed | R2 fix: §9 Pine minute 0–1: only available targets; an equivalent short hunt otherwise |
| R2-A4 | 2 | A | should | §9 Pine | The payoff assumes a walk to the cabin's trophy wall | fixed | R2 fix: a first-person journal plate at the waystone; the wall is optional |
| R2-A5 | 2 | A | should | §11, §14 Q8 | "Ignore the hoverboard" is ambiguous; hover → dismount → finish | fixed | R2 fix: §11 travel speed: declared modes, forbidden mode invalidates, off in trial / gate space, test hover → dismount (merged with R2-B11, R2-C13) |
| R2-A6 | 2 | A | should | §4.3–4.4, §9 | The density rule's definition was deleted | fixed | R2 fix: restored in §4.4 with a research link (merged with R2-B6, R2-C8) |
| R2-B1 | 2 | B | must | §7.1, §8, §9, §10 | Board hashes a serial; a daily bounty reverses PH-U21 unannounced | fixed | merged with R2-A1; §9 Pine lists the reversals; §14 Q10 |
| R2-B2 | 2 | B | must | §9 Nalati | The cairn summon was picked against (natural storms only, 2026-09-22) | fixed | R2 fix: §9 Nalati states the pick; §14 Q10 |
| R2-B3 | 2 | B | must | §7.2 | MAX_PACKS caps pack respawns, not raids (raids recur every 6–9 min) | fixed | R2 fix: §7.2 reworded |
| R2-B4 | 2 | B | must | §4.1, §1, §11 | Driftwood's jetties are the mandated edge roads, not a map pick | fixed | R2 fix: §4.1 "edge roads with no goal"; §11 core: each edge road leads to a goal; §1 reworded |
| R2-B5 | 2 | B | should | §4.3, §4.4 | Two gates vs the four checkpoint human inputs; taste handed to the director | fixed | R2 fix: §4.3 shard-checkpoints mapping (Frame / Form keep Jake's picks; Play is the director's; Pin at every gate); Jake picks every taste axis (merged with R2-C2) |
| R2-B6 | 2 | B | should | §4.4, §9, §11 | Density rule lost in the rewrite | fixed | merged with R2-A6 |
| R2-B7 | 2 | B | should | §5, §9 Nine Dragon | The fragment (+115…+135 m) is outside ±100 m | fixed | R2 fix: §9 Nine Dragon "Height" bullet |
| R2-B8 | 2 | B | should | §9 Nine Dragon, §14 Q0 | Nine Dragon skips gate 1 | fixed | R2 fix: §9 Nine Dragon gate 1 = the existing Fei Zhua crossing |
| R2-B9 | 2 | B | should | §9 Driftwood | Driftwood's only happening is night-only | fixed | R2 fix: a short-cycle monkey raid on Maren's stall; the sailor stays a bonus |
| R2-B10 | 2 | B | should | §10 Day 30, §9 Nalati | Day 30 assumes a Nalati currency that doesn't exist | fixed | R2 fix: saddles and tack by ladder rank and medals; a currency is a Jake pick (E314 C) |
| R2-B11 | 2 | B | should | §11 | Hoverboard wording | fixed | merged with R2-A5 |
| R2-B12 | 2 | B | nit | §4.4 | "Mostly say no" is not Jake's quote | fixed | R2 fix: replaced with "First person, first person, first person" (Driftwood PDF) |
| R2-B13 | 2 | B | nit | §4.1 | Nalati chapters came the next morning, not two days later | fixed | R2 fix: `baa205c8`, 09-24 |
| R2-B14 | 2 | B | nit | §4.3, §4.4 | Gate 2 described two ways | fixed | R2 fix: one phrase ("played; yes / no + one note") |
| R2-C1 | 2 | C | must | §4.2, §4.3, §13 | "Look last" is half of Driftwood's lesson: it was mockup-first for an hour | fixed | R2 fix: §4.2 two halves; step 0 = pitch + style pick + one ≤ 1 h mockup round; frame rate at every gate |
| R2-C2 | 2 | C | must | §4.3 step 4, §4.4 | Taste handed to the director, against "everything is a decision on my plate" | fixed | R2 fix: Jake picks every taste axis; the director decides what plays |
| R2-C3 | 2 | C | must | §7.1, §8, §9 Pine | Pine's board claim is wrong; daily bounty and ribbon currency reverse PH-U21 / PH-U16 | fixed | merged with R2-A1; §9 Pine respects both picks; §4.3 rule "a pitch lists the Jake decisions it reverses" |
| R2-C4 | 2 | C | must | §9, §1 | Per-shard models replace each shard's own pitch and drop its pillars and climaxes | fixed | R2 fix: §9 rebuilt on pillars + signature moments; borrowed games only frame session units; the Well Dragon back as the solo climax |
| R2-C5 | 2 | C | should | §4.4, §11, §14 Q1 | No layer holds an arc or a climax | fixed | R2 fix: the Arc loop; §11 climax rule (1–2 per shard, ≤ 25 min, checkpoints, signalled start); §14 Q1 |
| R2-C6 | 2 | C | should | §7.1, §9 Driftwood, §10 | The daily seed is a floor; seeds must change a decision; Day 30 lacks the shard of the day | fixed | R2 fix: "must change a decision"; Driftwood ghost trials; Day 30 leads with the shard of the day (Trackmania TotD) |
| R2-C7 | 2 | C | should | §9 Driftwood | Glyph sites are 3–8 min, not ~10 | fixed | R2 fix: §9 Driftwood session units |
| R2-C8 | 2 | C | should | §9, battery | Density rule lost | fixed | merged with R2-A6 |
| R2-C9 | 2 | C | should | §4.3, §4.4 | Where design.md lives, who opens a director session, who edits | fixed | R2 fix: §4.4 top section of the shard's plan; verdict log as ask ids; sessions at gates / packets / drains; only directors edit pillars, beats, map |
| R2-C10 | 2 | C | should | §4.4, §1 | Two gates read as the maximum | fixed | R2 fix: "the gates are his minimum, not his maximum"; every deploy playable; pairing evenings |
| R2-C11 | 2 | C | should | §9 Nine Dragon, §13, §14 Q0 | Nine Dragon's queued look work | fixed | R2 fix: look rounds pause until gate 2; memory / stability continue |
| R2-C12 | 2 | C | nit | §4.4 | "Mostly say no" misattributed | fixed | merged with R2-B12 |
| R2-C13 | 2 | C | nit | §11 | "Ignore it" | fixed | merged with R2-A5 |
| R3-A1 | 3 | A | should | §11 Climaxes, §9 Nalati | What happens when the app closes after a climax checkpoint (Boss.ts persists no phase) | fixed | R3 fix: §11 climax checkpoints survive app close; resume restores phase and conditions (mount, held storm); weather gates first entry only; no duplicate reward; test close / reload per phase |
| R3-B1 | 3 | B | must | §9 Nalati, §14 Q10 | E314 C didn't rule out a Nalati currency; the loot plan left it open | fixed | R3 fix: §9 Nalati (never had one; no pack by E314 C; currency left to a later pick); §14 reversals list drops it |
| R3-B2 | 3 | B | should | §1, §7.1, §7.3, §10, Day 30 | "Two currencies" contradicts §9; Day 30 pays into dead sinks | fixed | R3 fix: "a grid currency over each shard's own rewards"; reward tracks per shard law; Driftwood needs new cosmetic goods, Pine needs things to barter for |
| R3-B3 | 3 | B | should | §10 #0, §11 Hunt | Date-seeded leftovers against PH-U21 | fixed | R3 fix: #0 "seeded tasks: date-seeded where law allows a clock, drawn by claim where it doesn't"; Hunt template wording |
| R3-B4 | 3 | B | should | §9 Nine Dragon, §5 | Jake already OK'd a 500 m cube for shard 4 (E169) | fixed | R3 fix: §5 and §9 state E169; the open question is the platform's rule for uploads |
| R3-B5 | 3 | B | should | §4.3 | The shard-checkpoints mapping misstated Play and Pin's human inputs | fixed | R3 fix: Play's note moves to the director except at Jake's gates; Pin's approve-or-revise stays Jake's as a packet item |
| R3-B6 | 3 | B | should | §4.4 | `docs/plans/<SHARD>.md` exists for one shard and gets archived | fixed | R3 fix: the design lives in the shard's section of singleplayer `docs/SHARDS.md` |
| R3-B7 | 3 | B | nit | §4.2 | Driftwood timeline slightly overstated | fixed | R3 fix: ~35 min of mockups, real-HUD round at 00:47, 25 deploys by 04:23, 33 of 47 prompts 01:00–02:44 |
| R3-B8 | 3 | B | nit | §9 Pine | Bounty keyed on the draw serial is farmable | fixed | R3 fix: `board.claimed` |
| R3-B9 | 3 | B | nit | §15, §9 Driftwood | Missing sources; one unsourced pillar | fixed | R3 fix: `baa205c8` and Trackmania in §15; the pillar marked "(proposed)" |
| R3-C1 | 3 | C | must | §4.3 step 4, §4.4 | The R2 fix put Jake's taste load back at today's level ("I care about the plans") | fixed | R3 fix: taste stays Jake's as one recommended yes / no each in the weekly packet; work continues behind a Debug row with the old look selectable; both quotes cited |
| R3-C2 | 3 | C | must | §4.3, §4.4, §11, §13 | No human plays the arc and the climax end to end (cause 1) | fixed | R3 fix: step 5 Arc = gate 3, Jake plays the first playthrough as his ordinary sessions over a week, timed by the trace; return loop moves to step 6 |
| R3-C3 | 3 | C | should | §14, §13, §1 | Jake can't decide from §14 on his phone | fixed | R3 fix: a "What you decide" box at the top of §1; §14 split into Decide now (4) / Later (8) / Reversals; golden-path run added; Q5 (world story) given a recommendation; Nine Dragon's pause unbundled |
| R3-C4 | 3 | C | should | §14 Q0, §4.4, §9, §4.3 | Three rules disagree on who changes a pillar; Pine's scoping picks listed as pillars | fixed | R3 fix: only Jake changes a pillar (the kill rule escalates a pillar to him as a yes / no); Jake approves pillars at step 0; PH-U16 / U21 moved to "Jake's picks in force" |
| R3-C5 | 3 | C | should | §9 Nalati, §14 | Natural storms keep Jel Ata out of a phone session | fixed | R3 fix: save the storm clock as minutes of play across loads + a forecast at the rail; a summon stays Jake's call |
| R3-C6 | 3 | C | nit | §11 Climaxes | "May run longer" read as a permission in a required core | fixed | R3 fix: "Optional; if a shard has one (at most 2)…" |
| R3-C7 | 3 | C | nit | §4.3 step 3 | Two-player test before multiplayer exists | fixed | R3 fix: "with two once rooms exist (§7.4)" |

## Rounds

| Round | Reviewed at | Accepted must | Accepted should | should-add taken | Verdicts |
|---|---|---|---|---|---|
| 1 | `207e362` | 9 (A1, A4, A10, B1, B2, C1–C4) | 24 (+ 3 nits) | 2 of 2 | A not clean (3 / 8 / 0); B not clean (2 / 9 / 0); C not clean (4 / 7 / 2) |
| 2 | `355f469` | 7 unique (A1 = B1 = C3; B2, B3, B4, C1, C2, C4) | 14 unique (+ 3 nits) | — | A not clean (1 / 5 / 0); B not clean (4 / 7 / 0); C not clean (4 / 7 / 0) |
| 3 | `46368f2` | 3 (B1, C1, C2) | 9 (+ 5 nits) | — | A not clean (0 / 1 / 0); B not clean (1 / 5 / 0); C not clean (2 / 3 / 0) |

**Outcome (3 rounds, Jake's cap):** accepted must-fix fell 9 → 7 → 3 and should-fix 24 → 14 → 9; round 3's Codex seat
found no must-fix. Every finding is fixed or parked (A2's day-by-day fortnight; A9's Jel Ata join / leave scaling).
What only Jake can decide went to him as the four "Decide now" questions in §14, each with a recommended answer.
