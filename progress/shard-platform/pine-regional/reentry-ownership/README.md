# Pine re-entry ownership — E435 / SF47-g

The texture crash and the generic draw-time owner leak are corrected. The three-visit run on pushed `61bb3b25b` has **zero texture, page, console or disposal errors**; 12 real controller legs pass, road sky restores exactly, and final unload is zero native / GPU / scope resources. Residual per-visit baked-coat uploads remain: the coat lane owns their `adoptOnce` fix. This receipt does **not** claim bounded memory until that rerun.

| Same road after visit | GL MB (10^6 bytes) |
| --- | ---: |
| 1 | 144.23 |
| 2 | 148.33 |
| 3 | 152.61 |

Visit 1 -> 2 adds 4,108,092 bytes. Twelve duplicate coat uploads account for 4,194,624 bytes (349,552 each); all other resources net -86,532 bytes. The camera kit / reused water and height samplers no longer accumulate. Full per-asset changes are in `three-visits-61bb3b25b.summary.json`.

The separate **borrowed-home cold return** on `a801eda4c` booted Developer OFF, enabled the existing Developer switch in the same page, walked away until Pine actually unloaded, then rebuilt and restored boar `creature:152` at **99 HP**. Seven legs / twelve waypoints complete in **130.082 s**. There is one `engine.player.for` updater on first and rebuilt entries. Final bodies, colliders, geometries, textures, programs and every scope census field are **0**, with no disposal errors. The unchanged raw harness marks red solely because CDP reports the same expected Nalati budget refusal as both an exception and a promise rejection; both retain the exact `claim` / `admitRegion` stack. The compact summary records the corrected classification, and the reproducible script recognizes both events. Boot-level event listeners remain baseline; the four `other` listeners are Playwright injection.

Sources: `279ec4692` draw uploads, `2dff8ccc2` shared rifle atlas, `eb74adfc4` memo invalidation, `6d73598ab` hybrid cache audit, `5d2e77161` released image sources, `a801eda4c` camera kits / disposed-owner replacement, `7462580dc` drawn NPC rig invalidation. No shader, material recipe, HUD or appearance changes.

Validation: focused cache/owner fixtures **38/38**, companion lifecycle/model fixtures **41/41**, final NPC fixture **4/4**; strict root TypeScript and scoped typed lint pass. Native regressions fail before their respective source fixes. The serialized pusher owns full clean gates and generation.

Reproduce from a pinned `scripts/serve-build.sh --rev <sha>` preview, started in a scratch folder:

```sh
scripts/browser-lane.sh --max 12 node progress/shard-platform/pine-regional/reentry-ownership/capture.mjs --url=http://127.0.0.1:PORT --sky=shared --out=/tmp/three-visits.json --shots=/tmp --prefix=three-visits
scripts/browser-lane.sh --max 12 node progress/shard-platform/pine-regional/reentry-ownership/cold-return.mjs --url=http://127.0.0.1:PORT --sha=<sha> --out=/tmp/cold-return.json
```

All browsers are muted, portrait iPhone 16 Pro, real Metal, and closed before reporting; previews stopped. This is a resource lifecycle regression proof, not an iOS footprint / SF57 qualification. Gzip payloads preserve every raw assertion; each summary seals the decoded SHA256. The earlier `6d73598ab` run is explicitly intermediate: its final leak call lacked the required harness pins.
