# Seat brief: how much does each shard look like its mockups?

You are one seat of a clean-room council (`docs/process/COUNCIL.md`). Read `ledger.md` (frozen: the mockups, the score,
the no-shortcut rules) and `scores.md` (every earlier round) in this folder. You never see the conversation that built the
shards.

**Your surface:** the round's capture of each shard being scored, `progress/<slug>/<stamp>/` (named in the round's
`round-<n>/README.md`), and in it the `mock-*` views, one per mockup, plus the hero views and `clip.mp4`. The round's
side-by-side sheets: `art/mockup-council/round-<n>/<slug>-<mockup>.jpg` (mockup | game). The mockups' paths are in the
ledger.

**Score** each mockup 0–10: how much the game, at the matching view, looks like the mockup. Judge composition and subject,
forms and silhouettes, materials and detail, light and colour, density and depth, and the hands / weapon / HUD where the
mockup shows them. 10 = a player could take the mockup for a screenshot of this build; 8 = clearly the same scene and
finish, with differences you have to look for; 5 = the same place, but clearly a rougher version; 2 = barely related.
Check the no-shortcut rules (ledger 5) and report any breach as a finding.

**Write** `round-<n>-seat-<A|B|C>.md` in this folder:
1. a table per shard: mockup, score, the three biggest differences (each with the region of the frame);
2. the shard's seat score (the mean of its mockups);
3. findings: the concrete changes that would raise the score most, ranked, each with the mockup, the frame region and
   a fix the builder can make (no new content beyond what the mockup shows; no invented numbers);
4. the last lines: `SCORE signal-dunes: <x.x>` and `SCORE sky-reach: <x.x>` (only for shards in this round).

Do not edit, create or commit any other file in the repo; no git commands that change anything.
