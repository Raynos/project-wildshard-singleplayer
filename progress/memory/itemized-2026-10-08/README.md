# Itemized memory: where every MB goes, per situation (E456)

2026-10-08. Jake's ask: when a situation is quoted at 900 or 1,100 MB, break it into chunks of 50 MB or less, say who and what
owns each chunk, and split GPU memory from RAM. This receipt does that for the measurements already committed. It takes no new
reading, changes no cap and claims no saving. Decimal MB throughout.

**The short answer: GPU memory is fully itemized. RAM is only half itemized. In every grid situation 339 to 457 MB of RAM
sits in WebKit's allocator with no measured owner.** That unattributed block is the biggest single thing in every situation,
bigger than any shard's own content.

## The images

| Situation | Image | Total MB | GPU MB | RAM MB | Unattributed MB | vs 1.0 GB |
|---|---|---:|---:|---:|---:|---|
| 1. Grid + Driftwood home (spawn, nothing entered) | [1-grid-home.jpg](1-grid-home.jpg) | 805.3 | 196.2 | 609.1 | 415.1 | 195 under |
| 2. Pine Hollow centre | [2-pine-centre.jpg](2-pine-centre.jpg) | 1185.2 | 245.7 | 939.5 | 456.7 | **185 over** |
| 3. Nalati centre | [3-nalati-centre.jpg](3-nalati-centre.jpg) | 1101.0 | 294.4 | 806.7 | 339.4 | **101 over** |
| 4. Engine base (empty template, standalone) | [4-engine-base.jpg](4-engine-base.jpg) | 298.5 | 80.5 | 218.0 | 165.0 | 702 under |
| 5. Empty road after leaving Nalati (no shard resident) | [5-road-after-nalati.jpg](5-road-after-nalati.jpg) | 933.2 | 120.4 | 812.8 | 423.2 | 67 under |
| All five side by side | [summary.jpg](summary.jpg) | | | | | |

How to read each image: one bar from 0 to the total, with the 1.0 GB cap drawn as a red dashed line. GPU is below the black
line and RAM is above it. Each tick on the left is a 50 MB chunk. Colour shows the owner: platform (orange), engine and game
(blue), the shard itself (green), kit and player (yellow), browser and OS (violet), labelled but ownerless (dark grey).
Hatching marks an estimate. Light grey is RAM with no measured owner, and its dashed lines mark each 50 MB chunk of it.

Situation 5 is an extra. "The empty road" could mean two poses, so both are here: situation 1 is the grid before any visit,
with Driftwood loaded; situation 5 is the road after a Nalati visit, with no shard resident at all.

## Sources, pins and confidence

| Situation | Native + GL source (same run, same pose) | Build | Settings | Heap-class estimates from |
|---|---|---|---|---|
| 1, 3, 5 | `g227-budget/native-nalati-saver-on-verified-65106ea87.json.gz` + its `.vmmap.txt` files (PID 76367) | `65106ea87` | Simulator iPhone 16 Pro, Safari, phone, 2×, Auto/KTX2, Developer ON, Memory saver ON, muted, one cold run | 1: none. 3: Mac WebKit heap at Nalati centre, `0e6d69988` (one commit later, other process). 5: Simulator Inspector heap on the same road pose, `29f650e1e` (10 min earlier, separate cold run) |
| 2 | `g227-budget/pine-centre-0e6d69988/native.json.gz` + vmmap of PID 17200 ([evidence/](evidence/), SHA-256 `2f15bebd…` matches `cut-list-evidence.json`) | `0e6d69988` | same | Mac WebKit heap at Pine centre, same pin (other process); exact audio sources from `audio-owners.json` |
| 4 | `progress/memory/sf22a-2026-10-04.json` (SF22a) | `91f97bdfc` | Simulator iPhone 17 Pro, cold tab; GL bytes from desktop Chromium | none |

Each block in the itemization has one of three tags:

