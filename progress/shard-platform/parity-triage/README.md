# Parity triage: every red field since the bfb9dc325 baselines, classified (SHARD-PLATFORM, E435)

`scripts/parity.mjs` was red on all seven shards against the SF62 baselines (`cea89b855`, content pin `bfb9dc325`):
the push-run gpu-gate on `8e2c090ec` failed every shard job, and the lanes reported Sky Reach, Driftwood and Nalati reds
locally. This row found the cause of every red field, re-recorded the baselines whose changes are all intended, and left
one regression (Signal Dunes) red for its lane.

**Method.** Each red field was read from the CI compare artifacts (gh-macos15 phone, run 37854019246) and from the M5
records below. Every pose SSIM diff image was read. A boot census (`census.mjs`: the parity harness's own init,
Developer fixture and labelled WebGL census, plus every mesh's parent chain, geometry, material and each program's
compiled source) was taken on the baseline build (`bfb9dc325`) and on `5b86b0eb8` (= `8664edaed` + a plan edit), and
diffed with `cdiff.mjs`. Full diffs: `census-diff.txt`.

## Causes

| Red field(s) | Shards / tiers | Cause | Class |
|---|---|---|---|
| `render.memory.textures` −1, `gpuBytes.textures` −16.6 MB phone (−64.7 MB desktop on the template / Sky Reach; −80 MB Driftwood, −48 MB Nalati desktop), Driftwood `renderbuffers` 10.9 → 5.6 MB | every engine-chain shard, both tiers | `1f84c55dc` SF22d / E451: the Memory saver defaults **on** in Developer, and parity boots with Developer on. Its no-look cuts: shadow maps keep only their depth (the 512² / 1024² / 2048² colour targets go), bloom's luminance pass at half resolution (780×1688 → 390×844 RGBA16F, −7.5 MB phone), no depth buffer on the composer's output (the second `EffectComposer.Buffer/depth`, −5.0 MB) | intended (look unchanged: every pose diff is black outside the minimap) |
| Nalati `scene.totals.mesh` −1, `scene.named` (`kurgan-dungeon/kurgan-interior` absent) | Nalati, both tiers | `0690fca6a` G227: under the Memory saver the hidden kurgan interior's static mesh (12.0 MB of arrays) is built on first entry, behind the entry fade; its collision, movables, FX and boss stay at boot. The interior is invisible outside, so no boot pixel changes | intended (memory win, saver now on per `1f84c55dc`) |
| Pose SSIM 0.97–0.989 (Sky Reach spawn / hover, Nine Dragon ×3, Pine gate / cabin, Nalati camp, template current) | all shards' poses | The minimap: `33a6568ce` SF66 draws each shard's baked map image (G246 / G247), `edad5463d` G252 the stylized B colour table, `d72df5e3b` G252b Sky Reach islands-and-bridges only. The diff images are black everywhere but the minimap disc (`minimap-*.jpg`) | intended (Jake's picks) |
| Sky Reach `gpuBytes.textures` 258.1 → 167.4 MB phone | Sky Reach phone | `b49135480` G253: KTX2 on the phone (the 22 HD atlases 5.33 → 1.33 MB each), plus the saver cuts above. The 78 vs 79 texture count is the saver's dropped shadow colour target, not G253 | intended (Jake's pick + saver) |
| Template `scene.totals.mesh` 170 → 180, `programs` 34 → 35, `programKeys` | template, both tiers | `8f1918525` E459: the platform hoverboard is restored for shardfiles; its 10 viewmodel meshes (deck box, three extrusions, two thrusters with glow discs) and one basic program are built at boot | intended (Jake's ask E459) |
| Template current pose: the held item lighter | template | `c8edefe20` E460: declared kit items glow half their colour so they no longer draw black on the neutral look (`template-held-item-phone.jpg`) | intended (bug fix Jake reported) |
| Nalati `programKeys` (98 programs, same count) | Nalati, both tiers | `53bf5acab` SF63 (G232): the three grass-v2 programs read the camera in the grass's own frame (`cameraPosition - modelMatrix[3].xyz`; zero offset standalone) so the grass draws in its grid cell | intended (G232 pick; standalone-identical by construction) |
| Driftwood mesh +1, geometries +1, buffers +7.5 KB, calls +1–2 / tris +80–168 at the poses, `scene.named` (pier set) | Driftwood, both tiers | `d8bfef811` SF46: the east jetty ramps onto the sand within its authored 72 m (it ended in a 1.9 m wall), coordinator-approved traversal fix; its landing joins the merged pier set and its end pieces at x ≈ 153 sit 0.1 m lower | intended |
| Driftwood desktop `combat.sounds.ambient` loses `island.bird` | Driftwood desktop | Not a lost system: the bird call is scheduled every 2.5–8.5 s from the seeded `Math.random`, and the boot changes above shift that sequence, so no call lands in the combat window on desktop (identical in all three runs; drip and swell still play) | intended (timing) |
| Pine textures −19.5 MB phone (−1 texture), −75.9 MB desktop (−3) | Pine, both tiers | The saver cuts (−16.6 MB phone), plus one duplicate `rock_ground` KTX2 pair (diffuse + normal, −2.7 MB) now shared (the SF57 compressed-upload / G226 cache series, `c11843d1e`…`cc2371ac6`, not bisected further). Desktop was not censused; its −3 textures match the saver's desktop shadow colour targets as on the other shards. Pine's poses match bar the minimap | intended (memory win) |
| **Signal Dunes**: colliders 147 → 146, mesh −1, programs −1, textures −2 (−22.9 MB), `registry` (`sunscar.caravan` cuboids 4 → 3), `systems.update` + `sunscar.ray` | Signal Dunes | **Regression.** The pack horse (`horse-hd`, E399 mockup B) is no longer drawn at the caravan and its collider is gone; the page logs `[sunscar-dunes] brazier-hd not loaded, the flat model stands in: Error: Runtime cache coverage exceeds its measured bytes` (`src/game/grid/allocator.ts` `validateCoverage`). `83303a5d0` SF50 puts the Dunes HD model caches under `retainCachedResources` / `cacheUntilDisposed` and `291a34d8d` SF50 sets its measured runtime bound; the covered HD caches now exceed it, so HD loads are refused. `sunscar.ray` is SF50-p's runtime binds (`e9c0c5945` / `0f30825c9`) | **regression, not re-recorded** (SF50 lane) |

Nine Dragon's reds (textures −1 / −9.5 MB, three pose SSIMs) are the saver and minimap rows above; it is re-recorded too.

## Re-recorded

- **M5** (phone + desktop, three full-profile runs each, all green and self-consistent), content pin `ca969df25`
  (= `8664edaed` + `27e5df235`'s three-line format-admission schema change + docs), served from the parity build cache:
  `node scripts/parity.mjs --record --runs=3 --lane=m5 --shards=<slug> --tiers=phone,desktop --url=<preview of the cached
  ca969df25 tree> --retry=0 --timeout=400`. `--url`, because `vite preview`'s 30 s start deadline in `serve.mjs` timed out
  three times at a machine load of 45–54. Driftwood, Sky Reach, the template, Nalati, Pine, Nine Dragon.
- **gh-macos15** (phone): gpu-gate record dispatch [37857687729](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37857687729)
  on `8664edaed` (all seven jobs green); the six artifacts above are committed unchanged. Signal Dunes keeps its old
  baselines on both lanes, so its gate stays red until the horse is back.

Every changed field between the old and new baselines is in the table above (`m5fields.mjs`-style compare of each old
baseline against its replacement: no other field moved).

## After the pin: 80955492f and a04ac6e7b against the new baselines

`parity.mjs --lane=m5 --url=<served build> --tiers=phone,desktop --retry=1` (fixtures = the new baselines):

| Build | Green | Red (cause) |
|---|---|---|
| `80955492f` | Sky Reach, template, Nalati (both tiers) | Driftwood: `boot.saves.read` / `combat.loot.written` gain `wildshard.save.v2.profile` (`3e995e5a2` SF46-p binds). Pine: the same two plus `boot.saves.written` gains `pine-hollow` (`627c5edaf` SF47-p binds). Port-lane changes, for their owners to confirm and re-record |
| `a04ac6e7b` (has `9b8885ad9` SF67 geometry table) | Nalati (both tiers) | Driftwood: the same saves fields (`3e995e5a2`), and desktop `combat.sounds.ambient` reads `bird, drip` (the scheduler timing row above, moved again by later RNG consumers). **Nothing attributable to `9b8885ad9`** |

`bakediag.mjs` (phone, muted, Developer on), each engine with `geometry.bin` served and with it blocked (the code path):
both Chromium and WebKit fetch the table (HTTP 200) with no page errors. Driftwood's drawn mesh positions hash
identically in all four runs (518 meshes, 31,283,527 vertices, `e438db01`), so the table's geometry is byte-identical
to the built geometry in both browsers. Nalati's whole-scene hash is not stable run to run (its sand drifts and herd
rewrite position arrays), so it does not decide; its parity is green. The hit count itself is not observable from the
page (`geometryBakeStats` is not exposed), and the props step time does not separate the two (Driftwood 1,059 vs
1,077 ms Chromium).
