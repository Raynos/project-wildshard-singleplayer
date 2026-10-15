# World-map refresh, batch 2

Pine and Signal were captured from stock served `b02ecca67` in one muted browser batch. Driftwood was recaptured from `98753efbc` after the cove graph conversion landed. Build ids were verified before and after both batches. All browsers and previews closed before stamp publication.

The official map stylizer processed the colour and height passes. `writeMapStamp` verified the rasters and bound their stamps to the clean generated tree at `98753efbc`. Pine and Signal map inputs remain unchanged from the first capture.

| Shard | Raster bytes | World key |
| --- | ---: | --- |
| driftwood-isle | 98,944 | `ff6ca3a077d551238013f7ff665a83037859533c0478065acbae8030b127d5b3` |
| pine-hollow | 94,714 | `2f88c3ab9739b64a5b31ba8ea30192cb790d19fd3a1255f61fb828f84b72efbd` |
| sunscar-dunes | 27,316 | `7037f880b046488b0f4df8662fb026f6c8b8f3538c1246b8febedad339445a60` |

Signal’s real producer regenerated root `afe9c5205f9213c75143cf153b17a13846436e7ecdbe07db73f06c4ad2a5248f` and map asset `f0630bbd3bb09a8ebede765b5270c231bb22154be2c5c3c716841623f32278b8` together. The other 86 immutable asset hashes are unchanged. Its authored map companion and catalogue pins move atomically with the official image.

[Labelled Driftwood before/after](driftwood-map-refresh-board.jpg). Coastline, paths, piers and vegetation remain intact.
