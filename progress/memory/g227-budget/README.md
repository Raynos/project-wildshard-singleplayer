# G227 entered-region memory budget (E435)

**Target: remove at least 100 MB of accounted resident bytes per entered hybrid, net of the new tiles and their dependencies.** That projects Pine entry from **1082.20 to 971.20 MB**, and Nalati entry from **1070.89 to 959.89 MB**. The bare minimum reductions are **74.05 MB Pine / 63.86 MB Nalati**. These are planning constraints, not measured tile savings or an admission discount.

The source is the [fenced ledger](../g226-platform-ledger/report-1b0572d69-fenced.json) on `1b0572d69`, build `1b0572d-muz46mxi`: Developer ON, phone tier, Auto textures, one muted Chromium/Metal iPhone 16 Pro. Pine and Nalati were entered in turn, with the prior opaque region retired. [The route receipt](../g226-platform-ledger/README.md) records zero page errors and successful crossing witnesses. This is an allocator/model census, not a fresh native Simulator measurement. Decimal MB throughout; [budget.json](budget.json) contains exact bytes and arithmetic.

## Current per-owner table

Accounted bytes include retained CPU and GPU resources. The model is **300 MB engine base + 80 MB overlap + ceil(1.11 × accounted bytes)**. The dated 299 MB calibration has already been removed once when deriving each runtime claim. Do not subtract it again or add labelled GL to these totals.

| Owner / claim | Pine entry MB | Nalati entry MB | G227 treatment |
|---|---:|---:|---|
| Entered opaque runtime, `sim:<instance>` | 500.839395 | 489.909910 | Replace only its proved world-render ownership; retain the remainder |
| Platform presentation, `platform:render:*` | 105.894374 | 105.894374 | Stays; includes three live loading-screen slots at entry |
| Permanent highway physics, `sim:platform.highway` | 6.744192 | 6.744192 | Stays |
| Six far proxies, `render:*:far` | 9.600000 | 9.600000 | Stays; no visibility-only discount |
| Nearby template L1 tiles | 0.369960 | 1.111588 | Stays at these sampled poses |
| Parsed products / wire / edge metadata, `product:*` | 9.160452 | 9.160452 | Stays; any new product/cache growth must be charged too |
| **Total accounted** | **632.608373** | **622.420516** | |
| Engine base + decode/refinement overlap (model, not claims) | 380.000000 | 380.000000 | Stays |
| **Modelled playing (1.11 applied once)** | **1082.195295** | **1070.886773** | **82.195295 / 70.886773 MB over cap** |

The platform's settled **99.777680 MB** is the same road/plots plus two screen slots; the third slot costs **6.116694 MB** at entry. Centre totals are **1075.919348 MB Pine / 1064.196295 MB Nalati**. Size against the entry peak, rather than silently dropping the third slot from the 1082/1071 figures.

| Platform owner | Settled accounted MB |
|---|---:|
| Open plots | 33.789972 |
| Road signs / atlas | 22.732832 |
| Deck / seam mesh | 22.512656 |
| Two cell-screen slots + shared base | 12.233668 |
| Junctions | 5.629880 |
| Asphalt | 2.845264 |
| Curtain + void | 0.033408 |
| **Total** | **99.777680** |

## What the world tiles replace, and what remains

The current `sim:` names are misleading for hybrids: each is a **measured whole runtime**, not a physics-only claim. The ledger does **not** separately measure its terrain, forest, props, simulation, kit, creatures or sky. A numeric subdivision of that aggregate would be invented. Use this ownership equation until the bake provides a reconciled inventory:

| Within the opaque runtime | Current cost | After G227 |
|---|---|---|
| Terrain drawing: vertex/index arrays, splat/paint textures and materials, static ground decoration | Included in world subtotal `W` | Admitted L0/L1/far terrain tiles and their exact shared dependencies |
| Forest / static scatter drawing: source geometry, instance buffers, materials/textures | Included in `W` | Independently constructed, disposable tile instances; wind/sway retained |
| Static props / buildings drawing | Included in `W` | Clipped/instanced world tiles; material channels retained |
| Authoritative native terrain/prop collision, scripts, quests, flags, doors and whole-shard clocks | Retained residual `R` | Stays, no simulation radius or collision discount |
| Kit / equipment / viewmodels, creatures / rigs / coats / animation, interactions and dynamic props | Included in `R` | Stays; shared resources remain charged while either role uses them |
| Sky, water/weather, particles, slab/skirt surfaces not converted, render targets/PMREM/shadows, opaque caches and unclassified native cost | Included in `R` | Stays until its owner proves a separate replacement/disposal |

