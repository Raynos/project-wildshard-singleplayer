# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 09:30Z. G345 sprint ENDED: target missed (Signal 44.6 %, Sky 51.0 %).** G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 09:30Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **44.6 %** | ≤ 824 lines | **80 / 0** ✔ |
| Sky Reach | 78.4 % → **51.0 %** | ≤ 1355 lines | **11 / 0** ✔ (`fd1b0a9a4`) |

**Signal and Sky meet Jake's port bar (tiles + 0 private bins).** **Nine ported** (34 L0 tiles, 0 private bins, Linux-exact). **Nalati 0 private bins** (`d3bdac368`); ground + nav one fetch (Nalati, Sky, Signal).
**LIVE `2f7cc5e25-mv6dko3t` (07:44Z)** with Sky island tiles. Frame floor `fea49ae28` (`31f7986cd`): 7 shards PASS alone; grid FAIL: **Sim Nine 1.8 s frame since the port (P0, sp-o109)**, Pine desktop PASS; Sim travel still fails Pine 57–63, Driftwood 42–50, Far 40–47 (Nalati 34–35); left = WebKit first-upload cost (KTX2 variant, sp-o110) + unsplit shard builds. `ad30fba68` CI + exact smoke GREEN: next release. **Whole products: Template, Pastel (Linux-exact).**

**Fleet (G384): 4 Opus + 6 Codex.** Codex: x7 pusher, x5 bench, x6 SF87, x4 Pine, x1 Driftwood, x8 Nine. Opus: o109 Nine P0, o110 Pine KTX2 variant,, o108 Signal author-only producers,, o106 m5 parity drift.

**For wildshard-v, Jake ask (G350 Nalati places):** bake runs 22k engine lines for 4.2 MB. **Port** to authored generators (big) or **freeze** bins + rows (cheap, not regenerable). Recommend port later; bridge stays.
**Jake ask (Sky movers):** Sky headless onto the generic mover driver deletes one-user code but re-records the gameplay hash. Recommend yes, after the sprint.

**For wildshard-v, Jake ask (S2):** Graph materials stay default-off pending a physical-iPhone reading, so the GLSL stays as fallback (no cut). Recommend accepting the Simulator + desktop reading. Near boards: `art/near-tier/round-6/`.

**Calls for Jake (2026-10-13; reverse any):**
6–22. Ground loader; Sky prop tiles; commons 0 packs; literal physics rows; Signal navmesh kept; query terrain; Pine cabin shapes; `props.wholeLibrary`; ≤ 1 m tile overhang; Nine portable math (≤ 9e-16); boat hull shared; Debug rows 7 → 4; bake host online; Driftwood/Nalati ground readers; Sky placements baked; Pine helper copies (closed `c757e98b8`).
23. Whole-product producers: author-only writer, frozen map bytes, comparison-only pins.
24. Driftwood stops its duplicate legacy terrain/nav/GLB prefetch.
25. Pine bridge yaw keeps a tiny runtime atan2 adapter (libm, ≤ 4.5e-16).
26. Data client drops runtime-bound tile transports it no longer needs (Driftwood +11 MB RAM).
27. Grid session start configures the engine to the shell's own level spec first (no eager home queries).
28. Shared SDK authoring RNG (Mulberry32) with an engine equality test.
29. G318: Template/Pastel's 332 CPU outputs (< 1.04 s each) move to cache; quickstart says `pnpm gen` first.

Paused: SF22, SF57, SF67.
