# Grid reveal handoff delay

Pinned clean origin: `07209c6260fd4e8160625295199f8672df10e8b2`, build `07209c6-muu8j9kq`.
Muted iPhone 16 Pro portrait Chromium. Real INFINITE WILDSHARD title tap; the reveal was not skipped.

Command: `scripts/browser-lane.sh node progress/shard-platform/sf21a/reveal-readiness.mjs --url=http://127.0.0.1:4472 --label=before`.
Repeat with `--label=before-hybrid --hybrid` to set the existing Driftwood hybrid Debug row ON.

| Variant | Path ends | Home signal | Reveal ends | Ceiling |
| --- | ---: | ---: | ---: | --- |
| Hybrid OFF | 7,004.8 ms | 0 ms (none promised) | 7,004.8 ms | false |
| Hybrid ON | 7,031.9 ms | never | 27,065.2 ms | true |

Both runs had zero page errors. Eight far proxies were uploaded within the first sampled half-second;
ring readiness was not the blocker. Full samples and warnings are in
[OFF trace](reveal-before-07209c6-muu8j9kq.json) and
[ON trace](reveal-before-hybrid-07209c6-muu8j9kq.json).

Root cause: `prepareHybridShard` unconditionally announced `gridHomeSim.expect()`, but the real Driftwood
declaration takes `ShardfileClient.emptyTrustedData`; that path intentionally skips constructing a simulation
and never emits `onSimulation`. The reveal correctly waited for a promised handoff that could never arrive.

Fix `4681d09ed`: the data client announces `onSimulationExpected` during construction only when it will
create a simulation. Hybrid composition forwards that capability announcement into the grid handoff.
The seven-second camera path and twenty-second post-path safety ceiling remain unchanged. Empty trusted
transitions keep their legacy runtime; genuine data clients still hold readiness until their real handoff.

`pnpm exec vitest run test/grid-home-handoff.test.ts`: 6/6 green, including actual Driftwood admission,
actual hybrid composition, actual reveal input restoration at 7.1 seconds, and a genuine delayed handoff
still holding input until it arrives. Root strict typecheck and scoped lint are green. These are Node/DOM
contract checks; a post-fix browser timing run is pending the coordinator's quiet-window release.

Both diagnostic browsers and the owned preview are closed. No ceiling was shortened or readiness fence waived.
