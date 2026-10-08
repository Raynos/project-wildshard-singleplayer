# Playtest round 2: visual and feel rows (SHARD-PLATFORM, E435)

Lane playtest2 on `art/playtest/round-2-2026-10-08/README.md`. Captured with `capture.mjs` (iPhone 16 Pro portrait, muted,
one browser via `scripts/browser-lane.sh`, Developer ON). Before = `serve-build.sh --head` at 7f55207d4; after =
`serve-build.sh --rev dc6139f2b` (the four commits below on 970e00029). Each pair image is before | after.

| Row | Before | After | Proof |
|---|---|---|---|
| Board glide (SF20d) | released at 30 m/s: **149.7 m, 9.9 s** | **68.4 m, 6.4 s**; standalone 14 m/s glide unchanged (~32.5 m) | `capture-before-glide.json`, `capture-after.json` (`glide`), `test/grid-rules.test.ts` |
| Far-view walls (SF23) | every shaded far-proxy cliff pitch black (Nalati W face, Pine approach V, SE roundabout, open plot horizon) | dark grey rock with strata | `road-nalati-west-face-…`, `road-pine-approach-…`, `se-roundabout-n-…`, `open-plot-se-n-…` |
| PTS strip (SF38) | `PTS XROADS 107 · 1070.1/1000.0 MB · NALATI GRASSLANDS 457 · 5 OK · PLATFORM 121.1` | `MEMORY ALL LOADED 1070 / 1000 MB (107%) · NALATI GRASSLANDS 457% OF BUDGET · 5 SHARDS OK · SHARED 121.1 MB ▾` | `nalati-entry-road-…` |
| Memory chip (G216, E332) | right edge, top + 190 px: over the NAMED ELITE banner's band | left column, top + 98 px (CSS 6, 104, 153 × 24), clear of the centre band | `nalati-entry-road-…`, `capture-after.json` (`chip`) |

Owner of the walls: the far proxy's boundary skirt (`farProxy.ts` / `farView.ts`). It went black because the grid frame
has no ambient term when no shard brings its sky light, so a Lambert face off the sun got zero light; `FAR_CLIFF_FLOOR`
fixes the black. Still open: the face's **height** (~100 m at Nalati's snow-ring berm) is the shard's own edge height cut
at the cell boundary; making it read as a slope needs a border shoulder in the bake or the vertex shader (a look change for
every shard, so default-off behind a Debug row first).

Not reached in this lane: grid Nalati's yellow ground and black horizon band, Nalati's grass on the entry road, Pine's
near-black forest frames, the open plot's black ground and blank billboards. `window.__wildshard.pose` into a shard's
interior lands on the road when the cell is not admitted, so those poses need a real drive-in.
