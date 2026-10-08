# Hybrid shards declare behaviour rows: the runtime-owner binding (SHARD-PLATFORM M3, E435)

A hybrid shard's shardfile may now carry behaviour rows while its trusted runtime stays the owner of the world and play scope.

- `runtime.binds` (`src/game/shardfile/runtimeBinds.ts`, wired as an optional field of `RuntimeSchema`): the declared
  capability (`quests`, `ledger`, `items`) that replaces the implicit "empty apart from audio, edges and colliders" rule.
- `src/game/shardfile/hybridRows.ts`: `withoutRuntimeRows` (the data client never installs a bound section, and bound rows
  do not make a hybrid "non-empty"), `bindRuntimeLedger`, `bindRuntimeQuest`, `bindRuntimeItems`, `bindRuntimeItemContexts`:
  the template's installers, into the runtime's play scope.
- `installDeclaredItems` accepts a trusted shard's own families (`<slug>.<name>`, never shadowing `kit.*`), and can leave
  the declared input contexts to the runtime owner (entered-only for a retained home).

Signal Dunes: "The signal" quest, its two ledger facts and the bullwhip row live in `shard.config.ts`; the runtime binds
them (quest/install.ts, plugin.ts) and resolves `sunscar-dunes.whip` to its `Bullwhip`, which reads reach / width / damage /
cooldowns / charge from the row. The equipment row keeps the pre-format slot `sunscar-whip` (a saved held weapon carries
over). Quest flags moved to `data/flags.ts` so the config stays plain data.

## Evidence

- `browser-run.json` (`capture.mjs`, served build of the candidate, Chromium muted, iPhone 16 Pro): boot 7.5 s, the bound
  whip is the current weapon (`sunscar-whip`), quest index 0 → 1 (Sefa) → 4 (three waymarks lit), Attack cracks
  (cooldown 0.45 from the row), 0 page errors. `entry.jpg`, `after-crack.jpg`.
- Map rebake (shard.config.ts and world/build.ts are map-hash inputs): new `tilesHash` 31c1fefc…; the image against the
  previous bake differs by mean 0.063/255, 0.005 % of pixels over 16 (the world is unchanged).
- Tests: `test/shards/sunscar-dunes/hybrid-rows.test.ts` (5) plus every Signal Dunes, combat and shardfile test
  (142 files, 1131 tests) green, including the C26 save migration in `contract.test.ts`.
