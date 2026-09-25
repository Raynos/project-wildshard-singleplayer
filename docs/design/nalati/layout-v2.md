# Nalati — world layout v2: the bowl and the snow ring (ask N9)

The user picked **layout 4** (`art/nalati-grasslands/round-8-three-zones/map-4-bowl-ring.jpg`) after the round-7 and
round-8 redesign mockups: "it doesn't feel like reality … more oomph, more points of interest … bigger and grander,
denser … we are trying to CRAM way too many biomes in." Three unmistakable zones, each with its own colour:

| zone | colour | where | feel |
|---|---|---|---|
| **Nalati Grasslands** | lush green | the north band, z > +125 | the lowland: the braided Kunes, the camp, flocks |
| **The Sky Grassland** | golden-green | the central bowl, z +110 … −45, x ±200 | the great high meadow ringed by rock: herds in the hundreds, kokpar, kurgans |
| **Snow Lotus Valley + its mountains** | white / blue-grey | a horseshoe of snowy crags round the south and east, and the glacial valley running south from the bowl to the S gate | cold, vertical, quiet: scree, snowfields, a glacier, meltwater, snow lotus |

**Cut** (the user): spruce forest (a few lone spruces at most), mill, waterfall, tarn, balbal circle (balbals only on
the kurgan mounds). **In:** herds in the hundreds, the kokpar field, the ruined watchtower, Snow Lotus Valley.

## Coordinates (metres; engine axes: +z north, **+x west**, −x east; slab ±250)

Read from the map (1 px ≈ 0.43 m, centre at px 627 / 640). Every POI module reads these from
`src/chunks/nalati-grasslands.ts` — no hard-coded positions anywhere else.

| POI | x | z | ground y | notes |
|---|---|---|---|---|
| N road / spawn | 0 | +250 → +232 | 0 → −8 | spawn at (0, +232) facing south, the bridge and the bowl ahead |
| Kunes river | band across the north | z +150 … +190 | water −10 | braided, flows east → west, gravel bars; meanders round the camp and the pasture |
| Bridge | 0 | +172 | deck −6 | timber, carries the N road over the river |
| Nomad camp | +88 | +196 | −8 | 8 yurts, corrals, drying racks, smoke; the hub (hitching rail, TULPAR) |
| Sheep pasture | −120 | +192 | −8 | fenced; big flocks |
| Escarpment / bowl rim (north) | the band z +110 … +140 | | −8 → +30 | a grassy, rocky rise (no forest); the sky road climbs it |
| Sky road | from the bridge (0, +160) south-west up to (+120, +70) | | −8 → +30 | switchbacks, a ribboned gateway at the top |
| Eagle Rock | +180 | +85 | tor top +65 | a granite tor on the bowl's west rim, the view over all three zones |
| **Sky Grassland (bowl floor)** | 0 | +40 | +24 … +32 | a shallow golden bowl ~350 m across, rims rising to +40 |
| Horse plains | +65 | +36 | +26 | herds of hundreds (instanced far herds + the AI herd with the stallion) |
| Kokpar field | −61 | +36 | +26 | an oval of trodden earth, riders mid-game, spectators' horses |
| Kurgan field | −106 | +83 | +28 | 5–7 grassy mounds, balbals on the tops |
| Great kurgan | −191 | +75 | +30 | the Golden King's dungeon entrance |
| Summer camp | −91 | −26 | +28 | 3 yurts, horses |
| Ruined watchtower | −214 | −9 | +42 | a broken stone tower on the east rim above the snow ring |
| W / E roads | ±250 | 0 | 0 → +28 | ramps up onto the bowl's rim (engine rule: y = 0 at the edge) |
| **Snow Lotus Valley** | 0 | −60 … −235 | +30 → 0 | a glacial valley from the bowl's south rim down to the S gate; meltwater stream, scree fans, boulders, snow lotus in the rocks |
| Glacier | −82 | −81 | +45 … +80 | a glacier tongue spilling from the east crags into the valley head |
| Snow leopard cave | +175 | −98 | +55 | Aqbars' lair on the west side of the ring |
| The Crags (east) | −180 | −115 | peaks +90 … +110 | snow above +55, Argymaq's high pasture on a bench |
| West crags | +170 | −130 | peaks +80 … +100 | snow lotus clusters around (+143, −136) |
| S road | 0 | −250 | 0 | enters up the valley floor |
| Storm Titan cairn | a high point on the south rim of the bowl | (≈ −30, −45) | +34 | the Titan stands beyond the rim, over the snow valley |

## Shape of the land

