# Download diet after the waves

G412 permits approved per-shard raises while preserving quality, immutable
caching, fast load/travel and the unchanged memory envelopes. These are
later diet items, not permission to lower texture quality.

| Shard | Closure | Default | Allowance | Wire | Decision | Follow-up |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Sky Reach | Nine tiling-map library files | 8,000,000 B | 8,811,813 B | 8,811,813 B | G411/G412 | Reduce losslessly after the waves; keep panoramas excluded |
| Sky Reach | Baked meadow blades (`baked/851f80fb000e621ab1b6e22edd9a9ac7fbcb6ecfeda1047a86f3f919d779e33f.bin`, replaces the 696,929 B `sward-atlas.bin`) | — | — | 1,431,607 B (+734,678 B net) | G412 | Hash-named immutable URL; clipped to the drawn island rims (sp-o166); pack planar or delta-coded after the waves (raw 1.74 MB, 216,908 blades × 8 B) |

| Pine Hollow | Held weapon geometry pool (`baked/f2082acfcfb9c9bdce0a6af1745f44de33d38c89ed6fd261f5d6dc346ec46159.glb`) | — | — | 542,748 B (+542,748 B net) | G412 | Hash-named immutable URL; second visit must transfer 0 bytes; pack losslessly after the waves |
| Pine Hollow | Rifle cartridges and sight bead (`baked/621ad7aae8c997f8249f86d55d90a4faa95c9d1aba612d7c51837d34908beb52.glb`) | — | — | 62,596 B raw (+ net) | G412 | Hash-named immutable model-library pool; replaces runtime detail geometry; no fallback rifle |
| Pine Hollow | Baked first-person hands and Longbow parts (`baked/9500ccf884a8bf642237d00c950f96c6aa81e6b06307d7f517adf0c7e4ae5020.glb`, a pool of the held library; replaces the geometry the kit built at runtime) | — | — | 2,867,736 B raw, ~1.49 MB gzip (+ net) | G412 | Hash-named immutable URL (sp-o190); second visit must transfer 0 bytes; the two rider sleeves are simplified in the bake to ~7.3 k vertices each (sp-o194, from 19.6 k / 18.9 k: −1,168,484 B raw, −0.91 MB gzip, −1,168,460 B resident geometry) |
| Pine Hollow | Baked trophy-wall mounts (`baked/trophies-ae6b7a974ecd.bin`, zlib geometry pack of the six shields + heads from the phone rigs; replaces the runtime neck clip and coat readback, the same 29,076 resident vertices, fetched only while a mount is taken and not kept) | — | — | 247,332 B (+247,332 B net) | G412 | Hash-named immutable URL (sp-o191); second visit must transfer 0 bytes |
| Pine Hollow | Baked Antler King kit (`baked/3d9b5fc17c7ac3e7fe148f4333b2ea62e2e9bf5999d89eea7f2ef0abf65e8220.glb`, a rest-geometry pool: the lantern frame and glass, the ribcage and its core; replaces the geometry `makeKingKit` built at boot and the skull plate it built unused) | — | — | 123,000 B raw, 15,218 B gzip (+ net) | G412 | Hash-named immutable URL (sp-o208); second visit must transfer 0 bytes; resident geometry 135,920 B built → 123,000 B pool (−12,920 B) |

The ordinary SF66 packer adds the existing 23,404-byte map raster to the
compiled library, giving 10 files / 8,835,217 B. It charges that same
compiler-owned wire to the explicit allowance, exactly once; the nine-map
authored allowance stays 8,811,813 B. Other shards retain the 8 MB default.

| Pine Hollow | Fitted bird poses (`life/birds-rest-08c7c2580ed1056d4b2e4b71d61cca4381820ce4546736e836812b8ab6cd9bd3.glb` + `.phone.glb`) | — | — | 251,300 B per tier (+246,398 B net, replaces birds.json) | W2 wildlife | Ensemble hash covers both tiers; unchanged original GLB lends its selected compressed atlas, fitted intake is released after packing |
| Driftwood Isle | Lofted creature bodies (`driftwood-isle/creatures/bodies-3cc97fab831593ffccebd201f84adcafc9bb5f25caed70db4fe8ee029148dcc2.bin`, deflated; replaces `bodies-23550b30…`) | — | — | 75,942 B (+31,123 B over the 44,819 B file it replaces; +13,031 B before that, the 31,788 B `sailor-head.glb` no longer fetched) | W2 C4 | Crab, monkey, sailor and (sp-o212) every boar and bear coat baked offline, bit-exact after the page faceting; each identical attribute block stored once. Resident keeps the deflated file (75,942 B; was 44,819 B, the parsed head 85,320 B before that); the boar and bear models are unchanged, no longer lofted on the page |

