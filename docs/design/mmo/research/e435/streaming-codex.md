**Wildshard needs to stream pieces of four shards, while treating player ownership as a separate system. Loading a second monolithic shard before unloading the first cannot meet the stated phone budget. Loading four is out of the question.**

My recommendation is **62.5 m spatial cells, independently loadable texture dependencies, mandatory coarse representations, one client-wide memory allocator, and a server-owned highway room**. Prove that combination at a four-shard crossroads before freezing the package format.

The current [MMO requirements](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md) already make this explicit in W7–W8. I used those requirements, including the corrected ±250 m vertical bounds. No repository files were changed.

**Evidence convention:** cited descriptions are sourced; calculations below are derived from your dimensions. **U means unverified:** no reliable public value or implementation detail was established. All proposed budgets and thresholds are **unverified design targets**, not measured Wildshard results. The 1.0/1.8 GB limits are your project constraints, not a universal Safari guarantee.

**1. Prior art: which parts actually transfer**

A crucial distinction: **streaming installed assets from storage, downloading new assets over a mobile connection, and transferring simulation authority are three different problems.** A game solving one does not establish that it solves all three.

In the table, memory means runtime residency, not installation size or a device’s advertised RAM.

| Precedent | Spatial streaming and LOD | Phone distance, memory and bandwidth | Ownership and failure modes |
|---|---|---|---|
| **World of Warcraft** | Seamless travel within continents; exact contemporary terrain tile/HLOD implementation **U** here. Phasing changes quest-state visibility; layering makes separate copies of the world to distribute population. Neither is geometric LOD. Blizzard explicitly preserved cross-zone NPC patrols and travel within a layer. | Native phone figures **U**. Transferable per-tile memory/bandwidth budgets **U**. Installed world assets make this a different delivery problem from downloading strangers’ shards. | A visual zone boundary need not be a server boundary. Exact handoff protocol **U**. Phase/layer changes can separate otherwise nearby players; Party Sync aligns quest state and phase. Sources: [Blizzard’s layering explanation](https://us.forums.blizzard.com/en/wow/t/q-a-compilation-wow-classic-development-team-ama/260760), [Party Sync](https://worldofwarcraft.blizzard.com/en-us/news/23451087). |
| **Guild Wars 2** | Uses separately instantiated maps, with loading transitions between zones. Internal streaming granularity and HLOD budgets **U**. ArenaNet’s megaserver system dynamically creates map copies and groups players using social/contextual information. | Native phone figures and runtime streaming budgets **U**. | Map entry selects a destination copy. **Inference:** loading screens provide an explicit point to replace assets, establish state and assign capacity. ArenaNet’s complete historical rationale for choosing loading screens **U**. Documented complications include party placement and representing destination-map event state. Sources: [megaserver design](https://www.guildwars2.com/en-gb/news/introducing-the-megaserver-system/), [world-event implications](https://www.guildwars2.com/en-gb/news/the-megaserver-system-world-bosses-and-events/). |
| **Star Citizen** | Object Container Streaming loads/unloads relevant world content on clients and servers. Containers are hierarchical content groupings, not necessarily uniform terrain squares. Its meshing design separates replication/state distribution from simulation authority. | Native phone figures **U**; useful per-container memory and wire budgets **U**. Desktop success supplies no Safari budget. | Authority transfer is a separate architectural feature from OCS. CIG reports deployed server meshing, but that does not establish a bounded worst-case crossing latency. Failure concerns include unavailable simulation nodes and delayed state delivery; numerical guarantees **U**. Sources: [OCS description](https://robertsspaceindustries.com/en/comm-link/transmission/17805-Letter-From-The-Chairman), [meshing architecture Q&A](https://robertsspaceindustries.com/en/comm-link/transmission/18397-Server-Meshing-And-Persistent-Streaming-Q-A), [release discussion](https://robertsspaceindustries.com/en/comm-link/transmission/20371-Letter-From-The-Chairman). |
| **Microsoft Flight Simulator** | Streams geographically tiled imagery/elevation/photogrammetry, refining terrain by LOD. Asobo documents a quadtree data layout. MSFS 2024 further emphasizes downloading detail along the flight path. | **MSFS 2020** published 5/20/50 Mbit/s minimum/recommended/ideal connections and 8/16/32 GB system RAM. Those are system requirements, **not tile residency budgets**. Native phone view distance **U**. | Crossing a terrain tile is not player-room migration. Exact multiplayer geographic ownership **U**. Missing bandwidth degrades available scenery; precise failure envelopes **U**. Sources: [Asobo terrain presentation](https://www.asobostudio.com/files/inline-images/Designing_Terrain_System_Fuentes_Lionel.pdf), [2020 requirements](https://flightsimulator.zendesk.com/hc/en-us/articles/360013463459-Minimum-Recommended-and-Ideal-PC-requirements-for-Microsoft-Flight-Simulator), [2024 streaming](https://www.flightsimulator.com/msfs2024-preorder-now-available/). |
| **Cesium / OGC 3D Tiles + glTF** | The closest rendering precedent: bounding-volume hierarchy, geometric error, parent/child refinement and independently fetched content. glTF carries renderable assets; 3D Tiles supplies spatial organization and HLOD. | No fixed mobile metre radius. Detail depends on projected error and available memory. CesiumJS currently defaults to **512 MiB cache plus up to 512 MiB overflow per tileset**—already unsuitable as an unquestioned Wildshard default. Bandwidth depends on content. | No gameplay ownership or collision handoff. Cache pressure increases permitted error; late children require a valid parent representation. Sources: [OGC standard](https://www.ogc.org/standards/3dtiles/), [CesiumJS cache/refinement controls](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html). |
| **Google Earth** | Continuously downloads, decompresses and prepares geographic content; Google reports substantial benefit from background-thread processing. Google’s public photorealistic content is also available through hierarchical 3D Tiles. That API does **not** document every Google Earth internal. | Phone metre radius and stable runtime/wire budgets **U**. Google’s historical web implementation explicitly encountered memory limitations. | No player authority transfer. Detail can refine after arrival, an acceptable behavior for a globe viewer that may be unacceptable beneath a moving vehicle. Sources: [Earth’s WebAssembly architecture](https://web.dev/case-studies/earth-webassembly), [Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles). |
| **Minecraft / Bedrock** | **16 × 16 block columns**; separate render and simulation distances. This separation is directly useful. No general distant-world HLOD equivalent is established by the cited vanilla documentation. | Microsoft gives low-end examples of **6–8 chunks**, approximately **96–128 m** at a metre per block; another guide permits device defaults as low as four chunks. Simulation defaults to four chunks. Exact iPhone 17 Pro settings and per-chunk residency/wire cost **U**. | Chunk arrival normally extends one world/server session, not a seamless transfer between independently authored servers. Missing chunks and simulation boundaries limit what can be displayed or updated. Sources: [distance definitions](https://learn.microsoft.com/en-us/minecraft/creator/documents/simulationrenderdistanceguide?view=minecraft-bedrock-stable), [low-end device guidance](https://learn.microsoft.com/th-th/minecraft/creator/documents/designinggameplayforvariousdevices?view=minecraft-bedrock-stable). |
| **Roblox StreamingEnabled** | Streams Workspace regions around replication foci; models can have coarse streaming meshes. Current docs also describe predictive and frustum streaming. | Defaults: **64-stud minimum**, **1,024-stud target**; these are neither metres nor guaranteed phone visibility. Exact phone memory cap **U**. Roblox warns that additional foci increase bandwidth and memory and can cause OS termination. | Streaming normally remains within an experience server; it does not itself provide seamless cross-server travel. Documented risks include absent instances, insufficient buffering and excessive foci. Sources: [instance streaming](https://create.roblox.com/docs/workspace/streaming), [model LOD](https://create.roblox.com/docs/reference/engine/classes/Model), [frustum limitations](https://create.roblox.com/docs/workspace/streaming/frustum). |
| **Unreal World Partition + HLOD** | Configurable spatial cells and streaming sources; unloaded areas remain visible through merged/simplified HLOD actors. Referenced actors can be bundled together, so dependencies affect streaming granularity. | No universal phone distance, MB/cell or network budget. Usually streams cooked, installed content. | World Partition is not server meshing. Game-specific authority transfer remains **U**. Failure risks include oversized dependency groups and expensive/missing HLODs. Sources: [World Partition](https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-in-unreal-engine), [HLOD](https://dev.epicgames.com/documentation/unreal-engine/world-partition---hierarchical-level-of-detail-in-unreal-engine). |
| **Unity / large-world streaming** | Additive asynchronous scenes and Addressables/AssetBundles provide loading primitives. Tile layout and HLOD are application decisions. | No engine-wide phone radius or runtime budget. Unity documents bundle metadata costs and dependency-driven residency. | Scene loading does not implement distributed room handoff. Documented traps: duplicated dependencies, assets retaining bundles, and synchronous instantiation despite asynchronous loading. Sources: [Addressables memory guidance](https://unity.com/blog/engine-platform/extended-q-a-optimizing-memory-and-build-size-with-addressables), [scene loading](https://docs.unity.cn/Packages/com.unity.addressables%401.22/manual/LoadingScenes.html), [API behavior](https://docs.unity3d.com/ja/Packages/com.unity.addressables%401.20/api/UnityEngine.AddressableAssets.Addressables.html). |
| **No Man’s Sky** | Continuous procedural generation supports space-to-ground travel. It trades downloading arbitrary unique terrain for generating terrain from compact rules and installed resources. Exact current tile dimensions/HLOD thresholds **U**. | Native phone figures and transferable tile budgets **U**. Procedural-generation cost replaces part of the network cost. | Its terrain transitions do not establish a room-per-player-shard MMO handoff. Exact current multiplayer authority protocol **U**. Official patches document memory-related crashes/optimizations. Sources: [Hello Games’ GDC presentation](https://www.gdcvault.com/play/1024265/), [Worlds Part II changes](https://www.nomanssky.com/worlds-part-ii-update/). |
| **Dual Universe** | Novaquark described a continuous single-shard cluster, procedural planets, voxel editing and planet-scale LOD. **“Single shard” means one shared universe**, unlike a Wildshard content cell. | Native phone figures **U**; independently substantiated per-region residency, bandwidth and handoff bounds **U**. | Relevant distributed-world ambition, but not a numerical proof for this design. Detailed failure envelope **U**. Source is a **developer announcement**, not a benchmark: [Novaquark’s architecture claims](https://www.prweb.com/releases/novaquark_announces_the_first_boundless_mmo_dual_universe/prweb13415044.htm). |
| **Second Life** | **256 m regions**, neighboring-region rendering, streamed user assets and four mesh LODs. Very close to Wildshard’s authorship and border problem. | Phone render radius and fixed runtime/wire budgets **U**. Arbitrary attachments/content make cost heterogeneous. | Region transfers move avatars/vehicles between simulators. Linden’s release notes document lost crossing flags, attachment-arrival frame spikes and vehicle complications. A viewer-developer account specifically identifies overlapping crossings at four-region corners; it explicitly warns that its reconstruction is unofficial. Sources: [mesh format](https://wiki.secondlife.com/wiki/Mesh/Mesh_Asset_Format), [Linden’s documented failures](https://releasenotes.secondlife.com/simulator/2024-09-13.10853867644.html), [crossing reconstruction—details unverified](https://wiki.secondlife.com/wiki/Region_crossing). |
| **Hytale** | Official documentation describes **32 × 32 chunks**, generated world data, large texture atlases and distance-dependent geometry residency. Exact HLOD hierarchy **U**. | Published PC targets: **192-block view at minimum**, **384 recommended**. Its accelerated-travel tests give minimum/recommended links of **2/4 Mbit/s at 192**, **4.5/7 at 384**, **6/10 at 480**. PC RAM requirements are 8–16 GB; phone figures **U**. | Chunk streaming is client/server world delivery, not proof of seamless server meshing. Hytale explicitly warns that larger view distances, geometry and atlases can exhaust VRAM or stutter. Source: [official hardware and network measurements](https://hytale.com/news/2025/12/hytale-hardware-requirements). |
| **Fortnite, including mobile** | Epic documents mobile-specific optimization and, in UEFN, grid streaming with generated HLODs. Network replication uses spatial relevance and dormant actors. | Exact current native-mobile metre radius, runtime residency and streaming bandwidth **U**. UEFN memory accounting must not be mistaken for physical MB. | Crossing a streaming cell is distinct from changing match/server. Epic’s replication documentation addresses distributing relevant state, not geographic server migration. Documented mobile concerns include memory, battery and performance. Sources: [mobile engineering](https://www.unrealengine.com/tech-blog/exploring-unreal-engine-4-20-s-mobile-optimizations), [streaming/HLOD](https://dev.epicgames.com/documentation/en-us/fortnite/streaming-and-hlods-in-unreal-editor-for-fortnite), [replication graph](https://dev.epicgames.com/documentation/en-us/unreal-engine/replication-graph-in-unreal-engine). |
| **Genshin Impact on phones** | Demonstrates a large authored mobile world with a tightly controlled art pipeline. Exact streaming cell dimensions, HLOD scheme and thresholds **U** from the primary material located. | Official requirements list **3 GB device RAM on supported iOS devices**, **4 GB Android**, and **40 GB minimum storage**. These are not measured game residency. Phone view distance and exploration bandwidth **U**. | No evidence here of seamless room-per-zone MMO authority migration. HoYoverse documents freezing/black screens on insufficient hardware and a mobile shader-compilation crash support topic. Sources: [miHoYo’s rendering presentation](https://www.gdcvault.com/play/1027539/-Genshin-Impact-Crafting-an), [current requirements](https://support.hoyoverse.com/hc/en-us/articles/52089402685593-What-are-the-system-requirements-to-play-Genshin-Impact). |

**The useful combination is Cesium’s spatial hierarchy, Minecraft’s separation of visibility and simulation, Unreal/Unity’s dependency discipline, and Second Life’s crossing lessons.** None supplies a ready-made budget for four unrelated art pipelines in a 1 GB Safari session.

**2. Wildshard’s geometry and bandwidth**

All counts below are **360° residency candidates**, before camera-frustum or occlusion culling. A portrait camera normally sees a subset, but rapid turning exposes the rest. Physics cannot discard a nearby surface because the camera faces away.

For shard centre \((515i,515j)\), distance from point \((x,z)\) to its footprint is:

\[
d=\sqrt{\max(|x-515i|-250,0)^2+\max(|z-515j|-250,0)^2}
\]

Counting shard centres instead would miss the principal problem.

I enumerated the 5 × 5 grid using:

- Interior: \((0,0)\).
- Highway midpoint: \((257.5,0)\).
- Interior crossroads: \((257.5,257.5)\).
- Candidate tiles: **62.5 × 62.5 m**, eight per shard axis.

Each cell below is **shards / horizontal tiles intersecting the radius**. Boundary contact counts.

| Radius | Interior | Between two shards | Four-shard crossroads |
|---:|---:|---:|---:|
| 50 m | 1 / 4 | 2 / 4 | **4 / 4** |
| 100 m | 1 / 16 | 2 / 16 | **4 / 16** |
| 150 m | 1 / 32 | 2 / 32 | **4 / 32** |
| 250 m | 1 / 60 | 2 / 60 | **4 / 60** |
| 300 m | 5 / 88 | 6 / 88 | 4 / 88 |
| 500 m | 9 / 216 | 6 / 216 | 4 / 224 |
| 750 m | 9 / 476 | 12 / 476 | **16 / 468** |
| 1,000 m | 21 / 816 | 20 / 820 | 16 / 820 |
| 1,500 m | 25 / 1,516 | 25 / 1,464 | 25 / 1,413 |

These are exact counts for those positions, **not maxima over every possible player position**.

The important result: **a crossroads does not quadruple nearby land area. It divides roughly the same nearby area among four independent content owners.** What can quadruple is each shard’s fixed texture pool, shader setup, scene root, effects, behavior runtime and allocation overhead.

At the crossroads:

- Each nearest shard corner is \(\sqrt{7.5^2+7.5^2}=\mathbf{10.61\ m}\) away.
- Four full-detail representations must coexist in the near field.
- The closest mandatory midpoint entrances are **257.61 m** away.
- Thus **the four required roads do not make the corners traversable**. Edge terrain outside those entrances can still present cliffs, water, exposed undersides or walls.
- Beyond about **522.5 m**, additional shards start entering range. By 750 m, sixteen footprints intersect the radius.

At a shard’s centre, immediate neighbors begin at **265 m**, and diagonal neighbors at **374.77 m**. A 500 m far view already requires representations from nine shards.

**Vertical content makes a surface-only budget unsafe.** The horizontal counts assume a terrain-like workload. If all 62.5 m cubes throughout the 500 m height were populated, a 100 m sphere at the selected centre/crossroads positions intersects **56 volumetric cells**; a 250 m sphere intersects **408**. Towers and underground stacks therefore need vertical subdivision and aggregate budgets, not a fresh allowance per floor.

The grid’s content footprint is **2,560 m across**, excluding any additional outside perimeter highway. From its centre to its outer corner is about **1,810 m**; corner-to-corner is about **3,620 m**. A complete horizon representation is a small finite dataset for the first grid.

**Independent textures are the immediate memory trap.**

Derived examples:

- One 2,048² RGBA8 texture with a complete mip chain: approximately **21.33 MiB**.
- Eight unique material sets, each with three such textures: **512 MiB per shard**.
- Four shards: **2 GiB of textures alone**.
- At an illustrative 8 bits/texel GPU format, that becomes approximately **512 MiB across four shards**, still excluding geometry, CPU copies, framebuffers, physics, actors and browser overhead.

GPU compression helps; download compression alone does not. Khronos explicitly distinguishes efficient transmission from reduced GPU footprint through [KTX2/Basis textures](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_basisu/README.md).

Likewise, an illustrative **200 MB shared client + 600 MB unique content per shard** becomes:

| Fully resident shards | Total |
|---:|---:|
| 1 | 800 MB |
| 2 | 1,400 MB |
| 4 | **2,600 MB** |

Those are scenarios, not measurements of the repo.

**At 30 m/s, the available preparation times are short.**

| Distance | Travel time |
|---:|---:|
| 15 m highway width | **0.50 s** |
| 50 m entrance road | 1.67 s |
| 62.5 m tile | 2.08 s |
| 150 m | 5.00 s |
| 300 m | 10.00 s |
| 515 m shard pitch | 17.17 s |

The highway cannot be the place where loading begins.

Assume **70% of link capacity is available for asset delivery**, leaving room for state traffic, protocol overhead and variation. This is a proposed planning assumption.

| Link | Asset rate | Data received over one 62.5 m advance | During 300 m approach |
|---:|---:|---:|---:|
| 5 Mbit/s | 0.438 MB/s | **0.91 MB** | 4.38 MB |
| 10 Mbit/s | 0.875 MB/s | 1.82 MB | 8.75 MB |
| 20 Mbit/s | 1.750 MB/s | 3.65 MB | 17.50 MB |

That is the allowance for **everything newly needed**, not one tile. A five-second asset stall consumes **150 m of prepared route**.

For fresh straight-line travel, a radius-\(R\) disk encounters approximately \(2Rv\) square metres of new ground per second. With 62.5 m tiles:

\[
\text{new tile equivalents/s}\approx\frac{2Rv}{62.5^2}
\]

At 30 m/s:

| Detail radius | New tile equivalents/s | Bandwidth at 1 MB of unique content per tile |
|---:|---:|---:|
| 100 m | 1.536 | **12.29 Mbit/s** |
| 250 m | 3.840 | **30.72 Mbit/s** |

This approximation excludes tile-boundary bursts, discarded predictions and initialization costs.

**A 5 Mbit/s design requires small incremental payloads and reusable content. “Prefetch farther” cannot repair a sustained consumption rate above the link rate.**

**3. Proposed design**

Everything in this section is a **proposal, unverified on the phone**.

**One scheduler should select detail for the whole view.**

| Representation | Initial distance policy | Responsibilities |
|---|---|---|
| **Near** | 0–100 m | Approved phone-detail geometry/materials; nearby actors; authoritative collision representation available independently. Includes parts of all four shards at a corner. |
| **Neighbor band** | 100–250 m | Simplified buildings/terrain, reduced texture resolution, instanced vegetation; no small decoration. Important dynamic actors retain separate representations. |
| **Far proxy** | 250–1,000 m | Baked, genuinely three-dimensional HLOD clusters; silhouette, openings and landmark shape preserved. |
| **Horizon impostor** | Beyond 1,000 m, subject to error limits | Multi-view/elevation impostors for suitable clusters; retain cheap 3D proxies where parallax or silhouette error is unacceptable. |
| **Preparation envelope** | Approximately 350 m along reachable routes | Fetch collision, traversal surfaces, dependencies and room subscriptions ahead of movement. This is separate from rendering distance. |

Distances are initial scheduling bounds. **Projected size/error must also control refinement.** A 250 m tower remains visually large at one kilometre; distance alone cannot justify flattening it into a billboard.

Do not run four complete shard render pipelines. The scheduler selects a **non-overlapping cut through each hierarchy**: a parent remains until its replacement children are ready. It must not retain and draw a complete far shard beneath all its detailed children.

Use ordinary mesh merging at bake time and instancing where appropriate, consistent with the repository’s prohibition on facade multi-draw.

**The package should have small independently loadable units.**

Start with **62.5 m horizontal cells**:

- 8 × 8 = **64 columns per shard**.
- Regular hierarchy: **62.5 → 125 → 250 → 500 m**.
- Sparse vertical subdivisions within columns for towers, caves and interiors.
- A column’s allowance covers the **sum** of its vertical pieces. Subdivision cannot multiply its entitlement.
- Objects crossing cells have one stable identity, explicit bounds and dependencies; they do not force the whole shard to load.
- Dynamic objects remain outside static HLOD geometry.

This is a cleaner first hierarchy than arbitrary 50 m tiles. The manifest should encode dimensions, however, so the file format does not permanently hardcode this experimental choice.

The outermost cell ring forms a **62.5 m edge band**. It contains **28 of the 64 horizontal cells**, or **43.75% of the shard’s area**. Therefore, “load the entire edge band” is also too expensive. The edge band is an authoring and validation category; load only the necessary portions.

The bake must produce:

1. Near representations with bounded dependency sets.
2. Neighbor-band representations.
3. Hierarchical far geometry.
4. Horizon representations with declared useful viewing ranges.
5. Independent collision/navigation/traversal data.
6. Cheap structural fallback geometry that cannot disappear when decoration is late.

**A tiny mesh referencing a shard-wide 4K atlas is not a streamable tile.** Dependency residency, rather than GLB file boundaries, determines whether this works. Unity documents precisely this class of [bundle dependency problem](https://unity.com/blog/engine-platform/extended-q-a-optimizing-memory-and-build-size-with-addressables).

**Initial per-cell delivery targets**

| Payload | Proposed target |
|---|---:|
| Neighbor-band incremental payload | **≤32 KiB per horizontal cell** |
| Near driving-tier incremental payload | **≤128 KiB per horizontal cell** |
| Additional high-quality payload for cached/slower exploration | Optional, admitted by available bandwidth |
| Near resident assets, including retained CPU backing | **≤8 MiB per column dependency closure** |
| Neighbor-band resident assets | **≤1 MiB per column** |
| Whole-shard far proxy set | **≤1.5 MiB resident** |
| Whole-shard horizon set | **≤0.5 MiB resident** |

The delivery targets must include newly required textures, geometry and referenced resources. A shared material library’s first download is charged when first encountered.

Using the straight-line calculation:

- Near upgrades: \(1.536 × 128\) KiB/s.
- Band delivery: \(3.840 × 32\) KiB/s.
- Combined: approximately **2.62 Mbit/s**.
- A 3.5 Mbit/s asset allowance leaves about **0.88 Mbit/s** for other arrivals and variation.

These are demanding targets. **Whether an independently textured photoreal shard can satisfy them at acceptable quality is unverified and should be tested first.** “Full detail” must mean the approved phone driving tier. If it means today’s entire highest-detail material set, the 5 Mbit/s requirement may fail.

**One memory budget, shared across all shards**

Use a process-level envelope, not “1 GB per current shard.”

| Allocation | Proposed MiB |
|---|---:|
| Browser/client baseline, UI, renderer, shared highway and frame targets | 180 |
| Near static content | 192 |
| Neighbor band | 80 |
| Far proxies | 48 |
| Horizon representations | 24 |
| Players, creatures, rigs, nearby audio | 64 |
| Physics/navigation/state | 48 |
| Network buffers, decoding, upload staging and short transition overlap | 64 |
| Unallocated contingency | 160 |
| **Total envelope** | **860 MiB ≈ 902 MB** |

This leaves approximately **98 MB below the decimal 1 GB project ceiling**. The 160 MiB contingency is not another asset cache.

Near content can occupy up to 24 nominal 8 MiB column allowances; at the example crossroads, sixteen intersect 100 m. The allocator must still enforce actual dependency totals and account for prefetch overlap.

Measure actual memory attributable to WebContent and graphics resources. Do not add estimated GPU memory to a process measurement that already includes the same backing allocation. Do not equate `renderer.info`, JS heap size or downloaded bytes with total residency. WebGL exposes no portable maximum-VRAM query; [MDN recommends explicit allocation accounting](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

The **1.8 GB loading allowance does not apply repeatedly at borders**. Streaming during play must stay inside the playing envelope.

**Four styles need a common frame contract.**

| Property | Proposed ownership |
|---|---|
| Geometry, albedo, material response, toon ramps, painterly textures, emissive treatment | Per shard, through approved material families |
| Exposure and tone mapping | One global frame |
| Exterior sky and distant atmosphere | One global world system |
| Exterior sun direction/time | Shared; shards may vary their material response and bounded lighting parameters |
| Local lights, reflection probes, interior ambiance | Per shard, with globally enforced counts/residency |
| Local fog | Spatial volumes with bounded influence; integrate across the view consistently |
| Bloom, outlines and grading | Shared implementation with material/region masks where required |

An incoming shard must not overwrite `scene.background`, install a new global composer or change everyone’s exposure.

A toon forest beside PBR architecture can retain different materials. **Four mutually incompatible suns, full-screen LUTs and skies cannot each remain globally authoritative in one view.** If “own art style” requires all those properties, that requirement needs a narrower definition.

Keep the highway’s exterior lighting stable. Blend observer-dependent atmosphere through a spatial transition band; do not switch the whole frame when a shard ID changes. Avoid using heavy fog to conceal missing neighbors.

**The highway should be real platform content and a stable authority domain.**

For the first grid:

- One **server-owned highway room** covers the connected road network and its crossroads.
- Its static road geometry and collision are generated from trusted grid placement data.
- It owns vehicles and players while their authoritative anchor is on the highway.
- Crossing an intersection does **not** transfer ownership.
- The owner changes on entering/leaving a shard.
- A vehicle, riders and attached gameplay objects transfer as a single group.
- Define ownership above and below the highway too; a two-dimensional road polygon is insufficient for jumping, bridges and falling.

This avoids placing room boundaries at the most dangerous four-way intersections. The highway room may eventually need partitioning, but that should not leak into client content identities.

The highway is **not a loading tunnel**. Its continuity, visible neighboring terrain and collision are always real.

**Visibility must cross room boundaries without activating four full simulations on the phone.**

Use a persistent client connection to a trusted gateway. The gateway routes inputs to the owning room and combines interest subscriptions from nearby rooms.

Initial policy:

- Near interaction and prediction: approximately **100 m**, adjusted for actual gameplay.
- Visible dynamic actors: up to **250 m**, with distance-dependent update/animation detail.
- Room preparation: approximately **350 m along reachable routes**.
- Distant static proxies need **no neighboring room simulation subscription**.
- Persistent quests and NPC state remain server-owned when their rendering tiles unload.

Example state budget: **50 actors × 48 bytes × 10 updates/s = 24 KB/s**, or **0.192 Mbit/s**, before protocol overhead and events. A provisional **0.5 Mbit/s state allowance** is plausible but unverified. Crowds, combat and voice require separate accounting.

A radius is not a gameplay rule. A projectile, audible event or large moving creature may need interest outside that radius. Such influence must be declared and bounded.

**Handoff protocol**

1. Preconnect and authorize the destination while the player approaches.
2. Prepare the destination’s necessary state and collision.
3. Source room remains the sole authority while preparing.
4. At an agreed simulation tick, transfer a snapshot containing player/vehicle state and the last accepted input sequence.
5. A coordinator atomically advances an **ownership epoch**.
6. Destination accepts subsequent inputs for that epoch; stale source writes are rejected.
7. Gateway continues the same client session and entity identity.
8. Retries reuse a transfer ID; inventory, rewards and state mutations are idempotent.
9. Only one transfer per moving group may be in progress. A rapid second crossing is queued or folded into the prepared destination decision.
10. On failure, source authority persists until the coordinator establishes a valid replacement. Never allow two rooms to “temporarily” own the same player.

Stable identity prevents render duplication; fencing prevents authoritative duplication. Both are necessary.

Cross-border combat also needs an explicit protocol: unique attack IDs, authoritative hit arbitration, bounded historical state and collision knowledge across the boundary. Read-only neighboring avatars alone do not make cross-border combat work.

**4. Package decisions that become expensive to change**

| Required contract | Why it must exist early |
|---|---|
| **Logical immutable package; independently retrievable members** | A single sequentially compressed download defeats nearest-first streaming. Upload may be one archive; delivery must permit individual hashed objects or independently compressed ranges. |
| **Versioned coordinate system, units, bounds and tile hierarchy** | Placement, collision, culling, networking and proxy baking must agree. Encode vertical extent explicitly. |
| **Explicit dependency graph and resource hashes** | Allows residency accounting, deduplication, cancellation and eviction. No hidden whole-shard initialization dependency. |
| **Compressed, decoded and GPU-format size declarations** | Wire size cannot predict runtime memory or decoder peak allocation. Validate declarations during platform baking. |
| **Per-node geometric error and coverage** | Supports parent fallback and refinement without gaps or duplicate surfaces. |
| **Stable entity IDs independent of tile, LOD and placement** | Crossing, rebaking, relocation and unloading must not create a new gameplay entity. |
| **Separate rendering and simulation lifecycles** | Unloading a tree’s mesh must not reset its state; loading a proxy must not execute its behavior. |
| **Collision/navigation topology and edge connections** | Terrain heightfields alone cannot represent caves, bridges, floating islands or doors. |
| **Boundary descriptors** | Entrance geometry, clearance, legal traversable edges, exposed faces, water and vertical crossings need validation. |
| **Versioned look contract** | Prevents arbitrary skies, post-processing and shader combinations from breaking multi-shard rendering. |
| **Dynamic/proxy exclusions and state substitutions** | A baked proxy must not permanently show an open door, intact bridge or living boss after its state changes. |
| **Behavior resource limits and maximum spatial influence** | An uploaded mechanic must not subscribe to or simulate the entire grid through an apparently local tile. |
| **Revision and placement epochs in the platform envelope** | Clients must not combine collision from revision A, visuals from B and room state from C. |
| **Privacy classifications for every derived asset** | A public far proxy can leak a private shard just as surely as its original GLB. |

Validation must include **windows spanning cells and synthetic neighboring shards**. Passing each tile independently does not prove the combination fits. Charge dependency fan-out, shader variants, transparent overdraw and dynamic content, not just triangle count.

**5. The cheapest decisive prototype**

Build **one real four-shard crossroads**, not four complete remastered shards and not a complete MMO.

Use four independently packaged, representative edge areas:

- Low-poly/toon.
- Painterly.
- Photoreal PBR.
- Neon/emissive.

Include shared highway segments long enough for a **350 m approach and departure**, plus a midpoint entrance. Include one tall structure, one exposed underside/bridge, foliage, transparent effects and actual collision. Fill the remaining 21 grid positions with baked far/horizon content.

The scene must use representative textures and materials. Four differently colored primitive fields would prove little.

Use the real three.js/WebGL 2 client, fixed 2× render scale and existing Rapier path. Add the minimal loader, memory accounting and scheduler. Put four shard rooms and one highway room across **two small server processes behind one gateway**; this permits real process failure and transfer tests without building deployment infrastructure.

Test independently:

- **Assets:** cold cache, 5/10/20 Mbit/s, five-second delivery interruption, failed tile, late texture and rapid camera reversal.
- **State:** latency/jitter/loss, delayed transfer acknowledgment, duplicate messages, destination process death and source process death.
- **Movement:** walking, horse, 30 m/s driving, sudden turns, U-turns, corner loitering and repeated entrance crossings.
- **View:** ground-level crossroads and elevated views exposing all four styles and the far grid.

Use a **physical iPhone 17 Pro in portrait home-screen Safari**, with Low Power Mode and a hot-device run. Desktop throttling and the Simulator are supplementary evidence only. Run bounded scripted traversals after thermal conditioning; the developer operating the test owns the measurement and verdict.

| Gate | Proposed pass condition |
|---|---|
| Required performance | Sustained **30 fps hot** at fixed 2× scale |
| Frame pacing | Proposed p99 frame interval **≤50 ms**; no streaming-caused interval **>100 ms** |
| Residency | Target **≤902 MB**; **never exceed 1,000 MB during travel** |
| Initial loading | **≤1,800 MB**, with peak decoding/upload allocations measured |
| Delivery | **30 m/s at 5 Mbit/s**, with asset demand within the approximately **3.5 Mbit/s** planning allowance |
| Five-second asset outage | No missing structural surface, fall, freeze or loading screen; lower visual detail is allowed |
| Camera reversal | Every newly exposed direction has a valid structural representation immediately |
| Near-tier readiness | Required near content and collision ready before entry under the bounded network test |
| Handoff integrity | **Zero** duplicated/lost actors, items, rewards or ownership epochs |
| Handoff presentation | No avatar recreation flash; no additional position correction exceeding a proposed **0.25 m** in the controlled normal-network crossing test |
| Failure behavior | Destination failure leaves one owner; recovery never resurrects stale state |
| Cross-border visibility | Actors remain visible and identified across boundaries; combat tests execute exactly once |
| Resource release | After a route returns to its starting working set, reference accounting contains no orphaned tile/decoder resources |

Frame and correction tolerances above are proposed acceptance criteria; only the 30 fps and memory limits come directly from your requirements.

**Kill or revise the design if:**

- Four representative edge sets exceed the envelope before meaningful gameplay is added.
- One photoreal tile pulls in its whole shard’s texture pool.
- Acceptable driving detail consumes more fresh bytes per second than the target link delivers.
- Tile uploads or shader preparation cause unavoidable long main-thread stalls.
- Seamless crossing requires simultaneous full ownership or full residency of two shards.
- The visual solution works only from a fixed camera position.

A successful prototype proves this **content envelope and bounded network scenario**, not arbitrary uploaded scenes.

**6. Ranked risks and open questions**

| Rank | Risk | Recommended answer |
|---:|---|---|
| **1** | **Current content cannot fit the incremental memory and delivery budgets.** Tiling geometry may leave the expensive texture/material dependencies untouched. | Test actual photoreal and foliage edge content first. Make dependency-closed residency and bytes-per-metre upload gates. Reject or rebake content that fails. |
| **2** | **“Seamless under stalls” has no stated outage limit.** No finite prefetch buffer guarantees arbitrary movement into unknown content during an arbitrarily long outage. | Specify a bounded promise: 30 m/s, 5 Mbit/s, five-second asset stall. Beyond it, retain structural proxies and provide a safe, explicit degraded state. Continued authoritative multiplayer during total disconnection cannot be guaranteed. |
| **3** | **Tile decoding, texture upload and shader compilation hitch despite adequate average bandwidth.** | Bound individual work units, precompile the admitted material families, decode in workers and schedule uploads within measured frame slack. Measure peak overlap. |
| **4** | **Cross-border ownership and interactions duplicate or lose state.** Vehicles and rapid repeat crossings are especially dangerous. | Stable gateway connection, fenced ownership epochs, grouped rider/vehicle transfer, idempotent events and fault-injection tests before inventory or rewards cross rooms. |
| **5** | **Untrusted content bypasses nominal budgets.** Tiny files can expand heavily, reference enormous dependencies or generate pathological overdraw. | Platform-owned baking and validation; hard aggregate limits on decoded resources, material families, behavior and spatial influence. Author-provided cost claims are not trusted. |
| **6** | **Independent styles depend on incompatible global rendering settings.** | Preserve local artistic identity inside a common exterior sky, lighting and frame-output contract. Identify any existing look that cannot survive this before promising parity. |
| **7** | **Dense vertical shards defeat surface-based accounting.** | Sparse 3D bounds and vertical culling, but one aggregate column/view allowance. Test a tower beside a deep exposed shard. |
| **8** | **The highway room becomes a crowd hotspot.** Splitting it too soon reintroduces difficult crossings. | Start with one logical room, explicit capacity and spatial interest filtering. Keep entity identity independent of host so later partitioning is possible. |
| **9** | **Revision swaps invalidate prepared collision, proxies or room state.** | Pin a consistent revision/placement epoch for active travel. Transition revisions atomically; do not hot-replace occupied collision piecemeal. |
| **10** | **Horizon proxies misrepresent changing or private content.** | Bake only approved static content; support state substitutions and privacy-safe exterior representations. Validate from multiple elevations. |

**The first expensive commitment should be the streamability contract. The first implementation proof should be four representative edge areas, driving through their crossroads on the hot phone at 5 Mbit/s.**