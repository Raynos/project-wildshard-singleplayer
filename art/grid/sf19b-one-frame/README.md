# SF19b: each grid shard under one frame (E435, G122 / G123, 2026-10-04)

**Question (G122):** turn Settings ▸ Debug ▸ "Grid one frame" (SF19a, `src/game/grid/frame.ts`) on by default? The row
stays **off** until Jake picks from these boards; Nalati's family conversion goes live only on his yes (G123).

Real captures, not mockups: a working-tree build of `64865a3c1`, INFINITE WILDSHARD entered from the title (Developer
on: Signal Dunes west, Sky Reach south), iPhone 16 Pro portrait, phone tier, muted, browser lane, HUD as played. Each
board is the same pose on the road at that shard's border: **A** the row OFF (today), **B** the row ON.

Jake's picks applied in B: G75 the road and strips take a neutral grey-blue grade (`HIGHWAY_GRADE`); G94 Signal Dunes
keeps its dusk through a warm dust-haze band rising at its border, its sand graded dusky orange, one sky
(`hazeBand.ts`, the band in its far look); G96 Nalati keeps its painterly far material and declares no grade.

| Board | Shard | What to look at |
|---|---|---|
| `driftwood.jpg` | Driftwood Isle (home, seen from the road) | home grade kept; road grey-blue |
| `pine.jpg` | Pine Hollow | same proxy; one air |
| `nalati.jpg` | Nalati Grasslands | painterly kept to the edge (G96); its high west edge |
| `sunscar.jpg` | Signal Dunes | the dust-haze band (G94) |
| `farreach.jpg` | Sky Reach | one air over the islands |
| `template.jpg` | the template (template-2, looking east) | neutral grade |
| `nalati-wall.jpg` | Nalati's west seam, looking up | the seam's stone face reads; far-proxy skirts now lean 3 m in behind the edge (SF23 fix, was `progress/shard-platform/sf17b/look2-retaining-wall.jpg`) |

Not covered: G95 Nine Dragon (dusk + border fog). Nine Dragon has no far proxy yet (no `look/far.ts`), so the grid
draws nothing for its DEVSERVER cell; its band needs the SF23 proxy first.

**Recommendation:** B (row on) for every shard. Its one open risk is a physical-device reading (RENDERING.md).
