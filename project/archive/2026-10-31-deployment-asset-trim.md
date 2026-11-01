# Wildshard deployment asset trim

**State:** `done`, archived 2026-10-31. T1/T2 done; T3 removes only two unused twig JPGs (706,138 B), with 8 fresh A/A and 8 A/B comparisons pixel-exact; T4 removes five unused HDRs (24,173,718 B), 18 A/B exact and controlled-warm offline 6/6. The pre-existing first-uncontrolled selected-asset failures remain D211. T4 production URL/manifest qualification passed on bound live `99d9ff2-mvx38gn3`. T5 is the measured **no migration** decision; T6 is superseded. No row remains open.

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
| T3 — done (2026-10-31, sp-x9) | `8fa1be30ec` removes only `pine_tree_01/twig_diff.jpg` and `twig_alpha.jpg` plus their two fetch-output keys: 706,138 bytes. Keep the other 142 textures / 86,020,864 bytes and all 12 tree model/atlas bodies exact. | Trace the exact Pine Blender reader (RGBA / normal / ARM, alpha from PNG), not its conservative folder input declaration. Full tier job plan unchanged. Phone/desktop Pine two forest views + Nalati/Nine P1: 8 fresh A/A and 8 A/B comparisons, every pixel exact, 18 guarded boots. | Two unused originals removed; every selected image and fallback retained. No KTX2-based original deletion or whole-output byte attribution |
| T4 — done (2026-10-31, sp-x9; G872 scope) | `50ea8a75f9` removes five unselected raw HDRs / 24,173,718 bytes and their download recipes. All 25 protected bodies stayed exact through T4 (its two kept twigs are subsequently retired separately by T3). | `629` before: 36 captures / 18 A/A, zero pixels; `1aeb` after: 18 strict online A/B, zero pixels and eight visitor boots. Controlled-warm offline 6/6. True pre-removal `929d759` has the same uncached selected-sky asset failures on a first uncontrolled visit, though native offline entry passes; D211 retains that distinction. | Five source bodies removed; bound live `99d9ff2-mvx38gn3` qualifies their actual 404s and manifest absence. No sole-leaf whole-output byte saving or first-visit offline cure claimed |
| T5 — closed as measured (2026-10-31, G872) | No migration now: 1.700 GB of immutable bulk per output, 99.90% unchanged against retained original app builds | At 24 deploys/day, documented one-day retention models $4.08/month versus $122.41 near 30 days; preserve same-origin precache/offline behavior | No code/hosting change. Reopen if actual retention approaches 30 days; detailed cost and update analysis below |
| T6 — superseded | `419a077b21` (G920) removed the hourly slot, cooldown and local backstop; exact successful proof releases immediately. The later boot/ship merge (`93bd`) makes the successful required verdict the automatic ship trigger. | CI3 closes on its **21/21 automatic post-merge releases within 300 s**; all eight old misses predate the merge. BA78 was manual dispatch, not a queue miss. See [CI-FIRST-PRINCIPLES](../../docs/plans/CI-FIRST-PRINCIPLES.md), CI3 / retained 32-release classification. | Original hourly-lag work is obsolete; CI2 artifact download/restore remains a separate open row |

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
| `pine_tree_01` | 6 | 2,927,151 | 0 | 6 |
| `rock_ground` | 8 | 4,597,665 | 6 | 8 |
| `roof_planks` | 8 | 1,525,119 | 0 | 8 |
| `rough_pine_door` | 8 | 1,980,035 | 6 | 8 |
| `stone_wall` | 9 | 3,624,056 | 6 | 9 |
| `stony_dirt_path` | 8 | 4,788,100 | 6 | 8 |
| `wood_planks_dirt` | 9 | 2,536,008 | 6 | 9 |
| `wood_planks_grey` | 6 | 696,818 | 6 | 6 |
| `wood_trunk_wall` | 9 | 8,009,424 | 6 | 9 |