- **M, measured:** taken in the same run and pose as the total. That covers every GPU row (labelled GL, reconciled to the
  byte), the WASM heaps, the CPU geometry copies the scene still holds, and the vmmap regions of the same PID: JIT code,
  graphics mappings, raster data and system libraries.
- **E, estimated:** a heap-snapshot class size taken from another process or pin and put into this situation. That covers
  audio PCM, decoded images, canvases, JS code metadata, and JS objects and strings. A heap snapshot of the Simulator
  WebContent at a shard centre has never completed: it timed out three times (`centre-heap-failures.json`).
- **U, unattributed:** WebContent footprint minus every M and E row. It is the RAM that nobody's ruler can assign yet.

| Situation | Measured MB | Estimated MB | Unattributed MB |
|---|---:|---:|---:|
| 1. Grid + home | 390.2 | 0 | 415.1 |
| 2. Pine centre | 505.0 | 223.5 | 456.7 |
| 3. Nalati centre | 544.5 | 217.2 | 339.4 |
| 4. Engine base | 133.5 | 0 | 165.0 |
| 5. Road after Nalati | 311.1 | 199.0 | 423.2 |

**Single cold runs.** Pine's home pose read 762.0 MB on `0e6d69988` and 805.3 MB on `65106ea87`. Cold runs vary by about
±50 MB of WebContent, so treat every total here as ±50 MB. The three-run public-grid receipt (`g233-public-a1c4`, Developer
OFF) agrees in size: home 789.3, road 929.7, template centre 934.9 MB medians.

**Pins predate several cuts.** Cuts that landed after these readings: title AAC streaming (`137ebda3e`), Nalati sky source
release (`7e3213786`), vegetation canvas release (`1b58f5282`), seam colour release (`93b87cdc0`), KTX2 duplicates
(`fbf69074f`), and the smaller road sign atlas. On Pine at `cdad59776` that atlas is 6.6 MB of GPU instead of 22.4 MB. Each
has native credit 0 so far (`g227-budget/cut-list.md`), so the totals here are still the latest accepted rulers.

## GPU memory by type (all M)

| Type | Grid + home | Pine centre | Nalati centre | Road after Nalati | Engine base |
|---|---:|---:|---:|---:|---:|
| Textures | 62.1 | 134.1 | 145.8 | 61.0 | n/a |
| Geometry buffers | 96.4 | 52.9 | 88.8 | 21.8 | 0.8 |
| Render targets and post-processing at 2× | 31.3 | 32.4 | 39.7 | 31.3 | 79.7 (all GPU textures there) |
| Environment and sky maps (sky panorama or keys, PMREM, cloud noise) | 2.1 | 22.1 | 19.0 | 2.1 | n/a |
| Shadow and depth maps (1024² / 512² depth targets) | 4.2 | 4.2 | 1.0 | 4.2 | n/a |
| **GPU total** | **196.2** | **245.7** | **294.4** | **120.4** | **80.5** |

The "shadow" rows are depth render targets. Labelling them as the sun shadow maps is an inference from their size, not a
measured identity.

## The top 10 owners

Across both entered centres. Ranges run Pine to Nalati. GPU and RAM are combined where an owner has both.

