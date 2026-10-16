# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**Order:** W2 closes 05:00Z 10-17 (G463: leftovers → W3 closure rows) → W1 spike → W3.

**G465 (Jake, overrides G461 (c)/G464 on grid-ready):** the only goal is fewer custom shard lines, through data, engine hosts that pass G454, and AssemblyScript. Grid-ready and fps work stopped. Code whose end state is data, a host or a script goes straight there, never via runtime/; only lasting view code moves in. Const mirrors add runtime lines (pre-admission use only). **G464:** DW closes first; the ruler prints each shard's output % the moment it closes. Script lanes run Pine/Template/17-headless fixtures before every commit.

**Plan % (G458), ruler `2f80e66b4`: 10.3–43.6 %.** M3 is 17.1 % and slipped 0.9 pt in 6 h. Escapes: DW 37, Pine 155, Signal 6; Sky sim-in-runtime 0 (`e54ca1cb1`). KR1 net lines (report-only): W2 −11,974, W1 −26,125, so platform growth outpaces shard cuts.

**Lanes. Targets are ESTIMATED custom lines removed by 05:00Z; the hourly report tracks actuals:**

| Lane | Work | Target |
|---|---|---|
| o293 | DW code-built models → build-time GLB/data, TS deleted | DW −800 |
| o294 | Pine code looks/builders → graph JSON/GLB/data | Pine −800 |
| x5 | DW sim behaviours (director/ecology/quest/placement) → host rows / AS, TS deleted | DW −300 |
| x4 | DW world-build data → sections/blobs, systems onto hosts | DW −200 |
| x7 | DW leaves → sections; per-shard output %; lines-removed line; bloom row delete | DW −100 |
| x6 | Pine client data → named JSON blobs/sections, mirrors replaced | Pine −200 |
| x8 | KS1 roc.as + rows, ROC_BRAIN/raptor deleted | Sky −250 |
| x1 | schema push-red fix, then Sky gust on world/targets, Sky world onto hosts/data | Sky −150 |

**Landed since G465 (measured net shard lines, 18:15Z):** DW ≈ −254 (x4 −71/−18, x7 −10/−39/−20/−21, x5 −44/−10/−11, o293 −10); Pine ≈ −305 (o294 −156, o295 −36+, x6 −4/−18/−59/−10/−9/−13); Sky −14 (x1 gust), Roc join pending (x8: −21 before dead-code removal, +31 build step to pay back). Ruler at `4cbcad71d` showed M3 16.0 %, which predates most of these.

**For wildshard-v (pick for Jake):** Pine generators/logCabin.ts (1,335 lines, biggest Pine file). A) freeze the bake: commit per-building geometry blobs (~5–9 MB binary, near the 10 MB push cap), a ~60-line reader, delete the generator (net ≈ −1,300 shard lines; later edits happen in Blender on the GLB; the source survives in git history). B) full Blender port (3–5 h, moves ~1,100 lines to scripts/blender, small KR1 gain). Rec: A. Notes in tmp/sp-o296/NOTES.txt.
**For wildshard-v:** Signal's +411 at `d125557a1` is a ruler gap, not new code. Sky's e54ca1cb1 now selects the native plan through the emitted sim/runtime-plan section, and the ruler has no host row for that section, so simulation/homeKeeper/brain/bossRow got charged to Signal alone. x7 is adding the attribution row.
Paused: SF22 SF57 SF67.
