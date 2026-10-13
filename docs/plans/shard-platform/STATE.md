# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 02:15Z. G345 SPRINT (Jake, `34527bde0`): Signal Dunes + Sky Reach to 80/20 by ~09:30Z.** Quick checks +
push gate only; frame floor / Simulator / soak / boards paused. Lanes: `lanes/README.md`.

| Shard (custom / legacy; ≤ 20 % = done) | 21:40Z → 02:15Z; **per-export G294 since `ddf5c4dea`** | Target lines |
|---|---|---|
| Signal Dunes | 70.7 % → 48.4 % per-file → **53.1 % per-export** | ≤ 824 |
| Sky Reach | 78.4 % → 48.3 % per-file → **55.2 % per-export** (one-shard exports in shared files now count) | ≤ 1355 |

**Fleet:** Codex sp-x7 push/deploy, others parked (Codex 7 %). Opus: shared world-rows host sp-o51, Sky bake sweep sp-o52, creatures sp-o54, Signal ground steps 2+4 sp-o55.

**Live:** `957b05e6-mv5vop4l`; **release unpinned `e6eeefc1e`** (Linux CI + exact-SHA smoke incl. road→Signal green on `de0130e95`); next hourly release ships the Signal grid fix. Reds: `red-green.md`.

**For wildshard-v, Jake pick (80/20 reach; sp-o50 scoping):** honest cuts land Signal ~25–29 %, Sky ~35 %. **S1** quest/interaction state machines as sandboxed AssemblyScript hooks (AS uncapped until 90/10; ~−200 Signal, −250 Sky); **S2** shaders as SF59 graph rows (~−790, pixel-exact risk); **S3** accept 25–30 % / 35 % this sprint. Recommend **S1 + S3**.

**For wildshard-v, Jake pick (Signal look, Debug ▸ Look ▸ Signal look):** raw A/B `art/signal-look/round-1/`. B (baked fires) saves ~270 lines but visibly loses A's white core, smoke curl and ember streaks. Recommend **A**.

**LOOKS LINE (Jake: "I don't want to forget this main hero thing and the near look and feel"):** near board `art/near-tier/round-3/` (`f8803fd16`; first-party stays `--no-placeholders` until the pick); hero round 4 board `art/main-menu-hero/round-4/board.jpg` (`eb43b9f4c`), recommend SQ-DW-a + LS-DW-c; SQ-c/LS-c ship (`9422ff1d1`) until Jake picks.

**Coordinator calls (Jake can reverse):** bosses never shrink on the phone (`30dc4c9ae`); the road seam beside Signal blends into the sand actually drawn once the tint is baked into tiles (sp-o46, before/after in `progress/shard-platform/sp-o46/`); Sky parity rename `far.boss`→`far.roc` via `test/parity/renames/G345.json`.

**Paused:** frame floor (desktop Pine p95 33.4; Sim Sky 37, Nalati 36; fixes `38ea143c5`, `512bb3d16`, `dc4dfb106` unproven), SF22, SF57, SF67. Nine graph rollout needs a physical-iPhone reading. Sky parity baseline has 14 older red fields (pre-sprint drift).

**Open picks:** `docs/reviews/shard-platform-open-picks.md`.