| # | Owner, and what it is | Pine MB | Nalati MB | Type | Conf |
|---|---|---:|---:|---|:---:|
| 1 | **Unattributed RAM**: WebKit malloc and Gigacage pages with no owner (live JS objects, freed-but-kept arenas, anything un-instrumented) | 456.7 | 339.4 | RAM | U |
| 2 | **The shard's own content**: models, terrain, sky, grass, creatures, CPU copies, decoded images and its audio | 207.8 | 277.2 | both | M + E |
| 3 | **Browser and OS**: system libraries, stacks, system malloc (about 60), JavaScriptCore JIT code (39 to 43), WebGL mappings (22 to 24), raster data | 139.8 | 126.5 | RAM | M |
| 4 | **Audio PCM**, every decoded buffer: shard music and SFX, title, stings | 112.1 | 68.4 | RAM | E |
| 5 | **Platform**: sign atlas 22.6, open plots 20.6, road deck 20.2, cell screens 7.0, junctions 5.6, far proxies 3.0 | 80.5 | 80.4 | mostly GPU | M |
| 6 | **JS code metadata plus JS objects and strings**, all layers | 81.2 | 73.0 | RAM | E |
| 7 | **Rapier physics WASM heap.** It grows from 30.7 at home to 52.2 in Nalati and WASM memory never shrinks | 35.9 | 52.2 | RAM | M |
| 8 | **Engine render targets**: post-processing at 2× plus PMREM and depth | 41.4 | 42.5 | GPU | M |
| 9 | **Kit and player**: held items, hands and parked drops (GPU plus CPU copies) | 38.0 | 23.5 | both | M |
| 10 | **2D canvases**: signs, cell screens, chalk, maps | 25.4 | 19.8 | RAM | E |

Rows 2, 4 and 10 overlap: the shard's audio and images are counted both in row 2 and in rows 4 and 10. The table ranks
owners; it is not a sum.

**Top 5 per situation** (blocks as itemized; the full tables are below):

- **Grid + home (805.3):** unattributed 415.1 · browser/OS system 58.1 · Driftwood trees and ground cover, GPU 34.8 · JIT
  code 33.3 · post targets 31.3. By owner: Driftwood 113.2, platform 76.4, engine 70.1.
- **Pine centre (1185.2):** unattributed 456.7 · browser/OS system 61.2 · JS objects and strings 43.3 (E) · JIT 43.3 · JS
  code 37.9 (E). Pine's own biggest: music calm + tension 35.5 (E), SFX sprite 30.7 (E), props GPU 36.5 split over three
  rows, sky GPU 16.9.
- **Nalati centre (1101.0):** unattributed 339.4 · browser/OS system 59.7 · Rapier 52.2 · post targets 39.7 · JIT 39.4.
  Nalati's own biggest: creatures and NPCs GPU 36.2, decoded model images 30.4 (E), music pair 26.6 (E), grass GPU 21.4,
  camps and buildings GPU 20.8, outcrops GPU 17.8 + CPU 5.9.
- **Engine base (298.5):** engine RAM never split 165.0 · render targets 79.7 · blank Safari tab 46.0 · JS-held geometry
  7.0 · buffers 0.8.
- **Road after Nalati (933.2):** unattributed 423.2 · decoded images still live 62.3 (E) · browser/OS 59.7 · Rapier 52.2 ·
  JS objects 40.3 (E). Live audio still held: 37.9 (E).

## Native regions behind the RAM (M, vmmap dirty, same PID)

These are where the RAM physically sits, not who owns it. Regions overlap their owners: the Gigacage holds ArrayBuffers, WASM
heaps and typed-array data; WebKit Malloc holds JS objects, code metadata and most native payloads.

| Region, dirty MB | Grid + home | Pine centre | Nalati centre | Road after Nalati |
|---|---:|---:|---:|---:|
| WebKit Malloc | 283.0 | 645.2 | 461.4 | 468.7 |
| JS VM Gigacage | 228.0 | 167.7 | 231.9 | 228.7 |
| JS JIT generated code | 33.3 | 43.3 | 39.4 | 39.6 |
| Graphics (VM_ALLOCATE + owned unmapped) | 17.3 | 23.8 | 21.5 | 21.1 |
| CG raster data | 3.3 | 11.5 | 5.8 | 8.5 |
| Everything else (libraries, stacks, system malloc) | 58.1 | 61.2 | 59.7 | 59.7 |
| vmmap physical footprint | 609.5 | 939.3 | 806.6 | 812.9 |
| WebContent median (the ruler) | 609.1 | 939.5 | 806.7 | 812.8 |