The earlier folder-match audit conservatively retained all 144 originals.
Its two unselected candidates are now independently traced and qualified:
`pine_tree_01/twig_diff.jpg` (510,932 B) and `twig_alpha.jpg` (195,206 B).
The unchanged Blender producer's `build_cards` lines 435–437 read only
`twig_rgba.png`, `twig_nor_gl.jpg`, and `twig_arm.jpg`. `cell_pine` passes
`alpha_from_diff=True`, so the cutout comes from the committed RGBA PNG.
Its similarly named `twig_diff` / `twig_alpha` reads at lines 438–439 fetch
the separate **fir_tree_01** asset into the external Blender source cache.
There is no directory enumeration in that producer; its post step consumes
generated cards/impostors and four bark sets, not the retired Pine JPGs.

The exact original Pine lambda expressions were evaluated with a read-only
byte/hash callback and their three actual paths recorded. This is an explicit
reader trace, **not** a Blender render/rebuild claim. The Blender target's
`inputs` names a conservative folder; `check-model-sources` checks its existence,
not an obligation to decode every child. All 14 source targets / 24 GLBs pass.
`fetch-assets.mjs` only downloads the named outputs; no compositing or local
folder-read step derives the kept PNG from these JPGs. Remove only its two
obsolete output keys. The historical test candidate inventory stays intact;
no runtime/test code consumes that file. The entire 111-job tier plan is
identical without these two paths. All 142 kept texture bodies and 12 tree
GLB/atlas bodies (4,563,038 B) remain SHA-256 exact; phone/image fallbacks stay.
All **154 protected bodies** also hash exactly in both actual emitted dist
trees. The emitted asset manifest changes from 2,175 to 2,173 keys; both
candidate paths are present before and absent afterward, as are the two files.

Normal immutable BEFORE source **`0f0248e9f47506e3604a352dbb484b42b1d34f86`**,
build `0f0248e-mvx4urdp`, and AFTER **`8fa1be30ec9b8a3448a2835b7248fa0ebc3a0c77`**,
build `8fa1be3-mvx51n72`, have no `src/` delta. The source pair also includes three
intervening chapter fixture files; the deletion commit itself has only the two
JPGs and fetch recipe. Do not attribute unrelated emitted build/product changes
to the trim. Both quality tiers at phone portrait / 2× cover two Pine forest
views, Nalati P1 and Nine P1. All **16 before + 8 after full-RGBA captures**
produce **8 A/A and 8 A/B comparisons with zero differing pixels**. All 18
boots pass the original frame gate, completed native frame, actual entry and
positive geometry controls. Neither retired URL is requested. Maintained
`fixedWorldFrame` captures world materials, excluding post/held passes; this is
texture/world parity, not a frame-cost or whole-HUD claim. No tolerance or HTTP
fixture is used. T4's controlled-warm 6/6 and the retained D211 scope continue
to apply; T3 introduces no cache/registration policy or new offline cure.

Source `8fa1be30ec` is on origin/main. Reader/reference/tier/hash proof and the
literal native pair are under `tmp/sp-x9-t3-twigs/` (`reader-trace.json`,
`all-references.txt`, `protected-{before,after}.json`, `kept-models.json`,
`before/reading.json`, `after/reading.json`). T3 closes on the requested exact
reader + unchanged captures bar. All other originals remain, including their
KTX2 and phone-source roles. The old 54-file deletion/restore incident is not
repeated (`a7e021f0` / `217e5f8f` / `154071d0` / `66db342a`).

### T4: HDR and video disposition

