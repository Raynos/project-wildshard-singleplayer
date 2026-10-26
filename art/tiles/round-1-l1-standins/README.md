# G748 round 1: far (L1) stand-ins for occupied tiles

`board.jpg`: Driftwood Isle entered from SHARD SELECT, iPhone 16 Pro portrait, phone tier, build `732273c`.

- **TODAY** (Developer off): past the 5 x 5 tile ring the island's occupied tiles draw nothing but their landmarks'
  coarse copies (T11), so the far hill is bare of its palms.
- **G748 STAND-IN** (Developer on): the shard's own near view (its drawn world at a low LOD in its own far look, the
  cell as its neighbours see it) stands in for those tiles, its ground left to the real terrain and the ring's tiles
  masked out per fragment. No boxes, no new bake.

Per shard: only Driftwood declares it (`world.assembly` row `farStandIn`). Pine and Nalati draw their far content whole
today (no visible change). Nine Dragon draws its city whole and the stand-in only laid dark towers over it, so Nine
stays without.

Recommendation: ship the stand-in for Driftwood (G748.4: on Jake's word the Developer gate goes).
