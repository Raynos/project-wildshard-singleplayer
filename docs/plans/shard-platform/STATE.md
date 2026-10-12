# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-12 15:20 CT.** Councils done; Part A only. Route: the shardfile design system (G319, `design-system.md`).
**Fleet (G335/G337/G339):** 4 building Codex panes + sp-x7 push/deploy + ≤ 5 Opus subagents; briefs in `lanes/`.

**Milestones**
- **M2:**
  - **SF22 desktop:** PASS.
  - **Safari:** subset PASS (`bf3b0c45e`); assembled routes + Nine entry OPEN (harness race fixed `db524a44a`).
- **Frame floor:** max gates pass.
  - **Desktop:** only Pine short travel p95 33.4 (gate 17.5).
  - **Simulator p95 over 35:** Driftwood 59, Pine 58, Signal 52, Sky 37, Nalati 36.
- **SF57:** Pine re-admission fixed (`95e2e8d34`); repeat-entry GL residency proof open; Pine audio sprite 30.7 MB over the 25 MB cap (OPEN).
- **M3:** 0 of 6 at 80/20 (`scripts/shard-platform.mjs`: Nine 69.5 %, Signal 78.4, Sky 78.4).

**Live:** `56de6e6-mv5qksnd` (21:00Z). Reds: `red-green.md`. Queue: `open-x-queue.md`.

**Lanes (`lanes/README.md`)**

| Lane | Work |
|---|---|
| sp-x7 | push queue, CI, hourly release, Vercel deploys (game, admin, wildshard.io); no build rows |
| sp-x1 | SF67 loads (preflight `f1cb95d77`) · Pine desktop CPU |
| sp-x4 | SP3 (Signal/Sky boot.audio done) · G342 near tier · SF22 timing |
| sp-x5 | SF57 Pine re-admission + memory · then SF82 BR-1/2/4/5 |
| sp-x6 | SF87/G320 CPU tail (bakes, spots, navmesh) · then SF29 |
| sp-o6 | render stalls: Pine program relink (`38ea143c5`), uploads |
| sp-o7 | M3 Signal port (70.7 %, `7c192ae99`) |
| sp-o9 | G344 square + 1x-FOV hero |
| sp-o10 | Pine grass fix proof (`4213f5720`) · Pine map for sp-x6 |
| sp-o11 | Sky / Nine road-entry timeouts |

**Decisions:** G290–G343 in the plan.

**For wildshard-v (coordinator replies live here, never herdr; `92f6f1485`):**
- **G341 LANDED `f6d5a04f9`:** L-b hero; portrait = centre band (title + What's New above, cards + Settings below), landscape = full-bleed with the cards over it; `mainMenuLayout` row, painted `main-crossroads-portrait.jpg` and the losing code deleted. Next release.
- **G342 / G343 (`b59d2a6ab`):** G342 engineering → sp-x4 (near tier, terrain first, one Debug row); per-shard look content → the next free Opus subagent; raw A/B crossroads captures to you. G343 hero round 4 after G342.
- **G344 board landed `d5efef557`:** `art/main-menu-hero/round-3-square/board.jpg` (+ raw iPhone layout-B screens in `layout/`). 1x lens: square 62°, landscape 43° v / 70° across. Recommend **SQ-c** (phone band) + **LS-c** (desktop). Note: with CSS `contain` the square fills ~78 % of the phone width; the wiring gives the band a full-width square. Template-2 fills the lower ~40 % (G343 fixes). Not wired; waits for Jake's go.
- **Blocker for Jake (M3 Nine):** Nine's ~3.2k GLSL lines can leave only when graph materials go default-on (`graphMaterials` row, RENDERING.md: needs one physical-iPhone reading). graph() gaps: `progress/shard-platform/nine-port/README.md`.
- DS1.4 done (board `progress/shard-platform/ds14/`); G321 skies default on.

**Jake open picks:** `docs/reviews/shard-platform-open-picks.md` (SF63, Sky isles, SF59, G260).
