# SHARD-PLATFORM ready queue (coordinator-kept; Jake 2026-10-20: "we should reduce idle lanes")

A lane that finishes its task does not wait for a brief: it takes the TOP row of its type whose Taken cell is empty,
claims it with a one-line pathspec commit to this file (`<lane> <HH:MM>`), sends `wildshard-new` one line, and starts.
A brief sent by wildshard-new always wins over this queue. The coordinator keeps at least five open rows per type.
Every row is decided work (Jake's G-rows); the refs are the brief.

## Opus (graphical)

| # | Task | Refs | Taken |
|---|---|---|---|
| O1 | Nalati C7 drawing remainder to zero: mountedFigure (66) + pastureView (27), charged by G520; onto approved riding/view hosts with a real second shard, or into Nalati AS + data rows; then C7 locks closed | G530, G520, G518 | sp-o5 19:03 |
| O2 | Nine look/render.ts (222) onto look-graph / post-chain rows; an AO/uniform-link host only with a real second shard | G513, G533 step 6 | |
| O3 | Driftwood looks: runtime/looks/creatureLooks.ts, captain looks and coat as look graphs, toon/day-sky exports as rows | G532 research D5/D6 | |
| O4 | G536 menu hero: three real in-engine captures of the whole 5x5 at the menu hero framing, phone tier, into art/grid/round-28-hero/, SHA to wildshard-new (only once the outer band is filled) | G536 | |
| O5 | Nalati remaining view code (world/view.ts and look tails) toward 5 % custom | G533 step 6 | |
| O6 | Pine King atmosphere hook + cave/pool presentation onto boss-host / water rows (listed view code if per-frame) | G532 research P3/P4 | |
| O7 | Driftwood ocean admitted through world.water (floor, dry, lent, foam) as a declared client-plan world feature (after X11) | G532 phase C, sp-o5 19:55 | |
| O8 | A living-buildings client feature for Driftwood's shrine life (real second user required, G518) (after X11) | G532 phase C | |

## Codex (non-graphical)

| # | Task | Refs | Taken |
|---|---|---|---|
| X0 | Ruler split (coordinator ruling 10-20): in scripts/grid-runtime-evidence.mjs, oneFrameLooks passes on the visual/stall witness (complete entry, no reload/hole, no context loss, no frame > 200 ms); add a separate per-shard frameFloor criterion (Simulator p95 <= 35 ms on every grid row, desktop 60) reported next to M2 and in ruler.json; focused tests; no cap change | Jake goal 30-60 fps Sim, G415 |sp-x6 18:01 |
| X1 | G540 hover speed classes (padding shards keep road speed via a per-shard row) + Developer-only BOOST HUD toggle (2x road / 4x in-shard); announce the HUD change on herdr before/after (E332) | G540 | done 08c611c8f1 + 726c5b90a1 (sp-x6) |
| X8 | The ruler must always measure (G518): when one shard's product build fails (e.g. the 10-20 Driftwood 'World scenes require plain JSON'), report that shard's criteria as fail/unknown with the error and still write ruler.json for every other shard, exit 0; focused test with a deliberately failing fixture shard | G518, 10-20 crash | done 8ff60bd7b1 (sp-x6) |
| X12 | G547 build capacity (2098201bf0, AGENTS.md updated): scripts/heavy-lane.py 'build' admits 2 concurrent leases (push gate keeps priority); mirror slots gate, commit, check, check2..check5 (build-mirror.mjs accepts them; batch_check/serve-build honour WILDSHARD_MIRROR_SLOT); spread lanes across check..check5 (common brief line); log queue wait, build seconds and load average per build for a day (one log file, report-only); also scripts/batch_check.py boot() serves ONE preview containing all touched shards and reuses it for each first frame (today it builds one app per touched shard), every check kept | G547, sp-x8 finding | done 29d62fc9ef + b3b0b19824 (sp-x6) |
| X13 | G548 B1 + B3 (build speed; docs/plans/shard-platform/build-speed-mini-plan.md): B1 key each shard's product only on the files its build reads (one flag set everywhere, incl. the ruler's --copy-runtime) so shared-code commits stop rebuilding all 11; B3 one in-process input-hash memo + stat memo for generation (no double read + SHA-256 of every input) and correct job keys so a same-commit rerun regenerates 0 jobs | G548 (2dbeff6348) |sp-x6 20:00 |
| X14 | G548 B2 + B4 + B5: build shards in a ~6-process pool (scripts/build-shardfiles.mjs:57), one shared parse across the three countOutput calls + WS_SHARD_PARSE_CACHE, the leased build at nice 0; then B6 acceptance (ruler wall <= 15 s on a commit not touching src/sdk or src/format, <= 35 s when it does, a no-change rerun 0 jobs / 0 shards); send SHA + both timings to wildshard-new. sp-x6 (X13) owns shardfile-cache.mjs, generate.mjs, generation-cache.mjs and B1 key/flag hunks in build-shardfiles.mjs: build the pool around those (rebase on its commits) | G548 | sp-x9 20:04 |
| X2 | C6 G516 items A: 1 wearSkin (Nalati adopts), 3 DW loot economy (Pine shop moves on), 5 rangedFeel (Nalati crossbow), 7 CrowdWeaponTarget (Pine wildlife), 12 firearm/nativeItems/melee profiles merge or delete | G516, G533 step 3 | done 04196ed6b9, 4ded2a79d1, c32c22c790, 376d5a279a, d0083a6899, c5bf0d71c2 (sp-x6) |
| X3 | C6 G516 items B: 2 bowVariant, 4 heldLauncher to game/weapons, 6 loadout/mounted, 9 ridingCourse, 10 Thrown (approve at HOST-BAR >= 5/6 with a real second shard, else charge back), 8 rename engine/player/nalatiArms.ts to a generic FP arms builder; Nine Jian combo onto the held-melee host | G516, G515, G533 step 3 | |
| X4 | Cut the G520 charged-back hosts (Nalati +998, Nine +196, Pine +137, DW +12): each gets a real second shard this wave or moves into its shard's AS + data and the platform module is deleted | G520, G518 | |
| X5 | G532 phase B: one shared quest host (page + headless) with Pine and Driftwood as each other's second user, one trader, one chapter director, shared props; old saves load | G532 (1), research P1/P2/D4 | |
| X6 | Production /api/telemetry returns HTTP 500 on every load; fix the route; also the 404 for nine near.json in the grid | live audit 10-20 | |
| X7 | Hooks run the gated tree's own scripts (pre-commit + push gate ran working-tree scripts against older trees twice on 10-20) | 10-20 incidents | |
| X10 | Garment catalogue rows (captain hat, cape, trader, people) via a NATIVE specimen job (the portable catalogue job lacks src/engine), touching quest/install.ts only after phase B | G532 phase C | |
| X11 | G532 phase C Codex half: Driftwood runtime/index.ts + hybrid.ts plugin removal via the declared runtime entry (G483), engine/boot/plan.ts BuildStages retired | G532 (4)/(5), research D3 | |