| Driftwood Isle | Cropped full cover grid, hash-named `baked/island-cover-<sha256>.bin` (replaces the area-only fixed-name overlay) | — | — | Phone 192,016 B raw / 88,640 B gzip (+53,067 B gzip); desktop 192,016 B raw / 89,587 B gzip (+53,467 B gzip) | W2 cover-grid call | Lossless all-zero perimeter omission, same 4 m lattice and Float32 channels; immutable URL + force-cache and SHA admission. Borrowed cover storage 317,520 → 192,016 B steady per tier (−125,504 B), plus 9,107 B raw / 1,888 B gzip clipping facts. No GLBs; compress or pack the grid losslessly after the waves. |

| Driftwood Isle | Compacted owned hibiscus | Hash-named immutable world batch: phone 5,002,936 B raw / 1,453,238 B gzip; desktop 14,610,208 / 4,146,100 B. Optional three Explorer variants add 168,160 / 52,526 B (phone), 285,388 / 86,494 B (desktop). Cheap island-dressing job builds all files; no output committed. Original native materials, wind and picking boxes retained; no world template cache. | Phone in-page CPU buffers 2,607,456 → 1,363,320 B; GPU 8,348,832 → 4,998,840 B; combined −4,594,128 B. Original copy-box storage unchanged. Discarded cove triangles are absent from every live vertex channel. |

| Driftwood Isle | Trail Explorer rest shapes | Six hash-named immutable GLBs: post 9,548 / 2,841 B raw/gzip; two-arrow sign 38,632 / 10,926 B; one-arrow 20,772 / 6,222 B; three-arrow 64,844 / 18,241 B; light/dark steps each 1,768 / 778 B. Total 137,332 / 39,786 B, but only the selected card loads. Cheap trail-specimens author job; outputs stay out of Git. | World weld, download and native buffers unchanged. Explorer intake transfers sole geometry ownership; no retained template/copy pair. |

| Driftwood Isle | Compacted owned palms | Phone world 5,076,592 B raw / 833,373 B gzip; desktop 7,774,168 / 1,235,101. Optional tall/young/leaning Explorer GLBs: phone 119,792 / 22,499, desktop 143,988 / 26,211. | Hash-named immutable G405 build outputs; one owned world batch replaces runtime arrays and retained clip indices. In-page phone batch CPU backing 3,572,784 -> 1,901,880 B; GPU buffers 8,470,824 -> 5,071,680 B (combined -5,070,048 B). Shadow views share those attributes; original full-copy boxes, native trunk capsules, lit/depth wind and paint retained. |

| Driftwood Isle | Static dune logs | One admitted lossless GLB adds 637,484 B raw / 206,334 B gzip-9 (compression estimate, not an observed HTTP encoding). All prior admitted assets unchanged. Existing fixed-model writer uses compact indices/native channels; it offers no meshopt or quantisation switch. Cheap build output, not a new Git blob. | Replaces live dune sculpt/scatter. 146 placements and boxes unchanged; 533,952 B of source geometry transferred, no retained template. Clipped live mesh and walk checked against the parent. |

| Driftwood Isle | Owned lagoon reef geometry | One tier-independent world batch `baked/reef-2485e399….bin` 1,980,400 B raw / 379,293 B gzip-9 (the native position/color/sway channels, 1,971,744 B, plus the original 360 per-copy boxes and header). Eleven optional coral/weed/starfish Explorer GLBs 60,924 B raw / 17,586 B gzip; only the selected card loads. Cheap driftwood-reef author job; outputs stay out of Git. | Hash-named immutable URL + force-cache and SHA admission. Replaces the runtime build-and-weld of 360 copies one to one (same vertices, colours, sway, boxes, placements); graph material, sway and the fish school unchanged. Owned separate channels, no template plus clone. In-page phone post-GC (matched parent d8b780f / candidate 918a05e, reef and posts together): drawn reef and post position bytes identical; colour/sway CPU copies released after upload in both; scene geometry CPU 690,281,992 B and GPU 1,049,395,457 B unchanged; JS heap + ArrayBuffer backing 226,407,755 -> 226,053,876 B (-353,879 B). |