The vmmap footprint matches the sampled median within 0.4 MB. The "everything else" row counts dirty pages, and some of them
(shared-library data) are not charged to footprint. For Pine, vmmap's dirty total exceeds its footprint by about 13 MiB. The
unattributed bucket may therefore be understated by that much.

## What is actionable

1. **Find an owner for the unattributed 339 to 457 MB before cutting by guesswork.** It is a third to half of every total.
   A fix aimed only at the measured rows cannot reach the 950 MB margin target unless it also shrinks this block.
2. **Retention after leaving a shard.** With no shard loaded, RAM is 812.8 MB on the road against 609.1 MB at home before
   the visit, so 204 MB more stays behind. GPU memory does go back down (120 MB). The Simulator road heap still holds
   62.3 MB of decoded images and 37.9 MB of audio PCM. The retainer paths `window.__bake.roots`, `__skyV2` and
   `__perfHud → questSource` are already named in `g227-budget/native-audit.md`.
3. **Audio PCM is the largest owned RAM item inside a shard.** It is an estimated 112 MB in Pine: the music pair 35.5, the
   SFX sprite 30.7 (its crop failed exact playback), the title 23.9 (now streamed, native credit 0) and stings 7.7. Fewer or
   shorter stems is Jake's taste call (`cut-list.md`).
4. **Rapier's WASM heap only grows**, from 30.7 to 52.2 MB after Nalati, and it stays at 52.2 on the road. The lever is
   avoiding peak growth, not freeing it.
5. **The platform costs about 80 MB in every grid situation**, mostly GPU. The atlas work since this pin cut Pine's sign
   atlas from 22.4 to 6.6 MB of GPU. Distant billboards, signs and screens are a taste choice (`cut-list.md`).
6. **Small, clearly owned fixes:** GPU memory with no GL owner label (8 to 16 MB: add labels); an unidentified 16.8 MB WASM
   module that appears on Pine entry; Nalati's hidden kurgan interior, held as 12.0 MB of CPU copies (lazy build in flight,
   sp-x4).
7. **Fixed by rule:** post-processing targets at 2× (31 to 40 MB) stay, because render scale stays 2×. Only reusing targets
   between passes is open.

## What a real memory debugger would need to close the unknowns

1. **A heap snapshot of the same process at the same moment as the footprint**, on the Simulator, at a shard centre. Today's
   centre snapshots time out while the game draws. Pausing frames before the snapshot, or a streamed snapshot, would turn
   every E row into M and give the JS-object share of the unattributed block.
2. **Allocation-site attribution inside WebKit malloc** (bmalloc/libpas): MallocStackLogging on the WebContent process plus
   `malloc_history` / `leaks --outputGraph`, or Instruments Allocations with WebKit symbols. That charges WebKit Malloc pages
   to call stacks such as audio decode, image decode, the JSC GC heap or canvas.
3. **Separate live pages from freed-but-kept arenas.** Take scavenger or footprint readings before and after a simulated
   memory-pressure event, in its own run, never replacing the ruler. That says how much of the unknown is reclaimable
   fragmentation rather than a live owner.
4. **A game-side owner registry.** Every decode or allocation (AudioBuffer, ImageBitmap, canvas, large ArrayBuffer, WASM
   growth) would record its bytes and owner scope (engine, platform, shard or kit) and release them through a
   FinalizationRegistry. The census then sums live bytes per owner in the same run, which is how the GL side already
   reaches 100 %.
5. **Know which process holds image and canvas backing.** ImageBitmap and 2D-canvas storage may sit in the GPU process rather
   than WebContent. An allocation control like the existing GL control (`native-audit.md`) would settle it. If they do sit
   there, the E rows for images and canvases leave WebContent and the unattributed block grows by the same amount.
6. **A physical-iPhone reading** (Xcode memory gauge or Instruments over Web Inspector), and at least three cold runs per
   number. Everything here is Simulator-relative; SF22a's one phone/Simulator pair measured the phone at ×1.4.

