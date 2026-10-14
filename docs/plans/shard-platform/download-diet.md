# Download diet after the waves

G412 permits approved per-shard raises while preserving quality, immutable
caching, fast load/travel and the unchanged memory envelopes. These are
later diet items, not permission to lower texture quality.

| Shard | Closure | Default | Allowance | Wire | Decision | Follow-up |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Sky Reach | Nine tiling-map library files | 8,000,000 B | 8,811,813 B | 8,811,813 B | G411/G412 | Reduce losslessly after the waves; keep panoramas excluded |
| Sky Reach | Baked meadow blades (`baked/851f80fb000e621ab1b6e22edd9a9ac7fbcb6ecfeda1047a86f3f919d779e33f.bin`, replaces the 696,929 B `sward-atlas.bin`) | — | — | 1,431,607 B (+734,678 B net) | G412 | Hash-named immutable URL; clipped to the drawn island rims (sp-o166); pack planar or delta-coded after the waves (raw 1.74 MB, 216,908 blades × 8 B) |

| Pine Hollow | Held weapon geometry pool (`baked/f2082acfcfb9c9bdce0a6af1745f44de33d38c89ed6fd261f5d6dc346ec46159.glb`) | — | — | 542,748 B (+542,748 B net) | G412 | Hash-named immutable URL; second visit must transfer 0 bytes; pack losslessly after the waves |
| Driftwood Isle | Held weapon geometry pool (`baked/c00e6ad0f0384c1208d5b56a125f21793bd209ed59cfce9acd9e65c96a5bc981.glb`) | — | — | 178,680 B (+178,680 B net) | G412 | Hash-named immutable URL; second visit must transfer 0 bytes; pack losslessly after the waves |
| Pine Hollow | Baked first-person hands and Longbow parts (`baked/9500ccf884a8bf642237d00c950f96c6aa81e6b06307d7f517adf0c7e4ae5020.glb`, a pool of the held library; replaces the geometry the kit built at runtime) | — | — | 2,867,736 B raw, ~1.49 MB gzip (+ net) | G412 | Hash-named immutable URL (sp-o190); second visit must transfer 0 bytes; the two rider sleeves are simplified in the bake to ~7.3 k vertices each (sp-o194, from 19.6 k / 18.9 k: −1,168,484 B raw, −0.91 MB gzip, −1,168,460 B resident geometry) |
| Pine Hollow | Baked trophy-wall mounts (`baked/trophies-ae6b7a974ecd.bin`, zlib geometry pack of the six shields + heads from the phone rigs; replaces the runtime neck clip and coat readback, the same 29,076 resident vertices, fetched only while a mount is taken and not kept) | — | — | 247,332 B (+247,332 B net) | G412 | Hash-named immutable URL (sp-o191); second visit must transfer 0 bytes |

The ordinary SF66 packer adds the existing 23,404-byte map raster to the
compiled library, giving 10 files / 8,835,217 B. It charges that same
compiler-owned wire to the explicit allowance, exactly once; the nine-map
authored allowance stays 8,811,813 B. Other shards retain the 8 MB default.

| Pine Hollow | Fitted bird poses (`life/birds-rest-08c7c2580ed1056d4b2e4b71d61cca4381820ce4546736e836812b8ab6cd9bd3.glb` + `.phone.glb`) | — | — | 251,300 B per tier (+246,398 B net, replaces birds.json) | W2 wildlife | Ensemble hash covers both tiers; unchanged original GLB lends its selected compressed atlas, fitted intake is released after packing |
| Driftwood Isle | Lofted creature bodies (`driftwood-isle/creatures/bodies-23550b30c9b851af6d594dcc1108ec44091cecfe04e8cc6d781f97d808fce79c.bin`, deflated) | — | — | 44,819 B (+13,031 B net: the 31,788 B `sailor-head.glb` is no longer fetched) | W2 C4 | Crab, monkey and sailor bodies baked offline, bit-exact after the page faceting; resident keeps the deflated file (44,819 B) instead of the parsed head (85,320 B) |

| Driftwood Isle | Cropped full cover grid, hash-named `baked/island-cover-<sha256>.bin` (replaces the area-only fixed-name overlay) | — | — | Phone 192,016 B raw / 88,640 B gzip (+53,067 B gzip); desktop 192,016 B raw / 89,587 B gzip (+53,467 B gzip) | W2 cover-grid call | Lossless all-zero perimeter omission, same 4 m lattice and Float32 channels; immutable URL + force-cache and SHA admission. Borrowed cover storage 317,520 → 192,016 B steady per tier (−125,504 B), plus 9,107 B raw / 1,888 B gzip clipping facts. No GLBs; compress or pack the grid losslessly after the waves. |

| Driftwood Isle | Compacted owned hibiscus | Hash-named immutable world batch: phone 5,002,936 B raw / 1,453,238 B gzip; desktop 14,610,208 / 4,146,100 B. Optional three Explorer variants add 168,160 / 52,526 B (phone), 285,388 / 86,494 B (desktop). Cheap island-dressing job builds all files; no output committed. Original native materials, wind and picking boxes retained; no world template cache. | Phone in-page CPU buffers 2,607,456 → 1,363,320 B; GPU 8,348,832 → 4,998,840 B; combined −4,594,128 B. Original copy-box storage unchanged. Discarded cove triangles are absent from every live vertex channel. |