| Driftwood Isle | Rope bridge anchor posts | Two fixed-model templates (island span, Explorer span) add two admitted product subsets 10,032 / 3,530 B and 10,044 / 3,479 B raw / gzip-9 (20,076 / 7,009 B). Cheap fixed-model build output, not a Git blob. | Replaces the runtime post cylinders, paint and merge; colliders, rest facts, deck chain, planks and ropes unchanged. Each built bridge takes a 6,912 B copy of its template (the SF63 rebuild needs one); the two retained templates are 13,824 B. Measured with the reef bake (see its row). Physics walk on the candidate: 8 legs, 0 stuck, bridge leg ends at y 12.289. |

| Driftwood Isle | Authored palm/hibiscus placement rows (phone + desktop, generated JSON bundled with world construction) | — | — | 263,956 B raw / 91,573 B gzip-9 estimate | W2 foliage placement call | No new geometry; phone 204 palms + 170 bushes, desktop 255 + 260. Original site, transform, params and registry order unchanged (max numeric delta 0); existing 18 geometry/cover files unchanged. Replaces live scatter/height sampling and unused synchronous bush construction. |

- 2026-10-15 DW rocks: cold author table replaces the existing geometry.bin,
  2,039,324 → 1,962,412 B raw (−76,912), gzip9 1,382,013 → 1,329,869 B
  (−52,144). The 509 live recipes and RNG continuations are exact; 17
  obsolete records leave and 9 exact Explorer recipes join. No new world
  request or retained template; Explorer borrows/releases the table. The
  cheap registered producer regenerates it from source, not a Git blob.

| Pine Hollow | Cabin prop geometry in the existing props library (`d5fea0cf…`) | — | — | 1,309,752 B library, plus material-only hash-named glTFs | G434 | Cheap regenerated build outputs, no binary Git blobs. Replaces live cabin scan merging; original materials, doors and floors retained. Approved end-of-plan memory item: +1.47 MB GPU / +1.31 MB RAM. |

- 2026-10-15 DW piers (G434): 11 regenerated source meshes replace live
  sculpting for 4 world sites and 3 Explorer variants. Added authored
  assets: 5,458,192 B raw / 1,553,406 B gzip9; no Git binary blobs.
  Source geometry templates total 4,186,944 B. Historical measured
  resident +6.58 MB (11.51 -> 18.09 MB), approved for the end-of-plan
  memory pass; current file admission adds 9,646,676 B decoded+GPU
  accounting. Original deck material, pennant sway and colliders stay.

| Pine Hollow | Offline NPC skins (ranger/trader/miller, immutable SHA256 names) | Desktop 1,511,556 B / phone 1,030,920 B, in addition to the existing tier-aware material GLBs. Cheap SDK skinnedGlb outputs, not Git binaries. Original tier-aware colour/normal files remain material loans. | Runtime hull fitting and its source geometry retire; only the same fitted vertex/weight channels remain, with native legBones/legPose and shared PBR material loans. Phone geometry RAM 2,719,420 → 1,688,712 B (−1,030,708), desktop 4,120,334 → 2,552,274 B (−1,568,060); drawn geometry GPU bytes and tier-aware maps unchanged. No runtime fitting fallback. |

- 2026-10-15 DW Wendell head: replace the runtime source GLB loader,
  cache and neck/AO fitting with the registered cheap fixed-model bake.
  Original source 35,372 B raw / 28,368 B gzip9 is author-only; the
  admitted fitted head is 114,984 B raw / 37,814 B gzip9 (+9,446 B
  gzip). World and Explorer borrow one prepared library entry; no
  second runtime source GLB. Geometry attributes and materials stay
  unchanged; no binary Git blobs.

- 2026-10-15 Pine painted textures (sp-o236): the log ends' grain, the
  lamps' glow, the coat's three canvas maps and the trophy wall's chalk
  atlas are baked by the `pine-painted` job into
  `public/assets/pine-hollow/painted/<name>-<sha256>` instead of painted
  on a canvas at every launch. Downloads add 258,616 B (chalk WebP
  157,720; coat normal 38,658, ARM 14,294, albedo 11,470 PNG; end grain
  WebP 23,072; glow PNG 13,402) and drop the 80,232 B `journal/chalk.webp`
  and the hand font from the wall's path: net +178,384 B. The chalk atlas
  holds each outline once (1024 x 512, was a 1024 x 640 canvas), so its
  GPU texture shrinks; the other maps keep their size. Uncompressed as
  before (the painters made RGBA8 textures). No runtime painter remains.

