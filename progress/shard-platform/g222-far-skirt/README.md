# G222 / SF23: the far proxy's boundary face drawn as a rock cliff (E435)

sp-x3 traced the tall smooth white face at Nalati's south and west edges, seen from the grid road, to the SF23 far-proxy
skirt (`../sf48/nalati-white-face-9cfbdd00a/`). Its lip took the snow colour of the edge (×0.7 at the foot) and the ground's
smooth upward normals, so a 100 m wall was lit like snowfield. This change keeps the true edge heights, the colliders, the
socket cuts and the proxy itself (nothing flattened, nothing hidden) and draws the exposed boundary as rock:

- `src/game/grid/farProxy.ts`: the cell's outer skirt gets its own lip vertices with the outward (faceted) normal and a
  declared rock palette (`FarLookSource.cliff`, lip to foot by height), flagged in TEXCOORD_0.y (1 lip, 2 foot). The short
  inner skirts between regions keep the ground colour. **Same triangles** (+208 vertices, +0.018 MB resident per proxy).
- `src/game/grid/farView.ts`: rock beds over the flagged face (`FAR_STRATA`), measured from the seam's rock grain
  (`seamLook.ts strata`: 256 px per 7 m, soft bands every 1.9 m, ±19 % around the mean): the same ±19 % contrast on 3.8 m beds,
  waved along the face and broken into 11 m blocks, flat past 1.2–2.2 km. The foot inset (`FAR_SKIRT_INSET`) now keys on the
  foot flag.
- Each shard declares its rock in `look/far.ts` from its own terrain: Nalati the native slab's granite (rockMid → deep),
  Pine its crag splat, Sunscar its lee sand, Driftwood its `groundColor` rock, Sky Reach its keel rock, Nine Dragon granite
  → ink, the template a darker grey.

Captures (iPhone 16 Pro portrait, muted, one browser lane, Developer catalogue): `capture.mjs`, `<pose>-before.jpg` at the
parent HEAD, `<pose>-after.jpg` at the candidate. Mean sRGB of the face crop, before → after:

| pose | crop | before | after |
| --- | --- | --- | --- |
| nalati-south (705, −277.5) east | 980,650–1150,850 | 182 198 227 (blue-white) | 114 104 102 (rock, banded) |
| nalati-west (277.5, −150) north | 20,600–300,900 | 213 219 230 (white) | 121 111 110 (rock, banded) |
| pine-north (−150, 832.5) east | 20,600–300,900 | 186 188 192 (white) | 68 58 68 (rock, banded) |
| pine-north-face (0, 836) south | 100,800–400,1000 | 91 97 100 | 88 75 88 |

Budget (far-proxies bake): triangles unchanged on every shard (Sky Reach 7847 / 8000; the rest 6144, Driftwood 6170);
resident 0.460 → 0.478 MB (Sky Reach 0.706 → 0.709) under the 1.6 MB cap.

**Finding for SF23 (not changed here):** Nalati's painterly (Lambert) proxy draws a sun-facing face at ~4× its vertex colour
in the grid's daylight. A probe scaling the material colour on the west road face measured ×1 → sRGB 159, ×0.5 → 145,
×0.25 → 109, ×0.125 → 67 (`nalati-west-probe-x0.25.jpg`); its grass reads pale yellow-green for the same reason. Nalati's
cliff palette is therefore the native slab's rockMid → deep ×0.3 so it lands on rock, not white. Re-exposing the whole
painterly proxy is a look change (Jake's call), so it stays as is.

Not this row: the light-grey face inside Pine's north ridge in `pine-north-after.jpg` (behind the cliff, facing −x) is the
proxy's true terrain surface (a steep flank of the ridge lattice, drawn with Pine's ground colour), not a skirt.