## Reproduce

`python3 itemize.py` reads the committed receipts and `evidence/` and writes `itemized.json`, with every block and its
confidence. `python3 render.py` draws the six JPEGs from it using PIL with exact text. The GL owner rules follow
`g227-budget/classify.py`. The only additions are the two-axis owner/system split, and assigning shard-only PBR arrays to the
entered shard.

Plan-State: unchanged.

## Full itemized tables

Every block, tagged M, E or U. Each table sums to its total. Rows under 0.05 MB are omitted here; they remain in
`itemized.json`.

### Grid + Driftwood home

| Side | Owner | What | MB | Conf |
|---|---|---|---:|:---:|
| GPU | Driftwood | trees & ground cover | 34.8 | M |
| GPU | Engine & game | post-processing targets at 2x | 31.3 | M |
| GPU | Platform | road sign atlas | 22.6 | M |
| GPU | Platform | open plots (billboards & signs) | 19.1 | M |
| GPU | Platform | road deck & asphalt | 16.8 | M |
| GPU | Unknown owner | GL label has no owner | 16.2 | M |
| GPU | Driftwood | rocks, stones & dressing | 12.7 | M |
| GPU | Driftwood | terrain | 7.6 | M |
| GPU | Driftwood | other props | 7.5 | M |
| GPU | Driftwood | buildings, camps & small props | 7.5 | M |
| GPU | Platform | road junctions | 5.6 | M |
| GPU | Engine & game | depth targets (likely shadow maps) | 4.2 | M |
| GPU | Platform | cell screens | 3.5 | M |
| GPU | Driftwood | water & weather | 2.1 | M |
| GPU | Engine & game | PMREM environment map | 1.7 | M |
| GPU | Platform | far proxies | 1.3 | M |
| GPU | Platform | grid sky & grade | 0.7 | M |
| GPU | Platform | neighbour template creatures | 0.5 | M |
| GPU | Driftwood | creatures & NPCs | 0.2 | M |
| RAM | Browser & OS | system libraries, stacks, malloc | 58.1 | M |
| RAM | Browser & OS | JIT machine code (JavaScriptCore) | 33.3 | M |
| RAM | Engine & game | Rapier physics WASM heap | 30.7 | M |
| RAM | Driftwood | CPU copies: trees & ground cover | 22.1 | M |
| RAM | Browser & OS | WebGL graphics mappings in the tab | 17.3 | M |
| RAM | Driftwood | CPU copies: other props | 8.6 | M |
| RAM | Driftwood | CPU copies: rocks, stones & dressing | 4.2 | M |
| RAM | Platform | CPU copies: road deck & asphalt | 3.4 | M |
| RAM | Browser & OS | CG raster data (image rasters) | 3.3 | M |
| RAM | Driftwood | CPU copies: buildings, camps & small props | 2.9 | M |
| RAM | Engine & game | other small WASM modules | 2.2 | M |
| RAM | Unknown owner | CPU copies: GL label has no owner | 1.9 | M |
| RAM | Driftwood | CPU copies: creatures & NPCs | 1.5 | M |
| RAM | Platform | CPU copies: open plots (billboards & signs) | 1.5 | M |
| RAM | Platform | CPU copies: far proxies | 1.2 | M |
| RAM | Driftwood | CPU copies: water & weather | 0.8 | M |
| RAM | Driftwood | CPU copies: terrain | 0.6 | M |
| RAM | Kit & player | CPU copies: held items, hands & drops | 0.3 | M |
| RAM | Platform | CPU copies: grid sky & grade | 0.1 | M |
| RAM | Unknown owner | unattributed WebKit malloc + Gigacage pages | 415.1 | U |
| | | **Total** | **805.3** | |


### Pine Hollow centre

