# sp-o5 look48: the look-parity sweep on HEAD, and nightly GPU gate 38289166087 (SHARD-PLATFORM, E435, 2026-10-12)

## 1. Look parity: each shard's grid cell against SHARD SELECT

Every capture is HEAD `cb32a58e2`, a DEVSERVER build (`serve-build.sh --head --devserver`). The sky state is G321 at
`cd9f8486c` ("cells always carry their sky light"); sp-o2's live sky work is not in it. Each shard has two contexts:
- muted Metal iPhone 16 Pro portrait, phone tier, 2×
- desktop 1440 × 900 at DPR 2, desktop tier

Both run with Developer on and Memory saver on. Each one gets a SHARD SELECT boot (`?chunk=`) and the shard's grid cell
at the same local pose, entered from the road by frame floor's `cell` plan. `capture.mjs` is op-sky46's plus `DESKTOP=1`,
`GRIDWAIT`, `PROBE=grass` and `TELEPORT=1`; `sheet.py` makes the A–D boards. The readouts are `capture-phone.json` and
`capture-desktop.json`. Every route that ran had 0 page errors and 0 console errors.

| shard | verdict | board |
|---|---|---|
| Driftwood Isle | **PASS**: the same picture on both tiers | `driftwood-isle-board.jpg` |
| Pine Hollow | **FAIL, regression**: the near grass carpet is missing in the cell on both tiers. It drew on `7b60b1941` (`../sky46/pine-hollow-board.jpg`). It is still missing after a 25 s hold. The probe found 3,392 of 22,400 clumps live and 0 within 12 m of the feet; they sit away from the trail. Suspect: `a6c81a933` ("prepare initial grass cells before resident exposure"), which seeds cells in a scene preparation pass whose terrain context may not be Pine's, and a seeded slot is never reseeded. Not bisected | `pine-hollow-board.jpg` |
| Nalati Grasslands | **PASS**: the same sky, light and grade | `nalati-grasslands-board.jpg` |
| Signal Dunes | **PASS**: its own dusk sky in the cell (G321). The dark far ridge is G99's, as before | `sunscar-dunes-board.jpg` |
| Sky Reach | **NOT CAPTURED**: the road-entry route into the cell timed out on both tiers in two runs (one of them on an idle machine), and a teleport was not admitted either | `far-reach-board.jpg` |
| Nine Dragon | **NOT CAPTURED**: the road-entry route timed out in the same way | `nine-dragon-stack-board.jpg` |
| Template (`template-2`) | **FAIL, not new**: the cell keeps the road's sky and light (`regionSky {}`, key 2.7, blue / orange hemi) with its grade at 0. It also has no loadout (G324), so since `419165b81` (each cell's own camera) the phone FOV is 72, not 86.8 | `_template-board.jpg` |
| Blender template | **FAIL**: the same missing sky, light and grade. Its walls go purple and its floor blue under the road's hemi | `blender-template-board.jpg` |
| Pastel Plain | **FAIL**: the same missing sky, light and grade, and no loadout (phone FOV 72, not 86.8) | `pastel-plain-board.jpg` |

Minor, every cell: the minimap's area label names a neighbour (Pine shows DRIFTWOOD ISLE, Nalati shows TEMPLATE SHARD).

## 2. Nightly GPU gate 38289166087 on `03484c121`: all seven parity cases red

**Finding: nothing new.** The seven red cases are the same red set as run 38149690316 on `fd7590693`
(`progress/process/sf74-2026-10-11/nightly-attribution.md`): every red field and every value is equal, except SSIM noise
(at most 1.4e-3) and Nine's `leak.disposalErrors`, which went green. Between `fd7590693` and `03484c121` the gate
caught no regression. The shared cause is stale baselines. The `gh-macos15` baselines (`8664edaed`, `584c24d61`,
`7d731563a`, `bfb9dc325`, all 2026-10-08) predate several decided changes.

The coordinator's rule (wildshard-new, 2026-10-12): a case is re-baselined only if every changed field is explained by
a decided change: G271, Shadow bias NEW `c71039878`, G325, G261, G266, SF72 `77772d696` or `2a432fe48`. "Other" names a
decided commit outside that list. "Open" means the cause is not identified. Sources are the run artifacts against
`test/parity/baselines/gh-macos15/`, plus nightly-attribution.md.

