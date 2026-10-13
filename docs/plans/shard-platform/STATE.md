# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**SPRINT 2 (G400, 12:55Z → ~21:00Z): Signal + Sky below 20 % custom.** Custom 12:53Z: **Signal 43.9 % (1808 lines), Sky 48.3 % (3276)**; reported every 2 h. Driftwood/Pine/Nalati/Nine/near tier paused.
**2026-10-13 13:00Z. PORT % (G390, `351e3f8bc`): avg 44.7 %** (Template 100, Signal 74.9, Sky 69.7, Nine 48.3, Nalati 10, Pine 10, Driftwood 0). Finish line: 0 of 7 at 80/20.

**Nine ported** (34 L0 tiles, 0 private bins, Linux-exact). **Nalati 0 private bins** (`d3bdac368`); ground + nav one fetch (Nalati, Sky, Signal).
**RELEASE HOLD until CI + public-Nine smoke pass on ≥ `77bfbba70` (Pine Linux fixed `84eb0f68f`; last CI reds: Signal chunk sp-x6, two Nine fixtures sp-x8).** **LIVE `ad30fba68-mv6izhvz` (10:16Z, clean)**. Frame floor `fea49ae28` (`31f7986cd`): 7 shards PASS alone; grid FAIL: Sim Nine max fixed (`77bfbba70`: ~100 ms), Pine desktop PASS (`4b239382f`…`65e123136`); Sim travel still fails Pine 57–63, Driftwood 42–50, Far 40–47 (Nalati 34–35); left = texture uploads (KTX2 ask) + unsplit shard builds. **Whole products: Template, Pastel (Linux-exact), Signal (all Linux-exact).**

**Fleet (G384, Sprint 2):** Signal: x6 (inventory G396, glue/quest/creatures), x1 (lash → melee, movers), o124 (graphs, G397), o123 (world → tiles). Sky: x5 (steps 1, 8), x4 (2 movers), x8 (6 fan, 7 Roc + clip check), o125 (map determinism P0, then 3–5), o122 (9 effects). x7 pusher.

**Decided:** G385 near B (shipped `45a8bd0e3`), G386 Pine KTX2, G387 graphs with boards, G388 Sky movers yes, G391 (supersedes G389): Nalati port NOW (sp-x5) and every legacy three.js builder/model/set becomes a generator, all shards.
**Explorer inventory (G391, `generator-inventory.md` `15f01e335`), ported/total:** Template 0/3, Signal 8/10, Sky 0/27, Nine 0/47, Nalati 0/125, Driftwood 0/70, Pine 0/89.
**G398 for wildshard-v:** grid Simulator **Nine road travel PASSES** (p95 34 ms, max 84–106 ms, 2 runs each at `fa33af75d` and HEAD; receipt `b20a6716a`). Still failing in the Simulator: Pine (~50), Driftwood (42–50), Far (40–47) travel.

**For wildshard-v:** G392 Sky steps 1/2/8/7 sp-x6 (after inventory + G390), 3–4 sp-o120. Ruling (call 36): declarations-only `shard.config.ts` is not custom. STATE hourly.
**G387/G392 boards for wildshard-v:** Sky graphs ON (`fdb140aec`) `art/sky-graphs/round-1/board-{bridges,shack,dressing,falls}.jpg` (graphs use plain fog, a touch darker in shade); Pine KTX2 shipped `art/pine-ktx2/round-2-shipped/`; parity review `art/parity-review/signal-sky-2026-10-13/` (Signal look change = G266 near-sand grain, approved); G395 `art/effects-pairing/round-1/`. G393 Roc clip check staffed when sp-x6 has a candidate. Plan l.157 still says near tier is behind a row.

**Calls for Jake (2026-10-13; reverse any):** calls 6–41 are listed in commit bodies and `open-x-queue.md`; highlights: Nine portable math, literal physics rows, G318 cache move (`pnpm gen` first), Template binary to a test fixture, declarations-only `shard.config.ts` not custom (36).

Paused: SF22, SF57, SF67.