| Side | Owner | What | MB | Conf |
|---|---|---|---:|:---:|
| GPU | Engine & game | post-processing targets at 2x | 32.4 | M |
| GPU | Platform | road sign atlas | 22.6 | M |
| GPU | Kit & player | held items, hands & drops | 20.0 | M |
| GPU | Platform | open plots (billboards & signs) | 19.1 | M |
| GPU | Pine Hollow | sky | 16.9 | M |
| GPU | Platform | road deck & asphalt | 16.8 | M |
| GPU | Pine Hollow | trees & ground cover | 16.7 | M |
| GPU | Pine Hollow | rocks, stones & dressing | 14.8 | M |
| GPU | Pine Hollow | terrain | 13.4 | M |
| GPU | Pine Hollow | buildings, camps & small props | 12.4 | M |
| GPU | Unknown owner | GL label has no owner | 10.9 | M |
| GPU | Pine Hollow | creatures & NPCs | 10.0 | M |
| GPU | Pine Hollow | other props | 9.2 | M |
| GPU | Platform | cell screens | 7.0 | M |
| GPU | Platform | road junctions | 5.6 | M |
| GPU | Engine & game | PMREM environment map | 4.9 | M |
| GPU | Engine & game | depth targets (likely shadow maps) | 4.2 | M |
| GPU | Pine Hollow | signs & boards | 3.5 | M |
| GPU | Pine Hollow | water & weather | 2.3 | M |
| GPU | Platform | far proxies | 1.5 | M |
| GPU | Platform | grid sky & grade | 0.7 | M |
| GPU | Platform | neighbour template creatures | 0.5 | M |
| RAM | Browser & OS | system libraries, stacks, malloc | 61.2 | M |
| RAM | Engine & game | JS objects & strings (all layers) | 43.3 | E |
| RAM | Browser & OS | JIT machine code (JavaScriptCore) | 43.3 | M |
| RAM | Engine & game | JS compiled-code metadata (all layers) | 37.9 | E |
| RAM | Engine & game | Rapier physics WASM heap | 35.9 | M |
| RAM | Pine Hollow | audio PCM: Pine music calm + tension | 35.5 | E |
| RAM | Pine Hollow | audio PCM: Pine one-shot SFX sprite | 30.7 | E |
| RAM | Engine & game | 2D canvases (signs, screens, maps) | 25.4 | E |
| RAM | Engine & game | audio PCM: title piano track | 23.9 | E |
| RAM | Browser & OS | WebGL graphics mappings in the tab | 23.8 | M |
| RAM | Kit & player | CPU copies: held items, hands & drops | 18.0 | M |
| RAM | Unknown owner | unidentified 16.8 MB WASM module | 16.8 | M |
| RAM | Browser & OS | CG raster data (image rasters) | 11.5 | M |
| RAM | Unknown owner | audio PCM: other, source not traced | 10.8 | E |
| RAM | Pine Hollow | CPU copies: other props | 9.7 | M |
| RAM | Pine Hollow | CPU copies: buildings, camps & small props | 8.9 | M |
| RAM | Engine & game | audio PCM: piano stings | 7.7 | E |
| RAM | Pine Hollow | CPU copies: rocks, stones & dressing | 6.9 | M |
| RAM | Pine Hollow | CPU copies: creatures & NPCs | 6.0 | M |
| RAM | Pine Hollow | CPU copies: trees & ground cover | 5.3 | M |
| RAM | Unknown owner | decoded images, owner not traced | 4.7 | E |
| RAM | Pine Hollow | audio PCM: Pine ambience bed | 3.5 | E |
| RAM | Platform | CPU copies: road deck & asphalt | 3.4 | M |
| RAM | Engine & game | other small WASM modules | 2.2 | M |
| RAM | Pine Hollow | CPU copies: water & weather | 2.0 | M |
| RAM | Platform | CPU copies: open plots (billboards & signs) | 1.5 | M |
| RAM | Platform | CPU copies: far proxies | 1.5 | M |
| RAM | Unknown owner | CPU copies: GL label has no owner | 1.3 | M |
| RAM | Platform | CPU copies: grid sky & grade | 0.1 | M |
| RAM | Unknown owner | unattributed WebKit malloc + Gigacage pages | 456.7 | U |
| | | **Total** | **1185.2** | |


