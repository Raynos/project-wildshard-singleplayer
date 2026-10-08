# Pine re-entry ownership — E435 / SF47-g

The three-visit rerun on `e406c2f60` (the coat lane's separate `adoptOnce` fix) **passes**: 12 real controller legs, two full re-entries, zero texture / page / console / disposal errors, and exact road sky restoration after every leave. The ~105 MB-per-visit GL growth is removed. Raw per-visit texture bytes are identical; only small instancing-buffer changes remain.

| Same road after visit | GL bytes | Texture bytes | GL change |
| --- | ---: | ---: | ---: |
| 1 | 144,138,162 | 111,561,080 | — |
| 2 | 144,225,270 | 111,561,080 | +87,108 |
| 3 | 144,225,654 | 111,561,080 | +384 |

Final **level / scope** census: bodies, colliders, geometries, textures, programs and every scope field **0**. The raw WebGL census is separately **25,372,736 bytes**, consisting of 13,140,576 bytes of persistent page composer and 12,232,160 bytes of shared retained rig / coat / atlas resources. This is a stable cache, not a claim that raw WebGL absolute usage reaches zero.

The preceding pushed `61bb3b25b` run already eliminated camera-kit and reused-sampler accumulation, with no errors and the same clean scope unload. Its remaining ~4.2 MB/visit was traced to twelve duplicate baked-coat uploads. The exact asset deltas and unchanged raw assertions remain in `three-visits-61bb3b25b.*`; that intermediate run does not claim bounded memory. The coat fix removes all twelve repeated uploads.

The separate **borrowed-home cold return** on `a801eda4c` booted Developer OFF, enabled the existing Developer switch in the same page, walked away until Pine actually unloaded, then rebuilt and restored boar `creature:152` at **99 HP**. Seven legs / twelve waypoints complete in **130.082 s**. There is one `engine.player.for` updater on first and rebuilt entries. Final bodies, colliders, level geometries / textures / programs and every scope census field are **0**, with no disposal errors. The unchanged raw harness marks red solely because CDP reports the same expected Nalati budget refusal as both an exception and a promise rejection; both retain the exact `claim` / `admitRegion` stack. The compact summary records the corrected classification, and the reproducible script recognizes both events. Boot-level event listeners remain baseline; the four `other` listeners are Playwright injection.

Sources: `279ec4692` draw uploads, `2dff8ccc2` shared rifle atlas, `eb74adfc4` memo invalidation, `6d73598ab` hybrid cache audit, `5d2e77161` released image sources, `a801eda4c` camera kits / disposed-owner replacement, `7462580dc` drawn NPC rig invalidation. No shader, material recipe, HUD or appearance changes.

Validation: focused cache/owner fixtures **38/38**, companion lifecycle/model fixtures **41/41**, final NPC fixture **4/4**; strict root TypeScript and scoped typed lint pass. Native regressions fail before their respective source fixes. The serialized pusher owns full clean gates and generation.

Reproduce from a pinned `scripts/serve-build.sh --rev <sha>` preview, started in a scratch folder:

```sh
scripts/browser-lane.sh --max 12 node progress/shard-platform/pine-regional/reentry-ownership/capture.mjs --url=http://127.0.0.1:PORT --sky=shared --out=/tmp/three-visits.json --shots=/tmp --prefix=three-visits
scripts/browser-lane.sh --max 12 node progress/shard-platform/pine-regional/reentry-ownership/cold-return.mjs --url=http://127.0.0.1:PORT --sha=<sha> --out=/tmp/cold-return.json
```

All browsers are muted, portrait iPhone 16 Pro, real Metal, and closed before reporting; previews stopped. This is a resource lifecycle regression proof, not an iOS footprint / SF57 qualification. Gzip payloads preserve every raw assertion; each summary seals the decoded SHA256. The earlier `6d73598ab` run is explicitly intermediate: its final leak call lacked the required harness pins.
