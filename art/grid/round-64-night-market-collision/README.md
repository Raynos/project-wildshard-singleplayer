# G721 · Night Market collision

Source fixes: `22248f9b6a` (motor terrain filter) and `49af17b6b6`
(shared lamp/stall posts). Captured app `49af17b6b6a7c4de505864683aaa30f953810d80`,
build `49af17b-mvnbnfyg`.

The hoverboard skipped every collider tagged `ground`, including the existing
baked walls, houses and trees. The motor now skips actual terrain heightfields;
classification happens at registration, and its controller callback reads only
weak JavaScript metadata. Surface/owner tags and snapshot bytes stay unchanged.
Fresh install and saved-tag replay use the same classification. The shared kit
also registers previously missing lamp posts and upper stall posts.

The new boxes stay inside the existing baked per-tile collision chunks and their
normal physics ownership. No collider ring size or residency policy changes.
All eight original rendered-geometry hashes (four rotations each of house/stall
fixtures) remain exact. This is a collision fix, not a new streaming policy.

## Actual phone-tier walk

`physics-baseline.mjs --no-build --mode=walk`, browser lane, muted iPhone 16 Pro
portrait, phone tier, native walk CPU 1×. [Route](route.json),
[scalar results](summary.json).

| Leg | Seconds | Frames | Stuck | Complete |
|---|---:|---:|---:|---|
| South entry and canal bridge | 33.4 | 1001 | 0 | yes |
| Stall aisle | 10.9 | 326 | 0 | yes |
| Board into house wall | 2.6 | 78 | 0 | yes; 0 outside frames |

No walk errors or timeouts. The bridge leg reaches 2.29 m and returns to ground.
The board stops at x −83.150, outside the house face at x −82.750, matching the
motor radius plus skin. A separate four-second held-forward capture records
241 frames, board on, maximum x −83.14994 and 0.000161 m movement during the
last second. Runtime errors: none; context lost: false.

[Board stopped at the wall](board-wall.jpg): the camera turns along the wall
only after the held-input measurement, showing the board, wall and courtyard.
The first straight-on capture filled the view with the wall; this framing adds
context without moving the player or changing any scene object. Only the label
strip and JPEG resize are added to the real capture.

```sh
scripts/browser-lane.sh --max 180 node scripts/physics-baseline.mjs \
  --no-build --mode=walk --url=http://127.0.0.1:4402 \
  --shard=open-plot-night-market --tier=phone \
  --device-save=devMode=true --settings=tier=phone,volume=0 \
  --route=art/grid/round-64-night-market-collision/route.json \
  --out=tmp/sp-x2/g721/walk --label=g721
```

Pinned full preview exits 0 in 150.25 s; Night Market's product rebuild is
48.3 s, 64 L0 / 16 L1 slots, no refused tiles. Existing report-only tile debt
remains reported. Five native motor cases, two real-GC cases and four kit/config
cases pass; engine/test layer types and touched typed lint pass. The motor's
commit selection passes 87 cases / 21 suites. The kit's own related case passes;
its warm root prerequisite deferred on a peer boot fixture's tuple callback,
without an own-source diagnostic. This is Chromium phone-tier gameplay proof,
not a physical-phone frame or memory floor.