### Nalati centre

| Side | Owner | What | MB | Conf |
|---|---|---|---:|:---:|
| GPU | Engine & game | post-processing targets at 2x | 39.7 | M |
| GPU | Nalati | creatures & NPCs | 36.2 | M |
| GPU | Platform | road sign atlas | 22.6 | M |
| GPU | Nalati | grass | 21.4 | M |
| GPU | Nalati | buildings, camps & small props | 20.8 | M |
| GPU | Platform | open plots (billboards & signs) | 19.1 | M |
| GPU | Nalati | rocks, stones & dressing | 19.0 | M |
| GPU | Nalati | rock outcrops | 17.8 | M |
| GPU | Platform | road deck & asphalt | 16.8 | M |
| GPU | Nalati | sky | 16.7 | M |
| GPU | Nalati | terrain | 14.9 | M |
| GPU | Kit & player | held items, hands & drops | 11.5 | M |
| GPU | Unknown owner | GL label has no owner | 8.2 | M |
| GPU | Platform | cell screens | 7.0 | M |
| GPU | Platform | road junctions | 5.6 | M |
| GPU | Nalati | other props | 3.8 | M |
| GPU | Nalati | kurgans (incl. hidden interior) | 3.4 | M |
| GPU | Nalati | signs & boards | 2.8 | M |
| GPU | Engine & game | PMREM environment map | 1.7 | M |
| GPU | Platform | far proxies | 1.5 | M |
| GPU | Nalati | trees & ground cover | 1.1 | M |
| GPU | Engine & game | depth targets (likely shadow maps) | 1.0 | M |
| GPU | Platform | grid sky & grade | 0.7 | M |
| GPU | Platform | neighbour template creatures | 0.5 | M |
| GPU | Nalati | water & weather | 0.3 | M |
| RAM | Browser & OS | system libraries, stacks, malloc | 59.7 | M |
| RAM | Engine & game | Rapier physics WASM heap | 52.2 | M |
| RAM | Browser & OS | JIT machine code (JavaScriptCore) | 39.4 | M |
| RAM | Engine & game | JS compiled-code metadata (all layers) | 38.8 | E |
| RAM | Engine & game | JS objects & strings (all layers) | 34.2 | E |
| RAM | Nalati | decoded model & creature texture images | 30.4 | E |
| RAM | Nalati | audio PCM: 46 s music pair | 26.6 | E |
| RAM | Engine & game | audio PCM: 62 s title-length track | 23.9 | E |
| RAM | Browser & OS | WebGL graphics mappings in the tab | 21.5 | M |
| RAM | Engine & game | 2D canvases (signs, screens, maps) | 19.8 | E |
| RAM | Unknown owner | audio PCM: stings & other buffers | 17.8 | E |
| RAM | Nalati | CPU copies: kurgans (incl. hidden interior) | 15.1 | M |
| RAM | Unknown owner | decoded images, owner not traced | 13.1 | E |
| RAM | Nalati | decoded sky panorama source image | 12.5 | E |
| RAM | Kit & player | CPU copies: held items, hands & drops | 12.0 | M |
| RAM | Nalati | CPU copies: creatures & NPCs | 6.7 | M |
| RAM | Nalati | CPU copies: buildings, camps & small props | 6.4 | M |
| RAM | Nalati | CPU copies: other props | 6.0 | M |
| RAM | Nalati | CPU copies: rock outcrops | 5.9 | M |
| RAM | Browser & OS | CG raster data (image rasters) | 5.8 | M |
| RAM | Nalati | CPU copies: rocks, stones & dressing | 5.6 | M |
| RAM | Platform | CPU copies: road deck & asphalt | 3.4 | M |
| RAM | Engine & game | other small WASM modules | 2.2 | M |
| RAM | Nalati | CPU copies: grass | 1.9 | M |
| RAM | Platform | CPU copies: open plots (billboards & signs) | 1.5 | M |
| RAM | Platform | CPU copies: far proxies | 1.4 | M |
| RAM | Unknown owner | CPU copies: GL label has no owner | 1.3 | M |
| RAM | Nalati | CPU copies: trees & ground cover | 1.0 | M |
| RAM | Nalati | CPU copies: water & weather | 0.7 | M |
| RAM | Nalati | CPU copies: sky | 0.1 | M |
| RAM | Platform | CPU copies: grid sky & grade | 0.1 | M |
| RAM | Unknown owner | unattributed WebKit malloc + Gigacage pages | 339.4 | U |
| | | **Total** | **1101.0** | |