| Member / group | Files | Bytes | Disposition |
| --- | ---: | ---: | --- |
| `belfast_sunset_puresky_2k.hdr` | 1 | 4,563,204 | Removed by `50ea8a75f9`: no authored runtime/test/selected bake input; T4 qualified under G872 |
| `kloofendal_28d_misty_puresky_2k.hdr` | 1 | 4,467,957 | Removed by `50ea8a75f9`: no authored runtime/test/selected bake input; T4 qualified under G872 |
| `kloofendal_48d_partly_cloudy_puresky_2k.hdr` | 1 | 5,451,493 | Keep: Nalati/Nine declared sky and two Blender weapon inputs; retain raw fallback |
| `kloppenheim_06_puresky_2k.hdr` | 1 | 4,434,394 | Removed by `50ea8a75f9`: no authored runtime/test/selected bake input; T4 qualified under G872 |
| `qwantani_late_afternoon_puresky_2k.hdr` | 1 | 4,429,634 | Keep: Pine golden-hour key bake input |
| `qwantani_sunset_puresky_2k.hdr` | 1 | 4,171,959 | Keep: Pine selected sky and raw fallback after pair decode failure |
| `rosendal_park_sunset_puresky_2k.hdr` | 1 | 5,049,451 | Removed by `50ea8a75f9`: no authored runtime/test/selected bake input; T4 qualified under G872 |
| `sunflowers_puresky_2k.hdr` | 1 | 5,658,712 | Removed by `50ea8a75f9`: no authored runtime/test/selected bake input; T4 qualified under G872 |
| Two selected sky color/gain pairs + seven Pine key pairs | 18 | 2,527,115 | Keep every plane: selected sky / dawn, sunrise, day, golden, sunset, dusk, night |
| `trailer-15.mp4` | 1 | 3,532,948 | Keep: historical public trailer URL; the 30 s copy also remains a Native Apps store-preview input |
| `trailer-30.mp4` | 1 | 6,551,506 | Keep: historical public trailer URL; the 30 s copy also remains a Native Apps store-preview input |

The five unselected candidates are Belfast sunset, Kloofendal misty,
Kloppenheim, Rosendal sunset and Sunflowers. None has an authored selected
sky, time key or Blender target reference on this source. Their fetch recipe
is an output recipe; generated catalogues alone do not establish a runtime
reader. The original audit required normal boot/offline and before/after full-pixel
checks; the completed T4 scope and the retained first-visit asset failure are below. Both local public trailers remain;
`site/media.json` separately selects newer Blob-hosted marketing videos.

The original proof scope was: one admitted HEAD source; desktop and phone
visitor boot/offline checks for Driftwood, Nalati and Pine; exact captures
before/after any accepted removal; complete emitted-byte comparison; and
root-owned production URL verification after ordinary shipping. A failed or
unavailable preview is not a pass. No new source-mapping, preload, texture,
sky selection, time-of-day or video behavior is authorized by this audit.

### T4: retained qualification and offline refusal (2026-10-31)

The bare-basename search includes `test/`, authored generators, manifests and
selected bake inputs. The five removed names occur only in the download output
recipe, generated presence catalogues and history. `bake-sky` uses selected
`SHARDS[].sky.hdri`; Pine's baker uses its seven authored sky keys, not a raw
HDR directory scan. All selected raw fallbacks, 18 color/gain planes, two
trailers and the two unproved T3 twigs stay. Audit:
`tmp/sp-x9-t4-hdr/reference-audit.json` (source `02ad71d020`).

The real before preview is pinned `62941932c9` / `6294193-mvwytp54`, not
current HEAD. Two fresh visits per world and tier cover all seven Pine times,
Nalati and the conservatively retained Nine declaration: **36 full-RGBA
captures, 18 A/A comparisons, every pixel exact**. Each boot has an admitted
original frame gate, completed native frame and positive geometry. No removed
HDR is requested. The maintained fixed-world renderer excludes post/held passes;
this is sky/world parity, not whole-HUD or frame-cost qualification.

