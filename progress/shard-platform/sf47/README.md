# SF47-g: Pine Hollow against the 1.0 GB cap after G187 (E435)

2026-10-08, pine-mem builder. **Pine is still over the 1.0 GB playing cap in the grid on both rulers.** All of G187's
invisible cuts are on main, and G208's ring charging can't close the gap where it is. Per SF47, SF47-g goes to
`needs pick` with a board of the remaining measured candidates. Decimal MB.

## What G187 put on main

| G187 item | Commit | Labelled GL, Pine phone KTX2 |
|---|---|---|
| Practice dummies load only when their room opens | `da7d97991` (+ `1c9b368d2`) | −43.0 MB (dummies −33.55, their PMREM −9.44) |
| View distance B (75 %) on Pine's phone tier with the trim on | `da7d97991`, `75ff412c0`, `f50c08a56` | −5.7 MB (cabin detail, three far coats) |
| Creature hulls and coats as KTX2 | `02543ff4a`, `89e7a3b5d` | −26.2 MB trim off, −23.1 MB trim on |
| "Ground decal / pond RGBA8 parts" (the census's RGBA8 sets were really the weapon viewmodels) | `69ff4a7dd` | −10.22 MB |
| G188: KTX2 from the first phone visit | `bc7181016`, `0d2f072ea` | (the textures path) |
| Same-pin cost refresh (C4-R1-A4) | `441ecafb5` | Pine charged 648.99 WC + 205.94 GL (`8e82ae91f`) |
| The dummies' lazy path is the only path; the Memory saver loses that item | **`c5ed249db`** (this lane) | none on Pine's default (the saver was already on under Developer) |

Per-cut censuses and parity are in [../g187/](../g187/). The standalone re-read of cuts 1–3 is in
[sf22a-pine-g187-8e82ae91f](../../memory/sf22a-pine-g187-8e82ae91f/README.md): standalone Pine is under 1.0 GB
(960.8 MB conservative transient).

## Ruler 1: the Simulator native, Pine in the grid (Developer ON)

[native-8cfe4cc67/](native-8cfe4cc67/): `progress/memory/g227-budget/native.mjs <base> <out> <dist> pine-centre on`, run as
three cold `scripts/sim-lane.sh run` boots of `wildshard-iphone` (iPhone 17 Pro Simulator, Safari) through the browser
lane. Clean export of `8cfe4cc67` (it includes `c5ed249db`), phone tier, 2×, Developer ON, Memory saver ON, Auto textures
(KTX2), muted, seed 357. WC is the kernel physical footprint, median of three settled 1 s samples. GL is the same-pose
labelled census, reconciled, with 0 unlabelled. All three runs have no errors and closed cleanly.

| Pose | Before: `0e6d69988`, 1 run | After: `8cfe4cc67`, median of 3 cold runs [min–max] | WC / GL medians | Allocator model |
|---|---:|---:|---:|---:|
| Grid home (Driftwood) | 762.0 | **719.9** [699.6–744.9] | 539.0 / 180.9 | 909.0 |
| Pine entry | 1,120.4 | **994.5** [992.7–1,016.8] | 764.5 / 233.5 | 1,128.1 |
| Pine centre | 1,185.2 | **1,116.1** [1,101.3–1,135.0] | 884.8 / 231.3 | 1,121.8 |

Pine centre is still **116 MB over** (101–135 MB over the cold range). The single-run "before" isn't a same-pin pair, so
the −69 MB isn't a credit to any one cut. GL alone fell 245.7 → 231.3 MB.

### Standalone Pine on the same source (for contrast)

[standalone-8cfe4cc67/](standalone-8cfe4cc67/): the 8e82ae91f protocol, on a second clean export of `8cfe4cc67` with
`sim-bootstrap.mjs` pins. `scripts/sim-memory.mjs --runs=3 --play=30 --fly=30 --shards=pine-hollow --setting=tex=auto
--locations=on --device-save=debug.plugin.pine-hollow.pineMemoryTrim=on` ran through sim-lane: three cold Safari
restarts, every one verified as `8cfe4cc-mv01hvrt/pine-hollow`. Then `location-gl.mjs` ran in three muted Chromium
iPhone 16 Pro contexts (0 errors).

| Phase | Native median [3 cold] | Labelled GL max | Combined |
|---|---:|---:|---:|
| Play | 499 [491–530] | 190.5 | **~690** |
| Explorer | 510 [505–546] | 190.5 | ~700 |
| Loading | 566 [505–677] | 190.5 | ~757 (cap 1.8 GB) |

At `8e82ae91f` the play median was 649.0 MB and GL was 205.9 / 246.3 MB. **The same Pine content costs about 690 MB
standalone and 1,116 MB in the grid.** About 425 MB of the grid figure is the grid page, not Pine. The grid's home with
Driftwood is 720 MB, and Pine entry after Driftwood leaves is 994 MB, so most of that difference is the platform plus
memory WebKit keeps after Driftwood's world is disposed. That points the remaining gap at SF57's retention / page-overhead
work, not at Pine's content.

## Ruler 2: the allocator's worst location at Pine's borders

[borders-8cfe4cc67/](borders-8cfe4cc67/): [borders.mjs](borders.mjs), one muted Chromium/Metal iPhone 16 Pro portrait
context, phone, 2×, Developer ON (the G216 override admits over-cap homes), `8cfe4cc67`. Diagnostic `player.spawn` poses
(world coordinates, translated by the live render origin), 20 s settle each. These poses are not a crossing or physics pass.

| Pose (Developer layout: Pine [0,1], Driftwood [0,0], template-2 [1,1]) | Resident | Playing MB | Accounted MB |
|---|---|---:|---:|
| Driftwood home, settled | Driftwood | 907.5 | 490.1 |
| Road, Driftwood ↔ Pine | none | 525.5 | 145.9 |
| **Pine south edge (the Driftwood border)** | Pine | **1,151.0** | 709.4 |
| Pine centre | Pine | 1,129.2 | 689.7 |
| **Pine east edge (the template-2 border)** | Pine + template-2 tiles (4.2) | **1,139.7** | 699.2 |
| Road, Pine ↔ template-2 | template-2 tiles | 529.8 | 149.7 |
| template-2 west edge | template-2 | 552.9 | 170.5 |
| Driftwood north edge (return) | Driftwood | 908.5 | 490.9 |

Two hybrid shards are never resident together (G226: you leave one before the next loads). So the worst location is
inside Pine's own edge, not on the border. There, Pine's claim (530.2 accounted) plus the platform (l0 89.7, commons up
to 33.3, page 29.9, products 9.1, highway 6.5) is **151 MB over** the 1,000 MB target. The model (1,121.8 at centre)
agrees with the native median (1,116.1) to within 6 MB.

**Shipped layout (Developer off).** Pine isn't in the shipped catalogue (G233 A: Developer-only), and the grid card is
hidden with Developer off (G210), so this layout has no Pine border to read. The probe timed out waiting for the card,
which is the expected result.

## G208: charging Pine by its rings doesn't close it

The renderer half ([g208-pine-rings](../../memory/g208-pine-rings/README.md), `be4c27711`) splits Pine into cell-wide
drawables (318.5 + 6.4 MB: the one 500 m terrain mesh, the instanced forest, the batched prop sets), shared dependencies
(199.6 MB) and L1 tiles (137.2 MB). With L1 at 400 m, every Pine tile is in the ring anywhere inside Pine or on its edge,
and the cell-wide class has no position to ring-charge at all. Today's read puts the worst location inside Pine's edge
(above), where a ring charge equals the whole claim. **G208 saves 0 MB where the gap is.** It saves something only on
the road (49 / 72 / 121 MB at 50 / 150 / 250 m out), and those points are already 470 MB under the cap. Ring charging only
starts to pay once Pine's world is in shardfile tiles (G227's world half, the bake), which is a port, not an accounting fix.

