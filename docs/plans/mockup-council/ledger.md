# Ledger: the 8/10 mockup council (frozen)

1. **The goal** (Jake, 2026-10-02, `/goal`, ask E399): "make sure the engine is in a good state and that shard 5 and 6 hit
   their goal of reaching their mockups 8/10 based on council reviews and make sure they don't stop until 8/10 and are
   not lazy and don't take shortcuts." Earlier, for Sky Reach (E392): "keep looping until the game looks 8/10 like the
   mockups; let's try to make the game look like the mockups."
2. **Rounds until the bar.** Jake set the stopping rule himself ("don't stop until 8/10"), so this council runs rounds
   until a shard passes; COUNCIL.md's four-round cap is overridden by his words. A shard that passes stops being scored.
3. **The mockups** (what "8/10 like the mockups" is measured against):
   - Signal Dunes: `art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg` (Jake's pick) and
     `art/sunscar-dunes/round-9-review/A-spawn-dusk-light.jpg`, `B-quest-logbook.jpg`, `C-waymark-fire.jpg`,
     `D-hands-whip.jpg`.
   - Sky Reach: `art/far-reach/round-1-proposals/B-sky-reach.jpg`, `art/far-reach/round-11-review/mockup-A-spawn-look.jpg`
     and `mockup-D-crown-arena.jpg`, and `art/far-reach/round-18-council-mockups/mockup-B-quest-start-painterly.jpg` and
     `mockup-C-hands-fan-painterly.jpg`. The round-11 B and C were in the shard's old flat low-poly purple look, while the
     other three are the painterly golden hour it is built to (its own style: Jake, 2026-10-01), so no one build could
     match both. The lead (not the builder, so nobody sets their own exam) restyled B and C to proposal B's style with
     codex image_gen, keeping their composition, subjects, hand, fan and HUD exactly, with no less detail (2026-10-02,
     on sky-reach's flag; Jake can overrule).
4. **The score.** Each seat scores each mockup 0–10 for how much the game, at the matching view, looks like it:
   composition and subject, forms and silhouettes, materials and detail, light and colour, density and depth, the
   hands / weapon / HUD where the mockup shows them. A shard's seat score is the mean of its five mockups. **A shard
   passes when the mean of the three seats' scores is 8.0 or more** (8/10 is Jake's number).
   **Amended by Jake, 2026-10-03, after round 11 / round 10: the bar is 7.0** ("let's lower the bar from 8 out of 10
   to 7 out of 10 … the improvements are very slow"). A shard passes at a three-seat mean of 7.0 or more; every other
   clause, the no-shortcut rules included, is unchanged.
   **Amended by Jake, 2026-10-03 (E409): the council alternates two phases**, detail rounds and zoom-out top-10 plans, by
   the switching rule in docs/design/LOOK-LOOP.md ("Two kinds of round, alternating"). From round 13 (Signal Dunes) and
   round 13 (Sky Reach) the shards are in a zoom-out phase: docs/plans/SIGNAL-DUNES-TOP10.md, project/archive/2026-10-03-sky-reach-top10.md.
5. **No shortcuts.** A score is void, and the round is re-run, if the game got closer by any of these:
   - **The views:** the game views are fixed before each round in `art/<slug>/progress/cameras.json` (one `mock-*` view
     per mockup, at the mockup's camera). A view may be re-aimed only to match its mockup's camera better, never to dodge
     a weak area, and the change is named in the round's capture notes.
   - **No screenshot cheats:** real 3D in the playable area; painted only at infinity (sky, far panorama). No overlay,
     card or decal standing in for geometry the player can walk to.
   - **The real game:** the phone tier and touch HUD Jake plays (390×844 @3; the render is @3, and `shard-progress`
     stores each frame at 780 px wide to keep the repo small), the shipped build (no debug-only look),
     the baseline HUD (no hiding or restyling it for the shot), 30 fps phone budget and the memory limits (1.8 GB
     loading / 1.0 GB Explorer) held.
   - **No narrowing:** the rest of the shard (other places, the quest, combat) must not regress to make the views better.
   - **Staged state is real state:** a view may stage quest state the mockup shows (a shot's `stage` in cameras.json,
     e.g. the waymarks lit), only state a player reaches by playing; every staged shot is listed in the capture's
     `meta.json` (`staged`), and a seat checks that the stage is reachable.
   - **A staged frame is a real play frame** (round 2, seat C on Sky Reach's `fan-gust`): it may not freeze a pose a
     player only sees for an instant, or drop the effects that come with it (a GUST's streaks and petals). Capture the
     real moment with its effects, or make the pose one the player can actually hold in the game. A view that breaks this
     scores void for that mockup until it is re-captured.
6. **Builders:** the top-level Claude Opus agents `signal-dunes` and `sky-reach`. Never Codex / GPT for building.
7. **Seats:** three per round (COUNCIL.md): a Codex seat and two fresh Claude seats, clean room, never the conversation.
