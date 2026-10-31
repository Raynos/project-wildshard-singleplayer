# Wildshard deployment asset trim

**State:** `in progress` 2026-10-31 — G963 item 6, sp-x2: T3 re-audited on `8da7f94de2` (144 texture files retained; no deletion qualified), T4 inventory below (five unselected HDR candidates await HEAD boot/offline/exact-pixel proof). T1 and T2 / DA1 remain done. T5 is closed as measured (G872): no external migration at the documented one-day retention; reopen near 30 days of actual retention. T6 is superseded by immediate exact-green shipping (`419a077b21`) and the current CI3 cohort.

**Historical clean-export baseline (2026-10-29):** 1,375 static files / 524.5 MiB.
The current retained-output measurement is in T5 below.
Largest classes: GPU assets 202.7 MiB, original textures 82.7 MiB,
HDRIs 38.9 MiB, audio 30.6 MiB, source maps 19.2 MiB, video 9.6 MiB.
The Vercel build also creates four API functions. Two are test files under
`api/` (about 6.4 MiB combined) and are not visitor routes.

| Priority | Candidate | Gate before removal | Expected effect |
| --- | --- | --- | --- |
| T1 — done | Move `api/*.test.ts` out of Vercel's function discovery path | 619 tests pass; clean prebuilt output has two real functions; production `/api/inbox` and `/api/errors` each return 401 without credentials | Removed two unnecessary functions from every deployment |
| T2 — done (2026-10-29, sp-x9; G874 / DA1) | Source `97ec95cb7e` / `20f3bfd384` keeps local/CI maps and copies the standalone filter before pin checkout. **Live `dcc2153ac-mvtsyqc1`**, app `dcc2153ac62655a07ecdc7a17e3242c2493dcf50`, is qualified by deployment controller `42a37e95ff9e01b5c12b6133dbe708c3dca6e318` ([release 40914981125](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/40914981125)). | Remote Vercel strip receipt: **268 maps / 52,104,870 bytes**. Download-verified private artifact **12917412136** holds **270 files** (268 maps + exact live version/chunk report), ZIP SHA-256 `dc85faeb67b7fa00f9eb8ca1c1033a58b2bbf87f3f5b019c87ea4333e8f09b6e`, 12,987,948 bytes. Three actual map URLs return **404**; live version and SW core/build/hash match. Exact app [CI 40899627232](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/40899627232) and [SIX 40903043898](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/40903043898) are green. Evidence: `tmp/sp-ci-deploy-hourly-409149-{map-proof,live,artifacts}.json` and completed release log; no duplicate capture. | **52,104,870 fewer public bytes** on the qualified live build; original diagnostic maps remain private and intact |
| T3 — audited, verification open | HEAD `8da7f94de2`: 144 `assets/tex/` files / 86,727,002 bytes; 90 are GPU-source keys, 142 participate in exact tier-generation jobs. Retain all 144; detailed map below. | Reference search includes authored generators and image/phone fallback policy. HEAD desktop/phone boot and offline proof remains pending; **zero assets removed**. | No verified duplicate-original deletion yet |
| T4 — inventoried, verification open | The historical “26 HDRIs” are **26 files: 8 HDR originals + 18 key/gain-map planes**, 40,753,919 bytes. Two MP4s add 10,084,454 bytes. Five unselected raw HDR candidates total 24,173,718 bytes. | Keep all selected skies, all seven Pine time keys, raw selected/bake fallbacks, and both user-facing videos. Omit nothing until the HEAD boot/offline and byte-identical capture gates pass. | Candidate only; no removal or public-byte saving claimed |
| T5 — closed as measured (2026-10-31, G872) | No migration now: 1.700 GB of immutable bulk per output, 99.90% unchanged against retained original app builds | At 24 deploys/day, documented one-day retention models $4.08/month versus $122.41 near 30 days; preserve same-origin precache/offline behavior | No code/hosting change. Reopen if actual retention approaches 30 days; detailed cost and update analysis below |
| T6 — superseded | `419a077b21` (G920) removed the hourly slot, cooldown and local backstop; exact successful proof releases immediately. The later boot/ship merge (`93bd`) makes the successful required verdict the automatic ship trigger. | CI3 closes on its **21/21 automatic post-merge releases within 300 s**; all eight old misses predate the merge. BA78 was manual dispatch, not a queue miss. See [CI-FIRST-PRINCIPLES](CI-FIRST-PRINCIPLES.md), CI3 / retained 32-release classification. | Original hourly-lag work is obsolete; CI2 artifact download/restore remains a separate open row |