## Verdict and the board's candidates

SF47-g reads **`needs pick`**. The remaining measured candidates, priced in
[g227-budget/cut-list.md](../../memory/g227-budget/cut-list.md) (none is a promised saving; each needs its own matched
measurement):
- Pine region sky + PMREM, 21.6 MB GPU (G232: a single sky key saves at most 8.4 MB);
- phone texture tier at half dimensions, about 27 MB GPU (file + array set);
- music bank: the tension stem is 11.8 MB of the 35.5 MB active pair;
- platform presentation inside a cell (billboards 13.1, plot signs 4.2, junction 5.6, screens 7.0 MB GPU).

Together these come to about 70–90 MB, below the 116–151 MB gap. Standalone Pine is 690 MB, so Pine's own content
isn't what pushes the grid over. **Recommendation: no content cut. Lead with (1) the grid page's retained memory after a
hybrid home leaves (SF57's attribution: Pine entry is 994 MB with nothing else resident) and (2) the bake (G227's world
half: Pine's terrain, props and forest into 62.5 m shardfile tiles), which makes G208's ring charge real.** Until then
Pine stays Developer-only (G233). The allocator charges Pine's measured standalone runtime (500.8 MB). It agrees with the
native grid figure only because the page's retention isn't charged anywhere else.

## Other proof

- `scripts/test-facade-instancing.mjs --url=<8cfe4cc67 preview>`: desktop, phone-tier and iPhone-desktop-quality PASS,
  batches 0.
- Gate on `c5ed249db`'s tree: typecheck, oxlint, ratchet, build and vitest green, except `test/gen-shards` AG10
  (far-reach closure 20 > 17). That failure comes from the Sky Reach KTX2 commit, and `d6807648f` raised the budget.
- Frame floor: not run. The Simulator lane went to the next holder as soon as this cohort ended. Machine load was
  101 / 59 / 54 (1 / 5 / 15 min) during the runs, far above the desktop half's < 12 limit. `c5ed249db` doesn't touch
  Pine's frame: the dummies were already absent at Pine's poses under Developer's default Memory saver.
- Full vitest ran in the gate above (922 files passed; the one failure is AG10).
- Look: `c5ed249db` changes only when the practice dummies load. They're drawn only inside the practice room, so Pine's
  standard poses are unaffected and no parity run was needed.
- The grid boot regression in `4bc33a37d` (CSM `_getExtendedBreaks`) was bisected here (`5ed4862cf` boots,
  `4bc33a37d` fails). `8cfe4cc67` fixes it, and every reading above is on that fixed tree.
