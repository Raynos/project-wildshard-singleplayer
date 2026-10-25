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