The `public/assets/` tree is part of the offline PWA and has content-hash
versioning. Do not blanket-ignore it or remove a raw texture merely because a
KTX2 counterpart exists. Every accepted cut needs a clean-export build, byte
manifest comparison, desktop and mobile visitor flow, offline reload, and
production URL check. E273's hourly prebuilt deploy and one-day Vercel retention
are already the immediate storage controls; this plan targets bytes per release.


## G963 item 6 — current source inventory (2026-10-31)

This is an audit of committed `8da7f94de2`, not the old clean-export size
estimate above. Generated byte/version catalogues show presence, not use.
The search therefore separates them from authored runtime, fallback and bake
references. No asset or runtime bytes changed in this inventory commit.
Grass G963(a), the urgent warm-loading work and first app-reaching constructor
artifact retain priority over the pending shared HEAD preview checks.

### T3: originals, compressed variants and fallback ownership

`loadTexture` in `src/engine/core/assets.ts` first tries the KTX2 path, then
retains its image decode path. `texUrl` and `filePolicy` choose a committed
`_1k.jpg` when available on phone; phone WebP and GPU mapping are additional
selections, not evidence that the original may be deleted. The authored
`scripts/ktx2-engine-map.json` supplies the compressed targets (including
`#layer` aliases). Counts below are files with at least one such source key,
not a claim that the source and compressed bytes are interchangeable.

| Texture set | Files | Source bytes | Files with KTX2 mapping | Files in tier jobs |
| --- | ---: | ---: | ---: | ---: |
| `bark_willow_02` | 6 | 1,628,908 | 6 | 6 |
| `birch_bark` | 6 | 515,671 | 6 | 6 |
| `fir_bark` | 6 | 1,180,593 | 6 | 6 |
| `forest_ground_04` | 8 | 14,448,075 | 0 | 8 |
| `forest_leaves_02` | 7 | 2,609,200 | 0 | 7 |
| `forrest_ground_03` | 9 | 12,301,029 | 6 | 9 |
| `leafy_grass` | 8 | 16,286,441 | 6 | 8 |
| `metasequoia_bark` | 6 | 1,127,046 | 6 | 6 |
| `mossy_rock` | 6 | 1,373,684 | 6 | 6 |
| `pine_bark` | 9 | 3,865,841 | 6 | 9 |
| `pine_tree_01` | 8 | 3,633,289 | 0 | 6 |
| `rock_ground` | 8 | 4,597,665 | 6 | 8 |
| `roof_planks` | 8 | 1,525,119 | 0 | 8 |
| `rough_pine_door` | 8 | 1,980,035 | 6 | 8 |
| `stone_wall` | 9 | 3,624,056 | 6 | 9 |
| `stony_dirt_path` | 8 | 4,788,100 | 6 | 8 |
| `wood_planks_dirt` | 9 | 2,536,008 | 6 | 9 |
| `wood_planks_grey` | 6 | 696,818 | 6 | 6 |
| `wood_trunk_wall` | 9 | 8,009,424 | 6 | 9 |

The exact `textureTierJobs` input/output plan covers 142 files. The remaining
`pine_tree_01/twig_diff.jpg` and `twig_alpha.jpg` are still named by the
Poly Haven fetch recipe and the authored tree folder is retained by Blender
and manifests. That conservative folder match does **not** prove that those
two individual files are current Blender reads (the current pine material
reads `twig_rgba.png`). They remain kept until an independent derivation and
fallback audit proves deletion safe. No “KTX2 exists, therefore delete JPG”
rule is used.

This revisits the real earlier failure: `a7e021f0` deleted 54 originals,
`217e5f8f` restored them, and `154071d0` / `66db342a` retained generator
inputs. The current audit again finds no qualified original deletion.

### T4: HDR and video disposition

