# SF60 and SF74: 11 October 2026 release receipt

At 23:21 UTC production independently serves `5fc3423-mv4g37dy`,
built at 23:19:25.546 UTC, from exact commit
`5fc34238e8bb2a3d6e77bd08c7a5f27724bc7351`.

- Push CI: [38182470819](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38182470819), green at 23:06:05 UTC.
- Exact-SHA boot/HOVER smoke: [38182998894](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38182998894); status green 23:14:56 UTC.
- Release: [38183573323](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38183573323), green, automatically dispatched 23:15:07 UTC.
- Coverage: [38183108912](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38183108912); all eight instrumented shards and merged
  ratchet green at 23:17:04 UTC. Measured aggregate percentages: lines 74.43,
  statements 70.89, functions 73.81, branches 64.63.

The shared hourly slot permitted that automatic release. No manual
redispatch was issued. CI-to-live took 13 min 20 s; smoke-to-live took
4 min 30 s. One complete successful release is not a one-day cadence
proof. The 12-hour delivery/speed and daily playtest/card targets remain
unqualified.

W12 Linux coverage requalifies the complete byte/compiler/native fixes
(a2d0c5499, 859e401d9, 07865987e), alongside the retained map byte check
750fd90b8. No timeout or coverage threshold changed. This is one exact
Linux run, not a guarantee that future nightly runs cannot flake.

The later diagnostic commits dd61a915c and lint repair 321a8043f are
outside this production pin. Exact 441bb32b8 passed the complete local
push gate in 468.95 s and pushed both commits at 23:29 UTC. The next
Linux push CI 38184434898 and admin 38184435075 are green on that
exact SHA. Boot smoke is running; restore field diagnosis stays open.
Darwin x64 Node 24.18.1/24.21.0 finite JSON/Math samples match, supplying
no positive evidence for a Node pin; Linux restore field diagnosis stays
open. No witness payload was deliberately recaptured or relaxed.

The finite Darwin x64 comparison used 140 JSON samples and 98 native
Math samples: Node 24.18.1 / V8 13.6.233.17-node.50 versus Node 24.21.0 /
V8 13.6.233.17-node.53. Every sampled bit matched. The downloaded runtime
was SHA256 verified against the official manifest and deleted after the
probe. These finite Darwin results do not qualify Linux or all inputs.