### Engine base (empty template)

| Side | Owner | What | MB | Conf |
|---|---|---|---:|:---:|
| GPU | Engine & game | render targets & post textures (desktop GL bytes) | 79.7 | M |
| GPU | Engine & game | geometry buffers | 0.8 | M |
| RAM | Browser & OS | blank Safari tab (browser floor) | 46.0 | M |
| RAM | Engine & game | CPU copies of geometry held in JS | 7.0 | M |
| RAM | Unknown owner | engine JS heap, code, WebKit malloc (not split) | 165.0 | U |
| | | **Total** | **298.5** | |

### Empty road after Nalati

| Side | Owner | What | MB | Conf |
|---|---|---|---:|:---:|
| GPU | Engine & game | post-processing targets at 2x | 31.3 | M |
| GPU | Platform | road sign atlas | 22.6 | M |
| GPU | Platform | open plots (billboards & signs) | 19.1 | M |
| GPU | Platform | road deck & asphalt | 16.8 | M |
| GPU | Platform | cell screens | 10.5 | M |
| GPU | Unknown owner | GL label has no owner | 5.7 | M |
| GPU | Platform | road junctions | 5.6 | M |
| GPU | Engine & game | depth targets (likely shadow maps) | 4.2 | M |
| GPU | Engine & game | PMREM environment map | 1.7 | M |
| GPU | Platform | far proxies | 1.5 | M |
| GPU | Platform | grid sky & grade | 0.7 | M |
| GPU | Platform | neighbour template creatures | 0.5 | M |
| RAM | Unknown owner | decoded images still live, no owner traced | 62.3 | E |
| RAM | Browser & OS | system libraries, stacks, malloc | 59.7 | M |
| RAM | Engine & game | Rapier physics WASM heap | 52.2 | M |
| RAM | Engine & game | JS objects & strings (all layers) | 40.3 | E |
| RAM | Browser & OS | JIT machine code (JavaScriptCore) | 39.6 | M |
| RAM | Unknown owner | audio PCM still live after Nalati | 37.9 | E |
| RAM | Engine & game | JS compiled-code metadata (all layers) | 35.5 | E |
| RAM | Engine & game | canvases (screens, maps, paint roots) | 22.9 | E |
| RAM | Browser & OS | WebGL graphics mappings in the tab | 21.1 | M |
| RAM | Browser & OS | CG raster data (image rasters) | 8.5 | M |
| RAM | Platform | CPU copies: road deck & asphalt | 3.4 | M |
| RAM | Engine & game | other small WASM modules | 2.2 | M |
| RAM | Platform | CPU copies: open plots (billboards & signs) | 1.5 | M |
| RAM | Unknown owner | CPU copies: GL label has no owner | 1.3 | M |
| RAM | Platform | CPU copies: far proxies | 1.0 | M |
| RAM | Kit & player | CPU copies: held items, hands & drops | 0.1 | M |
| RAM | Platform | CPU copies: grid sky & grade | 0.1 | M |
| RAM | Unknown owner | unattributed WebKit malloc + Gigacage pages | 423.2 | U |
| | | **Total** | **933.2** | |