| Member / group | Files | Bytes | Disposition |
| --- | ---: | ---: | --- |
| `belfast_sunset_puresky_2k.hdr` | 1 | 4,563,204 | Unselected candidate: fetch recipe + generated presence catalogues only; proof pending |
| `kloofendal_28d_misty_puresky_2k.hdr` | 1 | 4,467,957 | Unselected candidate: fetch recipe + generated presence catalogues only; proof pending |
| `kloofendal_48d_partly_cloudy_puresky_2k.hdr` | 1 | 5,451,493 | Keep: Nalati/Nine declared sky and two Blender weapon inputs; retain raw fallback |
| `kloppenheim_06_puresky_2k.hdr` | 1 | 4,434,394 | Unselected candidate: fetch recipe + generated presence catalogues only; proof pending |
| `qwantani_late_afternoon_puresky_2k.hdr` | 1 | 4,429,634 | Keep: Pine golden-hour key bake input |
| `qwantani_sunset_puresky_2k.hdr` | 1 | 4,171,959 | Keep: Pine selected sky and raw fallback after pair decode failure |
| `rosendal_park_sunset_puresky_2k.hdr` | 1 | 5,049,451 | Unselected candidate: fetch recipe + generated presence catalogues only; proof pending |
| `sunflowers_puresky_2k.hdr` | 1 | 5,658,712 | Unselected candidate: fetch recipe + generated presence catalogues only; proof pending |
| Two selected sky color/gain pairs + seven Pine key pairs | 18 | 2,527,115 | Keep every plane: selected sky / dawn, sunrise, day, golden, sunset, dusk, night |
| `trailer-15.mp4` | 1 | 3,532,948 | Keep: historical public trailer URL; the 30 s copy also remains a Native Apps store-preview input |
| `trailer-30.mp4` | 1 | 6,551,506 | Keep: historical public trailer URL; the 30 s copy also remains a Native Apps store-preview input |

The five unselected candidates are Belfast sunset, Kloofendal misty,
Kloppenheim, Rosendal sunset and Sunflowers. None has an authored selected
sky, time key or Blender target reference on this source. Their fetch recipe
is an output recipe; generated catalogues alone do not establish a runtime
reader. Removal is still **unqualified** until normal HEAD boot/offline and
before/after full-pixel checks complete. Both local public trailers remain;
`site/media.json` separately selects newer Blob-hosted marketing videos.

The required proof remains: one admitted HEAD source; desktop and phone
visitor boot/offline checks for Driftwood, Nalati and Pine; exact captures
before/after any accepted removal; complete emitted-byte comparison; and
root-owned production URL verification after ordinary shipping. A failed or
unavailable preview is not a pass. No new source-mapping, preload, texture,
sky selection, time-of-day or video behavior is authorized by this audit.

### T5: immutable deployment bodies — closed as measured (G872)

**Decision (2026-10-31): no migration now.** At the documented one-day
retention, 24 deployments/day models only **$4.08/month** of bulk
deployment storage. G872 closes this analysis: preserve the existing
same-origin offline path. Reopen if actual retained history approaches
30 days, when the same model reaches **$122.41/month**. The local Vercel
token is invalid, so this audit does not claim account billing, actual
retention, traffic or a paid saving. No code, asset, hosting, retention
or service-worker behavior changed.

#### Measured footprint and stability

The checkout's root `dist/` is from October 1 and was excluded. The
current retained immutable preview is source
`6b9dbd3f40eca5c9389d1f14a9bcd6e6249b1e35`, build
`6b9dbd3-mvwqgdkc`, built October 31 at 18:26:54Z. Its **9,462 files /
2,257,576,057 bytes** include 194 private maps / 43,556,166 bytes.
Excluding those maps leaves **9,268 static files / 2,214,019,891 bytes**;
this local dist inventory is not an observed Vercel invoice or upload.
Committed `public/` at `1f56a01a53719c65d79109e1dc9922e08c0eac50`
contains 2,030 files / 757,100,551 bytes; generated product output makes
the deployment larger than the tracked public tree.

| Immutable body family | Files | Included bytes per output | Bytes identical to retained `82b9` original app A/A |
| --- | ---: | ---: | ---: |
| Texture/boot packs, `assets/packs/` | 148 | 309,529,077 | 309,529,077 |
| GPU textures, `assets/gpu/` | 347 | 298,849,811 | 298,849,811 |
| All shard product `blobs/` | 5,586 | 908,307,188 | 906,589,428 |
| Compiled grid strip bodies/pages | 37 | 183,440,090 | 183,440,090 |
| **Total** | **6,118** | **1,700,126,166** | **1,698,408,406** |

The largest shard blob sets are Pine 268,769,239 bytes, Nine 185,093,709,
Nalati 152,827,592 and Driftwood 111,284,377. The table accounts for
**76.79%** of static output; hypothetical removal leaves 513,893,725
bytes. **99.90%** of its bytes match the earlier two unchanged original
app builds at source `82b90bae0529700c6b71c29447850dbe21b229d5`.
The comparison hashes the actual current bodies against both retained
SHA-256 inventories; same names/sizes alone do not qualify stability.
This proves repeated inclusion across these sources, not that every
historical deployment has identical content. Changed content still needs
its new immutable address. Other stable raw textures, HDRs and source
models remain outside this proposed body set and keep T3/T4's gates.