- **Valley** (z > +125): flat-ish at −8, the river bed −10, gentle banks; lush green.
- **North rim / escarpment** (z +110 … +140): a grassy, rocky rise to +30 — outcrops, no trees.
- **The bowl** (z +110 … −45): a shallow golden meadow at +24 … +32, rims at +35 … +45 on all sides, the W / E roads ramp
  up to the rims.
- **The snow ring** (south and east, plus a west arm): crags rising steeply from the bowl rim to +80 … +110, snow above
  +55; the glacial valley cuts south through the ring from the bowl's south rim (+30) down to the S gate (0).
- The entry roads stay at y = 0 at the slab edge (engine rule).

## New content this layout needs

| thing | owner |
|---|---|
| terrain landscape + zone splat / palette (green valley, golden bowl, grey-white snow ring) | layout rebuild |
| POI coordinates in the chunk def; POI modules re-placed; balbal circle, waterfall, spruce gullies removed | layout rebuild |
| Snow Lotus Valley dressing: scree fans, boulders, snowfields, the glacier tongue, the meltwater stream, **snow lotus** flowers (a small model), the cave | layout rebuild (+ models) |
| herds in the hundreds (instanced far herds, cheap), the kokpar field + riders, the ruined watchtower | layout rebuild (+ models) |
| the horizon + painted backdrop re-aimed to the new layout (mountains south / east) | look agent |
| minimap / full map for the new layout | features agent (B15) |

## As built (2026-09-23, the layout rebuild — `src/chunks/nalatiLayout.ts` is the source of truth)

Where the build moved a spec coordinate, and why:

| POI | spec | built | why |
|---|---|---|---|
| Kunes | z +150 … +190 | centre z ≈ 168 (172 under the bridge), half-width 9 … 20 | kept north of the escarpment's foot so the climb to the rim is a slope, not a cliff |
| Nomad camp | (+88, +196) | (+88, +212) | clear of the river's north bank |
| Sheep pasture | (−120, +192) | (−120, +212), r 32 | the same |
| North rim | z +110 … +140 | z ≈ +96 (bowing to ≈ +80 round the sky road), +34 | a wider, gentler escarpment; the sky road's five legs climb it at ~13 % |
| Bowl | z +110 … −45 | squircle round (0, +24), 410 × 144 m | follows the rim |
| Watchtower | (−214, −9) | (−208, −38), +44 | the spec spot is on the E road's levelled mouth (y = 0) |
| Snow leopard cave | (+175, −98), +55 | (+138, −68), +54, facing north over the bowl | the spec spot is inside the west massif (+90) |
| Snow lotus | round (+143, −136) | the biggest cluster at (+96, −112), +59; the rest on Snow Lotus Valley's walls | (+143, −136) is at +82 on the massif, out of reach |
| Kokbori's den / Qara's cairn / Argymaq | — | (−172, +118) / (+82, −50) / (−160, −72) bench +52 | not in the spec |

### The crags pass (2026-09-23)

The snow ring read as smooth grey-white lumps with boulders pasted on; now (`progress/nalati-crags-01/02-*`):

| what | where | how |
|---|---|---|
| crag relief | the def's `crags(x, z, d)` | knife-edged arêtes (one warped ridge octave ~130 m), spurs (ridged multifractal weighted by the arête), couloirs (ribs radiating from each massif's summit), tilted strata above ~+40; a smooth scree apron off the bowl's rim. Peaks now ≤ +111 |
| valley walls | the Snow Lotus Valley cut | buttresses / gullies every ~25 m, strata, a scree fan out of each gully; the wall keeps 3 m back from the S road (it runs along the west wall's foot round z −100) and stays a plain climbable slope round the snow lotus clusters |
| glacier | the tongue's blend | where the ice stands over lower ground its side is a stepped rock wall (not the snout: its ice cliff stays); rock crests flank the trough beyond the bowl's rim; the snow-ring zone reaches over it (`glacierNear`) |
| ground | `ringGround`, `outcropAt` | one source for splat / vertex colour / surface masks: scree at the feet + over the valley floor (turf in patches), granite on the steep, snow above the line on what holds it (steeper high up, a cap over ~+85), drifts on the floor; the escarpment grassy with rock only where an outcrop breaks through |
| shading | `src/nalati/terrainSurface.ts` (look v2) | the ring painted per pixel: two-scale triplanar granite with fractures + strata bands, snow blue in the shade |
| crag rock | `src/nalati/cragRock.ts` | faceted granite fins on the crests, ribs against the steep faces / valley walls, broken towers on the shoulders — 4 merged meshes; the face boulders (Crags.ts, outcrops.ts walls, dressing on steep ring ground) are gone |

Every POI, the entry roads (y = 0), the valley floor and every snow lotus cluster stay reachable on foot (a 1 m
flood fill under the 44° walk limit).