One normal HEAD preview `ad2fc61765` / `ad2fc61-mvx0o231` contains the trim.
All 25 protected files are exact; all five HDR bodies are absent. Complete
emitted inventories are **9,403 / 2,255,597,280 bytes** before and
**9,398 / 2,231,764,878 bytes** after. Exactly **8,985 files /
2,170,395,764 bytes** match at the same path; later shared source/build IDs
also change chunks, maps and product metadata (59 source paths differ).
The HDR family differs only by the five removed bodies; the unrelated net
change is +341,316 bytes. This is not a sole-leaf or whole-output byte claim.
The original preview SPA fallback returns exact index HTML/200 for a generic
missing-HDR request; explicit HDR Accept returns 404. Both results are retained,
with no server rewrite, HTTP fixture or ignored pixel.

The first **seven phone-tier Pine A/B captures are exact**, then a real
offline reload refuses main/runtime code and entry times out at its original
240-second bound. Remaining worlds, desktop A/B and offline gates are unrun,
not passed. The observer's async `waitForFunction` predicate did not prove
activation; that concrete observer error is retained separately from the
actual network failure.

The approved direct pre-`35ee` parent `e9c199a929` reproduces the runtime
failure **after** genuine awaited activation, a completed install book and
cache-body inspection. Its SW serves the offline document and main chunk;
the cached 244-byte runtime has `Vary: Origin` under an Origin-less key, while
the module request carries Origin. This is the preview's reflected CORS
header, not evidence against `35ee` document ownership, `4ef` early registration
or the HDR removal. Root's two actual production requests return the exact
same runtime SHA-256 with wildcard CORS and no Vary header.

Checked `1aeb76658b` makes only public GET/HEAD preview headers Origin-invariant;
API/POST/OPTIONS restrictions, the telemetry sink, compression Vary, worker,
registration and all warm-control policy remain unchanged. The real HTTP
regression fails before it; 35 focused HTTP/encoding/worker controls, root
types and typed lint pass. Native offline after confirmation is **open**.
Raw: `tmp/sp-x9-t4-hdr/{before-gated,after}/reading.json`, complete inventories
and `emitted-comparison.json`; old witness/source audit:
`tmp/sp-x9-pwa-offline/{pre35/reading.json,source-audit.json}`. Root retains
`production-runtime-origin-parity.json` under `tmp/sp-ci-deploy-qa-refresh/`.
No new tolerance, cache-policy relaxation, activation wait in production,
ignored request, blind retry or production cure is claimed.

#### Completed witness: exact pixels; offline scope still open

The final shared after source is **`1aeb76658b` / `1aeb766-mvx1c5vm`**,
not moving HEAD. All **18 strict online A/B comparisons are zero pixels**:
phone and desktop Pine at all seven authored key frames, Nalati P1 and
conservatively retained Nine P1. Eight visitor boots (including Driftwood)
pass original native-frame/geometry controls. All saved RGBA hashes were
rechecked. No G941 allowance is used.

The final emitted inventory is **9,398 files / 2,231,765,108 bytes**;
all 25 protected files remain exact. Against `629`, 8,985 files /
2,170,395,764 bytes match at the same path. Only the five removed raw bodies
differ within the HDR family; unrelated net changes are +341,546 bytes
across 67 changed source paths. All five removed basenames are absent from
the emitted asset index, manifest, document and SW bootstrap. Unrelated
output changes are not attributed to this trim.

After `1aeb`, the offline document, main and exact 244-byte runtime all
return through the worker: the preview-only entry-code refusal is fixed.
`48a9181c2d` aligns the original binary transport test's two old header
expectations. All four maintained/focused files pass 38 cases; root types
and typed lint pass. Production already had invariant headers: no production
SW regression or early-registration rollback is claimed.

The genuinely awaited first-visit test still fails full offline entry.
Its active worker has a completed book (307 code bodies, zero missing),
but its first document remains uncontrolled by design. Plain public sky
fetches from it never enter the worker cache. Retained install snapshots
contain no HDR URLs; the failed reload requests selected day/golden planes.
This is not counted as an offline pass or blamed on removed HDRs.

