# Pine charged-host audit (X20, 2026-10-21)

The G520 charge list is a cut list, not an allowance. Shared imports and
fixtures do not supply a second shard. X5 owns Pine quest/install, quest
producers, forestStory and nativeStory; this cut changes none of those.

| Charged feature | Live owner and evidence | Verdict |
|---|---|---|
| WaterTransition (`format/water`, `game/systems/looks/waterSurface`) | Pine `world/beaverPool.ts` owns opening, saved-state settling, mesh bed depths and trickle reveal. No other shard lowers this surface. | Move the entire schema and per-frame projection into listed Pine view `world/poolSurface.ts`; delete the platform feature and its charge rows. Keep the shared ordinary surface. No geometry, look, data or collision change. |
| Stream, streamProjection, streamProfile, streamSurface, LiveStreamLevels (`format/populationEnvironment`) | Pine `world/terrain.ts` queries the creek using live `LAYOUT.beaverPoolLevel.y`; its producer `generators/populationEnvironment.ts` declares the same corridor for native queries. | Retain every charge. A static raster loses the pool's live level; moving synchronous terrain queries into a ten-Hz guest is not an equivalent interface. No real second corridor user this wave. |
| registerPackedGeometrySource, PackedGeometryImports (`engine/models/geometrySources`) | Pine `runtime/hybrid.ts` registers finish and trophy packs; the equipment branch in `game/models/explorerCatalogue.ts` prepares Pine's finish cards. Other scene decoders use the general registry, not this packed adapter. | Retain every charge. No second live packed-source consumer. Moving the bridge alone would leave platform Explorer dispatch depending on shard code. |
| PosedLibrary, ProductPosedLibrary (`game/looks/posedInstances`) | Pine `runtime/hybrid.ts` and SDK `looks/pageLife.ts` consume its named wildlife library. `sdk/looks/ambientFlock.ts` shares PosedDraw packing but not library admission, atlas lifetime or Explorer cards. | Retain every charge. Nalati's flock is no second user of this adapter. Moving just its loader would leave the shared SDK owner importing Pine or require an unapproved callback interface. |
| ProductExplorerDispatch (`game/models/explorerCatalogue`, `format/explorerCatalogue`) | Pine `generators/explorerCatalogue.ts` declares product posed, figure and equipment cards. Driftwood's native cards are prepared metadata; X5 has not switched its live bindings. | Retain every charge. No credit from prospective Driftwood adoption or its unrelated library dispatch. |
| Presentation (`game/models/explorerCatalogue`) | Pine and Driftwood `generators/explorerCatalogue.ts` both declare species cards, emitted by their output producers. The actual species branch calls present(), whose Presentation type preserves card metadata. | Remove this one-line stale charge only: two real users, no shard nouns, rows only, labelled client-only, retained without either first user, data-only API: 6/6. Product-specific dispatch stays charged. |

All retained adapters fail the real-second-user test and the deletion test
(4/6); their existing charges remain. No pending-user credit, budget change,
new host, callback, AS engine edit or speculative second user is added.
The legacy engine WaterBody exemption (G500 until N5) is unchanged.

Source count (parser code lines): Pine runtime +62; platform runtime -47;
net runtime +15. Removing the stale shared Presentation type charge earns
one additional custom line, but the pool move earns no free credit: all 62
new Pine view lines remain custom and component-classified. This is an
ownership correction, not a claim of a net custom-line reduction.

Validation: reversible/instant lowering, wet film and bed/depth admission
remain covered by test/water-surface-host.test.ts against the Pine view;
ordinary ocean/creek surfaces and page water ownership retain their tests.
The charge regression checks every moved line remains counted.