| case | field | old → new | explained by | verdict |
|---|---|---|---|---|
| all seven | `*.sounds.*` multisets | music / voices / ambience missing in walk and combat | G325: audio starts on the first tap; the runner walks before its phone touch (harness, sp-x5 coverage) | explained |
| six (not Signal) | `boot.render.programKeys` | hash changed | Shadow bias NEW `c71039878` (receiver-plane PCF `f9fe9e81e`) | explained |
| Template | `gpuBytes.textures` / `total` | +17,360,704 | G271: bloom 7,899,840 + depth 5,266,560 + 1024 shadow 4,194,304 | explained |
| Template | mesh, programs, textures count, `current` SSIM | 180→181, 35→36, 30→31, 1→0.9468 | `80299e0bf` playtest round 3, the lantern band (other) | other |
| Sky | registry, colliders | +far.islet.rails, 1,216→1,256 | `2a432fe48` rails | explained |
| Sky | `gpuBytes.textures` | +17,360,704 | G271 | explained |
| Sky | mesh / instanced / instances | −5 / +45 / +90 | rails +1 / +1 / +40; the rest is `8942c04ec`, `3df45db44` and `124b14522` (other) | other |
| Sky | programs, geometries, calls, tris, buffers | 107→104, 233→230, −1 calls, +828 / +480 tris, +28,560 B | rails explain 480 tris and 3,400 B; the rest is open | **open** |
| Driftwood | textures, renderbuffers | +7,899,840, +5,266,560 | G271: bloom luminance and composer depth | explained |
| Driftwood | registry, pose tris, pier walk end | 4 piers cuboid→convex, −24 tris per pose, 3 mm / 8 mm | G261 flared ramps | explained |
| Driftwood | `systems.update` | +`shard.driftwood.director` | `99ecc7bcd` SF24 default-off director (other) | other |
| Driftwood | `gpuBytes.buffers` | −3,114 | G261 `00196a4c2`'s own m5 parity put the removed kick boards at −3,600 B. That leaves +486 B unexplained (suspects: `794c4e128` straight-path deletion, `99ecc7bcd` director) | **open (486 B)** |
| Nalati | textures, mesh | +1,048,576, 307→308 | G271: 512 shadow, eager kurgan interior | explained |
| Nalati | saves read / written, loot written | +profile and shard keys | `28fe9f479` / `a4ffb1c2d` / `70e2a5094` Progress (other) | other |
| Nine | textures | +9,460,864 | G271 (nightly-attribution.md) | explained |
| Nine | SSIM spawn-rail / well-edge / stair-street | 0.9834 / 0.9829 / 0.9818 (band ≈ 0.99) | likely G271's full-resolution textures plus PCF, not measured | **open** |
| Pine | registry, colliders | props 166→164, props-2 165→164, stumps 70→69: −4 | SF72 `77772d696`: exactly the four lane-blocking solids | explained |
| Pine | textures | +20,156,960 | G271, with the two duplicated ASTC mip textures | explained |
| Pine | `gate` tris | −1,270 | SF72 `77772d696`'s own parity: "the gate pose −1270 tris (the south rock)", the rock at (−3.57, −204.99) beside the gate pose (0, −200) | explained |
| Pine | buffers | −64 B | SF72 `77772d696`'s own parity: "GL buffers −64 B" | explained |
| Pine | lookout-climb end x / z, maxY | 34.916→34.926, 211.286→211.280, 57.478→57.480 | suspect `a11cce5d2` (G285 offline props bake: "colliders equal but for last bits (rock hulls)"), not measured | **open** |
| Signal | mesh, instanced, geometries, buffers, poses | 391→260, 17→25, 237→138, −2,926,136 B; calls −108, tris −107k, SSIM 0.88–0.97, feet −6 cm | G266 compiled tile ground (exact aggregates unproven) | explained in kind |
| Signal | `systems.update`, programs | +`sunscar.ray`, 55→56 | `0f30825c9` held-ray split (other); the program is unattributed | other / **open** |

**Outcome.** wildshard-new widened the list to decided commits outside it: `80299e0bf`, `99ecc7bcd`, `8942c04ec`,
`3df45db44`, `124b14522`, the Progress commits and `0f30825c9`. With that list, **Template and Nalati** are fully
explained. Both were re-baselined from record run 38303801561 (sp-x7's dispatch, exact SHA `230a36644`):
- Template: `431c648cc`
- Nalati: `74ee614cf`

Before each commit, a three-way diff (old baseline, nightly now, new record) checked the recorded values. They equal
the nightly's current values except SSIM (1 by definition), listener stack text and Nalati's green pause / resume creature
list. So nothing that landed after `03484c121` entered the baseline unexamined.

**Still red (open rows above):**
- Sky: programs −3, geometries −3, spawn tris +828 and buffers +28,560 B, of which only 3,400 B are explained.
  Suspects are the per-commit deltas the bakes themselves report: `8942c04ec` (GPU +1.1 KB, geometries −1),
  `3df45db44` (GPU −7.7 KB, geometries −2) and `124b14522`.
- Driftwood: buffers +486 B over G261's measured −3,600 B.
- Nine: the three pose SSIMs (0.982 to 0.983).
- Pine: the lookout-climb end, +1 cm.
- Signal: the exact G266 aggregates and one program.

Each needs a before / after build per suspect on the field. None was run in this lane (cap); this is handed off.