A separately granted **diagnostic** makes a genuine controlled online
revisit, exercises sky keys and read-only checks actual cached HDR URLs
before going offline. All **six** Pine/Nalati/Driftwood visits across both
tiers then reload and enter offline through activated controllers and
SW-served documents, with positive native geometry. Both Pine tiers visit
all seven keys offline; phone's controlled fetches cache 14 actual plane
URLs. No synthetic cache put, clients.claim, policy or deadline change is
used. The first-visit failure remains **FAIL**. The later G872 scope ruling
and true pre-removal control below close T4 without calling this a first-visit cure.

Raw online: `tmp/sp-x9-t4-hdr/after-online-1aeb/reading.json`; diagnostic:
`controlled-offline-diagnostic/reading.json` in the same directory. The
second first-visit refusal is `after-ready-1aeb/reading.json`; entry-code
after is `tmp/sp-x9-pwa-offline/after-1aeb/reading.json`. Complete inventories,
source differences and checked counts are `final-inventory.json`,
`counterpart-source-paths-final.txt` and `final-summary.json` in T4 scratch.
Obsolete previews and this lane's final shared lease were normally released;
all lane browsers and builders are closed.

#### G872 first-visit control and scoped closure (2026-10-31)

G872 excludes going offline before the page is worker-controlled from T4's
bar, unless the removal caused it. The suggested `578c36fb03` is actually a
descendant of the removal and cannot be a pre-removal control. The one normal
control uses its true parent **`929d759689c3435adaee543658b8d83602fc715e`**,
build `929d759-mvx46tv8`, with all five original HDR blobs present. The normal
current preview helper supplies the already-reviewed production-like public
CORS headers; there is no HTTP interception, fixture, cache put or claim.

A fresh phone Pine visit boots with the original frame gate, 91 calls and
918,591 triangles. Before offline, genuine state events establish an activated
exact-BUILD worker, completed 307-file install book, zero missing code bodies,
**no cached HDR planes**, and a still-uncontrolled first document. The native
offline entry and all seven sky controls subsequently **pass**. This does
**not** reproduce the later `1aeb` 240-second entry timeout. However, the raw
reading retains **3,762 request failures**, including all **14 selected sky
planes**. Its driver's `passed` status only covers native entry/control and
does not reject the collected network errors. It is therefore **not a clean
offline asset/visual pass**. The five deleted HDR names are never requested.

The selected-asset failure thus predates the removal; it is D211, with the
native-entry success explicitly retained. G872's scope closes T4 on the exact
online captures and controlled-warm 6/6, without hiding that failure or claiming
that the later timeout has the same cause. Only four unrelated source files
differ between this control and `1aeb` (grass upload ranges and format/Nalati
schema additions); no sky selection, fetch path or worker policy changed.
Production URL/manifest qualification comes from sp-ci-deploy's next exact
release proof, as ruled; it is not inferred from a local SPA response.

Raw: `tmp/sp-x9-t4-hdr/pre-removal-first-visit/reading.json`; separate strict
asset interpretation: `qualification.json` there. Revision/build/transport
binding: `pre-removal-source.json`. All browsers/builders are closed; the
historical first-visit refusals remain unedited. No timeout, pixel tolerance,
sky, registration or cache policy was changed to close this row.

#### Completed T4 production URL qualifier

Root's bounded actual live proof binds source
`99d9ff28cc376b553c5d957c44c0415e971b6ad0` /
`99d9ff2-mvx38gn3`, with unchanged fresh version before/after at
2026-11-01 01:05:13Z. All five removed HDR URLs return actual **404**, without
HTML fallback, and are absent from the actual 2,175-key asset manifest.
All 25 protected source hashes stayed unchanged from T4 through that source.
The 23 kept `/assets/` manifest hash8 values match the retained source full-SHA
prefixes; two kept outside-assets videos are source-only. This does not claim
25 full live body downloads. T3's later two twig removals are separately
qualified above. Exact evidence:
`tmp/sp-ci-deploy-qa-refresh/qa-99d9-t4-production-proof.json` and its log.
No extra network/native visit was made by this lane.

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
