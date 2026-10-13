# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 12:30Z. PORT % (G390): avg ≈ 44 %** (T 100, Signal 76, Sky 70, Nine 49, Nalati 10, DW 0, Pine 0). Finish line: 0 of 7 at 80/20.

**Nine ported** (34 L0 tiles, 0 private bins, Linux-exact). **Nalati 0 private bins** (`d3bdac368`); ground + nav one fetch (Nalati, Sky, Signal).
**RELEASE HOLD until CI + public-Nine smoke pass on ≥ `77bfbba70` (Pine Linux fixed `84eb0f68f`; last CI reds: Signal chunk sp-x6, two Nine fixtures sp-x8).** **LIVE `ad30fba68-mv6izhvz` (10:16Z, clean)**. Frame floor `fea49ae28` (`31f7986cd`): 7 shards PASS alone; grid FAIL: Sim Nine max fixed (`77bfbba70`: ~100 ms), Pine desktop PASS (`4b239382f`…`65e123136`); Sim travel still fails Pine 57–63, Driftwood 42–50, Far 40–47 (Nalati 34–35); left = texture uploads (KTX2 ask) + unsplit shard builds. **Whole products: Template, Pastel (Linux-exact), Signal (all Linux-exact).**

**Fleet (G384): 4 Opus + 6 Codex.** Codex: x7 pusher, x5 Nalati port (G391), x6 SF77 + G390 + inventory, then G388, x4 Pine, x1 Driftwood, x8 Nine. Opus: o120 Sky steps 3–4, o122 G395 effects, o119 G386 Pine KTX2, o115 desktop parity drift; G387 queued.

**Decided:** G385 near B (shipped `45a8bd0e3`), G386 Pine KTX2, G387 graphs with boards, G388 Sky movers yes, G391 (supersedes G389): Nalati port NOW (sp-x5) and every legacy three.js builder/model/set becomes a generator, all shards.
**Explorer inventory (G391, `generator-inventory.md` `15f01e335`), ported/total:** Template 0/3, Signal 8/10, Sky 0/27, Nine 0/47, Nalati 0/125, Driftwood 0/70, Pine 0/89.
**G398 for wildshard-v:** grid Simulator **Nine road travel PASSES** (p95 34 ms, max 84–106 ms, 2 runs each at `fa33af75d` and HEAD; receipt `b20a6716a`). Still failing in the Simulator: Pine (~50), Driftwood (42–50), Far (40–47) travel.

**For wildshard-v:** G392 Sky steps 1/2/8/7 sp-x6 (after inventory + G390), 3–4 sp-o120. Ruling (call 36): declarations-only `shard.config.ts` is not custom. STATE hourly.
**G387/G392 boards for wildshard-v:** Sky graphs/tiles boards from sp-o120 land here. G393 Roc clip check staffed when sp-x6 has a candidate. Plan l.157 still says near tier is behind a row.

**Calls for Jake (2026-10-13; reverse any):** calls 6–41 are listed in commit bodies and `open-x-queue.md`; highlights: Nine portable math, literal physics rows, G318 cache move (`pnpm gen` first), Template binary to a test fixture, declarations-only `shard.config.ts` not custom (36).

Paused: SF22, SF57, SF67.
