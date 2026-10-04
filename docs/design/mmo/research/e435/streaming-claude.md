# Seamless travel, the far view and the crossroads: a clean-room design study (E435)

Clean-room, read-only. Web facts carry a URL. Repo facts carry a path. My own arithmetic says "computed".
Anything I could not source is marked **[unverified]**. Date: 2026-10-03.

**The verdict in one paragraph.** The crossroads is affordable only if the **tile** is the unit of streaming and
budget, not the shard. With fixed-size tiles, the number of tiles inside any radius is the same at a crossroads as in
the middle of a shard (computed, §2.2). What a corner multiplies is each shard's **fixed cost**: its material library,
shader programs, look, plugin and audio. So the design comes down to four rules. (1) Every shard is baked into a quadtree
of 62.5 m / 125 m tiles with platform-made LODs. (2) Only the nearest LOD may use the shard's shared material library;
every coarser LOD is self-contained, with baked textures. (3) The shader library is fixed and owned by the engine, so
four looks share programs. (4) A per-shard fixed-cost cap is set at about 25 MB resident. **Memory binds, not
bandwidth.** Today's stylized shards ship 0.5–6 MB phone packs (`src/game/boot/packs.generated.ts`) but use 153–587 MB
of GPU memory on the phone (`src/shards/*/budgetCeilings.ts`). Four of today's shards at a corner would need 0.6–2.3 GB
before the engine itself. The highway should be its own server room, a strip that no shard owns. Shards are seen across
borders by read-only interest subscriptions, never by ghost copies. The far view across the whole 5 × 5 grid is a
preloaded set of baked low-poly proxies, about 25–50 MB in total. It is not billboards: a 500 m shard is still 240 px
wide at 2.5 km on this phone (computed, §2.4).

---

## 1. Prior art (compact, cited)

