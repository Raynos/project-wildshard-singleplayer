# op-frame21: a shard's own post composite inside the grid (SF63 / G158, E435, 2026-10-10)

**Survey.** A grid cell carries a region's declared engine chain (`ExtendLook.chain`, SF63) and grade (G232); it never
runs a look's `compose`. What each shard's standalone compose adds that the grid dropped:

| shard | standalone compose | in the grid before |
|---|---|---|
| Nine Dragon | `beforeChain` reflect / haze / bleed passes (not on the phone) and `chain: [Jiehua]`: ink silhouette, bleed, drizzle, shoulder, its learned LUT, grain; the composite is the whole colour chain | the cinematic engine chain (it declared no chain) |
| Sky Reach | the clean chain with its tone mapping set to NEUTRAL (E399) | AgX, and the **cinematic** chain: its look composed `engineChain('clean')` but never declared it (the SF63 Signal Dunes bug again) |
| Nalati | `replace`: its display transform is already carried (`engineKnobs.display`) | carried |
| Driftwood, Pine, Signal Dunes | the clean chain / nothing / the clean chain | carried |

**The generic path.** `ExtendLook.cell` (`src/engine/render/look.ts`) declares a look's grid-cell composite: a `build`
that returns its `display` effect and the side `passes` it reads, and whether it `replaces` the whole chain or only the
tone mapping. The region (`src/game/grid/regionalWorld.ts`) builds it once its world exists (`beforeWarm`) and hands it to
the frame owner (`FrameLookPort.composite`, `src/game/grid/frame.ts`), which places the display after the shell's tone
mapping (the existing 'replace' display slot) and the passes before the colour pass. The cell's owner weight fades the
display in and the tone mapping out across the 16 m edge band, and the passes run only while the cell carries the frame.
A `'chain'` composite carries a neutral engine chain beside it (`wholeChainKnobs`: no engine grade, LUT, bloom, vignette,
rays or shafts). Two shards declare one: Nine Dragon (the Jiehua composite, built by the same function its compose uses)
and Sky Reach (NEUTRAL tone mapping). Sky Reach now also declares `chain: 'clean'`, landed ungated like Signal Dunes'.

**Row.** pause > Settings > Debug > Look > **Grid cell own composite** (`gridCellComposite`, A as now / B the level's own
composite, reload, reviewBy 2026-12-30), default off. Off, nothing is built.

**Captures** (`capture.mjs`, DEVSERVER build of the candidate, Developer on, phone tier 2x, Memory saver on, muted
iPhone 16 Pro portrait; readouts in `capture.json`). Nine Dragon B: `NdJiehuaEffect` at opacity 1 right after the tone
mapping (at 0), the engine chain neutral (bloom 0, vignette 0, shafts and grain 0). `nine-dragon-stack-ab-board.jpg` is
Jake's board (A = the grid as now, B = its own composite, SHARD SELECT for reference).

**Open.** (1) Sky Reach's B shot showed its loading card still up after the cell reported ready, in both capture runs;
its readout has the NEUTRAL display placed and carried. Not shown to Jake until that's explained. (2) Grid Nine B still
lacks SHARD SELECT's wet-floor streak reflections on the phone, the crowd and the brighter neon. (3) Floors with the row
on were not measured on Nine: `frame-floor.mjs`'s grid export has no Developer Nine cell, so the row stays off.
