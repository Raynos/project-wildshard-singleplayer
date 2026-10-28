# Shardfile vs Legacy Golden (G859)

The working view for the LEGACY goldens in [`art/legacy-goldens/`](../README.md): 24 pairs (6 shards × 4 cameras), the
LEGACY golden against a fresh SHARDFILE capture of HEAD, grouped by shard into **Needs work** and **Great**. The page
is one Artifact that wildshard-v republishes after every wave of fixes. When Jake says the wave is good, that run's 24
frames become `art/shardfile-goldens/` (G859).

- `capture.mjs`: the goldens' entry and cameras (CO6 `cameras.json`, seed 357, saved midday / clear, phone tier, 2×,
  muted Chromium, iPhone 16 Pro portrait), SHARDFILE entry, 120 drawn frames plus a streaming-idle wait per camera.
- `compare.py`: `frames` writes the run's JPEGs (≤ 120 KB) and prints HUD-masked luma SSIM; `page` builds the HTML.
- `verdicts.json`: the by-eye call per pair (great / needs, what's wrong, the plan row). Look at every pair and update
  it each run; the page flags verdicts judged on an older run.
- `<date>-<sha10>/`: each run's 24 SHARDFILE frames.

## Rerun

```sh
SERVE_OWNER=golden-compare scripts/serve-build.sh --head --hours 1      # prints http://127.0.0.1:<port>/
RUN=$(date +%F)-$(git rev-parse --short=10 HEAD)
scripts/browser-lane.sh --max 30 node art/legacy-goldens/compare/capture.mjs --base=http://127.0.0.1:<port>/ --out=tmp/golden-compare/raw
SERVE_OWNER=golden-compare scripts/serve-build.sh stop <port>
python3 art/legacy-goldens/compare/compare.py frames --raw tmp/golden-compare/raw --run $RUN
# look at every pair, edit verdicts.json ("judged": "$RUN"), then:
python3 art/legacy-goldens/compare/compare.py page --run $RUN --captured "<time> Cancun" \
  --out <scratchpad>/shardfile-vs-golden/shardfile-vs-golden.html
rm -rf tmp/golden-compare
```

`capture.mjs` refuses a preview whose build is not HEAD; pass `--sha=<full sha>` if HEAD moved after the build started.
