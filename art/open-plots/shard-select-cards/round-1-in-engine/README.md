# Open plot SHARD SELECT cards · round 1 · in-engine (G987, 2026-11-03)

`board.jpg`: the six built open plots' SHARD SELECT art, BEFORE (the shipped card: painted mockups, and an old
Night Market render) and AFTER (live in-engine captures). Captured by `scripts/open-plots/card-capture.mjs` on the
pinned preview of `d3b32d2003`, phone tier, 2x, as a muted iPhone 16 Pro; the four candidate views per plot (plaza,
raised, approach, high) were compared and one picked per orientation (G872, decided by the builder):

| Plot | Backdrop (portrait, 804 × 1626) | Card thumb (640 × 360) and landscape backdrop (1600 × 900) |
|---|---|---|
| Night Market | plaza: the pagoda gate | high: canals, stall rows and the gate |
| Lantern Bayou | plaza: the lantern tree | approach: the tree over the boardwalk and pools |
| Frostline Peaks | approach: the summit lodge on its peak | high: the peak, pines and ice canals |
| Ember Forge | raised: the furnace and its embers | high: the lava canals round the furnace |
| Coral Drift | plaza: the coral arch | approach: the arch, huts and lagoon pools |
| Mosslight Ruins | plaza: the mossy tower through the ivy arch | high: the emerald pools and ruin courts |

The landscape views drop touch emulation (the rotate gate stops a coarse-pointer page drawing in landscape) and keep
the phone tier and 2x. The cards in `src/shards/open-plots/outputs.json` now name `<idea>-portrait.jpg` and
`<idea>-landscape.jpg`, like the main shards; `<idea>.jpg` stays the thumb.
