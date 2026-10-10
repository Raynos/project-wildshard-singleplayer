# Round 4, seat B (evidence): the diff `a3f3c58ca..57a256a96` of PROGRESS-TRAILER.md

Checked against git and the tools, no browser. **Verified, no finding**: `b39cc8b8a` is 16 Sep 22:22:54 −0500 and
`sources/WILDSHARD.md` line 19 holds "…you use claude code as the UI for building…"; it is an ancestor of `568a1463f`.
Counts by `git rev-list --count`: 29 (`568a1463f`), 232 (`3a83028ec`), 624, 1,483 (`3719d1d8e`), 2,495, 3,117
(`54e37d4dd`), 5,729. The 21 stills at `568a1463f` come from 15 commits, the first `f027cf40d` at 22:43:26, so the grid
is empty for 0.86 s of 3 s ✓. 2 Oct is day 17 ✓. "43 hours" = `54e37d4dd` → `6066f959c`, 42 h 56 min ✓. `nd-grapple`
(`shots/nine-dragon.mjs:130`) lands about 2.0 s after in-point 0 (the teaser's GAP 11.0 − in 9.0), so the 2 s cold open
fits ✓. `g-reveal` is `shots/grid.mjs:19` ✓. `edit.mjs:35` has had `none: 'null'` since `403bd7c57`, and the vignette
and grain (`:88`) cover every clip ✓. `af87b952b` adds `--titles-html` with `pose` / `setPortrait`, and the TR5 cast is in
git ✓. `c9aaa62ab` has 6 manifests besides `_template` ✓. EYE is 1.68 on days 1 and 22, and `spawn` sets the feet on
every era, so a ground match is an eye match ✓. `decide.sh qa --set capture-status` exists ✓. Totals: play 25, authoring
25, cards and close 10 ✓. PT5's lengths match §2.2 ✓.

| ID | Severity | Where | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R4B-1 | should-fix | §2.2 0:46 rewind ramp vs §3.1 "0.25× for the rewind", PT3 | The diff specs a speed ramp (1× → ≈0.05× → 1×), but §3.1 still says 0.25×. Neither tool can ramp: `take.mjs` sets one `__dt` for the whole take, and `edit.mjs` reads frames at a constant rate. A constant 0.05× take retimed afterwards needs FRAMES / SPEED × SUB = 360 / 0.05 × 2 = 14,400 4K JPEGs per build, about 58k frames for the four. | `take.mjs:35-36,80`; `edit.mjs:59,77` | Add a per-sample speed curve to `take.mjs` (`--ramp=[[simT, speed]…]`, `__dt` set per sample, the curve logged in the receipt), so the frames come out already in screen time and `edit.mjs` stays unchanged. Change §3.1's "0.25×" to the ramp. |
| R4B-2 | should-fix | §3.4 "melody alone… + bass and strings… everything at week 3" | htdemucs splits into drums / bass / other / vocals. Melody and strings both land in `other`, so "melody alone" then "+ strings" can't be separated. "Everything" at week 3 adds only the vocals, which are ≈ 0 on an instrumental, so week 3 adds nothing you can hear. The citation is also off: `cuts/nine-dragon.mjs` only uses htdemucs to check for vocals (a comment, line 14); the splitter is `music_stems.py`. | `scripts/music/gen/stems.py:12,115`; `cuts/nine-dragon.mjs:14` | Arrange `other` → + bass → + drums, and make week 3's step the trailer families (riser, sub), or brief MiniMax with a sparse intro. Cite `music_stems.py`. |
| R4B-3 | should-fix | §3.1 "day 8, the numbered stills committed 22–23 Sep (days 7–8, 62 of them)" | I can't reproduce 62. `git log --diff-filter=A` of `progress/[0-9][0-9][0-9]-*` dated 22–23 Sep gives **94** on main, and only **14** of them are in `8a58b9d1e`'s tree. `8a58b9d1e` is not on main's first-parent line: it is the nalati-grasslands tip, its merge-base with main is `614f447d3` (22 Sep 21:02), and it lacks 214 main commits. So 80 of the "references" (`153-e38…` to `217-e80-hover-tab`) show Driftwood work that the day-8 build doesn't have. (L3 still stands: the week-1 combo is in that build, `Sword.ts` and `Sabre.ts:198`.) | the git commands above; `git rev-list --count 2d2c5815a ^8a58b9d1e` = 214 | Make the day-8 reference the numbered stills in `8a58b9d1e`'s own tree, committed 20–22 Sep (17 + 14 = 31), and write the command into §3.1. |
| R4B-4 | should-fix | §3.1 "Learned in PT2's first probe", "+1.27 s … +1.66 s" | These are stated as measurements, but their receipts went to scratch (`take.mjs --out=<scratch>`). Only `pt1-proofs.jpg` is committed. "20 points" are claimed, ~7 are named, and no day-22 deer distance is given for any of them. The only herd named, (97, −220), sits where the ground differs, yet PT2 (b) needs a stag within 14 m of a matching point. | `take.mjs:4,121`; `ls progress/progress-trailer/` | Commit the probe and slow-motion receipts (small JSON) to `progress/progress-trailer/pt2-probe/` and cite them. List all 20 points, each with its nearest day-22 stag distance. |
| R4B-5 | should-fix | §3.5 seconds order, PT11 "exactly 3,600 frames" | A chapter on week 3's pattern costs 8 s (the newest lapse keeps the showpiece) + 4 s of play = 12 s, not ~10, and the rewind gains a fifth segment (≈ 0.65 s at 0.05× per 2 m of bolt). Steps 1–3 free 6 + 2 + 1 (ND 6 → 5) + 3 (Sky Reach 8 → 5) = 12 s, so the film ends ≈ 0.65 s long and PT11 fails. | §2.2 lengths; §3.5 | State the new chapter's lengths, and add a step 4 (for example, the newest lapse gives up the remainder, 8 → 7.5 s). |
| R4B-6 | nit | §2.2 0:54 end card "Day 24 · 7,0xx commits" | HEAD on day 24 already has 7,115 commits (`git rev-list --count 57a256a96`). | git | "7,1xx", or write `<count>`. |
| R4B-7 | nit | §2.2 0:04 wall | "At its commit's moment" and "each held ≥ 4 frames" collide: three commit pairs land < 4 frames apart on the compressed clock (23:02:23 → 23:03:14 is 1.5 frames; 23:23:48 → 23:24:14 is 0.7; 23:37:27 → 23:37:44 is 0.5). The five stills of `ba33e33fb` take 20 frames, running past `4ca0073fc`'s moment (8.6 frames later). | `git log --diff-filter=A` of the stills | Each tile lands at max(its moment, the previous tile + 4 frames). |
| R4B-8 | nit | §2.2 0:44 breath | "Appears as the `+` line it was", but the `+` line runs 60+ words: the 7 shown are an excerpt, and "keyclicks" means it is typed, not that it appears. | `git show b39cc8b8a -- sources/WILDSHARD.md` | Show `+ … you use claude code as the UI …`, typed. |
| R4B-9 | nit | §2.2 0:32 Sky Reach | "In its first 43 hours" now titles the whole beat, but its last stage is `c9aaa62ab` (7 Oct, 4 days later). Cards name only what is on screen. | §2.3 | Caption the archive stages only; the last stage carries its own date (as round 3's text did). |
| R4B-10 | nit | §2.1 escalation; register | Weeks 1 and 2 are both 2 s shots, not "shorter each chapter"; 0:07 sits mid-bar (on the beat grid, but the register says "on bars"). The register's R3B-12 cites `6066f959c` (an E410 GPU-ceiling commit); the evidence is `403bd7c57`, `edit.mjs:35`. | §2.1; register | Change the wording to "no longer"; fix the register's citation. |

## Battery S1–S12

- **S1 pass.** The grapple from a new pose, then a 2 s card ≤ 7 words.
- **S2 pass.** The §2.3 rules hold; slow motion is the simulation dilated.
- **S3 pass.** `d01-hunt` is proven at 1× and 0.25×, but its numbers have no committed receipt (R4B-4).
- **S4 pass.** The frame, the band and the real-rate rail; the renderer is specced.
- **S5 fail as written.** The budget is short by ≈ 0.65 s (R4B-5).
- **S6 pass.** L11.
- **S7 partial.** The stem plan can't make its first and last steps (R4B-2); the SFX are era-true.
- **S8 pass.** `af87b952b` and the cast are in git; the ramp is in progress-trailer's own `take.mjs`.
- **S9 conditional.** It needs the ramp tool (R4B-1) and a matching spot with a stag within 14 m (R4B-4).
- **S10 pass,** bar the "7,0xx" placeholder (R4B-6).
- **S11 conditional.** PT2 (b) already escalates to Jake if the four frames aren't visibly better. This needs no decision from Jake now; I recommend keeping that escalation.
- **S12 pass.**

No must-fix, inside or outside the diff. Nothing here needs Jake's pick: every row is the lead's to fix.

Verdict: the round-3 fixes landed and their numbers check out against git; what remains is executability (the ramp tool, a 4-stem arrangement, a 12 s week-4 budget) and receipts (the day-8 reference count, the probe), all should-fix, none blocking.