| System | Tiling | LOD / HLOD | Mobile view distance | Memory / bandwidth | Server handoff | Known failure modes | Lesson for Wildshard |
|---|---|---|---|---|---|---|---|
| **World of Warcraft** | Continents are 64 × 64 **ADT tiles of 533.33 yd (≈ 488 m)**, each split into 16 × 16 chunks of 33.3 yd. Since Cataclysm one ADT is several files: root, textures, objects and a separate LOD file ([warcraft-rs ADT](https://warcraft-rs.readthedocs.io/en/latest/formats/world-data/adt.html)) | A whole-continent low-res heightmap (**WDL**) draws the distant terrain ([WDL](https://warcraft-rs.readthedocs.io/en/latest/formats/world-data/wdl.html)) | n/a (PC) | Streams tiles in the background ([warcraft-rs](https://warcraft-rs.readthedocs.io/en/latest/formats/world-data)) | **Sharding / CRZ / layering**: a zone runs as several copies, and players are moved between copies "seamlessly". Players in different shards or phases **cannot see each other** ([Sharding](https://warcraft.wiki.gg/wiki/Sharding_(term)), [Layering](https://warcraft.wiki.gg/wiki/Layering)) | NPCs vanish when you are moved to another shard. Party members end up in different layers (same sources) | A WoW tile is almost exactly a Wildshard shard (488 m vs 500 m), and **one tile = several files split by LOD** is the right shape. One cheap whole-world far layer (WDL) is the right shape for the horizon. Avoid instancing a shard into copies: it breaks "seen across the border" |
| **Guild Wars 2** | Zones bounded by impassable terrain and invisible walls; exits are **portals with loading screens** ([GW2 wiki: Zone](https://wiki.guildwars2.com/wiki/Zone)) | n/a | n/a | n/a | The **Megaserver** spins up a new instance of a map when it fills ([Megaserver](https://wiki.guildwars2.com/wiki/Megaserver)) | Why not seamless: with many instances per map, a seamless border would have to pick which instance of the next map you land in, so friends vanish. **[unverified as ArenaNet's stated reason]**: a community argument only ([forum thread](https://en-forum.guildwars2.com/topic/97481-suggestion-real-open-world)) | **Map instancing and seamless borders conflict.** If a shard room ever gets a second instance, the border has to choose one. Decide now that one shard is one room (capacity is solved another way), or accept a visible handoff |
| **Star Citizen** | Object containers form a static hierarchy. A **streaming bubble** forms around each player, and a ship plus its children stream as one **streaming group** ([Q&A](https://api.star-citizen.wiki/comm-links/18397), [OCS](https://starcitizen.tools//OCS)) | n/a | n/a | Server-side OCS serialises frozen entities to a database when nobody is near (same) | **Static server meshing** (4.0, Dec 2024): one server per area. A **replication layer** plus **EntityGraph** sends entity state to clients and servers in parallel, and authority can be transferred (same) | Replication-layer crash: everyone freezes, reconnect in about 60 s. In the 4.0 preview "everything broke", and crowds made the mesh collapse ([MassivelyOP 2026](https://massivelyop.com/2026/02/06/star-citizen-cto-outlines-progress-on-server-meshing/), [RSI forum](https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/4-0-was-a-reminder-of-just-how-far-we-are-from-an-)) | Hand over a vehicle **together with its passengers** as one group. Put one gateway / replication process between the client and the rooms, but keep it simple: it becomes the single point of failure |
| **MS Flight Simulator** | **Quadtree** over Mercator. Tiles are requested by **screen size and the bandwidth available**, and a tile **borrows its parent's data** (for example the aerial texture) until its own arrives ([Asobo terrain talk PDF](https://WWW.ASOBOSTUDIO.COM/files/inline-images/Designing_Terrain_System_Fuentes_Lionel.pdf), via search summary; the PDF itself was too big to fetch) | Photogrammetry for about 400 cities; Blackshark built 1.5 B buildings from 2D imagery ([TechCrunch](https://techcrunch.com/2020/08/17/meet-the-startup-that-helped-microsoft-build-the-world-of-flight-simulator)) | n/a (PC / Xbox) | MSFS 2024 uses **10–15 GB/h without a cache (≈ 22–33 Mbit/s)**, under 3 GB/h with the rolling cache ([FlyAway](https://flyawaysimulation.com/ask/answers/internet-data-usage-reduce-bandwidth-msfs-2024/)); a peak of **180 Mbit/s** was reported ([Tom's Hardware](https://tomshardware.com/video-games/pc-gaming/microsoft-flight-simulator-2024-sucks-up-to-180-mb-s-of-internet-bandwidth-while-in-flight-equivalent-to-81gb-of-data-per-hour)) | n/a | Blurry ground and pop-in when the link can't keep up (same sources) | **Parent-first refinement**: never draw a hole, draw the parent. A persistent cache turns the second trip into zero bytes |
| **Cesium / OGC 3D Tiles (+ glTF)** | A spatial tree (implicit **quadtree / octree** in 1.1) with **glTF** content and metadata; an OGC Community Standard ([OGC 3D Tiles 1.1](https://portal.ogc.org/files/100660)) | Each tile has a **geometric error** in metres, turned into a screen-space error in pixels. Refinement is REPLACE or ADD. CesiumJS `maximumScreenSpaceError` defaults to **16 px**, with `cacheBytes` and `maximumCacheOverflowBytes` ([Cesium3DTileset](https://cesium.com/learn/ion-sdk/ref-doc/Cesium3DTileset.html)) | Set by SSE | three.js `3DTilesRendererJS` evicts GPU memory under an LRU `maxBytesSize` (default **≈ 430 MB**). Its **JS-side tile tree grows without bound** in long sessions ([repo](https://github.com/NASA-AMMOS/3DTilesRendererJS), [discourse](https://discourse.threejs.org/t/3d-tiles-renderer-memory-problem/90078)) | n/a | Unbounded JS tree growth (above) | The best existing **format model** for HLOD in the browser: geometric error per tile, REPLACE refinement, glTF content. Borrow the semantics. The whole library isn't needed: 4 levels over a fixed grid is simpler than a general tree |
| **Google Earth / Photorealistic 3D Tiles** | Quadtree tiles at increasing resolution (Google patents, [e.g.](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9105129)). Google serves its photoreal mesh **as OGC 3D Tiles**, billed per root-tileset request ([Map Tiles API billing](https://developers.google.com/maps/documentation/tile/usage-and-billing)) | HLOD | n/a | n/a | n/a | n/a | The 3D Tiles model scales to the planet in a browser. Format risk is low |
| **Minecraft** | 16 × 16 chunks. Java: render distance 2–32 chunks (server default 10). **Simulation distance is a separate setting**, 3–32 chunks ([xgamingserver](https://xgamingserver.com/docs/minecraft/change-view-distance), [craftdex](https://craftdex.net/fr/mechanics/simulation-distance)) | No geometry LOD; fog | Bedrock: 6–96 chunks depending on **memory at start-up**; iPhone 11 max 36 chunks (576 m), iPhone 7 max 18 ([Bedrock wiki](https://minecraftbedrock.fandom.com/wiki/Render_Distance)) | n/a | One server | Mobile builds quietly lower simulation distance (same) | **Split view distance from simulation distance**, and choose the range by device memory at start-up |
| **Roblox StreamingEnabled** | Radius around "replication foci": **StreamingMinRadius 64 studs** (≈ 18 m; never streamed out), **StreamingTargetRadius 1024 studs** (≈ 287 m). StreamOut is `LowMemory` (default) or `Opportunistic`. Models stream Atomic, Persistent or nonatomic ([docs](https://create.roblox.com/docs/workspace/streaming)). 1 stud ≈ 0.28 m **[unverified conversion, commonly cited]** | **SLIM** (Dec 2025): cloud-built merged impostor LODs per model. Example scene: draws 2,402 → 1,454, triangles 20 M → 3.35 M ([Roblox newsroom](https://about.roblox.com/newsroom/2025/12/introducing-roblox-slim-scalable-lightweight-interactive-models)) | Predictive streaming is **skipped on constrained clients** (docs) | Out of memory → error 292 "low memory" warning, then a crash ([support](https://en.help.roblox.com/hc/en-us/articles/203313540-iOS-App-Memory-Error)) | One server per place | Mobile OOM crashes are the top complaint ([devforum](https://devforum.roblox.com/t/game-crashing-mobile-players/2769839)) | The closest analogue: untrusted UGC on phones. The **platform** builds the far LOD (SLIM) from the creator's content, and the creator doesn't make it. That is W8's "made by the platform" |
| **Unreal World Partition + HLOD** | A runtime grid. Default MainGrid **cell 128 m, loading range 256 m** ([uhiyama-lab summary](https://uhiyama-lab.com/en/notes/ue/level-streaming-optimization/); **[verify in engine]**) | HLOD layers: **Instancing / Merged / Simplified / Approximated**, each with its own cell size and loading range, nested through parent layers ([Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition---hierarchical-level-of-detail-in-unreal-engine)) | UEFN: an island must stay under **100,000 memory units at every location**, computed with streaming on ([UEFN memory](https://dev.epicgames.com/documentation/fortnite/memory-management-in-unreal-editor-for-fortnite)) | Streaming without HLOD: things vanish at a distance, lowest memory. With HLOD: moderate memory ([UEFN streaming](https://dev.epicgames.com/documentation/en-us/uefn/streaming-and-hlods-in-unreal-editor-for-fortnite)) | n/a | HLOD built from full-res meshes is very costly. Merging adds geometry in concave corners, and world-position materials make artefacts in merged meshes (Epic docs) | **UEFN is the template for W7c**: a per-location memory cap that the publish step enforces before anyone plays. An "Approximated" HLOD (baked material) is what L1/L2 should be |
| **Unity** | Addressables + subscenes. Meta's sample does **quadtree LOD streaming over grid subscenes, 3 LOD levels** ([Meta sample](https://developers.meta.com/horizon/documentation/unity/unity-sample-asset-streaming)). Megacity Metro: 100+ players with mobile URP ([80.lv](https://80.lv/articles/unity-launches-megacity-metro-a-new-multiplayer-game-sample/?amp=1)) | Same | n/a | n/a | Netcode for Entities | n/a | Nothing new: the same grid + quadtree HLOD pattern |
| **No Man's Sky** | Continuous voxel generation from space to the ground ([GDC 2017, McKendrick](https://www.gdcvault.com/play/1024265/Continuous-World-Generation-in-No)) | Polygonised voxel LODs **[details unverified, talk behind paywall]** | n/a | Generates instead of downloading | Peer sessions | Terrain pop-in and LOD swimming **[unverified]** | Not applicable: untrusted shards can't run their generators on the client (VISION.md: "generator code runs on the author's machine; only data and assets ship") |
| **Dual Universe** | **CSSC**: one continuous world split dynamically into **cube shards** by player density ([mmos.com](https://mmos.com/news/novaquark-explains-how-dual-universes-server-works), [Wikipedia](https://en.wikipedia.org/wiki/Dual_Universe)) | Voxel LOD | n/a | Update rate falls with distance: **smooth within 100 m, players "blink" beyond 700 m** (mmos.com) | Server cubes split and merge | Blinking at range (same) | **Replication rate by distance band** is enough. The neighbour shard's creatures can update at 2–5 Hz |
| **Second Life** | **256 m regions**, one simulator each. The viewer holds **child agents in up to 8 neighbours**, so it sees adjacent regions only ([SL wiki](https://wiki.secondlife.com/wiki/Adding_neighbor_region_sequence), [modemworld](https://modemworld.me/2015/05/08/sl-project-updates-week-19-server-group-chat-child-agents/)) | None by default; draw distance is "a few hundred metres at best". Sharpview adds **region impostors** beyond the ~120 m four-region range, about 80 meshes for all of mainland ([Sharpview impostors](https://animats.com/sharpview/technotes/impostor.html)) | n/a | n/a | Crossing = teleport into the next sim, then re-seat the riders | **Five crossing bugs**: passengers lost (a 40–150 ms window), a freeze of **0.5–10 s** with wild extrapolation, animations stopping, camera jumps, and **"potholes"** where nothing supports you past the edge. Worst within 3–4 m of a **four-sim corner**; tested at 20 m/s ([Nagle, lslutils](https://github.com/John-Nagle/lslutils/blob/master/regioncrossing.md)) | **The cautionary tale for W7e.** (a) Pre-establish the neighbour subscription long before the border (SL's child agents). (b) Hand over vehicle + riders atomically. (c) Never let physics depend on the next room's data: the highway deck must be solid locally. (d) The 4-way corner is the worst case, as W7a says |
| **BigWorld** (MMO server tech) | Space split into BSP cells across CellApps. Entities near a border have **ghost** copies in the neighbouring cell; the real entity is authoritative ([KBEngine glossary](https://documentation.help/KBEngine-API/keywords.html), [juejin](https://juejin.cn/post/7429306052069326848)) | n/a | n/a | n/a | Real/ghost plus mailboxes | Ghost churn when cells rebalance **[unverified]** | Ghosts are needed only when entities **interact** across a border. If creatures are leashed and the highway is a safe zone, read-only client subscriptions are enough |
| **Hytale** | 32 × 32-block chunks. Default **MaxViewRadius 32 chunks ≈ 1,024 blocks**; the server manual recommends **12 (384 blocks)** ([Bloom docs](https://docs.bloom.host/games/hytale/performance), [Nodecraft](https://nodecraft.com/support/games/hytale/setup/how-to-change-the-view-distance-for-your-hytale-server.md)) | n/a | n/a | Server cost grows with radius² (same) | n/a | n/a | Radius² cost again: keep the near ring small and push everything else into proxies |
| **Fortnite mobile** | World Partition (UEFN docs above) | HLOD from each asset's lowest LOD | **[unverified]**: no public mobile distances | UEFN memory units (above) | n/a | Console players can be ejected for running out of memory (UEFN memory doc) | A memory cap that the publish step enforces |
| **Genshin Impact (phones)** | No public streaming talk. The GDC 2021 talk covered style and rendering, not streaming ([GDC news](https://www.gdconf.com/news/learn-about-making-genshin-impacts-open-world-gdc-2021)); the Unity Dojo talk covered console rendering only ([docswell](https://docswell.com/s/UnityJapan/KWRPQ5-210617-unity-dojo20211mihoyozhenzhongyi)) | **[unverified]** | **[unverified]** | Install 25 GB+ (v3.5) ([topuplist](https://topuplist.com/ja/blogs/detail/how-many-gigabytes-is-genshin-impact-mobile)) | n/a | n/a | It ships the world **installed**, not streamed. Wildshard can't (a PWA, UGC), so the Cache Storage / OPFS cache is the "install" |

**iOS Safari's real ceiling.** There is no fixed per-tab limit. WebContent gets the lower of WebKit's memory-pressure
limit and jetsam's. Reports: about 3 GB on an iPhone 15 Pro, 1.5–3 GB on an iPhone 12 Pro depending on uptime, and a
**2048 MB ActiveHard** limit on the iPhone class since iOS 26.3 ([pooled #207](https://github.com/Nehanth/pooled/issues/207),
[Catch Metrics](https://www.catchmetrics.io/blog/deep-dive-ram-internals-webkit)). The repo's **1.0 GB in world /
1.8 GB loading** (B1, `docs/process/RENDERING.md`) is a deliberate margin under that, so it stands. RENDERING.md
records that the Simulator stayed under 1 GB while the real iPhone was killed, so **only the physical phone counts**.

**Mobile links.** US medians are high: T-Mobile 259 Mbit/s, Verizon 131 Mbit/s, T-Mobile latency 46 ms (Ookla H2
2025, [RCR Wireless](https://www.rcrwireless.com/20260203/5g/ookla)). Medians hide tunnels, cell edges and the
Low-Power-Mode phone, so design for the repo's own planning figure: **`bytesPerSecond: 1125000` (9 Mbit/s)** in every
shard's `budgets.ts`, with 5 Mbit/s plus stalls as the stress case.

---

## 2. The geometry of the problem

Fixed facts. Shard 500 m; pitch 515 m; highway 15 m; first grid 5 × 5 = 2,575 m across, and its farthest corner is
≈ 1.8 km from the centre. Camera: `PerspectiveCamera(72°, aspect, 0.08, **2600**)` (`src/engine/core/Game.ts:327`).
Portrait at render scale 2: **804 × 1748 = 1.41 Mpx** (`budgets/calibration/*.json` "pixels": 1405392), so the
**horizontal FOV is only 37°** (computed). Today's shards fog out at 430–720 m (`src/shards/sunscar-dunes/look/render.ts`
FOG far 430; `src/shards/far-reach/look/sun.ts` far 720). Phone tier: shadows 80 m, trees hi→lo at 80 m, props to
220 m (`src/engine/render/tiers.ts`).

### 2.1 Shards touched within radius R (any part of the 500 m square within R), computed

| Standpoint | 150 m | 250 m | 300 m | 500 m | 750 m | 1000 m | 1500 m |
|---|---|---|---|---|---|---|---|
| (a) Shard centre | 1 | 1 | 5 | 9 | 9 | 21 | 37 (25 on 5×5) |
| Edge road, 50 m in | 2 | 2 | 6 | 7 | 12 | 21 | 39 (25) |
| (b) Highway, mid-segment | 2 | 2 | 6 | 6 | 12 | 20 | 38 (25) |
| (c) **Crossroads** | **4** | **4** | **4** | **4** | 16 | 16 | 36 (25) |

### 2.2 Tiles within R. This is the key result: tile count does not depend on where you stand (computed)

| Tile size | Standpoint | 150 m | 250 m | 500 m | 1000 m |
|---|---|---|---|---|---|
| 62.5 m (64/shard) | centre / highway / **crossroads** | 32 / 32 / **32** | 60 / 60 / **60** | 216 / 216 / **224** | 816 / 820 / **820** |
| 125 m (16/shard) | centre / highway / **crossroads** | 12 / 12 / **12** | 16 / 16 / **16** | 60 / 60 / **60** | 216 / 216 / **216** |

So **the crossroads costs the same tile memory as the shard centre**. What grows is the number of *distinct shards*
inside the near ring: 1 → 2 → 4. Each distinct shard brings a fixed cost (materials, programs, look, plugin,
ambient audio). **The fixed cost per shard is the variable that W7c actually constrains.**

### 2.3 In view vs in range

- **Memory follows the ring, draws follow the frustum.** With a 37° horizontal FOV, one view holds 1–2 of the four
  corner shards (3 when looking down a diagonal into the junction). But a camera turns 180° in about 0.3 s, so all four
  near sets must be **resident**. Draw calls and triangles are bounded by roughly ⅓ of the ring; memory is bounded by
  all of it.
- **Simulation range** (AI, active bodies, full-rate replication): about 150 m. **Replication range** for neighbours'
  creatures and players: 150–400 m at 2–5 Hz (the Dual Universe pattern). Beyond 400 m nothing live is drawn, except
  landmark entities if a shard declares them.

### 2.4 How big a shard looks from far away (computed for 804 px across, 37° horizontal)

| Distance | px per metre | a 500 m shard spans | 1 px = | Implication |
|---|---|---|---|---|
| 150 m | 8.0 | fills the screen | 0.12 m | full detail |
| 500 m | 2.4 | 1,203 px (fills the screen) | 0.42 m | a 10 m building is 24 px: geometry still reads |
| 1000 m | 1.2 | 601 px | 0.83 m | a proxy texture of about 600 texels across a shard is enough |
| 1500 m | 0.8 | 401 px | 1.25 m | 512² proxy texture |
| 2500 m | 0.48 | 241 px | 2.1 m | 256² is enough. The camera far plane is 2600 m |

**Consequence:** inside a 5 × 5 grid every other shard is between 0.5 and 1.8 km away and 300–1,200 px wide. That is
too big and too much parallax for a flat billboard. A billboard drifts visibly when you drive sideways past it at
30 m/s. "Horizon impostor" inside the grid should therefore mean a **baked low-poly proxy mesh** (a few thousand
triangles plus one texture atlas). Flat or octahedral impostors ([octahedral impostors, used in Fortnite](https://80.lv/articles/impostor-baker-for-ue4/))
are only right **beyond ≈ 2.5 km**, which applies to grids bigger than 5 × 5.

### 2.5 Memory if every shard keeps its own textures and materials

- Today's per-shard phone GPU ceilings (`src/shards/*/budgetCeilings.ts`): Sunscar **153 MB**, Driftwood 219, Nalati
  226, Far Reach 266, Nine Dragon 271, Pine Hollow **587 MB**. Four of today's shards at a corner come to
  **0.61–2.35 GB** of GPU memory alone, before the JS heap, Rapier, audio and render targets. **This does not fit.**
- Texture arithmetic for 1024², with mips (computed): RGBA8 **5.6 MB**; ASTC 4×4 **1.4 MB**; ASTC 6×6 0.62 MB;
  ASTC 8×8 0.35 MB. A PBR material (albedo + normal + ARM) is 4.2 MB in ASTC 4×4 and 16.8 MB in RGBA8. A decoded
  JPEG/WebP lands on the GPU as RGBA8. So **KTX2 → ASTC is mandatory in the package**, not an optimisation. ASTC
  coverage on iOS ≈ 100% ([web3dsurvey](https://web3dsurvey.com/webgl/extensions/WEBGL_compressed_texture_astc)).
  The repo already ships KTX2 for Pine Hollow (`src/shards/pine-hollow/ktx2.generated.ts`).
- Render targets at 1.41 Mpx (computed): RGBA16F 11.2 MB each, RGBA8 5.6 MB. The post chain is roughly 40–70 MB
  **[unverified: count the chain's targets]**. Its size doesn't depend on how many shards are on screen, *as long as
  each shard does not bring its own post passes*.

### 2.6 Bandwidth at 30 m/s (computed)

A disc of radius R moving at v sweeps **2·R·v m²/s** of new area. Assumed compressed payloads: L0 = p0 per 62.5 m tile,
L1 = p1 per 125 m tile (L1 ring 400 m). Far proxies are preloaded (§3).

| Case | p0 / p1 | Highway (L0 = edge band only) | Off-road (full L0 disc of 150 m) | +3 s stall every 30 s |
|---|---|---|---|---|
| 15 m/s (horse) | 0.3 / 0.2 MB | 2.3 Mbit/s | 3.9 | 2.6 / 4.4 |
| 15 m/s | 0.6 / 0.4 MB | 4.6 | 7.8 | 5.1 / 8.7 |
| **30 m/s (car)** | **0.3 / 0.2 MB** | **4.6** | **7.8** | **5.1 / 8.7** |
| 30 m/s | 0.6 / 0.4 MB | 9.2 | 15.7 | 10.3 / 17.4 |

**Stall lookahead** = v × stall: 90 m for 3 s and 150 m for 5 s at 30 m/s. That length must be *added in the
direction of travel* to the L0 ring, or a stall shows coarse LOD at close range.

**Reality check:** today's stylized shards are 2–9 MB in total on the phone (Sunscar 2.3 MB phone pack, Nalati 5.5,
Nine Dragon 6.3, Far Reach 5.6), which is **0.04–0.15 MB per L0 tile** if spread out. They are small partly because
geometry is *generated on the device* by shard code. A data-only package ships baked geometry, which is bigger. Scatter
(grass, trees, rocks) must stay **instance lists over shared prototypes**, or bytes explode. Only Pine Hollow (20.4 MB
phone pack, 91 MB of assets in total) strains the stream. **Conclusion: at p0 ≤ 0.3 MB and p1 ≤ 0.2 MB, 30 m/s on the
highway fits in 5 Mbit/s with stalls. Off-road at 30 m/s needs about 9 Mbit/s, so either cap vehicle speed off the
highway or accept coarse LOD at close range off-road.** A second visit costs zero bytes with a persistent cache.

---

## 3. The proposed design

### 3.1 The rings (distances from the camera; tile counts are from §2.2)

| Ring | Range | Content | Unit | Count resident (worst) | Memory share |
|---|---|---|---|---|---|
| **R0 near** | 0–150 m, plus a heading lookahead of v × 5 s | **L0** tiles: full meshes, the shard's material library, colliders, interactables, sim | 62.5 m tile | 32 tiles (+ ~8 lookahead) from **≤ 4 shards** | 40 × **5 MB** = 200 MB + shard libraries 4 × **25 MB** = 100 MB |
| **R1 neighbour band** | 150–400 m | **L1** tiles: a merged and simplified 2×2 of L0, **self-contained baked atlas** (no library), no colliders | 125 m tile | ~32 tiles from ≤ 9 shards | 32 × **2.5 MB** = 80 MB |
| **R2 far proxy** | 400 m → far plane, the whole grid | **L2**: one mesh per shard, 5–10k tris, one 1024² ASTC atlas, baked in its own look | shard | 25 (5×5) | 25 × **1.6 MB** = 40 MB |
| **R3 horizon** | beyond ~2.5 km (grids larger than 5×5) | **L3**: octahedral/skyline impostor in a shared atlas | shard | n | 25 × 0.25 MB = 6 MB |
| Engine base | — | JS heap, three, Rapier wasm, HUD, player rigs, audio, post targets, highway | — | — | **300 MB [unverified: measure the template shard on the phone]** |
| Streaming slack | — | in-flight decode, double residency during LOD swaps | — | — | 80 MB |
| **Total** | | | | | **≈ 806 MB** (≈ 19% headroom under 1.0 GB) |

Rules:
- **Parent-first, REPLACE refinement** (3D Tiles / MSFS). L2 for the whole grid is resident from login (it loads in the
  1.8 GB loading window: 25 × ~1 MB compressed = about 25 MB, about 22 s at 9 Mbit/s; it can be ranked by distance and
  progressive). L1 must be loaded before its L0 children draw. A stall therefore shows a coarser LOD, **never a hole**
  (W7d).
- **Only L0 may reference the shard library.** Everything coarser is baked and self-contained, so a shard that is only
  in R1/R2 costs nothing fixed. This is what caps the corner at **4 libraries** (2 on the highway, 1 inside).
- **Distance bands rather than screen-space error.** The grid and the FOV are fixed, so fixed distances with hysteresis
  (±15 m) are simpler and deterministic for a validator. Keep a per-tile geometric error in the format in case SSE is
  wanted later.
- **The highway is engine-owned and always resident**: a deck, rails and lamps from one kit, one style. About 20 km of
  road on a 5×5 grid as instanced segments, under 10 MB **[estimate]**.

Per-tile caps (phone, the validator's numbers; first guesses for the prototype to confirm or cut):

| | L0 (62.5 m) | L1 (125 m) | L2 (shard) | Shard library |
|---|---|---|---|---|
| Resident memory | 5 MB | 2.5 MB | 1.6 MB | 25 MB |
| Download (compressed) | 0.3 MB | 0.2 MB | 1 MB | 8 MB |
| Triangles | 40k | 10k | 8k | — |
| Draw calls | 8 (instanced) | 2 | 1 | — |
| Colliders | yes (heightfield + primitives) | no | no | — |

At the crossroads (computed): about 40 L0 × 8 draws in the ring, but frustum-culled to roughly ⅓ (~110 draws), plus
~11 L1 × 2 + 25 L2, so **≈ 160 draws**. Triangles in view ≈ 13 L0 × 40k + 11 × 10k + 25 × 8k ≈ **0.83 M**, under
Pine Hollow's measured 1.3–1.9 M (tiers.ts comment). At the calibrated hot-phone cost of 4.3 µs per draw
(`budgets/calibration` drawCpuMs × ratio 10, itself an *assumption* there), 160 draws ≈ 0.7 ms of CPU.

**What today's shards would have to become:** a whole shard at L0 is 64 × 5 + 25 = **345 MB** on disk/resident cap,
but only about half of it is ever resident. Sunscar, Driftwood, Nalati, Far Reach and Nine Dragon fit today's numbers.
Pine Hollow (587 MB) needs about 1.7× less per area, which means texture compression and sharing, not a redesign.

### 3.2 How a shard package is baked for streaming

1. **The author builds in shard-local coordinates** (W1) on their machine. The SDK's **baker** cuts the result into
   the fixed quadtree: root 500 m, then 250 m, then **125 m (L1)**, then **62.5 m (L0)**. Columns are full height
   (500 m). Content is assigned **by bounding-box centre**, with a straddle rule: an object bigger than half a tile, or
   crossing it by more than 10 m, goes to the parent level ("landmark" layer). It then draws from L1 distance up and
   still has L0 colliders. This is how Nine Dragon's towers, Pine Hollow's crags and Sky Reach's islands survive tiling.
2. **Per tile**: L0 = the meshes as authored (instanced prototype refs + transforms, meshopt geometry, materials by
   library id), colliders, nav slice, entity spawns. L1 = the platform merges and simplifies the 4 children and **bakes
   their materials** into one atlas (the UE "Approximated / Simplified" HLOD), under the L1 caps.
3. **The edge band** = the outer ring of L0 tiles (28 of 64, so 62.5 m deep, which covers W4's ≥ 50 m road).
   Edge-band tiles have the **same caps** but **top streaming priority**, and they must be **self-sufficient**: no
   reference to interior tiles. That gives W7b: edges at full detail without the interior. The validator also checks
   **seam continuity** at the edge-road entries (height and material match at y = 0).
4. **L2 far proxy**: platform-made by rendering the shard from 8–16 azimuths and 3 elevations and fusing into a
   simplified mesh plus atlas, lit in **its own look** (its sun and its grade baked in), with no fog (fog is applied
   live by the camera's frame). **L3**: an octahedral impostor captured from L2.
5. **Shard library**: materials as **parameters over the engine's fixed shader set** (toon, painterly, PBR, unlit/neon,
   plus a small set of approved variants), KTX2 textures, the look descriptor (sky, sun, fog, grade LUT), and ambient
   audio. **No shard-authored shader code.** It is unsafe for untrusted uploads anyway, and a fixed program set is what
   lets four looks share compiled programs (no link at the crossroads; `linkMs: 1000` is today's per-shard allocation in
   `budgets.ts`).
6. **The validator (A3, S3) measures per tile and per ring**, the UEFN way: "at every standpoint, the worst-case
   R0+R1 set ≤ cap". The crossroads standpoint is checked with **four copies of the worst corner of this shard**, so a
   shard is never judged by its neighbours.

### 3.3 Four looks on one screen at a corner (W7f, R5, O6)

**Per-shard look inside, one frame between.** Concretely:

- **One sun, one sky, one fog per frame, owned by the camera.** Inside a shard, beyond its edge band, the camera uses
  the **shard's own look**: sky, sun direction and colour, fog, exposure. On the highway and at crossroads it uses the
  **world frame**, a neutral sky and sun chosen by the platform. Across the edge band (62.5 m) the camera **cross-fades**
  between them: about 2 s at 30 m/s, about 40 s on foot. A moving sun moves shadows, so fade the sun direction only
  while the shadow cascade (80 m) is mostly empty highway, or fade intensity rather than direction **[taste call, Jake]**.
- **Neighbours' near tiles** (R0 of another shard) are drawn with **their own materials and their own grade LUT**, lit
  by the current frame's sun. The grade is chosen **per pixel by shard id** in the final post pass. Reconstruct world
  xz from depth, look up the cell, sample that shard's 16³/32³ LUT strip (about 16–128 KB each), and blend across the
  15 m highway. That costs one extra texture fetch per pixel, and there is no per-shard post pass.
- **Per-shard post effects that are not a grade** (outlines, bloom thresholds, god rays) must be **material-side**
  (inverted-hull outlines, emissive strength) or global. **No per-shard post passes**: four bloom chains at a corner
  would break the post budget (`lanes.post` is 1/16–1/10 of the GPU in today's budgets).
- **Far proxies keep their baked look**, so you see Sunscar's purple dusk from Pine Hollow's daylight. The camera's
  fog then hazes them toward the frame's horizon colour, and that is what makes the view read as one picture.
- **Time of day:** shards that fix their own time (today: Sunscar dusk, Pine Hollow day) keep it inside. The world
  frame's time is a platform decision. **Open question for Jake**: does the highway follow a server clock, or stay at a
  fixed neutral noon?

### 3.4 The server side

- **Rooms by region, the highway included.** Each shard square is its shard's room (W6/M1). The **highway network is its
  own room**: on a 5×5 grid that is 40 segments plus the crossroads, about 0.3 km² of deck, sparse and transit-only. Split
  it by grid quadrant once one room can't hold it. *Why not split the highway on its centreline between the two
  neighbours:* every lane change would be a handoff, and the crossroads would be a 4-way handoff knot (SL's worst case).
  With a highway room, a car driving the highway **never hands over**. Stepping onto a shard is **exactly one handoff**,
  at the shard edge, with a ±5 m hysteresis.
- **Seen across a border = read-only interest subscriptions**, not ghosts. The client subscribes to every room whose
  region meets its interest radius: full rate within 150 m, 2–5 Hz within 400 m, nothing beyond. At a crossroads that is
  **4 shard rooms + the highway room = 5 streams**, multiplexed by **one gateway connection** per client (SC's
  replication-layer idea, kept to a stateless fan-in). The neighbour subscription opens at 400 m, so it is long
  established before any border (SL's child-agent lesson).
- **Handoff without duplication**: each entity has `(id, ownerRoom, epoch)`.
  1. The source sees the crossing past hysteresis, freezes the entity, and sends `TRANSFER(state, inputSeq, epoch+1)`.
  2. The target accepts and simulates from epoch+1. The source drops the entity after the ACK.
  3. The client keeps **the highest epoch per id**, so two copies never draw.
  4. On a timeout (200 ms) the source resumes at epoch+2.
  5. The gateway buffers the player's inputs by sequence number and replays them to the new owner, so **no input is
     lost**. Client-side prediction hides the transfer.
  6. **A vehicle and everyone in it transfer as one group** (SC streaming groups; SL's lost-passenger bug).
  7. Persistent player state (inventory, saves) lives in a player service, not in rooms, so the handoff payload is small.
- **Creatures are leashed to their shard.** A shard's NPCs never enter the highway (it is server no-man's-land) or
  another shard. They are seen across borders by subscription only.
- **v1: the highway is a safe zone and there is no damage across a border.** That removes cross-room hit resolution
  (BigWorld-style ghosts and lag compensation across two authorities) from the first grid. If cross-border combat
  comes later, the target's room resolves the hit.
- **Physics never waits on a room or the network.** The highway deck's colliders are engine-built and always local. An
  L0 tile's colliders must be resident before the player is within 60 m of it. If they aren't, the shard edge acts as a
  soft barrier (W7d: "never a fall"; SL's "potholes" lesson).

### 3.5 What the highway is

A first-party, engine-built **deck at y = 0, 15 m wide**, made of one neutral kit: road surface, kerbs, guard rails
broken only at the four edge-road entries, lamps, and crossroads plazas of 15 × 15 m. It carries the **world frame**
look. It is **always resident** and **always solid**, so a stall can never drop you. It is the **seam cover**: it hides
the edge of every shard's terrain (a shard edge may be a 250 m cliff below or a wall above, outside the edge-road
openings). It is the **highway room's** territory: the place for cars, fast travel, signs naming the next shard, and the
platform's own content. Below the deck, between two shards' edges, is a 15 m gap. Fill it with a neutral "lattice" kit
(O6's "shared lattice") rather than leaving a void.

---

## 4. What the package format must contain (expensive to change later)

1. **A fixed tile grid in shard-local coordinates**: root 500 m, L1 125 m, L0 62.5 m, full-height columns. Tile
   addresses are `(level, ix, iz)`. Changing the tile size later re-bakes every shard ever uploaded.
2. **LOD levels per tile, as separate files** (the WoW ADT split): L0 and L1 per tile; L2 and L3 per shard. Each tile
   records its geometric error, bounds, byte size, resident-memory estimate, triangle count and draw count, so the
   client and the validator never have to open a tile to plan.
3. **Baked, self-contained L1/L2/L3** with no reference to the shard library. Only L0 references the library.
4. **A shard library as data over a fixed engine shader set**: material parameters plus KTX2 (ASTC/ETC2-transcodable)
   textures. No custom shaders. The **look descriptor** (sky, sun, fog, exposure, grade LUT) is separate from geometry,
   so the camera can blend looks and the post pass can grade per pixel.
5. **Instanced scatter as data**: prototype id plus a transform list per tile, never baked-out copies.
6. **A landmark layer** for objects that straddle tiles or are visible from far away, with a declared visibility range.
7. **An edge-band contract**: the 28 perimeter L0 tiles are self-sufficient, plus seam data for the four edge roads
   (height and material at y = 0) for the validator's continuity check.
8. **Colliders per L0 tile**, separate from render data (heightfield + primitives, trimesh only for walk-in shapes,
   per RENDERING.md). Small, so they can be loaded first.
9. **Entities as spawn data per tile**, with a home-shard leash and a replication class (full-rate, low-rate,
   landmark), so the server and the client agree on what neighbours see.
10. **Declared budgets per tile, per library and per ring standpoint** (B2/S3), which the validator checks against
    the phone caps of §3.1. The *caps* live in the platform, not in the package, so they can tighten without a re-upload.
11. **Content addressing** (hash per tile file) so CDNs, Cache Storage and revision swaps reuse unchanged tiles. A
    revision update streams only the tiles that changed.

---

## 5. The cheapest prototype that proves or kills it on the phone

**"Crossroads rig"**, with no server, no real authoring pipeline and no real shards converted:

- **World:** 2 × 2 shards around one crossroads, plus the highway cross, plus 21 synthetic L2 proxies filling the
  rest of a 5×5 grid. Tiles are **generated at exactly the caps of §3.1** (every L0 at 5 MB / 40k tris / 8 draws, every
  library at 25 MB, every L1 at 2.5 MB), so it is a worst case by construction. The four quadrants use four material
  models: toon, painterly, PBR (Pine Hollow's KTX2 textures) and neon emissive. Each has its own grade LUT and look
  descriptor, so the per-pixel grade and the camera cross-fade are real.
- **Engine:** the real renderer, post chain at render scale 2, phone tier, Rapier with per-tile colliders added and
  removed, decoding (meshopt, KTX2) in workers, uploads time-sliced on the main thread.
- **Driver:** a scripted route on a loop for 20 minutes:
  - 30 m/s along both highways through the crossroads;
  - 15 m/s cross-country diagonally through each quadrant;
  - a 60 s stop at the crossroads with the camera turning 360° every 4 s.
- **Network:** tiles served from a throttling proxy at 5 Mbit/s, with a 3 s stall every 30 s and one 10 s stall per
  lap. A cold cache on lap 1 and a warm cache after.
- **A desk-side server half** (Node, no phone): 2 shard rooms + a highway room + a gateway. 1,000 bot crossings at
  30 m/s, including vehicles with 3 passengers, must give **0 duplicates, 0 lost entities and 0 lost inputs**.

**Numbers it must hit on the physical iPhone 17 Pro, hot, in portrait** (RENDERING.md's physical-device exception):

| Metric | Pass |
|---|---|
| Memory footprint while playing | **≤ 0.85 GB peak** over 3 × 20 min runs (15% under B1's 1.0 GB); boot ≤ 1.8 GB |
| Frame time | p95 ≤ 33.3 ms; **≤ 1 frame > 100 ms per minute** while streaming |
| Holes | 0 frames where a visible cell has no loaded LOD (instrumented) |
| Falls | 0 (L0 colliders resident before 60 m, or the barrier engages) |
| Time to L0 | ≤ 3 s after a tile enters R0 at 9 Mbit/s; L1 never starves at 30 m/s on the highway at 5 Mbit/s |
| Shader programs | constant after the boot pre-warm: 0 links at the first crossroads visit |
| JS heap and wasm memory | growth < 20 MB over 20 min (tile churn must not leak; wasm memory cannot shrink) |
| Safari kill | 0 WebContent kills in 3 runs |

**Kill or redesign triggers:**
- The engine base alone is above 400 MB: the rings don't fit, so cut L0 to 3 MB or R0 to 100 m.
- The four libraries plus the L0 ring at caps exceed 0.85 GB: the per-shard fixed cap drops below 25 MB.
- Upload or GC hitches above 100 ms can't be time-sliced away: tiles must get smaller, or the format must carry
  GPU-ready layouts.
- The per-pixel grade reads as a hard seam on the highway: take the variant to Jake as a board.

---

## 6. Risks and open questions, ranked

1. **Memory at the corner (W7c)** is the risk that decides the design. The engine base is unmeasured (my 300 MB is a
   guess). Safari's limit varies with uptime. Tile churn may fragment the JS heap and **wasm linear memory, which only
   grows** (Rapier). *Mitigation:* the prototype's first reading is the empty-template footprint; reuse collider and
   buffer pools.
2. **Authored content that doesn't tile**: today's shards are monolithic and code-built, with big landmarks and
   procedural scatter. A data-only bake with a straddle rule, a landmark layer and instance lists is new work in
   SHARD-PLATFORM. Sky Reach and Driftwood (W4-exempt) still need L0/L1/L2.
3. **Look coherence (W7f)** is Jake's taste: per-pixel grade seams, the fade of the sun direction, contradicting times
   of day, and four fog colours in one view. Needs a variant board, not an argument.
4. **iOS WebGL hitches**: no async uploads, link cost, decode GC. *Mitigation:* the fixed shader set pre-warmed at boot,
   worker decoding and sliced uploads. Unproven at 30 fps hot.
5. **Handoff correctness (W7e)**: epochs, the gateway's input buffering and atomic vehicle groups. SL and SC both
   shipped bugs here. Moderate risk, testable on the desk.
6. **Untrusted plugin CPU at a corner**: up to 4 shards' WASM plugins live on the client at once. *Proposal:* only
   R0 shards' plugins run, and each plugin's fuel is a quarter share at a crossroads (B2).
7. **The validator's numbers vs the phone**: the calibration's phone ratio is an assumption ("no phone calibration was
   run", `budgets/calibration/*.json`). Per-tile caps need one phone calibration, or they are fiction.
8. **Off-road 30 m/s bandwidth** (≈ 9 Mbit/s): cap vehicle speed inside shards, or accept coarse LOD at close range
   off-road.
9. **Grid growth**: beyond about 2.6 km (the camera far plane) and beyond 5×5, L3 impostors and a horizon atlas are
   needed, and a floating origin per shard. Float32 is fine to about ±2 km (≈ 0.12–0.24 mm steps, computed).

**Open questions for Jake** (one recommendation each):
- *The world frame on the highway:* a fixed neutral noon, or a server clock? **Recommend a fixed neutral time** (no
  night/day fights with shards).
- *Creatures crossing borders?* **Recommend no** (leashed).
- *Combat across a border?* **Recommend no in v1** (the highway is a safe zone).
- *Driving inside shards at 30 m/s?* **Recommend a cap of 15 m/s off the highway.**
- *Tile size 62.5 m / 125 m* frozen in the format? **Recommend yes**, after the prototype passes.
