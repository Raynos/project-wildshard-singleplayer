# grid / round-32-holograms: all 14 open-plot holograms (open-plots-mini-plan P6, G545)

`board.jpg`: every idea's hologram in the G545 look (additive cyan, fresnel rim, scanlines, 28-degree feature edges at
0.55, a 0.07 wireframe) at yaw 35. `clay.jpg`: the same GLBs in flat clay, the P5 review. Each is Hunyuan3D-2 full shape
(30 steps, octree 512, no paint) from its round-30 reference, post-processed to 8k triangles at 12 m, meshopt, about
165 KB, in `public/assets/open-plots/<idea>/hologram.glb`. Made with `scripts/open-plots/batch-holograms.sh` and
`scripts/open-plots/clay-review.mjs` (`--mode=holo` for the board). P5: all 14 read as their landmark, closed single
pieces, no melted blobs; none regenerated. Standalone three.js preview renders, not the game.