For Pine, `R = 500.839395 − W`; for Nalati, `R = 489.909910 − W`. `W` must be retired allocation, not merely hidden meshes. Retained decoded models, whole forest builders or shared textures used by creatures cannot be credited to tiles. The replacement `T` counts **resident L0 + L1 + parent/far overlap + shared textures/geometry + retained JS + GPU**, deduplicated by actual resource identity.

## Replacement estimate and delivery target

There is no admitted, costed G227 world product in this ledger. [Pine's source inventory](../../shard-platform/pine-world/inventory.json) explicitly says `unbaked`; [Nalati's assignment](../../shard-platform/g227/nalati-static-assignment/README.md) still requires combined packing and dependency costs. Therefore the defensible replacement estimate is an **envelope**: to meet the recommended target, **`T ≤ W − 100 MB`** (less any net growth elsewhere). The following conditional scenarios give the builders concrete numbers without presenting a guessed world subtotal as measurement:

| Proved retired world `W` MB | Estimated resident tile budget `T` MB (50% retained scenario) | Net saving MB | Projected Pine entry MB | Projected Nalati entry MB |
|---:|---:|---:|---:|---:|
| 100 | 50 | 50 | 1026.70 — refuses | 1015.39 — refuses |
| 150 | 75 | 75 | 998.95 — 1.05 margin | 987.64 — 12.36 margin |
| **200** | **100** | **100** | **971.20 — 28.80 margin** | **959.89 — 40.11 margin** |

**The 50% fraction is a sensitivity assumption, not a baked-cost prediction.** If `W` is only 150 MB, the 100 MB net target requires tiles ≤50 MB; if it is 250 MB, tiles may be ≤150 MB. Merely partitioning the old world does not imply either saving. In the [earlier Pine G208 census](../g208-pine-rings/README.md), the 400 m L1 ring wanted all 16 tiles inside Pine, saving **zero** there. G227 must reduce actual resident representation / lazy dependencies, not multiply total cost by a visible-tile fraction. That older scene census also overestimated decoded texture JS and used a different pin; it is not subtracted from today's reviewed runtime claim.

| Shard | Minimum net accounted saving to reach 1000 MB at entry | Maximum post-G227 runtime + tiles (no new external claims) | Recommended post-G227 runtime + tiles | Projected entry / centre MB at target |
|---|---:|---:|---:|---:|
| Pine | **74.049815 MB** | **426.789580 MB** | **400.839395 MB** (100 MB net saving) | **971.195295 / 964.919348** |
| Nalati | **63.861958 MB** | **426.047952 MB** | **389.909910 MB** (100 MB net saving) | **959.886773 / 953.196295** |

The target leaves 28.80 / 40.11 MB modelled margin at these entry poses; it does not prove transient or physical-phone safety. Every extra accounted MB in product storage, staging, tile dependencies or the retained residual costs another 1.11 MB of playing margin. If those owners grow by `D`, require **`W − T ≥ 100 MB + D`** to preserve the target.

## Completion evidence for sp-x5 / sp-x3

1. Reconcile `R + W` against the reviewed runtime provenance; publish terrain / forest / props ownership and shared resources. Keep unclassified cost in `R`.
2. Measure the emitted tile/dependency union at entry, centre and the heaviest pose, including parents and prepare/upload overlap. Admit it before construction; do not allocate the old whole world first.
3. Prove the credited old owners and caches are disposed, with the runtime residual, platform and full native sim retained. Re-run this ledger with Developer OFF: no override and no simultaneous Pine/Nalati opaque runtimes.
4. Re-measure native WebContent plus matched labelled GL on the resulting same configuration. The current Pine settled/runtime provenance is `8e82ae91f`; Nalati's older `91f97bdfc` single-cold-run provenance remains explicit. No measured total or cap changes in this receipt.

Plan-State: unchanged. G227 remains open; this receipt supplies its numerical acceptance target.
