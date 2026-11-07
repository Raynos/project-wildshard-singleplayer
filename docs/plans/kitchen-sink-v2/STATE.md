# KITCHEN-SINK v2: state

**Updated:** 2026-11-03 (E523 session, after the UI picks). **Phase:** planning with Jake, ~96 % decided; nothing built.

**Settled:** the parent §2 (rulings 1–19ad): seven attributes and the whole combat maths (19aa; levels-combat §15), the
polished look (19ab), the Titan behind a boss portal (19ac), the 500 m shard cube (19ad), the golden-ratio XP curve, option E misses, other shards keep simple combat.

**Build order:** vertical slices (Jake 11-03), not two waves: [slices/](slices/README.md), 33 west (~810 h) then 54 east
(~1,302 h), engine work just in time inside each slice, every touched shard migrated in the same slice; decisions D1–D48
in slices/DECISIONS.md. Crew 5 Opus + 5 Codex when Jake says build.

**Layout:** blockout round 5 (round 4's west and bands; the SE bottom is a 2,496 m² Titan gate and a 14,114 m²
three-court gauntlet; the 15 m Titan fights in a ⌀104 m hidden arena at y −150). 13.4 % of the cell free.

**Mockups:** all 40 remastered (`art/showcase-template/round-11-remaster/`, the gallery artifact). Five show the old SE
and get redone on round 5: E11 (gauntlet), E13 / E14 / S06 (Titan arena), M03 (aerial from the east).

**Decided 11-03:** Titan 15 m; the Titan road opens after the first gauntlet clear; wave-3 elite Shift Supervisor. **The 38 UI changes** (one by one): 33 approved, 5 cut ([UI-PICKS.md](UI-PICKS.md); rules in the HUD mini
plan; D49–D61). The ramps were D7 (launch walls, kickers 2.4 / 3.6 / 4.8 m).

**Decided 11-03 (panel):** loot locked as written (D62); quest names kept (D63); the UI cuts are UI only.

**Open for Jake:** the 67 questions in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) (the walk-through page "Kitchen Sink v2 open
questions"), each with a recommendation; answers go in its last column.

**Open row, MR1 (found 2026-11-06, E536):** re-baseline the slices for multi-repo. The hours and paths date from 11-03:
`src/format` is now the `shardfile` repo (each new row = a release), new features start in the new repos (J119), saves wipe
at a breaking promotion (J149, so the save shims go), and the slice rule's same-slice migration becomes the staging dance.
Done when: slice files name the new repos, save-shim work is cut, and hours are re-estimated. Top 20 (start here):
[Kitchen Sink Engine Top 20](https://claude.ai/artifact/R3JZEyPiaPuMMQiiAqsozV).

**Open row, MK1 (found 2026-11-06, E537):** m01 and m02 still show the surface Titan arena (m01 also the size stencils),
and w07's caption has the old kicker heights. Done when: all three are redone on round 5 and D7, in the polished look.
