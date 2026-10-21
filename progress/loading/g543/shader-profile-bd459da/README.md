# Source-mapped shader CPU profile

Served committed SHA: `bd459dadaf9da655af6b37bdb91aed3ec3aad63f`.
Muted Chromium, iPhone 16 Pro emulation, CPU 4x. The observer records
cold entry through the first real frame; this is diagnostic CPU attribution,
not a separate acceptance or an iOS timing measurement.

| Path | Shaders wall | renderer.compile inclusive | WebGLNodesHandler.build inclusive |
|---|---|---|---|
| SHARD SELECT | 12.589 s | 10.380 s | 8.043 s |
| Grid entry | 6.049 s | 4.530 s | 3.435 s |

These nested inclusive durations overlap and must not be added. The stored
top functions retain both sampled self and inclusive time and their exact
original source locations. The source maps come from this served SHA's dist;
218 / 206 chunks map. Unmapped chunks are listed openly, including generated
entry/runtime code and one Three bundle on SHARD SELECT. Empty URLs denote
profiler engine categories, not source-mapped app functions.

The node builder is the larger remaining main-thread shader cost. O5's
initial post-target warm-up addresses native first draw separately. sp-o2's
O14 owns real-light identity reuse and environment-free unlit program keys;
its change is not present in this baseline. The loading lane will measure
on top of that landing before proposing overlapping key work.
