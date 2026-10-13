# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 (Sky + Signal, 90/10; G403/G404): components closed 0 of 9.** Custom lines Sky/Signal (clean generated `730e6e69c`): C1 672/407 · C2 764/278 · C3 235/282 (M0 refinement moved effect shaders C2→C3) · C4 227/94 · C5 142/97 · C6 248/369 · C7 279/0 · C8 16/21 · C9 289/121. **Sky 42.4 %, Signal 40.5 %.** W2 Driftwood/Nalati/Pine, W3 Nine.
**16:00Z. PORT % (G390, `351e3f8bc`): avg 44.7 %** (Template 100, Signal 74.9, Sky 69.7, Nine 48.3, Nalati 10, Pine 10, Driftwood 0). Finish line: 0 of 7 at 80/20.

**Nine ported** (34 L0 tiles, 0 private bins). **Nalati 0 private bins** (`d3bdac368`).
**G405 landed `95528caef`:** 6 cheap jobs / 15 files build in CI + deploy; switches ship straight to public.
**RELEASE HOLD until CI + the exact amended smoke pass (public-Nine smoke landed `8bfe85ab5`, call 44; sp-x7 unpins).** **LIVE `ad30fba68-mv6izhvz` (10:16Z, clean)**. Frame floor `fea49ae28` (`31f7986cd`): 7 shards PASS alone; grid FAIL: Sim Nine max fixed (`77bfbba70`: ~100 ms), Pine desktop PASS (`4b239382f`…`65e123136`); Sim travel still fails Pine 57–63, Driftwood 42–50, Far 40–47 (Nalati 34–35); left = texture uploads (KTX2 ask) + unsplit shard builds. **Whole products: Template, Pastel (Linux-exact), Signal (all Linux-exact).**

**Lanes (G406/G407: Opus 2, visual only; Codex 5 + pusher; no Fable):** C1 world + Sky grid x5 (Sky 21 hero models baked `a4f0bcf9c`, 0 px; Sim travel 34/51 at load 11–15; pacing next) · C2 shared painted look DONE `8eebbbf11` (G406.3); meshMap `8b6408d54` → Sky model-map graphs o131; TEX maps wait on Jake (fork below) · C3 effect plumbing, C8 audio open (Codex) · C4 creatures x8 (Roc baseline `123e392f4`; G393 clip review on candidate) · C5 x6 (after W1-M0) · C6 x1 (shared native melee host + fan + AS `0d915f548`) · C7 x4 · C9 x4 · x7 pusher. Binder `7b0ad15e2`.

**Decided:** G385–G408 in `decisions.md` (G407: 2 Opus visual-only, Codex 5 + pusher, no Fable).
**Explorer inventory (G391, `generator-inventory.md`):** ported/total Signal 8/10, Sky 0/27 (W1).
**G398:** Sim Nine road travel PASSES (`b20a6716a`); Sky travel 34–44 (build CPU; C1/C5 fixes landing).

**For wildshard-v (fork for Jake):** Sky's 9 tiling look textures (needed for ~600 C2 graph lines) cost ~43 MB under the library's conservative full-RGBA charge vs the 25 MB provisional library cap (`contentBounds.ts`); today they already load as uncompressed bitmaps outside the library. Recommend: charge KTX2 library maps at their transcoded size where the GPU reports ASTC/BC, RGBA only as fallback: no look change, real memory falls. Alt: phone drops the top mip (visual pick).
**Boards for wildshard-v:** `art/sky-graphs/round-1/`, `art/pine-ktx2/round-2-shipped/`, `art/effects-pairing/round-1/`, `art/signal-graphs/round-2/board-last-light.jpg` (0 px), painted look `8eebbbf11` (0 px, no board).

**Calls for Jake (2026-10-13; reverse any):** in commit bodies and `open-x-queue.md` (calls 6–49).

Paused: SF22, SF57, SF67.
