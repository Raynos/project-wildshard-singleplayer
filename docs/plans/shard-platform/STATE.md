# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-12 15:20 CT.** Councils done; Part A only. Route: the shardfile design system (G319, `design-system.md`).
**Fleet (G335, G337, `248f50470`): 4 building Codex panes + sp-x7 push/deploy only + ≤ 5 Opus subagents of the coordinator**; briefs in `lanes/`.

**Milestones**
- **M1:** done.
- **M2:**
  - **SF22 desktop:** PASS.
  - **Safari:** subset PASS (`bf3b0c45e`); assembled routes + Nine entry OPEN (harness race fixed `db524a44a`).
- **Frame floor (`c66b5b324`, then `511be2330` minimap, `04f4a7596` shader):** every max gate passes.
  - **Desktop:** only Pine short travel p95 33.4 (gate 17.5).
  - **Simulator p95 over 35:** Driftwood 59, Pine 58, Signal 52, Sky 37, Nalati 36.
- **SF57:** Pine re-admission fixed (`95e2e8d34`); repeat-entry GL residency proof open; Pine audio sprite 30.7 MB over the 25 MB cap (OPEN).
- **M3:** 0 of 6 at 80/20 (Nine 53.6 %, Sky 74.2, Signal 79.7, Nalati 95.4, Driftwood 97.7, Pine 100.1; custom / legacy).

**Live:** `77aa917d1-mv4wr3im`. Reds: `red-green.md`.

**Queue:** `open-x-queue.md`.

**Lanes (`lanes/README.md`)**

| Lane | Work |
|---|---|
| sp-x7 | push queue, CI, hourly release, Vercel deploys (game, admin, wildshard.io); no build rows |
| sp-x1 | desktop Pine short-travel p95 (CPU) · then SF67 loads |
| sp-x4 | SF22 Safari cadence · Nine entry 191 ms · route requalification |
| sp-x5 | SF57 Pine re-admission + memory · then SF82 BR-1/2/4/5 |
| sp-x6 | SF87/G320 CPU tail (bakes, spots, navmesh) · then SF29 |
| sp-o6 | render stalls: Pine program relink (`38ea143c5`), uploads |
| sp-o2 | G321 own skies (row deleted `cd9f8486c`, template-2 `a65a4043e`) · sky47 board |
| sp-o7 | M3 Signal port · sp-o8 M3 Nine port (GLSL → graph()) |
| sp-o5 | Pine map for SF57 (done) · GPU-gate parity reds (Template + Nalati re-baselined; 5 attributing) |

**Decisions:** G290–G336 in the plan.

**For wildshard-v (coordinator replies live here, never herdr; `92f6f1485`):**
- **G341 LANDED `f6d5a04f9`:** L-b hero; portrait = centre band (title + What's New above, cards + Settings below), landscape = full-bleed with the cards over it; `mainMenuLayout` row, painted `main-crossroads-portrait.jpg` and the losing code deleted (debug rows 6 → 5). Ships with the next release. (The earlier L-b suspect flag is cleared by G341's board pick.)
- DS1.4 done (`7e90dfbff`, `bdc3a2263`, board `progress/shard-platform/ds14/ds14-look-parity-board.jpg`); G321 own skies default on (`cd9f8486c`).

**Jake (open picks; `docs/reviews/shard-platform-open-picks.md`):**
- SF63 Driftwood shadows: Tight
- Sky isles: fixed vs random (recommend D, fixed)
- SF59 fixture looks
- G260 Blender looks
- Hero round 3 board (pending sp-o1)
