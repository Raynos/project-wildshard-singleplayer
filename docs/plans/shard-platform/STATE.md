# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 (Sky + Signal, 90/10; G403/G404): components closed 0 of 9.** Custom lines Sky/Signal (W1-M0 `adb48b6a0`, clean HEAD): C1 700/405 · C2 809/278 (was 980/513) · C3 195/123 · C4 230/95 · C5 144/92 · C6 334/450 · C7 253/0 · C8 17/21 · C9 305/142. **Sky 43.4 %, Signal 42.8 %** (after `8eebbbf11`). W2 Driftwood/Nalati/Pine, W3 Nine.
**15:00Z. PORT % (G390, `351e3f8bc`): avg 44.7 %** (Template 100, Signal 74.9, Sky 69.7, Nine 48.3, Nalati 10, Pine 10, Driftwood 0). Finish line: 0 of 7 at 80/20.

**Nine ported** (34 L0 tiles, 0 private bins, Linux-exact). **Nalati 0 private bins** (`d3bdac368`); ground + nav one fetch (Nalati, Sky, Signal).
**G405 landed `95528caef`:** 6 cheap jobs / 15 files build in CI + deploy; switches ship straight to public.
**RELEASE HOLD until CI + the exact amended smoke pass (public-Nine smoke landed `8bfe85ab5`, call 44; sp-x7 unpins).** **LIVE `ad30fba68-mv6izhvz` (10:16Z, clean)**. Frame floor `fea49ae28` (`31f7986cd`): 7 shards PASS alone; grid FAIL: Sim Nine max fixed (`77bfbba70`: ~100 ms), Pine desktop PASS (`4b239382f`…`65e123136`); Sim travel still fails Pine 57–63, Driftwood 42–50, Far 40–47 (Nalati 34–35); left = texture uploads (KTX2 ask) + unsplit shard builds. **Whole products: Template, Pastel (Linux-exact), Signal (all Linux-exact).**

**Lanes (G406/G407: Opus 2, visual only; Codex 5 + pusher; no Fable):** C1 world + Sky grid x5 (parity tool `f02fe05e7`; Sky Sim travel p95 34–44 = build CPU) · C2 shared painted look DONE `8eebbbf11` (G406.3); Sky texture graphs wait on KTX2/meshMap (x4 next), then an Opus graph lane · C3 effect plumbing, C8 audio open (Codex) · C4 creatures x8 (after fan; AS `a9f12672e`) · C5 x6 (after W1-M0) · C6 x1 (lash `12199269a`) · C7 x4 · C9 rest open (x5 rows `11e6dec15`, `0522ccf58`) · x7 pusher. Binder `7b0ad15e2`.

**Decided:** G385 near B (shipped `45a8bd0e3`), G386 Pine KTX2, G387 graphs with boards, G388 Sky movers yes, G391 (supersedes G389): Nalati port NOW (sp-x5) and every legacy three.js builder/model/set becomes a generator, all shards.
**Explorer inventory (G391, `generator-inventory.md`):** ported/total Signal 8/10, Sky 0/27 (W1).
**G398 for wildshard-v:** grid Simulator **Nine road travel PASSES** (p95 34, max 84–106 ms; `b20a6716a`). Still failing in the Simulator: Pine (~50), Driftwood (42–50), Far (40–47) travel.

**For wildshard-v:** Ruling (call 36): declarations-only `shard.config.ts` is not custom. STATE hourly.
**G387/G392 boards for wildshard-v:** Sky graphs ON (`fdb140aec`) `art/sky-graphs/round-1/board-{bridges,shack,dressing,falls}.jpg`; Pine KTX2 shipped `art/pine-ktx2/round-2-shipped/`; G395 `art/effects-pairing/round-1/`; Signal storm accepted (G408). G393 Roc clip check staffed when sp-x6 has a candidate.

**Calls for Jake (2026-10-13; reverse any):** in commit bodies and `open-x-queue.md` (calls 6–49).

Paused: SF22, SF57, SF67.
