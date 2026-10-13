# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**M3 waves (G403/G404): W1 = Sky + Signal, 90/10 each; W2 Driftwood/Nalati/Pine; W3 Nine.** W1: components closed **0 of 9**; per-component lines pending W1-M0 (sp-x6). **Sky 47.6 %, Signal 45.1 %** (clean HEAD).
**2026-10-13 13:00Z. PORT % (G390, `351e3f8bc`): avg 44.7 %** (Template 100, Signal 74.9, Sky 69.7, Nine 48.3, Nalati 10, Pine 10, Driftwood 0). Finish line: 0 of 7 at 80/20.

**Nine ported** (34 L0 tiles, 0 private bins, Linux-exact). **Nalati 0 private bins** (`d3bdac368`); ground + nav one fetch (Nalati, Sky, Signal).
**G405:** cheap derived outputs leave git (sp-x7 P0; 45/60 deploys red); switches ship straight to public.
**RELEASE HOLD until CI + public-Nine smoke pass on ≥ `77bfbba70` (Pine Linux fixed `84eb0f68f`; last CI reds: Signal chunk sp-x6, two Nine fixtures sp-x8).** **LIVE `ad30fba68-mv6izhvz` (10:16Z, clean)**. Frame floor `fea49ae28` (`31f7986cd`): 7 shards PASS alone; grid FAIL: Sim Nine max fixed (`77bfbba70`: ~100 ms), Pine desktop PASS (`4b239382f`…`65e123136`); Sim travel still fails Pine 57–63, Driftwood 42–50, Far 40–47 (Nalati 34–35); left = texture uploads (KTX2 ask) + unsplit shard builds. **Whole products: Template, Pastel (Linux-exact), Signal (all Linux-exact).**

**Lanes by component (G406, all 9 at once, both shards):** C1 world + Sky grid-ready o123 · C2 looks + shared painted look o124 · C3 effects o125 (after map P0 + G402) · C4 creatures x8 (after fan) · C5 NPCs/quests x6 (after W1-M0) · C6 combat x1 · C7 movers x4 · C8 audio o126 · C9 boot glue x5 · x7 pusher.

**Decided:** G385 near B (shipped `45a8bd0e3`), G386 Pine KTX2, G387 graphs with boards, G388 Sky movers yes, G391 (supersedes G389): Nalati port NOW (sp-x5) and every legacy three.js builder/model/set becomes a generator, all shards.
**Explorer inventory (G391, `generator-inventory.md`):** ported/total Signal 8/10, Sky 0/27 (W1).
**G398 for wildshard-v:** grid Simulator **Nine road travel PASSES** (p95 34, max 84–106 ms; `b20a6716a`). Still failing in the Simulator: Pine (~50), Driftwood (42–50), Far (40–47) travel.

**For wildshard-v:** G392 Sky steps 1/2/8/7 sp-x6 (after inventory + G390), 3–4 sp-o120. Ruling (call 36): declarations-only `shard.config.ts` is not custom. STATE hourly.
**G387/G392 boards for wildshard-v:** Sky graphs ON (`fdb140aec`) `art/sky-graphs/round-1/board-{bridges,shack,dressing,falls}.jpg`; Pine KTX2 shipped `art/pine-ktx2/round-2-shipped/`; G395 `art/effects-pairing/round-1/`; Signal storm graphs `art/signal-graphs/round-1/board-storm.jpg` (`029fcb0ab`). G393 Roc clip check staffed when sp-x6 has a candidate. Plan l.157 still says near tier is behind a row.

**Calls for Jake (2026-10-13; reverse any):** calls 6–41 are listed in commit bodies and `open-x-queue.md`; highlights: Nine portable math, literal physics rows, G318 cache move (`pnpm gen` first), Template binary to a test fixture, declarations-only `shard.config.ts` not custom (36).

Paused: SF22, SF57, SF67.
