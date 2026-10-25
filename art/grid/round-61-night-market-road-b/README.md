# Night Market road B — G681 / G700

Source: `eb489a1734ee917d59d658f3318f263580aaae9b`.

The Night Market placement rows set `edgeLook.height` to **1.2 m**. Other
placements keep the original **7 m** curtain. This changes the visual curtain
only: collider dimensions, readiness, closed/open flags, cell loading and entry
triggers retain their original rules. Road A's 10 m entry posters at 0.6 m remain.

`road-entry.jpg` is a live road-entry capture from the exact pinned preview:
iPhone 16 Pro portrait (402 × 874 CSS pixels, 3× screenshot scale), phone tier,
2× game render scale, muted Chromium/Metal, through `scripts/browser-lane.sh`.
It keeps round 60's south-road camera: eye 8 m, looking toward the market centre.
The capture label is an overlay; the world and barrier are rendered by the game.
The captured market uses its near view; the readout reports zero refused tiles,
no error overlay and no graphics context loss. The live curtain attributes contain
only 7 m and 1.2 m heights. Existing Developer diagnostic overlays are hidden by
the shared capture helper; gameplay touch controls remain visible.

Validation:

- Full local `build-shardfiles --shard=open-plot-night-market`: exit 0,
  53.95 s, no tile refused. Existing unrelated map/world parity warnings remain.
- Open-plot, curtain and entry-fence regressions: 14 cases across four suites;
  the final four changed fixture cases also pass.
- Touched typed lint and full layers/root types pass.
- Exact pinned preview: exit 0, 155.93 s, including all grid products.
- Capture preparation correction: same pin, preview exit 0 in 111.81 s; explicit
  phone/touch settings and a wait for the existing streaming uploads replace an
  earlier premature capture. Only this final JPEG is committed (206,222 bytes).
- No collider or authored plot geometry changed; no physics walk was required.

Jake's in-game pilot verdict remains G684; this capture does not replace it.

## White panel and cyan arch check

Both shapes are baked LOD content, not an outstanding texture request:

| Shape | Source and check |
|---|---|
| Pale rectangle right of the gate | The plaza poster at local x = −22, z = −40, bottom 2.5 m, width 20 m (`data/layouts/night-market.json:54`). The near bake deliberately stores vertex colours rather than colour maps (`src/sdk/bake/placeholders.ts:397`). `generators/tiledPlot.mjs:85` supplies the poster image's mean colour. An offline ray through its centre hits the actual baked `near-light` face at [−21.9802, 8, −40.2200], with all three vertex colours [0.22364, 0.17661, 0.17757]. It is a flat, untextured approximation in this view; the nearby entry poster is the textured detail version. |
| Cyan shape inside the arch | The opening is empty in both the Night Market source world and its baked near mesh: the camera-centre ray hits neither. The same ray then hits the northern Thin Ice plot's `far_hologram` at distance 822.85 m, local-to-Night-Market [0, 19.5476, 537.7700]. Its `Glow` material's authored base factor is [0.35, 1, 1, 1]. The grid places Thin Ice at [−1, 2], immediately beyond Night Market [−1, 1]. The cyan silhouette is that neighbour seen through the open arch. |

The audit uses the built product's actual near/light GLBs and the two original
world GLBs; it does not infer ownership from colours in the screenshot. No
material, texture, geometry or loading code changed after this check, so the
same source pin and final JPEG remain the artifact.