Vercel already deduplicates unchanged uploads by hash (G872). These
1.700 GB are therefore **logical deployment contents**, not 1.700 GB of
new network uploads on every release. No deploy-time saving is inferred.

#### Cost model

USD list prices checked October 31; decimal GB, before allowances,
credits, taxes and plan-specific rates. Let `N` be retained deployment
copies of this 1.700126166 GB set. Its deployment-storage model is
`$0.10 × 1.700126166 × N` per month. Vercel meters daily project maxima;
aliases/retention exceptions and actual Usage determine the bill.
[Deployment Storage pricing](https://vercel.com/docs/deployment-storage).

| Deployment frequency / assumed retention | Modeled retained copies | Gross bulk storage / month |
| --- | ---: | ---: |
| 4/day × 1 day | 4 | $0.68 |
| 24/day × 1 day | 24 | $4.08 |
| 4/day × 30 days | 120 | $20.40 |
| 24/day × 30 days | 720 | $122.41 |

An external store retains one copy of each unique body, plus changed
versions still needed by clients. For one unchanged 1.700 GB set:

| Service | Gross storage / month | Transfer and requests |
| --- | ---: | --- |
| Vercel deployment output | $0.1700 × `N` | Example US pay-as-you-go CDN: $0.15/GB + $2/million requests; flat-rate CDN can replace those charges |
| Public Vercel Blob | $0.0391 | Example US: $0.05/GB, $0.06/GB origin misses, $2/million CDN requests, $0.40/million simple misses; writes $5/million |
| R2 Standard with custom-domain CDN | $0.0255 before free tier | No R2 byte-egress charge; $4.50/million writes and $0.36/million origin reads, with rounding and free-tier rules |

Sources: [Vercel CDN](https://vercel.com/docs/manage-cdn-usage),
[Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/).
R2 includes 10 GB-month, one million writes and ten million reads if
those team allowances remain available. Its production CDN requires a
custom domain and an appropriate cache rule; `r2.dev` is not that route.
[R2 public delivery](https://developers.cloudflare.com/r2/buckets/public-buckets/).

For illustration, **100 GB/month actually delivered**, one million
requests and 10% origin misses model $17.00 in Vercel pay-as-you-go
delivery versus $7.64 in Blob delivery, before storage/allowances.
R2 has zero byte-egress cost and this example fits its stated free
storage/operation quantities if unused. These are workload scenarios,
not measured visitor traffic. Existing browser caches already reuse
unchanged URLs, so a deployment does not make each player download the
whole corpus. Proxying external bodies through Vercel also retains its
delivery charges and may add upstream charges; it is not the direct-CDN
cost model.

#### Offline and update implications

The emitted worker precaches 337 immutable assets / 211,263,288 bytes
and 25 shell files / 2,469,579 bytes in this preview. All 37 grid-strip
files / **183,440,090 bytes** are in that install list. The other bulk
families are fetched on demand and kept by immutable URL; deployment
presence does not mean all 1.700 GB are installed on first visit.

`src/engine/pwa/sw.js` declines cross-origin fetches. Its precache and
`bootCache.ts` publication use same-origin absolute cache keys;
`texturePack.ts` also keeps cross-origin reads off its optimized path.
A URL rewrite alone would therefore lose today's cached offline reads
and grid precache. Direct delivery would need explicit CORS, readable
responses rather than opaque bodies, unchanged content/length/range/MIME
contracts, and consistent cache keys across every reader. None is built
or qualified here.

Any later migration must publish and verify immutable objects **before**
the exact app referencing them becomes eligible, never replace an
existing hash, and retain objects needed by running/previous builds,
offline clients and rollback. A new worker must finish its required
precache before becoming a complete generation; current explicit
title/fresh-document adoption must not replace a running game's worker.
Tests must include offline re-entry and update/rollback with old cached
bodies as well as cold CORS/range reads. External garbage collection
cannot simply follow a one-day deployment-retention policy.

**Result:** external storage has lower unit cost, but the documented
one-day storage saving is too small to justify changing this offline
contract now. T5 is closed as measured, with the 30-day actual-retention
condition above as its reopening trigger.

Local evidence: `tmp/sp-x6-asset-trim-t5/{measurement,inventory,precache}.json`;
normal immutable preview `tmp/serve/20261031-132517-4402/dist`;
prior original-app comparison
`tmp/sp-x9-ci9-app-89/{aa-files,aa-comparison,aa-legs}.json`.
No new build, browser, CI fetch, deploy or hosting operation was run.
