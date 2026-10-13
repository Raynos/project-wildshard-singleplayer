# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 (Sky + Signal, 90/10; G403/G404): components closed 1 of 9 (C4).** Custom lines Sky/Signal (clean generated `a345b6d6b`, 22:51Z): C1 666/362 · C2 565/275 · C3 224/115 · C4 0/0 · C5 128/68 · C6 137/257 · C7 212/0 · C8 16/21 · C9 306/114. **Sky 33.3 %, Signal 29.4 %** (22:00Z forecast ~33/32 met).
**22:51Z. PORT % (G390, `351e3f8bc`): avg 44.7 %** (Template 100, Signal 74.9, Sky 69.7, Nine 48.3, Nalati 10, Pine 10, Driftwood 0).

**Waves (G413):** W1 Sky + Signal (now) → W2 Pine + Driftwood (after W1 at 90/10) → W3 Nalati + Nine (after W2 at 80/20); M2 3×3 grid closes with W3.
**G405 landed `95528caef`:** 6 cheap jobs / 15 files build in CI + deploy; switches ship straight to public.
**FPS margin: Sky road travel p95 34–41 on one SHA (bisect `e36a5b7cf`: no regressing commit; GPU-process warm-up at entry).** **LIVE `a399c36f3-mv750iu1` (20:32Z; full CI + exact four-leg smoke green; newest CI-green selector advancing on its own).** Frame floor `fea49ae28` (`31f7986cd`): 7 shards PASS alone; grid FAIL: Sim Nine max fixed (`77bfbba70`: ~100 ms), Pine desktop PASS (`4b239382f`…`65e123136`); Sim travel still fails Pine 57–63, Driftwood 42–50, Far 40–47 (Nalati 34–35); left = texture uploads (KTX2 ask) + unsplit shard builds. **Whole products: Template, Pastel (Linux-exact), Signal (all Linux-exact).**

**Momentum (23:20Z, G414):** frame gate = no worse than today; Sim travel floor at the W1 milestone. Every lane has a 3-deep queue: x4 Sky library NOW → C9 Sky → C9 Signal/C8; x6 exact-value tests → bounds (rule 6) → C3 Sky → C5; x1 C6 Signal → fan GeometryPack → C6 Sky; x5 harness → bridge → C1; x8 C7 connectors → islets → C9 index; x7 push hold shortened/batched. Opus: o142 warm-up margin; next o = Sky C2 texture graphs (~600) after the library.

**Decided:** G385–G408 in `decisions.md` (G407: 2 Opus visual-only, Codex 5 + pusher, no Fable).
**Explorer inventory (G391, `generator-inventory.md`):** ported/total Signal 8/10, Sky 0/27 (W1).
**G398:** Sim Nine road travel PASSES (`b20a6716a`); Sky travel 34–44 (build CPU; C1/C5 fixes landing).

**For wildshard-v:** G411/G412 consumed: sp-x4 raises Sky's library to 8.81 MB (cached, hash-named; warm reload 0 bytes; Sky Sim road floor), then Opus authors the ~600 C2 graph lines; raises listed in the download-diet queue row.
**Boards for wildshard-v:** `art/sky-graphs/round-1/`, `art/pine-ktx2/round-2-shipped/`, `art/effects-pairing/round-1/`, `art/signal-graphs/round-2/board-last-light.jpg` (0 px), painted look `8eebbbf11` (0 px, no board).

**Calls for Jake (2026-10-13; reverse any):** in commit bodies and `open-x-queue.md` (calls 6–49).

Paused: SF22, SF57, SF67.
