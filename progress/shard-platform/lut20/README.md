# op-lut20: the grid's learned colour LUT (E435, 2026-10-10)

SF19b's frame readout (`progress/shard-platform/sf19b/capture.json`) showed `chain.lut` false for Signal Dunes, Nalati and
Nine Dragon inside the grid. Why, shard by shard:

| shard | learned LUT standalone (SHARD SELECT) | in the grid before | verdict |
|---|---|---|---|
| Signal Dunes | none: `public/assets/lut/sunscar-dunes.bin` exists, but its look has kept it out of the grade since E409 round 17 (`duskLook`'s backdrop returns `lut: null`; the file stays a declared late read for a re-fit) | none | readout correct |
| Nalati | none: no learned LUT was ever fitted (its `fogLut` is a fog colour table, not a grade) | none | readout correct |
| Nine Dragon | yes: `grade-lut-cleanroom.bin`, applied inside its own Jiehua composite (`look/render.ts`, `uLutAmt` 1) | **dropped** | real bug |

Nine Dragon's drop: a grid cell carries the engine chain the level's look declares (SF63, `ExtendLook.chain`) and never
runs the look's `compose`, so the Jiehua composite, and the LUT inside it, never draw there. The frame owner only took a
LUT from a level's sky backdrop (`SkyBackdrop.lut`) or its `/assets/lut/<slug>.bin` file; Nine Dragon has neither.

**The fix** (shared frame-owner code, no one-shard system): an `extend` look may declare the learned LUT its compose
applies (`ExtendLook.lut`, a URL in `render/lut.ts`'s 33³ format), like it declares its chain; a grid cell
(`src/game/grid/regionalWorld.ts`) loads it through `loadCarriedLUT` (`src/engine/boot/bakedApi.ts`) where nothing else
gave one, and the frame owner swaps it into its compiled LUT effect by a uniform (no recompile), faded at the 16 m edge.
Nine Dragon declares its file. It changes how Nine Dragon looks in the grid, so it ships **default off** behind one Debug
row: pause > Settings > Debug > Look > **Grid cell learned LUT** (`gridDeclaredLut`, A as now / B the level's own
learned LUT, reload, reviewBy 2026-12-30). Off, nothing is fetched and the grid draws exactly as before.

**Captures** (`capture.mjs`, a DEVSERVER build of the candidate `fd8039b9f`, Developer on, phone tier 2x, Memory saver
on, muted iPhone 16 Pro portrait): each shard home in the grid with the row off (A) and on (B), and standalone. Nine
Dragon's city stands at +125 m, out of sight from the road edge, so its grid shots are posed at its own spawn frame (the
pose SHARD SELECT boots at). Readouts in `capture.json`:

- Signal Dunes, Nalati: `chain.lut` false in A and B, no LUT standalone. Their A / B pixel differences are two page loads'
  live sky, dusk and wind, not a change.
- Nine Dragon: `chain.lut` false in A, **true in B** (weight 1); standalone its composite's LUT amount is 1.
  `nine-dragon-stack-grid-A-same.jpg` is A shot in B's own page with the carried LUT held at 0, so the A / B pair differs
  only by the LUT (mean change 1.9 / 1.6 / 1.7 of 255: a slight cool, darker-red shift).

`nine-dragon-ab-board.jpg` is Jake's A / B board (A = the old look); `board.jpg` is the three-shard evidence sheet.

**Still open, not this row:** the grid's Nine Dragon is far from SHARD SELECT's whatever the LUT (no ink silhouette,
bleed, wet-floor reflections or rain composite: the whole Jiehua composite is a `compose` the grid never runs), and
Signal Dunes' grid frame carries the cinematic chain (volumetric haze, grain, fringe: SF19b's `fx`) although standalone its
dusk look asks the clean chain, because `duskLook` declares no `chain: 'clean'` (`lookChainKind` defaults to cinematic).
