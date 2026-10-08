# SF50-p close: Signal Dunes' creatures as declared rows; no direct save write left (E435)

- **Creatures as declared rows** (`runtime.binds` + `spawns`): `src/game/shardfile/runtimeSpawns.ts` (new format module, for
  sp-x5 to wire: the rows sit at `runtime.spawns`, present exactly when `binds` names `spawns`) declares a trusted runtime's
  homes (`id`, runtime species `kind`, variant `look`, `at` [x, z], `yaw`, `respawn` s) and boss bodies. The platform keeps
  them (`bindRuntimeHomes`, `bindRuntimeBoss` in `hybridRows.ts`): one creature per home, the refill, the retained identity
  and the cold-restore respawn moved out of the shard. Signal Dunes' 13 homes (`sunscar.home:0..12`, the same authored
  order and positions) and the Matriarch (`sunscar.matriarch`) are `data/spawns.ts` rows in `shard.config.ts`; the runtime
  keeps only its species, brains, the boss script and each body's dressing.
- **No direct save write**: the Matriarch's `bossesSave` persist became her flags (`sunscar.matriarch.defeated` / `.paid`;
  the old entry is read once, C26); the headless purse fallbacks (quest and boss) became `bindRuntimeCoins` (the loot purse,
  else the platform `Purse`). Fix on the way: her 20 coins now pay once (the old path never set `rewardTaken`, so every
  re-fight on a later visit paid again).
- **Map rebake** (shard.config.ts is a map input): tilesHash a3e1d17e…, 24,746 bytes (was 24,760; the world is unchanged).

## Evidence

- `grid-run.mjs` / `grid-run.json` (served candidate build, muted Chromium, iPhone 16 Pro, Developer on, through
  browser-lane): the live grid's Signal Dunes cell (-1, 0); seeded once on the north road deck, then real held hover input:
  enter (2.6 s, gameplayReady), quest 0 → 1 (Sefa's flag through the bound quest), whip crack (crackT -1 → 0), all 13 home
  identities `sunscar.home:0..12`, Matriarch dormant; leave by the road; re-enter (quest still 1, same 13 identities, whip
  cracks); leave. 0 page errors; the only failed requests are `/api/telemetry` 404s (vite preview has no API).
  `road-north.jpg`, `entered-1.jpg`, `whip-2.jpg`, `left-2.jpg`.
- `physics-walk.json`: `physics-baseline.mjs --no-build --mode=walk --shard=sunscar-dunes` on that build: 7 legs, 0 stuck.
- Tests: full vitest on a clean export (932 files, 5365 tests; the only failures were the stale map before the rebake and
  a +1 layer edge since removed); `test/shards/sunscar-dunes` + baked-maps + arch-guards + hybrid-runtime 174/174 after.
  New: hybrid-rows (spawn rows, refusals, platform coins), contract (no `bossesSave` write; C26 carries her record over).