| Driftwood Isle | Authored Blender-cove placement plans (immutable per-tier JSON; no new geometry) | — | — | Phone 666,785 B raw / 400,547 B gzip-9; desktop 874,449 B raw / 537,717 B gzip-9 | W2 cove-plan call | Existing placement indices plus exact Float32 picking boxes; same 400 small-rock poses, ordered 16 model families and 200 collider claims. Parsed sidecar and decode buffers are released after placement; no retained template or second world payload. |

| Pine Hollow | Authored tree rest geometry | Hash-named immutable `baked/trees-9c39e53e….glb`: 2,702,644 B raw, replaces 1,422,848 B quantized trees.glb (+1,279,796 B). Gzip-9 estimate 1,676,163 B versus 833,763 B. G438 approves the download increase. Cheap pine-tree-rest job; no new binary committed. | All 84 original part channels, indices, bounds and shader wind/bark values retained; ModelLibrary borrows decoded attributes without a template/clone pair. Existing graph materials, tree placement, LODs and colliders unchanged. |

| Driftwood Isle | Baked faceted ground (sp-o239) | Two hash-named G405 build outputs: the grid `baked/ground-239a2c11….glb` 2,354,140 B raw / 1,020,486 B gzip-9 and the slab walls `baked/ground-c1b1903f….glb` 130,212 B raw / 30,850 B gzip-9 (+2,484,352 B raw). Cheap driftwood-faceted-ground author job; outputs stay out of Git. | Replaces the runtime build of the 256² grid, its paint and the slab walls one to one: in-page terrain position / colour / clipped index and slab bytes hash equal to the parent's (98753efbc); programs 113 -> 113. Colours ride as float (GLB), index u16. Download is not a hold reason (G438). |

- 2026-10-15 DW captain: the existing cheap creature-body producer now
  emits the original fitted mesh, rigid skin channels and eye spheres.
  Body bundle 75,942 → 352,334 B deflated (+276,392 B); HTTP gzip-9
  estimate 70,738 → 344,899 B (+274,161 B). The existing captain GLB
  remains the original texture loan; materials, fight and animation stay.
  No Git binary blob, runtime fitting or procedural geometry fallback.


- 2026-10-15 DW zipline: the cheap `driftwood-zipline` producer replaces
  the launch/cable/trolley sculpt with hash-named unquantized GLBs. The
  world and its cold Explorer card preload four draws together:
  232,084 B raw / 77,761 B gzip-9 (116,040 / 38,644 for the world
  rig+trolley; 116,044 / 39,117 for the specimen+parked trolley). No Git binary is added.
  All 12 geometry channels (204,768 B) match the original builders;
  classic materials, cable endpoints, colliders and ride law stay.

| Driftwood Isle | Baked sea grid and floor (sp-o240) | Three hash-named G405 build outputs: the phone grid `baked/ocean-e29cd70d….glb` 1,563,904 B raw / 491,313 B gzip-9, the desktop grid `baked/ocean-93422f68….glb` 3,315,552 / 1,059,449 B (one per tier) and the sea floor heights `baked/ocean-4594171d….bin` 524,288 / 395,048 B (both tiers). Cheap driftwood-ocean author job; outputs stay out of Git. | Replaces the runtime build of the coarsening sea grid (positions, aDepth, aSeed, index) and the 512² floor heights one to one; the foam-ring G channel stays runtime (it reads the placed colliders). Download is not a hold reason (G438). |

- 2026-10-16 P2b Driftwood blob-source prerequisite: the existing fixed,
  reef, ground, foliage/cover and zipline producers also emit 119 unique
  named author inputs (64,124,496 B raw). Every input matches its existing
  public payload byte for byte. Five build-only name/source manifests total
  34,358 B raw / 7,270 B gzip; equal reef variants share one logical name.
  These cached G405 outputs are not Git binaries. This prerequisite changes
  no runtime consumer or shipped download; the W2b consumer switch records
  the published blob inventory separately.
