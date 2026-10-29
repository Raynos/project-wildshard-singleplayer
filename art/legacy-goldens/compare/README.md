# Shardfile vs Legacy Golden (G859)

The working view for the LEGACY goldens: **144 pairs, 24 cameras per shard** (6 shards), the LEGACY golden against a
fresh SHARDFILE capture of HEAD, grouped by shard into **Needs work** and then **Great**. The page is one Artifact that
wildshard-v republishes after every wave of fixes. When Jake says the wave is good, that run's 144 SHARDFILE frames
become `art/shardfile-goldens/` (G859). The first pass had 4 cameras per shard, which cannot cover a 500 × 500 m cell.

- `cameras24.json`: the 24 cameras per shard. Cameras 1–4 are the CO6 cameras
  ([cameras.json](../../legacy-vs-shardfile/round-1-2026-10-28/cameras.json)), so the 4-camera goldens stay
  comparable. Then about 8 more point-of-interest views at eye height (manifest `pois`, layout places), 8 coverage
  views across the cell, 2 aerials and 2 first-person hands close-ups. Each camera has a name, kind, POI, player probe,
  eye, yaw and pitch (degrees; yaw 0 = −z, 90 = +x). Eyes come from the LEGACY run (`compare.py eyes`), so SHARDFILE
  renders exactly the same camera. Every camera was checked on the LEGACY capture: it is inside the cell and not inside
  geometry.
- `capture.mjs --cameras=… --mode=legacy|shardfile`: seed 357, saved midday / clear, phone tier, 2×, muted Chromium,
  iPhone 16 Pro portrait. Entry is through SHARD SELECT: LEGACY through the Debug row's LEGACY button, SHARDFILE
  through its own button. There are 120 drawn frames plus a streaming-idle wait per camera. One browser context covers
  a whole shard per mode. The HUD and the minimap are hidden for the shot (only the game canvas shows), 804 × 1362.
  - **The eye is the game camera** (NR10 / NR12, 10-28): a late hook sets the camera to the eye on every frame, and 60 live
    frames plus a streaming-idle wait run at the eye before the held shot, so what the game culls and streams in its update
    (instanced dressing, the tile ring, coarse masks) is the eye's. A **free camera** (its eye more than 4 m from the probe's)
    poses the player under the eye, hovering, so the ring and colliders stand round the camera; the board (what hover
    hangs on the camera, and the board model) is hidden for the shot. Stepping off is no fix: a player that drops far
    respawns at spawn and takes the ring with it. Runs before this held the eye only for the shot: the player stayed at the probe, so ring content past the probe's
    5 × 5 (Nine's road-deck end walls, cams 11 / 12) and the eye's own culling (Nine's rooftop dressing, 21 / 22) were the
    probe's, not the eye's. The LEGACY goldens are unchanged (LEGACY drew everything whole).
- `compare.py`:
  - `eyes` and `goldens` are the one-time LEGACY export: `../<shard>/24/<nn>-<camera>.jpg`, 540 px wide, quality 70 down to 42 to stay near 42 KB (6.7 MB for 144).
  - `frames` writes a run's SHARDFILE JPEGs to `tmp/golden-compare-144/<run>/`, which is never committed, and prints
    luma SSIM. No mask is needed, because there is no HUD in the frames.
  - `page` builds the HTML. Each side is one 540 px WebP shown as a thumbnail that opens full width in place on tap.
    Separate thumbnails plus full-size frames for 288 images do not fit a page of about 12 MB.
- `verdicts.json`: the by-eye call per pair (great / needs, what's wrong, the plan row, "NEW" when no row covers it).
  Look at every pair and update it each run; the page flags verdicts judged on an older run.
- `2026-10-28-a70d446ee2/`: the first 4-camera run (history).

## Rerun (SHARDFILE only; the LEGACY goldens are frozen)

```sh
SERVE_OWNER=golden-compare scripts/serve-build.sh --head --hours 1      # prints http://127.0.0.1:<port>/
RUN=$(date +%F)-$(git rev-parse --short=10 HEAD)
for shards in driftwood-isle,pine-hollow,nalati-grasslands far-reach,sunscar-dunes,nine-dragon-stack; do
  scripts/browser-lane.sh --max 40 node art/legacy-goldens/compare/capture.mjs --base=http://127.0.0.1:<port>/ \
    --cameras=art/legacy-goldens/compare/cameras24.json --mode=shardfile --shards=$shards --out=tmp/golden-compare-144/raw &
done; wait
SERVE_OWNER=golden-compare scripts/serve-build.sh stop <port>
python3 art/legacy-goldens/compare/compare.py frames --raw tmp/golden-compare-144/raw --run $RUN
# look at every pair, edit verdicts.json ("judged": "$RUN"), then:
python3 art/legacy-goldens/compare/compare.py page --run $RUN --captured "<time> Cancun" \
  --out <scratchpad>/shardfile-vs-golden/shardfile-vs-golden.html
rm -rf tmp/golden-compare-144/raw      # keep tmp/golden-compare-144/<run>/ for the next page
```

`capture.mjs` refuses a preview whose build is not HEAD. Pass `--sha=<full sha>` if HEAD moved after the build started.
`--exp=<file.js>` (diagnostics only) runs that file's body in the page just before the held shot, with `w` (the world) and
`g` (the game); its return value lands in the receipt (`poses[].exp`). NR15 used it to hide or swap meshes and read live uniforms.
`--cams=5,9` recaptures only some cameras.
