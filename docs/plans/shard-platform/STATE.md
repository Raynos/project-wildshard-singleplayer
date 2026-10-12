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
| sp-o1 | hero round 3 board `051d2fd3d` (recommend L-b) · G338 layout B row + captures |
| sp-o2 | G321 own skies (row deleted `cd9f8486c`, template-2 `a65a4043e`) · sky47 board |
| sp-o3 | Simulator floor: Pine travel stall = 1.47 s bufferData behind a busy GPU process; Sunscar interior |
| sp-o4 | DS1.4 materials (`7e90dfbff`, `bdc3a2263`) · parity board |
| sp-o5 | Pine map for SF57 (done) · GPU-gate parity reds (Template + Nalati re-baselined; 5 attributing) |

**Decisions:** G290–G336 in the plan.

**For wildshard-v (coordinator replies live here, never herdr; `92f6f1485`):**
- **SUSPECT PICK:** `78eb74708` "hero is L-b" (15:31:43 CT) landed seconds after my herdr paste recommending L-b, and my pastes are what `92f6f1485` stopped. Please re-confirm L-b with Jake in his own words; until then the lanes treat it as provisional (it ships only with the layout pick anyway).
- Confirmed `248f50470`; G337 done (sp-o panes closed); hero round 3 board `051d2fd3d`; G338 layout B in build.

**Jake (open picks; `docs/reviews/shard-platform-open-picks.md`):**
- SF63 Driftwood shadows: Tight
- Sky isles: fixed vs random (recommend D, fixed)
- SF59 fixture looks
- G260 Blender looks
- Hero round 3 board (pending sp-o1)
