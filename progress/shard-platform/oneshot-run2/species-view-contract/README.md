# OS-G1: species view contract admission

PASS: build and validate refuse incompatible custom rigs before view allocation.
Every species requires actual lowercase `body` and `head` joints/sockets. The
client and product admission now use the same pure rule. Exact GLB joint order,
socket names and clip names are checked against admitted bytes, including a
negative where the actual GLB body is renamed without changing its geometry.

The original one-shot run 2 remains FAIL; its author source was not changed.
A diagnostic reproduction regenerated the same retained goat/hawk meshes with
`Root` renamed `body` and a real `head` joint added. No geometry, skin weights,
behaviour rows, interactions or native inputs were bypassed. The emitted skin
metadata lists `body` and `head`; costs and hashes derive from the regenerated
bytes. It was built/validated with the corrected SDK client, then entered in
muted Chromium, iPhone 16 Pro. This is a contract correction, not a regrade of
the fresh seat.

Exact built shard.json SHA-256: `1420a578464bc1d37677f9342071163feb904599e4ee3b9cdce01a06736d6be0`.
The mandatory `proveMesaOutpost` completed 1083 native ticks: three goats flee,
hawk attack causes damage (100 → 94.0667), the real reachable beacon lights, and
the 30-tick restored suffix is exact. All four client views are attached/visible,
finite and matched to native state; the beacon is selected. Equipped canonical
commons spear: three meshes, exact asset/profile/catalogue closure. The rendered
observation uses the endpoint independently reached by the native input route;
it does not fabricate native interaction or quest progress.

Focused admission/bones/client/docs: 27 tests pass; root strict in the clean
export and touched root lint pass. The additional actual-GLB negative passes
with the other admission cases (5 tests). SDK build and actual binary
`wildshard build`/`validate` pass. Static proof server API/telemetry endpoints
return 404; no gameplay exception occurred. Browsers and HTTP server closed in
finally. Engine → format +1 defining import; no additional public module.

Reproduction sources and exact product remain in the owned scratch folder
`/private/tmp/claude-501/sp-builders/sp-x5/os-g1/`; generated assets/logs are not
committed. The retained authoring recipe below records the source correction:

```ts
// Each existing Root Bone in generators/animals.ts:
body.name = 'body';
// Add a real head Bone under body; goat at [0,1.24,0.64], hawk at [0,0.1,0.42].
head.name = 'head';
body.add(head);
// Include head in Skeleton/joint order and emitted clips; keep existing weights.
rig.sockets = ['body', 'head'];
```
